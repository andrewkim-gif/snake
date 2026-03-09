'use client';

/**
 * MatrixResult.tsx - v29 Phase 5: Game Over / Arena Result Screen
 *
 * Adapted from app_ingame/components/arena/ArenaResultScreen.tsx
 * - Final standings with rank, kills, deaths
 * - Rewards breakdown (base score, rank bonus, kill bonus)
 * - Weapon inventory
 * - Retry / Exit to Lobby buttons
 * - Keyboard shortcuts (Enter = retry, Escape = exit)
 *
 * Matrix green (#00FF41) theme.
 *
 * v29b: All Tailwind className converted to inline styles.
 */

import React, { useCallback, useEffect, memo } from 'react';
import {
  Trophy,
  Target,
  Skull,
  Clock,
  Star,
  Crown,
  Coins,
  ArrowRight,
} from 'lucide-react';

// ============================================
// Props (backward-compatible with MatrixApp)
// ============================================

export interface MatrixResultProps {
  survived: boolean;
  survivalTime: number;
  kills: number;
  score: number;
  level: number;
  weapons: string[];
  onRetry: () => void;
  onExitToLobby: () => void;
}

// ============================================
// Constants
// ============================================

const MATRIX_GREEN = '#00FF41';

// Weapon display names
const WEAPON_NAMES: Record<string, string> = {
  wand: 'API Call',
  knife: 'Git Push',
  whip: 'Hand Coding',
  axe: 'Server Throw',
  bow: 'GraphQL',
  bible: 'Documentation',
  garlic: 'Debug Aura',
  pool: 'Firewall Zone',
  lightning: 'Claude Assist',
  beam: 'Stack Trace',
  laser: 'Recursive Loop',
  ping: 'Ping Packet',
  shard: 'Code Snippet',
  fork: 'Git Fork',
  punch: 'Keyboard Punch',
  sword: 'Sword',
  bridge: 'Async/Await',
  phishing: 'MCP Server',
  stablecoin: 'Type Safety',
  airdrop: 'NPM Install',
  genesis: 'System Crash',
  aggregator: 'Auto Import',
  oracle: 'Code Review',
  focus: 'Deep Work',
  overclock: 'Overclock',
};

// ============================================
// Utils
// ============================================

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getRankSuffix(rank: number): string {
  if (rank === 1) return 'st';
  if (rank === 2) return 'nd';
  if (rank === 3) return 'rd';
  return 'th';
}

// ============================================
// Component
// ============================================

function MatrixResultInner({
  survived,
  survivalTime,
  kills,
  score,
  level,
  weapons,
  onRetry,
  onExitToLobby,
}: MatrixResultProps) {
  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter') onRetry();
      else if (e.key === 'Escape') onExitToLobby();
    },
    [onRetry, onExitToLobby],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Calculate rewards
  const baseCredits = score;
  const killBonus = kills * 20;
  const timeBonus = Math.floor(survivalTime / 60) * 50;
  const totalCredits = baseCredits + killBonus + timeBonus;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 50,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.9)',
      fontFamily: 'monospace',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 672,
        marginLeft: 16,
        marginRight: 16,
        padding: 24,
        background: 'linear-gradient(to bottom, #111827, #030712)',
        border: '1px solid #374151',
      }}>

        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          {survived ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <Crown style={{ width: 64, height: 64, color: '#facc15' }} />
              <h1 style={{ fontSize: 36, fontWeight: 'bold', color: MATRIX_GREEN, margin: 0 }}>
                SURVIVED
              </h1>
              <p style={{ fontSize: 12, color: '#6b7280', letterSpacing: '0.05em', margin: 0 }}>
                YOU HAVE ESCAPED THE MATRIX
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <Skull style={{ width: 48, height: 48, color: '#f87171' }} />
              <h1 style={{ fontSize: 30, fontWeight: 'bold', color: '#f87171', margin: 0 }}>
                GAME OVER
              </h1>
              <p style={{ fontSize: 12, color: '#6b7280', letterSpacing: '0.05em', margin: 0 }}>
                CONNECTION TERMINATED
              </p>
            </div>
          )}
        </div>

        {/* My Stats */}
        <div style={{
          backgroundColor: 'rgba(0,0,0,0.4)',
          padding: 16,
          marginBottom: 24,
          border: `1px solid ${survived ? `${MATRIX_GREEN}50` : 'rgba(239,68,68,0.3)'}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 'bold', color: MATRIX_GREEN }}>
                  Level {level}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 'bold', color: '#4ade80' }}>{kills}</div>
                <div style={{ fontSize: 12, color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Target style={{ width: 12, height: 12 }} /> Kills
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 'bold', color: '#22d3ee' }}>{formatTime(survivalTime)}</div>
                <div style={{ fontSize: 12, color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock style={{ width: 12, height: 12 }} /> Time
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 'bold', color: '#facc15' }}>{score.toLocaleString()}</div>
                <div style={{ fontSize: 12, color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Star style={{ width: 12, height: 12 }} /> Score
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Weapons Acquired */}
        {weapons.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 14, fontWeight: 'bold', color: '#9ca3af', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Trophy style={{ width: 16, height: 16 }} /> WEAPONS ACQUIRED
            </h2>
            <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: 12 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {weapons.map((w, i) => (
                  <span
                    key={`${w}-${i}`}
                    style={{
                      fontSize: 10,
                      paddingLeft: 10,
                      paddingRight: 10,
                      paddingTop: 4,
                      paddingBottom: 4,
                      letterSpacing: '0.05em',
                      fontWeight: 'bold',
                      color: MATRIX_GREEN,
                      backgroundColor: 'rgba(0, 255, 65, 0.08)',
                      border: '1px solid rgba(0, 255, 65, 0.2)',
                    }}
                  >
                    {WEAPON_NAMES[w] || w}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Rewards */}
        <div style={{
          background: 'linear-gradient(to right, rgba(234,179,8,0.1), rgba(249,115,22,0.1))',
          padding: 16,
          marginBottom: 24,
          border: '1px solid rgba(234,179,8,0.3)',
        }}>
          <h2 style={{ fontSize: 14, fontWeight: 'bold', color: '#facc15', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Star style={{ width: 16, height: 16 }} /> REWARDS
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 16,
            textAlign: 'center',
          }}>
            <div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>Base Score</div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#22d3ee' }}>+{baseCredits}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>Kill Bonus</div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#4ade80' }}>+{killBonus}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>Time Bonus</div>
              <div style={{ fontSize: 18, fontWeight: 'bold', color: '#a855f7' }}>+{timeBonus}</div>
            </div>
          </div>
          <div style={{
            marginTop: 16,
            paddingTop: 12,
            borderTop: '1px solid rgba(234,179,8,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}>
            <Coins style={{ width: 20, height: 20, color: '#facc15' }} />
            <span style={{ fontSize: 24, fontWeight: 'bold', color: '#facc15' }}>+{totalCredits}</span>
            <span style={{ fontSize: 14, color: '#9ca3af' }}>Credits</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 16 }}>
          <button
            onClick={onExitToLobby}
            style={{
              flex: 1,
              paddingTop: 12,
              paddingBottom: 12,
              paddingLeft: 24,
              paddingRight: 24,
              fontWeight: 'bold',
              transition: 'all 0.2s',
              pointerEvents: 'auto',
              cursor: 'pointer',
              color: '#999',
              backgroundColor: 'transparent',
              border: '1px solid rgba(255,255,255,0.15)',
            }}
          >
            EXIT TO LOBBY
          </button>
          <button
            onClick={onRetry}
            style={{
              flex: 1,
              paddingTop: 12,
              paddingBottom: 12,
              paddingLeft: 24,
              paddingRight: 24,
              fontWeight: 'bold',
              transition: 'all 0.2s',
              pointerEvents: 'auto',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              color: '#000',
              backgroundColor: MATRIX_GREEN,
              border: `1px solid ${MATRIX_GREEN}`,
            }}
          >
            RETRY
            <ArrowRight style={{ width: 20, height: 20 }} />
          </button>
        </div>

        {/* Keyboard hints */}
        <p style={{ fontSize: 10, color: '#4b5563', letterSpacing: '0.05em', textAlign: 'center', marginTop: 12 }}>
          ENTER to retry | ESC to exit
        </p>
      </div>
    </div>
  );
}

const MatrixResult = memo(MatrixResultInner);
export default MatrixResult;
