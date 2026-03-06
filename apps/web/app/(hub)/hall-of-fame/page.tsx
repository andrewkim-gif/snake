'use client';

/**
 * /hall-of-fame — 명예의 전당 (placeholder)
 * Phase 5에서 HallOfFame + SeasonTimeline 연결
 */

import { SK, bodyFont } from '@/lib/sketch-ui';

export default function HallOfFamePage() {
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
        HALL OF FAME
      </h1>
      <p style={{
        fontFamily: bodyFont,
        fontSize: '14px',
        color: SK.textSecondary,
      }}>
        Hall of fame and season timeline will be connected in Phase 5.
      </p>
    </div>
  );
}
