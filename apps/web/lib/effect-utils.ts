/**
 * effect-utils.ts -- v24 Globe Effects Overhaul: Shared Arc & Surface Utilities
 *
 * 5개 이상의 컴포넌트에 중복되어 있던 아크 생성 로직을 통합.
 * GC-prevention을 위한 모듈 스코프 임시 객체 + easing 함수 포함.
 *
 * 대체하는 기존 구현체:
 *   - GlobeTradeRoutes.createBezierArcPoints (local)
 *   - GlobeAllianceBeam.createArcCurve (local)
 *   - GlobeSpyTrail.createArcPoints (local)
 *   - GlobeSanctionBarrier.createArcPoints (local)
 *   - GlobeWarEffects.createArcPoints (local)
 *   - GlobeMissileEffect 내 인라인 아크 로직
 */

import * as THREE from 'three';
import { ARC_SEGMENTS } from './effect-constants';

// ===================================================================
// GC-prevention: 모듈 스코프 임시 객체
// ===================================================================
// useFrame 루프에서 프레임당 할당을 방지하기 위한 재사용 가능 객체.
// 주의: 단일 스레드(JS 메인 스레드)에서만 안전. 동시 호출 불가.

const _mid = new THREE.Vector3();
const _control = new THREE.Vector3();
const _normal = new THREE.Vector3();
const _upDefault = new THREE.Vector3(0, 1, 0);
const _quatTemp = new THREE.Quaternion();

// ===================================================================
// Shared Quadratic Bezier Arc -- createArcPoints
// ===================================================================

/**
 * 구면 위 두 점 사이의 2차 베지어 아크 포인트 배열 생성.
 *
 * 수학:
 *   midpoint = (start + end) / 2
 *   control  = normalize(midpoint) * (radius + dist * arcHeight)
 *   B(t)     = (1-t)^2 * start + 2(1-t)t * control + t^2 * end
 *
 * @param start     구면 시작점 (Vector3)
 * @param end       구면 끝점 (Vector3)
 * @param radius    지구본 반경 (control point 높이 계산용)
 * @param arcHeight 높이 계수 (ARC_HEIGHT 상수 사용 권장)
 * @param segments  아크 세그먼트 수 (기본: ARC_SEGMENTS.HIGH = 64)
 * @returns Vector3[] -- 아크 위의 점 배열 (segments + 1 개)
 */
export function createArcPoints(
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
  arcHeight: number,
  segments: number = ARC_SEGMENTS.HIGH,
): THREE.Vector3[] {
  _mid.addVectors(start, end).multiplyScalar(0.5);
  const dist = start.distanceTo(end);
  const control = _mid.clone().normalize().multiplyScalar(radius + dist * arcHeight);

  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const invT = 1 - t;
    points.push(
      new THREE.Vector3()
        .addScaledVector(start, invT * invT)
        .addScaledVector(control, 2 * invT * t)
        .addScaledVector(end, t * t),
    );
  }
  return points;
}

// ===================================================================
// Shared Quadratic Bezier Arc -- createArcCurve
// ===================================================================

/**
 * THREE.QuadraticBezierCurve3 객체 생성 (연속 샘플링 용도).
 * getPointAt() / getPoints() 등 Curve API가 필요한 컴포넌트에서 사용.
 * 예: GlobeAllianceBeam의 파티클 흐름 경로.
 *
 * @param start     구면 시작점
 * @param end       구면 끝점
 * @param radius    지구본 반경
 * @param arcHeight 높이 계수
 * @returns QuadraticBezierCurve3 인스턴스
 */
export function createArcCurve(
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
  arcHeight: number,
): THREE.QuadraticBezierCurve3 {
  _mid.addVectors(start, end).multiplyScalar(0.5);
  const dist = start.distanceTo(end);
  const control = _mid.clone().normalize().multiplyScalar(radius + dist * arcHeight);
  return new THREE.QuadraticBezierCurve3(start.clone(), control, end.clone());
}

// ===================================================================
// GC-free Arc Point Interpolation
// ===================================================================

/**
 * useFrame 루프용 GC-free 아크 포인트 보간.
 * GlobeMissileEffect 등 매 프레임 위치를 갱신하는 컴포넌트에서 사용.
 *
 * 주의: 모듈 스코프 _mid, _normal, _control을 사용하므로 동시 호출 불가.
 * 단일 useFrame 콜백 내에서만 사용할 것.
 *
 * @param start     시작점
 * @param end       끝점
 * @param t         보간 파라미터 (0~1)
 * @param arcHeight 아크 높이 (절대값, dist * factor가 아님)
 * @param out       결과를 기록할 Vector3 (재사용)
 * @returns out 참조 (체이닝 가능)
 */
export function getArcPointGCFree(
  start: THREE.Vector3,
  end: THREE.Vector3,
  t: number,
  arcHeight: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  _mid.addVectors(start, end).multiplyScalar(0.5);
  _normal.copy(_mid).normalize();
  _control.copy(_mid).addScaledVector(_normal, arcHeight);

  const invT = 1 - t;
  out.set(
    invT * invT * start.x + 2 * invT * t * _control.x + t * t * end.x,
    invT * invT * start.y + 2 * invT * t * _control.y + t * t * end.y,
    invT * invT * start.z + 2 * invT * t * _control.z + t * t * end.z,
  );
  return out;
}

// ===================================================================
// Surface Orientation
// ===================================================================

/**
 * 메시를 지구본 표면에 정렬 (법선 방향으로 회전).
 * 기존 6개 이상 컴포넌트의 중복 lookAt/quaternion 로직을 대체.
 *
 * @param mesh     정렬할 Object3D
 * @param position 구면 위의 위치
 * @param normal   표면 법선 (보통 position.clone().normalize())
 */
export function orientToSurface(
  mesh: THREE.Object3D,
  position: THREE.Vector3,
  normal: THREE.Vector3,
): void {
  mesh.position.copy(position);
  _quatTemp.setFromUnitVectors(_upDefault, normal);
  mesh.quaternion.copy(_quatTemp);
  mesh.rotateX(-Math.PI / 2);
}

// ===================================================================
// Easing Functions (plan Section 3.5)
// ===================================================================

/** 이벤트 등장용 (300ms) */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** 이벤트 퇴장용 (500ms) */
export function easeInQuad(t: number): number {
  return t * t;
}

/** 아크 라인 생성용 (800ms) */
export function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

/** 카메라 이동용 (2.0s) */
export function easeInOutCubic(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
