'use client';

/**
 * AirdropHUD.tsx — v39 Phase 6: 에어드롭 HUD 표시
 *
 * - 활성 파워업 아이콘 + 남은 시간 게이지 (하단 중앙)
 * - 에어드롭 알림 (스폰/착지 시 상단 팝업)
 *
 * Canvas 위 React DOM 오버레이 (position: absolute).
 */

import { memo, useMemo } from 'react';
import type { PowerupVisual } from '@/lib/matrix/systems/airdrop-client';

// ── 폰트 ──
const DISPLAY_FONT = '"Ethnocentric", "Black Ops One", "Chakra Petch", monospace';
const BODY_FONT = '"ITC Avant Garde Gothic", "Rajdhani", "Space Grotesk", sans-serif';

// ── Props ──

export interface AirdropHUDProps {
  /** 활성 파워업 목록 */
  activePowerups: PowerupVisual[];
  /** 에어드롭 알림 메시지 (스폰/착지 시) */
  notification: string | null;
  /** 에어드롭 알림 색상 */
  notificationColor?: string;
  /** 표시 여부 */
  visible: boolean;
}

// ── 컴포넌트 ──

export const AirdropHUD = memo(function AirdropHUD({
  activePowerups,
  notification,
  notificationColor = '#FBBF24',
  visible,
}: AirdropHUDProps) {
  if (!visible) return null;

  return (
    <>
      {/* 활성 파워업 표시 (하단 중앙) */}
      {activePowerups.length > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 40,
            display: 'flex',
            gap: 12,
          }}
        >
          {activePowerups.map(p => (
            <PowerupIndicator key={p.type} powerup={p} />
          ))}
        </div>
      )}

      {/* 에어드롭 알림 (상단 팝업) */}
      {notification && (
        <div
          style={{
            position: 'absolute',
            top: 100,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 45,
            fontFamily: DISPLAY_FONT,
            fontSize: 14,
            fontWeight: 700,
            color: notificationColor,
            textShadow: `0 0 12px ${notificationColor}80`,
            letterSpacing: '0.1em',
            background: 'rgba(0, 0, 0, 0.6)',
            border: `1px solid ${notificationColor}40`,
            borderRadius: 8,
            padding: '8px 20px',
            backdropFilter: 'blur(8px)',
            animation: 'airdropNotifyFade 3s ease-out forwards',
          }}
        >
          {notification}
        </div>
      )}

      {/* CSS 키프레임 */}
      <style>{`
        @keyframes airdropNotifyFade {
          0% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
          10% { opacity: 1; transform: translateX(-50%) translateY(0); }
          80% { opacity: 1; }
          100% { opacity: 0; transform: translateX(-50%) translateY(-5px); }
        }
        @keyframes powerupTimerPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </>
  );
});

// ── 파워업 인디케이터 ──

const PowerupIndicator = memo(function PowerupIndicator({
  powerup,
}: {
  powerup: PowerupVisual;
}) {
  // 남은 시간 표시 (정수 초)
  const remainingSec = Math.ceil(powerup.remaining);
  // 낮은 시간 경고 (10초 미만)
  const isLow = powerup.remaining < 10;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        minWidth: 56,
      }}
    >
      {/* 아이콘 + 원형 게이지 */}
      <div
        style={{
          position: 'relative',
          width: 48,
          height: 48,
        }}
      >
        {/* 배경 원 */}
        <svg
          width={48}
          height={48}
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
          {/* 배경 트랙 */}
          <circle
            cx={24}
            cy={24}
            r={20}
            fill="rgba(0,0,0,0.6)"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth={3}
          />
          {/* 진행 게이지 */}
          <circle
            cx={24}
            cy={24}
            r={20}
            fill="none"
            stroke={powerup.color}
            strokeWidth={3}
            strokeDasharray={`${2 * Math.PI * 20}`}
            strokeDashoffset={`${2 * Math.PI * 20 * (1 - powerup.remainingRatio)}`}
            strokeLinecap="round"
            transform="rotate(-90 24 24)"
            style={{
              transition: 'stroke-dashoffset 0.5s linear',
              filter: `drop-shadow(0 0 4px ${powerup.color}80)`,
            }}
          />
        </svg>
        {/* 아이콘 */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            animation: isLow ? 'powerupTimerPulse 0.5s ease-in-out infinite' : undefined,
          }}
        >
          {powerup.icon}
        </div>
      </div>

      {/* 남은 시간 */}
      <div
        style={{
          fontFamily: DISPLAY_FONT,
          fontSize: 11,
          fontWeight: 700,
          color: isLow ? '#EF4444' : powerup.color,
          textShadow: isLow ? '0 0 6px rgba(239,68,68,0.6)' : 'none',
        }}
      >
        {remainingSec}s
      </div>
    </div>
  );
});

export default AirdropHUD;
