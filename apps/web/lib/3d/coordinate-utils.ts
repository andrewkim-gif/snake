/**
 * coordinate-utils — 2D 게임 좌표 → 3D 월드 좌표 변환
 * Y-up 3D 공간: 게임 (x, y) → Three.js (x, height, y)
 */

/**
 * 2D 게임 좌표를 3D 월드 좌표(Y-up)로 변환
 * 게임의 2D 평면(x, y)을 Three.js의 XZ 평면에 매핑
 * @param x - 게임 X 좌표
 * @param y - 게임 Y 좌표
 * @param height - Y축 높이 (기본 0, 지면)
 * @returns [worldX, worldY, worldZ] 튜플
 */
export function toWorld(x: number, y: number, height = 0): [number, number, number] {
  return [x, height, y];
}

/**
 * 게임 heading(라디안)을 Three.js Y축 회전으로 변환
 *
 * 게임: heading=0 → +X(오른쪽), 반시계 양수
 * Three.js: rotY=0일 때 local +Z → world +Z
 * 캐릭터 얼굴: BoxGeometry index 4 = +Z face
 *
 * 따라서 heading=0(+X)일 때 local +Z → world +X가 되려면
 * rotY = π/2 필요. 일반식: rotY = π/2 - heading
 *
 * @param heading - 게임 heading (0~2π, 반시계)
 * @returns Y축 rotation
 */
export function headingToRotY(heading: number): number {
  return Math.PI / 2 - heading;
}

/**
 * mass 기반 Agent 3D 스케일 계산
 * 로그 스케일로 극단적 크기 차이 방지
 * mass 10(초기) → 1.0, mass 50 → ~1.3, mass 100(최대) → ~1.6
 * @param mass - Agent mass (HP 역할, 10~100+)
 * @returns 스케일 배수 (1.0 기준)
 */
export function getAgentScale(mass: number): number {
  // mass가 0 이하일 경우 안전 처리
  if (mass <= 0) return 1.0;
  return 1.0 + Math.log2(Math.max(1, mass / 10)) * 0.3;
}

/**
 * mass 기반 히트박스 반경 계산 (서버와 동기화)
 * @param mass - Agent mass
 * @returns 히트박스 반경 (px)
 */
export function getHitboxRadius(mass: number): number {
  return 16 + Math.min(12, Math.max(0, mass - 10) * 0.133);
}

// ─── v19: MC 블록 좌표 변환 유틸 (ADR-005) ───

/** 서버 아레나 반경 (픽셀 단위) — server/internal/game/constants.go ArenaRadius */
export const SERVER_ARENA_RADIUS_PX = 3000;

/** MC 블록 좌표 상수 */
export const MC_BLOCK_CONSTANTS = {
  /** 아레나 기본 반경 (블록 단위) */
  ARENA_RADIUS_BLOCKS: 80,
  /** 이동 속도 (블록/초) */
  MOVE_SPEED_BPS: 6,
  /** 공격 범위 (블록) */
  ATTACK_RANGE_BLOCKS: 3,
  /** 스폰 반경 마진 (블록) */
  SPAWN_MARGIN_BLOCKS: 5,
} as const;

/**
 * 서버 픽셀 좌표 → MC 블록 좌표 스케일 팩터
 * server radius = 3000px, client radius = 80 blocks → factor = 80/3000
 */
export const SERVER_TO_BLOCK_SCALE = MC_BLOCK_CONSTANTS.ARENA_RADIUS_BLOCKS / SERVER_ARENA_RADIUS_PX;

/**
 * 서버 좌표(px)를 MC 블록 좌표로 변환
 * @param serverX - 서버 X 좌표 (px)
 * @param serverY - 서버 Y 좌표 (px)
 * @returns [blockX, blockZ] MC 블록 좌표
 */
export function serverToBlock(serverX: number, serverY: number): [number, number] {
  return [
    serverX * SERVER_TO_BLOCK_SCALE,
    serverY * SERVER_TO_BLOCK_SCALE,
  ];
}

/**
 * 연속 부동소수점 게임 좌표를 MC 블록 정수 좌표로 변환
 * 전환기간 호환용: 기존 서버가 부동소수점을 전송할 때 블록 좌표로 매핑
 * @param value - 연속 좌표 값
 * @returns MC 블록 정수 좌표
 */
export function toMCBlock(value: number): number {
  return Math.floor(value);
}

/**
 * MC 블록 정수 좌표를 연속 부동소수점 좌표로 변환
 * 블록 중앙(+0.5)을 반환하여 에이전트가 블록 표면 중앙에 위치
 * @param blockValue - MC 블록 정수 좌표
 * @returns 연속 좌표 (블록 중앙)
 */
export function fromMCBlock(blockValue: number): number {
  return blockValue + 0.5;
}

/**
 * 국가 ISO3 코드에서 결정적 시드 해시 생성
 * 동일 국가 = 동일 지형 (모든 클라이언트에서 일관)
 * @param iso3 - 국가 ISO 3166-1 alpha-3 코드 (예: "KOR", "USA")
 * @returns 결정적 시드 숫자
 */
export function countryHash(iso3: string): number {
  let hash = 0;
  for (let i = 0; i < iso3.length; i++) {
    const ch = iso3.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  // 양수 보장 + 범위 제한
  return Math.abs(hash) % 100000;
}
