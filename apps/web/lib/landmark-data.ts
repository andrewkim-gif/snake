/**
 * landmark-data.ts — 42개 세계 랜드마크 데이터 정의 (v20 Phase 1)
 *
 * 각 랜드마크: id, name, city, country, iso3, lat, lng, tier, archetype, description
 * Tier 1 (15): 줌아웃 시에도 항상 표시 — 대륙별 최고 아이콘
 * Tier 2 (15): 중간 줌부터 표시 — 주요 도시 대표
 * Tier 3 (12): 근접 줌에서만 표시 — 보조 랜드마크
 */

// ─── Enums ───

/** 랜드마크 형상 분류 (12종) — Archetype별 프로시저럴 지오메트리 생성 기준 */
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

/** 랜드마크 표시 우선순위 */
export enum LandmarkTier {
  /** 항상 표시 (줌아웃 포함) */
  TIER_1 = 1,
  /** 중간 줌부터 표시 */
  TIER_2 = 2,
  /** 근접 줌에서만 표시 */
  TIER_3 = 3,
}

// ─── Types ───

export interface Landmark {
  /** 고유 ID (1~42) */
  id: number;
  /** 랜드마크 이름 (영문) */
  name: string;
  /** 소재 도시 */
  city: string;
  /** 소재 국가 */
  country: string;
  /** ISO 3166-1 alpha-3 국가 코드 */
  iso3: string;
  /** 위도 */
  lat: number;
  /** 경도 */
  lng: number;
  /** 표시 우선순위 (1=항상, 2=중간줌, 3=근접) */
  tier: LandmarkTier;
  /** 로우폴리 형상 분류 */
  archetype: LandmarkArchetype;
  /** 간략 설명 (한국어) */
  description: string;
}

// ─── 42개 랜드마크 데이터 ───

export const LANDMARKS: Landmark[] = [
  // ═══ Asia (12) ═══
  { id: 1,  name: 'Tokyo Tower',           city: 'Tokyo',          country: 'Japan',       iso3: 'JPN', lat: 35.66,  lng: 139.75,  tier: LandmarkTier.TIER_1, archetype: LandmarkArchetype.TOWER,          description: '격자 원뿔 타워' },
  { id: 2,  name: 'Taj Mahal',             city: 'Agra',           country: 'India',       iso3: 'IND', lat: 27.17,  lng: 78.04,   tier: LandmarkTier.TIER_1, archetype: LandmarkArchetype.DOME,           description: '돔 + 4 미나렛' },
  { id: 3,  name: 'Great Wall',            city: 'Badaling',       country: 'China',       iso3: 'CHN', lat: 40.43,  lng: 116.57,  tier: LandmarkTier.TIER_1, archetype: LandmarkArchetype.WALL,           description: '지그재그 성벽 세그먼트' },
  { id: 4,  name: 'Burj Khalifa',          city: 'Dubai',          country: 'UAE',         iso3: 'ARE', lat: 25.20,  lng: 55.27,   tier: LandmarkTier.TIER_2, archetype: LandmarkArchetype.NEEDLE,         description: '단계적 첨탑 (stacked, 테이퍼)' },
  { id: 5,  name: 'Petronas Towers',       city: 'Kuala Lumpur',   country: 'Malaysia',    iso3: 'MYS', lat: 3.16,   lng: 101.71,  tier: LandmarkTier.TIER_2, archetype: LandmarkArchetype.TWIN_TOWER,     description: '쌍둥이 실린더 + 스카이 브릿지' },
  { id: 6,  name: 'Mount Fuji',            city: 'Shizuoka',       country: 'Japan',       iso3: 'JPN', lat: 35.36,  lng: 138.73,  tier: LandmarkTier.TIER_2, archetype: LandmarkArchetype.MOUNTAIN,       description: '원뿔 + 백색 정상 캡' },
  { id: 7,  name: 'Angkor Wat',            city: 'Siem Reap',      country: 'Cambodia',    iso3: 'KHM', lat: 13.41,  lng: 103.87,  tier: LandmarkTier.TIER_3, archetype: LandmarkArchetype.PYRAMID,        description: '단계식 피라미드 + 5 첨탑' },
  { id: 8,  name: 'Forbidden City',        city: 'Beijing',        country: 'China',       iso3: 'CHN', lat: 39.92,  lng: 116.39,  tier: LandmarkTier.TIER_3, archetype: LandmarkArchetype.PAGODA,         description: '중층 파고다 (stacked BoxGeo)' },
  { id: 9,  name: 'Marina Bay Sands',      city: 'Singapore',      country: 'Singapore',   iso3: 'SGP', lat: 1.28,   lng: 103.86,  tier: LandmarkTier.TIER_2, archetype: LandmarkArchetype.BRIDGE_TOP,     description: '3 타워 + 상판' },
  { id: 10, name: 'Taipei 101',            city: 'Taipei',         country: 'Taiwan',      iso3: 'TWN', lat: 25.03,  lng: 121.56,  tier: LandmarkTier.TIER_3, archetype: LandmarkArchetype.TOWER,          description: '적층 팔각 타워' },
  { id: 11, name: 'Gyeongbokgung',         city: 'Seoul',          country: 'South Korea', iso3: 'KOR', lat: 37.58,  lng: 126.98,  tier: LandmarkTier.TIER_2, archetype: LandmarkArchetype.PAGODA,         description: '기와지붕 전각' },
  { id: 12, name: 'Wat Arun',              city: 'Bangkok',        country: 'Thailand',    iso3: 'THA', lat: 13.74,  lng: 100.49,  tier: LandmarkTier.TIER_3, archetype: LandmarkArchetype.SPIRE_CLUSTER,  description: '프랑 첨탑 클러스터' },

  // ═══ Europe & Middle East (12) ═══
  { id: 13, name: 'Eiffel Tower',          city: 'Paris',          country: 'France',      iso3: 'FRA', lat: 48.86,  lng: 2.29,    tier: LandmarkTier.TIER_1, archetype: LandmarkArchetype.TOWER,          description: '격자 테이퍼드 타워' },
  { id: 14, name: 'Big Ben',               city: 'London',         country: 'UK',          iso3: 'GBR', lat: 51.50,  lng: -0.12,   tier: LandmarkTier.TIER_1, archetype: LandmarkArchetype.CLOCK_TOWER,    description: '시계탑 + 피라미드 캡' },
  { id: 15, name: 'Colosseum',             city: 'Rome',           country: 'Italy',       iso3: 'ITA', lat: 41.89,  lng: 12.49,   tier: LandmarkTier.TIER_1, archetype: LandmarkArchetype.ARENA,          description: '타원 링 (TorusGeo, 반높이)' },
  { id: 16, name: 'Leaning Tower of Pisa', city: 'Pisa',           country: 'Italy',       iso3: 'ITA', lat: 43.72,  lng: 10.40,   tier: LandmarkTier.TIER_3, archetype: LandmarkArchetype.TILTED_TOWER,   description: '기울어진 실린더 + 링 티어' },
  { id: 17, name: 'Sagrada Familia',       city: 'Barcelona',      country: 'Spain',       iso3: 'ESP', lat: 41.40,  lng: 2.17,    tier: LandmarkTier.TIER_2, archetype: LandmarkArchetype.SPIRE_CLUSTER,  description: '다중 첨탑 클러스터' },
  { id: 18, name: 'Parthenon',             city: 'Athens',         country: 'Greece',      iso3: 'GRC', lat: 37.97,  lng: 23.73,   tier: LandmarkTier.TIER_2, archetype: LandmarkArchetype.TEMPLE,         description: '열주 직사각형' },
  { id: 19, name: 'Brandenburg Gate',      city: 'Berlin',         country: 'Germany',     iso3: 'DEU', lat: 52.52,  lng: 13.38,   tier: LandmarkTier.TIER_2, archetype: LandmarkArchetype.GATE,           description: '기둥 열 + 상부 블록' },
  { id: 20, name: "St. Basil's Cathedral", city: 'Moscow',         country: 'Russia',      iso3: 'RUS', lat: 55.75,  lng: 37.62,   tier: LandmarkTier.TIER_1, archetype: LandmarkArchetype.ONION_DOME,     description: '다색 양파돔 스택' },
  { id: 21, name: 'Windmill',              city: 'Amsterdam',      country: 'Netherlands', iso3: 'NLD', lat: 52.37,  lng: 4.89,    tier: LandmarkTier.TIER_3, archetype: LandmarkArchetype.WINDMILL,       description: '원통 + 4블레이드' },
  { id: 22, name: 'Neuschwanstein Castle', city: 'Bavaria',        country: 'Germany',     iso3: 'DEU', lat: 47.56,  lng: 10.75,   tier: LandmarkTier.TIER_3, archetype: LandmarkArchetype.CASTLE,         description: '성 타워 + 원뿔 캡' },
  { id: 23, name: 'Stonehenge',            city: 'Wiltshire',      country: 'UK',          iso3: 'GBR', lat: 51.18,  lng: -1.83,   tier: LandmarkTier.TIER_3, archetype: LandmarkArchetype.STONE_RING,     description: '석판 링 원형 배치' },
  { id: 24, name: 'Petra (Al-Khazneh)',    city: 'Petra',          country: 'Jordan',      iso3: 'JOR', lat: 30.33,  lng: 35.44,   tier: LandmarkTier.TIER_3, archetype: LandmarkArchetype.TEMPLE,         description: '암벽 파사드 + 기둥' },

  // ═══ Americas (10) ═══
  { id: 25, name: 'Statue of Liberty',     city: 'New York',       country: 'USA',         iso3: 'USA', lat: 40.69,  lng: -74.04,  tier: LandmarkTier.TIER_1, archetype: LandmarkArchetype.STATUE,         description: '페데스탈 + 인체형 + 횃불' },
  { id: 26, name: 'Christ the Redeemer',   city: 'Rio de Janeiro', country: 'Brazil',      iso3: 'BRA', lat: -22.95, lng: -43.21,  tier: LandmarkTier.TIER_1, archetype: LandmarkArchetype.STATUE,         description: '십자형 인체 + 산 정상' },
  { id: 27, name: 'CN Tower',              city: 'Toronto',        country: 'Canada',      iso3: 'CAN', lat: 43.64,  lng: -79.39,  tier: LandmarkTier.TIER_2, archetype: LandmarkArchetype.NEEDLE,         description: '니들 타워 + 도넛 관측대' },
  { id: 28, name: 'Empire State Building', city: 'New York',       country: 'USA',         iso3: 'USA', lat: 40.75,  lng: -73.99,  tier: LandmarkTier.TIER_2, archetype: LandmarkArchetype.SKYSCRAPER,     description: '아르데코 단계식 타워' },
  { id: 29, name: 'Golden Gate Bridge',    city: 'San Francisco',  country: 'USA',         iso3: 'USA', lat: 37.82,  lng: -122.48, tier: LandmarkTier.TIER_1, archetype: LandmarkArchetype.BRIDGE,         description: '두 타워 + 현수 케이블' },
  { id: 30, name: 'Chichen Itza',          city: 'Yucatan',        country: 'Mexico',      iso3: 'MEX', lat: 20.68,  lng: -88.57,  tier: LandmarkTier.TIER_2, archetype: LandmarkArchetype.PYRAMID,        description: '단계식 피라미드' },
  { id: 31, name: 'Machu Picchu',          city: 'Cusco',          country: 'Peru',        iso3: 'PER', lat: -13.16, lng: -72.55,  tier: LandmarkTier.TIER_3, archetype: LandmarkArchetype.TERRACE,        description: '산악 계단식' },
  { id: 32, name: 'Washington Monument',   city: 'Washington DC',  country: 'USA',         iso3: 'USA', lat: 38.89,  lng: -77.04,  tier: LandmarkTier.TIER_3, archetype: LandmarkArchetype.OBELISK,        description: '오벨리스크' },
  { id: 33, name: 'Space Needle',          city: 'Seattle',        country: 'USA',         iso3: 'USA', lat: 47.62,  lng: -122.35, tier: LandmarkTier.TIER_3, archetype: LandmarkArchetype.NEEDLE,         description: '디스크 + 스템' },
  { id: 34, name: 'US Capitol',            city: 'Washington DC',  country: 'USA',         iso3: 'USA', lat: 38.89,  lng: -77.01,  tier: LandmarkTier.TIER_3, archetype: LandmarkArchetype.DOME,           description: '돔 + 윙' },

  // ═══ Africa & Oceania (8) ═══
  { id: 35, name: 'Great Pyramid of Giza', city: 'Giza',           country: 'Egypt',       iso3: 'EGY', lat: 29.98,  lng: 31.13,   tier: LandmarkTier.TIER_1, archetype: LandmarkArchetype.PYRAMID,        description: '정사면체 (ConeGeo, 4seg)' },
  { id: 36, name: 'Sydney Opera House',    city: 'Sydney',         country: 'Australia',   iso3: 'AUS', lat: -33.86, lng: 151.21,  tier: LandmarkTier.TIER_1, archetype: LandmarkArchetype.SHELLS,         description: '조개 돛 아크 지오메트리' },
  { id: 37, name: 'Table Mountain',        city: 'Cape Town',      country: 'South Africa',iso3: 'ZAF', lat: -33.96, lng: 18.40,   tier: LandmarkTier.TIER_2, archetype: LandmarkArchetype.MESA,           description: '평탄 정상 메사' },
  { id: 38, name: 'Great Sphinx',          city: 'Giza',           country: 'Egypt',       iso3: 'EGY', lat: 29.97,  lng: 31.14,   tier: LandmarkTier.TIER_3, archetype: LandmarkArchetype.STATUE,         description: '사자 몸체 로우폴리' },
  { id: 39, name: 'Uluru',                 city: 'Northern Territory', country: 'Australia', iso3: 'AUS', lat: -25.34, lng: 131.04, tier: LandmarkTier.TIER_3, archetype: LandmarkArchetype.MONOLITH,       description: '반구체 모노리스' },
  { id: 40, name: 'Sky Tower',             city: 'Auckland',       country: 'New Zealand', iso3: 'NZL', lat: -36.85, lng: 174.76,  tier: LandmarkTier.TIER_3, archetype: LandmarkArchetype.NEEDLE,         description: '니들 타워 변형' },
  { id: 41, name: 'Mount Kilimanjaro',     city: 'Kilimanjaro',    country: 'Tanzania',    iso3: 'TZA', lat: -3.07,  lng: 37.35,   tier: LandmarkTier.TIER_2, archetype: LandmarkArchetype.MOUNTAIN,       description: '눈덮인 원뿔' },
  { id: 42, name: 'Moai Statues',          city: 'Easter Island',  country: 'Chile',       iso3: 'CHL', lat: -27.12, lng: -109.35, tier: LandmarkTier.TIER_3, archetype: LandmarkArchetype.STATUE,         description: '직사각 머리 + 페데스탈' },
];

// ─── 유틸리티 ───

/** Tier별 랜드마크 필터 */
export const TIER_1_LANDMARKS = LANDMARKS.filter(l => l.tier === LandmarkTier.TIER_1);
export const TIER_2_LANDMARKS = LANDMARKS.filter(l => l.tier <= LandmarkTier.TIER_2);

/** 총 개수 상수 */
export const LANDMARK_COUNT = LANDMARKS.length; // 42
