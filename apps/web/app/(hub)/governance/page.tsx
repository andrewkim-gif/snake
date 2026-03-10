'use client';

/**
 * /governance — 거버넌스 제안 목록 페이지
 * DashboardPage + FilterBar + DetailModal + API 연동
 */

import { useState, useMemo, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { SK, SKFont, headingFont, bodyFont } from '@/lib/sketch-ui';
import { FilterBar, DetailModal } from '@/components/hub';
import { fetchCouncilProposals, postCouncilVote, fetchPlayerTokenBalance, CouncilProposal } from '@/lib/api-client';
import { useApiData } from '@/hooks/useApiData';
import { ServerRequired } from '@/components/ui/ServerRequired';
import { useWalletStore } from '@/stores/wallet-store';
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
  const walletStore = useWalletStore();

  const { data: rawProposals, loading, refetch } = useApiData(
    () => fetchCouncilProposals(countryCode?.toUpperCase()),
    { refreshInterval: 30000 },
  );

  // v30 Task 2-11: 서버에서 실제 토큰 잔고 조회 (하드코딩 제거)
  const playerId = walletStore.isConnected ? walletStore.address : 'local-user';
  const { data: tokenBalanceData } = useApiData(
    () => fetchPlayerTokenBalance(playerId),
    { refreshInterval: 15000 },
  );
  const userTokenBalance = tokenBalanceData?.balance ?? 0;

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

  // v32 Phase 1 Task 6: 서버에 철회 API가 없으므로 no-op (UI에서 버튼 비활성화됨)
  const handleWithdraw = useCallback((_proposalId: number) => {
    // 서버에 withdraw API가 없음 — VoteInterface에서 버튼이 disabled + tooltip 표시
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
          Governance
        </h1>
        <p style={{ color: SK.textSecondary, fontSize: SKFont.sm, marginTop: 4 }}>
          Council proposals, voting, and policy decisions{countryCode ? ` — ${countryCode.toUpperCase()}` : ''}
        </p>
      </header>

      {/* Tab content */}
      <main>
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
            userTokenBalance={userTokenBalance}
            onVote={handleVote}
            onWithdraw={handleWithdraw}
          />
        )}
      </DetailModal>
      </main>
    </div>
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
