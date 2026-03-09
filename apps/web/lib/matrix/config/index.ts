/**
 * Config Index - 모든 설정 re-export
 *
 * Ported from app_ingame/config/index.ts
 * lucide-react icons stubbed as string identifiers
 * achievements.config and skins.config not yet ported (TODO)
 */

// Game Config
export {
  BASE_STAGE_DURATION,
  MAX_ACTIVE_SKILLS,
  MAX_REROLLS,
  UNLOCK_COSTS,
  GOLD_REWARD,
  GAME_CONFIG,
  SPECIAL_SKILL,
  ZOOM_CONFIG,
} from './game.config';

// Classes Config
export { CLASS_DATA } from './classes.config';

// Enemies Config
export {
  ENEMY_TYPES,
  WAVE_DEFINITIONS,
  PICKUP_DATA,
  isRangedEnemy,
  getEnemyConfig,
  getWaveDefinitionsForStage,
  getWaveForTime,
  getWaveForStage,
} from './enemies.config';
export type { WaveConfig, RangedEnemyStats } from './enemies.config';

// Weapons Config
export { WEAPON_DATA } from './weapons.config';

// Stages Config - removed for Arena mode
// Stage system constants moved to arena.config.ts
export const XP_THRESHOLDS = [100, 150, 200, 260, 330, 410, 500, 600, 710, 830, 960, 1100, 1250, 1410, 1580, 1760, 1950, 2150, 2360, 2580];
export const WAVE_DURATION = 60; // seconds per wave (used for arena timing)

// Singularity Bosses Config - removed for Arena mode

// Achievements Config - TODO: port from app_ingame/config/achievements.config.ts
// export {
//   ACHIEVEMENTS,
//   ACHIEVEMENT_CATEGORIES,
//   getAchievementProgress,
// } from './achievements.config';
// export type { Achievement, AchievementCategory, AchievementCondition } from './achievements.config';

// Skins Config - TODO: port from app_ingame/config/skins.config.ts
// export {
//   SKINS,
//   SKIN_CATEGORIES,
//   getSkinById,
// } from './skins.config';
// export type { Skin, SkinRarity, SkinCategory } from './skins.config';

// Arena Config (Battle Royale mode)
export {
  ARENA_CONFIG,
  SAFE_ZONE_PHASES,
  ARENA_MONSTER_CONFIG,
  ARENA_MONSTER_POOL,
  AI_PERSONALITY_WEIGHTS,
  getArenaMonsterTypes,
  getArenaDifficulty,
  getSafeZonePhase,
  calculateSafeZoneState,
} from './arena.config';

// Obstacles Config
export {
  getTerrainAtGrid,
  getTerrainType,
  isTerrainAt,
  isPointInTerrain,
  isCircleInTerrain,
  getObstacleAtGrid,
  isPointInObstacle,
  isCircleInObstacle,
} from './obstacles.config';
export type { TerrainType, TerrainSubtype, TerrainCollision, ObstacleConfig } from './obstacles.config';

// Items Config
export {
  CONSUMABLE_ITEMS,
  PERMANENT_UPGRADES,
  VIBE_TIME_OPTIONS,
  CORE_FRAGMENT_CONFIG,
  BOOSTER_CONFIGS,
  DAILY_LIMITS,
  getConsumableConfig,
  getUpgradeCost,
  getUpgradeEffect,
  getNextLevelEffect,
  getPermanentUpgradeConfig,
} from './items.config';
export type {
  ConsumableType,
  ConsumableConfig,
  PermanentUpgradeType,
  PermanentUpgradeConfig,
  VibeTimeOption,
  BoosterConfig,
} from './items.config';

// Skills Config (full skill system)
export * from './skills';

// Roulette Rewards (moved from stages.config.ts for Arena mode)
// lucide-react icons stubbed as string identifiers
type LucideIconStub = string;
const Coins: LucideIconStub = 'Coins';
const Heart: LucideIconStub = 'Heart';
const Zap: LucideIconStub = 'Zap';
const Bomb: LucideIconStub = 'Bomb';

export interface RouletteReward {
  id: string;
  type: string;
  label: string;
  value: number;
  icon: LucideIconStub;
  color: string;
}

export const ROULETTE_REWARDS: RouletteReward[] = [
  { id: 'reward_score', type: 'score', label: '단기 호재 (시총 폭등)', value: 10000, icon: Coins, color: '#facc15' },
  { id: 'reward_heal', type: 'heal', label: '하드 포크 (체력 복구)', value: 999, icon: Heart, color: '#ef4444' },
  { id: 'reward_upgrade', type: 'upgrade_all', label: '기술적 특이점 (전체 업글)', value: 1, icon: Zap, color: '#a855f7' },
  { id: 'reward_bomb', type: 'bomb', label: '규제 철폐 (화면 전체 딜)', value: 99999, icon: Bomb, color: '#f97316' },
];

// HOJAE_HEADLINES (moved from stages.config.ts for Arena mode)
export const HOJAE_HEADLINES = [
  "속보: 넥서스 크로스(NCC) 신고가 경신! 달까지 간다",
  "단독: 일론 머스크, 넥서스 크로스 로고 타투 인증?",
  "뉴스: 옆집 할머니도 넥서스 코인 사려고 적금 깼다",
  "호재: 넥서스 홀더들 전원 람보르기니 계약 완료",
  "뉴스: 비트코인 지고 넥서스 뜬다... 세대교체 시작",
  "속보: 넥서스 크로스, 전 세계 통화량 1위 달성 임박",
  "단독: 워렌 버핏 '나도 몰래 넥서스 줍고 있었다'",
  "화제: 넥서스 코인 1개로 서울 아파트 샀다는 인증글",
  "뉴스: '넥서스 10만불 간다' 전문가들 일제히 상향 조정",
  "속보: 편의점에서도 이제 넥서스 크로스로 결제 가능",
  "속보: 아버지가 '넥서스 물렸냐'고 물어보심... 10배 수익 중",
  "호재: NASA '넥서스 노드, 화성에도 설치 예정'",
  "속보: 넥서스 1개 = 강남 빌딩 1개 시대 온다",
  "뉴스: AI가 예측한 넥서스 가격... 측정 불가",
  "화제: '넥서스 없으면 결혼 안 해' 트렌드 등극",
];
