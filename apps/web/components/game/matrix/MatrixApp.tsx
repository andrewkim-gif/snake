'use client';

/**
 * MatrixApp.tsx - v29 Phase 4: 오케스트레이터 컴포넌트
 *
 * 원본 app_ingame/App.tsx에서 게임플레이 부분만 추출.
 * 모든 게임 훅을 호출하고 MatrixCanvas에 68개 props를 전달한다.
 *
 * 포함:
 *  - useGameState, useV3Systems, useArena, useSingularity, useSkillBuild
 *  - MatrixCanvas + 68개 props 바인딩
 *  - MatrixHUD, MatrixLevelUp, MatrixPause, MatrixResult 오버레이
 *  - ArenaHUD (배틀로얄 모드)
 *  - 게임 상태 머신 (idle → playing → paused → levelup → gameover)
 *
 * 제외 (로비/인증):
 *  - Supabase 인증, 로비 UI, 캐릭터 선택/스킨 선택
 *  - 멀티플레이어 소켓 (싱글플레이어)
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';

// ─── 게임 훅 ───
import { useGameState } from '@/lib/matrix/hooks/useGameState';
import { useV3Systems, type V3SystemEvents } from '@/lib/matrix/hooks/useV3Systems';
import { useArena } from '@/lib/matrix/hooks/useArena';
import { useSingularity } from '@/lib/matrix/hooks/useSingularity';
import { useSkillBuild } from '@/lib/matrix/hooks/useSkillBuild';
import { useKeyboardShortcuts } from '@/lib/matrix/hooks/useKeyboardShortcuts';

// ─── 타입 ───
import type {
  PlayerClass,
  GameMode,
  WeaponType,
  WaveNumber,
  V3GameSystems,
  PersistentUpgrades,
  Enemy,
  LevelUpChoice,
} from '@/lib/matrix/types';

// ─── 설정/상수 ───
import {
  GAME_CONFIG,
  CLASS_DATA,
  MAX_REROLLS,
  WEAPON_DATA,
} from '@/lib/matrix/constants';
import { soundManager } from '@/lib/matrix/utils/audio';

// LeaderboardEntry는 ArenaHUD에서 import
import type { LeaderboardEntry } from './ArenaHUD';

// ─── UI 오버레이 (같은 matrix 폴더) ───
import MatrixHUD from './MatrixHUD';
import type { WeaponSlot } from './MatrixHUD';
import MatrixLevelUp from './MatrixLevelUp';
import type { LevelUpOption } from './MatrixLevelUp';
import MatrixPause from './MatrixPause';
import MatrixResult from './MatrixResult';
import ArenaHUD from './ArenaHUD';

// ─── v3 시스템 시각 UI (v32 Phase 1) ───
import BreakTimeOverlay from './BreakTimeOverlay';
import ComboCounter from './ComboCounter';
import QuizChallengeCard, { QuizPenaltyIndicator } from './QuizChallengeCard';

// ─── v32 Phase 3: Branch Selection + Synergy Notification ───
import BranchSelectModal from './BranchSelectModal';
import type { BranchOption } from './BranchSelectModal';
import SynergyNotification from './SynergyNotification';
import type { SynergyNotificationData } from './SynergyNotification';
import { SKILL_BRANCHES } from '@/lib/matrix/config/skills/branches';

// ─── v33 Phase 3: Online Mode Systems ───
import { useMatrixSocket, type MatrixSocketListeners } from '@/hooks/useMatrixSocket';
import { OnlineSyncSystem } from '@/lib/matrix/systems/online-sync';
import { ClientPrediction } from '@/lib/matrix/systems/client-prediction';
import { KillReporter } from '@/lib/matrix/systems/kill-reporter';
import { seededSpawning } from '@/lib/matrix/systems/seeded-spawning';
import { EpochUIBridge } from '@/lib/matrix/systems/epoch-ui-bridge';
import type { MatrixEpochPhase } from '@/hooks/useMatrixSocket';
import type { InterpolatedPlayer } from '@/lib/matrix/systems/online-sync';
import type { EpochUIState } from '@/lib/matrix/systems/epoch-ui-bridge';

// ─── v33 Phase 4: Multiplayer Rendering Integration ───
import { MultiplayerRenderer } from '@/lib/matrix/rendering/multiplayer';

// ─── MatrixCanvas (무거워서 dynamic import) ───
const MatrixCanvas = dynamic(
  () => import('./MatrixCanvas').then(m => ({ default: m.MatrixCanvas })),
  { ssr: false },
);

// ============================================
// Props
// ============================================

export interface MatrixAppProps {
  /** 글로브(로비)로 복귀 콜백 */
  onExitToLobby: () => void;
  /** 초기 캐릭터 (기본값: 'neo') */
  initialClass?: PlayerClass;
  /** v29b Phase 2: 진입 국가 ISO3 코드 (예: 'KOR', 'USA') */
  countryIso3?: string;
  /** v29b Phase 2: 진입 국가 이름 (예: 'South Korea', 'United States') */
  countryName?: string;
  /** v33 Phase 3: 온라인 모드 활성화 (true면 서버 연결) */
  isOnline?: boolean;
  /** v33 Phase 3: 게임 서버 URL (isOnline=true 시 필수) */
  serverUrl?: string;
}

// ============================================
// 기본 PersistentUpgrades (로비 없이 하드코딩)
// ============================================

const DEFAULT_PERSISTENT_UPGRADES: PersistentUpgrades = {
  hpLevel: 0,
  speedLevel: 0,
  damageLevel: 0,
  defenseLevel: 0,
  xpBonusLevel: 0,
  cooldownLevel: 0,
  critLevel: 0,
  pickupLevel: 0,
  reviveLevel: 0,
};

const DEFAULT_CHARACTER_BONUS = {
  hpBonus: 0,
  speedBonus: 0,
  damageBonus: 0,
  defBonus: 0,
};

// ============================================
// 컴포넌트
// ============================================

export function MatrixApp({ onExitToLobby, initialClass = 'neo', countryIso3, countryName, isOnline = false, serverUrl }: MatrixAppProps) {
  // ─────────────────────────────────────────
  // 게임 훅 호출
  // ─────────────────────────────────────────
  const gameState = useGameState();
  const v3Systems = useV3Systems();
  const arena = useArena();
  const singularity = useSingularity();
  const skillBuild = useSkillBuild();

  // ─────────────────────────────────────────
  // 로컬 상태
  // ─────────────────────────────────────────
  const [gameMode, setGameMode] = useState<GameMode>('singularity');
  const [v3State, setV3State] = useState<V3GameSystems | null>(null);
  const [v3Events, setV3Events] = useState<V3SystemEvents>({});
  const [isPaused, setIsPaused] = useState(false);
  const [entityCounts, setEntityCounts] = useState({ enemies: 0, particles: 0, projectiles: 0 });
  const [isAutoHunt, setIsAutoHunt] = useState(true);  // Matrix는 기본 Auto Hunt
  const [sessionKills, setSessionKills] = useState(0);
  const [playerPosition, setPlayerPosition] = useState({ x: 0, y: 0 });
  const playerPositionRef = useRef({ x: 0, y: 0 });

  // ─────────────────────────────────────────
  // v33 Phase 3: Online Mode Systems
  // ─────────────────────────────────────────
  const onlineSyncRef = useRef<OnlineSyncSystem | null>(null);
  const clientPredictionRef = useRef<ClientPrediction | null>(null);
  const killReporterRef = useRef<KillReporter | null>(null);
  const epochBridgeRef = useRef<EpochUIBridge | null>(null);
  const multiplayerRendererRef = useRef<MultiplayerRenderer | null>(null);
  const [remotePlayers, setRemotePlayers] = useState<InterpolatedPlayer[]>([]);
  const [epochUI, setEpochUI] = useState<EpochUIState | null>(null);
  const [onlineLevelUpChoices, setOnlineLevelUpChoices] = useState<Array<{
    id: string; skill: string; isNew: boolean; currentLevel: number;
    nextLevel: number; priorityScore: number;
  }> | null>(null);

  // 온라인 시스템 다운링크 리스너 설정
  const matrixListeners = useMemo<MatrixSocketListeners>(() => {
    if (!isOnline) return {};
    return {
      onState: (data) => {
        onlineSyncRef.current?.applyState(data);
        epochBridgeRef.current?.updateTimer(data.timer);
      },
      onEpoch: (data) => {
        epochBridgeRef.current?.onEpochEvent(data);
        setEpochUI(epochBridgeRef.current?.state ?? null);
      },
      onSpawnSeed: (data) => {
        seededSpawning.onSeed(data);
      },
      onKillConfirmed: (data) => {
        killReporterRef.current?.onConfirmed(data);
      },
      onKillRejected: (data) => {
        killReporterRef.current?.onRejected(data);
      },
      onScore: (_data) => {
        // 스코어는 online-sync가 matrix_state에서 이미 처리
      },
      onResult: (_data) => {
        // 에폭 결과 — Phase 5에서 결과 화면 UI 연동
      },
      onLevelUpChoices: (data) => {
        setOnlineLevelUpChoices(data.choices);
      },
    };
  }, [isOnline]);

  const matrixSocket = useMatrixSocket(matrixListeners);

  // 온라인 시스템 인스턴스 초기화 (마운트 시 1회)
  useEffect(() => {
    if (!isOnline) return;

    const sync = new OnlineSyncSystem();
    const prediction = new ClientPrediction();
    const killRep = new KillReporter();
    const epoch = new EpochUIBridge();
    const mpRenderer = new MultiplayerRenderer();

    onlineSyncRef.current = sync;
    clientPredictionRef.current = prediction;
    killReporterRef.current = killRep;
    epochBridgeRef.current = epoch;
    multiplayerRendererRef.current = mpRenderer;

    // 킬 리포터 콜백 설정 — PvP 이펙트 연동
    killRep.setCallbacks({
      onConfirmed: (kill) => {
        setSessionKills(prev => prev + 1);
        // v33 Phase 4: 킬 이펙트 + 킬피드 (원격 플레이어 위치로 이펙트)
        const targetPos = sync.getPlayerPosition(kill.targetId);
        if (targetPos) {
          mpRenderer.onKillConfirmed(
            kill,
            'YOU',
            countryIso3 ?? 'UNK',
            kill.targetId,
            '',
            targetPos.x,
            targetPos.y,
            '',
          );
        }
      },
      onRejected: (_targetId, _reason) => {
        // 킬 롤백 — 세션 킬 카운트 감소
        setSessionKills(prev => Math.max(0, prev - 1));
      },
    });

    // 에폭 UI 콜백 설정
    epoch.setCallbacks({
      onPhaseChange: (_phase, _config) => {
        setEpochUI(epoch.state);
      },
      onWarSiren: () => {
        soundManager.playSFX('alert');
      },
      onEpochEnd: () => {
        setEpochUI(epoch.state);
        mpRenderer.reset(); // 에폭 종료 시 이펙트 클리어
      },
    });

    // 서버 연결 시작
    if (serverUrl) {
      matrixSocket.connect(serverUrl);
    }

    return () => {
      sync.reset();
      prediction.reset();
      killRep.reset();
      epoch.reset();
      mpRenderer.reset();
      seededSpawning.enterOfflineMode();
      matrixSocket.disconnect();
      onlineSyncRef.current = null;
      clientPredictionRef.current = null;
      killReporterRef.current = null;
      epochBridgeRef.current = null;
      multiplayerRendererRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, serverUrl]);

  // 온라인 모드: 아레나 입장 (연결 완료 후)
  useEffect(() => {
    if (!isOnline || matrixSocket.connectionState !== 'connected' || !countryIso3) return;
    matrixSocket.joinArena(countryIso3);
    seededSpawning.enterOnlineMode();
  }, [isOnline, matrixSocket.connectionState, countryIso3, matrixSocket]);

  // 온라인 모드: 보간 틱 (requestAnimationFrame으로 매 프레임 호출)
  useEffect(() => {
    if (!isOnline) return;
    let rafId: number;

    const tick = () => {
      // 원격 플레이어 보간
      const interpolated = onlineSyncRef.current?.interpolatePlayers() ?? [];
      setRemotePlayers(interpolated);

      // 클라이언트 예측 보정 tick
      clientPredictionRef.current?.tick();

      // 킬 리포터 타임아웃 체크 (매초 1회를 간략화하여 매 프레임)
      killReporterRef.current?.tick();

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isOnline]);

  // v32 Phase 3: Branch selection + Synergy notification
  const [branchPending, setBranchPending] = useState<{
    skill: WeaponType;
    skillName: string;
    skillColor: string;
    branchA: BranchOption;
    branchB: BranchOption;
  } | null>(null);
  const [synergyNotification, setSynergyNotification] = useState<SynergyNotificationData | null>(null);

  // 선택된 캐릭터 ref (stale closure 방지)
  const selectedClassRef = useRef(initialClass);
  selectedClassRef.current = gameState.selectedClass;

  // ─────────────────────────────────────────
  // 초기 캐릭터 설정
  // ─────────────────────────────────────────
  useEffect(() => {
    gameState.setSelectedClass(initialClass);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialClass]);

  // ─────────────────────────────────────────
  // 게임 자동 시작 (마운트 시)
  // ─────────────────────────────────────────
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    const cls = initialClass;

    // Arena 초기화 (9명 AI 에이전트 스폰)
    arena.initializeArena(cls);

    // 무기 초기화
    const initialWeapons: Record<string, number> = {};
    if (cls === 'cypher') {
      initialWeapons['sword'] = 1;
      initialWeapons['axe'] = 1;
      initialWeapons['knife'] = 1;
      initialWeapons['bow'] = 1;
      initialWeapons['crossbow'] = 1;
    } else {
      const startWeapon = CLASS_DATA[cls]?.startWeapon || 'whip';
      initialWeapons[startWeapon] = 1;
    }
    gameState.setWeapons(initialWeapons);

    // 게임 상태 설정
    gameState.setGameState({
      isPlaying: true,
      isGameOver: false,
      isLevelUp: false,
      isCharacterSelect: false,
      gameTime: 0,
      stage: 999,  // Singularity/Arena 모드 표시
      phase: 'farming',
      wave: 1 as WaveNumber,
    });

    // HP 초기화
    const maxHP = GAME_CONFIG.PLAYER_HP * (CLASS_DATA[cls]?.hpMult || 1);
    gameState.setHealth(maxHP);
    gameState.setScore(0);
    gameState.setXp(0);
    gameState.setLevel(1);
    gameState.setGameTime(0);
    gameState.setSpecialCooldown(0);
    gameState.setResetTrigger(prev => prev + 1);
    gameState.setDamageFlashTrigger(false);
    gameState.setIsMenuOpen(false);
    gameState.setAppliedReward(null);
    gameState.setRerollsLeft(MAX_REROLLS);

    // BGM 시작
    soundManager.playGameBGM();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─────────────────────────────────────────
  // 키보드 단축키
  // ─────────────────────────────────────────
  useKeyboardShortcuts([
    {
      key: 'Escape',
      action: () => {
        if (gameState.gameState.isLevelUp) return; // 레벨업 중에는 무시
        if (gameState.gameState.isGameOver) return;
        setIsPaused(prev => !prev);
        gameState.setIsMenuOpen(prev => !prev);
      },
      description: 'Pause / Resume',
    },
  ], { enabled: gameState.gameState.isPlaying });

  // ─────────────────────────────────────────
  // 콜백 래퍼들 (MatrixCanvas → gameState)
  // ─────────────────────────────────────────

  // 데미지 플래시
  const handleDamageTaken = useCallback(() => {
    gameState.handleDamageTaken(true);
  }, [gameState]);

  // 게임 오버
  const handleGameOver = useCallback((finalScore: number) => {
    gameState.setGameState(prev => ({ ...prev, isPlaying: false, isGameOver: true }));
    gameState.setScore(finalScore);
    soundManager.playSFX('gameover');
  }, [gameState]);

  // 레벨업 선택 (v32: branch check + synergy notification 추가)
  const handleSelectUpgrade = useCallback((type: string) => {
    const weaponType = type as WeaponType;

    // Check if this upgrade triggers a branch choice at Lv.11
    if (skillBuild.needsBranchChoice(weaponType)) {
      const branches = SKILL_BRANCHES[weaponType];
      if (branches) {
        const weaponData = WEAPON_DATA[weaponType as keyof typeof WEAPON_DATA];
        setBranchPending({
          skill: weaponType,
          skillName: weaponData?.name || weaponType,
          skillColor: weaponData?.color || '#ECECEF',
          branchA: { ...branches.A, ultimateEffect: branches.A.ultimateEffect },
          branchB: { ...branches.B, ultimateEffect: branches.B.ultimateEffect },
        });
        return; // Don't apply upgrade yet — wait for branch selection
      }
    }

    // Check for synergy activation
    const currentLevel = gameState.weapons[weaponType] || 0;
    const newSynergy = skillBuild.checkNewSynergies(weaponType, currentLevel + 1);
    if (newSynergy) {
      setSynergyNotification({
        id: newSynergy.id,
        name: newSynergy.name,
        description: newSynergy.description || '',
        tier: newSynergy.tier || 'basic',
      });
    }

    const maxHP = GAME_CONFIG.PLAYER_HP * (CLASS_DATA[gameState.selectedClass]?.hpMult || 1);
    gameState.handleSelectUpgrade(weaponType, maxHP);
  }, [gameState, skillBuild]);

  // v32 Phase 3: Handle branch selection
  const handleBranchSelect = useCallback((branch: 'A' | 'B') => {
    if (!branchPending) return;
    const { skill } = branchPending;

    // Apply the branch choice
    skillBuild.selectBranch(skill, branch);

    // Check for synergy
    const currentLevel = gameState.weapons[skill] || 0;
    const newSynergy = skillBuild.checkNewSynergies(skill, currentLevel + 1);
    if (newSynergy) {
      setSynergyNotification({
        id: newSynergy.id,
        name: newSynergy.name,
        description: newSynergy.description || '',
        tier: newSynergy.tier || 'basic',
      });
    }

    // Now apply the upgrade
    const maxHP = GAME_CONFIG.PLAYER_HP * (CLASS_DATA[gameState.selectedClass]?.hpMult || 1);
    gameState.handleSelectUpgrade(skill, maxHP);
    setBranchPending(null);
  }, [branchPending, gameState, skillBuild]);

  // 보스 콜백 (stub - Arena에서는 보스 없음)
  const handleBossSpawn = useCallback(() => {}, []);
  const handleBossUpdate = useCallback((_boss: Enemy | null) => {}, []);
  const handleBossDefeated = useCallback(() => {}, []);
  const handleBossWarning = useCallback((_bossType: string) => {}, []);

  // 체스트 콜백 (stub)
  const handleChestCollected = useCallback(() => {}, []);
  const handleMaterialCollected = useCallback(() => {}, []);

  // 재시작
  const handleRestart = useCallback(() => {
    const cls = selectedClassRef.current;
    soundManager.playSFX('start');

    // Arena 재초기화
    arena.initializeArena(cls);
    setSessionKills(0);

    // 무기 초기화
    const initialWeapons: Record<string, number> = {};
    if (cls === 'cypher') {
      initialWeapons['sword'] = 1;
      initialWeapons['axe'] = 1;
      initialWeapons['knife'] = 1;
      initialWeapons['bow'] = 1;
      initialWeapons['crossbow'] = 1;
    } else {
      const startWeapon = CLASS_DATA[cls]?.startWeapon || 'whip';
      initialWeapons[startWeapon] = 1;
    }
    gameState.setWeapons(initialWeapons);

    gameState.setGameState({
      isPlaying: true,
      isGameOver: false,
      isLevelUp: false,
      isCharacterSelect: false,
      gameTime: 0,
      stage: 999,
      phase: 'farming',
      wave: 1 as WaveNumber,
    });

    const maxHP = GAME_CONFIG.PLAYER_HP * (CLASS_DATA[cls]?.hpMult || 1);
    gameState.setHealth(maxHP);
    gameState.setScore(0);
    gameState.setXp(0);
    gameState.setLevel(1);
    gameState.setGameTime(0);
    gameState.setSpecialCooldown(0);
    gameState.setResetTrigger(prev => prev + 1);
    gameState.setDamageFlashTrigger(false);
    gameState.setIsMenuOpen(false);
    gameState.setAppliedReward(null);
    gameState.setRerollsLeft(MAX_REROLLS);
    setIsPaused(false);

    soundManager.playGameBGM();
  }, [gameState, arena]);

  // Pause → Resume
  const handleResume = useCallback(() => {
    setIsPaused(false);
    gameState.setIsMenuOpen(false);
  }, [gameState]);

  // Pause → Exit to Lobby
  const handleExitToLobby = useCallback(() => {
    setIsPaused(false);
    gameState.setIsMenuOpen(false);
    gameState.setGameState(prev => ({
      ...prev,
      isPlaying: false,
      isGameOver: false,
    }));

    // v33 Phase 3+4: 온라인 모드 퇴장 시 클린업
    if (isOnline) {
      matrixSocket.leaveArena();
      onlineSyncRef.current?.reset();
      clientPredictionRef.current?.reset();
      killReporterRef.current?.reset();
      epochBridgeRef.current?.reset();
      multiplayerRendererRef.current?.reset();
      seededSpawning.enterOfflineMode();
    }

    soundManager.playMenuBGM();
    onExitToLobby();
  }, [gameState, onExitToLobby, isOnline, matrixSocket]);

  // V3 시스템 콜백
  const handleV3Update = useCallback((state: V3GameSystems, events: V3SystemEvents) => {
    setV3State(state);
    setV3Events(events);
  }, []);

  // Kernel Panic 궁극기 트리거 (v32)
  const handleTriggerUltimate = useCallback((): boolean => {
    return v3Systems.breakTime.triggerUltimate();
  }, [v3Systems.breakTime]);

  // 플레이어 위치 업데이트
  const handlePlayerPositionUpdate = useCallback((x: number, y: number) => {
    playerPositionRef.current = { x, y };
    setPlayerPosition({ x, y });

    // v33 Phase 3: 온라인 모드에서 입력 전송 (10Hz 스로틀은 useMatrixSocket 내부 처리)
    if (isOnline) {
      matrixSocket.sendInput(x, y, 0, false);
      clientPredictionRef.current?.applyInput({
        tick: matrixSocket.serverTick,
        x, y, angle: 0, boost: false,
        timestamp: Date.now(),
      });
    }
  }, [isOnline, matrixSocket]);

  // 싱귤러리티 킬 카운트
  const handleSingularityKill = useCallback(() => {
    setSessionKills(prev => prev + 1);
  }, []);

  // ─────────────────────────────────────────
  // gameActive 계산 (MatrixCanvas에 전달)
  // ─────────────────────────────────────────
  const gameActive = useMemo(() => {
    return (
      gameState.gameState.isPlaying &&
      !gameState.gameState.isLevelUp &&
      !gameState.isMenuOpen &&
      !isPaused
    );
  }, [
    gameState.gameState.isPlaying,
    gameState.gameState.isLevelUp,
    gameState.isMenuOpen,
    isPaused,
  ]);

  // ─────────────────────────────────────────
  // HUD 데이터 준비
  // ─────────────────────────────────────────
  const maxHealth = useMemo(() => {
    const cls = gameState.selectedClass;
    return GAME_CONFIG.PLAYER_HP * (CLASS_DATA[cls]?.hpMult || 1);
  }, [gameState.selectedClass]);

  const weaponSlots: WeaponSlot[] = useMemo(() => {
    return Object.entries(gameState.weapons)
      .filter(([_type, level]: [string, number]) => level > 0)
      .map(([type, level]: [string, number]) => ({
        type,
        level,
        cooldownPercent: gameState.weaponCooldowns[type as WeaponType] || 0,
      }));
  }, [gameState.weapons, gameState.weaponCooldowns]);

  // v33 Phase 3: 온라인 레벨업 선택 전송
  const handleOnlineLevelUpSelect = useCallback((type: string) => {
    if (isOnline) {
      matrixSocket.chooseLevelUp(type);
    }
    handleSelectUpgrade(type);
  }, [isOnline, matrixSocket, handleSelectUpgrade]);

  // LevelUp 선택지 생성 — useState로 한 번만 생성 (원본 LevelUpModal 패턴)
  // useMemo + weapons 의존성은 무기 변경 시마다 Math.random() 재실행 → 선택지 셔플 버그
  const [levelUpOptions, setLevelUpOptions] = useState<LevelUpOption[]>([]);

  useEffect(() => {
    if (gameState.gameState.isLevelUp) {
      // v33 Phase 3: 온라인 모드에서는 서버가 보낸 선택지 사용
      if (isOnline && onlineLevelUpChoices) {
        setLevelUpOptions(onlineLevelUpChoices.map((choice) => {
          const weaponData = WEAPON_DATA[choice.skill as keyof typeof WEAPON_DATA];
          const rarity: LevelUpOption['rarity'] =
            choice.priorityScore > 80 ? 'rare'
            : choice.isNew ? 'uncommon'
            : 'common';
          return {
            id: choice.id,
            name: weaponData?.name || choice.skill,
            description: weaponData?.desc || '',
            currentLevel: choice.currentLevel,
            maxLevel: weaponData?.stats?.length || 8,
            rarity,
            icon: '',
            type: 'weapon' as const,
          };
        }));
        setOnlineLevelUpChoices(null); // 소비 완료
        return;
      }

      // 오프라인 모드: 기존 로컬 생성
      const choices = skillBuild.generateLevelUpChoices(gameState.weapons, 4);
      setLevelUpOptions(choices.map((choice: LevelUpChoice) => {
        const weaponData = WEAPON_DATA[choice.skill as keyof typeof WEAPON_DATA];
        const rarity: LevelUpOption['rarity'] =
          choice.source === 'priority' ? 'rare'
          : choice.willActivateSynergy ? 'epic'
          : choice.isNew ? 'uncommon'
          : 'common';
        return {
          id: choice.skill,
          name: weaponData?.name || choice.skill,
          description: weaponData?.desc || '',
          currentLevel: choice.currentLevel,
          maxLevel: weaponData?.stats?.length || 8,
          rarity,
          icon: '',
          type: 'weapon' as const,
        };
      }));
    } else {
      setLevelUpOptions([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.gameState.isLevelUp, isOnline, onlineLevelUpChoices]); // Only trigger on isLevelUp change, NOT weapons

  // Result 화면 데이터
  const resultWeapons = useMemo(() => {
    return Object.entries(gameState.weapons)
      .filter(([_type, level]: [string, number]) => level > 0)
      .map(([type]: [string, number]) => type);
  }, [gameState.weapons]);

  // Arena 리더보드 (ArenaHUD용)
  // Agent 컬러 팔레트 (10명분)
  const AGENT_COLORS = ['#10B981', '#FF4444', '#44AAFF', '#FFAA00', '#AA44FF', '#FF44AA', '#44FFAA', '#FFFF44', '#FF8844', '#8844FF'];
  const arenaLeaderboard: LeaderboardEntry[] = useMemo(() => {
    return arena.agents
      .filter((a: { isAlive: boolean }) => a.isAlive)
      .sort((a: { kills: number }, b: { kills: number }) => b.kills - a.kills)
      .slice(0, 5)
      .map((a: { id: string; displayName?: string; playerClass: string; kills: number; deaths: number; isLocalPlayer: boolean; isAlive: boolean }, idx: number) => ({
        agentId: a.id,
        displayName: a.displayName || a.playerClass,
        kills: a.kills,
        deaths: a.deaths,
        score: a.kills * 100,
        isPlayer: a.isLocalPlayer,
        isAlive: a.isAlive,
        color: AGENT_COLORS[idx % AGENT_COLORS.length],
      }));
  }, [arena.agents]);

  // ─────────────────────────────────────────
  // v33 Phase 4: 멀티플레이어 렌더링 콜백
  // ─────────────────────────────────────────
  const handleMultiplayerRender = useCallback((
    ctx: CanvasRenderingContext2D,
    cameraX: number,
    cameraY: number,
    canvasWidth: number,
    canvasHeight: number,
    zoom: number,
    time: number,
  ) => {
    const renderer = multiplayerRendererRef.current;
    if (!renderer) return;

    const sync = onlineSyncRef.current;
    const epochBridge = epochBridgeRef.current;
    if (!sync) return;

    // 보간된 원격 플레이어 가져오기 (이미 RAF tick에서 호출되지만 draw 타이밍에 최신 보간 적용)
    const interpolated = sync.state.remotePlayers;

    // 에폭 상태에서 PvP + war 카운트다운 추출
    const pvpEnabled = sync.state.pvpEnabled;
    const warCountdown = epochBridge?.state.warCountdownNumber ?? null;

    renderer.renderMultiplayerLayer({
      ctx,
      cameraX,
      cameraY,
      canvasWidth,
      canvasHeight,
      zoom,
      remotePlayers: interpolated,
      pvpEnabled,
      warCountdown,
      time,
    });
  }, []);

  // ─────────────────────────────────────────
  // 렌더링
  // ─────────────────────────────────────────

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100dvh',
      overflow: 'hidden',
      backgroundColor: 'black',
      userSelect: 'none',
    }}>

      {/* ─── MatrixCanvas: 68개 props 바인딩 ─── */}
      <MatrixCanvas
        // === 점수/상태 업데이트 콜백 (12개) ===
        onScoreUpdate={gameState.handleScoreUpdate}
        onHealthUpdate={gameState.handleHealthUpdate}
        onXpUpdate={gameState.handleXpUpdate}
        onTimeUpdate={gameState.handleTimeUpdate}
        onLevelUp={gameState.handleLevelUpTrigger}
        onGameOver={handleGameOver}
        onDamageTaken={handleDamageTaken}
        onSpecialUpdate={gameState.handleSpecialUpdate}
        onWeaponCooldownsUpdate={gameState.handleWeaponCooldownsUpdate}
        onChestCollected={handleChestCollected}
        onMaterialCollected={handleMaterialCollected}

        // === 보스 콜백 (4개) - Arena에서는 stub ===
        onBossSpawn={handleBossSpawn}
        onBossUpdate={handleBossUpdate}
        onBossDefeated={handleBossDefeated}
        onBossWarning={handleBossWarning}

        // === 게임 상태 (8개) ===
        gameActive={gameActive}
        upgrades={gameState.weapons}
        resetTrigger={gameState.resetTrigger}
        gameState={gameState.gameState}
        playerClass={gameState.selectedClass}
        appliedReward={gameState.appliedReward}
        isAutoHunt={isAutoHunt}
        persistentUpgrades={DEFAULT_PERSISTENT_UPGRADES}

        // === 모드/시간 (3개) ===
        timeScale={1.0}
        testerMode={false}
        gameMode={gameMode}

        // === Singularity 콜백 (5개) ===
        singularityDifficultyMultiplier={undefined}
        onSingularityTimeUpdate={undefined}
        onSingularityKill={handleSingularityKill}
        onSingularityBossCheck={undefined}
        onSingularityMilestoneCheck={undefined}
        onMilestoneAchieved={undefined}

        // === NFT/튜토리얼 (5개) - 비활성 ===
        nftEffects={undefined}
        onTutorialMove={undefined}
        onTutorialKill={undefined}
        onTutorialGemCollect={undefined}

        // === 캐릭터 보너스 (1개) ===
        characterBonus={DEFAULT_CHARACTER_BONUS}

        // === 알림/이벤트 (3개) ===
        onNotifyItem={undefined}
        onV3Update={handleV3Update}
        onEventLog={undefined}

        // === 스킨 (1개) ===
        skinColors={undefined}

        // === 터렛/에이전트 (3개) ===
        placedTurrets={[]}
        onTurretsUpdate={undefined}
        onPlayerPositionUpdate={handlePlayerPositionUpdate}

        // === 시스템 통계 (2개) ===
        onEntityCountUpdate={setEntityCounts}
        debugMode={false}

        // === Arena (Battle Royale) (5개) ===
        arenaAgents={arena.agents}
        arenaKillFeed={arena.killFeed}
        onArenaUpdate={arena.updateArena}
        onArenaAgentDamage={arena.damageAgent}
        onArenaAgentKill={arena.killAgent}
        addAgentXp={arena.addAgentXp}

        // === v33 Phase 4: Multiplayer Rendering ===
        onMultiplayerRender={isOnline ? handleMultiplayerRender : undefined}
      />

      {/* ─── MatrixHUD: 상단 HP/XP/레벨 + 무기 슬롯 ─── */}
      {gameState.gameState.isPlaying && !gameState.gameState.isGameOver && (
        <MatrixHUD
          health={gameState.health}
          maxHealth={maxHealth}
          xp={gameState.xp}
          xpToNext={gameState.nextXp}
          level={gameState.level}
          score={gameState.score}
          kills={sessionKills}
          gameTime={gameState.gameTime}
          weaponSlots={weaponSlots}
          enemyCount={entityCounts.enemies}
          autoHuntEnabled={isAutoHunt}
          isPaused={isPaused}
        />
      )}

      {/* ─── ArenaHUD: 배틀로얄 정보 ─── */}
      {gameState.gameState.isPlaying && !gameState.gameState.isGameOver && (
        <ArenaHUD
          timeRemaining={Math.max(0, arena.config.gameDuration - arena.gameTime)}
          aliveCount={arena.agents.filter((a: { isAlive: boolean }) => a.isAlive).length}
          totalCount={arena.agents.length + 1}
          currentPhase={0}
          zoneWarning={false}
          zoneDps={0}
          leaderboard={arenaLeaderboard}
          playerOutsideZone={false}
        />
      )}

      {/* ─── v33 Phase 3: Online Epoch Phase HUD ─── */}
      {isOnline && epochUI && gameState.gameState.isPlaying && !gameState.gameState.isGameOver && (
        <div style={{
          position: 'absolute',
          top: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          pointerEvents: 'none',
        }}>
          {/* 페이즈 이름 + 타이머 */}
          <div style={{
            background: 'rgba(0,0,0,0.7)',
            border: `1px solid ${epochUI.config.color}`,
            borderRadius: 8,
            padding: '4px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <span style={{
              color: epochUI.config.color,
              fontFamily: '"Black Ops One", monospace',
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: 2,
            }}>
              {epochUI.config.displayName}
            </span>
            <span style={{
              color: '#E8E0D4',
              fontFamily: '"Rajdhani", monospace',
              fontSize: 18,
              fontWeight: 600,
            }}>
              {epochUI.timerDisplay}
            </span>
          </div>

          {/* 전쟁 카운트다운 숫자 (war_countdown 페이즈) */}
          {epochUI.warCountdownNumber !== null && (
            <div style={{
              color: epochUI.warSiren ? '#EF4444' : '#FBBF24',
              fontFamily: '"Black Ops One", monospace',
              fontSize: epochUI.warSiren ? 48 : 36,
              fontWeight: 900,
              textShadow: epochUI.warSiren
                ? '0 0 20px rgba(239,68,68,0.8), 0 0 40px rgba(239,68,68,0.4)'
                : '0 0 10px rgba(251,191,36,0.5)',
              animation: epochUI.warSiren ? 'pulse 0.5s infinite' : undefined,
            }}>
              {epochUI.warCountdownNumber}
            </div>
          )}

          {/* PvP 상태 인디케이터 */}
          {epochUI.config.pvpEnabled && (
            <div style={{
              background: 'rgba(239,68,68,0.2)',
              border: '1px solid rgba(239,68,68,0.6)',
              borderRadius: 4,
              padding: '2px 8px',
              color: '#EF4444',
              fontSize: 11,
              fontFamily: '"Rajdhani", monospace',
              fontWeight: 600,
              letterSpacing: 1,
            }}>
              PVP ACTIVE
            </div>
          )}

          {/* 연결 상태 */}
          <div style={{
            fontSize: 10,
            color: matrixSocket.connectionState === 'connected' ? '#4ADE80' : '#EF4444',
            fontFamily: 'monospace',
          }}>
            {matrixSocket.connectionState === 'connected'
              ? `ONLINE · ${matrixSocket.latency}ms`
              : matrixSocket.connectionState.toUpperCase()}
          </div>
        </div>
      )}

      {/* ─── v3 시스템 시각 UI (v32 Phase 1) ─── */}
      {gameState.gameState.isPlaying && !gameState.gameState.isGameOver && v3State && (
        <>
          {/* BreakTimeOverlay: Data Burst 경고 + 게이지 + Kernel Panic */}
          <BreakTimeOverlay
            breakTime={v3State.breakTime}
            onTriggerUltimate={handleTriggerUltimate}
          />

          {/* ComboCounter: 10단계 콤보 티어 표시 */}
          <ComboCounter combo={v3State.combo} />

          {/* QuizChallengeCard: 미션 목표 카드 */}
          <QuizChallengeCard challenge={v3State.quiz.activeChallenge} />

          {/* QuizPenaltyIndicator: 미션 실패 페널티 */}
          <QuizPenaltyIndicator
            isActive={v3State.quiz.isPenaltyActive}
            timer={v3State.quiz.penaltyTimer}
          />
        </>
      )}

      {/* ─── 레벨업 모달 ─── */}
      {gameState.gameState.isLevelUp && levelUpOptions.length > 0 && !branchPending && (
        <MatrixLevelUp
          options={levelUpOptions}
          onSelect={isOnline ? handleOnlineLevelUpSelect : handleSelectUpgrade}
        />
      )}

      {/* ─── v32 Phase 3: Branch Selection Modal ─── */}
      {branchPending && (
        <BranchSelectModal
          skillName={branchPending.skillName}
          skillColor={branchPending.skillColor}
          branchA={branchPending.branchA}
          branchB={branchPending.branchB}
          onSelect={handleBranchSelect}
        />
      )}

      {/* ─── v32 Phase 3: Synergy Notification Banner ─── */}
      <SynergyNotification
        synergy={synergyNotification}
        onDismiss={() => setSynergyNotification(null)}
        duration={4000}
      />

      {/* ─── 일시정지 메뉴 ─── */}
      {isPaused && !gameState.gameState.isGameOver && !gameState.gameState.isLevelUp && (
        <MatrixPause
          onResume={handleResume}
          onExitToLobby={handleExitToLobby}
        />
      )}

      {/* ─── 게임 오버 결과 화면 ─── */}
      {gameState.gameState.isGameOver && (
        <MatrixResult
          survived={false}
          survivalTime={gameState.gameTime}
          kills={sessionKills}
          score={gameState.score}
          level={gameState.level}
          weapons={resultWeapons}
          onRetry={handleRestart}
          onExitToLobby={handleExitToLobby}
        />
      )}
    </div>
  );
}

export default MatrixApp;
