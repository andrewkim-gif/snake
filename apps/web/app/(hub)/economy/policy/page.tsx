'use client';

/**
 * /economy/policy — 경제 정책 페이지
 * 대시보드 스타일 심플 헤더
 */

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { SK, SKFont, headingFont, bodyFont } from '@/lib/sketch-ui';
import { LoadingSkeleton } from '@/components/hub';

const PolicyPanel = dynamic(
  () => import('@/components/economy/PolicyPanel'),
  {
    loading: () => <LoadingSkeleton text="" />,
    ssr: false,
  },
);

function PolicyPageInner() {
  const searchParams = useSearchParams();
  const countryParam = searchParams.get('country');

  const countryISO = countryParam || 'KOR';
  const countryName = countryParam
    ? `${countryParam}`
    : 'KOR';

  const serverUrl =
    typeof window !== 'undefined'
      ? process.env.NEXT_PUBLIC_SERVER_URL || window.location.origin
      : '';

  const [authToken] = useState('');
  const [currentUserId] = useState('');

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
        <h1
          style={{
            fontFamily: headingFont,
            fontSize: SKFont.h1,
            color: SK.gold,
            margin: 0,
          }}
        >
          Economic Policy
        </h1>
        <p style={{ color: SK.textSecondary, fontSize: SKFont.sm, marginTop: 4 }}>
          Tax rates, treasury allocation, and fiscal strategy
        </p>
      </header>

      {/* Tab content */}
      <main>
        <PolicyPanel
          serverUrl={serverUrl}
          countryISO={countryISO}
          countryName={countryName}
          authToken={authToken}
          currentUserId={currentUserId}
          canEdit={false}
        />
      </main>
    </div>
  );
}

export default function PolicyPage() {
  const t = useTranslations('common');
  return (
    <Suspense
      fallback={
        <div style={{ padding: '40px', textAlign: 'center', color: SK.textSecondary, fontFamily: bodyFont }}>
          {t('loading')}
        </div>
      }
    >
      <PolicyPageInner />
    </Suspense>
  );
}
