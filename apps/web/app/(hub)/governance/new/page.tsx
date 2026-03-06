'use client';

/**
 * /governance/new — 새 제안 작성 (placeholder)
 * Phase 4에서 ProposalForm 연결
 */

import { SK, bodyFont } from '@/lib/sketch-ui';

export default function NewProposalPage() {
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
        NEW PROPOSAL
      </h1>
      <p style={{
        fontFamily: bodyFont,
        fontSize: '14px',
        color: SK.textSecondary,
      }}>
        Proposal form will be connected in Phase 4.
      </p>
    </div>
  );
}
