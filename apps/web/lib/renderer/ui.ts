/**
 * UI 렌더링 — Brawl Stars 스타일 Bold Cartoon HUD
 * 두꺼운 블랙 아웃라인 + 비비드 컬러 + 텍스트 스트로크 + 카툰 패널
 */

import type { SnakeNetworkData, MinimapPayload, LeaderboardEntry } from '@snake-arena/shared';
import { COLORS, ARENA_CONFIG } from '@snake-arena/shared';
import type { KillFeedEntry } from './types';

// ─── 헬퍼 ───

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** Brawl Stars 카툰 패널: 두꺼운 블랙 아웃라인 + 솔리드 배경 + 드롭 섀도우 */
function drawBrawlPanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius = 14): void {
  // 드롭 섀도우 (하단 오른쪽)
  roundRect(ctx, x + 3, y + 3, w, h, radius);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.fill();

  // 블랙 아웃라인 (두꺼운)
  roundRect(ctx, x - 2, y - 2, w + 4, h + 4, radius + 2);
  ctx.fillStyle = '#000000';
  ctx.fill();

  // 메인 배경
  roundRect(ctx, x, y, w, h, radius);
  ctx.fillStyle = COLORS.HUD_PANEL_BG;
  ctx.fill();

  // 내부 하이라이트 보더
  roundRect(ctx, x + 1, y + 1, w - 2, h - 2, radius - 1);
  ctx.strokeStyle = COLORS.HUD_PANEL_INNER;
  ctx.lineWidth = 1;
  ctx.stroke();
}

/** 텍스트 아웃라인 + 채우기 (Brawl Stars 두꺼운 텍스트) */
function drawBoldText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fillColor: string,
  strokeWidth = 3,
  strokeColor = '#000000',
): void {
  ctx.lineWidth = strokeWidth;
  ctx.strokeStyle = strokeColor;
  ctx.lineJoin = 'round';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fillColor;
  ctx.fillText(text, x, y);
}

function formatNumber(n: number): string {
  if (n >= 10000) return (n / 1000).toFixed(1) + 'k';
  if (n >= 1000) return n.toLocaleString();
  return String(Math.floor(n));
}

// ─── Minimap (사각형 + 두꺼운 아웃라인) ───

export function drawMinimap(ctx: CanvasRenderingContext2D, minimap: MinimapPayload | null, w: number, h: number): void {
  if (!minimap) return;
  const size = Math.min(140, w * 0.15);
  const pad = 16;
  const mx = w - size - pad;
  const my = h - size - pad;

  // 카툰 패널
  drawBrawlPanel(ctx, mx, my, size, size, 12);

  // "MAP" 라벨
  ctx.font = 'bold 10px "Inter", sans-serif';
  ctx.textAlign = 'center';
  drawBoldText(ctx, 'MAP', mx + size / 2, my + 12, '#00D4FF', 2);

  const innerPad = 8;
  const innerSize = size - innerPad * 2;
  const scale = innerSize / (minimap.boundary * 2);
  const innerX = mx + innerPad;
  const innerY = my + innerPad + 6;

  // 내부 아레나 원
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(innerX + innerSize / 2, innerY + innerSize / 2, innerSize / 2 - 2, 0, Math.PI * 2);
  ctx.stroke();

  // 다른 뱀 — 레드 점
  for (const s of minimap.snakes) {
    if (s.me) continue;
    const dx = innerX + s.x * scale + innerSize / 2;
    const dy = innerY + s.y * scale + innerSize / 2;
    const dotR = Math.max(2.5, Math.min(5, Math.sqrt(s.m) * 0.35));

    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(dx, dy, dotR + 1, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = COLORS.MINIMAP_OTHER;
    ctx.beginPath();
    ctx.arc(dx, dy, dotR, 0, Math.PI * 2);
    ctx.fill();
  }

  // 내 위치 — 네온 그린 + 글로우
  for (const s of minimap.snakes) {
    if (!s.me) continue;
    const dx = innerX + s.x * scale + innerSize / 2;
    const dy = innerY + s.y * scale + innerSize / 2;

    // 글로우
    ctx.fillStyle = 'rgba(57, 255, 20, 0.4)';
    ctx.beginPath();
    ctx.arc(dx, dy, 8, 0, Math.PI * 2);
    ctx.fill();

    // 아웃라인
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(dx, dy, 5, 0, Math.PI * 2);
    ctx.fill();

    // 코어
    ctx.fillStyle = COLORS.MINIMAP_PLAYER;
    ctx.beginPath();
    ctx.arc(dx, dy, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─── Leaderboard (Brawl Stars 스타일 랭킹) ───

export function drawLeaderboard(ctx: CanvasRenderingContext2D, entries: LeaderboardEntry[], playerId: string | null, w: number): void {
  if (entries.length === 0) return;
  const pad = 16;
  const lw = 200;
  const lineH = 28;
  const maxEntries = Math.min(entries.length, 5);
  const lh = 42 + maxEntries * lineH + 8;
  const lx = w - lw - pad;
  const ly = pad;

  drawBrawlPanel(ctx, lx, ly, lw, lh);

  // 타이틀
  ctx.font = 'bold 13px "Inter", sans-serif';
  ctx.textAlign = 'center';
  drawBoldText(ctx, 'TOP PLAYERS', lx + lw / 2, ly + 24, '#FFD700', 3);

  // 구분선
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(lx + 12, ly + 32);
  ctx.lineTo(lx + lw - 12, ly + 32);
  ctx.stroke();

  // 순위 메달 색상
  const rankColors = ['#FFD700', '#C0C0C0', '#CD7F32'];
  const rankBgs = ['rgba(255, 215, 0, 0.15)', 'rgba(192, 192, 192, 0.1)', 'rgba(205, 127, 50, 0.1)'];

  for (let i = 0; i < maxEntries; i++) {
    const e = entries[i];
    const ey = ly + 52 + i * lineH;
    const isMe = e.id === playerId;

    // 내 행 하이라이트
    if (isMe) {
      roundRect(ctx, lx + 6, ey - 14, lw - 12, lineH - 2, 6);
      ctx.fillStyle = 'rgba(255, 215, 0, 0.12)';
      ctx.fill();
    } else if (i < 3) {
      roundRect(ctx, lx + 6, ey - 14, lw - 12, lineH - 2, 6);
      ctx.fillStyle = rankBgs[i];
      ctx.fill();
    }

    // 순위 번호
    ctx.font = 'bold 14px "Inter", sans-serif';
    ctx.textAlign = 'left';
    const rankColor = i < 3 ? rankColors[i] : 'rgba(255, 255, 255, 0.5)';
    drawBoldText(ctx, `${i + 1}`, lx + 14, ey, rankColor, 2);

    // 이름
    ctx.font = isMe ? 'bold 13px "Inter", sans-serif' : '13px "Inter", sans-serif';
    const nameText = e.name.length > 9 ? e.name.slice(0, 8) + '…' : e.name;
    drawBoldText(ctx, nameText, lx + 34, ey, isMe ? '#FFD700' : '#FFFFFF', 2);

    // 점수
    ctx.textAlign = 'right';
    ctx.font = 'bold 12px "Inter", sans-serif';
    drawBoldText(ctx, formatNumber(e.score), lx + lw - 14, ey, isMe ? '#FFD700' : '#B0BEC5', 2);
  }
}

// ─── Kill Feed (상단 중앙 — 볼드 텍스트) ───

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

    // 배경 바
    ctx.font = 'bold 14px "Inter", sans-serif';
    const textW = ctx.measureText(entry.text).width;
    roundRect(ctx, centerX - textW / 2 - 12, y - 14, textW + 24, 22, 11);
    ctx.fillStyle = entry.isMe ? 'rgba(57, 255, 20, 0.25)' : 'rgba(0, 0, 0, 0.5)';
    ctx.fill();
    ctx.strokeStyle = entry.isMe ? 'rgba(57, 255, 20, 0.5)' : 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 텍스트
    drawBoldText(
      ctx, entry.text, centerX, y,
      entry.isMe ? COLORS.HUD_KILL_HIGHLIGHT : '#FFFFFF', 3,
    );

    ctx.restore();

    y += 28;
    count++;
  }
}

// ─── Score Panel + Boost Gauge (하단 좌측) ───

export function drawScorePanel(
  ctx: CanvasRenderingContext2D,
  mySnake: SnakeNetworkData | null,
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

  drawBrawlPanel(ctx, px, py, panelW, panelH);

  const score = Math.floor(mySnake.m);
  const length = mySnake.p.length;

  // 스코어 아이콘 (별 모양)
  drawStarIcon(ctx, px + 22, py + 28, 10, '#FFD700');

  // 점수 (대형)
  ctx.font = 'bold 32px "Inter", sans-serif';
  ctx.textAlign = 'left';
  drawBoldText(ctx, formatNumber(score), px + 38, py + 36, '#FFFFFF', 4);

  // SCORE 레이블
  ctx.font = 'bold 10px "Inter", sans-serif';
  drawBoldText(ctx, 'SCORE', px + 38, py + 50, '#B0BEC5', 2);

  // Length (우측 상단)
  ctx.textAlign = 'right';
  ctx.font = 'bold 14px "Inter", sans-serif';
  drawBoldText(ctx, `${length}`, px + panelW - 14, py + 28, '#00D4FF', 3);

  ctx.font = 'bold 9px "Inter", sans-serif';
  drawBoldText(ctx, 'LEN', px + panelW - 14, py + 40, '#B0BEC5', 2);

  // ─── Boost Gauge (두꺼운 바) ───
  const barX = px + 14;
  const barY = py + 62;
  const barW = panelW - 28;
  const barH = 14;
  const boostMin = ARENA_CONFIG.minBoostMass;

  // 배경 바 (블랙 아웃라인 + 다크 fill)
  roundRect(ctx, barX - 2, barY - 2, barW + 4, barH + 4, 6);
  ctx.fillStyle = '#000000';
  ctx.fill();

  roundRect(ctx, barX, barY, barW, barH, 4);
  ctx.fillStyle = COLORS.HUD_BOOST_BG;
  ctx.fill();

  // 채움 바
  const maxDisplayMass = Math.max(100, score * 1.2);
  const fillRatio = Math.min(1, score / maxDisplayMass);
  const fillW = barW * fillRatio;

  if (fillW > 3) {
    roundRect(ctx, barX, barY, fillW, barH, 4);
    if (score < boostMin) {
      ctx.fillStyle = COLORS.HUD_BOOST_LOW;
    } else if (mySnake.b) {
      const pulse = 0.7 + Math.sin(performance.now() * 0.01) * 0.3;
      ctx.fillStyle = `rgba(57, 255, 20, ${pulse})`;
    } else {
      ctx.fillStyle = COLORS.HUD_BOOST_BAR;
    }
    ctx.fill();

    // 바 내부 하이라이트 (상단 광택)
    roundRect(ctx, barX + 1, barY + 1, fillW - 2, barH * 0.4, 3);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fill();
  }

  // BOOST 레이블
  ctx.font = 'bold 10px "Inter", sans-serif';
  ctx.textAlign = 'left';
  const boostColor = score < boostMin ? COLORS.HUD_BOOST_LOW : mySnake.b ? COLORS.HUD_BOOST_BAR : '#B0BEC5';
  const boostLabel = score < boostMin ? 'BOOST · LOW' : mySnake.b ? 'BOOST · ON' : 'BOOST';
  drawBoldText(ctx, boostLabel, barX, barY + barH + 14, boostColor, 2);
}

// ─── 순위 뱃지 (상단 좌측 — 골드 방패 스타일) ───

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
    ctx.font = 'bold 20px "Inter", sans-serif';
    const textW = ctx.measureText(rankText).width;
    const badgeW = textW + 28;
    const badgeH = 34;

    // 드롭 섀도우
    roundRect(ctx, x + 2, y + 2, badgeW, badgeH, 17);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fill();

    // 블랙 아웃라인
    roundRect(ctx, x - 2, y - 2, badgeW + 4, badgeH + 4, 19);
    ctx.fillStyle = '#000000';
    ctx.fill();

    // 골드 그라디언트 배경
    const grad = ctx.createLinearGradient(x, y, x, y + badgeH);
    grad.addColorStop(0, '#FFD700');
    grad.addColorStop(1, '#FF8C00');
    roundRect(ctx, x, y, badgeW, badgeH, 17);
    ctx.fillStyle = grad;
    ctx.fill();

    // 내부 하이라이트
    roundRect(ctx, x + 2, y + 2, badgeW - 4, badgeH * 0.45, 12);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fill();

    // 순위 텍스트
    ctx.font = 'bold 20px "Inter", sans-serif';
    ctx.textAlign = 'center';
    drawBoldText(ctx, rankText, x + badgeW / 2, y + 23, '#1A0A00', 0);

    // 총 인원
    ctx.font = 'bold 13px "Inter", sans-serif';
    ctx.textAlign = 'left';
    drawBoldText(ctx, `/ ${playerCount}`, x + badgeW + 8, y + 23, '#B0BEC5', 2);
  }

  // 네트워크 정보
  const infoY = y + (playerRank > 0 ? 52 : 19);
  ctx.font = 'bold 12px "Inter", sans-serif';
  ctx.textAlign = 'left';

  const netColor = rtt < 50 ? '#39FF14' : rtt < 100 ? '#FFD700' : '#FF3B3B';
  drawBoldText(ctx, `${rtt}ms`, pad, infoY, netColor, 2);
  drawBoldText(ctx, `${fps}fps`, pad + 55, infoY, 'rgba(255, 255, 255, 0.4)', 2);
}

// ─── 아이콘 헬퍼 ───

/** 별 아이콘 (5각형 별) */
function drawStarIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string): void {
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();

  // 아웃라인
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // 채우기
  ctx.fillStyle = color;
  ctx.fill();

  // 하이라이트
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.beginPath();
  ctx.arc(cx - r * 0.15, cy - r * 0.15, r * 0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ─── 메인 HUD 진입점 ───

export function drawHUD(
  ctx: CanvasRenderingContext2D,
  mySnake: SnakeNetworkData | null,
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

// ─── 효과 HUD (하단 중앙) ───

const EFFECT_ICONS: Record<number, { label: string; color: string; maxTicks: number }> = {
  0: { label: '🧲', color: '#9333EA', maxTicks: 100 },
  1: { label: '⚡', color: '#FACC15', maxTicks: 80 },
  2: { label: '👻', color: '#06B6D4', maxTicks: 60 },
};

function drawEffectHUD(
  ctx: CanvasRenderingContext2D,
  mySnake: SnakeNetworkData | null,
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

    // 배경
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    roundRect(ctx, x, y, boxW, boxH, 6);
    ctx.fill();

    // 타이머 바
    ctx.fillStyle = info.color;
    ctx.globalAlpha = 0.7;
    roundRect(ctx, x + 2, y + boxH - 5, (boxW - 4) * ratio, 3, 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // 아이콘 + 시간
    ctx.font = 'bold 13px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`${info.label} ${secs}s`, x + boxW / 2, y + 17);
  }
}
