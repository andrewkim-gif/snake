'use client';

/**
 * EliteEffects.tsx — Elite 몬스터 3D 이펙트 (S25)
 *
 * Silver: subtle emissive glow
 * Gold: bright glow + orbiting particles (3-4개)
 * Diamond: intense glow + 6 orbiting particles
 * LOD 연동: HIGH=full effects, MID=glow만, LOW=none
 *
 * InstancedMesh 기반 orbiting particles 최적화.
 * useFrame priority=0 필수.
 */

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Enemy, EliteTier } from '@/lib/matrix/types';
import {
  ELITE_EMISSIVE_COLORS,
  ELITE_EMISSIVE_INTENSITY,
  ELITE_PARTICLE_COLORS,
} from '@/lib/matrix/rendering3d/enemy-colors';

// ============================================
// Constants
// ============================================

/** elite tier별 orbiting particle 수 */
const PARTICLE_COUNTS: Record<EliteTier, number> = {
  silver: 0,    // glow만
  gold: 4,      // 3-4개
  diamond: 6,   // 6개
};

/** particle 궤도 반경 (3D unit) */
const ORBIT_RADIUS: Record<EliteTier, number> = {
  silver: 0,
  gold: 1.8,
  diamond: 2.2,
};

/** particle 궤도 속도 (rad/s) */
const ORBIT_SPEED: Record<EliteTier, number> = {
  silver: 0,
  gold: 2.0,
  diamond: 3.0,
};

/** particle 크기 */
const PARTICLE_SIZE = 0.15;

/** glow point light 강도 */
const GLOW_LIGHT_INTENSITY: Record<EliteTier, number> = {
  silver: 0.5,
  gold: 1.5,
  diamond: 3.0,
};

/** glow point light 범위 */
const GLOW_LIGHT_DISTANCE: Record<EliteTier, number> = {
  silver: 3,
  gold: 5,
  diamond: 8,
};

/** LOD 거리 임계값 (2D px) */
const LOD_HIGH_THRESHOLD = 800;
const LOD_MID_THRESHOLD = 1400;

/** 최대 동시 elite 수 */
const MAX_ELITES = 10;

/** 최대 orbiting particles (10 elite × 6 max = 60) */
const MAX_PARTICLES = MAX_ELITES * 6;

// ============================================
// 재사용 임시 객체
// ============================================

const _tempMatrix = new THREE.Matrix4();
const _tempPosition = new THREE.Vector3();
const _tempScale = new THREE.Vector3(PARTICLE_SIZE, PARTICLE_SIZE, PARTICLE_SIZE);
const _tempQuaternion = new THREE.Quaternion();
const _tempColor = new THREE.Color();

// ============================================
// Props
// ============================================

export interface EliteEffectsProps {
  /** 적 배열 ref */
  enemiesRef: React.MutableRefObject<Enemy[]>;
  /** 플레이어 위치 ref (LOD 거리 계산용) */
  playerRef: React.MutableRefObject<{ position: { x: number; y: number } }>;
}

// ============================================
// EliteEffects Component
// ============================================

export function EliteEffects({ enemiesRef, playerRef }: EliteEffectsProps) {
  const groupRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);

  // Orbiting particle InstancedMesh
  const particlePool = useMemo(() => {
    const geometry = new THREE.SphereGeometry(PARTICLE_SIZE, 6, 6);
    const material = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      emissive: '#ffffff',
      emissiveIntensity: 2.0,
      roughness: 0.2,
      metalness: 0.3,
    });
    const mesh = new THREE.InstancedMesh(geometry, material, MAX_PARTICLES);
    mesh.name = 'elite_particles';
    mesh.frustumCulled = false;
    mesh.count = 0;

    // instanceColor 초기화
    const colorArray = new Float32Array(MAX_PARTICLES * 3);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(colorArray, 3);

    return { geometry, material, mesh };
  }, []);

  // Glow sphere InstancedMesh (emissive 오라)
  const glowPool = useMemo(() => {
    const geometry = new THREE.SphereGeometry(1, 8, 8);
    const material = new THREE.MeshStandardMaterial({
      color: '#000000',
      emissive: '#ffffff',
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.3,
      roughness: 1.0,
      metalness: 0.0,
      depthWrite: false,
      side: THREE.FrontSide,
    });
    const mesh = new THREE.InstancedMesh(geometry, material, MAX_ELITES);
    mesh.name = 'elite_glow';
    mesh.frustumCulled = false;
    mesh.count = 0;
    mesh.renderOrder = -1; // 다른 적 뒤에

    // instanceColor 초기화
    const colorArray = new Float32Array(MAX_ELITES * 3);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(colorArray, 3);

    return { geometry, material, mesh };
  }, []);

  // Scene에 추가/제거
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    group.add(particlePool.mesh);
    group.add(glowPool.mesh);

    return () => {
      group.remove(particlePool.mesh);
      group.remove(glowPool.mesh);
      particlePool.geometry.dispose();
      particlePool.material.dispose();
      particlePool.mesh.dispose();
      glowPool.geometry.dispose();
      glowPool.material.dispose();
      glowPool.mesh.dispose();
    };
  }, [particlePool, glowPool]);

  // ============================================
  // useFrame: elite 이펙트 업데이트
  // ============================================

  useFrame((_, delta) => {
    timeRef.current += delta;
    const time = timeRef.current;

    const enemies = enemiesRef.current;
    if (!enemies || enemies.length === 0) {
      if (particlePool.mesh.count !== 0) particlePool.mesh.count = 0;
      if (glowPool.mesh.count !== 0) glowPool.mesh.count = 0;
      return;
    }

    const player = playerRef.current;
    const playerX = player.position.x;
    const playerY = player.position.y;

    let glowIdx = 0;
    let particleIdx = 0;

    for (let e = 0; e < enemies.length; e++) {
      const enemy = enemies[e];
      if (!enemy || !enemy.isElite || !enemy.eliteTier) continue;
      if (enemy.state === 'dying') continue;

      const tier = enemy.eliteTier;

      // LOD 판정 (2D 거리)
      const dx = enemy.position.x - playerX;
      const dy = enemy.position.y - playerY;
      const distSq = dx * dx + dy * dy;

      // LOW 이상이면 이펙트 없음
      if (distSq > LOD_MID_THRESHOLD * LOD_MID_THRESHOLD) continue;

      const isHighLod = distSq < LOD_HIGH_THRESHOLD * LOD_HIGH_THRESHOLD;

      // 2D → 3D 좌표
      const x3d = enemy.position.x;
      const z3d = -enemy.position.y;

      // elite 크기 스케일
      const eliteScales: Record<string, number> = { silver: 1.3, gold: 1.4, diamond: 1.5 };
      const eliteScale = eliteScales[tier] ?? 1.0;

      // --- Glow 오라 ---
      if (glowIdx < MAX_ELITES) {
        const glowRadius = eliteScale * 1.2;
        const templateHeight = 1.5; // 대략적 중심 높이
        _tempPosition.set(x3d, templateHeight, z3d);
        _tempScale.set(glowRadius, glowRadius, glowRadius);
        _tempMatrix.compose(_tempPosition, _tempQuaternion.identity(), _tempScale);
        glowPool.mesh.setMatrixAt(glowIdx, _tempMatrix);

        // glow 색상
        const emissiveColor = ELITE_EMISSIVE_COLORS[tier];
        _tempColor.copy(emissiveColor);
        glowPool.mesh.setColorAt(glowIdx, _tempColor);

        glowIdx++;
      }

      // --- Orbiting Particles (HIGH LOD만) ---
      if (isHighLod) {
        const pCount = PARTICLE_COUNTS[tier];
        const orbitR = ORBIT_RADIUS[tier];
        const orbitSpd = ORBIT_SPEED[tier];

        for (let p = 0; p < pCount; p++) {
          if (particleIdx >= MAX_PARTICLES) break;

          // 균등 분배된 궤도 위치
          const baseAngle = (p / pCount) * Math.PI * 2;
          const angle = baseAngle + time * orbitSpd;

          // 궤도 높이 오프셋 (사인파 + Y 오프셋)
          const heightOffset = Math.sin(time * 1.5 + p * 0.8) * 0.3 + 1.2;

          const px = x3d + Math.cos(angle) * orbitR;
          const py = heightOffset;
          const pz = z3d + Math.sin(angle) * orbitR;

          _tempPosition.set(px, py, pz);
          _tempScale.set(PARTICLE_SIZE, PARTICLE_SIZE, PARTICLE_SIZE);
          _tempMatrix.compose(_tempPosition, _tempQuaternion.identity(), _tempScale);
          particlePool.mesh.setMatrixAt(particleIdx, _tempMatrix);

          // particle 색상
          const particleColor = ELITE_PARTICLE_COLORS[tier];
          _tempColor.copy(particleColor);
          particlePool.mesh.setColorAt(particleIdx, _tempColor);

          particleIdx++;
        }
      }
    }

    // count 업데이트
    if (glowPool.mesh.count !== glowIdx) {
      glowPool.mesh.count = glowIdx;
    }
    if (glowIdx > 0) {
      glowPool.mesh.instanceMatrix.needsUpdate = true;
      if (glowPool.mesh.instanceColor) {
        glowPool.mesh.instanceColor.needsUpdate = true;
      }
    }

    if (particlePool.mesh.count !== particleIdx) {
      particlePool.mesh.count = particleIdx;
    }
    if (particleIdx > 0) {
      particlePool.mesh.instanceMatrix.needsUpdate = true;
      if (particlePool.mesh.instanceColor) {
        particlePool.mesh.instanceColor.needsUpdate = true;
      }
    }
  });

  return <group ref={groupRef} />;
}
