'use client';

import { useState, useEffect, useCallback } from 'react';
import { MC, pixelFont, bodyFont } from '@/lib/minecraft-ui';

export interface CoachMessage {
  type: 'warning' | 'tip' | 'opportunity' | 'strategy' | 'efficiency';
  message: string;
}

interface CoachOverlayProps {
  message: CoachMessage | null;
}

const TYPE_ICONS: Record<string, string> = {
  warning: '\u26A0',     // warning sign
  tip: '\u2139',         // info
  opportunity: '\u2694',  // swords
  strategy: '\u2605',    // star
  efficiency: '\u26A1',   // lightning
};

const TYPE_COLORS: Record<string, string> = {
  warning: MC.textRed,
  tip: '#5B8DAD',
  opportunity: MC.textGreen,
  strategy: MC.textGold,
  efficiency: MC.textYellow,
};

export function CoachOverlay({ message }: CoachOverlayProps) {
  const [visible, setVisible] = useState(false);
  const [currentMsg, setCurrentMsg] = useState<CoachMessage | null>(null);
  const [enabled, setEnabled] = useState(true);

  // Load preference from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('coachEnabled');
      if (stored !== null) {
        setEnabled(stored === 'true');
      }
    } catch { /* ignore */ }
  }, []);

  const toggleEnabled = useCallback(() => {
    setEnabled(prev => {
      const next = !prev;
      try {
        localStorage.setItem('coachEnabled', String(next));
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  // Handle new messages
  useEffect(() => {
    if (!message || !enabled) return;

    setCurrentMsg(message);
    setVisible(true);

    const hideTimer = setTimeout(() => {
      setVisible(false);
    }, 3000); // display for 3s

    const clearTimer = setTimeout(() => {
      setCurrentMsg(null);
    }, 3300); // clear after fade-out

    return () => {
      clearTimeout(hideTimer);
      clearTimeout(clearTimer);
    };
  }, [message, enabled]);

  return (
    <>
      {/* Toggle button (always visible) */}
      <button
        onClick={toggleEnabled}
        style={{
          position: 'absolute',
          bottom: '16px',
          right: '16px',
          zIndex: 35,
          padding: '4px 8px',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          border: `1px solid ${enabled ? MC.btnGreen : MC.panelBorderDark}`,
          color: enabled ? MC.textGreen : MC.textGray,
          fontFamily: pixelFont,
          fontSize: '0.25rem',
          cursor: 'pointer',
        }}
      >
        COACH: {enabled ? 'ON' : 'OFF'}
      </button>

      {/* Coach message bubble */}
      {currentMsg && (
        <div style={{
          position: 'absolute',
          bottom: '50px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 35,
          opacity: visible ? 1 : 0,
          transition: 'opacity 300ms ease',
          pointerEvents: 'none',
        }}>
          <div style={{
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            border: `1px solid ${TYPE_COLORS[currentMsg.type] ?? MC.panelBorderDark}`,
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            maxWidth: '400px',
          }}>
            <span style={{
              fontSize: '1rem',
              lineHeight: 1,
              flexShrink: 0,
            }}>
              {TYPE_ICONS[currentMsg.type] ?? '\u2139'}
            </span>
            <span style={{
              fontFamily: bodyFont,
              fontSize: '0.75rem',
              color: TYPE_COLORS[currentMsg.type] ?? MC.textPrimary,
              lineHeight: 1.3,
            }}>
              {currentMsg.message}
            </span>
          </div>
        </div>
      )}
    </>
  );
}
