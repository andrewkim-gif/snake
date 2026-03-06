'use client';

/**
 * McPanel — 프리미엄 다크 카드 패널
 * 딥 다크 배경 + 서브틀 보더 + 섀도
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
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4), 0 0 1px rgba(255, 255, 255, 0.04)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
