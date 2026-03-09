/**
 * iso-biome-defs.ts
 *
 * Phase 1: 6개 바이옴(기후대) 정의
 * 각 바이옴별로 사용할 Ground/Tree/Flora/Wall/Roof 시리즈 매핑
 *
 * 참조: docs/designs/v27-iso-map-plan.md 섹션 2.1
 * 참조: iso-asset-catalog.ts (Phase 0 산출물)
 *
 * @generated 2026-03-09 Phase 1
 */

import type { BiomeType, BiomeDef } from '../../components/game/iso/types';

// ============================================================================
// 바이옴 정의 — 6개 기후대
// ============================================================================

/**
 * Temperate (온대)
 * 유럽 중서부, 동아시아, 북미 중위도
 * 표준 마을 느낌: 잔디+활엽수+목재벽+초가지붕
 */
const TEMPERATE: BiomeDef = {
  id: 'temperate',
  nameKo: '온대',
  nameEn: 'Temperate',
  mainGround: 'A',       // 풀밭/잔디 (70%)
  subGround: ['B', 'E'], // 흙/진흙, 돌바닥 (20%)
  pathGround: 'E',       // 돌바닥 (10%, 도로/건물 주변)
  trees: ['A', 'B'],     // 활엽수 + 소나무
  flora: ['A', 'B'],     // 꽃/풀 + 덤불
  defaultWall: 'A',      // 목재벽
  defaultRoof: 'A',      // 초가지붕
};

/**
 * Arid (건조)
 * 사하라, 아라비아 반도, 호주 내륙
 * 모래 광야: 모래+고목+벽돌벽+기와(flat) 지붕
 */
const ARID: BiomeDef = {
  id: 'arid',
  nameKo: '건조',
  nameEn: 'Arid',
  mainGround: 'C',       // 모래 (70%)
  subGround: ['D', 'I'], // 자갈, 화산재 (20%)
  pathGround: 'D',       // 자갈 (10%, 도로)
  trees: ['D'],           // 고목/죽은나무 (선인장 대용)
  flora: [],              // 식생 없음
  defaultWall: 'C',      // 벽돌
  defaultRoof: 'C',      // 기와(flat)
};

/**
 * Tropical (열대)
 * 동남아, 아마존, 적도 아프리카
 * 밀림/습지: 잔디+야자수+관목+목재벽+천막지붕
 */
const TROPICAL: BiomeDef = {
  id: 'tropical',
  nameKo: '열대',
  nameEn: 'Tropical',
  mainGround: 'A',       // 풀밭 (70%)
  subGround: ['H', 'G'], // 늪지, 경작지 (20%)
  pathGround: 'E',       // 돌바닥 (10%)
  trees: ['C', 'E'],     // 야자수 + 관목
  flora: ['A', 'B'],     // 풍성한 식생
  defaultWall: 'A',      // 목재벽
  defaultRoof: 'D',      // 천막지붕
};

/**
 * Arctic (극지)
 * 시베리아, 스칸디나비아, 캐나다 북부
 * 눈 덮인 마을/성채: 눈+소나무+장식석+돔지붕(두꺼운)
 */
const ARCTIC: BiomeDef = {
  id: 'arctic',
  nameKo: '극지',
  nameEn: 'Arctic',
  mainGround: 'F',       // 눈 (70%)
  subGround: ['A'],      // 잔디 일부 (20%)
  pathGround: 'E',       // 돌바닥 (10%)
  trees: ['B'],           // 소나무/침엽수
  flora: [],              // 식생 없음
  defaultWall: 'F',      // 장식석
  defaultRoof: 'F',      // 돔(두꺼운) 지붕
};

/**
 * Mediterranean (지중해)
 * 남유럽(이탈리아, 그리스, 스페인), 터키
 * 돌길 마을: 잔디+활엽수+관목+판자벽+기와지붕
 */
const MEDITERRANEAN: BiomeDef = {
  id: 'mediterranean',
  nameKo: '지중해',
  nameEn: 'Mediterranean',
  mainGround: 'A',           // 풀밭 (70%)
  subGround: ['E', 'C'],     // 돌바닥, 모래 (20%)
  pathGround: 'E',           // 돌바닥 (10%)
  trees: ['A', 'E'],         // 활엽수 + 관목
  flora: ['A', 'B'],         // 꽃/풀 + 덤불
  defaultWall: 'B',          // 나무판자
  defaultRoof: 'C',          // 기와지붕 (테라코타)
};

/**
 * Urban (도시국가)
 * 싱가포르, 모나코, 홍콩, 바티칸 등
 * 포장도로/고층: 돌바닥+석조+금속지붕
 */
const URBAN: BiomeDef = {
  id: 'urban',
  nameKo: '도시국가',
  nameEn: 'Urban',
  mainGround: 'E',       // 돌바닥 (70%)
  subGround: ['D'],      // 자갈 (20%)
  pathGround: 'E',       // 돌바닥 (10%)
  trees: [],              // 나무 없음
  flora: [],              // 식생 없음
  defaultWall: 'E',      // 돌벽 (현대적)
  defaultRoof: 'E',      // 금속지붕
};

// ============================================================================
// 바이옴 레지스트리
// ============================================================================

/** 전체 바이옴 정의 맵 */
export const BIOME_DEFS: Record<BiomeType, BiomeDef> = {
  temperate: TEMPERATE,
  arid: ARID,
  tropical: TROPICAL,
  arctic: ARCTIC,
  mediterranean: MEDITERRANEAN,
  urban: URBAN,
} as const;

/**
 * 바이옴 ID로 정의 조회
 */
export function getBiomeDef(biome: BiomeType): BiomeDef {
  return BIOME_DEFS[biome];
}

/**
 * 바이옴별 건물 시각 등급 Wall/Roof 오버라이드
 *
 * 기후대에 따라 동일 건물 등급이라도 다른 Wall/Roof 시리즈를 사용
 * 참조: v27-iso-map-plan.md 섹션 5.3
 */
export type BuildingVisualGradeId =
  | 'small_wood'
  | 'medium_wood'
  | 'medium_stone'
  | 'large_factory'
  | 'military'
  | 'government';

export interface BiomeBuildingOverride {
  wallSeries: string;
  roofSeries: string;
}

/**
 * 기후대 × 건물 등급 오버라이드 테이블
 * key: `${biome}:${grade}`
 */
export const BIOME_BUILDING_OVERRIDES: Record<string, BiomeBuildingOverride> = {
  // Temperate — 기본값 사용 (catalog의 VISUAL_GRADE_DEFAULTS와 동일)
  'temperate:small_wood':    { wallSeries: 'A', roofSeries: 'A' },
  'temperate:medium_wood':   { wallSeries: 'B', roofSeries: 'B' },
  'temperate:medium_stone':  { wallSeries: 'C', roofSeries: 'C' },
  'temperate:large_factory': { wallSeries: 'E', roofSeries: 'E' },
  'temperate:military':      { wallSeries: 'D', roofSeries: 'C' },
  'temperate:government':    { wallSeries: 'F', roofSeries: 'F' },

  // Arid — 벽돌 중심, flat 기와
  'arid:small_wood':    { wallSeries: 'C', roofSeries: 'C' },
  'arid:medium_wood':   { wallSeries: 'C', roofSeries: 'C' },
  'arid:medium_stone':  { wallSeries: 'C', roofSeries: 'C' },
  'arid:large_factory': { wallSeries: 'E', roofSeries: 'E' },
  'arid:military':      { wallSeries: 'D', roofSeries: 'C' },
  'arid:government':    { wallSeries: 'F', roofSeries: 'F' },

  // Tropical — 목재 + 천막
  'tropical:small_wood':    { wallSeries: 'A', roofSeries: 'D' },
  'tropical:medium_wood':   { wallSeries: 'A', roofSeries: 'D' },
  'tropical:medium_stone':  { wallSeries: 'C', roofSeries: 'D' },
  'tropical:large_factory': { wallSeries: 'E', roofSeries: 'E' },
  'tropical:military':      { wallSeries: 'E', roofSeries: 'C' },
  'tropical:government':    { wallSeries: 'F', roofSeries: 'F' },

  // Arctic — 두꺼운 석조 + 돔
  'arctic:small_wood':    { wallSeries: 'F', roofSeries: 'F' },
  'arctic:medium_wood':   { wallSeries: 'F', roofSeries: 'F' },
  'arctic:medium_stone':  { wallSeries: 'F', roofSeries: 'F' },
  'arctic:large_factory': { wallSeries: 'E', roofSeries: 'E' },
  'arctic:military':      { wallSeries: 'G', roofSeries: 'F' },
  'arctic:government':    { wallSeries: 'F', roofSeries: 'F' },

  // Mediterranean — 테라코타 느낌
  'mediterranean:small_wood':    { wallSeries: 'B', roofSeries: 'C' },
  'mediterranean:medium_wood':   { wallSeries: 'B', roofSeries: 'C' },
  'mediterranean:medium_stone':  { wallSeries: 'C', roofSeries: 'C' },
  'mediterranean:large_factory': { wallSeries: 'E', roofSeries: 'E' },
  'mediterranean:military':      { wallSeries: 'C', roofSeries: 'C' },
  'mediterranean:government':    { wallSeries: 'F', roofSeries: 'F' },

  // Urban — 현대적 돌+금속
  'urban:small_wood':    { wallSeries: 'E', roofSeries: 'E' },
  'urban:medium_wood':   { wallSeries: 'E', roofSeries: 'E' },
  'urban:medium_stone':  { wallSeries: 'E', roofSeries: 'E' },
  'urban:large_factory': { wallSeries: 'E', roofSeries: 'E' },
  'urban:military':      { wallSeries: 'F', roofSeries: 'E' },
  'urban:government':    { wallSeries: 'F', roofSeries: 'F' },
};

/**
 * 바이옴 × 건물 등급에 맞는 Wall/Roof 시리즈 반환
 * 오버라이드가 없으면 해당 바이옴의 기본 Wall/Roof 반환
 */
export function getBiomeBuildingStyle(
  biome: BiomeType,
  grade: BuildingVisualGradeId,
): BiomeBuildingOverride {
  const key = `${biome}:${grade}`;
  const override = BIOME_BUILDING_OVERRIDES[key];
  if (override) return override;

  // 폴백: 바이옴 기본값
  const def = BIOME_DEFS[biome];
  return {
    wallSeries: def.defaultWall,
    roofSeries: def.defaultRoof,
  };
}

/**
 * 바이옴에서 로드해야 할 전체 Ground 시리즈 목록
 * (주력 + 보조 + 도로 + 해안에지 J)
 */
export function getBiomeGroundSeries(biome: BiomeType): string[] {
  const def = BIOME_DEFS[biome];
  const series = new Set<string>();
  series.add(def.mainGround);
  for (const s of def.subGround) series.add(s);
  series.add(def.pathGround);
  series.add('J'); // 해안 에지는 모든 바이옴에서 필요
  return Array.from(series);
}

/**
 * 바이옴에서 로드해야 할 전체 Wall 시리즈 목록
 * (기본 + 건물 등급 오버라이드에서 사용하는 모든 시리즈)
 */
export function getBiomeWallSeries(biome: BiomeType): string[] {
  const series = new Set<string>();
  const grades: BuildingVisualGradeId[] = [
    'small_wood', 'medium_wood', 'medium_stone',
    'large_factory', 'military', 'government',
  ];
  for (const grade of grades) {
    const style = getBiomeBuildingStyle(biome, grade);
    series.add(style.wallSeries);
  }
  return Array.from(series);
}

/**
 * 바이옴에서 로드해야 할 전체 Roof 시리즈 목록
 */
export function getBiomeRoofSeries(biome: BiomeType): string[] {
  const series = new Set<string>();
  const grades: BuildingVisualGradeId[] = [
    'small_wood', 'medium_wood', 'medium_stone',
    'large_factory', 'military', 'government',
  ];
  for (const grade of grades) {
    const style = getBiomeBuildingStyle(biome, grade);
    series.add(style.roofSeries);
  }
  return Array.from(series);
}
