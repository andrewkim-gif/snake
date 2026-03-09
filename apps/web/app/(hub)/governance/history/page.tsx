'use client';

/**
 * /governance/history — 투표 이력 페이지
 * DashboardPage + FilterBar + API 연동
 */

import { useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { SK, SKFont, headingFont, bodyFont } from '@/lib/sketch-ui';
import { FilterBar } from '@/components/hub';
import { fetchCouncilVotes, VoteRecord } from '@/lib/api-client';
import { useApiData } from '@/hooks/useApiData';
import { ServerRequired } from '@/components/ui/ServerRequired';
// lucide-react icons removed — 대시보드 스타일에서 StatCard 제거로 불필요
import type { VoteHistoryEntry } from '@/components/governance/types';

const VoteHistory = dynamic(
  () => import('@/components/governance/VoteHistory'),
  { ssr: false }
);

type VoteFilter = 'all' | 'for' | 'against';

/** API VoteRecord -> local VoteHistoryEntry 타입 변환 */
function toVoteHistoryEntry(vr: VoteRecord): VoteHistoryEntry {
  return {
    proposalId: Number(vr.proposalId) || 0,
    title: vr.title ?? '',
    iso3: vr.iso3 ?? '',
    support: vr.support ?? false,
    quadraticWeight: vr.quadraticWeight ?? 0,
    tokensUsed: String(vr.tokensUsed ?? 0),
    timestamp: vr.timestamp ? Math.floor(new Date(vr.timestamp).getTime() / 1000) : 0,
  };
}

function VoteHistoryPageInner() {
  const tGov = useTranslations('governance');
  const searchParams = useSearchParams();
  const countryCode = searchParams.get('country');

  const { data: rawVotes, loading } = useApiData(
    () => fetchCouncilVotes(countryCode?.toUpperCase()),
  );

  const voteHistory = useMemo(() => (rawVotes || []).map(toVoteHistoryEntry), [rawVotes]);

  const [voteFilter, setVoteFilter] = useState<VoteFilter>('all');

  const filteredEntries = useMemo(() => {
    let list = voteHistory;
    if (countryCode) {
      list = list.filter((e) => e.iso3 === countryCode.toUpperCase());
    }
    if (voteFilter === 'for') {
      list = list.filter((e) => e.support);
    } else if (voteFilter === 'against') {
      list = list.filter((e) => !e.support);
    }
    return list;
  }, [voteHistory, countryCode, voteFilter]);

  const stats = useMemo(() => {
    const all = countryCode
      ? voteHistory.filter((e) => e.iso3 === countryCode.toUpperCase())
      : voteHistory;
    const forCount = all.filter((e) => e.support).length;
    const againstCount = all.filter((e) => !e.support).length;
    const totalTokens = all.reduce((sum, e) => sum + Number(e.tokensUsed), 0);
    return { total: all.length, forCount, againstCount, totalTokens };
  }, [voteHistory, countryCode]);

  const filterOptions: Array<{ key: VoteFilter; label: string }> = [
    { key: 'all', label: tGov('all') },
    { key: 'for', label: tGov('for') },
    { key: 'against', label: tGov('against') },
  ];

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: SK.textSecondary, fontFamily: bodyFont }}>
        Loading vote history...
      </div>
    );
  }

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
          Vote History
        </h1>
        <p style={{ color: SK.textSecondary, fontSize: SKFont.sm, marginTop: 4 }}>
          Past votes, participation records, and outcomes{countryCode ? ` — ${countryCode.toUpperCase()}` : ''}
        </p>
      </header>

      {/* Tab content */}
      <main>
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
      </main>
    </div>
  );
}

export default function VoteHistoryPage() {
  return (
    <ServerRequired>
      <Suspense
        fallback={
          <div style={{ padding: '40px', textAlign: 'center', color: SK.textSecondary, fontFamily: bodyFont }}>
            ...
          </div>
        }
      >
        <VoteHistoryPageInner />
      </Suspense>
    </ServerRequired>
  );
}
