'use client';

/**
 * McInput — MC 스타일 다크 입력 필드
 * 3px 솔리드 보더 + 포커스 시 밝은 보더
 */

import { useState, type InputHTMLAttributes } from 'react';
import { MC, bodyFont } from '@/lib/minecraft-ui';

interface McInputProps extends InputHTMLAttributes<HTMLInputElement> {}

export function McInput({ style, ...rest }: McInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <input
      style={{
        backgroundColor: MC.inputBg,
        border: `3px solid ${focused ? MC.inputFocusBorder : MC.inputBorder}`,
        color: MC.textPrimary,
        fontFamily: bodyFont,
        fontSize: '15px',
        padding: '10px 14px',
        outline: 'none',
        width: '100%',
        boxSizing: 'border-box',
        textAlign: 'center',
        ...style,
      }}
      onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
      onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
      {...rest}
    />
  );
}
