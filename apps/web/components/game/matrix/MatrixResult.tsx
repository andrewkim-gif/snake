'use client';

/**
 * MatrixResult.tsx - v32 Phase 4: Game Over / Arena Result Screen
 *
 * Apex Tactical CIC design system (SK tokens):
 * - SK.bg + SK.border panels, borderRadius: 0
 * - headingFont titles, bodyFont body text
 * - SK.red (death) / SK.gold (survived) heading colors
 * - apexClip diagonal cuts on cards/buttons
 * - OVERLAY.bg backdrop
 *
 * Keyboard shortcuts: Enter = retry, Escape = exit to lobby
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
import { SK, headingFont, bodyFont, apexClip, sketchShadow } from '@/lib/sketch-ui';
import { OVERLAY } from '@/lib/overlay-tokens';

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
// Weapon display names
// ============================================

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
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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

  const titleColor = survived ? SK.gold : SK.red;
  const titleText = survived ? 'SURVIVED' : 'GAME OVER';
  const subtitleText = survived ? 'YOU HAVE ESCAPED THE MATRIX' : 'CONNECTION TERMINATED';

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
      backgroundColor: OVERLAY.bg,
      backdropFilter: OVERLAY.blur,
      WebkitBackdropFilter: OVERLAY.blur,
      fontFamily: bodyFont,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 560,
        marginLeft: 16,
        marginRight: 16,
        backgroundColor: SK.bg,
        border: `1px solid ${SK.border}`,
        boxShadow: sketchShadow('lg'),
        clipPath: apexClip.lg,
      }}>

        {/* ── Title Section ── */}
        <div style={{
          textAlign: 'center',
          padding: '28px 24px 20px',
          borderBottom: `1px solid ${SK.border}`,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            {survived ? (
              <Crown style={{ width: 48, height: 48, color: SK.gold }} />
            ) : (
              <Skull style={{ width: 48, height: 48, color: SK.red }} />
            )}
            <h1 style={{
              fontSize: 32,
              fontWeight: 700,
              fontFamily: headingFont,
              color: titleColor,
              margin: 0,
              letterSpacing: '0.08em',
            }}>
              {titleText}
            </h1>
            <p style={{
              fontSize: 12,
              color: SK.textMuted,
              letterSpacing: '0.12em',
              margin: 0,
              fontFamily: bodyFont,
            }}>
              {subtitleText}
            </p>
          </div>
        </div>

        {/* ── Stats Section ── */}
        <div style={{
          padding: '16px 24px',
          borderBottom: `1px solid ${SK.border}`,
        }}>
          {/* Level / Kills / Time row */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 32,
            marginBottom: 12,
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: 11,
                color: SK.textMuted,
                letterSpacing: '0.08em',
                marginBottom: 4,
                fontFamily: bodyFont,
              }}>LEVEL</div>
              <div style={{
                fontSize: 20,
                fontWeight: 700,
                fontFamily: headingFont,
                color: SK.textSecondary,
              }}>
                LV.{level}
              </div>
            </div>
            <div style={{ width: 1, height: 32, backgroundColor: SK.border }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: 11,
                color: SK.textMuted,
                letterSpacing: '0.08em',
                marginBottom: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                fontFamily: bodyFont,
              }}>
                <Target style={{ width: 11, height: 11 }} />
                KILLS
              </div>
              <div style={{
                fontSize: 20,
                fontWeight: 700,
                fontFamily: headingFont,
                color: SK.textSecondary,
              }}>
                {kills}
              </div>
            </div>
            <div style={{ width: 1, height: 32, backgroundColor: SK.border }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: 11,
                color: SK.textMuted,
                letterSpacing: '0.08em',
                marginBottom: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                fontFamily: bodyFont,
              }}>
                <Clock style={{ width: 11, height: 11 }} />
                TIME
              </div>
              <div style={{
                fontSize: 20,
                fontWeight: 700,
                fontFamily: headingFont,
                color: SK.textSecondary,
              }}>
                {formatTime(survivalTime)}
              </div>
            </div>
          </div>

          {/* Score */}
          <div style={{
            textAlign: 'center',
            paddingTop: 12,
            borderTop: `1px solid ${SK.border}`,
          }}>
            <div style={{
              fontSize: 11,
              color: SK.textMuted,
              letterSpacing: '0.08em',
              marginBottom: 4,
              fontFamily: bodyFont,
            }}>SCORE</div>
            <div style={{
              fontSize: 28,
              fontWeight: 700,
              fontFamily: headingFont,
              color: SK.gold,
            }}>
              {score.toLocaleString()}
            </div>
          </div>
        </div>

        {/* ── Weapons Acquired ── */}
        {weapons.length > 0 && (
          <div style={{
            padding: '16px 24px',
            borderBottom: `1px solid ${SK.border}`,
          }}>
            <h2 style={{
              fontSize: 11,
              fontWeight: 700,
              color: SK.textMuted,
              margin: 0,
              marginBottom: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              letterSpacing: '0.1em',
              fontFamily: bodyFont,
            }}>
              <Trophy style={{ width: 13, height: 13 }} />
              WEAPONS ACQUIRED
            </h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
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
                    fontWeight: 600,
                    fontFamily: bodyFont,
                    color: SK.textPrimary,
                    backgroundColor: SK.cardBg,
                    border: `1px solid ${SK.border}`,
                    clipPath: apexClip.sm,
                  }}
                >
                  {WEAPON_NAMES[w] || w}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Rewards ── */}
        <div style={{
          padding: '16px 24px',
          borderBottom: `1px solid ${SK.border}`,
        }}>
          <h2 style={{
            fontSize: 11,
            fontWeight: 700,
            color: SK.textMuted,
            margin: 0,
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            letterSpacing: '0.1em',
            fontFamily: bodyFont,
          }}>
            <Star style={{ width: 13, height: 13 }} />
            REWARDS
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 12,
            textAlign: 'center',
            marginBottom: 14,
          }}>
            <div style={{
              backgroundColor: SK.cardBg,
              padding: '10px 8px',
              border: `1px solid ${SK.border}`,
            }}>
              <div style={{ fontSize: 10, color: SK.textMuted, marginBottom: 4, fontFamily: bodyFont, letterSpacing: '0.06em' }}>
                Base Score
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: SK.textPrimary, fontFamily: headingFont }}>
                +{baseCredits.toLocaleString()}
              </div>
            </div>
            <div style={{
              backgroundColor: SK.cardBg,
              padding: '10px 8px',
              border: `1px solid ${SK.border}`,
            }}>
              <div style={{ fontSize: 10, color: SK.textMuted, marginBottom: 4, fontFamily: bodyFont, letterSpacing: '0.06em' }}>
                Kill Bonus
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: SK.green, fontFamily: headingFont }}>
                +{killBonus.toLocaleString()}
              </div>
            </div>
            <div style={{
              backgroundColor: SK.cardBg,
              padding: '10px 8px',
              border: `1px solid ${SK.border}`,
            }}>
              <div style={{ fontSize: 10, color: SK.textMuted, marginBottom: 4, fontFamily: bodyFont, letterSpacing: '0.06em' }}>
                Time Bonus
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: SK.blue, fontFamily: headingFont }}>
                +{timeBonus.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Total */}
          <div style={{
            paddingTop: 12,
            borderTop: `1px solid ${SK.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}>
            <Coins style={{ width: 20, height: 20, color: SK.gold }} />
            <span style={{
              fontSize: 24,
              fontWeight: 700,
              fontFamily: headingFont,
              color: SK.gold,
            }}>
              +{totalCredits.toLocaleString()}
            </span>
            <span style={{ fontSize: 13, color: SK.textMuted, fontFamily: bodyFont }}>
              Credits
            </span>
          </div>
        </div>

        {/* ── Action Buttons ── */}
        <div style={{ padding: '20px 24px 16px' }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={onExitToLobby}
              style={{
                flex: 1,
                paddingTop: 12,
                paddingBottom: 12,
                paddingLeft: 24,
                paddingRight: 24,
                fontWeight: 700,
                fontSize: 13,
                letterSpacing: '0.06em',
                fontFamily: bodyFont,
                transition: 'all 0.2s',
                pointerEvents: 'auto',
                cursor: 'pointer',
                color: SK.textSecondary,
                backgroundColor: 'transparent',
                border: `1px solid ${SK.border}`,
                borderRadius: 0,
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
                fontWeight: 700,
                fontSize: 13,
                letterSpacing: '0.06em',
                fontFamily: bodyFont,
                transition: 'all 0.2s',
                pointerEvents: 'auto',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                color: SK.bg,
                backgroundColor: SK.accent,
                border: `1px solid ${SK.accent}`,
                borderRadius: 0,
                clipPath: apexClip.sm,
              }}
            >
              RETRY
              <ArrowRight style={{ width: 16, height: 16 }} />
            </button>
          </div>

          {/* Keyboard hints */}
          <p style={{
            fontSize: 10,
            color: SK.textMuted,
            letterSpacing: '0.08em',
            textAlign: 'center',
            marginTop: 12,
            marginBottom: 0,
            fontFamily: bodyFont,
          }}>
            ENTER to retry | ESC to exit
          </p>
        </div>
      </div>
    </div>
  );
}

const MatrixResult = memo(MatrixResultInner);
export default MatrixResult;
