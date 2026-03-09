/**
 * game/rendering/environment/index.ts - 환경 렌더링 모듈
 *
 * 바닥 타일, 지형지물, 장애물 렌더링
 */

// Types
export type {
  TerrainType,
  FloorTileParams,
  TerrainFeatureParams,
  ObstacleParams,
} from './types';

// Terrain 모듈 (모듈화 완료)
export {
  // Types
  type TerrainParams,
  type TerrainType as TerrainTypeNew,
  // Individual terrain renderers
  drawClassroomTerrain,
  drawCafeteriaTerrain,
  drawGymTerrain,
  drawScienceTerrain,
  drawAdminTerrain,
  drawEscapeTerrain,
  drawSingularityTerrain,
  // Dispatcher
  drawTerrainByType,
} from './terrain';

// 실제 함수는 rendering.ts facade에서 export
// import { drawFloorTile, drawPixelObstacle } from './rendering';
