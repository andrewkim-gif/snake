/**
 * Snake Arena — Math Utilities v2.0
 * 연속 이동에 필요한 수학 함수
 */

import type { Position } from '../types/game';

const TWO_PI = Math.PI * 2;

/** 각도를 0~2π 범위로 정규화 */
export function normalizeAngle(angle: number): number {
  angle = angle % TWO_PI;
  return angle < 0 ? angle + TWO_PI : angle;
}

/** 두 각도의 최소 차이 (-π ~ π) */
export function angleDiff(from: number, to: number): number {
  let diff = normalizeAngle(to) - normalizeAngle(from);
  if (diff > Math.PI) diff -= TWO_PI;
  if (diff < -Math.PI) diff += TWO_PI;
  return diff;
}

/** 두 점 사이 거리 */
export function distance(a: Position, b: Position): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** 두 점 사이 거리 제곱 (비교용, sqrt 생략) */
export function distanceSq(a: Position, b: Position): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return dx * dx + dy * dy;
}

/** 선형 보간 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** 위치 선형 보간 */
export function lerpPosition(a: Position, b: Position, t: number): Position {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
  };
}

/** 각도 보간 (최단 경로) */
export function lerpAngle(from: number, to: number, t: number): number {
  const diff = angleDiff(from, to);
  return normalizeAngle(from + diff * t);
}

/** 각도에서 방향 벡터 */
export function angleToVector(angle: number): Position {
  return {
    x: Math.cos(angle),
    y: Math.sin(angle),
  };
}

/** 두 점 사이 각도 (radian) */
export function angleBetween(from: Position, to: Position): number {
  return normalizeAngle(Math.atan2(to.y - from.y, to.x - from.x));
}

/** 원점에서의 거리 (원형 아레나 경계 체크용) */
export function distanceFromOrigin(pos: Position): number {
  return Math.sqrt(pos.x * pos.x + pos.y * pos.y);
}

/** 원형 아레나 내 랜덤 위치 */
export function randomPositionInCircle(radius: number, padding: number = 0): Position {
  const r = Math.sqrt(Math.random()) * (radius - padding);
  const theta = Math.random() * TWO_PI;
  return {
    x: r * Math.cos(theta),
    y: r * Math.sin(theta),
  };
}

/** 값을 min~max 범위로 클램프 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** mass 기반 동적 세그먼트 간격 계산 (서버/클라이언트 공유) */
export function getDynamicSpacing(baseSpacing: number, mass: number): number {
  return baseSpacing * (1 + mass * 0.004);
}
