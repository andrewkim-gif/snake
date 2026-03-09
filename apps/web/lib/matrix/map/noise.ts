/**
 * game/map/noise.ts - Simplex Noise 구현
 *
 * v7.0: 자연스러운 바이옴 생성을 위한 노이즈 함수
 * 기반: Stefan Gustavson의 Simplex Noise 알고리즘
 */

// Permutation table (256 값, 두 번 반복)
const PERM_BASE = [
  151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225,
  140, 36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148,
  247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32,
  57, 177, 33, 88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175,
  74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122,
  60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54,
  65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169,
  200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64,
  52, 217, 226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212,
  207, 206, 59, 227, 47, 16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213,
  119, 248, 152, 2, 44, 154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9,
  129, 22, 39, 253, 19, 98, 108, 110, 79, 113, 224, 232, 178, 185, 112, 104,
  218, 246, 97, 228, 251, 34, 242, 193, 238, 210, 144, 12, 191, 179, 162, 241,
  81, 51, 145, 235, 249, 14, 239, 107, 49, 192, 214, 31, 181, 199, 106, 157,
  184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150, 254, 138, 236, 205, 93,
  222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180,
];

// 512 길이 테이블 (두 번 반복)
const perm = new Uint8Array(512);
const permMod12 = new Uint8Array(512);

// 초기화
for (let i = 0; i < 512; i++) {
  perm[i] = PERM_BASE[i & 255];
  permMod12[i] = perm[i] % 12;
}

// 2D Gradient vectors
const GRAD3 = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
  [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
  [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
];

// Skewing factors for 2D
const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;

/**
 * Fast floor (정수 내림)
 */
function fastFloor(x: number): number {
  const xi = x | 0;
  return x < xi ? xi - 1 : xi;
}

/**
 * 2D Dot product with gradient
 */
function dot2(g: number[], x: number, y: number): number {
  return g[0] * x + g[1] * y;
}

/**
 * 2D Simplex Noise
 * @param x X 좌표
 * @param y Y 좌표
 * @returns 노이즈 값 (-1 ~ 1)
 */
export function simplex2D(x: number, y: number): number {
  // Skew input space to determine simplex cell
  const s = (x + y) * F2;
  const i = fastFloor(x + s);
  const j = fastFloor(y + s);

  // Unskew back to (x, y) space
  const t = (i + j) * G2;
  const X0 = i - t;
  const Y0 = j - t;
  const x0 = x - X0;
  const y0 = y - Y0;

  // Determine which simplex we're in
  let i1: number, j1: number;
  if (x0 > y0) {
    i1 = 1;
    j1 = 0;
  } else {
    i1 = 0;
    j1 = 1;
  }

  // Offsets for middle corner
  const x1 = x0 - i1 + G2;
  const y1 = y0 - j1 + G2;

  // Offsets for last corner
  const x2 = x0 - 1 + 2 * G2;
  const y2 = y0 - 1 + 2 * G2;

  // Hash coordinates of the three simplex corners
  const ii = i & 255;
  const jj = j & 255;
  const gi0 = permMod12[ii + perm[jj]];
  const gi1 = permMod12[ii + i1 + perm[jj + j1]];
  const gi2 = permMod12[ii + 1 + perm[jj + 1]];

  // Calculate the contribution from the three corners
  let n0 = 0, n1 = 0, n2 = 0;

  let t0 = 0.5 - x0 * x0 - y0 * y0;
  if (t0 >= 0) {
    t0 *= t0;
    n0 = t0 * t0 * dot2(GRAD3[gi0], x0, y0);
  }

  let t1 = 0.5 - x1 * x1 - y1 * y1;
  if (t1 >= 0) {
    t1 *= t1;
    n1 = t1 * t1 * dot2(GRAD3[gi1], x1, y1);
  }

  let t2 = 0.5 - x2 * x2 - y2 * y2;
  if (t2 >= 0) {
    t2 *= t2;
    n2 = t2 * t2 * dot2(GRAD3[gi2], x2, y2);
  }

  // Scale output to [-1, 1]
  return 70 * (n0 + n1 + n2);
}

/**
 * Seeded Simplex 2D Noise
 * 시드를 사용하여 결정론적 노이즈 생성
 * v7.4: 시드를 작은 범위로 정규화하여 부동소수점 정밀도 문제 방지
 */
export function seededSimplex2D(x: number, y: number, seed: number): number {
  // v7.4: 시드를 0-1000 범위로 정규화 (큰 시드에서 정밀도 문제 방지)
  const normalizedSeed = ((seed % 10000) + 10000) % 10000;  // 0-9999 범위
  const offsetX = normalizedSeed * 0.1 + (normalizedSeed % 100) * 0.01;
  const offsetY = normalizedSeed * 0.2 + (normalizedSeed % 100) * 0.02;
  return simplex2D(x + offsetX, y + offsetY);
}

/**
 * Fractal Brownian Motion (fBM)
 * 여러 옥타브의 노이즈를 합쳐 더 자연스러운 패턴 생성
 *
 * @param x X 좌표
 * @param y Y 좌표
 * @param octaves 옥타브 수 (1-8)
 * @param persistence 퍼시스턴스 (0.5 권장)
 * @param scale 기본 스케일
 * @param seed 시드
 */
export function fbm2D(
  x: number,
  y: number,
  octaves: number = 4,
  persistence: number = 0.5,
  scale: number = 1,
  seed: number = 0
): number {
  let total = 0;
  let frequency = scale;
  let amplitude = 1;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    total += seededSimplex2D(x * frequency, y * frequency, seed + i) * amplitude;
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= 2;
  }

  return total / maxValue;
}

/**
 * Ridge Noise (산맥 효과)
 * 노이즈의 절대값을 뒤집어 날카로운 능선 생성
 */
export function ridgeNoise2D(
  x: number,
  y: number,
  scale: number = 1,
  seed: number = 0
): number {
  const n = seededSimplex2D(x * scale, y * scale, seed);
  return 1 - Math.abs(n);
}

/**
 * 노이즈 값을 0-1 범위로 정규화
 */
export function normalizeNoise(value: number): number {
  return (value + 1) * 0.5;
}

/**
 * 노이즈 기반 Zone ID 생성
 * 같은 노이즈 범위에 있는 타일은 같은 Zone ID
 */
export function getZoneId(noise: number, zones: number = 4): number {
  const normalized = normalizeNoise(noise);
  return Math.floor(normalized * zones) % zones;
}

/**
 * 구역 경계 감지
 * 주변 타일과 다른 Zone이면 경계
 */
export function isZoneBoundary(
  x: number,
  y: number,
  scale: number,
  seed: number,
  zones: number = 4
): boolean {
  const centerNoise = seededSimplex2D(x * scale, y * scale, seed);
  const centerZone = getZoneId(centerNoise, zones);

  // 4방향 체크
  const offsets = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  for (const [dx, dy] of offsets) {
    const neighborNoise = seededSimplex2D((x + dx) * scale, (y + dy) * scale, seed);
    const neighborZone = getZoneId(neighborNoise, zones);
    if (neighborZone !== centerZone) {
      return true;
    }
  }

  return false;
}

/**
 * 부드러운 구역 전환을 위한 블렌딩 값
 * 경계 근처에서 0-1 사이 값 반환
 */
export function getZoneBlend(
  x: number,
  y: number,
  scale: number,
  seed: number,
  blendWidth: number = 0.1
): number {
  const noise = normalizeNoise(seededSimplex2D(x * scale, y * scale, seed));
  const zones = 4;
  const zoneSize = 1 / zones;

  // 가장 가까운 경계까지의 거리
  let minDist = 1;
  for (let i = 1; i < zones; i++) {
    const boundary = i * zoneSize;
    const dist = Math.abs(noise - boundary);
    if (dist < minDist) {
      minDist = dist;
    }
  }

  // blendWidth 내에 있으면 블렌딩 값 반환
  if (minDist < blendWidth) {
    return 1 - (minDist / blendWidth);
  }

  return 0;
}
