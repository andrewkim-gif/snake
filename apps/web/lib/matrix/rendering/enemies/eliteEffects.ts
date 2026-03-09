/**
 * eliteEffects.ts - Elite Monster Visual Effects (v7.15)
 *
 * 엘리트 몬스터 렌더링 효과:
 * - 글로우 효과 (티어별 색상)
 * - 펄스 애니메이션
 * - 티어 표시기
 */

import { ELITE_TIER_CONFIGS } from '../../config/enemies.config';
import { EliteTier } from '../../types';
import { shouldUseGlow } from './renderContext';

// =====================================================
// 엘리트 글로우 효과 렌더링
// =====================================================

/**
 * 엘리트 몬스터의 글로우 효과를 그립니다.
 * 몬스터 렌더링 전에 호출하여 백그라운드 글로우를 그립니다.
 */
export const drawEliteGlowBackground = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  tier: EliteTier,
  pulseValue: number // 0-1
): void => {
  // LOD 체크 - 엔티티 많으면 글로우 비활성화
  if (!shouldUseGlow()) return;

  const config = ELITE_TIER_CONFIGS[tier];
  const glowRadius = radius * 2.5;
  const alpha = 0.3 + pulseValue * 0.4 * config.glowIntensity;

  ctx.save();

  // 외부 글로우 (부드러운 그라데이션)
  const gradient = ctx.createRadialGradient(x, y, radius * 0.5, x, y, glowRadius);
  gradient.addColorStop(0, `${config.glowColor}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`);
  gradient.addColorStop(0.5, `${config.glowColor}${Math.floor(alpha * 0.5 * 255).toString(16).padStart(2, '0')}`);
  gradient.addColorStop(1, `${config.glowColor}00`);

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
};

/**
 * 엘리트 몬스터 주변에 회전하는 파티클 효과를 그립니다.
 */
export const drawEliteParticles = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  tier: EliteTier,
  time: number
): void => {
  // LOD 체크
  if (!shouldUseGlow()) return;

  const config = ELITE_TIER_CONFIGS[tier];
  const particleCount = tier === 'diamond' ? 6 : tier === 'gold' ? 4 : 3;
  const orbitRadius = radius * 1.5;

  ctx.save();

  for (let i = 0; i < particleCount; i++) {
    const angle = (time / 1000) * 2 + (Math.PI * 2 * i) / particleCount;
    const px = x + Math.cos(angle) * orbitRadius;
    const py = y + Math.sin(angle) * orbitRadius;
    const particleSize = tier === 'diamond' ? 4 : tier === 'gold' ? 3 : 2;

    // 파티클 글로우
    ctx.shadowColor = config.glowColor;
    ctx.shadowBlur = 8;

    ctx.fillStyle = config.glowColor;
    ctx.beginPath();
    ctx.arc(px, py, particleSize, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.shadowBlur = 0;
  ctx.restore();
};

/**
 * 엘리트 몬스터 티어 표시기를 그립니다.
 * 몬스터 머리 위에 작은 아이콘으로 표시.
 */
export const drawEliteTierIndicator = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  tier: EliteTier
): void => {
  const config = ELITE_TIER_CONFIGS[tier];
  const indicatorY = y - radius - 12;

  ctx.save();

  // 배경 원
  ctx.fillStyle = '#000000aa';
  ctx.beginPath();
  ctx.arc(x, indicatorY, 8, 0, Math.PI * 2);
  ctx.fill();

  // 테두리
  ctx.strokeStyle = config.glowColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, indicatorY, 8, 0, Math.PI * 2);
  ctx.stroke();

  // 티어 심볼
  ctx.fillStyle = config.glowColor;
  ctx.font = 'bold 10px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const symbol = tier === 'diamond' ? '◇' : tier === 'gold' ? '★' : '●';
  ctx.fillText(symbol, x, indicatorY);

  ctx.restore();
};

// =====================================================
// 통합 엘리트 효과 렌더링 함수
// =====================================================

export interface EliteRenderParams {
  ctx: CanvasRenderingContext2D;
  x: number;
  y: number;
  radius: number;
  tier: EliteTier;
  glowValue: number; // 0-1 펄스 값
  time: number;
}

/**
 * 엘리트 몬스터의 모든 시각 효과를 한 번에 그립니다.
 * 몬스터 렌더링 전에 호출 (백그라운드 레이어)
 */
export const drawEliteEffects = (params: EliteRenderParams): void => {
  const { ctx, x, y, radius, tier, glowValue, time } = params;

  // 1. 배경 글로우
  drawEliteGlowBackground(ctx, x, y, radius, tier, glowValue);

  // 2. 회전 파티클 (Diamond/Gold만)
  if (tier !== 'silver') {
    drawEliteParticles(ctx, x, y, radius, tier, time);
  }

  // 3. 티어 표시기
  drawEliteTierIndicator(ctx, x, y, radius, tier);
};

/**
 * 엘리트 몬스터의 펄스 값을 계산합니다.
 */
export const calculateElitePulse = (time: number, tier: EliteTier): number => {
  const config = ELITE_TIER_CONFIGS[tier];
  const speed = tier === 'diamond' ? 4 : tier === 'gold' ? 3 : 2;
  const pulse = (Math.sin(time / 1000 * speed) + 1) / 2;
  return pulse * config.glowIntensity;
};
