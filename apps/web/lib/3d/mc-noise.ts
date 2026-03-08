// Minecraft 터레인 노이즈 생성기
// three.js ImprovedNoise 기반 Perlin 노이즈

// ImprovedNoise 포팅 (three/examples/jsm/math/ImprovedNoise)
// 결정적 시드 기반 — 동일 시드 = 동일 터레인 (모든 클라이언트에서 일관)

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

  // 나무 파라미터
  treeSeed: number
  treeGap = 2
  treeAmp = 6
  treeHeight = 10
  treeThreshold = 4

  // 잎 파라미터
  leafSeed: number
  leafGap = 2
  leafAmp = 5
  leafThreshold = -0.03

  constructor(seed?: number) {
    this.seed = seed ?? Math.floor(Math.random() * 100000)
    this.noise = new ImprovedNoise(this.seed)
    this.stoneSeed = this.seed * 0.4
    this.coalSeed = this.seed * 0.5
    this.treeSeed = this.seed * 0.7
    this.leafSeed = this.seed * 0.8
  }

  get(x: number, y: number, z: number): number {
    return this.noise.noise(x, y, z)
  }

  // 지표면 높이 오프셋 (-amp ~ +amp)
  getSurfaceOffset(x: number, z: number): number {
    return Math.floor(this.get(x / this.gap, z / this.gap, this.seed) * this.amp)
  }

  // 돌 오프셋
  getStoneOffset(x: number, z: number): number {
    return this.get(x / this.stoneGap, z / this.stoneGap, this.stoneSeed) * this.stoneAmp
  }

  // 석탄 오프셋
  getCoalOffset(x: number, z: number): number {
    return this.get(x / this.coalGap, z / this.coalGap, this.coalSeed) * this.coalAmp
  }

  // 나무 오프셋
  getTreeOffset(x: number, z: number): number {
    return this.get(x / this.treeGap, z / this.treeGap, this.treeSeed) * this.treeAmp
  }

  // 잎 오프셋
  getLeafOffset(x: number, y: number, z: number): number {
    return this.get(x / this.leafGap, y / this.leafGap, z / this.leafGap + this.leafSeed) * this.leafAmp
  }
}
