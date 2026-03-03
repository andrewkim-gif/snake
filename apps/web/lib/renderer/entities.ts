/**
 * Entity 렌더링 — Crayon / Pencil Sketch on Paper
 * 워블 아웃라인 + 크레용 필 + 해칭 음영 + 연필 눈
 */

import type { SnakeNetworkData, OrbNetworkData } from '@snake-arena/shared';
import { ORB_COLORS, COLORS, DEFAULT_SKINS, ARENA_CONFIG } from '@snake-arena/shared';
import type { Camera } from './types';

// ─── Seeded Random ───

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49271;
  return x - Math.floor(x);
}

// ─── 색상 상수 ───

const PENCIL_DARK = '#3A3028';
const PAPER = '#F5F0E8';

/* ─── Orb 렌더링 (스케치 스타일) ─── */

const ORB_SHAPES = [
  'circle', 'heart', 'star4', 'diamond',
  'circle', 'heart', 'star4', 'diamond',
  'circle', 'heart', 'star4', 'diamond',
] as const;
type OrbShape = typeof ORB_SHAPES[number];

/** 하트 경로 */
function heartPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  const s = r * 0.6;
  ctx.moveTo(0, s * 0.4);
  ctx.bezierCurveTo(-s, -s * 0.5, -s * 0.5, -s * 1.2, 0, -s * 0.5);
  ctx.bezierCurveTo(s * 0.5, -s * 1.2, s, -s * 0.5, 0, s * 0.4);
  ctx.closePath();
  ctx.restore();
}

/** 4꼭지 별 경로 */
function star4Path(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI / 2) - Math.PI / 4;
    const ox = Math.cos(a) * r;
    const oy = Math.sin(a) * r;
    const ia = a + Math.PI / 4;
    const ix = Math.cos(ia) * r * 0.45;
    const iy = Math.sin(ia) * r * 0.45;
    if (i === 0) ctx.moveTo(ox, oy);
    else ctx.lineTo(ox, oy);
    ctx.lineTo(ix, iy);
  }
  ctx.closePath();
  ctx.restore();
}

/** 다이아몬드 경로 */
function diamondPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.moveTo(0, -r);
  ctx.quadraticCurveTo(r * 0.3, -r * 0.3, r, 0);
  ctx.quadraticCurveTo(r * 0.3, r * 0.3, 0, r);
  ctx.quadraticCurveTo(-r * 0.3, r * 0.3, -r, 0);
  ctx.quadraticCurveTo(-r * 0.3, -r * 0.3, 0, -r);
  ctx.closePath();
  ctx.restore();
}

/** 오브 모양 경로 */
function orbShapePath(ctx: CanvasRenderingContext2D, shape: OrbShape, x: number, y: number, r: number, rot: number): void {
  switch (shape) {
    case 'heart':   heartPath(ctx, x, y, r, rot); break;
    case 'star4':   star4Path(ctx, x, y, r, rot); break;
    case 'diamond': diamondPath(ctx, x, y, r, rot); break;
    default:        ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2); break;
  }
}

/** 워블 원 경로 (손그림 느낌) */
function wobblyCirclePath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, seed: number, segs = 12): void {
  ctx.beginPath();
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const jitter = (seededRandom(seed + i) - 0.5) * r * 0.15;
    const px = x + Math.cos(a) * (r + jitter);
    const py = y + Math.sin(a) * (r + jitter);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/** 해칭 음영 (짧은 대각선) */
function drawHatching(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, seed: number, color: string): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.8;
  ctx.globalAlpha = 0.25;
  const count = Math.max(3, Math.floor(r / 3));
  for (let i = 0; i < count; i++) {
    const t = (i / count) * 2 - 1;
    const hx = x + t * r * 0.5;
    const hy = y + r * 0.1;
    const len = r * 0.3 + seededRandom(seed + i + 100) * r * 0.2;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(hx + len * 0.7, hy + len);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawOrbs(
  ctx: CanvasRenderingContext2D,
  orbs: OrbNetworkData[],
  cam: Camera,
  w: number,
  h: number,
  myHeadScreen?: { x: number; y: number } | null,
  collectRadius = ARENA_CONFIG.collectRadius,
  now = performance.now(),
): void {
  const groups = new Map<number, Array<{ sx: number; sy: number; r: number; shape: OrbShape; rot: number; seed: number }>>();
  const specialOrbs: Array<{ sx: number; sy: number; r: number; t: number; seed: number }> = [];
  const attractRadius = collectRadius * cam.zoom * 2.5;
  const tick = now * 0.001;

  for (const orb of orbs) {
    let sx = (orb.x - cam.x) * cam.zoom + w / 2;
    let sy = (orb.y - cam.y) * cam.zoom + h / 2;
    if (sx < -20 || sx > w + 20 || sy < -20 || sy > h + 20) continue;

    const r = orb.t === 6
      ? (6 + orb.v * 0.3) * cam.zoom
      : (3 + orb.v * 0.6) * cam.zoom;

    if (myHeadScreen) {
      const dx = myHeadScreen.x - sx;
      const dy = myHeadScreen.y - sy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < attractRadius && dist > 1) {
        const pull = 1 - dist / attractRadius;
        const pullStrength = pull * pull * 0.4;
        sx += dx * pullStrength;
        sy += dy * pullStrength;
      }
    }

    const orbSeed = Math.floor(orb.x) + Math.floor(orb.y);

    if (orb.t >= 3) {
      specialOrbs.push({ sx, sy, r, t: orb.t, seed: orbSeed });
    } else {
      let group = groups.get(orb.c);
      if (!group) {
        group = [];
        groups.set(orb.c, group);
      }
      const shape = ORB_SHAPES[orb.c % ORB_SHAPES.length];
      const rot = shape === 'circle' ? 0 : tick * 0.5 + (orb.x + orb.y) * 0.01;
      group.push({ sx, sy, r, shape, rot, seed: orbSeed });
    }
  }

  // 일반 오브 배치 렌더링 — 스케치 스타일
  for (const [colorIdx, orbList] of groups) {
    const color = ORB_COLORS[colorIdx] ?? ORB_COLORS[0];

    // 플랫 fill
    ctx.fillStyle = color;
    ctx.beginPath();
    for (const { sx, sy, r, shape, rot } of orbList) {
      orbShapePath(ctx, shape, sx, sy, r, rot);
    }
    ctx.fill();

    // 손그림 아웃라인 stroke
    ctx.strokeStyle = PENCIL_DARK;
    ctx.lineWidth = Math.max(1, 1.2 * cam.zoom);
    for (const { sx, sy, r, shape, rot, seed } of orbList) {
      if (shape === 'circle') {
        wobblyCirclePath(ctx, sx, sy, r, seed, 8);
        ctx.stroke();
      } else {
        ctx.beginPath();
        orbShapePath(ctx, shape, sx, sy, r + 0.5, rot);
        ctx.stroke();
      }
    }
  }

  // 특수 오브 — 스케치 스타일
  const tickFast = now * 0.06;
  for (const { sx, sy, r, t, seed } of specialOrbs) {
    const color = ORB_COLORS[t === 3 ? 12 : t === 4 ? 13 : t === 5 ? 14 : 15] ?? '#C9A84C';

    ctx.save();
    const baseAlpha = t === 5 ? 0.5 + Math.sin(tickFast * 0.15) * 0.2 : 1;
    ctx.globalAlpha = baseAlpha;

    // 플랫 fill
    if (t === 6) {
      // mega = 회전 별
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(tickFast * 0.05);
      ctx.fillStyle = color;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
        const outerX = Math.cos(a) * r;
        const outerY = Math.sin(a) * r;
        const innerA = a + Math.PI / 5;
        const innerX = Math.cos(innerA) * r * 0.5;
        const innerY = Math.sin(innerA) * r * 0.5;
        if (i === 0) ctx.moveTo(outerX, outerY);
        else ctx.lineTo(outerX, outerY);
        ctx.lineTo(innerX, innerY);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = color;
      wobblyCirclePath(ctx, sx, sy, r, seed, 10);
      ctx.fill();
    }
    // 손그림 아웃라인 stroke
    ctx.globalAlpha = baseAlpha;
    ctx.strokeStyle = PENCIL_DARK;
    ctx.lineWidth = Math.max(1.2, 1.5 * cam.zoom);
    wobblyCirclePath(ctx, sx, sy, r + 1, seed + 100, 10);
    ctx.stroke();

    // magnet: 연필 점선 궤도
    if (t === 3) {
      ctx.strokeStyle = 'rgba(58, 48, 40, 0.2)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(sx, sy, r * 2.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }
}

/* ─── Snake 렌더링 (Sketch 스타일) ─── */

let boostGlowPhase = 0;

/** 손그림 스트로크 아웃라인 — 바디 위에 연필선 */
function drawHanddrawnStroke(
  ctx: CanvasRenderingContext2D,
  pts: { x: number; y: number }[],
  color: string,
  lineWidth: number,
  seed: number,
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = 0.85;
  // wobbly 선 — 각 점에 살짝 jitter
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const jx = (seededRandom(seed + i * 7) - 0.5) * 1.8;
    const jy = (seededRandom(seed + i * 7 + 3) - 0.5) * 1.8;
    if (i === 0) ctx.moveTo(pts[i].x + jx, pts[i].y + jy);
    else ctx.lineTo(pts[i].x + jx, pts[i].y + jy);
  }
  ctx.stroke();
  ctx.restore();
}

export function drawSnakes(
  ctx: CanvasRenderingContext2D,
  snakes: SnakeNetworkData[],
  cam: Camera,
  w: number,
  h: number,
  myId: string | null,
  dt = 0.016,
  now = performance.now(),
): void {
  boostGlowPhase = (boostGlowPhase + dt * 6) % (Math.PI * 2);
  const halfW = w / 2;
  const halfH = h / 2;

  for (const snake of snakes) {
    if (snake.p.length < 2) continue;

    const skin = DEFAULT_SKINS[snake.k % DEFAULT_SKINS.length];
    const thickness = Math.max(10, 5 + Math.pow(snake.m, 0.6) * 1.5) * cam.zoom;
    const outlineWidth = thickness + 3 * cam.zoom;
    const isMe = snake.i === myId;
    const snakeSeed = snake.i ? snake.i.charCodeAt(0) : 0;

    const screenPts: { x: number; y: number }[] = snake.p.map(([px, py]) => ({
      x: (px - cam.x) * cam.zoom + halfW,
      y: (py - cam.y) * cam.zoom + halfH,
    }));

    const head = screenPts[0];

    // ── 부스트: 연필 속도선 ──
    if (snake.b) {
      const glowAlpha = 0.15 + Math.sin(boostGlowPhase) * 0.1;
      ctx.save();
      ctx.globalAlpha = glowAlpha;
      ctx.strokeStyle = PENCIL_DARK;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 6]);
      ctx.lineCap = 'round';
      drawSmoothPath(ctx, screenPts);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // ghost 효과: 반투명
    const hasGhost = snake.e && snake.e.some((_v, i) => i % 2 === 0 && snake.e![i] === 2);
    if (hasGhost) {
      ctx.save();
      ctx.globalAlpha = 0.4;
    }

    const tailEffect = skin.tailEffect ?? 'none';
    const outlineColor = PENCIL_DARK; // 검정 아웃라인 — 손그림 느낌
    const strokeW = Math.max(1.5, 2 * cam.zoom);

    // ── 1) 검은 아웃라인 먼저 (두꺼운) ──
    const outlineThickness = thickness + 4 * cam.zoom;
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = outlineThickness;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    drawSmoothPath(ctx, screenPts);
    ctx.stroke();

    // ── 2) 색상 바디 위에 (아웃라인보다 얇게 → 가장자리에 검은색 보임) ──
    const pattern = skin.pattern ?? 'solid';
    if (pattern === 'striped') {
      for (let i = 0; i < screenPts.length - 1; i++) {
        const color = Math.floor(i / 3) % 2 === 0 ? skin.primaryColor : skin.secondaryColor;
        const alpha = tailEffect === 'fade' ? 1 - (i / screenPts.length) * 0.7 : 1;
        ctx.save();
        ctx.globalAlpha *= alpha;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(screenPts[i].x, screenPts[i].y, thickness * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    } else if (pattern === 'gradient') {
      for (let i = 0; i < screenPts.length; i++) {
        const t = screenPts.length > 1 ? i / (screenPts.length - 1) : 0;
        const alpha = tailEffect === 'fade' ? 1 - t * 0.7 : 1;
        ctx.save();
        ctx.globalAlpha *= alpha;
        ctx.fillStyle = lerpColor(skin.primaryColor, skin.secondaryColor, t);
        ctx.beginPath();
        ctx.arc(screenPts[i].x, screenPts[i].y, thickness * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    } else {
      // solid + dotted
      ctx.strokeStyle = skin.primaryColor;
      ctx.lineWidth = thickness;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      drawSmoothPath(ctx, screenPts);
      ctx.stroke();

      if (pattern === 'dotted') {
        ctx.fillStyle = skin.secondaryColor;
        for (let i = 0; i < screenPts.length; i += 4) {
          ctx.beginPath();
          ctx.arc(screenPts[i].x, screenPts[i].y, thickness * 0.18, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // ── 꼬리 이펙트: spark (연필 십자) ──
    if (tailEffect === 'spark' && screenPts.length > 1) {
      const tail = screenPts[screenPts.length - 1];
      ctx.save();
      ctx.strokeStyle = PENCIL_DARK;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.3;
      for (let i = 0; i < 3; i++) {
        const sparkX = tail.x + (seededRandom(snakeSeed + i * 10) - 0.5) * thickness;
        const sparkY = tail.y + (seededRandom(snakeSeed + i * 10 + 5) - 0.5) * thickness;
        const s = 3 * cam.zoom;
        ctx.beginPath();
        ctx.moveTo(sparkX - s, sparkY);
        ctx.lineTo(sparkX + s, sparkY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(sparkX, sparkY - s);
        ctx.lineTo(sparkX, sparkY + s);
        ctx.stroke();
      }
      ctx.restore();
    }

    // ── 꼬리 이펙트: trail (연필 잔상) ──
    if (tailEffect === 'trail' && screenPts.length > 3) {
      ctx.save();
      const tail = screenPts[screenPts.length - 1];
      const prevTail = screenPts[Math.max(0, screenPts.length - 2)];
      const dx = tail.x - prevTail.x;
      const dy = tail.y - prevTail.y;
      for (let j = 1; j <= 3; j++) {
        ctx.globalAlpha = 0.08 / j;
        ctx.strokeStyle = PENCIL_DARK;
        ctx.lineWidth = 1;
        wobblyCirclePath(ctx, tail.x + dx * j, tail.y + dy * j, thickness * 0.3, snakeSeed + j * 50, 6);
        ctx.stroke();
      }
      ctx.restore();
    }

    // ── 꼬리 이펙트: bubble (연필 원) — now 파라미터 사용 ──
    if (tailEffect === 'bubble' && screenPts.length > 2) {
      ctx.save();
      const tail = screenPts[screenPts.length - 1];
      ctx.strokeStyle = PENCIL_DARK;
      ctx.lineWidth = 0.8;
      ctx.globalAlpha = 0.15;
      for (let j = 0; j < 4; j++) {
        const seed = snakeSeed + j * 37;
        const ox = Math.sin(seed + now * 0.003) * thickness * 0.8;
        const oy = Math.cos(seed * 1.5 + now * 0.002) * thickness * 0.6;
        const bubbleR = (2 + seededRandom(seed) * 2) * cam.zoom;
        wobblyCirclePath(ctx, tail.x + ox, tail.y + oy, bubbleR, seed + 500, 6);
        ctx.stroke();
      }
      ctx.restore();
    }

    // ── 머리 (플랫 fill + 손그림 stroke 아웃라인) ──
    const headR = thickness * 0.6;
    const headShape = skin.headShape ?? 'round';

    if (headShape === 'diamond') {
      ctx.save();
      ctx.translate(head.x, head.y);
      ctx.rotate(snake.h);
      const s = 1.15; // 아웃라인 확대 배율
      ctx.fillStyle = outlineColor;
      ctx.beginPath();
      ctx.moveTo(headR * 1.3 * s, 0);
      ctx.quadraticCurveTo(headR * 0.3 * s, headR * 0.8 * s, 0, headR * 0.8 * s);
      ctx.quadraticCurveTo(-headR * 0.5 * s, headR * 0.3 * s, -headR * 0.4 * s, 0);
      ctx.quadraticCurveTo(-headR * 0.5 * s, -headR * 0.3 * s, 0, -headR * 0.8 * s);
      ctx.quadraticCurveTo(headR * 0.3 * s, -headR * 0.8 * s, headR * 1.3 * s, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = skin.primaryColor;
      ctx.beginPath();
      ctx.moveTo(headR * 1.3, 0);
      ctx.quadraticCurveTo(headR * 0.3, headR * 0.8, 0, headR * 0.8);
      ctx.quadraticCurveTo(-headR * 0.5, headR * 0.3, -headR * 0.4, 0);
      ctx.quadraticCurveTo(-headR * 0.5, -headR * 0.3, 0, -headR * 0.8);
      ctx.quadraticCurveTo(headR * 0.3, -headR * 0.8, headR * 1.3, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else if (headShape === 'arrow') {
      ctx.save();
      ctx.translate(head.x, head.y);
      ctx.rotate(snake.h);
      const s = 1.15;
      ctx.fillStyle = outlineColor;
      ctx.beginPath();
      ctx.moveTo(headR * 1.5 * s, 0);
      ctx.quadraticCurveTo(headR * 0.2 * s, headR * 0.9 * s, -headR * 0.3 * s, headR * 0.7 * s);
      ctx.quadraticCurveTo(headR * 0.1 * s, 0, -headR * 0.3 * s, -headR * 0.7 * s);
      ctx.quadraticCurveTo(headR * 0.2 * s, -headR * 0.9 * s, headR * 1.5 * s, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = skin.primaryColor;
      ctx.beginPath();
      ctx.moveTo(headR * 1.5, 0);
      ctx.quadraticCurveTo(headR * 0.2, headR * 0.9, -headR * 0.3, headR * 0.7);
      ctx.quadraticCurveTo(headR * 0.1, 0, -headR * 0.3, -headR * 0.7);
      ctx.quadraticCurveTo(headR * 0.2, -headR * 0.9, headR * 1.5, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else {
      // round — 아웃라인 원 먼저 → 색상 원 위에
      ctx.fillStyle = outlineColor;
      ctx.beginPath();
      ctx.arc(head.x, head.y, headR + 2 * cam.zoom, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = skin.primaryColor;
      ctx.beginPath();
      ctx.arc(head.x, head.y, headR, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── 눈 (연필 스타일 — 반짝 하이라이트 제거) ──
    drawEyes(ctx, head, thickness, snake.h, skin.eyeStyle, cam.zoom, snakeSeed);

    // ghost 효과 복원
    if (hasGhost) ctx.restore();

    // ── speed 효과: 연필 속도선 ──
    const hasSpeed = snake.e && snake.e.some((_v, i) => i % 2 === 0 && snake.e![i] === 1);
    if (hasSpeed) {
      ctx.save();
      ctx.strokeStyle = PENCIL_DARK;
      ctx.lineWidth = 1 * cam.zoom;
      ctx.globalAlpha = 0.3;
      for (let i = 0; i < 3; i++) {
        const angle = snake.h + Math.PI + (i - 1) * 0.4;
        const startX = head.x + Math.cos(angle) * headR * 1.2;
        const startY = head.y + Math.sin(angle) * headR * 1.2;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(startX + Math.cos(angle) * thickness, startY + Math.sin(angle) * thickness);
        ctx.stroke();
      }
      ctx.restore();
    }

    // ── magnet 효과: 연필 점선 필드 ──
    const hasMagnet = snake.e && snake.e.some((_v, i) => i % 2 === 0 && snake.e![i] === 0);
    if (hasMagnet) {
      ctx.save();
      ctx.strokeStyle = 'rgba(58, 48, 40, 0.15)';
      ctx.lineWidth = 1.5 * cam.zoom;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(head.x, head.y, 200 * cam.zoom, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // ── 이름 (종이색 아웃라인 + 연필 텍스트) ──
    const fontSize = Math.max(12, 14 * cam.zoom);
    ctx.font = `bold ${fontSize}px "Patrick Hand", "Inter", sans-serif`;
    ctx.textAlign = 'center';
    // 종이색 아웃라인
    ctx.lineWidth = 3;
    ctx.strokeStyle = PAPER;
    ctx.lineJoin = 'round';
    ctx.strokeText(snake.n, head.x, head.y - thickness - 10 * cam.zoom);
    ctx.fillStyle = isMe ? '#D4914A' : PENCIL_DARK;
    ctx.fillText(snake.n, head.x, head.y - thickness - 10 * cam.zoom);
  }
}

/** 손그림 귀여운 눈 — 큰 흰자 + 동공 + 하이라이트 점 */
function drawEyes(
  ctx: CanvasRenderingContext2D,
  head: { x: number; y: number },
  thickness: number,
  angle: number,
  eyeStyle: string,
  zoom: number,
  _snakeSeed: number,
): void {
  const eyeR = thickness * 0.38;
  const eyeOff = thickness * 0.3;
  const perpX = -Math.sin(angle);
  const perpY = Math.cos(angle);
  const fwdX = Math.cos(angle);
  const fwdY = Math.sin(angle);

  const eyeBaseX = head.x + fwdX * thickness * 0.18;
  const eyeBaseY = head.y + fwdY * thickness * 0.18;

  const leftEyeX = eyeBaseX + perpX * eyeOff;
  const leftEyeY = eyeBaseY + perpY * eyeOff;
  const rightEyeX = eyeBaseX - perpX * eyeOff;
  const rightEyeY = eyeBaseY - perpY * eyeOff;

  const pupilDx = fwdX * eyeR * 0.15;
  const pupilDy = fwdY * eyeR * 0.15;
  const sw = Math.max(1.2, 1.5 * zoom);

  // ── dot 눈: 큰 귀여운 점 ──
  if (eyeStyle === 'dot') {
    ctx.fillStyle = PENCIL_DARK;
    ctx.beginPath();
    ctx.arc(leftEyeX + pupilDx, leftEyeY + pupilDy, eyeR * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(rightEyeX + pupilDx, rightEyeY + pupilDy, eyeR * 0.55, 0, Math.PI * 2);
    ctx.fill();
    // 하이라이트 점 (귀여움 포인트)
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(leftEyeX + pupilDx - eyeR * 0.15, leftEyeY + pupilDy - eyeR * 0.15, eyeR * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(rightEyeX + pupilDx - eyeR * 0.15, rightEyeY + pupilDy - eyeR * 0.15, eyeR * 0.18, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  // ── wink 눈: 큰 왼쪽 + ^자 오른쪽 ──
  if (eyeStyle === 'wink') {
    // 왼쪽: 큰 흰자 + 동공
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(leftEyeX, leftEyeY, eyeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PENCIL_DARK;
    ctx.lineWidth = sw;
    ctx.stroke();
    ctx.fillStyle = PENCIL_DARK;
    ctx.beginPath();
    ctx.arc(leftEyeX + pupilDx, leftEyeY + pupilDy, eyeR * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(leftEyeX + pupilDx - eyeR * 0.12, leftEyeY + pupilDy - eyeR * 0.15, eyeR * 0.16, 0, Math.PI * 2);
    ctx.fill();

    // 오른쪽: ^자 (감은 눈)
    ctx.strokeStyle = PENCIL_DARK;
    ctx.lineWidth = sw * 1.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(rightEyeX - eyeR * 0.6, rightEyeY + eyeR * 0.15);
    ctx.quadraticCurveTo(rightEyeX, rightEyeY - eyeR * 0.5, rightEyeX + eyeR * 0.6, rightEyeY + eyeR * 0.15);
    ctx.stroke();
    return;
  }

  // ── 기본 눈 (default/angry/cute/cool) ──
  for (const [ex, ey] of [[leftEyeX, leftEyeY], [rightEyeX, rightEyeY]]) {
    // 큰 흰자
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(ex, ey, eyeR, 0, Math.PI * 2);
    ctx.fill();
    // 손그림 아웃라인
    ctx.strokeStyle = PENCIL_DARK;
    ctx.lineWidth = sw;
    ctx.stroke();

    // 동공
    ctx.fillStyle = PENCIL_DARK;
    ctx.beginPath();
    ctx.arc(ex + pupilDx, ey + pupilDy, eyeR * 0.5, 0, Math.PI * 2);
    ctx.fill();

    // 하이라이트 점 (귀여움)
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(ex + pupilDx - eyeR * 0.12, ey + pupilDy - eyeR * 0.15, eyeR * 0.16, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── 눈 스타일별 추가 ──
  if (eyeStyle === 'angry') {
    ctx.strokeStyle = PENCIL_DARK;
    ctx.lineWidth = sw * 1.5;
    ctx.lineCap = 'round';
    for (const [ex, ey, side] of [[leftEyeX, leftEyeY, 1], [rightEyeX, rightEyeY, -1]] as const) {
      ctx.beginPath();
      ctx.moveTo(ex - perpX * eyeR * 0.7 * (side as number), ey - perpY * eyeR * 0.7 * (side as number) - eyeR * 1.0);
      ctx.lineTo(ex + perpX * eyeR * 0.4 * (side as number), ey + perpY * eyeR * 0.4 * (side as number) - eyeR * 1.3);
      ctx.stroke();
    }
  } else if (eyeStyle === 'cute') {
    // 더 큰 하이라이트 — 반짝반짝
    ctx.fillStyle = '#FFFFFF';
    for (const [ex, ey] of [[leftEyeX, leftEyeY], [rightEyeX, rightEyeY]]) {
      ctx.beginPath();
      ctx.arc(ex + pupilDx - eyeR * 0.15, ey + pupilDy - eyeR * 0.2, eyeR * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (eyeStyle === 'cool') {
    // 선글라스 — 반원 덮기
    for (const [ex, ey] of [[leftEyeX, leftEyeY], [rightEyeX, rightEyeY]]) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(ex, ey, eyeR + 1, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = PENCIL_DARK;
      ctx.fillRect(ex - eyeR - 2, ey - eyeR - 2, (eyeR + 2) * 2, eyeR * 0.9);
      ctx.restore();
    }
    // 선글라스 브릿지
    ctx.strokeStyle = PENCIL_DARK;
    ctx.lineWidth = sw;
    ctx.beginPath();
    ctx.moveTo(leftEyeX + eyeR * 0.3, leftEyeY - eyeR * 0.3);
    ctx.lineTo(rightEyeX - eyeR * 0.3, rightEyeY - eyeR * 0.3);
    ctx.stroke();
  }
}

/** hex 색상을 어둡게 */
function darkenColor(hex: string, amount: number): string {
  const h = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.round(((h >> 16) & 0xff) * (1 - amount)));
  const g = Math.max(0, Math.round(((h >> 8) & 0xff) * (1 - amount)));
  const b = Math.max(0, Math.round((h & 0xff) * (1 - amount)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** hex 색상 선형 보간 */
function lerpColor(a: string, b: string, t: number): string {
  const ah = parseInt(a.slice(1), 16);
  const bh = parseInt(b.slice(1), 16);
  const ar = (ah >> 16) & 0xff, ag = (ah >> 8) & 0xff, ab = ah & 0xff;
  const br = (bh >> 16) & 0xff, bg = (bh >> 8) & 0xff, bb = bh & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bVal = Math.round(ab + (bb - ab) * t);
  return `#${((r << 16) | (g << 8) | bVal).toString(16).padStart(6, '0')}`;
}

/** 부드러운 경로 그리기 */
function drawSmoothPath(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[]): void {
  if (pts.length < 2) return;

  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);

  if (pts.length === 2) {
    ctx.lineTo(pts[1].x, pts[1].y);
    return;
  }

  const midX = (pts[0].x + pts[1].x) / 2;
  const midY = (pts[0].y + pts[1].y) / 2;
  ctx.lineTo(midX, midY);

  for (let i = 1; i < pts.length - 1; i++) {
    const cpx = pts[i].x;
    const cpy = pts[i].y;
    const nextMidX = (pts[i].x + pts[i + 1].x) / 2;
    const nextMidY = (pts[i].y + pts[i + 1].y) / 2;
    ctx.quadraticCurveTo(cpx, cpy, nextMidX, nextMidY);
  }

  const last = pts[pts.length - 1];
  ctx.lineTo(last.x, last.y);
}
