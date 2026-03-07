/**
 * Profile mock data — 프로필/업적
 */

import type { TokenBalance } from '@/lib/crossx-config';

export const MOCK_PROFILE = {
  name: 'xXDarkLord420Xx',
  level: 42,
  winRate: 42,
  avgLevel: 7.3,
  totalBattles: 156,
  totalKills: 2847,
  totalDeaths: 189,
  playtime: '48h 23m',
  faction: 'East Asia Coalition',
  factionTag: 'EAC',
  country: 'KOR',
  rank: 'Commander',
};

export const MOCK_BALANCES: TokenBalance[] = [
  { iso3: 'KOR', name: 'Korea Token', symbol: '$KOR', balance: '50000', stakedBalance: '12000', pendingReward: '340', tier: 'S', marketCap: 8500000, defenseMultiplier: 1.45, stakingAPR: 1200 },
  { iso3: 'USA', name: 'USA Token', symbol: '$USA', balance: '25000', stakedBalance: '5000', pendingReward: '120', tier: 'S', marketCap: 12000000, defenseMultiplier: 1.55, stakingAPR: 980 },
  { iso3: 'JPN', name: 'Japan Token', symbol: '$JPN', balance: '15000', stakedBalance: '0', pendingReward: '0', tier: 'A', marketCap: 6200000, defenseMultiplier: 1.30, stakingAPR: 1100 },
  { iso3: 'GBR', name: 'UK Token', symbol: '$GBR', balance: '8000', stakedBalance: '2000', pendingReward: '45', tier: 'A', marketCap: 4800000, defenseMultiplier: 1.25, stakingAPR: 850 },
];

export const MOCK_ACHIEVEMENTS = [
  { name: 'First Blood', icon: '\u2694\uFE0F', description: 'Get your first kill in battle', tier: 'bronze', tierColor: '#CD7F32', unlocked: true },
  { name: 'Century Slayer', icon: '\uD83D\uDC80', description: 'Reach 100 total kills', tier: 'silver', tierColor: '#808080', unlocked: true },
  { name: 'Explorer', icon: '\uD83C\uDF0D', description: 'Visit 10 different countries', tier: 'bronze', tierColor: '#CD7F32', unlocked: true },
  { name: 'Iron Will', icon: '\uD83D\uDEE1\uFE0F', description: 'Survive 50 battles', tier: 'gold', tierColor: '#B8860B', unlocked: true },
  { name: 'Season Champion', icon: '\uD83D\uDC51', description: 'Win a season as faction leader', tier: 'platinum', tierColor: '#3B82F6', unlocked: false },
  { name: 'Whale', icon: '\uD83D\uDCB0', description: 'Stake over 1M tokens total', tier: 'gold', tierColor: '#B8860B', unlocked: false },
  { name: 'Master Diplomat', icon: '\uD83E\uDD1D', description: 'Successfully negotiate 5 treaties', tier: 'silver', tierColor: '#808080', unlocked: false },
  { name: 'Speed Demon', icon: '\u26A1', description: 'Reach Level 15 in under 5 minutes', tier: 'gold', tierColor: '#B8860B', unlocked: false },
];
