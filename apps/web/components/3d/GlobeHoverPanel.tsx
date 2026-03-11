'use client';

/**
 * GlobeHoverPanel — 마우스 호버 시 국가 정보 패널
 * v14 Phase 6 — S30
 *
 * Shows: flag + dominator + 4 key stats (Happiness/GDP/Military/Population)
 * Status badges: At War / Sovereignty / Hegemony
 * "Click to Enter" button
 * Position: follows mouse with edge clamping
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import { SK, SKFont, bodyFont, radius } from '@/lib/sketch-ui';
import { OVERLAY } from '@/lib/overlay-tokens';

// ─── Types ──

export interface GlobeHoverData {
  countryCode: string;
  countryName: string;
  flag?: string;             // emoji or URL
  dominantNation?: string;   // ISO3 of dominator
  dominantNationName?: string;

  // 4 key stats
  happiness: number;         // 0-100
  gdp: number;               // $B
  militaryPower: number;     // 0-100
  population: number;        // thousands

  // Status flags
  atWar: boolean;
  hasSovereignty: boolean;
  hasHegemony: boolean;

  // Active players
  activeAgents: number;

  // v39 Phase 4: Region info
  /** 지역 수 (국가 티어별: S=7, A=5, B=4, C/D=3) */
  regionCount?: number;
  /** 지배된 지역 수 */
  controlledRegionCount?: number;
  /** 국가 티어 */
  countryTier?: string;
}

interface GlobeHoverPanelProps {
  data: GlobeHoverData | null;
  mouseX: number;
  mouseY: number;
  visible: boolean;
  onClickEnter?: (countryCode: string) => void;
  /** v26: Globe → Isometric 도시 관리 전환 */
  onClickManage?: (countryCode: string) => void;
}

// ─── Constants ──

const PANEL_WIDTH = 260;
const PANEL_HEIGHT = 200;
const OFFSET_X = 16;
const OFFSET_Y = 16;
const EDGE_MARGIN = 12;

// ─── Helper: format population ──
function formatPopulation(pop: number): string {
  if (pop >= 1000) return `${(pop / 1000).toFixed(1)}M`;
  return `${pop.toFixed(0)}K`;
}

function formatGDP(gdp: number): string {
  if (gdp >= 1000) return `$${(gdp / 1000).toFixed(1)}T`;
  return `$${gdp.toFixed(0)}B`;
}

// ─── Mini Stat Row ──
function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '3px 0',
    }}>
      <span style={{
        fontFamily: bodyFont,
        fontSize: '10px',
        color: SK.textMuted,
        letterSpacing: '0.5px',
      }}>
        {label}
      </span>
      <span style={{
        fontFamily: bodyFont,
        fontSize: SKFont.xs,
        color: color,
        fontWeight: 700,
      }}>
        {value}
      </span>
    </div>
  );
}

// ─── Status Badge ──
function StatusBadge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: radius.pill,
      background: `${color}20`,
      color: color,
      fontFamily: bodyFont,
      fontSize: '9px',
      fontWeight: 800,
      letterSpacing: '1px',
      marginRight: '4px',
    }}>
      {label}
    </span>
  );
}

// ─── Main Component ──

export function GlobeHoverPanel({
  data,
  mouseX,
  mouseY,
  visible,
  onClickEnter,
  onClickManage,
}: GlobeHoverPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  // Compute clamped position
  useEffect(() => {
    if (!visible || !data) return;

    const vw = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 1080;

    let x = mouseX + OFFSET_X;
    let y = mouseY + OFFSET_Y;

    // Right edge clamp
    if (x + PANEL_WIDTH + EDGE_MARGIN > vw) {
      x = mouseX - PANEL_WIDTH - OFFSET_X;
    }

    // Bottom edge clamp
    if (y + PANEL_HEIGHT + EDGE_MARGIN > vh) {
      y = mouseY - PANEL_HEIGHT - OFFSET_Y;
    }

    // Left edge clamp
    if (x < EDGE_MARGIN) x = EDGE_MARGIN;

    // Top edge clamp
    if (y < EDGE_MARGIN) y = EDGE_MARGIN;

    setPosition({ x, y });
  }, [mouseX, mouseY, visible, data]);

  const handleManageClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (data) onClickManage?.(data.countryCode);
  }, [data, onClickManage]);

  if (!visible || !data) return null;

  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${PANEL_WIDTH}px`,
        zIndex: 50,
        pointerEvents: 'auto',
        background: OVERLAY.bg,
        backdropFilter: OVERLAY.blur,
        WebkitBackdropFilter: OVERLAY.blur,
        border: OVERLAY.border,
        borderRadius: OVERLAY.borderRadius,
        padding: '14px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        transition: `opacity ${OVERLAY.transition}`,
        opacity: visible ? 1 : 0,
      }}
    >
      {/* Header: Country name + code */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '8px',
      }}>
        <div>
          <div style={{
            fontFamily: bodyFont,
            fontSize: SKFont.sm,
            color: SK.textPrimary,
            fontWeight: 700,
          }}>
            {data.flag && <span style={{ marginRight: '6px' }}>{data.flag}</span>}
            {data.countryName}
          </div>
          <div style={{
            fontFamily: bodyFont,
            fontSize: '10px',
            color: SK.textMuted,
            marginTop: '1px',
          }}>
            {data.countryCode}
            {data.activeAgents > 0 && (
              <span style={{ color: SK.green, marginLeft: '8px' }}>
                {data.activeAgents} online
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Dominator */}
      {data.dominantNation && (
        <div style={{
          fontFamily: bodyFont,
          fontSize: '10px',
          color: SK.textSecondary,
          marginBottom: '8px',
          padding: '4px 8px',
          background: `${SK.blue}10`,
          borderRadius: radius.sm,
        }}>
          Dominated by <span style={{ color: SK.blue, fontWeight: 700 }}>
            {data.dominantNationName || data.dominantNation}
          </span>
        </div>
      )}

      {/* Status Badges */}
      {(data.atWar || data.hasSovereignty || data.hasHegemony) && (
        <div style={{ marginBottom: '8px' }}>
          {data.atWar && <StatusBadge label="AT WAR" color={SK.red} />}
          {data.hasHegemony && <StatusBadge label="HEGEMONY" color={SK.gold} />}
          {data.hasSovereignty && !data.hasHegemony && <StatusBadge label="SOVEREIGNTY" color={SK.blue} />}
        </div>
      )}

      {/* 4 Key Stats */}
      <div style={{
        padding: '8px',
        background: 'rgba(255,255,255,0.02)',
        borderRadius: radius.md,
        marginBottom: '10px',
      }}>
        <MiniStat label="Happiness" value={`${data.happiness.toFixed(0)}/100`} color="#FBBF24" />
        <MiniStat label="GDP" value={formatGDP(data.gdp)} color="#34D399" />
        <MiniStat label="Military" value={`${data.militaryPower.toFixed(0)}/100`} color="#EF4444" />
        <MiniStat label="Population" value={formatPopulation(data.population)} color="#FB923C" />
      </div>

      {/* v39 Phase 4: Region Info */}
      {data.regionCount != null && data.regionCount > 0 && (
        <div style={{
          padding: '6px 8px',
          background: 'rgba(255,255,255,0.02)',
          borderRadius: radius.md,
          marginBottom: '10px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{
            fontFamily: bodyFont,
            fontSize: '10px',
            color: SK.textMuted,
          }}>
            Regions
          </div>
          <div style={{
            fontFamily: bodyFont,
            fontSize: SKFont.xs,
            color: SK.textPrimary,
            fontWeight: 700,
          }}>
            {data.controlledRegionCount != null && data.controlledRegionCount > 0 ? (
              <span>
                <span style={{ color: SK.accent }}>{data.controlledRegionCount}</span>
                <span style={{ color: SK.textMuted }}>/</span>
                {data.regionCount}
                <span style={{ color: SK.textMuted, fontWeight: 400, marginLeft: '4px' }}>controlled</span>
              </span>
            ) : (
              <span>{data.regionCount} zones</span>
            )}
          </div>
        </div>
      )}

      {/* Action Button — ENTER {COUNTRY} */}
      <button
        onClick={handleManageClick}
        style={{
          width: '100%',
          padding: '10px 8px',
          borderRadius: radius.md,
          border: `1px solid ${SK.green}60`,
          background: `${SK.green}20`,
          color: SK.green,
          fontFamily: bodyFont,
          fontSize: SKFont.xs,
          fontWeight: 700,
          cursor: 'pointer',
          letterSpacing: '1.5px',
          transition: 'all 150ms ease',
        }}
        onMouseEnter={(e) => {
          (e.target as HTMLButtonElement).style.background = `${SK.green}40`;
        }}
        onMouseLeave={(e) => {
          (e.target as HTMLButtonElement).style.background = `${SK.green}20`;
        }}
      >
        ENTER {data.countryName.toUpperCase()}
      </button>
    </div>
  );
}

export default GlobeHoverPanel;
