/**
 * CollisionSystem — 경계/머리-몸통/머리-머리 충돌 감지 + 사망 처리
 * v4: head-to-head에서 mass 비율 기반 흡수 메카닉
 */

import type { ArenaConfig } from '@snake-arena/shared';
import { distanceFromOrigin, distanceSq } from '@snake-arena/shared';
import type { SnakeEntity } from './Snake';
import type { OrbManager } from './OrbManager';
import type { SpatialHash } from './SpatialHash';

export interface DeathEvent {
  snakeId: string;
  killerId?: string;
  /** true면 killer가 mass를 직접 흡수 (orb 분해 없이) */
  absorbed?: boolean;
}

/** head-to-head 흡수 임계값 — 1.5배 이상 크면 흡수 */
const ABSORB_MASS_RATIO = 1.5;
/** 흡수 시 피해자 mass 중 흡수되는 비율 */
const ABSORB_EFFICIENCY = 0.8;

export class CollisionSystem {
  /** 모든 충돌 감지 — boundary + head-body + head-to-head (mass 기반) */
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
            // 머리→몸통: 무조건 머리 쪽 사망 (snake.io 핵심 메카닉)
            deaths.push({ snakeId: snake.data.id, killerId: entry.snakeId });
            break;
          }
        }
      }
    }

    // Head-to-head 충돌 — mass 비율 기반 흡수
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

          const massA = a.data.mass;
          const massB = b.data.mass;
          const ratio = massA / massB;

          if (ratio >= ABSORB_MASS_RATIO) {
            // A가 충분히 크다 → B 사망, A가 흡수
            if (!bAlreadyDead) deaths.push({ snakeId: b.data.id, killerId: a.data.id, absorbed: true });
          } else if (1 / ratio >= ABSORB_MASS_RATIO) {
            // B가 충분히 크다 → A 사망, B가 흡수
            if (!aAlreadyDead) deaths.push({ snakeId: a.data.id, killerId: b.data.id, absorbed: true });
          } else {
            // 비슷한 크기 → 양쪽 사망 (기존 로직)
            if (!aAlreadyDead) deaths.push({ snakeId: a.data.id });
            if (!bAlreadyDead) deaths.push({ snakeId: b.data.id });
          }
        }
      }
    }

    return deaths;
  }

  /** 사망 이벤트 처리 — orb 분해 또는 직접 흡수 + killer 킬카운트 */
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
        // 흡수: killer가 직접 mass 흡수 (orb 분해 없이)
        const killer = snakes.get(death.killerId);
        if (killer?.isAlive) {
          killer.addMass(victimMass * ABSORB_EFFICIENCY);
          killer.data.kills++;
        }
        snake.die();
      } else {
        // 일반 사망: orb로 분해
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
