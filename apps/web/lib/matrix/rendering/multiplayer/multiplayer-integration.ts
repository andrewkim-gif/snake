/**
 * multiplayer-integration.ts — Phase 4 통합 브릿지
 *
 * v33 Phase 4: Phase 3 온라인 시스템과 Phase 4 렌더링 모듈을 연결하는 오케스트레이터.
 *
 * 연결 관계:
 *   online-sync.ts  → interpolatePlayers() → renderRemotePlayers()
 *   kill-reporter.ts → onConfirmed/onRejected → PvpEffectsManager
 *   epoch-ui-bridge.ts → isWarPhase → 전쟁 테두리/PvP 모드 전환
 *
 * MatrixCanvas의 draw() 내부에서 renderMultiplayerLayer()를 호출하면
 * 모든 멀티플레이어 렌더링이 한 번에 수행된다.
 */

import { ViewportCuller } from './viewport-culler';
import { PvpEffectsManager } from './pvp-effects';
import { renderRemotePlayers } from './remote-player';
import type { InterpolatedPlayer } from '../../systems/online-sync';
import type { ConfirmedKill } from '../../systems/kill-reporter';

// ─── 설정 타입 ───

export interface MultiplayerRendererConfig {
  /** 디버그 모드 (렌더링 통계 표시) */
  debug?: boolean;
}

// ─── 렌더링 컨텍스트 (매 프레임 전달) ───

export interface MultiplayerRenderContext {
  /** Canvas 2D 컨텍스트 */
  ctx: CanvasRenderingContext2D;
  /** 카메라 X (플레이어 중심, 월드 좌표) */
  cameraX: number;
  /** 카메라 Y */
  cameraY: number;
  /** 캔버스 너비 (px) */
  canvasWidth: number;
  /** 캔버스 높이 (px) */
  canvasHeight: number;
  /** 현재 줌 레벨 */
  zoom: number;
  /** 보간된 원격 플레이어 목록 */
  remotePlayers: InterpolatedPlayer[];
  /** PvP 활성 여부 */
  pvpEnabled: boolean;
  /** 전쟁 카운트다운 (war_countdown 페이즈에서만, 초) */
  warCountdown: number | null;
  /** 현재 타임스탬프 (ms) */
  time: number;
}

// ─── 렌더링 통계 ───

export interface MultiplayerRenderStats {
  /** 렌더링된 원격 플레이어 수 */
  rendered: number;
  /** 뷰포트 컬링된 플레이어 수 */
  culled: number;
  /** 활성 PvP 이펙트 수 */
  activeEffects: number;
  /** 킬피드 항목 수 */
  killFeedCount: number;
}

// ─── 메인 클래스 ───

export class MultiplayerRenderer {
  /** 뷰포트 컬링 시스템 */
  readonly culler: ViewportCuller;
  /** PvP 이펙트 매니저 */
  readonly pvpEffects: PvpEffectsManager;
  /** 디버그 모드 */
  private debug: boolean;
  /** 최근 렌더링 통계 */
  private _stats: MultiplayerRenderStats = {
    rendered: 0,
    culled: 0,
    activeEffects: 0,
    killFeedCount: 0,
  };

  constructor(config?: MultiplayerRendererConfig) {
    this.culler = new ViewportCuller();
    this.pvpEffects = new PvpEffectsManager();
    this.debug = config?.debug ?? false;
  }

  /** 최근 렌더링 통계 */
  get stats(): MultiplayerRenderStats {
    return this._stats;
  }

  // ─── 이벤트 연결 (kill-reporter 콜백용) ───

  /**
   * 킬 확정 시 호출 — 킬 이펙트 + 킬피드 추가
   * kill-reporter.onConfirmed 콜백에서 호출한다.
   */
  onKillConfirmed(
    kill: ConfirmedKill,
    killerName: string,
    killerNation: string,
    targetName: string,
    targetNation: string,
    targetX: number,
    targetY: number,
    weaponId: string,
  ): void {
    // 킬 이펙트 (월드 좌표)
    this.pvpEffects.addKillEffect(targetX, targetY, kill.score);

    // 킬피드 추가
    this.pvpEffects.addKillFeedEntry(
      killerName,
      targetName,
      killerNation,
      targetNation,
      weaponId,
      kill.score,
    );
  }

  /**
   * PvP 히트 이펙트 추가
   * 로컬 전투 시스템에서 PvP 데미지 발생 시 호출
   */
  onPvPHit(x: number, y: number, damage: number, isCritical: boolean = false): void {
    this.pvpEffects.addHitEffect(x, y, damage, isCritical);
  }

  /**
   * 외부 킬피드 추가 (서버에서 다른 플레이어의 킬 알림을 받았을 때)
   */
  addExternalKillFeed(
    killerName: string,
    targetName: string,
    killerNation: string,
    targetNation: string,
    weaponId: string,
    score: number,
  ): void {
    this.pvpEffects.addKillFeedEntry(
      killerName,
      targetName,
      killerNation,
      targetNation,
      weaponId,
      score,
    );
  }

  // ─── 메인 렌더링 ───

  /**
   * 멀티플레이어 렌더링 레이어 — 매 프레임 호출
   *
   * MatrixCanvas의 draw() 함수 내부에서 호출한다.
   * 기존 엔티티(적, 투사체 등) 렌더링 후, UI 렌더링 전에 호출해야 한다.
   *
   * 렌더링 순서:
   *   1. 원격 플레이어 (뷰포트 컬링 + LOD 자동 적용)
   *   2. PvP 월드 이펙트 (히트 플래시, 킬 폭발, 데미지 숫자)
   *   3. 전쟁 페이즈 화면 테두리
   *   4. 전쟁 카운트다운 오버레이
   *   5. 킬피드 UI (스크린 우상단)
   *   6. 디버그 오버레이 (선택)
   */
  renderMultiplayerLayer(renderCtx: MultiplayerRenderContext): MultiplayerRenderStats {
    const {
      ctx, cameraX, cameraY, canvasWidth, canvasHeight,
      zoom, remotePlayers, pvpEnabled, warCountdown, time,
    } = renderCtx;

    // 1. PvP 이펙트 업데이트 (만료된 이펙트 정리)
    this.pvpEffects.update();

    // 2. 원격 플레이어 렌더링 (월드 좌표 → 뷰포트 컬링 + LOD)
    const renderResult = renderRemotePlayers(
      ctx,
      remotePlayers,
      cameraX,
      cameraY,
      canvasWidth,
      canvasHeight,
      zoom,
      pvpEnabled,
      this.culler,
      time,
    );

    // 3. PvP 월드 이펙트 렌더링 (히트, 킬 폭발, 데미지 숫자)
    this.pvpEffects.renderWorldEffects(ctx, cameraX, cameraY, zoom);

    // --- 스크린 스페이스 UI (ctx.resetTransform 후 호출해야 함) ---
    ctx.save();
    ctx.resetTransform();

    // 4. 전쟁 페이즈 화면 테두리
    if (pvpEnabled) {
      this.pvpEffects.renderWarBorder(ctx, canvasWidth, canvasHeight, time);
    }

    // 5. 전쟁 카운트다운 오버레이
    if (warCountdown !== null && warCountdown > 0) {
      this.pvpEffects.renderWarCountdown(ctx, canvasWidth, canvasHeight, warCountdown, time);
    }

    // 6. 킬피드 (항상 표시 — 평화 시에도 최근 전쟁 킬피드가 남아있을 수 있음)
    this.pvpEffects.renderKillFeed(ctx, canvasWidth);

    // 7. 디버그 오버레이
    if (this.debug) {
      this.renderDebugOverlay(ctx, renderResult, canvasWidth);
    }

    ctx.restore();

    // 통계 업데이트
    this._stats = {
      rendered: renderResult.rendered,
      culled: renderResult.culled,
      activeEffects: this.pvpEffects.activeEffectCount,
      killFeedCount: this.pvpEffects.killFeedEntries.length,
    };

    return this._stats;
  }

  // ─── 디버그 오버레이 ───

  private renderDebugOverlay(
    ctx: CanvasRenderingContext2D,
    renderResult: { rendered: number; culled: number },
    canvasWidth: number,
  ): void {
    const x = canvasWidth - 180;
    const y = 200;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(x, y, 170, 80);

    ctx.font = '10px monospace';
    ctx.fillStyle = '#4ADE80';
    ctx.textAlign = 'left';
    ctx.fillText(`MP Rendered: ${renderResult.rendered}`, x + 8, y + 16);
    ctx.fillText(`MP Culled:   ${renderResult.culled}`, x + 8, y + 30);
    ctx.fillText(`PvP Effects: ${this.pvpEffects.activeEffectCount}`, x + 8, y + 44);
    ctx.fillText(`Kill Feed:   ${this.pvpEffects.killFeedEntries.length}`, x + 8, y + 58);
    ctx.fillText(`LOD Culler:  active`, x + 8, y + 72);
  }

  // ─── 리셋 ───

  /** 전체 리셋 (에폭 전환/아레나 퇴장 시) */
  reset(): void {
    this.pvpEffects.reset();
    this._stats = { rendered: 0, culled: 0, activeEffects: 0, killFeedCount: 0 };
  }

  /** 디버그 모드 토글 */
  setDebug(enabled: boolean): void {
    this.debug = enabled;
  }
}
