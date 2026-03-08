'use client';

/**
 * AREnvironmentFX — 테마별 환경 파티클 시스템
 *
 * InstancedMesh 기반 환경 파티클:
 * - forest: 초록/갈색 낙엽 낙하
 * - arctic: 흰 눈송이
 * - desert: 모래 횡이동
 * - island: 물방울
 * - urban/mountain: 없음
 *
 * MAX_PARTICLES=100, useFrame ref 업데이트
 * useFrame priority=0
 */

import { useRef, useMemo, memo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ARTerrainTheme } from '@/lib/3d/ar-types';

const MAX_PARTICLES = 100;

const _dummy = new THREE.Object3D();

// 테마별 파티클 설정
interface ParticleConfig {
  count: number;
  color: string;
  secondaryColor?: string;
  size: number;
  /** 움직임 타입: 'fall'=낙하, 'drift'=횡이동, 'float'=부유 */
  motion: 'fall' | 'drift' | 'float';
  speedY: number;
  speedXZ: number;
  spawnHeight: number;
  spawnRadius: number;
}

const THEME_PARTICLES: Partial<Record<ARTerrainTheme, ParticleConfig>> = {
  forest: {
    count: 80,
    color: '#4CAF50',
    secondaryColor: '#8D6E63',
    size: 0.08,
    motion: 'fall',
    speedY: -0.5,
    speedXZ: 0.3,
    spawnHeight: 12,
    spawnRadius: 30,
  },
  arctic: {
    count: 100,
    color: '#ffffff',
    secondaryColor: '#E3F2FD',
    size: 0.06,
    motion: 'fall',
    speedY: -0.3,
    speedXZ: 0.4,
    spawnHeight: 15,
    spawnRadius: 35,
  },
  desert: {
    count: 60,
    color: '#D4A76A',
    secondaryColor: '#C4975A',
    size: 0.04,
    motion: 'drift',
    speedY: -0.1,
    speedXZ: 1.5,
    spawnHeight: 3,
    spawnRadius: 30,
  },
  island: {
    count: 40,
    color: '#64B5F6',
    secondaryColor: '#42A5F5',
    size: 0.05,
    motion: 'float',
    speedY: 0.2,
    speedXZ: 0.2,
    spawnHeight: 2,
    spawnRadius: 25,
  },
};

// ============================================================
// Props
// ============================================================

interface AREnvironmentFXProps {
  theme: ARTerrainTheme;
  arenaRadius?: number;
}

// ============================================================
// 파티클 상태
// ============================================================

interface ParticleState {
  x: number;
  y: number;
  z: number;
  rot: number;
  phase: number; // 각 파티클별 위상 오프셋
}

// ============================================================
// AREnvironmentFX 컴포넌트
// ============================================================

function AREnvironmentFXInner({ theme, arenaRadius = 40 }: AREnvironmentFXProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const config = THEME_PARTICLES[theme];

  // 파티클 초기 상태
  const particlesRef = useRef<ParticleState[]>([]);

  // 설정이 없는 테마면 렌더링 스킵
  const count = config?.count ?? 0;
  const radius = Math.min(config?.spawnRadius ?? 30, arenaRadius);

  // 파티클 초기화
  useEffect(() => {
    if (!config) return;
    const particles: ParticleState[] = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * radius;
      particles.push({
        x: Math.cos(angle) * dist,
        y: Math.random() * config.spawnHeight,
        z: Math.sin(angle) * dist,
        rot: Math.random() * Math.PI * 2,
        phase: Math.random() * Math.PI * 2,
      });
    }
    particlesRef.current = particles;
  }, [config, count, radius]);

  // geometry + material
  const geo = useMemo(
    () => new THREE.BoxGeometry(config?.size ?? 0.05, config?.size ?? 0.05, config?.size ?? 0.05),
    [config?.size],
  );
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({
      color: config?.color ?? '#ffffff',
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    }),
    [config?.color],
  );

  useEffect(() => {
    return () => {
      geo.dispose();
      mat.dispose();
    };
  }, [geo, mat]);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh || !config || count === 0) return;

    const particles = particlesRef.current;
    const clamped = Math.min(delta, 0.05); // cap delta
    const now = performance.now() * 0.001; // 초 단위, 루프 밖에서 1회만 호출

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];

      // 움직임 업데이트
      switch (config.motion) {
        case 'fall':
          p.y += config.speedY * clamped;
          p.x += Math.sin(p.phase + p.y * 0.5) * config.speedXZ * clamped;
          p.z += Math.cos(p.phase + p.y * 0.3) * config.speedXZ * clamped;
          // 바닥 도달 시 리스폰
          if (p.y < 0) {
            p.y = config.spawnHeight;
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * radius;
            p.x = Math.cos(angle) * dist;
            p.z = Math.sin(angle) * dist;
          }
          break;

        case 'drift':
          p.x += config.speedXZ * clamped;
          p.y += config.speedY * clamped + Math.sin(p.phase + p.x * 0.3) * 0.1 * clamped;
          p.z += Math.sin(p.phase) * config.speedXZ * 0.3 * clamped;
          // 범위 이탈 시 리스폰
          if (p.x > radius || p.x < -radius) {
            p.x = -radius;
            p.y = Math.random() * config.spawnHeight;
            p.z = (Math.random() - 0.5) * radius * 2;
          }
          if (p.y < 0) p.y = config.spawnHeight;
          break;

        case 'float': {
          // 절대 위치 오실레이션 (적분 드리프트 방지)
          const baseY = config.spawnHeight * 0.5;
          const amplitude = config.spawnHeight * 0.3;
          p.y = baseY + Math.sin(p.phase + now) * amplitude;
          p.x += Math.sin(p.phase * 2 + now * 0.5) * config.speedXZ * clamped;
          p.z += Math.cos(p.phase * 3 + now * 0.5) * config.speedXZ * clamped;
          break;
        }
      }

      p.rot += clamped * 2;

      _dummy.position.set(p.x, p.y, p.z);
      _dummy.rotation.set(p.rot, p.rot * 0.7, 0);
      _dummy.scale.setScalar(1);
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);
    }

    mesh.count = particles.length;
    mesh.instanceMatrix.needsUpdate = true;
  });

  if (!config || count === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geo, mat, MAX_PARTICLES]}
      frustumCulled={false}
    />
  );
}

export const AREnvironmentFX = memo(AREnvironmentFXInner);
