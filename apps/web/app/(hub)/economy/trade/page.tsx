'use client';

/**
 * /economy/trade — 트레이드 마켓 (placeholder)
 * Phase 3에서 TradeMarket 컴포넌트 연결
 */

import { SK, bodyFont } from '@/lib/sketch-ui';

export default function TradePage() {
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
        TRADE MARKET
      </h1>
      <p style={{
        fontFamily: bodyFont,
        fontSize: '14px',
        color: SK.textSecondary,
      }}>
        Trade market will be connected in Phase 3.
      </p>
    </div>
  );
}
