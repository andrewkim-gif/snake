/**
 * game/rendering/enemies/pixelChapter1b.ts - Chapter 1b Pixel Art Monsters (Stage 6-10)
 * v6.0: Cyberpunk pixel art style - escape theme monsters
 *
 * Stage 6 (Parking): headlight, tire_roller, parking_cone, oil_slick, exhaust_ghost
 * Stage 7 (Stairs): stair_step, handrail_snake, exit_sign, fire_ext, echo_shade
 * Stage 8 (Rooftop): antenna_zap, wind_spirit, satellite_eye, vent_puff, pigeon_bot
 * Stage 9 (Street): traffic_light, manhole, billboard, drone_cam, streetlamp
 * Stage 10 (Apartment): static_tv, radio_wave, fridge_hum, dusty_fan, shadow_corner
 */

import type { EnemyRenderData } from './types';
import {
  CYBER_PALETTE,
  drawPixel,
  drawPixelRect,
  drawPixelCircle,
  drawPixelLED,
  drawGlitchNoise,
  drawScanlines,
  drawPixelRectWithBlackOutline,
  drawPixelCircleWithBlackOutline,
  drawBlackOutlineRect,
} from './pixelMonster';
import { deterministicRandom } from './renderContext';

const P = 2; // Pixel size

// =====================================================
// STAGE 6: Parking Lot (주차장) - Vehicle Theme
// =====================================================

export function drawPixelHeadlight(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const blink = Math.sin(t / 300) > 0.3;

  ctx.save();

  const lightColor = isHit ? '#ffffff' : (blink ? CYBER_PALETTE.brightOrange : CYBER_PALETTE.brightCyan);
  const housingColor = isHit ? '#ffffff' : CYBER_PALETTE.metalLight;

  // v8.0: 검은 아웃라인 하우징
  drawBlackOutlineRect(ctx, -6 * P - P, -2 * P - P, 4 + 1, 3 + 1, P);
  drawPixelRect(ctx, -6 * P, -2 * P, 4, 3, P, housingColor);
  drawBlackOutlineRect(ctx, 2 * P - P, -2 * P - P, 4 + 1, 3 + 1, P);
  drawPixelRect(ctx, 2 * P, -2 * P, 4, 3, P, housingColor);

  // v8.0: 라이트 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, -4 * P, 0, 2, P, lightColor);
  drawPixelCircleWithBlackOutline(ctx, 4 * P, 0, 2, P, lightColor);

  // v8.0: 그릴 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -2 * P, -1 * P, 2, 2, P, CYBER_PALETTE.pureBlack);

  // v8.0: 화난 눈 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, -1 * P, 0, 1, P, CYBER_PALETTE.brightRed);
  drawPixelCircleWithBlackOutline(ctx, 1 * P, 0, 1, P, CYBER_PALETTE.brightRed);

  ctx.restore();
}

export function drawPixelTireRoller(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const roll = t / 100;

  ctx.save();
  ctx.rotate(roll * 0.1);

  const tireColor = isHit ? '#ffffff' : CYBER_PALETTE.darkGray;
  const rimColor = isHit ? '#ffffff' : CYBER_PALETTE.metalLight;

  // v8.0: 타이어 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 5, P, tireColor);

  // v8.0: 림 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 3, P, rimColor);

  // v8.0: 트레드 마크 - 검은 아웃라인
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const x = Math.floor(Math.cos(angle) * 4);
    const y = Math.floor(Math.sin(angle) * 4);
    drawPixelRectWithBlackOutline(ctx, x * P, y * P, 1, 1, P, CYBER_PALETTE.pureBlack);
  }

  ctx.restore();

  // v8.0: 눈 (회전 안함) - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, -1 * P, 0, 1, P, CYBER_PALETTE.brightRed);
  drawPixelCircleWithBlackOutline(ctx, 1 * P, 0, 1, P, CYBER_PALETTE.brightRed);
}

export function drawPixelParkingCone(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const wobble = Math.sin(t / 250) * 0.05;

  ctx.save();
  ctx.rotate(wobble);

  const coneColor = isHit ? '#ffffff' : CYBER_PALETTE.brightOrange;
  const stripeColor = isHit ? '#ffffff' : CYBER_PALETTE.metalLight;

  // v8.0: 콘 본체 (삼각형) - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -4 * P, 3 * P, 4, 2, P, coneColor);
  drawPixelRectWithBlackOutline(ctx, -3 * P, 1 * P, 3, 2, P, stripeColor);
  drawPixelRectWithBlackOutline(ctx, -2 * P, -1 * P, 2, 2, P, coneColor);
  drawPixelRectWithBlackOutline(ctx, -1 * P, -3 * P, 1, 2, P, stripeColor);

  // v8.0: 눈 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, -1 * P, 0, 1, P, CYBER_PALETTE.pureBlack);
  drawPixelCircleWithBlackOutline(ctx, 1 * P, 0, 1, P, CYBER_PALETTE.pureBlack);

  ctx.restore();
}

export function drawPixelOilSlick(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();

  ctx.save();

  // v8.0: 무지개 오일 색상
  const colors = [
    CYBER_PALETTE.neonPink,
    CYBER_PALETTE.brightCyan,
    CYBER_PALETTE.acidGreen,
    CYBER_PALETTE.brightOrange
  ];

  // v8.0: 불규칙 웅덩이 - 검은 아웃라인
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const r = 3 + Math.sin(t / 300 + i) * 1;
    const x = Math.floor(Math.cos(angle) * r);
    const y = Math.floor(Math.sin(angle) * r * 0.6);
    const color = isHit ? '#ffffff' : colors[i % colors.length];
    drawPixelCircleWithBlackOutline(ctx, x * P, y * P, 1, P, color);
  }

  // v8.0: 중앙 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 2, P, CYBER_PALETTE.pureBlack);

  // v8.0: 눈 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, -1 * P, -1 * P, 1, P, CYBER_PALETTE.brightRed);
  drawPixelCircleWithBlackOutline(ctx, 1 * P, -1 * P, 1, P, CYBER_PALETTE.brightRed);

  ctx.restore();
}

export function drawPixelExhaustGhost(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const drift = Math.sin(t / 200);

  ctx.save();
  ctx.translate(drift * P, 0);

  const smokeColor = isHit ? '#ffffff' : CYBER_PALETTE.metalLight;

  // v8.0: 연기 퍼프 - 검은 아웃라인
  for (let i = 0; i < 3; i++) {
    const y = Math.floor(-i * 3 + Math.sin(t / 150 + i) * 1);
    const size = 3 - i;
    drawPixelCircleWithBlackOutline(ctx, Math.floor(Math.sin(t / 200 + i * 2) * 2) * P, y * P, size, P, smokeColor);
  }

  // v8.0: 메인 퍼프의 얼굴 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, -1 * P, 1 * P, 1, P, CYBER_PALETTE.pureBlack);
  drawPixelCircleWithBlackOutline(ctx, 1 * P, 1 * P, 1, P, CYBER_PALETTE.pureBlack);

  // v8.0: 입 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, 0, 3 * P, 1, 1, P, CYBER_PALETTE.pureBlack);

  ctx.restore();
}

// =====================================================
// STAGE 7: Emergency Stairs (비상계단) - Safety Theme
// =====================================================

export function drawPixelStairStep(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const bounce = Math.abs(Math.sin(t / 180)) * 1;

  ctx.save();
  ctx.translate(0, -bounce * P);

  const stepColor = isHit ? '#ffffff' : CYBER_PALETTE.metalLight;
  const edgeColor = isHit ? '#ffffff' : CYBER_PALETTE.brightOrange;

  // v8.0: 검은 아웃라인 계단
  drawBlackOutlineRect(ctx, -5 * P - P, -2 * P - P, 5 + 1, 3 + 1, P);
  drawPixelRect(ctx, -5 * P, -2 * P, 5, 3, P, stepColor);

  // v8.0: 어두운 그림자 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -5 * P, 2 * P, 5, 1, P, CYBER_PALETTE.darkGray);

  // v8.0: 안전 엣지 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -5 * P, -2 * P, 5, 1, P, edgeColor);

  // v8.0: 논슬립 패턴 - 검은 아웃라인
  for (let i = 0; i < 3; i++) {
    drawPixelRectWithBlackOutline(ctx, (-4 + i * 2) * P, 0, 1, 1, P, CYBER_PALETTE.pureBlack);
  }

  // v8.0: 눈 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, -2 * P, -1 * P, 1, P, CYBER_PALETTE.brightRed);
  drawPixelCircleWithBlackOutline(ctx, 2 * P, -1 * P, 1, P, CYBER_PALETTE.brightRed);

  ctx.restore();
}

export function drawPixelHandrailSnake(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();

  ctx.save();

  const railColor = isHit ? '#ffffff' : CYBER_PALETTE.metalLight;

  // v8.0: 뱀 모양 레일 - 검은 아웃라인
  for (let i = 0; i < 5; i++) {
    const x = -6 + i * 2;
    const y = Math.floor(Math.sin(t / 150 + i * 0.5) * 2);
    drawPixelRectWithBlackOutline(ctx, x * P, y * P, 2, 2, P, railColor);
  }

  // v8.0: 머리 - 검은 아웃라인
  const headY = Math.floor(Math.sin(t / 150 + 4) * 2);
  drawPixelRectWithBlackOutline(ctx, 5 * P, (headY - 1) * P, 3, 3, P, railColor);

  // v8.0: 머리의 눈 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 6 * P, headY * P, 1, P, CYBER_PALETTE.brightRed);

  // v8.0: 갈라진 혀 - 검은 아웃라인
  if (Math.sin(t / 100) > 0) {
    drawPixelRectWithBlackOutline(ctx, 8 * P, (headY - 1) * P, 1, 1, P, CYBER_PALETTE.brightRed);
    drawPixelRectWithBlackOutline(ctx, 8 * P, (headY + 1) * P, 1, 1, P, CYBER_PALETTE.brightRed);
  }

  ctx.restore();
}

export function drawPixelExitSign(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const flicker = Math.sin(t / 80) > -0.3;

  ctx.save();

  const signColor = isHit ? '#ffffff' : (flicker ? CYBER_PALETTE.acidGreen : CYBER_PALETTE.darkGray);
  const bgColor = isHit ? '#ffffff' : CYBER_PALETTE.pureBlack;

  // v8.0: 검은 아웃라인 사인 본체
  drawBlackOutlineRect(ctx, -6 * P - P, -3 * P - P, 6 + 1, 4 + 1, P);
  drawPixelRect(ctx, -6 * P, -3 * P, 6, 4, P, bgColor);

  // v8.0: EXIT 텍스트 영역 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -5 * P, -2 * P, 5, 2, P, signColor);

  // v8.0: 달리는 사람 아이콘 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, 3 * P, -1 * P, 2, 2, P, bgColor);

  // v8.0: 화난 눈 - 검은 아웃라인
  if (flicker) {
    drawPixelCircleWithBlackOutline(ctx, -3 * P, 1 * P, 1, P, CYBER_PALETTE.brightRed);
    drawPixelCircleWithBlackOutline(ctx, 1 * P, 1 * P, 1, P, CYBER_PALETTE.brightRed);
  }

  ctx.restore();
}

export function drawPixelFireExt(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const pressure = (Math.sin(t / 200) + 1) / 2;

  ctx.save();

  const bodyColor = isHit ? '#ffffff' : CYBER_PALETTE.brightRed;
  const nozzleColor = isHit ? '#ffffff' : CYBER_PALETTE.darkGray;

  // v8.0: 검은 아웃라인 본체
  drawBlackOutlineRect(ctx, -3 * P - P, -4 * P - P, 3 + 1, 5 + 1, P);
  drawPixelRect(ctx, -3 * P, -4 * P, 3, 5, P, bodyColor);

  // v8.0: 상단 캡 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -2 * P, -5 * P, 2, 1, P, nozzleColor);

  // v8.0: 손잡이 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -1 * P, -6 * P, 2, 1, P, nozzleColor);
  drawPixelRectWithBlackOutline(ctx, 1 * P, -7 * P, 2, 1, P, nozzleColor);

  // v8.0: 노즐 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, 3 * P, -4 * P, 2, 1, P, nozzleColor);

  // v8.0: 압력 게이지 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, -2 * P, 2, P, CYBER_PALETTE.metalLight);

  // v8.0: 게이지 바늘 - 검은 아웃라인
  const gaugeAngle = pressure * Math.PI;
  const gx = Math.floor(Math.cos(gaugeAngle) * 1);
  const gy = Math.floor(-2 + Math.sin(gaugeAngle) * 1);
  drawPixelRectWithBlackOutline(ctx, gx * P, gy * P, 1, 1, P, CYBER_PALETTE.acidGreen);

  // v8.0: 라벨 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -2 * P, 1 * P, 2, 2, P, CYBER_PALETTE.metalLight);

  // v8.0: 눈 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, -1 * P, 2 * P, 1, P, CYBER_PALETTE.pureBlack);
  drawPixelCircleWithBlackOutline(ctx, 1 * P, 2 * P, 1, P, CYBER_PALETTE.pureBlack);

  ctx.restore();
}

export function drawPixelEchoShade(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();

  ctx.save();

  // v8.0: 페이딩 에코 - 검은 아웃라인
  for (let i = 2; i >= 0; i--) {
    const offset = i * 2;
    const color = isHit ? '#ffffff' : CYBER_PALETTE.neonPink;
    drawPixelRectWithBlackOutline(ctx, (-3 - offset) * P, -4 * P, 3, 5, P, color);
  }

  // v8.0: 메인 본체 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -3 * P - P, -4 * P - P, 3 + 1, 5 + 1, P);
  drawPixelRect(ctx, -3 * P, -4 * P, 3, 5, P, isHit ? '#ffffff' : CYBER_PALETTE.neonPink);

  // v8.0: 빛나는 눈 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, -1 * P, -2 * P, 1, P, CYBER_PALETTE.brightCyan);
  drawPixelCircleWithBlackOutline(ctx, 1 * P, -2 * P, 1, P, CYBER_PALETTE.brightCyan);

  ctx.restore();
}

// =====================================================
// STAGE 8: Rooftop (옥상) - Sky/Tech Theme
// =====================================================

export function drawPixelAntennaZap(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const zap = Math.sin(t / 50) > 0.5;

  ctx.save();

  // v8.0: 안테나 폴 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -1 * P - P, -6 * P - P, 2 + 1, 12 + 1, P);
  drawPixelRect(ctx, -1 * P, -6 * P, 2, 12, P, isHit ? '#ffffff' : CYBER_PALETTE.brightCyan);

  // v8.0: 크로스 바 3개 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -4 * P - P, -4 * P - P, 8 + 1, 1 + 1, P);
  drawPixelRect(ctx, -4 * P, -4 * P, 8, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.metal);

  drawBlackOutlineRect(ctx, -3 * P - P, -2 * P - P, 6 + 1, 1 + 1, P);
  drawPixelRect(ctx, -3 * P, -2 * P, 6, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.metal);

  drawBlackOutlineRect(ctx, -2 * P - P, 0 - P, 4 + 1, 1 + 1, P);
  drawPixelRect(ctx, -2 * P, 0, 4, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.metal);

  // v8.0: 전기 스파크 - 검은 아웃라인
  if (zap) {
    drawPixelRectWithBlackOutline(ctx, -5 * P, -4 * P, 1, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightYellow);
    drawPixelRectWithBlackOutline(ctx, 5 * P, -4 * P, 1, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightYellow);
    drawPixelRectWithBlackOutline(ctx, -4 * P, -2 * P, 1, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightYellow);
    drawPixelRectWithBlackOutline(ctx, 4 * P, -2 * P, 1, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightYellow);
  }

  // v8.0: LED 눈 (상단) - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, -1 * P, -5 * P, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);
  drawPixelCircleWithBlackOutline(ctx, 1 * P, -5 * P, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);

  ctx.restore();
}

export function drawPixelWindSpirit(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const swirl = t / 150;

  ctx.save();

  // v8.0: 소용돌이 바람 파티클 - 검은 아웃라인
  for (let i = 0; i < 8; i++) {
    const angle = swirl + (i / 8) * Math.PI * 3;
    const r = 2 + (i / 8) * 5;
    const x = Math.cos(angle) * r * P;
    const y = Math.sin(angle) * r * P;
    drawPixelRectWithBlackOutline(ctx, x, y, 1, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightCyan);
  }

  // v8.0: 메인 코어 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 2, P, isHit ? '#ffffff' : CYBER_PALETTE.brightCyan);

  // v8.0: 눈 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -1 * P, -1 * P, 1, 1, P, isHit ? '#ffffff' : '#ffffff');
  drawPixelRectWithBlackOutline(ctx, 1 * P, -1 * P, 1, 1, P, isHit ? '#ffffff' : '#ffffff');

  ctx.restore();
}

export function drawPixelSatelliteEye(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const scan = Math.sin(t / 400) * 3;

  ctx.save();

  // v8.0: 접시 안테나 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, -1 * P, 4, P, isHit ? '#ffffff' : CYBER_PALETTE.metal);
  drawPixelCircleWithBlackOutline(ctx, 0, -1 * P, 2, P, isHit ? '#ffffff' : CYBER_PALETTE.darkGray);

  // v8.0: 지지대 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -1 * P - P, 2 * P - P, 2 + 1, 3 + 1, P);
  drawPixelRect(ctx, -1 * P, 2 * P, 2, 3, P, isHit ? '#ffffff' : CYBER_PALETTE.metal);

  // v8.0: 스캔 빔 (간소화) - 검은 아웃라인
  const beamX = scan * P;
  drawPixelRectWithBlackOutline(ctx, beamX - P, -5 * P, 2, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);
  drawPixelRectWithBlackOutline(ctx, beamX - 0.5 * P, -6 * P, 1, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);

  // v8.0: 중앙 눈 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, -1 * P, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);

  ctx.restore();
}

export function drawPixelVentPuff(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const puff = (t / 100) % 10;

  ctx.save();

  // v8.0: 환풍구 그릴 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -4 * P - P, -1 * P - P, 8 + 1, 4 + 1, P);
  drawPixelRect(ctx, -4 * P, -1 * P, 8, 4, P, isHit ? '#ffffff' : CYBER_PALETTE.metal);

  // v8.0: 그릴 슬롯 - 검은 아웃라인
  for (let i = 0; i < 3; i++) {
    drawPixelRectWithBlackOutline(ctx, (-3 + i * 3) * P, 0, 1, 2, P, isHit ? '#ffffff' : CYBER_PALETTE.darkBg);
  }

  // v8.0: 스팀 파티클 - 검은 아웃라인
  for (let i = 0; i < 2; i++) {
    const y = -puff - i * 4;
    if (y > -10) {
      const x = Math.sin(t / 200 + i) * 2 * P;
      drawPixelCircleWithBlackOutline(ctx, x, y * P, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.lightGray);
    }
  }

  // v8.0: 눈 (그릴 안) - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -2 * P, 1 * P, 1, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);
  drawPixelRectWithBlackOutline(ctx, 2 * P, 1 * P, 1, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);

  ctx.restore();
}

export function drawPixelPigeonBot(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const bob = Math.sin(t / 200) * P;
  const wingFlap = Math.sin(t / 80) * 0.2;

  ctx.save();
  ctx.translate(0, bob);

  // v8.0: 몸통 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -3 * P - P, -2 * P - P, 6 + 1, 4 + 1, P);
  drawPixelRect(ctx, -3 * P, -2 * P, 6, 4, P, isHit ? '#ffffff' : CYBER_PALETTE.metal);

  // v8.0: 머리 - 검은 아웃라인
  drawBlackOutlineRect(ctx, 2 * P - P, -4 * P - P, 3 + 1, 3 + 1, P);
  drawPixelRect(ctx, 2 * P, -4 * P, 3, 3, P, isHit ? '#ffffff' : CYBER_PALETTE.metal);

  // v8.0: 부리 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, 5 * P, -3 * P, 2, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightOrange);

  // v8.0: 날개 (애니메이션) - 검은 아웃라인
  ctx.save();
  ctx.rotate(wingFlap);
  drawPixelRectWithBlackOutline(ctx, -4 * P, -3 * P, 2, 4, P, isHit ? '#ffffff' : CYBER_PALETTE.darkGray);
  ctx.restore();

  // v8.0: 로봇 눈 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 3 * P, -3 * P, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);

  // v8.0: 안테나 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, 3 * P, -5 * P, 1, 2, P, isHit ? '#ffffff' : CYBER_PALETTE.metal);
  drawPixelRectWithBlackOutline(ctx, 3 * P, -6 * P, 1, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);

  ctx.restore();
}

// =====================================================
// STAGE 9: Street (거리) - Urban Theme
// =====================================================

export function drawPixelTrafficLight(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const cycle = Math.floor(t / 1000) % 3;

  ctx.save();

  // v8.0: 신호등 하우징 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -3 * P - P, -5 * P - P, 6 + 1, 10 + 1, P);
  drawPixelRect(ctx, -3 * P, -5 * P, 6, 10, P, isHit ? '#ffffff' : CYBER_PALETTE.darkGray);

  // v8.0: 신호등 (빨/노/초) - 검은 아웃라인
  const redOn = cycle === 0;
  const yellowOn = cycle === 1;
  const greenOn = cycle === 2;

  drawPixelCircleWithBlackOutline(ctx, 0, -3 * P, 1, P, isHit ? '#ffffff' : (redOn ? CYBER_PALETTE.brightRed : '#4a1010'));
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 1, P, isHit ? '#ffffff' : (yellowOn ? CYBER_PALETTE.brightYellow : '#4a4010'));
  drawPixelCircleWithBlackOutline(ctx, 0, 3 * P, 1, P, isHit ? '#ffffff' : (greenOn ? CYBER_PALETTE.acidGreen : '#104a10'));

  // v8.0: 지지대 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -1 * P - P, 5 * P - P, 2 + 1, 3 + 1, P);
  drawPixelRect(ctx, -1 * P, 5 * P, 2, 3, P, isHit ? '#ffffff' : CYBER_PALETTE.metal);

  ctx.restore();
}

export function drawPixelManhole(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const steam = (t / 150) % 8;

  ctx.save();

  // v8.0: 맨홀 뚜껑 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 5, P, isHit ? '#ffffff' : CYBER_PALETTE.metal);
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 3, P, isHit ? '#ffffff' : CYBER_PALETTE.darkGray);

  // v8.0: 십자 패턴 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -3 * P, -0.5 * P, 6, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.metal);
  drawPixelRectWithBlackOutline(ctx, -0.5 * P, -3 * P, 1, 6, P, isHit ? '#ffffff' : CYBER_PALETTE.metal);

  // v8.0: 스팀 파티클 - 검은 아웃라인
  if (steam < 6) {
    drawPixelRectWithBlackOutline(ctx, -2 * P, (-steam - 2) * P, 1, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.lightGray);
    drawPixelRectWithBlackOutline(ctx, 2 * P, (-steam - 3) * P, 1, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.lightGray);
  }

  // v8.0: 눈 (구멍에서) - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, -2 * P, -2 * P, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);
  drawPixelCircleWithBlackOutline(ctx, 2 * P, 2 * P, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);

  ctx.restore();
}

export function drawPixelBillboard(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const glitchFrame = Math.floor(t / 200) % 3;

  ctx.save();

  // v8.0: 프레임 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -6 * P - P, -4 * P - P, 12 + 1, 8 + 1, P);
  drawPixelRect(ctx, -6 * P, -4 * P, 12, 8, P, isHit ? '#ffffff' : CYBER_PALETTE.metal);

  // v8.0: 스크린 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -5 * P - P, -3 * P - P, 10 + 1, 6 + 1, P);
  drawPixelRect(ctx, -5 * P, -3 * P, 10, 6, P, isHit ? '#ffffff' : CYBER_PALETTE.darkBg);

  // v8.0: 글리치 콘텐츠 - 검은 아웃라인
  if (glitchFrame === 0) {
    drawPixelRectWithBlackOutline(ctx, -4 * P, -2 * P, 8, 2, P, isHit ? '#ffffff' : CYBER_PALETTE.brightCyan);
  } else if (glitchFrame === 1) {
    drawPixelRectWithBlackOutline(ctx, -4 * P, -1 * P, 8, 2, P, isHit ? '#ffffff' : CYBER_PALETTE.neonPink);
  } else {
    drawPixelRectWithBlackOutline(ctx, -4 * P, -2 * P, 8, 3, P, isHit ? '#ffffff' : CYBER_PALETTE.brightYellow);
  }

  // v8.0: 눈 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, -3 * P, 1 * P, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);
  drawPixelCircleWithBlackOutline(ctx, 3 * P, 1 * P, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);

  // v8.0: 지지대 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -1 * P - P, 4 * P - P, 2 + 1, 2 + 1, P);
  drawPixelRect(ctx, -1 * P, 4 * P, 2, 2, P, isHit ? '#ffffff' : CYBER_PALETTE.metal);

  ctx.restore();
}

export function drawPixelDroneCam(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const hover = Math.sin(t / 200) * P;
  const propSpin = t / 30;

  ctx.save();
  ctx.translate(0, hover);

  // v8.0: 드론 몸통 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -3 * P - P, -2 * P - P, 6 + 1, 4 + 1, P);
  drawPixelRect(ctx, -3 * P, -2 * P, 6, 4, P, isHit ? '#ffffff' : CYBER_PALETTE.darkGray);

  // v8.0: 카메라 렌즈 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, 1 * P, 2, P, isHit ? '#ffffff' : CYBER_PALETTE.brightCyan);
  drawPixelCircleWithBlackOutline(ctx, 0, 1 * P, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.darkBg);

  // v8.0: 프로펠러 암 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -6 * P, -1 * P, 3, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.metal);
  drawPixelRectWithBlackOutline(ctx, 3 * P, -1 * P, 3, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.metal);

  // v8.0: 회전 프로펠러 - 검은 아웃라인
  const propAngle = propSpin;
  for (let i = 0; i < 2; i++) {
    const x = i === 0 ? -5 * P : 5 * P;
    const px = Math.cos(propAngle) * 2 * P;
    drawPixelRectWithBlackOutline(ctx, x + px, -1 * P, 1, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.lightGray);
    drawPixelRectWithBlackOutline(ctx, x - px, -1 * P, 1, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.lightGray);
  }

  // v8.0: 녹화 LED - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 2 * P, -2 * P, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);

  ctx.restore();
}

export function drawPixelStreetlamp(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const flicker = Math.sin(t / 100) > -0.2;

  ctx.save();

  // v8.0: 지지대 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -1 * P - P, -2 * P - P, 2 + 1, 8 + 1, P);
  drawPixelRect(ctx, -1 * P, -2 * P, 2, 8, P, isHit ? '#ffffff' : CYBER_PALETTE.metal);

  // v8.0: 램프 헤드 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -3 * P - P, -5 * P - P, 6 + 1, 3 + 1, P);
  drawPixelRect(ctx, -3 * P, -5 * P, 6, 3, P, isHit ? '#ffffff' : CYBER_PALETTE.metal);

  // v8.0: 전구 - 검은 아웃라인
  const lightColor = isHit ? '#ffffff' : (flicker ? CYBER_PALETTE.brightYellow : CYBER_PALETTE.gold);
  drawPixelRectWithBlackOutline(ctx, -2 * P, -4 * P, 4, 2, P, lightColor);

  // v8.0: 눈 (램프 헤드) - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -2 * P, -4 * P, 1, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);
  drawPixelRectWithBlackOutline(ctx, 2 * P, -4 * P, 1, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);

  ctx.restore();
}

// =====================================================
// STAGE 10: Abandoned Apartment (폐아파트) - Haunted Tech Theme
// =====================================================

export function drawPixelStaticTv(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();

  ctx.save();

  // v8.0: TV 케이스 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -5 * P - P, -4 * P - P, 10 + 1, 8 + 1, P);
  drawPixelRect(ctx, -5 * P, -4 * P, 10, 8, P, isHit ? '#ffffff' : CYBER_PALETTE.darkGray);

  // v8.0: 스크린 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -4 * P - P, -3 * P - P, 8 + 1, 6 + 1, P);
  drawPixelRect(ctx, -4 * P, -3 * P, 8, 6, P, isHit ? '#ffffff' : CYBER_PALETTE.darkBg);

  // v8.0: 노이즈 패턴 - 검은 아웃라인
  const noisePhase = Math.floor(t / 100) % 4;
  for (let i = 0; i < 4; i++) {
    const nx = (-3 + i * 2 + noisePhase) % 6 - 2;
    const ny = (-2 + (i + noisePhase) % 4);
    drawPixelRectWithBlackOutline(ctx, nx * P, ny * P, 1, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.lightGray);
  }

  // v8.0: 무서운 눈 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, -2 * P, -1 * P, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);
  drawPixelCircleWithBlackOutline(ctx, 2 * P, -1 * P, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);

  // v8.0: 안테나 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -2 * P, -6 * P, 1, 2, P, isHit ? '#ffffff' : CYBER_PALETTE.metal);
  drawPixelRectWithBlackOutline(ctx, 2 * P, -6 * P, 1, 2, P, isHit ? '#ffffff' : CYBER_PALETTE.metal);

  // v8.0: 스탠드 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -2 * P - P, 4 * P - P, 4 + 1, 1 + 1, P);
  drawPixelRect(ctx, -2 * P, 4 * P, 4, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.metal);

  ctx.restore();
}

export function drawPixelRadioWave(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();

  ctx.save();

  // v8.0: 확산 웨이브 (픽셀화) - 검은 아웃라인
  for (let i = 0; i < 3; i++) {
    const radius = ((t / 150 + i * 3) % 8);
    if (radius > 2) {
      const r = Math.floor(radius);
      drawPixelCircleWithBlackOutline(ctx, 0, 0, r, P, isHit ? '#ffffff' : CYBER_PALETTE.brightCyan);
    }
  }

  // v8.0: 중앙 송신기 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -2 * P - P, -3 * P - P, 4 + 1, 6 + 1, P);
  drawPixelRect(ctx, -2 * P, -3 * P, 4, 6, P, isHit ? '#ffffff' : CYBER_PALETTE.darkGray);

  // v8.0: 눈 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, -1 * P, -1 * P, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);
  drawPixelCircleWithBlackOutline(ctx, 1 * P, -1 * P, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);

  ctx.restore();
}

export function drawPixelFridgeHum(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const hum = Math.sin(t / 50) * 0.3;

  ctx.save();
  ctx.translate(hum, 0);

  // v8.0: 냉장고 본체 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -4 * P - P, -6 * P - P, 8 + 1, 12 + 1, P);
  drawPixelRect(ctx, -4 * P, -6 * P, 8, 12, P, isHit ? '#ffffff' : CYBER_PALETTE.lightGray);

  // v8.0: 문 분리선 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -4 * P, -1 * P, 8, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.darkGray);

  // v8.0: 손잡이 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, 2 * P, -4 * P, 1, 3, P, isHit ? '#ffffff' : CYBER_PALETTE.metal);
  drawPixelRectWithBlackOutline(ctx, 2 * P, 1 * P, 1, 3, P, isHit ? '#ffffff' : CYBER_PALETTE.metal);

  // v8.0: 제빙기 (상단) - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -3 * P, -5 * P, 5, 3, P, isHit ? '#ffffff' : CYBER_PALETTE.brightCyan);

  // v8.0: 무서운 눈 (하단) - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, -1 * P, 3 * P, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);
  drawPixelCircleWithBlackOutline(ctx, 1 * P, 3 * P, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);

  ctx.restore();
}

export function drawPixelDustyFan(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const spin = t / 80;

  ctx.save();

  // v8.0: 프레임/케이지 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 5, P, isHit ? '#ffffff' : CYBER_PALETTE.metal);

  // v8.0: 회전 날개 - 검은 아웃라인
  ctx.save();
  ctx.rotate(spin);
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2;
    ctx.save();
    ctx.rotate(angle);
    drawPixelRectWithBlackOutline(ctx, -1 * P, -4 * P, 2, 4, P, isHit ? '#ffffff' : CYBER_PALETTE.darkGray);
    ctx.restore();
  }
  ctx.restore();

  // v8.0: 중앙 허브 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 2, P, isHit ? '#ffffff' : CYBER_PALETTE.darkGray);

  // v8.0: 먼지 파티클 - 검은 아웃라인
  for (let i = 0; i < 3; i++) {
    const dustAngle = spin * 0.3 + i * 1.5;
    const dustR = 6 + Math.sin(t / 200 + i) * P;
    const dx = Math.cos(dustAngle) * dustR;
    const dy = Math.sin(dustAngle) * dustR;
    drawPixelRectWithBlackOutline(ctx, dx, dy, 1, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.lightGray);
  }

  // v8.0: 눈 (중앙) - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -1 * P, -1 * P, 1, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);
  drawPixelRectWithBlackOutline(ctx, 1 * P, -1 * P, 1, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);

  ctx.restore();
}

export function drawPixelShadowCorner(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const pulse = (Math.sin(t / 400) + 1) / 2;

  ctx.save();

  // v8.0: 어둠의 코너 - 검은 아웃라인 (L자 형태)
  // 상단 수평 부분
  drawBlackOutlineRect(ctx, -5 * P - P, -5 * P - P, 10 + 1, 3 + 1, P);
  drawPixelRect(ctx, -5 * P, -5 * P, 10, 3, P, isHit ? '#ffffff' : CYBER_PALETTE.darkBg);

  // 좌측 수직 부분
  drawBlackOutlineRect(ctx, -5 * P - P, -2 * P - P, 3 + 1, 8 + 1, P);
  drawPixelRect(ctx, -5 * P, -2 * P, 3, 8, P, isHit ? '#ffffff' : CYBER_PALETTE.darkBg);

  // v8.0: 기어나오는 촉수 - 검은 아웃라인
  const tendrilLen = Math.floor(2 + pulse * 2);
  drawPixelRectWithBlackOutline(ctx, -2 * P, -2 * P, 1, tendrilLen, P, isHit ? '#ffffff' : CYBER_PALETTE.darkBg);
  drawPixelRectWithBlackOutline(ctx, -2 * P, -2 * P, tendrilLen, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.darkBg);

  // v8.0: 어둠 속 빛나는 눈 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, -3 * P, -3 * P, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);
  drawPixelCircleWithBlackOutline(ctx, -4 * P, -4 * P, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.neonPink);

  ctx.restore();
}
