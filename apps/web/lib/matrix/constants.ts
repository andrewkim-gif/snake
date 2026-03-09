/**
 * constants.ts - 레거시 호환성을 위한 Re-export
 *
 * 모든 설정은 이제 config/ 폴더에서 모듈화되어 관리됩니다.
 * 기존 import 호환성을 위해 여기서 re-export 합니다.
 *
 * 새 코드에서는 직접 config/에서 import하는 것을 권장합니다:
 * import { GAME_CONFIG } from './config/game.config';
 */

// Re-export everything from config modules
export {
  // Game Config
  BASE_STAGE_DURATION,
  MAX_ACTIVE_SKILLS,
  MAX_REROLLS,
  UNLOCK_COSTS,
  GOLD_REWARD,
  GAME_CONFIG,
  SPECIAL_SKILL,
  ZOOM_CONFIG,

  // Classes Config
  CLASS_DATA,

  // Enemies Config
  ENEMY_TYPES,
  WAVE_DEFINITIONS,
  PICKUP_DATA,
  isRangedEnemy,
  getEnemyConfig,
  getWaveDefinitionsForStage,
  getWaveForTime,
  getWaveForStage,

  // Weapons Config
  WEAPON_DATA,

  // Arena Config (replacing Stages)
  XP_THRESHOLDS,
  WAVE_DURATION,

  // Achievements & Skins Config
  ACHIEVEMENTS,
  ACHIEVEMENT_CATEGORIES,
  getAchievementProgress,
  SKINS,
  SKIN_CATEGORIES,
  getSkinById,

  // Roulette Rewards & Headlines
  ROULETTE_REWARDS,
  HOJAE_HEADLINES,

  // Arena Config (Battle Royale mode)
  ARENA_CONFIG,
  SAFE_ZONE_PHASES,
  ARENA_MONSTER_CONFIG,
  ARENA_MONSTER_POOL,
  AI_PERSONALITY_WEIGHTS,
  getArenaMonsterTypes,
  getArenaDifficulty,
  getSafeZonePhase,
  calculateSafeZoneState,
} from './config';

// Re-export types for backward compatibility
export type { WaveConfig, RangedEnemyStats } from './config';
