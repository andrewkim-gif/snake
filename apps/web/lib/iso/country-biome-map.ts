/**
 * country-biome-map.ts
 *
 * Phase 1: 195국 ISO3 → 바이옴(기후대) 매핑
 * 대륙 + 위도 기반 자동 할당 + 수동 오버라이드
 *
 * 참조: docs/designs/v27-iso-map-plan.md 섹션 2.2
 *
 * @generated 2026-03-09 Phase 1
 */

import type { BiomeType } from '../../components/game/iso/types';

// ============================================================================
// 도시국가 목록 (최우선 매핑)
// ============================================================================

/** 도시국가 ISO3 코드 — Urban 바이옴 강제 */
const URBAN_CITY_STATES: ReadonlySet<string> = new Set([
  'SGP', // 싱가포르
  'MCO', // 모나코
  'HKG', // 홍콩
  'MAC', // 마카오
  'VAT', // 바티칸
  'AND', // 안도라
  'LIE', // 리히텐슈타인
  'SMR', // 산마리노
  'MLT', // 몰타
]);

// ============================================================================
// 건조 기후 국가 수동 지정
// ============================================================================

/** 중동/북아프리카 건조 국가 */
const ARID_COUNTRIES: ReadonlySet<string> = new Set([
  'SAU', 'IRQ', 'IRN', 'ARE', 'KWT', 'QAT', 'BHR', 'OMN', 'YEM',
  'LBY', 'DZA', 'EGY', 'SDN', 'TCD', 'NER', 'MLI', 'MRT',
  'SOM', 'DJI', 'ERI',
  'AFG', 'TKM', 'UZB',
  'NAM', 'BWA', // 칼라하리
]);

// ============================================================================
// 지중해 국가 수동 지정
// ============================================================================

/** 남유럽/지중해 연안 */
const MEDITERRANEAN_COUNTRIES: ReadonlySet<string> = new Set([
  'ITA', 'GRC', 'ESP', 'PRT', 'HRV', 'CYP', 'TUR',
  'MNE', 'ALB', 'MKD',
  'TUN', 'MAR', // 북아프리카 지중해 연안
  'LBN', 'ISR', 'JOR', 'PSE', // 동지중해
]);

// ============================================================================
// PLACEHOLDER: 195국 정적 매핑 테이블
// ============================================================================

// SECTION_STATIC_MAP_START

/** 195국 ISO3 → 바이옴 정적 매핑 */
export const COUNTRY_BIOME_MAP: Record<string, BiomeType> = {
  // ── 동아시아 (East Asia) ──
  KOR: 'temperate',    // 한국
  PRK: 'temperate',    // 북한
  JPN: 'temperate',    // 일본
  CHN: 'temperate',    // 중국
  MNG: 'arid',         // 몽골
  TWN: 'tropical',     // 대만

  // ── 동남아시아 (Southeast Asia) ──
  VNM: 'tropical',     // 베트남
  THA: 'tropical',     // 태국
  MMR: 'tropical',     // 미얀마
  KHM: 'tropical',     // 캄보디아
  LAO: 'tropical',     // 라오스
  MYS: 'tropical',     // 말레이시아
  IDN: 'tropical',     // 인도네시아
  PHL: 'tropical',     // 필리핀
  BRN: 'tropical',     // 브루나이
  TLS: 'tropical',     // 동티모르
  SGP: 'urban',        // 싱가포르

  // ── 남아시아 (South Asia) ──
  IND: 'tropical',     // 인도
  PAK: 'arid',         // 파키스탄
  BGD: 'tropical',     // 방글라데시
  LKA: 'tropical',     // 스리랑카
  NPL: 'temperate',    // 네팔
  BTN: 'temperate',    // 부탄
  MDV: 'tropical',     // 몰디브

  // ── 중앙아시아 (Central Asia) ──
  KAZ: 'arid',         // 카자흐스탄
  UZB: 'arid',         // 우즈베키스탄
  TKM: 'arid',         // 투르크메니스탄
  KGZ: 'temperate',    // 키르기스스탄
  TJK: 'temperate',    // 타지키스탄

  // ── 서아시아/중동 (West Asia / Middle East) ──
  SAU: 'arid',         // 사우디아라비아
  IRQ: 'arid',         // 이라크
  IRN: 'arid',         // 이란
  ARE: 'arid',         // UAE
  KWT: 'arid',         // 쿠웨이트
  QAT: 'arid',         // 카타르
  BHR: 'arid',         // 바레인
  OMN: 'arid',         // 오만
  YEM: 'arid',         // 예멘
  SYR: 'arid',         // 시리아
  LBN: 'mediterranean', // 레바논
  ISR: 'mediterranean', // 이스라엘
  JOR: 'arid',         // 요르단
  PSE: 'mediterranean', // 팔레스타인
  TUR: 'mediterranean', // 튀르키예
  GEO: 'temperate',    // 조지아
  ARM: 'temperate',    // 아르메니아
  AZE: 'temperate',    // 아제르바이잔
  AFG: 'arid',         // 아프가니스탄

  // ── 서유럽 (Western Europe) ──
  GBR: 'temperate',    // 영국
  FRA: 'temperate',    // 프랑스
  DEU: 'temperate',    // 독일
  NLD: 'temperate',    // 네덜란드
  BEL: 'temperate',    // 벨기에
  LUX: 'temperate',    // 룩셈부르크
  IRL: 'temperate',    // 아일랜드
  CHE: 'temperate',    // 스위스
  AUT: 'temperate',    // 오스트리아

  // ── 남유럽 (Southern Europe) ──
  ITA: 'mediterranean', // 이탈리아
  ESP: 'mediterranean', // 스페인
  PRT: 'mediterranean', // 포르투갈
  GRC: 'mediterranean', // 그리스
  HRV: 'mediterranean', // 크로아티아
  SVN: 'temperate',    // 슬로베니아
  CYP: 'mediterranean', // 키프로스
  MNE: 'mediterranean', // 몬테네그로
  ALB: 'mediterranean', // 알바니아
  MKD: 'mediterranean', // 북마케도니아
  BIH: 'temperate',    // 보스니아
  SRB: 'temperate',    // 세르비아
  MCO: 'urban',        // 모나코
  AND: 'urban',        // 안도라
  SMR: 'urban',        // 산마리노
  VAT: 'urban',        // 바티칸
  MLT: 'urban',        // 몰타

  // ── 북유럽 (Northern Europe) ──
  SWE: 'temperate',    // 스웨덴
  NOR: 'arctic',       // 노르웨이
  FIN: 'arctic',       // 핀란드
  DNK: 'temperate',    // 덴마크
  ISL: 'arctic',       // 아이슬란드

  // ── 동유럽 (Eastern Europe) ──
  RUS: 'arctic',       // 러시아
  UKR: 'temperate',    // 우크라이나
  POL: 'temperate',    // 폴란드
  CZE: 'temperate',    // 체코
  SVK: 'temperate',    // 슬로바키아
  HUN: 'temperate',    // 헝가리
  ROU: 'temperate',    // 루마니아
  BGR: 'temperate',    // 불가리아
  MDA: 'temperate',    // 몰도바
  BLR: 'temperate',    // 벨라루스
  LTU: 'temperate',    // 리투아니아
  LVA: 'temperate',    // 라트비아
  EST: 'temperate',    // 에스토니아
  LIE: 'urban',        // 리히텐슈타인

  // ── 북아프리카 (North Africa) ──
  EGY: 'arid',         // 이집트
  LBY: 'arid',         // 리비아
  TUN: 'mediterranean', // 튀니지
  DZA: 'arid',         // 알제리
  MAR: 'mediterranean', // 모로코
  SDN: 'arid',         // 수단
  SSD: 'tropical',     // 남수단

  // ── 서아프리카 (West Africa) ──
  NGA: 'tropical',     // 나이지리아
  GHA: 'tropical',     // 가나
  SEN: 'tropical',     // 세네갈
  CIV: 'tropical',     // 코트디부아르
  MLI: 'arid',         // 말리
  BFA: 'arid',         // 부르키나파소
  NER: 'arid',         // 니제르
  GIN: 'tropical',     // 기니
  SLE: 'tropical',     // 시에라리온
  LBR: 'tropical',     // 라이베리아
  TGO: 'tropical',     // 토고
  BEN: 'tropical',     // 베닌
  MRT: 'arid',         // 모리타니
  GMB: 'tropical',     // 감비아
  GNB: 'tropical',     // 기니비사우
  CPV: 'arid',         // 카보베르데

  // ── 중앙아프리카 (Central Africa) ──
  COD: 'tropical',     // 콩고민주공화국
  COG: 'tropical',     // 콩고공화국
  CMR: 'tropical',     // 카메룬
  GAB: 'tropical',     // 가봉
  GNQ: 'tropical',     // 적도기니
  TCD: 'arid',         // 차드
  CAF: 'tropical',     // 중앙아프리카공화국
  STP: 'tropical',     // 상투메프린시페

  // ── 동아프리카 (East Africa) ──
  ETH: 'tropical',     // 에티오피아
  KEN: 'tropical',     // 케냐
  TZA: 'tropical',     // 탄자니아
  UGA: 'tropical',     // 우간다
  RWA: 'tropical',     // 르완다
  BDI: 'tropical',     // 부룬디
  SOM: 'arid',         // 소말리아
  DJI: 'arid',         // 지부티
  ERI: 'arid',         // 에리트레아
  MDG: 'tropical',     // 마다가스카르
  MUS: 'tropical',     // 모리셔스
  COM: 'tropical',     // 코모로
  SYC: 'tropical',     // 세이셸

  // ── 남아프리카 (Southern Africa) ──
  ZAF: 'temperate',    // 남아프리카공화국
  NAM: 'arid',         // 나미비아
  BWA: 'arid',         // 보츠와나
  ZWE: 'tropical',     // 짐바브웨
  ZMB: 'tropical',     // 잠비아
  MWI: 'tropical',     // 말라위
  MOZ: 'tropical',     // 모잠비크
  AGO: 'tropical',     // 앙골라
  SWZ: 'tropical',     // 에스와티니
  LSO: 'temperate',    // 레소토

  // ── 북미 (North America) ──
  USA: 'temperate',    // 미국
  CAN: 'temperate',    // 캐나다
  MEX: 'tropical',     // 멕시코

  // ── 중미 (Central America) ──
  GTM: 'tropical',     // 과테말라
  BLZ: 'tropical',     // 벨리즈
  HND: 'tropical',     // 온두라스
  SLV: 'tropical',     // 엘살바도르
  NIC: 'tropical',     // 니카라과
  CRI: 'tropical',     // 코스타리카
  PAN: 'tropical',     // 파나마

  // ── 카리브 (Caribbean) ──
  CUB: 'tropical',     // 쿠바
  HTI: 'tropical',     // 아이티
  DOM: 'tropical',     // 도미니카공화국
  JAM: 'tropical',     // 자메이카
  TTO: 'tropical',     // 트리니다드토바고
  BHS: 'tropical',     // 바하마
  BRB: 'tropical',     // 바베이도스
  ATG: 'tropical',     // 앤티가바부다
  DMA: 'tropical',     // 도미니카
  GRD: 'tropical',     // 그레나다
  KNA: 'tropical',     // 세인트키츠네비스
  LCA: 'tropical',     // 세인트루시아
  VCT: 'tropical',     // 세인트빈센트그레나딘

  // ── 남미 (South America) ──
  BRA: 'tropical',     // 브라질
  ARG: 'temperate',    // 아르헨티나
  COL: 'tropical',     // 콜롬비아
  PER: 'tropical',     // 페루
  VEN: 'tropical',     // 베네수엘라
  CHL: 'temperate',    // 칠레
  ECU: 'tropical',     // 에콰도르
  BOL: 'tropical',     // 볼리비아
  PRY: 'tropical',     // 파라과이
  URY: 'temperate',    // 우루과이
  GUY: 'tropical',     // 가이아나
  SUR: 'tropical',     // 수리남

  // ── 오세아니아 (Oceania) ──
  AUS: 'arid',         // 호주
  NZL: 'temperate',    // 뉴질랜드
  PNG: 'tropical',     // 파푸아뉴기니
  FJI: 'tropical',     // 피지
  SLB: 'tropical',     // 솔로몬제도
  VUT: 'tropical',     // 바누아투
  WSM: 'tropical',     // 사모아
  TON: 'tropical',     // 통가
  KIR: 'tropical',     // 키리바시
  FSM: 'tropical',     // 미크로네시아
  MHL: 'tropical',     // 마샬제도
  PLW: 'tropical',     // 팔라우
  NRU: 'tropical',     // 나우루
  TUV: 'tropical',     // 투발루

  // ── 특수 (추가) ──
  HKG: 'urban',        // 홍콩
  MAC: 'urban',        // 마카오
};

// SECTION_STATIC_MAP_END

// ============================================================================
// 위도/대륙 기반 자동 매핑 함수
// ============================================================================

/**
 * 국가 정보로 바이옴을 자동 결정
 *
 * 우선순위:
 * 1. 정적 매핑 테이블 (COUNTRY_BIOME_MAP)
 * 2. 도시국가 → urban
 * 3. 건조 수동 목록 → arid
 * 4. 지중해 수동 목록 → mediterranean
 * 5. 대륙 + 위도 기반 규칙
 *
 * @param iso3 ISO 3166-1 alpha-3 국가 코드
 * @param continent 대륙명 (Asia, Europe, Africa, North America, South America, Oceania)
 * @param latitude 위도 (양수=북반구, 음수=남반구)
 */
export function getCountryBiome(
  iso3: string,
  continent?: string,
  latitude?: number,
): BiomeType {
  // 1. 정적 테이블 우선
  const staticBiome = COUNTRY_BIOME_MAP[iso3];
  if (staticBiome) return staticBiome;

  // 2. 도시국가
  if (URBAN_CITY_STATES.has(iso3)) return 'urban';

  // 3. 건조 수동 목록
  if (ARID_COUNTRIES.has(iso3)) return 'arid';

  // 4. 지중해 수동 목록
  if (MEDITERRANEAN_COUNTRIES.has(iso3)) return 'mediterranean';

  // 5. 대륙 + 위도 기반 자동 규칙
  if (continent && latitude !== undefined) {
    return inferBiomeFromGeo(continent, latitude);
  }

  // 폴백
  return 'temperate';
}

/**
 * 대륙 + 위도로 바이옴 추론
 */
function inferBiomeFromGeo(continent: string, latitude: number): BiomeType {
  const absLat = Math.abs(latitude);

  // 극지: 위도 60도 이상
  if (absLat > 60) return 'arctic';

  switch (continent) {
    case 'Africa':
      if (latitude > 20 || latitude < -25) return 'arid';
      return 'tropical';

    case 'South America':
      if (latitude < -30) return 'temperate';
      return 'tropical';

    case 'Asia':
      if (latitude < 10) return 'tropical';
      if (latitude > 50) return 'arctic';
      return 'temperate';

    case 'Europe':
      if (latitude > 60) return 'arctic';
      return 'temperate';

    case 'Oceania':
      if (absLat > 30) return 'temperate'; // 뉴질랜드 남부
      return 'tropical';

    case 'North America':
      if (latitude > 55) return 'arctic';
      if (latitude < 20) return 'tropical';
      return 'temperate';

    default:
      return 'temperate';
  }
}
