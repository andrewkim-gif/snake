// Minecraft 터레인 생성 Web Worker
// 청크 단위로 블록 위치를 계산하여 메인 스레드에 전달

import { MCNoise } from './mc-noise'
import {
  BlockType,
  MC_BASE_Y,
  MC_TREE_HEIGHT,
  blockKey,
  type CustomBlock,
} from './mc-types'

export interface TerrainWorkerInput {
  chunkX: number
  chunkZ: number
  chunkSize: number
  distance: number
  seed: number
  customBlocks: CustomBlock[]
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
}

// Worker 메시지 핸들러
self.onmessage = (e: MessageEvent<TerrainWorkerInput>) => {
  const { chunkX, chunkZ, chunkSize, distance, seed, customBlocks } = e.data
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

  const startX = -chunkSize * distance + chunkSize * chunkX
  const endX = chunkSize * distance + chunkSize + chunkSize * chunkX
  const startZ = -chunkSize * distance + chunkSize * chunkZ
  const endZ = chunkSize * distance + chunkSize + chunkSize * chunkZ

  for (let x = startX; x < endX; x++) {
    for (let z = startZ; z < endZ; z++) {
      const yOffset = noise.getSurfaceOffset(x, z)
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
      }
    }
  }

  const output: TerrainWorkerOutput = { blocks, idMap, chunkX, chunkZ }
  self.postMessage(output)
}
