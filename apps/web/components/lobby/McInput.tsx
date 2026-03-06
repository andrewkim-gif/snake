'use client';

import { useState, type InputHTMLAttributes } from 'react';
import { MC, MCModern, bodyFont } from '@/lib/minecraft-ui';

interface McInputProps extends InputHTMLAttributes<HTMLInputElement> {}

export function McInput({ style, ...rest }: McInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <input
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        border: `1.5px solid ${focused ? MC.btnGreen : 'rgba(255,255,255,0.1)'}`,
        borderRadius: MCModern.radiusSm,
        color: MC.textPrimary,
        fontFamily: bodyFont,
        fontSize: '0.95rem',
        padding: '0.65rem 0.8rem',
        outline: 'none',
        width: '100%',
        boxSizing: 'border-box',
        textAlign: 'center',
        transition: MCModern.transitionFast,
        boxShadow: focused ? MCModern.glowGreen : 'none',
        ...style,
      }}
      onFocus={(e) => {
        setFocused(true);
        rest.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        rest.onBlur?.(e);
      }}
      {...rest}
    />
  );
}
