'use client';

/**
 * /economy/tokens — 토큰 이코노미 대시보드
 * PageHeader + StatCard + DashPanel 통합 컴포넌트 사용
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
import { SK, bodyFont } from '@/lib/sketch-ui';
import { PageHeader, DashPanel, StatCard } from '@/components/hub';
import { TrendingUp, BarChart3, Layers, Shield, Flame } from 'lucide-react';

// --- Mock data generator ---
function generateMockData() {
  const tiers = [
    { tier: 'S', count: 8, supply: 50e6, baseCap: 500000 },
    { tier: 'A', count: 20, supply: 30e6, baseCap: 100000 },
    { tier: 'B', count: 40, supply: 20e6, baseCap: 30000 },
    { tier: 'C', count: 68, supply: 10e6, baseCap: 5000 },
    { tier: 'D', count: 59, supply: 5e6, baseCap: 1000 },
  ];

  const countries = [
    'USA','CHN','RUS','IND','BRA','JPN','DEU','GBR',
    'KOR','FRA','CAN','AUS','SAU','TUR','IDN','MEX','ITA','ESP',
    'IRN','EGY','PAK','NGA','ISR','POL','ZAF','UKR','NLD','SWE',
    'THA','ARG','COL','MYS','PHL','VNM','BGD','NOR','CHE','AUT',
    'BEL','CHL','PER','VEN','IRQ','KWT','ARE','QAT','SGP','FIN',
    'DNK','IRL','PRT','GRC','CZE','ROU','NZL','KAZ','ETH','DZA',
    'MAR','KEN','MMR','TWN','HUN','PRK','CUB','LBY','AGO','COD',
  ];

  const marketCapData: Array<{
    iso3: string;
    name: string;
    tier: string;
    marketCap: number;
    change24h: number;
    defenseMultiplier: number;
  }> = [];
  const stakingData: Array<{
    iso3: string;
    name: string;
    totalStaked: number;
    totalSupply: number;
    apr: number;
    stakingRatio: number;
  }> = [];
  let idx = 0;

  for (const t of tiers) {
    for (let i = 0; i < Math.min(t.count, 15); i++) {
      const iso3 = countries[idx] || `C${String(idx).padStart(3, '0')}`;
      const cap = t.baseCap * (1 + Math.random() * 3);
      const change = (Math.random() - 0.4) * 20;
      const mult = cap >= 1e8 ? 50000 : cap >= 1e7 ? 30000 : cap >= 1e6 ? 20000 :
                   cap >= 1e5 ? 15000 : cap >= 1e4 ? 12000 : 10000;

      marketCapData.push({
        iso3,
        name: `${iso3} Nation`,
        tier: t.tier,
        marketCap: cap,
        change24h: change,
        defenseMultiplier: mult,
      });

      const stakeRatio = 5 + Math.random() * 25;
      stakingData.push({
        iso3,
        name: `${iso3} Nation`,
        totalStaked: t.supply * (stakeRatio / 100),
        totalSupply: t.supply,
        apr: 500 + Math.floor(Math.random() * 2000),
        stakingRatio: stakeRatio,
      });

      idx++;
    }
  }

  const buybacks = Array.from({ length: 20 }, (_, i) => ({
    iso3: countries[i % countries.length],
    gdpTaxAmount: 100 + Math.random() * 500,
    tokensReceived: 5000 + Math.random() * 50000,
    timestamp: Math.floor(Date.now() / 1000) - i * 300,
  }));

  const burns = Array.from({ length: 8 }, (_, i) => ({
    iso3: countries[i * 3 % countries.length],
    amount: 1000 + Math.random() * 10000,
    reason: i % 2 === 0 ? 'war_victory' : 'deflation',
    timestamp: Math.floor(Date.now() / 1000) - i * 1800,
  }));

  return { marketCapData, stakingData, buybacks, burns };
}

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
    <div style={{ fontFamily: bodyFont }}>
      <PageHeader
        icon={TrendingUp}
        title={tEconomy('tokenEconomy')}
        description={tEconomy('tokenEconomyDesc')}
        accentColor={SK.orange}
        heroImage="/images/hero-economy.png"
      >
        {/* 국가 필터 (deep linking) */}
        {countryParam && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              borderRadius: '8px',
              background: `${SK.orange}15`,
              border: `1px solid ${SK.orange}30`,
              fontSize: '12px',
              color: SK.orange,
              fontWeight: 600,
            }}
          >
            {tEconomy('highlighted', { country: countryParam })}
            <a
              href="/economy/tokens"
              style={{
                color: SK.textSecondary,
                textDecoration: 'none',
                fontSize: '11px',
                marginLeft: '4px',
              }}
            >
              {tEconomy('clear')}
            </a>
          </div>
        )}
      </PageHeader>

      {/* Stats summary */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
          marginBottom: '24px',
        }}
      >
        <StatCard
          label="Total Market Cap"
          value={`$${(stats.totalMarketCap / 1e6).toFixed(2)}M`}
          color={SK.textPrimary}
          icon={BarChart3}
        />
        <StatCard
          label="Total Staked"
          value={`${(stats.totalStaked / 1e6).toFixed(1)}M tokens`}
          color={SK.orange}
          icon={Layers}
        />
        <StatCard
          label="Buyback Volume"
          value={`${(stats.totalBuybacks / 1e3).toFixed(1)}K tokens`}
          color={SK.green}
          icon={TrendingUp}
        />
        <StatCard
          label="Total Burned"
          value={`${(stats.totalBurned / 1e3).toFixed(1)}K tokens`}
          color={SK.red}
          icon={Flame}
        />
      </div>

      {/* Main grid */}
      <div
        className="economy-main-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
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
          @media (min-width: 768px) and (max-width: 1024px) {
            .economy-main-grid {
              grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)) !important;
              gap: 14px !important;
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
    </div>
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
