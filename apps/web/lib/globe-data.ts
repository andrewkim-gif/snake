/**
 * Globe Data — three-globe + WorldMap 공유 데이터 유틸리티
 * GeoJSON 로딩, 국가 데이터 매핑, 팩션 색상 계산
 */

import { sovereigntyColors, getCountryISO } from './map-style';

// GeoJSON 타입 (간소화)
export interface GeoJSONFeature {
  type: 'Feature';
  properties: Record<string, unknown>;
  geometry: {
    type: string;
    coordinates: unknown[];
  };
}

export interface GeoJSONData {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

// 국가 상태 (서버에서 수신)
export interface CountryClientState {
  iso3: string;
  name: string;
  continent: string;
  tier: 'S' | 'A' | 'B' | 'C' | 'D';
  sovereignFaction: string;
  sovereigntyLevel: number;
  gdp: number;
  battleStatus: 'idle' | 'preparing' | 'in_battle' | 'cooldown';
  activeAgents: number;
  resources: {
    oil: number;
    minerals: number;
    food: number;
    tech: number;
    manpower: number;
  };
  latitude: number;
  longitude: number;
  capitalName: string;
  terrainTheme: string;
  // v15: population-based agent limits
  maxAgents: number;
  population: number;
}

// GeoJSON 캐시
let _geoJsonCache: GeoJSONData | null = null;

// GeoJSON 데이터 로딩 (캐시)
export async function loadGeoJSON(): Promise<GeoJSONData> {
  if (_geoJsonCache) return _geoJsonCache;

  const res = await fetch('/data/countries.geojson');
  if (!res.ok) throw new Error(`Failed to load GeoJSON: ${res.status}`);
  _geoJsonCache = await res.json();
  return _geoJsonCache!;
}

// 국가 ISO3 → 지배 색상 매핑
export function getCountryColor(
  iso3: string,
  countryStates: Map<string, CountryClientState>,
  myFactionId?: string,
  allyFactionIds?: Set<string>,
  enemyFactionIds?: Set<string>,
): string {
  const state = countryStates.get(iso3);
  if (!state || !state.sovereignFaction) {
    return sovereigntyColors.unclaimed;
  }

  if (myFactionId && state.sovereignFaction === myFactionId) {
    return sovereigntyColors.myFaction;
  }

  if (allyFactionIds?.has(state.sovereignFaction)) {
    return sovereigntyColors.allyFaction;
  }

  if (enemyFactionIds?.has(state.sovereignFaction)) {
    return sovereigntyColors.enemy;
  }

  return sovereigntyColors.neutral;
}

// GeoJSON feature에서 국가 데이터 생성 (fallback용)
export function featureToCountryState(feature: GeoJSONFeature): CountryClientState {
  const props = feature.properties;
  const iso3 = getCountryISO(props);
  const name = (props.NAME as string) || (props.ADMIN as string) || 'Unknown';
  const continent = (props.CONTINENT as string) || (props.continent as string) || 'Unknown';

  // GDP per capita에서 등급 추정
  const gdpPc = (props.GDP_MD_EST as number) || 0;
  let tier: CountryClientState['tier'] = 'C';
  if (gdpPc > 5000000) tier = 'S';
  else if (gdpPc > 1000000) tier = 'A';
  else if (gdpPc > 200000) tier = 'B';
  else if (gdpPc > 50000) tier = 'C';
  else tier = 'D';

  // v15: POP_EST → population (Natural Earth GeoJSON field)
  const population = (props.POP_EST as number) || 0;

  return {
    iso3,
    name,
    continent,
    tier,
    sovereignFaction: '',
    sovereigntyLevel: 0,
    gdp: gdpPc,
    battleStatus: 'idle',
    activeAgents: 0,
    resources: { oil: 50, minerals: 50, food: 50, tech: 50, manpower: 50 },
    latitude: 0,
    longitude: 0,
    capitalName: '',
    terrainTheme: 'plains',
    maxAgents: 0,
    population,
  };
}

// 팩션 색상 팔레트 (최대 20 팩션)
export const factionColorPalette = [
  '#22C55E', '#3B82F6', '#EF4444', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#F97316', '#14B8A6', '#6366F1',
  '#D946EF', '#0EA5E9', '#84CC16', '#FBBF24', '#A855F7',
  '#F43F5E', '#10B981', '#3B82F6', '#F59E0B', '#EF4444',
];

// 팩션 ID → 색상 매핑
export function getFactionColor(factionId: string, factionIndex: number): string {
  if (!factionId) return sovereigntyColors.unclaimed;
  return factionColorPalette[factionIndex % factionColorPalette.length];
}
