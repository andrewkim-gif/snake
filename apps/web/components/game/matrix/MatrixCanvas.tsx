'use client';

import React, { useEffect, useCallback, useRef } from 'react';
import { GAME_CONFIG, XP_THRESHOLDS, WEAPON_DATA, PICKUP_DATA, SPECIAL_SKILL, CLASS_DATA, getWaveForTime, getWaveForStage, ZOOM_CONFIG } from '@/lib/matrix/constants';
// STAGE_CONFIGS removed for Arena mode
import { getSpriteManager } from '@/lib/matrix/sprites';
import type { AnimationType } from '@/lib/matrix/sprites/types';
// v5.6: 8방향 스프라이트 시스템
// v5.9.3: CharacterPart 추가 (스플릿 렌더링)
import {
  Direction8,
  getDirection8FromVelocity,
  preloadAllCharacterSprites,
  drawCharacterSprite,
  isAllSpritesLoaded,
  // v5.7: 8x8 스프라이트 시트 애니메이션 시스템
  loadSpriteSheet,
  isSpriteSheetLoaded,
  drawSpriteSheet,
} from '@/lib/matrix/sprites';
import type { CharacterPart } from '@/lib/matrix/sprites';
import { Enemy, Vector2, WeaponType, Pickup, PickupType, GameState, PlayerClass, RouletteReward, PersistentUpgrades, EnemyType, Projectile, WaveNumber, GameMode } from '@/lib/matrix/types';
import { distance, randomRange, normalize, calcTieredBonus } from '@/lib/matrix/utils/math';
import { soundManager } from '@/lib/matrix/utils/audio';
import { useV3Systems, V3SystemEvents } from '@/lib/matrix/hooks/useV3Systems';
import {
    drawCatSprite,
    drawFloorTile,
    drawTerrainOnly,
    drawJoystick,
    drawGlitch,
    drawEnemy,
    drawProjectile,
    drawLightningBolt,
    drawFormationWarning,
    drawTurret,
    drawTurretAoeEffect,
    useGameRefs,
    checkAxisCollision,
    setCurrentStageId,
    setCurrentGameMode,
    setCurrentMapSeed,
    isObstacleAt,
    updateRenderContext,
    // v5.0 LOD helpers (투사체/파티클/폭발 최적화용)
    shouldUseGradient,
    shouldUseGlow,
    shouldUseShadow,
    // v4 스킬 이펙트 시스템
    EASING,
    GLOW_PRESETS,
    applyEasing,
    lerp,
    lerpColor,
    updateTrailPositions,
} from '@/lib/matrix';
// v7.x: 캔버스 콤보 카운터
import { drawComboAboveCharacter } from '@/lib/matrix/rendering/ui/comboCanvas';
import { useLanguage } from '@/lib/matrix/i18n';
import { useTileMap } from '@/lib/matrix/hooks/useTileMap';
import {
    updateTurrets,
    updateTurretAoeEffects,
    damageTurret,
} from '@/lib/matrix/systems/turret';
import type { TurretAoeEffect, PlacedTurret } from '@/lib/matrix/types/turret';
import type { PlacedAgent } from '@/lib/matrix/types/agent';
import {
    processAutoHuntMovement,
    processManualInput,
    fireWeapon,
    // updateBossBehavior removed for Arena mode
    collectPickup as collectPickupSystem,
    consolidateGems as consolidateGemsSystem,
    spawnEnemy as spawnEnemySystem,
    spawnEnemyProjectile as spawnEnemyProjectileSystem,
    spawnParticles as spawnParticlesSystem,
    spawnDamageNumber as spawnDamageNumberSystem,
    damageEnemy as damageEnemySystem,
    handleEnemyCollision,
    updateEnemyProjectiles,
    updatePlayerProjectiles,
    updateBlasts,
    updateGems,
    updateRangedEnemy,
    updateStatusEffects,
    isRangedEnemyType,
    type AutoHuntContext,
    type RangedEnemyCallbacks,
    type MovementRefs,
    type InputState,
    // v2.0 Auto Hunt 관성 시스템
    createDefaultDirectionPlan,
    createDefaultThreatMemory,
    createDefaultMotionState,
    type WeaponFireContext,
    type BossSystemCallbacks,
    type PickupCollectContext,
    type DamageEnemyContext,
    type ProjectileSystemContext,
    type EnemyProjectileContext,
    type EnemyCollisionContext,
    type GemCollectContext,
} from '@/lib/matrix/systems';
import {
    createSpawnState,
    updateSpawnController,
    consumePendingFormation,
    getFormationWarning,
    pickRandomActiveType,
    type SpawnState,
    type FormationWarning,
} from '@/lib/matrix/systems/spawn-controller';
// v7.15: 엘리트 몬스터 시스템
import {
    createEliteSpawnState,
    checkEliteSpawn,
    updateEliteSpawnState,
    onEliteDeath,
    convertToElite,
    processEliteDeath,
    updateEliteDropPhysics,
    type EliteSpawnState,
    type EliteDropItem,
} from '@/lib/matrix/systems/elite-monster';
import {
    drawEliteEffects,
    calculateElitePulse,
} from '@/lib/matrix/rendering/enemies/eliteEffects';
// v8.0 Arena Mode: 에이전트 UI 렌더링
import {
    drawAgentNameplate,
    drawChatBubble,
    drawAgentHealthBar,
    drawAgentUI,
    drawKillFeed,
    type KillFeedEntry,
} from '@/lib/matrix/rendering/ui/chatBubble';
import {
    getAgentChatMessage,
    updateChatMessages,
} from '@/lib/matrix/systems/agent-chat';
import {
    updateAllAgentsCombat,
    checkProjectileAgentCollision,
    applyPvPDamage,
    isAgentProjectile,
    getProjectileOwnerId,
} from '@/lib/matrix/systems/agent-combat';

// v5.9: 이소메트릭 모드 ON/OFF
// v6.2: 이소메트릭 타일맵 적용 - 엔티티도 이소메트릭 변환
const ISO_ENABLED = true;

interface MatrixCanvasProps {
    onScoreUpdate: (score: number) => void;
    onHealthUpdate: (hp: number) => void;
    onXpUpdate: (xp: number, nextXp: number, level: number) => void;
    onTimeUpdate: (time: number) => void;
    onLevelUp: () => void;
    onGameOver: (score: number) => void;
    onDamageTaken: () => void;
    onSpecialUpdate: (cooldown: number) => void;
    onBossSpawn: () => void;
    onBossUpdate: (boss: Enemy | null) => void;
    onBossDefeated: () => void;
    onBossWarning: (bossType: string) => void;
    onWeaponCooldownsUpdate: (cds: Partial<Record<WeaponType, number>>) => void;
    onChestCollected: () => void;
    onMaterialCollected?: () => void;  // 재료 수집 콜백
    gameActive: boolean;
    upgrades: Record<string, number>;
    resetTrigger: number;
    gameState: GameState;
    playerClass: PlayerClass;
    appliedReward?: RouletteReward | null;
    isAutoHunt?: boolean;
    persistentUpgrades: PersistentUpgrades;
    timeScale?: number;  // 개발 모드 시간 배속 (0.2 ~ 5.0)
    // 특이점 모드
    gameMode?: GameMode;
    singularityDifficultyMultiplier?: { hp: number; damage: number; speed: number; spawnRate: number };
    onSingularityTimeUpdate?: (time: number) => void;
    onSingularityKill?: () => void;
    onSingularityBossCheck?: (gameTime: number) => import('@/lib/matrix/hooks/useSingularity').SingularityBossSpawnEvent | null;
    onSingularityMilestoneCheck?: (gameTime: number) => import('@/lib/matrix/hooks/useSingularity').MilestoneAchievedEvent | null;
    onMilestoneAchieved?: (milestoneMinutes: number) => void;
    // NFT 효과
    nftEffects?: import('@/lib/matrix/types/nft').AppliedNFTEffects;
    // 튜토리얼 트래킹
    onTutorialMove?: (distance: number) => void;
    onTutorialKill?: () => void;
    onTutorialGemCollect?: () => void;
    // 캐릭터 강화 보너스 (v5.7: defBonus 추가)
    characterBonus?: { hpBonus: number; speedBonus: number; damageBonus: number; defBonus?: number };
    // 인게임 알림
    onNotifyItem?: (itemName: string, iconName?: string) => void;
    // v3 시스템 상태 콜백
    onV3Update?: (v3State: import('@/lib/matrix/types').V3GameSystems, events: V3SystemEvents) => void;
    // 스킨 색상 (장착된 스킨 적용)
    skinColors?: import('@/lib/matrix/types/skin').SkinColors;
    // 이벤트 로그 콜백
    onEventLog?: (type: import('@/lib/matrix/types').EventLogType, text: string, options?: { highlight?: boolean; subText?: string }) => void;
    // 에이전트 시스템 (v8.0 - 단일 에이전트, PlacedTurret과 호환)
    placedTurrets?: (PlacedTurret | PlacedAgent)[];
    onTurretsUpdate?: (turrets: (PlacedTurret | PlacedAgent)[]) => void;
    onPlayerPositionUpdate?: (x: number, y: number) => void;
    // 시스템 통계 (관리자 모드용)
    onEntityCountUpdate?: (counts: { enemies: number; particles: number; projectiles: number }) => void;
    // 디버그 모드 (히트박스, 오브젝트 위치 시각화)
    debugMode?: boolean;
    // E2E 테스터 모드 (v7.35) - 무적, 10x 속도, max skills
    testerMode?: boolean;
    // Arena (Battle Royale) 모드 - 9명의 AI 에이전트
    arenaAgents?: import('@/lib/matrix/types').Agent[];
    arenaKillFeed?: import('@/lib/matrix/rendering/ui/chatBubble').KillFeedEntry[];
    onArenaUpdate?: (deltaTime: number) => void;
    onArenaAgentDamage?: (agentId: string, damage: number, attackerId?: string) => void;
    onArenaAgentKill?: (agentId: string, killerId?: string) => void;
    // v8.1: 에이전트 XP 부여 (젬 수집 시)
    addAgentXp?: (agentId: string, xp: number) => void;
    // v33 Phase 4: 멀티플레이어 렌더링 콜백 (온라인 모드)
    onMultiplayerRender?: (ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number, canvasWidth: number, canvasHeight: number, zoom: number, time: number) => void;
}

const MatrixCanvas: React.FC<MatrixCanvasProps> = ({
    onScoreUpdate,
    onHealthUpdate,
    onXpUpdate,
    onTimeUpdate,
    onLevelUp,
    onGameOver,
    onDamageTaken,
    onSpecialUpdate,
    onBossSpawn,
    onBossUpdate,
    onBossDefeated,
    onBossWarning,
    onWeaponCooldownsUpdate,
    onChestCollected,
    onMaterialCollected,
    gameActive,
    upgrades,
    resetTrigger,
    gameState,
    playerClass,
    appliedReward,
    isAutoHunt = false,
    persistentUpgrades,
    timeScale = 1.0,
    gameMode = 'stage',
    singularityDifficultyMultiplier,
    onSingularityTimeUpdate,
    onSingularityKill,
    onSingularityBossCheck,
    onSingularityMilestoneCheck,
    onMilestoneAchieved,
    nftEffects,
    onTutorialMove,
    onTutorialKill,
    onTutorialGemCollect,
    characterBonus = { hpBonus: 0, speedBonus: 0, damageBonus: 0, defBonus: 0 },
    onNotifyItem,
    onV3Update,
    skinColors,
    onEventLog,
    placedTurrets = [],
    onTurretsUpdate,
    onPlayerPositionUpdate,
    onEntityCountUpdate,
    debugMode = false,
    testerMode = false,
    // Arena mode props
    arenaAgents = [],
    arenaKillFeed = [],
    onArenaUpdate,
    onArenaAgentDamage,
    onArenaAgentKill,
    addAgentXp,
    onMultiplayerRender,
}) => {
    // 다국어 시스템
    const { language, t } = useLanguage();

    // useGameRefs 훅으로 모든 게임 상태 refs 관리
    const refs = useGameRefs();

    // timeScale을 ref로 저장하여 게임 루프에서 항상 최신값 참조
    const timeScaleRef = useRef(timeScale);
    useEffect(() => {
        timeScaleRef.current = timeScale;
    }, [timeScale]);

    // skinColors를 ref로 저장하여 게임 루프에서 항상 최신값 참조 (stale closure 방지)
    const skinColorsRef = useRef(skinColors);
    useEffect(() => {
        skinColorsRef.current = skinColors;
    }, [skinColors]);

    // arenaAgents를 ref로 저장하여 게임 루프에서 항상 최신값 참조
    const arenaAgentsRef = useRef(arenaAgents);
    arenaAgentsRef.current = arenaAgents; // 매 렌더마다 즉시 업데이트 (useEffect 대기 없이)

    // debugMode를 ref로 저장하여 게임 루프에서 항상 최신값 참조
    const debugModeRef = useRef(debugMode);
    useEffect(() => {
        debugModeRef.current = debugMode;
    }, [debugMode]);

    // 스프라이트 애니메이션 상태 (v5.6: 기존 애니메이션 시스템 - 폴백용으로 유지)
    const spriteAnimRef = useRef<{ type: AnimationType; startTime: number }>({ type: 'idle', startTime: 0 });
    const spriteLoadedRef = useRef(false);
    const playerClassRef = useRef<PlayerClass>(playerClass); // RAF closure 버그 방지용

    // v5.6: 8방향 스프라이트 로딩 상태
    const direction8LoadedRef = useRef(false);
    // v5.6: 마지막 이동 방향 (정지 시 유지)
    const lastDirection8Ref = useRef<Direction8>(Direction8.FRONT);
    // v5.7: 8x8 스프라이트 시트 로딩 상태 (neo만 우선 적용)
    const spriteSheetLoadedRef = useRef(false);
    // v5.8: 공격 애니메이션 제거됨 - walk, idle, takedamage만 사용

    // playerClass 변경 시 ref 동기화 (RAF에서 항상 최신값 사용)
    useEffect(() => {
        playerClassRef.current = playerClass;
        spriteLoadedRef.current = false; // 캐릭터 변경 시 로딩 상태 리셋

        // v5.6: 8방향 스프라이트 프리로드 (한 번만)
        if (!direction8LoadedRef.current) {
            preloadAllCharacterSprites().then(() => {
                direction8LoadedRef.current = true;
            });
        }

        // v6.0: 현재 선택된 캐릭터의 스프라이트 시트 로드
        const loadCurrentCharacterSheet = async () => {
            spriteSheetLoadedRef.current = false;
            const loaded = await loadSpriteSheet(playerClass);
            spriteSheetLoadedRef.current = loaded;
        };
        loadCurrentCharacterSheet();

        // 기존 애니메이션 스프라이트 로딩 (폴백용)
        const loadSprites = async () => {
            const manager = getSpriteManager();
            const loaded = await manager.loadCharacter(playerClass);
            spriteLoadedRef.current = loaded;
        };
        loadSprites();
    }, [playerClass]);

    // 에이전트/터렛 시스템 refs (v8.0: 단일 에이전트, v4.9: AOE 별도 관리)
    const turretAoeEffectsRef = useRef<TurretAoeEffect[]>([]);
    const placedTurretsRef = useRef<(PlacedTurret | PlacedAgent)[]>(placedTurrets as (PlacedTurret | PlacedAgent)[]);

    // placedTurrets prop 변경 시 ref 동기화 (새 터렛 추가/제거 시에만)
    // 중요: 터렛 어빌리티 상태(lastUsed 등)는 ref에서 직접 관리하므로
    // 단순히 덮어쓰지 않고 새로운 터렛만 병합
    useEffect(() => {
        const currentIds = new Set(placedTurretsRef.current.map(t => t.id));
        const newIds = new Set(placedTurrets.map(t => t.id));

        // 새로 추가된 터렛
        const addedTurrets = placedTurrets.filter(t => !currentIds.has(t.id));
        // 제거된 터렛
        const remainingTurrets = placedTurretsRef.current.filter(t => newIds.has(t.id));

        // 기존 터렛 상태 유지 + 새 터렛 추가
        placedTurretsRef.current = [...remainingTurrets, ...addedTurrets];

        // 모든 터렛이 제거되면 AOE 효과 초기화 (투사체는 projectilesRef에서 자동 소멸)
        if (placedTurrets.length === 0) {
            turretAoeEffectsRef.current = [];
        }
    }, [placedTurrets]);

    // 편의를 위한 destructuring (자주 사용되는 refs)
    const canvasRef = refs.canvas;
    const requestRef = refs.requestId;
    const previousTimeRef = refs.previousTime;
    const playerRef = refs.player;
    const enemiesRef = refs.enemies;
    const particlesRef = refs.particles;
    const damageNumbersRef = refs.damageNumbers;
    const criticalEffectsRef = refs.criticalEffects;
    const projectilesRef = refs.projectiles;
    const enemyProjectilesRef = refs.enemyProjectiles;
    const gemsRef = refs.gems;
    const pickupsRef = refs.pickups;
    const blastsRef = refs.blasts;
    const lightningBoltsRef = refs.lightningBolts;
    const keysPressed = refs.keysPressed;
    const joystickRef = refs.joystick;
    const lastSpawnTime = refs.lastSpawnTime;
    const gameTimeRef = refs.gameTime;
    const stageTimeRef = refs.stageTime;
    const lastFacingRef = refs.lastFacing;
    const lastMoveFacingRef = refs.lastMoveFacing;
    const smoothedAutoHuntDirRef = refs.smoothedAutoHuntDir;
    const frameCountRef = refs.frameCount;
    const screenFlashRef = refs.screenFlash;
    const screenShakeTimerRef = refs.screenShakeTimer;
    const screenShakeIntensityRef = refs.screenShakeIntensity;  // v7.8
    const currentStageIdRef = refs.currentStageId;
    const bossSpawnedRef = refs.bossSpawned;
    const warningTriggeredRef = refs.warningTriggered;
    const lastReportedTime = refs.lastReportedTime;
    const lastReportedScore = refs.lastReportedScore;
    const lastReportedXp = refs.lastReportedXp;
    const lastAttackTimeRef = refs.lastAttackTime;
    const lastDamageTimeRef = refs.lastDamageTime;
    const lastHitSfxRef = refs.lastHitSfx;
    const lastCollectSfxRef = refs.lastCollectSfx;
    const lastAutoHuntPosRef = refs.lastAutoHuntPos;
    const stuckFrameCountRef = refs.stuckFrameCount;
    const escapeDirRef = refs.escapeDir;
    const currentZoomRef = refs.currentZoom;
    const targetZoomRef = refs.targetZoom;

    // 캐싱된 Context 객체들 - 매 프레임 새로 생성하지 않고 재사용
    const cachedAutoHuntCtx = useRef<AutoHuntContext>({
        enemies: [],
        enemyProjectiles: [],
        gems: [],
        pickups: [],
        lastFacing: { x: 0, y: 1 },
        maxWeaponRange: 0,
        hasRangedWeapon: false,
    });
    // v2.0 Auto Hunt 관성 시스템 refs
    const directionPlanRef = useRef(createDefaultDirectionPlan());
    const threatMemoryRef = useRef(createDefaultThreatMemory());
    const motionStateRef = useRef(createDefaultMotionState());

    const cachedMovementRefs = useRef<MovementRefs>({
        smoothedAutoHuntDir: smoothedAutoHuntDirRef,
        lastAutoHuntPos: lastAutoHuntPosRef,
        stuckFrameCount: stuckFrameCountRef,
        escapeDir: escapeDirRef,
        lastFacing: lastFacingRef,
        lastMoveFacing: lastMoveFacingRef,
        // v2.0 관성 시스템
        directionPlan: directionPlanRef,
        threatMemory: threatMemoryRef,
        motionState: motionStateRef,
    });

    // Grid size for obstacle rendering (used in draw functions)
    const GRID_SIZE = 32;

    // v7.20 FIX: helpers.ts 전역 상태를 useTileMap 호출 전에 동기적으로 초기화
    // useEffect가 아닌 컴포넌트 본문에서 실행하여 첫 렌더링부터 일관된 시드 보장
    // 이렇게 하면 useTileMap과 충돌 검사가 항상 동일한 시드 사용
    const mapSeed = gameState.stage * 12345;
    setCurrentStageId(gameState.stage);
    setCurrentGameMode(gameMode);
    setCurrentMapSeed(mapSeed);

    // v6.2: 이소메트릭 타일 기반 맵 렌더링 훅
    // v7.16: seed 파라미터 추가 - helpers.ts의 충돌 검사와 동일한 시드 사용
    // 이전에는 seed가 없어서 기본값 0 사용 → 충돌(stage*12345)과 렌더링(0)이 불일치
    const tileMap = useTileMap({
        tileSize: GRID_SIZE,
        stageId: gameState.stage,
        gameMode,
        seed: mapSeed,  // helpers.ts setCurrentMapSeed와 동일
    });

    // 특이점 모드: 시간 기반 bomb 스폰용 ref
    const nextBombSpawnTimeRef = useRef<number>(0);

    // gameState를 ref로 캡처하여 initGame에서 최신 값 참조
    const gameStateRef = React.useRef(gameState);
    gameStateRef.current = gameState;

    // v3 시스템: 콤보, 쉬는시간, 쪽지시험 통합 훅
    const v3 = useV3Systems();
    // v3 이벤트를 저장할 ref (게임루프에서 UI로 전달)
    const v3EventsRef = useRef<V3SystemEvents>({});

    // 스폰 컨트롤러 상태 (Wave Pool + Formation)
    const spawnStateRef = useRef<SpawnState | null>(null);
    const formationWarningRef = useRef<FormationWarning | null>(null);

    // v7.15: 엘리트 몬스터 시스템
    const eliteSpawnStateRef = useRef<EliteSpawnState>(createEliteSpawnState());
    const eliteDropsRef = useRef<EliteDropItem[]>([]);
    const totalKillCountRef = useRef<number>(0); // 총 킬 카운트 (엘리트 스폰용)

    const initGame = useCallback(() => {
        if (!canvasRef.current) return;
        const classConfig = CLASS_DATA[playerClass];

        // NFT Effects (default to 0 if not provided)
        const nftDamageBonus = nftEffects?.damageBonus ?? 0;
        const nftSpeedBonus = nftEffects?.moveSpeedBonus ?? 0;
        const nftHPBonus = nftEffects?.maxHpBonus ?? 0;
        const nftCooldownBonus = nftEffects?.cooldownReduction ?? 0;
        const nftXPBonus = nftEffects?.gemBonusPercent ?? 0; // XP와 Gem 보너스 통합
        const nftDropBonus = nftEffects?.gemBonusPercent ?? 0;

        // SPEED: +10%(Lv1-5), +7%(Lv6-10), +5%(Lv11-15), +3%(Lv16-20) → Max +125%
        // + 캐릭터 강화 보너스 (레벨당 +2%)
        const speedBonus = calcTieredBonus(persistentUpgrades.speedLevel, [10, 7, 5, 3]);
        const speedMultiplier = (1 + (speedBonus / 100)) * (1 + (nftSpeedBonus / 100)) * (1 + characterBonus.speedBonus);
        const speed = GAME_CONFIG.PLAYER_SPEED * classConfig.speedMult * speedMultiplier;

        // HP: +20(Lv1-5), +15(Lv6-10), +10(Lv11-15), +5(Lv16-20) → Max +250 HP
        // + 캐릭터 강화 보너스 (레벨당 +5%)
        const hpBonus = calcTieredBonus(persistentUpgrades.armorLevel, [20, 15, 10, 5]);
        const maxHP = ((GAME_CONFIG.PLAYER_HP + hpBonus) * classConfig.hpMult) * (1 + (nftHPBonus / 100)) * (1 + characterBonus.hpBonus);

        // Haste: -5%(Lv1-5), -3.5%(Lv6-10), -2.5%(Lv11-15), -1.5%(Lv16-20) → Max -62.5%
        const hasteBonus = calcTieredBonus(persistentUpgrades.hasteLevel, [5, 3.5, 2.5, 1.5]);
        const cooldownMultiplier = Math.max(0.1, (1 - (hasteBonus / 100)) * (1 - (nftCooldownBonus / 100)));

        // Power: +10%(Lv1-5), +7%(Lv6-10), +5%(Lv11-15), +3%(Lv16-20) → Max +125%
        // + 캐릭터 강화 보너스 (레벨당 +5%)
        const powerBonus = calcTieredBonus(persistentUpgrades.powerLevel, [10, 7, 5, 3]);
        const damageMultiplier = (1 + (powerBonus / 100)) * (1 + (nftDamageBonus / 100)) * (1 + characterBonus.damageBonus);

        const specialCD = playerClass === 'tank' ? 5 : (playerClass === 'cypher' ? 1.0 : SPECIAL_SKILL.COOLDOWN);

        playerRef.current = {
            id: 'player',
            position: { x: 0, y: 0 },
            velocity: { x: 0, y: 0 },
            radius: GAME_CONFIG.PLAYER_RADIUS,
            // v7.22: 박스 충돌 추가 (이소메트릭 캐릭터에 맞춤)
            collisionBox: GAME_CONFIG.PLAYER_COLLISION_BOX,
            color: classConfig.color,
            health: maxHP,
            maxHealth: maxHP,
            speed: speed,
            angle: 0,
            score: 0,
            invulnerabilityTimer: 0,
            level: 1,
            xp: 0,
            nextLevelXp: XP_THRESHOLDS[1],
            weapons: {},
            weaponCooldowns: {},
            specialCooldown: 0,
            maxSpecialCooldown: specialCD,
            shield: 0,
            maxShield: 0,
            criticalChance: 0.05,
            criticalMultiplier: 1.5,
            playerClass: playerClass,
            stance: 'melee',
            knockback: { x: 0, y: 0 },
            hitFlashTimer: 0,
            statMultipliers: {
                speed: speedMultiplier,
                cooldown: cooldownMultiplier,
                damage: damageMultiplier,
                health: 1
            }
        };

        enemiesRef.current = [];
        particlesRef.current = [];
        damageNumbersRef.current = [];
        criticalEffectsRef.current = [];
        projectilesRef.current = [];
        enemyProjectilesRef.current = [];
        gemsRef.current = [];
        pickupsRef.current = [];
        blastsRef.current = [];
        lightningBoltsRef.current = [];
        lastSpawnTime.current = 0;
        gameTimeRef.current = 0;
        stageTimeRef.current = 0;
        frameCountRef.current = 0;

        // 스폰 컨트롤러 초기화 (스테이지 모드에서만)
        if (gameMode === 'stage') {
            spawnStateRef.current = createSpawnState(gameStateRef.current.stage);
        } else {
            spawnStateRef.current = null;
        }

        // v7.15: 엘리트 몬스터 시스템 초기화
        eliteSpawnStateRef.current = createEliteSpawnState();
        eliteDropsRef.current = [];
        totalKillCountRef.current = 0;
        // 특이점 모드: 첫 bomb 스폰 시간 (60-120초 후, 희귀 이벤트)
        nextBombSpawnTimeRef.current = 60 + Math.random() * 60;
        screenFlashRef.current = 0;
        screenShakeTimerRef.current = 0;
        screenShakeIntensityRef.current = 0;  // v7.8
        lastFacingRef.current = { x: 1, y: 0 }; // 기본: 오른쪽 바라봄 (공격/조준 방향)
        lastMoveFacingRef.current = { x: 1, y: 0 }; // 기본: 오른쪽 바라봄 (캐릭터 렌더링용)
        smoothedAutoHuntDirRef.current = { x: 0, y: 0 };
        lastAttackTimeRef.current = 0;
        lastDamageTimeRef.current = 0;
        // gameStateRef로 최신 스테이지 값 참조 (다음 스테이지 진입 시 정확한 값 사용)
        const targetStage = gameStateRef.current.stage;
        currentStageIdRef.current = targetStage;
        setCurrentStageId(targetStage);  // helpers.ts 전역 상태 초기화
        setCurrentGameMode(gameMode);    // v7.0: 맵 오브젝트 충돌용
        setCurrentMapSeed(targetStage * 12345);  // v7.0: 맵 시드 (스테이지 기반)
        bossSpawnedRef.current = false;
        warningTriggeredRef.current = false;
        lastReportedTime.current = -1;
        lastReportedScore.current = -1;
        lastReportedXp.current = -1;
        joystickRef.current = { active: false, origin: { x: 0, y: 0 }, current: { x: 0, y: 0 }, pointerId: null };

        // Reset Stuck Detection
        lastAutoHuntPosRef.current = { x: 0, y: 0 };
        stuckFrameCountRef.current = 0;
        escapeDirRef.current = null;

        // v3 시스템 리셋
        v3.resetAll();

        onScoreUpdate(0);
        onHealthUpdate(maxHP);
        onXpUpdate(0, XP_THRESHOLDS[1], 1);
        onTimeUpdate(0);
        onSpecialUpdate(0);
        onBossUpdate(null);
    }, [onScoreUpdate, onHealthUpdate, onXpUpdate, onTimeUpdate, onSpecialUpdate, onBossUpdate, playerClass, persistentUpgrades, nftEffects]);

    // resetTrigger가 변경될 때만 게임 초기화
    // upgrades를 ref로 캡처하여 initGame 직후 동기화
    const upgradesRef = React.useRef(upgrades);
    upgradesRef.current = upgrades;

    // v7.17 FIX: gameMode prop 변경 시 helpers.ts 전역 상태 즉시 동기화
    // Singularity 진입 시 resetTrigger는 안 바뀌어도 gameMode는 바뀜
    useEffect(() => {
        setCurrentGameMode(gameMode);
    }, [gameMode]);

    useEffect(() => {
        initGame();
        // initGame 직후 무기 동기화 (ref를 통해 최신 upgrades 참조)
        const p = playerRef.current;
        Object.entries(upgradesRef.current).forEach(([key, value]) => {
            const level = value as number;
            const type = key as WeaponType;
            if (level > 0) {
                const stats = WEAPON_DATA[type]?.stats[level - 1];
                if (stats) {
                    p.weapons[type] = stats;
                    p.weaponCooldowns[type] = 0;
                    if (type === 'stablecoin') {
                        p.maxShield = stats.amount;
                    }
                }
            }
        });
    }, [resetTrigger, initGame]);

    useEffect(() => {
        if (appliedReward) {
            const p = playerRef.current;
            if (appliedReward.type === 'heal') {
                p.health = p.maxHealth;
                onHealthUpdate(p.health);
                soundManager.playSFX('heal');
            } else if (appliedReward.type === 'score') {
                p.score += appliedReward.value;
                onScoreUpdate(p.score);
                soundManager.playSFX('levelup');
            } else if (appliedReward.type === 'bomb') {
                p.score += appliedReward.value;
                onScoreUpdate(p.score);
                soundManager.playSFX('explosion');
                enemiesRef.current.forEach(e => {
                    if (!e.isBoss) damageEnemy(e, 99999, 0, p.position, 'bomb');
                });
                screenFlashRef.current = 0.5;
            }
        }
    }, [appliedReward, onHealthUpdate, onScoreUpdate]);

    useEffect(() => {
        const p = playerRef.current;
        // 기존 무기 중 upgrades에 없는 것 제거 (레벨업 시 무기 레벨 변경 처리)
        Object.keys(p.weapons).forEach(key => {
            const type = key as WeaponType;
            if (!upgrades[type] || upgrades[type] === 0) {
                delete p.weapons[type];
                delete p.weaponCooldowns[type];
            }
        });
        // 새로운 무기 추가/업데이트
        Object.entries(upgrades).forEach(([key, value]) => {
            const level = value as number;
            const type = key as WeaponType;
            if (level > 0) {
                const stats = WEAPON_DATA[type]?.stats[level - 1];
                if (stats) {
                    p.weapons[type] = stats;
                    if (p.weaponCooldowns[type] === undefined) {
                        p.weaponCooldowns[type] = 0;
                    }
                    if (type === 'stablecoin') {
                        p.maxShield = p.weapons[type]!.amount;
                    }
                }
            }
        });
    }, [upgrades]);

    // 웨이브 ref
    const currentWaveRef = refs.currentWave;
    // phase 추적용 ref
    const currentPhaseRef = useRef(gameState.phase);

    useEffect(() => {
        // 스테이지 변경 시
        if (gameState.stage !== currentStageIdRef.current) {
            currentStageIdRef.current = gameState.stage;
            setCurrentStageId(gameState.stage);  // helpers.ts 전역 상태 동기화
            setCurrentMapSeed(gameState.stage * 12345);  // v7.0: 맵 시드 동기화
            currentWaveRef.current = gameState.wave || 1;
            currentPhaseRef.current = gameState.phase;
            stageTimeRef.current = 0;
            bossSpawnedRef.current = false;
            warningTriggeredRef.current = false;
            enemiesRef.current = [];
            enemyProjectilesRef.current = [];
        }
        // 웨이브 변경 시 (같은 스테이지 내)
        else if (gameState.wave !== currentWaveRef.current) {
            currentWaveRef.current = gameState.wave;
            currentPhaseRef.current = gameState.phase;
            stageTimeRef.current = 0;  // 웨이브 타이머 리셋
            bossSpawnedRef.current = false;
            warningTriggeredRef.current = false;
            // 적은 유지 (웨이브 간 전투 연속성)
            enemyProjectilesRef.current = [];
        }
        // phase가 farming으로 돌아올 때 (보스 처치 후 룰렛 완료)
        else if (gameState.phase === 'farming' && currentPhaseRef.current !== 'farming') {
            currentPhaseRef.current = gameState.phase;
            // 보스 스폰 관련 플래그만 리셋 (시간은 이미 wave 변경에서 리셋됨)
            bossSpawnedRef.current = false;
            warningTriggeredRef.current = false;
        }
        // phase 변경 추적
        else if (gameState.phase !== currentPhaseRef.current) {
            currentPhaseRef.current = gameState.phase;
        }
    }, [gameState.stage, gameState.wave, gameState.phase]);

    const handlePointerDown = (e: React.PointerEvent) => {
        if (!gameActive || isAutoHunt) return;
        if (joystickRef.current.active) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        joystickRef.current = {
            active: true,
            origin: { x: e.clientX, y: e.clientY },
            current: { x: e.clientX, y: e.clientY },
            pointerId: e.pointerId
        };
        canvas.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!gameActive || isAutoHunt || !joystickRef.current.active || e.pointerId !== joystickRef.current.pointerId) return;
        joystickRef.current.current = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (e.pointerId === joystickRef.current.pointerId) {
            joystickRef.current.active = false;
            joystickRef.current.pointerId = null;
        }
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            keysPressed.current.add(e.code);
            if (e.code === 'KeyE') {
                if (!gameActive) return;
                const p = playerRef.current;
                if (p.specialCooldown > 0) return;
                triggerSpecialSkill(p.position);
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => keysPressed.current.delete(e.code);
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [gameActive]);

    // 모듈 함수 래퍼들 - refs를 클로저로 전달
    const consolidateGems = () =>
        consolidateGemsSystem(gemsRef, playerRef.current.position);

    const triggerSpecialSkill = (pos: Vector2) => {
        const p = playerRef.current;
        // 발사속도 업그레이드(statMultipliers.cooldown) 적용
        p.specialCooldown = p.maxSpecialCooldown * p.statMultipliers.cooldown;
        onSpecialUpdate(p.specialCooldown);
        lastAttackTimeRef.current = Date.now();

        // Special Skill Animation 트리거 (Phase 2-2)
        p.specialAnim = 0.01; // 시작 (0이 아닌 값으로 시작해야 업데이트 시작)

        // === 캐릭터별 고유 궁극기 도파민 이펙트 ===
        // v5.7: playerClass prop 사용 (playerRef.current.playerClass 대신) - race condition 버그 수정
        if (playerClass === 'cypher') {
            // === CYPHER: Liquidation Beam - 복수의 스탠스 전환 ===
            // Phase 1: 글리치 전환 → Phase 2: 동전 폭풍 → Phase 3: 청산 공격
            p.stance = p.stance === 'melee' ? 'ranged' : 'melee';
            const stanceColor = p.stance === 'melee' ? '#ef4444' : '#3b82f6';
            const prevStanceColor = p.stance === 'melee' ? '#3b82f6' : '#ef4444';

            // 화면 효과: Flash + Shake (v7.8: intensity 추가)
            screenFlashRef.current = 0.35;
            screenShakeTimerRef.current = 0.2;
            screenShakeIntensityRef.current = 0.4;

            // === Phase 1: Stance Shift - 글리치 전환 (0-100ms) ===
            // RGB 분리 글리치 효과 (픽셀 분해)
            for (let i = 0; i < 25; i++) {
                const angle = Math.random() * Math.PI * 2;
                const dist = 20 + Math.random() * 30;
                const glitchColors = ['#ff0000', '#00ff00', '#0000ff']; // RGB
                particlesRef.current.push({
                    position: {
                        x: p.position.x + Math.cos(angle) * dist,
                        y: p.position.y + Math.sin(angle) * dist
                    },
                    velocity: {
                        x: (Math.random() - 0.5) * 200,
                        y: (Math.random() - 0.5) * 200
                    },
                    radius: 4 + Math.random() * 4,
                    color: glitchColors[i % 3],
                    life: 0.15,
                    maxLife: 0.15,
                    type: 'pixel',
                    easing: 'easeInExpo',
                    flickerRate: 0.3
                });
            }

            // 스캔라인 글리치
            for (let i = 0; i < 5; i++) {
                setTimeout(() => {
                    particlesRef.current.push({
                        position: { x: p.position.x, y: p.position.y - 30 + i * 15 },
                        velocity: { x: 300, y: 0 },
                        radius: 60,
                        color: prevStanceColor,
                        life: 0.08,
                        maxLife: 0.08,
                        type: 'line',
                        rotation: 0,
                        width: 2
                    });
                }, i * 15);
            }

            // 스탠스 전환 이중 링 (색상 전환)
            particlesRef.current.push({
                position: { ...p.position }, velocity: { x: 0, y: 0 },
                radius: 30,
                color: prevStanceColor,
                life: 0.3, maxLife: 0.3, type: 'ring', width: 6,
                scaleStart: 1, scaleEnd: 80,
                easing: 'easeOutExpo'
            });
            setTimeout(() => {
                particlesRef.current.push({
                    position: { ...p.position }, velocity: { x: 0, y: 0 },
                    radius: 30,
                    color: stanceColor,
                    life: 0.35, maxLife: 0.35, type: 'ring', width: 5,
                    scaleStart: 0.5, scaleEnd: 70,
                    easing: 'easeOutCubic',
                    glow: { enabled: true, preset: stanceColor === '#ef4444' ? 'fire' : 'electric' }
                });
            }, 50);

            // === Phase 2: Coin Storm - 동전 폭풍 (100-400ms) ===
            // 황금 동전 (물리 기반)
            setTimeout(() => {
                for (let i = 0; i < 30; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const speed = 180 + Math.random() * 280;
                    const coinColors = ['#facc15', '#fbbf24', '#fcd34d'];
                    particlesRef.current.push({
                        position: { ...p.position },
                        velocity: {
                            x: Math.cos(angle) * speed,
                            y: Math.sin(angle) * speed - 100  // 위로 튀어오름
                        },
                        radius: 6 + Math.random() * 5,
                        color: coinColors[Math.floor(Math.random() * coinColors.length)],
                        life: 0.9 + Math.random() * 0.4,
                        maxLife: 1.3,
                        type: 'square',
                        rotation: Math.PI / 4,
                        rotSpeed: 18 + Math.random() * 12,
                        gravity: 350,
                        bounce: 0.5,
                        easing: 'easeOutQuad',
                        trail: { enabled: true, length: 4, decay: 0.2, positions: [] },
                        glow: { enabled: true, preset: 'coin' }
                    });
                }
            }, 100);

            // $ 기호 방사 (오버슈트)
            for (let i = 0; i < 12; i++) {
                const angle = (Math.PI * 2 / 12) * i;
                setTimeout(() => {
                    particlesRef.current.push({
                        position: { ...p.position },
                        velocity: { x: Math.cos(angle) * 200, y: Math.sin(angle) * 200 - 60 },
                        radius: 14,
                        color: '#facc15',
                        life: 0.7,
                        maxLife: 0.7,
                        type: 'text',
                        text: '$',
                        rotation: 0,
                        rotSpeed: 6,
                        scaleStart: 0.3,
                        scaleEnd: 1.1,
                        easing: 'easeOutBack',
                        glow: { enabled: true, preset: 'golden' }
                    });
                }, 120 + i * 20);
            }

            // === Phase 3: Liquidation Strike - 청산 공격 (400-700ms) ===
            soundManager.playSFX('powerup');

            // 스탠스별 투사체 발사
            for (let i = 0; i < 12; i++) {
                const angle = (Math.PI * 2 / 12) * i;
                setTimeout(() => {
                    // 투사체 타입별 시각 효과
                    if (p.stance === 'melee') {
                        // 근접: 빨간 칼날
                        projectilesRef.current.push({
                            id: Math.random().toString(),
                            type: 'knife',
                            position: { ...p.position },
                            velocity: { x: Math.cos(angle) * 650, y: Math.sin(angle) * 650 },
                            radius: 10,
                            color: '#ef4444',
                            life: 1.2,
                            damage: 220 * p.statMultipliers.damage,
                            pierce: 999,
                            knockback: 40,
                            angle,
                            isUltimate: true
                        });
                        // 칼날 잔상
                        particlesRef.current.push({
                            position: { ...p.position },
                            velocity: { x: Math.cos(angle) * 600, y: Math.sin(angle) * 600 },
                            radius: 50,
                            color: '#ef4444',
                            life: 0.2,
                            maxLife: 0.2,
                            type: 'line',
                            rotation: angle,
                            width: 3,
                            easing: 'easeOutQuad',
                            glow: { enabled: true, preset: 'fire' }
                        });
                    } else {
                        // 원거리: 파란 에너지탄
                        projectilesRef.current.push({
                            id: Math.random().toString(),
                            type: 'wand',
                            position: { ...p.position },
                            velocity: { x: Math.cos(angle) * 700, y: Math.sin(angle) * 700 },
                            radius: 10,
                            color: '#3b82f6',
                            life: 1.2,
                            damage: 200 * p.statMultipliers.damage,
                            pierce: 999,
                            knockback: 25,
                            angle,
                            isUltimate: true
                        });
                        // 전기 아크
                        particlesRef.current.push({
                            position: { ...p.position },
                            velocity: { x: Math.cos(angle) * 650, y: Math.sin(angle) * 650 },
                            radius: 8,
                            color: '#60a5fa',
                            life: 0.25,
                            maxLife: 0.25,
                            type: 'spark',
                            trail: { enabled: true, length: 6, decay: 0.15, positions: [] },
                            easing: 'easeOutCubic',
                            glow: { enabled: true, preset: 'electric', pulseFreq: 6 }
                        });
                    }
                }, 400 + i * 25);
            }

            // 마무리 충격파
            setTimeout(() => {
                particlesRef.current.push({
                    position: { ...p.position },
                    velocity: { x: 0, y: 0 },
                    radius: 20,
                    color: stanceColor,
                    life: 0.4,
                    maxLife: 0.4,
                    type: 'ring',
                    width: 4,
                    scaleStart: 0.5,
                    scaleEnd: 150,
                    easing: 'easeOutQuad',
                    glow: { enabled: true, preset: 'intense' }
                });
            }, 450);

        } else if (playerClass === 'tank') {
            // === TANK: Hash Quake - 서버실 지진 ===
            // Phase 1: 지면 충전 → Phase 2: 지진 임팩트 → Phase 3: 먼지 정착
            const damage = 2000 * p.statMultipliers.damage;
            const radius = 500;

            // 화면 효과: 강력한 Shake + Flash (v7.8: intensity 추가)
            screenShakeTimerRef.current = 0.8;
            screenShakeIntensityRef.current = 1.0;  // 지진 효과 - 최대 강도
            screenFlashRef.current = 0.4;

            // === Phase 1: Ground Charge - 육각형 그리드 활성화 (0-150ms) ===
            // 바닥 육각형 패턴
            for (let ring = 0; ring < 3; ring++) {
                const hexCount = ring === 0 ? 1 : ring * 6;
                for (let i = 0; i < hexCount; i++) {
                    const angle = (Math.PI * 2 / hexCount) * i;
                    const dist = ring * 60;
                    const hexPos = {
                        x: pos.x + Math.cos(angle) * dist,
                        y: pos.y + Math.sin(angle) * dist
                    };
                    setTimeout(() => {
                        particlesRef.current.push({
                            position: hexPos,
                            velocity: { x: 0, y: 0 },
                            radius: 35,
                            color: '#374151',
                            colorEnd: '#dc2626',
                            life: 0.4,
                            maxLife: 0.4,
                            type: 'hex',
                            scaleStart: 0,
                            scaleEnd: 1,
                            easing: 'easeOutBack',
                            glow: { enabled: true, preset: 'fire', pulseFreq: 6 }
                        });
                    }, ring * 30 + i * 15);
                }
            }

            // 8방향 균열선 (빠른 확산)
            for (let i = 0; i < 8; i++) {
                const angle = (Math.PI * 2 / 8) * i;
                setTimeout(() => {
                    particlesRef.current.push({
                        position: { ...pos },
                        velocity: { x: Math.cos(angle) * 600, y: Math.sin(angle) * 600 },
                        radius: 100,
                        color: '#7f1d1d',
                        life: 0.25,
                        maxLife: 0.25,
                        type: 'line',
                        rotation: angle,
                        rotSpeed: 0,
                        width: 4,
                        easing: 'easeOutExpo',
                        glow: { enabled: true, preset: 'fire' }
                    });
                }, 50 + i * 15);
            }

            // === Phase 2: Earthquake Impact (150-400ms) ===
            // 암석 파편 (물리 기반 튀어오름)
            setTimeout(() => {
                for (let i = 0; i < 35; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const speed = 80 + Math.random() * 250;
                    const rockColors = ['#78716c', '#a8a29e', '#d6d3d1', '#dc2626', '#fef08a'];
                    particlesRef.current.push({
                        position: {
                            x: pos.x + (Math.random() - 0.5) * 150,
                            y: pos.y + (Math.random() - 0.5) * 150
                        },
                        velocity: {
                            x: Math.cos(angle) * speed,
                            y: -200 - Math.random() * 250  // 위로 강하게!
                        },
                        radius: 10 + Math.random() * 15,
                        color: rockColors[Math.floor(Math.random() * rockColors.length)],
                        life: 1.0 + Math.random() * 0.5,
                        maxLife: 1.5,
                        type: 'square',
                        rotation: Math.random() * Math.PI,
                        rotSpeed: 15 + Math.random() * 25,
                        gravity: 600,
                        bounce: 0.3,
                        drag: 0.01,
                        easing: 'easeOutQuad',
                        trail: { enabled: true, length: 4, decay: 0.25, positions: [] }
                    });
                }
            }, 150);

            // 4중 충격파 (탄성 진동)
            for (let r = 0; r < 4; r++) {
                setTimeout(() => {
                    particlesRef.current.push({
                        position: { ...pos },
                        velocity: { x: 0, y: 0 },
                        radius: 30,
                        color: ['#dc2626', '#ef4444', '#f87171', '#fca5a5'][r],
                        life: 0.5,
                        maxLife: 0.5,
                        type: 'ring',
                        width: 6 - r,
                        scaleStart: 0.2,
                        scaleEnd: 500 - r * 50,
                        easing: 'easeOutElastic',
                        glow: { enabled: true, preset: 'intense', pulseFreq: 4 }
                    });
                }, 150 + r * 70);
            }

            // === Phase 3: Dust Settle (400-800ms) ===
            // 먼지 구름
            setTimeout(() => {
                for (let i = 0; i < 20; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const dist = Math.random() * 200;
                    particlesRef.current.push({
                        position: {
                            x: pos.x + Math.cos(angle) * dist,
                            y: pos.y + Math.sin(angle) * dist
                        },
                        velocity: {
                            x: (Math.random() - 0.5) * 30,
                            y: -20 - Math.random() * 30
                        },
                        radius: 30 + Math.random() * 40,
                        color: '#78716c',
                        life: 0.6 + Math.random() * 0.4,
                        maxLife: 1.0,
                        type: 'smoke',
                        scaleStart: 1,
                        scaleEnd: 2,
                        easing: 'easeOutCubic',
                        drag: 0.05
                    });
                }
            }, 400);

            // 균열선 잔광 (용암빛)
            setTimeout(() => {
                for (let i = 0; i < 8; i++) {
                    const angle = (Math.PI * 2 / 8) * i;
                    for (let j = 1; j <= 4; j++) {
                        particlesRef.current.push({
                            position: {
                                x: pos.x + Math.cos(angle) * (j * 80),
                                y: pos.y + Math.sin(angle) * (j * 80)
                            },
                            velocity: { x: 0, y: 0 },
                            radius: 15,
                            color: '#dc2626',
                            colorEnd: '#7f1d1d',
                            life: 0.5,
                            maxLife: 0.5,
                            type: 'smoke',
                            glow: { enabled: true, preset: 'fire', pulseFreq: 3 }
                        });
                    }
                }
            }, 350);

            // 중앙 대폭발 섬광
            particlesRef.current.push({
                position: { ...pos }, velocity: { x: 0, y: 0 },
                radius: 100, color: '#ffffff', life: 0.18, maxLife: 0.18, type: 'smoke',
                glow: { enabled: true, preset: 'intense' }
            });
            particlesRef.current.push({
                position: { ...pos }, velocity: { x: 0, y: 0 },
                radius: 140, color: '#ef4444', life: 0.25, maxLife: 0.25, type: 'ring', width: 8
            });

            blastsRef.current.push({ id: Math.random().toString(), position: { ...pos }, radius: radius, life: 0.7, maxLife: 0.7, color: '#ef4444', type: 'smash' });
            soundManager.playSFX('explosion');
            enemiesRef.current.forEach(enemy => { if (distance(pos, enemy.position) <= radius) damageEnemy(enemy, damage, 220, pos, 'special'); });

        } else if (playerClass === 'morpheus') {
            // === MORPHEUS: Legacy Power - 손코딩 폭풍 ===
            // Phase 1: 타이핑 퓨리 → Phase 2: 코드 스톰 → Phase 3: 컴파일 성공
            const damage = 2500 * p.statMultipliers.damage;
            const radius = 450;

            // 화면 효과: 골드 Flash + Shake (v7.8: intensity 추가)
            screenFlashRef.current = 0.4;
            screenShakeTimerRef.current = 0.5;
            screenShakeIntensityRef.current = 0.8;  // 레거시 파워 - 강한 강도

            const codeChars = ['{', '}', '(', ')', '=>', '===', 'async', 'await', '/**/', '//', 'const', 'return', 'function'];
            const codeSnippets = ['function', 'const', 'return', 'async', 'await', 'import', 'export'];

            // === Phase 1: Typing Fury - 타이핑 스파크 (0-300ms) ===
            // 손가락에서 골든 스파크 (리드미컬)
            for (let i = 0; i < 15; i++) {
                setTimeout(() => {
                    for (let j = 0; j < 3; j++) {
                        const angle = Math.random() * Math.PI * 2;
                        const speed = 150 + Math.random() * 100;
                        particlesRef.current.push({
                            position: { ...pos },
                            velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed - 50 },
                            radius: 4 + Math.random() * 4,
                            color: '#fbbf24',
                            colorEnd: '#ffffff',
                            life: 0.25,
                            maxLife: 0.25,
                            type: 'spark',
                            easing: 'easeOutQuad',
                            trail: { enabled: true, length: 5, decay: 0.2, positions: [] },
                            glow: { enabled: true, preset: 'golden', pulseFreq: 8 }
                        });
                    }
                }, i * 25);  // 40fps 리듬
            }

            // 타이핑 커서 깜빡임
            for (let i = 0; i < 6; i++) {
                setTimeout(() => {
                    particlesRef.current.push({
                        position: { x: pos.x + 30, y: pos.y - 40 },
                        velocity: { x: 0, y: 0 },
                        radius: 16,
                        color: i % 2 === 0 ? '#fbbf24' : '#ffffff',
                        life: 0.08,
                        maxLife: 0.08,
                        type: 'text',
                        text: '|',
                        glow: { enabled: true, preset: 'golden' }
                    });
                }, i * 50);
            }

            // === Phase 2: Code Storm - 12방향 골든 빔 (300-700ms) ===
            // 순차 발사 (리듬감)
            for (let i = 0; i < 12; i++) {
                const angle = (Math.PI * 2 / 12) * i;
                setTimeout(() => {
                    // 골든 빔
                    particlesRef.current.push({
                        position: { ...pos },
                        velocity: { x: Math.cos(angle) * 650, y: Math.sin(angle) * 650 },
                        radius: 100,
                        color: '#fbbf24',
                        life: 0.35,
                        maxLife: 0.35,
                        type: 'line',
                        rotation: angle,
                        rotSpeed: 0,
                        width: 5,
                        easing: 'easeOutQuad',
                        glow: { enabled: true, preset: 'golden', pulseFreq: 0 },
                        trail: { enabled: true, length: 3, decay: 0.3, positions: [] }
                    });
                    // 빔 위 코드 스니펫
                    particlesRef.current.push({
                        position: { ...pos },
                        velocity: { x: Math.cos(angle) * 500, y: Math.sin(angle) * 500 },
                        radius: 10,
                        color: '#ffffff',
                        life: 0.4,
                        maxLife: 0.4,
                        type: 'text',
                        text: codeSnippets[i % codeSnippets.length],
                        rotation: angle,
                        rotSpeed: 0,
                        easing: 'easeOutCubic'
                    });
                }, 300 + i * 35);
            }

            // 코드 문자 폭풍 (나선형 방출)
            for (let i = 0; i < 25; i++) {
                const spiralAngle = (i / 25) * Math.PI * 4 + Math.random() * 0.3;
                const speed = 200 + i * 8;
                setTimeout(() => {
                    particlesRef.current.push({
                        position: { ...pos },
                        velocity: { x: Math.cos(spiralAngle) * speed, y: Math.sin(spiralAngle) * speed },
                        radius: 12 + Math.random() * 6,
                        color: Math.random() > 0.3 ? '#fbbf24' : '#ffffff',
                        life: 0.7,
                        maxLife: 0.7,
                        type: 'text',
                        text: codeChars[Math.floor(Math.random() * codeChars.length)],
                        rotation: spiralAngle,
                        rotSpeed: 6,
                        easing: 'easeOutQuad',
                        drag: 0.015,
                        glow: { enabled: true, preset: 'golden', pulseFreq: 2 }
                    });
                }, 350 + i * 12);
            }

            // 4중 황금 충격파
            for (let r = 0; r < 4; r++) {
                setTimeout(() => {
                    particlesRef.current.push({
                        position: { ...pos },
                        velocity: { x: 0, y: 0 },
                        radius: 25,
                        color: ['#fbbf24', '#f59e0b', '#d97706', '#b45309'][r],
                        life: 0.45,
                        maxLife: 0.45,
                        type: 'ring',
                        width: 5 - r,
                        scaleStart: 0.1,
                        scaleEnd: 400 - r * 40,
                        easing: 'easeOutCubic',
                        glow: { enabled: true, preset: 'intense' }
                    });
                }, 320 + r * 50);
            }

            // === Phase 3: Compile Success (700-1000ms) ===
            // "BUILD SUCCESS" 텍스트
            setTimeout(() => {
                particlesRef.current.push({
                    position: { x: pos.x, y: pos.y - 60 },
                    velocity: { x: 0, y: -30 },
                    radius: 18,
                    color: '#22c55e',
                    life: 0.8,
                    maxLife: 0.8,
                    type: 'text',
                    text: 'BUILD SUCCESS',
                    scaleStart: 0.5,
                    scaleEnd: 1.2,
                    easing: 'easeOutBack',
                    glow: { enabled: true, preset: 'success', pulseFreq: 3 }
                });
            }, 700);

            // 녹색 체크마크 파티클 (원형 배치)
            setTimeout(() => {
                for (let i = 0; i < 8; i++) {
                    const angle = (Math.PI * 2 / 8) * i;
                    const dist = 80;
                    particlesRef.current.push({
                        position: {
                            x: pos.x + Math.cos(angle) * dist,
                            y: pos.y + Math.sin(angle) * dist
                        },
                        velocity: { x: Math.cos(angle) * 50, y: Math.sin(angle) * 50 },
                        radius: 14,
                        color: '#22c55e',
                        life: 0.6,
                        maxLife: 0.6,
                        type: 'text',
                        text: '✓',
                        scaleStart: 0,
                        scaleEnd: 1,
                        easing: 'easeOutBounce',
                        glow: { enabled: true, preset: 'success' }
                    });
                }
            }, 750);

            // 터미널 로그 스크롤 효과
            const logLines = ['Compiling...', '> Done!', '0 errors'];
            for (let i = 0; i < logLines.length; i++) {
                setTimeout(() => {
                    particlesRef.current.push({
                        position: { x: pos.x - 40, y: pos.y + 30 + i * 18 },
                        velocity: { x: 0, y: -15 },
                        radius: 10,
                        color: i === 2 ? '#22c55e' : '#a3a3a3',
                        life: 0.5,
                        maxLife: 0.5,
                        type: 'text',
                        text: logLines[i],
                        easing: 'easeOutQuad'
                    });
                }, 720 + i * 80);
            }

            // 중앙 대폭발 섬광
            particlesRef.current.push({
                position: { ...pos }, velocity: { x: 0, y: 0 },
                radius: 90, color: '#ffffff', life: 0.15, maxLife: 0.15, type: 'smoke',
                glow: { enabled: true, preset: 'intense' }
            });
            particlesRef.current.push({
                position: { ...pos }, velocity: { x: 0, y: 0 },
                radius: 60, color: '#fbbf24', life: 0.12, maxLife: 0.12, type: 'smoke'
            });

            blastsRef.current.push({ id: Math.random().toString(), position: { ...pos }, radius: radius, life: 0.6, maxLife: 0.6, color: '#fbbf24', type: 'smash' });
            soundManager.playSFX('explosion');
            enemiesRef.current.forEach(enemy => { if (distance(pos, enemy.position) <= radius) damageEnemy(enemy, damage, 160, pos, 'special'); });

        } else {
            // === NEO: Genesis Nova - 매트릭스 각성 ===
            // Phase 1: 녹색 코드 수렴 → Phase 2: 레드필 폭발 → Phase 3: 코드 비
            const damage = 3000 * p.statMultipliers.damage;
            const radius = 400;

            // 화면 효과: 강력한 Flash + Shake (v7.8: intensity 추가)
            screenFlashRef.current = 0.5;
            screenShakeTimerRef.current = 0.4;
            screenShakeIntensityRef.current = 0.9;  // 제네시스 노바 - 매우 강한 강도

            // === Phase 1: Awakening - 매트릭스 코드 수렴 (0-200ms) ===
            const matrixChars = ['0', '1', '<', '>', '/', '{', '}', '(', ')', ';', '=', '||', '&&'];
            for (let i = 0; i < 30; i++) {
                const startAngle = Math.random() * Math.PI * 2;
                const startDist = 200 + Math.random() * 100;
                const startPos = {
                    x: pos.x + Math.cos(startAngle) * startDist,
                    y: pos.y + Math.sin(startAngle) * startDist
                };
                // 수렴하는 속도 (중심으로)
                const toCenter = { x: pos.x - startPos.x, y: pos.y - startPos.y };
                const dist = Math.sqrt(toCenter.x * toCenter.x + toCenter.y * toCenter.y);
                const speed = 400 + Math.random() * 200;
                particlesRef.current.push({
                    position: startPos,
                    velocity: { x: (toCenter.x / dist) * speed, y: (toCenter.y / dist) * speed },
                    radius: 10 + Math.random() * 6,
                    color: '#10B981',
                    colorEnd: '#ffffff',
                    life: 0.35,
                    maxLife: 0.35,
                    type: 'text',
                    text: matrixChars[Math.floor(Math.random() * matrixChars.length)],
                    rotation: Math.random() * Math.PI,
                    rotSpeed: 8,
                    delay: i * 8,
                    easing: 'easeInQuad',
                    glow: { enabled: true, preset: 'matrix', pulseFreq: 4 },
                    trail: { enabled: true, length: 6, decay: 0.2, positions: [] }
                });
            }

            // === Phase 2: Red Pill Explosion - 충격파 (200-500ms) ===
            // 3중 충격파 링 (순차 발동)
            const ringColors = ['#ff0000', '#ff4400', '#ff8800'];
            for (let r = 0; r < 3; r++) {
                setTimeout(() => {
                    particlesRef.current.push({
                        position: { ...pos },
                        velocity: { x: 0, y: 0 },
                        radius: 20,
                        color: ringColors[r],
                        life: 0.5,
                        maxLife: 0.5,
                        type: 'ring',
                        width: 6 - r,
                        scaleStart: 0.1,
                        scaleEnd: 400 - r * 40,
                        easing: 'easeOutExpo',
                        glow: { enabled: true, preset: 'intense', pulseFreq: 3 }
                    });
                }, 200 + r * 60);
            }

            // 바이너리 방사 (360도)
            for (let i = 0; i < 40; i++) {
                const angle = (Math.PI * 2 / 40) * i + Math.random() * 0.1;
                const speed = 350 + Math.random() * 150;
                setTimeout(() => {
                    particlesRef.current.push({
                        position: { ...pos },
                        velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
                        radius: 12,
                        color: '#ff0000',
                        colorEnd: '#10B981',
                        life: 0.6,
                        maxLife: 0.6,
                        type: 'text',
                        text: Math.random() > 0.5 ? '1' : '0',
                        rotation: angle,
                        rotSpeed: 12,
                        easing: 'easeOutQuad',
                        drag: 0.02,
                        glow: { enabled: true, preset: 'matrix' }
                    });
                }, 250 + i * 5);
            }

            // 12방향 레드 빔
            for (let i = 0; i < 12; i++) {
                const angle = (Math.PI * 2 / 12) * i;
                setTimeout(() => {
                    particlesRef.current.push({
                        position: { ...pos },
                        velocity: { x: Math.cos(angle) * 700, y: Math.sin(angle) * 700 },
                        radius: 120,
                        color: '#ff0000',
                        life: 0.3,
                        maxLife: 0.3,
                        type: 'line',
                        rotation: angle,
                        rotSpeed: 0,
                        easing: 'easeOutCubic',
                        glow: { enabled: true, preset: 'intense' }
                    });
                    // 빔 끝 스파크
                    particlesRef.current.push({
                        position: { ...pos },
                        velocity: { x: Math.cos(angle) * 750, y: Math.sin(angle) * 750 },
                        radius: 18,
                        color: '#ffffff',
                        life: 0.35,
                        maxLife: 0.35,
                        type: 'spark',
                        easing: 'easeOutQuad'
                    });
                }, 280 + i * 20);
            }

            // === Phase 3: Code Rain Aftermath (500-1000ms) ===
            // 떨어지는 코드 비
            setTimeout(() => {
                for (let i = 0; i < 35; i++) {
                    const xOffset = (Math.random() - 0.5) * 500;
                    particlesRef.current.push({
                        position: { x: pos.x + xOffset, y: pos.y - 200 - Math.random() * 100 },
                        velocity: { x: 0, y: 150 + Math.random() * 100 },
                        radius: 10 + Math.random() * 6,
                        color: '#10B981',
                        colorEnd: '#003300',
                        life: 0.8 + Math.random() * 0.4,
                        maxLife: 1.2,
                        type: 'text',
                        text: matrixChars[Math.floor(Math.random() * matrixChars.length)],
                        rotation: 0,
                        rotSpeed: 0,
                        gravity: 200,
                        easing: 'easeOutCubic',
                        glow: { enabled: true, preset: 'matrix', pulseFreq: 2 }
                    });
                }
            }, 500);

            // 중앙 대폭발 섬광
            particlesRef.current.push({
                position: { ...pos }, velocity: { x: 0, y: 0 },
                radius: 120, color: '#ffffff', life: 0.15, maxLife: 0.15, type: 'smoke',
                glow: { enabled: true, preset: 'intense' }
            });
            particlesRef.current.push({
                position: { ...pos }, velocity: { x: 0, y: 0 },
                radius: 80, color: '#ff0000', life: 0.12, maxLife: 0.12, type: 'smoke'
            });

            blastsRef.current.push({ id: Math.random().toString(), position: { ...pos }, radius: radius, life: 0.6, maxLife: 0.6, color: '#ff0000', type: 'purge' });
            soundManager.playSFX('explosion');
            enemiesRef.current.forEach(enemy => { if (distance(pos, enemy.position) <= radius) damageEnemy(enemy, damage, 120, pos, 'special'); });
        }
    };

    const spawnEnemyProjectile = (pos: Vector2, vel: Vector2, color: string, damage: number, radius: number = 8) =>
        spawnEnemyProjectileSystem(enemyProjectilesRef, pos, vel, color, damage, radius);

    const spawnEnemy = (types: EnemyType[], isBossSpawn: boolean = false, wave: WaveNumber = 1) => {
        const prevCount = enemiesRef.current.length;
        spawnEnemySystem(enemiesRef, playerRef.current, gameTimeRef.current, gameState.stage, types, isBossSpawn, onBossUpdate, wave);

        // v7.15: 엘리트 스폰 체크 (보스가 아닌 일반 적 스폰 시)
        if (!isBossSpawn && enemiesRef.current.length > prevCount) {
            const eliteResult = checkEliteSpawn(
                totalKillCountRef.current,
                gameTimeRef.current,
                eliteSpawnStateRef.current,
                playerRef.current
            );

            if (eliteResult.shouldSpawn && eliteResult.tier && eliteResult.hp && eliteResult.dropCount) {
                // 마지막으로 스폰된 적을 엘리트로 변환
                const lastEnemy = enemiesRef.current[enemiesRef.current.length - 1];
                if (lastEnemy && !lastEnemy.isBoss) {
                    const eliteEnemy = convertToElite(lastEnemy, eliteResult.tier, eliteResult.hp, eliteResult.dropCount);
                    enemiesRef.current[enemiesRef.current.length - 1] = eliteEnemy;

                    // 스폰 상태 업데이트
                    eliteSpawnStateRef.current = updateEliteSpawnState(
                        eliteSpawnStateRef.current,
                        totalKillCountRef.current,
                        true
                    );

                    // 엘리트 등장 효과
                    soundManager.playSFX('alarm');
                    screenShakeTimerRef.current = 0.2;
                    screenShakeIntensityRef.current = 0.3 + (eliteResult.tier === 'diamond' ? 0.3 : eliteResult.tier === 'gold' ? 0.2 : 0);
                }
            }
        }
    };

    // 특이점 모드 전용 보스 스폰 (50종의 고유 보스)
    const spawnSingularityBoss = (bossEvent: import('@/lib/matrix/hooks/useSingularity').SingularityBossSpawnEvent) => {
        const player = playerRef.current;
        if (!player) return;

        const { boss, scaling } = bossEvent;

        // 스폰 위치 계산 (플레이어 주변 원형)
        const angle = Math.random() * Math.PI * 2;
        const spawnDist = GAME_CONFIG.SPAWN_RADIUS;
        const spawnPos = {
            x: player.position.x + Math.cos(angle) * spawnDist,
            y: player.position.y + Math.sin(angle) * spawnDist
        };

        // 스케일링 적용된 최종 스탯
        const finalHp = boss.baseHp * scaling.hpScale;
        const finalDmg = boss.baseDamage * scaling.damageScale;
        const finalSpeed = boss.baseSpeed * Math.min(1.4, scaling.speedScale);

        const enemy: Enemy = {
            id: `singularity_boss_${boss.id}_${Date.now()}`,
            position: spawnPos,
            velocity: { x: 0, y: 0 },
            radius: boss.baseRadius,
            color: boss.color,
            health: finalHp,
            maxHealth: finalHp,
            damage: finalDmg,
            speed: finalSpeed,
            enemyType: `boss_${boss.id}_1` as EnemyType, // 내부 타입 호환용
            state: 'chasing',
            stunTimer: 0,
            mass: boss.tier === 'stage' ? 100 : 50,
            hitBy: new Set(),
            isBoss: true,
            isFrozen: false,
            name: boss.name, // 보스 이름 (UI 표시용)
            skillCooldown: 2,
            maxSkillCooldown: 2,
            skillType: (boss.skills[0] || 'shoot') as import('@/lib/matrix/types').BossSkillType,
            skillDuration: 0,
            skillWarning: false,
            bossTier: boss.tier,
            bossSkills: boss.skills as import('@/lib/matrix/types').BossSkillType[],
            currentSkillIndex: 0,
            attackType: 'melee'
        };

        enemiesRef.current.push(enemy);

        // 보스 등장 이펙트
        soundManager.playSFX('alarm');

        // 화면 효과 (v7.8: intensity 추가)
        if (boss.specialEffect === 'screen_shake') {
            screenShakeTimerRef.current = 0.5;
            screenShakeIntensityRef.current = 0.7;  // 보스 등장 쉐이크
        } else if (boss.specialEffect === 'flash') {
            screenFlashRef.current = 0.3;
        }
    };

    // 동적 카메라 줌 계산 - 항상 적이 화면에 보이도록
    const calculateTargetZoom = useCallback(() => {
        const player = playerRef.current;
        const enemies = enemiesRef.current;
        const canvas = canvasRef.current;
        if (!canvas) return ZOOM_CONFIG.DEFAULT_ZOOM;

        const screenWidth = canvas.width;
        const screenHeight = canvas.height;
        const halfScreenDiag = Math.sqrt(screenWidth * screenWidth + screenHeight * screenHeight) / 2;

        // 살아있는 적들의 거리 계산
        const aliveEnemies: { dist: number; isBoss: boolean }[] = [];
        let closeEnemyCount = 0;
        let bossNearby = false;

        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            if (e.state === 'dying') continue;
            const d = distance(e.position, player.position);
            aliveEnemies.push({ dist: d, isBoss: !!e.isBoss });
            if (d < ZOOM_CONFIG.CLOSE_RANGE) closeEnemyCount++;
            if (e.isBoss && d < ZOOM_CONFIG.BOSS_RANGE) bossNearby = true;
        }

        // 적이 없으면 기본 줌
        if (aliveEnemies.length === 0) {
            return ZOOM_CONFIG.DEFAULT_ZOOM;
        }

        // 거리순 정렬
        aliveEnemies.sort((a, b) => a.dist - b.dist);

        // 1. 줌인 조건: 근거리에 적이 많거나 보스가 가까움
        if (closeEnemyCount >= ZOOM_CONFIG.CLOSE_ENEMY_HIGH || bossNearby) {
            return ZOOM_CONFIG.MAX_ZOOM;
        }

        // 2. 가시성 기반 줌 계산: N번째 가까운 적이 화면에 보이도록
        const targetEnemyIndex = Math.min(ZOOM_CONFIG.MIN_ENEMIES_TO_SHOW - 1, aliveEnemies.length - 1);
        const targetEnemyDist = aliveEnemies[targetEnemyIndex].dist;

        // 화면 절반 크기 (줌 1.0 기준)
        const baseHalfView = Math.min(screenWidth, screenHeight) / 2;

        // 적이 화면에 보이려면 필요한 줌 계산
        // viewSize = screenSize / zoom, 적이 viewSize/2 - margin 안에 있어야 함
        // targetDist < (screenSize/2 - margin) / zoom
        // zoom < (screenSize/2 - margin) / targetDist
        const margin = ZOOM_CONFIG.ENEMY_VISIBLE_MARGIN;
        const requiredZoom = (baseHalfView - margin) / Math.max(targetEnemyDist, 100);

        // 3. 가장 가까운 적이 너무 멀면 줌아웃
        const nearestDist = aliveEnemies[0].dist;
        if (nearestDist > ZOOM_CONFIG.FAR_RANGE) {
            // 먼 적도 보이도록 더 줌아웃
            const farZoom = (baseHalfView - margin) / nearestDist;
            return Math.max(ZOOM_CONFIG.MIN_ZOOM, Math.min(farZoom, ZOOM_CONFIG.DEFAULT_ZOOM));
        }

        // 줌 범위 제한
        const clampedZoom = Math.max(ZOOM_CONFIG.MIN_ZOOM, Math.min(requiredZoom, ZOOM_CONFIG.MAX_ZOOM));

        return clampedZoom;
    }, []);

    // 부드러운 줌 보간 (단순 LERP - 자연스럽고 일정한 속도)
    const smoothZoom = useCallback(() => {
        const current = currentZoomRef.current;
        const target = targetZoomRef.current;

        // LERP: current + (target - current) * factor
        // factor가 작을수록 천천히, 자연스럽게 변화
        currentZoomRef.current = current + (target - current) * ZOOM_CONFIG.LERP_FACTOR;
    }, []);

    const update = (deltaTime: number) => {
        const player = playerRef.current;
        if (!canvasRef.current) return;

        // 개발 모드 시간 배속 적용
        const scaledDelta = deltaTime * timeScaleRef.current;

        frameCountRef.current++;
        if (frameCountRef.current % 30 === 0) {
            consolidateGems();
            if (player.weapons.garlic?.isEvolved) {
                player.health = Math.min(player.maxHealth, player.health + 0.1);
                onHealthUpdate(player.health);
            }
            // 관리자 모드용 entity count 업데이트
            onEntityCountUpdate?.({
                enemies: enemiesRef.current.length,
                particles: particlesRef.current.length,
                projectiles: projectilesRef.current.length,
            });
        }

        // 동적 카메라 줌 업데이트 (10프레임마다 목표 계산, 매 프레임 보간)
        if (frameCountRef.current % 10 === 0) {
            targetZoomRef.current = calculateTargetZoom();
        }
        smoothZoom();

        if (frameCountRef.current % 10 === 0) onWeaponCooldownsUpdate({ ...player.weaponCooldowns });
        if (screenFlashRef.current > 0) screenFlashRef.current = Math.max(0, screenFlashRef.current - scaledDelta);
        // v7.8: 화면 쉐이크 타이머 감소, 타이머 종료 시 강도도 리셋
        if (screenShakeTimerRef.current > 0) {
            screenShakeTimerRef.current = Math.max(0, screenShakeTimerRef.current - scaledDelta);
            if (screenShakeTimerRef.current <= 0) screenShakeIntensityRef.current = 0;
        }
        if (player.hitFlashTimer > 0) player.hitFlashTimer = Math.max(0, player.hitFlashTimer - scaledDelta);

        // Enhanced Animation Timers (Phase 1)
        if (player.hitReaction?.active && player.hitReaction.timer > 0) {
          player.hitReaction.timer = Math.max(0, player.hitReaction.timer - scaledDelta);
          if (player.hitReaction.timer <= 0) player.hitReaction.active = false;
        }
        if (player.attackAnim?.active && player.attackAnim.timer > 0) {
          player.attackAnim.timer = Math.max(0, player.attackAnim.timer - scaledDelta);
          if (player.attackAnim.timer <= 0) player.attackAnim.active = false;
        }
        if (player.levelUpAnim && player.levelUpAnim > 0) {
          player.levelUpAnim = Math.min(1, player.levelUpAnim + scaledDelta * 1.25); // 0.8초 동안
          if (player.levelUpAnim >= 1) player.levelUpAnim = 0;
        }
        if (player.specialAnim && player.specialAnim > 0) {
          player.specialAnim = Math.min(1, player.specialAnim + scaledDelta * 2); // 0.5초 동안
          if (player.specialAnim >= 1) player.specialAnim = 0;
        }

        gameTimeRef.current += scaledDelta;
        stageTimeRef.current += scaledDelta;

        // Arena 모드 업데이트 (에이전트 AI, 세이프존, 리스폰 등)
        if (onArenaUpdate) {
            onArenaUpdate(scaledDelta);
        }

        // Arena 채팅 메시지 페이드아웃 업데이트
        if (arenaAgentsRef.current.length > 0) {
            updateChatMessages(scaledDelta);
        }

        // v8.0 Arena: AI 에이전트 전투 시스템 (무기 발사, 타겟팅)
        if (arenaAgentsRef.current.length > 0 && canvasRef.current) {
            const canvas = canvasRef.current;
            updateAllAgentsCombat(
                arenaAgentsRef.current,
                enemiesRef.current,
                scaledDelta,
                {
                    projectiles: projectilesRef,
                    lightningBolts: lightningBoltsRef,
                    blasts: blastsRef,
                    enemies: enemiesRef,
                },
                { width: canvas.width, height: canvas.height },
                (enemy: Enemy, damage: number, knockback: number, sourcePos: Vector2, weaponType: WeaponType | 'special' = 'special', isUltimate: boolean = false) => {
                    damageEnemy(enemy, damage, knockback, sourcePos, weaponType, isUltimate);
                }
            );
        }

        // v3 시스템 업데이트 (콤보, 쉬는시간, 쪽지시험)
        const v3Events = v3.updateAll(scaledDelta, gameTimeRef.current, playerRef.current.level);
        // onKill에서 설정한 콤보 이벤트와 병합 (덮어쓰지 않음)
        const mergedEvents = {
            ...v3Events,
            combo: v3EventsRef.current.combo || v3Events.combo,
        };
        v3EventsRef.current = {};  // 병합 후 리셋

        // 콤보 화면 쉐이크 적용 (티어업, 마일스톤) - 도파민!
        if (mergedEvents.combo?.screenShake) {
            const { intensity, duration } = mergedEvents.combo.screenShake;
            screenShakeTimerRef.current = Math.max(screenShakeTimerRef.current, duration);
            screenShakeIntensityRef.current = Math.max(screenShakeIntensityRef.current, intensity);
        }

        // v3 상태를 외부로 전달 (UI 업데이트용)
        if (onV3Update) {
            onV3Update(v3.v3State.current, mergedEvents);
        }

        // 특이점 모드: 생존 시간 업데이트
        if (gameMode === 'singularity' && onSingularityTimeUpdate) {
            onSingularityTimeUpdate(gameTimeRef.current);
        }

        if (Math.floor(gameTimeRef.current) > Math.floor(lastReportedTime.current)) {
            onTimeUpdate(gameTimeRef.current);
            lastReportedTime.current = gameTimeRef.current;
        }

        if (player.specialCooldown > 0) {
            player.specialCooldown = Math.max(0, player.specialCooldown - scaledDelta);
            onSpecialUpdate(player.specialCooldown);
        }

        // Arena mode: No wave/boss system - continuous spawning
        const currentWave = 1;

        // Arena mode: No boss spawning - this section disabled
        if (false) {
            // Legacy boss spawn code removed for Arena mode
            const bossEvent: import('@/lib/matrix/hooks/useSingularity').SingularityBossSpawnEvent | null = null;
            if (bossEvent) {
                spawnSingularityBoss(bossEvent!);
            }
        }

        // 특이점 모드: 마일스톤 체크 (5분, 10분, 15분... 달성 시 NFT 드랍 체크)
        if (gameMode === 'singularity' && onSingularityMilestoneCheck && onMilestoneAchieved) {
            const milestoneEvent = onSingularityMilestoneCheck(gameTimeRef.current);
            if (milestoneEvent) {
                // 마일스톤 달성! NFT 드랍 체크 콜백 호출
                onMilestoneAchieved(milestoneEvent.milestoneMinutes);
            }
        }

        // 특이점 모드: 시간 기반 bomb(호재) 스폰
        // 희귀 이벤트로 변경 - 3분에 1개 정도
        if (gameMode === 'singularity') {
            const currentTime = gameTimeRef.current;
            if (currentTime >= nextBombSpawnTimeRef.current) {
                // bomb 스폰 - 플레이어 주변 랜덤 위치에 생성
                const player = playerRef.current;
                const spawnAngle = Math.random() * Math.PI * 2;
                const spawnDist = 150 + Math.random() * 200; // 150-350px 거리
                const bombPos = {
                    x: player.position.x + Math.cos(spawnAngle) * spawnDist,
                    y: player.position.y + Math.sin(spawnAngle) * spawnDist
                };

                pickupsRef.current.push({
                    id: Math.random().toString(),
                    type: 'bomb' as PickupType,
                    position: bombPos,
                    radius: 12,
                    life: 30,
                });

                // 다음 스폰 시간 설정 - 희귀 이벤트로 변경 (3-5분 간격)
                // 0-5분: 120-180초 (2-3분), 5-15분: 180-300초 (3-5분), 15분+: 300-480초 (5-8분)
                const minutes = currentTime / 60;
                let baseInterval: number;
                let variance: number;
                if (minutes < 5) {
                    baseInterval = 120; variance = 60;     // 120-180초 (2-3분)
                } else if (minutes < 15) {
                    baseInterval = 180; variance = 120;    // 180-300초 (3-5분)
                } else {
                    baseInterval = 300; variance = 180;    // 300-480초 (5-8분)
                }
                nextBombSpawnTimeRef.current = currentTime + baseInterval + Math.random() * variance;
            }
        }

        // Arena mode: No boss spawning - legacy boss code removed

        let moveDir = { x: 0, y: 0 };

        if (isAutoHunt) {
            // Auto Hunt 이동 - 캐싱된 Context 객체 재사용
            const ctx = cachedAutoHuntCtx.current;
            ctx.enemies = enemiesRef.current;
            ctx.enemyProjectiles = enemyProjectilesRef.current;
            ctx.gems = gemsRef.current;
            ctx.pickups = pickupsRef.current;
            ctx.lastFacing = lastFacingRef.current;

            // 근접 무기 접근 모드용 무기 범위 계산
            // 원거리 무기: wand, knife, bow, crossbow, axe, lightning, beam, phishing
            const RANGED_WEAPONS = ['wand', 'knife', 'bow', 'crossbow', 'axe', 'lightning', 'beam', 'phishing'];
            // 근접/오라 무기: sword, whip, punch, garlic, bible, pool
            const MELEE_AURA_WEAPONS = ['sword', 'whip', 'punch', 'garlic', 'bible', 'pool'];

            let maxRange = 0;
            let hasRanged = false;
            Object.keys(player.weapons).forEach((weaponKey) => {
                const wType = weaponKey as WeaponType;
                if (RANGED_WEAPONS.includes(wType)) {
                    hasRanged = true;
                } else if (MELEE_AURA_WEAPONS.includes(wType)) {
                    const stats = player.weapons[wType];
                    if (stats && stats.area > maxRange) {
                        maxRange = stats.area;
                    }
                }
            });
            ctx.maxWeaponRange = maxRange;
            ctx.hasRangedWeapon = hasRanged;

            moveDir = processAutoHuntMovement(player, ctx, cachedMovementRefs.current, frameCountRef.current);
        } else {
            // 수동 입력 처리 - 시스템 모듈 사용
            const inputState: InputState = {
                keysPressed: keysPressed.current,
                joystick: {
                    active: joystickRef.current.active,
                    origin: joystickRef.current.origin,
                    current: joystickRef.current.current,
                },
            };
            moveDir = processManualInput(inputState, lastFacingRef, lastMoveFacingRef);

            // v5.9: 이소메트릭 모드에서 수동 입력만 월드 좌표로 역변환
            // 화면 기준 입력을 월드 좌표로 변환해야 화면에서 보이는 방향대로 이동함
            // Auto Hunt는 이미 월드 좌표 기준이므로 변환 불필요!
            // 이소메트릭 변환: screenX = worldX - worldY, screenY = 0.5*(worldX + worldY)
            // 역변환: worldX = 0.5*screenX + screenY, worldY = -0.5*screenX + screenY
            if (ISO_ENABLED && (moveDir.x !== 0 || moveDir.y !== 0)) {
                const screenDX = moveDir.x;
                const screenDY = moveDir.y;
                const worldDX = 0.5 * screenDX + screenDY;
                const worldDY = -0.5 * screenDX + screenDY;
                // 정규화 (길이 유지)
                const len = Math.sqrt(worldDX * worldDX + worldDY * worldDY);
                if (len > 0) {
                    moveDir.x = worldDX / len;
                    moveDir.y = worldDY / len;
                }
            }
        }

        // KNOCKBACK PHYSICS
        player.knockback.x *= 0.85;
        player.knockback.y *= 0.85;
        if (Math.abs(player.knockback.x) < 0.1) player.knockback.x = 0;
        if (Math.abs(player.knockback.y) < 0.1) player.knockback.y = 0;

        // v3 시스템: 속도 배율 적용 (콤보 보너스 + 쪽지시험 페널티)
        const v3SpeedMult = v3.getSpeedMultiplier();
        // overclock 스킬: 이동속도 보너스 (amount / 1000 = 배율)
        const overclockBonus = (player.weapons.overclock?.amount || 0) / 1000;
        const effectiveSpeed = player.speed * v3SpeedMult * (1 + overclockBonus);
        player.velocity.x = moveDir.x * effectiveSpeed + player.knockback.x;
        player.velocity.y = moveDir.y * effectiveSpeed + player.knockback.y;

        const nextX = player.position.x + player.velocity.x * scaledDelta;
        const nextY = player.position.y + player.velocity.y * scaledDelta;

        // Spawn Dust Particles if moving
        const speed = Math.sqrt(player.velocity.x * player.velocity.x + player.velocity.y * player.velocity.y);

        // 튜토리얼 이동 트래킹
        if (gameMode === 'tutorial' && onTutorialMove && speed > 10) {
            onTutorialMove(speed * scaledDelta);
        }

        // 장애물 충돌 체크 - helpers 모듈 사용
        // v7.22: 박스 충돌 지원
        const collidedX = checkAxisCollision(nextX, player.position.y, player.radius, 'x', 3, player.collisionBox);
        const collidedY = checkAxisCollision(nextY, player.position.x, player.radius, 'y', 3, player.collisionBox);
        if (!collidedX) player.position.x = nextX;
        if (!collidedY) player.position.y = nextY;

        const pickupCtx: PickupCollectContext = {
            player,
            gems: gemsRef.current,
            enemies: enemiesRef.current,
            screenFlash: screenFlashRef,
            onHealthUpdate,
            onChestCollected,
            onMaterialCollected,
            spawnDamageNumber,
            damageEnemy: (enemy, dmg, kb, srcPos, wpnType) => damageEnemy(enemy, dmg, kb, srcPos, wpnType),
        };
        // v7.17: in-place 업데이트로 변경 (GC 압박 감소)
        // v7.23: upgrade_material 자동 끌림 추가 (오브젝트 위 드랍 수집 문제 해결)
        {
            const pickups = pickupsRef.current;
            let writeIdx = 0;
            for (let i = 0; i < pickups.length; i++) {
                const p = pickups[i];
                p.life -= scaledDelta;

                // v7.23: upgrade_material은 플레이어 근처로 자동 끌림 (120px 범위)
                // v7.24: ease-in 이징 적용 - 가까울수록 빠르게 "쏘오옥" 흡수
                if (p.type === 'upgrade_material') {
                    const dx = player.position.x - p.position.x;
                    const dy = player.position.y - p.position.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const magnetRange = 120;

                    if (dist < magnetRange && dist > player.radius + p.radius) {
                        // ease-in: t^2 곡선 (가까울수록 빠름)
                        // t = 1 - (dist / magnetRange) → 가까우면 t≈1, 멀면 t≈0
                        const t = 1 - dist / magnetRange;
                        const eased = t * t; // quadratic ease-in

                        // lerp factor: 기본 8% + easing으로 최대 25% (가까우면 빠름)
                        const lerpFactor = 0.08 + eased * 0.17;

                        p.position.x += dx * lerpFactor;
                        p.position.y += dy * lerpFactor;
                    }
                }

                const d = distance(player.position, p.position);
                if (d < player.radius + p.radius) {
                    collectPickupSystem(p, pickupCtx);
                    // 아이템 획득 알림
                    if (onNotifyItem) {
                        const pickupNames: Record<string, { name: string; icon: string }> = {
                            chicken: { name: 'HP 회복', icon: 'heart' },
                            magnet: { name: '젬 자석', icon: 'magnet' },
                            bomb: { name: '전체 공격', icon: 'zap' },
                            chest: { name: '보물 상자', icon: 'gift' },
                            upgrade_material: { name: '강화 재료', icon: 'star' },
                        };
                        const info = pickupNames[p.type];
                        if (info) onNotifyItem(info.name, info.icon);
                    }
                    // 이벤트 로그 - 아이템 획득 (chicken/bomb 제외 - 너무 자주 나옴)
                    if (onEventLog && p.type !== 'chicken' && p.type !== 'bomb') {
                        const pickupEffects: Record<string, string> = {
                            magnet: '젬 흡수!',
                            chest: '보물 발견!',
                            upgrade_material: '+1 재료',
                        };
                        onEventLog('pickup', pickupEffects[p.type] || p.type);
                    }
                    continue; // 수집됨 - 배열에 추가하지 않음
                }
                if (p.life > 0) {
                    pickups[writeIdx++] = p;
                }
            }
            pickups.length = writeIdx;
        }

        // 젬 수집 시스템 - 모듈 사용
        const magnetBonus = (player.weapons.aggregator?.area || 0) / 100;
        const gemCtx: GemCollectContext = {
            player,
            magnetRange: GAME_CONFIG.GEM_MAGNET_RANGE * (1 + magnetBonus),
            collectSpeed: GAME_CONFIG.GEM_COLLECT_SPEED,
            despawnRadius: GAME_CONFIG.DESPAWN_RADIUS,
            lastCollectSfx: lastCollectSfxRef,
            lastReportedXp: lastReportedXp,
            xpThresholds: XP_THRESHOLDS,
            onLevelUp,
            onXpUpdate,
            xpBonusPercent: nftEffects?.gemBonusPercent ?? 0,
            onTutorialGemCollect: gameMode === 'tutorial' ? onTutorialGemCollect : undefined,
            // v3 시스템: XP 배율 (콤보 + 쉬는시간)
            v3XpMultiplier: v3.getXpMultiplier(),
        };
        gemsRef.current = updateGems(gemsRef.current, gemCtx, scaledDelta);

        // v8.1 Arena: AI 에이전트 젬 수집 시스템
        // - 각 젬에 대해 가장 가까운 에이전트가 수집 (로컬 플레이어는 위에서 처리됨)
        // - 에이전트별 마그넷 범위 체크 및 XP 부여
        if (arenaAgentsRef.current.length > 0) {
            const arenaGemMagnetRange = GAME_CONFIG.GEM_MAGNET_RANGE;
            const arenaGemCollectSpeed = GAME_CONFIG.GEM_COLLECT_SPEED;
            const gems = gemsRef.current;
            const agentsList = arenaAgentsRef.current.filter(a => a.isAlive && !a.isLocalPlayer);

            let gemWriteIdx = 0;
            for (let gi = 0; gi < gems.length; gi++) {
                const gem = gems[gi];
                let shouldKeepGem = true;
                let closestAgent: typeof agentsList[0] | null = null;
                let closestDistSq = Infinity;

                // 가장 가까운 에이전트 찾기
                for (const agent of agentsList) {
                    const gdx = agent.position.x - gem.position.x;
                    const gdy = agent.position.y - gem.position.y;
                    const gDistSq = gdx * gdx + gdy * gdy;
                    if (gDistSq < closestDistSq) {
                        closestDistSq = gDistSq;
                        closestAgent = agent;
                    }
                }

                if (closestAgent) {
                    const gdx = closestAgent.position.x - gem.position.x;
                    const gdy = closestAgent.position.y - gem.position.y;
                    const gDist = Math.sqrt(closestDistSq);

                    // 이미 수집 중인 젬 처리 (로컬 플레이어가 수집 중이면 건너뜀)
                    if (gem.isCollected) {
                        // 에이전트 수집 범위 체크
                        if (gDist < closestAgent.radius * 2) {
                            // 에이전트가 젬 수집!
                            if (addAgentXp) {
                                addAgentXp(closestAgent.agentId, gem.value);
                            }
                            shouldKeepGem = false;
                        } else if (gDist < arenaGemMagnetRange * 1.5) {
                            // 에이전트 쪽으로 이동 (로컬 플레이어 쪽 이동보다 느림)
                            gem.position.x += (gdx / gDist) * arenaGemCollectSpeed * 0.5 * scaledDelta;
                            gem.position.y += (gdy / gDist) * arenaGemCollectSpeed * 0.5 * scaledDelta;
                        }
                    } else {
                        // 에이전트 마그넷 범위 체크
                        if (closestDistSq < arenaGemMagnetRange * arenaGemMagnetRange) {
                            // 에이전트가 더 가까우면 에이전트 쪽으로 끌림 설정
                            gem.isCollected = true;
                        }
                    }
                }

                if (shouldKeepGem) {
                    gems[gemWriteIdx++] = gem;
                }
            }
            gems.length = gemWriteIdx;
        }

        // v7.40: 엘리트 드랍 직접 수집 시스템 (Pickup 변환 제거)
        // - 물리 시뮬레이션 후 바로 수집 가능
        // - isCollectable 상태에서 마그넷 끌림 + 플레이어 충돌 시 수집
        const ELITE_DROP_RADIUS = 12; // 크리스탈 크기 (고정)
        const ELITE_MAGNET_RANGE = 120;
        const updatedDrops: EliteDropItem[] = [];
        for (const drop of eliteDropsRef.current) {
            const updatedDrop = updateEliteDropPhysics(drop, scaledDelta);

            // 수집 가능한 상태에서만 수집/마그넷 처리
            if (updatedDrop.isCollectable) {
                const dx = player.position.x - updatedDrop.position.x;
                const dy = player.position.y - updatedDrop.position.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                // 플레이어와 충돌 시 직접 수집
                if (dist < player.radius + ELITE_DROP_RADIUS) {
                    // 사운드 + 콜백
                    soundManager.playSFX('powerup');
                    if (onMaterialCollected) {
                        onMaterialCollected();
                    }
                    // 아이템 획득 알림
                    if (onNotifyItem) {
                        onNotifyItem('강화 재료', 'star');
                    }
                    // 수집됨 - 배열에 추가 안함 (제거)
                    continue;
                }

                // 마그넷 끌림 (ease-in lerp)
                if (dist < ELITE_MAGNET_RANGE && dist > player.radius + ELITE_DROP_RADIUS) {
                    const t = 1 - dist / ELITE_MAGNET_RANGE;
                    const eased = t * t; // quadratic ease-in
                    const lerpFactor = 0.08 + eased * 0.17;
                    updatedDrop.position.x += dx * lerpFactor;
                    updatedDrop.position.y += dy * lerpFactor;
                }
            }

            updatedDrops.push(updatedDrop);
        }
        eliteDropsRef.current = updatedDrops;

        try {
            // 무기 시스템 컨텍스트 구성
            const weaponCtx: WeaponFireContext = {
                player,
                projectiles: projectilesRef.current,
                lightningBolts: lightningBoltsRef.current,
                blasts: blastsRef.current,
                enemies: enemiesRef.current,
                lastFacing: lastFacingRef.current,
                lastAttackTime: lastAttackTimeRef,
                canvasWidth: canvasRef.current?.width || window.innerWidth,
                canvasHeight: canvasRef.current?.height || window.innerHeight,
                damageEnemy: (enemy, dmg, kb, srcPos, wpnType, isUlt) => damageEnemy(enemy, dmg, kb, srcPos, wpnType, isUlt),
            };

            (Object.keys(player.weapons) as WeaponType[]).forEach(type => {
                if (type === 'aggregator' || type === 'oracle') return;
                const stats = player.weapons[type];
                if (!stats) return;

                // 쿨다운이 undefined면 0으로 초기화 (즉시 발사 가능)
                if (player.weaponCooldowns[type] === undefined) {
                    player.weaponCooldowns[type] = 0;
                }

                if (player.weaponCooldowns[type]! > 0) {
                    player.weaponCooldowns[type]! -= scaledDelta;
                }

                if (player.weaponCooldowns[type]! <= 0) {
                    fireWeapon(type, stats, weaponCtx);
                    // Apply Haste Multiplier to Weapon Cooldown
                    player.weaponCooldowns[type] = stats.cooldown * player.statMultipliers.cooldown;

                    // v6.1: 공격 스프라이트 재생을 위한 타임스탬프 업데이트
                    lastAttackTimeRef.current = Date.now();

                    // v6.2: Attack Animation 트리거 - 모든 무기에 대해 설정
                    const attackDuration = Math.min(stats.cooldown * 0.25, 0.2); // 쿨다운의 25%, 최대 0.2초
                    // 근거리 무기: 긴 애니메이션
                    if (['punch', 'whip', 'sword', 'axe', 'bible', 'garlic', 'lightning'].includes(type)) {
                      player.attackAnim = { active: true, timer: attackDuration, weaponType: type, duration: attackDuration };
                    } else {
                      // 원거리/마법/기타 무기: 짧은 애니메이션
                      player.attackAnim = { active: true, timer: 0.15, weaponType: type, duration: 0.15 };
                    }
                    // 폭발 스킬 화면 흔들림 (도파민!) - v7.8: intensity 추가
                    if (type === 'mempool' || type === 'airdrop' || type === 'genesis') {
                        const shakeTime = type === 'genesis' ? 0.4 : (type === 'mempool' ? 0.25 : 0.2);
                        const shakeIntensity = type === 'genesis' ? 0.6 : (type === 'mempool' ? 0.4 : 0.35);
                        screenShakeTimerRef.current = Math.max(screenShakeTimerRef.current, shakeTime);
                        screenShakeIntensityRef.current = Math.max(screenShakeIntensityRef.current, shakeIntensity);
                        if (stats.isUltimate) screenFlashRef.current = Math.max(screenFlashRef.current, 0.15);
                    }
                }
                if (type === 'garlic') {
                    const activeGarlic = projectilesRef.current.find((p: Projectile) => p.type === 'garlic');
                    if (activeGarlic) {
                        activeGarlic.radius = stats.area;
                        activeGarlic.damage = stats.damage * player.statMultipliers.damage;
                        activeGarlic.isEvolved = stats.isEvolved;
                        activeGarlic.isUltimate = stats.isUltimate;
                    }
                }
            });
        } catch (e) {
            console.error("Critical Weapon System Error (Supressed to maintain Game Loop):", e);
        }

        // E2E 테스터 모드: 항상 무적 유지
        if (testerMode) {
            player.invulnerabilityTimer = 99999;
        } else if (player.invulnerabilityTimer > 0) {
            player.invulnerabilityTimer -= scaledDelta;
        }

        try {
            if (gameState.phase === 'farming' || gameMode === 'singularity' || gameMode === 'tutorial') {
                // 최적화: 역순 배열 미리 캐싱된 함수 사용 (slice().reverse() 매 프레임 호출 제거)
                // 특이점 모드: 전용 웨이브 사용 (원거리 몬스터 빈도 높음, gameTimeRef 기준)
                // 튜토리얼 모드: 5초 후부터 적 스폰 시작 (이동 미션 완료 후)
                const tutorialSpawnDelay = 5; // 튜토리얼 적 스폰 딜레이 (초)
                const shouldSpawnInTutorial = gameMode === 'tutorial' && gameTimeRef.current >= tutorialSpawnDelay;

                if (gameMode !== 'tutorial' || shouldSpawnInTutorial) {
                    // ======================================
                    // 스테이지 모드: SpawnController 사용 (Wave Pool + Formation)
                    // ======================================
                    if (gameMode === 'stage' && spawnStateRef.current) {
                        const spawnState = spawnStateRef.current;

                        // 스폰 컨트롤러 업데이트
                        const spawnResult = updateSpawnController(
                            spawnState,
                            scaledDelta,
                            player,
                            gameState.stage,
                            enemiesRef.current.length,
                            gameTimeRef.current
                        );

                        // 포메이션 경고 상태 업데이트 (렌더링용)
                        formationWarningRef.current = getFormationWarning(spawnState);

                        // 펜딩된 포메이션 스폰 처리
                        const pendingFormation = consumePendingFormation(spawnState);
                        if (pendingFormation) {
                            // 포메이션 위치에 적 스폰
                            for (const pos of pendingFormation.positions) {
                                if (enemiesRef.current.length < GAME_CONFIG.MAX_ENEMIES) {
                                    // 단일 적 타입으로 스폰 (포메이션 = 같은 종류)
                                    spawnEnemy([pendingFormation.enemyType]);
                                    // 스폰 위치 조정 (spawnEnemy는 플레이어 주변에 스폰하므로, 직접 위치 설정)
                                    const lastEnemy = enemiesRef.current[enemiesRef.current.length - 1];
                                    if (lastEnemy) {
                                        lastEnemy.position = { ...pos };
                                    }
                                }
                            }
                        }

                        // 백그라운드 스폰 (활성 풀에서만)
                        if (spawnResult.shouldSpawnBackground) {
                            const activeType = pickRandomActiveType(spawnState);
                            spawnEnemy([activeType]);
                        }
                    }
                    // ======================================
                    // 싱귤래리티/튜토리얼: 기존 로직 사용
                    // ======================================
                    else {
                        const waveTime = gameMode === 'singularity' ? gameTimeRef.current :
                                         gameMode === 'tutorial' ? (gameTimeRef.current - tutorialSpawnDelay) :
                                         stageTimeRef.current;

                        const currentWaveData = getWaveForTime(Math.max(0, waveTime), gameMode === 'singularity');

                        // 특이점 모드: 스폰 간격에 난이도 배율 적용
                        // 튜토리얼 모드: 느린 스폰 (2배 간격)
                        // v3 시스템: 쉬는시간 스폰 배율 적용 (배율 높으면 간격 감소)
                        let spawnInterval = currentWaveData.spawnInterval;
                        const v3SpawnMult = v3.getSpawnMultiplier();
                        if (v3SpawnMult > 1) {
                            spawnInterval /= v3SpawnMult; // 배율 3이면 간격 1/3로 감소
                        }
                        if (gameMode === 'singularity' && singularityDifficultyMultiplier) {
                            spawnInterval *= singularityDifficultyMultiplier.spawnRate;
                        } else if (gameMode === 'tutorial') {
                            spawnInterval *= 2; // 튜토리얼은 느리게 스폰
                        }

                        // 튜토리얼은 최대 적 수 제한 (5마리)
                        const maxEnemies = gameMode === 'tutorial' ? 5 : GAME_CONFIG.MAX_ENEMIES;

                        if (enemiesRef.current.length < maxEnemies && Date.now() - lastSpawnTime.current > spawnInterval) {
                            spawnEnemy(currentWaveData.types); lastSpawnTime.current = Date.now();
                        }
                    }
                }
            }
        } catch (e) {
            console.error("Critical Spawn System Error (Supressed):", e);
        }

        // 적 투사체 시스템 - 모듈 사용
        const enemyProjCtx: EnemyProjectileContext = {
            player,
            onShieldHit: () => spawnDamageNumber(player.position, 0, true),
            onPlayerDamaged: () => {
                lastDamageTimeRef.current = Date.now(); // 피격 이펙트용 시간 기록
                onDamageTaken();
            },
            onGameOver,
            onHealthUpdate,
            // v7.8.4: 은은한 화면 쉐이크 (짧은 지속, 낮은 강도)
            onScreenShake: (intensity: number) => {
                screenShakeTimerRef.current = Math.max(screenShakeTimerRef.current, 0.12 + intensity * 0.08);
                screenShakeIntensityRef.current = Math.max(screenShakeIntensityRef.current, intensity * 0.8);
            },
        };
        enemyProjectilesRef.current = updateEnemyProjectiles(enemyProjectilesRef.current, enemyProjCtx, scaledDelta);

        // 투사체 시스템 업데이트 - 모듈 사용
        try {
            const projCtx: ProjectileSystemContext = {
                player,
                enemies: enemiesRef.current,
                blasts: blastsRef.current,
                // v8.1.2: ownerId 추가 - AI 에이전트 킬 구분
                damageEnemy: (enemy, dmg, kb, srcPos, wpnType, isUlt, ownerId) => damageEnemy(enemy, dmg, kb, srcPos, wpnType, isUlt, ownerId),
            };
            projectilesRef.current = updatePlayerProjectiles(projectilesRef.current, projCtx, scaledDelta);

            // v8.1.6: Arena Mode - 플레이어 투사체 → AI 에이전트 충돌 검사
            if (arenaAgentsRef.current.length > 0 && onArenaAgentDamage) {
                const playerAgentId = arenaAgentsRef.current.find(a => a.isLocalPlayer)?.agentId || 'player';

                for (const proj of projectilesRef.current) {
                    // 플레이어(로컬) 투사체만 검사 - AI 투사체는 별도 처리
                    const ownerId = getProjectileOwnerId(proj);
                    const isPlayerProjectile = !ownerId || ownerId === playerAgentId;

                    if (!isPlayerProjectile) continue;

                    for (const agent of arenaAgentsRef.current) {
                        // 자신에게는 데미지 안 줌
                        if (agent.isLocalPlayer) continue;
                        if (!agent.isAlive) continue;
                        if (agent.respawnInvincibility > 0) continue;

                        // 충돌 검사
                        if (checkProjectileAgentCollision(proj, agent, playerAgentId)) {
                            // PvP 데미지 적용
                            const result = applyPvPDamage(agent, proj.damage || 10, proj.type, playerAgentId);

                            // 콜백으로 상태 업데이트 전달
                            onArenaAgentDamage(agent.agentId, result.damage, playerAgentId);

                            // 투사체 소멸 (pierce가 아닌 경우)
                            if (!proj.pierce || proj.pierce <= 0) {
                                proj.life = 0;
                            } else if (proj.pierce > 0) {
                                proj.pierce--;
                            }

                            break; // 한 투사체당 하나의 에이전트만 맞힘
                        }
                    }
                }
            }
        } catch (e) {
            console.error("Critical Projectile System Error (Supressed):", e);
        }

        blastsRef.current = updateBlasts(blastsRef.current, scaledDelta);

        // 터렛 시스템 업데이트 v5.0 - 플레이어 머리 위 떠다니기
        if (placedTurretsRef.current.length > 0) {
            const currentTime = Date.now();

            // 터렛 AI 업데이트 (공격, 어빌리티 발동)
            const turretResult = updateTurrets(
                placedTurretsRef.current,
                enemiesRef.current,
                scaledDelta * 1000, // ms 단위
                currentTime,
                player.position // v5.0: 플레이어 위치 전달 (터렛이 따라다님)
            );

            // v4.9: 통합 투사체는 기존 projectilesRef에 추가 (캐릭터 무기와 동일 처리)
            if (turretResult.newUnifiedProjectiles.length > 0) {
                projectilesRef.current.push(...turretResult.newUnifiedProjectiles);
            }
            if (turretResult.newAoeEffects.length > 0) {
                turretAoeEffectsRef.current.push(...turretResult.newAoeEffects);
            }

            // 업데이트된 터렛 상태 적용 (ref에 직접 반영)
            placedTurretsRef.current = turretResult.updatedTurrets;
            if (onTurretsUpdate) {
                onTurretsUpdate(turretResult.updatedTurrets);
            }

            // v4.9: 터렛 투사체는 이제 projectilesRef로 통합 처리 (updatePlayerProjectiles에서 homing 로직 포함)

            // 터렛 AOE 효과 업데이트
            if (turretAoeEffectsRef.current.length > 0) {
                const aoeResult = updateTurretAoeEffects(
                    turretAoeEffectsRef.current,
                    enemiesRef.current,
                    scaledDelta * 1000, // ms 단위
                    currentTime
                );
                turretAoeEffectsRef.current = aoeResult.updatedEffects;

                // AOE 피격 처리
                aoeResult.affectedEnemies.forEach(affected => {
                    const enemy = enemiesRef.current.find(e => e.id === affected.enemyId);
                    if (enemy) {
                        // 중력장 효과 (끌어당김)
                        if (affected.effect?.startsWith('pull:')) {
                            const [, pullX, pullY] = affected.effect.split(':').map(Number);
                            enemy.position.x += pullX;
                            enemy.position.y += pullY;
                        }
                        // 피해 적용
                        if (affected.damage > 0) {
                            damageEnemy(enemy, affected.damage, 0, enemy.position, 'special');
                        }
                    }
                });
            }
        }

        // 플레이어 위치 업데이트 (터렛 배치용)
        if (onPlayerPositionUpdate) {
            onPlayerPositionUpdate(player.position.x, player.position.y);
        }

        // 상태이상 업데이트 (독/동결 틱 데미지)
        updateStatusEffects(enemiesRef.current, scaledDelta, damageNumbersRef);
        // 30분+ 성능 최적화: in-place 업데이트 + 배열 크기 제한 + 순차 체이닝 딜레이
        {
            const bolts = lightningBoltsRef.current;
            let writeIdx = 0;
            for (let i = 0; i < bolts.length; i++) {
                const bolt = bolts[i];
                // 딜레이가 있으면 먼저 딜레이 소진
                if (bolt.delay && bolt.delay > 0) {
                    bolt.delay -= scaledDelta;
                } else {
                    // 딜레이 끝나면 life 감소
                    bolt.life -= scaledDelta;
                }
                if (bolt.life > 0) bolts[writeIdx++] = bolt;
            }
            bolts.length = Math.min(writeIdx, GAME_CONFIG.MAX_LIGHTNING_BOLTS);
        }

        try {
            // 보스 시스템 콜백 구성
            const bossCallbacks: BossSystemCallbacks = {
                spawnEnemyProjectile,
                spawnEnemy,
                spawnParticles,
            };

            // 원거리 적 콜백 구성
            const rangedCallbacks: RangedEnemyCallbacks = {
                spawnEnemyProjectile,
                spawnParticles,
            };

            // 적 업데이트 - 최적화된 루프
            const enemies = enemiesRef.current;
            const enemyCount = enemies.length;
            const playerRadius = player.radius;
            const despawnRadius = GAME_CONFIG.DESPAWN_RADIUS;
            const friction = GAME_CONFIG.FRICTION;

            // v8.1 Arena: 모든 살아있는 에이전트 목록 (몬스터 타겟팅용)
            const arenaAgents = arenaAgentsRef.current;
            const aliveAgents = arenaAgents.filter(a => a.isAlive);
            const hasArenaAgents = aliveAgents.length > 0;

            // 적 충돌 체크 최적화: 10프레임마다만 수행
            const doSeparation = frameCountRef.current % 10 === 0;

            let writeIdx = 0;
            for (let i = 0; i < enemyCount; i++) {
                const enemy = enemies[i];
                const isRanged = enemy.attackType === 'ranged';

                // v8.1 Arena: 가장 가까운 에이전트 타겟팅 (몬스터가 모든 에이전트 공격)
                let playerPos = player.position;
                if (hasArenaAgents) {
                    let minDistSq = Infinity;
                    for (const agent of aliveAgents) {
                        const adx = agent.position.x - enemy.position.x;
                        const ady = agent.position.y - enemy.position.y;
                        const distSq = adx * adx + ady * ady;
                        if (distSq < minDistSq) {
                            minDistSq = distSq;
                            playerPos = agent.position;
                        }
                    }
                }

                // Arena mode: No boss behavior - bosses don't exist

                // 원거리 적 업데이트 - v8.1: 가장 가까운 타겟 사용
                if (isRanged) {
                    // Arena 모드: 가장 가까운 에이전트를 타겟으로 하는 가짜 플레이어 객체 생성
                    const targetForRanged = hasArenaAgents
                        ? { ...player, position: playerPos }
                        : player;
                    updateRangedEnemy(enemy, targetForRanged, scaledDelta, gameTimeRef.current, rangedCallbacks);
                }

                // 죽은 적 처리
                if (enemy.health <= 0 && enemy.state !== 'dying') {
                    damageEnemy(enemy, 99999, 0, playerPos, 'special');
                }

                // 거리 계산 (한 번만)
                const dx = playerPos.x - enemy.position.x;
                const dy = playerPos.y - enemy.position.y;
                const distSq = dx * dx + dy * dy;
                const distToPlayer = Math.sqrt(distSq);

                // 디스폰 체크
                if (!enemy.isBoss && distToPlayer > despawnRadius) continue;

                // Death Animation 처리 (도파민 타격감!)
                if (enemy.state === 'dying') {
                    if (enemy.deathTimer !== undefined && enemy.deathTimer > 0) {
                        // 사망 애니메이션 진행 중
                        enemy.deathTimer -= scaledDelta;

                        // 밀려나면서 이동 (마찰 적용)
                        if (enemy.deathVelocity) {
                            enemy.position.x += enemy.deathVelocity.x * scaledDelta;
                            enemy.position.y += enemy.deathVelocity.y * scaledDelta;
                            // 급격한 감속 (0.85 마찰)
                            enemy.deathVelocity.x *= 0.85;
                            enemy.deathVelocity.y *= 0.85;
                        }

                        // 스케일 감소 (터지면서 작아짐)
                        const deathProgress = 1 - (enemy.deathTimer / 0.25);
                        enemy.deathScale = Math.max(0.3, 1 - deathProgress * 0.7);

                        // 아직 애니메이션 중이면 유지
                        enemies[writeIdx++] = enemy;
                        continue;
                    }
                    // deathTimer 끝나면 제거 (continue로 writeIdx에 추가 안 함)
                    continue;
                }

                // 스턴 상태 처리
                if (enemy.state === 'stunned') {
                    enemy.stunTimer -= scaledDelta;
                    if (enemy.stunTimer <= 0) { enemy.state = 'chasing'; enemy.isFrozen = false; }
                    enemy.velocity.x *= friction;
                    enemy.velocity.y *= friction;
                    enemy.position.x += enemy.velocity.x * scaledDelta;
                    enemy.position.y += enemy.velocity.y * scaledDelta;
                } else if (enemy.state !== 'dashing' && !isRanged) {
                    // 근접 적 분리 (최적화: 10프레임마다)
                    if (doSeparation && enemyCount > 1) {
                        const randIdx = (i + frameCountRef.current) % enemyCount;
                        const other = enemies[randIdx];
                        if (other && other !== enemy && other.state !== 'dying') {
                            const sepDx = enemy.position.x - other.position.x;
                            const sepDy = enemy.position.y - other.position.y;
                            const sepDistSq = sepDx * sepDx + sepDy * sepDy;
                            const minSep = enemy.radius + other.radius;
                            if (sepDistSq < minSep * minSep && sepDistSq > 0.001) {
                                const sepDist = Math.sqrt(sepDistSq);
                                const pushStrength = 15 * scaledDelta;
                                const newSepX = enemy.position.x + (sepDx / sepDist) * pushStrength;
                                const newSepY = enemy.position.y + (sepDy / sepDist) * pushStrength;
                                // 지형지물 충돌 체크
                                if (!isObstacleAt(newSepX, enemy.position.y, enemy.radius)) {
                                    enemy.position.x = newSepX;
                                }
                                if (!isObstacleAt(enemy.position.x, newSepY, enemy.radius)) {
                                    enemy.position.y = newSepY;
                                }
                            }
                        }
                    }
                    // 플레이어 추적 + 지형지물 충돌
                    const invDist = distToPlayer > 0.01 ? 1 / distToPlayer : 0;
                    const moveX = dx * invDist * enemy.speed * scaledDelta;
                    const moveY = dy * invDist * enemy.speed * scaledDelta;
                    const nextEnemyX = enemy.position.x + moveX;
                    const nextEnemyY = enemy.position.y + moveY;

                    // 보스가 아닌 일반 적만 지형지물 충돌 체크
                    if (enemy.isBoss) {
                        enemy.position.x = nextEnemyX;
                        enemy.position.y = nextEnemyY;
                    } else {
                        if (!isObstacleAt(nextEnemyX, enemy.position.y, enemy.radius)) {
                            enemy.position.x = nextEnemyX;
                        }
                        if (!isObstacleAt(enemy.position.x, nextEnemyY, enemy.radius)) {
                            enemy.position.y = nextEnemyY;
                        }
                    }
                }

                // 보스 업데이트 콜백
                if (enemy.isBoss) onBossUpdate(enemy);

                // 플레이어 충돌 - v8.1.1: 항상 실제 로컬 플레이어 위치로 계산 (playerPos는 타겟용)
                const actualPlayerDx = player.position.x - enemy.position.x;
                const actualPlayerDy = player.position.y - enemy.position.y;
                const actualDistToPlayer = Math.sqrt(actualPlayerDx * actualPlayerDx + actualPlayerDy * actualPlayerDy);
                const collisionDist = playerRadius + enemy.radius;
                if (actualDistToPlayer < collisionDist) {
                    const collisionCtx: EnemyCollisionContext = {
                        player,
                        onShieldHit: () => spawnDamageNumber(playerPos, 0, true),
                        onPlayerDamaged: () => {
                            lastDamageTimeRef.current = Date.now(); // 피격 이펙트용 시간 기록
                            onDamageTaken();
                        },
                        onHealthUpdate,
                        onGameOver,
                        // v3 시스템: 플레이어 피격 시 콤보 리셋 및 쪽지시험 처리
                        onV3PlayerHit: v3.onPlayerHit,
                        // v7.8.4: 은은한 화면 쉐이크 (짧은 지속, 낮은 강도)
                        onScreenShake: (intensity: number) => {
                            screenShakeTimerRef.current = Math.max(screenShakeTimerRef.current, 0.12 + intensity * 0.08);
                            screenShakeIntensityRef.current = Math.max(screenShakeIntensityRef.current, intensity * 0.8);
                        },
                        // v5.7: 방어력 보너스 (데미지 감소율)
                        defBonus: characterBonus.defBonus || 0,
                    };
                    handleEnemyCollision(enemy, collisionCtx);
                }

                // v8.1 Arena: 에이전트-몬스터 충돌 처리
                if (hasArenaAgents && (enemy.state as string) !== 'dying') {
                    for (const agent of aliveAgents) {
                        if (agent.isLocalPlayer) continue; // 로컬 플레이어는 위에서 처리됨
                        if (agent.respawnInvincibility > 0) continue; // 리스폰 무적 상태

                        const agentDx = agent.position.x - enemy.position.x;
                        const agentDy = agent.position.y - enemy.position.y;
                        const agentDistSq = agentDx * agentDx + agentDy * agentDy;
                        const agentCollisionDist = agent.radius + enemy.radius;

                        if (agentDistSq < agentCollisionDist * agentCollisionDist) {
                            // 에이전트에게 데미지 - onArenaAgentDamage 콜백 호출
                            if (onArenaAgentDamage) {
                                onArenaAgentDamage(agent.agentId, enemy.damage);
                            }
                        }
                    }
                }

                // 터렛 충돌 (적이 터렛 공격)
                if (placedTurretsRef.current.length > 0 && (enemy.state as string) !== 'dying') {
                    for (let t = 0; t < placedTurretsRef.current.length; t++) {
                        const turret = placedTurretsRef.current[t];
                        const tdx = turret.x - enemy.position.x;
                        const tdy = turret.y - enemy.position.y;
                        const turretDist = Math.sqrt(tdx * tdx + tdy * tdy);
                        const turretCollisionDist = 30 + enemy.radius; // 터렛 반경 약 30

                        if (turretDist < turretCollisionDist) {
                            // 터렛 피격
                            const updatedTurret = damageTurret(turret, enemy.damage * scaledDelta);
                            if (updatedTurret) {
                                placedTurretsRef.current[t] = updatedTurret;
                            } else {
                                // 터렛 파괴
                                placedTurretsRef.current.splice(t, 1);
                                t--;
                                // 파괴 이펙트
                                // @ts-expect-error — legacy argument order mismatch (count, pos swapped)
                                spawnParticles(10, { x: turret.x, y: turret.y }, '#888', 'pixel', 50);
                            }
                        }
                    }
                }

                // 살아있는 적 유지
                enemies[writeIdx++] = enemy;
            }
            enemies.length = writeIdx;
        } catch (e) {
            console.error("Critical Enemy System Error (Supressed):", e);
        }

        // 30분+ 성능 최적화: in-place 업데이트로 GC 압박 감소 + v4 이펙트 시스템
        {
            const particles = particlesRef.current;
            let writeIdx = 0;
            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];

                // v4: delay 처리 - 딜레이가 남아있으면 위치/라이프 업데이트 스킵
                if (p.delay !== undefined && p.delay > 0) {
                    if (p.delayRemaining === undefined) p.delayRemaining = p.delay;
                    p.delayRemaining -= scaledDelta * 1000; // ms 단위
                    if (p.delayRemaining > 0) {
                        particles[writeIdx++] = p;
                        continue;
                    }
                    // 딜레이 끝남 - 정상 처리 시작
                    p.delay = 0;
                    p.delayRemaining = 0;
                }

                p.life -= scaledDelta;
                if (p.life <= 0) continue;

                // v4: trail 위치 업데이트 (이동 전에 현재 위치 기록)
                if (p.trail?.enabled && p.trail.positions) {
                    p.trail.positions.unshift({ x: p.position.x, y: p.position.y });
                    if (p.trail.positions.length > p.trail.length) {
                        p.trail.positions.pop();
                    }
                }

                // v4: easing 적용된 이동 (lifeRatio 기반 속도 보간)
                const maxLife = p.maxLife || 1;
                const lifeProgress = 1 - (p.life / maxLife); // 0→1
                let speedMult = 1;
                if (p.easing && EASING[p.easing]) {
                    speedMult = EASING[p.easing](lifeProgress);
                }

                // v4: drag 적용 (공기 저항)
                if (p.drag && p.drag > 0) {
                    const dragFactor = 1 - (p.drag * scaledDelta);
                    p.velocity.x *= dragFactor;
                    p.velocity.y *= dragFactor;
                }

                p.position.x += p.velocity.x * scaledDelta * (1 + speedMult * 0.5);
                p.position.y += p.velocity.y * scaledDelta * (1 + speedMult * 0.5);

                if (p.gravity) p.velocity.y += p.gravity * scaledDelta;
                if (p.flickerRate && Math.random() < p.flickerRate) p.life -= scaledDelta * 2;
                if (p.rotation !== undefined && p.rotSpeed !== undefined) p.rotation += p.rotSpeed * scaledDelta;
                if (p.life > 0) particles[writeIdx++] = p;
            }
            particles.length = Math.min(writeIdx, GAME_CONFIG.MAX_PARTICLES);
        }
        // 데미지 숫자도 in-place 업데이트
        {
            const nums = damageNumbersRef.current;
            let writeIdx = 0;
            for (let i = 0; i < nums.length; i++) {
                const dn = nums[i];
                dn.life -= scaledDelta;
                dn.position.y += dn.velocity!.y * scaledDelta;
                if (dn.life > 0) nums[writeIdx++] = dn;
            }
            nums.length = Math.min(writeIdx, GAME_CONFIG.MAX_DAMAGE_NUMBERS);
        }
        // 크리티컬 이펙트 in-place 업데이트
        {
            const effects = criticalEffectsRef.current;
            let writeIdx = 0;
            for (let i = 0; i < effects.length; i++) {
                const ce = effects[i];
                ce.life -= scaledDelta;
                ce.position.y -= 30 * scaledDelta; // 위로 천천히 올라감
                if (ce.life > 0) effects[writeIdx++] = ce;
            }
            effects.length = writeIdx;
        }

        // E2E 테스트용 게임 상태 노출 (개발 모드에서만)
        if (typeof window !== 'undefined') {
            const bossEntity = enemiesRef.current.find(e => e.isBoss && e.state !== 'dying');
            (window as any).__TEST_GAME_STATE__ = {
                isPlaying: gameActive,
                isPaused: false, // 일시정지는 외부에서 관리
                currentStage: gameState.stage,
                currentWave: gameState.wave,
                gameTime: gameTimeRef.current,
                gameMode,
                player: {
                    hp: player.health,
                    maxHp: player.maxHealth,
                    level: player.level,
                    xp: player.xp,
                    position: { ...player.position },
                    weapons: Object.keys(player.weapons),
                },
                enemies: enemiesRef.current.map(e => ({
                    type: e.type,
                    hp: e.health,
                    isBoss: e.isBoss,
                    state: e.state,
                })),
                boss: bossEntity ? {
                    isActive: true,
                    type: bossEntity.type,
                    hp: bossEntity.health,
                    maxHp: bossEntity.maxHealth,
                } : { isActive: false },
            };
        }
    };

    // damageEnemy wrapper - 모듈 함수 호출
    const damageEnemy = (enemy: Enemy, amount: number, knockback: number, sourcePos: Vector2, weaponType: WeaponType | 'bomb' | 'special' = 'special', isUltimate: boolean = false, _ownerId?: string) => {
        // 특이점 모드: HP 배율 적용 (더 강한 적)
        const actualAmount = gameMode === 'singularity' && singularityDifficultyMultiplier
            ? amount / singularityDifficultyMultiplier.hp  // HP 배율이 높으면 데미지 효율이 떨어짐
            : amount;

        const ctx: DamageEnemyContext = {
            player: playerRef,
            gems: gemsRef,
            criticalEffects: criticalEffectsRef,
            pickups: pickupsRef,
            particles: particlesRef,
            damageNumbers: damageNumbersRef,
            lastHitSfx: lastHitSfxRef,
            lastReportedScore: lastReportedScore,
            stageId: gameState.stage,
            gameTime: gameTimeRef,  // 특이점 드랍률 계산용
            onScoreUpdate,
            onBossDefeated,
            // 특이점 모드 킬 카운트
            onSingularityKill: gameMode === 'singularity' ? onSingularityKill : undefined,
            // 튜토리얼 킬 카운트
            onTutorialKill: gameMode === 'tutorial' ? onTutorialKill : undefined,
            // v3 시스템: 킬 이벤트 (콤보 증가, 쉬는시간 게이지 충전)
            onV3Kill: () => {
                const killEvents = v3.onKill();
                // 콤보 티어업 이벤트를 v3EventsRef에 병합
                if (killEvents.combo) {
                    v3EventsRef.current = { ...v3EventsRef.current, combo: killEvents.combo };
                }
            },
            // v3 시스템: 데미지 배율 (콤보 보너스)
            v3DamageMultiplier: v3.getDamageMultiplier(),
            // v7.15: 킬 카운트 증가 (엘리트 스폰 체크용)
            onKillCount: () => {
                totalKillCountRef.current++;
            },
            // v7.15: 엘리트 몬스터 사망 처리
            onEliteDeath: (deadEnemy: Enemy) => {
                // 엘리트 스폰 상태 업데이트
                eliteSpawnStateRef.current = onEliteDeath(eliteSpawnStateRef.current);

                // 엘리트 사망 처리 (드랍, 사운드, 화면 쉐이크)
                const deathResult = processEliteDeath(deadEnemy);

                // 디아블로 스타일 캐스케이드 드랍 생성
                eliteDropsRef.current.push(...deathResult.drops);

                // 사운드 효과
                if (deathResult.soundEffect) {
                    soundManager.playSFX(deathResult.soundEffect as any);
                }

                // 화면 쉐이크
                if (deathResult.screenShake > 0) {
                    screenShakeTimerRef.current = 0.3;
                    screenShakeIntensityRef.current = deathResult.screenShake;
                }
            },
        };
        damageEnemySystem(enemy, actualAmount, knockback, sourcePos, ctx, weaponType, isUltimate);
    };

    const spawnDamageNumber = (pos: Vector2, value: number, isHeal: boolean = false) =>
        spawnDamageNumberSystem(damageNumbersRef, pos, value, isHeal);

    const spawnParticles = (pos: Vector2, count: number, color: string, type: string = 'square', text: string = '') =>
        spawnParticlesSystem(particlesRef, pos, count, color, { type: type as any, text });

    // drawEnemy는 이제 '../game' 모듈에서 import

    const draw = (ctx: CanvasRenderingContext2D) => {
        // RESIZE HANDLING inside draw for simpler loop logic,
        // ensuring we always fill the window even on mobile bar changes
        if (ctx.canvas.width !== window.innerWidth || ctx.canvas.height !== window.innerHeight) {
            ctx.canvas.width = window.innerWidth;
            ctx.canvas.height = window.innerHeight;
        }

        const width = ctx.canvas.width; const height = ctx.canvas.height; const p = playerRef.current;

        // Arena mode: no stage configs needed
        const enableLowQuality = enemiesRef.current.length > 100;

        // 동적 카메라 줌 적용
        const zoom = currentZoomRef.current;
        const viewWidth = width / zoom;
        const viewHeight = height / zoom;

        // v6.0: 타일 기반 맵 렌더링 (ctx 변환 전에 호출)
        // canvas 크기와 zoom을 전달하여 올바른 범위 렌더링
        tileMap.drawTiles(ctx, p.position.x, p.position.y, width, height, zoom);

        // v7.3: 맵 오브젝트 (깊이 정렬을 위해 getVisibleObjects 사용)
        // drawObjects 대신 getVisibleObjects로 오브젝트 목록을 가져와서
        // 적/플레이어와 함께 깊이 정렬하여 렌더링
        const visibleMapObjects = tileMap.getVisibleObjects(p.position.x, p.position.y, width, height, zoom);

        if (screenFlashRef.current > 0) { ctx.fillStyle = `rgba(255, 255, 255, ${screenFlashRef.current * 0.5})`; ctx.fillRect(0, 0, width, height); }

        // v7.8.3: 진짜 화면 쉐이크 - CSS transform으로 캔버스 자체를 흔듦
        // 기존 카메라 좌표계 쉐이크는 플레이어가 중앙 고정되어 세계만 흔들림
        // CSS transform은 렌더링 완료 후 전체 화면을 흔들어 진짜 쉐이크 체감
        const canvasElement = ctx.canvas as HTMLCanvasElement;

        // v7.8.3: shakeX, shakeY - CSS transform 전용 (카메라에서는 사용 안 함)
        let shakeX = 0;
        let shakeY = 0;

        if (screenShakeTimerRef.current > 0) {
            const t = Date.now();
            const timer = screenShakeTimerRef.current;
            const intensity = screenShakeIntensityRef.current;

            // Ease-out 감쇠 곡선 (처음 강하고 점점 약해짐)
            const decay = Math.pow(timer / 0.4, 0.6);  // 0.4초 기준, 더 부드러운 감쇠

            // v7.8.4: 은은한 화면 쉐이크 (피격: 3-6px, 보스: 8-11px)
            const maxMag = 3 + intensity * 8;
            const mag = maxMag * decay;

            // 다중 주파수 사인파로 자연스러운 흔들림 생성
            const freq1 = t * 0.035;  // 빠른 흔들림 (35Hz)
            const freq2 = t * 0.02;   // 느린 흔들림 (20Hz)

            // X: 주 흔들림 + 미세 변동
            shakeX = Math.sin(freq1) * mag * 0.8 + Math.cos(freq2 * 1.3) * mag * 0.2;
            // Y: 위상 차이로 원형에 가까운 움직임 생성
            shakeY = Math.cos(freq1 + 0.7) * mag * 0.6 + Math.sin(freq2) * mag * 0.3;

            // CSS transform으로 캔버스 전체 흔들기 (GPU 가속)
            canvasElement.style.transform = `translate(${shakeX}px, ${shakeY}px)`;
        } else {
            // 쉐이크 끝나면 transform 리셋
            canvasElement.style.transform = '';
        }

        // 줌 적용: 화면 중심 -> 스케일 -> 플레이어 중심으로 이동
        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.scale(zoom, zoom);

        // v5.9: Isometric 변환 (8방향 스프라이트에 어울리는 각도)
        // 변환 행렬: x' = x - y*0.5, y' = x*0.5 + y*0.5
        if (ISO_ENABLED) {
            ctx.transform(1, 0.5, -1, 0.5, 0, 0);
        }

        ctx.translate(-p.position.x, -p.position.y);

        // v5.9: 이소메트릭 뷰포트 계산
        // 이소메트릭 변환으로 화면이 다이아몬드 형태가 되므로 렌더링 범위 확장 필요
        // 역변환 공식: worldX = 0.5*isoX + isoY, worldY = isoY - 0.5*isoX
        let startCol: number, endCol: number, startRow: number, endRow: number;

        if (ISO_ENABLED) {
            // 이소메트릭 뷰에서는 대각선 방향으로 더 넓은 영역이 보임
            // 화면 네 모서리의 월드 좌표를 계산하여 범위 결정
            const hw = viewWidth / 2;  // half width
            const hh = viewHeight / 2; // half height

            // 역이소메트릭 변환으로 화면 모서리 → 월드 좌표
            // 화면 모서리: (-hw, -hh), (hw, -hh), (-hw, hh), (hw, hh)
            // 역변환: wx = 0.5*ix + iy, wy = iy - 0.5*ix
            const corners = [
                { wx: 0.5 * (-hw) + (-hh), wy: (-hh) - 0.5 * (-hw) }, // top-left
                { wx: 0.5 * (hw) + (-hh), wy: (-hh) - 0.5 * (hw) },   // top-right
                { wx: 0.5 * (-hw) + (hh), wy: (hh) - 0.5 * (-hw) },   // bottom-left
                { wx: 0.5 * (hw) + (hh), wy: (hh) - 0.5 * (hw) },     // bottom-right
            ];

            // 월드 좌표 범위 계산
            const worldXs = corners.map(c => c.wx);
            const worldYs = corners.map(c => c.wy);
            const minWX = Math.min(...worldXs);
            const maxWX = Math.max(...worldXs);
            const minWY = Math.min(...worldYs);
            const maxWY = Math.max(...worldYs);

            // 여유 마진 추가 (타일 잘림 방지)
            const margin = GRID_SIZE * 2;
            startCol = Math.floor((p.position.x + minWX - margin) / GRID_SIZE);
            endCol = Math.ceil((p.position.x + maxWX + margin) / GRID_SIZE);
            startRow = Math.floor((p.position.y + minWY - margin) / GRID_SIZE);
            endRow = Math.ceil((p.position.y + maxWY + margin) / GRID_SIZE);
        } else {
            // 일반 직교 뷰
            startCol = Math.floor((p.position.x - viewWidth / 2) / GRID_SIZE) - 1;
            endCol = Math.floor((p.position.x + viewWidth / 2) / GRID_SIZE) + 1;
            startRow = Math.floor((p.position.y - viewHeight / 2) / GRID_SIZE) - 1;
            endRow = Math.floor((p.position.y + viewHeight / 2) / GRID_SIZE) + 1;
        }

        // v5.9: 이소메트릭 스크린 좌표 계산 헬퍼 (타일 렌더링 전에 정의)
        // v7.8.3: CSS transform으로 화면 쉐이크하므로 좌표 계산에서 shake 제거
        const toIsoScreen = (worldX: number, worldY: number) => {
            const dx = worldX - p.position.x;
            const dy = worldY - p.position.y;
            const isoX = dx - dy;
            const isoY = 0.5 * (dx + dy);
            return {
                x: width / 2 + isoX * zoom,
                y: height / 2 + isoY * zoom
            };
        };

        // 줌 반영된 컬링 마진
        // v5.9: 이소메트릭 모드에서는 화면 대각선이 월드 좌표에서 더 멀기 때문에 마진 증가
        const cullMargin = ISO_ENABLED ? (viewWidth + viewHeight) / 2 : 50 / zoom;

        // v7.15: 엘리트 드랍 아이템 렌더링 (디아블로 스타일 바운스)
        const eliteDropTime = Date.now();
        eliteDropsRef.current.forEach(drop => {
            const dx = drop.position.x - p.position.x;
            const dy = drop.position.y - p.position.y;
            if (Math.abs(dx) > viewWidth / 2 + cullMargin || Math.abs(dy) > viewHeight / 2 + cullMargin) return;

            ctx.save();
            if (ISO_ENABLED) {
                const screen = toIsoScreen(drop.position.x, drop.position.y);
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.translate(screen.x, screen.y);
                ctx.scale(zoom, zoom);
            } else {
                ctx.translate(drop.position.x, drop.position.y);
            }

            // 높이 오프셋 적용 (z축)
            ctx.translate(0, -drop.z);

            // 그림자 (z 높이에 따라 크기/투명도 변화)
            const shadowAlpha = Math.max(0.1, 0.5 - drop.z / 100);
            const shadowScale = Math.max(0.3, 1 - drop.z / 150);
            ctx.save();
            ctx.globalAlpha = shadowAlpha;
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.ellipse(0, drop.z, 10 * shadowScale, 4 * shadowScale, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // 드랍 아이템 본체 (보라색 크리스탈)
            const pulseScale = 1 + Math.sin(eliteDropTime / 200 + drop.position.x) * 0.1;
            ctx.save();
            ctx.scale(pulseScale, pulseScale);

            // 크리스탈 모양
            ctx.fillStyle = '#a855f7';
            ctx.strokeStyle = '#d8b4fe';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, -12);
            ctx.lineTo(8, 0);
            ctx.lineTo(0, 12);
            ctx.lineTo(-8, 0);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // 빛 효과
            ctx.fillStyle = '#f3e8ff';
            ctx.beginPath();
            ctx.moveTo(0, -8);
            ctx.lineTo(3, -2);
            ctx.lineTo(0, 4);
            ctx.lineTo(-3, -2);
            ctx.closePath();
            ctx.fill();

            ctx.restore();
            ctx.restore();
        });

        // v7.8.5: 픽업 렌더링 - 그림자, 바운스 애니메이션, 강조 효과 추가
        pickupsRef.current.forEach(pk => {
            const data = PICKUP_DATA[pk.type];
            const dx = pk.position.x - p.position.x;
            const dy = pk.position.y - p.position.y;
            if (Math.abs(dx) > viewWidth / 2 + cullMargin || Math.abs(dy) > viewHeight / 2 + cullMargin) return;

            const now = Date.now();
            // v7.8.5: 각 픽업마다 고유한 위상 오프셋 (위치 기반)
            const phaseOffset = (pk.position.x * 0.1 + pk.position.y * 0.1) % (Math.PI * 2);

            // v7.8.5: 바운스 애니메이션 (지도 마커처럼 위아래로)
            const bounceHeight = Math.sin(now / 250 + phaseOffset) * 6 + 8; // 8~14px 떠있음
            const pulseScale = 1 + Math.sin(now / 300 + phaseOffset) * 0.15;

            // v7.8.5: 강조 링 펄스 (파문 효과)
            const ringProgress = ((now / 1500 + phaseOffset) % 1);
            const ringRadius = 10 + ringProgress * 25;
            const ringAlpha = 0.6 * (1 - ringProgress);

            ctx.save();
            if (ISO_ENABLED) {
                const screen = toIsoScreen(pk.position.x, pk.position.y);
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.translate(screen.x, screen.y);
                ctx.scale(zoom, zoom);
            } else {
                ctx.translate(pk.position.x, pk.position.y);
            }

            // v7.8.5: 1. 바닥 그림자 (타원형)
            ctx.save();
            ctx.globalAlpha = 0.4;
            ctx.fillStyle = '#000';
            ctx.beginPath();
            const shadowScale = 0.7 + Math.sin(now / 250 + phaseOffset) * 0.1; // 바운스에 맞춰 그림자 크기 변화
            ctx.ellipse(0, 4, pk.radius * shadowScale * 1.2, pk.radius * shadowScale * 0.4, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // v7.8.5: 2. 강조 파문 링 (지도 포인트 효과)
            if (!enableLowQuality && ringAlpha > 0.05) {
                ctx.save();
                ctx.globalAlpha = ringAlpha;
                ctx.strokeStyle = data.color;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(0, -bounceHeight, ringRadius, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }

            // v7.8.5: 3. 아이템 본체 (떠있는 위치에 그리기)
            ctx.translate(0, -bounceHeight);
            ctx.scale(pulseScale, pulseScale);

            // v7.8.5: 글로우 효과
            if (!enableLowQuality) {
                ctx.shadowBlur = 20;
                ctx.shadowColor = data.color;
            }

            if (pk.type === 'chest') {
                // 보물 상자 - 황금빛 강조
                ctx.fillStyle = '#065f46';
                ctx.fillRect(-10, -8, 20, 16);
                ctx.fillStyle = '#10b981';
                ctx.fillRect(-10, -12, 20, 6);
                // 반짝이 효과
                ctx.strokeStyle = '#fef08a';
                ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(-6, 2); ctx.lineTo(-2, -2); ctx.lineTo(2, 2); ctx.lineTo(6, -6); ctx.stroke();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1;
                ctx.strokeRect(-10, -12, 20, 20);
                // 반짝임
                if (now % 400 < 200) {
                    ctx.fillStyle = '#fef08a';
                    ctx.fillRect(8, -14, 3, 3);
                    ctx.fillRect(-10, -14, 3, 3);
                }
            } else if (pk.type === 'chicken') {
                // 회복 아이템 - 십자가 + 하트 모양
                ctx.fillStyle = '#ef4444';
                // 메인 십자가
                ctx.fillRect(-3, -10, 6, 20);
                ctx.fillRect(-10, -3, 20, 6);
                // 흰색 하이라이트
                ctx.fillStyle = '#fca5a5';
                ctx.fillRect(-2, -8, 4, 6);
                ctx.fillRect(-8, -2, 6, 4);
                // 흰색 테두리
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1.5;
                ctx.strokeRect(-3, -10, 6, 20);
                ctx.strokeRect(-10, -3, 20, 6);
            } else if (pk.type === 'magnet') {
                // 자석 - U자 모양으로 개선
                const magnetSize = pk.radius;
                ctx.fillStyle = '#3b82f6';
                // U자 몸통
                ctx.beginPath();
                ctx.arc(0, 0, magnetSize, 0, Math.PI);
                ctx.lineTo(-magnetSize, -magnetSize * 0.8);
                ctx.lineTo(-magnetSize * 0.5, -magnetSize * 0.8);
                ctx.lineTo(-magnetSize * 0.5, 0);
                ctx.arc(0, 0, magnetSize * 0.5, Math.PI, 0, true);
                ctx.lineTo(magnetSize * 0.5, -magnetSize * 0.8);
                ctx.lineTo(magnetSize, -magnetSize * 0.8);
                ctx.closePath();
                ctx.fill();
                // 빨간/파란 극 표시
                ctx.fillStyle = '#ef4444';
                ctx.fillRect(-magnetSize, -magnetSize * 0.8, magnetSize * 0.5, 4);
                ctx.fillStyle = '#60a5fa';
                ctx.fillRect(magnetSize * 0.5, -magnetSize * 0.8, magnetSize * 0.5, 4);
                // 자기장 파티클 효과
                if (!enableLowQuality) {
                    ctx.fillStyle = '#93c5fd';
                    for (let i = 0; i < 3; i++) {
                        const pAngle = (now / 500 + i * 2.1) % (Math.PI * 2);
                        const pDist = magnetSize * 1.5 + Math.sin(now / 200 + i) * 3;
                        ctx.beginPath();
                        ctx.arc(Math.cos(pAngle) * pDist, Math.sin(pAngle) * pDist - 2, 2, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            } else if (pk.type === 'upgrade_material') {
                // 업그레이드 재료 - 다이아몬드 모양 (엘리트 드랍과 동일)
                const diamondSize = pk.radius * 1.2;
                const pulse = 1 + Math.sin(now / 150) * 0.15;

                // 다이아몬드 외형 (보라색 그라데이션 효과)
                ctx.fillStyle = '#a855f7';
                ctx.beginPath();
                ctx.moveTo(0, -diamondSize * pulse);           // 상단 꼭짓점
                ctx.lineTo(diamondSize * 0.6 * pulse, 0);      // 우측 꼭짓점
                ctx.lineTo(0, diamondSize * 0.8 * pulse);      // 하단 꼭짓점
                ctx.lineTo(-diamondSize * 0.6 * pulse, 0);     // 좌측 꼭짓점
                ctx.closePath();
                ctx.fill();

                // 다이아몬드 하이라이트 (밝은 부분)
                ctx.fillStyle = '#c4b5fd';
                ctx.beginPath();
                ctx.moveTo(0, -diamondSize * pulse * 0.8);
                ctx.lineTo(diamondSize * 0.3 * pulse, -diamondSize * 0.2 * pulse);
                ctx.lineTo(0, 0);
                ctx.lineTo(-diamondSize * 0.3 * pulse, -diamondSize * 0.2 * pulse);
                ctx.closePath();
                ctx.fill();

                // 하단 어두운 부분
                ctx.fillStyle = '#7c3aed';
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(diamondSize * 0.5 * pulse, diamondSize * 0.1 * pulse);
                ctx.lineTo(0, diamondSize * 0.8 * pulse);
                ctx.lineTo(-diamondSize * 0.5 * pulse, diamondSize * 0.1 * pulse);
                ctx.closePath();
                ctx.fill();

                // 테두리 (반짝임 효과)
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(0, -diamondSize * pulse);
                ctx.lineTo(diamondSize * 0.6 * pulse, 0);
                ctx.lineTo(0, diamondSize * 0.8 * pulse);
                ctx.lineTo(-diamondSize * 0.6 * pulse, 0);
                ctx.closePath();
                ctx.stroke();
            } else if (pk.type === 'bomb') {
                // 폭탄 - 더 눈에 띄게
                const bombRadius = pk.radius;
                // 폭탄 몸통 (검은 원)
                ctx.fillStyle = '#1f2937';
                ctx.beginPath();
                ctx.arc(0, 2, bombRadius, 0, Math.PI * 2);
                ctx.fill();
                // 광택
                ctx.fillStyle = '#4b5563';
                ctx.beginPath();
                ctx.arc(-bombRadius * 0.3, -bombRadius * 0.1, bombRadius * 0.4, 0, Math.PI * 2);
                ctx.fill();
                // 심지
                ctx.strokeStyle = '#92400e';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(0, -bombRadius + 2);
                ctx.quadraticCurveTo(4, -bombRadius - 4, 2, -bombRadius - 8);
                ctx.stroke();
                // 불꽃 (깜빡임)
                const flickerPhase = (now / 100) % 3;
                ctx.fillStyle = flickerPhase < 1 ? '#fbbf24' : flickerPhase < 2 ? '#f97316' : '#ef4444';
                ctx.beginPath();
                ctx.arc(2, -bombRadius - 10, 4 + Math.sin(now / 50) * 1.5, 0, Math.PI * 2);
                ctx.fill();
                // 불꽃 코어
                ctx.fillStyle = '#fef3c7';
                ctx.beginPath();
                ctx.arc(2, -bombRadius - 10, 2, 0, Math.PI * 2);
                ctx.fill();
                // 위험 표시
                ctx.fillStyle = '#fbbf24';
                ctx.font = 'bold 8px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('!', 0, 5);
            }
            ctx.restore();
        });

        // v7.8.5: 젬 렌더링 - 그림자, 강화된 글로우, 펄스 애니메이션 추가
        const visibleGems = gemsRef.current.filter(g => {
            const dx = g.position.x - p.position.x;
            const dy = g.position.y - p.position.y;
            return Math.abs(dx) < viewWidth / 2 + 20 && Math.abs(dy) < viewHeight / 2 + 20;
        });

        const time = Date.now();
        visibleGems.forEach(g => {
            // v7.8.5: 각 젬마다 고유한 위상 오프셋
            const phaseOffset = (g.position.x * 0.05 + g.position.y * 0.03) % (Math.PI * 2);
            const bob = Math.sin(time / 300 + phaseOffset) * 2 + 4; // 4~6px 떠있음
            const pulseScale = 1 + Math.sin(time / 200 + phaseOffset) * 0.1;

            ctx.save();
            if (ISO_ENABLED) {
                const screen = toIsoScreen(g.position.x, g.position.y);
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.translate(screen.x, screen.y);
                ctx.scale(zoom, zoom);
            } else {
                ctx.translate(g.position.x, g.position.y);
            }

            // v7.8.5: 1. 바닥 그림자 (작은 타원)
            ctx.save();
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = '#000';
            ctx.beginPath();
            const shadowSize = 2 + (g.value > 100 ? 1.5 : g.value > 10 ? 1 : 0);
            ctx.ellipse(0, 2, shadowSize * 1.5, shadowSize * 0.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // v7.8.5: 2. 젬 본체 (떠있는 위치)
            ctx.translate(0, -bob);
            ctx.rotate(Math.PI / 4);
            ctx.scale(pulseScale, pulseScale);

            let size = 3;
            let color = '#22d3ee';
            let glow = '#67e8f9';

            if (g.value <= 10) {
                size = 4; color = '#22d3ee'; glow = '#67e8f9'; // 청록색 - 기본
            } else if (g.value <= 100) {
                size = 5; color = '#d946ef'; glow = '#f0abfc'; // 보라색 - 중간
            } else {
                size = 6; color = '#facc15'; glow = '#fef08a'; // 금색 - 고가치
            }

            // v7.8.5: 강화된 글로우 효과
            if (!enableLowQuality) {
                ctx.shadowBlur = 8;
                ctx.shadowColor = glow;
            }

            // 메인 다이아몬드
            ctx.fillStyle = color;
            ctx.fillRect(-size / 2, -size / 2, size, size);

            // 흰색 테두리
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 0.8;
            ctx.strokeRect(-size / 2, -size / 2, size, size);

            // 하이라이트 (빛나는 효과)
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = 0.6;
            ctx.fillRect(-size / 3, -size / 3, size / 2, size / 2);

            // v7.8.5: 추가 반짝임 (고가치 젬만)
            if (g.value > 100 && !enableLowQuality) {
                ctx.globalAlpha = 0.4 + Math.sin(time / 100 + phaseOffset) * 0.3;
                ctx.fillStyle = '#fff';
                ctx.fillRect(-size / 6, -size / 6, size / 3, size / 3);
            }

            ctx.restore();
        });

        // v5.9: 이소메트릭 변환이 이미 적용된 상태로 유지됨 (ctx.resetTransform 제거)
        // 지형지물은 drawFloorTile에서 이미 렌더링됨 (충돌은 obstacles.config.ts에서 처리)

        // smoke 파티클은 플레이어 뒤에 렌더링 (먼지/연기 효과)
        particlesRef.current.forEach(pt => {
            if (pt.type !== 'smoke') return;
            const dx = pt.position.x - p.position.x;
            const dy = pt.position.y - p.position.y;
            if (Math.abs(dx) > viewWidth / 2 + 20 || Math.abs(dy) > viewHeight / 2 + 20) return;
            ctx.save();
            ctx.translate(pt.position.x, pt.position.y);
            const ptSize = (pt as any).size || pt.radius || 5;
            const maxLife = pt.maxLife || 0.6;
            const lifeRatio = pt.life / maxLife;

            // 진짜 연기처럼: 블러 + 퍼지면서 페이드아웃
            ctx.globalAlpha = Math.max(0, lifeRatio * 0.5); // 처음부터 투명하게
            // v5.0 LOD: 고성능 모드에서만 shadowBlur 사용
            if (shouldUseGlow()) {
                ctx.shadowBlur = 8 * lifeRatio;
                ctx.shadowColor = 'rgba(150, 150, 150, 0.3)';
            }

            // 연기는 시간이 지나면서 커지고 투명해짐
            const smokeSize = ptSize * (1 + (1 - lifeRatio) * 2);

            // 여러 개의 겹치는 원으로 불규칙한 연기 형태 만들기
            ctx.fillStyle = `rgba(170, 170, 170, ${lifeRatio * 0.4})`;
            ctx.beginPath();
            ctx.arc(0, 0, smokeSize, 0, Math.PI * 2);
            ctx.fill();

            // 추가 원으로 불규칙함 표현
            ctx.beginPath();
            ctx.arc(smokeSize * 0.3, -smokeSize * 0.2, smokeSize * 0.7, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(-smokeSize * 0.25, smokeSize * 0.15, smokeSize * 0.6, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        });

        // ===== v5.9.1: Y-소팅 (깊이 정렬) - 플레이어 뒤에 있는 적 먼저 렌더링 =====
        // 이소메트릭: depth = worldX + worldY (screenY에 비례)
        // 일반 모드: depth = worldY
        const playerDepth = ISO_ENABLED ? (p.position.x + p.position.y) : p.position.y;

        // Pass 1: 플레이어 뒤에 있는 적 + 맵 오브젝트 렌더링 (depth < playerDepth)
        updateRenderContext(
            enemiesRef.current.length,
            projectilesRef.current.length,
            particlesRef.current.length
        );

        // v7.3: 맵 오브젝트 + 적 + 에이전트 통합 깊이 정렬 렌더링
        // 플레이어 뒤에 있는 것들 먼저 (depth < playerDepth)
        type DepthItem = { type: 'enemy' | 'object' | 'agent'; depth: number; data: unknown };
        const behindItems: DepthItem[] = [];

        // 적 수집
        enemiesRef.current.forEach(e => {
            const enemyDepth = ISO_ENABLED ? (e.position.x + e.position.y) : e.position.y;
            if (enemyDepth >= playerDepth) return;

            const dx = e.position.x - p.position.x;
            const dy = e.position.y - p.position.y;
            if (Math.abs(dx) > viewWidth / 2 + cullMargin || Math.abs(dy) > viewHeight / 2 + cullMargin) return;

            behindItems.push({ type: 'enemy', depth: enemyDepth, data: e });
        });

        // Arena 에이전트 수집 (플레이어 뒤) - 로컬 플레이어 제외
        arenaAgentsRef.current.forEach(agent => {
            if (agent.isLocalPlayer) return; // 로컬 플레이어는 별도로 그림
            if (!agent.isAlive) return; // 죽은 에이전트는 그리지 않음

            const agentDepth = ISO_ENABLED ? (agent.position.x + agent.position.y) : agent.position.y;
            if (agentDepth >= playerDepth) return;

            const dx = agent.position.x - p.position.x;
            const dy = agent.position.y - p.position.y;
            if (Math.abs(dx) > viewWidth / 2 + cullMargin || Math.abs(dy) > viewHeight / 2 + cullMargin) return;

            behindItems.push({ type: 'agent', depth: agentDepth, data: agent });
        });

        // 맵 오브젝트 수집 (플레이어 뒤)
        visibleMapObjects.forEach(obj => {
            if (obj.depth >= playerDepth) return;
            behindItems.push({ type: 'object', depth: obj.depth, data: obj });
        });

        // 깊이순 정렬 (작은 depth = 먼저 그림 = 화면 뒤쪽)
        behindItems.sort((a, b) => a.depth - b.depth);

        // 렌더링
        if (ISO_ENABLED) {
            behindItems.forEach(item => {
                if (item.type === 'enemy') {
                    const e = item.data as typeof enemiesRef.current[0];
                    const dx = e.position.x - p.position.x;
                    const dy = e.position.y - p.position.y;
                    const isoX = dx - dy;
                    const isoY = 0.5 * (dx + dy);
                    // v7.8.3: CSS transform이 화면 쉐이크 처리
                    const screenX = width / 2 + isoX * zoom;
                    const screenY = height / 2 + isoY * zoom;

                    ctx.save();
                    ctx.setTransform(1, 0, 0, 1, 0, 0);
                    ctx.translate(screenX, screenY);
                    ctx.scale(zoom, zoom);
                    const tempEnemy = { ...e, position: { x: 0, y: 0 } };
                    // v7.15: 엘리트 글로우 효과 (몬스터 렌더링 전)
                    if (e.isElite && e.eliteTier) {
                        const pulseValue = calculateElitePulse(Date.now(), e.eliteTier);
                        drawEliteEffects({
                            ctx,
                            x: 0,
                            y: 0,
                            radius: e.radius,
                            tier: e.eliteTier,
                            glowValue: pulseValue,
                            time: Date.now(),
                        });
                    }
                    drawEnemy(ctx, tempEnemy);
                    ctx.restore();
                } else if (item.type === 'agent') {
                    // Arena 에이전트 렌더링
                    const agent = item.data as import('@/lib/matrix/types').Agent;
                    const dx = agent.position.x - p.position.x;
                    const dy = agent.position.y - p.position.y;
                    const isoX = dx - dy;
                    const isoY = 0.5 * (dx + dy);
                    const screenX = width / 2 + isoX * zoom;
                    const screenY = height / 2 + isoY * zoom;

                    ctx.save();
                    ctx.setTransform(1, 0, 0, 1, 0, 0);
                    ctx.translate(screenX, screenY);
                    ctx.scale(zoom, zoom);

                    // 에이전트 방향 계산 (ISO 변환 적용)
                    const agentIsMoving = Math.abs(agent.velocity.x) > 0.1 || Math.abs(agent.velocity.y) > 0.1;
                    const agentScreenVelX = agent.velocity.x - agent.velocity.y;
                    const agentScreenVelY = 0.5 * (agent.velocity.x + agent.velocity.y);
                    const agentDirection = agentIsMoving
                        ? getDirection8FromVelocity(agentScreenVelX, agentScreenVelY)
                        : Direction8.FRONT;
                    const agentAnimType = agentIsMoving ? 'walk' : 'idle';

                    // 스프라이트 시트로 렌더링 (플레이어와 동일)
                    const spriteDrawn = drawSpriteSheet(
                        ctx, 0, 10, agent.playerClass, agentDirection,
                        Date.now(), 2, agentAnimType, 'full'
                    );

                    // 스프라이트 시트 로드 안됐으면 drawCatSprite 폴백
                    if (!spriteDrawn) {
                        const agentFacing = agentIsMoving
                            ? { x: agent.velocity.x, y: agent.velocity.y }
                            : { x: 1, y: 0 };
                        const tempAgent = { ...agent, position: { x: 0, y: 0 } };
                        drawCatSprite(ctx, tempAgent as any, agentFacing, 0.5);
                    }

                    // 리스폰 무적 효과 표시
                    if (agent.respawnInvincibility > 0) {
                        ctx.globalAlpha = 0.3 + Math.sin(Date.now() / 100) * 0.2;
                        ctx.beginPath();
                        ctx.arc(0, 0, agent.radius + 10, 0, Math.PI * 2);
                        ctx.strokeStyle = '#10B981';
                        ctx.lineWidth = 2;
                        ctx.stroke();
                        ctx.globalAlpha = 1;
                    }

                    ctx.restore();

                    // v8.1.2 Arena UI: 이름표, 체력바, 채팅 버블 (화면 좌표에서 그림)
                    // ctx.restore() 후 변환 상태가 zoom/translate이므로 명시적으로 리셋 필요
                    ctx.save();
                    ctx.setTransform(1, 0, 0, 1, 0, 0);
                    const chatMsg = getAgentChatMessage(agent.agentId);
                    // 스프라이트는 y=10에서 중심점 기준 렌더링, 높이 ~64px * zoom
                    // 머리 위치: screenY + 10*zoom - 32*zoom
                    const spriteHeadY = screenY + 10 * zoom - 32 * zoom;
                    drawAgentUI(ctx, agent, chatMsg, screenX, spriteHeadY, false);
                    drawAgentHealthBar(ctx, agent, screenX, spriteHeadY);
                    ctx.restore();
                } else {
                    // 맵 오브젝트
                    const obj = item.data as typeof visibleMapObjects[0];
                    ctx.save();
                    ctx.setTransform(1, 0, 0, 1, 0, 0);
                    ctx.drawImage(obj.sprite, obj.screenX, obj.screenY, obj.renderWidth, obj.renderHeight);
                    ctx.restore();
                }
            });
        } else {
            behindItems.forEach(item => {
                if (item.type === 'enemy') {
                    const e = item.data as typeof enemiesRef.current[0];
                    // v7.15: 엘리트 글로우 효과 (몬스터 렌더링 전)
                    if (e.isElite && e.eliteTier) {
                        const pulseValue = calculateElitePulse(Date.now(), e.eliteTier);
                        drawEliteEffects({
                            ctx,
                            x: e.position.x,
                            y: e.position.y,
                            radius: e.radius,
                            tier: e.eliteTier,
                            glowValue: pulseValue,
                            time: Date.now(),
                        });
                    }
                    drawEnemy(ctx, e);
                } else if (item.type === 'agent') {
                    // Arena 에이전트 렌더링 (non-ISO)
                    const agent = item.data as import('@/lib/matrix/types').Agent;

                    ctx.save();
                    ctx.translate(agent.position.x, agent.position.y);

                    // 에이전트 방향 계산
                    const agentIsMoving = Math.abs(agent.velocity.x) > 0.1 || Math.abs(agent.velocity.y) > 0.1;
                    const agentDirection = agentIsMoving
                        ? getDirection8FromVelocity(agent.velocity.x, agent.velocity.y)
                        : Direction8.FRONT;
                    const agentAnimType = agentIsMoving ? 'walk' : 'idle';

                    // 스프라이트 시트로 렌더링
                    const spriteDrawn = drawSpriteSheet(
                        ctx, 0, 10, agent.playerClass, agentDirection,
                        Date.now(), 2, agentAnimType, 'full'
                    );

                    if (!spriteDrawn) {
                        const agentFacing = agentIsMoving
                            ? { x: agent.velocity.x, y: agent.velocity.y }
                            : { x: 1, y: 0 };
                        const tempAgent = { ...agent, position: { x: 0, y: 0 } };
                        drawCatSprite(ctx, tempAgent as any, agentFacing, 0.5);
                    }

                    // 리스폰 무적 효과 표시
                    if (agent.respawnInvincibility > 0) {
                        ctx.globalAlpha = 0.3 + Math.sin(Date.now() / 100) * 0.2;
                        ctx.beginPath();
                        ctx.arc(0, 0, agent.radius + 10, 0, Math.PI * 2);
                        ctx.strokeStyle = '#10B981';
                        ctx.lineWidth = 2;
                        ctx.stroke();
                        ctx.globalAlpha = 1;
                    }

                    ctx.restore();

                    // v8.1.2 Arena UI: non-ISO 모드에서도 화면 좌표로 변환 필요
                    // ctx.restore() 후 변환 상태가 zoom/translate이므로 명시적으로 리셋
                    ctx.save();
                    ctx.setTransform(1, 0, 0, 1, 0, 0);
                    // 월드→화면 좌표 변환 (non-ISO: 카메라 중심 기준)
                    const screenXNonIso = width / 2 + (agent.position.x - p.position.x) * zoom;
                    const screenYNonIso = height / 2 + (agent.position.y - p.position.y) * zoom;
                    // 스프라이트 머리 위치 (y=10 오프셋 + 높이 절반)
                    const spriteHeadYNonIso = screenYNonIso + 10 * zoom - 32 * zoom;
                    const chatMsg = getAgentChatMessage(agent.agentId);
                    drawAgentUI(ctx, agent, chatMsg, screenXNonIso, spriteHeadYNonIso, false);
                    drawAgentHealthBar(ctx, agent, screenXNonIso, spriteHeadYNonIso);
                    ctx.restore();
                } else {
                    const obj = item.data as typeof visibleMapObjects[0];
                    ctx.save();
                    ctx.setTransform(1, 0, 0, 1, 0, 0);
                    ctx.drawImage(obj.sprite, obj.screenX, obj.screenY, obj.renderWidth, obj.renderHeight);
                    ctx.restore();
                }
            });
        }

        // v7.22 DEBUG: 디버그 모드일 때만 모든 히트박스/위치 시각화
        if (debugModeRef.current) {
        // v7.17 DEBUG: 충돌 박스 시각화 (모든 오브젝트 렌더링 후)
        // 스프라이트가 그려지는 영역에 맞춰 충돌 박스 시각화
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        visibleMapObjects.forEach(obj => {
            if (obj.hasCollision) {
                // 스프라이트 영역에 파란색 테두리 (실제 렌더링 영역)
                ctx.strokeStyle = '#0088FF';
                ctx.lineWidth = 2;
                ctx.strokeRect(obj.screenX, obj.screenY, obj.renderWidth, obj.renderHeight);

                // v7.18 FIX: 충돌 박스는 발 위치(obj.worldY)에서 위로만 확장
                if (obj.collisionWidth && obj.collisionHeight) {
                    const halfW = obj.collisionWidth / 2;
                    const collisionH = obj.collisionHeight;

                    // 충돌 박스 4개 꼭짓점 (월드 좌표) - 발(하단)에서 위로 확장
                    const corners = [
                        { x: obj.worldX - halfW, y: obj.worldY - collisionH }, // 좌상 (발에서 위로)
                        { x: obj.worldX + halfW, y: obj.worldY - collisionH }, // 우상 (발에서 위로)
                        { x: obj.worldX + halfW, y: obj.worldY },              // 우하 (발 위치)
                        { x: obj.worldX - halfW, y: obj.worldY },              // 좌하 (발 위치)
                    ];

                    // 각 꼭짓점을 이소메트릭 화면 좌표로 변환
                    const screenCorners = corners.map(c => {
                        const relX = c.x - p.position.x;
                        const relY = c.y - p.position.y;
                        const isoX = relX - relY;
                        const isoY = (relX + relY) * 0.5;
                        return {
                            x: width / 2 + isoX * zoom,
                            y: height / 2 + isoY * zoom,
                        };
                    });

                    // 충돌 박스 그리기 (녹색 테두리)
                    ctx.strokeStyle = '#00FF00';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(screenCorners[0].x, screenCorners[0].y);
                    ctx.lineTo(screenCorners[1].x, screenCorners[1].y);
                    ctx.lineTo(screenCorners[2].x, screenCorners[2].y);
                    ctx.lineTo(screenCorners[3].x, screenCorners[3].y);
                    ctx.closePath();
                    ctx.stroke();
                }

                // obj.worldX, obj.worldY 위치 표시 (빨간 점 - 기준점)
                const footRelX = obj.worldX - p.position.x;
                const footRelY = obj.worldY - p.position.y;
                const footIsoX = footRelX - footRelY;
                const footIsoY = (footRelX + footRelY) * 0.5;
                const footScreenX = width / 2 + footIsoX * zoom;
                const footScreenY = height / 2 + footIsoY * zoom;
                ctx.fillStyle = '#FF0000';
                ctx.beginPath();
                ctx.arc(footScreenX, footScreenY, 5, 0, Math.PI * 2);
                ctx.fill();
            }
        });
        ctx.restore();

        // 플레이어 충돌 박스 시각화 (원형→박스 전환)
        // 플레이어 위치는 화면 중앙 (이소메트릭 변환 후에도 중앙 유지)
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        const playerScreenX = width / 2;
        const playerScreenY = height / 2;

        // 플레이어 충돌 박스 (노란색) - 이소메트릭 다이아몬드로 시각화
        if (p.collisionBox) {
            // v7.22 FIX: 월드 좌표 AABB를 이소메트릭 변환하여 다이아몬드로 표시
            const halfW = p.collisionBox.width / 2;
            const halfH = p.collisionBox.height / 2;
            const centerOffsetX = p.collisionBox.offsetX || 0;
            const centerOffsetY = p.collisionBox.offsetY;

            // 월드 좌표 기준 AABB 4개 꼭지점 (플레이어 위치 기준 상대 좌표)
            // centerOffsetX/Y가 양수면 박스 중심이 발 위치에서 +X/+Y 방향으로 이동
            const worldCorners = [
                { x: centerOffsetX - halfW, y: centerOffsetY - halfH }, // 좌상 (월드)
                { x: centerOffsetX + halfW, y: centerOffsetY - halfH }, // 우상 (월드)
                { x: centerOffsetX + halfW, y: centerOffsetY + halfH }, // 우하 (월드)
                { x: centerOffsetX - halfW, y: centerOffsetY + halfH }, // 좌하 (월드)
            ];

            // 이소메트릭 변환: isoX = worldX - worldY, isoY = (worldX + worldY) * 0.5
            const screenCorners = worldCorners.map(c => ({
                x: playerScreenX + (c.x - c.y) * zoom,
                y: playerScreenY + (c.x + c.y) * 0.5 * zoom,
            }));

            // 다이아몬드로 그리기
            ctx.strokeStyle = '#FFFF00';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(screenCorners[0].x, screenCorners[0].y);
            ctx.lineTo(screenCorners[1].x, screenCorners[1].y);
            ctx.lineTo(screenCorners[2].x, screenCorners[2].y);
            ctx.lineTo(screenCorners[3].x, screenCorners[3].y);
            ctx.closePath();
            ctx.stroke();

            // 발 위치 표시 (작은 원) - 화면 중앙
            ctx.fillStyle = '#FF0000';
            ctx.beginPath();
            ctx.arc(playerScreenX, playerScreenY, 4, 0, Math.PI * 2);
            ctx.fill();

            // 충돌 박스 정보 텍스트
            ctx.fillStyle = '#FFFF00';
            ctx.font = '12px "Rajdhani", sans-serif';
            ctx.fillText(`P: (${Math.round(p.position.x)}, ${Math.round(p.position.y)})`, playerScreenX + 50, playerScreenY - 60);
            ctx.fillText(`box: ${p.collisionBox.width}x${p.collisionBox.height} (world)`, playerScreenX + 50, playerScreenY - 45);
        } else {
            // 레거시: 원형 충돌 시각화
            const playerRadiusScreen = p.radius * zoom;
            ctx.strokeStyle = '#FFFF00';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(playerScreenX, playerScreenY, playerRadiusScreen, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = '#FFFF00';
            ctx.font = '12px "Rajdhani", sans-serif';
            ctx.fillText(`P: (${Math.round(p.position.x)}, ${Math.round(p.position.y)})`, playerScreenX + 20, playerScreenY - 20);
            ctx.fillText(`r: ${p.radius}`, playerScreenX + 20, playerScreenY - 5);
        }

        ctx.restore();

        // v7.21 DEBUG: 픽업 아이템 충돌 원 시각화
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        pickupsRef.current.forEach(pk => {
            // 픽업 월드 좌표 → 이소메트릭 화면 좌표 변환
            const relX = pk.position.x - p.position.x;
            const relY = pk.position.y - p.position.y;
            const isoX = relX - relY;
            const isoY = (relX + relY) * 0.5;
            const screenX = width / 2 + isoX * zoom;
            const screenY = height / 2 + isoY * zoom;
            const radiusScreen = pk.radius * zoom;

            // 픽업 충돌 원 (마젠타)
            ctx.strokeStyle = '#FF00FF';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(screenX, screenY, radiusScreen, 0, Math.PI * 2);
            ctx.stroke();

            // 픽업 타입 표시
            ctx.fillStyle = '#FF00FF';
            ctx.font = '10px "Rajdhani", sans-serif';
            ctx.fillText(`${pk.type} r:${pk.radius}`, screenX + radiusScreen + 5, screenY);

            // 픽업 월드 좌표 중심점 (작은 점)
            ctx.fillStyle = '#FF00FF';
            ctx.beginPath();
            ctx.arc(screenX, screenY, 3, 0, Math.PI * 2);
            ctx.fill();
        });

        ctx.restore();
        } // end debugMode

        // ===== v5.6: 8방향 스프라이트 렌더링 =====
        const isMoving = Math.abs(p.velocity.x) > 0.1 || Math.abs(p.velocity.y) > 0.1;

        // 8방향 계산: 이동 중이면 방향 업데이트, 정지 시 마지막 방향 유지
        if (isMoving) {
            // v5.9: 이소메트릭 모드에서는 velocity를 스크린 좌표로 변환하여 Direction8 계산
            // 캐릭터 스프라이트가 스크린 좌표 기준으로 똑바로 그려지므로,
            // 방향도 스크린 좌표 기준이어야 함
            // 순변환: screenX = worldX - worldY, screenY = 0.5*(worldX + worldY)
            if (ISO_ENABLED) {
                const screenVelX = p.velocity.x - p.velocity.y;
                const screenVelY = 0.5 * (p.velocity.x + p.velocity.y);
                lastDirection8Ref.current = getDirection8FromVelocity(screenVelX, screenVelY);
            } else {
                lastDirection8Ref.current = getDirection8FromVelocity(p.velocity.x, p.velocity.y);
            }
        }
        const currentDirection8 = lastDirection8Ref.current;
        const currentPlayerClass = playerClassRef.current;

        // 안티알리아싱 활성화 (부드러운 렌더링)
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // 피격 플래시 이펙트 (150ms 동안 밝게 빛남)
        const hitFlashDuration = 150;
        const timeSinceHit = Date.now() - lastDamageTimeRef.current;
        const isHit = timeSinceHit < hitFlashDuration;

        // =============================================================
        // v5.9.3: 스플릿 렌더링 - 스킬이 캐릭터 몸 중앙에서 나오는 연출
        // 렌더링 순서: 하반신 → 플레이어 중심 스킬 → 상반신
        // =============================================================

        // 플레이어 렌더링 헬퍼 함수 (part: 'full' | 'lower' | 'upper')
        const renderPlayerPart = (part: CharacterPart) => {
            ctx.save();

            // v5.9: Isometric 모드에서 캐릭터는 역변환으로 똑바로 유지
            if (ISO_ENABLED) {
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.translate(width / 2, height / 2);
                ctx.scale(zoom, zoom);
            } else {
                ctx.translate(p.position.x, p.position.y);
            }

            let spriteDrawn = false;

            // 1순위: 8방향 스프라이트 시트 (v5.9.3: 스플릿 렌더링 지원!)
            if (spriteSheetLoadedRef.current) {
                const now = Date.now();
                const spriteDirection = currentDirection8;
                let animType: 'idle' | 'walk' | 'takedamage';
                const HIT_ANIM_DURATION = 300;
                const timeSinceDamage = now - lastDamageTimeRef.current;

                if (timeSinceDamage > 0 && timeSinceDamage < HIT_ANIM_DURATION) {
                    animType = 'takedamage';
                } else {
                    animType = isMoving ? 'walk' : 'idle';
                }

                const scale = 2;
                spriteDrawn = drawSpriteSheet(
                    ctx, 0, 10, currentPlayerClass, spriteDirection,
                    now, scale, animType, part
                );
            }

            // 2순위: 8방향 정적 이미지 (스플릿 렌더링 지원!)
            if (!spriteDrawn && direction8LoadedRef.current) {
                const direction8Scale = 1.6;
                spriteDrawn = drawCharacterSprite(
                    ctx, 0, 10, currentPlayerClass, currentDirection8, direction8Scale, part
                );
            }

            // 3순위: drawCatSprite (procedural - 스플릿 미지원)
            if (!spriteDrawn && part === 'full') {
                const tempPlayer = { ...p, position: { x: 0, y: 0 } };
                drawCatSprite(ctx, tempPlayer, lastMoveFacingRef.current, 0.5, skinColorsRef.current as any);
            }

            // 피격 플래시 (상반신에서만)
            if (isHit && (part === 'full' || part === 'upper')) {
                const flashAlpha = 0.6 * (1 - timeSinceHit / hitFlashDuration);
                ctx.globalAlpha = flashAlpha;
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.arc(0, 10, 60, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
            }

            ctx.restore();
        };

        // v5.9.3: 스플릿 렌더링 활성화 여부
        // 스프라이트 시트 또는 8방향 정적 이미지가 로드된 경우 활성화
        const useSplitRendering = spriteSheetLoadedRef.current || direction8LoadedRef.current;

        if (useSplitRendering) {
            // 1단계: 플레이어 하반신 그리기
            renderPlayerPart('lower');
        } else {
            // 스플릿 미지원: 전체 플레이어 그리기 (스킬 아래)
            renderPlayerPart('full');
        }

        // 2단계: 플레이어 중심 스킬 렌더링 (캐릭터 사이에 표시)
        // v5.9.3: 스킬 중심점을 캐릭터 몸 중앙(허리)으로 조정
        // v7.32: 채찍 시작점 미세 조정 (projectile.ts 충돌 오프셋과 동기화!)
        const SKILL_CENTER_OFFSET_X = 23; // 스킬 중심점 X 오프셋
        const SKILL_CENTER_OFFSET_Y = 14; // 스킬이 캐릭터 손에서 나오도록 Y 오프셋

        projectilesRef.current.forEach(proj => {
            if (proj.type === 'pool') {
                // v7.11: 모듈화된 drawPool 사용 (새 사이버 보안 디자인)
                // v5.9.3: 스킬 중심점 오프셋 적용
                const offsetProj = { ...proj, position: { x: proj.position.x + SKILL_CENTER_OFFSET_X, y: proj.position.y + SKILL_CENTER_OFFSET_Y } };
                drawProjectile(ctx, offsetProj, playerRef.current.position);
            } else if (proj.type === 'garlic') {
                // v7.34: 모듈화된 drawGarlic 사용 (Collection 미리보기와 동일)
                // v5.9.3: 스킬 중심점 오프셋 적용
                const offsetProj = { ...proj, position: { x: proj.position.x + SKILL_CENTER_OFFSET_X, y: proj.position.y + SKILL_CENTER_OFFSET_Y } };
                drawProjectile(ctx, offsetProj, playerRef.current.position);
            } else if (proj.type === 'beam') {
                // v5.9.3: 스킬 중심점 오프셋 적용
                const offsetProj = { ...proj, position: { x: proj.position.x + SKILL_CENTER_OFFSET_X, y: proj.position.y + SKILL_CENTER_OFFSET_Y } };
                drawProjectile(ctx, offsetProj, playerRef.current.position);
            } else if (proj.type === 'laser') {
                // v5.9.3: 스킬 중심점 오프셋 적용
                const offsetProj = { ...proj, position: { x: proj.position.x + SKILL_CENTER_OFFSET_X, y: proj.position.y + SKILL_CENTER_OFFSET_Y } };
                drawProjectile(ctx, offsetProj, playerRef.current.position);
            } else if (proj.type === 'sword') {
                // v7.34: 모듈화된 drawSword 사용 (Collection 미리보기와 동일)
                // v5.9.3: 스킬 중심점 오프셋 적용
                const offsetProj = { ...proj, position: { x: proj.position.x + SKILL_CENTER_OFFSET_X, y: proj.position.y + SKILL_CENTER_OFFSET_Y } };
                drawProjectile(ctx, offsetProj, playerRef.current.position);
            } else if (proj.type === 'whip') {
                // v7.26: 손코딩(whip) 상반신 뒤에 렌더링 (스킬 중심점 오프셋 적용)
                const offsetProj = { ...proj, position: { x: proj.position.x + SKILL_CENTER_OFFSET_X, y: proj.position.y + SKILL_CENTER_OFFSET_Y } };
                drawProjectile(ctx, offsetProj, playerRef.current.position);
            }
        });

        // 3단계: 플레이어 상반신 그리기 (스플릿 렌더링 시)
        // 스킬이 캐릭터 몸 중앙에서 나오는 것처럼 보이도록 상반신을 스킬 위에 그림
        if (useSplitRendering) {
            renderPlayerPart('upper');
        }

        // v7.x: 캐릭터 머리 위에 콤보 카운터 Canvas 렌더링
        const comboState = v3.v3State.current.combo;
        if (comboState.count > 0) {
            ctx.save();
            // Isometric 모드에서 캐릭터 위치와 동일하게 변환
            if (ISO_ENABLED) {
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.translate(width / 2, height / 2);
                ctx.scale(zoom, zoom);
            } else {
                ctx.translate(p.position.x, p.position.y);
            }
            drawComboAboveCharacter(ctx, comboState, -100, t);
            ctx.restore();
        }

        // v8.1.7: Arena Mode - 로컬 플레이어(사용자) 채팅 버블 렌더링
        if (arenaAgentsRef.current.length > 0) {
            const localPlayerAgent = arenaAgentsRef.current.find(a => a.isLocalPlayer);
            if (localPlayerAgent) {
                const chatMsg = getAgentChatMessage(localPlayerAgent.agentId);
                if (chatMsg) {
                    ctx.save();
                    ctx.setTransform(1, 0, 0, 1, 0, 0);
                    // 플레이어는 화면 중앙에 위치
                    const playerScreenX = width / 2;
                    const playerScreenY = height / 2;
                    // 스프라이트 머리 위치 (y=10 오프셋 + 높이 절반)
                    const playerHeadY = playerScreenY + 10 * zoom - 32 * zoom;
                    // 채팅 버블만 그리기 (이름표는 로컬 플레이어에게 표시 안 함)
                    drawChatBubble(ctx, chatMsg, playerScreenX, playerHeadY);
                    ctx.restore();
                }
            }
        }

        // 투사체 렌더링 - rendering.ts 모듈 사용 (줌 반영 컬링)
        projectilesRef.current.forEach(proj => {
            // v3.0: 터렛 투사체는 건너뛰지 않음 (turretId가 있으면 렌더링)
            // v7.26: whip 추가 - 상반신 뒤에 렌더링되는 스킬 그룹
            const isPlayerCenteredSkill = (proj.type === 'garlic' || proj.type === 'pool' || proj.type === 'beam' || proj.type === 'laser' || proj.type === 'sword' || proj.type === 'whip');
            if (isPlayerCenteredSkill && !proj.turretId) return;
            const dx = proj.position.x - p.position.x;
            const dy = proj.position.y - p.position.y;
            if (Math.abs(dx) > viewWidth / 2 + cullMargin || Math.abs(dy) > viewHeight / 2 + cullMargin) return;

            // v5.9: 이소메트릭 모드에서 투사체를 똑바로 세우기
            if (ISO_ENABLED) {
                ctx.save();
                const screen = toIsoScreen(proj.position.x, proj.position.y);
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.translate(screen.x, screen.y);
                ctx.scale(zoom, zoom);

                // 월드 angle → 스크린 angle 변환
                // 이소메트릭 변환: screenX = worldX - worldY, screenY = 0.5*(worldX + worldY)
                const worldDirX = Math.cos(proj.angle!);
                const worldDirY = Math.sin(proj.angle!);
                const screenDirX = worldDirX - worldDirY;
                const screenDirY = 0.5 * (worldDirX + worldDirY);
                const screenAngle = Math.atan2(screenDirY, screenDirX);

                const tempProj = { ...proj, position: { x: 0, y: 0 }, angle: screenAngle };
                drawProjectile(ctx, tempProj, { x: 0, y: 0 });
                ctx.restore();
            } else {
                drawProjectile(ctx, proj, playerRef.current.position);
            }
        });

        // DRAW ENEMY PROJECTILES - 스킬별 다른 모양 (줌 반영 컬링)
        enemyProjectilesRef.current.forEach(ep => {
            const dx = ep.position.x - p.position.x;
            const dy = ep.position.y - p.position.y;
            if (Math.abs(dx) > viewWidth / 2 + cullMargin || Math.abs(dy) > viewHeight / 2 + cullMargin) return;

            ctx.save();
            // v5.9: 이소메트릭 모드에서 투사체를 똑바로 세우기
            if (ISO_ENABLED) {
                const screen = toIsoScreen(ep.position.x, ep.position.y);
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.translate(screen.x, screen.y);
                ctx.scale(zoom, zoom);
            } else {
                ctx.translate(ep.position.x, ep.position.y);
            }
            ctx.fillStyle = ep.color;
            // v5.0 LOD: 고성능 모드에서만 shadowBlur 사용
            if (shouldUseGlow()) {
                ctx.shadowBlur = 8;
                ctx.shadowColor = ep.color;
            }

            const t = Date.now();
            const r = ep.radius;

            switch (ep.skillType) {
                case 'shoot': // 에너지 볼 - 맥동하는 원
                    const pulse = 1 + Math.sin(t / 100) * 0.2;
                    ctx.beginPath();
                    ctx.arc(0, 0, r * pulse, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = '#fff';
                    ctx.globalAlpha = 0.6;
                    ctx.beginPath();
                    ctx.arc(-r * 0.3, -r * 0.3, r * 0.3, 0, Math.PI * 2);
                    ctx.fill();
                    break;

                case 'nova': // 별 모양
                    const rot = t / 200;
                    ctx.rotate(rot);
                    ctx.beginPath();
                    for (let i = 0; i < 6; i++) {
                        const angle = (i / 6) * Math.PI * 2;
                        const outerR = i % 2 === 0 ? r : r * 0.5;
                        if (i === 0) ctx.moveTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR);
                        else ctx.lineTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR);
                    }
                    ctx.closePath();
                    ctx.fill();
                    break;

                case 'laser': // 다이아몬드/화살표
                    const speed = Math.sqrt(ep.velocity.x ** 2 + ep.velocity.y ** 2);
                    const angle = Math.atan2(ep.velocity.y, ep.velocity.x);
                    ctx.rotate(angle);
                    ctx.beginPath();
                    ctx.moveTo(r * 1.5, 0);
                    ctx.lineTo(0, r * 0.6);
                    ctx.lineTo(-r * 0.5, 0);
                    ctx.lineTo(0, -r * 0.6);
                    ctx.closePath();
                    ctx.fill();
                    // 꼬리
                    ctx.fillStyle = 'rgba(255,255,255,0.4)';
                    ctx.fillRect(-r * 1.5, -r * 0.2, r, r * 0.4);
                    break;

                case 'spiral': // 나선/소용돌이
                    const spiralRot = t / 150;
                    ctx.rotate(spiralRot);
                    ctx.beginPath();
                    ctx.arc(0, 0, r, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(0, 0, r * 0.5, 0, Math.PI * 1.5);
                    ctx.stroke();
                    break;

                case 'ranged': // 원거리 적 - 작은 사각형
                    ctx.fillRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4);
                    break;

                default: // 기본 원형 (이전 호환)
                    ctx.beginPath();
                    ctx.arc(0, 0, r, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 1;
                    ctx.stroke();
            }

            ctx.restore();
        });

        lightningBoltsRef.current.forEach(bolt => {
            // 딜레이 중인 볼트는 아직 안 그림 (순차 체이닝 연출)
            if (bolt.delay && bolt.delay > 0) return;
            drawLightningBolt(ctx, bolt);
        });

        // 포메이션 경고 렌더링 (적 렌더링 전에 - 바닥에 표시)
        const formationWarning = formationWarningRef.current;
        if (formationWarning && formationWarning.active) {
            drawFormationWarning(
                ctx,
                formationWarning.positions,
                { x: p.position.x, y: p.position.y }, // 카메라 = 플레이어 위치
                formationWarning.enemyType,
                formationWarning.timer / 0.8 // 0.8초 기준 정규화
            );
        }

        // ===== v7.3: Y-소팅 Pass 2 - 플레이어 앞에 있는 적 + 맵 오브젝트 렌더링 =====
        // (depth >= playerDepth) - 플레이어보다 화면 아래쪽에 있는 것들
        const frontItems: DepthItem[] = [];

        // 적 수집 (플레이어 앞)
        enemiesRef.current.forEach(e => {
            const enemyDepth = ISO_ENABLED ? (e.position.x + e.position.y) : e.position.y;
            if (enemyDepth < playerDepth) return; // 뒤에 있는 적은 이미 렌더링됨

            const dx = e.position.x - p.position.x;
            const dy = e.position.y - p.position.y;
            if (Math.abs(dx) > viewWidth / 2 + cullMargin || Math.abs(dy) > viewHeight / 2 + cullMargin) return;

            frontItems.push({ type: 'enemy', depth: enemyDepth, data: e });
        });

        // Arena 에이전트 수집 (플레이어 앞) - 로컬 플레이어 제외
        arenaAgentsRef.current.forEach(agent => {
            if (agent.isLocalPlayer) return;
            if (!agent.isAlive) return;

            const agentDepth = ISO_ENABLED ? (agent.position.x + agent.position.y) : agent.position.y;
            if (agentDepth < playerDepth) return; // 뒤에 있는 건 이미 렌더링됨

            const dx = agent.position.x - p.position.x;
            const dy = agent.position.y - p.position.y;
            if (Math.abs(dx) > viewWidth / 2 + cullMargin || Math.abs(dy) > viewHeight / 2 + cullMargin) return;

            frontItems.push({ type: 'agent', depth: agentDepth, data: agent });
        });

        // 맵 오브젝트 수집 (플레이어 앞)
        visibleMapObjects.forEach(obj => {
            if (obj.depth < playerDepth) return; // 뒤에 있는 건 이미 렌더링됨
            frontItems.push({ type: 'object', depth: obj.depth, data: obj });
        });

        // 깊이순 정렬
        frontItems.sort((a, b) => a.depth - b.depth);

        // 렌더링
        if (ISO_ENABLED) {
            frontItems.forEach(item => {
                if (item.type === 'enemy') {
                    const e = item.data as typeof enemiesRef.current[0];
                    const dx = e.position.x - p.position.x;
                    const dy = e.position.y - p.position.y;
                    const isoX = dx - dy;
                    const isoY = 0.5 * (dx + dy);
                    // v7.8.3: CSS transform이 화면 쉐이크 처리
                    const screenX = width / 2 + isoX * zoom;
                    const screenY = height / 2 + isoY * zoom;

                    ctx.save();
                    ctx.setTransform(1, 0, 0, 1, 0, 0);
                    ctx.translate(screenX, screenY);
                    ctx.scale(zoom, zoom);
                    const tempEnemy = { ...e, position: { x: 0, y: 0 } };
                    // v7.15: 엘리트 글로우 효과 (몬스터 렌더링 전)
                    if (e.isElite && e.eliteTier) {
                        const pulseValue = calculateElitePulse(Date.now(), e.eliteTier);
                        drawEliteEffects({
                            ctx,
                            x: 0,
                            y: 0,
                            radius: e.radius,
                            tier: e.eliteTier,
                            glowValue: pulseValue,
                            time: Date.now(),
                        });
                    }
                    drawEnemy(ctx, tempEnemy);
                    ctx.restore();
                } else if (item.type === 'agent') {
                    // Arena 에이전트 렌더링 (플레이어 앞, ISO)
                    const agent = item.data as import('@/lib/matrix/types').Agent;
                    const dx = agent.position.x - p.position.x;
                    const dy = agent.position.y - p.position.y;
                    const isoX = dx - dy;
                    const isoY = 0.5 * (dx + dy);
                    const screenX = width / 2 + isoX * zoom;
                    const screenY = height / 2 + isoY * zoom;

                    ctx.save();
                    ctx.setTransform(1, 0, 0, 1, 0, 0);
                    ctx.translate(screenX, screenY);
                    ctx.scale(zoom, zoom);

                    // 에이전트 방향 계산 (ISO 변환 적용)
                    const agentIsMoving = Math.abs(agent.velocity.x) > 0.1 || Math.abs(agent.velocity.y) > 0.1;
                    const agentScreenVelX = agent.velocity.x - agent.velocity.y;
                    const agentScreenVelY = 0.5 * (agent.velocity.x + agent.velocity.y);
                    const agentDirection = agentIsMoving
                        ? getDirection8FromVelocity(agentScreenVelX, agentScreenVelY)
                        : Direction8.FRONT;
                    const agentAnimType = agentIsMoving ? 'walk' : 'idle';

                    // 스프라이트 시트로 렌더링 (플레이어와 동일)
                    const spriteDrawn = drawSpriteSheet(
                        ctx, 0, 10, agent.playerClass, agentDirection,
                        Date.now(), 2, agentAnimType, 'full'
                    );

                    // 스프라이트 시트 로드 안됐으면 drawCatSprite 폴백
                    if (!spriteDrawn) {
                        const agentFacing = agentIsMoving
                            ? { x: agent.velocity.x, y: agent.velocity.y }
                            : { x: 1, y: 0 };
                        const tempAgent = { ...agent, position: { x: 0, y: 0 } };
                        drawCatSprite(ctx, tempAgent as any, agentFacing, 0.5);
                    }

                    if (agent.respawnInvincibility > 0) {
                        ctx.globalAlpha = 0.3 + Math.sin(Date.now() / 100) * 0.2;
                        ctx.beginPath();
                        ctx.arc(0, 0, agent.radius + 10, 0, Math.PI * 2);
                        ctx.strokeStyle = '#10B981';
                        ctx.lineWidth = 2;
                        ctx.stroke();
                        ctx.globalAlpha = 1;
                    }

                    ctx.restore();

                    // v8.1.2 Arena UI: 이름표, 체력바, 채팅 버블 (화면 좌표에서 그림)
                    // ctx.restore() 후 변환 상태가 zoom/translate이므로 명시적으로 리셋 필요
                    ctx.save();
                    ctx.setTransform(1, 0, 0, 1, 0, 0);
                    const chatMsg = getAgentChatMessage(agent.agentId);
                    const spriteHeadY = screenY + 10 * zoom - 32 * zoom;
                    drawAgentUI(ctx, agent, chatMsg, screenX, spriteHeadY, false);
                    drawAgentHealthBar(ctx, agent, screenX, spriteHeadY);
                    ctx.restore();
                } else {
                    const obj = item.data as typeof visibleMapObjects[0];
                    ctx.save();
                    ctx.setTransform(1, 0, 0, 1, 0, 0);
                    ctx.drawImage(obj.sprite, obj.screenX, obj.screenY, obj.renderWidth, obj.renderHeight);
                    ctx.restore();
                }
            });
        } else {
            frontItems.forEach(item => {
                if (item.type === 'enemy') {
                    const e = item.data as typeof enemiesRef.current[0];
                    // v7.15: 엘리트 글로우 효과 (몬스터 렌더링 전)
                    if (e.isElite && e.eliteTier) {
                        const pulseValue = calculateElitePulse(Date.now(), e.eliteTier);
                        drawEliteEffects({
                            ctx,
                            x: e.position.x,
                            y: e.position.y,
                            radius: e.radius,
                            tier: e.eliteTier,
                            glowValue: pulseValue,
                            time: Date.now(),
                        });
                    }
                    drawEnemy(ctx, e);
                } else if (item.type === 'agent') {
                    // Arena 에이전트 렌더링 (플레이어 앞, non-ISO)
                    const agent = item.data as import('@/lib/matrix/types').Agent;

                    ctx.save();
                    ctx.translate(agent.position.x, agent.position.y);

                    // 에이전트 방향 계산
                    const agentIsMoving = Math.abs(agent.velocity.x) > 0.1 || Math.abs(agent.velocity.y) > 0.1;
                    const agentDirection = agentIsMoving
                        ? getDirection8FromVelocity(agent.velocity.x, agent.velocity.y)
                        : Direction8.FRONT;
                    const agentAnimType = agentIsMoving ? 'walk' : 'idle';

                    // 스프라이트 시트로 렌더링
                    const spriteDrawn = drawSpriteSheet(
                        ctx, 0, 10, agent.playerClass, agentDirection,
                        Date.now(), 2, agentAnimType, 'full'
                    );

                    if (!spriteDrawn) {
                        const agentFacing = agentIsMoving
                            ? { x: agent.velocity.x, y: agent.velocity.y }
                            : { x: 1, y: 0 };
                        const tempAgent = { ...agent, position: { x: 0, y: 0 } };
                        drawCatSprite(ctx, tempAgent as any, agentFacing, 0.5);
                    }

                    if (agent.respawnInvincibility > 0) {
                        ctx.globalAlpha = 0.3 + Math.sin(Date.now() / 100) * 0.2;
                        ctx.beginPath();
                        ctx.arc(0, 0, agent.radius + 10, 0, Math.PI * 2);
                        ctx.strokeStyle = '#10B981';
                        ctx.lineWidth = 2;
                        ctx.stroke();
                        ctx.globalAlpha = 1;
                    }

                    ctx.restore();

                    // v8.1.2 Arena UI: non-ISO 모드에서도 화면 좌표로 변환 필요
                    ctx.save();
                    ctx.setTransform(1, 0, 0, 1, 0, 0);
                    const screenXNonIso = width / 2 + (agent.position.x - p.position.x) * zoom;
                    const screenYNonIso = height / 2 + (agent.position.y - p.position.y) * zoom;
                    const spriteHeadYNonIso = screenYNonIso + 10 * zoom - 32 * zoom;
                    const chatMsg = getAgentChatMessage(agent.agentId);
                    drawAgentUI(ctx, agent, chatMsg, screenXNonIso, spriteHeadYNonIso, false);
                    drawAgentHealthBar(ctx, agent, screenXNonIso, spriteHeadYNonIso);
                    ctx.restore();
                } else {
                    const obj = item.data as typeof visibleMapObjects[0];
                    ctx.save();
                    ctx.setTransform(1, 0, 0, 1, 0, 0);
                    ctx.drawImage(obj.sprite, obj.screenX, obj.screenY, obj.renderWidth, obj.renderHeight);
                    ctx.restore();
                }
            });
        }

        // 터렛 렌더링 v5.0 - 플레이어 머리 위 떠다니기
        const turretRenderTime = Date.now();
        const turretsToRender = placedTurretsRef.current;
        const playerPosForTurret = { x: p.position.x, y: p.position.y };
        turretsToRender.forEach((turret, index) => {
            // v5.0: 터렛이 플레이어 머리 위에 떠다니므로 culling 불필요
            drawTurret(ctx, turret, turretRenderTime, playerPosForTurret, index);
        });

        // 터렛 AOE 효과 렌더링 (터렛 뒤, 투사체 앞)
        const renderTime = Date.now();
        turretAoeEffectsRef.current.forEach(effect => {
            const dx = effect.x - p.position.x;
            const dy = effect.y - p.position.y;
            if (Math.abs(dx) > viewWidth / 2 + cullMargin || Math.abs(dy) > viewHeight / 2 + cullMargin) return;
            drawTurretAoeEffect(ctx, effect, renderTime);
        });

        // v4.9: 터렛 투사체는 projectilesRef로 통합되어 일반 투사체와 함께 렌더링됨

        blastsRef.current.forEach(b => {
            ctx.save(); ctx.translate(b.position.x, b.position.y); const alpha = b.life / b.maxLife; ctx.globalCompositeOperation = 'lighter';
            const time = Date.now();
            if (b.type === 'smash') {
                const t = 1 - alpha; const r = b.radius * t; ctx.strokeStyle = b.color; ctx.lineWidth = 10; ctx.beginPath();
                for (let i = 0; i < 16; i++) { const angle = (Math.PI * 2 / 16) * i; const d = r + (i % 2 === 0 ? 20 : -20); const x = Math.cos(angle) * d; const y = Math.sin(angle) * d; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
                ctx.closePath(); ctx.stroke();
            } else if (b.type === 'purge') {
                const progress = 1 - alpha; const radius = b.radius * progress; ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2);
                ctx.fillStyle = b.color; ctx.globalAlpha = 0.3; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.globalAlpha = 1.0; ctx.stroke();
            } else if (b.type === 'mempool') {
                // 멤풀 폭발 - 트랜잭션 데이터가 터지는 느낌!
                const progress = 1 - alpha;
                const r = b.radius * Math.min(1, progress * 2);
                const pulse = 1 + Math.sin(time / 30) * 0.1;
                // 외곽 충격파 (다중 레이어)
                for (let ring = 0; ring < 3; ring++) {
                    const ringProgress = Math.min(1, progress * (1.5 + ring * 0.5));
                    const ringR = r * (0.6 + ring * 0.3) * pulse;
                    ctx.beginPath(); ctx.arc(0, 0, ringR, 0, Math.PI * 2);
                    ctx.strokeStyle = ring === 0 ? '#f59e0b' : (ring === 1 ? '#fbbf24' : '#fef3c7');
                    ctx.lineWidth = (4 - ring) * 2; ctx.globalAlpha = alpha * (1 - ring * 0.3);
                    ctx.stroke();
                }
                // 내부 폭발 코어 (데이터 청크)
                const chunks = 8;
                for (let i = 0; i < chunks; i++) {
                    const angle = (Math.PI * 2 / chunks) * i + time / 200;
                    const chunkDist = r * 0.4 * progress;
                    const cx = Math.cos(angle) * chunkDist;
                    const cy = Math.sin(angle) * chunkDist;
                    const chunkSize = 8 + Math.sin(time / 50 + i) * 3;
                    ctx.globalAlpha = alpha * 0.8;
                    ctx.fillStyle = i % 2 === 0 ? '#f59e0b' : '#fbbf24';
                    ctx.fillRect(cx - chunkSize/2, cy - chunkSize/2, chunkSize, chunkSize);
                }
                // 중심 플래시 (v5.0 LOD 최적화)
                ctx.globalAlpha = alpha * 0.6;
                if (shouldUseGradient()) {
                    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.5);
                    grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.3, '#fbbf24'); grad.addColorStop(1, 'transparent');
                    ctx.fillStyle = grad;
                } else {
                    ctx.fillStyle = 'rgba(251, 191, 36, 0.5)';
                }
                ctx.beginPath(); ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2); ctx.fill();
                // 방사형 라인 (트랜잭션 경로)
                ctx.globalAlpha = alpha * 0.5;
                for (let i = 0; i < 12; i++) {
                    const angle = (Math.PI * 2 / 12) * i;
                    const len = r * progress;
                    ctx.beginPath(); ctx.moveTo(0, 0);
                    ctx.lineTo(Math.cos(angle) * len, Math.sin(angle) * len);
                    ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2; ctx.stroke();
                }
            } else if (b.type === 'airdrop') {
                // 에어드롭 폭격 - 하늘에서 떨어지는 미사일 착탄!
                const progress = 1 - alpha;
                const r = b.radius * Math.min(1, progress * 2.5);
                // 착탄 섬광 (초반 강렬)
                if (alpha > 0.7) {
                    ctx.globalAlpha = (alpha - 0.7) * 3;
                    ctx.fillStyle = '#ffffff';
                    ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2); ctx.fill();
                }
                // 폭발 코어 (v5.0 LOD 최적화)
                ctx.globalAlpha = alpha * 0.7;
                if (shouldUseGradient()) {
                    const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
                    coreGrad.addColorStop(0, '#fff7ed'); coreGrad.addColorStop(0.2, '#fb923c');
                    coreGrad.addColorStop(0.5, '#ea580c'); coreGrad.addColorStop(1, 'transparent');
                    ctx.fillStyle = coreGrad;
                } else {
                    ctx.fillStyle = 'rgba(234, 88, 12, 0.5)';
                }
                ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
                // 다이아몬드 스파크 (4방향)
                ctx.globalAlpha = alpha;
                for (let i = 0; i < 4; i++) {
                    const angle = (Math.PI / 2) * i + time / 100;
                    const len = r * 1.2 * progress;
                    ctx.save(); ctx.rotate(angle);
                    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(len, 0); ctx.lineTo(0, 8); ctx.closePath();
                    ctx.fillStyle = i % 2 === 0 ? '#f97316' : '#fbbf24'; ctx.fill();
                    ctx.restore();
                }
                // 외곽 충격파 링 (두꺼운 스트로크)
                ctx.beginPath(); ctx.arc(0, 0, r * progress, 0, Math.PI * 2);
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.globalAlpha = alpha * 0.6; ctx.stroke();
                ctx.beginPath(); ctx.arc(0, 0, r * progress * 0.7, 0, Math.PI * 2);
                ctx.strokeStyle = '#fb923c'; ctx.lineWidth = 4; ctx.globalAlpha = alpha * 0.8; ctx.stroke();
                // 파편 점 (랜덤 스파크)
                ctx.globalAlpha = alpha * 0.7;
                for (let i = 0; i < 6; i++) {
                    const pAngle = (Math.PI * 2 / 6) * i + progress * 2;
                    const pDist = r * 0.3 + r * progress * 0.7;
                    ctx.fillStyle = '#fef3c7';
                    ctx.beginPath(); ctx.arc(Math.cos(pAngle) * pDist, Math.sin(pAngle) * pDist, 4, 0, Math.PI * 2); ctx.fill();
                }
            } else if (b.type === 'genesis') {
                // 제네시스 블록 - 블록체인 기원의 대폭발!
                const progress = 1 - alpha;
                const r = b.radius * Math.min(1, progress * 1.8);
                const pulse = 1 + Math.sin(time / 25) * 0.15;
                const rotate = time / 300;
                // 헥사곤 블록 패턴 (중심)
                ctx.save(); ctx.rotate(rotate);
                const hexSize = r * 0.4 * pulse;
                ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const angle = (Math.PI / 3) * i;
                    const hx = Math.cos(angle) * hexSize;
                    const hy = Math.sin(angle) * hexSize;
                    if (i === 0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy);
                }
                ctx.closePath();
                ctx.fillStyle = 'rgba(34, 211, 238, 0.5)'; ctx.globalAlpha = alpha * 0.6; ctx.fill();
                ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 4; ctx.globalAlpha = alpha; ctx.stroke();
                ctx.restore();
                // 다중 충격파 링 (점선 패턴)
                for (let ring = 0; ring < 4; ring++) {
                    const ringR = r * (0.3 + ring * 0.25) * pulse;
                    ctx.beginPath(); ctx.arc(0, 0, ringR, 0, Math.PI * 2);
                    ctx.setLineDash(ring % 2 === 0 ? [10, 5] : [5, 10]);
                    ctx.strokeStyle = ring < 2 ? '#22d3ee' : '#67e8f9';
                    ctx.lineWidth = 3 - ring * 0.5; ctx.globalAlpha = alpha * (1 - ring * 0.2);
                    ctx.stroke();
                }
                ctx.setLineDash([]);
                // 데이터 스트림 (외곽으로 뻗어나가는 선)
                ctx.globalAlpha = alpha * 0.6;
                for (let i = 0; i < 8; i++) {
                    const angle = (Math.PI / 4) * i + rotate * 2;
                    const innerR = r * 0.2;
                    const outerR = r * (0.5 + progress * 0.8);
                    ctx.beginPath();
                    ctx.moveTo(Math.cos(angle) * innerR, Math.sin(angle) * innerR);
                    ctx.lineTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR);
                    ctx.strokeStyle = i % 2 === 0 ? '#22d3ee' : '#a5f3fc'; ctx.lineWidth = 3; ctx.stroke();
                    // 끝점에 노드
                    ctx.fillStyle = '#ffffff';
                    ctx.beginPath(); ctx.arc(Math.cos(angle) * outerR, Math.sin(angle) * outerR, 5, 0, Math.PI * 2); ctx.fill();
                }
                // 중심 플래시 (창세기 빛, v5.0 LOD 최적화)
                ctx.globalAlpha = alpha * 0.8;
                if (shouldUseGradient()) {
                    const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.5);
                    coreGrad.addColorStop(0, '#ffffff'); coreGrad.addColorStop(0.4, '#22d3ee'); coreGrad.addColorStop(1, 'transparent');
                    ctx.fillStyle = coreGrad;
                } else {
                    ctx.fillStyle = 'rgba(34, 211, 238, 0.5)';
                }
                ctx.beginPath(); ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2); ctx.fill();
                // "0" 텍스트 (제네시스 블록 = 블록 #0)
                if (alpha > 0.5) {
                    ctx.globalAlpha = (alpha - 0.5) * 2;
                    ctx.font = 'bold 24px "Rajdhani", sans-serif'; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillText('0', 0, 0);
                }
            } else if (b.type === 'explosion') {
                // v7.11: 서버 던지기 폭발 - 서버 랙이 충격과 함께 폭발!
                const progress = 1 - alpha;
                const r = b.radius * Math.min(1, progress * 2.2);
                const pulse = 1 + Math.sin(time / 20) * 0.1;

                // 1. 초기 섬광 (매우 밝은 백색)
                if (alpha > 0.7) {
                    ctx.globalAlpha = (alpha - 0.7) * 3.3;
                    ctx.fillStyle = '#ffffff';
                    ctx.beginPath(); ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2); ctx.fill();
                }

                // 2. 폭발 코어 (빨간색-주황색 그라데이션, v5.0 LOD 최적화)
                ctx.globalAlpha = alpha * 0.8;
                if (shouldUseGradient()) {
                    const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
                    coreGrad.addColorStop(0, '#ffffff');
                    coreGrad.addColorStop(0.2, '#fef08a'); // 노란색 중심
                    coreGrad.addColorStop(0.4, '#f97316'); // 주황색
                    coreGrad.addColorStop(0.7, b.color);   // 무기 색상 (빨간색)
                    coreGrad.addColorStop(1, 'transparent');
                    ctx.fillStyle = coreGrad;
                } else {
                    ctx.fillStyle = `${b.color}88`;
                }
                ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();

                // 3. 외곽 충격파 링 (다중 레이어)
                for (let ring = 0; ring < 3; ring++) {
                    const ringR = r * (0.7 + ring * 0.2) * pulse;
                    ctx.beginPath(); ctx.arc(0, 0, ringR, 0, Math.PI * 2);
                    ctx.strokeStyle = ring === 0 ? '#ffffff' : (ring === 1 ? '#f97316' : b.color);
                    ctx.lineWidth = (4 - ring) * 2;
                    ctx.globalAlpha = alpha * (1 - ring * 0.25);
                    ctx.stroke();
                }

                // 4. 서버 파편 (사각형 조각들이 날아감)
                ctx.globalAlpha = alpha * 0.9;
                const fragments = 8;
                for (let i = 0; i < fragments; i++) {
                    const angle = (Math.PI * 2 / fragments) * i + progress * 1.5;
                    const fragDist = r * 0.3 + r * progress * 0.6;
                    const fx = Math.cos(angle) * fragDist;
                    const fy = Math.sin(angle) * fragDist;
                    const fragSize = 6 + Math.sin(time / 40 + i) * 2;

                    ctx.save();
                    ctx.translate(fx, fy);
                    ctx.rotate(angle + progress * 3); // 회전하면서 날아감

                    // 서버 유닛처럼 사각형 파편
                    ctx.fillStyle = i % 2 === 0 ? '#374151' : '#6b7280';
                    ctx.fillRect(-fragSize/2, -fragSize/2, fragSize, fragSize);

                    // LED 표시등
                    ctx.fillStyle = i % 3 === 0 ? '#ef4444' : '#22c55e';
                    ctx.fillRect(-fragSize/2 + 1, -fragSize/2 + 1, 2, 2);

                    ctx.restore();
                }

                // 5. 스파크 (전기 효과)
                ctx.globalAlpha = alpha * 0.7;
                for (let i = 0; i < 6; i++) {
                    const sparkAngle = (Math.PI * 2 / 6) * i + time / 80;
                    const sparkLen = r * 0.4 * (1 + progress);
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    // 지그재그 라인
                    const midX = Math.cos(sparkAngle) * sparkLen * 0.5 + Math.sin(time / 30 + i) * 5;
                    const midY = Math.sin(sparkAngle) * sparkLen * 0.5 + Math.cos(time / 30 + i) * 5;
                    ctx.lineTo(midX, midY);
                    ctx.lineTo(Math.cos(sparkAngle) * sparkLen, Math.sin(sparkAngle) * sparkLen);
                    ctx.strokeStyle = '#fef08a';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
            } else { ctx.fillStyle = b.color; ctx.globalAlpha = alpha; ctx.beginPath(); ctx.arc(0, 0, b.radius * alpha, 0, Math.PI * 2); ctx.fill(); }
            ctx.restore();
        });

        // 파티클 렌더링 (줌 반영 컬링) - smoke는 플레이어 뒤에서 이미 렌더링됨 + v4 이펙트
        particlesRef.current.forEach(pt => {
            if (pt.type === 'smoke') return; // smoke는 플레이어 뒤에서 렌더링
            // v4: delay 중인 파티클은 렌더링하지 않음
            if (pt.delay && pt.delay > 0 && pt.delayRemaining && pt.delayRemaining > 0) return;

            const dx = pt.position.x - p.position.x;
            const dy = pt.position.y - p.position.y;
            if (Math.abs(dx) > viewWidth / 2 + 20 || Math.abs(dy) > viewHeight / 2 + 20) return;

            const basePtSize = (pt as any).size || pt.radius || 5;
            const maxLife = pt.maxLife || 0.6;
            const lifeRatio = pt.life / maxLife;
            const lifeProgress = 1 - lifeRatio; // 0→1

            // v4: scale 보간 (scaleStart → scaleEnd)
            let ptSize = basePtSize;
            if (pt.scaleStart !== undefined && pt.scaleEnd !== undefined) {
                ptSize = basePtSize * lerp(pt.scaleStart, pt.scaleEnd, lifeProgress);
            } else if (pt.scale) {
                ptSize = basePtSize * pt.scale;
            }

            // v4: color 보간 (color → colorEnd)
            let currentColor = pt.color;
            if (pt.colorEnd) {
                currentColor = lerpColor(pt.color, pt.colorEnd, lifeProgress);
            }

            // v4: trail 렌더링 (이전 위치들을 먼저 렌더링)
            if (pt.trail?.enabled && pt.trail.positions && pt.trail.positions.length > 0) {
                const trailLen = Math.min(pt.trail.positions.length, pt.trail.length);
                for (let ti = trailLen - 1; ti >= 0; ti--) {
                    const trailPos = pt.trail.positions[ti];
                    const trailAlpha = Math.pow(1 - pt.trail.decay, ti + 1) * lifeRatio;
                    const trailSize = ptSize * (0.5 + 0.5 * (1 - ti / trailLen));
                    ctx.save();
                    ctx.translate(trailPos.x, trailPos.y);
                    ctx.globalAlpha = trailAlpha * 0.6;
                    ctx.fillStyle = currentColor;
                    ctx.beginPath();
                    ctx.arc(0, 0, trailSize / 2, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }
            }

            ctx.save(); ctx.translate(pt.position.x, pt.position.y);

            // v4: glow 렌더링 (shadowBlur 사용)
            // v5.0 LOD: 고성능 모드에서만 glow 효과 적용
            if (shouldUseGlow() && pt.glow?.enabled && pt.glow.preset && GLOW_PRESETS[pt.glow.preset]) {
                const glowLayers = GLOW_PRESETS[pt.glow.preset];
                // 펄스 효과
                let pulseMultiplier = 1;
                if (pt.glow.pulseFreq && pt.glow.pulseFreq > 0) {
                    const t = Date.now() / 1000;
                    pulseMultiplier = 0.7 + 0.3 * Math.sin(t * pt.glow.pulseFreq * Math.PI * 2);
                }
                // 가장 바깥 글로우 레이어만 적용 (성능)
                const outerGlow = glowLayers[0];
                ctx.shadowBlur = outerGlow.blur * pulseMultiplier;
                ctx.shadowColor = outerGlow.color || currentColor;
            }

            ctx.globalAlpha = Math.max(0, lifeRatio);

            // burstStyle별 고유 렌더링 (몬스터별 터지는 맛!)
            if (pt.burstStyle) {
                switch (pt.burstStyle) {
                    case 'slime': {
                        // 물방울: 타원형 + 꼬리
                        const s = ptSize * (0.5 + lifeRatio * 0.5);
                        ctx.fillStyle = currentColor;
                        ctx.beginPath();
                        // 메인 물방울 (타원)
                        ctx.ellipse(0, 0, s * 0.8, s * 1.2, 0, 0, Math.PI * 2);
                        ctx.fill();
                        // 하이라이트
                        ctx.globalAlpha = lifeRatio * 0.6;
                        ctx.fillStyle = '#ffffff';
                        ctx.beginPath();
                        ctx.arc(-s * 0.3, -s * 0.4, s * 0.25, 0, Math.PI * 2);
                        ctx.fill();
                        break;
                    }
                    case 'pixel': {
                        // 픽셀: 정렬된 작은 사각형 (회전 없음)
                        ctx.globalAlpha = lifeRatio;
                        ctx.fillStyle = currentColor;
                        const pxSize = ptSize * 0.8;
                        ctx.fillRect(-pxSize / 2, -pxSize / 2, pxSize, pxSize);
                        // 하이라이트 코너
                        ctx.fillStyle = 'rgba(255,255,255,0.5)';
                        ctx.fillRect(-pxSize / 2, -pxSize / 2, pxSize * 0.4, pxSize * 0.4);
                        break;
                    }
                    case 'electric': {
                        // 전기: 깜빡이는 지그재그 라인
                        ctx.globalAlpha = Math.random() > 0.3 ? lifeRatio : lifeRatio * 0.3; // 깜빡임
                        ctx.strokeStyle = currentColor;
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        const len = ptSize * 2;
                        const angle = pt.rotation || 0;
                        ctx.moveTo(0, 0);
                        // 지그재그
                        for (let i = 1; i <= 3; i++) {
                            const zigX = Math.cos(angle) * (len / 3 * i) + (i % 2 === 0 ? 3 : -3);
                            const zigY = Math.sin(angle) * (len / 3 * i) + (i % 2 === 0 ? -3 : 3);
                            ctx.lineTo(zigX, zigY);
                        }
                        ctx.stroke();
                        // 스파크 점
                        ctx.fillStyle = '#ffffff';
                        ctx.beginPath();
                        ctx.arc(0, 0, ptSize * 0.3, 0, Math.PI * 2);
                        ctx.fill();
                        break;
                    }
                    case 'gold': {
                        // 황금: 반짝이는 다이아몬드 + 빛나는 효과
                        ctx.globalAlpha = lifeRatio;
                        ctx.save();
                        ctx.rotate(Math.PI / 4 + (pt.rotation || 0));
                        ctx.fillStyle = currentColor;
                        const gSize = ptSize * (0.8 + Math.sin(pt.life * 20) * 0.2); // 반짝임
                        ctx.fillRect(-gSize / 2, -gSize / 2, gSize, gSize);
                        // 빛나는 효과
                        ctx.restore();
                        ctx.globalAlpha = lifeRatio * 0.5;
                        ctx.fillStyle = '#ffffff';
                        ctx.beginPath();
                        ctx.arc(0, 0, gSize * 0.3, 0, Math.PI * 2);
                        ctx.fill();
                        // 십자 빛
                        ctx.strokeStyle = '#fffde7';
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(-gSize, 0); ctx.lineTo(gSize, 0);
                        ctx.moveTo(0, -gSize); ctx.lineTo(0, gSize);
                        ctx.stroke();
                        break;
                    }
                    case 'shatter': {
                        // 파편: 각진 조각 + 빠른 회전
                        ctx.globalAlpha = lifeRatio;
                        ctx.rotate(pt.rotation || 0);
                        ctx.fillStyle = currentColor;
                        // 삼각형 파편
                        ctx.beginPath();
                        ctx.moveTo(0, -ptSize);
                        ctx.lineTo(ptSize * 0.7, ptSize * 0.5);
                        ctx.lineTo(-ptSize * 0.7, ptSize * 0.5);
                        ctx.closePath();
                        ctx.fill();
                        break;
                    }
                    case 'spark': {
                        // 스파크: 날카로운 직선
                        ctx.globalAlpha = lifeRatio;
                        ctx.rotate(Math.atan2(pt.velocity.y, pt.velocity.x));
                        ctx.fillStyle = currentColor;
                        // 날카로운 형태
                        ctx.beginPath();
                        ctx.moveTo(0, 0);
                        ctx.lineTo(ptSize * 3, -1);
                        ctx.lineTo(ptSize * 3.5, 0);
                        ctx.lineTo(ptSize * 3, 1);
                        ctx.closePath();
                        ctx.fill();
                        break;
                    }
                    case 'data': {
                        // 데이터: 문자 (text type과 유사하지만 글리치 효과)
                        ctx.globalAlpha = lifeRatio;
                        ctx.fillStyle = currentColor;
                        ctx.font = `${Math.max(8, ptSize)}px "Rajdhani", sans-serif`;
                        ctx.textAlign = 'center';
                        ctx.fillText(pt.text || '0', 0, 0);
                        // 글리치 오프셋 (시안/마젠타)
                        if (Math.random() > 0.7) {
                            ctx.globalAlpha = lifeRatio * 0.5;
                            ctx.fillStyle = '#00ffff';
                            ctx.fillText(pt.text || '0', 1, 0);
                            ctx.fillStyle = '#ff00ff';
                            ctx.fillText(pt.text || '0', -1, 0);
                        }
                        break;
                    }
                    default: {
                        // smoke (기본)
                        const s = ptSize * (pt.life * 2);
                        ctx.fillStyle = currentColor;
                        ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.fill();
                    }
                }
            }
            // 기존 type 기반 렌더링 (burstStyle 없는 경우) + v4 currentColor 지원
            else if (pt.type === 'text' && pt.text) {
                ctx.globalAlpha = lifeRatio;
                ctx.fillStyle = currentColor;
                ctx.font = `bold ${Math.max(10, ptSize)}px "Rajdhani", sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(pt.text, 0, 0);
                // v4: 글로우 있으면 텍스트에 글로우 효과
                if (pt.glow?.enabled) {
                    ctx.globalAlpha = lifeRatio * 0.3;
                    ctx.fillText(pt.text, 0, 0);
                }
            }
            else if (pt.type === 'ring') {
                ctx.globalAlpha = lifeRatio;
                const expandProgress = 1 - lifeRatio;
                const ringSize = ptSize * (0.3 + expandProgress * 0.7);
                ctx.strokeStyle = currentColor;
                ctx.lineWidth = pt.width || 2;
                ctx.beginPath();
                ctx.arc(0, 0, ringSize, 0, Math.PI * 2);
                ctx.stroke();
            }
            else if (pt.type === 'line') {
                ctx.globalAlpha = lifeRatio;
                ctx.rotate(Math.atan2(pt.velocity.y, pt.velocity.x));
                ctx.fillStyle = currentColor;
                ctx.fillRect(0, -1, ptSize * 3, 2);
            }
            else if (pt.type === 'hex') {
                // v4: 육각형 파티클 (TANK 스킬용)
                ctx.globalAlpha = lifeRatio;
                if (pt.rotation) ctx.rotate(pt.rotation);
                ctx.fillStyle = currentColor;
                ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const angle = (Math.PI / 3) * i - Math.PI / 6;
                    const hx = Math.cos(angle) * ptSize;
                    const hy = Math.sin(angle) * ptSize;
                    if (i === 0) ctx.moveTo(hx, hy);
                    else ctx.lineTo(hx, hy);
                }
                ctx.closePath();
                ctx.fill();
                // 테두리
                ctx.strokeStyle = 'rgba(255,255,255,0.3)';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
            else if ((pt.type as string) === 'smoke') {
                const s = ptSize * (pt.life * 2);
                ctx.fillStyle = currentColor;
                ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.fill();
            }
            else if (pt.type === 'square') {
                // 명시적 square 타입만 사각형으로 렌더링
                ctx.globalAlpha = lifeRatio;
                if (pt.rotation) ctx.rotate(pt.rotation);
                ctx.fillStyle = currentColor;
                ctx.fillRect(-ptSize / 2, -ptSize / 2, ptSize, ptSize);
            }
            else if (pt.type === 'spark') {
                // v4: 스파크 타입 (화살촉 모양)
                ctx.globalAlpha = lifeRatio;
                ctx.rotate(Math.atan2(pt.velocity.y, pt.velocity.x));
                ctx.fillStyle = currentColor;
                ctx.beginPath();
                ctx.moveTo(ptSize * 2, 0);
                ctx.lineTo(-ptSize, -ptSize * 0.5);
                ctx.lineTo(-ptSize * 0.5, 0);
                ctx.lineTo(-ptSize, ptSize * 0.5);
                ctx.closePath();
                ctx.fill();
            }
            else if (pt.type === 'pixel') {
                // v4: 픽셀 타입 (작은 정사각형)
                ctx.globalAlpha = lifeRatio;
                ctx.fillStyle = currentColor;
                ctx.fillRect(-ptSize / 2, -ptSize / 2, ptSize, ptSize);
            }
            else {
                // 기본: 원형 파티클 (사각형 대신) + v4 currentColor
                ctx.globalAlpha = lifeRatio;
                ctx.fillStyle = currentColor;
                ctx.beginPath();
                ctx.arc(0, 0, ptSize / 2, 0, Math.PI * 2);
                ctx.fill();
            }

            // v4: shadowBlur 리셋 (다음 파티클에 영향 안주도록)
            ctx.shadowBlur = 0;
            ctx.restore();
        });

        if (!enableLowQuality) {
            // v7.15: 데미지 넘버/크리티컬 텍스트는 이소메트릭 변환 없이 스크린 좌표에서 렌더링
            // 텍스트가 "누워있지" 않도록 변환 리셋
            ctx.font = 'bold 10px "Press Start 2P"'; ctx.textAlign = 'center';
            damageNumbersRef.current.forEach(dn => {
                ctx.save();
                // v7.15: 이소메트릭 모드에서는 스크린 좌표로 변환
                if (ISO_ENABLED) {
                    const screen = toIsoScreen(dn.position.x, dn.position.y);
                    ctx.setTransform(1, 0, 0, 1, 0, 0);
                    ctx.translate(screen.x, screen.y);
                    ctx.scale(zoom, zoom);
                } else {
                    ctx.translate(dn.position.x, dn.position.y);
                }
                ctx.globalAlpha = dn.life / dn.maxLife!;
                // 크리티컬은 더 크고 금색
                if (dn.isCritical) {
                    ctx.font = 'bold 14px "Press Start 2P"';
                    ctx.fillStyle = '#fbbf24';
                    ctx.strokeStyle = '#000';
                    ctx.lineWidth = 3;
                    ctx.strokeText(`${Math.round(dn.value)}!`, 0, 0);
                    ctx.fillText(`${Math.round(dn.value)}!`, 0, 0);
                } else {
                    ctx.fillStyle = dn.color || (dn.value > 100 ? '#4ade80' : '#facc15');
                    ctx.fillText(`${dn.value > 100 ? '+' : '-'}${Math.round(dn.value)}`, 0, 0);
                }
                ctx.restore();
            });

            // 크리티컬 텍스트 이펙트 렌더링 (마블 카툰 스타일)
            ctx.font = 'bold 24px "DnfBitbeatV2"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            criticalEffectsRef.current.forEach(ce => {
                const progress = 1 - (ce.life / ce.maxLife);
                // 팝업 애니메이션: 0→1.2→1.0
                let scale = ce.scale;
                if (progress < 0.2) {
                    scale = (progress / 0.2) * 1.3; // 0→1.3 (20% 동안)
                } else if (progress < 0.4) {
                    scale = 1.3 - ((progress - 0.2) / 0.2) * 0.3; // 1.3→1.0
                } else {
                    scale = 1.0;
                }
                // 페이드 아웃
                const alpha = progress > 0.7 ? 1 - ((progress - 0.7) / 0.3) : 1;

                ctx.save();
                // v7.15: 이소메트릭 모드에서는 스크린 좌표로 변환
                if (ISO_ENABLED) {
                    const screen = toIsoScreen(ce.position.x, ce.position.y);
                    ctx.setTransform(1, 0, 0, 1, 0, 0);
                    ctx.translate(screen.x, screen.y);
                    ctx.scale(zoom, zoom);
                } else {
                    ctx.translate(ce.position.x, ce.position.y);
                }
                ctx.rotate(ce.rotation * Math.PI / 180);
                ctx.scale(scale, scale);
                ctx.globalAlpha = alpha;

                // 검은 테두리 (두꺼움)
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 6;
                ctx.strokeText(ce.text, 0, 0);

                // 흰색 내부 테두리
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 3;
                ctx.strokeText(ce.text, 0, 0);

                // 무기 색상 텍스트
                ctx.fillStyle = ce.color;
                ctx.fillText(ce.text, 0, 0);

                ctx.restore();
            });
        }

        ctx.resetTransform();

        // v33 Phase 4: 멀티플레이어 렌더링 (원격 플레이어 + PvP 이펙트 + 전쟁 테두리 + 킬피드)
        // ctx를 화면 중앙 기준으로 세팅하여 remote-player의 (player.x - cameraX) * zoom 좌표계와 매치
        if (onMultiplayerRender) {
            ctx.save();
            ctx.translate(width / 2, height / 2);
            onMultiplayerRender(ctx, p.position.x, p.position.y, width, height, zoom, Date.now());
            ctx.restore();
        }

        if (!isAutoHunt) {
            drawJoystick(ctx, joystickRef.current);
        }

        // v8.0 Arena: 킬피드 UI 렌더링 (화면 우측 상단)
        if (arenaKillFeed.length > 0) {
            drawKillFeed(ctx, arenaKillFeed, width);
        }

        const grad = ctx.createRadialGradient(width / 2, height / 2, height / 2, width / 2, height / 2, height); grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(1, 'rgba(0,0,0,0.6)'); ctx.fillStyle = grad; ctx.fillRect(0, 0, width, height);
        ctx.restore();
    };

    // 게임 루프 - Web Worker 기반 (탭 비활성화 시에도 게임 진행)
    const MAX_DELTA_TIME = 0.1; // 100ms 상한 (한 프레임에 너무 큰 deltaTime 방지)
    const workerRef = useRef<Worker | null>(null);

    // 렌더링 전용 루프 (화면 표시만 담당)
    const renderLoop = useCallback(() => {
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) draw(ctx);
        requestRef.current = requestAnimationFrame(renderLoop);
    }, []);

    // Web Worker 기반 게임 루프
    useEffect(() => {
        // Worker 생성 (Vite는 ?worker 쿼리로 Worker 지원)
        const worker = new Worker(
            new URL('@/lib/matrix/workers/game-timer.worker.ts', import.meta.url),
            { type: 'module' }
        );
        workerRef.current = worker;

        // Worker 메시지 핸들러
        worker.onmessage = (e) => {
            const { type, deltaTime } = e.data;

            if (type === 'tick' && gameActive) {
                const clampedDelta = Math.min(deltaTime, MAX_DELTA_TIME);
                // 백그라운드에서도 게임 로직 실행 (렌더링은 requestAnimationFrame이 자동으로 스킵)
                update(clampedDelta);
            }
        };

        // 렌더링 루프 시작
        requestRef.current = requestAnimationFrame(renderLoop);

        // Worker 시작
        worker.postMessage({ type: 'start' });

        return () => {
            worker.postMessage({ type: 'stop' });
            worker.terminate();
            workerRef.current = null;
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [gameActive, isAutoHunt, renderLoop]);

    // NOTE: Resize listener moved into draw loop for better mobile stability, 
    // but we keep this to force initial size
    useEffect(() => { const handleResize = () => { if (canvasRef.current) { canvasRef.current.width = window.innerWidth; canvasRef.current.height = window.innerHeight; } }; window.addEventListener('resize', handleResize); handleResize(); return () => window.removeEventListener('resize', handleResize); }, []);

    return (
        <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 w-full h-full cursor-crosshair touch-none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
        />
    );
};

export default MatrixCanvas;
export { MatrixCanvas };