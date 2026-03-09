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
// v27: 256px 에셋 × 0.5 스케일 = 128×64 표시 타일
export const ISO_TILE_WIDTH = 128;   // 타일 가로 (스크린 px)
export const ISO_TILE_HEIGHT = 64;   // 타일 세로 (스크린 px)
export const ISO_TILE_SCALE = 0.5;   // 256px 에셋 → 128px 표시 스케일

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

// v27: 128×64 타일 크기에 맞춘 줌 범위
export const ISO_ZOOM_MIN = 0.15;   // 전체 조감
export const ISO_ZOOM_MAX = 2.0;    // 근접 디테일
export const ISO_ZOOM_SPEED = 0.08; // 줌 스텝 (부드럽게)

// ─── v27: 15 Layer 인덱스 ───
export const enum IsoLayer {
  Ground     = 0,
  WaterAnim  = 1,
  StonePath  = 2,
  Shadow     = 3,
  Flora      = 4,
  Wall       = 5,
  Misc       = 6,
  Tree       = 7,
  WallFlora  = 8,
  Roof       = 9,
  Chest      = 10,
  Citizens   = 11,
  Effects    = 12,
  Cloud      = 13,
  UIOverlay  = 14,
}

/** v27 레이어 이름 (디버그/라벨용) */
export const ISO_LAYER_NAMES: Record<number, string> = {
  [IsoLayer.Ground]:    'Ground',
  [IsoLayer.WaterAnim]: 'WaterAnim',
  [IsoLayer.StonePath]: 'StonePath',
  [IsoLayer.Shadow]:    'Shadow',
  [IsoLayer.Flora]:     'Flora',
  [IsoLayer.Wall]:      'Wall',
  [IsoLayer.Misc]:      'Misc',
  [IsoLayer.Tree]:      'Tree',
  [IsoLayer.WallFlora]: 'WallFlora',
  [IsoLayer.Roof]:      'Roof',
  [IsoLayer.Chest]:     'Chest',
  [IsoLayer.Citizens]:  'Citizens',
  [IsoLayer.Effects]:   'Effects',
  [IsoLayer.Cloud]:     'Cloud',
  [IsoLayer.UIOverlay]: 'UIOverlay',
};

// ─── v27: 바이옴 & 에셋 타입 확장 ───

/** 6개 기후대 (바이옴) 타입 */
export type BiomeType =
  | 'temperate'      // 온대 — 유럽/동아시아/북미 중위도
  | 'arid'           // 건조 — 사하라/아라비아/호주 내륙
  | 'tropical'       // 열대 — 동남아/아마존/적도 아프리카
  | 'arctic'         // 극지 — 시베리아/스칸디나비아/캐나다 북부
  | 'mediterranean'  // 지중해 — 남유럽/지중해 연안
  | 'urban';         // 도시국가 — 싱가포르/모나코/바티칸

/** 모든 바이옴 목록 */
export const ALL_BIOMES: readonly BiomeType[] = [
  'temperate', 'arid', 'tropical', 'arctic', 'mediterranean', 'urban',
] as const;

/** 아이소메트릭 타일 정보 (v27 확장) */
export interface IsoTile {
  /** 타일 좌표 */
  tileX: number;
  tileY: number;
  /** v26 지형 타입 (호환 유지) */
  type: TileType;
  /** Ground 시리즈 문자 (A~J) */
  groundSeries: string;
  /** Ground 변형 번호 */
  groundVariant: number;
  /** 나무 배치 여부 */
  hasTree: boolean;
  /** Flora 배치 여부 */
  hasFlora: boolean;
  /** Stone path 여부 */
  hasStonePath: boolean;
  /** 건물 ID (있으면) */
  buildingId?: string;
}

/**
 * 건물 컴포지트 — Wall + Roof + Door 오버레이 레이어링 조합
 * 같은 타일 좌표에 순서대로 겹침 (anchor 0.5, 1.0)
 */
export interface BuildingComposite {
  /** Wall 시리즈 (A~G) */
  wallSeries: string;
  /** Wall 변형 번호 */
  wallVariant: number;
  /** Roof 시리즈 (A~G) */
  roofSeries: string;
  /** Roof 변형 번호 */
  roofVariant: number;
  /** Door 시리즈 (A or C) */
  doorSeries: string;
  /** Door 변형 번호 */
  doorVariant: number;
  /** 주변 소품 Misc ID 목록 */
  miscItems?: string[];
}

/**
 * 바이옴 정의 — 각 기후대별 에셋 시리즈 매핑
 */
export interface BiomeDef {
  /** 기후대 ID */
  readonly id: BiomeType;
  /** 한국어 이름 */
  readonly nameKo: string;
  /** 영문 이름 */
  readonly nameEn: string;
  /** Ground 주력 시리즈 (70%) */
  readonly mainGround: string;
  /** Ground 보조 시리즈 (20%) */
  readonly subGround: string[];
  /** 도로/건물 주변 Ground (10%) */
  readonly pathGround: string;
  /** Tree 시리즈 목록 */
  readonly trees: string[];
  /** Flora 시리즈 목록 (비어있으면 Flora 없음) */
  readonly flora: string[];
  /** Wall 기본 시리즈 (건물 등급별 오버라이드 가능) */
  readonly defaultWall: string;
  /** Roof 기본 시리즈 */
  readonly defaultRoof: string;
}

/** 에셋 번들 이름 타입 */
export type AssetBundleName =
  | 'terrain'
  | 'buildings'
  | 'citizens'
  | 'decorations'
  | 'effects'
  | 'common';
