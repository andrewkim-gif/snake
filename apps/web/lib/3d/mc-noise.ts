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
  TUNDRA = 'tundra',
  MOUNTAINS = 'mountains',
  SWAMP = 'swamp',
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

  // 전투 구역 평탄화 + 원경 산맥 (거리 기반 amp 변조)
  // 아레나 중심 좌표 (플레이어 스폰 위치)
  arenaCenter = { x: 0, z: 0 }
  // 거리 구간별 amp: 0~flatRadius=±flatAmp, outerStart+=산봉우리
  // RENDER_DISTANCE=5 × CHUNK_SIZE=16 = 80블록 가시 범위
  flatRadius = 30       // 전투 구역 반경 (블록)
  flatAmp = 1           // 전투 구역 최대 편차 (±1블록)
  hillStart = 30        // 언덕 시작 거리
  hillEnd = 50          // 산 시작 거리
  hillAmp = 6           // 언덕 amp
  mountainStart = 50    // 산봉우리 시작
  mountainEnd = 75      // 최대 amp 도달 거리 (가시 범위 80 이내)
  mountainAmp = 25      // 산봉우리 최대 amp

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

  // v47: moisture 축 (2축 바이옴)
  moistureSeed: number

  constructor(seed?: number) {
    this.seed = seed ?? Math.floor(Math.random() * 100000)
    this.noise = new ImprovedNoise(this.seed)
    this.stoneSeed = this.seed * 0.4
    this.coalSeed = this.seed * 0.5
    this.diamondSeed = this.seed * 0.6
    this.treeSeed = this.seed * 0.7
    this.leafSeed = this.seed * 0.8
    this.biomeSeed = this.seed * 0.3
    this.moistureSeed = this.seed * 0.9
  }

  get(x: number, y: number, z: number): number {
    return this.noise.noise(x, y, z)
  }

  // ---------------------------------------------------------------------------
  // getDistanceAmp(x, z) — 거리 기반 amplitude 계산
  // 중심 근처: 평탄 (±1), 중간: 언덕 (±6), 외곽: 산봉우리 (±30)
  // ---------------------------------------------------------------------------
  getDistanceAmp(x: number, z: number): number {
    const dx = x - this.arenaCenter.x
    const dz = z - this.arenaCenter.z
    const dist = Math.sqrt(dx * dx + dz * dz)

    if (dist <= this.flatRadius) {
      // 전투 구역: 거의 평탄
      return this.flatAmp
    } else if (dist <= this.hillEnd) {
      // 언덕 전환 구간: smoothstep 보간
      const t = (dist - this.hillStart) / (this.hillEnd - this.hillStart)
      const s = t * t * (3 - 2 * t) // smoothstep
      return this.flatAmp + (this.hillAmp - this.flatAmp) * s
    } else if (dist <= this.mountainEnd) {
      // 산봉우리 구간: smoothstep 보간
      const t = (dist - this.mountainStart) / (this.mountainEnd - this.mountainStart)
      const s = t * t * (3 - 2 * t) // smoothstep
      return this.hillAmp + (this.mountainAmp - this.hillAmp) * s
    } else {
      // 최대 산 높이 유지
      return this.mountainAmp
    }
  }

  // ---------------------------------------------------------------------------
  // isInFlatZone(x, z) — 전투 구역 내 여부 (나무 억제용)
  // ---------------------------------------------------------------------------
  isInFlatZone(x: number, z: number): boolean {
    const dx = x - this.arenaCenter.x
    const dz = z - this.arenaCenter.z
    return (dx * dx + dz * dz) <= this.flatRadius * this.flatRadius
  }

  // ---------------------------------------------------------------------------
  // getHeight(x, z) — 높이맵 생성 (octave 기반 + 거리 기반 amp)
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

    // 거리 기반 amp 적용 (중심=평탄, 외곽=산)
    const distAmp = this.getDistanceAmp(x, z)
    return MC_BASE_Y + Math.floor((total / maxAmplitude) * distAmp)
  }

  // ---------------------------------------------------------------------------
  // getBiome(x, z) — 2축 noise 바이옴 판단 (v47: temperature × moisture → 6종)
  // ---------------------------------------------------------------------------
  getBiome(x: number, z: number): Biome {
    // 전투 구역 강제 PLAINS
    if (this.isInFlatZone(x, z)) return Biome.PLAINS

    const temp = this.get(x / this.biomeGap, z / this.biomeGap, this.biomeSeed) * this.biomeAmp
    const moisture = this.get(x / this.biomeGap, z / this.biomeGap, this.moistureSeed) * this.biomeAmp

    if (temp < -0.5) {
      // 추운 지역
      return moisture > 0.3 ? Biome.TUNDRA : Biome.MOUNTAINS
    } else if (temp > 0.5) {
      // 더운 지역
      return moisture > 0.3 ? Biome.SWAMP : Biome.DESERT
    } else {
      // 온대
      return moisture > 0.5 ? Biome.FOREST : Biome.PLAINS
    }
  }

  // ---------------------------------------------------------------------------
  // generateChunkBlocks(chunkX, chunkZ) — 청크의 블록 배열 생성
  // ---------------------------------------------------------------------------
  generateChunkBlocks(chunkX: number, chunkZ: number): ChunkBlockData[] {
    const blocks: ChunkBlockData[] = []
    const idMap = new Map<number, number>()

    const startX = chunkX * CHUNK_SIZE
    const startZ = chunkZ * CHUNK_SIZE

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const x = startX + lx
        const z = startZ + lz

        const surfaceY = this.getHeight(x, z)
        const biome = this.getBiome(x, z)

        // 광석 오프셋 (x,z만 의존 — Y 루프 밖에서 1회 계산)
        const stoneOffset = this.getStoneOffset(x, z)
        const coalOffset = this.getCoalOffset(x, z)

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

        // --- 지표면 (v47: 바이옴별 surface block) ---
        {
          const key = blockKey(x, surfaceY, z)
          if (!idMap.has(key)) {
            let surfaceType: BlockType
            switch (biome) {
              case Biome.DESERT:
                surfaceType = BlockType.sand
                break
              case Biome.TUNDRA:
                surfaceType = BlockType.snow
                break
              case Biome.MOUNTAINS:
                surfaceType = BlockType.stone
                break
              case Biome.SWAMP:
                surfaceType = BlockType.gravel_with_grass
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

        // --- 지표면 바로 아래 sub-surface (v47: 바이옴별 1~3블록) ---
        {
          let subType: BlockType | null = null
          let subDepth = 3
          switch (biome) {
            case Biome.DESERT:
              subType = BlockType.sand_dark
              subDepth = 2
              break
            case Biome.TUNDRA:
              subType = BlockType.dirt_with_snow
              subDepth = 2
              break
            case Biome.MOUNTAINS:
              subType = BlockType.stone_dark
              subDepth = 3
              break
            case Biome.SWAMP:
              subType = BlockType.gravel
              subDepth = 2
              break
            default:
              break // PLAINS/FOREST: stone으로 유지 (기존)
          }
          if (subType !== null) {
            for (let sy = surfaceY - 1; sy >= Math.max(1, surfaceY - subDepth); sy--) {
              const sk = blockKey(x, sy, z)
              if (idMap.has(sk)) {
                // 기존 stone을 덮어씀
                const existIdx = idMap.get(sk)!
                blocks[existIdx] = { x, y: sy, z, type: subType }
              }
            }
          }
        }

        // --- 나무 (v47: 바이옴별 나무 종류 분기, DESERT/MOUNTAINS 나무 없음) ---
        const hasTreesBiome = biome === Biome.FOREST || biome === Biome.PLAINS ||
          biome === Biome.TUNDRA || biome === Biome.SWAMP
        if (hasTreesBiome && !this.isInFlatZone(x, z)) {
          const treeOffset = this.getTreeOffset(x, z)
          const stoneOffset = this.getStoneOffset(x, z)
          const surfaceOffset = this.getSurfaceOffset(x, z)

          // SWAMP: 나무 밀도 낮음 (threshold 높임)
          const treeThresh = biome === Biome.SWAMP ? this.treeThreshold + 1.0 : this.treeThreshold

          if (
            treeOffset > treeThresh &&
            surfaceOffset >= -3 &&
            stoneOffset <= this.stoneThreshold
          ) {
            const treeHash = ((x * 73856093) ^ (z * 19349663)) >>> 0
            const treeRoll = treeHash % 100

            let trunkType: BlockType
            let leafType: BlockType

            if (biome === Biome.TUNDRA) {
              // TUNDRA: spruce 100%
              trunkType = BlockType.spruce_tree
              leafType = BlockType.spruce_leaf
            } else if (biome === Biome.SWAMP) {
              // SWAMP: oak 100%
              trunkType = BlockType.tree
              leafType = BlockType.leaf
            } else if (biome === Biome.FOREST) {
              // FOREST: oak 60% + birch 40%
              if (treeRoll < 60) {
                trunkType = BlockType.tree
                leafType = BlockType.leaf
              } else {
                trunkType = BlockType.birch_tree
                leafType = BlockType.birch_leaf
              }
            } else {
              // PLAINS: birch 70% + oak 30%
              if (treeRoll < 70) {
                trunkType = BlockType.birch_tree
                leafType = BlockType.birch_leaf
              } else {
                trunkType = BlockType.tree
                leafType = BlockType.leaf
              }
            }

            // 줄기
            for (let ty = 1; ty <= this.treeHeight; ty++) {
              const treeY = surfaceY + ty
              const tKey = blockKey(x, treeY, z)
              if (idMap.has(tKey)) continue
              idMap.set(tKey, blocks.length)
              blocks.push({ x, y: treeY, z, type: trunkType })
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
                    blocks.push({ x: lx, y: ly, z: lz, type: leafType })
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

// ---------------------------------------------------------------------------
// getArenaTerrainHeight — 아레나 지형 높이 쿼리 (캐시된 MCNoise 인스턴스)
// getHeight()가 거리 기반 amp를 내부 처리 (중심=평탄, 외곽=산)
// ---------------------------------------------------------------------------
const _noiseCache = new Map<number, MCNoise>()

/**
 * 아레나 모드에서 (x, z) 좌표의 지형 Y를 반환한다.
 * MCNoise.getHeight()가 거리 기반 amplitude를 자동 적용.
 * O(1) per query, 시드당 MCNoise 인스턴스 캐시.
 */
export function getArenaTerrainHeight(
  x: number,
  z: number,
  seed: number,
  _flattenVariance?: number,
): number {
  let noise = _noiseCache.get(seed)
  if (!noise) {
    noise = new MCNoise(seed)
    _noiseCache.set(seed, noise)
  }
  return noise.getHeight(Math.floor(x), Math.floor(z))
}
