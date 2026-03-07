'use client';

/**
 * /economy/policy — 경제 정책 페이지
 * DashboardPage 래핑
 */

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { SK, bodyFont } from '@/lib/sketch-ui';
import { DashboardPage, LoadingSkeleton } from '@/components/hub';
import { ScrollText } from 'lucide-react';

const PolicyPanel = dynamic(
  () => import('@/components/economy/PolicyPanel'),
  {
    loading: () => <LoadingSkeleton text="Loading policy panel..." />,
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
    <DashboardPage
      icon={ScrollText}
      title={tEconomy('economicPolicy')}
      description={tEconomy('economicPolicyDesc')}
      accentColor={SK.blue}
      heroImage="/images/hero-economy.png"
    >
      <PolicyPanel
        serverUrl={serverUrl}
        countryISO={countryISO}
        countryName={countryName}
        authToken={authToken}
        currentUserId={currentUserId}
        canEdit={false}
      />
    </DashboardPage>
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
