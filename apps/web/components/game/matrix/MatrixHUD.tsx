'use client';

/**
 * MatrixHUD.tsx - v29 Phase 5: In-game HUD
 *
 * Adapted from app_ingame/components/UIOverlay.tsx (game HUD section)
 * - Top: XP bar (full width) + level badge + HP bar + score + menu button
 * - Sub-header: Stage info + timer
 * - Bottom: Weapon slots with lucide icons + cooldown overlay
 * - Special skill button (bottom right)
 * - Auto Hunt button (bottom left)
 * - Boss HP bar (when boss active)
 *
 * Uses WEAPON_DATA for weapon info and WEAPON_ICONS for icon rendering.
 */

import { memo, useMemo } from 'react';
import {
  Timer, Skull, Zap, Menu, X, Terminal,
  Pause as PauseIcon, Clock,
} from 'lucide-react';
import { WEAPON_DATA } from '@/lib/matrix/constants';
import type { WeaponType } from '@/lib/matrix/types';
import { WEAPON_ICONS } from './MatrixLevelUp';

// ============================================
// Props
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
  gameTime: number;
  weaponSlots: WeaponSlot[];
  enemyCount: number;
  autoHuntEnabled: boolean;
  isPaused: boolean;
}

// ============================================
// Constants
// ============================================

const MATRIX_GREEN = '#00FF41';

// ============================================
// Utils
// ============================================

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function formatScore(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

// ============================================
// Component
// ============================================

function MatrixHUDInner({
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
  const healthPercent = maxHealth > 0 ? Math.min(100, (health / maxHealth) * 100) : 0;
  const xpPercent = xpToNext > 0 ? Math.min(100, (xp / xpToNext) * 100) : 0;

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-10" style={{ fontFamily: 'monospace' }}>

      {/* ========================================
          TOP SYSTEM BAR (Survivor.io Style)
          ======================================== */}
      <div className="absolute top-0 left-0 w-full z-40 pointer-events-auto">

        {/* XP Bar (full width, top) */}
        <div className="w-full h-3 bg-slate-200 border-b-2 border-slate-800 relative">
          <div
            className="h-full bg-gradient-to-r from-green-400 to-emerald-500 relative overflow-hidden"
            style={{ width: `${xpPercent}%`, transition: 'width 0.2s linear' }}
          >
            <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.2)25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)50%,rgba(255,255,255,0.2)75%,transparent_75%,transparent)] bg-[length:10px_10px]" />
          </div>
        </div>

        {/* Main header: Level + HP + Score */}
        <div className="max-w-screen-lg mx-auto w-full relative h-14 flex items-center justify-between px-4 mt-2">
          {/* Left: Level badge + HP bar */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* Level badge */}
            <div className="w-10 h-10 flex items-center justify-center bg-amber-400 border-2 border-slate-800 rounded-xl rotate-3 shadow-[2px_2px_0_rgba(0,0,0,0.2)] shrink-0 z-10">
              <span className="text-white text-sm font-black -rotate-3">{level}</span>
            </div>

            {/* HP bar (overlaps level badge slightly) */}
            <div className="flex-1 max-w-[160px] h-6 bg-slate-700 rounded-full border-2 border-slate-800 relative overflow-hidden -ml-3 shadow-sm">
              <div
                className="absolute top-0 bottom-0 left-0 bg-red-500 transition-all duration-300 ease-out"
                style={{
                  width: `calc(16px + (100% - 16px) * ${healthPercent / 100})`,
                  borderRadius: healthPercent >= 100 ? '9999px' : '9999px 0 0 9999px',
                }}
              >
                <div className="absolute inset-x-0 top-0 h-1/2 bg-white/20" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-white text-[10px] font-black">
                  {Math.ceil(Math.min(health, maxHealth))}/{Math.ceil(maxHealth)}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Score */}
          <div className="flex items-center justify-end gap-2 shrink-0">
            <div className="bg-slate-800/80 backdrop-blur px-3 py-1 rounded-full border-2 border-slate-700 flex items-center gap-1.5 shadow-md">
              <span className="text-amber-400 text-xs font-black">$</span>
              <span className="text-white text-xs font-black">{formatScore(score)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-header: Mode info + Timer */}
      <div className="absolute top-[76px] md:top-[80px] left-0 w-full z-30 pointer-events-none">
        <div className="flex items-center justify-between px-4 md:px-6 py-1">
          {/* Left: Mode info + kills */}
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-cyan-400 animate-pulse" />
            <span className="text-cyan-300 text-xs md:text-sm font-black">
              MATRIX
            </span>
            <span className="text-gray-400 text-[10px]">
              <span className="text-red-400 font-bold">{kills}</span> KILLS
            </span>
          </div>
          {/* Right: Timer */}
          <div className="flex items-center gap-1.5">
            <Clock size={14} className="text-cyan-400" />
            <span className="text-cyan-300 text-sm md:text-base tracking-wider font-black">
              {formatTime(gameTime)}
            </span>
          </div>
        </div>
      </div>

      {/* Auto Hunt indicator (bottom left) */}
      <div className="absolute bottom-24 md:bottom-28 left-4 z-30 pointer-events-none">
        <div className={`
          w-14 h-14 rounded-lg border-2 flex flex-col items-center justify-center relative overflow-hidden
          ${autoHuntEnabled
            ? 'bg-green-900 border-green-400 shadow-[0_0_20px_rgba(34,197,94,0.6)]'
            : 'bg-slate-900 border-slate-600'}
        `}>
          {autoHuntEnabled && <div className="absolute inset-0 bg-green-500/20 animate-pulse" />}
          <div className="relative z-10 flex flex-col items-center gap-0.5">
            <Terminal size={24} className={autoHuntEnabled ? 'animate-bounce text-green-300' : 'text-slate-400'} />
            <div className="text-[8px] leading-none text-center text-white">VIBE</div>
          </div>
        </div>
      </div>

      {/* ========================================
          Bottom: Weapon Slots
          ======================================== */}
      <div className="absolute bottom-0 left-0 w-full z-20 pointer-events-none pb-1 px-3 md:px-4">
        <div className="relative w-full h-20 md:h-24 max-w-screen-xl mx-auto flex items-end justify-center">
          <div className="pointer-events-auto w-auto max-w-[calc(100%-140px)] md:max-w-2xl flex justify-center">
            <div className="bg-black/90 p-1 md:p-1.5 border border-gray-700 flex gap-1 overflow-x-auto">
              {weaponSlots.map((slot, _i) => {
                const type = slot.type as WeaponType;
                const data = WEAPON_DATA[type as keyof typeof WEAPON_DATA];
                const Icon = WEAPON_ICONS[type];
                if (!data || slot.level === 0) return null;

                const cdPercent = Math.min(100, slot.cooldownPercent * 100);

                return (
                  <div key={slot.type} className="relative group shrink-0">
                    <div className="w-8 h-8 md:w-11 md:h-11 bg-black/80 border border-gray-600 flex items-center justify-center relative overflow-hidden">
                      {Icon && <Icon size={16} className="md:w-[22px] md:h-[22px]" style={{ color: data.color }} />}
                      {/* Cooldown overlay from bottom */}
                      <div
                        className="absolute bottom-0 left-0 w-full bg-black/70 transition-all duration-100"
                        style={{ height: `${cdPercent}%` }}
                      />
                      {/* Level badge */}
                      <div className="absolute top-0 right-0 bg-black/90 text-[6px] md:text-[8px] px-0.5 text-gray-400 border-b border-l border-gray-600">
                        {slot.level}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom hint */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 pb-0.5">
        <span className="text-[10px] text-white/20">ESC Pause</span>
      </div>

      {/* Enemy count (bottom right, subtle) */}
      <div className="absolute bottom-2 right-3 z-10">
        <span className="text-[10px] text-gray-600" style={{ fontFamily: 'monospace' }}>
          Enemies: {enemyCount}
        </span>
      </div>

      {/* Paused overlay */}
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

const MatrixHUD = memo(MatrixHUDInner);
export default MatrixHUD;
