/**
 * region-data.ts — v39 195개국 지역(Region) 데이터
 *
 * 주요 20개국은 수동 정의 (실제 지명 기반)
 * 나머지 175개국은 자동생성 유틸리티로 처리
 *
 * 국가 티어별:
 *   S(8) = 7지역, A(20) = 5지역, B(40) = 4지역, C(80) = 3지역, D(47) = 3지역
 */

import type {
  IRegionDef,
  ICountryRegions,
  CountryTier,
  RegionType,
  ResourceType,
  BiomeType,
  IRegionEffects,
} from '../types/region';
import { TIER_CONFIG, REGION_TYPE_EFFECTS } from '../types/region';
import { COUNTRY_TIER_MAP, getCountryTier } from './country-tiers';
import { COUNTRIES } from '../../country-data';

// ── 국가별 특산 자원 매핑 ──

/** 국가별 특산 자원 (ISO3 → 특산 자원명) */
export const COUNTRY_SPECIALTY: Record<string, string> = {
  // S 티어
  USA: 'oil', CHN: 'rare_earth', RUS: 'natural_gas', IND: 'spices',
  JPN: 'automobile', DEU: 'precision_machinery', GBR: 'finance', FRA: 'luxury_goods',
  // A 티어
  KOR: 'semiconductor', BRA: 'biofuel', CAN: 'timber', AUS: 'iron_ore',
  ITA: 'fashion', TUR: 'textiles', SAU: 'crude_oil', MEX: 'silver',
  IDN: 'palm_oil', ESP: 'olive_oil', NLD: 'tulips', POL: 'copper',
  ARG: 'beef', ZAF: 'diamond', EGY: 'cotton', PAK: 'rice',
  NGA: 'crude_oil', IRN: 'saffron', ISR: 'tech_startup', UKR: 'wheat',
  // B 티어 (일부)
  THA: 'rubber', VNM: 'coffee', MYS: 'tin', PHL: 'coconut',
  SGP: 'electronics', TWN: 'semiconductor', SWE: 'iron_ore', NOR: 'salmon',
  CHE: 'watches', AUT: 'crystal', BEL: 'chocolate', CZE: 'beer',
  ROU: 'wood', PRT: 'cork', GRC: 'marble', HUN: 'paprika',
  DNK: 'wind_energy', FIN: 'paper', IRL: 'whiskey', NZL: 'wool',
  CHL: 'copper', COL: 'emerald', PER: 'gold', VEN: 'oil',
  BGD: 'jute', LKA: 'tea', MMR: 'jade', KAZ: 'uranium',
  UZB: 'cotton', ETH: 'coffee', KEN: 'tea', TZA: 'tanzanite',
  MAR: 'phosphate', DZA: 'natural_gas', IRQ: 'oil', CUB: 'sugar',
  PRK: 'coal', SRB: 'raspberry', BGR: 'rose_oil', SVK: 'cars',
};

// ── 수동 정의 지역 데이터 (주요 20개국) ──

/** 지역 유형별 기본 효과를 복사하는 헬퍼 */
function makeEffects(type: RegionType): IRegionEffects {
  return { ...REGION_TYPE_EFFECTS[type] };
}

/** 지역 정의 빌더 헬퍼 */
function region(
  countryCode: string,
  slug: string,
  name: string,
  nameEn: string,
  type: RegionType,
  primaryResource: ResourceType,
  biome: BiomeType,
  specialEffect: string,
  tier: CountryTier,
): IRegionDef {
  const cfg = TIER_CONFIG[tier];
  return {
    id: `${countryCode}_${slug}`,
    countryCode,
    name,
    nameEn,
    type,
    primaryResource,
    specialtyResource: COUNTRY_SPECIALTY[countryCode] ?? 'generic',
    biome,
    specialEffect,
    effects: makeEffects(type),
    arenaSize: cfg.arenaSize,
    maxPlayers: cfg.maxPlayers,
  };
}

// ──────────────────────────────────────────────
// S 티어 (8개국, 7지역)
// ──────────────────────────────────────────────

const USA_REGIONS: IRegionDef[] = [
  region('USA', 'dc', '워싱턴 D.C.', 'Washington D.C.', 'capital', 'tech', 'urban', 'PvP 데미지 +10% (정치 밀집)', 'S'),
  region('USA', 'ny', '뉴욕', 'New York', 'port', 'gold', 'urban', '교역 수수료 -20% (금융 허브)', 'S'),
  region('USA', 'texas', '텍사스', 'Texas', 'resource', 'oil', 'desert', '자원 수집량 x1.5 (석유 벨트)', 'S'),
  region('USA', 'california', '캘리포니아', 'California', 'industrial', 'tech', 'coastal', '생산 속도 +15% (실리콘밸리)', 'S'),
  region('USA', 'midwest', '중서부', 'Midwest', 'agricultural', 'food', 'farmland', 'HP 재생 +10% (곡창지대)', 'S'),
  region('USA', 'virginia', '버지니아', 'Virginia', 'military', 'oil', 'forest', '방어 +15% (펜타곤 인접)', 'S'),
  region('USA', 'hawaii', '하와이', 'Hawaii', 'cultural', 'influence', 'tropical', '외교 영향력 +20% (태평양 관문)', 'S'),
];

const CHN_REGIONS: IRegionDef[] = [
  region('CHN', 'beijing', '베이징', 'Beijing', 'capital', 'tech', 'urban', 'PvP 데미지 +10% (수도 밀집)', 'S'),
  region('CHN', 'shanghai', '상하이', 'Shanghai', 'port', 'gold', 'coastal', '교역 수수료 -20% (무역 중심)', 'S'),
  region('CHN', 'shenzhen', '선전', 'Shenzhen', 'industrial', 'tech', 'urban', '생산 속도 +15% (기술 허브)', 'S'),
  region('CHN', 'xinjiang', '신장', 'Xinjiang', 'resource', 'minerals', 'desert', '자원 수집량 x1.5 (자원 지대)', 'S'),
  region('CHN', 'sichuan', '쓰촨', 'Sichuan', 'agricultural', 'food', 'mountain', 'HP 재생 +10% (곡창)', 'S'),
  region('CHN', 'inner_mongolia', '내몽골', 'Inner Mongolia', 'military', 'oil', 'tundra', '방어 +15% (북방 전선)', 'S'),
  region('CHN', 'xian', '시안', 'Xi\'an', 'cultural', 'influence', 'cultural_heritage', '외교 영향력 +20% (실크로드)', 'S'),
];

const RUS_REGIONS: IRegionDef[] = [
  region('RUS', 'moscow', '모스크바', 'Moscow', 'capital', 'tech', 'urban', 'PvP 데미지 +10% (크렘린)', 'S'),
  region('RUS', 'st_petersburg', '상트페테르부르크', 'St. Petersburg', 'cultural', 'influence', 'cultural_heritage', '외교 영향력 +20% (문화 수도)', 'S'),
  region('RUS', 'siberia', '시베리아', 'Siberia', 'resource', 'oil', 'tundra', '자원 수집량 x1.5 (천연자원)', 'S'),
  region('RUS', 'ural', '우랄', 'Ural', 'industrial', 'minerals', 'mountain', '생산 속도 +15% (산업 벨트)', 'S'),
  region('RUS', 'kuban', '쿠반', 'Kuban', 'agricultural', 'food', 'farmland', 'HP 재생 +10% (농업)', 'S'),
  region('RUS', 'vladivostok', '블라디보스토크', 'Vladivostok', 'port', 'gold', 'coastal', '교역 수수료 -20% (극동 항구)', 'S'),
  region('RUS', 'kaliningrad', '칼리닌그라드', 'Kaliningrad', 'military', 'oil', 'forest', '방어 +15% (전초기지)', 'S'),
];

const IND_REGIONS: IRegionDef[] = [
  region('IND', 'delhi', '뉴델리', 'New Delhi', 'capital', 'tech', 'urban', 'PvP 데미지 +10% (수도)', 'S'),
  region('IND', 'mumbai', '뭄바이', 'Mumbai', 'port', 'gold', 'coastal', '교역 수수료 -20% (금융 수도)', 'S'),
  region('IND', 'bangalore', '벵갈루루', 'Bangalore', 'industrial', 'tech', 'urban', '생산 속도 +15% (IT 허브)', 'S'),
  region('IND', 'punjab', '펀잡', 'Punjab', 'agricultural', 'food', 'farmland', 'HP 재생 +10% (곡창)', 'S'),
  region('IND', 'rajasthan', '라자스탄', 'Rajasthan', 'resource', 'minerals', 'desert', '자원 수집량 x1.5 (광물)', 'S'),
  region('IND', 'kashmir', '카슈미르', 'Kashmir', 'military', 'oil', 'mountain', '방어 +15% (국경 전선)', 'S'),
  region('IND', 'varanasi', '바라나시', 'Varanasi', 'cultural', 'influence', 'cultural_heritage', '외교 영향력 +20% (성지)', 'S'),
];

const JPN_REGIONS: IRegionDef[] = [
  region('JPN', 'tokyo', '도쿄', 'Tokyo', 'capital', 'tech', 'urban', 'PvP 데미지 +10% (수도 밀집)', 'S'),
  region('JPN', 'osaka', '오사카', 'Osaka', 'port', 'gold', 'coastal', '교역 수수료 -20% (상업 수도)', 'S'),
  region('JPN', 'nagoya', '나고야', 'Nagoya', 'industrial', 'minerals', 'industrial_zone', '생산 속도 +15% (자동차 산업)', 'S'),
  region('JPN', 'hokkaido', '홋카이도', 'Hokkaido', 'agricultural', 'food', 'tundra', 'HP 재생 +10% (농업 중심)', 'S'),
  region('JPN', 'okinawa', '오키나와', 'Okinawa', 'military', 'oil', 'tropical', '방어 +15% (해군 기지)', 'S'),
  region('JPN', 'kyushu', '규슈', 'Kyushu', 'resource', 'minerals', 'mountain', '자원 수집량 x1.5 (광물)', 'S'),
  region('JPN', 'kyoto', '교토', 'Kyoto', 'cultural', 'influence', 'cultural_heritage', '외교 영향력 +20% (고도)', 'S'),
];

const DEU_REGIONS: IRegionDef[] = [
  region('DEU', 'berlin', '베를린', 'Berlin', 'capital', 'tech', 'urban', 'PvP 데미지 +10% (수도)', 'S'),
  region('DEU', 'hamburg', '함부르크', 'Hamburg', 'port', 'gold', 'coastal', '교역 수수료 -20% (항구 도시)', 'S'),
  region('DEU', 'bavaria', '바이에른', 'Bavaria', 'industrial', 'minerals', 'mountain', '생산 속도 +15% (정밀기계)', 'S'),
  region('DEU', 'ruhr', '루르', 'Ruhr', 'resource', 'minerals', 'industrial_zone', '자원 수집량 x1.5 (광공업)', 'S'),
  region('DEU', 'rhineland', '라인란트', 'Rhineland', 'agricultural', 'food', 'farmland', 'HP 재생 +10% (와인/농업)', 'S'),
  region('DEU', 'ramstein', '람슈타인', 'Ramstein', 'military', 'oil', 'forest', '방어 +15% (NATO 기지)', 'S'),
  region('DEU', 'dresden', '드레스덴', 'Dresden', 'cultural', 'influence', 'cultural_heritage', '외교 영향력 +20% (문화 유산)', 'S'),
];

const GBR_REGIONS: IRegionDef[] = [
  region('GBR', 'london', '런던', 'London', 'capital', 'tech', 'urban', 'PvP 데미지 +10% (수도)', 'S'),
  region('GBR', 'liverpool', '리버풀', 'Liverpool', 'port', 'gold', 'coastal', '교역 수수료 -20% (항구)', 'S'),
  region('GBR', 'manchester', '맨체스터', 'Manchester', 'industrial', 'minerals', 'industrial_zone', '생산 속도 +15% (산업 혁명)', 'S'),
  region('GBR', 'scotland', '스코틀랜드', 'Scotland', 'resource', 'oil', 'tundra', '자원 수집량 x1.5 (북해 유전)', 'S'),
  region('GBR', 'wales', '웨일스', 'Wales', 'agricultural', 'food', 'farmland', 'HP 재생 +10% (목축)', 'S'),
  region('GBR', 'portsmouth', '포츠머스', 'Portsmouth', 'military', 'oil', 'coastal', '방어 +15% (해군 기지)', 'S'),
  region('GBR', 'oxford', '옥스퍼드', 'Oxford', 'cultural', 'influence', 'cultural_heritage', '외교 영향력 +20% (학문)', 'S'),
];

const FRA_REGIONS: IRegionDef[] = [
  region('FRA', 'paris', '파리', 'Paris', 'capital', 'tech', 'urban', 'PvP 데미지 +10% (수도)', 'S'),
  region('FRA', 'marseille', '마르세유', 'Marseille', 'port', 'gold', 'coastal', '교역 수수료 -20% (지중해 항구)', 'S'),
  region('FRA', 'lyon', '리옹', 'Lyon', 'industrial', 'minerals', 'urban', '생산 속도 +15% (산업)', 'S'),
  region('FRA', 'champagne', '샹파뉴', 'Champagne', 'agricultural', 'food', 'farmland', 'HP 재생 +10% (와인/농업)', 'S'),
  region('FRA', 'lorraine', '로렌', 'Lorraine', 'resource', 'minerals', 'forest', '자원 수집량 x1.5 (광물)', 'S'),
  region('FRA', 'toulon', '툴롱', 'Toulon', 'military', 'oil', 'coastal', '방어 +15% (해군 기지)', 'S'),
  region('FRA', 'versailles', '베르사유', 'Versailles', 'cultural', 'influence', 'cultural_heritage', '외교 영향력 +20% (문화 유산)', 'S'),
];

// ──────────────────────────────────────────────
// A 티어 — 한국 포함 주요 12개국 수동 정의
// ──────────────────────────────────────────────

const KOR_REGIONS: IRegionDef[] = [
  region('KOR', 'seoul', '서울 수도권', 'Seoul Capital', 'capital', 'tech', 'urban', 'PvP 데미지 +10% (밀집)', 'A'),
  region('KOR', 'gyeonggi', '경기 산업벨트', 'Gyeonggi Industrial', 'industrial', 'minerals', 'industrial_zone', '생산 속도 +15% (반도체)', 'A'),
  region('KOR', 'busan', '부산 항구', 'Busan Port', 'port', 'gold', 'coastal', '교역 수수료 -20% (항만)', 'A'),
  region('KOR', 'jeju', '제주 자원지대', 'Jeju Island', 'agricultural', 'food', 'tropical', 'HP 재생 +10% (자연)', 'A'),
  region('KOR', 'dmz', 'DMZ 전선', 'DMZ Frontline', 'military', 'oil', 'military_base', '방어 +15% (요새 지형)', 'A'),
];

const BRA_REGIONS: IRegionDef[] = [
  region('BRA', 'brasilia', '브라질리아', 'Brasilia', 'capital', 'tech', 'urban', 'PvP 데미지 +10%', 'A'),
  region('BRA', 'sao_paulo', '상파울루', 'Sao Paulo', 'industrial', 'minerals', 'urban', '생산 속도 +15%', 'A'),
  region('BRA', 'rio', '리우데자네이루', 'Rio de Janeiro', 'port', 'gold', 'coastal', '교역 수수료 -20%', 'A'),
  region('BRA', 'amazon', '아마존', 'Amazon', 'resource', 'food', 'tropical', '자원 수집량 x1.5', 'A'),
  region('BRA', 'minas', '미나스제라이스', 'Minas Gerais', 'agricultural', 'food', 'farmland', 'HP 재생 +10%', 'A'),
];

const CAN_REGIONS: IRegionDef[] = [
  region('CAN', 'ottawa', '오타와', 'Ottawa', 'capital', 'tech', 'urban', 'PvP 데미지 +10%', 'A'),
  region('CAN', 'toronto', '토론토', 'Toronto', 'industrial', 'minerals', 'urban', '생산 속도 +15%', 'A'),
  region('CAN', 'vancouver', '밴쿠버', 'Vancouver', 'port', 'gold', 'coastal', '교역 수수료 -20%', 'A'),
  region('CAN', 'alberta', '앨버타', 'Alberta', 'resource', 'oil', 'tundra', '자원 수집량 x1.5 (오일샌드)', 'A'),
  region('CAN', 'quebec', '퀘벡', 'Quebec', 'cultural', 'influence', 'forest', '외교 영향력 +20%', 'A'),
];

const AUS_REGIONS: IRegionDef[] = [
  region('AUS', 'canberra', '캔버라', 'Canberra', 'capital', 'tech', 'urban', 'PvP 데미지 +10%', 'A'),
  region('AUS', 'sydney', '시드니', 'Sydney', 'port', 'gold', 'coastal', '교역 수수료 -20%', 'A'),
  region('AUS', 'perth', '퍼스', 'Perth', 'resource', 'minerals', 'desert', '자원 수집량 x1.5 (철광석)', 'A'),
  region('AUS', 'melbourne', '멜버른', 'Melbourne', 'cultural', 'influence', 'urban', '외교 영향력 +20%', 'A'),
  region('AUS', 'queensland', '퀸즐랜드', 'Queensland', 'agricultural', 'food', 'tropical', 'HP 재생 +10%', 'A'),
];

const ITA_REGIONS: IRegionDef[] = [
  region('ITA', 'rome', '로마', 'Rome', 'capital', 'tech', 'urban', 'PvP 데미지 +10%', 'A'),
  region('ITA', 'milan', '밀라노', 'Milan', 'industrial', 'minerals', 'urban', '생산 속도 +15% (패션/산업)', 'A'),
  region('ITA', 'naples', '나폴리', 'Naples', 'port', 'gold', 'coastal', '교역 수수료 -20%', 'A'),
  region('ITA', 'tuscany', '토스카나', 'Tuscany', 'agricultural', 'food', 'farmland', 'HP 재생 +10%', 'A'),
  region('ITA', 'venice', '베네치아', 'Venice', 'cultural', 'influence', 'cultural_heritage', '외교 영향력 +20%', 'A'),
];

const TUR_REGIONS: IRegionDef[] = [
  region('TUR', 'ankara', '앙카라', 'Ankara', 'capital', 'tech', 'urban', 'PvP 데미지 +10%', 'A'),
  region('TUR', 'istanbul', '이스탄불', 'Istanbul', 'port', 'gold', 'coastal', '교역 수수료 -20%', 'A'),
  region('TUR', 'izmir', '이즈미르', 'Izmir', 'industrial', 'minerals', 'coastal', '생산 속도 +15%', 'A'),
  region('TUR', 'anatolia', '아나톨리아', 'Anatolia', 'agricultural', 'food', 'farmland', 'HP 재생 +10%', 'A'),
  region('TUR', 'cappadocia', '카파도키아', 'Cappadocia', 'cultural', 'influence', 'cultural_heritage', '외교 영향력 +20%', 'A'),
];

const SAU_REGIONS: IRegionDef[] = [
  region('SAU', 'riyadh', '리야드', 'Riyadh', 'capital', 'tech', 'urban', 'PvP 데미지 +10%', 'A'),
  region('SAU', 'jeddah', '제다', 'Jeddah', 'port', 'gold', 'coastal', '교역 수수료 -20%', 'A'),
  region('SAU', 'dammam', '담맘', 'Dammam', 'resource', 'oil', 'desert', '자원 수집량 x1.5 (석유)', 'A'),
  region('SAU', 'neom', '네옴', 'NEOM', 'industrial', 'tech', 'desert', '생산 속도 +15%', 'A'),
  region('SAU', 'mecca', '메카', 'Mecca', 'cultural', 'influence', 'cultural_heritage', '외교 영향력 +20%', 'A'),
];

const MEX_REGIONS: IRegionDef[] = [
  region('MEX', 'cdmx', '멕시코시티', 'Mexico City', 'capital', 'tech', 'urban', 'PvP 데미지 +10%', 'A'),
  region('MEX', 'monterrey', '몬테레이', 'Monterrey', 'industrial', 'minerals', 'desert', '생산 속도 +15%', 'A'),
  region('MEX', 'veracruz', '베라크루스', 'Veracruz', 'port', 'gold', 'coastal', '교역 수수료 -20%', 'A'),
  region('MEX', 'chiapas', '치아파스', 'Chiapas', 'agricultural', 'food', 'tropical', 'HP 재생 +10%', 'A'),
  region('MEX', 'cancun', '칸쿤', 'Cancun', 'cultural', 'influence', 'tropical', '외교 영향력 +20%', 'A'),
];

const IDN_REGIONS: IRegionDef[] = [
  region('IDN', 'jakarta', '자카르타', 'Jakarta', 'capital', 'tech', 'urban', 'PvP 데미지 +10%', 'A'),
  region('IDN', 'surabaya', '수라바야', 'Surabaya', 'port', 'gold', 'coastal', '교역 수수료 -20%', 'A'),
  region('IDN', 'kalimantan', '칼리만탄', 'Kalimantan', 'resource', 'oil', 'tropical', '자원 수집량 x1.5', 'A'),
  region('IDN', 'java', '자바', 'Java', 'agricultural', 'food', 'farmland', 'HP 재생 +10%', 'A'),
  region('IDN', 'bali', '발리', 'Bali', 'cultural', 'influence', 'tropical', '외교 영향력 +20%', 'A'),
];

const ESP_REGIONS: IRegionDef[] = [
  region('ESP', 'madrid', '마드리드', 'Madrid', 'capital', 'tech', 'urban', 'PvP 데미지 +10%', 'A'),
  region('ESP', 'barcelona', '바르셀로나', 'Barcelona', 'industrial', 'minerals', 'coastal', '생산 속도 +15%', 'A'),
  region('ESP', 'valencia', '발렌시아', 'Valencia', 'port', 'gold', 'coastal', '교역 수수료 -20%', 'A'),
  region('ESP', 'andalusia', '안달루시아', 'Andalusia', 'agricultural', 'food', 'farmland', 'HP 재생 +10%', 'A'),
  region('ESP', 'granada', '그라나다', 'Granada', 'cultural', 'influence', 'cultural_heritage', '외교 영향력 +20%', 'A'),
];

const NLD_REGIONS: IRegionDef[] = [
  region('NLD', 'amsterdam', '암스테르담', 'Amsterdam', 'capital', 'tech', 'urban', 'PvP 데미지 +10%', 'A'),
  region('NLD', 'rotterdam', '로테르담', 'Rotterdam', 'port', 'gold', 'coastal', '교역 수수료 -20% (유럽 최대 항구)', 'A'),
  region('NLD', 'eindhoven', '에인트호번', 'Eindhoven', 'industrial', 'tech', 'urban', '생산 속도 +15%', 'A'),
  region('NLD', 'friesland', '프리슬란트', 'Friesland', 'agricultural', 'food', 'farmland', 'HP 재생 +10%', 'A'),
  region('NLD', 'hague', '헤이그', 'The Hague', 'cultural', 'influence', 'urban', '외교 영향력 +20% (국제법)', 'A'),
];

const POL_REGIONS: IRegionDef[] = [
  region('POL', 'warsaw', '바르샤바', 'Warsaw', 'capital', 'tech', 'urban', 'PvP 데미지 +10%', 'A'),
  region('POL', 'gdansk', '그단스크', 'Gdansk', 'port', 'gold', 'coastal', '교역 수수료 -20%', 'A'),
  region('POL', 'katowice', '카토비체', 'Katowice', 'industrial', 'minerals', 'industrial_zone', '생산 속도 +15%', 'A'),
  region('POL', 'masuria', '마주리', 'Masuria', 'agricultural', 'food', 'forest', 'HP 재생 +10%', 'A'),
  region('POL', 'krakow', '크라쿠프', 'Krakow', 'cultural', 'influence', 'cultural_heritage', '외교 영향력 +20%', 'A'),
];

/** 수동 정의 지역 매핑 (ISO3 → 지역 배열) */
const MANUAL_REGIONS: Record<string, IRegionDef[]> = {
  // S 티어
  USA: USA_REGIONS, CHN: CHN_REGIONS, RUS: RUS_REGIONS, IND: IND_REGIONS,
  JPN: JPN_REGIONS, DEU: DEU_REGIONS, GBR: GBR_REGIONS, FRA: FRA_REGIONS,
  // A 티어 (12개국 수동)
  KOR: KOR_REGIONS, BRA: BRA_REGIONS, CAN: CAN_REGIONS, AUS: AUS_REGIONS,
  ITA: ITA_REGIONS, TUR: TUR_REGIONS, SAU: SAU_REGIONS, MEX: MEX_REGIONS,
  IDN: IDN_REGIONS, ESP: ESP_REGIONS, NLD: NLD_REGIONS, POL: POL_REGIONS,
};

// ── 자동생성 유틸리티 (수동 미정의 국가) ──

/** 지역 유형 순환 할당 패턴 (티어별 지역 수에 맞춰 순환) */
const REGION_TYPE_CYCLE: RegionType[] = [
  'capital', 'industrial', 'port', 'agricultural', 'military', 'resource', 'cultural',
];

/** 지역 유형별 기본 자원 매핑 */
const REGION_TYPE_RESOURCE: Record<RegionType, ResourceType> = {
  capital: 'tech',
  industrial: 'minerals',
  port: 'gold',
  agricultural: 'food',
  military: 'oil',
  resource: 'minerals',
  cultural: 'influence',
};

/** 지역 유형별 기본 바이옴 매핑 */
const REGION_TYPE_BIOME: Record<RegionType, BiomeType> = {
  capital: 'urban',
  industrial: 'industrial_zone',
  port: 'coastal',
  agricultural: 'farmland',
  military: 'military_base',
  resource: 'mining',
  cultural: 'cultural_heritage',
};

/** 지역 유형별 기본 효과 설명 */
const REGION_TYPE_DESCRIPTION: Record<RegionType, string> = {
  capital: 'PvP 데미지 +10%',
  industrial: '생산 속도 +15%',
  port: '교역 수수료 -20%',
  agricultural: 'HP 재생 +10%',
  military: '방어 +15%',
  resource: '자원 수집량 x1.5',
  cultural: '외교 영향력 +20%',
};

/** 지역 유형별 기본 이름 접미사 */
const REGION_TYPE_SUFFIX: Record<RegionType, { ko: string; en: string }> = {
  capital: { ko: '수도권', en: 'Capital' },
  industrial: { ko: '산업지구', en: 'Industrial Zone' },
  port: { ko: '항구', en: 'Port' },
  agricultural: { ko: '농업지대', en: 'Farmland' },
  military: { ko: '군사기지', en: 'Military Base' },
  resource: { ko: '자원지대', en: 'Resource Zone' },
  cultural: { ko: '문화유산', en: 'Heritage Site' },
};

/**
 * 자동 생성 — 수동 정의되지 않은 국가의 지역을 생성한다.
 * 국가 영문명 + 지역 유형 접미사로 이름을 생성하고,
 * 티어에 맞는 지역 수만큼 순환 할당한다.
 */
function generateRegionsForCountry(
  iso3: string,
  countryName: string,
  countryNameKo: string,
  tier: CountryTier,
): IRegionDef[] {
  const cfg = TIER_CONFIG[tier];
  const count = cfg.regionCount;
  const regions: IRegionDef[] = [];

  for (let i = 0; i < count; i++) {
    const type = REGION_TYPE_CYCLE[i % REGION_TYPE_CYCLE.length];
    const suffix = REGION_TYPE_SUFFIX[type];
    const slug = `region_${i + 1}`;

    regions.push({
      id: `${iso3}_${slug}`,
      countryCode: iso3,
      name: `${countryNameKo} ${suffix.ko}`,
      nameEn: `${countryName} ${suffix.en}`,
      type,
      primaryResource: REGION_TYPE_RESOURCE[type],
      specialtyResource: COUNTRY_SPECIALTY[iso3] ?? 'generic',
      biome: REGION_TYPE_BIOME[type],
      specialEffect: REGION_TYPE_DESCRIPTION[type],
      effects: makeEffects(type),
      arenaSize: cfg.arenaSize,
      maxPlayers: cfg.maxPlayers,
    });
  }

  return regions;
}

// ── 전체 국가-지역 데이터 빌드 ──

/** 모든 195개국의 CountryRegions 데이터를 빌드한다 */
function buildAllCountryRegions(): Map<string, ICountryRegions> {
  const result = new Map<string, ICountryRegions>();

  for (const country of COUNTRIES) {
    const { iso3, name, nameKo } = country;
    const tier = getCountryTier(iso3);
    const cfg = TIER_CONFIG[tier];

    // 수동 정의 지역이 있으면 사용, 없으면 자동 생성
    const regions = MANUAL_REGIONS[iso3]
      ?? generateRegionsForCountry(iso3, name, nameKo, tier);

    result.set(iso3, {
      countryCode: iso3,
      tier,
      regions,
      specialtyResource: COUNTRY_SPECIALTY[iso3] ?? 'generic',
      arenaSize: cfg.arenaSize,
      maxPlayers: cfg.maxPlayers,
    });
  }

  return result;
}

/** 캐시된 전체 국가-지역 데이터 */
let _countryRegionsCache: Map<string, ICountryRegions> | null = null;

/** 전체 국가-지역 데이터 조회 (lazy init + 캐시) */
export function getAllCountryRegions(): Map<string, ICountryRegions> {
  if (!_countryRegionsCache) {
    _countryRegionsCache = buildAllCountryRegions();
  }
  return _countryRegionsCache;
}

/** ISO3 코드로 특정 국가의 지역 데이터 조회 */
export function getCountryRegions(iso3: string): ICountryRegions | undefined {
  return getAllCountryRegions().get(iso3);
}

/** ISO3 코드로 특정 국가의 지역 목록만 조회 */
export function getRegionsForCountry(iso3: string): IRegionDef[] {
  return getCountryRegions(iso3)?.regions ?? [];
}

/** 지역 ID로 특정 지역 조회 (전체 스캔, 빈번 호출 시 별도 인덱스 필요) */
export function getRegionById(regionId: string): IRegionDef | undefined {
  for (const [, cr] of getAllCountryRegions()) {
    const found = cr.regions.find(r => r.id === regionId);
    if (found) return found;
  }
  return undefined;
}

/** 특정 티어의 모든 국가-지역 데이터 조회 */
export function getCountryRegionsByTier(tier: CountryTier): ICountryRegions[] {
  const result: ICountryRegions[] = [];
  for (const [, cr] of getAllCountryRegions()) {
    if (cr.tier === tier) result.push(cr);
  }
  return result;
}

/** 전체 지역 수 계산 */
export function getTotalRegionCount(): number {
  let count = 0;
  for (const [, cr] of getAllCountryRegions()) {
    count += cr.regions.length;
  }
  return count;
}

/** 통계 요약 (디버깅/검증용) */
export function getRegionStats(): {
  totalCountries: number;
  totalRegions: number;
  byTier: Record<CountryTier, { countries: number; regions: number }>;
} {
  const byTier: Record<CountryTier, { countries: number; regions: number }> = {
    S: { countries: 0, regions: 0 },
    A: { countries: 0, regions: 0 },
    B: { countries: 0, regions: 0 },
    C: { countries: 0, regions: 0 },
    D: { countries: 0, regions: 0 },
  };

  let totalRegions = 0;

  for (const [, cr] of getAllCountryRegions()) {
    byTier[cr.tier].countries++;
    byTier[cr.tier].regions += cr.regions.length;
    totalRegions += cr.regions.length;
  }

  return {
    totalCountries: getAllCountryRegions().size,
    totalRegions,
    byTier,
  };
}
