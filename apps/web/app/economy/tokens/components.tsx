'use client';

import { useMemo } from 'react';
import { formatMarketCap, defenseMultiplierToPercent } from '@/lib/crossx-config';

// --- Types ---

interface MarketCapEntry {
  iso3: string;
  name: string;
  tier: string;
  marketCap: number;
  change24h: number; // percentage
  defenseMultiplier: number;
}

interface BuybackEntry {
  iso3: string;
  gdpTaxAmount: number;
  tokensReceived: number;
  timestamp: number;
}

interface BurnEntry {
  iso3: string;
  amount: number;
  reason: string;
  timestamp: number;
}

interface StakingEntry {
  iso3: string;
  name: string;
  totalStaked: number;
  totalSupply: number;
  apr: number;
  stakingRatio: number; // percentage of supply staked
}

// --- Colors ---

const TIER_COLORS: Record<string, string> = {
  S: '#FF6B6B',
  A: '#CC9933',
  B: '#4A9E4A',
  C: '#6B8CCC',
  D: '#8B8B8B',
};

// ============================================================
// 1. MarketCapChart — Country token market caps (bar chart)
// ============================================================

interface MarketCapChartProps {
  data: MarketCapEntry[];
  maxDisplay?: number;
}

export function MarketCapChart({ data, maxDisplay = 20 }: MarketCapChartProps) {
  const sorted = useMemo(
    () => [...data].sort((a, b) => b.marketCap - a.marketCap).slice(0, maxDisplay),
    [data, maxDisplay]
  );

  const maxCap = sorted[0]?.marketCap || 1;

  return (
    <div style={{ fontFamily: '"Rajdhani", sans-serif' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {sorted.map((entry, idx) => {
          const pct = (entry.marketCap / maxCap) * 100;
          const tierColor = TIER_COLORS[entry.tier] || '#8B8B8B';
          const changeColor = entry.change24h >= 0 ? '#4A9E4A' : '#CC3333';

          return (
            <div key={entry.iso3} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  width: '20px',
                  textAlign: 'right',
                  color: '#8B8B8B',
                  fontSize: '11px',
                  fontWeight: 600,
                }}
              >
                {idx + 1}
              </span>
              <span
                style={{
                  width: '36px',
                  padding: '2px 4px',
                  borderRadius: 0,
                  background: `${tierColor}15`,
                  color: tierColor,
                  fontSize: '11px',
                  fontWeight: 700,
                  textAlign: 'center',
                }}
              >
                {entry.iso3}
              </span>
              <div style={{ flex: 1, position: 'relative', height: '22px' }}>
                <div
                  style={{
                    width: `${Math.max(pct, 2)}%`,
                    height: '100%',
                    background: `linear-gradient(90deg, ${tierColor}40, ${tierColor}15)`,
                    borderRadius: 0,
                    transition: 'width 0.5s ease',
                  }}
                />
                <span
                  style={{
                    position: 'absolute',
                    left: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '11px',
                    color: '#E8E0D4',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {entry.name}
                </span>
              </div>
              <span style={{ width: '70px', textAlign: 'right', color: '#E8E0D4', fontSize: '12px', fontWeight: 600 }}>
                {formatMarketCap(entry.marketCap)}
              </span>
              <span
                style={{
                  width: '50px',
                  textAlign: 'right',
                  color: changeColor,
                  fontSize: '11px',
                  fontWeight: 600,
                }}
              >
                {entry.change24h >= 0 ? '+' : ''}{entry.change24h.toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// 2. BuybackBurnHistory — Timeline of buyback/burn events
// ============================================================

interface BuybackBurnHistoryProps {
  buybacks: BuybackEntry[];
  burns: BurnEntry[];
  maxDisplay?: number;
}

export function BuybackBurnHistory({
  buybacks,
  burns,
  maxDisplay = 30,
}: BuybackBurnHistoryProps) {
  const combined = useMemo(() => {
    const items: Array<{
      type: 'buyback' | 'burn';
      iso3: string;
      amount: number;
      detail: string;
      timestamp: number;
    }> = [];

    for (const b of buybacks) {
      items.push({
        type: 'buyback',
        iso3: b.iso3,
        amount: b.tokensReceived,
        detail: `Tax: ${b.gdpTaxAmount.toFixed(2)} Gold`,
        timestamp: b.timestamp,
      });
    }
    for (const b of burns) {
      items.push({
        type: 'burn',
        iso3: b.iso3,
        amount: b.amount,
        detail: b.reason.replace('_', ' '),
        timestamp: b.timestamp,
      });
    }

    return items.sort((a, b) => b.timestamp - a.timestamp).slice(0, maxDisplay);
  }, [buybacks, burns, maxDisplay]);

  if (combined.length === 0) {
    return (
      <div style={{ color: '#8B8B8B', fontSize: '13px', textAlign: 'center', padding: '20px' }}>
        No buyback or burn events yet.
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        fontFamily: '"Rajdhani", sans-serif',
        maxHeight: '400px',
        overflowY: 'auto',
      }}
    >
      {combined.map((item, idx) => {
        const date = new Date(item.timestamp * 1000);
        const dateStr = date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
        const isBuyback = item.type === 'buyback';

        return (
          <div
            key={`${item.type}-${item.iso3}-${idx}`}
            style={{
              display: 'grid',
              gridTemplateColumns: '60px 40px 1fr auto',
              gap: '8px',
              alignItems: 'center',
              padding: '6px 10px',
              borderRadius: 0,
              background: 'rgba(255,255,255,0.02)',
              borderLeft: `3px solid ${isBuyback ? '#4A9E4A' : '#CC3333'}`,
            }}
          >
            <span style={{ color: '#8B8B8B', fontSize: '10px' }}>{dateStr}</span>
            <span
              style={{
                padding: '1px 4px',
                borderRadius: 0,
                background: isBuyback ? 'rgba(74, 158, 74, 0.15)' : 'rgba(204, 51, 51, 0.15)',
                color: isBuyback ? '#4A9E4A' : '#CC3333',
                fontSize: '10px',
                fontWeight: 700,
                textAlign: 'center',
              }}
            >
              {isBuyback ? 'BUY' : 'BURN'}
            </span>
            <span style={{ color: '#E8E0D4', fontSize: '12px' }}>
              ${item.iso3} — {item.detail}
            </span>
            <span
              style={{
                color: isBuyback ? '#4A9E4A' : '#CC3333',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              {isBuyback ? '+' : '-'}{item.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// 3. StakingOverview — Staking stats by country
// ============================================================

interface StakingOverviewProps {
  data: StakingEntry[];
  maxDisplay?: number;
}

export function StakingOverview({ data, maxDisplay = 20 }: StakingOverviewProps) {
  const sorted = useMemo(
    () => [...data].sort((a, b) => b.stakingRatio - a.stakingRatio).slice(0, maxDisplay),
    [data, maxDisplay]
  );

  return (
    <div style={{ fontFamily: '"Rajdhani", sans-serif' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '40px 1fr 80px 60px 60px',
          gap: '6px',
          padding: '6px 10px',
          fontSize: '10px',
          color: '#8B8B8B',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '1px',
          borderBottom: '1px solid rgba(232, 224, 212, 0.1)',
          marginBottom: '6px',
        }}
      >
        <span>ISO3</span>
        <span>Country</span>
        <span style={{ textAlign: 'right' }}>Staked</span>
        <span style={{ textAlign: 'right' }}>Ratio</span>
        <span style={{ textAlign: 'right' }}>APR</span>
      </div>

      {sorted.map((entry) => (
        <div
          key={entry.iso3}
          style={{
            display: 'grid',
            gridTemplateColumns: '40px 1fr 80px 60px 60px',
            gap: '6px',
            padding: '6px 10px',
            alignItems: 'center',
            borderBottom: '1px solid rgba(232, 224, 212, 0.03)',
          }}
        >
          <span style={{ color: '#CC9933', fontSize: '12px', fontWeight: 700 }}>
            {entry.iso3}
          </span>
          <span style={{ color: '#E8E0D4', fontSize: '12px' }}>{entry.name}</span>
          <span
            style={{ textAlign: 'right', color: '#E8E0D4', fontSize: '12px', fontWeight: 600 }}
          >
            {entry.totalStaked >= 1e6
              ? `${(entry.totalStaked / 1e6).toFixed(1)}M`
              : `${(entry.totalStaked / 1e3).toFixed(1)}K`}
          </span>
          <span style={{ textAlign: 'right', color: '#4A9E4A', fontSize: '12px', fontWeight: 600 }}>
            {entry.stakingRatio.toFixed(1)}%
          </span>
          <span style={{ textAlign: 'right', color: '#CC9933', fontSize: '12px', fontWeight: 600 }}>
            {(entry.apr / 100).toFixed(1)}%
          </span>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// 4. DefenseBuffVisualization — Market cap to buff mapping
// ============================================================

interface DefenseBuffVisualizationProps {
  data: MarketCapEntry[];
  maxDisplay?: number;
}

export function DefenseBuffVisualization({
  data,
  maxDisplay = 15,
}: DefenseBuffVisualizationProps) {
  const sorted = useMemo(
    () =>
      [...data]
        .sort((a, b) => b.defenseMultiplier - a.defenseMultiplier)
        .slice(0, maxDisplay),
    [data, maxDisplay]
  );

  return (
    <div style={{ fontFamily: '"Rajdhani", sans-serif' }}>
      {sorted.map((entry) => {
        const buffPct = Math.min((entry.defenseMultiplier - 10000) / 200, 100); // Scale to 0-100%
        const tierColor = TIER_COLORS[entry.tier] || '#8B8B8B';

        return (
          <div
            key={entry.iso3}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px 0',
            }}
          >
            <span
              style={{
                width: '36px',
                color: tierColor,
                fontSize: '12px',
                fontWeight: 700,
              }}
            >
              {entry.iso3}
            </span>
            <div
              style={{
                flex: 1,
                height: '16px',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: 0,
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <div
                style={{
                  width: `${Math.max(buffPct, 1)}%`,
                  height: '100%',
                  background: `linear-gradient(90deg, #4A9E4A50, #4A9E4A)`,
                  borderRadius: 0,
                  transition: 'width 0.5s ease',
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  right: '6px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: '10px',
                  color: '#E8E0D4',
                  fontWeight: 600,
                }}
              >
                {defenseMultiplierToPercent(entry.defenseMultiplier)}
              </span>
            </div>
            <span style={{ width: '60px', textAlign: 'right', color: '#8B8B8B', fontSize: '11px' }}>
              {formatMarketCap(entry.marketCap)}
            </span>
          </div>
        );
      })}

      {/* Legend */}
      <div
        style={{
          marginTop: '12px',
          padding: '8px 10px',
          background: 'rgba(255,255,255,0.02)',
          borderRadius: 0,
          fontSize: '10px',
          color: '#8B8B8B',
          lineHeight: 1.6,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: '4px', color: '#E8E0D4' }}>
          Defense Buff Tiers
        </div>
        &lt;$10K: +0% | $10K-$100K: +20% | $100K-$1M: +50% | $1M-$10M: +100%
        | $10M-$100M: +200% | $100M+: +400% (cap: +30% in-game)
      </div>
    </div>
  );
}

// ============================================================
// 5. TokenRanking — Top tokens by market cap and growth
// ============================================================

interface TokenRankingProps {
  data: MarketCapEntry[];
}

export function TokenRanking({ data }: TokenRankingProps) {
  const topByCap = useMemo(
    () => [...data].sort((a, b) => b.marketCap - a.marketCap).slice(0, 10),
    [data]
  );

  const topByGrowth = useMemo(
    () => [...data].sort((a, b) => b.change24h - a.change24h).slice(0, 10),
    [data]
  );

  const renderRankList = (
    list: MarketCapEntry[],
    valueFormatter: (e: MarketCapEntry) => string,
    colorFn: (e: MarketCapEntry) => string
  ) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {list.map((entry, idx) => (
        <div
          key={entry.iso3}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 8px',
            borderRadius: 0,
            background: idx === 0 ? 'rgba(204, 153, 51, 0.08)' : 'transparent',
          }}
        >
          <span
            style={{
              width: '18px',
              color: idx < 3 ? '#CC9933' : '#8B8B8B',
              fontSize: '12px',
              fontWeight: 700,
              textAlign: 'right',
            }}
          >
            {idx + 1}
          </span>
          <span style={{ flex: 1, color: '#E8E0D4', fontSize: '13px', fontWeight: 600 }}>
            ${entry.iso3}
          </span>
          <span
            style={{
              color: colorFn(entry),
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            {valueFormatter(entry)}
          </span>
        </div>
      ))}
    </div>
  );

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '16px',
        fontFamily: '"Rajdhani", sans-serif',
      }}
    >
      <div>
        <h4
          style={{
            color: '#E8E0D4',
            fontSize: '13px',
            fontWeight: 700,
            margin: '0 0 8px 0',
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}
        >
          Top 10 by Market Cap
        </h4>
        {renderRankList(topByCap, (e) => formatMarketCap(e.marketCap), () => '#E8E0D4')}
      </div>
      <div>
        <h4
          style={{
            color: '#E8E0D4',
            fontSize: '13px',
            fontWeight: 700,
            margin: '0 0 8px 0',
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}
        >
          Top 10 Gainers (24h)
        </h4>
        {renderRankList(
          topByGrowth,
          (e) => `${e.change24h >= 0 ? '+' : ''}${e.change24h.toFixed(1)}%`,
          (e) => (e.change24h >= 0 ? '#4A9E4A' : '#CC3333')
        )}
      </div>
    </div>
  );
}
