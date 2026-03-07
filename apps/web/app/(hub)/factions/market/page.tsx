'use client';

/**
 * /factions/market — 용병 시장
 * PageHeader 통합 컴포넌트 사용
 */

import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { SK, SKFont, bodyFont } from '@/lib/sketch-ui';
import { PageHeader } from '@/components/hub';
import { ShoppingCart } from 'lucide-react';

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
      <PageHeader
        icon={ShoppingCart}
        title={tFaction('mercenaryMarket')}
        description={tFaction('mercenaryMarketDesc')}
        accentColor={SK.orange}
        heroImage="/images/hero-factions.png"
      />
      <MercenaryMarket />
    </div>
  );
}
