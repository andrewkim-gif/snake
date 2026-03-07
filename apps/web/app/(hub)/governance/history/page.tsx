'use client';

/**
 * /governance/history — 투표 이력 페이지
 * DashboardPage + FilterBar + mock data 모듈 사용
 */

import { useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { SK, bodyFont } from '@/lib/sketch-ui';
import { DashboardPage, FilterBar, CountryFilterBadge } from '@/components/hub';
import { MOCK_VOTE_HISTORY } from '@/lib/mock-data';
import { History, ThumbsUp, ThumbsDown, Coins } from 'lucide-react';

const VoteHistory = dynamic(
  () => import('@/components/governance/VoteHistory'),
  { ssr: false }
);

type VoteFilter = 'all' | 'for' | 'against';

function VoteHistoryPageInner() {
  const tGov = useTranslations('governance');
  const searchParams = useSearchParams();
  const countryCode = searchParams.get('country');

  const [voteFilter, setVoteFilter] = useState<VoteFilter>('all');

  const filteredEntries = useMemo(() => {
    let list = MOCK_VOTE_HISTORY;
    if (countryCode) {
      list = list.filter((e) => e.iso3 === countryCode.toUpperCase());
    }
    if (voteFilter === 'for') {
      list = list.filter((e) => e.support);
    } else if (voteFilter === 'against') {
      list = list.filter((e) => !e.support);
    }
    return list;
  }, [countryCode, voteFilter]);

  const stats = useMemo(() => {
    const all = countryCode
      ? MOCK_VOTE_HISTORY.filter((e) => e.iso3 === countryCode.toUpperCase())
      : MOCK_VOTE_HISTORY;
    const forCount = all.filter((e) => e.support).length;
    const againstCount = all.filter((e) => !e.support).length;
    const totalTokens = all.reduce((sum, e) => sum + Number(e.tokensUsed), 0);
    return { total: all.length, forCount, againstCount, totalTokens };
  }, [countryCode]);

  const filterOptions: Array<{ key: VoteFilter; label: string }> = [
    { key: 'all', label: tGov('all') },
    { key: 'for', label: tGov('for') },
    { key: 'against', label: tGov('against') },
  ];

  return (
    <DashboardPage
      icon={History}
      title={tGov('voteHistory')}
      description={tGov('voteHistorySubtitle') + (countryCode ? ` — ${countryCode.toUpperCase()}` : '')}
      accentColor={SK.orange}
      heroImage="/images/hero-governance.png"
      headerChildren={
        countryCode ? (
          <CountryFilterBadge
            countryCode={countryCode.toUpperCase()}
            label={tGov('filtered', { country: countryCode.toUpperCase() })}
            clearHref="/governance/history"
            clearText={tGov('all')}
          />
        ) : undefined
      }
      stats={[
        { label: tGov('totalVotes'), value: String(stats.total), color: SK.textPrimary, icon: History },
        { label: tGov('votedFor'), value: String(stats.forCount), color: SK.green, icon: ThumbsUp },
        { label: tGov('votedAgainst'), value: String(stats.againstCount), color: SK.red, icon: ThumbsDown },
        { label: tGov('tokensUsed'), value: stats.totalTokens.toLocaleString(), color: SK.orange, icon: Coins },
      ]}
    >
      <FilterBar
        options={filterOptions}
        value={voteFilter}
        onChange={setVoteFilter}
      />

      <div
        style={{
          background: SK.cardBg,
          border: `1px solid ${SK.border}`,
          borderRadius: 0,
          padding: '16px',
        }}
      >
        <VoteHistory entries={filteredEntries} />
      </div>
    </DashboardPage>
  );
}

export default function VoteHistoryPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: '40px', textAlign: 'center', color: SK.textSecondary, fontFamily: bodyFont }}>
          …
        </div>
      }
    >
      <VoteHistoryPageInner />
    </Suspense>
  );
}
