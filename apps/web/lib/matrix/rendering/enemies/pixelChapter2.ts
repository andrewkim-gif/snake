/**
 * game/rendering/enemies/pixelChapter2.ts - Chapter 2 Pixel Art Monsters (Stage 11-15)
 * v6.0: Cyberpunk pixel art style - hacking/underground theme
 *
 * Stage 11 (Hacker Hideout): script_kiddie, proxy_mask, vpn_tunnel, tor_onion, backdoor
 * Stage 12 (Encrypted Tunnel): cipher_block, hash_collision, salt_shaker, key_fragment, padding_oracle
 * Stage 13 (Dark Web): silk_crawler, bitcoin_thief, phish_hook, scam_popup, identity_ghost
 * Stage 14 (AI Factory): assembly_arm, conveyor_bot, qc_scanner, defect_unit, forge_spark
 * Stage 15 (Factory Core): core_drone, power_cell, cooling_fan, circuit_bug, steam_vent
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
// STAGE 11: Hacker Hideout (해커 아지트) - Hacking Theme
// =====================================================

export function drawPixelScriptKiddie(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const type = Math.sin(t / 200) * 0.5;

  ctx.save();

  // v8.0: 후드 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -4 * P - P, -5 * P - P, 8 + 1, 7 + 1, P);
  drawPixelRect(ctx, -4 * P, -5 * P, 8, 7, P, isHit ? '#ffffff' : '#1a1a2e');

  // v8.0: 얼굴 (모니터 반사) - 검은 아웃라인
  drawBlackOutlineRect(ctx, -3 * P - P, -3 * P - P, 6 + 1, 4 + 1, P);
  drawPixelRect(ctx, -3 * P, -3 * P, 6, 4, P, isHit ? '#ffffff' : CYBER_PALETTE.matrixDim);

  // v8.0: 눈 (타이핑 애니메이션) - 검은 아웃라인
  const eyeY = Math.floor(-1 + type) * P;
  drawPixelRectWithBlackOutline(ctx, -2 * P, eyeY, 1, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.acidGreen);
  drawPixelRectWithBlackOutline(ctx, 2 * P, eyeY, 1, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.acidGreen);

  // v8.0: 키보드 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -3 * P - P, 3 * P - P, 6 + 1, 2 + 1, P);
  drawPixelRect(ctx, -3 * P, 3 * P, 6, 2, P, isHit ? '#ffffff' : CYBER_PALETTE.darkBg);
  for (let i = 0; i < 3; i++) {
    drawPixelRectWithBlackOutline(ctx, (-2 + i * 2) * P, 3.5 * P, 1, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.matrixDim);
  }

  ctx.restore();
}

export function drawPixelProxyMask(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();

  ctx.save();

  // v8.0: 마스크 형태 (가이 포크스) - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 5, P, isHit ? '#ffffff' : CYBER_PALETTE.purple);
  drawBlackOutlineRect(ctx, -3 * P - P, 2 * P - P, 6 + 1, 3 + 1, P);
  drawPixelRect(ctx, -3 * P, 2 * P, 6, 3, P, isHit ? '#ffffff' : CYBER_PALETTE.purple);

  // v8.0: 눈 슬롯 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -3 * P, -2 * P, 2, 2, P, isHit ? '#ffffff' : CYBER_PALETTE.darkBg);
  drawPixelRectWithBlackOutline(ctx, 1 * P, -2 * P, 2, 2, P, isHit ? '#ffffff' : CYBER_PALETTE.darkBg);

  // v8.0: 빛나는 눈 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, -2 * P, -1 * P, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.acidGreen);
  drawPixelCircleWithBlackOutline(ctx, 2 * P, -1 * P, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.acidGreen);

  // v8.0: 스마일 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -2 * P, 3 * P, 4, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.darkBg);

  ctx.restore();
}

export function drawPixelVpnTunnel(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const flow = (t / 100) % 8;

  ctx.save();

  // v8.0: 터널 튜브 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -6 * P - P, -2 * P - P, 12 + 1, 4 + 1, P);
  drawPixelRect(ctx, -6 * P, -2 * P, 12, 4, P, isHit ? '#ffffff' : CYBER_PALETTE.success);
  drawBlackOutlineRect(ctx, -5 * P - P, -1 * P - P, 10 + 1, 2 + 1, P);
  drawPixelRect(ctx, -5 * P, -1 * P, 10, 2, P, isHit ? '#ffffff' : CYBER_PALETTE.darkBg);

  // v8.0: 데이터 패킷 흐름 - 검은 아웃라인
  for (let i = 0; i < 3; i++) {
    const px = (-4 + ((flow + i * 3) % 8)) * P;
    drawPixelRectWithBlackOutline(ctx, px, 0, 1, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.acidGreen);
  }

  // v8.0: 입출구 포털 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, -6 * P, 0, 2, P, isHit ? '#ffffff' : CYBER_PALETTE.neonPink);
  drawPixelCircleWithBlackOutline(ctx, 6 * P, 0, 2, P, isHit ? '#ffffff' : CYBER_PALETTE.neonPink);

  ctx.restore();
}

export function drawPixelTorOnion(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const rotate = (t / 500) % (Math.PI * 2);

  ctx.save();
  ctx.rotate(rotate * 0.1);

  // v8.0: 양파 레이어들 - 검은 아웃라인
  const layers = [
    isHit ? '#ffffff' : '#7c3aed',  // Outer - purple
    isHit ? '#ffffff' : '#a78bfa',
    isHit ? '#ffffff' : '#c4b5fd',  // Inner - light purple
  ];

  for (let i = 0; i < layers.length; i++) {
    const r = 5 - i;
    drawPixelCircleWithBlackOutline(ctx, 0, 0, r, P, layers[i]);
  }

  // v8.0: 코어 (데이터) - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.acidGreen);

  // v8.0: 양파 잎 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, 0, -6 * P, 1, 2, P, isHit ? '#ffffff' : CYBER_PALETTE.success);

  ctx.restore();
}

export function drawPixelBackdoor(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const open = Math.sin(t / 400) * 0.2;

  ctx.save();

  // v8.0: 문 프레임 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -5 * P - P, -6 * P - P, 10 + 1, 12 + 1, P);
  drawPixelRect(ctx, -5 * P, -6 * P, 10, 12, P, isHit ? '#ffffff' : CYBER_PALETTE.brightOrange);

  // v8.0: 어둠의 공간 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -4 * P - P, -5 * P - P, 8 + 1, 10 + 1, P);
  drawPixelRect(ctx, -4 * P, -5 * P, 8, 10, P, isHit ? '#ffffff' : CYBER_PALETTE.darkBg);

  // v8.0: 문 (살짝 열림) - 검은 아웃라인
  const doorWidth = Math.floor(6 - open * 2);
  drawBlackOutlineRect(ctx, -4 * P - P, -5 * P - P, doorWidth + 1, 10 + 1, P);
  drawPixelRect(ctx, -4 * P, -5 * P, doorWidth, 10, P, isHit ? '#ffffff' : CYBER_PALETTE.metal);

  // v8.0: 문 손잡이 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, (doorWidth - 5) * P, 0, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightYellow);

  // v8.0: 경고 LED - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, -7 * P, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);

  ctx.restore();
}

// =====================================================
// STAGE 12: Encrypted Tunnel (암호화 터널) - Crypto Theme
// =====================================================

export function drawPixelCipherBlock(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const glitch = deterministicRandom(Math.floor(t / 100)) > 0.9;

  ctx.save();

  // v8.0: 암호 블록 메인 바디 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -5 * P - P, -5 * P - P, 10 + 1, 10 + 1, P);
  drawPixelRect(ctx, -5 * P, -5 * P, 10, 10, P, isHit ? '#ffffff' : CYBER_PALETTE.brightCyan);

  // v8.0: 암호화 그리드 패턴 - 검은 아웃라인
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) {
      const px = -3 * P + x * 3 * P;
      const py = -3 * P + y * 3 * P;
      const color = glitch ? CYBER_PALETTE.brightRed : CYBER_PALETTE.matrixDark;
      drawPixelRectWithBlackOutline(ctx, px, py, 2, 2, P, isHit ? '#ffffff' : color);
    }
  }

  // v8.0: 자물쇠 아이콘 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, -6 * P, 2, P, isHit ? '#ffffff' : CYBER_PALETTE.brightYellow);
  drawPixelRectWithBlackOutline(ctx, -1 * P, -5 * P, 3, 3, P, isHit ? '#ffffff' : CYBER_PALETTE.brightYellow);

  // v8.0: 상태 LED - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, 4 * P, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);

  ctx.restore();
}

export function drawPixelHashCollision(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const crash = Math.abs(Math.sin(t / 150)) * 3;

  ctx.save();

  // v8.0: 충돌하는 해시 블록 1 - 검은 아웃라인
  ctx.save();
  ctx.translate(-crash * P, 0);
  drawBlackOutlineRect(ctx, -6 * P - P, -4 * P - P, 5 + 1, 8 + 1, P);
  drawPixelRect(ctx, -6 * P, -4 * P, 5, 8, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);
  // 해시 심볼 #
  drawPixelRectWithBlackOutline(ctx, -5 * P, -2 * P, 1, 4, P, isHit ? '#ffffff' : CYBER_PALETTE.brightYellow);
  drawPixelRectWithBlackOutline(ctx, -3 * P, -2 * P, 1, 4, P, isHit ? '#ffffff' : CYBER_PALETTE.brightYellow);
  ctx.restore();

  // v8.0: 충돌하는 해시 블록 2 - 검은 아웃라인
  ctx.save();
  ctx.translate(crash * P, 0);
  drawBlackOutlineRect(ctx, 1 * P - P, -4 * P - P, 5 + 1, 8 + 1, P);
  drawPixelRect(ctx, 1 * P, -4 * P, 5, 8, P, isHit ? '#ffffff' : CYBER_PALETTE.brightCyan);
  // 해시 심볼 #
  drawPixelRectWithBlackOutline(ctx, 2 * P, -2 * P, 1, 4, P, isHit ? '#ffffff' : CYBER_PALETTE.brightYellow);
  drawPixelRectWithBlackOutline(ctx, 4 * P, -2 * P, 1, 4, P, isHit ? '#ffffff' : CYBER_PALETTE.brightYellow);
  ctx.restore();

  // v8.0: 충돌 스파크 - 검은 아웃라인
  if (crash < 1) {
    drawPixelCircleWithBlackOutline(ctx, 0, -3 * P, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightOrange);
    drawPixelCircleWithBlackOutline(ctx, 0, 0, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightYellow);
    drawPixelCircleWithBlackOutline(ctx, 0, 3 * P, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightOrange);
  }

  ctx.restore();
}

export function drawPixelSaltShaker(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const shake = Math.sin(t / 80) * 0.1;

  ctx.save();
  ctx.rotate(shake);

  // v8.0: 솔트 쉐이커 바디 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -3 * P - P, -2 * P - P, 6 + 1, 8 + 1, P);
  drawPixelRect(ctx, -3 * P, -2 * P, 6, 8, P, isHit ? '#ffffff' : CYBER_PALETTE.lightGray);

  // v8.0: 목 부분 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -2 * P - P, -4 * P - P, 4 + 1, 2 + 1, P);
  drawPixelRect(ctx, -2 * P, -4 * P, 4, 2, P, isHit ? '#ffffff' : CYBER_PALETTE.lightGray);

  // v8.0: 뚜껑 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -2 * P - P, -5 * P - P, 5 + 1, 2 + 1, P);
  drawPixelRect(ctx, -2 * P, -5 * P, 5, 2, P, isHit ? '#ffffff' : CYBER_PALETTE.metal);

  // v8.0: 뚜껑 구멍들 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, -1 * P, -5 * P, 0, P, isHit ? '#ffffff' : CYBER_PALETTE.darkBg);
  drawPixelCircleWithBlackOutline(ctx, 1 * P, -5 * P, 0, P, isHit ? '#ffffff' : CYBER_PALETTE.darkBg);

  // v8.0: 떨어지는 소금 입자 - 검은 아웃라인
  const saltPhase = (t / 100) % 6;
  drawPixelCircleWithBlackOutline(ctx, -1 * P, (6 + saltPhase) * P, 0, P, isHit ? '#ffffff' : '#ffffff');
  drawPixelCircleWithBlackOutline(ctx, 1 * P, (7 + saltPhase) * P, 0, P, isHit ? '#ffffff' : '#ffffff');
  drawPixelCircleWithBlackOutline(ctx, 0, (8 + saltPhase) * P, 0, P, isHit ? '#ffffff' : '#ffffff');

  // v8.0: 'S' 라벨 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -1 * P, 0, 2, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightCyan);
  drawPixelRectWithBlackOutline(ctx, -1 * P, 1 * P, 1, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightCyan);
  drawPixelRectWithBlackOutline(ctx, 0, 2 * P, 2, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightCyan);
  drawPixelRectWithBlackOutline(ctx, 0, 3 * P, 1, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightCyan);
  drawPixelRectWithBlackOutline(ctx, -1 * P, 4 * P, 2, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightCyan);

  ctx.restore();
}

export function drawPixelKeyFragment(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const floatY = Math.sin(t / 200) * P;

  ctx.save();

  // v8.0: 열쇠 머리 부분 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, -4 * P, 0, 3, P, isHit ? '#ffffff' : CYBER_PALETTE.brightYellow);
  // 열쇠 구멍
  drawPixelCircleWithBlackOutline(ctx, -4 * P, 0, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.darkBg);

  // v8.0: 열쇠 몸통 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -2 * P - P, -1 * P - P, 4 + 1, 2 + 1, P);
  drawPixelRect(ctx, -2 * P, -1 * P, 4, 2, P, isHit ? '#ffffff' : CYBER_PALETTE.brightYellow);

  // v8.0: 부러진 조각 (떠다니는) - 검은 아웃라인
  ctx.save();
  ctx.translate(0, floatY);
  drawBlackOutlineRect(ctx, 3 * P - P, -1 * P - P, 3 + 1, 2 + 1, P);
  drawPixelRect(ctx, 3 * P, -1 * P, 3, 2, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);
  // 열쇠 이빨
  drawPixelRectWithBlackOutline(ctx, 4 * P, 1 * P, 1, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);
  drawPixelRectWithBlackOutline(ctx, 5 * P, 1 * P, 1, 2, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);
  ctx.restore();

  // v8.0: 부러진 부분 스파크 - 검은 아웃라인
  if (Math.sin(t / 100) > 0.5) {
    drawPixelCircleWithBlackOutline(ctx, 2 * P, -1 * P, 0, P, isHit ? '#ffffff' : CYBER_PALETTE.acidGreen);
    drawPixelCircleWithBlackOutline(ctx, 2 * P, 1 * P, 0, P, isHit ? '#ffffff' : CYBER_PALETTE.acidGreen);
  }

  ctx.restore();
}

export function drawPixelPaddingOracle(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const pulse = (Math.sin(t / 400) + 1) / 2;

  ctx.save();

  // v8.0: 오라클 크리스탈 볼 외곽 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, -1 * P, 5, P, isHit ? '#ffffff' : CYBER_PALETTE.neonPink);
  // 내부 어둠
  drawPixelCircleWithBlackOutline(ctx, 0, -1 * P, 3, P, isHit ? '#ffffff' : CYBER_PALETTE.darkBg);

  // v8.0: 모든 것을 보는 눈 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -2 * P - P, -2 * P - P, 4 + 1, 2 + 1, P);
  drawPixelRect(ctx, -2 * P, -2 * P, 4, 2, P, isHit ? '#ffffff' : CYBER_PALETTE.acidGreen);
  // 동공
  drawPixelCircleWithBlackOutline(ctx, 0, -1 * P, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);

  // v8.0: 받침대 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -4 * P - P, 4 * P - P, 8 + 1, 2 + 1, P);
  drawPixelRect(ctx, -4 * P, 4 * P, 8, 2, P, isHit ? '#ffffff' : CYBER_PALETTE.metal);

  // v8.0: 패딩 블록 (회전) - 검은 아웃라인
  for (let i = 0; i < 4; i++) {
    const angle = (t / 1000 + i * Math.PI / 2) % (Math.PI * 2);
    const px = Math.cos(angle) * 7 * P;
    const py = Math.sin(angle) * 5 * P;
    const padColor = i % 2 === 0 ? CYBER_PALETTE.brightCyan : CYBER_PALETTE.neonPink;
    drawPixelCircleWithBlackOutline(ctx, px, py, 1, P, isHit ? '#ffffff' : padColor);
  }

  ctx.restore();
}

// =====================================================
// STAGE 13: Dark Web (다크웹) - Criminal Theme
// =====================================================

export function drawPixelSilkCrawler(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const legMove = Math.sin(t / 100) * P;

  ctx.save();

  // v8.0: 거미 복부 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, 1 * P, 4, P, isHit ? '#ffffff' : CYBER_PALETTE.darkBg);

  // v8.0: 거미 머리 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, -3 * P, 3, P, isHit ? '#ffffff' : CYBER_PALETTE.darkBg);

  // v8.0: 8개 다리 - 검은 아웃라인
  for (let i = 0; i < 4; i++) {
    const angle = (i - 1.5) * 0.3;
    const legOff = (i % 2 === 0) ? legMove : -legMove;

    // 왼쪽 다리
    ctx.save();
    ctx.rotate(-0.3 - angle);
    drawBlackOutlineRect(ctx, -7 * P - P, -P + legOff - P, 4 + 1, 1 + 1, P);
    drawPixelRect(ctx, -7 * P, -P + legOff, 4, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.neonPink);
    ctx.restore();

    // 오른쪽 다리
    ctx.save();
    ctx.rotate(0.3 + angle);
    drawBlackOutlineRect(ctx, 3 * P - P, -P - legOff - P, 4 + 1, 1 + 1, P);
    drawPixelRect(ctx, 3 * P, -P - legOff, 4, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.neonPink);
    ctx.restore();
  }

  // v8.0: 4개 눈 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, -2 * P, -4 * P, 0, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);
  drawPixelCircleWithBlackOutline(ctx, -1 * P, -5 * P, 0, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);
  drawPixelCircleWithBlackOutline(ctx, 1 * P, -5 * P, 0, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);
  drawPixelCircleWithBlackOutline(ctx, 2 * P, -4 * P, 0, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);

  // v8.0: 복부 무늬 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, 1 * P, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightOrange);

  ctx.restore();
}

export function drawPixelBitcoinThief(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const grab = Math.sin(t / 300) * P;

  ctx.save();

  // v8.0: 도둑 머리 (복면) - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, -2 * P, 4, P, isHit ? '#ffffff' : '#1a1a1a');

  // v8.0: 도둑 몸체 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -3 * P - P, 2 * P - P, 6 + 1, 5 + 1, P);
  drawPixelRect(ctx, -3 * P, 2 * P, 6, 5, P, isHit ? '#ffffff' : '#1a1a1a');

  // v8.0: 눈구멍 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -3 * P, -3 * P, 2, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.lightGray);
  drawPixelRectWithBlackOutline(ctx, 1 * P, -3 * P, 2, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.lightGray);
  // 눈동자
  drawPixelCircleWithBlackOutline(ctx, -2 * P, -3 * P, 0, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);
  drawPixelCircleWithBlackOutline(ctx, 2 * P, -3 * P, 0, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);

  // v8.0: 돈자루 - 검은 아웃라인
  ctx.save();
  ctx.translate(5 * P, 2 * P + grab);
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 3, P, isHit ? '#ffffff' : CYBER_PALETTE.metal);
  // 비트코인 심볼 ₿
  drawPixelRectWithBlackOutline(ctx, -1 * P, -2 * P, 2, 4, P, isHit ? '#ffffff' : CYBER_PALETTE.brightOrange);
  drawPixelRectWithBlackOutline(ctx, -2 * P, -1 * P, 1, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightOrange);
  drawPixelRectWithBlackOutline(ctx, -2 * P, 1 * P, 1, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightOrange);
  ctx.restore();

  // v8.0: 움켜잡는 팔 - 검은 아웃라인
  const armLen = 3 + Math.floor(grab / P);
  drawBlackOutlineRect(ctx, 2 * P - P, 1 * P - P, armLen + 1, 2 + 1, P);
  drawPixelRect(ctx, 2 * P, 1 * P, armLen, 2, P, isHit ? '#ffffff' : '#1a1a1a');

  ctx.restore();
}

export function drawPixelPhishHook(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const dangle = Math.sin(t / 400) * P;

  ctx.save();

  // v8.0: 낚싯줄 - 검은 아웃라인
  drawBlackOutlineRect(ctx, 0 - P, -8 * P - P, 1 + 1, 8 + 1, P);
  drawPixelRect(ctx, 0, -8 * P, 1, 8, P, isHit ? '#ffffff' : CYBER_PALETTE.lightGray);

  // v8.0: 낚시 바늘 메인 - 검은 아웃라인
  drawBlackOutlineRect(ctx, 0 - P, 0 - P, 1 + 1, 4 + 1, P);
  drawPixelRect(ctx, 0, 0, 1, 4, P, isHit ? '#ffffff' : CYBER_PALETTE.metal);

  // v8.0: 바늘 곡선 부분 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -2 * P - P, 4 * P - P, 3 + 1, 1 + 1, P);
  drawPixelRect(ctx, -2 * P, 4 * P, 3, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.metal);
  drawBlackOutlineRect(ctx, -3 * P - P, 2 * P - P, 1 + 1, 3 + 1, P);
  drawPixelRect(ctx, -3 * P, 2 * P, 1, 3, P, isHit ? '#ffffff' : CYBER_PALETTE.metal);

  // v8.0: 미끼 (이메일 아이콘) - 검은 아웃라인
  ctx.save();
  ctx.translate(-3 * P, dangle);
  drawBlackOutlineRect(ctx, -2 * P - P, -2 * P - P, 4 + 1, 3 + 1, P);
  drawPixelRect(ctx, -2 * P, -2 * P, 4, 3, P, isHit ? '#ffffff' : CYBER_PALETTE.brightCyan);
  // @ 심볼
  drawPixelRectWithBlackOutline(ctx, -1 * P, -1 * P, 1, 1, P, isHit ? '#ffffff' : '#ffffff');
  drawPixelRectWithBlackOutline(ctx, 0, -2 * P, 1, 1, P, isHit ? '#ffffff' : '#ffffff');
  drawPixelRectWithBlackOutline(ctx, 1 * P, -1 * P, 1, 1, P, isHit ? '#ffffff' : '#ffffff');
  ctx.restore();

  // v8.0: 바늘 끝 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, -3 * P, 1 * P, 0, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);

  ctx.restore();
}

export function drawPixelScamPopup(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const flash = Math.sin(t / 100) > 0;

  ctx.save();

  // v8.0: 팝업 창 배경 - 검은 아웃라인
  const bgColor = flash ? CYBER_PALETTE.brightYellow : CYBER_PALETTE.brightRed;
  drawBlackOutlineRect(ctx, -6 * P - P, -5 * P - P, 12 + 1, 10 + 1, P);
  drawPixelRect(ctx, -6 * P, -5 * P, 12, 10, P, isHit ? '#ffffff' : bgColor);

  // v8.0: 타이틀 바 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -6 * P - P, -5 * P - P, 12 + 1, 2 + 1, P);
  drawPixelRect(ctx, -6 * P, -5 * P, 12, 2, P, isHit ? '#ffffff' : CYBER_PALETTE.brightCyan);

  // v8.0: 닫기 버튼 (X) - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, 4 * P, -5 * P, 1, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);
  drawPixelRectWithBlackOutline(ctx, 5 * P, -4 * P, 1, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);

  // v8.0: "YOU WIN!" 텍스트 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -4 * P - P, -2 * P - P, 8 + 1, 1 + 1, P);
  drawPixelRect(ctx, -4 * P, -2 * P, 8, 1, P, isHit ? '#ffffff' : '#ffffff');
  drawBlackOutlineRect(ctx, -3 * P - P, 0 - P, 6 + 1, 1 + 1, P);
  drawPixelRect(ctx, -3 * P, 0, 6, 1, P, isHit ? '#ffffff' : '#ffffff');

  // v8.0: 가짜 버튼 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -3 * P - P, 2 * P - P, 6 + 1, 2 + 1, P);
  drawPixelRect(ctx, -3 * P, 2 * P, 6, 2, P, isHit ? '#ffffff' : CYBER_PALETTE.acidGreen);

  ctx.restore();
}

export function drawPixelIdentityGhost(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const float = Math.sin(t / 500) * P;
  const fade = 0.5 + Math.sin(t / 300) * 0.3;

  ctx.save();
  ctx.translate(0, float);
  ctx.globalAlpha = isHit ? 1 : fade;

  // v8.0: 유령 머리 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, -2 * P, 5, P, isHit ? '#ffffff' : CYBER_PALETTE.lightGray);

  // v8.0: 유령 몸통 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -5 * P - P, -2 * P - P, 10 + 1, 7 + 1, P);
  drawPixelRect(ctx, -5 * P, -2 * P, 10, 7, P, isHit ? '#ffffff' : CYBER_PALETTE.lightGray);

  // v8.0: 물결 모양 하단 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, -4 * P, 5 * P, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.lightGray);
  drawPixelCircleWithBlackOutline(ctx, 0, 6 * P, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.lightGray);
  drawPixelCircleWithBlackOutline(ctx, 4 * P, 5 * P, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.lightGray);

  // v8.0: ID 카드 오버레이 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -3 * P - P, -1 * P - P, 6 + 1, 4 + 1, P);
  drawPixelRect(ctx, -3 * P, -1 * P, 6, 4, P, isHit ? '#ffffff' : CYBER_PALETTE.brightCyan);
  // 사진 자리
  drawPixelRectWithBlackOutline(ctx, -2 * P, 0, 2, 2, P, isHit ? '#ffffff' : CYBER_PALETTE.darkBg);
  // 텍스트 라인
  drawPixelRectWithBlackOutline(ctx, 1 * P, 0, 2, 1, P, isHit ? '#ffffff' : '#ffffff');
  drawPixelRectWithBlackOutline(ctx, 1 * P, 1 * P, 2, 1, P, isHit ? '#ffffff' : '#ffffff');

  // v8.0: 유령 눈 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, -2 * P, -3 * P, 0, P, isHit ? '#ffffff' : CYBER_PALETTE.darkBg);
  drawPixelCircleWithBlackOutline(ctx, 2 * P, -3 * P, 0, P, isHit ? '#ffffff' : CYBER_PALETTE.darkBg);

  ctx.globalAlpha = 1;
  ctx.restore();
}

// =====================================================
// STAGE 14: AI Factory (AI 공장) - Industrial Theme
// =====================================================

export function drawPixelAssemblyArm(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const swing = Math.sin(t / 400) * 0.3;

  ctx.save();

  // v8.0: 베이스 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, 4 * P, 3, P, isHit ? '#ffffff' : CYBER_PALETTE.metal);

  // v8.0: 하단 암 - 검은 아웃라인
  ctx.save();
  ctx.rotate(swing);
  drawBlackOutlineRect(ctx, -2 * P - P, -4 * P - P, 4 + 1, 8 + 1, P);
  drawPixelRect(ctx, -2 * P, -4 * P, 4, 8, P, isHit ? '#ffffff' : CYBER_PALETTE.brightYellow);

  // v8.0: 엘보우 조인트 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, -4 * P, 2, P, isHit ? '#ffffff' : CYBER_PALETTE.metal);

  // v8.0: 상단 암 - 검은 아웃라인
  ctx.save();
  ctx.translate(0, -4 * P);
  ctx.rotate(-swing * 2);
  drawBlackOutlineRect(ctx, -1 * P - P, -6 * P - P, 2 + 1, 6 + 1, P);
  drawPixelRect(ctx, -1 * P, -6 * P, 2, 6, P, isHit ? '#ffffff' : CYBER_PALETTE.brightYellow);

  // v8.0: 집게 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -2 * P - P, -8 * P - P, 4 + 1, 2 + 1, P);
  drawPixelRect(ctx, -2 * P, -8 * P, 4, 2, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);
  // 집게 발톱
  drawPixelRectWithBlackOutline(ctx, -3 * P, -9 * P, 2, 2, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);
  drawPixelRectWithBlackOutline(ctx, 1 * P, -9 * P, 2, 2, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);

  ctx.restore();
  ctx.restore();

  // v8.0: 경고 스트라이프 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, -2 * P, 5 * P, 0, P, isHit ? '#ffffff' : CYBER_PALETTE.brightOrange);
  drawPixelCircleWithBlackOutline(ctx, 2 * P, 5 * P, 0, P, isHit ? '#ffffff' : CYBER_PALETTE.brightOrange);

  ctx.restore();
}

export function drawPixelConveyorBot(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const roll = (t / 100) % 12;

  ctx.save();

  // v8.0: 본체 섀시 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -6 * P - P, -3 * P - P, 12 + 1, 6 + 1, P);
  drawPixelRect(ctx, -6 * P, -3 * P, 12, 6, P, isHit ? '#ffffff' : CYBER_PALETTE.metal);

  // v8.0: 컨베이어 벨트 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -7 * P - P, 3 * P - P, 14 + 1, 2 + 1, P);
  drawPixelRect(ctx, -7 * P, 3 * P, 14, 2, P, isHit ? '#ffffff' : CYBER_PALETTE.darkBg);

  // v8.0: 롤링 도트 - 검은 아웃라인
  for (let i = 0; i < 4; i++) {
    const px = -6 * P + ((roll + i * 4) % 12) * P;
    drawPixelCircleWithBlackOutline(ctx, px, 4 * P, 0, P, isHit ? '#ffffff' : CYBER_PALETTE.brightOrange);
  }

  // v8.0: 바퀴 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, -5 * P, 5 * P, 2, P, isHit ? '#ffffff' : CYBER_PALETTE.metal);
  drawPixelCircleWithBlackOutline(ctx, 5 * P, 5 * P, 2, P, isHit ? '#ffffff' : CYBER_PALETTE.metal);

  // v8.0: 센서 눈 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, -1 * P, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);

  // v8.0: 운반 중인 박스 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -2 * P - P, -6 * P - P, 4 + 1, 3 + 1, P);
  drawPixelRect(ctx, -2 * P, -6 * P, 4, 3, P, isHit ? '#ffffff' : CYBER_PALETTE.brightCyan);

  ctx.restore();
}

export function drawPixelQcScanner(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const scan = Math.sin(t / 200) * 3 * P;

  ctx.save();

  // v8.0: 스캐너 본체 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -5 * P - P, -4 * P - P, 10 + 1, 8 + 1, P);
  drawPixelRect(ctx, -5 * P, -4 * P, 10, 8, P, isHit ? '#ffffff' : CYBER_PALETTE.metal);

  // v8.0: 스캐너 스크린 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -4 * P - P, -3 * P - P, 8 + 1, 5 + 1, P);
  drawPixelRect(ctx, -4 * P, -3 * P, 8, 5, P, isHit ? '#ffffff' : CYBER_PALETTE.darkBg);

  // v8.0: 스캔 레이저 라인 - 검은 아웃라인
  const scanY = scan;
  drawBlackOutlineRect(ctx, -4 * P - P, scanY - P, 8 + 1, 1 + 1, P);
  drawPixelRect(ctx, -4 * P, scanY, 8, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);

  // v8.0: 스크린 그리드 - 검은 아웃라인
  for (let y = 0; y < 2; y++) {
    for (let x = 0; x < 3; x++) {
      const px = -3 * P + x * 2 * P;
      const py = -2 * P + y * 2 * P;
      drawPixelCircleWithBlackOutline(ctx, px, py, 0, P, isHit ? '#ffffff' : CYBER_PALETTE.matrixDim);
    }
  }

  // v8.0: 상태 LED - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, -3 * P, 3 * P, 0, P, isHit ? '#ffffff' : CYBER_PALETTE.acidGreen);
  drawPixelCircleWithBlackOutline(ctx, 0, 3 * P, 0, P, isHit ? '#ffffff' : CYBER_PALETTE.brightYellow);
  drawPixelCircleWithBlackOutline(ctx, 3 * P, 3 * P, 0, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);

  ctx.restore();
}

export function drawPixelDefectUnit(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const glitch = Math.random() > 0.8;

  ctx.save();

  // v8.0: 손상된 로봇 바디 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -4 * P - P, -4 * P - P, 8 + 1, 9 + 1, P);
  drawPixelRect(ctx, -4 * P, -4 * P, 8, 9, P, isHit ? '#ffffff' : '#1f2937');

  // v8.0: 균열/손상 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -2 * P, -2 * P, 1, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);
  drawPixelRectWithBlackOutline(ctx, -1 * P, -1 * P, 1, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);
  drawPixelRectWithBlackOutline(ctx, 2 * P, 1 * P, 1, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);
  drawPixelRectWithBlackOutline(ctx, 3 * P, 2 * P, 1, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);

  // v8.0: 고장난 눈 (깜빡임) - 검은 아웃라인
  if (!glitch) {
    drawPixelCircleWithBlackOutline(ctx, -2 * P, -3 * P, 0, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);
  }
  drawPixelCircleWithBlackOutline(ctx, 2 * P, -3 * P, 0, P, isHit ? '#ffffff' : CYBER_PALETTE.matrixDim);

  // v8.0: 스파크 - 검은 아웃라인
  if (glitch) {
    const sx = Math.floor(-1 + Math.random() * 2) * P;
    const sy = Math.floor(-1 + Math.random() * 2) * P;
    drawPixelCircleWithBlackOutline(ctx, sx, sy, 0, P, isHit ? '#ffffff' : CYBER_PALETTE.brightYellow);
  }

  // v8.0: ERROR 라벨 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -3 * P - P, 2 * P - P, 6 + 1, 2 + 1, P);
  drawPixelRect(ctx, -3 * P, 2 * P, 6, 2, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);

  ctx.restore();
}

export function drawPixelForgeSpark(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();

  ctx.save();

  // v8.0: 불꽃 코어 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 2, P, isHit ? '#ffffff' : CYBER_PALETTE.brightOrange);

  // v8.0: 불꽃 스파크 - 검은 아웃라인
  for (let i = 0; i < 6; i++) {
    const angle = (t / 200 + i * Math.PI / 3) % (Math.PI * 2);
    const dist = 3 * P + Math.sin(t / 100 + i) * 2 * P;
    const px = Math.cos(angle) * dist;
    const py = Math.sin(angle) * dist;

    drawPixelCircleWithBlackOutline(ctx, px, py, 0, P, isHit ? '#ffffff' : CYBER_PALETTE.brightYellow);

    // 트레일
    const tx = Math.cos(angle) * (dist - P);
    const ty = Math.sin(angle) * (dist - P);
    drawPixelCircleWithBlackOutline(ctx, tx, ty, 0, P, isHit ? '#ffffff' : CYBER_PALETTE.brightOrange);
  }

  // v8.0: 내부 글로우 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 3, P, isHit ? '#ffffff' : '#fef08a');

  ctx.restore();
}

// =====================================================
// STAGE 15: Factory Core (공장 코어) - Power Theme
// =====================================================

export function drawPixelCoreDrone(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const hover = Math.sin(t / 300) * P;
  const propSpin = (t / 50) % 4;

  ctx.save();
  ctx.translate(0, hover);

  // v8.0: 드론 바디 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 4, P, isHit ? '#ffffff' : CYBER_PALETTE.brightCyan);
  drawBlackOutlineRect(ctx, -3 * P - P, -2 * P - P, 6 + 1, 4 + 1, P);
  drawPixelRect(ctx, -3 * P, -2 * P, 6, 4, P, isHit ? '#ffffff' : CYBER_PALETTE.brightCyan);

  // v8.0: 프로펠러 (4개 코너) - 검은 아웃라인
  const propPos = [
    { x: -5 * P, y: -3 * P },
    { x: 5 * P, y: -3 * P },
    { x: -5 * P, y: 3 * P },
    { x: 5 * P, y: 3 * P },
  ];

  for (const pos of propPos) {
    drawPixelCircleWithBlackOutline(ctx, pos.x, pos.y, 2, P, isHit ? '#ffffff' : CYBER_PALETTE.metal);
    // 회전 블러
    if (propSpin < 2) {
      drawPixelRectWithBlackOutline(ctx, pos.x - 2 * P, pos.y, 4, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.lightGray);
    } else {
      drawPixelRectWithBlackOutline(ctx, pos.x, pos.y - 2 * P, 1, 4, P, isHit ? '#ffffff' : CYBER_PALETTE.lightGray);
    }
  }

  // v8.0: 카메라 눈 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);

  ctx.restore();
}

export function drawPixelPowerCell(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const charge = (Math.sin(t / 500) + 1) / 2;

  ctx.save();

  // v8.0: 외부 셸 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -4 * P - P, -6 * P - P, 8 + 1, 12 + 1, P);
  drawPixelRect(ctx, -4 * P, -6 * P, 8, 12, P, isHit ? '#ffffff' : CYBER_PALETTE.metal);

  // v8.0: 에너지 레벨 (애니메이션) - 검은 아웃라인
  const fillHeight = Math.floor(10 * charge);
  if (fillHeight > 0) {
    drawBlackOutlineRect(ctx, -3 * P - P, (5 - fillHeight) * P - P, 6 + 1, fillHeight + 1, P);
    drawPixelRect(ctx, -3 * P, (5 - fillHeight) * P, 6, fillHeight, P, isHit ? '#ffffff' : CYBER_PALETTE.acidGreen);
  }

  // v8.0: 터미널 캡 (+극) - 검은 아웃라인
  drawBlackOutlineRect(ctx, -2 * P - P, -7 * P - P, 4 + 1, 2 + 1, P);
  drawPixelRect(ctx, -2 * P, -7 * P, 4, 2, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);

  // v8.0: 터미널 캡 (-극) - 검은 아웃라인
  drawBlackOutlineRect(ctx, -2 * P - P, 5 * P - P, 4 + 1, 2 + 1, P);
  drawPixelRect(ctx, -2 * P, 5 * P, 4, 2, P, isHit ? '#ffffff' : CYBER_PALETTE.brightCyan);

  // v8.0: + 심볼 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -1 * P, -7 * P, 2, 1, P, isHit ? '#ffffff' : '#ffffff');
  drawPixelRectWithBlackOutline(ctx, 0, -8 * P, 1, 1, P, isHit ? '#ffffff' : '#ffffff');
  drawPixelRectWithBlackOutline(ctx, 0, -6 * P, 1, 1, P, isHit ? '#ffffff' : '#ffffff');

  // v8.0: - 심볼 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -1 * P, 6 * P, 2, 1, P, isHit ? '#ffffff' : '#ffffff');

  // v8.0: 에너지 펄스 라인 - 검은 아웃라인
  if (charge > 0.5) {
    drawPixelCircleWithBlackOutline(ctx, 0, -3 * P, 0, P, isHit ? '#ffffff' : '#ffffff');
    drawPixelCircleWithBlackOutline(ctx, 0, 0, 0, P, isHit ? '#ffffff' : '#ffffff');
    drawPixelCircleWithBlackOutline(ctx, 0, 3 * P, 0, P, isHit ? '#ffffff' : '#ffffff');
  }

  ctx.restore();
}

export function drawPixelCoolingFan(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const spin = (t / 30) % (Math.PI * 2);

  ctx.save();

  // v8.0: 프레임 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 6, P, isHit ? '#ffffff' : CYBER_PALETTE.metal);

  // v8.0: 팬 블레이드 (회전) - 검은 아웃라인
  ctx.save();
  ctx.rotate(spin);
  for (let i = 0; i < 5; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI * 2) / 5);
    drawBlackOutlineRect(ctx, -1 * P - P, -5 * P - P, 2 + 1, 4 + 1, P);
    drawPixelRect(ctx, -1 * P, -5 * P, 2, 4, P, isHit ? '#ffffff' : CYBER_PALETTE.lightGray);
    ctx.restore();
  }
  ctx.restore();

  // v8.0: 중앙 허브 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 2, P, isHit ? '#ffffff' : CYBER_PALETTE.darkBg);
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.metal);

  // v8.0: 공기 흐름 표시 - 검은 아웃라인
  const airY = (t / 100) % 4;
  drawPixelCircleWithBlackOutline(ctx, -3 * P, (6 + airY) * P, 0, P, isHit ? '#ffffff' : CYBER_PALETTE.brightCyan);
  drawPixelCircleWithBlackOutline(ctx, 0, (7 + airY) * P, 0, P, isHit ? '#ffffff' : CYBER_PALETTE.brightCyan);
  drawPixelCircleWithBlackOutline(ctx, 3 * P, (6 + airY) * P, 0, P, isHit ? '#ffffff' : CYBER_PALETTE.brightCyan);

  ctx.restore();
}

export function drawPixelCircuitBug(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const scurry = Math.sin(t / 80) * P;

  ctx.save();
  ctx.translate(scurry, 0);

  // v8.0: 벌레 머리 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, -2 * P, 0, 2, P, isHit ? '#ffffff' : CYBER_PALETTE.brightYellow);

  // v8.0: 벌레 몸통 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 1 * P, 0, 3, P, isHit ? '#ffffff' : CYBER_PALETTE.brightOrange);

  // v8.0: 벌레 꼬리 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 4 * P, 0, 2, P, isHit ? '#ffffff' : CYBER_PALETTE.brightYellow);

  // v8.0: 6개 다리 - 검은 아웃라인
  for (let i = 0; i < 3; i++) {
    const legOff = (i % 2 === 0) ? scurry : -scurry;
    const legX = -3 * P + i * 2 * P;
    // 위쪽 다리
    drawBlackOutlineRect(ctx, legX - P, -3 * P + legOff - P, 1 + 1, 2 + 1, P);
    drawPixelRect(ctx, legX, -3 * P + legOff, 1, 2, P, isHit ? '#ffffff' : CYBER_PALETTE.metal);
    // 아래쪽 다리
    drawBlackOutlineRect(ctx, legX - P, 1 * P - legOff - P, 1 + 1, 2 + 1, P);
    drawPixelRect(ctx, legX, 1 * P - legOff, 1, 2, P, isHit ? '#ffffff' : CYBER_PALETTE.metal);
  }

  // v8.0: 더듬이 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -3 * P, -2 * P, 1, 2, P, isHit ? '#ffffff' : CYBER_PALETTE.metal);
  drawPixelRectWithBlackOutline(ctx, -4 * P, -3 * P, 1, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.metal);
  drawPixelRectWithBlackOutline(ctx, -2 * P, -2 * P, 1, 2, P, isHit ? '#ffffff' : CYBER_PALETTE.metal);
  drawPixelRectWithBlackOutline(ctx, -1 * P, -3 * P, 1, 1, P, isHit ? '#ffffff' : CYBER_PALETTE.metal);

  // v8.0: 눈 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, -3 * P, -1 * P, 0, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);
  drawPixelCircleWithBlackOutline(ctx, -1 * P, -1 * P, 0, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);

  // v8.0: 등의 회로 패턴 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 1 * P, -1 * P, 0, P, isHit ? '#ffffff' : CYBER_PALETTE.matrixDim);
  drawPixelCircleWithBlackOutline(ctx, 2 * P, 0, 0, P, isHit ? '#ffffff' : CYBER_PALETTE.matrixDim);
  drawPixelCircleWithBlackOutline(ctx, 1 * P, 1 * P, 0, P, isHit ? '#ffffff' : CYBER_PALETTE.matrixDim);

  ctx.restore();
}

export function drawPixelSteamVent(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const burst = Math.sin(t / 500) > 0.3;

  ctx.save();

  // v8.0: 파이프 바디 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -3 * P - P, -2 * P - P, 6 + 1, 9 + 1, P);
  drawPixelRect(ctx, -3 * P, -2 * P, 6, 9, P, isHit ? '#ffffff' : CYBER_PALETTE.metal);

  // v8.0: 통풍구 그레이트 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -4 * P - P, -4 * P - P, 8 + 1, 3 + 1, P);
  drawPixelRect(ctx, -4 * P, -4 * P, 8, 3, P, isHit ? '#ffffff' : CYBER_PALETTE.lightGray);
  // 그레이트 구멍
  drawPixelRectWithBlackOutline(ctx, -3 * P, -4 * P, 1, 2, P, isHit ? '#ffffff' : CYBER_PALETTE.darkBg);
  drawPixelRectWithBlackOutline(ctx, -1 * P, -4 * P, 1, 2, P, isHit ? '#ffffff' : CYBER_PALETTE.darkBg);
  drawPixelRectWithBlackOutline(ctx, 1 * P, -4 * P, 1, 2, P, isHit ? '#ffffff' : CYBER_PALETTE.darkBg);
  drawPixelRectWithBlackOutline(ctx, 3 * P, -4 * P, 1, 2, P, isHit ? '#ffffff' : CYBER_PALETTE.darkBg);

  // v8.0: 스팀 분출 - 검은 아웃라인
  if (burst) {
    const steamY = -6 * P - ((t / 50) % 5) * P;
    drawPixelCircleWithBlackOutline(ctx, -1 * P, steamY, 2, P, isHit ? '#ffffff' : '#f5f5f4');
    drawPixelCircleWithBlackOutline(ctx, 2 * P, steamY - 2 * P, 2, P, isHit ? '#ffffff' : '#f5f5f4');
    drawPixelCircleWithBlackOutline(ctx, 0, steamY - 4 * P, 3, P, isHit ? '#ffffff' : '#f5f5f4');
  }

  // v8.0: 압력 게이지 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, 3 * P, 2, P, isHit ? '#ffffff' : CYBER_PALETTE.lightGray);
  // 바늘
  const needleAngle = burst ? 0.5 : -0.5;
  const nx = Math.cos(needleAngle) * P;
  const ny = 3 * P + Math.sin(needleAngle) * P;
  drawPixelCircleWithBlackOutline(ctx, nx, ny, 0, P, isHit ? '#ffffff' : CYBER_PALETTE.brightRed);

  ctx.restore();
}
