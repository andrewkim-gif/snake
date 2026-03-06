'use client';

import type { InputHTMLAttributes } from 'react';
import { MC, bodyFont } from '@/lib/minecraft-ui';

interface McInputProps extends InputHTMLAttributes<HTMLInputElement> {}

export function McInput({ style, ...rest }: McInputProps) {
  return (
    <input
      style={{
        backgroundColor: MC.inputBg,
        border: `2px solid ${MC.inputBorder}`,
        color: MC.textPrimary,
        fontFamily: bodyFont,
        fontSize: '0.95rem',
        padding: '0.65rem 0.8rem',
        outline: 'none',
        width: '100%',
        boxSizing: 'border-box',
        textAlign: 'center',
        ...style,
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = MC.inputFocusBorder;
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = MC.inputBorder;
      }}
      {...rest}
    />
  );
}
