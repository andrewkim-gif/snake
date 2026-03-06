'use client';

/**
 * ZoneTerrain — 3개 동심원 존 바닥 렌더링 (테마 지원)
 * Center Zone: r <= arenaRadius x 0.40 (중심 40%) -- 안전 지대
 * Mid Zone:    r <= arenaRadius x 0.70 (중간 30%) -- 전투 지대
 * Edge Zone:   r <= arenaRadius x 1.00 (외곽 30%) -- 위험 지대
 *
 * 테마별 zone 색상:
 *   forest:   잔디 → 돌 → 네더랙
 *   desert:   밝은 모래 → 어두운 모래 → 붉은 사암
 *   mountain: 눈 → 바위 → 어두운 바위
 *   urban:    콘크리트 → 아스팔트 → 어두운 아스팔트
 *   arctic:   흰 눈 → 얼음 → 깊은 얼음
 *   island:   잔디 → 모래 → 산호초(분홍)
 *
 * 각 존은 별도 Mesh + 해당 텍스처 사용
 * position-y 오프셋으로 z-fighting 방지
 */

import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import {
  createGrassTexture,
  createStoneTexture,
  createNetherrackTexture,
  disposeZoneTextures,
} from '@/lib/3d/zone-textures';
import { createTerrainTextures } from '@/lib/3d/terrain-textures';

interface ZoneTerrainProps {
  arenaRadius: number;
  theme?: string;
}

// ─── 테마별 존 emissive 설정 ───

interface ZoneVisual {
  edgeEmissive: string;
  edgeEmissiveIntensity: number;
}

function getZoneVisual(theme: string): ZoneVisual {
  switch (theme) {
    case 'forest':
      return { edgeEmissive: '#331111', edgeEmissiveIntensity: 0.15 };
    case 'desert':
      return { edgeEmissive: '#442211', edgeEmissiveIntensity: 0.1 };
    case 'mountain':
      return { edgeEmissive: '#222222', edgeEmissiveIntensity: 0.08 };
    case 'urban':
      return { edgeEmissive: '#111111', edgeEmissiveIntensity: 0.05 };
    case 'arctic':
      return { edgeEmissive: '#112233', edgeEmissiveIntensity: 0.1 };
    case 'island':
      return { edgeEmissive: '#331133', edgeEmissiveIntensity: 0.1 };
    default:
      return { edgeEmissive: '#331111', edgeEmissiveIntensity: 0.15 };
  }
}

export function ZoneTerrain({ arenaRadius, theme = 'forest' }: ZoneTerrainProps) {
  // v10 기획: center=0~40%, mid=40~70%, edge=70~100%
  const centerRadius = arenaRadius * 0.40;
  const midRadius = arenaRadius * 0.70;

  const zoneVisual = useMemo(() => getZoneVisual(theme), [theme]);

  // 텍스처: 기본 forest는 기존 zone-textures 사용, 다른 테마는 terrain-textures 기반
  const textures = useMemo(() => {
    if (theme === 'forest' || !theme) {
      return {
        center: createGrassTexture(),
        mid: createStoneTexture(),
        edge: createNetherrackTexture(),
      };
    }

    const tt = createTerrainTextures(theme);
    // ground → center, side → mid, accent → edge
    // 각 텍스처를 zone용으로 래핑 설정
    const setupForZone = (tex: THREE.CanvasTexture) => {
      const clone = tex.clone();
      clone.wrapS = THREE.RepeatWrapping;
      clone.wrapT = THREE.RepeatWrapping;
      clone.repeat.set(64, 64);
      clone.needsUpdate = true;
      return clone;
    };
    return {
      center: setupForZone(tt.ground),
      mid: setupForZone(tt.side),
      edge: setupForZone(tt.accent),
    };
  }, [theme]);

  // 텍스처 클린업
  useEffect(() => {
    return () => {
      disposeZoneTextures();
    };
  }, []);

  return (
    <group>
      {/* Center Zone — 안전 지대 (중심, 가장 위) */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.1}>
        <circleGeometry args={[centerRadius, 64]} />
        <meshLambertMaterial map={textures.center} />
      </mesh>

      {/* Mid Zone — 전투 지대 (중간) */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.2}>
        <ringGeometry args={[centerRadius, midRadius, 64]} />
        <meshLambertMaterial map={textures.mid} />
      </mesh>

      {/* Edge Zone — 위험 지대 (외곽, 가장 아래) */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.3}>
        <ringGeometry args={[midRadius, arenaRadius, 64]} />
        <meshLambertMaterial
          map={textures.edge}
          emissive={new THREE.Color(zoneVisual.edgeEmissive)}
          emissiveIntensity={zoneVisual.edgeEmissiveIntensity}
        />
      </mesh>
    </group>
  );
}
