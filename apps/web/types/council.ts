/**
 * Council / Governance types for AI World War.
 *
 * ServerResolution: 서버 JSON 응답 그대로 (snake_case)
 * CouncilProposal: 프론트엔드 UI 계층 (camelCase)
 *
 * api-client.ts의 CouncilProposal과 governance/types.ts의 Proposal이
 * 이중 정의되어 있던 것을 하나로 통합합니다.
 */

// ── Server-side types (Go JSON 응답 그대로) ──

export type ServerResolutionType =
  | 'nuclear_ban'
  | 'free_trade'
  | 'peacekeeping'
  | 'economic_sanction'
  | 'climate_accord';

export type ServerResolutionStatus =
  | 'voting'
  | 'passed'
  | 'vetoed'
  | 'rejected'
  | 'expired';

/** 서버 Resolution 구조체 (Go JSON 응답 그대로) */
export interface ServerResolution {
  id: string;
  type: ServerResolutionType;
  name: string;
  description: string;
  status: ServerResolutionStatus;
  proposed_by: string;
  proposer_name: string;
  target_faction?: string;
  /** factionID -> true(yes) / false(no) */
  votes: Record<string, boolean>;
  vetoed_by?: string;
  created_at: string;
  voting_ends_at: string;
  effect_starts_at?: string;
  effect_expires_at?: string;
}

/** GET /api/council/resolutions 응답 */
export interface ServerResolutionsResponse {
  voting: ServerResolution[];
  history: ServerResolution[];
}

/** POST /api/council/propose 요청 body */
export interface ProposeResolutionRequest {
  type: ServerResolutionType;
  target_faction?: string;
}

/** POST /api/council/vote 요청 body */
export interface VoteResolutionRequest {
  resolution_id: string;
  in_favor: boolean;
}

// ── 프론트엔드 UI 타입 (camelCase, 기존 호환) ──

/**
 * 프론트엔드에서 사용하는 통합 Proposal 인터페이스.
 * api-client.ts의 CouncilProposal과 governance/types.ts의 Proposal을 하나로 통합.
 */
export interface CouncilProposal {
  id: string;
  iso3: string;
  proposer: string;
  title: string;
  description: string;
  proposalType: string;
  forVotes: number;
  againstVotes: number;
  startTime: string;
  endTime: string;
  status: string;
  executed: boolean;
  totalVoters: number;
}

/** 투표 기록 (Resolution.Votes에서 추출) */
export interface VoteRecord {
  proposalId: string;
  title: string;
  iso3: string;
  voter: string;
  support: boolean;
  quadraticWeight: number;
  tokensUsed: number;
  timestamp: string;
}
