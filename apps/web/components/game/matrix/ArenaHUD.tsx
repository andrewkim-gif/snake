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
 *
 * v29b: All Tailwind className converted to inline styles.
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
    <div style={{
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      pointerEvents: 'none',
      fontFamily: 'monospace',
      zIndex: 20,
    }}>

      {/* Top Center: Timer + Phase */}
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          {/* Timer */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            paddingLeft: 16,
            paddingRight: 16,
            paddingTop: 8,
            paddingBottom: 8,
            backgroundColor: 'rgba(0,0,0,0.6)',
            border: `1px solid ${isLowTime ? '#ef4444' : 'rgba(34,197,94,0.5)'}`,
          }}>
            <Timer style={{ width: 20, height: 20, color: isLowTime ? '#f87171' : '#4ade80' }} />
            <span
              style={{
                fontSize: 24,
                fontWeight: 'bold',
                fontVariantNumeric: 'tabular-nums',
                color: isLowTime ? '#f87171' : '#4ade80',
                textShadow: isLowTime
                  ? '0 0 10px rgba(255, 0, 0, 0.5)'
                  : '0 0 10px rgba(0, 255, 65, 0.3)',
              }}
            >
              {timeStr}
            </span>
            {/* Alive count */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginLeft: 8,
              paddingLeft: 8,
              borderLeft: '1px solid #4b5563',
            }}>
              <div style={{ width: 8, height: 8, borderRadius: 9999, backgroundColor: MATRIX_GREEN }} />
              <span style={{ fontSize: 14, fontWeight: 'bold', color: MATRIX_GREEN }}>
                {aliveCount}/{totalCount}
              </span>
            </div>
          </div>

          {/* Safe Zone Status */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            paddingLeft: 12,
            paddingRight: 12,
            paddingTop: 4,
            paddingBottom: 4,
            fontSize: 12,
            ...(isShrinking
              ? { backgroundColor: 'rgba(239,68,68,0.8)', color: 'white' }
              : isWarning
                ? { backgroundColor: 'rgba(249,115,22,0.8)', color: 'white' }
                : { backgroundColor: 'rgba(34,197,94,0.5)', color: '#dcfce7' }
            ),
          }}>
            {isShrinking ? (
              <AlertTriangle style={{ width: 12, height: 12 }} />
            ) : (
              <Shield style={{ width: 12, height: 12 }} />
            )}
            <span>{getSafeZoneStatus(isShrinking, isWarning, currentPhase)}</span>
          </div>
        </div>
      </div>

      {/* Top Left: Kill/Death Stats */}
      <div style={{ position: 'absolute', top: 16, left: 16 }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          backgroundColor: 'rgba(0,0,0,0.6)',
          padding: 12,
          border: '1px solid rgba(75,85,99,0.5)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Skull style={{ width: 16, height: 16, color: '#f87171' }} />
            <span style={{ color: 'white' }}>
              <span style={{ color: '#4ade80', fontWeight: 'bold' }}>{playerKills}</span>
              <span style={{ color: '#9ca3af' }}> / </span>
              <span style={{ color: '#f87171' }}>{playerDeaths}</span>
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#9ca3af' }}>
            <Trophy style={{ width: 12, height: 12, color: '#facc15' }} />
            <span>Rank #{myRank}</span>
          </div>
        </div>
      </div>

      {/* Top Right: Mini Leaderboard */}
      <div style={{ position: 'absolute', top: 16, right: 16 }}>
        <div style={{
          backgroundColor: 'rgba(0,0,0,0.6)',
          padding: 12,
          border: '1px solid rgba(75,85,99,0.5)',
          minWidth: 160,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 8,
            fontSize: 12,
            color: '#9ca3af',
          }}>
            <Trophy style={{ width: 12, height: 12 }} />
            <span>LEADERBOARD</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {top5.map((entry, index) => (
              <div
                key={entry.agentId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 12,
                  color: entry.isPlayer ? '#4ade80' : '#d1d5db',
                  fontWeight: entry.isPlayer ? 'bold' : 'normal',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    width: 16,
                    color: index === 0 ? '#facc15'
                      : index === 1 ? '#d1d5db'
                      : index === 2 ? '#fb923c'
                      : '#6b7280',
                  }}>
                    {index + 1}.
                  </span>
                  {/* Color dot */}
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 9999,
                      flexShrink: 0,
                      backgroundColor: entry.color,
                      opacity: entry.isAlive ? 1 : 0.3,
                    }}
                  />
                  <span style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: 70,
                    textDecoration: entry.isAlive ? 'none' : 'line-through',
                  }}>
                    {entry.isPlayer ? 'YOU' : entry.displayName}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#4ade80' }}>{entry.kills}K</span>
                  <span style={{
                    fontVariantNumeric: 'tabular-nums',
                    width: 32,
                    textAlign: 'right',
                    color: 'rgba(0,255,65,0.7)',
                  }}>
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
        <div style={{
          position: 'fixed',
          bottom: 96,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 50,
          pointerEvents: 'none',
        }}>
          <div
            style={{
              paddingLeft: 24,
              paddingRight: 24,
              paddingTop: 12,
              paddingBottom: 12,
              textAlign: 'center',
              backgroundColor: 'rgba(255, 0, 0, 0.2)',
              border: '2px solid rgba(255, 0, 0, 0.6)',
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 'bold', color: '#ff4444' }}>
              OUTSIDE SAFE ZONE
            </div>
            <div style={{ fontSize: 14, color: 'rgba(255, 100, 100, 0.8)' }}>
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
