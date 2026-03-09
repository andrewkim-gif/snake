/**
 * game/sprites/SpriteAnimationManager.ts - Core Sprite Animation Manager
 * 싱글톤 패턴으로 스프라이트 로딩, 캐싱, 렌더링 관리
 */

import { PlayerClass } from '../types';
import {
  AnimationType,
  LoadedSpriteSheet,
  SpriteRenderOptions,
  SpriteCacheKey,
  getSpriteCacheKey,
  ANIMATION_TYPES,
} from './types';
import {
  CHARACTER_SPRITE_CONFIGS,
  getSpritePath,
  getAnimationConfig,
  ALL_CHARACTER_IDS,
} from './config';

/**
 * SpriteAnimationManager - Singleton class for sprite management
 */
export class SpriteAnimationManager {
  private static instance: SpriteAnimationManager | null = null;

  // Loaded sprite sheets cache
  private sprites: Map<SpriteCacheKey, LoadedSpriteSheet> = new Map();

  // Loading promises for deduplication
  private loadingPromises: Map<SpriteCacheKey, Promise<LoadedSpriteSheet | null>> = new Map();

  // Track which characters have been fully loaded
  private loadedCharacters: Set<PlayerClass> = new Set();

  // Private constructor for singleton
  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): SpriteAnimationManager {
    if (!SpriteAnimationManager.instance) {
      SpriteAnimationManager.instance = new SpriteAnimationManager();
    }
    return SpriteAnimationManager.instance;
  }

  /**
   * Reset instance (for testing)
   */
  static resetInstance(): void {
    SpriteAnimationManager.instance = null;
  }

  /**
   * Load a single sprite sheet
   */
  async loadSprite(
    characterId: PlayerClass,
    animationType: AnimationType
  ): Promise<LoadedSpriteSheet | null> {
    const cacheKey = getSpriteCacheKey(characterId, animationType);

    // Return cached sprite
    if (this.sprites.has(cacheKey)) {
      return this.sprites.get(cacheKey)!;
    }

    // Return existing loading promise
    if (this.loadingPromises.has(cacheKey)) {
      return this.loadingPromises.get(cacheKey)!;
    }

    // Get sprite path and config
    const path = getSpritePath(characterId, animationType);
    const config = getAnimationConfig(characterId, animationType);

    if (!path || !config) {
      console.warn(`[SpriteManager] No config for ${characterId}/${animationType}`);
      return null;
    }

    // Create loading promise
    const loadPromise = new Promise<LoadedSpriteSheet | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        const loadedSheet: LoadedSpriteSheet = {
          ...config,
          image: img,
          loaded: true,
        };
        this.sprites.set(cacheKey, loadedSheet);
        this.loadingPromises.delete(cacheKey);
        resolve(loadedSheet);
      };

      img.onerror = () => {
        console.warn(`[SpriteManager] Failed to load: ${path}`);
        this.loadingPromises.delete(cacheKey);
        resolve(null);
      };

      img.src = path;
    });

    this.loadingPromises.set(cacheKey, loadPromise);
    return loadPromise;
  }

  /**
   * Load all animations for a character
   */
  async loadCharacter(characterId: PlayerClass): Promise<boolean> {
    if (this.loadedCharacters.has(characterId)) {
      return true;
    }

    const loadPromises = ANIMATION_TYPES.map((animType) =>
      this.loadSprite(characterId, animType)
    );

    const results = await Promise.all(loadPromises);
    const anyLoaded = results.some((r) => r !== null);

    if (anyLoaded) {
      this.loadedCharacters.add(characterId);
    }

    return anyLoaded;
  }

  /**
   * Preload all characters
   */
  async preloadAll(): Promise<void> {
    const loadPromises = ALL_CHARACTER_IDS.map((charId) =>
      this.loadCharacter(charId)
    );
    await Promise.all(loadPromises);
  }

  /**
   * Check if character sprites are loaded
   */
  isCharacterLoaded(characterId: PlayerClass): boolean {
    return this.loadedCharacters.has(characterId);
  }

  /**
   * Check if specific animation is loaded
   */
  isAnimationLoaded(characterId: PlayerClass, animationType: AnimationType): boolean {
    const cacheKey = getSpriteCacheKey(characterId, animationType);
    return this.sprites.has(cacheKey);
  }

  /**
   * Get loaded sprite sheet
   */
  getSprite(
    characterId: PlayerClass,
    animationType: AnimationType
  ): LoadedSpriteSheet | null {
    const cacheKey = getSpriteCacheKey(characterId, animationType);
    return this.sprites.get(cacheKey) || null;
  }

  /**
   * Calculate current frame based on time
   */
  calculateFrame(sprite: LoadedSpriteSheet, time: number, startTime: number = 0): number {
    const elapsedMs = time - startTime;
    const frameDuration = 1000 / sprite.fps;
    const totalFrames = sprite.frameCount;
    const rawFrame = Math.floor(elapsedMs / frameDuration);

    if (sprite.loop === false) {
      // Non-looping: clamp to last frame
      return Math.min(rawFrame, totalFrames - 1);
    }

    // Looping: wrap around
    return rawFrame % totalFrames;
  }

  /**
   * Check if non-looping animation is complete
   */
  isAnimationComplete(sprite: LoadedSpriteSheet, time: number, startTime: number = 0): boolean {
    if (sprite.loop !== false) return false;
    const elapsedMs = time - startTime;
    const frameDuration = 1000 / sprite.fps;
    const totalFrames = sprite.frameCount;
    return Math.floor(elapsedMs / frameDuration) >= totalFrames;
  }

  /**
   * Draw a sprite frame to canvas
   * Returns false if sprite not loaded (caller should use fallback)
   */
  drawFrame(
    ctx: CanvasRenderingContext2D,
    characterId: PlayerClass,
    animationType: AnimationType,
    time: number,
    x: number,
    y: number,
    options: SpriteRenderOptions = {}
  ): boolean {
    const sprite = this.getSprite(characterId, animationType);

    if (!sprite || !sprite.loaded) {
      return false; // Signal to use fallback
    }

    const {
      scale = 1,
      flipX = false,
      flipY = false,
      alpha = 1,
      rotation = 0,
    } = options;

    const frame = this.calculateFrame(sprite, time);
    const { frameWidth, frameHeight, offsetX = 0, offsetY = 0, framesPerRow } = sprite;

    // Source rectangle (from sprite sheet) - supports grid layout
    const cols = framesPerRow || sprite.frameCount; // Default to single row
    const srcX = (frame % cols) * frameWidth;
    const srcY = Math.floor(frame / cols) * frameHeight;

    // Destination dimensions
    const destWidth = frameWidth * scale;
    const destHeight = frameHeight * scale;

    ctx.save();

    // Apply transformations
    ctx.globalAlpha = alpha;
    ctx.translate(x + destWidth / 2, y + destHeight / 2);

    if (rotation !== 0) {
      ctx.rotate(rotation);
    }

    if (flipX || flipY) {
      ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
    }

    // Draw sprite frame
    ctx.drawImage(
      sprite.image,
      srcX,
      srcY,
      frameWidth,
      frameHeight,
      -destWidth / 2 + offsetX * scale,
      -destHeight / 2 + offsetY * scale,
      destWidth,
      destHeight
    );

    ctx.restore();

    return true;
  }

  /**
   * Draw centered at position (useful for game entities)
   */
  drawFrameCentered(
    ctx: CanvasRenderingContext2D,
    characterId: PlayerClass,
    animationType: AnimationType,
    time: number,
    centerX: number,
    centerY: number,
    options: SpriteRenderOptions = {}
  ): boolean {
    const sprite = this.getSprite(characterId, animationType);
    if (!sprite) return false;

    const { scale = 1 } = options;
    const destWidth = sprite.frameWidth * scale;
    const destHeight = sprite.frameHeight * scale;

    return this.drawFrame(
      ctx,
      characterId,
      animationType,
      time,
      centerX - destWidth / 2,
      centerY - destHeight / 2,
      options
    );
  }

  /**
   * Get frame count for animation
   */
  getFrameCount(characterId: PlayerClass, animationType: AnimationType): number {
    const sprite = this.getSprite(characterId, animationType);
    return sprite?.frameCount || 0;
  }

  /**
   * Get animation duration in milliseconds
   */
  getAnimationDuration(characterId: PlayerClass, animationType: AnimationType): number {
    const sprite = this.getSprite(characterId, animationType);
    if (!sprite) return 0;
    return (sprite.frameCount / sprite.fps) * 1000;
  }

  /**
   * Clear all cached sprites
   */
  clearCache(): void {
    this.sprites.clear();
    this.loadingPromises.clear();
    this.loadedCharacters.clear();
  }

  /**
   * Get loading status
   */
  getLoadingStatus(): {
    loaded: number;
    total: number;
    characters: PlayerClass[];
  } {
    const total = ALL_CHARACTER_IDS.length * ANIMATION_TYPES.length;
    const loaded = this.sprites.size;
    const characters = Array.from(this.loadedCharacters);
    return { loaded, total, characters };
  }
}

// Export singleton getter
export const getSpriteManager = () => SpriteAnimationManager.getInstance();
