'use client';

/**
 * McInput — 프리미엄 다크 입력 필드
 * 다크 배경 + 인디고 포커스 링
 */

import { useState, type InputHTMLAttributes } from 'react';
import { SK, SKFont, bodyFont } from '@/lib/sketch-ui';

interface McInputProps extends InputHTMLAttributes<HTMLInputElement> {}

export function McInput({ style, ...rest }: McInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <input
      style={{
        backgroundColor: SK.bgWarm,
        border: `1px solid ${focused ? SK.borderFocus : 'rgba(255, 255, 255, 0.08)'}`,
        borderRadius: '8px',
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
          ? '0 0 0 3px rgba(99, 102, 241, 0.15)'
          : '0 2px 4px rgba(0, 0, 0, 0.3)',
        ...style,
      }}
      onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
      onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
      {...rest}
    />
  );
}
