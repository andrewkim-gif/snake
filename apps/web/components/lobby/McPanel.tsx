'use client';

/**
 * McPanel — 마크 인벤토리 스타일 다크 패널
 * 솔리드 배경 + 3D 엠보스 인셋 보더
 */

import type { CSSProperties, ReactNode } from 'react';
import { MC, mcPanelShadow } from '@/lib/minecraft-ui';

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
        backgroundColor: MC.panelBg,
        boxShadow: mcPanelShadow(),
        padding: '1rem',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
