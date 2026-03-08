'use client';

/**
 * GameCanvas3D — R3F Canvas 래퍼
 * 기존 GameCanvas.tsx와 동일한 Props 인터페이스
 * Scene, SkyBox, PlayCamera, GameLoop 조합
 * HTML HUD 오버레이는 Canvas 밖에 배치 (기존 패턴)
 *
 * ★ useFrame priority 규칙: 모든 useFrame은 priority 0 (기본값) 사용!
 * JSX 마운트 순서로 실행 순서 제어:
 *   1. GameLoop (상태 보간 + 예측)
 *   2. PlayCamera (카메라 추적)
 *   3. 기타 시각 컴포넌트
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import type { Camera } from 'three';
import type { GameData, UiState } from '@/hooks/useSocket';
import type { AgentNetworkData, OrbNetworkData } from '@agent-survivor/shared';
import { ARENA_CONFIG } from '@agent-survivor/shared';
import { populateAppearanceCache, clearAppearanceCache } from '@/lib/3d/appearance-cache';
import { getTerrainBonusDescription } from '@/lib/3d/terrain-textures';
import { useInputManager } from '@/hooks/useInputManager';

// 3D 컴포넌트
import { Scene } from '@/components/3d/Scene';
import { SkyBox } from '@/components/3d/SkyBox';
import { TPSCamera } from '@/components/3d/TPSCamera';
import type { KillcamState, ObserverState } from '@/components/3d/TPSCamera';
import { GameLoop } from '@/components/3d/GameLoop';
import { AgentInstances } from '@/components/3d/AgentInstances';
import { EquipmentInstances } from '@/components/3d/EquipmentInstances';
import type { AnimationStateMachine } from '@/lib/3d/animation-state-machine';
import { ZoneTerrain } from '@/components/3d/ZoneTerrain';
import { TerrainDeco } from '@/components/3d/TerrainDeco';
import { HeightmapTerrain } from '@/components/3d/HeightmapTerrain';
import MCTerrain from '@/components/3d/MCTerrain';
import { countryHash, MC_BLOCK_CONSTANTS } from '@/lib/3d/coordinate-utils';
import { ObstacleInstances } from '@/components/3d/ObstacleInstances';
import { ArenaBoundary } from '@/components/3d/ArenaBoundary';
import { MapStructures } from '@/components/3d/MapStructures';
import { OrbInstances } from '@/components/3d/OrbInstances';
import { MCParticles } from '@/components/3d/MCParticles';
import type { MCParticlesHandle } from '@/components/3d/MCParticles';
import { AuraRings } from '@/components/3d/AuraRings';
import { BuildEffects } from '@/components/3d/BuildEffects';
import { AbilityEffects } from '@/components/3d/AbilityEffects';
import { FlagSprite } from '@/components/3d/FlagSprite';

// 기존 HUD 오버레이 (Canvas 밖 HTML)
import { DeathOverlay } from './DeathOverlay';
import { RoundTimerHUD } from './RoundTimerHUD';
import { RoundResultOverlay } from './RoundResultOverlay';
import { LevelUpOverlay } from './LevelUpOverlay';
import { BuildHUD } from './BuildHUD';
import { XPBar } from './XPBar';
import { ShrinkWarning } from './ShrinkWarning';
import { SynergyPopup } from './SynergyPopup';
import { CoachBubble } from './CoachBubble';
import { AnalystPanel } from './AnalystPanel';
import { GameMinimap } from './GameMinimap';
import { Minimap } from './Minimap';
import { MinimapHUD } from './MinimapHUD';
import { FactionScoreboard } from './FactionScoreboard';
import { KillFeedHUD } from './KillFeedHUD';
import { BattleResultOverlay } from './BattleResultOverlay';
import { SpectatorMode } from './SpectatorMode';
import type { SpectatorTarget } from './SpectatorMode';
import { useSoundEngine } from '@/hooks/useSoundEngine';
import { PostProcessingEffects, CSSVignetteOverlay, CSSChromaticOverlay } from '@/components/3d/PostProcessingEffects';
import type { FXQualityLevel } from '@/components/3d/PostProcessingEffects';
import { WeatherEffects, LightningFlashOverlay, WeatherHUD } from '@/components/3d/WeatherEffects';
import { MobileControls } from './MobileControls';

// v14: Epoch HUD + overlays (HTML 오버레이)
import { EpochHUD, WarCountdownOverlay, WarVignetteOverlay, RespawnOverlay } from './EpochHUD';
import { ScoreboardOverlay, useScoreboardToggle } from './ScoreboardOverlay';

// v14: 3D Weapon VFX + Damage Numbers + Capture Points (R3F Canvas 내부)
import { WeaponRenderer } from '@/components/3d/WeaponRenderer';
import { DamageNumbers } from '@/components/3d/DamageNumbers';
import { CapturePointRenderer } from '@/components/3d/CapturePointRenderer';

// v19 Phase 2: AR 컴포넌트 imports
import { ARInterpolationTick } from '@/components/game/ar/ARInterpolationTick';
import { ARCamera } from '@/components/game/ar/ARCamera';
import { ARPlayer } from '@/components/game/ar/ARPlayer';
import { AREntities } from '@/components/game/ar/AREntities';
import { ARTerrain } from '@/components/game/ar/ARTerrain';
import { ARHUD } from '@/components/game/ar/ARHUD';
import { ARMinimap } from '@/components/game/ar/ARMinimap';
import type { ARInterpolationState } from '@/lib/3d/ar-interpolation';
import { getInterpolatedPos } from '@/lib/3d/ar-interpolation';
import type { ARState, ARMinimapEntity, ARTerrainTheme } from '@/lib/3d/ar-types';
import type { ARUiState, AREvent } from '@/hooks/useSocket';
import type { ARChoice } from '@/lib/3d/ar-types';

// v19 Phase 3: 전투 피드백 AR 컴포넌트
import { ARDamageNumbersBridge } from '@/components/game/ar/ARDamageNumbersBridge';
import ARNameTags from '@/components/game/ar/ARNameTags';
import { ARLevelUp } from '@/components/game/ar/ARLevelUp';
import { ARPvPOverlay } from '@/components/game/ar/ARPvPOverlay';
import { ARMobileControls, isTouchDevice } from '@/components/game/ar/ARMobileControls';
import { ARWeaponEvolutionToast } from '@/components/game/ar/ARWeaponEvolutionToast';
import { ARSynergyBar } from '@/components/game/ar/ARSynergyBar';
import { ARStatusEffects } from '@/components/game/ar/ARStatusEffects';

interface GameCanvas3DProps {
  dataRef: React.MutableRefObject<GameData>;
  uiState: UiState;
  sendInput: (angle: number, boost: boolean, seq: number, dash?: boolean) => void;
  /** v16: 이동/조준 분리 입력 전송 */
  sendInputV16: (moveAngle: number | null, aimAngle: number, boost: boolean, seq: number, dash?: boolean, jump?: boolean) => void;
  respawn: (name?: string, skinId?: number) => void;
  playerName: string;
  skinId: number;
  onExit: () => void;
  chooseUpgrade?: (choiceId: string) => void;
  dismissSynergyPopup?: (synergyId: string) => void;
  /** v19: 아레나 모드 (MCTerrain 복셀 지형 사용) */
  isArenaMode?: boolean;
  /** v19: 아레나 시드 (국가 해시, 없으면 countryHash에서 자동 계산) */
  arenaSeed?: number;
  /** v19: 아레나 반경 (MC 블록 단위, 기본 80) */
  arenaRadius?: number;
  // v19 Phase 2: AR data pipeline props
  /** Raw AR state ref (20Hz, for 3D useFrame consumers) */
  arStateRef?: React.MutableRefObject<ARState | null>;
  /** AR interpolation state ref (20Hz → 60fps smooth positions) */
  arInterpRef?: React.MutableRefObject<ARInterpolationState>;
  /** AR event queue ref (damage, kill, boss events) */
  arEventQueueRef?: React.MutableRefObject<AREvent[]>;
  /** AR UI state (250ms throttle, for HTML overlay components) */
  arUiState?: ARUiState;
  /** AR choice callback (level-up tome/weapon selection) */
  sendARChoice?: (choice: ARChoice) => void;
}

export function GameCanvas3D({
  dataRef,
  uiState,
  sendInput,
  sendInputV16,
  respawn,
  playerName,
  skinId,
  onExit,
  chooseUpgrade,
  dismissSynergyPopup,
  isArenaMode = false,
  arenaSeed,
  arenaRadius = MC_BLOCK_CONSTANTS.ARENA_RADIUS_BLOCKS,
  arStateRef,
  arInterpRef,
  arEventQueueRef,
  arUiState,
  sendARChoice,
}: GameCanvas3DProps) {
  // ─── Refs ───
  const agentsRef = useRef<AgentNetworkData[]>([]);
  const orbsRef = useRef<OrbNetworkData[]>([]);
  const particlesRef = useRef<MCParticlesHandle>(null!);
  const angleRef = useRef(0);
  const boostRef = useRef(false);
  const inputSeqRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const elapsedRef = useRef(0);
  // Phase 5: 상태 머신 + 인덱스 맵 ref (AgentInstances ↔ EquipmentInstances 공유)
  const stateMachineRef = useRef<AnimationStateMachine | null>(null);
  const agentIndexMapRef = useRef<Map<string, number>>(new Map());
  // v14 S09: 플레이어 ID ref (FlagSprite용, rAF에서 동기화)
  const playerIdRef = useRef<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  // v19: 아레나 로딩 오버레이 (지형 생성 + 서버 상태 수신 완료까지)
  const [arenaLoading, setArenaLoading] = useState(isArenaMode);
  const [loadProgress, setLoadProgress] = useState(0); // 0-100
  const [loadStatus, setLoadStatus] = useState('Connecting to server...');
  const terrainReadyRef = useRef(false);
  const serverReadyRef = useRef(false);

  // v19 Phase 2: AR-specific refs
  const arPlayerPosRef = useRef({ x: 0, y: 0, z: 0 });
  const arYawRef = useRef(0);

  // v19 Phase 3: Weapon evolution toast state
  const [weaponToasts, setWeaponToasts] = useState<Array<{ id: number; weaponId: string; timestamp: number }>>([]);
  const prevWeaponsRef = useRef<Set<string>>(new Set());
  const weaponToastIdRef = useRef(0);

  // v19 Phase 3: PvP kill feed state
  const [pvpKillFeed, setPvpKillFeed] = useState<Array<{ id: string; killerName: string; victimName: string; killerFaction: string; victimFaction: string; timestamp: number }>>([]);

  // v16: InputManager + TPSCamera refs
  const cameraRef = useRef<Camera | null>(null);
  const playerPosRef = useRef({ x: 0, z: 0 });
  const inputManager = useInputManager(containerRef, cameraRef, playerPosRef, !menuOpen);

  // v16 Phase 8: Killcam state
  const killcamRef = useRef<KillcamState>({
    active: false,
    killerId: null,
    killerX: 0,
    killerY: 0,
    startTime: 0,
    onComplete: null,
  });
  const [killcamActive, setKillcamActive] = useState(false);

  // 옵저버 모드 상태
  const observerRef = useRef<ObserverState>({
    active: false,
    freeCam: true,
    followTargetId: null,
    moveInput: { x: 0, z: 0 },
  });

  // 옵저버 모드 활성화: isSpectating이 true가 되면 활성
  useEffect(() => {
    observerRef.current.active = uiState.isSpectating === true;
  }, [uiState.isSpectating]);

  // 옵저버 WASD 키 입력 리스너 (포인터락 없을 때 자유 카메라 이동)
  useEffect(() => {
    if (!uiState.isSpectating) return;
    const keys = new Set<string>();
    const updateMove = () => {
      const mv = observerRef.current.moveInput;
      mv.x = (keys.has('d') || keys.has('D') ? 1 : 0) - (keys.has('a') || keys.has('A') ? 1 : 0);
      mv.z = (keys.has('w') || keys.has('W') ? 1 : 0) - (keys.has('s') || keys.has('S') ? 1 : 0);
    };
    const onDown = (e: KeyboardEvent) => {
      if (['w','a','s','d','W','A','S','D'].includes(e.key)) {
        keys.add(e.key);
        updateMove();
      }
    };
    const onUp = (e: KeyboardEvent) => {
      keys.delete(e.key);
      keys.delete(e.key.toLowerCase());
      keys.delete(e.key.toUpperCase());
      updateMove();
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      observerRef.current.moveInput.x = 0;
      observerRef.current.moveInput.z = 0;
    };
  }, [uiState.isSpectating]);

  // v16 Phase 7: SoundEngine + PostProcessing
  const soundEngine = useSoundEngine();
  const [chromaticIntensity, setChromaticIntensity] = useState(0);
  const [vignetteIntensity, setVignetteIntensity] = useState(0.3);

  // v16: 입력 전송 루프 (30Hz) — InputManager 상태를 서버에 전송
  const lastSentRef = useRef({ ma: 0 as number | null, aa: 0, b: false, d: false, j: false });
  useEffect(() => {
    const interval = setInterval(() => {
      const inp = inputManager.inputRef.current;
      const last = lastSentRef.current;

      // 변경 감지 (dead-reckoning 최적화)
      const changed =
        inp.moveAngle !== last.ma ||
        Math.abs(inp.aimAngle - last.aa) > 0.02 ||
        inp.boost !== last.b ||
        inp.dash !== last.d ||
        inp.jump !== last.j;

      if (changed) {
        inputSeqRef.current++;
        sendInputV16(
          inp.moveAngle,
          inp.aimAngle,
          inp.boost,
          inputSeqRef.current,
          inp.dash || undefined,
          inp.jump || undefined,
        );

        last.ma = inp.moveAngle;
        last.aa = inp.aimAngle;
        last.b = inp.boost;
        last.d = inp.dash;
        last.j = inp.jump;

        // one-shot 소비
        if (inp.dash) inputManager.consumeDash();
        if (inp.jump) inputManager.consumeJump();
      }
    }, 33); // 30Hz
    return () => clearInterval(interval);
  }, [sendInputV16, inputManager]);
  const [terrainToast, setTerrainToast] = useState<string | null>(null);
  // v12 S20: Spectator mode + battle result
  const [spectatorTarget, setSpectatorTarget] = useState<string | null>(null);
  // 옵저버: 팔로우 대상 동기화
  const handleFollowAgent = useCallback((agentId: string | null) => {
    setSpectatorTarget(agentId);
    if (agentId) {
      observerRef.current.freeCam = false;
      observerRef.current.followTargetId = agentId;
    } else {
      observerRef.current.freeCam = true;
      observerRef.current.followTargetId = null;
    }
  }, []);
  // 옵저버: 드래그 → cameraDelta로 라우팅 (SpectatorMode에서 사용)
  const handleObserverDrag = useCallback((dx: number, dy: number) => {
    inputManager.cameraDeltaRef.current.dx += dx * 0.005;
    inputManager.cameraDeltaRef.current.dy += dy * 0.005;
  }, [inputManager]);
  // 옵저버: 줌
  const handleObserverZoom = useCallback((delta: number) => {
    const ref = inputManager.scrollDeltaRef;
    ref.current += delta * 50; // SpectatorMode sends -1/+1
  }, [inputManager]);
  const [battleCountdown, setBattleCountdown] = useState(10);

  // v14: Tab scoreboard toggle
  const scoreboardVisible = useScoreboardToggle();

  const prevLevelRef = useRef(0);

  // v19: 아레나 로딩 진행률 추적 — 지형 생성 + 서버 상태 수신
  useEffect(() => {
    if (!arenaLoading) return;
    const interval = setInterval(() => {
      let progress = 0;
      let status = 'Connecting to server...';

      // 서버 연결 상태 (0-30%)
      if (uiState.connected) {
        progress += 15;
        status = 'Connected. Joining arena...';
      }
      if (uiState.currentRoomId) {
        progress += 15;
        status = 'Joined! Generating terrain...';
      }

      // 지형 생성 완료 (30-70%)
      if (terrainReadyRef.current) {
        progress += 40;
        status = 'Terrain ready. Waiting for game state...';
      }

      // 서버 게임 상태 수신 (70-100%)
      const state = dataRef.current.latestState;
      const pid = dataRef.current.playerId;
      if (state && pid) {
        progress += 15;
        status = 'Receiving game data...';
        if (state.s.find(a => a.i === pid)) {
          progress = 100;
          status = 'Ready!';
          serverReadyRef.current = true;
        }
      }

      setLoadProgress(Math.min(progress, 100));
      setLoadStatus(status);

      // 지형 + 서버 모두 준비되면 로딩 해제
      if (terrainReadyRef.current && serverReadyRef.current) {
        setTimeout(() => setArenaLoading(false), 300); // 짧은 딜레이로 "Ready!" 표시
        clearInterval(interval);
      }
    }, 150);

    // 10초 타임아웃: 어떤 이유든 너무 오래 걸리면 강제 해제
    const timeout = setTimeout(() => {
      setArenaLoading(false);
    }, 10000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [arenaLoading, dataRef, uiState.connected, uiState.currentRoomId]);

  // MCTerrain onTerrainReady 콜백
  const handleTerrainReady = useCallback(() => {
    terrainReadyRef.current = true;
  }, []);

  // ─── v19: 아레나 시드 결정 (prop 우선, 없으면 roomId에서 해시) ───
  const effectiveArenaSeed = arenaSeed ?? countryHash(uiState.currentRoomId ?? 'default');

  // ─── 테마 결정 (uiState.terrainTheme → 폴백 "forest") ───
  const terrainTheme = uiState.terrainTheme || 'forest';

  // ─── 전투 보너스 토스트 (입장 시 3초 표시) ───
  useEffect(() => {
    const desc = getTerrainBonusDescription(terrainTheme);
    if (desc) {
      setTerrainToast(desc);
      const timer = setTimeout(() => setTerrainToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [terrainTheme]);

  // v16: 레벨업 SFX (soundEngine)
  useEffect(() => {
    if (uiState.levelUp && uiState.levelUp.level > prevLevelRef.current) {
      soundEngine.playUI('levelup');
    }
    if (uiState.levelUp) {
      prevLevelRef.current = uiState.levelUp.level;
    }
  }, [uiState.levelUp, soundEngine]);

  // v16 Phase 8: 킬캠 트리거 (사망 + 킬러 존재 시)
  useEffect(() => {
    if (!uiState.deathInfo || !uiState.deathInfo.killer) return;
    // 킬러 에이전트 현재 위치 찾기
    const state = dataRef.current.latestState;
    if (!state) return;
    const killerAgent = state.s.find(a => a.i === uiState.deathInfo!.killer);
    if (!killerAgent) return;

    // 킬캠 시작
    killcamRef.current = {
      active: true,
      killerId: uiState.deathInfo.killer!,
      killerX: killerAgent.x,
      killerY: killerAgent.y,
      startTime: performance.now(),
      onComplete: () => {
        setKillcamActive(false);
      },
    };
    setKillcamActive(true);
  }, [uiState.deathInfo, dataRef]);

  // v16 Phase 7: SoundEngine 기반 이벤트 연동

  // 바이옴 앰비언스 (새 SoundEngine 연동)
  useEffect(() => {
    const biomeMap: Record<string, 'forest' | 'desert' | 'mountain' | 'urban' | 'arctic' | 'island'> = {
      forest: 'forest', desert: 'desert', mountain: 'mountain',
      urban: 'urban', arctic: 'arctic', island: 'island',
    };
    const biome = biomeMap[terrainTheme];
    if (biome) {
      soundEngine.startAmbience(biome);
    }
    return () => soundEngine.stopAmbience();
  }, [terrainTheme, soundEngine]);

  // 전쟁 페이즈 텐션 BGM
  useEffect(() => {
    if (uiState.epoch?.phase === 'war' || uiState.epoch?.phase === 'shrink') {
      soundEngine.startTensionBGM();
    } else {
      soundEngine.stopTensionBGM();
    }
  }, [uiState.epoch?.phase, soundEngine]);

  // 킬 이벤트 → 카메라 셰이크 + SFX (새 엔진)
  // kill 이벤트는 플레이어의 킬을 알려주므로 모든 killFeed 추가가 내 킬임
  const prevKillCountV16Ref = useRef(0);
  useEffect(() => {
    const feed = dataRef.current.killFeed;
    if (feed.length > prevKillCountV16Ref.current) {
      soundEngine.triggerKillShake();
    }
    prevKillCountV16Ref.current = feed.length;
  });

  // 사망 이벤트 → 카메라 셰이크
  useEffect(() => {
    if (uiState.deathInfo && uiState.isSpectating) {
      soundEngine.triggerDeathShake();
    }
  }, [uiState.isSpectating, uiState.deathInfo, soundEngine]);

  // 피격 감지 (damage_dealt 이벤트) → 크로매틱 수차 + 셰이크
  const prevDamageCountRef = useRef(0);
  useEffect(() => {
    const events = uiState.damageEvents;
    if (events.length <= prevDamageCountRef.current) {
      prevDamageCountRef.current = events.length;
      return;
    }

    const pid = dataRef.current.playerId;
    if (!pid) {
      prevDamageCountRef.current = events.length;
      return;
    }

    // 새로 추가된 이벤트 중 나에게 온 대미지 감지
    const newEvents = events.slice(prevDamageCountRef.current);
    prevDamageCountRef.current = events.length;

    for (const evt of newEvents) {
      if (evt.targetId === pid) {
        // 내가 피격당함 → 카메라 셰이크 + 크로매틱 수차
        soundEngine.triggerHitShake(evt.damage);
        setChromaticIntensity(Math.min(1, evt.damage / 50));
        setTimeout(() => setChromaticIntensity(0), 300);
      }
    }
  }, [uiState.damageEvents, dataRef, soundEngine]);

  // v12 S20: 배틀 결과 10초 카운트다운
  useEffect(() => {
    if (!uiState.battleComplete) {
      setBattleCountdown(10);
      return;
    }
    setBattleCountdown(10);
    const interval = setInterval(() => {
      setBattleCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [uiState.battleComplete]);

  // v12 S20: 살아있는 에이전트 목록 (관전용)
  const aliveAgentsForSpectator: SpectatorTarget[] = (() => {
    const state = dataRef.current.latestState;
    if (!state) return [];
    const lb = dataRef.current.leaderboard;
    return state.s
      .filter(a => a.a && a.i !== dataRef.current.playerId)
      .map(a => {
        const lbEntry = lb.find(e => e.id === a.i);
        return {
          id: a.i,
          name: a.n ?? 'Agent',
          kills: lbEntry?.kills ?? (a.ks ?? 0),
          level: a.lv ?? 1,
          score: lbEntry?.score ?? 0,
          alive: true,
        };
      });
  })();

  // 경과 시간 업데이트 + 오브 데이터 동기화 + appearance 캐시 (rAF 기반)
  useEffect(() => {
    let raf = 0;
    let lastTime = performance.now();
    const tick = (now: number) => {
      elapsedRef.current += (now - lastTime) / 1000;
      lastTime = now;
      const state = dataRef.current.latestState;
      // 오브 데이터를 서버 state에서 동기화
      orbsRef.current = state?.o ?? [];
      // v14 S09: playerId ref 동기화
      playerIdRef.current = dataRef.current.playerId;
      // appearance 캐시: state의 ap 필드에서 unpack하여 캐싱
      if (state?.s) {
        populateAppearanceCache(state.s);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      clearAppearanceCache();
    };
  }, [dataRef]);

  // ─── ESC 메뉴 토글 (InputManager 외부 — 메뉴 키는 별도 관리) ───
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        setMenuOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  // v16: angleRef/boostRef를 InputManager 상태와 동기화 (GameLoop 하위 호환용)
  useEffect(() => {
    let raf = 0;
    const sync = () => {
      const inp = inputManager.inputRef.current;
      angleRef.current = inp.moveAngle ?? inp.aimAngle;
      boostRef.current = inp.boost;
      raf = requestAnimationFrame(sync);
    };
    raf = requestAnimationFrame(sync);
    return () => cancelAnimationFrame(raf);
  }, [inputManager]);

  // ─── 리스폰 핸들러 (v11: disabled in 1-life mode) ───
  const handleRespawn = useCallback(() => {
    // v11: 1-life mode — no respawn when spectating
    if (uiState.isSpectating) return;
    const rs = uiState.roomState;
    if (rs === 'ending' || rs === 'cooldown') return;
    respawn(playerName, skinId);
  }, [respawn, playerName, skinId, uiState.roomState, uiState.isSpectating]);

  const handleExitToLobby = useCallback(() => {
    onExit();
  }, [onExit]);

  // ─── 현재 플레이어 정보 (HUD용) ───
  const myAgent = (() => {
    const state = dataRef.current.latestState;
    if (!state || !dataRef.current.playerId) return null;
    return state.s.find(a => a.i === dataRef.current.playerId) ?? null;
  })();

  const playerDistance = myAgent
    ? Math.sqrt(myAgent.x * myAgent.x + myAgent.y * myAgent.y)
    : 0;
  const currentRadius = uiState.arenaShrink?.currentRadius ?? ARENA_CONFIG.radius;
  const targetRadius = uiState.arenaShrink?.minRadius;

  // ─── v19 Phase 3: AR 모바일 컨트롤 콜백 ───
  const handleARMobileMove = useCallback((dirX: number, dirZ: number) => {
    // 모바일 조이스틱 → InputManager 입력에 반영
    if (!isArenaMode) return;
    const inp = inputManager.inputRef.current;
    // 조이스틱 X,Z를 moveAngle로 변환
    const mag = Math.sqrt(dirX * dirX + dirZ * dirZ);
    if (mag > 0.1) {
      inp.moveAngle = Math.atan2(dirX, -dirZ) + arYawRef.current;
      inp.boost = mag > 0.8; // 강하게 밀면 부스트
    } else {
      inp.moveAngle = null;
    }
  }, [isArenaMode, inputManager, arYawRef]);

  const handleARMobileCameraRotate = useCallback((deltaYaw: number, deltaPitch: number) => {
    // 모바일 터치 → ARCamera yaw 직접 조정
    if (!isArenaMode) return;
    inputManager.cameraDeltaRef.current.dx += deltaYaw;
    inputManager.cameraDeltaRef.current.dy += deltaPitch;
  }, [isArenaMode, inputManager]);

  // ─── v19 Phase 3: 무기 진화 감지 (arUiState에서 무기 목록 추적) ───
  useEffect(() => {
    if (!isArenaMode || !arStateRef?.current) return;
    const pid = dataRef.current.playerId;
    if (!pid) return;
    const me = arStateRef.current.players.find(p => p.id === pid);
    if (!me) return;

    const evolvedWeapons = new Set(['storm_bow', 'dexecutioner', 'inferno', 'dragon_breath', 'pandemic']);
    for (const w of me.weapons) {
      if (evolvedWeapons.has(w) && !prevWeaponsRef.current.has(w)) {
        weaponToastIdRef.current++;
        setWeaponToasts(prev => [
          ...prev.slice(-(2)),
          { id: weaponToastIdRef.current, weaponId: w, timestamp: Date.now() },
        ]);
      }
    }
    prevWeaponsRef.current = new Set(me.weapons);
  }, [isArenaMode, arStateRef, dataRef, arUiState?.level]); // re-check on level change

  // v19 Phase 3: 무기 토스트 만료 처리
  useEffect(() => {
    if (weaponToasts.length === 0) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setWeaponToasts(prev => prev.filter(t => now - t.timestamp < 3000));
    }, 200);
    return () => clearInterval(timer);
  }, [weaponToasts.length]);

  // ─── v19 Phase 3: PvP kill feed from arEventQueue ───
  useEffect(() => {
    if (!isArenaMode || !arEventQueueRef) return;
    const interval = setInterval(() => {
      const queue = arEventQueueRef.current;
      const pvpEvents = queue.filter(e => e.type === 'pvp_kill');
      if (pvpEvents.length > 0) {
        const newEntries = pvpEvents.map(e => {
          const data = e.data as { killerId: string; victimId: string; killerFac: string; victimFac: string };
          // 이름 조회 (arState에서)
          const state = arStateRef?.current;
          const killerPlayer = state?.players.find(p => p.id === data.killerId);
          const victimPlayer = state?.players.find(p => p.id === data.victimId);
          return {
            id: `${data.killerId}-${data.victimId}-${Date.now()}`,
            killerName: killerPlayer?.name || data.killerId.slice(0, 6),
            victimName: victimPlayer?.name || data.victimId.slice(0, 6),
            killerFaction: data.killerFac || '',
            victimFaction: data.victimFac || '',
            timestamp: Date.now(),
          };
        });
        setPvpKillFeed(prev => [...prev, ...newEntries].slice(-10));
      }
    }, 200);
    return () => clearInterval(interval);
  }, [isArenaMode, arEventQueueRef, arStateRef]);

  // PvP kill feed 만료 (10초)
  useEffect(() => {
    if (pvpKillFeed.length === 0) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setPvpKillFeed(prev => prev.filter(e => now - e.timestamp < 10000));
    }, 1000);
    return () => clearInterval(timer);
  }, [pvpKillFeed.length]);

  // ─── 오버레이 표시 조건 (v12: BattleResult + Spectator 추가) ───
  const showTimer = uiState.roomState === 'playing' && uiState.timeRemaining > 0;
  const showBattleResult = uiState.battleComplete != null;
  const showRoundResult = uiState.roomState === 'ending' && uiState.roundEnd !== null && !showBattleResult;
  const showCooldown = uiState.roomState === 'cooldown' && !showBattleResult;
  const showWaiting = uiState.roomState === 'waiting';
  // v12 S20: 관전 모드 표시 (사망 + 배틀 진행 중 + 배틀 결과 미표시)
  const showSpectator = uiState.isSpectating && !showBattleResult && !showRoundResult && uiState.roomState === 'playing';
  // 기존 사망 오버레이: 관전 모드 시 비활성 (SpectatorMode가 대체)
  // v16 Phase 8: 킬캠 진행 중에는 사망 오버레이 숨김
  const showDeath = uiState.deathInfo && !showRoundResult && !showCooldown && !showSpectator && !showBattleResult && uiState.roomState !== 'ending' && !killcamActive;
  const showLevelUp = uiState.levelUp !== null && uiState.alive && !showDeath && !showRoundResult && !showBattleResult;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden',
        touchAction: 'none', // 모바일: 브라우저 스크롤/줌 방지
        WebkitUserSelect: 'none', userSelect: 'none', // 터치 시 텍스트 선택 방지
      }}
    >
      {/* ─── R3F Canvas ─── */}
      <Canvas
        flat={isArenaMode}
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        camera={{ fov: 50, near: 1, far: 5000, position: [0, 500, 400] }}
        style={{ display: 'block', width: '100%', height: '100%' }}
      >
        {/* 실행 순서: JSX 마운트 순서 = useFrame 실행 순서 (priority 0) */}

        {/* v19 Phase 2: AR Interpolation Tick — 모든 AR 컴포넌트보다 먼저 (JSX mount order) */}
        {isArenaMode && arInterpRef && (
          <ARInterpolationTick interpRef={arInterpRef} />
        )}

        {/* 1. GameLoop — 서버 상태 보간 + 클라이언트 예측 (classic only) */}
        {!isArenaMode && (
          <GameLoop
            dataRef={dataRef}
            agentsRef={agentsRef}
            angleRef={angleRef}
            boostRef={boostRef}
            inputStateRef={inputManager.inputRef}
            isArenaMode={isArenaMode}
          />
        )}

        {/* 2. Camera — 배타적 마운트 (ADR-006: TPSCamera XOR ARCamera) */}
        {isArenaMode ? (
          <ARCamera
            playerPosRef={arPlayerPosRef}
            locked={!menuOpen}
            yawRef={arYawRef}
          />
        ) : (
          <TPSCamera
            agentsRef={agentsRef}
            dataRef={dataRef}
            inputManager={inputManager}
            cameraRef={cameraRef}
            playerPosRef={playerPosRef}
            killcamRef={killcamRef}
            observerRef={observerRef}
          />
        )}

        {/* 3. Scene — 라이팅 + Fog + 분위기 변화 (테마별, v19: 아레나 모드 MC 조명) */}
        <Scene timeRemaining={uiState.timeRemaining} theme={terrainTheme} isArenaMode={isArenaMode} />

        {/* 4. SkyBox — 하늘 돔 + 구름 */}
        <SkyBox />

        {/* 5. 캐릭터/엔티티 — 배타적 마운트 (Classic vs Arena) */}
        {isArenaMode ? (
          <>
            {/* v19 Phase 2: ARPlayer — 로컬 플레이어 복셀 캐릭터 */}
            <ARPlayer
              position={(() => {
                if (!arInterpRef || !dataRef.current.playerId) return [0, 0, 0] as [number, number, number];
                const pos = getInterpolatedPos(arInterpRef.current, dataRef.current.playerId);
                return pos ? [pos.x, 0, pos.z] as [number, number, number] : [0, 0, 0] as [number, number, number];
              })()}
              rotation={(() => {
                if (!arInterpRef || !dataRef.current.playerId) return 0;
                const pos = getInterpolatedPos(arInterpRef.current, dataRef.current.playerId);
                return pos?.rot ?? 0;
              })()}
              moving={(() => {
                // 이동 여부는 보간된 position delta로 추론
                if (!arInterpRef || !dataRef.current.playerId) return false;
                const entity = arInterpRef.current.entities.get(dataRef.current.playerId);
                if (!entity) return false;
                const dx = entity.currX - entity.prevX;
                const dz = entity.currZ - entity.prevZ;
                return dx * dx + dz * dz > 0.001;
              })()}
              attackRange={3.0}
              hpRatio={arUiState ? (arUiState.maxHp > 0 ? arUiState.hp / arUiState.maxHp : 0) : 0}
              posRef={arPlayerPosRef}
            />

            {/* v19 Phase 2: AREntities — 적 + XP 크리스탈 InstancedMesh */}
            <AREntities
              enemies={arStateRef?.current?.enemies ?? []}
              xpCrystals={arStateRef?.current?.xpCrystals ?? []}
              playerPos={arPlayerPosRef.current}
            />

            {/* v19 Phase 3 Task 1: ARDamageNumbers — arEventQueue에서 ar_damage 소비 */}
            {arEventQueueRef && (
              <ARDamageNumbersBridge arEventQueueRef={arEventQueueRef} />
            )}

            {/* v19 Phase 3 Task 2: ARNameTags — 팩션 이름태그 */}
            {arStateRef?.current && arInterpRef && (
              <ARNameTags
                players={arStateRef.current.players}
                myId={dataRef.current.playerId ?? ''}
                myFactionId={arUiState?.factionId ?? ''}
                interpRef={arInterpRef}
              />
            )}

            {/* v19 Phase 3 Task 8: ARStatusEffects — 상태이상 비주얼 링 */}
            {arStateRef && arEventQueueRef && (
              <ARStatusEffects
                arStateRef={arStateRef}
                arEventQueueRef={arEventQueueRef}
              />
            )}
          </>
        ) : (
          <>
            {/* Classic: AgentInstances — MC 복셀 캐릭터 InstancedMesh 렌더링 */}
            <AgentInstances
              agentsRef={agentsRef}
              elapsedRef={elapsedRef}
              stateMachineRef={stateMachineRef}
              agentIndexMapRef={agentIndexMapRef}
              particlesRef={particlesRef}
              isArenaMode={isArenaMode}
              arenaSeed={effectiveArenaSeed}
            />

            {/* Classic: FlagSprite — 에이전트 머리 위 국기 + 이름 Billboard */}
            <FlagSprite
              agentsRef={agentsRef}
              playerIdRef={playerIdRef}
              playerNationality={uiState.nationality ?? ''}
            />

            {/* Classic: EquipmentInstances — 장비 InstancedMesh 렌더링 */}
            <EquipmentInstances
              agentsRef={agentsRef}
              elapsedRef={elapsedRef}
              stateMachineRef={stateMachineRef}
              agentIndexMapRef={agentIndexMapRef}
            />
          </>
        )}

        {/* 6. Terrain — v19: 아레나 모드이면 ARTerrain + MCTerrain, 아니면 기존 HeightmapTerrain/ZoneTerrain */}
        {isArenaMode ? (
          <>
            {/* v19 Phase 2: ARTerrain — 국가 테마별 바닥 + 장애물 (meter 단위) */}
            <ARTerrain
              theme={(arStateRef?.current?.terrain ?? 'urban') as ARTerrainTheme}
              arenaRadius={arStateRef?.current?.arenaRadius ?? 40}
            />
            {/* MCTerrain — 복셀 지형 (기존 MC 블록 스타일 바닥) */}
            <MCTerrain
              seed={effectiveArenaSeed}
              customBlocks={[]}
              arenaMode={{
                radius: arenaRadius,
                flattenVariance: 5,
                seed: effectiveArenaSeed,
              }}
              onTerrainReady={handleTerrainReady}
            />
          </>
        ) : (
          <>
            {uiState.heightmapData ? (
              <HeightmapTerrain data={uiState.heightmapData} biomeData={uiState.biomeData} />
            ) : (
              <ZoneTerrain arenaRadius={ARENA_CONFIG.radius} theme={terrainTheme} />
            )}
          </>
        )}

        {/* 6b. ObstacleInstances — 바위/나무/벽/물 InstancedMesh (아레나 모드에서는 MCTerrain이 장애물 포함) */}
        {!isArenaMode && (
          <ObstacleInstances
            obstacleData={uiState.obstacleData}
            heightmapData={uiState.heightmapData}
            cellSize={uiState.heightmapData?.cellSize ?? 50}
            arenaRadius={ARENA_CONFIG.radius}
          />
        )}

        {/* 7. TerrainDeco — 환경 데코레이션 (아레나 모드에서는 MCTerrain 나무/잎이 대체) */}
        {!isArenaMode && (
          <TerrainDeco arenaRadius={ARENA_CONFIG.radius} theme={terrainTheme} />
        )}

        {/* 8. ArenaBoundary — 수축 경계벽 (아레나 모드: MC 블록 단위 반경) */}
        <ArenaBoundary
          currentRadius={isArenaMode ? arenaRadius : currentRadius}
          targetRadius={isArenaMode ? undefined : targetRadius}
          isArenaMode={isArenaMode}
        />

        {/* 9. MapStructures — 맵 구조물 (아레나 모드에서는 비활성 — MCTerrain이 대체) */}
        {!isArenaMode && <MapStructures arenaRadius={ARENA_CONFIG.radius} />}

        {/* 10-17: Classic-only 3D 컴포넌트 (v19 Phase 2: isArenaMode 시 비활성) */}
        {!isArenaMode && (
          <>
            {/* 10. OrbInstances — 오브 복셀 큐브 InstancedMesh */}
            <OrbInstances orbsRef={orbsRef} />

            {/* 12. AuraRings — Agent 전투 오라 시각화 */}
            <AuraRings agentsRef={agentsRef} />

            {/* 13. BuildEffects — 빌드별 시각 이펙트 (글로우/잔상/보호막) */}
            <BuildEffects agentsRef={agentsRef} elapsedRef={elapsedRef} />

            {/* 14. AbilityEffects — 어빌리티 발동 이펙트 (6종) */}
            <AbilityEffects agentsRef={agentsRef} elapsedRef={elapsedRef} />

            {/* 15. WeaponRenderer — v14 무기 파티클 VFX */}
            <WeaponRenderer damageEvents={uiState.damageEvents} />

            {/* 16. DamageNumbers — v14 플로팅 대미지 숫자 */}
            <DamageNumbers damageEvents={uiState.damageEvents} />

            {/* 17. CapturePointRenderer — v14 거점 빔/영역/점령 */}
            <CapturePointRenderer capturePoints={uiState.capturePoints} />
          </>
        )}

        {/* 11. MCParticles — MC 스타일 파티클 엔진 (공유) */}
        <MCParticles ref={particlesRef} />

        {/* 18. PostProcessingEffects — v16 Phase 7 (크로매틱 수차 + 비네팅) */}
        {/* v19: 아레나 모드에서는 PostProcessing 비활성 (MC reference 스타일 — 순수 렌더링) */}
        {!isArenaMode && (
          <PostProcessingEffects
            quality={soundEngine.fxQuality as FXQualityLevel}
            chromaticIntensity={chromaticIntensity}
            vignetteIntensity={vignetteIntensity}
          />
        )}

        {/* 19. WeatherEffects — v16 Phase 8 (비/눈/모래 파티클 + fog) */}
        {!isArenaMode && <WeatherEffects weather={uiState.weather} />}
      </Canvas>

      {/* ─── v19: 아레나 로딩 오버레이 (실제 진행률 추적) ─── */}
      {arenaLoading && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          zIndex: 50, fontFamily: '"Rajdhani", sans-serif',
          color: '#E8E0D4', gap: 16,
        }}>
          <div style={{
            fontSize: 28, fontWeight: 700, letterSpacing: 3,
            textTransform: 'uppercase', color: '#CC9933',
          }}>
            ARENA
          </div>
          {/* 실제 진행률 바 */}
          <div style={{
            width: 240, height: 6, backgroundColor: '#222',
            borderRadius: 3, overflow: 'hidden', border: '1px solid #333',
          }}>
            <div style={{
              width: `${loadProgress}%`, height: '100%',
              backgroundColor: loadProgress >= 100 ? '#4A9E4A' : '#CC9933',
              borderRadius: 3,
              transition: 'width 0.3s ease, background-color 0.3s ease',
            }} />
          </div>
          {/* 진행률 퍼센트 */}
          <div style={{ fontSize: 14, color: '#CC9933', fontWeight: 600 }}>
            {loadProgress}%
          </div>
          {/* 현재 상태 */}
          <div style={{ fontSize: 13, color: '#888' }}>
            {loadStatus}
          </div>
        </div>
      )}

      {/* ─── v16 Phase 7: CSS Fallback Overlays (모바일/low 설정, 아레나 모드 비활성) ─── */}
      {!isArenaMode && soundEngine.fxQuality === 'low' && (
        <>
          <CSSVignetteOverlay intensity={vignetteIntensity} />
          <CSSChromaticOverlay intensity={chromaticIntensity} />
        </>
      )}

      {/* v16 Phase 8: 모바일 듀얼 조이스틱 (classic only) */}
      {!isArenaMode && <MobileControls inputManager={inputManager} enabled={!menuOpen && uiState.alive} />}

      {/* v16 Phase 8: Lightning flash overlay (classic only) */}
      {!isArenaMode && <LightningFlashOverlay weather={uiState.weather} />}

      {/* v16 Phase 8: Weather HUD (classic only) */}
      {!isArenaMode && <WeatherHUD weather={uiState.weather} />}

      {/* ─── v19 Phase 2+3: AR HTML HUD (isArenaMode only) ─── */}
      {isArenaMode && arUiState && (
        <>
          {/* Phase 2: ARHUD — HP/XP/타이머/페이즈/웨이브/킬 */}
          <ARHUD
            hp={arUiState.hp}
            maxHp={arUiState.maxHp}
            xp={arUiState.xp}
            xpToNext={arUiState.xpToNext}
            level={arUiState.level}
            phase={arUiState.phase}
            timer={arUiState.timer}
            wave={arUiState.wave}
            kills={arUiState.kills}
            alive={arUiState.alive}
          />

          {/* Phase 2: ARMinimap — 아레나 미니맵 */}
          <ARMinimap
            entities={buildMinimapEntities(arStateRef?.current, dataRef.current.playerId)}
            playerX={arPlayerPosRef.current.x}
            playerZ={arPlayerPosRef.current.z}
            arenaRadius={arStateRef?.current?.arenaRadius ?? 40}
            pvpRadius={arUiState.pvpRadius || undefined}
            phase={arUiState.phase}
          />

          {/* Phase 3 Task 3: ARLevelUp — 레벨업 토메 선택 팝업 */}
          {arUiState.levelUpChoices && arUiState.levelUpChoices.length > 0 && sendARChoice && (
            <ARLevelUp
              level={arUiState.level}
              choices={arUiState.levelUpChoices}
              onChoose={(tomeId) => sendARChoice({ tomeId })}
            />
          )}

          {/* Phase 3 Task 4: ARPvPOverlay — PvP 페이즈 UI */}
          <ARPvPOverlay
            phase={arUiState.phase}
            timer={arUiState.timer}
            pvpRadius={arUiState.pvpRadius || undefined}
            baseRadius={arStateRef?.current?.arenaRadius ?? 40}
            factionScores={arUiState.factionScores}
            playerFaction={arUiState.factionId}
            enemies={arStateRef?.current?.enemies}
            killFeed={pvpKillFeed}
          />

          {/* Phase 3 Task 5: ARMobileControls — 모바일 조이스틱 */}
          <ARMobileControls
            onMove={handleARMobileMove}
            onCameraRotate={handleARMobileCameraRotate}
            active={arUiState.alive && !menuOpen}
          />

          {/* Phase 3 Task 6: 무기 진화 토스트 */}
          {weaponToasts.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: 100,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 65,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                pointerEvents: 'none',
              }}
            >
              {weaponToasts.map((toast) => {
                const WEAPON_INFO_MAP: Record<string, { icon: string; name: string; desc: string }> = {
                  storm_bow: { icon: '\u26A1', name: 'Storm Bow', desc: 'Arrows with chain lightning' },
                  dexecutioner: { icon: '\u2694\uFE0F', name: 'Dexecutioner', desc: 'Executes below 30% HP' },
                  inferno: { icon: '\uD83D\uDD25', name: 'Inferno', desc: 'Screen-wide fire storm' },
                  dragon_breath: { icon: '\uD83D\uDC09', name: 'Dragon Breath', desc: 'Continuous flame spray' },
                  pandemic: { icon: '\u2620\uFE0F', name: 'Pandemic', desc: 'Spreading poison cloud' },
                };
                const info = WEAPON_INFO_MAP[toast.weaponId];
                const age = Date.now() - toast.timestamp;
                const fadeOut = age > 2500;
                return (
                  <div
                    key={toast.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 20px',
                      backgroundColor: 'rgba(255, 152, 0, 0.2)',
                      border: '1px solid rgba(255, 152, 0, 0.6)',
                      borderRadius: 6,
                      backdropFilter: 'blur(4px)',
                      fontFamily: '"Rajdhani", sans-serif',
                      color: '#FFD700',
                      opacity: fadeOut ? 0 : 1,
                      transition: 'opacity 0.5s ease',
                    }}
                  >
                    <span style={{ fontSize: 24 }}>{info?.icon || '?'}</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#FF9800', letterSpacing: 1, textTransform: 'uppercase' as const }}>
                        WEAPON EVOLVED!
                      </div>
                      <div style={{ fontSize: 13, color: '#E8E0D4' }}>
                        {info?.name || toast.weaponId} — {info?.desc || ''}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Phase 3 Task 7: ARSynergyBar — 활성 시너지 아이콘 바 */}
          <ARSynergyBar synergies={arUiState.synergies} />
        </>
      )}

      {/* ─── HTML HUD 오버레이 (Canvas 밖) — Classic only ─── */}

      {/* v14: EpochHUD — 에포크 타이머 + 페이즈 뱃지 + KDA (상단 중앙) */}
      {!isArenaMode && uiState.epoch && (
        <EpochHUD
          epochNumber={uiState.epoch.epochNumber}
          phase={uiState.epoch.phase}
          timeRemaining={uiState.epoch.timeRemaining}
          phaseTimeRemaining={uiState.epoch.phaseTimeRemaining}
          pvpEnabled={uiState.epoch.pvpEnabled}
          nationScores={uiState.epoch.nationScores}
          kills={myAgent?.ks ?? 0}
          deaths={
            uiState.epochScoreboard.find(e => e.id === dataRef.current.playerId)?.deaths ?? 0
          }
          assists={
            uiState.epochScoreboard.find(e => e.id === dataRef.current.playerId)?.assists ?? 0
          }
          playerNationality={uiState.nationality ?? undefined}
          playerNationScore={
            uiState.nationality
              ? uiState.epoch.nationScores[uiState.nationality] ?? 0
              : undefined
          }
          arenaRadius={currentRadius}
          maxArenaRadius={ARENA_CONFIG.radius}
        />
      )}

      {/* v14: War Countdown Overlay (classic only) */}
      {!isArenaMode && uiState.warCountdown != null && uiState.warCountdown > 0 && (
        <WarCountdownOverlay countdown={uiState.warCountdown} />
      )}

      {/* v14: War Vignette (classic only) */}
      {!isArenaMode && (
        <WarVignetteOverlay
          active={uiState.epoch?.phase === 'war' || uiState.epoch?.phase === 'shrink'}
          intensity={uiState.epoch?.phase === 'shrink' ? 0.7 : 0.5}
        />
      )}

      {/* v14: Respawn Overlay (classic only) */}
      {!isArenaMode && uiState.respawnState && (
        <RespawnOverlay
          countdown={uiState.respawnState.countdown}
          isRespawning={uiState.respawnState.isRespawning}
        />
      )}

      {/* v12 S24: 킬피드 (classic only) */}
      {!isArenaMode && <KillFeedHUD dataRef={dataRef} />}

      {/* v16: 음소거 토글 버튼 (공유) */}
      <MuteButton isMuted={soundEngine.isMuted} onToggle={() => soundEngine.toggleMute()} />

      {/* 전투 보너스 토스트 (공유) */}
      {terrainToast && <TerrainBonusToast text={terrainToast} />}

      {/* Classic-only HUD 컴포넌트 (v19 Phase 2: isArenaMode 시 비활성) */}
      {!isArenaMode && (
        <>
          <ShrinkWarning
            shrinkData={uiState.arenaShrink}
            playerDistance={playerDistance}
            currentRadius={currentRadius}
          />

          {dismissSynergyPopup && (
            <SynergyPopup
              synergies={uiState.synergyPopups}
              onDismiss={dismissSynergyPopup}
            />
          )}

          <BuildHUD build={null} />

          {myAgent?.bt && myAgent.bt !== 'balanced' && (
            <BuildTypeIndicator buildType={myAgent.bt} />
          )}

          {myAgent && (
            <XPBar
              level={myAgent.lv ?? 1}
              xp={0}
              xpToNext={100}
            />
          )}
        </>
      )}

      {showTimer && <RoundTimerHUD timeRemaining={uiState.timeRemaining} />}

      {/* v12 S20: Battle Result Overlay (배틀 완료 시 전체화면) */}
      {showBattleResult && uiState.roundEnd && (
        <BattleResultOverlay
          roundEnd={uiState.roundEnd}
          deathInfo={uiState.deathInfo}
          countdownSec={battleCountdown}
          onReenter={() => {
            // 같은 국가 재진입: 현재 roomId로 다시 joinRoom
            // page.tsx의 handleEnterArena에서 처리
          }}
          onRedeploy={handleExitToLobby}
        />
      )}

      {/* v12 S20: Spectator Mode (사망 후 관전) */}
      {showSpectator && uiState.deathInfo && (
        <SpectatorMode
          deathInfo={uiState.deathInfo}
          aliveAgents={aliveAgentsForSpectator}
          followTarget={spectatorTarget}
          onFollowAgent={handleFollowAgent}
          onDragCamera={handleObserverDrag}
          onZoomCamera={handleObserverZoom}
          onExitToLobby={handleExitToLobby}
          timeRemaining={uiState.timeRemaining}
        />
      )}

      {showRoundResult && (
        <RoundResultOverlay
          roundEnd={uiState.roundEnd!}
          deathInfo={uiState.deathInfo}
          analysisPanel={<AnalystPanel analysis={uiState.roundAnalysis ?? null} />}
        />
      )}
      {showCooldown && <WaitingBanner text="Next round starting soon..." />}
      {showWaiting && <WaitingBanner text="Waiting for players..." />}
      {showDeath && !showLevelUp && (
        <DeathOverlay deathInfo={uiState.deathInfo!} onRespawn={handleRespawn} />
      )}

      <CoachBubble
        messages={uiState.coachMessage ? [{ ...uiState.coachMessage, icon: uiState.coachMessage.type }] : []}
      />

      {showLevelUp && chooseUpgrade && (
        <LevelUpOverlay
          levelUp={uiState.levelUp!}
          onChoose={chooseUpgrade}
        />
      )}

      {/* ─── 팩션 스코어보드 (우측 상단, classic only) ─── */}
      {!isArenaMode && <FactionScoreboard dataRef={dataRef} />}

      {/* ─── 국가 이름 (미니맵 상단, classic only) ─── */}
      {!isArenaMode && (
        <MinimapHUD
          dataRef={dataRef}
          arenaRadius={ARENA_CONFIG.radius}
          shrinkData={uiState.arenaShrink}
          countryName={(() => {
            const iso = uiState.currentRoomId;
            if (!iso) return undefined;
            const cs = uiState.countryStates.get(iso);
            return cs?.name ?? iso;
          })()}
          countryTier={(() => {
            const iso = uiState.currentRoomId;
            if (!iso) return undefined;
            const cs = uiState.countryStates.get(iso);
            return cs?.tier;
          })()}
        />
      )}

      {/* ─── 미니맵 (우하단, classic only — AR uses ARMinimap above) ─── */}
      {!isArenaMode && (
        uiState.heightmapData ? (
          <Minimap
            dataRef={dataRef}
            arenaRadius={ARENA_CONFIG.radius}
            shrinkData={uiState.arenaShrink}
            heightmapData={uiState.heightmapData}
            biomeData={uiState.biomeData}
            obstacleData={uiState.obstacleData}
          />
        ) : (
          <GameMinimap
            dataRef={dataRef}
            arenaRadius={ARENA_CONFIG.radius}
            shrinkData={uiState.arenaShrink}
          />
        )
      )}

      {/* v14: ScoreboardOverlay — Tab키 스코어보드 (classic only) */}
      {!isArenaMode && <ScoreboardOverlay
        visible={scoreboardVisible}
        players={
          // v14: epoch_scoreboard 이벤트에서 전체 데이터 사용, 없으면 leaderboard + agent 상태에서 구성
          uiState.epochScoreboard.length > 0
            ? uiState.epochScoreboard
            : (dataRef.current.leaderboard ?? []).map((e, idx) => {
                // agent network data에서 추가 정보 추출
                const agent = dataRef.current.latestState?.s?.find(a => a.i === e.id);
                return {
                  id: e.id,
                  name: e.name,
                  rank: idx + 1,
                  kills: e.kills ?? 0,
                  deaths: 0,
                  assists: 0,
                  level: agent?.lv ?? 1,
                  score: e.score ?? 0,
                  nationality: agent?.nat ?? '',
                  isBot: agent?.bot ?? false,
                };
              })
        }
        nationScores={
          uiState.epoch
            ? Object.entries(uiState.epoch.nationScores)
                .sort(([, a], [, b]) => b - a)
                .map(([nationality, totalScore]) => ({
                  nationality,
                  totalScore,
                  playerCount: 0,
                  totalKills: 0,
                }))
            : []
        }
        currentPlayerId={dataRef.current.playerId ?? undefined}
        epochNumber={uiState.epoch?.epochNumber ?? 1}
        phase={uiState.epoch?.phase ?? 'peace'}
      />}

      {menuOpen && (
        <PauseMenu onResume={() => setMenuOpen(false)} onExit={handleExitToLobby} />
      )}
    </div>
  );
}

// ─── v19 Phase 2: AR Minimap entity builder ───

/** AR state에서 미니맵 엔티티 목록을 구축한다 */
function buildMinimapEntities(arState: ARState | null | undefined, playerId: string | null): ARMinimapEntity[] {
  if (!arState) return [];
  const entities: ARMinimapEntity[] = [];

  // 플레이어 (자신 제외 — 미니맵 중앙에 별도 표시)
  for (const p of arState.players) {
    if (p.id === playerId) continue;
    entities.push({
      id: p.id,
      x: p.pos.x,
      z: p.pos.z,
      type: 'ally',
      alive: p.alive,
    });
  }

  // 적 엔티티
  for (const e of arState.enemies) {
    let type: ARMinimapEntity['type'] = 'enemy';
    if (e.isMiniboss) type = 'miniboss';
    else if (e.isElite) type = 'elite';
    entities.push({
      id: e.id,
      x: e.x,
      z: e.z,
      type,
      alive: true,
    });
  }

  // XP 크리스탈
  for (const c of arState.xpCrystals) {
    entities.push({
      id: c.id,
      x: c.x,
      z: c.z,
      type: 'crystal',
      alive: true,
    });
  }

  // 필드 아이템
  for (const item of arState.items) {
    entities.push({
      id: item.id,
      x: item.x,
      z: item.z,
      type: 'item',
      alive: true,
    });
  }

  return entities;
}

// ─── 내부 컴포넌트 (기존 GameCanvas.tsx에서 복사) ───

function WaitingBanner({ text }: { text: string }) {
  return (
    <div style={{
      position: 'absolute', top: '12px', left: '50%', transform: 'translateX(-50%)',
      zIndex: 20, fontFamily: '"Patrick Hand", "Inter", sans-serif',
      fontSize: '1.1rem', fontWeight: 700, color: '#6B5E52',
      backgroundColor: 'rgba(245, 240, 232, 0.85)',
      padding: '6px 20px', borderRadius: 0,
      border: '1.5px solid #A89888', letterSpacing: '0.03em',
    }}>
      {text}
    </div>
  );
}

const BUILD_TYPE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  berserker: { bg: 'rgba(255,60,60,0.2)', text: '#FF5555', label: 'BERSERKER' },
  tank:      { bg: 'rgba(80,80,255,0.2)', text: '#5588FF', label: 'TANK' },
  speedster: { bg: 'rgba(80,255,255,0.2)', text: '#55FFFF', label: 'SPEEDSTER' },
  farmer:    { bg: 'rgba(80,255,80,0.2)', text: '#55FF55', label: 'FARMER' },
};

function BuildTypeIndicator({ buildType }: { buildType: string }) {
  const info = BUILD_TYPE_COLORS[buildType];
  if (!info) return null;
  return (
    <div style={{
      position: 'absolute', bottom: '40px', left: '12px', zIndex: 15, pointerEvents: 'none',
      fontFamily: '"Press Start 2P", monospace', fontSize: '0.3rem',
      color: info.text, backgroundColor: info.bg,
      border: `1px solid ${info.text}40`, padding: '3px 8px',
      letterSpacing: '0.06em',
    }}>
      {info.label}
    </div>
  );
}

function TerrainBonusToast({ text }: { text: string }) {
  return (
    <div style={{
      position: 'absolute',
      top: '60px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 25,
      fontFamily: '"Black Ops One", "Patrick Hand", "Inter", sans-serif',
      fontSize: '0.85rem',
      fontWeight: 700,
      color: '#E8E0D4',
      backgroundColor: 'rgba(17, 17, 17, 0.85)',
      padding: '8px 20px',
      borderRadius: 0,
      border: '1.5px solid #CC9933',
      letterSpacing: '0.04em',
      textShadow: '0 1px 2px rgba(0,0,0,0.5)',
      animation: 'terrainToastFade 4s ease-out forwards',
      pointerEvents: 'none',
    }}>
      <span style={{ color: '#CC9933', marginRight: 8 }}>TERRAIN</span>
      {text}
      <style>{`
        @keyframes terrainToastFade {
          0% { opacity: 0; transform: translateX(-50%) translateY(-8px); }
          10% { opacity: 1; transform: translateX(-50%) translateY(0); }
          75% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

/** v12 S24: 음소거 토글 버튼 */
function MuteButton({ isMuted, onToggle }: { isMuted: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      style={{
        position: 'absolute',
        top: '12px',
        right: '12px',
        zIndex: 20,
        width: '32px',
        height: '32px',
        backgroundColor: 'rgba(17, 17, 17, 0.7)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: 0,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        transition: 'background-color 200ms',
      }}
      title={isMuted ? 'Unmute' : 'Mute'}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E8E0D4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {isMuted ? (
          <>
            {/* 음소거 아이콘 */}
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="#E8E0D4" />
            <line x1="23" y1="9" x2="17" y2="15" stroke="#FF5555" />
            <line x1="17" y1="9" x2="23" y2="15" stroke="#FF5555" />
          </>
        ) : (
          <>
            {/* 스피커 아이콘 */}
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="#E8E0D4" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" stroke="#55FF55" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" stroke="#55FF55" />
          </>
        )}
      </svg>
    </button>
  );
}

function PauseMenu({ onResume, onExit }: { onResume: () => void; onExit: () => void }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(245, 240, 232, 0.92)', zIndex: 50,
    }}>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
        padding: '40px 48px', borderRadius: 0,
        backgroundColor: 'rgba(245, 240, 232, 0.97)', border: '1.5px solid #6B5E52',
      }}>
        <h2 style={{
          fontSize: 28, fontWeight: 700, color: '#3A3028', margin: 0,
          fontFamily: '"Patrick Hand", "Inter", sans-serif',
          position: 'relative',
        }}>
          PAUSED
          <span style={{
            position: 'absolute', bottom: -2, left: '15%', width: '70%', height: 2,
            backgroundColor: '#3A3028', opacity: 0.2,
          }} />
        </h2>
        <p style={{
          color: '#6B5E52', fontSize: 13, margin: 0,
          fontFamily: '"Patrick Hand", "Inter", sans-serif',
        }}>
          ESC to resume
        </p>
        <button onClick={onResume} style={{
          width: 200, padding: '12px 0', minHeight: 48, fontSize: 17, fontWeight: 700,
          backgroundColor: '#D4914A', color: '#F5F0E8', border: '2px solid #3A3028',
          borderRadius: 0, cursor: 'pointer', fontFamily: '"Patrick Hand", "Inter", sans-serif',
        }}>
          RESUME
        </button>
        <button onClick={onExit} style={{
          width: 200, padding: '12px 0', minHeight: 48, fontSize: 17, fontWeight: 700,
          backgroundColor: 'transparent', color: '#C75B5B', border: '1.5px solid #C75B5B',
          borderRadius: 0, cursor: 'pointer', fontFamily: '"Patrick Hand", "Inter", sans-serif',
        }}>
          EXIT TO LOBBY
        </button>
      </div>
    </div>
  );
}
