/**
 * multiplayer/remote-player.ts — 원격 플레이어 렌더링
 *
 * v33 Phase 4: 서버에서 수신한 보간된 플레이어를 Canvas 2D에 렌더링
 * - 국적별 아웃라인 색상
 * - 아군/적군 시각적 구분 (PvP 활성 시)
 * - 캐릭터 스프라이트 (기존 rendering/characters 모듈 재사용)
 * - HP 바 + 네임태그 (nametag.ts)
 * - LOD 기반 디테일 조절
 *
 * 렌더링 레이어 (아래→위):
 *   1. 그림자 (HIGH LOD only)
 *   2. 아군/적 아우라 글로우 (PvP 활성 시, HIGH LOD)
 *   3. 캐릭터 스프라이트
 *   4. 네임태그 + HP + 레벨
 */

import type { InterpolatedPlayer } from '../../systems/online-sync';
import type { RemotePlayerRenderParams } from './types';
import { renderNametag } from './nametag';
import { ViewportCuller, LOD_HIGH, LOD_MID } from './viewport-culler';
import {
  REMOTE_PLAYER_SIZE,
  ALLY_OUTLINE_WIDTH,
  ENEMY_OUTLINE_WIDTH,
  NAMETAG_OFFSET_Y,
  ALLY_BLUE,
  ENEMY_RED,
  MILITARY_GREEN,
  NEUTRAL_GRAY,
  TEXT_OFFWHITE,
  getNationColor,
} from './constants';

// ─── PLACEHOLDER SECTION ───
// Placeholder for character rendering integration

// ─── 단일 플레이어 렌더링 ───

/**
 * 원격 플레이어 1명을 렌더링한다.
 * 호출 전에 ctx.save()/restore()를 외부에서 관리한다.
 */
export function renderRemotePlayer(params: RemotePlayerRenderParams): void {
  const { ctx, player, cameraX, cameraY, zoom, time, pvpEnabled, lod } = params;

  // 월드 → 스크린 좌표 변환
  const screenX = (player.x - cameraX) * zoom;
  const screenY = (player.y - cameraY) * zoom;
  const scaledSize = REMOTE_PLAYER_SIZE * zoom;

  ctx.save();

  // ── Layer 1: 그림자 (HIGH LOD only) ──
  if (lod === LOD_HIGH) {
    renderShadow(ctx, screenX, screenY, scaledSize);
  }

  // ── Layer 2: 아군/적 아우라 (PvP + HIGH/MID LOD) ──
  if (pvpEnabled && lod <= LOD_MID) {
    renderAura(ctx, screenX, screenY, scaledSize, player.isAlly, time);
  }

  // ── Layer 3: 캐릭터 바디 ──
  renderCharacterBody(ctx, screenX, screenY, scaledSize, player, pvpEnabled, lod, time);

  // ── Layer 4: 네임태그 ──
  renderNametag({
    ctx,
    screenX,
    screenY: screenY + NAMETAG_OFFSET_Y * zoom,
    name: player.name,
    nation: player.nation,
    hp: player.hp,
    maxHp: player.maxHp,
    level: player.level,
    isAlly: player.isAlly,
    pvpEnabled,
    lod,
    zoom,
  });

  ctx.restore();
}

// ─── 복수 플레이어 렌더링 (뷰포트 컬링 포함) ───

/**
 * 모든 원격 플레이어를 렌더링한다.
 * 뷰포트 컬링 + LOD 자동 적용.
 */
export function renderRemotePlayers(
  ctx: CanvasRenderingContext2D,
  players: InterpolatedPlayer[],
  cameraX: number,
  cameraY: number,
  canvasWidth: number,
  canvasHeight: number,
  zoom: number,
  pvpEnabled: boolean,
  culler: ViewportCuller,
  time: number = Date.now()
): { rendered: number; culled: number } {
  // 뷰포트 바운드 계산
  const bounds = culler.calculateBounds(cameraX, cameraY, canvasWidth, canvasHeight, zoom);

  // 컬링 + LOD 분류
  const result = culler.cullPlayers(players, bounds, cameraX, cameraY);

  // 렌더링 (LOD LOW → MID → HIGH 순서 — 가까운 플레이어가 위에 그려짐)
  const sorted = result.visible.sort((a, b) => {
    const distA = (a.x - cameraX) ** 2 + (a.y - cameraY) ** 2;
    const distB = (b.x - cameraX) ** 2 + (b.y - cameraY) ** 2;
    return distB - distA; // 먼 것부터 그리기 (painter's algorithm)
  });

  for (const player of sorted) {
    const lod = culler.getPlayerLOD(player.x, player.y, cameraX, cameraY);

    renderRemotePlayer({
      ctx,
      player,
      cameraX,
      cameraY,
      zoom,
      time,
      pvpEnabled,
      lod,
    });
  }

  return { rendered: result.visible.length, culled: result.culledCount };
}

// ─── Layer 1: 그림자 ───

function renderShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number
): void {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.beginPath();
  ctx.ellipse(x, y + size * 0.45, size * 0.5, size * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ─── Layer 2: 아군/적 아우라 ───

function renderAura(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  isAlly: boolean,
  time: number
): void {
  const pulse = 0.8 + 0.2 * Math.sin(time / 500);
  const auraRadius = size * 0.7 * pulse;
  const color = isAlly ? ALLY_BLUE : ENEMY_RED;

  ctx.save();

  // 외부 글로우
  const gradient = ctx.createRadialGradient(x, y, auraRadius * 0.3, x, y, auraRadius);
  gradient.addColorStop(0, colorWithAlpha(color, 0.15));
  gradient.addColorStop(0.6, colorWithAlpha(color, 0.08));
  gradient.addColorStop(1, colorWithAlpha(color, 0));

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, auraRadius, 0, Math.PI * 2);
  ctx.fill();

  // 아우라 링
  ctx.strokeStyle = colorWithAlpha(color, 0.3 * pulse);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, auraRadius * 0.85, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

// ─── Layer 3: 캐릭터 바디 ───

function renderCharacterBody(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  player: InterpolatedPlayer,
  pvpEnabled: boolean,
  lod: number,
  time: number
): void {
  const nationColor = getNationColor(player.nation);

  ctx.save();

  if (lod >= 2) {
    // LOW LOD: 국적 색상 도트
    ctx.beginPath();
    ctx.arc(x, y, size * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = nationColor.primary;
    ctx.fill();

    // 아군/적 테두리 (PvP)
    if (pvpEnabled) {
      ctx.strokeStyle = player.isAlly ? ALLY_BLUE : ENEMY_RED;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  } else {
    // HIGH/MID LOD: 스타일된 캐릭터

    // 바디 (원형 베이스 + 국적 색상)
    const bodyR = size * 0.4;
    ctx.beginPath();
    ctx.arc(x, y, bodyR, 0, Math.PI * 2);
    ctx.fillStyle = nationColor.primary;
    ctx.fill();

    // 아군/적 아웃라인
    if (pvpEnabled) {
      ctx.strokeStyle = player.isAlly ? ALLY_BLUE : ENEMY_RED;
      ctx.lineWidth = player.isAlly ? ALLY_OUTLINE_WIDTH : ENEMY_OUTLINE_WIDTH;
    } else {
      ctx.strokeStyle = NEUTRAL_GRAY;
      ctx.lineWidth = 1;
    }
    ctx.stroke();

    // 머리 (약간 위에, 밝은 톤)
    const headR = size * 0.22;
    const headY = y - bodyR * 0.5;
    ctx.beginPath();
    ctx.arc(x, headY, headR, 0, Math.PI * 2);
    ctx.fillStyle = lightenColor(nationColor.primary, 0.3);
    ctx.fill();

    if (lod === LOD_HIGH) {
      // HIGH LOD: 눈 + 방향 표시
      const eyeOffset = headR * 0.3;
      const eyeR = headR * 0.15;
      const facing = player.angle ?? 0;
      const eyeX = Math.cos(facing) * eyeOffset;
      const eyeY = Math.sin(facing) * eyeOffset * 0.5;

      // 왼쪽 눈
      ctx.beginPath();
      ctx.arc(x - eyeOffset * 0.5 + eyeX, headY + eyeY, eyeR, 0, Math.PI * 2);
      ctx.fillStyle = TEXT_OFFWHITE;
      ctx.fill();
      // 오른쪽 눈
      ctx.beginPath();
      ctx.arc(x + eyeOffset * 0.5 + eyeX, headY + eyeY, eyeR, 0, Math.PI * 2);
      ctx.fillStyle = TEXT_OFFWHITE;
      ctx.fill();

      // 무기 표시 (간단한 선/점으로)
      if (player.weapons.length > 0) {
        renderWeaponIndicator(ctx, x, y, bodyR, player.angle ?? 0, time);
      }

      // 상태 이펙트 표시 (haste, shield 등)
      if (player.status.length > 0) {
        renderStatusEffects(ctx, x, y, bodyR, player.status, time);
      }
    }
  }

  ctx.restore();
}

// ─── 무기 인디케이터 ───

function renderWeaponIndicator(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  bodyR: number,
  angle: number,
  time: number
): void {
  const weaponDist = bodyR * 1.3;
  const wx = x + Math.cos(angle) * weaponDist;
  const wy = y + Math.sin(angle) * weaponDist;

  ctx.save();
  ctx.beginPath();
  ctx.arc(wx, wy, 3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.fill();

  // 무기 라인
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + Math.cos(angle) * bodyR, y + Math.sin(angle) * bodyR);
  ctx.lineTo(wx, wy);
  ctx.stroke();

  ctx.restore();
}

// ─── 상태 이펙트 표시 ───

function renderStatusEffects(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  bodyR: number,
  statuses: string[],
  time: number
): void {
  ctx.save();

  for (let i = 0; i < Math.min(statuses.length, 3); i++) {
    const status = statuses[i];
    const angle = (Math.PI * 2 / 3) * i - Math.PI / 2;
    const dist = bodyR * 1.4;
    const sx = x + Math.cos(angle + time / 2000) * dist;
    const sy = y + Math.sin(angle + time / 2000) * dist;

    const color = getStatusColor(status);
    const pulse = 0.5 + 0.5 * Math.sin(time / 300 + i);

    ctx.beginPath();
    ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = colorWithAlpha(color, 0.5 + pulse * 0.5);
    ctx.fill();
  }

  ctx.restore();
}

// ─── 유틸 ───

function getStatusColor(status: string): string {
  switch (status) {
    case 'haste': return '#00FFFF';  // 사이안
    case 'shield': return '#FFD700'; // 골드
    case 'regen': return '#00FF41';  // 매트릭스 그린
    case 'damage_up': return '#FF4444'; // 레드
    case 'freeze': return '#88CCFF'; // 아이스 블루
    default: return '#FFFFFF';
  }
}

function colorWithAlpha(hex: string, alpha: number): string {
  // hex → rgba
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function lightenColor(hex: string, amount: number): string {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + 255 * amount);
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + 255 * amount);
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + 255 * amount);
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}
