/**
 * v26 Phase 1 — Isometric Types
 * 타일, 건물, 카메라 관련 타입 정의
 */

// ─── 타일 타입 (6종 지형) ───
export enum TileType {
  Grass = 'grass',
  Water = 'water',
  Mountain = 'mountain',
  Forest = 'forest',
  Desert = 'desert',
  Beach = 'beach',
}

// 타일 속성 정의
export interface TileDef {
  type: TileType;
  color: number;       // 프로시저럴 렌더링 색상 (Phase 7에서 텍스처로 대체)
  buildable: boolean;  // 건물 배치 가능 여부
  label: string;       // UI 표시용 이름
}

// 지형 타입별 색상 및 속성 정의 (프로시저럴 렌더링)
export const TILE_DEFS: Record<TileType, TileDef> = {
  [TileType.Grass]:    { type: TileType.Grass,    color: 0x4a9e4a, buildable: true,  label: 'Grassland' },
  [TileType.Water]:    { type: TileType.Water,    color: 0x2b7bbf, buildable: false, label: 'Water' },
  [TileType.Mountain]: { type: TileType.Mountain, color: 0x8b8b8b, buildable: false, label: 'Mountain' },
  [TileType.Forest]:   { type: TileType.Forest,   color: 0x2d6e2d, buildable: false, label: 'Forest' },
  [TileType.Desert]:   { type: TileType.Desert,   color: 0xd4a853, buildable: true,  label: 'Desert' },
  [TileType.Beach]:    { type: TileType.Beach,    color: 0xe8d5a3, buildable: true,  label: 'Beach' },
};

// ─── 건물 카테고리 ───
export enum BuildingCategory {
  Residential = 'residential',
  Production = 'production',
  Military = 'military',
  Infrastructure = 'infrastructure',
  Commerce = 'commerce',
}

// 건물 정의 (Phase 2에서 58종으로 확장)
export interface BuildingDef {
  id: string;
  name: string;
  category: BuildingCategory;
  sizeW: number;   // 타일 폭
  sizeH: number;   // 타일 높이
  color: number;   // 프로시저럴 렌더링 색상
  roofColor: number;
}

// Phase 1: 기본 건물 5종 (프로시저럴 색상)
export const BUILDING_DEFS: BuildingDef[] = [
  { id: 'house',     name: 'House',     category: BuildingCategory.Residential,     sizeW: 1, sizeH: 1, color: 0xc4956a, roofColor: 0x8b4513 },
  { id: 'farm',      name: 'Farm',      category: BuildingCategory.Production,      sizeW: 2, sizeH: 2, color: 0xd4a853, roofColor: 0x8b7355 },
  { id: 'barracks',  name: 'Barracks',  category: BuildingCategory.Military,        sizeW: 2, sizeH: 1, color: 0x6b6b6b, roofColor: 0x4a4a4a },
  { id: 'road',      name: 'Road',      category: BuildingCategory.Infrastructure,  sizeW: 1, sizeH: 1, color: 0x555555, roofColor: 0x555555 },
  { id: 'market',    name: 'Market',    category: BuildingCategory.Commerce,        sizeW: 2, sizeH: 2, color: 0xb8860b, roofColor: 0xcc9933 },
];

// ─── 타일 좌표 ───
export interface TileCoord {
  tileX: number;
  tileY: number;
}

// ─── 건물 인스턴스 ───
export interface BuildingInstance {
  id: string;
  defId: string;
  tileX: number;
  tileY: number;
  sizeW: number;
  sizeH: number;
}

// ─── 아이소메트릭 상수 ───
export const ISO_TILE_WIDTH = 64;   // 타일 가로 (스크린 px)
export const ISO_TILE_HEIGHT = 32;  // 타일 세로 (스크린 px)

// ─── 맵 크기 (국가 tier별) ───
export type MapTier = 'S' | 'A' | 'B' | 'C' | 'D';

export const MAP_SIZES: Record<MapTier, number> = {
  S: 80,   // 80x80 (6,400 셀) — 대국
  A: 60,   // 60x60 (3,600 셀) — 강국
  B: 40,   // 40x40 (1,600 셀) — 지역강국
  C: 30,   // 30x30 (900 셀) — 일반국가
  D: 20,   // 20x20 (400 셀) — 소국
};

// ─── 카메라 설정 ───
export interface IsoCameraState {
  x: number;       // 카메라 중심 월드 좌표 X
  y: number;       // 카메라 중심 월드 좌표 Y
  zoom: number;    // 줌 레벨 (0.25 ~ 3.0)
}

export const ISO_CAMERA_DEFAULTS: IsoCameraState = {
  x: 0,
  y: 0,
  zoom: 1.0,
};

export const ISO_ZOOM_MIN = 0.25;
export const ISO_ZOOM_MAX = 3.0;
export const ISO_ZOOM_SPEED = 0.1;
