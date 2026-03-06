'use client';

/**
 * GameMinimap — 우하단 미니맵
 * Canvas 2D로 아레나, 에이전트, 경계 표시
 * HTML 오버레이 (R3F Canvas 밖)
 */

import { useRef, useEffect, useCallback } from 'react';
import type { GameData } from '@/hooks/useSocket';
import type { ArenaShrinkPayload } from '@agent-survivor/shared';
import { MC, pixelFont } from '@/lib/minecraft-ui';

interface GameMinimapProps {
  dataRef: React.MutableRefObject<GameData>;
  arenaRadius: number;
  shrinkData: ArenaShrinkPayload | null;
}

const MAP_SIZE = 140; // CSS px
const CANVAS_SIZE = MAP_SIZE * 2; // 고해상도 렌더링
const PADDING = 8;

export function GameMinimap({ dataRef, arenaRadius, shrinkData }: GameMinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const state = dataRef.current.latestState;
    const playerId = dataRef.current.playerId;
    const agents = state?.s ?? [];
    const currentRadius = shrinkData?.currentRadius ?? arenaRadius;

    const cx = CANVAS_SIZE / 2;
    const cy = CANVAS_SIZE / 2;
    const scale = (CANVAS_SIZE / 2 - PADDING * 2) / arenaRadius;

    // 배경 클리어
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // 배경 원 (아레나 전체)
    ctx.beginPath();
    ctx.arc(cx, cy, arenaRadius * scale, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(30, 30, 30, 0.85)';
    ctx.fill();

    // 존 표시 (Edge/Mid/Core)
    // Edge (전체)
    ctx.beginPath();
    ctx.arc(cx, cy, arenaRadius * scale, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(60, 110, 50, 0.4)';
    ctx.fill();

    // Mid zone (60%)
    ctx.beginPath();
    ctx.arc(cx, cy, arenaRadius * 0.60 * scale, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(90, 90, 90, 0.4)';
    ctx.fill();

    // Core zone (25%)
    ctx.beginPath();
    ctx.arc(cx, cy, arenaRadius * 0.25 * scale, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(120, 40, 40, 0.4)';
    ctx.fill();

    // 현재 수축 경계
    if (currentRadius < arenaRadius) {
      ctx.beginPath();
      ctx.arc(cx, cy, currentRadius * scale, 0, Math.PI * 2);
      ctx.strokeStyle = '#FF4444';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 10초 후 경계 (있으면)
      if (shrinkData?.minRadius) {
        ctx.beginPath();
        ctx.arc(cx, cy, shrinkData.minRadius * scale, 0, Math.PI * 2);
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = '#FF444488';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // 아레나 테두리
    ctx.beginPath();
    ctx.arc(cx, cy, arenaRadius * scale, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 에이전트 표시
    for (const agent of agents) {
      if (!agent.a) continue; // 죽은 에이전트 스킵

      const ax = cx + agent.x * scale;
      const ay = cy + agent.y * scale;

      const isPlayer = agent.i === playerId;
      const isBot = agent.bot;

      // 색상 결정
      if (isPlayer) {
        ctx.fillStyle = '#00FF88'; // 본인 = 밝은 초록
        ctx.beginPath();
        ctx.arc(ax, ay, 5, 0, Math.PI * 2);
        ctx.fill();
        // 흰색 테두리
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else if (isBot) {
        ctx.fillStyle = '#888888'; // 봇 = 회색
        ctx.beginPath();
        ctx.arc(ax, ay, 3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#FF5555'; // 다른 플레이어 = 빨강
        ctx.beginPath();
        ctx.arc(ax, ay, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    rafRef.current = requestAnimationFrame(draw);
  }, [dataRef, arenaRadius, shrinkData]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  return (
    <div style={{
      position: 'absolute',
      bottom: '12px',
      right: '12px',
      width: MAP_SIZE,
      height: MAP_SIZE,
      zIndex: 15,
      pointerEvents: 'none',
      borderRadius: '4px',
      border: `1px solid rgba(255,255,255,0.2)`,
      overflow: 'hidden',
      backgroundColor: 'rgba(0,0,0,0.3)',
    }}>
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        style={{
          width: MAP_SIZE,
          height: MAP_SIZE,
          display: 'block',
        }}
      />
      {/* 라벨 */}
      <div style={{
        position: 'absolute',
        top: '3px',
        left: '50%',
        transform: 'translateX(-50%)',
        fontFamily: pixelFont,
        fontSize: '0.2rem',
        color: 'rgba(255,255,255,0.5)',
        letterSpacing: '0.05em',
      }}>
        MAP
      </div>
    </div>
  );
}
