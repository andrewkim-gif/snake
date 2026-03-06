'use client';

/**
 * ZoneTerrain — 3개 동심원 존 바닥 렌더링 (v10 기획 반영)
 * Center Zone: r ≤ arenaRadius × 0.40 (중심 40%) — 잔디 텍스처 (안전 지대)
 * Mid Zone:    r ≤ arenaRadius × 0.70 (중간 30%) — 돌 텍스처 (전투 지대)
 * Edge Zone:   r ≤ arenaRadius × 1.00 (외곽 30%) — 네더랙 텍스처 (위험 지대)
 *
 * 중심부→외곽으로 갈수록 위험도 증가:
 *   초록 잔디(안전) → 회색 돌(전투) → 빨간 네더랙(위험)
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
  // v10 기획: center=0~40%, mid=40~70%, edge=70~100%
  const centerRadius = arenaRadius * 0.40;
  const midRadius = arenaRadius * 0.70;

  // 텍스처 캐시 — 한 번만 생성
  const textures = useMemo(() => ({
    grass: createGrassTexture(),
    stone: createStoneTexture(),
    netherrack: createNetherrackTexture(),
  }), []);

  return (
    <group>
      {/* Center Zone — 잔디 (안전 지대, 중심, 가장 위) */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.1}>
        <circleGeometry args={[centerRadius, 64]} />
        <meshLambertMaterial map={textures.grass} />
      </mesh>

      {/* Mid Zone — 돌 (전투 지대, 중간) */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.2}>
        <ringGeometry args={[centerRadius, midRadius, 64]} />
        <meshLambertMaterial map={textures.stone} />
      </mesh>

      {/* Edge Zone — 네더랙 (위험 지대, 외곽, 가장 아래) */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.3}>
        <ringGeometry args={[midRadius, arenaRadius, 64]} />
        <meshLambertMaterial
          map={textures.netherrack}
          emissive={new THREE.Color('#331111')}
          emissiveIntensity={0.15}
        />
      </mesh>
    </group>
  );
}
