'use client';

/**
 * /governance/new — 새 제안 작성 페이지
 * DashboardPage(maxWidth 700) + API 연동
 */

import { Suspense, useCallback, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { SK, bodyFont } from '@/lib/sketch-ui';
import { DashboardPage } from '@/components/hub';
import { fetchCountries, postCouncilProposal, CountryEconomy } from '@/lib/api-client';
import { useApiData } from '@/hooks/useApiData';
import { ServerRequired } from '@/components/ui/ServerRequired';
import { Plus } from 'lucide-react';
import type { ProposalType } from '@/components/governance/types';

const ProposalForm = dynamic(
  () => import('@/components/governance/ProposalForm'),
  { ssr: false }
);

/** CountryEconomy -> country selection item */
interface CountryItem {
  iso3: string;
  name: string;
  symbol: string;
}

function toCountryItem(c: CountryEconomy): CountryItem {
  return {
    iso3: c.iso3,
    name: c.iso3, // API에서 name이 없으므로 iso3 사용
    symbol: `$${c.iso3}`,
  };
}

function NewProposalPageInner() {
  const tGov = useTranslations('governance');
  const searchParams = useSearchParams();
  const router = useRouter();
  const countryParam = searchParams.get('country')?.toUpperCase() ?? '';

  const { data: rawCountries, loading } = useApiData(() => fetchCountries());

  const countries = useMemo(() => (rawCountries || []).map(toCountryItem), [rawCountries]);

  const [selectedCountry, setSelectedCountry] = useState<CountryItem | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // countryParam이 있으면 countries 로드 후 자동 선택
  useMemo(() => {
    if (countryParam && countries.length > 0 && !selectedCountry) {
      const found = countries.find((c) => c.iso3 === countryParam);
      if (found) setSelectedCountry(found);
    }
  }, [countryParam, countries, selectedCountry]);

  const handleSubmit = useCallback(
    async (data: {
      iso3: string;
      title: string;
      description: string;
      proposalType: ProposalType;
    }) => {
      await postCouncilProposal({
        iso3: data.iso3,
        proposer: '', // 서버에서 세션 기반 할당
        title: data.title,
        description: data.description,
        proposalType: data.proposalType,
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 86400 * 3 * 1000).toISOString(),
      });
      setSubmitted(true);
      setTimeout(() => {
        router.push(`/governance?country=${data.iso3}`);
      }, 3000);
    },
    [router]
  );

  const handleCancel = useCallback(() => {
    router.push('/governance');
  }, [router]);

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
            borderRadius: 0,
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
          {tGov('proposalSubmitted')}
        </h2>
        <p
          style={{
            fontFamily: bodyFont,
            fontSize: '14px',
            color: SK.textSecondary,
          }}
        >
          {tGov('proposalSubmittedDesc')}
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: SK.textSecondary, fontFamily: bodyFont }}>
        Loading countries...
      </div>
    );
  }

  return (
    <DashboardPage
      icon={Plus}
      title={tGov('newProposal')}
      description={tGov('createProposal')}
      accentColor={SK.green}
      heroImage="/images/hero-governance.png"
      maxWidth={700}
    >
      {/* 국가 선택 (ProposalForm 전에) */}
      {!selectedCountry && (
        <div
          style={{
            background: SK.cardBg,
            border: `1px solid ${SK.border}`,
            borderRadius: 0,
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
            {tGov('selectCountry')}
          </label>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: '8px',
            }}
          >
            {countries.map((country) => (
              <button
                key={country.iso3}
                onClick={() => setSelectedCountry(country)}
                style={{
                  padding: '12px 16px',
                  borderRadius: 0,
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
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              borderRadius: 0,
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
    </DashboardPage>
  );
}

export default function NewProposalPage() {
  return (
    <ServerRequired>
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
            ...
          </div>
        }
      >
        <NewProposalPageInner />
      </Suspense>
    </ServerRequired>
  );
}
