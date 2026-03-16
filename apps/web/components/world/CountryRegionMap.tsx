'use client';

/**
 * CountryRegionMap — v42 GeoJSON 기반 실제 국가 지도 + Voronoi 지역 분할
 *
 * /data/countries.geojson에서 해당 국가의 실제 윤곽을 추출하고
 * Mercator 투영 → SVG path → Voronoi subdivision으로 지역 폴리곤 생성.
 * - 195개국 모두 실제 국가 모양 지원
 * - 주요 20개국: 실제 도시 좌표 기반 지역 시드 배치
 * - 나머지: 자동 균등 분배
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import type { RegionListEntry } from '@/hooks/useMatrixSocket';
import { SK, SKFont, headingFont, bodyFont } from '@/lib/sketch-ui';
import { OVERLAY } from '@/lib/overlay-tokens';
import { buildCountryOutline, polygonToPath, type CountryOutline } from '@/lib/country-silhouettes';
import { SOVEREIGNTY_DISPLAY, type SovereigntyLevel } from '@/lib/matrix/types/region';

// ─── Props ───

interface CountryRegionMapProps {
  regions: RegionListEntry[];
  loading: boolean;
  joining: string | null;
  onSelectRegion: (regionId: string) => void;
  countryCode?: string;
}

// ─── 아이콘 매핑 ───

const REGION_TYPE_ICONS: Record<string, string> = {
  capital: '🏛️', industrial: '🏭', port: '⚓',
  agricultural: '🌾', military: '🎖️', resource: '⛏️', cultural: '🎭',
};

const RESOURCE_ICONS: Record<string, string> = {
  tech: '💻', minerals: '💎', gold: '💰',
  food: '🌽', oil: '🛢️', influence: '🕊️',
};

// ─── 지역 상태 ───

type RegionEntryState = 'open' | 'full' | 'locked';

function getEntryState(entry: RegionListEntry): RegionEntryState {
  if (entry.state === 'idle' || entry.state === 'pve' || entry.state === 'br' || entry.state === 'settling') {
    if (entry.currentPlayers >= entry.maxPlayers) return 'full';
    return 'open';
  }
  return 'locked';
}

const STATE_COLORS: Record<RegionEntryState, { color: string; label: string }> = {
  open: { color: '#10B981', label: 'OPEN' },
  full: { color: '#F59E0B', label: 'FULL' },
  locked: { color: '#55565E', label: 'LOCKED' },
};

/** controlStreak에서 주권 레벨 추론 */
function getSovereigntyLevel(entry: RegionListEntry): SovereigntyLevel {
  if (!entry.controllingFactionId) return 'none';
  if (entry.controlStreak >= 14) return 'hegemony';
  if (entry.controlStreak >= 3) return 'sovereignty';
  if (entry.controlStreak >= 1) return 'active_domination';
  return 'none';
}

// ─── 툴팁 ───

function Tooltip({ entry, x, y, svgW }: {
  entry: RegionListEntry; x: number; y: number; svgW: number;
}) {
  const state = getEntryState(entry);
  const stateStyle = STATE_COLORS[state];
  const typeIcon = REGION_TYPE_ICONS[entry.type] ?? '📍';
  const resourceIcon = RESOURCE_ICONS[entry.primaryResource] ?? '📦';
  const sovLevel = getSovereigntyLevel(entry);
  const sovDisplay = SOVEREIGNTY_DISPLAY[sovLevel];
  const w = 230, h = entry.controllingFactionId ? 165 : 145;
  const tx = Math.min(Math.max(x - w / 2, 4), svgW - w - 4);
  const ty = y - h - 12;

  return (
    <foreignObject x={tx} y={ty < 0 ? y + 12 : ty} width={w} height={h}
      style={{ pointerEvents: 'none' }}>
      <div style={{
        background: 'rgba(9,9,11,0.95)', border: `1px solid ${SK.accentBorder}`,
        padding: '11px 13px', fontFamily: bodyFont, fontSize: '12px', color: SK.textPrimary,
      }}>
        <div style={{ fontFamily: headingFont, fontSize: '14px', marginBottom: '5px' }}>
          {typeIcon} {entry.nameEn}
        </div>
        <div style={{ color: SK.textMuted, marginBottom: '4px', fontSize: '11px' }}>
          {entry.name}
        </div>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '4px', color: SK.textSecondary, fontSize: '11px' }}>
          <span>{resourceIcon} {entry.primaryResource}</span>
          {entry.specialEffect && <span style={{ color: SK.orange, fontSize: '10px' }}>{entry.specialEffect}</span>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: entry.currentPlayers > 0 ? SK.green : SK.textMuted, fontSize: '12px' }}>
            👥 {entry.currentPlayers}/{entry.maxPlayers}
          </span>
          <span style={{ color: stateStyle.color, fontSize: '10px', fontFamily: headingFont, letterSpacing: '0.5px' }}>
            {stateStyle.label}
          </span>
        </div>
        {entry.controllingFactionId && (
          <div style={{ marginTop: '5px', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: entry.controllingFactionColor || SK.accent }} />
            <span style={{ color: sovDisplay.color, fontWeight: 700 }}>
              {sovDisplay.icon} {sovDisplay.label}
            </span>
            {entry.controlStreak > 1 && <span style={{ color: SK.orange }}>({entry.controlStreak}d)</span>}
          </div>
        )}
      </div>
    </foreignObject>
  );
}

// ─── 메인 컴포넌트 ───

export default function CountryRegionMap({
  regions, loading, joining, onSelectRegion, countryCode = '',
}: CountryRegionMapProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [outline, setOutline] = useState<CountryOutline | null>(null);
  const [mapLoading, setMapLoading] = useState(true);

  // 지역 ID 키 (의존성 안정화)
  const regionKey = useMemo(() => regions.map(r => r.regionId).join(','), [regions]);

  // GeoJSON에서 국가 윤곽 + Voronoi 셀 비동기 로드
  useEffect(() => {
    if (regions.length === 0 || !countryCode) {
      setOutline(null);
      setMapLoading(false);
      return;
    }

    let cancelled = false;
    setMapLoading(true);

    const regionIds = regions.map(r => r.regionId);
    buildCountryOutline(countryCode, regions.length, regionIds)
      .then(result => {
        if (!cancelled) {
          setOutline(result);
          setMapLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setMapLoading(false);
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryCode, regionKey]);

  const handleMouseEnter = useCallback((id: string) => setHoveredId(id), []);
  const handleMouseLeave = useCallback(() => setHoveredId(null), []);

  const hoveredRegion = useMemo(
    () => regions.find(r => r.regionId === hoveredId) ?? null,
    [regions, hoveredId],
  );

  const hoveredPos = useMemo(() => {
    if (!hoveredId || !outline) return null;
    const idx = regions.findIndex(r => r.regionId === hoveredId);
    if (idx < 0 || !outline.centroids[idx]) return null;
    return outline.centroids[idx];
  }, [hoveredId, regions, outline]);

  // ─── 로딩 ───
  if (loading || mapLoading) {
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
          Loading map...
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  // ─── 빈 상태 ───
  if (regions.length === 0 || !outline) {
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

  const { outlinePolygons, cells, centroids, width, height } = outline;

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ userSelect: 'none', maxHeight: '100%' }}>
      {/* 배경 + 글로우 필터 */}
      <defs>
        <pattern id="region-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.015)" strokeWidth="0.5" />
        </pattern>
        <filter id="faction-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      <rect width={width} height={height} fill="url(#region-grid)" />

      {/* 국가 윤곽 배경 (모든 폴리곤) */}
      {outlinePolygons.map((poly, i) => (
        <path key={`outline-bg-${i}`}
          d={polygonToPath(poly)}
          fill="rgba(15,15,20,0.5)"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="1"
        />
      ))}

      {/* 지역 폴리곤 셀 */}
      {cells.map((cell, idx) => {
        if (idx >= regions.length || cell.length < 3) return null;
        const entry = regions[idx];
        const state = getEntryState(entry);
        const stateStyle = STATE_COLORS[state];
        const isHovered = hoveredId === entry.regionId;
        const isJoining = joining === entry.regionId;
        const isClickable = state === 'open' && !isJoining;
        const typeIcon = REGION_TYPE_ICONS[entry.type] ?? '📍';
        const centroid = centroids[idx] || [0, 0];
        const sovLevel = getSovereigntyLevel(entry);
        const sovDisplay = SOVEREIGNTY_DISPLAY[sovLevel];
        const hasFaction = !!entry.controllingFactionColor;

        // 팩션 점령: 40% opacity fill / 중립: 어두운 회색
        const baseFill = hasFaction
          ? `${entry.controllingFactionColor}40` : 'rgba(30,30,40,0.55)';
        const hoverFill = hasFaction
          ? `${entry.controllingFactionColor}60` : 'rgba(50,50,70,0.85)';
        const cellFill = isHovered && isClickable ? hoverFill : baseFill;
        // 셀 경계선: 2px, hover 시 2.5px
        const borderColor = isHovered && isClickable
          ? (entry.controllingFactionColor || SK.accent)
          : isJoining ? SK.accent : 'rgba(255,255,255,0.18)';

        return (
          <g key={entry.regionId}
            style={{
              cursor: isClickable ? 'pointer' : 'not-allowed',
              opacity: state === 'locked' ? 0.4 : 1,
              transition: `opacity ${OVERLAY.transition}`,
            }}
            onClick={() => isClickable && onSelectRegion(entry.regionId)}
            onMouseEnter={() => handleMouseEnter(entry.regionId)}
            onMouseLeave={handleMouseLeave}
          >
            {/* 셀 폴리곤 — 팩션 점령 시 글로우 */}
            <path d={polygonToPath(cell)} fill={cellFill}
              stroke={borderColor} strokeWidth={isHovered ? 1.5 : 1}
              filter={hasFaction && sovLevel !== 'none' ? 'url(#faction-glow)' : undefined}
              style={{ transition: `all ${OVERLAY.transition}` }}
            />

            {/* 주권 아이콘 (점령 시) */}
            {hasFaction && sovDisplay.icon && (
              <text x={centroid[0] - 18} y={centroid[1] - 8}
                textAnchor="middle" dominantBaseline="middle" fontSize="10"
                style={{ pointerEvents: 'none' }}>
                {sovDisplay.icon}
              </text>
            )}

            {/* 유형 아이콘 */}
            <text x={centroid[0]} y={centroid[1] - 6}
              textAnchor="middle" dominantBaseline="middle" fontSize="14"
              style={{ pointerEvents: 'none' }}>
              {typeIcon}
            </text>

            {/* 영문 지역명 */}
            <text x={centroid[0]} y={centroid[1] + 9}
              textAnchor="middle" dominantBaseline="middle"
              fill={SK.textPrimary} fontSize="9" fontFamily={bodyFont}
              fontWeight={600} style={{ pointerEvents: 'none' }}>
              {entry.nameEn.length > 16 ? entry.nameEn.slice(0, 15) + '..' : entry.nameEn}
            </text>

            {/* 접속 인원 */}
            <text x={centroid[0]} y={centroid[1] + 20}
              textAnchor="middle" dominantBaseline="middle"
              fill={entry.currentPlayers > 0 ? SK.green : SK.textMuted}
              fontSize="8" fontFamily={bodyFont} fontWeight={500}
              style={{ pointerEvents: 'none' }}>
              👥 {entry.currentPlayers}/{entry.maxPlayers}
            </text>

            {/* 상태 라벨 */}
            <text x={centroid[0] + 20} y={centroid[1] - 12}
              textAnchor="middle" dominantBaseline="middle"
              fill={isJoining ? SK.accent : stateStyle.color}
              fontSize="7" fontFamily={bodyFont} fontWeight={500}
              letterSpacing="0.3" style={{ pointerEvents: 'none' }}>
              {isJoining ? 'JOIN..' : stateStyle.label}
            </text>
          </g>
        );
      })}

      {/* 국가 외곽선 (최상위) — 1.5px */}
      {outlinePolygons.map((poly, i) => (
        <path key={`outline-top-${i}`}
          d={polygonToPath(poly)}
          fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5"
          style={{ pointerEvents: 'none' }}
        />
      ))}

      {/* 툴팁 */}
      {hoveredRegion && hoveredPos && (
        <Tooltip entry={hoveredRegion} x={hoveredPos[0]} y={hoveredPos[1]} svgW={width} />
      )}
    </svg>
  );
}
