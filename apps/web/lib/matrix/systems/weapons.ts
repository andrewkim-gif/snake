/**
 * weapons.ts - 무기 시스템
 * 각 무기 타입별 발사 로직
 */

import React from 'react';
import { Player, Enemy, Projectile, Vector2, WeaponType, WeaponStats, LightningBolt, Blast } from '../types';
import { WEAPON_DATA } from '../constants';
import { angleBetween, randomRange } from '../utils/math';
import { soundManager } from '../utils/audio';
import { generateLightningPoints, getEnemiesOnScreen, getNearestEnemy } from './game-context';
import { GRAVITY_Z } from '../isometric';

/**
 * 스킬 발사 오프셋 (캐릭터 손 위치 보정) - 비활성화
 * 오프셋이 조준 정확도에 영향을 줄 수 있어 0으로 설정
 */
const SKILL_FIRE_OFFSET = { x: 0, y: 0 };

/**
 * 플레이어 위치에 발사 오프셋 적용
 */
const getFirePosition = (player: Player): Vector2 => ({
  x: player.position.x + SKILL_FIRE_OFFSET.x,
  y: player.position.y + SKILL_FIRE_OFFSET.y,
});

/**
 * 무기 발사에 필요한 컨텍스트
 */
export interface WeaponFireContext {
  player: Player;
  projectiles: Projectile[];
  lightningBolts: LightningBolt[];
  blasts: Blast[];
  enemies: Enemy[];
  lastFacing: Vector2;
  lastAttackTime: React.MutableRefObject<number>;
  canvasWidth: number;
  canvasHeight: number;
  damageEnemy: (enemy: Enemy, damage: number, knockback: number, sourcePos: Vector2, weaponType: WeaponType | 'special', isUltimate: boolean) => void;
  // Arena PvP: 투사체 발사자 ID (agent_neo, agent_trinity 등, 플레이어는 'player' 또는 undefined)
  ownerId?: string;
}

/**
 * 무기 발사 결과
 */
export interface WeaponFireResult {
  projectiles: Projectile[];
  lightningBolts: LightningBolt[];
  blasts: Blast[];
}

/**
 * 무기 발사 사운드 재생
 */
const playWeaponSound = (type: WeaponType): void => {
  switch (type) {
    case 'whip':
    case 'punch':
      soundManager.playSFX('slash');
      break;
    case 'wand':
    case 'knife':
    case 'bow':
    case 'axe':
    case 'ping':
    case 'shard':
    case 'fork':
      soundManager.playSFX('shoot');
      break;
    case 'beam':
    case 'laser':
    case 'bridge':
      soundManager.playSFX('laser');
      break;
  }
};

/**
 * 야구배트 스윙 - 캐릭터 중심 회전 공격
 */
export const fireWhip = (
  ctx: WeaponFireContext,
  stats: WeaponStats,
  damage: number,
  color: string,
  isUltimate: boolean
): Projectile[] => {
  const { player, lastFacing } = ctx;
  const projectiles: Projectile[] = [];
  const facingAngle = Math.atan2(lastFacing.y, lastFacing.x);

  // 야구배트: 캐릭터 중심에서 스윙! (position = 캐릭터 위치)
  // 스윙 범위와 충돌 판정은 렌더링 시 계산
  projectiles.push({
    id: Math.random().toString(),
    type: 'whip',
    position: { x: player.position.x, y: player.position.y }, // 캐릭터 중심!
    velocity: { x: 0, y: 0 },
    radius: stats.area * (isUltimate ? 1.6 : 1.1), // 스윙 범위
    color,
    life: stats.duration,
    damage,
    pierce: stats.pierce,
    knockback: stats.knockback * 1.5, // 타격감 강화
    angle: facingAngle,
    isEvolved: stats.isEvolved,
    isUltimate,
    startLife: stats.duration,
  });

  if (stats.isEvolved) {
    // 진화: 반대방향 추가 스윙
    const backAngle = facingAngle + Math.PI;
    projectiles.push({
      id: Math.random().toString(),
      type: 'whip',
      position: { x: player.position.x, y: player.position.y },
      velocity: { x: 0, y: 0 },
      radius: stats.area * (isUltimate ? 1.6 : 1.1),
      color,
      life: stats.duration * 0.85, // 살짝 딜레이
      damage,
      pierce: stats.pierce,
      knockback: stats.knockback * 1.5,
      angle: backAngle,
      isEvolved: true,
      isUltimate,
      startLife: stats.duration * 0.85,
    });
  }

  return projectiles;
};

/**
 * 완드 발사 - 즉시 모든 투사체 생성
 */
export const fireWand = (
  ctx: WeaponFireContext,
  stats: WeaponStats,
  damage: number,
  color: string,
  isUltimate: boolean
): Projectile[] => {
  const { player, enemies, lastFacing } = ctx;
  const projectiles: Projectile[] = [];
  const shots = isUltimate ? 5 : stats.isEvolved ? 2 : 1;

  for (let i = 0; i < shots; i++) {
    const target = getNearestEnemy(player.position, enemies);

    // 적이 있으면 적 방향, 없으면 lastFacing 방향, 얼티밋이면 랜덤
    let angle: number;
    if (target) {
      angle = angleBetween(player.position, target.position);
    } else if (isUltimate) {
      angle = Math.random() * Math.PI * 2;
    } else {
      // 적이 없으면 lastFacing 방향으로 발사
      angle = Math.atan2(lastFacing.y, lastFacing.x);
    }

    // 여러 발 쏠 때: 첫 발은 정조준, 나머지만 스프레드
    // i=0: 정조준, i=1: +0.15, i=2: -0.15, i=3: +0.30 ...
    let spreadAngle = angle;
    if (shots > 1 && i > 0) {
      const spreadDir = i % 2 === 1 ? 1 : -1; // 홀수: 오른쪽, 짝수: 왼쪽
      const spreadMag = Math.ceil(i / 2) * 0.15; // 1,2 → 0.15, 3,4 → 0.30
      spreadAngle = angle + spreadDir * spreadMag;
    }

    // 분필 체이닝: 기본 2번, 진화 3번, 궁극 4번 바운스
    const maxBounce = isUltimate ? 4 : stats.isEvolved ? 3 : 2;

    projectiles.push({
      id: Math.random().toString(),
      type: 'wand',
      position: getFirePosition(player),
      velocity: { x: Math.cos(spreadAngle) * stats.speed, y: Math.sin(spreadAngle) * stats.speed },
      radius: stats.area,
      color,
      life: stats.duration,
      damage,
      pierce: maxBounce, // pierce를 바운스 횟수로 활용
      knockback: stats.knockback,
      angle: spreadAngle,
      isEvolved: stats.isEvolved,
      isUltimate,
      bounceCount: 0, // 현재 바운스 횟수 (0에서 시작)
    });
  }

  return projectiles;
};

/**
 * 나이프 발사 - 폭발 코인!
 * 히트 시 폭발하여 주변 적에게 스플래시 데미지
 * 가장 가까운 적 방향으로 발사 (적이 없으면 lastFacing 방향)
 */
export const fireKnife = (
  ctx: WeaponFireContext,
  stats: WeaponStats,
  damage: number,
  color: string,
  isUltimate: boolean
): Projectile[] => {
  const { player, lastFacing, enemies } = ctx;
  const projectiles: Projectile[] = [];

  // 폭발 데미지/반경 계산 (초반 약함 → 레벨업 시 강해짐)
  // Lv1: 2, Lv5: 4, Lv10: 7, Lv20: 15
  const explosionDamage = Math.floor(2 * (1 + (stats.level - 1) * 0.25)); // 2 → 레벨당 25% 증가
  const explosionRadius = 30 + stats.level * 4; // 30 → 레벨당 +4

  if (isUltimate) {
    const spiralCount = 16;
    for (let i = 0; i < spiralCount; i++) {
      const angle = ((Math.PI * 2) / spiralCount) * i + Date.now() / 500;
      // 랜덤 회전: 방향 * (15~25 rad/s)
      const rotSpeed = (Math.random() > 0.5 ? 1 : -1) * (15 + Math.random() * 10);
      projectiles.push({
        id: Math.random().toString(),
        type: 'knife',
        position: getFirePosition(player),
        velocity: { x: Math.cos(angle) * stats.speed, y: Math.sin(angle) * stats.speed },
        radius: stats.area,
        color,
        life: stats.duration,
        damage,
        pierce: 1, // 폭발형이라 1회 히트
        knockback: stats.knockback,
        angle,
        isEvolved: true,
        isUltimate: true,
        explosionDamage: explosionDamage * 2, // 얼티밋은 폭발 2배
        explosionRadius: explosionRadius * 1.5,
        rotationSpeed: rotSpeed,
        currentRotation: Math.random() * Math.PI * 2,
      });
    }
  } else {
    // 가장 가까운 적 찾기 (범위 내)
    const nearestEnemy = getNearestEnemy(player.position, enemies, 500);

    // 적이 있으면 적 방향으로, 없으면 lastFacing 방향으로
    let baseAngle: number;
    if (nearestEnemy) {
      const dx = nearestEnemy.position.x - player.position.x;
      const dy = nearestEnemy.position.y - player.position.y;
      baseAngle = Math.atan2(dy, dx);
    } else {
      baseAngle = Math.atan2(lastFacing.y, lastFacing.x);
    }

    for (let i = 0; i < stats.amount; i++) {
      // 첫 발은 정조준, 나머지만 스프레드
      let finalAngle = baseAngle;
      if (stats.amount > 1 && i > 0) {
        const spreadDir = i % 2 === 1 ? 1 : -1;
        const spreadMag = Math.ceil(i / 2) * 0.15;
        finalAngle = baseAngle + spreadDir * spreadMag;
      }
      // 랜덤 회전: 방향 * (15~25 rad/s)
      const rotSpeed = (Math.random() > 0.5 ? 1 : -1) * (15 + Math.random() * 10);
      projectiles.push({
        id: Math.random().toString(),
        type: 'knife',
        position: getFirePosition(player),
        velocity: { x: Math.cos(finalAngle) * stats.speed, y: Math.sin(finalAngle) * stats.speed },
        radius: stats.area,
        color,
        life: stats.duration,
        damage,
        pierce: 1, // 폭발형이라 1회 히트
        knockback: stats.knockback,
        angle: finalAngle,
        isEvolved: stats.isEvolved,
        isUltimate,
        explosionDamage,
        explosionRadius,
        rotationSpeed: rotSpeed,
        currentRotation: Math.random() * Math.PI * 2,
      });
    }
  }

  return projectiles;
};

/**
 * 도끼 발사
 */
export const fireAxe = (
  ctx: WeaponFireContext,
  stats: WeaponStats,
  damage: number,
  color: string,
  isUltimate: boolean
): Projectile[] => {
  const { player } = ctx;
  const projectiles: Projectile[] = [];
  const count = isUltimate ? stats.amount + 4 : stats.amount;

  for (let i = 0; i < count; i++) {
    // v7.8.6: 360도 랜덤 방향으로 던지기
    const throwAngle = Math.random() * Math.PI * 2;
    // 소화기 회전: 무거운 물체라서 느리게 (8~14 rad/s)
    const rotSpeed = (Math.random() > 0.5 ? 1 : -1) * (8 + Math.random() * 6);

    // 아이소메트릭 속도: X는 그대로, Y는 0.5배 압축
    const baseSpeed = stats.speed * 0.5;
    // v7.11: 마지막 바운스 후 폭발 데미지/반경
    // v7.44: 폭발 반경 2배 증가 (3 → 6)
    const explosionDamage = damage * (isUltimate ? 2.5 : 1.5); // 기본 데미지의 1.5~2.5배
    const explosionRadius = (stats.area * 6) * (isUltimate ? 1.5 : 1); // 투사체 반경의 6배 (2배 증가)

    projectiles.push({
      id: Math.random().toString(),
      type: 'axe',
      position: getFirePosition(player),
      velocity: {
        x: Math.cos(throwAngle) * baseSpeed,
        y: Math.sin(throwAngle) * baseSpeed,
      },
      radius: stats.area * (isUltimate ? 2.0 : 1),
      color,
      life: stats.duration,
      damage,
      pierce: stats.pierce,
      knockback: stats.knockback,
      angle: 0,
      // v6.0: Z축 물리로 포물선 + 바운스 구현
      z: 0, // 지면에서 시작
      velocityZ: 350, // 위로 던짐 (약간 낮게)
      gravityZ: GRAVITY_Z, // -1200 (낙하)
      zBounceCount: isUltimate ? 4 : 3, // 바운스 횟수
      zBounceDamping: 0.65, // 바운스 감쇠 (65% 속도 유지)
      isEvolved: stats.isEvolved,
      isUltimate,
      rotationSpeed: rotSpeed,
      currentRotation: Math.random() * Math.PI * 2,
      // v7.11: 마지막 바운스 후 폭발
      explosionDamage,
      explosionRadius,
    });
  }

  return projectiles;
};

/**
 * 바이블 오브 발사
 */
export const fireBible = (
  ctx: WeaponFireContext,
  stats: WeaponStats,
  damage: number,
  color: string,
  isUltimate: boolean
): Projectile[] => {
  const { player } = ctx;
  const projectiles: Projectile[] = [];

  const step = (Math.PI * 2) / stats.amount;
  for (let i = 0; i < stats.amount; i++) {
    projectiles.push({
      id: Math.random().toString(),
      type: 'bible',
      position: { ...player.position },
      velocity: { x: 0, y: 0 },
      radius: stats.area,
      color,
      life: stats.duration,
      damage,
      pierce: 999,
      knockback: stats.knockback,
      angle: 0,
      orbitAngle: i * step,
      startPos: { x: 120, y: 0 },
      isEvolved: stats.isEvolved,
      isUltimate,
    });
  }

  if (stats.isEvolved) {
    const innerAmount = Math.max(4, Math.floor(stats.amount / 2));
    const innerStep = (Math.PI * 2) / innerAmount;
    for (let i = 0; i < innerAmount; i++) {
      projectiles.push({
        id: Math.random().toString(),
        type: 'bible',
        position: { ...player.position },
        velocity: { x: 0, y: 0 },
        radius: stats.area,
        color: isUltimate ? '#facc15' : color,
        life: stats.duration,
        damage,
        pierce: 999,
        knockback: stats.knockback,
        angle: 0,
        orbitAngle: i * innerStep,
        startPos: { x: 180, y: 0 },
        isEvolved: true,
        isUltimate,
      });
    }
  }

  return projectiles;
};

/**
 * 마늘 오라 발사
 */
export const fireGarlic = (
  existingProjectiles: Projectile[],
  player: Player,
  stats: WeaponStats,
  damage: number,
  color: string,
  isUltimate: boolean
): Projectile | null => {
  const existing = existingProjectiles.find((proj) => proj.type === 'garlic');
  if (!existing) {
    return {
      id: 'garlic',
      type: 'garlic',
      position: { ...player.position },
      velocity: { x: 0, y: 0 },
      radius: stats.area,
      color,
      life: 999999,
      damage,
      pierce: 999,
      knockback: stats.knockback,
      angle: 0,
      isEvolved: stats.isEvolved,
      isUltimate,
    };
  } else {
    existing.damage = damage;
    existing.radius = stats.area;
    existing.isUltimate = isUltimate;
    existing.isEvolved = stats.isEvolved;
    return null;
  }
};

/**
 * 풀 발사
 */
export const firePool = (
  ctx: WeaponFireContext,
  stats: WeaponStats,
  damage: number,
  color: string,
  isUltimate: boolean
): Projectile[] => {
  const { player } = ctx;
  const projectiles: Projectile[] = [];
  const count = isUltimate ? stats.amount + 2 : stats.amount;

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = randomRange(50, isUltimate ? 300 : 200);
    const spawnPos = { x: player.position.x + Math.cos(angle) * dist, y: player.position.y + Math.sin(angle) * dist };
    projectiles.push({
      id: Math.random().toString(),
      type: 'pool',
      position: spawnPos,
      velocity: { x: 0, y: 0 },
      radius: stats.area * (isUltimate ? 1.5 : 1),
      color: isUltimate ? '#000' : color,
      life: stats.duration,
      damage,
      pierce: 999,
      knockback: 0,
      angle: 0,
      isEvolved: stats.isEvolved,
      isUltimate,
    });
  }

  return projectiles;
};

/**
 * 체인 라이트닝 발사 (김도연 타로 카드)
 * 첫 적을 맞추면 근처 다른 적에게 튕김
 * 레벨업하면 더 많이 튕김 (도파민 폭발!)
 */
export const fireLightning = (
  ctx: WeaponFireContext,
  stats: WeaponStats,
  damage: number,
  isUltimate: boolean
): LightningBolt[] => {
  const { player, enemies, canvasWidth, canvasHeight, damageEnemy } = ctx;
  const bolts: LightningBolt[] = [];

  const camX = canvasWidth / 2 - player.position.x;
  const camY = canvasHeight / 2 - player.position.y;
  const visibleEnemies = getEnemiesOnScreen(enemies, camX, camY, canvasWidth, canvasHeight);

  if (visibleEnemies.length === 0) return bolts;

  // 튕김 횟수: 기본 2회, 레벨당 +1 (최대 12회)
  // 레벨 1: 2회 튕김, 레벨 5: 6회 튕김, 레벨 10+: 12회 튕김
  const baseChainCount = Math.min(12, Math.max(2, stats.level + 1));
  const chainCount = isUltimate ? baseChainCount + 3 : baseChainCount;

  // 튕김 범위: 기본 250px, 레벨당 +15 (더 넓게!)
  const chainRange = 250 + stats.level * 15;

  // 데미지 감소율: 첫 적 100%, 이후 80%씩 감소 (최소 20%)
  const damageDecay = 0.8;
  const minDamageRatio = 0.2;

  // 순차적 체이닝 딜레이 (파파팍! 연출)
  const CHAIN_DELAY = 0.06;  // 각 체인 사이 60ms 딜레이

  // 첫 번째 타겟 선택 (가장 가까운 적)
  const nearestEnemy = getNearestEnemy(player.position, visibleEnemies);
  if (!nearestEnemy) return bolts;

  // 먼저 전체 체인 경로 계산 (데미지는 나중에 딜레이에 맞춰 적용)
  const chainTargets: { target: Enemy; pos: Vector2; damage: number; knockback: number }[] = [];
  const hitEnemies = new Set<Enemy>();
  let currentPos = { ...player.position };
  let currentTarget: Enemy | null = nearestEnemy;
  let currentDamage = damage;
  let chainIndex = 0;

  while (currentTarget && chainIndex < chainCount) {
    chainTargets.push({
      target: currentTarget,
      pos: { ...currentPos },
      damage: currentDamage,
      knockback: stats.knockback * (1 - chainIndex * 0.1)
    });
    hitEnemies.add(currentTarget);

    // 번개 볼트 생성 (딜레이 포함)
    const segments = generateLightningPoints(currentPos, currentTarget.position, 5 + Math.floor(chainIndex * 0.5));

    // 체인마다 색상 변화 (노란색 -> 보라색 그라데이션)
    const hue = isUltimate ? 0 : 45 - chainIndex * 4;  // 노랑 -> 주황 -> 빨강
    const saturation = 90 + chainIndex * 2;
    const lightness = 60 - chainIndex * 3;
    const chainColor = isUltimate
      ? `hsl(${280 + chainIndex * 5}, 80%, ${60 - chainIndex * 2}%)` // 보라 -> 분홍
      : `hsl(${hue}, ${saturation}%, ${lightness}%)`;

    bolts.push({
      id: Math.random().toString(),
      segments,
      color: chainColor,
      life: 0.15 + chainIndex * 0.02,  // 체인이 길어질수록 약간 더 오래 표시
      maxLife: 0.15 + chainIndex * 0.02,
      width: isUltimate ? 5 - chainIndex * 0.3 : 3 - chainIndex * 0.15,  // 점점 얇아짐
      delay: chainIndex * CHAIN_DELAY,  // 순차적 딜레이!
    });

    // 다음 타겟 찾기 (범위 내 가장 가까운, 아직 안 맞은 적)
    currentPos = { ...currentTarget.position };
    currentTarget = findNextChainTarget(currentPos, visibleEnemies, hitEnemies, chainRange);
    currentDamage = Math.max(damage * minDamageRatio, currentDamage * damageDecay);
    chainIndex++;
  }

  // 데미지도 순차적으로 적용 (첫 번째는 즉시, 나머지는 딜레이)
  chainTargets.forEach((chain, idx) => {
    if (idx === 0) {
      // 첫 번째 타겟은 즉시 데미지
      damageEnemy(chain.target, chain.damage, chain.knockback, chain.target.position, 'lightning', isUltimate);
    } else {
      // 나머지는 딜레이 후 데미지 (setTimeout 사용)
      setTimeout(() => {
        damageEnemy(chain.target, chain.damage, chain.knockback, chain.target.position, 'lightning', isUltimate);
      }, idx * CHAIN_DELAY * 1000);
    }
  });

  if (hitEnemies.size > 0) {
    soundManager.playSFX('explosion');
  }

  return bolts;
};

/**
 * 체인 라이트닝 다음 타겟 찾기
 */
const findNextChainTarget = (
  fromPos: Vector2,
  enemies: Enemy[],
  hitEnemies: Set<Enemy>,
  maxRange: number
): Enemy | null => {
  let nearest: Enemy | null = null;
  let nearestDist = maxRange;

  for (const enemy of enemies) {
    if (hitEnemies.has(enemy)) continue;
    if ((enemy.hp ?? enemy.health) <= 0) continue;

    const dx = enemy.position.x - fromPos.x;
    const dy = enemy.position.y - fromPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = enemy;
    }
  }

  return nearest;
};

/**
 * 레이저 포인터 - 선생님의 무기! 스캔하며 적을 태운다
 */
export const fireBeam = (
  ctx: WeaponFireContext,
  stats: WeaponStats,
  damage: number,
  color: string,
  isUltimate: boolean
): Projectile[] => {
  const { player, enemies, lastFacing } = ctx;
  const projectiles: Projectile[] = [];

  // 가장 가까운 적 방향 또는 facing 방향
  let targetAngle = Math.atan2(lastFacing.y, lastFacing.x);
  if (enemies.length > 0) {
    const nearestEnemy = enemies.reduce((nearest, e) => {
      const dist = Math.hypot(e.position.x - player.position.x, e.position.y - player.position.y);
      const nearestDist = Math.hypot(nearest.position.x - player.position.x, nearest.position.y - player.position.y);
      return dist < nearestDist ? e : nearest;
    });
    targetAngle = Math.atan2(
      nearestEnemy.position.y - player.position.y,
      nearestEnemy.position.x - player.position.x
    );
  }

  const beamCount = isUltimate ? stats.amount + 2 : stats.amount;
  const spreadAngle = isUltimate ? Math.PI * 0.4 : Math.PI * 0.25;

  for (let i = 0; i < beamCount; i++) {
    // 부채꼴로 퍼지는 빔
    const angleOffset = beamCount > 1
      ? (i / (beamCount - 1) - 0.5) * spreadAngle
      : 0;
    const beamAngle = targetAngle + angleOffset;

    projectiles.push({
      id: Math.random().toString(),
      type: 'beam',
      position: { x: player.position.x, y: player.position.y }, // 캐릭터 중심
      velocity: { x: 0, y: 0 },
      radius: stats.area * 0.5, // 빔 두께
      color,
      life: stats.duration,
      damage,
      pierce: 999,
      knockback: stats.knockback * 0.3, // 레이저는 넉백 약함
      angle: beamAngle, // 빔 방향
      isEvolved: stats.isEvolved,
      isUltimate,
      shape: 'rect',
      width: stats.area,
      height: 600, // 빔 길이
      startLife: stats.duration,
    });
  }

  return projectiles;
};

/**
 * 회전 레이저 - 플레이어 중심에서 회전하며 스윕
 * amount = 스윕 각도 (10도 단위, 18 = 180도, 36 = 360도)
 */
export const fireLaser = (
  ctx: WeaponFireContext,
  stats: WeaponStats,
  damage: number,
  color: string,
  isUltimate: boolean
): Projectile[] => {
  const { player, lastFacing } = ctx;
  const projectiles: Projectile[] = [];

  // 시작 각도: 플레이어가 바라보는 방향
  const facingAngle = Math.atan2(lastFacing.y, lastFacing.x);

  // 스윕 각도 계산 (amount = 10도 단위, 18 = 180도, 36 = 360도)
  const sweepDegrees = stats.amount * 10;
  const sweepRadians = (sweepDegrees * Math.PI) / 180;

  // 시작 각도 (스윕 범위의 절반만큼 뒤로)
  const startAngle = facingAngle - sweepRadians / 2;

  // 궁극: 이중 레이저 (반대 방향)
  const laserCount = isUltimate ? 2 : 1;

  for (let i = 0; i < laserCount; i++) {
    const angleOffset = i === 0 ? 0 : Math.PI; // 두 번째 레이저는 반대 방향

    const sweepStartAngle = startAngle + angleOffset; // 스윕 시작 각도 저장
    projectiles.push({
      id: Math.random().toString(),
      type: 'laser',
      position: { x: player.position.x, y: player.position.y },
      velocity: { x: 0, y: 0 },
      radius: stats.area, // 레이저 길이
      color,
      life: stats.duration,
      damage,
      pierce: 999,
      knockback: stats.knockback,
      angle: sweepStartAngle, // 현재 회전 각도 (스윕 시작점)
      sweepStartAngle, // 스윕 시작 각도 (고정, 기준점)
      isEvolved: stats.isEvolved,
      isUltimate,
      startLife: stats.duration,
      // 커스텀 속성들 (projectile에 확장)
      sweepAngle: sweepRadians, // 총 스윕 각도
      sweepDirection: i === 0 ? 1 : -1, // 회전 방향 (1: 시계방향, -1: 반시계방향)
    });
  }

  return projectiles;
};

/**
 * 피싱 공격 (화면 전체)
 */
export const firePhishing = (
  ctx: WeaponFireContext,
  _stats: WeaponStats,
  _damage: number
): Blast => {
  const { player, enemies, canvasWidth, canvasHeight, damageEnemy } = ctx;

  soundManager.playSFX('explosion');
  const camX = canvasWidth / 2 - player.position.x;
  const camY = canvasHeight / 2 - player.position.y;
  const visible = getEnemiesOnScreen(enemies, camX, camY, canvasWidth, canvasHeight);

  visible.forEach((e) => {
    if (!e.isBoss) damageEnemy(e, 99999, 0, player.position, 'special', false);
  });

  return {
    id: Math.random().toString(),
    position: { ...player.position },
    radius: 1000,
    life: 1.0,
    maxLife: 1.0,
    color: '#be123c',
    type: 'purge',
  };
};

/**
 * 펀치 발사
 */
export const firePunch = (
  ctx: WeaponFireContext,
  stats: WeaponStats,
  damage: number,
  color: string,
  isUltimate: boolean
): Projectile[] => {
  const { player, lastFacing } = ctx;
  const projectiles: Projectile[] = [];
  const facingAngle = Math.atan2(lastFacing.y, lastFacing.x);
  const count = isUltimate ? stats.amount + 4 : stats.amount;

  for (let i = 0; i < count; i++) {
    // 첫 발은 정면, 나머지만 스프레드
    let offsetAngle = facingAngle;
    if (count > 1 && i > 0) {
      const spreadDir = i % 2 === 1 ? 1 : -1;
      const spreadMag = Math.ceil(i / 2) * 0.3;
      offsetAngle = facingAngle + spreadDir * spreadMag;
    }
    const dist = 20;  // 50 -> 20으로 감소 (초근접 적 히트 가능)
    projectiles.push({
      id: Math.random().toString(),
      type: 'punch',
      position: { x: player.position.x + Math.cos(offsetAngle) * dist, y: player.position.y + Math.sin(offsetAngle) * dist },
      velocity: { x: Math.cos(offsetAngle) * 150, y: Math.sin(offsetAngle) * 150 },
      radius: stats.area * (isUltimate ? 1.5 : 1),
      color,
      life: stats.duration,
      damage,
      pierce: 999,
      knockback: stats.knockback,
      angle: offsetAngle,
      isEvolved: stats.isEvolved,
      isUltimate,
      startLife: stats.duration, // 히트 애니메이션용
    });
  }

  return projectiles;
};

/**
 * 활 발사
 */
export const fireBow = (
  ctx: WeaponFireContext,
  stats: WeaponStats,
  damage: number,
  color: string,
  isUltimate: boolean
): Projectile[] => {
  const { player, lastFacing, enemies } = ctx;
  const projectiles: Projectile[] = [];
  const target = getNearestEnemy(player.position, enemies);
  const baseAngle = target ? angleBetween(player.position, target.position) : Math.atan2(lastFacing.y, lastFacing.x);
  const count = isUltimate ? stats.amount + 6 : stats.amount;

  for (let i = 0; i < count; i++) {
    // 첫 발은 정조준, 나머지만 스프레드
    let finalAngle = baseAngle;
    if (count > 1 && i > 0) {
      const spreadDir = i % 2 === 1 ? 1 : -1;
      const spreadMag = Math.ceil(i / 2) * 0.15;
      finalAngle = baseAngle + spreadDir * spreadMag;
    }
    projectiles.push({
      id: Math.random().toString(),
      type: 'bow',
      position: getFirePosition(player),
      velocity: { x: Math.cos(finalAngle) * stats.speed, y: Math.sin(finalAngle) * stats.speed },
      radius: 4 * (isUltimate ? 2 : 1),
      color,
      life: stats.duration,
      damage,
      pierce: stats.pierce,
      knockback: stats.knockback,
      angle: finalAngle,
      isEvolved: stats.isEvolved,
      isUltimate,
    });
  }

  return projectiles;
};

/**
 * API 호출 스킬 - Request/Response 체인 시스템
 *
 * 메카닉:
 * 1. Request 발사 → 적에게 도달하면 "마킹" (pierce만큼 마킹 가능)
 * 2. 마킹된 적들 사이에 Response 체인(레이저) 연결
 * 3. Request가 끝나면 체인 폭발 → 연결된 적 수에 따라 데미지 증폭
 */
export const firePing = (
  ctx: WeaponFireContext,
  stats: WeaponStats,
  damage: number,
  color: string,
  isUltimate: boolean
): Projectile[] => {
  const { player, enemies, lastFacing } = ctx;
  const projectiles: Projectile[] = [];
  const count = isUltimate ? stats.amount + 2 : stats.amount;

  for (let i = 0; i < count; i++) {
    // 적이 있으면 적 방향, 없으면 lastFacing 방향
    const target = getNearestEnemy(player.position, enemies);
    let angle: number;
    if (target) {
      angle = angleBetween(player.position, target.position);
    } else {
      angle = Math.atan2(lastFacing.y, lastFacing.x);
    }

    // 첫 발은 정조준, 나머지만 부채꼴 스프레드
    let spreadAngle = angle;
    if (count > 1 && i > 0) {
      const spreadDir = i % 2 === 1 ? 1 : -1;
      const spreadMag = Math.ceil(i / 2) * 0.4;
      spreadAngle = angle + spreadDir * spreadMag;
    }
    const speed = stats.speed * (isUltimate ? 1.3 : 1);

    const firePos = getFirePosition(player);
    projectiles.push({
      id: Math.random().toString(),
      type: 'ping',
      position: { ...firePos },
      velocity: { x: Math.cos(spreadAngle) * speed, y: Math.sin(spreadAngle) * speed },
      radius: stats.area * (isUltimate ? 1.3 : 1),
      color,
      life: stats.duration,
      damage,
      pierce: stats.pierce, // 마킹 가능 횟수
      knockback: stats.knockback,
      angle: spreadAngle,
      isEvolved: stats.isEvolved,
      isUltimate,
      // API 호출 전용 필드
      hitCount: 0,           // 마킹된 적 수
      bounceCount: 0,        // 현재 마킹 카운터
      baseSpeed: speed,
      startPos: { ...firePos }, // 발사 위치 (체인 연결용)
    });
  }

  return projectiles;
};

// ===============================
// NEW DOPAMINE SKILLS (6개)
// ===============================

/**
 * 샤드 파편 발사 (분열 투사체)
 * 적 히트 시 3방향으로 분열, 분열 파편이 진짜 데미지!
 */
export const fireShard = (
  ctx: WeaponFireContext,
  stats: WeaponStats,
  damage: number,
  color: string,
  isUltimate: boolean
): Projectile[] => {
  const { player, enemies, lastFacing } = ctx;
  const projectiles: Projectile[] = [];
  const count = isUltimate ? stats.amount + 3 : stats.amount;

  // 분열 파편 데미지 (초반 약함 → 레벨업 시 강해짐)
  // Lv1: 1, Lv5: 2, Lv10: 4, Lv20: 10
  const splitDamage = Math.floor(1 * (1 + (stats.level - 1) * 0.3)); // 1 → 레벨당 30% 증가

  for (let i = 0; i < count; i++) {
    const target = getNearestEnemy(player.position, enemies);
    let angle: number;
    if (target) {
      angle = angleBetween(player.position, target.position);
    } else {
      angle = Math.atan2(lastFacing.y, lastFacing.x);
    }

    // 첫 발은 정조준, 나머지만 스프레드
    let spreadAngle = angle;
    if (count > 1 && i > 0) {
      const spreadDir = i % 2 === 1 ? 1 : -1;
      const spreadMag = Math.ceil(i / 2) * 0.25;
      spreadAngle = angle + spreadDir * spreadMag;
    }

    projectiles.push({
      id: Math.random().toString(),
      type: 'shard',
      position: getFirePosition(player),
      velocity: { x: Math.cos(spreadAngle) * stats.speed, y: Math.sin(spreadAngle) * stats.speed },
      radius: stats.area * (isUltimate ? 1.5 : 1),
      color,
      life: stats.duration,
      damage, // 원본 낮은 데미지 (2)
      pierce: 1, // 원본은 1회 히트 후 분열
      knockback: stats.knockback,
      angle: spreadAngle,
      isEvolved: stats.isEvolved,
      isUltimate,
      bounceCount: 0, // 0 = 원본 (분열 가능), 1 = 분열된 파편
      splitDamage: isUltimate ? splitDamage * 1.5 : splitDamage,
    });
  }

  return projectiles;
};


/**
 * 에어드롭 발사 (하늘에서 미사일 폭격) - 투사체 기반
 *
 * 낙하 미사일을 투사체로 생성 → 게임 루프에서 폭발 처리
 * v6.0: 아이소메트릭 대각선 낙하 - 왼쪽 위(하늘)에서 오른쪽 아래로
 */
export const fireAirdrop = (
  ctx: WeaponFireContext,
  stats: WeaponStats,
  damage: number,
  color: string,
  isUltimate: boolean
): Projectile[] => {
  const { player } = ctx;
  const projectiles: Projectile[] = [];
  const count = isUltimate ? stats.amount + 4 : stats.amount;
  const explosionRadius = stats.area * (isUltimate ? 1.5 : 1);

  for (let i = 0; i < count; i++) {
    // 플레이어 주변 랜덤 위치에 타겟 설정
    const offsetX = randomRange(-200, 200);
    const offsetY = randomRange(-200, 200);
    const targetX = player.position.x + offsetX;
    const targetY = player.position.y + offsetY;

    // v6.0: 하늘에서 수직 낙하 (착지 시에만 충돌)
    const startZ = 200; // 높이에서 시작 (더 빨리 착지)
    const fallDelay = i * 0.15; // 순차적 낙하 (0.15초 간격)

    projectiles.push({
      id: Math.random().toString(),
      type: 'airdrop',
      position: {
        x: targetX, // 타겟 위치에서 바로 낙하
        y: targetY,
      },
      velocity: {
        x: 0, // 수평 이동 없음
        y: 0,
      },
      radius: explosionRadius, // 착지 폭발 반경
      color,
      life: stats.duration + fallDelay, // 낙하 시간 + 지연
      damage,
      pierce: 999, // 폭발은 무제한 관통
      knockback: stats.knockback,
      angle: 0,
      isEvolved: stats.isEvolved,
      isUltimate,
      // v6.0: Z축 물리 (수직 낙하)
      z: startZ, // 높이에서 시작
      velocityZ: 0, // 초기 Z속도 없음
      gravityZ: GRAVITY_Z * 0.8, // -960 (약간 느린 낙하)
      onlyHitOnGround: true, // 착지 시에만 충돌!
      // 에어드롭 전용 필드
      startPos: { x: targetX, y: targetY }, // 착탄 목표 위치
      hitCount: 0, // 폭발 여부 (0: 낙하중, 1: 폭발)
      bounceCount: Math.floor(fallDelay * 60), // 지연 프레임
    });
  }

  return projectiles;
};

/**
 * Git Fork - 방사형 체인 라이트닝 (v7.42)
 * 디아블로 체인 라이트닝 컨셉: 사방으로 전기가 퍼져나감!
 *
 * 메커니즘:
 * 1. 플레이어 중심에서 8방향(진화: 12, 궁극: 16)으로 전기 발사
 * 2. 각 전기는 실제로 이동하면서 적 타격
 * 3. 높은 관통으로 경로상 모든 적 데미지
 *
 * 특징:
 * - knife처럼 날아가지만 8방향 동시 발사
 * - 전기 형태의 지글거리는 렌더링
 * - 연쇄 효과로 추가 데미지
 */
export const fireFork = (
  ctx: WeaponFireContext,
  stats: WeaponStats,
  damage: number,
  color: string,
  isUltimate: boolean
): Projectile[] => {
  const { player } = ctx;
  const projectiles: Projectile[] = [];

  // 방향 개수: 기본 8방향, 진화 12방향, 궁극 16방향
  const directionCount = isUltimate ? 16 : (stats.isEvolved ? 12 : 8);

  // 번개 속도 (knife보다 빠름)
  const lightningSpeed = stats.speed * 1.2;

  // 번개 크기 (충돌 범위)
  const lightningRadius = stats.area * (isUltimate ? 1.5 : 1);

  // 발사 세트 수 (amount)
  const waveCount = isUltimate ? stats.amount + 2 : stats.amount;

  // 각 웨이브 발사 (시간차 없이 동시 발사)
  for (let wave = 0; wave < waveCount; wave++) {
    // 웨이브마다 약간의 각도 오프셋 (겹침 방지)
    const waveOffset = (wave / waveCount) * (Math.PI / directionCount);

    // 8/12/16 방향으로 전기 발사
    for (let dir = 0; dir < directionCount; dir++) {
      const angle = (Math.PI * 2 / directionCount) * dir + waveOffset;

      projectiles.push({
        id: `fork_${Date.now()}_${wave}_${dir}_${Math.random()}`,
        type: 'fork',
        position: { ...player.position },
        velocity: {
          x: Math.cos(angle) * lightningSpeed,
          y: Math.sin(angle) * lightningSpeed
        },
        radius: lightningRadius,
        color,
        life: stats.duration,
        damage,
        pierce: stats.pierce + 2, // 높은 관통력
        knockback: stats.knockback * 0.5, // 약한 넉백 (연속 타격 위해)
        angle,
        isEvolved: stats.isEvolved,
        isUltimate,
        // 체인 라이트닝 속성
        isChainLightning: true,
        chainDamageMultiplier: 0.85, // 연쇄 타격 시 85% 데미지
        startLife: stats.duration,
        // 렌더링 힌트: 개별 번개줄기
        isSingleBolt: true,
      });
    }
  }

  return projectiles;
};

/**
 * 제네시스 블록 발사 (플레이어 중심 대폭발)
 */
export const fireGenesis = (
  ctx: WeaponFireContext,
  stats: WeaponStats,
  damage: number,
  color: string,
  isUltimate: boolean
): void => {
  const { player, blasts } = ctx;
  const radius = stats.area * (isUltimate ? 2.0 : 1);

  // 중심 대폭발 - 제네시스 블록 생성!
  blasts.push({
    id: Math.random().toString(),
    position: { ...player.position },
    radius,
    life: stats.duration * 1.5, // 더 오래 유지
    maxLife: stats.duration * 1.5,
    color,
    type: 'genesis', // 전용 폭발 타입 - 블록체인 기원!
  });

  // 폭발 범위 내 모든 적에게 데미지
  ctx.enemies.forEach(enemy => {
    const dx = enemy.position.x - player.position.x;
    const dy = enemy.position.y - player.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < radius + enemy.radius) {
      ctx.damageEnemy(enemy, damage, stats.knockback, player.position, 'genesis', isUltimate);
    }
  });

  // 얼티밋이면 충격파 링 추가
  if (isUltimate) {
    for (let i = 1; i <= 3; i++) {
      setTimeout(() => {
        blasts.push({
          id: Math.random().toString(),
          position: { ...player.position },
          radius: radius * (1 + i * 0.3),
          life: stats.duration * 0.6,
          maxLife: stats.duration * 0.6,
          color,
          type: 'purge',
        });
      }, i * 100);
    }
  }

  soundManager.playSFX('explosion');
};

/**
 * 브릿지 발사 - 동결 특화!
 * 맞은 적 동결 + 주변 적에게 동결 전파
 */
export const fireBridge = (
  ctx: WeaponFireContext,
  stats: WeaponStats,
  damage: number,
  color: string,
  isUltimate: boolean
): Projectile => {
  const { player, enemies } = ctx;
  const target = getNearestEnemy(player.position, enemies);
  const angle = target ? angleBetween(player.position, target.position) : Math.random() * Math.PI * 2;

  // 동결 효과 (레벨업 시 증가)
  const freezeDuration = 2.0 + (stats.level - 1) * 0.15; // 2초 → 레벨당 +0.15초
  const freezeSpreadRadius = 60 + stats.level * 5; // 60 → 레벨당 +5

  return {
    id: Math.random().toString(),
    type: 'bridge',
    position: getFirePosition(player),
    velocity: { x: Math.cos(angle) * stats.speed, y: Math.sin(angle) * stats.speed },
    radius: stats.area * (isUltimate ? 1.5 : 1),
    color,
    life: stats.duration,
    startLife: stats.duration, // 애니메이션 계산에 필요!
    damage, // 낮은 데미지 (2)
    pierce: stats.pierce, // 제한된 관통 (5)
    knockback: 0,
    angle,
    isEvolved: stats.isEvolved,
    isUltimate,
    freezeDuration: isUltimate ? freezeDuration * 1.5 : freezeDuration,
    freezeSpreadRadius: isUltimate ? freezeSpreadRadius * 1.5 : freezeSpreadRadius,
  };
};

/**
 * 무기 발사 가능 여부 확인 (Trader 클래스 스탠스)
 */
export const canFireWeapon = (player: Player, weaponType: WeaponType): boolean => {
  if (weaponType === 'aggregator' || weaponType === 'oracle') return false;

  if (player.playerClass === 'cypher') {
    const stance = player.stance || 'melee';
    if (stance === 'melee' && weaponType === 'bow') return false;
    if (stance === 'ranged' && ['axe', 'knife', 'punch'].includes(weaponType)) return false;
  }

  return true;
};

/**
 * 무기 색상 결정
 */
export const getWeaponColor = (weaponType: WeaponType, isUltimate: boolean): string => {
  return isUltimate ? '#facc15' : (WEAPON_DATA[weaponType]?.color || '#ffffff');
};

/**
 * 근접 무기 여부 확인
 */
export const isMeleeWeapon = (weaponType: WeaponType): boolean => {
  return ['whip', 'axe', 'punch'].includes(weaponType);
};

export { playWeaponSound };

/**
 * 투사체 배열에 ownerId 주입 (Arena PvP용)
 */
const injectOwnerId = (projectiles: Projectile[], ownerId?: string): void => {
  if (!ownerId) return;
  for (const proj of projectiles) {
    proj.ownerId = ownerId;
  }
};

/**
 * 통합 무기 발사 함수
 * GameCanvas에서 단일 호출로 모든 무기 처리
 */
export const fireWeapon = (
  type: WeaponType,
  stats: WeaponStats,
  ctx: WeaponFireContext
): void => {
  if (!canFireWeapon(ctx.player, type)) return;

  const isUltimate = stats.isUltimate || false;
  const color = getWeaponColor(type, isUltimate);
  const damage = stats.damage * (ctx.player.statMultipliers?.damage || 1);

  // 실제로 무언가 발사/생성되었는지 추적
  let didFire = false;

  switch (type) {
    case 'whip': {
      const projs = fireWhip(ctx, stats, damage, color, isUltimate);
      if (projs.length > 0) {
        injectOwnerId(projs, ctx.ownerId);
        ctx.projectiles.push(...projs);
        didFire = true;
      }
      break;
    }
    case 'wand': {
      const projs = fireWand(ctx, stats, damage, color, isUltimate);
      if (projs.length > 0) {
        injectOwnerId(projs, ctx.ownerId);
        ctx.projectiles.push(...projs);
        didFire = true;
      }
      break;
    }
    case 'knife': {
      const projs = fireKnife(ctx, stats, damage, color, isUltimate);
      if (projs.length > 0) {
        injectOwnerId(projs, ctx.ownerId);
        ctx.projectiles.push(...projs);
        didFire = true;
      }
      break;
    }
    case 'axe': {
      const projs = fireAxe(ctx, stats, damage, color, isUltimate);
      if (projs.length > 0) {
        injectOwnerId(projs, ctx.ownerId);
        ctx.projectiles.push(...projs);
        didFire = true;
      }
      break;
    }
    case 'bible': {
      // 기존 바이블 제거
      const filtered = ctx.projectiles.filter(pr => pr.type !== 'bible');
      ctx.projectiles.length = 0;
      ctx.projectiles.push(...filtered);
      const projs = fireBible(ctx, stats, damage, color, isUltimate);
      if (projs.length > 0) {
        injectOwnerId(projs, ctx.ownerId);
        ctx.projectiles.push(...projs);
        didFire = true;
      }
      break;
    }
    case 'garlic': {
      const proj = fireGarlic(ctx.projectiles, ctx.player, stats, damage, color, isUltimate);
      if (proj) {
        if (ctx.ownerId) proj.ownerId = ctx.ownerId;
        ctx.projectiles.push(proj);
        didFire = true;
      }
      // garlic은 업데이트만 해도 실제 데미지는 줌 - 사운드 스킵
      break;
    }
    case 'pool': {
      const projs = firePool(ctx, stats, damage, color, isUltimate);
      if (projs.length > 0) {
        injectOwnerId(projs, ctx.ownerId);
        ctx.projectiles.push(...projs);
        didFire = true;
      }
      break;
    }
    case 'lightning': {
      const bolts = fireLightning(ctx, stats, damage, isUltimate);
      if (bolts.length > 0) {
        // LightningBolt에도 ownerId 필요시 별도 처리
        ctx.lightningBolts.push(...bolts);
        didFire = true;
      }
      break;
    }
    case 'beam': {
      const projs = fireBeam(ctx, stats, damage, color, isUltimate);
      if (projs.length > 0) {
        injectOwnerId(projs, ctx.ownerId);
        ctx.projectiles.push(...projs);
        didFire = true;
      }
      break;
    }
    case 'laser': {
      const projs = fireLaser(ctx, stats, damage, color, isUltimate);
      if (projs.length > 0) {
        injectOwnerId(projs, ctx.ownerId);
        ctx.projectiles.push(...projs);
        didFire = true;
      }
      break;
    }
    case 'phishing': {
      const blast = firePhishing(ctx, stats, damage);
      // Blast에도 ownerId 필요시: blast.ownerId = ctx.ownerId;
      ctx.blasts.push(blast);
      didFire = true;
      break;
    }
    case 'stablecoin': {
      ctx.player.shield = Math.min(ctx.player.shield + 1, ctx.player.maxShield);
      soundManager.playSFX('powerup');
      // stablecoin은 자체 사운드 재생
      break;
    }
    case 'punch': {
      const projs = firePunch(ctx, stats, damage, color, isUltimate);
      if (projs.length > 0) {
        injectOwnerId(projs, ctx.ownerId);
        ctx.projectiles.push(...projs);
        didFire = true;
      }
      break;
    }
    case 'bow': {
      const projs = fireBow(ctx, stats, damage, color, isUltimate);
      if (projs.length > 0) {
        injectOwnerId(projs, ctx.ownerId);
        ctx.projectiles.push(...projs);
        didFire = true;
      }
      break;
    }
    case 'bridge': {
      const proj = fireBridge(ctx, stats, damage, color, isUltimate);
      if (ctx.ownerId) proj.ownerId = ctx.ownerId;
      ctx.projectiles.push(proj);
      didFire = true;
      break;
    }
    case 'ping': {
      const projs = firePing(ctx, stats, damage, color, isUltimate);
      if (projs.length > 0) {
        injectOwnerId(projs, ctx.ownerId);
        ctx.projectiles.push(...projs);
        didFire = true;
      }
      break;
    }
    // NEW DOPAMINE SKILLS
    case 'shard': {
      const projs = fireShard(ctx, stats, damage, color, isUltimate);
      if (projs.length > 0) {
        injectOwnerId(projs, ctx.ownerId);
        ctx.projectiles.push(...projs);
        didFire = true;
      }
      break;
    }
    case 'airdrop': {
      const projs = fireAirdrop(ctx, stats, damage, color, isUltimate);
      if (projs.length > 0) {
        injectOwnerId(projs, ctx.ownerId);
        ctx.projectiles.push(...projs);
        didFire = true;
      }
      break;
    }
    case 'fork': {
      const projs = fireFork(ctx, stats, damage, color, isUltimate);
      if (projs.length > 0) {
        injectOwnerId(projs, ctx.ownerId);
        ctx.projectiles.push(...projs);
        didFire = true;
      }
      break;
    }
    case 'genesis': {
      fireGenesis(ctx, stats, damage, color, isUltimate);
      didFire = true;
      break;
    }
  }

  // 실제로 발사된 경우에만 사운드 재생 및 근접 무기 시간 갱신
  if (didFire) {
    playWeaponSound(type);
    if (isMeleeWeapon(type)) {
      ctx.lastAttackTime.current = Date.now();
    }
  }
};
