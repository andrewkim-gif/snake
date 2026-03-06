'use client';

/**
 * /governance/history — 투표 이력 (placeholder)
 * Phase 4에서 VoteHistory 연결
 */

import { SK, bodyFont } from '@/lib/sketch-ui';

export default function VoteHistoryPage() {
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
        VOTE HISTORY
      </h1>
      <p style={{
        fontFamily: bodyFont,
        fontSize: '14px',
        color: SK.textSecondary,
      }}>
        Vote history archive will be connected in Phase 4.
      </p>
    </div>
  );
}
