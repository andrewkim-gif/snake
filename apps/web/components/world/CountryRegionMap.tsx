'use client';

/**
 * CountryRegionMap — v42 SVG 국가 실루엣 기반 지역 맵
 *
 * 국가 윤곽(SVG path) 내부를 Voronoi 방식으로 지역별 폴리곤 셀로 분할.
 * - 주요 20개국: 실제 국가 모양 실루엣 + 지역 시드 위치
 * - 나머지 국가: 원형 실루엣 + 균등 분배
 * - 각 셀: 팩션 컬러 fill + hover + 클릭 + 지역명/아이콘
 * - 호버 시 상세 정보 툴팁
 */

import { useState, useMemo, useCallback } from 'react';
import type { RegionListEntry } from '@/hooks/useMatrixSocket';
import { SK, SKFont, headingFont, bodyFont } from '@/lib/sketch-ui';
import { OVERLAY } from '@/lib/overlay-tokens';
import { getCountrySilhouette } from '@/lib/country-silhouettes';

// ─── Props ───────────────────────────────────────────────

interface CountryRegionMapProps {
  /** 지역 목록 (소켓에서 수신) */
  regions: RegionListEntry[];
  /** 로딩 중 여부 */
  loading: boolean;
  /** 현재 접속 시도 중인 지역 ID */
  joining: string | null;
  /** 지역 클릭 콜백 */
  onSelectRegion: (regionId: string) => void;
  /** 국가 코드 (실루엣 조회용) */
  countryCode?: string;
}

// ─── 유형 아이콘 매핑 ───

const REGION_TYPE_ICONS: Record<string, string> = {
  capital: '🏛️',
  industrial: '🏭',
  port: '⚓',
  agricultural: '🌾',
  military: '🎖️',
  resource: '⛏️',
  cultural: '🎭',
};

const RESOURCE_ICONS: Record<string, string> = {
  tech: '💻',
  minerals: '💎',
  gold: '💰',
  food: '🌽',
  oil: '🛢️',
  influence: '🕊️',
};

// ─── 지역 상태 판정 ───

type RegionEntryState = 'open' | 'full' | 'locked';

function getEntryState(entry: RegionListEntry): RegionEntryState {
  if (entry.state === 'idle' || entry.state === 'pve' || entry.state === 'br' || entry.state === 'settling') {
    if (entry.currentPlayers >= entry.maxPlayers) return 'full';
    return 'open';
  }
  return 'locked';
}

const ENTRY_STATE_COLORS: Record<RegionEntryState, { color: string; label: string; bg: string }> = {
  open: { color: '#10B981', label: 'OPEN', bg: 'rgba(16, 185, 129, 0.15)' },
  full: { color: '#F59E0B', label: 'FULL', bg: 'rgba(245, 158, 11, 0.15)' },
  locked: { color: '#55565E', label: 'LOCKED', bg: 'rgba(85, 86, 94, 0.15)' },
};

// ─── SVG 상수 ───

const SVG_W = 400;
const SVG_H = 400;

// ─── Voronoi 기반 지역 분할 유틸 ───

interface VoronoiCell {
  seed: [number, number];
  polygon: [number, number][];
  regionIndex: number;
}

/**
 * SVG path d 속성에서 포인트 목록을 추출하는 간단한 파서.
 * M, L, Z 명령만 지원 (간소화된 국가 윤곽용).
 */
function parsePathToPoints(d: string): [number, number][] {
  const points: [number, number][] = [];
  // M/L 다음 좌표, Z 무시
  const re = /[ML]\s*([\d.e+-]+)[,\s]+([\d.e+-]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d)) !== null) {
    points.push([parseFloat(m[1]), parseFloat(m[2])]);
  }
  return points;
}

/**
 * 폴리곤 내부 포인트 판정 (ray casting).
 */
function pointInPolygon(px: number, py: number, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * 폴리곤의 bounding box를 구한다.
 */
function polygonBounds(polygon: [number, number][]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of polygon) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

/**
 * 두 직선 세그먼트의 교점을 구한다 (없으면 null).
 */
function lineIntersect(
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

/**
 * 볼록 다각형을 반평면으로 클리핑 (Sutherland-Hodgman의 단일 에지 클리핑).
 * 직선 (lx1,ly1)→(lx2,ly2)의 왼쪽을 유지.
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
        const inter = lineIntersect(cx, cy, nx, ny, lx1, ly1, lx2, ly2);
        if (inter) out.push(inter);
      }
    } else if (nSide >= 0) {
      const inter = lineIntersect(cx, cy, nx, ny, lx1, ly1, lx2, ly2);
      if (inter) out.push(inter);
    }
  }
  return out;
}

/**
 * 국가 윤곽 폴리곤 내부에서 Voronoi 셀을 생성.
 * 간소화 구현: bounding box → 각 seed 주위로 Voronoi 셀을 반평면 클리핑으로 구한 뒤
 * 국가 윤곽으로 다시 클리핑.
 */
function computeVoronoiCells(
  seeds: [number, number][],
  boundaryPolygon: [number, number][],
): [number, number][][] {
  const bounds = polygonBounds(boundaryPolygon);
  const pad = 20;
  const bx0 = bounds.minX - pad;
  const by0 = bounds.minY - pad;
  const bx1 = bounds.maxX + pad;
  const by1 = bounds.maxY + pad;

  // bounding rect 시작 폴리곤
  const boundingRect: [number, number][] = [
    [bx0, by0], [bx1, by0], [bx1, by1], [bx0, by1],
  ];

  const cells: [number, number][][] = [];

  for (let i = 0; i < seeds.length; i++) {
    let cell = [...boundingRect];

    // 다른 모든 seed에 대해 반평면 클리핑
    for (let j = 0; j < seeds.length; j++) {
      if (i === j) continue;
      if (cell.length < 3) break;

      const [sx, sy] = seeds[i];
      const [ox, oy] = seeds[j];
      // 중점
      const mx = (sx + ox) / 2;
      const my = (sy + oy) / 2;
      // seed i → seed j 방향의 수직선 (왼쪽이 seed i 영역)
      const dx = ox - sx;
      const dy = oy - sy;
      // 수직선의 두 점 (충분히 먼 거리)
      const lx1 = mx - dy * 1000;
      const ly1 = my + dx * 1000;
      const lx2 = mx + dy * 1000;
      const ly2 = my - dx * 1000;

      cell = clipPolygonByLine(cell, lx1, ly1, lx2, ly2);
    }

    // 국가 윤곽으로 클리핑 (Sutherland-Hodgman 전체)
    let clipped = cell;
    for (let e = 0; e < boundaryPolygon.length && clipped.length >= 3; e++) {
      const [ex1, ey1] = boundaryPolygon[e];
      const [ex2, ey2] = boundaryPolygon[(e + 1) % boundaryPolygon.length];
      clipped = clipPolygonByLine(clipped, ex1, ey1, ex2, ey2);
    }

    cells.push(clipped);
  }

  return cells;
}

/**
 * 폴리곤의 중심 (centroid)을 구한다.
 */
function polygonCentroid(polygon: [number, number][]): [number, number] {
  if (polygon.length === 0) return [100, 100];
  let cx = 0, cy = 0;
  for (const [x, y] of polygon) { cx += x; cy += y; }
  return [cx / polygon.length, cy / polygon.length];
}

/**
 * 폴리곤을 SVG path d 문자열로 변환.
 */
function polygonToPath(polygon: [number, number][]): string {
  if (polygon.length < 3) return '';
  return polygon.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ') + ' Z';
}

// ─── 툴팁 컴포넌트 ───

function Tooltip({
  entry,
  x,
  y,
}: {
  entry: RegionListEntry;
  x: number;
  y: number;
}) {
  const state = getEntryState(entry);
  const stateStyle = ENTRY_STATE_COLORS[state];
  const typeIcon = REGION_TYPE_ICONS[entry.type] ?? '📍';
  const resourceIcon = RESOURCE_ICONS[entry.primaryResource] ?? '📦';

  const tooltipWidth = 240;
  const tooltipHeight = 150;
  const tx = Math.min(Math.max(x - tooltipWidth / 2, 4), SVG_W - tooltipWidth - 4);
  const ty = y - tooltipHeight - 12;

  return (
    <foreignObject
      x={tx}
      y={ty < 0 ? y + 12 : ty}
      width={tooltipWidth}
      height={tooltipHeight}
      style={{ pointerEvents: 'none' }}
    >
      <div
        style={{
          background: 'rgba(9, 9, 11, 0.95)',
          border: `1px solid ${SK.accentBorder}`,
          padding: '12px 14px',
          fontFamily: bodyFont,
          fontSize: '13px',
          color: SK.textPrimary,
        }}
      >
        <div style={{ fontFamily: headingFont, fontSize: '15px', marginBottom: '6px' }}>
          {typeIcon} {entry.nameEn}
        </div>
        <div style={{ color: SK.textMuted, marginBottom: '5px', fontSize: '12px' }}>
          {entry.name}
        </div>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '5px', color: SK.textSecondary, fontSize: '12px' }}>
          <span>{resourceIcon} {entry.primaryResource}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: entry.currentPlayers > 0 ? SK.green : SK.textMuted, fontSize: '13px' }}>
            👥 {entry.currentPlayers}/{entry.maxPlayers}
          </span>
          <span style={{
            color: stateStyle.color,
            fontSize: '11px',
            fontFamily: headingFont,
            letterSpacing: '0.5px',
          }}>
            {stateStyle.label}
          </span>
        </div>
        {entry.controllingFactionId && (
          <div style={{
            marginTop: '5px',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            color: SK.textSecondary,
            fontSize: '11px',
          }}>
            <div style={{
              width: '7px', height: '7px', borderRadius: '50%',
              background: entry.controllingFactionColor || SK.accent,
            }} />
            Controlled
            {entry.controlStreak > 1 && (
              <span style={{ color: SK.orange }}>{entry.controlStreak}d</span>
            )}
          </div>
        )}
      </div>
    </foreignObject>
  );
}

// ─── CountryRegionMap 메인 ───

export default function CountryRegionMap({
  regions,
  loading,
  joining,
  onSelectRegion,
  countryCode = '',
}: CountryRegionMapProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // 국가 실루엣 + Voronoi 셀 계산
  const { cells, outlinePath } = useMemo(() => {
    if (regions.length === 0) return { cells: [] as VoronoiCell[], outlinePath: '' };

    const silhouette = getCountrySilhouette(countryCode, regions.length);
    const boundaryPts = parsePathToPoints(silhouette.path);

    if (boundaryPts.length < 3) {
      return { cells: [] as VoronoiCell[], outlinePath: '' };
    }

    // 200x200 좌표를 SVG_W x SVG_H로 스케일
    const scaleX = SVG_W / 200;
    const scaleY = SVG_H / 200;
    const scaledBoundary: [number, number][] = boundaryPts.map(([x, y]) => [x * scaleX, y * scaleY]);

    // seed 좌표 결정 — silhouette에 seed가 있으면 매핑, 없으면 자동 배치
    const seedEntries = silhouette.seeds ? Object.entries(silhouette.seeds) : [];
    const seeds: [number, number][] = [];

    for (let i = 0; i < regions.length; i++) {
      const region = regions[i];
      // regionId에서 slug 추출 (예: "kor_seoul" → "seoul", "kor-capital-0" → "capital")
      const slug = region.regionId.split(/[-_]/).slice(1).join('_').toLowerCase();

      // silhouette seeds에서 매칭되는 좌표 찾기
      let found = false;
      for (const [key, [sx, sy]] of seedEntries) {
        if (slug.includes(key) || key.includes(slug.split('_')[0])) {
          seeds.push([sx * scaleX, sy * scaleY]);
          found = true;
          break;
        }
      }

      if (!found) {
        // 시드 목록에서 인덱스 순서로 할당
        if (i < seedEntries.length) {
          const [, [sx, sy]] = seedEntries[i];
          seeds.push([sx * scaleX, sy * scaleY]);
        } else {
          // fallback: 국가 중심 주위로 분배
          const c = polygonCentroid(scaledBoundary);
          const angle = (2 * Math.PI * i) / regions.length - Math.PI / 2;
          const r = 60;
          seeds.push([c[0] + Math.cos(angle) * r, c[1] + Math.sin(angle) * r]);
        }
      }
    }

    // Voronoi 셀 계산
    const voronoiPolygons = computeVoronoiCells(seeds, scaledBoundary);

    const cellData: VoronoiCell[] = voronoiPolygons.map((polygon, i) => ({
      seed: seeds[i] || [0, 0],
      polygon,
      regionIndex: i,
    }));

    // 윤곽 path 생성
    const outline = polygonToPath(scaledBoundary);

    return { cells: cellData, outlinePath: outline };
  }, [regions, countryCode]);

  // 호버된 지역 데이터
  const hoveredRegion = useMemo(
    () => regions.find(r => r.regionId === hoveredId) ?? null,
    [regions, hoveredId],
  );

  // 호버된 셀의 centroid (툴팁 위치)
  const hoveredPos = useMemo(() => {
    if (!hoveredId) return null;
    const idx = regions.findIndex(r => r.regionId === hoveredId);
    if (idx < 0 || !cells[idx]) return null;
    return polygonCentroid(cells[idx].polygon);
  }, [hoveredId, regions, cells]);

  const handleMouseEnter = useCallback((id: string) => setHoveredId(id), []);
  const handleMouseLeave = useCallback(() => setHoveredId(null), []);

  // ─── 로딩 상태 ───
  if (loading) {
    return (
      <div style={{
        width: '100%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: bodyFont, fontSize: SKFont.sm, color: SK.textMuted,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '24px', height: '24px',
            border: `2px solid ${SK.border}`, borderTop: `2px solid ${SK.accent}`,
            borderRadius: '50%', margin: '0 auto 12px',
            animation: 'spin 1s linear infinite',
          }} />
          Loading regions...
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  // ─── 지역 없음 ───
  if (regions.length === 0) {
    return (
      <div style={{
        width: '100%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: bodyFont, fontSize: SKFont.sm, color: SK.textMuted,
      }}>
        No regions available
      </div>
    );
  }

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      style={{ userSelect: 'none' }}
    >
      {/* 배경 그리드 패턴 */}
      <defs>
        <pattern id="region-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="0.5" />
        </pattern>
        {/* 국가 윤곽 클리핑 마스크 */}
        <clipPath id="country-clip">
          <path d={outlinePath} />
        </clipPath>
      </defs>
      <rect width={SVG_W} height={SVG_H} fill="url(#region-grid)" />

      {/* 국가 윤곽 배경 (어두운 기본색) */}
      <path
        d={outlinePath}
        fill="rgba(15, 15, 20, 0.6)"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="1.5"
      />

      {/* 지역 폴리곤 셀 */}
      {cells.map((cell, idx) => {
        if (idx >= regions.length || cell.polygon.length < 3) return null;

        const entry = regions[idx];
        const state = getEntryState(entry);
        const stateStyle = ENTRY_STATE_COLORS[state];
        const isHovered = hoveredId === entry.regionId;
        const isJoining = joining === entry.regionId;
        const isClickable = state === 'open' && !isJoining;
        const typeIcon = REGION_TYPE_ICONS[entry.type] ?? '📍';

        // 팩션 컬러 배경
        const baseFill = entry.controllingFactionColor
          ? `${entry.controllingFactionColor}25`
          : 'rgba(25, 25, 32, 0.7)';
        const hoverFill = entry.controllingFactionColor
          ? `${entry.controllingFactionColor}45`
          : 'rgba(40, 40, 52, 0.9)';
        const cellFill = isHovered && isClickable ? hoverFill : baseFill;

        // 테두리 색상
        const borderColor = isHovered && isClickable
          ? (entry.controllingFactionColor || SK.accent)
          : isJoining
            ? SK.accent
            : 'rgba(255,255,255,0.12)';

        const pathD = polygonToPath(cell.polygon);
        const centroid = polygonCentroid(cell.polygon);

        return (
          <g
            key={entry.regionId}
            style={{
              cursor: isClickable ? 'pointer' : 'not-allowed',
              opacity: state === 'locked' ? 0.4 : 1,
              transition: `opacity ${OVERLAY.transition}`,
            }}
            onClick={() => isClickable && onSelectRegion(entry.regionId)}
            onMouseEnter={() => handleMouseEnter(entry.regionId)}
            onMouseLeave={handleMouseLeave}
          >
            {/* 셀 폴리곤 */}
            <path
              d={pathD}
              fill={cellFill}
              stroke={borderColor}
              strokeWidth={isHovered ? 2 : 1}
              style={{ transition: `all ${OVERLAY.transition}` }}
            />

            {/* 팩션 색 인디케이터 — 셀 내부 작은 원 */}
            {entry.controllingFactionId && (
              <circle
                cx={centroid[0] - 25}
                cy={centroid[1] - 15}
                r={5}
                fill={entry.controllingFactionColor || SK.accent}
                style={{ pointerEvents: 'none' }}
              />
            )}

            {/* 유형 아이콘 */}
            <text
              x={centroid[0]}
              y={centroid[1] - 8}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="22"
              style={{ pointerEvents: 'none' }}
            >
              {typeIcon}
            </text>

            {/* 지역 영문명 */}
            <text
              x={centroid[0]}
              y={centroid[1] + 12}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={SK.textPrimary}
              fontSize="11"
              fontFamily={headingFont}
              fontWeight={700}
              style={{ pointerEvents: 'none' }}
            >
              {entry.nameEn.length > 14 ? entry.nameEn.slice(0, 13) + '..' : entry.nameEn}
            </text>

            {/* 접속 인원 */}
            <text
              x={centroid[0]}
              y={centroid[1] + 26}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={entry.currentPlayers > 0 ? SK.green : SK.textMuted}
              fontSize="10"
              fontFamily={bodyFont}
              fontWeight={600}
              style={{ pointerEvents: 'none' }}
            >
              {entry.currentPlayers}/{entry.maxPlayers}
            </text>

            {/* 상태 뱃지 (우상단 영역) */}
            <text
              x={centroid[0] + 25}
              y={centroid[1] - 18}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={isJoining ? SK.accent : stateStyle.color}
              fontSize="8"
              fontFamily={headingFont}
              fontWeight={600}
              letterSpacing="0.5"
              style={{ pointerEvents: 'none' }}
            >
              {isJoining ? 'JOIN..' : stateStyle.label}
            </text>
          </g>
        );
      })}

      {/* 국가 윤곽 외곽선 (최상위 — 셀 경계 위에) */}
      <path
        d={outlinePath}
        fill="none"
        stroke="rgba(255,255,255,0.15)"
        strokeWidth="2"
        style={{ pointerEvents: 'none' }}
      />

      {/* 호버 툴팁 */}
      {hoveredRegion && hoveredPos && (
        <Tooltip
          entry={hoveredRegion}
          x={hoveredPos[0]}
          y={hoveredPos[1]}
        />
      )}
    </svg>
  );
}
