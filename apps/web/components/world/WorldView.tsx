'use client';

/**
 * WorldView — Globe ↔ Map 전환 뷰
 * v12: viewMode를 외부에서 제어, 자체 HUD 제거 (LobbyHeader로 통합)
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { SK, bodyFont } from '@/lib/sketch-ui';
import type { CountryClientState } from '@/lib/globe-data';
import { loadGeoJSON, featureToCountryState } from '@/lib/globe-data';
import { getCountryISO } from '@/lib/map-style';

const WorldMap = dynamic(
  () => import('@/components/world/WorldMap').then((m) => ({ default: m.WorldMap })),
  { ssr: false },
);
const GlobeView = dynamic(
  () => import('@/components/lobby/GlobeView').then((m) => ({ default: m.GlobeView })),
  { ssr: false },
);
const CountryPanel = dynamic(
  () => import('@/components/world/CountryPanel').then((m) => ({ default: m.CountryPanel })),
  { ssr: false },
);

interface WorldViewProps {
  countryStates?: Map<string, CountryClientState>;
  viewMode: 'globe' | 'map';
  onEnterArena?: (iso3: string) => void;
  onSpectate?: (iso3: string) => void;
  bottomOffset?: number;
  style?: React.CSSProperties;
}

export function WorldView({
  countryStates,
  viewMode,
  onEnterArena,
  onSpectate,
  bottomOffset = 0,
  style,
}: WorldViewProps) {
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [fallbackStates, setFallbackStates] = useState<Map<string, CountryClientState>>(new Map());

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
      {/* Globe/Map */}
      <div style={{
        position: 'absolute',
        inset: 0,
        opacity: transitioning ? 0 : 1,
        transition: 'opacity 200ms ease',
      }}>
        {viewMode === 'globe' ? (
          <GlobeView
            countryStates={states}
            selectedCountry={selectedCountry}
            onCountryClick={handleCountryClick}
          />
        ) : (
          <WorldMap
            countryStates={states}
            selectedCountry={selectedCountry}
            onCountryClick={handleCountryClick}
          />
        )}
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
