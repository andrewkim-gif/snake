/**
 * matrix/data/index.ts — v39 지역/국가 데이터 모듈 re-export
 */

export { COUNTRY_TIER_MAP, getCountryTier, getCountriesByTier } from './country-tiers';
export {
  COUNTRY_SPECIALTY,
  getAllCountryRegions,
  getCountryRegions,
  getRegionsForCountry,
  getRegionById,
  getCountryRegionsByTier,
  getTotalRegionCount,
  getRegionStats,
} from './region-data';
export {
  getExtendedCountries,
  getExtendedCountryByISO3,
  getExtendedCountriesByTier,
  searchExtendedCountries,
} from './country-regions-extended';
export type { ICountryEntryExtended } from './country-regions-extended';
