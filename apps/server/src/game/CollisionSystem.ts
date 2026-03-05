/**
 * CollisionSystem v10 — 오라/대시 기반 전투 시스템
 * 세그먼트 기반 충돌 → 히트박스 오라 전투로 전면 교체
 *
 * 전투 모델:
 * - 오라-오라 충돌: 양쪽 DPS 교환 (60px 반경)
 * - 대시 충돌: 부스트 돌진 → mass 30% 즉시 피해
 * - 경계 충돌: 수축 경계 밖 → mass 패널티 (ArenaShrink에서 처리)
 */

import type { ArenaConfig, DamageSource } from '@snake-arena/shared';
import { COMBAT_CONFIG } from '@snake-arena/shared';
import type { AgentEntity } from './AgentEntity';
import type { OrbManager } from './OrbManager';
import type { SpatialHash } from './SpatialHash';

export interface DeathEvent {
  snakeId: string;       // 하위 호환: snakeId 유지 (agentId 역할)
  killerId?: string;
  absorbed?: boolean;
  damageSource?: DamageSource; // v10: 사망 원인
}

export class CollisionSystem {
  /**
   * v10: 오라 전투 처리 — 매 틱 호출
   * 기존 detectAll()은 즉사 방식이었지만, v10은 점진적 DPS로 변경
   * 사망 이벤트는 mass <= 0 체크로 발생
   */
  processAuraCombat(
    agents: Map<string, AgentEntity>,
    spatialHash: SpatialHash,
    config: ArenaConfig,
    currentTick: number,
    gracePeriodTicks: number,
  ): void {
    for (const agent of agents.values()) {
      if (!agent.isAlive) continue;

      // Grace period 동안 전투 면역
      const ticksSinceJoin = currentTick - (agent.data.joinedAt / 50); // 대략적 틱 변환
      if (ticksSinceJoin < gracePeriodTicks && agent.data.level <= 1) continue;

      // Shield Burst 무적 체크
      if (agent.hasEffect('ghost')) continue;

      const pos = agent.position;
      const nearbyAgents = spatialHash.queryAgents(pos, config.auraRadius);

      for (const entry of nearbyAgents) {
        if (entry.agentId === agent.data.id) continue;

        const other = agents.get(entry.agentId);
        if (!other || !other.isAlive) continue;
        if (other.hasEffect('ghost')) continue;

        const dx = pos.x - entry.x;
        const dy = pos.y - entry.y;
        const distSq = dx * dx + dy * dy;
        const auraR = config.auraRadius;

        if (distSq < auraR * auraR) {
          // 오라 범위 내 → DPS 교환
          const myDps = agent.getAuraDps(config);

          // 상대에게 데미지 적용
          other.takeDamage(myDps, agent.data.id);
        }
      }
    }
  }

  /**
   * v10: 대시(부스트) 충돌 처리
   * 부스트 상태로 상대 히트박스 범위 내 진입 → 상대 mass의 30% 즉시 피해
   */
  processDashCollisions(
    agents: Map<string, AgentEntity>,
    spatialHash: SpatialHash,
    config: ArenaConfig,
  ): void {
    for (const agent of agents.values()) {
      if (!agent.isAlive || !agent.data.boosting) continue;

      const pos = agent.position;
      const nearbyAgents = spatialHash.queryAgents(pos, config.hitboxMaxRadius * 2);

      for (const entry of nearbyAgents) {
        if (entry.agentId === agent.data.id) continue;

        const other = agents.get(entry.agentId);
        if (!other || !other.isAlive) continue;
        if (other.hasEffect('ghost')) continue;

        const dx = pos.x - entry.x;
        const dy = pos.y - entry.y;
        const distSq = dx * dx + dy * dy;
        const collisionR = agent.data.hitboxRadius + other.data.hitboxRadius;

        if (distSq < collisionR * collisionR) {
          // 대시 히트! 상대 mass의 30% 즉시 피해
          const dashDamage = other.data.mass * config.dashDamageRatio;
          other.takeDamage(dashDamage, agent.data.id);

          // Berserker 시너지: 대시 피해 ×3
          if (agent.data.activeSynergies.includes('berserker')) {
            other.takeDamage(dashDamage * 2, agent.data.id); // 추가 2배 (총 3배)
          }
        }
      }
    }
  }

  /**
   * v10: 사망 체크 — mass <= 0인 에이전트를 DeathEvent로 변환
   * 기존 detectAll + processDeaths를 대체
   */
  detectDeaths(
    agents: Map<string, AgentEntity>,
    currentRadius: number,
  ): DeathEvent[] {
    const deaths: DeathEvent[] = [];

    for (const agent of agents.values()) {
      if (!agent.isAlive) continue;

      // 경계 사망 (수축된 경계 기준)
      const { x, y } = agent.position;
      const dist = Math.sqrt(x * x + y * y);
      if (dist > currentRadius * 1.1) {
        // 경계 밖 10% 이상 벗어나면 즉사
        deaths.push({
          snakeId: agent.data.id,
          killerId: undefined,
          damageSource: 'boundary',
        });
        continue;
      }

      // mass 0 사망
      if (agent.data.mass <= 0) {
        const killerId = agent.data.lastDamagedBy;
        const wasAura = killerId != null;
        deaths.push({
          snakeId: agent.data.id,
          killerId: killerId ?? undefined,
          damageSource: wasAura ? 'aura' : 'boundary',
        });
      }
    }

    return deaths;
  }

  /**
   * v10: 사망 처리 — DeathEvent를 받아 사망 처리 + XP 오브 생성
   */
  processDeaths(
    deaths: DeathEvent[],
    agents: Map<string, AgentEntity>,
    orbManager: OrbManager,
    tick: number,
  ): void {
    for (const death of deaths) {
      const agent = agents.get(death.snakeId);
      if (!agent || !agent.isAlive) continue;

      const victimMass = agent.data.mass;
      const victimPos = agent.position;

      // 사망 오브 생성 — position 기반 (segments 없음)
      orbManager.decomposeAgent(victimPos, victimMass, tick);

      agent.die();

      // 킬러에게 보상
      if (death.killerId) {
        const killer = agents.get(death.killerId);
        if (killer?.isAlive) {
          killer.data.kills++;
          killer.data.killStreak++;

          // Vampire 시너지: 독 킬 시 mass 회복
          if (killer.data.activeSynergies.includes('vampire') && death.damageSource === 'venom') {
            killer.addMass(victimMass * 0.20);
          }
        }
      }
    }
  }

  // ─── 하위 호환 메서드 (기존 Arena.ts에서 호출) ───

  /** @deprecated v10: processAuraCombat + detectDeaths 사용 */
  detectAll(
    snakes: Map<string, any>,
    spatialHash: SpatialHash,
    config: ArenaConfig,
  ): DeathEvent[] {
    // v10에서는 오라 전투가 별도로 처리되므로,
    // 이 메서드는 경계/mass 0 사망만 체크
    const deaths: DeathEvent[] = [];
    for (const snake of snakes.values()) {
      if (!snake.isAlive) continue;
      const pos = snake.position || snake.head;
      if (!pos) continue;
      const dist = Math.sqrt(pos.x * pos.x + pos.y * pos.y);
      if (dist >= config.radius) {
        deaths.push({ snakeId: snake.data.id, damageSource: 'boundary' });
      }
    }
    return deaths;
  }
}
