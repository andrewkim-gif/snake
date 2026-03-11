'use client';

/**
 * TerritoryPanel.tsx -- v39 Phase 7: 영토 지배 현황 패널
 *
 * 팩션 영토 현황, 지배 지역 목록, 경쟁 상태 표시.
 * 로비 또는 게임 내에서 사이드 패널로 표시.
 *
 * Canvas 위 React DOM 오버레이 (position: absolute).
 */

import { memo, useMemo } from 'react';
import type {
  ITerritorySnapshot,
  ITerritoryRegionSnapshot,
  ITerritorySovereigntySnapshot,
  SovereigntyLevel,
} from '@/lib/matrix/types/region';
import { SOVEREIGNTY_DISPLAY } from '@/lib/matrix/types/region';

// -- 폰트 --
const DISPLAY_FONT = '"Ethnocentric", "Black Ops One", "Chakra Petch", monospace';
const BODY_FONT = '"ITC Avant Garde Gothic", "Rajdhani", "Space Grotesk", sans-serif';

// -- Props --

export interface TerritoryPanelProps {
  /** 영토 스냅샷 데이터 */
  snapshot: ITerritorySnapshot | null;
  /** 현재 국가 코드 (필터링용) */
  countryCode?: string;
  /** 현재 유저의 팩션 ID */
  myFactionId?: string;
  /** 패널 표시 여부 */
  visible: boolean;
  /** 닫기 콜백 */
  onClose?: () => void;
}

// -- 주권 레벨 색상 조회 --
function getSovereigntyColor(level: SovereigntyLevel): string {
  return SOVEREIGNTY_DISPLAY[level]?.color ?? '#666666';
}

function getSovereigntyLabel(level: SovereigntyLevel): string {
  return SOVEREIGNTY_DISPLAY[level]?.labelKo ?? '중립';
}

// -- 지역 행 컴포넌트 --
const RegionRow = memo(function RegionRow({
  region,
  isMyFaction,
}: {
  region: ITerritoryRegionSnapshot;
  isMyFaction: boolean;
}) {
  const borderColor = region.controllerColor ?? '#333';
  const sovColor = getSovereigntyColor(region.sovereigntyLevel);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 10px',
        borderLeft: `3px solid ${borderColor}`,
        background: isMyFaction ? 'rgba(255,255,255,0.05)' : 'transparent',
        borderRadius: 4,
        marginBottom: 4,
        fontFamily: BODY_FONT,
        fontSize: 13,
      }}
    >
      <span style={{ color: '#E8E0D4' }}>{region.regionId}</span>
      <span
        style={{
          color: sovColor,
          fontSize: 11,
          fontWeight: 600,
        }}
      >
        {getSovereigntyLabel(region.sovereigntyLevel)}
        {region.controlStreak > 0 && ` (${region.controlStreak}d)`}
      </span>
    </div>
  );
});

// -- 국가 주권 행 컴포넌트 --
const SovereigntyRow = memo(function SovereigntyRow({
  sov,
}: {
  sov: ITerritorySovereigntySnapshot;
}) {
  const sovColor = getSovereigntyColor(sov.sovereigntyLevel);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 10px',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: 4,
        marginBottom: 4,
        fontFamily: BODY_FONT,
        fontSize: 13,
      }}
    >
      <span style={{ color: '#E8E0D4', fontWeight: 600 }}>{sov.countryCode}</span>
      <span style={{ color: sovColor, fontSize: 11 }}>
        {getSovereigntyLabel(sov.sovereigntyLevel)}
        {sov.allControlled && ' (Unified)'}
      </span>
    </div>
  );
});

// -- 메인 컴포넌트 --
function TerritoryPanelInner({
  snapshot,
  countryCode,
  myFactionId,
  visible,
  onClose,
}: TerritoryPanelProps) {
  // 국가별 필터링
  const filteredRegions = useMemo(() => {
    if (!snapshot) return [];
    if (!countryCode) return snapshot.regions;
    return snapshot.regions.filter((r) => r.countryCode === countryCode);
  }, [snapshot, countryCode]);

  const filteredCountries = useMemo(() => {
    if (!snapshot) return [];
    if (!countryCode) return snapshot.countries;
    return snapshot.countries.filter((c) => c.countryCode === countryCode);
  }, [snapshot, countryCode]);

  if (!visible || !snapshot) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 60,
        right: 16,
        width: 280,
        maxHeight: 'calc(100vh - 120px)',
        background: 'rgba(17,17,17,0.95)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8,
        padding: 16,
        overflowY: 'auto',
        zIndex: 100,
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* 헤더 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <h3
          style={{
            fontFamily: DISPLAY_FONT,
            fontSize: 14,
            color: '#CC9933',
            margin: 0,
            letterSpacing: '0.05em',
          }}
        >
          TERRITORY STATUS
        </h3>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#999',
              cursor: 'pointer',
              fontSize: 16,
              padding: '2px 6px',
            }}
          >
            x
          </button>
        )}
      </div>

      {/* 정산 카운트다운 */}
      {snapshot.settlementCountdown > 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '6px 0',
            marginBottom: 12,
            borderTop: '1px solid rgba(255,255,255,0.05)',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            fontFamily: BODY_FONT,
            fontSize: 11,
            color: '#999',
          }}
        >
          Next Settlement:{' '}
          <span style={{ color: '#FBBF24', fontWeight: 600 }}>
            {Math.floor(snapshot.settlementCountdown / 3600)}h{' '}
            {Math.floor((snapshot.settlementCountdown % 3600) / 60)}m
          </span>
        </div>
      )}

      {/* 지역 목록 */}
      {filteredRegions.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h4
            style={{
              fontFamily: DISPLAY_FONT,
              fontSize: 11,
              color: '#999',
              margin: '0 0 8px 0',
              letterSpacing: '0.1em',
            }}
          >
            REGIONS ({filteredRegions.length})
          </h4>
          {filteredRegions.map((region) => (
            <RegionRow
              key={region.regionId}
              region={region}
              isMyFaction={region.controllerFaction === myFactionId}
            />
          ))}
        </div>
      )}

      {/* 국가 주권 */}
      {filteredCountries.length > 0 && (
        <div>
          <h4
            style={{
              fontFamily: DISPLAY_FONT,
              fontSize: 11,
              color: '#999',
              margin: '0 0 8px 0',
              letterSpacing: '0.1em',
            }}
          >
            SOVEREIGNTY
          </h4>
          {filteredCountries.map((sov) => (
            <SovereigntyRow key={sov.countryCode} sov={sov} />
          ))}
        </div>
      )}

      {/* 빈 상태 */}
      {filteredRegions.length === 0 && filteredCountries.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            color: '#666',
            fontFamily: BODY_FONT,
            fontSize: 13,
            padding: '20px 0',
          }}
        >
          No territory data available
        </div>
      )}
    </div>
  );
}

export const TerritoryPanel = memo(TerritoryPanelInner);
export default TerritoryPanel;
