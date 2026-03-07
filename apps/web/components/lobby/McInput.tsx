'use client';

/**
 * McInput — Apex 스타일 입력 필드
 * 직각 + 레드 포커스 링
 */

import { useState, type InputHTMLAttributes } from 'react';
import { SK, bodyFont } from '@/lib/sketch-ui';

interface McInputProps extends InputHTMLAttributes<HTMLInputElement> {}

export function McInput({ style, ...rest }: McInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <input
      style={{
        backgroundColor: SK.bgWarm,
        border: `1px solid ${focused ? SK.borderFocus : 'rgba(255, 255, 255, 0.08)'}`,
        borderLeft: focused ? `1px solid ${SK.accent}` : '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 0,
        color: SK.textPrimary,
        fontFamily: bodyFont,
        fontWeight: 500,
        fontSize: '14px',
        padding: '8px 12px',
        minHeight: '38px',
        outline: 'none',
        width: '100%',
        boxSizing: 'border-box',
        textAlign: 'center',
        transition: 'all 150ms ease',
        boxShadow: focused
          ? '0 0 0 3px rgba(239, 68, 68, 0.12)'
          : '0 2px 4px rgba(0, 0, 0, 0.3)',
        ...style,
      }}
      onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
      onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
      {...rest}
    />
  );
}
