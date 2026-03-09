'use client';

/**
 * /economy/trade — 트레이드 마켓 페이지
 * 대시보드 스타일 심플 헤더
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { SK, SKFont, headingFont, bodyFont } from '@/lib/sketch-ui';
import { LoadingSkeleton } from '@/components/hub';

const TradeMarket = dynamic(
  () => import('@/components/economy/TradeMarket'),
  {
    loading: () => <LoadingSkeleton text="" />,
    ssr: false,
  },
);

export default function TradePage() {
  const tEconomy = useTranslations('economy');

  const serverUrl =
    typeof window !== 'undefined'
      ? process.env.NEXT_PUBLIC_SERVER_URL || window.location.origin
      : '';

  const [authToken] = useState('');
  const [currentUserId] = useState('');
  const [factionId] = useState<string | null>(null);

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
          {tEconomy('tradeMarket')}
        </h1>
        <p style={{ color: SK.textSecondary, fontSize: SKFont.sm, marginTop: 4 }}>
          {tEconomy('tradeMarketDesc')}
        </p>
      </header>

      {/* Tab content */}
      <main>
        <TradeMarket
          serverUrl={serverUrl}
          authToken={authToken}
          currentUserId={currentUserId}
          factionId={factionId}
        />
      </main>
    </div>
  );
}
