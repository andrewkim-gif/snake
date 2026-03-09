/**
 * game/sprites/index.ts - Sprite Animation System Public API
 * 스프라이트 애니메이션 시스템 공개 인터페이스
 */

// Types
export type {
  AnimationType,
  SpriteSheetConfig,
  LoadedSpriteSheet,
  CharacterSpriteConfig,
  SpriteRenderOptions,
  AnimationState,
  SpriteCacheKey,
} from './types';

export {
  ANIMATION_TYPES,
  DEFAULT_SPRITE_CONFIG,
  ANIMATION_DEFAULTS,
  getSpriteCacheKey,
} from './types';

// Config
export {
  CHARACTER_SPRITE_CONFIGS,
  getCharacterSpriteConfig,
  getAnimationConfig,
  getSpritePath,
  ALL_CHARACTER_IDS,
} from './config';

// Manager
export {
  SpriteAnimationManager,
  getSpriteManager,
} from './SpriteAnimationManager';

// =====================================================
// 8-Direction Sprite System (v5.6)
// =====================================================

// Direction8 Types
export {
  Direction8,
} from './types';

export type {
  CharacterDirection8Sprites,
  SpriteLoadingState,
  Direction8ImageKey,
} from './types';

// Direction utilities
export {
  getDirection8FromVelocity,
  needsFlip,
  getImageKeyForDirection,
  getDirectionNameKo,
} from './direction';

// Loader
export {
  preloadAllCharacterSprites,
  loadCharacterSpritesIfNeeded,
  getCharacterSprites,
  isSpritesLoaded,
  isAllSpritesLoaded,
  getLoadingState,
  clearSpriteCache,
} from './loader';

// Renderer
export type { CharacterPart } from './renderer'; // v5.9.3: 스플릿 렌더링 파트 타입

export {
  drawCharacterSprite,
  drawCharacterSpriteWithHit,
  drawCharacterSpriteAdvanced,
} from './renderer';

// =====================================================
// 8x8 Sprite Sheet System (v5.7)
// =====================================================

export type { SpriteSheetAnimType, SpriteSheetPart } from './spriteSheet';

export {
  getRowIndexFromDirection8,
  getCurrentFrame,
  loadSpriteSheet,
  isSpriteSheetLoaded,
  drawSpriteSheet,
  drawSpriteSheetWithHit,
  clearSpriteSheetCache,
} from './spriteSheet';
