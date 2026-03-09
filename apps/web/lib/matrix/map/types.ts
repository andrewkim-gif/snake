/**
 * game/map/types.ts - 맵 시스템 타입 정의
 *
 * v7.0: 바이옴 기반 자연스러운 맵 시스템
 */

import type { GroundTileType, TileDirection } from '../tiles/loader';

// ============================================
// Biome System Types
// ============================================

/**
 * 바이옴 타입 (지역/구역)
 */
export type BiomeType =
  | 'grass'      // 초원 (A 시리즈)
  | 'stone'      // 돌/바위 (B 시리즈 후반)
  | 'concrete'   // 콘크리트 (B 시리즈 전반)
  | 'special'    // 특수 지형 (C, D, E 시리즈)
  | 'void';      // Matrix/Singularity 전용

/**
 * 바이옴 설정
 */
export interface BiomeConfig {
  id: BiomeType;
  /** 이 바이옴에서 사용할 타일 타입들 */
  tiles: GroundTileType[];
  /** 타일 방향 (기본: N, 경계에서 변화) */
  direction: TileDirection;
  /** 오브젝트 밀도 (0-1) */
  objectDensity: number;
  /** 이 바이옴에서 스폰될 오브젝트 타입들 */
  objects: MapObjectType[];
  /** 색상 힌트 (fallback 렌더링용) */
  color: string;
}

/**
 * 스테이지별 맵 설정
 */
export interface StageMapConfig {
  /** 주요 바이옴 */
  primaryBiome: BiomeType;
  /** 보조 바이옴 (선택) */
  secondaryBiome?: BiomeType;
  /** 노이즈 스케일 (클수록 작은 구역) */
  noiseScale: number;
  /** 전체 오브젝트 밀도 배율 */
  objectDensityMultiplier: number;
  /** 사용 가능한 타일 타입들 */
  allowedTiles: GroundTileType[];
}

// ============================================
// Map Object Types
// ============================================

/**
 * 맵 오브젝트 타입
 */
export type MapObjectType =
  // 자연 오브젝트 (초원/자연 바이옴)
  | 'tree_small'
  | 'tree_large'
  | 'bush'
  | 'rock_small'
  | 'rock_medium'
  | 'flower_patch'
  // 도시/콘크리트 오브젝트
  | 'barrel'
  | 'crate'
  | 'trash_bin'
  | 'cone'
  | 'bench'
  | 'lamp_post'
  // Matrix/Singularity 오브젝트
  | 'data_node'
  | 'corrupted_terminal'
  | 'glitch_zone'
  | 'matrix_pillar'
  // 기존 학교 오브젝트 (obstacles.config.ts와 호환)
  | 'desk'
  | 'locker'
  | 'vending_machine';

/**
 * 맵 오브젝트 정의
 */
export interface MapObjectDef {
  type: MapObjectType;
  /** 렌더링 너비 (스프라이트 크기) */
  width: number;
  /** 렌더링 높이 (스프라이트 크기) */
  height: number;
  /** 충돌 활성화 여부 */
  hasCollision: boolean;
  /** 렌더링 z-index (높을수록 위에 그려짐) */
  zIndex: number;
  /** 스프라이트 경로 (선택, 없으면 프로시저럴 렌더링) */
  sprite?: string;
  /** 렌더링 스케일 */
  renderScale: number;
  /** 바이옴 제한 (비어있으면 모든 바이옴) */
  allowedBiomes?: BiomeType[];
  /** 충돌 박스 너비 (없으면 width 사용) - 발 위치 기준 */
  collisionWidth?: number;
  /** 충돌 박스 높이 (없으면 height 사용) - 발에서 위로 확장 */
  collisionHeight?: number;
}

/**
 * 맵에 배치된 오브젝트 인스턴스
 */
export interface MapObject {
  /** 고유 ID */
  id: number;
  /** 오브젝트 타입 */
  type: MapObjectType;
  /** 월드 X 좌표 */
  x: number;
  /** 월드 Y 좌표 */
  y: number;
  /** 회전 각도 (라디안) */
  rotation: number;
  /** 스케일 배율 */
  scale: number;
  /** 오브젝트 정의 참조 */
  def: MapObjectDef;
}

// ============================================
// Noise & Generation Types
// ============================================

/**
 * 노이즈 생성기 옵션
 */
export interface NoiseOptions {
  /** 노이즈 시드 */
  seed: number;
  /** 스케일 (작을수록 큰 구역) */
  scale: number;
  /** 옥타브 수 (디테일 레벨) */
  octaves?: number;
  /** 퍼시스턴스 (고주파 강도) */
  persistence?: number;
}

/**
 * 타일 결정 결과
 */
export interface TileDecision {
  /** 타일 타입 */
  type: GroundTileType;
  /** 타일 방향 */
  direction: TileDirection;
  /** 바이옴 */
  biome: BiomeType;
  /** 구역 ID (같은 구역은 같은 ID) */
  zoneId: number;
}

// ============================================
// Spatial Query Types
// ============================================

/**
 * 공간 쿼리 결과
 */
export interface SpatialQueryResult<T> {
  items: T[];
  searchRadius: number;
  centerX: number;
  centerY: number;
}

/**
 * 충돌 결과
 */
export interface CollisionResult {
  collided: boolean;
  object?: MapObject;
  pushX?: number;
  pushY?: number;
}
