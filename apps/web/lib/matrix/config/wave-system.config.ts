/**
 * wave-system.config.ts — Wave 난이도 & 엘리트 몬스터 설정
 *
 * v42 Phase 4: 시간 기반 Wave 프로그레션 + 엘리트 스폰 설정
 *
 * Wave 구조:
 *   SKIRMISH (0-60s): 약한 적만 등장, 적응 시간
 *   ENGAGEMENT (60-180s): 중간 난이도, 새 적 타입 등장
 *   SHOWDOWN (180s+): 고난이도, 엘리트 다수 + 빠른 스폰
 */

import type { EnemyType, EliteTier, PickupType } from '../types';

// ============================================
// Wave Phase 타입
// ============================================

/** 게임 페이즈 이름 */
export type WavePhaseName = 'SKIRMISH' | 'ENGAGEMENT' | 'SHOWDOWN';

/** 개별 Wave 설정 */
export interface WaveStageConfig {
  /** Wave 시작 시간 (초) */
  startTime: number;
  /** 적 HP 배율 */
  hpMultiplier: number;
  /** 적 데미지 배율 */
  damageMultiplier: number;
  /** 적 이동속도 배율 */
  speedMultiplier: number;
  /** 스폰 간격 배율 (낮을수록 빠름) */
  spawnRateMultiplier: number;
  /** 동시 최대 적 수 배율 */
  maxEnemyMultiplier: number;
  /** 활성 적 타입 풀 */
  enemyTypes: EnemyType[];
  /** 페이즈 이름 */
  phaseName: WavePhaseName;
}

// ============================================
// Wave 프로그레션 설정 (시간 기반)
// ============================================

export const WAVE_PROGRESSION: WaveStageConfig[] = [
  // SKIRMISH (0-60s): 약한 적, 적응 시간
  {
    startTime: 0,
    hpMultiplier: 1.0,
    damageMultiplier: 1.0,
    speedMultiplier: 1.0,
    spawnRateMultiplier: 1.0,
    maxEnemyMultiplier: 1.0,
    enemyTypes: ['glitch'],
    phaseName: 'SKIRMISH',
  },
  // SKIRMISH (30s): bot 등장
  {
    startTime: 30,
    hpMultiplier: 1.2,
    damageMultiplier: 1.0,
    speedMultiplier: 1.05,
    spawnRateMultiplier: 0.95,
    maxEnemyMultiplier: 1.1,
    enemyTypes: ['glitch', 'bot'],
    phaseName: 'SKIRMISH',
  },
  // ENGAGEMENT (60s): 본격 전투 시작
  {
    startTime: 60,
    hpMultiplier: 1.5,
    damageMultiplier: 1.2,
    speedMultiplier: 1.1,
    spawnRateMultiplier: 0.85,
    maxEnemyMultiplier: 1.2,
    enemyTypes: ['glitch', 'bot', 'malware'],
    phaseName: 'ENGAGEMENT',
  },
  // ENGAGEMENT (120s): whale 등장
  {
    startTime: 120,
    hpMultiplier: 2.0,
    damageMultiplier: 1.5,
    speedMultiplier: 1.15,
    spawnRateMultiplier: 0.75,
    maxEnemyMultiplier: 1.3,
    enemyTypes: ['glitch', 'bot', 'malware', 'whale'],
    phaseName: 'ENGAGEMENT',
  },
  // SHOWDOWN (180s): 최고 난이도
  {
    startTime: 180,
    hpMultiplier: 3.0,
    damageMultiplier: 2.0,
    speedMultiplier: 1.25,
    spawnRateMultiplier: 0.6,
    maxEnemyMultiplier: 1.5,
    enemyTypes: ['bot', 'malware', 'whale'],
    phaseName: 'SHOWDOWN',
  },
  // SHOWDOWN (300s): 극한 난이도
  {
    startTime: 300,
    hpMultiplier: 5.0,
    damageMultiplier: 3.0,
    speedMultiplier: 1.4,
    spawnRateMultiplier: 0.5,
    maxEnemyMultiplier: 1.8,
    enemyTypes: ['malware', 'whale', 'sniper'],
    phaseName: 'SHOWDOWN',
  },
];

/**
 * 현재 시간에 해당하는 Wave 단계 조회
 * @param gameTime 게임 경과 시간 (초)
 * @returns 현재 Wave 설정
 */
export function getCurrentWaveStage(gameTime: number): WaveStageConfig {
  // 마지막 단계부터 역순 검색 (현재 시간 이하인 가장 늦은 단계)
  for (let i = WAVE_PROGRESSION.length - 1; i >= 0; i--) {
    if (gameTime >= WAVE_PROGRESSION[i].startTime) {
      return WAVE_PROGRESSION[i];
    }
  }
  return WAVE_PROGRESSION[0];
}

/**
 * 현재 시간의 Wave 페이즈 이름 조회
 */
export function getCurrentPhaseName(gameTime: number): WavePhaseName {
  return getCurrentWaveStage(gameTime).phaseName;
}

// ============================================
// 엘리트 몬스터 설정
// ============================================

/** 엘리트 스폰 설정 */
export interface EliteSpawnConfig {
  /** 필요 킬 수 */
  killThreshold: number;
  /** 엘리트 등급 */
  tier: EliteTier;
  /** HP 배율 */
  hpMultiplier: number;
  /** 데미지 배율 */
  damageMultiplier: number;
  /** 크기 배율 */
  sizeMultiplier: number;
  /** XP 보상 배율 */
  xpMultiplier: number;
  /** 드롭 아이템 */
  drops: PickupType[];
  /** 색상 */
  color: string;
  /** 이름 */
  name: string;
}

export const ELITE_CONFIGS: EliteSpawnConfig[] = [
  {
    killThreshold: 100,
    tier: 'silver',
    hpMultiplier: 5,
    damageMultiplier: 2,
    sizeMultiplier: 1.5,
    xpMultiplier: 8,
    drops: ['chest', 'upgrade_material'],
    color: '#C0C0C0',
    name: 'SILVER ELITE',
  },
  {
    killThreshold: 200,
    tier: 'gold',
    hpMultiplier: 10,
    damageMultiplier: 3,
    sizeMultiplier: 2.0,
    xpMultiplier: 15,
    drops: ['chest', 'upgrade_material', 'bomb'],
    color: '#FFD700',
    name: 'GOLD ELITE',
  },
  {
    killThreshold: 300,
    tier: 'diamond',
    hpMultiplier: 20,
    damageMultiplier: 5,
    sizeMultiplier: 2.5,
    xpMultiplier: 30,
    drops: ['chest', 'upgrade_material', 'bomb', 'magnet'],
    color: '#00FFFF',
    name: 'DIAMOND ELITE',
  },
];

/**
 * 킬 카운트에 따라 엘리트 스폰 여부 확인
 * @param killCount 현재 킬 카운트
 * @returns 스폰할 엘리트 설정 (null이면 스폰 안 함)
 */
export function checkEliteSpawn(killCount: number): EliteSpawnConfig | null {
  // 100, 200, 300 킬마다 엘리트 스폰 (정확히 일치할 때만)
  for (const config of ELITE_CONFIGS) {
    if (killCount === config.killThreshold) {
      return config;
    }
  }
  // 300킬 이후에도 100킬마다 diamond 엘리트 반복 스폰
  if (killCount > 300 && killCount % 100 === 0) {
    return ELITE_CONFIGS[2]; // diamond
  }
  return null;
}

/** 적 타입별 기본 스탯 (MC 블록 스케일) */
export const ENEMY_BASE_STATS: Record<string, {
  hp: number;
  damage: number;
  speed: number;
  color: string;
  xp: number;
}> = {
  glitch: { hp: 100, damage: 10, speed: 5, color: '#44aaff', xp: 10 },
  bot: { hp: 150, damage: 15, speed: 4, color: '#ff6644', xp: 20 },
  malware: { hp: 200, damage: 20, speed: 4.5, color: '#cc44ff', xp: 30 },
  whale: { hp: 300, damage: 25, speed: 3, color: '#ff4444', xp: 50 },
  sniper: { hp: 120, damage: 30, speed: 3.5, color: '#ff8800', xp: 40 },
};

/**
 * Wave 배율이 적용된 적 스탯 계산
 */
export function getScaledEnemyStats(
  enemyType: string,
  waveStage: WaveStageConfig
): { hp: number; damage: number; speed: number; color: string; xp: number } {
  const base = ENEMY_BASE_STATS[enemyType] ?? ENEMY_BASE_STATS.glitch;
  return {
    hp: Math.round(base.hp * waveStage.hpMultiplier),
    damage: Math.round(base.damage * waveStage.damageMultiplier),
    speed: base.speed * waveStage.speedMultiplier,
    color: base.color,
    xp: base.xp,
  };
}
