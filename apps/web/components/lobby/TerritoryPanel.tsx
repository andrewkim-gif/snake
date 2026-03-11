'use client';

/**
 * TerritoryPanel — v39 Phase 7 영토 지배 현황 패널
 *
 * 로비 UI에서 국가/지역별 영토 지배 현황을 표시한다.
 * - 팩션별 RP 누적 바 차트
 * - 주권 에스컬레이션 레벨 뱃지
 * - 일일 정산 타이머 (UTC 00:00 카운트다운)
 * - 지배 팩션 컬러 표시
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { McPanel } from './McPanel';
import { SK, sketchBorder } from '@/lib/sketch-ui';
import type {
  SovereigntyLevel,
  ITerritorySnapshot,
  ITerritoryRegionSnapshot,
  ITerritorySovereigntySnapshot,
} from '@/lib/matrix/types/region';
import { SOVEREIGNTY_DISPLAY, SOVEREIGNTY_CONFIG } from '@/lib/matrix/types/region';

// ── Props ──

export interface TerritoryPanelProps {
  /** 영토 스냅샷 데이터 (서버에서 수신) */
  snapshot: ITerritorySnapshot | null;
  /** 현재 선택된 국가 코드 (글로브에서 선택) */
  selectedCountry?: string;
  /** 팩션 이름 맵 (factionId → 팩션명) */
  factionNames?: Record<string, string>;
  /** 팩션 컬러 맵 (factionId → hex color) */
  factionColors?: Record<string, string>;
  /** 패널 닫기 핸들러 */
  onClose?: () => void;
  /** 패널 최대 높이 */
  maxHeight?: number;
}

// ── 정산 타이머 계산 ──

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return '00:00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function useSettlementCountdown(initialCountdown: number): string {
  const [countdown, setCountdown] = useState(initialCountdown);

  useEffect(() => {
    setCountdown(initialCountdown);
  }, [initialCountdown]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown > 0]);

  return formatCountdown(countdown);
}

// ── 주권 레벨 뱃지 ──

function SovereigntyBadge({ level }: { level: SovereigntyLevel }) {
  const display = SOVEREIGNTY_DISPLAY[level];
  if (level === 'none') return null;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.05em',
        color: display.color,
        backgroundColor: `${display.color}15`,
        border: `1px solid ${display.color}40`,
      }}
    >
      <span>{display.icon}</span>
      <span>{display.label}</span>
    </span>
  );
}

// ── RP 바 차트 ──

interface RPBarProps {
  factionId: string;
  factionName: string;
  color: string;
  rp: number;
  maxRP: number;
  isController: boolean;
}

function RPBar({ factionName, color, rp, maxRP, isController }: RPBarProps) {
  const pct = maxRP > 0 ? Math.min((rp / maxRP) * 100, 100) : 0;

  return (
    <div style={{ marginBottom: '6px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2px',
        }}
      >
        <span
          style={{
            fontSize: '12px',
            color: isController ? color : SK.textSecondary,
            fontWeight: isController ? 700 : 400,
          }}
        >
          {isController ? '● ' : ''}{factionName}
        </span>
        <span
          style={{
            fontSize: '11px',
            color: SK.textMuted,
            fontFamily: 'monospace',
          }}
        >
          {rp} RP
        </span>
      </div>
      {/* RP 바 */}
      <div
        style={{
          height: '4px',
          backgroundColor: SK.border,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            backgroundColor: color,
            transition: 'width 0.5s ease-out',
          }}
        />
      </div>
    </div>
  );
}

// ── 지역 카드 ──

interface RegionCardProps {
  region: ITerritoryRegionSnapshot;
  factionNames: Record<string, string>;
  factionColors: Record<string, string>;
}

function RegionCard({ region, factionNames, factionColors }: RegionCardProps) {
  const dailyRP = region.dailyRP || {};
  const entries = Object.entries(dailyRP).sort(([, a], [, b]) => b - a);
  const maxRP = entries.length > 0 ? entries[0][1] : 0;
  const controllerName = region.controllerFaction
    ? (factionNames[region.controllerFaction] || region.controllerFaction.slice(0, 8))
    : 'Neutral';
  const controllerColor = region.controllerColor
    || (region.controllerFaction ? (factionColors[region.controllerFaction] || '#888') : '#666');

  return (
    <div
      style={{
        padding: '12px',
        backgroundColor: SK.bgWarm,
        border: sketchBorder(),
        borderLeft: `3px solid ${controllerColor}`,
        marginBottom: '8px',
      }}
    >
      {/* 지역 헤더 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px',
        }}
      >
        <div>
          <span
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: SK.textPrimary,
              letterSpacing: '0.03em',
            }}
          >
            {region.regionId.replace('_', ' ').toUpperCase()}
          </span>
          {region.controlStreak > 0 && (
            <span
              style={{
                fontSize: '11px',
                color: SK.textMuted,
                marginLeft: '8px',
              }}
            >
              Day {region.controlStreak}
            </span>
          )}
        </div>
        <SovereigntyBadge level={region.sovereigntyLevel} />
      </div>

      {/* 지배 팩션 */}
      <div
        style={{
          fontSize: '11px',
          color: controllerColor,
          marginBottom: '8px',
          fontWeight: 500,
        }}
      >
        Controller: {controllerName}
      </div>

      {/* RP 바 차트 */}
      {entries.length > 0 ? (
        entries.slice(0, 5).map(([fid, rp]) => (
          <RPBar
            key={fid}
            factionId={fid}
            factionName={factionNames[fid] || fid.slice(0, 8)}
            color={factionColors[fid] || '#888'}
            rp={rp}
            maxRP={maxRP}
            isController={fid === region.controllerFaction}
          />
        ))
      ) : (
        <div style={{ fontSize: '11px', color: SK.textMuted }}>
          No activity today
        </div>
      )}
    </div>
  );
}

// ── 국가 주권 카드 ──

interface CountryCardProps {
  country: ITerritorySovereigntySnapshot;
  regions: ITerritoryRegionSnapshot[];
  factionNames: Record<string, string>;
  factionColors: Record<string, string>;
}

function CountryCard({ country, regions, factionNames, factionColors }: CountryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const controlledCount = regions.filter((r) => r.controllerFaction).length;
  const sovDisplay = SOVEREIGNTY_DISPLAY[country.sovereigntyLevel];
  const sovFactionName = country.sovereignFaction
    ? (factionNames[country.sovereignFaction] || country.sovereignFaction.slice(0, 8))
    : null;
  const sovColor = country.sovereignFaction
    ? (factionColors[country.sovereignFaction] || '#888')
    : '#666';

  return (
    <div
      style={{
        marginBottom: '12px',
        border: sketchBorder(),
        borderTop: `1px solid ${country.sovereigntyLevel !== 'none' ? sovDisplay.color : SK.border}`,
        backgroundColor: SK.cardBg,
      }}
    >
      {/* 국가 헤더 */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 12px',
          cursor: 'pointer',
          transition: 'background-color 0.15s',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.backgroundColor = SK.cardBgHover;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent';
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: '14px',
              fontWeight: 700,
              color: SK.textPrimary,
              fontFamily: '"Rajdhani", sans-serif',
              letterSpacing: '0.05em',
            }}
          >
            {country.countryCode}
          </span>
          <span
            style={{
              fontSize: '11px',
              color: SK.textMuted,
            }}
          >
            {controlledCount}/{regions.length} regions
          </span>
          {country.allControlled && (
            <span style={{ fontSize: '11px', color: SK.gold }}>
              UNIFIED
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {sovFactionName && (
            <span style={{ fontSize: '11px', color: sovColor, fontWeight: 600 }}>
              {sovFactionName}
            </span>
          )}
          <SovereigntyBadge level={country.sovereigntyLevel} />
          <span
            style={{
              fontSize: '12px',
              color: SK.textMuted,
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s',
            }}
          >
            ▼
          </span>
        </div>
      </div>

      {/* 확장된 지역 목록 */}
      {expanded && (
        <div style={{ padding: '0 12px 12px' }}>
          {regions.map((region) => (
            <RegionCard
              key={region.regionId}
              region={region}
              factionNames={factionNames}
              factionColors={factionColors}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── TerritoryPanel 메인 ──

export function TerritoryPanel({
  snapshot,
  selectedCountry,
  factionNames = {},
  factionColors = {},
  onClose,
  maxHeight = 600,
}: TerritoryPanelProps) {
  // 정산 카운트다운
  const countdownDisplay = useSettlementCountdown(snapshot?.settlementCountdown ?? 0);

  // 국가별 지역 그룹핑
  const groupedByCountry = useMemo(() => {
    if (!snapshot) return new Map<string, ITerritoryRegionSnapshot[]>();

    const map = new Map<string, ITerritoryRegionSnapshot[]>();
    for (const region of snapshot.regions) {
      const existing = map.get(region.countryCode) || [];
      existing.push(region);
      map.set(region.countryCode, existing);
    }
    return map;
  }, [snapshot]);

  // 국가 주권 맵
  const sovereigntyMap = useMemo(() => {
    if (!snapshot) return new Map<string, ITerritorySovereigntySnapshot>();

    const map = new Map<string, ITerritorySovereigntySnapshot>();
    for (const country of snapshot.countries) {
      map.set(country.countryCode, country);
    }
    return map;
  }, [snapshot]);

  // 표시할 국가 목록 (선택된 국가 우선, 그 외 활동순)
  const sortedCountries = useMemo(() => {
    const countries = Array.from(groupedByCountry.entries()).map(([code, regions]) => ({
      code,
      regions,
      sovereignty: sovereigntyMap.get(code) || {
        countryCode: code,
        sovereigntyLevel: 'none' as SovereigntyLevel,
        streakDays: 0,
        allControlled: false,
      },
      totalRP: regions.reduce((sum, r) => {
        const rp = r.dailyRP || {};
        return sum + Object.values(rp).reduce((s, v) => s + v, 0);
      }, 0),
    }));

    // 정렬: 선택된 국가 → 주권 레벨 → 활동량
    countries.sort((a, b) => {
      if (selectedCountry) {
        if (a.code === selectedCountry) return -1;
        if (b.code === selectedCountry) return 1;
      }
      // 주권 레벨 우선
      const levelOrder: Record<SovereigntyLevel, number> = {
        hegemony: 3,
        sovereignty: 2,
        active_domination: 1,
        none: 0,
      };
      const aLevel = levelOrder[a.sovereignty.sovereigntyLevel] || 0;
      const bLevel = levelOrder[b.sovereignty.sovereigntyLevel] || 0;
      if (aLevel !== bLevel) return bLevel - aLevel;
      // 활동량
      return b.totalRP - a.totalRP;
    });

    return countries;
  }, [groupedByCountry, sovereigntyMap, selectedCountry]);

  // 데이터 없음
  if (!snapshot) {
    return (
      <McPanel accentColor={SK.gold}>
        <div style={{ textAlign: 'center', padding: '20px', color: SK.textMuted }}>
          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>
            TERRITORY STATUS
          </div>
          <div style={{ fontSize: '12px' }}>Loading territory data...</div>
        </div>
      </McPanel>
    );
  }

  return (
    <McPanel
      accentColor={SK.gold}
      style={{ maxHeight, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
    >
      {/* 헤더 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
          paddingBottom: '8px',
          borderBottom: sketchBorder(),
        }}
      >
        <div>
          <div
            style={{
              fontSize: '14px',
              fontWeight: 700,
              color: SK.textPrimary,
              fontFamily: '"Black Ops One", "Rajdhani", sans-serif',
              letterSpacing: '0.08em',
            }}
          >
            TERRITORY STATUS
          </div>
          <div style={{ fontSize: '11px', color: SK.textMuted, marginTop: '2px' }}>
            {snapshot.regions.length} regions across {snapshot.countries.length} countries
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: SK.textMuted,
              cursor: 'pointer',
              fontSize: '16px',
              padding: '4px',
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* 정산 타이머 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          backgroundColor: SK.bgWarm,
          border: sketchBorder(),
          marginBottom: '12px',
        }}
      >
        <div>
          <div style={{ fontSize: '10px', color: SK.textMuted, letterSpacing: '0.1em' }}>
            DAILY SETTLEMENT
          </div>
          <div
            style={{
              fontSize: '20px',
              fontWeight: 700,
              color: SK.gold,
              fontFamily: 'monospace',
              letterSpacing: '0.1em',
            }}
          >
            {countdownDisplay}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '10px', color: SK.textMuted }}>UTC 00:00</div>
          {snapshot.lastSettledAt && (
            <div style={{ fontSize: '10px', color: SK.textMuted }}>
              Last: {new Date(snapshot.lastSettledAt).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>

      {/* 국가/지역 목록 */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          paddingRight: '4px',
        }}
      >
        {sortedCountries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: SK.textMuted, fontSize: '12px' }}>
            No territory data available
          </div>
        ) : (
          sortedCountries.map(({ code, regions, sovereignty }) => (
            <CountryCard
              key={code}
              country={sovereignty}
              regions={regions}
              factionNames={factionNames}
              factionColors={factionColors}
            />
          ))
        )}
      </div>
    </McPanel>
  );
}

export default TerritoryPanel;
