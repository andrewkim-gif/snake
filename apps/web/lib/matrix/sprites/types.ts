/**
 * game/sprites/types.ts - Sprite Animation System Types
 * 캐릭터 스프라이트 애니메이션 타입 정의
 */

import { PlayerClass } from '../types';

// Animation types available for each character (v5.8: attack removed)
export type AnimationType = 'idle' | 'walk' | 'hit' | 'death';

// All animation types as array for iteration
export const ANIMATION_TYPES: AnimationType[] = ['idle', 'walk', 'hit', 'death'];

// Sprite sheet metadata
export interface SpriteSheetConfig {
  file: string;           // Filename (e.g., 'walk.webp')
  frameWidth: number;     // Width of single frame in pixels
  frameHeight: number;    // Height of single frame in pixels
  frameCount: number;     // Number of frames in the sheet
  fps: number;            // Frames per second for animation
  loop?: boolean;         // Whether animation loops (default: true, false for death)
  offsetX?: number;       // X offset for rendering (default: 0)
  offsetY?: number;       // Y offset for rendering (default: 0)
  framesPerRow?: number;  // Frames per row in sprite sheet (default: frameCount for horizontal)
}

// Loaded sprite sheet with image data
export interface LoadedSpriteSheet extends SpriteSheetConfig {
  image: HTMLImageElement;
  loaded: boolean;
}

// Character sprite configuration
export interface CharacterSpriteConfig {
  characterId: PlayerClass;
  basePath: string;       // Base path to character folder (e.g., '/assets/cha/validator')
  animations: Partial<Record<AnimationType, SpriteSheetConfig>>;
  fallbackToCanvas?: boolean;  // Use drawCatSprite if sprite missing (default: true)
}

// Render options for drawing sprites
export interface SpriteRenderOptions {
  scale?: number;         // Scale factor (default: 1)
  flipX?: boolean;        // Flip horizontally (default: false)
  flipY?: boolean;        // Flip vertically (default: false)
  alpha?: number;         // Opacity 0-1 (default: 1)
  rotation?: number;      // Rotation in radians (default: 0)
  tint?: string;          // Tint color (optional)
}

// Animation state for hooks
export interface AnimationState {
  characterId: PlayerClass;
  animationType: AnimationType;
  currentFrame: number;
  isPlaying: boolean;
  isLoaded: boolean;
  startTime: number;
}

// Sprite manager cache key
export type SpriteCacheKey = `${PlayerClass}_${AnimationType}`;

// Helper to generate cache key
export function getSpriteCacheKey(characterId: PlayerClass, animationType: AnimationType): SpriteCacheKey {
  return `${characterId}_${animationType}`;
}

// Default sprite sheet config for missing animations
export const DEFAULT_SPRITE_CONFIG: Omit<SpriteSheetConfig, 'file'> = {
  frameWidth: 64,
  frameHeight: 64,
  frameCount: 8,
  fps: 12,
  loop: true,
};

// Animation-specific default configs (v5.8: attack removed)
// Note: All sprites are 1280x2560 = 5x5 grid of 256x512 frames = 24 total frames
export const ANIMATION_DEFAULTS: Record<AnimationType, Partial<SpriteSheetConfig>> = {
  idle: { frameCount: 24, fps: 12, loop: true, framesPerRow: 5 },   // 1280x2560, 256x512 frames
  walk: { frameCount: 24, fps: 12, loop: true, framesPerRow: 5 },   // 1280x2560, 256x512 frames
  hit: { frameCount: 24, fps: 10, loop: false, framesPerRow: 5 },
  death: { frameCount: 24, fps: 10, loop: false, framesPerRow: 5 },
};

// =====================================================
// 8-Direction Sprite System (v5.6)
// =====================================================

/**
 * 8방향 enum
 * velocity 기반으로 캐릭터가 바라보는 방향을 결정
 */
export enum Direction8 {
  FRONT = 'front',                 // 정면/아래 (↓) - 기본
  BACK = 'back',                   // 뒤/위 (↑)
  LEFT = 'left',                   // 왼쪽 (←)
  RIGHT = 'right',                 // 오른쪽 (→) - side_left 반전
  BACK_LEFT = 'back_left',         // 왼쪽위 (↖)
  BACK_RIGHT = 'back_right',       // 오른쪽위 (↗) - back_side_left 반전
  FRONT_LEFT = 'front_left',       // 왼쪽아래 (↙)
  FRONT_RIGHT = 'front_right'      // 오른쪽아래 (↘) - front_side_left 반전
}

/**
 * 캐릭터 8방향 스프라이트 세트 (5개 이미지)
 * 오른쪽 방향은 왼쪽 이미지를 반전하여 렌더링
 */
export interface CharacterDirection8Sprites {
  front: HTMLImageElement;
  back: HTMLImageElement;
  side_left: HTMLImageElement;
  back_side_left: HTMLImageElement;
  front_side_left: HTMLImageElement;
}

/**
 * 스프라이트 로딩 상태
 */
export interface SpriteLoadingState {
  total: number;
  loaded: number;
  failed: string[];
}

/**
 * 8방향 이미지 키 타입
 */
export type Direction8ImageKey = keyof CharacterDirection8Sprites;
