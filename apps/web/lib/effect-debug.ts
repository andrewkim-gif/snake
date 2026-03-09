/**
 * effect-debug.ts -- v24 Phase 7: Coordinate Verification Debug Utilities
 *
 * 이펙트 좌표가 지구본 표면 위치와 정확히 일치하는지 검증하는 디버그 도구.
 * 개발 모드에서만 활성화되며, 프로덕션 빌드에서 tree-shaking으로 제거됨.
 *
 * 사용법 (개발 모드, R3F 컴포넌트 내에서):
 *   import { createDebugMarkers } from '@/lib/effect-debug';
 *   const markers = createDebugMarkers(countryCentroids, GLOBE_RADIUS);
 *   // markers를 <group>에 추가하여 시각적 확인
 *
 * 주의: 이 파일은 디버그 유틸리티만 제공. 실제 컴포넌트에 자동 삽입되지 않음.
 */

import * as THREE from 'three';
import { latLngToVector3 } from './globe-utils';
import type { CountryCentroidsMap } from './effect-constants';

// ===================================================================
// Development-only guard
// ===================================================================

const IS_DEV = process.env.NODE_ENV === 'development';

// ===================================================================
// Top 20 Countries for verification (ISO3 codes)
// ===================================================================

/**
 * 검증용 주요 20개국 ISO3 코드.
 * 대륙별 분포를 고려하여 선정:
 *   아시아(6): CHN, JPN, KOR, IND, IDN, SAU
 *   유럽(4): GBR, FRA, DEU, RUS
 *   북미(2): USA, CAN
 *   남미(2): BRA, ARG
 *   아프리카(3): NGA, ZAF, EGY
 *   오세아니아(1): AUS
 *   중동(2 포함됨): SAU, EGY (이미 아시아/아프리카에 포함)
 */
export const VERIFICATION_COUNTRIES: readonly string[] = [
  'USA', 'CHN', 'RUS', 'BRA', 'IND',
  'AUS', 'CAN', 'ARG', 'GBR', 'FRA',
  'DEU', 'JPN', 'KOR', 'NGA', 'ZAF',
  'EGY', 'IDN', 'SAU', 'MEX', 'TUR',
] as const;

// ===================================================================
// Debug Marker Creation
// ===================================================================

/**
 * 특정 좌표에 디버그용 작은 구체 마커를 생성.
 * 개발 모드에서만 동작하며, 프로덕션에서는 null을 반환.
 *
 * @param lat      위도 (-90 ~ 90)
 * @param lng      경도 (-180 ~ 180)
 * @param radius   지구본 반경 (마커 위치 계산용)
 * @param color    마커 색상 (기본: 빨간색 0xff0000)
 * @param size     마커 구체 반경 (기본: 1.5)
 * @returns THREE.Mesh 인스턴스 또는 null (프로덕션)
 */
export function createDebugMarker(
  lat: number,
  lng: number,
  radius: number,
  color: number = 0xff0000,
  size: number = 1.5,
): THREE.Mesh | null {
  if (!IS_DEV) return null;

  const position = latLngToVector3(lat, lng, radius + 2.0); // 표면 위 약간 띄움
  const geometry = new THREE.SphereGeometry(size, 8, 8);
  const material = new THREE.MeshBasicMaterial({
    color,
    depthTest: false,
    transparent: true,
    opacity: 0.85,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  mesh.renderOrder = 999; // 항상 최상위에 표시
  mesh.name = `debug-marker-${lat.toFixed(1)}-${lng.toFixed(1)}`;
  return mesh;
}

// ===================================================================
// Country Centroid Verification
// ===================================================================

/**
 * 주요 20개국 centroid에 디버그 마커를 생성하여 좌표 정확도를 시각적으로 검증.
 * 개발 모드에서만 동작.
 *
 * @param centroidsMap  ISO3 → [lat, lng] 매핑
 * @param globeRadius   지구본 반경
 * @returns THREE.Group containing debug markers, 또는 null (프로덕션)
 *
 * 사용 예시:
 * ```tsx
 * // R3F 컴포넌트 내에서
 * const debugGroup = useMemo(() =>
 *   verifyCountryCentroids(countryCentroids, 100),
 * [countryCentroids]);
 *
 * return debugGroup ? <primitive object={debugGroup} /> : null;
 * ```
 */
export function verifyCountryCentroids(
  centroidsMap: CountryCentroidsMap,
  globeRadius: number,
): THREE.Group | null {
  if (!IS_DEV) return null;

  const group = new THREE.Group();
  group.name = 'debug-centroid-verification';

  let found = 0;
  let missing = 0;
  const missingCountries: string[] = [];

  for (const iso3 of VERIFICATION_COUNTRIES) {
    const centroid = centroidsMap.get(iso3);
    if (!centroid) {
      missing++;
      missingCountries.push(iso3);
      continue;
    }

    const [lat, lng] = centroid;
    const marker = createDebugMarker(lat, lng, globeRadius, 0xff0000, 1.5);
    if (marker) {
      marker.name = `debug-centroid-${iso3}`;
      // 국가 코드를 userData에 저장 (디버그 인스펙터용)
      marker.userData = { iso3, lat, lng, type: 'centroid-verification' };
      group.add(marker);
      found++;
    }
  }

  // 콘솔 검증 결과 출력
  if (IS_DEV) {
    console.group('[v24 Debug] Centroid Verification');
    console.log(`Checked: ${VERIFICATION_COUNTRIES.length} countries`);
    console.log(`Found: ${found}, Missing: ${missing}`);
    if (missingCountries.length > 0) {
      console.warn(`Missing centroids for: ${missingCountries.join(', ')}`);
    }
    console.groupEnd();
  }

  return group;
}

// ===================================================================
// Arc Path Verification
// ===================================================================

/**
 * 두 좌표 사이의 아크 경로를 디버그용 점선으로 시각화.
 * 아크 이펙트의 시작/끝 좌표가 올바른지 확인하는 용도.
 *
 * @param fromLat   출발 위도
 * @param fromLng   출발 경도
 * @param toLat     도착 위도
 * @param toLng     도착 경도
 * @param radius    지구본 반경
 * @param color     라인 색상 (기본: 녹색 0x00ff00)
 * @returns THREE.Line 인스턴스 또는 null (프로덕션)
 */
export function createDebugArcLine(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  radius: number,
  color: number = 0x00ff00,
): THREE.Line | null {
  if (!IS_DEV) return null;

  const start = latLngToVector3(fromLat, fromLng, radius + 1.5);
  const end = latLngToVector3(toLat, toLng, radius + 1.5);

  // 직선 경로 (대원 아크가 아닌 시각적 디버그 라인)
  const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
  const material = new THREE.LineBasicMaterial({
    color,
    depthTest: false,
    transparent: true,
    opacity: 0.7,
  });
  const line = new THREE.Line(geometry, material);
  line.renderOrder = 998;
  line.name = `debug-arc-${fromLat.toFixed(0)},${fromLng.toFixed(0)}-${toLat.toFixed(0)},${toLng.toFixed(0)}`;
  return line;
}

// ===================================================================
// Coordinate Validation Helpers
// ===================================================================

/**
 * 위도/경도 값의 유효성 검증.
 * 이펙트 데이터에서 잘못된 좌표가 들어오는 경우를 감지.
 *
 * @param lat  위도
 * @param lng  경도
 * @returns 유효 여부 + 문제 설명
 */
export function validateCoordinate(
  lat: number,
  lng: number,
): { valid: boolean; issue?: string } {
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return { valid: false, issue: 'lat/lng must be numbers' };
  }
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return { valid: false, issue: 'NaN coordinate detected' };
  }
  if (lat < -90 || lat > 90) {
    return { valid: false, issue: `lat ${lat} out of range [-90, 90]` };
  }
  if (lng < -180 || lng > 180) {
    return { valid: false, issue: `lng ${lng} out of range [-180, 180]` };
  }
  return { valid: true };
}

/**
 * centroidsMap 전체의 좌표 유효성을 일괄 검증.
 * 개발 모드에서만 경고를 출력.
 *
 * @param centroidsMap  ISO3 → [lat, lng] 매핑
 * @returns 유효하지 않은 항목 배열 (프로덕션에서는 빈 배열)
 */
export function validateAllCentroids(
  centroidsMap: CountryCentroidsMap,
): Array<{ iso3: string; lat: number; lng: number; issue: string }> {
  if (!IS_DEV) return [];

  const issues: Array<{ iso3: string; lat: number; lng: number; issue: string }> = [];

  centroidsMap.forEach(([lat, lng], iso3) => {
    const result = validateCoordinate(lat, lng);
    if (!result.valid) {
      issues.push({ iso3, lat, lng, issue: result.issue! });
    }
  });

  if (issues.length > 0 && IS_DEV) {
    console.warn(`[v24 Debug] ${issues.length} invalid centroids found:`, issues);
  }

  return issues;
}
