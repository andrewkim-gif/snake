/**
 * game/isometric.ts - 아이소메트릭 물리 유틸리티
 * v1.0: 넉백, 투사체 궤적, 그림자 렌더링을 아이소메트릭 뷰에 맞게 변환
 *
 * 아이소메트릭 2:1 비율 (화면 X:Y = 2:1)
 * - 화면 X 방향: 월드 (+X, -Y)
 * - 화면 Y 방향: 월드 (+X, +Y) 압축 + 높이(Z)
 */

// ===== 아이소메트릭 상수 =====

/** 아이소메트릭 Y축 압축 비율 (2:1 다이아몬드 그리드) */
export const ISO_Y_SCALE = 0.5;

/** 공중 발사체용 아이소메트릭 Y축 압축 비율 (약한 기울기 - 3D 원근감) */
export const ISO_PROJECTILE_Y_SCALE = 0.75;

/** 아이소메트릭 각도 (arctan(0.5) = 26.565°) */
export const ISO_ANGLE = Math.atan(0.5);

/** Z축 중력 가속도 (px/s²) - 아래로 떨어지는 힘 */
export const GRAVITY_Z = -1200;

/** Z→화면Y 변환 비율 (높이가 화면 Y에 미치는 영향) */
export const ISO_Z_TO_SCREEN_Y = 1.0;

// ===== 좌표 변환 함수 =====

/**
 * 월드 좌표 → 화면 좌표 변환 (아이소메트릭)
 * @param worldX 월드 X 좌표
 * @param worldY 월드 Y 좌표
 * @param worldZ 높이 (0 = 지면)
 * @returns 화면 좌표 { screenX, screenY }
 */
export function worldToScreen(
  worldX: number,
  worldY: number,
  worldZ: number = 0
): { screenX: number; screenY: number } {
  return {
    screenX: worldX - worldY,
    screenY: (worldX + worldY) * ISO_Y_SCALE - worldZ * ISO_Z_TO_SCREEN_Y,
  };
}

/**
 * 화면 좌표 → 월드 좌표 변환 (역변환, z=0 가정)
 */
export function screenToWorld(
  screenX: number,
  screenY: number
): { worldX: number; worldY: number } {
  // screenX = worldX - worldY
  // screenY = (worldX + worldY) * 0.5
  // 연립방정식 풀이:
  const worldX = (screenX + screenY * 2) / 2;
  const worldY = (screenY * 2 - screenX) / 2;
  return { worldX, worldY };
}

// ===== 넉백/물리 함수 =====

/**
 * 아이소메트릭 넉백 방향 계산
 * Y축을 0.5배 압축하여 아이소메트릭 각도에 맞춤
 *
 * @param angle 화면상의 피격 각도 (라디안)
 * @param force 넉백 힘
 * @returns { x, y } 아이소메트릭 보정된 넉백 벡터
 */
export function isoKnockback(
  angle: number,
  force: number
): { x: number; y: number } {
  return {
    x: Math.cos(angle) * force,
    y: Math.sin(angle) * force * ISO_Y_SCALE,
  };
}

/**
 * 아이소메트릭 속도 벡터 생성
 * 던지기/발사 방향을 아이소메트릭에 맞게 변환
 *
 * @param angle 발사 각도 (라디안)
 * @param speed 속도
 * @returns { x, y } 아이소메트릭 보정된 속도 벡터
 */
export function isoVelocity(
  angle: number,
  speed: number
): { x: number; y: number } {
  return {
    x: Math.cos(angle) * speed,
    y: Math.sin(angle) * speed * ISO_Y_SCALE,
  };
}

// ===== 그림자 렌더링 =====

/**
 * 투사체 그림자 렌더링
 * 높이(z)에 따라 그림자 크기, 위치, 투명도 조절
 *
 * @param ctx Canvas 2D 컨텍스트
 * @param x 투사체 화면 X
 * @param y 투사체 화면 Y (높이 반영 전)
 * @param z 투사체 높이 (0 = 지면)
 * @param radius 그림자 기본 반경
 */
export function drawProjectileShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  z: number,
  radius: number
): void {
  if (z <= 0) return;

  // 그림자 위치: 투사체 아래 (z만큼 떨어진 지면)
  const shadowY = y + z * ISO_Z_TO_SCREEN_Y;

  // 높이에 따른 그림자 스케일 (높을수록 작아짐)
  const scale = Math.max(0.3, 1 - z / 500);

  // 높이에 따른 그림자 투명도 (높을수록 연해짐)
  const alpha = Math.max(0.1, 0.4 - z / 1000);

  ctx.save();
  ctx.translate(x, shadowY);
  ctx.scale(1, ISO_Y_SCALE); // 아이소메트릭 타원 그림자
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.beginPath();
  ctx.arc(0, 0, radius * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * 착지 임팩트 이펙트
 * 투사체가 z=0에 도달했을 때 호출
 */
export function drawLandingImpact(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string = 'rgba(255, 255, 255, 0.6)'
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ISO_Y_SCALE);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// ===== 헬퍼 함수 =====

/**
 * 아이소메트릭 방향 각도 계산
 * 8방향을 아이소메트릭에 맞게 변환
 */
export const ISO_DIRECTIONS = {
  // 화면 기준 방향 → 아이소메트릭 각도
  RIGHT: 0,                          // →
  DOWN_RIGHT: Math.PI * 0.25,        // ↘ (아이소메트릭 "앞")
  DOWN: Math.PI * 0.5,               // ↓
  DOWN_LEFT: Math.PI * 0.75,         // ↙
  LEFT: Math.PI,                     // ←
  UP_LEFT: -Math.PI * 0.75,          // ↖ (아이소메트릭 "뒤 위")
  UP: -Math.PI * 0.5,                // ↑
  UP_RIGHT: -Math.PI * 0.25,         // ↗
} as const;

/**
 * 아이소메트릭 "위로 던지기" 각도
 * 화면상 왼쪽 위(↖)로 던지고 오른쪽 아래(↘)로 떨어짐
 */
export const ISO_THROW_UP_ANGLE = -Math.PI * 0.6; // -108° (왼쪽 위)

/**
 * 아이소메트릭 "하늘에서 낙하" 시작 각도
 * 왼쪽 위에서 시작하여 오른쪽 아래로
 */
export const ISO_FALL_FROM_SKY_ANGLE = Math.PI * 0.3; // 54° (오른쪽 아래)

/**
 * 아이소메트릭 렌더링 각도 변환
 * 2D 각도를 아이소메트릭 평면에서 보이는 각도로 변환
 *
 * @param angle 원래 2D 각도 (라디안)
 * @returns 아이소메트릭 렌더링 각도 (라디안)
 */
export function isoRenderAngle(angle: number): number {
  return Math.atan2(Math.sin(angle) * ISO_Y_SCALE, Math.cos(angle));
}

/**
 * 공중 발사체 아이소메트릭 변환 적용
 * 각도 회전 + 약한 Y축 압축으로 3D 원근감 부여
 *
 * @param ctx Canvas 2D 컨텍스트
 * @param angle 발사체 각도 (라디안)
 */
export function applyIsoProjectileTransform(
  ctx: CanvasRenderingContext2D,
  angle: number
): void {
  ctx.rotate(isoRenderAngle(angle));
  ctx.scale(1, ISO_PROJECTILE_Y_SCALE);
}

/**
 * 아이소메트릭 파티클 속도 생성
 * 파티클이 아이소메트릭 평면 위에서 퍼지는 것처럼 보이게 함
 *
 * @param angle 분산 각도 (라디안)
 * @param speed 속도
 * @returns { x, y } 아이소메트릭 보정된 파티클 속도
 */
export function isoParticleVelocity(
  angle: number,
  speed: number
): { x: number; y: number } {
  return {
    x: Math.cos(angle) * speed,
    y: Math.sin(angle) * speed * ISO_Y_SCALE,
  };
}
