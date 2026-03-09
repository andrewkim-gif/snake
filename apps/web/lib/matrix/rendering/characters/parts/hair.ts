/**
 * game/rendering/characters/parts/hair.ts - 헤어스타일 렌더링
 *
 * 10+ 헤어스타일 렌더링
 */

import { HEAD_SIZE, HEAD_Y } from '../constants';
import type { HairStyle, CharacterColors } from '../types';

export interface HairRenderParams {
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  hairStyle: HairStyle;
  colors: CharacterColors;
}

/**
 * 머리통 (두개골) 렌더링 - 헬멧류가 아닌 경우에만
 */
export function drawSkull(params: HairRenderParams): void {
  const { ctx, hairStyle, colors } = params;

  // 헬멧류는 스킵
  if (hairStyle === 'helmet' || hairStyle === 'fire_helmet') return;

  ctx.fillStyle = colors.hair;
  const skullRadius = HEAD_SIZE * 0.65;

  // 머리통 (두개골) - 둥근 원형
  ctx.beginPath();
  ctx.arc(0, HEAD_Y + HEAD_SIZE * 0.1, skullRadius, 0, Math.PI * 2);
  ctx.fill();

  // 스타일별 옆머리
  if (hairStyle === 'long') {
    drawLongSideHair(ctx, colors.hair);
  } else if (hairStyle === 'bob') {
    drawBobSideHair(ctx, colors.hair);
  }
}

/**
 * 긴머리 옆머리
 */
function drawLongSideHair(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  hairColor: string
): void {
  ctx.fillStyle = hairColor;
  const hairWidth = HEAD_SIZE / 2 + 2;
  const hairBottom = HEAD_Y + HEAD_SIZE + 6;

  // 왼쪽
  ctx.beginPath();
  ctx.moveTo(-HEAD_SIZE / 2, HEAD_Y + HEAD_SIZE * 0.3);
  ctx.lineTo(-hairWidth, HEAD_Y + HEAD_SIZE * 0.4);
  ctx.lineTo(-hairWidth, hairBottom);
  ctx.quadraticCurveTo(-hairWidth + 2, hairBottom + 1, -HEAD_SIZE / 2, HEAD_Y + HEAD_SIZE);
  ctx.closePath();
  ctx.fill();

  // 오른쪽
  ctx.beginPath();
  ctx.moveTo(HEAD_SIZE / 2, HEAD_Y + HEAD_SIZE * 0.3);
  ctx.lineTo(hairWidth, HEAD_Y + HEAD_SIZE * 0.4);
  ctx.lineTo(hairWidth, hairBottom);
  ctx.quadraticCurveTo(hairWidth - 2, hairBottom + 1, HEAD_SIZE / 2, HEAD_Y + HEAD_SIZE);
  ctx.closePath();
  ctx.fill();
}

/**
 * 단발 옆머리
 */
function drawBobSideHair(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  hairColor: string
): void {
  ctx.fillStyle = hairColor;

  // 왼쪽
  ctx.beginPath();
  ctx.moveTo(-HEAD_SIZE / 2, HEAD_Y + HEAD_SIZE * 0.3);
  ctx.lineTo(-HEAD_SIZE / 2 - 1.5, HEAD_Y + HEAD_SIZE * 0.5);
  ctx.lineTo(-HEAD_SIZE / 2 - 1.5, HEAD_Y + HEAD_SIZE - 1);
  ctx.quadraticCurveTo(-HEAD_SIZE / 2 - 1, HEAD_Y + HEAD_SIZE, -HEAD_SIZE / 2 + 1, HEAD_Y + HEAD_SIZE);
  ctx.closePath();
  ctx.fill();

  // 오른쪽
  ctx.beginPath();
  ctx.moveTo(HEAD_SIZE / 2, HEAD_Y + HEAD_SIZE * 0.3);
  ctx.lineTo(HEAD_SIZE / 2 + 1.5, HEAD_Y + HEAD_SIZE * 0.5);
  ctx.lineTo(HEAD_SIZE / 2 + 1.5, HEAD_Y + HEAD_SIZE - 1);
  ctx.quadraticCurveTo(HEAD_SIZE / 2 + 1, HEAD_Y + HEAD_SIZE, HEAD_SIZE / 2 - 1, HEAD_Y + HEAD_SIZE);
  ctx.closePath();
  ctx.fill();
}

/**
 * 헬멧 렌더링
 */
export function drawHelmet(params: HairRenderParams): void {
  const { ctx, colors } = params;

  ctx.fillStyle = colors.top;
  ctx.beginPath();
  ctx.arc(0, HEAD_Y - 4, HEAD_SIZE / 2 + 2, Math.PI, 0);
  ctx.lineTo(HEAD_SIZE / 2 + 2, HEAD_Y + 2);
  ctx.lineTo(-HEAD_SIZE / 2 - 2, HEAD_Y + 2);
  ctx.fill();

  // 띠
  ctx.fillStyle = '#fff';
  ctx.fillRect(-HEAD_SIZE / 2 - 2, HEAD_Y - 1, HEAD_SIZE + 4, 3);

  // 라이트
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(0, HEAD_Y - HEAD_SIZE / 2 - 8, 3, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * 소방 헬멧 렌더링
 */
export function drawFireHelmet(params: HairRenderParams): void {
  const { ctx } = params;

  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.arc(0, HEAD_Y - 4, HEAD_SIZE / 2 + 3, Math.PI, 0);
  ctx.fill();

  // 챙
  ctx.beginPath();
  ctx.moveTo(-HEAD_SIZE / 2 - 4, HEAD_Y + 2);
  ctx.quadraticCurveTo(0, HEAD_Y - 3, HEAD_SIZE / 2 + 4, HEAD_Y + 2);
  ctx.lineTo(HEAD_SIZE / 2 + 4, HEAD_Y + 5);
  ctx.lineTo(-HEAD_SIZE / 2 - 4, HEAD_Y + 5);
  ctx.fill();

  // 마크
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.moveTo(0, HEAD_Y - 12);
  ctx.lineTo(-3, HEAD_Y - 7);
  ctx.lineTo(3, HEAD_Y - 7);
  ctx.fill();
}

/**
 * 앞머리 렌더링
 */
export function drawBangs(params: HairRenderParams): void {
  const { ctx, hairStyle, colors } = params;

  if (hairStyle === 'helmet' || hairStyle === 'fire_helmet') return;

  ctx.fillStyle = colors.hair;

  if (hairStyle === 'bob') {
    const bangBottom = HEAD_Y + HEAD_SIZE * 0.38;
    ctx.beginPath();
    ctx.moveTo(-HEAD_SIZE / 2, HEAD_Y + HEAD_SIZE * 0.1);
    ctx.quadraticCurveTo(-HEAD_SIZE / 4, bangBottom, 0, bangBottom - 1);
    ctx.quadraticCurveTo(HEAD_SIZE / 4, bangBottom, HEAD_SIZE / 2, HEAD_Y + HEAD_SIZE * 0.1);
    ctx.lineTo(HEAD_SIZE / 2, HEAD_Y - HEAD_SIZE * 0.2);
    ctx.lineTo(-HEAD_SIZE / 2, HEAD_Y - HEAD_SIZE * 0.2);
    ctx.closePath();
    ctx.fill();

  } else if (hairStyle === 'long') {
    const bangBottom = HEAD_Y + HEAD_SIZE * 0.38;
    ctx.fillRect(-HEAD_SIZE / 2 + 1, HEAD_Y - HEAD_SIZE * 0.1, HEAD_SIZE - 2, bangBottom - HEAD_Y + HEAD_SIZE * 0.1);

  } else if (hairStyle === 'short_bangs') {
    const bangBottom = HEAD_Y + HEAD_SIZE * 0.32;
    ctx.fillRect(-HEAD_SIZE / 2 + 1, HEAD_Y - HEAD_SIZE * 0.1, HEAD_SIZE - 2, bangBottom - HEAD_Y + HEAD_SIZE * 0.1);
  }
  // neo_slick, short: 앞머리 없음
}

/**
 * 헤어 디테일 렌더링 (삐죽머리, 곱슬머리 등)
 */
export function drawHairDetail(params: HairRenderParams): void {
  const { ctx, hairStyle, colors } = params;

  ctx.fillStyle = colors.hair;

  if (hairStyle === 'spiky') {
    // 삐죽머리
    const spikeX = HEAD_SIZE * 0.3;
    ctx.beginPath();
    ctx.moveTo(-spikeX, HEAD_Y - HEAD_SIZE * 0.3);
    ctx.lineTo(-spikeX * 0.5, HEAD_Y - HEAD_SIZE * 0.6);
    ctx.lineTo(0, HEAD_Y - HEAD_SIZE * 0.35);
    ctx.lineTo(spikeX * 0.5, HEAD_Y - HEAD_SIZE * 0.6);
    ctx.lineTo(spikeX, HEAD_Y - HEAD_SIZE * 0.3);
    ctx.closePath();
    ctx.fill();

  } else if (hairStyle === 'fluffy') {
    // 곱슬머리
    const curlR = HEAD_SIZE * 0.12;
    const bigCurlR = HEAD_SIZE * 0.15;
    const smallCurlR = HEAD_SIZE * 0.08;

    // 곱슬들
    ctx.beginPath();
    ctx.arc(-HEAD_SIZE * 0.2, HEAD_Y - HEAD_SIZE * 0.35, curlR, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(HEAD_SIZE * 0.25, HEAD_Y - HEAD_SIZE * 0.25, curlR, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, HEAD_Y - HEAD_SIZE * 0.42, bigCurlR, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-HEAD_SIZE * 0.13, HEAD_Y - HEAD_SIZE * 0.5, smallCurlR, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(HEAD_SIZE * 0.13, HEAD_Y - HEAD_SIZE * 0.5, smallCurlR, 0, Math.PI * 2);
    ctx.fill();

    // 앞머리 (웨이브)
    ctx.beginPath();
    ctx.moveTo(-HEAD_SIZE / 2, HEAD_Y + 2);
    ctx.quadraticCurveTo(-HEAD_SIZE * 0.13, HEAD_Y - HEAD_SIZE * 0.25, 0, HEAD_Y - HEAD_SIZE * 0.17);
    ctx.quadraticCurveTo(HEAD_SIZE * 0.13, HEAD_Y - HEAD_SIZE * 0.25, HEAD_SIZE / 2, HEAD_Y + 2);
    ctx.quadraticCurveTo(0, HEAD_Y - HEAD_SIZE * 0.08, -HEAD_SIZE / 2, HEAD_Y + 2);
    ctx.fill();

  } else if (hairStyle === 'slick') {
    // 올백 하이라이트
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    const slickX = HEAD_SIZE * 0.4;
    ctx.beginPath();
    ctx.moveTo(-slickX, HEAD_Y - HEAD_SIZE * 0.17);
    ctx.quadraticCurveTo(0, HEAD_Y - HEAD_SIZE * 0.25, slickX, HEAD_Y - HEAD_SIZE * 0.17);
    ctx.stroke();
  }
}

/**
 * 전체 헤어 렌더링 (통합)
 */
export function drawHair(params: HairRenderParams): void {
  const { hairStyle } = params;

  if (hairStyle === 'helmet') {
    drawHelmet(params);
  } else if (hairStyle === 'fire_helmet') {
    drawFireHelmet(params);
  } else {
    // 일반 헤어스타일
    drawSkull(params);
    drawBangs(params);
    drawHairDetail(params);
  }
}
