'use client';

/**
 * McButton — 전술 액센트 버튼
 * 좌측 컬러 스트라이프 + 다크 배경 + 호버 하이라이트
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
    border: 'rgba(232, 224, 212, 0.2)',
    accent: 'rgba(232, 224, 212, 0.5)',
    hoverBg: 'rgba(232, 224, 212, 0.08)',
    pressBg: 'rgba(232, 224, 212, 0.12)',
    text: SK.textPrimary,
  },
  green: {
    border: 'rgba(74, 158, 74, 0.35)',
    accent: SK.green,
    hoverBg: 'rgba(74, 158, 74, 0.12)',
    pressBg: 'rgba(74, 158, 74, 0.18)',
    text: SK.green,
  },
  red: {
    border: 'rgba(204, 51, 51, 0.35)',
    accent: SK.red,
    hoverBg: 'rgba(204, 51, 51, 0.12)',
    pressBg: 'rgba(204, 51, 51, 0.18)',
    text: SK.red,
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
            : 'rgba(26, 26, 26, 0.6)',
        border: `1px solid ${disabled ? SK.textMuted + '40' : c.border}`,
        borderLeft: `3px solid ${disabled ? SK.textMuted + '40' : c.accent}`,
        borderRadius: handDrawnRadius(2),
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
