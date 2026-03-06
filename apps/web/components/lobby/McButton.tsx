'use client';

/**
 * McButton — MC 스타일 3D 엠보스 버튼
 * 석재(default) / 초록(green) / 빨강(red) 3변형
 * 3px 엠보스 보더 + Hover 밝아짐 + Pressed 반전
 */

import { useState, type CSSProperties, type ReactNode, type ButtonHTMLAttributes } from 'react';
import { MC, MCFont, pixelFont } from '@/lib/minecraft-ui';

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
  const shadow = pressed && isActive
    ? `inset 3px 3px 0 ${c.dark}, inset -3px -3px 0 ${c.light}`
    : `inset 3px 3px 0 ${c.light}, inset -3px -3px 0 ${c.dark}`;

  return (
    <button
      disabled={disabled}
      style={{
        backgroundColor: bg,
        boxShadow: disabled ? 'none' : shadow,
        border: 'none',
        color: disabled ? MC.textGray : MC.textPrimary,
        fontFamily: pixelFont,
        fontSize: MCFont.button,
        padding: '10px 24px',
        cursor: disabled ? 'default' : 'pointer',
        textTransform: 'uppercase',
        letterSpacing: '1px',
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
