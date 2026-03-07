'use client';

/**
 * StatCard — 통계 카드 컴포넌트
 * 대시보드 상단 KPI 표시용
 */

import { SK, bodyFont } from '@/lib/sketch-ui';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string;
  color?: string;
  icon?: LucideIcon;
  subtext?: string;
}

export function StatCard({ label, value, color = SK.textPrimary, icon: Icon, subtext }: StatCardProps) {
  return (
    <div
      style={{
        background: SK.cardBg,
        border: `1px solid ${SK.border}`,
        borderRadius: 0,
        padding: '14px 16px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginBottom: '6px',
        }}
      >
        {Icon && <Icon size={12} strokeWidth={1.8} color={SK.textMuted} />}
        <div
          style={{
            color: SK.textSecondary,
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '1px',
            fontFamily: bodyFont,
          }}
        >
          {label}
        </div>
      </div>
      <div style={{ color, fontSize: '20px', fontWeight: 700, fontFamily: bodyFont }}>
        {value}
      </div>
      {subtext && (
        <div style={{ color: SK.textMuted, fontSize: '10px', fontFamily: bodyFont, marginTop: '2px' }}>
          {subtext}
        </div>
      )}
    </div>
  );
}
