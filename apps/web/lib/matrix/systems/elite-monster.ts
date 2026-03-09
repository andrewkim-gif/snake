/**
 * eliteMonster.ts - Elite Monster System (v7.15)
 *
 * 엘리트 몬스터 스폰/관리/드랍 시스템
 * - 100-300 킬마다 랜덤 스폰
 * - 플레이어 평균 데미지 × 배율 HP
 * - 티어별 크기/글로우/드랍 설정
 * - 디아블로 스타일 캐스케이드 드랍
 */

import { Enemy, Player, Pickup, Vector2, EliteTier, WeaponType } from '../types';
import {
  ELITE_SPAWN_CONFIG,
  ELITE_TIER_CONFIGS,
  ELITE_DROP_CONFIG,
  selectEliteTier,
  calculateEliteHP,
  calculateEliteDropCount,
  getEnemyConfig,
} from '../config/enemies.config';

// =====================================================
// 엘리트 스폰 상태 관리
// =====================================================

export interface EliteSpawnState {
  lastEliteKillCount: number;    // 마지막 엘리트 스폰 시점의 킬 카운트
  nextEliteKillThreshold: number; // 다음 엘리트 스폰 킬 카운트
  currentEliteCount: number;      // 현재 존재하는 엘리트 수
}

// 초기 상태 생성
export const createEliteSpawnState = (): EliteSpawnState => {
  const [minKill, maxKill] = ELITE_SPAWN_CONFIG.killCountRange;
  return {
    lastEliteKillCount: 0,
    nextEliteKillThreshold: Math.floor(Math.random() * (maxKill - minKill + 1)) + minKill,
    currentEliteCount: 0,
  };
};

// 다음 엘리트 스폰 임계값 계산
const calculateNextThreshold = (currentKillCount: number): number => {
  const [minKill, maxKill] = ELITE_SPAWN_CONFIG.killCountRange;
  const randomKills = Math.floor(Math.random() * (maxKill - minKill + 1)) + minKill;
  return currentKillCount + randomKills;
};

// =====================================================
// 플레이어 평균 데미지 계산
// =====================================================

export const calculateAveragePlayerDamage = (player: Player): number => {
  const weapons = player.weapons;
  let totalDamage = 0;
  let weaponCount = 0;

  // 모든 보유 무기의 데미지 합산
  for (const weaponType in weapons) {
    const weapon = weapons[weaponType as WeaponType];
    if (weapon && weapon.damage > 0) {
      totalDamage += weapon.damage;
      weaponCount++;
    }
  }

  // 평균 데미지 (무기 없으면 기본값 10)
  return weaponCount > 0 ? Math.ceil(totalDamage / weaponCount) : 10;
};

// =====================================================
// 엘리트 스폰 체크
// =====================================================

export interface EliteSpawnResult {
  shouldSpawn: boolean;
  tier?: EliteTier;
  hp?: number;
  dropCount?: number;
}

export const checkEliteSpawn = (
  killCount: number,
  gameTime: number,
  state: EliteSpawnState,
  player: Player
): EliteSpawnResult => {
  // 조건 체크
  if (gameTime < ELITE_SPAWN_CONFIG.minGameTime) {
    return { shouldSpawn: false };
  }

  if (state.currentEliteCount >= ELITE_SPAWN_CONFIG.maxConcurrentElites) {
    return { shouldSpawn: false };
  }

  if (killCount < state.nextEliteKillThreshold) {
    return { shouldSpawn: false };
  }

  // 스폰 조건 충족
  const tier = selectEliteTier();
  const avgDamage = calculateAveragePlayerDamage(player);
  const hp = calculateEliteHP(avgDamage, tier);
  const dropCount = calculateEliteDropCount(tier);

  return {
    shouldSpawn: true,
    tier,
    hp,
    dropCount,
  };
};

// 엘리트 스폰 상태 업데이트
export const updateEliteSpawnState = (
  state: EliteSpawnState,
  killCount: number,
  spawned: boolean
): EliteSpawnState => {
  if (spawned) {
    return {
      ...state,
      lastEliteKillCount: killCount,
      nextEliteKillThreshold: calculateNextThreshold(killCount),
      currentEliteCount: state.currentEliteCount + 1,
    };
  }
  return state;
};

// 엘리트 사망 시 상태 업데이트
export const onEliteDeath = (state: EliteSpawnState): EliteSpawnState => {
  return {
    ...state,
    currentEliteCount: Math.max(0, state.currentEliteCount - 1),
  };
};

// =====================================================
// 일반 적을 엘리트로 변환
// =====================================================

export const convertToElite = (
  enemy: Enemy,
  tier: EliteTier,
  hp: number,
  dropCount: number
): Enemy => {
  const config = ELITE_TIER_CONFIGS[tier];
  const baseConfig = getEnemyConfig(enemy.enemyType);

  return {
    ...enemy,
    // 엘리트 설정
    isElite: true,
    eliteTier: tier,
    eliteGlow: 0, // 글로우 펄스 초기값
    eliteDropCount: dropCount,

    // 스탯 조정
    health: hp,
    maxHealth: hp,
    radius: Math.round(enemy.radius * config.sizeScale),
    speed: enemy.speed * config.speedMultiplier,
    damage: Math.round(baseConfig.damage * config.damageMultiplier),
  };
};

// =====================================================
// 엘리트 글로우 업데이트 (렌더링용)
// =====================================================

export const updateEliteGlow = (enemy: Enemy, deltaTime: number): number => {
  if (!enemy.isElite || !enemy.eliteTier) return 0;

  const config = ELITE_TIER_CONFIGS[enemy.eliteTier];
  // 사인파 펄스 (0.5-1.5 주기로 글로우 변화)
  const time = Date.now() / 1000;
  const pulse = (Math.sin(time * 3) + 1) / 2; // 0-1 범위

  return pulse * config.glowIntensity;
};

// =====================================================
// 디아블로 스타일 드랍 시스템
// =====================================================

export interface EliteDropItem {
  id: string;
  position: Vector2;
  velocity: Vector2;
  velocityZ: number;        // 수직 속도 (점프/낙하)
  z: number;                // 현재 높이
  bounceCount: number;      // 남은 바운스 횟수
  collectableAt: number;    // 수집 가능 시간 (timestamp)
  isCollectable: boolean;
}

// 엘리트 드랍 아이템 생성
export const createEliteDrops = (
  position: Vector2,
  dropCount: number
): EliteDropItem[] => {
  const drops: EliteDropItem[] = [];
  const { initialVelocity, physics, collectableAfterMs } = ELITE_DROP_CONFIG;
  const now = Date.now();

  for (let i = 0; i < dropCount; i++) {
    // 부채꼴 분산 각도 계산
    const spreadAngle = (Math.PI * 2 * i) / dropCount + (Math.random() - 0.5) * 0.3;
    const horizontalSpeed = initialVelocity.horizontal * (0.8 + Math.random() * 0.4);

    drops.push({
      id: `elite_drop_${now}_${i}`,
      position: { ...position },
      velocity: {
        x: Math.cos(spreadAngle) * horizontalSpeed,
        y: Math.sin(spreadAngle) * horizontalSpeed * 0.5, // y축은 덜 분산
      },
      velocityZ: initialVelocity.vertical * (0.9 + Math.random() * 0.2),
      z: 0,
      bounceCount: physics.bounceCount,
      collectableAt: now + collectableAfterMs + (i * ELITE_DROP_CONFIG.spawnDelayMs),
      isCollectable: false,
    });
  }

  return drops;
};

// 드랍 아이템 물리 업데이트
export const updateEliteDropPhysics = (
  drop: EliteDropItem,
  deltaTime: number
): EliteDropItem => {
  const { physics } = ELITE_DROP_CONFIG;
  const now = Date.now();

  // 수집 가능 상태 업데이트
  const isCollectable = now >= drop.collectableAt && drop.z <= 0 && drop.bounceCount <= 0;

  // 이미 수집 가능하면 물리 업데이트 불필요
  if (isCollectable && drop.isCollectable) {
    return { ...drop, isCollectable };
  }

  // 중력 적용
  let velocityZ = drop.velocityZ - physics.gravity * deltaTime;
  let z = drop.z + velocityZ * deltaTime;

  // 바운스 처리
  let bounceCount = drop.bounceCount;
  if (z <= 0 && velocityZ < 0) {
    z = 0;
    if (bounceCount > 0) {
      velocityZ = -velocityZ * physics.bounceDecay;
      bounceCount--;
    } else {
      velocityZ = 0;
    }
  }

  // 수평 마찰
  const velocity = {
    x: drop.velocity.x * physics.friction,
    y: drop.velocity.y * physics.friction,
  };

  // 위치 업데이트
  const position = {
    x: drop.position.x + velocity.x * deltaTime,
    y: drop.position.y + velocity.y * deltaTime,
  };

  return {
    ...drop,
    position,
    velocity,
    velocityZ,
    z,
    bounceCount,
    isCollectable,
  };
};

// 드랍 아이템을 Pickup으로 변환
export const convertDropToPickup = (drop: EliteDropItem): Pickup => {
  return {
    id: drop.id,
    type: 'upgrade_material',
    position: drop.position,
    radius: 14,
    life: 30, // 30초 후 소멸
  };
};

// =====================================================
// 엘리트 사망 처리
// =====================================================

export interface EliteDeathResult {
  drops: EliteDropItem[];
  soundEffect: string;
  screenShake: number;
}

export const processEliteDeath = (enemy: Enemy): EliteDeathResult => {
  if (!enemy.isElite || !enemy.eliteTier) {
    return { drops: [], soundEffect: '', screenShake: 0 };
  }

  const drops = createEliteDrops(enemy.position, enemy.eliteDropCount || 1);
  const config = ELITE_TIER_CONFIGS[enemy.eliteTier];

  // 티어별 사운드 및 화면 흔들림
  const soundEffect = enemy.eliteTier === 'diamond' ? 'cash' :
                      enemy.eliteTier === 'gold' ? 'levelup' : 'powerup';

  const screenShake = config.glowIntensity * 0.5;

  return {
    drops,
    soundEffect,
    screenShake,
  };
};

// =====================================================
// 엘리트 여부 확인 헬퍼
// =====================================================

export const isEliteEnemy = (enemy: Enemy): boolean => {
  return enemy.isElite === true;
};

export const getEliteConfig = (enemy: Enemy) => {
  if (!enemy.eliteTier) return null;
  return ELITE_TIER_CONFIGS[enemy.eliteTier];
};
