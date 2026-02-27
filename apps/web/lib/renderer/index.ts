/**
 * Renderer — 메인 진입점
 * 서브모듈 조합하여 render() 제공
 */

import { drawBackground, drawBoundary } from './background';
import { drawOrbs, drawSnakes } from './entities';
import { drawMinimap, drawLeaderboard, drawHUD } from './ui';
import type { RenderState } from './types';

export type { RenderState, KillFeedEntry } from './types';
export type { Camera } from './types';

export function render(
  ctx: CanvasRenderingContext2D,
  state: RenderState,
  playerId: string | null,
  cssW?: number,
  cssH?: number,
  dt = 0.016,
): void {
  const w = cssW ?? ctx.canvas.width;
  const h = cssH ?? ctx.canvas.height;

  drawBackground(ctx, state.camera, w, h);
  drawBoundary(ctx, state.camera, state.arenaRadius, w, h);

  // 내 뱀 머리 화면 좌표 계산 (orb 흡수 애니메이션용)
  const mySnake = state.snakes.find(s => s.i === playerId) || null;
  let myHeadScreen: { x: number; y: number } | null = null;
  if (mySnake && mySnake.p.length > 0) {
    myHeadScreen = {
      x: (mySnake.p[0][0] - state.camera.x) * state.camera.zoom + w / 2,
      y: (mySnake.p[0][1] - state.camera.y) * state.camera.zoom + h / 2,
    };
  }

  drawOrbs(ctx, state.orbs, state.camera, w, h, myHeadScreen);
  drawSnakes(ctx, state.snakes, state.camera, w, h, playerId, dt);

  // 내 순위 계산
  let playerRank = 0;
  if (playerId && mySnake) {
    const sorted = [...state.leaderboard].sort((a, b) => b.score - a.score);
    const idx = sorted.findIndex(e => e.id === playerId);
    playerRank = idx >= 0 ? idx + 1 : state.leaderboard.length + 1;
  }

  drawMinimap(ctx, state.minimap, w, h);
  drawLeaderboard(ctx, state.leaderboard, playerId, w);
  drawHUD(ctx, mySnake, state.killFeed, playerRank, state.playerCount, state.rtt, state.fps, w, h);
}
