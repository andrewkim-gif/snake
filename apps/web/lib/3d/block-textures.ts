/**
 * block-textures.ts — 블록 텍스처 유틸리티
 *
 * 1) 잔디 변형 텍스처 경로 정의 (grass_top_dark, grass_top_dry, grass_top_lush)
 * 2) 돌/흙 변형 텍스처 경로 정의 (stone_mossy, stone_cracked, dirt_mossy, dirt_path)
 * 3) 좌표 해시 기반 결정적 변형 인덱스 선택
 * 4) CanvasTexture 프로시저럴 fallback (PNG 로딩 실패 시)
 */

import * as THREE from 'three';

const TEX_PATH = '/textures/blocks';

// ─── 잔디 변형 텍스처 경로 ───

/** 잔디 상단 변형 인덱스: 0=기본, 1=dark, 2=dry, 3=lush */
export const GRASS_VARIANT_TEXTURES = [
  `${TEX_PATH}/grass_top_green.png`,  // 0: 기본
  `${TEX_PATH}/grass_top_dark.png`,   // 1: 진한 초록 (숲)
  `${TEX_PATH}/grass_top_dry.png`,    // 2: 마른 풀
  `${TEX_PATH}/grass_top_lush.png`,   // 3: 무성한 풀
] as const;

// ─── 돌/흙 변형 텍스처 경로 (향후 활용) ───

export const STONE_VARIANT_TEXTURES = [
  `${TEX_PATH}/stone.png`,          // 0: 기본
  `${TEX_PATH}/stone_mossy.png`,    // 1: 이끼 낀 돌
  `${TEX_PATH}/stone_cracked.png`,  // 2: 균열 돌
] as const;

export const DIRT_VARIANT_TEXTURES = [
  `${TEX_PATH}/dirt.png`,         // 0: 기본
  `${TEX_PATH}/dirt_mossy.png`,   // 1: 이끼 흙
  `${TEX_PATH}/dirt_path.png`,    // 2: 흙길
] as const;

// ─── 좌표 해시 함수 (결정적 변형 선택) ───

/**
 * x, z 좌표를 해시하여 0~(variantCount-1) 인덱스 반환
 * 결정적: 동일 좌표 = 동일 인덱스
 * 분포: 기본(0)이 50%, 나머지 변형이 각 ~16.7%
 */
export function getGrassVariantIndex(x: number, z: number): number {
  // Robert Jenkins hash (간단한 정수 해시)
  let h = ((x * 73856093) ^ (z * 19349663)) | 0;
  h = ((h >> 16) ^ h) * 0x45d9f3b | 0;
  h = ((h >> 16) ^ h) * 0x45d9f3b | 0;
  h = (h >> 16) ^ h;
  const v = ((h & 0x7fffffff) % 6);
  // 0,1,2 → variant 0 (기본, 50%), 3 → variant 1, 4 → variant 2, 5 → variant 3
  if (v <= 2) return 0;
  return v - 2; // 3→1, 4→2, 5→3
}

/**
 * 돌 변형 인덱스 (0=기본 70%, 1=이끼 15%, 2=균열 15%)
 */
export function getStoneVariantIndex(x: number, y: number, z: number): number {
  let h = ((x * 73856093) ^ (y * 83492791) ^ (z * 19349663)) | 0;
  h = ((h >> 16) ^ h) * 0x45d9f3b | 0;
  h = (h >> 16) ^ h;
  const v = ((h & 0x7fffffff) % 10);
  if (v < 7) return 0; // 기본 70%
  if (v < 8) return 1; // 이끼 15% (actually 10%)
  return 2;            // 균열 20%
}

// ─── CanvasTexture 프로시저럴 Fallback ───

const TEX_SIZE = 32;

function createCanvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = TEX_SIZE;
  canvas.height = TEX_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return [canvas, ctx];
}

function toBlockTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 시드 기반 PRNG
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 프로시저럴 잔디 상단 CanvasTexture (fallback)
 * @param variant 0=기본, 1=dark, 2=dry, 3=lush
 */
export function createGrassTopCanvasTexture(variant: number): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();
  const colors: [number, number, number][] = [
    [95, 159, 53],   // 기본
    [55, 120, 35],   // dark
    [155, 165, 75],  // dry
    [70, 190, 55],   // lush
  ];
  const [r, g, b] = colors[variant] || colors[0];

  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

  // 노이즈
  const rng = mulberry32(20000 + variant * 1000);
  for (let y = 0; y < TEX_SIZE; y++) {
    for (let x = 0; x < TEX_SIZE; x++) {
      const n = Math.floor((rng() - 0.5) * 30);
      ctx.fillStyle = `rgb(${Math.max(0, Math.min(255, r + n))},${Math.max(0, Math.min(255, g + n))},${Math.max(0, Math.min(255, b + Math.floor(n * 0.5)))})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  return toBlockTexture(canvas);
}
