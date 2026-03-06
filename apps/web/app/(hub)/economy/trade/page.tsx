'use client';

/**
 * /economy/trade — 트레이드 마켓 페이지
 * TradeMarket 컴포넌트를 dynamic import로 연결
 * Hub Layout (Economy sub-tabs) 적용
 */

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { SK, bodyFont } from '@/lib/sketch-ui';

// Dynamic import with skeleton loading
const TradeMarket = dynamic(
  () => import('@/components/economy/TradeMarket'),
  {
    loading: () => <TradeMarketSkeleton />,
    ssr: false,
  },
);

function TradeMarketSkeleton() {
  return (
    <div
      style={{
        background: SK.cardBg,
        border: `1px solid ${SK.border}`,
        borderRadius: '12px',
        overflow: 'hidden',
      }}
    >
      {/* Header skeleton */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${SK.borderDark}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            width: '160px',
            height: '20px',
            borderRadius: '4px',
            background: `linear-gradient(90deg, ${SK.border} 25%, ${SK.borderDark} 50%, ${SK.border} 75%)`,
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite',
          }}
        />
        <div style={{ display: 'flex', gap: '4px' }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              style={{
                width: '36px',
                height: '24px',
                borderRadius: '4px',
                background: `linear-gradient(90deg, ${SK.border} 25%, ${SK.borderDark} 50%, ${SK.border} 75%)`,
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s infinite',
              }}
            />
          ))}
        </div>
      </div>

      {/* Tab skeleton */}
      <div
        style={{
          display: 'flex',
          borderBottom: `1px solid ${SK.borderDark}`,
        }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              padding: '10px',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: '80px',
                height: '14px',
                borderRadius: '3px',
                background: `linear-gradient(90deg, ${SK.border} 25%, ${SK.borderDark} 50%, ${SK.border} 75%)`,
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s infinite',
              }}
            />
          </div>
        ))}
      </div>

      {/* Content skeleton */}
      <div style={{ padding: '16px 20px', minHeight: '300px' }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '8px 0',
              borderBottom: `1px solid ${SK.borderDark}`,
            }}
          >
            <div
              style={{
                width: '48px',
                height: '16px',
                borderRadius: '3px',
                background: `linear-gradient(90deg, ${SK.border} 25%, ${SK.borderDark} 50%, ${SK.border} 75%)`,
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s infinite',
              }}
            />
            <div
              style={{
                flex: 1,
                height: '16px',
                borderRadius: '3px',
                background: `linear-gradient(90deg, ${SK.border} 25%, ${SK.borderDark} 50%, ${SK.border} 75%)`,
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s infinite',
              }}
            />
            <div
              style={{
                width: '60px',
                height: '16px',
                borderRadius: '3px',
                background: `linear-gradient(90deg, ${SK.border} 25%, ${SK.borderDark} 50%, ${SK.border} 75%)`,
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s infinite',
              }}
            />
          </div>
        ))}
      </div>

      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}

export default function TradePage() {
  // Server URL from environment, fallback to current origin
  const serverUrl =
    typeof window !== 'undefined'
      ? process.env.NEXT_PUBLIC_SERVER_URL || window.location.origin
      : '';

  // TODO: Replace with real auth from wallet connection context
  const [authToken] = useState('');
  const [currentUserId] = useState('');
  const [factionId] = useState<string | null>(null);

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: '20px' }}>
        <h1
          style={{
            fontFamily: bodyFont,
            fontWeight: 800,
            fontSize: '24px',
            color: SK.textPrimary,
            letterSpacing: '2px',
            textTransform: 'uppercase',
            marginBottom: '4px',
          }}
        >
          TRADE MARKET
        </h1>
        <p
          style={{
            fontFamily: bodyFont,
            fontSize: '14px',
            color: SK.textSecondary,
            margin: 0,
          }}
        >
          Global resource exchange — trade Oil, Minerals, Food, Tech, Manpower, and
          Influence between factions
        </p>
      </div>

      {/* TradeMarket component */}
      <TradeMarket
        serverUrl={serverUrl}
        authToken={authToken}
        currentUserId={currentUserId}
        factionId={factionId}
      />
    </div>
  );
}
