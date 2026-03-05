/**
 * 로비 지형 노이즈 — 마인크래프트 스타일 높이맵
 * LobbyHills + LobbyTerrainObjects에서 공유
 */

export const BLOCK_SIZE = 20
export const TERRAIN_RADIUS = 700
export const CENTER_CLEAR = 200

/** 호수 정의 */
export const LAKES = [
  { cx: 200, cz: -150, radius: 80, depth: 20 },
  { cx: -180, cz: 120, radius: 60, depth: 15 },
]

/** Multi-octave sin 기반 노이즈 */
function noise2D(x: number, z: number): number {
  let n = 0
  n += Math.sin(x * 0.01 + 1.7) * Math.cos(z * 0.008 + 0.3) * 1.0
  n += Math.sin(x * 0.025 + 3.1) * Math.cos(z * 0.03 + 1.8) * 0.4
  n += Math.sin(x * 0.06 + 0.5) * Math.cos(z * 0.05 + 2.4) * 0.15
  return n
}

/**
 * 지형 높이 계산
 * - 중심(0-120): 플랫 (뱀 이동 영역)
 * - 120-300: 완만한 언덕
 * - 300-500: 산악 지대
 * - 500-700: 점진적 하강
 * - 호수 근처: 함몰
 */
export function terrainHeight(x: number, z: number): number {
  const dist = Math.sqrt(x * x + z * z)
  if (dist < CENTER_CLEAR) return 0

  const n = noise2D(x, z)
  const rise = Math.min(1, Math.max(0, (dist - CENTER_CLEAR) / 180))
  const fall = Math.min(1, Math.max(0, 1 - (dist - 450) / 300))
  const envelope = rise * fall

  let h = n * envelope * 60

  // 호수 함몰
  for (const lake of LAKES) {
    const ld = Math.sqrt((x - lake.cx) ** 2 + (z - lake.cz) ** 2)
    if (ld < lake.radius * 1.3) {
      h -= (1 - ld / (lake.radius * 1.3)) * lake.depth
    }
  }

  return Math.max(0, h)
}

/** 호수 근처인지 확인 (모래/배치 금지 용도) */
export function isNearLake(x: number, z: number): boolean {
  for (const lake of LAKES) {
    const ld = Math.sqrt((x - lake.cx) ** 2 + (z - lake.cz) ** 2)
    if (ld < lake.radius * 1.4) return true
  }
  return false
}

/** 결정론적 시드 랜덤 */
export function srand(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}
