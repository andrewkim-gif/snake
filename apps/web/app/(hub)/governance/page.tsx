'use client';

/**
 * /governance — 거버넌스 제안 목록 (placeholder)
 * Phase 4에서 ProposalList + VoteInterface 연결
 */

import { SK, bodyFont } from '@/lib/sketch-ui';

export default function GovernancePage() {
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
        GOVERNANCE
      </h1>
      <p style={{
        fontFamily: bodyFont,
        fontSize: '14px',
        color: SK.textSecondary,
      }}>
        Proposal list and voting interface will be connected in Phase 4.
      </p>
    </div>
  );
}
