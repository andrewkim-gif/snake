'use client';

/**
 * GlobeShockwave — v15 Phase 4, v24 Phase 4 통일
 * Shockwave ring effect at missile impact points on the 3D globe.
 * - RingGeometry expanding from impact point
 * - Opacity decay over 0.8 seconds
 * - Object pool of 5 rings for reuse (GC prevention)
 * - v24: COLORS_3D.war 색상, RENDER_ORDER.SURFACE_GLOW 체계 적용
 */

import { useRef, useMemo, useEffect, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { COLORS_3D, RENDER_ORDER } from '@/lib/effect-constants';

// ─── Types ───

export interface GlobeShockwaveProps {
  globeRadius?: number;
  visible?: boolean;
}

export interface GlobeShockwaveHandle {
  trigger: (position: THREE.Vector3) => void;
}

// ─── Constants ───

const POOL_SIZE = 5;
const SHOCKWAVE_DURATION = 0.8;       // seconds
const SHOCKWAVE_MAX_SCALE = 12;       // max ring radius multiplier
const SHOCKWAVE_INITIAL_SCALE = 0.5;
// v24: 색상을 effect-constants에서 가져옴 (전쟁 적색 계열)
const RING_COLOR = COLORS_3D.war;
const RING_INNER_RATIO = 0.85;        // inner radius ratio

// ─── Shockwave state per pool item ───

interface ShockwaveState {
  active: boolean;
  position: THREE.Vector3;
  startTime: number;
  normal: THREE.Vector3;  // surface normal for ring orientation
}

// ─── Component ───

import { forwardRef, useImperativeHandle } from 'react';

export const GlobeShockwave = forwardRef<GlobeShockwaveHandle, GlobeShockwaveProps>(
  function GlobeShockwave({ globeRadius = 100, visible = true }, ref) {
    const groupRef = useRef<THREE.Group>(null);
    const clockRef = useRef(0);
    const poolRef = useRef<ShockwaveState[]>(
      Array.from({ length: POOL_SIZE }, () => ({
        active: false,
        position: new THREE.Vector3(),
        startTime: 0,
        normal: new THREE.Vector3(0, 1, 0),
      })),
    );
    const meshRefs = useRef<(THREE.Mesh | null)[]>(new Array(POOL_SIZE).fill(null));

    // Shared ring geometry (unit size, scaled per instance)
    const ringGeometry = useMemo(
      () => new THREE.RingGeometry(RING_INNER_RATIO, 1, 32),
      [],
    );

    // Procedural shockwave material: additive blending, transparent
    const ringMaterial = useMemo(
      () => new THREE.MeshBasicMaterial({
        color: RING_COLOR,
        transparent: true,
        opacity: 1.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
      [],
    );

    // Imperative trigger API for parent to call on missile impact
    const trigger = useCallback((position: THREE.Vector3) => {
      const pool = poolRef.current;
      // Find inactive slot or oldest
      let targetIdx = pool.findIndex((s) => !s.active);
      if (targetIdx === -1) {
        // Recycle oldest
        let oldest = Infinity;
        targetIdx = 0;
        for (let i = 0; i < POOL_SIZE; i++) {
          if (pool[i].startTime < oldest) {
            oldest = pool[i].startTime;
            targetIdx = i;
          }
        }
      }
      const normal = position.clone().normalize();
      pool[targetIdx] = {
        active: true,
        position: position.clone(),
        startTime: clockRef.current,
        normal,
      };
    }, []);

    useImperativeHandle(ref, () => ({ trigger }), [trigger]);

    // Animation loop
    useFrame((_, delta) => {
      clockRef.current += delta;
      const now = clockRef.current;
      const pool = poolRef.current;

      for (let i = 0; i < POOL_SIZE; i++) {
        const mesh = meshRefs.current[i];
        if (!mesh) continue;
        const state = pool[i];

        if (!state.active) {
          mesh.visible = false;
          continue;
        }

        const elapsed = now - state.startTime;
        const t = elapsed / SHOCKWAVE_DURATION;

        if (t >= 1.0) {
          state.active = false;
          mesh.visible = false;
          continue;
        }

        mesh.visible = true;

        // Position on globe surface
        mesh.position.copy(state.position);

        // Orient ring to face outward from globe surface
        const up = new THREE.Vector3(0, 1, 0);
        const quat = new THREE.Quaternion().setFromUnitVectors(up, state.normal);
        mesh.quaternion.copy(quat);
        // Rotate to lie flat on surface (ring is in XY plane by default)
        mesh.rotateX(-Math.PI / 2);

        // Expand ring: smooth ease-out
        const easeOut = 1 - (1 - t) * (1 - t);
        const scale = SHOCKWAVE_INITIAL_SCALE + (SHOCKWAVE_MAX_SCALE - SHOCKWAVE_INITIAL_SCALE) * easeOut;
        mesh.scale.setScalar(scale);

        // Fade out opacity
        const opacity = 1.0 - easeOut;
        (mesh.material as THREE.MeshBasicMaterial).opacity = opacity * 0.8;
      }
    });

    // Cleanup
    useEffect(() => {
      return () => {
        ringGeometry.dispose();
        ringMaterial.dispose();
      };
    }, [ringGeometry, ringMaterial]);

    if (!visible) return null;

    return (
      <group ref={groupRef}>
        {Array.from({ length: POOL_SIZE }, (_, i) => (
          <mesh
            key={i}
            ref={(el) => { meshRefs.current[i] = el; }}
            geometry={ringGeometry}
            material={ringMaterial.clone()}
            visible={false}
            renderOrder={RENDER_ORDER.SURFACE_GLOW}
          />
        ))}
      </group>
    );
  },
);

export default GlobeShockwave;
