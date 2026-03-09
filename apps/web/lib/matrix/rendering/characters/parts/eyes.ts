/**
 * game/rendering/characters/parts/eyes.ts - 눈 렌더링
 *
 * 눈 스타일별 렌더링 및 깜빡임 애니메이션
 */

import type { EyeStyle } from '../types';
import { HEAD_SIZE, HEAD_Y, EYE_X, EYE_Y } from '../constants';

export interface EyeRenderParams {
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  eyeStyle: EyeStyle;
  dir: number;
  eyeOffsetX: number;
  time: number;
  isBlinking?: boolean;
}

/**
 * 눈 깜빡임 체크
 */
export function shouldBlink(time: number): boolean {
  const blinkCycle = 4000; // 4초 주기
  const blinkDuration = 150; // 깜빡임 지속시간
  return (time % blinkCycle) < blinkDuration;
}

/**
 * 기본 점 눈
 */
export function drawDotEyes(params: EyeRenderParams): void {
  const { ctx, dir, eyeOffsetX, isBlinking } = params;

  if (isBlinking) {
    // 감은 눈 (가로 선)
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(dir * EYE_X + eyeOffsetX - 2, EYE_Y);
    ctx.lineTo(dir * EYE_X + eyeOffsetX + 2, EYE_Y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-dir * EYE_X * 0.3 + eyeOffsetX - 1.5, EYE_Y);
    ctx.lineTo(-dir * EYE_X * 0.3 + eyeOffsetX + 1.5, EYE_Y);
    ctx.stroke();
  } else {
    // 앞쪽 눈 (크게)
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(dir * EYE_X + eyeOffsetX, EYE_Y, 3, 0, Math.PI * 2);
    ctx.fill();

    // 하이라이트
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(dir * EYE_X + eyeOffsetX + 1, EYE_Y - 1, 1, 0, Math.PI * 2);
    ctx.fill();

    // 뒤쪽 눈 (작게)
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(-dir * EYE_X * 0.3 + eyeOffsetX, EYE_Y, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * 결연한 눈 (determined)
 */
export function drawDeterminedEyes(params: EyeRenderParams): void {
  const { ctx, dir, eyeOffsetX, isBlinking } = params;

  if (isBlinking) {
    drawDotEyes({ ...params, isBlinking: true });
    return;
  }

  // 앞쪽 눈
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(dir * EYE_X + eyeOffsetX, EYE_Y, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // 눈썹 (결연함)
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(dir * EYE_X + eyeOffsetX - 4, EYE_Y - 5);
  ctx.lineTo(dir * EYE_X + eyeOffsetX + 3, EYE_Y - 4);
  ctx.stroke();

  // 하이라이트
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(dir * EYE_X + eyeOffsetX + 1, EYE_Y - 1, 1.2, 0, Math.PI * 2);
  ctx.fill();

  // 뒤쪽 눈
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(-dir * EYE_X * 0.3 + eyeOffsetX, EYE_Y, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * 타로 눈 (신비로운)
 */
export function drawTarotEyes(params: EyeRenderParams): void {
  const { ctx, dir, eyeOffsetX, time, isBlinking } = params;

  if (isBlinking) {
    drawDotEyes({ ...params, isBlinking: true });
    return;
  }

  const shimmer = Math.sin(time / 500) * 0.3 + 0.7;

  // 앞쪽 눈 (아몬드형)
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.ellipse(dir * EYE_X + eyeOffsetX, EYE_Y, 4, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // 눈꺼풀 라인 (신비로운 느낌)
  ctx.strokeStyle = `rgba(0, 0, 0, ${shimmer})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(dir * EYE_X + eyeOffsetX, EYE_Y - 1, 5, Math.PI * 0.2, Math.PI * 0.8);
  ctx.stroke();

  // 빛나는 하이라이트
  ctx.fillStyle = `rgba(255, 255, 255, ${shimmer})`;
  ctx.beginPath();
  ctx.arc(dir * EYE_X + eyeOffsetX + 1, EYE_Y - 1, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // 뒤쪽 눈
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.ellipse(-dir * EYE_X * 0.3 + eyeOffsetX, EYE_Y, 3, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * 라인 눈 (감은 눈 / 미소)
 */
export function drawLineEyes(params: EyeRenderParams): void {
  const { ctx, dir, eyeOffsetX } = params;

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';

  // 앞쪽 눈 (부드러운 곡선)
  ctx.beginPath();
  ctx.arc(dir * EYE_X + eyeOffsetX, EYE_Y + 1, 3, Math.PI * 0.1, Math.PI * 0.9);
  ctx.stroke();

  // 뒤쪽 눈
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(-dir * EYE_X * 0.3 + eyeOffsetX, EYE_Y + 1, 2, Math.PI * 0.1, Math.PI * 0.9);
  ctx.stroke();
}

/**
 * 화난 눈
 */
export function drawAngryEyes(params: EyeRenderParams): void {
  const { ctx, dir, eyeOffsetX, isBlinking } = params;

  if (isBlinking) {
    drawDotEyes({ ...params, isBlinking: true });
    return;
  }

  // 앞쪽 눈
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(dir * EYE_X + eyeOffsetX, EYE_Y, 3, 0, Math.PI * 2);
  ctx.fill();

  // 화난 눈썹
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(dir * EYE_X + eyeOffsetX - 4, EYE_Y - 3);
  ctx.lineTo(dir * EYE_X + eyeOffsetX + 3, EYE_Y - 6);
  ctx.stroke();

  // 뒤쪽 눈
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(-dir * EYE_X * 0.3 + eyeOffsetX, EYE_Y, 2, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * 눈 스타일별 디스패처
 */
export function drawEyes(params: EyeRenderParams): void {
  const isBlinking = shouldBlink(params.time);
  const paramsWithBlink = { ...params, isBlinking };

  switch (params.eyeStyle) {
    case 'determined':
      drawDeterminedEyes(paramsWithBlink);
      break;
    case 'tarot':
      drawTarotEyes(paramsWithBlink);
      break;
    case 'line':
      drawLineEyes(paramsWithBlink);
      break;
    case 'angry':
      drawAngryEyes(paramsWithBlink);
      break;
    case 'happy':
      drawLineEyes(paramsWithBlink); // happy uses same as line
      break;
    case 'dot':
    default:
      drawDotEyes(paramsWithBlink);
      break;
  }
}
