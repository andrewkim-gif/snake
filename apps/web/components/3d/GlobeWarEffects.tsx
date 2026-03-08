'use client';

/**
 * GlobeWarEffects — v14 Phase 7 S34 + v15 Phase 4 enhancements
 * War visual effects on the globe:
 * 1. War declaration: red dashed arc line between nations
 * 2. Territory edge red blinking (0.5Hz)
 * 3. Explosion particles near borders
 * 4. War progress: moving arrow particles on arc
 * 5. War end: gold fireworks for winner, color transition for loser (ENHANCED: 300 particles, 3-stage burst)
 * 6. Camera auto-rotate to war zone
 * 7. [v15] War fog: red fog particles at midpoint between warring nations
 * 8. [v15] Camera shake: sin(t*40)*0.3 offset for 0.5s on war declaration
 */

import { useRef, useMemo, useEffect, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { latLngToVector3 } from '@/lib/globe-utils';
import { CAMERA_PRIORITY, ARC_HEIGHT, COLORS_BASE } from '@/lib/effect-constants';
import { createArcPoints } from '@/lib/effect-utils';

// ─── Types ───

export interface WarEffectData {
  warId: string;
  state: 'preparation' | 'active' | 'ended';
  attacker: string;       // ISO3
  defender: string;       // ISO3
  attackerScore: number;
  defenderScore: number;
  outcome?: 'attacker_win' | 'defender_win' | 'truce' | 'fatigue_end' | 'auto_surrender';
  winner?: string;
}

export interface GlobeWarEffectsProps {
  /** Active wars to render effects for */
  wars: WarEffectData[];

  /** Map of ISO3 → [lat, lng] country centroids */
  countryCentroids: Map<string, [number, number]>;

  /** Globe radius (must match globe mesh) */
  globeRadius?: number;

  /** Whether to auto-rotate camera to war zone on new declaration */
  autoRotateCamera?: boolean;

  /** Callback when camera should look at a position
   *  v24: priority 파라미터 추가 (war=4)
   */
  onCameraTarget?: (position: THREE.Vector3, priority?: number) => void;

  /** Visibility toggle */
  visible?: boolean;

  /** v15 Phase 6: 모바일 LOD — 전장 안개 활성화 여부 (기본 true) */
  enableWarFog?: boolean;
}

// ─── Constants ───

const DEFAULT_GLOBE_RADIUS = 100;

// Arc line — v24: 통일 색상 + 높이 체계
const ARC_COLOR_WAR = COLORS_BASE.war.clone();
const ARC_COLOR_PREP = new THREE.Color(0xff6633);
const WAR_ARC_SEGMENTS = 64;
const ARC_DASH_SIZE = 0.03;
const ARC_GAP_SIZE = 0.02;

// Territory blinking
const BLINK_FREQUENCY = 0.5; // Hz
const BLINK_COLOR = COLORS_BASE.war.clone();

// Particles
const ARROW_PARTICLE_COUNT = 12;
const FIREWORK_PARTICLE_COUNT = 300; // v15: upgraded from 50 → 300 (legacy, unused by VictoryFireworks3D)

// v23 Phase 6: VictoryFireworks3D constants
const ROCKET_COUNT = 4;                  // 3~5 simultaneous rockets
const ROCKET_ASCEND_HEIGHT = 4.0;        // units above surface (3~5 range)
const ROCKET_ASCEND_DURATION = 0.3;      // 0~0.3s ascent
const ROCKET_FLASH_START = 0.3;          // 0.3~0.5s flash at apex
const ROCKET_FLASH_END = 0.5;
const ROCKET_EXPLODE_START = 0.5;        // 0.5~2.0s explosion spread
const ROCKET_EXPLODE_END = 2.0;
const ROCKET_CYCLE_DURATION = 2.5;       // total cycle ~2.5s
const EXPLOSION_PARTICLES_PER_ROCKET = 40; // 35~50 range
const SMOKE_TRAIL_COUNT = 3;             // small spheres behind each rocket

// v23: Explosion3D constants
const EXPLOSION_FLASH_DURATION = 0.2;     // seconds
const EXPLOSION_FIREBALL_START = 0.1;     // seconds
const EXPLOSION_FIREBALL_END = 0.8;       // seconds
const EXPLOSION_FIREBALL_COUNT = 22;      // InstancedMesh spheres
const EXPLOSION_DEBRIS_START = 0.3;       // seconds
const EXPLOSION_DEBRIS_END = 1.5;         // seconds
const EXPLOSION_DEBRIS_COUNT = 14;        // InstancedMesh cubes
const EXPLOSION_TOTAL_DURATION = 1.6;     // auto cleanup after this

// War end
const WINNER_FIREWORK_COLOR = new THREE.Color(0xffd700); // gold
const LOSER_TRANSITION_DURATION = 5.0; // seconds

// v23: Volumetric war fog constants (WarFog3D)
const WAR_FOG_SPHERE_COUNT = 10;
const WAR_FOG_SPREAD = 0.08; // spread relative to globe radius

// v24: CameraShake removed — now handled by CameraController

// ─── GC-prevention temp objects (module scope) ───

const _tempObj3D = new THREE.Object3D();
const _tempVec3 = new THREE.Vector3();
const _tempColor = new THREE.Color();
// v23 Phase 6: Additional GC-prevention for VictoryFireworks3D
const _fwVec = new THREE.Vector3();
const _fwNormal = new THREE.Vector3();
const _fwObj = new THREE.Object3D();
const _fwColor = new THREE.Color();
const _fwUp = new THREE.Vector3(0, 1, 0);

// ─── Helpers ───

// latLngToVector3 → @/lib/globe-utils (v20 통합)
// createArcPoints → @/lib/effect-utils (v24 통합)

// ─── Sub-components ───

/**
 * WarArcLine — Red dashed arc between two warring nations.
 * During preparation: orange, during active: red with moving arrow particles.
 */
function WarArcLine({
  start,
  end,
  globeRadius,
  state,
  attackerScore,
  defenderScore,
}: {
  start: THREE.Vector3;
  end: THREE.Vector3;
  globeRadius: number;
  state: 'preparation' | 'active' | 'ended';
  attackerScore: number;
  defenderScore: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const lineObjRef = useRef<THREE.Line | null>(null);
  const arrowsObjRef = useRef<THREE.Points | null>(null);
  const timeRef = useRef(0);

  const arcPoints = useMemo(
    () => createArcPoints(start, end, globeRadius, ARC_HEIGHT.war, WAR_ARC_SEGMENTS),
    [start, end, globeRadius],
  );

  // Create line geometry
  const lineGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints(arcPoints);
    return geometry;
  }, [arcPoints]);

  // Dashed line material
  const lineMaterial = useMemo(() => {
    const color = state === 'preparation' ? ARC_COLOR_PREP : ARC_COLOR_WAR;
    const mat = new THREE.LineDashedMaterial({
      color,
      dashSize: ARC_DASH_SIZE * globeRadius,
      gapSize: ARC_GAP_SIZE * globeRadius,
      linewidth: 2,
      transparent: true,
      opacity: state === 'ended' ? 0 : 0.9,
    });
    return mat;
  }, [state, globeRadius]);

  // Arrow particles (moving along arc during active war)
  const arrowGeometry = useMemo(() => {
    const positions = new Float32Array(ARROW_PARTICLE_COUNT * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geometry;
  }, []);

  const arrowMaterial = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: ARC_COLOR_WAR,
        size: globeRadius * 0.02,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [globeRadius],
  );

  // Create Three.js objects imperatively to avoid JSX <line> conflict
  useEffect(() => {
    if (!groupRef.current) return;
    const group = groupRef.current;

    // Create dashed line
    const lineObj = new THREE.Line(lineGeometry, lineMaterial);
    lineObj.computeLineDistances();
    group.add(lineObj);
    lineObjRef.current = lineObj;

    // Create arrow particles (only for active state)
    if (state === 'active') {
      const arrowObj = new THREE.Points(arrowGeometry, arrowMaterial);
      group.add(arrowObj);
      arrowsObjRef.current = arrowObj;
    }

    return () => {
      if (lineObjRef.current) {
        group.remove(lineObjRef.current);
        lineObjRef.current = null;
      }
      if (arrowsObjRef.current) {
        group.remove(arrowsObjRef.current);
        arrowsObjRef.current = null;
      }
    };
  }, [lineGeometry, lineMaterial, arrowGeometry, arrowMaterial, state]);

  // Animate
  useFrame((_, delta) => {
    timeRef.current += delta;

    // Animate dashed line
    if (lineObjRef.current) {
      lineObjRef.current.computeLineDistances();
      // Pulse opacity during active war
      if (state === 'active') {
        const pulse = 0.6 + 0.4 * Math.sin(timeRef.current * 3);
        lineMaterial.opacity = pulse;
      }
    }

    // Animate arrow particles along arc
    if (arrowsObjRef.current && state === 'active' && arcPoints.length > 1) {
      const positions = arrowGeometry.attributes.position as THREE.BufferAttribute;
      const dominantDirection = attackerScore >= defenderScore ? 1 : -1;

      for (let i = 0; i < ARROW_PARTICLE_COUNT; i++) {
        let t = ((timeRef.current * 0.3 + i / ARROW_PARTICLE_COUNT) % 1.0);
        if (dominantDirection < 0) t = 1.0 - t;
        const idx = Math.floor(t * (arcPoints.length - 1));
        const point = arcPoints[Math.min(idx, arcPoints.length - 1)];
        positions.setXYZ(i, point.x, point.y, point.z);
      }
      positions.needsUpdate = true;
    }
  });

  // Cleanup geometries/materials on unmount
  useEffect(() => {
    return () => {
      lineGeometry.dispose();
      lineMaterial.dispose();
      arrowGeometry.dispose();
      arrowMaterial.dispose();
    };
  }, [lineGeometry, lineMaterial, arrowGeometry, arrowMaterial]);

  if (state === 'ended') return null;

  return <group ref={groupRef} />;
}

/**
 * TerritoryBlink — Red blinking overlay for warring nations' territories.
 */
function TerritoryBlink({
  position,
  globeRadius,
  state,
}: {
  position: THREE.Vector3;
  globeRadius: number;
  state: 'preparation' | 'active' | 'ended';
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);

  const geometry = useMemo(
    () => new THREE.SphereGeometry(globeRadius * 0.04, 16, 16),
    [globeRadius],
  );

  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: BLINK_COLOR,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );

  useFrame((_, delta) => {
    if (!meshRef.current || state === 'ended') return;
    timeRef.current += delta;

    // 0.5Hz blinking (1s on, 1s off)
    const blinkCycle = Math.sin(timeRef.current * Math.PI * BLINK_FREQUENCY);
    material.opacity = Math.max(0, blinkCycle) * 0.6;
  });

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  if (state === 'ended') return null;

  return (
    <mesh ref={meshRef} position={position} geometry={geometry} material={material} />
  );
}

/**
 * Explosion3D — v23 Phase 3: 3-stage InstancedMesh explosion particle system.
 * Stage 1 (Flash, 0~0.2s): Center sphere rapid expansion, white→yellow, AdditiveBlending + Bloom
 * Stage 2 (Fireball, 0.1~0.8s): 22 small spheres expanding outward, yellow→orange→dark red
 * Stage 3 (Debris, 0.3~1.5s): 14 BoxGeometry cubes ejected randomly, spherical gravity pull
 */
function Explosion3D({
  center,
  globeRadius,
  state,
}: {
  center: THREE.Vector3;
  globeRadius: number;
  state: 'preparation' | 'active' | 'ended';
}) {
  const groupRef = useRef<THREE.Group>(null);
  const flashRef = useRef<THREE.Mesh>(null);
  const fireballRef = useRef<THREE.InstancedMesh>(null);
  const debrisRef = useRef<THREE.InstancedMesh>(null);
  const timeRef = useRef(0);
  const cycleRef = useRef(0); // tracks explosion cycles for continuous re-triggering

  // Pre-compute fireball random directions + speeds (stable across re-renders)
  const fireballData = useMemo(() => {
    const directions: THREE.Vector3[] = [];
    const speeds: number[] = [];
    for (let i = 0; i < EXPLOSION_FIREBALL_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      directions.push(new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.sin(phi) * Math.sin(theta),
        Math.cos(phi),
      ));
      speeds.push(1.5 + Math.random() * 2.5);
    }
    return { directions, speeds };
  }, []);

  // Pre-compute debris random directions + speeds + rotation axes
  const debrisData = useMemo(() => {
    const directions: THREE.Vector3[] = [];
    const speeds: number[] = [];
    const rotAxes: THREE.Vector3[] = [];
    const rotSpeeds: number[] = [];
    for (let i = 0; i < EXPLOSION_DEBRIS_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      directions.push(new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.sin(phi) * Math.sin(theta),
        Math.cos(phi),
      ));
      speeds.push(3.0 + Math.random() * 4.0);
      // Random rotation axis for tumbling
      rotAxes.push(new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5,
      ).normalize());
      rotSpeeds.push(3.0 + Math.random() * 8.0);
    }
    return { directions, speeds, rotAxes, rotSpeeds };
  }, []);

  // Shared geometries (created once)
  const flashGeo = useMemo(() => new THREE.SphereGeometry(0.5, 12, 12), []);
  const fireballGeo = useMemo(() => new THREE.SphereGeometry(0.3, 8, 8), []);
  const debrisGeo = useMemo(() => new THREE.BoxGeometry(0.2, 0.2, 0.2), []);

  // Flash material — AdditiveBlending, toneMapped=false for Bloom, high emissive
  const flashMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 8,
    transparent: true,
    opacity: 1,
    toneMapped: false,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }), []);

  // Fireball material
  const fireballMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: 0xffaa00,
    emissive: 0xff6600,
    emissiveIntensity: 3,
    transparent: true,
    opacity: 1,
    toneMapped: false,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }), []);

  // Debris material
  const debrisMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: 0x666666,
    emissive: 0xff3300,
    emissiveIntensity: 1.5,
    transparent: true,
    opacity: 1,
    toneMapped: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  }), []);

  // Continuous explosion cycle: reset every EXPLOSION_TOTAL_DURATION
  useFrame((_, delta) => {
    if (state !== 'active') return;
    timeRef.current += delta;

    // Cycle repeats continuously during active war
    const cycleTime = timeRef.current % (EXPLOSION_TOTAL_DURATION + 0.5); // 0.5s gap between cycles
    const t = cycleTime;

    // ─── Stage 1: Flash (0 ~ 0.2s) ───
    if (flashRef.current) {
      if (t < EXPLOSION_FLASH_DURATION) {
        flashRef.current.visible = true;
        // Scale: 0→5→0 (peak at 0.1s)
        const flashProgress = t / EXPLOSION_FLASH_DURATION;
        const flashScale = flashProgress < 0.5
          ? flashProgress * 2 * 5   // 0→5
          : (1 - (flashProgress - 0.5) * 2) * 5; // 5→0
        flashRef.current.scale.setScalar(Math.max(0.01, flashScale));
        flashRef.current.position.copy(center);
        // White→Yellow color transition
        const yellowT = flashProgress;
        _tempColor.setRGB(1, 1, 1 - yellowT * 0.7); // white→yellow
        flashMat.color.copy(_tempColor);
        flashMat.emissive.copy(_tempColor);
        flashMat.emissiveIntensity = 8 * (1 - flashProgress * 0.5);
        flashMat.opacity = 1 - flashProgress * 0.3;
      } else {
        flashRef.current.visible = false;
      }
    }

    // ─── Stage 2: Fireball (0.1 ~ 0.8s) ───
    if (fireballRef.current) {
      const fbStart = EXPLOSION_FIREBALL_START;
      const fbEnd = EXPLOSION_FIREBALL_END;
      const fbDuration = fbEnd - fbStart;

      if (t >= fbStart && t <= fbEnd) {
        fireballRef.current.visible = true;
        const fbProgress = (t - fbStart) / fbDuration; // 0→1

        for (let i = 0; i < EXPLOSION_FIREBALL_COUNT; i++) {
          const dir = fireballData.directions[i];
          const speed = fireballData.speeds[i];

          // Position: expand from center
          const dist = speed * fbProgress * 2;
          _tempObj3D.position.copy(center);
          _tempObj3D.position.addScaledVector(dir, dist);

          // Scale: 0.3→0.5→0.1 (expand then shrink)
          let s: number;
          if (fbProgress < 0.4) {
            s = 0.3 + (fbProgress / 0.4) * 0.2; // 0.3→0.5
          } else {
            s = 0.5 - ((fbProgress - 0.4) / 0.6) * 0.4; // 0.5→0.1
          }
          _tempObj3D.scale.setScalar(Math.max(0.05, s));
          _tempObj3D.updateMatrix();
          fireballRef.current.setMatrixAt(i, _tempObj3D.matrix);

          // Color transition: yellow(0.1s) → orange(0.4s) → dark red(0.8s)
          if (fbProgress < 0.3) {
            // Yellow→Orange
            const ct = fbProgress / 0.3;
            _tempColor.setRGB(1, 1 - ct * 0.35, 0.1 - ct * 0.1);
          } else {
            // Orange→Dark Red
            const ct = (fbProgress - 0.3) / 0.7;
            _tempColor.setRGB(1 - ct * 0.4, 0.65 - ct * 0.55, ct * 0.05);
          }
          fireballRef.current.setColorAt(i, _tempColor);
        }

        fireballRef.current.instanceMatrix.needsUpdate = true;
        if (fireballRef.current.instanceColor) {
          fireballRef.current.instanceColor.needsUpdate = true;
        }

        // Fade opacity near end
        fireballMat.opacity = fbProgress > 0.7 ? 1 - (fbProgress - 0.7) / 0.3 : 1;
      } else {
        fireballRef.current.visible = false;
      }
    }

    // ─── Stage 3: Debris (0.3 ~ 1.5s) ───
    if (debrisRef.current) {
      const dbStart = EXPLOSION_DEBRIS_START;
      const dbEnd = EXPLOSION_DEBRIS_END;
      const dbDuration = dbEnd - dbStart;

      if (t >= dbStart && t <= dbEnd) {
        debrisRef.current.visible = true;
        const dbProgress = (t - dbStart) / dbDuration; // 0→1

        // Direction toward globe center for spherical gravity
        _tempVec3.copy(center).normalize().negate(); // toward globe center

        for (let i = 0; i < EXPLOSION_DEBRIS_COUNT; i++) {
          const dir = debrisData.directions[i];
          const speed = debrisData.speeds[i];
          const rotAxis = debrisData.rotAxes[i];
          const rotSpeed = debrisData.rotSpeeds[i];

          // Position: eject outward + slight gravity pull toward globe surface
          const dist = speed * dbProgress * 1.5;
          const gravityPull = dbProgress * dbProgress * 0.8; // increasing gravity over time
          _tempObj3D.position.copy(center);
          _tempObj3D.position.addScaledVector(dir, dist);
          _tempObj3D.position.addScaledVector(_tempVec3, gravityPull);

          // Tumbling rotation
          _tempObj3D.quaternion.setFromAxisAngle(rotAxis, t * rotSpeed);

          // Scale: shrink over time
          const dbScale = Math.max(0.05, 1.0 - dbProgress * 0.7);
          _tempObj3D.scale.setScalar(dbScale);

          _tempObj3D.updateMatrix();
          debrisRef.current.setMatrixAt(i, _tempObj3D.matrix);
        }

        debrisRef.current.instanceMatrix.needsUpdate = true;

        // Fade opacity
        debrisMat.opacity = dbProgress > 0.5 ? 1 - (dbProgress - 0.5) / 0.5 : 1;
        debrisMat.emissiveIntensity = Math.max(0, 1.5 * (1 - dbProgress));
      } else {
        debrisRef.current.visible = false;
      }
    }
  });

  // Cleanup
  useEffect(() => {
    return () => {
      flashGeo.dispose();
      fireballGeo.dispose();
      debrisGeo.dispose();
      flashMat.dispose();
      fireballMat.dispose();
      debrisMat.dispose();
    };
  }, [flashGeo, fireballGeo, debrisGeo, flashMat, fireballMat, debrisMat]);

  // Initialize instanceColor for fireball (need to set initial colors)
  useEffect(() => {
    if (fireballRef.current) {
      for (let i = 0; i < EXPLOSION_FIREBALL_COUNT; i++) {
        fireballRef.current.setColorAt(i, new THREE.Color(0xffcc00));
      }
      if (fireballRef.current.instanceColor) {
        fireballRef.current.instanceColor.needsUpdate = true;
      }
    }
  }, []);

  if (state !== 'active') return null;

  return (
    <group ref={groupRef}>
      {/* Stage 1: Flash sphere */}
      <mesh
        ref={flashRef}
        geometry={flashGeo}
        material={flashMat}
        position={center}
        visible={false}
      />

      {/* Stage 2: Fireball InstancedMesh */}
      <instancedMesh
        ref={fireballRef}
        args={[fireballGeo, fireballMat, EXPLOSION_FIREBALL_COUNT]}
        frustumCulled={false}
        visible={false}
      />

      {/* Stage 3: Debris InstancedMesh */}
      <instancedMesh
        ref={debrisRef}
        args={[debrisGeo, debrisMat, EXPLOSION_DEBRIS_COUNT]}
        frustumCulled={false}
        visible={false}
      />
    </group>
  );
}

/**
 * VictoryFireworks3D — v23 Phase 6: 3D Rocket Fireworks replacing legacy Points-based system.
 *
 * Rocket ascent stage (0~0.3s):
 * - InstancedMesh + ConeGeometry(0.15, 0.6, 6) rockets (ROCKET_COUNT simultaneous)
 * - Rise from globe surface along normal direction (3~5 units)
 * - Short smoke trail: 3 small spheres behind each rocket
 *
 * Explosion stage (0.3~2.0s):
 * - Flash at apex (0.3~0.5s): bright white sphere
 * - Each rocket spawns spherical burst of 40 InstancedMesh SphereGeometry(0.1) particles
 * - Particles spread outward while shrinking + color transition (gold→red→orange)
 * - AdditiveBlending + toneMapped=false (Bloom integration)
 *
 * Total cycle: ~2.5 seconds (repeating while active)
 */
function VictoryFireworks3D({
  position,
  globeRadius,
  active,
}: {
  position: THREE.Vector3;
  globeRadius: number;
  active: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  // ★ ref callback으로 count=0 즉시 설정 (useEffect는 첫 렌더 후라 1프레임 지연)
  const rocketMeshRef = useRef<THREE.InstancedMesh>(null);
  const smokeMeshRef = useRef<THREE.InstancedMesh>(null);
  const explosionMeshRef = useRef<THREE.InstancedMesh>(null);
  const flashRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);
  const rocketRefCb = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (mesh) { mesh.count = 0; rocketMeshRef.current = mesh; }
  }, []);
  const smokeRefCb = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (mesh) { mesh.count = 0; smokeMeshRef.current = mesh; }
  }, []);
  const explosionRefCb = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (mesh) { mesh.count = 0; explosionMeshRef.current = mesh; }
  }, []);

  // Surface normal at position (for ascent direction)
  const surfaceNormal = useMemo(() => position.clone().normalize(), [position]);

  // Pre-compute per-rocket data: offset angles, heights, delays
  const rocketData = useMemo(() => {
    const offsets: THREE.Vector3[] = [];
    const heights: number[] = [];
    const delays: number[] = [];
    for (let i = 0; i < ROCKET_COUNT; i++) {
      // Slight random offset from center (spread around position)
      const angle = (i / ROCKET_COUNT) * Math.PI * 2 + Math.random() * 0.5;
      const spread = 0.3 + Math.random() * 0.4;
      offsets.push(new THREE.Vector3(
        Math.cos(angle) * spread,
        0,
        Math.sin(angle) * spread,
      ));
      heights.push(ROCKET_ASCEND_HEIGHT * (0.8 + Math.random() * 0.4)); // 3.2~5.6
      delays.push(i * 0.06); // staggered launch
    }
    return { offsets, heights, delays };
  }, []);

  // Pre-compute per-explosion particle data (directions + speeds)
  const explosionData = useMemo(() => {
    const allDirs: THREE.Vector3[][] = [];
    const allSpeeds: number[][] = [];
    for (let r = 0; r < ROCKET_COUNT; r++) {
      const dirs: THREE.Vector3[] = [];
      const spds: number[] = [];
      for (let p = 0; p < EXPLOSION_PARTICLES_PER_ROCKET; p++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        dirs.push(new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta),
          Math.sin(phi) * Math.sin(theta),
          Math.cos(phi),
        ));
        spds.push(1.5 + Math.random() * 3.0);
      }
      allDirs.push(dirs);
      allSpeeds.push(spds);
    }
    return { allDirs, allSpeeds };
  }, []);

  // Shared geometries
  const rocketGeo = useMemo(() => new THREE.ConeGeometry(0.15, 0.6, 6), []);
  const smokeGeo = useMemo(() => new THREE.SphereGeometry(0.08, 4, 4), []);
  const explosionGeo = useMemo(() => new THREE.SphereGeometry(0.1, 6, 6), []);
  const flashGeo = useMemo(() => new THREE.SphereGeometry(0.4, 8, 8), []);

  // Materials
  const rocketMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: 0xffcc33,
    emissive: 0xff8800,
    emissiveIntensity: 3,
    transparent: true,
    opacity: 1,
    toneMapped: false,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }), []);

  const smokeMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: 0xcccccc,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  }), []);

  const explosionMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: 0xffd700,
    emissive: 0xffd700,
    emissiveIntensity: 4,
    transparent: true,
    opacity: 1,
    toneMapped: false,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }), []);

  const flashMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 10,
    transparent: true,
    opacity: 1,
    toneMapped: false,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }), []);

  const totalExplosionParticles = ROCKET_COUNT * EXPLOSION_PARTICLES_PER_ROCKET;
  const totalSmoke = ROCKET_COUNT * SMOKE_TRAIL_COUNT;

  // Initialize instanceColor for explosion
  useEffect(() => {
    if (explosionMeshRef.current) {
      for (let i = 0; i < totalExplosionParticles; i++) {
        explosionMeshRef.current.setColorAt(i, new THREE.Color(0xffd700));
      }
      if (explosionMeshRef.current.instanceColor) {
        explosionMeshRef.current.instanceColor.needsUpdate = true;
      }
    }
  }, [totalExplosionParticles]);

  useFrame((_, delta) => {
    if (!active) return;
    timeRef.current += delta;

    const rocketMesh = rocketMeshRef.current;
    const smokeMesh = smokeMeshRef.current;
    const explosionMesh = explosionMeshRef.current;
    const flash = flashRef.current;
    if (!rocketMesh || !smokeMesh || !explosionMesh || !flash) return;

    const cycleTime = timeRef.current % ROCKET_CYCLE_DURATION;

    // ─── Process each rocket ───
    for (let r = 0; r < ROCKET_COUNT; r++) {
      const delay = rocketData.delays[r];
      const localT = cycleTime - delay;
      const maxH = rocketData.heights[r];
      const offset = rocketData.offsets[r];

      // ─── Rocket ascent (0 ~ 0.3s) ───
      if (localT >= 0 && localT < ROCKET_ASCEND_DURATION) {
        const ascentProgress = localT / ROCKET_ASCEND_DURATION;
        const height = ascentProgress * maxH;

        // Rocket position: surface position + offset + normal * height
        _fwVec.copy(position).addScaledVector(surfaceNormal, height);
        _fwVec.add(offset);

        _fwObj.position.copy(_fwVec);
        // Orient cone tip upward (along normal) — use module-scope constant
        _fwObj.quaternion.setFromUnitVectors(_fwUp, surfaceNormal);
        _fwObj.scale.setScalar(1.0);
        _fwObj.updateMatrix();
        rocketMesh.setMatrixAt(r, _fwObj.matrix);

        // Smoke trail behind rocket
        for (let s = 0; s < SMOKE_TRAIL_COUNT; s++) {
          const sIdx = r * SMOKE_TRAIL_COUNT + s;
          const smokeHeight = height - (s + 1) * 0.5;
          if (smokeHeight < 0) {
            _fwObj.position.set(0, 0, -9999);
            _fwObj.scale.setScalar(0);
            _fwObj.updateMatrix();
            smokeMesh.setMatrixAt(sIdx, _fwObj.matrix);
          } else {
            _fwVec.copy(position).addScaledVector(surfaceNormal, smokeHeight);
            _fwVec.add(offset);
            _fwObj.position.copy(_fwVec);
            const smokeScale = 0.8 + s * 0.3; // bigger smoke farther back
            _fwObj.scale.setScalar(smokeScale);
            _fwObj.updateMatrix();
            smokeMesh.setMatrixAt(sIdx, _fwObj.matrix);
          }
        }
      } else {
        // Hide rocket
        _fwObj.position.set(0, 0, -9999);
        _fwObj.scale.setScalar(0);
        _fwObj.updateMatrix();
        rocketMesh.setMatrixAt(r, _fwObj.matrix);

        // Hide smoke
        for (let s = 0; s < SMOKE_TRAIL_COUNT; s++) {
          const sIdx = r * SMOKE_TRAIL_COUNT + s;
          smokeMesh.setMatrixAt(sIdx, _fwObj.matrix);
        }
      }

      // ─── Explosion particles (0.5 ~ 2.0s) ───
      const explodeLocalT = localT - ROCKET_EXPLODE_START;
      const explodeDuration = ROCKET_EXPLODE_END - ROCKET_EXPLODE_START;

      if (explodeLocalT >= 0 && explodeLocalT < explodeDuration) {
        const explodeProgress = explodeLocalT / explodeDuration; // 0→1

        // Apex position (where rocket peaked)
        _fwNormal.copy(position).addScaledVector(surfaceNormal, maxH);
        _fwNormal.add(offset);

        const dirs = explosionData.allDirs[r];
        const spds = explosionData.allSpeeds[r];

        for (let p = 0; p < EXPLOSION_PARTICLES_PER_ROCKET; p++) {
          const pIdx = r * EXPLOSION_PARTICLES_PER_ROCKET + p;
          const dir = dirs[p];
          const spd = spds[p];

          // Position: spread from apex
          const dist = spd * explodeProgress * 3.0;
          _fwVec.copy(_fwNormal);
          _fwVec.addScaledVector(dir, dist);

          // Scale: shrink over time
          const scale = Math.max(0.05, 1.0 - explodeProgress * 0.8);

          _fwObj.position.copy(_fwVec);
          _fwObj.scale.setScalar(scale);
          _fwObj.updateMatrix();
          explosionMesh.setMatrixAt(pIdx, _fwObj.matrix);

          // Color transition: gold(0) → red(0.5) → orange(1.0)
          if (explodeProgress < 0.5) {
            const ct = explodeProgress / 0.5;
            _fwColor.setRGB(1.0, 0.84 - ct * 0.54, 0.0); // gold→red
          } else {
            const ct = (explodeProgress - 0.5) / 0.5;
            _fwColor.setRGB(1.0, 0.3 + ct * 0.35, ct * 0.2); // red→orange
          }
          explosionMesh.setColorAt(pIdx, _fwColor);
        }
      } else {
        // Hide explosion particles for this rocket
        for (let p = 0; p < EXPLOSION_PARTICLES_PER_ROCKET; p++) {
          const pIdx = r * EXPLOSION_PARTICLES_PER_ROCKET + p;
          _fwObj.position.set(0, 0, -9999);
          _fwObj.scale.setScalar(0);
          _fwObj.updateMatrix();
          explosionMesh.setMatrixAt(pIdx, _fwObj.matrix);
        }
      }
    }

    // ─── Flash at apex (0.3 ~ 0.5s, first rocket) ───
    const flashLocalT = cycleTime - ROCKET_FLASH_START;
    const flashDuration = ROCKET_FLASH_END - ROCKET_FLASH_START;
    if (flashLocalT >= 0 && flashLocalT < flashDuration) {
      flash.visible = true;
      const flashProgress = flashLocalT / flashDuration;
      // Scale: 0→3→0
      const flashScale = flashProgress < 0.5
        ? (flashProgress / 0.5) * 3.0
        : (1 - (flashProgress - 0.5) / 0.5) * 3.0;
      flash.scale.setScalar(Math.max(0.01, flashScale));
      _fwVec.copy(position).addScaledVector(surfaceNormal, rocketData.heights[0]);
      flash.position.copy(_fwVec);
      flashMat.opacity = 1 - flashProgress * 0.5;
      flashMat.emissiveIntensity = 10 * (1 - flashProgress * 0.6);
    } else {
      flash.visible = false;
    }

    // ─── Update instance matrices ───
    // ★ count 복원 (useEffect에서 count=0으로 시작)
    rocketMesh.count = ROCKET_COUNT;
    smokeMesh.count = totalSmoke;
    explosionMesh.count = totalExplosionParticles;
    rocketMesh.instanceMatrix.needsUpdate = true;
    smokeMesh.instanceMatrix.needsUpdate = true;
    explosionMesh.instanceMatrix.needsUpdate = true;
    if (explosionMesh.instanceColor) {
      explosionMesh.instanceColor.needsUpdate = true;
    }

    // Overall fade when cycle nears end (last 0.3s)
    const fadeT = ROCKET_CYCLE_DURATION - cycleTime;
    if (fadeT < 0.3) {
      const fade = fadeT / 0.3;
      explosionMat.opacity = fade;
      rocketMat.opacity = fade;
    } else {
      explosionMat.opacity = 1;
      rocketMat.opacity = 1;
    }
  });

  // Cleanup
  useEffect(() => {
    return () => {
      rocketGeo.dispose();
      smokeGeo.dispose();
      explosionGeo.dispose();
      flashGeo.dispose();
      rocketMat.dispose();
      smokeMat.dispose();
      explosionMat.dispose();
      flashMat.dispose();
    };
  }, [rocketGeo, smokeGeo, explosionGeo, flashGeo, rocketMat, smokeMat, explosionMat, flashMat]);

  if (!active) return null;

  return (
    <group ref={groupRef}>
      {/* Rocket cones */}
      <instancedMesh
        ref={rocketRefCb}
        args={[rocketGeo, rocketMat, ROCKET_COUNT]}
        frustumCulled={false}
      />
      {/* Smoke trail spheres */}
      <instancedMesh
        ref={smokeRefCb}
        args={[smokeGeo, smokeMat, totalSmoke]}
        frustumCulled={false}
      />
      {/* Explosion particles */}
      <instancedMesh
        ref={explosionRefCb}
        args={[explosionGeo, explosionMat, totalExplosionParticles]}
        frustumCulled={false}
      />
      {/* Flash sphere at apex */}
      <mesh
        ref={flashRef}
        geometry={flashGeo}
        material={flashMat}
        position={position}
        visible={false}
      />
    </group>
  );
}

/**
 * WarFog (v23 WarFog3D) — Volumetric shader spheres replacing v15 billboard planes.
 * InstancedMesh + SphereGeometry(2,12,12) with custom ShaderMaterial:
 * - vertex: noise-based vertex displacement for organic deformation
 * - fragment: semi-transparent red (0.6, 0.1, 0.05), noise-based density variation
 * - time uniform for slow rotation/morphing animation
 * - AdditiveBlending, opacity 0.3~0.5
 */

// v23: volumetric fog vertex shader — noise-based displacement
const warFogVertexShader = /* glsl */ `
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vWorldPos;

  // Simple 3D noise (hash-based)
  vec3 hash33(vec3 p) {
    p = vec3(
      dot(p, vec3(127.1, 311.7, 74.7)),
      dot(p, vec3(269.5, 183.3, 246.1)),
      dot(p, vec3(113.5, 271.9, 124.6))
    );
    return fract(sin(p) * 43758.5453123) * 2.0 - 1.0;
  }

  float noise3D(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n = mix(
      mix(
        mix(dot(hash33(i), f), dot(hash33(i + vec3(1,0,0)), f - vec3(1,0,0)), f.x),
        mix(dot(hash33(i + vec3(0,1,0)), f - vec3(0,1,0)), dot(hash33(i + vec3(1,1,0)), f - vec3(1,1,0)), f.x),
        f.y
      ),
      mix(
        mix(dot(hash33(i + vec3(0,0,1)), f - vec3(0,0,1)), dot(hash33(i + vec3(1,0,1)), f - vec3(1,0,1)), f.x),
        mix(dot(hash33(i + vec3(0,1,1)), f - vec3(0,1,1)), dot(hash33(i + vec3(1,1,1)), f - vec3(1,1,1)), f.x),
        f.y
      ),
      f.z
    );
    return n * 0.5 + 0.5;
  }

  void main() {
    vNormal = normalize(normalMatrix * normal);

    // Noise-based vertex displacement for organic deformation
    vec3 displaced = position;
    float noiseVal = noise3D(position * 1.5 + uTime * 0.3);
    displaced += normal * noiseVal * 0.4;

    vec4 worldPos = modelMatrix * vec4(displaced, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

// v23: volumetric fog fragment shader — noise density variation
const warFogFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  varying vec3 vNormal;
  varying vec3 vWorldPos;

  vec3 hash33(vec3 p) {
    p = vec3(
      dot(p, vec3(127.1, 311.7, 74.7)),
      dot(p, vec3(269.5, 183.3, 246.1)),
      dot(p, vec3(113.5, 271.9, 124.6))
    );
    return fract(sin(p) * 43758.5453123) * 2.0 - 1.0;
  }

  float noise3D(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n = mix(
      mix(
        mix(dot(hash33(i), f), dot(hash33(i + vec3(1,0,0)), f - vec3(1,0,0)), f.x),
        mix(dot(hash33(i + vec3(0,1,0)), f - vec3(0,1,0)), dot(hash33(i + vec3(1,1,0)), f - vec3(1,1,0)), f.x),
        f.y
      ),
      mix(
        mix(dot(hash33(i + vec3(0,0,1)), f - vec3(0,0,1)), dot(hash33(i + vec3(1,0,1)), f - vec3(1,0,1)), f.x),
        mix(dot(hash33(i + vec3(0,1,1)), f - vec3(0,1,1)), dot(hash33(i + vec3(1,1,1)), f - vec3(1,1,1)), f.x),
        f.y
      ),
      f.z
    );
    return n * 0.5 + 0.5;
  }

  void main() {
    // Base color: semi-transparent deep red
    vec3 baseColor = vec3(0.6, 0.1, 0.05);

    // Noise-based density variation (organic fog appearance)
    float density = noise3D(vWorldPos * 0.5 + uTime * 0.2);
    density = smoothstep(0.25, 0.75, density);

    // Edge fade based on view angle (Fresnel-like)
    float edgeFade = 1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0)));
    edgeFade = smoothstep(0.0, 0.6, edgeFade);

    // Combine: density modulates opacity, edge fade softens edges
    float alpha = uOpacity * density * (0.6 + edgeFade * 0.4);
    alpha = clamp(alpha, 0.0, uOpacity);

    // Subtle color variation
    vec3 finalColor = baseColor + vec3(0.1, 0.0, 0.0) * noise3D(vWorldPos * 0.8 - uTime * 0.1);

    gl_FragColor = vec4(finalColor, alpha);
  }
`;

function WarFog({
  center,
  globeRadius,
  state,
}: {
  center: THREE.Vector3;
  globeRadius: number;
  state: 'preparation' | 'active' | 'ended';
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const meshRefCb = useCallback((mesh: THREE.InstancedMesh | null) => {
    if (mesh) { mesh.count = 0; meshRef.current = mesh; }
  }, []);
  const timeRef = useRef(0);

  // Sphere offsets (random positions around center, computed once)
  const offsets = useMemo(() => {
    const arr: THREE.Vector3[] = [];
    const spread = globeRadius * WAR_FOG_SPREAD;
    for (let i = 0; i < WAR_FOG_SPHERE_COUNT; i++) {
      arr.push(new THREE.Vector3(
        (Math.random() - 0.5) * spread * 2,
        (Math.random() - 0.5) * spread * 2,
        (Math.random() - 0.5) * spread * 2,
      ));
    }
    return arr;
  }, [globeRadius]);

  // Per-sphere random scale factors (for variety)
  const scaleFactors = useMemo(() => {
    const arr: number[] = [];
    for (let i = 0; i < WAR_FOG_SPHERE_COUNT; i++) {
      arr.push(0.7 + Math.random() * 0.6); // 0.7 ~ 1.3
    }
    return arr;
  }, []);

  // v23: SphereGeometry for volumetric fog
  const fogGeometry = useMemo(() => new THREE.SphereGeometry(2, 12, 12), []);

  // v23: Custom ShaderMaterial for volumetric appearance
  const fogMaterial = useMemo(
    () => new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0.4 },
      },
      vertexShader: warFogVertexShader,
      fragmentShader: warFogFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    }),
    [],
  );

  useFrame((_, delta) => {
    if (!meshRef.current || state !== 'active') return;
    timeRef.current += delta;
    const t = timeRef.current;

    // Update time uniform
    fogMaterial.uniforms.uTime.value = t;

    for (let i = 0; i < WAR_FOG_SPHERE_COUNT; i++) {
      const offset = offsets[i];
      // Slow orbital rotation around center
      const angle = t * 0.12 + (i / WAR_FOG_SPHERE_COUNT) * Math.PI * 2;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      _tempObj3D.position.set(
        center.x + offset.x * cosA - offset.z * sinA,
        center.y + offset.y + Math.sin(t * 0.4 + i * 1.2) * 0.5,
        center.z + offset.x * sinA + offset.z * cosA,
      );

      // Slow rotation for organic morphing
      _tempObj3D.rotation.set(
        t * 0.1 + i * 0.5,
        t * 0.15 + i * 0.3,
        t * 0.08 + i * 0.7,
      );

      // Pulse scale for breathing effect
      const baseScale = scaleFactors[i];
      const pulseScale = baseScale * (1.0 + 0.2 * Math.sin(t * 0.6 + i * 1.8));
      _tempObj3D.scale.setScalar(pulseScale);

      _tempObj3D.updateMatrix();
      meshRef.current.setMatrixAt(i, _tempObj3D.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  useEffect(() => {
    return () => {
      fogGeometry.dispose();
      fogMaterial.dispose();
    };
  }, [fogGeometry, fogMaterial]);

  if (state !== 'active') return null;

  return (
    <instancedMesh
      ref={meshRefCb}
      args={[fogGeometry, fogMaterial, WAR_FOG_SPHERE_COUNT]}
      frustumCulled={false}
    />
  );
}

// v24: CameraShake 컴포넌트 제거됨 — CameraController로 통합

// ─── Main Component ───

/**
 * GlobeWarEffects renders war visual effects on the 3D globe.
 *
 * Usage:
 * ```tsx
 * <GlobeWarEffects
 *   wars={activeWars}
 *   countryCentroids={centroidMap}
 *   globeRadius={100}
 *   onCameraTarget={handleCameraTarget}
 * />
 * ```
 */
export function GlobeWarEffects({
  wars,
  countryCentroids,
  globeRadius = DEFAULT_GLOBE_RADIUS,
  autoRotateCamera = true,
  onCameraTarget,
  visible = true,
  enableWarFog = true,
}: GlobeWarEffectsProps) {
  const prevWarIdsRef = useRef<Set<string>>(new Set());

  // Get 3D positions for countries
  const getCountryPosition = useCallback(
    (iso3: string): THREE.Vector3 | null => {
      const centroid = countryCentroids.get(iso3);
      if (!centroid) return null;
      return latLngToVector3(centroid[0], centroid[1], globeRadius * 1.01);
    },
    [countryCentroids, globeRadius],
  );

  // Get midpoint between two countries (for border effects)
  const getBorderCenter = useCallback(
    (a: string, b: string): THREE.Vector3 | null => {
      const posA = getCountryPosition(a);
      const posB = getCountryPosition(b);
      if (!posA || !posB) return null;
      return new THREE.Vector3().addVectors(posA, posB).multiplyScalar(0.5).normalize().multiplyScalar(globeRadius * 1.01);
    },
    [getCountryPosition, globeRadius],
  );

  // v24: Camera auto-rotation to new war zones (shake는 CameraController가 처리)
  useEffect(() => {
    const currentWarIds = new Set(wars.map((w) => w.warId));
    const prevWarIds = prevWarIdsRef.current;

    // Find newly declared wars
    for (const war of wars) {
      if (!prevWarIds.has(war.warId) && (war.state === 'preparation' || war.state === 'active')) {
        if (autoRotateCamera && onCameraTarget) {
          const midpoint = getBorderCenter(war.attacker, war.defender);
          if (midpoint) {
            onCameraTarget(midpoint, CAMERA_PRIORITY.war);
          }
        }
        break; // only handle first new war
      }
    }

    prevWarIdsRef.current = currentWarIds;
  }, [wars, autoRotateCamera, onCameraTarget, getBorderCenter]);

  // Build effect data for rendering
  const warEffects = useMemo(() => {
    return wars.map((war) => {
      const attackerPos = getCountryPosition(war.attacker);
      const defenderPos = getCountryPosition(war.defender);
      const borderCenter = getBorderCenter(war.attacker, war.defender);

      return {
        war,
        attackerPos,
        defenderPos,
        borderCenter,
      };
    });
  }, [wars, getCountryPosition, getBorderCenter]);

  if (!visible) return null;

  return (
    <group>
      {warEffects.map(({ war, attackerPos, defenderPos, borderCenter }) => {
        if (!attackerPos || !defenderPos) return null;

        return (
          <group key={war.warId}>
            {/* 1. Red dashed arc line between nations */}
            <WarArcLine
              start={attackerPos}
              end={defenderPos}
              globeRadius={globeRadius}
              state={war.state}
              attackerScore={war.attackerScore}
              defenderScore={war.defenderScore}
            />

            {/* 2. Territory edge blinking (attacker) */}
            <TerritoryBlink
              position={attackerPos}
              globeRadius={globeRadius}
              state={war.state}
            />

            {/* 2. Territory edge blinking (defender) */}
            <TerritoryBlink
              position={defenderPos}
              globeRadius={globeRadius}
              state={war.state}
            />

            {/* 3. v23: 3D explosion particles at defender position (not border midpoint — midpoint between distant countries falls in ocean) */}
            {defenderPos && (
              <Explosion3D
                center={defenderPos}
                globeRadius={globeRadius}
                state={war.state}
              />
            )}

            {/* v15: 7. War fog at defender position (모바일 LOD: enableWarFog로 비활성화) */}
            {enableWarFog && defenderPos && (
              <WarFog
                center={defenderPos}
                globeRadius={globeRadius}
                state={war.state}
              />
            )}

            {/* 5. v23 Phase 6: Victory fireworks 3D (rocket ascent → spherical explosion) */}
            {war.state === 'ended' && war.winner && (
              <VictoryFireworks3D
                position={
                  war.winner === war.attacker ? attackerPos : defenderPos
                }
                globeRadius={globeRadius}
                active={true}
              />
            )}
          </group>
        );
      })}
    </group>
  );
}

export default GlobeWarEffects;
