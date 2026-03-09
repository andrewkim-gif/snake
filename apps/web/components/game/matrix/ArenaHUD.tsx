'use client';

/**
 * ArenaHUD.tsx - v32 Phase 3: Arena Mode In-Game HUD (Apex Tactical Redesign)
 *
 * Adapted from app_ingame/components/arena/ArenaHUD.tsx
 * - Timer + Phase indicator
 * - Kill/Death stats
 * - Safe zone status with shrink warnings
 * - Mini leaderboard (top 5)
 *
 * v32: Full Apex tactical redesign — SK tokens, headingFont/bodyFont, borderRadius:0, glassBg.
 *      No monospace, no #00FF41.
 */

import React, { memo, useMemo } from 'react';
import {
  Timer,
  Shield,
  Skull,
  AlertTriangle,
  Trophy,
} from 'lucide-react';
import { SK, headingFont, bodyFont } from '@/lib/sketch-ui';

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

function getPhaseLabel(isShrinking: boolean, isWarning: boolean, phase: number): string {
  if (isShrinking) return 'ZONE SHRINKING';
  if (isWarning) return `PHASE ${phase} WARNING`;
  return `SAFE ZONE`;
}

function getPhaseColor(isShrinking: boolean, isWarning: boolean): string {
  if (isShrinking) return SK.red;
  if (isWarning) return SK.orange;
  return SK.green;
}

// ============================================
// Shared panel style
// ============================================

const panelStyle: React.CSSProperties = {
  background: SK.glassBg,
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: `1px solid ${SK.border}`,
  borderRadius: 0,
};

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

  const phaseLabel = getPhaseLabel(isShrinking, isWarning, currentPhase);
  const phaseColor = getPhaseColor(isShrinking, isWarning);

  return (
    <div style={{
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      pointerEvents: 'none',
      fontFamily: bodyFont,
      zIndex: 20,
    }}>

      {/* ─── Top Center: Timer + Alive + Phase ─── */}
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          {/* Timer + Alive */}
          <div style={{
            ...panelStyle,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            paddingLeft: 20,
            paddingRight: 20,
            paddingTop: 10,
            paddingBottom: 10,
          }}>
            <Timer style={{
              width: 18,
              height: 18,
              color: isLowTime ? SK.red : SK.textSecondary,
            }} />
            <span style={{
              fontFamily: headingFont,
              fontSize: 24,
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              color: isLowTime ? SK.red : SK.textPrimary,
              letterSpacing: '0.05em',
            }}>
              {timeStr}
            </span>

            {/* Divider */}
            <div style={{
              width: 1,
              height: 20,
              background: SK.border,
            }} />

            {/* Alive count */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                fontSize: 12,
                fontWeight: 600,
                color: SK.textSecondary,
                letterSpacing: '0.08em',
              }}>
                ALIVE
              </span>
              <span style={{
                fontFamily: headingFont,
                fontSize: 16,
                fontWeight: 700,
                color: SK.green,
              }}>
                {aliveCount}
              </span>
              <span style={{ fontSize: 12, color: SK.textMuted }}>/</span>
              <span style={{
                fontSize: 14,
                color: SK.textMuted,
              }}>
                {totalCount}
              </span>
            </div>
          </div>

          {/* Phase status badge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            paddingLeft: 14,
            paddingRight: 14,
            paddingTop: 4,
            paddingBottom: 4,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.1em',
            color: phaseColor,
            background: `${phaseColor}15`,
            border: `1px solid ${phaseColor}40`,
            borderRadius: 0,
          }}>
            {isShrinking ? (
              <AlertTriangle style={{ width: 12, height: 12 }} />
            ) : (
              <Shield style={{ width: 12, height: 12 }} />
            )}
            <span>{phaseLabel}</span>
          </div>
        </div>
      </div>

      {/* ─── Top Left: Kill/Death + Rank ─── */}
      <div style={{ position: 'absolute', top: 16, left: 16 }}>
        <div style={{
          ...panelStyle,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Skull style={{ width: 16, height: 16, color: SK.accent }} />
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ color: SK.green, fontWeight: 700, fontSize: 16, fontFamily: headingFont }}>{playerKills}</span>
              <span style={{ color: SK.textMuted, fontSize: 12 }}>/</span>
              <span style={{ color: SK.red, fontWeight: 600, fontSize: 14 }}>{playerDeaths}</span>
            </span>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            color: SK.textSecondary,
          }}>
            <Trophy style={{ width: 12, height: 12, color: SK.gold }} />
            <span style={{ letterSpacing: '0.05em' }}>RANK</span>
            <span style={{
              fontFamily: headingFont,
              fontWeight: 700,
              color: SK.accent,
            }}>
              #{myRank}
            </span>
          </div>
        </div>
      </div>

      {/* ─── Top Right: Mini Leaderboard ─── */}
      <div style={{ position: 'absolute', top: 16, right: 16 }}>
        <div style={{
          ...panelStyle,
          padding: 12,
          minWidth: 180,
        }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 8,
            paddingBottom: 6,
            borderBottom: `1px solid ${SK.border}`,
          }}>
            <Trophy style={{ width: 12, height: 12, color: SK.gold }} />
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              color: SK.textSecondary,
              letterSpacing: '0.1em',
            }}>
              LEADERBOARD
            </span>
          </div>

          {/* Entries */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {top5.map((entry, index) => {
              const isMe = entry.isPlayer;
              const rankColor = index === 0 ? SK.gold
                : index === 1 ? SK.textSecondary
                : index === 2 ? SK.orange
                : SK.textMuted;

              return (
                <div
                  key={entry.agentId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: 12,
                    padding: isMe ? '2px 4px' : undefined,
                    background: isMe ? SK.accentBg : undefined,
                    borderLeft: isMe ? `2px solid ${SK.accent}` : '2px solid transparent',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      width: 16,
                      fontWeight: 600,
                      color: rankColor,
                      fontFamily: headingFont,
                    }}>
                      {index + 1}.
                    </span>
                    {/* Color dot */}
                    <div style={{
                      width: 6,
                      height: 6,
                      flexShrink: 0,
                      backgroundColor: entry.color,
                      opacity: entry.isAlive ? 1 : 0.3,
                      borderRadius: 0,
                    }} />
                    <span style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: 70,
                      color: isMe ? SK.accent : SK.textSecondary,
                      fontWeight: isMe ? 700 : 400,
                      textDecoration: entry.isAlive ? 'none' : 'line-through',
                    }}>
                      {isMe ? 'YOU' : entry.displayName}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      color: isMe ? SK.accent : SK.green,
                      fontWeight: 600,
                      fontSize: 11,
                    }}>
                      {entry.kills}K
                    </span>
                    <span style={{
                      fontVariantNumeric: 'tabular-nums',
                      width: 32,
                      textAlign: 'right',
                      color: SK.textMuted,
                      fontSize: 11,
                    }}>
                      {entry.score > 999 ? `${(entry.score / 1000).toFixed(1)}k` : entry.score}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── Bottom: Zone DPS warning (outside zone) ─── */}
      {playerOutsideZone && (
        <div style={{
          position: 'fixed',
          bottom: 96,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 50,
          pointerEvents: 'none',
        }}>
          <div style={{
            paddingLeft: 24,
            paddingRight: 24,
            paddingTop: 12,
            paddingBottom: 12,
            textAlign: 'center',
            background: `${SK.red}30`,
            border: `2px solid ${SK.red}`,
            borderRadius: 0,
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              marginBottom: 4,
            }}>
              <AlertTriangle style={{ width: 18, height: 18, color: SK.red }} />
              <span style={{
                fontFamily: headingFont,
                fontSize: 18,
                fontWeight: 700,
                color: SK.red,
                letterSpacing: '0.1em',
              }}>
                OUTSIDE SAFE ZONE
              </span>
            </div>
            <div style={{
              fontSize: 14,
              fontWeight: 600,
              color: SK.redLight,
            }}>
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
