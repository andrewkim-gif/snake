/**
 * useBreakTime.ts - 데이터 버스트 시스템 훅
 * CODE SURVIVOR v4.0 - AI vs Programmer
 */

import { useCallback, useRef } from 'react';
import { BreakTimeState } from '../types';
import {
  BREAK_TIME_CONFIG,
  createInitialBreakTimeState,
  calculateGaugeIncrease
} from '../config/breaktime.config';
import { soundManager } from '../utils/audio';

export interface BreakTimeEvent {
  type: 'warning' | 'start' | 'end' | 'ultimateReady' | 'ultimateUsed';
  data?: any;
}

export interface UseBreakTimeReturn {
  breakTimeRef: React.MutableRefObject<BreakTimeState>;
  updateBreakTime: (deltaTime: number, gameTime: number) => BreakTimeEvent | null;
  registerKill: () => void;
  triggerUltimate: () => boolean;
  getMultipliers: () => { spawn: number; xp: number; gemValue: number };
  isActive: () => boolean;
  isWarning: () => boolean;
  canUseUltimate: () => boolean;
  reset: () => void;
}

export function useBreakTime(): UseBreakTimeReturn {
  const breakTimeRef = useRef<BreakTimeState>(createInitialBreakTimeState());
  const lastWarningSecond = useRef<number>(0);

  // 매 프레임 업데이트
  const updateBreakTime = useCallback((deltaTime: number, gameTime: number): BreakTimeEvent | null => {
    const state = breakTimeRef.current;
    let event: BreakTimeEvent | null = null;

    if (state.isActive) {
      // 데이터 버스트 진행 중
      state.timer -= deltaTime;

      if (state.timer <= 0) {
        // 버스트 종료
        state.isActive = false;
        state.timer = 0;
        state.nextBreakTime = BREAK_TIME_CONFIG.interval;
        state.killsDuringBreak = 0;

        // TODO: v3 사운드 추가 후 활성화
        // soundManager.playSFX('powerup');
        event = { type: 'end' };
      }
    } else if (state.isWarning) {
      // 예고 진행 중
      state.warningTimer -= deltaTime;

      // 초 단위 카운트다운 사운드
      const currentSecond = Math.ceil(state.warningTimer);
      if (currentSecond !== lastWarningSecond.current && currentSecond > 0) {
        lastWarningSecond.current = currentSecond;
        // soundManager.play('tick');
      }

      if (state.warningTimer <= 0) {
        // 버스트 시작
        state.isWarning = false;
        state.isActive = true;
        state.timer = BREAK_TIME_CONFIG.duration;
        state.totalBreaks += 1;
        lastWarningSecond.current = 0;

        // TODO: v3 사운드 추가 후 활성화
        // soundManager.playSFX('fanfare');
        event = { type: 'start' };
      }
    } else {
      // 대기 중
      state.nextBreakTime -= deltaTime;

      if (state.nextBreakTime <= BREAK_TIME_CONFIG.warningTime && !state.isWarning) {
        // 예고 시작
        state.isWarning = true;
        state.warningTimer = BREAK_TIME_CONFIG.warningTime;

        // TODO: v3 사운드 추가 후 활성화
        // soundManager.playSFX('alarm');
        event = { type: 'warning' };
      }
    }

    return event;
  }, []);

  // 킬 등록 (게이지 충전)
  const registerKill = useCallback(() => {
    const state = breakTimeRef.current;
    const gaugeIncrease = calculateGaugeIncrease(state.isActive);

    state.gauge = Math.min(BREAK_TIME_CONFIG.ultimate.maxGauge, state.gauge + gaugeIncrease);

    if (state.isActive) {
      state.killsDuringBreak += 1;
    }

    // 게이지 가득 참
    if (state.gauge >= BREAK_TIME_CONFIG.ultimate.maxGauge && !state.ultimateReady) {
      state.ultimateReady = true;
      // TODO: v3 사운드 추가 후 활성화
      // soundManager.playSFX('powerup');
    }
  }, []);

  // 커널 패닉 궁극기 발동
  const triggerUltimate = useCallback((): boolean => {
    const state = breakTimeRef.current;

    if (!state.ultimateReady || state.gauge < BREAK_TIME_CONFIG.ultimate.maxGauge) {
      return false;
    }

    // 게이지 소모
    state.gauge = 0;
    state.ultimateReady = false;

    // TODO: v3 사운드 추가 후 활성화
    // soundManager.playSFX('explosion');

    return true;
  }, []);

  // 현재 배율 반환
  const getMultipliers = useCallback(() => {
    const state = breakTimeRef.current;

    if (state.isActive) {
      return {
        spawn: BREAK_TIME_CONFIG.effects.spawnMultiplier,
        xp: BREAK_TIME_CONFIG.effects.xpMultiplier,
        gemValue: BREAK_TIME_CONFIG.effects.gemValueMultiplier
      };
    }

    return { spawn: 1, xp: 1, gemValue: 1 };
  }, []);

  // 데이터 버스트 활성화 여부
  const isActive = useCallback(() => {
    return breakTimeRef.current.isActive;
  }, []);

  // 예고 중 여부
  const isWarning = useCallback(() => {
    return breakTimeRef.current.isWarning;
  }, []);

  // 궁극기 사용 가능 여부
  const canUseUltimate = useCallback(() => {
    return breakTimeRef.current.ultimateReady;
  }, []);

  // 리셋
  const reset = useCallback(() => {
    breakTimeRef.current = createInitialBreakTimeState();
    lastWarningSecond.current = 0;
  }, []);

  return {
    breakTimeRef,
    updateBreakTime,
    registerKill,
    triggerUltimate,
    getMultipliers,
    isActive,
    isWarning,
    canUseUltimate,
    reset
  };
}
