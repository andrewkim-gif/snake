/**
 * Centralized API client for AI World War server.
 * Uses /api/ routes (v18 compatibility layer on the server).
 */

import type {
  ServerResolution,
  ServerResolutionsResponse,
  CouncilProposal,
  VoteRecord,
  ServerResolutionStatus,
} from '@/types/council';

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || '';

export function getServerUrl(): string {
  return SERVER_URL;
}

export function isServerAvailable(): boolean {
  return SERVER_URL.length > 0;
}

interface FetchOptions extends RequestInit {
  token?: string;
  /** true이면 localStorage에서 wallet address를 자동으로 인증 헤더에 추가 */
  authenticated?: boolean;
}

/**
 * Fetch wrapper that prepends SERVER_URL and handles JSON.
 * Returns null on network/server errors (graceful degradation).
 *
 * @param opts.token — Bearer 토큰 (JWT 또는 wallet address)
 * @param opts.authenticated — true이면 localStorage에서 wallet address를 자동으로 가져와 인증 헤더에 추가
 */
export async function apiFetch<T>(path: string, opts: FetchOptions = {}): Promise<T | null> {
  const { token, authenticated, ...fetchOpts } = opts;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string> || {}),
  };

  // 인증 헤더: 명시적 token > authenticated 플래그 > 없음
  const authToken = token || (authenticated ? getWalletAddress() : null);
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  try {
    const res = await fetch(`${SERVER_URL}${path}`, { ...fetchOpts, headers });
    if (!res.ok) return null;
    return await res.json() as T;
  } catch {
    return null;
  }
}

/**
 * localStorage에서 wallet address를 가져옵니다.
 * Zustand persist 미들웨어가 저장한 'aww-wallet' 키에서 읽습니다.
 * 서버 사이드에서는 null을 반환합니다.
 */
function getWalletAddress(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('aww-wallet');
    if (!raw) return null;
    const data = JSON.parse(raw);
    const state = data?.state;
    if (state?.isConnected && state?.address) {
      return state.address;
    }
    return null;
  } catch {
    return null;
  }
}

// ── Domain-specific fetchers ──

export interface FactionSummary {
  id: string;
  name: string;
  tag: string;
  color: string;
  banner_url: string;
  leader_id: string;
  prestige: number;
  member_count: number;
  territory_count?: number;
  total_gdp?: number;
}

export interface FactionMember {
  user_id: string;
  username: string;
  role: 'supreme_leader' | 'council' | 'commander' | 'member';
  joined_at: string;
}

export interface FactionDetailResponse extends FactionSummary {
  treasury?: Record<string, number>;
  members: FactionMember[];
}

export async function fetchFactions(): Promise<FactionSummary[]> {
  const data = await apiFetch<{ factions: FactionSummary[] }>('/api/factions');
  return data?.factions ?? [];
}

export async function fetchFaction(id: string): Promise<FactionDetailResponse | null> {
  const data = await apiFetch<{ faction: FactionSummary; members: FactionMember[] }>(`/api/factions/${id}`);
  if (!data?.faction) return null;
  return { ...data.faction, members: data.members ?? [] };
}

export interface HofCategory {
  key: string;
  label: string;
}

export interface HofRecord {
  category: string;
  holder: string;
  faction: string;
  value: number;
  season: number;
}

export interface HofSeason {
  number: number;
  name: string;
  start: string;
  end: string;
  winner: string;
}

export async function fetchHofCategories(): Promise<HofCategory[]> {
  const data = await apiFetch<{ categories: HofCategory[] }>('/api/hall-of-fame/categories');
  return data?.categories ?? [];
}

export async function fetchHofRecords(season?: number): Promise<HofRecord[]> {
  const q = season != null ? `?season=${season}` : '';
  const data = await apiFetch<{ records: HofRecord[] }>(`/api/hall-of-fame${q}`);
  return data?.records ?? [];
}

export async function fetchHofSeasons(): Promise<HofSeason[]> {
  const data = await apiFetch<{ seasons: HofSeason[] }>('/api/hall-of-fame/seasons');
  return data?.seasons ?? [];
}

export interface CountryEconomy {
  iso3: string;
  gdp: number;
  sovereign_faction?: string;
  sovereignty_level: number;
}

export async function fetchCountries(): Promise<CountryEconomy[] | null> {
  const data = await apiFetch<{ countries: CountryEconomy[] }>('/api/countries');
  if (!data) return null;
  return data.countries ?? [];
}

// ── Council / Governance ──
// v32 Phase 1: 서버 Resolution 스키마에 맞춰 정상화

export type { CouncilProposal, VoteRecord } from '@/types/council';

/**
 * ServerResolutionStatus → 프론트엔드 ProposalStatus 매핑
 * 서버: voting | passed | vetoed | rejected | expired
 * 프론트엔드: active | passed | rejected | executed
 */
function mapResolutionStatus(status: ServerResolutionStatus): string {
  switch (status) {
    case 'voting': return 'active';
    case 'passed': return 'passed';
    case 'vetoed': return 'rejected';
    case 'rejected': return 'rejected';
    case 'expired': return 'executed'; // 효과가 만료 = 이미 실행된 것
    default: return 'active';
  }
}

/**
 * Resolution → CouncilProposal 어댑터
 * 서버 snake_case → 프론트엔드 camelCase 변환
 */
function mapResolutionToProposal(res: ServerResolution): CouncilProposal {
  const votes = res.votes ?? {};
  const forVotes = Object.values(votes).filter((v) => v === true).length;
  const againstVotes = Object.values(votes).filter((v) => v === false).length;

  return {
    id: res.id,
    iso3: res.target_faction ?? '', // Resolution은 국가 ISO가 없으므로 target_faction 활용
    proposer: res.proposed_by,
    title: res.name,
    description: res.description,
    proposalType: res.type, // 서버의 resolution type 그대로 (nuclear_ban 등)
    forVotes,
    againstVotes,
    startTime: res.created_at,
    endTime: res.voting_ends_at,
    status: mapResolutionStatus(res.status),
    executed: res.status === 'expired' || (res.status === 'passed' && !!res.effect_starts_at),
    totalVoters: Object.keys(votes).length,
  };
}

/**
 * GET /api/council/resolutions → voting[] + history[] 합쳐서 proposals[] 반환
 * 기존: GET /api/council/proposals (존재하지 않는 경로)
 */
export async function fetchCouncilProposals(_country?: string): Promise<CouncilProposal[]> {
  const data = await apiFetch<ServerResolutionsResponse>('/api/council/resolutions');
  if (!data) return [];

  const voting = (data.voting ?? []).map(mapResolutionToProposal);
  const history = (data.history ?? []).map(mapResolutionToProposal);

  // history에는 voting 중인 것도 포함될 수 있으므로 중복 제거
  const seen = new Set(voting.map((p) => p.id));
  const uniqueHistory = history.filter((p) => !seen.has(p.id));

  return [...voting, ...uniqueHistory];
}

/**
 * 투표 기록 추출: GET /api/council/resolutions에서 Resolution.Votes map을 펼쳐 VoteRecord[] 반환
 * 서버에 별도 votes API가 없으므로 resolutions에서 추출
 */
export async function fetchCouncilVotes(_country?: string): Promise<VoteRecord[]> {
  const data = await apiFetch<ServerResolutionsResponse>('/api/council/resolutions');
  if (!data) return [];

  const records: VoteRecord[] = [];
  const allResolutions = [...(data.voting ?? []), ...(data.history ?? [])];

  // 중복 제거
  const seen = new Set<string>();
  for (const res of allResolutions) {
    if (seen.has(res.id)) continue;
    seen.add(res.id);

    const votes = res.votes ?? {};
    for (const [voter, support] of Object.entries(votes)) {
      records.push({
        proposalId: res.id,
        title: res.name,
        iso3: res.target_faction ?? '',
        voter,
        support,
        quadraticWeight: 1, // 서버 Council 시스템은 1표=1표 (quadratic 아님)
        tokensUsed: 0, // Council vote는 토큰 소모 없음 (vote-with-burn은 별도)
        timestamp: res.created_at,
      });
    }
  }

  return records;
}

/**
 * POST /api/council/vote → body: {resolution_id, in_favor}
 * 기존: POST /api/council/proposals/{id}/vote (존재하지 않는 경로)
 */
export async function postCouncilVote(
  proposalId: string,
  support: boolean,
  _tokens: number,
): Promise<{ success: boolean } | null> {
  const result = await apiFetch<{ status: string }>('/api/council/vote', {
    method: 'POST',
    body: JSON.stringify({
      resolution_id: proposalId,
      in_favor: support,
    }),
    authenticated: true,
  });
  if (!result) return null;
  return { success: result.status === 'vote recorded' };
}

/**
 * POST /api/council/propose → body: {type, target_faction}
 * 기존: POST /api/council/proposals (존재하지 않는 경로 + 불일치 body)
 *
 * 서버는 ResolutionType(nuclear_ban 등)과 target_faction만 받음.
 * proposalType을 서버 type으로 매핑.
 */
export async function postCouncilProposal(
  data: {
    iso3?: string;
    proposer?: string;
    title?: string;
    description?: string;
    proposalType: string;
    startTime?: string;
    endTime?: string;
  },
): Promise<CouncilProposal | null> {
  const result = await apiFetch<{ resolution: ServerResolution }>('/api/council/propose', {
    method: 'POST',
    body: JSON.stringify({
      type: data.proposalType,
      target_faction: data.iso3 ?? '',
    }),
    authenticated: true,
  });
  if (!result?.resolution) return null;
  return mapResolutionToProposal(result.resolution);
}

// ── Player ──

export interface PlayerAccount {
  name: string;
  level: number;
  winRate: number;
  avgLevel: number;
  totalBattles: number;
  totalKills: number;
  totalDeaths: number;
  playtime: number;
  faction: string;
  factionTag: string;
  country: string;
  rank: number;
  xp: number;
  nextLevelXp: number;
}

export interface PlayerAchievement {
  name: string;
  icon: string;
  description: string;
  tier: string;
  tierColor: string;
  unlocked: boolean;
  unlockedAt: string | null;
}

export async function fetchPlayerAccount(playerId: string): Promise<PlayerAccount | null> {
  return apiFetch<PlayerAccount>(`/api/v14/account/${playerId}`);
}

export async function fetchPlayerAchievements(playerId: string): Promise<PlayerAchievement[]> {
  const data = await apiFetch<{ achievements: PlayerAchievement[] }>(`/api/v14/achievements/${playerId}`);
  return data?.achievements ?? [];
}

// ── Economy / GDP ──

export interface GdpEntry {
  iso3: string;
  name: string;
  gdp: number;
  gdpGrowth: number;
  tier: string;
}

export async function fetchGdpData(): Promise<GdpEntry[] | null> {
  const data = await apiFetch<{ entries: GdpEntry[] }>('/api/gdp');
  if (!data) return null;
  return data.entries ?? [];
}

// ── World ──

export interface WorldStatusCountry {
  iso3: string;
  sovereign_faction: string;
  sovereignty_level: number;
  population: number;
  happiness: number;
  militaryPower: number;
}

export interface WorldStatusData {
  countries: WorldStatusCountry[];
}

export async function fetchWorldStatus(): Promise<WorldStatusData | null> {
  return apiFetch<WorldStatusData>('/api/v11/world/status');
}

// ── Season ──

export interface SeasonInfo {
  id: string;
  name: string;
  number: number;
  phase: string;
  status: string;
  startAt: string;
  endAt: string;
}

export async function fetchSeasonInfo(): Promise<SeasonInfo | null> {
  return apiFetch<SeasonInfo>('/api/season');
}

// ── Events ──

export interface GameEvent {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  countryIso: string;
  factionId: string;
}

export async function fetchEvents(limit?: number): Promise<GameEvent[]> {
  const q = limit != null ? `?limit=${limit}` : '';
  const data = await apiFetch<{ events: GameEvent[] }>(`/api/v14/events${q}`);
  return data?.events ?? [];
}

// ── Agents (requires API key) ──

export async function fetchAgents(apiKey: string): Promise<Record<string, unknown>[]> {
  const data = await apiFetch<{ agents: Record<string, unknown>[] }>('/api/agents', {
    token: apiKey,
  });
  return data?.agents ?? [];
}

// ── v30 Task 1-8: Token Rewards / Buyback / Defense API ──

export interface TokenReward {
  id: string;
  playerId: string;
  playerName: string;
  rewardType: string;
  tokenType: string;
  countryCode: string;
  amount: number;
  reason: string;
  timestamp: number;
  txHash?: string;
  pending: boolean;
}

export interface BuybackEntry {
  iso3: string;
  gdpTaxAmount: number;
  tokensReceived: number;
  txHash?: string;
  timestamp: string;
}

export interface BurnEntry {
  iso3: string;
  amount: number;
  reason: string;
  txHash?: string;
  timestamp: string;
}

export interface DefenseMultiplierData {
  multipliers: Record<string, {
    multiplier: number;
    marketCap: number;
    frozen: boolean;
    lastUpdated: string;
  }>;
}

export interface BuybackStatsData {
  totalBuybackValue: number;
  totalBurnedValue: number;
  totalBuybackCount: number;
  totalBurnCount: number;
  activeCountries: number;
}

export interface DefenseStatsData {
  totalCountries: number;
  frozenCountries: number;
  avgMultiplier: number;
  maxMultiplier: number;
  maxIso3: string;
  totalMarketCap: number;
}

/** 플레이어의 보상 내역을 조회합니다. */
export async function fetchRewards(playerId: string, limit = 50): Promise<TokenReward[]> {
  const data = await apiFetch<TokenReward[]>(`/api/v14/rewards/${playerId}?limit=${limit}`);
  return data ?? [];
}

/** 바이백 이력을 조회합니다. */
export async function fetchBuybackHistory(limit = 50): Promise<BuybackEntry[]> {
  const data = await apiFetch<{ history: BuybackEntry[] }>(`/api/buyback/history?limit=${limit}`);
  return data?.history ?? [];
}

/** 소각 이력을 조회합니다. */
export async function fetchBurnHistory(limit = 50): Promise<BurnEntry[]> {
  const data = await apiFetch<{ burns: BurnEntry[] }>(`/api/buyback/burns?limit=${limit}`);
  return data?.burns ?? [];
}

/** 바이백 통계를 조회합니다. */
export async function fetchBuybackStats(): Promise<BuybackStatsData | null> {
  return apiFetch<BuybackStatsData>('/api/buyback/stats');
}

/** 방어 배율 정보를 조회합니다. */
export async function fetchDefenseMultipliers(): Promise<DefenseMultiplierData | null> {
  return apiFetch<DefenseMultiplierData>('/api/defense/multipliers');
}

/** 방어 통계를 조회합니다. */
export async function fetchDefenseStats(): Promise<DefenseStatsData | null> {
  return apiFetch<DefenseStatsData>('/api/defense/stats');
}

// ── v30 Phase 2: Token Price ──

export interface TokenPriceData {
  price: number;
  volume24h: number;
  change24h: number;
  marketCap: number;
  source: 'forge' | 'simulation' | 'unavailable';
  updatedAt: number;
}

/** $AWW 토큰 가격을 조회합니다. (Task 2-3) */
export async function fetchTokenPrice(): Promise<TokenPriceData | null> {
  return apiFetch<TokenPriceData>('/api/token/price');
}

/** $AWW 토큰 가격 이력을 조회합니다. */
export async function fetchTokenPriceHistory(limit = 100): Promise<TokenPriceData[]> {
  const data = await apiFetch<{ history: TokenPriceData[] }>(`/api/token/price/history?limit=${limit}`);
  return data?.history ?? [];
}

// ── v30 Phase 2: Player Token Balance (Task 2-11) ──

export interface PlayerTokenBalanceData {
  playerId: string;
  balance: number;
  token: string;
}

/** 플레이어의 $AWW 토큰 잔고를 조회합니다. */
export async function fetchPlayerTokenBalance(playerId: string): Promise<PlayerTokenBalanceData | null> {
  return apiFetch<PlayerTokenBalanceData>(`/api/v14/token-balance/${playerId}`);
}

// ── v30 Phase 2: Staking (Task 2-16) ──

export interface StakingStatusData {
  playerId: string;
  amount: number;
  stakedAt: number;
  seasonEnd: number;
  multiplier: number;
  canWithdraw: boolean;
  penaltyRate: number;
  staked?: boolean;
}

/** 플레이어의 스테이킹 상태를 조회합니다. */
export async function fetchStakingStatus(playerId: string): Promise<StakingStatusData | null> {
  return apiFetch<StakingStatusData>(`/api/staking/status/${playerId}`);
}

// ── v30 Phase 2: Auction (Task 2-17) ──

export interface AuctionData {
  id: string;
  countryIso: string;
  countryName: string;
  tier: string;
  status: string;
  minBid: number;
  currentBid: number;
  topBidder: string;
  topFaction: string;
  bids: Array<{
    bidderId: string;
    factionId: string;
    amount: number;
    timestamp: number;
  }>;
  startedAt: number;
  endsAt: number;
}

/** 활성 경매 목록을 조회합니다. */
export async function fetchAuctions(): Promise<AuctionData[]> {
  const data = await apiFetch<{ auctions: AuctionData[] }>('/api/auction/list');
  return data?.auctions ?? [];
}
