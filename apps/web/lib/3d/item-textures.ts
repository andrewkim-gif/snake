/**
 * item-textures.ts — 아이템 프로시저럴 16x16 CanvasTexture
 *
 * 5종 아이템: chicken, chest, bomb, magnet, xp_orb
 * agent-textures.ts 패턴 재사용 (NearestFilter + SRGBColorSpace)
 * 캐싱: textureCache Map
 */

import * as THREE from 'three';

// ─── Constants ───
const TEX_SIZE = 16;

// ─── 텍스처 캐시 ───
const textureCache = new Map<string, THREE.CanvasTexture>();

// ─── Canvas 헬퍼 ───

function createCanvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = TEX_SIZE;
  canvas.height = TEX_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
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

// ─── Chicken 텍스처 (뼈+고기) ───

function createChickenTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();

  // 배경: 투명 → 분홍 고기 기본
  fillRect(ctx, 0, 0, 16, 16, '#D4856B');

  // 고기 덩어리 (진한 분홍)
  fillRect(ctx, 3, 4, 10, 9, '#C06850');
  fillRect(ctx, 4, 3, 8, 11, '#C87060');

  // 뼈 (갈색 + 흰 관절)
  fillRect(ctx, 6, 0, 4, 4, '#E8D8B0');  // 뼈 상단
  fillRect(ctx, 7, 1, 2, 2, '#F0E8D0');  // 뼈 하이라이트
  fillRect(ctx, 7, 4, 2, 12, '#D4C49C');  // 뼈 줄기

  // 기름진 광택 하이라이트
  px(ctx, 5, 5, '#E8A090');
  px(ctx, 6, 6, '#E8A090');
  px(ctx, 9, 5, '#E8A090');
  px(ctx, 10, 7, '#E8A090');

  // 고기 그림자 (어두운 부분)
  fillRect(ctx, 3, 11, 10, 2, '#A85040');

  // 뼈 관절 끝
  px(ctx, 6, 14, '#E8D8B0');
  px(ctx, 9, 14, '#E8D8B0');
  px(ctx, 7, 15, '#F0E8D0');
  px(ctx, 8, 15, '#F0E8D0');

  return toCanvasTexture(canvas);
}

// ─── Chest 텍스처 (나무결+자물쇠) ───

function createChestTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();

  // 나무 기반 (갈색)
  fillRect(ctx, 0, 0, 16, 16, '#8B6D3C');

  // 나무 패널 경계
  fillRect(ctx, 0, 0, 16, 1, '#6B4D2C');  // 상단 테두리
  fillRect(ctx, 0, 15, 16, 1, '#6B4D2C');  // 하단 테두리
  fillRect(ctx, 0, 7, 16, 2, '#6B4D2C');   // 중간 경계 (뚜껑-본체)

  // 나무결 세로 줄무늬
  for (let x = 0; x < 16; x += 4) {
    for (let y = 0; y < 16; y++) {
      px(ctx, x, y, '#7B5D30');
    }
  }

  // 철 바인딩 (좌우)
  fillRect(ctx, 0, 0, 2, 16, '#555555');
  fillRect(ctx, 14, 0, 2, 16, '#555555');

  // 자물쇠 (금색)
  fillRect(ctx, 6, 8, 4, 5, '#FFD700');
  fillRect(ctx, 7, 9, 2, 3, '#DAA520');
  // 열쇠 구멍
  px(ctx, 7, 10, '#333333');
  px(ctx, 8, 10, '#333333');

  // 자물쇠 고리 (상단)
  px(ctx, 7, 7, '#FFD700');
  px(ctx, 8, 7, '#FFD700');

  // 나무 하이라이트
  px(ctx, 3, 3, '#A08050');
  px(ctx, 11, 4, '#A08050');
  px(ctx, 4, 12, '#A08050');
  px(ctx, 10, 13, '#A08050');

  return toCanvasTexture(canvas);
}

// ─── Bomb 텍스처 (도화선+금속) ───

function createBombTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();

  // 검은 구체 본체
  fillRect(ctx, 0, 0, 16, 16, '#1A1A1A');

  // 원형 구체 모양 (더 둥글게)
  fillRect(ctx, 3, 1, 10, 14, '#2A2A2A');
  fillRect(ctx, 1, 3, 14, 10, '#2A2A2A');
  fillRect(ctx, 2, 2, 12, 12, '#252525');

  // 금속 반사 하이라이트
  fillRect(ctx, 4, 3, 3, 3, '#4A4A4A');
  px(ctx, 5, 4, '#666666');

  // 하단 그림자
  fillRect(ctx, 4, 11, 8, 2, '#151515');

  // 도화선 (상단에서 나옴)
  px(ctx, 8, 0, '#8B4513');
  px(ctx, 9, 0, '#8B4513');
  px(ctx, 8, 1, '#A0522D');

  // 스파크 (도화선 끝)
  px(ctx, 9, 0, '#FF4500');
  px(ctx, 10, 0, '#FFA500');
  px(ctx, 8, 0, '#FFFF00');

  // 볼트/리벳 장식
  px(ctx, 4, 7, '#555555');
  px(ctx, 11, 7, '#555555');
  px(ctx, 7, 4, '#555555');
  px(ctx, 7, 11, '#555555');

  return toCanvasTexture(canvas);
}

// ─── Magnet 텍스처 (빨강/파랑 극) ───

function createMagnetTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();

  // 배경
  fillRect(ctx, 0, 0, 16, 16, '#888888');

  // U자형 형태
  // 빨강 왼쪽 기둥
  fillRect(ctx, 2, 2, 4, 12, '#CC2222');
  fillRect(ctx, 3, 3, 2, 10, '#DD3333');

  // 파랑 오른쪽 기둥
  fillRect(ctx, 10, 2, 4, 12, '#2244CC');
  fillRect(ctx, 11, 3, 2, 10, '#3355DD');

  // 바닥 연결 (은색/회색)
  fillRect(ctx, 2, 12, 12, 3, '#AAAAAA');
  fillRect(ctx, 3, 13, 10, 1, '#BBBBBB');

  // 양극 표시 (N/S)
  // N극 (빨간쪽 상단)
  px(ctx, 3, 3, '#FFFFFF');
  px(ctx, 4, 3, '#FFFFFF');
  // S극 (파란쪽 상단)
  px(ctx, 11, 3, '#FFFFFF');
  px(ctx, 12, 3, '#FFFFFF');

  // 하이라이트
  px(ctx, 2, 2, '#FF4444');
  px(ctx, 13, 2, '#4466FF');

  // 자기장 라인 효과 (중앙)
  px(ctx, 7, 4, '#DDDDDD');
  px(ctx, 8, 5, '#CCCCCC');
  px(ctx, 7, 6, '#DDDDDD');
  px(ctx, 8, 7, '#CCCCCC');
  px(ctx, 7, 8, '#DDDDDD');

  // 배경을 투명하게 처리 (U자 외곽)
  fillRect(ctx, 5, 0, 6, 12, '#888888');

  return toCanvasTexture(canvas);
}

// ─── XP Orb 텍스처 (방사형 글로우) ───

function createXpOrbTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();
  const cx = 8;
  const cy = 8;
  const maxR = 7;

  // 전체 캔버스를 어두운 초록으로 채움 (SphereGeometry에서 투명 픽셀 방지)
  ctx.fillStyle = 'rgb(30,180,40)';
  ctx.fillRect(0, 0, 16, 16);

  // 방사형 그라디언트: 밝은 초록 중심 → 어두운 초록 외곽
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const t = Math.min(dist / maxR, 1);

      // 밝은 초록 → 초록 → 어두운 초록
      const r = Math.round(150 + (30 - 150) * t);
      const g = Math.round(255 + (180 - 255) * t);
      const b = Math.round(100 + (40 - 100) * t);

      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  // 중심 발광 (밝은 화이트-그린)
  fillRect(ctx, 6, 6, 4, 4, '#CCFFCC');
  fillRect(ctx, 7, 7, 2, 2, '#EEFFEE');

  // 발광 스파클
  px(ctx, 4, 4, '#AAFFAA');
  px(ctx, 11, 5, '#AAFFAA');
  px(ctx, 3, 9, '#88EE88');
  px(ctx, 12, 10, '#88EE88');

  return toCanvasTexture(canvas);
}

// ─── 팩토리 맵 ───

const TEXTURE_CREATORS: Record<string, () => THREE.CanvasTexture> = {
  chicken: createChickenTexture,
  chest: createChestTexture,
  bomb: createBombTexture,
  magnet: createMagnetTexture,
  xp_orb: createXpOrbTexture,
};

// ─── Public API ───

/**
 * 아이템 타입별 CanvasTexture 반환 (캐싱)
 * @param itemType 아이템 타입 (chicken, chest, bomb, magnet, xp_orb, xp)
 */
export function getItemTexture(itemType: string): THREE.CanvasTexture | null {
  // 'xp' → 'xp_orb' 매핑
  const key = itemType === 'xp' ? 'xp_orb' : itemType;

  const cached = textureCache.get(key);
  if (cached) return cached;

  const creator = TEXTURE_CREATORS[key];
  if (!creator) return null;

  const tex = creator();
  textureCache.set(key, tex);
  return tex;
}

/**
 * 아이템 텍스처 캐시 해제 (메모리 정리)
 */
export function disposeItemTextureCache(): void {
  textureCache.forEach((tex) => tex.dispose());
  textureCache.clear();
}
