/**
 * Hall of Fame mock data — 명예의 전당 기록/시즌
 */

export interface MockSeasonRecord {
  id: string;
  season: number;
  seasonName: string;
  category: string;
  categoryIcon: string;
  winnerName: string;
  winnerType: 'faction' | 'player';
  recordLabel: string;
  trophyType: 'gold' | 'silver' | 'bronze';
}

export interface MockTimelineSeason {
  number: number;
  name: string;
  startDate: string;
  endDate: string;
  champion: string;
  totalBattles: number;
  peakPlayers: number;
}

export const MOCK_RECORDS: MockSeasonRecord[] = [
  { id: '1', season: 1, seasonName: 'Dawn of Nations', category: 'Season Champion', categoryIcon: '\uD83C\uDFC6', winnerName: 'NATO Alliance', winnerType: 'faction', recordLabel: 'Dominated 42 territories at season end', trophyType: 'gold' },
  { id: '2', season: 1, seasonName: 'Dawn of Nations', category: 'Top Warrior', categoryIcon: '\u2694\uFE0F', winnerName: 'xXDarkLord420Xx', winnerType: 'player', recordLabel: '2,847 kills across 156 battles', trophyType: 'gold' },
  { id: '3', season: 1, seasonName: 'Dawn of Nations', category: 'Richest Faction', categoryIcon: '\uD83D\uDCB0', winnerName: 'East Asia Coalition', winnerType: 'faction', recordLabel: 'GDP: 85,000 at peak', trophyType: 'gold' },
  { id: '4', season: 1, seasonName: 'Dawn of Nations', category: 'Master Diplomat', categoryIcon: '\uD83D\uDEE1\uFE0F', winnerName: 'Admiral Johansson', winnerType: 'player', recordLabel: '12 successful treaty negotiations', trophyType: 'silver' },
  { id: '5', season: 1, seasonName: 'Dawn of Nations', category: 'Speed Runner', categoryIcon: '\u26A1', winnerName: 'GhostSnake_kr', winnerType: 'player', recordLabel: 'Reached Level 20 in 3m 42s', trophyType: 'gold' },
  { id: '6', season: 1, seasonName: 'Dawn of Nations', category: 'Legendary Battle', categoryIcon: '\uD83D\uDC51', winnerName: 'Battle of Seoul', winnerType: 'faction', recordLabel: '64 players, 3 factions, 22 minutes', trophyType: 'gold' },
];

export const MOCK_SEASONS: MockTimelineSeason[] = [
  { number: 1, name: 'Dawn of Nations', startDate: '2026-01-15', endDate: '2026-02-12', champion: 'NATO Alliance', totalBattles: 4820, peakPlayers: 1240 },
  { number: 2, name: 'Rising Empires', startDate: '2026-02-19', endDate: '2026-03-19', champion: 'TBD', totalBattles: 2100, peakPlayers: 890 },
];
