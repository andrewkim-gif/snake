/**
 * country-silhouettes.ts — GeoJSON 기반 국가 실루엣 추출 + Voronoi 지역 분할
 *
 * /data/countries.geojson에서 해당 국가의 실제 폴리곤을 추출하고
 * Mercator 투영으로 SVG 좌표로 변환한 뒤, Voronoi subdivision으로 지역 분할.
 */

import { loadGeoJSON, type GeoJSONData, type GeoJSONFeature } from './globe-data';
import { getCountryISO } from './map-style';

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
        const inter = segmentIntersect(cx, cy, nx, ny, lx1, ly1, lx2, ly2);
        if (inter) out.push(inter);
      }
    } else if (nSide >= 0) {
      const inter = segmentIntersect(cx, cy, nx, ny, lx1, ly1, lx2, ly2);
      if (inter) out.push(inter);
    }
  }
  return out;
}

function segmentIntersect(
  x1: number, y1: number, x2: number, y2: number,
  x3: number, y3: number, x4: number, y4: number,
): [number, number] | null {
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 1e-10) return null;
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)];
  }
  return null;
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

  const cells: [number, number][][] = [];

  for (let i = 0; i < seeds.length; i++) {
    let cell = [...boundingRect];

    for (let j = 0; j < seeds.length; j++) {
      if (i === j || cell.length < 3) continue;

      const [sx, sy] = seeds[i];
      const [ox, oy] = seeds[j];
      const mx = (sx + ox) / 2;
      const my = (sy + oy) / 2;
      const dx = ox - sx;
      const dy = oy - sy;
      cell = clipPolygonByLine(cell,
        mx - dy * 1000, my + dx * 1000,
        mx + dy * 1000, my - dx * 1000,
      );
    }

    // 국가 윤곽으로 클리핑
    for (let e = 0; e < boundaryPolygon.length && cell.length >= 3; e++) {
      const [ex1, ey1] = boundaryPolygon[e];
      const [ex2, ey2] = boundaryPolygon[(e + 1) % boundaryPolygon.length];
      cell = clipPolygonByLine(cell, ex1, ey1, ex2, ey2);
    }

    cells.push(cell);
  }

  return cells;
}

function polygonCentroid(polygon: [number, number][]): [number, number] {
  if (polygon.length === 0) return [0, 0];
  let cx = 0, cy = 0;
  for (const [x, y] of polygon) { cx += x; cy += y; }
  return [cx / polygon.length, cy / polygon.length];
}

// ─── 메인 API ───

const SVG_SIZE = 400;
const SVG_PAD = 25;

/**
 * GeoJSON에서 국가 윤곽을 추출하고 Voronoi 분할한 결과를 반환한다.
 * regionIds는 지역 slug 매칭에 사용.
 */
export async function buildCountryOutline(
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
