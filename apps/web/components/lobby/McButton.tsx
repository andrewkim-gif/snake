'use client';

/**
 * McButton — Apex 스타일 버튼
 * 직각 + 우상단 삼각 컷 (clip-path) + 레드 악센트
 */

import { useState, type CSSProperties, type ReactNode, type ButtonHTMLAttributes } from 'react';
import { SK, SKFont, bodyFont, apexClip } from '@/lib/sketch-ui';

interface McButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'green' | 'red' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  style?: CSSProperties;
}

const V = {
  default: {
    border: 'rgba(255, 255, 255, 0.08)',
    hoverBg: 'rgba(255, 255, 255, 0.06)',
    pressBg: 'rgba(255, 255, 255, 0.1)',
    text: SK.textPrimary,
    accentLine: 'rgba(255, 255, 255, 0.12)',
  },
  accent: {
    border: SK.accentBorder,
    hoverBg: 'rgba(239, 68, 68, 0.1)',
    pressBg: 'rgba(239, 68, 68, 0.18)',
    text: SK.accentLight,
    accentLine: SK.accent,
  },
  green: {
    border: 'rgba(16, 185, 129, 0.25)',
    hoverBg: 'rgba(16, 185, 129, 0.1)',
    pressBg: 'rgba(16, 185, 129, 0.18)',
    text: '#34D399',
    accentLine: SK.green,
  },
  red: {
    border: 'rgba(239, 68, 68, 0.25)',
    hoverBg: 'rgba(239, 68, 68, 0.1)',
    pressBg: 'rgba(239, 68, 68, 0.18)',
    text: '#F87171',
    accentLine: SK.red,
  },
};

export function McButton({ variant = 'default', size = 'md', children, style, disabled, ...rest }: McButtonProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const c = V[variant];
  const isActive = !disabled;
  const clip = size === 'sm' ? apexClip.sm : size === 'lg' ? apexClip.lg : apexClip.md;
  const pad = size === 'sm' ? '6px 16px' : size === 'lg' ? '12px 32px' : '10px 24px';
  const h = size === 'sm' ? '32px' : size === 'lg' ? '48px' : '44px';

  return (
    <button
      disabled={disabled}
      style={{
        position: 'relative',
        backgroundColor: pressed && isActive
          ? c.pressBg
          : hovered && isActive
            ? c.hoverBg
            : SK.cardBg,
        border: `1px solid ${disabled ? SK.textMuted + '40' : c.border}`,
        borderLeft: `3px solid ${disabled ? SK.textMuted + '40' : c.accentLine}`,
        borderRadius: 0,
        clipPath: clip,
        color: disabled ? SK.textMuted : c.text,
        fontFamily: bodyFont,
        fontWeight: 700,
        fontSize: size === 'sm' ? SKFont.sm : SKFont.button,
        padding: pad,
        minHeight: h,
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
