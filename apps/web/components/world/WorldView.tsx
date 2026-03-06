'use client';

/**
 * WorldView — Globe ↔ Map 전환 뷰
 * S09: 줌 레벨 기반 3D Globe ↔ 2D Map 전환, 스무스 fade 애니메이션, 상태 동기화
 */

import { useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { McButton } from '@/components/lobby/McButton';
import { SK, SKFont, headingFont, bodyFont } from '@/lib/sketch-ui';
import type { CountryClientState } from '@/lib/globe-data';

// SSR 비활성화 (WebGL 컴포넌트)
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

type ViewMode = 'globe' | 'map';

interface WorldViewProps {
  countryStates?: Map<string, CountryClientState>;
  onEnterArena?: (iso3: string) => void;
  onSpectate?: (iso3: string) => void;
  style?: React.CSSProperties;
}

export function WorldView({
  countryStates,
  onEnterArena,
  onSpectate,
  style,
}: WorldViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('globe');
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  // 기본 country states (서버 연결 전 fallback)
  const states = useMemo(() => countryStates || new Map(), [countryStates]);

  // 국가 클릭 핸들러
  const handleCountryClick = useCallback((iso3: string, _name: string) => {
    setSelectedCountry(iso3);
    setPanelOpen(true);
  }, []);

  // 패널 닫기
  const handleClosePanel = useCallback(() => {
    setPanelOpen(false);
    // 패널 닫힌 후 선택 해제
    setTimeout(() => setSelectedCountry(null), 300);
  }, []);

  // 뷰 전환 (fade 애니메이션)
  const handleToggleView = useCallback(() => {
    setTransitioning(true);
    setTimeout(() => {
      setViewMode((prev) => (prev === 'globe' ? 'map' : 'globe'));
      setTimeout(() => setTransitioning(false), 100);
    }, 200);
  }, []);

  // 선택된 국가 데이터
  const selectedCountryData = selectedCountry
    ? states.get(selectedCountry) || null
    : null;

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      background: '#0A0E14',
      overflow: 'hidden',
      ...style,
    }}>
      {/* Globe/Map 컨테이너 */}
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
            autoRotate={!panelOpen}
          />
        ) : (
          <WorldMap
            countryStates={states}
            selectedCountry={selectedCountry}
            onCountryClick={handleCountryClick}
          />
        )}
      </div>

      {/* 상단 HUD */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        padding: '16px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 50,
        background: 'linear-gradient(to bottom, rgba(10,14,20,0.8) 0%, transparent 100%)',
        pointerEvents: 'none',
      }}>
        {/* 타이틀 */}
        <div style={{ pointerEvents: 'auto' }}>
          <div style={{
            fontFamily: headingFont,
            fontSize: SKFont.h2,
            color: SK.textPrimary,
            letterSpacing: '3px',
          }}>
            AI WORLD WAR
          </div>
          <div style={{
            fontFamily: bodyFont,
            fontSize: SKFont.xs,
            color: SK.textMuted,
            letterSpacing: '1px',
            marginTop: '2px',
          }}>
            v11.0 ALPHA
          </div>
        </div>

        {/* 뷰 전환 버튼 */}
        <div style={{ pointerEvents: 'auto' }}>
          <McButton
            variant="default"
            onClick={handleToggleView}
            style={{
              fontSize: SKFont.xs,
              padding: '8px 16px',
              minHeight: 'auto',
            }}
          >
            {viewMode === 'globe' ? '2D MAP' : '3D GLOBE'}
          </McButton>
        </div>
      </div>

      {/* 하단 범례 */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '12px 20px',
        display: 'flex',
        justifyContent: 'center',
        gap: '16px',
        zIndex: 50,
        background: 'linear-gradient(to top, rgba(10,14,20,0.8) 0%, transparent 100%)',
        pointerEvents: 'none',
      }}>
        {[
          { color: '#22C55E', label: 'MY FACTION' },
          { color: '#3B82F6', label: 'ALLY' },
          { color: '#F59E0B', label: 'NEUTRAL' },
          { color: '#EF4444', label: 'ENEMY' },
          { color: '#4A4A4A', label: 'UNCLAIMED' },
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
              width: '10px',
              height: '10px',
              borderRadius: '2px',
              backgroundColor: color,
              border: '1px solid rgba(255,255,255,0.1)',
            }} />
            <span style={{
              fontFamily: bodyFont,
              fontSize: '10px',
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
