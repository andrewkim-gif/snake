/**
 * decoration-textures.ts — 바닥 장식 프로시저럴 CanvasTexture
 *
 * 4종: flower_red, flower_yellow, tall_grass, mushroom_red
 * 16x16 투명 배경 + 픽셀아트 스프라이트
 * MCVoxelTerrain에서 빌보드 PlaneGeometry로 렌더링
 */

import * as THREE from 'three';

const TEX_SIZE = 16;
const textureCache = new Map<string, THREE.CanvasTexture>();

// ─── Canvas 헬퍼 ───

function createCanvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = TEX_SIZE;
  canvas.height = TEX_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  // 투명 배경
  ctx.clearRect(0, 0, TEX_SIZE, TEX_SIZE);
  return [canvas, ctx];
}

function px(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

function fillRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function toCanvasTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ─── Flower Red (빨간 꽃) ───

function createFlowerRedTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();

  // 줄기
  fillRect(ctx, 7, 8, 2, 8, '#2D7A2D');
  px(ctx, 6, 12, '#3A8A3A');
  px(ctx, 9, 10, '#3A8A3A');

  // 잎
  px(ctx, 5, 11, '#3DA03D');
  px(ctx, 4, 12, '#3DA03D');
  px(ctx, 10, 9, '#3DA03D');
  px(ctx, 11, 10, '#3DA03D');

  // 꽃잎 (빨강)
  fillRect(ctx, 5, 3, 6, 6, '#DD2222');
  fillRect(ctx, 6, 2, 4, 1, '#DD2222');
  fillRect(ctx, 6, 9, 4, 1, '#DD2222');
  px(ctx, 4, 5, '#DD2222');
  px(ctx, 4, 6, '#DD2222');
  px(ctx, 11, 5, '#DD2222');
  px(ctx, 11, 6, '#DD2222');

  // 꽃 중심 (노란색)
  fillRect(ctx, 7, 5, 2, 2, '#FFDD00');

  // 꽃잎 하이라이트
  px(ctx, 6, 3, '#FF4444');
  px(ctx, 9, 4, '#FF4444');

  return toCanvasTexture(canvas);
}

// ─── Flower Yellow (노란 꽃) ───

function createFlowerYellowTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();

  // 줄기
  fillRect(ctx, 7, 9, 2, 7, '#2D7A2D');
  px(ctx, 6, 13, '#3A8A3A');

  // 잎
  px(ctx, 5, 12, '#3DA03D');
  px(ctx, 4, 13, '#3DA03D');
  px(ctx, 10, 11, '#3DA03D');

  // 꽃잎 (노란)
  fillRect(ctx, 5, 4, 6, 5, '#FFD700');
  fillRect(ctx, 6, 3, 4, 1, '#FFD700');
  fillRect(ctx, 6, 9, 4, 1, '#FFD700');
  px(ctx, 4, 6, '#FFD700');
  px(ctx, 11, 6, '#FFD700');

  // 꽃 중심 (갈색)
  fillRect(ctx, 7, 6, 2, 2, '#8B6914');

  // 하이라이트
  px(ctx, 6, 4, '#FFEE44');
  px(ctx, 9, 5, '#FFEE44');

  return toCanvasTexture(canvas);
}

// ─── Tall Grass (풀) ───

function createTallGrassTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();

  // 여러 풀잎
  const grassColors = ['#3A8A3A', '#4DA04D', '#2D7A2D', '#55B055', '#3D903D'];

  // 풀잎 1 (왼쪽)
  px(ctx, 3, 6, grassColors[0]);
  px(ctx, 3, 7, grassColors[0]);
  px(ctx, 4, 8, grassColors[0]);
  px(ctx, 4, 9, grassColors[0]);
  px(ctx, 4, 10, grassColors[0]);
  px(ctx, 5, 11, grassColors[0]);
  px(ctx, 5, 12, grassColors[0]);
  px(ctx, 5, 13, grassColors[0]);
  px(ctx, 6, 14, grassColors[0]);
  px(ctx, 6, 15, grassColors[0]);

  // 풀잎 2 (중앙 왼)
  px(ctx, 6, 4, grassColors[1]);
  px(ctx, 6, 5, grassColors[1]);
  px(ctx, 6, 6, grassColors[1]);
  px(ctx, 7, 7, grassColors[1]);
  px(ctx, 7, 8, grassColors[1]);
  px(ctx, 7, 9, grassColors[1]);
  px(ctx, 7, 10, grassColors[1]);
  px(ctx, 7, 11, grassColors[1]);
  px(ctx, 7, 12, grassColors[1]);
  px(ctx, 7, 13, grassColors[1]);
  px(ctx, 7, 14, grassColors[1]);
  px(ctx, 7, 15, grassColors[1]);

  // 풀잎 3 (중앙 오른)
  px(ctx, 9, 3, grassColors[2]);
  px(ctx, 9, 4, grassColors[2]);
  px(ctx, 8, 5, grassColors[2]);
  px(ctx, 8, 6, grassColors[2]);
  px(ctx, 8, 7, grassColors[2]);
  px(ctx, 8, 8, grassColors[2]);
  px(ctx, 8, 9, grassColors[2]);
  px(ctx, 8, 10, grassColors[2]);
  px(ctx, 8, 11, grassColors[2]);
  px(ctx, 8, 12, grassColors[2]);
  px(ctx, 8, 13, grassColors[2]);
  px(ctx, 8, 14, grassColors[2]);
  px(ctx, 8, 15, grassColors[2]);

  // 풀잎 4 (오른쪽)
  px(ctx, 11, 5, grassColors[3]);
  px(ctx, 11, 6, grassColors[3]);
  px(ctx, 10, 7, grassColors[3]);
  px(ctx, 10, 8, grassColors[3]);
  px(ctx, 10, 9, grassColors[3]);
  px(ctx, 9, 10, grassColors[3]);
  px(ctx, 9, 11, grassColors[3]);
  px(ctx, 9, 12, grassColors[3]);
  px(ctx, 9, 13, grassColors[3]);
  px(ctx, 9, 14, grassColors[3]);
  px(ctx, 9, 15, grassColors[3]);

  // 풀잎 5 (맨 오른쪽)
  px(ctx, 12, 7, grassColors[4]);
  px(ctx, 12, 8, grassColors[4]);
  px(ctx, 11, 9, grassColors[4]);
  px(ctx, 11, 10, grassColors[4]);
  px(ctx, 11, 11, grassColors[4]);
  px(ctx, 11, 12, grassColors[4]);
  px(ctx, 10, 13, grassColors[4]);
  px(ctx, 10, 14, grassColors[4]);
  px(ctx, 10, 15, grassColors[4]);

  return toCanvasTexture(canvas);
}

// ─── Mushroom Red (빨간 버섯) ───

function createMushroomRedTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();

  // 줄기 (흰/베이지)
  fillRect(ctx, 6, 9, 4, 7, '#E8E0D0');
  fillRect(ctx, 7, 10, 2, 6, '#F0E8D8');

  // 갓 (빨강 + 흰 점)
  fillRect(ctx, 3, 4, 10, 6, '#CC2222');
  fillRect(ctx, 4, 3, 8, 1, '#CC2222');
  fillRect(ctx, 5, 2, 6, 1, '#CC2222');
  px(ctx, 2, 6, '#CC2222');
  px(ctx, 2, 7, '#CC2222');
  px(ctx, 13, 6, '#CC2222');
  px(ctx, 13, 7, '#CC2222');

  // 흰 점 (독버섯 특유)
  px(ctx, 5, 3, '#FFFFFF');
  px(ctx, 10, 4, '#FFFFFF');
  px(ctx, 4, 6, '#FFFFFF');
  px(ctx, 7, 5, '#FFFFFF');
  px(ctx, 11, 7, '#FFFFFF');
  px(ctx, 8, 3, '#FFFFFF');

  // 갓 아래쪽 그림자
  fillRect(ctx, 3, 9, 10, 1, '#993333');

  // 줄기 그림자
  px(ctx, 6, 10, '#D8D0C0');
  px(ctx, 9, 11, '#D8D0C0');

  return toCanvasTexture(canvas);
}

// ─── 팩토리 ───

const TEXTURE_CREATORS: Record<string, () => THREE.CanvasTexture> = {
  flower_red: createFlowerRedTexture,
  flower_yellow: createFlowerYellowTexture,
  tall_grass: createTallGrassTexture,
  mushroom_red: createMushroomRedTexture,
};

export type DecorationType = 'flower_red' | 'flower_yellow' | 'tall_grass' | 'mushroom_red';

export const DECORATION_TYPES: DecorationType[] = ['flower_red', 'flower_yellow', 'tall_grass', 'mushroom_red'];

/**
 * 장식 타입별 CanvasTexture 반환 (캐싱)
 */
export function getDecorationTexture(type: string): THREE.CanvasTexture | null {
  const cached = textureCache.get(type);
  if (cached) return cached;

  const creator = TEXTURE_CREATORS[type];
  if (!creator) return null;

  const tex = creator();
  textureCache.set(type, tex);
  return tex;
}

/**
 * 장식 텍스처 캐시 해제
 */
export function disposeDecorationTextureCache(): void {
  textureCache.forEach((tex) => tex.dispose());
  textureCache.clear();
}
