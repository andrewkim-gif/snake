/**
 * Background + Boundary 렌더링 — Crayon / Pencil Sketch on Paper
 * 종이 질감 + 연필 그리드 + 낙서 장식 + 손그림 경계선
 */

import { COLORS } from '@snake-arena/shared';
import type { Camera } from './types';

// ─── Seeded Random (프레임간 일관성 유지) ───

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49271;
  return x - Math.floor(x);
}

// ─── 종이 질감 색상 ───

const PAPER = '#F5F0E8';
const PAPER_GRAIN = '#EDE7DB';
const PENCIL_LIGHT = '#A89888';
const PENCIL_MEDIUM = '#6B5E52';
const PENCIL_DARK = '#3A3028';

// 타일 상수
const TILE_SIZE = 80;

// ─── Grain 텍스처 캐시 (OffscreenCanvas) ───
let grainPattern: CanvasPattern | null = null;
let grainPatternZoom = -1;

function getGrainPattern(ctx: CanvasRenderingContext2D, zoom: number): CanvasPattern | null {
  // zoom이 10% 이상 변하면 재생성
  if (grainPattern && grainPatternZoom > 0 && Math.abs(zoom - grainPatternZoom) / grainPatternZoom < 0.1) {
    return grainPattern;
  }

  const tileW = Math.ceil(360 * zoom);
  const tileH = Math.ceil(360 * zoom);
  const offscreen = document.createElement('canvas');
  offscreen.width = tileW;
  offscreen.height = tileH;
  const octx = offscreen.getContext('2d');
  if (!octx) return null;

  // 투명 배경
  octx.clearRect(0, 0, tileW, tileH);

  // grain 패턴을 타일에 그림
  const grainSize = 120 * zoom;
  for (let col = 0; col < 3; col++) {
    for (let row = 0; row < 3; row++) {
      if ((col + row) % 3 !== 0) continue;
      const sx = col * grainSize;
      const sy = row * grainSize;
      const seed = col * 1000 + row;
      const a = seededRandom(seed) * 0.04 + 0.01;
      octx.fillStyle = `rgba(210, 200, 185, ${a})`;
      const gw = grainSize * (0.6 + seededRandom(seed + 1) * 0.4);
      const gh = grainSize * (0.6 + seededRandom(seed + 2) * 0.4);
      octx.fillRect(sx - gw / 2, sy - gh / 2, gw, gh);
    }
  }

  grainPattern = ctx.createPattern(offscreen, 'repeat');
  grainPatternZoom = zoom;
  return grainPattern;
}

// 낙서 장식 — deterministic 위치
const DOODLE_COUNT = 25;
let doodlePositions: Array<{
  x: number; y: number; type: 'star' | 'swirl' | 'wave' | 'circle' | 'arrow';
  size: number; rotation: number; seed: number;
}> | null = null;

function initDoodles(radius: number): typeof doodlePositions {
  const doodles: NonNullable<typeof doodlePositions> = [];
  for (let i = 0; i < DOODLE_COUNT; i++) {
    const seed = i * 137.508;
    const dist = (Math.abs(Math.sin(seed * 0.7)) * 0.85 + 0.05) * radius;
    const angle = seed % (Math.PI * 2);
    const types = ['star', 'swirl', 'wave', 'circle', 'arrow'] as const;
    doodles.push({
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
      type: types[i % types.length],
      size: 10 + Math.abs(Math.sin(seed * 1.3)) * 15,
      rotation: seededRandom(seed) * Math.PI * 2,
      seed: seed,
    });
  }
  return doodles;
}

// 파티클 (연필깎기 부스러기, 지우개 가루)
interface SketchParticle {
  x: number; y: number;
  size: number; alpha: number;
  speed: number; angle: number;
  type: 'shaving' | 'eraser';
  rotation: number;
}

let particles: SketchParticle[] | null = null;

function initParticles(radius: number): SketchParticle[] {
  const pts: SketchParticle[] = [];
  for (let i = 0; i < 35; i++) {
    const r = Math.random() * radius;
    const a = Math.random() * Math.PI * 2;
    const isShaving = Math.random() < 0.6;
    pts.push({
      x: Math.cos(a) * r,
      y: Math.sin(a) * r,
      size: isShaving ? 2 + Math.random() * 3 : 1.5 + Math.random() * 2,
      alpha: 0.1 + Math.random() * 0.15,
      speed: 0.02 + Math.random() * 0.05,
      angle: Math.random() * Math.PI * 2,
      type: isShaving ? 'shaving' : 'eraser',
      rotation: Math.random() * Math.PI * 2,
    });
  }
  return pts;
}

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  w: number,
  h: number,
  arenaRadius = 6000,
): void {
  // 종이 배경
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, w, h);

  // 종이 질감 그레인 — OffscreenCanvas 패턴 캐시
  const grain = getGrainPattern(ctx, cam.zoom);
  if (grain) {
    ctx.save();
    ctx.fillStyle = grain;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  // ── 연필 그리드 (wobbly lines) ──
  const tileS = TILE_SIZE * cam.zoom;

  const worldLeft = cam.x - w / 2 / cam.zoom - TILE_SIZE * 2;
  const worldTop = cam.y - h / 2 / cam.zoom - TILE_SIZE * 2;
  const worldRight = cam.x + w / 2 / cam.zoom + TILE_SIZE * 2;
  const worldBottom = cam.y + h / 2 / cam.zoom + TILE_SIZE * 2;

  const colStart = Math.floor(worldLeft / TILE_SIZE) - 1;
  const colEnd = Math.ceil(worldRight / TILE_SIZE) + 1;
  const rowStart = Math.floor(worldTop / TILE_SIZE) - 1;
  const rowEnd = Math.ceil(worldBottom / TILE_SIZE) + 1;

  // 세로선 — wobbly 연필 라인
  ctx.strokeStyle = `rgba(168, 152, 136, 0.18)`;
  ctx.lineWidth = 0.8;
  for (let col = colStart; col <= colEnd; col++) {
    const wx = col * TILE_SIZE;
    const sx = (wx - cam.x) * cam.zoom + w / 2;
    if (sx < -5 || sx > w + 5) continue;
    ctx.beginPath();
    const segments = 8;
    for (let s = 0; s <= segments; s++) {
      const t = s / segments;
      const py = t * h;
      const jitter = (seededRandom(col * 100 + s) - 0.5) * 2.5;
      if (s === 0) ctx.moveTo(sx + jitter, py);
      else ctx.lineTo(sx + jitter, py);
    }
    ctx.stroke();
  }
  // 가로선 — wobbly 연필 라인
  for (let row = rowStart; row <= rowEnd; row++) {
    const wy = row * TILE_SIZE;
    const sy = (wy - cam.y) * cam.zoom + h / 2;
    if (sy < -5 || sy > h + 5) continue;
    ctx.beginPath();
    const segments = 8;
    for (let s = 0; s <= segments; s++) {
      const t = s / segments;
      const px = t * w;
      const jitter = (seededRandom(row * 100 + s + 5000) - 0.5) * 2.5;
      if (s === 0) ctx.moveTo(px, sy + jitter);
      else ctx.lineTo(px, sy + jitter);
    }
    ctx.stroke();
  }

  // ── 연필 낙서 장식 ──
  if (!doodlePositions) doodlePositions = initDoodles(arenaRadius);
  const doodles = doodlePositions!;
  for (const d of doodles) {
    const sx = (d.x - cam.x) * cam.zoom + w / 2;
    const sy = (d.y - cam.y) * cam.zoom + h / 2;
    const sr = d.size * cam.zoom;
    if (sx < -sr * 2 || sx > w + sr * 2 || sy < -sr * 2 || sy > h + sr * 2) continue;
    drawDoodle(ctx, sx, sy, sr, d.type, d.rotation, d.seed);
  }

  // 파티클 (연필깎기 부스러기)
  if (!particles) particles = initParticles(arenaRadius);
  drawSketchParticles(ctx, cam, w, h, particles);
}

/** 낙서 장식 그리기 */
function drawDoodle(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, r: number,
  type: string, rotation: number, seed: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.globalAlpha = 0.08 + seededRandom(seed + 10) * 0.06;
  ctx.strokeStyle = PENCIL_MEDIUM;
  ctx.lineWidth = 1.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (type) {
    case 'star': {
      // 5각별 낙서
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
        const outerX = Math.cos(a) * r + (seededRandom(seed + i) - 0.5) * 3;
        const outerY = Math.sin(a) * r + (seededRandom(seed + i + 10) - 0.5) * 3;
        const innerA = a + Math.PI / 5;
        const innerX = Math.cos(innerA) * r * 0.4 + (seededRandom(seed + i + 20) - 0.5) * 2;
        const innerY = Math.sin(innerA) * r * 0.4 + (seededRandom(seed + i + 30) - 0.5) * 2;
        if (i === 0) ctx.moveTo(outerX, outerY);
        else ctx.lineTo(outerX, outerY);
        ctx.lineTo(innerX, innerY);
      }
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case 'swirl': {
      // 소용돌이 낙서
      ctx.beginPath();
      for (let i = 0; i <= 20; i++) {
        const t = i / 20;
        const a = t * Math.PI * 4;
        const rad = t * r;
        const px = Math.cos(a) * rad + (seededRandom(seed + i) - 0.5) * 2;
        const py = Math.sin(a) * rad + (seededRandom(seed + i + 50) - 0.5) * 2;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      break;
    }
    case 'wave': {
      // 물결선
      ctx.beginPath();
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        const px = (t - 0.5) * r * 2;
        const py = Math.sin(t * Math.PI * 3) * r * 0.4 + (seededRandom(seed + i) - 0.5) * 2;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      break;
    }
    case 'circle': {
      // 손그림 원
      ctx.beginPath();
      const segs = 16;
      for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        const jx = (seededRandom(seed + i) - 0.5) * 3;
        const jy = (seededRandom(seed + i + 40) - 0.5) * 3;
        const px = Math.cos(a) * r * 0.7 + jx;
        const py = Math.sin(a) * r * 0.7 + jy;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      break;
    }
    case 'arrow': {
      // 화살표 낙서
      const len = r * 1.2;
      ctx.beginPath();
      ctx.moveTo(-len / 2 + (seededRandom(seed) - 0.5) * 2, (seededRandom(seed + 1) - 0.5) * 2);
      ctx.lineTo(len / 2 + (seededRandom(seed + 2) - 0.5) * 2, (seededRandom(seed + 3) - 0.5) * 2);
      ctx.stroke();
      // 화살 머리
      ctx.beginPath();
      ctx.moveTo(len / 2, 0);
      ctx.lineTo(len / 2 - r * 0.4, -r * 0.3);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(len / 2, 0);
      ctx.lineTo(len / 2 - r * 0.4, r * 0.3);
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
}

function drawSketchParticles(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  w: number,
  h: number,
  pts: SketchParticle[],
): void {
  for (const p of pts) {
    p.x += Math.cos(p.angle) * p.speed;
    p.y += Math.sin(p.angle) * p.speed;
    p.rotation += 0.005;

    // 연필깎기 부스러기: 살짝 아래로
    if (p.type === 'shaving') {
      p.y += 0.01;
      p.angle += Math.sin(p.rotation * 200 + p.x) * 0.002;
    }

    const sx = (p.x - cam.x * 0.5) * cam.zoom + w / 2;
    const sy = (p.y - cam.y * 0.5) * cam.zoom + h / 2;
    if (sx < -50 || sx > w + 50 || sy < -50 || sy > h + 50) continue;

    ctx.globalAlpha = p.alpha;

    if (p.type === 'shaving') {
      // 연필깎기 부스러기: 작은 곡선 조각
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(p.rotation);
      ctx.strokeStyle = PENCIL_LIGHT;
      ctx.lineWidth = 0.8;
      const s = p.size * cam.zoom;
      ctx.beginPath();
      ctx.moveTo(-s, 0);
      ctx.quadraticCurveTo(0, -s * 0.5, s, s * 0.3);
      ctx.stroke();
      ctx.restore();
    } else {
      // 지우개 가루: 작은 불규칙 점
      ctx.fillStyle = 'rgba(237, 231, 219, 0.6)';
      const s = p.size * cam.zoom;
      ctx.fillRect(sx - s / 2, sy - s / 2, s, s * 0.7);
    }
  }
  ctx.globalAlpha = 1;
}

export function drawBoundary(ctx: CanvasRenderingContext2D, cam: Camera, radius: number, w: number, h: number): void {
  const cx = (0 - cam.x) * cam.zoom + w / 2;
  const cy = (0 - cam.y) * cam.zoom + h / 2;
  const r = radius * cam.zoom;

  // 경계 밖: 종이 그레인 어둡게
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.arc(cx, cy, r, 0, Math.PI * 2, true);
  ctx.fillStyle = COLORS.BOUNDARY_OUTSIDE;
  ctx.fill();
  ctx.restore();

  // 손그림 원 경계선 — 2 pass로 연필 느낌
  const segments = 64;

  // Pass 1: 두꺼운 연필 (흐릿한 언더라인)
  ctx.save();
  ctx.strokeStyle = `rgba(107, 94, 82, 0.3)`;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const seed = i * 7 + 1000;
    const jitter = (seededRandom(seed) - 0.5) * 12 * cam.zoom;
    const jitterY = (seededRandom(seed + 1) - 0.5) * 12 * cam.zoom;
    const px = cx + Math.cos(a) * (r + jitter);
    const py = cy + Math.sin(a) * (r + jitterY);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();

  // Pass 2: 가는 연필 (선명한 메인 라인)
  ctx.save();
  ctx.strokeStyle = PENCIL_DARK;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const seed = i * 7 + 2000;
    const jitter = (seededRandom(seed) - 0.5) * 8 * cam.zoom;
    const jitterY = (seededRandom(seed + 1) - 0.5) * 8 * cam.zoom;
    const px = cx + Math.cos(a) * (r + jitter);
    const py = cy + Math.sin(a) * (r + jitterY);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();

  // 경계 해칭 마크 (짧은 대각선 — 위험 표시)
  ctx.save();
  ctx.strokeStyle = `rgba(58, 48, 40, 0.12)`;
  ctx.lineWidth = 1.2;
  const hashCount = 32;
  for (let i = 0; i < hashCount; i++) {
    const a = (i / hashCount) * Math.PI * 2;
    const px = cx + Math.cos(a) * (r + 10 * cam.zoom);
    const py = cy + Math.sin(a) * (r + 10 * cam.zoom);
    if (px < -20 || px > w + 20 || py < -20 || py > h + 20) continue;
    const hLen = 8 * cam.zoom;
    ctx.beginPath();
    ctx.moveTo(px - hLen * 0.5, py - hLen * 0.5);
    ctx.lineTo(px + hLen * 0.5, py + hLen * 0.5);
    ctx.stroke();
  }
  ctx.restore();
}
