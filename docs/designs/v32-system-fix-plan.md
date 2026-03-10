# PLAN: v32 — 시스템 전체 이슈 해결 기획

**날짜**: 2026-03-10
**기반 문서**: `docs/v31-system-analysis-report.md` (CRITICAL 7 + WARNING 6 + INFO 3)
**목표**: 프론트엔드-서버 간 불일치 해소, 인증 체계 통일, 토큰 Sink 실효성 확보

---

## 1. 개요

v31 시스템 분석에서 발견된 16개 이슈(C7 + W6 + I3)를 체계적으로 해결합니다.

**핵심 문제 3가지:**
1. **Governance API 완전 불일치** — 프론트가 `/api/council/proposals`를 호출하나 서버는 `/api/council/resolutions`만 존재
2. **인증 체계 파편화** — Governance는 useWalletStore 사용, Trade/Policy는 빈 문자열 하드코딩
3. **토큰 Sink 미활성** — 설계된 5개 Sink 중 1~2개만 실제 작동

---

## 2. 요구사항

### 기능 요구사항
- [FR-1] Governance 시스템이 서버 API와 정상 통신하여 결의안 조회/제안/투표 가능
- [FR-2] Trade/Policy 페이지에서 인증된 쓰기 작업(주문/정책변경) 가능
- [FR-3] 토큰 잔액, 스테이킹 통계가 실제 서버 데이터 반영
- [FR-4] 팩션 가입/탈퇴/관리 기능 정상 작동
- [FR-5] War 시스템 프론트엔드 UI (토큰 Sink ② 활성화)
- [FR-6] Auction 시스템 프론트엔드 UI (토큰 Sink ⑤ 활성화)

### 비기능 요구사항
- [NFR-1] 모든 페이지에서 동일한 인증 패턴 사용 (useWalletStore + api-client)
- [NFR-2] API 호출은 반드시 중앙 api-client.ts를 통해 수행
- [NFR-3] 하드코딩된 가짜 데이터 제거 — 모든 데이터는 서버 API에서 가져옴
- [NFR-4] 기존 다크 택티컬 디자인 시스템 일관성 유지

---

## 3. 현재 상태 상세 분석

### 3.1 API 경로 불일치 (Governance)

```
프론트엔드 api-client.ts          서버 council.go
─────────────────────────         ──────────────────
GET /api/council/proposals    →   GET /api/council/resolutions ❌ 404
POST /api/council/proposals   →   POST /api/council/propose   ❌ 404
POST /api/council/proposals/{id}/vote → POST /api/council/vote ❌ 404
GET /api/council/votes        →   (embedded in resolutions)   ❌ 404
```

### 3.2 데이터 스키마 불일치 (Governance)

```
프론트엔드 CouncilProposal        서버 Resolution
───────────────────────           ─────────────────
iso3: string                      (없음 — TargetFaction만 있음)
proposer: string                  proposed_by: string
title: string                     name: string
description: string               description: string
proposalType: string              type: ResolutionType
forVotes: number                  votes: map[string]bool (계산 필요)
againstVotes: number              votes: map[string]bool (계산 필요)
startTime: string                 created_at: time.Time
endTime: string                   voting_ends_at: time.Time
executed: boolean                 (없음 — status로 판별)
totalVoters: number               (votes map 길이로 계산)
status: string                    status: ResolutionStatus
```

### 3.3 인증 패턴 비교

```
✅ 올바른 패턴 (governance/page.tsx):
  import { useWalletStore } from '@/stores/wallet-store';
  import { fetchCouncilProposals } from '@/lib/api-client';
  const walletStore = useWalletStore();
  const playerId = walletStore.isConnected ? walletStore.address : 'local-user';

❌ 깨진 패턴 (trade/page.tsx, policy/page.tsx):
  const [authToken] = useState('');       // 항상 빈 문자열
  const [currentUserId] = useState('');   // 항상 빈 문자열
  // raw fetch() 사용, api-client 미사용
```

### 3.4 서버 API 실제 엔드포인트 정리

| 용도 | 메서드 | 경로 | 인증 | 응답 |
|------|--------|------|------|------|
| 의석 조회 | GET | `/api/council/seats` | 없음 | `{seats, count}` |
| 결의안 조회 | GET | `/api/council/resolutions` | 없음 | `{voting[], history[]}` |
| 활성 효과 | GET | `/api/council/active` | 없음 | `{active_effects[], flags}` |
| 결의안 제안 | POST | `/api/council/propose` | RequireAuth + Council역할 | `{resolution}` |
| 투표 | POST | `/api/council/vote` | RequireAuth + Council역할 | `{status}` |
| 토큰소각 투표 | POST | `/api/v14/council/vote-with-burn` | RequireAuth | `{effectiveVotes, burnedAmount}` |
| 토큰 잔액 | GET | `/api/v14/token-balance/{playerId}` | 없음 | `{playerId, balance}` |
| 스테이킹 | POST | `/api/staking/stake` | RequireAuth | StakeInfo |
| 인출 | POST | `/api/staking/withdraw` | RequireAuth | `{returned, burned}` |
| 스테이킹 상태 | GET | `/api/staking/status/{playerId}` | 없음 | StakeInfo |

---

## 4. 기술 방향

### 4.1 인증 통일 전략

**방향**: 모든 페이지에서 `useWalletStore` + 중앙 `api-client.ts` 패턴 적용

```
Before (파편화):
  governance → useWalletStore ✅
  trade      → useState('') ❌
  policy     → useState('') ❌
  factions   → 읽기만 ✅
  new-proposal → 하드코딩 ❌

After (통일):
  모든 페이지 → useWalletStore + api-client.ts
  쓰기 작업 → walletStore.address를 Authorization으로 전달
```

### 4.2 API 정규화 전략

**방향 A (프론트 수정) ← 채택**: api-client.ts의 경로와 타입을 서버에 맞춤
- 이유: 서버의 Resolution 모델이 더 정확한 도메인 모델
- 변경: api-client.ts 함수 4개 수정 + 타입 변환 레이어 추가

**방향 B (서버 수정) ← 불채택**: 서버에 alias 엔드포인트 추가
- 이유: 서버 API는 정상이므로 변경 불필요

### 4.3 데이터 정규화 전략

**방향**: Resolution → CouncilProposal 변환 어댑터 패턴

```typescript
// api-client.ts에 추가
function mapResolutionToProposal(res: ServerResolution): CouncilProposal {
  const forVotes = Object.values(res.votes).filter(v => v).length;
  const againstVotes = Object.values(res.votes).filter(v => !v).length;
  return {
    id: res.id,
    proposer: res.proposed_by,
    title: res.name,
    description: res.description,
    proposalType: res.type,
    status: res.status,
    forVotes, againstVotes,
    startTime: res.created_at,
    endTime: res.voting_ends_at,
    totalVoters: forVotes + againstVotes,
    // ...
  };
}
```

### 4.4 미구현 시스템 UI 전략

**War 팝업**: 기존 팝업 아키텍처(SystemPopup + SectionNav) 패턴 재사용
- 섹션: active(진행중 전쟁) / declare(전쟁 선포) / history(전쟁 기록)
- 서버 API: `/api/wars/*` (이미 존재)

**Auction 페이지**: Economy 팝업에 4번째 섹션 추가 또는 독립 팝업
- 서버 API: `/api/auction/*` (이미 존재)

---

## 5. 리스크

| 리스크 | 영향 | 완화 전략 |
|--------|------|----------|
| 인증 체계가 mock 모드 (랜덤 주소) | 쓰기 작업이 서버에서 거부될 수 있음 | RequireAuth 미들웨어 동작 확인 후 조건부 처리 |
| vote-with-burn이 실제 UNCouncil.CastVote를 호출하지 않음 | 토큰만 소각되고 실제 투표 미반영 | vote-with-burn 핸들러에서 CastVote 호출 추가 |
| Trade/Policy 컴포넌트 내부에서 raw fetch 사용 | api-client 마이그레이션 범위가 큼 | 페이지 래퍼 수준에서만 수정, 컴포넌트 내부는 다음 Phase |
| 레거시 GameSystemPopup 제거 시 사이드이펙트 | URL 호환성 깨질 수 있음 | usePopup의 레거시 매핑으로 안전하게 전환 |

---

## 구현 로드맵

> 총 7 Phase, 35 Task. Phase 0은 인증 기반, Phase 1~3은 기존 기능 정상화, Phase 4~6은 신규 시스템 추가.
> *(v32-plan-verification-report.md 검증 후 Phase 0 추가, Phase 1~2 보정)*

---

### Phase 0: 인증 플로우 기반 구축 (V7 해결)

프론트엔드 walletStore.address를 서버 RequireAuth가 수락할 수 있도록 인증 메커니즘을 구축합니다.
현재 서버 RequireAuth는 JWT Bearer 토큰을 기대하지만, 프론트는 wallet address만 보유합니다.

| # | Task | 설명 | 파일 |
|---|------|------|------|
| 0-1 | RequireAuth wallet address 지원 | RequireAuth 미들웨어에 wallet address 인증 경로 추가 (mock 모드 호환) | `server/internal/auth/middleware.go` |
| 0-2 | api-client 인증 헤더 자동화 | apiFetch()에서 walletStore.address를 Authorization 헤더로 자동 전달하는 옵션 추가 | `apps/web/lib/api-client.ts` |
| 0-3 | useAuthenticatedApi 훅 | 인증된 API 호출 + walletStore 연동 공통 훅 작성 | `apps/web/hooks/useAuthenticatedApi.ts` |

- **design**: N (인프라)
- **verify**: POST /api/council/propose 호출 시 wallet address 인증으로 200 OK 반환 확인

---

### Phase 1: Governance API 정상화 (C4 + C5 + C6 + V1~V3 해결)

Governance 시스템이 서버와 정상 통신하도록 api-client 경로, request/response body, 타입 매핑을 수정합니다.

| # | Task | 설명 | 파일 |
|---|------|------|------|
| 1 | 서버 Resolution 타입 정의 + 기존 타입 통합 | 서버의 Resolution/ResolutionType/CouncilSeat 타입 정의. 기존 `api-client.ts`의 CouncilProposal과 `components/governance/types.ts`의 Proposal 이중 정의를 통합 | `apps/web/types/council.ts`, `apps/web/lib/api-client.ts`, `apps/web/components/governance/types.ts` |
| 2 | Resolution→Proposal 어댑터 | 서버 Resolution을 프론트 CouncilProposal로 변환 (votes map→forVotes/againstVotes 계산, snake_case→camelCase, time.Time→unix timestamp) | `apps/web/lib/api-client.ts` |
| 3 | council API 경로 + request body 매핑 | 경로: proposals→resolutions, propose, vote. **투표 body**: `{support,tokens}` → `{resolution_id,in_favor}`. **제안 body**: 7필드 → `{type,target_faction}`. **응답**: `{voting[],history[]}` → `{proposals:[]}` | `apps/web/lib/api-client.ts` |
| 4 | votes API 변환 로직 | GET /resolutions 응답에서 Resolution.Votes를 펼쳐 VoteRecord[] 형태로 변환 | `apps/web/lib/api-client.ts` |
| 5 | New Proposal 실제 잔액 연결 | userBalance={10000} 하드코딩을 useWalletStore + fetchPlayerTokenBalance로 교체. proposer에 walletStore.address 전달 | `apps/web/app/(hub)/governance/new/page.tsx` |
| 6 | handleWithdraw 처리 | 서버에 철회 API 없으므로 UI에서 투표 철회 버튼 비활성화 + 툴팁 안내 | `apps/web/app/(hub)/governance/page.tsx` |

- **design**: N (API 연결 로직 수정)
- **verify**: Governance 팝업에서 결의안 목록 조회 성공, 제안/투표 API 호출 정상 확인

---

### Phase 2: 인증 체계 통일 (C2 + C3 + C7 + V5 + V6 해결)

Trade, Policy, Factions 페이지에 useWalletStore 패턴 적용 + factionId 조회 + ServerRequired 래퍼 추가.

| # | Task | 설명 | 파일 |
|---|------|------|------|
| 7 | Trade 인증 + factionId 연결 | useState('') 제거 → useWalletStore. **factionId 조회**: address → GET /api/factions로 소속 팩션 검색. ServerRequired 래퍼 추가 | `apps/web/app/(hub)/economy/trade/page.tsx` |
| 8 | Trade api-client 함수 추가 | TradeMarket용 중앙 API 함수 (placeOrder, cancelOrder, fetchMyOrders) + fetchPlayerFaction 함수 | `apps/web/lib/api-client.ts` |
| 9 | Policy 인증 연결 | useState('') 제거 → useWalletStore. ServerRequired 래퍼 추가. 소속 국가 동적 감지 | `apps/web/app/(hub)/economy/policy/page.tsx` |
| 10 | Policy canEdit 동적화 | canEdit를 팩션 역할(Council+) 기반으로 동적 결정 — HasPermission(RoleCouncil) 체크 | `apps/web/app/(hub)/economy/policy/page.tsx` |
| 11 | Policy api-client 함수 추가 | PolicyPanel용 중앙 API 함수 (fetchPolicy, updatePolicy) | `apps/web/lib/api-client.ts` |
| 12 | Factions Join 버튼 연결 | "Join Faction" onClick 핸들러 추가 → POST /api/factions/{id}/join 호출 + useWalletStore 연결 | `apps/web/app/(hub)/factions/page.tsx` |
| 13 | Factions 관리 기능 추가 | DetailModal에 leave/kick/promote 버튼 (역할 기반 표시) | `apps/web/app/(hub)/factions/page.tsx` |

- **design**: N (기존 UI에 기능 연결)
- **verify**: Trade에서 주문 생성 API 호출 성공 (factionId 정상 조회), Policy 편집 가능 상태 확인, Faction 가입 성공

---

### Phase 3: 데이터 정확성 확보 (C1 + W1~W6 해결)

하드코딩 데이터를 실제 서버 데이터로 교체하고 WARNING 이슈를 해결합니다.

| # | Task | 설명 | 파일 |
|---|------|------|------|
| 14 | 스테이킹 통계 API 추가 (서버) | GET /api/staking/stats — 전체 스테이킹 통계 (totalStaked, activeStakers, avgAPY) 반환 | `server/cmd/server/router.go`, `server/internal/game/token_rewards.go` |
| 15 | Tokens 페이지 실데이터 연결 | stakingData 하드코딩 제거 → /api/staking/stats API 호출 | `apps/web/app/(hub)/economy/tokens/page.tsx` |
| 16 | Policy 기본 국가 동적화 | 'KOR' 하드코딩 → 플레이어 소속 국가 자동 감지 (API 조회 fallback) | `apps/web/app/(hub)/economy/policy/page.tsx` |
| 17 | vote-with-burn CastVote 연결 (서버) | v14 vote-with-burn 핸들러에서 실제 UNCouncil.CastVote 호출 추가 | `server/cmd/server/router.go` |
| 18 | Governance votes 전용 API 추가 (서버) | GET /api/council/votes — resolutions에서 vote 기록 추출하여 별도 반환 | `server/internal/meta/council.go` |

- **design**: N (데이터 파이프라인 수정)
- **verify**: Tokens 페이지 스테이킹 수치가 실제 값, Policy 기본 국가가 플레이어 소속, vote-with-burn이 실제 투표 반영

---

### Phase 4: War 시스템 UI (토큰 Sink ② 활성화)

전쟁 선포/관리 프론트엔드를 추가하여 500~2000 AWW 소각 Sink를 활성화합니다.

| # | Task | 설명 | 파일 |
|---|------|------|------|
| 19 | War API 클라이언트 함수 | fetchActiveWars, declareWar, surrender, ceasefire, fetchSieges | `apps/web/lib/api-client.ts` |
| 20 | War 팝업 컴포넌트 | SystemPopup + SectionNav 패턴 (active/declare/history 3섹션) | `apps/web/components/hub/WarPopup.tsx` |
| 21 | War Active 페이지 | 진행중 전쟁 목록, 시즈 상태, 항복/정전 버튼 | `apps/web/app/(hub)/war/page.tsx` |
| 22 | War Declare 페이지 | 전쟁 유형 선택 (소규모 500/경제 1000/대규모 2000 AWW), 비용 표시 + 선포 확인 | `apps/web/app/(hub)/war/declare/page.tsx` |
| 23 | War History 페이지 | 과거 전쟁 기록, 결과, 소각된 AWW 내역 | `apps/web/app/(hub)/war/history/page.tsx` |
| 24 | usePopup에 war 추가 | PopupName에 'war' 추가, 레거시 매핑 추가 | `apps/web/hooks/usePopup.ts` |
| 25 | HUD에 War 버튼 추가 | page.tsx HUD에 War 팝업 열기 버튼 + WarPopup 렌더링 | `apps/web/app/page.tsx` |

- **design**: Y (새 팝업 UI — 전쟁 선포 확인 모달, AWW 비용 표시 디자인 필요)
- **verify**: War 팝업 열림, 전쟁 선포 시 AWW 차감 확인, 서버 API 연동 정상

---

### Phase 5: Auction 시스템 UI (토큰 Sink ⑤ 활성화)

주권 경매 프론트엔드를 추가하여 80% AWW 소각 Sink를 활성화합니다.

| # | Task | 설명 | 파일 |
|---|------|------|------|
| 26 | Auction API 클라이언트 함수 | fetchAuctions, fetchAuctionDetail, placeBid | `apps/web/lib/api-client.ts` |
| 27 | Economy 팝업에 auction 섹션 추가 | EconomyPopup SECTIONS에 'auction' 추가 (4번째 섹션) | `apps/web/components/hub/EconomyPopup.tsx` |
| 28 | Auction 페이지 | 활성 경매 목록, 입찰 인터페이스, 80% 소각 안내, 최고 입찰자 표시 | `apps/web/app/(hub)/economy/auction/page.tsx` |

- **design**: Y (경매 카드 UI, 입찰 인터페이스, 소각 비율 시각화)
- **verify**: 경매 목록 조회, 입찰 시 AWW 차감, 80% 소각 내역 buyback/burns에 반영

---

### Phase 6: 코드 품질 개선 (I1~I3 + 레거시 정리)

아키텍처 부채를 해소합니다.

| # | Task | 설명 | 파일 |
|---|------|------|------|
| 29 | SectionLoading 공통화 | 5개 팝업의 중복 SectionLoading을 공통 컴포넌트로 추출 | `apps/web/components/hub/SectionLoading.tsx` + 5개 팝업 |
| 30 | Prop 네이밍 통일 | SettingsPopup의 activeTab/onTabChange → activeSection/onSectionChange | `apps/web/components/hub/SettingsPopup.tsx` |
| 31 | 배럴 파일 정리 | 5개(+1 War) 팝업을 index.ts에 export 추가 | `apps/web/components/hub/index.ts` |
| 32 | 레거시 GameSystemPopup 제거 | GameSystemPopup + PopupTabNav 코드 및 참조 완전 제거 | `apps/web/components/hub/GameSystemPopup.tsx`, `index.ts`, `page.tsx` |

- **design**: N (리팩토링)
- **verify**: 빌드 성공, 모든 팝업 정상 작동, 레거시 코드 제거 확인

---

## 예상 결과

### 이슈 해결 매핑

| Phase | 해결 이슈 | 소요 |
|-------|----------|------|
| Phase 0 | V7 (JWT 인증 플로우) | ~2시간 |
| Phase 1 | C4, C5, C6, W3, W4, V1, V2, V3 | ~5시간 |
| Phase 2 | C2, C3, C7, W5, V5, V6 | ~5시간 |
| Phase 3 | C1, W1, W2, W6 + 서버 2건 | ~4시간 |
| Phase 4 | 미구현 War (Sink ②) | ~6시간 |
| Phase 5 | 미구현 Auction (Sink ⑤) | ~4시간 |
| Phase 6 | I1, I2, I3, 레거시 | ~2시간 |
| **합계** | **C7 + W6 + I3 + V7 = 23개 전체** | **~28시간** |

### 토큰 Sink 실효성 변화

```
현재 (v31):
  ① 투표 소각 10%     → ❌ API 불일치로 미작동
  ② 전쟁 비용 소각     → ❌ 프론트 없음
  ③ GDP 부스트 50%    → ✅ 작동
  ④ 스테이킹 20%      → △ API 존재, 프론트 하드코딩
  ⑤ 주권 경매 80%     → ❌ 프론트 없음
  실효성: ~20%

Phase 1~3 완료 후:
  ① 투표 소각 10%     → ✅ API 정상화 + vote-with-burn 연결
  ③ GDP 부스트 50%    → ✅ 유지
  ④ 스테이킹 20%      → ✅ 실데이터 연결
  실효성: ~60%

Phase 4~5 완료 후:
  ② 전쟁 비용 소각     → ✅ War 팝업 구현
  ⑤ 주권 경매 80%     → ✅ Auction 페이지 구현
  실효성: ~100%
```

### 인증 체계 일관성 변화

```
현재: 20% (governance만 정상)
Phase 2 후: 100% (전 페이지 useWalletStore 통일)
```

---

*관련 문서:*
- *분석 보고서: `docs/v31-system-analysis-report.md`*
- *토큰 경제 분석: `docs/v30-token-economy-analysis.md`*
- *설계 검증: `docs/v30-design-validation-report.md`*
- *v11 기획: `docs/designs/v11-world-war-plan.md`*
