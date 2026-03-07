'use client';

/**
 * /economy/tokens — 토큰 이코노미 대시보드
 * DashboardPage + mock data 모듈 사용
 */

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import {
  MarketCapChart,
  BuybackBurnHistory,
  StakingOverview,
  DefenseBuffVisualization,
  TokenRanking,
} from '@/app/economy/tokens/components';
import { SK, bodyFont, grid } from '@/lib/sketch-ui';
import { DashboardPage, DashPanel, CountryFilterBadge } from '@/components/hub';
import { generateMockData } from '@/lib/mock-data';
import { TrendingUp, BarChart3, Layers, Shield, Flame } from 'lucide-react';

function TokensPageInner() {
  const tEconomy = useTranslations('economy');
  const searchParams = useSearchParams();
  const countryParam = searchParams.get('country')?.toUpperCase() ?? null;

  const [data, setData] = useState<ReturnType<typeof generateMockData> | null>(null);

  useEffect(() => {
    setData(generateMockData());
    const interval = setInterval(() => {
      setData(generateMockData());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const stats = useMemo(() => {
    if (!data) return null;
    const totalMarketCap = data.marketCapData.reduce((s, e) => s + e.marketCap, 0);
    const totalStaked = data.stakingData.reduce((s, e) => s + e.totalStaked, 0);
    const totalBuybacks = data.buybacks.reduce((s, e) => s + e.tokensReceived, 0);
    const totalBurned = data.burns.reduce((s, e) => s + e.amount, 0);
    return { totalMarketCap, totalStaked, totalBuybacks, totalBurned };
  }, [data]);

  if (!data || !stats) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '50vh',
          color: SK.textSecondary,
          fontFamily: bodyFont,
          fontSize: '16px',
        }}
      >
        {tEconomy('loadingTokens')}
      </div>
    );
  }

  return (
    <DashboardPage
      icon={TrendingUp}
      title={tEconomy('tokenEconomy')}
      description={tEconomy('tokenEconomyDesc')}
      accentColor={SK.orange}
      heroImage="/images/hero-economy.png"
      headerChildren={
        countryParam ? (
          <CountryFilterBadge
            countryCode={countryParam}
            label={tEconomy('highlighted', { country: countryParam })}
            clearHref="/economy/tokens"
            clearText={tEconomy('clear')}
            accentColor={SK.orange}
          />
        ) : undefined
      }
      stats={[
        { label: 'Total Market Cap', value: `$${(stats.totalMarketCap / 1e6).toFixed(2)}M`, color: SK.textPrimary, icon: BarChart3 },
        { label: 'Total Staked', value: `${(stats.totalStaked / 1e6).toFixed(1)}M tokens`, color: SK.orange, icon: Layers },
        { label: 'Buyback Volume', value: `${(stats.totalBuybacks / 1e3).toFixed(1)}K tokens`, color: SK.green, icon: TrendingUp },
        { label: 'Total Burned', value: `${(stats.totalBurned / 1e3).toFixed(1)}K tokens`, color: SK.red, icon: Flame },
      ]}
    >
      {/* Main grid */}
      <div
        className="economy-main-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: grid.panel,
          gap: '16px',
        }}
      >
        <style>{`
          @media (max-width: 767px) {
            .economy-main-grid {
              grid-template-columns: 1fr !important;
              gap: 12px !important;
            }
          }
        `}</style>
        <DashPanel title="Market Cap Ranking" icon={BarChart3} accentColor={SK.orange}>
          <MarketCapChart data={data.marketCapData} maxDisplay={15} />
        </DashPanel>

        <DashPanel title="Token Rankings" icon={TrendingUp} accentColor={SK.blue}>
          <TokenRanking data={data.marketCapData} />
        </DashPanel>

        <DashPanel title="Defense Buff Map" icon={Shield} accentColor={SK.green}>
          <DefenseBuffVisualization data={data.marketCapData} maxDisplay={15} />
        </DashPanel>

        <DashPanel title="Staking Overview" icon={Layers} accentColor={SK.orange}>
          <StakingOverview data={data.stakingData} maxDisplay={15} />
        </DashPanel>

        <DashPanel title="Buyback & Burn History" icon={Flame} accentColor={SK.red} fullWidth>
          <BuybackBurnHistory
            buybacks={data.buybacks}
            burns={data.burns}
            maxDisplay={25}
          />
        </DashPanel>
      </div>
    </DashboardPage>
  );
}

export default function TokensPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '50vh',
            color: SK.textSecondary,
            fontFamily: bodyFont,
            fontSize: '16px',
          }}
        >
          Loading...
        </div>
      }
    >
      <TokensPageInner />
    </Suspense>
  );
}
