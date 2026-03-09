/**
 * game/tiles/index.ts - 이소메트릭 타일 시스템 모듈
 *
 * v6.8: 새 타일(tile_n) + 기존 타일(tile) 통합
 */

// 기존 타일 시스템 (tile/ 폴더)
export {
  // 타일 로더
  loadAllGroundTiles,
  areTilesLoaded,
  getGroundTile,

  // 스테이지별 타일 설정
  getStageTileConfig,
  getTileTypeForCell,
  STAGE_TILE_CONFIGS,
  SINGULARITY_TILE_CONFIG,
  TUTORIAL_TILE_CONFIG,

  // 타일 크기 상수
  TILE_IMG_WIDTH,
  TILE_IMG_HEIGHT,
  TILE_DIAMOND_HEIGHT,

  // 타입
  type TileDirection,
  type GroundTileType,
  type StageTileConfig,
} from './loader';

// 새 타일 시스템 (tile_n/ 폴더)
export {
  loadAllNewTiles,
  areNewTilesLoaded,
  getNewTileFrame,
  getNewTileSize,
  getNewTileSpriteSheet,
  drawNewTile,
  type NewTileType,
} from './newTileLoader';

// 호환성을 위한 상수
export const TILE_WIDTH = 128;
export const TILE_HEIGHT = 256;
