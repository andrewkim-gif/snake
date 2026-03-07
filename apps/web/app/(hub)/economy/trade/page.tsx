'use client';

/**
 * /economy/trade — 트레이드 마켓 페이지
 * DashboardPage 래핑
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { SK } from '@/lib/sketch-ui';
import { DashboardPage, LoadingSkeleton } from '@/components/hub';
import { ArrowLeftRight } from 'lucide-react';

const TradeMarket = dynamic(
  () => import('@/components/economy/TradeMarket'),
  {
    loading: () => <LoadingSkeleton text="Loading trade market..." />,
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
    <DashboardPage
      icon={ArrowLeftRight}
      title={tEconomy('tradeMarket')}
      description={tEconomy('tradeMarketDesc')}
      accentColor={SK.green}
      heroImage="/images/hero-economy.png"
    >
      <TradeMarket
        serverUrl={serverUrl}
        authToken={authToken}
        currentUserId={currentUserId}
        factionId={factionId}
      />
    </DashboardPage>
  );
}
