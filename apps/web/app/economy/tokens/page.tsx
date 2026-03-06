'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  MarketCapChart,
  BuybackBurnHistory,
  StakingOverview,
  DefenseBuffVisualization,
  TokenRanking,
} from './components';

/**
 * Token Economy Dashboard
 * /economy/tokens — Real-time overview of all 195 national tokens
 */

// --- Mock data generator (replaced by real API in production) ---
function generateMockData() {
  const tiers = [
    { tier: 'S', count: 8, supply: 50e6, baseCap: 500000 },
    { tier: 'A', count: 20, supply: 30e6, baseCap: 100000 },
    { tier: 'B', count: 40, supply: 20e6, baseCap: 30000 },
    { tier: 'C', count: 68, supply: 10e6, baseCap: 5000 },
    { tier: 'D', count: 59, supply: 5e6, baseCap: 1000 },
  ];

  const countries = [
    'USA','CHN','RUS','IND','BRA','JPN','DEU','GBR', // S
    'KOR','FRA','CAN','AUS','SAU','TUR','IDN','MEX','ITA','ESP',
    'IRN','EGY','PAK','NGA','ISR','POL','ZAF','UKR','NLD','SWE', // A
    'THA','ARG','COL','MYS','PHL','VNM','BGD','NOR','CHE','AUT',
    'BEL','CHL','PER','VEN','IRQ','KWT','ARE','QAT','SGP','FIN',
    'DNK','IRL','PRT','GRC','CZE','ROU','NZL','KAZ','ETH','DZA',
    'MAR','KEN','MMR','TWN','HUN','PRK','CUB','LBY','AGO','COD', // B
  ];

  const marketCapData = [];
  const stakingData = [];
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

// Dashboard panel wrapper
function DashPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: 'rgba(17, 17, 17, 0.95)',
        border: '1px solid rgba(232, 224, 212, 0.08)',
        borderRadius: '12px',
        padding: '16px',
        overflow: 'hidden',
      }}
    >
      <h3
        style={{
          color: '#E8E0D4',
          fontWeight: 700,
          fontSize: '14px',
          margin: '0 0 12px 0',
          textTransform: 'uppercase',
          letterSpacing: '1.5px',
          fontFamily: '"Black Ops One", "Rajdhani", sans-serif',
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

export default function TokenEconomyDashboard() {
  const [data, setData] = useState<ReturnType<typeof generateMockData> | null>(null);

  useEffect(() => {
    // In production, fetch from API: GET /api/economy/tokens
    setData(generateMockData());

    // Refresh every 30 seconds
    const interval = setInterval(() => {
      setData(generateMockData());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Aggregate stats
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
          height: '100vh',
          color: '#8B8B8B',
          fontFamily: '"Rajdhani", sans-serif',
          fontSize: '16px',
        }}
      >
        Loading token economy data...
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#09090B',
        padding: '24px',
        fontFamily: '"Rajdhani", sans-serif',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1
          style={{
            color: '#E8E0D4',
            fontWeight: 700,
            fontSize: '28px',
            margin: '0 0 4px 0',
            fontFamily: '"Black Ops One", "Rajdhani", sans-serif',
          }}
        >
          TOKEN ECONOMY
        </h1>
        <p style={{ color: '#8B8B8B', fontSize: '14px', margin: 0 }}>
          195 National Tokens — Real-time market data, buybacks, staking, and defense buffs
        </p>
      </div>

      {/* Stats summary */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '12px',
          marginBottom: '24px',
        }}
      >
        {[
          { label: 'Total Market Cap', value: `$${(stats.totalMarketCap / 1e6).toFixed(2)}M`, color: '#E8E0D4' },
          { label: 'Total Staked', value: `${(stats.totalStaked / 1e6).toFixed(1)}M tokens`, color: '#CC9933' },
          { label: 'Buyback Volume', value: `${(stats.totalBuybacks / 1e3).toFixed(1)}K tokens`, color: '#4A9E4A' },
          { label: 'Total Burned', value: `${(stats.totalBurned / 1e3).toFixed(1)}K tokens`, color: '#CC3333' },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              background: 'rgba(17, 17, 17, 0.95)',
              border: '1px solid rgba(232, 224, 212, 0.08)',
              borderRadius: '10px',
              padding: '14px 16px',
            }}
          >
            <div style={{ color: '#8B8B8B', fontSize: '11px', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>
              {stat.label}
            </div>
            <div style={{ color: stat.color, fontSize: '20px', fontWeight: 700 }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '16px',
        }}
      >
        {/* Market Cap Chart */}
        <DashPanel title="Market Cap Ranking">
          <MarketCapChart data={data.marketCapData} maxDisplay={15} />
        </DashPanel>

        {/* Token Rankings */}
        <DashPanel title="Token Rankings">
          <TokenRanking data={data.marketCapData} />
        </DashPanel>

        {/* Defense Buff Visualization */}
        <DashPanel title="Defense Buff Map">
          <DefenseBuffVisualization data={data.marketCapData} maxDisplay={15} />
        </DashPanel>

        {/* Staking Overview */}
        <DashPanel title="Staking Overview">
          <StakingOverview data={data.stakingData} maxDisplay={15} />
        </DashPanel>

        {/* Buyback/Burn History — full width */}
        <div style={{ gridColumn: '1 / -1' }}>
          <DashPanel title="Buyback & Burn History">
            <BuybackBurnHistory
              buybacks={data.buybacks}
              burns={data.burns}
              maxDisplay={25}
            />
          </DashPanel>
        </div>
      </div>
    </div>
  );
}
