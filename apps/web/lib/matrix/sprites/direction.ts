/**
 * game/sprites/direction.ts - 8방향 계산 유틸리티
 * velocity 벡터를 8방향으로 변환하는 함수들
 */

import { Direction8, Direction8ImageKey } from './types';

/**
 * velocity 벡터를 8방향으로 변환
 * @param vx X 속도 (양수 = 오른쪽)
 * @param vy Y 속도 (양수 = 아래)
 * @returns 8방향 중 하나
 *
 * 각도 범위 (8등분, 각 45°):
 * - RIGHT (→):        -22.5° ~ 22.5°
 * - FRONT_RIGHT (↘):   22.5° ~ 67.5°
 * - FRONT (↓):         67.5° ~ 112.5°
 * - FRONT_LEFT (↙):   112.5° ~ 157.5°
 * - LEFT (←):         157.5° ~ -157.5° (또는 ±180°)
 * - BACK_LEFT (↖):   -157.5° ~ -112.5°
 * - BACK (↑):        -112.5° ~ -67.5°
 * - BACK_RIGHT (↗):   -67.5° ~ -22.5°
 */
export function getDirection8FromVelocity(vx: number, vy: number): Direction8 {
  // 정지 상태면 FRONT 반환
  const threshold = 0.1;
  if (Math.abs(vx) < threshold && Math.abs(vy) < threshold) {
    return Direction8.FRONT;
  }

  // 각도 계산 (라디안 → 도)
  // atan2(y, x): 오른쪽이 0°, 위가 -90°, 아래가 90°, 왼쪽이 ±180°
  const angleDeg = Math.atan2(vy, vx) * (180 / Math.PI);

  // 8방향 매핑 (각 방향 45° 범위)
  if (angleDeg >= -22.5 && angleDeg < 22.5) return Direction8.RIGHT;
  if (angleDeg >= 22.5 && angleDeg < 67.5) return Direction8.FRONT_RIGHT;
  if (angleDeg >= 67.5 && angleDeg < 112.5) return Direction8.FRONT;
  if (angleDeg >= 112.5 && angleDeg < 157.5) return Direction8.FRONT_LEFT;
  if (angleDeg >= 157.5 || angleDeg < -157.5) return Direction8.LEFT;
  if (angleDeg >= -157.5 && angleDeg < -112.5) return Direction8.BACK_LEFT;
  if (angleDeg >= -112.5 && angleDeg < -67.5) return Direction8.BACK;
  if (angleDeg >= -67.5 && angleDeg < -22.5) return Direction8.BACK_RIGHT;

  return Direction8.FRONT; // fallback
}

/**
 * 방향에 따라 X축 반전이 필요한지 확인
 * 오른쪽 방향들(RIGHT, BACK_RIGHT, FRONT_RIGHT)은 왼쪽 이미지를 반전
 */
export function needsFlip(direction: Direction8): boolean {
  return (
    direction === Direction8.RIGHT ||
    direction === Direction8.BACK_RIGHT ||
    direction === Direction8.FRONT_RIGHT
  );
}

/**
 * 방향에 해당하는 이미지 키 반환
 * 반전이 필요한 방향은 원본(왼쪽) 이미지 키를 반환
 */
export function getImageKeyForDirection(direction: Direction8): Direction8ImageKey {
  switch (direction) {
    case Direction8.FRONT:
      return 'front';
    case Direction8.BACK:
      return 'back';
    case Direction8.LEFT:
    case Direction8.RIGHT:
      return 'side_left';
    case Direction8.BACK_LEFT:
    case Direction8.BACK_RIGHT:
      return 'back_side_left';
    case Direction8.FRONT_LEFT:
    case Direction8.FRONT_RIGHT:
      return 'front_side_left';
    default:
      return 'front';
  }
}

/**
 * 방향 이름을 한국어로 반환 (디버깅/UI용)
 */
export function getDirectionNameKo(direction: Direction8): string {
  switch (direction) {
    case Direction8.FRONT: return '정면(아래)';
    case Direction8.BACK: return '뒤(위)';
    case Direction8.LEFT: return '왼쪽';
    case Direction8.RIGHT: return '오른쪽';
    case Direction8.BACK_LEFT: return '왼쪽위';
    case Direction8.BACK_RIGHT: return '오른쪽위';
    case Direction8.FRONT_LEFT: return '왼쪽아래';
    case Direction8.FRONT_RIGHT: return '오른쪽아래';
    default: return '알 수 없음';
  }
}
