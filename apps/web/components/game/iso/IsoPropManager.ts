/**
 * v27 Phase 7 — IsoPropManager
 *
 * Props 카탈로그(11종)의 애니메이션 소품을 건물 주변에 배치
 * - Fire, Torch, Gas 등 루프 애니메이션 배치
 * - 건물 타입에 맞는 소품 선택 (BUILDING_PROP_MAP 참조)
 * - IsoLayer.Misc(6)에 AnimatedSprite로 배치
 *
 * @created 2026-03-09 Phase 7
 */

import { Container, AnimatedSprite } from 'pixi.js';
import {
  PROP_ANIMS,
  BUILDING_PROP_MAP,
  type PropAnimDef,
} from '@/lib/iso/iso-asset-catalog';
import {
  getPropFrames,
  isTexturesLoaded,
} from '@/lib/iso/iso-texture-loader';
import { ISO_TILE_SCALE, ISO_TILE_WIDTH, ISO_TILE_HEIGHT, type BuildingInstance } from './types';
import { tileToScreen } from './IsoTilemap';

// ─── 상수 ───

/** 최대 Props 수 (성능 보호) */
const MAX_PROPS = 30;

// ─── 매니저 ───

export class IsoPropManager {
  /** Misc 레이어 (IsoLayer.Misc = 6) */
  private readonly layer: Container;

  /** 활성 Props AnimatedSprite 목록 */
  private activeProps: AnimatedSprite[] = [];

  /** 맵 크기 */
  private readonly mapSize: number;

  /** 시드 */
  private readonly seed: number;

  constructor(miscLayer: Container, mapSize: number, seed: number) {
    this.layer = miscLayer;
    this.mapSize = mapSize;
    this.seed = seed;
  }

  /**
   * 건물 목록을 기반으로 Props 배치
   * 각 건물의 defId에 따라 BUILDING_PROP_MAP에서 소품 선택
   */
  placePropsForBuildings(buildings: readonly BuildingInstance[]): void {
    if (!isTexturesLoaded()) return;

    for (const building of buildings) {
      if (this.activeProps.length >= MAX_PROPS) break;

      const propNames = BUILDING_PROP_MAP[building.defId];
      if (!propNames || propNames.length === 0) continue;

      // 시드 기반으로 소품 선택
      const h = this.hashBuilding(building.tileX, building.tileY);

      // 각 건물에 1개 소품 배치 (50% 확률)
      if ((h % 100) >= 50) continue;

      const propName = propNames[h % propNames.length];
      const def = PROP_ANIMS.find(p => p.name === propName);
      if (!def) continue;

      // 건물 인접 타일 중 하나 선택 (SE 방향 우선)
      const adjX = building.tileX + building.sizeW;
      const adjY = building.tileY + Math.floor(building.sizeH / 2);

      if (adjX >= this.mapSize || adjY >= this.mapSize) continue;

      this.placeProp(def, adjX, adjY);
    }
  }

  /**
   * 단일 Prop 배치
   */
  private placeProp(def: PropAnimDef, tileX: number, tileY: number): void {
    const frames = getPropFrames(def.name, def.frames);
    if (!frames || frames.length === 0) return;

    const sprite = new AnimatedSprite(frames);
    sprite.animationSpeed = def.fps / 60;
    sprite.loop = def.loop;
    sprite.anchor.set(0.5, 1.0);
    sprite.scale.set(ISO_TILE_SCALE);

    const { sx, sy } = tileToScreen(tileX, tileY);
    sprite.x = sx;
    sprite.y = sy + ISO_TILE_HEIGHT / 2;
    sprite.zIndex = tileY * this.mapSize + tileX;
    sprite.label = `prop_${def.name}_${tileX}_${tileY}`;

    this.layer.addChild(sprite);
    this.activeProps.push(sprite);

    if (def.loop) {
      sprite.play();
    } else {
      // 비루프 소품 (Barrel 등)은 정지 상태로 첫 프레임 표시
      sprite.gotoAndStop(0);
    }
  }

  /**
   * 뷰포트 컬링: 뷰포트 밖 루프 소품 stop, 안에서 play
   */
  cullViewport(
    viewLeft: number,
    viewRight: number,
    viewTop: number,
    viewBottom: number,
  ): void {
    for (const sprite of this.activeProps) {
      const inView = (
        sprite.x + ISO_TILE_WIDTH > viewLeft &&
        sprite.x - ISO_TILE_WIDTH < viewRight &&
        sprite.y + ISO_TILE_HEIGHT * 3 > viewTop &&
        sprite.y - ISO_TILE_HEIGHT < viewBottom
      );

      sprite.visible = inView;

      if (sprite.loop) {
        if (inView && !sprite.playing) {
          sprite.play();
        } else if (!inView && sprite.playing) {
          sprite.stop();
        }
      }
    }
  }

  /**
   * 활성 Props 수 반환
   */
  getActiveCount(): number {
    return this.activeProps.length;
  }

  /**
   * 전체 정리
   */
  destroy(): void {
    for (const sprite of this.activeProps) {
      sprite.stop();
      if (sprite.parent) {
        sprite.parent.removeChild(sprite);
      }
      sprite.destroy();
    }
    this.activeProps = [];
  }

  /** 시드 기반 해시 */
  private hashBuilding(x: number, y: number): number {
    let h = this.seed + 9999;
    h = ((h << 5) - h + x) | 0;
    h = ((h << 5) - h + y) | 0;
    h = ((h << 5) - h + x * 7 + y * 13) | 0;
    return Math.abs(h);
  }
}
