# v23 Frontend API Integration Report

## Executive Summary

v23에서 프론트엔드 전체의 mock 데이터를 실제 서버 API로 교체 완료.
**7 Phase, 7 커밋**, 21 파일 변경 (+1,741 / -1,857줄), **빌드 성공, mock-data 참조 0건**.

| 지표 | 값 |
|------|-----|
| Phase | 7/7 완료 |
| 커밋 | 7개 (`4dc2f72`..`60312c0`) |
| 파일 변경 | 21개 (+1,741 / -1,857) |
| Mock 파일 삭제 | 6개 (mock-data/ 디렉토리 전체) |
| 잔여 mock 참조 | 0건 |
| 빌드 상태 | 성공 (19 routes, 0 errors) |
| 빌드 반복 | Phase별 1회 (재시도 없음) |

## Phase별 결과

### Phase 1: API 클라이언트 확장 (`4dc2f72`)
- **api-client.ts**: 11개 fetcher 함수 + 8개 인터페이스 추가
- **ServerRequired.tsx**: 서버 미접속 안내 컴포넌트 신규 생성
- 변경: +174줄 (api-client), +19줄 (ServerRequired)

### Phase 2: Governance 3페이지 (`203b674`)
- `/governance`: `MOCK_PROPOSALS` → `fetchCouncilProposals()` + vote API
- `/governance/history`: `MOCK_VOTE_HISTORY` → `fetchCouncilVotes()`
- `/governance/new`: `GOVERNANCE_COUNTRIES` → `fetchCountries()` + proposal submit API
- **삭제**: `mock-data/governance.ts`
- 변경: +179 / -207줄

### Phase 3: Profile + Economy Tokens (`105d15d`)
- `/profile`: `MOCK_PROFILE/BALANCES/ACHIEVEMENTS` → `fetchPlayerAccount` + `fetchPlayerAchievements` + GDP 기반 잔액
- `/economy/tokens`: `generateMockData()` → `fetchGdpData` + `fetchCountries` 조합 (30초 polling)
- **삭제**: `mock-data/profile.ts`, `mock-data/economy.ts`
- 변경: +525 / -466줄

### Phase 4: Factions + Hall of Fame (`78c4ff4`)
- `/factions`: mock fallback 카드 그리드 + detail modal 제거 → 항상 서버 데이터
- `/factions/[id]`: mock fallback 제거 → FactionDetail + TechTree 서버 컴포넌트
- `/hall-of-fame`: mock timeline/records 제거 → HallOfFame 서버 컴포넌트
- **삭제**: `mock-data/factions.ts`, `mock-data/hall-of-fame.ts`
- 변경: +196 / -690줄

### Phase 5: CountryPanel (`f8b3c2b`)
- 6개 `getMock*()` 인라인 생성기 모두 제거
- API 기반 헬퍼 함수로 교체: `getTokenBalance`, `getStakingInfo`, `toProposals`, `getNationStats`, `getDefaultPolicies`, `getFactionInfo`
- 4개 `useApiData` 훅으로 실시간 데이터
- 변경: +145 / -273줄

### Phase 6: Dashboard (`d601624`)
- **AgentsPanel**: hardcoded → `fetchAgents(apiKey)` (15초 polling)
- **BattleLogPanel**: hardcoded → `fetchEvents(20)` (10초 polling)
- **StrategyPanel**: local-only → `GET/PUT /api/agent/{id}/training` 연동
- **LiveBattlePanel**: fake setInterval → real WebSocket `/ws/agents/live`
- **APIKeysPanel**: localStorage 영속화 + "Coming Soon" 안내
- 변경: +362 / -122줄

### Phase 7: 정리 (`60312c0`)
- `mock-data/` 디렉토리 완전 삭제
- `mock-data/index.ts` 삭제
- WorldView placeholder 값 정리 (50 → 0, population 실데이터 연결)
- 최종 검증: mock-data 참조 0건, MOCK_ 상수 0건

## 삭제된 Mock 파일

| 파일 | 내용 | Phase |
|------|------|-------|
| `mock-data/governance.ts` | MOCK_PROPOSALS, MOCK_VOTE_HISTORY, GOVERNANCE_COUNTRIES | 2 |
| `mock-data/profile.ts` | MOCK_PROFILE, MOCK_BALANCES, MOCK_ACHIEVEMENTS | 3 |
| `mock-data/economy.ts` | generateMockData() | 3 |
| `mock-data/factions.ts` | MOCK_FACTIONS, MOCK_FACTION_DETAILS | 4 |
| `mock-data/hall-of-fame.ts` | MOCK_RECORDS, MOCK_SEASONS | 4 |
| `mock-data/index.ts` | barrel re-export | 7 |

## 변경된 페이지 전체 목록

| 페이지 | 변경 전 | 변경 후 |
|--------|---------|---------|
| `/governance` | MOCK_PROPOSALS | `fetchCouncilProposals()` + `postCouncilVote()` |
| `/governance/history` | MOCK_VOTE_HISTORY | `fetchCouncilVotes()` |
| `/governance/new` | GOVERNANCE_COUNTRIES | `fetchCountries()` + `postCouncilProposal()` |
| `/profile` | MOCK_PROFILE/BALANCES/ACHIEVEMENTS | `fetchPlayerAccount()` + GDP 기반 잔액 |
| `/economy/tokens` | generateMockData() + setInterval | `fetchGdpData()` + `fetchCountries()` (30s poll) |
| `/factions` | MOCK_FACTIONS fallback | `fetchFactions()` only |
| `/factions/[id]` | MOCK_FACTION_DETAILS fallback | `fetchFaction(id)` only |
| `/hall-of-fame` | MOCK_RECORDS/SEASONS fallback | `fetchHofRecords()` + `fetchHofSeasons()` only |
| CountryPanel | 6x getMock*() inline | 4x useApiData + helper functions |
| Dashboard | 5x hardcoded panels | API + WebSocket + localStorage |
| WorldView | placeholder 50 | 0 + real data where available |

## 아키텍처 패턴

모든 페이지가 통일된 데이터 페칭 패턴을 사용:
```
Page → ServerRequired → useApiData(fetcher, {refreshInterval}) → api-client.ts → GET /api/xxx
         ↓ offline          ↓ loading         ↓ error
     "Connect server"    Skeleton UI     Error boundary
```

## 미완성 항목 (향후 작업)

| 항목 | 상태 | 비고 |
|------|------|------|
| API Key 서버 관리 | localStorage 임시 | 서버 엔드포인트 필요 |
| 토큰 잔액 API | GDP 근사치 | 지갑/온체인 연동 필요 |
| Staking/Buyback/Burn 데이터 | 빈 배열 | 전용 서버 API 필요 |
| WorldView happiness/militaryPower | 0 기본값 | civilization system 데이터 필요 |
| userBalance (governance/new) | 10000 hardcoded | 사용자 토큰 잔액 API 필요 |
