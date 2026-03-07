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
import { GameLoop } from '@/components/3d/GameLoop';
import { AgentInstances } from '@/components/3d/AgentInstances';
import { EquipmentInstances } from '@/components/3d/EquipmentInstances';
import type { AnimationStateMachine } from '@/lib/3d/animation-state-machine';
import { ZoneTerrain } from '@/components/3d/ZoneTerrain';
import { TerrainDeco } from '@/components/3d/TerrainDeco';
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
import { MinimapHUD } from './MinimapHUD';
import { FactionScoreboard } from './FactionScoreboard';
import { KillFeedHUD } from './KillFeedHUD';
import { BattleResultOverlay } from './BattleResultOverlay';
import { SpectatorMode } from './SpectatorMode';
import type { SpectatorTarget } from './SpectatorMode';
import { useAudio } from '@/hooks/useAudio';
import type { AmbienceTheme } from '@/hooks/useAudio';

// v14: Epoch HUD + overlays (HTML 오버레이)
import { EpochHUD, WarCountdownOverlay, WarVignetteOverlay, RespawnOverlay } from './EpochHUD';
import { ScoreboardOverlay, useScoreboardToggle } from './ScoreboardOverlay';

// v14: 3D Weapon VFX + Damage Numbers + Capture Points (R3F Canvas 내부)
import { WeaponRenderer } from '@/components/3d/WeaponRenderer';
import { DamageNumbers } from '@/components/3d/DamageNumbers';
import { CapturePointRenderer } from '@/components/3d/CapturePointRenderer';

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

  // v16: InputManager + TPSCamera refs
  const cameraRef = useRef<Camera | null>(null);
  const playerPosRef = useRef({ x: 0, z: 0 });
  const inputManager = useInputManager(containerRef, cameraRef, playerPosRef, !menuOpen);

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
  const [battleCountdown, setBattleCountdown] = useState(10);

  // v14: Tab scoreboard toggle
  const scoreboardVisible = useScoreboardToggle();

  // v12 S24: Audio system
  const { playSFX, startAmbience, stopAmbience, toggleMute, isMuted } = useAudio();
  const prevKillCountRef = useRef(0);
  const prevLevelRef = useRef(0);

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

  // v12 S24: 테마별 앰비언스 시작/정지
  useEffect(() => {
    const validThemes: AmbienceTheme[] = ['forest', 'desert', 'mountain', 'urban', 'arctic', 'island'];
    if (validThemes.includes(terrainTheme as AmbienceTheme)) {
      startAmbience(terrainTheme as AmbienceTheme);
    }
    return () => stopAmbience();
  }, [terrainTheme, startAmbience, stopAmbience]);

  // v12 S24: 킬 SFX (killFeed 변화 감지)
  useEffect(() => {
    const feed = dataRef.current.killFeed;
    if (feed.length > prevKillCountRef.current) {
      playSFX('kill');
    }
    prevKillCountRef.current = feed.length;
  });

  // v12 S24: 레벨업 SFX
  useEffect(() => {
    if (uiState.levelUp && uiState.levelUp.level > prevLevelRef.current) {
      playSFX('level_up');
    }
    if (uiState.levelUp) {
      prevLevelRef.current = uiState.levelUp.level;
    }
  }, [uiState.levelUp, playSFX]);

  // v12 S24: 사망 SFX
  useEffect(() => {
    if (uiState.deathInfo && uiState.isSpectating) {
      playSFX('death');
    }
  }, [uiState.isSpectating, uiState.deathInfo, playSFX]);

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

  // ─── 오버레이 표시 조건 (v12: BattleResult + Spectator 추가) ───
  const showTimer = uiState.roomState === 'playing' && uiState.timeRemaining > 0;
  const showBattleResult = uiState.battleComplete != null;
  const showRoundResult = uiState.roomState === 'ending' && uiState.roundEnd !== null && !showBattleResult;
  const showCooldown = uiState.roomState === 'cooldown' && !showBattleResult;
  const showWaiting = uiState.roomState === 'waiting';
  // v12 S20: 관전 모드 표시 (사망 + 배틀 진행 중 + 배틀 결과 미표시)
  const showSpectator = uiState.isSpectating && !showBattleResult && !showRoundResult && uiState.roomState === 'playing';
  // 기존 사망 오버레이: 관전 모드 시 비활성 (SpectatorMode가 대체)
  const showDeath = uiState.deathInfo && !showRoundResult && !showCooldown && !showSpectator && !showBattleResult && uiState.roomState !== 'ending';
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
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        camera={{ fov: 50, near: 1, far: 5000, position: [0, 500, 400] }}
        style={{ display: 'block', width: '100%', height: '100%' }}
      >
        {/* 실행 순서: JSX 마운트 순서 = useFrame 실행 순서 (priority 0) */}

        {/* 1. GameLoop — 서버 상태 보간 + 클라이언트 예측 */}
        <GameLoop
          dataRef={dataRef}
          agentsRef={agentsRef}
          angleRef={angleRef}
          boostRef={boostRef}
          inputStateRef={inputManager.inputRef}
        />

        {/* 2. TPSCamera — v16 TPS 오비탈 카메라 (보간된 Agent 위치 추적) */}
        <TPSCamera
          agentsRef={agentsRef}
          dataRef={dataRef}
          inputManager={inputManager}
          cameraRef={cameraRef}
          playerPosRef={playerPosRef}
        />

        {/* 3. Scene — 라이팅 + Fog + 분위기 변화 (테마별) */}
        <Scene timeRemaining={uiState.timeRemaining} theme={terrainTheme} />

        {/* 4. SkyBox — 하늘 돔 + 구름 */}
        <SkyBox />

        {/* 5. AgentInstances — MC 복셀 캐릭터 InstancedMesh 렌더링 */}
        <AgentInstances
          agentsRef={agentsRef}
          elapsedRef={elapsedRef}
          stateMachineRef={stateMachineRef}
          agentIndexMapRef={agentIndexMapRef}
        />

        {/* 5.1. FlagSprite — 에이전트 머리 위 국기 + 이름 Billboard (v14 S09) */}
        <FlagSprite
          agentsRef={agentsRef}
          playerIdRef={playerIdRef}
          playerNationality={uiState.nationality ?? ''}
        />

        {/* 5.5. EquipmentInstances — 장비(모자/무기/등) InstancedMesh 렌더링 (Phase 5) */}
        <EquipmentInstances
          agentsRef={agentsRef}
          elapsedRef={elapsedRef}
          stateMachineRef={stateMachineRef}
          agentIndexMapRef={agentIndexMapRef}
        />

        {/* 6. ZoneTerrain — 3개 동심원 존 바닥 (테마별) */}
        <ZoneTerrain arenaRadius={ARENA_CONFIG.radius} theme={terrainTheme} />

        {/* 7. TerrainDeco — 환경 데코레이션 (테마별) */}
        <TerrainDeco arenaRadius={ARENA_CONFIG.radius} theme={terrainTheme} />

        {/* 8. ArenaBoundary — 수축 경계벽 */}
        <ArenaBoundary currentRadius={currentRadius} targetRadius={targetRadius} />

        {/* 9. MapStructures — 맵 구조물 (Shrine/Spring/Altar) */}
        <MapStructures arenaRadius={ARENA_CONFIG.radius} />

        {/* 10. OrbInstances — 오브 복셀 큐브 InstancedMesh */}
        <OrbInstances orbsRef={orbsRef} />

        {/* 11. MCParticles — MC 스타일 파티클 엔진 */}
        <MCParticles ref={particlesRef} />

        {/* 12. AuraRings — Agent 전투 오라 시각화 */}
        <AuraRings agentsRef={agentsRef} />

        {/* 13. BuildEffects — 빌드별 시각 이펙트 (글로우/잔상/보호막) */}
        <BuildEffects agentsRef={agentsRef} elapsedRef={elapsedRef} />

        {/* 14. AbilityEffects — 어빌리티 발동 이펙트 (6종) */}
        <AbilityEffects agentsRef={agentsRef} elapsedRef={elapsedRef} />

        {/* 15. WeaponRenderer — v14 무기 파티클 VFX (10종 무기, LOD)
            damageEvents delivered via damage_dealt WS event → uiState.damageEvents */}
        <WeaponRenderer
          damageEvents={uiState.damageEvents}
        />

        {/* 16. DamageNumbers — v14 플로팅 대미지 숫자 (128 풀) */}
        <DamageNumbers
          damageEvents={uiState.damageEvents}
        />

        {/* 17. CapturePointRenderer — v14 거점 빔/영역/점령 프로그레스
            capturePoints delivered via capture_point_update WS event → uiState.capturePoints */}
        <CapturePointRenderer
          capturePoints={uiState.capturePoints}
        />
      </Canvas>

      {/* ─── HTML HUD 오버레이 (Canvas 밖) ─── */}

      {/* v14: EpochHUD — 에포크 타이머 + 페이즈 뱃지 + KDA (상단 중앙) */}
      {uiState.epoch && (
        <EpochHUD
          epochNumber={uiState.epoch.epochNumber}
          phase={uiState.epoch.phase}
          timeRemaining={uiState.epoch.timeRemaining}
          phaseTimeRemaining={uiState.epoch.phaseTimeRemaining}
          pvpEnabled={uiState.epoch.pvpEnabled}
          nationScores={uiState.epoch.nationScores}
          kills={myAgent?.ks ?? 0}
          deaths={
            // v14: epoch_scoreboard에서 사망 수 추출 (없으면 0)
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

      {/* v14: War Countdown Overlay (전쟁 카운트다운 3-2-1) */}
      {uiState.warCountdown != null && uiState.warCountdown > 0 && (
        <WarCountdownOverlay countdown={uiState.warCountdown} />
      )}

      {/* v14: War Vignette (전쟁/수축 페이즈 적색 비네트) */}
      <WarVignetteOverlay
        active={uiState.epoch?.phase === 'war' || uiState.epoch?.phase === 'shrink'}
        intensity={uiState.epoch?.phase === 'shrink' ? 0.7 : 0.5}
      />

      {/* v14: Respawn Overlay (리스폰 카운트다운 + 부활 이펙트) */}
      {uiState.respawnState && (
        <RespawnOverlay
          countdown={uiState.respawnState.countdown}
          isRespawning={uiState.respawnState.isRespawning}
        />
      )}

      {/* v12 S24: 킬피드 (좌측 상단) */}
      <KillFeedHUD dataRef={dataRef} />

      {/* v12 S24: 음소거 토글 버튼 (우상단) */}
      <MuteButton isMuted={isMuted} onToggle={toggleMute} />

      {/* 전투 보너스 토스트 (입장 시 4초) */}
      {terrainToast && <TerrainBonusToast text={terrainToast} />}

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

      {/* 빌드 타입 인디케이터 */}
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
          onFollowAgent={setSpectatorTarget}
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

      {/* ─── 팩션 스코어보드 (우측 상단) ─── */}
      <FactionScoreboard dataRef={dataRef} />

      {/* ─── 국가 이름 (미니맵 상단) ─── */}
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

      {/* ─── 미니맵 (우하단) ─── */}
      <GameMinimap
        dataRef={dataRef}
        arenaRadius={ARENA_CONFIG.radius}
        shrinkData={uiState.arenaShrink}
      />

      {/* v14: ScoreboardOverlay — Tab키 스코어보드 + 에포크/국가 순위 */}
      <ScoreboardOverlay
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
      />

      {menuOpen && (
        <PauseMenu onResume={() => setMenuOpen(false)} onExit={handleExitToLobby} />
      )}
    </div>
  );
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
