'use client';

/**
 * GameCanvas — 순수 React 컴포넌트 (조합만)
 * 카메라/보간/예측/렌더러를 서브모듈에 위임
 */

import { useRef, useEffect, useCallback } from 'react';
import { useGameLoop } from '@/hooks/useGameLoop';
import { useInput } from '@/hooks/useInput';
import { useSocket } from '@/hooks/useSocket';
import { render } from '@/lib/renderer';
import type { RenderState, KillFeedEntry } from '@/lib/renderer';
import { createCamera, updateCamera } from '@/lib/camera';
import { interpolateSnakes, applyClientPrediction } from '@/lib/interpolation';
import { DeathOverlay } from './DeathOverlay';
import { ARENA_CONFIG } from '@snake-arena/shared';

interface GameCanvasProps {
  playerName: string;
  skinId: number;
}

export function GameCanvas({ playerName, skinId }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { dataRef, uiState, join, sendInput, respawn } = useSocket();
  const inputSeqRef = useRef(0);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const cameraRef = useRef(createCamera());
  const fpsRef = useRef({ frames: 0, lastTime: 0, value: 60 });
  const killFeedRef = useRef<KillFeedEntry[]>([]);
  const lastKillFeedLenRef = useRef(0);

  const { angleRef, boostRef } = useInput(canvasRef, (state) => {
    inputSeqRef.current++;
    sendInput(state.angle, state.boost, inputSeqRef.current);
  });

  // 조인
  useEffect(() => {
    if (uiState.connected && !dataRef.current.playerId) {
      join(playerName, skinId);
    }
  }, [uiState.connected, dataRef, join, playerName, skinId]);

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

    // FPS
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
    if (!state) return;

    // 보간
    const serverInterval = data.stateTimestamp - data.prevStateTimestamp;
    const elapsed = now - data.stateTimestamp;
    const t = serverInterval > 0 ? Math.min(elapsed / serverInterval, 1.5) : 1;

    let snakes = interpolateSnakes(data.prevState?.s || null, state.s, t);
    const mySnake = snakes.find(s => s.i === data.playerId);

    // 클라이언트 예측 + 카메라
    if (mySnake && mySnake.p.length > 0) {
      const predicted = applyClientPrediction(mySnake, angleRef.current, dt);
      snakes = snakes.map(s => s.i === data.playerId ? predicted : s);
      updateCamera(cameraRef.current, predicted.p[0][0], predicted.p[0][1], predicted.m, dt);
    }

    const w = parseInt(ctx.canvas.style.width) || window.innerWidth;
    const h = parseInt(ctx.canvas.style.height) || window.innerHeight;

    // killFeed 변환 (KillPayload → KillFeedEntry)
    const rawFeed = data.killFeed;
    if (rawFeed.length !== lastKillFeedLenRef.current) {
      const newCount = rawFeed.length - lastKillFeedLenRef.current;
      for (let i = 0; i < newCount; i++) {
        const kill = rawFeed[i];
        killFeedRef.current.unshift({
          text: `You ate ${kill.victim}!`,
          isMe: true,
          timestamp: now,
        });
      }
      lastKillFeedLenRef.current = rawFeed.length;
      // 최대 5개 유지
      if (killFeedRef.current.length > 5) {
        killFeedRef.current = killFeedRef.current.slice(0, 5);
      }
    }

    const renderState: RenderState = {
      snakes,
      orbs: state.o,
      minimap: data.minimap,
      leaderboard: data.leaderboard,
      killFeed: killFeedRef.current,
      camera: cameraRef.current,
      arenaRadius: ARENA_CONFIG.radius,
      playerCount: snakes.length,
      rtt: data.rtt,
      fps: fpsData.value,
    };

    render(ctx, renderState, data.playerId, w, h, dt);
  }, []));

  const handleRespawn = useCallback(() => {
    respawn(playerName, skinId);
  }, [respawn, playerName, skinId]);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <canvas ref={canvasRef} style={{ display: 'block', cursor: 'none' }} />
      {uiState.deathInfo && <DeathOverlay deathInfo={uiState.deathInfo} onRespawn={handleRespawn} />}
    </div>
  );
}
