'use client';

/**
 * McButton — 모던 액센트 버튼
 * 좌측 컬러 스트라이프 + 클린 배경 + 호버 하이라이트
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
    border: 'rgba(0, 0, 0, 0.12)',
    accent: 'rgba(0, 0, 0, 0.2)',
    hoverBg: 'rgba(0, 0, 0, 0.04)',
    pressBg: 'rgba(0, 0, 0, 0.08)',
    text: SK.textPrimary,
  },
  green: {
    border: 'rgba(22, 163, 74, 0.25)',
    accent: SK.green,
    hoverBg: 'rgba(22, 163, 74, 0.06)',
    pressBg: 'rgba(22, 163, 74, 0.12)',
    text: '#15803D',
  },
  red: {
    border: 'rgba(220, 38, 38, 0.25)',
    accent: SK.red,
    hoverBg: 'rgba(220, 38, 38, 0.06)',
    pressBg: 'rgba(220, 38, 38, 0.12)',
    text: '#B91C1C',
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
            : '#FFFFFF',
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
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
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
