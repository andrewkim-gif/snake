/**
 * mc-texture-atlas.ts -- MC 프로시저럴 텍스처 아틀라스 (v29 Phase 3)
 *
 * 512x512 CanvasTexture 아틀라스 생성:
 *   - 8열 x 8행 그리드, 각 셀 64x64px
 *   - 38종 블록별 프로시저럴 텍스처 (노이즈, 벽돌, 나무, 크리스탈 등)
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

/** 노이즈: 다층 블록 단위 랜덤 색상 변조 (64px 디테일) */
function applyNoise(
  r: number, g: number, b: number,
  noiseRgbs: [number, number, number][],
  rand: () => number,
  px: number, py: number,
): [number, number, number] {
  // 대형 4x4 블록 단위 노이즈 (전체 톤 변화)
  const bx4 = Math.floor(px / 4);
  const by4 = Math.floor(py / 4);
  const hashLarge = ((bx4 * 7 + by4 * 13) % 17) / 17;

  if (noiseRgbs.length > 0 && hashLarge > 0.35) {
    const idx = Math.floor(hashLarge * noiseRgbs.length) % noiseRgbs.length;
    const nc = noiseRgbs[idx];
    const mix = 0.25 + hashLarge * 0.35;
    r = Math.round(r * (1 - mix) + nc[0] * mix);
    g = Math.round(g * (1 - mix) + nc[1] * mix);
    b = Math.round(b * (1 - mix) + nc[2] * mix);
  }

  // 중간 2x2 블록 노이즈 (디테일 레이어)
  const bx2 = Math.floor(px / 2);
  const by2 = Math.floor(py / 2);
  const hashMed = ((bx2 * 11 + by2 * 17) % 23) / 23;
  if (noiseRgbs.length > 0 && hashMed > 0.55) {
    const idx = Math.floor(hashMed * noiseRgbs.length) % noiseRgbs.length;
    const nc = noiseRgbs[idx];
    const mix = 0.15;
    r = Math.round(r * (1 - mix) + nc[0] * mix);
    g = Math.round(g * (1 - mix) + nc[1] * mix);
    b = Math.round(b * (1 - mix) + nc[2] * mix);
  }

  // 미세 1px 노이즈 (질감)
  if (rand() < 0.18) {
    const offset = Math.round((rand() - 0.5) * 24);
    r = clamp(r + offset, 0, 255);
    g = clamp(g + offset, 0, 255);
    b = clamp(b + offset, 0, 255);
  }

  return [r, g, b];
}

/** 벽돌: 가로줄 + 엇갈린 세로줄 + 1px 모르타르 (64px 디테일) */
function applyBrick(
  r: number, g: number, b: number,
  noiseRgbs: [number, number, number][],
  rand: () => number,
  px: number, py: number,
): [number, number, number] {
  const brickH = 8; // 벽돌 높이 (64px용 스케일업)
  const brickW = 16; // 벽돌 너비
  const row = Math.floor(py / brickH);
  const offset = (row % 2) * (brickW / 2); // 엇갈림
  const localX = (px + offset) % brickW;
  const localY = py % brickH;

  // 1px 모르타르 줄눈 (가로/세로)
  if (localY === 0 || localX === 0) {
    // 모르타르 색상: 밝은 회색 톤 (시멘트)
    const mortarR = Math.round(r * 0.5 + 40);
    const mortarG = Math.round(g * 0.5 + 40);
    const mortarB = Math.round(b * 0.5 + 40);
    return [
      clamp(mortarR, 0, 255),
      clamp(mortarG, 0, 255),
      clamp(mortarB, 0, 255),
    ];
  }

  // 벽돌 가장자리 미세 어두움 (모르타르 옆 1px)
  if (localY === 1 || localY === brickH - 1 || localX === 1 || localX === brickW - 1) {
    r = Math.round(r * 0.92);
    g = Math.round(g * 0.92);
    b = Math.round(b * 0.92);
  }

  // 벽돌 내부: 행별 미세 색조 변화
  const brickId = row * 4 + Math.floor((px + offset) / brickW);
  const brickHash = ((brickId * 7 + 3) % 11) / 11;
  if (noiseRgbs.length > 0 && brickHash > 0.3) {
    const nc = noiseRgbs[Math.floor(brickHash * noiseRgbs.length) % noiseRgbs.length];
    const mix = 0.15 + brickHash * 0.15;
    r = Math.round(r * (1 - mix) + nc[0] * mix);
    g = Math.round(g * (1 - mix) + nc[1] * mix);
    b = Math.round(b * (1 - mix) + nc[2] * mix);
  }

  // 미세 픽셀 노이즈 (질감)
  if (rand() < 0.2) {
    const offset2 = Math.round((rand() - 0.5) * 14);
    r = clamp(r + offset2, 0, 255);
    g = clamp(g + offset2, 0, 255);
    b = clamp(b + offset2, 0, 255);
  }

  return [r, g, b];
}

/** 나무: 세로 결 + 나뭇결 방향선 (64px 디테일) */
function applyWood(
  r: number, g: number, b: number,
  noiseRgbs: [number, number, number][],
  rand: () => number,
  px: number, py: number,
): [number, number, number] {
  // 주요 세로 결 (6-8px 간격, 약간 흔들림 포함)
  const wobble = Math.floor(Math.sin(py * 0.15) * 1.5);
  const grainX = (px + wobble) % 8;
  if (grainX === 0 || grainX === 1) {
    const darken = grainX === 0 ? 0.78 : 0.86;
    r = Math.round(r * darken);
    g = Math.round(g * darken);
    b = Math.round(b * darken);
  }

  // 가는 나뭇결 선 (2-3px 간격, 더 얇은 보조 결)
  const fineGrain = (px + Math.floor(py * 0.25)) % 4;
  if (fineGrain === 0) {
    r = Math.round(r * 0.9);
    g = Math.round(g * 0.9);
    b = Math.round(b * 0.9);
  }

  // 옹이 (knot) - 64px에서 작은 원형 패턴
  const knotCx = 20 + ((py * 7) % 30);
  const knotCy = 16 + ((px * 11) % 28);
  const dx = px - (knotCx % CELL_SIZE);
  const dy = py - (knotCy % CELL_SIZE);
  if (dx * dx + dy * dy < 9) {
    r = Math.round(r * 0.75);
    g = Math.round(g * 0.75);
    b = Math.round(b * 0.75);
  }

  // 노이즈 변조 (나무 색상 다양성)
  if (noiseRgbs.length > 0) {
    const hash = ((px * 3 + py * 7) % 13) / 13;
    if (hash > 0.45) {
      const nc = noiseRgbs[Math.floor(hash * noiseRgbs.length) % noiseRgbs.length];
      const mix = 0.18;
      r = Math.round(r * (1 - mix) + nc[0] * mix);
      g = Math.round(g * (1 - mix) + nc[1] * mix);
      b = Math.round(b * (1 - mix) + nc[2] * mix);
    }
  }

  return [r, g, b];
}

/** 크리스탈: 패싯 격자 + 광택점 + 경사면 하이라이트 (64px 디테일) */
function applyCrystal(
  r: number, g: number, b: number,
  noiseRgbs: [number, number, number][],
  rand: () => number,
  px: number, py: number,
): [number, number, number] {
  // 대형 패싯 격자 (8px 간격 — 크리스탈 면 구분)
  if (px % 8 === 0 || py % 8 === 0) {
    r = Math.round(r * 0.82);
    g = Math.round(g * 0.82);
    b = Math.round(b * 0.82);
  }
  // 소형 패싯 세부 격자 (4px 간격)
  else if (px % 4 === 0 || py % 4 === 0) {
    r = Math.round(r * 0.9);
    g = Math.round(g * 0.9);
    b = Math.round(b * 0.9);
  }

  // 패싯 경사면 하이라이트 (대각선 밝은 줄)
  const diag = (px + py) % 8;
  if (diag === 1 || diag === 2) {
    r = clamp(Math.round(r * 1.08), 0, 255);
    g = clamp(Math.round(g * 1.08), 0, 255);
    b = clamp(Math.round(b * 1.08), 0, 255);
  }

  // 광택점 (밝은 스팟 — 더 분산)
  const hash = ((px * 11 + py * 23) % 37);
  if (hash < 2) {
    r = clamp(r + 55, 0, 255);
    g = clamp(g + 55, 0, 255);
    b = clamp(b + 55, 0, 255);
  } else if (hash < 5) {
    r = clamp(r + 25, 0, 255);
    g = clamp(g + 25, 0, 255);
    b = clamp(b + 25, 0, 255);
  }

  // 미세 노이즈
  if (noiseRgbs.length > 0 && rand() < 0.22) {
    const nc = noiseRgbs[Math.floor(rand() * noiseRgbs.length)];
    const mix = 0.15;
    r = Math.round(r * (1 - mix) + nc[0] * mix);
    g = Math.round(g * (1 - mix) + nc[1] * mix);
    b = Math.round(b * (1 - mix) + nc[2] * mix);
  }

  return [r, g, b];
}

/** 스트라이프: 다층 가로 줄무늬 (64px 디테일) */
function applyStripe(
  r: number, g: number, b: number,
  noiseRgbs: [number, number, number][],
  rand: () => number,
  px: number, py: number,
): [number, number, number] {
  // 주요 가로 줄무늬 (4px 간격, 두꺼운 밴드)
  const band = py % 6;
  if (band === 0 || band === 1) {
    r = Math.round(r * 0.82);
    g = Math.round(g * 0.82);
    b = Math.round(b * 0.82);
  }

  // 보조 가는 줄무늬 (2px 간격)
  if (py % 3 === 0 && band !== 0) {
    r = Math.round(r * 0.92);
    g = Math.round(g * 0.92);
    b = Math.round(b * 0.92);
  }

  // 노이즈 변조 (약간 더 강화)
  if (noiseRgbs.length > 0 && rand() < 0.28) {
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
 * 512x512, 8x8 그리드, NearestFilter.
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
