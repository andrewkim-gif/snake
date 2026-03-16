/**
 * topo-decode.ts — 의존성 없는 최소 TopoJSON 디코더
 *
 * mapshaper로 생성된 TopoJSON을 런타임에서 디코딩.
 * topojson-client 없이 직접 arc delta-decode + dequantize 수행.
 */

// ─── TopoJSON 타입 ───

interface ITopoTransform {
  scale: [number, number];
  translate: [number, number];
}

interface ITopoArc {
  // delta-encoded 좌표 배열
  [index: number]: [number, number];
  length: number;
}

interface ITopoGeometry {
  type: string;
  arcs?: number[][] | number[][][];
  properties?: Record<string, unknown>;
}

interface ITopoObject {
  type: string;
  geometries: ITopoGeometry[];
}

export interface ITopoJSON {
  type: 'Topology';
  transform?: ITopoTransform;
  arcs: number[][][];
  objects: Record<string, ITopoObject>;
}

export interface IDecodedRegion {
  /** region_idx (mapshaper dissolve 결과) */
  regionIdx: number;
  /** 폴리곤 좌표 배열 (외곽 + holes) — [lon, lat][][] */
  polygons: [number, number][][];
  /** properties (원본) */
  properties: Record<string, unknown>;
}

// ─── Arc 디코딩 ───

/** delta-encoded arc를 절대 좌표로 디코딩 */
function decodeArc(arc: number[][], transform?: ITopoTransform): [number, number][] {
  const result: [number, number][] = [];
  let x = 0, y = 0;

  for (const pt of arc) {
    x += pt[0];
    y += pt[1];

    if (transform) {
      result.push([
        x * transform.scale[0] + transform.translate[0],
        y * transform.scale[1] + transform.translate[1],
      ]);
    } else {
      result.push([x, y]);
    }
  }

  return result;
}

/** arc index로 좌표 추출 (음수 = 역순) */
function getArcCoords(
  arcIdx: number,
  decodedArcs: [number, number][][],
): [number, number][] {
  if (arcIdx >= 0) {
    return decodedArcs[arcIdx].slice();
  }
  // 음수: ~arcIdx = 역순
  return [...decodedArcs[~arcIdx]].reverse();
}

/** arc index 배열 → 하나의 ring으로 결합 */
function arcIndicesToRing(
  arcIndices: number[],
  decodedArcs: [number, number][][],
): [number, number][] {
  const ring: [number, number][] = [];

  for (const idx of arcIndices) {
    const coords = getArcCoords(idx, decodedArcs);
    // 첫 번째 좌표는 이전 arc의 마지막과 중복되므로 skip (첫 arc 제외)
    const start = ring.length > 0 ? 1 : 0;
    for (let i = start; i < coords.length; i++) {
      ring.push(coords[i]);
    }
  }

  return ring;
}

// ─── 메인 디코더 ───

/**
 * TopoJSON을 디코딩하여 region별 폴리곤 배열 반환.
 * mapshaper에서 dissolve된 결과를 기대 (game_region_idx 속성 포함).
 */
export function decodeTopoJSON(topo: ITopoJSON): IDecodedRegion[] {
  // 1. 모든 arc를 절대 좌표로 디코딩
  const decodedArcs: [number, number][][] = topo.arcs.map(
    arc => decodeArc(arc, topo.transform),
  );

  // 2. 첫 번째 object 사용 (mapshaper 기본 출력)
  const objectName = Object.keys(topo.objects)[0];
  if (!objectName) return [];

  const obj = topo.objects[objectName];
  if (!obj.geometries) return [];

  // 3. 각 geometry를 디코딩
  const regions: IDecodedRegion[] = [];

  for (const geom of obj.geometries) {
    const props = (geom.properties || {}) as Record<string, unknown>;
    const regionIdx = typeof props.region_idx === 'number'
      ? props.region_idx
      : typeof props.game_region_idx === 'number'
        ? props.game_region_idx
        : regions.length;

    const polygons: [number, number][][] = [];

    if (geom.type === 'Polygon' && geom.arcs) {
      // arcs: number[][] — 각 배열이 하나의 ring
      for (const ringArcs of geom.arcs as number[][]) {
        polygons.push(arcIndicesToRing(ringArcs, decodedArcs));
      }
    } else if (geom.type === 'MultiPolygon' && geom.arcs) {
      // arcs: number[][][] — 각 폴리곤의 ring 배열들
      for (const polyArcs of geom.arcs as number[][][]) {
        for (const ringArcs of polyArcs) {
          polygons.push(arcIndicesToRing(ringArcs, decodedArcs));
        }
      }
    }

    regions.push({ regionIdx, polygons, properties: props });
  }

  // regionIdx 순서로 정렬
  regions.sort((a, b) => a.regionIdx - b.regionIdx);

  return regions;
}
