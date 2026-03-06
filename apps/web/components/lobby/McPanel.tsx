'use client';

/**
 * McPanel — 전술 작전 패널
 * 다크 배경 + 전술 그리드 텍스처 + 코너 타겟 마크
 */

import type { CSSProperties, ReactNode } from 'react';
import { SK, handDrawnRadius, sketchBorder, tacticalBg } from '@/lib/sketch-ui';

interface McPanelProps {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}

const cornerMark: CSSProperties = {
  position: 'absolute',
  color: 'rgba(232,224,212,0.12)',
  fontSize: '10px',
  fontFamily: 'monospace',
  lineHeight: 1,
  pointerEvents: 'none',
  userSelect: 'none',
};

export function McPanel({ children, style, className }: McPanelProps) {
  const tex = tacticalBg();
  return (
    <div
      className={className}
      style={{
        backgroundColor: SK.cardBg,
        borderRadius: handDrawnRadius(3),
        border: sketchBorder(),
        position: 'relative',
        overflow: 'hidden',
        padding: '1.25rem',
        ...tex,
        ...style,
      }}
    >
      <span style={{ ...cornerMark, top: 6, left: 8 }}>+</span>
      <span style={{ ...cornerMark, top: 6, right: 8 }}>+</span>
      <span style={{ ...cornerMark, bottom: 6, left: 8 }}>+</span>
      <span style={{ ...cornerMark, bottom: 6, right: 8 }}>+</span>
      {children}
    </div>
  );
}
