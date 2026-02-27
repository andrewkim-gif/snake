/**
 * LeaderboardManager — 리더보드 정렬/캐싱
 * Arena.ts에서 추출
 */

import type { LeaderboardEntry } from '@snake-arena/shared';
import type { SnakeEntity } from './Snake';

export class LeaderboardManager {
  private entries: LeaderboardEntry[] = [];

  /** 리더보드 갱신 — 살아있는 뱀들의 score 기준 상위 10명 */
  update(snakes: Map<string, SnakeEntity>): void {
    const list: LeaderboardEntry[] = [];
    for (const snake of snakes.values()) {
      if (!snake.isAlive) continue;
      list.push({
        id: snake.data.id,
        name: snake.data.name,
        score: snake.data.score,
        kills: snake.data.kills,
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
