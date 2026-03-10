/**
 * multiplayer/pvp-effects.ts — PvP 전투 시각효과 시스템
 *
 * v33 Phase 4: 전쟁 페이즈 PvP 시각효과
 * - 히트 이펙트 (피격 플래시 + 파티클)
 * - 킬 이펙트 (폭발 + 스코어 팝업)
 * - 데미지 숫자 (떠오르는 텍스트)
 * - 킬피드 UI (화면 우상단 스크롤)
 * - 전쟁 페이즈 화면 테두리
 *
 * 모든 이펙트는 시간 기반 자동 소멸 (duration 경과 시 제거)
 */

import type {
  HitEffect,
  KillNotification,
  DamageNumber,
} from './types';
import {
  HIT_EFFECT_DURATION,
  KILL_EFFECT_DURATION,
  DAMAGE_NUMBER_DURATION,
  DAMAGE_NUMBER_RISE,
  KILLFEED_MAX_ENTRIES,
  KILLFEED_ENTRY_DURATION,
  KILLFEED_ENTRY_HEIGHT,
  KILLFEED_OFFSET_X,
  KILLFEED_OFFSET_Y,
  WAR_BORDER_COLOR,
  WAR_BORDER_WIDTH,
  WAR_COUNTDOWN_COLOR,
  FONT_DISPLAY,
  FONT_BODY,
  FONT_MONO,
  ALLY_BLUE,
  ENEMY_RED,
  MILITARY_GOLD,
  WAR_RED,
  TEXT_OFFWHITE,
  getNationColor,
} from './constants';

// ─── v33 Phase 8: 파티클 하드 캡 (GC 압력 방지) ───

/** 히트 이펙트 최대 동시 활성 수 */
const MAX_HIT_EFFECTS = 30;
/** 데미지 숫자 최대 동시 활성 수 */
const MAX_DAMAGE_NUMBERS = 40;

// ─── PvP 이펙트 매니저 ───

/* PLACEHOLDER:PvpEffectsManager */
export class PvpEffectsManager {
  /** 활성 히트 이펙트 */
  private hitEffects: HitEffect[] = [];
  /** 활성 데미지 숫자 */
  private damageNumbers: DamageNumber[] = [];
  /** 킬피드 항목 */
  private killFeed: KillNotification[] = [];

  // ─── 이펙트 추가 ───

  /** 히트 이펙트 추가 (PvP 피격 시) */
  addHitEffect(x: number, y: number, damage: number, isCritical: boolean = false): void {
    // v33 Phase 8: 하드 캡 — 가장 오래된 이펙트 제거
    if (this.hitEffects.length >= MAX_HIT_EFFECTS) {
      this.hitEffects.shift();
    }

    this.hitEffects.push({
      x,
      y,
      damage,
      createdAt: Date.now(),
      duration: isCritical ? HIT_EFFECT_DURATION * 1.5 : HIT_EFFECT_DURATION,
      color: isCritical ? MILITARY_GOLD : ENEMY_RED,
      type: isCritical ? 'critical' : 'hit',
    });

    // v33 Phase 8: 데미지 숫자 하드 캡
    if (this.damageNumbers.length >= MAX_DAMAGE_NUMBERS) {
      this.damageNumbers.shift();
    }

    // 데미지 숫자도 함께 추가
    this.damageNumbers.push({
      x: x + (Math.random() - 0.5) * 20,
      y,
      damage,
      createdAt: Date.now(),
      offsetY: 0,
      color: isCritical ? MILITARY_GOLD : '#FF6666',
      isCritical,
    });
  }

  /** 킬 이펙트 추가 */
  addKillEffect(x: number, y: number, score: number): void {
    // v33 Phase 8: 하드 캡 — 가장 오래된 이펙트 제거
    if (this.hitEffects.length >= MAX_HIT_EFFECTS) {
      this.hitEffects.shift();
    }

    this.hitEffects.push({
      x,
      y,
      damage: score,
      createdAt: Date.now(),
      duration: KILL_EFFECT_DURATION,
      color: MILITARY_GOLD,
      type: 'kill',
    });
  }

  /** 킬피드 항목 추가 */
  addKillFeedEntry(
    killerName: string,
    targetName: string,
    killerNation: string,
    targetNation: string,
    weaponId: string,
    score: number
  ): void {
    this.killFeed.unshift({
      killerName,
      targetName,
      killerNation,
      targetNation,
      weaponId,
      createdAt: Date.now(),
      score,
    });

    // 최대 수 제한
    if (this.killFeed.length > KILLFEED_MAX_ENTRIES) {
      this.killFeed.pop();
    }
  }

  // ─── 업데이트 (매 프레임) ───

  /** 만료된 이펙트 제거 */
  update(): void {
    const now = Date.now();

    // 히트 이펙트 정리
    this.hitEffects = this.hitEffects.filter(
      (e) => now - e.createdAt < e.duration
    );

    // 데미지 숫자 정리 + 오프셋 업데이트
    this.damageNumbers = this.damageNumbers.filter((d) => {
      const elapsed = now - d.createdAt;
      if (elapsed >= DAMAGE_NUMBER_DURATION) return false;
      d.offsetY = -(elapsed / DAMAGE_NUMBER_DURATION) * DAMAGE_NUMBER_RISE;
      return true;
    });

    // 킬피드 정리
    this.killFeed = this.killFeed.filter(
      (k) => now - k.createdAt < KILLFEED_ENTRY_DURATION
    );
  }

  // ─── 월드 스페이스 이펙트 렌더링 ───

  /** 히트/킬 이펙트 렌더링 (월드 좌표, 카메라 변환 필요) */
  renderWorldEffects(
    ctx: CanvasRenderingContext2D,
    cameraX: number,
    cameraY: number,
    zoom: number
  ): void {
    const now = Date.now();

    // 히트 이펙트
    for (const effect of this.hitEffects) {
      const sx = (effect.x - cameraX) * zoom;
      const sy = (effect.y - cameraY) * zoom;
      const progress = (now - effect.createdAt) / effect.duration;

      if (effect.type === 'kill') {
        this.renderKillExplosion(ctx, sx, sy, progress, effect.color);
      } else {
        this.renderHitFlash(ctx, sx, sy, progress, effect.color, effect.type === 'critical');
      }
    }

    // 데미지 숫자
    for (const dmg of this.damageNumbers) {
      const sx = (dmg.x - cameraX) * zoom;
      const sy = (dmg.y - cameraY) * zoom + dmg.offsetY * zoom;
      const progress = (now - dmg.createdAt) / DAMAGE_NUMBER_DURATION;
      const alpha = 1 - progress;

      this.renderDamageNumber(ctx, sx, sy, dmg.damage, dmg.color, alpha, dmg.isCritical);
    }
  }

  // ─── 스크린 스페이스 UI 렌더링 ───

  /** 킬피드 렌더링 (스크린 좌표, 우상단) */
  renderKillFeed(ctx: CanvasRenderingContext2D, canvasWidth: number): void {
    const now = Date.now();
    const feedX = canvasWidth - KILLFEED_OFFSET_X;

    for (let i = 0; i < this.killFeed.length; i++) {
      const entry = this.killFeed[i];
      const elapsed = now - entry.createdAt;
      const progress = elapsed / KILLFEED_ENTRY_DURATION;

      // 페이드인/아웃
      let alpha = 1;
      if (progress < 0.1) alpha = progress / 0.1; // 페이드인
      if (progress > 0.8) alpha = (1 - progress) / 0.2; // 페이드아웃

      // 슬라이드 오프셋 (새 항목이 위에서 슬라이드)
      const slideOffset = progress < 0.05 ? (1 - progress / 0.05) * -20 : 0;
      const entryY = KILLFEED_OFFSET_Y + i * KILLFEED_ENTRY_HEIGHT + slideOffset;

      this.renderKillFeedEntry(ctx, feedX, entryY, entry, alpha);
    }
  }

  /** 전쟁 페이즈 화면 테두리 렌더링 */
  renderWarBorder(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number, time: number): void {
    const pulse = 0.7 + 0.3 * Math.sin(time / 800);

    ctx.save();

    // 4변 그래디언트 테두리
    const borderGrad = ctx.createLinearGradient(0, 0, canvasWidth, 0);
    borderGrad.addColorStop(0, `rgba(204, 51, 51, ${0.4 * pulse})`);
    borderGrad.addColorStop(0.5, `rgba(204, 51, 51, ${0.15 * pulse})`);
    borderGrad.addColorStop(1, `rgba(204, 51, 51, ${0.4 * pulse})`);

    // 상단
    ctx.fillStyle = borderGrad;
    ctx.fillRect(0, 0, canvasWidth, WAR_BORDER_WIDTH);
    // 하단
    ctx.fillRect(0, canvasHeight - WAR_BORDER_WIDTH, canvasWidth, WAR_BORDER_WIDTH);

    // 좌측
    const sideGrad = ctx.createLinearGradient(0, 0, 0, canvasHeight);
    sideGrad.addColorStop(0, `rgba(204, 51, 51, ${0.4 * pulse})`);
    sideGrad.addColorStop(0.5, `rgba(204, 51, 51, ${0.15 * pulse})`);
    sideGrad.addColorStop(1, `rgba(204, 51, 51, ${0.4 * pulse})`);

    ctx.fillStyle = sideGrad;
    ctx.fillRect(0, 0, WAR_BORDER_WIDTH, canvasHeight);
    // 우측
    ctx.fillRect(canvasWidth - WAR_BORDER_WIDTH, 0, WAR_BORDER_WIDTH, canvasHeight);

    // 코너 강조 (타겟 마크 스타일)
    this.renderCornerMark(ctx, 0, 0, 1, 1, pulse);
    this.renderCornerMark(ctx, canvasWidth, 0, -1, 1, pulse);
    this.renderCornerMark(ctx, 0, canvasHeight, 1, -1, pulse);
    this.renderCornerMark(ctx, canvasWidth, canvasHeight, -1, -1, pulse);

    ctx.restore();
  }

  /** 전쟁 카운트다운 오버레이 */
  renderWarCountdown(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    countdown: number,
    time: number
  ): void {
    if (countdown <= 0) return;

    const pulse = 0.8 + 0.2 * Math.sin(time / 200);

    ctx.save();

    // 배경 비네팅
    const vignetteGrad = ctx.createRadialGradient(
      canvasWidth / 2, canvasHeight / 2, canvasHeight * 0.3,
      canvasWidth / 2, canvasHeight / 2, canvasHeight * 0.7
    );
    vignetteGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignetteGrad.addColorStop(1, `rgba(204, 51, 51, ${0.15 * pulse})`);
    ctx.fillStyle = vignetteGrad;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // "WAR INCOMING" 텍스트
    const centerY = canvasHeight * 0.35;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 글로우 레이어
    ctx.shadowColor = WAR_COUNTDOWN_COLOR;
    ctx.shadowBlur = 20 * pulse;
    ctx.font = `bold 14px ${FONT_DISPLAY}`;
    ctx.fillStyle = `rgba(255, 68, 68, ${0.8 * pulse})`;
    ctx.fillText('WAR INCOMING', canvasWidth / 2, centerY);

    // 카운트다운 숫자
    ctx.shadowBlur = 30 * pulse;
    ctx.font = `bold 48px ${FONT_DISPLAY}`;
    ctx.fillStyle = WAR_COUNTDOWN_COLOR;
    ctx.fillText(String(Math.ceil(countdown)), canvasWidth / 2, centerY + 50);

    // 사이렌 표시 (3초 이하)
    if (countdown <= 3) {
      const sirenPulse = Math.sin(time / 100) > 0 ? 1 : 0;
      ctx.font = `bold 12px ${FONT_BODY}`;
      ctx.fillStyle = `rgba(255, 68, 68, ${sirenPulse * 0.9})`;
      ctx.fillText('[ ALERT ]', canvasWidth / 2, centerY + 90);
    }

    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // ─── 개별 이펙트 렌더링 ───

  private renderHitFlash(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    progress: number,
    color: string,
    isCritical: boolean
  ): void {
    const alpha = 1 - progress;
    const r = isCritical ? 15 + progress * 25 : 10 + progress * 15;

    ctx.save();

    // 충격파 링
    ctx.strokeStyle = colorWithAlpha(color, alpha * 0.6);
    ctx.lineWidth = isCritical ? 2.5 : 1.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();

    // 내부 플래시
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r * 0.6);
    gradient.addColorStop(0, colorWithAlpha(color, alpha * 0.4));
    gradient.addColorStop(1, colorWithAlpha(color, 0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.6, 0, Math.PI * 2);
    ctx.fill();

    // 크리티컬: 스파크 파티클 (4개)
    if (isCritical) {
      for (let i = 0; i < 4; i++) {
        const angle = (Math.PI * 2 / 4) * i + progress * Math.PI;
        const dist = r * (0.5 + progress * 0.5);
        const px = x + Math.cos(angle) * dist;
        const py = y + Math.sin(angle) * dist;

        ctx.beginPath();
        ctx.arc(px, py, 2 * (1 - progress), 0, Math.PI * 2);
        ctx.fillStyle = colorWithAlpha(MILITARY_GOLD, alpha);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  private renderKillExplosion(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    progress: number,
    color: string
  ): void {
    const alpha = 1 - progress;

    ctx.save();

    // 외부 충격파
    const outerR = 20 + progress * 40;
    ctx.strokeStyle = colorWithAlpha(color, alpha * 0.5);
    ctx.lineWidth = 3 * (1 - progress);
    ctx.beginPath();
    ctx.arc(x, y, outerR, 0, Math.PI * 2);
    ctx.stroke();

    // 내부 폭발
    const innerR = 15 + progress * 20;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, innerR);
    gradient.addColorStop(0, colorWithAlpha('#FFFFFF', alpha * 0.6));
    gradient.addColorStop(0.3, colorWithAlpha(color, alpha * 0.4));
    gradient.addColorStop(1, colorWithAlpha(color, 0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, innerR, 0, Math.PI * 2);
    ctx.fill();

    // 파티클 버스트 (8개)
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 / 8) * i;
      const dist = (10 + progress * 35) * (0.8 + Math.sin(i * 1.7) * 0.2);
      const px = x + Math.cos(angle) * dist;
      const py = y + Math.sin(angle) * dist;
      const pr = 3 * (1 - progress);

      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fillStyle = colorWithAlpha(i % 2 === 0 ? color : '#FFFFFF', alpha * 0.8);
      ctx.fill();
    }

    // "+SCORE" 텍스트 (킬 스코어)
    if (progress < 0.7) {
      const textAlpha = progress < 0.5 ? 1 : (0.7 - progress) / 0.2;
      ctx.font = `bold 14px ${FONT_MONO}`;
      ctx.fillStyle = colorWithAlpha(MILITARY_GOLD, textAlpha);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`+KILL`, x, y - 20 - progress * 15);
    }

    ctx.restore();
  }

  private renderDamageNumber(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    damage: number,
    color: string,
    alpha: number,
    isCritical: boolean
  ): void {
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);

    const fontSize = isCritical ? 16 : 12;
    ctx.font = `bold ${fontSize}px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 그림자 (가독성)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillText(String(Math.round(damage)), x + 1, y + 1);

    // 메인 텍스트
    ctx.fillStyle = color;
    ctx.fillText(String(Math.round(damage)), x, y);

    // 크리티컬 마크
    if (isCritical) {
      ctx.font = `bold 9px ${FONT_BODY}`;
      ctx.fillStyle = MILITARY_GOLD;
      ctx.fillText('CRIT', x, y - fontSize);
    }

    ctx.restore();
  }

  private renderKillFeedEntry(
    ctx: CanvasRenderingContext2D,
    rightX: number,
    y: number,
    entry: KillNotification,
    alpha: number
  ): void {
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);

    // 텍스트 구성: "KillerName [WPN] TargetName"
    const text = `${entry.killerName}  \u2694  ${entry.targetName}`;

    ctx.font = `10px ${FONT_BODY}`;
    const textWidth = ctx.measureText(text).width;

    // 배경 패널
    const panelWidth = textWidth + 40;
    const panelHeight = KILLFEED_ENTRY_HEIGHT - 4;
    const panelX = rightX - panelWidth;

    ctx.fillStyle = 'rgba(17, 17, 17, 0.8)';
    roundRect(ctx, panelX, y, panelWidth, panelHeight, 3);
    ctx.fill();

    // 좌측 국적 스트라이프 (킬러 색상)
    const killerColor = getNationColor(entry.killerNation);
    ctx.fillStyle = killerColor.primary;
    ctx.fillRect(panelX, y, 2, panelHeight);

    // 킬러 이름 (국적 색상)
    ctx.font = `bold 10px ${FONT_BODY}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = killerColor.glow;
    ctx.fillText(entry.killerName, panelX + 8, y + panelHeight / 2);

    // 무기 아이콘 (검 이모지)
    const killerWidth = ctx.measureText(entry.killerName).width;
    ctx.fillStyle = MILITARY_GOLD;
    ctx.font = `10px ${FONT_BODY}`;
    ctx.fillText(' \u2694 ', panelX + 8 + killerWidth, y + panelHeight / 2);

    // 타겟 이름 (레드)
    const swordWidth = ctx.measureText(' \u2694 ').width;
    const targetColor = getNationColor(entry.targetNation);
    ctx.fillStyle = targetColor.glow;
    ctx.fillText(entry.targetName, panelX + 8 + killerWidth + swordWidth, y + panelHeight / 2);

    // 스코어 (우측, 골드)
    if (entry.score > 0) {
      ctx.font = `bold 9px ${FONT_MONO}`;
      ctx.fillStyle = MILITARY_GOLD;
      ctx.textAlign = 'right';
      ctx.fillText(`+${entry.score}`, rightX - 6, y + panelHeight / 2);
    }

    ctx.restore();
  }

  private renderCornerMark(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    dx: number,
    dy: number,
    pulse: number
  ): void {
    const len = 20;
    const offset = 4;

    ctx.strokeStyle = `rgba(204, 51, 51, ${0.6 * pulse})`;
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(x + dx * offset, y + dy * (offset + len));
    ctx.lineTo(x + dx * offset, y + dy * offset);
    ctx.lineTo(x + dx * (offset + len), y + dy * offset);
    ctx.stroke();
  }

  // ─── 리셋 ───

  /** 모든 이펙트 초기화 */
  reset(): void {
    this.hitEffects = [];
    this.damageNumbers = [];
    this.killFeed = [];
  }

  // ─── 상태 조회 ───

  get activeEffectCount(): number {
    return this.hitEffects.length + this.damageNumbers.length;
  }

  get killFeedEntries(): readonly KillNotification[] {
    return this.killFeed;
  }
}

// ─── 유틸 ───

function colorWithAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

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
