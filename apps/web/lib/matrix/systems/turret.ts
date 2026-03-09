/**
 * Turret AI System v3.0 - 캐릭터 무기 패턴 차용
 * CODE SURVIVOR - Agent & Skill 터렛
 *
 * 핵심 원칙:
 * - "차용" = 발사 패턴/모양만 빌려 씀 (DRY 코드 재사용)
 * - "독립" = 데미지, 쿨다운, 레벨, 업그레이드 모두 별개
 *
 * 예시:
 *   캐릭터: bow Lv.5 → 데미지 50 (캐릭터 레벨 기준)
 *   터렛:   bow 패턴 Lv.2 → 데미지 25 (터렛 레벨 기준, 블랙마켓 업그레이드)
 */

import {
  PlacedTurret,
  TurretAoeEffect,
  TurretConfig,
} from '../types';
import { getTurretById } from '../config/turrets.config';
import { Enemy, Projectile, Vector2, WeaponType } from '../types';
import { angleBetween, randomRange, distanceSquared } from '../utils/math';
import { WEAPON_DATA } from '../config/weapons.config';

// ============================================
// 플레이어 무기 기본값 참조 (v3.0 패턴 차용)
// turret은 발사 패턴만 차용, 데미지/쿨다운은 독립
// ============================================
const getPlayerWeaponDefaults = (weaponType: WeaponType) => {
  const weaponData = WEAPON_DATA[weaponType];
  if (!weaponData || !weaponData.stats[0]) {
    return { speed: 400, pierce: 1, knockback: 10, area: 10 };
  }
  const baseStats = weaponData.stats[0]; // Level 1 기준
  return {
    speed: baseStats.speed || 400,
    pierce: baseStats.pierce || 1,
    knockback: baseStats.knockback || 10,
    area: baseStats.area || 10,
  };
};

// 고유 ID 생성
const generateId = (): string => {
  return `turret_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Enemy 좌표 추출 헬퍼
const getEnemyPos = (enemy: Enemy): { x: number; y: number } => {
  return {
    x: enemy.position?.x ?? (enemy as any).x ?? 0,
    y: enemy.position?.y ?? (enemy as any).y ?? 0,
  };
};

// Enemy HP 추출 헬퍼
const getEnemyHp = (enemy: Enemy): number => {
  return enemy.health ?? (enemy as any).hp ?? 0;
};

/**
 * 터렛 데미지 계산 (터렛 레벨 기준 - 독립!)
 */
function calculateTurretDamage(config: TurretConfig, level: number): number {
  return config.baseDamage + (level - 1) * config.damagePerLevel;
}

/**
 * 터렛 업데이트 (매 프레임)
 * v5.0: 플레이어 머리 위 떠다니기 - playerPos 기반 범위 탐지 및 발사
 */
export function updateTurrets(
  turrets: PlacedTurret[],
  enemies: Enemy[],
  deltaTime: number,
  currentTime: number,
  playerPos?: { x: number; y: number } // v5.0: 플레이어 위치 (터렛이 플레이어를 따라다님)
): {
  updatedTurrets: PlacedTurret[];
  newUnifiedProjectiles: Projectile[];  // v3.0: GameCanvas 호환성을 위해 이름 변경
  newAoeEffects: TurretAoeEffect[];
} {
  const newUnifiedProjectiles: Projectile[] = [];
  const newAoeEffects: TurretAoeEffect[] = [];

  const updatedTurrets = turrets.map((turret, index) => {
    const config = getTurretById(turret.configId);
    if (!config) return turret;

    // v5.0: 터렛 실제 위치 계산 (Agent: 왼쪽 위, Skill: 오른쪽 위)
    const isAgent = config.type === 'agent';
    const AGENT_OFFSET_X = -25; // 왼쪽
    const AGENT_OFFSET_Y = -50; // 살짝 위
    const SKILL_OFFSET_X = 25;  // 오른쪽
    const SKILL_OFFSET_Y = -45; // 위

    let effectiveX: number;
    let effectiveY: number;

    if (playerPos) {
      if (isAgent) {
        effectiveX = playerPos.x + AGENT_OFFSET_X;
        effectiveY = playerPos.y + AGENT_OFFSET_Y;
      } else {
        effectiveX = playerPos.x + SKILL_OFFSET_X;
        effectiveY = playerPos.y + SKILL_OFFSET_Y;
      }
    } else {
      effectiveX = turret.x;
      effectiveY = turret.y;
    }

    // 스폰 애니메이션 업데이트
    if (turret.spawnAnimation < 1) {
      turret.spawnAnimation = Math.min(1, turret.spawnAnimation + deltaTime / 300);
    }

    // 히트 플래시 감소
    if (turret.hitFlash > 0) {
      turret.hitFlash = Math.max(0, turret.hitFlash - deltaTime / 100);
    }

    // v5.0: 범위 내 적 찾기 (플레이어 위치 기준)
    const enemiesInRange = findEnemiesInRange(
      effectiveX,
      effectiveY,
      config.range,
      enemies
    );

    // Agent 터렛: 적이 있으면 포신 회전 (부드러운 보간)
    let newFacingAngle = turret.facingAngle ?? 0;
    let newTargetFacingAngle = turret.targetFacingAngle ?? 0;

    if (config.type === 'agent' && enemiesInRange.length > 0) {
      // 가장 가까운 적 방향 계산 (getEnemyPos 헬퍼 사용!)
      const nearestEnemy = enemiesInRange[0];
      const enemyPos = getEnemyPos(nearestEnemy);
      const dx = enemyPos.x - effectiveX;
      const dy = enemyPos.y - effectiveY;
      // atan2는 오른쪽이 0, 위가 -PI/2 → 위쪽이 0이 되도록 조정
      newTargetFacingAngle = Math.atan2(dy, dx) + Math.PI / 2;

      // 부드러운 회전 보간 (각도 차이 최단 경로)
      let angleDiff = newTargetFacingAngle - (turret.facingAngle || 0);
      // 각도를 -PI ~ PI 범위로 정규화
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      // 회전 속도: deltaTime 기반 (초당 ~10라디안, 약 573도)
      const rotationSpeed = 10 * (deltaTime / 1000);
      if (Math.abs(angleDiff) < rotationSpeed) {
        newFacingAngle = newTargetFacingAngle;
      } else {
        newFacingAngle = (turret.facingAngle || 0) + Math.sign(angleDiff) * rotationSpeed;
      }
    }

    if (enemiesInRange.length === 0) {
      return {
        ...turret,
        facingAngle: newFacingAngle,
        targetFacingAngle: newTargetFacingAngle,
      };
    }

    // 쿨다운 체크
    const timeSinceLastFire = currentTime - (turret.lastFireTime || 0);
    if (timeSinceLastFire < config.cooldown) {
      return {
        ...turret,
        facingAngle: newFacingAngle,
        targetFacingAngle: newTargetFacingAngle,
      };
    }

    // 가장 가까운 적
    const nearestEnemy = enemiesInRange[0];

    // 터렛 레벨 기반 데미지 계산 (독립!)
    const damage = calculateTurretDamage(config, turret.level || 1);

    // v5.0: weaponType에 따른 발사 (플레이어 위치 기준)
    // 터렛의 effectivePos를 임시로 설정하여 투사체가 올바른 위치에서 발사되도록 함
    const turretWithEffectivePos = {
      ...turret,
      x: effectiveX,
      y: effectiveY,
    };

    const result = fireWeaponFromTurret(
      turretWithEffectivePos,
      config,
      damage,
      nearestEnemy,
      enemiesInRange,
      currentTime
    );

    // 투사체 추가
    if (result.projectiles && result.projectiles.length > 0) {
      newUnifiedProjectiles.push(...result.projectiles);
    }

    // AOE 효과 추가 (v5.0: 플레이어 위치 기준)
    if (result.aoeEffect) {
      // AOE 효과도 플레이어 위치 기준으로 조정
      result.aoeEffect.x = effectiveX;
      result.aoeEffect.y = effectiveY;
      newAoeEffects.push(result.aoeEffect);
    }

    return {
      ...turret,
      lastFireTime: currentTime,
      activeAoeEffectId: result.aoeEffect?.id,
      facingAngle: newFacingAngle,
      targetFacingAngle: newTargetFacingAngle,
    };
  });

  return {
    updatedTurrets,
    newUnifiedProjectiles,
    newAoeEffects,
  };
}

/**
 * 범위 내 적 찾기 (거리순 정렬)
 */
function findEnemiesInRange(
  x: number,
  y: number,
  range: number,
  enemies: Enemy[]
): Enemy[] {
  // v5.7: distanceSquared 최적화 - filter/sort 통합
  const rangeSq = range * range;
  const results: { enemy: Enemy; distSq: number }[] = [];

  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    const hp = getEnemyHp(e);
    if (hp <= 0) continue;

    const pos = getEnemyPos(e);
    const dx = pos.x - x;
    const dy = pos.y - y;
    const distSq = dx * dx + dy * dy;

    if (distSq <= rangeSq) {
      results.push({ enemy: e, distSq });
    }
  }

  // distSq 기준 정렬 (sqrt 불필요)
  results.sort((a, b) => a.distSq - b.distSq);
  return results.map(r => r.enemy);
}

/**
 * 터렛에서 무기 발사 (v3.0 핵심 함수)
 *
 * weaponType에 따라 캐릭터 무기 패턴을 차용하여 발사
 * 데미지, 쿨다운은 터렛 자체 스탯 사용 (독립!)
 */
function fireWeaponFromTurret(
  turret: PlacedTurret,
  config: TurretConfig,
  damage: number,
  target: Enemy,
  allEnemies: Enemy[],
  currentTime: number
): {
  projectiles?: Projectile[];
  aoeEffect?: TurretAoeEffect;
} {
  const targetPos = getEnemyPos(target);
  const dx = targetPos.x - turret.x;
  const dy = targetPos.y - turret.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);

  // v3.0: 플레이어 무기 기본값 참조 (패턴 차용)
  const weaponDefaults = getPlayerWeaponDefaults(config.weaponType);

  // 터렛 config에서 오버라이드 값 가져오기 (없으면 플레이어 무기 기본값)
  const pierce = config.pierce ?? weaponDefaults.pierce;
  const projectileCount = config.projectileCount ?? 1;
  const projectileSpeed = config.projectileSpeed ?? weaponDefaults.speed;
  const knockback = config.knockback ?? weaponDefaults.knockback;

  switch (config.weaponType) {
    // ============================================
    // AGENT 터렛 (원거리 투사체)
    // ============================================

    case 'bow':
      return createBowProjectiles(turret, config, damage, angle, pierce, projectileCount, projectileSpeed, knockback);

    case 'wand':
      return createWandProjectiles(turret, config, damage, target, pierce, projectileSpeed, knockback);

    case 'beam':
      return createBeamProjectile(turret, config, damage, target, angle, knockback);

    case 'fork':
      return createForkProjectiles(turret, config, damage, angle, pierce, projectileCount, projectileSpeed, knockback);

    case 'airdrop':
      return createAirdropProjectiles(turret, config, damage, projectileCount, knockback);

    case 'shard':
      return createShardProjectiles(turret, config, damage, angle, pierce, projectileCount, projectileSpeed, knockback);

    // ============================================
    // SKILL 터렛 (근접 AOE)
    // ============================================

    case 'garlic':
      return createGarlicAoe(turret, config, damage, knockback);

    case 'knife':
      return createKnifeProjectiles(turret, config, damage, angle, projectileCount, projectileSpeed, knockback);

    case 'whip':
      return createWhipProjectile(turret, config, damage, angle, knockback);

    case 'pool':
      return createPoolAoe(turret, config, damage, knockback);

    case 'lightning':
      return createLightningProjectile(turret, config, damage, target, allEnemies, knockback);

    case 'laser':
      return createLaserProjectile(turret, config, damage, angle, knockback);

    default:
      // 기본: 단순 투사체
      return createDefaultProjectile(turret, config, damage, angle, pierce, projectileSpeed, knockback);
  }
}

// ============================================
// AGENT 터렛 발사 함수들 (원거리)
// ============================================

/**
 * Bow 패턴 - 빠른 직선 화살
 * v3.0: 플레이어 무기 기본값 차용 (speed: 600, pierce: 3, knockback: 8)
 */
function createBowProjectiles(
  turret: PlacedTurret,
  config: TurretConfig,
  damage: number,
  baseAngle: number,
  pierce: number,
  count: number,
  speed: number,
  knockback: number
): { projectiles: Projectile[] } {
  const projectiles: Projectile[] = [];

  for (let i = 0; i < count; i++) {
    // 첫 발은 정조준, 나머지만 스프레드
    let finalAngle = baseAngle;
    if (count > 1 && i > 0) {
      const spreadDir = i % 2 === 1 ? 1 : -1;
      const spreadMag = Math.ceil(i / 2) * 0.15;
      finalAngle = baseAngle + spreadDir * spreadMag;
    }

    projectiles.push({
      id: generateId(),
      type: 'bow',
      position: { x: turret.x, y: turret.y },
      velocity: { x: Math.cos(finalAngle) * speed, y: Math.sin(finalAngle) * speed },
      radius: 4,
      color: config.color,
      life: 2.0, // 초 단위 (updatePlayerProjectiles에서 초 단위로 차감)
      damage,
      pierce,
      knockback,
      angle: finalAngle,
      turretId: turret.id,
    });
  }

  return { projectiles };
}

/**
 * Wand 패턴 - 유도 미사일
 * v3.0: 플레이어 무기 기본값 차용 (speed: 450, pierce: 1, knockback: 8)
 */
function createWandProjectiles(
  turret: PlacedTurret,
  config: TurretConfig,
  damage: number,
  target: Enemy,
  pierce: number,
  speed: number,
  knockback: number
): { projectiles: Projectile[] } {
  const targetPos = getEnemyPos(target);
  const dx = targetPos.x - turret.x;
  const dy = targetPos.y - turret.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);

  return {
    projectiles: [{
      id: generateId(),
      type: 'wand',
      position: { x: turret.x, y: turret.y },
      velocity: { x: (dx / dist) * speed, y: (dy / dist) * speed },
      radius: 10,
      color: config.color,
      life: 3.0, // 초 단위
      damage,
      pierce,
      knockback,
      angle,
      turretId: turret.id,
      targetId: target.id,
      homingStrength: 0.08, // 유도 강도
    }],
  };
}

/**
 * Beam 패턴 - 지속 레이저 빔
 * v3.0: 플레이어 무기 기본값 차용 (pierce: 999, knockback: 40)
 */
function createBeamProjectile(
  turret: PlacedTurret,
  config: TurretConfig,
  damage: number,
  target: Enemy,
  angle: number,
  knockback: number
): { projectiles: Projectile[] } {
  return {
    projectiles: [{
      id: generateId(),
      type: 'beam',
      position: { x: turret.x, y: turret.y },
      velocity: { x: 0, y: 0 },
      radius: 8,
      color: config.color,
      life: 0.1, // 초 단위 (틱당 지속)
      damage,
      pierce: 999,
      knockback,
      angle,
      shape: 'rect',
      width: 8,
      height: config.range,
      startLife: 0.1,
      turretId: turret.id,
      targetId: target.id,
    }],
  };
}

/**
 * Fork 패턴 - 분기 투사체 + 독 데미지
 * v3.0: 플레이어 무기 기본값 차용 (speed: 350, pierce: 2, knockback: 8)
 */
function createForkProjectiles(
  turret: PlacedTurret,
  config: TurretConfig,
  damage: number,
  baseAngle: number,
  pierce: number,
  count: number,
  speed: number,
  knockback: number
): { projectiles: Projectile[] } {
  const projectiles: Projectile[] = [];

  for (let i = 0; i < count; i++) {
    let finalAngle = baseAngle;
    if (count > 1 && i > 0) {
      const spreadDir = i % 2 === 1 ? 1 : -1;
      const spreadMag = Math.ceil(i / 2) * 0.3;
      finalAngle = baseAngle + spreadDir * spreadMag;
    }

    projectiles.push({
      id: generateId(),
      type: 'fork',
      position: { x: turret.x, y: turret.y },
      velocity: { x: Math.cos(finalAngle) * speed, y: Math.sin(finalAngle) * speed },
      radius: 12,
      color: config.color,
      life: 2.0, // 초 단위
      damage,
      pierce,
      knockback,
      angle: finalAngle,
      turretId: turret.id,
      bounceCount: 1, // 1회 분기 가능
      baseSpeed: speed,
      poisonDamage: Math.floor(damage * 0.2), // 데미지의 20%
      poisonDuration: 2.5,
    });
  }

  return { projectiles };
}

/**
 * Airdrop 패턴 - 공중 폭격
 * v3.0: 플레이어 무기 기본값 차용 (pierce: 999, knockback: 40)
 */
function createAirdropProjectiles(
  turret: PlacedTurret,
  config: TurretConfig,
  damage: number,
  count: number,
  knockback: number
): { projectiles: Projectile[] } {
  const projectiles: Projectile[] = [];

  for (let i = 0; i < count; i++) {
    // 터렛 주변 랜덤 위치에 타겟 설정
    const offsetX = randomRange(-config.range * 0.5, config.range * 0.5);
    const offsetY = randomRange(-config.range * 0.5, config.range * 0.5);
    const targetX = turret.x + offsetX;
    const targetY = turret.y + offsetY;

    // 미사일은 하늘(위쪽)에서 시작, 아래로 낙하
    const startY = targetY - 300;
    const fallDelay = i * 0.1;

    projectiles.push({
      id: generateId(),
      type: 'airdrop',
      position: { x: targetX, y: startY },
      velocity: { x: 0, y: 600 },
      radius: 80, // 폭발 반경
      color: config.color,
      life: 1.0 + fallDelay, // 초 단위
      damage,
      pierce: 999,
      knockback,
      angle: Math.PI / 2,
      turretId: turret.id,
      startPos: { x: targetX, y: targetY },
      hitCount: 0,
      bounceCount: Math.floor(fallDelay * 60),
    });
  }

  return { projectiles };
}

/**
 * Shard 패턴 - 분열 투사체
 * v3.0: 플레이어 무기 기본값 차용 (speed: 400, pierce: 1, knockback: 5)
 */
function createShardProjectiles(
  turret: PlacedTurret,
  config: TurretConfig,
  damage: number,
  baseAngle: number,
  pierce: number,
  count: number,
  speed: number,
  knockback: number
): { projectiles: Projectile[] } {
  const projectiles: Projectile[] = [];

  for (let i = 0; i < count; i++) {
    let finalAngle = baseAngle;
    if (count > 1 && i > 0) {
      const spreadDir = i % 2 === 1 ? 1 : -1;
      const spreadMag = Math.ceil(i / 2) * 0.25;
      finalAngle = baseAngle + spreadDir * spreadMag;
    }

    projectiles.push({
      id: generateId(),
      type: 'shard',
      position: { x: turret.x, y: turret.y },
      velocity: { x: Math.cos(finalAngle) * speed, y: Math.sin(finalAngle) * speed },
      radius: 12,
      color: config.color,
      life: 2.0, // 초 단위
      damage,
      pierce: 1, // 원본은 1회 히트 후 분열
      knockback,
      angle: finalAngle,
      turretId: turret.id,
      bounceCount: 0, // 0 = 원본 (분열 가능)
      splitDamage: Math.floor(damage * 0.3), // 분열 파편 데미지
    });
  }

  return { projectiles };
}

// ============================================
// SKILL 터렛 발사 함수들 (근접 AOE)
// ============================================

/**
 * Garlic 패턴 - 주변 AOE 오라
 * v3.0: 플레이어 무기 기본값 차용 (area: 54, knockback: 5)
 */
function createGarlicAoe(
  turret: PlacedTurret,
  config: TurretConfig,
  damage: number,
  knockback: number
): { aoeEffect: TurretAoeEffect } {
  return {
    aoeEffect: {
      id: generateId(),
      turretId: turret.id,
      weaponType: 'garlic',
      x: turret.x,
      y: turret.y,
      radius: config.range,
      damage,
      life: config.cooldown, // 쿨다운 동안 지속
      maxLife: config.cooldown,
      color: config.color,
      tickRate: 500, // 0.5초마다 데미지
      lastTickTime: 0,
      knockback,
    },
  };
}

/**
 * Knife 패턴 - 회전 칼날
 * v3.0: 플레이어 무기 기본값 차용 (speed: 500, pierce: 1, knockback: 5)
 */
function createKnifeProjectiles(
  turret: PlacedTurret,
  config: TurretConfig,
  damage: number,
  baseAngle: number,
  count: number,
  speed: number,
  knockback: number
): { projectiles: Projectile[] } {
  const projectiles: Projectile[] = [];
  const step = (Math.PI * 2) / count;

  for (let i = 0; i < count; i++) {
    const angle = baseAngle + i * step;
    const rotSpeed = (Math.random() > 0.5 ? 1 : -1) * (15 + Math.random() * 10);

    projectiles.push({
      id: generateId(),
      type: 'knife',
      position: { x: turret.x, y: turret.y },
      velocity: { x: 0, y: 0 }, // 터렛 주변 회전
      radius: 10,
      color: config.color,
      life: 0.5, // 초 단위 (짧은 지속)
      damage,
      pierce: 999,
      knockback,
      angle,
      turretId: turret.id,
      orbitAngle: angle,
      startPos: { x: config.range * 0.5, y: 0 }, // 터렛 중심에서 거리
      rotationSpeed: rotSpeed,
      currentRotation: Math.random() * Math.PI * 2,
    });
  }

  return { projectiles };
}

/**
 * Whip 패턴 - 넓은 채찍 공격
 * v3.0: 플레이어 무기 기본값 차용 (pierce: 999, knockback: 35)
 */
function createWhipProjectile(
  turret: PlacedTurret,
  config: TurretConfig,
  damage: number,
  angle: number,
  knockback: number
): { projectiles: Projectile[] } {
  return {
    projectiles: [{
      id: generateId(),
      type: 'whip',
      position: { x: turret.x, y: turret.y },
      velocity: { x: 0, y: 0 },
      radius: config.range,
      color: config.color,
      life: 0.3, // 초 단위
      damage,
      pierce: 999,
      knockback,
      angle,
      turretId: turret.id,
      startLife: 0.3,
    }],
  };
}

/**
 * Pool 패턴 - 지역 효과
 * v3.0: 플레이어 무기 기본값 차용 (pierce: 999, knockback: 0)
 */
function createPoolAoe(
  turret: PlacedTurret,
  config: TurretConfig,
  damage: number,
  knockback: number
): { aoeEffect: TurretAoeEffect } {
  return {
    aoeEffect: {
      id: generateId(),
      turretId: turret.id,
      weaponType: 'pool',
      x: turret.x,
      y: turret.y,
      radius: config.range,
      damage,
      life: 2000,
      maxLife: 2000,
      color: config.color,
      tickRate: 500,
      lastTickTime: 0,
      slowPercent: 0.3, // 30% 이동속도 감소
      knockback, // pool은 기본 0
    },
  };
}

/**
 * Lightning 패턴 - 연쇄 번개
 * v3.0: 플레이어 무기 기본값 차용 (pierce: 1, knockback: 10)
 */
function createLightningProjectile(
  turret: PlacedTurret,
  config: TurretConfig,
  damage: number,
  target: Enemy,
  allEnemies: Enemy[],
  knockback: number
): { projectiles: Projectile[] } {
  // 연쇄 번개는 특수 처리 필요 (LightningBolt 생성)
  // 여기서는 단순화하여 beam 형태로 표현
  const targetPos = getEnemyPos(target);
  const angle = Math.atan2(targetPos.y - turret.y, targetPos.x - turret.x);

  return {
    projectiles: [{
      id: generateId(),
      type: 'lightning', // 특수 렌더링
      position: { x: turret.x, y: turret.y },
      velocity: { x: 0, y: 0 },
      radius: 5,
      color: '#fbbf24',
      life: 0.15, // 초 단위
      damage,
      pierce: 5, // 연쇄 횟수
      knockback,
      angle,
      turretId: turret.id,
      targetId: target.id,
      shape: 'rect',
      width: 5,
      height: config.range,
      startLife: 0.15,
    }],
  };
}

/**
 * Laser 패턴 - 회전 레이저
 * v3.0: 플레이어 무기 기본값 차용 (pierce: 999, knockback: 15)
 */
function createLaserProjectile(
  turret: PlacedTurret,
  config: TurretConfig,
  damage: number,
  baseAngle: number,
  knockback: number
): { projectiles: Projectile[] } {
  // 180도 스윕
  const sweepRadians = Math.PI;
  const sweepStartAngle = baseAngle - sweepRadians / 2;

  return {
    projectiles: [{
      id: generateId(),
      type: 'laser',
      position: { x: turret.x, y: turret.y },
      velocity: { x: 0, y: 0 },
      radius: config.range,
      color: config.color,
      life: 0.6, // 초 단위
      damage,
      pierce: 999,
      knockback,
      angle: sweepStartAngle,
      sweepStartAngle,
      turretId: turret.id,
      startLife: 0.6,
      sweepAngle: sweepRadians,
      sweepDirection: 1,
    }],
  };
}

/**
 * 기본 투사체 (fallback)
 * v3.0: 플레이어 무기 기본값 차용
 */
function createDefaultProjectile(
  turret: PlacedTurret,
  config: TurretConfig,
  damage: number,
  angle: number,
  pierce: number,
  speed: number,
  knockback: number
): { projectiles: Projectile[] } {
  return {
    projectiles: [{
      id: generateId(),
      type: 'bow', // 기본 bow 렌더링
      position: { x: turret.x, y: turret.y },
      velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
      radius: 6,
      color: config.color,
      life: 2.0, // 초 단위
      damage,
      pierce,
      knockback,
      angle,
      turretId: turret.id,
    }],
  };
}

// ============================================
// AOE 효과 업데이트
// ============================================

/**
 * 터렛 AOE 효과 업데이트
 */
export function updateTurretAoeEffects(
  effects: TurretAoeEffect[],
  enemies: Enemy[],
  deltaTime: number,
  currentTime: number
): {
  updatedEffects: TurretAoeEffect[];
  affectedEnemies: { enemyId: string; damage: number; effect?: string }[];
} {
  const affectedEnemies: { enemyId: string; damage: number; effect?: string }[] = [];

  const updatedEffects = effects
    .map(effect => {
      // 수명 감소
      effect.life -= deltaTime;
      if (effect.life <= 0) return null;

      // 틱 데미지 체크
      const tickRate = effect.tickRate || 500;
      const lastTick = effect.lastTickTime || 0;

      if (currentTime - lastTick >= tickRate) {
        effect.lastTickTime = currentTime;

        // 범위 내 적 피해 (v5.7: distanceSquared 최적화)
        for (let ei = 0; ei < enemies.length; ei++) {
          const enemy = enemies[ei];
          if (getEnemyHp(enemy) <= 0) continue;

          const enemyPos = getEnemyPos(enemy);
          const dx = enemyPos.x - effect.x;
          const dy = enemyPos.y - effect.y;
          const distSq = dx * dx + dy * dy;
          const combinedRadius = effect.radius + (enemy.radius || 20);

          if (distSq < combinedRadius * combinedRadius) {
            affectedEnemies.push({
              enemyId: enemy.id,
              damage: effect.damage || 0,
              effect: effect.slowPercent ? `slow:${effect.slowPercent}` : undefined,
            });
          }
        }
      }

      return effect;
    })
    .filter((e): e is TurretAoeEffect => e !== null);

  return { updatedEffects, affectedEnemies };
}

/**
 * 터렛 피해 처리
 */
export function damageTurret(
  turret: PlacedTurret,
  damage: number
): PlacedTurret | null {
  const newHp = turret.hp - damage;

  if (newHp <= 0) {
    return null; // 파괴됨
  }

  return {
    ...turret,
    hp: newHp,
    hitFlash: 1,
  };
}

/**
 * 터렛 생성 헬퍼
 */
export function createPlacedTurret(
  configId: string,
  x: number,
  y: number,
  level: number = 1
): PlacedTurret | null {
  const config = getTurretById(configId);
  if (!config) return null;

  return {
    id: generateId(),
    configId,
    type: config.type,
    x,
    y,
    hp: config.hp,
    maxHp: config.hp,
    level,
    lastFireTime: 0,
    spawnAnimation: 0,
    hitFlash: 0,
    facingAngle: 0,         // Agent 터렛 포신 현재 각도
    targetFacingAngle: 0,   // Agent 터렛 포신 목표 각도
  };
}

// ============================================
// 렌더링 함수
// ============================================

/**
 * 터렛 렌더링
 */
export function drawTurret(
  ctx: CanvasRenderingContext2D,
  turret: PlacedTurret,
  time: number
): void {
  const config = getTurretById(turret.configId);
  if (!config) return;

  const { x, y, hp, maxHp, spawnAnimation, hitFlash } = turret;

  ctx.save();

  // 스폰 애니메이션
  const scale = Math.min(1, spawnAnimation);
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // 히트 플래시 효과
  const flashAlpha = hitFlash > 0 ? 0.5 : 0;

  // 기본 크기
  const baseSize = 24;
  const isAgent = turret.type === 'agent';

  // 그림자
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.ellipse(0, baseSize * 0.6, baseSize * 0.7, baseSize * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // 바디 (Agent: 원형 드론, Skill: 육각형 타워)
  if (isAgent) {
    // Agent: 원형 드론
    ctx.fillStyle = config.color;
    ctx.beginPath();
    ctx.arc(0, 0, baseSize * 0.7, 0, Math.PI * 2);
    ctx.fill();

    // 내부 원
    ctx.fillStyle = config.glowColor;
    ctx.beginPath();
    ctx.arc(0, 0, baseSize * 0.4, 0, Math.PI * 2);
    ctx.fill();

    // 중심 코어
    const pulse = 0.8 + Math.sin(time / 200) * 0.2;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, baseSize * 0.2 * pulse, 0, Math.PI * 2);
    ctx.fill();

    // 회전 링
    const rotation = (time / 1000) % (Math.PI * 2);
    ctx.strokeStyle = `${config.color}80`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, baseSize * 0.9, rotation, rotation + Math.PI * 1.5);
    ctx.stroke();
  } else {
    // Skill: 육각형 타워
    const hexSize = baseSize * 0.8;
    ctx.fillStyle = config.color;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 2;
      const hx = Math.cos(angle) * hexSize;
      const hy = Math.sin(angle) * hexSize;
      if (i === 0) ctx.moveTo(hx, hy);
      else ctx.lineTo(hx, hy);
    }
    ctx.closePath();
    ctx.fill();

    // 내부 육각형
    ctx.fillStyle = config.glowColor;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 2;
      const hx = Math.cos(angle) * hexSize * 0.6;
      const hy = Math.sin(angle) * hexSize * 0.6;
      if (i === 0) ctx.moveTo(hx, hy);
      else ctx.lineTo(hx, hy);
    }
    ctx.closePath();
    ctx.fill();

    // 오라 펄스 효과
    const auraSize = 1 + Math.sin(time / 300) * 0.15;
    ctx.strokeStyle = `${config.color}40`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 2;
      const hx = Math.cos(angle) * hexSize * auraSize * 1.2;
      const hy = Math.sin(angle) * hexSize * auraSize * 1.2;
      if (i === 0) ctx.moveTo(hx, hy);
      else ctx.lineTo(hx, hy);
    }
    ctx.closePath();
    ctx.stroke();
  }

  // HP 바
  if (hp < maxHp) {
    const barWidth = baseSize * 1.5;
    const barHeight = 4;
    const barY = -baseSize - 8;

    // 배경
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(-barWidth / 2, barY, barWidth, barHeight);

    // HP
    const hpPercent = hp / maxHp;
    const hpColor = hpPercent > 0.5 ? '#22c55e' : hpPercent > 0.25 ? '#eab308' : '#ef4444';
    ctx.fillStyle = hpColor;
    ctx.fillRect(-barWidth / 2, barY, barWidth * hpPercent, barHeight);
  }

  // 히트 플래시 오버레이
  if (flashAlpha > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
    ctx.beginPath();
    ctx.arc(0, 0, baseSize, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * 터렛 AOE 효과 렌더링
 */
export function drawTurretAoeEffect(
  ctx: CanvasRenderingContext2D,
  effect: TurretAoeEffect,
  time: number
): void {
  const { x, y, radius, color, life, maxLife, weaponType } = effect;

  ctx.save();
  ctx.translate(x, y);

  const lifePercent = life / maxLife;
  const alpha = lifePercent * 0.6;

  // 무기 타입에 따른 시각 효과
  switch (weaponType) {
    case 'garlic': {
      // 오라 효과
      const pulse = 0.9 + Math.sin(time / 200) * 0.1;
      const r = radius * pulse;

      // 외곽 원
      ctx.strokeStyle = `${color}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();

      // 내부 그라데이션
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      grad.addColorStop(0, `${color}${Math.floor(alpha * 0.4 * 255).toString(16).padStart(2, '0')}`);
      grad.addColorStop(1, `${color}00`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'pool': {
      // 중력장 / 풀 효과
      const wobble = 0.95 + Math.sin(time / 150) * 0.05;
      const r = radius * wobble;

      // 소용돌이 선
      ctx.strokeStyle = `${color}${Math.floor(alpha * 200).toString(16).padStart(2, '0')}`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const startAngle = (time / 500 + i * (Math.PI * 2 / 3)) % (Math.PI * 2);
        ctx.beginPath();
        ctx.arc(0, 0, r * (0.4 + i * 0.2), startAngle, startAngle + Math.PI);
        ctx.stroke();
      }

      // 중심 원
      const centerGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      centerGrad.addColorStop(0, `${color}${Math.floor(alpha * 0.5 * 255).toString(16).padStart(2, '0')}`);
      centerGrad.addColorStop(0.5, `${color}${Math.floor(alpha * 0.2 * 255).toString(16).padStart(2, '0')}`);
      centerGrad.addColorStop(1, `${color}00`);
      ctx.fillStyle = centerGrad;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    default: {
      // 기본 원형 효과
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
      grad.addColorStop(0, `${color}${Math.floor(alpha * 0.5 * 255).toString(16).padStart(2, '0')}`);
      grad.addColorStop(1, `${color}00`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}
