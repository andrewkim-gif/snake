/**
 * Map Style — 다크 테마 스타일 정의 + 국가 색상 체계
 * MapLibre GL JS + three-globe 공유 팔레트
 */

// 지배권 색상 체계 (v11-world-war-plan.md §3.5)
export const sovereigntyColors = {
  unclaimed: '#3D7A9E',    // 미점령 — 밝은 틸블루 (지구본 라이팅 감안)
  myFaction: '#22C55E',    // 내 팩션 — 초록
  allyFaction: '#3B82F6',  // 동맹 팩션 — 파랑
  neutral: '#F59E0B',      // 중립 — 노랑
  enemy: '#EF4444',        // 적대 — 빨강
  atWar: '#FF0000',        // 전쟁 중 — 강조 빨강
} as const;

// 전투 상태 색상
export const battleStatusColors = {
  idle: 'transparent',
  preparing: '#F59E0B',
  in_battle: '#EF4444',
  cooldown: '#3B82F6',
} as const;

// 국가 등급 색상
export const tierColors = {
  S: '#FFD700', // Gold
  A: '#C0C0C0', // Silver
  B: '#CD7F32', // Bronze
  C: '#8A8A8A', // Gray
  D: '#5A5A5A', // Dark gray
} as const;

// 대륙 기본 색상 (팩션 미배정 시 대륙별 구분)
export const continentColors: Record<string, string> = {
  'North America': '#4A7C59',
  'South America': '#5B8A6E',
  'Europe': '#5A6B8A',
  'Africa': '#8A6B4A',
  'Asia': '#7A5A6B',
  'Oceania': '#4A7A8A',
  'Antarctica': '#6A7A8A',
};

// 다크 맵 스타일 (MapLibre GL 용)
export const darkMapStyle: maplibregl.StyleSpecification = {
  version: 8 as const,
  name: 'AI World War Dark',
  sources: {
    countries: {
      type: 'geojson',
      data: '/data/countries.geojson',
    },
  },
  layers: [
    // 배경 (우주 검정)
    {
      id: 'background',
      type: 'background',
      paint: {
        'background-color': '#0A0B10',
      },
    },
    // 국가 fill
    {
      id: 'country-fill',
      type: 'fill',
      source: 'countries',
      paint: {
        'fill-color': sovereigntyColors.unclaimed,
        'fill-opacity': 0.6,
      },
    },
    // 국가 경계선
    {
      id: 'country-borders',
      type: 'line',
      source: 'countries',
      paint: {
        'line-color': 'rgba(255, 255, 255, 0.12)',
        'line-width': 1,
        'line-opacity': 0.6,
      },
    },
    // 호버 하이라이트
    {
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
    },
    // 선택된 국가 하이라이트
    {
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
    },
  ],
} as unknown as maplibregl.StyleSpecification;

// 국가 속성에서 ISO3 코드 추출 (GeoJSON property name varies)
export function getCountryISO(properties: Record<string, unknown>): string {
  return (
    (properties.ISO_A3 as string) ||
    (properties.ADM0_A3 as string) ||
    (properties.iso_a3 as string) ||
    ''
  );
}

// 국가 이름 추출
export function getCountryName(properties: Record<string, unknown>): string {
  return (
    (properties.NAME as string) ||
    (properties.ADMIN as string) ||
    (properties.name as string) ||
    'Unknown'
  );
}

// 자원 이름 한글 매핑
export const resourceLabels: Record<string, string> = {
  oil: 'Oil',
  minerals: 'Minerals',
  food: 'Food',
  tech: 'Tech',
  manpower: 'Manpower',
};

// 자원 아이콘 (이모지 대신 텍스트)
export const resourceIcons: Record<string, string> = {
  oil: 'OIL',
  minerals: 'MIN',
  food: 'FD',
  tech: 'TCH',
  manpower: 'MAN',
};
