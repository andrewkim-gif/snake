'use client';

/**
 * /governance/new — 새 제안 작성 페이지
 * ProposalForm 컴포넌트 연결
 * URL param ?country=KOR → 해당 국가 pre-select
 * 5종 정책 카테고리 선택
 */

import { Suspense, useCallback, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { SK, bodyFont } from '@/lib/sketch-ui';
import type { ProposalType } from '@/components/governance/types';

// Lazy load ProposalForm
const ProposalForm = dynamic(
  () => import('@/components/governance/ProposalForm'),
  { ssr: false }
);

// 지원 국가 목록 (mock)
const COUNTRIES = [
  { iso3: 'KOR', name: 'Republic of Korea', symbol: '$KOR' },
  { iso3: 'USA', name: 'United States', symbol: '$USA' },
  { iso3: 'JPN', name: 'Japan', symbol: '$JPN' },
  { iso3: 'GBR', name: 'United Kingdom', symbol: '$GBR' },
  { iso3: 'DEU', name: 'Germany', symbol: '$DEU' },
  { iso3: 'FRA', name: 'France', symbol: '$FRA' },
  { iso3: 'CHN', name: 'China', symbol: '$CHN' },
  { iso3: 'BRA', name: 'Brazil', symbol: '$BRA' },
] as const;

function NewProposalPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const countryParam = searchParams.get('country')?.toUpperCase() ?? '';

  // 국가 선택 상태: URL param에서 pre-select
  const [selectedCountry, setSelectedCountry] = useState(
    COUNTRIES.find((c) => c.iso3 === countryParam) ?? null
  );
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = useCallback(
    (data: {
      iso3: string;
      title: string;
      description: string;
      proposalType: ProposalType;
    }) => {
      // Mock 제출: 실제로는 블록체인 트랜잭션
      console.log('[Governance] New proposal submitted:', data);
      setSubmitted(true);
      // 3초 후 목록으로 이동
      setTimeout(() => {
        router.push(`/governance?country=${data.iso3}`);
      }, 3000);
    },
    [router]
  );

  const handleCancel = useCallback(() => {
    router.push('/governance');
  }, [router]);

  // 제출 완료 상태
  if (submitted) {
    return (
      <div
        style={{
          maxWidth: '600px',
          margin: '0 auto',
          padding: '40px 20px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: `${SK.green}20`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            fontSize: '28px',
          }}
        >
          ✓
        </div>
        <h2
          style={{
            fontFamily: bodyFont,
            fontWeight: 700,
            fontSize: '20px',
            color: SK.textPrimary,
            marginBottom: '8px',
          }}
        >
          Proposal Submitted
        </h2>
        <p
          style={{
            fontFamily: bodyFont,
            fontSize: '14px',
            color: SK.textSecondary,
          }}
        >
          Your proposal has been submitted to the governance system.
          Redirecting to proposals...
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      {/* 페이지 헤더 */}
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
          NEW PROPOSAL
        </h1>
        <p
          style={{
            fontFamily: bodyFont,
            fontSize: '14px',
            color: SK.textSecondary,
            margin: 0,
          }}
        >
          Create a governance proposal for a country
        </p>
      </div>

      {/* 국가 선택 (ProposalForm 전에) */}
      {!selectedCountry && (
        <div
          style={{
            background: SK.cardBg,
            border: `1px solid ${SK.border}`,
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '20px',
          }}
        >
          <label
            style={{
              fontFamily: bodyFont,
              color: SK.textSecondary,
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '1px',
              textTransform: 'uppercase',
              display: 'block',
              marginBottom: '12px',
            }}
          >
            SELECT TARGET COUNTRY
          </label>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: '8px',
            }}
          >
            {COUNTRIES.map((country) => (
              <button
                key={country.iso3}
                onClick={() => setSelectedCountry(country)}
                style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: `1px solid ${SK.border}`,
                  background: 'rgba(255,255,255,0.02)',
                  color: SK.textPrimary,
                  fontFamily: bodyFont,
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 150ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = `${SK.orange}10`;
                  e.currentTarget.style.borderColor = `${SK.orange}40`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                  e.currentTarget.style.borderColor = SK.border;
                }}
              >
                <div>{country.name}</div>
                <div
                  style={{
                    fontSize: '11px',
                    color: SK.textSecondary,
                    marginTop: '2px',
                  }}
                >
                  {country.iso3} — {country.symbol}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ProposalForm — 국가 선택 후 표시 */}
      {selectedCountry && (
        <>
          {/* 선택된 국가 표시 */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              borderRadius: '8px',
              background: `${SK.orange}15`,
              border: `1px solid ${SK.orange}30`,
              marginBottom: '16px',
              fontFamily: bodyFont,
              fontSize: '12px',
              color: SK.orange,
              fontWeight: 600,
            }}
          >
            {selectedCountry.name} ({selectedCountry.iso3})
            <button
              onClick={() => setSelectedCountry(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: SK.textSecondary,
                fontSize: '14px',
                cursor: 'pointer',
                padding: '0 2px',
              }}
            >
              x
            </button>
          </div>

          <ProposalForm
            iso3={selectedCountry.iso3}
            tokenSymbol={selectedCountry.symbol.replace('$', '')}
            minTokens={100}
            userBalance={10000}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
          />
        </>
      )}
    </div>
  );
}

export default function NewProposalPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            padding: '40px',
            textAlign: 'center',
            color: SK.textSecondary,
            fontFamily: bodyFont,
          }}
        >
          Loading form...
        </div>
      }
    >
      <NewProposalPageInner />
    </Suspense>
  );
}
