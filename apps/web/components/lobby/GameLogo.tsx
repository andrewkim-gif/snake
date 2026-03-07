'use client';

/**
 * GameLogo — CSS/SVG 로고 컴포넌트
 * 크로스헤어 아이콘 + "AI" (골드) + "WORLD WAR" (화이트)
 * compact: 헤더 인라인, full: 스플래시 스택
 */

import { SK, bodyFont } from '@/lib/sketch-ui';

interface GameLogoProps {
  variant?: 'compact' | 'full';
  style?: React.CSSProperties;
}

/** 크로스헤어 SVG */
function CrosshairIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={SK.gold}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* 외부 원 */}
      <circle cx="12" cy="12" r="10" opacity="0.3" />
      {/* 내부 원 */}
      <circle cx="12" cy="12" r="4" />
      {/* 십자선 */}
      <line x1="12" y1="2" x2="12" y2="7" />
      <line x1="12" y1="17" x2="12" y2="22" />
      <line x1="2" y1="12" x2="7" y2="12" />
      <line x1="17" y1="12" x2="22" y2="12" />
    </svg>
  );
}

export function GameLogo({ variant = 'compact', style }: GameLogoProps) {
  if (variant === 'full') {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        ...style,
      }}>
        <CrosshairIcon size={36} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
          <span style={{
            fontFamily: bodyFont,
            fontSize: '14px',
            fontWeight: 800,
            color: SK.gold,
            letterSpacing: '6px',
            textTransform: 'uppercase',
          }}>
            AI
          </span>
          <span style={{
            fontFamily: bodyFont,
            fontSize: '22px',
            fontWeight: 800,
            color: SK.textPrimary,
            letterSpacing: '4px',
            textTransform: 'uppercase',
          }}>
            WORLD WAR
          </span>
        </div>
      </div>
    );
  }

  // compact — 헤더 인라인
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      ...style,
    }}>
      <CrosshairIcon size={20} />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
        <span style={{
          fontFamily: bodyFont,
          fontSize: '11px',
          fontWeight: 800,
          color: SK.gold,
          letterSpacing: '3px',
        }}>
          AI
        </span>
        <span style={{
          fontFamily: bodyFont,
          fontSize: '16px',
          fontWeight: 800,
          color: SK.textPrimary,
          letterSpacing: '2px',
        }}>
          WORLD WAR
        </span>
      </div>
    </div>
  );
}
