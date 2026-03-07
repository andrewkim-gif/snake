'use client';

/**
 * Minimap — v16 Phase 8 지형 오버레이 미니맵
 *
 * HTML Canvas 2D 기반:
 * - heightmap → 색상맵 (낮은곳=초록, 높은곳=갈색)
 * - 바이옴 경계 (색상 차이로 표시)
 * - 수역 표시 (파란색)
 * - 장애물 아이콘 (바위/나무/벽)
 * - 에이전트 위치 (기존 GameMinimap 기능 통합)
 * - 수축 경계
 */

import { useRef, useEffect, useCallback } from 'react';
import type { GameData } from '@/hooks/useSocket';
import type { ArenaShrinkPayload } from '@agent-survivor/shared';
import type { HeightmapTerrainData } from '@/components/3d/HeightmapTerrain';
import type { BiomeGridData, ObstacleGridData } from '@/lib/biome-decoder';

interface MinimapProps {
  dataRef: React.MutableRefObject<GameData>;
  arenaRadius: number;
  shrinkData: ArenaShrinkPayload | null;
  heightmapData: HeightmapTerrainData | null;
  biomeData: BiomeGridData | null;
  obstacleData: ObstacleGridData | null;
}

const MAP_SIZE = 160; // CSS px
const CANVAS_SIZE = MAP_SIZE * 2; // 고해상도 렌더링
const PADDING = 6;

// 높이별 색상 보간: 낮=초록, 중=연갈색, 높=갈색
const HEIGHT_COLORS = [
  { h: 0.0, r: 60,  g: 120, b: 50  }, // 낮은 지형 — 짙은 초록
  { h: 0.3, r: 100, g: 140, b: 60  }, // 약간 높음 — 연초록
  { h: 0.5, r: 160, g: 150, b: 80  }, // 중간 — 연갈색
  { h: 0.7, r: 140, g: 110, b: 60  }, // 높음 — 갈색
  { h: 1.0, r: 180, g: 170, b: 150 }, // 매우 높음 — 밝은 갈색
];

// 바이옴별 틴트 색상
const BIOME_TINTS: Record<number, { r: number; g: number; b: number; a: number }> = {
  0: { r: 120, g: 180, b: 80,  a: 0.2 }, // Plains — 연초록 틴트
  1: { r: 30,  g: 100, b: 30,  a: 0.3 }, // Forest — 짙은 녹색
  2: { r: 200, g: 180, b: 100, a: 0.3 }, // Desert — 모래색
  3: { r: 200, g: 220, b: 240, a: 0.3 }, // Snow — 하얀 틴트
  4: { r: 60,  g: 80,  b: 40,  a: 0.3 }, // Swamp — 올리브
  5: { r: 140, g: 50,  b: 30,  a: 0.3 }, // Volcanic — 적갈색
};

// 장애물 타입 마커 색상
const OBSTACLE_MARKERS: Record<number, { color: string; size: number }> = {
  1: { color: '#888888', size: 2 }, // Rock — 회색 점
  2: { color: '#2D5A1B', size: 2 }, // Tree — 짙은 녹색 점
  3: { color: '#A0A0A0', size: 2 }, // Wall — 밝은 회색
  4: { color: '#3366AA', size: 3 }, // Water — 파란 면적
  5: { color: '#FFD700', size: 3 }, // Shrine — 금색
  6: { color: '#00BFFF', size: 3 }, // Spring — 하늘색
  7: { color: '#FF4444', size: 3 }, // Altar — 빨간색
};

function lerpHeightColor(normalizedH: number): { r: number; g: number; b: number } {
  const h = Math.max(0, Math.min(1, normalizedH));

  for (let i = 0; i < HEIGHT_COLORS.length - 1; i++) {
    const c0 = HEIGHT_COLORS[i];
    const c1 = HEIGHT_COLORS[i + 1];
    if (h >= c0.h && h <= c1.h) {
      const t = (h - c0.h) / (c1.h - c0.h);
      return {
        r: Math.round(c0.r + (c1.r - c0.r) * t),
        g: Math.round(c0.g + (c1.g - c0.g) * t),
        b: Math.round(c0.b + (c1.b - c0.b) * t),
      };
    }
  }
  const last = HEIGHT_COLORS[HEIGHT_COLORS.length - 1];
  return { r: last.r, g: last.g, b: last.b };
}

export function Minimap({
  dataRef,
  arenaRadius,
  shrinkData,
  heightmapData,
  biomeData,
  obstacleData,
}: MinimapProps) {
  // 지형 배경 캔버스 (정적, 한 번만 그림)
  const terrainCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const terrainDrawnRef = useRef(false);

  const cx = CANVAS_SIZE / 2;
  const cy = CANVAS_SIZE / 2;
  const scale = (CANVAS_SIZE / 2 - PADDING * 2) / arenaRadius;

  // 지형 배경 한 번만 렌더링
  useEffect(() => {
    const canvas = terrainCanvasRef.current;
    if (!canvas || terrainDrawnRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // 배경 (아레나 영역)
    ctx.beginPath();
    ctx.arc(cx, cy, arenaRadius * scale, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(30, 30, 30, 0.9)';
    ctx.fill();
    ctx.save();
    ctx.clip();

    if (heightmapData && heightmapData.heightData.length > 0) {
      // heightmap → 미니맵 색상맵
      const { heightData, width, height, cellSize } = heightmapData;

      // 높이 범위 계산
      let minH = Infinity;
      let maxH = -Infinity;
      for (let i = 0; i < heightData.length; i++) {
        const v = heightData[i];
        if (v < minH) minH = v;
        if (v > maxH) maxH = v;
      }
      const rangeH = maxH - minH || 1;

      // 미니맵 픽셀 크기 (heightmap 셀 → 미니맵 픽셀)
      const cellPx = (cellSize * scale);

      for (let gy = 0; gy < height; gy++) {
        for (let gx = 0; gx < width; gx++) {
          // 월드 좌표 중심
          const wx = gx * cellSize - arenaRadius;
          const wy = gy * cellSize - arenaRadius;

          // 아레나 밖 스킵
          const dist = Math.sqrt(wx * wx + wy * wy);
          if (dist > arenaRadius * 1.1) continue;

          // 높이 정규화
          const h = (heightData[gy * width + gx] - minH) / rangeH;
          let color = lerpHeightColor(h);

          // 바이옴 틴트 적용
          if (biomeData && biomeData.grid.length > 0) {
            const biomeIdx = biomeData.grid[gy * width + gx];
            const tint = BIOME_TINTS[biomeIdx];
            if (tint) {
              color.r = Math.round(color.r * (1 - tint.a) + tint.r * tint.a);
              color.g = Math.round(color.g * (1 - tint.a) + tint.g * tint.a);
              color.b = Math.round(color.b * (1 - tint.a) + tint.b * tint.a);
            }
          }

          // 수역: 파란색 오버라이드
          if (obstacleData && obstacleData.grid.length > 0) {
            const obsType = obstacleData.grid[gy * width + gx];
            if (obsType === 4) { // water
              color = { r: 50, g: 100, b: 180 };
            }
          }

          const px = cx + wx * scale;
          const py = cy + wy * scale;

          ctx.fillStyle = `rgb(${color.r},${color.g},${color.b})`;
          ctx.fillRect(px - cellPx / 2, py - cellPx / 2, Math.ceil(cellPx), Math.ceil(cellPx));
        }
      }

      // 장애물 마커 (바위/나무/성소 등)
      if (obstacleData && obstacleData.grid.length > 0) {
        for (let gy = 0; gy < height; gy += 2) { // 2셀 간격으로 샘플링 (성능)
          for (let gx = 0; gx < width; gx += 2) {
            const obsType = obstacleData.grid[gy * width + gx];
            if (obsType === 0 || obsType === 4) continue; // empty, water는 이미 처리

            const marker = OBSTACLE_MARKERS[obsType];
            if (!marker) continue;

            const wx = gx * cellSize - arenaRadius;
            const wy = gy * cellSize - arenaRadius;
            const px = cx + wx * scale;
            const py = cy + wy * scale;

            ctx.fillStyle = marker.color;
            ctx.beginPath();
            ctx.arc(px, py, marker.size, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    } else {
      // heightmap 없으면 기본 존 표시
      ctx.beginPath();
      ctx.arc(cx, cy, arenaRadius * scale, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(60, 110, 50, 0.4)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx, cy, arenaRadius * 0.60 * scale, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(90, 90, 90, 0.4)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx, cy, arenaRadius * 0.25 * scale, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(120, 40, 40, 0.4)';
      ctx.fill();
    }

    ctx.restore();

    // 아레나 테두리
    ctx.beginPath();
    ctx.arc(cx, cy, arenaRadius * scale, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    terrainDrawnRef.current = true;
  }, [heightmapData, biomeData, obstacleData, arenaRadius, cx, cy, scale]);

  // 동적 오버레이 (에이전트 + 수축 경계) — rAF 루프
  const drawOverlay = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const state = dataRef.current.latestState;
    const playerId = dataRef.current.playerId;
    const agents = state?.s ?? [];
    const currentRadius = shrinkData?.currentRadius ?? arenaRadius;

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // 수축 경계
    if (currentRadius < arenaRadius) {
      ctx.beginPath();
      ctx.arc(cx, cy, currentRadius * scale, 0, Math.PI * 2);
      ctx.strokeStyle = '#FF4444';
      ctx.lineWidth = 2;
      ctx.stroke();

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

    // 에이전트 표시
    for (const agent of agents) {
      if (!agent.a) continue;

      const ax = cx + agent.x * scale;
      const ay = cy + agent.y * scale;

      const isPlayer = agent.i === playerId;
      const isBot = agent.bot;

      if (isPlayer) {
        ctx.fillStyle = '#00FF88';
        ctx.beginPath();
        ctx.arc(ax, ay, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // FOV 방향 표시
        const aimAngle = agent.f ?? agent.h;
        const fovLen = 10;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(
          ax + Math.cos(aimAngle) * fovLen,
          ay + Math.sin(aimAngle) * fovLen,
        );
        ctx.strokeStyle = '#00FF8888';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else if (isBot) {
        ctx.fillStyle = '#888888';
        ctx.beginPath();
        ctx.arc(ax, ay, 3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#FF5555';
        ctx.beginPath();
        ctx.arc(ax, ay, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    rafRef.current = requestAnimationFrame(drawOverlay);
  }, [dataRef, arenaRadius, shrinkData, cx, cy, scale]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(drawOverlay);
    return () => cancelAnimationFrame(rafRef.current);
  }, [drawOverlay]);

  // heightmap 변경 시 terrain 리드로우
  useEffect(() => {
    terrainDrawnRef.current = false;
  }, [heightmapData, biomeData, obstacleData]);

  return (
    <div style={{
      position: 'absolute',
      bottom: '12px',
      right: '12px',
      width: MAP_SIZE,
      height: MAP_SIZE,
      zIndex: 15,
      pointerEvents: 'none',
      borderRadius: 0,
      border: '1px solid rgba(255,255,255,0.2)',
      overflow: 'hidden',
      backgroundColor: 'rgba(0,0,0,0.3)',
    }}>
      {/* 지형 배경 (정적) */}
      <canvas
        ref={terrainCanvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: MAP_SIZE,
          height: MAP_SIZE,
          display: 'block',
        }}
      />
      {/* 동적 오버레이 (에이전트 + 경계) */}
      <canvas
        ref={overlayCanvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
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
        fontFamily: '"Black Ops One", "Patrick Hand", "Inter", sans-serif',
        fontSize: '0.2rem',
        color: 'rgba(255,255,255,0.6)',
        letterSpacing: '0.05em',
        zIndex: 1,
      }}>
        TERRAIN MAP
      </div>
    </div>
  );
}
