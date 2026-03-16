'use client';

/**
 * Minimap3D.tsx — 3D 모드용 미니맵 (HTML Canvas 2D)
 *
 * 플레이어 위치 (흰 점) + 적 위치 (빨간 점) + 안전지대 경계를 표시.
 * MatrixScene의 matrix-scene-hud-overlay div 안에 렌더링.
 * R3F Canvas 밖의 순수 HTML Canvas 2D.
 *
 * 우측 하단 배치, 110x110px.
 */

import { memo, useRef, useEffect, useCallback } from 'react';
import type { Player, Enemy } from '@/lib/matrix/types';
import { SK } from '@/lib/sketch-ui';

// ============================================
// Props
// ============================================

export interface Minimap3DProps {
  /** 플레이어 ref */
  playerRef: React.MutableRefObject<Player>;
  /** 적 목록 ref */
  enemiesRef: React.MutableRefObject<Enemy[]>;
  /** 미니맵 표시 월드 범위 (±range, 기본 600) */
  worldRange?: number;
  /** 미니맵 크기 (px, 기본 110) */
  size?: number;
}

// ============================================
// Constants
// ============================================

const MINIMAP_BG = 'rgba(14, 14, 18, 0.75)';
const MINIMAP_BORDER = 'rgba(255, 255, 255, 0.1)';
const PLAYER_COLOR = '#FFFFFF';
const ENEMY_COLOR = '#EF4444';
const BOSS_COLOR = '#FBBF24';
const SAFE_ZONE_COLOR = 'rgba(16, 185, 129, 0.3)';
const SAFE_ZONE_BORDER = 'rgba(16, 185, 129, 0.6)';

// ============================================
// Main Component
// ============================================

function Minimap3DInner({
  playerRef,
  enemiesRef,
  worldRange = 600,
  size = 110,
}: Minimap3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  // 월드 좌표 → 미니맵 좌표 변환
  const worldToMinimap = useCallback(
    (wx: number, wy: number, px: number, py: number): [number, number] => {
      const half = size / 2;
      const scale = half / worldRange;
      const mx = half + (wx - px) * scale;
      const my = half + (wy - py) * scale;
      return [mx, my];
    },
    [size, worldRange]
  );

  // 렌더링 루프
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // HiDPI
    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 2) : 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    let running = true;

    const draw = () => {
      if (!running) return;

      const player = playerRef.current;
      const enemies = enemiesRef.current;
      const px = player.position.x;
      const py = player.position.y;

      // 배경 클리어
      ctx.clearRect(0, 0, size, size);

      // 배경 사각형
      ctx.fillStyle = MINIMAP_BG;
      ctx.fillRect(0, 0, size, size);

      // 안전지대 원 (중심 0,0 기준, 반경 worldRange * 0.8)
      const safeRadius = worldRange * 0.8;
      const [scx, scy] = worldToMinimap(0, 0, px, py);
      const safeRadiusMinimap = (safeRadius / worldRange) * (size / 2);
      ctx.beginPath();
      ctx.arc(scx, scy, safeRadiusMinimap, 0, Math.PI * 2);
      ctx.fillStyle = SAFE_ZONE_COLOR;
      ctx.fill();
      ctx.strokeStyle = SAFE_ZONE_BORDER;
      ctx.lineWidth = 1;
      ctx.stroke();

      // 적 표시 (빨간 점)
      for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        const [ex, ey] = worldToMinimap(e.position.x, e.position.y, px, py);

        // 미니맵 범위 내인지 확인
        if (ex < -2 || ex > size + 2 || ey < -2 || ey > size + 2) continue;

        const isBoss = e.isBoss;
        const dotSize = isBoss ? 3 : 1.5;

        ctx.fillStyle = isBoss ? BOSS_COLOR : ENEMY_COLOR;
        ctx.fillRect(ex - dotSize, ey - dotSize, dotSize * 2, dotSize * 2);
      }

      // 플레이어 표시 (흰 점, 중앙)
      const half = size / 2;
      ctx.fillStyle = PLAYER_COLOR;
      ctx.beginPath();
      ctx.arc(half, half, 3, 0, Math.PI * 2);
      ctx.fill();

      // 플레이어 방향 표시 (작은 삼각형)
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.moveTo(half, half - 5);
      ctx.lineTo(half - 2.5, half - 1);
      ctx.lineTo(half + 2.5, half - 1);
      ctx.closePath();
      ctx.fill();

      // 테두리
      ctx.strokeStyle = MINIMAP_BORDER;
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, size - 1, size - 1);

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);

    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
    };
  }, [playerRef, enemiesRef, size, worldRange, worldToMinimap]);

  return (
    <div style={{
      position: 'absolute',
      bottom: 12,
      right: 12,
      zIndex: 30,
      pointerEvents: 'none',
    }}>
      {/* 미니맵 라벨 */}
      <div style={{
        position: 'absolute',
        top: -14,
        left: 0,
        fontSize: 8,
        fontFamily: '"Chakra Petch", sans-serif',
        fontWeight: 700,
        color: SK.textMuted,
        letterSpacing: '0.1em',
      }}>
        MAP
      </div>
      <canvas
        ref={canvasRef}
        style={{
          width: size,
          height: size,
          display: 'block',
          border: `1px solid ${SK.border}`,
        }}
      />
    </div>
  );
}

const Minimap3D = memo(Minimap3DInner);
export { Minimap3D };
export default Minimap3D;
