/**
 * agentCombat.ts - 에이전트 간 PvP 전투 시스템
 * 에이전트 투사체가 다른 에이전트에게 데미지를 주는 로직
 * + AI 전투 업데이트 시스템 (v1.2)
 */

import React from 'react';
import {
  Agent,
  Vector2,
  Projectile,
  WeaponType,
  Player,
  Enemy,
  LightningBolt,
  Blast,
  Entity,
  WeaponStats,
} from '../types';
import { fireWeapon, WeaponFireContext } from './weapons';
import { PERSONALITY_WEIGHTS } from '../config/arena-agents.config';

// PvP 데미지 배율 (몬스터 대비)
const PVP_DAMAGE_MULTIPLIER = 0.5; // 50% 데미지

// 친아군 사격 방지 거리 (너무 가까우면 자신을 때림)
const FRIENDLY_FIRE_MIN_DISTANCE = 30;

// 무기별 PvP 보너스/페널티
const WEAPON_PVP_MODIFIERS: Partial<Record<WeaponType, number>> = {
  knife: 1.2,      // 나이프는 PvP에서 +20%
  bow: 1.1,        // 활 +10%
  laser: 0.8,      // 레이저 -20% (너무 강함)
  lightning: 0.7,  // 번개 -30%
  garlic: 0.5,     // 마늘 -50% (지속 데미지라)
  pool: 0.5,       // 풀 -50%
};

export interface AgentDamageResult {
  targetAgentId: string;
  damage: number;
  killed: boolean;
  attackerAgentId: string;
  weaponType: WeaponType;
}

/**
 * 투사체와 에이전트 간 충돌 체크
 */
export function checkProjectileAgentCollision(
  projectile: Projectile,
  agent: Agent,
  attackerAgentId: string
): boolean {
  // 자기 투사체는 자신에게 맞지 않음
  if (agent.agentId === attackerAgentId) {
    return false;
  }

  // 죽은 에이전트는 맞지 않음
  if (!agent.isAlive) {
    return false;
  }

  // 리스폰 무적 상태
  if ((agent.respawnInvincibility || 0) > 0) {
    return false;
  }

  // 원형 충돌 체크
  const dx = projectile.position.x - agent.position.x;
  const dy = projectile.position.y - agent.position.y;
  const distSq = dx * dx + dy * dy;
  const radiusSum = projectile.radius + agent.radius;

  return distSq < radiusSum * radiusSum;
}

/**
 * 에이전트에게 PvP 데미지 적용
 */
export function applyPvPDamage(
  target: Agent,
  baseDamage: number,
  weaponType: WeaponType,
  attackerAgentId: string
): AgentDamageResult {
  // 무기별 PvP 배율 적용
  const weaponModifier = WEAPON_PVP_MODIFIERS[weaponType] || 1.0;
  const finalDamage = Math.floor(baseDamage * PVP_DAMAGE_MULTIPLIER * weaponModifier);

  // 데미지 적용
  const newHealth = Math.max(0, target.health - finalDamage);
  const killed = newHealth <= 0;

  // target 객체 직접 수정 (참조로 전달됨)
  target.health = newHealth;
  target.lastDamagedBy = attackerAgentId;

  if (killed) {
    target.isAlive = false;
    target.state = 'dying';
  }

  return {
    targetAgentId: target.agentId,
    damage: finalDamage,
    killed,
    attackerAgentId,
    weaponType,
  };
}

/**
 * 에이전트 간 근접 충돌 데미지 (몸빵)
 * 서로 가까이 있으면 서로에게 작은 데미지
 */
export function checkAgentMeleeCollision(
  agent1: Agent,
  agent2: Agent
): { collision: boolean; distance: number } {
  if (!agent1.isAlive || !agent2.isAlive) {
    return { collision: false, distance: Infinity };
  }

  if ((agent1.respawnInvincibility || 0) > 0 || (agent2.respawnInvincibility || 0) > 0) {
    return { collision: false, distance: Infinity };
  }

  const dx = agent1.position.x - agent2.position.x;
  const dy = agent1.position.y - agent2.position.y;
  const distSq = dx * dx + dy * dy;
  const distance = Math.sqrt(distSq);
  const radiusSum = agent1.radius + agent2.radius;

  return {
    collision: distance < radiusSum,
    distance,
  };
}

/**
 * 에이전트 킬 보상 계산
 */
export interface KillReward {
  xp: number;
  score: number;
  bonusType?: 'firstblood' | 'revenge' | 'shutdown' | 'multikill';
  bonusMultiplier: number;
}

export function calculateKillReward(
  killer: Agent,
  victim: Agent,
  config: {
    baseXp: number;
    baseScore: number;
    levelDifferenceBonus: number;
  }
): KillReward {
  let xp = config.baseXp;
  let score = config.baseScore;
  let bonusType: KillReward['bonusType'] = undefined;
  let bonusMultiplier = 1.0;

  // 레벨 차이 보너스 (높은 레벨 킬하면 보너스)
  const levelDiff = victim.level - killer.level;
  if (levelDiff > 0) {
    const levelBonus = 1 + (levelDiff * config.levelDifferenceBonus);
    xp = Math.floor(xp * levelBonus);
    score = Math.floor(score * levelBonus);
    bonusMultiplier = levelBonus;
  }

  // 복수 보너스 (자신을 죽인 에이전트를 죽이면)
  if (killer.lastDamagedBy === victim.agentId) {
    bonusType = 'revenge';
    xp = Math.floor(xp * 1.5);
    score = Math.floor(score * 1.5);
    bonusMultiplier = 1.5;
  }

  // 연속 킬 보너스 (victim이 킬스트릭 중이었으면)
  if (victim.kills >= 3) {
    bonusType = 'shutdown';
    const shutdownBonus = 1 + (victim.kills * 0.1); // 킬당 10% 추가
    xp = Math.floor(xp * shutdownBonus);
    score = Math.floor(score * shutdownBonus);
    bonusMultiplier = shutdownBonus;
  }

  return {
    xp,
    score,
    bonusType,
    bonusMultiplier,
  };
}

/**
 * 에이전트 위치에서 넉백 벡터 계산
 */
export function calculateKnockback(
  from: Vector2,
  to: Vector2,
  force: number
): Vector2 {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist === 0) {
    // 같은 위치면 랜덤 방향
    const angle = Math.random() * Math.PI * 2;
    return {
      x: Math.cos(angle) * force,
      y: Math.sin(angle) * force,
    };
  }

  return {
    x: (dx / dist) * force,
    y: (dy / dist) * force,
  };
}

/**
 * 안전지대 밖 데미지 체크
 */
export function checkSafeZoneDamage(
  agent: Agent,
  safeZoneCenter: Vector2,
  safeZoneRadius: number,
  damagePerSecond: number,
  deltaTime: number
): number {
  if (!agent.isAlive) return 0;

  const dx = agent.position.x - safeZoneCenter.x;
  const dy = agent.position.y - safeZoneCenter.y;
  const distFromCenter = Math.sqrt(dx * dx + dy * dy);

  if (distFromCenter > safeZoneRadius) {
    // 거리에 비례한 추가 데미지
    const overDistance = distFromCenter - safeZoneRadius;
    const distanceMultiplier = 1 + (overDistance / 100) * 0.5; // 100px당 50% 추가
    return damagePerSecond * deltaTime * distanceMultiplier;
  }

  return 0;
}

/**
 * 투사체 소유자 ID 추출 (에이전트 투사체용)
 */
export function getProjectileOwnerId(projectile: Projectile): string | null {
  // projectile에 ownerId 필드가 있다고 가정
  return (projectile as any).ownerId || null;
}

/**
 * 에이전트 투사체인지 확인
 */
export function isAgentProjectile(projectile: Projectile): boolean {
  const ownerId = getProjectileOwnerId(projectile);
  return ownerId !== null && ownerId.startsWith('agent_');
}

// ============================================
// AI 전투 AI 시스템 (v1.2)
// ============================================

/**
 * Agent를 Player 호환 객체로 변환 (fireWeapon 호출용)
 */
export function createAgentFireContext(
  agent: Agent,
  target: Entity | null,
  projectilesRef: React.MutableRefObject<Projectile[]>,
  lightningBoltsRef: React.MutableRefObject<LightningBolt[]>,
  blastsRef: React.MutableRefObject<Blast[]>,
  enemiesRef: React.MutableRefObject<Enemy[]>,
  canvasWidth: number,
  canvasHeight: number,
  damageEnemyFn: WeaponFireContext['damageEnemy']
): WeaponFireContext {
  // Agent → Player 호환 객체 생성 (pseudoPlayer)
  const pseudoPlayer = {
    ...agent,
    // Agent에 없는 Player 필수 필드들 기본값 설정
    angle: target
      ? Math.atan2(
          target.position.y - agent.position.y,
          target.position.x - agent.position.x
        )
      : 0,
    score: agent.score,
    invulnerabilityTimer: agent.respawnInvincibility,
    specialCooldown: 0,
    maxSpecialCooldown: 10000,
    shield: 0,
    maxShield: 0,
    knockback: { x: 0, y: 0 },
    hitFlashTimer: 0,
    criticalChance: 0.05,
    criticalMultiplier: 2.0,
    // Optional 필드들은 undefined로 둠
  } as unknown as Player;

  // 타겟 방향 계산
  const lastFacing = target
    ? {
        x: target.position.x - agent.position.x,
        y: target.position.y - agent.position.y,
      }
    : { x: 1, y: 0 };

  // 방향 정규화
  const facingLen = Math.sqrt(lastFacing.x * lastFacing.x + lastFacing.y * lastFacing.y);
  if (facingLen > 0) {
    lastFacing.x /= facingLen;
    lastFacing.y /= facingLen;
  }

  return {
    player: pseudoPlayer,
    projectiles: projectilesRef.current,
    lightningBolts: lightningBoltsRef.current,
    blasts: blastsRef.current,
    enemies: enemiesRef.current,
    lastFacing,
    lastAttackTime: { current: 0 } as React.MutableRefObject<number>,
    canvasWidth,
    canvasHeight,
    damageEnemy: damageEnemyFn,
    ownerId: agent.agentId, // Arena PvP: 투사체 발사자 ID
  };
}

/**
 * 두 점 사이의 거리
 */
function distanceBetween(a: Vector2, b: Vector2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 무기별 공격 사거리
 * v8.1.5: export로 변경 (useArena에서 AI 이동에 사용)
 */
export function getWeaponRange(weaponType: WeaponType): number {
  const baseRanges: Partial<Record<WeaponType, number>> = {
    whip: 80,      // 근접
    punch: 60,     // 근접
    knife: 300,    // 투사체
    wand: 250,     // 투사체
    bow: 350,      // 원거리
    axe: 200,      // 투사체
    garlic: 100,   // 오라
    pool: 120,     // 오라
    beam: 400,     // 빔
    laser: 300,    // 회전
    lightning: 400, // 원거리
    ping: 250,     // 투사체
    shard: 300,    // 투사체
    fork: 280,     // 투사체
    airdrop: 350,  // 원거리
    bridge: 150,   // 중거리
    bible: 100,    // 근접
  };
  return baseRanges[weaponType] || 200;
}

/**
 * 에이전트의 주 무기 사거리 가져오기
 * v8.1.5: AI 이동에서 적정 공격 거리 계산용
 */
export function getAgentWeaponRange(agent: Agent): number {
  const weaponTypes = Object.keys(agent.weapons || {}) as WeaponType[];
  if (weaponTypes.length === 0) return 200; // 기본값
  return getWeaponRange(weaponTypes[0]);
}

/**
 * 최적 타겟 찾기 (성격 기반)
 */
function findBestTarget(
  agent: Agent,
  allAgents: Agent[],
  enemies: Enemy[]
): Entity | null {
  const personality = PERSONALITY_WEIGHTS[agent.aiPersonality || 'balanced'];

  // 후보 수집
  const candidates: { entity: Entity; priority: number; dist: number }[] = [];

  // 다른 에이전트 (PvP)
  for (const other of allAgents) {
    if (other.agentId === agent.agentId) continue;
    if (!other.isAlive) continue;
    if ((other.respawnInvincibility || 0) > 0) continue;

    const dist = distanceBetween(agent.position, other.position);
    if (dist > 600) continue;

    const healthRatio = other.health / other.maxHealth;
    const priority =
      personality.agentTargetWeight *
      (1 - dist / 600) *
      (1 - healthRatio * 0.3);

    candidates.push({ entity: other, priority, dist });
  }

  // 몬스터
  for (const enemy of enemies) {
    if (enemy.health <= 0) continue;

    const dist = distanceBetween(agent.position, enemy.position);
    if (dist > 500) continue;

    const priority = personality.monsterTargetWeight * (1 - dist / 500);
    candidates.push({ entity: enemy, priority, dist });
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (Math.abs(a.priority - b.priority) > 0.1) {
      return b.priority - a.priority;
    }
    return a.dist - b.dist;
  });

  return candidates[0].entity;
}

/**
 * 에이전트 전투 업데이트 (매 프레임 호출)
 */
export function updateAgentCombat(
  agent: Agent,
  allAgents: Agent[],
  enemies: Enemy[],
  deltaTime: number,
  refs: {
    projectiles: React.MutableRefObject<Projectile[]>;
    lightningBolts: React.MutableRefObject<LightningBolt[]>;
    blasts: React.MutableRefObject<Blast[]>;
    enemies: React.MutableRefObject<Enemy[]>;
  },
  canvasSize: { width: number; height: number },
  damageEnemyFn: WeaponFireContext['damageEnemy']
): void {
  if (!agent.isAlive || agent.isLocalPlayer) return;

  // 무기 쿨다운 감소
  if (!agent.weapons || !agent.weaponCooldowns) return;
  const weaponTypes = Object.keys(agent.weapons) as WeaponType[];
  for (const wt of weaponTypes) {
    const cd = agent.weaponCooldowns[wt] || 0;
    if (cd > 0) {
      agent.weaponCooldowns[wt] = Math.max(0, cd - deltaTime * 1000);
    }
  }

  if (weaponTypes.length === 0) return;

  const primaryWeapon = weaponTypes[0];
  const weaponStats = agent.weapons[primaryWeapon];
  if (!weaponStats) return;

  const cooldown = agent.weaponCooldowns[primaryWeapon] || 0;
  if (cooldown > 0) return;

  // 타겟 찾기
  const target = findBestTarget(agent, allAgents, enemies);
  if (!target) return;

  const distToTarget = distanceBetween(agent.position, target.position);
  const attackRange = getWeaponRange(primaryWeapon);

  if (distToTarget <= attackRange) {
    const ctx = createAgentFireContext(
      agent,
      target,
      refs.projectiles,
      refs.lightningBolts,
      refs.blasts,
      refs.enemies,
      canvasSize.width,
      canvasSize.height,
      damageEnemyFn
    );

    fireWeapon(primaryWeapon, weaponStats, ctx);
    agent.weaponCooldowns[primaryWeapon] = weaponStats.cooldown;
    agent.state = 'attacking';

    if ('agentId' in target) {
      agent.targetAgentId = (target as Agent).agentId;
    }
  }
}

/**
 * 모든 AI 에이전트 전투 업데이트
 */
export function updateAllAgentsCombat(
  agents: Agent[],
  enemies: Enemy[],
  deltaTime: number,
  refs: {
    projectiles: React.MutableRefObject<Projectile[]>;
    lightningBolts: React.MutableRefObject<LightningBolt[]>;
    blasts: React.MutableRefObject<Blast[]>;
    enemies: React.MutableRefObject<Enemy[]>;
  },
  canvasSize: { width: number; height: number },
  damageEnemyFn: WeaponFireContext['damageEnemy']
): void {
  for (const agent of agents) {
    if (agent.isLocalPlayer) continue;
    updateAgentCombat(agent, agents, enemies, deltaTime, refs, canvasSize, damageEnemyFn);
  }
}
