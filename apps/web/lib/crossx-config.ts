/**
 * CROSSx SDK Configuration for AI World War
 * CROSS Mainnet settings + Deep Linking (crossx:// scheme)
 */

// --- Chain Config ---
export const CROSS_CHAIN_CONFIG = {
  chainId: 8851, // CROSS Mainnet
  chainName: 'CROSS Mainnet',
  rpcUrl: process.env.NEXT_PUBLIC_CROSS_RPC_URL || 'https://rpc.crosstoken.io',
  wsUrl: process.env.NEXT_PUBLIC_CROSS_WS_URL || 'wss://ws.crosstoken.io',
  explorerUrl: process.env.NEXT_PUBLIC_CROSS_EXPLORER_URL || 'https://explorer.crosstoken.io',
  dexUrl: process.env.NEXT_PUBLIC_CROSS_DEX_URL || 'https://dex.crosstoken.io',
  nativeCurrency: {
    name: 'CROSS',
    symbol: 'CROSS',
    decimals: 18,
  },
} as const;

// --- CROSSx Deep Linking ---
export const CROSSX_SCHEME = 'crossx://';

export const CROSSX_LINKS = {
  /** Open CROSSx wallet */
  wallet: () => `${CROSSX_SCHEME}wallet`,

  /** Connect to AI World War dApp */
  connect: (callbackUrl: string) =>
    `${CROSSX_SCHEME}connect?dapp=aiworldwar&callback=${encodeURIComponent(callbackUrl)}`,

  /** Send tokens */
  send: (tokenAddress: string, to: string, amount: string) =>
    `${CROSSX_SCHEME}send?token=${tokenAddress}&to=${to}&amount=${amount}`,

  /** Approve token spending */
  approve: (tokenAddress: string, spender: string, amount: string) =>
    `${CROSSX_SCHEME}approve?token=${tokenAddress}&spender=${spender}&amount=${amount}`,

  /** Stake tokens */
  stake: (treasuryAddress: string, amount: string) =>
    `${CROSSX_SCHEME}stake?contract=${treasuryAddress}&amount=${amount}`,

  /** View token on DEX */
  dexToken: (symbol: string) =>
    `${CROSS_CHAIN_CONFIG.dexUrl}/token/${symbol}`,

  /** View transaction on explorer */
  explorer: (txHash: string) =>
    `${CROSS_CHAIN_CONFIG.explorerUrl}/tx/${txHash}`,
} as const;

// --- Deployed Contract Addresses ---
export const CONTRACT_ADDRESSES = {
  awwToken: '0xfD486ba056dFa2d8625a8bB74e4f207F70ab8CD7',
  forgePool: 'https://x.crosstoken.io/forge/token/0xfD486ba056dFa2d8625a8bB74e4f207F70ab8CD7',
  // Foundry contracts (not yet deployed — Phase 10)
  nationalTokenFactory: '',
  defenseOracle: '',
  governanceModule: '',
} as const;

export interface ContractAddresses {
  awwToken: string;
  nationalTokenFactory: string;
  defenseOracle: string;
  governanceModule: string;
}

// --- Wallet State ---
export interface WalletState {
  connected: boolean;
  address: string;
  chainId: number;
  balance: string; // CROSS native balance
}

// --- Token Balance ---
export interface TokenBalance {
  iso3: string;
  name: string;
  symbol: string;
  balance: string;
  stakedBalance: string;
  pendingReward: string;
  tier: string;
  marketCap: number;
  defenseMultiplier: number;
  stakingAPR: number;
}

// --- Staking Info ---
export interface StakingInfo {
  iso3: string;
  totalStaked: string;
  userStaked: string;
  pendingReward: string;
  apr: number; // basis points (1000 = 10%)
  lastStakeTimestamp: number;
}

// --- Helper: format token amount ---
export function formatTokenAmount(amount: string, decimals = 18): string {
  const num = parseFloat(amount) / Math.pow(10, decimals);
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
  return num.toFixed(2);
}

// --- Helper: format market cap ---
export function formatMarketCap(cap: number): string {
  if (cap >= 1_000_000) return `$${(cap / 1_000_000).toFixed(2)}M`;
  if (cap >= 1_000) return `$${(cap / 1_000).toFixed(2)}K`;
  return `$${cap.toFixed(2)}`;
}

// --- Helper: defense multiplier to percentage ---
export function defenseMultiplierToPercent(basisPoints: number): string {
  const percent = ((basisPoints - 10000) / 100);
  if (percent <= 0) return '+0%';
  return `+${Math.min(percent, 30).toFixed(1)}%`;
}

// --- Helper: check if CROSSx app is available ---
export function isCrossxAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  // Check if running inside CROSSx WebView or if deep link scheme is registered
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return !!(window as any).crossx || navigator.userAgent.includes('CROSSx');
}

// --- Helper: open CROSSx deep link ---
export function openCrossx(url: string): void {
  if (typeof window === 'undefined') return;
  window.location.href = url;
}
