/**
 * lib/matrix/index.ts - Matrix 게임 엔진 모듈 export
 * Ported from app_ingame/game/index.ts
 */

// Types (selective to avoid conflicts with config re-exports)
export type {
  Vector2, WeaponType, WeaponStats, Player, Enemy, Projectile,
  EnemyType, PlayerClass, Pickup, PickupType, StatusEffect,
  Gem, CriticalEffect, LightningBolt, Blast, CollisionBox,
  PlacedTurret, TurretProjectile, TurretAoeEffect, TurretConfig,
  TurretRarity, AgentConfig, AgentRarity, Agent, AIPersonality,
  BreakTimeState, SkillDefinition, SkillCategory, SkillTier,
  Entity, ChatTrigger, JoystickState, Skin, SkinRarity,
  ComboTier, ComboTierConfig, ComboState, EliteTier,
  TranslationKeys,
} from './types';

// Constants (re-export barrel from config/)
export * from './constants';

// Helpers
export {
  isObstacleAt,
  getNearestEnemy,
  getEnemiesOnScreen,
  generateLightningPoints,
  calculateAutoHuntDirection,
  applyKnockback,
  checkAxisCollision,
  setCurrentStageId,
  getCurrentStageId,
  setCurrentGameMode,
  getCurrentGameMode,
  setCurrentMapSeed,
  getCurrentMapSeed,
} from './helpers';
export type { AutoHuntState } from './helpers';

// Systems
export * from './systems';

// Config
export * from './config';

// Utils
export { soundManager } from './utils/audio';
export { sfxManager } from './utils/sfx';

// Isometric
export { isoKnockback, ISO_Y_SCALE, GRAVITY_Z } from './isometric';

// v29: GameCanvas full port — rendering functions
export {
  drawCatSprite,
  drawFloorTile,
  drawTerrainOnly,
  drawEnemy,
  drawProjectile,
  drawLightningBolt,
  drawFormationWarning,
} from './rendering';

// v29: Rendering sub-module exports
export { drawJoystick } from './rendering/ui';
export { drawTurret, drawTurretAoeEffect } from './rendering/turrets';
export { drawGlitch } from './rendering/enemies';

// v29: Render context (LOD helpers)
export {
  updateRenderContext,
  shouldUseGradient,
  shouldUseGlow,
  shouldUseShadow,
} from './rendering/enemies/renderContext';

// v29: Easing & glow effects
export {
  EASING,
  applyEasing,
  lerp,
  lerpColor,
} from './rendering/effects/easing';
export {
  GLOW_PRESETS,
  updateTrailPositions,
} from './rendering/effects/glow';

// v29: useGameRefs hook
export { useGameRefs } from './hooks/useGameRefs';

// v29: Additional types needed by GameCanvas
export type {
  GameMode,
  PersistentUpgrades,
  EventLogType,
  SingularityState,
  SingularityResult,
  SingularityEventType,
} from './types';
