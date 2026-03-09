/**
 * agent-combat.ts - AI 에이전트 전투 시스템 (v28 Phase 6)
 *
 * 9개 AI 에이전트의 자동 이동, 타겟팅, 무기 발사, PvP 전투,
 * 사망 처리, 레벨업 로직을 담당.
 *
 * 참조: app_ingame/game/systems/agentCombat.ts
 */

import type {
  Vector2,
  WeaponType,
  WeaponInstance,
  PlayerClass,
  Enemy,
  Projectile,
} from '../types';
import { ARENA_CONFIG, AI_PERSONALITY_WEIGHTS } from '../config/arena.config';
import { CLASS_DATA } from '../config/classes.config';

// ============================================
// Agent 인터페이스 (전투 시스템 전용)
// ============================================

/** AI 성격 타입 */
export type AIPersonality = 'aggressive' | 'defensive' | 'balanced' | 'collector';

/** 에이전트 상태 */
export type AgentState = 'alive' | 'dead' | 'attacking' | 'fleeing' | 'collecting';

/** Arena 에이전트 (전투용 확장 타입) */
export interface ArenaAgent {
  agentId: string;
  displayName: string;
  position: Vector2;
  velocity: Vector2;
  health: number;
  maxHealth: number;
  speed: number;
  radius: number;
  weapons: Partial<Record<WeaponType, WeaponInstance>>;
  weaponCooldowns: Partial<Record<WeaponType, number>>;
  score: number;
  kills: number;
  deaths: number;
  level: number;
  xp: number;
  nextLevelXp: number;
  state: AgentState;
  playerClass: PlayerClass;
  color: string;
  isLocalPlayer: boolean;
  aiPersonality: AIPersonality;

  // 타겟팅
  targetId: string | null;
  lastDamagedBy: string | null;

  // 무적/리스폰
  respawnInvincibility: number;
  respawnTimer: number;

  // AI 이동
  wanderAngle: number;
  wanderTimer: number;
}

// ============================================
// PvP 상수
// ============================================

const PVP_DAMAGE_MULTIPLIER = 0.5;

const WEAPON_PVP_MODIFIERS: Partial<Record<WeaponType, number>> = {
  knife: 1.2,
  bow: 1.1,
  laser: 0.8,
  lightning: 0.7,
  garlic: 0.5,
  pool: 0.5,
};

// 에이전트 클래스 배정 (9개 AI)
const AGENT_CLASSES: { playerClass: PlayerClass; personality: AIPersonality }[] = [
  { playerClass: 'neo', personality: 'balanced' },
  { playerClass: 'morpheus', personality: 'defensive' },
  { playerClass: 'trinity', personality: 'aggressive' },
  { playerClass: 'cypher', personality: 'aggressive' },
  { playerClass: 'oracle', personality: 'collector' },
  { playerClass: 'tank', personality: 'defensive' },
  { playerClass: 'mouse', personality: 'aggressive' },
  { playerClass: 'niobe', personality: 'balanced' },
  { playerClass: 'dozer', personality: 'balanced' },
];

// 에이전트 표시 색상
const AGENT_COLORS: Record<PlayerClass, string> = {
  neo: '#00FF41',
  morpheus: '#d4af37',
  trinity: '#ec4899',
  cypher: '#dc2626',
  oracle: '#3b82f6',
  tank: '#dc2626',
  mouse: '#eab308',
  niobe: '#a855f7',
  dozer: '#f97316',
};

// ============================================
// 에이전트 생성
// ============================================

/**
 * 초기 무기 스탯 생성 (클래스 기반)
 */
function createStartingWeapon(playerClass: PlayerClass): { type: WeaponType; stats: WeaponInstance } {
  const classData = CLASS_DATA[playerClass];
  const weaponType = classData?.startWeapon ?? 'wand';

  return {
    type: weaponType,
    stats: {
      level: 1,
      damage: 12,
      area: 8,
      speed: 280,
      duration: 2,
      cooldown: 1.5,
      amount: 1,
      pierce: 1,
      knockback: 3,
    },
  };
}

/**
 * 9개 AI 에이전트 생성
 * 월드 중심에서 랜덤 위치에 스폰
 */
export function createAgents(worldSize: number): ArenaAgent[] {
  const agents: ArenaAgent[] = [];
  const spawnRadius = worldSize * 0.3; // 월드 크기의 30% 범위 내 스폰

  for (let i = 0; i < ARENA_CONFIG.AGENT_COUNT; i++) {
    const config = AGENT_CLASSES[i % AGENT_CLASSES.length];
    const classData = CLASS_DATA[config.playerClass];
    const angle = (Math.PI * 2 / ARENA_CONFIG.AGENT_COUNT) * i;
    const dist = spawnRadius * (0.4 + Math.random() * 0.6);

    const startWeapon = createStartingWeapon(config.playerClass);
    const hpMult = classData?.hpMult ?? 1.0;
    const speedMult = classData?.speedMult ?? 1.0;

    const agent: ArenaAgent = {
      agentId: `agent_${i}`,
      displayName: classData?.name ?? `AGENT ${i}`,
      position: {
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
      },
      velocity: { x: 0, y: 0 },
      health: ARENA_CONFIG.STARTING_HP * hpMult,
      maxHealth: ARENA_CONFIG.STARTING_HP * hpMult,
      speed: 90 * speedMult,
      radius: 11,
      weapons: { [startWeapon.type]: startWeapon.stats },
      weaponCooldowns: {},
      score: 0,
      kills: 0,
      deaths: 0,
      level: ARENA_CONFIG.STARTING_LEVEL,
      xp: 0,
      nextLevelXp: ARENA_CONFIG.XP_PER_LEVEL,
      state: 'alive',
      playerClass: config.playerClass,
      color: AGENT_COLORS[config.playerClass] ?? '#00FF41',
      isLocalPlayer: false,
      aiPersonality: config.personality,
      targetId: null,
      lastDamagedBy: null,
      respawnInvincibility: 2, // 초기 2초 무적
      respawnTimer: 0,
      wanderAngle: Math.random() * Math.PI * 2,
      wanderTimer: 0,
    };

    agents.push(agent);
  }

  return agents;
}

// ============================================
// AI 이동 로직
// ============================================

function distanceBetween(a: Vector2, b: Vector2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 에이전트 AI 이동 업데이트
 * 성격에 따라 다른 행동 패턴
 */
export function updateAgentMovement(
  agent: ArenaAgent,
  allAgents: ArenaAgent[],
  enemies: Enemy[],
  safeZoneCenter: Vector2,
  safeZoneRadius: number,
  deltaTime: number,
): void {
  if (agent.state === 'dead' || agent.isLocalPlayer) return;

  // 리스폰 무적 타이머 감소
  if (agent.respawnInvincibility > 0) {
    agent.respawnInvincibility -= deltaTime;
  }

  const personality = AI_PERSONALITY_WEIGHTS[agent.aiPersonality] ?? AI_PERSONALITY_WEIGHTS.balanced;
  const hpRatio = agent.health / agent.maxHealth;

  // HP가 낮으면 도주
  if (hpRatio < personality.fleeThreshold) {
    agent.state = 'fleeing';
    fleeFromThreats(agent, allAgents, enemies, deltaTime);
    moveTowardsSafeZone(agent, safeZoneCenter, safeZoneRadius, deltaTime, 0.3);
    return;
  }

  // 안전지대 밖이면 안전지대로 이동 (높은 우선순위)
  const distToCenter = distanceBetween(agent.position, safeZoneCenter);
  if (distToCenter > safeZoneRadius * 0.9) {
    moveTowardsSafeZone(agent, safeZoneCenter, safeZoneRadius, deltaTime, 0.8);
    return;
  }

  // 성격 기반 행동 결정
  const roll = Math.random();

  if (roll < personality.attackWeight) {
    // 공격 모드: 가장 가까운 타겟 추격
    const target = findClosestTarget(agent, allAgents, enemies, personality.targetPlayerWeight);
    if (target) {
      const weaponRange = getAgentWeaponRange(agent);
      const dist = distanceBetween(agent.position, target.position);

      if (dist > weaponRange * 0.8) {
        // 사거리 밖 → 접근
        moveTowards(agent, target.position, deltaTime, 1.0);
        agent.state = 'alive';
      } else if (dist < weaponRange * 0.3) {
        // 너무 가까우면 약간 뒤로
        moveAway(agent, target.position, deltaTime, 0.5);
        agent.state = 'attacking';
      } else {
        // 적절 거리 → 공격 자세 + 미세 이동
        agent.state = 'attacking';
        // 서클 스트레이프
        strafeAround(agent, target.position, deltaTime);
      }
      return;
    }
  }

  // 기본: 배회 이동
  agent.state = 'alive';
  wander(agent, deltaTime, safeZoneCenter, safeZoneRadius);
}

function moveTowards(agent: ArenaAgent, target: Vector2, deltaTime: number, speedMult: number): void {
  const dx = target.x - agent.position.x;
  const dy = target.y - agent.position.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  agent.velocity.x = (dx / dist) * agent.speed * speedMult;
  agent.velocity.y = (dy / dist) * agent.speed * speedMult;
  agent.position.x += agent.velocity.x * deltaTime;
  agent.position.y += agent.velocity.y * deltaTime;
}

function moveAway(agent: ArenaAgent, from: Vector2, deltaTime: number, speedMult: number): void {
  const dx = agent.position.x - from.x;
  const dy = agent.position.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  agent.velocity.x = (dx / dist) * agent.speed * speedMult;
  agent.velocity.y = (dy / dist) * agent.speed * speedMult;
  agent.position.x += agent.velocity.x * deltaTime;
  agent.position.y += agent.velocity.y * deltaTime;
}

function strafeAround(agent: ArenaAgent, target: Vector2, deltaTime: number): void {
  const dx = target.x - agent.position.x;
  const dy = target.y - agent.position.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  // 수직 방향으로 이동 (원형 회전)
  const perpX = -dy / dist;
  const perpY = dx / dist;
  const strafeDir = Math.sin(Date.now() * 0.002) > 0 ? 1 : -1;
  agent.velocity.x = perpX * agent.speed * 0.5 * strafeDir;
  agent.velocity.y = perpY * agent.speed * 0.5 * strafeDir;
  agent.position.x += agent.velocity.x * deltaTime;
  agent.position.y += agent.velocity.y * deltaTime;
}

function moveTowardsSafeZone(
  agent: ArenaAgent,
  center: Vector2,
  _radius: number,
  deltaTime: number,
  urgency: number,
): void {
  moveTowards(agent, center, deltaTime, urgency);
}

function fleeFromThreats(
  agent: ArenaAgent,
  allAgents: ArenaAgent[],
  enemies: Enemy[],
  deltaTime: number,
): void {
  let threatX = 0;
  let threatY = 0;
  let threatCount = 0;

  // 가까운 에이전트로부터 도주
  for (const other of allAgents) {
    if (other.agentId === agent.agentId || other.state === 'dead') continue;
    const dist = distanceBetween(agent.position, other.position);
    if (dist < 200) {
      threatX += other.position.x;
      threatY += other.position.y;
      threatCount++;
    }
  }

  // 가까운 적으로부터 도주
  for (const enemy of enemies) {
    if (enemy.health <= 0) continue;
    const dist = distanceBetween(agent.position, enemy.position);
    if (dist < 150) {
      threatX += enemy.position.x;
      threatY += enemy.position.y;
      threatCount++;
    }
  }

  if (threatCount > 0) {
    const avgThreat: Vector2 = { x: threatX / threatCount, y: threatY / threatCount };
    moveAway(agent, avgThreat, deltaTime, 1.2);
  }
}

function wander(agent: ArenaAgent, deltaTime: number, center: Vector2, safeRadius: number): void {
  agent.wanderTimer -= deltaTime;
  if (agent.wanderTimer <= 0) {
    agent.wanderAngle += (Math.random() - 0.5) * Math.PI * 0.5;
    agent.wanderTimer = 1 + Math.random() * 2;
  }

  const wx = Math.cos(agent.wanderAngle) * agent.speed * 0.4;
  const wy = Math.sin(agent.wanderAngle) * agent.speed * 0.4;
  agent.velocity.x = wx;
  agent.velocity.y = wy;
  agent.position.x += wx * deltaTime;
  agent.position.y += wy * deltaTime;

  // 안전지대 안에 머물도록 부드럽게 보정
  const distToCenter = distanceBetween(agent.position, center);
  if (distToCenter > safeRadius * 0.7) {
    const pull = (distToCenter - safeRadius * 0.7) / (safeRadius * 0.3);
    const dx = center.x - agent.position.x;
    const dy = center.y - agent.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    agent.position.x += (dx / dist) * pull * agent.speed * deltaTime;
    agent.position.y += (dy / dist) * pull * agent.speed * deltaTime;
  }
}

// ============================================
// 타겟팅 시스템
// ============================================

interface TargetCandidate {
  id: string;
  position: Vector2;
  isAgent: boolean;
}

function findClosestTarget(
  agent: ArenaAgent,
  allAgents: ArenaAgent[],
  enemies: Enemy[],
  agentTargetWeight: number,
): TargetCandidate | null {
  let bestTarget: TargetCandidate | null = null;
  let bestScore = -Infinity;

  // 다른 에이전트
  for (const other of allAgents) {
    if (other.agentId === agent.agentId || other.state === 'dead') continue;
    if (other.respawnInvincibility > 0) continue;

    const dist = distanceBetween(agent.position, other.position);
    if (dist > 500) continue;

    const hpRatio = other.health / other.maxHealth;
    const score = agentTargetWeight * (1 - dist / 500) * (1 - hpRatio * 0.3);

    if (score > bestScore) {
      bestScore = score;
      bestTarget = { id: other.agentId, position: other.position, isAgent: true };
    }
  }

  // 몬스터
  for (const enemy of enemies) {
    if (enemy.health <= 0) continue;
    const dist = distanceBetween(agent.position, enemy.position);
    if (dist > 400) continue;

    const monsterWeight = 1 - agentTargetWeight;
    const score = monsterWeight * (1 - dist / 400);

    if (score > bestScore) {
      bestScore = score;
      bestTarget = { id: enemy.id, position: enemy.position, isAgent: false };
    }
  }

  return bestTarget;
}

// ============================================
// 무기 사거리
// ============================================

function getWeaponRange(weaponType: WeaponType): number {
  const ranges: Partial<Record<WeaponType, number>> = {
    whip: 80,
    punch: 60,
    knife: 300,
    wand: 250,
    bow: 350,
    axe: 200,
    garlic: 100,
    pool: 120,
    beam: 400,
    laser: 300,
    lightning: 400,
    ping: 250,
    shard: 300,
    fork: 280,
  };
  return ranges[weaponType] || 200;
}

function getAgentWeaponRange(agent: ArenaAgent): number {
  const weaponTypes = Object.keys(agent.weapons) as WeaponType[];
  if (weaponTypes.length === 0) return 200;
  return getWeaponRange(weaponTypes[0]);
}

// ============================================
// 에이전트 전투 (무기 발사)
// ============================================

/**
 * 에이전트 무기 발사 업데이트
 * 투사체를 직접 생성해 projectiles 배열에 추가
 */
export function updateAgentCombat(
  agent: ArenaAgent,
  allAgents: ArenaAgent[],
  enemies: Enemy[],
  projectiles: Projectile[],
  deltaTime: number,
): void {
  if (agent.state === 'dead' || agent.isLocalPlayer) return;

  // 무기 쿨다운 감소
  const weaponTypes = Object.keys(agent.weapons) as WeaponType[];
  for (const wt of weaponTypes) {
    const cd = agent.weaponCooldowns[wt] ?? 0;
    if (cd > 0) {
      agent.weaponCooldowns[wt] = Math.max(0, cd - deltaTime);
    }
  }

  if (weaponTypes.length === 0) return;
  const primaryWeapon = weaponTypes[0];
  const weaponStats = agent.weapons[primaryWeapon];
  if (!weaponStats) return;

  const cooldown = agent.weaponCooldowns[primaryWeapon] ?? 0;
  if (cooldown > 0) return;

  // 가장 가까운 타겟 찾기
  const target = findClosestTarget(
    agent, allAgents, enemies,
    AI_PERSONALITY_WEIGHTS[agent.aiPersonality]?.targetPlayerWeight ?? 0.5,
  );
  if (!target) return;

  const distToTarget = distanceBetween(agent.position, target.position);
  const attackRange = getWeaponRange(primaryWeapon);

  if (distToTarget <= attackRange) {
    // 투사체 생성
    const dx = target.position.x - agent.position.x;
    const dy = target.position.y - agent.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const dirX = dx / dist;
    const dirY = dy / dist;
    const angle = Math.atan2(dy, dx);

    const projCount = weaponStats.amount || 1;
    for (let i = 0; i < projCount; i++) {
      const spread = projCount > 1
        ? (i - (projCount - 1) / 2) * 0.15
        : 0;
      const projAngle = angle + spread;

      const projectile: Projectile = {
        id: `${agent.agentId}_proj_${Date.now()}_${i}`,
        type: primaryWeapon,
        position: {
          x: agent.position.x + dirX * 15,
          y: agent.position.y + dirY * 15,
        },
        velocity: {
          x: Math.cos(projAngle) * (weaponStats.speed || 280),
          y: Math.sin(projAngle) * (weaponStats.speed || 280),
        },
        radius: weaponStats.area || 6,
        color: AGENT_COLORS[agent.playerClass] ?? '#00FF41',
        life: weaponStats.duration || 2,
        damage: weaponStats.damage || 10,
        pierce: weaponStats.pierce || 1,
        knockback: weaponStats.knockback || 3,
        angle: projAngle,
        ownerId: agent.agentId,
      };

      projectiles.push(projectile);
    }

    // 쿨다운 설정
    agent.weaponCooldowns[primaryWeapon] = weaponStats.cooldown || 1.5;
    agent.state = 'attacking';
    agent.targetId = target.id;
  }
}

// ============================================
// PvP 데미지 시스템
// ============================================

export interface AgentDamageResult {
  targetAgentId: string;
  attackerAgentId: string;
  damage: number;
  killed: boolean;
  weaponType: WeaponType;
}

/**
 * 투사체↔에이전트 충돌 체크
 */
export function checkProjectileAgentCollision(
  projectile: Projectile,
  agent: ArenaAgent,
): boolean {
  // 자기 투사체
  if (projectile.ownerId === agent.agentId) return false;
  // 죽은 에이전트
  if (agent.state === 'dead') return false;
  // 무적 상태
  if (agent.respawnInvincibility > 0) return false;

  const dx = projectile.position.x - agent.position.x;
  const dy = projectile.position.y - agent.position.y;
  const distSq = dx * dx + dy * dy;
  const radiusSum = projectile.radius + agent.radius;

  return distSq < radiusSum * radiusSum;
}

/**
 * PvP 데미지 적용
 */
export function applyPvPDamage(
  target: ArenaAgent,
  baseDamage: number,
  weaponType: WeaponType,
  attackerAgentId: string,
): AgentDamageResult {
  const weaponModifier = WEAPON_PVP_MODIFIERS[weaponType] ?? 1.0;
  const finalDamage = Math.floor(baseDamage * PVP_DAMAGE_MULTIPLIER * weaponModifier);

  const newHealth = Math.max(0, target.health - finalDamage);
  const killed = newHealth <= 0;

  target.health = newHealth;
  target.lastDamagedBy = attackerAgentId;

  if (killed) {
    target.state = 'dead';
    target.deaths += 1;
  }

  return {
    targetAgentId: target.agentId,
    attackerAgentId,
    damage: finalDamage,
    killed,
    weaponType,
  };
}

/**
 * 에이전트 킬 보상
 */
export function applyKillReward(killer: ArenaAgent, victim: ArenaAgent): void {
  const baseXp = ARENA_CONFIG.XP_PER_KILL;
  const baseScore = ARENA_CONFIG.BASE_KILL_CREDITS;
  const levelDiff = victim.level - killer.level;
  const levelBonus = levelDiff > 0 ? 1 + levelDiff * 0.1 : 1;

  killer.xp += Math.floor(baseXp * levelBonus);
  killer.score += Math.floor(baseScore * levelBonus);
  killer.kills += 1;

  // 레벨업 체크
  while (killer.xp >= killer.nextLevelXp) {
    killer.xp -= killer.nextLevelXp;
    killer.level += 1;
    killer.nextLevelXp = ARENA_CONFIG.XP_PER_LEVEL * (1 + killer.level * 0.2);

    // 레벨업 보상: HP 회복 + 무기 강화
    killer.health = Math.min(killer.maxHealth, killer.health + 20);
    upgradeAgentWeapons(killer);
  }
}

/**
 * 에이전트 무기 강화 (레벨업 시)
 */
function upgradeAgentWeapons(agent: ArenaAgent): void {
  const weaponTypes = Object.keys(agent.weapons) as WeaponType[];
  for (const wt of weaponTypes) {
    const weapon = agent.weapons[wt];
    if (!weapon) continue;
    weapon.level += 1;
    weapon.damage = Math.floor(weapon.damage * 1.1); // +10% 데미지
    weapon.pierce = Math.min(weapon.pierce + 1, 5); // +1 관통 (최대 5)
    if (weapon.level % 3 === 0) {
      weapon.amount = Math.min((weapon.amount || 1) + 1, 5); // 3레벨마다 +1 발사체
    }
  }
}

// ============================================
// 안전지대 데미지
// ============================================

/**
 * 안전지대 밖 데미지 체크/적용
 */
export function applyZoneDamageToAgent(
  agent: ArenaAgent,
  safeZoneCenter: Vector2,
  safeZoneRadius: number,
  damagePerSecond: number,
  deltaTime: number,
): number {
  if (agent.state === 'dead') return 0;

  const dx = agent.position.x - safeZoneCenter.x;
  const dy = agent.position.y - safeZoneCenter.y;
  const distFromCenter = Math.sqrt(dx * dx + dy * dy);

  if (distFromCenter > safeZoneRadius) {
    const overDistance = distFromCenter - safeZoneRadius;
    const distanceMultiplier = 1 + (overDistance / 100) * 0.5;
    const damage = damagePerSecond * deltaTime * distanceMultiplier;

    agent.health -= damage;
    if (agent.health <= 0) {
      agent.health = 0;
      agent.state = 'dead';
      agent.deaths += 1;
    }

    return damage;
  }

  return 0;
}

// ============================================
// 투사체↔에이전트 일괄 충돌 처리
// ============================================

/**
 * 모든 투사체와 모든 에이전트 간 충돌 처리
 * 맞은 투사체의 pierce를 감소시키고 에이전트에 데미지 적용
 */
export function processProjectileAgentCollisions(
  projectiles: Projectile[],
  agents: ArenaAgent[],
): AgentDamageResult[] {
  const results: AgentDamageResult[] = [];

  for (const proj of projectiles) {
    if (proj.life <= 0 || proj.pierce <= 0) continue;
    const ownerId = proj.ownerId;
    if (!ownerId) continue; // 소유자 없는 투사체 무시

    for (const agent of agents) {
      if (agent.state === 'dead') continue;
      if (agent.agentId === ownerId) continue; // 자기 투사체

      if (checkProjectileAgentCollision(proj, agent)) {
        const result = applyPvPDamage(
          agent,
          proj.damage,
          proj.type,
          ownerId,
        );
        results.push(result);

        // 킬 처리
        if (result.killed) {
          const killer = agents.find(a => a.agentId === ownerId);
          if (killer) {
            applyKillReward(killer, agent);
          }
        }

        proj.pierce -= 1;
        if (proj.pierce <= 0) {
          proj.life = 0;
          break;
        }
      }
    }
  }

  return results;
}

// ============================================
// 전체 에이전트 업데이트
// ============================================

/**
 * 모든 AI 에이전트 일괄 업데이트 (이동 + 전투 + 존 데미지)
 */
export function updateAllAgents(
  agents: ArenaAgent[],
  enemies: Enemy[],
  projectiles: Projectile[],
  safeZoneCenter: Vector2,
  safeZoneRadius: number,
  zoneDps: number,
  deltaTime: number,
): AgentDamageResult[] {
  // 1. 이동
  for (const agent of agents) {
    if (agent.state !== 'dead') {
      updateAgentMovement(agent, agents, enemies, safeZoneCenter, safeZoneRadius, deltaTime);
    }
  }

  // 2. 무기 발사
  for (const agent of agents) {
    if (!agent.isLocalPlayer && agent.state !== 'dead') {
      updateAgentCombat(agent, agents, enemies, projectiles, deltaTime);
    }
  }

  // 3. 안전지대 데미지
  for (const agent of agents) {
    applyZoneDamageToAgent(agent, safeZoneCenter, safeZoneRadius, zoneDps, deltaTime);
  }

  // 4. 투사체-에이전트 충돌
  const damageResults = processProjectileAgentCollisions(projectiles, agents);

  return damageResults;
}

/**
 * 생존 에이전트 수 (플레이어 포함)
 */
export function getAliveAgentCount(agents: ArenaAgent[], playerAlive: boolean): number {
  let count = playerAlive ? 1 : 0;
  for (const agent of agents) {
    if (agent.state !== 'dead') count++;
  }
  return count;
}

/**
 * 에이전트 리더보드 (점수 내림차순)
 */
export interface LeaderboardEntry {
  agentId: string;
  displayName: string;
  kills: number;
  deaths: number;
  score: number;
  level: number;
  isAlive: boolean;
  isPlayer: boolean;
  color: string;
}

export function getLeaderboard(
  agents: ArenaAgent[],
  playerScore: number,
  playerKills: number,
  playerLevel: number,
  playerAlive: boolean,
): LeaderboardEntry[] {
  const entries: LeaderboardEntry[] = [];

  // 플레이어 추가
  entries.push({
    agentId: 'player',
    displayName: 'YOU',
    kills: playerKills,
    deaths: 0,
    score: playerScore,
    level: playerLevel,
    isAlive: playerAlive,
    isPlayer: true,
    color: '#00FF41',
  });

  // AI 에이전트 추가
  for (const agent of agents) {
    entries.push({
      agentId: agent.agentId,
      displayName: agent.displayName,
      kills: agent.kills,
      deaths: agent.deaths,
      score: agent.score,
      level: agent.level,
      isAlive: agent.state !== 'dead',
      isPlayer: false,
      color: agent.color,
    });
  }

  // 점수 내림차순 정렬
  entries.sort((a, b) => b.score - a.score);

  return entries;
}
