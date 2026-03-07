'use client';

/**
 * WorldView — 글로브 뷰 (항상 GlobeView 렌더링)
 * v15: viewMode 제거, 2D 맵 제거
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { SK, bodyFont } from '@/lib/sketch-ui';
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

interface WorldViewProps {
  countryStates?: Map<string, CountryClientState>;
  onEnterArena?: (iso3: string) => void;
  onSpectate?: (iso3: string) => void;
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
}

export function WorldView({
  countryStates,
  onEnterArena,
  onSpectate,
  bottomOffset = 0,
  style,
  dominationStates,
  wars,
  tradeRoutes,
  globalEvents,
}: WorldViewProps) {
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [fallbackStates, setFallbackStates] = useState<Map<string, CountryClientState>>(new Map());

  // v14: Hover state for GlobeHoverPanel
  const [hoverData, setHoverData] = useState<GlobeHoverData | null>(null);
  const [hoverMouse, setHoverMouse] = useState({ x: 0, y: 0 });
  const [hoverVisible, setHoverVisible] = useState(false);

  // v14: Track mouse position for hover panel
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setHoverMouse({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // 서버 데이터 없으면 GeoJSON에서 fallback 국가 데이터 생성
  useEffect(() => {
    if (countryStates && countryStates.size > 0) return;
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
  }, [countryStates]);

  const states = useMemo(
    () => (countryStates && countryStates.size > 0) ? countryStates : fallbackStates,
    [countryStates, fallbackStates],
  );

  const handleCountryClick = useCallback((iso3: string, _name: string) => {
    setSelectedCountry(iso3);
    setPanelOpen(true);
  }, []);

  const handleClosePanel = useCallback(() => {
    setPanelOpen(false);
    setTimeout(() => setSelectedCountry(null), 300);
  }, []);

  // v14: Globe hover → GlobeHoverPanel data
  const handleGlobeHover = useCallback((iso3: string | null, name: string | null) => {
    if (!iso3 || !name) {
      setHoverVisible(false);
      return;
    }
    const cs = states.get(iso3);
    const domState = dominationStates?.get(iso3);
    setHoverData({
      countryCode: iso3,
      countryName: cs?.name ?? name,
      happiness: 50,  // placeholder until civilization system sends data
      gdp: cs?.gdp ?? 0,
      militaryPower: 50,
      population: 0,
      atWar: false,
      hasSovereignty: domState?.level === 'sovereignty' || domState?.level === 'hegemony',
      hasHegemony: domState?.level === 'hegemony',
      activeAgents: cs?.activeAgents ?? 0,
      dominantNation: domState?.dominantNation,
    });
    setHoverVisible(true);
  }, [states, dominationStates]);

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
        />
      </div>

      {/* 하단 범례 */}
      <div style={{
        position: 'absolute',
        bottom: bottomOffset,
        left: 0,
        right: 0,
        padding: '12px 20px',
        display: 'flex',
        justifyContent: 'center',
        gap: '16px',
        zIndex: 50,
        background: 'linear-gradient(to top, rgba(9,9,11,0.8) 0%, transparent 100%)',
        pointerEvents: 'none',
      }}>
        {[
          { color: '#22C55E', label: 'MY FACTION' },
          { color: '#3B82F6', label: 'ALLY' },
          { color: '#F59E0B', label: 'NEUTRAL' },
          { color: '#EF4444', label: 'ENEMY' },
          { color: '#3D7A9E', label: 'UNCLAIMED' },
        ].map(({ color, label }) => (
          <div
            key={label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '2px',
              backgroundColor: color,
              border: '1px solid rgba(255,255,255,0.08)',
            }} />
            <span style={{
              fontFamily: bodyFont,
              fontSize: '9px',
              color: SK.textMuted,
              letterSpacing: '1px',
              fontWeight: 600,
            }}>
              {label}
            </span>
          </div>
        ))}
      </div>

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
      />

      {/* 국가 상세 패널 */}
      <CountryPanel
        country={selectedCountryData}
        open={panelOpen}
        onClose={handleClosePanel}
        onEnterArena={onEnterArena}
        onSpectate={onSpectate}
      />
    </div>
  );
}
