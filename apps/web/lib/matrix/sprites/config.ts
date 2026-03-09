/**
 * game/sprites/config.ts - Character Sprite Configurations
 * 9개 캐릭터의 스프라이트 설정
 */

import { PlayerClass } from '../types';
import {
  CharacterSpriteConfig,
  SpriteSheetConfig,
  AnimationType,
  ANIMATION_DEFAULTS,
  DEFAULT_SPRITE_CONFIG
} from './types';

// Default sprite sheet dimensions (legacy placeholder)
const DEFAULT_FRAME_WIDTH = 320;
const DEFAULT_FRAME_HEIGHT = 320;
const DEFAULT_FRAMES_PER_ROW = 8;

// NEO specific sprite sheet dimensions
// Sheet: 1280x2560, Frame: 256x512, Grid: 5x5, Frames: 24
const NEO_FRAME_WIDTH = 256;
const NEO_FRAME_HEIGHT = 512;
const NEO_FRAMES_PER_ROW = 5;
const NEO_FRAME_COUNT = 24;

// Sprite sheet dimensions (v6.0)
// Sheet: 1792x1024, Frame: 128x128, Grid: 14x8, Frames: 112
const SPRITE_FRAME_WIDTH = 128;
const SPRITE_FRAME_HEIGHT = 128;
const SPRITE_FRAMES_PER_ROW = 14;
const SPRITE_FRAME_COUNT = 112;

// Helper to create animation config with defaults
function createAnimConfig(
  file: string,
  animationType: AnimationType,
  overrides?: Partial<SpriteSheetConfig>
): SpriteSheetConfig {
  return {
    file,
    frameWidth: DEFAULT_FRAME_WIDTH,
    frameHeight: DEFAULT_FRAME_HEIGHT,
    framesPerRow: DEFAULT_FRAMES_PER_ROW,
    ...ANIMATION_DEFAULTS[animationType],
    ...overrides,
  } as SpriteSheetConfig;
}

// Helper to create NEO's animation config
function createNeoAnimConfig(
  file: string,
  animationType: AnimationType,
  overrides?: Partial<SpriteSheetConfig>
): SpriteSheetConfig {
  return {
    file,
    frameWidth: NEO_FRAME_WIDTH,
    frameHeight: NEO_FRAME_HEIGHT,
    framesPerRow: NEO_FRAMES_PER_ROW,
    frameCount: NEO_FRAME_COUNT,
    ...ANIMATION_DEFAULTS[animationType],
    ...overrides,
  } as SpriteSheetConfig;
}

// Sprite animation config (v5.8: attack removed)
// 파일 경로: /assets/cha/{characterId}/sprite/{characterId}_{action}.png
// 파일명 매핑: idle→idle, walk→walk, hit→takedamage, death→die
const ANIM_FILE_MAP: Record<AnimationType, string> = {
  idle: 'idle',
  walk: 'walk',
  hit: 'takedamage',
  death: 'die',
};

function createSpriteAnimConfig(characterId: string, animationType: AnimationType, fps: number = 12): SpriteSheetConfig {
  const fileName = ANIM_FILE_MAP[animationType] || animationType;
  return {
    file: `${characterId}/sprite/${characterId}_${fileName}.png`,
    frameWidth: SPRITE_FRAME_WIDTH,
    frameHeight: SPRITE_FRAME_HEIGHT,
    framesPerRow: SPRITE_FRAMES_PER_ROW,
    frameCount: SPRITE_FRAME_COUNT,
    fps,
    loop: animationType !== 'death',
  };
}

// Character animation set (v5.8: attack removed)
// 경로: /assets/cha/{characterId}/sprite/{characterId}_{action}.png
function createCharacterAnimationSet(characterId: string): Record<AnimationType, SpriteSheetConfig> {
  return {
    idle: createSpriteAnimConfig(characterId, 'idle', 12),
    walk: createSpriteAnimConfig(characterId, 'walk', 12),
    hit: createSpriteAnimConfig(characterId, 'hit', 10),
    death: createSpriteAnimConfig(characterId, 'death', 10),
  };
}

/**
 * Character Sprite Configurations
 * v4.9: 플랫 파일 구조 - /assets/cha/{characterId}_{animationType}.webp
 */
export const CHARACTER_SPRITE_CONFIGS: Record<PlayerClass, CharacterSpriteConfig> = {
  // NEO - The Awakened Developer
  neo: {
    characterId: 'neo',
    basePath: '/assets/cha',
    animations: createCharacterAnimationSet('neo'),
    fallbackToCanvas: true,
  },

  // TANK - The Operator
  tank: {
    characterId: 'tank',
    basePath: '/assets/cha',
    animations: createCharacterAnimationSet('tank'),
    fallbackToCanvas: true,
  },

  // CYPHER - The Avenger
  cypher: {
    characterId: 'cypher',
    basePath: '/assets/cha',
    animations: createCharacterAnimationSet('cypher'),
    fallbackToCanvas: true,
  },

  // MORPHEUS - The Prophet
  morpheus: {
    characterId: 'morpheus',
    basePath: '/assets/cha',
    animations: createCharacterAnimationSet('morpheus'),
    fallbackToCanvas: true,
  },

  // NIOBE - AI Safety Architect
  niobe: {
    characterId: 'niobe',
    basePath: '/assets/cha',
    animations: createCharacterAnimationSet('niobe'),
    fallbackToCanvas: true,
  },

  // ORACLE - The Pattern Seer
  oracle: {
    characterId: 'oracle',
    basePath: '/assets/cha',
    animations: createCharacterAnimationSet('oracle'),
    fallbackToCanvas: true,
  },

  // TRINITY - The Shadow
  trinity: {
    characterId: 'trinity',
    basePath: '/assets/cha',
    animations: createCharacterAnimationSet('trinity'),
    fallbackToCanvas: true,
  },

  // MOUSE - The Swarm Master
  mouse: {
    characterId: 'mouse',
    basePath: '/assets/cha',
    animations: createCharacterAnimationSet('mouse'),
    fallbackToCanvas: true,
  },

  // DOZER - The Destroyer
  dozer: {
    characterId: 'dozer',
    basePath: '/assets/cha',
    animations: createCharacterAnimationSet('dozer'),
    fallbackToCanvas: true,
  },
};

/**
 * Get sprite config for a character
 */
export function getCharacterSpriteConfig(characterId: PlayerClass): CharacterSpriteConfig | null {
  return CHARACTER_SPRITE_CONFIGS[characterId] || null;
}

/**
 * Get animation config for a character
 */
export function getAnimationConfig(
  characterId: PlayerClass,
  animationType: AnimationType
): SpriteSheetConfig | null {
  const charConfig = CHARACTER_SPRITE_CONFIGS[characterId];
  if (!charConfig) return null;
  return charConfig.animations[animationType] || null;
}

/**
 * Get full sprite path
 */
export function getSpritePath(characterId: PlayerClass, animationType: AnimationType): string | null {
  const charConfig = CHARACTER_SPRITE_CONFIGS[characterId];
  const animConfig = charConfig?.animations[animationType];
  if (!charConfig || !animConfig) return null;
  return `${charConfig.basePath}/${animConfig.file}`;
}

/**
 * All playable character IDs
 */
export const ALL_CHARACTER_IDS: PlayerClass[] = [
  'neo', 'tank', 'cypher', 'morpheus',
  'niobe', 'oracle', 'trinity', 'mouse', 'dozer'
];
