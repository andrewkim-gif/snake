/**
 * Mock data — 통합 re-export
 * @deprecated v18: 서버 API가 있을 때는 api-client.ts + useApiData 훅 사용.
 * Mock은 SERVER_URL 미설정 시 폴백으로만 사용됩니다.
 * governance.ts는 서버 API가 없으므로 계속 사용합니다.
 */
export { MOCK_FACTIONS, MOCK_FACTION_DETAILS } from './factions';
export type { MockFaction, MockFactionDetail } from './factions';

export { MOCK_PROPOSALS, MOCK_VOTE_HISTORY, GOVERNANCE_COUNTRIES } from './governance';

export { MOCK_RECORDS, MOCK_SEASONS } from './hall-of-fame';
export type { MockSeasonRecord, MockTimelineSeason } from './hall-of-fame';

export { MOCK_PROFILE, MOCK_BALANCES, MOCK_ACHIEVEMENTS } from './profile';

export { generateMockData } from './economy';
