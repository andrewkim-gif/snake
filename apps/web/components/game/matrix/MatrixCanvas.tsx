'use client';

/**
 * MatrixCanvas.tsx - v28 Matrix 자동전투 서바이벌 게임 캔버스
 * Phase 4: 완전한 게임 루프 (Web Worker tick + rAF render)
 *
 * 핵심 구조:
 * 1. Web Worker → update(deltaTime) : 물리, 충돌, 무기 쿨다운
 * 2. requestAnimationFrame → draw(ctx) : 렌더링만
 * 3. React refs로 상태 관리 (0 re-render)
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import type {
  Player,
  Enemy,
  Projectile,
  Gem,
  Pickup,
  Blast,
  LightningBolt,
  DamageNumber,
  EnemyProjectile,
  Vector2,
  WeaponType,
  WeaponInstance,
  StatusEffect,
} from '@/lib/matrix/types';
import {
  GAME_CONFIG,
  WEAPON_DATA,
  XP_THRESHOLDS,
  getWaveForTime,
  getEnemyConfig,
  isRangedEnemy,
} from '@/lib/matrix/constants';
import { processManualInput, processKnockback } from '@/lib/matrix/systems/movement';
import type { InputState } from '@/lib/matrix/systems/movement';
import { processAutoHuntMovement, createDefaultDirectionPlan, createDefaultThreatMemory, createDefaultMotionState } from '@/lib/matrix/systems/movement';
import type { AutoHuntContext, MovementRefs } from '@/lib/matrix/systems/movement';
import { fireWeapon } from '@/lib/matrix/systems/weapons';
import type { WeaponFireContext } from '@/lib/matrix/systems/weapons';
import { updatePlayerProjectiles } from '@/lib/matrix/systems/projectile';
import type { ProjectileSystemContext } from '@/lib/matrix/systems/projectile';
import { spawnEnemy } from '@/lib/matrix/systems/spawning';
import { updateBlasts } from '@/lib/matrix/systems/projectile';
import { SpatialHashGrid } from '@/lib/matrix/systems/spatial-hash';
import { drawEnemy, drawProjectile, drawCatSprite, drawFloorTile } from '@/lib/matrix/rendering';
import { updateRenderContext } from '@/lib/matrix/rendering/index';
import type { ExtendedParticle } from '@/lib/matrix/systems/game-context';
import { distance } from '@/lib/matrix/utils/math';

// ============================================
// 상수
// ============================================

const MAX_DELTA_TIME = 0.1;
const STARTING_WEAPON: WeaponType = 'wand';
const STARTING_WEAPON_STATS: WeaponInstance = {
  level: 1,
  damage: 15,
  area: 8,
  speed: 300,
  duration: 2,
  cooldown: 1.2,
  amount: 1,
  pierce: 1,
  knockback: 3,
};

// ============================================
// 인터페이스
// ============================================

interface MatrixCanvasProps {
  onExit: () => void;
}

// ============================================
// 컴포넌트
// ============================================

export function MatrixCanvas({ onExit }: MatrixCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const [showHUD, setShowHUD] = useState(true);

  // ---- 게임 엔티티 refs (0 re-render) ----
  const playerRef = useRef<Player>(createInitialPlayer());
  const enemiesRef = useRef<Enemy[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const enemyProjectilesRef = useRef<EnemyProjectile[]>([]);
  const gemsRef = useRef<Gem[]>([]);
  const pickupsRef = useRef<Pickup[]>([]);
  const blastsRef = useRef<Blast[]>([]);
  const lightningBoltsRef = useRef<LightningBolt[]>([]);
  const particlesRef = useRef<ExtendedParticle[]>([]);
  const damageNumbersRef = useRef<DamageNumber[]>([]);

  // ---- 입력 refs ----
  const keysPressedRef = useRef<Set<string>>(new Set());
  const joystickRef = useRef({
    active: false,
    origin: { x: 0, y: 0 },
    current: { x: 0, y: 0 },
    pointerId: null as number | null,
  });

  // ---- 타이밍/방향 refs ----
  const gameTimeRef = useRef(0);
  const frameCountRef = useRef(0);
  const lastSpawnTimeRef = useRef(0);
  const lastFacingRef = useRef<Vector2>({ x: 1, y: 0 });
  const lastMoveFacingRef = useRef<Vector2>({ x: 1, y: 0 });
  const lastAttackTimeRef = useRef(0);
  const gameActiveRef = useRef(true);

  // ---- Auto Hunt 상태 ----
  const autoHuntEnabled = useRef(true); // 기본 활성화
  const directionPlanRef = useRef(createDefaultDirectionPlan());
  const threatMemoryRef = useRef(createDefaultThreatMemory());
  const motionStateRef = useRef(createDefaultMotionState());
  const smoothedAutoHuntDirRef = useRef<Vector2>({ x: 0, y: 0 });
  const lastAutoHuntPosRef = useRef<Vector2>({ x: 0, y: 0 });
  const stuckFrameCountRef = useRef(0);
  const escapeDirRef = useRef<Vector2 | null>(null);

  // ---- 카메라 ----
  const cameraRef = useRef({ x: 0, y: 0 });

  // ============================================
  // 플레이어 초기화
  // ============================================

  function createInitialPlayer(): Player {
    return {
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      radius: GAME_CONFIG.PLAYER_RADIUS,
      speed: GAME_CONFIG.PLAYER_SPEED,
      health: GAME_CONFIG.PLAYER_HP,
      maxHealth: GAME_CONFIG.PLAYER_HP,
      level: 1,
      xp: 0,
      nextXp: XP_THRESHOLDS[0],
      nextLevelXp: XP_THRESHOLDS[0],
      score: 0,
      shield: 0,
      maxShield: 0,
      criticalChance: 0.05,
      invulnerabilityTimer: 0,
      weapons: {
        [STARTING_WEAPON]: { ...STARTING_WEAPON_STATS },
      },
      specialCooldown: 0,
      knockback: { x: 0, y: 0 },
      hitFlashTimer: 0,
      playerClass: 'neo',
      selectedClass: 'neo',
      stance: 'melee',
      statMultipliers: { speed: 1, cooldown: 1, damage: 1, health: 1 },
    };
  }

  // ============================================
  // 경험치/레벨업 (기초)
  // ============================================

  const addXP = useCallback((amount: number) => {
    const player = playerRef.current;
    player.xp += amount;
    while (player.xp >= player.nextLevelXp) {
      player.xp -= player.nextLevelXp;
      player.level += 1;
      const idx = Math.min(player.level - 1, XP_THRESHOLDS.length - 1);
      player.nextLevelXp = XP_THRESHOLDS[idx];
      player.nextXp = player.nextLevelXp;

      // 레벨업 보상: HP 회복 + 무기 강화
      player.health = Math.min(player.maxHealth, player.health + 20);
      const wand = player.weapons[STARTING_WEAPON];
      if (wand) {
        wand.damage += 3;
        if (player.level % 3 === 0) {
          wand.amount = Math.min(wand.amount + 1, 5);
        }
        if (player.level % 5 === 0) {
          wand.cooldown = Math.max(0.3, wand.cooldown - 0.1);
        }
      }
    }
  }, []);

  // ============================================
  // 데미지 시스템
  // ============================================

  const damageEnemy = useCallback((
    enemy: Enemy,
    damage: number,
    knockback: number,
    sourcePos: Vector2,
    _weaponType: WeaponType | 'bomb' | 'special',
    _isUltimate?: boolean,
  ) => {
    if (enemy.state === 'dying') return;

    enemy.health -= damage;
    enemy.hitBy?.add(Math.random().toString());

    // 넉백
    if (knockback > 0) {
      const dx = enemy.position.x - sourcePos.x;
      const dy = enemy.position.y - sourcePos.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      enemy.velocity.x += (dx / dist) * knockback * 2;
      enemy.velocity.y += (dy / dist) * knockback * 2;
    }

    // 데미지 넘버
    if (damageNumbersRef.current.length < GAME_CONFIG.MAX_DAMAGE_NUMBERS) {
      damageNumbersRef.current.push({
        id: Math.random().toString(),
        position: { x: enemy.position.x + (Math.random() - 0.5) * 10, y: enemy.position.y - 15 },
        value: Math.round(damage),
        color: damage >= 30 ? '#facc15' : '#ffffff',
        life: GAME_CONFIG.DAMAGE_TEXT_LIFESPAN,
        maxLife: GAME_CONFIG.DAMAGE_TEXT_LIFESPAN,
        velocity: { x: (Math.random() - 0.5) * 30, y: -60 },
      });
    }

    // 사망 처리
    if (enemy.health <= 0) {
      enemy.state = 'dying';
      enemy.stunTimer = 0.3;
      enemy.deathScale = 1;

      // 점수 + 경험치
      playerRef.current.score += 10;
      const xpValue = enemy.isBoss ? 50 : (enemy.radius > 15 ? 8 : 5);
      addXP(xpValue);

      // 젬 스폰
      if (gemsRef.current.length < GAME_CONFIG.MAX_GEMS) {
        gemsRef.current.push({
          id: Math.random().toString(),
          position: { ...enemy.position },
          value: xpValue,
          color: xpValue > 10 ? '#a855f7' : '#3b82f6',
          isCollected: false,
        });
      }
    }
  }, [addXP]);

  // ============================================
  // UPDATE 루프 (게임 로직)
  // ============================================

  const update = useCallback((deltaTime: number) => {
    if (!gameActiveRef.current) return;
    const player = playerRef.current;

    frameCountRef.current++;
    gameTimeRef.current += deltaTime;

    // 무적 타이머
    if (player.invulnerabilityTimer > 0) {
      player.invulnerabilityTimer -= deltaTime;
    }
    if (player.hitFlashTimer > 0) {
      player.hitFlashTimer = Math.max(0, player.hitFlashTimer - deltaTime);
    }

    // ---- 이동 ----
    let moveDir: Vector2;

    if (autoHuntEnabled.current) {
      // Auto Hunt AI
      const ctx: AutoHuntContext = {
        enemies: enemiesRef.current,
        enemyProjectiles: enemyProjectilesRef.current,
        gems: gemsRef.current,
        pickups: pickupsRef.current,
        lastFacing: lastFacingRef.current,
        maxWeaponRange: 0,
        hasRangedWeapon: true,
      };
      const movementRefs: MovementRefs = {
        smoothedAutoHuntDir: smoothedAutoHuntDirRef,
        lastAutoHuntPos: lastAutoHuntPosRef,
        stuckFrameCount: stuckFrameCountRef,
        escapeDir: escapeDirRef,
        lastFacing: lastFacingRef,
        lastMoveFacing: lastMoveFacingRef,
        directionPlan: directionPlanRef,
        threatMemory: threatMemoryRef,
        motionState: motionStateRef,
      };
      moveDir = processAutoHuntMovement(player, ctx, movementRefs, frameCountRef.current);
    } else {
      // 수동 입력
      const inputState: InputState = {
        keysPressed: keysPressedRef.current,
        joystick: {
          active: joystickRef.current.active,
          origin: joystickRef.current.origin,
          current: joystickRef.current.current,
        },
      };
      moveDir = processManualInput(inputState, lastFacingRef, lastMoveFacingRef);
    }

    // 넉백 물리
    processKnockback(player);

    // 속도 계산
    player.velocity.x = moveDir.x * player.speed + player.knockback.x;
    player.velocity.y = moveDir.y * player.speed + player.knockback.y;

    // 위치 업데이트 (장애물 없음 — Arena 모드)
    player.position.x += player.velocity.x * deltaTime;
    player.position.y += player.velocity.y * deltaTime;

    // 카메라 추적 (lerp)
    cameraRef.current.x += (player.position.x - cameraRef.current.x) * 0.1;
    cameraRef.current.y += (player.position.y - cameraRef.current.y) * 0.1;

    // ---- 젬 수집 ----
    const gems = gemsRef.current;
    for (let i = gems.length - 1; i >= 0; i--) {
      const gem = gems[i];
      const d = distance(player.position, gem.position);

      // 자석 범위 내: 끌어당김
      if (d < GAME_CONFIG.GEM_MAGNET_RANGE) {
        const dx = player.position.x - gem.position.x;
        const dy = player.position.y - gem.position.y;
        const nd = Math.sqrt(dx * dx + dy * dy) || 1;
        gem.position.x += (dx / nd) * GAME_CONFIG.GEM_COLLECT_SPEED * deltaTime;
        gem.position.y += (dy / nd) * GAME_CONFIG.GEM_COLLECT_SPEED * deltaTime;
      }

      // 수집
      if (d < player.radius + 8) {
        addXP(gem.value);
        gems.splice(i, 1);
      }
    }

    // ---- 적 스폰 ----
    const wave = getWaveForTime(gameTimeRef.current);
    const timeSinceLastSpawn = gameTimeRef.current - lastSpawnTimeRef.current;
    if (timeSinceLastSpawn >= wave.spawnRate && enemiesRef.current.length < wave.maxEnemies) {
      spawnEnemy(
        enemiesRef,
        player,
        gameTimeRef.current,
        999, // Matrix mode stageId
        wave.types,
      );
      lastSpawnTimeRef.current = gameTimeRef.current;
    }

    // ---- 적 업데이트 ----
    const enemies = enemiesRef.current;
    let enemyWriteIdx = 0;
    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];

      // 사망 애니메이션
      if (enemy.state === 'dying') {
        enemy.stunTimer -= deltaTime;
        enemy.deathScale = Math.max(0, (enemy.deathScale ?? 1) - deltaTime * 3);
        if (enemy.stunTimer <= 0) continue; // 제거
        enemies[enemyWriteIdx++] = enemy;
        continue;
      }

      // 디스폰 (너무 멀리)
      const distToPlayer = distance(player.position, enemy.position);
      if (distToPlayer > GAME_CONFIG.DESPAWN_RADIUS) continue;

      // 플레이어 방향으로 이동
      const dx = player.position.x - enemy.position.x;
      const dy = player.position.y - enemy.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      enemy.velocity.x = (dx / dist) * enemy.speed;
      enemy.velocity.y = (dy / dist) * enemy.speed;
      enemy.position.x += enemy.velocity.x * deltaTime;
      enemy.position.y += enemy.velocity.y * deltaTime;

      // 플레이어 충돌 (데미지)
      if (distToPlayer < player.radius + enemy.radius) {
        if (player.invulnerabilityTimer <= 0) {
          player.health -= enemy.damage * deltaTime;
          player.hitFlashTimer = 0.15;
          player.invulnerabilityTimer = 0.1;
          if (player.health <= 0) {
            player.health = 0;
            // Game Over 처리는 간단히 — 즉시 리셋
            resetGame();
            return;
          }
        }
      }

      enemies[enemyWriteIdx++] = enemy;
    }
    enemies.length = enemyWriteIdx;

    // ---- 무기 발사 ----
    const weaponEntries = Object.entries(player.weapons) as [WeaponType, WeaponInstance][];
    for (const [type, stats] of weaponEntries) {
      if (!stats) continue;
      // 쿨다운 체크
      const cdKey = type as WeaponType;
      const timer = stats.timer ?? 0;
      const newTimer = timer - deltaTime;
      if (newTimer <= 0) {
        // 발사!
        const fireCtx: WeaponFireContext = {
          player,
          projectiles: projectilesRef.current,
          lightningBolts: lightningBoltsRef.current,
          blasts: blastsRef.current,
          enemies: enemiesRef.current,
          lastFacing: lastFacingRef.current,
          lastAttackTime: lastAttackTimeRef,
          canvasWidth: canvasRef.current?.width ?? 1920,
          canvasHeight: canvasRef.current?.height ?? 1080,
          damageEnemy: (enemy, dmg, kb, srcPos, wpnType, isUlt) => {
            damageEnemy(enemy, dmg, kb, srcPos, wpnType, isUlt);
          },
        };
        fireWeapon(cdKey, stats as any, fireCtx);
        stats.timer = stats.cooldown * (player.statMultipliers?.cooldown ?? 1);
      } else {
        stats.timer = newTimer;
      }
    }

    // ---- 투사체 업데이트 ----
    const projCtx: ProjectileSystemContext = {
      player,
      enemies: enemiesRef.current,
      blasts: blastsRef.current,
      damageEnemy: (enemy, dmg, kb, srcPos, wpnType, isUlt) => {
        damageEnemy(enemy, dmg, kb, srcPos, wpnType, isUlt);
      },
    };
    projectilesRef.current = updatePlayerProjectiles(
      projectilesRef.current,
      projCtx,
      deltaTime,
    );

    // ---- 폭발 업데이트 ----
    blastsRef.current = updateBlasts(blastsRef.current, deltaTime);

    // ---- 번개 업데이트 ----
    const bolts = lightningBoltsRef.current;
    for (let i = bolts.length - 1; i >= 0; i--) {
      bolts[i].life -= deltaTime;
      if (bolts[i].life <= 0) bolts.splice(i, 1);
    }

    // ---- 데미지 넘버 업데이트 ----
    const dmgNums = damageNumbersRef.current;
    for (let i = dmgNums.length - 1; i >= 0; i--) {
      dmgNums[i].life -= deltaTime;
      dmgNums[i].position.y += (dmgNums[i].velocity?.y ?? -60) * deltaTime;
      dmgNums[i].position.x += (dmgNums[i].velocity?.x ?? 0) * deltaTime;
      if (dmgNums[i].life <= 0) dmgNums.splice(i, 1);
    }

    // ---- 파티클 업데이트 ----
    const particles = particlesRef.current;
    for (let i = particles.length - 1; i >= 0; i--) {
      particles[i].life -= deltaTime;
      particles[i].position.x += particles[i].velocity.x * deltaTime;
      particles[i].position.y += particles[i].velocity.y * deltaTime;
      if (particles[i].life <= 0) particles.splice(i, 1);
    }

    // ---- 렌더 컨텍스트 업데이트 (LOD) ----
    updateRenderContext(
      enemies.length,
      projectilesRef.current.length,
      particles.length,
    );
  }, [addXP, damageEnemy]);

  // ============================================
  // 게임 리셋
  // ============================================

  const resetGame = useCallback(() => {
    playerRef.current = createInitialPlayer();
    enemiesRef.current = [];
    projectilesRef.current = [];
    enemyProjectilesRef.current = [];
    gemsRef.current = [];
    pickupsRef.current = [];
    blastsRef.current = [];
    lightningBoltsRef.current = [];
    particlesRef.current = [];
    damageNumbersRef.current = [];
    gameTimeRef.current = 0;
    frameCountRef.current = 0;
    lastSpawnTimeRef.current = 0;
    cameraRef.current = { x: 0, y: 0 };
  }, []);

  // ============================================
  // DRAW 루프 (렌더링)
  // ============================================

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    const canvas = ctx.canvas;
    const width = canvas.width;
    const height = canvas.height;
    const player = playerRef.current;
    const cam = cameraRef.current;

    // 캔버스 리사이즈 (매 프레임 보정)
    if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    ctx.clearRect(0, 0, width, height);

    // ---- 배경 (검은색 + 그리드) ----
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    // 카메라 변환: 화면 중앙 - 카메라 위치
    ctx.translate(width / 2 - cam.x, height / 2 - cam.y);

    // 그리드 배경
    drawGrid(ctx, cam.x, cam.y, width, height);

    // ---- 젬 ----
    const gems = gemsRef.current;
    for (const gem of gems) {
      ctx.fillStyle = gem.color;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      // 다이아몬드 형태
      const gx = gem.position.x;
      const gy = gem.position.y;
      const gr = 5;
      ctx.moveTo(gx, gy - gr);
      ctx.lineTo(gx + gr, gy);
      ctx.lineTo(gx, gy + gr);
      ctx.lineTo(gx - gr, gy);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // ---- 적 ----
    const enemies = enemiesRef.current;
    for (const enemy of enemies) {
      drawEnemy(ctx, enemy);
    }

    // ---- 투사체 ----
    const projectiles = projectilesRef.current;
    for (const proj of projectiles) {
      drawProjectile(ctx, proj, player.position);
    }

    // ---- 폭발 ----
    for (const blast of blastsRef.current) {
      const progress = 1 - blast.life / blast.maxLife;
      const radius = blast.radius * progress;
      ctx.globalAlpha = 1 - progress;
      ctx.strokeStyle = blast.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(blast.position.x, blast.position.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // ---- 번개 ----
    for (const bolt of lightningBoltsRef.current) {
      if (bolt.delay > 0) continue;
      const alpha = bolt.life / bolt.maxLife;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = bolt.color;
      ctx.lineWidth = bolt.width;
      ctx.beginPath();
      if (bolt.segments.length > 0) {
        ctx.moveTo(bolt.segments[0].x, bolt.segments[0].y);
        for (let i = 1; i < bolt.segments.length; i++) {
          ctx.lineTo(bolt.segments[i].x, bolt.segments[i].y);
        }
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // ---- 플레이어 ----
    ctx.save();
    // 피격 플래시
    if (player.hitFlashTimer > 0) {
      ctx.globalAlpha = 0.7 + Math.sin(Date.now() / 50) * 0.3;
    }
    drawCatSprite(ctx, player, lastMoveFacingRef.current);
    ctx.restore();

    // ---- 데미지 넘버 ----
    for (const dn of damageNumbersRef.current) {
      const dnMaxLife = dn.maxLife ?? GAME_CONFIG.DAMAGE_TEXT_LIFESPAN;
      const alpha = dn.life / dnMaxLife;
      ctx.globalAlpha = alpha;
      const isBigHit = dn.value >= 30;
      ctx.font = isBigHit ? 'bold 18px monospace' : '14px monospace';
      ctx.fillStyle = dn.color;
      ctx.textAlign = 'center';
      ctx.fillText(
        dn.value.toString(),
        dn.position.x,
        dn.position.y,
      );
    }
    ctx.globalAlpha = 1;

    // ---- 파티클 ----
    for (const p of particlesRef.current) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.position.x, p.position.y, p.radius * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.restore(); // 카메라 변환 종료

    // ---- HUD (화면 고정) ----
    drawHUD(ctx, width, height, player);
  }, []);

  // ============================================
  // 그리드 배경
  // ============================================

  function drawGrid(ctx: CanvasRenderingContext2D, camX: number, camY: number, w: number, h: number) {
    const gridSize = 64;
    ctx.strokeStyle = 'rgba(0, 255, 65, 0.08)';
    ctx.lineWidth = 1;

    const startX = Math.floor((camX - w / 2) / gridSize) * gridSize;
    const endX = camX + w / 2;
    const startY = Math.floor((camY - h / 2) / gridSize) * gridSize;
    const endY = camY + h / 2;

    ctx.beginPath();
    for (let x = startX; x <= endX; x += gridSize) {
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
    }
    for (let y = startY; y <= endY; y += gridSize) {
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
    }
    ctx.stroke();
  }

  // ============================================
  // HUD 렌더링
  // ============================================

  function drawHUD(ctx: CanvasRenderingContext2D, w: number, h: number, player: Player) {
    const padding = 16;

    // HP 바
    const barW = 200;
    const barH = 12;
    const barX = padding;
    const barY = padding;
    const hpRatio = player.health / player.maxHealth;

    // 배경
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);
    // HP
    ctx.fillStyle = hpRatio > 0.5 ? '#22c55e' : hpRatio > 0.25 ? '#f59e0b' : '#ef4444';
    ctx.fillRect(barX, barY, barW * hpRatio, barH);
    // HP 텍스트
    ctx.fillStyle = '#ffffff';
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`HP ${Math.ceil(player.health)}/${player.maxHealth}`, barX, barY + barH + 14);

    // XP 바
    const xpY = barY + barH + 24;
    const xpRatio = player.nextLevelXp > 0 ? player.xp / player.nextLevelXp : 0;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(barX - 2, xpY - 2, barW + 4, 8 + 4);
    ctx.fillStyle = '#6366f1';
    ctx.fillRect(barX, xpY, barW * xpRatio, 8);
    ctx.fillStyle = '#a5b4fc';
    ctx.font = '11px monospace';
    ctx.fillText(`Lv.${player.level}  XP ${player.xp}/${player.nextLevelXp}`, barX, xpY + 8 + 14);

    // 게임 시간 (우측 상단)
    const minutes = Math.floor(gameTimeRef.current / 60);
    const seconds = Math.floor(gameTimeRef.current % 60);
    const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    ctx.fillStyle = '#00FF41';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(timeStr, w - padding, padding + 16);

    // 점수 (우측 상단 아래)
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px monospace';
    ctx.fillText(`Score: ${player.score}`, w - padding, padding + 38);

    // 적 수
    ctx.fillStyle = '#888888';
    ctx.font = '12px monospace';
    ctx.fillText(`Enemies: ${enemiesRef.current.length}`, w - padding, padding + 56);

    // ESC 안내 (하단 중앙)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ESC to exit  |  TAB to toggle Auto Hunt', w / 2, h - padding);

    // Auto Hunt 표시
    ctx.fillStyle = autoHuntEnabled.current ? '#00FF41' : '#666666';
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(
      autoHuntEnabled.current ? '[AUTO HUNT: ON]' : '[AUTO HUNT: OFF]',
      barX,
      xpY + 8 + 34,
    );
  }

  // ============================================
  // 입력 핸들러
  // ============================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        gameActiveRef.current = false;
        onExit();
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        autoHuntEnabled.current = !autoHuntEnabled.current;
        return;
      }
      keysPressedRef.current.add(e.code);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressedRef.current.delete(e.code);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [onExit]);

  // ---- 포인터 입력 (터치 조이스틱) ----
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    joystickRef.current = {
      active: true,
      origin: { x: e.clientX, y: e.clientY },
      current: { x: e.clientX, y: e.clientY },
      pointerId: e.pointerId,
    };
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (joystickRef.current.active && joystickRef.current.pointerId === e.pointerId) {
      joystickRef.current.current = { x: e.clientX, y: e.clientY };
    }
  }, []);

  const handlePointerUp = useCallback(() => {
    joystickRef.current = {
      active: false,
      origin: { x: 0, y: 0 },
      current: { x: 0, y: 0 },
      pointerId: null,
    };
  }, []);

  // ============================================
  // 게임 루프 시작 (Web Worker + rAF)
  // ============================================

  useEffect(() => {
    gameActiveRef.current = true;

    // 렌더링 루프
    const renderLoop = () => {
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) draw(ctx);
      requestRef.current = requestAnimationFrame(renderLoop);
    };

    // Web Worker 생성
    let worker: Worker | null = null;
    try {
      worker = new Worker(
        new URL('@/lib/matrix/workers/game-timer.worker.ts', import.meta.url),
        { type: 'module' },
      );
      worker.onmessage = (e) => {
        if (e.data.type === 'tick' && gameActiveRef.current) {
          update(Math.min(e.data.deltaTime, MAX_DELTA_TIME));
        }
      };
      worker.postMessage({ type: 'start' });
    } catch {
      // Worker 실패 시 폴백: rAF 기반 update
      console.warn('[MatrixCanvas] Worker failed, falling back to rAF update');
      let lastTime = performance.now();
      const fallbackLoop = () => {
        const now = performance.now();
        const dt = Math.min((now - lastTime) / 1000, MAX_DELTA_TIME);
        lastTime = now;
        if (gameActiveRef.current) update(dt);
      };
      // draw 루프에 업데이트 통합
      const combinedLoop = () => {
        fallbackLoop();
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) draw(ctx);
        requestRef.current = requestAnimationFrame(combinedLoop);
      };
      requestRef.current = requestAnimationFrame(combinedLoop);
      return () => {
        gameActiveRef.current = false;
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
      };
    }

    // Worker 성공 시 별도 렌더 루프
    requestRef.current = requestAnimationFrame(renderLoop);

    return () => {
      gameActiveRef.current = false;
      if (worker) {
        worker.postMessage({ type: 'stop' });
        worker.terminate();
      }
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [draw, update]);

  // ---- 캔버스 리사이즈 ----
  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        width: '100vw',
        height: '100vh',
        backgroundColor: '#000',
        cursor: 'crosshair',
        touchAction: 'none',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    />
  );
}
