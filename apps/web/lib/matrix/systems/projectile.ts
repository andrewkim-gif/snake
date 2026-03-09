/**
 * projectile.ts - 투사체 시스템
 * 플레이어/적 투사체 업데이트 및 충돌 처리
 * v4.9.1: Spatial Hash Grid로 충돌 검사 최적화 (O(n×m) → O(n+m))
 */

import { Player, Enemy, Vector2, Projectile, EnemyProjectile, Blast, WeaponType, StatusEffect } from '../types';
import { WEAPON_DATA, GAME_CONFIG } from '../constants';
import { distance, angleBetween, circlesOverlap, isWithinRange, distanceSquared } from '../utils/math';
import { soundManager } from '../utils/audio';
import { isObstacleAt } from '../helpers';
import { getEnemyGrid, populateEnemyGrid, SpatialEntity } from './spatial-hash';
import { GRAVITY_Z } from '../isometric';

/**
 * 적에게 상태이상 적용
 */
export const applyStatusEffect = (enemy: Enemy, effect: StatusEffect): void => {
  if (!enemy.statusEffects) {
    enemy.statusEffects = [];
  }

  // 같은 소스에서 온 같은 타입 효과는 갱신 (중복 방지)
  const existingIdx = enemy.statusEffects.findIndex(
    e => e.type === effect.type && e.sourceId === effect.sourceId
  );

  if (existingIdx >= 0) {
    // 기존 효과 갱신 (더 긴 시간으로)
    enemy.statusEffects[existingIdx].duration = Math.max(
      enemy.statusEffects[existingIdx].duration,
      effect.duration
    );
  } else {
    // 새 효과 추가 (최대 5개 제한)
    if (enemy.statusEffects.length < 5) {
      enemy.statusEffects.push({ ...effect, tickTimer: 0 });
    }
  }
};

/**
 * 투사체 시스템 컨텍스트
 */
export interface ProjectileSystemContext {
  player: Player;
  enemies: Enemy[];
  blasts: Blast[];
  // v8.1.2: ownerId 추가 - AI 에이전트의 킬은 플레이어 콤보에 포함 안 함
  damageEnemy: (enemy: Enemy, damage: number, knockback: number, sourcePos: Vector2, weaponType: WeaponType | 'bomb' | 'special', isUltimate?: boolean, ownerId?: string) => void;
}

/**
 * 적 투사체 업데이트 컨텍스트
 */
export interface EnemyProjectileContext {
  player: Player;
  onShieldHit: () => void;
  onPlayerDamaged: (damage: number, angle: number) => void;
  onGameOver: (score: number) => void;
  onHealthUpdate: (hp: number) => void;
  // v7.8: 피격 시 화면 쉐이크 (intensity: 0-1)
  onScreenShake?: (intensity: number) => void;
}

/**
 * 적 투사체 업데이트 - 플레이어 충돌 및 쉴드 처리 포함 (in-place로 GC 압박 감소)
 */
export const updateEnemyProjectiles = (
  projectiles: EnemyProjectile[],
  ctx: EnemyProjectileContext,
  deltaTime: number
): EnemyProjectile[] => {
  const { player, onShieldHit, onPlayerDamaged, onGameOver, onHealthUpdate, onScreenShake } = ctx;
  const maxProjectiles = GAME_CONFIG.MAX_PROJECTILES || 300;

  let writeIdx = 0;
  for (let i = 0; i < projectiles.length; i++) {
    const p = projectiles[i];
    p.life -= deltaTime;
    p.position.x += p.velocity.x * deltaTime;
    p.position.y += p.velocity.y * deltaTime;

    // 지형지물 충돌 - 투사체 파괴
    if (isObstacleAt(p.position.x, p.position.y, p.radius)) {
      continue;
    }

    // Player Collision (v4.9.2: circlesOverlap 사용 - sqrt 제거)
    if (circlesOverlap(p.position, p.radius, player.position, player.radius) && player.invulnerabilityTimer <= 0) {
      const angle = angleBetween(p.position, player.position);
      const hitDir = { x: Math.cos(angle), y: Math.sin(angle) };

      if (player.shield > 0) {
        // 쉴드로 막음
        player.shield--;
        player.invulnerabilityTimer = GAME_CONFIG.PLAYER_INVULNERABILITY;
        // Hit Reaction (쉴드 - 약한 리액션)
        player.hitReaction = { active: true, timer: 0.15, direction: hitDir, intensity: 0.3 };
        // v7.8: 쉴드 피격 시 미약한 쉐이크
        if (onScreenShake) onScreenShake(0.15);
        onShieldHit();
        soundManager.playSFX('hit');
      } else {
        // 직접 데미지
        player.health -= p.damage;
        player.invulnerabilityTimer = GAME_CONFIG.PLAYER_INVULNERABILITY;
        player.knockback.x = Math.cos(angle) * 300;
        player.knockback.y = Math.sin(angle) * 300;
        player.hitFlashTimer = 0.15;
        // Hit Reaction (데미지 - 강한 리액션)
        const intensity = Math.min(p.damage / player.maxHealth, 1);
        player.hitReaction = { active: true, timer: 0.15, direction: hitDir, intensity: Math.max(0.5, intensity) };
        soundManager.playSFX('hit');
        // v7.8: 투사체 피격 시 화면 쉐이크 (데미지 비례)
        if (onScreenShake) onScreenShake(Math.max(0.25, intensity * 0.5));
        onPlayerDamaged(p.damage, angle);

        if (player.health <= 0) {
          player.health = 0;
          onHealthUpdate(0);
          onGameOver(player.score);
        } else {
          onHealthUpdate(Math.floor(player.health));
        }
      }
      continue; // Destroy bullet on hit
    }

    if (p.life > 0 && distance(p.position, player.position) < GAME_CONFIG.DESPAWN_RADIUS) {
      projectiles[writeIdx++] = p;
    }
  }
  projectiles.length = Math.min(writeIdx, maxProjectiles);
  return projectiles;
};

/**
 * 플레이어 투사체 업데이트 (in-place로 GC 압박 감소)
 */
export const updatePlayerProjectiles = (
  projectiles: Projectile[],
  ctx: ProjectileSystemContext,
  deltaTime: number
): Projectile[] => {
  const { player, enemies, blasts, damageEnemy } = ctx;
  const maxProjectiles = GAME_CONFIG.MAX_PROJECTILES || 300;

  // 시간 배속이 높을 때 투사체가 너무 빨리 사라지는 것을 방지
  const cappedDeltaForLife = Math.min(deltaTime, 0.1);

  // v4.9.1: Spatial Hash Grid로 적 캐싱 (O(n×m) → O(n+m) 최적화)
  // 적이 50명 이상일 때만 Grid 사용 (오버헤드 vs 이득 균형)
  const useGrid = enemies.length >= 50;
  const maxEnemyRadius = 30; // 가장 큰 적의 반경

  if (useGrid) {
    const grid = getEnemyGrid(100);
    grid.clear();
    for (const enemy of enemies) {
      if (enemy.state !== 'dying') {
        grid.insert(enemy as SpatialEntity);
      }
    }
  }

  let writeIdx = 0;
  for (let projIdx = 0; projIdx < projectiles.length; projIdx++) {
    const proj = projectiles[projIdx];
    proj.life -= cappedDeltaForLife;
    let shouldKeep = true;

    // Position updates based on type
    if (proj.type === 'bible') {
      if (proj.orbitAngle !== undefined) {
        const weaponStats = player.weapons.bible;
        if (weaponStats) {
          const speed = WEAPON_DATA.bible!.stats[weaponStats.level - 1].speed *
            (proj.isUltimate && proj.startPos?.x === 180 ? -1.2 : 1.0);
          proj.orbitAngle += speed * deltaTime;
          const dist = proj.startPos ? proj.startPos.x : 120;
          proj.position.x = player.position.x + Math.cos(proj.orbitAngle) * dist;
          proj.position.y = player.position.y + Math.sin(proj.orbitAngle) * dist;
        }
      }
    } else if (proj.type === 'garlic') {
      // v3.0: 터렛 투사체는 터렛 위치에 고정 (turretId가 있으면 이미 설정된 위치 유지)
      if (!proj.turretId) {
        proj.position.x = player.position.x;
        proj.position.y = player.position.y;
      }
      // 터렛 garlic은 position 고정 유지
    } else if (proj.type === 'whip' || proj.type === 'sword' || proj.type === 'punch') {
      // v7.27: 근접 스킬(채찍/검/펀치)은 캐릭터 손에서 나오므로 플레이어 위치를 따라감
      if (!proj.turretId) {
        proj.position.x = player.position.x;
        proj.position.y = player.position.y;
      }
    } else if (proj.type === 'laser') {
      // v3.0: 터렛 레이저는 터렛 위치에서 회전
      if (!proj.turretId) {
        // 회전 레이저 - 플레이어 중심에서 스윕
        proj.position.x = player.position.x;
        proj.position.y = player.position.y;
      }
      // 스윕 각도 업데이트 (sweepStartAngle을 기준으로 계산)
      if (proj.sweepAngle !== undefined && proj.sweepDirection !== undefined && proj.startLife !== undefined && proj.sweepStartAngle !== undefined) {
        const progress = 1 - (proj.life / proj.startLife); // 0 → 1
        // sweepStartAngle(고정 기준점)에서 시작하여 sweepAngle만큼 회전
        proj.angle = proj.sweepStartAngle + proj.sweepAngle * progress * proj.sweepDirection;
      }
    } else if (proj.type === 'pool' || proj.type === 'beam') {
      if (proj.type === 'beam') {
        // v3.0: 터렛 빔은 터렛 위치에서 발사
        if (!proj.turretId) {
          // 레이저 조준기는 캐릭터 주변에서 발동 (X, Y 모두 따라감)
          proj.position.x = player.position.x;
          proj.position.y = player.position.y;
        }
      }
    } else {
      // v4.9: 유도 미사일 처리 (터렛 또는 캐릭터 무기)
      if (proj.homingStrength && proj.targetId) {
        const target = enemies.find(e => e.id === proj.targetId && e.state !== 'dying');
        if (target) {
          const dx = target.position.x - proj.position.x;
          const dy = target.position.y - proj.position.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0) {
            const speed = Math.sqrt(proj.velocity.x * proj.velocity.x + proj.velocity.y * proj.velocity.y);
            const targetVx = (dx / dist) * speed;
            const targetVy = (dy / dist) * speed;
            proj.velocity.x += (targetVx - proj.velocity.x) * proj.homingStrength;
            proj.velocity.y += (targetVy - proj.velocity.y) * proj.homingStrength;
            proj.angle = Math.atan2(proj.velocity.y, proj.velocity.x);
          }
        } else {
          // 타겟이 죽었으면 가장 가까운 적으로 재타겟팅 (v5.7: distanceSquared 최적화)
          let nearestEnemy = null;
          let nearestDistSq = Infinity;
          for (let ei = 0; ei < enemies.length; ei++) {
            const e = enemies[ei];
            if (e.state === 'dying') continue;
            const dx = e.position.x - proj.position.x;
            const dy = e.position.y - proj.position.y;
            const distSq = dx * dx + dy * dy;
            if (distSq < nearestDistSq) {
              nearestDistSq = distSq;
              nearestEnemy = e;
            }
          }
          if (nearestEnemy) {
            proj.targetId = nearestEnemy.id;
          }
        }
      }

      proj.position.x += proj.velocity.x * deltaTime;
      proj.position.y += proj.velocity.y * deltaTime;
      if (proj.gravity) proj.velocity.y += proj.gravity * deltaTime;

      // Z축 물리 업데이트 (v6.0 아이소메트릭)
      // z: 현재 높이, velocityZ: Z축 속도, gravityZ: Z축 중력
      if (proj.z !== undefined && proj.velocityZ !== undefined) {
        // Z축 중력 적용 (기본값: GRAVITY_Z = -1200)
        proj.velocityZ += (proj.gravityZ ?? GRAVITY_Z) * deltaTime;
        proj.z += proj.velocityZ * deltaTime;

        // 지면 착지 처리
        if (proj.z <= 0) {
          proj.z = 0;

          // 바운스 처리 (zBounceCount > 0이면 튕김)
          if (proj.zBounceCount && proj.zBounceCount > 0) {
            proj.zBounceCount--;
            // 감쇠된 속도로 튕김 (기본 60%)
            const damping = proj.zBounceDamping ?? 0.6;
            proj.velocityZ = Math.abs(proj.velocityZ) * damping;

            // 수평 속도도 약간 감쇠
            proj.velocity.x *= 0.85;
            proj.velocity.y *= 0.85;
          } else {
            // 바운스 끝 - Z축 물리 비활성화
            proj.velocityZ = 0;
            proj.gravityZ = 0;

            // v7.11: axe 마지막 바운스 후 폭발!
            if (proj.type === 'axe' && proj.explosionDamage && proj.explosionRadius) {
              // 폭발 범위 내 적에게 데미지
              for (let ei = 0; ei < enemies.length; ei++) {
                const enemy = enemies[ei];
                if (enemy.state === 'dying') continue;
                const dx = enemy.position.x - proj.position.x;
                const dy = enemy.position.y - proj.position.y;
                const distSq = dx * dx + dy * dy;
                const radiusSq = proj.explosionRadius * proj.explosionRadius;
                if (distSq <= radiusSq) {
                  // 거리에 따른 데미지 감쇠 (중심 100%, 가장자리 50%)
                  const distRatio = Math.sqrt(distSq) / proj.explosionRadius;
                  const damageMultiplier = 1 - (distRatio * 0.5);
                  damageEnemy(
                    enemy,
                    proj.explosionDamage * damageMultiplier,
                    proj.knockback * 1.5, // 폭발 넉백 증가
                    proj.position,
                    'axe',
                    proj.isUltimate,
                    proj.ownerId // v8.1.2: AI 에이전트 킬 구분
                  );
                }
              }

              // 폭발 이펙트 생성
              blasts.push({
                id: Math.random().toString(),
                position: { ...proj.position },
                radius: proj.explosionRadius,
                life: 0.4,
                maxLife: 0.4,
                color: proj.isUltimate ? '#ff6b6b' : '#ef4444',
                type: 'explosion',
              });

              // 폭발 사운드
              soundManager.playSFX('explosion');

              // 투사체 제거
              shouldKeep = false;
            }
          }
        }
      }

      // 회전 업데이트 (knife, axe 등 투척 무기)
      if (proj.rotationSpeed !== undefined && proj.currentRotation !== undefined) {
        proj.currentRotation += proj.rotationSpeed * deltaTime;
      }

      // 발사체 투사체 지형지물 충돌 (플레이어 중심 무기 제외)
      if (isObstacleAt(proj.position.x, proj.position.y, proj.radius * 0.5)) {
        shouldKeep = false;
      }
    }

    if (!shouldKeep) continue;

    // Enemy collision
    let hitCount = 0;
    let didHit = false;

    // v6.0: Z축 높이가 있는 투사체는 지면 근처에서만 충돌 검사
    // onlyHitOnGround: true면 z=0일 때만, 아니면 z < 30일 때만 충돌
    // v7.41: axe(서버 던지기)는 날아가는 동안에도 충돌 (최고점 ~51px)
    const zHeight = proj.z ?? 0;
    const canCollide = proj.onlyHitOnGround
      ? zHeight <= 5  // 착지 직전/직후에만 충돌
      : proj.type === 'axe'
        ? zHeight < 80  // axe는 높이 80까지 충돌 (날아가는 동안 몬스터 타격)
        : zHeight < 30; // 일반 투사체는 낮은 높이에서 충돌

    // v6.0.1: Z축 높이가 높으면 충돌 검사만 스킵 (투사체는 유지)
    if (!canCollide) {
      if (proj.life > 0) {
        projectiles[writeIdx++] = proj;
      }
      continue;
    }

    // v4.9.1: Spatial Hash Grid 또는 전체 순회
    const searchRadius = proj.radius + maxEnemyRadius + (proj.type === 'beam' || proj.type === 'laser' ? 600 : 0);
    const candidateEnemies = useGrid
      ? getEnemyGrid().query(proj.position.x, proj.position.y, searchRadius) as Enemy[]
      : enemies;

    for (let ei = 0; ei < candidateEnemies.length; ei++) {
      const enemy = candidateEnemies[ei];
      if (enemy.state === 'dying') continue;

      let isHit = false;
      if (proj.type === 'laser' || proj.type === 'beam') {
        // 레이저/빔 선분 충돌 감지 - 플레이어 중심에서 angle 방향으로 선분
        const beamLength = proj.type === 'beam' ? (proj.height || 600) : proj.radius;
        const beamWidth = proj.type === 'beam' ? (proj.width || 20) : 12;
        const endX = proj.position.x + Math.cos(proj.angle ?? 0) * beamLength;
        const endY = proj.position.y + Math.sin(proj.angle ?? 0) * beamLength;
        // 점과 선분 사이의 거리 계산
        const dx = endX - proj.position.x;
        const dy = endY - proj.position.y;
        const lengthSq = dx * dx + dy * dy;
        const t = lengthSq > 0 ? Math.max(0, Math.min(1,
          ((enemy.position.x - proj.position.x) * dx + (enemy.position.y - proj.position.y) * dy) / lengthSq
        )) : 0;
        const nearestX = proj.position.x + t * dx;
        const nearestY = proj.position.y + t * dy;
        // v5.7: distanceSquared 최적화 (빔 충돌)
        const dxToLine = enemy.position.x - nearestX;
        const dyToLine = enemy.position.y - nearestY;
        const distToLineSq = dxToLine * dxToLine + dyToLine * dyToLine;
        const hitRadius = enemy.radius + beamWidth;
        if (distToLineSq < hitRadius * hitRadius) {
          isHit = true;
        }
      } else if (proj.shape === 'rect' && proj.width && proj.height) {
        if (
          enemy.position.x > proj.position.x - proj.width / 2 &&
          enemy.position.x < proj.position.x + proj.width / 2 &&
          enemy.position.y > proj.position.y - proj.height / 2 &&
          enemy.position.y < proj.position.y + proj.height / 2
        ) {
          isHit = true;
        }
      } else if (proj.type === 'whip' || proj.type === 'sword') {
        // v7.26: whip/sword 호(arc) 형태 충돌 - 스윙 진행도에 따른 부채꼴 판정
        // v7.32: 렌더링 오프셋과 동기화! (GameCanvas.tsx SKILL_CENTER_OFFSET과 동일)
        const SKILL_OFFSET_X = 23; // 스킬 중심점 X
        const SKILL_OFFSET_Y = 14; // 스킬 중심점 Y

        const lifeRatio = Math.max(0, Math.min(1, proj.life / (proj.startLife || 0.3)));
        const swingProgress = 1 - lifeRatio;

        // 스윙 범위: -60° ~ +80° (총 140° 호)
        const swingStart = -Math.PI * 0.33; // -60°
        const swingEnd = Math.PI * 0.44;    // +80°
        const swingRange = swingEnd - swingStart;

        // 현재 스윙 각도 (progress에 따라 swingStart → swingEnd)
        const currentSwingAngle = swingStart + swingProgress * swingRange;
        // 스윙 두께: 시작/끝 각도 ±30°
        const swingThickness = Math.PI * 0.17; // ±30°

        // whipLength = radius * 3.6 (렌더링과 동일)
        const whipLength = proj.radius * 3.6;
        const minDist = 15; // 손잡이 근처는 안 맞음

        // v7.32: 적과의 상대 위치 (오프셋 적용!)
        const skillCenterX = proj.position.x + SKILL_OFFSET_X;
        const skillCenterY = proj.position.y + SKILL_OFFSET_Y;
        const dx = enemy.position.x - skillCenterX;
        const dy = enemy.position.y - skillCenterY;
        const distSq = dx * dx + dy * dy;
        const dist = Math.sqrt(distSq);

        // 거리 체크: minDist ~ whipLength + enemy.radius
        if (dist >= minDist && dist <= whipLength + enemy.radius) {
          // 적 방향 각도 (플레이어 기준)
          const enemyAngle = Math.atan2(dy, dx);
          // 스윙 기준 각도 (proj.angle이 바라보는 방향)
          const baseAngle = proj.angle || 0;
          // 상대 각도 (스윙 기준)
          let relativeAngle = enemyAngle - baseAngle;
          // -PI ~ PI 정규화
          while (relativeAngle > Math.PI) relativeAngle -= Math.PI * 2;
          while (relativeAngle < -Math.PI) relativeAngle += Math.PI * 2;

          // 현재 스윙 위치 근처에 있는지 체크 (±swingThickness)
          const angleDiff = Math.abs(relativeAngle - currentSwingAngle);
          if (angleDiff < swingThickness || angleDiff > Math.PI * 2 - swingThickness) {
            isHit = true;
          }
        }
      } else {
        // v4.9.2: circlesOverlap 사용 - sqrt 제거
        if (circlesOverlap(proj.position, proj.radius, enemy.position, enemy.radius)) {
          isHit = true;
        }
      }

      if (isHit) {
        // Continuous damage weapons (tick-based)
        if (['garlic', 'bible', 'whip', 'pool', 'beam', 'laser', 'bridge', 'punch'].includes(proj.type)) {
          const now = Date.now();
          const lastHit = (enemy as any)[`lastHit_${proj.type}_${proj.id}`] || 0;
          if (now - lastHit > (proj.type === 'garlic' ? 500 : 300)) {
            damageEnemy(enemy, proj.damage, proj.knockback, proj.position, proj.type as WeaponType, proj.isUltimate, proj.ownerId);
            (enemy as any)[`lastHit_${proj.type}_${proj.id}`] = now;
            if (proj.type === 'bridge') {
              enemy.stunTimer += proj.life;
              enemy.isFrozen = true;
            }
          }
        } else {
          // Single hit weapons (pierce-based)
          if (!enemy.hitBy.has(proj.id)) {
            damageEnemy(enemy, proj.damage, proj.knockback, proj.position, proj.type as WeaponType, proj.isUltimate, proj.ownerId);
            enemy.hitBy.add(proj.id);
            hitCount++;
            didHit = true;
            if (proj.type === 'bridge') {
              enemy.stunTimer += proj.life;
              enemy.isFrozen = true;
            }
          }
        }
      }
    }

    // === KNIFE 폭발 코인 - 히트 시 폭발! ===
    if (proj.type === 'knife' && didHit) {
      const explosionRadius = proj.explosionRadius || 40;
      const explosionDamage = proj.explosionDamage || 4;

      // 폭발 이펙트 생성
      if (blasts.length < (GAME_CONFIG.MAX_BLASTS || 20)) {
        blasts.push({
          id: Math.random().toString(),
          position: { ...proj.position },
          radius: explosionRadius,
          life: 0.3,
          maxLife: 0.3,
          color: '#facc15', // 금색 폭발
          type: 'explosion',
        });
      }

      // 폭발 범위 내 모든 적에게 스플래시 데미지 (v4.9.1: Grid 사용)
      const splashCandidates = useGrid
        ? getEnemyGrid().query(proj.position.x, proj.position.y, explosionRadius + maxEnemyRadius) as Enemy[]
        : enemies;
      // v4.9.2: circlesOverlap 사용 - sqrt 제거
      for (let ei = 0; ei < splashCandidates.length; ei++) {
        const e = splashCandidates[ei];
        if (e.state === 'dying') continue;
        if (circlesOverlap(proj.position, explosionRadius, e.position, e.radius)) {
          // 이미 직접 히트한 적 제외 (중복 데미지 방지)
          if (!e.hitBy.has(proj.id + '_explosion')) {
            damageEnemy(e, explosionDamage, 20, proj.position, 'knife', proj.isUltimate, proj.ownerId);
            e.hitBy.add(proj.id + '_explosion');
          }
        }
      }

      soundManager.playSFX('explosion');
      continue; // 폭발 후 투사체 제거
    }

    // === FORK 체인 라이트닝 - 연쇄 데미지 (v7.42) ===
    // 독 데미지 제거 → 방사형 체인 라이트닝으로 변경됨
    // 이제 fork는 8방향으로 날아가며 관통 데미지를 주는 방식

    // === BRIDGE 동결 전파 - 히트 시 주변 동결! ===
    if (proj.type === 'bridge' && didHit && proj.freezeDuration) {
      const spreadRadius = proj.freezeSpreadRadius || 60;

      // 히트한 적 주변에 동결 전파
      for (let ei = 0; ei < enemies.length; ei++) {
        const e = enemies[ei];
        if (e.state === 'dying') continue;

        // 직접 히트한 적
        if (e.hitBy.has(proj.id)) {
          applyStatusEffect(e, {
            type: 'freeze',
            duration: proj.freezeDuration,
            sourceWeapon: 'bridge',
            sourceId: proj.id,
          });
          e.isFrozen = true;
          e.stunTimer = Math.max(e.stunTimer, proj.freezeDuration);

          // 주변 적에게 동결 전파 (약화된 버전)
          for (let ei2 = 0; ei2 < enemies.length; ei2++) {
            const e2 = enemies[ei2];
            if (e2.state === 'dying' || e2 === e) continue;
            const dist = distance(e.position, e2.position);
            if (dist < spreadRadius) {
              applyStatusEffect(e2, {
                type: 'freeze',
                duration: proj.freezeDuration * 0.6, // 전파된 동결은 60% 지속
                sourceWeapon: 'bridge',
                sourceId: proj.id + '_spread',
              });
              e2.isFrozen = true;
              e2.stunTimer = Math.max(e2.stunTimer, proj.freezeDuration * 0.6);
            }
          }
        }
      }
    }

    // Ultimate Axe explosion on hit
    if (proj.type === 'axe' && proj.isUltimate && didHit) {
      if (blasts.length < (GAME_CONFIG.MAX_BLASTS || 20)) {
        blasts.push({
          id: Math.random().toString(),
          position: { ...proj.position },
          radius: 120,
          life: 0.4,
          maxLife: 0.4,
          color: '#ef4444',
        });
      }
      soundManager.playSFX('explosion');
      // v4.9.2: isWithinRange 사용 - sqrt 제거
      for (let ei = 0; ei < enemies.length; ei++) {
        if (isWithinRange(proj.position, enemies[ei].position, 120)) {
          damageEnemy(enemies[ei], proj.damage * 0.5, 50, proj.position, 'axe', true, proj.ownerId);
        }
      }
      continue; // 폭발 후 투사체 제거
    }

    // === SHARD 분열 - 적 히트 시 3방향으로 분열! ===
    if (proj.type === 'shard' && didHit) {
      // 이미 분열된 파편인지 체크 (bounceCount로 구분, 0이면 원본)
      const isOriginal = (proj.bounceCount === undefined || proj.bounceCount === 0);
      const splitDamage = proj.splitDamage || 4; // 분열 파편 데미지

      if (isOriginal && projectiles.length < (GAME_CONFIG.MAX_PROJECTILES || 300) - 3) {
        // 3방향 분열 (현재 진행 방향 기준 -45도, 0도, +45도)
        const baseAngle = proj.angle ?? 0;
        const splitAngles = [-Math.PI / 4, 0, Math.PI / 4];
        const splitSpeed = Math.sqrt(proj.velocity.x ** 2 + proj.velocity.y ** 2) * 0.8;

        for (const offsetAngle of splitAngles) {
          const newAngle = baseAngle + offsetAngle;
          projectiles.push({
            id: Math.random().toString(),
            type: 'shard',
            position: { ...proj.position },
            velocity: { x: Math.cos(newAngle) * splitSpeed, y: Math.sin(newAngle) * splitSpeed },
            radius: proj.radius * 0.7, // 분열된 파편은 70% 크기
            color: proj.color,
            life: proj.life * 0.6, // 남은 수명의 60%
            damage: splitDamage, // 분열 파편 데미지 (설정된 값 사용)
            pierce: 1, // 분열 파편은 1회 관통
            knockback: proj.knockback * 0.5,
            angle: newAngle,
            isEvolved: proj.isEvolved,
            isUltimate: proj.isUltimate,
            bounceCount: 1, // 분열된 파편 표시 (추가 분열 방지)
          });
        }
        soundManager.playSFX('click');
      }
      // 원본 투사체는 계속 진행 (pierce가 남아있으면)
    }

    // === WAND 분필 바운스 - 적 히트 시 다음 적에게 튕김! ===
    if (proj.type === 'wand' && didHit) {
      const currentBounce = proj.bounceCount || 0;
      const maxBounce = proj.pierce; // pierce를 maxBounce로 사용

      if (currentBounce < maxBounce) {
        // 히트한 적을 찾아서 제외하고 다음 타겟 찾기
        let hitEnemy: Enemy | null = null;
        for (let ei = 0; ei < enemies.length; ei++) {
          const e = enemies[ei];
          if (e.state !== 'dying' && e.hitBy.has(proj.id)) {
            hitEnemy = e;
            break;
          }
        }

        // 다음 타겟 찾기 (히트한 적 제외, 가장 가까운 적) (v5.7: distanceSquared 최적화)
        let nextTarget: Enemy | null = null;
        let minDistSq = 300 * 300; // 바운스 범위 300px의 제곱
        for (let ei = 0; ei < enemies.length; ei++) {
          const e = enemies[ei];
          if (e.state === 'dying' || e.hitBy.has(proj.id)) continue;
          const dx = e.position.x - proj.position.x;
          const dy = e.position.y - proj.position.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < minDistSq) {
            minDistSq = distSq;
            nextTarget = e;
          }
        }

        if (nextTarget) {
          // 다음 타겟을 향해 방향 전환 + 속도 유지
          const newAngle = Math.atan2(
            nextTarget.position.y - proj.position.y,
            nextTarget.position.x - proj.position.x
          );
          const speed = Math.sqrt(proj.velocity.x ** 2 + proj.velocity.y ** 2);
          proj.velocity.x = Math.cos(newAngle) * speed;
          proj.velocity.y = Math.sin(newAngle) * speed;
          proj.angle = newAngle;
          proj.bounceCount = currentBounce + 1;
          proj.life = Math.max(proj.life, 0.5); // 수명 연장
          // 바운스 데미지 보너스: 연속 히트마다 10% 증가
          proj.damage = proj.damage * 1.1;
          soundManager.playSFX('click');
          projectiles[writeIdx++] = proj;
          continue; // 투사체 유지
        }
      }
      // maxBounce 도달 또는 다음 타겟 없음 → 투사체 제거
      continue;
    }

    // Ping 패킷 - 적 히트 시 다음 적에게 바운스! (wand와 동일한 방식)
    if (proj.type === 'ping' && didHit) {
      const currentBounce = proj.bounceCount || 0;
      const maxBounce = proj.pierce; // pierce를 최대 바운스 횟수로 사용

      if (currentBounce < maxBounce) {
        // 다음 타겟 찾기 (히트한 적 제외, 가장 가까운 적) (v5.7: distanceSquared 최적화)
        let nextTarget: Enemy | null = null;
        let minDistSq = 350 * 350; // 바운스 범위 350px의 제곱 (ping은 좀 더 넓게)
        for (let ei = 0; ei < enemies.length; ei++) {
          const e = enemies[ei];
          if (e.state === 'dying' || e.hitBy.has(proj.id)) continue;
          const dx = e.position.x - proj.position.x;
          const dy = e.position.y - proj.position.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < minDistSq) {
            minDistSq = distSq;
            nextTarget = e;
          }
        }

        if (nextTarget) {
          // 다음 타겟을 향해 방향 전환 + 속도 유지
          const newAngle = Math.atan2(
            nextTarget.position.y - proj.position.y,
            nextTarget.position.x - proj.position.x
          );
          const speed = Math.sqrt(proj.velocity.x ** 2 + proj.velocity.y ** 2);
          proj.velocity.x = Math.cos(newAngle) * speed;
          proj.velocity.y = Math.sin(newAngle) * speed;
          proj.angle = newAngle;
          proj.bounceCount = currentBounce + 1;
          proj.life = Math.max(proj.life, 0.8); // 수명 연장
          // 바운스 데미지 보너스: 연속 히트마다 15% 증가 (ping은 좀 더 강하게)
          proj.damage = proj.damage * 1.15;

          // 바운스 이펙트 (작은 링)
          if (blasts.length < (GAME_CONFIG.MAX_BLASTS || 20)) {
            blasts.push({
              id: Math.random().toString(),
              position: { ...proj.position },
              radius: 25,
              life: 0.2,
              maxLife: 0.2,
              color: proj.isUltimate ? '#facc15' : '#22d3ee',
              type: 'ring',
            });
          }

          soundManager.playSFX('click');
          projectiles[writeIdx++] = proj;
          continue; // 투사체 유지
        }
      }
      // maxBounce 도달 또는 다음 타겟 없음 → 투사체 제거
      continue;
    }

    // 에어드롭 미사일 - 목표 위치 도달 시 폭발!
    if (proj.type === 'airdrop') {
      // 지연 프레임 카운트다운 (bounceCount > 0이면 아직 대기 중)
      if (proj.bounceCount !== undefined && proj.bounceCount > 0) {
        proj.bounceCount--;
        // 지연 중에는 위치 업데이트 안함 (이미 velocity 적용됨, 위치 되돌림)
        proj.position.y -= proj.velocity.y * deltaTime;
        projectiles[writeIdx++] = proj;
        continue;
      }

      // 목표 위치 도달 체크 (startPos.y가 착탄 목표)
      const targetY = proj.startPos?.y || proj.position.y + 100;
      if (proj.position.y >= targetY || proj.life <= 0) {
        // 착탄! 폭발 이펙트
        const explosionRadius = proj.radius;
        if (blasts.length < (GAME_CONFIG.MAX_BLASTS || 20)) {
          blasts.push({
            id: Math.random().toString(),
            position: { x: proj.position.x, y: targetY },
            radius: explosionRadius,
            life: 0.6,
            maxLife: 0.6,
            color: proj.color,
            type: 'airdrop',
          });
        }

        // 폭발 범위 내 모든 적에게 데미지 (v5.7: distanceSquared 최적화)
        for (let ei = 0; ei < enemies.length; ei++) {
          const e = enemies[ei];
          if (e.state === 'dying') continue;
          const dx = e.position.x - proj.position.x;
          const dy = e.position.y - targetY;
          const distSq = dx * dx + dy * dy;
          const hitRadius = explosionRadius + e.radius;
          if (distSq < hitRadius * hitRadius) {
            damageEnemy(e, proj.damage, proj.knockback, { x: proj.position.x, y: targetY }, 'airdrop', proj.isUltimate, proj.ownerId);
          }
        }

        soundManager.playSFX('explosion');
        continue; // 미사일 제거
      }

      // 아직 낙하 중
      projectiles[writeIdx++] = proj;
      continue;
    }

    // Return conditions
    if (['garlic', 'bible', 'whip', 'pool', 'beam'].includes(proj.type)) {
      if (proj.life > 0) {
        projectiles[writeIdx++] = proj;
      }
      continue;
    }
    if (distance(proj.position, player.position) > GAME_CONFIG.DESPAWN_RADIUS) {
      continue;
    }
    if (proj.life > 0 && hitCount < proj.pierce) {
      projectiles[writeIdx++] = proj;
    }
  }

  projectiles.length = Math.min(writeIdx, maxProjectiles);
  return projectiles;
};

/**
 * 블라스트 업데이트 (in-place로 GC 압박 감소)
 */
export const updateBlasts = (blasts: Blast[], deltaTime: number): Blast[] => {
  let writeIdx = 0;
  for (let i = 0; i < blasts.length; i++) {
    blasts[i].life -= deltaTime;
    if (blasts[i].life > 0) blasts[writeIdx++] = blasts[i];
  }
  blasts.length = Math.min(writeIdx, GAME_CONFIG.MAX_BLASTS || 20);
  return blasts;
};
