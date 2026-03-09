/**
 * constants.ts - 게임 상수 및 설정 re-export
 * app_ingame/constants.ts + config/game.config.ts + config/index.ts 통합
 *
 * 시스템 파일들이 '../../constants'에서 import하는 모든 심볼을 여기서 export
 */

import type { EnemyType } from './types';

// ============================================================
// Game Config (game.config.ts)
// ============================================================

export const BASE_STAGE_DURATION = 60;
export const MAX_ACTIVE_SKILLS = 5;
export const MAX_REROLLS = 5;

export const GAME_CONFIG = {
  PLAYER_SPEED: 100,
  PLAYER_RADIUS: 11,
  PLAYER_COLLISION_BOX: {
    width: 42,
    height: 42,
    offsetX: 45,
    offsetY: 50,
  },
  PLAYER_COLOR: '#3b82f6',
  PLAYER_HP: 100,
  PLAYER_INVULNERABILITY: 0.5,

  GEM_RADIUS: 5,
  GEM_MAGNET_RANGE: 120,
  GEM_COLLECT_SPEED: 700,

  MAX_ENEMIES: 400,
  SPAWN_RADIUS: 650,
  DESPAWN_RADIUS: 1100,

  MAX_PARTICLES: 400,
  MAX_PROJECTILES: 300,
  MAX_DAMAGE_NUMBERS: 50,
  MAX_LIGHTNING_BOLTS: 30,
  MAX_BLASTS: 20,
  MAX_GEMS: 200,

  DAMAGE_TEXT_LIFESPAN: 0.5,
  PARTICLE_LIFE: 0.5,
  FRICTION: 0.90,
};

export const SPECIAL_SKILL = {
  NAME: 'Special',
  COOLDOWN: 15,
  DAMAGE: 2000,
  RADIUS: 400,
  KNOCKBACK: 100,
  COLOR: '#22d3ee',
};

export const ZOOM_CONFIG = {
  MIN_ZOOM: 0.6,
  MAX_ZOOM: 1.1,
  DEFAULT_ZOOM: 0.85,
  LERP_FACTOR: 0.008,
  ENEMY_VISIBLE_MARGIN: 80,
  MIN_ENEMIES_TO_SHOW: 3,
  CLOSE_RANGE: 150,
  MID_RANGE: 350,
  FAR_RANGE: 500,
  CLOSE_ENEMY_HIGH: 8,
  BOSS_RANGE: 400,
  EARLY_GAME_TIME: 5,
};

// ============================================================
// Pickup Data (enemies.config.ts에서 이동)
// ============================================================

export const PICKUP_DATA: Record<string, { chance: number; radius: number }> = {
  chicken: { chance: 0.60, radius: 12 },
  chest: { chance: 0.05, radius: 16 },
  bomb: { chance: 0.15, radius: 14 },
  magnet: { chance: 0.20, radius: 12 },
  upgrade_material: { chance: 0, radius: 10 },
};

// ============================================================
// XP Thresholds
// ============================================================

export const XP_THRESHOLDS = [
  100, 150, 200, 260, 330, 410, 500, 600, 710, 830,
  960, 1100, 1250, 1410, 1580, 1760, 1950, 2150, 2360, 2580,
];
export const WAVE_DURATION = 60;

// ============================================================
// Enemy Size Scale
// ============================================================

export const ENEMY_SIZE_SCALE = 0.75;

// ============================================================
// 적 타입 설정 (enemies.config.ts에서 핵심만 추출)
// 전체 ENEMY_TYPES는 config/enemies.config.ts에서 import
// ============================================================

/** 기본 적 설정 타입 */
export interface EnemyConfig {
  hp: number;
  damage: number;
  speed: number;
  radius: number;
  color: string;
  mass: number;
  attackType?: 'melee' | 'ranged';
  attackRange?: number;
  attackCooldown?: number;
  projectileSpeed?: number;
  projectileColor?: string;
}

/**
 * ENEMY_TYPES — 적 타입 기본 스탯
 * enemies.config.ts에서 전체 정의를 import하면 이것을 대체
 * 여기서는 시스템 파일 컴파일에 필요한 최소 인터페이스만 제공
 */
export const ENEMY_TYPES: Record<string, EnemyConfig> = {
  glitch: { hp: 30, damage: 8, speed: 45, radius: 12, color: '#00FF41', mass: 1 },
  bot: { hp: 40, damage: 10, speed: 40, radius: 14, color: '#3b82f6', mass: 1.2 },
  malware: { hp: 50, damage: 12, speed: 50, radius: 13, color: '#dc2626', mass: 1 },
  whale: { hp: 200, damage: 20, speed: 25, radius: 24, color: '#374151', mass: 3 },
  sniper: { hp: 35, damage: 15, speed: 35, radius: 11, color: '#f97316', mass: 0.8, attackType: 'ranged', attackRange: 300, attackCooldown: 2.0, projectileSpeed: 250, projectileColor: '#f97316' },
  caster: { hp: 30, damage: 12, speed: 40, radius: 10, color: '#a855f7', mass: 0.7, attackType: 'ranged', attackRange: 250, attackCooldown: 1.5, projectileSpeed: 200, projectileColor: '#a855f7' },
  artillery: { hp: 60, damage: 25, speed: 20, radius: 16, color: '#ea580c', mass: 2, attackType: 'ranged', attackRange: 400, attackCooldown: 3.0, projectileSpeed: 180, projectileColor: '#ea580c' },
};

/**
 * getEnemyConfig — ENEMY_SIZE_SCALE 적용된 적 설정 반환
 */
export function getEnemyConfig(type: EnemyType): EnemyConfig | undefined {
  const config = ENEMY_TYPES[type];
  if (!config) return undefined;
  return {
    ...config,
    radius: config.radius * ENEMY_SIZE_SCALE,
  };
}

/**
 * isRangedEnemy — 원거리 적 판별 (config 기반)
 */
export function isRangedEnemy(type: EnemyType): boolean {
  const config = ENEMY_TYPES[type];
  return config?.attackType === 'ranged';
}

// ============================================================
// Wave Definitions (최소 stub)
// ============================================================

export interface WaveConfig {
  time: number;
  types: EnemyType[];
  spawnRate: number;
  maxEnemies: number;
}

export const WAVE_DEFINITIONS: WaveConfig[] = [
  { time: 0, types: ['glitch'], spawnRate: 1.5, maxEnemies: 15 },
  { time: 15, types: ['glitch', 'bot'], spawnRate: 1.2, maxEnemies: 25 },
  { time: 30, types: ['bot', 'malware'], spawnRate: 1.0, maxEnemies: 35 },
  { time: 60, types: ['malware', 'glitch', 'bot'], spawnRate: 0.8, maxEnemies: 50 },
  { time: 90, types: ['whale', 'malware', 'bot'], spawnRate: 0.7, maxEnemies: 60 },
  { time: 120, types: ['whale', 'sniper', 'malware'], spawnRate: 0.6, maxEnemies: 80 },
];

export function getWaveForTime(gameTime: number, _isSingularity: boolean = false): WaveConfig {
  let wave = WAVE_DEFINITIONS[0];
  for (const w of WAVE_DEFINITIONS) {
    if (gameTime >= w.time) wave = w;
    else break;
  }
  return wave;
}

export function getWaveForStage(_stageId: number): WaveConfig {
  return WAVE_DEFINITIONS[0];
}

export function getWaveDefinitionsForStage(_stageId: number): WaveConfig[] {
  return WAVE_DEFINITIONS;
}

// ============================================================
// Roulette / Headlines (UI에서 사용)
// ============================================================

export const ROULETTE_REWARDS: Array<{
  id: string;
  type: string;
  label: string;
  value: number;
  icon: unknown;
  color: string;
}> = [];

export const HOJAE_HEADLINES: string[] = [];
