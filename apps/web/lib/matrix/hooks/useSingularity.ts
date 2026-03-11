/**
 * useSingularity - 특이점 도전 모드 상태 관리 훅
 * 무한 생존 모드, 시간 기반 난이도 스케일링
 */

import { useState, useCallback, useRef } from 'react';
import type { SingularityState, SingularityResult, SingularityEventType } from '../types';

// Placeholder types for removed boss system (Arena 모드에서는 보스 시스템 비활성)
interface SingularityBoss {
  id: number;
  name: string;
  hp: number;
  damage: number;
  speed: number;
  baseHp: number;
  baseDamage: number;
  baseSpeed: number;
  baseRadius: number;
  color: string;
  tier: 'stage' | 'elite' | 'legendary';
  skills: string[];
  specialEffect?: 'screen_shake' | 'flash' | 'none';
  entranceQuote?: string;
}

const getRandomSingularityBoss = (_gameTime?: number): SingularityBoss => ({
  id: 0, name: 'None', hp: 0, damage: 0, speed: 0,
  baseHp: 0, baseDamage: 0, baseSpeed: 0, baseRadius: 0,
  color: '#fff', tier: 'stage', skills: [],
});
const getSingularityBossScaling = (_time: number) => ({ hpScale: 1, damageScale: 1, speedScale: 1 });
const getBossSpawnInterval = (_time: number) => 999999; // Arena 모드에서는 보스 스폰 비활성

// localStorage 키
const STORAGE_KEYS = {
  BEST_TIME: 'nexus_singularity_best',
  TOTAL_ATTEMPTS: 'nexus_singularity_attempts',
  TOTAL_KILLS: 'nexus_singularity_kills',
};

// 마일스톤 정의 (초 단위)
export const SINGULARITY_MILESTONES = [300, 600, 900, 1800, 2700, 3600]; // 5분, 10분, 15분, 30분, 45분, 60분

/** 마일스톤 달성 이벤트 */
export interface MilestoneAchievedEvent {
  milestone: number;
  milestoneMinutes: number;
  totalAchieved: number;
}

/** 보스 스폰 이벤트 타입 */
export interface SingularityBossSpawnEvent {
  type: 'BOSS_SPAWN';
  boss: SingularityBoss;
  scaling: {
    hpScale: number;
    damageScale: number;
    speedScale: number;
  };
}

export interface UseSingularityReturn {
  // 상태
  state: SingularityState;
  bestTime: number;
  bossDefeatedCount: number;
  currentBossId: number;
  achievedMilestones: number[];

  // 난이도 계산
  getDifficultyMultiplier: (gameTime: number) => {
    hp: number;
    damage: number;
    speed: number;
    spawnRate: number;
  };

  // 액션
  startSingularity: () => void;
  endSingularity: (finalScore: number) => SingularityResult;
  updateSurvivalTime: (time: number) => void;
  incrementKillCount: () => void;
  incrementBossDefeatedCount: () => void;
  checkBossSpawn: (gameTime: number) => SingularityBossSpawnEvent | null;
  checkMilestone: (gameTime: number) => MilestoneAchievedEvent | null;
  clearActiveEvent: () => void;
  reset: () => void;
}

export function useSingularity(): UseSingularityReturn {
  // 최고 기록 로드
  const loadBestTime = (): number => {
    if (typeof window === 'undefined') return 0;
    const saved = localStorage.getItem(STORAGE_KEYS.BEST_TIME);
    return saved ? parseFloat(saved) : 0;
  };

  const [state, setState] = useState<SingularityState>({
    isActive: false,
    survivalTime: 0,
    bestTime: loadBestTime(),
    killCount: 0,
    currentDifficulty: 1.5,
    activeEvent: null,
  });

  // 보스 처치 횟수 및 현재 보스 ID (UI 표시용)
  const [bossDefeatedCount, setBossDefeatedCount] = useState(0);
  const [currentBossId, setCurrentBossId] = useState(1);

  const [bestTime, setBestTime] = useState<number>(loadBestTime());

  // 달성한 마일스톤 목록 (ref로 즉시 동기 업데이트, state는 UI 표시용)
  const [achievedMilestones, setAchievedMilestones] = useState<number[]>([]);
  const achievedMilestonesRef = useRef<number[]>([]);

  // 클로저 문제 해결: 최신 state를 ref로 추적
  const stateRef = useRef(state);
  stateRef.current = state;

  // 다음 보스 스폰 시간 추적
  const nextBossSpawnTimeRef = useRef<number>(0);

  // 난이도 배율 계산 (완화된 로그 곡선 + 장기 선형 성장)
  const getDifficultyMultiplier = useCallback((gameTime: number) => {
    const minutes = gameTime / 60;

    const scaledCurve = (softCap: number, rate: number, linearRate: number) => {
      const logPart = softCap * (1 - Math.exp(-minutes / rate));
      const linearPart = linearRate * minutes;
      return 1 + logPart + linearPart;
    };

    return {
      hp: scaledCurve(0.5, 3, 0.02),
      damage: scaledCurve(0.3, 4, 0.01),
      speed: scaledCurve(0.2, 5, 0.005),
      spawnRate: Math.max(0.8, 2.5 - minutes * 0.02),
    };
  }, []);

  // 특이점 모드 시작
  const startSingularity = useCallback(() => {
    const firstBossTime = 180 + Math.random() * 120;
    nextBossSpawnTimeRef.current = firstBossTime;

    setState({
      isActive: true,
      survivalTime: 0,
      bestTime: loadBestTime(),
      killCount: 0,
      currentDifficulty: 1.5,
      activeEvent: null,
    });

    setBossDefeatedCount(0);
    setCurrentBossId(1);

    achievedMilestonesRef.current = [];
    setAchievedMilestones([]);

    if (typeof window !== 'undefined') {
      const attempts = parseInt(localStorage.getItem(STORAGE_KEYS.TOTAL_ATTEMPTS) || '0');
      localStorage.setItem(STORAGE_KEYS.TOTAL_ATTEMPTS, String(attempts + 1));
    }
  }, []);

  // 특이점 모드 종료 및 결과 계산
  const endSingularity = useCallback((finalScore: number): SingularityResult => {
    const currentState = stateRef.current;
    const { survivalTime, killCount, bestTime: currentBest } = currentState;
    const isNewRecord = survivalTime > currentBest;

    if (typeof window !== 'undefined') {
      if (isNewRecord) {
        localStorage.setItem(STORAGE_KEYS.BEST_TIME, String(survivalTime));
        setBestTime(survivalTime);
      }

      const totalKills = parseInt(localStorage.getItem(STORAGE_KEYS.TOTAL_KILLS) || '0');
      localStorage.setItem(STORAGE_KEYS.TOTAL_KILLS, String(totalKills + killCount));
    }

    const survivalBonus = calculateSurvivalBonus(survivalTime);
    const recordBonus = isNewRecord ? Math.floor((survivalTime - currentBest) * 500) : 0;
    const killBonus = killCount * 5;
    const total = finalScore + survivalBonus + recordBonus + killBonus;

    setState(prev => ({ ...prev, isActive: false }));

    return {
      survivalTime,
      killCount,
      score: finalScore,
      isNewRecord,
      rewards: {
        survivalBonus,
        recordBonus,
        killBonus,
        total,
      },
    };
  }, []);

  // 생존 시간 업데이트
  const updateSurvivalTime = useCallback((time: number) => {
    stateRef.current = {
      ...stateRef.current,
      survivalTime: time,
      currentDifficulty: getDifficultyMultiplier(time).hp,
    };

    setState(prev => ({
      ...prev,
      survivalTime: time,
      currentDifficulty: getDifficultyMultiplier(time).hp,
    }));
  }, [getDifficultyMultiplier]);

  // 킬 카운트 증가
  const incrementKillCount = useCallback(() => {
    stateRef.current = {
      ...stateRef.current,
      killCount: stateRef.current.killCount + 1,
    };
    setState(prev => ({ ...prev, killCount: prev.killCount + 1 }));
  }, []);

  // 이벤트 클리어 타이머 ref
  const eventClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 보스 스폰 체크
  const checkBossSpawn = useCallback((gameTime: number): SingularityBossSpawnEvent | null => {
    if (gameTime < nextBossSpawnTimeRef.current) {
      return null;
    }

    const boss = getRandomSingularityBoss(gameTime);
    const scaling = getSingularityBossScaling(gameTime);

    setCurrentBossId(boss.id);

    const interval = getBossSpawnInterval(gameTime);
    const randomOffset = (Math.random() - 0.5) * 30;
    nextBossSpawnTimeRef.current = gameTime + interval + randomOffset;

    setState(prev => ({
      ...prev,
      activeEvent: {
        type: 'MINI_BOSS' as SingularityEventType,
        name: `BOSS: ${boss.name}`,
        description: boss.entranceQuote || '',
        duration: 3,
        remaining: 3,
      },
    }));

    if (eventClearTimerRef.current) {
      clearTimeout(eventClearTimerRef.current);
    }

    eventClearTimerRef.current = setTimeout(() => {
      setState(prev => ({ ...prev, activeEvent: null }));
    }, 3000);

    return {
      type: 'BOSS_SPAWN',
      boss,
      scaling,
    };
  }, []);

  // 활성 이벤트 클리어
  const clearActiveEvent = useCallback(() => {
    setState(prev => ({ ...prev, activeEvent: null }));
  }, []);

  // 보스 처치 시 호출
  const incrementBossDefeatedCount = useCallback(() => {
    setBossDefeatedCount(prev => prev + 1);
  }, []);

  // 마일스톤 체크
  const checkMilestone = useCallback((gameTime: number): MilestoneAchievedEvent | null => {
    for (const milestone of SINGULARITY_MILESTONES) {
      if (gameTime >= milestone && !achievedMilestonesRef.current.includes(milestone)) {
        const newAchieved = [...achievedMilestonesRef.current, milestone];
        achievedMilestonesRef.current = newAchieved;
        setAchievedMilestones(newAchieved);

        const milestoneMinutes = Math.floor(milestone / 60);

        return {
          milestone,
          milestoneMinutes,
          totalAchieved: newAchieved.length,
        };
      }
    }
    return null;
  }, []);

  // 리셋
  const reset = useCallback(() => {
    nextBossSpawnTimeRef.current = 0;
    setBossDefeatedCount(0);
    setCurrentBossId(1);
    achievedMilestonesRef.current = [];
    setAchievedMilestones([]);
    setState({
      isActive: false,
      survivalTime: 0,
      bestTime: loadBestTime(),
      killCount: 0,
      currentDifficulty: 1.5,
      activeEvent: null,
    });
  }, []);

  return {
    state,
    bestTime,
    bossDefeatedCount,
    currentBossId,
    achievedMilestones,
    getDifficultyMultiplier,
    startSingularity,
    endSingularity,
    updateSurvivalTime,
    incrementKillCount,
    incrementBossDefeatedCount,
    checkBossSpawn,
    checkMilestone,
    clearActiveEvent,
    reset,
  };
}

// 생존 시간 기반 보상 계산
function calculateSurvivalBonus(survivalTime: number): number {
  const minutes = survivalTime / 60;

  if (minutes < 0.5) return Math.floor(survivalTime * 50);
  if (minutes < 1) return Math.floor(survivalTime * 100) + 500;
  if (minutes < 2) return Math.floor(survivalTime * 150) + 2000;
  if (minutes < 3) return Math.floor(survivalTime * 200) + 5000;
  if (minutes < 4) return Math.floor(survivalTime * 300) + 10000;
  if (minutes < 5) return Math.floor(survivalTime * 400) + 20000;
  return Math.floor(survivalTime * 500) + 50000;
}

export default useSingularity;
