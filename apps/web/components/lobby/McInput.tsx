'use client';

/**
 * McInput — 작전 지도 스타일 입력 필드
 * 다크 배경 + 손그림 아웃라인 보더 + 포커스 앰버 글로우
 */

import { useState, type InputHTMLAttributes } from 'react';
import { SK, SKFont, bodyFont, handDrawnRadius } from '@/lib/sketch-ui';

interface McInputProps extends InputHTMLAttributes<HTMLInputElement> {}

export function McInput({ style, ...rest }: McInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <input
      style={{
        backgroundColor: SK.bg,
        border: `1.5px solid ${focused ? SK.borderFocus : SK.border}`,
        borderRadius: handDrawnRadius(2),
        color: SK.textPrimary,
        fontFamily: bodyFont,
        fontWeight: 500,
        fontSize: '16px',
        padding: '10px 14px',
        minHeight: '44px',
        outline: 'none',
        width: '100%',
        boxSizing: 'border-box',
        textAlign: 'center',
        transition: 'all 150ms ease',
        boxShadow: focused
          ? `0 0 0 2px ${SK.gold}20`
          : 'none',
        ...style,
      }}
      onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
      onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
      {...rest}
    />
  );
}
