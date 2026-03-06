/** Governance types for AI World War national policy voting */

export type ProposalStatus = 'active' | 'passed' | 'rejected' | 'executed';

export type ProposalType = 'tax' | 'trade' | 'defense' | 'treasury' | 'other';

export const PROPOSAL_TYPE_LABELS: Record<ProposalType, string> = {
  tax: 'Tax Policy',
  trade: 'Trade Policy',
  defense: 'Defense Policy',
  treasury: 'Treasury',
  other: 'Other',
};

export const PROPOSAL_TYPE_COLORS: Record<ProposalType, string> = {
  tax: '#CC9933',
  trade: '#4A9E4A',
  defense: '#6B8CCC',
  treasury: '#CC3333',
  other: '#8B8B8B',
};

export const STATUS_COLORS: Record<ProposalStatus, string> = {
  active: '#CC9933',
  passed: '#4A9E4A',
  rejected: '#CC3333',
  executed: '#6B8CCC',
};

export const STATUS_LABELS: Record<ProposalStatus, string> = {
  active: 'Voting',
  passed: 'Passed',
  rejected: 'Rejected',
  executed: 'Executed',
};

export interface Proposal {
  id: number;
  iso3: string;
  proposer: string;
  title: string;
  description: string;
  proposalType: ProposalType;
  forVotes: number;    // quadratic-weighted
  againstVotes: number;
  startTime: number;   // unix timestamp
  endTime: number;
  status: ProposalStatus;
  executed: boolean;
  // UI-only fields
  totalVoters?: number;
  userVoted?: boolean;
  userVoteSupport?: boolean;
  userTokensLocked?: string;
}

export interface VoteHistoryEntry {
  proposalId: number;
  title: string;
  iso3: string;
  support: boolean;
  quadraticWeight: number;
  tokensUsed: string;
  timestamp: number;
}
