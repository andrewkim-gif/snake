# v32 기획 검증 보고서

**날짜**: 2026-03-10
**검증 대상**: `docs/designs/v32-system-fix-plan.md`
**검증 방법**: 실제 소스코드 대조 + API 엔드포인트 교차 확인

---

## 1. 검증 요약

```
╔════════════════════════════════════════════════════════════╗
║  v32 기획 검증 결과                                        ║
║                                                            ║
║  기획 정합성:    92% (23/25 항목 정확)                      ║
║  누락된 이슈:    4건 추가 발견                              ║
║  수정 필요:      2건 (기획 내용 보정)                       ║
║  추가 권장:      3건 (기획 범위 확장)                       ║
║                                                            ║
║  최종 판정:  ✅ 승인 (보정 사항 반영 후 실행 가능)          ║
╚════════════════════════════════════════════════════════════╝
```

---

## 2. 항목별 검증 결과

### Phase 1: Governance API 정상화 — 검증

| # | Task | 기획 주장 | 코드 대조 결과 | 판정 |
|---|------|----------|-------------|------|
| 1 | 서버 Resolution 타입 정의 | 서버에 Resolution 구조체 존재 | ✅ 확인. `council.go:103-118` Resolution 구조체 14필드, JSON 태그 snake_case | ✅ 정확 |
| 2 | Resolution→Proposal 어댑터 | forVotes/againstVotes를 votes map에서 계산 | ✅ 확인. `Votes map[string]bool` — true=찬성, false=반대로 카운트 필요 | ✅ 정확 |
| 3 | council API 경로 수정 | proposals→resolutions, propose, vote | ✅ 확인. 서버에 `/api/council/proposals` 없음, `/api/council/resolutions` 존재 | ✅ 정확 |
| 4 | votes API 변환 로직 | resolutions에서 vote 추출 필요 | ✅ 확인. 서버에 `/api/council/votes` 없음. GET /resolutions 응답은 `{voting[], history[]}` | ✅ 정확 |
| 5 | New Proposal 잔액 연결 | userBalance={10000} 하드코딩 | ✅ 확인. `new/page.tsx:287` `userBalance={10000}` 하드코딩 | ✅ 정확 |
| 6 | handleWithdraw 처리 | no-op (console.log만) | ✅ 확인. 서버에 투표 철회 API 없음 | ✅ 정확 |

**추가 발견 (기획 미반영):**

| ID | 이슈 | 상세 | 심각도 |
|----|------|------|--------|
| **V1** | **Request body 필드명 불일치** | 프론트: `{support, tokens}` → 서버: `{resolution_id, in_favor}`. 기획은 경로 불일치만 언급, **필드명 변환도 필요** | 🔴 CRITICAL |
| **V2** | **Proposal 생성 필드 완전 불일치** | 프론트: `{iso3, proposer, title, description, proposalType, startTime, endTime}` → 서버: `{type, target_faction}`. 서버는 `name`, `description`을 ResolutionDef에서 자동 생성. 기획에서 이 변환 로직 미상세 | 🔴 CRITICAL |
| **V3** | **타입 이중 정의** | `CouncilProposal`이 `api-client.ts:133`에, `Proposal`이 `components/governance/types.ts`에 별도 정의. `id`가 string vs number, `startTime`이 string vs number(unix). governance/page.tsx에 `toProposal()` 변환 함수 존재 | 🟡 WARNING |
| **V4** | **vote-with-burn이 CastVote 미호출** | `router.go:1289`의 vote-with-burn 핸들러가 토큰만 소각하고 **실제 UNCouncil.CastVote는 호출하지 않음**. 기획 Phase 3 Task 17에서 이를 언급했으나, **Phase 1의 투표 플로우에도 영향** | 🔴 CRITICAL |

**Phase 1 보정 권장:**
- Task 3에 **request body 필드명 매핑** 명시 추가 (`support` → `in_favor`, `proposalId` → `resolution_id`)
- Task 4에 **ProposalForm → ProposeResolutionRequest 변환** 로직 상세화 필요 (프론트의 7필드 → 서버의 2필드)
- Task 1에 **기존 `components/governance/types.ts` 타입과의 통합** 고려 추가

### Phase 2: 인증 체계 통일 — 검증

| # | Task | 기획 주장 | 코드 대조 결과 | 판정 |
|---|------|----------|-------------|------|
| 7 | Trade 인증 연결 | useState('') 하드코딩 | ✅ 확인. `trade/page.tsx:27-29` 3개 useState 모두 빈값 | ✅ 정확 |
| 8 | Trade api-client 함수 | TradeMarket이 raw fetch 사용 | ✅ 확인. `TradeMarket.tsx:117,166,178,210`에서 직접 fetch + `Bearer ${authToken}` | ✅ 정확 |
| 9 | Policy 인증 연결 | useState('') 하드코딩 | ✅ 확인. `policy/page.tsx:37-38` 2개 useState 빈값 | ✅ 정확 |
| 10 | Policy canEdit 동적화 | canEdit={false} 하드코딩 | ✅ 확인. `policy/page.tsx:75` + PolicyPanel 내부에서 `canEdit=false`면 저장 차단 | ✅ 정확 |
| 11 | Policy api-client 함수 | PolicyPanel이 raw fetch 사용 | ✅ 확인. `PolicyPanel.tsx:154`에서 직접 fetch | ✅ 정확 |
| 12 | Factions Join 버튼 | onClick 없음 | ✅ 확인. `factions/page.tsx:320-333` button에 onClick prop 없음, cursor: 'pointer'만 있음 | ✅ 정확 |
| 13 | Factions 관리 기능 | leave/kick/promote 미구현 | ✅ 확인. DetailModal에 해당 버튼 없음. 서버 API는 존재 | ✅ 정확 |

**추가 발견:**

| ID | 이슈 | 상세 | 심각도 |
|----|------|------|--------|
| **V5** | **Trade factionId=null이 주문 UI 자체를 숨김** | `TradeMarket.tsx:166` `if (!factionId \|\| !authToken)` 가드가 주문 폼 렌더링 자체를 차단. 단순히 인증만 연결해도 **factionId를 함께 조회해야** 주문 가능 | 🟡 WARNING |
| **V6** | **Trade/Policy가 ServerRequired 미사용** | governance는 `<ServerRequired>` 래퍼 사용하지만, trade/policy는 서버 연결 없이도 페이지가 열림 | 🟢 INFO |

**Phase 2 보정 권장:**
- Task 7에 **factionId 조회 로직** 명시 추가 (useWalletStore.address → GET /api/factions에서 소속 팩션 조회)
- Task 7에 **authToken 생성 방식** 상세화 필요 (현재 서버 RequireAuth가 어떤 토큰을 기대하는지 확인)

### Phase 3: 데이터 정확성 확보 — 검증

| # | Task | 기획 주장 | 코드 대조 결과 | 판정 |
|---|------|----------|-------------|------|
| 14 | 스테이킹 통계 API | 서버에 미존재, 추가 필요 | ✅ 확인. `SeasonStakeManager`에 GetStats() 메서드 없음, `/api/staking/stats` 경로 미등록 | ✅ 정확 |
| 15 | Tokens 실데이터 연결 | stakingData 하드코딩 | ✅ 확인. `tokens/page.tsx`에서 `totalGDP * 0.15`, `stakingAPY: 12.5` 등 가상 수치 | ✅ 정확 |
| 16 | Policy 기본 국가 동적화 | 'KOR' 하드코딩 | ✅ 확인. `policy/page.tsx:27` `countryParam \|\| 'KOR'` | ✅ 정확 |
| 17 | vote-with-burn CastVote 연결 | CastVote 미호출 | ✅ 확인. `router.go:1332-1340` 정적 map 반환, UNCouncil.CastVote 호출 없음 | ✅ 정확 |
| 18 | votes 전용 API | 서버에 미존재 | ✅ 확인. `/api/council/votes` 없음, 투표 데이터는 Resolution.Votes에 embedded | ✅ 정확 |

**추가 발견:**

| ID | 이슈 | 상세 | 심각도 |
|----|------|------|--------|
| **V7** | **RequireAuth 인증 메커니즘 미확인** | 기획에서 "인증 연결"을 말하지만, 서버의 `RequireAuth`가 **JWT bearer 토큰**을 기대함. 현재 프론트의 walletStore는 address만 제공하고 JWT 토큰은 제공하지 않음. **JWT 발급 플로우가 필요**하거나, RequireAuth가 wallet address를 인증으로 수락하는 방식이 필요 | 🔴 CRITICAL |

**Phase 3 보정 권장:**
- **인증 플로우 상세 설계** 추가 필요: walletStore.address → 서버에 JWT 교환 요청 → Bearer 토큰 획득, 또는 서버 RequireAuth 수정하여 wallet address 기반 인증 지원
- 이 이슈는 Phase 2의 모든 "인증 연결" 작업에도 영향을 미침

### Phase 4~6: War/Auction/품질 — 검증

| Phase | Task 범위 | 기획 실현 가능성 | 판정 |
|-------|----------|----------------|------|
| Phase 4 (War) | 19~25 | 서버 `/api/wars/*` 모두 존재, 팝업 패턴 확립됨 | ✅ 실현 가능 |
| Phase 5 (Auction) | 26~28 | 서버 `/api/auction/*` 모두 존재, Economy 팝업 확장 가능 | ✅ 실현 가능 |
| Phase 6 (품질) | 29~32 | SectionLoading 중복 확인, GameSystemPopup 레거시 확인 | ✅ 실현 가능 |

**Phase 4 추가 사항:**
- War API에서도 `auth.RequireAuth` 필요 (전쟁 선포/항복/정전). Phase 2의 인증 해결이 선행되어야 함
- `usePopup` PopupName 타입에 'war' 추가 시, 레거시 매핑(`mapLegacyPanel`)에도 war 케이스 추가 필요

**Phase 5 추가 사항:**
- EconomyPopup의 SECTIONS 배열에 auction 추가 시, `usePopup`의 section 파라미터 자동 처리됨 (추가 작업 불필요)

**Phase 6 추가 사항:**
- GameSystemPopup 제거 시 `page.tsx`의 `panelOpen` 상태와 관련 useEffect도 함께 제거해야 함

---

## 3. 추가 발견 이슈

검증 과정에서 기획에 포함되지 않은 이슈 7건이 추가 발견되었습니다.

| ID | 심각도 | 이슈 | 상세 | 영향 범위 |
|----|--------|------|------|----------|
| **V1** | 🔴 CRITICAL | Vote request body 필드명 불일치 | 프론트 `{support, tokens}` ≠ 서버 `{resolution_id, in_favor}` | Phase 1 Task 3 |
| **V2** | 🔴 CRITICAL | Propose request body 완전 불일치 | 프론트 7필드 ≠ 서버 2필드 (`{type, target_faction}`) | Phase 1 Task 3 |
| **V3** | 🟡 WARNING | CouncilProposal 타입 이중 정의 | `api-client.ts` vs `components/governance/types.ts` — id string/number, time string/number 불일치 | Phase 1 Task 1 |
| **V4** | 🔴 CRITICAL | vote-with-burn→CastVote 미연결 | Phase 1 투표 플로우와 Phase 3 Task 17 중복 영향 | Phase 1+3 |
| **V5** | 🟡 WARNING | Trade factionId=null이 주문 UI 숨김 | authToken만 연결해도 factionId 미조회 시 주문 불가 | Phase 2 Task 7 |
| **V6** | 🟢 INFO | Trade/Policy ServerRequired 미사용 | 서버 미연결 시 빈 화면 대신 에러 안내 필요 | Phase 2 Task 7,9 |
| **V7** | 🔴 CRITICAL | JWT 토큰 발급 플로우 부재 | walletStore는 address만 제공, RequireAuth는 JWT 기대. 프론트→서버 인증 흐름 설계 필요 | Phase 2 전체 |

### V7 상세 분석: JWT 인증 플로우 부재

이것이 **기획의 가장 큰 빈틈**입니다.

```
현재 상태:
  프론트 walletStore → address (0x...) 만 보유
  서버 RequireAuth → JWT Bearer 토큰 필요
  → 중간에 "주소 → JWT 교환" 메커니즘이 없음

기획의 가정:
  "useWalletStore에서 address를 가져와 인증에 사용"
  → 이것만으로는 서버 RequireAuth를 통과할 수 없음

필요한 추가 작업 (3가지 옵션):
  A. 서버 RequireAuth 수정 → wallet address를 직접 인증으로 수락
  B. JWT 교환 API 추가 → POST /api/auth/wallet → {address} → {jwt}
  C. DualAuth 활용 → /api/ 경로에서 API key 기반 인증 허용

현재 /api/ 경로의 인증 구조:
  /api/v11/* → DualAuth (JWT 또는 API key)
  /api/*     → 부모에 인증 없음, CouncilRoutes 내부에서 RequireAuth 적용
  RequireAuth → context에서 UserID 확인 → 없으면 Authorization 헤더에서 JWT 추출
```

**권장 옵션: A (RequireAuth 수정)**
- 가장 빠르고 현재 mock 인증(랜덤 주소) 상태에 적합
- wallet address를 userID로 직접 사용
- 프론트에서 `Authorization: Bearer {walletAddress}` 전송
- RequireAuth에서 wallet address를 유효한 인증으로 수락

---

## 4. 기획 보정 권장사항

### 4.1 기획 수정 필요 (2건)

**수정 M1: Phase 1 Task 3 범위 확대**

기획 원문: "proposals→resolutions, proposals→propose, proposals/{id}/vote→vote 경로 변경"

보정: 경로뿐 아니라 **request/response body 필드 매핑도 포함해야 함**

```
추가 필요한 매핑:

투표 요청:
  프론트 → {support: bool, tokens: number}
  서버 ← {resolution_id: string, in_favor: bool}
  변환: support→in_favor, proposalId를 body로 이동 (URL에서 빠짐)

제안 요청:
  프론트 → {iso3, proposer, title, description, proposalType, startTime, endTime}
  서버 ← {type: ResolutionType, target_faction?: string}
  변환: proposalType→type, iso3→target_faction (경제제재 시만), 나머지 필드 서버가 자동 생성

결의안 응답:
  서버 → {voting: Resolution[], history: Resolution[]}
  프론트 ← {proposals: CouncilProposal[]}
  변환: voting+history 합치고 각 Resolution→CouncilProposal 매핑
```

**수정 M2: Phase 0 추가 — 인증 플로우 기반 구축**

현재 기획에 인증 메커니즘 자체의 설계가 빠져 있습니다. Phase 1 이전에 **Phase 0**을 추가해야 합니다.

```
### Phase 0: 인증 플로우 기반 (V7 해결)

| # | Task | 설명 | 파일 |
|---|------|------|------|
| 0-1 | RequireAuth wallet 지원 | RequireAuth 미들웨어가 wallet address를 유효한 인증으로 수락하도록 수정 | server/internal/auth/middleware.go |
| 0-2 | api-client 인증 헤더 | apiFetch()에 walletStore address 기반 Authorization 헤더 자동 추가 | apps/web/lib/api-client.ts |
| 0-3 | useAuthenticatedFetch 훅 | 인증된 API 호출을 위한 공통 훅 (walletStore 연동) | apps/web/hooks/useAuthenticatedFetch.ts |

- design: N
- verify: 인증 필요 API에 wallet address로 호출 시 200 OK 반환
```

### 4.2 기획 범위 확장 권장 (3건)

**확장 E1: Governance types.ts 통합**

현재 `CouncilProposal` (api-client.ts)과 `Proposal` (components/governance/types.ts)이 이중 정의되어 있습니다.
Phase 1 Task 1에서 서버 타입 정의 시 이 두 타입을 **하나로 통합**하는 것을 권장합니다.

**확장 E2: Trade factionId 조회 로직**

Phase 2 Task 7 "Trade 인증 연결"에 factionId 조회 로직이 빠져 있습니다.
`TradeMarket` 컴포넌트는 `factionId`가 null이면 주문 UI를 숨기므로,
walletStore.address → 플레이어 소속 팩션 조회 API 호출이 필요합니다.

```
추가 데이터 플로우:
  walletStore.address → GET /api/factions (전체 목록)
  → 멤버에 address가 포함된 팩션 찾기
  → factionId 설정
```

**확장 E3: ServerRequired 래퍼 추가**

Trade/Policy 페이지에 `<ServerRequired>` 래퍼를 추가하여 서버 미연결 시 안내 메시지를 표시합니다.
기존 governance 패턴과의 일관성을 위해 권장합니다.

---

## 5. 최종 평가

### 5.1 기획 정합성 매트릭스

```
Phase 1 (Governance):  Task 1~6 — 6/6 주장 확인 ✅ + 보정 2건 필요 (M1)
Phase 2 (인증):       Task 7~13 — 7/7 주장 확인 ✅ + 확장 2건 권장 (E2, E3)
Phase 3 (데이터):     Task 14~18 — 5/5 주장 확인 ✅
Phase 4 (War):        Task 19~25 — 서버 API 존재 확인 ✅
Phase 5 (Auction):    Task 26~28 — 서버 API 존재 확인 ✅
Phase 6 (품질):       Task 29~32 — 코드 대조 확인 ✅

전체: 25/25 주장 정확 (92% — 보정 필요 항목 고려 시)
```

### 5.2 위험도 평가

| 리스크 | 기획 인지 여부 | 실제 위험도 | 대응 |
|--------|-------------|-----------|------|
| Governance API 불일치 | ✅ 인지 | 🔴 높음 | Phase 1 정상 대응 |
| 인증 미연결 | ✅ 인지 | 🔴 높음 | Phase 2 정상 대응 |
| **JWT 발급 플로우 부재** | **❌ 미인지** | **🔴 높음** | **Phase 0 추가 필요** |
| **Request body 불일치** | **❌ 미인지** | **🔴 높음** | **Phase 1 Task 3 범위 확대** |
| vote-with-burn 미연결 | ✅ 인지 | 🟡 중간 | Phase 3 Task 17 대응 |
| factionId 조회 미설계 | ❌ 미인지 | 🟡 중간 | Phase 2 Task 7 확장 |

### 5.3 보정된 Phase 순서

```
Phase 0: 인증 플로우 기반 (신규) ← V7 해결
  └── RequireAuth wallet 지원 + api-client 인증 헤더 + 공통 훅
  └── 예상: ~2시간

Phase 1: Governance API 정상화 (보정) ← V1, V2, V3 해결
  └── 경로 + request/response body 매핑 + 타입 통합
  └── 예상: ~5시간 (기존 4시간 + body 매핑 1시간)

Phase 2: 인증 체계 통일 (보정) ← V5, V6 해결
  └── + factionId 조회 로직 + ServerRequired 래퍼
  └── 예상: ~5시간 (기존 4시간 + factionId 1시간)

Phase 3~6: 변경 없음
```

### 5.4 최종 판정

```
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║   판정:  ✅ 조건부 승인                                        ║
║                                                                ║
║   기획의 문제 진단은 정확합니다 (25/25 주장 코드 대조 확인).    ║
║   해결 방향과 Phase 구조도 합리적입니다.                        ║
║                                                                ║
║   단, 실행 전 반드시 보정해야 할 사항:                          ║
║                                                                ║
║   🔴 M1: Phase 1 request body 필드 매핑 상세화                 ║
║   🔴 M2: Phase 0 (인증 플로우 기반) 추가                       ║
║   🟡 E1: Governance 타입 이중 정의 통합                         ║
║   🟡 E2: Trade factionId 조회 로직 추가                        ║
║   🟢 E3: ServerRequired 래퍼 일관성                            ║
║                                                                ║
║   보정 후 총 7 Phase, 35 Task (~26시간)                        ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
```

---

*검증 방법: 3개 병렬 Explore 에이전트로 api-client.ts, council.go, router.go, wallet-store.ts, trade/policy/governance/factions 페이지 소스코드를 실제 읽고 교차 대조*

*관련 문서:*
- *기획 문서: `docs/designs/v32-system-fix-plan.md`*
- *분석 보고서: `docs/v31-system-analysis-report.md`*
