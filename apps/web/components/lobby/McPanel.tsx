'use client';

import type { CSSProperties, ReactNode } from 'react';
import { MCModern } from '@/lib/minecraft-ui';

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
        backgroundColor: MCModern.glassBg,
        backdropFilter: `blur(${MCModern.glassBlur})`,
        WebkitBackdropFilter: `blur(${MCModern.glassBlur})`,
        border: `1px solid ${MCModern.glassBorder}`,
        borderRadius: MCModern.radius,
        padding: '1rem',
        transition: MCModern.transition,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
