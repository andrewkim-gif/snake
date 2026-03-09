/**
 * game/rendering/enemies/pixelChapter2b.ts - Chapter 2 Pixel Art Monsters (Stage 16-20)
 * v6.0: Cyberpunk pixel art style - battleground/mainframe theme
 *
 * Stage 16 (Ruins): rubble_golem, rust_crawler, rebar_spike, dust_cloud, broken_screen
 * Stage 17 (Resistance Camp): infected_guard, glitched_medic, hacked_turret, traitor_drone, supply_mimic
 * Stage 18 (Training Ground): target_dummy, obstacle_wall, drill_sergeant, tripwire, sandbag_tumble
 * Stage 19 (Mainframe): logic_gate, register_file, bus_controller, alu_core, cache_line
 * Stage 20 (Data Prison): firewall_guard, quarantine_cell, corrupted_file, delete_marker, backup_ghost
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
  drawBlackOutlineRect,
  drawPixelRectWithBlackOutline,
  drawPixelCircleWithBlackOutline,
} from './pixelMonster';
import { deterministicRandom } from './renderContext';

const P = 2; // Pixel size

// =====================================================
// STAGE 16: Ruins (폐허) - Post-War Theme
// =====================================================

export function drawPixelRubbleGolem(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const shake = Math.sin(t / 100) * 1;

  ctx.save();

  const stoneColor = isHit ? '#ffffff' : '#9ca3af';
  const darkStone = isHit ? '#ffffff' : '#6b7280';
  const eyeColor = isHit ? '#ffffff' : CYBER_PALETTE.brightRed;

  // v8.0: 메인 바디 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -5 * P + shake - P, -6 * P - P, 10 + 1, 12 + 1, P);
  drawPixelRect(ctx, -5 * P + shake, -6 * P, 10, 12, P, stoneColor);

  // v8.0: 머리 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -4 * P - P, -8 * P - P, 8 + 1, 3 + 1, P);
  drawPixelRect(ctx, -4 * P, -8 * P, 8, 3, P, stoneColor);

  // 균열 텍스처
  drawPixel(ctx, -3 * P, -4 * P, P, darkStone);
  drawPixel(ctx, 2 * P, -2 * P, P, darkStone);
  drawPixel(ctx, -1 * P, 2 * P, P, darkStone);

  // v8.0: 빛나는 눈 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, -2 * P, -7 * P, 1, P, eyeColor);
  drawPixelCircleWithBlackOutline(ctx, 2 * P, -7 * P, 1, P, eyeColor);

  // v8.0: 팔 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -8 * P, -3 * P, 3, 5, P, isHit ? '#ffffff' : stoneColor);
  drawPixelRectWithBlackOutline(ctx, 5 * P, -3 * P, 3, 5, P, isHit ? '#ffffff' : stoneColor);

  // v8.0: 철근 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, 3 * P, -10 * P, 1, 3, P, isHit ? '#ffffff' : CYBER_PALETTE.metal);
  drawPixelRectWithBlackOutline(ctx, -4 * P, -10 * P, 1, 2, P, isHit ? '#ffffff' : CYBER_PALETTE.metal);

  ctx.restore();
}

export function drawPixelRustCrawler(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const crawl = Math.sin(t / 150) * 1;

  ctx.save();

  const rustColor = isHit ? '#ffffff' : CYBER_PALETTE.brightOrange;
  const darkRust = isHit ? '#ffffff' : '#c2410c';
  const eyeColor = isHit ? '#ffffff' : CYBER_PALETTE.brightYellow;

  // v8.0: 세그먼트 바디 - 검은 아웃라인
  for (let i = 0; i < 3; i++) {
    const segOff = Math.sin(t / 200 + i * 0.5) * 1;
    drawPixelCircleWithBlackOutline(ctx, -3 * P + i * 3 * P, segOff, 2, P, i % 2 === 0 ? rustColor : darkRust);
  }

  // v8.0: 다리 - 검은 아웃라인
  for (let i = 0; i < 4; i++) {
    const legOff = (i % 2 === 0) ? crawl : -crawl;
    drawPixelRectWithBlackOutline(ctx, -4 * P + i * 3 * P, 3 * P + legOff, 1, 2, P, isHit ? '#ffffff' : darkRust);
    drawPixelRectWithBlackOutline(ctx, -4 * P + i * 3 * P, -5 * P - legOff, 1, 2, P, isHit ? '#ffffff' : darkRust);
  }

  // v8.0: 집게 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -6 * P, -1 * P, 2, 2, P, isHit ? '#ffffff' : rustColor);
  drawPixelRectWithBlackOutline(ctx, -7 * P, -2 * P + crawl, 1, 1, P, isHit ? '#ffffff' : rustColor);
  drawPixelRectWithBlackOutline(ctx, -7 * P, 1 * P - crawl, 1, 1, P, isHit ? '#ffffff' : rustColor);

  // v8.0: 눈 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, -4 * P, -1 * P, 0, P, eyeColor);
  drawPixelCircleWithBlackOutline(ctx, -4 * P, 1 * P, 0, P, eyeColor);

  ctx.restore();
}

export function drawPixelRebarSpike(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const wobble = Math.sin(t / 300) * 2;

  ctx.save();
  ctx.rotate(wobble * 0.03);

  const metalColor = isHit ? '#ffffff' : '#a1a1aa';
  const rustColor = isHit ? '#ffffff' : CYBER_PALETTE.brightOrange;
  const concreteColor = isHit ? '#ffffff' : '#9ca3af';

  // v8.0: 콘크리트 베이스 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -4 * P - P, 2 * P - P, 8 + 1, 4 + 1, P);
  drawPixelRect(ctx, -4 * P, 2 * P, 8, 4, P, concreteColor);

  // v8.0: 철근 스파이크 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -1 * P - P, -8 * P - P, 2 + 1, 11 + 1, P);
  drawPixelRect(ctx, -1 * P, -8 * P, 2, 11, P, metalColor);

  drawBlackOutlineRect(ctx, -3 * P - P, -5 * P - P, 1 + 1, 7 + 1, P);
  drawPixelRect(ctx, -3 * P, -5 * P, 1, 7, P, metalColor);

  drawBlackOutlineRect(ctx, 2 * P - P, -6 * P - P, 1 + 1, 8 + 1, P);
  drawPixelRect(ctx, 2 * P, -6 * P, 1, 8, P, metalColor);

  // 녹 패치
  drawPixel(ctx, 0, -4 * P, P, rustColor);
  drawPixel(ctx, -3 * P, -3 * P, P, rustColor);
  drawPixel(ctx, 2 * P, -4 * P, P, rustColor);

  // v8.0: 날카로운 끝 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, -9 * P, 0, P, isHit ? '#ffffff' : '#e4e4e7');
  drawPixelCircleWithBlackOutline(ctx, -3 * P, -6 * P, 0, P, isHit ? '#ffffff' : '#e4e4e7');
  drawPixelCircleWithBlackOutline(ctx, 2 * P, -7 * P, 0, P, isHit ? '#ffffff' : '#e4e4e7');

  ctx.restore();
}

export function drawPixelDustCloud(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();

  ctx.save();

  const dustColor = isHit ? '#ffffff' : '#d4d4d8';
  const lightDust = isHit ? '#ffffff' : '#e4e4e7';

  // v8.0: 코어 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 3, P, dustColor);

  // v8.0: 소용돌이 파티클 - 검은 아웃라인
  for (let i = 0; i < 6; i++) {
    const angle = (t / 500 + i * 1.0) % (Math.PI * 2);
    const dist = 3 * P + Math.sin(t / 300 + i) * P;
    const px = Math.cos(angle) * dist;
    const py = Math.sin(angle) * dist;

    drawPixelCircleWithBlackOutline(ctx, px, py, 1, P, i % 2 === 0 ? dustColor : lightDust);
  }

  // v8.0: 외부 파티클 - 검은 아웃라인
  for (let i = 0; i < 4; i++) {
    const angle = (t / 400 + i * 1.5 + 0.5) % (Math.PI * 2);
    const dist = 5 * P + Math.sin(t / 250 + i) * P;
    const px = Math.cos(angle) * dist;
    const py = Math.sin(angle) * dist;

    drawPixelCircleWithBlackOutline(ctx, px, py, 0, P, lightDust);
  }

  ctx.restore();
}

export function drawPixelBrokenScreen(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const flicker = Math.random() > 0.9;

  ctx.save();

  const frameColor = isHit ? '#ffffff' : '#3f3f46';
  const screenColor = isHit ? '#ffffff' : '#18181b';
  const glitchColor = isHit ? '#ffffff' : CYBER_PALETTE.acidGreen;

  // v8.0: 모니터 프레임 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -6 * P - P, -5 * P - P, 12 + 1, 9 + 1, P);
  drawPixelRect(ctx, -6 * P, -5 * P, 12, 9, P, frameColor);

  // v8.0: 스크린 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -5 * P - P, -4 * P - P, 10 + 1, 7 + 1, P);
  drawPixelRect(ctx, -5 * P, -4 * P, 10, 7, P, screenColor);

  // 균열 패턴
  drawPixel(ctx, 1 * P, -2 * P, P, '#71717a');
  drawPixel(ctx, 2 * P, -1 * P, P, '#71717a');
  drawPixel(ctx, 3 * P, 0, P, '#71717a');
  drawPixel(ctx, 1 * P, -1 * P, P, '#71717a');

  // 글리치 디스플레이
  if (flicker) {
    for (let i = 0; i < 4; i++) {
      drawPixel(ctx, -4 * P + i * 2 * P, -2 * P, P, glitchColor);
    }
  } else {
    for (let i = 0; i < 3; i++) {
      const rx = -4 * P + Math.floor(Math.random() * 8) * P;
      const ry = -3 * P + Math.floor(Math.random() * 5) * P;
      drawPixel(ctx, rx, ry, P, glitchColor);
    }
  }

  // v8.0: 스탠드 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -2 * P, 4 * P, 4, 2, P, isHit ? '#ffffff' : frameColor);

  ctx.restore();
}

// =====================================================
// STAGE 17: Resistance Camp (저항군 캠프) - Infected Ally Theme
// =====================================================

export function drawPixelInfectedGuard(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const twitch = Math.random() > 0.9 ? Math.random() * 2 - 1 : 0;

  ctx.save();
  ctx.translate(twitch, twitch);

  const armorColor = isHit ? '#ffffff' : CYBER_PALETTE.acidGreen;
  const virusColor = isHit ? '#ffffff' : CYBER_PALETTE.brightRed;
  const skinColor = isHit ? '#ffffff' : '#d4d4d8';

  // v8.0: 갑옷 바디 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -4 * P - P, -3 * P - P, 8 + 1, 9 + 1, P);
  drawPixelRect(ctx, -4 * P, -3 * P, 8, 9, P, armorColor);

  // v8.0: 헬멧 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, -5 * P, 4, P, armorColor);

  // v8.0: 감염 패치 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, -2 * P, -1 * P, 1, P, virusColor);
  drawPixelCircleWithBlackOutline(ctx, 2 * P, 1 * P, 1, P, virusColor);

  // v8.0: 바이저 - 검은 아웃라인
  const visorColor = Math.random() > 0.8 ? virusColor : CYBER_PALETTE.brightCyan;
  drawPixelRectWithBlackOutline(ctx, -3 * P, -6 * P, 6, 2, P, isHit ? '#ffffff' : visorColor);

  // v8.0: 무기 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, 5 * P, -2 * P, 2, 6, P, isHit ? '#ffffff' : CYBER_PALETTE.metal);

  ctx.restore();
}

export function drawPixelGlitchedMedic(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const glitchOff = Math.random() > 0.85 ? (Math.random() * 4 - 2) : 0;

  ctx.save();

  const coatColor = isHit ? '#ffffff' : '#fafafa';
  const crossColor = isHit ? '#ffffff' : CYBER_PALETTE.brightRed;
  const glitchColor = isHit ? '#ffffff' : CYBER_PALETTE.acidGreen;

  // v8.0: 흰색 가운 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -4 * P - P, -4 * P - P, 8 + 1, 10 + 1, P);
  drawPixelRect(ctx, -4 * P, -4 * P, 8, 10, P, coatColor);

  // 글리치 부분
  if (glitchOff !== 0) {
    ctx.save();
    ctx.translate(glitchOff, 0);
    drawPixelRect(ctx, -4 * P, -1 * P, 8, 3, P, glitchColor);
    ctx.restore();
  }

  // v8.0: 레드 크로스 (손상됨) - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -1 * P, -3 * P, 2, 6, P, isHit ? '#ffffff' : crossColor);
  drawPixelRectWithBlackOutline(ctx, -3 * P, -2 * P, 6, 2, P, isHit ? '#ffffff' : crossColor);

  // v8.0: 머리 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, -6 * P, 2, P, isHit ? '#ffffff' : '#fde68a');

  // 눈 (하나는 정상, 하나는 글리치)
  drawPixel(ctx, -1 * P, -6 * P, P, CYBER_PALETTE.darkBg);
  drawPixel(ctx, 1 * P, -6 * P, P, glitchColor);

  // v8.0: 주사기 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, 5 * P, -1 * P, 1, 5, P, isHit ? '#ffffff' : CYBER_PALETTE.brightCyan);
  drawPixelRectWithBlackOutline(ctx, 4 * P, 4 * P, 2, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.metal);

  ctx.restore();
}

export function drawPixelHackedTurret(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const scan = Math.sin(t / 300) * 30;

  ctx.save();

  const baseColor = isHit ? '#ffffff' : '#a1a1aa';
  const gunColor = isHit ? '#ffffff' : '#52525b';
  const errorColor = isHit ? '#ffffff' : CYBER_PALETTE.brightRed;

  // v8.0: 베이스/삼각대 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -5 * P - P, 2 * P - P, 10 + 1, 4 + 1, P);
  drawPixelRect(ctx, -5 * P, 2 * P, 10, 4, P, baseColor);
  drawPixelRectWithBlackOutline(ctx, -6 * P, 5 * P, 3, 2, P, isHit ? '#ffffff' : baseColor);
  drawPixelRectWithBlackOutline(ctx, 3 * P, 5 * P, 3, 2, P, isHit ? '#ffffff' : baseColor);

  // v8.0: 터렛 헤드 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 4, P, baseColor);

  // v8.0: 총열 (회전) - 검은 아웃라인
  ctx.save();
  ctx.rotate(scan * Math.PI / 180);
  drawBlackOutlineRect(ctx, 0 - P, -2 * P - P, 8 + 1, 4 + 1, P);
  drawPixelRect(ctx, 0, -2 * P, 8, 4, P, gunColor);
  drawPixelRectWithBlackOutline(ctx, 7 * P, -1 * P, 2, 2, P, isHit ? '#ffffff' : gunColor);
  ctx.restore();

  // v8.0: ERROR 인디케이터 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 1, P, errorColor);

  // v8.0: "HACKED" 표시 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -3 * P, -6 * P, 6, 2, P, isHit ? '#ffffff' : errorColor);

  ctx.restore();
}

export function drawPixelTraitorDrone(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const hover = Math.sin(t / 250) * 2;

  ctx.save();
  ctx.translate(0, hover);

  const bodyColor = isHit ? '#ffffff' : CYBER_PALETTE.brightCyan;
  const corruptColor = isHit ? '#ffffff' : CYBER_PALETTE.brightRed;
  const propColor = isHit ? '#ffffff' : '#a1a1aa';

  // v8.0: 바디 (우호적 파란색 + 붉은 부패) - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 4, P, bodyColor);
  drawPixelCircleWithBlackOutline(ctx, 2 * P, -1 * P, 1, P, corruptColor);

  // v8.0: 프로펠러 - 검은 아웃라인
  const propPos = [{ x: -4 * P, y: -2 * P }, { x: 4 * P, y: -2 * P }, { x: -4 * P, y: 2 * P }, { x: 4 * P, y: 2 * P }];
  for (const pos of propPos) {
    drawPixelCircleWithBlackOutline(ctx, pos.x, pos.y, 1, P, propColor);
  }

  // v8.0: 눈 (적/아군 전환) - 검은 아웃라인
  const eyeFlicker = Math.sin(t / 200) > 0;
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 1, P, eyeFlicker ? corruptColor : CYBER_PALETTE.acidGreen);

  // X 표시 (배신)
  drawPixel(ctx, -2 * P, 4 * P, P, corruptColor);
  drawPixel(ctx, 0, 5 * P, P, corruptColor);
  drawPixel(ctx, 2 * P, 4 * P, P, corruptColor);

  ctx.restore();
}

export function drawPixelSupplyMimic(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const reveal = Math.sin(t / 600);

  ctx.save();

  const boxColor = isHit ? '#ffffff' : CYBER_PALETTE.brightYellow;
  const teethColor = isHit ? '#ffffff' : '#fafafa';
  const tongueColor = isHit ? '#ffffff' : CYBER_PALETTE.brightRed;

  if (reveal > 0.3) {
    // 정체 드러남 - 몬스터 형태
    // v8.0: 열린 뚜껑 - 검은 아웃라인
    ctx.save();
    ctx.translate(0, -5 * P);
    ctx.rotate(-0.3);
    drawPixelRectWithBlackOutline(ctx, -5 * P, -1 * P, 10, 2, P, isHit ? '#ffffff' : boxColor);
    ctx.restore();

    // v8.0: 박스 바디 - 검은 아웃라인
    drawBlackOutlineRect(ctx, -5 * P - P, -3 * P - P, 10 + 1, 9 + 1, P);
    drawPixelRect(ctx, -5 * P, -3 * P, 10, 9, P, boxColor);

    // v8.0: 이빨 - 검은 아웃라인
    for (let i = 0; i < 3; i++) {
      drawPixelRectWithBlackOutline(ctx, -4 * P + i * 3 * P, -4 * P, 1, 2, P, isHit ? '#ffffff' : teethColor);
    }

    // v8.0: 혀 - 검은 아웃라인
    drawPixelRectWithBlackOutline(ctx, -1 * P, -1 * P, 2, 5, P, isHit ? '#ffffff' : tongueColor);
    drawPixelCircleWithBlackOutline(ctx, 0, 4 * P, 1, P, tongueColor);

    // v8.0: 사악한 눈 - 검은 아웃라인
    drawPixelCircleWithBlackOutline(ctx, -2 * P, -2 * P, 0, P, CYBER_PALETTE.brightRed);
    drawPixelCircleWithBlackOutline(ctx, 2 * P, -2 * P, 0, P, CYBER_PALETTE.brightRed);
  } else {
    // 위장 상태 - 일반 보급 상자
    // v8.0: 박스 - 검은 아웃라인
    drawBlackOutlineRect(ctx, -5 * P - P, -4 * P - P, 10 + 1, 10 + 1, P);
    drawPixelRect(ctx, -5 * P, -4 * P, 10, 10, P, boxColor);
    drawPixelRectWithBlackOutline(ctx, -5 * P, -5 * P, 10, 2, P, isHit ? '#ffffff' : boxColor);

    // v8.0: 십자 심볼 - 검은 아웃라인
    drawPixelRectWithBlackOutline(ctx, -1 * P, -2 * P, 2, 5, P, isHit ? '#ffffff' : teethColor);
    drawPixelRectWithBlackOutline(ctx, -3 * P, 0, 6, 2, P, isHit ? '#ffffff' : teethColor);
  }

  ctx.restore();
}

// =====================================================
// STAGE 18: Training Ground (훈련장) - Military Theme
// =====================================================

export function drawPixelTargetDummy(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const sway = Math.sin(t / 400) * 2;

  ctx.save();
  ctx.rotate(sway * 0.02);

  const bodyColor = isHit ? '#ffffff' : CYBER_PALETTE.brightRed;
  const standColor = isHit ? '#ffffff' : '#a1a1aa';

  // v8.0: 타겟 서클 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, -2 * P, 6, P, bodyColor);
  drawPixelCircleWithBlackOutline(ctx, 0, -2 * P, 4, P, isHit ? '#ffffff' : '#fafafa');
  drawPixelCircleWithBlackOutline(ctx, 0, -2 * P, 2, P, bodyColor);

  // v8.0: 불스아이 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, -2 * P, 1, P, isHit ? '#ffffff' : '#fafafa');

  // v8.0: 스탠드 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -1 * P, 4 * P, 2, 6, P, isHit ? '#ffffff' : standColor);
  drawPixelRectWithBlackOutline(ctx, -3 * P, 9 * P, 6, 2, P, isHit ? '#ffffff' : standColor);

  // 총탄 자국
  drawPixel(ctx, 2 * P, -3 * P, P, CYBER_PALETTE.darkBg);
  drawPixel(ctx, -2 * P, -1 * P, P, CYBER_PALETTE.darkBg);
  drawPixel(ctx, 1 * P, -4 * P, P, CYBER_PALETTE.darkBg);

  ctx.restore();
}

export function drawPixelObstacleWall(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  ctx.save();

  const brickColor = isHit ? '#ffffff' : '#9ca3af';
  const mortarColor = isHit ? '#ffffff' : '#6b7280';

  // v8.0: 벽돌 패턴 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -6 * P - P, -6 * P - P, 12 + 1, 12 + 1, P);

  // 벽돌 행
  for (let row = 0; row < 3; row++) {
    const offset = row % 2 === 0 ? 0 : 3 * P;
    for (let col = 0; col < 2; col++) {
      const x = -6 * P + offset + col * 6 * P;
      const y = -6 * P + row * 4 * P;
      if (x < 6 * P) {
        drawPixelRect(ctx, x, y, 5, 3, P, brickColor);
      }
    }
  }

  // 시멘트 라인
  for (let row = 0; row < 3; row++) {
    drawPixelRect(ctx, -6 * P, -6 * P + row * 4 * P + 3 * P, 12, 1, P, mortarColor);
  }

  // v8.0: 철조망 - 검은 아웃라인
  for (let i = 0; i < 4; i++) {
    drawPixelCircleWithBlackOutline(ctx, -4 * P + i * 3 * P, -8 * P, 0, P, isHit ? '#ffffff' : '#a1a1aa');
  }

  ctx.restore();
}

export function drawPixelDrillSergeant(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const yell = Math.sin(t / 150) > 0.5;

  ctx.save();

  const uniformColor = isHit ? '#ffffff' : '#4d7c0f';
  const skinColor = isHit ? '#ffffff' : '#fde68a';
  const hatColor = isHit ? '#ffffff' : '#27272a';

  // v8.0: 바디 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -4 * P - P, -2 * P - P, 8 + 1, 9 + 1, P);
  drawPixelRect(ctx, -4 * P, -2 * P, 8, 9, P, uniformColor);

  // v8.0: 머리 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, -5 * P, 3, P, skinColor);

  // v8.0: 모자 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -4 * P, -8 * P, 8, 2, P, isHit ? '#ffffff' : hatColor);
  drawPixelRectWithBlackOutline(ctx, -5 * P, -7 * P, 10, 1, P, isHit ? '#ffffff' : hatColor);

  // 얼굴
  drawPixel(ctx, -2 * P, -5 * P, P, CYBER_PALETTE.darkBg);
  drawPixel(ctx, 2 * P, -5 * P, P, CYBER_PALETTE.darkBg);

  // 소리지르는 입
  if (yell) {
    drawPixelRect(ctx, -2 * P, -4 * P, 4, 2, P, CYBER_PALETTE.darkBg);
    // 느낌표 효과
    drawPixel(ctx, 5 * P, -6 * P, P, CYBER_PALETTE.brightRed);
    drawPixel(ctx, 6 * P, -5 * P, P, CYBER_PALETTE.brightRed);
    drawPixel(ctx, 5 * P, -4 * P, P, CYBER_PALETTE.brightRed);
  } else {
    drawPixelRect(ctx, -1 * P, -4 * P, 2, 1, P, CYBER_PALETTE.darkBg);
  }

  // v8.0: 호루라기 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 5 * P, -2 * P, 1, P, isHit ? '#ffffff' : '#a1a1aa');

  ctx.restore();
}

export function drawPixelTripwire(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const tense = Math.sin(t / 200) * 1;

  ctx.save();

  const wireColor = isHit ? '#ffffff' : CYBER_PALETTE.brightRed;
  const stakeColor = isHit ? '#ffffff' : '#a1a1aa';
  const warningColor = isHit ? '#ffffff' : CYBER_PALETTE.brightYellow;

  // v8.0: 말뚝 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -7 * P, -2 * P, 2, 6, P, isHit ? '#ffffff' : stakeColor);
  drawPixelRectWithBlackOutline(ctx, 5 * P, -2 * P, 2, 6, P, isHit ? '#ffffff' : stakeColor);

  // v8.0: 와이어 (팽팽한) - 검은 아웃라인
  ctx.save();
  ctx.translate(0, tense);
  drawBlackOutlineRect(ctx, -6 * P - P, 0 - P, 12 + 1, 1 + 1, P);
  drawPixelRect(ctx, -6 * P, 0, 12, 1, P, wireColor);
  ctx.restore();

  // v8.0: 경고 표지판 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -2 * P, -5 * P, 4, 3, P, isHit ? '#ffffff' : warningColor);
  drawPixel(ctx, 0, -4 * P, P, CYBER_PALETTE.darkBg);
  drawPixelRect(ctx, 0, -3 * P, 1, 1, P, CYBER_PALETTE.darkBg);

  // v8.0: 지면 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -8 * P - P, 4 * P - P, 16 + 1, 2 + 1, P);
  drawPixelRect(ctx, -8 * P, 4 * P, 16, 2, P, isHit ? '#ffffff' : '#9ca3af');

  ctx.restore();
}

export function drawPixelSandbagTumble(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const tumble = (t / 300) % (Math.PI * 2);

  ctx.save();
  ctx.rotate(tumble * 0.3);

  const bagColor = isHit ? '#ffffff' : '#e4e4e7';
  const tieColor = isHit ? '#ffffff' : '#9ca3af';

  // v8.0: 모래주머니 모양 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -5 * P - P, -3 * P - P, 10 + 1, 6 + 1, P);
  drawPixelRect(ctx, -5 * P, -3 * P, 10, 6, P, bagColor);
  drawPixelCircleWithBlackOutline(ctx, -5 * P, 0, 3, P, bagColor);
  drawPixelCircleWithBlackOutline(ctx, 5 * P, 0, 3, P, bagColor);

  // v8.0: 끈/매듭 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, 4 * P, -1 * P, 3, 2, P, isHit ? '#ffffff' : tieColor);

  // 모래 텍스처
  for (let i = 0; i < 4; i++) {
    const x = -3 * P + (i * 2 * P);
    const y = -2 * P + (i % 2) * 2 * P;
    drawPixel(ctx, x, y, P, tieColor);
  }

  // v8.0: 샌드 새는 효과 - 검은 아웃라인
  const sandY = (t / 100) % 4;
  drawPixelCircleWithBlackOutline(ctx, -4 * P, 3 * P + sandY, 0, P, bagColor);
  drawPixelCircleWithBlackOutline(ctx, -3 * P, 4 * P + sandY, 0, P, bagColor);

  ctx.restore();
}

// =====================================================
// STAGE 19: Mainframe (메인프레임) - CPU Theme
// =====================================================

export function drawPixelLogicGate(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const pulse = Math.sin(t / 300) > 0;

  ctx.save();

  const gateColor = isHit ? '#ffffff' : CYBER_PALETTE.brightCyan;
  const wireColor = isHit ? '#ffffff' : '#a1a1aa';
  const signalColor = isHit ? '#ffffff' : (pulse ? CYBER_PALETTE.acidGreen : '#4ade80');

  // v8.0: 게이트 바디 (AND 게이트 모양) - 검은 아웃라인
  drawBlackOutlineRect(ctx, -4 * P - P, -4 * P - P, 6 + 1, 8 + 1, P);
  drawPixelRect(ctx, -4 * P, -4 * P, 6, 8, P, gateColor);
  drawPixelCircleWithBlackOutline(ctx, 2 * P, 0, 4, P, gateColor);

  // v8.0: 입력 와이어 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -7 * P, -2 * P, 3, 1, P, isHit ? '#ffffff' : wireColor);
  drawPixelRectWithBlackOutline(ctx, -7 * P, 1 * P, 3, 1, P, isHit ? '#ffffff' : wireColor);

  // v8.0: 출력 와이어 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, 5 * P, 0, 3, 1, P, isHit ? '#ffffff' : wireColor);

  // v8.0: 신호 인디케이터 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, -6 * P, -2 * P, 0, P, signalColor);
  drawPixelCircleWithBlackOutline(ctx, -6 * P, 1 * P, 0, P, signalColor);
  drawPixelCircleWithBlackOutline(ctx, 7 * P, 0, 1, P, pulse ? CYBER_PALETTE.acidGreen : CYBER_PALETTE.brightRed);

  // 라벨
  drawPixel(ctx, -1 * P, -1 * P, P, '#fafafa');
  drawPixel(ctx, 0, -1 * P, P, '#fafafa');
  drawPixel(ctx, 1 * P, -1 * P, P, '#fafafa');

  ctx.restore();
}

export function drawPixelRegisterFile(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const activeReg = Math.floor((t / 200) % 4);

  ctx.save();

  const chipColor = isHit ? '#ffffff' : CYBER_PALETTE.acidGreen;
  const pinColor = isHit ? '#ffffff' : '#a1a1aa';
  const dataColor = isHit ? '#ffffff' : CYBER_PALETTE.brightCyan;

  // v8.0: 칩 바디 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -5 * P - P, -6 * P - P, 10 + 1, 12 + 1, P);
  drawPixelRect(ctx, -5 * P, -6 * P, 10, 12, P, chipColor);

  // v8.0: 핀 (좌우) - 검은 아웃라인
  for (let i = 0; i < 4; i++) {
    drawPixelRectWithBlackOutline(ctx, -7 * P, -5 * P + i * 3 * P, 2, 1, P, isHit ? '#ffffff' : pinColor);
    drawPixelRectWithBlackOutline(ctx, 5 * P, -5 * P + i * 3 * P, 2, 1, P, isHit ? '#ffffff' : pinColor);
  }

  // v8.0: 레지스터 셀 - 검은 아웃라인
  for (let i = 0; i < 4; i++) {
    const isActive = i === activeReg;
    drawPixelRectWithBlackOutline(ctx, -3 * P, -5 * P + i * 3 * P, 6, 1, P,
      isHit ? '#ffffff' : (isActive ? dataColor : CYBER_PALETTE.darkBg));
  }

  // 라벨
  drawPixel(ctx, -1 * P, 5 * P, P, '#fafafa');
  drawPixel(ctx, 0, 5 * P, P, '#fafafa');
  drawPixel(ctx, 1 * P, 5 * P, P, '#fafafa');

  ctx.restore();
}

export function drawPixelBusController(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const dataFlow = Math.floor((t / 100) % 8);

  ctx.save();

  const bodyColor = isHit ? '#ffffff' : CYBER_PALETTE.brightOrange;
  const busColor = isHit ? '#ffffff' : '#71717a';
  const dataColor = isHit ? '#ffffff' : CYBER_PALETTE.acidGreen;

  // v8.0: 중앙 컨트롤러 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -4 * P - P, -4 * P - P, 8 + 1, 8 + 1, P);
  drawPixelRect(ctx, -4 * P, -4 * P, 8, 8, P, bodyColor);

  // v8.0: 버스 라인 4방향 - 검은 아웃라인
  // 좌측 버스
  drawPixelRectWithBlackOutline(ctx, -8 * P, -1 * P, 4, 2, P, busColor);
  // 우측 버스
  drawPixelRectWithBlackOutline(ctx, 4 * P, -1 * P, 4, 2, P, busColor);
  // 상단 버스
  drawPixelRectWithBlackOutline(ctx, -1 * P, -8 * P, 2, 4, P, busColor);
  // 하단 버스
  drawPixelRectWithBlackOutline(ctx, -1 * P, 4 * P, 2, 4, P, busColor);

  // v8.0: 데이터 패킷 - 검은 아웃라인
  const packetPositions = [
    { x: -7 * P + dataFlow * P, y: 0 },
    { x: 5 * P + (7 - dataFlow) * P / 2, y: 0 },
  ];
  for (const pos of packetPositions) {
    if (Math.abs(pos.x) < 7 * P) {
      drawPixelRectWithBlackOutline(ctx, pos.x, pos.y, 1, 1, P, dataColor);
    }
  }

  // v8.0: 컨트롤러 중심 LED - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 2, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);

  ctx.restore();
}

export function drawPixelAluCore(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const compute = Math.sin(t / 100) > 0;

  ctx.save();

  const coreColor = isHit ? '#ffffff' : CYBER_PALETTE.neonPink;
  const opColor = isHit ? '#ffffff' : CYBER_PALETTE.brightYellow;
  const resultColor = isHit ? '#ffffff' : CYBER_PALETTE.acidGreen;
  const inputColor = isHit ? '#ffffff' : CYBER_PALETTE.brightCyan;

  // v8.0: ALU 사다리꼴 형태 (단계별 확장) - 검은 아웃라인
  // 상단 (좁음)
  drawPixelRectWithBlackOutline(ctx, -3 * P, -5 * P, 6, 2, P, coreColor);
  // 중단
  drawPixelRectWithBlackOutline(ctx, -4 * P, -3 * P, 8, 2, P, coreColor);
  // 하단 (넓음)
  drawPixelRectWithBlackOutline(ctx, -5 * P, -1 * P, 10, 4, P, coreColor);

  // v8.0: 연산 기호 영역 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -2 * P, -1 * P, 4, 3, P, opColor);

  // v8.0: 입력 화살표 (좌우 상단) - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -7 * P, -4 * P, 3, 1, P, inputColor);
  drawPixelRectWithBlackOutline(ctx, 4 * P, -4 * P, 3, 1, P, inputColor);

  // v8.0: 출력 (하단 중앙) - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -1 * P, 3 * P, 2, 3, P, resultColor);

  // v8.0: 연산 활동 표시 - 깜빡임
  if (compute) {
    drawPixel(ctx, -1 * P, 0, P, '#ffffff');
    drawPixel(ctx, 1 * P, 0, P, '#ffffff');
  }

  ctx.restore();
}

export function drawPixelCacheLine(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const access = Math.floor((t / 150) % 4);

  ctx.save();

  const lineColor = isHit ? '#ffffff' : CYBER_PALETTE.brightCyan;
  const tagColor = isHit ? '#ffffff' : CYBER_PALETTE.brightOrange;
  const dataColor = isHit ? '#ffffff' : CYBER_PALETTE.acidGreen;

  // v8.0: 캐시 라인 메인 블록 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -7 * P - P, -3 * P - P, 14 + 1, 6 + 1, P);
  drawPixelRect(ctx, -7 * P, -3 * P, 14, 6, P, lineColor);

  // v8.0: 태그 필드 (좌측) - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -6 * P, -2 * P, 3, 4, P, tagColor);

  // v8.0: 데이터 블록 4개 - 검은 아웃라인
  for (let i = 0; i < 4; i++) {
    const isAccessed = i === access;
    const blockColor = isHit ? '#ffffff' : (isAccessed ? dataColor : CYBER_PALETTE.darkBg);
    drawPixelRectWithBlackOutline(ctx, -2 * P + i * 2 * P, -2 * P, 2, 4, P, blockColor);
  }

  // v8.0: Valid 비트 (상단 좌측) - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, -5 * P, -5 * P, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.acidGreen);

  // v8.0: Dirty 비트 (상단 우측) - 검은 아웃라인
  const dirtyColor = access >= 2 ? CYBER_PALETTE.brightOrange : CYBER_PALETTE.darkBg;
  drawPixelCircleWithBlackOutline(ctx, -3 * P, -5 * P, 1, P, isHit ? '#ffffff' : dirtyColor);

  ctx.restore();
}

// =====================================================
// STAGE 20: Data Prison (데이터 감옥) - Security Theme
// =====================================================

export function drawPixelFirewallGuard(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const flamePhase = Math.floor((t / 80) % 3);

  ctx.save();

  const armorColor = isHit ? '#ffffff' : CYBER_PALETTE.brightOrange;
  const flameColor = isHit ? '#ffffff' : CYBER_PALETTE.brightRed;
  const shieldColor = isHit ? '#ffffff' : '#71717a';

  // v8.0: 몸통 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -4 * P - P, -2 * P - P, 8 + 1, 8 + 1, P);
  drawPixelRect(ctx, -4 * P, -2 * P, 8, 8, P, armorColor);

  // v8.0: 헬멧 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, -5 * P, 3, P, armorColor);

  // v8.0: 불꽃 (헬멧 위) - 검은 아웃라인
  const flameHeights = [3, 4, 3];
  for (let i = 0; i < 3; i++) {
    const h = flameHeights[i] + (flamePhase === i ? 1 : 0);
    drawPixelRectWithBlackOutline(ctx, (-2 + i * 2) * P, -8 * P - h * P, 1, h, P, flameColor);
  }

  // v8.0: 방패 (좌측) - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -7 * P, -2 * P, 3, 6, P, shieldColor);

  // v8.0: 방패 심볼 (불꽃) - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -6 * P, 0, 1, 2, P, flameColor);

  // v8.0: 눈 - 검은 아웃라인
  drawPixel(ctx, -1 * P, -5 * P, P, '#000000');
  drawPixel(ctx, 1 * P, -5 * P, P, '#000000');

  ctx.restore();
}

export function drawPixelQuarantineCell(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const pulse = Math.sin(t / 300) > 0;

  ctx.save();

  const cellColor = isHit ? '#ffffff' : CYBER_PALETTE.brightRed;
  const barColor = isHit ? '#ffffff' : '#71717a';
  const virusColor = isHit ? '#ffffff' : CYBER_PALETTE.acidGreen;

  // v8.0: 격리 셀 프레임 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -6 * P - P, -6 * P - P, 12 + 1, 12 + 1, P);
  drawPixelRect(ctx, -6 * P, -6 * P, 12, 12, P, cellColor);

  // v8.0: 내부 어두운 영역
  drawPixelRect(ctx, -5 * P, -5 * P, 10, 10, P, CYBER_PALETTE.darkBg);

  // v8.0: 철창 (세로) - 검은 아웃라인
  for (let i = -3; i <= 3; i += 2) {
    drawPixelRectWithBlackOutline(ctx, i * P, -5 * P, 1, 10, P, barColor);
  }

  // v8.0: 감염된 바이러스 (내부) - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 2, P, virusColor);

  // v8.0: 바이러스 스파이크 - 검은 아웃라인
  if (pulse) {
    drawPixelRectWithBlackOutline(ctx, 0, -4 * P, 1, 1, P, virusColor);
    drawPixelRectWithBlackOutline(ctx, 0, 3 * P, 1, 1, P, virusColor);
  }

  // v8.0: 경고 라벨 (하단) - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -3 * P, 5 * P, 6, 2, P, CYBER_PALETTE.brightOrange);

  ctx.restore();
}

export function drawPixelCorruptedFile(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const glitchLine = Math.floor((t / 100) % 4);

  ctx.save();

  const fileColor = isHit ? '#ffffff' : '#e4e4e7';
  const cornerColor = isHit ? '#ffffff' : '#a1a1aa';
  const corruptColor = isHit ? '#ffffff' : CYBER_PALETTE.brightRed;

  // v8.0: 파일 본체 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -4 * P - P, -6 * P - P, 8 + 1, 12 + 1, P);
  drawPixelRect(ctx, -4 * P, -6 * P, 8, 12, P, fileColor);

  // v8.0: 접힌 모서리 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, 2 * P, -6 * P, 2, 2, P, cornerColor);

  // v8.0: 텍스트 라인 (일부 손상) - 검은 아웃라인
  for (let i = 0; i < 4; i++) {
    const isCorrupt = i === glitchLine;
    const lineColor = isHit ? '#ffffff' : (isCorrupt ? corruptColor : CYBER_PALETTE.darkBg);
    drawPixelRectWithBlackOutline(ctx, -3 * P, -4 * P + i * 2 * P, 6, 1, P, lineColor);
  }

  // v8.0: 에러 아이콘 (우측 하단) - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 3 * P, 4 * P, 2, P, corruptColor);
  drawPixel(ctx, 3 * P, 3 * P, P, '#ffffff');
  drawPixel(ctx, 3 * P, 5 * P, P, '#ffffff');

  ctx.restore();
}

export function drawPixelDeleteMarker(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const blink = Math.sin(t / 150) > 0;

  ctx.save();

  const bgColor = isHit ? '#ffffff' : CYBER_PALETTE.brightRed;
  const xColor = isHit ? '#ffffff' : '#ffffff';

  // v8.0: 원형 배경 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 5, P, bgColor);

  // v8.0: X 마크 - 검은 아웃라인 (깜빡임)
  if (blink || isHit) {
    // 대각선 X
    for (let i = -3; i <= 3; i++) {
      drawPixelRectWithBlackOutline(ctx, i * P, i * P, 1, 1, P, xColor);
      drawPixelRectWithBlackOutline(ctx, i * P, -i * P, 1, 1, P, xColor);
    }
  }

  // v8.0: DEL 라벨 (하단) - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -2 * P, 5 * P, 4, 2, P, CYBER_PALETTE.darkBg);

  ctx.restore();
}

export function drawPixelBackupGhost(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const float = Math.sin(t / 400) * P;
  const fade = 0.5 + Math.sin(t / 300) * 0.2;

  ctx.save();
  ctx.translate(0, float);

  const ghostColor = isHit ? '#ffffff' : '#c4b5fd';
  const diskColor = isHit ? '#ffffff' : CYBER_PALETTE.brightCyan;

  ctx.globalAlpha = isHit ? 1 : fade;

  // v8.0: 유령 머리 (원형) - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, -3 * P, 4, P, ghostColor);

  // v8.0: 유령 몸통 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -4 * P - P, -2 * P - P, 8 + 1, 6 + 1, P);
  drawPixelRect(ctx, -4 * P, -2 * P, 8, 6, P, ghostColor);

  // v8.0: 물결 모양 하단 - 검은 아웃라인
  for (let i = -3; i <= 3; i += 2) {
    const yOff = Math.abs(i) % 2;
    drawPixelRectWithBlackOutline(ctx, i * P, 4 * P + yOff * P, 1, 1, P, ghostColor);
  }

  // v8.0: 플로피 디스크 아이콘 (가슴) - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -2 * P, -1 * P, 4, 3, P, diskColor);
  drawPixelRect(ctx, -1 * P, 1 * P, 2, 1, P, '#e4e4e7');

  // v8.0: 눈 (슬픈 눈)
  ctx.globalAlpha = 1;
  drawPixel(ctx, -2 * P, -4 * P, P, '#000000');
  drawPixel(ctx, 2 * P, -4 * P, P, '#000000');

  ctx.restore();
}
