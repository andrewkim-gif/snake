'use client';

/**
 * ARTerrain — 국가 테마별 바닥 + 장애물 렌더링 (Phase 3)
 *
 * 6종 테마: urban, desert, mountain, forest, arctic, island
 * - 바닥 색상: 테마별 색상
 * - 장애물: 테마별 형태 (building, rock, tree, ice, water)
 * - 안개: 테마별 색상/밀도
 *
 * useFrame priority=0
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import type { ARTerrainTheme } from '@/lib/3d/ar-types';
import { TERRAIN_VISUALS } from '@/lib/3d/ar-types';

const ARENA_RADIUS = 40;

interface ARTerrainProps {
  theme: ARTerrainTheme;
}

export function ARTerrain({ theme }: ARTerrainProps) {
  const visual = TERRAIN_VISUALS[theme] || TERRAIN_VISUALS.urban;

  // 바닥 색상
  const floorColor = useMemo(() => new THREE.Color(visual.floorColor), [visual.floorColor]);
  const fogColor = useMemo(() => new THREE.Color(visual.fogColor), [visual.fogColor]);

  // 장애물 생성 (결정론적 시드 기반)
  const obstacles = useMemo(() => {
    const obs: Array<{ x: number; z: number; w: number; h: number; d: number }> = [];
    const count = visual.obstacleCount;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const dist = ARENA_RADIUS * (0.2 + 0.6 * ((i % 5) / 5));
      const jitter = ((i * 7 + 3) / count) * Math.PI * 2;

      const x = dist * Math.cos(angle + jitter * 0.3);
      const z = dist * Math.sin(angle + jitter * 0.3);

      const baseSize = obstacleBaseSize(visual.obstacleType);
      const w = baseSize * (0.7 + (i % 3) * 0.3);
      const h = baseSize * (1.0 + (i % 4) * 0.5);
      const d = baseSize * (0.7 + (i % 2) * 0.3);

      obs.push({ x, z, w, h, d });
    }
    return obs;
  }, [visual.obstacleCount, visual.obstacleType]);

  // 장애물 색상
  const obstacleColor = useMemo(() => {
    switch (visual.obstacleType) {
      case 'building':
        return new THREE.Color('#555555');
      case 'rock':
        return new THREE.Color('#7a7a6a');
      case 'tree':
        return new THREE.Color('#2a5a2a');
      case 'ice':
        return new THREE.Color('#b0d0e8');
      case 'water':
        return new THREE.Color('#2a5a8a');
      default:
        return new THREE.Color('#666666');
    }
  }, [visual.obstacleType]);

  return (
    <group>
      {/* 바닥 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[ARENA_RADIUS * 1.2, 64]} />
        <meshLambertMaterial color={floorColor} />
      </mesh>

      {/* 아레나 경계선 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[ARENA_RADIUS - 0.2, ARENA_RADIUS, 64]} />
        <meshBasicMaterial color="#ff3333" transparent opacity={0.4} />
      </mesh>

      {/* 그리드 */}
      <gridHelper
        args={[ARENA_RADIUS * 2, 20, '#333333', '#222222']}
        position={[0, 0.005, 0]}
      />

      {/* 장애물 */}
      {obstacles.map((obs, i) => (
        <mesh
          key={`obs_${i}`}
          position={[obs.x, obs.h / 2, obs.z]}
          castShadow
          receiveShadow
        >
          {visual.obstacleType === 'tree' ? (
            <cylinderGeometry args={[obs.w * 0.3, obs.w * 0.5, obs.h, 6]} />
          ) : visual.obstacleType === 'water' ? (
            <cylinderGeometry args={[obs.w, obs.w, 0.1, 16]} />
          ) : (
            <boxGeometry args={[obs.w, obs.h, obs.d]} />
          )}
          <meshLambertMaterial
            color={obstacleColor}
            transparent={visual.obstacleType === 'water' || visual.obstacleType === 'ice'}
            opacity={
              visual.obstacleType === 'water'
                ? 0.6
                : visual.obstacleType === 'ice'
                  ? 0.8
                  : 1.0
            }
          />
        </mesh>
      ))}

      {/* 안개 (R3F fog 대신 간단한 원형 페이드) */}
      <fog attach="fog" args={[fogColor, ARENA_RADIUS * 0.5, ARENA_RADIUS * 1.5]} />

      {/* 환경광 */}
      <ambientLight intensity={visual.ambientLight} />
      <directionalLight
        position={[20, 30, 10]}
        intensity={0.8}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
    </group>
  );
}

function obstacleBaseSize(type: string): number {
  switch (type) {
    case 'building':
      return 3.0;
    case 'rock':
      return 2.5;
    case 'tree':
      return 1.5;
    case 'ice':
      return 2.5;
    case 'water':
      return 3.0;
    default:
      return 2.0;
  }
}
