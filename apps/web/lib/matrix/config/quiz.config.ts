/**
 * quiz.config.ts - 긴급 미션 챌린지 시스템 설정
 * v3.0 학교생활 리듬 서바이벌 (좀비 세계관)
 */

import { QuizChallenge, QuizChallengeType, QuizDifficulty, QuizReward, QuizState } from '../types';

export const QUIZ_CONFIG = {
  // 기본 설정
  minInterval: 30,           // 최소 간격 (초)
  maxInterval: 60,           // 최대 간격 (초)
  firstQuizDelay: 20,        // 첫 긴급 미션까지 대기 (초)
  maxHistory: 10,            // 기록 보관 개수

  // 실패 페널티
  failurePenalty: {
    type: 'slow',
    value: 0.3,              // 30% 감속
    duration: 5              // 5초간
  },

  // 난이도별 가중치 (레벨에 따라)
  difficultyWeights: {
    early: { easy: 0.7, medium: 0.3, hard: 0 },      // 레벨 1-5
    mid: { easy: 0.3, medium: 0.5, hard: 0.2 },     // 레벨 6-15
    late: { easy: 0.1, medium: 0.4, hard: 0.5 }     // 레벨 16+
  },

  // 시각 효과
  visual: {
    cardWidth: 280,
    cardHeight: 120,
    cardBgColor: '#fef3c7',  // 노란 쪽지 색상
    cardBorderColor: '#d97706',

    // 성공/실패 애니메이션
    successStampColor: '#22c55e',
    failStampColor: '#ef4444',
    stampDuration: 1.0,

    // 진행률 바
    progressBarHeight: 8,
    progressBarColor: '#3b82f6',
    progressBarBgColor: 'rgba(0, 0, 0, 0.2)',

    // 타이머
    timerWarningThreshold: 3,  // 3초 이하 시 빨간색
    timerWarningColor: '#ef4444'
  },

  // 사운드
  sounds: {
    appear: 'quiz_appear',     // 코드 리뷰 등장
    tick: 'quiz_tick',         // 타이머 틱 (마지막 3초)
    success: 'quiz_success',   // 성공 (합격!)
    fail: 'quiz_fail',         // 실패 (불합격...)
    progress: 'quiz_progress'  // 진행도 업데이트
  },

  // 텍스트
  texts: {
    title: {
      ko: '긴급 미션!',
      en: 'Emergency!'
    },
    success: {
      ko: '성공!',
      en: 'SUCCESS!'
    },
    fail: {
      ko: '실패...',
      en: 'FAILED...'
    },
    timeUp: {
      ko: '시간 초과!',
      en: 'Time Up!'
    }
  }
};

// 챌린지 템플릿
export const QUIZ_CHALLENGES: Array<{
  type: QuizChallengeType;
  targetBase: number;
  targetPerLevel: number;
  timeLimit: number;
  difficulty: QuizDifficulty;
  descriptionTemplate: { ko: string; en: string };
  reward: QuizReward;
}> = [
  // Easy
  {
    type: 'kill',
    targetBase: 15,
    targetPerLevel: 1,
    timeLimit: 10,
    difficulty: 'easy',
    descriptionTemplate: {
      ko: '{time}초 내 {target}마리 처치',
      en: 'Kill {target} in {time}s'
    },
    reward: { type: 'xp', value: 100, label: '경험치 +100' }
  },
  {
    type: 'survive',
    targetBase: 8,
    targetPerLevel: 0,
    timeLimit: 8,
    difficulty: 'easy',
    descriptionTemplate: {
      ko: '{target}초 생존',
      en: 'Survive {target}s'
    },
    reward: { type: 'heal', value: 0.1, label: '체력 10% 회복' }
  },

  // Medium
  {
    type: 'kill',
    targetBase: 25,
    targetPerLevel: 2,
    timeLimit: 10,
    difficulty: 'medium',
    descriptionTemplate: {
      ko: '{time}초 내 {target}마리 처치',
      en: 'Kill {target} in {time}s'
    },
    reward: { type: 'levelUp', value: 1, label: '레벨업!' }
  },
  {
    type: 'combo',
    targetBase: 30,
    targetPerLevel: 1,
    timeLimit: 15,
    difficulty: 'medium',
    descriptionTemplate: {
      ko: '{time}초 내 {target}콤보 달성',
      en: 'Reach {target} combo in {time}s'
    },
    reward: { type: 'buff', value: 'damage', label: '공격력 버프' }
  },
  {
    type: 'no_hit',
    targetBase: 12,
    targetPerLevel: 0,
    timeLimit: 12,
    difficulty: 'medium',
    descriptionTemplate: {
      ko: '피격 없이 {target}초 생존',
      en: 'No hit for {target}s'
    },
    reward: { type: 'heal', value: 0.2, label: '체력 20% 회복' }
  },

  // Hard
  {
    type: 'kill',
    targetBase: 40,
    targetPerLevel: 3,
    timeLimit: 10,
    difficulty: 'hard',
    descriptionTemplate: {
      ko: '{time}초 내 {target}마리 처치',
      en: 'Kill {target} in {time}s'
    },
    reward: { type: 'weapon', value: 'random', label: '랜덤 무기!' }
  },
  {
    type: 'combo',
    targetBase: 50,
    targetPerLevel: 2,
    timeLimit: 20,
    difficulty: 'hard',
    descriptionTemplate: {
      ko: '{time}초 내 {target}콤보 달성',
      en: 'Reach {target} combo in {time}s'
    },
    reward: { type: 'levelUp', value: 2, label: '레벨업 x2!' }
  },
  {
    type: 'time_boss',
    targetBase: 50,
    targetPerLevel: 0,
    timeLimit: 30,
    difficulty: 'hard',
    descriptionTemplate: {
      ko: '{time}초 내 보스 체력 {target}% 깎기',
      en: 'Deal {target}% boss HP in {time}s'
    },
    reward: { type: 'gold', value: 500, label: '골드 +500' }
  }
];

// 초기 코드 리뷰 상태 생성
export function createInitialQuizState(): QuizState {
  return {
    activeChallenge: null,
    lastChallengeTime: 0,
    nextChallengeIn: QUIZ_CONFIG.firstQuizDelay,
    completedCount: 0,
    failedCount: 0,
    isPenaltyActive: false,
    penaltyTimer: 0,
    history: []
  };
}

// 랜덤 간격 생성
export function getRandomQuizInterval(): number {
  return Math.random() * (QUIZ_CONFIG.maxInterval - QUIZ_CONFIG.minInterval) + QUIZ_CONFIG.minInterval;
}

// 난이도 선택 (레벨 기반)
export function selectDifficulty(playerLevel: number): QuizDifficulty {
  const weights = playerLevel <= 5
    ? QUIZ_CONFIG.difficultyWeights.early
    : playerLevel <= 15
      ? QUIZ_CONFIG.difficultyWeights.mid
      : QUIZ_CONFIG.difficultyWeights.late;

  const rand = Math.random();
  if (rand < weights.easy) return 'easy';
  if (rand < weights.easy + weights.medium) return 'medium';
  return 'hard';
}

// 챌린지 생성
export function generateQuizChallenge(playerLevel: number, difficulty?: QuizDifficulty): QuizChallenge {
  const selectedDifficulty = difficulty || selectDifficulty(playerLevel);

  // 해당 난이도의 챌린지 필터링
  const availableChallenges = QUIZ_CHALLENGES.filter(c => c.difficulty === selectedDifficulty);
  const template = availableChallenges[Math.floor(Math.random() * availableChallenges.length)];

  // 목표 계산 (레벨에 따라 조정)
  const target = template.targetBase + Math.floor(playerLevel * template.targetPerLevel);

  // 설명 생성
  const description = template.descriptionTemplate.ko
    .replace('{target}', target.toString())
    .replace('{time}', template.timeLimit.toString());

  return {
    id: `quiz_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: template.type,
    description,
    target,
    current: 0,
    timeLimit: template.timeLimit,
    remaining: template.timeLimit,
    difficulty: selectedDifficulty,
    reward: template.reward,
    status: 'active'
  };
}
