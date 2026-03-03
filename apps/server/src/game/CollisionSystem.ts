/**
 * CollisionSystem — 경계/머리-몸통/머리-머리 충돌 감지 + 사망 처리
 * v4: 모든 충돌에서 mass 비율 기반 흡수 메카닉
 *   - 1.5배 이상 크면 → 큰 뱀 생존, 작은 뱀 흡수
 *   - 비슷하면 → 머리→몸통: 머리 쪽 사망 / 머리→머리: 양쪽 사망
 */

import type { ArenaConfig } from '@snake-arena/shared';
import { distanceFromOrigin, distanceSq } from '@snake-arena/shared';
import type { SnakeEntity } from './Snake';
import type { OrbManager } from './OrbManager';
import type { SpatialHash } from './SpatialHash';

export interface DeathEvent {
  snakeId: string;
  killerId?: string;
  absorbed?: boolean;
}

/** 흡수 임계값 — 1.2배 이상 크면 흡수 */
const ABSORB_MASS_RATIO = 1.2;
/** 흡수 시 피해자 mass 중 흡수되는 비율 */
const ABSORB_EFFICIENCY = 0.8;

export class CollisionSystem {
  detectAll(
    snakes: Map<string, SnakeEntity>,
    spatialHash: SpatialHash,
    config: ArenaConfig,
  ): DeathEvent[] {
    const deaths: DeathEvent[] = [];

    for (const snake of snakes.values()) {
      if (!snake.isAlive) continue;
      const head = snake.head;

      // 경계 충돌 — 크기 무관, 무조건 사망
      if (distanceFromOrigin(head) >= config.radius) {
        deaths.push({ snakeId: snake.data.id });
        continue;
      }

      // ghost 효과: 다른 뱀 몸통 충돌 스킵
      if (!snake.hasEffect('ghost')) {
        const nearby = spatialHash.querySegments(head, config.headRadius * 2);
        for (const entry of nearby) {
          if (entry.snakeId === snake.data.id) continue;
          const dx = head.x - entry.x;
          const dy = head.y - entry.y;
          const distSqVal = dx * dx + dy * dy;
          const collisionR = config.headRadius;
          if (distSqVal < collisionR * collisionR) {
            // 머리→몸통: mass 비율 체크
            const other = snakes.get(entry.snakeId);
            if (other && snake.data.mass / other.data.mass >= ABSORB_MASS_RATIO) {
              // 내가 1.5배 이상 크다 → 상대가 죽고 내가 흡수
              deaths.push({ snakeId: other.data.id, killerId: snake.data.id, absorbed: true });
            } else {
              // 비슷하거나 상대가 더 크다 → 기존대로 머리 쪽(나) 사망
              deaths.push({ snakeId: snake.data.id, killerId: entry.snakeId });
            }
            break;
          }
        }
      }
    }

    // Head-to-head — mass 비율 기반
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

          const ratio = a.data.mass / b.data.mass;

          if (ratio >= ABSORB_MASS_RATIO) {
            if (!bAlreadyDead) deaths.push({ snakeId: b.data.id, killerId: a.data.id, absorbed: true });
          } else if (1 / ratio >= ABSORB_MASS_RATIO) {
            if (!aAlreadyDead) deaths.push({ snakeId: a.data.id, killerId: b.data.id, absorbed: true });
          } else {
            if (!aAlreadyDead) deaths.push({ snakeId: a.data.id });
            if (!bAlreadyDead) deaths.push({ snakeId: b.data.id });
          }
        }
      }
    }

    return deaths;
  }

  processDeaths(
    deaths: DeathEvent[],
    snakes: Map<string, SnakeEntity>,
    orbManager: OrbManager,
    tick: number,
  ): void {
    for (const death of deaths) {
      const snake = snakes.get(death.snakeId);
      if (!snake || !snake.isAlive) continue;

      const victimMass = snake.data.mass;

      if (death.absorbed && death.killerId) {
        const killer = snakes.get(death.killerId);
        if (killer?.isAlive) {
          killer.addMass(victimMass * ABSORB_EFFICIENCY);
          killer.data.kills++;
        }
        snake.die();
      } else {
        orbManager.decomposeSnake(snake.data.segments, victimMass, tick);
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
}
