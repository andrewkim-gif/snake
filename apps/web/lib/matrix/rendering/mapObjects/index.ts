/**
 * game/rendering/mapObjects/index.ts - 맵 오브젝트 렌더링 모듈 Public API
 *
 * v7.3: 이소메트릭 깊이 정렬 지원 맵 오브젝트 시스템
 */

// Types
export type {
  RenderableMapObject,
  DepthSortableEntity,
  DepthSortable,
  DepthComparator,
  CanvasTransformState,
} from './types';

// Depth sorting utilities
export {
  calculateIsometricDepth,
  compareByDepth,
  sortObjectsByDepth,
  mergeByDepth,
  findObjectsUpToDepth,
} from './depthSort';

// Drawing functions
export {
  drawMapObjectSprite,
  drawMapObjects,
  drawMapObjectsUpToDepth,
} from './drawer';
