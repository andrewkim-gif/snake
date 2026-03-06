'use client';

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
        border: `2px solid ${MC.panelBorderDark}`,
        padding: '1rem',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
