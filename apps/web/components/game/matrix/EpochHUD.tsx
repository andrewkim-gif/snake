'use client';

/**
 * EpochHUD.tsx — v33 Phase 5: Epoch Phase HUD (Redesign)
 *
 * Canvas 위 React DOM 오버레이 (position: absolute)
 * 에폭 6페이즈 상태 표시: peace → war_countdown → war → shrink → end → transition
 *
 * 디자인: 다크/글로우 | Ethnocentric (display) + ITC Avant Garde Gothic (body)
 * - 상단 중앙: 페이즈 배지 + 카운트다운 타이머
 * - 전쟁 카운트다운: 대형 숫자 + 사이렌 글로우
 * - PvP 상태 인디케이터
 * - 연결 상태 (latency)
 */

import { memo, useMemo } from 'react';
import type { EpochUIState } from '@/lib/matrix/systems/epoch-ui-bridge';

// ─── 폰트 정의 ───
const DISPLAY_FONT = '"Ethnocentric", "Black Ops One", "Chakra Petch", monospace';
const BODY_FONT = '"ITC Avant Garde Gothic", "Rajdhani", "Space Grotesk", sans-serif';

// ─── 페이즈별 글로우 설정 ───
const PHASE_GLOW: Record<string, { color: string; shadow: string; bgGlow: string }> = {
  peace: {
    color: '#4ADE80',
    shadow: '0 0 12px rgba(74,222,128,0.5), 0 0 24px rgba(74,222,128,0.2)',
    bgGlow: 'rgba(74,222,128,0.08)',
  },
  war_countdown: {
    color: '#FBBF24',
    shadow: '0 0 12px rgba(251,191,36,0.5), 0 0 24px rgba(251,191,36,0.2)',
    bgGlow: 'rgba(251,191,36,0.08)',
  },
  war: {
    color: '#EF4444',
    shadow: '0 0 16px rgba(239,68,68,0.6), 0 0 32px rgba(239,68,68,0.3)',
    bgGlow: 'rgba(239,68,68,0.10)',
  },
  shrink: {
    color: '#F97316',
    shadow: '0 0 14px rgba(249,115,22,0.5), 0 0 28px rgba(249,115,22,0.25)',
    bgGlow: 'rgba(249,115,22,0.08)',
  },
  end: {
    color: '#8B5CF6',
    shadow: '0 0 12px rgba(139,92,246,0.5), 0 0 24px rgba(139,92,246,0.2)',
    bgGlow: 'rgba(139,92,246,0.08)',
  },
  transition: {
    color: '#6366F1',
    shadow: '0 0 12px rgba(99,102,241,0.5), 0 0 24px rgba(99,102,241,0.2)',
    bgGlow: 'rgba(99,102,241,0.08)',
  },
};

// ─── Props ───

export interface EpochHUDProps {
  /** EpochUIBridge에서 제공하는 현재 UI 상태 */
  epochUI: EpochUIState;
  /** 소켓 연결 상태 */
  connectionState: string;
  /** 네트워크 지연 (ms) */
  latency: number;
  /** 현재 플레이어 국적 코드 */
  playerNation?: string;
}

// ─── Component ───

function EpochHUDInner({ epochUI, connectionState, latency, playerNation }: EpochHUDProps) {
  const glowConfig = useMemo(
    () => PHASE_GLOW[epochUI.phase] ?? PHASE_GLOW.peace,
    [epochUI.phase],
  );

  const isConnected = connectionState === 'connected';

  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      {/* ═══ Phase Badge + Timer ═══ */}
      <div
        style={{
          background: 'rgba(8,8,12,0.85)',
          backdropFilter: 'blur(12px)',
          border: `1px solid ${glowConfig.color}`,
          borderRadius: 0,
          clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))',
          padding: '6px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          boxShadow: glowConfig.shadow,
          minWidth: 200,
          justifyContent: 'center',
        }}
      >
        {/* Phase pulse dot */}
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: glowConfig.color,
            boxShadow: `0 0 8px ${glowConfig.color}`,
            flexShrink: 0,
            animation: epochUI.phase === 'war' ? 'epochPulse 0.8s ease-in-out infinite' : 'epochPulse 2s ease-in-out infinite',
          }}
        />

        {/* Phase name */}
        <span
          style={{
            color: glowConfig.color,
            fontFamily: DISPLAY_FONT,
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            textShadow: `0 0 8px ${glowConfig.color}`,
          }}
        >
          {epochUI.config.displayName}
        </span>

        {/* Separator */}
        <div
          style={{
            width: 1,
            height: 16,
            background: `linear-gradient(to bottom, transparent, ${glowConfig.color}, transparent)`,
          }}
        />

        {/* Timer */}
        <span
          style={{
            color: '#E8E0D4',
            fontFamily: DISPLAY_FONT,
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textShadow: '0 0 6px rgba(232,224,212,0.3)',
          }}
        >
          {epochUI.timerDisplay}
        </span>
      </div>

      {/* ═══ War Countdown Number (10~1) ═══ */}
      {epochUI.warCountdownNumber !== null && (
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Glow ring behind number */}
          <div
            style={{
              position: 'absolute',
              width: 80,
              height: 80,
              borderRadius: '50%',
              border: `2px solid ${epochUI.warSiren ? 'rgba(239,68,68,0.6)' : 'rgba(251,191,36,0.4)'}`,
              boxShadow: epochUI.warSiren
                ? '0 0 30px rgba(239,68,68,0.5), inset 0 0 20px rgba(239,68,68,0.2)'
                : '0 0 20px rgba(251,191,36,0.3), inset 0 0 10px rgba(251,191,36,0.1)',
              animation: epochUI.warSiren ? 'epochSirenRing 0.5s ease-in-out infinite' : undefined,
            }}
          />
          <span
            style={{
              color: epochUI.warSiren ? '#EF4444' : '#FBBF24',
              fontFamily: DISPLAY_FONT,
              fontSize: epochUI.warSiren ? 52 : 40,
              fontWeight: 900,
              textShadow: epochUI.warSiren
                ? '0 0 24px rgba(239,68,68,0.8), 0 0 48px rgba(239,68,68,0.4)'
                : '0 0 12px rgba(251,191,36,0.5)',
              animation: epochUI.warSiren ? 'epochSirenPulse 0.5s ease-in-out infinite' : undefined,
              position: 'relative',
              zIndex: 1,
            }}
          >
            {epochUI.warCountdownNumber}
          </span>
        </div>
      )}

      {/* ═══ PvP Status Indicator ═══ */}
      {epochUI.config.pvpEnabled && (
        <div
          style={{
            background: 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(239,68,68,0.5)',
            borderRadius: 0,
            clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))',
            padding: '3px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: '0 0 12px rgba(239,68,68,0.2)',
          }}
        >
          <div
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              backgroundColor: '#EF4444',
              animation: 'epochPulse 0.8s ease-in-out infinite',
            }}
          />
          <span
            style={{
              color: '#EF4444',
              fontSize: 10,
              fontFamily: DISPLAY_FONT,
              fontWeight: 700,
              letterSpacing: '0.2em',
            }}
          >
            PVP ACTIVE
          </span>
        </div>
      )}

      {/* ═══ Nation + Connection Status ═══ */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {/* Player nation badge */}
        {playerNation && (
          <span
            style={{
              color: '#CC9933',
              fontSize: 9,
              fontFamily: BODY_FONT,
              fontWeight: 600,
              letterSpacing: '0.1em',
              textShadow: '0 0 6px rgba(204,153,51,0.3)',
            }}
          >
            {playerNation.toUpperCase()}
          </span>
        )}

        {/* Connection dot + latency */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <div
            style={{
              width: 4,
              height: 4,
              borderRadius: '50%',
              backgroundColor: isConnected ? '#4ADE80' : '#EF4444',
              boxShadow: isConnected ? '0 0 4px rgba(74,222,128,0.5)' : '0 0 4px rgba(239,68,68,0.5)',
            }}
          />
          <span
            style={{
              fontSize: 9,
              color: isConnected ? 'rgba(74,222,128,0.7)' : 'rgba(239,68,68,0.7)',
              fontFamily: BODY_FONT,
              fontWeight: 500,
              letterSpacing: '0.05em',
            }}
          >
            {isConnected ? `${latency}ms` : connectionState.toUpperCase()}
          </span>
        </div>
      </div>

      {/* ═══ CSS Keyframes (injected once) ═══ */}
      <style>{`
        @keyframes epochPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes epochSirenPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
        @keyframes epochSirenRing {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(1.15); opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}

const EpochHUD = memo(EpochHUDInner);
export default EpochHUD;
