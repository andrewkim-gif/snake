'use client';

import type { CSSProperties, ReactNode, ButtonHTMLAttributes } from 'react';
import { MC, mcButtonShadow, pixelFont } from '@/lib/minecraft-ui';

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

export function McButton({ variant = 'default', children, style, disabled, ...rest }: McButtonProps) {
  const bg = BG_COLORS[variant];

  return (
    <button
      disabled={disabled}
      style={{
        backgroundColor: bg,
        boxShadow: mcButtonShadow(variant),
        border: 'none',
        color: disabled ? MC.textGray : MC.textPrimary,
        fontFamily: pixelFont,
        fontSize: '0.65rem',
        padding: '0.6rem 1rem',
        cursor: disabled ? 'default' : 'pointer',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        opacity: disabled ? 0.5 : 1,
        transition: 'filter 80ms',
        textShadow: '1px 1px 0 rgba(0,0,0,0.4)',
        ...style,
      }}
      onMouseDown={(e) => {
        if (!disabled) (e.currentTarget.style.filter = 'brightness(0.85)');
      }}
      onMouseUp={(e) => { e.currentTarget.style.filter = ''; }}
      onMouseLeave={(e) => { e.currentTarget.style.filter = ''; }}
      {...rest}
    >
      {children}
    </button>
  );
}
