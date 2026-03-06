'use client';

/**
 * McPanel — 클린 카드 패널
 * 화이트 배경 + 라운드 코너 + 서브틀 섀도
 */

import type { CSSProperties, ReactNode } from 'react';
import { SK, sketchBorder } from '@/lib/sketch-ui';

interface McPanelProps {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}

export function McPanel({ children, style, className }: McPanelProps) {
  return (
    <div
      className={className}
      style={{
        backgroundColor: SK.cardBg,
        borderRadius: '12px',
        border: sketchBorder(),
        position: 'relative',
        overflow: 'hidden',
        padding: '1.25rem',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
