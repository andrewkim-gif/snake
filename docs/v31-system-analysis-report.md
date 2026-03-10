# AI World War — 시스템 전체 분석 보고서

**날짜**: 2026-03-10
**범위**: 프론트엔드 17페이지 + 서버 120+ API + 게임 시스템 20개 모듈
**목적**: 각 페이지의 설계 의도, 게임 시스템 연결, 논리적 이상점 검증 및 해결방안 제시

---

## 목차

1. [시스템 아키텍처 개요](#1-시스템-아키텍처-개요)
2. [팝업 시스템 아키텍처](#2-팝업-시스템-아키텍처)
3. [Economy (경제) 시스템](#3-economy-경제-시스템)
4. [Governance (거버넌스) 시스템](#4-governance-거버넌스-시스템)
5. [Factions (팩션) 시스템](#5-factions-팩션-시스템)
6. [Hall of Fame (명예의 전당)](#6-hall-of-fame-명예의-전당)
7. [Settings (설정)](#7-settings-설정)
8. [미구현 게임 시스템](#8-미구현-게임-시스템)
9. [CRITICAL 이슈 종합](#9-critical-이슈-종합)
10. [WARNING 이슈 종합](#10-warning-이슈-종합)
11. [권장 조치 우선순위](#11-권장-조치-우선순위)
12. [최종 평가](#12-최종-평가)

---

## 1. 시스템 아키텍처 개요

### 1.1 전체 구조

```
┌─────────────────────────────────────────────────────────┐
│  Frontend (Next.js 15 / Vercel)                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │  page.tsx (메인 HUD)                               │  │
│  │  ├── EconomyPopup   (tokens / trade / policy)     │  │
│  │  ├── FactionPopup   (overview / market)           │  │
│  │  ├── GovernancePopup (proposals / new / history)  │  │
│  │  ├── HallOfFamePopup (단일 페이지)                 │  │
│  │  └── SettingsPopup  (profile / dashboard / settings)│ │
│  │                                                    │  │
│  │  usePopup() — URL 상태 동기화                       │  │
│  │  ?popup=<name>&section=<section>                   │  │
│  └───────────────────────────────────────────────────┘  │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTP REST API
┌───────────────────────▼─────────────────────────────────┐
│  Backend (Go/Chi / Railway)                             │
│  ┌─ /api/ (프론트 호환) ──────────────────────────────┐  │
│  │  Economy: gdp, trade, policy, token, buyback      │  │
│  │  Governance: council (propose, vote, resolutions) │  │
│  │  Factions: CRUD, join/leave, treasury             │  │
│  │  War: declare, surrender, ceasefire, sieges       │  │
│  │  + 10개 추가 시스템 (diplomacy, tech, intel...)     │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌─ /api/v11/ (인증 필수) ────────────────────────────┐  │
│  │  동일 엔드포인트 + DualAuth (JWT + API Key)        │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌─ /api/v14/ (인게임) ──────────────────────────────┐  │
│  │  token-balance, council/vote-with-burn            │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌─ Blockchain (CROSS Mainnet) ──────────────────────┐  │
│  │  BuybackEngine, DefenseOracle, Ramp Webhook       │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 1.2 서버 게임 모듈 (20개)

| # | 모듈 | 설명 | 프론트 연결 |
|---|------|------|------------|
| 1 | EconomyEngine | 시간당 자원 생산, GDP 계산 | ✅ Economy 팝업 |
| 2 | TradeEngine | 글로벌 자원 거래소 | ✅ Economy > Trade |
| 3 | PolicyEngine | 경제 정책 슬라이더 | ✅ Economy > Policy |
| 4 | GDPEngine | GDP 분석/랭킹 | ✅ Economy > Tokens |
| 5 | WarManager | 전쟁 선포/항복/정전 | ❌ 미구현 |
| 6 | DiplomacyEngine | 조약/비침략 협정 | ❌ 미구현 |
| 7 | UNCouncil | 안보리 결의안/투표 | ✅ Governance 팝업 |
| 8 | FactionManager | 팩션 CRUD/가입/탈퇴 | ✅ Factions 팝업 |
| 9 | MercenaryMarket | 용병 고용/배치 | ✅ Factions > Market |
| 10 | SeasonEngine | 4Era 시즌 시스템 | ❌ 미구현 |
| 11 | HallOfFameEngine | 역대 기록 | ✅ Hall of Fame |
| 12 | AchievementEngine | 업적 시스템 | ❌ 미구현 |
| 13 | TechTreeManager | 기술 연구 | ❌ 미구현 |
| 14 | IntelSystem | 정보 작전 | ❌ 미구현 |
| 15 | EventEngine | 월드 이벤트 | ❌ 미구현 |
| 16 | AuctionManager | 주권 경매 | ❌ 미구현 |
| 17 | NewsManager | 라이브 뉴스 | ❌ 미구현 |
| 18 | TokenRewardManager | 토큰 보상 분배 | 내부 (API 없음) |
| 19 | SeasonStakeManager | 스테이킹 | ✅ Token API |
| 20 | DefenseOracle | 인플레 방지 | ✅ Token API |

**프론트 연결률: 9/20 (45%)** — 11개 시스템은 서버에 구현되어 있지만 프론트엔드 UI가 없습니다.

### 1.3 페이지 구성 (17개)

| 라우트 그룹 | 페이지 | 역할 |
|------------|--------|------|
| `(hub)/economy/` | tokens, trade, policy | 토큰 경제 대시보드 |
| `(hub)/governance/` | proposals, new, history | UN 안보리 거버넌스 |
| `(hub)/factions/` | overview, market, [id] | 팩션 관리 |
| `(hub)/hall-of-fame/` | (단일) | 명예의 전당 |
| `(hub)/profile/` | (단일) | 플레이어 프로필 |
| `dashboard/` | (단일) | 대시보드 |
| `arena/` | (단일) | 게임 아레나 |
| `debug/` | (단일) | 디버그 도구 |
| `minecraft/` | (단일) | MC 스타일 뷰 |

---

## 2. 팝업 시스템 아키텍처

### 2.1 설계 의도

메인 `page.tsx`에서 HUD 버튼을 누르면 **풀스크린 팝업**이 열리는 구조입니다.
각 팝업은 독립적인 Next.js 페이지 컴포넌트를 동적 임포트(dynamic import)하여 렌더링합니다.
URL은 `?popup=economy&section=tokens` 형태로 동기화되어 딥링크/뒤로가기가 가능합니다.

### 2.2 팝업 컴포넌트 구조

| 팝업 | 액센트 색상 | 슬라이드 | 섹션 수 | 내부 네비게이션 |
|------|-----------|---------|---------|--------------|
| EconomyPopup | 🟢 `#4A9E4A` | ↑ up | 3 (tokens/trade/policy) | SectionNav (pill) |
| FactionPopup | 🔴 `#CC3333` | ↑ up | 2 (overview/market) | SectionNav (pill) |
| GovernancePopup | 🔵 `#4A7EBF` | ↑ up | 3 (proposals/new/history) | SectionNav (pill) |
| HallOfFamePopup | 🟡 gold | ↓ down | 1 (단일) | 없음 |
| SettingsPopup | ⚪ secondary | → right | 3 (profile/dashboard/settings) | 사이드바 탭 |

### 2.3 공통 베이스: SystemPopup

모든 팝업이 `SystemPopup` 컴포넌트를 래핑합니다:
- 풀스크린 오버레이 (z-index: 90)
- 배경 블러 + 딤
- ESC / 배경 클릭으로 닫기
- body 스크롤 락
- 3방향 슬라이드 애니메이션
- 전술 그리드 배경 패턴
- 반응형 (모바일: 100vw×100vh)

### 2.4 이슈: 이중 팝업 시스템 🟡 WARNING

**현상**: 레거시 `GameSystemPopup` (7탭 통합)과 새로운 독립 팝업 5개가 공존합니다.

```
레거시: GameSystemPopup
  └── PopupTabNav (economy/factions/governance/hallOfFame/profile/dashboard/settings)

신규: 5개 독립 팝업
  ├── EconomyPopup → SystemPopup + SectionNav
  ├── FactionPopup → SystemPopup + SectionNav
  ├── GovernancePopup → SystemPopup + SectionNav
  ├── HallOfFamePopup → SystemPopup
  └── SettingsPopup → SystemPopup + 사이드바 탭
```

**영향**: 코드 중복, 유지보수 부담 증가, 레거시 코드가 여전히 번들에 포함됨
**상태**: Phase 4에서 레거시 제거 예정 (주석으로 표시됨)
**권장**: Phase 4 진입 시 GameSystemPopup 및 PopupTabNav 완전 제거

### 2.5 이슈: Prop 네이밍 불일치 🟡 WARNING

| 팝업 | 섹션 prop | 변경 콜백 prop |
|------|----------|--------------|
| Economy/Factions/Governance | `activeSection` | `onSectionChange` |
| Settings | `activeTab` | `onTabChange` |

`usePopup` 훅은 내부적으로 `setSection`만 사용하므로 동작에는 문제 없으나,
인터페이스 일관성이 깨져 있습니다.

**권장**: Settings도 `activeSection`/`onSectionChange`로 통일하거나, 타입으로 추상화

### 2.6 이슈: SectionLoading 중복 정의 🟢 INFO

5개 팝업 모두 동일한 `SectionLoading` / `TabLoading` 컴포넌트를 각자 내부에 정의합니다.
공통 컴포넌트로 추출하면 ~50줄 중복 제거 가능합니다.

### 2.7 이슈: index.ts 배럴 파일 누락 🟢 INFO

새로운 팝업 5개가 `components/hub/index.ts`에서 export되지 않습니다.
`page.tsx`에서 직접 파일 경로로 import하고 있어 동작에 문제는 없으나,
프로젝트 컨벤션과 불일치합니다.

---

## 3. Economy (경제) 시스템

### 3.1 설계 의도

Economy 팝업은 게임의 **토큰 경제 전체**를 3개 섹션으로 보여줍니다:

| 섹션 | 목적 | 서버 시스템 |
|------|------|-----------|
| **Tokens** | $AWW 토큰 대시보드 — 시가총액, 가격, GDP 랭킹, 소각/바이백 내역, 디펜스 버프, 스테이킹 | GDPEngine + BuybackEngine + DefenseOracle + TokenRewardManager |
| **Trade** | 글로벌 자원 거래소 — 5종 자원(oil/minerals/food/tech/influence) 매매 | TradeEngine |
| **Policy** | 경제 정책 — 세율/무역개방도/군비/기술투자 슬라이더 조정 | PolicyEngine |

### 3.2 Tokens 페이지 분석

**파일**: `apps/web/app/(hub)/economy/tokens/page.tsx`

**데이터 흐름**:
```
useEffect (30초 간격 자동 새로고침)
  ├── GET /api/gdp/ → GDP 데이터
  ├── GET /api/countries → 국가 목록
  ├── GET /api/buyback/history → 바이백 내역
  ├── GET /api/buyback/burns → 소각 내역
  ├── GET /api/token/price → 토큰 가격
  └── GET /api/defense/multipliers → 디펜스 배율
```

**렌더링 컴포넌트**:
- `MarketCapChart` — 시가총액 차트
- `TokenRanking` — 국가별 토큰 보유 랭킹
- `DefenseBuffVisualization` — 디펜스 버프 시각화
- `StakingOverview` — 스테이킹 현황
- `BuybackBurnHistory` — 소각/바이백 기록
- $AWW 가격 위젯 (Forge Pool vs GDP Simulation 소스 표시)

**🔴 CRITICAL 이슈 C1: 스테이킹 데이터 하드코딩**

```typescript
// tokens/page.tsx 내부
const stakingData = {
  totalStaked: totalGDP * 0.15,     // GDP의 15% — 가상 수치
  stakingAPY: 12.5,                  // 하드코딩
  activeStakers: countries.length * 2, // 국가수 × 2 — 가상 수치
};
```

서버에 `/api/staking/status/{playerId}` API가 존재하지만, 프론트엔드에서는 **API를 호출하지 않고 GDP 데이터에서 임의 비율로 계산**합니다.

**해결방안**: 서버의 `SeasonStakeManager`에서 전체 스테이킹 통계를 반환하는 엔드포인트 추가 (`GET /api/staking/stats`) 후 프론트에서 실제 데이터 사용

### 3.3 Trade 페이지 분석

**파일**: `apps/web/app/(hub)/economy/trade/page.tsx`

**구조**: `TradeMarket` 컴포넌트를 dynamic import

**🔴 CRITICAL 이슈 C2: 인증 미연결**

```typescript
const [authToken] = useState('');      // 항상 빈 문자열
const [currentUserId] = useState('');   // 항상 빈 문자열
```

거래소에서 매수/매도 주문을 넣으려면 인증이 필요하지만, `authToken`과 `currentUserId`가 하드코딩된 빈 문자열입니다. 이 상태로는 **모든 쓰기 작업(주문 생성/취소)이 서버에서 401 Unauthorized로 실패**합니다.

**해결방안**: `useWalletStore` 또는 인증 컨텍스트에서 실제 토큰/사용자 ID를 주입

### 3.4 Policy 페이지 분석

**파일**: `apps/web/app/(hub)/economy/policy/page.tsx`

**구조**: `PolicyPanel` 컴포넌트를 dynamic import

**🟡 WARNING 이슈 W1: 기본 국가 하드코딩**

```typescript
const country = searchParams.get('country') || 'KOR';
```

URL 파라미터가 없으면 항상 한국('KOR')이 기본값입니다.
플레이어의 소속 국가/팩션에 따라 동적으로 설정해야 합니다.

**🟡 WARNING 이슈 W2: canEdit 항상 false**

```typescript
<PolicyPanel countryISO={country} canEdit={false} ... />
```

정책 편집이 항상 비활성화되어 있어, 서버의 `PUT /api/economy/policy/{countryISO}` 엔드포인트를 활용할 수 없습니다.

**🔴 CRITICAL 이슈 C3: 인증 미연결 (Trade와 동일)**

```typescript
const [authToken] = useState('');
const [currentUserId] = useState('');
```

**해결방안 (W1+W2+C3 통합)**:
1. 플레이어 소속 국가를 월렛/세션에서 가져오기
2. 해당 국가의 Council 이상 권한일 때 `canEdit={true}`
3. 실제 인증 토큰 연결

---

## 4. Governance (거버넌스) 시스템

### 4.1 설계 의도

Governance 팝업은 **UN 안보리 시스템**을 구현합니다:

| 섹션 | 목적 | 서버 시스템 |
|------|------|-----------|
| **Proposals** | 결의안 목록 + 투표 인터페이스 | UNCouncil (resolutions) |
| **New** | 새 결의안 제안 폼 | UNCouncil (propose) |
| **History** | 투표 기록 조회 | UNCouncil (vote history) |

UN 안보리 구조:
- **상임이사국** (S-tier): 거부권(veto) 보유
- **비상임이사국** (A-tier): 일반 투표권
- **결의안 유형**: 핵금지, 자유무역, 평화유지, 경제제재, 기후협약

### 4.2 Proposals 페이지 분석

**파일**: `apps/web/app/(hub)/governance/page.tsx`

**긍정적 사항** ✅:
- `useWalletStore`에서 실제 플레이어 ID 사용 (다른 페이지와 달리 제대로 연결)
- FilterBar로 상태별 필터링 (all/voting/passed/rejected/executed)
- DetailModal에서 VoteInterface 렌더링
- 토큰 잔액을 월렛 스토어에서 가져옴

**🔴 CRITICAL 이슈 C4: API 경로 불일치**

프론트엔드와 서버의 API 경로가 완전히 다릅니다:

| 작업 | 프론트엔드 호출 | 서버 실제 경로 | 상태 |
|------|---------------|-------------|------|
| 목록 조회 | `GET /api/council/proposals` | `GET /api/council/resolutions` | ❌ 404 |
| 제안 생성 | `POST /api/council/proposals` | `POST /api/council/propose` | ❌ 404 |
| 투표 | `POST /api/council/proposals/{id}/vote` | `POST /api/council/vote` | ❌ 404 |
| 기록 조회 | `GET /api/council/votes` | (votes는 Resolution 내 embedded) | ❌ 404 |

**이것은 Governance 전체가 사실상 작동하지 않는다는 의미입니다.**

**🔴 CRITICAL 이슈 C5: 데이터 스키마 불일치**

프론트엔드가 기대하는 `CouncilProposal` 타입과 서버의 `Resolution` 타입이 완전히 다릅니다:

```
프론트엔드 (CouncilProposal):     서버 (Resolution):
  iso3                              id
  proposer                          proposed_by
  title                             name
  proposalType                      type (enum)
  forVotes / againstVotes           votes (map)
  startTime / endTime               created_at / voting_ends_at
  totalVoters                       (계산 필요)
  executed                          status
```

**해결방안**:
1. **Option A (프론트 수정)**: api-client의 경로와 타입 매퍼를 서버에 맞춤
2. **Option B (서버 수정)**: `/api/council/proposals` alias 추가 + Response 어댑터
3. **권장: Option A** — 서버 API가 더 정확한 도메인 모델을 사용하고 있음

### 4.3 New Proposal 페이지 분석

**파일**: `apps/web/app/(hub)/governance/new/page.tsx`

**🔴 CRITICAL 이슈 C6: 토큰 잔액 하드코딩**

```typescript
<ProposalForm
  userBalance={10000}  // ← 하드코딩! 실제 잔액이 아님
  proposer={''}        // ← 빈 문자열
  ...
/>
```

Governance Proposals 페이지는 `useWalletStore`를 정상 사용하는데,
같은 시스템의 New Proposal 페이지는 하드코딩을 사용합니다.
**동일 팝업 내 페이지 간 일관성이 깨져 있습니다.**

**해결방안**: `useWalletStore`에서 실제 잔액과 플레이어 ID를 주입

### 4.4 History 페이지 분석

**파일**: `apps/web/app/(hub)/governance/history/page.tsx`

**구조**: 투표 기록 조회 + 국가/투표유형 필터

**🟡 WARNING 이슈 W3: 전용 API 부재**

프론트엔드가 `GET /api/council/votes`를 호출하지만, 서버에는 이 엔드포인트가 없습니다.
투표 데이터는 각 Resolution 객체 안에 embedded되어 있습니다.

**해결방안**: 서버에 `GET /api/council/votes` 전용 엔드포인트 추가하거나,
프론트에서 resolutions를 가져온 후 votes를 추출/변환

### 4.5 이슈: handleWithdraw 미구현 🟡 WARNING W4

```typescript
const handleWithdraw = async (proposalId: string) => {
  console.log('Withdraw vote:', proposalId);
  // TODO: 실제 투표 철회 로직
};
```

투표 철회 버튼은 UI에 존재하지만, 클릭해도 콘솔 로그만 출력됩니다.
서버에도 투표 철회 API가 없으므로, **UI에서 버튼을 숨기거나 서버 API를 추가**해야 합니다.

---

## 5. Factions (팩션) 시스템

### 5.1 설계 의도

Factions 팝업은 **플레이어 길드/클랜 시스템**을 관리합니다:

| 섹션 | 목적 | 서버 시스템 |
|------|------|-----------|
| **Overview** | 팩션 목록 + 상세 정보 (멤버, 역할, 재무) | FactionManager |
| **Market** | 용병 고용/배치 마켓 | MercenaryMarket |

역할 계층: Supreme Leader > Council > Commander > Member

### 5.2 Overview 페이지 분석

**파일**: `apps/web/app/(hub)/factions/page.tsx`

**데이터 흐름**:
```
GET /api/factions → 팩션 리스트
GET /api/factions/{id} → 팩션 상세 (클릭 시)
```

**긍정적 사항** ✅:
- 팩션 카드 그리드 + DetailModal 패턴
- 멤버 역할별 분류 표시
- 서버 API와 데이터 구조가 대체로 일치

**🔴 CRITICAL 이슈 C7: "Join Faction" 버튼 미작동**

```typescript
<button className="...">
  Join Faction  // ← onClick 핸들러 없음!
</button>
```

팩션 가입 버튼이 UI에 존재하지만 **클릭 이벤트가 바인딩되지 않았습니다.**
서버에는 `POST /api/factions/{factionID}/join` API가 정상 존재합니다.

**해결방안**: onClick 핸들러에서 `/api/factions/{id}/join` 호출 + 인증 연결

### 5.3 Market 페이지 분석

**파일**: `apps/web/app/(hub)/factions/market/page.tsx`

**구조**: `MercenaryMarket` 컴포넌트 래퍼

서버 API:
- `GET /api/mercenaries/available` — 고용 가능한 용병
- `GET /api/mercenaries/tiers` — 용병 등급
- `POST /api/mercenaries/hire` — 용병 고용 (인증 필요)
- `POST /api/mercenaries/deploy` — 용병 배치
- `POST /api/mercenaries/dismiss` — 용병 해고
- `GET /api/mercenaries/my-mercs` — 내 용병 목록

**🟡 WARNING 이슈 W5: 인증 상태 미확인**

마켓 페이지에서 인증 상태를 전달하는 방식이 명확하지 않습니다.
용병 고용/배치 같은 쓰기 작업에는 인증이 필수입니다.

### 5.4 누락된 팩션 기능

서버에 구현되어 있지만 프론트에 없는 팩션 관련 기능:
- `POST /api/factions/{id}/leave` — 팩션 탈퇴
- `POST /api/factions/{id}/kick` — 멤버 추방
- `POST /api/factions/{id}/promote` — 멤버 승진
- `POST /api/factions/{id}/deposit` — 재무 기여
- `POST /api/factions/{id}/withdraw` — 재무 인출

이 기능들은 팩션 상세 DetailModal에서 역할별로 제공해야 합니다.

---

## 6. Hall of Fame (명예의 전당)

### 6.1 설계 의도

시즌별 역대 기록과 챔피언을 보여주는 단일 페이지입니다.
다른 팝업과 달리 서브 섹션 없이 하나의 뷰로 구성됩니다.

### 6.2 페이지 분석

**파일**: `apps/web/app/(hub)/hall-of-fame/page.tsx`

**구조**: `ServerRequired` + `HallOfFame` 컴포넌트 래핑

서버 API:
- `GET /api/hall-of-fame` — 역대 기록
- `GET /api/hall-of-fame/categories` — 카테고리
- `GET /api/hall-of-fame/seasons` — 시즌 목록

**상태**: 비교적 단순한 구조로, 큰 이슈 없음 ✅

**🟢 INFO**: 슬라이드 방향이 `down`으로 유일하게 다름 — 트로피/보상 느낌의 의도적 설계

---

## 7. Settings (설정)

### 7.1 설계 의도

플레이어 프로필, 대시보드, 게임 설정을 하나의 팝업에 통합합니다.
다른 팝업과 다르게 **사이드바 탭** 레이아웃을 사용합니다 (→ right 슬라이드).

| 탭 | 소스 | 역할 |
|---|------|------|
| Profile | `(hub)/profile/page` | 플레이어 프로필 |
| Dashboard | `dashboard/page` | 대시보드 |
| Settings | `./SettingsContent` | 게임 설정 |

### 7.2 이슈: 혼합 라우트 그룹 임포트 🟡 WARNING W6

```
EconomyPopup:    (hub)/economy/tokens   ← 모두 (hub) 그룹
FactionPopup:    (hub)/factions/...     ← 모두 (hub) 그룹
GovernancePopup: (hub)/governance/...   ← 모두 (hub) 그룹

SettingsPopup:
  ├── (hub)/profile/page      ← (hub) 그룹
  ├── dashboard/page           ← 루트 그룹 ⚠️
  └── ./SettingsContent        ← 로컬 컴포넌트 ⚠️
```

다른 팝업은 일관되게 `(hub)/` 라우트 그룹에서만 임포트하지만,
Settings는 3개 소스에서 혼합 임포트합니다.

**해결방안**: `dashboard/page`를 `(hub)/dashboard/page`로 이동하거나,
SettingsContent를 별도 페이지로 분리하여 일관성 확보

---

## 8. 미구현 게임 시스템

서버에 코드가 존재하지만 프론트엔드 UI가 없는 시스템 11개입니다.

### 8.1 높은 우선순위 (게임 핵심)

| 시스템 | 서버 API | 게임 내 역할 | 토큰 Sink 연결 |
|--------|---------|------------|---------------|
| **War** | `/api/wars/*` | 전쟁 선포/관리 — 국가 영토 쟁탈의 핵심 | ✅ 500~2000 AWW 소각 |
| **Diplomacy** | `/api/diplomacy/*` | 조약/비침략 협정 — 전쟁과 연계 | 간접 |
| **Season** | `/api/season/*` | 4Era 시즌 시스템 — 게임 진행 구조 | 간접 |
| **Auction** | `/api/auction/*` | 주권 경매 — 국가 지배권 | ✅ 80% AWW 소각 |

> **War와 Auction은 $AWW 토큰 Sink의 핵심 메커니즘**입니다.
> 프론트엔드 미구현은 토큰 경제 설계의 실효성에 직접 영향을 줍니다.

### 8.2 중간 우선순위 (전략적 깊이)

| 시스템 | 서버 API | 역할 |
|--------|---------|------|
| **Tech Tree** | `/api/tech/*` | 기술 연구 — 팩션 투자로 보너스 획득 |
| **Intel** | `/api/intel/*` | 정보 작전 — 적국 정보 수집 |
| **Events** | `/api/events/*` | 월드 이벤트 — 자원/기술 배율 변동 |
| **Achievement** | `/api/achievements/*` | 업적 시스템 — 플레이어 동기부여 |

### 8.3 낮은 우선순위 (부가 기능)

| 시스템 | 서버 API | 역할 |
|--------|---------|------|
| **News** | (라우터 미등록) | 라이브 뉴스피드 |
| **Season Reset** | 내부 전용 | 시즌 초기화 메커니즘 |
| **Agent Manager** | 내부 전용 | AI 에이전트 관리 |

### 8.4 미구현 시스템의 토큰 경제 영향

```
설계 의도 (5개 Sink):
  ① 투표 소각 10%     → Governance 팝업 ✅ (API 불일치로 실제 미작동)
  ② 전쟁 비용 소각     → War 시스템 ❌ 프론트 없음
  ③ GDP 부스트 50% 소각 → Token API ✅ 존재
  ④ 스테이킹 20% 패널티 → Token API ✅ 존재 (프론트 하드코딩)
  ⑤ 주권 경매 80% 소각  → Auction 시스템 ❌ 프론트 없음

현재 실제 작동하는 Sink: 1~2개 / 5개
→ 토큰 경제 설계의 강점 (5개 Sink)이 현재는 발휘되지 않는 상태
```

**권장**: War 팝업과 Auction 페이지를 Phase 4 최우선으로 구현

---

## 9. CRITICAL 이슈 종합

총 **7개 CRITICAL** 이슈가 발견되었습니다.

| ID | 시스템 | 이슈 | 영향도 | 해결 난이도 |
|----|--------|------|--------|-----------|
| **C1** | Economy/Tokens | 스테이킹 데이터 하드코딩 (GDP 기반 가상 수치) | 🔴 사용자 오해 | 중 (API 추가) |
| **C2** | Economy/Trade | authToken/userId 빈 문자열 → 모든 쓰기 실패 | 🔴 기능 불능 | 하 (월렛 연결) |
| **C3** | Economy/Policy | authToken/userId 빈 문자열 → 정책 변경 불가 | 🔴 기능 불능 | 하 (월렛 연결) |
| **C4** | Governance | API 경로 전체 불일치 (proposals vs resolutions) | 🔴 전체 미작동 | 중 (매퍼 작성) |
| **C5** | Governance | 데이터 스키마 불일치 (CouncilProposal vs Resolution) | 🔴 전체 미작동 | 중 (타입 변환) |
| **C6** | Governance/New | userBalance={10000} 하드코딩 | 🔴 잘못된 정보 | 하 (월렛 연결) |
| **C7** | Factions | "Join Faction" onClick 없음 | 🔴 기능 불능 | 하 (핸들러 추가) |

### 영향 분석

```
Governance 시스템: C4 + C5 → 투표/제안/기록 전체 미작동 (Sink ① 무력화)
Economy 쓰기: C2 + C3 → 거래/정책 변경 불가
데이터 정확성: C1 + C6 → 사용자에게 가짜 데이터 표시
팩션 가입: C7 → 핵심 소셜 기능 불능
```

---

## 10. WARNING 이슈 종합

총 **6개 WARNING** + **3개 INFO** 이슈가 발견되었습니다.

### WARNING (논리적 불일치)

| ID | 시스템 | 이슈 | 해결 권장 |
|----|--------|------|----------|
| **W1** | Economy/Policy | 기본 국가 'KOR' 하드코딩 | 플레이어 소속 국가 자동 설정 |
| **W2** | Economy/Policy | canEdit 항상 false | 권한 기반 동적 설정 |
| **W3** | Governance/History | 전용 votes API 부재 | 서버 엔드포인트 추가 또는 프론트 변환 |
| **W4** | Governance | handleWithdraw no-op | 서버 API 추가 또는 UI 버튼 제거 |
| **W5** | Factions/Market | 인증 상태 미확인 | 인증 컨텍스트 연결 |
| **W6** | Settings | 혼합 라우트 그룹 임포트 | (hub) 그룹 통일 |

### INFO (코드 품질)

| ID | 이슈 | 권장 |
|----|------|------|
| **I1** | SectionLoading 5중 중복 정의 | 공통 컴포넌트 추출 |
| **I2** | Prop 네이밍 불일치 (activeSection vs activeTab) | 인터페이스 통일 |
| **I3** | 팝업 컴포넌트 배럴 파일 미등록 | index.ts에 export 추가 |

---

## 11. 권장 조치 우선순위

### Phase 3A: 긴급 수정 (CRITICAL — 기존 기능 정상화)

```
Priority 1: Governance API 정상화 (C4 + C5)
  └── api-client.ts의 council 경로를 서버에 맞춤
  └── CouncilProposal ↔ Resolution 타입 매퍼 작성
  └── 예상 작업량: 2-3시간

Priority 2: 인증 연결 (C2 + C3 + C6 + C7)
  └── Trade/Policy 페이지에 useWalletStore 연결
  └── New Proposal에 실제 잔액/플레이어 ID 연결
  └── Factions Join 버튼에 onClick 핸들러 추가
  └── 예상 작업량: 1-2시간

Priority 3: 스테이킹 데이터 실제 연결 (C1)
  └── 서버에 GET /api/staking/stats 엔드포인트 추가
  └── Tokens 페이지에서 실제 데이터 사용
  └── 예상 작업량: 1-2시간
```

### Phase 3B: 기능 개선 (WARNING — 사용성 향상)

```
Priority 4: Policy 페이지 동적화 (W1 + W2)
  └── 플레이어 소속 국가 자동 감지
  └── Council 이상 권한 시 canEdit=true
  └── 예상 작업량: 1시간

Priority 5: Governance 완성 (W3 + W4)
  └── 투표 기록 API 또는 프론트 변환 로직
  └── handleWithdraw 구현 또는 UI 제거
  └── 예상 작업량: 1-2시간

Priority 6: 팩션 관리 기능 추가
  └── DetailModal에 leave/kick/promote/deposit/withdraw 버튼
  └── 역할 기반 권한 체크
  └── 예상 작업량: 2-3시간
```

### Phase 4: 미구현 시스템 구현 (토큰 경제 활성화)

```
Priority 7: War 팝업 (토큰 Sink ②)
  └── 전쟁 선포/관리/항복/정전 UI
  └── AWW 비용 표시 및 소각 흐름
  └── 예상 작업량: 4-6시간

Priority 8: Auction 페이지 (토큰 Sink ⑤)
  └── 주권 경매 목록/입찰 UI
  └── AWW 소각 표시
  └── 예상 작업량: 3-4시간

Priority 9: Diplomacy, Season, Tech Tree, Intel, Events
  └── 각 시스템 별도 팝업 또는 기존 팝업 섹션 추가
  └── 예상 작업량: 시스템당 3-5시간
```

### Phase 4+: 코드 품질 개선 (INFO)

```
Priority 10: 레거시 GameSystemPopup 완전 제거
Priority 11: SectionLoading 공통화, Prop 네이밍 통일
Priority 12: Settings 라우트 그룹 정리
```

---

## 12. 최종 평가

### 12.1 종합 스코어카드

```
╔═══════════════════════════════════════════════════════════════╗
║  AI World War — 시스템 전체 분석 결과                          ║
║                                                               ║
║  분석 범위: 프론트 17페이지 + 서버 120+ API + 20개 게임 모듈    ║
║                                                               ║
║  ┌─────────────────┬──────────────────────────────────────┐   ║
║  │ 설계 완성도      │ ██████████████████░░░░  72%          │   ║
║  │ 프론트-서버 연결  │ █████████░░░░░░░░░░░░  45%          │   ║
║  │ 인증 체계 일관성  │ ████░░░░░░░░░░░░░░░░░  20%          │   ║
║  │ 토큰 Sink 실효성  │ ██████░░░░░░░░░░░░░░░  30%          │   ║
║  │ UI/UX 일관성     │ ██████████████████░░░░  85%          │   ║
║  │ 코드 품질        │ ███████████████░░░░░░░  70%          │   ║
║  └─────────────────┴──────────────────────────────────────┘   ║
║                                                               ║
║  CRITICAL: 7개  |  WARNING: 6개  |  INFO: 3개                 ║
║                                                               ║
║  가장 심각한 영역: Governance (API 완전 불일치)                 ║
║  가장 양호한 영역: Hall of Fame, UI 컴포넌트 아키텍처          ║
╚═══════════════════════════════════════════════════════════════╝
```

### 12.2 긍정적 평가

1. **팝업 아키텍처**: SystemPopup → SectionNav → 페이지 컴포넌트 패턴이 일관되고 확장 가능
2. **URL 동기화**: usePopup 훅으로 딥링크/뒤로가기 지원 + 레거시 마이그레이션 제공
3. **서버 시스템**: 20개 게임 모듈이 체계적으로 분리되어 있으며 API 설계가 RESTful
4. **토큰 경제 설계**: 5개 Sink, GDP 바이백 등 업계 최상위 수준의 구조적 설계
5. **디자인 시스템**: 다크 택티컬 테마가 일관되게 적용됨

### 12.3 부정적 평가

1. **인증 체계 파편화**: Governance는 useWalletStore 사용, Trade/Policy는 빈 문자열 하드코딩
2. **API 계약 불일치**: Governance의 경로/스키마가 서버와 완전히 다름
3. **프론트-서버 갭**: 20개 서버 모듈 중 9개만 프론트에 연결 (45%)
4. **하드코딩된 가짜 데이터**: 스테이킹 통계, 토큰 잔액 등이 실제 값이 아님
5. **토큰 Sink 미활성**: 설계된 5개 Sink 중 실제 작동은 1~2개

### 12.4 핵심 결론

> **서버 사이드의 게임 시스템은 잘 설계되어 있으나,
> 프론트엔드와의 연결이 불완전하여 설계 의도가 실현되지 않는 상태입니다.**
>
> 특히 Governance 시스템은 API 경로/스키마 불일치로 **전체가 미작동**하며,
> 이는 토큰 경제의 핵심 Sink인 "투표 소각 10%"가 무력화됨을 의미합니다.
>
> **Phase 3A 긴급 수정(~5시간)으로 기존 구현된 기능의 정상화가 가능합니다.**
> **Phase 4에서 War/Auction UI를 추가하면 토큰 Sink 실효성이 80%까지 향상됩니다.**

---

*관련 문서:*
- *토큰 경제 분석: `docs/v30-token-economy-analysis.md`*
- *설계 검증 보고서: `docs/v30-design-validation-report.md`*
- *쉬운 한국어 요약: `docs/v30-design-validation-easy-kr.md`*
- *v11 기획 문서: `docs/designs/v11-world-war-plan.md`*
