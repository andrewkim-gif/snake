/**
 * game/rendering/mapObjects/drawer.ts - 맵 오브젝트 스프라이트 렌더링
 *
 * v7.3: ctx 변환 상태와 독립적으로 화면 좌표에 스프라이트 그리기
 */

import type { RenderableMapObject } from './types';

/**
 * 맵 오브젝트 스프라이트를 화면 좌표에 그리기
 *
 * ctx가 이소메트릭 변환된 상태에서 호출되어도
 * 변환을 일시 해제하고 화면 좌표에 직접 그림
 *
 * @param ctx - 캔버스 컨텍스트 (변환 상태 무관)
 * @param obj - 렌더링할 맵 오브젝트
 */
export function drawMapObjectSprite(
  ctx: CanvasRenderingContext2D,
  obj: RenderableMapObject
): void {
  // 현재 변환 상태 저장
  ctx.save();

  // 변환 초기화 (항등 행렬로 리셋)
  // 이렇게 하면 화면 좌표계에서 직접 그릴 수 있음
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // 스프라이트 그리기
  ctx.drawImage(
    obj.sprite,
    obj.screenX,
    obj.screenY,
    obj.renderWidth,
    obj.renderHeight
  );

  // 변환 상태 복원
  ctx.restore();
}

/**
 * 여러 맵 오브젝트를 일괄 렌더링
 * 이미 깊이 정렬된 배열을 받아서 순서대로 그림
 *
 * @param ctx - 캔버스 컨텍스트
 * @param objects - 깊이 정렬된 오브젝트 배열
 */
export function drawMapObjects(
  ctx: CanvasRenderingContext2D,
  objects: RenderableMapObject[]
): void {
  if (objects.length === 0) return;

  // 변환 저장은 한 번만
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  for (const obj of objects) {
    ctx.drawImage(
      obj.sprite,
      obj.screenX,
      obj.screenY,
      obj.renderWidth,
      obj.renderHeight
    );
  }

  ctx.restore();
}

/**
 * 특정 깊이 범위의 오브젝트만 렌더링
 * 엔티티 렌더링 전/후로 나눠서 그릴 때 사용
 *
 * @param ctx - 캔버스 컨텍스트
 * @param objects - 깊이 정렬된 오브젝트 배열
 * @param maxDepth - 이 깊이 이하만 렌더링 (포함)
 * @returns 렌더링된 오브젝트 수 (다음 인덱스 계산용)
 */
export function drawMapObjectsUpToDepth(
  ctx: CanvasRenderingContext2D,
  objects: RenderableMapObject[],
  maxDepth: number,
  startIndex: number = 0
): number {
  if (objects.length === 0 || startIndex >= objects.length) return startIndex;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  let i = startIndex;
  while (i < objects.length && objects[i].depth <= maxDepth) {
    const obj = objects[i];
    ctx.drawImage(
      obj.sprite,
      obj.screenX,
      obj.screenY,
      obj.renderWidth,
      obj.renderHeight
    );
    i++;
  }

  ctx.restore();
  return i;
}
