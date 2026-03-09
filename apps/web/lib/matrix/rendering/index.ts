/**
 * game/rendering/index.ts - 렌더링 모듈 Public API
 *
 * 이 파일은 기존 rendering.ts와의 하위 호환성을 유지하면서
 * 새로운 모듈 구조로의 점진적 마이그레이션을 지원합니다.
 *
 * 기존 import 경로:
 *   import { drawCatSprite } from './rendering';
 *
 * 새로운 import 경로 (동일하게 동작):
 *   import { drawCatSprite } from './rendering';
 *   또는
 *   import { drawCatSprite } from './rendering/index';
 */

// ===== Types =====
export type {
  RenderContext,
  BossRenderParams,
  EnemyType,
  EnemyRenderParams,
  ProjectileType,
  ProjectileRenderParams,
  CharacterId,
  CharacterStyle,
  CharacterColors,
  CharacterRenderParams,
  FloorTileParams,
  ObstacleParams,
  Point,
  Bounds,
} from './types';

// ===== Constants =====
export {
  // Matrix/AI Theme
  matrixGreen,
  matrixDarkGreen,
  matrixLightGreen,
  // Tech/Cyber Colors
  cyberBlue,
  cyberPurple,
  cyberPink,
  cyberCyan,
  cyberGold,
  cyberRed,
  cyberOrange,
  // Robot Colors
  robotGray,
  robotDarkGray,
  robotLightGray,
  robotMetal,
  robotChrome,
  // Warning Colors
  warningRed,
  warningYellow,
  warningOrange,
  criticalRed,
  // Hit Effects
  bloodRed,
  bloodDark,
  hitWhite,
  hitFlash,
  // Singularity
  singularityPurple,
  singularityBlue,
  singularityVoid,
  // Boss Colors
  jiraBlue,
  slackPurple,
  googleColors,
  // Character Constants
  HEAD_SIZE,
  HEAD_Y,
  EYE_X,
  EYE_Y,
  BODY_WIDTH,
  BODY_HEIGHT,
  // Animation Constants
  DEFAULT_WALK_SPEED,
  DEFAULT_HOVER_SPEED,
  DEFAULT_HOVER_AMPLITUDE,
  // Size Limits
  MAX_PARTICLE_SIZE,
  MIN_PARTICLE_SIZE,
  DEFAULT_ENEMY_SIZE,
  DEFAULT_BOSS_SIZE,
} from './constants';

// ===== Utils =====
export {
  adjustColor,
  seededRandom,
  lerpColor,
  hexToRgba,
  degToRad,
  radToDeg,
  distance,
  clamp,
  withContext,
} from './utils';

// ===== 모듈별 Export =====

// Bosses - REMOVED for Arena mode (no longer needed)

// Enemies (Phase 2 완료)
export {
  drawGlitch, drawBot, drawMalware,
  drawWhale, drawSniper, drawCaster, drawArtillery,
  drawBitling, drawSpammer, drawCrypter, drawRansomer,
  drawPixel, drawBug, drawWorm, drawAdware,
  drawMutant, drawPolymorphic, drawTrojan, drawBotnet,
  drawRootkit, drawApt, drawZeroday, drawSkynet,
  drawEnemyProcedural,
  // Render Context (Performance Optimization)
  updateRenderContext,
  getFrameTime,
  getLOD,
  getEnemyCount,
  shouldUseShadow,
  shouldAnimate,
  getSeedBase,
  deterministicRandom,
  deterministicRandomRange,
  deterministicRandomBool,
  // v5.0 LOD helpers (투사체/파티클/폭발 최적화용)
  shouldUseGradient,
  shouldUseGlow,
  shouldUseComplexShapes,
  getSimplifiedColor,
  getTotalEntityCount,
  getProjectileCount,
  getParticleCount,
  // Stress test mode
  setStressTestMode,
  isStressTestMode,
  getAvgFrameTime,
  getStressTestFPS,
  type LODLevel,
} from './enemies';

// Projectiles (v4.7 - 17개 무기 모듈화 완료)
export { drawLightningBolt } from './projectiles';
export {
  // Melee (4개)
  drawWhipProjectile,
  drawPunchProjectile,
  drawAxeProjectile,
  drawSwordProjectile,
  // Ranged (6개)
  drawKnife,
  drawBow,
  drawPing,
  drawShard,
  drawAirdrop,
  drawFork,
  // Magic (4개)
  drawWand,
  drawBible,
  drawGarlic,
  drawPool,
  // Special (3개)
  drawBridge,
  drawBeam,
  drawLaser,
} from './projectiles';

// Environment (v4.5 terrain 모듈화 완료)
export type {
  TerrainType,
  TerrainFeatureParams,
} from './environment';

// Terrain 모듈 (v4.5 신규)
export {
  // Types
  type TerrainParams,
  // Individual terrain renderers
  drawClassroomTerrain,
  drawCafeteriaTerrain,
  drawGymTerrain,
  drawScienceTerrain,
  drawAdminTerrain,
  drawEscapeTerrain,
  drawSingularityTerrain,
  // Dispatcher
  drawTerrainByType,
} from './environment';

// Characters (모듈화 완료)
export {
  // Types
  type HairStyle,
  type EyeStyle,
  type AccessoryType,
  type RenderSkinColors,
  type AnimationState,
  type AnimationInput,
  // Constants
  HEAD_SIZE as CHAR_HEAD_SIZE,
  HEAD_Y as CHAR_HEAD_Y,
  BODY_WIDTH as CHAR_BODY_WIDTH,
  BODY_HEIGHT as CHAR_BODY_HEIGHT,
  LIMB_WIDTH as CHAR_LIMB_WIDTH,
  LIMB_LENGTH as CHAR_LIMB_LENGTH,
  // Styles
  CHARACTER_STYLES,
  CHARACTER_COLORS,
  getCharacterStyle,
  getCharacterColors,
  adjustHairForAccessory,
  // Utils
  darkenColor as charDarkenColor,
  lightenColor as charLightenColor,
  drawRoundedRect,
  drawLimb,
  easeInOutQuad,
  easeInOutCubic,
  // Animation
  calculateWalkAnimation,
  calculateIdleAnimation,
  calculateAnimationState,
  // Parts (v4.6)
  drawAccessory,
  type AccessoryRenderParams,
} from './characters';

// UI (v4.4 모듈화)
export {
  drawJoystick as drawJoystickUI,
  drawFormationWarning as drawFormationWarningUI,
  type JoystickState,
  type FormationWarningPosition,
} from './ui';

// MapObjects (v7.3 모듈화 - 이소메트릭 깊이 정렬)
export type {
  RenderableMapObject,
  DepthSortableEntity,
  DepthSortable,
  DepthComparator,
  CanvasTransformState,
} from './mapObjects';

export {
  // Depth sorting utilities
  calculateIsometricDepth,
  compareByDepth,
  sortObjectsByDepth,
  mergeByDepth,
  findObjectsUpToDepth,
  // Drawing functions
  drawMapObjectSprite,
  drawMapObjects,
  drawMapObjectsUpToDepth,
} from './mapObjects';

// Arena (Battle Royale) rendering
export {
  drawSafeZone,
  drawSafeZoneMinimap,
  drawSafeZoneWarning,
} from './arena';

// ===== 기존 rendering.ts facade =====
// drawEnemy, drawProjectile, drawCatSprite, drawJoystick, drawFormationWarning는 rendering.ts에서 export
