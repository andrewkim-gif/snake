'use client';

/**
 * ArenaHUD.tsx - v29 Phase 5: Arena Mode In-Game HUD
 *
 * Adapted from app_ingame/components/arena/ArenaHUD.tsx
 * - Timer + Phase indicator
 * - Kill/Death stats
 * - Safe zone status with shrink warnings
 * - Mini leaderboard (top 5)
 * - Agent HP bar when damaged
 *
 * Matrix green (#00FF41) theme applied.
 */

import React, { memo, useMemo } from 'react';
import {
  Timer,
  Target,
  Shield,
  Skull,
  AlertTriangle,
  Trophy,
} from 'lucide-react';

// ============================================
// Exported types (used by MatrixApp)
// ============================================

export interface LeaderboardEntry {
  agentId: string;
  displayName: string;
  kills: number;
  deaths: number;
  score: number;
  isPlayer: boolean;
  isAlive: boolean;
  color: string;
}

export interface ArenaHUDProps {
  /** Remaining time (seconds) */
  timeRemaining: number;
  /** Alive agent count */
  aliveCount: number;
  /** Total participants */
  totalCount: number;
  /** Current safe zone phase */
  currentPhase: number;
  /** Zone shrink warning active */
  zoneWarning: boolean;
  /** Zone DPS when outside */
  zoneDps: number;
  /** Leaderboard entries (top 5) */
  leaderboard: LeaderboardEntry[];
  /** Player currently outside zone */
  playerOutsideZone: boolean;
}

// ============================================
// Utils
// ============================================

function formatTime(seconds: number): string {
  const mins = Math.floor(Math.max(0, seconds) / 60);
  const secs = Math.floor(Math.max(0, seconds) % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getSafeZoneStatus(isShrinking: boolean, isWarning: boolean, phase: number): string {
  if (isShrinking) return 'ZONE SHRINKING';
  if (isWarning) return `PHASE ${phase} WARNING`;
  return `PHASE ${phase}`;
}

// ============================================
// Constants
// ============================================

const MATRIX_GREEN = '#00FF41';

// ============================================
// Component
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
  const isLowTime = timeRemaining <= 60;
  const isShrinking = zoneWarning;
  const isWarning = zoneWarning;
  const top5 = useMemo(() => leaderboard.slice(0, 5), [leaderboard]);

  // Find player stats from leaderboard
  const playerEntry = useMemo(() => leaderboard.find(e => e.isPlayer), [leaderboard]);
  const playerKills = playerEntry?.kills ?? 0;
  const playerDeaths = playerEntry?.deaths ?? 0;

  // Player rank
  const sortedAll = useMemo(() =>
    [...leaderboard].sort((a, b) => b.kills - a.kills),
    [leaderboard]
  );
  const myRank = useMemo(() => {
    const idx = sortedAll.findIndex(e => e.isPlayer);
    return idx >= 0 ? idx + 1 : leaderboard.length;
  }, [sortedAll, leaderboard.length]);

  return (
    <div className="absolute inset-x-0 top-0 pointer-events-none" style={{ fontFamily: 'monospace', zIndex: 20 }}>

      {/* Top Center: Timer + Phase */}
      <div className="flex justify-center pt-4">
        <div className="flex flex-col items-center gap-1">
          {/* Timer */}
          <div className={`flex items-center gap-2 px-4 py-2 bg-black/60 border ${
            isLowTime ? 'border-red-500 animate-pulse' : 'border-green-500/50'
          }`}>
            <Timer className={`w-5 h-5 ${isLowTime ? 'text-red-400' : 'text-green-400'}`} />
            <span className={`text-2xl font-bold tabular-nums ${
              isLowTime ? 'text-red-400' : 'text-green-400'
            }`}
              style={{
                textShadow: isLowTime
                  ? '0 0 10px rgba(255, 0, 0, 0.5)'
                  : '0 0 10px rgba(0, 255, 65, 0.3)',
              }}
            >
              {timeStr}
            </span>
            {/* Alive count */}
            <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-gray-600">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: MATRIX_GREEN }} />
              <span className="text-sm font-bold" style={{ color: MATRIX_GREEN }}>
                {aliveCount}/{totalCount}
              </span>
            </div>
          </div>

          {/* Safe Zone Status */}
          <div className={`flex items-center gap-2 px-3 py-1 text-xs ${
            isShrinking
              ? 'bg-red-500/80 text-white animate-pulse'
              : isWarning
                ? 'bg-orange-500/80 text-white'
                : 'bg-green-500/50 text-green-100'
          }`}>
            {isShrinking ? (
              <AlertTriangle className="w-3 h-3" />
            ) : (
              <Shield className="w-3 h-3" />
            )}
            <span>{getSafeZoneStatus(isShrinking, isWarning, currentPhase)}</span>
          </div>
        </div>
      </div>

      {/* Top Left: Kill/Death Stats */}
      <div className="absolute top-4 left-4">
        <div className="flex flex-col gap-2 bg-black/60 p-3 border border-gray-600/50">
          <div className="flex items-center gap-2">
            <Skull className="w-4 h-4 text-red-400" />
            <span className="text-white">
              <span className="text-green-400 font-bold">{playerKills}</span>
              <span className="text-gray-400"> / </span>
              <span className="text-red-400">{playerDeaths}</span>
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Trophy className="w-3 h-3 text-yellow-400" />
            <span>Rank #{myRank}</span>
          </div>
        </div>
      </div>

      {/* Top Right: Mini Leaderboard */}
      <div className="absolute top-4 right-4">
        <div className="bg-black/60 p-3 border border-gray-600/50 min-w-[160px]">
          <div className="flex items-center gap-2 mb-2 text-xs text-gray-400">
            <Trophy className="w-3 h-3" />
            <span>LEADERBOARD</span>
          </div>
          <div className="flex flex-col gap-1">
            {top5.map((entry, index) => (
              <div
                key={entry.agentId}
                className={`flex items-center justify-between text-xs ${
                  entry.isPlayer ? 'text-green-400 font-bold' : 'text-gray-300'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className={`w-4 ${
                    index === 0 ? 'text-yellow-400' :
                    index === 1 ? 'text-gray-300' :
                    index === 2 ? 'text-orange-400' :
                    'text-gray-500'
                  }`}>
                    {index + 1}.
                  </span>
                  {/* Color dot */}
                  <div
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor: entry.color,
                      opacity: entry.isAlive ? 1 : 0.3,
                    }}
                  />
                  <span className="truncate max-w-[70px]" style={{
                    textDecoration: entry.isAlive ? 'none' : 'line-through',
                  }}>
                    {entry.isPlayer ? 'YOU' : entry.displayName}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-400">{entry.kills}K</span>
                  <span className="tabular-nums w-8 text-right" style={{ color: 'rgba(0,255,65,0.7)' }}>
                    {entry.score > 999 ? `${(entry.score / 1000).toFixed(1)}k` : entry.score}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Zone DPS warning (when outside) */}
      {playerOutsideZone && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-pulse pointer-events-none">
          <div
            className="px-6 py-3 text-center"
            style={{
              backgroundColor: 'rgba(255, 0, 0, 0.2)',
              border: '2px solid rgba(255, 0, 0, 0.6)',
            }}
          >
            <div className="text-lg font-bold" style={{ color: '#ff4444' }}>
              OUTSIDE SAFE ZONE
            </div>
            <div className="text-sm" style={{ color: 'rgba(255, 100, 100, 0.8)' }}>
              -{zoneDps.toFixed(0)} HP/s
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const ArenaHUD = memo(ArenaHUDInner);
export default ArenaHUD;
