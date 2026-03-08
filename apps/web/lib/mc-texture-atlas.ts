/**
 * mc-texture-atlas.ts -- MC 프로시저럴 텍스처 아틀라스 (v20 Phase 1)
 *
 * 256x256 CanvasTexture 아틀라스 생성:
 *   - 8열 x 4행 그리드, 각 셀 32x32px
 *   - 32종 블록별 프로시저럴 텍스처 (노이즈, 벽돌, 나무, 크리스탈 등)
 *   - 가장자리 1px 어둡게 (블록 이음새 그리드감)
 *   - NearestFilter (MC 픽셀감)
 *   - 싱글턴 캐싱 + dispose 함수
 */

import * as THREE from 'three';
import {
  BlockType,
  BLOCK_DEFS,
  ATLAS_COLS,
  ATLAS_ROWS,
  CELL_SIZE,
  ATLAS_SIZE,
  BLOCK_COUNT,
  type PatternType,
  type BlockDef,
} from './mc-blocks';

// ─── 유틸리티: hex → RGB ───

function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.replace('#', ''), 16);
  return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
}

// ─── 시드 기반 의사 난수 (결정적, 블록마다 같은 패턴) ───

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ─── 블록 텍스처 프로시저럴 생성 ───

function generateBlockTexture(
  ctx: CanvasRenderingContext2D,
  blockType: BlockType,
  offsetX: number,
  offsetY: number,
): void {
  const def = BLOCK_DEFS[blockType];
  if (!def) return;

  const baseRgb = hexToRgb(def.baseColor);
  const noiseRgbs = (def.noiseColors || []).map(hexToRgb);
  const rand = seededRandom(blockType * 1337 + 42);

  // ImageData로 직접 픽셀 조작
  const imgData = ctx.createImageData(CELL_SIZE, CELL_SIZE);
  const data = imgData.data;

  for (let py = 0; py < CELL_SIZE; py++) {
    for (let px = 0; px < CELL_SIZE; px++) {
      const idx = (py * CELL_SIZE + px) * 4;
      let r = baseRgb[0];
      let g = baseRgb[1];
      let b = baseRgb[2];

      // 패턴 적용
      switch (def.pattern) {
        case 'noise':
          [r, g, b] = applyNoise(r, g, b, noiseRgbs, rand, px, py);
          break;
        case 'brick':
          [r, g, b] = applyBrick(r, g, b, noiseRgbs, rand, px, py);
          break;
        case 'wood':
          [r, g, b] = applyWood(r, g, b, noiseRgbs, rand, px, py);
          break;
        case 'crystal':
          [r, g, b] = applyCrystal(r, g, b, noiseRgbs, rand, px, py);
          break;
        case 'stripe':
          [r, g, b] = applyStripe(r, g, b, noiseRgbs, rand, px, py);
          break;
        case 'plain':
          // 최소한의 노이즈
          if (rand() < 0.1 && noiseRgbs.length > 0) {
            const nc = noiseRgbs[Math.floor(rand() * noiseRgbs.length)];
            r = nc[0]; g = nc[1]; b = nc[2];
          }
          break;
      }

      // 가장자리 1px 어둡게 (블록 이음새 그리드감)
      if (px === 0 || px === CELL_SIZE - 1 || py === 0 || py === CELL_SIZE - 1) {
        const darken = 1 - def.edgeDarken;
        r = Math.round(r * darken);
        g = Math.round(g * darken);
        b = Math.round(b * darken);
      }

      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, offsetX, offsetY);
}

// ─── 패턴 함수들 ───

/** 노이즈: 2x2 블록 단위 랜덤 색상 변조 */
function applyNoise(
  r: number, g: number, b: number,
  noiseRgbs: [number, number, number][],
  rand: () => number,
  px: number, py: number,
): [number, number, number] {
  // 2x2 블록 단위로 노이즈 (MC 픽셀 미학)
  const bx = Math.floor(px / 2);
  const by = Math.floor(py / 2);
  const hash = ((bx * 7 + by * 13) % 17) / 17;

  if (noiseRgbs.length > 0 && hash > 0.4) {
    const idx = Math.floor(hash * noiseRgbs.length) % noiseRgbs.length;
    const nc = noiseRgbs[idx];
    // 블렌드
    const mix = 0.3 + hash * 0.4;
    r = Math.round(r * (1 - mix) + nc[0] * mix);
    g = Math.round(g * (1 - mix) + nc[1] * mix);
    b = Math.round(b * (1 - mix) + nc[2] * mix);
  }

  // 추가 2x2 미세 노이즈
  if (rand() < 0.15) {
    const offset = Math.round((rand() - 0.5) * 20);
    r = clamp(r + offset, 0, 255);
    g = clamp(g + offset, 0, 255);
    b = clamp(b + offset, 0, 255);
  }

  return [r, g, b];
}

/** 벽돌: 가로줄 + 엇갈린 세로줄 */
function applyBrick(
  r: number, g: number, b: number,
  noiseRgbs: [number, number, number][],
  rand: () => number,
  px: number, py: number,
): [number, number, number] {
  const brickH = 4; // 벽돌 높이
  const brickW = 8; // 벽돌 너비
  const row = Math.floor(py / brickH);
  const offset = (row % 2) * (brickW / 2); // 엇갈림
  const localX = (px + offset) % brickW;
  const localY = py % brickH;

  // 줄눈 (모르타르 라인)
  if (localY === 0 || localX === 0) {
    return [
      Math.round(r * 0.55),
      Math.round(g * 0.55),
      Math.round(b * 0.55),
    ];
  }

  // 벽돌 내부 노이즈
  if (noiseRgbs.length > 0 && rand() < 0.3) {
    const nc = noiseRgbs[Math.floor(rand() * noiseRgbs.length)];
    const mix = 0.25;
    r = Math.round(r * (1 - mix) + nc[0] * mix);
    g = Math.round(g * (1 - mix) + nc[1] * mix);
    b = Math.round(b * (1 - mix) + nc[2] * mix);
  }

  return [r, g, b];
}

/** 나무: 세로 결 (세로 줄무늬 + 노이즈) */
function applyWood(
  r: number, g: number, b: number,
  noiseRgbs: [number, number, number][],
  rand: () => number,
  px: number, py: number,
): [number, number, number] {
  // 세로 결 패턴 (3-4px 간격 줄무늬)
  const grain = (px + Math.floor(py * 0.3)) % 4;
  if (grain === 0) {
    r = Math.round(r * 0.82);
    g = Math.round(g * 0.82);
    b = Math.round(b * 0.82);
  }

  // 노이즈 변조
  if (noiseRgbs.length > 0) {
    const hash = ((px * 3 + py * 7) % 11) / 11;
    if (hash > 0.5) {
      const nc = noiseRgbs[Math.floor(hash * noiseRgbs.length) % noiseRgbs.length];
      const mix = 0.2;
      r = Math.round(r * (1 - mix) + nc[0] * mix);
      g = Math.round(g * (1 - mix) + nc[1] * mix);
      b = Math.round(b * (1 - mix) + nc[2] * mix);
    }
  }

  return [r, g, b];
}

/** 크리스탈: 격자 + 광택점 */
function applyCrystal(
  r: number, g: number, b: number,
  noiseRgbs: [number, number, number][],
  rand: () => number,
  px: number, py: number,
): [number, number, number] {
  // 격자 패턴 (4px 간격)
  if (px % 4 === 0 || py % 4 === 0) {
    r = Math.round(r * 0.88);
    g = Math.round(g * 0.88);
    b = Math.round(b * 0.88);
  }

  // 광택점 (밝은 스팟)
  const hash = ((px * 11 + py * 23) % 37);
  if (hash < 2) {
    r = clamp(r + 40, 0, 255);
    g = clamp(g + 40, 0, 255);
    b = clamp(b + 40, 0, 255);
  }

  // 미세 노이즈
  if (noiseRgbs.length > 0 && rand() < 0.2) {
    const nc = noiseRgbs[Math.floor(rand() * noiseRgbs.length)];
    const mix = 0.15;
    r = Math.round(r * (1 - mix) + nc[0] * mix);
    g = Math.round(g * (1 - mix) + nc[1] * mix);
    b = Math.round(b * (1 - mix) + nc[2] * mix);
  }

  return [r, g, b];
}

/** 스트라이프: 세로 또는 가로 줄무늬 */
function applyStripe(
  r: number, g: number, b: number,
  noiseRgbs: [number, number, number][],
  rand: () => number,
  px: number, py: number,
): [number, number, number] {
  // 가로 줄무늬 (2px 간격)
  if (py % 3 === 0) {
    r = Math.round(r * 0.85);
    g = Math.round(g * 0.85);
    b = Math.round(b * 0.85);
  }

  // 노이즈 변조
  if (noiseRgbs.length > 0 && rand() < 0.25) {
    const nc = noiseRgbs[Math.floor(rand() * noiseRgbs.length)];
    const mix = 0.2;
    r = Math.round(r * (1 - mix) + nc[0] * mix);
    g = Math.round(g * (1 - mix) + nc[1] * mix);
    b = Math.round(b * (1 - mix) + nc[2] * mix);
  }

  return [r, g, b];
}

// ─── 유틸리티 ───

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

// ─── 아틀라스 텍스처 생성 ───

let cachedTexture: THREE.CanvasTexture | null = null;
let cachedCanvas: HTMLCanvasElement | null = null;

/**
 * MC 블록 아틀라스 CanvasTexture 생성 (싱글턴).
 * 256x256, 8x4 그리드, NearestFilter.
 */
export function getBlockAtlasTexture(): THREE.CanvasTexture {
  if (cachedTexture) return cachedTexture;

  // SSR 안전: document 없으면 빈 텍스처 반환
  if (typeof document === 'undefined') {
    const tex = new THREE.CanvasTexture(
      new OffscreenCanvas(ATLAS_SIZE, ATLAS_SIZE) as unknown as HTMLCanvasElement,
    );
    return tex;
  }

  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_SIZE;
  canvas.height = ATLAS_SIZE;
  const ctx = canvas.getContext('2d')!;

  // 각 블록 텍스처 생성
  for (let i = 0; i < BLOCK_COUNT; i++) {
    const col = i % ATLAS_COLS;
    const row = Math.floor(i / ATLAS_COLS);
    const ox = col * CELL_SIZE;
    const oy = row * CELL_SIZE;
    generateBlockTexture(ctx, i as BlockType, ox, oy);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false; // UV 좌표계와 일치
  texture.needsUpdate = true;

  cachedTexture = texture;
  cachedCanvas = canvas;
  return texture;
}

// ─── UV 좌표 매핑 ───

export interface BlockUV {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

/**
 * 블록 타입 → 아틀라스 UV 좌표.
 * 아틀라스 내 해당 블록 셀의 UV 범위 반환.
 */
export function getBlockUV(blockType: BlockType): BlockUV {
  const col = blockType % ATLAS_COLS;
  const row = Math.floor(blockType / ATLAS_COLS);
  const u0 = col / ATLAS_COLS;
  const v0 = row / ATLAS_ROWS;
  const u1 = (col + 1) / ATLAS_COLS;
  const v1 = (row + 1) / ATLAS_ROWS;
  return { u0, v0, u1, v1 };
}

// ─── 정리 ───

/**
 * 캐시된 아틀라스 텍스처 해제.
 */
export function disposeBlockAtlas(): void {
  if (cachedTexture) {
    cachedTexture.dispose();
    cachedTexture = null;
  }
  cachedCanvas = null;
}
