/**
 * v27 Phase 2 — IsoTilemap (완전 재작성)
 *
 * 15-Layer Sprite 기반 아이소메트릭 렌더링 엔진
 * - PixiJS 8 Sprite 기반 (기존 Graphics 기반에서 교체)
 * - 바이옴별 Ground 텍스처 + 2단계 Auto-Tiling
 * - 128×64 타일 좌표계 (256px 에셋 × 0.5 스케일)
 * - 뷰포트 컬링 O(visible)
 *
 * @rewrite 2026-03-09 Phase 2
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
  type IsoTile,
} from './types';
import { getCountryBiome } from '@/lib/iso/country-biome-map';
import { BIOME_DEFS } from '@/lib/iso/iso-biome-defs';
import {
  getSafeGroundTexture,
  getGroundTexture,
  isTexturesLoaded as isV27TexturesLoaded,
} from '@/lib/iso/iso-texture-loader';
import {
  GROUND_SAFE_FULL_VARIANTS,
  GROUND_A_BOUNDARY_MAP,
  type GroundSeries,
  type BoundaryDirection,
} from '@/lib/iso/iso-asset-catalog';

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

    // 다른 레이어의 children도 컬링 (Shadow~Chest)
    for (let layerIdx = IsoLayer.Shadow; layerIdx <= IsoLayer.Chest; layerIdx++) {
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

  /** 배치 모드 시작 */
  startPlacing(buildingDefId: string): void {
    const def = BUILDING_DEFS.find(d => d.id === buildingDefId);
    if (def) {
      this.placingBuilding = def;
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

  /** 건물 그래픽 렌더 (Phase 2: fallback 프로시저럴) */
  private renderBuilding(building: BuildingInstance): void {
    const def = BUILDING_DEFS.find(d => d.id === building.defId);
    if (!def) return;

    const hw = ISO_TILE_WIDTH / 2;
    const hh = ISO_TILE_HEIGHT / 2;

    const centerTileX = building.tileX + (building.sizeW - 1) / 2;
    const centerTileY = building.tileY + (building.sizeH - 1) / 2;
    const { sx, sy } = tileToScreen(centerTileX, centerTileY);

    // Phase 2: 프로시저럴 건물 (Phase 4에서 BuildingComposite로 교체 예정)
    const g = new Graphics();

    const bw = hw * building.sizeW;
    const bh = hh * building.sizeH;
    const buildingHeight = 16 + building.sizeW * 4;

    // 좌측 면
    g.poly([
      sx - bw, sy,
      sx, sy + bh,
      sx, sy + bh - buildingHeight,
      sx - bw, sy - buildingHeight,
    ]).fill(this.darkenColor(def.color, 0.25));

    // 우측 면
    g.poly([
      sx + bw, sy,
      sx, sy + bh,
      sx, sy + bh - buildingHeight,
      sx + bw, sy - buildingHeight,
    ]).fill(this.darkenColor(def.color, 0.1));

    // 지붕
    g.poly([
      sx, sy - bh - buildingHeight,
      sx + bw, sy - buildingHeight,
      sx, sy + bh - buildingHeight,
      sx - bw, sy - buildingHeight,
    ]).fill(def.roofColor);

    // 테두리
    g.poly([
      sx, sy - bh - buildingHeight,
      sx + bw, sy - buildingHeight,
      sx, sy + bh - buildingHeight,
      sx - bw, sy - buildingHeight,
    ]).stroke({ width: 1, color: 0x000000, alpha: 0.3 });

    g.x = 0;
    g.y = 0;
    g.zIndex = centerTileX + centerTileY;
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
