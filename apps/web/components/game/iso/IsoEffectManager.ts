/**
 * v27 Phase 7 — IsoEffectManager
 *
 * 건설/파괴/버프 이펙트 관리자
 * - AnimatedSprite로 이펙트 프레임 시퀀스 재생
 * - loop=false, onComplete에서 removeChild + pool 반환
 * - IsoLayer.Effects(12)에 배치
 * - 동시 재생 10개 상한
 *
 * @created 2026-03-09 Phase 7
 */

import { Container, AnimatedSprite } from 'pixi.js';
import {
  EFFECT_ANIMS,
  DESTRUCTIBLE_ANIMS,
  BUILDING_DESTROY_EFFECT_MAP,
  type EffectAnimDef,
  type DestructibleAnimDef,
} from '@/lib/iso/iso-asset-catalog';
import {
  getEffectFrames,
  getDestructibleFrames,
  isTexturesLoaded,
} from '@/lib/iso/iso-texture-loader';
import { ISO_TILE_SCALE } from './types';

// ─── 상수 ───

/** 최대 동시 이펙트 수 */
const MAX_CONCURRENT_EFFECTS = 10;

/** 이펙트 기본 스케일 (512px 이펙트 → 타일 대비 2× 크기) */
const EFFECT_SCALE_512 = ISO_TILE_SCALE * 0.5;
/** 이펙트 기본 스케일 (256px 이펙트 → 128px 표시) */
const EFFECT_SCALE_256 = ISO_TILE_SCALE;

// ─── 매니저 ───

export class IsoEffectManager {
  /** 이펙트 레이어 (IsoLayer.Effects = 12) */
  private readonly layer: Container;

  /** 현재 재생 중인 이펙트 목록 */
  private activeEffects: AnimatedSprite[] = [];

  constructor(effectLayer: Container) {
    this.layer = effectLayer;
  }

  /**
   * 건설 완료 이펙트 재생
   * LevelUp 이펙트 (15프레임, 15fps, 512x512) 사용
   */
  playConstructionEffect(worldX: number, worldY: number): void {
    this.playEffect('LevelUp', worldX, worldY);
  }

  /**
   * 건물 파괴 이펙트 재생
   * 건물 시각 등급에 따라 적합한 Destructible 애니메이션 선택
   * @param visualGrade 건물 시각 등급 (예: 'small_wood', 'medium_stone')
   */
  playDestroyEffect(worldX: number, worldY: number, visualGrade?: string): void {
    const effectName = visualGrade
      ? (BUILDING_DESTROY_EFFECT_MAP[visualGrade] ?? 'Wall Wood explosion Small')
      : 'Wall Wood explosion Small';

    this.playDestructible(effectName, worldX, worldY);
  }

  /**
   * 버프/칙령 이펙트 재생
   * Buff1~10 중 선택하여 대상 위치에 1회 재생
   * @param buffIndex 1~10 (없으면 랜덤)
   */
  playBuffEffect(worldX: number, worldY: number, buffIndex?: number): void {
    const idx = buffIndex ?? (Math.floor(Math.random() * 10) + 1);
    // Buff5 6과 Buff7 8은 특수 이름
    let name: string;
    if (idx === 5 || idx === 6) name = 'Buff5 6';
    else if (idx === 7 || idx === 8) name = 'Buff7 8';
    else name = `Buff${idx}`;

    this.playEffect(name, worldX, worldY);
  }

  /**
   * 일반 이펙트 재생 (Effects 카탈로그)
   */
  playEffect(effectName: string, worldX: number, worldY: number): void {
    if (!isTexturesLoaded()) return;
    if (this.activeEffects.length >= MAX_CONCURRENT_EFFECTS) {
      this.removeOldest();
    }

    const def = EFFECT_ANIMS.find(e => e.name === effectName);
    if (!def) return;

    const frames = getEffectFrames(effectName, def.frames);
    if (!frames || frames.length === 0) return;

    const sprite = new AnimatedSprite(frames);
    sprite.animationSpeed = def.fps / 60;
    sprite.loop = false;
    sprite.anchor.set(0.5, 0.75); // 이펙트 중심을 타일 중앙-상단에 배치
    const scale = def.size === 512 ? EFFECT_SCALE_512 : EFFECT_SCALE_256;
    sprite.scale.set(scale);
    sprite.x = worldX;
    sprite.y = worldY;
    sprite.label = `effect_${effectName}_${Date.now()}`;

    sprite.onComplete = () => {
      this.removeEffect(sprite);
    };

    this.layer.addChild(sprite);
    this.activeEffects.push(sprite);
    sprite.play();
  }

  /**
   * Destructible 이펙트 재생 (파괴 애니메이션)
   */
  private playDestructible(destructibleName: string, worldX: number, worldY: number): void {
    if (!isTexturesLoaded()) return;
    if (this.activeEffects.length >= MAX_CONCURRENT_EFFECTS) {
      this.removeOldest();
    }

    const def = DESTRUCTIBLE_ANIMS.find(d => d.name === destructibleName);
    if (!def) return;

    const frames = getDestructibleFrames(destructibleName, def.frames);
    if (!frames || frames.length === 0) return;

    const sprite = new AnimatedSprite(frames);
    sprite.animationSpeed = def.fps / 60;
    sprite.loop = false;
    sprite.anchor.set(0.5, 1.0); // Destructible은 256x256, 하단 정렬
    sprite.scale.set(EFFECT_SCALE_256);
    sprite.x = worldX;
    sprite.y = worldY;
    sprite.label = `destructible_${destructibleName}_${Date.now()}`;

    sprite.onComplete = () => {
      this.removeEffect(sprite);
    };

    this.layer.addChild(sprite);
    this.activeEffects.push(sprite);
    sprite.play();
  }

  /**
   * 특정 이펙트 제거
   */
  private removeEffect(sprite: AnimatedSprite): void {
    sprite.stop();
    if (sprite.parent) {
      sprite.parent.removeChild(sprite);
    }
    sprite.destroy();
    const idx = this.activeEffects.indexOf(sprite);
    if (idx >= 0) {
      this.activeEffects.splice(idx, 1);
    }
  }

  /**
   * 가장 오래된 이펙트 제거 (MAX_CONCURRENT 초과 시)
   */
  private removeOldest(): void {
    if (this.activeEffects.length === 0) return;
    const oldest = this.activeEffects[0];
    this.removeEffect(oldest);
  }

  /**
   * 활성 이펙트 수 반환
   */
  getActiveCount(): number {
    return this.activeEffects.length;
  }

  /**
   * 전체 정리
   */
  destroy(): void {
    for (const sprite of this.activeEffects) {
      sprite.stop();
      if (sprite.parent) {
        sprite.parent.removeChild(sprite);
      }
      sprite.destroy();
    }
    this.activeEffects = [];
  }
}
