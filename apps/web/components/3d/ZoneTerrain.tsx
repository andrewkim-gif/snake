'use client';

/**
 * ZoneTerrain — 3개 동심원 존 바닥 렌더링
 * Edge Zone: r > arenaRadius × 0.60 (외곽 40%) — 잔디 텍스처
 * Mid Zone:  r > arenaRadius × 0.25 (중간 35%) — 돌 텍스처
 * Core Zone: r ≤ arenaRadius × 0.25 (내부 25%) — 네더랙 텍스처
 *
 * 각 존은 별도 Mesh + 해당 텍스처 사용
 * position-y 오프셋으로 z-fighting 방지
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import {
  createGrassTexture,
  createStoneTexture,
  createNetherrackTexture,
} from '@/lib/3d/zone-textures';

interface ZoneTerrainProps {
  arenaRadius: number;
}

export function ZoneTerrain({ arenaRadius }: ZoneTerrainProps) {
  const coreRadius = arenaRadius * 0.25;
  const midRadius = arenaRadius * 0.60;

  // 텍스처 캐시 — 한 번만 생성
  const textures = useMemo(() => ({
    grass: createGrassTexture(),
    stone: createStoneTexture(),
    netherrack: createNetherrackTexture(),
  }), []);

  return (
    <group>
      {/* Core Zone — 네더랙 (가장 위) */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.1}>
        <circleGeometry args={[coreRadius, 64]} />
        <meshLambertMaterial
          map={textures.netherrack}
          emissive={new THREE.Color('#331111')}
          emissiveIntensity={0.1}
        />
      </mesh>

      {/* Mid Zone — 돌 */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.2}>
        <ringGeometry args={[coreRadius, midRadius, 64]} />
        <meshLambertMaterial map={textures.stone} />
      </mesh>

      {/* Edge Zone — 잔디 (가장 아래) */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.3}>
        <ringGeometry args={[midRadius, arenaRadius, 64]} />
        <meshLambertMaterial map={textures.grass} />
      </mesh>
    </group>
  );
}
