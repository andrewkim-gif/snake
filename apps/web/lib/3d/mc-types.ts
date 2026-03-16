// Minecraft 블록 타입, 상수, 속성 정의

// ---------------------------------------------------------------------------
// BlockType — 기존 값 유지 + 신규 타입 추가
// ---------------------------------------------------------------------------
export enum BlockType {
  /** 빈 블록 / 공기 */
  AIR = -1,
  grass = 0,
  sand = 1,
  tree = 2, // oak log (trunk)
  leaf = 3,
  dirt = 4,
  stone = 5,
  coal = 6,
  wood = 7, // oak planks
  diamond = 8,
  quartz = 9,
  glass = 10,
  bedrock = 11,
  cobblestone = 12,
  gravel = 13,
  birch_tree = 14,
  birch_leaf = 15,
  spruce_tree = 16,
  spruce_leaf = 17,
  // v47: 6-Biome 신규 블록
  snow = 18,
  stone_dark = 19,
  sand_dark = 20,
  dirt_with_snow = 21,
  dirt_with_grass = 22,
  sand_with_grass = 23,
  grass_with_snow = 24,
  gravel_with_grass = 25,
}

// ---------------------------------------------------------------------------
// BlockFace — 블록의 6면 방향
// ---------------------------------------------------------------------------
export enum BlockFace {
  TOP = 'top',
  BOTTOM = 'bottom',
  NORTH = 'north',
  SOUTH = 'south',
  EAST = 'east',
  WEST = 'west',
}

// ---------------------------------------------------------------------------
// PlayerMode
// ---------------------------------------------------------------------------
export enum PlayerMode {
  walking = 'walking',
  flying = 'flying',
  sneaking = 'sneaking',
}

export const PLAYER_SPEEDS: Record<PlayerMode, number> = {
  [PlayerMode.walking]: 5.612,
  [PlayerMode.flying]: 21.78,
  [PlayerMode.sneaking]: 2.55,
}

// ---------------------------------------------------------------------------
// 월드 / 터레인 상수
// ---------------------------------------------------------------------------
export const CHUNK_SIZE = 24
export const RENDER_DISTANCE = 3
export const WORLD_HEIGHT = 64
export const SEA_LEVEL = 32

// 하위 호환 별칭
export const MC_CHUNK_SIZE = CHUNK_SIZE
export const MC_RENDER_DISTANCE = RENDER_DISTANCE
export const MC_BASE_Y = 30
export const MC_TREE_HEIGHT = 10
export const MC_CLOUD_HEIGHT = 80

// ---------------------------------------------------------------------------
// 플레이어 물리 상수
// ---------------------------------------------------------------------------
export const PLAYER_HEIGHT = 1.8
export const PLAYER_WIDTH = 0.5
export const GRAVITY = 25
export const JUMP_VELOCITY = 8
export const MAX_FALL_VELOCITY = 38.4
export const INTERACTION_RANGE = 8

// ---------------------------------------------------------------------------
// 블록 이름 매핑
// ---------------------------------------------------------------------------
export const BLOCK_NAMES: Record<BlockType, string> = {
  [BlockType.AIR]: 'Air',
  [BlockType.grass]: 'Grass',
  [BlockType.sand]: 'Sand',
  [BlockType.tree]: 'Oak Log',
  [BlockType.leaf]: 'Leaves',
  [BlockType.dirt]: 'Dirt',
  [BlockType.stone]: 'Stone',
  [BlockType.coal]: 'Coal Ore',
  [BlockType.wood]: 'Oak Planks',
  [BlockType.diamond]: 'Diamond',
  [BlockType.quartz]: 'Quartz',
  [BlockType.glass]: 'Glass',
  [BlockType.bedrock]: 'Bedrock',
  [BlockType.cobblestone]: 'Cobblestone',
  [BlockType.gravel]: 'Gravel',
  [BlockType.birch_tree]: 'Birch Log',
  [BlockType.birch_leaf]: 'Birch Leaves',
  [BlockType.spruce_tree]: 'Spruce Log',
  [BlockType.spruce_leaf]: 'Spruce Leaves',
  [BlockType.snow]: 'Snow',
  [BlockType.stone_dark]: 'Dark Stone',
  [BlockType.sand_dark]: 'Dark Sand',
  [BlockType.dirt_with_snow]: 'Dirt with Snow',
  [BlockType.dirt_with_grass]: 'Dirt with Grass',
  [BlockType.sand_with_grass]: 'Sand with Grass',
  [BlockType.grass_with_snow]: 'Grass with Snow',
  [BlockType.gravel_with_grass]: 'Gravel with Grass',
}

// ---------------------------------------------------------------------------
// 블록 아이콘 매핑 (block-icons 디렉토리)
// ---------------------------------------------------------------------------
export const BLOCK_ICONS: Partial<Record<BlockType, string>> = {
  [BlockType.grass]: 'grass',
  [BlockType.stone]: 'stone',
  [BlockType.tree]: 'tree',
  [BlockType.wood]: 'wood',
  [BlockType.diamond]: 'diamond',
  [BlockType.quartz]: 'quartz',
  [BlockType.glass]: 'glass',
}

// ---------------------------------------------------------------------------
// 핫바 기본 블록 순서
// ---------------------------------------------------------------------------
export const HOTBAR_BLOCKS: BlockType[] = [
  BlockType.grass,
  BlockType.dirt,
  BlockType.stone,
  BlockType.cobblestone,
  BlockType.wood,
  BlockType.glass,
  BlockType.sand,
  BlockType.diamond,
  BlockType.quartz,
  BlockType.coal,
]

// ---------------------------------------------------------------------------
// BlockProperties — 블록별 물리/렌더 속성
// ---------------------------------------------------------------------------
export interface BlockProperties {
  /** 투명 블록인가 (잎, 유리 등) */
  isTransparent: boolean
  /** 고체인가 (충돌 있음) */
  isSolid: boolean
  /** 경도 (채굴 시간 배수, 0=즉시 파괴 불가) */
  hardness: number
  /** 빛 투과 여부 */
  isLightPassthrough: boolean
}

export const BLOCK_PROPERTIES: Record<BlockType, BlockProperties> = {
  [BlockType.AIR]: {
    isTransparent: true,
    isSolid: false,
    hardness: 0,
    isLightPassthrough: true,
  },
  [BlockType.grass]: {
    isTransparent: false,
    isSolid: true,
    hardness: 0.6,
    isLightPassthrough: false,
  },
  [BlockType.dirt]: {
    isTransparent: false,
    isSolid: true,
    hardness: 0.5,
    isLightPassthrough: false,
  },
  [BlockType.stone]: {
    isTransparent: false,
    isSolid: true,
    hardness: 1.5,
    isLightPassthrough: false,
  },
  [BlockType.sand]: {
    isTransparent: false,
    isSolid: true,
    hardness: 0.5,
    isLightPassthrough: false,
  },
  [BlockType.coal]: {
    isTransparent: false,
    isSolid: true,
    hardness: 3.0,
    isLightPassthrough: false,
  },
  [BlockType.tree]: {
    isTransparent: false,
    isSolid: true,
    hardness: 2.0,
    isLightPassthrough: false,
  },
  [BlockType.leaf]: {
    isTransparent: true,
    isSolid: true,
    hardness: 0.2,
    isLightPassthrough: true,
  },
  [BlockType.wood]: {
    isTransparent: false,
    isSolid: true,
    hardness: 2.0,
    isLightPassthrough: false,
  },
  [BlockType.diamond]: {
    isTransparent: false,
    isSolid: true,
    hardness: 5.0,
    isLightPassthrough: false,
  },
  [BlockType.quartz]: {
    isTransparent: false,
    isSolid: true,
    hardness: 0.8,
    isLightPassthrough: false,
  },
  [BlockType.glass]: {
    isTransparent: true,
    isSolid: true,
    hardness: 0.3,
    isLightPassthrough: true,
  },
  [BlockType.bedrock]: {
    isTransparent: false,
    isSolid: true,
    hardness: Infinity,
    isLightPassthrough: false,
  },
  [BlockType.cobblestone]: {
    isTransparent: false,
    isSolid: true,
    hardness: 2.0,
    isLightPassthrough: false,
  },
  [BlockType.gravel]: {
    isTransparent: false,
    isSolid: true,
    hardness: 0.6,
    isLightPassthrough: false,
  },
  [BlockType.birch_tree]: {
    isTransparent: false,
    isSolid: true,
    hardness: 2.0,
    isLightPassthrough: false,
  },
  [BlockType.birch_leaf]: {
    isTransparent: true,
    isSolid: true,
    hardness: 0.2,
    isLightPassthrough: true,
  },
  [BlockType.spruce_tree]: {
    isTransparent: false,
    isSolid: true,
    hardness: 2.0,
    isLightPassthrough: false,
  },
  [BlockType.spruce_leaf]: {
    isTransparent: true,
    isSolid: true,
    hardness: 0.2,
    isLightPassthrough: true,
  },
  [BlockType.snow]: {
    isTransparent: false,
    isSolid: true,
    hardness: 0.4,
    isLightPassthrough: false,
  },
  [BlockType.stone_dark]: {
    isTransparent: false,
    isSolid: true,
    hardness: 2.0,
    isLightPassthrough: false,
  },
  [BlockType.sand_dark]: {
    isTransparent: false,
    isSolid: true,
    hardness: 0.5,
    isLightPassthrough: false,
  },
  [BlockType.dirt_with_snow]: {
    isTransparent: false,
    isSolid: true,
    hardness: 0.5,
    isLightPassthrough: false,
  },
  [BlockType.dirt_with_grass]: {
    isTransparent: false,
    isSolid: true,
    hardness: 0.6,
    isLightPassthrough: false,
  },
  [BlockType.sand_with_grass]: {
    isTransparent: false,
    isSolid: true,
    hardness: 0.5,
    isLightPassthrough: false,
  },
  [BlockType.grass_with_snow]: {
    isTransparent: false,
    isSolid: true,
    hardness: 0.5,
    isLightPassthrough: false,
  },
  [BlockType.gravel_with_grass]: {
    isTransparent: false,
    isSolid: true,
    hardness: 0.6,
    isLightPassthrough: false,
  },
}

// ---------------------------------------------------------------------------
// BLOCK_TEXTURE_MAP — 블록별 top/side/bottom 텍스처 경로
// ---------------------------------------------------------------------------
export interface BlockTextureFaces {
  top: string
  side: string
  bottom: string
}

const TEX = '/textures/blocks'

export const BLOCK_TEXTURE_MAP: Record<Exclude<BlockType, BlockType.AIR>, BlockTextureFaces> = {
  [BlockType.grass]: {
    top: `${TEX}/grass_top_green.png`,
    side: `${TEX}/grass_block_side.png`,
    bottom: `${TEX}/dirt.png`,
  },
  [BlockType.dirt]: {
    top: `${TEX}/dirt.png`,
    side: `${TEX}/dirt.png`,
    bottom: `${TEX}/dirt.png`,
  },
  [BlockType.stone]: {
    top: `${TEX}/stone.png`,
    side: `${TEX}/stone.png`,
    bottom: `${TEX}/stone.png`,
  },
  [BlockType.sand]: {
    top: `${TEX}/sand.png`,
    side: `${TEX}/sand.png`,
    bottom: `${TEX}/sand.png`,
  },
  [BlockType.coal]: {
    top: `${TEX}/coal_ore.png`,
    side: `${TEX}/coal_ore.png`,
    bottom: `${TEX}/coal_ore.png`,
  },
  [BlockType.tree]: {
    top: `${TEX}/oak_log_top.png`,
    side: `${TEX}/oak_log.png`,
    bottom: `${TEX}/oak_log_top.png`,
  },
  [BlockType.leaf]: {
    top: `${TEX}/oak_leaves.png`,
    side: `${TEX}/oak_leaves.png`,
    bottom: `${TEX}/oak_leaves.png`,
  },
  [BlockType.wood]: {
    top: `${TEX}/oak_planks.png`,
    side: `${TEX}/oak_planks.png`,
    bottom: `${TEX}/oak_planks.png`,
  },
  [BlockType.diamond]: {
    top: `${TEX}/diamond_block.png`,
    side: `${TEX}/diamond_block.png`,
    bottom: `${TEX}/diamond_block.png`,
  },
  [BlockType.quartz]: {
    top: `${TEX}/quartz_block_side.png`,
    side: `${TEX}/quartz_block_side.png`,
    bottom: `${TEX}/quartz_block_side.png`,
  },
  [BlockType.glass]: {
    top: `${TEX}/glass.png`,
    side: `${TEX}/glass.png`,
    bottom: `${TEX}/glass.png`,
  },
  [BlockType.bedrock]: {
    top: `${TEX}/bedrock.png`,
    side: `${TEX}/bedrock.png`,
    bottom: `${TEX}/bedrock.png`,
  },
  [BlockType.cobblestone]: {
    top: `${TEX}/cobblestone.png`,
    side: `${TEX}/cobblestone.png`,
    bottom: `${TEX}/cobblestone.png`,
  },
  [BlockType.gravel]: {
    top: `${TEX}/gravel.png`,
    side: `${TEX}/gravel.png`,
    bottom: `${TEX}/gravel.png`,
  },
  [BlockType.birch_tree]: {
    top: `${TEX}/birch_log.png`,
    side: `${TEX}/birch_log.png`,
    bottom: `${TEX}/birch_log.png`,
  },
  [BlockType.birch_leaf]: {
    top: `${TEX}/birch_leaves.png`,
    side: `${TEX}/birch_leaves.png`,
    bottom: `${TEX}/birch_leaves.png`,
  },
  [BlockType.spruce_tree]: {
    top: `${TEX}/spruce_log.png`,
    side: `${TEX}/spruce_log.png`,
    bottom: `${TEX}/spruce_log.png`,
  },
  [BlockType.spruce_leaf]: {
    top: `${TEX}/spruce_leaves.png`,
    side: `${TEX}/spruce_leaves.png`,
    bottom: `${TEX}/spruce_leaves.png`,
  },
  [BlockType.snow]: {
    top: `${TEX}/snow.png`,
    side: `${TEX}/snow.png`,
    bottom: `${TEX}/snow.png`,
  },
  [BlockType.stone_dark]: {
    top: `${TEX}/stone_dark.png`,
    side: `${TEX}/stone_dark.png`,
    bottom: `${TEX}/stone_dark.png`,
  },
  [BlockType.sand_dark]: {
    top: `${TEX}/sand_dark.png`,
    side: `${TEX}/sand_dark.png`,
    bottom: `${TEX}/sand_dark.png`,
  },
  [BlockType.dirt_with_snow]: {
    top: `${TEX}/dirt_with_snow.png`,
    side: `${TEX}/dirt_with_snow.png`,
    bottom: `${TEX}/dirt.png`,
  },
  [BlockType.dirt_with_grass]: {
    top: `${TEX}/dirt_with_grass_top.png`,
    side: `${TEX}/dirt_with_grass_top.png`,
    bottom: `${TEX}/dirt.png`,
  },
  [BlockType.sand_with_grass]: {
    top: `${TEX}/sand_with_grass.png`,
    side: `${TEX}/sand_with_grass.png`,
    bottom: `${TEX}/sand.png`,
  },
  [BlockType.grass_with_snow]: {
    top: `${TEX}/grass_with_snow.png`,
    side: `${TEX}/grass_with_snow.png`,
    bottom: `${TEX}/dirt.png`,
  },
  [BlockType.gravel_with_grass]: {
    top: `${TEX}/gravel_with_grass.png`,
    side: `${TEX}/gravel_with_grass.png`,
    bottom: `${TEX}/gravel.png`,
  },
}

// ---------------------------------------------------------------------------
// InstancedMesh 할당 비율 (블록 타입별)
// ---------------------------------------------------------------------------
export const BLOCK_ALLOC_FACTORS: Record<BlockType, number> = {
  [BlockType.AIR]: 0,
  [BlockType.grass]: 1,
  [BlockType.sand]: 0.2,
  [BlockType.tree]: 0.1,
  [BlockType.leaf]: 0.7,
  [BlockType.dirt]: 0.1,
  [BlockType.stone]: 0.2,
  [BlockType.coal]: 0.1,
  [BlockType.wood]: 0.1,
  [BlockType.diamond]: 0.1,
  [BlockType.quartz]: 0.1,
  [BlockType.glass]: 0.1,
  [BlockType.bedrock]: 0.1,
  [BlockType.cobblestone]: 0.15,
  [BlockType.gravel]: 0.1,
  [BlockType.birch_tree]: 0.05,
  [BlockType.birch_leaf]: 0.3,
  [BlockType.spruce_tree]: 0.05,
  [BlockType.spruce_leaf]: 0.3,
  [BlockType.snow]: 0.5,
  [BlockType.stone_dark]: 0.3,
  [BlockType.sand_dark]: 0.2,
  [BlockType.dirt_with_snow]: 0.15,
  [BlockType.dirt_with_grass]: 0.15,
  [BlockType.sand_with_grass]: 0.1,
  [BlockType.grass_with_snow]: 0.1,
  [BlockType.gravel_with_grass]: 0.1,
}

// ---------------------------------------------------------------------------
// 커스텀 블록 (사용자가 배치/제거한 블록)
// ---------------------------------------------------------------------------
export interface CustomBlock {
  x: number
  y: number
  z: number
  type: BlockType
  placed: boolean // true=배치, false=제거
}

// ---------------------------------------------------------------------------
// 월드 데이터 (저장/로드용)
// ---------------------------------------------------------------------------
export interface MCWorldData {
  seed: number
  customBlocks: CustomBlock[]
  cameraPosition: [number, number, number]
  cameraRotation: [number, number]
}

// ---------------------------------------------------------------------------
// 유틸리티
// ---------------------------------------------------------------------------

/**
 * 블록 위치 키 생성 (숫자 키 — GC 부담 제거)
 * x,z: -2048~2047 범위, y: 0~255 범위 안전
 * 인코딩: (x+2048) + y*4096 + (z+2048)*4096*256
 */
export function blockKey(x: number, y: number, z: number): number {
  return (x + 2048) + (y << 12) + ((z + 2048) << 20)
}

/** BlockType이 실체(AIR 아닌)인지 확인 */
export function isSolidBlock(type: BlockType): boolean {
  if (type === BlockType.AIR) return false
  return BLOCK_PROPERTIES[type].isSolid
}

/** BlockType이 투명인지 확인 */
export function isTransparentBlock(type: BlockType): boolean {
  if (type === BlockType.AIR) return true
  return BLOCK_PROPERTIES[type].isTransparent
}
