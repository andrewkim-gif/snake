/**
 * landmark-data.ts -- 195국 랜드마크 데이터 (v20 Phase 3+4)
 *
 * 42 아키타입 + 195국 문화권 기반 재매핑:
 *   - 기존 20종 유지 + 3종 개선(DOME->MOSQUE, TERRACE->TERRACED_FIELD, CASTLE/OBELISK 범위 축소)
 *   - 4종 폐지(MONOLITH, MESA, TILTED_TOWER, TERRACE)
 *   - 19종 신규 추가 (대륙/문화권별 고유 형태)
 *   - 195국 재매핑 (MONOLITH 54국 해소, 최대 공유 12국 이하)
 *
 * v29 Phase 1: 바이옴 데이터 파이프라인 연결
 *   - Landmark 인터페이스에 biome 필드 추가
 *   - generateLandmarksFromCentroids에서 getCountryBiome(iso3) 호출
 */

import type { BiomeType } from '@/components/game/iso/types';
import { getCountryBiome } from '@/lib/iso/country-biome-map';

// ─── Enums ───

export enum LandmarkArchetype {
  // 기존 유지 (20종)
  TOWER = 'TOWER',
  PYRAMID = 'PYRAMID',
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
  TEMPLE = 'TEMPLE',
  GATE = 'GATE',
  WINDMILL = 'WINDMILL',
  STONE_RING = 'STONE_RING',

  // 기존 개선 (3종) — DOME->MOSQUE, TERRACE->TERRACED_FIELD, CASTLE/OBELISK 범위 축소
  MOSQUE = 'MOSQUE',
  CASTLE = 'CASTLE',
  OBELISK = 'OBELISK',
  TERRACED_FIELD = 'TERRACED_FIELD',

  // 신규 아프리카 (5종)
  MUD_TOWER = 'MUD_TOWER',
  THATCHED_HUT = 'THATCHED_HUT',
  FORT = 'FORT',
  MINARET = 'MINARET',
  BAOBAB = 'BAOBAB',

  // 신규 아시아 (5종)
  STUPA = 'STUPA',
  TORII = 'TORII',
  WAT = 'WAT',
  GOPURAM = 'GOPURAM',
  YURT = 'YURT',

  // 신규 유럽 (4종)
  CATHEDRAL = 'CATHEDRAL',
  FORTRESS = 'FORTRESS',
  VIKING_SHIP = 'VIKING_SHIP',
  ORTHODOX_CROSS = 'ORTHODOX_CROSS',

  // 신규 아메리카/오세아니아 (5종)
  COLONIAL_CHURCH = 'COLONIAL_CHURCH',
  LIGHTHOUSE = 'LIGHTHOUSE',
  TIKI_HUT = 'TIKI_HUT',
  CORAL_SHRINE = 'CORAL_SHRINE',
  CHRIST_STATUE = 'CHRIST_STATUE',
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
  biome: BiomeType;
}

// ─── ISO3 -> Archetype 매핑 (195국) ───
// 42 아키타입 기반 문화권 정확 매핑

const A = LandmarkArchetype;

export const COUNTRY_ARCHETYPE: Record<string, LandmarkArchetype> = {
  // === S-Tier (8) -- 초강대국 ===
  USA: A.STATUE,           // 자유의 여신상
  CHN: A.WALL,             // 만리장성
  RUS: A.ONION_DOME,       // 성 바실리 성당
  IND: A.GOPURAM,          // 남인도 사원탑
  BRA: A.CHRIST_STATUE,    // 구세주 그리스도상
  JPN: A.TORII,            // 후시미이나리 토리이
  DEU: A.GATE,             // 브란덴부르크 문
  GBR: A.CLOCK_TOWER,      // 빅벤

  // === A-Tier (20) -- 주요국 ===
  KOR: A.PAGODA,           // 경복궁
  FRA: A.TOWER,            // 에펠탑
  CAN: A.NEEDLE,           // CN 타워
  AUS: A.SHELLS,           // 시드니 오페라하우스
  SAU: A.MOSQUE,           // 메카 모스크
  TUR: A.MOSQUE,           // 하기아 소피아
  IDN: A.STUPA,            // 보로부두르
  MEX: A.PYRAMID,          // 치첸이트사
  ITA: A.ARENA,            // 콜로세움
  ESP: A.SPIRE_CLUSTER,    // 사그라다 파밀리아
  IRN: A.MOSQUE,           // 이맘 모스크
  EGY: A.PYRAMID,          // 기자 피라미드
  PAK: A.MOSQUE,           // 바드샤히 모스크
  NGA: A.MUD_TOWER,        // 아부자 / 서아프리카 진흙 건축
  ISR: A.TEMPLE,           // 통곡의 벽 / 성전산
  POL: A.CATHEDRAL,        // 바벨 성 → 고딕 성당
  ZAF: A.MOUNTAIN,         // 테이블 마운틴
  UKR: A.ORTHODOX_CROSS,   // 키이우 소피아 성당 → 정교회
  NLD: A.WINDMILL,         // 풍차
  SWE: A.VIKING_SHIP,      // 바사 박물관 / 바이킹 문화

  // === B-Tier (40) -- 지역 강국 ===
  THA: A.WAT,              // 왓 아룬
  ARG: A.OBELISK,          // 부에노스아이레스 오벨리스크
  COL: A.COLONIAL_CHURCH,  // 카르타헤나 식민지 성당
  MYS: A.TWIN_TOWER,       // 페트로나스 타워
  PHL: A.TERRACED_FIELD,   // 바나웨 계단식 논
  VNM: A.PAGODA,           // 한기둥 사원
  BGD: A.STUPA,            // 파하르푸르 불교 비하라 유적
  NOR: A.VIKING_SHIP,      // 바이킹 문화
  CHE: A.MOUNTAIN,         // 마터호른
  AUT: A.CATHEDRAL,        // 성 슈테판 대성당
  BEL: A.SKYSCRAPER,       // 아토미움
  CHL: A.STATUE,           // 모아이
  PER: A.TERRACED_FIELD,   // 마추픽추
  VEN: A.MOUNTAIN,         // 앙헬 폭포
  IRQ: A.MOSQUE,           // 사마라 모스크
  KWT: A.NEEDLE,           // 쿠웨이트 타워
  ARE: A.NEEDLE,           // 부르즈 칼리파
  QAT: A.SKYSCRAPER,       // 도하 스카이라인
  SGP: A.BRIDGE_TOP,       // 마리나 베이 샌즈
  FIN: A.FORTRESS,         // 수오멘린나 요새
  DNK: A.VIKING_SHIP,      // 바이킹 문화
  IRL: A.CASTLE,           // 벙케리 성
  PRT: A.TOWER,            // 벨렝 타워
  GRC: A.TEMPLE,           // 파르테논
  CZE: A.CATHEDRAL,        // 성 비투스 대성당
  ROU: A.FORTRESS,         // 브란 성 → 요새
  NZL: A.NEEDLE,           // 스카이 타워
  KAZ: A.YURT,             // 유르트 유목 문화
  ETH: A.OBELISK,          // 악숨 오벨리스크
  DZA: A.MOSQUE,           // 케찌와 모스크
  MAR: A.MINARET,          // 하산 2세 모스크 미나렛
  KEN: A.BAOBAB,           // 바오밥 / 사바나
  MMR: A.STUPA,            // 쉐다곤 파고다 → 스투파
  TWN: A.TOWER,            // 타이페이 101
  HUN: A.CATHEDRAL,        // 국회의사당 고딕 양식
  PRK: A.OBELISK,          // 주체탑
  CUB: A.COLONIAL_CHURCH,  // 하바나 식민지 성당
  LBY: A.MOSQUE,           // 트리폴리 모스크
  AGO: A.FORT,             // 포르투갈 요새
  COD: A.MUD_TOWER,        // 콩고 진흙 건축

  // === C-Tier (80) -- 중간국 ===
  // 동유럽
  SVK: A.CATHEDRAL,        // 성 엘리자베스 대성당
  SVN: A.CASTLE,           // 류블라나 성
  HRV: A.ARENA,            // 풀라 아레나
  SRB: A.FORTRESS,         // 베오그라드 요새
  BGR: A.ORTHODOX_CROSS,   // 알렉산더 네프스키 성당
  LTU: A.CATHEDRAL,        // 빌뉴스 대성당
  LVA: A.CASTLE,           // 리가 성
  EST: A.CASTLE,           // 톰페아 성

  // 동유럽2
  BLR: A.FORTRESS,         // 미르 성
  GEO: A.ORTHODOX_CROSS,   // 성 삼위일체 대성당
  ARM: A.ORTHODOX_CROSS,   // 에치미아진 대성당
  AZE: A.TOWER,            // 바쿠 화염탑 (Flame Towers)

  // 중앙아시아
  UZB: A.MINARET,          // 칼란 미나렛
  TKM: A.YURT,             // 투르크메니스탄 유목 문화
  KGZ: A.YURT,             // 유르트 유목
  TJK: A.YURT,             // 유르트 유목

  // 중동
  AFG: A.MOSQUE,           // 블루 모스크
  NPL: A.STUPA,            // 보드나트 스투파
  LKA: A.STUPA,            // 룸비니 / 불교 스투파
  KHM: A.TEMPLE,           // 앙코르 와트
  LAO: A.STUPA,            // 탓 루앙
  MNG: A.YURT,             // 몽골 게르
  JOR: A.TEMPLE,           // 페트라
  LBN: A.TEMPLE,           // 바알베크
  SYR: A.MOSQUE,           // 우마이야드 모스크
  YEM: A.MUD_TOWER,        // 시밤 진흙 고층 건물
  OMN: A.MOSQUE,           // 술탄 카부스 모스크
  BHR: A.NEEDLE,           // 바레인 WTC

  // 중남미
  ECU: A.COLONIAL_CHURCH,  // 키토 식민지 성당
  BOL: A.TERRACED_FIELD,   // 티와나쿠 계단
  PRY: A.COLONIAL_CHURCH,  // 예수회 선교소
  URY: A.OBELISK,          // 몬테비데오 오벨리스크

  // 중미
  PAN: A.BRIDGE,           // 파나마 운하
  CRI: A.MOUNTAIN,         // 화산
  GTM: A.PYRAMID,          // 티칼
  HND: A.PYRAMID,          // 코판
  SLV: A.COLONIAL_CHURCH,  // 산살바도르 성당
  NIC: A.COLONIAL_CHURCH,  // 레온 성당

  // 카리브
  DOM: A.COLONIAL_CHURCH,  // 산토도밍고 성당
  HTI: A.COLONIAL_CHURCH,  // 아이티 성당
  JAM: A.LIGHTHOUSE,       // 포트로얄 등대
  TTO: A.LIGHTHOUSE,       // 트리니다드 등대

  // 서아프리카
  CMR: A.MUD_TOWER,        // 무스굼 진흙집
  GHA: A.GATE,             // 케이프코스트 성문
  CIV: A.MUD_TOWER,        // 코트디부아르 진흙 건축
  SEN: A.FORT,             // 고레 섬 요새
  MLI: A.MUD_TOWER,        // 젠네 대모스크
  BFA: A.MUD_TOWER,        // 부르키나파소 진흙 건축
  NER: A.MINARET,          // 아가데즈 모스크
  TCD: A.MUD_TOWER,        // 차드 진흙 건축

  // 동/남아프리카
  SDN: A.MINARET,          // 수단 미나렛
  SSD: A.THATCHED_HUT,     // 남수단 초가집
  ERI: A.OBELISK,          // 에리트레아 석비
  DJI: A.FORT,             // 지부티 요새
  SOM: A.MINARET,          // 소말리아 모스크 미나렛
  UGA: A.THATCHED_HUT,     // 우간다 초가
  RWA: A.THATCHED_HUT,     // 르완다 초가
  BDI: A.THATCHED_HUT,     // 부룬디 초가

  // 동남아프리카
  TZA: A.BAOBAB,           // 탄자니아 바오밥
  MOZ: A.BAOBAB,           // 모잠비크 바오밥
  MDG: A.BAOBAB,           // 마다가스카르 바오밥 거리
  ZMB: A.THATCHED_HUT,     // 잠비아 초가
  ZWE: A.STONE_RING,       // 그레이트 짐바브웨
  MWI: A.THATCHED_HUT,     // 말라위 초가
  BWA: A.THATCHED_HUT,     // 보츠와나 초가
  NAM: A.MOUNTAIN,         // 나미비아 산악
  LSO: A.MOUNTAIN,         // 레소토 산악
  SWZ: A.THATCHED_HUT,     // 에스와티니 초가

  // 북아프리카
  TUN: A.MINARET,          // 튀니지 미나렛
  MRT: A.MINARET,          // 모리타니 미나렛

  // 중앙아프리카
  GAB: A.THATCHED_HUT,     // 가봉 전통 가옥
  COG: A.THATCHED_HUT,     // 콩고 전통 가옥
  GNQ: A.COLONIAL_CHURCH,  // 적도기니 식민지 성당
  CAF: A.THATCHED_HUT,     // 중앙아프리카 초가

  // 태평양
  PNG: A.TIKI_HUT,         // 파푸아뉴기니 전통 가옥
  FJI: A.TIKI_HUT,         // 피지 전통 가옥
  SLB: A.CORAL_SHRINE,     // 솔로몬 산호 신전
  VUT: A.TIKI_HUT,         // 바누아투 전통 가옥
  WSM: A.TIKI_HUT,         // 사모아 팔레
  TON: A.TIKI_HUT,         // 통가 전통 가옥

  // === D-Tier (~47) -- 소국 ===
  // 유럽 소국
  LUX: A.CASTLE,           // 룩셈부르크 성
  MCO: A.SKYSCRAPER,       // 모나코 고층
  LIE: A.CASTLE,           // 리히텐슈타인 성
  AND: A.CASTLE,           // 안도라 성
  MLT: A.LIGHTHOUSE,       // 몰타 등대
  ISL: A.VIKING_SHIP,      // 아이슬란드 바이킹
  CYP: A.TEMPLE,           // 키프로스 고대 신전
  MNE: A.FORTRESS,         // 몬테네그로 요새
  ALB: A.FORTRESS,         // 알바니아 요새
  MKD: A.ORTHODOX_CROSS,   // 북마케도니아 정교회
  BIH: A.BRIDGE,           // 모스타르 다리
  MDA: A.ORTHODOX_CROSS,   // 몰도바 정교회
  SMR: A.CASTLE,           // 산마리노 성

  // 동남아 소국
  BRN: A.MOSQUE,           // 오마르 알리 사이푸딘 모스크
  TLS: A.TIKI_HUT,         // 동티모르 전통 가옥

  // 남아시아 소국
  BTN: A.STUPA,            // 부탄 스투파
  MDV: A.CORAL_SHRINE,     // 몰디브 산호

  // 카리브 소국
  BRB: A.LIGHTHOUSE,       // 바베이도스 등대
  BHS: A.LIGHTHOUSE,       // 바하마 등대
  BLZ: A.PYRAMID,          // 벨리즈 마야 피라미드
  GUY: A.COLONIAL_CHURCH,  // 가이아나 식민지 성당
  SUR: A.COLONIAL_CHURCH,  // 수리남 식민지 성당

  // 동카리브 소국
  ATG: A.LIGHTHOUSE,       // 앤티가 등대
  DMA: A.TIKI_HUT,         // 도미니카 전통 가옥
  GRD: A.LIGHTHOUSE,       // 그레나다 등대
  KNA: A.FORT,             // 세인트키츠 브림스톤힐 요새
  LCA: A.LIGHTHOUSE,       // 세인트루시아 등대
  VCT: A.LIGHTHOUSE,       // 세인트빈센트 등대

  // 아프리카 소국/도서
  MUS: A.CORAL_SHRINE,     // 모리셔스 산호 해안
  SYC: A.CORAL_SHRINE,     // 세이셸 산호
  COM: A.CORAL_SHRINE,     // 코모로 산호
  CPV: A.FORT,             // 카보베르데 포르투갈 요새
  STP: A.TIKI_HUT,         // 상투메프린시페

  // 서아프리카 소국
  GNB: A.FORT,             // 기니비사우 요새
  GMB: A.FORT,             // 감비아 요새
  SLE: A.FORT,             // 시에라리온 요새
  LBR: A.FORT,             // 라이베리아 요새
  TGO: A.MUD_TOWER,        // 토고 진흙 타워
  BEN: A.MUD_TOWER,        // 베냉 진흙 타워

  // 태평양 소국
  PLW: A.CORAL_SHRINE,     // 팔라우 산호
  MHL: A.CORAL_SHRINE,     // 마셜제도 산호
  FSM: A.CORAL_SHRINE,     // 미크로네시아 산호
  NRU: A.CORAL_SHRINE,     // 나우루 산호
  TUV: A.CORAL_SHRINE,     // 투발루 산호
  KIR: A.CORAL_SHRINE,     // 키리바시 산호

  // 기타
  PSE: A.TEMPLE,           // 팔레스타인 알아크사 / 성지
  XKX: A.MOSQUE,           // 코소보 모스크
};

// ─── ISO3 -> Tier 매핑 (서버 Tier에 기반) ───
// S-Tier, A-Tier -> TIER_1 (항상 표시)
// B-Tier -> TIER_2 (중간 줌)
// C-Tier, D-Tier -> TIER_3 (근접 줌)

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

export function getArchetypeForISO3(iso3: string): LandmarkArchetype {
  return COUNTRY_ARCHETYPE[iso3] || LandmarkArchetype.STONE_RING;
}

// ─── 동적 랜드마크 생성 ───

/**
 * countryCentroids Map에서 전체 Landmark 배열을 생성
 * GlobeLandmarks에서 호출 -- GeoJSON 기반 centroid 좌표 사용
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
      biome: getCountryBiome(iso3),
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
