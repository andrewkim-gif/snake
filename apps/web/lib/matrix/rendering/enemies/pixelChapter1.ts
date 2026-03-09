/**
 * game/rendering/enemies/pixelChapter1.ts - Chapter 1 Pixel Art Monsters (Stage 1-5)
 * v6.0: Cyberpunk pixel art style - office theme monsters
 *
 * Stage 1 (First Desk): stapler, coffee_cup, sticky_note, mouse_cable, keyboard_key
 * Stage 2 (Break Room): vending_bot, donut, soda_can, chip_bag, microwave
 * Stage 3 (Meeting Room): projector, whiteboard, presentation, chair_spin, clock_watcher
 * Stage 4 (Server Entry): keycard, camera_eye, firewall_cube, access_denied, fingerprint
 * Stage 5 (Server Core): data_packet, bit_stream, memory_leak, cache_miss, thread_tangle
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
// STAGE 1: First Desk (첫 책상) - Office Supply Theme
// =====================================================

export function drawPixelStapler(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const bite = Math.sin(t / 200) * 2;

  ctx.save();

  const baseColor = isHit ? '#ffffff' : CYBER_PALETTE.metalLight;
  const topColor = isHit ? '#ffffff' : CYBER_PALETTE.brightRed;
  const accentColor = isHit ? '#ffffff' : CYBER_PALETTE.brightOrange;

  // v8.0: 검은 아웃라인 베이스 (아래 턱)
  drawBlackOutlineRect(ctx, -5 * P - P, 1 * P - P, 5 + 1, 3 + 1, P);
  drawPixelRect(ctx, -5 * P, 1 * P, 5, 3, P, baseColor);

  // v8.0: 검은 아웃라인 윗 턱 (애니메이션)
  ctx.save();
  ctx.rotate(-bite * 0.1);
  drawBlackOutlineRect(ctx, -5 * P - P, -4 * P - P, 5 + 1, 4 + 1, P);
  drawPixelRect(ctx, -5 * P, -4 * P, 5, 4, P, topColor);

  // v8.0: 스테이플 슬롯 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -3 * P, -3 * P, 3, 1, P, CYBER_PALETTE.pureBlack);
  ctx.restore();

  // v8.0: LED 눈 - 더 밝은 색상
  drawPixelCircleWithBlackOutline(ctx, 3 * P, -2 * P, 1, P, accentColor);

  // v8.0: 회로 디테일 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -4 * P, 2 * P, 1, 1, P, CYBER_PALETTE.acidGreen);
  drawPixelRectWithBlackOutline(ctx, 4 * P, 2 * P, 1, 1, P, CYBER_PALETTE.acidGreen);

  ctx.restore();
}

export function drawPixelCoffeeCup(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const steam = Math.sin(t / 300);

  ctx.save();

  const cupColor = isHit ? '#ffffff' : CYBER_PALETTE.lightGray;
  const coffeeColor = isHit ? '#ffffff' : '#8B4513';
  const steamColor = isHit ? '#ffffff' : CYBER_PALETTE.brightCyan;

  // v8.0: 검은 아웃라인 컵 본체
  drawBlackOutlineRect(ctx, -4 * P - P, -3 * P - P, 4 + 1, 7 + 1, P);
  drawPixelRect(ctx, -4 * P, -3 * P, 4, 7, P, cupColor);

  // v8.0: 커피 액체 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -3 * P, -1 * P, 3, 5, P, coffeeColor);

  // v8.0: 손잡이 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, 4 * P, -1 * P, 2, 1, P, cupColor);
  drawPixelRectWithBlackOutline(ctx, 5 * P, 0 * P, 1, 2, P, cupColor);
  drawPixelRectWithBlackOutline(ctx, 4 * P, 2 * P, 2, 1, P, cupColor);

  // v8.0: 스팀 파티클 (애니메이션) - 더 밝은 색
  const steamY = Math.floor(-5 + steam * 2);
  drawPixelRectWithBlackOutline(ctx, -1 * P, steamY * P, 1, 1, P, steamColor);
  drawPixelRectWithBlackOutline(ctx, 1 * P, (steamY - 1) * P, 1, 1, P, steamColor);
  drawPixelRectWithBlackOutline(ctx, 0 * P, (steamY - 2) * P, 1, 1, P, steamColor);

  // v8.0: 화난 픽셀 눈 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, -2 * P, 0, 1, P, CYBER_PALETTE.brightRed);
  drawPixelCircleWithBlackOutline(ctx, 2 * P, 0, 1, P, CYBER_PALETTE.brightRed);

  ctx.restore();
}

export function drawPixelStickyNote(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const flutter = Math.sin(t / 400) * 0.1;

  ctx.save();
  ctx.rotate(flutter);

  const noteColor = isHit ? '#ffffff' : CYBER_PALETTE.brightOrange;
  const textColor = isHit ? '#ffffff' : CYBER_PALETTE.pureBlack;

  // v8.0: 검은 아웃라인 메모지 본체
  drawBlackOutlineRect(ctx, -4 * P - P, -4 * P - P, 4 + 1, 4 + 1, P);
  drawPixelRect(ctx, -4 * P, -4 * P, 4, 4, P, noteColor);

  // v8.0: 접힌 코너 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, 2 * P, -4 * P, 2, 2, P, CYBER_PALETTE.alertLight);

  // v8.0: "TODO" 텍스트 라인 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -3 * P, -2 * P, 3, 1, P, textColor);
  drawPixelRectWithBlackOutline(ctx, -3 * P, 0 * P, 4, 1, P, textColor);
  drawPixelRectWithBlackOutline(ctx, -3 * P, 2 * P, 2, 1, P, textColor);

  // v8.0: 화난 얼굴 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, -2 * P, -3 * P, 1, P, CYBER_PALETTE.brightRed);
  drawPixelCircleWithBlackOutline(ctx, 1 * P, -3 * P, 1, P, CYBER_PALETTE.brightRed);

  ctx.restore();
}

export function drawPixelMouseCable(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();

  ctx.save();

  const cableColor = isHit ? '#ffffff' : CYBER_PALETTE.metalLight;
  const connectorColor = isHit ? '#ffffff' : CYBER_PALETTE.gold;

  // v8.0: 케이블 세그먼트 (뱀 모양) - 검은 아웃라인
  for (let i = 0; i < 5; i++) {
    const offset = Math.sin(t / 150 + i * 0.5) * 2;
    const x = -5 + i * 2;
    const y = Math.floor(offset);
    drawPixelRectWithBlackOutline(ctx, x * P, y * P, 2, 2, P, cableColor);
  }

  // v8.0: USB 커넥터 헤드 - 검은 아웃라인
  drawBlackOutlineRect(ctx, 5 * P - P, -2 * P - P, 3 + 1, 3 + 1, P);
  drawPixelRect(ctx, 5 * P, -2 * P, 3, 3, P, connectorColor);

  // v8.0: 커넥터 슬롯 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, 6 * P, -1 * P, 1, 1, P, CYBER_PALETTE.pureBlack);

  // v8.0: 눈 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 6 * P, -1 * P, 1, P, CYBER_PALETTE.brightRed);
  drawPixelCircleWithBlackOutline(ctx, 6 * P, 1 * P, 1, P, CYBER_PALETTE.brightRed);

  ctx.restore();
}

export function drawPixelKeyboardKey(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const bounce = Math.abs(Math.sin(t / 200)) * 2;

  ctx.save();
  ctx.translate(0, -bounce);

  const keyColor = isHit ? '#ffffff' : CYBER_PALETTE.darkGray;
  const labelColor = isHit ? '#ffffff' : CYBER_PALETTE.acidGreen;

  // v8.0: 검은 아웃라인 키캡
  drawBlackOutlineRect(ctx, -4 * P - P, -4 * P - P, 4 + 1, 6 + 1, P);
  drawPixelRect(ctx, -4 * P, -4 * P, 4, 6, P, keyColor);

  // v8.0: 키 상단 표면 (더 밝은) - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -3 * P, -3 * P, 3, 5, P, CYBER_PALETTE.metalLight);

  // v8.0: 키 라벨 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -2 * P, -2 * P, 2, 2, P, labelColor);

  // v8.0: 화난 눈 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, -2 * P, 1 * P, 1, P, CYBER_PALETTE.brightRed);
  drawPixelCircleWithBlackOutline(ctx, 2 * P, 1 * P, 1, P, CYBER_PALETTE.brightRed);

  ctx.restore();
}

// =====================================================
// STAGE 2: Break Room (휴게실) - Vending/Food Theme
// =====================================================

export function drawPixelVendingBot(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const scan = (t / 50) % 10;

  ctx.save();

  const bodyColor = isHit ? '#ffffff' : CYBER_PALETTE.metalLight;
  const screenColor = isHit ? '#ffffff' : CYBER_PALETTE.pureBlack;

  // v8.0: 검은 아웃라인 메인 바디
  drawBlackOutlineRect(ctx, -5 * P - P, -6 * P - P, 5 + 1, 7 + 1, P);
  drawPixelRect(ctx, -5 * P, -6 * P, 5, 7, P, bodyColor);

  // v8.0: 검은 아웃라인 디스플레이 스크린
  drawPixelRectWithBlackOutline(ctx, -4 * P, -5 * P, 4, 4, P, screenColor);

  // v8.0: 스캔 라인 - 더 밝은 색
  const scanY = Math.floor(-5 + scan * 0.4);
  drawPixelRectWithBlackOutline(ctx, -4 * P, scanY * P, 4, 1, P, CYBER_PALETTE.acidGreen);

  // v8.0: 제품 슬롯 - 검은 아웃라인
  for (let i = 0; i < 2; i++) {
    drawPixelRectWithBlackOutline(ctx, -3 * P + i * 3 * P, 1 * P, 2, 2, P, CYBER_PALETTE.darkGray);
  }

  // v8.0: 빛나는 눈 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, -2 * P, -3 * P, 1, P, CYBER_PALETTE.brightRed);
  drawPixelCircleWithBlackOutline(ctx, 2 * P, -3 * P, 1, P, CYBER_PALETTE.brightRed);

  // v8.0: 코인 슬롯 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, 3 * P, 4 * P, 2, 1, P, CYBER_PALETTE.gold);

  ctx.restore();
}

export function drawPixelDonut(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const spin = t / 500;

  ctx.save();
  ctx.rotate(spin);

  const doughColor = isHit ? '#ffffff' : '#DEB887';
  const glazeColor = isHit ? '#ffffff' : CYBER_PALETTE.neonPink;

  // v8.0: 검은 아웃라인 외부 링
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 5, P, glazeColor);

  // v8.0: 도넛 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 4, P, doughColor);

  // v8.0: 구멍 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 2, P, CYBER_PALETTE.pureBlack);

  // v8.0: 스프링클 - 검은 아웃라인
  const sprinkleColors = [CYBER_PALETTE.acidGreen, CYBER_PALETTE.brightCyan, CYBER_PALETTE.brightOrange];
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const x = Math.cos(angle) * 3.5;
    const y = Math.sin(angle) * 3.5;
    drawPixelRectWithBlackOutline(ctx, Math.floor(x) * P, Math.floor(y) * P, 1, 1, P, sprinkleColors[i % 3]);
  }

  ctx.restore();

  // v8.0: 정적 눈 (회전 안함) - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, -2 * P, -1 * P, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);
  drawPixelCircleWithBlackOutline(ctx, 2 * P, -1 * P, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);
}

export function drawPixelSodaCan(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const wobble = Math.sin(t / 200) * 0.1;

  ctx.save();
  ctx.rotate(wobble);

  const canColor = isHit ? '#ffffff' : CYBER_PALETTE.brightRed;
  const labelColor = isHit ? '#ffffff' : CYBER_PALETTE.lightGray;

  // v8.0: 검은 아웃라인 캔 본체
  drawBlackOutlineRect(ctx, -3 * P - P, -5 * P - P, 3 + 1, 5 + 1, P);
  drawPixelRect(ctx, -3 * P, -5 * P, 3, 5, P, canColor);

  // v8.0: 상단 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -2 * P, -6 * P, 2, 1, P, CYBER_PALETTE.metalLight);

  // v8.0: 풀탭 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -1 * P, -7 * P, 1, 1, P, CYBER_PALETTE.metalLight);

  // v8.0: 라벨 스트라이프 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -3 * P, -2 * P, 3, 3, P, labelColor);

  // v8.0: 바이너리 텍스트 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -2 * P, -1 * P, 1, 1, P, CYBER_PALETTE.pureBlack);
  drawPixelRectWithBlackOutline(ctx, 0 * P, -1 * P, 1, 1, P, CYBER_PALETTE.pureBlack);

  // v8.0: 화난 눈 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, -2 * P, -4 * P, 1, P, CYBER_PALETTE.brightOrange);
  drawPixelCircleWithBlackOutline(ctx, 1 * P, -4 * P, 1, P, CYBER_PALETTE.brightOrange);

  ctx.restore();
}

export function drawPixelChipBag(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const crinkle = Math.sin(t / 180) * 0.05;

  ctx.save();
  ctx.rotate(crinkle);

  const bagColor = isHit ? '#ffffff' : CYBER_PALETTE.brightOrange;
  const accentColor = isHit ? '#ffffff' : CYBER_PALETTE.brightRed;

  // v8.0: 검은 아웃라인 가방 본체
  drawBlackOutlineRect(ctx, -4 * P - P, -5 * P - P, 4 + 1, 5 + 1, P);
  drawPixelRect(ctx, -4 * P, -5 * P, 4, 5, P, bagColor);

  // v8.0: 상단 크림프 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -3 * P, -6 * P, 3, 1, P, accentColor);

  // v8.0: "CYBER CHIPS" 패턴 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -3 * P, -3 * P, 3, 1, P, accentColor);
  drawPixelRectWithBlackOutline(ctx, -2 * P, -1 * P, 2, 1, P, accentColor);

  // v8.0: 화난 얼굴 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, -2 * P, 1 * P, 1, P, CYBER_PALETTE.pureBlack);
  drawPixelCircleWithBlackOutline(ctx, 1 * P, 1 * P, 1, P, CYBER_PALETTE.pureBlack);
  drawPixelRectWithBlackOutline(ctx, -1 * P, 2 * P, 1, 1, P, CYBER_PALETTE.pureBlack);

  ctx.restore();
}

export function drawPixelMicrowave(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const hum = Math.sin(t / 100) * 0.5;

  ctx.save();
  ctx.translate(hum, 0);

  const bodyColor = isHit ? '#ffffff' : CYBER_PALETTE.metalLight;
  const screenColor = isHit ? '#ffffff' : CYBER_PALETTE.pureBlack;

  // v8.0: 검은 아웃라인 메인 바디
  drawBlackOutlineRect(ctx, -6 * P - P, -4 * P - P, 6 + 1, 5 + 1, P);
  drawPixelRect(ctx, -6 * P, -4 * P, 6, 5, P, bodyColor);

  // v8.0: 문/창 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -5 * P, -3 * P, 4, 4, P, screenColor);

  // v8.0: 내부 빛 (깜빡임)
  const glowIntensity = (Math.sin(t / 80) + 1) / 2;
  if (glowIntensity > 0.5) {
    drawPixelRectWithBlackOutline(ctx, -4 * P, -2 * P, 3, 3, P, CYBER_PALETTE.brightOrange);
  }

  // v8.0: 컨트롤 패널 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, 3 * P, -3 * P, 2, 4, P, CYBER_PALETTE.darkGray);

  // v8.0: 버튼 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 4 * P, -2 * P, 1, P, CYBER_PALETTE.acidGreen);
  drawPixelCircleWithBlackOutline(ctx, 4 * P, 0 * P, 1, P, CYBER_PALETTE.brightRed);
  drawPixelCircleWithBlackOutline(ctx, 4 * P, 2 * P, 1, P, CYBER_PALETTE.brightCyan);

  // v8.0: 악마 눈 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, -3 * P, -1 * P, 1, P, CYBER_PALETTE.brightRed);
  drawPixelCircleWithBlackOutline(ctx, 0 * P, -1 * P, 1, P, CYBER_PALETTE.brightRed);

  ctx.restore();
}

// =====================================================
// STAGE 3: Meeting Room (회의실) - Presentation Theme
// =====================================================

export function drawPixelProjector(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const flicker = Math.sin(t / 50) > 0;

  ctx.save();

  const bodyColor = isHit ? '#ffffff' : CYBER_PALETTE.darkGray;
  const lensColor = isHit ? '#ffffff' : CYBER_PALETTE.brightCyan;

  // v8.0: 검은 아웃라인 본체
  drawBlackOutlineRect(ctx, -5 * P - P, -3 * P - P, 5 + 1, 4 + 1, P);
  drawPixelRect(ctx, -5 * P, -3 * P, 5, 4, P, bodyColor);

  // v8.0: 렌즈 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, -6 * P, 0, 2, P, lensColor);

  // v8.0: 빛줄기 (깜빡임)
  if (flicker) {
    drawPixelRectWithBlackOutline(ctx, -10 * P, -2 * P, 4, 2, P, CYBER_PALETTE.brightCyan);
  }

  // v8.0: 통풍구 - 검은 아웃라인
  for (let i = 0; i < 2; i++) {
    drawPixelRectWithBlackOutline(ctx, 1 * P + i * 2 * P, -2 * P, 1, 3, P, CYBER_PALETTE.metalLight);
  }

  // v8.0: 상태 LED - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 4 * P, -2 * P, 1, P, CYBER_PALETTE.brightRed);

  ctx.restore();
}

export function drawPixelWhiteboard(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();

  ctx.save();

  const frameColor = isHit ? '#ffffff' : CYBER_PALETTE.metalLight;
  const boardColor = isHit ? '#ffffff' : CYBER_PALETTE.lightGray;

  // v8.0: 검은 아웃라인 프레임
  drawBlackOutlineRect(ctx, -6 * P - P, -5 * P - P, 6 + 1, 5 + 1, P);
  drawPixelRect(ctx, -6 * P, -5 * P, 6, 5, P, frameColor);

  // v8.0: 보드 표면 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -5 * P, -4 * P, 5, 4, P, boardColor);

  // v8.0: 글리치 낙서 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -4 * P, -3 * P, 3, 1, P, CYBER_PALETTE.darkGray);
  drawPixelRectWithBlackOutline(ctx, -3 * P, 0 * P, 3, 1, P, CYBER_PALETTE.brightRed);
  drawPixelRectWithBlackOutline(ctx, -4 * P, 2 * P, 2, 1, P, CYBER_PALETTE.acidGreen);

  // v8.0: 화난 얼굴 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 3 * P, -3 * P, 1, P, CYBER_PALETTE.brightRed);
  drawPixelCircleWithBlackOutline(ctx, 4 * P, -3 * P, 1, P, CYBER_PALETTE.brightRed);

  ctx.restore();
}

export function drawPixelPresentation(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const slide = Math.floor(t / 1000) % 3;

  ctx.save();

  const slideColor = isHit ? '#ffffff' : CYBER_PALETTE.lightGray;
  const borderColor = isHit ? '#ffffff' : CYBER_PALETTE.brightCyan;

  // v8.0: 검은 아웃라인 슬라이드
  drawBlackOutlineRect(ctx, -5 * P - P, -4 * P - P, 5 + 1, 5 + 1, P);
  drawPixelRect(ctx, -5 * P, -4 * P, 5, 5, P, slideColor);

  // v8.0: 테두리 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -5 * P - P, -4 * P - P, 5 + 1, 5 + 1, P);

  // v8.0: 슬라이드 내용 - 검은 아웃라인
  if (slide === 0) {
    drawPixelRectWithBlackOutline(ctx, -3 * P, -2 * P, 3, 1, P, CYBER_PALETTE.pureBlack);
    drawPixelRectWithBlackOutline(ctx, -2 * P, 0 * P, 2, 1, P, CYBER_PALETTE.brightRed);
  } else if (slide === 1) {
    drawPixelCircleWithBlackOutline(ctx, 0, 0, 2, P, CYBER_PALETTE.acidGreen);
  } else {
    for (let i = 0; i < 2; i++) {
      drawPixelRectWithBlackOutline(ctx, -3 * P, -2 * P + i * 2 * P, 2 + i, 1, P, CYBER_PALETTE.brightCyan);
    }
  }

  // v8.0: 눈 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, -2 * P, 2 * P, 1, P, CYBER_PALETTE.brightRed);
  drawPixelCircleWithBlackOutline(ctx, 2 * P, 2 * P, 1, P, CYBER_PALETTE.brightRed);

  ctx.restore();
}

export function drawPixelChairSpin(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const spin = t / 200;

  ctx.save();
  ctx.rotate(spin);

  const seatColor = isHit ? '#ffffff' : CYBER_PALETTE.darkGray;

  // v8.0: 검은 아웃라인 좌석
  drawBlackOutlineRect(ctx, -4 * P - P, -2 * P - P, 4 + 1, 3 + 1, P);
  drawPixelRect(ctx, -4 * P, -2 * P, 4, 3, P, seatColor);

  // v8.0: 검은 아웃라인 등받이
  drawBlackOutlineRect(ctx, -3 * P - P, -6 * P - P, 3 + 1, 4 + 1, P);
  drawPixelRect(ctx, -3 * P, -6 * P, 3, 4, P, seatColor);

  ctx.restore();

  const metalColor = isHit ? '#ffffff' : CYBER_PALETTE.metalLight;

  // v8.0: 베이스 (회전 안함) - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -1 * P, 3 * P, 1, 2, P, metalColor);

  // v8.0: 바퀴 - 검은 아웃라인
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2 + spin;
    const x = Math.cos(angle) * 3;
    const y = 5 + Math.sin(angle) * 1;
    drawPixelCircleWithBlackOutline(ctx, Math.floor(x) * P, Math.floor(y) * P, 1, P, metalColor);
  }

  // v8.0: 어지러운 눈 - 검은 아웃라인
  const eyeY = Math.floor(-5 + Math.sin(spin) * 1);
  drawPixelCircleWithBlackOutline(ctx, -2 * P, eyeY * P, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightOrange);
  drawPixelCircleWithBlackOutline(ctx, 1 * P, eyeY * P, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightOrange);
}

export function drawPixelClockWatcher(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const secondHand = (t / 1000) % 60;

  ctx.save();

  const faceColor = isHit ? '#ffffff' : CYBER_PALETTE.lightGray;
  const handColor = isHit ? '#ffffff' : CYBER_PALETTE.pureBlack;

  // v8.0: 검은 아웃라인 시계 얼굴
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 5, P, faceColor);

  // v8.0: 시간 마커 - 검은 아웃라인
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(angle) * 4;
    const y = Math.sin(angle) * 4;
    drawPixelRectWithBlackOutline(ctx, Math.floor(x) * P, Math.floor(y) * P, 1, 1, P, handColor);
  }

  // v8.0: 시계바늘 - 검은 아웃라인
  const secondAngle = (secondHand / 60) * Math.PI * 2 - Math.PI / 2;
  const sx = Math.cos(secondAngle) * 3;
  const sy = Math.sin(secondAngle) * 3;
  drawPixelRectWithBlackOutline(ctx, Math.floor(sx) * P, Math.floor(sy) * P, 1, 1, P, CYBER_PALETTE.brightRed);

  // v8.0: 중앙 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 1, P, handColor);

  // v8.0: 화난 눈 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, -2 * P, -1 * P, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);
  drawPixelCircleWithBlackOutline(ctx, 2 * P, -1 * P, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);

  ctx.restore();
}

// =====================================================
// STAGE 4: Server Entry (서버실 입구) - Security Theme
// =====================================================

export function drawPixelKeycard(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const pulse = (Math.sin(t / 300) + 1) / 2;

  ctx.save();

  const cardColor = isHit ? '#ffffff' : CYBER_PALETTE.lightGray;
  const stripColor = isHit ? '#ffffff' : CYBER_PALETTE.gold;

  // v8.0: 검은 아웃라인 카드 본체
  drawBlackOutlineRect(ctx, -5 * P - P, -3 * P - P, 5 + 1, 4 + 1, P);
  drawPixelRect(ctx, -5 * P, -3 * P, 5, 4, P, cardColor);

  // v8.0: 마그네틱 스트립 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -5 * P, 1 * P, 5, 1, P, stripColor);

  // v8.0: 칩 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -4 * P, -2 * P, 2, 2, P, CYBER_PALETTE.gold);
  drawPixelRectWithBlackOutline(ctx, -4 * P, -2 * P, 1, 1, P, CYBER_PALETTE.metalLight);

  // v8.0: 액세스 레벨 표시 - 검은 아웃라인
  const accessColor = pulse > 0.5 ? CYBER_PALETTE.acidGreen : CYBER_PALETTE.brightRed;
  drawPixelCircleWithBlackOutline(ctx, 3 * P, -1 * P, 1, P, accessColor);

  // v8.0: 사진 영역 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, 1 * P, -2 * P, 2, 2, P, CYBER_PALETTE.pureBlack);
  drawPixelCircleWithBlackOutline(ctx, 1 * P, -2 * P, 1, P, CYBER_PALETTE.brightRed);
  drawPixelCircleWithBlackOutline(ctx, 2 * P, -2 * P, 1, P, CYBER_PALETTE.brightRed);

  ctx.restore();
}

export function drawPixelCameraEye(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const scan = Math.sin(t / 500) * 15;

  ctx.save();
  ctx.rotate(scan * 0.02);

  const bodyColor = isHit ? '#ffffff' : CYBER_PALETTE.darkGray;
  const lensColor = isHit ? '#ffffff' : CYBER_PALETTE.brightRed;

  // v8.0: 검은 아웃라인 카메라 본체
  drawBlackOutlineRect(ctx, -4 * P - P, -3 * P - P, 4 + 1, 4 + 1, P);
  drawPixelRect(ctx, -4 * P, -3 * P, 4, 4, P, bodyColor);

  // v8.0: 렌즈 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, -1 * P, 0, 2, P, CYBER_PALETTE.pureBlack);
  drawPixelCircleWithBlackOutline(ctx, -1 * P, 0, 1, P, lensColor);

  // v8.0: IR LED - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 1 * P, -2 * P, 1, P, CYBER_PALETTE.brightRed);
  drawPixelCircleWithBlackOutline(ctx, 1 * P, 2 * P, 1, P, CYBER_PALETTE.brightRed);

  // v8.0: 마운트 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, 2 * P, -1 * P, 2, 1, P, CYBER_PALETTE.metalLight);

  ctx.restore();
}

export function drawPixelFirewallCube(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const pulse = (Math.sin(t / 200) + 1) / 2;

  ctx.save();

  const cubeColor = isHit ? '#ffffff' : CYBER_PALETTE.brightCyan;
  const coreColor = isHit ? '#ffffff' : CYBER_PALETTE.brightRed;

  // v8.0: 검은 아웃라인 외부 큐브
  drawBlackOutlineRect(ctx, -4 * P - P, -4 * P - P, 4 + 1, 4 + 1, P);
  drawPixelRect(ctx, -4 * P, -4 * P, 4, 4, P, cubeColor);

  // v8.0: 내부 어두운 영역 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -3 * P, -3 * P, 3, 3, P, CYBER_PALETTE.pureBlack);

  // v8.0: 코어 (펄싱) - 검은 아웃라인
  const coreSize = Math.floor(2 + pulse);
  drawPixelRectWithBlackOutline(ctx, Math.floor(-coreSize / 2) * P, Math.floor(-coreSize / 2) * P, coreSize, coreSize, P, coreColor);

  // v8.0: 쉴드 아이콘 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -3 * P, 0 * P, 1, 1, P, CYBER_PALETTE.acidGreen);
  drawPixelRectWithBlackOutline(ctx, 3 * P, 0 * P, 1, 1, P, CYBER_PALETTE.acidGreen);
  drawPixelRectWithBlackOutline(ctx, 0 * P, -3 * P, 1, 1, P, CYBER_PALETTE.acidGreen);
  drawPixelRectWithBlackOutline(ctx, 0 * P, 3 * P, 1, 1, P, CYBER_PALETTE.acidGreen);

  ctx.restore();
}

export function drawPixelAccessDenied(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const flash = Math.sin(t / 100) > 0;

  ctx.save();

  const bgColor = isHit ? '#ffffff' : (flash ? CYBER_PALETTE.brightRed : CYBER_PALETTE.pureBlack);
  const textColor = isHit ? '#ffffff' : CYBER_PALETTE.lightGray;

  // v8.0: 검은 아웃라인 사인 배경
  drawBlackOutlineRect(ctx, -6 * P - P, -3 * P - P, 6 + 1, 4 + 1, P);
  drawPixelRect(ctx, -6 * P, -3 * P, 6, 4, P, bgColor);

  // v8.0: X 심볼 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -2 * P, -2 * P, 1, 3, P, textColor);
  drawPixelRectWithBlackOutline(ctx, 1 * P, -2 * P, 1, 3, P, textColor);

  // v8.0: 대각선 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -1 * P, -1 * P, 1, 1, P, textColor);
  drawPixelRectWithBlackOutline(ctx, 0 * P, 0 * P, 1, 1, P, textColor);

  ctx.restore();
}

export function drawPixelFingerprint(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const scanLine = (t / 30) % 8;

  ctx.save();

  const printColor = isHit ? '#ffffff' : CYBER_PALETTE.brightCyan;
  const bgColor = isHit ? '#ffffff' : CYBER_PALETTE.pureBlack;

  // v8.0: 검은 아웃라인 스캐너 패드
  drawBlackOutlineRect(ctx, -5 * P - P, -5 * P - P, 5 + 1, 5 + 1, P);
  drawPixelRect(ctx, -5 * P, -5 * P, 5, 5, P, bgColor);

  // v8.0: 지문 링 (동심원) - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 4, P, printColor);
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 3, P, bgColor);
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 2, P, printColor);

  // v8.0: 스캔 라인 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -4 * P, (-4 + scanLine) * P, 4, 1, P, CYBER_PALETTE.acidGreen);

  // v8.0: 화난 눈 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, -1 * P, -1 * P, 1, P, CYBER_PALETTE.brightRed);
  drawPixelCircleWithBlackOutline(ctx, 1 * P, -1 * P, 1, P, CYBER_PALETTE.brightRed);

  // v8.0: 잠금 표시 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -1 * P, 3 * P, 1, 1, P, CYBER_PALETTE.brightOrange);

  ctx.restore();
}

// =====================================================
// STAGE 5: Server Core (서버 코어) - Data Theme
// =====================================================

export function drawPixelDataPacket(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const travel = (t / 100) % 6;

  ctx.save();

  const packetColor = isHit ? '#ffffff' : CYBER_PALETTE.acidGreen;
  const headerColor = isHit ? '#ffffff' : CYBER_PALETTE.brightCyan;

  // v8.0: 검은 아웃라인 패킷 본체
  drawBlackOutlineRect(ctx, -4 * P - P, -3 * P - P, 4 + 1, 4 + 1, P);
  drawPixelRect(ctx, -4 * P, -3 * P, 4, 4, P, packetColor);

  // v8.0: 헤더 섹션 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -4 * P, -3 * P, 4, 1, P, headerColor);

  // v8.0: 데이터 비트 - 검은 아웃라인
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 3; j++) {
      const bit = deterministicRandom(i * 10 + j) > 0.5;
      if (bit) {
        drawPixelRectWithBlackOutline(ctx, (-3 + j * 2) * P, (-1 + i * 2) * P, 1, 1, P, CYBER_PALETTE.metalLight);
      }
    }
  }

  // v8.0: 이동 인디케이터 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, (-4 + travel) * P, 2 * P, 2, 1, P, CYBER_PALETTE.brightOrange);

  // v8.0: 눈 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, -2 * P, -2 * P, 1, P, CYBER_PALETTE.brightRed);
  drawPixelCircleWithBlackOutline(ctx, 2 * P, -2 * P, 1, P, CYBER_PALETTE.brightRed);

  ctx.restore();
}

export function drawPixelBitStream(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();

  ctx.save();

  const streamColor = isHit ? '#ffffff' : CYBER_PALETTE.acidGreen;

  // v8.0: 검은 아웃라인 스트림 본체 (가로로 긴 형태)
  drawBlackOutlineRect(ctx, -6 * P - P, -2 * P - P, 6 + 1, 3 + 1, P);
  drawPixelRect(ctx, -6 * P, -2 * P, 6, 3, P, CYBER_PALETTE.pureBlack);

  // v8.0: 흐르는 비트 - 검은 아웃라인
  for (let i = 0; i < 4; i++) {
    const offset = ((t / 50) + i * 2) % 6;
    const bit = deterministicRandom(100 + i) > 0.5;
    const color = bit ? streamColor : CYBER_PALETTE.metalLight;
    drawPixelRectWithBlackOutline(ctx, (-5 + offset) * P, (-1 + (i % 2)) * P, 1, 1, P, color);
  }

  // v8.0: 헤드 (스트림 앞부분) - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, 5 * P, -2 * P, 2, 3, P, streamColor);

  // v8.0: 눈 LED - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 5 * P, -1 * P, 1, P, CYBER_PALETTE.brightRed);
  drawPixelCircleWithBlackOutline(ctx, 5 * P, 1 * P, 1, P, CYBER_PALETTE.brightRed);

  ctx.restore();
}

export function drawPixelMemoryLeak(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const drip = (t / 200) % 5;

  ctx.save();

  const leakColor = isHit ? '#ffffff' : CYBER_PALETTE.neonPink;
  const chipColor = isHit ? '#ffffff' : CYBER_PALETTE.darkGray;

  // v8.0: 검은 아웃라인 메모리 칩
  drawBlackOutlineRect(ctx, -4 * P - P, -4 * P - P, 4 + 1, 5 + 1, P);
  drawPixelRect(ctx, -4 * P, -4 * P, 4, 5, P, chipColor);

  // v8.0: 핀 - 검은 아웃라인
  for (let i = 0; i < 3; i++) {
    drawPixelRectWithBlackOutline(ctx, (-3 + i * 2) * P, 2 * P, 1, 2, P, CYBER_PALETTE.brightOrange);
  }

  // v8.0: 누출 방울 - 검은 아웃라인
  for (let i = 0; i < 2; i++) {
    const y = Math.floor(-3 + drip + i * 3);
    if (y > -4 && y < 5) {
      drawPixelRectWithBlackOutline(ctx, (-2 + i * 3) * P, y * P, 1, 1, P, leakColor);
    }
  }

  // v8.0: 글리치 노이즈 대신 손상 마크 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -2 * P, -2 * P, 2, 1, P, CYBER_PALETTE.brightRed);
  drawPixelRectWithBlackOutline(ctx, 0 * P, 0 * P, 2, 1, P, CYBER_PALETTE.brightRed);

  // v8.0: 걱정하는 눈 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, -2 * P, -3 * P, 1, P, CYBER_PALETTE.brightOrange);
  drawPixelCircleWithBlackOutline(ctx, 2 * P, -3 * P, 1, P, CYBER_PALETTE.brightOrange);

  ctx.restore();
}

export function drawPixelCacheMiss(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const searchAngle = t / 200;

  ctx.save();

  const cacheColor = isHit ? '#ffffff' : CYBER_PALETTE.metalLight;
  const missColor = isHit ? '#ffffff' : CYBER_PALETTE.brightRed;

  // v8.0: 검은 아웃라인 캐시 블록
  drawBlackOutlineRect(ctx, -4 * P - P, -4 * P - P, 4 + 1, 4 + 1, P);
  drawPixelRect(ctx, -4 * P, -4 * P, 4, 4, P, cacheColor);

  // v8.0: 캐시 라인 (비어있음/미스) - 검은 아웃라인
  for (let i = 0; i < 3; i++) {
    drawPixelRectWithBlackOutline(ctx, -3 * P, (-3 + i * 2) * P, 3, 1, P, CYBER_PALETTE.pureBlack);
    // v8.0: X 마크 - 검은 아웃라인
    drawPixelRectWithBlackOutline(ctx, 2 * P, (-3 + i * 2) * P, 1, 1, P, missColor);
  }

  // v8.0: 검색 인디케이터 (회전) - 검은 아웃라인
  const sx = Math.cos(searchAngle) * 2;
  const sy = Math.sin(searchAngle) * 2;
  drawPixelCircleWithBlackOutline(ctx, Math.floor(sx) * P, Math.floor(sy) * P, 1, P, CYBER_PALETTE.brightOrange);

  // v8.0: 좌절한 표정 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, -2 * P, 3 * P, 1, P, missColor);
  drawPixelCircleWithBlackOutline(ctx, 2 * P, 3 * P, 1, P, missColor);

  ctx.restore();
}

export function drawPixelThreadTangle(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();

  ctx.save();

  const threadColors = [
    CYBER_PALETTE.acidGreen,
    CYBER_PALETTE.brightCyan,
    CYBER_PALETTE.neonPink,
    CYBER_PALETTE.brightOrange
  ];

  // v8.0: 엉킨 스레드 - 검은 아웃라인
  for (let i = 0; i < 4; i++) {
    const color = isHit ? '#ffffff' : threadColors[i];
    const offset = Math.sin(t / 200 + i) * 2;

    // v8.0: 웨이브 스레드 라인 - 검은 아웃라인
    for (let j = 0; j < 3; j++) {
      const x = Math.floor(-4 + j * 3);
      const y = Math.floor(offset + Math.sin(t / 150 + j + i * 2) * 2);
      drawPixelRectWithBlackOutline(ctx, x * P, y * P, 1, 1, P, color);
    }
  }

  // v8.0: 중앙 매듭 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 3, P, CYBER_PALETTE.pureBlack);

  // v8.0: 데드락 인디케이터 - 검은 아웃라인
  const pulse = (Math.sin(t / 100) + 1) / 2;
  if (pulse > 0.5) {
    drawPixelCircleWithBlackOutline(ctx, 0, 0, 2, P, CYBER_PALETTE.brightRed);
  }

  // v8.0: 혼란한 눈 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, -2 * P, -1 * P, 1, P, CYBER_PALETTE.brightOrange);
  drawPixelCircleWithBlackOutline(ctx, 2 * P, -1 * P, 1, P, CYBER_PALETTE.brightOrange);

  ctx.restore();
}
