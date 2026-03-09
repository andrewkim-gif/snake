/**
 * useV3Systems.ts - v3 리듬 서바이벌 통합 훅
 * 콤보, 데이터 버스트, 코드 리뷰 챌린지 시스템을 통합 관리
 * CODE SURVIVOR v4.0 - AI vs Programmer
 */

import { useCallback, useRef } from 'react';
import { V3GameSystems } from '../types';
import { useCombo, UseComboReturn } from './useCombo';
import { useBreakTime, UseBreakTimeReturn, BreakTimeEvent } from './useBreakTime';
import { useQuizChallenge, UseQuizChallengeReturn, QuizEvent } from './useQuizChallenge';
import { createInitialComboState } from '../config/combo.config';
import { createInitialBreakTimeState } from '../config/breaktime.config';
import { createInitialQuizState } from '../config/quiz.config';

export interface V3SystemEvents {
  combo?: {
    tierUp?: boolean;
    from?: string;
    to?: string;
    screenShake?: { intensity: number; duration: number };  // 화면 쉐이크 정보
  };
  breakTime?: BreakTimeEvent | null;
  quiz?: QuizEvent | null;
}

export interface UseV3SystemsReturn {
  // 개별 시스템
  combo: UseComboReturn;
  breakTime: UseBreakTimeReturn;
  quiz: UseQuizChallengeReturn;

  // 통합 상태
  v3State: React.MutableRefObject<V3GameSystems>;

  // 통합 메서드
  updateAll: (deltaTime: number, gameTime: number, playerLevel: number) => V3SystemEvents;
  onKill: () => V3SystemEvents;
  onPlayerHit: () => void;
  onBossDamage: (damagePercent: number) => void;
  resetAll: () => void;

  // 통합 배율 조회
  getSpeedMultiplier: () => number;
  getDamageMultiplier: () => number;
  getXpMultiplier: () => number;
  getSpawnMultiplier: () => number;
}

export function useV3Systems(): UseV3SystemsReturn {
  // 개별 훅 초기화
  const combo = useCombo();
  const breakTime = useBreakTime();
  const quiz = useQuizChallenge();

  // 통합 상태 ref
  const v3State = useRef<V3GameSystems>({
    combo: createInitialComboState(),
    breakTime: createInitialBreakTimeState(),
    quiz: createInitialQuizState()
  });

  // 매 프레임 업데이트
  const updateAll = useCallback((
    deltaTime: number,
    gameTime: number,
    playerLevel: number
  ): V3SystemEvents => {
    const events: V3SystemEvents = {};

    // 콤보 업데이트
    combo.updateCombo(deltaTime);

    // 데이터 버스트 업데이트
    events.breakTime = breakTime.updateBreakTime(deltaTime, gameTime);

    // 코드 리뷰 챌린지 업데이트
    events.quiz = quiz.updateQuiz(deltaTime, playerLevel);

    // 콤보를 코드 리뷰에 등록
    if (combo.comboRef.current.count > 0) {
      quiz.registerCombo(combo.comboRef.current.count);
    }

    // 상태 동기화
    v3State.current = {
      combo: combo.comboRef.current,
      breakTime: breakTime.breakTimeRef.current,
      quiz: quiz.quizRef.current
    };

    return events;
  }, [combo, breakTime, quiz]);

  // 킬 처리
  const onKill = useCallback((): V3SystemEvents => {
    const events: V3SystemEvents = {};

    // 콤보 등록
    const comboResult = combo.registerKill();
    // 티어업 또는 마일스톤 이벤트가 있으면 반환 (screenShake 포함)
    if (comboResult.tierUp || comboResult.screenShake) {
      events.combo = comboResult;
    }

    // 버스트 게이지 충전
    breakTime.registerKill();

    // 코드 리뷰 킬 등록
    quiz.registerKill();

    return events;
  }, [combo, breakTime, quiz]);

  // 플레이어 피격 처리
  const onPlayerHit = useCallback(() => {
    // 콤보 리셋
    combo.resetCombo('hit');

    // 코드 리뷰 피격 등록
    quiz.registerHit();
  }, [combo, quiz]);

  // 보스 데미지 처리
  const onBossDamage = useCallback((damagePercent: number) => {
    quiz.registerBossDamage(damagePercent);
  }, [quiz]);

  // 전체 리셋
  const resetAll = useCallback(() => {
    combo.resetCombo('manual');
    combo.comboRef.current = createInitialComboState();
    breakTime.reset();
    quiz.reset();

    v3State.current = {
      combo: createInitialComboState(),
      breakTime: createInitialBreakTimeState(),
      quiz: createInitialQuizState()
    };
  }, [combo, breakTime, quiz]);

  // 속도 배율 (콤보 + 페널티)
  const getSpeedMultiplier = useCallback(() => {
    const comboMult = combo.getMultipliers().speed;
    const penaltyMult = quiz.getPenaltyMultiplier();
    return comboMult * penaltyMult;
  }, [combo, quiz]);

  // 데미지 배율 (콤보)
  const getDamageMultiplier = useCallback(() => {
    return combo.getMultipliers().damage;
  }, [combo]);

  // 경험치 배율 (콤보 + 쉬는시간)
  const getXpMultiplier = useCallback(() => {
    const comboMult = combo.getMultipliers().xp;
    const breakMult = breakTime.getMultipliers().xp;
    return comboMult * breakMult;
  }, [combo, breakTime]);

  // 스폰 배율 (쉬는시간)
  const getSpawnMultiplier = useCallback(() => {
    return breakTime.getMultipliers().spawn;
  }, [breakTime]);

  return {
    combo,
    breakTime,
    quiz,
    v3State,
    updateAll,
    onKill,
    onPlayerHit,
    onBossDamage,
    resetAll,
    getSpeedMultiplier,
    getDamageMultiplier,
    getXpMultiplier,
    getSpawnMultiplier
  };
}

export default useV3Systems;
