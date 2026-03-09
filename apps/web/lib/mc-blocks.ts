/**
 * mc-blocks.ts -- MC 블록 타입 정의 (v29 Phase 3)
 *
 * 38종 블록 타입의 기본색, 패턴, 가장자리 어둡기 계수 정의.
 * 512x512 아틀라스, 64x64 셀 (8x8 그리드).
 * mc-texture-atlas.ts에서 프로시저럴 텍스처 생성 시 참조.
 */

// ─── BlockType 열거형 (38종) ───

export enum BlockType {
  STONE = 0,
  SANDSTONE = 1,
  OAK_PLANKS = 2,
  GOLD = 3,
  RED_BRICK = 4,
  NETHER_BRICK = 5,
  QUARTZ = 6,
  GLASS = 7,
  CLAY = 8,
  HAY = 9,
  BAMBOO = 10,
  LEAVES = 11,
  PRISMARINE = 12,
  CORAL = 13,
  WOOL = 14,
  SNOW = 15,
  TERRACOTTA = 16,
  EMERALD = 17,
  DIAMOND = 18,
  IRON = 19,
  COPPER = 20,
  MOSSY_STONE = 21,
  OBSIDIAN = 22,
  REDSTONE = 23,
  GRASS_TOP = 24,
  GRASS_SIDE = 25,
  SAND = 26,
  GRAVEL = 27,
  BRICK = 28,
  OAK_LOG = 29,
  DARK_OAK = 30,
  PACKED_ICE = 31,
  // ─── 바이옴 변형 블록 (v29 Phase 3) ───
  SNOW_STONE = 32,
  SAND_BRICK = 33,
  MOSS_WOOD = 34,
  GLAZED_TERRACOTTA = 35,
  SLATE = 36,
  BIRCH_WOOD = 37,
}

// ─── 패턴 타입 ───

export type PatternType = 'noise' | 'brick' | 'wood' | 'crystal' | 'stripe' | 'plain';

// ─── 블록 정의 인터페이스 ───

export interface BlockDef {
  /** 기본 색상 (hex) */
  baseColor: string;
  /** 프로시저럴 패턴 타입 */
  pattern: PatternType;
  /** 가장자리 1px 어두움 계수 (0~1, 클수록 어두움) */
  edgeDarken: number;
  /** 노이즈 변조 색상들 (2~4 hex) — 기본색과 혼합 */
  noiseColors?: string[];
}

// ─── 38종 블록 정의 테이블 ───

export const BLOCK_DEFS: Record<BlockType, BlockDef> = {
  [BlockType.STONE]: {
    baseColor: '#888888',
    pattern: 'noise',
    edgeDarken: 0.25,
    noiseColors: ['#777777', '#999999', '#7A7A7A'],
  },
  [BlockType.SANDSTONE]: {
    baseColor: '#D4A017',
    pattern: 'noise',
    edgeDarken: 0.2,
    noiseColors: ['#C89B15', '#DEB020', '#CCAA22'],
  },
  [BlockType.OAK_PLANKS]: {
    baseColor: '#B8945F',
    pattern: 'wood',
    edgeDarken: 0.22,
    noiseColors: ['#A88550', '#C8A570', '#B09060'],
  },
  [BlockType.GOLD]: {
    baseColor: '#FFD700',
    pattern: 'crystal',
    edgeDarken: 0.18,
    noiseColors: ['#EEC900', '#FFE033', '#DDBB00'],
  },
  [BlockType.RED_BRICK]: {
    baseColor: '#AA3333',
    pattern: 'brick',
    edgeDarken: 0.28,
    noiseColors: ['#993030', '#BB3838', '#A03535'],
  },
  [BlockType.NETHER_BRICK]: {
    baseColor: '#442233',
    pattern: 'brick',
    edgeDarken: 0.3,
    noiseColors: ['#3A1D2B', '#4E2838', '#402030'],
  },
  [BlockType.QUARTZ]: {
    baseColor: '#EEE8DD',
    pattern: 'noise',
    edgeDarken: 0.15,
    noiseColors: ['#E8E2D5', '#F2ECE2', '#EAE4D8'],
  },
  [BlockType.GLASS]: {
    baseColor: '#AADDFF',
    pattern: 'plain',
    edgeDarken: 0.1,
    noiseColors: ['#99CCEE', '#BBEEFF'],
  },
  [BlockType.CLAY]: {
    baseColor: '#AA7755',
    pattern: 'noise',
    edgeDarken: 0.25,
    noiseColors: ['#996B4A', '#BB8360', '#A07050'],
  },
  [BlockType.HAY]: {
    baseColor: '#CCAA33',
    pattern: 'stripe',
    edgeDarken: 0.2,
    noiseColors: ['#BB9928', '#DDBB40', '#C4A030'],
  },
  [BlockType.BAMBOO]: {
    baseColor: '#66AA33',
    pattern: 'wood',
    edgeDarken: 0.2,
    noiseColors: ['#5A9928', '#72BB3E', '#60A030'],
  },
  [BlockType.LEAVES]: {
    baseColor: '#448833',
    pattern: 'noise',
    edgeDarken: 0.18,
    noiseColors: ['#3A7A28', '#4E9640', '#408030'],
  },
  [BlockType.PRISMARINE]: {
    baseColor: '#55AA99',
    pattern: 'noise',
    edgeDarken: 0.22,
    noiseColors: ['#4A998A', '#60BBA8', '#50A090'],
  },
  [BlockType.CORAL]: {
    baseColor: '#FF7799',
    pattern: 'noise',
    edgeDarken: 0.18,
    noiseColors: ['#EE6688', '#FF88AA', '#F07090'],
  },
  [BlockType.WOOL]: {
    baseColor: '#EEEEEE',
    pattern: 'noise',
    edgeDarken: 0.12,
    noiseColors: ['#E4E4E4', '#F4F4F4', '#E8E8E8'],
  },
  [BlockType.SNOW]: {
    baseColor: '#FAFAFA',
    pattern: 'plain',
    edgeDarken: 0.1,
    noiseColors: ['#F0F0F0', '#FFFFFF'],
  },
  [BlockType.TERRACOTTA]: {
    baseColor: '#BB6622',
    pattern: 'noise',
    edgeDarken: 0.25,
    noiseColors: ['#AA5B1D', '#CC7128', '#B06020'],
  },
  [BlockType.EMERALD]: {
    baseColor: '#33CC66',
    pattern: 'crystal',
    edgeDarken: 0.2,
    noiseColors: ['#2AB858', '#3CDD72', '#30C060'],
  },
  [BlockType.DIAMOND]: {
    baseColor: '#77DDEE',
    pattern: 'crystal',
    edgeDarken: 0.15,
    noiseColors: ['#6ACCE0', '#84EEFF', '#70D4E4'],
  },
  [BlockType.IRON]: {
    baseColor: '#CCCCCC',
    pattern: 'crystal',
    edgeDarken: 0.22,
    noiseColors: ['#BBBBBB', '#DDDDDD', '#C4C4C4'],
  },
  [BlockType.COPPER]: {
    baseColor: '#BB7744',
    pattern: 'noise',
    edgeDarken: 0.22,
    noiseColors: ['#AA6B3A', '#CC834E', '#B07040'],
  },
  [BlockType.MOSSY_STONE]: {
    baseColor: '#667766',
    pattern: 'noise',
    edgeDarken: 0.25,
    noiseColors: ['#5A6B5A', '#728372', '#607060'],
  },
  [BlockType.OBSIDIAN]: {
    baseColor: '#221133',
    pattern: 'noise',
    edgeDarken: 0.3,
    noiseColors: ['#1B0D2A', '#2A163C', '#200F30'],
  },
  [BlockType.REDSTONE]: {
    baseColor: '#CC3333',
    pattern: 'noise',
    edgeDarken: 0.25,
    noiseColors: ['#BB2828', '#DD3E3E', '#C43030'],
  },
  [BlockType.GRASS_TOP]: {
    baseColor: '#55AA33',
    pattern: 'noise',
    edgeDarken: 0.18,
    noiseColors: ['#4A9928', '#60BB3E', '#50A030'],
  },
  [BlockType.GRASS_SIDE]: {
    baseColor: '#8B7355',
    pattern: 'stripe',
    edgeDarken: 0.22,
    noiseColors: ['#7E684C', '#987E5E', '#857050'],
  },
  [BlockType.SAND]: {
    baseColor: '#DDCC88',
    pattern: 'noise',
    edgeDarken: 0.15,
    noiseColors: ['#D0C07E', '#E8D892', '#D5C885'],
  },
  [BlockType.GRAVEL]: {
    baseColor: '#888877',
    pattern: 'noise',
    edgeDarken: 0.25,
    noiseColors: ['#7A7A6C', '#969682', '#848474'],
  },
  [BlockType.BRICK]: {
    baseColor: '#CC7744',
    pattern: 'brick',
    edgeDarken: 0.25,
    noiseColors: ['#BB6C3A', '#DD824E', '#C47040'],
  },
  [BlockType.OAK_LOG]: {
    baseColor: '#664422',
    pattern: 'wood',
    edgeDarken: 0.28,
    noiseColors: ['#5A3B1D', '#724D28', '#604020'],
  },
  [BlockType.DARK_OAK]: {
    baseColor: '#443311',
    pattern: 'wood',
    edgeDarken: 0.3,
    noiseColors: ['#3A2B0E', '#4E3B15', '#403010'],
  },
  [BlockType.PACKED_ICE]: {
    baseColor: '#AACCEE',
    pattern: 'noise',
    edgeDarken: 0.15,
    noiseColors: ['#9EC0E2', '#B6D8F8', '#A4C8E8'],
  },
  // ─── 바이옴 변형 블록 (v29 Phase 3) ───
  [BlockType.SNOW_STONE]: {
    baseColor: '#C8D4E0',
    pattern: 'noise',
    edgeDarken: 0.2,
    noiseColors: ['#B8C8D8', '#D4E0EC', '#C0D0DE'],
  },
  [BlockType.SAND_BRICK]: {
    baseColor: '#D4B882',
    pattern: 'brick',
    edgeDarken: 0.22,
    noiseColors: ['#C8AC76', '#E0C48E', '#D0B47E'],
  },
  [BlockType.MOSS_WOOD]: {
    baseColor: '#6B8E4A',
    pattern: 'wood',
    edgeDarken: 0.24,
    noiseColors: ['#5F8040', '#778E54', '#688A46'],
  },
  [BlockType.GLAZED_TERRACOTTA]: {
    baseColor: '#CC6633',
    pattern: 'noise',
    edgeDarken: 0.25,
    noiseColors: ['#BB5A28', '#DD7240', '#C46030'],
  },
  [BlockType.SLATE]: {
    baseColor: '#4A5568',
    pattern: 'noise',
    edgeDarken: 0.28,
    noiseColors: ['#404B5C', '#546074', '#4E5966'],
  },
  [BlockType.BIRCH_WOOD]: {
    baseColor: '#D8D0B8',
    pattern: 'wood',
    edgeDarken: 0.18,
    noiseColors: ['#CCC4AC', '#E4DCC4', '#D0C8B0'],
  },
};

/** 전체 블록 수 */
export const BLOCK_COUNT = 38;

/** 아틀라스 그리드 크기 */
export const ATLAS_COLS = 8;
export const ATLAS_ROWS = 8;
export const CELL_SIZE = 64; // 각 블록 텍스처 64×64 px
export const ATLAS_SIZE = 512; // 전체 아틀라스 512×512 px
