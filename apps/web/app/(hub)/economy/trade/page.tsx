'use client';

/**
 * /economy/trade — 트레이드 마켓 페이지
 * PageHeader 통합 컴포넌트 사용
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { SK, bodyFont } from '@/lib/sketch-ui';
import { PageHeader } from '@/components/hub';
import { ArrowLeftRight } from 'lucide-react';

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
      </div>
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
                flex: 1,
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
  const tEconomy = useTranslations('economy');

  const serverUrl =
    typeof window !== 'undefined'
      ? process.env.NEXT_PUBLIC_SERVER_URL || window.location.origin
      : '';

  const [authToken] = useState('');
  const [currentUserId] = useState('');
  const [factionId] = useState<string | null>(null);

  return (
    <div>
      <PageHeader
        icon={ArrowLeftRight}
        title={tEconomy('tradeMarket')}
        description={tEconomy('tradeMarketDesc')}
        accentColor={SK.green}
        heroImage="/images/hero-economy.png"
      />

      <TradeMarket
        serverUrl={serverUrl}
        authToken={authToken}
        currentUserId={currentUserId}
        factionId={factionId}
      />
    </div>
  );
}
