/**
 * game/rendering/enemies/pixelSingularity.ts - 싱귤래리티 몬스터 픽셀 아트
 * v6.0: 16종 싱귤래리티 몬스터의 사이버펑크 픽셀 아트 버전
 */

import type { EnemyRenderData } from './types';
import { getFrameTime, deterministicRandom, getSeedBase } from './renderContext';
import {
  CYBER_PALETTE,
  drawPixel,
  drawPixelRect,
  drawPixelRectOutline,
  drawPixelCircle,
  drawPixelCircleOutline,
  drawPixelLineH,
  drawPixelLineV,
  drawPixelShadow,
  drawPixelLED,
  drawDitheredRect,
  drawGlitchNoise,
  drawDataStream,
  drawScanlines,
  drawBinaryText,
  // v8.0: 검은 아웃라인 유틸리티
  drawPixelRectWithBlackOutline,
  drawPixelCircleWithBlackOutline,
  drawBlackOutlineRect,
} from './pixelMonster';

// =====================================================
// Era 1: 초기 AI (Bitling, Spammer)
// =====================================================

/**
 * BITLING - 데이터 조각
 * v8.0: 검은 아웃라인 + 선명한 바이너리 큐브 리디자인
 */
export function drawPixelBitling(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = getFrameTime();
  const seed = (enemy.id || 0) + getSeedBase();
  const P = 2;

  ctx.save();

  // 떠다니는 효과
  const float = Math.sin(t / 200 + seed) * 2;
  ctx.translate(0, float);

  // 그림자
  drawPixelShadow(ctx, -8, 10 - float / 2, 8, P);

  if (isHit) {
    drawPixelRectWithBlackOutline(ctx, -4 * P, -4 * P, 4, 4, P, CYBER_PALETTE.white);
  } else {
    // v8.0: 검은 아웃라인 큐브 바디
    drawPixelRectWithBlackOutline(ctx, -4 * P, -4 * P, 4, 4, P, CYBER_PALETTE.matrixDark);

    // 내부 하이라이트
    drawPixelRect(ctx, -3 * P, -3 * P, 2, 2, P, CYBER_PALETTE.matrixMid);

    // 바이너리 텍스트 (0 또는 1) - 더 선명하게
    const bit = Math.floor(t / 500 + seed) % 2;
    if (bit === 0) {
      // "0" 패턴 - 밝은 녹색
      drawPixelRectOutline(ctx, -2 * P, -2 * P, 2, 3, P, CYBER_PALETTE.brightCyan);
    } else {
      // "1" 패턴 - 밝은 녹색
      drawPixelLineV(ctx, -1 * P, -2 * P, 3, P, CYBER_PALETTE.brightCyan);
      drawPixel(ctx, -2 * P, -1 * P, P, CYBER_PALETTE.brightCyan);
    }

    // 글로우 코너 - 더 밝게
    const glow = Math.floor(t / 100) % 4;
    const corners = [[-4, -4], [2, -4], [-4, 2], [2, 2]];
    drawPixel(ctx, corners[glow][0] * P, corners[glow][1] * P, P, CYBER_PALETTE.matrixLight);

    // v8.0: 데이터 스트림 파티클
    const dataY = ((t / 80) % 8) * P - 4 * P;
    drawPixel(ctx, -5 * P, dataY, P, CYBER_PALETTE.matrixGreen);
    drawPixel(ctx, 4 * P, -dataY, P, CYBER_PALETTE.matrixGreen);
  }

  ctx.restore();
}

/**
 * SPAMMER - 스팸 이메일 봇
 * v8.0: 검은 아웃라인 + 선명한 봉투/이메일 디자인
 */
export function drawPixelSpammer(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = getFrameTime();
  const P = 2;

  ctx.save();

  // 그림자
  drawPixelShadow(ctx, -10, 12, 10, P);

  if (isHit) {
    drawPixelRectWithBlackOutline(ctx, -5 * P, -5 * P, 5, 6, P, CYBER_PALETTE.white);
  } else {
    // v8.0: 검은 아웃라인 봉투 스택 (3장)
    for (let i = 2; i >= 0; i--) {
      const offset = i * 2;
      // 검은 아웃라인 봉투
      drawBlackOutlineRect(ctx, (-5 + offset) * P - P, (-5 + offset) * P - P, 5 + 1, 4 + 1, P);
      drawPixelRect(ctx, (-5 + offset) * P, (-5 + offset) * P, 5, 4, P, CYBER_PALETTE.metalLight);
      // 봉투 테두리 - 보라색
      drawPixelRectOutline(ctx, (-5 + offset) * P, (-5 + offset) * P, 5, 4, P, CYBER_PALETTE.neonPink);
      // 봉투 V 모양
      drawPixelLineH(ctx, (-4 + offset) * P, (-4 + offset) * P, 3, P, CYBER_PALETTE.codePurple);
    }

    // @ 심볼 - 더 선명하게
    const bounce = Math.sin(t / 150) * P;
    drawPixelCircleWithBlackOutline(ctx, 0, -8 * P + bounce, 2, P, CYBER_PALETTE.neonPink);
    drawPixel(ctx, P, -8 * P + bounce, P, CYBER_PALETTE.white);

    // 날아가는 편지들 - 밝은 색상
    for (let i = 0; i < 3; i++) {
      const flyX = Math.sin(t / 200 + i * 2) * 8 * P;
      const flyY = -10 * P - i * 3 * P + Math.cos(t / 300 + i) * 2 * P;
      drawPixelRectWithBlackOutline(ctx, flyX - P, flyY - P, 1, 1, P, CYBER_PALETTE.codeMid);
    }

    // v8.0: 스팸 경고 텍스트 (깜빡임)
    if (Math.floor(t / 200) % 2 === 0) {
      drawPixel(ctx, -6 * P, -3 * P, P, CYBER_PALETTE.brightRed);
      drawPixel(ctx, 5 * P, -3 * P, P, CYBER_PALETTE.brightRed);
    }

    // 다리 - 검은 아웃라인
    drawPixelRectWithBlackOutline(ctx, -3 * P, 3 * P, 1, 2, P, CYBER_PALETTE.metalMid);
    drawPixelRectWithBlackOutline(ctx, 1 * P, 3 * P, 1, 2, P, CYBER_PALETTE.metalMid);
  }

  ctx.restore();
}

// =====================================================
// Era 2: 발전된 AI (Crypter, Ransomer, Pixel, Bug)
// =====================================================

/**
 * CRYPTER - 암호화 바이러스
 * v8.0: 검은 아웃라인 + 선명한 자물쇠 디자인
 */
export function drawPixelCrypter(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = getFrameTime();
  const P = 2;

  ctx.save();

  // 그림자
  drawPixelShadow(ctx, -10, 14, 10, P);

  if (isHit) {
    drawPixelRectWithBlackOutline(ctx, -5 * P, -6 * P, 5, 7, P, CYBER_PALETTE.white);
  } else {
    // v8.0: 검은 아웃라인 자물쇠 고리
    drawPixelCircleWithBlackOutline(ctx, 0, -7 * P, 3, P, CYBER_PALETTE.brightOrange);

    // v8.0: 검은 아웃라인 자물쇠 몸통
    drawBlackOutlineRect(ctx, -4 * P - P, -4 * P - P, 4 + 1, 5 + 1, P);
    drawPixelRect(ctx, -4 * P, -4 * P, 4, 5, P, CYBER_PALETTE.alertMid);
    drawPixelRectOutline(ctx, -4 * P, -4 * P, 4, 5, P, CYBER_PALETTE.brightOrange);

    // 열쇠 구멍 - 더 선명하게
    drawPixelCircle(ctx, 0, -2 * P, 1, P, CYBER_PALETTE.pureBlack);
    drawPixelRect(ctx, -1 * P, -1 * P, 1, 2, P, CYBER_PALETTE.pureBlack);

    // 암호화 진행 바 - 더 밝은 색상
    const progress = (t / 50) % 5;
    drawPixelRect(ctx, -3 * P, 2 * P, 3, 1, P, CYBER_PALETTE.alertDark);
    drawPixelRect(ctx, -3 * P, 2 * P, Math.floor(progress), 1, P, CYBER_PALETTE.brightCyan);

    // v8.0: 암호화 파티클 - 밝은 색상
    for (let i = 0; i < 4; i++) {
      const px = Math.sin(t / 100 + i * 1.5) * 6 * P;
      const py = -8 * P - i * 2 * P;
      drawBinaryText(ctx, px, py, P, (enemy.id || 0) + i, CYBER_PALETTE.brightOrange);
    }

    // v8.0: 경고 느낌표
    if (Math.floor(t / 150) % 2 === 0) {
      drawPixelLineV(ctx, 0, -10 * P, 2, P, CYBER_PALETTE.brightRed);
      drawPixel(ctx, 0, -7 * P, P, CYBER_PALETTE.brightRed);
    }
  }

  ctx.restore();
}

/**
 * RANSOMER - 랜섬웨어 AI
 * v8.0: 검은 아웃라인 + 위협적인 팝업 디자인
 */
export function drawPixelRansomer(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = getFrameTime();
  const P = 2;
  const flash = Math.floor(t / 200) % 2 === 0;

  ctx.save();

  // 그림자
  drawPixelShadow(ctx, -12, 14, 12, P);

  if (isHit) {
    drawPixelRectWithBlackOutline(ctx, -6 * P, -6 * P, 6, 7, P, CYBER_PALETTE.white);
  } else {
    // v8.0: 검은 아웃라인 경고 팝업 창
    drawBlackOutlineRect(ctx, -6 * P - P, -6 * P - P, 6 + 1, 7 + 1, P);
    drawPixelRect(ctx, -6 * P, -6 * P, 6, 7, P, flash ? CYBER_PALETTE.virusMid : CYBER_PALETTE.virusDark);
    drawPixelRectOutline(ctx, -6 * P, -6 * P, 6, 7, P, CYBER_PALETTE.brightRed);

    // 타이틀 바 - 더 밝은 빨강
    drawPixelRect(ctx, -6 * P, -6 * P, 6, 1, P, CYBER_PALETTE.brightRed);

    // X 버튼 (비활성) - 회색
    drawPixel(ctx, 4 * P, -6 * P, P, CYBER_PALETTE.metalDark);

    // WARNING 텍스트 - 밝은 색
    drawPixelLineH(ctx, -4 * P, -4 * P, 4, P, CYBER_PALETTE.white);

    // $ 심볼 - 밝은 오렌지
    drawPixelLineV(ctx, 0, -2 * P, 3, P, CYBER_PALETTE.brightOrange);
    drawPixelLineH(ctx, -1 * P, -2 * P, 2, P, CYBER_PALETTE.brightOrange);
    drawPixelLineH(ctx, -1 * P, 0, 2, P, CYBER_PALETTE.brightOrange);

    // 비트코인 심볼들 - 검은 아웃라인
    const coinY = Math.sin(t / 150) * P;
    drawPixelCircleWithBlackOutline(ctx, -8 * P, coinY, 1, P, CYBER_PALETTE.brightOrange);
    drawPixelCircleWithBlackOutline(ctx, 8 * P, -coinY, 1, P, CYBER_PALETTE.brightOrange);

    // 카운트다운 바 - 밝은 색
    const countdown = (t / 100) % 6;
    drawPixelRect(ctx, -5 * P, 2 * P, 5, 1, P, CYBER_PALETTE.virusDark);
    drawPixelRect(ctx, -5 * P, 2 * P, Math.floor(6 - countdown), 1, P, CYBER_PALETTE.brightRed);

    // v8.0: 추가 위협 이펙트
    if (flash) {
      drawPixel(ctx, -7 * P, -5 * P, P, CYBER_PALETTE.brightRed);
      drawPixel(ctx, 6 * P, -5 * P, P, CYBER_PALETTE.brightRed);
    }
  }

  ctx.restore();
}

/**
 * PIXEL - 손상된 이미지
 * v8.0: 검은 아웃라인 + 강렬한 RGB 글리치
 */
export function drawPixelPixel(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = getFrameTime();
  const seed = (enemy.id || 0) + getSeedBase();
  const P = 2;

  ctx.save();

  // 그림자
  drawPixelShadow(ctx, -10, 12, 10, P);

  // RGB 분리 오프셋
  const rgbOffset = Math.floor(deterministicRandom(seed + Math.floor(t / 100)) * 3) - 1;

  if (isHit) {
    drawPixelRectWithBlackOutline(ctx, -5 * P, -5 * P, 5, 5, P, CYBER_PALETTE.white);
  } else {
    // v8.0: 검은 아웃라인 먼저
    drawBlackOutlineRect(ctx, -5 * P - P, -5 * P - P, 5 + 1, 5 + 1, P);

    // R 채널 (빨강 오프셋) - 더 밝게
    ctx.globalAlpha = 0.6;
    drawPixelRect(ctx, (-5 + rgbOffset) * P, -5 * P, 5, 5, P, CYBER_PALETTE.brightRed);

    // G 채널 (녹색) - 더 밝게
    drawPixelRect(ctx, -5 * P, (-5 - rgbOffset) * P, 5, 5, P, CYBER_PALETTE.acidGreen);

    // B 채널 (파랑 오프셋) - 더 밝게
    drawPixelRect(ctx, (-5 - rgbOffset) * P, (-5 + rgbOffset) * P, 5, 5, P, CYBER_PALETTE.electricBlue);
    ctx.globalAlpha = 1;

    // 메인 이미지 (손상된)
    drawPixelRect(ctx, -4 * P, -4 * P, 4, 4, P, CYBER_PALETTE.metalMid);

    // 글리치 라인들 - 더 밝은 핑크
    for (let i = 0; i < 3; i++) {
      const glitchY = -4 * P + i * 2 * P;
      const glitchOffset = Math.floor(deterministicRandom(seed + i + Math.floor(t / 80)) * 4) - 2;
      drawPixelLineH(ctx, (-4 + glitchOffset) * P, glitchY, 3, P, CYBER_PALETTE.neonPink);
    }

    // "?" 심볼 (손상된 이미지) - 밝은 노란색
    drawPixelCircleOutline(ctx, -1 * P, -2 * P, 1, P, CYBER_PALETTE.glitchYellow);
    drawPixel(ctx, -1 * P, 0, P, CYBER_PALETTE.glitchYellow);

    // v8.0: 추가 글리치 노이즈
    if (Math.floor(t / 100) % 3 === 0) {
      drawGlitchNoise(ctx, -5 * P, -5 * P, 5, 5, P, seed + t, 0.15);
    }
  }

  ctx.restore();
}

/**
 * BUG - 소프트웨어 버그
 * v8.0: 검은 아웃라인 + 선명한 벌레/에러 디자인
 */
export function drawPixelBug(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = getFrameTime();
  const P = 2;
  const legWave = Math.sin(t / 100);

  ctx.save();

  // 그림자
  drawPixelShadow(ctx, -10, 10, 10, P);

  if (isHit) {
    drawPixelRectWithBlackOutline(ctx, -5 * P, -4 * P, 5, 4, P, CYBER_PALETTE.white);
  } else {
    // v8.0: 검은 아웃라인 벌레 몸통
    drawBlackOutlineRect(ctx, -4 * P - P, -3 * P - P, 4 + 1, 3 + 1, P);
    drawPixelRect(ctx, -4 * P, -3 * P, 4, 3, P, CYBER_PALETTE.virusMid);
    drawPixelRectOutline(ctx, -4 * P, -3 * P, 4, 3, P, CYBER_PALETTE.brightRed);

    // v8.0: 검은 아웃라인 머리
    drawPixelCircleWithBlackOutline(ctx, -5 * P, -1 * P, 2, P, CYBER_PALETTE.virusLight);

    // 눈 - 더 밝게
    drawPixel(ctx, -6 * P, -2 * P, P, CYBER_PALETTE.brightRed);
    drawPixel(ctx, -4 * P, -2 * P, P, CYBER_PALETTE.brightRed);

    // 더듬이 - 검은 아웃라인
    drawPixelRectWithBlackOutline(ctx, -7 * P, -4 * P, 1, 1, P, CYBER_PALETTE.brightRed);
    drawPixelRectWithBlackOutline(ctx, -5 * P, -4 * P, 1, 1, P, CYBER_PALETTE.brightRed);

    // 다리 (6개, 움직임) - 더 선명하게
    const legOffset = Math.floor(legWave * P);
    // 위쪽 다리들
    drawPixel(ctx, -5 * P, -4 * P - legOffset, P, CYBER_PALETTE.virusLight);
    drawPixel(ctx, -3 * P, -5 * P + legOffset, P, CYBER_PALETTE.virusLight);
    drawPixel(ctx, -1 * P, -4 * P - legOffset, P, CYBER_PALETTE.virusLight);
    // 아래쪽 다리들
    drawPixel(ctx, -5 * P, 0 + legOffset, P, CYBER_PALETTE.virusLight);
    drawPixel(ctx, -3 * P, 1 * P - legOffset, P, CYBER_PALETTE.virusLight);
    drawPixel(ctx, -1 * P, 0 + legOffset, P, CYBER_PALETTE.virusLight);

    // v8.0: ERR 404 텍스트 - 검은 배경 + 밝은 텍스트
    drawPixelRectWithBlackOutline(ctx, 2 * P, -3 * P, 4, 3, P, CYBER_PALETTE.pureBlack);
    drawPixelLineH(ctx, 3 * P, -2 * P, 2, P, CYBER_PALETTE.brightRed);
    drawPixel(ctx, 3 * P, -1 * P, P, CYBER_PALETTE.brightRed);
    drawPixel(ctx, 5 * P, -1 * P, P, CYBER_PALETTE.brightRed);

    // v8.0: 경고 깜빡임
    if (Math.floor(t / 150) % 2 === 0) {
      drawPixel(ctx, -7 * P, -1 * P, P, CYBER_PALETTE.brightRed);
      drawPixel(ctx, 7 * P, -1 * P, P, CYBER_PALETTE.brightRed);
    }
  }

  ctx.restore();
}

// =====================================================
// Era 3: 네트워크 AI (Worm, Adware, Mutant, Polymorphic)
// =====================================================

/**
 * WORM - 네트워크 웜
 * v8.0: 검은 아웃라인 + 선명한 연결 노드 디자인
 */
export function drawPixelWorm(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = getFrameTime();
  const P = 2;
  const wave = Math.sin(t / 150);

  ctx.save();

  // 그림자
  drawPixelShadow(ctx, -14, 10, 14, P);

  if (isHit) {
    for (let i = 0; i < 4; i++) {
      drawPixelCircleWithBlackOutline(ctx, (-6 + i * 4) * P, wave * P * (i % 2 === 0 ? 1 : -1), 2, P, CYBER_PALETTE.white);
    }
  } else {
    // v8.0: 연결선 먼저 (노드 아래에)
    for (let i = 0; i < 3; i++) {
      const segX = (-6 + i * 4) * P;
      const segY = wave * P * (i % 2 === 0 ? 1 : -1);
      const nextX = (-6 + (i + 1) * 4) * P;
      const nextY = wave * P * ((i + 1) % 2 === 0 ? 1 : -1);

      // 연결선 - 밝은 시안
      drawPixelLineH(ctx, segX + 2 * P, (segY + nextY) / 2, 2, P, CYBER_PALETTE.brightCyan);
    }

    // v8.0: 웜 세그먼트들 (검은 아웃라인)
    for (let i = 0; i < 4; i++) {
      const segX = (-6 + i * 4) * P;
      const segY = wave * P * (i % 2 === 0 ? 1 : -1);

      // 노드 - 검은 아웃라인
      drawPixelCircleWithBlackOutline(ctx, segX, segY, 2, P, i === 0 ? CYBER_PALETTE.dataLight : CYBER_PALETTE.dataMid);
      drawPixelCircleOutline(ctx, segX, segY, 2, P, CYBER_PALETTE.brightCyan);

      // 내부 코어
      drawPixel(ctx, segX, segY, P, CYBER_PALETTE.brightCyan);

      // 눈 (첫 번째 노드만) - 더 밝게
      if (i === 0) {
        drawPixel(ctx, segX - P, segY - P, P, CYBER_PALETTE.white);
        drawPixel(ctx, segX + P, segY - P, P, CYBER_PALETTE.white);
      }
    }

    // v8.0: 데이터 파티클 - 더 선명하게
    const dataX = (t / 30) % (16 * P) - 8 * P;
    drawPixelRectWithBlackOutline(ctx, dataX - P, -4 * P, 1, 1, P, CYBER_PALETTE.brightCyan);

    // v8.0: 추가 데이터 흐름 이펙트
    const dataX2 = ((t / 25) + 8 * P) % (16 * P) - 8 * P;
    drawPixel(ctx, dataX2, 3 * P, P, CYBER_PALETTE.dataCyan);
  }

  ctx.restore();
}

/**
 * ADWARE - 광고 팝업 봇
 * v8.0: 검은 아웃라인 + 선명한 가짜 팝업 디자인
 */
export function drawPixelAdware(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = getFrameTime();
  const P = 2;
  const bounce = Math.abs(Math.sin(t / 100)) * 2;

  ctx.save();
  ctx.translate(0, -bounce);

  // 그림자
  drawPixelShadow(ctx, -12, 14 + bounce, 12, P);

  if (isHit) {
    drawPixelRectWithBlackOutline(ctx, -6 * P, -5 * P, 6, 6, P, CYBER_PALETTE.white);
  } else {
    // v8.0: 검은 아웃라인 팝업 창
    drawBlackOutlineRect(ctx, -6 * P - P, -5 * P - P, 6 + 1, 6 + 1, P);
    drawPixelRect(ctx, -6 * P, -5 * P, 6, 6, P, CYBER_PALETTE.alertLight);
    drawPixelRectOutline(ctx, -6 * P, -5 * P, 6, 6, P, CYBER_PALETTE.brightOrange);

    // 타이틀 바 - 더 밝은 오렌지
    drawPixelRect(ctx, -6 * P, -5 * P, 6, 1, P, CYBER_PALETTE.brightOrange);

    // X 버튼 (가짜) - 더 밝은 빨강
    drawPixel(ctx, 4 * P, -5 * P, P, CYBER_PALETTE.brightRed);

    // v8.0: "WIN" 텍스트 (깜빡임) - 더 선명하게
    if (Math.floor(t / 150) % 2 === 0) {
      drawPixelLineH(ctx, -4 * P, -3 * P, 4, P, CYBER_PALETTE.acidGreen);
      drawPixelLineH(ctx, -3 * P, -1 * P, 2, P, CYBER_PALETTE.acidGreen);
    } else {
      drawPixelLineH(ctx, -4 * P, -3 * P, 4, P, CYBER_PALETTE.matrixGreen);
      drawPixelLineH(ctx, -3 * P, -1 * P, 2, P, CYBER_PALETTE.matrixGreen);
    }

    // v8.0: 별 이펙트 - 검은 아웃라인
    const starPositions = [[-8, -6], [6, -4], [-7, 2], [7, 0]];
    const starPhase = Math.floor(t / 100) % 4;
    for (let i = 0; i < starPositions.length; i++) {
      if ((i + starPhase) % 2 === 0) {
        drawPixelRectWithBlackOutline(ctx, starPositions[i][0] * P, starPositions[i][1] * P, 1, 1, P, CYBER_PALETTE.glitchYellow);
      }
    }

    // v8.0: "CLICK" 버튼 - 검은 아웃라인
    drawPixelRectWithBlackOutline(ctx, -3 * P, 2 * P, 3, 1, P, CYBER_PALETTE.acidGreen);

    // 다리 - 검은 아웃라인
    drawPixelRectWithBlackOutline(ctx, -4 * P, 5 * P, 1, 2, P, CYBER_PALETTE.alertMid);
    drawPixelRectWithBlackOutline(ctx, 2 * P, 5 * P, 1, 2, P, CYBER_PALETTE.alertMid);
  }

  ctx.restore();
}

/**
 * MUTANT - 변이 AI
 * v8.0: 검은 아웃라인 + 선명한 불안정 코어 디자인
 */
export function drawPixelMutant(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = getFrameTime();
  const seed = (enemy.id || 0) + getSeedBase();
  const P = 2;

  ctx.save();

  // 그림자
  drawPixelShadow(ctx, -12, 14, 12, P);

  if (isHit) {
    drawPixelRectWithBlackOutline(ctx, -5 * P, -6 * P, 5, 7, P, CYBER_PALETTE.white);
  } else {
    // 불안정한 바디 (흔들림)
    const shake = Math.floor(deterministicRandom(seed + Math.floor(t / 50)) * 3) - 1;
    ctx.translate(shake, shake * 0.5);

    // v8.0: 검은 아웃라인 메인 코어
    drawBlackOutlineRect(ctx, -4 * P - P, -4 * P - P, 4 + 1, 5 + 1, P);
    drawPixelRect(ctx, -4 * P, -4 * P, 4, 5, P, CYBER_PALETTE.codeMid);
    drawPixelRectOutline(ctx, -4 * P, -4 * P, 4, 5, P, CYBER_PALETTE.neonPink);

    // 중앙 코어 - 검은 아웃라인
    drawPixelCircleWithBlackOutline(ctx, 0, -2 * P, 2, P, CYBER_PALETTE.codeLight);

    // v8.0: 추가 돌출부 (랜덤 위치) - 검은 아웃라인
    const protrusions = [
      [-5, -3], [4, -2], [-3, 3], [3, 2], [-1, -6]
    ];
    for (let i = 0; i < protrusions.length; i++) {
      const visible = deterministicRandom(seed + i + Math.floor(t / 200)) > 0.3;
      if (visible) {
        drawPixelCircleWithBlackOutline(ctx, protrusions[i][0] * P, protrusions[i][1] * P, 1, P, CYBER_PALETTE.neonPink);
      }
    }

    // v8.0: 눈들 (여러 개, 랜덤 깜빡임) - 더 밝게
    const eyePositions = [[-2, -3], [1, -2], [-1, 0]];
    for (let i = 0; i < eyePositions.length; i++) {
      const blink = deterministicRandom(seed + i * 10 + Math.floor(t / 150)) > 0.2;
      if (blink) {
        drawPixel(ctx, eyePositions[i][0] * P, eyePositions[i][1] * P, P, CYBER_PALETTE.white);
      }
    }

    // 불안정 파티클 - 더 밝은 색상
    drawGlitchNoise(ctx, -5 * P, -6 * P, 5, 7, P, seed + t, 0.1);

    // v8.0: 경고 깜빡임
    if (Math.floor(t / 200) % 3 === 0) {
      drawPixel(ctx, -5 * P, -5 * P, P, CYBER_PALETTE.brightRed);
      drawPixel(ctx, 4 * P, -5 * P, P, CYBER_PALETTE.brightRed);
    }
  }

  ctx.restore();
}

/**
 * POLYMORPHIC - 변형 AI
 * v8.0: 검은 아웃라인 + 선명한 3단계 변형 디자인
 */
export function drawPixelPolymorphic(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = getFrameTime();
  const P = 2;
  const phase = Math.floor(t / 800) % 3;

  ctx.save();

  // 그림자
  drawPixelShadow(ctx, -10, 12, 10, P);

  if (isHit) {
    drawPixelCircleWithBlackOutline(ctx, 0, 0, 4, P, CYBER_PALETTE.white);
  } else {
    // v8.0: 변형 단계에 따라 다른 모양 - 검은 아웃라인
    switch (phase) {
      case 0: // 원형
        drawPixelCircleWithBlackOutline(ctx, 0, 0, 4, P, CYBER_PALETTE.codeMid);
        drawPixelCircleOutline(ctx, 0, 0, 4, P, CYBER_PALETTE.neonPink);
        drawPixelCircle(ctx, 0, 0, 2, P, CYBER_PALETTE.codeLight);
        break;
      case 1: // 사각형
        drawBlackOutlineRect(ctx, -4 * P - P, -4 * P - P, 4 + 1, 4 + 1, P);
        drawPixelRect(ctx, -4 * P, -4 * P, 4, 4, P, CYBER_PALETTE.codeMid);
        drawPixelRectOutline(ctx, -4 * P, -4 * P, 4, 4, P, CYBER_PALETTE.neonPink);
        drawPixelRect(ctx, -2 * P, -2 * P, 2, 2, P, CYBER_PALETTE.codeLight);
        break;
      case 2: // 십자형 - 검은 아웃라인
        drawPixelRectWithBlackOutline(ctx, -1 * P, -4 * P, 1, 4, P, CYBER_PALETTE.codeMid);
        drawPixelRectWithBlackOutline(ctx, -4 * P, -1 * P, 4, 1, P, CYBER_PALETTE.codeMid);
        drawPixelCircleWithBlackOutline(ctx, 0, 0, 1, P, CYBER_PALETTE.codeLight);
        break;
    }

    // v8.0: 변형 파티클 (변형 중간) - 더 선명하게
    const morphProgress = (t % 800) / 800;
    if (morphProgress > 0.8) {
      drawGlitchNoise(ctx, -4 * P, -4 * P, 4, 4, P, t, 0.35);
      // 변형 경고 이펙트
      drawPixel(ctx, -5 * P, 0, P, CYBER_PALETTE.neonPink);
      drawPixel(ctx, 4 * P, 0, P, CYBER_PALETTE.neonPink);
    }

    // 눈 - 더 밝게
    drawPixel(ctx, -1 * P, -1 * P, P, CYBER_PALETTE.white);
    drawPixel(ctx, P, -1 * P, P, CYBER_PALETTE.white);
  }

  ctx.restore();
}

// =====================================================
// Era 4: 고급 위협 (Trojan, Botnet)
// =====================================================

/**
 * TROJAN - 트로이 목마
 * v8.0: 검은 아웃라인 + 선명한 위장/악성 디자인
 */
export function drawPixelTrojan(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = getFrameTime();
  const P = 2;
  const reveal = Math.floor(t / 500) % 4 === 0; // 가끔 진짜 모습 드러냄

  ctx.save();

  // 그림자
  drawPixelShadow(ctx, -12, 14, 12, P);

  if (isHit) {
    drawPixelRectWithBlackOutline(ctx, -6 * P, -6 * P, 6, 6, P, CYBER_PALETTE.white);
  } else {
    if (!reveal) {
      // v8.0: 검은 아웃라인 친근한 앱 아이콘
      drawBlackOutlineRect(ctx, -5 * P - P, -5 * P - P, 5 + 1, 5 + 1, P);
      drawPixelRect(ctx, -5 * P, -5 * P, 5, 5, P, CYBER_PALETTE.matrixLight);
      drawPixelRectOutline(ctx, -5 * P, -5 * P, 5, 5, P, CYBER_PALETTE.acidGreen);

      // 웃는 얼굴 - 더 선명하게
      drawPixel(ctx, -3 * P, -3 * P, P, CYBER_PALETTE.pureBlack);
      drawPixel(ctx, P, -3 * P, P, CYBER_PALETTE.pureBlack);
      drawPixelLineH(ctx, -2 * P, 0, 3, P, CYBER_PALETTE.pureBlack);

      // 체크마크 (신뢰성) - 검은 아웃라인
      drawPixelRectWithBlackOutline(ctx, 4 * P, -6 * P, 1, 1, P, CYBER_PALETTE.acidGreen);
    } else {
      // v8.0: 검은 아웃라인 진짜 모습 (악성코드)
      drawBlackOutlineRect(ctx, -5 * P - P, -5 * P - P, 5 + 1, 5 + 1, P);
      drawPixelRect(ctx, -5 * P, -5 * P, 5, 5, P, CYBER_PALETTE.virusMid);
      drawPixelRectOutline(ctx, -5 * P, -5 * P, 5, 5, P, CYBER_PALETTE.brightRed);

      // 사악한 눈 - 더 밝게
      drawPixel(ctx, -3 * P, -3 * P, P, CYBER_PALETTE.brightRed);
      drawPixel(ctx, P, -3 * P, P, CYBER_PALETTE.brightRed);

      // 이빨 - 더 선명하게
      drawPixelLineH(ctx, -3 * P, 0, 4, P, CYBER_PALETTE.white);
      drawPixel(ctx, -2 * P, P, P, CYBER_PALETTE.white);
      drawPixel(ctx, P, P, P, CYBER_PALETTE.white);

      // 악성 파티클 - 더 강하게
      drawGlitchNoise(ctx, -6 * P, -6 * P, 6, 6, P, t, 0.2);

      // v8.0: 경고 깜빡임
      drawPixel(ctx, -6 * P, -4 * P, P, CYBER_PALETTE.brightRed);
      drawPixel(ctx, 5 * P, -4 * P, P, CYBER_PALETTE.brightRed);
    }

    // 다리 - 검은 아웃라인
    const legColor = reveal ? CYBER_PALETTE.virusMid : CYBER_PALETTE.matrixMid;
    drawPixelRectWithBlackOutline(ctx, -3 * P, 4 * P, 1, 2, P, legColor);
    drawPixelRectWithBlackOutline(ctx, P, 4 * P, 1, 2, P, legColor);
  }

  ctx.restore();
}

/**
 * BOTNET - 봇넷 (C&C 서버 + 슬레이브)
 * v8.0: 검은 아웃라인 + 선명한 서버/봇 네트워크 디자인
 */
export function drawPixelBotnet(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = getFrameTime();
  const P = 2;

  ctx.save();

  // 그림자
  drawPixelShadow(ctx, -14, 16, 14, P);

  if (isHit) {
    drawPixelRectWithBlackOutline(ctx, -4 * P, -4 * P, 4, 5, P, CYBER_PALETTE.white);
  } else {
    // v8.0: 검은 아웃라인 중앙 C&C 서버
    drawBlackOutlineRect(ctx, -4 * P - P, -4 * P - P, 4 + 1, 5 + 1, P);
    drawPixelRect(ctx, -4 * P, -4 * P, 4, 5, P, CYBER_PALETTE.metalMid);
    drawPixelRectOutline(ctx, -4 * P, -4 * P, 4, 5, P, CYBER_PALETTE.brightRed);

    // 서버 LED - 더 밝게
    const ledOn = Math.floor(t / 100) % 2 === 0;
    drawPixelLED(ctx, -2 * P, -2 * P, P, ledOn, CYBER_PALETTE.brightRed, CYBER_PALETTE.virusDark);

    // 서버 상세 디테일
    drawPixelLineH(ctx, -3 * P, 0, 3, P, CYBER_PALETTE.metalLight);
    drawPixelLineH(ctx, -3 * P, P, 3, P, CYBER_PALETTE.metalLight);

    // v8.0: 슬레이브 봇들 (5개, 원형 배치) - 검은 아웃라인
    const slavePositions = [
      [-8, -4], [8, -4], [-6, 4], [6, 4], [0, -8]
    ];
    for (let i = 0; i < 5; i++) {
      const pulse = Math.sin(t / 200 + i * 1.2);
      const sx = slavePositions[i][0] * P + pulse;
      const sy = slavePositions[i][1] * P;

      // 슬레이브 봇 - 검은 아웃라인
      drawPixelRectWithBlackOutline(ctx, sx - P, sy - P, 1, 1, P, CYBER_PALETTE.metalLight);

      // 연결선 - 더 밝게
      const active = Math.floor(t / 150 + i * 50) % 5 === 0;
      if (active) {
        // 데이터 전송 애니메이션
        const midX = sx / 2;
        const midY = sy / 2;
        drawPixel(ctx, midX, midY, P, CYBER_PALETTE.brightRed);
      }
    }

    // v8.0: 명령 전송 파티클 - 더 선명하게
    for (let i = 0; i < 3; i++) {
      const angle = (t / 200 + i * 2.1);
      const px = Math.cos(angle) * 5 * P;
      const py = Math.sin(angle) * 4 * P;
      drawPixelRectWithBlackOutline(ctx, px - P / 2, py - P / 2, 1, 1, P, CYBER_PALETTE.virusLight);
    }

    // v8.0: 추가 연결선 이펙트
    for (let i = 0; i < 5; i++) {
      const sx = slavePositions[i][0] * P;
      const sy = slavePositions[i][1] * P;
      // 점선 형태의 연결
      const linePhase = (t / 100 + i * 20) % 3;
      if (linePhase < 1) {
        drawPixel(ctx, sx * 0.3, sy * 0.3, P, CYBER_PALETTE.virusMid);
      } else if (linePhase < 2) {
        drawPixel(ctx, sx * 0.6, sy * 0.6, P, CYBER_PALETTE.virusMid);
      }
    }
  }

  ctx.restore();
}

// =====================================================
// Era 5: 스텔스 위협 (Rootkit, APT)
// =====================================================

/**
 * ROOTKIT - 루트킷 (파일 위장)
 * v8.0: 검은 아웃라인 + 선명한 3가지 위장 디자인
 */
export function drawPixelRootkit(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = getFrameTime();
  const seed = (enemy.id || 0) + getSeedBase();
  const P = 2;
  const disguise = Math.floor(seed) % 3;

  ctx.save();

  // 그림자 (거의 안 보임 - 스텔스)
  ctx.globalAlpha = 0.25;
  drawPixelShadow(ctx, -10, 12, 10, P);
  ctx.globalAlpha = 1;

  // 반투명 (스텔스 효과) - 더 강하게
  const stealth = 0.5 + Math.sin(t / 300) * 0.25;
  ctx.globalAlpha = isHit ? 1 : stealth;

  if (isHit) {
    drawPixelRectWithBlackOutline(ctx, -5 * P, -6 * P, 5, 7, P, CYBER_PALETTE.white);
  } else {
    switch (disguise) {
      case 0: // 폴더 아이콘 - 검은 아웃라인
        drawBlackOutlineRect(ctx, -5 * P - P, -6 * P - P, 5 + 1, 7 + 1, P);
        drawPixelRect(ctx, -5 * P, -4 * P, 5, 5, P, CYBER_PALETTE.alertLight);
        drawPixelRect(ctx, -5 * P, -6 * P, 3, 2, P, CYBER_PALETTE.brightOrange);
        drawPixelRectOutline(ctx, -5 * P, -4 * P, 5, 5, P, CYBER_PALETTE.brightOrange);
        break;
      case 1: // 문서 아이콘 - 검은 아웃라인
        drawBlackOutlineRect(ctx, -4 * P - P, -5 * P - P, 4 + 1, 6 + 1, P);
        drawPixelRect(ctx, -4 * P, -5 * P, 4, 6, P, CYBER_PALETTE.white);
        drawPixelLineH(ctx, -3 * P, -3 * P, 3, P, CYBER_PALETTE.metalMid);
        drawPixelLineH(ctx, -3 * P, -1 * P, 3, P, CYBER_PALETTE.metalMid);
        drawPixelLineH(ctx, -3 * P, P, 2, P, CYBER_PALETTE.metalMid);
        break;
      case 2: // 시스템 파일 - 검은 아웃라인
        drawBlackOutlineRect(ctx, -4 * P - P, -5 * P - P, 4 + 1, 6 + 1, P);
        drawPixelRect(ctx, -4 * P, -5 * P, 4, 6, P, CYBER_PALETTE.metalMid);
        drawPixelCircleWithBlackOutline(ctx, 0, -2 * P, 2, P, CYBER_PALETTE.metalLight);
        drawPixel(ctx, 0, -2 * P, P, CYBER_PALETTE.brightCyan);
        break;
    }

    // v8.0: 숨겨진 악성 코드 힌트 (글리치) - 더 강하게
    if (Math.floor(t / 400) % 5 === 0) {
      drawGlitchNoise(ctx, -5 * P, -6 * P, 5, 7, P, seed + t, 0.35);
    }

    // v8.0: 은밀한 눈 (가끔 나타남) - 더 밝게
    if (Math.floor(t / 600) % 3 === 0) {
      drawPixel(ctx, -2 * P, -2 * P, P, CYBER_PALETTE.brightRed);
      drawPixel(ctx, P, -2 * P, P, CYBER_PALETTE.brightRed);
    }

    // v8.0: 스텔스 깜빡임 이펙트
    if (Math.floor(t / 800) % 4 === 0) {
      drawPixel(ctx, -5 * P, -5 * P, P, CYBER_PALETTE.brightRed);
    }
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

/**
 * APT - 지능형 지속 위협
 * v8.0: 검은 아웃라인 + 선명한 드론/스캔 디자인
 */
export function drawPixelAPT(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = getFrameTime();
  const P = 2;
  const hover = Math.sin(t / 250) * 2;
  const scanAngle = (t / 100) % 360;

  ctx.save();
  ctx.translate(0, hover);

  // 그림자
  drawPixelShadow(ctx, -14, 14 - hover / 2, 14, P);

  if (isHit) {
    // 육각형 근사 (사각형으로)
    drawPixelRectWithBlackOutline(ctx, -6 * P, -5 * P, 6, 5, P, CYBER_PALETTE.white);
  } else {
    // v8.0: 검은 아웃라인 육각형 드론 바디
    drawBlackOutlineRect(ctx, -5 * P - P, -5 * P - P, 5 + 1, 6 + 1, P);
    drawPixelRect(ctx, -5 * P, -4 * P, 5, 4, P, CYBER_PALETTE.metalMid);
    drawPixelRect(ctx, -4 * P, -5 * P, 4, 1, P, CYBER_PALETTE.metalMid);
    drawPixelRect(ctx, -4 * P, 3 * P, 4, 1, P, CYBER_PALETTE.metalMid);
    drawPixelRectOutline(ctx, -5 * P, -4 * P, 5, 4, P, CYBER_PALETTE.brightCyan);

    // v8.0: 중앙 센서 - 검은 아웃라인
    drawPixelCircleWithBlackOutline(ctx, 0, 0, 2, P, CYBER_PALETTE.dataMid);
    const scanOn = Math.floor(t / 150) % 2 === 0;
    drawPixel(ctx, 0, 0, P, scanOn ? CYBER_PALETTE.brightCyan : CYBER_PALETTE.dataDark);

    // v8.0: 스캔 빔 (회전) - 더 선명하게
    const beamLength = 6;
    const beamX = Math.cos(scanAngle * Math.PI / 180) * beamLength * P;
    const beamY = Math.sin(scanAngle * Math.PI / 180) * beamLength * P;
    ctx.globalAlpha = 0.7;
    drawPixelLineH(ctx, 0, 0, 1, P, CYBER_PALETTE.dataLight);
    drawPixelRectWithBlackOutline(ctx, beamX - P / 2, beamY - P / 2, 1, 1, P, CYBER_PALETTE.brightCyan);
    ctx.globalAlpha = 1;

    // v8.0: 안테나 - 검은 아웃라인
    drawPixelRectWithBlackOutline(ctx, -3 * P, -7 * P, 1, 2, P, CYBER_PALETTE.metalLight);
    drawPixelRectWithBlackOutline(ctx, 2 * P, -7 * P, 1, 2, P, CYBER_PALETTE.metalLight);
    // 안테나 끝 LED
    drawPixel(ctx, -3 * P, -8 * P, P, CYBER_PALETTE.brightCyan);
    drawPixel(ctx, 2 * P, -8 * P, P, CYBER_PALETTE.brightCyan);

    // v8.0: 추진기 (아래) - 더 밝게
    const thrusterOn = Math.floor(t / 80) % 2 === 0;
    drawPixelRectWithBlackOutline(ctx, -2 * P, 4 * P, 1, 2, P, thrusterOn ? CYBER_PALETTE.brightCyan : CYBER_PALETTE.dataDark);
    drawPixelRectWithBlackOutline(ctx, P, 4 * P, 1, 2, P, thrusterOn ? CYBER_PALETTE.brightCyan : CYBER_PALETTE.dataDark);

    // v8.0: 추가 장갑 디테일
    drawPixelLineH(ctx, -4 * P, -2 * P, 4, P, CYBER_PALETTE.metalLight);
    drawPixelLineH(ctx, -4 * P, P, 4, P, CYBER_PALETTE.metalLight);
  }

  ctx.restore();
}

// =====================================================
// Era 6: 최종 위협 (Zeroday, Skynet)
// =====================================================

/**
 * ZERODAY - 제로데이 익스플로잇
 * v8.0: 검은 아웃라인 + 선명한 불안정 쉘 디자인
 */
export function drawPixelZeroday(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = getFrameTime();
  const seed = (enemy.id || 0) + getSeedBase();
  const P = 2;

  ctx.save();

  // 불안정한 흔들림
  const shake = (deterministicRandom(seed + Math.floor(t / 30)) - 0.5) * 4;
  ctx.translate(shake, shake * 0.5);

  // 그림자 (불안정)
  ctx.globalAlpha = 0.4 + Math.sin(t / 100) * 0.2;
  drawPixelShadow(ctx, -12, 14, 12, P);
  ctx.globalAlpha = 1;

  if (isHit) {
    drawPixelCircleWithBlackOutline(ctx, 0, 0, 5, P, CYBER_PALETTE.white);
  } else {
    // v8.0: 검은 아웃라인 불안정한 쉘
    drawPixelCircleWithBlackOutline(ctx, 0, 0, 5, P, CYBER_PALETTE.codeMid);
    drawPixelCircleOutline(ctx, 0, 0, 5, P, CYBER_PALETTE.neonPink);

    // v8.0: 글리치 테두리 - 더 선명하게
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + t / 200;
      const dist = 5 + (deterministicRandom(seed + i + Math.floor(t / 100)) - 0.5) * 2;
      const px = Math.cos(angle) * dist * P;
      const py = Math.sin(angle) * dist * P;
      drawPixelRectWithBlackOutline(ctx, px - P / 2, py - P / 2, 1, 1, P, CYBER_PALETTE.neonPink);
    }

    // v8.0: "?" 심볼 - 더 밝게
    drawPixelCircleOutline(ctx, 0, -2 * P, 2, P, CYBER_PALETTE.white);
    drawPixel(ctx, P, -P, P, CYBER_PALETTE.white);
    drawPixel(ctx, 0, 2 * P, P, CYBER_PALETTE.white);

    // v8.0: 익스플로잇 코드 (랜덤 바이너리) - 더 밝은 색상
    for (let i = 0; i < 4; i++) {
      const codeX = (deterministicRandom(seed + i * 7 + Math.floor(t / 150)) - 0.5) * 12 * P;
      const codeY = (deterministicRandom(seed + i * 13 + Math.floor(t / 150)) - 0.5) * 12 * P;
      drawBinaryText(ctx, codeX, codeY, P, seed + i + t, CYBER_PALETTE.codeLight);
    }

    // 글리치 노이즈 - 더 강하게
    drawGlitchNoise(ctx, -6 * P, -6 * P, 6, 6, P, seed + t, 0.25);

    // v8.0: 경고 깜빡임
    if (Math.floor(t / 150) % 2 === 0) {
      drawPixel(ctx, -6 * P, 0, P, CYBER_PALETTE.brightRed);
      drawPixel(ctx, 5 * P, 0, P, CYBER_PALETTE.brightRed);
    }
  }

  ctx.restore();
}

/**
 * SKYNET - AI 지배자
 * v8.0: 검은 아웃라인 + 선명한 피라미드/HAL 9000 디자인
 */
export function drawPixelSkynet(
  ctx: CanvasRenderingContext2D,
  enemy: EnemyRenderData,
  isHit: boolean
): void {
  const t = getFrameTime();
  const P = 2;
  const pulse = Math.sin(t / 200);

  ctx.save();

  // 그림자
  drawPixelShadow(ctx, -18, 18, 18, P);

  if (isHit) {
    // 피라미드 형태 - 검은 아웃라인
    for (let row = 0; row < 6; row++) {
      const rowWidth = 6 - row;
      drawPixelRectWithBlackOutline(ctx, (-rowWidth / 2) * 2 * P, (-6 + row * 2) * P, rowWidth, 1, P, CYBER_PALETTE.white);
    }
  } else {
    // v8.0: 검은 아웃라인 피라미드 서버
    // 검은 아웃라인 먼저
    for (let row = 0; row < 6; row++) {
      const rowWidth = 6 - row;
      drawBlackOutlineRect(ctx, (-rowWidth / 2) * 2 * P - P, (-6 + row * 2) * P - P, rowWidth + 1, 1 + 1, P);
    }

    // 피라미드 색상
    const colors = [CYBER_PALETTE.virusMid, CYBER_PALETTE.virusLight, CYBER_PALETTE.virusMid];
    for (let row = 0; row < 6; row++) {
      const rowWidth = 6 - row;
      const color = colors[row % 3];
      drawPixelRect(ctx, (-rowWidth / 2) * 2 * P, (-6 + row * 2) * P, rowWidth, 1, P, color);
    }

    // v8.0: 피라미드 테두리 - 더 밝게
    for (let row = 0; row < 6; row++) {
      const rowWidth = 6 - row;
      const leftX = (-rowWidth / 2) * 2 * P;
      const rightX = (rowWidth / 2 - 1) * 2 * P;
      const y = (-6 + row * 2) * P;
      drawPixel(ctx, leftX, y, P, CYBER_PALETTE.brightRed);
      drawPixel(ctx, rightX, y, P, CYBER_PALETTE.brightRed);
    }

    // v8.0: HAL 9000 눈 (중앙) - 검은 아웃라인
    drawPixelCircleWithBlackOutline(ctx, 0, 0, 3, P, CYBER_PALETTE.pureBlack);
    drawPixelCircleOutline(ctx, 0, 0, 3, P, CYBER_PALETTE.brightRed);

    // 눈 내부 (펄스) - 더 밝게
    const eyeIntensity = 0.6 + pulse * 0.35;
    ctx.globalAlpha = eyeIntensity;
    drawPixelCircle(ctx, 0, 0, 2, P, CYBER_PALETTE.virusLight);
    drawPixel(ctx, 0, 0, P, CYBER_PALETTE.white);
    ctx.globalAlpha = 1;

    // v8.0: 데이터 레이어 (회전) - 검은 아웃라인
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + t / 300;
      const dist = 8 + Math.sin(t / 150 + i) * 2;
      const px = Math.cos(angle) * dist * P;
      const py = Math.sin(angle) * dist * P;
      drawPixelRectWithBlackOutline(ctx, px - P / 2, py - P / 2, 1, 1, P, CYBER_PALETTE.virusLight);
    }

    // v8.0: 연결된 네트워크 노드 - 검은 아웃라인
    const nodePositions = [[-10, -8], [10, -8], [-12, 4], [12, 4], [0, 10]];
    for (let i = 0; i < nodePositions.length; i++) {
      const nx = nodePositions[i][0] * P;
      const ny = nodePositions[i][1] * P;
      drawPixelRectWithBlackOutline(ctx, nx - P / 2, ny - P / 2, 1, 1, P, CYBER_PALETTE.virusMid);

      // 연결선 (데이터 전송) - 더 밝게
      const dataPos = (t / 50 + i * 30) % 100 / 100;
      const dx = nx * (1 - dataPos);
      const dy = ny * (1 - dataPos);
      drawPixel(ctx, dx, dy, P, CYBER_PALETTE.brightRed);
    }

    // v8.0: "SKYNET" 텍스트 (하단) - 검은 아웃라인
    drawPixelRectWithBlackOutline(ctx, -4 * P, 8 * P, 4, 1, P, CYBER_PALETTE.brightRed);

    // v8.0: 추가 경고 깜빡임
    if (Math.floor(t / 200) % 2 === 0) {
      drawPixel(ctx, -8 * P, 0, P, CYBER_PALETTE.brightRed);
      drawPixel(ctx, 7 * P, 0, P, CYBER_PALETTE.brightRed);
    }
  }

  ctx.restore();
}

