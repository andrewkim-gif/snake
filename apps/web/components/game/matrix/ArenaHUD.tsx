'use client';

/**
 * ArenaHUD.tsx - v28 Phase 6: 배틀로얄 아레나 HUD
 *
 * Matrix green (#00FF41) 기반 다크 테마
 * - 세이프존 타이머 + 페이즈 표시
 * - 생존 에이전트 수 (Alive: X/10)
 * - 킬/데스 스코어보드 (상위 5명)
 * - 세이프존 경고 ("ZONE CLOSING!")
 */

import { memo, useMemo } from 'react';
import type { LeaderboardEntry } from '@/lib/matrix/systems/agent-combat';

// ============================================
// Props
// ============================================

export interface ArenaHUDProps {
  /** 남은 시간 (초) */
  timeRemaining: number;
  /** 생존 에이전트 수 */
  aliveCount: number;
  /** 총 참가자 수 */
  totalCount: number;
  /** 현재 세이프존 페이즈 */
  currentPhase: number;
  /** 존 축소 경고 중 */
  zoneWarning: boolean;
  /** 존 밖 DPS */
  zoneDps: number;
  /** 리더보드 엔트리 (상위 5명) */
  leaderboard: LeaderboardEntry[];
  /** 플레이어가 존 밖인지 */
  playerOutsideZone: boolean;
}

// ============================================
// 시간 포맷
// ============================================

function formatTime(seconds: number): string {
  const m = Math.floor(Math.max(0, seconds) / 60);
  const s = Math.floor(Math.max(0, seconds) % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// ============================================
// 컴포넌트
// ============================================

function ArenaHUDInner({
  timeRemaining,
  aliveCount,
  totalCount,
  currentPhase,
  zoneWarning,
  zoneDps,
  leaderboard,
  playerOutsideZone,
}: ArenaHUDProps) {
  const timeStr = useMemo(() => formatTime(timeRemaining), [timeRemaining]);
  const isLowTime = timeRemaining < 60;
  const top5 = useMemo(() => leaderboard.slice(0, 5), [leaderboard]);

  return (
    <>
      {/* 상단 중앙: 타이머 + 생존자 수 */}
      <div
        className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-1"
        style={{ pointerEvents: 'none' }}
      >
        {/* 세이프존 경고 */}
        {zoneWarning && (
          <div
            className="px-4 py-1 rounded text-sm font-bold tracking-wider animate-pulse"
            style={{
              backgroundColor: 'rgba(255, 80, 0, 0.2)',
              border: '1px solid rgba(255, 80, 0, 0.6)',
              color: '#ff5500',
              fontFamily: 'monospace',
            }}
          >
            ZONE CLOSING! Phase {currentPhase}
          </div>
        )}

        {/* 메인 타이머 */}
        <div
          className="flex items-center gap-4 px-6 py-2 rounded-lg"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            border: `1px solid ${isLowTime ? 'rgba(255, 0, 0, 0.5)' : 'rgba(0, 255, 65, 0.3)'}`,
            fontFamily: 'monospace',
          }}
        >
          {/* 생존자 */}
          <div className="flex items-center gap-1.5">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: '#00FF41' }}
            />
            <span
              className="text-sm font-bold"
              style={{ color: '#00FF41' }}
            >
              {aliveCount}/{totalCount}
            </span>
          </div>

          {/* 구분선 */}
          <div
            className="w-px h-5"
            style={{ backgroundColor: 'rgba(0, 255, 65, 0.2)' }}
          />

          {/* 타이머 */}
          <span
            className="text-2xl font-bold tabular-nums"
            style={{
              color: isLowTime ? '#ff4444' : '#00FF41',
              textShadow: isLowTime
                ? '0 0 10px rgba(255, 0, 0, 0.5)'
                : '0 0 10px rgba(0, 255, 65, 0.3)',
            }}
          >
            {timeStr}
          </span>

          {/* 구분선 */}
          <div
            className="w-px h-5"
            style={{ backgroundColor: 'rgba(0, 255, 65, 0.2)' }}
          />

          {/* 페이즈 */}
          <span
            className="text-xs"
            style={{ color: 'rgba(0, 255, 65, 0.6)' }}
          >
            P{currentPhase}
          </span>
        </div>
      </div>

      {/* 우측: 미니 스코어보드 */}
      <div
        className="fixed top-20 right-3 z-50 w-48"
        style={{ pointerEvents: 'none' }}
      >
        <div
          className="rounded-lg overflow-hidden"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            border: '1px solid rgba(0, 255, 65, 0.15)',
            fontFamily: 'monospace',
          }}
        >
          {/* 헤더 */}
          <div
            className="px-3 py-1.5 text-xs font-bold tracking-wider"
            style={{
              backgroundColor: 'rgba(0, 255, 65, 0.08)',
              color: 'rgba(0, 255, 65, 0.6)',
              borderBottom: '1px solid rgba(0, 255, 65, 0.1)',
            }}
          >
            LEADERBOARD
          </div>

          {/* 엔트리 */}
          <div className="py-1">
            {top5.map((entry, i) => (
              <div
                key={entry.agentId}
                className="flex items-center px-3 py-0.5 gap-2"
                style={{
                  backgroundColor: entry.isPlayer
                    ? 'rgba(0, 255, 65, 0.08)'
                    : 'transparent',
                }}
              >
                {/* 순위 */}
                <span
                  className="text-xs w-4 text-right"
                  style={{ color: 'rgba(255, 255, 255, 0.4)' }}
                >
                  {i + 1}
                </span>

                {/* 컬러 닷 */}
                <div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: entry.color,
                    opacity: entry.isAlive ? 1 : 0.3,
                  }}
                />

                {/* 이름 */}
                <span
                  className="text-xs flex-1 truncate"
                  style={{
                    color: entry.isPlayer
                      ? '#00FF41'
                      : entry.isAlive
                        ? 'rgba(255, 255, 255, 0.8)'
                        : 'rgba(255, 255, 255, 0.3)',
                    fontWeight: entry.isPlayer ? 'bold' : 'normal',
                    textDecoration: entry.isAlive ? 'none' : 'line-through',
                  }}
                >
                  {entry.displayName}
                </span>

                {/* 킬수 */}
                <span
                  className="text-xs"
                  style={{ color: 'rgba(255, 255, 255, 0.5)' }}
                >
                  {entry.kills}K
                </span>

                {/* 점수 */}
                <span
                  className="text-xs tabular-nums w-8 text-right"
                  style={{ color: 'rgba(0, 255, 65, 0.7)' }}
                >
                  {entry.score > 999 ? `${(entry.score / 1000).toFixed(1)}k` : entry.score}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 좌하단: 존 DPS 경고 (존 밖일 때만) */}
      {playerOutsideZone && (
        <div
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-pulse"
          style={{ pointerEvents: 'none' }}
        >
          <div
            className="px-6 py-3 rounded-lg text-center"
            style={{
              backgroundColor: 'rgba(255, 0, 0, 0.2)',
              border: '2px solid rgba(255, 0, 0, 0.6)',
              fontFamily: 'monospace',
            }}
          >
            <div
              className="text-lg font-bold"
              style={{ color: '#ff4444' }}
            >
              OUTSIDE SAFE ZONE
            </div>
            <div
              className="text-sm"
              style={{ color: 'rgba(255, 100, 100, 0.8)' }}
            >
              -{zoneDps.toFixed(0)} HP/s
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const ArenaHUD = memo(ArenaHUDInner);
export default ArenaHUD;
