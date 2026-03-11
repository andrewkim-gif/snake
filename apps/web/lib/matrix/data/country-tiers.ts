/**
 * country-tiers.ts — v39 국가 티어 배정
 *
 * 195개국을 S/A/B/C/D 5개 티어로 분류한다.
 * 티어는 지역 수, 아레나 크기, 최대 인원을 결정한다.
 *
 * S(8) = 7지역, 6000px, 30명
 * A(20) = 5지역, 5000px, 25명
 * B(40) = 4지역, 4000px, 20명
 * C(80) = 3지역, 3000px, 15명
 * D(47) = 3지역, 2500px, 10명
 */

import type { CountryTier } from '../types/region';

/** 국가 티어 배정 — ISO3 코드 기준 */
export const COUNTRY_TIER_MAP: Record<string, CountryTier> = {
  // ── S 티어 (8개국) — 강대국 ──
  USA: 'S', CHN: 'S', RUS: 'S', IND: 'S',
  JPN: 'S', DEU: 'S', GBR: 'S', FRA: 'S',

  // ── A 티어 (20개국) — 지역 강국 ──
  KOR: 'A', BRA: 'A', CAN: 'A', AUS: 'A',
  ITA: 'A', TUR: 'A', SAU: 'A', MEX: 'A',
  IDN: 'A', ESP: 'A', NLD: 'A', POL: 'A',
  ARG: 'A', ZAF: 'A', EGY: 'A', PAK: 'A',
  NGA: 'A', IRN: 'A', ISR: 'A', UKR: 'A',

  // ── B 티어 (40개국) — 중견국 ──
  THA: 'B', VNM: 'B', MYS: 'B', PHL: 'B',
  SGP: 'B', TWN: 'B', SWE: 'B', NOR: 'B',
  CHE: 'B', AUT: 'B', BEL: 'B', CZE: 'B',
  ROU: 'B', PRT: 'B', GRC: 'B', HUN: 'B',
  DNK: 'B', FIN: 'B', IRL: 'B', NZL: 'B',
  CHL: 'B', COL: 'B', PER: 'B', VEN: 'B',
  BGD: 'B', LKA: 'B', MMR: 'B', KAZ: 'B',
  UZB: 'B', ETH: 'B', KEN: 'B', TZA: 'B',
  MAR: 'B', DZA: 'B', IRQ: 'B', CUB: 'B',
  PRK: 'B', SRB: 'B', BGR: 'B', SVK: 'B',

  // ── C 티어 (80개국) — 소국 ──
  HRV: 'C', SVN: 'C', LTU: 'C', LVA: 'C',
  EST: 'C', BLR: 'C', MDA: 'C', GEO: 'C',
  ARM: 'C', AZE: 'C', KGZ: 'C', TJK: 'C',
  TKM: 'C', MNG: 'C', KHM: 'C', LAO: 'C',
  NPL: 'C', BTN: 'C', MDV: 'C', AFG: 'C',
  JOR: 'C', LBN: 'C', SYR: 'C', YEM: 'C',
  OMN: 'C', KWT: 'C', QAT: 'C', BHR: 'C',
  ARE: 'C', BOL: 'C', PRY: 'C', URY: 'C',
  ECU: 'C', CRI: 'C', PAN: 'C', GTM: 'C',
  HND: 'C', SLV: 'C', NIC: 'C', DOM: 'C',
  HTI: 'C', JAM: 'C', TTO: 'C', BHS: 'C',
  GUY: 'C', SUR: 'C', BLZ: 'C', BRB: 'C',
  GHA: 'C', CIV: 'C', CMR: 'C', SEN: 'C',
  MLI: 'C', BFA: 'C', NER: 'C', TCD: 'C',
  CAF: 'C', COG: 'C', COD: 'C', AGO: 'C',
  MOZ: 'C', MDG: 'C', ZMB: 'C', ZWE: 'C',
  BWA: 'C', NAM: 'C', UGA: 'C', RWA: 'C',
  BDI: 'C', SSD: 'C', SDN: 'C', LBY: 'C',
  TUN: 'C', SOM: 'C', ERI: 'C', DJI: 'C',
  MWI: 'C', LSO: 'C', SWZ: 'C', PNG: 'C',

  // ── D 티어 (47개국) — 도시국가/소도서국 ──
  ISL: 'D', LUX: 'D', MLT: 'D', CYP: 'D',
  MNE: 'D', MKD: 'D', ALB: 'D', BIH: 'D',
  AND: 'D', MCO: 'D', SMR: 'D', LIE: 'D',
  VAT: 'D', XKX: 'D', PSE: 'D',
  GNQ: 'D', GAB: 'D', BEN: 'D', TGO: 'D',
  SLE: 'D', LBR: 'D', GNB: 'D', GIN: 'D',
  GMB: 'D', CPV: 'D', STP: 'D', MRT: 'D',
  MUS: 'D', SYC: 'D', COM: 'D',
  BRN: 'D', TLS: 'D', FJI: 'D',
  TON: 'D', WSM: 'D', VUT: 'D', SLB: 'D',
  KIR: 'D', MHL: 'D', FSM: 'D', PLW: 'D',
  NRU: 'D', TUV: 'D',
  KNA: 'D', LCA: 'D', VCT: 'D', DMA: 'D',
  GRD: 'D', ATG: 'D',
} as const;

/** ISO3 코드로 티어 조회 (미등록 국가는 'D' 폴백) */
export function getCountryTier(iso3: string): CountryTier {
  return COUNTRY_TIER_MAP[iso3] ?? 'D';
}

/** 특정 티어에 속하는 국가 목록 조회 */
export function getCountriesByTier(tier: CountryTier): string[] {
  return Object.entries(COUNTRY_TIER_MAP)
    .filter(([, t]) => t === tier)
    .map(([code]) => code);
}
