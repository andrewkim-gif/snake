/**
 * CollisionSystem — 경계/머리-몸통/머리-머리 충돌 감지 + 사망 처리
 * Arena.ts에서 추출
 */

import type { ArenaConfig } from '@snake-arena/shared';
import { distanceFromOrigin, distanceSq } from '@snake-arena/shared';
import type { SnakeEntity } from './Snake';
import type { OrbManager } from './OrbManager';
import type { SpatialHash } from './SpatialHash';

export interface DeathEvent {
  snakeId: string;
  killerId?: string;
}

export class CollisionSystem {
  /** 모든 충돌 감지 — boundary + head-body + head-to-head */
  detectAll(
    snakes: Map<string, SnakeEntity>,
    spatialHash: SpatialHash,
    config: ArenaConfig,
  ): DeathEvent[] {
    const deaths: DeathEvent[] = [];

    for (const snake of snakes.values()) {
      if (!snake.isAlive) continue;
      const head = snake.head;

      // 경계 충돌
      if (distanceFromOrigin(head) >= config.radius) {
        deaths.push({ snakeId: snake.data.id });
        continue;
      }

      // 머리 vs 다른 뱀 세그먼트
      const nearby = spatialHash.querySegments(head, config.headRadius * 2);
      for (const entry of nearby) {
        if (entry.snakeId === snake.data.id) continue;
        const dx = head.x - entry.x;
        const dy = head.y - entry.y;
        const distSqVal = dx * dx + dy * dy;
        const collisionR = config.headRadius;
        if (distSqVal < collisionR * collisionR) {
          deaths.push({ snakeId: snake.data.id, killerId: entry.snakeId });
          break;
        }
      }
    }

    // Head-to-head 충돌 (양쪽 사망)
    const aliveSnakes = Array.from(snakes.values()).filter(s => s.isAlive);
    for (let i = 0; i < aliveSnakes.length; i++) {
      for (let j = i + 1; j < aliveSnakes.length; j++) {
        const a = aliveSnakes[i];
        const b = aliveSnakes[j];
        const dSq = distanceSq(a.head, b.head);
        const threshold = config.headRadius * 2;
        if (dSq < threshold * threshold) {
          const aAlreadyDead = deaths.some(d => d.snakeId === a.data.id);
          const bAlreadyDead = deaths.some(d => d.snakeId === b.data.id);
          if (!aAlreadyDead) deaths.push({ snakeId: a.data.id });
          if (!bAlreadyDead) deaths.push({ snakeId: b.data.id });
        }
      }
    }

    return deaths;
  }

  /** 사망 이벤트 처리 — orb 분해 + killer 킬카운트 */
  processDeaths(
    deaths: DeathEvent[],
    snakes: Map<string, SnakeEntity>,
    orbManager: OrbManager,
    tick: number,
  ): void {
    for (const death of deaths) {
      const snake = snakes.get(death.snakeId);
      if (!snake || !snake.isAlive) continue;
      orbManager.decomposeSnake(snake.data.segments, snake.data.mass, tick);
      snake.die();

      if (death.killerId) {
        const killer = snakes.get(death.killerId);
        if (killer?.isAlive) {
          killer.data.kills++;
        }
      }
    }
  }
}
