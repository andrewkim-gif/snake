'use client';

/**
 * /factions — 팩션 목록 (placeholder)
 * Phase 5에서 FactionList + FactionDashboard 연결
 */

import { SK, bodyFont } from '@/lib/sketch-ui';

export default function FactionsPage() {
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
        FACTIONS
      </h1>
      <p style={{
        fontFamily: bodyFont,
        fontSize: '14px',
        color: SK.textSecondary,
      }}>
        Faction list and dashboard will be connected in Phase 5.
      </p>
    </div>
  );
}
