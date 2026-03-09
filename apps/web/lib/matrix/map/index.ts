/**
 * game/map/index.ts - 맵 시스템 모듈 export
 *
 * v7.0: 바이옴 기반 자연스러운 맵 시스템
 */

// Types
export type {
  BiomeType,
  BiomeConfig,
  StageMapConfig,
  MapObjectType,
  MapObjectDef,
  MapObject,
  TileDecision,
  CollisionResult,
  NoiseOptions,
  SpatialQueryResult,
} from './types';

// Noise functions
export {
  simplex2D,
  seededSimplex2D,
  fbm2D,
  ridgeNoise2D,
  normalizeNoise,
  getZoneId,
  isZoneBoundary,
  getZoneBlend,
} from './noise';

// Biome system
export {
  BIOME_CONFIGS,
  STAGE_MAP_CONFIGS,
  SINGULARITY_MAP_CONFIG,
  TUTORIAL_MAP_CONFIG,
  getStageMapConfig,
  getBiomeAt,
  getTileTypeAt,
  getTileDirectionAt,
  getZoneIdAt,
  getTileDecisionAt,
  getBiomeConfig,
  getObjectDensityAt,
} from './biomes';

// Object system
export {
  MAP_OBJECT_DEFS,
  getObjectAtGrid,
  getObjectsInRange,
  getObjectsInView,
  checkCircleObjectCollision,
  findCollidingObjects,
  isObjectAt,
  getObjectDef,
  getAllowedObjectsForBiome,
} from './objects';
