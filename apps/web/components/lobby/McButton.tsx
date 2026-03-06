'use client';

/**
 * McButton — MC 스타일 3D 엠보스 버튼
 * 석재(default) / 초록(green) / 빨강(red) 3변형
 * Hover: 밝아짐 / Pressed: 엠보스 반전 (눌린 효과)
 */

import { useState, type CSSProperties, type ReactNode, type ButtonHTMLAttributes } from 'react';
import { MC, pixelFont } from '@/lib/minecraft-ui';

interface McButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'green' | 'red';
  children: ReactNode;
  style?: CSSProperties;
}

const V = {
  default: { bg: MC.btnDefault, hover: '#9A9A9A', light: MC.btnDefaultLight, dark: MC.btnDefaultDark },
  green: { bg: MC.btnGreen, hover: '#67AE55', light: MC.btnGreenLight, dark: MC.btnGreenDark },
  red: { bg: MC.btnRed, hover: '#D76B6B', light: MC.btnRedLight, dark: MC.btnRedDark },
};

export function McButton({ variant = 'default', children, style, disabled, ...rest }: McButtonProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const c = V[variant];
  const isActive = !disabled;
  const bg = pressed && isActive ? c.dark : hovered && isActive ? c.hover : c.bg;
  // 일반: 밝은색 좌상단 + 어두운색 우하단 (볼록)
  // 눌림: 어두운색 좌상단 + 밝은색 우하단 (오목)
  const shadow = pressed && isActive
    ? `inset 2px 2px 0 ${c.dark}, inset -2px -2px 0 ${c.light}`
    : `inset 2px 2px 0 ${c.light}, inset -2px -2px 0 ${c.dark}`;

  return (
    <button
      disabled={disabled}
      style={{
        backgroundColor: bg,
        boxShadow: disabled ? 'none' : shadow,
        border: 'none',
        color: disabled ? MC.textGray : MC.textPrimary,
        fontFamily: pixelFont,
        fontSize: '0.65rem',
        padding: '0.6rem 1rem',
        cursor: disabled ? 'default' : 'pointer',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        opacity: disabled ? 0.5 : 1,
        textShadow: '1px 1px 0 rgba(0,0,0,0.5)',
        ...style,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      {...rest}
    >
      {children}
    </button>
  );
}
