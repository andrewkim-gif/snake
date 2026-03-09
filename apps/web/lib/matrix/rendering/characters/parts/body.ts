/**
 * game/rendering/characters/parts/body.ts - 몸통 렌더링
 *
 * 몸통, 의상 스타일, 패턴 렌더링
 */

import { BODY_WIDTH, BODY_HEIGHT } from '../constants';
import type { CharacterColors } from '../types';

export interface BodyRenderParams {
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  colors: CharacterColors;
  outfitStyle?: string;
  patternType?: string;
  patternColor?: string;
  accColor?: string;
}

// Helper: darken color
const darkenColor = (hex: string, percent: number): string => {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, ((num >> 16) & 255) * (1 - percent));
  const g = Math.max(0, ((num >> 8) & 255) * (1 - percent));
  const b = Math.max(0, (num & 255) * (1 - percent));
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
};

// Helper: rounded rect
const drawRoundedRect = (
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number, color: string
) => {
  const left = x - w / 2;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(left, y, w, h, r);
  ctx.fill();
};

/**
 * 기본 몸통 렌더링
 */
export function drawBodyBase(params: BodyRenderParams): void {
  const { ctx, colors } = params;
  const bodyRound = 6;
  drawRoundedRect(ctx, 0, 0, BODY_WIDTH, BODY_HEIGHT, bodyRound, colors.top);
}

/**
 * 의상 스타일 렌더링
 */
export function drawOutfitStyle(params: BodyRenderParams): void {
  const { ctx, colors, outfitStyle, accColor } = params;
  const accColorFinal = accColor || colors.acc;

  if (outfitStyle === 'apron') {
    // 앞치마
    const apronWidth = BODY_WIDTH + 2;
    const apronHeight = BODY_HEIGHT + 4;
    ctx.fillStyle = accColorFinal;
    ctx.beginPath();
    ctx.roundRect(-apronWidth / 2, 2, apronWidth, apronHeight - 2, [0, 0, 4, 4]);
    ctx.fill();
    // 끈
    ctx.fillRect(-3, -2, 6, 4);
    // 주머니
    ctx.fillStyle = darkenColor(accColorFinal, 0.15);
    ctx.fillRect(-4, 8, 8, 5);

  } else if (outfitStyle === 'chef') {
    // 쉐프복 - 버튼
    ctx.fillStyle = accColorFinal;
    for (const [bx, by] of [[-3, 5], [3, 5], [-3, 10], [3, 10]]) {
      ctx.beginPath();
      ctx.arc(bx, by, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

  } else if (outfitStyle === 'wrestler') {
    // 레슬링복 - 어깨 스트랩
    ctx.fillStyle = accColorFinal;
    // 왼쪽
    ctx.beginPath();
    ctx.moveTo(-BODY_WIDTH / 2, 0);
    ctx.lineTo(-BODY_WIDTH / 4, -2);
    ctx.lineTo(-BODY_WIDTH / 4, 4);
    ctx.lineTo(-BODY_WIDTH / 2, 6);
    ctx.closePath();
    ctx.fill();
    // 오른쪽
    ctx.beginPath();
    ctx.moveTo(BODY_WIDTH / 2, 0);
    ctx.lineTo(BODY_WIDTH / 4, -2);
    ctx.lineTo(BODY_WIDTH / 4, 4);
    ctx.lineTo(BODY_WIDTH / 2, 6);
    ctx.closePath();
    ctx.fill();

  } else if (outfitStyle === 'firefighter') {
    // 소방복 - 반사띠
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(-BODY_WIDTH / 2, 6, BODY_WIDTH, 2);
    ctx.fillRect(-BODY_WIDTH / 2, 11, BODY_WIDTH, 2);

  } else if (outfitStyle === 'suit' || outfitStyle === 'formal') {
    // 정장 - 넥타이와 라펠
    ctx.fillStyle = accColorFinal;
    // 넥타이
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-2, 3);
    ctx.lineTo(0, BODY_HEIGHT - 2);
    ctx.lineTo(2, 3);
    ctx.closePath();
    ctx.fill();
    // 라펠
    ctx.fillStyle = darkenColor(colors.top, 0.2);
    ctx.beginPath();
    ctx.moveTo(-BODY_WIDTH / 2, 0);
    ctx.lineTo(-2, 5);
    ctx.lineTo(-BODY_WIDTH / 2, 8);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(BODY_WIDTH / 2, 0);
    ctx.lineTo(2, 5);
    ctx.lineTo(BODY_WIDTH / 2, 8);
    ctx.closePath();
    ctx.fill();

  } else if (outfitStyle === 'dress' || outfitStyle === 'party_dress') {
    // 드레스 - 치마
    const skirtBottom = BODY_HEIGHT + 5;
    ctx.fillStyle = colors.top;
    ctx.beginPath();
    ctx.moveTo(-BODY_WIDTH / 2, BODY_HEIGHT - 2);
    ctx.lineTo(-BODY_WIDTH / 2 - 3, skirtBottom);
    ctx.lineTo(BODY_WIDTH / 2 + 3, skirtBottom);
    ctx.lineTo(BODY_WIDTH / 2, BODY_HEIGHT - 2);
    ctx.closePath();
    ctx.fill();
    // 리본 (파티 드레스)
    if (outfitStyle === 'party_dress') {
      ctx.fillStyle = accColorFinal;
      ctx.beginPath();
      ctx.ellipse(0, 3, 4, 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }

  } else if (outfitStyle === 'hero') {
    // 영웅 - 어깨 패드
    ctx.fillStyle = accColorFinal;
    ctx.beginPath();
    ctx.ellipse(-BODY_WIDTH / 2 - 1, 2, 4, 3, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(BODY_WIDTH / 2 + 1, 2, 4, 3, 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * 패턴 렌더링
 */
export function drawPattern(params: BodyRenderParams): void {
  const { ctx, patternType, patternColor } = params;
  if (!patternType || patternType === 'none') return;

  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = patternColor || '#ffffff';

  if (patternType === 'stripes') {
    for (let i = 0; i < BODY_HEIGHT; i += 4) {
      ctx.fillRect(-BODY_WIDTH / 2 + 1, i, BODY_WIDTH - 2, 1);
    }

  } else if (patternType === 'dots') {
    for (let x = -4; x <= 4; x += 4) {
      for (let y = 3; y < BODY_HEIGHT - 2; y += 4) {
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

  } else if (patternType === 'stars') {
    // 별
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
      const px = 0 + Math.cos(angle) * 2;
      const py = 6 + Math.sin(angle) * 2;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

  } else if (patternType === 'flame') {
    ctx.beginPath();
    ctx.moveTo(0, BODY_HEIGHT - 4);
    ctx.quadraticCurveTo(-3, BODY_HEIGHT - 8, 0, BODY_HEIGHT - 12);
    ctx.quadraticCurveTo(3, BODY_HEIGHT - 8, 0, BODY_HEIGHT - 4);
    ctx.fill();

  } else if (patternType === 'lightning') {
    ctx.beginPath();
    ctx.moveTo(2, 2);
    ctx.lineTo(-2, 7);
    ctx.lineTo(1, 7);
    ctx.lineTo(-2, 12);
    ctx.lineTo(3, 6);
    ctx.lineTo(0, 6);
    ctx.closePath();
    ctx.fill();

  } else if (patternType === 'sparkle') {
    const positions = [[0, 5], [-4, 8], [3, 10]];
    positions.forEach(([sx, sy]) => {
      ctx.beginPath();
      ctx.moveTo(sx, sy - 2);
      ctx.lineTo(sx + 1, sy);
      ctx.lineTo(sx, sy + 2);
      ctx.lineTo(sx - 1, sy);
      ctx.closePath();
      ctx.fill();
    });

  } else if (patternType === 'heart') {
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.bezierCurveTo(-3, 5, -3, 3, 0, 5);
    ctx.bezierCurveTo(3, 3, 3, 5, 0, 8);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * 망토 렌더링 (몸통 뒤에 그려야 함)
 */
export function drawCape(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  accColor: string,
  time: number
): void {
  ctx.fillStyle = accColor;
  const capeWave = Math.sin(time / 200) * 2;
  ctx.beginPath();
  ctx.moveTo(-BODY_WIDTH / 2 - 1, 0);
  ctx.lineTo(-BODY_WIDTH / 2 - 4, BODY_HEIGHT + 5 + capeWave);
  ctx.lineTo(BODY_WIDTH / 2 + 4, BODY_HEIGHT + 5 - capeWave);
  ctx.lineTo(BODY_WIDTH / 2 + 1, 0);
  ctx.closePath();
  ctx.globalAlpha = 0.85;
  ctx.fill();
  ctx.globalAlpha = 1.0;
}

/**
 * 전체 몸통 렌더링 (통합)
 */
export function drawBody(params: BodyRenderParams): void {
  drawBodyBase(params);
  drawOutfitStyle(params);
  drawPattern(params);
}
