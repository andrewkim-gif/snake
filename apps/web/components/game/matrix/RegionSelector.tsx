'use client';

/**
 * RegionSelector.tsx — v39 Phase 4: 지역 선택 UI
 *
 * 국가 진입 후 표시되는 지역 선택 패널.
 * 각 지역 카드: 지역명, 유형 아이콘, 주요 자원, 현재 접속 인원, 지배 팩션 표시.
 * 지역별 상태: open(입장 가능), full(만원), locked(잠김).
 *
 * UX Flow: 글로브 → 국가 클릭 → 국가 상세 패널 → "지역 선택" →
 *          RegionSelector가 지역 목록 표시 → 지역 선택 → 해당 지역 아레나 진입
 */

import { useState, useCallback, useMemo } from 'react';
import { SK, SKFont, headingFont, bodyFont, apexClip } from '@/lib/sketch-ui';
import { OVERLAY, overlayPanelStyle } from '@/lib/overlay-tokens';
import type { IRegionDef, RegionType, ResourceType, RegionState } from '@/lib/matrix/types/region';

// ── 타입 ──

/** 지역 목록 항목 — 서버에서 받는 region_list 데이터 */
export interface IRegionListEntry {
  regionId: string;
  name: string;
  nameEn: string;
  type: string;
  arenaSize: number;
  maxPlayers: number;
  currentPlayers: number;
  state: string;
  controllingFactionId?: string;
  controllingFactionColor?: string;
  controlStreak: number;
  primaryResource: string;
  specialtyResource: string;
  biome: string;
  specialEffect: string;
}

interface RegionSelectorProps {
  /** 국가 ISO3 코드 */
  countryCode: string;
  /** 국가 이름 */
  countryName: string;
  /** 서버에서 받은 지역 목록 (없으면 클라이언트 데이터 사용) */
  regions: IRegionListEntry[];
  /** 로딩 상태 */
  loading?: boolean;
  /** 지역 선택 시 콜백 */
  onSelectRegion: (regionId: string) => void;
  /** 뒤로가기 (국가 패널로 복귀) */
  onBack: () => void;
}

// ── 아이콘 매핑 (지역 유형 → 이모지) ──

const REGION_TYPE_ICONS: Record<string, string> = {
  capital: '🏛️',
  industrial: '🏭',
  port: '⚓',
  agricultural: '🌾',
  military: '🎖️',
  resource: '⛏️',
  cultural: '🏛️',
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

// ── 지역 상태 판정 ──

type RegionEntryState = 'open' | 'full' | 'locked';

function getEntryState(entry: IRegionListEntry): RegionEntryState {
  if (entry.state === 'idle' || entry.state === 'pve' || entry.state === 'br' || entry.state === 'settling') {
    if (entry.currentPlayers >= entry.maxPlayers) return 'full';
    return 'open';
  }
  return 'locked';
}

const ENTRY_STATE_STYLES: Record<RegionEntryState, { color: string; label: string; bg: string }> = {
  open: { color: SK.green, label: 'OPEN', bg: 'rgba(16, 185, 129, 0.12)' },
  full: { color: SK.orange, label: 'FULL', bg: 'rgba(245, 158, 11, 0.12)' },
  locked: { color: SK.textMuted, label: 'LOCKED', bg: 'rgba(85, 86, 94, 0.12)' },
};

// ── 지역 카드 컴포넌트 ──

function RegionCard({
  entry,
  onSelect,
}: {
  entry: IRegionListEntry;
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const entryState = getEntryState(entry);
  const stateStyle = ENTRY_STATE_STYLES[entryState];
  const isClickable = entryState === 'open';

  const typeIcon = REGION_TYPE_ICONS[entry.type] ?? '📍';
  const typeLabel = REGION_TYPE_LABELS[entry.type] ?? entry.type;
  const resourceIcon = RESOURCE_ICONS[entry.primaryResource] ?? '📦';

  return (
    <div
      onClick={isClickable ? onSelect : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered && isClickable
          ? SK.cardBgHover
          : SK.cardBg,
        border: `1px solid ${
          hovered && isClickable
            ? SK.accentBorder
            : SK.border
        }`,
        borderRadius: '0',
        clipPath: apexClip.sm,
        padding: '14px 16px',
        cursor: isClickable ? 'pointer' : 'not-allowed',
        opacity: entryState === 'locked' ? 0.5 : 1,
        transition: `all ${OVERLAY.transition}`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* 좌측 팩션 컬러 스트라이프 */}
      <div style={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: '3px',
        background: entry.controllingFactionColor || SK.textMuted,
      }} />

      {/* 헤더: 아이콘 + 이름 + 상태 뱃지 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '8px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>{typeIcon}</span>
          <div>
            <div style={{
              fontFamily: headingFont,
              fontSize: SKFont.body,
              color: SK.textPrimary,
              fontWeight: 600,
            }}>
              {entry.nameEn}
            </div>
            <div style={{
              fontFamily: bodyFont,
              fontSize: SKFont.xs,
              color: SK.textSecondary,
            }}>
              {entry.name}
            </div>
          </div>
        </div>

        {/* 상태 뱃지 */}
        <div style={{
          fontFamily: headingFont,
          fontSize: SKFont.xs,
          color: stateStyle.color,
          background: stateStyle.bg,
          padding: '2px 8px',
          border: `1px solid ${stateStyle.color}40`,
          letterSpacing: '1px',
        }}>
          {stateStyle.label}
        </div>
      </div>

      {/* 정보 행: 유형 | 자원 | 인원 */}
      <div style={{
        display: 'flex',
        gap: '16px',
        fontFamily: bodyFont,
        fontSize: SKFont.xs,
        color: SK.textSecondary,
      }}>
        {/* 유형 */}
        <span>{typeLabel}</span>

        {/* 주요 자원 */}
        <span>{resourceIcon} {entry.primaryResource}</span>

        {/* 접속 인원 */}
        <span style={{
          color: entry.currentPlayers > 0 ? SK.green : SK.textMuted,
        }}>
          👥 {entry.currentPlayers}/{entry.maxPlayers}
        </span>
      </div>

      {/* 지배 팩션 표시 */}
      {entry.controllingFactionId && (
        <div style={{
          marginTop: '6px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontFamily: bodyFont,
          fontSize: SKFont.xs,
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: entry.controllingFactionColor || SK.accent,
          }} />
          <span style={{ color: SK.textSecondary }}>
            Controlled
          </span>
          {entry.controlStreak > 1 && (
            <span style={{ color: SK.orange, marginLeft: '4px' }}>
              {entry.controlStreak}d streak
            </span>
          )}
        </div>
      )}

      {/* 특수 효과 */}
      {entry.specialEffect && (
        <div style={{
          marginTop: '4px',
          fontFamily: bodyFont,
          fontSize: SKFont.xs,
          color: SK.accentLight,
          fontStyle: 'italic',
        }}>
          {entry.specialEffect}
        </div>
      )}
    </div>
  );
}

// ── RegionSelector 메인 컴포넌트 ──

export default function RegionSelector({
  countryCode,
  countryName,
  regions,
  loading = false,
  onSelectRegion,
  onBack,
}: RegionSelectorProps) {
  // 지역 통계
  const stats = useMemo(() => {
    const totalPlayers = regions.reduce((sum, r) => sum + r.currentPlayers, 0);
    const openCount = regions.filter(r => getEntryState(r) === 'open').length;
    const controlledCount = regions.filter(r => r.controllingFactionId).length;
    return { totalPlayers, openCount, controlledCount };
  }, [regions]);

  const handleSelectRegion = useCallback((regionId: string) => {
    onSelectRegion(regionId);
  }, [onSelectRegion]);

  return (
    <div style={{
      ...overlayPanelStyle(),
      position: 'absolute',
      right: '16px',
      top: '80px',
      width: '380px',
      maxHeight: 'calc(100vh - 120px)',
      overflowY: 'auto',
      zIndex: 100,
      padding: '0',
    }}>
      {/* 헤더 */}
      <div style={{
        padding: '16px 20px',
        borderBottom: `1px solid ${SK.border}`,
        position: 'sticky',
        top: 0,
        background: OVERLAY.bg,
        backdropFilter: OVERLAY.blur,
        zIndex: 1,
      }}>
        {/* 뒤로가기 + 타이틀 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '8px',
        }}>
          <button
            onClick={onBack}
            style={{
              background: 'none',
              border: `1px solid ${SK.border}`,
              color: SK.textSecondary,
              fontFamily: bodyFont,
              fontSize: SKFont.sm,
              padding: '4px 8px',
              cursor: 'pointer',
              transition: `all ${OVERLAY.transition}`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = SK.textPrimary;
              e.currentTarget.style.borderColor = SK.accentBorder;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = SK.textSecondary;
              e.currentTarget.style.borderColor = SK.border;
            }}
          >
            {'<'} BACK
          </button>

          <div>
            <div style={{
              fontFamily: headingFont,
              fontSize: SKFont.h3,
              color: SK.textPrimary,
              letterSpacing: '1px',
            }}>
              {countryName}
            </div>
            <div style={{
              fontFamily: bodyFont,
              fontSize: SKFont.xs,
              color: SK.textSecondary,
              letterSpacing: '0.5px',
            }}>
              SELECT REGION TO ENTER
            </div>
          </div>
        </div>

        {/* 통계 행 */}
        <div style={{
          display: 'flex',
          gap: '16px',
          fontFamily: bodyFont,
          fontSize: SKFont.xs,
          color: SK.textMuted,
        }}>
          <span>
            <span style={{ color: SK.green }}>{stats.openCount}</span> open
          </span>
          <span>
            <span style={{ color: SK.textSecondary }}>{stats.totalPlayers}</span> players
          </span>
          <span>
            <span style={{ color: SK.accent }}>{stats.controlledCount}</span> controlled
          </span>
        </div>

        {/* 악센트 라인 */}
        <div style={{
          height: '1px',
          background: `linear-gradient(to right, ${SK.accent}, transparent)`,
          marginTop: '12px',
        }} />
      </div>

      {/* 지역 카드 목록 */}
      <div style={{
        padding: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}>
        {loading ? (
          <div style={{
            padding: '40px 0',
            textAlign: 'center',
            fontFamily: bodyFont,
            fontSize: SKFont.sm,
            color: SK.textMuted,
          }}>
            Loading regions...
          </div>
        ) : regions.length === 0 ? (
          <div style={{
            padding: '40px 0',
            textAlign: 'center',
            fontFamily: bodyFont,
            fontSize: SKFont.sm,
            color: SK.textMuted,
          }}>
            No regions available
          </div>
        ) : (
          regions.map((entry) => (
            <RegionCard
              key={entry.regionId}
              entry={entry}
              onSelect={() => handleSelectRegion(entry.regionId)}
            />
          ))
        )}
      </div>
    </div>
  );
}
