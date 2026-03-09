/**
 * game/collision/boxCalculator.ts - 충돌 박스 계산 유틸리티
 *
 * v7.25: 좌표계 혼동 방지를 위한 단일 진실 소스 (Single Source of Truth)
 *
 * ⚠️ WARNING: 이 모듈의 모든 함수는 월드 좌표만 사용합니다.
 * 렌더링 관련 오프셋(screenY -= height * 0.85)은 절대 여기서 적용하지 마세요!
 *
 * 충돌 박스 규칙:
 * - footX, footY = 스프라이트 발 위치 (월드 좌표)
 * - 충돌 박스는 발 위치에서 "위로만" 확장
 * - boxTop = footY - height (위로)
 * - boxBottom = footY (발 = 하단)
 */

import type { CollisionBox, CircleCollider, EntityCollisionBox } from './types';

// ============================================
// 맵 오브젝트 충돌 박스 계산
// ============================================

/**
 * 맵 오브젝트의 충돌 박스 계산
 *
 * @param footX - 오브젝트 발 위치 X (월드 좌표) = obj.x
 * @param footY - 오브젝트 발 위치 Y (월드 좌표) = obj.y
 * @param collisionWidth - 충돌 박스 너비 (def.collisionWidth ?? def.width)
 * @param collisionHeight - 충돌 박스 높이 (def.collisionHeight ?? def.height)
 * @returns 계산된 충돌 박스 (모두 월드 좌표)
 *
 * @example
 * // 맵 오브젝트에서 충돌 박스 계산
 * const box = getObjectCollisionBox(
 *   obj.x,
 *   obj.y,
 *   obj.def.collisionWidth ?? obj.def.width,
 *   obj.def.collisionHeight ?? obj.def.height
 * );
 */
export function getObjectCollisionBox(
  footX: number,
  footY: number,
  collisionWidth: number,
  collisionHeight: number
): CollisionBox {
  const halfW = collisionWidth / 2;

  // 발 위치 기준으로 박스 계산
  // - 발이 하단 (boxBottom = footY)
  // - 위로 확장 (boxTop = footY - height)
  const left = footX - halfW;
  const right = footX + halfW;
  const bottom = footY;           // 발 = 하단
  const top = footY - collisionHeight;  // 위로 확장

  return {
    left,
    right,
    top,
    bottom,
    centerX: footX,
    centerY: footY - collisionHeight / 2,  // 중심 = 발에서 절반 높이 위
    width: collisionWidth,
    height: collisionHeight,
  };
}

// ============================================
// 엔티티(플레이어/적) 충돌 박스 계산
// ============================================

/**
 * 엔티티(플레이어/적)의 충돌 박스 계산
 *
 * @param footX - 엔티티 발 위치 X (월드 좌표) = position.x
 * @param footY - 엔티티 발 위치 Y (월드 좌표) = position.y
 * @param entityBox - 엔티티 충돌 박스 정의
 * @returns 계산된 충돌 박스 (모두 월드 좌표)
 *
 * @example
 * // 플레이어 충돌 박스 계산
 * const box = getEntityCollisionBox(
 *   player.position.x,
 *   player.position.y,
 *   player.collisionBox
 * );
 */
export function getEntityCollisionBox(
  footX: number,
  footY: number,
  entityBox: EntityCollisionBox
): CollisionBox {
  const halfW = entityBox.width / 2;
  const halfH = entityBox.height / 2;

  // 오프셋 적용 (offsetY는 보통 음수 = 발에서 위로)
  const centerX = footX + (entityBox.offsetX || 0);
  const centerY = footY + entityBox.offsetY;

  return {
    left: centerX - halfW,
    right: centerX + halfW,
    top: centerY - halfH,
    bottom: centerY + halfH,
    centerX,
    centerY,
    width: entityBox.width,
    height: entityBox.height,
  };
}

/**
 * 원형 충돌체를 AABB로 변환 (레거시 호환)
 *
 * @param cx - 원 중심 X (월드 좌표)
 * @param cy - 원 중심 Y (월드 좌표)
 * @param radius - 반지름
 * @returns 원을 감싸는 AABB
 */
export function circleToAABB(cx: number, cy: number, radius: number): CollisionBox {
  return {
    left: cx - radius,
    right: cx + radius,
    top: cy - radius,
    bottom: cy + radius,
    centerX: cx,
    centerY: cy,
    width: radius * 2,
    height: radius * 2,
  };
}

// ============================================
// 충돌 감지 함수
// ============================================

/**
 * AABB vs AABB 충돌 감지
 *
 * @param a - 첫 번째 박스
 * @param b - 두 번째 박스
 * @returns 충돌 여부
 */
export function checkAABBCollision(a: CollisionBox, b: CollisionBox): boolean {
  return (
    a.right > b.left &&
    a.left < b.right &&
    a.bottom > b.top &&
    a.top < b.bottom
  );
}

/**
 * 원 vs AABB 충돌 감지
 *
 * @param circle - 원형 충돌체
 * @param box - 충돌 박스
 * @returns 충돌 여부
 */
export function checkCircleAABBCollision(circle: CircleCollider, box: CollisionBox): boolean {
  // 박스에서 원 중심에 가장 가까운 점 찾기
  const closestX = Math.max(box.left, Math.min(circle.x, box.right));
  const closestY = Math.max(box.top, Math.min(circle.y, box.bottom));

  // 거리 제곱 비교 (sqrt 회피)
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;

  return dx * dx + dy * dy < circle.radius * circle.radius;
}

/**
 * 점이 박스 안에 있는지 확인
 *
 * @param x - 점 X (월드 좌표)
 * @param y - 점 Y (월드 좌표)
 * @param box - 충돌 박스
 * @returns 점이 박스 안에 있는지 여부
 */
export function isPointInBox(x: number, y: number, box: CollisionBox): boolean {
  return (
    x >= box.left &&
    x <= box.right &&
    y >= box.top &&
    y <= box.bottom
  );
}

// ============================================
// 밀어내기 벡터 계산
// ============================================

/**
 * 원과 박스 충돌 시 밀어내기 벡터 계산
 *
 * @param circle - 원형 충돌체 (밀려날 대상)
 * @param box - 충돌 박스 (고정)
 * @returns 밀어내기 벡터 { pushX, pushY }
 */
export function calculatePushVector(
  circle: CircleCollider,
  box: CollisionBox
): { pushX: number; pushY: number } {
  const dx = circle.x - box.centerX;
  const dy = circle.y - box.centerY;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;

  // 오버랩 거리 계산
  const maxHalfSize = Math.max(box.width, box.height) / 2;
  const overlap = circle.radius + maxHalfSize - dist;

  return {
    pushX: (dx / dist) * Math.max(overlap, 1),
    pushY: (dy / dist) * Math.max(overlap, 1),
  };
}

// ============================================
// 디버그 유틸리티
// ============================================

/**
 * 충돌 박스를 Canvas에 시각화 (디버그용)
 *
 * @param ctx - Canvas 2D 컨텍스트
 * @param box - 충돌 박스 (월드 좌표)
 * @param color - 박스 색상
 * @param worldToScreen - 월드→화면 좌표 변환 함수
 *
 * @example
 * // 디버그 모드에서 충돌 박스 시각화
 * if (DEBUG_COLLISION) {
 *   const box = getObjectCollisionBox(obj.x, obj.y, ...);
 *   debugDrawCollisionBox(ctx, box, '#ff0000', (wx, wy) => ({
 *     x: centerX + (wx - wy - playerX + playerY) * zoom,
 *     y: centerY + ((wx + wy - playerX - playerY) * 0.5) * zoom
 *   }));
 * }
 */
export function debugDrawCollisionBox(
  ctx: CanvasRenderingContext2D,
  box: CollisionBox,
  color: string,
  worldToScreen: (wx: number, wy: number) => { x: number; y: number }
): void {
  // 4 corners in world coords
  const corners = [
    { wx: box.left, wy: box.top },
    { wx: box.right, wy: box.top },
    { wx: box.right, wy: box.bottom },
    { wx: box.left, wy: box.bottom },
  ];

  // Convert to screen coords
  const screenCorners = corners.map(c => worldToScreen(c.wx, c.wy));

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);

  ctx.beginPath();
  ctx.moveTo(screenCorners[0].x, screenCorners[0].y);
  for (let i = 1; i < screenCorners.length; i++) {
    ctx.lineTo(screenCorners[i].x, screenCorners[i].y);
  }
  ctx.closePath();
  ctx.stroke();

  // Draw center point
  const center = worldToScreen(box.centerX, box.centerY);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(center.x, center.y, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
