/**
 * country-silhouettes.ts — 실제 행정구역(admin1) 기반 국가 지도 + Voronoi fallback
 *
 * 1차: /data/admin1/{ISO3}.topo.json (Natural Earth admin1 기반, 빌드 타임 생성)
 * 2차: /data/countries.geojson + Voronoi subdivision (기존 fallback)
 */

import { loadGeoJSON, type GeoJSONData, type GeoJSONFeature } from './globe-data';
import { getCountryISO } from './map-style';
import { decodeTopoJSON, type ITopoJSON, type IDecodedRegion } from './topo-decode';

// ─── 타입 ───

export interface CountryOutline {
  /** SVG viewBox 내 국가 윤곽 폴리곤 (외곽선용) */
  outlinePolygons: [number, number][][];
  /** Voronoi 셀 폴리곤 (지역 수만큼) */
  cells: [number, number][][];
  /** 각 셀의 centroid */
  centroids: [number, number][];
  /** viewBox 크기 */
  width: number;
  height: number;
}

// ─── 지역 시드 좌표 (주요 국가 — 실제 위도/경도) ───

/** 주요 국가의 지역별 실제 좌표 [lon, lat] */
const REGION_SEEDS_LONLAT: Record<string, Record<string, [number, number]>> = {
  KOR: {
    seoul: [127.0, 37.55], gyeonggi: [127.1, 37.3],
    busan: [129.05, 35.18], jeju: [126.55, 33.35], dmz: [127.0, 38.0],
  },
  USA: {
    ny: [-74.0, 40.7], la: [-118.2, 34.0], chicago: [-87.6, 41.9],
    texas: [-97.7, 31.0], dc: [-77.0, 38.9], florida: [-81.5, 27.6],
    alaska: [-149.9, 64.2], hawaii: [-155.5, 19.9],
  },
  CHN: {
    beijing: [116.4, 39.9], shanghai: [121.5, 31.2], guangdong: [113.3, 23.1],
    sichuan: [104.1, 30.6], xinjiang: [87.6, 43.8], dongbei: [126.6, 45.7],
    yunnan: [102.7, 25.0], inner_mongolia: [111.7, 40.8],
  },
  JPN: {
    tokyo: [139.7, 35.7], osaka: [135.5, 34.7], hokkaido: [143.2, 43.0],
    kyushu: [131.0, 33.0], tohoku: [140.3, 39.7], chubu: [137.0, 36.0],
    okinawa: [127.7, 26.3], chugoku: [132.5, 34.4],
  },
  DEU: {
    berlin: [13.4, 52.5], munich: [11.6, 48.1], hamburg: [10.0, 53.5],
    frankfurt: [8.7, 50.1], cologne: [6.9, 50.9], dresden: [13.7, 51.0],
    stuttgart: [9.2, 48.8],
  },
  GBR: {
    london: [-0.1, 51.5], manchester: [-2.2, 53.5], scotland: [-3.2, 56.5],
    wales: [-3.5, 52.0], birmingham: [-1.9, 52.5], newcastle: [-1.6, 55.0],
    cornwall: [-5.0, 50.3],
  },
  FRA: {
    paris: [2.35, 48.85], lyon: [4.83, 45.75], marseille: [5.37, 43.3],
    bordeaux: [-0.57, 44.84], strasbourg: [7.75, 48.58], nantes: [-1.55, 47.22],
    toulouse: [1.44, 43.6],
  },
  RUS: {
    moscow: [37.6, 55.75], spb: [30.3, 59.9], siberia: [82.9, 55.0],
    ural: [60.6, 56.8], far_east: [135.1, 48.5], caucasus: [44.0, 43.4],
    volga: [49.1, 53.2], arctic: [70.0, 68.0],
  },
  IND: {
    delhi: [77.2, 28.6], mumbai: [72.9, 19.1], bengaluru: [77.6, 13.0],
    kolkata: [88.4, 22.6], chennai: [80.3, 13.1], hyderabad: [78.5, 17.4],
    kashmir: [74.8, 34.1], rajasthan: [73.0, 27.0],
  },
  BRA: {
    sao_paulo: [-46.6, -23.5], rio: [-43.2, -22.9], brasilia: [-47.9, -15.8],
    amazon: [-60.0, -3.0], bahia: [-38.5, -13.0],
  },
  ITA: {
    rome: [12.5, 41.9], milan: [9.2, 45.5], naples: [14.3, 40.8],
    sicily: [14.0, 37.5], venice: [12.3, 45.4],
  },
  TUR: {
    istanbul: [29.0, 41.0], ankara: [32.9, 39.9], antalya: [30.7, 36.9],
    izmir: [27.1, 38.4], eastern: [43.0, 39.0],
  },
  AUS: {
    sydney: [151.2, -33.9], melbourne: [144.96, -37.8], brisbane: [153.0, -27.5],
    perth: [115.9, -31.95], adelaide: [138.6, -34.9],
  },
  CAN: {
    ontario: [-80.0, 44.0], quebec: [-71.2, 46.8], bc: [-123.1, 49.3],
    alberta: [-114.1, 51.0], prairies: [-104.6, 50.4],
  },
  SAU: {
    riyadh: [46.7, 24.7], jeddah: [39.2, 21.5], eastern: [49.0, 25.3],
    mecca: [39.8, 21.4], medina: [39.6, 24.5],
  },
  MEX: {
    mexico_city: [-99.1, 19.4], guadalajara: [-103.3, 20.7],
    monterrey: [-100.3, 25.7], cancun: [-86.8, 21.2], tijuana: [-117.0, 32.5],
  },
  IDN: {
    java: [110.4, -7.6], sumatra: [101.4, 0.5], kalimantan: [116.0, -1.0],
    sulawesi: [121.4, -1.5], papua: [138.5, -4.0],
  },
  ESP: {
    madrid: [-3.7, 40.4], barcelona: [2.2, 41.4], seville: [-5.98, 37.4],
    valencia: [-0.38, 39.47], bilbao: [-2.93, 43.26],
  },
  NLD: {
    amsterdam: [4.9, 52.37], rotterdam: [4.47, 51.92], hague: [4.3, 52.07],
    utrecht: [5.12, 52.09], eindhoven: [5.47, 51.44],
  },
  POL: {
    warsaw: [21.0, 52.23], krakow: [19.94, 50.06], gdansk: [18.65, 54.35],
    wroclaw: [17.04, 51.1], poznan: [16.92, 52.41],
  },
};

// ─── Mercator 투영 ───

function mercatorProject(lon: number, lat: number): [number, number] {
  const x = lon;
  const y = -Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * (180 / Math.PI);
  return [x, y];
}

// ─── GeoJSON → SVG 좌표 변환 ───

function extractCountryPolygons(
  geojson: GeoJSONData,
  iso3: string,
): number[][][][] {
  for (const feature of geojson.features) {
    const props = feature.properties || {};
    const featureIso = getCountryISO(props);
    if (featureIso !== iso3) continue;

    const { type, coordinates } = feature.geometry;
    if (type === 'Polygon') return [coordinates as number[][][]];
    if (type === 'MultiPolygon') return coordinates as number[][][][];
  }
  return [];
}

/**
 * 폴리곤 면적 (Shoelace formula) — 면적이 큰 메인 폴리곤 선택용
 */
function polygonArea(pts: [number, number][]): number {
  let area = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    area += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1]);
  }
  return Math.abs(area / 2);
}

/**
 * GeoJSON 좌표를 SVG viewBox 좌표로 변환.
 * 모든 폴리곤을 Mercator 투영 후 viewBox에 fit.
 */
function projectToSVG(
  polygonSets: number[][][][],
  svgW: number,
  svgH: number,
  padding: number,
): {
  projected: [number, number][][];
  transform: (lon: number, lat: number) => [number, number];
} {
  // 모든 좌표를 Mercator 투영
  const allProjected: [number, number][][] = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const polygonSet of polygonSets) {
    const ring = polygonSet[0]; // 외곽링만 (hole 무시)
    const projected: [number, number][] = [];
    for (const coord of ring) {
      const [mx, my] = mercatorProject(coord[0], coord[1]);
      projected.push([mx, my]);
      if (mx < minX) minX = mx;
      if (my < minY) minY = my;
      if (mx > maxX) maxX = mx;
      if (my > maxY) maxY = my;
    }
    allProjected.push(projected);
  }

  // viewBox에 맞게 스케일링
  const geoW = maxX - minX || 1;
  const geoH = maxY - minY || 1;
  const usableW = svgW - padding * 2;
  const usableH = svgH - padding * 2;
  const scale = Math.min(usableW / geoW, usableH / geoH);
  const offsetX = padding + (usableW - geoW * scale) / 2;
  const offsetY = padding + (usableH - geoH * scale) / 2;

  const scaled: [number, number][][] = allProjected.map(ring =>
    ring.map(([x, y]) => [
      (x - minX) * scale + offsetX,
      (y - minY) * scale + offsetY,
    ]),
  );

  // lon/lat → SVG 좌표 변환 함수
  const transform = (lon: number, lat: number): [number, number] => {
    const [mx, my] = mercatorProject(lon, lat);
    return [
      (mx - minX) * scale + offsetX,
      (my - minY) * scale + offsetY,
    ];
  };

  return { projected: scaled, transform };
}

// ─── Voronoi 셀 계산 ───

/**
 * Sutherland-Hodgman: 폴리곤을 무한 직선(lx1,ly1→lx2,ly2)의 왼쪽(cSide>=0)으로 클리핑.
 * 클리핑 line은 무한 직선으로 취급 — 교차 계산 시 폴리곤 edge만 segment 제한.
 */
function clipPolygonByLine(
  polygon: [number, number][],
  lx1: number, ly1: number,
  lx2: number, ly2: number,
): [number, number][] {
  const out: [number, number][] = [];
  const n = polygon.length;
  if (n === 0) return out;

  for (let i = 0; i < n; i++) {
    const [cx, cy] = polygon[i];
    const [nx, ny] = polygon[(i + 1) % n];
    const cSide = (lx2 - lx1) * (cy - ly1) - (ly2 - ly1) * (cx - lx1);
    const nSide = (lx2 - lx1) * (ny - ly1) - (ly2 - ly1) * (nx - lx1);

    if (cSide >= 0) {
      out.push([cx, cy]);
      if (nSide < 0) {
        const inter = lineSegmentIntersect(cx, cy, nx, ny, lx1, ly1, lx2, ly2);
        if (inter) out.push(inter);
      }
    } else if (nSide >= 0) {
      const inter = lineSegmentIntersect(cx, cy, nx, ny, lx1, ly1, lx2, ly2);
      if (inter) out.push(inter);
    }
  }
  return out;
}

/**
 * 폴리곤 edge (segment: x1,y1→x2,y2)와 클리핑 line (무한 직선: x3,y3→x4,y4)의 교차점.
 * t는 [0,1]로 제한 (폴리곤 edge는 유한 선분),
 * u는 제한 없음 (클리핑 line은 무한 직선).
 */
function lineSegmentIntersect(
  x1: number, y1: number, x2: number, y2: number,
  x3: number, y3: number, x4: number, y4: number,
): [number, number] | null {
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 1e-10) return null;
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  // u 제한 제거 — clip line은 무한 직선
  if (t >= 0 && t <= 1) {
    return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)];
  }
  return null;
}

/**
 * 폴리곤의 signed area 계산 (SVG 좌표계: 양수 = CW, 음수 = CCW)
 */
function signedArea2D(pts: [number, number][]): number {
  let area = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    area += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1]);
  }
  return area / 2;
}

/**
 * 폴리곤을 CCW(반시계방향) 방향으로 보정.
 * clipPolygonByLine은 directed line의 왼쪽(cSide >= 0)을 유지.
 * CCW 경계의 각 edge에서 내부가 왼쪽에 위치하므로, CCW여야 올바르게 클리핑됨.
 */
function ensureCCW(pts: [number, number][]): [number, number][] {
  // signed area < 0 이면 CCW
  return signedArea2D(pts) > 0 ? [...pts].reverse() : pts;
}

function computeVoronoiCells(
  seeds: [number, number][],
  boundaryPolygon: [number, number][],
  svgW: number,
  svgH: number,
): [number, number][][] {
  const pad = 30;
  const boundingRect: [number, number][] = [
    [-pad, -pad], [svgW + pad, -pad], [svgW + pad, svgH + pad], [-pad, svgH + pad],
  ];

  // 경계 폴리곤을 CCW로 보정
  const boundary = ensureCCW(boundaryPolygon);

  const cells: [number, number][][] = [];

  for (let i = 0; i < seeds.length; i++) {
    // Step 1: 반평면 클리핑으로 볼록(convex) Voronoi 셀 생성
    let voronoiCell = [...boundingRect];

    for (let j = 0; j < seeds.length; j++) {
      if (i === j || voronoiCell.length < 3) continue;

      const [sx, sy] = seeds[i];
      const [ox, oy] = seeds[j];
      const mx = (sx + ox) / 2;
      const my = (sy + oy) / 2;
      const dx = ox - sx;
      const dy = oy - sy;
      voronoiCell = clipPolygonByLine(voronoiCell,
        mx + dy * 1000, my - dx * 1000,
        mx - dy * 1000, my + dx * 1000,
      );
    }

    if (voronoiCell.length < 3) {
      cells.push([]);
      continue;
    }

    // Step 2: 국가 경계(오목 가능)와 Voronoi 셀(볼록)의 교집합 계산
    // Sutherland-Hodgman: subject=경계(오목 OK), clip=Voronoi 셀(볼록 필수)
    // Voronoi 셀의 각 edge로 경계 폴리곤을 클리핑
    const vcCCW = ensureCCW(voronoiCell);
    let result: [number, number][] = [...boundary];
    for (let e = 0; e < vcCCW.length && result.length >= 3; e++) {
      const [ex1, ey1] = vcCCW[e];
      const [ex2, ey2] = vcCCW[(e + 1) % vcCCW.length];
      result = clipPolygonByLine(result, ex1, ey1, ex2, ey2);
    }

    cells.push(result);
  }

  return cells;
}

function polygonCentroid(polygon: [number, number][]): [number, number] {
  if (polygon.length === 0) return [0, 0];
  let cx = 0, cy = 0;
  for (const [x, y] of polygon) { cx += x; cy += y; }
  return [cx / polygon.length, cy / polygon.length];
}

// ─── Admin1 TopoJSON 로딩 ───

/** admin1 TopoJSON 캐시 */
const admin1Cache = new Map<string, IDecodedRegion[] | null>();

/**
 * admin1 TopoJSON 로드 시도.
 * /data/admin1/{ISO3}.topo.json 파일이 없으면 null 반환.
 */
async function loadAdmin1(iso3: string): Promise<IDecodedRegion[] | null> {
  if (admin1Cache.has(iso3)) return admin1Cache.get(iso3) ?? null;

  try {
    const res = await fetch(`/data/admin1/${iso3}.topo.json`);
    if (!res.ok) {
      admin1Cache.set(iso3, null);
      return null;
    }
    const topo: ITopoJSON = await res.json();
    const regions = decodeTopoJSON(topo);
    if (regions.length === 0) {
      admin1Cache.set(iso3, null);
      return null;
    }
    admin1Cache.set(iso3, regions);
    return regions;
  } catch {
    admin1Cache.set(iso3, null);
    return null;
  }
}

/**
 * admin1 데이터에서 CountryOutline 생성.
 * 각 region의 폴리곤을 Mercator 투영 → SVG 좌표로 변환.
 */
function buildFromAdmin1(regions: IDecodedRegion[]): CountryOutline {
  // 모든 region의 폴리곤을 수집하여 Mercator 투영 범위 계산
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  // 모든 좌표를 Mercator 투영
  const regionProjected: { rings: [number, number][][]; idx: number }[] = [];

  for (const region of regions) {
    const rings: [number, number][][] = [];
    for (const poly of region.polygons) {
      const projected: [number, number][] = [];
      for (const [lon, lat] of poly) {
        const [mx, my] = mercatorProject(lon, lat);
        projected.push([mx, my]);
        if (mx < minX) minX = mx;
        if (my < minY) minY = my;
        if (mx > maxX) maxX = mx;
        if (my > maxY) maxY = my;
      }
      rings.push(projected);
    }
    regionProjected.push({ rings, idx: region.regionIdx });
  }

  // SVG viewBox에 맞게 스케일링
  const geoW = maxX - minX || 1;
  const geoH = maxY - minY || 1;
  const usableW = SVG_SIZE - SVG_PAD * 2;
  const usableH = SVG_SIZE - SVG_PAD * 2;
  const scale = Math.min(usableW / geoW, usableH / geoH);
  const offsetX = SVG_PAD + (usableW - geoW * scale) / 2;
  const offsetY = SVG_PAD + (usableH - geoH * scale) / 2;

  const scaleCoord = ([x, y]: [number, number]): [number, number] => [
    (x - minX) * scale + offsetX,
    (y - minY) * scale + offsetY,
  ];

  // 각 region의 셀 폴리곤 (외곽링만 결합) + centroid 계산
  const cells: [number, number][][] = [];
  const centroids: [number, number][] = [];
  const outlineRings: [number, number][][] = [];

  for (const rp of regionProjected) {
    // 모든 ring을 SVG 좌표로 변환
    const scaledRings = rp.rings.map(ring => ring.map(scaleCoord));

    // 외곽링 = 면적이 가장 큰 ring (holes 제외)
    const outerRings = scaledRings.filter(ring => {
      // 양수 면적 = 외곽 (shoelace 기준)
      let area = 0;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        area += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
      }
      return Math.abs(area) > 10; // 최소 면적 필터
    });

    // 가장 큰 ring을 셀 대표로 사용 (MultiPolygon 대응)
    if (outerRings.length === 0) {
      cells.push([]);
      centroids.push([SVG_SIZE / 2, SVG_SIZE / 2]);
      continue;
    }

    // 모든 외곽 ring의 좌표를 합쳐서 하나의 셀로 사용
    // (SVG path는 M...Z M...Z 로 여러 ring 표현 가능)
    const allPoints: [number, number][] = [];
    let bestRing = outerRings[0];
    let bestArea = 0;

    for (const ring of outerRings) {
      outlineRings.push(ring);
      for (const pt of ring) allPoints.push(pt);
      const area = polygonArea(ring);
      if (area > bestArea) {
        bestArea = area;
        bestRing = ring;
      }
    }

    cells.push(bestRing);
    centroids.push(polygonCentroid(bestRing));
  }

  // 외곽선: 모든 ring을 포함
  return {
    outlinePolygons: outlineRings,
    cells,
    centroids,
    width: SVG_SIZE,
    height: SVG_SIZE,
  };
}

// ─── 메인 API ───

const SVG_SIZE = 400;
const SVG_PAD = 25;

/**
 * 국가 지도를 빌드한다.
 * 1차: admin1 TopoJSON (실제 행정구역)
 * 2차: GeoJSON + Voronoi (기존 fallback)
 */
export async function buildCountryOutline(
  iso3: string,
  regionCount: number,
  regionIds: string[],
): Promise<CountryOutline> {
  // 1차: admin1 TopoJSON 로드 시도
  const admin1Regions = await loadAdmin1(iso3);
  if (admin1Regions && admin1Regions.length > 0) {
    return buildFromAdmin1(admin1Regions);
  }

  // 2차: 기존 GeoJSON + Voronoi fallback
  return buildFromGeoJSON(iso3, regionCount, regionIds);
}

/**
 * 기존 GeoJSON + Voronoi 기반 fallback
 */
async function buildFromGeoJSON(
  iso3: string,
  regionCount: number,
  regionIds: string[],
): Promise<CountryOutline> {
  const geojson = await loadGeoJSON();
  const polygonSets = extractCountryPolygons(geojson, iso3);

  // 폴리곤 없으면 원형 fallback
  if (polygonSets.length === 0) {
    return buildCircleFallback(regionCount);
  }

  // 면적 상위 3개 폴리곤만 사용 (작은 섬 제외)
  const withArea = polygonSets.map((ps, i) => ({
    ps,
    area: polygonArea(ps[0].map(c => mercatorProject(c[0], c[1])) as [number, number][]),
    index: i,
  }));
  withArea.sort((a, b) => b.area - a.area);
  const mainPolygons = withArea.slice(0, 3).map(w => w.ps);

  // SVG 좌표로 투영
  const { projected, transform } = projectToSVG(mainPolygons, SVG_SIZE, SVG_SIZE, SVG_PAD);

  // 가장 큰 폴리곤을 Voronoi 경계로 사용
  const mainOutline = projected[0];
  if (!mainOutline || mainOutline.length < 3) {
    return buildCircleFallback(regionCount);
  }

  // seed 좌표 결정
  const seedDefs = REGION_SEEDS_LONLAT[iso3];
  const seeds: [number, number][] = [];

  for (let i = 0; i < regionCount; i++) {
    const regionId = regionIds[i] ?? '';
    const slug = regionId.split(/[-_]/).slice(1).join('_').toLowerCase();

    let placed = false;
    if (seedDefs) {
      // slug → seed 매핑 시도
      for (const [key, [lon, lat]] of Object.entries(seedDefs)) {
        if (slug.includes(key) || key.includes(slug.split('_')[0])) {
          seeds.push(transform(lon, lat));
          placed = true;
          break;
        }
      }
      // 매칭 실패 시 인덱스 순서로 할당
      if (!placed) {
        const entries = Object.entries(seedDefs);
        if (i < entries.length) {
          const [, [lon, lat]] = entries[i];
          seeds.push(transform(lon, lat));
          placed = true;
        }
      }
    }

    // seed 정의 없으면 국가 중심 주위로 자동 분배
    if (!placed) {
      const c = polygonCentroid(mainOutline);
      const angle = (2 * Math.PI * i) / regionCount - Math.PI / 2;
      const r = 50;
      seeds.push([c[0] + Math.cos(angle) * r, c[1] + Math.sin(angle) * r]);
    }
  }

  // Voronoi 셀 계산
  const cells = computeVoronoiCells(seeds, mainOutline, SVG_SIZE, SVG_SIZE);
  const centroids = cells.map(c => polygonCentroid(c));

  return {
    outlinePolygons: projected,
    cells,
    centroids,
    width: SVG_SIZE,
    height: SVG_SIZE,
  };
}

/**
 * 원형 fallback — GeoJSON에 국가 데이터가 없을 때
 */
function buildCircleFallback(regionCount: number): CountryOutline {
  const cx = SVG_SIZE / 2, cy = SVG_SIZE / 2, r = SVG_SIZE / 2 - SVG_PAD;
  const circlePoints: [number, number][] = [];
  const segments = 48;
  for (let i = 0; i < segments; i++) {
    const angle = (2 * Math.PI * i) / segments;
    circlePoints.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
  }

  // seed 배치
  const seeds: [number, number][] = [];
  for (let i = 0; i < regionCount; i++) {
    const angle = (2 * Math.PI * i) / regionCount - Math.PI / 2;
    const seedR = regionCount <= 3 ? r * 0.4 : r * 0.5;
    seeds.push([cx + Math.cos(angle) * seedR, cy + Math.sin(angle) * seedR]);
  }

  const cells = computeVoronoiCells(seeds, circlePoints, SVG_SIZE, SVG_SIZE);
  const centroids = cells.map(c => polygonCentroid(c));

  return {
    outlinePolygons: [circlePoints],
    cells,
    centroids,
    width: SVG_SIZE,
    height: SVG_SIZE,
  };
}

/**
 * 폴리곤을 SVG path d 문자열로 변환.
 */
export function polygonToPath(polygon: [number, number][]): string {
  if (polygon.length < 3) return '';
  return polygon.map((p, i) =>
    `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`
  ).join(' ') + ' Z';
}
