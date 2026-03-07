'use client';

/**
 * HeightmapTerrain — v16 Phase 4+5 서버 동기화 지형 렌더링
 *
 * joined 이벤트에서 받은 heightmap + biome 데이터를 디코딩하여
 * Three.js PlaneGeometry + vertex displacement + biome-aware vertex colors로 렌더링.
 *
 * Phase 5: 바이옴별 색상 매핑
 * - Plains (0) = 밝은 녹색 (풀밭)
 * - Forest (1) = 짙은 녹색 (숲)
 * - Desert (2) = 모래 황갈색
 * - Snow (3) = 밝은 회백색
 * - Swamp (4) = 어두운 올리브
 * - Volcanic (5) = 어두운 적갈색
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import type { BiomeGridData } from '@/lib/biome-decoder';

export interface HeightmapTerrainData {
  /** Float32Array of height values (decoded from server) */
  heightData: Float32Array;
  /** Grid width in cells */
  width: number;
  /** Grid height in cells */
  height: number;
  /** World units per cell (50) */
  cellSize: number;
}

interface HeightmapTerrainProps {
  data: HeightmapTerrainData | null;
  biomeData?: BiomeGridData | null;
}

// 바이옴별 base/peak 색상 팔레트
const BIOME_COLORS: Array<{ base: THREE.Color; peak: THREE.Color }> = [
  // 0: Plains — 밝은 녹색 → 연갈색
  { base: new THREE.Color(0x5a9e3a), peak: new THREE.Color(0x8a7a50) },
  // 1: Forest — 짙은 녹색 → 암녹색
  { base: new THREE.Color(0x2d6a1e), peak: new THREE.Color(0x3a5a2a) },
  // 2: Desert — 모래색 → 밝은 베이지
  { base: new THREE.Color(0xc4a55a), peak: new THREE.Color(0xd4c490) },
  // 3: Snow — 밝은 회백색 → 순백
  { base: new THREE.Color(0xb0c0cc), peak: new THREE.Color(0xe8eef0) },
  // 4: Swamp — 어두운 올리브 → 갈녹색
  { base: new THREE.Color(0x4a5a2a), peak: new THREE.Color(0x5a6a3a) },
  // 5: Volcanic — 어두운 적갈색 → 회흑색
  { base: new THREE.Color(0x5a2a1e), peak: new THREE.Color(0x4a4a4a) },
];

// 높이 기반 fallback 색상
const COLOR_LOW = new THREE.Color(0x2d5a1e);
const COLOR_MID_LOW = new THREE.Color(0x4a8a2f);
const COLOR_MID = new THREE.Color(0x8a7a40);
const COLOR_HIGH = new THREE.Color(0x6b5b3a);
const COLOR_PEAK = new THREE.Color(0x7a7a7a);

const MAX_HEIGHT = 30;

function getHeightColor(h: number): THREE.Color {
  const t = Math.min(h / MAX_HEIGHT, 1);
  const color = new THREE.Color();

  if (t < 0.17) {
    color.copy(COLOR_LOW).lerp(COLOR_MID_LOW, t / 0.17);
  } else if (t < 0.5) {
    color.copy(COLOR_MID_LOW).lerp(COLOR_MID, (t - 0.17) / 0.33);
  } else if (t < 0.83) {
    color.copy(COLOR_MID).lerp(COLOR_HIGH, (t - 0.5) / 0.33);
  } else {
    color.copy(COLOR_HIGH).lerp(COLOR_PEAK, (t - 0.83) / 0.17);
  }

  return color;
}

function getBiomeColor(biomeIndex: number, heightT: number): THREE.Color {
  const palette = BIOME_COLORS[biomeIndex] ?? BIOME_COLORS[0];
  const color = new THREE.Color();
  color.copy(palette.base).lerp(palette.peak, heightT);
  return color;
}

export function HeightmapTerrain({ data, biomeData }: HeightmapTerrainProps) {
  const geometry = useMemo(() => {
    if (!data) return null;

    const { heightData, width, height, cellSize } = data;
    const worldWidth = width * cellSize;
    const worldHeight = height * cellSize;

    const geo = new THREE.PlaneGeometry(
      worldWidth, worldHeight,
      width - 1, height - 1,
    );

    // PlaneGeometry를 바닥(XZ)으로 회전
    geo.rotateX(-Math.PI / 2);

    const positions = geo.attributes.position;
    const colors = new Float32Array(positions.count * 3);
    const biomeGrid = biomeData?.grid;

    for (let i = 0; i < positions.count; i++) {
      const gx = i % width;
      const gy = Math.floor(i / width);
      const heightValue = heightData[gy * width + gx] || 0;

      // Y축에 heightmap 값 적용
      positions.setY(i, heightValue);

      // 바이옴 기반 or 높이 기반 vertex color
      const heightT = Math.min(heightValue / MAX_HEIGHT, 1);
      let c: THREE.Color;

      if (biomeGrid && biomeGrid.length > 0) {
        const biomeIdx = biomeGrid[gy * width + gx] ?? 0;
        c = getBiomeColor(biomeIdx, heightT);
      } else {
        c = getHeightColor(heightValue);
      }

      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    positions.needsUpdate = true;
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    return geo;
  }, [data, biomeData]);

  if (!data || !geometry) return null;

  return (
    <mesh
      geometry={geometry}
      position={[0, 0, 0]}
      receiveShadow
    >
      <meshStandardMaterial
        vertexColors
        roughness={0.9}
        metalness={0.05}
        flatShading={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
