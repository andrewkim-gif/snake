/**
 * BotBehaviors — 함수형 행동 트리 노드
 * 우선순위: Survive > Hunt > Gather > Wander
 */

import type { Snake, ArenaConfig, Position } from '@snake-arena/shared';

export type BotDifficulty = 'easy' | 'medium' | 'hard';

export interface BotAction {
  targetAngle: number;
  boost: boolean;
}

function distance(a: Position, b: Position): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** P0: 생존 — 경계 회피 + 위협 회피 (조건 엄격화) */
export function behaveSurvive(
  snake: Snake,
  config: ArenaConfig,
  nearbySnakes: Snake[],
): BotAction | null {
  const head = snake.segments[0];
  const distFromCenter = Math.sqrt(head.x * head.x + head.y * head.y);

  // 경계 회피 — 85% 이상이면 중앙으로 (좁혀서 맵 활용도 증가)
  if (distFromCenter > config.radius * 0.85) {
    return { targetAngle: Math.atan2(-head.y, -head.x), boost: false };
  }

  // 위협 회피 — 진짜 위험한 경우만 (1.5배 이상 큰 뱀이 80px 이내)
  for (const other of nearbySnakes) {
    if (other.id === snake.id || !other.alive) continue;
    const otherHead = other.segments[0];
    const dist = distance(head, otherHead);

    // 상대가 나보다 1.5배 이상 크고, 80px 이내이고, 나를 향해 오는 중
    if (dist < 80 && other.mass > snake.mass * 1.5) {
      const angleToMe = Math.atan2(head.y - otherHead.y, head.x - otherHead.x);
      const headingDiff = Math.abs(other.heading - Math.atan2(otherHead.y - head.y, otherHead.x - head.x));
      // 상대가 대략 내 방향으로 오는지 체크 (±90도)
      if (headingDiff < Math.PI / 2 || headingDiff > Math.PI * 1.5) {
        return {
          targetAngle: angleToMe,
          boost: snake.mass > config.minBoostMass + 5,
        };
      }
    }
  }

  return null;
}

/** P1: 사냥 — 취약 타겟 추적 (Medium/Hard) */
export function behaveHunt(
  snake: Snake,
  difficulty: BotDifficulty,
  nearbySnakes: Snake[],
  config: ArenaConfig,
): BotAction | null {
  if (difficulty === 'easy') return null;
  if (snake.mass < 40) return null;

  const head = snake.segments[0];
  let bestTarget: Snake | null = null;
  let bestDist = 300;

  for (const other of nearbySnakes) {
    if (other.id === snake.id || !other.alive) continue;
    // 자신의 절반 이하인 타겟만 사냥
    if (other.mass > snake.mass * 0.5) continue;
    const dist = distance(head, other.segments[0]);
    if (dist < bestDist) {
      bestDist = dist;
      bestTarget = other;
    }
  }

  if (!bestTarget) return null;

  const targetHead = bestTarget.segments[0];

  if (difficulty === 'hard') {
    // 경로 예측
    const predictDist = 60;
    const predictX = targetHead.x + Math.cos(bestTarget.heading) * predictDist;
    const predictY = targetHead.y + Math.sin(bestTarget.heading) * predictDist;
    return {
      targetAngle: Math.atan2(predictY - head.y, predictX - head.x),
      boost: bestDist < 150,
    };
  }

  return {
    targetAngle: Math.atan2(targetHead.y - head.y, targetHead.x - head.x),
    boost: bestDist < 120 && snake.mass > config.minBoostMass + 10,
  };
}

/** P2: 수집 — 파워업 > death 오브 > 일반 오브 */
export function behaveGather(
  snake: Snake,
  difficulty: BotDifficulty,
  nearestOrb: Position | null,
  nearestPowerUp: Position | null,
  nearestDeathOrb: Position | null,
): BotAction | null {
  const head = snake.segments[0];

  if (difficulty === 'hard' && nearestPowerUp) {
    return {
      targetAngle: Math.atan2(nearestPowerUp.y - head.y, nearestPowerUp.x - head.x),
      boost: false,
    };
  }

  if (nearestDeathOrb) {
    return {
      targetAngle: Math.atan2(nearestDeathOrb.y - head.y, nearestDeathOrb.x - head.x),
      boost: false,
    };
  }

  if (nearestOrb) {
    return {
      targetAngle: Math.atan2(nearestOrb.y - head.y, nearestOrb.x - head.x),
      boost: false,
    };
  }

  return null;
}

/** P3: 배회 — 더 자연스러운 이동 */
export function behaveWander(wanderAngle: number, wanderTimer: number): { action: BotAction; newAngle: number; newTimer: number } {
  let angle = wanderAngle;
  let timer = wanderTimer + 1;

  // 매 틱 아주 미세한 방향 드리프트 (부드러운 곡선 이동)
  angle += (Math.random() - 0.5) * 0.08;

  // 20~50틱(1~2.5초)마다 큰 방향 전환
  if (timer > 20 + Math.random() * 30) {
    angle += (Math.random() - 0.5) * Math.PI * 1.2; // ±108도까지 전환
    timer = 0;
  }

  return {
    action: { targetAngle: angle, boost: false },
    newAngle: angle,
    newTimer: timer,
  };
}
