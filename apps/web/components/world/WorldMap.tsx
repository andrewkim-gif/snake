'use client';

/**
 * WorldMap — MapLibre GL 2D 세계지도
 * S06: 다크 테마 + GeoJSON 국가 경계 + 호버/클릭 이펙트 + 지배 색상
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { sovereigntyColors, getCountryISO, getCountryName } from '@/lib/map-style';
import type { CountryClientState } from '@/lib/globe-data';

// MapLibre GL은 SSR 불가하므로 dynamic import에서 사용
let maplibregl: typeof import('maplibre-gl') | null = null;

interface WorldMapProps {
  countryStates?: Map<string, CountryClientState>;
  selectedCountry?: string | null;
  onCountryClick?: (iso3: string, name: string) => void;
  onCountryHover?: (iso3: string | null, name: string | null) => void;
  style?: React.CSSProperties;
}

// placeholder — will be set below
type MapInstance = InstanceType<typeof import('maplibre-gl').Map>;

export function WorldMap({
  countryStates,
  selectedCountry,
  onCountryClick,
  onCountryHover,
  style,
}: WorldMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapInstance | null>(null);
  const hoveredIdRef = useRef<number | null>(null);
  const selectedIdRef = useRef<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    name: string;
    iso3: string;
    tier?: string;
    status?: string;
  } | null>(null);

  // MapLibre 초기화
  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;

    (async () => {
      // Dynamic import (SSR 방지)
      const ml = await import('maplibre-gl');
      maplibregl = ml;
      if (cancelled) return;

      const map = new ml.Map({
        container: containerRef.current!,
        style: {
          version: 8,
          name: 'AI World War Dark',
          sources: {},
          layers: [
            {
              id: 'background',
              type: 'background',
              paint: { 'background-color': '#0A0E14' },
            },
          ],
        },
        center: [20, 20],
        zoom: 1.5,
        minZoom: 1,
        maxZoom: 8,
        attributionControl: false,
      });

      mapRef.current = map;

      map.on('load', () => {
        if (cancelled) return;

        // GeoJSON 소스 추가
        map.addSource('countries', {
          type: 'geojson',
          data: '/data/countries.geojson',
          generateId: true,
        });

        // 국가 fill 레이어
        map.addLayer({
          id: 'country-fill',
          type: 'fill',
          source: 'countries',
          paint: {
            'fill-color': sovereigntyColors.unclaimed,
            'fill-opacity': 0.55,
          },
        });

        // 국가 경계선
        map.addLayer({
          id: 'country-borders',
          type: 'line',
          source: 'countries',
          paint: {
            'line-color': '#1E293B',
            'line-width': 0.8,
            'line-opacity': 0.7,
          },
        });

        // 호버 하이라이트
        map.addLayer({
          id: 'country-hover',
          type: 'fill',
          source: 'countries',
          paint: {
            'fill-color': '#FFFFFF',
            'fill-opacity': [
              'case',
              ['boolean', ['feature-state', 'hover'], false],
              0.15,
              0,
            ],
          },
        });

        // 선택된 국가 보더
        map.addLayer({
          id: 'country-selected',
          type: 'line',
          source: 'countries',
          paint: {
            'line-color': '#FFFFFF',
            'line-width': [
              'case',
              ['boolean', ['feature-state', 'selected'], false],
              2.5,
              0,
            ],
            'line-opacity': 0.9,
          },
        });

        setLoaded(true);
      });

      // 호버 이벤트
      map.on('mousemove', 'country-fill', (e) => {
        if (!e.features || e.features.length === 0) return;

        const feature = e.features[0];
        const fid = feature.id as number;
        const props = feature.properties || {};
        const iso3 = getCountryISO(props);
        const name = getCountryName(props);

        // 이전 호버 해제
        if (hoveredIdRef.current !== null && hoveredIdRef.current !== fid) {
          map.setFeatureState(
            { source: 'countries', id: hoveredIdRef.current },
            { hover: false },
          );
        }

        // 새 호버
        hoveredIdRef.current = fid;
        map.setFeatureState({ source: 'countries', id: fid }, { hover: true });

        map.getCanvas().style.cursor = 'pointer';

        // 툴팁
        const state = countryStates?.get(iso3);
        setTooltip({
          x: e.point.x,
          y: e.point.y,
          name,
          iso3,
          tier: state?.tier || (props.TIER as string) || undefined,
          status: state?.battleStatus || undefined,
        });

        onCountryHover?.(iso3, name);
      });

      map.on('mouseleave', 'country-fill', () => {
        if (hoveredIdRef.current !== null) {
          map.setFeatureState(
            { source: 'countries', id: hoveredIdRef.current },
            { hover: false },
          );
          hoveredIdRef.current = null;
        }
        map.getCanvas().style.cursor = '';
        setTooltip(null);
        onCountryHover?.(null, null);
      });

      // 클릭 이벤트
      map.on('click', 'country-fill', (e) => {
        if (!e.features || e.features.length === 0) return;

        const feature = e.features[0];
        const fid = feature.id as number;
        const props = feature.properties || {};
        const iso3 = getCountryISO(props);
        const name = getCountryName(props);

        // 이전 선택 해제
        if (selectedIdRef.current !== null) {
          map.setFeatureState(
            { source: 'countries', id: selectedIdRef.current },
            { selected: false },
          );
        }

        // 새 선택
        selectedIdRef.current = fid;
        map.setFeatureState({ source: 'countries', id: fid }, { selected: true });

        onCountryClick?.(iso3, name);
      });
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 국가 상태 변경 시 fill 색상 업데이트
  useEffect(() => {
    if (!loaded || !mapRef.current || !countryStates) return;

    const map = mapRef.current;
    const source = map.getSource('countries');
    if (!source) return;

    // GeoJSON feature들을 순회하며 색상 업데이트
    // MapLibre에서는 fill-color를 data-driven으로 처리
    // 여기서는 match expression으로 ISO3 → 색상 매핑
    const matchExpr: unknown[] = ['match', ['get', 'ISO_A3']];

    countryStates.forEach((state, iso3) => {
      let color: string = sovereigntyColors.unclaimed;
      if (state.sovereignFaction) {
        color = sovereigntyColors.neutral;
      }
      if (state.battleStatus === 'in_battle') {
        color = sovereigntyColors.atWar;
      }
      matchExpr.push(iso3, color);
    });

    // 기본값
    matchExpr.push(sovereigntyColors.unclaimed);

    map.setPaintProperty('country-fill', 'fill-color', matchExpr);
  }, [loaded, countryStates]);

  // selectedCountry prop 변경 시 맵에서 선택 반영
  useEffect(() => {
    if (!loaded || !mapRef.current) return;

    // 이전 선택 해제
    if (selectedIdRef.current !== null) {
      mapRef.current.setFeatureState(
        { source: 'countries', id: selectedIdRef.current },
        { selected: false },
      );
      selectedIdRef.current = null;
    }

    // 새 선택은 feature ID를 모르므로 querySourceFeatures로 찾기
    if (selectedCountry) {
      const features = mapRef.current.querySourceFeatures('countries', {
        filter: ['==', ['get', 'ISO_A3'], selectedCountry],
      });
      if (features.length > 0 && features[0].id !== undefined) {
        const fid = features[0].id as number;
        selectedIdRef.current = fid;
        mapRef.current.setFeatureState(
          { source: 'countries', id: fid },
          { selected: true },
        );
      }
    }
  }, [loaded, selectedCountry]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', ...style }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* 툴팁 */}
      {tooltip && (
        <div
          style={{
            position: 'absolute',
            left: tooltip.x + 12,
            top: tooltip.y - 40,
            background: 'rgba(10, 14, 20, 0.92)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '4px',
            padding: '8px 12px',
            color: '#E8E0D4',
            fontSize: '13px',
            fontFamily: '"Rajdhani", sans-serif',
            pointerEvents: 'none',
            zIndex: 50,
            whiteSpace: 'nowrap',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div style={{ fontWeight: 700, letterSpacing: '1px' }}>
            {tooltip.name}
            {tooltip.tier && (
              <span style={{ marginLeft: 6, fontSize: '11px', opacity: 0.6 }}>
                [{tooltip.tier}]
              </span>
            )}
          </div>
          <div style={{ fontSize: '11px', opacity: 0.7, marginTop: 2 }}>
            {tooltip.iso3}
            {tooltip.status && tooltip.status !== 'idle' && (
              <span
                style={{
                  marginLeft: 8,
                  color:
                    tooltip.status === 'in_battle'
                      ? '#EF4444'
                      : tooltip.status === 'preparing'
                        ? '#F59E0B'
                        : '#3B82F6',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                }}
              >
                {tooltip.status.replace('_', ' ')}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
