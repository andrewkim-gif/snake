// ============================================================================
// math.ts — 공용 수학 유틸리티 함수
// 게임 로직 전반에서 사용되는 순수 함수 모음
// ============================================================================

// ---------------------------------------------------------------------------
// 2D 좌표 타입 (간결한 인라인 타입 사용)
// ---------------------------------------------------------------------------
type Point = { x: number; y: number };

// ===========================================================================
// 기본 거리/벡터 함수
// ===========================================================================

/**
 * 유클리드 거리 — 두 점 사이의 직선 거리
 * Math.sqrt 포함으로 정확한 거리 필요시 사용
 */
export function distance(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 거리 제곱 — sqrt 없이 빠른 거리 비교용
 * 핫패스(충돌 검사 등)에서 성능 최적화를 위해 사용
 */
export function distanceSquared(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return dx * dx + dy * dy;
}

/**
 * 단위 벡터 정규화 — 벡터를 길이 1로 변환
 * 영벡터(길이 0)인 경우 {x:0, y:0} 반환 (0 나누기 방지)
 */
export function normalize(v: Point): Point {
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

/**
 * 두 점 사이의 각도 — atan2 기반 라디안 반환
 * a에서 b를 향하는 방향각 계산
 */
export function angleBetween(a: Point, b: Point): number {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

// ===========================================================================
// 충돌 검사 함수
// ===========================================================================

/**
 * 원-원 충돌 판정 — distanceSquared 기반 (sqrt 제거)
 * 두 원의 중심 거리 제곱이 반지름 합의 제곱보다 작으면 충돌
 */
export function circlesOverlap(
  p1: Point,
  r1: number,
  p2: Point,
  r2: number
): boolean {
  const sumR = r1 + r2;
  return distanceSquared(p1, p2) < sumR * sumR;
}

/**
 * 범위 내 판정 — sqrt 없이 빠른 거리 체크
 * 두 점 사이 거리가 range 이내인지 확인
 */
export function isWithinRange(a: Point, b: Point, range: number): boolean {
  return distanceSquared(a, b) <= range * range;
}

// ===========================================================================
// 보간 및 랜덤 함수
// ===========================================================================

/**
 * 선형 보간 (Linear Interpolation)
 * t=0이면 a, t=1이면 b, 그 사이는 비례 보간
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * 범위 내 랜덤 수 — [min, max) 구간
 * Math.random() 기반 균등 분포
 */
export function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// ===========================================================================
// 게임 보너스 계산
// ===========================================================================

/**
 * 티어별 보너스 계산 — 무기 보너스 배율
 * amount를 1000으로 나눈 값 반환 (예: 3000 → 3.0 배율)
 */
export function calcTieredBonus(level: number, tiers?: number[]): number {
  if (!tiers || tiers.length === 0) return level / 1000;
  // v29: 원본 GameCanvas 호환 - 레벨별 계층 보너스 계산
  const tierSize = 5;
  let bonus = 0;
  let remaining = level;
  for (let i = 0; i < tiers.length && remaining > 0; i++) {
    const levelsInTier = Math.min(remaining, tierSize);
    bonus += levelsInTier * tiers[i];
    remaining -= levelsInTier;
  }
  return bonus;
}

// ===========================================================================
// sin/cos 룩업 테이블 — 360° 프리컴퓨팅 (Float32Array)
// 삼각함수 호출을 배열 접근으로 대체하여 핫패스 성능 최적화
// ===========================================================================

/** 도→라디안 변환 상수 */
const DEG_TO_RAD = Math.PI / 180;

/** 라디안→도 변환 상수 */
const RAD_TO_DEG = 180 / Math.PI;

/** sin 룩업 테이블 (0°~359°, 총 360 엔트리) */
const SIN_TABLE = new Float32Array(360);

/** cos 룩업 테이블 (0°~359°, 총 360 엔트리) */
const COS_TABLE = new Float32Array(360);

// 테이블 초기화 — 모듈 로드 시 1회만 실행
for (let i = 0; i < 360; i++) {
  const rad = i * DEG_TO_RAD;
  SIN_TABLE[i] = Math.sin(rad);
  COS_TABLE[i] = Math.cos(rad);
}

/**
 * 빠른 sin — 도(degree) 단위 입력
 * 정수 입력 권장 (소수점은 내림 처리)
 * 음수/360 이상도 정상 처리 (모듈로 연산)
 */
export function fastSin(degrees: number): number {
  const idx = ((Math.round(degrees) % 360) + 360) % 360;
  return SIN_TABLE[idx];
}

/**
 * 빠른 cos — 도(degree) 단위 입력
 * 정수 입력 권장 (소수점은 내림 처리)
 * 음수/360 이상도 정상 처리 (모듈로 연산)
 */
export function fastCos(degrees: number): number {
  const idx = ((Math.round(degrees) % 360) + 360) % 360;
  return COS_TABLE[idx];
}

/**
 * 빠른 sin — 라디안(radian) 단위 입력
 * 라디안을 도로 변환 후 룩업 테이블 사용
 */
export function fastSinRad(radians: number): number {
  const deg = radians * RAD_TO_DEG;
  const idx = ((Math.round(deg) % 360) + 360) % 360;
  return SIN_TABLE[idx];
}

/**
 * 빠른 cos — 라디안(radian) 단위 입력
 * 라디안을 도로 변환 후 룩업 테이블 사용
 */
export function fastCosRad(radians: number): number {
  const deg = radians * RAD_TO_DEG;
  const idx = ((Math.round(deg) % 360) + 360) % 360;
  return COS_TABLE[idx];
}
