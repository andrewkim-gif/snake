/**
 * game/rendering/characters/utils.ts - 캐릭터 렌더링 유틸리티
 */

import { LIMB_WIDTH, LIMB_LENGTH } from './constants';

/**
 * 색상 어둡게
 */
export function darkenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, ((num >> 16) & 255) * (1 - percent));
  const g = Math.max(0, ((num >> 8) & 255) * (1 - percent));
  const b = Math.max(0, (num & 255) * (1 - percent));
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

/**
 * 색상 밝게
 */
export function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, ((num >> 16) & 255) + (255 - ((num >> 16) & 255)) * percent);
  const g = Math.min(255, ((num >> 8) & 255) + (255 - ((num >> 8) & 255)) * percent);
  const b = Math.min(255, (num & 255) + (255 - (num & 255)) * percent);
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

/**
 * 둥근 사각형 그리기
 */
export function drawRoundedRect(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  color: string
): void {
  const left = x - w / 2;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(left, y, w, h, r);
  ctx.fill();
}

/**
 * 팔/다리 그리기 (SVG 스타일)
 */
export function drawLimb(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  color: string,
  isLeg: boolean = false
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle * Math.PI / 180);

  ctx.fillStyle = color;
  ctx.beginPath();

  if (isLeg) {
    // SVG 스타일: 뾰족한 삼각형 다리 (위에서 아래로 좁아짐)
    const topWidth = LIMB_WIDTH + 1;
    const bottomWidth = 2;
    ctx.moveTo(-topWidth / 2, 0);
    ctx.lineTo(topWidth / 2, 0);
    ctx.lineTo(bottomWidth / 2, LIMB_LENGTH);
    ctx.lineTo(-bottomWidth / 2, LIMB_LENGTH);
    ctx.closePath();
    ctx.fill();

    // 신발 (더 둥글게)
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, LIMB_LENGTH + 1, 3, 2, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // SVG 스타일 팔
    const armLength = LIMB_LENGTH * 0.6;
    const topWidth = LIMB_WIDTH - 1;
    const bottomWidth = 2;
    ctx.moveTo(-topWidth / 2, 0);
    ctx.lineTo(topWidth / 2, 0);
    ctx.lineTo(bottomWidth / 2, armLength);
    ctx.lineTo(-bottomWidth / 2, armLength);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

/**
 * 이징 함수: 천천히 → 빠르게 → 천천히
 */
export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
