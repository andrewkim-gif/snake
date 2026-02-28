/**
 * Entity 렌더링 — Brawl Stars 스타일
 * 두꺼운 블랙 아웃라인 + 비비드 컬러 + 카툰 눈 + 오브 하이라이트
 */

import type { SnakeNetworkData, OrbNetworkData } from '@snake-arena/shared';
import { ORB_COLORS, COLORS, DEFAULT_SKINS, ARENA_CONFIG } from '@snake-arena/shared';
import type { Camera } from './types';

/* ─── Orb 렌더링 (다양한 모양 + 블랙 아웃라인 + 하이라이트) ─── */

// 오브 모양: colorIdx 기반 결정
const ORB_SHAPES = [
  'circle', 'diamond', 'star4', 'hex',
  'circle', 'diamond', 'star4', 'hex',
  'circle', 'diamond', 'star4', 'hex',
] as const;
type OrbShape = typeof ORB_SHAPES[number];

/** 다이아몬드 경로 */
function diamondPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.moveTo(0, -r);
  ctx.lineTo(r * 0.7, 0);
  ctx.lineTo(0, r);
  ctx.lineTo(-r * 0.7, 0);
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
    const ix = Math.cos(ia) * r * 0.4;
    const iy = Math.sin(ia) * r * 0.4;
    if (i === 0) ctx.moveTo(ox, oy);
    else ctx.lineTo(ox, oy);
    ctx.lineTo(ix, iy);
  }
  ctx.closePath();
  ctx.restore();
}

/** 육각형 경로 */
function hexOrbPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    const hx = Math.cos(a) * r;
    const hy = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(hx, hy);
    else ctx.lineTo(hx, hy);
  }
  ctx.closePath();
  ctx.restore();
}

/** 오브 모양 경로 (outline/fill 공용) */
function orbShapePath(ctx: CanvasRenderingContext2D, shape: OrbShape, x: number, y: number, r: number, rot: number): void {
  switch (shape) {
    case 'diamond': diamondPath(ctx, x, y, r, rot); break;
    case 'star4':   star4Path(ctx, x, y, r, rot); break;
    case 'hex':     hexOrbPath(ctx, x, y, r, rot); break;
    default:        ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2); break;
  }
}

export function drawOrbs(
  ctx: CanvasRenderingContext2D,
  orbs: OrbNetworkData[],
  cam: Camera,
  w: number,
  h: number,
  myHeadScreen?: { x: number; y: number } | null,
  collectRadius = ARENA_CONFIG.collectRadius,
): void {
  const groups = new Map<number, Array<{ sx: number; sy: number; r: number; shape: OrbShape; rot: number }>>();
  const specialOrbs: Array<{ sx: number; sy: number; r: number; t: number }> = [];
  const attractRadius = collectRadius * cam.zoom * 2.5;
  const tick = performance.now() * 0.001; // 초 단위

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

    if (orb.t >= 3) {
      specialOrbs.push({ sx, sy, r, t: orb.t });
    } else {
      let group = groups.get(orb.c);
      if (!group) {
        group = [];
        groups.set(orb.c, group);
      }
      const shape = ORB_SHAPES[orb.c % ORB_SHAPES.length];
      // 느린 회전: 오브마다 다른 시드 (위치 기반)
      const rot = shape === 'circle' ? 0 : tick * 0.8 + (orb.x + orb.y) * 0.01;
      group.push({ sx, sy, r, shape, rot });
    }
  }

  // 일반 오브 배치 렌더링 (모양별)
  for (const [colorIdx, orbList] of groups) {
    const color = ORB_COLORS[colorIdx] ?? ORB_COLORS[0];

    // 아웃라인
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    for (const { sx, sy, r, shape, rot } of orbList) {
      orbShapePath(ctx, shape, sx, sy, r + 2, rot);
    }
    ctx.fill();

    // 메인 색상
    ctx.fillStyle = color;
    ctx.beginPath();
    for (const { sx, sy, r, shape, rot } of orbList) {
      orbShapePath(ctx, shape, sx, sy, r, rot);
    }
    ctx.fill();

    // 하이라이트 반사
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    for (const { sx, sy, r } of orbList) {
      if (r > 2) {
        ctx.moveTo(sx - r * 0.15 + r * 0.28, sy - r * 0.25);
        ctx.arc(sx - r * 0.15, sy - r * 0.25, r * 0.28, 0, Math.PI * 2);
      }
    }
    ctx.fill();
  }

  // 특수 오브 개별 렌더링
  const tickFast = performance.now() * 0.06;
  for (const { sx, sy, r, t } of specialOrbs) {
    const color = ORB_COLORS[t === 3 ? 12 : t === 4 ? 13 : t === 5 ? 14 : 15] ?? '#FFFFFF';

    ctx.save();
    const baseAlpha = t === 5 ? 0.5 + Math.sin(tickFast * 0.15) * 0.2 : 1;
    ctx.globalAlpha = baseAlpha;

    // 글로우 링
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = baseAlpha * 0.4;
    ctx.beginPath();
    ctx.arc(sx, sy, r * 2.2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = baseAlpha;

    // 아웃라인
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(sx, sy, r + 2, 0, Math.PI * 2);
    ctx.fill();

    // 메인 (mega = 회전 별)
    if (t === 6) {
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
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // magnet 자기장 아크
    if (t === 3) {
      ctx.strokeStyle = 'rgba(147, 51, 234, 0.5)';
      ctx.lineWidth = 1.5;
      const magnetAngle = tickFast * 0.08;
      ctx.beginPath();
      ctx.arc(sx, sy, r * 2.5, magnetAngle, magnetAngle + Math.PI * 1.5);
      ctx.stroke();
    }

    // speed 번개 글로우
    if (t === 4) {
      ctx.save();
      ctx.shadowColor = '#FFD700';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(sx, sy, r * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 하이라이트
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.beginPath();
    ctx.arc(sx - r * 0.2, sy - r * 0.3, r * 0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

/* ─── Snake 렌더링 (Brawl Stars Chunky Style) ─── */

let boostGlowPhase = 0;

export function drawSnakes(
  ctx: CanvasRenderingContext2D,
  snakes: SnakeNetworkData[],
  cam: Camera,
  w: number,
  h: number,
  myId: string | null,
  dt = 0.016,
): void {
  boostGlowPhase = (boostGlowPhase + dt * 6) % (Math.PI * 2);
  const halfW = w / 2;
  const halfH = h / 2;

  for (const snake of snakes) {
    if (snake.p.length < 2) continue;

    const skin = DEFAULT_SKINS[snake.k % DEFAULT_SKINS.length];
    // 더 두꺼운 뱀 (Brawl Stars 스타일)
    const thickness = Math.max(10, 5 + Math.pow(snake.m, 0.6) * 1.5) * cam.zoom;
    const outlineWidth = thickness + 6 * cam.zoom;
    const isMe = snake.i === myId;

    const screenPts: { x: number; y: number }[] = snake.p.map(([px, py]) => ({
      x: (px - cam.x) * cam.zoom + halfW,
      y: (py - cam.y) * cam.zoom + halfH,
    }));

    const head = screenPts[0];

    // ── 부스트 글로우 (더 극적인 이펙트) ──
    if (snake.b) {
      const glowAlpha = 0.25 + Math.sin(boostGlowPhase) * 0.2;
      ctx.save();
      ctx.globalAlpha = glowAlpha;
      ctx.strokeStyle = skin.primaryColor;
      ctx.lineWidth = thickness * 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      drawSmoothPath(ctx, screenPts);
      ctx.stroke();
      ctx.restore();
    }

    // ghost 효과: 전체 반투명
    const hasGhost = snake.e && snake.e.some((_v, i) => i % 2 === 0 && snake.e![i] === 2);
    if (hasGhost) {
      ctx.save();
      ctx.globalAlpha = 0.35;
    }

    // ── 꼬리 이펙트: fade (alpha 1→0.3) ──
    const tailEffect = skin.tailEffect ?? 'none';

    // ── 1) 블랙 아웃라인 (가장 바깥) ──
    ctx.strokeStyle = COLORS.ENTITY_OUTLINE;
    ctx.lineWidth = outlineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    drawSmoothPath(ctx, screenPts);
    ctx.stroke();

    // ── 2) 바디 패턴별 렌더링 ──
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
      // solid + dotted: 기존 smooth path 방식
      ctx.strokeStyle = skin.primaryColor;
      ctx.lineWidth = thickness;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      drawSmoothPath(ctx, screenPts);
      ctx.stroke();

      if (snake.p.length > 2) {
        ctx.strokeStyle = skin.secondaryColor;
        ctx.lineWidth = thickness * 0.35;
        drawSmoothPath(ctx, screenPts);
        ctx.stroke();
      }

      // dotted 패턴: 점 오버레이
      if (pattern === 'dotted') {
        ctx.fillStyle = skin.secondaryColor;
        for (let i = 0; i < screenPts.length; i += 4) {
          ctx.beginPath();
          ctx.arc(screenPts[i].x, screenPts[i].y, thickness * 0.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // ── 꼬리 이펙트: spark ──
    if (tailEffect === 'spark' && screenPts.length > 1) {
      const tail = screenPts[screenPts.length - 1];
      ctx.save();
      for (let i = 0; i < 3; i++) {
        const sparkX = tail.x + (Math.random() - 0.5) * thickness;
        const sparkY = tail.y + (Math.random() - 0.5) * thickness;
        ctx.fillStyle = skin.accentColor ?? skin.primaryColor;
        ctx.globalAlpha = 0.6 + Math.random() * 0.4;
        ctx.beginPath();
        ctx.arc(sparkX, sparkY, 2 * cam.zoom, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // ── 꼬리 이펙트: trail (잔상) ──
    if (tailEffect === 'trail' && screenPts.length > 3) {
      ctx.save();
      for (let j = 1; j <= 3; j++) {
        const idx = screenPts.length - 1 + j * 2;
        if (idx >= screenPts.length) {
          const tail = screenPts[screenPts.length - 1];
          const prevTail = screenPts[Math.max(0, screenPts.length - 2)];
          const dx = tail.x - prevTail.x;
          const dy = tail.y - prevTail.y;
          ctx.globalAlpha = 0.15 / j;
          ctx.fillStyle = skin.primaryColor;
          ctx.beginPath();
          ctx.arc(tail.x + dx * j, tail.y + dy * j, thickness * 0.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // ── 머리 모양 ──
    const headR = thickness * 0.55;
    const headShape = skin.headShape ?? 'round';
    ctx.fillStyle = COLORS.ENTITY_OUTLINE;

    if (headShape === 'diamond') {
      ctx.save();
      ctx.translate(head.x, head.y);
      ctx.rotate(snake.h);
      ctx.beginPath();
      ctx.moveTo(headR * 1.4, 0);
      ctx.lineTo(0, headR * 0.9);
      ctx.lineTo(-headR * 0.5, 0);
      ctx.lineTo(0, -headR * 0.9);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = skin.primaryColor;
      const s = 0.8;
      ctx.beginPath();
      ctx.moveTo(headR * 1.4 * s, 0);
      ctx.lineTo(0, headR * 0.9 * s);
      ctx.lineTo(-headR * 0.5 * s, 0);
      ctx.lineTo(0, -headR * 0.9 * s);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else if (headShape === 'arrow') {
      ctx.save();
      ctx.translate(head.x, head.y);
      ctx.rotate(snake.h);
      ctx.beginPath();
      ctx.moveTo(headR * 1.6, 0);
      ctx.lineTo(-headR * 0.3, headR);
      ctx.lineTo(headR * 0.1, 0);
      ctx.lineTo(-headR * 0.3, -headR);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = skin.primaryColor;
      const s = 0.75;
      ctx.beginPath();
      ctx.moveTo(headR * 1.6 * s, 0);
      ctx.lineTo(-headR * 0.3 * s, headR * s);
      ctx.lineTo(headR * 0.1 * s, 0);
      ctx.lineTo(-headR * 0.3 * s, -headR * s);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(head.x, head.y, headR + 3 * cam.zoom, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = skin.primaryColor;
      ctx.beginPath();
      ctx.arc(head.x, head.y, headR, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── 눈 ──
    drawEyes(ctx, head, thickness, snake.h, skin.eyeStyle, cam.zoom);

    // ghost 효과 복원
    if (hasGhost) ctx.restore();

    // ── speed 효과: 속도선 ──
    const hasSpeed = snake.e && snake.e.some((_v, i) => i % 2 === 0 && snake.e![i] === 1);
    if (hasSpeed) {
      ctx.save();
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.5)';
      ctx.lineWidth = 1.5 * cam.zoom;
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

    // ── magnet 효과: 보라 필드 ──
    const hasMagnet = snake.e && snake.e.some((_v, i) => i % 2 === 0 && snake.e![i] === 0);
    if (hasMagnet) {
      ctx.save();
      ctx.strokeStyle = 'rgba(147, 51, 234, 0.25)';
      ctx.lineWidth = 2 * cam.zoom;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(head.x, head.y, 200 * cam.zoom, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // ── 이름 (블랙 텍스트 아웃라인) ──
    const fontSize = Math.max(12, 14 * cam.zoom);
    ctx.font = `bold ${fontSize}px "Inter", sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#000000';
    ctx.lineJoin = 'round';
    ctx.strokeText(snake.n, head.x, head.y - thickness - 10 * cam.zoom);
    ctx.fillStyle = isMe ? COLORS.LEADERBOARD_SELF : '#FFFFFF';
    ctx.fillText(snake.n, head.x, head.y - thickness - 10 * cam.zoom);
  }
}

/** Brawl Stars 스타일 카툰 눈 */
function drawEyes(
  ctx: CanvasRenderingContext2D,
  head: { x: number; y: number },
  thickness: number,
  angle: number,
  eyeStyle: string,
  zoom: number,
): void {
  const eyeR = thickness * 0.38;
  const eyeOff = thickness * 0.3;
  const perpX = -Math.sin(angle);
  const perpY = Math.cos(angle);
  const fwdX = Math.cos(angle);
  const fwdY = Math.sin(angle);

  // 눈 위치 (약간 앞쪽으로)
  const eyeBaseX = head.x + fwdX * thickness * 0.15;
  const eyeBaseY = head.y + fwdY * thickness * 0.15;

  const leftEyeX = eyeBaseX + perpX * eyeOff;
  const leftEyeY = eyeBaseY + perpY * eyeOff;
  const rightEyeX = eyeBaseX - perpX * eyeOff;
  const rightEyeY = eyeBaseY - perpY * eyeOff;

  const pupilDx = fwdX * eyeR * 0.25;
  const pupilDy = fwdY * eyeR * 0.25;

  for (const [ex, ey] of [[leftEyeX, leftEyeY], [rightEyeX, rightEyeY]]) {
    // 블랙 아웃라인
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(ex, ey, eyeR + 2 * zoom, 0, Math.PI * 2);
    ctx.fill();

    // 흰자
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(ex, ey, eyeR, 0, Math.PI * 2);
    ctx.fill();

    // 동공
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(ex + pupilDx, ey + pupilDy, eyeR * 0.5, 0, Math.PI * 2);
    ctx.fill();

    // 하이라이트 반사
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(ex + pupilDx - eyeR * 0.15, ey + pupilDy - eyeR * 0.2, eyeR * 0.18, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── 눈 스타일별 추가 장식 ──
  if (eyeStyle === 'angry') {
    // 화난 눈썹 (V 모양)
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3 * zoom;
    ctx.lineCap = 'round';
    for (const [ex, ey, side] of [[leftEyeX, leftEyeY, 1], [rightEyeX, rightEyeY, -1]] as const) {
      ctx.beginPath();
      ctx.moveTo(ex - perpX * eyeR * 0.8 * (side as number), ey - perpY * eyeR * 0.8 * (side as number) - eyeR * 1.1);
      ctx.lineTo(ex + perpX * eyeR * 0.5 * (side as number), ey + perpY * eyeR * 0.5 * (side as number) - eyeR * 1.5);
      ctx.stroke();
    }
  } else if (eyeStyle === 'cute') {
    // 반짝이는 큰 하이라이트
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    for (const [ex, ey] of [[leftEyeX, leftEyeY], [rightEyeX, rightEyeY]]) {
      ctx.beginPath();
      ctx.arc(ex - eyeR * 0.2, ey - eyeR * 0.2, eyeR * 0.28, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (eyeStyle === 'cool') {
    // 반쪽 감은 눈꺼풀
    ctx.fillStyle = skin_primaryFromEyeCtx(ctx) || '#000000';
    for (const [ex, ey] of [[leftEyeX, leftEyeY], [rightEyeX, rightEyeY]]) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(ex, ey, eyeR + 1, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = '#000000';
      ctx.fillRect(ex - eyeR - 2, ey - eyeR - 2, (eyeR + 2) * 2, eyeR * 0.9);
      ctx.restore();
    }
  }
}

/** cool 눈꺼풀용 — ctx에서 뱀 색상 가져오기 (fallback) */
function skin_primaryFromEyeCtx(_ctx: CanvasRenderingContext2D): string | null {
  return null;
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

/**
 * 부드러운 경로 그리기 — 연속 세그먼트를 quadraticCurveTo로 연결
 */
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
