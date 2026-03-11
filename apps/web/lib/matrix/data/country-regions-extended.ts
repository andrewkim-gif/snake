/**
 * country-regions-extended.ts — v39 CountryEntry 확장
 *
 * 기존 CountryEntry를 확장하여 tier + regions 필드를 추가한다.
 * 기존 country-data.ts를 수정하지 않고 backward compatible하게 확장.
 */

import type { CountryEntry } from '../../country-data';
import type {
  CountryTier,
  IRegionDef,
  ICountryRegions,
} from '../types/region';
import { COUNTRIES } from '../../country-data';
import { getCountryTier } from './country-tiers';
import { getCountryRegions } from './region-data';

/** 확장된 국가 데이터 — 기존 CountryEntry + 티어/지역 정보 */
export interface ICountryEntryExtended extends CountryEntry {
  /** 국가 티어 (S/A/B/C/D) */
  tier: CountryTier;
  /** 지역 목록 */
  regions: IRegionDef[];
  /** 특산 자원 */
  specialtyResource: string;
  /** 아레나 크기 (px) */
  arenaSize: number;
  /** 지역당 최대 플레이어 */
  maxPlayers: number;
}

/** 캐시 */
let _extendedCache: ICountryEntryExtended[] | null = null;
let _extendedMap: Map<string, ICountryEntryExtended> | null = null;

/** 전체 195개국의 확장 데이터를 빌드한다 */
function buildExtendedCountries(): ICountryEntryExtended[] {
  return COUNTRIES.map((country) => {
    const tier = getCountryTier(country.iso3);
    const regionData = getCountryRegions(country.iso3);

    return {
      ...country,
      tier,
      regions: regionData?.regions ?? [],
      specialtyResource: regionData?.specialtyResource ?? 'generic',
      arenaSize: regionData?.arenaSize ?? 2500,
      maxPlayers: regionData?.maxPlayers ?? 10,
    };
  });
}

/** 전체 확장 국가 데이터 (lazy init + 캐시) */
export function getExtendedCountries(): readonly ICountryEntryExtended[] {
  if (!_extendedCache) {
    _extendedCache = buildExtendedCountries();
  }
  return _extendedCache;
}

/** ISO3 코드로 확장 국가 데이터 조회 */
export function getExtendedCountryByISO3(
  iso3: string,
): ICountryEntryExtended | undefined {
  if (!_extendedMap) {
    _extendedMap = new Map<string, ICountryEntryExtended>();
    for (const c of getExtendedCountries()) {
      _extendedMap.set(c.iso3, c);
    }
  }
  return _extendedMap.get(iso3);
}

/** 특정 티어의 확장 국가 데이터 목록 */
export function getExtendedCountriesByTier(
  tier: CountryTier,
): ICountryEntryExtended[] {
  return getExtendedCountries().filter((c) => c.tier === tier) as ICountryEntryExtended[];
}

/** 검색어로 확장 국가 필터링 (영문 + 한글 + 티어) */
export function searchExtendedCountries(
  query: string,
): ICountryEntryExtended[] {
  if (!query.trim()) return [...getExtendedCountries()];
  const q = query.trim().toLowerCase();
  return getExtendedCountries().filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.nameKo.includes(q) ||
      c.iso3.toLowerCase().includes(q) ||
      c.iso2.toLowerCase().includes(q) ||
      c.tier.toLowerCase() === q,
  ) as ICountryEntryExtended[];
}
