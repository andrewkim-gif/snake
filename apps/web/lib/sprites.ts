/**
 * AgentSkin 프로시저럴 스프라이트 생성 시스템
 * Canvas 2D 기반 16x16 MC 스타일 블록 캐릭터
 * 이미지 파일 불필요 — 모든 스프라이트를 코드로 생성 + 캐싱
 */

import type { SnakeSkin } from '@snake-arena/shared';

// ─── 스프라이트 캐시 ───
const spriteCache = new Map<number, HTMLCanvasElement>();

// 고해상도 렌더링을 위한 스프라이트 크기 (16x16 논리 → 64x64 물리)
const SPRITE_SIZE = 16;
const RENDER_SCALE = 4; // 4x 업스케일
const CANVAS_SIZE = SPRITE_SIZE * RENDER_SCALE; // 64px

/**
 * Agent 스프라이트 가져오기 (캐싱)
 * skinId를 키로 사용하여 캐시된 Canvas 반환
 */
export function getAgentSprite(skinId: number, skin: SnakeSkin | { primaryColor: string; secondaryColor: string; pattern: string; eyeStyle: string }): HTMLCanvasElement {
  if (spriteCache.has(skinId)) {
    return spriteCache.get(skinId)!;
  }

  const canvas = generateAgentSprite(skinId, skin);
  spriteCache.set(skinId, canvas);
  return canvas;
}

/** 스프라이트 캐시 초기화 (스킨 변경 시) */
export function clearSpriteCache(): void {
  spriteCache.clear();
}

/**
 * 16x16 MC 스타일 블록 캐릭터 생성
 * 구조: 머리(상단 4행), 몸통(중간 8행), 다리(하단 4행)
 */
function generateAgentSprite(
  skinId: number,
  skin: { primaryColor: string; secondaryColor: string; pattern?: string; eyeStyle?: string },
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  const ctx = canvas.getContext('2d')!;

  // 픽셀 아트 스타일 — 앤티앨리어싱 비활성화
  ctx.imageSmoothingEnabled = false;

  const s = RENDER_SCALE; // 픽셀당 실제 크기
  const primary = skin.primaryColor;
  const secondary = skin.secondaryColor;
  const pattern = skin.pattern ?? 'solid';
  const eyeStyle = skin.eyeStyle ?? 'default';

  // 색상 파생
  const darkPrimary = darkenHex(primary, 0.25);
  const lightPrimary = lightenHex(primary, 0.2);
  const darkSecondary = darkenHex(secondary, 0.25);

  // ─── 각 스킨 별 고유 캐릭터 디자인 ───
  // skinId 0-11: Common (기본 해금), 12-23: 패턴 변형

  // 범용 MC 캐릭터 그리기
  drawMCCharacter(ctx, s, {
    primary,
    secondary,
    darkPrimary,
    lightPrimary,
    darkSecondary,
    pattern,
    eyeStyle,
    skinId,
  });

  return canvas;
}

interface CharacterColors {
  primary: string;
  secondary: string;
  darkPrimary: string;
  lightPrimary: string;
  darkSecondary: string;
  pattern: string;
  eyeStyle: string;
  skinId: number;
}

/**
 * MC 스타일 블록 캐릭터 그리기
 * 16x16 그리드에 픽셀 단위로 그림
 */
function drawMCCharacter(
  ctx: CanvasRenderingContext2D,
  s: number, // 픽셀 스케일
  c: CharacterColors,
): void {
  const px = (x: number, y: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x * s, y * s, s, s);
  };

  // ─── 머리 (y: 0-5, 6행) ───
  // 머리 테두리
  for (let x = 4; x <= 11; x++) px(x, 0, c.darkPrimary);
  for (let y = 1; y <= 4; y++) { px(3, y, c.darkPrimary); px(12, y, c.darkPrimary); }
  for (let x = 4; x <= 11; x++) px(x, 5, c.darkPrimary);

  // 머리 내부 fill
  for (let y = 1; y <= 4; y++) {
    for (let x = 4; x <= 11; x++) {
      px(x, y, c.primary);
    }
  }

  // 머리 하이라이트 (좌상단)
  px(4, 1, c.lightPrimary);
  px(5, 1, c.lightPrimary);

  // 눈 (y: 2-3)
  if (c.eyeStyle === 'dot') {
    // 큰 점 눈
    px(5, 2, '#FFFFFF'); px(6, 2, '#FFFFFF');
    px(9, 2, '#FFFFFF'); px(10, 2, '#FFFFFF');
    px(5, 3, '#3A3028'); px(6, 3, '#3A3028');
    px(9, 3, '#3A3028'); px(10, 3, '#3A3028');
    // 하이라이트
    px(5, 2, '#FFFFFF');
    px(9, 2, '#FFFFFF');
  } else if (c.eyeStyle === 'angry') {
    // 화난 눈 (눈썹 각도)
    px(5, 2, '#FFFFFF'); px(6, 2, '#3A3028'); // 왼눈+눈썹
    px(5, 3, '#3A3028');
    px(9, 3, '#3A3028');
    px(10, 2, '#3A3028'); px(9, 2, '#FFFFFF'); // 오른눈+눈썹
    px(10, 3, '#FFFFFF');
  } else if (c.eyeStyle === 'cute') {
    // 큰 둥근 눈
    px(5, 2, '#FFFFFF'); px(6, 2, '#FFFFFF');
    px(5, 3, '#FFFFFF'); px(6, 3, '#3A3028');
    px(9, 2, '#FFFFFF'); px(10, 2, '#FFFFFF');
    px(9, 3, '#3A3028'); px(10, 3, '#FFFFFF');
    // 큰 하이라이트
    px(5, 2, '#FFFFFF');
    px(9, 2, '#FFFFFF');
  } else if (c.eyeStyle === 'cool') {
    // 선글라스
    px(4, 2, '#3A3028'); px(5, 2, '#3A3028'); px(6, 2, '#3A3028'); px(7, 2, '#3A3028');
    px(8, 2, '#3A3028'); px(9, 2, '#3A3028'); px(10, 2, '#3A3028'); px(11, 2, '#3A3028');
    px(5, 3, '#1A1510'); px(6, 3, '#1A1510');
    px(9, 3, '#1A1510'); px(10, 3, '#1A1510');
  } else if (c.eyeStyle === 'wink') {
    // 윙크 (왼쪽 열림, 오른쪽 감김)
    px(5, 2, '#FFFFFF'); px(6, 2, '#FFFFFF');
    px(5, 3, '#3A3028'); px(6, 3, '#FFFFFF');
    // 오른쪽: 감은 눈 (가로선)
    px(9, 3, '#3A3028'); px(10, 3, '#3A3028');
  } else {
    // 기본 눈
    px(5, 2, '#FFFFFF'); px(6, 2, '#FFFFFF');
    px(5, 3, '#3A3028'); px(6, 3, '#FFFFFF');
    px(9, 2, '#FFFFFF'); px(10, 2, '#FFFFFF');
    px(9, 3, '#FFFFFF'); px(10, 3, '#3A3028');
  }

  // 입 (y: 4)
  px(7, 4, c.darkPrimary);
  px(8, 4, c.darkPrimary);

  // ─── 몸통 (y: 6-11, 6행) ───
  const bodyColor = c.pattern === 'striped' || c.pattern === 'gradient' ? c.secondary : c.primary;
  const bodyAccent = c.pattern === 'striped' ? c.primary : c.secondary;

  // 몸통 테두리
  for (let x = 3; x <= 12; x++) px(x, 6, c.darkPrimary);
  for (let y = 7; y <= 10; y++) { px(2, y, c.darkPrimary); px(13, y, c.darkPrimary); }
  for (let x = 3; x <= 12; x++) px(x, 11, c.darkPrimary);

  // 몸통 fill
  for (let y = 7; y <= 10; y++) {
    for (let x = 3; x <= 12; x++) {
      if (c.pattern === 'striped') {
        px(x, y, y % 2 === 0 ? c.primary : c.secondary);
      } else if (c.pattern === 'gradient') {
        const t = (y - 7) / 3;
        px(x, y, lerpHex(c.primary, c.secondary, t));
      } else if (c.pattern === 'dotted') {
        const isDot = (x + y) % 3 === 0;
        px(x, y, isDot ? c.secondary : c.primary);
      } else {
        px(x, y, c.primary);
      }
    }
  }

  // 팔 (좌우 확장)
  for (let y = 7; y <= 9; y++) {
    px(1, y, c.darkPrimary);
    px(2, y, bodyColor);
    px(13, y, bodyColor);
    px(14, y, c.darkPrimary);
  }

  // 벨트/장식 (y: 10)
  for (let x = 4; x <= 11; x++) {
    px(x, 10, c.darkSecondary);
  }

  // ─── 다리 (y: 12-15, 4행) ───
  // 왼쪽 다리
  for (let y = 12; y <= 14; y++) {
    px(4, y, c.darkPrimary); px(5, y, c.secondary); px(6, y, c.secondary); px(7, y, c.darkPrimary);
  }
  // 신발
  px(3, 15, c.darkPrimary); px(4, 15, '#3A3028'); px(5, 15, '#3A3028');
  px(6, 15, '#3A3028'); px(7, 15, c.darkPrimary);

  // 오른쪽 다리
  for (let y = 12; y <= 14; y++) {
    px(8, y, c.darkPrimary); px(9, y, c.secondary); px(10, y, c.secondary); px(11, y, c.darkPrimary);
  }
  // 신발
  px(8, 15, c.darkPrimary); px(9, 15, '#3A3028'); px(10, 15, '#3A3028');
  px(11, 15, '#3A3028'); px(12, 15, c.darkPrimary);
}

// ─── 색상 유틸 ───

function darkenHex(hex: string, amount: number): string {
  const h = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.round(((h >> 16) & 0xff) * (1 - amount)));
  const g = Math.max(0, Math.round(((h >> 8) & 0xff) * (1 - amount)));
  const b = Math.max(0, Math.round((h & 0xff) * (1 - amount)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function lightenHex(hex: string, amount: number): string {
  const h = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((h >> 16) & 0xff) + (255 - ((h >> 16) & 0xff)) * amount));
  const g = Math.min(255, Math.round(((h >> 8) & 0xff) + (255 - ((h >> 8) & 0xff)) * amount));
  const b = Math.min(255, Math.round((h & 0xff) + (255 - (h & 0xff)) * amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function lerpHex(a: string, b: string, t: number): string {
  const ah = parseInt(a.slice(1), 16);
  const bh = parseInt(b.slice(1), 16);
  const ar = (ah >> 16) & 0xff, ag = (ah >> 8) & 0xff, ab = ah & 0xff;
  const br = (bh >> 16) & 0xff, bg = (bh >> 8) & 0xff, bb = bh & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bVal = Math.round(ab + (bb - ab) * t);
  return `#${((r << 16) | (g << 8) | bVal).toString(16).padStart(6, '0')}`;
}
