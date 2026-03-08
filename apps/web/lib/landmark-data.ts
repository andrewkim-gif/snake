/**
 * landmark-data.ts — 195국 랜드마크 데이터 (v20 Phase 3 리팩토링)
 *
 * 기존 42개 하드코딩 → 195국 동적 생성:
 *   - ISO3별 고유 Archetype 할당 (유명 랜드마크 or 대륙/지역 기반)
 *   - countryCentroids (GeoJSON에서 계산)로 정확한 위치
 *   - 서버 Tier (S/A/B/C/D) → LOD Tier (1/2/3) 매핑
 */

// ─── Enums ───

export enum LandmarkArchetype {
  TOWER = 'TOWER',
  PYRAMID = 'PYRAMID',
  DOME = 'DOME',
  NEEDLE = 'NEEDLE',
  STATUE = 'STATUE',
  WALL = 'WALL',
  ARENA = 'ARENA',
  BRIDGE = 'BRIDGE',
  PAGODA = 'PAGODA',
  SHELLS = 'SHELLS',
  ONION_DOME = 'ONION_DOME',
  MOUNTAIN = 'MOUNTAIN',
  TWIN_TOWER = 'TWIN_TOWER',
  BRIDGE_TOP = 'BRIDGE_TOP',
  SPIRE_CLUSTER = 'SPIRE_CLUSTER',
  SKYSCRAPER = 'SKYSCRAPER',
  CLOCK_TOWER = 'CLOCK_TOWER',
  TILTED_TOWER = 'TILTED_TOWER',
  TEMPLE = 'TEMPLE',
  GATE = 'GATE',
  WINDMILL = 'WINDMILL',
  CASTLE = 'CASTLE',
  STONE_RING = 'STONE_RING',
  OBELISK = 'OBELISK',
  TERRACE = 'TERRACE',
  MESA = 'MESA',
  MONOLITH = 'MONOLITH',
}

export enum LandmarkTier {
  TIER_1 = 1,
  TIER_2 = 2,
  TIER_3 = 3,
}

// ─── Types ───

export interface Landmark {
  id: number;
  name: string;
  iso3: string;
  lat: number;
  lng: number;
  tier: LandmarkTier;
  archetype: LandmarkArchetype;
}

// ─── ISO3 → Archetype 매핑 (195국) ───
// 유명 랜드마크가 있는 국가: 실제 건축물 기반
// 나머지: 대륙/지역 문화권에 맞는 대표 Archetype

const A = LandmarkArchetype;

export const COUNTRY_ARCHETYPE: Record<string, LandmarkArchetype> = {
  // ═══ S-Tier (8) — 초강대국 ═══
  USA: A.STATUE,        // 자유의 여신상
  CHN: A.WALL,          // 만리장성
  RUS: A.ONION_DOME,    // 성 바실리 성당
  IND: A.DOME,          // 타지마할
  BRA: A.STATUE,        // 구세주 그리스도상
  JPN: A.PAGODA,        // 도쿄 타워/파고다
  DEU: A.GATE,          // 브란덴부르크 문
  GBR: A.CLOCK_TOWER,   // 빅벤

  // ═══ A-Tier (20) — 주요국 ═══
  KOR: A.PAGODA,        // 경복궁
  FRA: A.TOWER,         // 에펠탑
  CAN: A.NEEDLE,        // CN 타워
  AUS: A.SHELLS,        // 시드니 오페라하우스
  SAU: A.DOME,          // 메카 모스크
  TUR: A.DOME,          // 하기아 소피아
  IDN: A.TEMPLE,        // 보로부두르
  MEX: A.PYRAMID,       // 치첸이트사
  ITA: A.ARENA,         // 콜로세움
  ESP: A.SPIRE_CLUSTER, // 사그라다 파밀리아
  IRN: A.DOME,          // 이맘 모스크
  EGY: A.PYRAMID,       // 기자 피라미드
  PAK: A.DOME,          // 바드샤히 모스크
  NGA: A.OBELISK,       // 아부자 국가모스크/기념비
  ISR: A.DOME,          // 바위의 돔
  POL: A.CASTLE,        // 바벨 성
  ZAF: A.MESA,          // 테이블 마운틴
  UKR: A.ONION_DOME,    // 키이우 소피아 성당
  NLD: A.WINDMILL,      // 풍차
  SWE: A.CASTLE,        // 왕궁

  // ═══ B-Tier (40) — 지역 강국 ═══
  THA: A.SPIRE_CLUSTER, // 왓 아룬
  ARG: A.OBELISK,       // 부에노스아이레스 오벨리스크
  COL: A.STATUE,        // 보테로 동상
  MYS: A.TWIN_TOWER,    // 페트로나스 타워
  PHL: A.TERRACE,       // 바나웨 계단식 논
  VNM: A.PAGODA,        // 한기둥 사원
  BGD: A.DOME,          // 국회의사당
  NOR: A.MOUNTAIN,      // 피요르드
  CHE: A.MOUNTAIN,      // 마터호른
  AUT: A.CASTLE,        // 쇤브룬 궁전
  BEL: A.SKYSCRAPER,    // 아토미움
  CHL: A.STATUE,        // 모아이
  PER: A.TERRACE,       // 마추픽추
  VEN: A.MOUNTAIN,      // 앙헬 폭포
  IRQ: A.DOME,          // 사마라 모스크
  KWT: A.NEEDLE,        // 쿠웨이트 타워
  ARE: A.NEEDLE,        // 부르즈 칼리파
  QAT: A.SKYSCRAPER,    // 도하 스카이라인
  SGP: A.BRIDGE_TOP,    // 마리나 베이 샌즈
  FIN: A.CASTLE,        // 수오멘린나
  DNK: A.STATUE,        // 인어공주 동상
  IRL: A.CASTLE,        // 벙케리 성
  PRT: A.TOWER,         // 벨렝 타워
  GRC: A.TEMPLE,        // 파르테논
  CZE: A.CASTLE,        // 프라하 성
  ROU: A.CASTLE,        // 브란 성 (드라큘라)
  NZL: A.NEEDLE,        // 스카이 타워
  KAZ: A.NEEDLE,        // 바이테렉 타워
  ETH: A.OBELISK,       // 악숨 오벨리스크
  DZA: A.DOME,          // 케찌와 모스크
  MAR: A.DOME,          // 하산 2세 모스크
  KEN: A.MOUNTAIN,      // 킬리만자로 근접
  MMR: A.PAGODA,        // 쉐다곤 파고다
  TWN: A.TOWER,         // 타이페이 101
  HUN: A.DOME,          // 국회의사당
  PRK: A.OBELISK,       // 주체탑
  CUB: A.DOME,          // 카피톨리오
  LBY: A.DOME,          // 트리폴리 모스크
  AGO: A.MONOLITH,      // 투카 요새
  COD: A.MONOLITH,      // 콩고 기념비

  // ═══ C-Tier (80) — 중간국 ═══
  SVK: A.CASTLE,    SVN: A.CASTLE,    HRV: A.ARENA,     SRB: A.TEMPLE,
  BGR: A.DOME,      LTU: A.CASTLE,    LVA: A.CASTLE,    EST: A.CASTLE,
  BLR: A.OBELISK,   GEO: A.DOME,      ARM: A.DOME,      AZE: A.TOWER,
  UZB: A.DOME,      TKM: A.DOME,      KGZ: A.MOUNTAIN,  TJK: A.MOUNTAIN,
  AFG: A.DOME,      NPL: A.PAGODA,    LKA: A.PAGODA,    KHM: A.PYRAMID,
  LAO: A.PAGODA,    MNG: A.MONOLITH,  JOR: A.TEMPLE,    LBN: A.TEMPLE,
  SYR: A.DOME,      YEM: A.TOWER,     OMN: A.DOME,      BHR: A.NEEDLE,
  ECU: A.DOME,      BOL: A.TERRACE,   PRY: A.DOME,      URY: A.OBELISK,
  PAN: A.BRIDGE,    CRI: A.MOUNTAIN,  GTM: A.PYRAMID,   HND: A.PYRAMID,
  SLV: A.PYRAMID,   NIC: A.DOME,      DOM: A.DOME,      HTI: A.DOME,
  JAM: A.STATUE,    TTO: A.SKYSCRAPER,CMR: A.MONOLITH,  GHA: A.GATE,
  CIV: A.DOME,      SEN: A.STATUE,    MLI: A.DOME,      BFA: A.MONOLITH,
  NER: A.DOME,      TCD: A.MONOLITH,  SDN: A.DOME,      SSD: A.MONOLITH,
  ERI: A.OBELISK,   DJI: A.MONOLITH,  SOM: A.DOME,      UGA: A.DOME,
  RWA: A.MOUNTAIN,  BDI: A.MONOLITH,  TZA: A.MOUNTAIN,  MOZ: A.MONOLITH,
  MDG: A.MONOLITH,  ZMB: A.MONOLITH,  ZWE: A.STONE_RING,MWI: A.MONOLITH,
  BWA: A.MONOLITH,  NAM: A.MONOLITH,  LSO: A.MOUNTAIN,  SWZ: A.MONOLITH,
  TUN: A.DOME,      MRT: A.DOME,      GAB: A.MONOLITH,  COG: A.MONOLITH,
  GNQ: A.MONOLITH,  CAF: A.MONOLITH,  PNG: A.MONOLITH,  FJI: A.MONOLITH,
  SLB: A.MONOLITH,  VUT: A.MONOLITH,  WSM: A.MONOLITH,  TON: A.MONOLITH,

  // ═══ D-Tier (~47) — 소국 ═══
  LUX: A.CASTLE,    MCO: A.SKYSCRAPER,LIE: A.CASTLE,    AND: A.CASTLE,
  MLT: A.TEMPLE,    ISL: A.MOUNTAIN,  CYP: A.TEMPLE,    MNE: A.CASTLE,
  ALB: A.CASTLE,    MKD: A.DOME,      BIH: A.BRIDGE,    MDA: A.DOME,
  BRN: A.DOME,      TLS: A.MONOLITH,  BTN: A.PAGODA,    MDV: A.MONOLITH,
  BRB: A.STATUE,    BHS: A.MONOLITH,  BLZ: A.PYRAMID,   GUY: A.MONOLITH,
  SUR: A.MONOLITH,  ATG: A.MONOLITH,  DMA: A.MONOLITH,  GRD: A.MONOLITH,
  KNA: A.MONOLITH,  LCA: A.MONOLITH,  VCT: A.MONOLITH,  MUS: A.MONOLITH,
  SYC: A.MONOLITH,  COM: A.MONOLITH,  CPV: A.MONOLITH,  STP: A.MONOLITH,
  GNB: A.MONOLITH,  GMB: A.MONOLITH,  SLE: A.MONOLITH,  LBR: A.MONOLITH,
  TGO: A.MONOLITH,  BEN: A.MONOLITH,  PLW: A.MONOLITH,  MHL: A.MONOLITH,
  FSM: A.MONOLITH,  NRU: A.MONOLITH,  TUV: A.MONOLITH,  KIR: A.MONOLITH,
  PSE: A.DOME,      XKX: A.DOME,      SMR: A.CASTLE,
};

// ─── ISO3 → Tier 매핑 (서버 Tier에 기반) ───
// S-Tier, A-Tier → TIER_1 (항상 표시)
// B-Tier → TIER_2 (중간 줌)
// C-Tier, D-Tier → TIER_3 (근접 줌)

const TIER_1_COUNTRIES = new Set([
  // S-Tier
  'USA','CHN','RUS','IND','BRA','JPN','DEU','GBR',
  // A-Tier
  'KOR','FRA','CAN','AUS','SAU','TUR','IDN','MEX','ITA','ESP',
  'IRN','EGY','PAK','NGA','ISR','POL','ZAF','UKR','NLD','SWE',
]);

const TIER_2_COUNTRIES = new Set([
  'THA','ARG','COL','MYS','PHL','VNM','BGD','NOR','CHE','AUT',
  'BEL','CHL','PER','VEN','IRQ','KWT','ARE','QAT','SGP','FIN',
  'DNK','IRL','PRT','GRC','CZE','ROU','NZL','KAZ','ETH','DZA',
  'MAR','KEN','MMR','TWN','HUN','PRK','CUB','LBY','AGO','COD',
]);

function getTierForISO3(iso3: string): LandmarkTier {
  if (TIER_1_COUNTRIES.has(iso3)) return LandmarkTier.TIER_1;
  if (TIER_2_COUNTRIES.has(iso3)) return LandmarkTier.TIER_2;
  return LandmarkTier.TIER_3;
}

function getArchetypeForISO3(iso3: string): LandmarkArchetype {
  return COUNTRY_ARCHETYPE[iso3] || LandmarkArchetype.MONOLITH;
}

// ─── 동적 랜드마크 생성 ───

/**
 * countryCentroids Map에서 전체 Landmark 배열을 생성
 * GlobeLandmarks에서 호출 — GeoJSON 기반 centroid 좌표 사용
 */
export function generateLandmarksFromCentroids(
  centroids: Map<string, [number, number]>,
): Landmark[] {
  const landmarks: Landmark[] = [];
  let id = 1;
  for (const [iso3, [lat, lng]] of centroids) {
    landmarks.push({
      id: id++,
      name: iso3,
      iso3,
      lat,
      lng,
      tier: getTierForISO3(iso3),
      archetype: getArchetypeForISO3(iso3),
    });
  }
  return landmarks;
}

// ─── Tier 필터 유틸리티 ───

export function filterByTier(landmarks: Landmark[], maxTier: LandmarkTier): Landmark[] {
  return landmarks.filter(l => l.tier <= maxTier);
}

// ─── 레거시 호환: 42개 하드코딩 (LandmarkSprites에서 아직 참조) ───

export const LANDMARKS: Landmark[] = [];
export const TIER_1_LANDMARKS: Landmark[] = [];
export const TIER_2_LANDMARKS: Landmark[] = [];
export const LANDMARK_COUNT = 0;
