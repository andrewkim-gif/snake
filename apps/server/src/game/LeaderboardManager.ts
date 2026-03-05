/**
 * LeaderboardManager — 리더보드 정렬/캐싱
 * Arena.ts에서 추출
 */

import type { LeaderboardEntry } from '@snake-arena/shared';
import type { AgentEntity } from './AgentEntity';

export class LeaderboardManager {
  private entries: LeaderboardEntry[] = [];

  /** v10: 에이전트 기반 리더보드 갱신 */
  updateFromAgents(agents: Map<string, AgentEntity>): void {
    const list: LeaderboardEntry[] = [];
    for (const agent of agents.values()) {
      if (!agent.isAlive) continue;
      list.push({
        id: agent.data.id,
        name: agent.data.name,
        score: agent.data.score,
        kills: agent.data.kills,
        rank: 0,
      });
    }
    list.sort((a, b) => b.score - a.score);
    for (let i = 0; i < list.length; i++) {
      list[i].rank = i + 1;
    }
    this.entries = list.slice(0, 10);
  }

  /** @deprecated v10: updateFromAgents 사용 */
  update(entities: Map<string, any>): void {
    const list: LeaderboardEntry[] = [];
    for (const entity of entities.values()) {
      if (!entity.isAlive) continue;
      list.push({
        id: entity.data.id,
        name: entity.data.name,
        score: entity.data.score,
        kills: entity.data.kills,
        rank: 0,
      });
    }
    list.sort((a, b) => b.score - a.score);
    for (let i = 0; i < list.length; i++) {
      list[i].rank = i + 1;
    }
    this.entries = list.slice(0, 10);
  }

  getEntries(): LeaderboardEntry[] {
    return this.entries;
  }

  getRank(playerId: string, totalPlayers: number): number {
    const idx = this.entries.findIndex(e => e.id === playerId);
    return idx >= 0 ? idx + 1 : totalPlayers;
  }
}
