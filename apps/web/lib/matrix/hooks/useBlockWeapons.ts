/**
 * useBlockWeapons.ts — 블록 좌표 무기 시스템 코어
 *
 * MC 블록 좌표(1 block = 1 Three.js unit) 네이티브로 동작하는
 * 무기 발사 + 투사체 업데이트 + 충돌 검사 시스템.
 *
 * 초기 6종 무기 패턴:
 *   whip   — 부채꼴 즉발 히트 (근접 휩쓸기)
 *   wand   — 가장 가까운 적 유도탄
 *   knife  — 플레이어 facing 직선 투척
 *   bow    — 가장 가까운 적 관통 화살
 *   garlic — 플레이어 중심 AOE 오라
 *   bible  — 플레이어 공전 궤도
 *
 * Phase 1에서는 하드코딩 초기 무기(knife 1개)로 테스트.
 * Phase 3에서 useSkillBuild/useCombo 연결.
 */

import { useRef, useCallback } from 'react';
import type {
  Player,
  Enemy,
  Projectile,
  DamageNumber,
  WeaponType,
  Vector2,
} from '../types';
import { getBlockWeaponStats, getDefaultBlockStats } from '../config/block-weapon-stats';

// ============================================
// 상수
// ============================================

/** 최대 투사체 수 (GC 방지) */
const MAX_PROJECTILES = 200;

/** 유도탄 호밍 강도 */
const HOMING_STRENGTH = 3;

/** bible 궤도 반경 (blocks) */
const BIBLE_ORBIT_RADIUS = 1.5;

/** bible 궤도 속도 (rad/s) */
const BIBLE_ORBIT_SPEED = 3;

/** whip 부채꼴 반각 (rad) — 60도 */
const WHIP_HALF_ANGLE = Math.PI / 3;

// ============================================
// 인터페이스
// ============================================

export interface UseBlockWeaponsProps {
  playerRef: React.MutableRefObject<Player>;
  enemiesRef: React.MutableRefObject<Enemy[]>;
  projectilesRef: React.MutableRefObject<Projectile[]>;
  damageNumbersRef: React.MutableRefObject<DamageNumber[]>;
  /** 히트 플래시 맵 (EnemyRenderer 연동) */
  hitFlashMapRef: React.MutableRefObject<Map<string, number>>;
  /** 공격 이벤트 배열 (SwingArc 연동) */
  attackEventsRef: React.MutableRefObject<Array<{
    position: Vector2;
    direction: Vector2;
    isCritical: boolean;
    timestamp: number;
  }>>;
}

export interface UseBlockWeaponsReturn {
  /** useFrame 내에서 매 프레임 호출 — 무기 발사 + 투사체 업데이트 + 충돌 */
  tick: (dt: number) => void;
  /** 무기별 쿨다운 타이머 (WeaponSlots3D 표시용) */
  cooldownsRef: React.MutableRefObject<Partial<Record<WeaponType, number>>>;
}

// ============================================
// ID 생성 카운터
// ============================================
let _projIdCounter = 0;
function nextProjId(): string {
  _projIdCounter++;
  return `bwp-${_projIdCounter}`;
}

// ============================================
// 유틸리티
// ============================================

/** 가장 가까운 적 찾기 */
function findClosestEnemy(
  pos: Vector2,
  enemies: Enemy[],
  maxRange = Infinity
): Enemy | null {
  let closest: Enemy | null = null;
  let closestDistSq = maxRange * maxRange;
  for (const enemy of enemies) {
    if (enemy.health <= 0) continue;
    const dx = enemy.position.x - pos.x;
    const dy = enemy.position.y - pos.y;
    const distSq = dx * dx + dy * dy;
    if (distSq < closestDistSq) {
      closestDistSq = distSq;
      closest = enemy;
    }
  }
  return closest;
}

/** 투사체 수 제한 (가장 오래된 것 제거) */
function enforceProjectileLimit(projectiles: Projectile[]): void {
  if (projectiles.length > MAX_PROJECTILES) {
    // 수명이 가장 짧은(오래된) 투사체 우선 제거
    projectiles.sort((a, b) => a.life - b.life);
    projectiles.length = MAX_PROJECTILES;
  }
}

// ============================================
// Hook
// ============================================

export function useBlockWeapons({
  playerRef,
  enemiesRef,
  projectilesRef,
  damageNumbersRef,
  hitFlashMapRef,
  attackEventsRef,
}: UseBlockWeaponsProps): UseBlockWeaponsReturn {
  /** 무기별 쿨다운 타이머 */
  const cooldownsRef = useRef<Partial<Record<WeaponType, number>>>({});

  /** bible 궤도 활성 여부 (재생성 방지) */
  const bibleActiveRef = useRef(false);
  const bibleTimerRef = useRef(0);

  const tick = useCallback((dt: number) => {
    if (dt <= 0) return;

    const player = playerRef.current;
    const enemies = enemiesRef.current;
    const projectiles = projectilesRef.current;

    // 플레이어 사망 시 무기 발사 중단 (투사체 업데이트는 계속)
    const playerAlive = player.health > 0;

    // ============================================
    // 1. 무기 쿨다운 감소 + 발사
    // ============================================
    if (playerAlive) {
      const weapons = player.weapons;
      for (const weaponType of Object.keys(weapons) as WeaponType[]) {
        const weaponInstance = weapons[weaponType];
        if (!weaponInstance) continue;

        // 쿨다운 감소
        const currentCd = cooldownsRef.current[weaponType] ?? 0;
        const newCd = currentCd - dt;
        cooldownsRef.current[weaponType] = newCd;

        // 쿨다운 도달 → 발사
        if (newCd <= 0) {
          const stats = getBlockWeaponStats(weaponType, weaponInstance.level)
            ?? getDefaultBlockStats();

          cooldownsRef.current[weaponType] = stats.cooldown;

          // 무기별 발사 패턴
          fireWeapon(
            weaponType,
            stats,
            player,
            enemies,
            projectiles,
            attackEventsRef.current
          );
        }
      }
    }

    // ============================================
    // 2. 투사체 업데이트 + 충돌 검사
    // ============================================
    updateProjectiles(
      dt,
      player,
      enemies,
      projectiles,
      damageNumbersRef.current,
      hitFlashMapRef.current
    );

    // ============================================
    // 3. 투사체 수 제한
    // ============================================
    enforceProjectileLimit(projectiles);

  }, [playerRef, enemiesRef, projectilesRef, damageNumbersRef, hitFlashMapRef, attackEventsRef]);

  return { tick, cooldownsRef };
}

// ============================================
// 무기 발사 패턴
// ============================================

function fireWeapon(
  weaponType: WeaponType,
  stats: import('../types').WeaponStats,
  player: Player,
  enemies: Enemy[],
  projectiles: Projectile[],
  attackEvents: Array<{ position: Vector2; direction: Vector2; isCritical: boolean; timestamp: number }>
): void {
  const px = player.position.x;
  const py = player.position.y;

  switch (weaponType) {
    case 'whip':
      fireWhip(stats, player, enemies, projectiles, attackEvents);
      break;
    case 'wand':
      fireWand(stats, player, enemies, projectiles);
      break;
    case 'knife':
      fireKnife(stats, player, projectiles);
      break;
    case 'bow':
      fireBow(stats, player, enemies, projectiles);
      break;
    case 'garlic':
      fireGarlic(stats, player, projectiles);
      break;
    case 'bible':
      fireBible(stats, player, projectiles);
      break;
    default:
      // 미구현 무기: 기본 직선 투사체로 폴백
      fireKnife(stats, player, projectiles);
      break;
  }
}

// --- whip: 부채꼴 즉발 히트 ---
function fireWhip(
  stats: import('../types').WeaponStats,
  player: Player,
  enemies: Enemy[],
  projectiles: Projectile[],
  attackEvents: Array<{ position: Vector2; direction: Vector2; isCritical: boolean; timestamp: number }>
): void {
  const px = player.position.x;
  const py = player.position.y;
  // facing 방향 (최근 이동 방향)
  const facingAngle = Math.atan2(
    player.velocity.y || 0.001,
    player.velocity.x || 0.001
  );
  const range = stats.area; // area = 부채꼴 반경 (blocks)

  // 부채꼴 내 모든 적에게 즉발 데미지
  for (const enemy of enemies) {
    if (enemy.health <= 0) continue;
    const dx = enemy.position.x - px;
    const dy = enemy.position.y - py;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > range) continue;

    // 각도 검사 (부채꼴 ± WHIP_HALF_ANGLE)
    const angleToEnemy = Math.atan2(dy, dx);
    let angleDiff = angleToEnemy - facingAngle;
    // 정규화 (-PI ~ PI)
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    if (Math.abs(angleDiff) > WHIP_HALF_ANGLE) continue;

    // 데미지 적용
    const isCrit = Math.random() < (player.criticalChance ?? 0.05);
    const dmg = Math.round(stats.damage * (isCrit ? (player.criticalMultiplier ?? 2.0) : 1.0));
    enemy.health -= dmg;

    // 넉백
    if (dist > 0.1) {
      enemy.position.x += (dx / dist) * stats.knockback;
      enemy.position.y += (dy / dist) * stats.knockback;
    }
  }

  // SwingArc 이벤트
  attackEvents.push({
    position: { x: px, y: py },
    direction: { x: Math.cos(facingAngle), y: Math.sin(facingAngle) },
    isCritical: false,
    timestamp: Date.now(),
  });
}

// --- wand: 유도탄 ---
function fireWand(
  stats: import('../types').WeaponStats,
  player: Player,
  enemies: Enemy[],
  projectiles: Projectile[]
): void {
  const target = findClosestEnemy(player.position, enemies);
  if (!target) return;

  const dx = target.position.x - player.position.x;
  const dy = target.position.y - player.position.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const speed = stats.speed || 9;

  for (let i = 0; i < stats.amount; i++) {
    // 약간의 spread
    const spreadAngle = (i - (stats.amount - 1) / 2) * 0.15;
    const baseAngle = Math.atan2(dy, dx) + spreadAngle;

    projectiles.push({
      id: nextProjId(),
      type: 'wand',
      position: { x: player.position.x, y: player.position.y },
      velocity: {
        x: Math.cos(baseAngle) * speed,
        y: Math.sin(baseAngle) * speed,
      },
      radius: stats.area,
      color: '#3B82F6',
      life: stats.duration,
      startLife: stats.duration,
      damage: stats.damage,
      pierce: stats.pierce,
      knockback: stats.knockback,
      angle: baseAngle,
      homingStrength: HOMING_STRENGTH,
      targetId: target.id,
      hitEnemies: new Set<string>(),
    });
  }
}

// --- knife: 직선 투척 ---
function fireKnife(
  stats: import('../types').WeaponStats,
  player: Player,
  projectiles: Projectile[]
): void {
  // facing 방향
  const vx = player.velocity.x;
  const vy = player.velocity.y;
  const facingAngle = (Math.abs(vx) > 0.01 || Math.abs(vy) > 0.01)
    ? Math.atan2(vy, vx)
    : player.angle || 0;

  const speed = stats.speed || 10;

  for (let i = 0; i < stats.amount; i++) {
    // 부채꼴 spread (amount > 1 시)
    const spreadAngle = stats.amount > 1
      ? (i - (stats.amount - 1) / 2) * 0.2
      : 0;
    const angle = facingAngle + spreadAngle;

    projectiles.push({
      id: nextProjId(),
      type: 'knife',
      position: { x: player.position.x, y: player.position.y },
      velocity: {
        x: Math.cos(angle) * speed,
        y: Math.sin(angle) * speed,
      },
      radius: stats.area,
      color: '#60A5FA',
      life: stats.duration,
      startLife: stats.duration,
      damage: stats.damage,
      pierce: stats.pierce,
      knockback: stats.knockback,
      angle,
      rotationSpeed: 12,
      currentRotation: 0,
      hitEnemies: new Set<string>(),
    });
  }
}

// --- bow: 관통 화살 ---
function fireBow(
  stats: import('../types').WeaponStats,
  player: Player,
  enemies: Enemy[],
  projectiles: Projectile[]
): void {
  const target = findClosestEnemy(player.position, enemies);
  let angle: number;
  if (target) {
    const dx = target.position.x - player.position.x;
    const dy = target.position.y - player.position.y;
    angle = Math.atan2(dy, dx);
  } else {
    // 타겟 없으면 facing 방향
    const vx = player.velocity.x;
    const vy = player.velocity.y;
    angle = (Math.abs(vx) > 0.01 || Math.abs(vy) > 0.01)
      ? Math.atan2(vy, vx)
      : player.angle || 0;
  }

  const speed = stats.speed || 12;

  for (let i = 0; i < stats.amount; i++) {
    const spreadAngle = stats.amount > 1
      ? (i - (stats.amount - 1) / 2) * 0.1
      : 0;
    const fireAngle = angle + spreadAngle;

    projectiles.push({
      id: nextProjId(),
      type: 'bow',
      position: { x: player.position.x, y: player.position.y },
      velocity: {
        x: Math.cos(fireAngle) * speed,
        y: Math.sin(fireAngle) * speed,
      },
      radius: stats.area,
      color: '#22D3EE',
      life: stats.duration,
      startLife: stats.duration,
      damage: stats.damage,
      pierce: stats.pierce,
      knockback: stats.knockback,
      angle: fireAngle,
      hitEnemies: new Set<string>(),
    });
  }
}

// --- garlic: 플레이어 중심 AOE ---
function fireGarlic(
  stats: import('../types').WeaponStats,
  player: Player,
  projectiles: Projectile[]
): void {
  // garlic은 플레이어 위치에 고정된 AOE 투사체 1개 생성
  projectiles.push({
    id: nextProjId(),
    type: 'garlic',
    position: { x: player.position.x, y: player.position.y },
    velocity: { x: 0, y: 0 },
    radius: stats.area,
    color: '#22C55E',
    life: stats.duration,
    startLife: stats.duration,
    damage: stats.damage,
    pierce: 999,
    knockback: stats.knockback,
    hitEnemies: new Set<string>(),
  });
}

// --- bible: 공전 궤도 ---
function fireBible(
  stats: import('../types').WeaponStats,
  player: Player,
  projectiles: Projectile[]
): void {
  // amount개의 궤도 투사체 생성 (균등 배치)
  for (let i = 0; i < stats.amount; i++) {
    const startAngle = (Math.PI * 2 * i) / stats.amount;
    projectiles.push({
      id: nextProjId(),
      type: 'bible',
      position: {
        x: player.position.x + Math.cos(startAngle) * BIBLE_ORBIT_RADIUS,
        y: player.position.y + Math.sin(startAngle) * BIBLE_ORBIT_RADIUS,
      },
      velocity: { x: 0, y: 0 },
      radius: stats.area,
      color: '#4ADE80',
      life: stats.duration,
      startLife: stats.duration,
      damage: stats.damage,
      pierce: 999,
      knockback: stats.knockback,
      orbitAngle: startAngle,
      hitEnemies: new Set<string>(),
    });
  }
}

// ============================================
// 투사체 업데이트 + 충돌
// ============================================

function updateProjectiles(
  dt: number,
  player: Player,
  enemies: Enemy[],
  projectiles: Projectile[],
  damageNumbers: DamageNumber[],
  hitFlashMap: Map<string, number>
): void {
  let writeIdx = 0;

  for (let i = 0; i < projectiles.length; i++) {
    const proj = projectiles[i];

    // NaN 방어
    if (isNaN(proj.position.x) || isNaN(proj.position.y)) continue;

    // 수명 감소
    proj.life -= dt;
    if (proj.life <= 0 || proj.pierce <= 0) continue;

    // 타입별 업데이트
    switch (proj.type) {
      case 'wand':
        updateWandProjectile(proj, enemies, dt);
        break;
      case 'bible':
        updateBibleProjectile(proj, player, dt);
        break;
      case 'garlic':
        // garlic: 플레이어 위치 추적
        proj.position.x = player.position.x;
        proj.position.y = player.position.y;
        break;
      case 'knife':
        // 회전 업데이트
        if (proj.rotationSpeed && proj.currentRotation !== undefined) {
          proj.currentRotation += proj.rotationSpeed * dt;
        }
        // 직선 이동 (fall through)
        proj.position.x += proj.velocity.x * dt;
        proj.position.y += proj.velocity.y * dt;
        break;
      default:
        // 직선 이동 (bow 등)
        proj.position.x += proj.velocity.x * dt;
        proj.position.y += proj.velocity.y * dt;
        break;
    }

    // 충돌 검사 (O(n*m) 브루트포스 — Phase 1)
    for (const enemy of enemies) {
      if (enemy.health <= 0) continue;

      // hitEnemies 세트 확인 (중복 히트 방지)
      if (proj.hitEnemies && proj.hitEnemies.has(enemy.id)) continue;

      const dx = proj.position.x - enemy.position.x;
      const dy = proj.position.y - enemy.position.y;
      const distSq = dx * dx + dy * dy;
      const hitRadiusSq = (proj.radius + (enemy.radius || 1)) ** 2;

      if (distSq < hitRadiusSq) {
        // 히트 등록
        if (proj.hitEnemies) {
          proj.hitEnemies.add(enemy.id);
        }

        // 데미지 계산
        const isCrit = Math.random() < (player.criticalChance ?? 0.05);
        const dmg = Math.round(
          proj.damage * (isCrit ? (player.criticalMultiplier ?? 2.0) : 1.0)
        );

        // 데미지 적용
        enemy.health -= dmg;

        // 넉백 (투사체 → 적 방향)
        if (proj.knockback > 0) {
          const dist = Math.sqrt(distSq) || 1;
          // 적에서 투사체 반대 방향 = 적이 투사체 진행 방향으로 밀림
          const kbX = -dx / dist;
          const kbY = -dy / dist;
          enemy.position.x += kbX * proj.knockback * 0.3;
          enemy.position.y += kbY * proj.knockback * 0.3;
        }

        // 히트 플래시
        hitFlashMap.set(enemy.id, 0.12);

        // 데미지 넘버
        damageNumbers.push({
          id: `bwd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          position: { x: enemy.position.x, y: enemy.position.y },
          value: dmg,
          color: isCrit ? '#ffdd00' : '#ffffff',
          life: 1.0,
          maxLife: 1.0,
          isCritical: isCrit,
          velocity: { x: (Math.random() - 0.5) * 2, y: -3 },
        });

        // pierce 감소
        proj.pierce--;
        if (proj.pierce <= 0) break;
      }
    }

    // 생존한 투사체만 유지
    if (proj.life > 0 && proj.pierce > 0) {
      projectiles[writeIdx] = proj;
      writeIdx++;
    }
  }

  // in-place 축소
  projectiles.length = writeIdx;
}

// --- wand 유도 업데이트 ---
function updateWandProjectile(proj: Projectile, enemies: Enemy[], dt: number): void {
  // 유도 타겟 찾기
  let target: Enemy | null = null;
  if (proj.targetId) {
    target = enemies.find(e => e.id === proj.targetId && e.health > 0) ?? null;
  }
  if (!target) {
    target = findClosestEnemy(proj.position, enemies, 20);
    if (target) proj.targetId = target.id;
  }

  if (target) {
    const dx = target.position.x - proj.position.x;
    const dy = target.position.y - proj.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const currentSpeed = proj.baseSpeed ?? (Math.sqrt(proj.velocity.x ** 2 + proj.velocity.y ** 2) || 9);
    const desiredVx = (dx / dist) * currentSpeed;
    const desiredVy = (dy / dist) * currentSpeed;

    const homingStr = (proj.homingStrength ?? HOMING_STRENGTH) * dt;
    proj.velocity.x += (desiredVx - proj.velocity.x) * homingStr;
    proj.velocity.y += (desiredVy - proj.velocity.y) * homingStr;
  }

  proj.position.x += proj.velocity.x * dt;
  proj.position.y += proj.velocity.y * dt;
}

// --- bible 궤도 업데이트 ---
function updateBibleProjectile(proj: Projectile, player: Player, dt: number): void {
  if (proj.orbitAngle === undefined) proj.orbitAngle = 0;
  proj.orbitAngle += BIBLE_ORBIT_SPEED * dt;

  proj.position.x = player.position.x + Math.cos(proj.orbitAngle) * BIBLE_ORBIT_RADIUS;
  proj.position.y = player.position.y + Math.sin(proj.orbitAngle) * BIBLE_ORBIT_RADIUS;
}
