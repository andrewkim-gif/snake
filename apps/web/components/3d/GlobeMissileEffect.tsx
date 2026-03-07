'use client';

/**
 * GlobeMissileEffect — v15 Phase 4
 * Missile trajectories from attacker to defender on the 3D globe.
 * - Parabolic arc with procedural glow head + tail particles
 * - InstancedMesh for max 10 simultaneous missiles
 * - Triggers shockwave callback on impact
 *
 * Style: Dark/Glow | Font: Ethnocentric (display), ITC Avant Garde Gothic (body)
 */

import { useRef, useMemo, useEffect, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { latLngToVector3 } from '@/lib/globe-utils';

// ─── Types ───

export interface MissileData {
  id: string;
  startPos: THREE.Vector3;
  endPos: THREE.Vector3;
  startTime: number;
  duration: number;   // seconds for full flight
  active: boolean;
}

export interface GlobeMissileEffectProps {
  wars: Array<{
    warId: string;
    state: 'preparation' | 'active' | 'ended';
    attacker: string;
    defender: string;
  }>;
  countryCentroids: Map<string, [number, number]>;
  globeRadius?: number;
  onImpact?: (position: THREE.Vector3, warId: string) => void;
  visible?: boolean;
  /** v15 Phase 6: 모바일 LOD — 동시 미사일 최대 수 (기본 10) */
  maxMissiles?: number;
}

// ─── Constants ───

const MAX_MISSILES = 10;
const MISSILE_DURATION = 1.8;       // seconds per missile flight
const MISSILE_LAUNCH_INTERVAL = 2.5; // seconds between launches per war
const ARC_HEIGHT_FACTOR = 0.35;      // parabolic arc height
const HEAD_COLOR = new THREE.Color(0xff4422);
const TAIL_COLOR = new THREE.Color(0xff8800);

// ─── Helpers ───
// latLngToVector3 → @/lib/globe-utils (v20 통합)

/** Quadratic bezier point along parabolic arc on the globe */
function getArcPoint(
  start: THREE.Vector3, end: THREE.Vector3,
  t: number, arcHeight: number,
): THREE.Vector3 {
  const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  const normal = mid.clone().normalize();
  const controlPoint = mid.clone().add(normal.multiplyScalar(arcHeight));
  const oneMinusT = 1 - t;
  return new THREE.Vector3(
    oneMinusT * oneMinusT * start.x + 2 * oneMinusT * t * controlPoint.x + t * t * end.x,
    oneMinusT * oneMinusT * start.y + 2 * oneMinusT * t * controlPoint.y + t * t * end.y,
    oneMinusT * oneMinusT * start.z + 2 * oneMinusT * t * controlPoint.z + t * t * end.z,
  );
}

// ─── Procedural glow texture (radial gradient, no image file) ───

function createGlowTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255, 200, 100, 1.0)');
  gradient.addColorStop(0.3, 'rgba(255, 100, 50, 0.7)');
  gradient.addColorStop(0.7, 'rgba(255, 50, 20, 0.2)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

// ─── Missile state tracking ───

interface MissileState {
  active: boolean;
  warId: string;
  startPos: THREE.Vector3;
  endPos: THREE.Vector3;
  startTime: number;
  arcHeight: number;
}

// ─── Component ───

export function GlobeMissileEffect({
  wars,
  countryCentroids,
  globeRadius = 100,
  onImpact,
  visible = true,
  maxMissiles = MAX_MISSILES,
}: GlobeMissileEffectProps) {
  const groupRef = useRef<THREE.Group>(null);
  const clockRef = useRef(0);
  const lastLaunchRef = useRef<Map<string, number>>(new Map());
  const missilesRef = useRef<MissileState[]>(
    Array.from({ length: MAX_MISSILES }, () => ({
      active: false, warId: '', startPos: new THREE.Vector3(),
      endPos: new THREE.Vector3(), startTime: 0, arcHeight: 0,
    })),
  );

  // InstancedMesh for missile heads (glowing spheres)
  const headGeometry = useMemo(() => new THREE.SphereGeometry(0.8, 8, 8), []);
  const glowTexture = useMemo(() => createGlowTexture(), []);
  const headMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({
      color: HEAD_COLOR,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
    [],
  );

  // Tail particles (elongated trail behind each missile)
  const TAIL_POINTS_PER_MISSILE = 8;
  const tailGeometry = useMemo(() => {
    const count = MAX_MISSILES * TAIL_POINTS_PER_MISSILE;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    return geo;
  }, []);
  const tailMaterial = useMemo(
    () => new THREE.PointsMaterial({
      color: TAIL_COLOR,
      size: 1.2,
      map: glowTexture,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    }),
    [glowTexture],
  );

  const headInstancedRef = useRef<THREE.InstancedMesh>(null);
  const tailPointsRef = useRef<THREE.Points>(null);
  const _dummy = useMemo(() => new THREE.Object3D(), []);

  // Get position for country from centroids
  const getPos = useCallback(
    (iso3: string): THREE.Vector3 | null => {
      const c = countryCentroids.get(iso3);
      if (!c) return null;
      return latLngToVector3(c[0], c[1], globeRadius * 1.02);
    },
    [countryCentroids, globeRadius],
  );

  // Launch a new missile (v15 Phase 6: LOD-limited by maxMissiles prop)
  const launchMissile = useCallback(
    (warId: string, start: THREE.Vector3, end: THREE.Vector3, time: number) => {
      const missiles = missilesRef.current;
      // LOD 제한: maxMissiles 이내의 슬롯만 사용
      const limit = Math.min(maxMissiles, MAX_MISSILES);
      for (let i = 0; i < limit; i++) {
        if (!missiles[i].active) {
          const dist = start.distanceTo(end);
          missiles[i] = {
            active: true,
            warId,
            startPos: start.clone(),
            endPos: end.clone(),
            startTime: time,
            arcHeight: dist * ARC_HEIGHT_FACTOR,
          };
          return;
        }
      }
    },
    [maxMissiles],
  );

  useFrame((_, delta) => {
    clockRef.current += delta;
    const now = clockRef.current;
    const missiles = missilesRef.current;
    const instMesh = headInstancedRef.current;
    if (!instMesh) return;

    // Launch missiles for active wars
    for (const war of wars) {
      if (war.state !== 'active') continue;
      const lastLaunch = lastLaunchRef.current.get(war.warId) ?? -Infinity;
      if (now - lastLaunch >= MISSILE_LAUNCH_INTERVAL) {
        const atkPos = getPos(war.attacker);
        const defPos = getPos(war.defender);
        if (atkPos && defPos) {
          // Alternate direction for visual variety
          const dir = Math.random() > 0.5;
          launchMissile(war.warId, dir ? atkPos : defPos, dir ? defPos : atkPos, now);
          lastLaunchRef.current.set(war.warId, now);
        }
      }
    }

    // Update missile positions
    const tailPositions = tailGeometry.attributes.position as THREE.BufferAttribute;
    const tailSizes = tailGeometry.attributes.size as THREE.BufferAttribute;

    for (let i = 0; i < MAX_MISSILES; i++) {
      const m = missiles[i];
      if (!m.active) {
        // Hide this instance
        _dummy.position.set(0, 0, -9999);
        _dummy.scale.setScalar(0);
        _dummy.updateMatrix();
        instMesh.setMatrixAt(i, _dummy.matrix);
        // Hide tail points
        for (let j = 0; j < TAIL_POINTS_PER_MISSILE; j++) {
          const idx = i * TAIL_POINTS_PER_MISSILE + j;
          tailPositions.setXYZ(idx, 0, 0, -9999);
          tailSizes.setX(idx, 0);
        }
        continue;
      }

      const elapsed = now - m.startTime;
      const t = elapsed / MISSILE_DURATION;

      if (t >= 1.0) {
        // Impact!
        m.active = false;
        onImpact?.(m.endPos.clone(), m.warId);
        _dummy.position.set(0, 0, -9999);
        _dummy.scale.setScalar(0);
        _dummy.updateMatrix();
        instMesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }

      // Missile head position on parabolic arc
      const pos = getArcPoint(m.startPos, m.endPos, t, m.arcHeight);
      _dummy.position.copy(pos);
      // Scale pulsation for glow effect
      const pulse = 1.0 + 0.3 * Math.sin(now * 15);
      _dummy.scale.setScalar(pulse);
      _dummy.updateMatrix();
      instMesh.setMatrixAt(i, _dummy.matrix);

      // Tail trail: show previous positions along arc
      for (let j = 0; j < TAIL_POINTS_PER_MISSILE; j++) {
        const tailT = Math.max(0, t - (j + 1) * 0.04);
        const tailPos = getArcPoint(m.startPos, m.endPos, tailT, m.arcHeight);
        const idx = i * TAIL_POINTS_PER_MISSILE + j;
        tailPositions.setXYZ(idx, tailPos.x, tailPos.y, tailPos.z);
        // Fade tail sizes from front to back
        tailSizes.setX(idx, Math.max(0.2, 1.0 - j * 0.12));
      }
    }

    instMesh.instanceMatrix.needsUpdate = true;
    tailPositions.needsUpdate = true;
    tailSizes.needsUpdate = true;
  });

  // Cleanup
  useEffect(() => {
    return () => {
      headGeometry.dispose();
      headMaterial.dispose();
      tailGeometry.dispose();
      tailMaterial.dispose();
      glowTexture.dispose();
    };
  }, [headGeometry, headMaterial, tailGeometry, tailMaterial, glowTexture]);

  if (!visible) return null;

  return (
    <group ref={groupRef}>
      {/* Missile heads — InstancedMesh */}
      <instancedMesh
        ref={headInstancedRef}
        args={[headGeometry, headMaterial, MAX_MISSILES]}
        frustumCulled={false}
      />
      {/* Missile tail particles */}
      <points ref={tailPointsRef} geometry={tailGeometry} material={tailMaterial} />
    </group>
  );
}

export default GlobeMissileEffect;
