/**
 * game/collision/types.ts - 충돌 시스템 타입 정의
 *
 * v7.25: 좌표계 혼동 방지를 위한 명확한 타입 시스템
 *
 * ⚠️ CRITICAL COORDINATE SYSTEM RULES:
 *
 * 1. WORLD COORDINATES (월드 좌표)
 *    - obj.x, obj.y, player.position.x/y, enemy.position.x/y
 *    - 게임 로직, 충돌 감지, AI 이동에 사용
 *    - 렌더링 오프셋 적용 금지!
 *
 * 2. SCREEN COORDINATES (화면 좌표)
 *    - ctx.translate() 이후의 좌표
 *    - 이소메트릭 변환: screenX = worldX - worldY, screenY = (worldX + worldY) * 0.5
 *    - 렌더링 앵커 오프셋 적용: drawY = screenY - renderHeight * 0.85
 *
 * 3. FOOT POSITION (발 위치)
 *    - 스프라이트의 "바닥" = 충돌 박스의 하단
 *    - 충돌 박스는 발 위치에서 "위로만" 확장
 */

/**
 * AABB (Axis-Aligned Bounding Box) 충돌 박스
 * 모든 값은 월드 좌표 기준
 */
export interface CollisionBox {
  /** 박스 왼쪽 경계 (월드 X) */
  left: number;
  /** 박스 오른쪽 경계 (월드 X) */
  right: number;
  /** 박스 상단 경계 (월드 Y) - 발에서 위로 확장된 위치 */
  top: number;
  /** 박스 하단 경계 (월드 Y) - 발 위치 */
  bottom: number;
  /** 박스 중심 X (월드 좌표) */
  centerX: number;
  /** 박스 중심 Y (월드 좌표) */
  centerY: number;
  /** 박스 너비 */
  width: number;
  /** 박스 높이 */
  height: number;
}

/**
 * 충돌 결과
 */
export interface CollisionResult {
  /** 충돌 여부 */
  collided: boolean;
  /** 충돌한 오브젝트 (있을 경우) */
  object?: unknown;
  /** 밀어내기 벡터 X */
  pushX?: number;
  /** 밀어내기 벡터 Y */
  pushY?: number;
}

/**
 * 원형 충돌체
 */
export interface CircleCollider {
  /** 중심 X (월드 좌표) */
  x: number;
  /** 중심 Y (월드 좌표) */
  y: number;
  /** 반지름 */
  radius: number;
}

/**
 * 플레이어/적 충돌 박스 (발 위치 기준)
 */
export interface EntityCollisionBox {
  /** 충돌 박스 너비 */
  width: number;
  /** 충돌 박스 높이 */
  height: number;
  /** 발 위치 대비 X 오프셋 (기본 0) */
  offsetX?: number;
  /** 발 위치 대비 Y 오프셋 (음수 = 위로) */
  offsetY: number;
}
