/**
 * Background + Boundary 렌더링 — Brawl Stars 스타일
 * 헥사곤 타일 + 존 시스템 (Safe/Battle/Danger) + 패럴랙스 파티클
 */

import { COLORS } from '@snake-arena/shared';
import type { Camera } from './types';

// 존 색상 정의
const ZONE_COLORS = {
  safe:   { bg: '#152230', tile: 'rgba(25, 45, 65, 0.5)',  edge: 'rgba(40, 70, 100, 0.35)', dot: 'rgba(60, 130, 200, 0.08)' },
  battle: { bg: '#0F1923', tile: 'rgba(20, 35, 50, 0.4)',  edge: 'rgba(30, 55, 80, 0.25)',  dot: 'rgba(50, 100, 160, 0.06)' },
  danger: { bg: '#1A0A0A', tile: 'rgba(50, 15, 15, 0.5)',  edge: 'rgba(120, 30, 30, 0.25)', dot: 'rgba(255, 60, 60, 0.08)' },
} as const;

// 헥사곤 타일 상수
const HEX_SIZE = 52; // 헥사곤 반지름
const HEX_H = HEX_SIZE * Math.sqrt(3); // 높이
const HEX_W = HEX_SIZE * 2;            // 폭
const COL_W = HEX_SIZE * 1.5;          // 열 간격

// 패럴랙스 파티클
interface BgParticle {
  x: number; y: number;
  size: number; alpha: number;
  speed: number; angle: number;
}

let particles: BgParticle[] | null = null;

function initParticles(radius: number): BgParticle[] {
  const pts: BgParticle[] = [];
  for (let i = 0; i < 50; i++) {
    const r = Math.random() * radius;
    const a = Math.random() * Math.PI * 2;
    pts.push({
      x: Math.cos(a) * r,
      y: Math.sin(a) * r,
      size: 1 + Math.random() * 2.5,
      alpha: 0.06 + Math.random() * 0.18,
      speed: 0.08 + Math.random() * 0.2,
      angle: Math.random() * Math.PI * 2,
    });
  }
  return pts;
}

/** 헥사곤 경로 생성 (flat-top) */
function hexPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    const hx = cx + r * Math.cos(angle);
    const hy = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(hx, hy);
    else ctx.lineTo(hx, hy);
  }
  ctx.closePath();
}

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  w: number,
  h: number,
  arenaRadius = 6000,
): void {
  // 카메라 중심으로부터의 거리로 존 판별
  const distFromCenter = Math.sqrt(cam.x * cam.x + cam.y * cam.y);
  const ratio = distFromCenter / arenaRadius;

  // 존 기반 색상
  let bgColor: string;
  let tileColor: string;
  let edgeColor: string;
  let dotColor: string;
  if (ratio < 0.3) {
    bgColor = ZONE_COLORS.safe.bg;
    tileColor = ZONE_COLORS.safe.tile;
    edgeColor = ZONE_COLORS.safe.edge;
    dotColor = ZONE_COLORS.safe.dot;
  } else if (ratio < 0.65) {
    const t = (ratio - 0.3) / 0.35;
    bgColor = lerpHex(ZONE_COLORS.safe.bg, ZONE_COLORS.battle.bg, t);
    tileColor = ZONE_COLORS.battle.tile;
    edgeColor = ZONE_COLORS.battle.edge;
    dotColor = ZONE_COLORS.battle.dot;
  } else if (ratio < 0.8) {
    const t = (ratio - 0.65) / 0.15;
    bgColor = lerpHex(ZONE_COLORS.battle.bg, ZONE_COLORS.danger.bg, t);
    tileColor = ZONE_COLORS.danger.tile;
    edgeColor = ZONE_COLORS.danger.edge;
    dotColor = ZONE_COLORS.danger.dot;
  } else {
    bgColor = ZONE_COLORS.danger.bg;
    tileColor = ZONE_COLORS.danger.tile;
    edgeColor = ZONE_COLORS.danger.edge;
    dotColor = ZONE_COLORS.danger.dot;
  }

  // 배경 채우기
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, w, h);

  // ── 헥사곤 타일 그리드 ──
  const hexR = HEX_SIZE * cam.zoom;
  const margin = hexR * 2;

  // 월드 좌표에서 보이는 범위
  const worldLeft = cam.x - w / 2 / cam.zoom - HEX_SIZE * 2;
  const worldTop = cam.y - h / 2 / cam.zoom - HEX_SIZE * 2;
  const worldRight = cam.x + w / 2 / cam.zoom + HEX_SIZE * 2;
  const worldBottom = cam.y + h / 2 / cam.zoom + HEX_SIZE * 2;

  // 타일 시작/끝 열/행 계산
  const colStart = Math.floor(worldLeft / COL_W) - 1;
  const colEnd = Math.ceil(worldRight / COL_W) + 1;
  const rowStart = Math.floor(worldTop / HEX_H) - 1;
  const rowEnd = Math.ceil(worldBottom / HEX_H) + 1;

  // 타일 채우기 (짝수/홀수 열 체커보드)
  ctx.beginPath();
  for (let col = colStart; col <= colEnd; col++) {
    for (let row = rowStart; row <= rowEnd; row++) {
      const wx = col * COL_W;
      const wy = row * HEX_H + (col % 2 !== 0 ? HEX_H * 0.5 : 0);
      // 체커보드: 매 2번째 타일만 채우기
      if ((col + row) % 2 !== 0) continue;
      const sx = (wx - cam.x) * cam.zoom + w / 2;
      const sy = (wy - cam.y) * cam.zoom + h / 2;
      if (sx < -margin || sx > w + margin || sy < -margin || sy > h + margin) continue;
      hexPath(ctx, sx, sy, hexR * 0.95);
    }
  }
  ctx.fillStyle = tileColor;
  ctx.fill();

  // 타일 엣지 (모든 타일)
  ctx.beginPath();
  for (let col = colStart; col <= colEnd; col++) {
    for (let row = rowStart; row <= rowEnd; row++) {
      const wx = col * COL_W;
      const wy = row * HEX_H + (col % 2 !== 0 ? HEX_H * 0.5 : 0);
      const sx = (wx - cam.x) * cam.zoom + w / 2;
      const sy = (wy - cam.y) * cam.zoom + h / 2;
      if (sx < -margin || sx > w + margin || sy < -margin || sy > h + margin) continue;
      hexPath(ctx, sx, sy, hexR);
    }
  }
  ctx.strokeStyle = edgeColor;
  ctx.lineWidth = 1;
  ctx.stroke();

  // 타일 중심 도트 (미묘한 장식)
  ctx.beginPath();
  for (let col = colStart; col <= colEnd; col++) {
    for (let row = rowStart; row <= rowEnd; row++) {
      const wx = col * COL_W;
      const wy = row * HEX_H + (col % 2 !== 0 ? HEX_H * 0.5 : 0);
      if ((col + row) % 3 !== 0) continue; // 1/3만 도트
      const sx = (wx - cam.x) * cam.zoom + w / 2;
      const sy = (wy - cam.y) * cam.zoom + h / 2;
      if (sx < -margin || sx > w + margin || sy < -margin || sy > h + margin) continue;
      ctx.moveTo(sx + 3 * cam.zoom, sy);
      ctx.arc(sx, sy, 3 * cam.zoom, 0, Math.PI * 2);
    }
  }
  ctx.fillStyle = dotColor;
  ctx.fill();

  // 패럴랙스 파티클
  if (!particles) particles = initParticles(arenaRadius);
  drawParticles(ctx, cam, w, h, particles);
}

function drawParticles(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  w: number,
  h: number,
  pts: BgParticle[],
): void {
  for (const p of pts) {
    p.x += Math.cos(p.angle) * p.speed;
    p.y += Math.sin(p.angle) * p.speed;

    // 패럴랙스: 카메라의 50% 속도
    const sx = (p.x - cam.x * 0.5) * cam.zoom + w / 2;
    const sy = (p.y - cam.y * 0.5) * cam.zoom + h / 2;
    if (sx < -50 || sx > w + 50 || sy < -50 || sy > h + 50) continue;

    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(sx, sy, p.size * cam.zoom, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function lerpHex(a: string, b: string, t: number): string {
  const ah = parseInt(a.slice(1), 16);
  const bh = parseInt(b.slice(1), 16);
  const ar = (ah >> 16) & 0xff, ag = (ah >> 8) & 0xff, ab = ah & 0xff;
  const br = (bh >> 16) & 0xff, bg = (bh >> 8) & 0xff, bb = bh & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bVal = Math.round(ab + (bb - ab) * t);
  return `#${((r << 16) | (g << 8) | bVal).toString(16).padStart(6, '0')}`;
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

  // 블랙 두꺼운 외곽
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 8;
  ctx.stroke();

  // 레드 경고선
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = COLORS.BOUNDARY_WARNING;
  ctx.lineWidth = 4;
  ctx.stroke();

  // 글로우
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
  ctx.strokeStyle = COLORS.BOUNDARY_GLOW;
  ctx.lineWidth = 12;
  ctx.stroke();
  ctx.restore();
}
