/**
 * StateSerializer — 뷰포트 컬링 + 직렬화 + 미니맵
 * Arena.ts에서 추출
 */

import type {
  LeaderboardEntry, SnakeNetworkData, OrbNetworkData,
  StatePayload, MinimapPayload,
} from '@snake-arena/shared';
import { NETWORK } from '@snake-arena/shared';
import type { SnakeEntity } from './Snake';
import type { OrbManager } from './OrbManager';

export class StateSerializer {
  /** 플레이어별 뷰포트 기반 state 생성 */
  getStateForPlayer(
    playerId: string,
    viewportWidth: number,
    viewportHeight: number,
    snakes: Map<string, SnakeEntity>,
    orbManager: OrbManager,
    leaderboard: LeaderboardEntry[],
    tick: number,
  ): StatePayload | null {
    const snake = snakes.get(playerId);
    if (!snake) return null;

    const center = snake.isAlive ? snake.head : { x: 0, y: 0 };
    const margin = NETWORK.VIEWPORT_MARGIN;
    const halfW = viewportWidth / 2 + margin;
    const halfH = viewportHeight / 2 + margin;

    // 뷰포트 내 뱀 필터링
    const visibleSnakes: SnakeNetworkData[] = [];
    for (const other of snakes.values()) {
      if (!other.isAlive) continue;
      if (Math.abs(other.head.x - center.x) < halfW + 500 &&
          Math.abs(other.head.y - center.y) < halfH + 500) {
        visibleSnakes.push(this.serializeSnake(other));
      }
    }

    // 뷰포트 내 orb 필터링
    const visibleOrbs: OrbNetworkData[] = [];
    for (const orb of orbManager.getAll()) {
      if (Math.abs(orb.position.x - center.x) < halfW &&
          Math.abs(orb.position.y - center.y) < halfH) {
        visibleOrbs.push({
          x: Math.round(orb.position.x),
          y: Math.round(orb.position.y),
          v: orb.value,
          c: orb.color,
          t: orb.type === 'natural' ? 0 : orb.type === 'death' ? 1 : 2,
        });
      }
    }

    const payload: StatePayload = {
      t: tick,
      s: visibleSnakes,
      o: visibleOrbs,
    };

    if (tick % NETWORK.LEADERBOARD_INTERVAL === 0) {
      payload.l = leaderboard;
    }

    return payload;
  }

  /** minimap 데이터 (1Hz, 모든 뱀 위치) */
  getMinimapForPlayer(
    playerId: string,
    snakes: Map<string, SnakeEntity>,
    radius: number,
  ): MinimapPayload {
    const result: MinimapPayload['snakes'] = [];
    for (const snake of snakes.values()) {
      if (!snake.isAlive) continue;
      result.push({
        x: Math.round(snake.head.x),
        y: Math.round(snake.head.y),
        m: snake.data.mass,
        me: snake.data.id === playerId,
      });
    }
    return { snakes: result, boundary: radius };
  }

  /** death 이벤트 데이터 조회 */
  getDeathInfo(
    playerId: string,
    snakes: Map<string, SnakeEntity>,
    leaderboard: LeaderboardEntry[],
  ): { score: number; length: number; kills: number; duration: number; rank: number } | null {
    const snake = snakes.get(playerId);
    if (!snake) return null;
    return {
      score: snake.data.score,
      length: snake.data.segments.length,
      kills: snake.data.kills,
      duration: Math.floor((Date.now() - snake.data.joinedAt) / 1000),
      rank: leaderboard.findIndex(e => e.id === playerId) + 1 || snakes.size,
    };
  }

  private serializeSnake(snake: SnakeEntity): SnakeNetworkData {
    return {
      i: snake.data.id,
      n: snake.data.name,
      h: Math.round(snake.data.heading * 100) / 100,
      m: snake.data.mass,
      b: snake.data.boosting,
      k: snake.data.skin.id,
      p: snake.data.segments.map(s => [
        Math.round(s.x * 10) / 10,
        Math.round(s.y * 10) / 10,
      ] as [number, number]),
    };
  }
}
