/**
 * voxel-textures — 프로시저럴 16x16 Canvas 텍스처 (지형 블록)
 * 잔디/흙/돌/나무줄기/잎 블록용
 * NearestFilter + no mipmaps → 픽셀 아트 렌더링
 */

import * as THREE from 'three';

const TEX_SIZE = 16;

function createCanvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = TEX_SIZE;
  canvas.height = TEX_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return [canvas, ctx];
}

function toTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 결정적 의사난수 (텍스처 재현성 보장)
function seededRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** 잔디 상단 텍스처 */
export function createGrassTopTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();
  const rand = seededRand(42);

  ctx.fillStyle = '#5D9B3A';
  ctx.fillRect(0, 0, 16, 16);

  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const r = rand();
      if (r < 0.3) {
        ctx.fillStyle = '#4A8530';
        ctx.fillRect(x, y, 1, 1);
      } else if (r < 0.45) {
        ctx.fillStyle = '#6BAA44';
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  return toTexture(canvas);
}

/** 잔디 옆면 텍스처 (상단 초록 + 하단 흙) */
export function createGrassSideTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();
  const rand = seededRand(137);

  // 흙 베이스
  ctx.fillStyle = '#8B6B47';
  ctx.fillRect(0, 0, 16, 16);

  for (let y = 3; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const r = rand();
      if (r < 0.2) {
        ctx.fillStyle = '#7A5C3A';
        ctx.fillRect(x, y, 1, 1);
      } else if (r < 0.35) {
        ctx.fillStyle = '#9B7B57';
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  // 상단 초록 (불규칙 경계)
  ctx.fillStyle = '#5D9B3A';
  ctx.fillRect(0, 0, 16, 2);
  for (let x = 0; x < 16; x++) {
    if (rand() > 0.4) ctx.fillRect(x, 2, 1, 1);
    if (rand() > 0.7) ctx.fillRect(x, 3, 1, 1);
  }

  return toTexture(canvas);
}

/** 흙 텍스처 */
export function createDirtTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();
  const rand = seededRand(256);

  ctx.fillStyle = '#8B6B47';
  ctx.fillRect(0, 0, 16, 16);

  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const r = rand();
      if (r < 0.2) {
        ctx.fillStyle = '#7A5C3A';
        ctx.fillRect(x, y, 1, 1);
      } else if (r < 0.35) {
        ctx.fillStyle = '#9B7B57';
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  return toTexture(canvas);
}

/** 돌 텍스처 */
export function createStoneTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();
  const rand = seededRand(512);

  ctx.fillStyle = '#8A8A8A';
  ctx.fillRect(0, 0, 16, 16);

  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const r = rand();
      if (r < 0.2) {
        ctx.fillStyle = '#707070';
        ctx.fillRect(x, y, 1, 1);
      } else if (r < 0.35) {
        ctx.fillStyle = '#999999';
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  // 균열
  ctx.fillStyle = '#606060';
  ctx.fillRect(3, 5, 4, 1);
  ctx.fillRect(8, 10, 5, 1);
  ctx.fillRect(1, 13, 3, 1);

  return toTexture(canvas);
}

/** 나무줄기 텍스처 */
export function createWoodTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();
  const rand = seededRand(789);

  ctx.fillStyle = '#6B4423';
  ctx.fillRect(0, 0, 16, 16);

  // 세로 나무결
  for (let x = 0; x < 16; x++) {
    if (rand() > 0.6) {
      for (let y = 0; y < 16; y++) {
        if (rand() > 0.3) {
          ctx.fillStyle = '#5A3518';
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
  }

  // 밝은 점
  for (let i = 0; i < 8; i++) {
    const x = Math.floor(rand() * 16);
    const y = Math.floor(rand() * 16);
    ctx.fillStyle = '#7D5530';
    ctx.fillRect(x, y, 1, 1);
  }

  return toTexture(canvas);
}

/** 나뭇잎 텍스처 */
export function createLeavesTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();
  const rand = seededRand(1024);

  ctx.fillStyle = '#3A8B25';
  ctx.fillRect(0, 0, 16, 16);

  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const r = rand();
      if (r < 0.25) {
        ctx.fillStyle = '#2E7520';
        ctx.fillRect(x, y, 1, 1);
      } else if (r < 0.4) {
        ctx.fillStyle = '#4A9B35';
        ctx.fillRect(x, y, 1, 1);
      } else if (r < 0.48) {
        ctx.fillStyle = '#2A6A1C';
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  return toTexture(canvas);
}

// ─── 캐시된 텍스처 세트 ───

export interface VoxelTextures {
  grassTop: THREE.CanvasTexture;
  grassSide: THREE.CanvasTexture;
  dirt: THREE.CanvasTexture;
  stone: THREE.CanvasTexture;
  wood: THREE.CanvasTexture;
  leaves: THREE.CanvasTexture;
}

let cached: VoxelTextures | null = null;

export function getVoxelTextures(): VoxelTextures {
  if (cached) return cached;
  cached = {
    grassTop: createGrassTopTexture(),
    grassSide: createGrassSideTexture(),
    dirt: createDirtTexture(),
    stone: createStoneTexture(),
    wood: createWoodTexture(),
    leaves: createLeavesTexture(),
  };
  return cached;
}

export function disposeVoxelTextures(): void {
  if (!cached) return;
  Object.values(cached).forEach(tex => tex.dispose());
  cached = null;
}
