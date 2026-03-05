/**
 * StateSerializer v10 — 뷰포트 컬링 + 직렬화 + 미니맵
 * Snake→Agent: segments → position 직렬화
 * 하위 호환: AgentNetworkData.p (segments) 필드를 position에서 생성
 */

import type {
  LeaderboardEntry, AgentNetworkData, OrbNetworkData,
  StatePayload, MinimapPayload, OrbType,
} from '@snake-arena/shared';
import { NETWORK } from '@snake-arena/shared';
import type { AgentEntity } from './AgentEntity';
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
    agents: Map<string, AgentEntity>,
    orbManager: OrbManager,
    spatialHash: SpatialHash,
    leaderboard: LeaderboardEntry[],
    tick: number,
  ): StatePayload | null {
    const agent = agents.get(playerId);
    if (!agent) return null;

    const center = agent.isAlive ? agent.position : { x: 0, y: 0 };
    const margin = NETWORK.VIEWPORT_MARGIN;
    const halfW = viewportWidth / 2 + margin;
    const halfH = viewportHeight / 2 + margin;

    // 뷰포트 내 에이전트 필터링
    const visibleSnakes: AgentNetworkData[] = [];
    for (const other of agents.values()) {
      if (!other.isAlive) continue;
      if (Math.abs(other.position.x - center.x) < halfW + 500 &&
          Math.abs(other.position.y - center.y) < halfH + 500) {
        visibleSnakes.push(this.serializeAgent(other, tick));
      }
    }

    // 뷰포트 내 orb — SpatialHash 쿼리
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

  /** minimap 데이터 (1Hz, 모든 에이전트 위치) */
  getMinimapForPlayer(
    playerId: string,
    agents: Map<string, AgentEntity>,
    radius: number,
  ): MinimapPayload {
    const result: MinimapPayload['snakes'] = [];
    for (const agent of agents.values()) {
      if (!agent.isAlive) continue;
      result.push({
        x: Math.round(agent.position.x),
        y: Math.round(agent.position.y),
        m: agent.data.mass,
        me: agent.data.id === playerId,
      });
    }
    return { snakes: result, boundary: radius };
  }

  /** death 이벤트 데이터 조회 */
  getDeathInfo(
    playerId: string,
    agents: Map<string, AgentEntity>,
    leaderboard: LeaderboardEntry[],
  ): { score: number; length: number; kills: number; duration: number; rank: number; level: number } | null {
    const agent = agents.get(playerId);
    if (!agent) return null;
    return {
      score: agent.data.score,
      length: 1, // v10: 세그먼트 없음, 하위 호환을 위해 1 반환
      kills: agent.data.kills,
      duration: Math.floor((Date.now() - agent.data.joinedAt) / 1000),
      rank: leaderboard.findIndex(e => e.id === playerId) + 1 || agents.size,
      level: agent.data.level,
    };
  }

  /**
   * v10: Agent → AgentNetworkData 직렬화
   * 하위 호환: p(segments) 필드를 position에서 단일 포인트 배열로 생성
   */
  private serializeAgent(agent: AgentEntity, tick: number): AgentNetworkData {
    const pos = agent.position;
    const point: [number, number] = [
      Math.round(pos.x * 10) / 10,
      Math.round(pos.y * 10) / 10,
    ];

    const data: AgentNetworkData = {
      i: agent.data.id,
      n: agent.data.name,
      x: point[0],
      y: point[1],
      h: Math.round(agent.data.heading * 100) / 100,
      m: agent.data.mass,
      b: agent.data.boosting,
      k: agent.data.skin.id,
      lv: agent.data.level,
      p: [point], // 하위 호환 (segments 형태)
    };

    if (agent.data.activeEffects.length > 0) {
      data.e = agent.data.activeEffects.flatMap(e => [
        StateSerializer.EFFECT_TYPE_MAP[e.type],
        Math.max(0, e.expiresAt - tick),
      ]);
    }

    return data;
  }
}
