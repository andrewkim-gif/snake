# PLAN: v18 — Supabase PostgreSQL 연동 + Mock 데이터 제거

## 1. 개요

### 배경
현재 AI World War Go 서버는 16+ 매니저가 모두 **인메모리**로 동작. 서버 재시작 시 모든 시뮬레이션 데이터(팩션, 경제, 외교, 전쟁, 시즌) 소실. 프론트엔드는 5개 목업 모듈로 더미 데이터 표시 중. API 경로도 불일치.

### 핵심 목표
1. Go 서버 → Supabase PostgreSQL 직접 연결 (write-through 패턴)
2. 서버 재시작 시 데이터 복구 (DB → 인메모리 로드)
3. 프론트엔드 목업 데이터 제거, 실제 서버 API 사용
4. API 경로 불일치 해결 (`/api/` ↔ `/api/v11/`)

### 비목표
- DB를 primary store로 전환하지 않음 (인메모리가 여전히 런타임 주 저장소)
- 사용자 인증/로그인 시스템 구현 (별도 작업)
- 거버넌스 페이지 서버 API 신규 개발 (목업 유지)

## 2. 요구사항

### 기능 요구사항
- [FR-1] Go 서버가 `DATABASE_URL` 환경변수로 Supabase PostgreSQL에 연결
- [FR-2] 서버 시작 시 DB에서 팩션/시즌/외교 데이터 자동 로드
- [FR-3] 팩션 생성/가입/탈퇴 시 DB에 비동기 write-through
- [FR-4] 경제 데이터 5분 주기 배치 플러시
- [FR-5] `/api/` 경로가 `/api/v11/`과 동일한 핸들러 호출
- [FR-6] 프론트엔드 7개 허브 페이지가 서버 API에서 데이터 로드
- [FR-7] DB 연결 실패 시 순수 인메모리로 graceful fallback

### 비기능 요구사항
- [NFR-1] DB 쓰기가 게임 루프 핫패스를 블로킹하지 않음 (비동기)
- [NFR-2] DB 연결 없이도 서버 정상 동작 (Redis와 동일 패턴)
- [NFR-3] 기존 에이전트 SDK `/api/v11/` 경로 하위호환 유지

## 3. 기술 방향

- **DB**: Supabase PostgreSQL (기존 schema.sql 11 테이블 활용)
- **드라이버**: `lib/pq` (이미 go.mod에 존재)
- **연결**: `DATABASE_URL` 환경변수 → `sql.Open("postgres", url)`
- **풀링**: Supabase Connection Pooler (port 6543, PgBouncer transaction mode)
- **패턴**: Write-through (인메모리 primary, DB backup)
- **프론트**: `useApiData` 훅으로 API-first + mock fallback → 단계적 mock 제거

## 4. 아키텍처 개요

```
┌──────────────┐    WebSocket     ┌──────────────┐
│  Next.js     │◄────────────────►│  Go Server   │
│  Frontend    │    REST /api/    │  (port 9000) │
│  (port 9001) │────────────────►│              │
└──────────────┘                  └──────┬───────┘
                                         │ Write-through
                                         │ (async)
                                  ┌──────▼───────┐
                                  │  Supabase    │
                                  │  PostgreSQL  │
                                  │  (port 6543) │
                                  └──────────────┘
```

**데이터 흐름**:
1. 매니저 mutation → 인메모리 업데이트 (즉시) → DB write-through (비동기)
2. 서버 시작 → DB에서 로드 → 인메모리 맵 채움
3. DB 장애 → 인메모리만 동작 (경고 로그)

## 5. 리스크

| 리스크 | 영향 | 완화 전략 |
|--------|------|----------|
| Supabase 연결 지연 | 첫 요청 느림 | 커넥션 풀 warmup + 5초 타임아웃 |
| PgBouncer prepared stmt 제한 | 쿼리 실패 | `lib/pq` simple protocol 사용 |
| API 경로 충돌 (/api/ vs /api/agent/) | 라우팅 에러 | chi 마운트 순서로 구분 |
| Mock 제거 후 빈 데이터 | 빈 화면 | useApiData 훅의 fallback 유지 |
| Write-through 실패 누적 | 데이터 불일치 | 5분 배치 플러시 + 워닝 로그 |

## 6. 주요 설계 결정 (ADR)

### ADR-001: DB는 Optional Dependency
- 결정: Redis와 동일하게, DB 없이도 서버 정상 동작
- 이유: 로컬 개발, 테스트 시 DB 설정 불필요

### ADR-002: Write-Through (not Write-Behind)
- 결정: mutation 시점에 즉시 비동기 DB 쓰기
- 이유: 데이터 유실 최소화, 구현 단순

### ADR-003: 서버에 호환 라우트 추가 (not 프론트엔드 수정)
- 결정: Go 서버에 `/api/` 별칭 라우트 추가
- 이유: 프론트엔드 30+ fetch URL 변경 불필요, 에이전트 SDK 호환 유지

### ADR-004: Governance 목업 유지
- 결정: 거버넌스 페이지는 목업 유지 (서버에 proposals API 없음)
- 이유: UNCouncil API는 다른 추상화, 별도 작업 필요

---

## 구현 로드맵

### Phase 1: DB 연결 레이어 강화
| Task | 설명 |
|------|------|
| DATABASE_URL 지원 | `db.go`에 `NewFromURL()` 추가, Supabase 커넥션 풀러(6543) 감지 및 풀 튜닝 |
| 마이그레이션 러너 | `migrate.go` 생성, `schema_migrations` 테이블로 스키마 적용 추적 |
| main.go DB 연결 | Redis 다음에 DB 초기화, graceful fallback, defer Close |
| Supabase 스키마 적용 | `schema.sql` + `002_performance_indexes.sql` Supabase에 실행 |

- **design**: N
- **verify**: `DATABASE_URL` 설정 시 "PostgreSQL connected" 로그, 미설정 시 정상 시작, Supabase에 11 테이블 생성 확인

### Phase 2: Repository 레이어 (CRUD)
| Task | 설명 |
|------|------|
| Repository 인터페이스 | `repository.go` — FactionRepo, CountryRepo, SeasonRepo, DiplomacyRepo, BattleRepo, AchievementRepo 정의 |
| Faction Repository | `pg_faction.go` — UPSERT faction/members, LIST, DELETE |
| Country Repository | `pg_country.go` — BULK UPSERT 195국, 주권 업데이트, GDP 업데이트 |
| Season Repository | `pg_season.go` — UPSERT/GET active season |
| Diplomacy Repository | `pg_diplomacy.go` — treaty/war UPSERT, LIST active |
| Battle/Achievement Repo | `pg_battle.go`, `pg_achievement.go` — INSERT battle, GET user achievements |
| Store 래퍼 | `store.go` — 모든 repo를 통합하는 Store struct |

- **design**: N
- **verify**: 각 repo 단위 테스트 — upsert 멱등성, JSONB 직렬화/역직렬화, 195국 벌크 삽입 성공

### Phase 3: Write-Through 통합 (핵심 매니저)
| Task | 설명 |
|------|------|
| FactionManager DB 통합 | `SetStore()`, `LoadFromDB()`, 생성/가입/탈퇴 시 `persistAsync()` |
| EconomyEngine DB 통합 | `SetStore()`, 5분 배치 플러시 goroutine, dirty 국가 추적 |
| SeasonEngine DB 통합 | `SetStore()`, `LoadFromDB()`, 시즌 생성/Era 전환 시 동기 쓰기 |
| DiplomacyEngine DB 통합 | `SetStore()`, 조약/전쟁 생성/변경 시 write-through |
| WorldManager DB 통합 | 195국 주권 데이터 시작 시 DB 로드, 주권 변경 시 write-through |
| main.go Store 주입 | DB 존재 시 Store 생성 → 각 매니저에 SetStore + LoadFromDB 호출 |

- **design**: N
- **verify**: 서버 시작 + 팩션 생성 → DB에 기록 확인, 서버 재시작 → DB에서 팩션 로드 확인, DB 끊김 → 인메모리만 동작

### Phase 4: API 라우트 호환 레이어
| Task | 설명 |
|------|------|
| `/api/` 호환 라우트 | `router.go`에 `/api/` 그룹 추가 — factions, diplomacy, wars, economy/policy, economy/trade |
| 네이밍 불일치 해결 | wars↔war, economy/policy↔policy, economy/trade↔trade, mercenaries↔mercenary, tech↔tech-tree |
| 경로 충돌 테스트 | 기존 `/api/agent/`, `/api/agents/`, `/api/player/` 등과 충돌 없는지 확인 |
| Hall of Fame + Achievements | `/api/hall-of-fame/*`, `/api/achievements/*` 호환 라우트 |

- **design**: N
- **verify**: `curl /api/factions` == `curl /api/v11/factions` 동일 응답, 에이전트 SDK `/api/v11/` 경로 여전히 동작

### Phase 5: 프론트엔드 Mock 데이터 제거
| Task | 설명 |
|------|------|
| API 클라이언트 유틸 | `lib/api-client.ts` — 공통 fetch 래퍼 (SERVER_URL + error handling) |
| useApiData 훅 | `hooks/useApiData.ts` — API-first + fallback 패턴 |
| Factions 페이지 전환 | `MOCK_FACTIONS` → `/api/factions` fetch, 토글 제거 |
| Economy Tokens 전환 | `generateMockData()` → `/api/economy/trade/market` + `/api/v11/gdp/ranking` |
| Hall of Fame 전환 | `MOCK_RECORDS/SEASONS` → `/api/hall-of-fame` |
| Profile 페이지 전환 | `MOCK_PROFILE` → 서버 API 조합 (account + achievements + faction) |
| Mock 파일 삭제 | `lib/mock-data/` 디렉토리 전체 삭제 (governance 제외 → governance.ts만 유지) |

- **design**: Y (UI 로딩 상태, 에러 상태 표시)
- **verify**: 서버 가동 중 → 7개 허브 페이지 실제 데이터 표시, 서버 중지 → 빈 상태 + "서버 연결 안됨" 표시, TypeScript 빌드 성공

### Phase 6: 정리 및 E2E 검증
| Task | 설명 |
|------|------|
| DB health 엔드포인트 | `/health`에 database 상태 추가 |
| 시드 데이터 | `seed.go` — 첫 시작 시 195국 + Season 1 DB 삽입 |
| 스모크 테스트 | 전체 API 엔드포인트 curl 검증 스크립트 |
| 시뮬레이션 E2E | 100 에이전트 시뮬 → DB에 팩션/경제 데이터 축적 → 서버 재시작 → 데이터 유지 확인 |
| Mock 잔존 참조 제거 | codebase 전체 `mock-data` import 검색 → 0건 확인 |

- **design**: N
- **verify**: 100 에이전트 시뮬 후 서버 재시작 → 팩션/시즌/경제 데이터 100% 복구, `/health` DB 상태 표시

---

## 핵심 파일 목록

### 수정 대상
| 파일 | Phase | 변경 내용 |
|------|-------|----------|
| `server/internal/db/db.go` | 1 | `NewFromURL()` 추가, 풀 튜닝 |
| `server/cmd/server/main.go` | 1,3 | DB 초기화 + Store 주입 + LoadFromDB |
| `server/cmd/server/router.go` | 4 | `/api/` 호환 라우트 추가 |
| `server/internal/meta/faction.go` | 3 | SetStore, LoadFromDB, persistAsync |
| `server/internal/meta/economy.go` | 3 | SetStore, 5분 배치 플러시 |
| `server/internal/meta/season.go` | 3 | SetStore, LoadFromDB |
| `server/internal/meta/diplomacy.go` | 3 | SetStore, write-through |
| `server/internal/world/world_manager.go` | 3 | 주권 데이터 DB 로드/저장 |
| `apps/web/app/(hub)/factions/page.tsx` | 5 | Mock → API |
| `apps/web/app/(hub)/economy/tokens/page.tsx` | 5 | Mock → API |
| `apps/web/app/(hub)/hall-of-fame/page.tsx` | 5 | Mock → API |
| `apps/web/app/(hub)/profile/page.tsx` | 5 | Mock → API |

### 신규 생성
| 파일 | Phase | 내용 |
|------|-------|------|
| `server/internal/db/migrate.go` | 1 | 스키마 마이그레이션 러너 |
| `server/internal/db/repository.go` | 2 | Repository 인터페이스 정의 |
| `server/internal/db/store.go` | 2 | 통합 Store struct |
| `server/internal/db/pg_faction.go` | 2 | Faction CRUD |
| `server/internal/db/pg_country.go` | 2 | Country CRUD |
| `server/internal/db/pg_season.go` | 2 | Season CRUD |
| `server/internal/db/pg_diplomacy.go` | 2 | Diplomacy CRUD |
| `server/internal/db/pg_battle.go` | 2 | Battle INSERT |
| `server/internal/db/pg_achievement.go` | 2 | Achievement CRUD |
| `server/internal/db/seed.go` | 6 | 초기 시드 데이터 |
| `apps/web/lib/api-client.ts` | 5 | 공통 API fetch 유틸 |
| `apps/web/hooks/useApiData.ts` | 5 | API-first 데이터 훅 |

### 삭제 대상
| 파일 | Phase |
|------|-------|
| `apps/web/lib/mock-data/economy.ts` | 5 |
| `apps/web/lib/mock-data/factions.ts` | 5 |
| `apps/web/lib/mock-data/hall-of-fame.ts` | 5 |
| `apps/web/lib/mock-data/profile.ts` | 5 |
| `apps/web/lib/mock-data/index.ts` | 5 (governance만 직접 import로 전환) |
