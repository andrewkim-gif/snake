/**
 * game/tiles/loader.ts - 이소메트릭 타일 이미지 로더
 *
 * v7.5: 새 타일셋 (tile_n 폴더)
 * - A series: A1-A12 (12 variations)
 * - B series: B1
 * - C series: C1
 * - D series: D1
 * - E series: E1
 */

// 타일 방향
export type TileDirection = 'N' | 'E' | 'S' | 'W';

// Ground 타일 타입 (A1-A12, B1, C1, D1, E1)
export type GroundTileType =
  | 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'A6' | 'A7' | 'A8' | 'A9' | 'A10' | 'A11' | 'A12'
  | 'B1' | 'C1' | 'D1' | 'E1';

// 타일 이미지 캐시
const tileCache: Map<string, HTMLImageElement> = new Map();

// 로딩 상태
let isLoading = false;
let isLoaded = false;

// 타일 이미지 크기 (이소메트릭 다이아몬드)
export const TILE_IMG_WIDTH = 128;
export const TILE_IMG_HEIGHT = 256;
export const TILE_DIAMOND_HEIGHT = 64;  // 다이아몬드 바닥 높이 (2:1 비율)

// 스테이지별 타일 설정
export interface StageTileConfig {
  primary: GroundTileType;
  secondary?: GroundTileType;
  direction: TileDirection;
}

/**
 * 스테이지별 타일 매핑 (v7.5)
 *
 * Stage 1-5:   입문 - A1, A2, A3 (깔끔한 바닥)
 * Stage 6-10:  중반 - A4, A5, A6, B1 (복잡도 증가)
 * Stage 11-15: 후반 - A7, A8, A9, C1 (다양한 패턴)
 * Stage 16-20: 엔드 - A10, A11, A12, D1 (복잡한 지형)
 * Stage 21-25: 믹스 - A series + E1 (다양성)
 * Stage 26-30: 파이널 - 전체 믹스
 */
export const STAGE_TILE_CONFIGS: Record<number, StageTileConfig> = {
  // Stage 1-5: 입문 (A1-A3)
  1: { primary: 'A1', direction: 'N' },
  2: { primary: 'A1', secondary: 'A2', direction: 'N' },
  3: { primary: 'A2', direction: 'N' },
  4: { primary: 'A2', secondary: 'A3', direction: 'N' },
  5: { primary: 'A3', direction: 'N' },

  // Stage 6-10: 중반 (A4-A6, B1)
  6: { primary: 'A4', direction: 'N' },
  7: { primary: 'A4', secondary: 'A5', direction: 'N' },
  8: { primary: 'A5', secondary: 'B1', direction: 'N' },
  9: { primary: 'A6', direction: 'N' },
  10: { primary: 'A6', secondary: 'B1', direction: 'N' },

  // Stage 11-15: 후반 (A7-A9, C1)
  11: { primary: 'A7', direction: 'N' },
  12: { primary: 'A7', secondary: 'A8', direction: 'N' },
  13: { primary: 'A8', secondary: 'C1', direction: 'N' },
  14: { primary: 'A9', direction: 'N' },
  15: { primary: 'A9', secondary: 'C1', direction: 'N' },

  // Stage 16-20: 엔드게임 (A10-A12, D1)
  16: { primary: 'A10', direction: 'N' },
  17: { primary: 'A10', secondary: 'A11', direction: 'N' },
  18: { primary: 'A11', secondary: 'D1', direction: 'N' },
  19: { primary: 'A12', direction: 'N' },
  20: { primary: 'A12', secondary: 'D1', direction: 'N' },

  // Stage 21-25: 믹스 (A series + E1)
  21: { primary: 'A1', secondary: 'A6', direction: 'N' },
  22: { primary: 'A3', secondary: 'A9', direction: 'N' },
  23: { primary: 'A5', secondary: 'E1', direction: 'N' },
  24: { primary: 'A7', secondary: 'A12', direction: 'N' },
  25: { primary: 'A10', secondary: 'E1', direction: 'N' },

  // Stage 26-30: 파이널 (전체 믹스)
  26: { primary: 'A8', secondary: 'B1', direction: 'N' },
  27: { primary: 'A11', secondary: 'C1', direction: 'N' },
  28: { primary: 'A4', secondary: 'D1', direction: 'N' },
  29: { primary: 'A12', secondary: 'E1', direction: 'N' },
  30: { primary: 'E1', secondary: 'D1', direction: 'N' },
};

// 기본 타일 설정
const DEFAULT_TILE_CONFIG: StageTileConfig = { primary: 'A1', direction: 'N' };

/**
 * Singularity (Matrix) 모드 타일 설정
 * v7.5: A 시리즈 전체 사용 (디지털/매트릭스 느낌)
 */
export const SINGULARITY_TILE_CONFIG: StageTileConfig = {
  primary: 'A1',
  secondary: 'A6',    // 노이즈 기반으로 A1-A12 중 선택됨
  direction: 'N',
};

// 튜토리얼 모드 타일 설정
export const TUTORIAL_TILE_CONFIG: StageTileConfig = {
  primary: 'A1',
  direction: 'N',
};

/**
 * 스테이지/모드별 타일 설정 가져오기
 * @param stageId - 스테이지 번호 (1-30)
 * @param gameMode - 게임 모드 ('stage' | 'singularity' | 'tutorial')
 */
export function getStageTileConfig(
  stageId: number,
  gameMode?: 'stage' | 'singularity' | 'tutorial'
): StageTileConfig {
  // Singularity (Matrix) 모드
  if (gameMode === 'singularity') {
    return SINGULARITY_TILE_CONFIG;
  }

  // Tutorial 모드
  if (gameMode === 'tutorial') {
    return TUTORIAL_TILE_CONFIG;
  }

  // Stage 모드 (기본)
  return STAGE_TILE_CONFIGS[stageId] || DEFAULT_TILE_CONFIG;
}

/**
 * 타일 캐시 키 생성
 */
function getTileCacheKey(type: GroundTileType, direction: TileDirection): string {
  return `Ground_${type}_${direction}`;
}

/**
 * 타일 이미지 경로 생성 (tile_n 폴더, 공백을 %20으로 인코딩)
 */
function getTileImagePath(type: GroundTileType, direction: TileDirection): string {
  const filename = `Ground ${type}_${direction}.png`;
  return `/assets/tile_n/${encodeURIComponent(filename)}`;
}

/**
 * 단일 이미지 로드
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load: ${src}`));
    img.src = src;
  });
}

// 모든 사용 가능한 타일 타입 목록
const ALL_TILE_TYPES: GroundTileType[] = [
  'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10', 'A11', 'A12',
  'B1', 'C1', 'D1', 'E1'
];

/**
 * 모든 타일 로드 (v7.5)
 * A1-A12, B1, C1, D1, E1 x 4방향 = 64개 타일
 */
export async function loadAllGroundTiles(): Promise<void> {
  if (isLoaded || isLoading) return;
  isLoading = true;

  const directions: TileDirection[] = ['N', 'E', 'S', 'W'];
  const loadPromises: Promise<void>[] = [];

  for (const tileType of ALL_TILE_TYPES) {
    for (const dir of directions) {
      const key = getTileCacheKey(tileType, dir);
      const path = getTileImagePath(tileType, dir);

      loadPromises.push(
        loadImage(path)
          .then(img => {
            tileCache.set(key, img);
          })
          .catch(err => {
            // 일부 방향은 파일이 없을 수 있음 (silent fail)
            console.warn(`[TileLoader] ${err.message}`);
          })
      );
    }
  }

  await Promise.all(loadPromises);
  isLoaded = true;
  isLoading = false;
  console.log(`[TileLoader v7.5] Loaded ${tileCache.size} isometric tiles (A1-A12, B1, C1, D1, E1)`);
}

/**
 * 타일 이미지 가져오기
 */
export function getGroundTile(type: GroundTileType, direction: TileDirection): HTMLImageElement | null {
  const key = getTileCacheKey(type, direction);
  return tileCache.get(key) || null;
}

/**
 * 타일 로드 상태 확인
 */
export function areTilesLoaded(): boolean {
  return isLoaded;
}

/**
 * 좌표 기반 타일 타입 결정 (체커보드 패턴으로 primary/secondary 선택)
 */
export function getTileTypeForCell(
  cellX: number,
  cellY: number,
  config: StageTileConfig
): GroundTileType {
  // secondary가 있으면 체커보드 패턴으로 번갈아 사용
  if (config.secondary && (cellX + cellY) % 2 === 1) {
    return config.secondary;
  }
  return config.primary;
}

/**
 * 타일 캐시 초기화 (리로드용)
 */
export function resetTileCache(): void {
  tileCache.clear();
  isLoaded = false;
  isLoading = false;
}
