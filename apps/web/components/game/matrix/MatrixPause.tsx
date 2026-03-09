'use client';

/**
 * MatrixPause.tsx - v32 Phase 4: ESC Pause Menu
 *
 * Apex Tactical CIC design system (SK tokens):
 * - OVERLAY.bg + blur backdrop
 * - SK.bg panel, SK.border, max-width 320px
 * - headingFont "PAUSED" title with SK.accent
 * - RESUME: SK.accent bg, SK.bg text
 * - EXIT TO LOBBY: SK.red outlined
 * - "ESC to resume": SK.textMuted, bodyFont
 *
 * Keyboard: ESC = resume
 */

import { useCallback, useEffect, memo } from 'react';
import { SK, headingFont, bodyFont, apexClip, sketchShadow } from '@/lib/sketch-ui';
import { OVERLAY } from '@/lib/overlay-tokens';

// ============================================
// Props
// ============================================

export interface MatrixPauseProps {
  onResume: () => void;
  onExitToLobby: () => void;
}

// ============================================
// Component
// ============================================

function MatrixPauseInner({ onResume, onExitToLobby }: MatrixPauseProps) {
  // ESC to resume
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onResume();
      }
    },
    [onResume],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown]);

  return (
    <div
      style={{
        position: 'absolute',
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
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 24,
          padding: 32,
          width: '100%',
          maxWidth: 320,
          backgroundColor: SK.bg,
          border: `1px solid ${SK.border}`,
          boxShadow: sketchShadow('lg'),
          clipPath: apexClip.md,
        }}
      >
        {/* Title */}
        <h2
          style={{
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: '0.15em',
            fontFamily: headingFont,
            color: SK.accent,
            margin: 0,
          }}
        >
          PAUSED
        </h2>

        {/* Menu buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
          {/* Resume */}
          <button
            onClick={onResume}
            style={{
              width: '100%',
              minHeight: 48,
              paddingTop: 14,
              paddingBottom: 14,
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: '0.1em',
              fontFamily: bodyFont,
              transition: 'all 0.15s',
              pointerEvents: 'auto',
              cursor: 'pointer',
              color: SK.bg,
              backgroundColor: SK.accent,
              border: `1px solid ${SK.accent}`,
              borderRadius: 0,
              clipPath: apexClip.sm,
            }}
          >
            RESUME
          </button>

          {/* Exit to Lobby */}
          <button
            onClick={onExitToLobby}
            style={{
              width: '100%',
              minHeight: 48,
              paddingTop: 14,
              paddingBottom: 14,
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: '0.1em',
              fontFamily: bodyFont,
              transition: 'all 0.15s',
              pointerEvents: 'auto',
              cursor: 'pointer',
              color: SK.red,
              backgroundColor: 'transparent',
              border: `1px solid ${SK.accentBorder}`,
              borderRadius: 0,
            }}
          >
            EXIT TO LOBBY
          </button>
        </div>

        {/* Hint */}
        <p style={{
          fontSize: 10,
          color: SK.textMuted,
          letterSpacing: '0.08em',
          margin: 0,
          fontFamily: bodyFont,
        }}>
          ESC to resume
        </p>
      </div>
    </div>
  );
}

export default memo(MatrixPauseInner);
