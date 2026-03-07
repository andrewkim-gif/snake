/**
 * Factions mock data — 팩션 목록/상세 데이터
 */

export interface MockFaction {
  id: string;
  name: string;
  tag: string;
  color: string;
  member_count: number;
  territory_count: number;
  military: number;
  economy: number;
  prestige: number;
  total_gdp: number;
}

export interface MockFactionDetail extends MockFaction {
  description: string;
  leader: string;
  founded: string;
}

export const MOCK_FACTIONS: MockFaction[] = [
  { id: 'east-asia', name: 'East Asia Coalition', tag: 'EAC', color: '#FF6B6B', member_count: 38, territory_count: 12, military: 4, economy: 5, prestige: 2400, total_gdp: 45000 },
  { id: 'nato-alliance', name: 'NATO Alliance', tag: 'NATO', color: '#3B82F6', member_count: 31, territory_count: 28, military: 5, economy: 4, prestige: 3200, total_gdp: 62000 },
  { id: 'brics-pact', name: 'BRICS Pact', tag: 'BRICS', color: '#10B981', member_count: 22, territory_count: 15, military: 3, economy: 4, prestige: 1800, total_gdp: 38000 },
  { id: 'african-union', name: 'African Union', tag: 'AU', color: '#F59E0B', member_count: 54, territory_count: 40, military: 2, economy: 3, prestige: 1200, total_gdp: 18000 },
  { id: 'nordic-council', name: 'Nordic Council', tag: 'NORD', color: '#8B5CF6', member_count: 5, territory_count: 5, military: 3, economy: 5, prestige: 900, total_gdp: 12000 },
  { id: 'mercosur', name: 'Mercosur Alliance', tag: 'MER', color: '#06B6D4', member_count: 8, territory_count: 6, military: 2, economy: 3, prestige: 750, total_gdp: 9500 },
];

export const MOCK_FACTION_DETAILS: Record<string, MockFactionDetail> = {
  'east-asia': {
    id: 'east-asia', name: 'East Asia Coalition', tag: 'EAC', color: '#FF6B6B',
    member_count: 38, territory_count: 12, military: 4, economy: 5, prestige: 2400, total_gdp: 45000,
    description: 'A coalition of East Asian nations focused on technological superiority and economic dominance.',
    leader: 'Commander Hayashi', founded: '2026-01-15',
  },
  'nato-alliance': {
    id: 'nato-alliance', name: 'NATO Alliance', tag: 'NATO', color: '#3B82F6',
    member_count: 31, territory_count: 28, military: 5, economy: 4, prestige: 3200, total_gdp: 62000,
    description: 'The Western military alliance prioritizing collective defense and democratic values.',
    leader: 'General Thornton', founded: '2026-01-10',
  },
  'brics-pact': {
    id: 'brics-pact', name: 'BRICS Pact', tag: 'BRICS', color: '#10B981',
    member_count: 22, territory_count: 15, military: 3, economy: 4, prestige: 1800, total_gdp: 38000,
    description: 'An economic bloc of emerging economies aiming to reshape the global order.',
    leader: 'Premier Volkov', founded: '2026-01-20',
  },
  'african-union': {
    id: 'african-union', name: 'African Union', tag: 'AU', color: '#F59E0B',
    member_count: 54, territory_count: 40, military: 2, economy: 3, prestige: 1200, total_gdp: 18000,
    description: 'United African nations building strength through numbers and resource wealth.',
    leader: 'Marshal Adeyemi', founded: '2026-02-01',
  },
  'nordic-council': {
    id: 'nordic-council', name: 'Nordic Council', tag: 'NORD', color: '#8B5CF6',
    member_count: 5, territory_count: 5, military: 3, economy: 5, prestige: 900, total_gdp: 12000,
    description: 'A small but highly efficient alliance of Nordic nations. Quality over quantity.',
    leader: 'Admiral Johansson', founded: '2026-01-25',
  },
  'mercosur': {
    id: 'mercosur', name: 'Mercosur Alliance', tag: 'MER', color: '#06B6D4',
    member_count: 8, territory_count: 6, military: 2, economy: 3, prestige: 750, total_gdp: 9500,
    description: 'South American economic and defense partnership.',
    leader: 'General Silva', founded: '2026-02-10',
  },
};
