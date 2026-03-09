'use client';

/**
 * MatrixHUD.tsx - v28 Phase 5: In-game HUD
 *
 * Matrix green (#00FF41) 기반 다크 테마 HUD
 * - 상단: HP 바, XP 바, 레벨 표시
 * - 좌상단: 게임 타이머, 킬수, 점수
 * - 하단: 무기 슬롯 (최대 6개, 쿨다운 원형 오버레이)
 * - 우하단: 미니맵 (Canvas 기반)
 * - Auto Hunt 상태 표시
 */

import { useRef, useEffect, useCallback, memo } from 'react';

// ============================================
// Props 인터페이스
// ============================================

export interface WeaponSlot {
  type: string;
  level: number;
  cooldownPercent: number;
}

export interface MatrixHUDProps {
  health: number;
  maxHealth: number;
  xp: number;
  xpToNext: number;
  level: number;
  score: number;
  kills: number;
  gameTime: number; // seconds
  weaponSlots: WeaponSlot[];
  enemyCount: number;
  autoHuntEnabled: boolean;
  isPaused: boolean;
}

// ============================================
// 상수
// ============================================

const MATRIX_GREEN = '#00FF41';
const MATRIX_GREEN_DIM = 'rgba(0, 255, 65, 0.3)';
const MATRIX_GREEN_BG = 'rgba(0, 255, 65, 0.08)';

// 무기 아이콘 이모지 매핑
const WEAPON_EMOJI: Record<string, string> = {
  wand: '\u{1F310}',       // 지구본 - API Call
  knife: '\u{1F528}',      // 망치 - Git Push
  whip: '\u{1F4BB}',       // 노트북 - Hand Coding
  axe: '\u{1F5A5}',        // 서버 - Server Throw
  bow: '\u{1F3AF}',        // 타겟 - GraphQL
  bible: '\u{1F4C4}',      // 문서 - Documentation
  garlic: '\u{1F41B}',     // 버그 - Debug Aura
  pool: '\u{1F6E1}',       // 방패 - Firewall Zone
  lightning: '\u{26A1}',   // 번개 - Claude Assist
  beam: '\u{1F4DA}',       // 책 - Stack Trace
  laser: '\u{1F504}',      // 루프 - Recursive Loop
  ping: '\u{1F4E1}',       // 안테나 - Ping Packet
  shard: '\u{1F48E}',      // 다이아 - Code Snippet
  fork: '\u{1F500}',       // 분기 - Git Fork
  punch: '\u{2328}',       // 키보드 - Keyboard Punch
  sword: '\u{2694}',       // 칼 - Sword
  bridge: '\u{1F517}',     // 링크 - Async/Await
  phishing: '\u{1F5C4}',   // 서버 - MCP Server
  stablecoin: '\u{1F512}', // 자물쇠 - Type Safety
  airdrop: '\u{1F4E6}',    // 상자 - NPM Install
  genesis: '\u{1F4A5}',    // 폭발 - System Crash
};

// ============================================
// 유틸리티
// ============================================

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// ============================================
// 서브 컴포넌트: 미니맵 (Canvas 기반)
// ============================================

interface MinimapProps {
  playerX: number;
  playerY: number;
  enemies: { x: number; y: number }[];
}

const Minimap = memo(function Minimap({ playerX, playerY, enemies }: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    const mapRange = 800; // 미니맵이 표시하는 월드 범위 (반경)

    ctx.clearRect(0, 0, size, size);

    // 배경
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, size, size);

    // 테두리
    ctx.strokeStyle = MATRIX_GREEN_DIM;
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, size, size);

    // 적 점
    ctx.fillStyle = '#ef4444';
    for (const e of enemies) {
      const dx = e.x - playerX;
      const dy = e.y - playerY;
      const sx = size / 2 + (dx / mapRange) * (size / 2);
      const sy = size / 2 + (dy / mapRange) * (size / 2);
      if (sx >= 0 && sx <= size && sy >= 0 && sy <= size) {
        ctx.fillRect(sx - 1, sy - 1, 2, 2);
      }
    }

    // 플레이어 (중앙)
    ctx.fillStyle = MATRIX_GREEN;
    ctx.fillRect(size / 2 - 2, size / 2 - 2, 4, 4);

    // 십자선
    ctx.strokeStyle = 'rgba(0, 255, 65, 0.15)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(size / 2, 0);
    ctx.lineTo(size / 2, size);
    ctx.moveTo(0, size / 2);
    ctx.lineTo(size, size / 2);
    ctx.stroke();
  }, [playerX, playerY, enemies]);

  useEffect(() => {
    draw();
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      width={100}
      height={100}
      className="rounded border border-green-900/50"
      style={{ imageRendering: 'pixelated' }}
    />
  );
});

// ============================================
// 메인 컴포넌트: MatrixHUD
// ============================================

function MatrixHUD({
  health,
  maxHealth,
  xp,
  xpToNext,
  level,
  score,
  kills,
  gameTime,
  weaponSlots,
  enemyCount,
  autoHuntEnabled,
  isPaused,
}: MatrixHUDProps) {
  const hpRatio = maxHealth > 0 ? health / maxHealth : 0;
  const xpRatio = xpToNext > 0 ? xp / xpToNext : 0;

  return (
    <div
      className="absolute inset-0 pointer-events-none select-none"
      style={{ fontFamily: 'monospace', zIndex: 10 }}
    >
      {/* ========================================
          상단 중앙: HP 바 + XP 바 + 레벨
          ======================================== */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 pt-3 px-4 w-full max-w-md">
        {/* HP 바 */}
        <div className="w-full">
          <div className="relative h-4 bg-black/70 border border-gray-700 overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 transition-all duration-200"
              style={{
                width: `${Math.max(0, Math.min(100, hpRatio * 100))}%`,
                backgroundColor: hpRatio > 0.5 ? '#22c55e' : hpRatio > 0.25 ? '#f59e0b' : '#ef4444',
              }}
            />
            {/* HP 텍스트 */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[10px] text-white/90 font-bold tracking-wider drop-shadow-md">
                HP {Math.ceil(health)}/{maxHealth}
              </span>
            </div>
          </div>
        </div>

        {/* XP 바 */}
        <div className="w-full">
          <div className="relative h-2.5 bg-black/70 border border-gray-700 overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 transition-all duration-200"
              style={{
                width: `${Math.max(0, Math.min(100, xpRatio * 100))}%`,
                backgroundColor: '#8b5cf6',
              }}
            />
          </div>
          <div className="flex justify-between mt-0.5">
            <span className="text-[9px] text-purple-400">
              XP {xp}/{xpToNext}
            </span>
            <span
              className="text-[10px] font-bold tracking-widest"
              style={{ color: MATRIX_GREEN }}
            >
              Lv.{level}
            </span>
          </div>
        </div>
      </div>

      {/* ========================================
          좌상단: 타이머, 킬수, 점수
          ======================================== */}
      <div className="absolute top-3 left-3 flex flex-col gap-1">
        {/* 타이머 */}
        <div
          className="text-xl font-bold tracking-widest"
          style={{ color: MATRIX_GREEN }}
        >
          {formatTime(gameTime)}
        </div>
        {/* 킬수 */}
        <div className="text-xs text-gray-400">
          <span className="text-red-400 font-bold">{kills}</span> KILLS
        </div>
        {/* 점수 */}
        <div className="text-xs text-gray-400">
          <span className="text-yellow-400 font-bold">{score.toLocaleString()}</span> SCORE
        </div>
        {/* 적 수 */}
        <div className="text-[10px] text-gray-600">
          Enemies: {enemyCount}
        </div>
      </div>

      {/* ========================================
          좌상단 아래: Auto Hunt 상태
          ======================================== */}
      <div className="absolute top-28 left-3">
        <div
          className="text-[10px] font-bold tracking-wider px-2 py-0.5 border"
          style={{
            color: autoHuntEnabled ? MATRIX_GREEN : '#666666',
            borderColor: autoHuntEnabled ? MATRIX_GREEN_DIM : '#333333',
            backgroundColor: autoHuntEnabled ? MATRIX_GREEN_BG : 'rgba(0,0,0,0.5)',
          }}
        >
          AUTO HUNT: {autoHuntEnabled ? 'ON' : 'OFF'}
        </div>
      </div>

      {/* ========================================
          하단 중앙: 무기 슬롯 (최대 6개)
          ======================================== */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
        {weaponSlots.map((slot, i) => (
          <div
            key={`${slot.type}-${i}`}
            className="relative w-12 h-12 bg-black/70 border border-gray-700 flex flex-col items-center justify-center overflow-hidden"
          >
            {/* 무기 아이콘 (이모지) */}
            <span className="text-lg leading-none">
              {WEAPON_EMOJI[slot.type] || '\u{2728}'}
            </span>
            {/* 레벨 표시 */}
            <span
              className="text-[8px] font-bold mt-0.5"
              style={{ color: MATRIX_GREEN }}
            >
              Lv.{slot.level}
            </span>

            {/* 쿨다운 오버레이 (원형 프로그레스) */}
            {slot.cooldownPercent > 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="w-full h-full" viewBox="0 0 48 48">
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    fill="rgba(0,0,0,0.6)"
                    stroke="none"
                  />
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    fill="none"
                    stroke={MATRIX_GREEN}
                    strokeWidth="2"
                    strokeDasharray={`${(1 - slot.cooldownPercent) * 125.6} 125.6`}
                    strokeDashoffset="31.4"
                    strokeLinecap="round"
                    transform="rotate(-90 24 24)"
                    opacity="0.7"
                  />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ========================================
          하단 중앙: ESC 안내
          ======================================== */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 pb-1">
        <span className="text-[10px] text-white/20">
          ESC Pause | TAB Auto Hunt
        </span>
      </div>

      {/* ========================================
          일시정지 표시
          ======================================== */}
      {isPaused && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <span
            className="text-4xl font-bold tracking-[0.3em] animate-pulse"
            style={{ color: MATRIX_GREEN }}
          >
            PAUSED
          </span>
        </div>
      )}
    </div>
  );
}

export default memo(MatrixHUD);
