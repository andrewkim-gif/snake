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
import { SK, SKFont, headingFont, bodyFont, grid } from '@/lib/sketch-ui';
import { DashPanel, CountryFilterBadge } from '@/components/hub';
import { TrendingUp, BarChart3, Layers, Shield, Flame } from 'lucide-react';

import { fetchGdpData, fetchCountries, fetchBuybackHistory, fetchBurnHistory, fetchTokenPrice, fetchDefenseMultipliers } from '@/lib/api-client';
import type { GdpEntry, CountryEconomy, BuybackEntry, BurnEntry, TokenPriceData, DefenseMultiplierData } from '@/lib/api-client';
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
    fetchGdpData,
    { refreshInterval: 30000 },
  );
  const { data: countries, loading: countriesLoading } = useApiData(
    fetchCountries,
    { refreshInterval: 30000 },
  );

  // v30 Task 1-9: 바이백/소각 실데이터 API 연동
  const { data: buybackData } = useApiData(
    () => fetchBuybackHistory(50),
    { refreshInterval: 30000 },
  );
  const { data: burnData } = useApiData(
    () => fetchBurnHistory(50),
    { refreshInterval: 30000 },
  );

  // v30 Task 2-3: $AWW 가격 피드
  const { data: tokenPrice } = useApiData(
    fetchTokenPrice,
    { refreshInterval: 60000 },
  );

  // v30 Task 2-5: 서버 defense multiplier 실데이터
  const { data: defenseData } = useApiData(
    fetchDefenseMultipliers,
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

    // v30 Task 2-4: GDP x $AWW price 기반 market cap (가격 없으면 GDP 직접 매핑 유지)
    const awwPrice = tokenPrice?.price ?? 0;
    const defMultipliers = defenseData?.multipliers ?? {};

    const marketCapData = gdpList.map((g) => {
      const tier = g.tier || 'C';
      // v30 Task 2-4: 실제 가격이 있으면 GDP * price, 없으면 GDP 그대로
      const marketCap = awwPrice > 0 ? (g.gdp || 0) * awwPrice : (g.gdp || 0);
      // v30 Task 2-5: 서버 defense 실데이터가 있으면 사용
      const serverDefense = defMultipliers[g.iso3];
      const defenseMultiplier = serverDefense?.multiplier ?? (TIER_DEFENSE[tier] || 10000);
      return {
        iso3: g.iso3,
        name: g.name || `${g.iso3} Nation`,
        tier,
        marketCap,
        change24h: g.gdpGrowth || 0,
        defenseMultiplier,
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

    // v30 Task 1-9: 서버 API에서 실데이터를 가져옵니다
    const buybacks = (buybackData ?? []).map((b: BuybackEntry) => ({
      iso3: b.iso3,
      gdpTaxAmount: b.gdpTaxAmount,
      tokensReceived: b.tokensReceived,
      timestamp: new Date(b.timestamp).getTime(),
    }));
    const burns = (burnData ?? []).map((b: BurnEntry) => ({
      iso3: b.iso3,
      amount: b.amount,
      reason: b.reason,
      timestamp: new Date(b.timestamp).getTime(),
    }));

    return { marketCapData, stakingData, buybacks, burns };
  }, [gdpEntries, countries, buybackData, burnData, tokenPrice, defenseData]);

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
        <span style={{ fontSize: '13px', color: SK.textMuted }}>
          {tEconomy('noTokenDataDesc') ?? 'GDP data will appear once the game season starts.'}
        </span>
      </div>
    );
  }

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1
              style={{
                fontFamily: headingFont,
                fontSize: SKFont.h1,
                color: SK.gold,
                margin: 0,
              }}
            >
              Token Economy
            </h1>
            <p style={{ color: SK.textSecondary, fontSize: SKFont.sm, marginTop: 4 }}>
              Country token overview, supply and market data
            </p>
          </div>

          {/* v30 Task 2-3: $AWW Price Widget */}
          <div style={{
            background: SK.cardBg,
            border: `1px solid ${SK.border}`,
            borderRadius: 0,
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            minWidth: '240px',
          }}>
            <div>
              <div style={{ fontFamily: headingFont, fontSize: '11px', color: SK.textMuted, letterSpacing: '1px', marginBottom: '2px' }}>
                $AWW PRICE
              </div>
              {tokenPrice && tokenPrice.source !== 'unavailable' ? (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <span style={{ fontFamily: headingFont, fontSize: '20px', color: SK.textPrimary, fontWeight: 700 }}>
                    ${tokenPrice.price < 0.01 ? tokenPrice.price.toFixed(6) : tokenPrice.price.toFixed(4)}
                  </span>
                  <span style={{
                    fontFamily: bodyFont,
                    fontSize: '12px',
                    fontWeight: 600,
                    color: tokenPrice.change24h >= 0 ? SK.green : SK.red,
                  }}>
                    {tokenPrice.change24h >= 0 ? '+' : ''}{tokenPrice.change24h.toFixed(1)}%
                  </span>
                </div>
              ) : (
                <span style={{ fontFamily: bodyFont, fontSize: '13px', color: SK.textMuted }}>
                  Price unavailable
                </span>
              )}
              {tokenPrice && tokenPrice.source !== 'unavailable' && (
                <div style={{ fontFamily: bodyFont, fontSize: '10px', color: SK.textMuted, marginTop: '2px' }}>
                  Source: {tokenPrice.source === 'forge' ? 'Forge Pool' : 'GDP Simulation'}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Tab content */}
      <main>
        {countryParam && (
          <div style={{ marginBottom: 16 }}>
            <CountryFilterBadge
              countryCode={countryParam}
              label={tEconomy('highlighted', { country: countryParam })}
              clearHref="/economy/tokens"
              clearText={tEconomy('clear')}
              accentColor={SK.orange}
            />
          </div>
        )}

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
      </main>
    </div>
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
