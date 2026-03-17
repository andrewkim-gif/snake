'use client';

/**
 * WorldView — 글로브 뷰 (항상 GlobeView 렌더링)
 * v15: viewMode 제거, 2D 맵 제거
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { SK, bodyFont } from '@/lib/sketch-ui';
import { GlobeLoadingScreen } from '@/components/lobby/GlobeLoadingScreen';
import type { CountryClientState } from '@/lib/globe-data';
import { loadGeoJSON, featureToCountryState } from '@/lib/globe-data';

// v14: Globe hover info panel
import { GlobeHoverPanel } from '@/components/3d/GlobeHoverPanel';
import type { GlobeHoverData } from '@/components/3d/GlobeHoverPanel';

const GlobeView = dynamic(
  () => import('@/components/lobby/GlobeView').then((m) => ({ default: m.GlobeView })),
  { ssr: false },
);
const CountryPanel = dynamic(
  () => import('@/components/world/CountryPanel').then((m) => ({ default: m.CountryPanel })),
  { ssr: false },
);

// v14: Globe domination + war effects types
import type { CountryDominationState } from '@/components/3d/GlobeDominationLayer';
import type { WarEffectData } from '@/components/3d/GlobeWarEffects';

// v15 Phase 5: Trade routes + global events
import type { TradeRouteData } from '@/hooks/useSocket';
import type { GlobalEventData } from '@/components/3d/GlobeEventPulse';

// v23 Phase 5: 신규 이벤트 타입
import type { AllianceData } from '@/components/3d/GlobeAllianceBeam';
import type { SanctionData } from '@/components/3d/GlobeSanctionBarrier';
import type { ResourceData } from '@/components/3d/GlobeResourceGlow';
import type { SpyOpData } from '@/components/3d/GlobeSpyTrail';
import type { NukeData } from '@/components/3d/GlobeNukeEffect';

// v39 Phase 4: Region data for hover panel
import { getCountryTier } from '@/lib/matrix/data/country-tiers';
import { TIER_CONFIG } from '@/lib/matrix/types/region';

interface WorldViewProps {
  countryStates?: Map<string, CountryClientState>;
  onEnterArena?: (iso3: string) => void;
  onSpectate?: (iso3: string) => void;
  /** v29b: Globe → Matrix 게임 진입 콜백 */
  onManageCountry?: (iso3: string, name: string) => void;
  /** v41 Phase 2: 지역 클릭 → 즉시 matrix 진입 콜백 (국가 iso3 + name 포함) */
  onRegionSelect?: (regionId: string, countryIso3: string, countryName: string) => void;
  bottomOffset?: number;
  style?: React.CSSProperties;
  /** v14: Domination state overlay for globe countries */
  dominationStates?: Map<string, CountryDominationState>;
  /** v14: Active war effects for globe */
  wars?: WarEffectData[];
  /** v15 Phase 5: Trade routes for globe visualization */
  tradeRoutes?: TradeRouteData[];
  /** v15 Phase 5: Global events for pulse effects */
  globalEvents?: GlobalEventData[];
  /** v17: 인트로 카메라 애니메이션 활성화 */
  introActive?: boolean;
  /** v17: 인트로 카메라 완료 콜백 */
  onIntroComplete?: () => void;
  /** v17: ISO3 set of countries with active conflicts */
  activeConflictCountries?: Set<string>;
  /** v23 Phase 5: 동맹 이벤트 */
  alliances?: AllianceData[];
  /** v23 Phase 5: 제재 이벤트 */
  sanctions?: SanctionData[];
  /** v23 Phase 5: 자원 채굴 이벤트 */
  resources?: ResourceData[];
  /** v23 Phase 5: 첩보 이벤트 */
  spyOps?: SpyOpData[];
  /** v23 Phase 5: 핵실험 이벤트 */
  nukes?: NukeData[];
  /** v37: 인게임 중 Globe 렌더링 일시정지 */
  paused?: boolean;
}

export function WorldView({
  countryStates,
  onEnterArena,
  onSpectate,
  onManageCountry,
  onRegionSelect,
  bottomOffset = 0,
  style,
  dominationStates,
  wars,
  tradeRoutes,
  globalEvents,
  introActive,
  onIntroComplete,
  activeConflictCountries,
  alliances,
  sanctions,
  resources,
  spyOps,
  nukes,
  paused,
}: WorldViewProps) {
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [fallbackStates, setFallbackStates] = useState<Map<string, CountryClientState>>(new Map());
  // v47: COBE 스타일 dotted globe 토글
  const [dottedMode, setDottedMode] = useState(false);

  // 3D Globe 로딩 상태
  const [globeReady, setGlobeReady] = useState(false);
  const [loadingDismissed, setLoadingDismissed] = useState(false);
  const handleGlobeReady = useCallback(() => setGlobeReady(true), []);
  const handleLoadingFadeComplete = useCallback(() => setLoadingDismissed(true), []);

  // v14: Hover state for GlobeHoverPanel
  const [hoverData, setHoverData] = useState<GlobeHoverData | null>(null);
  // v19 PERF: 마우스 위치를 ref로 추적 (매 이동마다 setState → re-render 방지)
  const hoverMouseRef = useRef({ x: 0, y: 0 });
  const [hoverMouse, setHoverMouse] = useState({ x: 0, y: 0 });
  const [hoverVisible, setHoverVisible] = useState(false);

  // v14: Track mouse position for hover panel — throttled setState
  useEffect(() => {
    let rafId = 0;
    let dirty = false;
    const handleMouseMove = (e: MouseEvent) => {
      hoverMouseRef.current.x = e.clientX;
      hoverMouseRef.current.y = e.clientY;
      if (!dirty) {
        dirty = true;
        rafId = requestAnimationFrame(() => {
          setHoverMouse({ x: hoverMouseRef.current.x, y: hoverMouseRef.current.y });
          dirty = false;
        });
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(rafId);
    };
  }, []);

  // GeoJSON에서 기본 국가 데이터 항상 로드 (이름, 좌표, 리소스 등 정적 필드)
  useEffect(() => {
    loadGeoJSON().then((data) => {
      const map = new Map<string, CountryClientState>();
      data.features
        .filter((f) => f.geometry.type !== 'Point')
        .forEach((f) => {
          const state = featureToCountryState(f);
          if (state.iso3 && state.iso3 !== 'Unknown') {
            map.set(state.iso3, state);
          }
        });
      setFallbackStates(map);
    }).catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // GeoJSON 기반 + 서버 동적 데이터 병합
  const states = useMemo(() => {
    // fallback이 아직 로드 안 됐으면 서버 데이터라도 사용
    if (fallbackStates.size === 0) {
      return countryStates ?? new Map<string, CountryClientState>();
    }
    // 서버 데이터가 없으면 fallback만 사용
    if (!countryStates || countryStates.size === 0) {
      return fallbackStates;
    }
    // 병합: GeoJSON 정적 데이터 기반 + 서버 동적 필드 덮어쓰기
    const merged = new Map(fallbackStates);
    for (const [iso3, serverState] of countryStates) {
      const base = merged.get(iso3);
      if (base) {
        // 정적 필드(name, continent, resources, lat/lng 등)는 GeoJSON 유지
        // 동적 필드(battleStatus, activeAgents, sovereignFaction 등)만 서버에서 업데이트
        merged.set(iso3, {
          ...base,
          battleStatus: serverState.battleStatus,
          activeAgents: serverState.activeAgents,
          sovereignFaction: serverState.sovereignFaction,
          sovereigntyLevel: serverState.sovereigntyLevel,
          maxAgents: serverState.maxAgents || base.maxAgents,
          population: serverState.population || base.population,
        });
      } else {
        merged.set(iso3, serverState);
      }
    }
    return merged;
  }, [countryStates, fallbackStates]);

  const handleCountryClick = useCallback((iso3: string, _name: string) => {
    setSelectedCountry(iso3);
    setPanelOpen(true);
  }, []);

  const handleClosePanel = useCallback(() => {
    setPanelOpen(false);
    setTimeout(() => setSelectedCountry(null), 300);
  }, []);

  // v19 PERF: refs로 안정적 콜백 유지 (states/dominationStates 변경 시 콜백 재생성 방지 → 무한 루프 차단)
  const statesRef = useRef(states);
  statesRef.current = states;
  const domStatesRef = useRef(dominationStates);
  domStatesRef.current = dominationStates;

  // v14: Globe hover → GlobeHoverPanel data
  // v25 fix: 동일 국가 재호버 시 setState 스킵 (무한 re-render 방지)
  const lastHoverIsoRef = useRef<string | null>(null);
  const handleGlobeHover = useCallback((iso3: string | null, name: string | null) => {
    if (!iso3 || !name) {
      if (lastHoverIsoRef.current !== null) {
        lastHoverIsoRef.current = null;
        setHoverVisible(false);
      }
      return;
    }
    // 같은 국가면 setState 스킵
    if (iso3 === lastHoverIsoRef.current) return;
    lastHoverIsoRef.current = iso3;

    const cs = statesRef.current.get(iso3);
    const domState = domStatesRef.current?.get(iso3);
    // v39 Phase 4: 국가 티어 기반 지역 수 계산
    const tier = getCountryTier(iso3);
    const tierCfg = TIER_CONFIG[tier];

    setHoverData({
      countryCode: iso3,
      countryName: cs?.name ?? name,
      happiness: 0,       // TODO: awaiting civilization system (not yet in CountryClientState)
      gdp: cs?.gdp ?? 0,
      militaryPower: 0,   // TODO: awaiting civilization system (not yet in CountryClientState)
      population: cs?.population ?? 0,
      atWar: false,       // TODO: derive from battleStatus once war system is live
      hasSovereignty: domState?.level === 'sovereignty' || domState?.level === 'hegemony',
      hasHegemony: domState?.level === 'hegemony',
      activeAgents: cs?.activeAgents ?? 0,
      dominantNation: domState?.dominantNation,
      // v39 Phase 4: Region info
      regionCount: tierCfg.regionCount,
      controlledRegionCount: 0, // TODO: 실시간 지배 현황은 서버 연동 후 적용
      countryTier: tier,
    });
    setHoverVisible(true);
  }, []);

  const selectedCountryData = selectedCountry
    ? states.get(selectedCountry) || null
    : null;

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      background: '#09090B',
      overflow: 'hidden',
      ...style,
    }}>
      {/* Globe — always rendered */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <GlobeView
          countryStates={states}
          selectedCountry={selectedCountry}
          onCountryClick={handleCountryClick}
          dominationStates={dominationStates}
          wars={wars}
          onHover={handleGlobeHover}
          tradeRoutes={tradeRoutes}
          globalEvents={globalEvents}
          introActive={introActive}
          onIntroComplete={onIntroComplete}
          activeConflictCountries={activeConflictCountries}
          alliances={alliances}
          sanctions={sanctions}
          resources={resources}
          spyOps={spyOps}
          nukes={nukes}
          onReady={handleGlobeReady}
          paused={paused}
          dottedMode={dottedMode}
        />
      </div>

      {/* v47: Dotted globe 토글 버튼 — 우상단 버튼 그룹(zIndex 70) 아래 배치 */}
      <button
        onClick={() => setDottedMode((prev) => !prev)}
        style={{
          position: 'absolute',
          top: 56,
          right: 16,
          zIndex: 30,
          width: 36,
          height: 36,
          borderRadius: 0,
          border: `1px solid ${dottedMode ? 'rgba(99, 102, 241, 0.5)' : 'rgba(255, 255, 255, 0.1)'}`,
          background: dottedMode ? 'rgba(99, 102, 241, 0.2)' : 'rgba(9, 9, 11, 0.6)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 200ms ease',
          color: dottedMode ? '#a5b4fc' : '#8B8D98',
          fontSize: 18,
          padding: 0,
          boxShadow: dottedMode ? '0 0 12px rgba(99, 102, 241, 0.3)' : 'none',
        }}
        title={dottedMode ? 'Switch to Realistic' : 'Switch to Dotted'}
        onMouseEnter={(e) => {
          if (!dottedMode) {
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
          }
        }}
        onMouseLeave={(e) => {
          if (!dottedMode) {
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            e.currentTarget.style.background = 'rgba(9, 9, 11, 0.6)';
          }
        }}
      >
        {dottedMode ? '●' : '◐'}
      </button>

      {/* 3D 로딩 스크린 */}
      {!loadingDismissed && (
        <GlobeLoadingScreen
          ready={globeReady}
          onFadeComplete={handleLoadingFadeComplete}
        />
      )}

      {/* 하단 범례 — 삭제됨 (v17) */}

      {/* v14: GlobeHoverPanel — 마우스 호버 시 국가 정보 패널 */}
      <GlobeHoverPanel
        data={hoverData}
        mouseX={hoverMouse.x}
        mouseY={hoverMouse.y}
        visible={hoverVisible && !panelOpen}
        onClickEnter={(iso3) => {
          setHoverVisible(false);
          onEnterArena?.(iso3);
        }}
        onClickManage={(iso3) => {
          setHoverVisible(false);
          // v41: 호버 패널에서 "Manage" 클릭 시 CountryPanel 열기 (지역맵 통합됨)
          handleCountryClick(iso3, iso3);
        }}
      />

      {/* 국가 상세 패널 */}
      <CountryPanel
        country={selectedCountryData}
        open={panelOpen}
        onClose={handleClosePanel}
        onEnterArena={onEnterArena}
        onSpectate={onSpectate}
        onManageCountry={(iso3) => {
          const cs = statesRef.current.get(iso3);
          onManageCountry?.(iso3, cs?.name ?? iso3);
        }}
        onRegionSelect={onRegionSelect ? (regionId: string) => {
          // v41: 국가 정보와 함께 page.tsx에 전달
          const cs = selectedCountry ? statesRef.current.get(selectedCountry) : null;
          onRegionSelect(regionId, selectedCountry ?? '', cs?.name ?? selectedCountry ?? '');
        } : undefined}
      />
    </div>
  );
}
