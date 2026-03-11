/**
 * game/systems/index.ts - 게임 시스템 모듈 export
 * Ported from app_ingame/game/systems/index.ts
 */

// Context & Types
export {
  type GameRefs,
  type GameCallbacks,
  type GameContext,
  type ExtendedParticle,
  getEnemiesOnScreen,
  getNearestEnemy,
  generateLightningPoints,
} from './game-context';

// Combat System
export {
  createHitEffect,
  spawnDamageNumber,
  spawnGem,
  damageEnemy,
  consolidateGems,
  handleEnemyCollision,
  updateStatusEffects,
  createCriticalHitEffect,
  createSystemCrashEffect,
  createMCPClearEffect,
  createDebugAuraTick,
  createClaudeAssistEffect,
  createGitForkEffect,
  type DamageEnemyContext,
  type HitEffectRefs,
  type EnemyCollisionContext,
} from './combat';

// v29: Additional combat re-exports for GameCanvas compatibility
// (damageEnemy, consolidateGems, spawnDamageNumber already exported above)

// Spawning System
export {
  spawnGem as spawnGemSimple,
  spawnPickup,
  spawnEnemy,
  spawnEnemyProjectile,
  spawnParticles,
  spawnDamageNumber as spawnDamageNumberSimple,
  type SpawnParticleOptions,
} from './spawning';

// Movement System
export {
  calculateAutoHuntState,
  handleStuckDetection,
  processAutoHuntMovement,
  processManualInput,
  processKnockback,
  updatePlayerPosition,
  createDefaultDirectionPlan,
  createDefaultThreatMemory,
  createDefaultMotionState,
  type AutoHuntResult,
  type AutoHuntContext,
  type MovementRefs,
  type InputState,
  type DirectionPlan,
  type ThreatMemory,
  type MotionState,
  type PlanType,
} from './movement';

// Weapon System
export {
  fireWeapon,
  canFireWeapon,
  getWeaponColor,
  isMeleeWeapon,
  playWeaponSound,
  type WeaponFireContext,
  type WeaponFireResult,
} from './weapons';

// Pickup System
export {
  collectPickup,
  getPickupPriority,
  isPickupInRange,
  updateGems,
  type PickupCollectContext,
  type PickupCollectResult,
  type GemCollectContext,
} from './pickup';

// Projectile System
export {
  updateEnemyProjectiles,
  updatePlayerProjectiles,
  updateBlasts,
  applyStatusEffect,
  type ProjectileSystemContext,
  type EnemyProjectileContext,
} from './projectile';

// Ranged Enemy System
export {
  updateRangedEnemy,
  initializeRangedEnemy,
  isRangedEnemyType,
  type RangedEnemyCallbacks,
} from './ranged-enemy';

// Turret System
export {
  updateTurrets,
  updateTurretAoeEffects,
  damageTurret,
} from './turret';

// Agent Combat System (Arena PvP)
export {
  checkProjectileAgentCollision,
  applyPvPDamage,
  checkAgentMeleeCollision,
  calculateKillReward,
  calculateKnockback,
  checkSafeZoneDamage,
  getProjectileOwnerId,
  isAgentProjectile,
  type AgentDamageResult,
  type KillReward,
} from './agent-combat';

// Elite Monster System
export {
  checkEliteSpawn,
  convertToElite,
  createEliteDrops,
  updateEliteGlow,
  createEliteSpawnState,
  calculateAveragePlayerDamage,
  updateEliteSpawnState,
  onEliteDeath,
  type EliteSpawnState,
  type EliteSpawnResult,
  type EliteDropItem,
} from './elite-monster';

// Spawn Controller
export {
  type WavePool,
  type FormationType,
} from './spawn-controller';

// v29: BossSystemCallbacks stub (Boss system removed for Arena mode)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface BossSystemCallbacks {
  onBossSpawn?: (boss: unknown) => void;
  onBossUpdate?: (boss: unknown) => void;
  onBossDefeated?: () => void;
  onBossWarning?: (bossType: string) => void;
  spawnEnemyProjectile?: (...args: any[]) => void;
  spawnEnemy?: (...args: any[]) => void;
  spawnParticles?: (...args: any[]) => void;
  [key: string]: ((...args: any[]) => void) | undefined;
}

// Agent Chat System
export {
  triggerAgentChat,
  updateChatMessages,
  getActiveChatMessages,
  getAgentChatMessage,
  resetChatSystem,
  triggerFallbackChat,
  type ChatMessage,
} from './agent-chat';

// Sound Manager (v37 Phase 9)
export {
  SoundManager,
  type SoundCategory,
  type SoundAsset,
  type SoundManagerConfig,
} from './sound';

// Mobile UX (v37 Phase 9)
export {
  isTouchDevice,
  isMobileDevice,
  isTabletDevice,
  resetTouchCache,
  TOUCH_TARGETS,
  LEVELUP_MOBILE,
  SHOP_MOBILE,
  getJoystickZone,
  detectSwipe,
  getTouchFriendlyStyle,
  getHUDScaleFactor,
  type SwipeDirection,
  type JoystickZone,
} from './mobile-ux';

// v39: Round Engine Client (EpochUIBridge 대체)
export {
  RoundEngineClient,
  getRoundPhaseColor,
  getRoundPhaseDisplayName,
  getBRSubPhaseDisplayName,
  getBRSubPhaseColor,
  safeZoneRatioToRadius,
  ROUND_TIMING_CLIENT,
  type RoundPhaseUIConfig,
  type BRSubPhaseUIConfig,
  type SafeZoneVisual,
  type RoundEngineCallbacks,
} from './round-engine-client';
