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
