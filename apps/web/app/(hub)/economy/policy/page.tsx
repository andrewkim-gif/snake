'use client';

/**
 * /economy/policy — 경제 정책 (placeholder)
 * Phase 3에서 PolicyPanel 컴포넌트 연결
 */

import { SK, bodyFont } from '@/lib/sketch-ui';

export default function PolicyPage() {
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
        ECONOMIC POLICY
      </h1>
      <p style={{
        fontFamily: bodyFont,
        fontSize: '14px',
        color: SK.textSecondary,
      }}>
        Policy panel will be connected in Phase 3.
      </p>
    </div>
  );
}
