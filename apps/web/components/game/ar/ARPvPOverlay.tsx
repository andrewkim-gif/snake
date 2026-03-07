'use client';

/**
 * ARPvPOverlay — PvP Phase UI Overlay (v18 Phase 5)
 *
 * Displays:
 * - PvP phase transition warning (pvp_warning phase)
 * - Faction kill counts during PvP
 * - Sovereignty status mini-UI
 * - Arena shrink indicator (current radius)
 * - Boss HP bar during settlement phase
 * - PvP kill feed
 */

import { useEffect, useState } from 'react';
import type {
  ARPhase,
  ARFactionPvPScoreNet,
  AREnemyNet,
} from '@/lib/3d/ar-types';

// ── Types ────────────────────────────────────────────────────

interface ARPvPOverlayProps {
  phase: ARPhase;
  timer: number;
  pvpRadius?: number;
  baseRadius?: number;
  factionScores?: ARFactionPvPScoreNet[];
  playerFaction?: string;
  enemies?: AREnemyNet[];
  killFeed?: PvPKillFeedEntry[];
}

export interface PvPKillFeedEntry {
  id: string;
  killerName: string;
  victimName: string;
  killerFaction: string;
  victimFaction: string;
  timestamp: number;
}

// ── Faction Colors ───────────────────────────────────────────

const FACTION_COLORS: Record<string, string> = {
  alpha: '#F44336',
  bravo: '#2196F3',
  charlie: '#4CAF50',
  delta: '#FF9800',
  echo: '#9C27B0',
};

function getFactionColor(factionId: string): string {
  const lower = factionId.toLowerCase();
  return FACTION_COLORS[lower] || '#E8E0D4';
}

// ── Component ────────────────────────────────────────────────

export function ARPvPOverlay({
  phase,
  timer,
  pvpRadius,
  baseRadius = 50,
  factionScores,
  playerFaction,
  enemies,
  killFeed,
}: ARPvPOverlayProps) {
  const [warningFlash, setWarningFlash] = useState(false);
  const [showBossHP, setShowBossHP] = useState(false);

  // Flash effect during PvP warning
  useEffect(() => {
    if (phase !== 'pvp_warning') {
      setWarningFlash(false);
      return;
    }
    const interval = setInterval(() => {
      setWarningFlash((prev) => !prev);
    }, 500);
    return () => clearInterval(interval);
  }, [phase]);

  // Boss detection during settlement
  useEffect(() => {
    if (phase === 'settlement' && enemies) {
      const boss = enemies.find((e) => e.isMiniboss && e.minibossType === 'the_arena');
      setShowBossHP(!!boss);
    } else {
      setShowBossHP(false);
    }
  }, [phase, enemies]);

  const isPvPActive = phase === 'pvp' || phase === 'pvp_warning';
  const isSettlement = phase === 'settlement';

  // Find boss for HP bar
  const boss = enemies?.find((e) => e.isMiniboss && e.minibossType === 'the_arena');
  const bossHPRatio = boss ? boss.hp / boss.maxHp : 0;

  // Sort faction scores by score descending
  const sortedScores = [...(factionScores || [])].sort((a, b) => b.score - a.score);

  // Arena shrink progress
  const shrinkPct = pvpRadius && baseRadius > 0
    ? Math.round((pvpRadius / baseRadius) * 100)
    : 100;

  return (
    <>
      {/* PvP Warning Banner */}
      {phase === 'pvp_warning' && (
        <div
          style={{
            position: 'absolute',
            top: 60,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 60,
            pointerEvents: 'none',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontFamily: '"Black Ops One", monospace',
              fontSize: 24,
              color: warningFlash ? '#FF9800' : '#F44336',
              letterSpacing: 3,
              textShadow: '0 2px 8px rgba(244,67,54,0.5)',
              transition: 'color 0.3s',
            }}
          >
            PvP ARENA INCOMING
          </div>
          <div
            style={{
              fontFamily: '"Rajdhani", sans-serif',
              fontSize: 14,
              color: '#E8E0D4',
              marginTop: 4,
              opacity: 0.8,
            }}
          >
            Prepare for faction combat in {Math.ceil(timer)}s
          </div>
        </div>
      )}

      {/* PvP Active: Arena Shrink + Faction Scoreboard */}
      {isPvPActive && (
        <>
          {/* Arena shrink indicator (top right) */}
          <div
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              zIndex: 55,
              pointerEvents: 'none',
              fontFamily: '"Rajdhani", sans-serif',
              color: '#E8E0D4',
              textAlign: 'right',
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.7, letterSpacing: 1 }}>
              ARENA
            </div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: shrinkPct < 50 ? '#F44336' : shrinkPct < 75 ? '#FF9800' : '#4CAF50',
              }}
            >
              {shrinkPct}%
            </div>
            {/* Visual shrink bar */}
            <div
              style={{
                width: 80,
                height: 4,
                backgroundColor: 'rgba(255,255,255,0.1)',
                borderRadius: 2,
                marginTop: 4,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${shrinkPct}%`,
                  height: '100%',
                  backgroundColor: shrinkPct < 50 ? '#F44336' : '#4CAF50',
                  transition: 'width 1s linear',
                }}
              />
            </div>
          </div>

          {/* Faction Scoreboard (right side) */}
          {sortedScores.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: 90,
                right: 16,
                zIndex: 55,
                pointerEvents: 'none',
                fontFamily: '"Rajdhani", sans-serif',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: '#E8E0D4',
                  opacity: 0.6,
                  letterSpacing: 1,
                  marginBottom: 6,
                  textAlign: 'right',
                }}
              >
                FACTION SCORES
              </div>
              {sortedScores.map((fs) => {
                const isPlayerFaction = fs.factionId === playerFaction;
                const fColor = getFactionColor(fs.factionId);
                return (
                  <div
                    key={fs.factionId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: 8,
                      marginBottom: 3,
                      padding: '2px 8px',
                      borderRadius: 3,
                      backgroundColor: isPlayerFaction
                        ? 'rgba(255,255,255,0.08)'
                        : 'transparent',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        color: fColor,
                        fontWeight: isPlayerFaction ? 700 : 400,
                        textTransform: 'uppercase',
                      }}
                    >
                      {fs.factionId.slice(0, 3).toUpperCase()}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: '#CC9933',
                        minWidth: 20,
                        textAlign: 'right',
                      }}
                    >
                      {fs.pvpKills}K
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        color: '#E8E0D4',
                        fontWeight: 600,
                        minWidth: 30,
                        textAlign: 'right',
                      }}
                    >
                      {fs.score}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Settlement Phase: Boss HP Bar */}
      {isSettlement && showBossHP && boss && (
        <div
          style={{
            position: 'absolute',
            top: 60,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 60,
            pointerEvents: 'none',
            textAlign: 'center',
            width: 400,
          }}
        >
          {/* Boss name */}
          <div
            style={{
              fontFamily: '"Black Ops One", monospace',
              fontSize: 16,
              color: '#FFD700',
              letterSpacing: 2,
              marginBottom: 6,
              textShadow: '0 2px 8px rgba(255,215,0,0.3)',
            }}
          >
            THE ARENA
          </div>

          {/* Boss HP bar */}
          <div
            style={{
              width: '100%',
              height: 12,
              backgroundColor: 'rgba(0,0,0,0.6)',
              borderRadius: 6,
              overflow: 'hidden',
              border: '1px solid rgba(255,215,0,0.3)',
            }}
          >
            <div
              style={{
                width: `${bossHPRatio * 100}%`,
                height: '100%',
                backgroundColor: bossHPRatio > 0.5 ? '#F44336' : bossHPRatio > 0.25 ? '#FF9800' : '#4CAF50',
                transition: 'width 0.3s',
              }}
            />
          </div>
          <div
            style={{
              fontSize: 11,
              color: '#888',
              marginTop: 2,
              fontFamily: '"Rajdhani", sans-serif',
            }}
          >
            {Math.ceil(boss.hp).toLocaleString()} / {Math.ceil(boss.maxHp).toLocaleString()}
          </div>

          {/* Cooperative message */}
          <div
            style={{
              fontFamily: '"Rajdhani", sans-serif',
              fontSize: 13,
              color: '#4CAF50',
              marginTop: 8,
              opacity: 0.8,
            }}
          >
            ALL FACTIONS COOPERATE — DEFEAT THE BOSS
          </div>
        </div>
      )}

      {/* PvP Kill Feed (bottom-right) */}
      {isPvPActive && killFeed && killFeed.length > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: 100,
            right: 16,
            zIndex: 55,
            pointerEvents: 'none',
            fontFamily: '"Rajdhani", sans-serif',
            maxHeight: 120,
            overflow: 'hidden',
          }}
        >
          {killFeed.slice(-5).map((entry) => (
            <div
              key={entry.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                marginBottom: 2,
                fontSize: 11,
                opacity: 0.8,
              }}
            >
              <span style={{ color: getFactionColor(entry.killerFaction), fontWeight: 600 }}>
                {entry.killerName}
              </span>
              <span style={{ color: '#666' }}>&gt;</span>
              <span style={{ color: getFactionColor(entry.victimFaction) }}>
                {entry.victimName}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* PvP Phase Active Red Border Vignette */}
      {phase === 'pvp' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 40,
            boxShadow: 'inset 0 0 80px rgba(244,67,54,0.15)',
          }}
        />
      )}
    </>
  );
}
