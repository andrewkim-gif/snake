/**
 * game/rendering/mapObjects/depthSort.ts - 이소메트릭 깊이 정렬 유틸리티
 *
 * v7.3: 오브젝트와 엔티티의 깊이 정렬을 위한 함수들
 */

import type { RenderableMapObject, DepthSortable } from './types';

/**
 * 이소메트릭 깊이 계산
 * x + y가 클수록 화면에서 앞에 위치 (나중에 그려야 함)
 *
 * @param worldX - 월드 X 좌표
 * @param worldY - 월드 Y 좌표
 * @returns 깊이 값
 */
export function calculateIsometricDepth(worldX: number, worldY: number): number {
  return worldX + worldY;
}

/**
 * 깊이 비교 함수 (오름차순 - 뒤에서 앞으로)
 * 작은 depth → 먼저 그림 (뒤에 위치)
 * 큰 depth → 나중에 그림 (앞에 위치)
 *
 * @param a - 첫 번째 대상
 * @param b - 두 번째 대상
 * @returns 비교 결과 (-1, 0, 1)
 */
export function compareByDepth(a: DepthSortable, b: DepthSortable): number {
  const depthDiff = a.depth - b.depth;
  if (Math.abs(depthDiff) > 1) return depthDiff;

  // depth가 같으면 zIndex로 비교 (오브젝트만 해당)
  const aZIndex = a.type === 'mapObject' ? (a as RenderableMapObject).zIndex : 10;
  const bZIndex = b.type === 'mapObject' ? (b as RenderableMapObject).zIndex : 10;
  return aZIndex - bZIndex;
}

/**
 * 맵 오브젝트 배열을 깊이순으로 정렬
 *
 * @param objects - 정렬할 오브젝트 배열
 * @returns 정렬된 새 배열 (원본 변경 안 함)
 */
export function sortObjectsByDepth(
  objects: RenderableMapObject[]
): RenderableMapObject[] {
  return [...objects].sort((a, b) => {
    const depthDiff = a.depth - b.depth;
    if (Math.abs(depthDiff) > 1) return depthDiff;
    return a.zIndex - b.zIndex;
  });
}

/**
 * 엔티티와 오브젝트를 통합 정렬
 * 두 배열이 이미 각각 정렬되어 있다고 가정하고 병합
 *
 * @param objects - 정렬된 오브젝트 배열
 * @param entities - 엔티티 배열 (position.x, position.y 필요)
 * @returns 통합 정렬된 배열
 */
export function mergeByDepth<T extends { position: { x: number; y: number } }>(
  objects: RenderableMapObject[],
  entities: T[]
): Array<{ type: 'object'; data: RenderableMapObject } | { type: 'entity'; data: T }> {
  const result: Array<{ type: 'object'; data: RenderableMapObject } | { type: 'entity'; data: T }> = [];

  // 엔티티에 depth 추가 및 정렬
  const sortedEntities = [...entities]
    .map(e => ({
      entity: e,
      depth: calculateIsometricDepth(e.position.x, e.position.y)
    }))
    .sort((a, b) => a.depth - b.depth);

  let objIdx = 0;
  let entIdx = 0;

  // 병합 정렬 merge 단계
  while (objIdx < objects.length && entIdx < sortedEntities.length) {
    if (objects[objIdx].depth <= sortedEntities[entIdx].depth) {
      result.push({ type: 'object', data: objects[objIdx] });
      objIdx++;
    } else {
      result.push({ type: 'entity', data: sortedEntities[entIdx].entity });
      entIdx++;
    }
  }

  // 남은 오브젝트 추가
  while (objIdx < objects.length) {
    result.push({ type: 'object', data: objects[objIdx] });
    objIdx++;
  }

  // 남은 엔티티 추가
  while (entIdx < sortedEntities.length) {
    result.push({ type: 'entity', data: sortedEntities[entIdx].entity });
    entIdx++;
  }

  return result;
}

/**
 * 특정 depth 이하의 오브젝트 인덱스 찾기 (이진 탐색)
 * 엔티티 렌더링 전에 그릴 오브젝트 범위 결정용
 *
 * @param objects - 정렬된 오브젝트 배열
 * @param targetDepth - 목표 깊이
 * @returns targetDepth 이하인 마지막 오브젝트의 인덱스 + 1
 */
export function findObjectsUpToDepth(
  objects: RenderableMapObject[],
  targetDepth: number
): number {
  let left = 0;
  let right = objects.length;

  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    if (objects[mid].depth <= targetDepth) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }

  return left;
}
