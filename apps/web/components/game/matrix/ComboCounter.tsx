'use client';

/**
 * ComboCounter.tsx - v32 Phase 1: Combo Counter UI (Apex Tactical Style)
 *
 * Apex Design System:
 * - headingFont (Chakra Petch) for combo number + tier name
 * - bodyFont (Space Grotesk) for labels
 * - SK.gold, SK.accent for highlights
 * - borderRadius: 0
 * - Apex tactical design system (SK tokens only)
 *
 * 10 Tiers: Bronze -> Silver -> Gold -> Diamond -> Platinum
 *           -> Master -> Grandmaster -> Legend -> Mythic -> Transcendent
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { SK, headingFont, bodyFont } from '@/lib/sketch-ui';
import {
  COMBO_CONFIG,
  COMBO_TIER_ORDER,
  formatComboNumber,
  getMilestoneType,
  getTierIndex,
} from '@/lib/matrix/config/combo.config';
import type { ComboState, ComboTier } from '@/lib/matrix/types';

// ─── PLACEHOLDER ───
// (skeleton created first, then filled by sections)

// ─── Props ───

interface ComboCounterProps {
  combo: ComboState;
}

// ─── Keyframes ───

const keyframes = `
  @keyframes cc-pop {
    0% { transform: scale(1); }
    50% { transform: scale(1.25); }
    100% { transform: scale(1); }
  }
  @keyframes cc-shake {
    0%, 100% { transform: translateX(0); }
    15% { transform: translateX(-4px) rotate(-2deg); }
    30% { transform: translateX(4px) rotate(2deg); }
    45% { transform: translateX(-3px) rotate(-1deg); }
    60% { transform: translateX(3px) rotate(1deg); }
    75% { transform: translateX(-2px); }
    90% { transform: translateX(1px); }
  }
  @keyframes cc-mega-shake {
    0%, 100% { transform: translateX(0) scale(1); }
    10% { transform: translateX(-6px) rotate(-5deg) scale(1.05); }
    20% { transform: translateX(6px) rotate(5deg) scale(1.08); }
    40% { transform: translateX(-4px) rotate(-3deg) scale(1.04); }
    60% { transform: translateX(3px) rotate(2deg) scale(1.02); }
    80% { transform: translateX(-1px) rotate(0deg) scale(1); }
  }
  @keyframes cc-glow-pulse {
    0%, 100% { opacity: 0.6; }
    50% { opacity: 1; }
  }
  @keyframes cc-tier-flash {
    0% { opacity: 0.9; transform: scale(0.5); }
    50% { opacity: 0.4; transform: scale(2); }
    100% { opacity: 0; transform: scale(3); }
  }
  @keyframes cc-fade-in {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

// ─── Tier Color Map (Apex palette override) ───

function getTierColor(tier: ComboTier): string {
  switch (tier) {
    case 'bronze': return '#CD7F32';
    case 'silver': return '#C0C0C0';
    case 'gold': return SK.gold;
    case 'diamond': return SK.green;
    case 'platinum': return '#E5E4E2';
    case 'master': return SK.accent;
    case 'grandmaster': return SK.blue;
    case 'legend': return '#9D4EDD';
    case 'mythic': return '#FF1493';
    case 'transcendent': return '#FFFFFF';
    default: return SK.textSecondary;
  }
}

function getTierName(tier: ComboTier): string {
  if (tier === 'none') return '';
  const config = COMBO_CONFIG.tiers[tier];
  return config?.nameEn || tier.toUpperCase();
}

// ─── Main Component ───

export function ComboCounter({ combo }: ComboCounterProps) {
  const [showPop, setShowPop] = useState(false);
  const [showShake, setShowShake] = useState(false);
  const [showTierUp, setShowTierUp] = useState(false);
  const prevCountRef = useRef(combo.count);
  const prevTierRef = useRef(combo.tier);

  // Combo increment detection
  useEffect(() => {
    if (combo.count > prevCountRef.current && combo.count > 0) {
      setShowPop(true);
      const timeout = setTimeout(() => setShowPop(false), 150);

      // Milestone check
      const milestoneType = getMilestoneType(combo.count);
      if (milestoneType === 'thousand' || milestoneType === 'hundred') {
        setShowShake(true);
        const shakeTimeout = setTimeout(() => setShowShake(false), milestoneType === 'thousand' ? 800 : 500);
        return () => { clearTimeout(timeout); clearTimeout(shakeTimeout); };
      }
      return () => clearTimeout(timeout);
    }
    prevCountRef.current = combo.count;
  }, [combo.count]);

  // Tier up detection
  useEffect(() => {
    if (combo.tier !== 'none' && combo.tier !== prevTierRef.current) {
      setShowTierUp(true);
      setShowShake(true);
      const timeout = setTimeout(() => {
        setShowTierUp(false);
        setShowShake(false);
      }, 600);
      return () => clearTimeout(timeout);
    }
    prevTierRef.current = combo.tier;
  }, [combo.tier]);

  // Scale calculation
  const scale = useMemo(() => {
    const { base, perCombo, max } = COMBO_CONFIG.visual.sizeScale;
    return Math.min(max, base + combo.count * perCombo);
  }, [combo.count]);

  if (combo.count === 0) return null;

  const tierIndex = getTierIndex(combo.tier);
  const tierColor = getTierColor(combo.tier);
  const tierName = getTierName(combo.tier);
  const displayNumber = formatComboNumber(combo.count);

  // Multiplier display (from combo state)
  const xpMult = combo.multipliers.xp;
  const dmgMult = combo.multipliers.damage;
  const spdMult = combo.multipliers.speed;

  // Animation selection
  const getNumberAnimation = (): string => {
    if (showShake) {
      return tierIndex >= 6
        ? 'cc-mega-shake 0.6s ease-out'
        : 'cc-shake 0.5s ease-out';
    }
    if (showPop) return 'cc-pop 0.15s ease-out';
    return 'none';
  };

  // Glow intensity based on tier
  const getTextShadow = (): string => {
    const blackOutline = '-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 -2px 0 #000, 0 2px 0 #000, -2px 0 0 #000, 2px 0 0 #000';
    if (tierIndex >= 7) return `${blackOutline}, 0 0 8px ${tierColor}60, 0 0 16px ${tierColor}30`;
    if (tierIndex >= 5) return `${blackOutline}, 0 0 6px ${tierColor}50`;
    if (tierIndex >= 3) return `${blackOutline}, 0 0 4px ${tierColor}40`;
    return `${blackOutline}, 0 0 3px ${tierColor}30`;
  };

  return (
    <>
      <style>{keyframes}</style>

      <div
        style={{
          position: 'fixed',
          top: '80px',
          left: '50%',
          transform: `translateX(-50%) scale(${scale})`,
          zIndex: 50,
          pointerEvents: 'none',
          transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
          willChange: 'transform',
          animation: 'cc-fade-in 0.3s ease-out',
        }}
      >
        {/* Tier-up flash */}
        {showTierUp && (
          <div
            style={{
              position: 'absolute',
              inset: '-40px',
              background: `radial-gradient(circle, ${tierColor} 0%, transparent 70%)`,
              animation: 'cc-tier-flash 0.5s ease-out forwards',
              pointerEvents: 'none',
            }}
          />
        )}

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
          {/* Combo number */}
          <div
            style={{
              fontFamily: headingFont,
              fontSize: '52px',
              fontWeight: 800,
              color: tierColor,
              lineHeight: 1,
              textShadow: getTextShadow(),
              animation: getNumberAnimation(),
              letterSpacing: '0.03em',
              userSelect: 'none',
            }}
          >
            {displayNumber}
          </div>

          {/* COMBO label */}
          <div
            style={{
              fontFamily: bodyFont,
              fontSize: '14px',
              color: tierColor,
              opacity: 0.85,
              letterSpacing: '0.35em',
              textTransform: 'uppercase',
              textShadow: `-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 0 4px ${tierColor}40`,
              marginTop: '-4px',
              userSelect: 'none',
            }}
          >
            COMBO
          </div>

          {/* Tier badge */}
          {tierName && (
            <div
              style={{
                marginTop: '6px',
                padding: '2px 12px',
                background: `${tierColor}20`,
                border: `1px solid ${tierColor}50`,
                borderRadius: 0,
                animation: showTierUp ? 'cc-pop 0.3s ease-out' : 'none',
              }}
            >
              <span
                style={{
                  fontFamily: headingFont,
                  fontSize: '10px',
                  color: tierColor,
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                }}
              >
                {tierName}
              </span>
            </div>
          )}

          {/* Multiplier badges */}
          {(xpMult > 1 || dmgMult > 1 || spdMult > 1) && (
            <div
              style={{
                display: 'flex',
                gap: '4px',
                marginTop: '6px',
              }}
            >
              {dmgMult > 1 && (
                <MultiplierBadge
                  label="DMG"
                  value={dmgMult}
                  color={SK.accent}
                />
              )}
              {xpMult > 1 && (
                <MultiplierBadge
                  label="XP"
                  value={xpMult}
                  color={SK.green}
                />
              )}
              {spdMult > 1 && (
                <MultiplierBadge
                  label="SPD"
                  value={spdMult}
                  color={SK.blue}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Multiplier Badge ───

function MultiplierBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      style={{
        padding: '1px 6px',
        background: `${color}15`,
        border: `1px solid ${color}30`,
        borderRadius: 0,
        display: 'flex',
        alignItems: 'center',
        gap: '3px',
      }}
    >
      <span
        style={{
          fontFamily: bodyFont,
          fontSize: '8px',
          color: `${color}`,
          opacity: 0.8,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: bodyFont,
          fontSize: '9px',
          color: `${color}`,
          fontWeight: 600,
        }}
      >
        +{Math.round((value - 1) * 100)}%
      </span>
    </div>
  );
}

export default ComboCounter;
