'use client';

/**
 * McInput — 모던 입력 필드
 * 화이트 배경 + 포커스 블루 링
 */

import { useState, type InputHTMLAttributes } from 'react';
import { SK, SKFont, bodyFont } from '@/lib/sketch-ui';

interface McInputProps extends InputHTMLAttributes<HTMLInputElement> {}

export function McInput({ style, ...rest }: McInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <input
      style={{
        backgroundColor: '#FFFFFF',
        border: `1px solid ${focused ? SK.borderFocus : 'rgba(0, 0, 0, 0.12)'}`,
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
          ? '0 0 0 3px rgba(59, 130, 246, 0.15)'
          : '0 1px 2px rgba(0, 0, 0, 0.04)',
        ...style,
      }}
      onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
      onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
      {...rest}
    />
  );
}
