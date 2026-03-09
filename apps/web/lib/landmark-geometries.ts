/**
 * landmark-geometries.ts -- VoxelBox 데이터 구동 MC 랜드마크 (v20 Phase 3+4)
 *
 * 42 아키타입 geometry 정의:
 *   - 기존 20종 유지 + MOSQUE(DOME 리네임) + TERRACED_FIELD(TERRACE 리네임)
 *   - 폐지: MONOLITH, MESA, TILTED_TOWER 제거
 *   - 신규 19종 추가: 대륙/문화권별 고유 형태
 *   - VoxelBox[] 데이터 배열 → buildVoxelGeometry() → merged BufferGeometry
 *   - BlockType으로 블록별 MC 텍스처 + UV 아틀라스 리매핑 + 면별 밝기 vertex color
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { LandmarkArchetype } from './landmark-data';
import { BlockType } from './mc-blocks';
import { getBlockUV } from './mc-texture-atlas';
import type { BiomeType } from '@/components/game/iso/types';

// ─── 스케일 ───
const S = 1.8;

// ─── VoxelBox 인터페이스 ───

export interface VoxelBox {
  w: number; h: number; d: number; // 크기
  x: number; y: number; z: number; // 위치 (center)
  block: BlockType;                 // 블록 타입 (텍스처 결정)
  topBlock?: BlockType;             // 상면 다른 블록 (선택)
  rotY?: number;                    // Y축 회전 (라디안)
  rotZ?: number;                    // Z축 회전 (라디안)
}

// ─── 면별 밝기 상수 ───
// BoxGeometry 면 순서: +x, -x, +y, -y, +z, -z (각 4정점)
const FACE_BRIGHTNESS = [
  0.6,  // +x
  0.6,  // -x
  1.0,  // +y (top)
  0.5,  // -y (bottom)
  0.8,  // +z
  0.8,  // -z
];

// ─── v29 Phase 7G: 바이옴별 블록 치환 테이블 ───
// arctic/arid/tropical 바이옴에서 기본 블록을 바이옴 특화 블록으로 치환
// temperate, mediterranean, urban은 기본 블록 유지 (치환 없음)

const BIOME_BLOCK_MAP: Partial<Record<BiomeType, Partial<Record<BlockType, BlockType>>>> = {
  arctic: {
    [BlockType.STONE]: BlockType.SNOW_STONE,
    [BlockType.OAK_PLANKS]: BlockType.BIRCH_WOOD,
    [BlockType.BRICK]: BlockType.PACKED_ICE,
    [BlockType.QUARTZ]: BlockType.SNOW,
  },
  arid: {
    [BlockType.STONE]: BlockType.SANDSTONE,
    [BlockType.OAK_PLANKS]: BlockType.SAND_BRICK,
    [BlockType.BRICK]: BlockType.GLAZED_TERRACOTTA,
  },
  tropical: {
    [BlockType.STONE]: BlockType.MOSSY_STONE,
    [BlockType.OAK_PLANKS]: BlockType.MOSS_WOOD,
    [BlockType.QUARTZ]: BlockType.PRISMARINE,
  },
};

// ─── buildVoxelGeometry: VoxelBox[] -> merged BufferGeometry ───

export function buildVoxelGeometry(voxels: VoxelBox[], biome?: BiomeType): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  // v29 Phase 7G: 바이옴별 블록 치환 맵
  const blockMap = biome ? BIOME_BLOCK_MAP[biome] : undefined;

  for (const vox of voxels) {
    const geo = new THREE.BoxGeometry(vox.w, vox.h, vox.d);

    // v29 Phase 7G: 바이옴에 따라 블록 타입 치환
    const effectiveBlock = blockMap?.[vox.block] ?? vox.block;
    const effectiveTopBlock = vox.topBlock !== undefined
      ? (blockMap?.[vox.topBlock] ?? vox.topBlock)
      : undefined;

    // --- UV 리매핑: 기본 (0,0)-(1,1) -> 아틀라스 블록 셀 UV ---
    const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
    const uvArray = uv.array as Float32Array;

    const mainUV = getBlockUV(effectiveBlock);
    const topUV = effectiveTopBlock !== undefined ? getBlockUV(effectiveTopBlock) : null;

    // BoxGeometry 정점: 6면 x 4정점 = 24정점, UV 2개 per 정점
    // face 순서: +x(0-3), -x(4-7), +y(8-11), -y(12-15), +z(16-19), -z(20-23)
    for (let faceIdx = 0; faceIdx < 6; faceIdx++) {
      const blockUV = (faceIdx === 2 && topUV) ? topUV : mainUV;
      for (let v = 0; v < 4; v++) {
        const i = (faceIdx * 4 + v) * 2;
        // 기본 UV는 0 또는 1 -> 아틀라스 셀 범위로 리매핑
        const rawU = uvArray[i];
        const rawV = uvArray[i + 1];
        uvArray[i] = blockUV.u0 + rawU * (blockUV.u1 - blockUV.u0);
        uvArray[i + 1] = blockUV.v0 + rawV * (blockUV.v1 - blockUV.v0);
      }
    }
    uv.needsUpdate = true;

    // --- 면별 밝기 vertex color ---
    const colors = new Float32Array(24 * 3); // 24 vertices x RGB
    for (let faceIdx = 0; faceIdx < 6; faceIdx++) {
      const brightness = FACE_BRIGHTNESS[faceIdx];
      for (let v = 0; v < 4; v++) {
        const ci = (faceIdx * 4 + v) * 3;
        colors[ci] = brightness;
        colors[ci + 1] = brightness;
        colors[ci + 2] = brightness;
      }
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    // --- 회전 적용 ---
    if (vox.rotZ) geo.rotateZ(vox.rotZ);
    if (vox.rotY) geo.rotateY(vox.rotY);

    // --- 위치 이동 ---
    geo.translate(vox.x, vox.y, vox.z);

    parts.push(geo);
  }

  const merged = mergeGeometries(parts, false);
  parts.forEach(g => g.dispose());
  merged.computeVertexNormals();
  return merged;
}

// ════════════════════════════════════════════════════════════════
// 아키타입별 VoxelBox 데이터 (기존 20종 유지)
// ════════════════════════════════════════════════════════════════

/** TOWER: 에펠탑/도쿄타워 -- IRON(다리) + COPPER(바디) + IRON(안테나, 7A) */
const TOWER_VOXELS: VoxelBox[] = [
  { w: 0.2*S, h: 1.2*S, d: 0.2*S, x: -0.35*S, y: 0.55*S, z: -0.35*S, block: BlockType.IRON, rotZ: 0.15 },
  { w: 0.2*S, h: 1.2*S, d: 0.2*S, x: 0.35*S, y: 0.55*S, z: -0.35*S, block: BlockType.IRON, rotZ: -0.15 },
  { w: 0.2*S, h: 1.2*S, d: 0.2*S, x: -0.35*S, y: 0.55*S, z: 0.35*S, block: BlockType.IRON, rotZ: 0.15 },
  { w: 0.2*S, h: 1.2*S, d: 0.2*S, x: 0.35*S, y: 0.55*S, z: 0.35*S, block: BlockType.IRON, rotZ: -0.15 },
  { w: 0.7*S, h: 0.15*S, d: 0.7*S, x: 0, y: 1.0*S, z: 0, block: BlockType.COPPER },
  { w: 0.5*S, h: 0.8*S, d: 0.5*S, x: 0, y: 1.5*S, z: 0, block: BlockType.COPPER },
  { w: 0.35*S, h: 0.6*S, d: 0.35*S, x: 0, y: 2.2*S, z: 0, block: BlockType.COPPER },
  { w: 0.1*S, h: 0.8*S, d: 0.1*S, x: 0, y: 2.9*S, z: 0, block: BlockType.IRON },
  { w: 0.06*S, h: 0.4*S, d: 0.06*S, x: 0, y: 3.5*S, z: 0, block: BlockType.IRON },
];

/** PYRAMID: MC 계단식 피라미드 -- SANDSTONE(전체, 7A: 꼭대기도 사암 통일) */
function createPyramidVoxels(): VoxelBox[] {
  const p: VoxelBox[] = [];
  const layers = 5;
  for (let i = 0; i < layers; i++) {
    const w = (2.0 - i * 0.35) * S;
    const h = 0.4 * S;
    p.push({ w, h, d: w, x: 0, y: i * h + h / 2, z: 0, block: BlockType.SANDSTONE });
  }
  return p;
}
const PYRAMID_VOXELS = createPyramidVoxels();

/** MOSQUE (기존 DOME): MC 돔 모스크 -- QUARTZ(본체) + SANDSTONE(기단+팁, 7A) + QUARTZ(미나렛) */
const MOSQUE_VOXELS: VoxelBox[] = (() => {
  const p: VoxelBox[] = [];
  // 메인 빌딩 -- 사암 기단
  p.push({ w: 1.8*S, h: 0.7*S, d: 1.4*S, x: 0, y: 0.35*S, z: 0, block: BlockType.SANDSTONE });
  // 돔 (박스 계단으로 근사) -- 석영
  p.push({ w: 1.0*S, h: 0.3*S, d: 1.0*S, x: 0, y: 0.85*S, z: 0, block: BlockType.QUARTZ });
  p.push({ w: 0.7*S, h: 0.3*S, d: 0.7*S, x: 0, y: 1.15*S, z: 0, block: BlockType.QUARTZ });
  p.push({ w: 0.4*S, h: 0.25*S, d: 0.4*S, x: 0, y: 1.4*S, z: 0, block: BlockType.QUARTZ });
  // 돔 꼭대기 -- 사암 (7A: 이슬람 건축 = 모래톤)
  p.push({ w: 0.2*S, h: 0.2*S, d: 0.2*S, x: 0, y: 1.62*S, z: 0, block: BlockType.SANDSTONE });
  // 4 미나렛 -- 석영
  const mp: [number, number][] = [[-0.8, 0.4], [0.8, 0.4], [-0.8, -0.4], [0.8, -0.4]];
  for (const [px, pz] of mp) {
    p.push({ w: 0.15*S, h: 1.6*S, d: 0.15*S, x: px*S, y: 0.8*S, z: pz*S, block: BlockType.QUARTZ });
    p.push({ w: 0.2*S, h: 0.15*S, d: 0.2*S, x: px*S, y: 1.65*S, z: pz*S, block: BlockType.SANDSTONE });
  }
  return p;
})();

/** NEEDLE: MC 첨탑 -- IRON(샤프트) + QUARTZ(관측대) + DIAMOND(안테나) */
const NEEDLE_VOXELS: VoxelBox[] = [
  { w: 0.5*S, h: 0.3*S, d: 0.5*S, x: 0, y: 0.15*S, z: 0, block: BlockType.IRON },
  { w: 0.3*S, h: 1.5*S, d: 0.3*S, x: 0, y: 1.05*S, z: 0, block: BlockType.IRON },
  { w: 0.2*S, h: 1.0*S, d: 0.2*S, x: 0, y: 2.3*S, z: 0, block: BlockType.IRON },
  { w: 0.7*S, h: 0.15*S, d: 0.7*S, x: 0, y: 2.65*S, z: 0, block: BlockType.QUARTZ },
  { w: 0.5*S, h: 0.15*S, d: 0.5*S, x: 0, y: 2.8*S, z: 0, block: BlockType.QUARTZ },
  { w: 0.1*S, h: 1.0*S, d: 0.1*S, x: 0, y: 3.4*S, z: 0, block: BlockType.DIAMOND },
];

/** STATUE: MC 조각상 -- QUARTZ(받침대) + MOSSY_STONE(다리/몸통) + COPPER(팔/머리) + GOLD(횃불) */
const STATUE_VOXELS: VoxelBox[] = [
  { w: 0.9*S, h: 0.8*S, d: 0.9*S, x: 0, y: 0.4*S, z: 0, block: BlockType.QUARTZ },
  { w: 0.7*S, h: 0.2*S, d: 0.7*S, x: 0, y: 0.9*S, z: 0, block: BlockType.QUARTZ },
  { w: 0.25*S, h: 0.6*S, d: 0.25*S, x: -0.15*S, y: 1.3*S, z: 0, block: BlockType.MOSSY_STONE },
  { w: 0.25*S, h: 0.6*S, d: 0.25*S, x: 0.15*S, y: 1.3*S, z: 0, block: BlockType.MOSSY_STONE },
  { w: 0.5*S, h: 0.7*S, d: 0.3*S, x: 0, y: 1.95*S, z: 0, block: BlockType.MOSSY_STONE },
  { w: 0.2*S, h: 0.6*S, d: 0.2*S, x: -0.35*S, y: 2.0*S, z: 0, block: BlockType.COPPER },
  { w: 0.2*S, h: 0.8*S, d: 0.2*S, x: 0.35*S, y: 2.1*S, z: 0, block: BlockType.COPPER },
  { w: 0.3*S, h: 0.3*S, d: 0.3*S, x: 0, y: 2.45*S, z: 0, block: BlockType.COPPER },
  { w: 0.12*S, h: 0.3*S, d: 0.12*S, x: 0.35*S, y: 2.65*S, z: 0, block: BlockType.GOLD },
];

/** WALL: MC 만리장성 -- STONE(벽) + NETHER_BRICK(망루) + STONE(흉벽) */
const WALL_VOXELS: VoxelBox[] = (() => {
  const p: VoxelBox[] = [];
  p.push({ w: 1.0*S, h: 0.7*S, d: 0.25*S, x: -0.6*S, y: 0.35*S, z: -0.1*S, block: BlockType.STONE, rotY: 0.3 });
  p.push({ w: 1.0*S, h: 0.7*S, d: 0.25*S, x: 0.2*S, y: 0.35*S, z: 0.1*S, block: BlockType.STONE, rotY: -0.3 });
  p.push({ w: 0.8*S, h: 0.7*S, d: 0.25*S, x: 1.0*S, y: 0.35*S, z: -0.15*S, block: BlockType.STONE, rotY: 0.2 });
  p.push({ w: 0.4*S, h: 1.1*S, d: 0.4*S, x: -1.1*S, y: 0.55*S, z: -0.25*S, block: BlockType.NETHER_BRICK });
  p.push({ w: 0.4*S, h: 1.1*S, d: 0.4*S, x: 1.3*S, y: 0.55*S, z: 0.0*S, block: BlockType.NETHER_BRICK });
  for (let i = 0; i < 3; i++) {
    p.push({ w: 0.15*S, h: 0.2*S, d: 0.15*S, x: -1.1*S + i*0.15*S, y: 1.2*S, z: -0.25*S, block: BlockType.STONE });
    p.push({ w: 0.15*S, h: 0.2*S, d: 0.15*S, x: 1.15*S + i*0.15*S, y: 1.2*S, z: 0.0*S, block: BlockType.STONE });
  }
  return p;
})();

/** ARENA: MC 콜로세움 -- SANDSTONE(벽) + STONE(바닥) + QUARTZ(아치) */
const ARENA_VOXELS: VoxelBox[] = (() => {
  const p: VoxelBox[] = [];
  const w = 1.8*S, d = 1.4*S, h = 0.8*S, th = 0.2*S;
  p.push({ w, h, d: th, x: 0, y: h/2, z: d/2, block: BlockType.SANDSTONE });
  p.push({ w, h, d: th, x: 0, y: h/2, z: -d/2, block: BlockType.SANDSTONE });
  p.push({ w: th, h, d, x: w/2, y: h/2, z: 0, block: BlockType.SANDSTONE });
  p.push({ w: th, h, d, x: -w/2, y: h/2, z: 0, block: BlockType.SANDSTONE });
  p.push({ w: w-th*2, h: 0.1*S, d: d-th*2, x: 0, y: 0.05*S, z: 0, block: BlockType.STONE });
  for (let i = -3; i <= 3; i++) {
    p.push({ w: 0.15*S, h: 0.2*S, d: 0.12*S, x: i*0.22*S, y: h+0.1*S, z: d/2, block: BlockType.QUARTZ });
    p.push({ w: 0.15*S, h: 0.2*S, d: 0.12*S, x: i*0.22*S, y: h+0.1*S, z: -d/2, block: BlockType.QUARTZ });
  }
  return p;
})();

/** BRIDGE: MC 현수교 -- REDSTONE(타워) + IRON(도로) + IRON(케이블) */
const BRIDGE_VOXELS: VoxelBox[] = (() => {
  const p: VoxelBox[] = [];
  p.push({ w: 0.25*S, h: 2.5*S, d: 0.25*S, x: -1.0*S, y: 1.25*S, z: 0, block: BlockType.REDSTONE });
  p.push({ w: 0.25*S, h: 2.5*S, d: 0.25*S, x: 1.0*S, y: 1.25*S, z: 0, block: BlockType.REDSTONE });
  p.push({ w: 3.0*S, h: 0.12*S, d: 0.5*S, x: 0, y: 0.8*S, z: 0, block: BlockType.IRON });
  for (let i = -4; i <= 4; i++) {
    const x = i * 0.22 * S;
    const y = (2.3 - Math.abs(i) * 0.15) * S;
    p.push({ w: 0.06*S, h: 0.06*S, d: 0.06*S, x, y, z: 0.15*S, block: BlockType.IRON });
    p.push({ w: 0.06*S, h: 0.06*S, d: 0.06*S, x, y, z: -0.15*S, block: BlockType.IRON });
  }
  for (let i = -4; i <= 4; i++) {
    if (i === 0) continue;
    const x = i * 0.22 * S;
    const top = (2.3 - Math.abs(i) * 0.15) * S;
    p.push({ w: 0.04*S, h: top - 0.8*S, d: 0.04*S, x, y: (top + 0.8*S)/2, z: 0, block: BlockType.IRON });
  }
  return p;
})();

/** PAGODA: MC 파고다 -- NETHER_BRICK(처마/기와) + OAK_PLANKS(벽체) + GOLD(꼭대기) */
const PAGODA_VOXELS: VoxelBox[] = (() => {
  const p: VoxelBox[] = [];
  const tiers = 3;
  for (let i = 0; i < tiers; i++) {
    const w = (1.4 - i * 0.3) * S;
    const h = 0.45 * S;
    const y = i * 0.65 * S;
    p.push({ w: w * 0.8, h, d: w * 0.6, x: 0, y: y + h/2, z: 0, block: BlockType.OAK_PLANKS });
    p.push({ w: w * 1.2, h: 0.08*S, d: w * 0.9, x: 0, y: y + h + 0.04*S, z: 0, block: BlockType.NETHER_BRICK });
    p.push({ w: 0.1*S, h: 0.06*S, d: w * 0.9, x: -w*0.6, y: y + h + 0.1*S, z: 0, block: BlockType.NETHER_BRICK });
    p.push({ w: 0.1*S, h: 0.06*S, d: w * 0.9, x: w*0.6, y: y + h + 0.1*S, z: 0, block: BlockType.NETHER_BRICK });
  }
  p.push({ w: 0.1*S, h: 0.5*S, d: 0.1*S, x: 0, y: tiers * 0.65*S + 0.25*S, z: 0, block: BlockType.GOLD });
  return p;
})();

/** SHELLS: MC 오페라하우스 -- QUARTZ(전체 돛) + STONE(기단) */
const SHELLS_VOXELS: VoxelBox[] = (() => {
  const p: VoxelBox[] = [];
  p.push({ w: 2.2*S, h: 0.2*S, d: 1.0*S, x: 0, y: 0.1*S, z: 0, block: BlockType.STONE });
  for (let s = 0; s < 4; s++) {
    const xOff = (-0.6 + s * 0.4) * S;
    const maxH = 5 - s;
    for (let layer = 0; layer < maxH; layer++) {
      const w = (0.5 - layer * 0.08) * S;
      p.push({ w, h: 0.25*S, d: 0.3*S, x: xOff, y: 0.32*S + layer * 0.25*S, z: 0, block: BlockType.QUARTZ });
    }
  }
  return p;
})();

/** ONION_DOME: MC 성바실리 -- BRICK(본체) + COPPER(양파돔, 7A) + EMERALD(기둥) */
const ONION_DOME_VOXELS: VoxelBox[] = (() => {
  const p: VoxelBox[] = [];
  p.push({ w: 1.6*S, h: 0.8*S, d: 1.2*S, x: 0, y: 0.4*S, z: 0, block: BlockType.BRICK });
  const dp: [number, number, number][] = [[0, 0, 2.0], [-0.45, 0, 1.5], [0.45, 0, 1.5], [-0.25, 0.3, 1.3], [0.25, -0.3, 1.3]];
  for (const [dx, dz, maxH] of dp) {
    p.push({ w: 0.15*S, h: (maxH-0.5)*S, d: 0.15*S, x: dx*S, y: (maxH-0.5)*S/2 + 0.4*S, z: dz*S, block: BlockType.EMERALD });
    const bulbY = (maxH - 0.3) * S;
    p.push({ w: 0.2*S, h: 0.15*S, d: 0.2*S, x: dx*S, y: bulbY, z: dz*S, block: BlockType.COPPER });
    p.push({ w: 0.28*S, h: 0.12*S, d: 0.28*S, x: dx*S, y: bulbY + 0.12*S, z: dz*S, block: BlockType.COPPER });
    p.push({ w: 0.22*S, h: 0.12*S, d: 0.22*S, x: dx*S, y: bulbY + 0.24*S, z: dz*S, block: BlockType.COPPER });
    p.push({ w: 0.12*S, h: 0.1*S, d: 0.12*S, x: dx*S, y: bulbY + 0.34*S, z: dz*S, block: BlockType.COPPER });
    p.push({ w: 0.06*S, h: 0.12*S, d: 0.06*S, x: dx*S, y: bulbY + 0.45*S, z: dz*S, block: BlockType.COPPER });
  }
  return p;
})();

/** MOUNTAIN: MC 산 -- STONE(하부) + MOSSY_STONE(중부) + SNOW(상부) */
const MOUNTAIN_VOXELS: VoxelBox[] = (() => {
  const p: VoxelBox[] = [];
  const layers = 6;
  for (let i = 0; i < layers; i++) {
    const w = (2.5 - i * 0.4) * S;
    let block: BlockType;
    if (i < 2) block = BlockType.STONE;
    else if (i < 4) block = BlockType.MOSSY_STONE;
    else block = BlockType.SNOW;
    p.push({ w, h: 0.35*S, d: w * 0.8, x: 0, y: i * 0.35*S + 0.175*S, z: 0, block });
  }
  p.push({ w: 0.5*S, h: 0.25*S, d: 0.4*S, x: 0, y: layers * 0.35*S + 0.125*S, z: 0, block: BlockType.SNOW });
  return p;
})();

/** TWIN_TOWER: MC 쌍둥이 타워 -- IRON(타워) + GLASS(브릿지) + DIAMOND(첨탑) */
const TWIN_TOWER_VOXELS: VoxelBox[] = [
  { w: 0.5*S, h: 3.0*S, d: 0.5*S, x: -0.45*S, y: 1.5*S, z: 0, block: BlockType.IRON },
  { w: 0.5*S, h: 3.0*S, d: 0.5*S, x: 0.45*S, y: 1.5*S, z: 0, block: BlockType.IRON },
  { w: 0.4*S, h: 0.12*S, d: 0.25*S, x: 0, y: 2.0*S, z: 0, block: BlockType.GLASS },
  { w: 0.12*S, h: 0.6*S, d: 0.12*S, x: -0.45*S, y: 3.3*S, z: 0, block: BlockType.DIAMOND },
  { w: 0.12*S, h: 0.6*S, d: 0.12*S, x: 0.45*S, y: 3.3*S, z: 0, block: BlockType.DIAMOND },
];

/** BRIDGE_TOP: MC 마리나 베이 샌즈 -- IRON(타워) + GLASS(상판) + DIAMOND(수영장) */
const BRIDGE_TOP_VOXELS: VoxelBox[] = (() => {
  const p: VoxelBox[] = [];
  for (let i = -1; i <= 1; i++) {
    p.push({ w: 0.35*S, h: 2.5*S, d: 0.6*S, x: i * 0.6*S, y: 1.25*S, z: 0, block: BlockType.IRON });
  }
  p.push({ w: 2.4*S, h: 0.12*S, d: 0.8*S, x: 0, y: 2.6*S, z: 0, block: BlockType.GLASS });
  p.push({ w: 1.6*S, h: 0.06*S, d: 0.4*S, x: 0, y: 2.7*S, z: 0, block: BlockType.DIAMOND });
  return p;
})();

/** SPIRE_CLUSTER: MC 다중 첨탑 -- SANDSTONE(기단) + STONE(첨탑) + QUARTZ(꼭대기, 7A: 백색 돌) */
const SPIRE_CLUSTER_VOXELS: VoxelBox[] = (() => {
  const p: VoxelBox[] = [];
  p.push({ w: 1.4*S, h: 0.4*S, d: 1.0*S, x: 0, y: 0.2*S, z: 0, block: BlockType.SANDSTONE });
  const sd: [number, number, number][] = [[0, 2.8, 0.18], [-0.4, 2.0, 0.14], [0.4, 2.0, 0.14], [-0.2, 1.6, 0.12], [0.2, 1.6, 0.12]];
  for (const [dx, h, w] of sd) {
    p.push({ w: w*S, h: h*S, d: w*S, x: dx*S, y: h*S/2 + 0.4*S, z: 0, block: BlockType.STONE });
    p.push({ w: w*0.5*S, h: 0.2*S, d: w*0.5*S, x: dx*S, y: h*S + 0.5*S, z: 0, block: BlockType.QUARTZ });
  }
  return p;
})();

/** SKYSCRAPER: MC 고층빌딩 -- IRON(하부) + GLASS(중부) + IRON(상부) + DIAMOND(안테나) */
const SKYSCRAPER_VOXELS: VoxelBox[] = [
  { w: 1.0*S, h: 1.0*S, d: 0.8*S, x: 0, y: 0.5*S, z: 0, block: BlockType.IRON },
  { w: 0.75*S, h: 1.2*S, d: 0.6*S, x: 0, y: 1.6*S, z: 0, block: BlockType.GLASS },
  { w: 0.5*S, h: 1.0*S, d: 0.4*S, x: 0, y: 2.7*S, z: 0, block: BlockType.IRON },
  { w: 0.1*S, h: 0.6*S, d: 0.1*S, x: 0, y: 3.5*S, z: 0, block: BlockType.DIAMOND },
];

/** CLOCK_TOWER: MC 빅벤 -- SANDSTONE(타워) + COPPER(시계+지붕, 7A) + IRON(첨탑) */
const CLOCK_TOWER_VOXELS: VoxelBox[] = [
  { w: 0.6*S, h: 2.8*S, d: 0.6*S, x: 0, y: 1.4*S, z: 0, block: BlockType.SANDSTONE },
  { w: 0.75*S, h: 0.4*S, d: 0.75*S, x: 0, y: 2.5*S, z: 0, block: BlockType.COPPER },
  { w: 0.5*S, h: 0.3*S, d: 0.5*S, x: 0, y: 2.95*S, z: 0, block: BlockType.COPPER },
  { w: 0.35*S, h: 0.25*S, d: 0.35*S, x: 0, y: 3.2*S, z: 0, block: BlockType.COPPER },
  { w: 0.2*S, h: 0.2*S, d: 0.2*S, x: 0, y: 3.42*S, z: 0, block: BlockType.COPPER },
  { w: 0.1*S, h: 0.15*S, d: 0.1*S, x: 0, y: 3.6*S, z: 0, block: BlockType.IRON },
];

/** TEMPLE: MC 파르테논 -- QUARTZ(기단+기둥) + STONE(뒤벽) + EMERALD(지붕 상부, 7A) */
const TEMPLE_VOXELS: VoxelBox[] = (() => {
  const p: VoxelBox[] = [];
  p.push({ w: 2.0*S, h: 0.1*S, d: 1.2*S, x: 0, y: 0.05*S, z: 0, block: BlockType.QUARTZ });
  p.push({ w: 1.8*S, h: 0.1*S, d: 1.0*S, x: 0, y: 0.15*S, z: 0, block: BlockType.QUARTZ });
  for (let i = 0; i < 6; i++) {
    p.push({ w: 0.12*S, h: 1.2*S, d: 0.12*S, x: (-0.75 + i * 0.3)*S, y: 0.8*S, z: 0.35*S, block: BlockType.QUARTZ });
  }
  p.push({ w: 1.6*S, h: 1.0*S, d: 0.1*S, x: 0, y: 0.7*S, z: -0.35*S, block: BlockType.STONE });
  p.push({ w: 1.8*S, h: 0.15*S, d: 0.9*S, x: 0, y: 1.47*S, z: 0, block: BlockType.QUARTZ });
  p.push({ w: 1.3*S, h: 0.15*S, d: 0.6*S, x: 0, y: 1.62*S, z: 0, block: BlockType.EMERALD });
  p.push({ w: 0.7*S, h: 0.12*S, d: 0.4*S, x: 0, y: 1.74*S, z: 0, block: BlockType.EMERALD });
  return p;
})();

/** GATE: MC 개선문 -- SANDSTONE(기둥) + STONE(상부) + GOLD(장식) */
const GATE_VOXELS: VoxelBox[] = [
  { w: 0.4*S, h: 1.8*S, d: 0.4*S, x: -0.5*S, y: 0.9*S, z: 0, block: BlockType.SANDSTONE },
  { w: 0.4*S, h: 1.8*S, d: 0.4*S, x: 0.5*S, y: 0.9*S, z: 0, block: BlockType.SANDSTONE },
  { w: 1.6*S, h: 0.3*S, d: 0.5*S, x: 0, y: 2.0*S, z: 0, block: BlockType.STONE },
  { w: 0.6*S, h: 0.25*S, d: 0.35*S, x: 0, y: 1.55*S, z: 0, block: BlockType.STONE },
  { w: 0.5*S, h: 0.25*S, d: 0.3*S, x: 0, y: 2.3*S, z: 0, block: BlockType.STONE },
  { w: 0.15*S, h: 0.2*S, d: 0.15*S, x: 0, y: 2.55*S, z: 0, block: BlockType.STONE },
];

/** WINDMILL: MC 풍차 -- STONE(하부) + BRICK(중부) + OAK_PLANKS(상부) + DARK_OAK(날개) */
const WINDMILL_VOXELS: VoxelBox[] = [
  { w: 0.6*S, h: 0.7*S, d: 0.6*S, x: 0, y: 0.35*S, z: 0, block: BlockType.STONE },
  { w: 0.5*S, h: 0.7*S, d: 0.5*S, x: 0, y: 1.05*S, z: 0, block: BlockType.BRICK },
  { w: 0.4*S, h: 0.5*S, d: 0.4*S, x: 0, y: 1.6*S, z: 0, block: BlockType.OAK_PLANKS },
  { w: 0.5*S, h: 0.15*S, d: 0.5*S, x: 0, y: 1.92*S, z: 0, block: BlockType.OAK_PLANKS },
  { w: 0.3*S, h: 0.12*S, d: 0.3*S, x: 0, y: 2.05*S, z: 0, block: BlockType.OAK_PLANKS },
  { w: 0.12*S, h: 1.2*S, d: 0.04*S, x: 0, y: 1.5*S, z: 0.3*S, block: BlockType.DARK_OAK },
  { w: 1.2*S, h: 0.12*S, d: 0.04*S, x: 0, y: 1.5*S, z: 0.3*S, block: BlockType.DARK_OAK },
];

/** CASTLE: MC 성 -- STONE(본체) + NETHER_BRICK(타워) + COPPER(지붕) */
const CASTLE_VOXELS: VoxelBox[] = (() => {
  const p: VoxelBox[] = [];
  p.push({ w: 1.2*S, h: 1.2*S, d: 0.8*S, x: 0, y: 0.6*S, z: 0, block: BlockType.STONE });
  for (let i = -2; i <= 2; i++) {
    p.push({ w: 0.18*S, h: 0.2*S, d: 0.18*S, x: i*0.25*S, y: 1.3*S, z: 0.3*S, block: BlockType.STONE });
    p.push({ w: 0.18*S, h: 0.2*S, d: 0.18*S, x: i*0.25*S, y: 1.3*S, z: -0.3*S, block: BlockType.STONE });
  }
  const tp: [number, number][] = [[-0.5, 0], [0.5, 0], [0, -0.3]];
  for (const [tx, tz] of tp) {
    p.push({ w: 0.35*S, h: 2.0*S, d: 0.35*S, x: tx*S, y: 1.0*S, z: tz*S, block: BlockType.NETHER_BRICK });
    p.push({ w: 0.4*S, h: 0.15*S, d: 0.4*S, x: tx*S, y: 2.1*S, z: tz*S, block: BlockType.COPPER });
    p.push({ w: 0.3*S, h: 0.12*S, d: 0.3*S, x: tx*S, y: 2.24*S, z: tz*S, block: BlockType.COPPER });
    p.push({ w: 0.18*S, h: 0.12*S, d: 0.18*S, x: tx*S, y: 2.36*S, z: tz*S, block: BlockType.COPPER });
  }
  return p;
})();

/** STONE_RING: MC 스톤헨지 -- MOSSY_STONE(석판) + STONE(린텔) */
const STONE_RING_VOXELS: VoxelBox[] = (() => {
  const p: VoxelBox[] = [];
  const count = 8;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const x = Math.cos(angle) * 0.8 * S;
    const z = Math.sin(angle) * 0.8 * S;
    const h = (0.6 + (i % 3) * 0.15) * S;
    p.push({ w: 0.2*S, h, d: 0.12*S, x, y: h/2, z, block: BlockType.MOSSY_STONE, rotY: -angle });
  }
  p.push({ w: 0.55*S, h: 0.12*S, d: 0.15*S, x: 0.65*S, y: 0.75*S, z: 0.35*S, block: BlockType.STONE });
  p.push({ w: 0.55*S, h: 0.12*S, d: 0.15*S, x: -0.65*S, y: 0.7*S, z: -0.35*S, block: BlockType.STONE });
  return p;
})();

/** OBELISK: MC 오벨리스크 -- SANDSTONE(기단) + QUARTZ(몸통) + STONE(피라미디온, 7A) */
const OBELISK_VOXELS: VoxelBox[] = [
  { w: 0.5*S, h: 0.3*S, d: 0.5*S, x: 0, y: 0.15*S, z: 0, block: BlockType.SANDSTONE },
  { w: 0.35*S, h: 3.0*S, d: 0.35*S, x: 0, y: 1.8*S, z: 0, block: BlockType.QUARTZ },
  { w: 0.3*S, h: 0.15*S, d: 0.3*S, x: 0, y: 3.37*S, z: 0, block: BlockType.STONE },
  { w: 0.2*S, h: 0.12*S, d: 0.2*S, x: 0, y: 3.5*S, z: 0, block: BlockType.STONE },
  { w: 0.1*S, h: 0.1*S, d: 0.1*S, x: 0, y: 3.61*S, z: 0, block: BlockType.STONE },
];

/** TERRACED_FIELD (기존 TERRACE): MC 계단식 논/유적 -- GRASS_TOP(상면, topBlock) + STONE(계단) + OAK_PLANKS(건물) */
const TERRACED_FIELD_VOXELS: VoxelBox[] = (() => {
  const p: VoxelBox[] = [];
  for (let i = 0; i < 5; i++) {
    const w = (2.2 - i * 0.35) * S;
    const d = (1.0 - i * 0.08) * S;
    p.push({ w, h: 0.25*S, d, x: i * 0.1*S, y: i * 0.28*S + 0.125*S, z: 0, block: BlockType.STONE, topBlock: BlockType.GRASS_TOP });
  }
  p.push({ w: 0.3*S, h: 0.4*S, d: 0.25*S, x: 0.4*S, y: 5*0.28*S + 0.2*S, z: 0, block: BlockType.OAK_PLANKS });
  return p;
})();

// ════════════════════════════════════════════════════════════════
// 신규 19종 아키타입 VoxelBox 데이터
// ════════════════════════════════════════════════════════════════

// ─── 아프리카 5종 ───

/** MUD_TOWER: 서아프리카 진흙 첨탑 -- CLAY(벽) + OAK_LOG(빔 돌출) + TERRACOTTA(상부) */
const MUD_TOWER_VOXELS: VoxelBox[] = (() => {
  const p: VoxelBox[] = [];
  // 기단 -- 점토
  p.push({ w: 1.0*S, h: 0.4*S, d: 0.8*S, x: 0, y: 0.2*S, z: 0, block: BlockType.CLAY });
  // 메인 타워 -- 점토 (좁아지는 형태)
  p.push({ w: 0.6*S, h: 1.2*S, d: 0.5*S, x: 0, y: 1.0*S, z: 0, block: BlockType.CLAY });
  p.push({ w: 0.5*S, h: 0.8*S, d: 0.4*S, x: 0, y: 2.0*S, z: 0, block: BlockType.CLAY });
  // 상부 -- 테라코타
  p.push({ w: 0.4*S, h: 0.5*S, d: 0.35*S, x: 0, y: 2.65*S, z: 0, block: BlockType.TERRACOTTA });
  p.push({ w: 0.25*S, h: 0.3*S, d: 0.2*S, x: 0, y: 3.05*S, z: 0, block: BlockType.TERRACOTTA });
  // 나무 빔 돌출 (토고나 양식) -- 오크 원목
  p.push({ w: 0.08*S, h: 0.08*S, d: 0.35*S, x: -0.25*S, y: 1.3*S, z: 0, block: BlockType.OAK_LOG });
  p.push({ w: 0.08*S, h: 0.08*S, d: 0.35*S, x: 0.25*S, y: 1.3*S, z: 0, block: BlockType.OAK_LOG });
  p.push({ w: 0.08*S, h: 0.08*S, d: 0.35*S, x: -0.2*S, y: 1.8*S, z: 0, block: BlockType.OAK_LOG });
  p.push({ w: 0.08*S, h: 0.08*S, d: 0.35*S, x: 0.2*S, y: 1.8*S, z: 0, block: BlockType.OAK_LOG });
  p.push({ w: 0.08*S, h: 0.08*S, d: 0.35*S, x: 0, y: 2.3*S, z: 0, block: BlockType.OAK_LOG });
  return p;
})();

/** THATCHED_HUT: 남아프리카 원형 초가집 (론다벨) -- CLAY(벽) + HAY(지붕) */
const THATCHED_HUT_VOXELS: VoxelBox[] = (() => {
  const p: VoxelBox[] = [];
  // 원형 벽 (8각형 박스 근사) -- 점토
  const wallR = 0.5;
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const x = Math.cos(angle) * wallR * S;
    const z = Math.sin(angle) * wallR * S;
    p.push({ w: 0.35*S, h: 0.6*S, d: 0.15*S, x, y: 0.3*S, z, block: BlockType.CLAY, rotY: -angle });
  }
  // 원추형 지붕 (계단) -- 건초
  p.push({ w: 1.2*S, h: 0.2*S, d: 1.2*S, x: 0, y: 0.7*S, z: 0, block: BlockType.HAY });
  p.push({ w: 0.9*S, h: 0.2*S, d: 0.9*S, x: 0, y: 0.9*S, z: 0, block: BlockType.HAY });
  p.push({ w: 0.5*S, h: 0.2*S, d: 0.5*S, x: 0, y: 1.1*S, z: 0, block: BlockType.HAY });
  p.push({ w: 0.2*S, h: 0.15*S, d: 0.2*S, x: 0, y: 1.28*S, z: 0, block: BlockType.HAY });
  return p;
})();

/** FORT: 서아프리카 해안 요새 -- QUARTZ(벽) + NETHER_BRICK(지붕) + IRON(대포) */
const FORT_VOXELS: VoxelBox[] = (() => {
  const p: VoxelBox[] = [];
  // 사각 요새 본체 -- 석영
  p.push({ w: 1.6*S, h: 0.8*S, d: 1.2*S, x: 0, y: 0.4*S, z: 0, block: BlockType.QUARTZ });
  // 4개 포탑 -- 석영 + 네더 벽돌 지붕
  const corners: [number, number][] = [[-0.65, -0.45], [0.65, -0.45], [-0.65, 0.45], [0.65, 0.45]];
  for (const [cx, cz] of corners) {
    p.push({ w: 0.3*S, h: 1.2*S, d: 0.3*S, x: cx*S, y: 0.6*S, z: cz*S, block: BlockType.QUARTZ });
    p.push({ w: 0.35*S, h: 0.15*S, d: 0.35*S, x: cx*S, y: 1.28*S, z: cz*S, block: BlockType.NETHER_BRICK });
    p.push({ w: 0.25*S, h: 0.12*S, d: 0.25*S, x: cx*S, y: 1.4*S, z: cz*S, block: BlockType.NETHER_BRICK });
  }
  // 대포 (2개) -- 철
  p.push({ w: 0.08*S, h: 0.08*S, d: 0.3*S, x: -0.3*S, y: 0.85*S, z: 0.7*S, block: BlockType.IRON });
  p.push({ w: 0.08*S, h: 0.08*S, d: 0.3*S, x: 0.3*S, y: 0.85*S, z: 0.7*S, block: BlockType.IRON });
  return p;
})();

/** MINARET: 북아프리카 미나렛 -- SANDSTONE(본체) + TERRACOTTA(장식) + GOLD(첨탑) */
const MINARET_VOXELS: VoxelBox[] = (() => {
  const p: VoxelBox[] = [];
  // 기단 -- 사암
  p.push({ w: 0.6*S, h: 0.3*S, d: 0.6*S, x: 0, y: 0.15*S, z: 0, block: BlockType.SANDSTONE });
  // 본체 (정사각 단면, 좁아지는 형태) -- 사암
  p.push({ w: 0.5*S, h: 1.5*S, d: 0.5*S, x: 0, y: 1.05*S, z: 0, block: BlockType.SANDSTONE });
  p.push({ w: 0.4*S, h: 1.0*S, d: 0.4*S, x: 0, y: 2.3*S, z: 0, block: BlockType.SANDSTONE });
  // 테라코타 장식 띠
  p.push({ w: 0.55*S, h: 0.1*S, d: 0.55*S, x: 0, y: 1.0*S, z: 0, block: BlockType.TERRACOTTA });
  p.push({ w: 0.45*S, h: 0.1*S, d: 0.45*S, x: 0, y: 2.0*S, z: 0, block: BlockType.TERRACOTTA });
  // 상부 발코니 -- 사암
  p.push({ w: 0.55*S, h: 0.12*S, d: 0.55*S, x: 0, y: 2.85*S, z: 0, block: BlockType.SANDSTONE });
  // 상부 좁은 탑 -- 사암
  p.push({ w: 0.25*S, h: 0.5*S, d: 0.25*S, x: 0, y: 3.16*S, z: 0, block: BlockType.SANDSTONE });
  // 첨탑 -- 사암 (7A: 이슬람 건축 = 모래톤)
  p.push({ w: 0.12*S, h: 0.3*S, d: 0.12*S, x: 0, y: 3.56*S, z: 0, block: BlockType.SANDSTONE });
  return p;
})();

/** BAOBAB: 동아프리카/마다가스카르 바오밥 나무 -- OAK_LOG(줄기) + LEAVES(수관) */
const BAOBAB_VOXELS: VoxelBox[] = (() => {
  const p: VoxelBox[] = [];
  // 굵은 줄기 -- 오크 원목
  p.push({ w: 0.7*S, h: 0.5*S, d: 0.7*S, x: 0, y: 0.25*S, z: 0, block: BlockType.OAK_LOG });
  p.push({ w: 0.6*S, h: 0.8*S, d: 0.6*S, x: 0, y: 0.9*S, z: 0, block: BlockType.OAK_LOG });
  p.push({ w: 0.5*S, h: 0.6*S, d: 0.5*S, x: 0, y: 1.6*S, z: 0, block: BlockType.OAK_LOG });
  // 가지 -- 오크 원목
  p.push({ w: 0.15*S, h: 0.4*S, d: 0.15*S, x: -0.35*S, y: 2.1*S, z: 0, block: BlockType.OAK_LOG, rotZ: 0.4 });
  p.push({ w: 0.15*S, h: 0.4*S, d: 0.15*S, x: 0.35*S, y: 2.1*S, z: 0, block: BlockType.OAK_LOG, rotZ: -0.4 });
  p.push({ w: 0.15*S, h: 0.4*S, d: 0.15*S, x: 0, y: 2.1*S, z: 0.3*S, block: BlockType.OAK_LOG, rotZ: 0.3 });
  // 넓은 수관 -- 잎 블록
  p.push({ w: 1.6*S, h: 0.3*S, d: 1.6*S, x: 0, y: 2.25*S, z: 0, block: BlockType.LEAVES });
  p.push({ w: 1.8*S, h: 0.25*S, d: 1.8*S, x: 0, y: 2.5*S, z: 0, block: BlockType.LEAVES });
  p.push({ w: 1.4*S, h: 0.2*S, d: 1.4*S, x: 0, y: 2.7*S, z: 0, block: BlockType.LEAVES });
  return p;
})();

// ─── 아시아 5종 ───

/** STUPA: 불교 스투파 -- QUARTZ(돔+기단, 7A: 백색 돌) + DIAMOND(첨탑) */
const STUPA_VOXELS: VoxelBox[] = (() => {
  const p: VoxelBox[] = [];
  // 기단 (3단) -- 석영
  p.push({ w: 1.4*S, h: 0.2*S, d: 1.4*S, x: 0, y: 0.1*S, z: 0, block: BlockType.QUARTZ });
  p.push({ w: 1.2*S, h: 0.2*S, d: 1.2*S, x: 0, y: 0.3*S, z: 0, block: BlockType.QUARTZ });
  p.push({ w: 1.0*S, h: 0.2*S, d: 1.0*S, x: 0, y: 0.5*S, z: 0, block: BlockType.QUARTZ });
  // 반구 돔 (계단 근사) -- 석영 (7A: 백색 돌 스투파)
  p.push({ w: 0.9*S, h: 0.3*S, d: 0.9*S, x: 0, y: 0.75*S, z: 0, block: BlockType.QUARTZ });
  p.push({ w: 0.7*S, h: 0.3*S, d: 0.7*S, x: 0, y: 1.05*S, z: 0, block: BlockType.QUARTZ });
  p.push({ w: 0.5*S, h: 0.25*S, d: 0.5*S, x: 0, y: 1.3*S, z: 0, block: BlockType.QUARTZ });
  p.push({ w: 0.3*S, h: 0.2*S, d: 0.3*S, x: 0, y: 1.5*S, z: 0, block: BlockType.QUARTZ });
  // 하르미카 (상부 사각 박스) -- 석영
  p.push({ w: 0.25*S, h: 0.2*S, d: 0.25*S, x: 0, y: 1.7*S, z: 0, block: BlockType.QUARTZ });
  // 첨탑 -- 다이아몬드
  p.push({ w: 0.12*S, h: 0.6*S, d: 0.12*S, x: 0, y: 2.1*S, z: 0, block: BlockType.DIAMOND });
  p.push({ w: 0.06*S, h: 0.15*S, d: 0.06*S, x: 0, y: 2.48*S, z: 0, block: BlockType.DIAMOND });
  return p;
})();

/** TORII: 일본 토리이 -- RED_BRICK(기둥+가로보) */
const TORII_VOXELS: VoxelBox[] = [
  // 두 기둥 -- 적벽돌 (주홍)
  { w: 0.15*S, h: 2.0*S, d: 0.15*S, x: -0.6*S, y: 1.0*S, z: 0, block: BlockType.RED_BRICK },
  { w: 0.15*S, h: 2.0*S, d: 0.15*S, x: 0.6*S, y: 1.0*S, z: 0, block: BlockType.RED_BRICK },
  // 상부 가로보 (카사기) -- 적벽돌
  { w: 1.6*S, h: 0.12*S, d: 0.2*S, x: 0, y: 2.1*S, z: 0, block: BlockType.RED_BRICK },
  // 하부 가로보 (누키) -- 적벽돌
  { w: 1.3*S, h: 0.08*S, d: 0.12*S, x: 0, y: 1.7*S, z: 0, block: BlockType.RED_BRICK },
  // 상부 처마 살짝 올림 -- 적벽돌
  { w: 1.7*S, h: 0.08*S, d: 0.15*S, x: 0, y: 2.22*S, z: 0, block: BlockType.RED_BRICK },
];

/** WAT: 태국 왓 프랑 탑 -- GOLD(프랑탑) + EMERALD(기단) + QUARTZ(벽) */
const WAT_VOXELS: VoxelBox[] = (() => {
  const p: VoxelBox[] = [];
  // 계단 기단 -- 에메랄드
  p.push({ w: 1.6*S, h: 0.2*S, d: 1.2*S, x: 0, y: 0.1*S, z: 0, block: BlockType.EMERALD });
  p.push({ w: 1.3*S, h: 0.2*S, d: 1.0*S, x: 0, y: 0.3*S, z: 0, block: BlockType.EMERALD });
  // 본전 -- 석영
  p.push({ w: 1.0*S, h: 0.5*S, d: 0.8*S, x: 0, y: 0.75*S, z: 0, block: BlockType.QUARTZ });
  // 프랑 (뾰족 탑) -- 골드 (좁아지는 적층)
  p.push({ w: 0.5*S, h: 0.4*S, d: 0.5*S, x: 0, y: 1.2*S, z: 0, block: BlockType.GOLD });
  p.push({ w: 0.4*S, h: 0.4*S, d: 0.4*S, x: 0, y: 1.6*S, z: 0, block: BlockType.GOLD });
  p.push({ w: 0.3*S, h: 0.35*S, d: 0.3*S, x: 0, y: 1.98*S, z: 0, block: BlockType.GOLD });
  p.push({ w: 0.2*S, h: 0.3*S, d: 0.2*S, x: 0, y: 2.3*S, z: 0, block: BlockType.GOLD });
  p.push({ w: 0.12*S, h: 0.25*S, d: 0.12*S, x: 0, y: 2.58*S, z: 0, block: BlockType.GOLD });
  p.push({ w: 0.06*S, h: 0.2*S, d: 0.06*S, x: 0, y: 2.8*S, z: 0, block: BlockType.GOLD });
  // 작은 프랑 양쪽 -- 골드
  p.push({ w: 0.2*S, h: 0.6*S, d: 0.2*S, x: -0.5*S, y: 1.3*S, z: 0, block: BlockType.GOLD });
  p.push({ w: 0.12*S, h: 0.3*S, d: 0.12*S, x: -0.5*S, y: 1.75*S, z: 0, block: BlockType.GOLD });
  p.push({ w: 0.2*S, h: 0.6*S, d: 0.2*S, x: 0.5*S, y: 1.3*S, z: 0, block: BlockType.GOLD });
  p.push({ w: 0.12*S, h: 0.3*S, d: 0.12*S, x: 0.5*S, y: 1.75*S, z: 0, block: BlockType.GOLD });
  return p;
})();

/** GOPURAM: 인도 남부 사원탑 -- 다색 TERRACOTTA + SANDSTONE + GOLD */
const GOPURAM_VOXELS: VoxelBox[] = (() => {
  const p: VoxelBox[] = [];
  // 기단 -- 사암
  p.push({ w: 1.4*S, h: 0.3*S, d: 0.8*S, x: 0, y: 0.15*S, z: 0, block: BlockType.SANDSTONE });
  // 층층 탑 (직사각 피라미드) -- 테라코타 / 사암 교대
  const layers = 6;
  for (let i = 0; i < layers; i++) {
    const w = (1.2 - i * 0.15) * S;
    const d = (0.7 - i * 0.06) * S;
    const h = 0.35 * S;
    const block = i % 2 === 0 ? BlockType.TERRACOTTA : BlockType.SANDSTONE;
    p.push({ w, h, d, x: 0, y: 0.3*S + i * h + h/2, z: 0, block });
    // 각 층 양쪽 소형 탑 장식 -- 테라코타
    if (i < 4) {
      p.push({ w: 0.1*S, h: h * 0.8, d: 0.1*S, x: -(w/2 + 0.08*S), y: 0.3*S + i * h + h/2, z: 0, block: BlockType.TERRACOTTA });
      p.push({ w: 0.1*S, h: h * 0.8, d: 0.1*S, x: (w/2 + 0.08*S), y: 0.3*S + i * h + h/2, z: 0, block: BlockType.TERRACOTTA });
    }
  }
  // 꼭대기 -- 테라코타 (7A: 인도 사원 = 테라코타 색)
  p.push({ w: 0.3*S, h: 0.2*S, d: 0.25*S, x: 0, y: 0.3*S + layers * 0.35*S + 0.1*S, z: 0, block: BlockType.TERRACOTTA });
  p.push({ w: 0.12*S, h: 0.15*S, d: 0.12*S, x: 0, y: 0.3*S + layers * 0.35*S + 0.28*S, z: 0, block: BlockType.TERRACOTTA });
  return p;
})();

/** YURT: 중앙아시아 유목 게르 -- WOOL(벽+지붕) + OAK_PLANKS(문틀) */
const YURT_VOXELS: VoxelBox[] = [
  // 원통 벽 (사각 근사) -- 양모
  { w: 1.0*S, h: 0.5*S, d: 1.0*S, x: 0, y: 0.25*S, z: 0, block: BlockType.WOOL },
  // 반구 지붕 (계단) -- 양모
  { w: 1.1*S, h: 0.15*S, d: 1.1*S, x: 0, y: 0.58*S, z: 0, block: BlockType.WOOL },
  { w: 0.8*S, h: 0.15*S, d: 0.8*S, x: 0, y: 0.73*S, z: 0, block: BlockType.WOOL },
  { w: 0.5*S, h: 0.12*S, d: 0.5*S, x: 0, y: 0.86*S, z: 0, block: BlockType.WOOL },
  { w: 0.25*S, h: 0.1*S, d: 0.25*S, x: 0, y: 0.97*S, z: 0, block: BlockType.WOOL },
  // 문틀 -- 오크 판자
  { w: 0.2*S, h: 0.4*S, d: 0.08*S, x: 0, y: 0.2*S, z: 0.52*S, block: BlockType.OAK_PLANKS },
];

// ─── 유럽 4종 ───

/** CATHEDRAL: 고딕 대성당 -- STONE(벽) + GLASS(창) + COPPER(지붕) + GOLD(첨탑) */
const CATHEDRAL_VOXELS: VoxelBox[] = (() => {
  const p: VoxelBox[] = [];
  // 본체 -- 돌
  p.push({ w: 1.2*S, h: 1.2*S, d: 1.8*S, x: 0, y: 0.6*S, z: 0, block: BlockType.STONE });
  // 지붕 (삼각 근사) -- 구리
  p.push({ w: 1.0*S, h: 0.3*S, d: 1.6*S, x: 0, y: 1.35*S, z: 0, block: BlockType.COPPER });
  p.push({ w: 0.6*S, h: 0.25*S, d: 1.4*S, x: 0, y: 1.62*S, z: 0, block: BlockType.COPPER });
  p.push({ w: 0.2*S, h: 0.15*S, d: 1.2*S, x: 0, y: 1.82*S, z: 0, block: BlockType.COPPER });
  // 쌍탑 전면 -- 돌
  p.push({ w: 0.3*S, h: 2.2*S, d: 0.3*S, x: -0.45*S, y: 1.1*S, z: 0.8*S, block: BlockType.STONE });
  p.push({ w: 0.3*S, h: 2.2*S, d: 0.3*S, x: 0.45*S, y: 1.1*S, z: 0.8*S, block: BlockType.STONE });
  // 첨탑 -- 구리 (7A: 유럽 성당 = 구리 지붕 녹청)
  p.push({ w: 0.15*S, h: 0.6*S, d: 0.15*S, x: -0.45*S, y: 2.5*S, z: 0.8*S, block: BlockType.COPPER });
  p.push({ w: 0.15*S, h: 0.6*S, d: 0.15*S, x: 0.45*S, y: 2.5*S, z: 0.8*S, block: BlockType.COPPER });
  // 중앙 첨탑 -- 구리 (7A)
  p.push({ w: 0.1*S, h: 0.5*S, d: 0.1*S, x: 0, y: 2.15*S, z: 0, block: BlockType.COPPER });
  // 장미창 (전면) -- 유리
  p.push({ w: 0.4*S, h: 0.4*S, d: 0.06*S, x: 0, y: 1.0*S, z: 0.93*S, block: BlockType.GLASS });
  // 측면 창 -- 유리
  p.push({ w: 0.06*S, h: 0.5*S, d: 0.3*S, x: -0.63*S, y: 0.8*S, z: 0, block: BlockType.GLASS });
  p.push({ w: 0.06*S, h: 0.5*S, d: 0.3*S, x: 0.63*S, y: 0.8*S, z: 0, block: BlockType.GLASS });
  // 플라잉 버트레스 (양쪽 지지대) -- 돌
  p.push({ w: 0.1*S, h: 0.8*S, d: 0.15*S, x: -0.72*S, y: 0.5*S, z: -0.3*S, block: BlockType.STONE, rotZ: 0.2 });
  p.push({ w: 0.1*S, h: 0.8*S, d: 0.15*S, x: 0.72*S, y: 0.5*S, z: -0.3*S, block: BlockType.STONE, rotZ: -0.2 });
  return p;
})();

/** FORTRESS: 동남유럽 요새 -- STONE(벽) + NETHER_BRICK(타워) + OBSIDIAN+MOSSY_STONE(기단, 7A) */
const FORTRESS_VOXELS: VoxelBox[] = (() => {
  const p: VoxelBox[] = [];
  // 최하 기단 -- 흑요석 (7A: 미사용 블록 활성화)
  p.push({ w: 1.9*S, h: 0.15*S, d: 1.5*S, x: 0, y: 0.075*S, z: 0, block: BlockType.OBSIDIAN });
  // 이끼 기단 -- 이끼 낀 돌
  p.push({ w: 1.8*S, h: 0.3*S, d: 1.4*S, x: 0, y: 0.3*S, z: 0, block: BlockType.MOSSY_STONE });
  // 육중한 성벽 (4면) -- 돌
  const ww = 1.6, dd = 1.2, hh = 1.0, th = 0.25;
  p.push({ w: ww*S, h: hh*S, d: th*S, x: 0, y: 0.8*S, z: dd/2*S, block: BlockType.STONE });
  p.push({ w: ww*S, h: hh*S, d: th*S, x: 0, y: 0.8*S, z: -dd/2*S, block: BlockType.STONE });
  p.push({ w: th*S, h: hh*S, d: dd*S, x: ww/2*S, y: 0.8*S, z: 0, block: BlockType.STONE });
  p.push({ w: th*S, h: hh*S, d: dd*S, x: -ww/2*S, y: 0.8*S, z: 0, block: BlockType.STONE });
  // 4 둥근 타워 (박스 근사) -- 네더 벽돌
  const fc: [number, number][] = [[-0.7, -0.5], [0.7, -0.5], [-0.7, 0.5], [0.7, 0.5]];
  for (const [fx, fz] of fc) {
    p.push({ w: 0.35*S, h: 1.5*S, d: 0.35*S, x: fx*S, y: 1.05*S, z: fz*S, block: BlockType.NETHER_BRICK });
    // 흉벽 -- 돌
    p.push({ w: 0.15*S, h: 0.15*S, d: 0.15*S, x: fx*S, y: 1.88*S, z: fz*S, block: BlockType.STONE });
  }
  // 내부 탑 -- 네더 벽돌
  p.push({ w: 0.4*S, h: 1.8*S, d: 0.4*S, x: 0, y: 1.2*S, z: 0, block: BlockType.NETHER_BRICK });
  p.push({ w: 0.2*S, h: 0.15*S, d: 0.2*S, x: 0, y: 2.18*S, z: 0, block: BlockType.STONE });
  return p;
})();

/** VIKING_SHIP: 북유럽 바이킹 롱쉽 -- OAK_PLANKS(선체) + WOOL(돛) + DARK_OAK(용머리) */
const VIKING_SHIP_VOXELS: VoxelBox[] = (() => {
  const p: VoxelBox[] = [];
  // 선체 용골 (아래로 좁아짐) -- 오크 판자
  p.push({ w: 2.0*S, h: 0.12*S, d: 0.6*S, x: 0, y: 0.06*S, z: 0, block: BlockType.OAK_PLANKS });
  p.push({ w: 2.2*S, h: 0.15*S, d: 0.7*S, x: 0, y: 0.2*S, z: 0, block: BlockType.OAK_PLANKS });
  p.push({ w: 2.4*S, h: 0.12*S, d: 0.8*S, x: 0, y: 0.33*S, z: 0, block: BlockType.OAK_PLANKS });
  // 선체 측면 (양쪽 높은 벽) -- 오크 판자
  p.push({ w: 2.2*S, h: 0.3*S, d: 0.1*S, x: 0, y: 0.54*S, z: 0.35*S, block: BlockType.OAK_PLANKS });
  p.push({ w: 2.2*S, h: 0.3*S, d: 0.1*S, x: 0, y: 0.54*S, z: -0.35*S, block: BlockType.OAK_PLANKS });
  // 용머리 뱃머리 -- 다크 오크
  p.push({ w: 0.15*S, h: 0.6*S, d: 0.15*S, x: 1.2*S, y: 0.7*S, z: 0, block: BlockType.DARK_OAK, rotZ: -0.3 });
  p.push({ w: 0.12*S, h: 0.2*S, d: 0.1*S, x: 1.35*S, y: 1.05*S, z: 0, block: BlockType.DARK_OAK });
  // 돛대 -- 다크 오크
  p.push({ w: 0.08*S, h: 1.6*S, d: 0.08*S, x: 0, y: 1.2*S, z: 0, block: BlockType.DARK_OAK });
  // 돛 -- 양모
  p.push({ w: 0.8*S, h: 1.0*S, d: 0.04*S, x: 0, y: 1.2*S, z: 0.08*S, block: BlockType.WOOL });
  return p;
})();

/** ORTHODOX_CROSS: 정교회 교회 -- QUARTZ(벽) + COPPER(돔+십자가, 7A) + STONE(기단) */
const ORTHODOX_CROSS_VOXELS: VoxelBox[] = (() => {
  const p: VoxelBox[] = [];
  // 기단 -- 돌
  p.push({ w: 1.0*S, h: 0.2*S, d: 0.8*S, x: 0, y: 0.1*S, z: 0, block: BlockType.STONE });
  // 교회 본체 -- 석영
  p.push({ w: 0.8*S, h: 0.9*S, d: 0.7*S, x: 0, y: 0.65*S, z: 0, block: BlockType.QUARTZ });
  // 드럼 (8각 돔 기반) -- 석영
  p.push({ w: 0.5*S, h: 0.3*S, d: 0.5*S, x: 0, y: 1.25*S, z: 0, block: BlockType.QUARTZ });
  // 양파 돔 -- 구리 (7A: 정교회 = 구리 지붕)
  p.push({ w: 0.35*S, h: 0.2*S, d: 0.35*S, x: 0, y: 1.5*S, z: 0, block: BlockType.COPPER });
  p.push({ w: 0.4*S, h: 0.15*S, d: 0.4*S, x: 0, y: 1.68*S, z: 0, block: BlockType.COPPER });
  p.push({ w: 0.3*S, h: 0.12*S, d: 0.3*S, x: 0, y: 1.8*S, z: 0, block: BlockType.COPPER });
  p.push({ w: 0.15*S, h: 0.1*S, d: 0.15*S, x: 0, y: 1.92*S, z: 0, block: BlockType.COPPER });
  // 정교회 십자가 (3-bar cross) -- 구리 (7A)
  p.push({ w: 0.06*S, h: 0.5*S, d: 0.06*S, x: 0, y: 2.22*S, z: 0, block: BlockType.COPPER });
  p.push({ w: 0.3*S, h: 0.06*S, d: 0.06*S, x: 0, y: 2.3*S, z: 0, block: BlockType.COPPER });
  p.push({ w: 0.2*S, h: 0.04*S, d: 0.06*S, x: 0, y: 2.1*S, z: 0, block: BlockType.COPPER });
  return p;
})();

// ─── 아메리카/오세아니아 5종 ───

/** COLONIAL_CHURCH: 바로크 파사드 + 쌍탑 -- QUARTZ(벽) + TERRACOTTA(지붕) + GOLD(십자가) */
const COLONIAL_CHURCH_VOXELS: VoxelBox[] = (() => {
  const p: VoxelBox[] = [];
  // 본체 -- 석영
  p.push({ w: 1.2*S, h: 0.9*S, d: 1.0*S, x: 0, y: 0.45*S, z: 0, block: BlockType.QUARTZ });
  // 지붕 -- 테라코타
  p.push({ w: 1.0*S, h: 0.25*S, d: 0.9*S, x: 0, y: 1.02*S, z: 0, block: BlockType.TERRACOTTA });
  p.push({ w: 0.6*S, h: 0.15*S, d: 0.7*S, x: 0, y: 1.22*S, z: 0, block: BlockType.TERRACOTTA });
  // 파사드 (전면 장식) -- 석영
  p.push({ w: 1.3*S, h: 0.3*S, d: 0.12*S, x: 0, y: 1.05*S, z: 0.55*S, block: BlockType.QUARTZ });
  // 쌍탑 -- 석영
  p.push({ w: 0.25*S, h: 1.6*S, d: 0.25*S, x: -0.45*S, y: 0.8*S, z: 0.5*S, block: BlockType.QUARTZ });
  p.push({ w: 0.25*S, h: 1.6*S, d: 0.25*S, x: 0.45*S, y: 0.8*S, z: 0.5*S, block: BlockType.QUARTZ });
  // 탑 지붕 -- 테라코타
  p.push({ w: 0.3*S, h: 0.2*S, d: 0.3*S, x: -0.45*S, y: 1.7*S, z: 0.5*S, block: BlockType.TERRACOTTA });
  p.push({ w: 0.2*S, h: 0.15*S, d: 0.2*S, x: -0.45*S, y: 1.88*S, z: 0.5*S, block: BlockType.TERRACOTTA });
  p.push({ w: 0.3*S, h: 0.2*S, d: 0.3*S, x: 0.45*S, y: 1.7*S, z: 0.5*S, block: BlockType.TERRACOTTA });
  p.push({ w: 0.2*S, h: 0.15*S, d: 0.2*S, x: 0.45*S, y: 1.88*S, z: 0.5*S, block: BlockType.TERRACOTTA });
  // 십자가 -- 테라코타 (7A: 식민지 교회 = 테라코타)
  p.push({ w: 0.06*S, h: 0.3*S, d: 0.06*S, x: -0.45*S, y: 2.18*S, z: 0.5*S, block: BlockType.TERRACOTTA });
  p.push({ w: 0.06*S, h: 0.3*S, d: 0.06*S, x: 0.45*S, y: 2.18*S, z: 0.5*S, block: BlockType.TERRACOTTA });
  return p;
})();

/** LIGHTHOUSE: 원통 등대 -- QUARTZ(하부) + RED_BRICK(줄무늬) + GLASS(랜턴) */
const LIGHTHOUSE_VOXELS: VoxelBox[] = [
  // 기단 -- 돌
  { w: 0.6*S, h: 0.3*S, d: 0.6*S, x: 0, y: 0.15*S, z: 0, block: BlockType.STONE },
  // 하부 -- 석영
  { w: 0.45*S, h: 0.8*S, d: 0.45*S, x: 0, y: 0.7*S, z: 0, block: BlockType.QUARTZ },
  // 줄무늬 -- 적벽돌
  { w: 0.48*S, h: 0.15*S, d: 0.48*S, x: 0, y: 1.18*S, z: 0, block: BlockType.RED_BRICK },
  // 중간 -- 석영
  { w: 0.4*S, h: 0.6*S, d: 0.4*S, x: 0, y: 1.55*S, z: 0, block: BlockType.QUARTZ },
  // 줄무늬 -- 적벽돌
  { w: 0.42*S, h: 0.12*S, d: 0.42*S, x: 0, y: 1.91*S, z: 0, block: BlockType.RED_BRICK },
  // 상부 발코니 -- 석영
  { w: 0.55*S, h: 0.08*S, d: 0.55*S, x: 0, y: 2.01*S, z: 0, block: BlockType.QUARTZ },
  // 랜턴 -- 유리
  { w: 0.3*S, h: 0.3*S, d: 0.3*S, x: 0, y: 2.2*S, z: 0, block: BlockType.GLASS },
  // 지붕 -- 구리
  { w: 0.35*S, h: 0.1*S, d: 0.35*S, x: 0, y: 2.4*S, z: 0, block: BlockType.COPPER },
  { w: 0.2*S, h: 0.08*S, d: 0.2*S, x: 0, y: 2.49*S, z: 0, block: BlockType.COPPER },
];

/** TIKI_HUT: 폴리네시아 전통 가옥 -- BAMBOO(기둥) + HAY(지붕) */
const TIKI_HUT_VOXELS: VoxelBox[] = [
  // 4 기둥 -- 대나무
  { w: 0.1*S, h: 0.8*S, d: 0.1*S, x: -0.4*S, y: 0.4*S, z: -0.3*S, block: BlockType.BAMBOO },
  { w: 0.1*S, h: 0.8*S, d: 0.1*S, x: 0.4*S, y: 0.4*S, z: -0.3*S, block: BlockType.BAMBOO },
  { w: 0.1*S, h: 0.8*S, d: 0.1*S, x: -0.4*S, y: 0.4*S, z: 0.3*S, block: BlockType.BAMBOO },
  { w: 0.1*S, h: 0.8*S, d: 0.1*S, x: 0.4*S, y: 0.4*S, z: 0.3*S, block: BlockType.BAMBOO },
  // 높은 초가 지붕 (계단) -- 건초
  { w: 1.2*S, h: 0.15*S, d: 0.9*S, x: 0, y: 0.88*S, z: 0, block: BlockType.HAY },
  { w: 1.0*S, h: 0.2*S, d: 0.7*S, x: 0, y: 1.06*S, z: 0, block: BlockType.HAY },
  { w: 0.7*S, h: 0.2*S, d: 0.5*S, x: 0, y: 1.26*S, z: 0, block: BlockType.HAY },
  { w: 0.4*S, h: 0.15*S, d: 0.3*S, x: 0, y: 1.43*S, z: 0, block: BlockType.HAY },
  { w: 0.15*S, h: 0.1*S, d: 0.15*S, x: 0, y: 1.56*S, z: 0, block: BlockType.HAY },
];

/** CORAL_SHRINE: 미크로네시아 산호 신전 -- PRISMARINE(기단) + CORAL(제단) + BAMBOO(토템) */
const CORAL_SHRINE_VOXELS: VoxelBox[] = [
  // 기단 -- 프리즈머린
  { w: 1.0*S, h: 0.2*S, d: 0.8*S, x: 0, y: 0.1*S, z: 0, block: BlockType.PRISMARINE },
  { w: 0.8*S, h: 0.15*S, d: 0.6*S, x: 0, y: 0.28*S, z: 0, block: BlockType.PRISMARINE },
  // 제단 -- 산호
  { w: 0.5*S, h: 0.3*S, d: 0.4*S, x: 0, y: 0.5*S, z: 0, block: BlockType.CORAL },
  { w: 0.3*S, h: 0.2*S, d: 0.25*S, x: 0, y: 0.75*S, z: 0, block: BlockType.CORAL },
  // 토템 -- 대나무
  { w: 0.1*S, h: 1.2*S, d: 0.1*S, x: 0, y: 1.0*S, z: 0, block: BlockType.BAMBOO },
  { w: 0.2*S, h: 0.15*S, d: 0.15*S, x: 0, y: 1.2*S, z: 0, block: BlockType.BAMBOO },
  { w: 0.15*S, h: 0.1*S, d: 0.1*S, x: 0, y: 1.55*S, z: 0, block: BlockType.BAMBOO },
];

/** CHRIST_STATUE: 남미 구세주 그리스도상 -- QUARTZ(동상) + STONE(기단) */
const CHRIST_STATUE_VOXELS: VoxelBox[] = [
  // 산 위 기단 (계단) -- 돌
  { w: 1.0*S, h: 0.3*S, d: 1.0*S, x: 0, y: 0.15*S, z: 0, block: BlockType.STONE },
  { w: 0.7*S, h: 0.2*S, d: 0.7*S, x: 0, y: 0.4*S, z: 0, block: BlockType.STONE },
  // 받침대 -- 석영
  { w: 0.4*S, h: 0.3*S, d: 0.4*S, x: 0, y: 0.65*S, z: 0, block: BlockType.QUARTZ },
  // 몸통 (세로로 긴 박스) -- 석영
  { w: 0.3*S, h: 1.2*S, d: 0.25*S, x: 0, y: 1.4*S, z: 0, block: BlockType.QUARTZ },
  // 머리 -- 석영
  { w: 0.2*S, h: 0.2*S, d: 0.2*S, x: 0, y: 2.1*S, z: 0, block: BlockType.QUARTZ },
  // 팔 (양쪽으로 벌린 가로 박스) -- 석영
  { w: 1.6*S, h: 0.15*S, d: 0.15*S, x: 0, y: 1.7*S, z: 0, block: BlockType.QUARTZ },
  // 로브 하단 -- 석영
  { w: 0.5*S, h: 0.3*S, d: 0.3*S, x: 0, y: 0.95*S, z: 0, block: BlockType.QUARTZ },
];

// ════════════════════════════════════════════════════════════════
// 아키타입 -> VoxelBox[] 매핑
// ════════════════════════════════════════════════════════════════

const ARCHETYPE_VOXELS: Record<string, VoxelBox[]> = {
  // 기존 유지 (20종)
  [LandmarkArchetype.TOWER]: TOWER_VOXELS,
  [LandmarkArchetype.PYRAMID]: PYRAMID_VOXELS,
  [LandmarkArchetype.NEEDLE]: NEEDLE_VOXELS,
  [LandmarkArchetype.STATUE]: STATUE_VOXELS,
  [LandmarkArchetype.WALL]: WALL_VOXELS,
  [LandmarkArchetype.ARENA]: ARENA_VOXELS,
  [LandmarkArchetype.BRIDGE]: BRIDGE_VOXELS,
  [LandmarkArchetype.PAGODA]: PAGODA_VOXELS,
  [LandmarkArchetype.SHELLS]: SHELLS_VOXELS,
  [LandmarkArchetype.ONION_DOME]: ONION_DOME_VOXELS,
  [LandmarkArchetype.MOUNTAIN]: MOUNTAIN_VOXELS,
  [LandmarkArchetype.TWIN_TOWER]: TWIN_TOWER_VOXELS,
  [LandmarkArchetype.BRIDGE_TOP]: BRIDGE_TOP_VOXELS,
  [LandmarkArchetype.SPIRE_CLUSTER]: SPIRE_CLUSTER_VOXELS,
  [LandmarkArchetype.SKYSCRAPER]: SKYSCRAPER_VOXELS,
  [LandmarkArchetype.CLOCK_TOWER]: CLOCK_TOWER_VOXELS,
  [LandmarkArchetype.TEMPLE]: TEMPLE_VOXELS,
  [LandmarkArchetype.GATE]: GATE_VOXELS,
  [LandmarkArchetype.WINDMILL]: WINDMILL_VOXELS,
  [LandmarkArchetype.STONE_RING]: STONE_RING_VOXELS,

  // 기존 개선 (리네임)
  [LandmarkArchetype.MOSQUE]: MOSQUE_VOXELS,
  [LandmarkArchetype.CASTLE]: CASTLE_VOXELS,
  [LandmarkArchetype.OBELISK]: OBELISK_VOXELS,
  [LandmarkArchetype.TERRACED_FIELD]: TERRACED_FIELD_VOXELS,

  // 신규 아프리카 (5종)
  [LandmarkArchetype.MUD_TOWER]: MUD_TOWER_VOXELS,
  [LandmarkArchetype.THATCHED_HUT]: THATCHED_HUT_VOXELS,
  [LandmarkArchetype.FORT]: FORT_VOXELS,
  [LandmarkArchetype.MINARET]: MINARET_VOXELS,
  [LandmarkArchetype.BAOBAB]: BAOBAB_VOXELS,

  // 신규 아시아 (5종)
  [LandmarkArchetype.STUPA]: STUPA_VOXELS,
  [LandmarkArchetype.TORII]: TORII_VOXELS,
  [LandmarkArchetype.WAT]: WAT_VOXELS,
  [LandmarkArchetype.GOPURAM]: GOPURAM_VOXELS,
  [LandmarkArchetype.YURT]: YURT_VOXELS,

  // 신규 유럽 (4종)
  [LandmarkArchetype.CATHEDRAL]: CATHEDRAL_VOXELS,
  [LandmarkArchetype.FORTRESS]: FORTRESS_VOXELS,
  [LandmarkArchetype.VIKING_SHIP]: VIKING_SHIP_VOXELS,
  [LandmarkArchetype.ORTHODOX_CROSS]: ORTHODOX_CROSS_VOXELS,

  // 신규 아메리카/오세아니아 (5종)
  [LandmarkArchetype.COLONIAL_CHURCH]: COLONIAL_CHURCH_VOXELS,
  [LandmarkArchetype.LIGHTHOUSE]: LIGHTHOUSE_VOXELS,
  [LandmarkArchetype.TIKI_HUT]: TIKI_HUT_VOXELS,
  [LandmarkArchetype.CORAL_SHRINE]: CORAL_SHRINE_VOXELS,
  [LandmarkArchetype.CHRIST_STATUE]: CHRIST_STATUE_VOXELS,
};

// ─── 캐시 + 팩토리 ───

const geometryCache = new Map<string, THREE.BufferGeometry>();

export function createArchetypeGeometry(archetype: LandmarkArchetype, biome?: BiomeType): THREE.BufferGeometry {
  // v29 Phase 7G: 캐시 키에 바이옴 포함
  const cacheKey = biome ? `${archetype}_${biome}` : archetype;
  const cached = geometryCache.get(cacheKey);
  if (cached) return cached;

  const voxels = ARCHETYPE_VOXELS[archetype];
  const geo = voxels ? buildVoxelGeometry(voxels, biome) : buildVoxelGeometry(STONE_RING_VOXELS, biome);

  geometryCache.set(cacheKey, geo);
  return geo;
}

// ─── EdgesGeometry 캐시 (MC 외곽선용) ───

const edgeGeometryCache = new Map<LandmarkArchetype, THREE.EdgesGeometry>();

export function createArchetypeEdgeGeometry(archetype: LandmarkArchetype): THREE.EdgesGeometry {
  const cached = edgeGeometryCache.get(archetype);
  if (cached) return cached;

  const baseGeo = createArchetypeGeometry(archetype);
  // thresholdAngle 1° → BoxGeometry의 90° 모서리만 추출 (곡면 아닌 직각 엣지만)
  const edges = new THREE.EdgesGeometry(baseGeo, 1);
  edgeGeometryCache.set(archetype, edges);
  return edges;
}

export function disposeGeometryCache(): void {
  geometryCache.forEach(g => g.dispose());
  geometryCache.clear();
  edgeGeometryCache.forEach(g => g.dispose());
  edgeGeometryCache.clear();
  heightCache.clear();
}

// ─── 아키타입별 높이 (로컬 Y축 최대값 × S) ───

const heightCache = new Map<string, number>();

/**
 * 아키타입의 월드 공간 높이를 반환 (Y축 최대 — VoxelBox 데이터 기반).
 * VoxelBox 데이터에 이미 S(=1.8)가 곱해져 있으므로 추가 S 곱셈 불필요.
 * LANDMARK_SCALE(1.5)만 추가로 곱함 (LandmarkMeshes에서 적용하는 스케일).
 */
export function getArchetypeHeight(archetype: LandmarkArchetype): number {
  const cached = heightCache.get(archetype);
  if (cached !== undefined) return cached;

  const voxels = ARCHETYPE_VOXELS[archetype] ?? STONE_RING_VOXELS;
  let maxY = 0;
  for (const v of voxels) {
    // VoxelBox의 y, h에 이미 S가 곱해져 있음 (e.g. y: 2.9*S)
    const top = v.y + v.h / 2;
    if (top > maxY) maxY = top;
  }
  // LANDMARK_SCALE = 1.5 (LandmarkMeshes에서 적용)
  const worldHeight = maxY * 1.5;
  heightCache.set(archetype, worldHeight);
  return worldHeight;
}
