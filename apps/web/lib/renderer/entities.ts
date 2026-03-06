/**
 * Entity 렌더링 — Agent Survivor v10
 * 뱀 세그먼트 → Agent 단일 캐릭터 렌더링
 * 16x16 MC 스타일 2D 블록 캐릭터 + Aura + HP 바 + 이름표
 */

import type { AgentNetworkData, OrbNetworkData, MapObjectNetworkData } from '@agent-survivor/shared';
import { ORB_COLORS, DEFAULT_SKINS, ARENA_CONFIG } from '@agent-survivor/shared';
import type { Camera } from './types';
import { getAgentSprite } from '../sprites';

// ─── Seeded Random ───
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49271;
  return x - Math.floor(x);
}

// ─── 색상 상수 ───
const PENCIL_DARK = '#3A3028';
const PAPER = '#F5F0E8';

/* ─── Orb 형상 ─── */

const ORB_SHAPES = [
  'circle', 'heart', 'star4', 'diamond',
  'circle', 'heart', 'star4', 'diamond',
  'circle', 'heart', 'star4', 'diamond',
] as const;
type OrbShape = typeof ORB_SHAPES[number];

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

function orbShapePath(ctx: CanvasRenderingContext2D, shape: OrbShape, x: number, y: number, r: number, rot: number): void {
  switch (shape) {
    case 'heart':   heartPath(ctx, x, y, r, rot); break;
    case 'star4':   star4Path(ctx, x, y, r, rot); break;
    case 'diamond': diamondPath(ctx, x, y, r, rot); break;
    default:        ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2); break;
  }
}

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
      if (!group) { group = []; groups.set(orb.c, group); }
      const shape = ORB_SHAPES[orb.c % ORB_SHAPES.length];
      const rot = shape === 'circle' ? 0 : tick * 0.5 + (orb.x + orb.y) * 0.01;
      group.push({ sx, sy, r, shape, rot, seed: orbSeed });
    }
  }

  // 일반 오브 배치 렌더링
  for (const [colorIdx, orbList] of groups) {
    const color = ORB_COLORS[colorIdx] ?? ORB_COLORS[0];
    ctx.fillStyle = color;
    ctx.beginPath();
    for (const { sx, sy, r, shape, rot } of orbList) {
      orbShapePath(ctx, shape, sx, sy, r, rot);
    }
    ctx.fill();

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

  // 특수 오브
  const tickFast = now * 0.06;
  for (const { sx, sy, r, t, seed } of specialOrbs) {
    const color = ORB_COLORS[t === 3 ? 12 : t === 4 ? 13 : t === 5 ? 14 : 15] ?? '#C9A84C';
    ctx.save();
    const baseAlpha = t === 5 ? 0.5 + Math.sin(tickFast * 0.15) * 0.2 : 1;
    ctx.globalAlpha = baseAlpha;

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
      wobblyCirclePath(ctx, sx, sy, r, seed, 10);
      ctx.fill();
    }

    ctx.globalAlpha = baseAlpha;
    ctx.strokeStyle = PENCIL_DARK;
    ctx.lineWidth = Math.max(1.2, 1.5 * cam.zoom);
    wobblyCirclePath(ctx, sx, sy, r + 1, seed + 100, 10);
    ctx.stroke();

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
/* ─── Agent 렌더링 (v10 — 단일 캐릭터) ─── */

let boostGlowPhase = 0;

/** Mass 기반 캐릭터 크기 스케일링 */
function getAgentScale(mass: number): number {
  if (mass <= 10) return 1.0;
  if (mass <= 50) return 1.0 + (mass - 10) * 0.005;
  return 1.2 + Math.min((mass - 50) * 0.004, 0.4);
}

/** 부스트 속도선 이펙트 */
function drawBoostTrails(
  ctx: CanvasRenderingContext2D, sx: number, sy: number,
  heading: number, size: number, phase: number,
): void {
  ctx.save();
  ctx.strokeStyle = PENCIL_DARK;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.15 + Math.sin(phase) * 0.1;
  ctx.lineCap = 'round';
  const backAngle = heading + Math.PI;
  for (let i = -1; i <= 1; i++) {
    const angle = backAngle + i * 0.4;
    const startDist = size * 0.6;
    const lineLen = size * 0.6 + Math.abs(i) * size * 0.2;
    const x1 = sx + Math.cos(angle) * startDist;
    const y1 = sy + Math.sin(angle) * startDist;
    const x2 = x1 + Math.cos(angle) * lineLen;
    const y2 = y1 + Math.sin(angle) * lineLen;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.06;
  for (let j = 1; j <= 3; j++) {
    const trailX = sx + Math.cos(backAngle) * size * 0.5 * j;
    const trailY = sy + Math.sin(backAngle) * size * 0.5 * j;
    ctx.beginPath();
    ctx.arc(trailX, trailY, size * 0.3 / j, 0, Math.PI * 2);
    ctx.fillStyle = PENCIL_DARK;
    ctx.fill();
  }
  ctx.restore();
}

/** Aura 범위 시각화 */
function drawAura(
  ctx: CanvasRenderingContext2D, sx: number, sy: number,
  auraRadius: number, primaryColor: string, now: number,
): void {
  ctx.save();
  const pulse = 1 + Math.sin(now * 0.003) * 0.05;
  const r = auraRadius * pulse;
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = primaryColor;
  ctx.beginPath();
  ctx.arc(sx, sy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.2;
  ctx.strokeStyle = primaryColor;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.arc(sx, sy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

/** HP 바 (Mass 시각화) */
function drawHPBar(
  ctx: CanvasRenderingContext2D, sx: number, sy: number,
  size: number, mass: number, maxMass: number,
): void {
  const barW = size * 1.4;
  const barH = 4;
  const barX = sx - barW / 2;
  const barY = sy + size * 0.6 + 4;
  ctx.fillStyle = 'rgba(58, 48, 40, 0.3)';
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, barH, 2);
  ctx.fill();
  const ratio = Math.min(mass / maxMass, 1);
  let hpColor = '#7BA868';
  if (ratio < 0.3) hpColor = '#C75B5B';
  else if (ratio < 0.6) hpColor = '#D4C36A';
  ctx.fillStyle = hpColor;
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW * ratio, barH, 2);
  ctx.fill();
}

/** 이름표 + 레벨 배지 */
function drawNameplate(
  ctx: CanvasRenderingContext2D, sx: number, sy: number,
  size: number, name: string, level: number, isMe: boolean, zoom: number,
): void {
  const fontSize = Math.max(11, 13 * zoom);
  const nameY = sy - size * 0.6 - 10 * zoom;
  ctx.font = `bold ${fontSize}px "Patrick Hand", "Inter", sans-serif`;
  ctx.textAlign = 'center';
  ctx.lineWidth = 3;
  ctx.strokeStyle = PAPER;
  ctx.lineJoin = 'round';
  ctx.strokeText(name, sx, nameY);
  ctx.fillStyle = isMe ? '#D4914A' : PENCIL_DARK;
  ctx.fillText(name, sx, nameY);
  // 레벨 배지
  const nameWidth = ctx.measureText(name).width;
  const badgeX = sx + nameWidth / 2 + 4;
  const badgeY = nameY - fontSize * 0.3;
  ctx.font = `bold ${Math.max(8, 9 * zoom)}px "Patrick Hand", "Inter", sans-serif`;
  ctx.fillStyle = '#5B8DAD';
  ctx.textAlign = 'left';
  ctx.fillText(`Lv.${level}`, badgeX, badgeY);
}

export function drawAgents(
  ctx: CanvasRenderingContext2D,
  agents: AgentNetworkData[],
  cam: Camera,
  w: number,
  h: number,
  playerId: string | null,
  dt = 0.016,
  now = performance.now(),
): void {
  boostGlowPhase += dt * 6;
  const halfW = w / 2;
  const halfH = h / 2;

  for (const agent of agents) {
    const sx = (agent.x - cam.x) * cam.zoom + halfW;
    const sy = (agent.y - cam.y) * cam.zoom + halfH;

    // Culling
    const margin = 120 * cam.zoom;
    if (sx < -margin || sx > w + margin || sy < -margin || sy > h + margin) continue;

    const isMe = agent.i === playerId;
    const skin = DEFAULT_SKINS[agent.k % DEFAULT_SKINS.length] ?? DEFAULT_SKINS[0];
    const scale = getAgentScale(agent.m);
    const auraScreenRadius = ARENA_CONFIG.auraRadius * cam.zoom;
    const baseSize = 16 * cam.zoom;
    const size = baseSize * scale;

    // Ghost 이펙트: 반투명
    const hasGhost = agent.e && agent.e.some((_v, i) => i % 2 === 0 && agent.e![i] === 2);
    if (hasGhost) { ctx.save(); ctx.globalAlpha = 0.4; }

    // Aura 범위 시각화
    drawAura(ctx, sx, sy, auraScreenRadius, skin.primaryColor, now);

    // 부스트 이펙트
    if (agent.b) {
      drawBoostTrails(ctx, sx, sy, agent.h, size, boostGlowPhase);
      ctx.save();
      const sprite = getAgentSprite(agent.k, skin);
      const backAngle = agent.h + Math.PI;
      for (let gi = 1; gi <= 3; gi++) {
        const ghostX = sx + Math.cos(backAngle) * size * 0.4 * gi;
        const ghostY = sy + Math.sin(backAngle) * size * 0.4 * gi;
        ctx.globalAlpha = 0.12 / gi;
        ctx.save();
        ctx.translate(ghostX, ghostY);
        ctx.rotate(agent.h + Math.PI / 2);
        ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
        ctx.restore();
      }
      ctx.restore();
    }

    // Agent 캐릭터 스프라이트 렌더링
    const sprite = getAgentSprite(agent.k, skin);
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(agent.h + Math.PI / 2);
    ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
    ctx.restore();

    // 이름 + 레벨 표시
    if (hasGhost) ctx.restore();
    drawNameplate(ctx, sx, sy, size, agent.n, agent.lv ?? 1, isMe, cam.zoom);
    if (hasGhost) { ctx.save(); ctx.globalAlpha = 0.4; }

    // HP 바
    const maxMass = Math.max(agent.m, ARENA_CONFIG.initialMass * 5);
    drawHPBar(ctx, sx, sy, size, agent.m, maxMass);

    // Speed 이펙트: 속도선
    const hasSpeed = agent.e && agent.e.some((_v, i) => i % 2 === 0 && agent.e![i] === 1);
    if (hasSpeed) {
      ctx.save();
      ctx.strokeStyle = PENCIL_DARK;
      ctx.lineWidth = 1 * cam.zoom;
      ctx.globalAlpha = 0.3;
      for (let i = 0; i < 3; i++) {
        const angle = agent.h + Math.PI + (i - 1) * 0.4;
        const startX = sx + Math.cos(angle) * size * 0.6;
        const startY = sy + Math.sin(angle) * size * 0.6;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(startX + Math.cos(angle) * size, startY + Math.sin(angle) * size);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Magnet 이펙트: 점선 필드
    const hasMagnet = agent.e && agent.e.some((_v, i) => i % 2 === 0 && agent.e![i] === 0);
    if (hasMagnet) {
      const magnetR = 200 * cam.zoom;
      ctx.save();
      ctx.strokeStyle = 'rgba(212, 195, 106, 0.2)';
      ctx.lineWidth = 1.5 * cam.zoom;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(sx, sy, magnetR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.1 + Math.sin(now * 0.005) * 0.05;
      ctx.strokeStyle = '#D4C36A';
      ctx.lineWidth = 1;
      for (let li = 0; li < 8; li++) {
        const la = (li * Math.PI / 4) + now * 0.001;
        const outerX = sx + Math.cos(la) * magnetR;
        const outerY = sy + Math.sin(la) * magnetR;
        const innerX = sx + Math.cos(la) * size * 0.6;
        const innerY = sy + Math.sin(la) * size * 0.6;
        ctx.beginPath();
        ctx.moveTo(outerX, outerY);
        ctx.lineTo(innerX, innerY);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (hasGhost) ctx.restore();
  }
}
/* ─── Map Object 렌더링 (v10 — Shrine, Spring, Altar, Gate) ─── */

const MAP_OBJECT_COLORS: Record<string, { primary: string; glow: string }> = {
  shrine: { primary: '#FFD700', glow: 'rgba(255, 215, 0, 0.15)' },
  spring: { primary: '#55AAFF', glow: 'rgba(85, 170, 255, 0.12)' },
  altar:  { primary: '#FF6633', glow: 'rgba(255, 102, 51, 0.12)' },
  gate:   { primary: '#AA44FF', glow: 'rgba(170, 68, 255, 0.15)' },
};

export function drawMapObjects(
  ctx: CanvasRenderingContext2D,
  mapObjects: MapObjectNetworkData[],
  cam: Camera,
  w: number,
  h: number,
  now = performance.now(),
): void {
  const halfW = w / 2;
  const halfH = h / 2;

  for (const mo of mapObjects) {
    const sx = (mo.x - cam.x) * cam.zoom + halfW;
    const sy = (mo.y - cam.y) * cam.zoom + halfH;
    const margin = 100 * cam.zoom;
    if (sx < -margin || sx > w + margin || sy < -margin || sy > h + margin) continue;

    const colors = MAP_OBJECT_COLORS[mo.type] ?? MAP_OBJECT_COLORS.shrine;
    const interRadius = mo.r * cam.zoom;
    const pulse = 1 + Math.sin(now * 0.002) * 0.08;
    const alpha = mo.active ? 1 : 0.4;

    ctx.save();
    ctx.globalAlpha = alpha;

    // Interaction radius (dashed circle)
    ctx.strokeStyle = colors.primary;
    ctx.lineWidth = 1;
    ctx.globalAlpha = alpha * 0.2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(sx, sy, interRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = alpha;

    switch (mo.type) {
      case 'shrine': {
        ctx.fillStyle = colors.glow;
        ctx.beginPath();
        ctx.arc(sx, sy, 20 * cam.zoom * pulse, 0, Math.PI * 2);
        ctx.fill();
        const beamH = 30 * cam.zoom;
        ctx.globalAlpha = alpha * 0.25;
        ctx.fillStyle = colors.primary;
        ctx.fillRect(sx - 3 * cam.zoom, sy - beamH, 6 * cam.zoom, beamH * 2);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = colors.primary;
        ctx.beginPath();
        ctx.moveTo(sx, sy - 8 * cam.zoom);
        ctx.lineTo(sx + 6 * cam.zoom, sy);
        ctx.lineTo(sx, sy + 8 * cam.zoom);
        ctx.lineTo(sx - 6 * cam.zoom, sy);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'spring': {
        ctx.fillStyle = colors.glow;
        ctx.beginPath();
        ctx.arc(sx, sy, 16 * cam.zoom * pulse, 0, Math.PI * 2);
        ctx.fill();
        for (let i = 0; i < 3; i++) {
          const angle = (i * Math.PI * 2 / 3) + now * 0.001;
          const dropDist = 8 * cam.zoom;
          const dx = sx + Math.cos(angle) * dropDist;
          const dy = sy + Math.sin(angle) * dropDist - Math.abs(Math.sin(now * 0.005 + i)) * 6 * cam.zoom;
          ctx.fillStyle = colors.primary;
          ctx.globalAlpha = alpha * 0.7;
          ctx.beginPath();
          ctx.arc(dx, dy, 3 * cam.zoom, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = alpha;
        ctx.fillStyle = colors.primary;
        ctx.globalAlpha = alpha * 0.4;
        ctx.beginPath();
        ctx.ellipse(sx, sy + 2 * cam.zoom, 10 * cam.zoom, 6 * cam.zoom, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = alpha;
        break;
      }
      case 'altar': {
        ctx.fillStyle = colors.glow;
        ctx.beginPath();
        ctx.arc(sx, sy, 18 * cam.zoom * pulse, 0, Math.PI * 2);
        ctx.fill();
        for (let i = 0; i < 4; i++) {
          const t = (now * 0.004 + i * 1.5) % 3;
          const fireY = sy - t * 8 * cam.zoom;
          const fireX = sx + Math.sin(now * 0.003 + i * 2) * 5 * cam.zoom;
          const fireAlpha = Math.max(0, 1 - t / 3) * alpha;
          ctx.fillStyle = i % 2 === 0 ? '#FF6633' : '#FFAA33';
          ctx.globalAlpha = fireAlpha * 0.6;
          ctx.beginPath();
          ctx.arc(fireX, fireY, (3 - t) * cam.zoom, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(sx - 6 * cam.zoom, sy - 4 * cam.zoom, 12 * cam.zoom, 8 * cam.zoom);
        ctx.strokeStyle = colors.primary;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(sx - 6 * cam.zoom, sy - 4 * cam.zoom, 12 * cam.zoom, 8 * cam.zoom);
        break;
      }
      case 'gate': {
        const portalR = 14 * cam.zoom * pulse;
        ctx.fillStyle = colors.glow;
        ctx.beginPath();
        ctx.arc(sx, sy, portalR * 1.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = colors.primary;
        ctx.lineWidth = 2.5 * cam.zoom;
        ctx.globalAlpha = alpha * 0.6;
        ctx.beginPath();
        ctx.arc(sx, sy, portalR, now * 0.002, now * 0.002 + Math.PI * 1.5);
        ctx.stroke();
        ctx.lineWidth = 1.5 * cam.zoom;
        ctx.globalAlpha = alpha * 0.3;
        ctx.beginPath();
        ctx.arc(sx, sy, portalR * 0.6, -now * 0.003, -now * 0.003 + Math.PI);
        ctx.stroke();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = colors.primary;
        ctx.beginPath();
        ctx.arc(sx, sy, 3 * cam.zoom, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }
    ctx.restore();
  }
}
// ─── 유틸리티 ───

function darkenColor(hex: string, amount: number): string {
  const h = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.round(((h >> 16) & 0xff) * (1 - amount)));
  const g = Math.max(0, Math.round(((h >> 8) & 0xff) * (1 - amount)));
  const b = Math.max(0, Math.round((h & 0xff) * (1 - amount)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

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
