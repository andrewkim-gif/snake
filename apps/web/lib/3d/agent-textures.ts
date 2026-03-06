/**
 * agent-textures — 프로시저럴 16x16 Canvas 텍스처 생성
 * MC 스타일 Agent 파트별 텍스처 (Head, Body, Arm, Leg)
 * NearestFilter + no mipmaps → 픽셀 아트 렌더링
 * 기존 sprites.ts의 SKIN_PALETTE(DEFAULT_SKINS) 재사용
 */

import * as THREE from 'three';
import { DEFAULT_SKINS } from '@snake-arena/shared';

// ─── Types ───

export interface AgentTextures {
  head: THREE.CanvasTexture;
  body: THREE.CanvasTexture;
  arm: THREE.CanvasTexture;
  leg: THREE.CanvasTexture;
}

// ─── 텍스처 캐시 ───
const textureCache = new Map<string, AgentTextures>();

const TEX_SIZE = 16;

// ─── 색상 유틸 ───

function hexToRgb(hex: string): [number, number, number] {
  const h = parseInt(hex.slice(1), 16);
  return [(h >> 16) & 0xff, (h >> 8) & 0xff, h & 0xff];
}

function darkenHex(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const dr = Math.max(0, Math.round(r * (1 - amount)));
  const dg = Math.max(0, Math.round(g * (1 - amount)));
  const db = Math.max(0, Math.round(b * (1 - amount)));
  return `#${((dr << 16) | (dg << 8) | db).toString(16).padStart(6, '0')}`;
}

function lightenHex(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const lr = Math.min(255, Math.round(r + (255 - r) * amount));
  const lg = Math.min(255, Math.round(g + (255 - g) * amount));
  const lb = Math.min(255, Math.round(b + (255 - b) * amount));
  return `#${((lr << 16) | (lg << 8) | lb).toString(16).padStart(6, '0')}`;
}

function lerpHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bVal = Math.round(ab + (bb - ab) * t);
  return `#${((r << 16) | (g << 8) | bVal).toString(16).padStart(6, '0')}`;
}

// ─── 피부톤 팔레트 ───
const SKIN_TONE = '#D4A574'; // MC 기본 스킨톤

// ─── Canvas 텍스처 생성 헬퍼 ───

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

function fillRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
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

// ─── 스킨 정보 조회 ───

function getSkinData(skinId: number) {
  const skin = DEFAULT_SKINS[skinId % DEFAULT_SKINS.length];
  return {
    primary: skin.primaryColor,
    secondary: skin.secondaryColor,
    pattern: skin.pattern,
    eyeStyle: skin.eyeStyle,
    darkPrimary: darkenHex(skin.primaryColor, 0.25),
    lightPrimary: lightenHex(skin.primaryColor, 0.2),
    darkSecondary: darkenHex(skin.secondaryColor, 0.25),
  };
}

// ─── Head 텍스처 생성 (16x16) ───

export function generateHeadTexture(skinId: number): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();
  const s = getSkinData(skinId);

  // 머리 전체 피부톤 베이스
  fillRect(ctx, 0, 0, 16, 16, SKIN_TONE);

  // 머리카락 (상단 4행) — primary 색상
  fillRect(ctx, 0, 0, 16, 4, s.primary);
  // 양옆 머리카락
  fillRect(ctx, 0, 4, 2, 4, s.darkPrimary);
  fillRect(ctx, 14, 4, 2, 4, s.darkPrimary);

  // 눈 (row 5-7)
  drawEyes(ctx, s.eyeStyle);

  // 코
  px(ctx, 7, 9, darkenHex(SKIN_TONE, 0.1));
  px(ctx, 8, 9, darkenHex(SKIN_TONE, 0.1));

  // 입
  px(ctx, 6, 11, s.darkPrimary);
  px(ctx, 7, 11, s.darkPrimary);
  px(ctx, 8, 11, s.darkPrimary);
  px(ctx, 9, 11, s.darkPrimary);

  return toCanvasTexture(canvas);
}

function drawEyes(ctx: CanvasRenderingContext2D, eyeStyle: string): void {
  const white = '#FFFFFF';
  const black = '#3A3028';

  switch (eyeStyle) {
    case 'dot':
      // 작은 점 눈
      px(ctx, 5, 6, black); px(ctx, 10, 6, black);
      break;
    case 'angry':
      // 화난 눈 (V자 눈썹)
      px(ctx, 4, 5, black); px(ctx, 5, 5, black);
      px(ctx, 10, 5, black); px(ctx, 11, 5, black);
      fillRect(ctx, 4, 6, 3, 2, white);
      fillRect(ctx, 9, 6, 3, 2, white);
      px(ctx, 5, 7, black); px(ctx, 10, 7, black);
      break;
    case 'cute':
      // 큰 동그란 눈
      fillRect(ctx, 4, 5, 3, 3, white);
      fillRect(ctx, 9, 5, 3, 3, white);
      px(ctx, 5, 6, black); px(ctx, 6, 6, black);
      px(ctx, 10, 6, black); px(ctx, 11, 6, black);
      // 하이라이트
      px(ctx, 4, 5, '#CCDDFF');
      px(ctx, 9, 5, '#CCDDFF');
      break;
    case 'cool':
      // 선글라스
      fillRect(ctx, 3, 5, 5, 3, '#222222');
      fillRect(ctx, 8, 5, 5, 3, '#222222');
      px(ctx, 7, 5, '#222222'); // 브릿지
      px(ctx, 8, 5, '#222222');
      px(ctx, 5, 6, '#111111'); px(ctx, 10, 6, '#111111');
      break;
    case 'wink':
      // 윙크
      fillRect(ctx, 4, 5, 3, 3, white);
      px(ctx, 5, 6, black); px(ctx, 6, 6, black);
      // 오른쪽: 감은 눈
      px(ctx, 9, 7, black); px(ctx, 10, 7, black); px(ctx, 11, 7, black);
      break;
    default:
      // 기본 눈
      fillRect(ctx, 4, 5, 3, 3, white);
      fillRect(ctx, 9, 5, 3, 3, white);
      px(ctx, 5, 6, black); px(ctx, 6, 7, white);
      px(ctx, 10, 6, black); px(ctx, 9, 7, white);
      break;
  }
}

// ─── Body 텍스처 생성 (16x16) ───

export function generateBodyTexture(skinId: number): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();
  const s = getSkinData(skinId);

  // 의상 기본 색상
  fillRect(ctx, 0, 0, 16, 16, s.primary);

  // 패턴 적용
  applyPattern(ctx, s.pattern, s.primary, s.secondary, s.lightPrimary, s.darkPrimary);

  // 의상 테두리 (외곽선)
  for (let x = 0; x < 16; x++) {
    px(ctx, x, 0, s.darkPrimary);
    px(ctx, x, 15, s.darkPrimary);
  }
  for (let y = 0; y < 16; y++) {
    px(ctx, 0, y, s.darkPrimary);
    px(ctx, 15, y, s.darkPrimary);
  }

  // 벨트 라인 (하단)
  fillRect(ctx, 1, 13, 14, 2, s.darkSecondary);

  return toCanvasTexture(canvas);
}

function applyPattern(
  ctx: CanvasRenderingContext2D,
  pattern: string,
  primary: string,
  secondary: string,
  lightPrimary: string,
  darkPrimary: string,
): void {
  switch (pattern) {
    case 'striped':
      for (let y = 0; y < 16; y++) {
        if (y % 4 < 2) {
          fillRect(ctx, 1, y, 14, 1, secondary);
        }
      }
      break;
    case 'gradient':
      for (let y = 0; y < 16; y++) {
        const t = y / 15;
        fillRect(ctx, 1, y, 14, 1, lerpHex(primary, secondary, t));
      }
      break;
    case 'dotted':
      for (let y = 1; y < 15; y += 3) {
        for (let x = 1; x < 15; x += 3) {
          px(ctx, x, y, lightPrimary);
          px(ctx, x + 1, y, lightPrimary);
          px(ctx, x, y + 1, lightPrimary);
          px(ctx, x + 1, y + 1, lightPrimary);
        }
      }
      break;
    // solid: 이미 기본 색상으로 채워짐
  }
}

// ─── Arm 텍스처 생성 (16x16, 실제 4x12 비율이지만 텍스처는 16x16) ───

export function generateArmTexture(skinId: number): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();
  const s = getSkinData(skinId);

  // 상단 8행: 의상(슬리브) 색상
  fillRect(ctx, 0, 0, 16, 10, s.primary);

  // 패턴이 striped/gradient면 적용
  if (s.pattern === 'striped') {
    for (let y = 0; y < 10; y++) {
      if (y % 4 < 2) fillRect(ctx, 1, y, 14, 1, s.secondary);
    }
  } else if (s.pattern === 'gradient') {
    for (let y = 0; y < 10; y++) {
      const t = y / 9;
      fillRect(ctx, 1, y, 14, 1, lerpHex(s.primary, s.secondary, t));
    }
  }

  // 하단 6행: 피부톤 (손)
  fillRect(ctx, 0, 10, 16, 6, SKIN_TONE);

  // 외곽선
  for (let y = 0; y < 16; y++) {
    px(ctx, 0, y, s.darkPrimary);
    px(ctx, 15, y, s.darkPrimary);
  }

  return toCanvasTexture(canvas);
}

// ─── Leg 텍스처 생성 (16x16) ───

export function generateLegTexture(skinId: number): THREE.CanvasTexture {
  const [canvas, ctx] = createCanvas();
  const s = getSkinData(skinId);

  // 바지 (상단 12행)
  fillRect(ctx, 0, 0, 16, 12, s.secondary);

  // 바지 패턴
  if (s.pattern === 'striped') {
    for (let y = 0; y < 12; y++) {
      if (y % 4 < 2) fillRect(ctx, 1, y, 14, 1, s.primary);
    }
  }

  // 신발 (하단 4행) — 어두운 톤
  fillRect(ctx, 0, 12, 16, 4, darkenHex(s.secondary, 0.4));

  // 외곽선
  for (let y = 0; y < 16; y++) {
    px(ctx, 0, y, s.darkSecondary);
    px(ctx, 15, y, s.darkSecondary);
  }

  return toCanvasTexture(canvas);
}

// ─── 캐시 관리 ───

/**
 * skinId별 Agent 텍스처 세트 가져오기 (캐싱)
 */
export function getAgentTextures(skinId: number): AgentTextures {
  const key = String(skinId);
  const cached = textureCache.get(key);
  if (cached) return cached;

  const textures: AgentTextures = {
    head: generateHeadTexture(skinId),
    body: generateBodyTexture(skinId),
    arm: generateArmTexture(skinId),
    leg: generateLegTexture(skinId),
  };

  textureCache.set(key, textures);
  return textures;
}

/**
 * 텍스처 캐시 해제 (메모리 정리)
 */
export function disposeTextureCache(): void {
  textureCache.forEach((textures) => {
    textures.head.dispose();
    textures.body.dispose();
    textures.arm.dispose();
    textures.leg.dispose();
  });
  textureCache.clear();
}
