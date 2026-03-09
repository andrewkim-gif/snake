'use client';

/**
 * GlobeScene v5 — Step 3: 구체 텍스처 + 국가 폴리곤
 * earth-blue-marble 텍스처 + GeoJSON earcut 삼각분할
 */

import { useState, useEffect, useMemo, useRef, useCallback, Suspense } from 'react';
import { Canvas, useThree, useLoader, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import earcut from 'earcut';
import { loadGeoJSON } from '@/lib/globe-data';
import { getCountryISO } from '@/lib/map-style';
import type { CountryClientState } from '@/lib/globe-data';

// v14: Globe domination + war effects
import { GlobeDominationLayer } from '@/components/3d/GlobeDominationLayer';
import type { CountryDominationState } from '@/components/3d/GlobeDominationLayer';
import { GlobeWarEffects } from '@/components/3d/GlobeWarEffects';
import type { WarEffectData } from '@/components/3d/GlobeWarEffects';

// v15: Flag atlas + country labels
import { GlobeCountryLabels } from '@/components/3d/GlobeCountryLabels';
import { loadFlagAtlas } from '@/lib/flag-atlas';
import type { FlagAtlasResult } from '@/lib/flag-atlas';
import { COUNTRIES } from '@/lib/country-data';

// v15 Phase 4: Missile + Shockwave effects
import { GlobeMissileEffect } from '@/components/3d/GlobeMissileEffect';
import { GlobeShockwave } from '@/components/3d/GlobeShockwave';
import type { GlobeShockwaveHandle } from '@/components/3d/GlobeShockwave';

// v15 Phase 5: Trade routes + Event pulse
import { GlobeTradeRoutes } from '@/components/3d/GlobeTradeRoutes';
import { GlobeEventPulse } from '@/components/3d/GlobeEventPulse';
import type { TradeRouteData } from '@/hooks/useSocket';
import type { GlobalEventData } from '@/components/3d/GlobeEventPulse';

// v28: Globe event labels (3D 뉴스 브리핑 라벨 + 아크 키워드 태그)
import { GlobeEventLabels } from '@/components/3d/GlobeEventLabels';

// v24 Phase 2: Unified camera controller (CameraAutoFocus + CameraShake 통합)
import { CameraController } from '@/components/3d/CameraController';
import { CAMERA_PRIORITY } from '@/lib/effect-constants';
import { useGlobeLOD, useGlobeLODDistance } from '@/hooks/useGlobeLOD';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { geoToXYZ } from '@/lib/globe-utils';

// v17: Intro camera animation
import { GlobeIntroCamera } from '@/components/3d/GlobeIntroCamera';

// v21 Phase 4: Bloom post-processing
import { EffectComposer, Bloom } from '@react-three/postprocessing';

// v20: Landmark sprites on globe surface
import { GlobeLandmarks } from '@/components/3d/GlobeLandmarks';
import { getArchetypeForISO3 } from '@/lib/landmark-data';
import { getArchetypeHeight } from '@/lib/landmark-geometries';
// v17: Conflict indicators on globe
import { GlobeConflictIndicators } from '@/components/3d/GlobeConflictIndicators';

// v23 Phase 5: 신규 이벤트 이펙트 (동맹, 제재, 자원, 첩보, 핵)
import { GlobeAllianceBeam } from '@/components/3d/GlobeAllianceBeam';
import type { AllianceData } from '@/components/3d/GlobeAllianceBeam';
import { GlobeSanctionBarrier } from '@/components/3d/GlobeSanctionBarrier';
import type { SanctionData } from '@/components/3d/GlobeSanctionBarrier';
import { GlobeResourceGlow } from '@/components/3d/GlobeResourceGlow';
import type { ResourceData } from '@/components/3d/GlobeResourceGlow';
import { GlobeSpyTrail } from '@/components/3d/GlobeSpyTrail';
import type { SpyOpData } from '@/components/3d/GlobeSpyTrail';
import { GlobeNukeEffect } from '@/components/3d/GlobeNukeEffect';
import type { NukeData } from '@/components/3d/GlobeNukeEffect';

interface GlobeViewProps {
  countryStates?: Map<string, CountryClientState>;
  selectedCountry?: string | null;
  onCountryClick?: (iso3: string, name: string) => void;
  style?: React.CSSProperties;
  /** v14: Domination overlay data */
  dominationStates?: Map<string, CountryDominationState>;
  /** v14: Active war effects data */
  wars?: WarEffectData[];
  /** v14: Country centroids for war arc rendering */
  countryCentroids?: Map<string, [number, number]>;
  /** v14: Hover callback for GlobeHoverPanel (iso3, name, or null to clear) */
  onHover?: (iso3: string | null, name: string | null) => void;
  /** v15 Phase 5: Trade routes for globe visualization */
  tradeRoutes?: TradeRouteData[];
  /** v15 Phase 5: Global events for pulse effects */
  globalEvents?: GlobalEventData[];
  /** v17: 인트로 카메라 애니메이션 활성화 */
  introActive?: boolean;
  /** v17: 인트로 카메라 완료 콜백 */
  onIntroComplete?: () => void;
  /** v17: ISO3 set of countries with active conflicts */
  activeConflictCountries?: Set<string>;
  /** v23 Phase 5: 동맹 이벤트 */
  alliances?: AllianceData[];
  /** v23 Phase 5: 제재 이벤트 */
  sanctions?: SanctionData[];
  /** v23 Phase 5: 자원 채굴 이벤트 */
  resources?: ResourceData[];
  /** v23 Phase 5: 첩보 이벤트 */
  spyOps?: SpyOpData[];
  /** v23 Phase 5: 핵실험 이벤트 */
  nukes?: NukeData[];
  /** 3D Canvas 로딩 완료 콜백 */
  onReady?: () => void;
}

const BG = '#030305';
const RADIUS = 100;
const ALT = 0.15; // 구체 표면 밀착 (최소 z-fighting 방지 오프셋)

// ─── 좌표 변환: geoToXYZ → @/lib/globe-utils (v20 통합) ───

// ─── 역변환: 구면 (x, y, z) → (lon, lat) ───

function xyzToGeo(point: THREE.Vector3, _r: number): [number, number] {
  const r = point.length();
  const lat = 90 - Math.acos(Math.max(-1, Math.min(1, point.y / r))) * (180 / Math.PI);
  let lon = Math.atan2(point.z, -point.x) * (180 / Math.PI) - 180;
  if (lon < -180) lon += 360;
  if (lon > 180) lon -= 360;
  return [lon, lat];
}

// ─── 점-다각형 내부 판별 (Ray Casting) ───

function pointInRing(lon: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function findCountryAtPoint(
  lon: number, lat: number, features: any[],
): { iso3: string; name: string } | null {
  for (const feature of features) {
    const geom = feature.geometry;
    if (!geom) continue;
    const { type, coordinates } = geom;
    const polygons: number[][][][] =
      type === 'Polygon' ? [coordinates] :
      type === 'MultiPolygon' ? coordinates : [];
    for (const rings of polygons) {
      if (pointInRing(lon, lat, rings[0])) {
        let inHole = false;
        for (let h = 1; h < rings.length; h++) {
          if (pointInRing(lon, lat, rings[h])) { inHole = true; break; }
        }
        if (!inHole) {
          const props = feature.properties || {};
          const iso3 = getCountryISO(props);
          const name = (props.NAME || props.ADMIN || iso3) as string;
          return iso3 ? { iso3, name } : null;
        }
      }
    }
  }
  return null;
}

// 모듈 레벨 호버 상태 (useFrame 읽기 / 이벤트 핸들러 쓰기)
let _hoveredIso3: string | null = null;

// ─── 변 세분화 (구면 곡률 보정) ───

const MAX_DEG = 2; // 2° 이상 변은 분할 → 삼각형이 구면에 밀착

function subdivideRing(ring: number[][]): number[][] {
  const result: number[][] = [];
  for (let i = 0; i < ring.length - 1; i++) {
    const [lon1, lat1] = ring[i];
    const [lon2, lat2] = ring[i + 1];
    result.push([lon1, lat1]);
    const dlon = lon2 - lon1;
    const dlat = lat2 - lat1;
    const dist = Math.sqrt(dlon * dlon + dlat * dlat);
    if (dist > MAX_DEG) {
      const segs = Math.ceil(dist / MAX_DEG);
      for (let j = 1; j < segs; j++) {
        const t = j / segs;
        result.push([lon1 + dlon * t, lat1 + dlat * t]);
      }
    }
  }
  // 마지막 점 (닫힌 링의 끝점)
  result.push(ring[ring.length - 1]);
  return result;
}

// ─── 폴리곤 삼각분할 ───

function triangulatePolygon(
  rings: number[][][],
  radius: number,
): Float32Array | null {
  if (!rings || rings.length === 0 || rings[0].length < 3) return null;

  // 각 링의 변을 세분화 (큰 삼각형 → 구면 처짐 방지)
  const subdividedRings = rings.map(subdivideRing);

  // earcut용 2D 좌표 + 홀 인덱스
  const flat: number[] = [];
  const holes: number[] = [];

  for (let i = 0; i < subdividedRings.length; i++) {
    if (i > 0) holes.push(flat.length / 2);
    for (const coord of subdividedRings[i]) {
      flat.push(coord[0], coord[1]); // lon, lat
    }
  }

  const indices = earcut(flat, holes.length > 0 ? holes : undefined, 2);
  if (indices.length === 0) return null;

  // 삼각 인덱스 → 3D 구면 좌표
  const raw = new Float32Array(indices.length * 3);
  for (let i = 0; i < indices.length; i++) {
    const idx = indices[i];
    const lon = flat[idx * 2];
    const lat = flat[idx * 2 + 1];
    geoToXYZ(lon, lat, radius, raw, i * 3);
  }

  // 큰 삼각형 재분할 → 구면 밀착
  return subdivideSphericalMesh(raw, radius, MAX_EDGE_3D);
}

// ─── 삼각형 재분할 + 구면 재투영 ───
// earcut이 만든 큰 내부 삼각형을 쪼개서 구면 곡률에 밀착시킴

function subdivideSphericalMesh(
  verts: Float32Array, radius: number, maxEdge: number,
): Float32Array {
  let tris = Array.from(verts);

  for (let iter = 0; iter < 6; iter++) {
    const next: number[] = [];
    let didSplit = false;

    for (let i = 0; i < tris.length; i += 9) {
      const ax = tris[i],   ay = tris[i+1], az = tris[i+2];
      const bx = tris[i+3], by = tris[i+4], bz = tris[i+5];
      const cx = tris[i+6], cy = tris[i+7], cz = tris[i+8];

      const dAB = Math.sqrt((bx-ax)**2 + (by-ay)**2 + (bz-az)**2);
      const dBC = Math.sqrt((cx-bx)**2 + (cy-by)**2 + (cz-bz)**2);
      const dCA = Math.sqrt((ax-cx)**2 + (ay-cy)**2 + (az-cz)**2);
      const maxD = Math.max(dAB, dBC, dCA);

      if (maxD <= maxEdge) {
        next.push(ax,ay,az, bx,by,bz, cx,cy,cz);
        continue;
      }

      didSplit = true;
      // 가장 긴 변의 중점 → 구면에 재투영
      let mx: number, my: number, mz: number;

      if (dAB >= dBC && dAB >= dCA) {
        mx = (ax+bx)/2; my = (ay+by)/2; mz = (az+bz)/2;
        const s = radius / Math.sqrt(mx*mx + my*my + mz*mz);
        mx *= s; my *= s; mz *= s;
        next.push(ax,ay,az, mx,my,mz, cx,cy,cz);
        next.push(mx,my,mz, bx,by,bz, cx,cy,cz);
      } else if (dBC >= dCA) {
        mx = (bx+cx)/2; my = (by+cy)/2; mz = (bz+cz)/2;
        const s = radius / Math.sqrt(mx*mx + my*my + mz*mz);
        mx *= s; my *= s; mz *= s;
        next.push(ax,ay,az, bx,by,bz, mx,my,mz);
        next.push(ax,ay,az, mx,my,mz, cx,cy,cz);
      } else {
        mx = (cx+ax)/2; my = (cy+ay)/2; mz = (cz+az)/2;
        const s = radius / Math.sqrt(mx*mx + my*my + mz*mz);
        mx *= s; my *= s; mz *= s;
        next.push(ax,ay,az, bx,by,bz, mx,my,mz);
        next.push(mx,my,mz, bx,by,bz, cx,cy,cz);
      }
    }

    tris = next;
    if (!didSplit) break;
  }

  return new Float32Array(tris);
}

// 5° 호에 해당하는 현 길이 (R=102 기준 ≈ 8.9)
const MAX_EDGE_3D = 2 * (RADIUS + ALT) * Math.sin(5 * Math.PI / 360);

// ─── GeoJSON → BufferGeometry 배열 ───

interface CountryGeo {
  iso3: string;
  name: string;
  geometry: THREE.BufferGeometry;
  centroid: THREE.Vector3;
}

const LABEL_R = RADIUS + ALT + 2; // 라벨 높이 (폴리곤 위)

// ─── 면적 가중 중심 (area-weighted centroid) ───
// 각 폴리곤의 외곽 링을 삼각형으로 분할, 삼각형 면적 가중 평균으로
// 불규칙 국가(칠레, 인도네시아, 러시아 등)에서도 시각 중심에 정확히 위치

// GC 방지: 모듈 스코프 temp 변수
let _triArea = 0;
let _cx = 0;
let _cy = 0;

/** 단일 링(외곽)의 면적 가중 centroid 반환 [lon, lat, signedArea] */
function ringAreaCentroid(ring: number[][]): [number, number, number] {
  const n = ring.length;
  if (n < 3) return [ring[0][0], ring[0][1], 0];

  let totalArea = 0;
  let wLon = 0;
  let wLat = 0;

  // 삼각형 분할: ring[0] 기준 fan triangulation
  for (let i = 1; i < n - 1; i++) {
    const x0 = ring[0][0], y0 = ring[0][1];
    const x1 = ring[i][0], y1 = ring[i][1];
    const x2 = ring[i + 1][0], y2 = ring[i + 1][1];

    // 삼각형의 부호 있는 면적 (shoelace의 삼각형 버전)
    _triArea = ((x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0)) * 0.5;

    // 삼각형 중심
    _cx = (x0 + x1 + x2) / 3;
    _cy = (y0 + y1 + y2) / 3;

    // 면적 가중 누적 (부호 있는 면적으로 방향 유지)
    wLon += _triArea * _cx;
    wLat += _triArea * _cy;
    totalArea += _triArea;
  }

  if (Math.abs(totalArea) < 1e-10) {
    // 퇴화 폴리곤: 단순 평균 폴백
    let sLon = 0, sLat = 0;
    for (const [lon, lat] of ring) { sLon += lon; sLat += lat; }
    return [sLon / n, sLat / n, 0];
  }

  return [wLon / totalArea, wLat / totalArea, Math.abs(totalArea)];
}

function computeCentroid(polygons: number[][][][]): [number, number] {
  let totalWeight = 0;
  let wLon = 0;
  let wLat = 0;

  for (const rings of polygons) {
    const outerRing = rings[0];
    if (!outerRing || outerRing.length < 3) continue;

    const [cLon, cLat, area] = ringAreaCentroid(outerRing);
    wLon += area * cLon;
    wLat += area * cLat;
    totalWeight += area;
  }

  if (totalWeight < 1e-10) {
    // 모든 폴리곤이 퇴화: 가장 큰 외곽 링의 단순 평균 폴백
    let bestRing = polygons[0][0];
    for (const rings of polygons) {
      if (rings[0].length > bestRing.length) bestRing = rings[0];
    }
    let sLon = 0, sLat = 0;
    for (const [lon, lat] of bestRing) { sLon += lon; sLat += lat; }
    return [sLon / bestRing.length, sLat / bestRing.length];
  }

  return [wLon / totalWeight, wLat / totalWeight];
}

function buildCountryGeometries(geoData: { features: any[] }): CountryGeo[] {
  const result: CountryGeo[] = [];

  for (const feature of geoData.features) {
    const geom = feature.geometry;
    if (!geom) continue;

    const props = feature.properties || {};
    const iso3 = getCountryISO(props);
    if (!iso3) continue;

    const name = (props.NAME || props.ADMIN || iso3) as string;
    const { type, coordinates } = geom;

    // Polygon / MultiPolygon → 통일된 배열
    const polygons: number[][][][] =
      type === 'Polygon' ? [coordinates] :
      type === 'MultiPolygon' ? coordinates : [];

    if (polygons.length === 0) continue;

    // 각 파트 삼각분할 후 병합
    const parts: Float32Array[] = [];
    for (const rings of polygons) {
      const verts = triangulatePolygon(rings, RADIUS + ALT);
      if (verts) parts.push(verts);
    }
    if (parts.length === 0) continue;

    const total = parts.reduce((s, v) => s + v.length, 0);
    const merged = new Float32Array(total);
    let off = 0;
    for (const v of parts) { merged.set(v, off); off += v.length; }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(merged, 3));
    geo.computeVertexNormals();

    // 중심점 → 3D 좌표
    const [cLon, cLat] = computeCentroid(polygons);
    const tmp = new Float32Array(3);
    geoToXYZ(cLon, cLat, LABEL_R, tmp, 0);
    const centroid = new THREE.Vector3(tmp[0], tmp[1], tmp[2]);

    result.push({ iso3, name, geometry: geo, centroid });
  }

  return result;
}

// ─── R3F: 지구 PBR 셰이더 (day/night 혼합 + 터미네이터 잔사광) ───

// v21: 야간 텍스처 로드 실패 시 검정 1x1 fallback 생성
function createBlackTexture(): THREE.DataTexture {
  const data = new Uint8Array([0, 0, 0, 255]);
  const tex = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}

// v21: EarthSphere PBR vertex shader (TBN matrix for tangent-space normal mapping)
const earthVertexShader = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  varying vec2 vUv;
  varying mat3 vTBN;

  void main() {
    vUv = uv;
    vec3 N = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    vWorldNormal = N;
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;

    // 구면 좌표계 탄젠트 계산 (구체 전용)
    // theta 방향 탄젠트 (경도 방향)
    vec3 T = normalize(cross(vec3(0.0, 1.0, 0.0), N));
    // 극점 근처 보정
    if (length(cross(vec3(0.0, 1.0, 0.0), N)) < 0.001) {
      T = normalize(cross(vec3(1.0, 0.0, 0.0), N));
    }
    vec3 B = cross(N, T);
    vTBN = mat3(T, B, N);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// v21: EarthSphere PBR fragment shader (TBN normal map + specular + atmosphere)
const earthFragmentShader = /* glsl */ `
  uniform sampler2D uDayMap;
  uniform sampler2D uNightMap;
  uniform sampler2D uNormalMap;
  uniform sampler2D uSpecularMap;
  uniform vec3 uSunDir;
  uniform float uNormalScale;

  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  varying vec2 vUv;
  varying mat3 vTBN;

  void main() {
    vec3 N = normalize(vWorldNormal);

    // TBN 노멀맵 적용 (tangent-space → world-space)
    vec3 mapN = texture2D(uNormalMap, vUv).rgb * 2.0 - 1.0;
    mapN.xy *= uNormalScale;
    vec3 perturbedN = normalize(vTBN * mapN);

    // 태양 방향
    float sunOrientation = dot(N, uSunDir);           // 밤낮/대기 전환 (smooth normal)
    float sunOrientBump = dot(perturbedN, uSunDir);    // 디퓨즈 라이팅 (perturbed normal)

    // 낮/밤 혼합 팩터
    float dayStrength = smoothstep(-0.25, 0.5, sunOrientation);

    // 낮: 디퓨즈 라이팅
    vec3 dayColor = texture2D(uDayMap, vUv).rgb;
    float diffuse = max(sunOrientBump, 0.0) * 0.75 + 0.12;
    dayColor *= diffuse;

    // 스페큘러: 바다 반사 (Blinn-Phong)
    float specMask = texture2D(uSpecularMap, vUv).r;
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    vec3 halfDir = normalize(uSunDir + viewDir);
    float specAngle = max(dot(perturbedN, halfDir), 0.0);
    float specular = pow(specAngle, 64.0) * specMask * 0.5;
    dayColor += vec3(1.0, 0.98, 0.95) * specular * dayStrength;

    // 밤: 도시 불빛
    vec3 nightLights = texture2D(uNightMap, vUv).rgb;
    vec3 dayTex = texture2D(uDayMap, vUv).rgb;
    float nightAmbient = 0.015;
    vec3 nightColor = nightLights * 1.5 + dayTex * nightAmbient;

    // 대기 프레넬 (가장자리에서만 — 표면 내부에선 없음)
    float fresnel = 1.0 - max(dot(viewDir, N), 0.0);
    float rim = pow(fresnel, 6.0); // 높은 지수 → 극단적 가장자리만

    // 대기 색상: twilight(터미네이터) ↔ day blue
    vec3 twilightColor = vec3(1.0, 0.45, 0.2);
    vec3 dayAtmoColor = vec3(0.3, 0.55, 0.9);
    float atmoColorMix = smoothstep(-0.25, 0.75, sunOrientation);
    vec3 atmosphereColor = mix(twilightColor, dayAtmoColor, atmoColorMix);

    // 최종 혼합
    vec3 color = mix(nightColor, dayColor, dayStrength);
    color += atmosphereColor * rim * smoothstep(-0.2, 0.5, sunOrientation) * 0.4;

    gl_FragColor = vec4(color, 1.0);
  }
`;

// 기본 노멀맵 (파란색 = 평면 노멀 [0.5, 0.5, 1.0])
function createFlatNormalTexture(): THREE.DataTexture {
  const data = new Uint8Array([128, 128, 255, 255]);
  const tex = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}

// 기본 스페큘러맵 (검정 = 반사 없음)
function createBlackSpecularTexture(): THREE.DataTexture {
  const data = new Uint8Array([0, 0, 0, 255]);
  const tex = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}

function EarthSphere() {
  const dayTexture = useLoader(THREE.TextureLoader, '/textures/earth-blue-marble.jpg');
  dayTexture.colorSpace = THREE.SRGBColorSpace;

  // v21: 추가 텍스처 로드 (night, normal, specular — 비동기, fallback 포함)
  const nightTextureRef = useRef<THREE.Texture | null>(null);
  const normalTextureRef = useRef<THREE.Texture | null>(null);
  const specularTextureRef = useRef<THREE.Texture | null>(null);
  const [texturesReady, setTexturesReady] = useState(0); // 로드 완료 카운터

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    let mounted = true;
    const onLoad = () => { if (mounted) setTexturesReady(prev => prev + 1); };

    // 야간 도시 불빛 (고해상도 2K)
    loader.load('/textures/earth-night-lights.jpg',
      (tex) => { tex.colorSpace = THREE.SRGBColorSpace; nightTextureRef.current = tex; onLoad(); },
      undefined,
      () => { nightTextureRef.current = createBlackTexture(); onLoad(); },
    );
    // 노멀맵 (산맥/지형 질감 — 8K solarsystemscope 5x enhanced)
    loader.load('/textures/earth-normal-map.jpg',
      (tex) => { tex.colorSpace = THREE.LinearSRGBColorSpace; normalTextureRef.current = tex; onLoad(); },
      undefined,
      () => { normalTextureRef.current = createFlatNormalTexture(); onLoad(); },
    );
    // 스페큘러맵 (바다 반사 / 육지 무광)
    loader.load('/textures/earth-specular-map.jpg',
      (tex) => { tex.colorSpace = THREE.LinearSRGBColorSpace; specularTextureRef.current = tex; onLoad(); },
      undefined,
      () => { specularTextureRef.current = createBlackSpecularTexture(); onLoad(); },
    );
    return () => {
      mounted = false;
      nightTextureRef.current?.dispose();
      normalTextureRef.current?.dispose();
      specularTextureRef.current?.dispose();
    };
  }, []);

  // v21: Custom ShaderMaterial (day/night + normal + specular PBR)
  const earthMat = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uDayMap: { value: dayTexture },
        uNightMap: { value: createBlackTexture() },
        uNormalMap: { value: createFlatNormalTexture() },
        uSpecularMap: { value: createBlackSpecularTexture() },
        uSunDir: { value: new THREE.Vector3(1, 0, 0) },
        uNormalScale: { value: 1.0 },
      },
      vertexShader: earthVertexShader,
      fragmentShader: earthFragmentShader,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayTexture]);

  // 텍스처 로드 완료 시 uniform 업데이트
  useEffect(() => {
    if (texturesReady < 3) return;
    if (nightTextureRef.current) earthMat.uniforms.uNightMap.value = nightTextureRef.current;
    if (normalTextureRef.current) earthMat.uniforms.uNormalMap.value = normalTextureRef.current;
    if (specularTextureRef.current) earthMat.uniforms.uSpecularMap.value = specularTextureRef.current;
    earthMat.uniformsNeedUpdate = true;
  }, [texturesReady, earthMat]);

  // v21: useFrame에서 태양 방향 갱신 (UTC 기반 실시간 위치)
  useFrame(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000);
    const utcH = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
    // 태양 적위 (지축 23.44도 기울기)
    const decRad = (-23.44 * Math.cos(((dayOfYear + 10) / 365) * 2 * Math.PI)) * (Math.PI / 180);
    // 시간각: UTC 12시 = 본초자오선 정오
    const ha = ((utcH - 12) / 24) * 2 * Math.PI;
    const sx = Math.cos(decRad) * Math.cos(ha);
    const sy = Math.sin(decRad);
    const sz = Math.cos(decRad) * Math.sin(ha);
    earthMat.uniforms.uSunDir.value.set(sx, sy, sz).normalize();
  });

  return (
    <mesh material={earthMat}>
      <sphereGeometry args={[RADIUS, 64, 64]} />
    </mesh>
  );
}

// ─── R3F: 구름 레이어 (반투명 구체, 지구 위 약간 떠 있음) ───

const cloudsVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;

  void main() {
    vUv = uv;
    vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const cloudsFragmentShader = /* glsl */ `
  uniform sampler2D uCloudsMap;
  uniform vec3 uSunDir;

  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;

  void main() {
    vec3 N = normalize(vWorldNormal);
    float NdotL = dot(N, uSunDir);

    // 구름 텍스처 (밝기 = 알파)
    float cloudAlpha = texture2D(uCloudsMap, vUv).r;

    // 낮/밤 팩터 — 밤 면은 완전 투명
    float dayFactor = smoothstep(-0.1, 0.5, NdotL);

    // 최종 알파: 텍스처 * 낮/밤 * 전체 투명도
    float finalAlpha = cloudAlpha * dayFactor * 0.55;

    // 거의 보이지 않는 프래그먼트는 discard (검은 잔여물 원천 차단)
    if (finalAlpha < 0.005) discard;

    // 구름 라이팅: 밝은 디퓨즈 조명 (밤 면은 이미 discard)
    float diffuse = max(NdotL, 0.0) * 0.6 + 0.4;
    vec3 cloudColor = vec3(diffuse);

    gl_FragColor = vec4(cloudColor, finalAlpha);
  }
`;

function EarthClouds() {
  const cloudsTextureRef = useRef<THREE.Texture | null>(null);
  const matRef = useRef<THREE.ShaderMaterial | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    let mounted = true;
    loader.load('/textures/earth-clouds.jpg',
      (tex) => {
        tex.colorSpace = THREE.LinearSRGBColorSpace;
        cloudsTextureRef.current = tex;
        if (mounted) setReady(true);
      },
      undefined,
      () => { if (mounted) setReady(false); },
    );
    return () => {
      mounted = false;
      cloudsTextureRef.current?.dispose();
    };
  }, []);

  const cloudsMat = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uCloudsMap: { value: createBlackTexture() },
        uSunDir: { value: new THREE.Vector3(1, 0, 0) },
      },
      vertexShader: cloudsVertexShader,
      fragmentShader: cloudsFragmentShader,
      transparent: true,
      depthWrite: false,
    });
    matRef.current = mat;
    return mat;
  }, []);

  useEffect(() => {
    if (ready && cloudsTextureRef.current && matRef.current) {
      matRef.current.uniforms.uCloudsMap.value = cloudsTextureRef.current;
      matRef.current.uniformsNeedUpdate = true;
    }
  }, [ready]);

  // 태양 방향 동기화 + 느린 회전
  useFrame((_state, delta) => {
    if (!matRef.current) return;
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000);
    const utcH = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
    const decRad = (-23.44 * Math.cos(((dayOfYear + 10) / 365) * 2 * Math.PI)) * (Math.PI / 180);
    const ha = ((utcH - 12) / 24) * 2 * Math.PI;
    const sx = Math.cos(decRad) * Math.cos(ha);
    const sy = Math.sin(decRad);
    const sz = Math.cos(decRad) * Math.sin(ha);
    matRef.current.uniforms.uSunDir.value.set(sx, sy, sz).normalize();
  });

  // 구름: 지구 반경보다 살짝 큰 구체 (0.5% 위)
  return (
    <mesh material={cloudsMat} renderOrder={50}>
      <sphereGeometry args={[RADIUS * 1.005, 64, 64]} />
    </mesh>
  );
}

// ─── R3F: 대기 산란 (태양→지구 빛 산란) ───

const atmoVertexShader = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  void main() {
    vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const atmoFragmentShader = /* glsl */ `
  uniform vec3 uSunDir;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;

  void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 viewDir = normalize(cameraPosition - vWorldPos);

    // 프레넬 림
    float NdotV = dot(viewDir, N);
    float fresnel = 1.0 - abs(NdotV);
    float rim = pow(fresnel, 4.5);

    // 태양 방향
    float sunDot = dot(N, uSunDir);
    float sunFacing = max(sunDot, 0.0);

    // 밤 쪽 제거
    float dayCut = smoothstep(-0.1, 0.2, sunDot);

    // --- 태양→지구 대기 수렴 산란 (Forward Scattering) ---
    // 카메라가 태양 쪽을 볼 때, 대기 가장자리에서 빛이 수렴/집중
    // Mie scattering 근사: viewDir·sunDir 가 높을수록 (역광) 강한 산란
    float VdotS = max(dot(viewDir, uSunDir), 0.0);
    float forwardScatter = pow(VdotS, 6.0) * rim * dayCut;  // ★ dayCut 적용 — 밤면 제거
    float scatterIntensity = forwardScatter * 8.0;  // HDR 강화 → threshold 0.9 돌파

    // 기본 대기 림 (태양 방향 가중)
    float basicAtmo = pow(sunFacing, 2.0) * rim * 0.8;

    // 대기 색상
    vec3 blueAtmo = vec3(0.35, 0.55, 0.95);
    vec3 scatterColor = vec3(1.0, 0.92, 0.8); // 따뜻한 수렴 산란

    // 터미네이터 오렌지 림
    float termRegion = smoothstep(-0.1, 0.05, sunDot) * smoothstep(0.3, 0.05, sunDot);
    vec3 termColor = vec3(1.0, 0.5, 0.15) * termRegion * 0.6;

    // 합성: 기본 파란 대기 + 수렴 산란 HDR + 터미네이터
    vec3 color = blueAtmo * basicAtmo + scatterColor * scatterIntensity + termColor;

    // 알파: 기본 림 + 수렴 산란 보정
    float alpha = rim * dayCut * 0.45 + forwardScatter * 0.4;
    alpha = clamp(alpha, 0.0, 0.85);

    gl_FragColor = vec4(color, alpha);
  }
`;

function AtmosphereGlow() {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  useFrame(() => {
    if (!matRef.current) return;
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000);
    const utcH = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
    const decRad = (-23.44 * Math.cos(((dayOfYear + 10) / 365) * 2 * Math.PI)) * (Math.PI / 180);
    const ha = ((utcH - 12) / 24) * 2 * Math.PI;
    const sx = Math.cos(decRad) * Math.cos(ha);
    const sy = Math.sin(decRad);
    const sz = Math.cos(decRad) * Math.sin(ha);
    matRef.current.uniforms.uSunDir.value.set(sx, sy, sz).normalize();
  });

  return (
    <mesh renderOrder={48}>
      <sphereGeometry args={[RADIUS * 1.02, 64, 64]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={atmoVertexShader}
        fragmentShader={atmoFragmentShader}
        uniforms={{ uSunDir: { value: new THREE.Vector3(1, 0, 0) } }}
        transparent
        side={THREE.BackSide}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

// ─── R3F: 실시간 태양 (UTC 기반 위치 + 코로나 글로우) ───

function SunLight() {
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const sunRef = useRef<THREE.Group>(null);

  // 태양 코로나 — 중심이 밝고 급격히 감쇠하는 자연스러운 그래디언트
  const glowTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(255,252,240,1.0)');
    g.addColorStop(0.05, 'rgba(255,248,220,0.8)');
    g.addColorStop(0.12, 'rgba(255,235,180,0.3)');
    g.addColorStop(0.25, 'rgba(255,220,140,0.08)');
    g.addColorStop(0.5, 'rgba(255,200,100,0.01)');
    g.addColorStop(1, 'rgba(255,180,80,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(canvas);
  }, []);

  useFrame(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000);
    const utcH = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
    const decRad = (-23.44 * Math.cos(((dayOfYear + 10) / 365) * 2 * Math.PI)) * (Math.PI / 180);
    const ha = ((utcH - 12) / 24) * 2 * Math.PI;
    const d = 500;
    const x = d * Math.cos(decRad) * Math.cos(ha);
    const y = d * Math.sin(decRad);
    const z = d * Math.cos(decRad) * Math.sin(ha);
    lightRef.current?.position.set(x, y, z);
    sunRef.current?.position.set(x, y, z);
  });

  return (
    <>
      <directionalLight ref={lightRef} intensity={2.5} color="#FFF8F0" />
      <group ref={sunRef}>
        {/* 태양 코어 */}
        <mesh>
          <sphereGeometry args={[3, 16, 16]} />
          <meshBasicMaterial color="#FFF8E0" toneMapped={false} />
        </mesh>
        {/* 코로나 외부 */}
        <sprite scale={[50, 50, 1]}>
          <spriteMaterial
            map={glowTexture}
            transparent
            opacity={0.35}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </sprite>
        {/* 코로나 내부 */}
        <sprite scale={[20, 20, 1]}>
          <spriteMaterial
            map={glowTexture}
            transparent
            opacity={0.5}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </sprite>
      </group>
    </>
  );
}

// ─── R3F: Stars + Milky Way 배경 (equirectangular skybox) ───

const _starCamDir = new THREE.Vector3();

function Starfield() {
  const { scene, camera } = useThree();
  const milkyWayTexture = useLoader(THREE.TextureLoader, '/textures/stars-milky-way.jpg');

  useMemo(() => {
    milkyWayTexture.colorSpace = THREE.SRGBColorSpace;
    milkyWayTexture.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = milkyWayTexture;
  }, [milkyWayTexture, scene]);

  useFrame(() => {
    const dist = camera.position.length();
    const t = THREE.MathUtils.clamp((dist - 150) / (400 - 150), 0, 1);
    const smooth = t * t * (3 - 2 * t);

    // 거리 기반 밝기: 줌인=어둡게, 줌아웃=밝게
    scene.backgroundIntensity = 0.3 + smooth * 0.3;

    // 패럴랙스 회전
    _starCamDir.copy(camera.position).normalize();
    scene.backgroundRotation.set(
      _starCamDir.y * 0.08,
      -_starCamDir.x * 0.08,
      0,
    );
  });

  useEffect(() => {
    return () => {
      scene.background = null;
      scene.backgroundIntensity = 1;
      scene.backgroundRotation.set(0, 0, 0);
    };
  }, [scene]);

  return null;
}

// ─── R3F: 국가 경계선 (단일 배치 LineSegments) ───

function buildBorderPositions(geoData: { features: any[] }): Float32Array {
  const segs: number[] = [];
  const borderR = RADIUS + 0.15; // 지구 표면에 밀착 (z-fighting 방지 최소 오프셋)
  const tmp1 = new Float32Array(3);
  const tmp2 = new Float32Array(3);

  for (const feature of geoData.features) {
    const geom = feature.geometry;
    if (!geom) continue;
    const { type, coordinates } = geom;
    const polygons: number[][][][] =
      type === 'Polygon' ? [coordinates] :
      type === 'MultiPolygon' ? coordinates : [];

    for (const rings of polygons) {
      const ring = subdivideRing(rings[0]);
      for (let i = 0; i < ring.length - 1; i++) {
        geoToXYZ(ring[i][0], ring[i][1], borderR, tmp1, 0);
        geoToXYZ(ring[i + 1][0], ring[i + 1][1], borderR, tmp2, 0);
        segs.push(tmp1[0], tmp1[1], tmp1[2], tmp2[0], tmp2[1], tmp2[2]);
      }
    }
  }
  return new Float32Array(segs);
}

function CountryBorders() {
  const { size } = useThree();
  const [line, setLine] = useState<LineSegments2 | null>(null);

  useEffect(() => {
    loadGeoJSON().then((data) => {
      const positions = buildBorderPositions(data);
      const geo = new LineSegmentsGeometry();
      geo.setPositions(positions);
      const mat = new LineMaterial({
        color: 0x000000,
        linewidth: 1.2,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
      });
      mat.resolution.set(size.width, size.height);
      setLine(new LineSegments2(geo, mat));
    }).catch(console.error);
    return () => {
      if (line) {
        line.geometry.dispose();
        (line.material as LineMaterial).dispose();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 캔버스 리사이즈 시 해상도 업데이트
  useEffect(() => {
    if (line) (line.material as LineMaterial).resolution.set(size.width, size.height);
  }, [size, line]);

  if (!line) return null;
  return <primitive object={line} />;
}

// ─── R3F: 국가 인터랙션 (레이캐스트 → 국가 감지 + 클릭) ───

const CLICK_DRAG_THRESHOLD = 25; // 5px² — 이 이상 움직이면 드래그로 판정

function GlobeInteraction({ onCountryClick, onHover }: { onCountryClick?: (iso3: string, name: string) => void; onHover?: (iso3: string | null, name: string | null) => void }) {
  const featuresRef = useRef<any[]>([]);
  const hoveredRef = useRef<{ iso3: string; name: string } | null>(null);
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    loadGeoJSON().then((data) => { featuresRef.current = data.features; }).catch(console.error);
    return () => { document.body.style.cursor = 'default'; };
  }, []);

  const handlePointerMove = useCallback((e: any) => {
    e.stopPropagation();
    const point = e.point as THREE.Vector3;
    const [lon, lat] = xyzToGeo(point, RADIUS);
    const hit = findCountryAtPoint(lon, lat, featuresRef.current);
    if (hit) {
      _hoveredIso3 = hit.iso3;
      hoveredRef.current = hit;
      document.body.style.cursor = 'pointer';
      onHover?.(hit.iso3, hit.name);
    } else {
      _hoveredIso3 = null;
      hoveredRef.current = null;
      document.body.style.cursor = 'default';
      onHover?.(null, null);
    }
  }, [onHover]);

  // 드래그 시작 지점 기록
  const handlePointerDown = useCallback((e: any) => {
    e.stopPropagation();
    const ne = e.nativeEvent as PointerEvent;
    pointerDownPos.current = { x: ne.clientX, y: ne.clientY };
  }, []);

  // 클릭: 드래그 거리가 임계값 미만일 때만 국가 선택
  const handleClick = useCallback((e: any) => {
    e.stopPropagation();
    const ne = e.nativeEvent as PointerEvent;
    if (pointerDownPos.current) {
      const dx = ne.clientX - pointerDownPos.current.x;
      const dy = ne.clientY - pointerDownPos.current.y;
      if (dx * dx + dy * dy > CLICK_DRAG_THRESHOLD) return; // 드래그 → 무시
    }
    if (hoveredRef.current && onCountryClick) {
      onCountryClick(hoveredRef.current.iso3, hoveredRef.current.name);
    }
  }, [onCountryClick]);

  const handlePointerLeave = useCallback(() => {
    _hoveredIso3 = null;
    hoveredRef.current = null;
    document.body.style.cursor = 'default';
    onHover?.(null, null);
  }, [onHover]);

  return (
    <mesh
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onClick={handleClick}
      onPointerLeave={handlePointerLeave}
    >
      <sphereGeometry args={[RADIUS + 3, 64, 64]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} depthTest={false} colorWrite={false} />
    </mesh>
  );
}

// ─── R3F: 호버 국가 폴리곤 하이라이트 ───

const _hoverColor = new THREE.Color('#4DA6D9');

function CountryHoverHighlight({ countries }: { countries: CountryGeo[] }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const prevIso = useRef<string | null>(null);
  const fadeRef = useRef(0); // 0=투명, 1=완전 표시

  // iso3 → geometry 맵 (빠른 조회)
  const geoMap = useMemo(() => {
    const map = new Map<string, THREE.BufferGeometry>();
    for (const c of countries) map.set(c.iso3, c.geometry);
    return map;
  }, [countries]);

  useFrame(() => {
    const mesh = meshRef.current;
    const mat = matRef.current;
    if (!mesh || !mat) return;

    const hovIso = _hoveredIso3;
    const target = hovIso ? 1 : 0;
    fadeRef.current += (target - fadeRef.current) * 0.18;
    if (fadeRef.current < 0.005) fadeRef.current = 0;
    if (fadeRef.current > 0.995) fadeRef.current = 1;

    // 호버 대상 변경 시 geometry 교체
    if (hovIso !== prevIso.current) {
      prevIso.current = hovIso;
      if (hovIso) {
        const geo = geoMap.get(hovIso);
        if (geo) {
          mesh.geometry = geo;
          mesh.visible = true;
          fadeRef.current = 0.15; // 약간의 즉시 표시
        } else {
          mesh.visible = false;
        }
      }
    }

    if (!hovIso) {
      if (fadeRef.current < 0.01) mesh.visible = false;
    }
    mat.opacity = fadeRef.current * 0.35;
  });

  return (
    <mesh ref={meshRef} visible={false} renderOrder={1}>
      <bufferGeometry />
      <meshBasicMaterial
        ref={matRef}
        color={_hoverColor}
        transparent
        opacity={0}
        depthWrite={false}
        side={THREE.DoubleSide}
        polygonOffset
        polygonOffsetFactor={-1}
        polygonOffsetUnits={-1}
      />
    </mesh>
  );
}

// ─── R3F: 호버 경계선 빛 효과 (traveling light pulse) ───

interface CountryBorderGeoData {
  geometry: THREE.BufferGeometry;
  totalLength: number;
}

function buildPerCountryBorders(geoData: { features: any[] }): Map<string, CountryBorderGeoData> {
  const map = new Map<string, CountryBorderGeoData>();
  const borderR = RADIUS + ALT + 0.05;
  const tmp1 = new Float32Array(3);
  const tmp2 = new Float32Array(3);

  for (const feature of geoData.features) {
    const geom = feature.geometry;
    if (!geom) continue;
    const props = feature.properties || {};
    const iso3 = getCountryISO(props);
    if (!iso3) continue;

    const { type, coordinates } = geom;
    const polygons: number[][][][] =
      type === 'Polygon' ? [coordinates] :
      type === 'MultiPolygon' ? coordinates : [];

    const positions: number[] = [];
    const dists: number[] = [];
    let cumDist = 0;

    for (const rings of polygons) {
      const ring = subdivideRing(rings[0]);
      for (let i = 0; i < ring.length - 1; i++) {
        geoToXYZ(ring[i][0], ring[i][1], borderR, tmp1, 0);
        geoToXYZ(ring[i + 1][0], ring[i + 1][1], borderR, tmp2, 0);
        positions.push(tmp1[0], tmp1[1], tmp1[2]);
        dists.push(cumDist);
        const dx = tmp2[0] - tmp1[0], dy = tmp2[1] - tmp1[1], dz = tmp2[2] - tmp1[2];
        cumDist += Math.sqrt(dx * dx + dy * dy + dz * dz);
        positions.push(tmp2[0], tmp2[1], tmp2[2]);
        dists.push(cumDist);
      }
    }

    if (positions.length === 0) continue;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('aDistance', new THREE.Float32BufferAttribute(dists, 1));
    map.set(iso3, { geometry: geo, totalLength: cumDist });
  }

  return map;
}

function HoverBorderGlow() {
  const borderDataRef = useRef<Map<string, CountryBorderGeoData>>(new Map());
  const lineRef = useRef<THREE.LineSegments>(null);
  const prevIso = useRef<string | null>(null);
  const fadeRef = useRef(0);
  const [loaded, setLoaded] = useState(false);

  const shaderMat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uTotalLength: { value: 1 },
      uOpacity: { value: 0 },
    },
    vertexShader: `
      attribute float aDistance;
      varying float vDist;
      void main() {
        vDist = aDistance;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uTotalLength;
      uniform float uOpacity;
      varying float vDist;
      void main() {
        // 움직이는 점선 — 월드 좌표 기반 일정 간격
        float dashSize = 3.0;
        float t = fract(vDist / dashSize - uTime * 1.5);
        float dash = smoothstep(0.0, 0.08, t) * smoothstep(0.5, 0.42, t);
        vec3 col = vec3(0.35, 0.75, 1.0);
        gl_FragColor = vec4(col * dash * uOpacity, 1.0);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), []);

  useEffect(() => {
    loadGeoJSON().then((data) => {
      borderDataRef.current = buildPerCountryBorders(data);
      setLoaded(true);
    }).catch(console.error);
    return () => {
      borderDataRef.current.forEach((d) => d.geometry.dispose());
      borderDataRef.current.clear();
    };
  }, []);

  useFrame(({ clock }) => {
    const line = lineRef.current;
    if (!line) return;

    const hovIso = _hoveredIso3;
    const target = hovIso ? 1 : 0;
    fadeRef.current += (target - fadeRef.current) * 0.15;
    if (fadeRef.current < 0.005) fadeRef.current = 0;
    if (fadeRef.current > 0.995) fadeRef.current = 1;

    if (hovIso !== prevIso.current) {
      prevIso.current = hovIso;
      if (hovIso) {
        const data = borderDataRef.current.get(hovIso);
        if (data) {
          line.geometry = data.geometry;
          line.visible = true;
          shaderMat.uniforms.uTotalLength.value = data.totalLength;
          fadeRef.current = 0.1;
        } else {
          line.visible = false;
        }
      }
    }

    if (!hovIso && fadeRef.current < 0.01) {
      line.visible = false;
    }

    shaderMat.uniforms.uTime.value = clock.getElapsedTime();
    shaderMat.uniforms.uOpacity.value = fadeRef.current;
  });

  if (!loaded) return null;

  return (
    <lineSegments ref={lineRef} visible={false} material={shaderMat} renderOrder={2}>
      <bufferGeometry />
    </lineSegments>
  );
}

// ─── R3F: 국가 폴리곤 렌더러 ───

function CountryPolygons({ countries }: { countries: CountryGeo[] }) {
  return (
    <group>
      {countries.length > 0 && (
        <>
          <CountryHoverHighlight countries={countries} />
          <CountryLabels countries={countries} />
        </>
      )}
    </group>
  );
}

// ─── R3F: 국가 라벨 (빌보드 + 오클루전 + 호버 확대 애니메이션) ───

// 라벨 호버 색상 (모듈 레벨 — GC 방지)
const _labelBaseCol = new THREE.Color('#E8E0D4');
const _labelHoverCol = new THREE.Color('#4DA6D9'); // 전술 사이안
const HOVER_SCALE_MUL = 1.6; // 호버 시 기본 스케일 대비 확대 배율

// 화면 중앙 기반 라벨 페이드 상수
const LABEL_SCREEN_FULL = 0.3;  // NDC 거리 0~0.3: 100% 스케일/투명도
const LABEL_SCREEN_HIDE = 1.1;  // NDC 거리 1.1+: 완전 투명 (화면 밖 근처)
const LABEL_CAM_HIDE = 450;     // 카메라 거리 450+ → 모든 라벨 숨김
const LABEL_CAM_FADE = 320;     // 카메라 거리 320부터 페이드 시작

// 스크린 프로젝션용 임시 벡터 (모듈 레벨 — GC 방지)
const _proj = new THREE.Vector3();

function CountryLabels({ countries }: { countries: CountryGeo[] }) {
  const { camera } = useThree();
  const refs = useRef<(THREE.Group | null)[]>([]);
  // 라벨별 호버 진행도 (0=기본, 1=호버 완료) — 부드러운 전환용
  const hoverProgress = useRef<Float32Array>(new Float32Array(0));

  // 랜드마크 꼭대기 높이에 맞춘 라벨 위치 계산 (v20)
  const LANDMARK_SURFACE_ALT = 2.5;
  const LABEL_NAME_GAP = 1.0;   // 국가 이름: 건물 꼭대기 바로 위 (국기 라벨보다 아래)
  const labelPositions = useMemo(() => {
    return countries.map((c) => {
      const archetype = getArchetypeForISO3(c.iso3);
      const landmarkH = getArchetypeHeight(archetype);
      const labelR = RADIUS + LANDMARK_SURFACE_ALT + landmarkH + LABEL_NAME_GAP;
      const dir = c.centroid.clone().normalize();
      return dir.multiplyScalar(labelR);
    });
  }, [countries]);

  // 각 라벨의 법선 벡터 — 1회만 계산
  const normals = useMemo(
    () => countries.map((c) => c.centroid.clone().normalize()),
    [countries],
  );

  const _cam = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    // 라벨 수 변경 시 배열 재할당
    if (hoverProgress.current.length !== countries.length) {
      hoverProgress.current = new Float32Array(countries.length);
    }

    const camDist = camera.position.length();

    // ── 줌 아웃 시 전체 페이드 (320~450 구간) ──
    const zoomFade = 1 - THREE.MathUtils.clamp(
      (camDist - LABEL_CAM_FADE) / (LABEL_CAM_HIDE - LABEL_CAM_FADE), 0, 1,
    );
    if (zoomFade <= 0) {
      refs.current.forEach((g) => { if (g) g.visible = false; });
      return;
    }

    // 거리 기반 기본 스케일: 가까울수록 크게 (150→1.1x, 500→0.8x)
    const t = THREE.MathUtils.clamp((camDist - 150) / 350, 0, 1);
    const baseScale = THREE.MathUtils.lerp(1.1, 0.8, t);

    const hovIso = _hoveredIso3;
    _cam.copy(camera.position).normalize();
    refs.current.forEach((g, i) => {
      if (!g) return;
      const dot = normals[i].dot(_cam);

      // 뒷면 오클루전: dot < 0.05 → 숨김
      g.visible = dot > 0.05;
      if (!g.visible) return;

      g.quaternion.copy(camera.quaternion);

      // ── 화면 중앙 기반 페이드: NDC 좌표로 투영 후 중앙 거리 계산 ──
      _proj.copy(labelPositions[i]).project(camera);
      const screenDist = Math.sqrt(_proj.x * _proj.x + _proj.y * _proj.y);
      const raw = 1 - THREE.MathUtils.clamp(
        (screenDist - LABEL_SCREEN_FULL) / (LABEL_SCREEN_HIDE - LABEL_SCREEN_FULL), 0, 1,
      );
      const centerFade = raw * raw * (3 - 2 * raw); // smoothstep

      // 호버 진행도 lerp (0→1: 확대, 1→0: 복귀)
      const isHovered = hovIso === countries[i].iso3;
      const target = isHovered ? 1 : 0;
      hoverProgress.current[i] += (target - hoverProgress.current[i]) * 0.12;
      if (hoverProgress.current[i] < 0.01) hoverProgress.current[i] = 0;
      if (hoverProgress.current[i] > 0.99) hoverProgress.current[i] = 1;

      const p = hoverProgress.current[i];

      // 스케일 = baseScale × centerFade(0.5~1.0) × hoverMul
      const scaleFade = 0.5 + 0.5 * centerFade; // 가장자리: 50%, 중앙: 100%
      const hoverMul = 1 + (HOVER_SCALE_MUL - 1) * p;
      g.scale.setScalar(baseScale * scaleFade * hoverMul);

      // troika Text: fillOpacity로 투명도 제어 (material.opacity는 무시됨)
      const textMesh = g.children[0] as any;
      if (textMesh) {
        const alpha = Math.max(centerFade * zoomFade, p);
        textMesh.fillOpacity = alpha;
        textMesh.outlineOpacity = alpha;
        // 색상 전환: troika DerivedMaterial의 color uniform
        if (textMesh.material?.color) {
          textMesh.material.color.lerpColors(_labelBaseCol, _labelHoverCol, p);
        }
      }
    });
  });

  return (
    <>
      {countries.map((c, i) => (
        <group
          key={c.iso3}
          position={labelPositions[i]}
          ref={(el) => { refs.current[i] = el; }}
        >
          <Text
            fontSize={1.5}
            color="#E8E0D4"
            anchorX="center"
            anchorY="top"
            outlineWidth={0.1}
            outlineColor="#111111"
            letterSpacing={0.06}
            fontWeight={700}
          >
            {c.name.toUpperCase()}
          </Text>
        </group>
      ))}
    </>
  );
}

// ─── R3F: SizeGate (Canvas 리사이즈 대기) ───

function SizeGate({ children }: { children: React.ReactNode }) {
  const { size } = useThree();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!ready && size.width > 100 && size.height > 100) setReady(true);
  }, [size, ready]);
  return ready ? <>{children}</> : null;
}

// ─── R3F: 줌 레벨 적응형 OrbitControls ───
// 확대 시 rotateSpeed를 낮추고 damping을 높여 자연스러운 회전 제공

const MIN_DIST = 150;
const MAX_DIST = 500;
const ROTATE_SPEED_CLOSE = 0.2;   // 최대 확대 시 (느린 정밀 회전)
const ROTATE_SPEED_FAR = 0.8;     // 최대 축소 시 (빠른 전체 회전)
const DAMPING_CLOSE = 0.08;       // 확대 시 부드러운 감속
const DAMPING_FAR = 0.05;         // 축소 시 표준 감속

function AdaptiveOrbitControls() {
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();

  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const dist = camera.position.length();
    // 0(최근접) → 1(최원거리) 정규화
    const t = THREE.MathUtils.clamp((dist - MIN_DIST) / (MAX_DIST - MIN_DIST), 0, 1);
    // easeOutQuad 커브: 확대 시 속도 감소가 더 급격하게 느껴지도록
    const ease = 1 - (1 - t) * (1 - t);

    controls.rotateSpeed = THREE.MathUtils.lerp(ROTATE_SPEED_CLOSE, ROTATE_SPEED_FAR, ease);
    controls.dampingFactor = THREE.MathUtils.lerp(DAMPING_CLOSE, DAMPING_FAR, ease);
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enablePan={false}
      enableZoom
      minDistance={MIN_DIST}
      maxDistance={MAX_DIST}
      enableDamping
      dampingFactor={DAMPING_FAR}
      rotateSpeed={ROTATE_SPEED_FAR}
      zoomSpeed={0.8}
    />
  );
}

// ─── 3D 타이틀: "AI WORLD WAR" 글로브 위 이미지 텍스처 (Last of Us 스타일) ───
// Bloom 제외: 커스텀 ShaderMaterial로 bloom luminance pass에서 어둡게 출력
// (onBeforeCompile로 MeshBasicMaterial의 fragment에 gl_FragColor.rgb 클램핑)

/**
 * Bloom-proof MeshBasicMaterial.
 * fragment shader를 패치하여 출력 luminance를 bloom threshold 미만으로 클램핑.
 * 화면에는 정상적으로 보이지만 bloom의 luminance threshold(0.4)를 넘지 않음.
 */
function useNoBloomMaterial(texture: THREE.Texture) {
  return useMemo(() => {
    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    // fragment shader 패치: bloom luminance가 threshold 미만이 되도록 밝기 제한
    mat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <opaque_fragment>',
        `
        // bloom 제외: 최종 색상의 luminance를 0.38 이하로 클램핑
        // (luminanceThreshold=0.4 미만 → bloom에 기여하지 않음)
        float lum = dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722));
        if (lum > 0.38) {
          outgoingLight *= 0.38 / lum;
        }
        #include <opaque_fragment>
        `
      );
    };
    return mat;
  }, [texture]);
}

function GlobeTitle() {
  const groupRef = useRef<THREE.Group>(null!);
  const { camera } = useThree();
  const texture = useTexture('/assets/generated/title-3d.png');
  const material = useNoBloomMaterial(texture);

  useFrame((state) => {
    if (!groupRef.current) return;
    // 빌보드: 항상 카메라를 향함
    groupRef.current.quaternion.copy(camera.quaternion);
    // 부유 애니메이션: 부드러운 상하 흔들림
    groupRef.current.position.y = 138 + Math.sin(state.clock.elapsedTime * 0.5) * 1.5;
  });

  // 텍스처 비율에 맞춰 plane 크기 설정
  const aspect = texture.image ? texture.image.width / texture.image.height : 4;
  const planeHeight = 9;
  const planeWidth = planeHeight * aspect;

  return (
    <group ref={groupRef} position={[0, 138, 0]}>
      <mesh>
        <planeGeometry args={[planeWidth, planeHeight]} />
        <primitive object={material} attach="material" />
      </mesh>
    </group>
  );
}

// ─── R3F: GeoJSON 데이터 로더 + 씬 구성 (Canvas 내부) ───
// Country geometries와 centroids를 로드하여 하위 컴포넌트에 전달

function GlobeScene({
  onCountryClick,
  onHover,
  dominationStates,
  wars,
  countryStates,
  tradeRoutes,
  globalEvents,
  introActive,
  onIntroComplete,
  activeConflictCountries,
  alliances,
  sanctions,
  resources,
  spyOps,
  nukes,
}: {
  onCountryClick?: (iso3: string, name: string) => void;
  onHover?: (iso3: string | null, name: string | null) => void;
  dominationStates: Map<string, CountryDominationState>;
  wars: WarEffectData[];
  countryStates: Map<string, CountryClientState>;
  activeConflictCountries: Set<string>;
  tradeRoutes: TradeRouteData[];
  globalEvents: GlobalEventData[];
  introActive?: boolean;
  onIntroComplete?: () => void;
  alliances: AllianceData[];
  sanctions: SanctionData[];
  resources: ResourceData[];
  spyOps: SpyOpData[];
  nukes: NukeData[];
}) {
  const [countries, setCountries] = useState<CountryGeo[]>([]);
  const [flagAtlas, setFlagAtlas] = useState<FlagAtlasResult | null>(null);

  // v17: Globe group ref for intro tilt animation
  const globeGroupRef = useRef<THREE.Group>(null);

  // v15 Phase 4: Shockwave ref for missile impact callback
  const shockwaveRef = useRef<GlobeShockwaveHandle>(null);

  // v24 Phase 2: Unified camera controller refs
  const cameraTargetRef = useRef<THREE.Vector3 | null>(null);
  const cameraPriorityRef = useRef<number>(1);

  // v24: Camera target callback (shared by GlobeWarEffects + GlobeEventPulse)
  // priority 기본값: war=4 (GlobeWarEffects 호출 시)
  const handleCameraTarget = useCallback((position: THREE.Vector3, priority?: number) => {
    cameraTargetRef.current = position.clone();
    cameraPriorityRef.current = priority ?? CAMERA_PRIORITY.war;
  }, []);

  // v15 Phase 6: Mobile LOD detection
  const lodConfig = useGlobeLOD();

  // v24 Phase 6: Camera distance LOD (3-tier: close/mid/far)
  const distanceLOD = useGlobeLODDistance();

  // v24 Phase 6: Reduced motion accessibility
  const reducedMotion = useReducedMotion();

  // v21 Phase 4: 모바일 디바이스 감지 (Bloom 비활성화용)
  const isMobile = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768 || navigator.maxTouchPoints > 0;
  }, []);

  // GeoJSON → CountryGeo[] 로드 (1회)
  useEffect(() => {
    loadGeoJSON()
      .then((data) => setCountries(buildCountryGeometries(data)))
      .catch(console.error);

    return () => {
      setCountries((prev) => {
        prev.forEach((c) => c.geometry.dispose());
        return [];
      });
    };
  }, []);

  // v15: Flag atlas 로드 (1회)
  useEffect(() => {
    const iso2List = COUNTRIES.map((c) => c.iso2);
    loadFlagAtlas(iso2List).then(setFlagAtlas).catch(console.error);
  }, []);

  // iso3 → BufferGeometry 맵 (GlobeDominationLayer용)
  const countryGeoMap = useMemo(() => {
    const map = new Map<string, THREE.BufferGeometry>();
    for (const c of countries) map.set(c.iso3, c.geometry);
    return map;
  }, [countries]);

  // iso3 → [lat, lng] centroid 맵 (GlobeWarEffects용)
  // computeCentroid()은 [lon, lat] (GeoJSON 컨벤션)을 반환하므로 [lat, lng]로 스왑
  const centroidsMap = useMemo(() => {
    const map = new Map<string, [number, number]>();
    for (const c of countries) {
      // centroid는 3D Vector3 → 역변환하여 [lat, lng] 추출
      const [lon, lat] = xyzToGeo(c.centroid, LABEL_R);
      map.set(c.iso3, [lat, lon]);
    }
    return map;
  }, [countries]);

  // v15 Phase 4: Missile impact handler → triggers shockwave
  const handleMissileImpact = useCallback((position: THREE.Vector3) => {
    shockwaveRef.current?.trigger(position);
  }, []);

  return (
    <>
      {/* v17: 인트로 카메라 시네마틱 (활성화 시 OrbitControls보다 먼저 실행) */}
      {introActive && (
        <GlobeIntroCamera
          active={introActive}
          onComplete={onIntroComplete}
          globeGroupRef={globeGroupRef}
        />
      )}

      {/* 우주: 최소 ambient + 반구 필 + 실시간 태양 + 별 */}
      <ambientLight intensity={0.12} color="#1a2a4a" />
      <hemisphereLight args={['#334466', '#0a0e18', 0.25]} />
      <SunLight />
      <Starfield />
      {/* v17: 지구본 그룹 (인트로 기울기 애니메이션용) */}
      <group ref={globeGroupRef}>
        {/* 지구 텍스처 구체 + 대기 글로우 */}
        <EarthSphere />
        <EarthClouds />
        <AtmosphereGlow />
        {/* 글로브 위 3D 타이틀 */}
        <GlobeTitle />
        {/* 국가 경계선 + 라벨 + 인터랙션 */}
        <CountryBorders />
        <CountryPolygons countries={countries} />
        <HoverBorderGlow />
        <GlobeInteraction onCountryClick={onCountryClick} onHover={onHover} />
      </group>
      {/* v17: 인트로 중에는 OrbitControls 비활성화 */}
      {!introActive && <AdaptiveOrbitControls />}

      {/* v24 Phase 2: Unified camera controller (focus + shake + priority queue) */}
      <CameraController
        targetRef={cameraTargetRef}
        priorityRef={cameraPriorityRef}
        introActive={!!introActive}
        globeRadius={RADIUS}
      />

      {/* v14: Domination color overlay (국가별 지배 색상) */}
      {dominationStates.size > 0 && (
        <GlobeDominationLayer
          dominationStates={dominationStates}
          countryGeometries={countryGeoMap}
          globeRadius={RADIUS}
        />
      )}

      {/* v14+v15: War visual effects (아크라인, 영토 점멸, 폭발 파티클, 안개, 카메라 진동) */}
      {wars.length > 0 && (
        <GlobeWarEffects
          wars={wars}
          countryCentroids={centroidsMap}
          globeRadius={RADIUS}
          onCameraTarget={handleCameraTarget}
          enableWarFog={lodConfig.enableWarFog}
        />
      )}

      {/* v15 Phase 4: Missile trajectories (attacker→defender parabolic arcs) */}
      {wars.length > 0 && centroidsMap.size > 0 && (
        <GlobeMissileEffect
          wars={wars}
          countryCentroids={centroidsMap}
          globeRadius={RADIUS}
          onImpact={handleMissileImpact}
          maxMissiles={lodConfig.maxMissiles}
        />
      )}

      {/* v15 Phase 4: Shockwave rings at missile impact points */}
      {lodConfig.enableShockwave && (
        <GlobeShockwave ref={shockwaveRef} globeRadius={RADIUS} />
      )}

      {/* v15: Country flag + agent count labels (국기 표시의 유일한 책임) */}
      {/* 모바일: maxLabels 30 (lodConfig에서 제어, GlobeCountryLabels 내부 LOD도 동작) */}
      {flagAtlas && centroidsMap.size > 0 && (
        <GlobeCountryLabels
          countryCentroids={centroidsMap}
          countryStates={countryStates}
          dominationStates={dominationStates}
          flagAtlas={flagAtlas}
          globeRadius={RADIUS}
          maxLabels={lodConfig.maxLabels}
        />
      )}

      {/* v20: 195국 랜드마크 3D 메시 (countryCentroids 기반 동적 생성) */}
      {centroidsMap.size > 0 && (
        <GlobeLandmarks
          countryCentroids={centroidsMap}
          globeRadius={RADIUS}
          maxLandmarks={lodConfig.maxLandmarks}
          landmarkDetail={lodConfig.landmarkDetail}
        />
      )}

      {/* v17: Conflict indicators */}
      {centroidsMap.size > 0 && activeConflictCountries.size > 0 && (
        <Suspense fallback={null}>
          <GlobeConflictIndicators
            countryCentroids={centroidsMap}
            activeConflictCountries={activeConflictCountries}
            globeRadius={RADIUS}
          />
        </Suspense>
      )}

      {/* v15 Phase 5: Trade route bezier lines */}
      {lodConfig.enableTradeRoutes && tradeRoutes.length > 0 && centroidsMap.size > 0 && (
        <GlobeTradeRoutes
          tradeRoutes={tradeRoutes}
          countryCentroids={centroidsMap}
          globeRadius={RADIUS}
          onCameraTarget={handleCameraTarget}
        />
      )}

      {/* v15 Phase 5: Global event pulse effects */}
      {lodConfig.enableEventPulse && globalEvents.length > 0 && centroidsMap.size > 0 && (
        <GlobeEventPulse
          globalEvents={globalEvents}
          countryCentroids={centroidsMap}
          globeRadius={RADIUS}
          onCameraTarget={handleCameraTarget}
        />
      )}

      {/* v28: Globe event labels — 3D 뉴스 브리핑 라벨 + 아크 키워드 태그 */}
      {centroidsMap.size > 0 && (
        <GlobeEventLabels
          globalEvents={globalEvents}
          countryCentroids={centroidsMap}
          globeRadius={RADIUS}
          wars={wars}
          tradeRoutes={tradeRoutes}
          alliances={alliances}
          sanctions={sanctions}
          spyOps={spyOps}
        />
      )}

      {/* v23 Phase 5: 동맹 빛줄기 (Line-based, TubeGeometry 제거 → 검은박스 해결) */}
      {lodConfig.enableAllianceBeam && alliances.length > 0 && centroidsMap.size > 0 && (
        <GlobeAllianceBeam
          alliances={alliances}
          centroidsMap={centroidsMap}
          globeRadius={RADIUS}
        />
      )}

      {/* v23 Phase 5: 제재 차단선 (v24 Phase 6: InstancedMesh + LOD + reduced motion) */}
      {lodConfig.enableSanctionBarrier && sanctions.length > 0 && centroidsMap.size > 0 && (
        <GlobeSanctionBarrier
          sanctions={sanctions}
          centroidsMap={centroidsMap}
          globeRadius={RADIUS}
          distanceLOD={distanceLOD}
          reducedMotion={reducedMotion}
        />
      )}

      {/* v23 Phase 5: 자원 채굴 지표 이펙트 (v24 Phase 6: material pool + LOD + reduced motion) */}
      {lodConfig.enableResourceGlow && resources.length > 0 && centroidsMap.size > 0 && (
        <GlobeResourceGlow
          resources={resources}
          centroidsMap={centroidsMap}
          globeRadius={RADIUS}
          distanceLOD={distanceLOD}
          reducedMotion={reducedMotion}
        />
      )}

      {/* v23 Phase 5: 첩보 점선 트레일 (v24 Phase 6: shared material + LOD + reduced motion) */}
      {lodConfig.enableSpyTrail && spyOps.length > 0 && centroidsMap.size > 0 && (
        <GlobeSpyTrail
          spyOps={spyOps}
          centroidsMap={centroidsMap}
          globeRadius={RADIUS}
          distanceLOD={distanceLOD}
          reducedMotion={reducedMotion}
        />
      )}

      {/* v23 Phase 5: 핵실험 버섯구름 */}
      {lodConfig.enableNukeEffect && nukes.length > 0 && centroidsMap.size > 0 && (
        <GlobeNukeEffect
          nukes={nukes}
          centroidsMap={centroidsMap}
          globeRadius={RADIUS}
          onCameraTarget={handleCameraTarget}
        />
      )}

      {/* v21 Phase 4: Bloom 포스트프로세싱 — GlobeTitle은 shader 클램핑으로 bloom 제외 */}
      {!isMobile && (
        <EffectComposer>
          <Bloom
            luminanceThreshold={0.4}
            luminanceSmoothing={0.15}
            intensity={1.2}
            radius={0.75}
            mipmapBlur
          />
        </EffectComposer>
      )}
    </>
  );
}

// ─── 메인 컴포넌트 ───

export function GlobeView({
  countryStates,
  onCountryClick,
  style,
  dominationStates,
  wars,
  countryCentroids,
  onHover,
  tradeRoutes,
  globalEvents,
  introActive,
  onIntroComplete,
  activeConflictCountries,
  alliances,
  sanctions,
  resources,
  spyOps,
  nukes,
  onReady,
}: GlobeViewProps) {
  // v14: fallback empty maps/arrays for domination and war effects
  const domStates = dominationStates ?? new Map<string, CountryDominationState>();
  const warList = wars ?? [];
  const cStates = countryStates ?? new Map<string, CountryClientState>();
  // v15 Phase 5: fallback empty arrays
  const tradeList = tradeRoutes ?? [];
  const eventList = globalEvents ?? [];
  const conflictSet = activeConflictCountries ?? new Set<string>();
  // v23 Phase 5: fallback empty arrays
  const allianceList = alliances ?? [];
  const sanctionList = sanctions ?? [];
  const resourceList = resources ?? [];
  const spyOpList = spyOps ?? [];
  const nukeList = nukes ?? [];

  // v17: 인트로 시 카메라 시작 위치 (멀리서 로고 정면)
  const cameraStartPos: [number, number, number] = introActive
    ? [0, 120, 480]    // 멀리서 로고(y=138) 정면 바라봄
    : [0, 0, 300];     // 기본 위치

  return (
    <div style={{ width: '100%', height: '100%', background: BG, position: 'relative', ...style }}>
      <Canvas
        camera={{ position: cameraStartPos, fov: 50, near: 1, far: 1000 }}
        gl={{ antialias: true, alpha: false, toneMappingExposure: 1.0 }}
        dpr={[1, 2]}
        onCreated={({ gl }) => { gl.setClearColor(BG); onReady?.(); }}
      >
        <SizeGate>
          <GlobeScene
            onCountryClick={onCountryClick}
            onHover={onHover}
            dominationStates={domStates}
            wars={warList}
            countryStates={cStates}
            tradeRoutes={tradeList}
            globalEvents={eventList}
            introActive={introActive}
            onIntroComplete={onIntroComplete}
            activeConflictCountries={conflictSet}
            alliances={allianceList}
            sanctions={sanctionList}
            resources={resourceList}
            spyOps={spyOpList}
            nukes={nukeList}
          />
        </SizeGate>
      </Canvas>
    </div>
  );
}
