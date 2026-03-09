/**
 * comboCanvas.ts - Canvas 기반 콤보 카운터 렌더링
 * v7.x - 캐릭터 머리 위에 콤보 표시
 *
 * 기존 ComboCounter.tsx (React 컴포넌트)와 달리
 * Canvas에서 직접 렌더링하여 캐릭터와 함께 이동
 */

import { ComboState, ComboTier } from '../../types';
import { COMBO_CONFIG, COMBO_TIER_ORDER, getTierIndex, formatComboNumber } from '../../config/arena.config';
import type { TranslationKeys } from '../../types';

/**
 * 캐릭터 머리 위에 콤보 카운터 렌더링
 * @param ctx - Canvas 2D context
 * @param combo - 콤보 상태
 * @param offsetY - 캐릭터 머리 위 오프셋 (기본: -80)
 * @param t - 번역 객체 (i18n)
 */
export function drawComboAboveCharacter(
  ctx: CanvasRenderingContext2D,
  combo: ComboState,
  offsetY: number = -80,
  t?: TranslationKeys
): void {
  if (combo.count === 0) return;

  const tierConfig = combo.tier !== 'none'
    ? (COMBO_CONFIG.tiers as Record<string, { name: string; color: string; minCount: number; multiplier: number }>)[combo.tier]
    : null;

  const tierColor = tierConfig?.color || '#ffffff';
  const tierIndex = getTierIndex(combo.tier);

  // 크기 계산 (콤보 수에 따라)
  const { base, perCombo, max } = COMBO_CONFIG.visual.sizeScale;
  const scale = Math.min(max, base + combo.count * perCombo);

  // 티어업 애니메이션
  const tierUpScale = (combo.tierUpAnimation ?? 0) > 0
    ? 1 + (combo.tierUpAnimation ?? 0) * 0.3
    : 1;

  const finalScale = scale * tierUpScale;

  ctx.save();

  // 캐릭터 머리 위로 이동 (ctx는 이미 캐릭터 위치로 translate됨)
  ctx.translate(0, offsetY);
  ctx.scale(finalScale, finalScale);

  // 숫자 포맷팅
  const displayNumber = formatComboNumber(combo.count);

  // 폰트 설정
  ctx.font = 'bold 36px "Teko", "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 검은색 아웃라인 (8방향)
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  ctx.strokeText(displayNumber, 0, 0);

  // 글로우 효과 (티어에 따라)
  if (tierIndex >= 3) {
    ctx.shadowColor = tierColor;
    ctx.shadowBlur = 8 + tierIndex * 2;
  }

  // 메인 텍스트
  ctx.fillStyle = tierColor;
  ctx.fillText(displayNumber, 0, 0);

  // COMBO 라벨
  ctx.font = 'bold 14px "Apex Mk2", "Arial", sans-serif';
  ctx.letterSpacing = '0.3em';
  ctx.shadowBlur = 0;

  // 라벨 아웃라인
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.strokeText('COMBO', 0, 20);

  // 라벨 텍스트
  ctx.fillStyle = tierColor;
  ctx.globalAlpha = 0.9;
  ctx.fillText('COMBO', 0, 20);

  // 티어 배지 (티어가 있을 때만)
  if (tierConfig) {
    ctx.globalAlpha = 1;
    ctx.font = 'bold 10px "Apex Mk2", "Arial", sans-serif';

    // i18n 번역 사용, 없으면 config의 name 폴백
    const badgeText: string = (t?.combo?.[combo.tier] as string) || tierConfig.name;
    const textWidth = ctx.measureText(badgeText).width;
    const badgeWidth = textWidth + 12;
    const badgeHeight = 16;
    const badgeY = 36;

    // 배지 배경
    ctx.fillStyle = `${tierColor}40`;
    ctx.strokeStyle = `${tierColor}80`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(-badgeWidth / 2, badgeY - badgeHeight / 2, badgeWidth, badgeHeight, 2);
    ctx.fill();
    ctx.stroke();

    // 배지 텍스트
    ctx.fillStyle = tierColor;
    ctx.fillText(badgeText, 0, badgeY);
  }

  ctx.restore();
}

/**
 * 콤보 타이머 바 렌더링 (선택적)
 * @param ctx - Canvas 2D context
 * @param combo - 콤보 상태
 * @param offsetY - 캐릭터 머리 위 오프셋
 */
export function drawComboTimer(
  ctx: CanvasRenderingContext2D,
  combo: ComboState,
  offsetY: number = -50
): void {
  if (combo.count === 0 || combo.timer <= 0) return;

  const tierConfig = combo.tier !== 'none'
    ? (COMBO_CONFIG.tiers as Record<string, { name: string; color: string; minCount: number; multiplier: number }>)[combo.tier]
    : null;

  const tierColor = tierConfig?.color || '#ffffff';
  const timerPercent = combo.timer / COMBO_CONFIG.maxTimer;

  const barWidth = 60;
  const barHeight = 4;

  ctx.save();
  ctx.translate(0, offsetY);

  // 배경 바
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(-barWidth / 2, 0, barWidth, barHeight);

  // 타이머 바
  ctx.fillStyle = tierColor;
  ctx.fillRect(-barWidth / 2, 0, barWidth * timerPercent, barHeight);

  ctx.restore();
}
