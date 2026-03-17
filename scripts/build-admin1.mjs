#!/usr/bin/env node
/**
 * build-admin1.mjs — Natural Earth Admin1 → 게임 지역 TopoJSON 빌드
 *
 * Natural Earth 10m admin1 데이터를 다운로드하고,
 * mapshaper로 simplify + 면적 기반 병합 → 국가별 TopoJSON 출력.
 *
 * Usage: node scripts/build-admin1.mjs
 * Output: apps/web/public/data/admin1/{ISO3}.topo.json
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'apps/web/public/data/admin1');
const TMP_DIR = path.join(ROOT, '.tmp-admin1');
const NE_URL = 'https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_1_states_provinces.zip';
const NE_ZIP = path.join(TMP_DIR, 'admin1.zip');
const NE_DIR = path.join(TMP_DIR, 'admin1');
const NE_SHP = path.join(NE_DIR, 'ne_10m_admin_1_states_provinces.shp');

// ── 티어별 지역 수 ──
const TIER_REGION_COUNT = { S: 7, A: 5, B: 4, C: 3, D: 3 };

// ── 국가 티어 매핑 ──
const COUNTRY_TIERS = {
  USA: 'S', CHN: 'S', RUS: 'S', IND: 'S', JPN: 'S', DEU: 'S', GBR: 'S', FRA: 'S',
  KOR: 'A', BRA: 'A', CAN: 'A', AUS: 'A', ITA: 'A', TUR: 'A', SAU: 'A', MEX: 'A',
  IDN: 'A', ESP: 'A', NLD: 'A', POL: 'A', ARG: 'A', ZAF: 'A', EGY: 'A', PAK: 'A',
  NGA: 'A', IRN: 'A', ISR: 'A', UKR: 'A',
  THA: 'B', VNM: 'B', MYS: 'B', PHL: 'B', SGP: 'B', TWN: 'B', SWE: 'B', NOR: 'B',
  CHE: 'B', AUT: 'B', BEL: 'B', CZE: 'B', ROU: 'B', PRT: 'B', GRC: 'B', HUN: 'B',
  DNK: 'B', FIN: 'B', IRL: 'B', NZL: 'B', CHL: 'B', COL: 'B', PER: 'B', VEN: 'B',
  BGD: 'B', LKA: 'B', MMR: 'B', KAZ: 'B', UZB: 'B', ETH: 'B', KEN: 'B', TZA: 'B',
  MAR: 'B', DZA: 'B', IRQ: 'B', CUB: 'B', PRK: 'B', SRB: 'B', BGR: 'B', SVK: 'B',
};

// ── 수동 매핑: 20개 주요국의 admin1 → game region 매핑 ──
// admin1 name(Natural Earth name 필드 기준) → game region slug
import { ADMIN1_REGION_MAPPING } from '../apps/web/lib/admin1-mapping.mjs';

// ── 1) Natural Earth 데이터 다운로드 ──

function downloadNE() {
  if (fs.existsSync(NE_SHP)) {
    console.log('  ✓ Natural Earth admin1 already downloaded');
    return;
  }

  fs.mkdirSync(TMP_DIR, { recursive: true });
  fs.mkdirSync(NE_DIR, { recursive: true });

  console.log('  ↓ Downloading Natural Earth admin1 (38MB)...');
  execSync(`curl -sL "${NE_URL}" -o "${NE_ZIP}"`, { stdio: 'inherit' });

  console.log('  ↓ Extracting...');
  execSync(`unzip -oq "${NE_ZIP}" -d "${NE_DIR}"`, { stdio: 'inherit' });

  if (!fs.existsSync(NE_SHP)) {
    throw new Error(`Expected ${NE_SHP} after extraction`);
  }
  console.log('  ✓ Natural Earth admin1 ready');
}

// ── 2) mapshaper 기반 처리 ──

function mapshaper(args) {
  const cmd = `npx mapshaper ${args}`;
  return execSync(cmd, { cwd: ROOT, encoding: 'utf-8', maxBuffer: 100 * 1024 * 1024 });
}

// ── 3) GeoJSON에서 admin1 목록 추출 ──

function loadFilteredGeoJSON(iso3) {
  // mapshaper로 필터링 + GeoJSON 출력
  const tmpOut = path.join(TMP_DIR, `${iso3}_filtered.geojson`);
  try {
    mapshaper(
      `-i "${NE_SHP}" ` +
      `-filter "adm0_a3 === '${iso3}' || iso_a2 === '${iso3}'" ` +
      `-o "${tmpOut}" format=geojson`
    );
  } catch {
    return null;
  }

  if (!fs.existsSync(tmpOut) || fs.statSync(tmpOut).size < 100) {
    return null;
  }

  const data = JSON.parse(fs.readFileSync(tmpOut, 'utf-8'));
  if (!data.features || data.features.length === 0) return null;
  return data;
}

// ── 4) 면적 기반 Agglomerative Merge ──

function computeArea(feature) {
  // GeoJSON 좌표로 간략 면적 계산 (Shoelace on lon/lat → 대략적)
  const coords = feature.geometry.type === 'MultiPolygon'
    ? feature.geometry.coordinates
    : [feature.geometry.coordinates];

  let total = 0;
  for (const poly of coords) {
    const ring = poly[0];
    if (!ring || ring.length < 3) continue;
    let area = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      area += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
    }
    total += Math.abs(area / 2);
  }
  return total;
}

function getCentroid(feature) {
  const coords = feature.geometry.type === 'MultiPolygon'
    ? feature.geometry.coordinates
    : [feature.geometry.coordinates];

  let cx = 0, cy = 0, n = 0;
  for (const poly of coords) {
    for (const pt of poly[0] || []) {
      cx += pt[0]; cy += pt[1]; n++;
    }
  }
  return n > 0 ? [cx / n, cy / n] : [0, 0];
}

function distSq(a, b) {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
}

/** bbox가 겹치는지 확인 (인접 판정용) */
function bboxOverlap(a, b, margin = 0.5) {
  return !(a[2] + margin < b[0] || b[2] + margin < a[0] ||
           a[3] + margin < b[1] || b[3] + margin < a[1]);
}

function getBBox(feature) {
  const coords = feature.geometry.type === 'MultiPolygon'
    ? feature.geometry.coordinates
    : [feature.geometry.coordinates];

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const poly of coords) {
    for (const pt of poly[0] || []) {
      if (pt[0] < minX) minX = pt[0];
      if (pt[1] < minY) minY = pt[1];
      if (pt[0] > maxX) maxX = pt[0];
      if (pt[1] > maxY) maxY = pt[1];
    }
  }
  return [minX, minY, maxX, maxY];
}

/**
 * 면적 기반 agglomerative merge: N개 admin1 → K개 game region
 * 가장 작은 인접 pair를 반복 합침
 */
function agglomerativeMerge(features, targetK) {
  if (features.length <= targetK) {
    return features.map((f, i) => [i]);
  }

  // 초기 클러스터: 각 feature가 독립 클러스터
  const clusters = features.map((_, i) => ({
    indices: [i],
    area: computeArea(features[i]),
    centroid: getCentroid(features[i]),
    bbox: getBBox(features[i]),
  }));

  while (clusters.length > targetK) {
    // 가장 작은 클러스터 찾기
    let minIdx = 0;
    for (let i = 1; i < clusters.length; i++) {
      if (clusters[i].area < clusters[minIdx].area) minIdx = i;
    }

    // 인접(bbox overlap) 중 가장 가까운 클러스터 찾기
    let bestNeighbor = -1;
    let bestDist = Infinity;

    for (let j = 0; j < clusters.length; j++) {
      if (j === minIdx) continue;
      if (bboxOverlap(clusters[minIdx].bbox, clusters[j].bbox)) {
        const d = distSq(clusters[minIdx].centroid, clusters[j].centroid);
        if (d < bestDist) {
          bestDist = d;
          bestNeighbor = j;
        }
      }
    }

    // 인접 이웃 없으면 (섬 등) centroid 거리로 가장 가까운 클러스터 합류
    if (bestNeighbor === -1) {
      for (let j = 0; j < clusters.length; j++) {
        if (j === minIdx) continue;
        const d = distSq(clusters[minIdx].centroid, clusters[j].centroid);
        if (d < bestDist) {
          bestDist = d;
          bestNeighbor = j;
        }
      }
    }

    if (bestNeighbor === -1) break; // 단일 클러스터

    // 병합
    const merged = clusters[bestNeighbor];
    const small = clusters[minIdx];
    merged.indices.push(...small.indices);
    merged.area += small.area;
    merged.centroid = [
      (merged.centroid[0] * (merged.indices.length - small.indices.length) +
        small.centroid[0] * small.indices.length) / merged.indices.length,
      (merged.centroid[1] * (merged.indices.length - small.indices.length) +
        small.centroid[1] * small.indices.length) / merged.indices.length,
    ];
    merged.bbox = [
      Math.min(merged.bbox[0], small.bbox[0]),
      Math.min(merged.bbox[1], small.bbox[1]),
      Math.max(merged.bbox[2], small.bbox[2]),
      Math.max(merged.bbox[3], small.bbox[3]),
    ];

    clusters.splice(minIdx, 1);
  }

  return clusters.map(c => c.indices);
}

// ── 5) 수동 매핑 적용 ──

function applyManualMapping(features, iso3) {
  const mapping = ADMIN1_REGION_MAPPING[iso3];
  if (!mapping) return null;

  const regionSlugs = Object.keys(mapping);
  const assignments = new Array(features.length).fill(-1);
  const regionCount = regionSlugs.length;

  // 각 feature를 매핑된 region에 할당
  for (let fi = 0; fi < features.length; fi++) {
    const props = features[fi].properties || {};
    // Natural Earth name 필드 시도
    const fName = (props.name || props.name_en || props.gn_name || '').trim();

    for (let ri = 0; ri < regionCount; ri++) {
      const adminNames = mapping[regionSlugs[ri]];
      if (adminNames.some(n => fName.toLowerCase().includes(n.toLowerCase()) ||
                                n.toLowerCase().includes(fName.toLowerCase()))) {
        assignments[fi] = ri;
        break;
      }
    }
  }

  // 미할당 feature → centroid 거리로 가장 가까운 할당된 region에 합류
  const regionCentroids = new Array(regionCount).fill(null);
  for (let ri = 0; ri < regionCount; ri++) {
    const assigned = features.filter((_, fi) => assignments[fi] === ri);
    if (assigned.length > 0) {
      let cx = 0, cy = 0;
      for (const f of assigned) {
        const c = getCentroid(f);
        cx += c[0]; cy += c[1];
      }
      regionCentroids[ri] = [cx / assigned.length, cy / assigned.length];
    }
  }

  for (let fi = 0; fi < features.length; fi++) {
    if (assignments[fi] !== -1) continue;
    const fc = getCentroid(features[fi]);
    let best = -1, bestD = Infinity;
    for (let ri = 0; ri < regionCount; ri++) {
      if (!regionCentroids[ri]) continue;
      const d = distSq(fc, regionCentroids[ri]);
      if (d < bestD) { bestD = d; best = ri; }
    }
    assignments[fi] = best >= 0 ? best : 0;
  }

  // 클러스터 형태로 반환
  const clusters = regionSlugs.map(() => /** @type {number[]} */ ([]));
  for (let fi = 0; fi < features.length; fi++) {
    clusters[assignments[fi]].push(fi);
  }

  return clusters;
}

// ── 6) 국가별 TopoJSON 생성 ──

function buildCountryTopoJSON(iso3, geojson, targetRegions) {
  const features = geojson.features;
  if (features.length === 0) return null;

  // 수동 매핑 시도 → 없으면 agglomerative merge
  let clusters = applyManualMapping(features, iso3);
  if (!clusters) {
    clusters = agglomerativeMerge(features, targetRegions);
  }

  // game_region_idx를 feature에 할당
  for (let ci = 0; ci < clusters.length; ci++) {
    for (const fi of clusters[ci]) {
      features[fi].properties.game_region_idx = ci;
    }
  }

  // 임시 GeoJSON 저장
  const tmpGeo = path.join(TMP_DIR, `${iso3}_clustered.geojson`);
  fs.writeFileSync(tmpGeo, JSON.stringify(geojson));

  // mapshaper: dissolve by game_region_idx + simplify + TopoJSON export
  const outFile = path.join(OUT_DIR, `${iso3}.topo.json`);

  try {
    mapshaper(
      `-i "${tmpGeo}" ` +
      `-dissolve game_region_idx copy-fields=game_region_idx ` +
      `-simplify visvalingam 10% ` +
      `-each "region_idx = game_region_idx" ` +
      `-o "${outFile}" format=topojson`
    );
  } catch (err) {
    console.error(`  ✗ ${iso3}: mapshaper failed — ${err.message}`);
    return null;
  }

  if (!fs.existsSync(outFile) || fs.statSync(outFile).size < 50) {
    return null;
  }

  return outFile;
}

// ── 7) 메인 실행 ──

async function main() {
  console.log('=== Admin1 Build: Natural Earth → TopoJSON ===\n');

  // 1. Download
  console.log('[1/4] Downloading Natural Earth admin1...');
  downloadNE();

  // 2. Output directory
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // 3. Get unique ISO3 codes from the data
  console.log('\n[2/4] Extracting unique countries from NE data...');
  const tmpIsoJson = path.join(TMP_DIR, '_iso_extract.json');
  mapshaper(
    `-i "${NE_SHP}" ` +
    `-each "iso3 = adm0_a3" ` +
    `-filter-fields iso3 ` +
    `-o "${tmpIsoJson}" format=geojson`
  );
  const isoData = JSON.parse(fs.readFileSync(tmpIsoJson, 'utf-8'));
  const allIso3 = [...new Set(
    isoData.features
      .map(f => f.properties?.iso3)
      .filter(v => v && v.length === 3)
  )].sort();

  console.log(`  Found ${allIso3.length} countries in NE data`);

  // 4. 각 국가 처리
  console.log('\n[3/4] Processing countries...');
  let success = 0, skipped = 0, failed = 0;

  for (const iso3 of allIso3) {
    const tier = COUNTRY_TIERS[iso3] || 'D';
    const targetRegions = TIER_REGION_COUNT[tier];

    // admin1 데이터 로드
    const geojson = loadFilteredGeoJSON(iso3);
    if (!geojson) {
      skipped++;
      continue;
    }

    const result = buildCountryTopoJSON(iso3, geojson, targetRegions);
    if (result) {
      const size = (fs.statSync(result).size / 1024).toFixed(1);
      const featureCount = geojson.features.length;
      console.log(`  ✓ ${iso3}: ${featureCount} admin1 → ${targetRegions} regions (${size}KB)`);
      success++;
    } else {
      failed++;
    }
  }

  // 5. 결과 요약
  console.log(`\n[4/4] Summary`);
  console.log(`  ✓ Success: ${success}`);
  console.log(`  - Skipped: ${skipped}`);
  console.log(`  ✗ Failed: ${failed}`);
  console.log(`  Output: ${OUT_DIR}`);

  // 클린업 임시 파일 (소스는 유지)
  const tmpFiles = fs.readdirSync(TMP_DIR).filter(f => f.endsWith('.geojson'));
  for (const f of tmpFiles) {
    fs.unlinkSync(path.join(TMP_DIR, f));
  }

  console.log('\nDone! Run "npm run build" to verify integration.');
}

main().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
