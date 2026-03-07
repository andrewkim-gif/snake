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

import { useRef, useMemo, useEffect, useCallback, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

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

  /** Callback when camera should look at a position */
  onCameraTarget?: (position: THREE.Vector3) => void;

  /** Visibility toggle */
  visible?: boolean;
}

// ─── Constants ───

const DEFAULT_GLOBE_RADIUS = 100;

// Arc line
const ARC_COLOR_WAR = new THREE.Color(0xff3333);
const ARC_COLOR_PREP = new THREE.Color(0xff6633);
const ARC_HEIGHT_FACTOR = 0.25; // arc height as fraction of distance
const ARC_SEGMENTS = 64;
const ARC_DASH_SIZE = 0.03;
const ARC_GAP_SIZE = 0.02;

// Territory blinking
const BLINK_FREQUENCY = 0.5; // Hz
const BLINK_COLOR = new THREE.Color(0xff3333);

// Particles
const EXPLOSION_PARTICLE_COUNT = 30;
const ARROW_PARTICLE_COUNT = 12;
const FIREWORK_PARTICLE_COUNT = 300; // v15: upgraded from 50 → 300

// War end
const WINNER_FIREWORK_COLOR = new THREE.Color(0xffd700); // gold
const LOSER_TRANSITION_DURATION = 5.0; // seconds

// v15: War fog constants
const WAR_FOG_PARTICLE_COUNT = 20;
const WAR_FOG_COLOR = new THREE.Color(0xcc2222);
const WAR_FOG_SPREAD = 0.08; // spread relative to globe radius

// v15: Camera shake constants
const CAMERA_SHAKE_DURATION = 0.5;  // seconds
const CAMERA_SHAKE_INTENSITY = 0.3; // position offset magnitude
const CAMERA_SHAKE_FREQUENCY = 40;  // sin wave frequency

// ─── Helpers ───

/**
 * Convert lat/lng to 3D position on a sphere.
 */
function latLngToVector3(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  return new THREE.Vector3(x, y, z);
}

/**
 * Create a curved arc between two points on a sphere.
 * Returns an array of Vector3 points.
 */
function createArcPoints(
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
  segments: number,
  heightFactor: number,
): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const distance = start.distanceTo(end);
  const arcHeight = distance * heightFactor;
  const midPoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  const normal = midPoint.clone().normalize();
  const controlPoint = midPoint.clone().add(normal.multiplyScalar(arcHeight));

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    // Quadratic bezier
    const p = new THREE.Vector3();
    const oneMinusT = 1 - t;
    p.x = oneMinusT * oneMinusT * start.x + 2 * oneMinusT * t * controlPoint.x + t * t * end.x;
    p.y = oneMinusT * oneMinusT * start.y + 2 * oneMinusT * t * controlPoint.y + t * t * end.y;
    p.z = oneMinusT * oneMinusT * start.z + 2 * oneMinusT * t * controlPoint.z + t * t * end.z;
    points.push(p);
  }

  return points;
}

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
    () => createArcPoints(start, end, globeRadius, ARC_SEGMENTS, ARC_HEIGHT_FACTOR),
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
 * ExplosionParticles — Random explosion particles near border areas.
 */
function ExplosionParticles({
  center,
  globeRadius,
  state,
}: {
  center: THREE.Vector3;
  globeRadius: number;
  state: 'preparation' | 'active' | 'ended';
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const timeRef = useRef(0);
  const velocitiesRef = useRef<Float32Array>(new Float32Array(EXPLOSION_PARTICLE_COUNT * 3));

  const geometry = useMemo(() => {
    const positions = new Float32Array(EXPLOSION_PARTICLE_COUNT * 3);
    const sizes = new Float32Array(EXPLOSION_PARTICLE_COUNT);
    const lifetimes = new Float32Array(EXPLOSION_PARTICLE_COUNT);

    for (let i = 0; i < EXPLOSION_PARTICLE_COUNT; i++) {
      // Random position around center
      const offset = new THREE.Vector3(
        (Math.random() - 0.5) * globeRadius * 0.1,
        (Math.random() - 0.5) * globeRadius * 0.1,
        (Math.random() - 0.5) * globeRadius * 0.1,
      );
      const pos = center.clone().add(offset);
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = pos.y;
      positions[i * 3 + 2] = pos.z;

      sizes[i] = 0.5 + Math.random() * 1.5;
      lifetimes[i] = Math.random(); // random phase offset

      // Random velocity
      velocitiesRef.current[i * 3] = (Math.random() - 0.5) * 2;
      velocitiesRef.current[i * 3 + 1] = (Math.random() - 0.5) * 2;
      velocitiesRef.current[i * 3 + 2] = (Math.random() - 0.5) * 2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1));
    return geo;
  }, [center, globeRadius]);

  const material = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: 0xff4400,
        size: globeRadius * 0.01,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [globeRadius],
  );

  useFrame((_, delta) => {
    if (!pointsRef.current || state !== 'active') return;
    timeRef.current += delta;

    const positions = geometry.attributes.position as THREE.BufferAttribute;
    const lifetimes = geometry.attributes.lifetime as THREE.BufferAttribute;

    for (let i = 0; i < EXPLOSION_PARTICLE_COUNT; i++) {
      let lt = lifetimes.getX(i) + delta * 0.5;
      if (lt > 1) {
        // Reset particle
        lt = 0;
        const offset = new THREE.Vector3(
          (Math.random() - 0.5) * globeRadius * 0.1,
          (Math.random() - 0.5) * globeRadius * 0.1,
          (Math.random() - 0.5) * globeRadius * 0.1,
        );
        const pos = center.clone().add(offset);
        positions.setXYZ(i, pos.x, pos.y, pos.z);
      } else {
        // Move outward
        const x = positions.getX(i) + velocitiesRef.current[i * 3] * delta;
        const y = positions.getY(i) + velocitiesRef.current[i * 3 + 1] * delta;
        const z = positions.getZ(i) + velocitiesRef.current[i * 3 + 2] * delta;
        positions.setXYZ(i, x, y, z);
      }
      lifetimes.setX(i, lt);
    }
    positions.needsUpdate = true;
    lifetimes.needsUpdate = true;

    // Fade based on lifetime
    material.opacity = 0.4 + 0.3 * Math.sin(timeRef.current * 4);
  });

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  if (state !== 'active') return null;

  return <points ref={pointsRef} geometry={geometry} material={material} />;
}

/**
 * VictoryFireworks — v15 Enhanced: 300 particles, 3-stage burst (0s, 0.5s, 1.0s), gold + nation colors
 */
function VictoryFireworks({
  position,
  globeRadius,
  active,
}: {
  position: THREE.Vector3;
  globeRadius: number;
  active: boolean;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const timeRef = useRef(0);

  // 3-stage burst: particles divided into 3 batches with delayed activation
  const STAGE_SIZE = Math.floor(FIREWORK_PARTICLE_COUNT / 3);
  const STAGE_DELAYS = [0, 0.5, 1.0]; // seconds

  // Color palette: gold dominant + accent colors
  const colorPalette = useMemo(() => [
    new THREE.Color(0xffd700), // gold
    new THREE.Color(0xffaa00), // amber
    new THREE.Color(0xff6600), // orange
    new THREE.Color(0xffee55), // bright gold
    new THREE.Color(0xffffff), // white sparkle
  ], []);

  const geometry = useMemo(() => {
    const positions = new Float32Array(FIREWORK_PARTICLE_COUNT * 3);
    const velocities = new Float32Array(FIREWORK_PARTICLE_COUNT * 3);
    const colors = new Float32Array(FIREWORK_PARTICLE_COUNT * 3);
    const stages = new Float32Array(FIREWORK_PARTICLE_COUNT); // which burst stage (0, 1, 2)

    for (let i = 0; i < FIREWORK_PARTICLE_COUNT; i++) {
      positions[i * 3] = position.x;
      positions[i * 3 + 1] = position.y;
      positions[i * 3 + 2] = position.z;

      // Radial burst velocity with variation per stage
      const stageIdx = Math.floor(i / STAGE_SIZE);
      stages[i] = Math.min(stageIdx, 2);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const speed = (2 + Math.random() * 5) * (1 + stageIdx * 0.3); // later stages are faster
      velocities[i * 3] = Math.sin(phi) * Math.cos(theta) * speed;
      velocities[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * speed;
      velocities[i * 3 + 2] = Math.cos(phi) * speed;

      // Color from palette
      const col = colorPalette[Math.floor(Math.random() * colorPalette.length)];
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.userData.velocities = velocities;
    geo.userData.stages = stages;
    geo.userData.originPos = position.clone();
    return geo;
  }, [position, colorPalette]);

  const material = useMemo(
    () =>
      new THREE.PointsMaterial({
        size: globeRadius * 0.012,
        transparent: true,
        opacity: 1.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        vertexColors: true,
      }),
    [globeRadius],
  );

  useFrame((_, delta) => {
    if (!pointsRef.current || !active) return;
    timeRef.current += delta;

    const positions = geometry.attributes.position as THREE.BufferAttribute;
    const velocities = geometry.userData.velocities as Float32Array;
    const stages = geometry.userData.stages as Float32Array;
    const origin = geometry.userData.originPos as THREE.Vector3;

    // 4-second total animation (3 stages)
    if (timeRef.current > 4.0) {
      material.opacity = Math.max(0, material.opacity - delta * 0.5);
      return;
    }

    for (let i = 0; i < FIREWORK_PARTICLE_COUNT; i++) {
      const stage = stages[i];
      const stageDelay = STAGE_DELAYS[Math.min(Math.floor(stage), 2)];
      const localTime = timeRef.current - stageDelay;

      if (localTime < 0) {
        // Not yet launched — stay at origin
        positions.setXYZ(i, origin.x, origin.y, origin.z);
        continue;
      }

      const x = positions.getX(i) + velocities[i * 3] * delta;
      const y = positions.getY(i) + velocities[i * 3 + 1] * delta;
      const z = positions.getZ(i) + velocities[i * 3 + 2] * delta;
      positions.setXYZ(i, x, y, z);

      // Gravity + drag
      velocities[i * 3] *= 0.97;
      velocities[i * 3 + 1] *= 0.97;
      velocities[i * 3 + 2] *= 0.97;
    }
    positions.needsUpdate = true;

    // Fade out over time
    material.opacity = Math.max(0, 1.0 - timeRef.current / 4.0);
  });

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  if (!active) return null;

  return <points ref={pointsRef} geometry={geometry} material={material} />;
}

/**
 * WarFog — v15: Red fog particles at midpoint between warring nations.
 * InstancedMesh 20 particles, slowly rotating, noise-based semi-transparent.
 */
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
  const timeRef = useRef(0);
  const _dummy = useMemo(() => new THREE.Object3D(), []);

  // Particle offsets (random positions around center, computed once)
  const offsets = useMemo(() => {
    const arr: THREE.Vector3[] = [];
    const spread = globeRadius * WAR_FOG_SPREAD;
    for (let i = 0; i < WAR_FOG_PARTICLE_COUNT; i++) {
      arr.push(new THREE.Vector3(
        (Math.random() - 0.5) * spread * 2,
        (Math.random() - 0.5) * spread * 2,
        (Math.random() - 0.5) * spread * 2,
      ));
    }
    return arr;
  }, [globeRadius]);

  const fogGeometry = useMemo(() => new THREE.PlaneGeometry(3, 3), []);
  const fogMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({
      color: WAR_FOG_COLOR,
      transparent: true,
      opacity: 0.15,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    [],
  );

  useFrame((stateR3F, delta) => {
    if (!meshRef.current || state !== 'active') return;
    timeRef.current += delta;
    const t = timeRef.current;
    const cam = stateR3F.camera;

    for (let i = 0; i < WAR_FOG_PARTICLE_COUNT; i++) {
      const offset = offsets[i];
      // Slow orbital rotation around center
      const angle = t * 0.15 + (i / WAR_FOG_PARTICLE_COUNT) * Math.PI * 2;
      const rotatedOffset = new THREE.Vector3(
        offset.x * Math.cos(angle) - offset.z * Math.sin(angle),
        offset.y + Math.sin(t * 0.5 + i) * 0.5,
        offset.x * Math.sin(angle) + offset.z * Math.cos(angle),
      );

      _dummy.position.copy(center).add(rotatedOffset);
      // Billboard: face camera
      _dummy.quaternion.copy(cam.quaternion);
      // Pulse scale for organic feel
      const scale = 1.0 + 0.3 * Math.sin(t * 0.8 + i * 1.5);
      _dummy.scale.setScalar(scale);
      _dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, _dummy.matrix);
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
      ref={meshRef}
      args={[fogGeometry, fogMaterial, WAR_FOG_PARTICLE_COUNT]}
      frustumCulled={false}
    />
  );
}

/**
 * CameraShake — v15: Screen vibration on war declaration.
 * Applies sin(t*40)*0.3 offset to camera.position for 0.5 seconds.
 */
function CameraShake({ active }: { active: boolean }) {
  const { camera } = useThree();
  const shakeTimeRef = useRef(0);
  const shakeActiveRef = useRef(false);
  const origPosRef = useRef(new THREE.Vector3());

  useEffect(() => {
    if (active && !shakeActiveRef.current) {
      shakeActiveRef.current = true;
      shakeTimeRef.current = 0;
      origPosRef.current.copy(camera.position);
    }
  }, [active, camera]);

  useFrame((_, delta) => {
    if (!shakeActiveRef.current) return;
    shakeTimeRef.current += delta;

    if (shakeTimeRef.current >= CAMERA_SHAKE_DURATION) {
      // Restore original position
      camera.position.copy(origPosRef.current);
      shakeActiveRef.current = false;
      return;
    }

    // Decay envelope: intensity decreases over time
    const decay = 1.0 - (shakeTimeRef.current / CAMERA_SHAKE_DURATION);
    const t = shakeTimeRef.current;
    const offsetX = Math.sin(t * CAMERA_SHAKE_FREQUENCY) * CAMERA_SHAKE_INTENSITY * decay;
    const offsetY = Math.cos(t * CAMERA_SHAKE_FREQUENCY * 1.3) * CAMERA_SHAKE_INTENSITY * decay * 0.7;

    camera.position.copy(origPosRef.current);
    camera.position.x += offsetX;
    camera.position.y += offsetY;
  });

  return null;
}

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
}: GlobeWarEffectsProps) {
  const prevWarIdsRef = useRef<Set<string>>(new Set());
  // v15: Camera shake triggers when a new war is declared
  const [shakeActive, setShakeActive] = useState(false);

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

  // Camera auto-rotation to new war zones + v15 camera shake
  useEffect(() => {
    const currentWarIds = new Set(wars.map((w) => w.warId));
    const prevWarIds = prevWarIdsRef.current;
    let hasNewWar = false;

    // Find newly declared wars
    for (const war of wars) {
      if (!prevWarIds.has(war.warId) && (war.state === 'preparation' || war.state === 'active')) {
        hasNewWar = true;
        if (autoRotateCamera && onCameraTarget) {
          const midpoint = getBorderCenter(war.attacker, war.defender);
          if (midpoint) {
            onCameraTarget(midpoint);
          }
        }
        break; // only handle first new war
      }
    }

    // v15: Trigger camera shake on new war declaration
    if (hasNewWar) {
      setShakeActive(true);
      // Auto-reset after shake duration
      const timer = setTimeout(() => setShakeActive(false), CAMERA_SHAKE_DURATION * 1000 + 100);
      prevWarIdsRef.current = currentWarIds;
      return () => clearTimeout(timer);
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
      {/* v15: Camera shake on war declaration */}
      <CameraShake active={shakeActive} />

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

            {/* 3. Explosion particles near border */}
            {borderCenter && (
              <ExplosionParticles
                center={borderCenter}
                globeRadius={globeRadius}
                state={war.state}
              />
            )}

            {/* v15: 7. War fog between warring nations */}
            {borderCenter && (
              <WarFog
                center={borderCenter}
                globeRadius={globeRadius}
                state={war.state}
              />
            )}

            {/* 5. Victory fireworks for winner (v15: enhanced 300 particles, 3-stage burst) */}
            {war.state === 'ended' && war.winner && (
              <VictoryFireworks
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
