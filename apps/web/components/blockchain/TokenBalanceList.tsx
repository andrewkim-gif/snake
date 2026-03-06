'use client';

import { useState, useMemo } from 'react';
import {
  formatTokenAmount,
  formatMarketCap,
  defenseMultiplierToPercent,
  type TokenBalance,
} from '@/lib/crossx-config';

interface TokenBalanceListProps {
  balances: TokenBalance[];
  onTokenSelect?: (iso3: string) => void;
  className?: string;
}

type SortKey = 'balance' | 'marketCap' | 'apr' | 'tier';

const TIER_COLORS: Record<string, string> = {
  S: '#FF6B6B',
  A: '#CC9933',
  B: '#4A9E4A',
  C: '#6B8CCC',
  D: '#8B8B8B',
};

/**
 * Token Balance List
 * Displays all national tokens held by the connected wallet
 */
export default function TokenBalanceList({
  balances,
  onTokenSelect,
  className = '',
}: TokenBalanceListProps) {
  const [sortKey, setSortKey] = useState<SortKey>('balance');
  const [filterTier, setFilterTier] = useState<string>('');

  const sorted = useMemo(() => {
    let filtered = balances;
    if (filterTier) {
      filtered = balances.filter((b) => b.tier === filterTier);
    }

    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case 'balance':
          return parseFloat(b.balance) - parseFloat(a.balance);
        case 'marketCap':
          return b.marketCap - a.marketCap;
        case 'apr':
          return b.stakingAPR - a.stakingAPR;
        case 'tier': {
          const tierOrder: Record<string, number> = { S: 0, A: 1, B: 2, C: 3, D: 4 };
          return (tierOrder[a.tier] ?? 5) - (tierOrder[b.tier] ?? 5);
        }
        default:
          return 0;
      }
    });
  }, [balances, sortKey, filterTier]);

  if (balances.length === 0) {
    return (
      <div
        className={className}
        style={{
          padding: '24px',
          textAlign: 'center',
          color: '#8B8B8B',
          fontFamily: '"Rajdhani", sans-serif',
        }}
      >
        No tokens held. Buy national tokens on the CROSS DEX to support your country.
      </div>
    );
  }

  return (
    <div className={className} style={{ fontFamily: '"Rajdhani", sans-serif' }}>
      {/* Header: Sort + Filter */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          borderBottom: '1px solid rgba(232, 224, 212, 0.1)',
          marginBottom: '8px',
        }}
      >
        <div style={{ display: 'flex', gap: '4px' }}>
          {(['S', 'A', 'B', 'C', 'D'] as const).map((tier) => (
            <button
              key={tier}
              onClick={() => setFilterTier(filterTier === tier ? '' : tier)}
              style={{
                padding: '2px 8px',
                borderRadius: '4px',
                border: `1px solid ${TIER_COLORS[tier]}40`,
                background: filterTier === tier ? `${TIER_COLORS[tier]}30` : 'transparent',
                color: TIER_COLORS[tier],
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {tier}
            </button>
          ))}
        </div>

        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(232, 224, 212, 0.15)',
            borderRadius: '4px',
            color: '#E8E0D4',
            fontSize: '12px',
            padding: '2px 6px',
            cursor: 'pointer',
          }}
        >
          <option value="balance">Balance</option>
          <option value="marketCap">Market Cap</option>
          <option value="apr">APR</option>
          <option value="tier">Tier</option>
        </select>
      </div>

      {/* Token list */}
      <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
        {sorted.map((token) => (
          <div
            key={token.iso3}
            onClick={() => onTokenSelect?.(token.iso3)}
            style={{
              display: 'grid',
              gridTemplateColumns: '40px 1fr auto',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 12px',
              borderBottom: '1px solid rgba(232, 224, 212, 0.05)',
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = 'transparent')
            }
          >
            {/* Tier badge */}
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: `${TIER_COLORS[token.tier]}20`,
                border: `1px solid ${TIER_COLORS[token.tier]}40`,
                color: TIER_COLORS[token.tier],
                fontWeight: 800,
                fontSize: '13px',
              }}
            >
              {token.symbol}
            </div>

            {/* Token info */}
            <div>
              <div
                style={{
                  color: '#E8E0D4',
                  fontWeight: 600,
                  fontSize: '14px',
                  lineHeight: 1.2,
                }}
              >
                {token.name}
              </div>
              <div
                style={{
                  color: '#8B8B8B',
                  fontSize: '11px',
                  display: 'flex',
                  gap: '8px',
                  marginTop: '2px',
                }}
              >
                <span>{formatMarketCap(token.marketCap)}</span>
                <span style={{ color: '#4A9E4A' }}>
                  {defenseMultiplierToPercent(token.defenseMultiplier)} DEF
                </span>
                <span style={{ color: '#CC9933' }}>
                  {(token.stakingAPR / 100).toFixed(1)}% APR
                </span>
              </div>
            </div>

            {/* Balance */}
            <div style={{ textAlign: 'right' }}>
              <div
                style={{
                  color: '#E8E0D4',
                  fontWeight: 600,
                  fontSize: '14px',
                }}
              >
                {formatTokenAmount(token.balance)}
              </div>
              {parseFloat(token.stakedBalance) > 0 && (
                <div style={{ color: '#CC9933', fontSize: '11px' }}>
                  {formatTokenAmount(token.stakedBalance)} staked
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
