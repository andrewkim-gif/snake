'use client';

/**
 * BreakTimeOverlay.tsx - v32 Phase 1: Data Burst + Kernel Panic UI
 *
 * Apex Tactical Design System:
 * - SK.accent (#EF4444), SK.gold (#F59E0B), SK.green (#10B981)
 * - headingFont (Chakra Petch), bodyFont (Space Grotesk)
 * - borderRadius: 0 (sharp tactical edges)
 * - Apex tactical design system (SK tokens only)
 *
 * States:
 * 1. Warning (3s countdown before burst)
 * 2. Active Burst (10s duration, spawn x3, XP x2)
 * 3. Kernel Panic Gauge (0-100%)
 * 4. Kernel Panic Ready -> auto-trigger ultimate
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { SK, headingFont, bodyFont } from '@/lib/sketch-ui';
import { BREAK_TIME_CONFIG } from '@/lib/matrix/config/breaktime.config';
import type { BreakTimeState } from '@/lib/matrix/types';

// ─── Props ───

interface BreakTimeOverlayProps {
  breakTime: BreakTimeState;
  onTriggerUltimate?: () => boolean;
}

// ─── Keyframes ───

const keyframes = `
  @keyframes bt-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }
  @keyframes bt-flash {
    0% { opacity: 0.9; }
    50% { opacity: 0.3; }
    100% { opacity: 0.9; }
  }
  @keyframes bt-slide-in {
    from { opacity: 0; transform: translateY(-12px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes bt-gauge-pulse {
    0%, 100% { box-shadow: 0 0 4px ${SK.accent}40; }
    50% { box-shadow: 0 0 12px ${SK.accent}80; }
  }
  @keyframes bt-kernel-flash {
    0% { opacity: 1; }
    100% { opacity: 0; }
  }
`;

// ─── Kernel Panic Flash ───

function KernelPanicFlash({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: `radial-gradient(circle at center, ${SK.accent}60, ${SK.accent}20, transparent)`,
        pointerEvents: 'none',
        zIndex: 60,
        animation: 'bt-kernel-flash 0.3s ease-out forwards',
      }}
    />
  );
}

// ─── Warning State ───

function WarningOverlay({ warningTimer }: { warningTimer: number }) {
  return (
    <>
      {/* Warning border glow */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 40,
          boxShadow: `inset 0 0 30px ${SK.accent}60`,
          border: `2px solid ${SK.accent}50`,
          animation: 'bt-pulse 1s ease-in-out infinite',
        }}
      />

      {/* Warning banner */}
      <div
        style={{
          position: 'fixed',
          top: '25%',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 50,
          pointerEvents: 'none',
          animation: 'bt-slide-in 0.3s ease-out',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: SK.glassBg,
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: `1px solid ${SK.accentBorder}`,
            padding: '10px 24px',
            borderRadius: 0,
          }}
        >
          <span
            style={{
              fontFamily: headingFont,
              fontSize: '22px',
              color: SK.accent,
              letterSpacing: '0.1em',
              fontWeight: 700,
              textTransform: 'uppercase',
            }}
          >
            DATA BURST IN {Math.ceil(warningTimer)}s
          </span>
        </div>
      </div>
    </>
  );
}

// ─── Active Burst State ───

function ActiveBurstOverlay({ timer, killsDuringBreak }: { timer: number; killsDuringBreak: number }) {
  const progress = Math.max(0, (timer / BREAK_TIME_CONFIG.duration) * 100);

  return (
    <>
      {/* Active border glow */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 40,
          boxShadow: `inset 0 0 20px ${SK.accent}40`,
          border: `2px solid ${SK.accent}30`,
        }}
      />

      {/* Active burst banner */}
      <div
        style={{
          position: 'fixed',
          top: '12px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 50,
          pointerEvents: 'none',
          animation: 'bt-slide-in 0.3s ease-out',
          willChange: 'transform',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          {/* Title bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: SK.glassBg,
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: `1px solid ${SK.accentBorder}`,
              padding: '6px 20px',
              borderRadius: 0,
            }}
          >
            <span
              style={{
                fontFamily: headingFont,
                fontSize: '18px',
                color: SK.accent,
                letterSpacing: '0.15em',
                fontWeight: 700,
                animation: 'bt-flash 0.8s ease-in-out infinite',
              }}
            >
              DATA BURST
            </span>
            <span
              style={{
                fontFamily: bodyFont,
                fontSize: '11px',
                color: SK.textSecondary,
              }}
            >
              x3 SPAWN / x2 XP
            </span>
          </div>

          {/* Progress bar */}
          <div
            style={{
              width: '200px',
              height: '4px',
              background: SK.cardBg,
              border: `1px solid ${SK.border}`,
              borderRadius: 0,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progress}%`,
                background: `linear-gradient(90deg, ${SK.accent}, ${SK.accentLight})`,
                transition: 'width 0.1s linear',
              }}
            />
          </div>

          {/* Kill count */}
          <span
            style={{
              fontFamily: bodyFont,
              fontSize: '10px',
              color: SK.textMuted,
            }}
          >
            BURST KILLS: {killsDuringBreak}
          </span>
        </div>
      </div>
    </>
  );
}

// ─── Kernel Panic Gauge ───

function KernelPanicGauge({
  gauge,
  ultimateReady,
}: {
  gauge: number;
  ultimateReady: boolean;
}) {
  const progress = Math.min(100, (gauge / BREAK_TIME_CONFIG.ultimate.maxGauge) * 100);

  if (gauge <= 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '80px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 45,
        pointerEvents: 'none',
        willChange: 'transform',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: SK.glassBg,
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          border: `1px solid ${ultimateReady ? SK.accent : SK.border}`,
          padding: '4px 12px',
          borderRadius: 0,
          animation: ultimateReady ? 'bt-gauge-pulse 0.8s ease-in-out infinite' : 'none',
        }}
      >
        {/* Label */}
        <span
          style={{
            fontFamily: bodyFont,
            fontSize: '9px',
            color: ultimateReady ? SK.accent : SK.textMuted,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}
        >
          PANIC
        </span>

        {/* Gauge bar */}
        <div
          style={{
            width: '80px',
            height: '5px',
            background: SK.cardBg,
            border: `1px solid ${SK.border}`,
            borderRadius: 0,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progress}%`,
              background: ultimateReady
                ? `linear-gradient(90deg, ${SK.accent}, ${SK.accentLight})`
                : `linear-gradient(90deg, ${SK.gold}, ${SK.orangeLight})`,
              transition: 'width 0.15s linear',
              animation: ultimateReady ? 'bt-pulse 0.6s ease-in-out infinite' : 'none',
            }}
          />
        </div>

        {/* Percentage / Ready label */}
        <span
          style={{
            fontFamily: bodyFont,
            fontSize: '9px',
            color: ultimateReady ? SK.accent : SK.textMuted,
            width: '32px',
            textAlign: 'right',
          }}
        >
          {ultimateReady ? 'READY' : `${Math.floor(progress)}%`}
        </span>
      </div>
    </div>
  );
}

// ─── Main Component ───

export function BreakTimeOverlay({ breakTime, onTriggerUltimate }: BreakTimeOverlayProps) {
  const [kernelFlash, setKernelFlash] = useState(false);
  const hasTriggeredRef = useRef(false);

  // Auto-trigger Kernel Panic when gauge reaches 100%
  useEffect(() => {
    if (breakTime.ultimateReady && !hasTriggeredRef.current && onTriggerUltimate) {
      hasTriggeredRef.current = true;

      // Trigger ultimate
      const success = onTriggerUltimate();
      if (success) {
        // Flash effect
        setKernelFlash(true);
        setTimeout(() => {
          setKernelFlash(false);
        }, 300);
      }
    }

    // Reset trigger flag when gauge empties
    if (!breakTime.ultimateReady && hasTriggeredRef.current) {
      hasTriggeredRef.current = false;
    }
  }, [breakTime.ultimateReady, onTriggerUltimate]);

  // Determine which overlay to show
  const showWarning = breakTime.isWarning && !breakTime.isActive;
  const showActive = breakTime.isActive;
  const showGauge = breakTime.gauge > 0;

  return (
    <>
      <style>{keyframes}</style>

      {/* Kernel Panic screen flash */}
      <KernelPanicFlash active={kernelFlash} />

      {/* Warning state (before burst) */}
      {showWarning && (
        <WarningOverlay warningTimer={breakTime.warningTimer} />
      )}

      {/* Active burst state */}
      {showActive && (
        <ActiveBurstOverlay
          timer={breakTime.timer}
          killsDuringBreak={breakTime.killsDuringBreak}
        />
      )}

      {/* Kernel Panic gauge (always visible when > 0) */}
      {showGauge && (
        <KernelPanicGauge
          gauge={breakTime.gauge}
          ultimateReady={breakTime.ultimateReady}
        />
      )}
    </>
  );
}

export default BreakTimeOverlay;
