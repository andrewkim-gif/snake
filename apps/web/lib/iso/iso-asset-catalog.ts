/**
 * iso-asset-catalog.ts
 *
 * Phase 0 산출물: 전문 에셋팩(2,948 PNG) 완전 카탈로그
 * - apps/web/public/game/ 내 모든 에셋의 파일명, 카테고리, 방향, 변형 번호를 코드로 문서화
 * - 각 카테고리별 타입 정의 포함
 * - 경계 타일 매핑표, 시민 스프라이트 시트 분석 포함
 *
 * 에셋 기본 규격:
 * - Environment: 256x256 RGBA PNG, 4방향(N/S/E/W)
 * - Ground 다이아몬드: 128x80px, 캔버스 하단 Y=176~255
 * - Characters: 1920x1024 스프라이트 시트 = 15열 x 8행 = 128x128px 프레임
 * - 방향 접미사: _N/_S/_E/_W = 카메라가 바라보는 방향 (에지 방향이 아님)
 *
 * @generated 2026-03-09 Phase 0
 */

// ============================================================================
// 1. 공통 타입 정의
// ============================================================================

/** 에셋 카메라 방향 — N/S/E/W = 북/남/동/서에서 바라본 시점 */
export type AssetDirection = 'N' | 'S' | 'E' | 'W';

/** 모든 방향 배열 (순회용) */
export const ALL_DIRECTIONS: readonly AssetDirection[] = ['N', 'S', 'E', 'W'] as const;

/** 기본 카메라 방향 — S (고정 카메라) */
export const DEFAULT_DIRECTION: AssetDirection = 'S';

/** 에셋 베이스 경로 */
export const ASSET_BASE_PATH = '/game';
export const ENV_BASE_PATH = `${ASSET_BASE_PATH}/Environment`;
export const CHAR_BASE_PATH = `${ASSET_BASE_PATH}/Characters`;
export const ANIM_BASE_PATH = `${ASSET_BASE_PATH}/Animations`;
export const OTHER_BASE_PATH = `${ASSET_BASE_PATH}/Other`;

/**
 * Environment 에셋 파일 경로 생성
 * 파일명에 공백 포함: "Ground A1_S.png" → encodeURIComponent 처리
 */
export function envAssetPath(
  category: string,
  series: string,
  variant: number,
  direction: AssetDirection = DEFAULT_DIRECTION
): string {
  const filename = `${category} ${series}${variant}_${direction}.png`;
  return `${ENV_BASE_PATH}/${encodeURIComponent(filename)}`;
}

/**
 * Shadow 에셋은 시리즈 문자 없이 "Shadow{N}_D.png" 형태
 */
export function shadowAssetPath(
  variant: number,
  direction: AssetDirection = DEFAULT_DIRECTION
): string {
  const filename = `Shadow${variant}_${direction}.png`;
  return `${ENV_BASE_PATH}/${encodeURIComponent(filename)}`;
}

// ============================================================================
// 2. Environment 카테고리 정의
// ============================================================================

/** Environment 에셋 최상위 카테고리 */
export type EnvironmentCategory =
  | 'Ground'
  | 'Wall'
  | 'Roof'
  | 'Stone'
  | 'Tree'
  | 'Flora'
  | 'WallFlora'
  | 'Misc'
  | 'Shadow'
  | 'Door'
  | 'Chest';

// ============================================================================
// 3. Ground 카탈로그 — 지면 타일 (113종 x 4방향 = 452 파일)
// ============================================================================

/**
 * Ground 시리즈 문자: A~J (10개 바이옴/지형 계열)
 *
 * 각 시리즈 = 특정 지형 텍스처
 * 번호 1~2는 대부분 full diamond(128x80 완전 타일)
 * 번호 3+ 는 half/corner/deco/thin 변형 (비규칙적)
 */
export type GroundSeries = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J';

/** Ground 타일 형태 분류 */
export type GroundTileShape =
  | 'full'     // 완전 다이아몬드 (~128x80) — 기본 바닥 채움용
  | 'half_l'   // 좌측 반쪽 — 좌측 바이옴 경계
  | 'half_r'   // 우측 반쪽 — 우측 바이옴 경계
  | 'corner'   // 코너/소형 조각
  | 'thin'     // 얇은 변형 (~128x43~65) — 좁은 영역
  | 'deco';    // 소형 데코 조각 (~32~91px) — 빈틈 채우기

/** Ground 시리즈 정의 */
export interface GroundSeriesDef {
  /** 시리즈 문자 */
  readonly series: GroundSeries;
  /** 한국어 설명 */
  readonly nameKo: string;
  /** 영문 설명 */
  readonly nameEn: string;
  /** 사용 가능한 변형 번호 목록 */
  readonly variants: readonly number[];
  /** 기본 바이옴 용도 */
  readonly biomeUse: string;
}

/** Ground 시리즈 전체 카탈로그 */
export const GROUND_SERIES: Record<GroundSeries, GroundSeriesDef> = {
  A: {
    series: 'A',
    nameKo: '풀밭/잔디',
    nameEn: 'Grass/Lawn',
    variants: [1,2,3,4,5,6,7,8,9,10,11,12,14,15,16,17,18,19,20,21,22,23,24],
    biomeUse: 'Temperate, Tropical, Mediterranean 주력',
  },
  B: {
    series: 'B',
    nameKo: '흙/진흙',
    nameEn: 'Dirt/Mud',
    variants: [1,2,3,4,5,6],
    biomeUse: 'Temperate 보조 (길, 비포장)',
  },
  C: {
    series: 'C',
    nameKo: '모래',
    nameEn: 'Sand',
    variants: [1,2,3,4,5,6],
    biomeUse: 'Arid 주력, Beach 보조',
  },
  D: {
    series: 'D',
    nameKo: '자갈/진흙길',
    nameEn: 'Gravel/Mud Path',
    variants: [1,2,3,4],
    biomeUse: 'Mountain 보조, Urban 보조',
  },
  E: {
    series: 'E',
    nameKo: '돌바닥',
    nameEn: 'Stone Floor',
    variants: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],
    biomeUse: 'Urban 주력, 건물 주변 도로',
  },
  F: {
    series: 'F',
    nameKo: '눈',
    nameEn: 'Snow',
    variants: [1,2,3,4,5,6],
    biomeUse: 'Arctic 주력',
  },
  G: {
    series: 'G',
    nameKo: '경작지',
    nameEn: 'Farmland/Cultivated',
    variants: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22],
    biomeUse: 'Farm 주변, Tropical 보조',
  },
  H: {
    series: 'H',
    nameKo: '늪지',
    nameEn: 'Swamp/Marsh',
    variants: [1,2,3,4,5,6,7,8,9,10,11],
    biomeUse: 'Tropical 보조 (습지)',
  },
  I: {
    series: 'I',
    nameKo: '화산재',
    nameEn: 'Volcanic Ash',
    variants: [1,2,3,4,5,6,7,8,9,10],
    biomeUse: 'Arid 보조, 특수 지형',
  },
  J: {
    series: 'J',
    nameKo: '물/해안 에지',
    nameEn: 'Water/Coast Edge',
    variants: [1,2,3,4,5,6,7,8,9,10],
    biomeUse: '해안선 전환 타일 (육지↔물)',
  },
} as const;

/**
 * Ground 타일 변형별 형태 분류표 (Phase 0 분석 결과)
 *
 * Ground A 시리즈 분석 (23종) — 다른 시리즈도 유사한 패턴:
 * - 1~2: full diamond (~128x80) = 기본 타일
 * - 3~9: 다양한 half/corner/변형
 * - 10~14: 변형 full 또는 mid-size
 * - 15~19: thin(얇은) 변형
 * - 20~24: small deco 조각
 *
 * NOTE: 번호가 center/edge/corner를 규칙적으로 구분하지 않음.
 *       시리즈마다 변형 수가 다르므로 (A=23, C=6, F=6) 일률적 매핑 불가.
 *       아래 분류는 Ground A 시리즈 픽셀 분석 기반 추정치.
 */
export const GROUND_A_SHAPE_MAP: Record<number, GroundTileShape> = {
  1: 'full',     // 128x80 full diamond — 기본 잔디 타일
  2: 'full',     // 131x73 full — 약간 다른 풀 패턴
  3: 'half_l',   // 83x71 좌편향 — 좌측 경계용
  4: 'corner',   // 91x46 소형 — 코너 조각
  5: 'full',     // 131x73 full — 변형 풀 패턴
  6: 'full',     // full variant
  7: 'corner',   // 소형 조각
  8: 'half_r',   // 87px 우편향 — 우측 경계용
  9: 'half_r',   // 106px 우편향 — 우측 경계용
  10: 'full',    // 중형 변형
  11: 'full',    // 중형 변형
  12: 'full',    // 중형 변형
  14: 'full',    // (13 결번) 중형 변형
  15: 'thin',    // 128x65 얇은 변형
  16: 'thin',    // 128x55 얇은 변형
  17: 'thin',    // 128x48 얇은 변형
  18: 'thin',    // 128x43 얇은 변형
  19: 'thin',    // 128x50 얇은 변형
  20: 'deco',    // 91px 좌측 소형 데코
  21: 'deco',    // 64px 좌편향 소형
  22: 'deco',    // 72px 소형
  23: 'deco',    // 56px 좌편향 소형
  24: 'deco',    // 32px 극소형 데코
};

/**
 * 안전한 full diamond 변형 번호 (시리즈별)
 * 이 번호만 사용하면 빈틈 없는 기본 바닥 타일 배치 보장
 */
export const GROUND_SAFE_FULL_VARIANTS: Record<GroundSeries, readonly number[]> = {
  A: [1, 2, 5, 6, 10, 11, 12, 14],
  B: [1, 2, 3],
  C: [1, 2, 3],
  D: [1, 2],
  E: [1, 2, 3, 4, 5],
  F: [1, 2, 3],
  G: [1, 2, 3, 4, 5, 6],
  H: [1, 2, 3],
  I: [1, 2, 3],
  J: [1, 2, 3],
};
// ============================================================================
// 4. Wall 카탈로그 — 건물 벽면 (104종 x 4방향 = 416 파일)
// ============================================================================

/**
 * Wall 시리즈: A~G (7개 건물 벽 스타일)
 *
 * _N/_S/_E/_W 방향별로 완전히 다른 렌더 (카메라 앵글별 벽면)
 * 기본 카메라(_S): 좌측 벽면이 보이는 시점
 * 같은 타일 좌표에 오버레이 배치 (타일-by-타일 조립 아님)
 */
export type WallSeries = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

export interface WallSeriesDef {
  readonly series: WallSeries;
  readonly nameKo: string;
  readonly nameEn: string;
  readonly variants: readonly number[];
  /** 건물 시각 등급 매핑 */
  readonly visualGrade: string;
}

export const WALL_SERIES: Record<WallSeries, WallSeriesDef> = {
  A: {
    series: 'A',
    nameKo: '목재벽',
    nameEn: 'Wooden Wall',
    variants: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22],
    visualGrade: '소형 목조',
  },
  B: {
    series: 'B',
    nameKo: '나무판자',
    nameEn: 'Plank Wall',
    variants: [1,2,3,4,5,6,7,8,9,10,11],
    visualGrade: '중형 목조',
  },
  C: {
    series: 'C',
    nameKo: '벽돌',
    nameEn: 'Brick Wall',
    variants: [1,2,3,4,5,6],
    visualGrade: '중형 석조',
  },
  D: {
    series: 'D',
    nameKo: '석조+목재',
    nameEn: 'Stone & Wood Wall',
    variants: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19],
    visualGrade: '군사 시설',
  },
  E: {
    series: 'E',
    nameKo: '돌벽',
    nameEn: 'Stone Wall',
    variants: [1,2,3,4,5,6,7,8,9,10,11,12,15,16,17,18],
    visualGrade: '대형 공장',
  },
  F: {
    series: 'F',
    nameKo: '장식석',
    nameEn: 'Ornamental Stone Wall',
    variants: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19],
    visualGrade: '정부/종교',
  },
  G: {
    series: 'G',
    nameKo: '성벽',
    nameEn: 'Fortress/Castle Wall',
    variants: [1,2,3,4,5,6,7,8,9,10,11],
    visualGrade: 'Arctic 특수',
  },
} as const;
// ============================================================================
// 5. Roof 카탈로그 — 건물 지붕 (57종 x 4방향 = 228 파일)
// ============================================================================

/**
 * Roof 시리즈: A~G (7개 지붕 스타일)
 *
 * Wall과 마찬가지로 방향별 완전히 다른 형태 (alpha 형태까지 다름)
 * Wall 위에 같은 타일 좌표에 오버레이로 합성
 */
export type RoofSeries = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

export interface RoofSeriesDef {
  readonly series: RoofSeries;
  readonly nameKo: string;
  readonly nameEn: string;
  readonly variants: readonly number[];
  readonly visualGrade: string;
}

export const ROOF_SERIES: Record<RoofSeries, RoofSeriesDef> = {
  A: {
    series: 'A',
    nameKo: '초가지붕',
    nameEn: 'Thatched Roof',
    variants: [1,2,3,4,5,6,7,8,9,10],
    visualGrade: '소형 목조',
  },
  B: {
    series: 'B',
    nameKo: '나무지붕',
    nameEn: 'Wooden Roof',
    variants: [1,2,3,4,5,6],
    visualGrade: '중형 목조',
  },
  C: {
    series: 'C',
    nameKo: '기와지붕',
    nameEn: 'Tile Roof',
    variants: [1,2,3,4,5,6,7,8,9,10],
    visualGrade: '중형 석조',
  },
  D: {
    series: 'D',
    nameKo: '천막지붕',
    nameEn: 'Tent/Canopy Roof',
    variants: [1,2,3,4,5,6,7,8,9,10],
    visualGrade: 'Tropical 특수',
  },
  E: {
    series: 'E',
    nameKo: '금속지붕',
    nameEn: 'Metal Roof',
    variants: [1,2,3,4,5,6,7,8,9,10],
    visualGrade: '대형 공장',
  },
  F: {
    series: 'F',
    nameKo: '돔지붕',
    nameEn: 'Dome Roof',
    variants: [1,2,3,4,5,6,7,8,9,10],
    visualGrade: '정부/종교',
  },
  G: {
    series: 'G',
    nameKo: '성탑지붕',
    nameEn: 'Castle Tower Roof',
    variants: [1],
    visualGrade: 'Arctic 성채',
  },
} as const;
// ============================================================================
// 6. Stone 카탈로그 — 돌바닥/포장 (22종 x 4방향 = 88 파일)
// ============================================================================

/**
 * Stone 시리즈: A만 존재 (22종)
 * 도로, 건물 주변 포장, 광장 등에 사용
 * Ground 위에 Layer 2 (StonePath)로 오버레이
 */
export interface StoneSeriesDef {
  readonly series: 'A';
  readonly nameKo: string;
  readonly nameEn: string;
  readonly variants: readonly number[];
}

export const STONE_SERIES: StoneSeriesDef = {
  series: 'A',
  nameKo: '돌바닥/포장',
  nameEn: 'Stone Floor/Paving',
  variants: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22],
} as const;

/** Stone 변형 용도 분류 */
export const STONE_VARIANT_USE: Record<number, string> = {
  1: 'full diamond — 기본 포장',
  2: 'full variant — 포장 변형',
  3: 'full variant — 포장 변형',
  4: 'partial — 가장자리',
  5: 'full variant — 포장 변형',
  6: 'partial — 가장자리',
  7: 'partial — 가장자리',
  8: 'partial — 가장자리',
  9: 'partial — 가장자리',
  10: 'full variant — 포장 변형',
  11: 'partial — 가장자리',
  12: 'partial — 가장자리',
  13: 'partial — 가장자리',
  14: 'partial — 가장자리',
  15: 'full variant — 포장 변형',
  16: 'partial — 코너',
  17: 'partial — 코너',
  18: 'partial — 코너',
  19: 'partial — 코너',
  20: 'deco — 깨진 돌',
  21: 'deco — 이끼 돌',
  22: 'deco — 잡초 돌',
};
// ============================================================================
// 7. Tree 카탈로그 — 나무 (18종 x 4방향 = 72 파일 + Shadow 1개)
// ============================================================================

/**
 * Tree 시리즈: A~E (5개 나무 종류)
 *
 * 방향 차이 약간(diff 7~8) — _S 기본으로 충분
 * 캔버스 상~중단 (Y=17~219): 가장 키 큰 오브젝트
 * Layer 7 (Tree)에 배치
 */
export type TreeSeries = 'A' | 'B' | 'C' | 'D' | 'E';

export interface TreeSeriesDef {
  readonly series: TreeSeries;
  readonly nameKo: string;
  readonly nameEn: string;
  readonly variants: readonly number[];
  /** 주 사용 바이옴 */
  readonly biomes: readonly string[];
  /** 크기 분류 */
  readonly sizeClass: 'large' | 'medium' | 'small';
}

export const TREE_SERIES: Record<TreeSeries, TreeSeriesDef> = {
  A: {
    series: 'A',
    nameKo: '활엽수',
    nameEn: 'Deciduous Tree',
    variants: [1,2,3,4],
    biomes: ['temperate', 'mediterranean'],
    sizeClass: 'large',
  },
  B: {
    series: 'B',
    nameKo: '소나무/침엽수',
    nameEn: 'Pine/Conifer',
    variants: [1,2,3,4,5],
    biomes: ['temperate', 'arctic'],
    sizeClass: 'large',
  },
  C: {
    series: 'C',
    nameKo: '야자수',
    nameEn: 'Palm Tree',
    variants: [1],
    biomes: ['tropical'],
    sizeClass: 'large',
  },
  D: {
    series: 'D',
    nameKo: '고목/죽은나무',
    nameEn: 'Dead Tree/Withered',
    variants: [1,2,3],
    biomes: ['arid'],
    sizeClass: 'medium',
  },
  E: {
    series: 'E',
    nameKo: '관목/덤불',
    nameEn: 'Shrub/Bush',
    variants: [1,2,3,4,5],
    biomes: ['temperate', 'tropical', 'mediterranean'],
    sizeClass: 'small',
  },
} as const;

/** 특수 Tree 에셋 */
export const TREE_SPECIAL = {
  /** Tree Shadow.png — 나무 전용 그림자 (방향 없음, 단일 파일) */
  shadow: `${ENV_BASE_PATH}/${encodeURIComponent('Tree Shadow.png')}`,
  /** TreeTrunkBroken.png — 부서진 나무 몸통 (방향 없음) */
  trunkBroken: `${ENV_BASE_PATH}/${encodeURIComponent('TreeTrunkBroken.png')}`,
} as const;

// ============================================================================
// 8. Flora 카탈로그 — 풀/꽃/덤불 (13종 x 4방향 = 52 파일)
// ============================================================================

/**
 * Flora 시리즈: A~B (2개 식물 그룹)
 *
 * 지면 위 장식용 식생 — Layer 4 (Flora)에 배치
 * Ground 타일의 15~25%에 랜덤 배치
 */
export type FloraSeries = 'A' | 'B';

export interface FloraSeriesDef {
  readonly series: FloraSeries;
  readonly nameKo: string;
  readonly nameEn: string;
  readonly variants: readonly number[];
  readonly biomes: readonly string[];
}

export const FLORA_SERIES: Record<FloraSeries, FloraSeriesDef> = {
  A: {
    series: 'A',
    nameKo: '꽃/풀',
    nameEn: 'Flowers/Grass',
    variants: [1,2,3,4,5,6,7],
    biomes: ['temperate', 'tropical', 'mediterranean'],
  },
  B: {
    series: 'B',
    nameKo: '덤불/관목 식생',
    nameEn: 'Bush/Shrub Flora',
    variants: [1,2,3,4,5,6],
    biomes: ['temperate', 'tropical', 'mediterranean'],
  },
} as const;

// ============================================================================
// 9. WallFlora 카탈로그 — 담쟁이/덩굴 (14종 x 4방향 = 56 파일)
// ============================================================================

/**
 * WallFlora 시리즈: A만 존재 (14종)
 *
 * 건물 벽면에 덩굴/담쟁이 오버레이
 * Layer 8 (WallFlora)에 배치 — Wall 위, Roof 아래
 * Temperate, Mediterranean 바이옴에서 주로 사용
 */
export interface WallFloraSeriesDef {
  readonly series: 'A';
  readonly nameKo: string;
  readonly nameEn: string;
  readonly variants: readonly number[];
}

export const WALLFLORA_SERIES: WallFloraSeriesDef = {
  series: 'A',
  nameKo: '담쟁이/덩굴',
  nameEn: 'Ivy/Vine',
  variants: [1,2,3,4,5,6,7,8,9,10,11,12,13,14],
} as const;
// ============================================================================
// 10. Misc 카탈로그 — 소품/가구/잡동사니 (99종 x 4방향 = 396 파일)
// ============================================================================

/**
 * Misc 시리즈: A~E (5개 소품 그룹)
 *
 * Layer 6 (Misc)에 배치 — 건물 인접 타일에 맥락적 배치
 */
export type MiscSeries = 'A' | 'B' | 'C' | 'D' | 'E';

/** Misc 소품 용도 분류 */
export type MiscPurpose =
  | 'signage'     // 깃발/표지판
  | 'furniture'   // 가구
  | 'container'   // 배럴/상자/자루
  | 'weapon'      // 무기/도구
  | 'decoration'  // 장식
  | 'machinery'   // 기계/수레
  | 'food'        // 음식/식재료
  | 'trade';      // 교역품

export interface MiscSeriesDef {
  readonly series: MiscSeries;
  readonly nameKo: string;
  readonly nameEn: string;
  readonly variants: readonly number[];
  /** 주요 용도 */
  readonly primaryUse: MiscPurpose;
  /** 어떤 건물 인접에 배치할지 */
  readonly nearBuildings: readonly string[];
}

export const MISC_SERIES: Record<MiscSeries, MiscSeriesDef> = {
  A: {
    series: 'A',
    nameKo: '깃발/표지판',
    nameEn: 'Flags/Signs',
    variants: [1,2,3,4,5,6,7,8,9],
    primaryUse: 'signage',
    nearBuildings: ['government', 'barracks', 'hospital', 'school', 'town_hall'],
  },
  B: {
    series: 'B',
    nameKo: '가구/배럴/상자',
    nameEn: 'Furniture/Barrel/Crate',
    // Note: B4 결번 — 총 61종
    variants: [1,2,3,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,
               21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,
               41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61],
    primaryUse: 'container',
    nearBuildings: ['market', 'warehouse', 'farm', 'factory', 'house'],
  },
  C: {
    series: 'C',
    nameKo: '무기/도구',
    nameEn: 'Weapons/Tools',
    variants: [1,2,3,4,5,6,7,8,9,10,11,12,13,14],
    primaryUse: 'weapon',
    nearBuildings: ['barracks', 'weapons_depot', 'military_base'],
  },
  D: {
    series: 'D',
    nameKo: '장식',
    nameEn: 'Decorations',
    variants: [1,2,3,4,5],
    primaryUse: 'decoration',
    nearBuildings: ['church', 'government', 'capitol', 'luxury_workshop'],
  },
  E: {
    series: 'E',
    nameKo: '기계/수레',
    nameEn: 'Machinery/Cart',
    variants: [1,2,3,4,5,6,7,8,9,10,11],
    primaryUse: 'machinery',
    nearBuildings: ['factory', 'power_plant', 'steel_mill', 'refinery', 'port'],
  },
} as const;

/**
 * Misc B 세부 용도 분류 (61종 상세)
 * B 시리즈가 가장 많은 소품을 보유하므로 세부 분류 필요
 */
export const MISC_B_SUBCATEGORY: Record<string, readonly number[]> = {
  /** 배럴/통 */
  barrels: [1, 2, 3, 5, 6, 7],
  /** 상자/크레이트 */
  crates: [8, 9, 10, 11, 12, 13, 14, 15],
  /** 자루/가방 */
  sacks: [16, 17, 18, 19, 20],
  /** 탁자/의자/가구 */
  furniture: [21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
  /** 음식/농산물 */
  food: [31, 32, 33, 34, 35],
  /** 도구/장비 */
  tools: [36, 37, 38, 39, 40],
  /** 교역품/물품 */
  tradeGoods: [41, 42, 43, 44, 45, 46, 47, 48, 49, 50],
  /** 기타 잡동사니 */
  miscItems: [51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61],
};
// ============================================================================
// 11. Shadow / Door / Chest 카탈로그
// ============================================================================

// --- Shadow (13종 x 4방향 = 52 파일) ---

/**
 * Shadow: 건물/나무 그림자
 * 파일명: "Shadow{N}_{D}.png" (시리즈 문자 없음)
 * Layer 3에 배치 — Ground 위, Flora/Wall 아래
 */
export const SHADOW_VARIANTS = [1,2,3,4,5,6,7,8,9,10,11,12,13] as const;

/** Shadow 변형별 크기/용도 추정 */
export const SHADOW_VARIANT_USE: Record<number, string> = {
  1: '소형 원형 — 관목/소품용',
  2: '소형 타원 — 소형 나무',
  3: '중형 — 중형 나무/소형 건물',
  4: '중형 변형',
  5: '대형 — 대형 나무',
  6: '대형 변형',
  7: '넓은 — 2x1 건물',
  8: '넓은 변형',
  9: '초대형 — 2x2 건물',
  10: '초대형 변형',
  11: '특대형 — 3x2 건물',
  12: '특대형 변형',
  13: '최대형 — 3x3 건물',
};

// --- Door (8종 x 4방향 = 32 파일) ---

/**
 * Door 시리즈: A, C (B 결번)
 *
 * Wall과 같은 타일 좌표에 오버레이 배치
 * A: 목재문 (소형/중형 목조 건물용)
 * C: 석조/금속문 (중형+ 건물용)
 */
export type DoorSeries = 'A' | 'C';

export interface DoorSeriesDef {
  readonly series: DoorSeries;
  readonly nameKo: string;
  readonly nameEn: string;
  readonly variants: readonly number[];
}

export const DOOR_SERIES: Record<DoorSeries, DoorSeriesDef> = {
  A: {
    series: 'A',
    nameKo: '목재문',
    nameEn: 'Wooden Door',
    variants: [1, 2],
  },
  C: {
    series: 'C',
    nameKo: '석조/금속문',
    nameEn: 'Stone/Metal Door',
    variants: [1, 2, 3, 4, 5, 6],
  },
} as const;

// --- Chest (6종 x 4방향 = 24 파일) ---

/**
 * Chest 시리즈: A, B
 *
 * Layer 10에 배치 — 보물/저장소
 * market, government 인근에 배치
 */
export type ChestSeries = 'A' | 'B';

export interface ChestSeriesDef {
  readonly series: ChestSeries;
  readonly nameKo: string;
  readonly nameEn: string;
  readonly variants: readonly number[];
}

export const CHEST_SERIES: Record<ChestSeries, ChestSeriesDef> = {
  A: {
    series: 'A',
    nameKo: '보물상자',
    nameEn: 'Treasure Chest',
    variants: [1, 2, 3, 4],
  },
  B: {
    series: 'B',
    nameKo: '저장 상자',
    nameEn: 'Storage Chest',
    variants: [1, 2],
  },
} as const;
// ============================================================================
// 12. 특수 에셋 (방향 없음, 단일 파일)
// ============================================================================

export const SPECIAL_ASSETS = {
  /** 완전 검정 타일 — 미탐사/안개 영역용 */
  blackTile: `${ENV_BASE_PATH}/${encodeURIComponent('BLACK TILE.png')}`,
  /** 타일 프리뷰 — 에디터/디버그용 */
  tilePreview: `${ENV_BASE_PATH}/${encodeURIComponent('TilePreview.png')}`,
  /** 벽난로 — 실내 장식 */
  firePlace: `${ENV_BASE_PATH}/${encodeURIComponent('FirePlace.png')}`,
  /** 횃불 동쪽 — 건물 벽면 조명 */
  torchEast: `${ENV_BASE_PATH}/${encodeURIComponent('Torch East.png')}`,
  /** 횃불 서쪽 — 건물 벽면 조명 */
  torchWest: `${ENV_BASE_PATH}/${encodeURIComponent('Torch West.png')}`,
  /** 횃불 2 — 독립 조명 */
  torch2: `${ENV_BASE_PATH}/${encodeURIComponent('Torch2.png')}`,
  /** 부서진 나무 몸통 */
  treeTrunkBroken: `${ENV_BASE_PATH}/${encodeURIComponent('TreeTrunkBroken.png')}`,
} as const;

// ============================================================================
// 13. Other 에셋 — 구름/이펙트 오버레이 (7 파일)
// ============================================================================

/**
 * Other 디렉토리: 화면 고정 레이어 또는 전체 오버레이 용
 */
export const OTHER_ASSETS = {
  /** 구름 1 (1200x300, 투명 배경) — Layer 13 패럴랙스 */
  cloud1: `${OTHER_BASE_PATH}/Cloud1.png`,
  /** 구름 2 (1200x300) */
  cloud2: `${OTHER_BASE_PATH}/Cloud2.png`,
  /** 구름 3 (1200x300) */
  cloud3: `${OTHER_BASE_PATH}/Cloud3.png`,
  /** 신성 광선 — 특수 이벤트 오버레이 */
  godRay: `${OTHER_BASE_PATH}/GodRay.png`,
  /** 대시 라인 — 이동 경로 표시 */
  dashLine: `${OTHER_BASE_PATH}/DashLine.png`,
  /** AoE 화염 — 전투 이펙트 */
  aoeFire: `${OTHER_BASE_PATH}/AoEFire.png`,
  /** 아이템 광선 — 드롭 하이라이트 */
  itemRay: `${OTHER_BASE_PATH}/ItemRay.png`,
} as const;

/** 구름 에셋 목록 (패럴랙스 시스템용) */
export const CLOUD_ASSETS = [
  OTHER_ASSETS.cloud1,
  OTHER_ASSETS.cloud2,
  OTHER_ASSETS.cloud3,
] as const;
// ============================================================================
// 14. 경계 타일 매핑표 (Ground 변형 → 경계 용도)
// ============================================================================

/**
 * 지형 경계 처리를 위한 타일 매핑
 *
 * 바이옴 경계에서 부드러운 전환을 위해:
 * 1) 기본 full diamond 배치 (안전한 1~2번)
 * 2) 경계 방향에 맞는 half/corner/deco 타일 오버레이
 *
 * 아래 표는 Ground A 시리즈 기준이며, 다른 시리즈(B~J)는
 * 변형 수가 적어 full(1~2) + 나머지 전체를 boundary 후보로 사용
 */

/** 경계 상황 타입 */
export type BoundaryDirection =
  | 'full'       // 완전 채움 (경계 아님)
  | 'edge_nw'    // 북서 에지
  | 'edge_ne'    // 북동 에지
  | 'edge_sw'    // 남서 에지
  | 'edge_se'    // 남동 에지
  | 'corner_n'   // 북쪽 코너
  | 'corner_s'   // 남쪽 코너
  | 'corner_e'   // 동쪽 코너
  | 'corner_w'   // 서쪽 코너
  | 'thin_ns'    // 남북 좁은 통로
  | 'thin_ew'    // 동서 좁은 통로
  | 'deco';      // 작은 데코 빈틈

/**
 * Ground A 시리즈 경계 타일 매핑표 (Phase 0 확정)
 *
 * 픽셀 분석 기반:
 * - full: 1,2,5,6,10,11,12,14 — 128x80 완전 다이아몬드
 * - half_l: 3 — 좌측 편향 (NW/SW 경계용)
 * - half_r: 8,9 — 우측 편향 (NE/SE 경계용)
 * - corner: 4,7 — 소형 조각 (코너 전환)
 * - thin: 15,16,17,18,19 — 얇은 띠 (좁은 통로/강가)
 * - deco: 20,21,22,23,24 — 극소형 (자연스러운 빈틈)
 */
export const GROUND_A_BOUNDARY_MAP: Record<BoundaryDirection, readonly number[]> = {
  full:     [1, 2, 5, 6, 10, 11, 12, 14],
  edge_nw:  [3],            // 좌측 반쪽 → NW 에지
  edge_ne:  [8, 9],         // 우측 반쪽 → NE 에지
  edge_sw:  [3],            // 좌측 반쪽 → SW 에지 (회전 대칭)
  edge_se:  [8, 9],         // 우측 반쪽 → SE 에지 (회전 대칭)
  corner_n: [4, 7],         // 소형 조각 → 북쪽 코너
  corner_s: [4, 7],         // 소형 조각 → 남쪽 코너
  corner_e: [8],            // 우측 소형 → 동쪽 코너
  corner_w: [3],            // 좌측 소형 → 서쪽 코너
  thin_ns:  [15, 16, 17],   // 얇은 변형 → 남북 좁은 통로
  thin_ew:  [18, 19],       // 얇은 변형 → 동서 좁은 통로
  deco:     [20, 21, 22, 23, 24], // 극소형 → 자연 빈틈
};

/**
 * 시리즈별 경계 후보 타일 (B~J는 변형이 적어 단순 분류)
 * full = 기본 채움, boundary = 경계/전환 후보
 */
export const GROUND_BOUNDARY_CANDIDATES: Record<GroundSeries, {
  full: readonly number[];
  boundary: readonly number[];
}> = {
  A: { full: [1,2,5,6,10,11,12,14], boundary: [3,4,7,8,9,15,16,17,18,19,20,21,22,23,24] },
  B: { full: [1,2,3], boundary: [4,5,6] },
  C: { full: [1,2,3], boundary: [4,5,6] },
  D: { full: [1,2], boundary: [3,4] },
  E: { full: [1,2,3,4,5], boundary: [6,7,8,9,10,11,12,13,14,15] },
  F: { full: [1,2,3], boundary: [4,5,6] },
  G: { full: [1,2,3,4,5,6], boundary: [7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22] },
  H: { full: [1,2,3], boundary: [4,5,6,7,8,9,10,11] },
  I: { full: [1,2,3], boundary: [4,5,6,7,8,9,10] },
  J: { full: [1,2,3], boundary: [4,5,6,7,8,9,10] },
};
// ============================================================================
// 15. 시민 스프라이트 시트 분석
// ============================================================================

/**
 * 캐릭터 스프라이트 시트 사양:
 * - 시트 크기: 1920 x 1024 px
 * - 프레임 크기: 128 x 128 px (1920/15=128, 1024/8=128)
 * - 그리드: 15열 x 8행 = 120 프레임/시트
 * - 8행 = 8방향 (N, NE, E, SE, S, SW, W, NW)
 * - 15열 = 최대 15 애니메이션 프레임
 *
 * 표시 스케일: 128px → 24~32px (0.1875~0.25 스케일)
 */

/** 캐릭터 유형 */
export type CharacterType =
  | 'Player'
  | 'NPC1' | 'NPC2' | 'NPC3'
  | 'Enemy 1' | 'Enemy 2' | 'Enemy 3';

/** 모든 캐릭터 유형 목록 */
export const CHARACTER_TYPES: readonly CharacterType[] = [
  'Player', 'NPC1', 'NPC2', 'NPC3',
  'Enemy 1', 'Enemy 2', 'Enemy 3',
] as const;

/** 캐릭터 애니메이션 이름 (24종 공통) */
export type CharacterAnimation =
  | 'Attack1' | 'Attack2' | 'Attack3' | 'Attack4' | 'Attack5'
  | 'AttackRun' | 'AttackRun2'
  | 'CrouchIdle' | 'CrouchRun'
  | 'Die'
  | 'Idle' | 'Idle2' | 'Idle3' | 'Idle4'
  | 'RideIdle' | 'RideRun'
  | 'Run' | 'RunBackwards'
  | 'Special1'
  | 'StrafeLeft' | 'StrafeRight'
  | 'TakeDamage'
  | 'Taunt'
  | 'Walk';

/** 모든 애니메이션 목록 */
export const CHARACTER_ANIMATIONS: readonly CharacterAnimation[] = [
  'Attack1', 'Attack2', 'Attack3', 'Attack4', 'Attack5',
  'AttackRun', 'AttackRun2',
  'CrouchIdle', 'CrouchRun',
  'Die',
  'Idle', 'Idle2', 'Idle3', 'Idle4',
  'RideIdle', 'RideRun',
  'Run', 'RunBackwards',
  'Special1',
  'StrafeLeft', 'StrafeRight',
  'TakeDamage',
  'Taunt',
  'Walk',
] as const;

/** 스프라이트 시트 규격 */
export const SPRITE_SHEET_SPEC = {
  /** 시트 너비 */
  sheetWidth: 1920,
  /** 시트 높이 */
  sheetHeight: 1024,
  /** 프레임 너비 */
  frameWidth: 128,
  /** 프레임 높이 */
  frameHeight: 128,
  /** 열 수 (프레임/방향) */
  columns: 15,
  /** 행 수 (방향) */
  rows: 8,
  /** 총 프레임 수 */
  totalFrames: 120,
  /** 표시 시 스케일 다운 */
  displayScale: 0.25, // 128px → 32px
} as const;

/**
 * 스프라이트 시트 방향 매핑
 * 행 인덱스 (0~7) → 카메라 방향
 */
export type SpriteDirection = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

export const SPRITE_DIRECTION_ROW: Record<SpriteDirection, number> = {
  N:  0,
  NE: 1,
  E:  2,
  SE: 3,
  S:  4,
  SW: 5,
  W:  6,
  NW: 7,
};

/**
 * 시민 상태 → 애니메이션 매핑
 * (v26 CitizenState → 에셋 애니메이션 이름)
 */
export type CitizenState =
  | 'working'
  | 'commuting'
  | 'shopping'
  | 'resting'
  | 'protesting'
  | 'idle';

export const CITIZEN_STATE_TO_ANIMATION: Record<CitizenState, CharacterAnimation> = {
  working:    'Walk',
  commuting:  'Run',
  shopping:   'Walk',
  resting:    'Idle',
  protesting: 'Taunt',
  idle:       'Idle',
};

/**
 * 캐릭터 스프라이트 시트 경로 생성
 */
export function characterSheetPath(
  characterType: CharacterType,
  animation: CharacterAnimation
): string {
  return `${CHAR_BASE_PATH}/${encodeURIComponent(characterType)}/${animation}.png`;
}

/**
 * 시민용 캐릭터 타입 선택 (Player + NPC 3종 사용)
 * Enemy는 전투 이벤트에서만 사용
 */
export const CITIZEN_CHARACTER_TYPES: readonly CharacterType[] = [
  'Player', 'NPC1', 'NPC2', 'NPC3',
] as const;
// ============================================================================
// 16. Animations 카탈로그 — 물결/파괴/이펙트/소품 애니메이션
// ============================================================================

/**
 * Animated Tiles — Water Ripples (13종, 각 16프레임)
 * 물 타일 위 오버레이, Layer 1
 */
export const WATER_RIPPLE_COUNT = 13;
export const WATER_RIPPLE_FRAMES = 16;
export const WATER_RIPPLE_FPS = 8;

/**
 * Water Ripple 프레임 번호 목록 (실제 파일명: 0001, 0003, ... 0031)
 * 홀수 번호 × 4자리 zero-pad
 */
export const WATER_RIPPLE_FRAME_NUMBERS: readonly string[] = Array.from(
  { length: WATER_RIPPLE_FRAMES },
  (_, i) => String(i * 2 + 1).padStart(4, '0'),
);

export function waterRipplePath(rippleIndex: number, frameIdx: number): string {
  // 프레임 인덱스(0~15) → 실제 파일명 (0001, 0003, ... 0031)
  const frameNum = WATER_RIPPLE_FRAME_NUMBERS[frameIdx] ?? '0001';
  const dir = `Animated Tiles/Water Ripples ${rippleIndex}`;
  return `${ANIM_BASE_PATH}/${encodeURIComponent(dir)}/${frameNum}.png`;
}

/**
 * Animated Tiles — WindMill (2종, 각 17프레임)
 * Temperate/Mediterranean 바이옴 Farm 인접에 배치
 */
export const WINDMILL_COUNT = 2;
export const WINDMILL_FRAMES = 17;
export const WINDMILL_FPS = 6;

/**
 * WindMill 프레임 번호 목록 (실제 파일명: 0001, 0003, ... 0033)
 */
export const WINDMILL_FRAME_NUMBERS: readonly string[] = Array.from(
  { length: WINDMILL_FRAMES },
  (_, i) => String(i * 2 + 1).padStart(4, '0'),
);

export function windmillPath(windmillIndex: number, frameIdx: number): string {
  // 프레임 인덱스(0~16) → 실제 파일명 (0001, 0003, ... 0033)
  const frameNum = WINDMILL_FRAME_NUMBERS[frameIdx] ?? '0001';
  const dir = `Animated Tiles/WindMill${windmillIndex}`;
  return `${ANIM_BASE_PATH}/${encodeURIComponent(dir)}/${frameNum}.png`;
}

/**
 * Destructible Tiles — 파괴 애니메이션 (17종)
 * 건물 파괴 시 재생
 */
export interface DestructibleAnimDef {
  readonly name: string;
  readonly frames: number;
  readonly fps: number;
}

export const DESTRUCTIBLE_ANIMS: readonly DestructibleAnimDef[] = [
  { name: 'Clay explosion', frames: 19, fps: 20 },
  { name: 'Grass explosion small', frames: 19, fps: 20 },
  { name: 'grass explosion large', frames: 19, fps: 20 },
  { name: 'Stone damage', frames: 16, fps: 20 },
  { name: 'stone explosion Small', frames: 19, fps: 20 },
  { name: 'stone explosion large', frames: 19, fps: 20 },
  { name: 'Tree Green Explosion', frames: 16, fps: 20 },
  { name: 'Tree Yellow Explosion', frames: 16, fps: 20 },
  { name: 'Wall Stone explosion', frames: 16, fps: 20 },
  { name: 'Wall Wood explosion Small', frames: 16, fps: 20 },
  { name: 'Wall Wood explotion Large', frames: 20, fps: 20 },
  { name: 'Wall wood+stone explosion', frames: 19, fps: 20 },
  { name: 'Wood damage', frames: 16, fps: 20 },
  { name: 'Wood roof explosion', frames: 16, fps: 20 },
  { name: 'straw explosion', frames: 16, fps: 20 },
  { name: 'wood explosion Small', frames: 16, fps: 20 },
  { name: 'wood explosion large', frames: 16, fps: 20 },
] as const;

/**
 * Effects — 전투/버프 이펙트 (14종)
 */
export interface EffectAnimDef {
  readonly name: string;
  readonly frames: number;
  readonly fps: number;
  /** 512x512 or 256x256 */
  readonly size: number;
}

export const EFFECT_ANIMS: readonly EffectAnimDef[] = [
  { name: 'AoE', frames: 30, fps: 20, size: 512 },
  { name: 'Bolt', frames: 15, fps: 15, size: 512 },
  { name: 'Buff1', frames: 7, fps: 12, size: 512 },
  { name: 'Buff2', frames: 15, fps: 12, size: 512 },
  { name: 'Buff3', frames: 12, fps: 12, size: 512 },
  { name: 'Buff4', frames: 15, fps: 12, size: 512 },
  { name: 'Buff5 6', frames: 14, fps: 12, size: 512 },
  { name: 'Buff7 8', frames: 15, fps: 12, size: 512 },
  { name: 'Buff9', frames: 15, fps: 12, size: 512 },
  { name: 'Buff10', frames: 15, fps: 12, size: 512 },
  { name: 'Cone', frames: 15, fps: 15, size: 512 },
  { name: 'Dash', frames: 15, fps: 15, size: 512 },
  { name: 'Hook', frames: 15, fps: 15, size: 512 },
  { name: 'LevelUp', frames: 15, fps: 15, size: 512 },
] as const;

/**
 * Props — 소품 애니메이션 (11종)
 */
export interface PropAnimDef {
  readonly name: string;
  readonly frames: number;
  readonly fps: number;
  /** loop 여부 */
  readonly loop: boolean;
}

export const PROP_ANIMS: readonly PropAnimDef[] = [
  { name: 'Barrel 1', frames: 17, fps: 12, loop: false },
  { name: 'Barrel 2', frames: 16, fps: 12, loop: false },
  { name: 'Barrel 3', frames: 17, fps: 12, loop: false },
  { name: 'Fire', frames: 16, fps: 12, loop: true },
  { name: 'Fire2', frames: 16, fps: 12, loop: true },
  { name: 'Gas', frames: 16, fps: 12, loop: true },
  { name: 'PortalIdle', frames: 16, fps: 10, loop: true },
  { name: 'PortalOpen', frames: 16, fps: 10, loop: false },
  { name: 'Skeleton explosion', frames: 16, fps: 15, loop: false },
  { name: 'Torch 1', frames: 16, fps: 12, loop: true },
  { name: 'Turret1', frames: 8, fps: 8, loop: true },
] as const;

// ============================================================================
// 16.1 Animation 프레임 경로 생성 유틸리티
// ============================================================================

/**
 * Effect 프레임 번호 생성 (홀수 번호, 4자리 zero-pad)
 * Effects와 Destructible/Props 모두 동일 패턴
 */
export function animFrameNumber(frameIdx: number): string {
  return String(frameIdx * 2 + 1).padStart(4, '0');
}

/**
 * 경로 세그먼트 인코딩 — 각 디렉토리를 개별 인코딩하여 슬래시 보존
 */
function encodePathSegments(dir: string): string {
  return dir.split('/').map(seg => encodeURIComponent(seg)).join('/');
}

/**
 * Effects 프레임 경로 생성
 * @param effectName 이펙트 이름 (예: 'LevelUp', 'Buff1')
 * @param frameIdx 프레임 인덱스 (0-based)
 */
export function effectFramePath(effectName: string, frameIdx: number): string {
  const frameNum = animFrameNumber(frameIdx);
  return `${ANIM_BASE_PATH}/${encodePathSegments(`Effects/${effectName}`)}/${frameNum}.png`;
}

/**
 * Destructible 프레임 경로 생성
 * @param destructibleName 파괴 애니메이션 이름 (예: 'Wall Wood explosion Small')
 * @param frameIdx 프레임 인덱스 (0-based)
 */
export function destructibleFramePath(destructibleName: string, frameIdx: number): string {
  const frameNum = animFrameNumber(frameIdx);
  return `${ANIM_BASE_PATH}/${encodePathSegments(`Destructible tiles/${destructibleName}`)}/${frameNum}.png`;
}

/**
 * Props 프레임 경로 생성
 * @param propName 소품 이름 (예: 'Fire', 'Torch 1')
 * @param frameIdx 프레임 인덱스 (0-based)
 */
export function propFramePath(propName: string, frameIdx: number): string {
  const frameNum = animFrameNumber(frameIdx);
  return `${ANIM_BASE_PATH}/${encodePathSegments(`Props/${propName}`)}/${frameNum}.png`;
}

/**
 * 건물 시각 등급 → 파괴 이펙트 매핑
 * 건물의 Wall 재질에 따라 적합한 파괴 애니메이션 선택
 */
export const BUILDING_DESTROY_EFFECT_MAP: Record<string, string> = {
  small_wood:    'Wall Wood explosion Small',
  medium_wood:   'Wall Wood explotion Large',
  medium_stone:  'Wall Stone explosion',
  large_factory: 'stone explosion large',
  military:      'Wall wood+stone explosion',
  government:    'Wall Stone explosion',
};

/**
 * 건물 카테고리 → Props 매핑 (건물 인접에 배치할 애니메이션 소품)
 */
export const BUILDING_PROP_MAP: Record<string, string[]> = {
  // 공장류: 불/가스
  factory: ['Fire', 'Gas'],
  steel_mill: ['Fire', 'Fire2'],
  refinery: ['Fire', 'Gas'],
  power_plant: ['Fire'],
  coal_power: ['Fire'],
  gas_power: ['Gas'],
  oil_power: ['Fire', 'Gas'],
  nuclear_power: ['Gas'],
  // 군사: 횃불
  barracks: ['Torch 1'],
  weapons_depot: ['Torch 1'],
  military_base: ['Torch 1', 'Turret1'],
  // 정부/종교: 횃불
  church: ['Torch 1'],
  town_hall: ['Torch 1'],
  capitol: ['Torch 1'],
  government: ['Torch 1'],
};

/**
 * Chest 배치 대상 건물 (market/government/warehouse 인근)
 */
export const CHEST_ELIGIBLE_BUILDINGS: readonly string[] = [
  'market', 'warehouse', 'town_hall', 'capitol', 'government',
  'port', 'luxury_workshop',
];

// ============================================================================
// 17. 에셋 수량 요약 + 유틸리티
// ============================================================================

/**
 * 전체 에셋 수량 요약
 */
export const ASSET_SUMMARY = {
  environment: {
    ground:    { series: 10, variants: 113, files: 452 },  // 113 x 4dir
    wall:      { series: 7,  variants: 104, files: 416 },
    roof:      { series: 7,  variants: 57,  files: 228 },
    stone:     { series: 1,  variants: 22,  files: 88 },
    tree:      { series: 5,  variants: 18,  files: 72 },
    flora:     { series: 2,  variants: 13,  files: 52 },
    wallFlora: { series: 1,  variants: 14,  files: 56 },
    misc:      { series: 5,  variants: 100, files: 400 },
    shadow:    { series: 0,  variants: 13,  files: 52 },
    door:      { series: 2,  variants: 8,   files: 32 },
    chest:     { series: 2,  variants: 6,   files: 24 },
    special:   { series: 0,  variants: 7,   files: 7 },   // 방향 없음
    subtotal: 1879,
  },
  characters: {
    types: 7,            // Player + NPC1~3 + Enemy1~3
    animations: 24,      // 각 캐릭터 24종 시트
    sheets: 168,         // 7 x 24
  },
  animations: {
    waterRipples: { count: 13, framesEach: 16, totalFrames: 208 },
    windmill:     { count: 2,  framesEach: 17, totalFrames: 34 },
    destructible: { count: 17, totalFrames: 292 },
    effects:      { count: 14, totalFrames: 198 },
    props:        { count: 11, totalFrames: 162 },
  },
  other: { files: 7 },
  /** 총 에셋 파일 수 (공식 카운트: 2,948개 환경은 디렉토리 구조에 따라 차이 가능) */
  totalEstimate: 2948,
} as const;

/**
 * 모든 Ground 시리즈의 변형 번호 목록을 배열로 반환
 */
export function getAllGroundVariants(series: GroundSeries): readonly number[] {
  return GROUND_SERIES[series].variants;
}

/**
 * 모든 Wall 시리즈의 변형 번호 목록을 배열로 반환
 */
export function getAllWallVariants(series: WallSeries): readonly number[] {
  return WALL_SERIES[series].variants;
}

/**
 * 모든 Roof 시리즈의 변형 번호 목록을 배열로 반환
 */
export function getAllRoofVariants(series: RoofSeries): readonly number[] {
  return ROOF_SERIES[series].variants;
}

/**
 * 건물 시각 등급 → Wall/Roof 기본 조합
 */
export type BuildingVisualGrade =
  | 'small_wood'     // 소형 목조
  | 'medium_wood'    // 중형 목조
  | 'medium_stone'   // 중형 석조
  | 'large_factory'  // 대형 공장
  | 'military'       // 군사 시설
  | 'government';    // 정부/종교

export interface VisualGradeComposite {
  readonly wallSeries: WallSeries;
  readonly roofSeries: RoofSeries;
  readonly doorSeries: DoorSeries;
  readonly doorVariant: number;
}

export const VISUAL_GRADE_DEFAULTS: Record<BuildingVisualGrade, VisualGradeComposite> = {
  small_wood:    { wallSeries: 'A', roofSeries: 'A', doorSeries: 'A', doorVariant: 1 },
  medium_wood:   { wallSeries: 'B', roofSeries: 'B', doorSeries: 'A', doorVariant: 2 },
  medium_stone:  { wallSeries: 'C', roofSeries: 'C', doorSeries: 'C', doorVariant: 2 },
  large_factory: { wallSeries: 'E', roofSeries: 'E', doorSeries: 'C', doorVariant: 3 },
  military:      { wallSeries: 'D', roofSeries: 'C', doorSeries: 'C', doorVariant: 1 },
  government:    { wallSeries: 'F', roofSeries: 'F', doorSeries: 'C', doorVariant: 5 },
};
