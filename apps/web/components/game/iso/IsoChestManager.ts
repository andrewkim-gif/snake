/**
 * v27 Phase 7 — IsoChestManager
 *
 * Chest A/B를 맵에 배치 (IsoLayer.Chest = 10)
 * - 수확 가능한 보물함 역할
 * - market/government/warehouse 인근에 배치
 * - 시드 기반 결정론적 배치 (같은 맵 = 같은 체스트)
 *
 * @created 2026-03-09 Phase 7
 */

import { Container, Sprite } from 'pixi.js';
import {
  CHEST_SERIES,
  CHEST_ELIGIBLE_BUILDINGS,
  type ChestSeries,
} from '@/lib/iso/iso-asset-catalog';
import {
  getChestTexture,
  isTexturesLoaded,
} from '@/lib/iso/iso-texture-loader';
import {
  ISO_TILE_SCALE,
  ISO_TILE_WIDTH,
  ISO_TILE_HEIGHT,
  type BuildingInstance,
} from './types';
import { tileToScreen } from './IsoTilemap';

// ─── 상수 ───

/** 최대 체스트 수 */
const MAX_CHESTS = 20;

// ─── 매니저 ───

export class IsoChestManager {
  /** Chest 레이어 (IsoLayer.Chest = 10) */
  private readonly layer: Container;

  /** 활성 Chest 스프라이트 목록 */
  private chestSprites: Sprite[] = [];

  /** 맵 크기 */
  private readonly mapSize: number;

  /** 시드 */
  private readonly seed: number;

  /** 점유 맵 참조 (건물 위치 피하기) */
  private readonly occupancy: Map<string, string>;

  constructor(
    chestLayer: Container,
    mapSize: number,
    seed: number,
    occupancy: Map<string, string>,
  ) {
    this.layer = chestLayer;
    this.layer.sortableChildren = true;
    this.mapSize = mapSize;
    this.seed = seed;
    this.occupancy = occupancy;
  }

  /**
   * 건물 목록을 기반으로 Chest 배치
   * CHEST_ELIGIBLE_BUILDINGS에 해당하는 건물 인근에 시드 기반 배치
   */
  placeChestsForBuildings(buildings: readonly BuildingInstance[]): void {
    if (!isTexturesLoaded()) return;

    const eligibleBuildings = buildings.filter(b =>
      CHEST_ELIGIBLE_BUILDINGS.includes(b.defId),
    );

    for (const building of eligibleBuildings) {
      if (this.chestSprites.length >= MAX_CHESTS) break;

      const h = this.hashChest(building.tileX, building.tileY);

      // 각 적격 건물에 ~60% 확률로 체스트 배치
      if ((h % 100) >= 60) continue;

      // 건물 인접 빈 타일 찾기
      const adj = this.findAdjacentEmpty(building);
      if (!adj) continue;

      // 체스트 시리즈/변형 선택
      const isA = (h % 3) < 2; // A가 2/3 확률
      const series: ChestSeries = isA ? 'A' : 'B';
      const variants = CHEST_SERIES[series].variants;
      const variant = variants[h % variants.length];

      this.placeChest(series, variant, adj.tileX, adj.tileY);
    }
  }

  /**
   * 단일 Chest 배치
   */
  private placeChest(
    series: string,
    variant: number,
    tileX: number,
    tileY: number,
  ): void {
    const texture = getChestTexture(series, variant);
    if (!texture) return;

    const { sx, sy } = tileToScreen(tileX, tileY);
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5, 1.0);
    sprite.scale.set(ISO_TILE_SCALE);
    sprite.x = sx;
    sprite.y = sy + ISO_TILE_HEIGHT / 2;
    sprite.zIndex = tileY * this.mapSize + tileX;
    sprite.label = `chest_${series}${variant}_${tileX}_${tileY}`;

    this.layer.addChild(sprite);
    this.chestSprites.push(sprite);
  }

  /**
   * 건물 인접 빈 타일 찾기
   */
  private findAdjacentEmpty(
    building: BuildingInstance,
  ): { tileX: number; tileY: number } | null {
    // 건물 주변 4방향(+1) 순회 (SE → S → E → NE 우선)
    const candidates: { tileX: number; tileY: number }[] = [];

    for (let dy = -1; dy <= building.sizeH; dy++) {
      for (let dx = -1; dx <= building.sizeW; dx++) {
        // 건물 내부 스킵
        if (dx >= 0 && dx < building.sizeW && dy >= 0 && dy < building.sizeH) continue;

        const tx = building.tileX + dx;
        const ty = building.tileY + dy;

        if (tx < 0 || tx >= this.mapSize || ty < 0 || ty >= this.mapSize) continue;
        if (this.occupancy.has(`${tx},${ty}`)) continue;

        candidates.push({ tileX: tx, tileY: ty });
      }
    }

    if (candidates.length === 0) return null;

    // 시드 기반으로 후보 중 하나 선택
    const h = this.hashChest(building.tileX + 100, building.tileY + 100);
    return candidates[h % candidates.length];
  }

  /**
   * 체스트 수 반환
   */
  getChestCount(): number {
    return this.chestSprites.length;
  }

  /**
   * 전체 정리
   */
  destroy(): void {
    for (const sprite of this.chestSprites) {
      if (sprite.parent) {
        sprite.parent.removeChild(sprite);
      }
      sprite.destroy();
    }
    this.chestSprites = [];
  }

  /** 시드 기반 해시 */
  private hashChest(x: number, y: number): number {
    let h = this.seed + 7777;
    h = ((h << 5) - h + x) | 0;
    h = ((h << 5) - h + y) | 0;
    h = ((h << 5) - h + x * 11 + y * 17) | 0;
    return Math.abs(h);
  }
}
