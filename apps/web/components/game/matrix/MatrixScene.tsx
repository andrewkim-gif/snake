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
import { Canvas, useFrame } from '@react-three/fiber';
import { useGameRefs, type GameRefs } from '@/lib/matrix/hooks/useGameRefs';
import type { Enemy } from '@/lib/matrix/types';
import { useBlockWeapons } from '@/lib/matrix/hooks/useBlockWeapons';
import { getBlockWeaponStats } from '@/lib/matrix/config/block-weapon-stats';
import { XP_THRESHOLDS } from '@/lib/matrix/config/index';
import { setMCTerrainSeed, invalidateHeightCache } from '@/lib/matrix/rendering3d/mc-terrain-height';
import {
  getCurrentWaveStage,
  getCurrentPhaseName,
  getScaledEnemyStats,
  checkEliteSpawn,
  ELITE_CONFIGS,
  type WavePhaseName,
  type EliteSpawnConfig,
} from '@/lib/matrix/config/wave-system.config';
import { GameLighting } from './3d/GameLighting';
import MCGameCamera from './3d/MCGameCamera';
import MCVoxelTerrain from './3d/MCVoxelTerrain';
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
// Phase 2 (v42): 블록 좌표 무기 3D 렌더러
import BlockSkillWeapons from './3d/weapons/BlockSkillWeapons';
import BlockRangedWeapons from './3d/weapons/BlockRangedWeapons';
import BlockMeleeWeapons from './3d/weapons/BlockMeleeWeapons';
// Phase 4 (HUD Integration): DOM Overlay HUD 컴포넌트
import { GameHUD3D } from './3d/GameHUD3D';
import { Minimap3D } from './3d/Minimap3D';
import { WeaponSlots3D } from './3d/WeaponSlots3D';
import { MobileControls3D } from './3d/MobileControls3D';

/**
 * MatrixSceneProps — Phase 0 최소 props
 * Phase 1+에서 전체 MatrixCanvasProps로 확장 예정
 */
export interface MatrixSceneProps {
  /** 게임 활성 상태 */
  gameActive: boolean;
  /** 외부에서 주입하는 GameRefs (MatrixApp에서 공유 시) */
  gameRefs?: GameRefs;
  /** 블록 좌표 무기 시스템 tick (GameLogic useFrame에서 호출) — 외부 주입 시 사용 */
  blockWeaponsTick?: (dt: number) => void;
  /** v42 Phase 3: 레벨업 중 게임 일시정지 */
  pausedRef?: React.MutableRefObject<boolean>;
  /** v42 Phase 3: 적 처치 콜백 (콤보/XP 처리) */
  onEnemyKill?: (enemy: Enemy) => void;
  /** v42 Phase 3: XP 임계값 도달 시 레벨업 콜백 (player.level, player.xp 전달) */
  onLevelUp?: (level: number) => void;
  /** v42 Phase 3: useSkillBuild의 playerSkills (weapon→level 맵) — 변경 시 player.weapons 동기화 */
  playerSkillsMap?: Map<string, number>;
  /** v42 Phase 4: 콤보 데미지 배율 ref (useCombo.getMultipliers().damage) */
  comboDamageMultiplierRef?: React.MutableRefObject<number>;
  /** v42 Phase 4: 콤보 XP 배율 ref (useCombo.getMultipliers().xp) */
  comboXpMultiplierRef?: React.MutableRefObject<number>;
  /** v42 Phase 4: 킬 카운트 ref (엘리트 스폰 트리거용) */
  killCountRef?: React.MutableRefObject<number>;
  /** v42 Phase 4: Wave 페이즈 전환 콜백 */
  onPhaseChange?: (phase: WavePhaseName) => void;
  /** v42 Phase 4: 엘리트 스폰 콜백 (HUD 알림용) */
  onEliteSpawn?: (config: EliteSpawnConfig) => void;
  /** v42 Phase 4: 콤보 타이머 업데이트 (매 프레임 호출 — 콤보 decay 처리) */
  comboUpdate?: (dt: number) => void;
  /** v42 Phase 5: 궁극기 해금 여부 ref */
  ultimateUnlockedRef?: React.MutableRefObject<boolean>;
  /** v42 Phase 5: 궁극기 쿨다운 ref (초 단위, 0이면 발동 가능) */
  ultimateCooldownRef?: React.MutableRefObject<number>;
}

/** MC seed (MCGameCamera + MCVoxelTerrain 공유) */
const MC_SEED = 42;

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
  playerAttackTimerRef,
  respawnTimerRef,
  deathRespawnTimerRef,
  updateFlash,
  blockWeaponsTick,
  pausedRef,
  onEnemyKill,
  onLevelUp,
  comboXpMultiplierRef,
  killCountRef,
  onPhaseChange,
  onEliteSpawn,
  comboUpdate,
  ultimateUnlockedRef,
  ultimateCooldownRef,
  triggerFlash,
  gameSpeedRef,
  slowmoTimerRef,
}: {
  refs: GameRefs;
  warningIntensityRef: React.MutableRefObject<number>;
  attackEventsRef: React.MutableRefObject<AttackEvent[]>;
  deathEventsRef: React.MutableRefObject<DeathEvent[]>;
  hitFlashMapRef: React.MutableRefObject<Map<string, number>>;
  playerAttackTimerRef: React.MutableRefObject<number>;
  respawnTimerRef: React.MutableRefObject<number>;
  deathRespawnTimerRef: React.MutableRefObject<number>;
  updateFlash: (dt: number) => void;
  blockWeaponsTick: (dt: number) => void;
  /** v42 Phase 3: 일시정지 ref */
  pausedRef?: React.MutableRefObject<boolean>;
  /** v42 Phase 3: 적 처치 콜백 */
  onEnemyKill?: (enemy: Enemy) => void;
  /** v42 Phase 3: XP 임계값 도달 시 레벨업 콜백 */
  onLevelUp?: (level: number) => void;
  /** v42 Phase 4: 콤보 XP 배율 ref */
  comboXpMultiplierRef?: React.MutableRefObject<number>;
  /** v42 Phase 4: 킬 카운트 ref */
  killCountRef?: React.MutableRefObject<number>;
  /** v42 Phase 4: Wave 페이즈 전환 콜백 */
  onPhaseChange?: (phase: WavePhaseName) => void;
  /** v42 Phase 4: 엘리트 스폰 콜백 */
  onEliteSpawn?: (config: EliteSpawnConfig) => void;
  /** v42 Phase 4: 콤보 타이머 업데이트 함수 */
  comboUpdate?: (dt: number) => void;
  /** v42 Phase 5: 궁극기 해금 ref */
  ultimateUnlockedRef?: React.MutableRefObject<boolean>;
  /** v42 Phase 5: 궁극기 쿨다운 ref */
  ultimateCooldownRef?: React.MutableRefObject<number>;
  /** v44: 화면 플래시 트리거 */
  triggerFlash?: (options?: { color?: string; intensity?: number; decayRate?: number }) => void;
  /** v44: 게임 속도 ref (슬로모) */
  gameSpeedRef?: React.MutableRefObject<number>;
  /** v44: 슬로모 타이머 ref */
  slowmoTimerRef?: React.MutableRefObject<number>;
}) {
  return (
    <>
      {/* 게임 로직 — useFrame 직접 실행 (전투 AI/아이템 수집만, WASD 제거) */}
      <GameLogic
        refs={refs}
        attackEventsRef={attackEventsRef}
        deathEventsRef={deathEventsRef}
        hitFlashMapRef={hitFlashMapRef}
        playerAttackTimerRef={playerAttackTimerRef}
        respawnTimerRef={respawnTimerRef}
        deathRespawnTimerRef={deathRespawnTimerRef}
        updateFlash={updateFlash}
        blockWeaponsTick={blockWeaponsTick}
        pausedRef={pausedRef}
        onEnemyKill={onEnemyKill}
        onLevelUp={onLevelUp}
        comboXpMultiplierRef={comboXpMultiplierRef}
        killCountRef={killCountRef}
        onPhaseChange={onPhaseChange}
        onEliteSpawn={onEliteSpawn}
        comboUpdate={comboUpdate}
        ultimateUnlockedRef={ultimateUnlockedRef}
        ultimateCooldownRef={ultimateCooldownRef}
        triggerFlash={triggerFlash}
        gameSpeedRef={gameSpeedRef}
        slowmoTimerRef={slowmoTimerRef}
      />

      {/* 배경색 — MC 하늘색 */}
      <color attach="background" args={['#87ceeb']} />

      {/* 안개 — 산봉우리(75블록)가 보이도록 far 확장, 가장자리 자연 페이드 */}
      <fog attach="fog" args={['#87ceeb', 70, 130]} />

      {/* 3인칭 팔로우 카메라 — 마우스 드래그 회전 + WASD 이동 + MC 지형 추적 + v44 쉐이크 */}
      <MCGameCamera
        playerRef={refs.player}
        screenShakeTimerRef={refs.screenShakeTimer}
        screenShakeIntensityRef={refs.screenShakeIntensity}
      />

      {/* 조명 — MC 스타일 */}
      <GameLighting />

      {/* MC 블록 월드 — InstancedMesh + MCNoise 청크 */}
      <MCVoxelTerrain
        seed={MC_SEED}
        playerRef={refs.player}
      />

      {/* Pickup 아이템 (XP Orb + Item Drop) */}
      <PickupRenderer
        gemsRef={refs.gems}
        pickupsRef={refs.pickups}
        playerRef={refs.player}
      />

      {/* 플레이어 캐릭터 (3인칭 시점 — 스킬/전투 연출용) */}
      <VoxelCharacter
        playerRef={refs.player}
        playerClass={refs.player.current.playerClass ?? 'neo'}
      />

      {/* 적 렌더러 (InstancedMesh) + hit flash + v44 투사체 */}
      <EnemyRenderer
        enemiesRef={refs.enemies}
        playerRef={refs.player}
        hitFlashMapRef={hitFlashMapRef}
        enemyProjectilesRef={refs.enemyProjectiles}
      />

      {/* 근접 공격 Swing Arc 이펙트 */}
      <SwingArc
        playerRef={refs.player}
        attackEventsRef={attackEventsRef}
        facingRef={refs.lastFacing}
      />

      {/* 적 사망 파편 폭발 (v44: 스파크 레이어 + 슬로모 연동) */}
      <DeathParticles deathEventsRef={deathEventsRef} gameSpeedRef={gameSpeedRef} />

      {/* v42 Phase 2: 블록 좌표 무기 3D 렌더러 (투사체 시각화) */}
      <BlockRangedWeapons projectilesRef={refs.projectiles} />
      <BlockMeleeWeapons projectilesRef={refs.projectiles} />
      <BlockSkillWeapons projectilesRef={refs.projectiles} />

      {/* 파티클 시스템 */}
      <ParticleSystem qualityTier="HIGH" />

      {/* 안전지대 3D */}
      <SafeZone3D
        playerRef={refs.player}
        warningIntensityRef={warningIntensityRef}
      />

      {/* World UI — 데미지 넘버 + HP바/네임태그 */}
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

      {/* v42 Phase 5: 후처리 이펙트 활성화 — Bloom + Vignette (HIGH 품질) */}
      <PostProcessingEffects qualityTier="HIGH" warningIntensityRef={warningIntensityRef} />
    </>
  );
}

// ============================================
// 전투 상수
// ============================================

// MC 블록 스케일 전투 상수 (1 block = 1 unit)
// v42: PLAYER_ATTACK_RANGE/COOLDOWN/DAMAGE/KNOCKBACK 제거 → useBlockWeapons로 교체
const ENEMY_ATTACK_RANGE = 3;         // 적 공격 사거리 (MC 블록 3개)
const ENEMY_ATTACK_COOLDOWN = 0.8;    // 적 공격 쿨다운 (초)
const ENEMY_KNOCKBACK_FORCE = 3;      // 적→플레이어 넉백
const ENEMY_ORBIT_SPEED = 1.2;        // 적 공격 중 공전 속도 (rad/s)

// v44: 원거리 적 AI 상수
const RANGED_MIN_DIST = 6;            // 원거리 적 최소 유지 거리 (블록)
const RANGED_MAX_DIST = 8;            // 원거리 적 최대 유지 거리 (블록)
const RANGED_IDEAL_DIST = 7;          // 원거리 적 이상적 거리
const RANGED_RETREAT_DIST = 4;        // 이 거리 이하면 후퇴
const RANGED_PROJECTILE_SPEED = 5;    // 투사체 속도 (blocks/s, 기본값)
const RANGED_PROJECTILE_COOLDOWN = 2; // 투사체 발사 쿨다운 (초, 기본값)
const RANGED_PROJECTILE_LIFE = 5;     // 투사체 수명 (초)
const RANGED_PROJECTILE_RADIUS = 0.3; // 투사체 반경

// v44: 돌진 적 AI 상수
const CHARGE_TRIGGER_DIST = 10;       // 돌진 시작 거리 (블록)
const CHARGE_PREP_TIME = 1.0;         // 돌진 준비 시간 (초)
const CHARGE_SPEED_MULT = 3.0;        // 돌진 속도 배율
const CHARGE_MAX_DIST = 15;           // 돌진 최대 거리 (블록)
const CHARGE_COOLDOWN = 2.0;          // 돌진 후 쿨다운 (초)

// v44: 적 투사체 상수
const ENEMY_PROJ_HIT_RANGE = 1.5;     // 적 투사체 플레이어 히트 범위
const MAX_ENEMY_PROJECTILES = 50;     // 적 투사체 최대 수

const GEM_COLLECT_RANGE = 3;          // 잼 수집 범위 (MC 블록 3개)
const GEM_MAGNET_RANGE = 8;           // 잼 자석 범위
const ENEMY_HIT_FLASH_DURATION = 0.12;

// HP 회복/사망 설정
const HP_REGEN_PER_SEC = 5;           // 자동 HP 회복 (초당)
const INVULNERABILITY_DURATION = 1.5; // 무적 시간 (초)
const DEATH_RESPAWN_DELAY = 3.0;      // 사망 후 자동 부활 대기 (초)

// 리스폰 설정
const MIN_ENEMY_COUNT = 8;            // 이 수 이하로 떨어지면 리스폰
const TARGET_ENEMY_COUNT = 20;        // 리스폰 목표 적 수
const RESPAWN_CHECK_INTERVAL = 2.0;   // 리스폰 체크 주기 (초)
const RESPAWN_BATCH_SIZE = 4;         // 한 번에 리스폰할 적 수

/** 적 ID 카운터 */
let _enemyIdCounter = 100;

// ============================================
// GameLogic — useFrame 기반 게임 루프 (Canvas 내부)
// ============================================

interface GameLogicProps {
  refs: GameRefs;
  attackEventsRef: React.MutableRefObject<AttackEvent[]>;
  deathEventsRef: React.MutableRefObject<DeathEvent[]>;
  hitFlashMapRef: React.MutableRefObject<Map<string, number>>;
  playerAttackTimerRef: React.MutableRefObject<number>;
  respawnTimerRef: React.MutableRefObject<number>;
  deathRespawnTimerRef: React.MutableRefObject<number>;
  updateFlash: (dt: number) => void;
  /** v42: 블록 좌표 무기 시스템 tick */
  blockWeaponsTick: (dt: number) => void;
  /** v42 Phase 3: 일시정지 ref */
  pausedRef?: React.MutableRefObject<boolean>;
  /** v42 Phase 3: 적 처치 콜백 */
  onEnemyKill?: (enemy: Enemy) => void;
  /** v42 Phase 3: XP 임계값 도달 시 레벨업 콜백 */
  onLevelUp?: (level: number) => void;
  /** v42 Phase 4: 콤보 XP 배율 ref */
  comboXpMultiplierRef?: React.MutableRefObject<number>;
  /** v42 Phase 4: 킬 카운트 ref (엘리트 스폰 트리거) */
  killCountRef?: React.MutableRefObject<number>;
  /** v42 Phase 4: Wave 페이즈 전환 콜백 */
  onPhaseChange?: (phase: WavePhaseName) => void;
  /** v42 Phase 4: 엘리트 스폰 콜백 */
  onEliteSpawn?: (config: EliteSpawnConfig) => void;
  /** v42 Phase 4: 콤보 타이머 업데이트 함수 (매 프레임 호출) */
  comboUpdate?: (dt: number) => void;
  /** v42 Phase 5: 궁극기 해금 ref */
  ultimateUnlockedRef?: React.MutableRefObject<boolean>;
  /** v42 Phase 5: 궁극기 쿨다운 ref */
  ultimateCooldownRef?: React.MutableRefObject<number>;
  /** v44: 화면 플래시 트리거 함수 */
  triggerFlash?: (options?: { color?: string; intensity?: number; decayRate?: number }) => void;
  /** v44: 게임 속도 ref (슬로모 시스템) */
  gameSpeedRef?: React.MutableRefObject<number>;
  /** v44: 슬로모 타이머 ref */
  slowmoTimerRef?: React.MutableRefObject<number>;
}

/**
 * GameLogic — useFrame 내부에서 직접 게임 로직 실행
 * Worker postMessage 비동기 대신 프레임 동기화된 직접 실행
 */
function GameLogic({
  refs,
  attackEventsRef,
  deathEventsRef,
  hitFlashMapRef,
  playerAttackTimerRef,
  respawnTimerRef,
  deathRespawnTimerRef,
  updateFlash,
  blockWeaponsTick,
  pausedRef,
  onEnemyKill,
  onLevelUp,
  comboXpMultiplierRef,
  killCountRef,
  onPhaseChange,
  onEliteSpawn,
  comboUpdate,
  ultimateUnlockedRef,
  ultimateCooldownRef,
  triggerFlash,
  gameSpeedRef,
  slowmoTimerRef,
}: GameLogicProps) {
  const prevTimeRef = useRef(performance.now());
  /** v42 Phase 4: 현재 Wave 페이즈 추적 (전환 감지용) */
  const currentPhaseRef = useRef<WavePhaseName>('SKIRMISH');
  /** v42 Phase 4: 마지막 엘리트 스폰 킬 카운트 */
  const lastEliteSpawnKillRef = useRef(0);

  useFrame(() => {
    // 프레임 시작: 지형 높이 캐시 갱신 (모든 컴포넌트가 공유)
    invalidateHeightCache();

    const now = performance.now();
    const realDt = Math.min((now - prevTimeRef.current) / 1000, 0.1);
    prevTimeRef.current = now;

    if (realDt <= 0) return;

    // === v44: 슬로모 시스템 업데이트 (실시간 dt 사용) ===
    if (gameSpeedRef && slowmoTimerRef) {
      if (slowmoTimerRef.current > 0) {
        slowmoTimerRef.current -= realDt;
        if (slowmoTimerRef.current <= 0) {
          slowmoTimerRef.current = 0;
          // smoothstep 복귀 시작 — 이미 타이머 만료, 즉시 1.0으로 복구
          gameSpeedRef.current = 1.0;
        }
      } else if (gameSpeedRef.current < 1.0) {
        // smoothstep 복귀: 0.2 → 1.0 over ~0.15초 (빠른 복귀)
        const t = Math.min(1, realDt / 0.15);
        // smoothstep: 3t^2 - 2t^3
        const smooth = t * t * (3 - 2 * t);
        gameSpeedRef.current = Math.min(1.0, gameSpeedRef.current + smooth * (1.0 - gameSpeedRef.current) + 0.05);
        if (gameSpeedRef.current > 0.98) gameSpeedRef.current = 1.0;
      }
    }

    // 게임 속도 적용된 dt (슬로모 영향)
    const gameSpeed = gameSpeedRef?.current ?? 1.0;
    const dt = realDt * gameSpeed;

    // v42 Phase 3: 일시정지 중에는 전체 게임 로직 스킵 (레벨업 UI 표시 중)
    if (pausedRef?.current) return;

    const player = refs.player.current;

    // === 사망 중: 적 공격 무시 + 부활 타이머 ===
    if (player.health <= 0) {
      deathRespawnTimerRef.current += realDt; // 부활 타이머는 realDt (슬로모 영향 X)
      if (deathRespawnTimerRef.current >= DEATH_RESPAWN_DELAY) {
        // 자동 부활: HP 100% + 위치 리셋 (현재 위치 유지, 무적 부여)
        player.health = player.maxHealth;
        player.invulnerabilityTimer = INVULNERABILITY_DURATION;
        player.hitFlashTimer = 0;
        player.knockback.x = 0;
        player.knockback.y = 0;
        deathRespawnTimerRef.current = 0;
      }
      // 사망 중에는 쉐이크/플래시만 감쇠시키고 나머지 로직 스킵
      if (refs.screenShakeTimer.current > 0) {
        refs.screenShakeTimer.current -= realDt;
        refs.screenShakeIntensity.current *= 0.92;
      }
      updateFlash(realDt);
      return;
    }

    // === HP 자동 회복 ===
    if (player.health < player.maxHealth) {
      player.health = Math.min(player.maxHealth, player.health + HP_REGEN_PER_SEC * dt);
    }

    // WASD 이동: MCGameCamera가 카메라 방향 기준으로 이동 후
    // player.position/velocity를 동기화해줌 → 여기서는 스킵
    // facing 방향: velocity 기반으로 업데이트
    const vx = player.velocity.x;
    const vy = player.velocity.y;
    if (Math.abs(vx) > 0.1 || Math.abs(vy) > 0.1) {
      const len = Math.sqrt(vx * vx + vy * vy);
      refs.lastMoveFacing.current = { x: vx / len, y: vy / len };
      refs.lastFacing.current = { x: vx / len, y: vy / len };
    }

    // === v42 Phase 4: 게임 시간 업데이트 (Wave 시스템용) ===
    refs.gameTime.current += dt;

    // === v42 Phase 4: Wave 페이즈 전환 감지 ===
    const currentGameTime = refs.gameTime.current;
    const newPhase = getCurrentPhaseName(currentGameTime);
    if (newPhase !== currentPhaseRef.current) {
      currentPhaseRef.current = newPhase;
      onPhaseChange?.(newPhase);
    }

    // === v42: 블록 좌표 무기 시스템 (기존 25dmg auto-attack 교체) ===
    blockWeaponsTick(dt);

    // === v42 Phase 5: 궁극기 자동 발동 (Lv.20+, 30초 쿨다운) ===
    if (ultimateUnlockedRef?.current && ultimateCooldownRef) {
      if (ultimateCooldownRef.current > 0) {
        ultimateCooldownRef.current -= dt;
      } else {
        // 궁극기 발동! 모든 적에 999 데미지
        ultimateCooldownRef.current = 30; // 30초 쿨다운 리셋
        const enemies = refs.enemies.current;
        for (const enemy of enemies) {
          if (enemy.health <= 0) continue;
          enemy.health -= 999;
          // 궁극기 데미지 넘버 (gold 색상, 크리티컬 사이즈)
          refs.damageNumbers.current.push({
            id: `ult-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            position: { x: enemy.position.x, y: enemy.position.y },
            value: 999,
            color: '#FFD700',
            life: 1.5,
            maxLife: 1.5,
            isCritical: true,
            velocity: { x: (Math.random() - 0.5) * 3, y: -4 },
          });
          // 히트 플래시
          hitFlashMapRef.current.set(enemy.id, 0.3);
        }
        // 대규모 화면 쉐이크 (궁극기 연출)
        refs.screenShakeTimer.current = 0.8;
        refs.screenShakeIntensity.current = 1.0;
      }
    }

    // === v42 Phase 4: 콤보 타이머 업데이트 (타임아웃 시 콤보 리셋) ===
    comboUpdate?.(dt);

    // === 적 사망 처리 + gem 드롭 ===
    refs.enemies.current = refs.enemies.current.filter(enemy => {
      if (enemy.health <= 0) {
        deathEventsRef.current.push({
          position: { x: enemy.position.x, y: enemy.position.y },
          color: enemy.color || (enemy.isBoss ? '#ff4444' : '#44aaff'),
          isBoss: enemy.isBoss,
          isElite: enemy.isElite,
          eliteTier: enemy.eliteTier,
        });

        // v42 Phase 4: 엘리트 적은 더 높은 XP 젬 드롭
        const gemValue = enemy.isElite
          ? (enemy.eliteTier === 'diamond' ? 300 : enemy.eliteTier === 'gold' ? 150 : 80)
          : enemy.isBoss ? 50 : (enemy.enemyType === 'whale' || enemy.enemyType === 'bot' ? 20 : 10);
        refs.gems.current.push({
          id: `gem-drop-${Date.now()}-${Math.random()}`,
          position: { x: enemy.position.x, y: enemy.position.y },
          value: gemValue,
          color: enemy.isElite ? '#00FFFF' : enemy.isBoss ? '#ffdd00' : '#44ff88',
          isCollected: false,
        });

        player.score += gemValue;
        hitFlashMapRef.current.delete(enemy.id);
        refs.screenShakeTimer.current = Math.max(refs.screenShakeTimer.current, enemy.isElite ? 0.5 : enemy.isBoss ? 0.3 : 0.1);
        refs.screenShakeIntensity.current = Math.max(refs.screenShakeIntensity.current, enemy.isElite ? 0.7 : enemy.isBoss ? 0.4 : 0.15);

        // v44: 보스/엘리트 사망 시 화면 플래시 + 슬로모 트리거
        if (enemy.isElite && triggerFlash) {
          // 엘리트: 티어별 색상 플래시
          const tierFlashColors: Record<string, string> = {
            silver: '#C0C0C0',
            gold: '#FFD700',
            diamond: '#00FFFF',
          };
          const flashColor = enemy.eliteTier ? tierFlashColors[enemy.eliteTier] ?? '#ffffff' : '#ffffff';
          triggerFlash({ color: flashColor, intensity: 0.8, decayRate: 4.0 });
          // 엘리트 슬로모
          if (gameSpeedRef && slowmoTimerRef) {
            gameSpeedRef.current = 0.2;
            slowmoTimerRef.current = 0.3;
          }
        } else if (enemy.isBoss && triggerFlash) {
          // 보스: 흰색 플래시 (강하게)
          triggerFlash({ color: '#ffffff', intensity: 0.8, decayRate: 3.0 });
          // 보스 슬로모
          if (gameSpeedRef && slowmoTimerRef) {
            gameSpeedRef.current = 0.2;
            slowmoTimerRef.current = 0.3;
          }
        }

        // v42 Phase 4: 엘리트 처치 시 특수 드롭 (pickup)
        if (enemy.isElite && enemy.eliteTier) {
          const eliteCfg = ELITE_CONFIGS.find(c => c.tier === enemy.eliteTier);
          if (eliteCfg) {
            for (const dropType of eliteCfg.drops) {
              refs.pickups.current.push({
                id: `elite-drop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                type: dropType,
                position: {
                  x: enemy.position.x + (Math.random() - 0.5) * 3,
                  y: enemy.position.y + (Math.random() - 0.5) * 3,
                },
                life: 15,
                radius: 1,
              } as any);
            }
          }
        }

        // v42 Phase 3: 적 처치 콜백 (콤보/XP 처리)
        onEnemyKill?.(enemy);

        return false;
      }
      return true;
    });

    // === 적 hit flash 타이머 감소 ===
    for (const [id, timer] of hitFlashMapRef.current.entries()) {
      const newTimer = timer - dt;
      if (newTimer <= 0) {
        hitFlashMapRef.current.delete(id);
      } else {
        hitFlashMapRef.current.set(id, newTimer);
      }
    }

    // === 적 리스폰 시스템 (v42 Phase 4: Wave 난이도 연동) ===
    const waveStage = getCurrentWaveStage(currentGameTime);
    const waveMaxEnemies = Math.round(TARGET_ENEMY_COUNT * waveStage.maxEnemyMultiplier);
    const waveSpawnInterval = RESPAWN_CHECK_INTERVAL * waveStage.spawnRateMultiplier;

    respawnTimerRef.current -= dt;
    if (respawnTimerRef.current <= 0) {
      respawnTimerRef.current = waveSpawnInterval;

      if (refs.enemies.current.length < Math.round(MIN_ENEMY_COUNT * waveStage.maxEnemyMultiplier)) {
        const spawnCount = Math.min(
          RESPAWN_BATCH_SIZE,
          waveMaxEnemies - refs.enemies.current.length
        );

        // Wave 단계에 맞는 적 타입 풀에서 랜덤 선택
        const enemyTypePool = waveStage.enemyTypes;

        for (let i = 0; i < spawnCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          const dist = 15 + Math.random() * 25; // MC 블록 스케일 (15~40 블록)
          const selectedType = enemyTypePool[Math.floor(Math.random() * enemyTypePool.length)];
          const scaledStats = getScaledEnemyStats(selectedType, waveStage);
          const isBoss = selectedType === 'whale';
          _enemyIdCounter++;

          refs.enemies.current.push({
            id: `respawn-enemy-${_enemyIdCounter}`,
            position: {
              x: player.position.x + Math.cos(angle) * dist,
              y: player.position.y + Math.sin(angle) * dist,
            },
            velocity: { x: 0, y: 0 },
            radius: 1,
            color: scaledStats.color,
            health: scaledStats.hp,
            maxHealth: scaledStats.hp,
            damage: scaledStats.damage,
            speed: scaledStats.speed,
            enemyType: selectedType,
            state: 'chasing' as const,
            stunTimer: 0,
            mass: 1,
            hitBy: new Set<string>(),
            isBoss,
            isFrozen: false,
            skillCooldown: 0,
            name: isBoss ? 'BOSS' : undefined,
            // v44: 행동 패턴 및 관련 필드
            behaviorType: scaledStats.behaviorType ?? 'chase',
            attackType: scaledStats.behaviorType === 'ranged' ? 'ranged' as const : 'melee' as const,
            projectileSpeed: scaledStats.projectileSpeed,
            projectileColor: scaledStats.projectileColor ?? '#ff4400',
            currentAttackCooldown: scaledStats.projectileCooldown ?? RANGED_PROJECTILE_COOLDOWN,
            // v44: 돌진 적 초기화
            chargeState: scaledStats.behaviorType === 'charge' ? 'idle' as const : undefined,
            chargeTimer: 0,
            chargeCooldown: 0,
          } as any);
        }
      }
    }

    // === v42 Phase 4: 엘리트 몬스터 스폰 체크 ===
    if (killCountRef) {
      const currentKills = killCountRef.current;
      if (currentKills > lastEliteSpawnKillRef.current && currentKills % 100 === 0 && currentKills > 0) {
        const eliteConfig = checkEliteSpawn(currentKills);
        if (eliteConfig) {
          lastEliteSpawnKillRef.current = currentKills;
          // 엘리트 적 스폰 (플레이어 근처 10~20 블록)
          const eAngle = Math.random() * Math.PI * 2;
          const eDist = 10 + Math.random() * 10;
          const baseStats = getScaledEnemyStats('whale', waveStage);
          _enemyIdCounter++;

          refs.enemies.current.push({
            id: `elite-${eliteConfig.tier}-${_enemyIdCounter}`,
            position: {
              x: player.position.x + Math.cos(eAngle) * eDist,
              y: player.position.y + Math.sin(eAngle) * eDist,
            },
            velocity: { x: 0, y: 0 },
            radius: 1 * eliteConfig.sizeMultiplier,
            color: eliteConfig.color,
            health: baseStats.hp * eliteConfig.hpMultiplier,
            maxHealth: baseStats.hp * eliteConfig.hpMultiplier,
            damage: baseStats.damage * eliteConfig.damageMultiplier,
            speed: baseStats.speed * 0.8, // 엘리트는 느리지만 강함
            enemyType: 'whale',
            state: 'chasing' as const,
            stunTimer: 0,
            mass: eliteConfig.sizeMultiplier,
            hitBy: new Set<string>(),
            isBoss: true,
            isFrozen: false,
            skillCooldown: 0,
            name: eliteConfig.name,
            isElite: true,
            eliteTier: eliteConfig.tier,
            dropCount: eliteConfig.drops.length,
          } as any);

          // 엘리트 스폰 콜백 (HUD 알림)
          onEliteSpawn?.(eliteConfig);

          // 화면 쉐이크 (엘리트 등장 연출)
          refs.screenShakeTimer.current = Math.max(refs.screenShakeTimer.current, 0.5);
          refs.screenShakeIntensity.current = Math.max(refs.screenShakeIntensity.current, 0.6);
        }
      }
    }

    // === v44: 적 투사체 업데이트 (이동 + 충돌 + 수명) ===
    const enemyProjs = refs.enemyProjectiles.current;
    for (let pi = enemyProjs.length - 1; pi >= 0; pi--) {
      const proj = enemyProjs[pi];
      proj.position.x += proj.velocity.x * dt;
      proj.position.y += proj.velocity.y * dt;
      proj.life -= dt;

      // 수명 만료
      if (proj.life <= 0) {
        enemyProjs.splice(pi, 1);
        continue;
      }

      // 플레이어 히트 판정
      if (player.health > 0 && player.invulnerabilityTimer <= 0) {
        const pdx = proj.position.x - player.position.x;
        const pdy = proj.position.y - player.position.y;
        const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
        if (pdist < ENEMY_PROJ_HIT_RANGE) {
          player.health = Math.max(0, player.health - proj.damage);
          player.hitFlashTimer = 0.15;
          player.invulnerabilityTimer = INVULNERABILITY_DURATION;

          // 넉백 (투사체 방향)
          if (pdist > 0.1) {
            player.knockback.x = (pdx / pdist) * ENEMY_KNOCKBACK_FORCE * 0.5;
            player.knockback.y = (pdy / pdist) * ENEMY_KNOCKBACK_FORCE * 0.5;
          }

          refs.screenShakeTimer.current = 0.15;
          refs.screenShakeIntensity.current = 0.2;

          refs.damageNumbers.current.push({
            id: `eproj-dmg-${Date.now()}-${Math.random()}`,
            position: { x: player.position.x, y: player.position.y },
            value: proj.damage,
            color: '#ff6600',
            life: 1.0,
            maxLife: 1.0,
            isCritical: false,
            velocity: { x: (Math.random() - 0.5) * 40, y: -60 },
          });

          enemyProjs.splice(pi, 1);
        }
      }
    }

    // 적 AI: behaviorType 분기 (v44: chase/ranged/charge)
    for (const enemy of refs.enemies.current) {
      const ex = enemy.position.x - player.position.x;
      const ey = enemy.position.y - player.position.y;
      const dist = Math.sqrt(ex * ex + ey * ey);
      const behavior = enemy.behaviorType ?? 'chase';

      switch (behavior) {
        // ===== 원거리 AI: 거리 유지 + 투사체 발사 =====
        case 'ranged': {
          const invDist = dist > 0.1 ? 1 / dist : 0;
          const nrmX = ex * invDist;
          const nrmY = ey * invDist;

          if (dist < RANGED_RETREAT_DIST) {
            // 플레이어가 너무 가까움 → 후퇴
            enemy.position.x += nrmX * enemy.speed * 1.2 * dt;
            enemy.position.y += nrmY * enemy.speed * 1.2 * dt;
            enemy.velocity.x = nrmX * enemy.speed * 1.2;
            enemy.velocity.y = nrmY * enemy.speed * 1.2;
          } else if (dist < RANGED_MIN_DIST) {
            // 너무 가까움 → 느리게 후퇴
            enemy.position.x += nrmX * enemy.speed * 0.5 * dt;
            enemy.position.y += nrmY * enemy.speed * 0.5 * dt;
            enemy.velocity.x = nrmX * enemy.speed * 0.5;
            enemy.velocity.y = nrmY * enemy.speed * 0.5;
          } else if (dist > RANGED_MAX_DIST) {
            // 너무 멀음 → 접근
            enemy.position.x += -nrmX * enemy.speed * dt;
            enemy.position.y += -nrmY * enemy.speed * dt;
            enemy.velocity.x = -nrmX * enemy.speed;
            enemy.velocity.y = -nrmY * enemy.speed;
          } else {
            // 이상적 거리 → 횡이동 (strafing)
            const tangentX = -nrmY;
            const tangentY = nrmX;
            const strafeSpeed = enemy.speed * 0.4;
            enemy.position.x += tangentX * strafeSpeed * dt;
            enemy.position.y += tangentY * strafeSpeed * dt;
            enemy.velocity.x = tangentX * strafeSpeed;
            enemy.velocity.y = tangentY * strafeSpeed;

            // 거리 미세 보정
            const correction = (dist - RANGED_IDEAL_DIST) * 0.3;
            enemy.position.x += -nrmX * correction * dt;
            enemy.position.y += -nrmY * correction * dt;
          }

          // 투사체 발사 쿨다운
          const projCooldown = enemy.currentAttackCooldown ?? RANGED_PROJECTILE_COOLDOWN;
          enemy.skillCooldown -= dt;
          if (enemy.skillCooldown <= 0 && dist <= RANGED_MAX_DIST + 2) {
            enemy.skillCooldown = projCooldown;

            // 투사체 생성 (플레이어 방향)
            if (enemyProjs.length < MAX_ENEMY_PROJECTILES) {
              const projSpeed = enemy.projectileSpeed ?? RANGED_PROJECTILE_SPEED;
              const dirX = -ex * invDist;
              const dirY = -ey * invDist;
              enemyProjs.push({
                id: `eproj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                position: { x: enemy.position.x, y: enemy.position.y },
                velocity: { x: dirX * projSpeed, y: dirY * projSpeed },
                radius: RANGED_PROJECTILE_RADIUS,
                color: enemy.projectileColor ?? '#ff4400',
                damage: Math.round(enemy.damage * 0.5), // 일반 데미지의 50%
                life: RANGED_PROJECTILE_LIFE,
                skillType: 'ranged',
              });
            }
          }
          break;
        }

        // ===== 돌진 AI: 준비 → 돌진 → 쿨다운 =====
        case 'charge': {
          const chargeState = enemy.chargeState ?? 'idle';

          switch (chargeState) {
            case 'idle': {
              // 일반 추적 (chase와 동일)
              if (dist > ENEMY_ATTACK_RANGE) {
                const nx = -ex / (dist || 1);
                const ny = -ey / (dist || 1);
                enemy.position.x += nx * enemy.speed * dt;
                enemy.position.y += ny * enemy.speed * dt;
                enemy.velocity.x = nx * enemy.speed;
                enemy.velocity.y = ny * enemy.speed;
              }

              // 돌진 거리 이내 진입 → 준비 시작
              if (dist <= CHARGE_TRIGGER_DIST && dist > ENEMY_ATTACK_RANGE) {
                enemy.chargeState = 'preparing';
                enemy.chargeTimer = CHARGE_PREP_TIME;
                // 돌진 방향 고정 (현재 플레이어 방향)
                const invD = dist > 0.1 ? 1 / dist : 0;
                enemy.chargeDirection = { x: -ex * invD, y: -ey * invD };
                enemy.velocity.x = 0;
                enemy.velocity.y = 0;
              }

              // 근접 공격 (chase fallback)
              if (dist <= ENEMY_ATTACK_RANGE) {
                enemy.skillCooldown -= dt;
                if (enemy.skillCooldown <= 0) {
                  enemy.skillCooldown = ENEMY_ATTACK_COOLDOWN;
                  if (player.health > 0 && player.invulnerabilityTimer <= 0) {
                    player.health = Math.max(0, player.health - enemy.damage);
                    player.hitFlashTimer = 0.15;
                    player.invulnerabilityTimer = INVULNERABILITY_DURATION;
                    if (dist > 0.1) {
                      player.knockback.x = (ex / dist) * ENEMY_KNOCKBACK_FORCE;
                      player.knockback.y = (ey / dist) * ENEMY_KNOCKBACK_FORCE;
                    }
                    refs.screenShakeTimer.current = 0.2;
                    refs.screenShakeIntensity.current = 0.3;
                    refs.damageNumbers.current.push({
                      id: `dmg-${Date.now()}-${Math.random()}`,
                      position: { x: player.position.x, y: player.position.y },
                      value: enemy.damage,
                      color: '#ff4444',
                      life: 1.0, maxLife: 1.0, isCritical: false,
                      velocity: { x: (Math.random() - 0.5) * 40, y: -60 },
                    });
                  }
                }
              }
              break;
            }

            case 'preparing': {
              // 준비 중 (속도 0, 타이머 감소)
              enemy.velocity.x = 0;
              enemy.velocity.y = 0;
              enemy.chargeTimer = (enemy.chargeTimer ?? 0) - dt;

              if ((enemy.chargeTimer ?? 0) <= 0) {
                // 돌진 시작!
                enemy.chargeState = 'charging';
                enemy.chargeTimer = CHARGE_MAX_DIST / (enemy.speed * CHARGE_SPEED_MULT); // 돌진 지속 시간
              }
              break;
            }

            case 'charging': {
              // 돌진 중 (3배속 직선 이동)
              const dir = enemy.chargeDirection ?? { x: 1, y: 0 };
              const chargeSpeed = enemy.speed * CHARGE_SPEED_MULT;
              enemy.position.x += dir.x * chargeSpeed * dt;
              enemy.position.y += dir.y * chargeSpeed * dt;
              enemy.velocity.x = dir.x * chargeSpeed;
              enemy.velocity.y = dir.y * chargeSpeed;

              // 돌진 타이머 감소
              enemy.chargeTimer = (enemy.chargeTimer ?? 0) - dt;

              // 돌진 중 플레이어 히트
              if (dist < 2.0 && player.health > 0 && player.invulnerabilityTimer <= 0) {
                player.health = Math.max(0, player.health - enemy.damage * 1.5);
                player.hitFlashTimer = 0.2;
                player.invulnerabilityTimer = INVULNERABILITY_DURATION;
                if (dist > 0.1) {
                  player.knockback.x = dir.x * ENEMY_KNOCKBACK_FORCE * 2;
                  player.knockback.y = dir.y * ENEMY_KNOCKBACK_FORCE * 2;
                }
                refs.screenShakeTimer.current = 0.4;
                refs.screenShakeIntensity.current = 0.5;
                refs.damageNumbers.current.push({
                  id: `charge-dmg-${Date.now()}-${Math.random()}`,
                  position: { x: player.position.x, y: player.position.y },
                  value: Math.round(enemy.damage * 1.5),
                  color: '#ff0000',
                  life: 1.2, maxLife: 1.2, isCritical: true,
                  velocity: { x: (Math.random() - 0.5) * 50, y: -70 },
                });
                // 돌진 종료 → 쿨다운
                enemy.chargeState = 'cooldown';
                enemy.chargeCooldown = CHARGE_COOLDOWN;
                enemy.velocity.x = 0;
                enemy.velocity.y = 0;
              }

              // 타이머 만료 또는 최대 거리 → 쿨다운
              if ((enemy.chargeTimer ?? 0) <= 0) {
                enemy.chargeState = 'cooldown';
                enemy.chargeCooldown = CHARGE_COOLDOWN;
                enemy.velocity.x = 0;
                enemy.velocity.y = 0;
              }
              break;
            }

            case 'cooldown': {
              // 돌진 후 무방비 (속도 0, 쿨다운 감소)
              enemy.velocity.x = 0;
              enemy.velocity.y = 0;
              enemy.chargeCooldown = (enemy.chargeCooldown ?? 0) - dt;

              if ((enemy.chargeCooldown ?? 0) <= 0) {
                enemy.chargeState = 'idle';
              }
              break;
            }
          }
          break;
        }

        // ===== 기존 chase AI (디폴트) =====
        case 'chase':
        default: {
          if (dist > ENEMY_ATTACK_RANGE) {
            // 사거리 밖: 플레이어를 향해 직선 추적
            const nx = -ex / dist;
            const ny = -ey / dist;
            enemy.position.x += nx * enemy.speed * dt;
            enemy.position.y += ny * enemy.speed * dt;
            enemy.velocity.x = nx * enemy.speed;
            enemy.velocity.y = ny * enemy.speed;
          } else {
            // 사거리 안: 공전하면서 계속 이동 (dead-stop 제거)
            const invDist = dist > 0.1 ? 1 / dist : 0;
            const nrmX = ex * invDist;
            const nrmY = ey * invDist;
            const tangentX = -nrmY;
            const tangentY = nrmX;
            const orbitSpeed = enemy.speed * 0.6;
            const moveX = tangentX * orbitSpeed * ENEMY_ORBIT_SPEED;
            const moveY = tangentY * orbitSpeed * ENEMY_ORBIT_SPEED;
            enemy.position.x += moveX * dt;
            enemy.position.y += moveY * dt;
            enemy.velocity.x = moveX;
            enemy.velocity.y = moveY;

            // 사거리 경계 유지
            const idealDist = ENEMY_ATTACK_RANGE * 0.7;
            const distCorrection = (dist - idealDist) * 0.5;
            if (Math.abs(distCorrection) > 0.5) {
              enemy.position.x += (-nrmX) * distCorrection * dt * 3;
              enemy.position.y += (-nrmY) * distCorrection * dt * 3;
            }

            // 공격 쿨다운
            enemy.skillCooldown -= dt;
            if (enemy.skillCooldown <= 0) {
              enemy.skillCooldown = ENEMY_ATTACK_COOLDOWN;

              if (player.health > 0 && player.invulnerabilityTimer <= 0) {
                player.health = Math.max(0, player.health - enemy.damage);
                player.hitFlashTimer = 0.15;
                player.invulnerabilityTimer = INVULNERABILITY_DURATION;

                if (dist > 0.1) {
                  player.knockback.x = (ex / dist) * ENEMY_KNOCKBACK_FORCE;
                  player.knockback.y = (ey / dist) * ENEMY_KNOCKBACK_FORCE;
                }

                refs.screenShakeTimer.current = 0.2;
                refs.screenShakeIntensity.current = 0.3;

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
          break;
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

    // 화면 쉐이크 감쇠 (realDt — 슬로모에 영향 받지 않음)
    if (refs.screenShakeTimer.current > 0) {
      refs.screenShakeTimer.current -= realDt;
      refs.screenShakeIntensity.current *= 0.92;
    }

    // 잼 자석 수집 (v42 Phase 4: 콤보 XP 배율 적용)
    const xpMultiplier = comboXpMultiplierRef?.current ?? 1.0;
    refs.gems.current = refs.gems.current.filter(gem => {
      if (gem.isCollected) return false;
      const gdx = gem.position.x - player.position.x;
      const gdy = gem.position.y - player.position.y;
      const gd = Math.sqrt(gdx * gdx + gdy * gdy);
      if (gd < GEM_COLLECT_RANGE) {
        const xpGain = Math.floor(gem.value * xpMultiplier);
        player.xp += xpGain;
        player.score += gem.value;
        return false;
      }
      if (gd < GEM_MAGNET_RANGE && gd > 0.5) {
        gem.position.x -= (gdx / gd) * 12 * dt; // MC 스케일 자석 속도
        gem.position.y -= (gdy / gd) * 12 * dt;
      }
      return true;
    });

    // === v42 Phase 3: XP 임계값 체크 → 레벨업 ===
    if (onLevelUp && player.xp >= player.nextLevelXp) {
      player.level++;
      // 초과 XP는 유지 (이월)
      player.xp -= player.nextLevelXp;
      // 다음 레벨 XP 임계값 설정
      player.nextLevelXp = player.level < XP_THRESHOLDS.length
        ? XP_THRESHOLDS[player.level]
        : Math.floor(player.nextLevelXp * 1.1);
      // 일시정지 + 레벨업 콜백
      if (pausedRef) pausedRef.current = true;
      onLevelUp(player.level);
    }

    // Screen Flash 업데이트 (realDt — 슬로모에 영향 받지 않음)
    updateFlash(realDt);
  });

  return null;
}

/**
 * MatrixScene — R3F Canvas 래퍼 + useGameLoop 통합
 *
 * 2D/3D 듀얼 모드 지원:
 * - MatrixApp에서 renderMode='3d' 시 MatrixScene 마운트
 * - renderMode='2d' 시 기존 MatrixCanvas 마운트
 *
 * useFrame priority=0 필수 — non-zero priority는 R3F auto-render 비활성화
 */
export function MatrixScene({ gameActive, gameRefs, blockWeaponsTick: externalTick, pausedRef, onEnemyKill, onLevelUp, playerSkillsMap, comboDamageMultiplierRef, comboXpMultiplierRef, killCountRef, onPhaseChange, onEliteSpawn, comboUpdate, ultimateUnlockedRef, ultimateCooldownRef }: MatrixSceneProps) {
  // 내부 refs (외부에서 주입되지 않은 경우 자체 refs 생성)
  const internalRefs = useGameRefs();
  const refs = gameRefs ?? internalRefs;

  // MC 지형 시드 초기화 (EnemyRenderer/SwingArc 등에서 사용)
  useMemo(() => setMCTerrainSeed(MC_SEED), []);

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
  const deathRespawnTimerRef = useRef(0);

  // === v44: 슬로모 시스템 refs ===
  const gameSpeedRef = useRef(1.0);
  const slowmoTimerRef = useRef(0);

  // 3인칭 모드: WASD는 MCGameCamera가 직접 관리
  const containerRef = useRef<HTMLDivElement>(null);

  // === v42: 블록 좌표 무기 시스템 (Phase 4: 콤보 데미지 배율 연동) ===
  const internalBlockWeapons = useBlockWeapons({
    playerRef: refs.player,
    enemiesRef: refs.enemies,
    projectilesRef: refs.projectiles,
    damageNumbersRef: refs.damageNumbers,
    hitFlashMapRef,
    attackEventsRef,
    comboDamageMultiplierRef,
  });
  const weaponTick = externalTick ?? internalBlockWeapons.tick;

  // === 테스트 적/잼 스폰 (한 번만 실행) — MC 블록 스케일 ===
  useMemo(() => {
    // 테스트용 적 20마리 (플레이어 스폰(8,8) 주변 5~25 블록 — 빠른 전투 시작)
    const testEnemies = [];
    for (let i = 0; i < 20; i++) {
      const angle = (Math.PI * 2 * i) / 20;
      const dist = 5 + Math.random() * 20;
      testEnemies.push({
        id: `test-enemy-${i}`,
        position: { x: 8 + Math.cos(angle) * dist, y: 8 + Math.sin(angle) * dist },
        velocity: { x: 0, y: 0 },
        radius: 1,
        color: i < 3 ? '#ff4444' : '#44aaff',
        health: 100,
        maxHealth: 100,
        damage: 10,
        speed: i === 0 ? 3 : i < 3 ? 4 : 5, // MC 블록/초
        enemyType: i === 0 ? 'whale' : i < 3 ? 'bot' : 'glitch',
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

    // 테스트용 XP 잼 50개 (스폰 주변 30 블록 범위)
    const testGems = [];
    for (let i = 0; i < 50; i++) {
      testGems.push({
        id: `test-gem-${i}`,
        position: {
          x: 8 + (Math.random() - 0.5) * 60,
          y: 8 + (Math.random() - 0.5) * 60,
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
          x: 8 + (Math.random() - 0.5) * 40,
          y: 8 + (Math.random() - 0.5) * 40,
        },
        life: 10,
        maxLife: 10,
        radius: 1,
        magnetRange: 8,
        isCollected: false,
      });
    }
    refs.pickups.current = testPickups as any;

    // v42: 초기 무기 부여 (knife Lv.1) — Phase 1 하드코딩 테스트
    const knifeStats = getBlockWeaponStats('knife', 1);
    if (knifeStats) {
      refs.player.current.weapons = {
        knife: {
          level: 1,
          damage: knifeStats.damage,
          area: knifeStats.area,
          speed: knifeStats.speed,
          duration: knifeStats.duration,
          cooldown: knifeStats.cooldown,
          amount: knifeStats.amount,
          pierce: knifeStats.pierce,
          knockback: knifeStats.knockback,
        },
      };
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // v42 Phase 3: playerSkillsMap 변경 시 player.weapons 동기화
  useEffect(() => {
    if (!playerSkillsMap || playerSkillsMap.size === 0) return;
    const newWeapons: Record<string, any> = {};
    playerSkillsMap.forEach((level, weaponType) => {
      if (level <= 0) return;
      const stats = getBlockWeaponStats(weaponType as import('@/lib/matrix/types').WeaponType, level);
      if (stats) {
        newWeapons[weaponType] = {
          level,
          damage: stats.damage,
          area: stats.area,
          speed: stats.speed,
          duration: stats.duration,
          cooldown: stats.cooldown,
          amount: stats.amount,
          pierce: stats.pierce,
          knockback: stats.knockback,
        };
      }
    });
    refs.player.current.weapons = newWeapons;
  }, [playerSkillsMap, refs.player]);

  // 게임 루프 → Canvas 내부 GameLogic 컴포넌트로 이동 (useFrame 직접 실행)

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      style={{ position: 'relative', width: '100%', height: '100%', outline: 'none' }}
    >
      {/* R3F 3D Canvas */}
      <Canvas
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
        }}
        camera={{
          fov: 70,
          position: [8, 40, 8],
          near: 0.1,
          far: 150,
        }}
        dpr={[1, Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2)]}
        frameloop="always"
        style={{
          position: 'absolute',
          inset: 0,
          background: '#87ceeb',
        }}
      >
        <SceneContent
          refs={refs}
          warningIntensityRef={warningIntensityRef}
          attackEventsRef={attackEventsRef}
          deathEventsRef={deathEventsRef}
          hitFlashMapRef={hitFlashMapRef}
          playerAttackTimerRef={playerAttackTimerRef}
          respawnTimerRef={respawnTimerRef}
          deathRespawnTimerRef={deathRespawnTimerRef}
          updateFlash={updateFlash}
          blockWeaponsTick={weaponTick}
          pausedRef={pausedRef}
          onEnemyKill={onEnemyKill}
          onLevelUp={onLevelUp}
          comboXpMultiplierRef={comboXpMultiplierRef}
          killCountRef={killCountRef}
          onPhaseChange={onPhaseChange}
          onEliteSpawn={onEliteSpawn}
          comboUpdate={comboUpdate}
          ultimateUnlockedRef={ultimateUnlockedRef}
          ultimateCooldownRef={ultimateCooldownRef}
          triggerFlash={triggerFlash}
          gameSpeedRef={gameSpeedRef}
          slowmoTimerRef={slowmoTimerRef}
        />
      </Canvas>

      {/* Phase 5: Screen Flash Overlay (S33) — DOM 기반 */}
      <ScreenFlashOverlay flashRef={flashRef} />

      {/* Phase 4: HUD Overlay — DOM 기반 HUD 컴포넌트 통합 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 20,
        }}
        className="matrix-scene-hud-overlay"
      >
        {/* HP/XP/Level/Score/Kills 표시 */}
        <GameHUD3D
          playerRef={refs.player}
          enemyCount={refs.enemies.current.length}
          gameTime={refs.gameTime.current}
        />

        {/* 미니맵 — 우측 하단 */}
        <Minimap3D
          playerRef={refs.player}
          enemiesRef={refs.enemies}
        />

        {/* 무기 슬롯 — 하단 중앙 */}
        <WeaponSlots3D playerRef={refs.player} />

        {/* 모바일 가상 조이스틱 — 좌측 하단 (모바일만 표시) */}
        <MobileControls3D keysPressedRef={refs.keysPressed} />
      </div>
    </div>
  );
}

export default MatrixScene;
