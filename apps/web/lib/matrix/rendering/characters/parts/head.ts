/**
 * game/rendering/characters/parts/head.ts - 머리 렌더링
 *
 * 머리통, 얼굴, 귀, 볼터치 렌더링
 */

import type { CharacterColors, CharacterStyle } from '../types';
import { HEAD_SIZE, HEAD_Y, FACE_WIDTH, JAW_EXTEND, OUTLINE_WIDTH } from '../constants';

export interface HeadRenderParams {
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  colors: CharacterColors;
  style: CharacterStyle;
  dir: number;
  headRotate: number;
}

/**
 * 머리 기본 형태 렌더링
 */
export function drawHeadBase(params: HeadRenderParams): void {
  const { ctx, colors, dir, headRotate } = params;

  ctx.save();
  ctx.rotate((headRotate * Math.PI) / 180);

  // 외곽선 (두꺼운 검은색)
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.ellipse(0, HEAD_Y + HEAD_SIZE * 0.4, FACE_WIDTH + OUTLINE_WIDTH, HEAD_SIZE * 0.55 + OUTLINE_WIDTH, 0, 0, Math.PI * 2);
  ctx.fill();

  // 얼굴 (피부색)
  ctx.fillStyle = colors.skin;
  ctx.beginPath();
  ctx.ellipse(0, HEAD_Y + HEAD_SIZE * 0.4, FACE_WIDTH, HEAD_SIZE * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();

  // 턱 라인 (부드러운 아래쪽)
  ctx.beginPath();
  ctx.ellipse(0, HEAD_Y + HEAD_SIZE * 0.55, FACE_WIDTH * 0.9, JAW_EXTEND, 0, 0, Math.PI);
  ctx.fill();

  ctx.restore();
}

/**
 * 귀 렌더링
 */
export function drawEars(params: HeadRenderParams): void {
  const { ctx, colors, dir } = params;
  const earSize = HEAD_SIZE * 0.2;
  const earY = HEAD_Y + HEAD_SIZE * 0.4;

  // 뒤쪽 귀 (보이는 방향 반대)
  const backEarX = -dir * (FACE_WIDTH + 2);
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.ellipse(backEarX, earY, earSize + 1, earSize * 1.2 + 1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors.skin;
  ctx.beginPath();
  ctx.ellipse(backEarX, earY, earSize, earSize * 1.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // 앞쪽 귀
  const frontEarX = dir * (FACE_WIDTH + 2);
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.ellipse(frontEarX, earY, earSize + 1, earSize * 1.2 + 1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors.skin;
  ctx.beginPath();
  ctx.ellipse(frontEarX, earY, earSize, earSize * 1.2, 0, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * 볼터치 렌더링
 */
export function drawBlush(params: HeadRenderParams): void {
  const { ctx, dir } = params;
  const blushY = HEAD_Y + HEAD_SIZE * 0.55;
  const blushX = dir * FACE_WIDTH * 0.5;

  ctx.fillStyle = 'rgba(255, 182, 193, 0.4)';
  ctx.beginPath();
  ctx.ellipse(blushX, blushY, 3, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // 반대쪽 볼 (살짝 보임)
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.ellipse(-blushX * 0.8, blushY, 2, 1.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}
