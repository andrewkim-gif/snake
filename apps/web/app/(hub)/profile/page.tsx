'use client';

/**
 * /profile — 프로필 (placeholder)
 * Phase 5에서 Achievements + WalletConnect + Stats 연결
 */

import { SK, bodyFont } from '@/lib/sketch-ui';

export default function ProfilePage() {
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
        PROFILE
      </h1>
      <p style={{
        fontFamily: bodyFont,
        fontSize: '14px',
        color: SK.textSecondary,
      }}>
        Agent profile, achievements and wallet will be connected in Phase 5.
      </p>
    </div>
  );
}
