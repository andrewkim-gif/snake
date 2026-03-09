/**
 * game/collision/index.ts - 충돌 시스템 통합 모듈
 *
 * v7.25: 좌표계 혼동 방지를 위한 모듈화
 *
 * ============================================
 * ⚠️ COORDINATE SYSTEM WARNING ⚠️
 * ============================================
 *
 * 이 모듈은 오직 월드 좌표만 사용합니다!
 *
 * ❌ NEVER apply rendering offsets here:
 *    - screenY -= renderHeight * 0.85  (NO!)
 *    - isoAnchorOffset = height * 0.85 (NO!)
 *
 * ✅ ALWAYS use world coordinates directly:
 *    - obj.x, obj.y (foot position)
 *    - player.position.x, player.position.y
 *    - enemy.position.x, enemy.position.y
 *
 * ============================================
 * COORDINATE SYSTEMS OVERVIEW
 * ============================================
 *
 * 1. WORLD COORDS (이 모듈에서 사용)
 *    - 게임 로직의 기준 좌표
 *    - 충돌, AI, 물리 연산에 사용
 *    - obj.x/y는 스프라이트 "발" 위치
 *
 * 2. SCREEN COORDS (rendering에서만 사용)
 *    - 이소메트릭 변환 적용 후
 *    - screenX = worldX - worldY
 *    - screenY = (worldX + worldY) * 0.5
 *    - 렌더링 앵커: drawY = screenY - renderHeight * 0.85
 *
 * 두 좌표계는 독립적! 렌더링 오프셋을 충돌에 적용하면 안 됩니다.
 *
 * ============================================
 * USAGE EXAMPLES
 * ============================================
 *
 * @example
 * // 맵 오브젝트 충돌 박스 계산
 * import { getObjectCollisionBox, checkCircleAABBCollision } from './collision';
 *
 * const objBox = getObjectCollisionBox(
 *   obj.x,                                    // 발 위치 X (월드)
 *   obj.y,                                    // 발 위치 Y (월드)
 *   obj.def.collisionWidth ?? obj.def.width, // 충돌 너비
 *   obj.def.collisionHeight ?? obj.def.height // 충돌 높이
 * );
 *
 * const collided = checkCircleAABBCollision(
 *   { x: player.x, y: player.y, radius: 16 },
 *   objBox
 * );
 *
 * @example
 * // 플레이어 충돌 박스 계산
 * import { getEntityCollisionBox, checkAABBCollision } from './collision';
 *
 * const playerBox = getEntityCollisionBox(
 *   player.position.x,
 *   player.position.y,
 *   player.collisionBox  // { width, height, offsetX?, offsetY }
 * );
 *
 * const enemyBox = getEntityCollisionBox(
 *   enemy.position.x,
 *   enemy.position.y,
 *   enemy.collisionBox
 * );
 *
 * if (checkAABBCollision(playerBox, enemyBox)) {
 *   // 충돌 처리
 * }
 */

// Types
export type {
  CollisionBox,
  CollisionResult,
  CircleCollider,
  EntityCollisionBox,
} from './types';

// Box Calculators
export {
  getObjectCollisionBox,
  getEntityCollisionBox,
  circleToAABB,
} from './boxCalculator';

// Collision Detection
export {
  checkAABBCollision,
  checkCircleAABBCollision,
  isPointInBox,
} from './boxCalculator';

// Push Vector
export {
  calculatePushVector,
} from './boxCalculator';

// Debug
export {
  debugDrawCollisionBox,
} from './boxCalculator';
