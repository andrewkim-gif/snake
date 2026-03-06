'use client';

/**
 * McButton — 프리미엄 다크 액센트 버튼
 * 좌측 컬러 스트라이프 + 다크 배경 + 호버 글로우
 */

import { useState, type CSSProperties, type ReactNode, type ButtonHTMLAttributes } from 'react';
import { SK, SKFont, bodyFont, handDrawnRadius } from '@/lib/sketch-ui';

interface McButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'green' | 'red';
  children: ReactNode;
  style?: CSSProperties;
}

const V = {
  default: {
    border: 'rgba(255, 255, 255, 0.08)',
    accent: 'rgba(255, 255, 255, 0.15)',
    hoverBg: 'rgba(255, 255, 255, 0.06)',
    pressBg: 'rgba(255, 255, 255, 0.1)',
    text: SK.textPrimary,
  },
  green: {
    border: 'rgba(16, 185, 129, 0.25)',
    accent: SK.green,
    hoverBg: 'rgba(16, 185, 129, 0.1)',
    pressBg: 'rgba(16, 185, 129, 0.18)',
    text: '#34D399',
  },
  red: {
    border: 'rgba(239, 68, 68, 0.25)',
    accent: SK.red,
    hoverBg: 'rgba(239, 68, 68, 0.1)',
    pressBg: 'rgba(239, 68, 68, 0.18)',
    text: '#F87171',
  },
};

export function McButton({ variant = 'default', children, style, disabled, ...rest }: McButtonProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const c = V[variant];
  const isActive = !disabled;

  return (
    <button
      disabled={disabled}
      style={{
        backgroundColor: pressed && isActive
          ? c.pressBg
          : hovered && isActive
            ? c.hoverBg
            : SK.cardBg,
        border: `1px solid ${disabled ? SK.textMuted + '40' : c.border}`,
        borderLeft: `3px solid ${disabled ? SK.textMuted + '40' : c.accent}`,
        borderRadius: handDrawnRadius(6),
        color: disabled ? SK.textMuted : c.text,
        fontFamily: bodyFont,
        fontWeight: 700,
        fontSize: SKFont.button,
        padding: '10px 24px',
        minHeight: '44px',
        cursor: disabled ? 'default' : 'pointer',
        letterSpacing: '2px',
        textTransform: 'uppercase',
        opacity: disabled ? 0.4 : 1,
        transition: 'all 150ms ease',
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3)',
        ...style,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onTouchStart={() => { setHovered(true); setPressed(true); }}
      onTouchEnd={() => { setHovered(false); setPressed(false); }}
      {...rest}
    >
      {children}
    </button>
  );
}
