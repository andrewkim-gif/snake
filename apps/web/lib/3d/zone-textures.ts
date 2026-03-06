/**
 * zone-textures — 존별 바닥 텍스처 프로시저럴 생성
 * Edge: 잔디(#5D9B47 + 흙), Mid: 돌(#808080 노이즈), Core: 네더랙(#6B2020)
 * 모두 16x16 Canvas + NearestFilter → MC 픽셀 아트
 */

import * as THREE from 'three';

const TEX_SIZE = 16;

// ─── 헬퍼 ───

function createCanvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = TEX_SIZE;
  canvas.height = TEX_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return [canvas, ctx];
}

function toCanvasTexture(canvas: HTMLCanvasElement, repeatX = 64, repeatY = 64): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 시드 기반 의사 난수 (결정적) */
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function px(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

function varyColor(baseHex: string, seed: number, range: number): string {
  const h = parseInt(baseHex.slice(1), 16);
  const r = (h >> 16) & 0xff;
  const g = (h >> 8) & 0xff;
  const b = h & 0xff;
  const variation = (seededRandom(seed) - 0.5) * range * 2;
  const nr = Math.max(0, Math.min(255, Math.round(r + variation)));
  const ng = Math.max(0, Math.min(255, Math.round(g + variation)));
  const nb = Math.max(0, Math.min(255, Math.round(b + variation)));
  return `#${((nr << 16) | (ng << 8) | nb).toString(16).padStart(6, '0')}`;
}

// ─── Edge Zone: 잔디 텍스처 ───

let _grassTex: THREE.CanvasTexture | null = null;

export function createGrassTexture(): THREE.CanvasTexture {
  if (_grassTex) return _grassTex;

  const [canvas, ctx] = createCanvas();
  const grassBase = '#5D9B47';
  const dirtBase = '#8B6A3E';

  for (let y = 0; y < TEX_SIZE; y++) {
    for (let x = 0; x < TEX_SIZE; x++) {
      const seed = y * TEX_SIZE + x;
      if (y < 4) {
        // 상단: 잔디 표면 (밝은 변형)
        px(ctx, x, y, varyColor(grassBase, seed, 15));
      } else if (y < 6) {
        // 잔디-흙 경계
        const isGrass = seededRandom(seed * 3.7) > 0.4;
        px(ctx, x, y, isGrass ? varyColor(grassBase, seed, 20) : varyColor(dirtBase, seed, 10));
      } else {
        // 하단: 흙
        px(ctx, x, y, varyColor(dirtBase, seed, 12));
      }
    }
  }

  // 잔디 하이라이트 (몇 개 밝은 픽셀)
  px(ctx, 3, 1, '#7FC05A');
  px(ctx, 9, 2, '#7FC05A');
  px(ctx, 13, 0, '#6AAE52');

  _grassTex = toCanvasTexture(canvas);
  return _grassTex;
}

// ─── Mid Zone: 돌 텍스처 ───

let _stoneTex: THREE.CanvasTexture | null = null;

export function createStoneTexture(): THREE.CanvasTexture {
  if (_stoneTex) return _stoneTex;

  const [canvas, ctx] = createCanvas();
  const stoneBase = '#808080';
  const stoneDark = '#666666';

  for (let y = 0; y < TEX_SIZE; y++) {
    for (let x = 0; x < TEX_SIZE; x++) {
      const seed = y * TEX_SIZE + x;
      // 랜덤 노이즈로 돌 텍스처 생성
      const isDark = seededRandom(seed * 2.3) > 0.6;
      const base = isDark ? stoneDark : stoneBase;
      px(ctx, x, y, varyColor(base, seed * 1.7, 18));
    }
  }

  // 균열 패턴 (어두운 라인)
  for (let x = 2; x < 8; x++) px(ctx, x, 7, '#555555');
  for (let y = 3; y < 7; y++) px(ctx, 11, y, '#555555');
  px(ctx, 5, 12, '#5A5A5A');
  px(ctx, 6, 12, '#5A5A5A');

  _stoneTex = toCanvasTexture(canvas);
  return _stoneTex;
}

// ─── Core Zone: 네더랙 텍스처 ───

let _netherrackTex: THREE.CanvasTexture | null = null;

export function createNetherrackTexture(): THREE.CanvasTexture {
  if (_netherrackTex) return _netherrackTex;

  const [canvas, ctx] = createCanvas();
  const netherBase = '#6B2020';
  const netherLight = '#8B3030';

  for (let y = 0; y < TEX_SIZE; y++) {
    for (let x = 0; x < TEX_SIZE; x++) {
      const seed = y * TEX_SIZE + x;
      // 불규칙한 네더 패턴
      const isLight = seededRandom(seed * 4.1) > 0.55;
      const base = isLight ? netherLight : netherBase;
      px(ctx, x, y, varyColor(base, seed * 2.9, 12));
    }
  }

  // 붉은 반점 (용암 느낌)
  px(ctx, 4, 4, '#993333');
  px(ctx, 5, 4, '#993333');
  px(ctx, 4, 5, '#993333');
  px(ctx, 10, 11, '#993333');
  px(ctx, 11, 11, '#993333');
  px(ctx, 11, 12, '#993333');

  _netherrackTex = toCanvasTexture(canvas);
  return _netherrackTex;
}

/**
 * 존 텍스처 캐시 해제
 */
export function disposeZoneTextures(): void {
  if (_grassTex) { _grassTex.dispose(); _grassTex = null; }
  if (_stoneTex) { _stoneTex.dispose(); _stoneTex = null; }
  if (_netherrackTex) { _netherrackTex.dispose(); _netherrackTex = null; }
}
