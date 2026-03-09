// v29: useSingularity hook stub (특이점 도전 모드)
// GameCanvas.tsx에서 inline import()로 타입만 참조함

/** 마일스톤 달성 이벤트 */
export interface MilestoneAchievedEvent {
  milestone: number;
  milestoneMinutes: number;
  totalAchieved: number;
}

/** 특이점 보스 정보 */
export interface SingularityBoss {
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
}

/** 보스 스폰 이벤트 */
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
  state: unknown;
  bestTime: number;
  bossDefeatedCount: number;
  currentBossId: number;
  achievedMilestones: number[];
}

export const SINGULARITY_MILESTONES = [300, 600, 900, 1800, 2700, 3600];

export function useSingularity(): UseSingularityReturn {
  return {
    state: null,
    bestTime: 0,
    bossDefeatedCount: 0,
    currentBossId: 0,
    achievedMilestones: [],
  };
}

export default useSingularity;
