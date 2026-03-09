/**
 * useCombo.ts - 콤보 카운터 시스템 훅
 * CODE SURVIVOR - The Matrix meets Developer Survival
 */

import { useCallback, useRef } from 'react';
import { ComboState, ComboTier, ComboEffect } from '../types';
import {
  COMBO_CONFIG,
  COMBO_TIER_ORDER,
  getComboTier,
  createInitialComboState
} from '../config/combo.config';
import { soundManager } from '../utils/audio';

export interface ComboScreenShake {
  intensity: number;  // 0-1
  duration: number;   // seconds
}

export interface ComboKillResult {
  tierUp: boolean;
  from?: string;
  to?: string;
  screenShake?: ComboScreenShake;  // 화면 쉐이크 정보
}

export interface UseComboReturn {
  comboRef: React.MutableRefObject<ComboState>;
  registerKill: () => ComboKillResult;
  resetCombo: (reason?: 'hit' | 'timeout' | 'manual') => void;
  updateCombo: (deltaTime: number) => void;
  getMultipliers: () => { xp: number; speed: number; damage: number };
  isScreenClearActive: () => boolean;
}

export function useCombo(): UseComboReturn {
  const comboRef = useRef<ComboState>(createInitialComboState());

  // 티어업 체크 및 효과 적용
  const checkTierUp = useCallback((): ComboKillResult => {
    const combo = comboRef.current;
    const newTier = getComboTier(combo.count);
    const newTierIndex = COMBO_TIER_ORDER.indexOf(newTier);

    if (newTier !== combo.tier && newTierIndex > COMBO_TIER_ORDER.indexOf(combo.tier)) {
      const oldTier = combo.tier;
      combo.tier = newTier;
      combo.tierUpAnimation = 1; // 애니메이션 시작

      // 화면 쉐이크 강도 계산 (티어별)
      // Bronze(1): 0.2, Silver(2): 0.25, Gold(3): 0.3, Diamond(4): 0.4
      // Platinum(5): 0.5, Master(6): 0.6, Grandmaster(7): 0.7
      // Legend(8): 0.8, Mythic(9): 0.9, Transcendent(10): 1.0
      const shakeIntensity = Math.min(1.0, 0.15 + newTierIndex * 0.085);
      const shakeDuration = Math.min(0.5, 0.15 + newTierIndex * 0.035);

      // 효과 적용
      if (newTier !== 'none') {
        const tierConfig = COMBO_CONFIG.tiers[newTier];
        const effect = tierConfig.effect;

        // 배율 업데이트
        if (effect.type === 'xp') {
          combo.multipliers.xp = 1 + effect.value;
        } else if (effect.type === 'speed') {
          combo.multipliers.speed = 1 + effect.value;
        } else if (effect.type === 'damage') {
          combo.multipliers.damage = 1 + effect.value;
        }

        // 효과 배열에 추가
        combo.effects.push({ ...effect } as ComboEffect);

        // 티어업 사운드 재생 - 도파민 피드백!
        // 티어별로 차별화된 사운드
        if (newTierIndex >= 9) {
          soundManager.playSFX('cash');  // Mythic/Transcendent
        } else if (newTierIndex >= 7) {
          soundManager.playSFX('levelup');  // Grandmaster/Legend
        } else if (newTierIndex >= 5) {
          soundManager.playSFX('powerup');  // Master/Platinum
        } else if (newTier === 'diamond') {
          soundManager.playSFX('cash');
        } else if (newTier === 'gold') {
          soundManager.playSFX('levelup');
        } else {
          soundManager.playSFX('combo');
        }
      }

      return {
        tierUp: true,
        from: oldTier,
        to: newTier,
        screenShake: { intensity: shakeIntensity, duration: shakeDuration }
      };
    }

    return { tierUp: false };
  }, []);

  // 킬 등록
  const registerKill = useCallback((): ComboKillResult => {
    const combo = comboRef.current;

    // 콤보 증가
    combo.count += 1;
    combo.timer = combo.maxTimer;
    combo.lastKillTime = Date.now();

    // 최고 콤보 갱신
    if (combo.count > combo.maxCount) {
      combo.maxCount = combo.count;
    }

    // 티어업 체크
    const tierResult = checkTierUp();

    // 티어업이 발생하면 티어업 쉐이크 반환
    if (tierResult.tierUp) {
      return tierResult;
    }

    // 마일스톤 체크 - 특정 콤보 달성 시 추가 피드백
    const count = combo.count;

    // 천 단위 마일스톤 (1000, 2000, ...) - 가장 강한 쉐이크
    if (COMBO_CONFIG.thousandMilestones?.includes(count)) {
      soundManager.playSFX('levelup');
      return {
        tierUp: false,
        screenShake: { intensity: 0.9, duration: 0.4 }  // 천 단위 대형 쉐이크
      };
    }

    // 백 단위 마일스톤 (100, 200, ...) - 중간 쉐이크
    if (COMBO_CONFIG.hundredMilestones?.includes(count)) {
      soundManager.playSFX('powerup');
      return {
        tierUp: false,
        screenShake: { intensity: 0.5, duration: 0.25 }  // 백 단위 중형 쉐이크
      };
    }

    // 일반 마일스톤 (10, 25, 50, ...) - 가벼운 쉐이크
    if (COMBO_CONFIG.milestones.includes(count)) {
      soundManager.playSFX('click');
      return {
        tierUp: false,
        screenShake: { intensity: 0.25, duration: 0.15 }  // 소형 쉐이크
      };
    }

    return { tierUp: false };
  }, [checkTierUp]);

  // 콤보 리셋
  const resetCombo = useCallback((reason: 'hit' | 'timeout' | 'manual' = 'manual') => {
    const combo = comboRef.current;

    // 이미 0이면 무시
    if (combo.count === 0) return;

    // 리셋 전 상태 저장 (연출용)
    const previousCount = combo.count;
    const previousTier = combo.tier;

    // 리셋
    combo.count = 0;
    combo.timer = 0;
    combo.tier = 'none';
    combo.multipliers = { xp: 1, speed: 1, damage: 1 };
    combo.effects = [];
    combo.tierUpAnimation = 0;

    // 피격으로 콤보 끊길 때 사운드 피드백 (5콤보 이상일 때만)
    if (reason === 'hit' && previousCount >= 5) {
      soundManager.playSFX('hit');
    }

    return { previousCount, previousTier };
  }, []);

  // 매 프레임 업데이트
  const updateCombo = useCallback((deltaTime: number) => {
    const combo = comboRef.current;

    // 콤보가 있을 때만 타이머 감소
    if (combo.count > 0 && combo.timer > 0) {
      combo.timer -= deltaTime;

      // 타이머 만료 시 리셋
      if (combo.timer <= 0) {
        resetCombo('timeout');
      }
    }

    // 티어업 애니메이션 업데이트
    if (combo.tierUpAnimation > 0) {
      combo.tierUpAnimation -= deltaTime / COMBO_CONFIG.visual.tierUpDuration;
      if (combo.tierUpAnimation < 0) combo.tierUpAnimation = 0;
    }

    // 일시 효과 (screenClear, invincible) 시간 감소
    for (let i = combo.effects.length - 1; i >= 0; i--) {
      const effect = combo.effects[i];
      if (effect.duration !== undefined && effect.duration > 0) {
        effect.duration -= deltaTime;
        if (effect.duration <= 0) {
          effect.isActive = false;
        }
      }
    }
  }, [resetCombo]);

  // 현재 배율 반환
  const getMultipliers = useCallback(() => {
    return { ...comboRef.current.multipliers };
  }, []);

  // 화면 정리 효과 활성화 여부
  const isScreenClearActive = useCallback(() => {
    const combo = comboRef.current;
    return combo.effects.some(
      e => e.type === 'screenClear' && e.isActive && (e.duration ?? 0) > 0
    );
  }, []);

  return {
    comboRef,
    registerKill,
    resetCombo,
    updateCombo,
    getMultipliers,
    isScreenClearActive
  };
}
