'use client';

/**
 * /dashboard — Agent API 대시보드 (placeholder)
 * Phase 5에서 기존 app/dashboard/page.tsx 마이그레이션
 */

import { SK, bodyFont } from '@/lib/sketch-ui';

export default function DashboardPage() {
  return (
    <div>
      <h1 style={{
        fontFamily: bodyFont,
        fontWeight: 800,
        fontSize: '24px',
        color: SK.textPrimary,
        letterSpacing: '2px',
        textTransform: 'uppercase',
        marginBottom: '8px',
      }}>
        AGENT DASHBOARD
      </h1>
      <p style={{
        fontFamily: bodyFont,
        fontSize: '14px',
        color: SK.textSecondary,
      }}>
        Agent API dashboard will be migrated in Phase 5.
      </p>
    </div>
  );
}
