'use client';

/**
 * DashPanel — 대시보드 카드 패널
 * 글래스모피즘 + 제목 + 내용 영역
 */

import { SK, bodyFont } from '@/lib/sketch-ui';
import type { LucideIcon } from 'lucide-react';

interface DashPanelProps {
  title: string;
  icon?: LucideIcon;
  accentColor?: string;
  fullWidth?: boolean;
  children: React.ReactNode;
}

export function DashPanel({
  title,
  icon: Icon,
  accentColor,
  fullWidth,
  children,
}: DashPanelProps) {
  return (
    <div
      style={{
        background: SK.cardBg,
        border: `1px solid ${SK.border}`,
        borderRadius: '12px',
        padding: '16px',
        overflow: 'hidden',
        ...(fullWidth ? { gridColumn: '1 / -1' } : {}),
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '12px',
        }}
      >
        {Icon && (
          <Icon
            size={15}
            strokeWidth={1.8}
            color={accentColor ?? SK.textSecondary}
          />
        )}
        <h3
          style={{
            color: SK.textPrimary,
            fontWeight: 700,
            fontSize: '13px',
            margin: 0,
            textTransform: 'uppercase',
            letterSpacing: '1.5px',
            fontFamily: bodyFont,
          }}
        >
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}
