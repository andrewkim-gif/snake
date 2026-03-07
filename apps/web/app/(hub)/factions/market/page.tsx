'use client';

/**
 * /factions/market — 용병 시장
 * DashboardPage 래핑
 */

import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { SK } from '@/lib/sketch-ui';
import { DashboardPage, LoadingSkeleton } from '@/components/hub';
import { ShoppingCart } from 'lucide-react';

const MercenaryMarket = dynamic(() => import('@/components/market/MercenaryMarket'), {
  loading: () => <LoadingSkeleton text="Loading mercenary market..." />,
});

export default function MercenaryMarketPage() {
  const tFaction = useTranslations('faction');
  return (
    <DashboardPage
      icon={ShoppingCart}
      title={tFaction('mercenaryMarket')}
      description={tFaction('mercenaryMarketDesc')}
      accentColor={SK.orange}
      heroImage="/images/hero-factions.png"
    >
      <MercenaryMarket />
    </DashboardPage>
  );
}
