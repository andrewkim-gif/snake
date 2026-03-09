/**
 * v27 Phase 2+3+4 — IsoTilemap (완전 재작성)
 *
 * 15-Layer Sprite 기반 아이소메트릭 렌더링 엔진
 * - PixiJS 8 Sprite 기반 (기존 Graphics 기반에서 교체)
 * - 바이옴별 Ground 텍스처 + 2단계 Auto-Tiling
 * - 128×64 타일 좌표계 (256px 에셋 × 0.5 스케일)
 * - 뷰포트 컬링 O(visible)
 *
 * Phase 3: 장식 레이어 배치
 * - Flora 배치 (Layer 4): 바이옴별 꽃/풀/덤불 15-25% 밀도
 * - Tree 배치 (Layer 7): 바이옴별 나무 종류, anchor(0.5, 0.85)
 * - Stone/Path (Layer 2): 건물 주변 돌바닥 포장
 * - Shadow (Layer 3): 나무/건물 SE방향 그림자 alpha=0.3
 * - Misc 소품 (Layer 6): 건물 인접 맥락적 + 필드 5-10% 밀도
 * - 깊이 정렬: sortableChildren + zIndex = tileY * mapWidth + tileX
 *
 * Phase 4: 건물 컴포지트 시스템
 * - Wall+Door+Roof 오버레이 레이어링 (같은 타일 좌표에 겹침)
 * - 53 건물 → 6 시각 등급 매핑 (building-composites.ts)
 * - 기후대별 Wall/Roof 시리즈 오버라이드 (iso-biome-defs.ts)
 * - WallFlora (Layer 8): 10-20% 확률 담쟁이/덩굴 오버레이
 * - 건물 배치 UI: CLIENT_BUILDING_DEFS 53종 전체 사용 (B-5 버그 수정)
 *
 * @rewrite 2026-03-09 Phase 2+3+4
 */

import { Container, Graphics, Sprite } from 'pixi.js';
import {
  TileType,
  TILE_DEFS,
  ISO_TILE_WIDTH,
  ISO_TILE_HEIGHT,
  ISO_TILE_SCALE,
  BUILDING_DEFS,
  type BuildingDef,
  type BuildingInstance,
  type TileCoord,
  type MapTier,
  MAP_SIZES,
  type IsoCameraState,
  ISO_CAMERA_DEFAULTS,
  ISO_ZOOM_MIN,
  ISO_ZOOM_MAX,
  ISO_ZOOM_SPEED,
  IsoLayer,
  ISO_LAYER_NAMES,
  type BiomeType,
  type BiomeDef,
  type IsoTile,
  type BuildingComposite,
} from './types';
import { getCountryBiome } from '@/lib/iso/country-biome-map';
import { BIOME_DEFS } from '@/lib/iso/iso-biome-defs';
import {
  getSafeGroundTexture,
  getGroundTexture,
  getFloraTexture,
  getTreeTexture,
  getStoneTexture,
  getShadowTexture,
  getMiscTexture,
  getWallTexture,
  getRoofTexture,
  getDoorTexture,
  getWallFloraTexture,
  isTexturesLoaded as isV27TexturesLoaded,
} from '@/lib/iso/iso-texture-loader';
import {
  GROUND_SAFE_FULL_VARIANTS,
  GROUND_A_BOUNDARY_MAP,
  type GroundSeries,
  type BoundaryDirection,
  FLORA_SERIES,
  type FloraSeries,
  TREE_SERIES,
  type TreeSeries,
  MISC_SERIES,
  type MiscSeries,
  MISC_B_SUBCATEGORY,
  WALLFLORA_SERIES,
} from '@/lib/iso/iso-asset-catalog';
import { getBuildingComposite } from '@/lib/iso/building-composites';
import {
  CLIENT_BUILDING_DEFS,
  BUILDING_DEF_MAP,
  type ClientBuildingDef,
} from './ui/buildingDefs';

// ─── 상수 ───
const LAYER_COUNT = 15;
const DEFAULT_MAP_SIZE = 32;

// ─── 좌표 변환 유틸 ───

/** 타일 좌표 → 아이소메트릭 스크린 좌표 */
export function tileToScreen(tileX: number, tileY: number): { sx: number; sy: number } {
  const sx = (tileX - tileY) * (ISO_TILE_WIDTH / 2);
  const sy = (tileX + tileY) * (ISO_TILE_HEIGHT / 2);
  return { sx, sy };
}

/** 스크린 좌표 → 타일 좌표 (반올림) */
export function screenToTile(sx: number, sy: number): TileCoord {
  const tileX = Math.floor((sx / (ISO_TILE_WIDTH / 2) + sy / (ISO_TILE_HEIGHT / 2)) / 2);
  const tileY = Math.floor((sy / (ISO_TILE_HEIGHT / 2) - sx / (ISO_TILE_WIDTH / 2)) / 2);
  return { tileX, tileY };
}

// ─── 해시 유틸 ───

/** 결정론적 해시 (시드 기반) */
function hashTile(x: number, y: number, seed: number): number {
  let h = seed;
  h = ((h << 5) - h + x) | 0;
  h = ((h << 5) - h + y) | 0;
  h = ((h << 5) - h + x * 7 + y * 13) | 0;
  return Math.abs(h);
}

// ─── 맵 생성 (프로시저럴) ───

/** 절차적 지형 생성 */
function generateTerrain(mapSize: number, seed: number = 42): TileType[][] {
  const grid: TileType[][] = [];

  const hash = (x: number, y: number): number => {
    let h = seed;
    h = ((h << 5) - h + x) | 0;
    h = ((h << 5) - h + y) | 0;
    h = ((h << 5) - h + x * 7 + y * 13) | 0;
    return (Math.abs(h) % 1000) / 1000;
  };

  for (let y = 0; y < mapSize; y++) {
    const row: TileType[] = [];
    for (let x = 0; x < mapSize; x++) {
      const n = hash(x, y);
      const distFromCenter = Math.sqrt(
        Math.pow((x - mapSize / 2) / (mapSize / 2), 2) +
        Math.pow((y - mapSize / 2) / (mapSize / 2), 2)
      );

      let type: TileType;
      if (distFromCenter > 0.85) {
        type = TileType.Water;
      } else if (distFromCenter > 0.75) {
        type = n > 0.5 ? TileType.Beach : TileType.Water;
      } else if (n > 0.85) {
        type = TileType.Mountain;
      } else if (n > 0.7) {
        type = TileType.Forest;
      } else if (n > 0.55 && distFromCenter < 0.3) {
        type = TileType.Desert;
      } else {
        type = TileType.Grass;
      }
      row.push(type);
    }
    grid.push(row);
  }
  return grid;
}

// SECTION_CLASS_START

// ─── IsoTilemap 클래스 ───

export class IsoTilemap {
  /** PixiJS 루트 컨테이너 (app.stage에 추가) */
  readonly container: Container;

  /** 월드 컨테이너 (카메라 트랜스폼 적용 대상) */
  readonly worldContainer: Container;

  /** 15개 레이어 컨테이너 배열 */
  private readonly layers: Container[];

  /** 화면 고정 레이어 (Cloud, UIOverlay) */
  private readonly screenContainer: Container;

  /** 맵 크기 */
  readonly mapSize: number;

  /** v26 호환 타일 그리드 */
  readonly grid: TileType[][];

  /** v27 확장 타일 데이터 */
  private isoGrid: IsoTile[][];

  /** 바이옴 */
  readonly biome: BiomeType;

  /** 시드 */
  readonly seed: number;

  /** 건물 인스턴스 목록 */
  private buildings: BuildingInstance[] = [];

  /** 타일 점유 맵 */
  private occupancy: Map<string, string> = new Map();

  /** 카메라 상태 */
  camera: IsoCameraState;

  /** 호버 중인 타일 좌표 */
  private hoverTile: TileCoord | null = null;

  /** 현재 선택 중인 건물 (배치 모드) */
  private placingBuilding: BuildingDef | null = null;

  /** 호버 그래픽 */
  private hoverGraphic: Graphics;

  /** Ground 스프라이트 참조 (컬링 최적화용) — [y][x] */
  private groundSprites: (Sprite | Graphics)[][] = [];

  /** 텍스처 로드 완료 여부 */
  private texturesReady = false;

  constructor(
    tier: MapTier = 'C',
    seed: number = 42,
    countryIso3: string = 'KOR',
  ) {
    this.mapSize = MAP_SIZES[tier];
    this.seed = seed;
    this.biome = getCountryBiome(countryIso3);
    this.grid = generateTerrain(this.mapSize, seed);
    this.isoGrid = this.buildIsoGrid();

    // ── 컨테이너 구조 ──
    this.container = new Container();
    this.container.label = 'IsoTilemap';

    this.worldContainer = new Container();
    this.worldContainer.label = 'WorldContainer';

    this.screenContainer = new Container();
    this.screenContainer.label = 'ScreenContainer';

    // 15개 레이어 생성
    this.layers = [];
    for (let i = 0; i < LAYER_COUNT; i++) {
      const layer = new Container();
      layer.label = ISO_LAYER_NAMES[i] ?? `Layer${i}`;
      // 오브젝트 레이어(3~10)는 sortableChildren 활성화
      if (i >= IsoLayer.Shadow && i <= IsoLayer.Chest) {
        layer.sortableChildren = true;
      }
      this.layers.push(layer);
    }

    // 레이어 0~12: worldContainer에 추가 (카메라 트랜스폼 적용)
    for (let i = 0; i <= IsoLayer.Effects; i++) {
      this.worldContainer.addChild(this.layers[i]);
    }

    // 레이어 13~14: screenContainer에 추가 (화면 고정)
    this.screenContainer.addChild(this.layers[IsoLayer.Cloud]);
    this.screenContainer.addChild(this.layers[IsoLayer.UIOverlay]);

    this.container.addChild(this.worldContainer);
    this.container.addChild(this.screenContainer);

    // 호버 그래픽 — worldContainer 최상단에 추가 (월드 좌표 기반)
    this.hoverGraphic = new Graphics();
    this.worldContainer.addChild(this.hoverGraphic);

    // 카메라 초기화
    this.camera = { ...ISO_CAMERA_DEFAULTS };
    const center = tileToScreen(this.mapSize / 2, this.mapSize / 2);
    this.camera.x = center.sx;
    this.camera.y = center.sy;

    // 초기 렌더 (Graphics fallback)
    this.renderTiles();

    // Phase 3: 장식 레이어 배치 (텍스처 로드 후)
    this.renderDecorations();
  }

  // ─── v27 IsoGrid 빌드 ───

  /** TileType 그리드를 바이옴 매핑된 IsoTile로 변환 */
  private buildIsoGrid(): IsoTile[][] {
    const biomeDef = BIOME_DEFS[this.biome];
    const grid: IsoTile[][] = [];

    for (let y = 0; y < this.mapSize; y++) {
      const row: IsoTile[] = [];
      for (let x = 0; x < this.mapSize; x++) {
        const type = this.grid[y][x];
        const h = hashTile(x, y, this.seed);

        // TileType → Ground 시리즈 변환
        let groundSeries: string;
        switch (type) {
          case TileType.Grass:
            groundSeries = biomeDef.mainGround;
            break;
          case TileType.Forest:
            groundSeries = biomeDef.mainGround;
            break;
          case TileType.Desert:
            groundSeries = 'C';
            break;
          case TileType.Beach:
            groundSeries = 'C';
            break;
          case TileType.Mountain:
            groundSeries = 'D';
            break;
          case TileType.Water:
            groundSeries = 'J';
            break;
          default:
            groundSeries = biomeDef.mainGround;
        }

        // 보조 Ground 시리즈 20% 확률 (비-Water)
        if (type !== TileType.Water && type !== TileType.Beach) {
          if ((h % 100) < 20 && biomeDef.subGround.length > 0) {
            const subIdx = h % biomeDef.subGround.length;
            groundSeries = biomeDef.subGround[subIdx];
          }
        }

        // 안전한 full diamond 변형 선택
        const safeVariants = GROUND_SAFE_FULL_VARIANTS[groundSeries as GroundSeries] ?? [1];
        const groundVariant = safeVariants[h % safeVariants.length];

        row.push({
          tileX: x,
          tileY: y,
          type,
          groundSeries,
          groundVariant,
          hasTree: type === TileType.Forest || (type === TileType.Grass && (h % 100) < 8),
          hasFlora: type === TileType.Grass && biomeDef.flora.length > 0 && (h % 100) < 20,
          hasStonePath: false,
        });
      }
      grid.push(row);
    }
    return grid;
  }

  // ─── 타일 렌더링 ───

  /** 전체 타일맵 렌더 */
  renderTiles(): void {
    // Ground 레이어 클리어
    this.layers[IsoLayer.Ground].removeChildren();
    this.groundSprites = [];

    const useTextures = isV27TexturesLoaded();
    this.texturesReady = useTextures;

    for (let y = 0; y < this.mapSize; y++) {
      const spriteRow: (Sprite | Graphics)[] = [];
      for (let x = 0; x < this.mapSize; x++) {
        const isoTile = this.isoGrid[y][x];
        const { sx, sy } = tileToScreen(x, y);

        let child: Sprite | Graphics;

        if (useTextures) {
          const tileSeed = hashTile(x, y, this.seed);
          const texture = getSafeGroundTexture(isoTile.groundSeries, tileSeed);

          if (texture) {
            const sprite = new Sprite(texture);
            sprite.anchor.set(0.5, 1.0);
            sprite.scale.set(ISO_TILE_SCALE);
            sprite.x = sx;
            sprite.y = sy + ISO_TILE_HEIGHT / 2;
            child = sprite;
          } else {
            child = this.createFallbackTile(isoTile.type, sx, sy);
          }
        } else {
          child = this.createFallbackTile(isoTile.type, sx, sy);
        }

        this.layers[IsoLayer.Ground].addChild(child);
        spriteRow.push(child);
      }
      this.groundSprites.push(spriteRow);
    }

    // Auto-tiling: 경계 오버레이
    if (useTextures) {
      this.renderBoundaryOverlays();
    }

    // Phase 3: 장식 레이어 재렌더 (텍스처 상태 변경 시)
    this.renderDecorations();
  }

  /** 경계 오버레이 렌더링 (2단계 Auto-Tiling) */
  private renderBoundaryOverlays(): void {
    for (let y = 0; y < this.mapSize; y++) {
      for (let x = 0; x < this.mapSize; x++) {
        const tile = this.isoGrid[y][x];
        if (tile.type === TileType.Water) continue;

        // 4방향 이웃 확인
        const neighbors = this.getNeighborSeries(x, y);
        const currentSeries = tile.groundSeries;

        // 경계가 없으면 스킵
        if (
          neighbors.n === currentSeries &&
          neighbors.s === currentSeries &&
          neighbors.e === currentSeries &&
          neighbors.w === currentSeries
        ) continue;

        // 경계 방향 결정
        const dir = this.detectBoundaryDirection(currentSeries, neighbors);
        if (dir === 'full') continue;

        // A 시리즈 경계 맵에서 오버레이 타일 선택
        const candidates = GROUND_A_BOUNDARY_MAP[dir];
        if (!candidates || candidates.length === 0) continue;

        const h = hashTile(x, y, this.seed + 9999);
        const variant = candidates[h % candidates.length];
        const texture = getGroundTexture(tile.groundSeries, variant);
        if (!texture) continue;

        const { sx, sy } = tileToScreen(x, y);
        const overlay = new Sprite(texture);
        overlay.anchor.set(0.5, 1.0);
        overlay.scale.set(ISO_TILE_SCALE);
        overlay.x = sx;
        overlay.y = sy + ISO_TILE_HEIGHT / 2;
        overlay.alpha = 0.7;
        this.layers[IsoLayer.Ground].addChild(overlay);
      }
    }
  }

  /** 4방향 이웃의 Ground 시리즈 반환 */
  private getNeighborSeries(x: number, y: number): { n: string; s: string; e: string; w: string } {
    const current = this.isoGrid[y][x].groundSeries;
    const get = (tx: number, ty: number): string => {
      if (tx < 0 || tx >= this.mapSize || ty < 0 || ty >= this.mapSize) return current;
      return this.isoGrid[ty][tx].groundSeries;
    };
    return {
      n: get(x, y - 1),
      s: get(x, y + 1),
      e: get(x + 1, y),
      w: get(x - 1, y),
    };
  }

  /** 이웃 시리즈로 경계 방향 판별 */
  private detectBoundaryDirection(
    current: string,
    neighbors: { n: string; s: string; e: string; w: string },
  ): BoundaryDirection {
    const nDiff = neighbors.n !== current;
    const sDiff = neighbors.s !== current;
    const eDiff = neighbors.e !== current;
    const wDiff = neighbors.w !== current;

    // 얇은 통로
    if (nDiff && sDiff && !eDiff && !wDiff) return 'thin_ns';
    if (eDiff && wDiff && !nDiff && !sDiff) return 'thin_ew';

    // 에지
    if (nDiff && wDiff && !sDiff && !eDiff) return 'edge_nw';
    if (nDiff && eDiff && !sDiff && !wDiff) return 'edge_ne';
    if (sDiff && wDiff && !nDiff && !eDiff) return 'edge_sw';
    if (sDiff && eDiff && !nDiff && !wDiff) return 'edge_se';

    // 코너
    if (nDiff && !sDiff && !eDiff && !wDiff) return 'corner_n';
    if (sDiff && !nDiff && !eDiff && !wDiff) return 'corner_s';
    if (eDiff && !nDiff && !sDiff && !wDiff) return 'corner_e';
    if (wDiff && !nDiff && !sDiff && !eDiff) return 'corner_w';

    // 여러 면 경계 → deco 처리
    const diffCount = [nDiff, sDiff, eDiff, wDiff].filter(Boolean).length;
    if (diffCount >= 3) return 'deco';

    return 'full';
  }

  /** Fallback: 기존 Graphics 다이아몬드 타일 */
  private createFallbackTile(type: TileType, sx: number, sy: number): Graphics {
    const tileDef = TILE_DEFS[type];
    const g = new Graphics();
    const hw = ISO_TILE_WIDTH / 2;
    const hh = ISO_TILE_HEIGHT / 2;

    g.poly([
      0, -hh,
      hw, 0,
      0, hh,
      -hw, 0,
    ]).fill(tileDef.color);

    // 경계선
    const borderColor = this.darkenColor(tileDef.color, 0.15);
    g.poly([
      0, -hh,
      hw, 0,
      0, hh,
      -hw, 0,
    ]).stroke({ width: 0.5, color: borderColor, alpha: 0.3 });

    g.x = sx;
    g.y = sy;
    return g;
  }

  /** 색상을 어둡게 */
  private darkenColor(color: number, amount: number): number {
    const r = Math.max(0, ((color >> 16) & 0xff) * (1 - amount)) | 0;
    const g = Math.max(0, ((color >> 8) & 0xff) * (1 - amount)) | 0;
    const b = Math.max(0, (color & 0xff) * (1 - amount)) | 0;
    return (r << 16) | (g << 8) | b;
  }

  // ─── Phase 3: 장식 레이어 배치 ───

  /**
   * 전체 장식 레이어 오케스트레이터
   * Flora, Tree, Stone, Shadow, Misc를 시드 기반으로 배치
   */
  renderDecorations(): void {
    if (!this.texturesReady) return;
    const biomeDef = BIOME_DEFS[this.biome];

    // 기존 장식 클리어
    this.layers[IsoLayer.Flora].removeChildren();
    this.layers[IsoLayer.Tree].removeChildren();
    this.layers[IsoLayer.StonePath].removeChildren();
    this.layers[IsoLayer.Shadow].removeChildren();
    this.layers[IsoLayer.Misc].removeChildren();
    this.layers[IsoLayer.WallFlora].removeChildren();
    this.layers[IsoLayer.Roof].removeChildren();

    // 배치 순서 중요: Stone → Shadow → Flora → Tree → Misc
    this.placeStonePaths(biomeDef);
    this.placeFlora(biomeDef);
    this.placeTrees(biomeDef);
    this.placeMiscProps(biomeDef);
    // Shadow는 Tree/건물 배치 후
    this.placeShadows();

    // Phase 4: 건물 재렌더 (Wall+Door+Roof 텍스처 기반)
    this.reRenderBuildings();
  }

  /**
   * 건물 전체 재렌더 — 텍스처 로드 후 호출
   * Wall/Roof 레이어를 클리어하고 모든 건물을 재배치
   */
  private reRenderBuildings(): void {
    // Wall 레이어에서 건물 관련 children만 제거 (장식 Misc가 아닌 것들)
    const wallLayer = this.layers[IsoLayer.Wall];
    const toRemove: any[] = [];
    for (const child of wallLayer.children) {
      const label = (child as any).label as string | undefined;
      if (label && (label.startsWith('wall_') || label.startsWith('door_') || label.startsWith('building_'))) {
        toRemove.push(child);
      }
    }
    for (const child of toRemove) {
      wallLayer.removeChild(child);
    }

    // 모든 건물 재렌더
    for (const building of this.buildings) {
      this.renderBuilding(building);
    }
  }

  /**
   * Flora 배치 엔진
   * 바이옴별 Flora 시리즈(A=꽃/풀, B=덤불)를 빈 타일에 랜덤 배치
   * 밀도: 15-25% (IsoTile.hasFlora로 사전 결정됨)
   */
  private placeFlora(biomeDef: BiomeDef): void {
    if (biomeDef.flora.length === 0) return;

    const floraLayer = this.layers[IsoLayer.Flora];

    for (let y = 0; y < this.mapSize; y++) {
      for (let x = 0; x < this.mapSize; x++) {
        const tile = this.isoGrid[y][x];
        if (!tile.hasFlora) continue;
        if (tile.type === TileType.Water || tile.type === TileType.Mountain) continue;
        if (this.occupancy.has(`${x},${y}`)) continue;

        const h = hashTile(x, y, this.seed + 1000);

        // 바이옴 Flora 시리즈 선택
        const seriesIdx = h % biomeDef.flora.length;
        const series = biomeDef.flora[seriesIdx] as FloraSeries;
        const floraDef = FLORA_SERIES[series];
        if (!floraDef) continue;

        // 변형 선택
        const variantIdx = hashTile(x, y, this.seed + 1001) % floraDef.variants.length;
        const variant = floraDef.variants[variantIdx];

        const texture = getFloraTexture(series, variant);
        if (!texture) continue;

        const { sx, sy } = tileToScreen(x, y);
        const sprite = new Sprite(texture);
        sprite.anchor.set(0.5, 1.0);
        sprite.scale.set(ISO_TILE_SCALE);
        sprite.x = sx;
        sprite.y = sy + ISO_TILE_HEIGHT / 2;
        sprite.zIndex = y * this.mapSize + x;

        floraLayer.addChild(sprite);
      }
    }
  }

  /**
   * Tree 배치 엔진
   * 바이옴별 Tree 시리즈 배치
   * 밀도: IsoTile.hasTree로 사전 결정 (Forest=100%, Grass=8%)
   */
  private placeTrees(biomeDef: BiomeDef): void {
    if (biomeDef.trees.length === 0) return;

    const treeLayer = this.layers[IsoLayer.Tree];

    for (let y = 0; y < this.mapSize; y++) {
      for (let x = 0; x < this.mapSize; x++) {
        const tile = this.isoGrid[y][x];
        if (!tile.hasTree) continue;
        if (tile.type === TileType.Water) continue;
        if (this.occupancy.has(`${x},${y}`)) continue;

        const h = hashTile(x, y, this.seed + 2000);

        // 바이옴 Tree 시리즈 선택
        const seriesIdx = h % biomeDef.trees.length;
        const series = biomeDef.trees[seriesIdx] as TreeSeries;
        const treeDef = TREE_SERIES[series];
        if (!treeDef) continue;

        // 변형 선택
        const variantIdx = hashTile(x, y, this.seed + 2001) % treeDef.variants.length;
        const variant = treeDef.variants[variantIdx];

        const texture = getTreeTexture(series, variant);
        if (!texture) continue;

        const { sx, sy } = tileToScreen(x, y);
        const sprite = new Sprite(texture);
        // 나무는 지면에서 위로 솟음 — anchor.set(0.5, 0.85)
        sprite.anchor.set(0.5, 0.85);
        sprite.scale.set(ISO_TILE_SCALE);
        sprite.x = sx;
        sprite.y = sy + ISO_TILE_HEIGHT / 2;
        sprite.zIndex = y * this.mapSize + x;

        treeLayer.addChild(sprite);
      }
    }
  }

  /**
   * Stone/Path 배치 엔진
   * 건물 주변/도로 타일에 Stone A 시리즈 배치
   * IsoLayer.StonePath(2)
   */
  private placeStonePaths(biomeDef: BiomeDef): void {
    const stoneLayer = this.layers[IsoLayer.StonePath];
    // Stone "full" 변형 (1,2,3,5,10,15)
    const stoneFullVariants = [1, 2, 3, 5, 10, 15];

    for (let y = 0; y < this.mapSize; y++) {
      for (let x = 0; x < this.mapSize; x++) {
        const tile = this.isoGrid[y][x];
        if (tile.type === TileType.Water) continue;

        // 건물 인접 타일 또는 road 건물 타일에 Stone 배치
        const isNearBuilding = this.isAdjacentToBuilding(x, y);
        const isRoad = this.occupancy.has(`${x},${y}`) &&
          this.buildings.some(b => b.defId === 'road' && b.tileX === x && b.tileY === y);

        if (!isNearBuilding && !isRoad && !tile.hasStonePath) continue;

        const h = hashTile(x, y, this.seed + 3000);
        const variant = stoneFullVariants[h % stoneFullVariants.length];

        const texture = getStoneTexture(variant);
        if (!texture) continue;

        const { sx, sy } = tileToScreen(x, y);
        const sprite = new Sprite(texture);
        sprite.anchor.set(0.5, 1.0);
        sprite.scale.set(ISO_TILE_SCALE);
        sprite.x = sx;
        sprite.y = sy + ISO_TILE_HEIGHT / 2;

        stoneLayer.addChild(sprite);
      }
    }
  }

  /**
   * Shadow 자동 배치
   * Tree/건물의 SE 방향(+1,+1)에 Shadow 스프라이트 배치
   * alpha=0.3
   */
  private placeShadows(): void {
    const shadowLayer = this.layers[IsoLayer.Shadow];
    const placed = new Set<string>(); // 중복 방지

    // Tree 그림자
    for (let y = 0; y < this.mapSize; y++) {
      for (let x = 0; x < this.mapSize; x++) {
        const tile = this.isoGrid[y][x];
        if (!tile.hasTree) continue;
        if (tile.type === TileType.Water) continue;
        if (this.occupancy.has(`${x},${y}`)) continue;

        // 그림자는 SE 방향 (같은 타일 또는 +1,+1)
        const shadowX = x;
        const shadowY = y;
        const key = `${shadowX},${shadowY}`;
        if (placed.has(key)) continue;
        placed.add(key);

        const h = hashTile(x, y, this.seed + 4000);
        // 나무: 소~중형 Shadow (1~6)
        const variant = (h % 6) + 1;

        const texture = getShadowTexture(variant);
        if (!texture) continue;

        const { sx, sy } = tileToScreen(shadowX, shadowY);
        const sprite = new Sprite(texture);
        sprite.anchor.set(0.5, 1.0);
        sprite.scale.set(ISO_TILE_SCALE);
        sprite.x = sx;
        sprite.y = sy + ISO_TILE_HEIGHT / 2;
        sprite.alpha = 0.3;
        sprite.zIndex = shadowY * this.mapSize + shadowX;

        shadowLayer.addChild(sprite);
      }
    }

    // 건물 그림자
    for (const building of this.buildings) {
      const bx = building.tileX;
      const by = building.tileY;
      // 건물 크기에 따라 Shadow 변형 선택
      const area = building.sizeW * building.sizeH;
      let variant: number;
      if (area >= 6) variant = 13;       // 3x3 → 최대형
      else if (area >= 4) variant = 9;   // 2x2 → 초대형
      else if (area >= 2) variant = 7;   // 2x1 → 넓은
      else variant = 3;                  // 1x1 → 중형

      // SE 방향으로 오프셋 (+1, +1)
      const shadowX = bx + 1;
      const shadowY = by + 1;
      if (shadowX >= this.mapSize || shadowY >= this.mapSize) continue;
      const key = `${shadowX},${shadowY}`;
      if (placed.has(key)) continue;
      placed.add(key);

      const texture = getShadowTexture(variant);
      if (!texture) continue;

      const { sx, sy } = tileToScreen(shadowX, shadowY);
      const sprite = new Sprite(texture);
      sprite.anchor.set(0.5, 1.0);
      sprite.scale.set(ISO_TILE_SCALE);
      sprite.x = sx;
      sprite.y = sy + ISO_TILE_HEIGHT / 2;
      sprite.alpha = 0.3;
      sprite.zIndex = shadowY * this.mapSize + shadowX;

      shadowLayer.addChild(sprite);
    }
  }

  /**
   * Misc 소품 배치 엔진
   * 바이옴/건물 특성에 따라 소품 랜덤 배치
   * 밀도: 5-10%
   */
  private placeMiscProps(biomeDef: BiomeDef): void {
    const miscLayer = this.layers[IsoLayer.Misc];

    // 1) 건물 인접 맥락적 소품 배치
    for (const building of this.buildings) {
      this.placeBuildingMisc(building, miscLayer);
    }

    // 2) 일반 필드 소품 (5~10% 밀도)
    for (let y = 0; y < this.mapSize; y++) {
      for (let x = 0; x < this.mapSize; x++) {
        const tile = this.isoGrid[y][x];
        if (tile.type === TileType.Water || tile.type === TileType.Mountain) continue;
        if (this.occupancy.has(`${x},${y}`)) continue;
        if (tile.hasTree || tile.hasFlora) continue; // 이미 장식 있으면 스킵

        const h = hashTile(x, y, this.seed + 5000);
        // 5~10% 밀도
        if ((h % 100) >= 8) continue;

        // 바이옴별 일반 소품 선택
        const miscInfo = this.pickFieldMisc(h, biomeDef);
        if (!miscInfo) continue;

        const texture = getMiscTexture(miscInfo.series, miscInfo.variant);
        if (!texture) continue;

        const { sx, sy } = tileToScreen(x, y);
        const sprite = new Sprite(texture);
        sprite.anchor.set(0.5, 1.0);
        sprite.scale.set(ISO_TILE_SCALE);
        sprite.x = sx;
        sprite.y = sy + ISO_TILE_HEIGHT / 2;
        sprite.zIndex = y * this.mapSize + x;

        miscLayer.addChild(sprite);
      }
    }
  }

  /**
   * 건물 인접 타일에 맥락적 소품 배치
   */
  private placeBuildingMisc(building: BuildingInstance, layer: Container): void {
    // 건물 주변 4방향(+1) 확인
    const adjacentTiles: TileCoord[] = [];
    for (let dy = -1; dy <= building.sizeH; dy++) {
      for (let dx = -1; dx <= building.sizeW; dx++) {
        // 건물 내부는 건너뜀
        if (dx >= 0 && dx < building.sizeW && dy >= 0 && dy < building.sizeH) continue;
        const tx = building.tileX + dx;
        const ty = building.tileY + dy;
        if (tx < 0 || tx >= this.mapSize || ty < 0 || ty >= this.mapSize) continue;
        if (this.occupancy.has(`${tx},${ty}`)) continue;
        const tile = this.isoGrid[ty][tx];
        if (tile.type === TileType.Water) continue;
        adjacentTiles.push({ tileX: tx, tileY: ty });
      }
    }

    // 최대 2개 소품만 배치
    const count = Math.min(2, adjacentTiles.length);
    for (let i = 0; i < count; i++) {
      const pos = adjacentTiles[i];
      const h = hashTile(pos.tileX, pos.tileY, this.seed + 5500 + i);
      // 50% 확률로 배치
      if ((h % 100) >= 50) continue;

      const miscInfo = this.pickBuildingMisc(building.defId, h);
      if (!miscInfo) continue;

      const texture = getMiscTexture(miscInfo.series, miscInfo.variant);
      if (!texture) continue;

      const { sx, sy } = tileToScreen(pos.tileX, pos.tileY);
      const sprite = new Sprite(texture);
      sprite.anchor.set(0.5, 1.0);
      sprite.scale.set(ISO_TILE_SCALE);
      sprite.x = sx;
      sprite.y = sy + ISO_TILE_HEIGHT / 2;
      sprite.zIndex = pos.tileY * this.mapSize + pos.tileX;

      layer.addChild(sprite);
    }
  }

  /**
   * 건물 유형에 따른 소품 선택
   */
  private pickBuildingMisc(defId: string, h: number): { series: MiscSeries; variant: number } | null {
    // 건물→Misc 매핑
    switch (defId) {
      case 'market': {
        // 상자/배럴
        const variants = MISC_B_SUBCATEGORY.crates;
        return { series: 'B', variant: variants[h % variants.length] };
      }
      case 'farm': {
        // 음식/농산물 또는 수레
        if (h % 2 === 0) {
          const sub = MISC_B_SUBCATEGORY.food;
          return { series: 'B', variant: sub[h % sub.length] };
        } else {
          const sub = MISC_SERIES.E.variants;
          return { series: 'E', variant: sub[h % sub.length] };
        }
      }
      case 'barracks': {
        // 무기/도구
        const variants = MISC_SERIES.C.variants;
        return { series: 'C', variant: variants[h % variants.length] };
      }
      case 'house': {
        // 가구
        const variants = MISC_B_SUBCATEGORY.furniture;
        return { series: 'B', variant: variants[h % variants.length] };
      }
      default: {
        // 기본: 배럴/상자
        const variants = MISC_B_SUBCATEGORY.barrels;
        return { series: 'B', variant: variants[h % variants.length] };
      }
    }
  }

  /**
   * 필드 일반 소품 선택 (바이옴별)
   */
  private pickFieldMisc(h: number, biomeDef: BiomeDef): { series: MiscSeries; variant: number } | null {
    // Urban: 표지판/가구
    if (biomeDef.id === 'urban') {
      const sub = (h % 3 === 0) ? MISC_SERIES.A.variants : MISC_B_SUBCATEGORY.miscItems;
      const series: MiscSeries = (h % 3 === 0) ? 'A' : 'B';
      return { series, variant: sub[h % sub.length] };
    }
    // Arid: 장식
    if (biomeDef.id === 'arid') {
      const variants = MISC_SERIES.D.variants;
      return { series: 'D', variant: variants[h % variants.length] };
    }
    // Default: 잡동사니
    const variants = MISC_B_SUBCATEGORY.miscItems;
    return { series: 'B', variant: variants[h % variants.length] };
  }

  /**
   * 건물 인접 여부 확인
   */
  private isAdjacentToBuilding(x: number, y: number): boolean {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        if (this.occupancy.has(`${x + dx},${y + dy}`)) return true;
      }
    }
    return false;
  }

  // ─── 카메라 컨트롤 ───

  /** 카메라 이동 (팬) */
  pan(dx: number, dy: number): void {
    this.camera.x += dx / this.camera.zoom;
    this.camera.y += dy / this.camera.zoom;
  }

  /** 줌 (스크롤 휠) */
  zoom(delta: number, centerX: number, centerY: number): void {
    const oldZoom = this.camera.zoom;
    this.camera.zoom = Math.max(
      ISO_ZOOM_MIN,
      Math.min(ISO_ZOOM_MAX, this.camera.zoom + delta * ISO_ZOOM_SPEED),
    );

    // 줌 중심점 보정
    const zoomRatio = this.camera.zoom / oldZoom;
    this.camera.x += (centerX - this.camera.x) * (1 - 1 / zoomRatio);
    this.camera.y += (centerY - this.camera.y) * (1 - 1 / zoomRatio);
  }

  /** 카메라를 컨테이너에 적용 + 뷰포트 컬링 */
  applyCamera(screenWidth: number, screenHeight: number): void {
    // 월드 컨테이너에 카메라 적용
    this.worldContainer.scale.set(this.camera.zoom);
    this.worldContainer.x = screenWidth / 2 - this.camera.x * this.camera.zoom;
    this.worldContainer.y = screenHeight / 2 - this.camera.y * this.camera.zoom;

    // 뷰포트 컬링 — Ground 레이어 (O(mapSize^2) but fast visibility toggle)
    this.cullViewport(screenWidth, screenHeight);
  }

  /** 뷰포트 밖 타일 숨김 — O(visible) 목표 */
  private cullViewport(screenWidth: number, screenHeight: number): void {
    const pad = ISO_TILE_WIDTH * 2;
    const invZoom = 1 / this.camera.zoom;

    const viewLeft = this.camera.x - (screenWidth / 2) * invZoom - pad;
    const viewRight = this.camera.x + (screenWidth / 2) * invZoom + pad;
    const viewTop = this.camera.y - (screenHeight / 2) * invZoom - pad;
    const viewBottom = this.camera.y + (screenHeight / 2) * invZoom + pad;

    // Ground 스프라이트 컬링 (행렬 직접 접근)
    for (let y = 0; y < this.mapSize; y++) {
      const row = this.groundSprites[y];
      if (!row) continue;
      for (let x = 0; x < this.mapSize; x++) {
        const child = row[x];
        if (!child) continue;
        const cx = child.x;
        const cy = child.y;
        child.visible = (
          cx + ISO_TILE_WIDTH > viewLeft &&
          cx - ISO_TILE_WIDTH < viewRight &&
          cy + ISO_TILE_HEIGHT > viewTop &&
          cy - ISO_TILE_HEIGHT < viewBottom
        );
      }
    }

    // 다른 레이어의 children도 컬링 (StonePath~Chest, Layer 2~10)
    for (let layerIdx = IsoLayer.StonePath; layerIdx <= IsoLayer.Chest; layerIdx++) {
      const layer = this.layers[layerIdx];
      const children = layer.children;
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        child.visible = (
          child.x + ISO_TILE_WIDTH > viewLeft &&
          child.x - ISO_TILE_WIDTH < viewRight &&
          child.y + ISO_TILE_HEIGHT * 3 > viewTop &&
          child.y - ISO_TILE_HEIGHT < viewBottom
        );
      }
    }
  }

  // ─── 마우스 인터랙션 ───

  /** 스크린 좌표에서 타일 좌표 산출 (카메라 적용) */
  screenToTileCoord(
    screenX: number,
    screenY: number,
    screenWidth: number,
    screenHeight: number,
  ): TileCoord {
    const worldX = (screenX - screenWidth / 2) / this.camera.zoom + this.camera.x;
    const worldY = (screenY - screenHeight / 2) / this.camera.zoom + this.camera.y;
    return screenToTile(worldX, worldY);
  }

  /** 마우스 호버 업데이트 */
  updateHover(tileX: number, tileY: number): void {
    if (tileX < 0 || tileX >= this.mapSize || tileY < 0 || tileY >= this.mapSize) {
      this.hoverTile = null;
      this.hoverGraphic.clear();
      return;
    }

    this.hoverTile = { tileX, tileY };
    this.hoverGraphic.clear();

    const { sx, sy } = tileToScreen(tileX, tileY);
    const hw = ISO_TILE_WIDTH / 2;
    const hh = ISO_TILE_HEIGHT / 2;

    if (this.placingBuilding) {
      const canPlace = this.canPlaceBuilding(this.placingBuilding, tileX, tileY);
      const highlightColor = canPlace ? 0x00ff00 : 0xff0000;

      for (let dy = 0; dy < this.placingBuilding.sizeH; dy++) {
        for (let dx = 0; dx < this.placingBuilding.sizeW; dx++) {
          const { sx: tsx, sy: tsy } = tileToScreen(tileX + dx, tileY + dy);
          this.hoverGraphic.poly([
            tsx, tsy - hh,
            tsx + hw, tsy,
            tsx, tsy + hh,
            tsx - hw, tsy,
          ]).fill({ color: highlightColor, alpha: 0.3 });
          this.hoverGraphic.poly([
            tsx, tsy - hh,
            tsx + hw, tsy,
            tsx, tsy + hh,
            tsx - hw, tsy,
          ]).stroke({ width: 1.5, color: highlightColor, alpha: 0.8 });
        }
      }
    } else {
      // 일반 호버: 타일 하이라이트 (월드 좌표)
      this.hoverGraphic.poly([
        sx, sy - hh,
        sx + hw, sy,
        sx, sy + hh,
        sx - hw, sy,
      ]).fill({ color: 0xffffff, alpha: 0.15 });
      this.hoverGraphic.poly([
        sx, sy - hh,
        sx + hw, sy,
        sx, sy + hh,
        sx - hw, sy,
      ]).stroke({ width: 1.5, color: 0xffffff, alpha: 0.6 });
    }
  }

  // ─── 건물 배치 ───

  /** 배치 모드 시작 — CLIENT_BUILDING_DEFS (53종) 참조 (B-5 버그 수정) */
  startPlacing(buildingDefId: string): void {
    // 먼저 CLIENT_BUILDING_DEFS(53종)에서 검색
    const clientDef = BUILDING_DEF_MAP[buildingDefId];
    if (clientDef) {
      // ClientBuildingDef → BuildingDef 변환 (렌더링에 필요한 필드만)
      const def: BuildingDef = {
        id: clientDef.id,
        name: clientDef.name,
        category: 'residential' as any, // 카테고리는 배치 시 미사용
        sizeW: clientDef.sizeW,
        sizeH: clientDef.sizeH,
        color: 0x888888,     // fallback 프로시저럴 색상
        roofColor: 0x666666, // fallback 프로시저럴 색상
      };
      this.placingBuilding = def;
      return;
    }
    // 레거시 fallback
    const legacyDef = BUILDING_DEFS.find(d => d.id === buildingDefId);
    if (legacyDef) {
      this.placingBuilding = legacyDef;
    }
  }

  /** 배치 모드 취소 */
  cancelPlacing(): void {
    this.placingBuilding = null;
    this.hoverGraphic.clear();
  }

  /** 배치 가능 여부 확인 */
  canPlaceBuilding(def: BuildingDef, tileX: number, tileY: number): boolean {
    for (let dy = 0; dy < def.sizeH; dy++) {
      for (let dx = 0; dx < def.sizeW; dx++) {
        const tx = tileX + dx;
        const ty = tileY + dy;

        if (tx < 0 || tx >= this.mapSize || ty < 0 || ty >= this.mapSize) return false;

        const tileType = this.grid[ty][tx];
        if (!TILE_DEFS[tileType].buildable) return false;

        if (this.occupancy.has(`${tx},${ty}`)) return false;
      }
    }
    return true;
  }

  /** 건물 배치 실행 */
  placeBuilding(tileX: number, tileY: number): BuildingInstance | null {
    if (!this.placingBuilding) return null;
    if (!this.canPlaceBuilding(this.placingBuilding, tileX, tileY)) return null;

    const building: BuildingInstance = {
      id: `bld_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      defId: this.placingBuilding.id,
      tileX,
      tileY,
      sizeW: this.placingBuilding.sizeW,
      sizeH: this.placingBuilding.sizeH,
    };

    for (let dy = 0; dy < building.sizeH; dy++) {
      for (let dx = 0; dx < building.sizeW; dx++) {
        this.occupancy.set(`${tileX + dx},${tileY + dy}`, building.id);
      }
    }

    this.buildings.push(building);
    this.renderBuilding(building);

    return building;
  }

  /**
   * 건물 그래픽 렌더 — Phase 4: Wall+Door+Roof 오버레이 레이어링
   *
   * 같은 타일 좌표에 순서대로 스프라이트 겹침:
   *   1. Wall  (Layer 5) — 건물 벽면
   *   2. Door  (Layer 5) — 문 오버레이 (Wall 위)
   *   3. Roof  (Layer 9) — 지붕 (최상단)
   *   4. WallFlora (Layer 8) — 10-20% 확률 담쟁이/덩굴
   *
   * 모든 에셋이 256×256 캔버스 내에서 같은 기준점에 맞춰 제작되어 있으므로,
   * 같은 tileToScreen(x,y) 좌표에 anchor=(0.5, 1.0)로 배치하면 자동 정렬됨.
   */
  private renderBuilding(building: BuildingInstance): void {
    const centerTileX = building.tileX + (building.sizeW - 1) / 2;
    const centerTileY = building.tileY + (building.sizeH - 1) / 2;
    const { sx, sy } = tileToScreen(centerTileX, centerTileY);
    const posY = sy + ISO_TILE_HEIGHT / 2;
    const zIdx = Math.floor(centerTileY) * this.mapSize + Math.floor(centerTileX);
    const tileSeed = hashTile(building.tileX, building.tileY, this.seed + 7777);

    // BuildingComposite 조회 (바이옴별 오버라이드 적용)
    const comp = getBuildingComposite(
      building.defId,
      this.biome,
      building.sizeW,
      building.sizeH,
      tileSeed,
    );

    // 텍스처 로드 상태 확인
    const useTextures = this.texturesReady;

    if (useTextures) {
      // ── 1. Wall (Layer 5) ──
      const wallTex = getWallTexture(comp.wallSeries, comp.wallVariant);
      if (wallTex) {
        const wallSprite = new Sprite(wallTex);
        wallSprite.anchor.set(0.5, 1.0);
        wallSprite.scale.set(ISO_TILE_SCALE);
        wallSprite.x = sx;
        wallSprite.y = posY;
        wallSprite.zIndex = zIdx;
        wallSprite.label = `wall_${building.id}`;
        this.layers[IsoLayer.Wall].addChild(wallSprite);
      }

      // ── 2. Door (Layer 5, Wall 위에 겹침) ──
      const doorTex = getDoorTexture(comp.doorSeries, comp.doorVariant);
      if (doorTex) {
        const doorSprite = new Sprite(doorTex);
        doorSprite.anchor.set(0.5, 1.0);
        doorSprite.scale.set(ISO_TILE_SCALE);
        doorSprite.x = sx;
        doorSprite.y = posY;
        doorSprite.zIndex = zIdx;
        doorSprite.label = `door_${building.id}`;
        this.layers[IsoLayer.Wall].addChild(doorSprite);
      }

      // ── 3. Roof (Layer 9) ──
      const roofTex = getRoofTexture(comp.roofSeries, comp.roofVariant);
      if (roofTex) {
        const roofSprite = new Sprite(roofTex);
        roofSprite.anchor.set(0.5, 1.0);
        roofSprite.scale.set(ISO_TILE_SCALE);
        roofSprite.x = sx;
        roofSprite.y = posY;
        roofSprite.zIndex = zIdx;
        roofSprite.label = `roof_${building.id}`;
        this.layers[IsoLayer.Roof].addChild(roofSprite);
      }

      // ── 4. WallFlora (Layer 8) — 10-20% 확률 ──
      this.maybeAddWallFlora(building, sx, posY, zIdx, tileSeed);

      // 텍스처가 하나도 없으면 fallback
      if (!wallTex && !roofTex) {
        this.renderBuildingFallback(building, sx, sy, zIdx);
      }
    } else {
      // 텍스처 미로드 시 프로시저럴 fallback
      this.renderBuildingFallback(building, sx, sy, zIdx);
    }
  }

  /**
   * WallFlora 적용 — 10-20% 확률로 건물 벽에 담쟁이/덩굴 오버레이
   * Temperate, Mediterranean, Tropical 바이옴에서만 적용
   */
  private maybeAddWallFlora(
    building: BuildingInstance,
    sx: number,
    posY: number,
    zIdx: number,
    seed: number,
  ): void {
    // WallFlora는 특정 바이옴에서만
    const floraEligible = ['temperate', 'mediterranean', 'tropical'].includes(this.biome);
    if (!floraEligible) return;

    // 10-20% 확률 (seed 기반)
    const chance = (seed % 100);
    if (chance >= 15) return; // ~15% 확률

    const variants = WALLFLORA_SERIES.variants;
    const variant = variants[seed % variants.length];

    const texture = getWallFloraTexture(variant);
    if (!texture) return;

    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5, 1.0);
    sprite.scale.set(ISO_TILE_SCALE);
    sprite.x = sx;
    sprite.y = posY;
    sprite.zIndex = zIdx;
    sprite.label = `wallflora_${building.id}`;
    this.layers[IsoLayer.WallFlora].addChild(sprite);
  }

  /**
   * 프로시저럴 건물 fallback (텍스처 미로드 시)
   * 기존 Phase 2 Graphics 기반 렌더링
   */
  private renderBuildingFallback(
    building: BuildingInstance,
    sx: number,
    sy: number,
    zIdx: number,
  ): void {
    // 레거시 BUILDING_DEFS에서 색상 조회 (fallback용)
    const legacyDef = BUILDING_DEFS.find(d => d.id === building.defId);
    const color = legacyDef?.color ?? 0x888888;
    const roofColor = legacyDef?.roofColor ?? 0x666666;

    const hw = ISO_TILE_WIDTH / 2;
    const hh = ISO_TILE_HEIGHT / 2;
    const bw = hw * building.sizeW;
    const bh = hh * building.sizeH;
    const buildingHeight = 16 + building.sizeW * 4;

    const g = new Graphics();

    // 좌측 면
    g.poly([
      sx - bw, sy,
      sx, sy + bh,
      sx, sy + bh - buildingHeight,
      sx - bw, sy - buildingHeight,
    ]).fill(this.darkenColor(color, 0.25));

    // 우측 면
    g.poly([
      sx + bw, sy,
      sx, sy + bh,
      sx, sy + bh - buildingHeight,
      sx + bw, sy - buildingHeight,
    ]).fill(this.darkenColor(color, 0.1));

    // 지붕
    g.poly([
      sx, sy - bh - buildingHeight,
      sx + bw, sy - buildingHeight,
      sx, sy + bh - buildingHeight,
      sx - bw, sy - buildingHeight,
    ]).fill(roofColor);

    // 테두리
    g.poly([
      sx, sy - bh - buildingHeight,
      sx + bw, sy - buildingHeight,
      sx, sy + bh - buildingHeight,
      sx - bw, sy - buildingHeight,
    ]).stroke({ width: 1, color: 0x000000, alpha: 0.3 });

    g.x = 0;
    g.y = 0;
    g.zIndex = zIdx;
    g.label = `building_${building.id}`;

    this.layers[IsoLayer.Wall].addChild(g);
  }

  // ─── 클릭 핸들링 ───

  handleClick(
    tileX: number,
    tileY: number,
  ): { action: 'placed'; building: BuildingInstance } | { action: 'selected'; tile: TileCoord } | null {
    if (tileX < 0 || tileX >= this.mapSize || tileY < 0 || tileY >= this.mapSize) {
      return null;
    }

    if (this.placingBuilding) {
      const building = this.placeBuilding(tileX, tileY);
      if (building) {
        return { action: 'placed', building };
      }
      return null;
    }

    return { action: 'selected', tile: { tileX, tileY } };
  }

  // ─── 쿼리 ───

  getBuildingAt(tileX: number, tileY: number): string | undefined {
    return this.occupancy.get(`${tileX},${tileY}`);
  }

  getBuildings(): readonly BuildingInstance[] {
    return this.buildings;
  }

  getPlacingBuilding(): BuildingDef | null {
    return this.placingBuilding;
  }

  getTileType(tileX: number, tileY: number): TileType | null {
    if (tileX < 0 || tileX >= this.mapSize || tileY < 0 || tileY >= this.mapSize) return null;
    return this.grid[tileY][tileX];
  }

  /** v27: IsoTile 데이터 쿼리 */
  getIsoTile(tileX: number, tileY: number): IsoTile | null {
    if (tileX < 0 || tileX >= this.mapSize || tileY < 0 || tileY >= this.mapSize) return null;
    return this.isoGrid[tileY][tileX];
  }

  /** 레이어 컨테이너 접근 (시민 레이어 등 외부에서 사용) */
  getLayer(index: number): Container {
    return this.layers[index];
  }

  // ─── 정리 ───

  destroy(): void {
    this.container.destroy({ children: true });
    this.buildings = [];
    this.occupancy.clear();
    this.groundSprites = [];
  }
}
