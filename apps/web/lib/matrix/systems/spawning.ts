/**
 * spawning.ts - 스폰 시스템
 * 적, 젬, 픽업 아이템 생성 로직
 */

import React from 'react';
import { Enemy, Gem, Pickup, PickupType, EnemyType, Vector2, BossSkillType, Player, WaveNumber, BossTier } from '../types';
import { ENEMY_TYPES, GAME_CONFIG, PICKUP_DATA, isRangedEnemy, getEnemyConfig } from '../constants';
// STAGE_CONFIGS, getBossConfig, isStageBoss removed for Arena mode
import { GameRefs } from './game-context';
import { isObstacleAt } from '../helpers';

/**
 * 지형지물이 없는 위치 찾기
 */
const findValidSpawnPosition = (basePos: Vector2, radius: number, maxAttempts: number = 8): Vector2 | null => {
  // 먼저 원래 위치 체크
  if (!isObstacleAt(basePos.x, basePos.y, radius)) {
    return basePos;
  }

  // 주변 위치 탐색
  for (let i = 0; i < maxAttempts; i++) {
    const angle = (i / maxAttempts) * Math.PI * 2;
    const offset = 32 + Math.random() * 16; // 32~48px 오프셋
    const testPos = {
      x: basePos.x + Math.cos(angle) * offset,
      y: basePos.y + Math.sin(angle) * offset,
    };
    if (!isObstacleAt(testPos.x, testPos.y, radius)) {
      return testPos;
    }
  }

  return null; // 유효한 위치 못 찾음
};

/**
 * 젬 스폰
 */
export const spawnGem = (
  gemsRef: React.MutableRefObject<Gem[]>,
  pos: Vector2,
  value: number
): void => {
  // 지형지물 위에 스폰 방지
  const validPos = findValidSpawnPosition(pos, 8);
  if (!validPos) return; // 유효한 위치 없으면 스폰하지 않음

  gemsRef.current.push({
    id: Math.random().toString(),
    position: { ...validPos },
    value: value,
    color: value > 10 ? '#a855f7' : '#3b82f6',
    isCollected: false,
  });
};

/**
 * 픽업 아이템 스폰
 */
export const spawnPickup = (
  pickupsRef: React.MutableRefObject<Pickup[]>,
  player: Player,
  pos: Vector2,
  forceType?: PickupType
): void => {
  const luckBonus = (player.weapons.oracle?.amount || 0) / 100;
  if (!forceType && Math.random() > 0.05 * (1 + luckBonus)) return;

  let type: PickupType = 'chicken';
  if (forceType) {
    type = forceType;
  } else {
    const rand = Math.random();
    if (rand < PICKUP_DATA.chest.chance) type = 'chest';
    else if (rand < PICKUP_DATA.chest.chance + PICKUP_DATA.bomb.chance) type = 'bomb';
    else if (rand < PICKUP_DATA.chest.chance + PICKUP_DATA.bomb.chance + PICKUP_DATA.magnet.chance)
      type = 'magnet';
    else type = 'chicken';
  }

  // 지형지물 위에 스폰 방지
  const validPos = findValidSpawnPosition(pos, PICKUP_DATA[type].radius);
  if (!validPos) return;

  pickupsRef.current.push({
    id: Math.random().toString(),
    type,
    position: { ...validPos },
    radius: PICKUP_DATA[type].radius,
    life: 30,
  });
};

/**
 * 적 스폰
 */
export const spawnEnemy = (
  enemiesRef: React.MutableRefObject<Enemy[]>,
  player: Player,
  gameTime: number,
  stageId: number,
  types: EnemyType[],
  isBossSpawn: boolean = false,
  onBossUpdate?: (boss: Enemy | null) => void,
  wave: WaveNumber = 1
): void => {
  if (!player) return;
  if (!types || types.length === 0) return;

  const type = types[Math.floor(Math.random() * types.length)];

  // Arena mode: use base difficulty (no stage multipliers)
  const stageMult = 1.0;
  const timeScale = 1 + (gameTime / 120) * 0.1;

  // 지형지물을 피해 스폰 위치 찾기
  let spawnPos: Vector2 | null = null;
  const spawnDist = GAME_CONFIG.SPAWN_RADIUS;

  for (let attempt = 0; attempt < 12; attempt++) {
    const angle = Math.random() * Math.PI * 2;
    const testPos = {
      x: player.position.x + Math.cos(angle) * spawnDist,
      y: player.position.y + Math.sin(angle) * spawnDist,
    };
    if (!isObstacleAt(testPos.x, testPos.y, 20)) {
      spawnPos = testPos;
      break;
    }
  }

  // 유효한 위치 못 찾으면 스폰 취소 (보스는 무조건 스폰)
  if (!spawnPos) {
    if (isBossSpawn) {
      // 보스는 지형지물 무시하고 스폰
      const angle = Math.random() * Math.PI * 2;
      spawnPos = {
        x: player.position.x + Math.cos(angle) * spawnDist,
        y: player.position.y + Math.sin(angle) * spawnDist,
      };
    } else {
      return; // 일반 적은 스폰 취소
    }
  }

  let skillType: BossSkillType = 'none';
  let cooldown = 0;
  let hp = 0;
  let damage = 0;
  let speed = 0;
  let radius = 16;
  let color = '#ff0000';
  let mass = 1;
  let bossTier: BossTier = 'mini';
  let bossSkills: BossSkillType[] = [];
  let bossName: string | undefined;

  // Arena mode: No boss spawning - only regular enemies
  // isBossSpawn is always false in Arena mode
  {
    // 일반 적 스폰 (v5.5: getEnemyConfig 사용으로 크기 스케일 적용)
    const config = getEnemyConfig(type);
    if (!config) {
      console.error('[spawnEnemy] ENEMY_TYPES config NOT FOUND for type:', type);
      return;
    }

    hp = config.hp * stageMult * timeScale;
    damage = config.damage * stageMult;
    speed = config.speed;
    radius = config.radius; // v5.5: getEnemyConfig에서 이미 스케일 적용됨
    color = config.color;
    mass = config.mass;
  }

  // 원거리 적 속성 설정 (스테이지별 점진적 강화)
  let attackType: 'melee' | 'ranged' = 'melee';
  let attackRange: number | undefined;
  let attackCooldownTime: number | undefined;
  let projectileColor: string | undefined;
  let projectileSpeed: number | undefined;

  if (isRangedEnemy(type)) {
    const rangedConfig = getEnemyConfig(type);
    if (rangedConfig && rangedConfig.attackType === 'ranged') {
      attackType = 'ranged';

      // 스테이지별 원거리 적 스케일링 (리니어하게 강해짐)
      // 스테이지 1: 기본값, 스테이지 30: 약 1.5배 강화
      const rangedScaling = 1 + (stageId - 1) * 0.017; // 스테이지당 ~1.7% 강화

      // 사거리: 점진적 증가 (스테이지 1: 기본, 스테이지 30: +50%)
      attackRange = (rangedConfig.attackRange ?? 250) * rangedScaling;

      // 쿨다운: 점진적 감소 (스테이지 1: 기본, 스테이지 30: -30%)
      const cooldownReduction = Math.max(0.7, 1 - (stageId - 1) * 0.01);
      attackCooldownTime = (rangedConfig.attackCooldown ?? 2.0) * cooldownReduction;

      // 투사체 속도: 점진적 증가 (스테이지 1: 기본, 스테이지 30: +30%)
      const speedBonus = 1 + (stageId - 1) * 0.01;
      projectileSpeed = (rangedConfig.projectileSpeed ?? 200) * speedBonus;

      projectileColor = rangedConfig.projectileColor;
    }
  }

  const enemy: Enemy = {
    id: Math.random().toString(),
    position: spawnPos,
    velocity: { x: 0, y: 0 },
    radius,
    color,
    health: hp,
    maxHealth: hp,
    damage,
    speed,
    enemyType: type,
    state: 'chasing',
    stunTimer: 0,
    mass,
    hitBy: new Set(),
    isBoss: isBossSpawn,
    isFrozen: false,
    name: bossName,
    skillCooldown: cooldown,
    maxSkillCooldown: cooldown,
    skillType,
    skillDuration: 0,
    skillWarning: false,
    // 새로운 보스 관련 필드
    bossTier: isBossSpawn ? bossTier : undefined,
    bossSkills: isBossSpawn ? bossSkills : undefined,
    currentSkillIndex: 0,
    // 원거리 적 관련 필드
    attackType: attackType,
    attackRange: attackRange,
    attackCooldown: attackCooldownTime,
    projectileColor: projectileColor,
    projectileSpeed: projectileSpeed,
  };

  if (isBossSpawn && onBossUpdate) {
    onBossUpdate(enemy);
  }

  enemiesRef.current.push(enemy);
};

/**
 * 적 투사체 스폰
 */
export const spawnEnemyProjectile = (
  enemyProjectilesRef: React.MutableRefObject<{ id: string; position: Vector2; velocity: Vector2; radius: number; color: string; damage: number; life: number; skillType?: BossSkillType | 'ranged' }[]>,
  pos: Vector2,
  vel: Vector2,
  color: string,
  damage: number,
  radius: number = 8,
  skillType?: BossSkillType | 'ranged'
): void => {
  enemyProjectilesRef.current.push({
    id: Math.random().toString(),
    position: { ...pos },
    velocity: vel,
    radius,
    color,
    damage,
    life: 5,
    skillType,
  });
};

/**
 * 파티클 스폰
 */
export interface SpawnParticleOptions {
  type?: 'square' | 'text' | 'line' | 'ring' | 'smoke';
  text?: string;
}

export const spawnParticles = (
  particlesRef: React.MutableRefObject<any[]>,
  pos: Vector2,
  count: number,
  color: string,
  options: SpawnParticleOptions = {}
): void => {
  const { type = 'square', text = '' } = options;

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 50 + Math.random() * 100;
    particlesRef.current.push({
      position: { x: pos.x + (Math.random() - 0.5) * 10, y: pos.y + (Math.random() - 0.5) * 10 },
      velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
      radius: 3 + Math.random() * 3,
      color: color,
      life: 0.3 + Math.random() * 0.3,
      maxLife: 0.6,
      type: type,
      text: text,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: -5 + Math.random() * 10,
    });
  }
};

/**
 * 데미지 넘버 스폰
 */
export const spawnDamageNumber = (
  damageNumbersRef: React.MutableRefObject<any[]>,
  pos: Vector2,
  value: number,
  isHeal: boolean = false
): void => {
  damageNumbersRef.current.push({
    id: Math.random().toString(),
    position: { ...pos },
    value,
    color: isHeal ? '#22c55e' : '#ffffff',
    life: 1.0,
  });
};
