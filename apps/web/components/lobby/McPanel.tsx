'use client';

/**
 * McPanel — Apex 스타일 패널
 * 직각 + 상단 레드 악센트 라인 1px
 */

import type { CSSProperties, ReactNode } from 'react';
import { SK, sketchBorder } from '@/lib/sketch-ui';

interface McPanelProps {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
  /** 상단 악센트 라인 색상 (기본: SK.accent) */
  accentColor?: string;
  /** 악센트 라인 비활성화 */
  noAccent?: boolean;
}

export function McPanel({ children, style, className, accentColor, noAccent }: McPanelProps) {
  const lineColor = accentColor || SK.accent;

  return (
    <div
      className={className}
      style={{
        backgroundColor: SK.cardBg,
        borderRadius: 0,
        border: sketchBorder(),
        borderTop: noAccent ? sketchBorder() : `1px solid ${lineColor}`,
        position: 'relative',
        overflow: 'hidden',
        padding: '1.25rem',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
