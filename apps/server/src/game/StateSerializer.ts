/**
 * StateSerializer — 뷰포트 컬링 + 직렬화 + 미니맵
 * Arena.ts에서 추출
 */

import type {
  LeaderboardEntry, SnakeNetworkData, OrbNetworkData,
  StatePayload, MinimapPayload, OrbType,
} from '@snake-arena/shared';
import { NETWORK } from '@snake-arena/shared';
import type { SnakeEntity } from './Snake';
import type { OrbManager } from './OrbManager';
import type { SpatialHash } from './SpatialHash';

export class StateSerializer {
  private static readonly ORB_TYPE_MAP: Record<OrbType, number> = {
    natural: 0, death: 1, boost_trail: 2,
    magnet: 3, speed: 4, ghost: 5, mega: 6,
  };

  private static readonly EFFECT_TYPE_MAP = { magnet: 0, speed: 1, ghost: 2 } as const;
  /** 플레이어별 뷰포트 기반 state 생성 */
  getStateForPlayer(
    playerId: string,
    viewportWidth: number,
    viewportHeight: number,
    snakes: Map<string, SnakeEntity>,
    orbManager: OrbManager,
    spatialHash: SpatialHash,
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
        visibleSnakes.push(this.serializeSnake(other, tick));
      }
    }

    // 뷰포트 내 orb — SpatialHash 쿼리 (전체 순회 대신)
    const queryRadius = Math.max(halfW, halfH);
    const nearbyOrbs = spatialHash.queryOrbs(center, queryRadius);
    const visibleOrbs: OrbNetworkData[] = [];
    for (const orb of nearbyOrbs) {
      if (Math.abs(orb.position.x - center.x) < halfW &&
          Math.abs(orb.position.y - center.y) < halfH) {
        visibleOrbs.push({
          x: Math.round(orb.position.x),
          y: Math.round(orb.position.y),
          v: orb.value,
          c: orb.color,
          t: StateSerializer.ORB_TYPE_MAP[orb.type],
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

  private serializeSnake(snake: SnakeEntity, tick: number): SnakeNetworkData {
    // segments.map() 대신 for 루프 — 클로저/중간 배열 생성 감소
    const segs = snake.data.segments;
    const points: [number, number][] = new Array(segs.length);
    for (let i = 0; i < segs.length; i++) {
      points[i] = [
        Math.round(segs[i].x * 10) / 10,
        Math.round(segs[i].y * 10) / 10,
      ];
    }

    const data: SnakeNetworkData = {
      i: snake.data.id,
      n: snake.data.name,
      h: Math.round(snake.data.heading * 100) / 100,
      m: snake.data.mass,
      b: snake.data.boosting,
      k: snake.data.skin.id,
      p: points,
    };

    if (snake.data.activeEffects.length > 0) {
      data.e = snake.data.activeEffects.flatMap(e => [
        StateSerializer.EFFECT_TYPE_MAP[e.type],
        Math.max(0, e.expiresAt - tick),
      ]);
    }

    return data;
  }
}
