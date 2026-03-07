// Minecraft 블록 타입 및 상수 정의

export enum BlockType {
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
}

export const BLOCK_NAMES: Record<BlockType, string> = {
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
}

// 블록 아이콘 파일명 매핑
export const BLOCK_ICONS: Partial<Record<BlockType, string>> = {
  [BlockType.grass]: 'grass',
  [BlockType.stone]: 'stone',
  [BlockType.tree]: 'tree',
  [BlockType.wood]: 'wood',
  [BlockType.diamond]: 'diamond',
  [BlockType.quartz]: 'quartz',
  [BlockType.glass]: 'glass',
}

// 핫바 기본 블록 순서
export const HOTBAR_BLOCKS: BlockType[] = [
  BlockType.grass,
  BlockType.dirt,
  BlockType.stone,
  BlockType.wood,
  BlockType.glass,
  BlockType.sand,
  BlockType.diamond,
  BlockType.quartz,
  BlockType.coal,
  BlockType.leaf,
]

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

// 터레인 상수
export const MC_CHUNK_SIZE = 24
export const MC_RENDER_DISTANCE = 3
export const MC_BASE_Y = 30
export const MC_TREE_HEIGHT = 10
export const MC_CLOUD_HEIGHT = 80

// 플레이어 물리 상수
export const PLAYER_HEIGHT = 1.8
export const PLAYER_WIDTH = 0.5
export const GRAVITY = 25
export const JUMP_VELOCITY = 8
export const MAX_FALL_VELOCITY = 38.4
export const INTERACTION_RANGE = 8

// InstancedMesh 할당 비율 (블록 타입별)
export const BLOCK_ALLOC_FACTORS: Record<BlockType, number> = {
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
}

// 커스텀 블록 (사용자가 배치/제거한 블록)
export interface CustomBlock {
  x: number
  y: number
  z: number
  type: BlockType
  placed: boolean // true=배치, false=제거
}

// 월드 데이터 (저장/로드용)
export interface MCWorldData {
  seed: number
  customBlocks: CustomBlock[]
  cameraPosition: [number, number, number]
  cameraRotation: [number, number]
}

// 블록 위치 키 생성
export function blockKey(x: number, y: number, z: number): string {
  return `${x}_${y}_${z}`
}
