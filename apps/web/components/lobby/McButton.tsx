'use client';

import { useState, type CSSProperties, type ReactNode, type ButtonHTMLAttributes } from 'react';
import { MC, MCModern, pixelFont } from '@/lib/minecraft-ui';

interface McButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'green' | 'red';
  children: ReactNode;
  style?: CSSProperties;
}

const BG_COLORS = {
  default: MC.btnDefault,
  green: MC.btnGreen,
  red: MC.btnRed,
};

const GLOW_MAP = {
  default: 'none',
  green: MCModern.glowGreen,
  red: MCModern.glowRed,
};

export function McButton({ variant = 'default', children, style, disabled, ...rest }: McButtonProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const bg = BG_COLORS[variant];
  const glow = GLOW_MAP[variant];

  const scale = pressed && !disabled ? 0.97 : hovered && !disabled ? 1.02 : 1;

  return (
    <button
      disabled={disabled}
      style={{
        backgroundColor: bg,
        border: 'none',
        borderRadius: MCModern.radiusSm,
        color: disabled ? MC.textGray : MC.textPrimary,
        fontFamily: pixelFont,
        fontSize: '0.65rem',
        padding: '0.6rem 1rem',
        cursor: disabled ? 'default' : 'pointer',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        opacity: disabled ? 0.5 : 1,
        transition: MCModern.transitionFast,
        textShadow: '1px 1px 0 rgba(0,0,0,0.4)',
        transform: `scale(${scale})`,
        boxShadow: hovered && !disabled ? glow : 'none',
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
