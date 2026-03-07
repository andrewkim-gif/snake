'use client';

/**
 * /governance — 거버넌스 제안 목록 페이지
 * PageHeader 통합 컴포넌트 사용
 */

import { useState, useMemo, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { SK, bodyFont } from '@/lib/sketch-ui';
import { PageHeader, StatCard } from '@/components/hub';
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

const MOCK_PROPOSALS: Proposal[] = [
  {
    id: 42, iso3: 'KOR',
    proposer: '0x1234567890abcdef1234567890abcdef12345678',
    title: 'Reduce Korea tax rate from 5% to 3%',
    description: 'Lowering the national tax rate will attract more agents and increase overall economic activity in the Korean arena.',
    proposalType: 'tax',
    forVotes: 124.5, againstVotes: 46.2,
    startTime: Math.floor(Date.now() / 1000) - 86400,
    endTime: Math.floor(Date.now() / 1000) + 86400 * 2,
    status: 'active', executed: false, totalVoters: 89,
  },
  {
    id: 41, iso3: 'JPN',
    proposer: '0xabcdef1234567890abcdef1234567890abcdef12',
    title: 'Japan-Korea Trade Agreement',
    description: 'Establish a bilateral trade corridor reducing cross-border token transfer fees by 50%.',
    proposalType: 'trade',
    forVotes: 210.3, againstVotes: 21.1,
    startTime: Math.floor(Date.now() / 1000) - 86400 * 5,
    endTime: Math.floor(Date.now() / 1000) - 86400,
    status: 'passed', executed: false, totalVoters: 156,
  },
  {
    id: 40, iso3: 'USA',
    proposer: '0x9876543210fedcba9876543210fedcba98765432',
    title: 'Increase US defense budget by 20%',
    description: 'Boost the national defense multiplier to strengthen arena combat effectiveness for all US-aligned agents.',
    proposalType: 'defense',
    forVotes: 89.7, againstVotes: 102.4,
    startTime: Math.floor(Date.now() / 1000) - 86400 * 10,
    endTime: Math.floor(Date.now() / 1000) - 86400 * 3,
    status: 'rejected', executed: false, totalVoters: 201,
  },
  {
    id: 39, iso3: 'KOR',
    proposer: '0xfedcba9876543210fedcba9876543210fedcba98',
    title: 'Korean treasury allocation for staking rewards',
    description: 'Allocate 10% of the Korean national treasury to increase staking APR for $KOR holders.',
    proposalType: 'treasury',
    forVotes: 156.8, againstVotes: 34.2,
    startTime: Math.floor(Date.now() / 1000) - 86400 * 15,
    endTime: Math.floor(Date.now() / 1000) - 86400 * 8,
    status: 'executed', executed: true, totalVoters: 112,
  },
  {
    id: 38, iso3: 'GBR',
    proposer: '0x1111222233334444555566667777888899990000',
    title: 'UK diplomatic immunity proposal',
    description: 'Grant temporary diplomatic immunity to UK agents during cross-border raids for 24 hours.',
    proposalType: 'other',
    forVotes: 67.3, againstVotes: 12.1,
    startTime: Math.floor(Date.now() / 1000) - 86400 * 2,
    endTime: Math.floor(Date.now() / 1000) + 86400 * 5,
    status: 'active', executed: false, totalVoters: 45,
  },
  {
    id: 37, iso3: 'JPN',
    proposer: '0xaaaa11112222333344445555666677778888',
    title: 'Japanese arena expansion to 200 concurrent players',
    description: 'Expand the Japanese national arena capacity from 100 to 200 concurrent players.',
    proposalType: 'other',
    forVotes: 198.4, againstVotes: 5.6,
    startTime: Math.floor(Date.now() / 1000) - 86400 * 20,
    endTime: Math.floor(Date.now() / 1000) - 86400 * 13,
    status: 'executed', executed: true, totalVoters: 88,
  },
];

type FilterStatus = 'all' | 'voting' | 'passed' | 'rejected' | 'executed';

const FILTER_TO_STATUS: Record<FilterStatus, ProposalStatus | null> = {
  all: null, voting: 'active', passed: 'passed', rejected: 'rejected', executed: 'executed',
};

const FILTER_KEYS: FilterStatus[] = ['all', 'voting', 'passed', 'rejected', 'executed'];

function GovernancePageInner() {
  const tGov = useTranslations('governance');
  const searchParams = useSearchParams();
  const countryCode = searchParams.get('country');

  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);

  const filteredProposals = useMemo(() => {
    let list = MOCK_PROPOSALS;
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

  // 통계
  const activeCount = MOCK_PROPOSALS.filter(p => p.status === 'active').length;
  const passedCount = MOCK_PROPOSALS.filter(p => p.status === 'passed' || p.status === 'executed').length;
  const rejectedCount = MOCK_PROPOSALS.filter(p => p.status === 'rejected').length;

  return (
    <div>
      <PageHeader
        icon={Vote}
        title={tGov('title')}
        description={tGov('subtitle') + (countryCode ? ` — ${countryCode.toUpperCase()}` : '')}
        accentColor={SK.blue}
        heroImage="/images/hero-governance.png"
      >
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
              fontSize: '12px',
              color: SK.orange,
              fontWeight: 600,
            }}
          >
            {tGov('filtered', { country: countryCode.toUpperCase() })}
            <a
              href="/governance"
              style={{ color: SK.textSecondary, textDecoration: 'none', fontSize: '11px', marginLeft: '4px' }}
            >
              {tGov('all')}
            </a>
          </div>
        )}
      </PageHeader>

      {/* 통계 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        <StatCard label="Total Proposals" value={String(MOCK_PROPOSALS.length)} color={SK.textPrimary} icon={Vote} />
        <StatCard label="Active Voting" value={String(activeCount)} color={SK.orange} icon={Clock} />
        <StatCard label="Passed" value={String(passedCount)} color={SK.green} icon={CheckCircle} />
        <StatCard label="Rejected" value={String(rejectedCount)} color={SK.red} icon={XCircle} />
      </div>

      {/* 상태 필터 탭 */}
      <div
        style={{
          display: 'flex',
          gap: '6px',
          marginBottom: '20px',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          paddingBottom: '4px',
        }}
      >
        {FILTER_KEYS.map((key) => {
          const isActive = statusFilter === key;
          return (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              style={{
                padding: '6px 16px',
                borderRadius: '6px',
                border: `1px solid ${isActive ? SK.blue + '40' : SK.border}`,
                background: isActive ? `${SK.blue}15` : 'transparent',
                color: isActive ? SK.blue : SK.textSecondary,
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
              {tGov(key)}
            </button>
          );
        })}
      </div>

      {/* 메인 콘텐츠 */}
      <div
        className="governance-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: selectedProposal ? '1fr 1fr' : '1fr',
          gap: '20px',
          alignItems: 'start',
        }}
      >
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

        {selectedProposal && (
          <div style={{ position: 'sticky', top: '80px' }}>
            <VoteInterface
              proposal={selectedProposal}
              userTokenBalance={10000}
              onVote={handleVote}
              onWithdraw={handleWithdraw}
            />
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 768px) {
          .governance-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
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
