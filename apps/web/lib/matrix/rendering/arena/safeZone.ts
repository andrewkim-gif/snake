/**
 * safeZone.ts - 안전지대 렌더링
 * 배틀로얄 스타일 축소되는 안전지대 시각화
 */

import { SafeZone, Vector2 } from '../../types';

// 안전지대 색상
const SAFE_ZONE_COLORS = {
  // 안전 영역 (내부)
  safeInner: 'rgba(0, 255, 65, 0.05)',  // Matrix green, 매우 투명
  safeBorder: 'rgba(0, 255, 65, 0.3)',   // Matrix green border

  // 위험 영역 (외부)
  dangerFill: 'rgba(255, 0, 0, 0.15)',   // Red overlay
  dangerBorder: 'rgba(255, 0, 0, 0.6)',  // Red border

  // 경고 상태 (축소 중)
  warningPulse: 'rgba(255, 165, 0, 0.4)', // Orange pulse
  warningBorder: 'rgba(255, 165, 0, 0.8)',

  // 목표 반경 표시
  targetLine: 'rgba(255, 255, 255, 0.3)',
};

/**
 * 안전지대 렌더링
 */
export function drawSafeZone(
  ctx: CanvasRenderingContext2D,
  safeZone: SafeZone,
  cameraOffset: Vector2,
  canvasWidth: number,
  canvasHeight: number,
  zoom: number = 1
): void {
  const { center, currentRadius, targetRadius, isWarning, phase } = safeZone;
  if (!center) return;

  // 화면 좌표로 변환
  const screenX = (center.x - cameraOffset.x) * zoom + canvasWidth / 2;
  const screenY = (center.y - cameraOffset.y) * zoom + canvasHeight / 2;
  const screenRadius = currentRadius * zoom;
  const screenTargetRadius = targetRadius * zoom;

  ctx.save();

  // 1. 위험 영역 오버레이 (안전지대 바깥)
  // 전체 화면을 빨간색으로 채우고, 안전지대만 지움
  ctx.fillStyle = SAFE_ZONE_COLORS.dangerFill;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // 안전지대 영역 지우기 (투명하게)
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(screenX, screenY, screenRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  // 2. 안전지대 테두리
  ctx.strokeStyle = isWarning
    ? SAFE_ZONE_COLORS.warningBorder
    : SAFE_ZONE_COLORS.safeBorder;
  ctx.lineWidth = 3;
  ctx.setLineDash(isWarning ? [10, 5] : []);

  // 경고 시 펄스 애니메이션
  if (isWarning) {
    const pulse = Math.sin(Date.now() / 200) * 0.3 + 0.7;
    ctx.globalAlpha = pulse;
  }

  ctx.beginPath();
  ctx.arc(screenX, screenY, screenRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.setLineDash([]);

  // 3. 목표 반경 표시 (축소 중일 때)
  if (currentRadius > targetRadius) {
    ctx.strokeStyle = SAFE_ZONE_COLORS.targetLine;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 10]);
    ctx.beginPath();
    ctx.arc(screenX, screenY, screenTargetRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 4. 중심점 표시 (디버그용, 옵션)
  if (phase && phase >= 2) {
    ctx.fillStyle = SAFE_ZONE_COLORS.safeBorder;
    ctx.beginPath();
    ctx.arc(screenX, screenY, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * 미니맵용 안전지대 렌더링
 */
export function drawSafeZoneMinimap(
  ctx: CanvasRenderingContext2D,
  safeZone: SafeZone,
  minimapX: number,
  minimapY: number,
  minimapSize: number,
  worldSize: number
): void {
  const scale = minimapSize / worldSize;
  const { center, currentRadius, targetRadius, isWarning } = safeZone;
  if (!center) return;

  // 미니맵 좌표로 변환
  const x = minimapX + center.x * scale;
  const y = minimapY + center.y * scale;
  const radius = currentRadius * scale;
  const targetR = targetRadius * scale;

  ctx.save();

  // 현재 안전지대
  ctx.strokeStyle = isWarning ? '#ffa500' : '#00ff41';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();

  // 목표 안전지대
  if (currentRadius > targetRadius) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.arc(x, y, targetR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}

/**
 * 안전지대 경고 UI 렌더링 (화면 가장자리)
 */
export function drawSafeZoneWarning(
  ctx: CanvasRenderingContext2D,
  playerPosition: Vector2,
  safeZone: SafeZone,
  canvasWidth: number,
  canvasHeight: number
): void {
  const { center, currentRadius } = safeZone;
  if (!center) return;

  // 플레이어가 안전지대 밖인지 체크
  const dx = playerPosition.x - center.x;
  const dy = playerPosition.y - center.y;
  const distFromCenter = Math.sqrt(dx * dx + dy * dy);

  if (distFromCenter <= currentRadius) {
    return; // 안전지대 안에 있으면 경고 없음
  }

  // 화면 가장자리에 빨간 비네트 효과
  const overDistance = distFromCenter - currentRadius;
  const intensity = Math.min(1, overDistance / 200); // 200px 이상이면 최대 강도

  ctx.save();

  // 빨간 비네트 그라데이션
  const gradient = ctx.createRadialGradient(
    canvasWidth / 2, canvasHeight / 2, Math.min(canvasWidth, canvasHeight) * 0.3,
    canvasWidth / 2, canvasHeight / 2, Math.min(canvasWidth, canvasHeight) * 0.7
  );
  gradient.addColorStop(0, 'rgba(255, 0, 0, 0)');
  gradient.addColorStop(1, `rgba(255, 0, 0, ${0.3 * intensity})`);

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // 경고 텍스트 (펄스)
  const pulse = Math.sin(Date.now() / 150) * 0.5 + 0.5;
  ctx.fillStyle = `rgba(255, 0, 0, ${0.5 + pulse * 0.5})`;
  ctx.font = 'bold 24px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('! OUTSIDE SAFE ZONE !', canvasWidth / 2, 60);

  // 안전지대 방향 화살표
  const arrowAngle = Math.atan2(center.y - playerPosition.y, center.x - playerPosition.x);
  const arrowX = canvasWidth / 2 + Math.cos(arrowAngle) * 50;
  const arrowY = 100 + Math.sin(arrowAngle) * 20;

  ctx.save();
  ctx.translate(arrowX, arrowY);
  ctx.rotate(arrowAngle);

  ctx.fillStyle = `rgba(0, 255, 65, ${0.5 + pulse * 0.5})`;
  ctx.beginPath();
  ctx.moveTo(15, 0);
  ctx.lineTo(-10, -8);
  ctx.lineTo(-10, 8);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
  ctx.restore();
}

export default {
  drawSafeZone,
  drawSafeZoneMinimap,
  drawSafeZoneWarning,
};
