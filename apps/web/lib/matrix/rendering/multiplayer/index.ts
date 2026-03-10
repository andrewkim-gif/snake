/**
 * multiplayer/index.ts — 멀티플레이어 렌더링 모듈 Public API
 *
 * v33 Phase 4: 다른 플레이어 렌더링, 네임태그, PvP 이펙트, 뷰포트 컬링
 *
 * 사용법 (MatrixApp.tsx 게임 루프에서):
 *
 * ```ts
 * import {
 *   ViewportCuller, PvpEffectsManager,
 *   renderRemotePlayers, renderNametag,
 * } from '@/lib/matrix/rendering/multiplayer';
 *
 * // 초기화 (한 번)
 * const culler = new ViewportCuller();
 * const pvpFx = new PvpEffectsManager();
 *
 * // 게임 루프 (매 프레임)
 * function render(ctx, onlineSync, camera) {
 *   const players = onlineSync.interpolatePlayers();
 *
 *   // 1. 원격 플레이어 렌더링 (뷰포트 컬링 + LOD 자동)
 *   const { rendered, culled } = renderRemotePlayers(
 *     ctx, players, camera.x, camera.y,
 *     canvas.width, canvas.height, camera.zoom,
 *     onlineSync.state.pvpEnabled, culler
 *   );
 *
 *   // 2. PvP 이펙트 업데이트 + 렌더링
 *   pvpFx.update();
 *   pvpFx.renderWorldEffects(ctx, camera.x, camera.y, camera.zoom);
 *
 *   // 3. 스크린 UI (킬피드, 전쟁 테두리)
 *   if (onlineSync.state.pvpEnabled) {
 *     pvpFx.renderWarBorder(ctx, canvas.width, canvas.height, Date.now());
 *   }
 *   pvpFx.renderKillFeed(ctx, canvas.width);
 * }
 * ```
 */

// ─── Types ───
export type {
  NationColorSet,
  RemotePlayerRenderParams,
  NametagRenderParams,
  HitEffect,
  KillNotification,
  DamageNumber,
  ViewportBounds,
  CullingResult,
  LODThresholds,
} from './types';

// ─── Constants ───
export {
  // 디자인 시스템
  BG_DARK,
  MILITARY_GOLD,
  MILITARY_GREEN,
  WAR_RED,
  TEXT_OFFWHITE,
  ALLY_BLUE,
  ENEMY_RED,
  NEUTRAL_GRAY,
  // 폰트
  FONT_DISPLAY,
  FONT_BODY,
  FONT_MONO,
  // 국적 유틸
  NATION_COLORS,
  NATION_FLAGS,
  DEFAULT_NATION_COLOR,
  getNationColor,
  getNationFlag,
  // 렌더링 상수
  REMOTE_PLAYER_SIZE,
  NAMETAG_OFFSET_Y,
  HP_BAR_WIDTH,
  HP_BAR_HEIGHT,
  LEVEL_BADGE_SIZE,
  // 이펙트 상수
  HIT_EFFECT_DURATION,
  KILL_EFFECT_DURATION,
  DAMAGE_NUMBER_DURATION,
  KILLFEED_MAX_ENTRIES,
  // LOD/뷰포트 상수
  DEFAULT_LOD_THRESHOLDS,
  VIEWPORT_PADDING,
  // 전쟁 시각
  WAR_BORDER_COLOR,
  WAR_BORDER_WIDTH,
  WAR_COUNTDOWN_COLOR,
} from './constants';

// ─── Remote Player Rendering ───
export {
  renderRemotePlayer,
  renderRemotePlayers,
} from './remote-player';

// ─── Nametag ───
export { renderNametag } from './nametag';

// ─── PvP Effects ───
export { PvpEffectsManager } from './pvp-effects';

// ─── Viewport Culling ───
export {
  ViewportCuller,
  LOD_HIGH,
  LOD_MID,
  LOD_LOW,
} from './viewport-culler';

// ─── Integration Bridge (Phase 4 통합) ───
export {
  MultiplayerRenderer,
} from './multiplayer-integration';
export type {
  MultiplayerRendererConfig,
  MultiplayerRenderContext,
  MultiplayerRenderStats,
} from './multiplayer-integration';
