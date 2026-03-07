'use client';

import {
  formatMarketCap,
  defenseMultiplierToPercent,
  type TokenBalance,
} from '@/lib/crossx-config';

interface CountryTokenInfoProps {
  token: TokenBalance | null;
  className?: string;
}

const TIER_LABELS: Record<string, string> = {
  S: 'Superpower',
  A: 'Major Power',
  B: 'Regional Power',
  C: 'Developing',
  D: 'Micro State',
};

const TIER_COLORS: Record<string, string> = {
  S: '#FF6B6B',
  A: '#CC9933',
  B: '#4A9E4A',
  C: '#6B8CCC',
  D: '#8B8B8B',
};

/**
 * Country Token Info
 * Displayed in the CountryPanel to show token-related data
 * (market cap, defense buff, staking APY, tier)
 */
export default function CountryTokenInfo({
  token,
  className = '',
}: CountryTokenInfoProps) {
  if (!token) {
    return (
      <div
        className={className}
        style={{
          padding: '12px',
          background: 'rgba(255,255,255,0.02)',
          borderRadius: 0,
          border: '1px solid rgba(232, 224, 212, 0.05)',
          fontFamily: '"Rajdhani", sans-serif',
          color: '#8B8B8B',
          fontSize: '12px',
          textAlign: 'center',
        }}
      >
        Token data unavailable
      </div>
    );
  }

  const tierColor = TIER_COLORS[token.tier] || '#8B8B8B';
  const tierLabel = TIER_LABELS[token.tier] || token.tier;
  const aprPercent = (token.stakingAPR / 100).toFixed(1);
  const defBuff = defenseMultiplierToPercent(token.defenseMultiplier);

  return (
    <div
      className={className}
      style={{
        padding: '12px',
        background: 'rgba(255,255,255,0.02)',
        borderRadius: 0,
        border: '1px solid rgba(232, 224, 212, 0.05)',
        fontFamily: '"Rajdhani", sans-serif',
      }}
    >
      {/* Token header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              padding: '2px 6px',
              borderRadius: 0,
              background: `${tierColor}20`,
              border: `1px solid ${tierColor}40`,
              color: tierColor,
              fontSize: '11px',
              fontWeight: 800,
            }}
          >
            {token.tier}
          </span>
          <span style={{ color: '#E8E0D4', fontWeight: 600, fontSize: '14px' }}>
            ${token.symbol}
          </span>
        </div>
        <span style={{ color: '#8B8B8B', fontSize: '11px' }}>{tierLabel}</span>
      </div>

      {/* Stats grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
        }}
      >
        {/* Market Cap */}
        <div
          style={{
            padding: '8px',
            background: 'rgba(255,255,255,0.02)',
            borderRadius: 0,
          }}
        >
          <div style={{ color: '#8B8B8B', fontSize: '10px', marginBottom: '2px' }}>
            MARKET CAP
          </div>
          <div style={{ color: '#E8E0D4', fontWeight: 700, fontSize: '14px' }}>
            {formatMarketCap(token.marketCap)}
          </div>
        </div>

        {/* Defense Buff */}
        <div
          style={{
            padding: '8px',
            background: 'rgba(74, 158, 74, 0.05)',
            borderRadius: 0,
          }}
        >
          <div style={{ color: '#8B8B8B', fontSize: '10px', marginBottom: '2px' }}>
            DEFENSE BUFF
          </div>
          <div style={{ color: '#4A9E4A', fontWeight: 700, fontSize: '14px' }}>
            {defBuff}
          </div>
        </div>

        {/* Staking APR */}
        <div
          style={{
            padding: '8px',
            background: 'rgba(204, 153, 51, 0.05)',
            borderRadius: 0,
          }}
        >
          <div style={{ color: '#8B8B8B', fontSize: '10px', marginBottom: '2px' }}>
            STAKING APR
          </div>
          <div style={{ color: '#CC9933', fontWeight: 700, fontSize: '14px' }}>
            {aprPercent}%
          </div>
        </div>

        {/* Your Balance */}
        <div
          style={{
            padding: '8px',
            background: 'rgba(255,255,255,0.02)',
            borderRadius: 0,
          }}
        >
          <div style={{ color: '#8B8B8B', fontSize: '10px', marginBottom: '2px' }}>
            YOUR BALANCE
          </div>
          <div style={{ color: '#E8E0D4', fontWeight: 700, fontSize: '14px' }}>
            {parseFloat(token.balance) > 0
              ? Number(parseFloat(token.balance) / 1e18).toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })
              : '0'}
          </div>
        </div>
      </div>
    </div>
  );
}
