/**
 * game/map/biomes.ts - 바이옴 시스템
 *
 * v7.5: 새 타일셋 지원 (tile_n 폴더)
 * - A series: A1-A12 (12 variations) - 메인 바닥 타일
 * - B series: B1 - 악센트 타일
 * - C series: C1 - 특수 타일
 * - D series: D1 - 특수 타일
 * - E series: E1 - 특수 타일
 */

import type {
  BiomeType,
  BiomeConfig,
  StageMapConfig,
  TileDecision,
} from './types';
import type { GroundTileType, TileDirection } from '../tiles/loader';
import { seededSimplex2D, fbm2D, normalizeNoise, isZoneBoundary } from './noise';

// ============================================
// Biome Definitions (v7.5)
// ============================================

/**
 * 바이옴별 설정 (새 타일셋 기준)
 */
export const BIOME_CONFIGS: Record<BiomeType, BiomeConfig> = {
  grass: {
    id: 'grass',
    tiles: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6'],  // 입문~중반 타일
    direction: 'N',
    objectDensity: 0.08,
    objects: ['tree_small', 'tree_large', 'bush', 'rock_small', 'flower_patch'],
    color: '#4a7c4e',
  },
  stone: {
    id: 'stone',
    tiles: ['A7', 'A8', 'A9', 'C1'],  // 후반 타일
    direction: 'N',
    objectDensity: 0.06,
    objects: ['rock_medium', 'rock_small', 'crate'],
    color: '#6b7280',
  },
  concrete: {
    id: 'concrete',
    tiles: ['A4', 'A5', 'A6', 'B1'],  // 중반 + B1 악센트
    direction: 'N',
    objectDensity: 0.05,
    objects: ['barrel', 'crate', 'trash_bin', 'cone', 'bench', 'lamp_post'],
    color: '#4b5563',
  },
  special: {
    id: 'special',
    tiles: ['A10', 'A11', 'A12', 'D1', 'E1'],  // 엔드게임 + 특수 타일
    direction: 'N',
    objectDensity: 0.04,
    objects: ['crate', 'barrel'],
    color: '#7c3aed',
  },
  void: {
    id: 'void',
    tiles: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10', 'A11', 'A12'],  // Matrix: A series 전체
    direction: 'N',
    objectDensity: 0.07,
    objects: ['data_node', 'corrupted_terminal', 'glitch_zone', 'matrix_pillar'],
    color: '#00FF41',
  },
};

// ============================================
// Stage Map Configurations (v7.5)
// ============================================

/**
 * 스테이지별 맵 설정 (loader.ts STAGE_TILE_CONFIGS와 동기화)
 */
export const STAGE_MAP_CONFIGS: Record<number, StageMapConfig> = {
  // Stage 1-5: 입문 (A1-A6) - v7.32: 다양한 타일로 풍성한 맵
  1: { primaryBiome: 'grass', noiseScale: 0.012, objectDensityMultiplier: 0.8, allowedTiles: ['A1', 'A2', 'A3'] },
  2: { primaryBiome: 'grass', noiseScale: 0.012, objectDensityMultiplier: 0.9, allowedTiles: ['A1', 'A2', 'A3'] },
  3: { primaryBiome: 'grass', noiseScale: 0.015, objectDensityMultiplier: 1.0, allowedTiles: ['A2', 'A3', 'A4'] },
  4: { primaryBiome: 'grass', noiseScale: 0.015, objectDensityMultiplier: 1.0, allowedTiles: ['A3', 'A4', 'A5'] },
  5: { primaryBiome: 'grass', noiseScale: 0.018, objectDensityMultiplier: 1.1, allowedTiles: ['A4', 'A5', 'A6'] },

  // Stage 6-10: 중반 (A4-A7, B1) - v7.32: 다양한 조합
  6: { primaryBiome: 'concrete', noiseScale: 0.015, objectDensityMultiplier: 1.0, allowedTiles: ['A4', 'A5', 'A6'] },
  7: { primaryBiome: 'concrete', noiseScale: 0.015, objectDensityMultiplier: 1.0, allowedTiles: ['A5', 'A6', 'B1'] },
  8: { primaryBiome: 'concrete', secondaryBiome: 'grass', noiseScale: 0.018, objectDensityMultiplier: 1.1, allowedTiles: ['A5', 'A6', 'B1'] },
  9: { primaryBiome: 'concrete', noiseScale: 0.018, objectDensityMultiplier: 1.1, allowedTiles: ['A6', 'B1', 'A7'] },
  10: { primaryBiome: 'concrete', secondaryBiome: 'grass', noiseScale: 0.02, objectDensityMultiplier: 1.2, allowedTiles: ['A6', 'B1', 'A7'] },

  // Stage 11-15: 후반 (A7-A9, C1) - v7.32: 다양한 조합
  11: { primaryBiome: 'stone', noiseScale: 0.015, objectDensityMultiplier: 1.0, allowedTiles: ['A7', 'A8', 'B1'] },
  12: { primaryBiome: 'stone', noiseScale: 0.018, objectDensityMultiplier: 1.1, allowedTiles: ['A7', 'A8', 'A9'] },
  13: { primaryBiome: 'stone', secondaryBiome: 'special', noiseScale: 0.018, objectDensityMultiplier: 1.1, allowedTiles: ['A8', 'A9', 'C1'] },
  14: { primaryBiome: 'stone', noiseScale: 0.02, objectDensityMultiplier: 1.2, allowedTiles: ['A8', 'A9', 'C1'] },
  15: { primaryBiome: 'stone', secondaryBiome: 'special', noiseScale: 0.02, objectDensityMultiplier: 1.2, allowedTiles: ['A9', 'C1', 'A10'] },

  // Stage 16-20: 엔드게임 (A10-A12, D1) - v7.32: 다양한 조합
  16: { primaryBiome: 'special', noiseScale: 0.015, objectDensityMultiplier: 1.0, allowedTiles: ['A9', 'A10', 'A11'] },
  17: { primaryBiome: 'special', noiseScale: 0.018, objectDensityMultiplier: 1.1, allowedTiles: ['A10', 'A11', 'D1'] },
  18: { primaryBiome: 'special', noiseScale: 0.018, objectDensityMultiplier: 1.1, allowedTiles: ['A10', 'A11', 'D1'] },
  19: { primaryBiome: 'special', noiseScale: 0.02, objectDensityMultiplier: 1.2, allowedTiles: ['A11', 'A12', 'D1'] },
  20: { primaryBiome: 'special', noiseScale: 0.02, objectDensityMultiplier: 1.2, allowedTiles: ['A11', 'A12', 'D1'] },

  // Stage 21-25: 믹스 (A series + E1) - v7.32: 다양한 조합
  21: { primaryBiome: 'grass', secondaryBiome: 'concrete', noiseScale: 0.012, objectDensityMultiplier: 1.0, allowedTiles: ['A1', 'A6', 'A3'] },
  22: { primaryBiome: 'grass', secondaryBiome: 'stone', noiseScale: 0.015, objectDensityMultiplier: 1.1, allowedTiles: ['A3', 'A9', 'A6'] },
  23: { primaryBiome: 'grass', secondaryBiome: 'special', noiseScale: 0.015, objectDensityMultiplier: 1.1, allowedTiles: ['A5', 'E1', 'A8'] },
  24: { primaryBiome: 'stone', secondaryBiome: 'special', noiseScale: 0.018, objectDensityMultiplier: 1.2, allowedTiles: ['A7', 'A12', 'C1'] },
  25: { primaryBiome: 'special', noiseScale: 0.018, objectDensityMultiplier: 1.2, allowedTiles: ['A10', 'E1', 'A11'] },

  // Stage 26-30: 파이널 (전체 믹스) - v7.32: 다양한 조합
  26: { primaryBiome: 'stone', secondaryBiome: 'concrete', noiseScale: 0.02, objectDensityMultiplier: 1.3, allowedTiles: ['A8', 'B1', 'A6'] },
  27: { primaryBiome: 'stone', secondaryBiome: 'special', noiseScale: 0.02, objectDensityMultiplier: 1.3, allowedTiles: ['A11', 'C1', 'A9'] },
  28: { primaryBiome: 'special', secondaryBiome: 'concrete', noiseScale: 0.022, objectDensityMultiplier: 1.4, allowedTiles: ['A4', 'D1', 'A10'] },
  29: { primaryBiome: 'special', noiseScale: 0.022, objectDensityMultiplier: 1.4, allowedTiles: ['A12', 'E1', 'D1'] },
  30: { primaryBiome: 'special', secondaryBiome: 'void', noiseScale: 0.025, objectDensityMultiplier: 1.5, allowedTiles: ['E1', 'D1', 'A12'] },
};

/**
 * Singularity (Matrix) 모드 맵 설정
 * v7.5: A 시리즈 전체 사용 (디지털/매트릭스 느낌)
 */
export const SINGULARITY_MAP_CONFIG: StageMapConfig = {
  primaryBiome: 'void',
  noiseScale: 0.015,
  objectDensityMultiplier: 1.0,
  allowedTiles: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10', 'A11', 'A12'],
};

/**
 * Tutorial 모드 맵 설정
 */
export const TUTORIAL_MAP_CONFIG: StageMapConfig = {
  primaryBiome: 'grass',
  noiseScale: 0.01,
  objectDensityMultiplier: 0.5,
  allowedTiles: ['A1'],
};

// ============================================
// Biome System Functions
// ============================================

/**
 * 스테이지/모드별 맵 설정 가져오기
 */
export function getStageMapConfig(
  stageId: number,
  gameMode?: 'stage' | 'singularity' | 'tutorial'
): StageMapConfig {
  if (gameMode === 'singularity') return SINGULARITY_MAP_CONFIG;
  if (gameMode === 'tutorial') return TUTORIAL_MAP_CONFIG;
  return STAGE_MAP_CONFIGS[stageId] || STAGE_MAP_CONFIGS[1];
}

/**
 * 좌표에서 바이옴 결정
 * Simplex Noise 기반으로 자연스러운 구역 생성
 */
export function getBiomeAt(
  worldX: number,
  worldY: number,
  config: StageMapConfig,
  seed: number = 0
): BiomeType {
  // 보조 바이옴이 없으면 무조건 주 바이옴
  if (!config.secondaryBiome) {
    return config.primaryBiome;
  }

  // fBM 노이즈로 자연스러운 구역 생성
  const noise = fbm2D(worldX, worldY, 3, 0.5, config.noiseScale, seed);
  const normalized = normalizeNoise(noise);

  // 60:40 비율로 주/보조 바이옴 배분
  return normalized < 0.6 ? config.primaryBiome : config.secondaryBiome;
}

// ============================================
// Zone-based Tile Selection (v7.7)
// ============================================

// Zone 노이즈 스케일 (낮을수록 큰 구역)
const ZONE_NOISE_SCALE = 0.003;  // 매우 큰 구역 생성 (v7.7: 0.004 → 0.003)
const CLUSTER_NOISE_SCALE = 0.008;  // 클러스터 내 세부 구역
const TRANSITION_THRESHOLD = 0.10;  // 전환 영역 너비 (v7.7: 더 좁게)

// 클러스터 크기 (몇 개 타일을 하나의 클러스터로)
const CLUSTER_SIZE = 3;

/**
 * 좌표에서 Cluster 인덱스 계산 (매우 큰 구역)
 * 타일이 많을 때 클러스터 단위로 그룹화
 */
function getClusterIndex(
  worldX: number,
  worldY: number,
  numClusters: number,
  seed: number
): number {
  // 매우 큰 스케일 노이즈로 클러스터 구역 생성
  const coarseNoise = fbm2D(worldX, worldY, 2, 0.5, ZONE_NOISE_SCALE, seed + 5000);
  const normalized = normalizeNoise(coarseNoise);
  return Math.floor(normalized * numClusters) % numClusters;
}

/**
 * 클러스터 내에서 세부 타일 인덱스 계산
 */
function getIntraClusterIndex(
  worldX: number,
  worldY: number,
  clusterSize: number,
  seed: number
): number {
  // 중간 스케일 노이즈로 클러스터 내 세부 선택
  const detailNoise = fbm2D(worldX, worldY, 2, 0.5, CLUSTER_NOISE_SCALE, seed + 7000);
  const normalized = normalizeNoise(detailNoise);
  return Math.floor(normalized * clusterSize) % clusterSize;
}

/**
 * Zone 경계 전환 영역인지 확인
 */
function isInTransitionZone(
  worldX: number,
  worldY: number,
  noiseScale: number,
  seed: number
): boolean {
  const centerNoise = fbm2D(worldX, worldY, 2, 0.5, noiseScale, seed + 5000);

  // 주변 4방향 샘플링 (거리 80 픽셀 - 더 넓게)
  const sampleDist = 80;
  const neighbors = [
    fbm2D(worldX + sampleDist, worldY, 2, 0.5, noiseScale, seed + 5000),
    fbm2D(worldX - sampleDist, worldY, 2, 0.5, noiseScale, seed + 5000),
    fbm2D(worldX, worldY + sampleDist, 2, 0.5, noiseScale, seed + 5000),
    fbm2D(worldX, worldY - sampleDist, 2, 0.5, noiseScale, seed + 5000),
  ];

  // 가장 큰 차이 계산
  let maxDiff = 0;
  for (const neighbor of neighbors) {
    const diff = Math.abs(centerNoise - neighbor);
    if (diff > maxDiff) maxDiff = diff;
  }

  return maxDiff > TRANSITION_THRESHOLD;
}

/**
 * 좌표에서 타일 타입 결정 (v7.7 Hierarchical Cluster)
 *
 * 타일 수에 따른 전략:
 * - 1개: 그대로 사용
 * - 2개: 60:40 이진 분할
 * - 3-5개: Zone-based 선택
 * - 6개+: 계층적 클러스터 (3개씩 그룹화)
 *
 * Matrix 모드 (A1-A12):
 * - Cluster 1: A1, A2, A3 (비슷한 타일끼리)
 * - Cluster 2: A4, A5, A6
 * - Cluster 3: A7, A8, A9
 * - Cluster 4: A10, A11, A12
 */
export function getTileTypeAt(
  worldX: number,
  worldY: number,
  config: StageMapConfig,
  seed: number = 0
): GroundTileType {
  const allowedTiles = config.allowedTiles;
  const numTiles = allowedTiles.length;

  // 타일이 1개면 그냥 반환
  if (numTiles === 1) {
    return allowedTiles[0];
  }

  // 타일이 2개면 간단한 이진 노이즈 (넓은 구역)
  if (numTiles === 2) {
    const noise = fbm2D(worldX, worldY, 2, 0.5, ZONE_NOISE_SCALE, seed + 5000);
    const normalized = normalizeNoise(noise);
    // 55:45 비율 (약간 primary 우선)
    return normalized < 0.55 ? allowedTiles[0] : allowedTiles[1];
  }

  // 타일이 3-5개면 단순 Zone-based
  if (numTiles <= 5) {
    const zoneIndex = getClusterIndex(worldX, worldY, numTiles, seed);

    // 전환 영역에서 인접 타일로 블렌딩
    if (isInTransitionZone(worldX, worldY, ZONE_NOISE_SCALE, seed)) {
      const blendNoise = seededSimplex2D(worldX * 0.015, worldY * 0.015, seed + 6000);
      const blendValue = normalizeNoise(blendNoise);

      if (blendValue > 0.6) {
        // 40% 확률로 인접 타일
        const offset = blendValue < 0.8 ? 1 : -1;
        return allowedTiles[(zoneIndex + offset + numTiles) % numTiles];
      }
    }

    return allowedTiles[zoneIndex];
  }

  // ============================================
  // 타일이 6개 이상: 계층적 클러스터 시스템
  // ============================================

  // 클러스터 수 계산 (3개씩 그룹화)
  const numClusters = Math.ceil(numTiles / CLUSTER_SIZE);

  // 1단계: 클러스터 선택 (매우 큰 구역)
  const clusterIndex = getClusterIndex(worldX, worldY, numClusters, seed);

  // 클러스터 내 타일 범위 계산
  const clusterStart = clusterIndex * CLUSTER_SIZE;
  const clusterEnd = Math.min(clusterStart + CLUSTER_SIZE, numTiles);
  const clusterTileCount = clusterEnd - clusterStart;

  // 2단계: 클러스터 내 세부 타일 선택
  let intraIndex: number;
  if (clusterTileCount === 1) {
    intraIndex = 0;
  } else {
    intraIndex = getIntraClusterIndex(worldX, worldY, clusterTileCount, seed);
  }

  const tileIndex = clusterStart + intraIndex;

  // 3단계: 클러스터 경계에서 부드러운 전환
  if (isInTransitionZone(worldX, worldY, ZONE_NOISE_SCALE, seed)) {
    const blendNoise = seededSimplex2D(worldX * 0.01, worldY * 0.01, seed + 8000);
    const blendValue = normalizeNoise(blendNoise);

    // 30% 확률로 인접 클러스터의 첫 번째 타일 사용 (부드러운 전환)
    if (blendValue > 0.7) {
      const adjacentCluster = (clusterIndex + (blendValue < 0.85 ? 1 : -1) + numClusters) % numClusters;
      const adjacentStart = adjacentCluster * CLUSTER_SIZE;
      return allowedTiles[adjacentStart];
    }
  }

  return allowedTiles[tileIndex];
}

/**
 * 좌표에서 타일 방향 결정
 * 구역 경계에서 자연스럽게 방향 변화
 */
export function getTileDirectionAt(
  worldX: number,
  worldY: number,
  config: StageMapConfig,
  seed: number = 0
): TileDirection {
  // 구역 경계인지 확인
  const isBoundary = isZoneBoundary(worldX, worldY, config.noiseScale, seed, 4);

  if (isBoundary) {
    // 경계에서는 8방향 노이즈로 방향 결정
    const dirNoise = seededSimplex2D(
      worldX * config.noiseScale * 2,
      worldY * config.noiseScale * 2,
      seed + 2000
    );
    const normalized = normalizeNoise(dirNoise);
    const directions: TileDirection[] = ['N', 'E', 'S', 'W'];
    const index = Math.floor(normalized * 4) % 4;
    return directions[index];
  }

  // 내부에서는 기본 방향 (N)
  return 'N';
}

/**
 * 좌표에서 구역 ID 결정
 * 같은 ID는 같은 시각적 구역
 */
export function getZoneIdAt(
  worldX: number,
  worldY: number,
  config: StageMapConfig,
  seed: number = 0
): number {
  const noise = fbm2D(worldX, worldY, 2, 0.5, config.noiseScale, seed);
  const normalized = normalizeNoise(noise);
  return Math.floor(normalized * 8); // 8개 구역
}

/**
 * 통합 타일 결정 함수
 * 좌표에서 모든 타일 정보를 한 번에 결정
 */
export function getTileDecisionAt(
  worldX: number,
  worldY: number,
  stageId: number,
  gameMode?: 'stage' | 'singularity' | 'tutorial',
  seed: number = 0
): TileDecision {
  const config = getStageMapConfig(stageId, gameMode);
  const biome = getBiomeAt(worldX, worldY, config, seed);
  const type = getTileTypeAt(worldX, worldY, config, seed);
  const direction = getTileDirectionAt(worldX, worldY, config, seed);
  const zoneId = getZoneIdAt(worldX, worldY, config, seed);

  return {
    type,
    direction,
    biome,
    zoneId,
  };
}

/**
 * 바이옴 설정 가져오기
 */
export function getBiomeConfig(biome: BiomeType): BiomeConfig {
  return BIOME_CONFIGS[biome];
}

/**
 * 오브젝트 밀도 계산
 */
export function getObjectDensityAt(
  worldX: number,
  worldY: number,
  stageId: number,
  gameMode?: 'stage' | 'singularity' | 'tutorial',
  seed: number = 0
): number {
  const config = getStageMapConfig(stageId, gameMode);
  const biome = getBiomeAt(worldX, worldY, config, seed);
  const biomeConfig = getBiomeConfig(biome);

  return biomeConfig.objectDensity * config.objectDensityMultiplier;
}
