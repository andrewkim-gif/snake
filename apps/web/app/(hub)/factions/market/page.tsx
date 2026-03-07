'use client';

/**
 * /factions/market — 용병 시장
 * MercenaryMarket 컴포넌트 연결
 * Props: factionId (optional), token (optional)
 */

import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { SK, SKFont, headingFont, bodyFont } from '@/lib/sketch-ui';

// Lazy load MercenaryMarket 컴포넌트
const MercenaryMarket = dynamic(() => import('@/components/market/MercenaryMarket'), {
  loading: () => (
    <div style={{ color: SK.textSecondary, fontFamily: bodyFont, fontSize: SKFont.sm, padding: 40, textAlign: 'center' }}>
      Loading mercenary market...
    </div>
  ),
});

export default function MercenaryMarketPage() {
  const tFaction = useTranslations('faction');
  return (
    <div>
      {/* 페이지 헤더 */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{
          fontFamily: headingFont,
          fontWeight: 800,
          fontSize: '24px',
          color: SK.textPrimary,
          letterSpacing: '2px',
          textTransform: 'uppercase',
          margin: 0,
        }}>
          {tFaction('mercenaryMarket')}
        </h1>
        <p style={{
          fontFamily: bodyFont,
          fontSize: '14px',
          color: SK.textSecondary,
          marginTop: 4,
        }}>
          {tFaction('mercenaryMarketDesc')}
        </p>
      </div>

      {/* MercenaryMarket 컴포넌트 */}
      <MercenaryMarket />
    </div>
  );
}
