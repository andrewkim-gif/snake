/**
 * AbilityProcessor v10 — 어빌리티 자동발동 처리
 * 6가지 어빌리티: Venom Aura, Shield Burst, Lightning Strike,
 *                 Speed Dash, Mass Drain, Gravity Well
 *
 * 레벨 스케일링: Lv2 +30%/-20%CD, Lv3 +60%/-40%CD, Lv4 +100%/-60%CD
 */

import type { ArenaConfig, AbilityType, Position } from '@snake-arena/shared';
import { ABILITY_DEFS, COMBAT_CONFIG } from '@snake-arena/shared';
import type { AgentEntity } from './AgentEntity';
import type { SpatialHash } from './SpatialHash';
import type { OrbManager } from './OrbManager';

// ─── Level Scaling ───

/** 어빌리티 레벨별 효과 배율 [1, 2, 3, 4] */
const LEVEL_DAMAGE_SCALE = [1.0, 1.3, 1.6, 2.0] as const;
/** 어빌리티 레벨별 쿨다운 감소율 [1, 2, 3, 4] */
const LEVEL_COOLDOWN_SCALE = [1.0, 0.8, 0.6, 0.4] as const;

function getEffectMultiplier(level: number): number {
  return LEVEL_DAMAGE_SCALE[Math.min(level, 4) - 1] ?? 1.0;
}

function getCooldownMultiplier(level: number): number {
  return LEVEL_COOLDOWN_SCALE[Math.min(level, 4) - 1] ?? 1.0;
}

/** 실제 쿨다운 틱 수 (레벨 + 시너지 반영) */
function getEffectiveCooldown(baseCooldownTicks: number, level: number, hasCooldownSynergy: boolean): number {
  let cd = baseCooldownTicks * getCooldownMultiplier(level);
  // Elemental 시너지: 모든 어빌리티 쿨다운 -40%
  if (hasCooldownSynergy) {
    cd *= 0.6;
  }
  return Math.floor(cd);
}

// ─── AbilityProcessor ───

export class AbilityProcessor {
  /**
   * 모든 에이전트의 어빌리티를 자동발동 처리
   * Arena의 gameLoop에서 오라 전투 후, 사망 감지 전에 호출
   */
  processAbilities(
    agents: Map<string, AgentEntity>,
    spatialHash: SpatialHash,
    orbManager: OrbManager,
    currentTick: number,
    config: ArenaConfig,
  ): void {
    for (const agent of agents.values()) {
      if (!agent.isAlive) continue;
      if (agent.data.build.abilities.length === 0) continue;

      const hasCdSynergy = agent.data.activeSynergies.includes('elemental');

      for (const slot of agent.data.build.abilities) {
        // 쿨다운 체크
        if (slot.cooldownUntil > currentTick) continue;

        switch (slot.type) {
          case 'venom_aura':
            this.processVenomAura(agent, agents, spatialHash, currentTick, config, slot.level);
            break;
          case 'shield_burst':
            if (this.processShieldBurst(agent, agents, spatialHash, currentTick, config, slot.level, hasCdSynergy)) {
              slot.cooldownUntil = currentTick + getEffectiveCooldown(
                ABILITY_DEFS.shield_burst.cooldownTicks, slot.level, hasCdSynergy,
              );
            }
            break;
          case 'lightning_strike':
            if (this.processLightningStrike(agent, agents, spatialHash, currentTick, config, slot.level, hasCdSynergy)) {
              slot.cooldownUntil = currentTick + getEffectiveCooldown(
                ABILITY_DEFS.lightning_strike.cooldownTicks, slot.level, hasCdSynergy,
              );
            }
            break;
          case 'speed_dash':
            if (this.processSpeedDash(agent, agents, spatialHash, currentTick, config, slot.level, hasCdSynergy)) {
              slot.cooldownUntil = currentTick + getEffectiveCooldown(
                ABILITY_DEFS.speed_dash.cooldownTicks, slot.level, hasCdSynergy,
              );
            }
            break;
          case 'mass_drain':
            if (this.processMassDrain(agent, agents, spatialHash, currentTick, config, slot.level, hasCdSynergy)) {
              slot.cooldownUntil = currentTick + getEffectiveCooldown(
                ABILITY_DEFS.mass_drain.cooldownTicks, slot.level, hasCdSynergy,
              );
            }
            break;
          case 'gravity_well':
            if (this.processGravityWell(agent, agents, spatialHash, orbManager, currentTick, config, slot.level, hasCdSynergy)) {
              slot.cooldownUntil = currentTick + getEffectiveCooldown(
                ABILITY_DEFS.gravity_well.cooldownTicks, slot.level, hasCdSynergy,
              );
            }
            break;
        }
      }
    }
  }

  // ─── 1. Venom Aura (패시브, 쿨다운 없음) ───

  /**
   * 항상 활성: 오라 범위 내 적에게 독 DoT 추가 적용
   * baseDamage: 15 mass/s → 0.75 mass/tick @ 20Hz
   */
  private processVenomAura(
    agent: AgentEntity,
    agents: Map<string, AgentEntity>,
    spatialHash: SpatialHash,
    currentTick: number,
    config: ArenaConfig,
    level: number,
  ): void {
    const venomDps = COMBAT_CONFIG.VENOM_DPS_PER_TICK * getEffectMultiplier(level);
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

      if (distSq < config.auraRadius * config.auraRadius) {
        other.takeDamage(venomDps, agent.data.id);
        // Vampire 시너지: 독 데미지의 20%를 mass 회복
        if (agent.data.activeSynergies.includes('vampire')) {
          const lifesteal = venomDps * (1 - other.getDamageReduction()) * 0.20;
          agent.addMass(lifesteal);
        }
      }
    }
  }

  // ─── 2. Shield Burst (HP < 30% 트리거) ───

  /**
   * 트리거: mass < initialMass의 30% 또는 mass가 최대 mass의 30% 이하
   * 효과: 3초 무적(ghost) + 주변 적 밀침
   * @returns 발동 여부
   */
  private processShieldBurst(
    agent: AgentEntity,
    agents: Map<string, AgentEntity>,
    spatialHash: SpatialHash,
    currentTick: number,
    config: ArenaConfig,
    level: number,
    hasCdSynergy: boolean,
  ): boolean {
    // 이미 무적 상태면 발동하지 않음
    if (agent.hasEffect('ghost')) return false;

    // HP 30% 이하 트리거 (score = peak mass 기준)
    const hpThreshold = Math.max(config.initialMass, agent.data.bestScore) * 0.30;
    if (agent.data.mass > hpThreshold) return false;

    // 무적 효과 부여 (3초 = 60틱, 레벨 스케일링으로 지속 증가)
    const durationTicks = Math.floor(ABILITY_DEFS.shield_burst.durationTicks * getEffectMultiplier(level));
    agent.addEffect('ghost', durationTicks, currentTick);

    // 주변 적 밀침
    const pushRadius = COMBAT_CONFIG.SHIELD_PUSH_RADIUS * getEffectMultiplier(level);
    const pushForce = COMBAT_CONFIG.SHIELD_PUSH_FORCE * getEffectMultiplier(level);
    const pos = agent.position;
    const nearbyAgents = spatialHash.queryAgents(pos, pushRadius);

    for (const entry of nearbyAgents) {
      if (entry.agentId === agent.data.id) continue;
      const other = agents.get(entry.agentId);
      if (!other || !other.isAlive) continue;

      const dx = entry.x - pos.x;
      const dy = entry.y - pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 0 && dist < pushRadius) {
        // 밀침: 현재 위치에서 반대 방향으로 pushForce만큼 이동
        other.data.position = {
          x: entry.x + (dx / dist) * pushForce,
          y: entry.y + (dy / dist) * pushForce,
        };
      }
    }

    return true;
  }

  // ─── 3. Lightning Strike (적 감지 트리거) ───

  /**
   * 트리거: 사거리 내 적 감지
   * 효과: 가장 가까운 적에게 순간 데미지
   * @returns 발동 여부
   */
  private processLightningStrike(
    agent: AgentEntity,
    agents: Map<string, AgentEntity>,
    spatialHash: SpatialHash,
    currentTick: number,
    config: ArenaConfig,
    level: number,
    hasCdSynergy: boolean,
  ): boolean {
    const range = COMBAT_CONFIG.LIGHTNING_RANGE;
    const pos = agent.position;
    const nearbyAgents = spatialHash.queryAgents(pos, range);

    // 가장 가까운 적 찾기
    let closestEnemy: AgentEntity | null = null;
    let closestDistSq = Infinity;

    for (const entry of nearbyAgents) {
      if (entry.agentId === agent.data.id) continue;
      const other = agents.get(entry.agentId);
      if (!other || !other.isAlive) continue;
      if (other.hasEffect('ghost')) continue;

      const dx = pos.x - entry.x;
      const dy = pos.y - entry.y;
      const distSq = dx * dx + dy * dy;

      if (distSq < range * range && distSq < closestDistSq) {
        closestDistSq = distSq;
        closestEnemy = other;
      }
    }

    if (!closestEnemy) return false;

    // 순간 데미지 적용
    const baseDamage = ABILITY_DEFS.lightning_strike.baseDamage * getEffectMultiplier(level);
    closestEnemy.takeDamage(baseDamage, agent.data.id);

    // Storm 시너지: 연쇄 번개 (최대 3 적)
    if (agent.data.activeSynergies.includes('storm')) {
      const chainCount = 3;
      const hitTargets = new Set<string>([agent.data.id, closestEnemy.data.id]);
      let chainOrigin = closestEnemy.position;
      const chainDamage = baseDamage * 0.5; // 연쇄 데미지 50%

      for (let c = 0; c < chainCount; c++) {
        let nextTarget: AgentEntity | null = null;
        let nextDistSq = Infinity;
        const chainNearby = spatialHash.queryAgents(chainOrigin, range * 0.7);

        for (const entry of chainNearby) {
          if (hitTargets.has(entry.agentId)) continue;
          const other = agents.get(entry.agentId);
          if (!other || !other.isAlive || other.hasEffect('ghost')) continue;

          const dx = chainOrigin.x - entry.x;
          const dy = chainOrigin.y - entry.y;
          const distSq = dx * dx + dy * dy;

          if (distSq < nextDistSq) {
            nextDistSq = distSq;
            nextTarget = other;
          }
        }

        if (!nextTarget) break;

        nextTarget.takeDamage(chainDamage, agent.data.id);
        hitTargets.add(nextTarget.data.id);
        chainOrigin = nextTarget.position;
      }
    }

    return true;
  }

  // ─── 4. Speed Dash (추격/도주 트리거) ───

  /**
   * 트리거: 적이 가까이 있고 부스트 중이거나 적이 추격 중일 때
   * 효과: 2초간 3배 속도 + 충돌 면역 (ghost)
   * @returns 발동 여부
   */
  private processSpeedDash(
    agent: AgentEntity,
    agents: Map<string, AgentEntity>,
    spatialHash: SpatialHash,
    currentTick: number,
    config: ArenaConfig,
    level: number,
    hasCdSynergy: boolean,
  ): boolean {
    // 이미 ghost/speed 효과면 발동하지 않음
    if (agent.hasEffect('ghost') || agent.hasEffect('speed')) return false;

    // 트리거 조건: 200px 내에 적이 있어야 함
    const detectionRadius = 200;
    const pos = agent.position;
    const nearbyAgents = spatialHash.queryAgents(pos, detectionRadius);

    let hasNearbyEnemy = false;
    for (const entry of nearbyAgents) {
      if (entry.agentId === agent.data.id) continue;
      const other = agents.get(entry.agentId);
      if (!other || !other.isAlive) continue;

      const dx = pos.x - entry.x;
      const dy = pos.y - entry.y;
      if (dx * dx + dy * dy < detectionRadius * detectionRadius) {
        hasNearbyEnemy = true;
        break;
      }
    }

    if (!hasNearbyEnemy) return false;

    // 2초 (40틱) 스피드 + ghost 효과 (레벨 스케일링)
    const durationTicks = Math.floor(ABILITY_DEFS.speed_dash.durationTicks * getEffectMultiplier(level));
    agent.addEffect('speed', durationTicks, currentTick);
    agent.addEffect('ghost', durationTicks, currentTick);

    return true;
  }

  // ─── 5. Mass Drain (히트박스 접촉 트리거) ───

  /**
   * 트리거: 히트박스가 겹치는 적과 접촉 시
   * 효과: 적 mass의 10% 흡수
   * @returns 발동 여부
   */
  private processMassDrain(
    agent: AgentEntity,
    agents: Map<string, AgentEntity>,
    spatialHash: SpatialHash,
    currentTick: number,
    config: ArenaConfig,
    level: number,
    hasCdSynergy: boolean,
  ): boolean {
    const pos = agent.position;
    const searchRadius = config.hitboxMaxRadius * 2;
    const nearbyAgents = spatialHash.queryAgents(pos, searchRadius);

    let drained = false;
    const drainRatio = COMBAT_CONFIG.MASS_DRAIN_RATIO * getEffectMultiplier(level);

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
        // 접촉! mass 흡수
        const drainAmount = other.data.mass * drainRatio;
        other.takeDamage(drainAmount, agent.data.id);
        agent.addMass(drainAmount * (1 - other.getDamageReduction()));
        drained = true;
      }
    }

    return drained;
  }

  // ─── 6. Gravity Well (오브 밀집 지역 트리거) ───

  /**
   * 트리거: 반경 내 오브가 5개 이상
   * 효과: 3초간 주변 오브+적을 끌어당김
   * @returns 발동 여부
   */
  private processGravityWell(
    agent: AgentEntity,
    agents: Map<string, AgentEntity>,
    spatialHash: SpatialHash,
    orbManager: OrbManager,
    currentTick: number,
    config: ArenaConfig,
    level: number,
    hasCdSynergy: boolean,
  ): boolean {
    const pullRadius = COMBAT_CONFIG.GRAVITY_PULL_RADIUS * getEffectMultiplier(level);
    const pos = agent.position;

    // 오브 밀집도 체크 (최소 5개)
    const nearbyOrbs = spatialHash.queryOrbs(pos, pullRadius);
    if (nearbyOrbs.length < 5) return false;

    const pullSpeed = COMBAT_CONFIG.GRAVITY_PULL_SPEED * getEffectMultiplier(level);

    // 오브 끌어당김
    for (const orb of nearbyOrbs) {
      const dx = pos.x - orb.position.x;
      const dy = pos.y - orb.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 1) {
        orb.position.x += (dx / dist) * pullSpeed;
        orb.position.y += (dy / dist) * pullSpeed;
      }
    }

    // 적도 끌어당김 (절반 속도)
    const nearbyAgents = spatialHash.queryAgents(pos, pullRadius);
    for (const entry of nearbyAgents) {
      if (entry.agentId === agent.data.id) continue;
      const other = agents.get(entry.agentId);
      if (!other || !other.isAlive || other.hasEffect('ghost')) continue;

      const dx = pos.x - entry.x;
      const dy = pos.y - entry.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 1) {
        other.data.position = {
          x: entry.x + (dx / dist) * pullSpeed * 0.5,
          y: entry.y + (dy / dist) * pullSpeed * 0.5,
        };
      }
    }

    return true;
  }
}
