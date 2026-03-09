'use client';

/**
 * SynergyNotification.tsx - v32 Phase 3: Synergy Activation Banner (Apex Tactical)
 *
 * Displays a bottom notification banner when a synergy is activated.
 * Auto-dismisses after a configurable duration.
 *
 * Uses SK tokens, headingFont/bodyFont. No monospace, no #00FF41.
 */

import React, { memo, useEffect, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { SK, headingFont, bodyFont, apexClip } from '@/lib/sketch-ui';

export interface SynergyNotificationData {
  id: string;
  name: string;
  description: string;
  tier: string; // 'basic' | 'advanced' | 'ultimate'
}

export interface SynergyNotificationProps {
  /** Currently active synergy notification (null = hidden) */
  synergy: SynergyNotificationData | null;
  /** Called when notification should be dismissed */
  onDismiss?: () => void;
  /** Auto-dismiss duration in ms (default 4000) */
  duration?: number;
}

function SynergyNotificationInner({
  synergy,
  onDismiss,
  duration = 4000,
}: SynergyNotificationProps) {
  const [visible, setVisible] = useState(false);
  const [currentSynergy, setCurrentSynergy] = useState<SynergyNotificationData | null>(null);

  useEffect(() => {
    if (synergy) {
      setCurrentSynergy(synergy);
      setVisible(true);

      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(() => {
          onDismiss?.();
        }, 300); // wait for fade-out
      }, duration);

      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [synergy, duration, onDismiss]);

  if (!currentSynergy && !visible) return null;

  const tierColor = currentSynergy?.tier === 'ultimate' ? SK.gold
    : currentSynergy?.tier === 'advanced' ? SK.accent
    : SK.green;

  const tierLabel = currentSynergy?.tier === 'ultimate' ? 'ULT'
    : currentSynergy?.tier === 'advanced' ? 'ADV'
    : 'BAS';

  return (
    <div style={{
      position: 'fixed',
      bottom: 32,
      left: '50%',
      transform: `translateX(-50%) translateY(${visible ? '0' : '20px'})`,
      opacity: visible ? 1 : 0,
      transition: 'all 0.3s ease',
      zIndex: 60,
      pointerEvents: visible ? 'auto' : 'none',
      fontFamily: bodyFont,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        paddingLeft: 20,
        paddingRight: 16,
        paddingTop: 12,
        paddingBottom: 12,
        background: SK.glassBg,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: `1px solid ${tierColor}40`,
        borderLeft: `3px solid ${tierColor}`,
        borderRadius: 0,
        clipPath: apexClip.md,
        minWidth: 280,
        maxWidth: 440,
      }}>
        {/* Icon */}
        <div style={{
          width: 36,
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `${tierColor}15`,
          border: `1px solid ${tierColor}30`,
          flexShrink: 0,
        }}>
          <Sparkles size={18} style={{ color: tierColor }} />
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 2,
          }}>
            <span style={{
              fontSize: 9,
              fontWeight: 600,
              color: tierColor,
              letterSpacing: '0.15em',
            }}>
              SYNERGY ACTIVATED
            </span>
            <span style={{
              fontSize: 9,
              color: SK.textMuted,
              padding: '1px 6px',
              background: `${tierColor}12`,
              border: `1px solid ${tierColor}20`,
              fontWeight: 600,
            }}>
              {tierLabel}
            </span>
          </div>
          <div style={{
            fontFamily: headingFont,
            fontSize: 15,
            fontWeight: 700,
            color: SK.textPrimary,
            letterSpacing: '0.03em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {currentSynergy?.name}
          </div>
          <div style={{
            fontSize: 11,
            color: SK.textSecondary,
            marginTop: 2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {currentSynergy?.description}
          </div>
        </div>

        {/* Close button */}
        {onDismiss && (
          <button
            onClick={() => {
              setVisible(false);
              setTimeout(() => onDismiss(), 300);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: SK.textMuted,
              cursor: 'pointer',
              padding: 4,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

const SynergyNotification = memo(SynergyNotificationInner);
export default SynergyNotification;
