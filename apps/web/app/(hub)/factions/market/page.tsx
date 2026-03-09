'use client';

/**
 * /factions/market — 용병 시장
 * 대시보드 스타일 심플 헤더
 */

import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { SK, SKFont, headingFont, bodyFont } from '@/lib/sketch-ui';
import { LoadingSkeleton } from '@/components/hub';

const MercenaryMarket = dynamic(() => import('@/components/market/MercenaryMarket'), {
  loading: () => <LoadingSkeleton text="" />,
});

export default function MercenaryMarketPage() {
  const tFaction = useTranslations('faction');
  return (
    <div
      style={{
        minHeight: "100vh",
        background: SK.bg,
        color: SK.textPrimary,
        fontFamily: bodyFont,
        padding: 24,
      }}
    >
      {/* Header */}
      <header style={{ marginBottom: 24 }}>
        <h1
          style={{
            fontFamily: headingFont,
            fontSize: SKFont.h1,
            color: SK.gold,
            margin: 0,
          }}
        >
          {tFaction('mercenaryMarket')}
        </h1>
        <p style={{ color: SK.textSecondary, fontSize: SKFont.sm, marginTop: 4 }}>
          {tFaction('mercenaryMarketDesc')}
        </p>
      </header>

      {/* Tab content */}
      <main>
        <MercenaryMarket />
      </main>
    </div>
  );
}
