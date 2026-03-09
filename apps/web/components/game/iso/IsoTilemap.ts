/**
 * v26 Phase 1 — IsoTilemap
 * 아이소메트릭 다이아몬드 타일맵 렌더링 + 카메라 + 건물 배치
 *
 * PixiJS 8 API 사용
 * - Graphics.poly().fill() 체인
 * - Container 기반 씬 그래프
 */

import { Container, Graphics, Sprite } from 'pixi.js';
import {
  TileType,
  TILE_DEFS,
  ISO_TILE_WIDTH,
  ISO_TILE_HEIGHT,
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
} from './types';
import { getTerrainTexture, getBuildingTexture, isTexturesLoaded } from '@/lib/iso-texture-loader';

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

// ─── 맵 생성 (프로시저럴) ───

/** 절차적 지형 생성: Perlin-like simplex 대체 → 간단한 노이즈 기반 */
function generateTerrain(mapSize: number, seed: number = 42): TileType[][] {
  const grid: TileType[][] = [];

  // 간단한 해시 기반 의사 노이즈 (Phase 3에서 proper noise로 대체)
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
        // 가장자리는 물
        type = TileType.Water;
      } else if (distFromCenter > 0.75) {
        // 해안
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

// ─── IsoTilemap 클래스 ───

export class IsoTilemap {
  /** PixiJS 컨테이너 (이 컨테이너를 app.stage에 추가) */
  readonly container: Container;

  /** 타일 레이어 */
  private tileLayer: Container;
  /** 건물 레이어 */
  private buildingLayer: Container;
  /** 선택 오버레이 레이어 */
  private overlayLayer: Container;

  /** 맵 크기 */
  readonly mapSize: number;
  /** 타일 그리드 */
  readonly grid: TileType[][];

  /** 건물 인스턴스 목록 */
  private buildings: BuildingInstance[] = [];
  /** 타일 점유 맵: `${tileX},${tileY}` → buildingId */
  private occupancy: Map<string, string> = new Map();

  /** 카메라 상태 */
  camera: IsoCameraState;

  /** 호버 중인 타일 좌표 */
  private hoverTile: TileCoord | null = null;
  /** 현재 선택 중인 건물 (배치 모드) */
  private placingBuilding: BuildingDef | null = null;

  /** 호버 그래픽 */
  private hoverGraphic: Graphics;

  constructor(tier: MapTier = 'C', seed: number = 42) {
    this.mapSize = MAP_SIZES[tier];
    this.grid = generateTerrain(this.mapSize, seed);

    this.container = new Container();
    this.container.label = 'IsoTilemap';

    this.tileLayer = new Container();
    this.tileLayer.label = 'TileLayer';
    this.buildingLayer = new Container();
    this.buildingLayer.label = 'BuildingLayer';
    this.overlayLayer = new Container();
    this.overlayLayer.label = 'OverlayLayer';

    this.hoverGraphic = new Graphics();
    this.overlayLayer.addChild(this.hoverGraphic);

    this.container.addChild(this.tileLayer);
    this.container.addChild(this.buildingLayer);
    this.container.addChild(this.overlayLayer);

    this.camera = { ...ISO_CAMERA_DEFAULTS };

    // 초기 카메라: 맵 중앙
    const center = tileToScreen(this.mapSize / 2, this.mapSize / 2);
    this.camera.x = center.sx;
    this.camera.y = center.sy;

    this.renderTiles();
  }

  // ─── 타일 렌더링 ───

  /** 전체 타일맵 렌더 (초기화 시 1회) */
  renderTiles(): void {
    this.tileLayer.removeChildren();

    const useTextures = isTexturesLoaded();

    // 타일을 y→x 순으로 그려야 올바른 depth sort
    for (let y = 0; y < this.mapSize; y++) {
      for (let x = 0; x < this.mapSize; x++) {
        const tileType = this.grid[y][x];
        const tileDef = TILE_DEFS[tileType];
        const { sx, sy } = tileToScreen(x, y);

        // Phase 7: 텍스처가 있으면 Sprite, 없으면 기존 Graphics
        const texture = useTextures ? getTerrainTexture(tileType) : null;

        if (texture) {
          const sprite = new Sprite(texture);
          sprite.anchor.set(0.5, 0.5);
          sprite.width = ISO_TILE_WIDTH;
          sprite.height = ISO_TILE_HEIGHT;
          sprite.x = sx;
          sprite.y = sy;
          this.tileLayer.addChild(sprite);
        } else {
          // Fallback: 기존 단색 Graphics 다이아몬드
          const g = new Graphics();
          this.drawDiamond(g, 0, 0, tileDef.color);

          // 경계선 (약간 어두운 색)
          const borderColor = this.darkenColor(tileDef.color, 0.15);
          g.poly([
            0, -ISO_TILE_HEIGHT / 2,
            ISO_TILE_WIDTH / 2, 0,
            0, ISO_TILE_HEIGHT / 2,
            -ISO_TILE_WIDTH / 2, 0,
          ]).stroke({ width: 0.5, color: borderColor, alpha: 0.3 });

          g.x = sx;
          g.y = sy;
          this.tileLayer.addChild(g);
        }
      }
    }
  }

  /** 다이아몬드(마름모) 타일 그리기 — PixiJS 8 API */
  private drawDiamond(g: Graphics, cx: number, cy: number, color: number): void {
    const hw = ISO_TILE_WIDTH / 2;
    const hh = ISO_TILE_HEIGHT / 2;

    g.poly([
      cx, cy - hh,       // 상단
      cx + hw, cy,       // 우측
      cx, cy + hh,       // 하단
      cx - hw, cy,       // 좌측
    ]).fill(color);
  }

  /** 색상을 어둡게 (0~1 비율) */
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

  /** 카메라를 컨테이너에 적용 (매 프레임 호출) */
  applyCamera(screenWidth: number, screenHeight: number): void {
    this.container.scale.set(this.camera.zoom);
    this.container.x = screenWidth / 2 - this.camera.x * this.camera.zoom;
    this.container.y = screenHeight / 2 - this.camera.y * this.camera.zoom;
  }

  // ─── 마우스 인터랙션 ───

  /** 스크린 좌표에서 타일 좌표 산출 (카메라 적용) */
  screenToTileCoord(screenX: number, screenY: number, screenWidth: number, screenHeight: number): TileCoord {
    // 스크린 → 월드 좌표 역변환
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

    // 배치 모드: 건물 배치 프리뷰
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
      // 일반 호버: 타일 하이라이트
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

        // 맵 범위 체크
        if (tx < 0 || tx >= this.mapSize || ty < 0 || ty >= this.mapSize) return false;

        // 지형 건설 가능 여부
        const tileType = this.grid[ty][tx];
        if (!TILE_DEFS[tileType].buildable) return false;

        // 타일 점유 여부
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

    // 점유 등록
    for (let dy = 0; dy < building.sizeH; dy++) {
      for (let dx = 0; dx < building.sizeW; dx++) {
        this.occupancy.set(`${tileX + dx},${tileY + dy}`, building.id);
      }
    }

    this.buildings.push(building);
    this.renderBuilding(building);

    return building;
  }

  /** 건물 그래픽 렌더 */
  private renderBuilding(building: BuildingInstance): void {
    const def = BUILDING_DEFS.find(d => d.id === building.defId);
    if (!def) return;

    const hw = ISO_TILE_WIDTH / 2;
    const hh = ISO_TILE_HEIGHT / 2;

    // 건물은 여러 타일에 걸칠 수 있으므로 중심 좌표 계산
    const centerTileX = building.tileX + (building.sizeW - 1) / 2;
    const centerTileY = building.tileY + (building.sizeH - 1) / 2;
    const { sx, sy } = tileToScreen(centerTileX, centerTileY);

    // Phase 7: 텍스처가 있으면 Sprite, 없으면 기존 프로시저럴 박스
    const texture = isTexturesLoaded() ? getBuildingTexture(building.defId) : null;

    if (texture) {
      const sprite = new Sprite(texture);
      sprite.anchor.set(0.5, 1.0); // 하단 중앙 앵커 (건물이 타일 위에 서도록)
      sprite.width = ISO_TILE_WIDTH * building.sizeW;
      sprite.height = ISO_TILE_WIDTH * building.sizeW; // 정사각형 비율 유지 (64x64 원본)
      sprite.x = sx;
      sprite.y = sy + hh * building.sizeH; // 타일 하단에 맞춤
      sprite.label = `building_${building.id}`;
      this.buildingLayer.addChild(sprite);
    } else {
      // Fallback: 기존 프로시저럴 아이소 박스
      const g = new Graphics();

      const bw = hw * building.sizeW;
      const bh = hh * building.sizeH;

      // 건물 높이 (아이소 박스)
      const buildingHeight = 16 + building.sizeW * 4;

      // 좌측 면 (어두운 색)
      g.poly([
        sx - bw, sy,
        sx, sy + bh,
        sx, sy + bh - buildingHeight,
        sx - bw, sy - buildingHeight,
      ]).fill(this.darkenColor(def.color, 0.25));

      // 우측 면 (중간 색)
      g.poly([
        sx + bw, sy,
        sx, sy + bh,
        sx, sy + bh - buildingHeight,
        sx + bw, sy - buildingHeight,
      ]).fill(this.darkenColor(def.color, 0.1));

      // 지붕 (상단 다이아몬드)
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
      g.label = `building_${building.id}`;

      this.buildingLayer.addChild(g);
    }
  }

  // ─── 클릭 핸들링 ───

  /** 클릭 처리: 배치 모드면 건물 배치, 아니면 타일 선택 */
  handleClick(tileX: number, tileY: number): { action: 'placed'; building: BuildingInstance } | { action: 'selected'; tile: TileCoord } | null {
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

  /** 특정 타일의 건물 ID 반환 */
  getBuildingAt(tileX: number, tileY: number): string | undefined {
    return this.occupancy.get(`${tileX},${tileY}`);
  }

  /** 건물 목록 반환 */
  getBuildings(): readonly BuildingInstance[] {
    return this.buildings;
  }

  /** 현재 배치 중인 건물 */
  getPlacingBuilding(): BuildingDef | null {
    return this.placingBuilding;
  }

  /** 타일 타입 쿼리 */
  getTileType(tileX: number, tileY: number): TileType | null {
    if (tileX < 0 || tileX >= this.mapSize || tileY < 0 || tileY >= this.mapSize) return null;
    return this.grid[tileY][tileX];
  }

  // ─── 정리 ───

  /** 리소스 정리 */
  destroy(): void {
    this.container.destroy({ children: true });
    this.buildings = [];
    this.occupancy.clear();
  }
}
