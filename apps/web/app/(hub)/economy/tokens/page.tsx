'use client';

/**
 * /economy/tokens — 토큰 이코노미 대시보드 (placeholder)
 * Phase 3에서 기존 app/economy/tokens 컴포넌트를 마이그레이션
 */

import { SK, bodyFont } from '@/lib/sketch-ui';

export default function TokensPage() {
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
        TOKEN ECONOMY
      </h1>
      <p style={{
        fontFamily: bodyFont,
        fontSize: '14px',
        color: SK.textSecondary,
      }}>
        Token dashboard will be connected in Phase 3.
      </p>
    </div>
  );
}
