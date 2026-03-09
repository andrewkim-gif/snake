// Minecraft 터레인 생성 Web Worker
// 청크 단위로 블록 위치를 계산하여 메인 스레드에 전달
// Uint8Array 기반 밀집 배열 + BlockInstance[] 호환 출력

// ---------------------------------------------------------------------------
// Worker에서 mc-noise.ts / mc-types.ts를 import할 수 없는 환경을 위해
// 핵심 상수와 노이즈 로직을 인라인 포함 (안전한 폴백)
// Next.js module worker는 import를 지원하므로 우선 import 시도
// ---------------------------------------------------------------------------

import { MCNoise } from './mc-noise'
import {
  BlockType,
  MC_BASE_Y,
  MC_TREE_HEIGHT,
  CHUNK_SIZE,
  WORLD_HEIGHT,
  blockKey,
  isSolidBlock,
  type CustomBlock,
} from './mc-types'

// ---------------------------------------------------------------------------
// 공유 타입 (메인 스레드에서도 import)
// ---------------------------------------------------------------------------

export interface ArenaWorkerMode {
  centerX: number
  centerZ: number
  radius: number
  flattenVariance: number
}

export interface TerrainWorkerInput {
  chunkX: number
  chunkZ: number
  chunkSize: number
  distance: number
  seed: number
  customBlocks: CustomBlock[]
  arenaMode?: ArenaWorkerMode
}

export interface BlockInstance {
  x: number
  y: number
  z: number
  type: BlockType
}

export interface TerrainWorkerOutput {
  blocks: BlockInstance[]
  idMap: Record<string, number> // "x_y_z" -> block index
  chunkX: number
  chunkZ: number
  /** 밀집 Uint8Array: 각 청크의 CHUNK_SIZE x WORLD_HEIGHT x CHUNK_SIZE 블록 데이터
   *  인덱스: (lx * WORLD_HEIGHT * CHUNK_SIZE) + (y * CHUNK_SIZE) + lz
   *  값: BlockType (AIR = 255 since -1 wraps to 255 in Uint8)
   */
  chunkData?: Uint8Array
  /** 면 제거를 위한 가시 블록만 포함 (인접 블록에 의해 가려지지 않은 블록) */
  visibleBlocks?: BlockInstance[]
}

// ---------------------------------------------------------------------------
// 유틸리티: 밀집 배열 인덱스 계산
// ---------------------------------------------------------------------------
const AIR_BYTE = 255 // Uint8Array에서 AIR(-1) 표현

// 투명 블록 타입 (face culling에서 불투명 차단자로 취급하지 않음)
const TRANSPARENT_TYPES = new Set<number>([
  BlockType.leaf,   // 3
  BlockType.glass,  // 10
])

/** 불투명(opaque) 블록인지 확인 — AIR와 투명 블록은 false */
function isOpaque(byteVal: number): boolean {
  if (byteVal === AIR_BYTE) return false
  return !TRANSPARENT_TYPES.has(byteVal)
}

function denseIndex(lx: number, y: number, lz: number): number {
  return (lx * WORLD_HEIGHT * CHUNK_SIZE) + (y * CHUNK_SIZE) + lz
}

/** 밀집 배열에서 블록 타입 조회 */
function getBlockInDense(dense: Uint8Array, lx: number, y: number, lz: number): BlockType {
  if (lx < 0 || lx >= CHUNK_SIZE || y < 0 || y >= WORLD_HEIGHT || lz < 0 || lz >= CHUNK_SIZE) {
    return BlockType.AIR
  }
  const val = dense[denseIndex(lx, y, lz)]
  return val === AIR_BYTE ? BlockType.AIR : (val as BlockType)
}

/** 인접 6면 모두 불투명 블록이면 가려짐 → 렌더 불필요 */
function isOccluded(dense: Uint8Array, lx: number, y: number, lz: number): boolean {
  // 청크 경계의 블록은 항상 가시 (인접 청크 데이터 없음)
  if (lx <= 0 || lx >= CHUNK_SIZE - 1 || lz <= 0 || lz >= CHUNK_SIZE - 1) return false
  if (y <= 0 || y >= WORLD_HEIGHT - 1) return false

  const top = getBlockInDense(dense, lx, y + 1, lz)
  const bottom = getBlockInDense(dense, lx, y - 1, lz)
  const north = getBlockInDense(dense, lx, y, lz - 1)
  const south = getBlockInDense(dense, lx, y, lz + 1)
  const east = getBlockInDense(dense, lx + 1, y, lz)
  const west = getBlockInDense(dense, lx - 1, y, lz)

  return (
    isSolidBlock(top) &&
    isSolidBlock(bottom) &&
    isSolidBlock(north) &&
    isSolidBlock(south) &&
    isSolidBlock(east) &&
    isSolidBlock(west)
  )
}

// ---------------------------------------------------------------------------
// Worker 메시지 핸들러
// ---------------------------------------------------------------------------
self.onmessage = (e: MessageEvent<TerrainWorkerInput>) => {
  const { chunkX, chunkZ, chunkSize, distance, seed, customBlocks, arenaMode } = e.data
  const noise = new MCNoise(seed)
  const blocks: BlockInstance[] = []
  const idMap: Record<string, number> = {}

  // 제거된 블록 셋
  const removedSet = new Set<string>()
  const placedBlocks: BlockInstance[] = []

  for (const cb of customBlocks) {
    if (!cb.placed) {
      removedSet.add(blockKey(cb.x, cb.y, cb.z))
    } else {
      placedBlocks.push({ x: cb.x, y: cb.y, z: cb.z, type: cb.type })
    }
  }

  // 아레나 모드: 반경 내 영역만 생성. 일반 모드: 카메라 청크 기반
  let startX: number, endX: number, startZ: number, endZ: number
  if (arenaMode) {
    startX = arenaMode.centerX - arenaMode.radius
    endX = arenaMode.centerX + arenaMode.radius
    startZ = arenaMode.centerZ - arenaMode.radius
    endZ = arenaMode.centerZ + arenaMode.radius
  } else {
    startX = -chunkSize * distance + chunkSize * chunkX
    endX = chunkSize * distance + chunkSize + chunkSize * chunkX
    startZ = -chunkSize * distance + chunkSize * chunkZ
    endZ = chunkSize * distance + chunkSize + chunkSize * chunkZ
  }

  // 밀집 배열 (면 제거 최적화용) — 일반 모드에서만 생성
  // 아레나 모드는 범위가 가변적이라 기존 방식 유지
  const useDense = !arenaMode
  let dense: Uint8Array | undefined
  if (useDense) {
    // 전체 렌더 범위를 하나의 큰 밀집 배열로 관리
    // 범위: startX~endX, 0~WORLD_HEIGHT, startZ~endZ
    dense = new Uint8Array(
      (endX - startX) * WORLD_HEIGHT * (endZ - startZ)
    ).fill(AIR_BYTE)
  }

  // 밀집 배열 인덱스 (렌더 범위 기준)
  const denseRangeIndex = (wx: number, wy: number, wz: number): number => {
    const rx = wx - startX
    const rz = wz - startZ
    const rangeZ = endZ - startZ
    return (rx * WORLD_HEIGHT * rangeZ) + (wy * rangeZ) + rz
  }

  for (let x = startX; x < endX; x++) {
    for (let z = startZ; z < endZ; z++) {
      // 아레나 모드: 원형 경계 밖 블록 스킵
      if (arenaMode) {
        const dx = x - arenaMode.centerX
        const dz = z - arenaMode.centerZ
        if (dx * dx + dz * dz > arenaMode.radius * arenaMode.radius) continue
      }

      let yOffset = noise.getSurfaceOffset(x, z)

      // 아레나 모드: 높이 편차를 +/-flattenVariance로 클램프
      if (arenaMode) {
        yOffset = Math.max(-arenaMode.flattenVariance, Math.min(arenaMode.flattenVariance, yOffset))
      }

      const y = MC_BASE_Y + yOffset

      const key = blockKey(x, y, z)
      if (removedSet.has(key)) continue

      const stoneOffset = noise.getStoneOffset(x, z)
      const coalOffset = noise.getCoalOffset(x, z)

      let type: BlockType
      if (stoneOffset > noise.stoneThreshold && coalOffset > noise.coalThreshold) {
        type = BlockType.coal
      } else if (stoneOffset > noise.stoneThreshold) {
        type = BlockType.stone
      } else if (yOffset < -3) {
        type = BlockType.sand
      } else {
        type = BlockType.grass
      }

      const idx = blocks.length
      blocks.push({ x, y, z, type })
      idMap[key] = idx

      // 밀집 배열 기록
      if (dense && y >= 0 && y < WORLD_HEIGHT) {
        dense[denseRangeIndex(x, y, z)] = type
      }

      // 나무 생성
      const treeOffset = noise.getTreeOffset(x, z)
      if (
        treeOffset > noise.treeThreshold &&
        yOffset >= -3 &&
        stoneOffset <= noise.stoneThreshold
      ) {
        // 줄기
        for (let ty = 1; ty <= MC_TREE_HEIGHT; ty++) {
          const tKey = blockKey(x, y + ty, z)
          if (removedSet.has(tKey)) continue
          const tIdx = blocks.length
          blocks.push({ x, y: y + ty, z, type: BlockType.tree })
          idMap[tKey] = tIdx
          if (dense && y + ty >= 0 && y + ty < WORLD_HEIGHT) {
            dense[denseRangeIndex(x, y + ty, z)] = BlockType.tree
          }
        }

        // 잎 (나무 꼭대기 주변 6x6x6)
        const leafBase = y + MC_TREE_HEIGHT - 3
        for (let lx = x - 3; lx <= x + 3; lx++) {
          for (let ly = leafBase; ly <= leafBase + 6; ly++) {
            for (let lz = z - 3; lz <= z + 3; lz++) {
              // 줄기 중심 기둥 제외
              if (lx === x && lz === z && ly <= y + MC_TREE_HEIGHT) continue

              const leafOffset = noise.getLeafOffset(lx, ly, lz)
              if (leafOffset > noise.leafThreshold) {
                const lKey = blockKey(lx, ly, lz)
                if (removedSet.has(lKey) || idMap[lKey] !== undefined) continue
                const lIdx = blocks.length
                blocks.push({ x: lx, y: ly, z: lz, type: BlockType.leaf })
                idMap[lKey] = lIdx
                if (dense && ly >= 0 && ly < WORLD_HEIGHT && lx >= startX && lx < endX && lz >= startZ && lz < endZ) {
                  dense[denseRangeIndex(lx, ly, lz)] = BlockType.leaf
                }
              }
            }
          }
        }
      }
    }
  }

  // 커스텀 배치 블록 추가
  for (const pb of placedBlocks) {
    if (pb.x >= startX && pb.x < endX && pb.z >= startZ && pb.z < endZ) {
      const pKey = blockKey(pb.x, pb.y, pb.z)
      if (idMap[pKey] === undefined) {
        const pIdx = blocks.length
        blocks.push(pb)
        idMap[pKey] = pIdx
        if (dense && pb.y >= 0 && pb.y < WORLD_HEIGHT) {
          dense[denseRangeIndex(pb.x, pb.y, pb.z)] = pb.type
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 면 제거 최적화: 가시 블록만 필터
  // 6면 모두 불투명 블록에 둘러싸인 블록은 렌더 불필요
  // ---------------------------------------------------------------------------
  let visibleBlocks: BlockInstance[] | undefined
  if (dense) {
    const rangeX = endX - startX
    const rangeZ = endZ - startZ
    visibleBlocks = []

    for (const block of blocks) {
      const rx = block.x - startX
      const rz = block.z - startZ
      const wy = block.y

      // 경계 블록은 항상 가시
      if (rx <= 0 || rx >= rangeX - 1 || rz <= 0 || rz >= rangeZ - 1 || wy <= 0 || wy >= WORLD_HEIGHT - 1) {
        visibleBlocks.push(block)
        continue
      }

      // 6면 인접 체크
      const top = dense[denseRangeIndex(block.x, wy + 1, block.z)]
      const bottom = dense[denseRangeIndex(block.x, wy - 1, block.z)]
      const north = dense[denseRangeIndex(block.x, wy, block.z - 1)]
      const south = dense[denseRangeIndex(block.x, wy, block.z + 1)]
      const east = dense[denseRangeIndex(block.x + 1, wy, block.z)]
      const west = dense[denseRangeIndex(block.x - 1, wy, block.z)]

      const topSolid = isOpaque(top)
      const bottomSolid = isOpaque(bottom)
      const northSolid = isOpaque(north)
      const southSolid = isOpaque(south)
      const eastSolid = isOpaque(east)
      const westSolid = isOpaque(west)

      // 6면 모두 불투명이면 숨김
      if (topSolid && bottomSolid && northSolid && southSolid && eastSolid && westSolid) {
        continue
      }

      visibleBlocks.push(block)
    }
  }

  const output: TerrainWorkerOutput = {
    blocks,
    idMap,
    chunkX,
    chunkZ,
    visibleBlocks,
  }

  self.postMessage(output)
}
