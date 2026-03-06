/**
 * UI 렌더링 — Crayon / Pencil Sketch HUD
 * 손그림 패널 + 연필 텍스트 + 워블 미니맵
 */

import type { AgentNetworkData, MinimapPayload, LeaderboardEntry } from '@agent-survivor/shared';
import { COLORS, ARENA_CONFIG } from '@agent-survivor/shared';
import type { KillFeedEntry } from './types';

// ─── Seeded Random ───

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49271;
  return x - Math.floor(x);
}

// ─── 상수 ───

const PENCIL_DARK = '#3A3028';
const PENCIL_MEDIUM = '#6B5E52';
const PAPER = '#F5F0E8';
const CRAYON_ORANGE = '#D4914A';
const CRAYON_RED = '#C75B5B';
const CRAYON_BLUE = '#5B8DAD';
const CRAYON_GREEN = '#7BA868';
const CRAYON_YELLOW = '#D4C36A';

// ─── 헬퍼 ───

/** 스케치 패널: 워블 사각형 + 연필 테두리 */
function drawSketchPanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed = 0): void {
  const j = 2; // jitter amount

  // 종이 배경
  ctx.fillStyle = COLORS.HUD_PANEL_BG;
  ctx.beginPath();
  ctx.moveTo(x + (seededRandom(seed) - 0.5) * j, y + (seededRandom(seed + 1) - 0.5) * j);
  ctx.lineTo(x + w + (seededRandom(seed + 2) - 0.5) * j, y + (seededRandom(seed + 3) - 0.5) * j);
  ctx.lineTo(x + w + (seededRandom(seed + 4) - 0.5) * j, y + h + (seededRandom(seed + 5) - 0.5) * j);
  ctx.lineTo(x + (seededRandom(seed + 6) - 0.5) * j, y + h + (seededRandom(seed + 7) - 0.5) * j);
  ctx.closePath();
  ctx.fill();

  // 연필 테두리 — 2 pass
  ctx.strokeStyle = `rgba(107, 94, 82, 0.25)`;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x + (seededRandom(seed + 10) - 0.5) * j, y + (seededRandom(seed + 11) - 0.5) * j);
  ctx.lineTo(x + w + (seededRandom(seed + 12) - 0.5) * j, y + (seededRandom(seed + 13) - 0.5) * j);
  ctx.lineTo(x + w + (seededRandom(seed + 14) - 0.5) * j, y + h + (seededRandom(seed + 15) - 0.5) * j);
  ctx.lineTo(x + (seededRandom(seed + 16) - 0.5) * j, y + h + (seededRandom(seed + 17) - 0.5) * j);
  ctx.closePath();
  ctx.stroke();

  ctx.strokeStyle = PENCIL_DARK;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x + (seededRandom(seed + 20) - 0.5) * j * 0.8, y + (seededRandom(seed + 21) - 0.5) * j * 0.8);
  ctx.lineTo(x + w + (seededRandom(seed + 22) - 0.5) * j * 0.8, y + (seededRandom(seed + 23) - 0.5) * j * 0.8);
  ctx.lineTo(x + w + (seededRandom(seed + 24) - 0.5) * j * 0.8, y + h + (seededRandom(seed + 25) - 0.5) * j * 0.8);
  ctx.lineTo(x + (seededRandom(seed + 26) - 0.5) * j * 0.8, y + h + (seededRandom(seed + 27) - 0.5) * j * 0.8);
  ctx.closePath();
  ctx.stroke();
}

/** 텍스트 그리기 */
function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fillColor: string,
  _hasShadow = false,
): void {
  ctx.fillStyle = fillColor;
  ctx.fillText(text, x, y);
}

function formatNumber(n: number): string {
  if (n >= 10000) return (n / 1000).toFixed(1) + 'k';
  if (n >= 1000) return n.toLocaleString();
  return String(Math.floor(n));
}

// ─── Minimap (워블 원 + 연필 점) ───

export function drawMinimap(ctx: CanvasRenderingContext2D, minimap: MinimapPayload | null, w: number, h: number): void {
  if (!minimap) return;
  const size = Math.min(140, w * 0.15);
  const pad = 16;
  const mx = w - size - pad;
  const my = h - size - pad;

  drawSketchPanel(ctx, mx, my, size, size, 100);

  // "MAP" 라벨 — 연필 밑줄
  ctx.font = 'bold 10px "Patrick Hand", "Inter", sans-serif';
  ctx.textAlign = 'center';
  drawText(ctx, 'MAP', mx + size / 2, my + 13, PENCIL_MEDIUM);
  // 밑줄
  ctx.strokeStyle = PENCIL_MEDIUM;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(mx + size / 2 - 12, my + 15);
  ctx.lineTo(mx + size / 2 + 12, my + 15);
  ctx.stroke();

  const innerPad = 8;
  const innerSize = size - innerPad * 2;
  const scale = innerSize / (minimap.boundary * 2);
  const innerX = mx + innerPad;
  const innerY = my + innerPad + 6;

  // 내부 아레나 — 워블 원
  ctx.strokeStyle = 'rgba(107, 94, 82, 0.2)';
  ctx.lineWidth = 1;
  const cx = innerX + innerSize / 2;
  const cy = innerY + innerSize / 2;
  const cr = innerSize / 2 - 2;
  ctx.beginPath();
  const segs = 16;
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const jitter = (seededRandom(i * 7 + 200) - 0.5) * 2;
    const px = cx + Math.cos(a) * (cr + jitter);
    const py = cy + Math.sin(a) * (cr + jitter);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();

  // 내부 종이 fill
  ctx.fillStyle = 'rgba(237, 231, 219, 0.4)';
  ctx.fill();

  // 다른 뱀 — 연필 점
  for (const s of minimap.snakes) {
    if (s.me) continue;
    const dx = innerX + s.x * scale + innerSize / 2;
    const dy = innerY + s.y * scale + innerSize / 2;
    const dotR = Math.max(2, Math.min(4, Math.sqrt(s.m) * 0.35));

    ctx.fillStyle = PENCIL_MEDIUM;
    ctx.beginPath();
    ctx.arc(dx, dy, dotR, 0, Math.PI * 2);
    ctx.fill();
  }

  // 내 위치 — 크레용 오렌지 + 연필 원
  for (const s of minimap.snakes) {
    if (!s.me) continue;
    const dx = innerX + s.x * scale + innerSize / 2;
    const dy = innerY + s.y * scale + innerSize / 2;

    // 연필 원 표시
    ctx.strokeStyle = PENCIL_DARK;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(dx, dy, 6, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = CRAYON_ORANGE;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(dx, dy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// ─── Leaderboard (TOP PLAYERS) ───

export function drawLeaderboard(ctx: CanvasRenderingContext2D, entries: LeaderboardEntry[], playerId: string | null, w: number): void {
  if (entries.length === 0) return;
  const pad = 16;
  const lw = 200;
  const lineH = 28;
  const maxEntries = Math.min(entries.length, 5);
  const lh = 42 + maxEntries * lineH + 8;
  const lx = w - lw - pad;
  const ly = pad;

  drawSketchPanel(ctx, lx, ly, lw, lh, 300);

  // 타이틀 — 연필 밑줄
  ctx.font = 'bold 13px "Patrick Hand", "Inter", sans-serif';
  ctx.textAlign = 'center';
  drawText(ctx, 'TOP PLAYERS', lx + lw / 2, ly + 24, PENCIL_DARK);
  // 밑줄
  ctx.strokeStyle = PENCIL_MEDIUM;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  const titleW = ctx.measureText('TOP PLAYERS').width;
  ctx.moveTo(lx + lw / 2 - titleW / 2, ly + 27);
  ctx.lineTo(lx + lw / 2 + titleW / 2, ly + 27);
  ctx.stroke();

  // 연필 구분선
  ctx.strokeStyle = 'rgba(107, 94, 82, 0.2)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  const jx1 = (seededRandom(310) - 0.5) * 2;
  const jx2 = (seededRandom(311) - 0.5) * 2;
  ctx.moveTo(lx + 12 + jx1, ly + 32);
  ctx.lineTo(lx + lw - 12 + jx2, ly + 32);
  ctx.stroke();

  // 크레용 메달 색상
  const rankColors = [CRAYON_ORANGE, '#A8A098', '#B8926A'];

  for (let i = 0; i < maxEntries; i++) {
    const e = entries[i];
    const ey = ly + 52 + i * lineH;
    const isMe = e.id === playerId;

    if (isMe) {
      // 연필 밑줄 강조
      ctx.strokeStyle = CRAYON_ORANGE;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.moveTo(lx + 10, ey + 4);
      ctx.lineTo(lx + lw - 10, ey + 4);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // 순위 — 크레용 색상
    ctx.font = 'bold 14px "Patrick Hand", "Inter", sans-serif';
    ctx.textAlign = 'left';
    const rankColor = i < 3 ? rankColors[i] : PENCIL_MEDIUM;
    drawText(ctx, `${i + 1}`, lx + 14, ey, rankColor);

    // 이름
    ctx.font = isMe ? 'bold 13px "Patrick Hand", "Inter", sans-serif' : '13px "Patrick Hand", "Inter", sans-serif';
    const nameText = e.name.length > 9 ? e.name.slice(0, 8) + '\u2026' : e.name;
    drawText(ctx, nameText, lx + 34, ey, isMe ? CRAYON_ORANGE : PENCIL_DARK);

    // 점수
    ctx.textAlign = 'right';
    ctx.font = 'bold 12px "Patrick Hand", "Inter", sans-serif';
    drawText(ctx, formatNumber(e.score), lx + lw - 14, ey, isMe ? CRAYON_ORANGE : PENCIL_MEDIUM);

    // 순위 간 연필 구분선
    if (i < maxEntries - 1) {
      ctx.strokeStyle = 'rgba(168, 152, 136, 0.15)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(lx + 12, ey + lineH / 2 + 2);
      ctx.lineTo(lx + lw - 12, ey + lineH / 2 + 2);
      ctx.stroke();
    }
  }
}

// ─── Kill Feed (상단 중앙) ───

export function drawKillFeed(ctx: CanvasRenderingContext2D, killFeed: KillFeedEntry[], w: number): void {
  if (killFeed.length === 0) return;
  const now = performance.now();
  const feedDuration = 5000;
  const maxItems = 3;
  const centerX = w / 2;
  let y = 24;

  ctx.textAlign = 'center';

  let count = 0;
  for (const entry of killFeed) {
    if (count >= maxItems) break;
    const age = now - entry.timestamp;
    if (age > feedDuration) continue;

    const alpha = age > feedDuration - 1000 ? (feedDuration - age) / 1000 : 1;

    ctx.save();
    ctx.globalAlpha = alpha;

    ctx.font = 'bold 14px "Patrick Hand", "Inter", sans-serif';
    const textW = ctx.measureText(entry.text).width;

    // 종이 배경 + 연필 테두리
    const bgX = centerX - textW / 2 - 12;
    const bgY = y - 14;
    const bgW = textW + 24;
    const bgH = 22;

    ctx.fillStyle = entry.isMe ? 'rgba(212, 145, 74, 0.12)' : 'rgba(245, 240, 232, 0.9)';
    ctx.fillRect(bgX, bgY, bgW, bgH);
    ctx.strokeStyle = entry.isMe ? 'rgba(212, 145, 74, 0.4)' : 'rgba(107, 94, 82, 0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(bgX, bgY, bgW, bgH);

    drawText(
      ctx, entry.text, centerX, y,
      entry.isMe ? CRAYON_ORANGE : PENCIL_DARK,
    );

    ctx.restore();

    y += 28;
    count++;
  }
}

// ─── Score Panel + Boost Gauge (하단 좌측) ───

export function drawScorePanel(
  ctx: CanvasRenderingContext2D,
  mySnake: AgentNetworkData | null,
  playerRank: number,
  playerCount: number,
  _w: number,
  h: number,
): void {
  if (!mySnake) return;

  const pad = 16;
  const panelW = 220;
  const panelH = 100;
  const px = pad;
  const py = h - panelH - pad;

  drawSketchPanel(ctx, px, py, panelW, panelH, 500);

  const score = Math.floor(mySnake.m);
  const level = mySnake.lv ?? 1;

  // 연필 별 아이콘
  drawSketchStar(ctx, px + 22, py + 28, 10, CRAYON_ORANGE);

  // 점수 (대형)
  ctx.font = 'bold 32px "Patrick Hand", "Inter", sans-serif';
  ctx.textAlign = 'left';
  drawText(ctx, formatNumber(score), px + 38, py + 36, PENCIL_DARK);

  // SCORE 레이블
  ctx.font = 'bold 10px "Patrick Hand", "Inter", sans-serif';
  drawText(ctx, 'SCORE', px + 38, py + 50, PENCIL_MEDIUM);

  // Level (우측 상단)
  ctx.textAlign = 'right';
  ctx.font = 'bold 14px "Patrick Hand", "Inter", sans-serif';
  drawText(ctx, `Lv.${level}`, px + panelW - 14, py + 28, CRAYON_BLUE);

  ctx.font = 'bold 9px "Patrick Hand", "Inter", sans-serif';
  drawText(ctx, 'LEVEL', px + panelW - 14, py + 40, PENCIL_MEDIUM);

  // ─── Boost Gauge — rough 사각형 + 크레용 fill ───
  const barX = px + 14;
  const barY = py + 62;
  const barW = panelW - 28;
  const barH = 14;
  const boostMin = ARENA_CONFIG.minBoostMass;

  // 바 배경 — rough 사각형
  ctx.strokeStyle = PENCIL_MEDIUM;
  ctx.lineWidth = 1;
  ctx.beginPath();
  const bj = 1.5;
  ctx.moveTo(barX + (seededRandom(700) - 0.5) * bj, barY + (seededRandom(701) - 0.5) * bj);
  ctx.lineTo(barX + barW + (seededRandom(702) - 0.5) * bj, barY + (seededRandom(703) - 0.5) * bj);
  ctx.lineTo(barX + barW + (seededRandom(704) - 0.5) * bj, barY + barH + (seededRandom(705) - 0.5) * bj);
  ctx.lineTo(barX + (seededRandom(706) - 0.5) * bj, barY + barH + (seededRandom(707) - 0.5) * bj);
  ctx.closePath();
  ctx.fillStyle = 'rgba(58, 48, 40, 0.04)';
  ctx.fill();
  ctx.stroke();

  const maxDisplayMass = Math.max(100, score * 1.2);
  const fillRatio = Math.min(1, score / maxDisplayMass);
  const fillW = barW * fillRatio;

  if (fillW > 3) {
    ctx.save();
    ctx.globalAlpha = 0.6;
    if (score < boostMin) {
      ctx.fillStyle = CRAYON_RED;
    } else if (mySnake.b) {
      const pulse = 0.5 + Math.sin(performance.now() * 0.01) * 0.3;
      ctx.fillStyle = CRAYON_ORANGE;
      ctx.globalAlpha = pulse;
    } else {
      ctx.fillStyle = CRAYON_ORANGE;
    }
    ctx.fillRect(barX + 1, barY + 1, fillW - 2, barH - 2);
    ctx.restore();
  }

  ctx.font = 'bold 10px "Patrick Hand", "Inter", sans-serif';
  ctx.textAlign = 'left';
  const boostColor = score < boostMin ? CRAYON_RED : mySnake.b ? CRAYON_ORANGE : PENCIL_MEDIUM;
  const boostLabel = score < boostMin ? 'BOOST \u00b7 LOW' : mySnake.b ? 'BOOST \u00b7 ON' : 'BOOST';
  drawText(ctx, boostLabel, barX, barY + barH + 14, boostColor);
}

// ─── 순위 뱃지 (상단 좌측 — 연필 밑줄 텍스트) ───

export function drawRankBadge(
  ctx: CanvasRenderingContext2D,
  playerRank: number,
  playerCount: number,
  rtt: number,
  fps: number,
): void {
  const pad = 16;
  const x = pad;
  const y = pad;

  if (playerRank > 0) {
    const rankText = `#${playerRank}`;
    ctx.font = 'bold 24px "Patrick Hand", "Inter", sans-serif';
    ctx.textAlign = 'left';

    // 크레용 오렌지 텍스트
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = CRAYON_ORANGE;
    ctx.fillText(rankText, x, y + 22);
    ctx.globalAlpha = 1;

    // 연필 밑줄
    const textW = ctx.measureText(rankText).width;
    ctx.strokeStyle = PENCIL_DARK;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y + 26);
    ctx.lineTo(x + textW + (seededRandom(800) - 0.5) * 3, y + 26 + (seededRandom(801) - 0.5) * 1.5);
    ctx.stroke();

    // 총 인원
    ctx.font = 'bold 13px "Patrick Hand", "Inter", sans-serif';
    drawText(ctx, `/ ${playerCount}`, x + textW + 8, y + 22, PENCIL_MEDIUM);
  }

  // 네트워크 정보
  const infoY = y + (playerRank > 0 ? 46 : 19);
  ctx.font = 'bold 12px "Patrick Hand", "Inter", sans-serif';
  ctx.textAlign = 'left';

  const netColor = rtt < 50 ? CRAYON_GREEN : rtt < 100 ? CRAYON_ORANGE : CRAYON_RED;
  drawText(ctx, `${rtt}ms`, pad, infoY, netColor);
  drawText(ctx, `${fps}fps`, pad + 55, infoY, 'rgba(58, 48, 40, 0.3)');
}

// ─── 아이콘 헬퍼 ───

/** 스케치 별 아이콘 (연필 선) */
function drawSketchStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
    const outerX = cx + Math.cos(a) * r + (seededRandom(900 + i) - 0.5) * 1.5;
    const outerY = cy + Math.sin(a) * r + (seededRandom(910 + i) - 0.5) * 1.5;
    const innerA = a + Math.PI / 5;
    const innerX = cx + Math.cos(innerA) * r * 0.45;
    const innerY = cy + Math.sin(innerA) * r * 0.45;
    if (i === 0) ctx.moveTo(outerX, outerY);
    else ctx.lineTo(outerX, outerY);
    ctx.lineTo(innerX, innerY);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

// ─── 메인 HUD 진입점 ───

export function drawHUD(
  ctx: CanvasRenderingContext2D,
  mySnake: AgentNetworkData | null,
  killFeed: KillFeedEntry[],
  playerRank: number,
  playerCount: number,
  rtt: number,
  fps: number,
  w: number,
  h: number,
): void {
  drawKillFeed(ctx, killFeed, w);
  drawRankBadge(ctx, playerRank, playerCount, rtt, fps);
  drawScorePanel(ctx, mySnake, playerRank, playerCount, w, h);
  drawEffectHUD(ctx, mySnake, w, h);
}

// ─── 효과 HUD (하단 중앙) — 스케치 ───

const EFFECT_ICONS: Record<number, { label: string; color: string; maxTicks: number }> = {
  0: { label: '\uD83E\uDDF2', color: CRAYON_YELLOW, maxTicks: 100 },
  1: { label: '\u26A1', color: CRAYON_BLUE, maxTicks: 80 },
  2: { label: '\uD83D\uDC7B', color: '#A8A098', maxTicks: 60 },
};

function drawEffectHUD(
  ctx: CanvasRenderingContext2D,
  mySnake: AgentNetworkData | null,
  w: number,
  h: number,
): void {
  if (!mySnake?.e || mySnake.e.length === 0) return;

  const effects: Array<{ type: number; remaining: number }> = [];
  for (let i = 0; i < mySnake.e.length; i += 2) {
    effects.push({ type: mySnake.e[i], remaining: mySnake.e[i + 1] });
  }

  const boxW = 70;
  const boxH = 28;
  const gap = 8;
  const totalW = effects.length * boxW + (effects.length - 1) * gap;
  const startX = (w - totalW) / 2;
  const y = h - 60;

  for (let i = 0; i < effects.length; i++) {
    const e = effects[i];
    const info = EFFECT_ICONS[e.type];
    if (!info) continue;

    const x = startX + i * (boxW + gap);
    const secs = (e.remaining / 20).toFixed(1);
    const ratio = Math.min(1, e.remaining / info.maxTicks);

    // 종이 배경 + 연필 테두리
    ctx.fillStyle = 'rgba(245, 240, 232, 0.9)';
    ctx.fillRect(x, y, boxW, boxH);
    ctx.strokeStyle = info.color;
    ctx.lineWidth = 1.2;
    ctx.strokeRect(x, y, boxW, boxH);

    // 진행 바 — 크레용 fill
    ctx.fillStyle = info.color;
    ctx.globalAlpha = 0.3;
    ctx.fillRect(x + 2, y + boxH - 5, (boxW - 4) * ratio, 3);
    ctx.globalAlpha = 1;

    ctx.font = 'bold 13px "Patrick Hand", "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = PENCIL_DARK;
    ctx.fillText(`${info.label} ${secs}s`, x + boxW / 2, y + 17);
  }
}
