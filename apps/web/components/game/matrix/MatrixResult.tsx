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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90" style={{ fontFamily: 'monospace' }}>
      <div className="w-full max-w-2xl mx-4 p-6 bg-gradient-to-b from-gray-900 to-gray-950 border border-gray-700">

        {/* Title */}
        <div className="text-center mb-6">
          {survived ? (
            <div className="flex flex-col items-center gap-2">
              <Crown className="w-16 h-16 text-yellow-400 animate-pulse" />
              <h1 className="text-4xl font-bold" style={{ color: MATRIX_GREEN }}>
                SURVIVED
              </h1>
              <p className="text-xs text-gray-500 tracking-wider">
                YOU HAVE ESCAPED THE MATRIX
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Skull className="w-12 h-12 text-red-400" />
              <h1 className="text-3xl font-bold text-red-400">
                GAME OVER
              </h1>
              <p className="text-xs text-gray-500 tracking-wider">
                CONNECTION TERMINATED
              </p>
            </div>
          )}
        </div>

        {/* My Stats */}
        <div className="bg-black/40 p-4 mb-6 border" style={{ borderColor: survived ? `${MATRIX_GREEN}50` : 'rgba(239,68,68,0.3)' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div>
                <div className="text-lg font-bold" style={{ color: MATRIX_GREEN }}>
                  Level {level}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">{kills}</div>
                <div className="text-xs text-gray-400 flex items-center gap-1">
                  <Target className="w-3 h-3" /> Kills
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-cyan-400">{formatTime(survivalTime)}</div>
                <div className="text-xs text-gray-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Time
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-400">{score.toLocaleString()}</div>
                <div className="text-xs text-gray-400 flex items-center gap-1">
                  <Star className="w-3 h-3" /> Score
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Weapons Acquired */}
        {weapons.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-bold text-gray-400 mb-2 flex items-center gap-2">
              <Trophy className="w-4 h-4" /> WEAPONS ACQUIRED
            </h2>
            <div className="bg-black/30 p-3">
              <div className="flex flex-wrap gap-2">
                {weapons.map((w, i) => (
                  <span
                    key={`${w}-${i}`}
                    className="text-[10px] px-2.5 py-1 tracking-wider font-bold"
                    style={{
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
        <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 p-4 mb-6 border border-yellow-500/30">
          <h2 className="text-sm font-bold text-yellow-400 mb-3 flex items-center gap-2">
            <Star className="w-4 h-4" /> REWARDS
          </h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xs text-gray-400 mb-1">Base Score</div>
              <div className="text-lg font-bold text-cyan-400">+{baseCredits}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">Kill Bonus</div>
              <div className="text-lg font-bold text-green-400">+{killBonus}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">Time Bonus</div>
              <div className="text-lg font-bold text-purple-400">+{timeBonus}</div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-yellow-500/20 flex items-center justify-center gap-2">
            <Coins className="w-5 h-5 text-yellow-400" />
            <span className="text-2xl font-bold text-yellow-400">+{totalCredits}</span>
            <span className="text-sm text-gray-400">Credits</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={onExitToLobby}
            className="flex-1 py-3 px-6 font-bold transition-all hover:scale-[1.02] active:scale-[0.98] pointer-events-auto cursor-pointer"
            style={{
              color: '#999',
              backgroundColor: 'transparent',
              border: '1px solid rgba(255,255,255,0.15)',
            }}
          >
            EXIT TO LOBBY
          </button>
          <button
            onClick={onRetry}
            className="flex-1 py-3 px-6 font-bold transition-all hover:scale-[1.02] active:scale-[0.98] pointer-events-auto cursor-pointer flex items-center justify-center gap-2"
            style={{
              color: '#000',
              backgroundColor: MATRIX_GREEN,
              border: `1px solid ${MATRIX_GREEN}`,
            }}
          >
            RETRY
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

        {/* Keyboard hints */}
        <p className="text-[10px] text-gray-600 tracking-wider text-center mt-3">
          ENTER to retry | ESC to exit
        </p>
      </div>
    </div>
  );
}

const MatrixResult = memo(MatrixResultInner);
export default MatrixResult;
