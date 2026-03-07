'use client';

/**
 * /economy/policy — 경제 정책 페이지
 * PageHeader 통합 컴포넌트 사용
 */

import { useState, Suspense } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { SK, bodyFont } from '@/lib/sketch-ui';
import { PageHeader } from '@/components/hub';
import { ScrollText } from 'lucide-react';

const PolicyPanel = dynamic(
  () => import('@/components/economy/PolicyPanel'),
  {
    loading: () => (
      <div
        style={{
          background: SK.cardBg,
          border: `1px solid ${SK.border}`,
          borderRadius: '12px',
          padding: '40px',
          textAlign: 'center',
          color: SK.textSecondary,
          fontFamily: bodyFont,
        }}
      >
        Loading policy panel...
      </div>
    ),
    ssr: false,
  },
);

function PolicyPageInner() {
  const tEconomy = useTranslations('economy');
  const searchParams = useSearchParams();
  const countryParam = searchParams.get('country');

  const countryISO = countryParam || 'KOR';
  const countryName = countryParam
    ? `${countryParam} Nation`
    : 'Republic of Korea';

  const serverUrl =
    typeof window !== 'undefined'
      ? process.env.NEXT_PUBLIC_SERVER_URL || window.location.origin
      : '';

  const [authToken] = useState('');
  const [currentUserId] = useState('');

  return (
    <div>
      <PageHeader
        icon={ScrollText}
        title={tEconomy('economicPolicy')}
        description={tEconomy('economicPolicyDesc')}
        accentColor={SK.blue}
        heroImage="/images/hero-economy.png"
      />

      <PolicyPanel
        serverUrl={serverUrl}
        countryISO={countryISO}
        countryName={countryName}
        authToken={authToken}
        currentUserId={currentUserId}
        canEdit={false}
      />
    </div>
  );
}

export default function PolicyPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: '40px', textAlign: 'center', color: SK.textSecondary, fontFamily: bodyFont }}>
          Loading...
        </div>
      }
    >
      <PolicyPageInner />
    </Suspense>
  );
}
