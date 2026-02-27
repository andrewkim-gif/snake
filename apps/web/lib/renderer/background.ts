/**
 * Background + Boundary 렌더링 — Brawl Stars 스타일
 * 진한 네이비 배경 + 굵은 그리드 + 극적인 경계
 */

import { COLORS } from '@snake-arena/shared';
import type { Camera } from './types';

export function drawBackground(ctx: CanvasRenderingContext2D, cam: Camera, w: number, h: number): void {
  ctx.fillStyle = COLORS.BACKGROUND;
  ctx.fillRect(0, 0, w, h);

  const gridSize = 80;
  const startX = Math.floor((-w / 2 / cam.zoom + cam.x) / gridSize) * gridSize;
  const startY = Math.floor((-h / 2 / cam.zoom + cam.y) / gridSize) * gridSize;
  const endX = startX + w / cam.zoom + gridSize * 2;
  const endY = startY + h / cam.zoom + gridSize * 2;

  // 굵은 그리드 라인
  ctx.beginPath();
  for (let gx = startX; gx < endX; gx += gridSize) {
    const sx = (gx - cam.x) * cam.zoom + w / 2;
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, h);
  }
  for (let gy = startY; gy < endY; gy += gridSize) {
    const sy = (gy - cam.y) * cam.zoom + h / 2;
    ctx.moveTo(0, sy);
    ctx.lineTo(w, sy);
  }
  ctx.strokeStyle = COLORS.GRID_PATTERN;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

export function drawBoundary(ctx: CanvasRenderingContext2D, cam: Camera, radius: number, w: number, h: number): void {
  const cx = (0 - cam.x) * cam.zoom + w / 2;
  const cy = (0 - cam.y) * cam.zoom + h / 2;
  const r = radius * cam.zoom;

  // 경계 밖: 어두운 오버레이
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.arc(cx, cy, r, 0, Math.PI * 2, true);
  ctx.fillStyle = COLORS.BOUNDARY_OUTSIDE;
  ctx.fill();
  ctx.restore();

  // 경계선: 두꺼운 아웃라인 (Brawl Stars 스타일)
  // 1) 블랙 두꺼운 외곽
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 8;
  ctx.stroke();

  // 2) 레드 경고선
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = COLORS.BOUNDARY_WARNING;
  ctx.lineWidth = 4;
  ctx.stroke();

  // 3) 위험 구역 글로우
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
  ctx.strokeStyle = COLORS.BOUNDARY_GLOW;
  ctx.lineWidth = 12;
  ctx.stroke();
  ctx.restore();
}
