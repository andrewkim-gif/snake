/**
 * Entity 렌더링 — Brawl Stars 스타일
 * 두꺼운 블랙 아웃라인 + 비비드 컬러 + 카툰 눈 + 오브 하이라이트
 */

import type { SnakeNetworkData, OrbNetworkData } from '@snake-arena/shared';
import { ORB_COLORS, COLORS, DEFAULT_SKINS, ARENA_CONFIG } from '@snake-arena/shared';
import type { Camera } from './types';

/* ─── Orb 렌더링 (블랙 아웃라인 + 하이라이트) ─── */

export function drawOrbs(
  ctx: CanvasRenderingContext2D,
  orbs: OrbNetworkData[],
  cam: Camera,
  w: number,
  h: number,
  myHeadScreen?: { x: number; y: number } | null,
  collectRadius = ARENA_CONFIG.collectRadius,
): void {
  const groups = new Map<number, Array<{ sx: number; sy: number; r: number }>>();
  const attractRadius = collectRadius * cam.zoom * 2.5;

  for (const orb of orbs) {
    let sx = (orb.x - cam.x) * cam.zoom + w / 2;
    let sy = (orb.y - cam.y) * cam.zoom + h / 2;
    if (sx < -20 || sx > w + 20 || sy < -20 || sy > h + 20) continue;

    const r = (3 + orb.v * 0.6) * cam.zoom;

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

    let group = groups.get(orb.c);
    if (!group) {
      group = [];
      groups.set(orb.c, group);
    }
    group.push({ sx, sy, r });
  }

  for (const [colorIdx, orbList] of groups) {
    const color = ORB_COLORS[colorIdx % ORB_COLORS.length];

    // 블랙 아웃라인
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    for (const { sx, sy, r } of orbList) {
      ctx.moveTo(sx + r + 2, sy);
      ctx.arc(sx, sy, r + 2, 0, Math.PI * 2);
    }
    ctx.fill();

    // 메인 컬러
    ctx.fillStyle = color;
    ctx.beginPath();
    for (const { sx, sy, r } of orbList) {
      ctx.moveTo(sx + r, sy);
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
    }
    ctx.fill();

    // 하이라이트 (상단 왼쪽 광택)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    for (const { sx, sy, r } of orbList) {
      if (r > 2) {
        ctx.moveTo(sx - r * 0.2 + r * 0.3, sy - r * 0.3);
        ctx.arc(sx - r * 0.2, sy - r * 0.3, r * 0.3, 0, Math.PI * 2);
      }
    }
    ctx.fill();
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

    // ── 1) 블랙 아웃라인 (가장 바깥) ──
    ctx.strokeStyle = COLORS.ENTITY_OUTLINE;
    ctx.lineWidth = outlineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    drawSmoothPath(ctx, screenPts);
    ctx.stroke();

    // ── 2) 메인 바디 컬러 ──
    ctx.strokeStyle = skin.primaryColor;
    ctx.lineWidth = thickness;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    drawSmoothPath(ctx, screenPts);
    ctx.stroke();

    // ── 3) 내부 하이라이트 라인 ──
    if (snake.p.length > 2) {
      ctx.strokeStyle = skin.secondaryColor;
      ctx.lineWidth = thickness * 0.35;
      drawSmoothPath(ctx, screenPts);
      ctx.stroke();
    }

    // ── 머리 강조 (큰 원) ──
    const headR = thickness * 0.55;
    // 블랙 아웃라인
    ctx.fillStyle = COLORS.ENTITY_OUTLINE;
    ctx.beginPath();
    ctx.arc(head.x, head.y, headR + 3 * cam.zoom, 0, Math.PI * 2);
    ctx.fill();
    // 컬러 머리
    ctx.fillStyle = skin.primaryColor;
    ctx.beginPath();
    ctx.arc(head.x, head.y, headR, 0, Math.PI * 2);
    ctx.fill();

    // ── 눈 (Brawl Stars 큰 카툰 눈 + 아웃라인) ──
    drawEyes(ctx, head, thickness, snake.h, skin.eyeStyle, cam.zoom);

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
