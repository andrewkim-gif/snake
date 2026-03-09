/**
 * game/rendering/enemies/pixelChapter3.ts - Chapter 3 Pixel Art Monsters (Stage 21-25)
 * v6.0: Cyberpunk pixel art style - digital world/AI theme
 *
 * Stage 21 (Sea of Code): syntax_fish, bracket_crab, comment_jellyfish, variable_eel, function_whale
 * Stage 22 (Memory Palace): heap_pile, stack_tower, pointer_arrow, garbage_collector, memory_fragment
 * Stage 23 (CPU Core): clock_cycle, instruction_fetch, branch_predictor, pipeline_stall, thermal_spike
 * Stage 24 (Neural Network): neuron_node, synapse_spark, weight_adjuster, bias_blob, activation_wave
 * Stage 25 (Learning Center): training_data, loss_function, gradient_flow, overfitting, epoch_counter
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
// STAGE 21: Sea of Code (코드의 바다) - Code Creature Theme
// =====================================================

export function drawPixelSyntaxFish(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const swim = Math.sin(t / 200) * P;

  ctx.save();
  ctx.translate(0, swim);

  const bodyColor = isHit ? '#ffffff' : CYBER_PALETTE.brightCyan;
  const finColor = isHit ? '#ffffff' : CYBER_PALETTE.acidGreen;

  // v8.0: 물고기 몸통 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -4 * P - P, -2 * P - P, 10 + 1, 5 + 1, P);
  drawPixelRect(ctx, -4 * P, -2 * P, 10, 5, P, bodyColor);

  // v8.0: 꼬리 지느러미 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, 5 * P, -2 * P, 2, 4, P, finColor);

  // v8.0: 등 지느러미 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -1 * P, -4 * P, 3, 2, P, finColor);

  // v8.0: 눈 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, -2 * P, -1 * P, 1, P, '#ffffff');
  drawPixel(ctx, -2 * P, -1 * P, P, '#000000');

  // v8.0: { } 구문 패턴
  drawPixel(ctx, 1 * P, -1 * P, P, CYBER_PALETTE.acidGreen);
  drawPixel(ctx, 2 * P, 0, P, CYBER_PALETTE.acidGreen);

  ctx.restore();
}

export function drawPixelBracketCrab(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const scuttle = Math.floor((t / 100) % 2);

  ctx.save();

  const shellColor = isHit ? '#ffffff' : CYBER_PALETTE.brightOrange;
  const clawColor = isHit ? '#ffffff' : CYBER_PALETTE.brightRed;
  const legColor = isHit ? '#ffffff' : '#f97316';

  // v8.0: 껍질 몸통 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -5 * P - P, -2 * P - P, 10 + 1, 5 + 1, P);
  drawPixelRect(ctx, -5 * P, -2 * P, 10, 5, P, shellColor);

  // v8.0: 눈 줄기 + 눈 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -3 * P, -5 * P, 1, 3, P, shellColor);
  drawPixelRectWithBlackOutline(ctx, 2 * P, -5 * P, 1, 3, P, shellColor);
  drawPixelCircleWithBlackOutline(ctx, -3 * P, -6 * P, 1, P, '#ffffff');
  drawPixelCircleWithBlackOutline(ctx, 2 * P, -6 * P, 1, P, '#ffffff');
  drawPixel(ctx, -3 * P, -6 * P, P, '#000000');
  drawPixel(ctx, 2 * P, -6 * P, P, '#000000');

  // v8.0: 집게 [ ] - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -8 * P, -2 * P, 2, 4, P, clawColor);
  drawPixelRectWithBlackOutline(ctx, 6 * P, -2 * P, 2, 4, P, clawColor);

  // v8.0: 다리 - 검은 아웃라인 + 애니메이션
  for (let i = 0; i < 3; i++) {
    const legOff = (i % 2 === scuttle) ? P : 0;
    drawPixelRectWithBlackOutline(ctx, (-4 + i * 2) * P, 3 * P + legOff, 1, 2, P, legColor);
    drawPixelRectWithBlackOutline(ctx, (1 + i * 2) * P, 3 * P - legOff + P, 1, 2, P, legColor);
  }

  ctx.restore();
}

export function drawPixelCommentJellyfish(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const pulse = Math.sin(t / 400) * P;

  ctx.save();
  ctx.translate(0, pulse);

  const bellColor = isHit ? '#ffffff' : CYBER_PALETTE.acidGreen;
  const tentColor = isHit ? '#ffffff' : '#86efac';

  ctx.globalAlpha = 0.9;

  // v8.0: 종 (머리) - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, -2 * P, 4, P, bellColor);

  // v8.0: 종 하단 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -4 * P - P, -1 * P - P, 8 + 1, 3 + 1, P);
  drawPixelRect(ctx, -4 * P, -1 * P, 8, 3, P, bellColor);

  // v8.0: 촉수 - 검은 아웃라인
  const tentLen = 3 + Math.floor((t / 150) % 2);
  for (let i = -2; i <= 2; i += 2) {
    drawPixelRectWithBlackOutline(ctx, i * P, 2 * P, 1, tentLen, P, tentColor);
  }

  // v8.0: /* */ 주석 패턴
  drawPixel(ctx, -2 * P, -3 * P, P, '#ffffff');
  drawPixel(ctx, 2 * P, -3 * P, P, '#ffffff');

  ctx.globalAlpha = 1;
  ctx.restore();
}

export function drawPixelVariableEel(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const wavePhase = Math.floor((t / 100) % 3);

  ctx.save();

  const bodyColor = isHit ? '#ffffff' : CYBER_PALETTE.brightCyan;
  const stripeColor = isHit ? '#ffffff' : CYBER_PALETTE.neonPink;

  // v8.0: 뱀장어 몸통 (굴곡) - 검은 아웃라인
  for (let i = 0; i < 6; i++) {
    const waveY = (i + wavePhase) % 2 === 0 ? -P : P;
    drawPixelRectWithBlackOutline(ctx, -6 * P + i * 2 * P, waveY, 2, 2, P, bodyColor);

    // 변수 패턴 줄무늬
    if (i % 2 === 0) {
      drawPixel(ctx, -6 * P + i * 2 * P, waveY - P, P, stripeColor);
    }
  }

  // v8.0: 머리 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, -6 * P, 0, 2, P, bodyColor);

  // v8.0: 눈
  drawPixel(ctx, -7 * P, -P, P, '#ffffff');
  drawPixel(ctx, -7 * P, -P, P, CYBER_PALETTE.brightRed);

  // v8.0: = 기호 (꼬리 근처)
  drawPixel(ctx, 5 * P, -P, P, CYBER_PALETTE.acidGreen);
  drawPixel(ctx, 5 * P, P, P, CYBER_PALETTE.acidGreen);

  ctx.restore();
}

export function drawPixelFunctionWhale(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const breathe = Math.sin(t / 400) > 0;

  ctx.save();

  const bodyColor = isHit ? '#ffffff' : '#334155';
  const bellyColor = isHit ? '#ffffff' : '#64748b';
  const spotColor = isHit ? '#ffffff' : CYBER_PALETTE.brightCyan;

  // v8.0: 고래 몸통 (큰) - 검은 아웃라인
  drawBlackOutlineRect(ctx, -8 * P - P, -4 * P - P, 16 + 1, 8 + 1, P);
  drawPixelRect(ctx, -8 * P, -4 * P, 16, 8, P, bodyColor);

  // v8.0: 배 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -7 * P, 1 * P, 12, 3, P, bellyColor);

  // v8.0: 꼬리 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, 6 * P, -2 * P, 3, 4, P, bodyColor);
  drawPixelRectWithBlackOutline(ctx, 8 * P, -4 * P, 2, 2, P, bodyColor);
  drawPixelRectWithBlackOutline(ctx, 8 * P, 2 * P, 2, 2, P, bodyColor);

  // v8.0: 눈 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, -6 * P, -2 * P, 1, P, '#ffffff');
  drawPixel(ctx, -6 * P, -2 * P, P, '#000000');

  // v8.0: function() {} 패턴 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -3 * P, -2 * P, 5, 1, P, spotColor);

  // v8.0: 분수 (호흡) - 검은 아웃라인
  if (breathe) {
    drawPixelRectWithBlackOutline(ctx, -4 * P, -6 * P, 1, 2, P, CYBER_PALETTE.brightCyan);
    drawPixelRectWithBlackOutline(ctx, -3 * P, -7 * P, 1, 1, P, CYBER_PALETTE.brightCyan);
  }

  ctx.restore();
}

// =====================================================
// STAGE 22: Memory Palace (메모리 궁전) - Memory Theme
// =====================================================

export function drawPixelHeapPile(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const wobble = Math.floor((t / 200) % 2);

  ctx.save();

  const color1 = isHit ? '#ffffff' : CYBER_PALETTE.neonPink;
  const color2 = isHit ? '#ffffff' : '#c084fc';
  const color3 = isHit ? '#ffffff' : '#e879f9';

  // v8.0: 힙 블록 스택 - 검은 아웃라인
  // 하단 레이어 (3개)
  drawPixelRectWithBlackOutline(ctx, -6 * P + wobble * P, 2 * P, 4, 4, P, color1);
  drawPixelRectWithBlackOutline(ctx, -1 * P, 2 * P, 4, 4, P, color2);
  drawPixelRectWithBlackOutline(ctx, 4 * P - wobble * P, 2 * P, 4, 4, P, color1);

  // 중간 레이어 (2개)
  drawPixelRectWithBlackOutline(ctx, -4 * P, -2 * P, 4, 4, P, color3);
  drawPixelRectWithBlackOutline(ctx, 1 * P, -2 * P, 4, 4, P, color2);

  // 상단 (1개)
  drawPixelRectWithBlackOutline(ctx, -2 * P, -5 * P, 4, 3, P, color1);

  // v8.0: 메모리 주소 표시
  drawPixel(ctx, -5 * P, 4 * P, P, CYBER_PALETTE.acidGreen);
  drawPixel(ctx, 0, 4 * P, P, CYBER_PALETTE.acidGreen);
  drawPixel(ctx, 5 * P, 4 * P, P, CYBER_PALETTE.acidGreen);

  ctx.restore();
}

export function drawPixelStackTower(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const push = Math.floor((t / 400) % 4);

  ctx.save();

  const frameColor = isHit ? '#ffffff' : CYBER_PALETTE.neonPink;
  const blockColor = isHit ? '#ffffff' : '#c084fc';
  const activeColor = isHit ? '#ffffff' : CYBER_PALETTE.acidGreen;

  // v8.0: 스택 프레임 외곽 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -5 * P - P, -7 * P - P, 10 + 1, 14 + 1, P);
  drawPixelRect(ctx, -5 * P, -7 * P, 10, 14, P, CYBER_PALETTE.darkBg);

  // v8.0: 상단/하단 테두리 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -6 * P, -8 * P, 12, 1, P, frameColor);
  drawPixelRectWithBlackOutline(ctx, -6 * P, 6 * P, 12, 1, P, frameColor);

  // v8.0: 스택 요소들 - 검은 아웃라인
  for (let i = 0; i < 4; i++) {
    if (i <= push) {
      const isTop = i === push;
      const yPos = 4 * P - i * 3 * P;
      drawPixelRectWithBlackOutline(ctx, -4 * P, yPos, 8, 2, P, isTop ? activeColor : blockColor);
    }
  }

  // v8.0: 스택 포인터 (SP) - 검은 아웃라인
  const spY = 4 * P - push * 3 * P;
  drawPixelRectWithBlackOutline(ctx, -7 * P, spY, 2, 1, P, CYBER_PALETTE.brightRed);

  ctx.restore();
}

export function drawPixelPointerArrow(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const point = Math.floor((t / 150) % 3);

  ctx.save();

  const arrowColor = isHit ? '#ffffff' : CYBER_PALETTE.brightRed;
  const shaftColor = isHit ? '#ffffff' : '#71717a';
  const targetColor = isHit ? '#ffffff' : CYBER_PALETTE.acidGreen;

  // v8.0: 화살표 샤프트 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -6 * P, -1 * P, 8, 2, P, shaftColor);

  // v8.0: 화살표 헤드 - 검은 아웃라인
  const headX = 2 * P + point * P;
  drawPixelRectWithBlackOutline(ctx, headX, -2 * P, 2, 4, P, arrowColor);
  drawPixelRectWithBlackOutline(ctx, headX + 2 * P, -1 * P, 1, 2, P, arrowColor);

  // v8.0: 타겟 주소 블록 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, 6 * P + point * P, -2 * P, 4, 4, P, targetColor);

  // v8.0: * 기호 (포인터)
  drawPixel(ctx, -8 * P, -2 * P, P, '#ffffff');
  drawPixel(ctx, -7 * P, -1 * P, P, '#ffffff');
  drawPixel(ctx, -8 * P, 0, P, '#ffffff');

  ctx.restore();
}

export function drawPixelGarbageCollector(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const munch = Math.floor((t / 150) % 2);

  ctx.save();

  const bodyColor = isHit ? '#ffffff' : '#52525b';
  const mouthColor = isHit ? '#ffffff' : CYBER_PALETTE.brightRed;
  const trashColor = isHit ? '#ffffff' : '#86efac';

  // v8.0: 몸통 (압축기) - 검은 아웃라인
  drawBlackOutlineRect(ctx, -6 * P - P, -4 * P - P, 12 + 1, 10 + 1, P);
  drawPixelRect(ctx, -6 * P, -4 * P, 12, 10, P, bodyColor);

  // v8.0: 입 (열린 부분) - 검은 아웃라인
  const mouthH = 3 + munch;
  drawPixelRectWithBlackOutline(ctx, -5 * P, -3 * P, 10, mouthH, P, mouthColor);
  drawPixelRect(ctx, -4 * P, -2 * P, 8, mouthH - 1, P, CYBER_PALETTE.darkBg);

  // v8.0: 이빨
  for (let i = 0; i < 3; i++) {
    drawPixelRectWithBlackOutline(ctx, -3 * P + i * 2 * P, -2 * P, 1, 1, P, '#ffffff');
    drawPixelRectWithBlackOutline(ctx, -3 * P + i * 2 * P, -2 * P + mouthH - 1, 1, 1, P, '#ffffff');
  }

  // v8.0: 바퀴 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, -4 * P, 6 * P, 2, P, '#71717a');
  drawPixelCircleWithBlackOutline(ctx, 4 * P, 6 * P, 2, P, '#71717a');

  // v8.0: GC 라벨 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -2 * P, 3 * P, 4, 2, P, CYBER_PALETTE.acidGreen);

  ctx.restore();
}

export function drawPixelMemoryFragment(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const float = Math.sin(t / 400) * 2;
  const rotate = (t / 1500) % (Math.PI * 2);

  ctx.save();
  ctx.translate(0, float);
  ctx.rotate(rotate * 0.15);

  const fragColor = isHit ? '#ffffff' : CYBER_PALETTE.brightYellow;
  const dataColor = isHit ? '#ffffff' : CYBER_PALETTE.acidGreen;
  const edgeColor = isHit ? '#ffffff' : CYBER_PALETTE.brightOrange;

  // v8.0: 메인 파편 몸체 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -5 * P - P, -3 * P - P, 10 + 1, 6 + 1, P);
  drawPixelRect(ctx, -5 * P, -3 * P, 10, 6, P, fragColor);

  // v8.0: 상단 돌출 부분 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -3 * P - P, -5 * P - P, 6 + 1, 2 + 1, P);
  drawPixelRect(ctx, -3 * P, -5 * P, 6, 2, P, fragColor);

  // v8.0: 하단 돌출 부분 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -2 * P - P, 3 * P - P, 4 + 1, 3 + 1, P);
  drawPixelRect(ctx, -2 * P, 3 * P, 4, 3, P, fragColor);

  // v8.0: 깨진 가장자리 (메모리 단편화) - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, 5 * P, -1 * P, 2, 2, P, edgeColor);
  drawPixelRectWithBlackOutline(ctx, -7 * P, 0, 2, 2, P, edgeColor);

  // v8.0: 데이터 비트 표시 - 검은 아웃라인
  const bitTime = Math.floor(t / 200);
  for (let i = 0; i < 4; i++) {
    const bit = (bitTime + i) % 2 === 0;
    const bitColor = bit ? dataColor : '#374151';
    drawPixelRectWithBlackOutline(ctx, -3 * P + i * 2 * P, -1 * P, 1, 2, P, bitColor);
  }

  // v8.0: 메모리 주소 표시 (상단) - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -1 * P, -7 * P, 2, 1, P, CYBER_PALETTE.brightRed);

  // v8.0: 회로 패턴
  drawPixel(ctx, -4 * P, -2 * P, P, '#6b7280');
  drawPixel(ctx, 3 * P, -2 * P, P, '#6b7280');
  drawPixel(ctx, -4 * P, 1 * P, P, '#6b7280');
  drawPixel(ctx, 3 * P, 1 * P, P, '#6b7280');

  ctx.restore();
}

// =====================================================
// STAGE 23: CPU Core (CPU 코어) - Processor Theme
// =====================================================

export function drawPixelClockCycle(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const tick = (t / 100) % (Math.PI * 2);

  ctx.save();

  const faceColor = isHit ? '#ffffff' : CYBER_PALETTE.acidGreen;
  const handColor = isHit ? '#ffffff' : '#1f2937';
  const pulseColor = isHit ? '#ffffff' : CYBER_PALETTE.brightCyan;

  // v8.0: 시계 외곽 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 7, P, faceColor);
  drawPixelCircle(ctx, 0, 0, 5, P, '#1f2937');

  // v8.0: 시간 마커 (4개) - 검은 아웃라인
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI * 2) / 4;
    const x = Math.cos(angle) * 4 * P;
    const y = Math.sin(angle) * 4 * P;
    drawPixelRectWithBlackOutline(ctx, x - P, y - P, 1, 1, P, faceColor);
  }

  // v8.0: 분침 (긴 바늘) - 검은 아웃라인
  ctx.save();
  ctx.rotate(tick);
  drawBlackOutlineRect(ctx, -P - P, -4 * P - P, 1 + 1, 4 + 1, P);
  drawPixelRect(ctx, -P, -4 * P, 1, 4, P, handColor);
  ctx.restore();

  // v8.0: 초침 (짧은 바늘) - 검은 아웃라인
  ctx.save();
  ctx.rotate(tick * 12);
  drawBlackOutlineRect(ctx, -P - P, -3 * P - P, 1 + 1, 3 + 1, P);
  drawPixelRect(ctx, -P, -3 * P, 1, 3, P, CYBER_PALETTE.brightRed);
  ctx.restore();

  // v8.0: 중앙 허브 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 1, P, handColor);

  // v8.0: Hz 펄스 표시 - 외곽 링
  const pulseOn = Math.sin(tick * 4) > 0;
  if (pulseOn) {
    drawPixelCircleWithBlackOutline(ctx, 0, 0, 8, P, pulseColor);
  }

  ctx.restore();
}

export function drawPixelInstructionFetch(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const fetch = (t / 150) % 20;

  ctx.save();

  const pcColor = isHit ? '#ffffff' : CYBER_PALETTE.brightCyan;
  const memColor = isHit ? '#ffffff' : '#6b7280';
  const instColor = isHit ? '#ffffff' : CYBER_PALETTE.acidGreen;

  // v8.0: 프로그램 카운터 박스 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -10 * P - P, -4 * P - P, 6 + 1, 8 + 1, P);
  drawPixelRect(ctx, -10 * P, -4 * P, 6, 8, P, pcColor);
  // PC 라벨
  drawPixelRectWithBlackOutline(ctx, -9 * P, -2 * P, 2, 2, P, '#ffffff');
  drawPixelRectWithBlackOutline(ctx, -7 * P, -2 * P, 2, 2, P, '#ffffff');

  // v8.0: 메모리 유닛 - 검은 아웃라인
  drawBlackOutlineRect(ctx, 4 * P - P, -5 * P - P, 8 + 1, 10 + 1, P);
  drawPixelRect(ctx, 4 * P, -5 * P, 8, 10, P, memColor);

  // v8.0: 메모리 행들 - 검은 아웃라인
  for (let i = 0; i < 3; i++) {
    drawPixelRectWithBlackOutline(ctx, 5 * P, -4 * P + i * 3 * P, 6, 2, P, '#374151');
  }

  // v8.0: 페치 버스/화살표 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -4 * P - P, -1 * P - P, 8 + 1, 2 + 1, P);
  drawPixelRect(ctx, -4 * P, -1 * P, 8, 2, P, CYBER_PALETTE.brightYellow);

  // v8.0: 이동 중인 데이터 패킷 - 검은 아웃라인
  const dataX = -4 * P + Math.floor(fetch < 10 ? fetch : 20 - fetch) * P * 0.8;
  drawPixelRectWithBlackOutline(ctx, dataX, -1 * P, 2, 2, P, instColor);

  // v8.0: 페치된 명령어 - 검은 아웃라인
  if (fetch > 10) {
    drawPixelRectWithBlackOutline(ctx, -9 * P, 1 * P, 4, 2, P, instColor);
  }

  ctx.restore();
}

export function drawPixelBranchPredictor(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const predict = Math.sin(t / 500) > 0;

  ctx.save();

  const bodyColor = isHit ? '#ffffff' : CYBER_PALETTE.brightYellow;
  const yesColor = isHit ? '#ffffff' : CYBER_PALETTE.acidGreen;
  const noColor = isHit ? '#ffffff' : CYBER_PALETTE.brightRed;

  // v8.0: 메인 예측기 몸체 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -5 * P - P, -5 * P - P, 10 + 1, 10 + 1, P);
  drawPixelRect(ctx, -5 * P, -5 * P, 10, 10, P, bodyColor);

  // v8.0: 결정 다이아몬드 (내부) - 검은 아웃라인
  ctx.save();
  ctx.rotate(Math.PI / 4);
  drawBlackOutlineRect(ctx, -2 * P - P, -2 * P - P, 4 + 1, 4 + 1, P);
  drawPixelRect(ctx, -2 * P, -2 * P, 4, 4, P, '#374151');
  ctx.restore();

  // v8.0: ? 기호 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -1 * P, -2 * P, 2, 1, P, '#ffffff');
  drawPixelRectWithBlackOutline(ctx, 0, -1 * P, 1, 1, P, '#ffffff');
  drawPixelRectWithBlackOutline(ctx, 0, 1 * P, 1, 1, P, '#ffffff');

  // v8.0: Yes 브랜치 (예측 시 밝음) - 검은 아웃라인
  ctx.globalAlpha = predict ? 1 : 0.4;
  drawBlackOutlineRect(ctx, 6 * P - P, -1 * P - P, 5 + 1, 2 + 1, P);
  drawPixelRect(ctx, 6 * P, -1 * P, 5, 2, P, yesColor);
  // 화살표 머리
  drawPixelRectWithBlackOutline(ctx, 10 * P, -2 * P, 1, 1, P, yesColor);
  drawPixelRectWithBlackOutline(ctx, 10 * P, 1 * P, 1, 1, P, yesColor);
  ctx.globalAlpha = 1;

  // v8.0: No 브랜치 - 검은 아웃라인
  ctx.globalAlpha = predict ? 0.4 : 1;
  drawBlackOutlineRect(ctx, -11 * P - P, -1 * P - P, 5 + 1, 2 + 1, P);
  drawPixelRect(ctx, -11 * P, -1 * P, 5, 2, P, noColor);
  // 화살표 머리
  drawPixelRectWithBlackOutline(ctx, -11 * P, -2 * P, 1, 1, P, noColor);
  drawPixelRectWithBlackOutline(ctx, -11 * P, 1 * P, 1, 1, P, noColor);
  ctx.globalAlpha = 1;

  ctx.restore();
}

export function drawPixelPipelineStall(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const stall = Math.sin(t / 400) > 0.5;

  ctx.save();

  const pipeColor = isHit ? '#ffffff' : CYBER_PALETTE.brightRed;
  const stageColor = isHit ? '#ffffff' : CYBER_PALETTE.brightCyan;
  const bubbleColor = isHit ? '#ffffff' : '#d1d5db';

  // v8.0: 파이프라인 스테이지 (5단계) - 검은 아웃라인
  for (let i = 0; i < 5; i++) {
    const isStalled = stall && i >= 2;
    const stageX = -12 * P + i * 6 * P;
    const color = isStalled ? pipeColor : stageColor;

    // 스테이지 박스
    drawBlackOutlineRect(ctx, stageX - P, -4 * P - P, 5 + 1, 8 + 1, P);
    drawPixelRect(ctx, stageX, -4 * P, 5, 8, P, color);

    // 스테이지 라벨 (내부)
    const labelColor = isStalled ? bubbleColor : CYBER_PALETTE.acidGreen;
    drawPixelRectWithBlackOutline(ctx, stageX + P, -1 * P, 3, 2, P, labelColor);
  }

  // v8.0: 스톨 표시기 (버블) - 검은 아웃라인
  if (stall) {
    drawPixelCircleWithBlackOutline(ctx, 0, -6 * P, 2, P, bubbleColor);
    drawPixel(ctx, 0, -6 * P, P, CYBER_PALETTE.brightRed);

    // NOP 텍스트 박스
    drawPixelRectWithBlackOutline(ctx, -2 * P, 5 * P, 4, 2, P, pipeColor);
  }

  // v8.0: 스테이지 간 화살표 - 검은 아웃라인
  for (let i = 0; i < 4; i++) {
    const blocked = stall && i >= 1;
    ctx.globalAlpha = blocked ? 0.3 : 1;
    const arrowX = -9 * P + i * 6 * P;
    drawPixelRectWithBlackOutline(ctx, arrowX, -1 * P, 2, 2, P, CYBER_PALETTE.brightYellow);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

export function drawPixelThermalSpike(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const heat = (Math.sin(t / 100) + 1) / 2;

  ctx.save();

  const colors = [
    isHit ? '#ffffff' : CYBER_PALETTE.brightYellow,
    isHit ? '#ffffff' : CYBER_PALETTE.brightOrange,
    isHit ? '#ffffff' : '#ef4444',
    isHit ? '#ffffff' : CYBER_PALETTE.brightRed,
  ];

  const currentColor = colors[Math.floor(heat * 3.99)];

  // v8.0: 스파이크 몸체 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -3 * P - P, -7 * P - P, 6 + 1, 14 + 1, P);
  drawPixelRect(ctx, -3 * P, -7 * P, 6, 14, P, currentColor);

  // v8.0: 방열 열파 (좌우) - 검은 아웃라인
  for (let i = 0; i < 2; i++) {
    const waveOff = Math.floor((t / 100 + i * 4) % 8);
    ctx.globalAlpha = 1 - waveOff / 8;
    // 왼쪽 파
    drawPixelRectWithBlackOutline(ctx, -5 * P - waveOff * P, -5 * P, 1, 10, P, currentColor);
    // 오른쪽 파
    drawPixelRectWithBlackOutline(ctx, 4 * P + waveOff * P, -5 * P, 1, 10, P, currentColor);
    ctx.globalAlpha = 1;
  }

  // v8.0: 온도 게이지 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -4 * P - P, 5 * P - P, 8 + 1, 3 + 1, P);
  drawPixelRect(ctx, -4 * P, 5 * P, 8, 3, P, '#374151');
  const tempBars = Math.floor(heat * 4) + 1;
  for (let i = 0; i < tempBars; i++) {
    drawPixelRectWithBlackOutline(ctx, -3 * P + i * 2 * P, 6 * P, 1, 1, P, currentColor);
  }

  // v8.0: 경고 LED (고온 시) - 검은 아웃라인
  if (heat > 0.7) {
    drawPixelCircleWithBlackOutline(ctx, 0, -9 * P, 1, P, CYBER_PALETTE.brightRed);
  }

  ctx.restore();
}

// =====================================================
// STAGE 24: Neural Network (신경망) - AI Neuron Theme
// =====================================================

export function drawPixelNeuronNode(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const fire = Math.sin(t / 300) > 0.5;

  ctx.save();

  const bodyColor = isHit ? '#ffffff' : CYBER_PALETTE.neonPink;
  const activeColor = isHit ? '#ffffff' : CYBER_PALETTE.brightYellow;
  const dendColor = isHit ? '#ffffff' : '#c084fc';

  // v8.0: 세포체 (소마) - 검은 아웃라인
  const somaColor = fire ? activeColor : bodyColor;
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 6, P, somaColor);

  // v8.0: 핵 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 2, P, '#374151');

  // v8.0: 수상돌기 (입력, 3개) - 검은 아웃라인
  for (let i = 0; i < 3; i++) {
    const angle = -Math.PI / 2 + (i - 1) * 0.5;
    const dx = Math.cos(angle) * 8 * P;
    const dy = Math.sin(angle) * 8 * P;
    drawPixelRectWithBlackOutline(ctx, dx - P, dy - P, 2, 2, P, dendColor);
    // 연결선
    const mx = Math.cos(angle) * 5 * P;
    const my = Math.sin(angle) * 5 * P;
    drawPixelRectWithBlackOutline(ctx, mx, my, 1, 1, P, dendColor);
  }

  // v8.0: 축삭 (출력) - 검은 아웃라인
  drawBlackOutlineRect(ctx, -P - P, 4 * P - P, 2 + 1, 6 + 1, P);
  drawPixelRect(ctx, -P, 4 * P, 2, 6, P, somaColor);

  // v8.0: 축삭 말단 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, 11 * P, 2, P, somaColor);

  // v8.0: 발화 표시 - 외곽 링
  if (fire) {
    ctx.globalAlpha = 0.6;
    drawPixelCircleWithBlackOutline(ctx, 0, 0, 8, P, activeColor);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

export function drawPixelSynapseSpark(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const sparkPhase = Math.floor(t / 150) % 3;

  ctx.save();

  const sparkColor = isHit ? '#ffffff' : CYBER_PALETTE.brightYellow;
  const vesicleColor = isHit ? '#ffffff' : CYBER_PALETTE.brightCyan;
  const terminalColor = isHit ? '#ffffff' : CYBER_PALETTE.neonPink;

  // v8.0: 전시냅스 터미널 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, -6 * P, 0, 3, P, terminalColor);

  // v8.0: 후시냅스 터미널 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 6 * P, 0, 3, P, terminalColor);

  // v8.0: 시냅스 틈 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -2 * P - P, -4 * P - P, 4 + 1, 8 + 1, P);
  drawPixelRect(ctx, -2 * P, -4 * P, 4, 8, P, '#1f2937');

  // v8.0: 신경전달물질 소포 - 검은 아웃라인
  for (let i = 0; i < 3; i++) {
    const baseY = -2 * P + i * 2 * P;
    const offsetX = sparkPhase === i ? P : 0;
    drawPixelCircleWithBlackOutline(ctx, -P + offsetX, baseY, 1, P, vesicleColor);
  }

  // v8.0: 스파크 (애니메이션) - 검은 아웃라인
  if (sparkPhase === 2) {
    drawPixelRectWithBlackOutline(ctx, 0, -2 * P, 1, 1, P, sparkColor);
    drawPixelRectWithBlackOutline(ctx, P, 0, 1, 1, P, sparkColor);
    drawPixelRectWithBlackOutline(ctx, 0, 2 * P, 1, 1, P, sparkColor);
  }

  // v8.0: 신호 화살표 (입력) - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -10 * P, -P, 2, 2, P, CYBER_PALETTE.acidGreen);
  drawPixelRectWithBlackOutline(ctx, -9 * P, -2 * P, 1, 1, P, CYBER_PALETTE.acidGreen);
  drawPixelRectWithBlackOutline(ctx, -9 * P, P, 1, 1, P, CYBER_PALETTE.acidGreen);

  // v8.0: 신호 화살표 (출력) - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, 8 * P, -P, 2, 2, P, CYBER_PALETTE.acidGreen);
  drawPixelRectWithBlackOutline(ctx, 9 * P, -2 * P, 1, 1, P, CYBER_PALETTE.acidGreen);
  drawPixelRectWithBlackOutline(ctx, 9 * P, P, 1, 1, P, CYBER_PALETTE.acidGreen);

  ctx.restore();
}

export function drawPixelWeightAdjuster(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const adjust = Math.sin(t / 400);

  ctx.save();

  const bodyColor = isHit ? '#ffffff' : CYBER_PALETTE.brightCyan;
  const dialColor = isHit ? '#ffffff' : CYBER_PALETTE.brightOrange;

  // v8.0: 메인 몸체 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -7 * P - P, -5 * P - P, 14 + 1, 10 + 1, P);
  drawPixelRect(ctx, -7 * P, -5 * P, 14, 10, P, bodyColor);

  // v8.0: 가중치 다이얼 배경 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 4, P, '#374151');

  // v8.0: 다이얼 침 - 검은 아웃라인
  ctx.save();
  ctx.rotate(adjust * 0.8);
  drawBlackOutlineRect(ctx, -P - P, -3 * P - P, 1 + 1, 3 + 1, P);
  drawPixelRect(ctx, -P, -3 * P, 1, 3, P, dialColor);
  ctx.restore();

  // v8.0: W 라벨 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -6 * P, -4 * P, 2, 1, P, '#ffffff');
  drawPixelRectWithBlackOutline(ctx, -5 * P, -3 * P, 1, 1, P, '#ffffff');
  drawPixelRectWithBlackOutline(ctx, -6 * P, -2 * P, 2, 1, P, '#ffffff');

  // v8.0: +/- 표시 - 검은 아웃라인
  // + 기호
  drawPixelRectWithBlackOutline(ctx, 4 * P, -4 * P, 3, 1, P, CYBER_PALETTE.acidGreen);
  drawPixelRectWithBlackOutline(ctx, 5 * P, -5 * P, 1, 3, P, CYBER_PALETTE.acidGreen);
  // - 기호
  drawPixelRectWithBlackOutline(ctx, 4 * P, 2 * P, 3, 1, P, CYBER_PALETTE.brightRed);

  // v8.0: 값 디스플레이 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -3 * P, 6 * P, 6, 2, P, CYBER_PALETTE.acidGreen);

  ctx.restore();
}

export function drawPixelBiasBlob(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const wobble = Math.sin(t / 300);

  ctx.save();

  const blobColor = isHit ? '#ffffff' : '#9ca3af';
  const coreColor = isHit ? '#ffffff' : CYBER_PALETTE.brightCyan;

  // v8.0: 블롭 형태 (원들로 구성) - 검은 아웃라인
  const offsets = [
    { x: -4 + wobble, y: -5 },
    { x: 4 - wobble, y: -4 },
    { x: 5, y: wobble },
    { x: 4, y: 4 - wobble * 0.5 },
    { x: -3, y: 5 + wobble * 0.5 },
    { x: -5, y: 2 - wobble },
  ];

  // 블롭 외곽
  for (const off of offsets) {
    drawPixelCircleWithBlackOutline(ctx, off.x * P, off.y * P, 3, P, blobColor);
  }

  // v8.0: 중앙 채우기 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 5, P, blobColor);

  // v8.0: 바이어스 코어 - 검은 아웃라인
  drawPixelCircleWithBlackOutline(ctx, 0, 0, 3, P, coreColor);

  // v8.0: +b 라벨 - 검은 아웃라인
  // + 기호
  drawPixelRectWithBlackOutline(ctx, -2 * P, -P, 2, 1, P, '#ffffff');
  drawPixelRectWithBlackOutline(ctx, -P, -2 * P, 1, 2, P, '#ffffff');
  // b 문자
  drawPixelRectWithBlackOutline(ctx, P, -P, 1, 3, P, '#ffffff');
  drawPixelRectWithBlackOutline(ctx, 2 * P, 0, 1, 1, P, '#ffffff');
  drawPixelRectWithBlackOutline(ctx, 2 * P, P, 1, 1, P, '#ffffff');

  ctx.restore();
}

export function drawPixelActivationWave(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();

  ctx.save();

  const waveColor = isHit ? '#ffffff' : CYBER_PALETTE.acidGreen;
  const peakColor = isHit ? '#ffffff' : CYBER_PALETTE.brightYellow;

  // v8.0: 축 선 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -10 * P - P, -P - P, 20 + 1, 1 + 1, P);
  drawPixelRect(ctx, -10 * P, -P, 20, 1, P, '#6b7280');
  drawBlackOutlineRect(ctx, -P - P, -7 * P - P, 1 + 1, 14 + 1, P);
  drawPixelRect(ctx, -P, -7 * P, 1, 14, P, '#6b7280');

  // v8.0: Sigmoid 파형 - 검은 아웃라인
  for (let i = -8; i <= 8; i += 2) {
    const sigmoid = 1 / (1 + Math.exp(-(i / 2)));
    const y = 5 - sigmoid * 10;
    const animY = y + Math.sin(t / 200 + i / 2);
    const color = i === 0 ? peakColor : waveColor;
    drawPixelRectWithBlackOutline(ctx, i * P, animY * P, 1, 1, P, color);
  }

  // v8.0: f(x) 라벨 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -9 * P, -6 * P, 1, 1, P, '#ffffff');
  drawPixelRectWithBlackOutline(ctx, -8 * P, -6 * P, 1, 1, P, '#ffffff');

  // v8.0: 전파 글로우 - 검은 아웃라인
  const glowX = Math.floor((t / 50) % 16) - 8;
  ctx.globalAlpha = 0.6;
  drawPixelCircleWithBlackOutline(ctx, glowX * P, 0, 2, P, waveColor);
  ctx.globalAlpha = 1;

  ctx.restore();
}

// =====================================================
// STAGE 25: Learning Center (학습 센터) - ML Theme
// =====================================================

export function drawPixelTrainingData(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const scroll = Math.floor(t / 200) % 8;

  ctx.save();

  const bgColor = isHit ? '#ffffff' : CYBER_PALETTE.brightCyan;
  const dataColor = isHit ? '#ffffff' : '#374151';
  const labelColor = isHit ? '#ffffff' : CYBER_PALETTE.acidGreen;

  // v8.0: 데이터 테이블 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -8 * P - P, -6 * P - P, 16 + 1, 12 + 1, P);
  drawPixelRect(ctx, -8 * P, -6 * P, 16, 12, P, bgColor);

  // v8.0: 데이터 행 (스크롤링) - 검은 아웃라인
  for (let i = 0; i < 3; i++) {
    const rowY = -4 * P + i * 3 * P - (scroll % 3) * P;
    if (rowY >= -5 * P && rowY <= 4 * P) {
      // 데이터 열
      drawPixelRectWithBlackOutline(ctx, -7 * P, rowY, 10, 2, P, dataColor);
      // 라벨 열
      drawPixelRectWithBlackOutline(ctx, 4 * P, rowY, 3, 2, P, labelColor);
    }
  }

  // v8.0: 헤더 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -8 * P - P, -8 * P - P, 16 + 1, 2 + 1, P);
  drawPixelRect(ctx, -8 * P, -8 * P, 16, 2, P, CYBER_PALETTE.brightCyan);
  // X/Y 라벨
  drawPixelRectWithBlackOutline(ctx, -6 * P, -8 * P, 1, 1, P, '#ffffff');
  drawPixelRectWithBlackOutline(ctx, 5 * P, -8 * P, 1, 1, P, '#ffffff');

  // v8.0: 미니 산점도 아이콘 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -6 * P, 8 * P, 1, 1, P, CYBER_PALETTE.brightRed);
  drawPixelRectWithBlackOutline(ctx, -3 * P, 7 * P, 1, 1, P, CYBER_PALETTE.brightRed);
  drawPixelRectWithBlackOutline(ctx, 0, 9 * P, 1, 1, P, CYBER_PALETTE.brightCyan);
  drawPixelRectWithBlackOutline(ctx, 3 * P, 8 * P, 1, 1, P, CYBER_PALETTE.brightCyan);

  ctx.restore();
}

export function drawPixelLossFunction(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const descend = Math.abs(Math.sin(t / 500)) * 6;

  ctx.save();

  const curveColor = isHit ? '#ffffff' : CYBER_PALETTE.brightRed;
  const ballColor = isHit ? '#ffffff' : CYBER_PALETTE.brightYellow;
  const axisColor = isHit ? '#ffffff' : '#6b7280';

  // v8.0: 축 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -9 * P - P, P - P, 18 + 1, 1 + 1, P);
  drawPixelRect(ctx, -9 * P, P, 18, 1, P, axisColor);
  drawBlackOutlineRect(ctx, -P - P, -6 * P - P, 1 + 1, 8 + 1, P);
  drawPixelRect(ctx, -P, -6 * P, 1, 8, P, axisColor);

  // v8.0: 손실 곡선 (U 형태) - 검은 아웃라인
  for (let i = -6; i <= 6; i += 2) {
    const y = Math.floor((i * i) / 8) - 5;
    drawPixelRectWithBlackOutline(ctx, i * P, y * P, 1, 1, P, curveColor);
  }

  // v8.0: 경사 하강 공 - 검은 아웃라인
  const ballX = -6 + descend;
  const ballY = Math.floor(((ballX - 6) * (ballX - 6)) / 8) - 5;
  drawPixelCircleWithBlackOutline(ctx, (ballX - 6) * P, ballY * P, 2, P, ballColor);

  // v8.0: 최소점 표시 - 검은 아웃라인
  const blink = Math.floor(t / 300) % 2;
  if (blink) {
    drawPixelRectWithBlackOutline(ctx, 0, -5 * P, 1, 1, P, CYBER_PALETTE.acidGreen);
  }

  // v8.0: L 라벨 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -8 * P, -5 * P, 1, 3, P, '#ffffff');
  drawPixelRectWithBlackOutline(ctx, -7 * P, -3 * P, 1, 1, P, '#ffffff');

  ctx.restore();
}

export function drawPixelGradientFlow(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const flow = Math.floor(t / 100) % 16;

  ctx.save();

  const arrowColor = isHit ? '#ffffff' : CYBER_PALETTE.neonPink;
  const nodeColor = isHit ? '#ffffff' : CYBER_PALETTE.brightCyan;

  // v8.0: 신경망 레이어 (3개 레이어) - 검은 아웃라인
  const layers = [
    { x: -7, nodes: 2 },
    { x: 0, nodes: 3 },
    { x: 7, nodes: 2 },
  ];

  for (const layer of layers) {
    for (let i = 0; i < layer.nodes; i++) {
      const ny = -4 + i * (8 / (layer.nodes - 1 || 1));
      drawPixelCircleWithBlackOutline(ctx, layer.x * P, ny * P, 2, P, nodeColor);
    }
  }

  // v8.0: 그래디언트 화살표 (역전파 흐름) - 검은 아웃라인
  for (let i = 0; i < 4; i++) {
    const px = 7 - Math.floor((flow + i * 4) % 14);
    if (px > -7) {
      const py = Math.sin(px / 2) * 2;
      drawPixelRectWithBlackOutline(ctx, px * P, py * P, 1, 1, P, arrowColor);
    }
  }

  // v8.0: 화살표 머리 (왼쪽 방향) - 검은 아웃라인
  const headX = 7 - flow % 14;
  if (headX > -6) {
    drawPixelRectWithBlackOutline(ctx, (headX - 1) * P, -P, 1, 1, P, arrowColor);
    drawPixelRectWithBlackOutline(ctx, (headX - 1) * P, P, 1, 1, P, arrowColor);
  }

  // v8.0: BACK 라벨 - 검은 아웃라인
  drawPixelRectWithBlackOutline(ctx, -3 * P, 6 * P, 6, 2, P, arrowColor);

  ctx.restore();
}

export function drawPixelOverfitting(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const wiggle = Math.sin(t / 200);

  ctx.save();

  const lineColor = isHit ? '#ffffff' : CYBER_PALETTE.brightOrange;
  const pointColor = isHit ? '#ffffff' : CYBER_PALETTE.brightCyan;
  const idealColor = isHit ? '#ffffff' : CYBER_PALETTE.acidGreen;

  // v8.0: 데이터 포인트 - 검은 아웃라인
  const points = [
    { x: -6, y: 3 }, { x: -3, y: 1 }, { x: 0, y: -2 },
    { x: 3, y: 0 }, { x: 6, y: 2 },
  ];

  for (const p of points) {
    const py = p.y + wiggle;
    drawPixelCircleWithBlackOutline(ctx, p.x * P, py * P, 1, P, pointColor);
  }

  // v8.0: 오버피팅 곡선 (복잡한 곡선) - 검은 아웃라인
  for (let i = -7; i <= 7; i += 2) {
    const y = Math.sin(i / 1.5) * 3 + Math.cos(i) + wiggle;
    drawPixelRectWithBlackOutline(ctx, i * P, y * P, 1, 1, P, lineColor);
  }

  // v8.0: 이상적인 선 (단순) - 검은 아웃라인
  ctx.globalAlpha = 0.6;
  for (let i = -6; i <= 6; i += 3) {
    drawPixelRectWithBlackOutline(ctx, i * P, (i / 4) * P, 1, 1, P, idealColor);
  }
  ctx.globalAlpha = 1;

  // v8.0: 경고 LED - 검은 아웃라인
  const blink = Math.floor(t / 200) % 2;
  if (blink) {
    drawPixelCircleWithBlackOutline(ctx, 0, -7 * P, 1, P, CYBER_PALETTE.brightRed);
  }

  ctx.restore();
}

export function drawPixelEpochCounter(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = Date.now();
  const epoch = Math.floor((t / 100) % 1000);

  ctx.save();

  const bgColor = isHit ? '#ffffff' : CYBER_PALETTE.acidGreen;
  const displayColor = isHit ? '#ffffff' : '#1f2937';
  const digitColor = isHit ? '#ffffff' : CYBER_PALETTE.brightCyan;

  // v8.0: 카운터 몸체 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -8 * P - P, -6 * P - P, 16 + 1, 12 + 1, P);
  drawPixelRect(ctx, -8 * P, -6 * P, 16, 12, P, bgColor);

  // v8.0: 디스플레이 화면 - 검은 아웃라인
  drawBlackOutlineRect(ctx, -7 * P - P, -4 * P - P, 14 + 1, 6 + 1, P);
  drawPixelRect(ctx, -7 * P, -4 * P, 14, 6, P, displayColor);

  // v8.0: 에포크 숫자 (3자리) - 검은 아웃라인
  for (let i = 0; i < 3; i++) {
    const dx = -5 * P + i * 4 * P;
    drawPixelRectWithBlackOutline(ctx, dx, -3 * P, 3, 4, P, digitColor);
  }

  // v8.0: 프로그레스 바 - 검은 아웃라인
  const progress = (epoch % 100) / 100;
  drawBlackOutlineRect(ctx, -7 * P - P, 3 * P - P, 14 + 1, 2 + 1, P);
  drawPixelRect(ctx, -7 * P, 3 * P, 14, 2, P, '#374151');
  const barWidth = Math.floor(14 * progress);
  if (barWidth > 0) {
    drawPixelRect(ctx, -7 * P, 3 * P, barWidth, 2, P, CYBER_PALETTE.brightYellow);
  }

  // v8.0: 스피닝 표시 - 검은 아웃라인
  const spin = Math.floor((t / 100) % 4);
  const spinOffsets = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const [sx, sy] = spinOffsets[spin];
  drawPixelRectWithBlackOutline(ctx, 6 * P + sx * P, -3 * P + sy * P, 1, 1, P, CYBER_PALETTE.brightYellow);

  ctx.restore();
}
