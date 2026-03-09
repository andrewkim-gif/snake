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
 *
 * v29b: All Tailwind className converted to inline styles.
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
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      pointerEvents: 'none',
      userSelect: 'none',
      zIndex: 10,
      fontFamily: 'monospace',
    }}>

      {/* ========================================
          TOP SYSTEM BAR (Survivor.io Style)
          ======================================== */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        zIndex: 40,
        pointerEvents: 'auto',
      }}>

        {/* XP Bar (full width, top) */}
        <div style={{
          width: '100%',
          height: 12,
          backgroundColor: '#e2e8f0',
          borderBottom: '2px solid #1e293b',
          position: 'relative',
        }}>
          <div
            style={{
              height: '100%',
              background: 'linear-gradient(to right, #4ade80, #10b981)',
              position: 'relative',
              overflow: 'hidden',
              width: `${xpPercent}%`,
              transition: 'width 0.2s linear',
            }}
          >
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundImage: 'linear-gradient(45deg,rgba(255,255,255,0.2)25%,transparent 25%,transparent 50%,rgba(255,255,255,0.2)50%,rgba(255,255,255,0.2)75%,transparent 75%,transparent)',
              backgroundSize: '10px 10px',
            }} />
          </div>
        </div>

        {/* Main header: Level + HP + Score */}
        <div style={{
          maxWidth: 1024,
          marginLeft: 'auto',
          marginRight: 'auto',
          width: '100%',
          position: 'relative',
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingLeft: 16,
          paddingRight: 16,
          marginTop: 8,
        }}>
          {/* Left: Level badge + HP bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
            {/* Level badge */}
            <div style={{
              width: 40,
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#fbbf24',
              border: '2px solid #1e293b',
              borderRadius: 12,
              transform: 'rotate(3deg)',
              boxShadow: '2px 2px 0 rgba(0,0,0,0.2)',
              flexShrink: 0,
              zIndex: 10,
            }}>
              <span style={{ color: 'white', fontSize: 14, fontWeight: 900, transform: 'rotate(-3deg)' }}>{level}</span>
            </div>

            {/* HP bar (overlaps level badge slightly) */}
            <div style={{
              flex: 1,
              maxWidth: 160,
              height: 24,
              backgroundColor: '#334155',
              borderRadius: 9999,
              border: '2px solid #1e293b',
              position: 'relative',
              overflow: 'hidden',
              marginLeft: -12,
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            }}>
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: 0,
                  backgroundColor: '#ef4444',
                  transition: 'all 0.3s ease-out',
                  width: `calc(16px + (100% - 16px) * ${healthPercent / 100})`,
                  borderRadius: healthPercent >= 100 ? 9999 : '9999px 0 0 9999px',
                }}
              >
                <div style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: 0,
                  height: '50%',
                  backgroundColor: 'rgba(255,255,255,0.2)',
                }} />
              </div>
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <span style={{ color: 'white', fontSize: 10, fontWeight: 900 }}>
                  {Math.ceil(Math.min(health, maxHealth))}/{Math.ceil(maxHealth)}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Score */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>
            <div style={{
              backgroundColor: 'rgba(30,41,59,0.8)',
              backdropFilter: 'blur(4px)',
              paddingLeft: 12,
              paddingRight: 12,
              paddingTop: 4,
              paddingBottom: 4,
              borderRadius: 9999,
              border: '2px solid #334155',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
            }}>
              <span style={{ color: '#fbbf24', fontSize: 12, fontWeight: 900 }}>$</span>
              <span style={{ color: 'white', fontSize: 12, fontWeight: 900 }}>{formatScore(score)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-header: Mode info + Timer */}
      <div style={{
        position: 'absolute',
        top: 76,
        left: 0,
        width: '100%',
        zIndex: 30,
        pointerEvents: 'none',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingLeft: 16,
          paddingRight: 16,
          paddingTop: 4,
          paddingBottom: 4,
        }}>
          {/* Left: Mode info + kills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={14} style={{ color: '#22d3ee' }} />
            <span style={{ color: '#67e8f9', fontSize: 12, fontWeight: 900 }}>
              MATRIX
            </span>
            <span style={{ color: '#9ca3af', fontSize: 10 }}>
              <span style={{ color: '#f87171', fontWeight: 'bold' }}>{kills}</span> KILLS
            </span>
          </div>
          {/* Right: Timer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={14} style={{ color: '#22d3ee' }} />
            <span style={{ color: '#67e8f9', fontSize: 14, letterSpacing: '0.05em', fontWeight: 900 }}>
              {formatTime(gameTime)}
            </span>
          </div>
        </div>
      </div>

      {/* Auto Hunt indicator (bottom left) */}
      <div style={{
        position: 'absolute',
        bottom: 96,
        left: 16,
        zIndex: 30,
        pointerEvents: 'none',
      }}>
        <div style={{
          width: 56,
          height: 56,
          borderRadius: 8,
          border: `2px solid ${autoHuntEnabled ? '#4ade80' : '#475569'}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: autoHuntEnabled ? '#14532d' : '#0f172a',
          boxShadow: autoHuntEnabled ? '0 0 20px rgba(34,197,94,0.6)' : 'none',
        }}>
          {autoHuntEnabled && <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(34,197,94,0.2)',
            animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite',
          }} />}
          <div style={{
            position: 'relative',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
          }}>
            <Terminal size={24} style={{ color: autoHuntEnabled ? '#86efac' : '#94a3b8' }} />
            <div style={{ fontSize: 8, lineHeight: 1, textAlign: 'center', color: 'white' }}>VIBE</div>
          </div>
        </div>
      </div>

      {/* ========================================
          Bottom: Weapon Slots
          ======================================== */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: '100%',
        zIndex: 20,
        pointerEvents: 'none',
        paddingBottom: 4,
        paddingLeft: 12,
        paddingRight: 12,
      }}>
        <div style={{
          position: 'relative',
          width: '100%',
          height: 80,
          maxWidth: 1280,
          marginLeft: 'auto',
          marginRight: 'auto',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
        }}>
          <div style={{
            pointerEvents: 'auto',
            width: 'auto',
            maxWidth: 'calc(100% - 140px)',
            display: 'flex',
            justifyContent: 'center',
          }}>
            <div style={{
              backgroundColor: 'rgba(0,0,0,0.9)',
              padding: 4,
              border: '1px solid #374151',
              display: 'flex',
              gap: 4,
              overflowX: 'auto',
            }}>
              {weaponSlots.map((slot, _i) => {
                const type = slot.type as WeaponType;
                const data = WEAPON_DATA[type as keyof typeof WEAPON_DATA];
                const Icon = WEAPON_ICONS[type];
                if (!data || slot.level === 0) return null;

                const cdPercent = Math.min(100, slot.cooldownPercent * 100);

                return (
                  <div key={slot.type} style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{
                      width: 32,
                      height: 32,
                      backgroundColor: 'rgba(0,0,0,0.8)',
                      border: '1px solid #4b5563',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      overflow: 'hidden',
                    }}>
                      {Icon && <Icon size={16} style={{ color: data.color }} />}
                      {/* Cooldown overlay from bottom */}
                      <div
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          width: '100%',
                          backgroundColor: 'rgba(0,0,0,0.7)',
                          transition: 'all 0.1s',
                          height: `${cdPercent}%`,
                        }}
                      />
                      {/* Level badge */}
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        backgroundColor: 'rgba(0,0,0,0.9)',
                        fontSize: 6,
                        paddingLeft: 2,
                        paddingRight: 2,
                        color: '#9ca3af',
                        borderBottom: '1px solid #4b5563',
                        borderLeft: '1px solid #4b5563',
                      }}>
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
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        paddingBottom: 2,
      }}>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>ESC Pause</span>
      </div>

      {/* Enemy count (bottom right, subtle) */}
      <div style={{ position: 'absolute', bottom: 8, right: 12, zIndex: 10 }}>
        <span style={{ fontSize: 10, color: '#4b5563', fontFamily: 'monospace' }}>
          Enemies: {enemyCount}
        </span>
      </div>

      {/* Paused overlay */}
      {isPaused && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}>
          <span
            style={{
              fontSize: 36,
              fontWeight: 'bold',
              letterSpacing: '0.3em',
              color: MATRIX_GREEN,
            }}
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
