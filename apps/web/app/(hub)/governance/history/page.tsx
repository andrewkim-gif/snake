'use client';

/**
 * /governance/history — 투표 이력 페이지
 * VoteHistory 컴포넌트 연결
 * 결과별 필터링 (ALL / FOR / AGAINST)
 * 국가 필터: URL param ?country=KOR
 */

import { useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { SK, bodyFont } from '@/lib/sketch-ui';
import type { VoteHistoryEntry } from '@/components/governance/types';

// Lazy load VoteHistory
const VoteHistory = dynamic(
  () => import('@/components/governance/VoteHistory'),
  { ssr: false }
);

// --- Mock 투표 이력 데이터 ---
const MOCK_VOTE_HISTORY: VoteHistoryEntry[] = [
  {
    proposalId: 42,
    title: 'Reduce Korea tax rate from 5% to 3%',
    iso3: 'KOR',
    support: true,
    quadraticWeight: 31.62,
    tokensUsed: '1000',
    timestamp: Math.floor(Date.now() / 1000) - 3600,
  },
  {
    proposalId: 41,
    title: 'Japan-Korea Trade Agreement',
    iso3: 'JPN',
    support: true,
    quadraticWeight: 22.36,
    tokensUsed: '500',
    timestamp: Math.floor(Date.now() / 1000) - 86400 * 3,
  },
  {
    proposalId: 40,
    title: 'Increase US defense budget by 20%',
    iso3: 'USA',
    support: false,
    quadraticWeight: 14.14,
    tokensUsed: '200',
    timestamp: Math.floor(Date.now() / 1000) - 86400 * 7,
  },
  {
    proposalId: 39,
    title: 'Korean treasury allocation for staking rewards',
    iso3: 'KOR',
    support: true,
    quadraticWeight: 44.72,
    tokensUsed: '2000',
    timestamp: Math.floor(Date.now() / 1000) - 86400 * 10,
  },
  {
    proposalId: 38,
    title: 'UK diplomatic immunity proposal',
    iso3: 'GBR',
    support: true,
    quadraticWeight: 10.0,
    tokensUsed: '100',
    timestamp: Math.floor(Date.now() / 1000) - 86400 * 12,
  },
  {
    proposalId: 35,
    title: 'Brazil rainforest defense zone creation',
    iso3: 'BRA',
    support: false,
    quadraticWeight: 17.32,
    tokensUsed: '300',
    timestamp: Math.floor(Date.now() / 1000) - 86400 * 18,
  },
];

type VoteFilter = 'all' | 'for' | 'against';

const VOTE_FILTERS: { key: VoteFilter; label: string }[] = [
  { key: 'all', label: 'ALL' },
  { key: 'for', label: 'FOR' },
  { key: 'against', label: 'AGAINST' },
];

function VoteHistoryPageInner() {
  const searchParams = useSearchParams();
  const countryCode = searchParams.get('country');

  const [voteFilter, setVoteFilter] = useState<VoteFilter>('all');

  // 국가 + 결과 필터
  const filteredEntries = useMemo(() => {
    let list = MOCK_VOTE_HISTORY;

    // 국가 필터
    if (countryCode) {
      list = list.filter((e) => e.iso3 === countryCode.toUpperCase());
    }

    // 투표 결과 필터
    if (voteFilter === 'for') {
      list = list.filter((e) => e.support);
    } else if (voteFilter === 'against') {
      list = list.filter((e) => !e.support);
    }

    return list;
  }, [countryCode, voteFilter]);

  // 통계 요약
  const stats = useMemo(() => {
    const all = countryCode
      ? MOCK_VOTE_HISTORY.filter((e) => e.iso3 === countryCode.toUpperCase())
      : MOCK_VOTE_HISTORY;
    const forCount = all.filter((e) => e.support).length;
    const againstCount = all.filter((e) => !e.support).length;
    const totalTokens = all.reduce((sum, e) => sum + Number(e.tokensUsed), 0);
    return { total: all.length, forCount, againstCount, totalTokens };
  }, [countryCode]);

  return (
    <div>
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
          VOTE HISTORY
        </h1>
        <p
          style={{
            fontFamily: bodyFont,
            fontSize: '14px',
            color: SK.textSecondary,
            margin: 0,
          }}
        >
          Your past voting activity archive{countryCode ? ` for ${countryCode.toUpperCase()}` : ''}
        </p>
      </div>

      {/* 국가 필터 표시 */}
      {countryCode && (
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
          Filtered: {countryCode.toUpperCase()}
          <a
            href="/governance/history"
            style={{
              color: SK.textSecondary,
              textDecoration: 'none',
              fontSize: '11px',
              marginLeft: '4px',
            }}
          >
            Clear
          </a>
        </div>
      )}

      {/* 통계 카드 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        {[
          { label: 'Total Votes', value: stats.total, color: SK.textPrimary },
          { label: 'Voted For', value: stats.forCount, color: SK.green },
          { label: 'Voted Against', value: stats.againstCount, color: SK.red },
          { label: 'Tokens Used', value: stats.totalTokens.toLocaleString(), color: SK.orange },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              background: SK.cardBg,
              border: `1px solid ${SK.border}`,
              borderRadius: '10px',
              padding: '14px 16px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontFamily: bodyFont,
                fontSize: '22px',
                fontWeight: 800,
                color: stat.color,
                lineHeight: 1,
                marginBottom: '4px',
              }}
            >
              {stat.value}
            </div>
            <div
              style={{
                fontFamily: bodyFont,
                fontSize: '10px',
                fontWeight: 700,
                color: SK.textMuted,
                letterSpacing: '1px',
                textTransform: 'uppercase',
              }}
            >
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* 결과 필터 */}
      <div
        style={{
          display: 'flex',
          gap: '6px',
          marginBottom: '16px',
        }}
      >
        {VOTE_FILTERS.map(({ key, label }) => {
          const isActive = voteFilter === key;
          return (
            <button
              key={key}
              onClick={() => setVoteFilter(key)}
              style={{
                padding: '6px 16px',
                borderRadius: '6px',
                border: `1px solid ${isActive ? SK.orange + '40' : SK.border}`,
                background: isActive ? `${SK.orange}15` : 'transparent',
                color: isActive ? SK.orange : SK.textSecondary,
                fontWeight: 700,
                fontSize: '11px',
                cursor: 'pointer',
                fontFamily: bodyFont,
                whiteSpace: 'nowrap',
                letterSpacing: '1px',
                textTransform: 'uppercase',
                transition: 'all 150ms ease',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* 투표 이력 리스트 */}
      <div
        style={{
          background: SK.cardBg,
          border: `1px solid ${SK.border}`,
          borderRadius: '12px',
          padding: '16px',
        }}
      >
        <VoteHistory entries={filteredEntries} />
      </div>
    </div>
  );
}

export default function VoteHistoryPage() {
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
          Loading vote history...
        </div>
      }
    >
      <VoteHistoryPageInner />
    </Suspense>
  );
}
