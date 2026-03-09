/**
 * rangedEnemy.ts - 원거리 적 AI 시스템
 * sniper, caster, artillery 타입 적의 행동 로직
 */

import { Enemy, Player, Vector2, EnemyType } from '../types';
import { isRangedEnemy, getEnemyConfig } from '../constants';
import { distance, normalize, angleBetween } from '../utils/math';
import { soundManager } from '../utils/audio';
import { ExtendedParticle } from './game-context';

/**
 * 원거리 적 공격 콜백
 */
export interface RangedEnemyCallbacks {
  spawnEnemyProjectile: (
    pos: Vector2,
    vel: Vector2,
    color: string,
    damage: number,
    radius?: number
  ) => void;
  spawnParticles: (pos: Vector2, count: number, color: string, type: string) => void;
}

/**
 * 원거리 적 행동 업데이트
 * - 사거리 밖: 플레이어에게 접근
 * - 사거리 내: 멈추고 공격
 */
export const updateRangedEnemy = (
  enemy: Enemy,
  player: Player,
  deltaTime: number,
  gameTime: number,
  callbacks: RangedEnemyCallbacks
): void => {
  if (!isRangedEnemy(enemy.enemyType)) return;
  if (enemy.state === 'dying' || enemy.state === 'stunned') return;

  const config = getEnemyConfig(enemy.enemyType);
  if (!config || config.attackType !== 'ranged') return;

  const dist = distance(enemy.position, player.position);
  // 스폰 시 설정된 값 사용 (스테이지별 스케일링 적용됨)
  const attackRange = enemy.attackRange || config.attackRange || 250;
  const attackCooldownBase = enemy.attackCooldown !== undefined ? enemy.attackCooldown : (config.attackCooldown || 2.0);

  // 쿨다운 업데이트 (currentCooldown은 남은 시간)
  if (enemy.currentAttackCooldown === undefined) {
    enemy.currentAttackCooldown = attackCooldownBase;
  }
  enemy.currentAttackCooldown = Math.max(0, enemy.currentAttackCooldown - deltaTime);

  // 사거리 내에 있으면 멈추고 공격
  if (dist <= attackRange) {
    // 멈춤 (약간의 느린 움직임 허용)
    const dir = normalize({
      x: player.position.x - enemy.position.x,
      y: player.position.y - enemy.position.y,
    });

    // 사거리 유지를 위해 살짝 뒤로
    if (dist < attackRange * 0.6) {
      enemy.position.x -= dir.x * enemy.speed * 0.3 * deltaTime;
      enemy.position.y -= dir.y * enemy.speed * 0.3 * deltaTime;
    }

    // 공격
    if (enemy.currentAttackCooldown <= 0) {
      fireRangedAttack(enemy, player, config, callbacks);
      enemy.currentAttackCooldown = attackCooldownBase;
      enemy.lastAttackTime = gameTime;
    }
  } else {
    // 사거리 밖이면 접근
    const dir = normalize({
      x: player.position.x - enemy.position.x,
      y: player.position.y - enemy.position.y,
    });
    enemy.position.x += dir.x * enemy.speed * deltaTime;
    enemy.position.y += dir.y * enemy.speed * deltaTime;
  }

  // 속도 방향 업데이트 (렌더링용)
  enemy.velocity.x = player.position.x - enemy.position.x;
  enemy.velocity.y = player.position.y - enemy.position.y;
};

/**
 * 원거리 공격 발사
 */
const fireRangedAttack = (
  enemy: Enemy,
  player: Player,
  config: any,
  callbacks: RangedEnemyCallbacks
): void => {
  const angle = angleBetween(enemy.position, player.position);
  const projectileSpeed = config.projectileSpeed || 300;
  const projectileColor = config.projectileColor || '#ef4444';

  switch (enemy.enemyType) {
    case 'sniper': {
      // 스나이퍼: 단발 고데미지 정확 사격
      callbacks.spawnEnemyProjectile(
        enemy.position,
        { x: Math.cos(angle) * projectileSpeed, y: Math.sin(angle) * projectileSpeed },
        projectileColor,
        enemy.damage,
        6
      );
      soundManager.playSFX('shoot');
      break;
    }

    case 'caster': {
      // 캐스터: 3발 확산 사격
      const spreadAngle = Math.PI / 12; // 15도
      for (let i = -1; i <= 1; i++) {
        const a = angle + i * spreadAngle;
        callbacks.spawnEnemyProjectile(
          enemy.position,
          { x: Math.cos(a) * projectileSpeed, y: Math.sin(a) * projectileSpeed },
          projectileColor,
          enemy.damage * 0.6,
          5
        );
      }
      callbacks.spawnParticles(enemy.position, 5, projectileColor, 'ring');
      soundManager.playSFX('shoot');
      break;
    }

    case 'artillery': {
      // 포병: 느리지만 큰 폭발 투사체
      const splashRadius = config.splashRadius || 60;
      callbacks.spawnEnemyProjectile(
        enemy.position,
        { x: Math.cos(angle) * projectileSpeed, y: Math.sin(angle) * projectileSpeed },
        '#f97316',
        enemy.damage,
        12  // 큰 투사체
      );
      callbacks.spawnParticles(enemy.position, 3, '#f97316', 'smoke');
      soundManager.playSFX('explosion');
      break;
    }

    // v5.10: 스테이지별 특화 원거리 적들
    case 'phish_hook': {
      // 피싱 훅: 빠른 훅 발사
      callbacks.spawnEnemyProjectile(
        enemy.position,
        { x: Math.cos(angle) * projectileSpeed * 1.2, y: Math.sin(angle) * projectileSpeed * 1.2 },
        '#3b82f6',
        enemy.damage,
        5
      );
      soundManager.playSFX('shoot');
      break;
    }

    case 'qc_scanner': {
      // QC 스캐너: 레이저 스캔
      callbacks.spawnEnemyProjectile(
        enemy.position,
        { x: Math.cos(angle) * projectileSpeed, y: Math.sin(angle) * projectileSpeed },
        '#ef4444',
        enemy.damage,
        4
      );
      callbacks.spawnParticles(enemy.position, 2, '#ef4444', 'line');
      soundManager.playSFX('shoot');
      break;
    }

    case 'core_drone': {
      // 코어 드론: 연속 발사 (2발)
      for (let i = 0; i < 2; i++) {
        const offsetAngle = angle + (i - 0.5) * 0.15;
        callbacks.spawnEnemyProjectile(
          enemy.position,
          { x: Math.cos(offsetAngle) * projectileSpeed, y: Math.sin(offsetAngle) * projectileSpeed },
          '#3b82f6',
          enemy.damage * 0.7,
          5
        );
      }
      soundManager.playSFX('shoot');
      break;
    }

    case 'hacked_turret': {
      // 해킹된 터렛: 고정 위치에서 강력한 사격
      callbacks.spawnEnemyProjectile(
        enemy.position,
        { x: Math.cos(angle) * projectileSpeed * 0.8, y: Math.sin(angle) * projectileSpeed * 0.8 },
        '#6b7280',
        enemy.damage,
        8
      );
      callbacks.spawnParticles(enemy.position, 3, '#6b7280', 'smoke');
      soundManager.playSFX('shoot');
      break;
    }

    case 'traitor_drone': {
      // 배신자 드론: 빠른 이동 + 빠른 발사
      callbacks.spawnEnemyProjectile(
        enemy.position,
        { x: Math.cos(angle) * projectileSpeed * 1.3, y: Math.sin(angle) * projectileSpeed * 1.3 },
        '#3b82f6',
        enemy.damage,
        4
      );
      soundManager.playSFX('shoot');
      break;
    }

    default: {
      // 기타 원거리 적: 기본 발사 패턴
      callbacks.spawnEnemyProjectile(
        enemy.position,
        { x: Math.cos(angle) * projectileSpeed, y: Math.sin(angle) * projectileSpeed },
        projectileColor,
        enemy.damage,
        6
      );
      soundManager.playSFX('shoot');
      break;
    }
  }
};

/**
 * 원거리 적 스폰 시 초기화
 */
export const initializeRangedEnemy = (
  enemy: Enemy
): void => {
  if (!isRangedEnemy(enemy.enemyType)) return;

  const config = getEnemyConfig(enemy.enemyType);
  if (!config) return;

  enemy.attackType = 'ranged';
  enemy.attackRange = config.attackRange || 250;
  enemy.attackCooldown = config.attackCooldown || 2.0;
  enemy.projectileColor = config.projectileColor || '#ef4444';
  enemy.projectileSpeed = config.projectileSpeed || 300;
};

/**
 * 원거리 적 체크 (v5.10: config 기반 - isRangedEnemy 사용)
 */
export const isRangedEnemyType = (type: EnemyType): boolean => {
  return isRangedEnemy(type);
};
