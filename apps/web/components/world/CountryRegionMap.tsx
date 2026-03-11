'use client';

/**
 * CountryRegionMap — v40 SVG 기반 추상적 지역 타일 맵
 *
 * 국가의 지역(Region)을 SVG 타일 그리드로 시각화.
 * - 지역 수(3~7)에 맞는 자동 그리드 레이아웃 (2x2, 2x3, 3x3 등)
 * - 각 타일: 지역명 + 유형 아이콘(이모지) + 팩션 컬러 fill + 상태 뱃지
 * - 호버 시 상세 정보 툴팁
 * - 클릭 → onSelectRegion(regionId) 콜백
 *
 * 실제 지리 좌표가 아닌 추상적/개념적 다이어그램.
 */

import { useState, useMemo } from 'react';
import type { RegionListEntry } from '@/hooks/useMatrixSocket';
import { SK, SKFont, headingFont, bodyFont } from '@/lib/sketch-ui';
import { OVERLAY } from '@/lib/overlay-tokens';

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

const REGION_TYPE_LABELS: Record<string, string> = {
  capital: 'Capital',
  industrial: 'Industrial',
  port: 'Port',
  agricultural: 'Agricultural',
  military: 'Military',
  resource: 'Resource',
  cultural: 'Cultural',
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

// ─── 그리드 레이아웃 계산 ───

interface GridLayout {
  cols: number;
  rows: number;
}

function computeGrid(count: number): GridLayout {
  if (count <= 2) return { cols: 2, rows: 1 };
  if (count <= 4) return { cols: 2, rows: 2 };
  if (count <= 6) return { cols: 3, rows: 2 };
  return { cols: 3, rows: 3 };
}

// ─── SVG 상수 ───

const TILE_GAP = 8;
const TILE_RADIUS = 0; // Apex 스타일: 직각

// ─── 툴팁 컴포넌트 ───

function Tooltip({
  entry,
  x,
  y,
  svgWidth,
}: {
  entry: RegionListEntry;
  x: number;
  y: number;
  svgWidth: number;
}) {
  const state = getEntryState(entry);
  const stateStyle = ENTRY_STATE_COLORS[state];
  const typeIcon = REGION_TYPE_ICONS[entry.type] ?? '📍';
  const typeLabel = REGION_TYPE_LABELS[entry.type] ?? entry.type;
  const resourceIcon = RESOURCE_ICONS[entry.primaryResource] ?? '📦';

  const tooltipWidth = 200;
  const tooltipHeight = 130;
  // 좌우 경계를 넘지 않도록 위치 보정
  const tx = Math.min(Math.max(x - tooltipWidth / 2, 4), svgWidth - tooltipWidth - 4);
  const ty = y - tooltipHeight - 8;

  return (
    <foreignObject x={tx} y={ty < 0 ? y + 8 : ty} width={tooltipWidth} height={tooltipHeight}>
      <div
        style={{
          background: 'rgba(9, 9, 11, 0.95)',
          border: `1px solid ${SK.accentBorder}`,
          padding: '10px 12px',
          fontFamily: bodyFont,
          fontSize: '11px',
          color: SK.textPrimary,
          pointerEvents: 'none',
        }}
      >
        {/* 헤더 */}
        <div style={{ fontFamily: headingFont, fontSize: '13px', marginBottom: '6px' }}>
          {typeIcon} {entry.nameEn}
        </div>
        <div style={{ color: SK.textMuted, marginBottom: '4px', fontSize: '10px' }}>
          {entry.name}
        </div>
        {/* 유형 + 자원 */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '4px', color: SK.textSecondary }}>
          <span>{typeLabel}</span>
          <span>{resourceIcon} {entry.primaryResource}</span>
        </div>
        {/* 접속 인원 + 상태 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: entry.currentPlayers > 0 ? SK.green : SK.textMuted }}>
            👥 {entry.currentPlayers}/{entry.maxPlayers}
          </span>
          <span style={{
            color: stateStyle.color,
            fontSize: '10px',
            fontFamily: headingFont,
            letterSpacing: '0.5px',
          }}>
            {stateStyle.label}
          </span>
        </div>
        {/* 지배 팩션 */}
        {entry.controllingFactionId && (
          <div style={{
            marginTop: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            color: SK.textSecondary,
            fontSize: '10px',
          }}>
            <div style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: entry.controllingFactionColor || SK.accent,
              display: 'inline-block',
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
}: CountryRegionMapProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // 그리드 레이아웃 계산
  const grid = useMemo(() => computeGrid(regions.length), [regions.length]);

  // SVG 뷰포트 크기
  const svgWidth = 460;
  const svgHeight = 400;

  // 타일 크기 계산
  const tileW = (svgWidth - (grid.cols + 1) * TILE_GAP) / grid.cols;
  const tileH = (svgHeight - (grid.rows + 1) * TILE_GAP) / grid.rows;

  // 호버된 지역 데이터 (툴팁용)
  const hoveredRegion = useMemo(
    () => regions.find(r => r.regionId === hoveredId) ?? null,
    [regions, hoveredId],
  );

  // 호버된 지역의 타일 중앙 좌표 (툴팁 위치용)
  const hoveredPos = useMemo(() => {
    if (!hoveredId) return null;
    const idx = regions.findIndex(r => r.regionId === hoveredId);
    if (idx < 0) return null;
    const col = idx % grid.cols;
    const row = Math.floor(idx / grid.cols);
    const x = TILE_GAP + col * (tileW + TILE_GAP) + tileW / 2;
    const y = TILE_GAP + row * (tileH + TILE_GAP);
    return { x, y };
  }, [hoveredId, regions, grid.cols, tileW, tileH]);

  // ─── 로딩 상태 ───

  if (loading) {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: bodyFont,
        fontSize: SKFont.sm,
        color: SK.textMuted,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '24px',
            height: '24px',
            border: `2px solid ${SK.border}`,
            borderTop: `2px solid ${SK.accent}`,
            borderRadius: '50%',
            margin: '0 auto 12px',
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
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: bodyFont,
        fontSize: SKFont.sm,
        color: SK.textMuted,
      }}>
        No regions available
      </div>
    );
  }

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      style={{ userSelect: 'none' }}
    >
      {/* 배경 그리드 패턴 (전술 맵 분위기) */}
      <defs>
        <pattern id="grid-pattern" width="20" height="20" patternUnits="userSpaceOnUse">
          <path
            d="M 20 0 L 0 0 0 20"
            fill="none"
            stroke="rgba(255,255,255,0.02)"
            strokeWidth="0.5"
          />
        </pattern>
      </defs>
      <rect width={svgWidth} height={svgHeight} fill="url(#grid-pattern)" />

      {/* 지역 타일 렌더링 */}
      {regions.map((entry, idx) => {
        const col = idx % grid.cols;
        const row = Math.floor(idx / grid.cols);
        const x = TILE_GAP + col * (tileW + TILE_GAP);
        const y = TILE_GAP + row * (tileH + TILE_GAP);

        const state = getEntryState(entry);
        const stateStyle = ENTRY_STATE_COLORS[state];
        const isHovered = hoveredId === entry.regionId;
        const isJoining = joining === entry.regionId;
        const isClickable = state === 'open' && !isJoining;
        const typeIcon = REGION_TYPE_ICONS[entry.type] ?? '📍';

        // 팩션 컬러 배경 (점령 중이면 팩션색, 아니면 기본 다크)
        const baseFill = entry.controllingFactionColor
          ? `${entry.controllingFactionColor}20`
          : 'rgba(20, 20, 24, 0.8)';
        const hoverFill = entry.controllingFactionColor
          ? `${entry.controllingFactionColor}35`
          : 'rgba(28, 28, 34, 0.9)';
        const tileFill = isHovered && isClickable ? hoverFill : baseFill;

        // 테두리 색상
        const borderColor = isHovered && isClickable
          ? (entry.controllingFactionColor || SK.accent)
          : isJoining
            ? SK.accent
            : 'rgba(255,255,255,0.06)';

        return (
          <g
            key={entry.regionId}
            style={{
              cursor: isClickable ? 'pointer' : 'not-allowed',
              opacity: state === 'locked' ? 0.45 : 1,
              transition: `opacity ${OVERLAY.transition}`,
            }}
            onClick={() => isClickable && onSelectRegion(entry.regionId)}
            onMouseEnter={() => setHoveredId(entry.regionId)}
            onMouseLeave={() => setHoveredId(null)}
          >
            {/* 타일 배경 */}
            <rect
              x={x}
              y={y}
              width={tileW}
              height={tileH}
              rx={TILE_RADIUS}
              fill={tileFill}
              stroke={borderColor}
              strokeWidth={isHovered ? 1.5 : 1}
              style={{ transition: `all ${OVERLAY.transition}` }}
            />

            {/* 좌측 팩션 컬러 스트라이프 */}
            <rect
              x={x}
              y={y}
              width={3}
              height={tileH}
              fill={entry.controllingFactionColor || SK.textMuted}
            />

            {/* 유형 아이콘 (큰 중앙) */}
            <text
              x={x + tileW / 2}
              y={y + tileH * 0.35}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="28"
              style={{ pointerEvents: 'none' }}
            >
              {typeIcon}
            </text>

            {/* 지역 영문명 */}
            <text
              x={x + tileW / 2}
              y={y + tileH * 0.58}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={SK.textPrimary}
              fontSize="12"
              fontFamily={headingFont}
              fontWeight={600}
              style={{ pointerEvents: 'none' }}
            >
              {entry.nameEn.length > 14 ? entry.nameEn.slice(0, 13) + '...' : entry.nameEn}
            </text>

            {/* 한글 지역명 */}
            <text
              x={x + tileW / 2}
              y={y + tileH * 0.70}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={SK.textMuted}
              fontSize="10"
              fontFamily={bodyFont}
              style={{ pointerEvents: 'none' }}
            >
              {entry.name}
            </text>

            {/* 접속 인원 */}
            <text
              x={x + tileW / 2}
              y={y + tileH * 0.85}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={entry.currentPlayers > 0 ? SK.green : SK.textMuted}
              fontSize="10"
              fontFamily={bodyFont}
              style={{ pointerEvents: 'none' }}
            >
              👥 {entry.currentPlayers}/{entry.maxPlayers}
            </text>

            {/* 상태 뱃지 (우상단) */}
            <rect
              x={x + tileW - 50}
              y={y + 6}
              width={44}
              height={16}
              rx={0}
              fill={isJoining ? 'rgba(99, 102, 241, 0.15)' : stateStyle.bg}
              stroke={isJoining ? `${SK.accent}40` : `${stateStyle.color}40`}
              strokeWidth={0.5}
            />
            <text
              x={x + tileW - 28}
              y={y + 14}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={isJoining ? SK.accent : stateStyle.color}
              fontSize="8"
              fontFamily={headingFont}
              fontWeight={600}
              letterSpacing="0.5"
              style={{ pointerEvents: 'none' }}
            >
              {isJoining ? 'JOINING' : stateStyle.label}
            </text>

            {/* 지배 팩션 인디케이터 (좌상단) */}
            {entry.controllingFactionId && (
              <>
                <circle
                  cx={x + 14}
                  cy={y + 14}
                  r={4}
                  fill={entry.controllingFactionColor || SK.accent}
                />
                {entry.controlStreak > 1 && (
                  <text
                    x={x + 22}
                    y={y + 14}
                    dominantBaseline="middle"
                    fill={SK.orange}
                    fontSize="8"
                    fontFamily={bodyFont}
                    style={{ pointerEvents: 'none' }}
                  >
                    {entry.controlStreak}d
                  </text>
                )}
              </>
            )}
          </g>
        );
      })}

      {/* 호버 툴팁 */}
      {hoveredRegion && hoveredPos && (
        <Tooltip
          entry={hoveredRegion}
          x={hoveredPos.x}
          y={hoveredPos.y}
          svgWidth={svgWidth}
        />
      )}
    </svg>
  );
}
