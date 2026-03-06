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
import type { GameData, UiState } from '@/hooks/useSocket';
import type { AgentNetworkData, OrbNetworkData } from '@snake-arena/shared';
import { ARENA_CONFIG } from '@snake-arena/shared';

// 3D 컴포넌트
import { Scene } from '@/components/3d/Scene';
import { SkyBox } from '@/components/3d/SkyBox';
import { PlayCamera } from '@/components/3d/PlayCamera';
import { GameLoop } from '@/components/3d/GameLoop';
import { AgentInstances } from '@/components/3d/AgentInstances';
import { ZoneTerrain } from '@/components/3d/ZoneTerrain';
import { TerrainDeco } from '@/components/3d/TerrainDeco';
import { ArenaBoundary } from '@/components/3d/ArenaBoundary';
import { MapStructures } from '@/components/3d/MapStructures';
import { OrbInstances } from '@/components/3d/OrbInstances';
import { MCParticles } from '@/components/3d/MCParticles';
import type { MCParticlesHandle } from '@/components/3d/MCParticles';
import { AuraRings } from '@/components/3d/AuraRings';
import { BuildEffects } from '@/components/3d/BuildEffects';

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

interface GameCanvas3DProps {
  dataRef: React.MutableRefObject<GameData>;
  uiState: UiState;
  sendInput: (angle: number, boost: boolean, seq: number) => void;
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
  const [menuOpen, setMenuOpen] = useState(false);

  // 경과 시간 업데이트 + 오브 데이터 동기화 (rAF 기반)
  useEffect(() => {
    let raf = 0;
    let lastTime = performance.now();
    const tick = (now: number) => {
      elapsedRef.current += (now - lastTime) / 1000;
      lastTime = now;
      // 오브 데이터를 서버 state에서 동기화
      orbsRef.current = dataRef.current.latestState?.o ?? [];
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [dataRef]);

  // ─── 입력 처리 (마우스 + 키보드) ───
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 마우스 이동 → 방향 계산
    const handleMouseMove = (e: MouseEvent) => {
      if (menuOpen) return;
      const rect = container.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const dx = e.clientX - rect.left - cx;
      const dy = e.clientY - rect.top - cy;
      let angle = Math.atan2(dy, dx);
      if (angle < 0) angle += Math.PI * 2;
      angleRef.current = angle;
      inputSeqRef.current++;
      sendInput(angle, boostRef.current, inputSeqRef.current);
    };

    // 마우스 클릭 → 부스트
    const handleMouseDown = () => {
      if (menuOpen) return;
      boostRef.current = true;
      inputSeqRef.current++;
      sendInput(angleRef.current, true, inputSeqRef.current);
    };
    const handleMouseUp = () => {
      boostRef.current = false;
      inputSeqRef.current++;
      sendInput(angleRef.current, false, inputSeqRef.current);
    };

    // 키보드 방향/부스트
    const keys = { up: false, down: false, left: false, right: false };
    const directionKeys: Record<string, keyof typeof keys> = {
      KeyW: 'up', ArrowUp: 'up',
      KeyS: 'down', ArrowDown: 'down',
      KeyA: 'left', ArrowLeft: 'left',
      KeyD: 'right', ArrowRight: 'right',
    };

    const updateKeyboardAngle = () => {
      let dx = 0, dy = 0;
      if (keys.right) dx += 1;
      if (keys.left) dx -= 1;
      if (keys.down) dy += 1;
      if (keys.up) dy -= 1;
      if (dx === 0 && dy === 0) return;
      let angle = Math.atan2(dy, dx);
      if (angle < 0) angle += Math.PI * 2;
      angleRef.current = angle;
      inputSeqRef.current++;
      sendInput(angle, boostRef.current, inputSeqRef.current);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        setMenuOpen(prev => !prev);
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        boostRef.current = true;
        inputSeqRef.current++;
        sendInput(angleRef.current, true, inputSeqRef.current);
        return;
      }
      const dir = directionKeys[e.code];
      if (dir) {
        e.preventDefault();
        keys[dir] = true;
        updateKeyboardAngle();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        boostRef.current = false;
        inputSeqRef.current++;
        sendInput(angleRef.current, false, inputSeqRef.current);
        return;
      }
      const dir = directionKeys[e.code];
      if (dir) {
        keys[dir] = false;
        updateKeyboardAngle();
      }
    };

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mousedown', handleMouseDown);
      container.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [menuOpen, sendInput]);

  // ─── 리스폰 핸들러 ───
  const handleRespawn = useCallback(() => {
    const rs = uiState.roomState;
    if (rs === 'ending' || rs === 'cooldown') return;
    respawn(playerName, skinId);
  }, [respawn, playerName, skinId, uiState.roomState]);

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

  // ─── 오버레이 표시 조건 (기존 GameCanvas.tsx와 동일) ───
  const showTimer = uiState.roomState === 'playing' && uiState.timeRemaining > 0;
  const showRoundResult = uiState.roomState === 'ending' && uiState.roundEnd !== null;
  const showCooldown = uiState.roomState === 'cooldown';
  const showWaiting = uiState.roomState === 'waiting';
  const showDeath = uiState.deathInfo && !showRoundResult && !showCooldown && uiState.roomState !== 'ending';
  const showLevelUp = uiState.levelUp !== null && uiState.alive && !showDeath && !showRoundResult;

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}
    >
      {/* ─── R3F Canvas ─── */}
      <Canvas
        dpr={[1, 1]}
        gl={{ antialias: true }}
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
        />

        {/* 2. PlayCamera — 보간된 Agent 위치 추적 */}
        <PlayCamera
          agentsRef={agentsRef}
          dataRef={dataRef}
        />

        {/* 3. Scene — 라이팅 + Fog + 분위기 변화 */}
        <Scene timeRemaining={uiState.timeRemaining} />

        {/* 4. SkyBox — 하늘 돔 + 구름 */}
        <SkyBox />

        {/* 5. AgentInstances — MC 복셀 캐릭터 InstancedMesh 렌더링 */}
        <AgentInstances agentsRef={agentsRef} elapsedRef={elapsedRef} />

        {/* 6. ZoneTerrain — 3개 동심원 존 바닥 (Edge/Mid/Core) */}
        <ZoneTerrain arenaRadius={ARENA_CONFIG.radius} />

        {/* 7. TerrainDeco — 환경 데코레이션 (나무/횃불/용암 등) */}
        <TerrainDeco arenaRadius={ARENA_CONFIG.radius} />

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
      </Canvas>

      {/* ─── HTML HUD 오버레이 (Canvas 밖) ─── */}

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

      {myAgent && (
        <XPBar
          level={myAgent.lv ?? 1}
          xp={0}
          xpToNext={100}
        />
      )}

      {showTimer && <RoundTimerHUD timeRemaining={uiState.timeRemaining} />}
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
      padding: '6px 20px', borderRadius: '4px',
      border: '1.5px solid #A89888', letterSpacing: '0.03em',
    }}>
      {text}
    </div>
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
        padding: '40px 48px', borderRadius: 4,
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
          width: 200, padding: '12px 0', fontSize: 17, fontWeight: 700,
          backgroundColor: '#D4914A', color: '#F5F0E8', border: '2px solid #3A3028',
          borderRadius: 4, cursor: 'pointer', fontFamily: '"Patrick Hand", "Inter", sans-serif',
        }}>
          RESUME
        </button>
        <button onClick={onExit} style={{
          width: 200, padding: '12px 0', fontSize: 17, fontWeight: 700,
          backgroundColor: 'transparent', color: '#C75B5B', border: '1.5px solid #C75B5B',
          borderRadius: 4, cursor: 'pointer', fontFamily: '"Patrick Hand", "Inter", sans-serif',
        }}>
          EXIT TO LOBBY
        </button>
      </div>
    </div>
  );
}
