/**
 * multiplayer/nametag.ts — 네임태그 + 국적 + HP바 + 레벨 렌더링
 *
 * v33 Phase 4: 다른 플레이어 머리 위 정보 표시
 * - 닉네임 (Ethnocentric 폰트)
 * - 국기 이모지 + 국가 코드 (3-letter)
 * - HP 바 (아군=블루, 적=레드, 평화=그린)
 * - 레벨 뱃지 (골드 서클)
 *
 * LOD 대응:
 *   HIGH: 풀 네임태그 (이름 + 국적 + HP + 레벨)
 *   MID:  축약 네임태그 (이름 + HP)
 *   LOW:  HP 도트만
 */

import type { NametagRenderParams } from './types';
import {
  FONT_DISPLAY,
  FONT_BODY,
  NAMETAG_FONT_SIZE,
  NAMETAG_NATION_FONT_SIZE,
  HP_BAR_WIDTH,
  HP_BAR_HEIGHT,
  LEVEL_BADGE_SIZE,
  ALLY_BLUE,
  ENEMY_RED,
  MILITARY_GOLD,
  MILITARY_GREEN,
  TEXT_OFFWHITE,
  NEUTRAL_GRAY,
  getNationColor,
  getNationFlag,
} from './constants';
import { LOD_HIGH, LOD_MID } from './viewport-culler';

// ─── 메인 네임태그 렌더러 ───

/**
 * 원격 플레이어 네임태그 렌더링
 * screenX, screenY는 이미 카메라 변환된 스크린 좌표이다.
 */
export function renderNametag(params: NametagRenderParams): void {
  const { ctx, screenX, screenY, lod } = params;

  if (lod > LOD_MID) {
    // LOW LOD: HP 도트만 표시
    renderHPDot(ctx, screenX, screenY, params.hp, params.maxHp, params.isAlly, params.pvpEnabled);
    return;
  }

  if (lod === LOD_MID) {
    // MID LOD: 이름 + HP바만
    renderNameOnly(ctx, screenX, screenY, params.name, params.isAlly, params.pvpEnabled);
    renderHPBar(ctx, screenX, screenY + 14, params.hp, params.maxHp, params.isAlly, params.pvpEnabled);
    return;
  }

  // HIGH LOD: 풀 네임태그
  renderFullNametag(params);
}

// ─── HIGH LOD: 풀 네임태그 ───

function renderFullNametag(params: NametagRenderParams): void {
  const { ctx, screenX, screenY, name, nation, hp, maxHp, level, isAlly, pvpEnabled } = params;

  const nationColor = getNationColor(nation);
  const flag = getNationFlag(nation);

  // 배경 패널 (다크 반투명)
  const panelWidth = Math.max(HP_BAR_WIDTH + 20, name.length * 7 + 30);
  const panelHeight = 42;
  const panelX = screenX - panelWidth / 2;
  const panelY = screenY - panelHeight;

  ctx.save();

  // 다크 배경 + 국적 색상 보더
  ctx.fillStyle = 'rgba(17, 17, 17, 0.85)';
  roundRect(ctx, panelX, panelY, panelWidth, panelHeight, 4);
  ctx.fill();

  // 국적 색상 좌측 스트라이프 (2px)
  ctx.fillStyle = nationColor.primary;
  ctx.fillRect(panelX, panelY, 2, panelHeight);

  // ── Row 1: 국기 + 이름 ──
  const row1Y = panelY + 13;

  // 국기 이모지 (또는 국가 코드)
  ctx.font = `${NAMETAG_NATION_FONT_SIZE}px ${FONT_BODY}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = nationColor.text;
  ctx.fillText(flag, panelX + 6, row1Y);

  // 플레이어 이름
  const nameColor = pvpEnabled
    ? (isAlly ? ALLY_BLUE : ENEMY_RED)
    : TEXT_OFFWHITE;
  ctx.font = `bold ${NAMETAG_FONT_SIZE}px ${FONT_DISPLAY}`;
  ctx.fillStyle = nameColor;
  ctx.textAlign = 'left';

  // 이름 최대 길이 제한 (패널 폭 기반)
  const maxNameWidth = panelWidth - 36;
  let displayName = name;
  while (ctx.measureText(displayName).width > maxNameWidth && displayName.length > 3) {
    displayName = displayName.slice(0, -1);
  }
  if (displayName !== name) displayName += '..';

  ctx.fillText(displayName, panelX + 18, row1Y);

  // ── Row 2: HP 바 + 레벨 뱃지 ──
  const row2Y = panelY + 28;
  const hpBarX = panelX + 6;
  const hpBarWidth = panelWidth - LEVEL_BADGE_SIZE - 14;

  renderHPBarInline(ctx, hpBarX, row2Y, hpBarWidth, hp, maxHp, isAlly, pvpEnabled);

  // 레벨 뱃지 (우측)
  const badgeX = panelX + panelWidth - LEVEL_BADGE_SIZE / 2 - 4;
  const badgeY = row2Y + HP_BAR_HEIGHT / 2;
  renderLevelBadge(ctx, badgeX, badgeY, level);

  ctx.restore();
}

// ─── HP 바 (인라인, 풀 네임태그 내부용) ───

function renderHPBarInline(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  hp: number,
  maxHp: number,
  isAlly: boolean,
  pvpEnabled: boolean
): void {
  const hpRatio = Math.max(0, Math.min(1, hp / maxHp));

  // 배경
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  roundRect(ctx, x, y, width, HP_BAR_HEIGHT, 2);
  ctx.fill();

  // HP 바 색상
  let barColor: string;
  if (!pvpEnabled) {
    barColor = MILITARY_GREEN; // 평화: 그린
  } else if (isAlly) {
    barColor = ALLY_BLUE; // 아군: 블루
  } else {
    barColor = hpRatio > 0.5 ? ENEMY_RED : '#FF6666'; // 적: 레드 (저HP=밝은 레드)
  }

  // HP 바 fill
  if (hpRatio > 0) {
    ctx.fillStyle = barColor;
    roundRect(ctx, x, y, width * hpRatio, HP_BAR_HEIGHT, 2);
    ctx.fill();
  }
}

// ─── HP 바 (독립형, MID LOD용) ───

function renderHPBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  hp: number,
  maxHp: number,
  isAlly: boolean,
  pvpEnabled: boolean
): void {
  ctx.save();
  renderHPBarInline(ctx, x - HP_BAR_WIDTH / 2, y, HP_BAR_WIDTH, hp, maxHp, isAlly, pvpEnabled);
  ctx.restore();
}

// ─── 레벨 뱃지 ───

function renderLevelBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  level: number
): void {
  const r = LEVEL_BADGE_SIZE / 2;

  // 골드 서클
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(204, 153, 51, 0.9)';
  ctx.fill();

  // 레벨 텍스트
  ctx.font = `bold 8px ${FONT_BODY}`;
  ctx.fillStyle = '#111111';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(level), x, y + 0.5);
}

// ─── MID LOD: 이름만 ───

function renderNameOnly(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  name: string,
  isAlly: boolean,
  pvpEnabled: boolean
): void {
  ctx.save();

  const nameColor = pvpEnabled
    ? (isAlly ? ALLY_BLUE : ENEMY_RED)
    : TEXT_OFFWHITE;

  // 이름 배경 (다크 반투명)
  ctx.font = `bold ${NAMETAG_FONT_SIZE - 1}px ${FONT_DISPLAY}`;
  const textWidth = ctx.measureText(name).width;
  const bgWidth = textWidth + 10;
  const bgHeight = 16;

  ctx.fillStyle = 'rgba(17, 17, 17, 0.75)';
  roundRect(ctx, x - bgWidth / 2, y - bgHeight / 2, bgWidth, bgHeight, 3);
  ctx.fill();

  // 이름 텍스트
  ctx.fillStyle = nameColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name.slice(0, 10), x, y);

  ctx.restore();
}

// ─── LOW LOD: HP 도트 ───

function renderHPDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  hp: number,
  maxHp: number,
  isAlly: boolean,
  pvpEnabled: boolean
): void {
  const hpRatio = hp / maxHp;
  const r = 3;

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y - 4, r, 0, Math.PI * 2);

  if (!pvpEnabled) {
    ctx.fillStyle = hpRatio > 0.5 ? MILITARY_GREEN : MILITARY_GOLD;
  } else if (isAlly) {
    ctx.fillStyle = ALLY_BLUE;
  } else {
    ctx.fillStyle = hpRatio > 0.5 ? ENEMY_RED : '#FF8888';
  }

  ctx.fill();
  ctx.restore();
}

// ─── 유틸: 둥근 사각형 ───

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
