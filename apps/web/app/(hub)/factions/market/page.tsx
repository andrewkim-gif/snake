'use client';

/**
 * /factions/market — 용병 시장 (placeholder)
 * Phase 5에서 MercenaryMarket 연결
 */

import { SK, bodyFont } from '@/lib/sketch-ui';

export default function MercenaryMarketPage() {
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
        MERCENARY MARKET
      </h1>
      <p style={{
        fontFamily: bodyFont,
        fontSize: '14px',
        color: SK.textSecondary,
      }}>
        Mercenary market will be connected in Phase 5.
      </p>
    </div>
  );
}
