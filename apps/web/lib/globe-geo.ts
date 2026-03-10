/**
 * Globe geometry utilities — GeoJSON processing, triangulation, border/country geometry builders.
 * Extracted from GlobeView.tsx (Phase 0 modular refactor).
 */

import * as THREE from 'three';
import earcut from 'earcut';
import { getCountryISO } from '@/lib/map-style';
import { geoToXYZ } from '@/lib/globe-utils';

// ─── Constants ───

export const GLOBE_RADIUS = 100;
export const GLOBE_ALT = 0.15; // 구체 표면 밀착 (최소 z-fighting 방지 오프셋)
export const LABEL_R = GLOBE_RADIUS + GLOBE_ALT + 2; // 라벨 높이 (폴리곤 위)

/** 2deg 이상 변은 분할 -> 삼각형이 구면에 밀착 */
const MAX_DEG = 2;

/** 5deg 호에 해당하는 현 길이 (R=100.15 기준) */
export const MAX_EDGE_3D = 2 * (GLOBE_RADIUS + GLOBE_ALT) * Math.sin(5 * Math.PI / 360);

// ─── Types ───

export interface CountryGeo {
  iso3: string;
  name: string;
  geometry: THREE.BufferGeometry;
  centroid: THREE.Vector3;
}

export interface CountryBorderGeoData {
  geometry: THREE.BufferGeometry;
  totalLength: number;
}

// ─── Coordinate Helpers ───

/** 역변환: 구면 (x, y, z) -> (lon, lat) */
export function xyzToGeo(point: THREE.Vector3, _r: number): [number, number] {
  const r = point.length();
  const lat = 90 - Math.acos(Math.max(-1, Math.min(1, point.y / r))) * (180 / Math.PI);
  let lon = Math.atan2(point.z, -point.x) * (180 / Math.PI) - 180;
  if (lon < -180) lon += 360;
  if (lon > 180) lon -= 360;
  return [lon, lat];
}

/** 점-다각형 내부 판별 (Ray Casting) */
export function pointInRing(lon: number, lat: number, ring: number[][]): boolean {
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

export function findCountryAtPoint(
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

// ─── Subdivision & Triangulation ───

/** 변 세분화 (구면 곡률 보정) */
export function subdivideRing(ring: number[][]): number[][] {
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

/** 폴리곤 삼각분할 */
export function triangulatePolygon(
  rings: number[][][],
  radius: number,
): Float32Array | null {
  if (!rings || rings.length === 0 || rings[0].length < 3) return null;

  // 각 링의 변을 세분화 (큰 삼각형 -> 구면 처짐 방지)
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

  // 삼각 인덱스 -> 3D 구면 좌표
  const raw = new Float32Array(indices.length * 3);
  for (let i = 0; i < indices.length; i++) {
    const idx = indices[i];
    const lon = flat[idx * 2];
    const lat = flat[idx * 2 + 1];
    geoToXYZ(lon, lat, radius, raw, i * 3);
  }

  // 큰 삼각형 재분할 -> 구면 밀착
  return subdivideSphericalMesh(raw, radius, MAX_EDGE_3D);
}

/**
 * 삼각형 재분할 + 구면 재투영
 * earcut이 만든 큰 내부 삼각형을 쪼개서 구면 곡률에 밀착시킴
 */
export function subdivideSphericalMesh(
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
      // 가장 긴 변의 중점 -> 구면에 재투영
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

// ─── Area-Weighted Centroid ───

// GC 방지: 모듈 스코프 temp 변수
let _triArea = 0;
let _cx = 0;
let _cy = 0;

/** 단일 링(외곽)의 면적 가중 centroid 반환 [lon, lat, signedArea] */
export function ringAreaCentroid(ring: number[][]): [number, number, number] {
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

export function computeCentroid(polygons: number[][][][]): [number, number] {
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

// ─── Geometry Builders ───

/** GeoJSON -> CountryGeo[] (국가별 BufferGeometry + centroid) */
export function buildCountryGeometries(geoData: { features: any[] }): CountryGeo[] {
  const result: CountryGeo[] = [];

  for (const feature of geoData.features) {
    const geom = feature.geometry;
    if (!geom) continue;

    const props = feature.properties || {};
    const iso3 = getCountryISO(props);
    if (!iso3) continue;

    const name = (props.NAME || props.ADMIN || iso3) as string;
    const { type, coordinates } = geom;

    // Polygon / MultiPolygon -> 통일된 배열
    const polygons: number[][][][] =
      type === 'Polygon' ? [coordinates] :
      type === 'MultiPolygon' ? coordinates : [];

    if (polygons.length === 0) continue;

    // 각 파트 삼각분할 후 병합
    const parts: Float32Array[] = [];
    for (const rings of polygons) {
      const verts = triangulatePolygon(rings, GLOBE_RADIUS + GLOBE_ALT);
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

    // 중심점 -> 3D 좌표
    const [cLon, cLat] = computeCentroid(polygons);
    const tmp = new Float32Array(3);
    geoToXYZ(cLon, cLat, LABEL_R, tmp, 0);
    const centroid = new THREE.Vector3(tmp[0], tmp[1], tmp[2]);

    result.push({ iso3, name, geometry: geo, centroid });
  }

  return result;
}

/** 국가 경계선 세그먼트 좌표 배열 생성 */
export function buildBorderPositions(geoData: { features: any[] }): Float32Array {
  const segs: number[] = [];
  const borderR = GLOBE_RADIUS + 0.15; // 지구 표면에 밀착 (z-fighting 방지 최소 오프셋)
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

/** 국가별 개별 경계선 데이터 (호버 글로우용) */
export function buildPerCountryBorders(geoData: { features: any[] }): Map<string, CountryBorderGeoData> {
  const map = new Map<string, CountryBorderGeoData>();
  const borderR = GLOBE_RADIUS + GLOBE_ALT + 0.05;
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
