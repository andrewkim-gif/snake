// Minecraft 터레인 노이즈 생성기
// three.js ImprovedNoise 기반 Perlin 노이즈

// ImprovedNoise 포팅 (three/examples/jsm/math/ImprovedNoise)
// 결정적 시드 기반 — 동일 시드 = 동일 터레인 (모든 클라이언트에서 일관)

import {
  BlockType,
  MC_BASE_Y,
  MC_TREE_HEIGHT,
  CHUNK_SIZE,
  blockKey,
} from './mc-types'

// ---------------------------------------------------------------------------
// Biome 타입
// ---------------------------------------------------------------------------
export enum Biome {
  PLAINS = 'plains',
  DESERT = 'desert',
  FOREST = 'forest',
}

// ---------------------------------------------------------------------------
// 결정적 PRNG (Mulberry32)
// ---------------------------------------------------------------------------
/** 시드 기반 결정적 PRNG (Mulberry32) */
function mulberry32(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6D2B79F5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---------------------------------------------------------------------------
// ImprovedNoise — 3D Perlin 노이즈
// ---------------------------------------------------------------------------
class ImprovedNoise {
  private p: number[]

  constructor(seed = 0) {
    const rng = mulberry32(seed)
    const p = []
    for (let i = 0; i < 256; i++) p[i] = i

    // Shuffle using Fisher-Yates with deterministic RNG
    for (let i = 255; i > 0; i--) {
      const j = Math.floor((i + 1) * rng())
      ;[p[i], p[j]] = [p[j], p[i]]
    }

    // Duplicate for overflow
    this.p = new Array(512)
    for (let i = 0; i < 512; i++) this.p[i] = p[i & 255]
  }

  noise(x: number, y: number, z: number): number {
    const p = this.p
    const floorX = Math.floor(x)
    const floorY = Math.floor(y)
    const floorZ = Math.floor(z)
    const X = floorX & 255
    const Y = floorY & 255
    const Z = floorZ & 255

    x -= floorX
    y -= floorY
    z -= floorZ

    const u = fade(x)
    const v = fade(y)
    const w = fade(z)

    const A = p[X] + Y
    const AA = p[A] + Z
    const AB = p[A + 1] + Z
    const B = p[X + 1] + Y
    const BA = p[B] + Z
    const BB = p[B + 1] + Z

    return lerp(
      w,
      lerp(
        v,
        lerp(u, grad(p[AA], x, y, z), grad(p[BA], x - 1, y, z)),
        lerp(u, grad(p[AB], x, y - 1, z), grad(p[BB], x - 1, y - 1, z))
      ),
      lerp(
        v,
        lerp(u, grad(p[AA + 1], x, y, z - 1), grad(p[BA + 1], x - 1, y, z - 1)),
        lerp(u, grad(p[AB + 1], x, y - 1, z - 1), grad(p[BB + 1], x - 1, y - 1, z - 1))
      )
    )
  }
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10)
}

function lerp(t: number, a: number, b: number): number {
  return a + t * (b - a)
}

function grad(hash: number, x: number, y: number, z: number): number {
  const h = hash & 15
  const u = h < 8 ? x : y
  const v = h < 4 ? y : h === 12 || h === 14 ? x : z
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v)
}

// ---------------------------------------------------------------------------
// 청크 블록 데이터 인터페이스
// ---------------------------------------------------------------------------
export interface ChunkBlockData {
  x: number
  y: number
  z: number
  type: BlockType
}

// ---------------------------------------------------------------------------
// MCNoise — 터레인 노이즈 + 바이옴 + 청크 생성
// ---------------------------------------------------------------------------
export class MCNoise {
  private noise: ImprovedNoise
  seed: number

  // 지표면 파라미터
  gap = 22
  amp = 8

  // 돌 파라미터
  stoneSeed: number
  stoneGap = 12
  stoneAmp = 8
  stoneThreshold = 3.5

  // 석탄 파라미터
  coalSeed: number
  coalGap = 3
  coalAmp = 8
  coalThreshold = 3

  // 다이아몬드 파라미터
  diamondSeed: number
  diamondGap = 4
  diamondAmp = 10
  diamondThreshold = 4.5

  // 나무 파라미터
  treeSeed: number
  treeGap = 2
  treeAmp = 6
  treeHeight = MC_TREE_HEIGHT
  treeThreshold = 4

  // 잎 파라미터
  leafSeed: number
  leafGap = 2
  leafAmp = 5
  leafThreshold = -0.03

  // 바이옴 파라미터
  biomeSeed: number
  biomeGap = 60
  biomeAmp = 3

  constructor(seed?: number) {
    this.seed = seed ?? Math.floor(Math.random() * 100000)
    this.noise = new ImprovedNoise(this.seed)
    this.stoneSeed = this.seed * 0.4
    this.coalSeed = this.seed * 0.5
    this.diamondSeed = this.seed * 0.6
    this.treeSeed = this.seed * 0.7
    this.leafSeed = this.seed * 0.8
    this.biomeSeed = this.seed * 0.3
  }

  get(x: number, y: number, z: number): number {
    return this.noise.noise(x, y, z)
  }

  // ---------------------------------------------------------------------------
  // getHeight(x, z) — 높이맵 생성 (octave 기반)
  // ---------------------------------------------------------------------------
  getHeight(x: number, z: number): number {
    const octaves = 4
    const persistence = 0.5
    const lacunarity = 2.0

    let total = 0
    let amplitude = 1
    let frequency = 1 / this.gap
    let maxAmplitude = 0

    for (let i = 0; i < octaves; i++) {
      total += this.get(x * frequency, z * frequency, this.seed) * amplitude
      maxAmplitude += amplitude
      amplitude *= persistence
      frequency *= lacunarity
    }

    // 정규화 후 amp로 스케일
    return MC_BASE_Y + Math.floor((total / maxAmplitude) * this.amp)
  }

  // ---------------------------------------------------------------------------
  // getBiome(x, z) — 바이옴 판단
  // ---------------------------------------------------------------------------
  getBiome(x: number, z: number): Biome {
    const val = this.get(x / this.biomeGap, z / this.biomeGap, this.biomeSeed) * this.biomeAmp

    if (val < -0.8) return Biome.DESERT
    if (val > 0.8) return Biome.FOREST
    return Biome.PLAINS
  }

  // ---------------------------------------------------------------------------
  // generateChunkBlocks(chunkX, chunkZ) — 청크의 블록 배열 생성
  // ---------------------------------------------------------------------------
  generateChunkBlocks(chunkX: number, chunkZ: number): ChunkBlockData[] {
    const blocks: ChunkBlockData[] = []
    const idMap = new Map<string, number>()

    const startX = chunkX * CHUNK_SIZE
    const startZ = chunkZ * CHUNK_SIZE

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const x = startX + lx
        const z = startZ + lz

        const surfaceY = this.getHeight(x, z)
        const biome = this.getBiome(x, z)

        // --- 바닥: bedrock (y=0) ---
        {
          const key = blockKey(x, 0, z)
          idMap.set(key, blocks.length)
          blocks.push({ x, y: 0, z, type: BlockType.bedrock })
        }

        // --- 지하 레이어 (y=1 ~ surfaceY-1) ---
        for (let y = 1; y < surfaceY; y++) {
          const key = blockKey(x, y, z)
          if (idMap.has(key)) continue

          let type: BlockType

          // 광석 확률 체크
          const stoneOffset = this.getStoneOffset(x, z)
          const coalOffset = this.getCoalOffset(x, z)
          const diamondVal = this.get(x / this.diamondGap, y / this.diamondGap, this.diamondSeed) * this.diamondAmp

          if (y < 16 && diamondVal > this.diamondThreshold) {
            type = BlockType.diamond
          } else if (stoneOffset > this.stoneThreshold && coalOffset > this.coalThreshold) {
            type = BlockType.coal
          } else {
            type = BlockType.stone
          }

          idMap.set(key, blocks.length)
          blocks.push({ x, y, z, type })
        }

        // --- 지표면 ---
        {
          const key = blockKey(x, surfaceY, z)
          if (!idMap.has(key)) {
            let surfaceType: BlockType
            switch (biome) {
              case Biome.DESERT:
                surfaceType = BlockType.sand
                break
              case Biome.FOREST:
              case Biome.PLAINS:
              default:
                surfaceType = BlockType.grass
                break
            }
            idMap.set(key, blocks.length)
            blocks.push({ x, y: surfaceY, z, type: surfaceType })
          }
        }

        // --- 나무 (forest biome에서 확률적 생성) ---
        if (biome === Biome.FOREST || biome === Biome.PLAINS) {
          const treeOffset = this.getTreeOffset(x, z)
          const stoneOffset = this.getStoneOffset(x, z)
          const surfaceOffset = this.getSurfaceOffset(x, z)

          if (
            treeOffset > this.treeThreshold &&
            surfaceOffset >= -3 &&
            stoneOffset <= this.stoneThreshold
          ) {
            // 줄기
            for (let ty = 1; ty <= this.treeHeight; ty++) {
              const treeY = surfaceY + ty
              const tKey = blockKey(x, treeY, z)
              if (idMap.has(tKey)) continue
              idMap.set(tKey, blocks.length)
              blocks.push({ x, y: treeY, z, type: BlockType.tree })
            }

            // 잎 (나무 꼭대기 주변)
            const leafBase = surfaceY + this.treeHeight - 3
            for (let li = -3; li <= 3; li++) {
              for (let lj = 0; lj <= 6; lj++) {
                for (let lk = -3; lk <= 3; lk++) {
                  if (li === 0 && lk === 0 && lj <= this.treeHeight) continue

                  const lx = x + li
                  const ly = leafBase + lj
                  const lz = z + lk

                  const leafOffset = this.getLeafOffset(lx, ly, lz)
                  if (leafOffset > this.leafThreshold) {
                    const lKey = blockKey(lx, ly, lz)
                    if (idMap.has(lKey)) continue
                    idMap.set(lKey, blocks.length)
                    blocks.push({ x: lx, y: ly, z: lz, type: BlockType.leaf })
                  }
                }
              }
            }
          }
        }
      }
    }

    return blocks
  }

  // ---------------------------------------------------------------------------
  // 하위 호환 헬퍼 (기존 terrain worker가 사용)
  // ---------------------------------------------------------------------------

  /** 지표면 높이 오프셋 (-amp ~ +amp) */
  getSurfaceOffset(x: number, z: number): number {
    return Math.floor(this.get(x / this.gap, z / this.gap, this.seed) * this.amp)
  }

  /** 돌 오프셋 */
  getStoneOffset(x: number, z: number): number {
    return this.get(x / this.stoneGap, z / this.stoneGap, this.stoneSeed) * this.stoneAmp
  }

  /** 석탄 오프셋 */
  getCoalOffset(x: number, z: number): number {
    return this.get(x / this.coalGap, z / this.coalGap, this.coalSeed) * this.coalAmp
  }

  /** 나무 오프셋 */
  getTreeOffset(x: number, z: number): number {
    return this.get(x / this.treeGap, z / this.treeGap, this.treeSeed) * this.treeAmp
  }

  /** 잎 오프셋 */
  getLeafOffset(x: number, y: number, z: number): number {
    return this.get(x / this.leafGap, y / this.leafGap, z / this.leafGap + this.leafSeed) * this.leafAmp
  }
}
