'use client';

/**
 * /economy/policy — 경제 정책 페이지
 * PolicyPanel 컴포넌트를 dynamic import로 연결
 * Hub Layout (Economy sub-tabs) 적용
 */

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { SK, bodyFont } from '@/lib/sketch-ui';

// Dynamic import with skeleton loading
const PolicyPanel = dynamic(
  () => import('@/components/economy/PolicyPanel'),
  {
    loading: () => <PolicyPanelSkeleton />,
    ssr: false,
  },
);

function PolicyPanelSkeleton() {
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
        }}
      >
        <div
          style={{
            width: '180px',
            height: '20px',
            borderRadius: '4px',
            background: `linear-gradient(90deg, ${SK.border} 25%, ${SK.borderDark} 50%, ${SK.border} 75%)`,
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite',
            marginBottom: '6px',
          }}
        />
        <div
          style={{
            width: '120px',
            height: '14px',
            borderRadius: '3px',
            background: `linear-gradient(90deg, ${SK.border} 25%, ${SK.borderDark} 50%, ${SK.border} 75%)`,
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite',
          }}
        />
      </div>

      {/* Sliders skeleton */}
      <div style={{ padding: '16px 20px' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ marginBottom: '20px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '8px',
              }}
            >
              <div
                style={{
                  width: '120px',
                  height: '14px',
                  borderRadius: '3px',
                  background: `linear-gradient(90deg, ${SK.border} 25%, ${SK.borderDark} 50%, ${SK.border} 75%)`,
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 1.5s infinite',
                }}
              />
              <div
                style={{
                  width: '40px',
                  height: '14px',
                  borderRadius: '3px',
                  background: `linear-gradient(90deg, ${SK.border} 25%, ${SK.borderDark} 50%, ${SK.border} 75%)`,
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 1.5s infinite',
                }}
              />
            </div>
            <div
              style={{
                width: '100%',
                height: '6px',
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

function PolicyPageInner() {
  const searchParams = useSearchParams();
  const countryParam = searchParams.get('country');

  // Default to KOR if no country param
  const countryISO = countryParam || 'KOR';
  const countryName = countryParam
    ? `${countryParam} Nation`
    : 'Republic of Korea';

  // Server URL from environment
  const serverUrl =
    typeof window !== 'undefined'
      ? process.env.NEXT_PUBLIC_SERVER_URL || window.location.origin
      : '';

  // TODO: Replace with real auth from wallet connection context
  const [authToken] = useState('');
  const [currentUserId] = useState('');

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
          ECONOMIC POLICY
        </h1>
        <p
          style={{
            fontFamily: bodyFont,
            fontSize: '14px',
            color: SK.textSecondary,
            margin: 0,
          }}
        >
          Configure tax rates, trade openness, military spending, and tech
          investment for your nation
        </p>
      </div>

      {/* PolicyPanel component */}
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
          Loading policy...
        </div>
      }
    >
      <PolicyPageInner />
    </Suspense>
  );
}
