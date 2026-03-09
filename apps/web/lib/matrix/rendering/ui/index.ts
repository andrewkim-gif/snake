/**
 * game/rendering/ui/index.ts - UI 렌더링 모듈
 *
 * 조이스틱, 경고 표시 등 UI 요소 렌더링
 */

import type { Vector2 } from '../../types';

// ===== Types =====
export interface JoystickState {
  active: boolean;
  origin: Vector2;
  current: Vector2;
}

export interface FormationWarningPosition {
  x: number;
  y: number;
}

// ===== 조이스틱 렌더링 =====
export const drawJoystick = (
  ctx: CanvasRenderingContext2D,
  joystickState: JoystickState
): void => {
  if (!joystickState.active) return;
  const { origin, current } = joystickState;
  ctx.beginPath();
  ctx.arc(origin.x, origin.y, 40, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.fill();

  const dx = current.x - origin.x;
  const dy = current.y - origin.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  const maxLen = 40;
  const clampedLen = Math.min(len, maxLen);
  const nx = len > 0 ? dx / len : 0;
  const ny = len > 0 ? dy / len : 0;

  ctx.beginPath();
  ctx.arc(origin.x + nx * clampedLen, origin.y + ny * clampedLen, 20, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fill();
};

// ===== 적 타입별 색상 =====
const ENEMY_TYPE_COLORS: Record<string, string> = {
  glitch: '#00FF41',    // Matrix Green
  bot: '#3b82f6',       // Blue
  malware: '#dc2626',   // Red
  whale: '#6b7280',     // Gray
  sniper: '#f97316',    // Orange
  caster: '#a855f7',    // Purple
  artillery: '#ea580c', // Dark Orange
  // Singularity types
  bitling: '#22d3ee',   // Cyan
  spammer: '#84cc16',   // Lime
  crypter: '#f59e0b',   // Amber
  ransomer: '#ef4444',  // Red
  pixel: '#ec4899',     // Pink
  bug: '#14b8a6',       // Teal
  worm: '#06b6d4',      // Cyan
  adware: '#eab308',    // Yellow
  mutant: '#8b5cf6',    // Violet
  polymorphic: '#d946ef', // Fuchsia
  trojan: '#22c55e',    // Green
  botnet: '#64748b',    // Slate
  rootkit: '#1e293b',   // Dark
  apt: '#7c3aed',       // Purple
  zeroday: '#fbbf24',   // Amber
  skynet: '#dc2626',    // Red
};

// ===== 편대 경고 렌더링 =====
export function drawFormationWarning(
  ctx: CanvasRenderingContext2D,
  positions: FormationWarningPosition[],
  camera: { x: number; y: number },
  enemyType: string,
  timer: number // 남은 경고 시간 (0~1)
): void {
  const t = Date.now();
  const pulseRate = 100; // 깜빡임 속도
  const alpha = 0.2 + Math.abs(Math.sin(t / pulseRate)) * 0.3;

  const color = ENEMY_TYPE_COLORS[enemyType] || '#ff0000';

  ctx.save();

  positions.forEach((pos, index) => {
    const screenX = pos.x - camera.x;
    const screenY = pos.y - camera.y;

    // 화면 밖이면 스킵
    if (screenX < -50 || screenX > window.innerWidth + 50 ||
        screenY < -50 || screenY > window.innerHeight + 50) {
      return;
    }

    // 외부 원 (깜빡임)
    ctx.beginPath();
    ctx.arc(screenX, screenY, 25 + Math.sin(t / pulseRate + index) * 5, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    // 내부 원 (점점 커짐 - 스폰 임박 표시)
    const innerRadius = 5 + (1 - timer) * 15; // timer가 0에 가까울수록 커짐
    ctx.beginPath();
    ctx.arc(screenX, screenY, innerRadius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha * 0.5;
    ctx.fill();

    // 중심점
    ctx.beginPath();
    ctx.arc(screenX, screenY, 3, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.8;
    ctx.fill();
  });

  ctx.restore();
}

// ===== 콤보 카운터 렌더링 =====
export { drawComboAboveCharacter, drawComboTimer } from './comboCanvas';
