'use client';

/**
 * /economy/tokens --- 토큰 이코노미 대시보드
 * DashboardPage + API 데이터 (서버 연동)
 */

import { useMemo, Suspense } from 'react';
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
import { TrendingUp, BarChart3, Layers, Shield, Flame } from 'lucide-react';

import { fetchGdpData, fetchCountries } from '@/lib/api-client';
import type { GdpEntry, CountryEconomy } from '@/lib/api-client';
import { useApiData } from '@/hooks/useApiData';
import { ServerRequired } from '@/components/ui/ServerRequired';

// 티어별 기본 공급량 (staking 계산용)
const TIER_SUPPLY: Record<string, number> = {
  S: 50e6,
  A: 30e6,
  B: 20e6,
  C: 10e6,
  D: 5e6,
};

// 티어별 기본 defense multiplier
const TIER_DEFENSE: Record<string, number> = {
  S: 50000,
  A: 30000,
  B: 20000,
  C: 15000,
  D: 10000,
};

function TokensPageInner() {
  const tEconomy = useTranslations('economy');
  const searchParams = useSearchParams();
  const countryParam = searchParams.get('country')?.toUpperCase() ?? null;

  const { data: gdpEntries, loading: gdpLoading } = useApiData(
    () => fetchGdpData(),
    { refreshInterval: 30000 },
  );
  const { data: countries, loading: countriesLoading } = useApiData(
    () => fetchCountries(),
    { refreshInterval: 30000 },
  );

  // GDP + countries 데이터를 조합하여 기존 mock 형식에 맞게 변환
  const data = useMemo(() => {
    const gdpList = gdpEntries || [];
    const countryList = countries || [];

    // GDP 데이터를 iso3 기준 맵으로
    const gdpMap = new Map<string, GdpEntry>();
    for (const g of gdpList) {
      gdpMap.set(g.iso3, g);
    }

    // marketCapData: GDP/countries 데이터로 생성
    const marketCapData = gdpList.map((g) => {
      const tier = g.tier || 'C';
      return {
        iso3: g.iso3,
        name: g.name || `${g.iso3} Nation`,
        tier,
        marketCap: g.gdp || 0,
        change24h: g.gdpGrowth || 0,
        defenseMultiplier: TIER_DEFENSE[tier] || 10000,
      };
    });

    // stakingData: countries 데이터에서 생성 (기본 staking 비율 적용)
    const stakingData = gdpList.map((g) => {
      const tier = g.tier || 'C';
      const supply = TIER_SUPPLY[tier] || 10e6;
      const stakingRatio = 10 + (g.gdp > 0 ? Math.min((g.gdp / 1e6) * 2, 20) : 0);
      return {
        iso3: g.iso3,
        name: g.name || `${g.iso3} Nation`,
        totalStaked: supply * (stakingRatio / 100),
        totalSupply: supply,
        apr: 500 + Math.floor(Math.min(g.gdpGrowth * 100, 2000)),
        stakingRatio,
      };
    });

    // buybacks / burns: 서버 API 미존재, 추후 추가
    const buybacks: Array<{
      iso3: string;
      gdpTaxAmount: number;
      tokensReceived: number;
      timestamp: number;
    }> = [];
    const burns: Array<{
      iso3: string;
      amount: number;
      reason: string;
      timestamp: number;
    }> = [];

    return { marketCapData, stakingData, buybacks, burns };
  }, [gdpEntries, countries]);

  const stats = useMemo(() => {
    if (!data) return null;
    const totalMarketCap = data.marketCapData.reduce((s, e) => s + e.marketCap, 0);
    const totalStaked = data.stakingData.reduce((s, e) => s + e.totalStaked, 0);
    const totalBuybacks = data.buybacks.reduce((s, e) => s + e.tokensReceived, 0);
    const totalBurned = data.burns.reduce((s, e) => s + e.amount, 0);
    return { totalMarketCap, totalStaked, totalBuybacks, totalBurned };
  }, [data]);

  const isLoading = gdpLoading || countriesLoading;

  if (isLoading) {
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

  if (!stats || data.marketCapData.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '50vh',
          color: SK.textSecondary,
          fontFamily: bodyFont,
          gap: '12px',
        }}
      >
        <TrendingUp size={32} style={{ color: SK.orange, opacity: 0.5 }} />
        <span style={{ fontSize: '16px', fontWeight: 600 }}>
          {tEconomy('noTokenData') ?? 'Token economy data not available yet'}
        </span>
        <span style={{ fontSize: '13px', color: SK.textTertiary }}>
          {tEconomy('noTokenDataDesc') ?? 'GDP data will appear once the game season starts.'}
        </span>
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
        { label: tEconomy('totalMarketCap'), value: `$${(stats.totalMarketCap / 1e6).toFixed(2)}M`, color: SK.textPrimary, icon: BarChart3 },
        { label: tEconomy('totalStaked'), value: `${(stats.totalStaked / 1e6).toFixed(1)}M ${tEconomy('tokenUnit')}`, color: SK.orange, icon: Layers },
        { label: tEconomy('buybackVolume'), value: `${(stats.totalBuybacks / 1e3).toFixed(1)}K ${tEconomy('tokenUnit')}`, color: SK.green, icon: TrendingUp },
        { label: tEconomy('totalBurned'), value: `${(stats.totalBurned / 1e3).toFixed(1)}K ${tEconomy('tokenUnit')}`, color: SK.red, icon: Flame },
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
        <DashPanel title={tEconomy('marketCapRanking')} icon={BarChart3} accentColor={SK.orange}>
          <MarketCapChart data={data.marketCapData} maxDisplay={15} />
        </DashPanel>

        <DashPanel title={tEconomy('tokenRankings')} icon={TrendingUp} accentColor={SK.blue}>
          <TokenRanking data={data.marketCapData} />
        </DashPanel>

        <DashPanel title={tEconomy('defenseBuffMap')} icon={Shield} accentColor={SK.green}>
          <DefenseBuffVisualization data={data.marketCapData} maxDisplay={15} />
        </DashPanel>

        <DashPanel title={tEconomy('stakingOverview')} icon={Layers} accentColor={SK.orange}>
          <StakingOverview data={data.stakingData} maxDisplay={15} />
        </DashPanel>

        <DashPanel title={tEconomy('buybackBurnHistory')} icon={Flame} accentColor={SK.red} fullWidth>
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
  const t = useTranslations('economy');
  return (
    <ServerRequired>
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
            {t('loadingTokens')}
          </div>
        }
      >
        <TokensPageInner />
      </Suspense>
    </ServerRequired>
  );
}
