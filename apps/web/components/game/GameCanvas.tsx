'use client';

/**
 * GameCanvas — 순수 React 컴포넌트 (조합만)
 * 카메라/보간/예측/렌더러를 서브모듈에 위임
 * useSocket은 부모(page.tsx)에서 lift — props로 수신
 * v10: Snake → Agent 전환
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import { useGameLoop } from '@/hooks/useGameLoop';
import { useInput } from '@/hooks/useInput';
import type { GameData, UiState } from '@/hooks/useSocket';
import { render } from '@/lib/renderer';
import type { RenderState, KillFeedEntry } from '@/lib/renderer';
import { drawBackground, drawBoundary } from '@/lib/renderer/background';
import { createCamera, updateCamera } from '@/lib/camera';
import { interpolateAgents, applyClientPrediction } from '@/lib/interpolation';
import { DeathOverlay } from './DeathOverlay';
import { RoundTimerHUD } from './RoundTimerHUD';
import { CountdownOverlay } from './CountdownOverlay';
import { RoundResultOverlay } from './RoundResultOverlay';
import type { BuildSummary } from './RoundResultOverlay';

// v10 overlays
import { LevelUpOverlay } from './LevelUpOverlay';
import { BuildHUD } from './BuildHUD';
import type { BuildData } from './BuildHUD';
import { XPBar } from './XPBar';
import { ShrinkWarning } from './ShrinkWarning';
import { SynergyPopup } from './SynergyPopup';
import { CoachOverlay } from './CoachOverlay';
import { AnalystPanel } from './AnalystPanel';

import { ARENA_CONFIG } from '@snake-arena/shared';

interface GameCanvasProps {
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

export function GameCanvas({ dataRef, uiState, sendInput, respawn, playerName, skinId, onExit, chooseUpgrade, dismissSynergyPopup }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputSeqRef = useRef(0);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const cameraRef = useRef(createCamera());
  const fpsRef = useRef({ frames: 0, lastTime: 0, value: 60 });
  const killFeedRef = useRef<KillFeedEntry[]>([]);
  const lastKillFeedLenRef = useRef(0);
  const [menuOpen, setMenuOpen] = useState(false);

  const { angleRef, boostRef } = useInput(canvasRef, (state) => {
    if (menuOpen) return;
    inputSeqRef.current++;
    sendInput(state.angle, state.boost, inputSeqRef.current);
  }, () => setMenuOpen(prev => !prev));

  // 캔버스 초기화 + 리사이즈
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    ctxRef.current = ctx;

    const handleResize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      if (ctx) ctx.scale(dpr, dpr);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 렌더 루프
  useGameLoop(useCallback((dt: number) => {
    const ctx = ctxRef.current;
    if (!ctx) return;

    const fpsData = fpsRef.current;
    fpsData.frames++;
    const now = performance.now();
    if (now - fpsData.lastTime >= 1000) {
      fpsData.value = fpsData.frames;
      fpsData.frames = 0;
      fpsData.lastTime = now;
    }

    const data = dataRef.current;
    const state = data.latestState;

    const w = parseInt(ctx.canvas.style.width) || window.innerWidth;
    const h = parseInt(ctx.canvas.style.height) || window.innerHeight;

    if (!state) {
      drawBackground(ctx, cameraRef.current, w, h, ARENA_CONFIG.radius);
      drawBoundary(ctx, cameraRef.current, ARENA_CONFIG.radius, w, h);
      return;
    }

    const serverInterval = data.stateTimestamp - data.prevStateTimestamp;
    const elapsed = now - data.stateTimestamp;
    const t = serverInterval > 0 ? Math.min(elapsed / serverInterval, 1.5) : 1;

    let agents = interpolateAgents(data.prevState?.s || null, state.s, t);
    const myAgent = agents.find(a => a.i === data.playerId);

    if (myAgent) {
      const predicted = applyClientPrediction(myAgent, angleRef.current, dt);
      agents = agents.map(a => a.i === data.playerId ? predicted : a);
      updateCamera(cameraRef.current, predicted.x, predicted.y, predicted.m, dt);
    }

    const rawFeed = data.killFeed;
    if (rawFeed.length !== lastKillFeedLenRef.current) {
      const newCount = rawFeed.length - lastKillFeedLenRef.current;
      for (let i = 0; i < newCount; i++) {
        const kill = rawFeed[i];
        killFeedRef.current.unshift({
          text: `You eliminated ${kill.victim}!`,
          isMe: true,
          timestamp: now,
        });
      }
      lastKillFeedLenRef.current = rawFeed.length;
      if (killFeedRef.current.length > 5) {
        killFeedRef.current = killFeedRef.current.slice(0, 5);
      }
    }

    const renderState: RenderState = {
      agents,
      orbs: state.o,
      minimap: data.minimap,
      leaderboard: data.leaderboard,
      killFeed: killFeedRef.current,
      camera: cameraRef.current,
      arenaRadius: ARENA_CONFIG.radius,
      playerCount: agents.length,
      rtt: data.rtt,
      fps: fpsData.value,
    };

    render(ctx, renderState, data.playerId, w, h, dt);
  }, [dataRef, angleRef]));

  const handleRespawn = useCallback(() => {
    // playing/waiting/countdown 중에만 리스폰 허용
    const rs = uiState.roomState;
    if (rs === 'ending' || rs === 'cooldown') return;
    respawn(playerName, skinId);
  }, [respawn, playerName, skinId, uiState.roomState]);

  const handleExitToLobby = useCallback(() => {
    onExit();
  }, [onExit]);

  // 현재 플레이어 정보 (for v10 overlays)
  const myAgent = (() => {
    const state = dataRef.current.latestState;
    if (!state || !dataRef.current.playerId) return null;
    return state.s.find(a => a.i === dataRef.current.playerId) ?? null;
  })();

  const playerDistance = myAgent
    ? Math.sqrt(myAgent.x * myAgent.x + myAgent.y * myAgent.y)
    : 0;
  const currentRadius = uiState.arenaShrink?.currentRadius ?? ARENA_CONFIG.radius;

  const showTimer = uiState.roomState === 'playing' && uiState.timeRemaining > 0;
  const showCountdown = uiState.roomState === 'countdown' && uiState.countdown !== null && uiState.countdown > 0;
  const showRoundResult = uiState.roomState === 'ending' && uiState.roundEnd !== null;
  const showCooldown = uiState.roomState === 'cooldown';
  const showWaiting = uiState.roomState === 'waiting';
  const showDeath = uiState.deathInfo && !showRoundResult && !showCooldown && uiState.roomState !== 'ending';
  const showLevelUp = uiState.levelUp !== null && uiState.alive && !showDeath && !showRoundResult;

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <canvas ref={canvasRef} style={{ display: 'block' }} />

      {/* v10 ShrinkWarning (always mounted, conditionally visible) */}
      <ShrinkWarning
        shrinkData={uiState.arenaShrink}
        playerDistance={playerDistance}
        currentRadius={currentRadius}
      />

      {/* v10 Synergy Popup */}
      {dismissSynergyPopup && (
        <SynergyPopup
          synergies={uiState.synergyPopups}
          onDismiss={dismissSynergyPopup}
        />
      )}

      {/* v10 BuildHUD */}
      <BuildHUD build={null} />

      {/* v10 XP Bar */}
      {myAgent && (
        <XPBar
          level={myAgent.lv ?? 1}
          xp={0}
          xpToNext={100}
        />
      )}

      {/* Round/game overlays */}
      {showTimer && <RoundTimerHUD timeRemaining={uiState.timeRemaining} />}
      {showCountdown && <CountdownOverlay initialCount={uiState.countdown!} />}
      {showRoundResult && (
        <RoundResultOverlay
          roundEnd={uiState.roundEnd!}
          deathInfo={uiState.deathInfo}
          analysisPanel={<AnalystPanel analysis={uiState.roundAnalysis ?? null} />}
        />
      )}
      {showCooldown && <WaitingBanner text="Next round starting soon..." />}
      {showWaiting && <WaitingBanner text="Waiting for players..." />}
      {showDeath && !showLevelUp && <DeathOverlay deathInfo={uiState.deathInfo!} onRespawn={handleRespawn} />}

      {/* Phase 5: Coach Overlay */}
      <CoachOverlay message={uiState.coachMessage ?? null} />

      {/* v10 LevelUp Overlay (highest priority gameplay overlay) */}
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
        <p style={{ color: '#6B5E52', fontSize: 13, margin: 0, fontFamily: '"Patrick Hand", "Inter", sans-serif' }}>ESC to resume</p>
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
