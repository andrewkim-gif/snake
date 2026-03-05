/**
 * BotBehaviors v10 — 함수형 행동 트리 노드
 * 우선순위: Survive > Hunt > Gather > Wander
 * v10: Snake→Agent 호환 (position 필드 사용)
 */

import type { ArenaConfig, Position, Agent } from '@snake-arena/shared';

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

/** 엔티티 위치 추출 (Agent.position 또는 Snake.segments[0]) */
function getEntityPos(entity: any): Position {
  if (entity.position) return entity.position;
  if (entity.segments && entity.segments.length > 0) return entity.segments[0];
  return { x: 0, y: 0 };
}

/** P0: 생존 — 경계 회피 + 위협 회피 */
export function behaveSurvive(
  agent: any, // Agent 또는 Snake
  config: ArenaConfig,
  nearbyAgents: any[], // Agent[] 또는 Snake[]
): BotAction | null {
  const pos = getEntityPos(agent);
  const distFromCenter = Math.sqrt(pos.x * pos.x + pos.y * pos.y);
  const distRatio = distFromCenter / config.radius;

  // 경계 회피 — 85% 이상이면 중앙 + 랜덤 오프셋으로 우회
  if (distRatio > 0.85) {
    const centerAngle = Math.atan2(-pos.y, -pos.x);
    const offset = (Math.random() - 0.5) * Math.PI * 0.5;
    return {
      targetAngle: centerAngle + offset,
      boost: distRatio > 0.92,
    };
  }

  // 위협 회피 — 진짜 위험한 경우만 (1.5배 이상 큰 에이전트가 80px 이내)
  for (const other of nearbyAgents) {
    if (other.id === agent.id || !other.alive) continue;
    const otherPos = getEntityPos(other);
    const dist = distance(pos, otherPos);

    if (dist < 80 && other.mass > agent.mass * 1.5) {
      const angleToMe = Math.atan2(pos.y - otherPos.y, pos.x - otherPos.x);
      const headingToMe = Math.atan2(otherPos.y - pos.y, otherPos.x - pos.x);
      let headingDiff = other.heading - headingToMe;
      headingDiff = ((headingDiff + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      if (Math.abs(headingDiff) < Math.PI / 2) {
        return {
          targetAngle: angleToMe,
          boost: agent.mass > config.minBoostMass + 5,
        };
      }
    }
  }

  return null;
}

/** P1: 사냥 — 취약 타겟 추적 (Medium/Hard) */
export function behaveHunt(
  agent: any,
  difficulty: BotDifficulty,
  nearbyAgents: any[],
  config: ArenaConfig,
): BotAction | null {
  if (difficulty === 'easy') return null;
  if (agent.mass < 40) return null;

  const pos = getEntityPos(agent);
  let bestTarget: any | null = null;
  let bestDist = 300;

  for (const other of nearbyAgents) {
    if (other.id === agent.id || !other.alive) continue;
    if (other.mass > agent.mass * 0.5) continue;
    const otherPos = getEntityPos(other);
    const dist = distance(pos, otherPos);
    if (dist < bestDist) {
      bestDist = dist;
      bestTarget = other;
    }
  }

  if (!bestTarget) return null;

  const targetPos = getEntityPos(bestTarget);

  if (difficulty === 'hard') {
    const predictDist = 60;
    const predictX = targetPos.x + Math.cos(bestTarget.heading) * predictDist;
    const predictY = targetPos.y + Math.sin(bestTarget.heading) * predictDist;
    return {
      targetAngle: Math.atan2(predictY - pos.y, predictX - pos.x),
      boost: bestDist < 150,
    };
  }

  return {
    targetAngle: Math.atan2(targetPos.y - pos.y, targetPos.x - pos.x),
    boost: bestDist < 120 && agent.mass > config.minBoostMass + 10,
  };
}

/** P2: 수집 — 파워업 > death 오브 > 일반 오브 */
export function behaveGather(
  agent: any,
  difficulty: BotDifficulty,
  nearestOrb: Position | null,
  nearestPowerUp: Position | null,
  nearestDeathOrb: Position | null,
  mapRadius: number,
): BotAction | null {
  const pos = getEntityPos(agent);
  const headDist = Math.sqrt(pos.x * pos.x + pos.y * pos.y);
  const headRatio = headDist / mapRadius;

  const isOrbTooFar = (orbPos: Position): boolean => {
    if (headRatio < 0.7) return false;
    const orbDist = Math.sqrt(orbPos.x * orbPos.x + orbPos.y * orbPos.y);
    return orbDist / mapRadius > 0.8;
  };

  if (difficulty === 'hard' && nearestPowerUp && !isOrbTooFar(nearestPowerUp)) {
    return {
      targetAngle: Math.atan2(nearestPowerUp.y - pos.y, nearestPowerUp.x - pos.x),
      boost: false,
    };
  }

  if (nearestDeathOrb && !isOrbTooFar(nearestDeathOrb)) {
    return {
      targetAngle: Math.atan2(nearestDeathOrb.y - pos.y, nearestDeathOrb.x - pos.x),
      boost: false,
    };
  }

  if (nearestOrb && !isOrbTooFar(nearestOrb)) {
    return {
      targetAngle: Math.atan2(nearestOrb.y - pos.y, nearestOrb.x - pos.x),
      boost: false,
    };
  }

  return null;
}

/** P3: 배회 — 더 자연스러운 이동 */
export function behaveWander(
  wanderAngle: number,
  wanderTimer: number,
  headPos: Position,
  mapRadius: number,
): { action: BotAction; newAngle: number; newTimer: number } {
  let angle = wanderAngle;
  let timer = wanderTimer + 1;

  angle += (Math.random() - 0.5) * 0.08;

  const distRatio = Math.sqrt(headPos.x * headPos.x + headPos.y * headPos.y) / mapRadius;
  if (distRatio > 0.65) {
    const centerAngle = Math.atan2(-headPos.y, -headPos.x);
    const bias = (distRatio - 0.65) * 2.0;
    const diff = centerAngle - angle;
    const wrapped = ((diff + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    angle += wrapped * bias * 0.1;
  }

  if (timer > 20 + Math.random() * 30) {
    if (distRatio > 0.7) {
      const centerAngle = Math.atan2(-headPos.y, -headPos.x);
      angle = centerAngle + (Math.random() - 0.5) * Math.PI * 0.8;
    } else {
      angle += (Math.random() - 0.5) * Math.PI * 1.2;
    }
    timer = 0;
  }

  return {
    action: { targetAngle: angle, boost: false },
    newAngle: angle,
    newTimer: timer,
  };
}
