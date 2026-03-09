/**
 * game/rendering/characters/parts/accessories.ts - 악세서리 렌더링
 *
 * 20+ 악세서리 타입 렌더링
 */

import { HEAD_SIZE, HEAD_Y, BODY_WIDTH, BODY_HEIGHT } from '../constants';
import type { AccessoryType, CharacterColors } from '../types';

export interface AccessoryRenderParams {
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  accessoryType: AccessoryType | string;
  accColor: string;
  colors: CharacterColors;
  eyeBaseX: number;
  eyeY: number;
  earY: number;
  dir: number;
}

// Helper: darken color
const darkenColor = (hex: string, percent: number): string => {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, ((num >> 16) & 255) * (1 - percent));
  const g = Math.max(0, ((num >> 8) & 255) * (1 - percent));
  const b = Math.max(0, (num & 255) * (1 - percent));
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
};

/**
 * 헤드밴드 렌더링
 */
export function drawHeadband(params: AccessoryRenderParams): void {
  const { ctx, accColor, dir } = params;
  ctx.fillStyle = accColor;
  const bandH = Math.max(2, HEAD_SIZE * 0.17);
  ctx.fillRect(-HEAD_SIZE / 2 - 1, HEAD_Y + HEAD_SIZE * 0.42, HEAD_SIZE + 2, bandH);
  // 매듭 (뒤쪽)
  if (dir > 0) {
    ctx.fillRect(-HEAD_SIZE / 2 - HEAD_SIZE * 0.17, HEAD_Y + HEAD_SIZE * 0.42, HEAD_SIZE * 0.17, bandH * 0.75);
    ctx.fillRect(-HEAD_SIZE / 2 - HEAD_SIZE * 0.21, HEAD_Y + HEAD_SIZE * 0.5, HEAD_SIZE * 0.13, bandH);
  }
}

/**
 * 후드 렌더링
 */
export function drawHood(params: AccessoryRenderParams): void {
  const { ctx, accColor } = params;
  ctx.fillStyle = accColor;
  ctx.beginPath();
  ctx.arc(0, HEAD_Y + HEAD_SIZE * 0.33, HEAD_SIZE / 2 + HEAD_SIZE * 0.13, Math.PI, 0);
  ctx.lineTo(HEAD_SIZE / 2 + HEAD_SIZE * 0.13, HEAD_Y + HEAD_SIZE);
  ctx.lineTo(-HEAD_SIZE / 2 - HEAD_SIZE * 0.13, HEAD_Y + HEAD_SIZE);
  ctx.fill();
  // 안쪽 그림자
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.arc(0, HEAD_Y + HEAD_SIZE * 0.5, HEAD_SIZE / 2 + 1, Math.PI, 0);
  ctx.fill();
}

/**
 * 스카프 렌더링
 */
export function drawScarf(params: AccessoryRenderParams): void {
  const { ctx, accColor } = params;
  const scarfColor = accColor || '#485c63';
  const scarfShadow = '#3a4b52';

  ctx.save();
  // 목 둘레
  ctx.fillStyle = scarfColor;
  ctx.beginPath();
  ctx.moveTo(-BODY_WIDTH / 2 - 2, -2);
  ctx.quadraticCurveTo(0, 4, BODY_WIDTH / 2 + 2, -2);
  ctx.lineTo(BODY_WIDTH / 2 + 2, 6);
  ctx.quadraticCurveTo(0, 12, -BODY_WIDTH / 2 - 2, 6);
  ctx.closePath();
  ctx.fill();

  // 늘어진 끝
  ctx.fillStyle = scarfShadow;
  ctx.beginPath();
  ctx.moveTo(-BODY_WIDTH / 2 - 2, 4);
  ctx.quadraticCurveTo(-BODY_WIDTH / 2 - 4, 12, -BODY_WIDTH / 2, BODY_HEIGHT - 2);
  ctx.lineTo(-BODY_WIDTH / 2 + 4, BODY_HEIGHT - 4);
  ctx.lineTo(-BODY_WIDTH / 2, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * 왕관 렌더링
 */
export function drawCrown(params: AccessoryRenderParams): void {
  const { ctx } = params;
  ctx.fillStyle = '#fbbf24';
  const crownY = HEAD_Y - HEAD_SIZE * 0.5;
  const crownW = HEAD_SIZE * 0.67;

  // 베이스
  ctx.fillRect(-crownW, crownY + crownW * 0.5, crownW * 2, crownW * 0.5);

  // 꼭지들
  ctx.beginPath();
  ctx.moveTo(-crownW, crownY + crownW * 0.5);
  ctx.lineTo(-crownW * 0.75, crownY);
  ctx.lineTo(-crownW * 0.5, crownY + crownW * 0.38);
  ctx.lineTo(0, crownY - crownW * 0.25);
  ctx.lineTo(crownW * 0.5, crownY + crownW * 0.38);
  ctx.lineTo(crownW * 0.75, crownY);
  ctx.lineTo(crownW, crownY + crownW * 0.5);
  ctx.closePath();
  ctx.fill();

  // 보석
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(0, crownY + crownW * 0.13, crownW * 0.25, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * 쉐프 모자 렌더링
 */
export function drawChefHat(params: AccessoryRenderParams): void {
  const { ctx } = params;
  ctx.fillStyle = '#ffffff';
  const hatY = HEAD_Y - HEAD_SIZE * 0.33;
  const hatR = HEAD_SIZE * 0.5;

  // 모자 본체
  ctx.beginPath();
  ctx.arc(0, hatY, hatR, Math.PI, 0);
  ctx.lineTo(hatR * 0.83, hatY + hatR * 0.33);
  ctx.lineTo(-hatR * 0.83, hatY + hatR * 0.33);
  ctx.closePath();
  ctx.fill();

  // 부푼 상단
  ctx.beginPath();
  ctx.arc(0, hatY - hatR * 0.33, hatR * 0.83, 0, Math.PI * 2);
  ctx.fill();

  // 띠
  ctx.fillStyle = darkenColor('#ffffff', 0.1);
  ctx.fillRect(-hatR * 0.83, hatY + hatR * 0.17, hatR * 1.67, hatR * 0.25);
}

/**
 * 리본 렌더링
 */
export function drawRibbon(params: AccessoryRenderParams): void {
  const { ctx, accColor } = params;
  ctx.fillStyle = accColor;
  const ribbonX = -HEAD_SIZE / 2 - HEAD_SIZE * 0.17;
  const ribbonY = HEAD_Y + HEAD_SIZE * 0.33;
  const ribbonSize = HEAD_SIZE * 0.17;

  // 날개
  ctx.beginPath();
  ctx.ellipse(ribbonX - ribbonSize * 1.5, ribbonY, ribbonSize * 2, ribbonSize, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(ribbonX + ribbonSize * 1.5, ribbonY, ribbonSize * 2, ribbonSize, 0.5, 0, Math.PI * 2);
  ctx.fill();

  // 중앙
  ctx.beginPath();
  ctx.arc(ribbonX, ribbonY, ribbonSize, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * 귀걸이 렌더링
 */
export function drawEarring(params: AccessoryRenderParams): void {
  const { ctx, accColor, earY } = params;
  ctx.fillStyle = accColor;
  const earringY = earY + HEAD_SIZE * 0.42;
  const earringR = HEAD_SIZE * 0.1;

  // 왼쪽
  ctx.beginPath();
  ctx.arc(-HEAD_SIZE / 2, earringY, earringR, 0, Math.PI * 2);
  ctx.fill();

  // 오른쪽
  ctx.beginPath();
  ctx.arc(HEAD_SIZE / 2, earringY, earringR, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * 안경 렌더링
 */
export function drawGlasses(params: AccessoryRenderParams): void {
  const { ctx, accColor, eyeBaseX, eyeY } = params;
  ctx.strokeStyle = accColor || '#1e293b';
  ctx.lineWidth = 0.8;
  const glassRadius = HEAD_SIZE * 0.21;

  // 렌즈
  ctx.beginPath();
  ctx.arc(-eyeBaseX, eyeY, glassRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(eyeBaseX, eyeY, glassRadius, 0, Math.PI * 2);
  ctx.stroke();

  // 브릿지
  ctx.beginPath();
  ctx.moveTo(-eyeBaseX + glassRadius, eyeY);
  ctx.lineTo(eyeBaseX - glassRadius, eyeY);
  ctx.stroke();

  // 다리
  ctx.beginPath();
  ctx.moveTo(-eyeBaseX - glassRadius, eyeY);
  ctx.lineTo(-HEAD_SIZE / 2 - 1, eyeY - 0.5);
  ctx.moveTo(eyeBaseX + glassRadius, eyeY);
  ctx.lineTo(HEAD_SIZE / 2 + 1, eyeY - 0.5);
  ctx.stroke();
}

/**
 * 선글라스 렌더링
 */
export function drawSunglasses(params: AccessoryRenderParams): void {
  const { ctx, accColor, eyeBaseX, eyeY } = params;
  ctx.fillStyle = accColor || '#1a1a1a';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 0.5;
  const sunglassRadius = HEAD_SIZE * 0.25;

  // 렌즈 (채움)
  ctx.beginPath();
  ctx.arc(-eyeBaseX, eyeY, sunglassRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(eyeBaseX, eyeY, sunglassRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // 브릿지
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-eyeBaseX + sunglassRadius, eyeY);
  ctx.lineTo(eyeBaseX - sunglassRadius, eyeY);
  ctx.stroke();

  // 다리
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-eyeBaseX - sunglassRadius, eyeY);
  ctx.lineTo(-HEAD_SIZE / 2 - 2, eyeY - 1);
  ctx.moveTo(eyeBaseX + sunglassRadius, eyeY);
  ctx.lineTo(HEAD_SIZE / 2 + 2, eyeY - 1);
  ctx.stroke();
}

/**
 * 메달 렌더링
 */
export function drawMedal(params: AccessoryRenderParams): void {
  const { ctx } = params;

  // 끈
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-4, HEAD_Y + HEAD_SIZE);
  ctx.lineTo(0, HEAD_Y + HEAD_SIZE + 8);
  ctx.lineTo(4, HEAD_Y + HEAD_SIZE);
  ctx.stroke();

  // 메달
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.arc(0, HEAD_Y + HEAD_SIZE + 10, 4, 0, Math.PI * 2);
  ctx.fill();

  // 별
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, HEAD_Y + HEAD_SIZE + 10, 2, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * 악세서리 렌더링 dispatcher
 */
export function drawAccessory(params: AccessoryRenderParams): void {
  const { accessoryType } = params;

  switch (accessoryType) {
    case 'headband':
      drawHeadband(params);
      break;
    case 'hood':
      drawHood(params);
      break;
    case 'scarf':
      drawScarf(params);
      break;
    case 'crown':
      drawCrown(params);
      break;
    case 'chef_hat':
      drawChefHat(params);
      break;
    case 'ribbon':
      drawRibbon(params);
      break;
    case 'earring':
      drawEarring(params);
      break;
    case 'glasses':
      drawGlasses(params);
      break;
    case 'sunglasses':
      drawSunglasses(params);
      break;
    case 'medal':
      drawMedal(params);
      break;
    // cape, watch, badge는 다른 곳에서 처리
    default:
      break;
  }
}
