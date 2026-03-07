'use client';

/**
 * HeightmapTerrain — v16 Phase 4 서버 동기화 지형 렌더링
 *
 * joined 이벤트에서 받은 heightmap 데이터를 디코딩(base64 → gunzip → Float32Array)한 후
 * Three.js PlaneGeometry + vertex displacement로 실제 3D 지형을 렌더링.
 *
 * 높이에 따른 vertex color:
 * - 낮은 지역 (0~5) = 짙은 녹색 (평지/풀밭)
 * - 중간 지역 (5~15) = 밝은 녹색 → 갈색
 * - 높은 지역 (15~30) = 갈색 → 회색 (바위/절벽)
 */

import { useMemo } from 'react';
import * as THREE from 'three';

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
}

// 높이별 색상 팔레트
const COLOR_LOW = new THREE.Color(0x2d5a1e);    // 짙은 녹색 (평지)
const COLOR_MID_LOW = new THREE.Color(0x4a8a2f); // 밝은 녹색
const COLOR_MID = new THREE.Color(0x8a7a40);      // 갈색빛
const COLOR_HIGH = new THREE.Color(0x6b5b3a);     // 진한 갈색
const COLOR_PEAK = new THREE.Color(0x7a7a7a);     // 회색 (바위)

const MAX_HEIGHT = 30;

function getHeightColor(h: number): THREE.Color {
  const t = Math.min(h / MAX_HEIGHT, 1);
  const color = new THREE.Color();

  if (t < 0.17) {
    // 0~5: 짙은 녹색
    color.copy(COLOR_LOW).lerp(COLOR_MID_LOW, t / 0.17);
  } else if (t < 0.5) {
    // 5~15: 밝은 녹색 → 갈색
    color.copy(COLOR_MID_LOW).lerp(COLOR_MID, (t - 0.17) / 0.33);
  } else if (t < 0.83) {
    // 15~25: 갈색 → 진한 갈색
    color.copy(COLOR_MID).lerp(COLOR_HIGH, (t - 0.5) / 0.33);
  } else {
    // 25~30: 진한 갈색 → 회색
    color.copy(COLOR_HIGH).lerp(COLOR_PEAK, (t - 0.83) / 0.17);
  }

  return color;
}

export function HeightmapTerrain({ data }: HeightmapTerrainProps) {
  const geometry = useMemo(() => {
    if (!data) return null;

    const { heightData, width, height, cellSize } = data;
    const worldWidth = width * cellSize;
    const worldHeight = height * cellSize;

    // PlaneGeometry: segments = grid cells
    // Three.js PlaneGeometry는 XY 평면 생성 → rotation으로 XZ 평면(바닥)으로 변환
    const geo = new THREE.PlaneGeometry(
      worldWidth, worldHeight,
      width - 1, height - 1,
    );

    // PlaneGeometry를 바닥(XZ)으로 회전 (-90도 X축)
    geo.rotateX(-Math.PI / 2);

    const positions = geo.attributes.position;
    const colors = new Float32Array(positions.count * 3);
    const color = new THREE.Color();

    for (let i = 0; i < positions.count; i++) {
      // PlaneGeometry vertex 순서: row-major (왼쪽→오른쪽, 위→아래)
      // 회전 후: X = 게임 X, Y = 높이, Z = 게임 Y
      const gx = i % width;
      const gy = Math.floor(i / width);

      const heightValue = heightData[gy * width + gx] || 0;

      // Y축(높이)에 heightmap 값 적용
      positions.setY(i, heightValue);

      // 높이 기반 vertex color
      const c = getHeightColor(heightValue);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    positions.needsUpdate = true;
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals(); // 조명 반응을 위한 법선 재계산

    return geo;
  }, [data]);

  if (!data || !geometry) return null;

  const worldWidth = data.width * data.cellSize;
  const worldHeight = data.height * data.cellSize;

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
