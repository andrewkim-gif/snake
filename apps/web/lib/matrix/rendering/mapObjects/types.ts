/**
 * game/rendering/mapObjects/types.ts - 맵 오브젝트 렌더링 타입
 *
 * v7.3: 엔티티와 깊이 정렬을 위한 타입 정의
 */

/**
 * 렌더링 가능한 맵 오브젝트
 * 화면 좌표와 깊이 정보를 포함
 */
export interface RenderableMapObject {
  type: 'mapObject';
  sprite: HTMLImageElement;
  screenX: number;      // 화면 X 좌표 (그리기 시작점)
  screenY: number;      // 화면 Y 좌표 (그리기 시작점)
  renderWidth: number;  // 렌더링 너비
  renderHeight: number; // 렌더링 높이
  worldX: number;       // 월드 X 좌표 (충돌/정렬용)
  worldY: number;       // 월드 Y 좌표 (충돌/정렬용)
  depth: number;        // 이소메트릭 깊이 (x + y)
  zIndex: number;       // 추가 z-index (같은 depth에서 우선순위)
}

/**
 * 깊이 정렬 가능한 엔티티 (적, 플레이어 등)
 */
export interface DepthSortableEntity {
  type: 'enemy' | 'player';
  depth: number;        // 이소메트릭 깊이 (x + y)
  data: unknown;        // 원본 엔티티 데이터
}

/**
 * 깊이 정렬 대상 통합 타입
 */
export type DepthSortable = RenderableMapObject | DepthSortableEntity;

/**
 * 깊이 비교 함수 타입
 */
export type DepthComparator = (a: DepthSortable, b: DepthSortable) => number;

/**
 * 캔버스 변환 상태 (저장/복원용)
 */
export interface CanvasTransformState {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}
