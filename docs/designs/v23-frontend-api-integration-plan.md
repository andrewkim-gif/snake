# PLAN: v23 — Frontend Mock Data 제거 + API 연동 전환

## 1. 개요

v18에서 Supabase REST API 백엔드를 완성했으나, 프론트엔드 17개 페이지 중 **8개 페이지가 여전히 mock 데이터에 의존**하고 있다.
이 기획은 모든 mock 데이터를 실제 서버 API로 교체하여 프론트엔드-백엔드 완전 연동을 달성한다.

### 목표
- `apps/web/lib/mock-data/` 모듈 **전체 삭제** (6개 파일)
- `CountryPanel.tsx`의 인라인 mock 생성기 6개 제거
- `dashboard/page.tsx`의 인라인 hardcoded 데이터 제거
- 모든 페이지에서 `useApiData` + `api-client.ts` 패턴 통일
- 서버 미접속 시 loading skeleton / error boundary 표시 (mock fallback 아님)

## 2. 현재 상태 분석

### Mock 의존도 분류

| 등급 | 페이지 | Mock 소스 | 서버 API 존재 여부 |
|------|--------|-----------|-------------------|
| **CRITICAL** | `/governance` | `MOCK_PROPOSALS` | `/api/council` 존재 (CouncilRoutes) |
| **CRITICAL** | `/governance/history` | `MOCK_VOTE_HISTORY` | `/api/council` 존재 |
| **CRITICAL** | `/governance/new` | `GOVERNANCE_COUNTRIES` | `/api/countries` 존재 |
| **CRITICAL** | `/economy/tokens` | `generateMockData()` | `/api/gdp` + `/api/countries` 존재 |
| **CRITICAL** | `/profile` | `MOCK_PROFILE`, `MOCK_BALANCES`, `MOCK_ACHIEVEMENTS` | `/api/v14/account/{id}` + `/api/achievements` 존재 |
| **CRITICAL** | `/dashboard` | 인라인 hardcoded (5개 패널) | `/api/agents/`, `/ws/agents/live`, training API 존재 |
| **CRITICAL** | `CountryPanel.tsx` | 인라인 mock 생성기 6개 | `/api/countries`, `/api/gdp`, `/api/council` 존재 |
| **HIGH** | `/factions` | `MOCK_FACTIONS`, `MOCK_FACTION_DETAILS` | `/api/factions` 존재 + `fetchFactions()` 구현됨 |
| **HIGH** | `/factions/[id]` | `MOCK_FACTION_DETAILS` | `/api/factions/{id}` 존재 + `fetchFaction()` 구현됨 |
| **HIGH** | `/hall-of-fame` | `MOCK_RECORDS`, `MOCK_SEASONS` | `/api/hall-of-fame` 존재 + fetcher 구현됨 |

### Mock 미사용 (변경 불필요)

| 페이지 | 데이터 소스 |
|--------|------------|
| `/` (로비) | WebSocket 실시간 |
| `/arena` | WebSocket 실시간 |
| `/economy/trade` | `TradeMarket` 컴포넌트 내부 fetch |
| `/economy/policy` | `PolicyPanel` 컴포넌트 내부 fetch |
| `/factions/market` | `MercenaryMarket` 컴포넌트 내부 fetch |
| `/minecraft` | 서버 불필요 (standalone) |
| `/debug` | WebSocket 실시간 |

## 3. 기술 방향

### API 클라이언트 확장
- 기존 `api-client.ts` 에 새 fetcher 함수 추가
- 기존 `useApiData` hook 재사용 (polling 지원)
- 타입 정의는 api-client.ts 내부에 인터페이스로 선언

### 데이터 패칭 패턴 통일
```
[Page] → useApiData(fetchXxx) → api-client.ts → GET /api/xxx → 서버
                ↓ loading       ↓ error
           Skeleton UI     ErrorBoundary
```

### 서버 미접속 시 동작
- 현재: mock 데이터로 fallback → **제거**
- 변경: loading skeleton → "서버 연결 필요" 메시지 or error boundary
- `isServerAvailable()` 체크 유지하되, mock fallback 대신 안내 UI

## 4. 서버 API 매핑

### 이미 구현된 API (api-client.ts fetcher 추가만 필요)

| Mock 데이터 | 서버 엔드포인트 | 상태 |
|------------|----------------|------|
| `MOCK_FACTIONS` | `GET /api/factions` | fetcher 있음 (`fetchFactions`) |
| `MOCK_FACTION_DETAILS` | `GET /api/factions/{id}` | fetcher 있음 (`fetchFaction`) |
| `MOCK_RECORDS` | `GET /api/hall-of-fame` | fetcher 있음 (`fetchHofRecords`) |
| `MOCK_SEASONS` | `GET /api/hall-of-fame/seasons` | fetcher 있음 (`fetchHofSeasons`) |
| `GOVERNANCE_COUNTRIES` | `GET /api/countries` | fetcher 있음 (`fetchCountries`) |
| `MOCK_PROPOSALS` | `GET /api/council` | fetcher 추가 필요 |
| `MOCK_VOTE_HISTORY` | `GET /api/council` (votes sub) | fetcher 추가 필요 |
| `MOCK_PROFILE` | `GET /api/v14/account/{id}` | fetcher 추가 필요 |
| `MOCK_ACHIEVEMENTS` | `GET /api/achievements/{userId}` | fetcher 추가 필요 |
| `generateMockData()` market | `GET /api/gdp` + `GET /api/countries` | fetcher 추가 필요 |

### 인라인 mock → API 매핑 (CountryPanel)

| getMock 함수 | 서버 엔드포인트 |
|-------------|----------------|
| `getMockTokenBalance(country)` | `GET /api/gdp` + `GET /api/countries` |
| `getMockStakingInfo(country)` | `GET /api/gdp` (country staking data) |
| `getMockProposals(iso3)` | `GET /api/council?country={iso3}` |
| `getMockNationStats(country)` | `GET /api/v11/world/status` + `GET /api/countries` |
| `getMockPolicies(country)` | `GET /api/economy/policy?country={iso3}` |
| `getMockFactionInfo(country)` | `GET /api/factions` (sovereign faction) |

### 인라인 mock → API 매핑 (Dashboard)

| 패널 | 서버 엔드포인트 |
|------|----------------|
| APIKeysPanel | 신규 필요: `GET/POST/DELETE /api/keys` |
| AgentsPanel | `GET /api/agents/` (AgentRouter) |
| BattleLogPanel | `GET /api/v14/events` |
| StrategyPanel | `GET/PUT /api/agent/{id}/training` + `/build-path` |
| LiveBattlePanel | `WebSocket /ws/agents/live` |

## 5. 리스크

| 리스크 | 영향 | 완화 전략 |
|--------|------|----------|
| 서버 API 응답 형식 ≠ mock 형식 | 페이지 렌더링 깨짐 | api-client에서 변환 어댑터 작성 |
| 서버 미실행 시 빈 화면 | UX 저하 | loading skeleton + "Connect server" 안내 |
| API Key 관리 엔드포인트 미존재 | Dashboard 미완성 | Phase 3에서 서버사이드 구현 |
| 토큰 잔액 API 미존재 | Profile/CountryPanel 부분 미완성 | GDP 데이터로 근사치 표시 |

## 구현 로드맵

### Phase 1: API 클라이언트 확장 + 공통 인프라
| Task | 설명 |
|------|------|
| api-client.ts fetcher 확장 | `fetchCouncilProposals`, `fetchCouncilVotes`, `fetchPlayerAccount`, `fetchPlayerAchievements`, `fetchGdpData`, `fetchWorldStatus` 등 10+ fetcher 추가 |
| 응답 타입 인터페이스 정의 | `CouncilProposal`, `VoteRecord`, `PlayerAccount`, `GdpEntry`, `WorldStatus` 등 |
| useApiData hook 검증 | polling, error handling, refetch 동작 확인 |
| 서버 미접속 안내 컴포넌트 | `<ServerRequired>` 컴포넌트 — "서버에 연결해주세요" 메시지 |

- **design**: N (로직 중심)
- **verify**: `npm run build` 성공, 타입 에러 없음

### Phase 2: Governance 3개 페이지 API 연동
| Task | 설명 |
|------|------|
| `/governance` 페이지 전환 | `MOCK_PROPOSALS` → `useApiData(fetchCouncilProposals)`, vote/withdraw는 `POST /api/council` 호출 |
| `/governance/history` 페이지 전환 | `MOCK_VOTE_HISTORY` → `useApiData(fetchCouncilVotes)` |
| `/governance/new` 페이지 전환 | `GOVERNANCE_COUNTRIES` → `useApiData(fetchCountries)`, submit → `POST /api/council/proposals` |
| mock-data/governance.ts 삭제 | import 제거 + 파일 삭제 |

- **design**: N (기존 UI 유지, 데이터 소스만 교체)
- **verify**: 빌드 성공, governance 페이지 3개 렌더링 확인, mock import 없음

### Phase 3: Profile + Economy Tokens 페이지 API 연동
| Task | 설명 |
|------|------|
| `/profile` 페이지 전환 | `MOCK_PROFILE` → `useApiData(fetchPlayerAccount)`, `MOCK_ACHIEVEMENTS` → `useApiData(fetchPlayerAchievements)`, `MOCK_BALANCES` → GDP 기반 근사치 또는 countries 데이터 |
| `/economy/tokens` 페이지 전환 | `generateMockData()` → `useApiData(fetchGdpData)` + `useApiData(fetchCountries)` 조합, 30초 polling 유지 |
| mock-data/profile.ts 삭제 | import 제거 + 파일 삭제 |
| mock-data/economy.ts 삭제 | import 제거 + 파일 삭제 |

- **design**: N (기존 UI 유지)
- **verify**: 빌드 성공, profile/tokens 페이지 렌더링 확인

### Phase 4: Factions + Hall of Fame mock fallback 제거
| Task | 설명 |
|------|------|
| `/factions` 완전 전환 | mock fallback 카드 그리드 제거, 항상 `useApiData(fetchFactions)` 사용, detail modal도 `fetchFaction(id)` 사용 |
| `/factions/[id]` 완전 전환 | `MOCK_FACTION_DETAILS` fallback 제거, 항상 서버 데이터 |
| `/hall-of-fame` 완전 전환 | mock fallback 제거, 항상 `useApiData(fetchHofRecords)` + `fetchHofSeasons()` |
| mock-data/factions.ts 삭제 | import 제거 + 파일 삭제 |
| mock-data/hall-of-fame.ts 삭제 | import 제거 + 파일 삭제 |

- **design**: N (기존 UI 유지)
- **verify**: 빌드 성공, factions/hall-of-fame 페이지 렌더링 확인, mock import 없음

### Phase 5: CountryPanel 인라인 mock 제거
| Task | 설명 |
|------|------|
| CountryPanel API 연동 | 6개 `getMock*()` 함수를 `useApiData` 기반 실제 API 호출로 교체 |
| TokenTab 전환 | `getMockTokenBalance` → GDP/countries 데이터, `getMockStakingInfo` → GDP 데이터 |
| VoteTab 전환 | `getMockProposals` → `fetchCouncilProposals(iso3)` |
| CivilizationTab 전환 | `getMockNationStats` → world/status + countries, `getMockPolicies` → policy API |
| FactionTab 전환 | `getMockFactionInfo` → factions API (sovereign faction) |

- **design**: N (기존 UI 유지)
- **verify**: 빌드 성공, CountryPanel 5개 탭 렌더링 확인

### Phase 6: Dashboard 인라인 mock 제거
| Task | 설명 |
|------|------|
| AgentsPanel 연동 | hardcoded agents → `GET /api/agents/` |
| BattleLogPanel 연동 | hardcoded logs → `GET /api/v14/events` |
| StrategyPanel 연동 | local state → `GET/PUT /api/agent/{id}/training` + `/build-path` |
| LiveBattlePanel 연동 | fake setInterval → real WebSocket `/ws/agents/live` |
| APIKeysPanel placeholder | 서버 API 미존재 → "Coming Soon" 또는 local storage 기반 임시 |

- **design**: N (기존 UI 유지)
- **verify**: 빌드 성공, dashboard 5개 패널 렌더링 확인

### Phase 7: 정리 + 최종 검증
| Task | 설명 |
|------|------|
| mock-data/index.ts 삭제 | 전체 barrel 파일 삭제 |
| mock-data/ 디렉토리 삭제 | 빈 디렉토리 정리 |
| WorldView placeholder 정리 | 인라인 placeholder 값을 실제 world/status 데이터로 교체 |
| WalletConnect mock 유지 | CROSSx 미설치 시 mock wallet은 의도된 동작이므로 유지 |
| 전체 빌드 검증 | `npm run build` 성공, mock-data import 0건, TypeScript 에러 0건 |
| 전체 페이지 렌더링 검증 | 서버 접속 상태에서 17개 페이지 모두 정상 렌더링 |

- **design**: N
- **verify**: 빌드 성공, `grep -r "mock-data" apps/web/` 결과 0건, 전체 페이지 렌더링 확인
