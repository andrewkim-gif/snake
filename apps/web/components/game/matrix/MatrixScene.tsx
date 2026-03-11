'use client';

/**
 * MatrixScene.tsx — R3F 기반 3D 렌더링 엔진 (Phase 0+1+2+3+5+6)
 *
 * Canvas 2D MatrixCanvas.tsx의 3D 대체 컴포넌트.
 * 게임 로직(useGameLoop)은 동일하게 재사용하고,
 * 렌더링만 Three.js Scene Graph로 교체한다.
 *
 * 좌표 매핑: 2D(x,y) → 3D(x, 0, -y)
 *
 * Phase 0 통합 항목:
 * - useGameLoop (Worker 기반 게임 로직)
 * - GameCamera (Isometric OrthographicCamera + LERP + Zoom + Shake)
 * - GameLighting (Ambient + Directional x2 + Shadows)
 *
 * Phase 1 통합 항목 (Terrain):
 * - VoxelTerrain (Chunked 3D 지형 + Biome + Noise)
 * - TerrainObjects (InstancedMesh 지형 오브젝트)
 * - PickupRenderer (XP Orb + Item Drop 3D)
 *
 * Phase 2 통합 항목 (Character):
 * - VoxelCharacter (3-head chibi BoxGeometry 캐릭터, S16+S18)
 *
 * Phase 3 통합 항목 (Combat):
 * - SwingArc (근접 공격 이펙트)
 * - DeathParticles (적 사망 파편 폭발)
 * - Enemy hit flash (피격 시 흰색 플래시)
 * - Enemy 리스폰 시스템
 *
 * Phase 5 통합 항목 (Effects):
 * - PostProcessingEffects (Bloom + Vignette, S33)
 * - ParticleSystem (InstancedMesh 파티클, S34)
 *
 * Phase 6 통합 항목 (UI & HUD):
 * - WorldUI (drei Html 앵커링 시스템, S35)
 * - DamageNumbers (Object Pool DOM, S36)
 * - EntityUI (HP바 + 네임태그, S37)
 * - SafeZone3D (안전지대 3D 시각화, S38)
 * - HUD Overlay (기존 React HUD 컴포넌트, S39)
 * - ScreenFlashOverlay (DOM 기반 화면 플래시, S33)
 */

import React, { useRef, useMemo, useEffect, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGameRefs, type GameRefs } from '@/lib/matrix/hooks/useGameRefs';
import { useGameLoop } from '@/lib/matrix/hooks/useGameLoop';
import { ZOOM_CONFIG } from '@/lib/matrix/constants';
import { GameCamera } from './3d/GameCamera';
import { GameLighting } from './3d/GameLighting';
import { VoxelTerrain } from './3d/VoxelTerrain';
import { TerrainObjects } from './3d/TerrainObjects';
import { PickupRenderer } from './3d/PickupRenderer';
import { VoxelCharacter } from './3d/VoxelCharacter';
// Phase 3: Enemies + Combat
import { EnemyRenderer } from './3d/EnemyRenderer';
import { SwingArc, type AttackEvent } from './3d/SwingArc';
import { DeathParticles, type DeathEvent } from './3d/DeathParticles';
// Phase 5: Effects
import { PostProcessingEffects, ScreenFlashOverlay, useScreenFlash } from './3d/PostProcessing';
import { ParticleSystem } from './3d/ParticleSystem';
// Phase 6: UI & HUD
import { WorldUI } from './3d/WorldUI';
import { DamageNumbers } from './3d/DamageNumbers';
import { EntityUI } from './3d/EntityUI';
import { SafeZone3D } from './3d/SafeZone3D';

/**
 * MatrixSceneProps — Phase 0 최소 props
 * Phase 1+에서 전체 MatrixCanvasProps로 확장 예정
 */
export interface MatrixSceneProps {
  /** 게임 활성 상태 */
  gameActive: boolean;
  /** 외부에서 주입하는 GameRefs (MatrixApp에서 공유 시) */
  gameRefs?: GameRefs;
}

/**
 * GroundPlane — 기본 지면 (테스트 fallback)
 * Phase 1: VoxelTerrain이 주 지형이며, 이 컴포넌트는 fallback으로 유지
 */
function GroundPlane() {
  return (
    <mesh
      receiveShadow
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.01, 0]}
    >
      <planeGeometry args={[200, 200]} />
      <meshStandardMaterial
        color="#1a1a2e"
        roughness={0.9}
        metalness={0.1}
      />
    </mesh>
  );
}

/**
 * SceneContent — R3F Canvas 내부 3D 씬 콘텐츠
 * useFrame 등 R3F 훅은 Canvas 내부에서만 사용 가능
 */
function SceneContent({
  refs,
  warningIntensityRef,
  attackEventsRef,
  deathEventsRef,
  hitFlashMapRef,
}: {
  refs: GameRefs;
  warningIntensityRef: React.MutableRefObject<number>;
  attackEventsRef: React.MutableRefObject<AttackEvent[]>;
  deathEventsRef: React.MutableRefObject<DeathEvent[]>;
  hitFlashMapRef: React.MutableRefObject<Map<string, number>>;
}) {
  return (
    <>
      {/* 배경색 — 숲 안개톤 (MC 스타일) */}
      <color attach="background" args={['#87CEAA']} />

      {/* 안개 — 중거리 depth fade (MC 스타일 분위기, 800-1800) */}
      <fog attach="fog" args={['#87CEAA', 800, 1800]} />

      {/* 카메라 — Isometric OrthographicCamera + LERP Follow + Zoom + Shake */}
      <GameCamera
        playerRef={refs.player}
        currentZoomRef={refs.currentZoom}
        screenShakeTimerRef={refs.screenShakeTimer}
        screenShakeIntensityRef={refs.screenShakeIntensity}
      />

      {/* 조명 — Ambient + Directional x2 + Shadows */}
      <GameLighting />

      {/* Phase 1: Chunked 3D 지형 (VoxelTerrain + biome + noise) */}
      <VoxelTerrain
        playerRef={refs.player}
        stageId={refs.currentStageId.current}
        gameMode="stage"
        seed={42}
      />

      {/* Phase 1: 지형 오브젝트 (InstancedMesh) */}
      <TerrainObjects
        playerRef={refs.player}
        stageId={refs.currentStageId.current}
        gameMode="stage"
        seed={42}
      />

      {/* Phase 1: Pickup 아이템 (XP Orb + Item Drop) */}
      <PickupRenderer
        gemsRef={refs.gems}
        pickupsRef={refs.pickups}
        playerRef={refs.player}
      />

      {/* GroundPlane 제거 — VoxelTerrain이 전체 지형 담당, 어두운 fallback이 Z-fighting 유발 */}

      {/* Phase 2: Voxel 캐릭터 (3-head chibi, S13-S18) */}
      <VoxelCharacter
        playerRef={refs.player}
        playerClass={refs.player.current.playerClass ?? 'neo'}
      />

      {/* Phase 3: 적 렌더러 (InstancedMesh) + hit flash */}
      <EnemyRenderer
        enemiesRef={refs.enemies}
        playerRef={refs.player}
        hitFlashMapRef={hitFlashMapRef}
      />

      {/* Phase 3: 근접 공격 Swing Arc 이펙트 */}
      <SwingArc
        playerRef={refs.player}
        attackEventsRef={attackEventsRef}
        facingRef={refs.lastFacing}
      />

      {/* Phase 3: 적 사망 파편 폭발 */}
      <DeathParticles deathEventsRef={deathEventsRef} />

      {/* Phase 5: 파티클 시스템 (S34) */}
      <ParticleSystem qualityTier="HIGH" />

      {/* Phase 6: 안전지대 3D (S38) */}
      <SafeZone3D
        playerRef={refs.player}
        warningIntensityRef={warningIntensityRef}
      />

      {/* Phase 6: World UI — 데미지 넘버 + HP바/네임태그 (S35, S36, S37) */}
      <WorldUI playerRef={refs.player}>
        <DamageNumbers
          damageNumbersRef={refs.damageNumbers}
          playerRef={refs.player}
        />
        <EntityUI
          playerRef={refs.player}
          enemiesRef={refs.enemies}
          qualityTier="HIGH"
        />
      </WorldUI>

      {/* Phase 5: 후처리 이펙트 — Bloom + Vignette (S33) — 기본 LOW (성능 최적화) */}
      <PostProcessingEffects
        qualityTier="LOW"
        warningIntensityRef={warningIntensityRef}
      />
    </>
  );
}

// ============================================
// 전투 상수
// ============================================

const PLAYER_SPEED = 150;
const PLAYER_ATTACK_RANGE = 60;       // 자동 공격 사거리
const PLAYER_ATTACK_COOLDOWN = 0.5;   // 자동 공격 쿨다운 (초)
const PLAYER_ATTACK_DAMAGE = 25;      // 기본 공격 데미지
const PLAYER_KNOCKBACK = 60;          // 적 넉백 강도
const ENEMY_ATTACK_RANGE = 25;
const ENEMY_ATTACK_COOLDOWN = 1.0;
const ENEMY_KNOCKBACK_FORCE = 80;
const GEM_COLLECT_RANGE = 50;
const GEM_MAGNET_RANGE = 100;
const ENEMY_HIT_FLASH_DURATION = 0.12;

// 리스폰 설정
const MIN_ENEMY_COUNT = 8;            // 이 수 이하로 떨어지면 리스폰
const TARGET_ENEMY_COUNT = 20;        // 리스폰 목표 적 수
const RESPAWN_CHECK_INTERVAL = 2.0;   // 리스폰 체크 주기 (초)
const RESPAWN_BATCH_SIZE = 4;         // 한 번에 리스폰할 적 수

/** 적 ID 카운터 */
let _enemyIdCounter = 100;

/**
 * MatrixScene — R3F Canvas 래퍼 + useGameLoop 통합
 *
 * 2D/3D 듀얼 모드 지원:
 * - MatrixApp에서 renderMode='3d' 시 MatrixScene 마운트
 * - renderMode='2d' 시 기존 MatrixCanvas 마운트
 *
 * useFrame priority=0 필수 — non-zero priority는 R3F auto-render 비활성화
 */
export function MatrixScene({ gameActive, gameRefs }: MatrixSceneProps) {
  // 내부 refs (외부에서 주입되지 않은 경우 자체 refs 생성)
  const internalRefs = useGameRefs();
  const refs = gameRefs ?? internalRefs;

  // Phase 5: Screen Flash (DOM overlay)
  const { flashRef, trigger: triggerFlash, update: updateFlash } = useScreenFlash();

  // Phase 6: 위험 경고 강도 ref (SafeZone3D → PostProcessing 연동)
  const warningIntensityRef = useRef(0);

  // === Phase 3: 전투 시스템 refs ===
  const attackEventsRef = useRef<AttackEvent[]>([]);
  const deathEventsRef = useRef<DeathEvent[]>([]);
  const hitFlashMapRef = useRef<Map<string, number>>(new Map());
  const playerAttackTimerRef = useRef(0);
  const respawnTimerRef = useRef(0);

  // === WASD 키보드 입력 ===
  useEffect(() => {
    const keys = refs.keysPressed.current;
    const handleKeyDown = (e: KeyboardEvent) => keys.add(e.key.toLowerCase());
    const handleKeyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [refs.keysPressed]);

  // === 마우스 휠 줌 ===
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05; // 위로 스크롤 = 줌인
    refs.currentZoom.current = Math.max(
      ZOOM_CONFIG.MIN_ZOOM,
      Math.min(ZOOM_CONFIG.MAX_ZOOM, refs.currentZoom.current + delta)
    );
  }, [refs.currentZoom]);

  useEffect(() => {
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // === 테스트 적/잼 스폰 (한 번만 실행) ===
  useMemo(() => {
    // 테스트용 적 20마리 (플레이어 주변 반경 200 내)
    const testEnemies = [];
    for (let i = 0; i < 20; i++) {
      const angle = (Math.PI * 2 * i) / 20;
      const dist = 60 + Math.random() * 140;
      testEnemies.push({
        id: `test-enemy-${i}`,
        position: { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist },
        velocity: { x: 0, y: 0 },
        radius: 12,
        color: i < 3 ? '#ff4444' : '#44aaff',
        health: 100,
        maxHealth: 100,
        damage: 10,
        speed: 30,
        enemyType: i < 3 ? 2 : 1, // 2=big, 1=normal
        state: 'chasing' as const,
        stunTimer: 0,
        mass: 1,
        hitBy: new Set<string>(),
        isBoss: i === 0,
        isFrozen: false,
        skillCooldown: 0,
        name: i === 0 ? 'TEST BOSS' : undefined,
      });
    }
    refs.enemies.current = testEnemies as any;

    // 테스트용 XP 잼 50개
    const testGems = [];
    for (let i = 0; i < 50; i++) {
      testGems.push({
        id: `test-gem-${i}`,
        position: {
          x: (Math.random() - 0.5) * 400,
          y: (Math.random() - 0.5) * 400,
        },
        value: [1, 5, 10, 20, 50][Math.floor(Math.random() * 5)],
        color: '#44ff88',
        isCollected: false,
      });
    }
    refs.gems.current = testGems;

    // 테스트용 픽업 아이템 10개
    const pickupTypes = ['chicken', 'chest', 'bomb', 'magnet', 'upgrade_material'];
    const testPickups = [];
    for (let i = 0; i < 10; i++) {
      testPickups.push({
        id: `test-pickup-${i}`,
        type: pickupTypes[i % pickupTypes.length],
        position: {
          x: (Math.random() - 0.5) * 300,
          y: (Math.random() - 0.5) * 300,
        },
        life: 10,
        maxLife: 10,
        radius: 15,
        magnetRange: 100,
        isCollected: false,
      });
    }
    refs.pickups.current = testPickups as any;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // === 게임 루프 (WASD 이동 + 적 AI + 플레이어 자동공격 + 잼 자석 + 전투 시스템) ===
  const updateRef = useRef((_dt: number) => {});
  useMemo(() => {
    updateRef.current = (dt: number) => {
      const player = refs.player.current;
      const keys = refs.keysPressed.current;

      // WASD 이동
      let dx = 0, dy = 0;
      if (keys.has('w') || keys.has('arrowup')) dy -= 1;
      if (keys.has('s') || keys.has('arrowdown')) dy += 1;
      if (keys.has('a') || keys.has('arrowleft')) dx -= 1;
      if (keys.has('d') || keys.has('arrowright')) dx += 1;

      // 대각선 정규화
      if (dx !== 0 && dy !== 0) {
        const inv = 1 / Math.SQRT2;
        dx *= inv;
        dy *= inv;
      }

      player.velocity.x = dx * PLAYER_SPEED;
      player.velocity.y = dy * PLAYER_SPEED;
      player.position.x += player.velocity.x * dt;
      player.position.y += player.velocity.y * dt;

      // facing 방향 업데이트 (캐릭터 회전용)
      if (dx !== 0 || dy !== 0) {
        refs.lastMoveFacing.current = { x: dx, y: dy };
        refs.lastFacing.current = { x: dx, y: dy };
      }

      // === 플레이어 자동 공격 (가장 가까운 적 타겟팅) ===
      playerAttackTimerRef.current -= dt;
      if (playerAttackTimerRef.current <= 0) {
        let closestEnemy: (typeof refs.enemies.current)[number] | null = null;
        let closestDist = PLAYER_ATTACK_RANGE;

        for (const enemy of refs.enemies.current) {
          const edx = enemy.position.x - player.position.x;
          const edy = enemy.position.y - player.position.y;
          const d = Math.sqrt(edx * edx + edy * edy);
          if (d < closestDist) {
            closestDist = d;
            closestEnemy = enemy;
          }
        }

        if (closestEnemy) {
          playerAttackTimerRef.current = PLAYER_ATTACK_COOLDOWN;

          // 크리티컬 판정
          const isCritical = Math.random() < (player.criticalChance ?? 0.05);
          const dmg = Math.round(PLAYER_ATTACK_DAMAGE * (isCritical ? (player.criticalMultiplier ?? 2.0) : 1.0));

          // 적 데미지
          closestEnemy.health -= dmg;

          // 적 넉백 (플레이어 반대 방향)
          const edx = closestEnemy.position.x - player.position.x;
          const edy = closestEnemy.position.y - player.position.y;
          const eDist = Math.sqrt(edx * edx + edy * edy);
          if (eDist > 0.1) {
            closestEnemy.position.x += (edx / eDist) * PLAYER_KNOCKBACK * dt * 10;
            closestEnemy.position.y += (edy / eDist) * PLAYER_KNOCKBACK * dt * 10;
          }

          // v39 Phase 3: 적 hit flash 트리거
          hitFlashMapRef.current.set(closestEnemy.id, ENEMY_HIT_FLASH_DURATION);

          // v39 Phase 3: 공격 이벤트 → SwingArc에 전달
          const facing = refs.lastFacing.current;
          attackEventsRef.current.push({
            position: { x: player.position.x, y: player.position.y },
            direction: { x: facing.x, y: facing.y },
            isCritical,
            timestamp: Date.now(),
          });

          // 데미지 넘버 (적 위치에 표시)
          refs.damageNumbers.current.push({
            id: `pdmg-${Date.now()}-${Math.random()}`,
            position: { x: closestEnemy.position.x, y: closestEnemy.position.y },
            value: dmg,
            color: isCritical ? '#ffdd00' : '#ffffff',
            life: 1.0,
            maxLife: 1.0,
            isCritical,
            velocity: { x: (Math.random() - 0.5) * 40, y: -60 },
          });

          // 화면 쉐이크 (작게)
          refs.screenShakeTimer.current = Math.max(refs.screenShakeTimer.current, 0.08);
          refs.screenShakeIntensity.current = Math.max(refs.screenShakeIntensity.current, 0.1);

          // 크리티컬: 화면 플래시
          if (isCritical) {
            refs.screenShakeTimer.current = Math.max(refs.screenShakeTimer.current, 0.15);
            refs.screenShakeIntensity.current = Math.max(refs.screenShakeIntensity.current, 0.25);
          }
        }
      }

      // === 적 사망 처리 + gem 드롭 + 사망 파티클 ===
      refs.enemies.current = refs.enemies.current.filter(enemy => {
        if (enemy.health <= 0) {
          // v39 Phase 3: 사망 이벤트 → DeathParticles에 전달
          deathEventsRef.current.push({
            position: { x: enemy.position.x, y: enemy.position.y },
            color: enemy.color || (enemy.isBoss ? '#ff4444' : '#44aaff'),
            isBoss: enemy.isBoss,
          });

          // gem 드롭
          const gemValue = enemy.isBoss ? 50 : (Number(enemy.enemyType) >= 2 ? 20 : 10);
          refs.gems.current.push({
            id: `gem-drop-${Date.now()}-${Math.random()}`,
            position: { x: enemy.position.x, y: enemy.position.y },
            value: gemValue,
            color: enemy.isBoss ? '#ffdd00' : '#44ff88',
            isCollected: false,
          });

          // 점수 추가
          player.score += gemValue;

          // hit flash map 정리
          hitFlashMapRef.current.delete(enemy.id);

          // 화면 쉐이크 (적 사망 시)
          refs.screenShakeTimer.current = Math.max(refs.screenShakeTimer.current, 0.1);
          refs.screenShakeIntensity.current = Math.max(refs.screenShakeIntensity.current, enemy.isBoss ? 0.4 : 0.15);

          return false; // 제거
        }
        return true;
      });

      // === v39 Phase 3: 적 hit flash 타이머 감소 ===
      for (const [id, timer] of hitFlashMapRef.current.entries()) {
        const newTimer = timer - dt;
        if (newTimer <= 0) {
          hitFlashMapRef.current.delete(id);
        } else {
          hitFlashMapRef.current.set(id, newTimer);
        }
      }

      // === v39 Phase 3: 적 리스폰 시스템 ===
      respawnTimerRef.current -= dt;
      if (respawnTimerRef.current <= 0) {
        respawnTimerRef.current = RESPAWN_CHECK_INTERVAL;

        if (refs.enemies.current.length < MIN_ENEMY_COUNT) {
          const spawnCount = Math.min(
            RESPAWN_BATCH_SIZE,
            TARGET_ENEMY_COUNT - refs.enemies.current.length
          );

          for (let i = 0; i < spawnCount; i++) {
            // 플레이어 주변 120~250 거리에 스폰
            const angle = Math.random() * Math.PI * 2;
            const dist = 120 + Math.random() * 130;
            const isBig = Math.random() < 0.2;
            const isBoss = Math.random() < 0.05;
            _enemyIdCounter++;

            refs.enemies.current.push({
              id: `respawn-enemy-${_enemyIdCounter}`,
              position: {
                x: player.position.x + Math.cos(angle) * dist,
                y: player.position.y + Math.sin(angle) * dist,
              },
              velocity: { x: 0, y: 0 },
              radius: 12,
              color: isBoss ? '#ff4444' : isBig ? '#ff6644' : '#44aaff',
              health: isBoss ? 250 : isBig ? 150 : 100,
              maxHealth: isBoss ? 250 : isBig ? 150 : 100,
              damage: isBoss ? 20 : isBig ? 15 : 10,
              speed: isBoss ? 20 : isBig ? 25 : 30,
              enemyType: isBoss ? 3 : isBig ? 2 : 1,
              state: 'chasing' as const,
              stunTimer: 0,
              mass: 1,
              hitBy: new Set<string>(),
              isBoss,
              isFrozen: false,
              skillCooldown: 0,
              name: isBoss ? 'BOSS' : undefined,
            } as any);
          }
        }
      }

      // 적 AI: 플레이어 추적 + 공격
      for (const enemy of refs.enemies.current) {
        const ex = enemy.position.x - player.position.x;
        const ey = enemy.position.y - player.position.y;
        const dist = Math.sqrt(ex * ex + ey * ey);

        if (dist > ENEMY_ATTACK_RANGE) {
          // 추적: 플레이어를 향해 이동
          const nx = -ex / dist;
          const ny = -ey / dist;
          enemy.position.x += nx * enemy.speed * dt;
          enemy.position.y += ny * enemy.speed * dt;
          enemy.velocity.x = nx * enemy.speed;
          enemy.velocity.y = ny * enemy.speed;
        } else {
          // 공격 범위 진입: 데미지 + 넉백 + 데미지 넘버
          enemy.velocity.x = 0;
          enemy.velocity.y = 0;
          enemy.skillCooldown -= dt;

          if (enemy.skillCooldown <= 0) {
            enemy.skillCooldown = ENEMY_ATTACK_COOLDOWN;

            // 플레이어 데미지 (무적 아닌 경우)
            if (player.invulnerabilityTimer <= 0) {
              player.health = Math.max(0, player.health - enemy.damage);
              player.hitFlashTimer = 0.15;
              player.invulnerabilityTimer = 0.5;

              // 넉백
              if (dist > 0.1) {
                player.knockback.x = (ex / dist) * ENEMY_KNOCKBACK_FORCE;
                player.knockback.y = (ey / dist) * ENEMY_KNOCKBACK_FORCE;
              }

              // 화면 쉐이크
              refs.screenShakeTimer.current = 0.2;
              refs.screenShakeIntensity.current = 0.3;

              // 데미지 넘버
              refs.damageNumbers.current.push({
                id: `dmg-${Date.now()}-${Math.random()}`,
                position: { x: player.position.x, y: player.position.y },
                value: enemy.damage,
                color: '#ff4444',
                life: 1.0,
                maxLife: 1.0,
                isCritical: false,
                velocity: { x: (Math.random() - 0.5) * 40, y: -60 },
              });
            }
          }
        }
      }

      // 무적 타이머 감소
      if (player.invulnerabilityTimer > 0) {
        player.invulnerabilityTimer -= dt;
      }

      // 넉백 적용 + 감쇠
      if (Math.abs(player.knockback.x) > 0.1 || Math.abs(player.knockback.y) > 0.1) {
        player.position.x += player.knockback.x * dt;
        player.position.y += player.knockback.y * dt;
        player.knockback.x *= 0.9;
        player.knockback.y *= 0.9;
      }

      // Hit flash 감소
      if (player.hitFlashTimer > 0) {
        player.hitFlashTimer -= dt;
      }

      // 화면 쉐이크 감쇠
      if (refs.screenShakeTimer.current > 0) {
        refs.screenShakeTimer.current -= dt;
        refs.screenShakeIntensity.current *= 0.92;
      }

      // 잼 자석 수집
      refs.gems.current = refs.gems.current.filter(gem => {
        if (gem.isCollected) return false;
        const gdx = gem.position.x - player.position.x;
        const gdy = gem.position.y - player.position.y;
        const gd = Math.sqrt(gdx * gdx + gdy * gdy);
        if (gd < GEM_COLLECT_RANGE) {
          // 수집: XP 추가
          player.xp += gem.value;
          player.score += gem.value;
          return false; // 제거
        }
        // 자석 범위: 플레이어 방향으로 끌어당기기
        if (gd < GEM_MAGNET_RANGE && gd > 1) {
          gem.position.x -= (gdx / gd) * 200 * dt;
          gem.position.y -= (gdy / gd) * 200 * dt;
        }
        return true;
      });

      // Screen Flash 업데이트
      updateFlash(dt);
    };
  }, [refs.player, refs.keysPressed, refs.enemies, refs.gems, refs.lastMoveFacing, refs.lastFacing, refs.damageNumbers, refs.screenShakeTimer, refs.screenShakeIntensity, updateFlash]);

  useGameLoop({
    gameActive,
    update: (dt: number) => updateRef.current(dt),
    render: null, // 3D 모드: R3F가 자체 렌더링
  });

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* R3F 3D Canvas */}
      <Canvas
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
        }}
        orthographic
        camera={{
          zoom: 50,
          position: [800, 800, 800],
          near: 0.1,
          far: 5000,
        }}
        dpr={[1, Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2)]}
        frameloop="always"
        shadows="basic"
        style={{
          position: 'absolute',
          inset: 0,
          background: '#87CEAA',
        }}
      >
        <SceneContent
          refs={refs}
          warningIntensityRef={warningIntensityRef}
          attackEventsRef={attackEventsRef}
          deathEventsRef={deathEventsRef}
          hitFlashMapRef={hitFlashMapRef}
        />
      </Canvas>

      {/* Phase 5: Screen Flash Overlay (S33) — DOM 기반 */}
      <ScreenFlashOverlay flashRef={flashRef} />

      {/* Phase 6: HUD Overlay (S39) — 기존 React HUD 컴포넌트 그대로 overlay */}
      {/* MatrixApp에서 HUD props를 전달받아 여기에 렌더링 */}
      {/* 현재는 슬롯만 준비 — 실제 HUD는 MatrixApp에서 조건부 렌더링 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 20,
        }}
        className="matrix-scene-hud-overlay"
      >
        {/* 모바일 조이스틱 overlay 영역 */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '40%',
            pointerEvents: 'auto',
          }}
          className="matrix-scene-joystick-area"
        />
      </div>
    </div>
  );
}

export default MatrixScene;
