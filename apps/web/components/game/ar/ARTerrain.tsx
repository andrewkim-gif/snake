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

import { useMemo, memo } from 'react';
import { useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import type { ARTerrainTheme } from '@/lib/3d/ar-types';
import { TERRAIN_VISUALS } from '@/lib/3d/ar-types';

interface ARTerrainProps {
  theme: ARTerrainTheme;
  /** 아레나 반경 (meter, 서버 arState.arenaRadius) */
  arenaRadius?: number;
}

// 테마별 바닥 텍스처 매핑
const THEME_FLOOR_TEXTURES: Record<ARTerrainTheme, string> = {
  urban: '/textures/blocks/cobblestone.png',
  desert: '/textures/blocks/sand.png',
  mountain: '/textures/blocks/stone.png',
  forest: '/textures/blocks/grass_top_green.png',
  arctic: '/textures/blocks/quartz_block_side.png',
  island: '/textures/blocks/grass_block_side.png',
};

// 테마별 HemisphereLight 색온도
const THEME_HEMISPHERE: Record<ARTerrainTheme, { sky: string; ground: string; intensity: number }> = {
  urban: { sky: '#8899aa', ground: '#333333', intensity: 0.6 },
  desert: { sky: '#FFD54F', ground: '#8B6914', intensity: 0.8 },
  mountain: { sky: '#90CAF9', ground: '#5D4037', intensity: 0.5 },
  forest: { sky: '#81C784', ground: '#33691E', intensity: 0.7 },
  arctic: { sky: '#E3F2FD', ground: '#B0BEC5', intensity: 0.9 },
  island: { sky: '#4FC3F7', ground: '#00796B', intensity: 0.7 },
};

function ARTerrainInner({ theme, arenaRadius = 40 }: ARTerrainProps) {
  const visual = TERRAIN_VISUALS[theme] || TERRAIN_VISUALS.urban;
  const ARENA_RADIUS = arenaRadius;

  // 바닥 MC 블록 텍스처 (RepeatWrapping 타일링)
  const floorTexture = useLoader(THREE.TextureLoader, THEME_FLOOR_TEXTURES[theme] ?? THEME_FLOOR_TEXTURES.urban);
  useMemo(() => {
    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(ARENA_RADIUS * 0.8, ARENA_RADIUS * 0.8);
    floorTexture.magFilter = THREE.NearestFilter;
    floorTexture.minFilter = THREE.NearestFilter;
    floorTexture.colorSpace = THREE.SRGBColorSpace;
  }, [floorTexture, ARENA_RADIUS]);

  // 바닥 색상 (폴백 및 틴트)
  const floorColor = useMemo(() => new THREE.Color(visual.floorColor), [visual.floorColor]);
  const fogColor = useMemo(() => new THREE.Color(visual.fogColor), [visual.fogColor]);

  // HemisphereLight 설정
  const hemiConfig = THEME_HEMISPHERE[theme] ?? THEME_HEMISPHERE.urban;

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
  }, [visual.obstacleCount, visual.obstacleType, ARENA_RADIUS]);

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
      {/* 바닥 — MC 블록 텍스처 타일링 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[ARENA_RADIUS * 1.2, 64]} />
        <meshLambertMaterial map={floorTexture} color={floorColor} />
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

      {/* 환경광 — 테마별 HemisphereLight 색온도 */}
      <hemisphereLight
        args={[hemiConfig.sky, hemiConfig.ground, hemiConfig.intensity]}
      />
      <ambientLight intensity={visual.ambientLight * 0.4} />
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

export const ARTerrain = memo(ARTerrainInner);

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
