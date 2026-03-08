'use client';

/**
 * /governance — 거버넌스 제안 목록 페이지
 * DashboardPage + FilterBar + DetailModal + API 연동
 */

import { useState, useMemo, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { SK, bodyFont } from '@/lib/sketch-ui';
import { DashboardPage, FilterBar, DetailModal, CountryFilterBadge } from '@/components/hub';
import { fetchCouncilProposals, postCouncilVote, CouncilProposal } from '@/lib/api-client';
import { useApiData } from '@/hooks/useApiData';
import { ServerRequired } from '@/components/ui/ServerRequired';
import { Vote, CheckCircle, XCircle, Clock } from 'lucide-react';
import type { Proposal, ProposalStatus, ProposalType } from '@/components/governance/types';

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

/** API CouncilProposal -> local Proposal 타입 변환 */
function toProposal(cp: CouncilProposal): Proposal {
  return {
    id: Number(cp.id) || 0,
    iso3: cp.iso3,
    proposer: cp.proposer,
    title: cp.title,
    description: cp.description,
    proposalType: (cp.proposalType as ProposalType) || 'other',
    forVotes: cp.forVotes ?? 0,
    againstVotes: cp.againstVotes ?? 0,
    startTime: cp.startTime ? Math.floor(new Date(cp.startTime).getTime() / 1000) : 0,
    endTime: cp.endTime ? Math.floor(new Date(cp.endTime).getTime() / 1000) : 0,
    status: (cp.status as ProposalStatus) || 'active',
    executed: cp.executed ?? false,
    totalVoters: cp.totalVoters ?? 0,
  };
}

function GovernancePageInner() {
  const tGov = useTranslations('governance');
  const searchParams = useSearchParams();
  const countryCode = searchParams.get('country');

  const { data: rawProposals, loading, refetch } = useApiData(
    () => fetchCouncilProposals(countryCode?.toUpperCase()),
    { refreshInterval: 30000 },
  );

  const proposals = useMemo(() => (rawProposals || []).map(toProposal), [rawProposals]);

  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);

  const filteredProposals = useMemo(() => {
    let list = [...proposals];
    if (countryCode) list = list.filter((p) => p.iso3 === countryCode.toUpperCase());
    const targetStatus = FILTER_TO_STATUS[statusFilter];
    if (targetStatus) list = list.filter((p) => p.status === targetStatus);
    return list;
  }, [proposals, countryCode, statusFilter]);

  const handleSelectProposal = useCallback((proposal: Proposal) => {
    setSelectedProposal((prev) => (prev?.id === proposal.id ? null : proposal));
  }, []);

  const handleVote = useCallback(
    async (proposalId: number, support: boolean, tokenAmount: number) => {
      await postCouncilVote(String(proposalId), support, tokenAmount);
      refetch();
    },
    [refetch]
  );

  const handleWithdraw = useCallback((proposalId: number) => {
    console.log(`[Governance] Withdraw tokens from #${proposalId}`);
  }, []);

  const activeCount = proposals.filter(p => p.status === 'active').length;
  const passedCount = proposals.filter(p => p.status === 'passed' || p.status === 'executed').length;
  const rejectedCount = proposals.filter(p => p.status === 'rejected').length;

  const filterOptions: Array<{ key: FilterStatus; label: string }> = [
    { key: 'all', label: tGov('all') },
    { key: 'voting', label: tGov('voting') },
    { key: 'passed', label: tGov('passed') },
    { key: 'rejected', label: tGov('rejected') },
    { key: 'executed', label: tGov('executed') },
  ];

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: SK.textSecondary, fontFamily: bodyFont }}>
        Loading governance data...
      </div>
    );
  }

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
        { label: tGov('totalProposals'), value: String(proposals.length), color: SK.textPrimary, icon: Vote },
        { label: tGov('activeVoting'), value: String(activeCount), color: SK.orange, icon: Clock },
        { label: tGov('passed'), value: String(passedCount), color: SK.green, icon: CheckCircle },
        { label: tGov('rejected'), value: String(rejectedCount), color: SK.red, icon: XCircle },
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
          borderRadius: 0,
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
    <ServerRequired>
      <Suspense
        fallback={
          <div style={{ padding: '40px', textAlign: 'center', color: SK.textSecondary, fontFamily: bodyFont }}>
            ...
          </div>
        }
      >
        <GovernancePageInner />
      </Suspense>
    </ServerRequired>
  );
}
