'use client';

/**
 * /governance — 거버넌스 제안 목록 페이지
 * DashboardPage + FilterBar + DetailModal + mock data 모듈 사용
 */

import { useState, useMemo, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { SK, bodyFont } from '@/lib/sketch-ui';
import { DashboardPage, FilterBar, DetailModal, CountryFilterBadge } from '@/components/hub';
import { MOCK_PROPOSALS } from '@/lib/mock-data';
import { Vote, CheckCircle, XCircle, Clock } from 'lucide-react';
import type { Proposal, ProposalStatus } from '@/components/governance/types';

const ProposalList = dynamic(
  () => import('@/components/governance/ProposalList'),
  { ssr: false }
);
const VoteInterface = dynamic(
  () => import('@/components/governance/VoteInterface'),
  { ssr: false }
);

type FilterStatus = 'all' | 'voting' | 'passed' | 'rejected' | 'executed';

const FILTER_TO_STATUS: Record<FilterStatus, ProposalStatus | null> = {
  all: null, voting: 'active', passed: 'passed', rejected: 'rejected', executed: 'executed',
};

function GovernancePageInner() {
  const tGov = useTranslations('governance');
  const searchParams = useSearchParams();
  const countryCode = searchParams.get('country');

  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);

  const filteredProposals = useMemo(() => {
    let list = [...MOCK_PROPOSALS];
    if (countryCode) list = list.filter((p) => p.iso3 === countryCode.toUpperCase());
    const targetStatus = FILTER_TO_STATUS[statusFilter];
    if (targetStatus) list = list.filter((p) => p.status === targetStatus);
    return list;
  }, [countryCode, statusFilter]);

  const handleSelectProposal = useCallback((proposal: Proposal) => {
    setSelectedProposal((prev) => (prev?.id === proposal.id ? null : proposal));
  }, []);

  const handleVote = useCallback(
    (proposalId: number, support: boolean, tokenAmount: number) => {
      console.log(`[Governance] Vote on #${proposalId}: ${support ? 'FOR' : 'AGAINST'}, tokens: ${tokenAmount}`);
    },
    []
  );

  const handleWithdraw = useCallback((proposalId: number) => {
    console.log(`[Governance] Withdraw tokens from #${proposalId}`);
  }, []);

  const activeCount = MOCK_PROPOSALS.filter(p => p.status === 'active').length;
  const passedCount = MOCK_PROPOSALS.filter(p => p.status === 'passed' || p.status === 'executed').length;
  const rejectedCount = MOCK_PROPOSALS.filter(p => p.status === 'rejected').length;

  const filterOptions: Array<{ key: FilterStatus; label: string }> = [
    { key: 'all', label: tGov('all') },
    { key: 'voting', label: tGov('voting') },
    { key: 'passed', label: tGov('passed') },
    { key: 'rejected', label: tGov('rejected') },
    { key: 'executed', label: tGov('executed') },
  ];

  return (
    <DashboardPage
      icon={Vote}
      title={tGov('title')}
      description={tGov('subtitle') + (countryCode ? ` — ${countryCode.toUpperCase()}` : '')}
      accentColor={SK.blue}
      heroImage="/images/hero-governance.png"
      headerChildren={
        countryCode ? (
          <CountryFilterBadge
            countryCode={countryCode.toUpperCase()}
            label={tGov('filtered', { country: countryCode.toUpperCase() })}
            clearHref="/governance"
            clearText={tGov('all')}
          />
        ) : undefined
      }
      stats={[
        { label: 'Total Proposals', value: String(MOCK_PROPOSALS.length), color: SK.textPrimary, icon: Vote },
        { label: 'Active Voting', value: String(activeCount), color: SK.orange, icon: Clock },
        { label: 'Passed', value: String(passedCount), color: SK.green, icon: CheckCircle },
        { label: 'Rejected', value: String(rejectedCount), color: SK.red, icon: XCircle },
      ]}
    >
      <FilterBar
        options={filterOptions}
        value={statusFilter}
        onChange={setStatusFilter}
      />

      {/* 메인 콘텐츠 */}
      <div
        style={{
          background: SK.cardBg,
          border: `1px solid ${SK.border}`,
          borderRadius: '12px',
          padding: '16px',
        }}
      >
        <ProposalList
          proposals={filteredProposals}
          onSelectProposal={handleSelectProposal}
        />
      </div>

      {/* DetailModal — 투표 인터페이스 */}
      <DetailModal
        open={!!selectedProposal}
        onClose={() => setSelectedProposal(null)}
        title={selectedProposal?.title}
        accentColor={SK.blue}
        maxWidth={560}
      >
        {selectedProposal && (
          <VoteInterface
            proposal={selectedProposal}
            userTokenBalance={10000}
            onVote={handleVote}
            onWithdraw={handleWithdraw}
          />
        )}
      </DetailModal>
    </DashboardPage>
  );
}

export default function GovernancePage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: '40px', textAlign: 'center', color: SK.textSecondary, fontFamily: bodyFont }}>
          Loading...
        </div>
      }
    >
      <GovernancePageInner />
    </Suspense>
  );
}
