/**
 * globe-utils.ts — 지구본 좌표 변환 공통 유틸리티 (v20 Phase 1)
 *
 * 7곳에 흩어진 3가지 변형의 위도/경도 → 3D 좌표 변환 함수를 통합:
 * - latLngToVector3(lat, lng, radius) → Vector3  (메인, 4곳 사용)
 * - latLngToXYZ(lat, lng, r) → Vector3           (alias, 2곳 사용)
 * - geoToXYZ(lon, lat, r, out, offset) → void    (Float32Array 성능용, 1곳 사용)
 *
 * 수학: 모두 동일한 구면 좌표 변환
 *   phi   = (90 - lat) × π/180
 *   theta = (lng + 180) × π/180
 *   x = -r × sin(phi) × cos(theta)
 *   y =  r × cos(phi)
 *   z =  r × sin(phi) × sin(theta)
 */

import * as THREE from 'three';

// ─── 상수 ───

const DEG2RAD = Math.PI / 180;

// ─── 메인 변환 함수 ───

/**
 * 위도/경도 → THREE.Vector3 (구면 좌표)
 * 가장 범용적인 시그니처. GlobeWarEffects, GlobeMissileEffect,
 * GlobeTradeRoutes, GlobeEventPulse 등에서 사용.
 */
export function latLngToVector3(
  lat: number,
  lng: number,
  radius: number,
): THREE.Vector3 {
  const phi = (90 - lat) * DEG2RAD;
  const theta = (lng + 180) * DEG2RAD;
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
     radius * Math.cos(phi),
     radius * Math.sin(phi) * Math.sin(theta),
  );
}

/**
 * latLngToVector3의 alias (파라미터명만 다름: radius → r)
 * GlobeConflictIndicators, GlobeCountryLabels에서 사용.
 */
export function latLngToXYZ(
  lat: number,
  lng: number,
  r: number,
): THREE.Vector3 {
  return latLngToVector3(lat, lng, r);
}

/**
 * (lon, lat) → Float32Array에 직접 기록하는 성능 최적화 버전.
 * 주의: 파라미터 순서가 (lon, lat)으로 다른 함수와 반대.
 * GlobeView의 지오메트리 구축 루프에서 GC 방지용.
 */
export function geoToXYZ(
  lon: number,
  lat: number,
  r: number,
  out: Float32Array,
  offset: number,
): void {
  const phi = (90 - lat) * DEG2RAD;
  const theta = (lon + 180) * DEG2RAD;
  out[offset]     = -r * Math.sin(phi) * Math.cos(theta);
  out[offset + 1] =  r * Math.cos(phi);
  out[offset + 2] =  r * Math.sin(phi) * Math.sin(theta);
}

// ─── WebGL 기능 감지 ───

/**
 * WEBGL_multi_draw 확장 지원 여부 감지.
 * BatchedMesh (1 draw call) vs InstancedMesh ×12 (12 draw calls) 분기 기준.
 *
 * 지원 현황:
 *   - Chrome/Edge 92+ (2021~): 지원
 *   - Safari 15+ (2021~): 지원
 *   - Firefox: 미지원 (2026.03 기준)
 */
export function supportsMultiDraw(renderer: THREE.WebGLRenderer): boolean {
  const gl = renderer.getContext();
  return !!gl.getExtension('WEBGL_multi_draw');
}
