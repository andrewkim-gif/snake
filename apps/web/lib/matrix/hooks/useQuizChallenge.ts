/**
 * useQuizChallenge.ts - 코드 리뷰 챌린지 시스템 훅
 * CODE SURVIVOR v4.0 - AI vs Programmer
 */

import { useCallback, useRef } from 'react';
import { QuizChallenge, QuizState } from '../types';
import {
  QUIZ_CONFIG,
  createInitialQuizState,
  getRandomQuizInterval,
  generateQuizChallenge
} from '../config/quiz.config';
import { soundManager } from '../utils/audio';

export interface QuizEvent {
  type: 'appear' | 'progress' | 'success' | 'fail' | 'expire';
  challenge?: QuizChallenge;
  reward?: any;
}

export interface UseQuizChallengeReturn {
  quizRef: React.MutableRefObject<QuizState>;
  updateQuiz: (deltaTime: number, playerLevel: number) => QuizEvent | null;
  registerKill: () => void;
  registerCombo: (combo: number) => void;
  registerHit: () => void;
  registerBossDamage: (damagePercent: number) => void;
  getActiveChallenge: () => QuizChallenge | null;
  isPenaltyActive: () => boolean;
  getPenaltyMultiplier: () => number;
  reset: () => void;
}

export function useQuizChallenge(): UseQuizChallengeReturn {
  const quizRef = useRef<QuizState>(createInitialQuizState());
  const surviveTimer = useRef<number>(0);
  const noHitTimer = useRef<number>(0);

  // 챌린지 완료 처리
  const completeChallenge = useCallback((success: boolean): QuizEvent => {
    const state = quizRef.current;
    const challenge = state.activeChallenge;

    if (!challenge) return { type: 'expire' };

    // 상태 업데이트
    challenge.status = success ? 'success' : 'failed';

    // 기록 저장
    state.history.unshift({ ...challenge });
    if (state.history.length > QUIZ_CONFIG.maxHistory) {
      state.history.pop();
    }

    // 통계 업데이트
    if (success) {
      state.completedCount += 1;
      // TODO: v3 사운드 추가 후 활성화
      // soundManager.playSFX('fanfare');
    } else {
      state.failedCount += 1;
      state.isPenaltyActive = true;
      state.penaltyTimer = QUIZ_CONFIG.failurePenalty.duration;
      // TODO: v3 사운드 추가 후 활성화
      // soundManager.playSFX('gameover');
    }

    // 다음 챌린지 예약
    state.nextChallengeIn = getRandomQuizInterval();
    state.lastChallengeTime = Date.now();

    const event: QuizEvent = {
      type: success ? 'success' : 'fail',
      challenge: { ...challenge },
      reward: success ? challenge.reward : null
    };

    // 챌린지 클리어
    state.activeChallenge = null;
    surviveTimer.current = 0;
    noHitTimer.current = 0;

    return event;
  }, []);

  // 매 프레임 업데이트
  const updateQuiz = useCallback((deltaTime: number, playerLevel: number): QuizEvent | null => {
    const state = quizRef.current;
    let event: QuizEvent | null = null;

    // 페널티 타이머
    if (state.isPenaltyActive) {
      state.penaltyTimer -= deltaTime;
      if (state.penaltyTimer <= 0) {
        state.isPenaltyActive = false;
        state.penaltyTimer = 0;
      }
    }

    if (state.activeChallenge) {
      const challenge = state.activeChallenge;

      // 타이머 감소
      challenge.remaining -= deltaTime;

      // 타이머 틱 사운드 (마지막 3초)
      // if (challenge.remaining <= QUIZ_CONFIG.visual.timerWarningThreshold &&
      //     challenge.remaining > QUIZ_CONFIG.visual.timerWarningThreshold - deltaTime) {
      //   soundManager.playSFX('click');
      // }

      // 생존 타입 챌린지 처리 (시간 초과 체크보다 먼저!)
      // 목표 달성과 시간 종료가 동시에 발생하면 성공을 우선 처리
      if (challenge.type === 'survive') {
        surviveTimer.current += deltaTime;
        challenge.current = Math.floor(surviveTimer.current);

        if (challenge.current >= challenge.target) {
          event = completeChallenge(true);
        }
      }

      // 무피격 타입 챌린지 처리 (시간 초과 체크보다 먼저!)
      if (challenge.type === 'no_hit') {
        noHitTimer.current += deltaTime;
        challenge.current = Math.floor(noHitTimer.current);

        if (challenge.current >= challenge.target) {
          event = completeChallenge(true);
        }
      }

      // 시간 초과 체크 (성공 조건 체크 후에!)
      // 이미 성공 이벤트가 있거나 챌린지가 완료되었으면 실패 처리 안함
      if (!event && state.activeChallenge && challenge.remaining <= 0) {
        event = completeChallenge(false);
      }
    } else {
      // 다음 챌린지 대기
      state.nextChallengeIn -= deltaTime;

      if (state.nextChallengeIn <= 0) {
        // 새 챌린지 생성
        const newChallenge = generateQuizChallenge(playerLevel);
        state.activeChallenge = newChallenge;
        state.lastChallengeTime = Date.now();
        surviveTimer.current = 0;
        noHitTimer.current = 0;

        // TODO: v3 사운드 추가 후 활성화
        // soundManager.playSFX('alarm');
        event = { type: 'appear', challenge: newChallenge };
      }
    }

    return event;
  }, [completeChallenge]);

  // 킬 등록
  const registerKill = useCallback(() => {
    const challenge = quizRef.current.activeChallenge;
    if (!challenge || challenge.status !== 'active') return;

    if (challenge.type === 'kill') {
      challenge.current += 1;

      // 목표 달성 체크
      if (challenge.current >= challenge.target) {
        completeChallenge(true);
      }
    }
  }, [completeChallenge]);

  // 콤보 등록
  const registerCombo = useCallback((combo: number) => {
    const challenge = quizRef.current.activeChallenge;
    if (!challenge || challenge.status !== 'active') return;

    if (challenge.type === 'combo') {
      challenge.current = Math.max(challenge.current, combo);

      // 목표 달성 체크
      if (challenge.current >= challenge.target) {
        completeChallenge(true);
      }
    }
  }, [completeChallenge]);

  // 피격 등록
  const registerHit = useCallback(() => {
    const challenge = quizRef.current.activeChallenge;
    if (!challenge || challenge.status !== 'active') return;

    // 무피격 챌린지 실패
    if (challenge.type === 'no_hit') {
      completeChallenge(false);
    }
  }, [completeChallenge]);

  // 보스 데미지 등록
  const registerBossDamage = useCallback((damagePercent: number) => {
    const challenge = quizRef.current.activeChallenge;
    if (!challenge || challenge.status !== 'active') return;

    if (challenge.type === 'time_boss') {
      challenge.current += damagePercent;

      // 목표 달성 체크
      if (challenge.current >= challenge.target) {
        completeChallenge(true);
      }
    }
  }, [completeChallenge]);

  // 활성 챌린지 반환
  const getActiveChallenge = useCallback(() => {
    return quizRef.current.activeChallenge;
  }, []);

  // 페널티 활성화 여부
  const isPenaltyActive = useCallback(() => {
    return quizRef.current.isPenaltyActive;
  }, []);

  // 페널티 배율 (속도 감소)
  const getPenaltyMultiplier = useCallback(() => {
    if (quizRef.current.isPenaltyActive) {
      return 1 - QUIZ_CONFIG.failurePenalty.value;
    }
    return 1;
  }, []);

  // 리셋
  const reset = useCallback(() => {
    quizRef.current = createInitialQuizState();
    surviveTimer.current = 0;
    noHitTimer.current = 0;
  }, []);

  return {
    quizRef,
    updateQuiz,
    registerKill,
    registerCombo,
    registerHit,
    registerBossDamage,
    getActiveChallenge,
    isPenaltyActive,
    getPenaltyMultiplier,
    reset
  };
}
