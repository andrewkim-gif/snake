# PLAN: v13 — Navigation & Feature Integration

> AI World War의 모든 orphaned 기능을 로비에 연결하는 UI/UX 통합 기획

## 1. 현재 상태 분석

### 활성 라우트 (3개)

| 라우트 | 페이지 | 네비게이션 링크 | 상태 |
|--------|--------|----------------|------|
| `/` | 로비 (Globe/Map + Agent Setup) | — (홈) | ✅ 활성 |
| `/dashboard` | Agent API 대시보드 (5탭) | ❌ 없음 | ⚠️ URL 직접 입력만 |
| `/economy/tokens` | 토큰 이코노미 대시보드 | ❌ 없음 | ⚠️ URL 직접 입력만 |

### 로비 레이아웃 현황

```
┌─────────────────────────────────────────────────────┐
│ LobbyHeader: [LOGO] [ALPHA]     [Online] [2D/3D]   │  ← 56px, zI:70
├─────────────────────────────────────────────────────┤
│ ┌──── Agent Setup ────┐                             │
│ │ Name Input          │                             │
│ │ Character Creator   │     WorldView (전체화면)     │
│ │ (7탭 커스터마이저)    │     Globe/Map 배경          │
│ │                     │                             │
│ │ "CLICK A COUNTRY"   │          CountryPanel →     │
│ └─────────────────────┘                             │
│                                                     │
│ ┌─ NewsFeed ──────────────────────────────────────┐ │  ← 36px, zI:60
│ │ 🔴 LIVE  [뉴스 티커 스크롤...]                    │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### Orphaned 컴포넌트 인벤토리 (24개 파일, ~150KB)

| 디렉토리 | 파일 수 | 주요 컴포넌트 | import 횟수 |
|----------|---------|-------------|------------|
| `components/blockchain/` | 4 | WalletConnect, Staking, TokenBalance, CountryTokenInfo | 0 |
| `components/governance/` | 5 | ProposalForm, VoteInterface, ProposalList, VoteHistory, types | 0 |
| `components/economy/` | 2 | TradeMarket, PolicyPanel | 0 |
| `components/faction/` | 4 | FactionList, FactionDetail, TechTree, FactionDashboard | 0 |
| `components/hall-of-fame/` | 3 | HallOfFame, SeasonTimeline, index | 0 |
| `components/market/` | 1 | MercenaryMarket | 0 |
| `components/profile/` | 1 | Achievements | 0 |
| `components/world/` | 1 | UNCouncil | 0 (부분 연결) |
| `app/economy/tokens/` | 2 | Dashboard (5개 차트 컴포넌트) | 0 (라우트만 존재) |
| `app/dashboard/` | 1 | Agent API Dashboard (5탭) | 0 (라우트만 존재) |

**총계**: 24개 파일, 0개 네비게이션 링크, 0회 외부 import

### 아키텍처 제약사항 (멀티 페이지 전환 전 해결 필요)

| 제약 | 현재 상태 | 영향 | 해결 (Phase 0) |
|------|----------|------|---------------|
| **WebSocket 스코프** | `useSocket()`이 `page.tsx` 로컬에서만 호출 | 라우트 전환 시 소켓 disconnect | SocketProvider Context로 전역화 |
| **게임 모드 상태** | `mode` useState가 `page.tsx` 로컬 | 허브 페이지에서 게임 시작 감지 불가 | Context에 gameMode 포함 + 자동 리디렉트 |
| **Country State** | `countryStates` Map이 `page.tsx` 로컬 | 허브 페이지에서 국가 데이터 접근 불가 | Context에 countryStates 포함 |
| **NewsFeed 데이터** | 외부 데이터 없으면 demo 데이터 fallback | 허브 페이지에서 실시간 뉴스 불가 | SocketProvider에서 뉴스 이벤트 구독 |

## 2. 문제 정의

### 핵심 문제

1. **발견 불가능한 기능들**: 토큰 이코노미 대시보드, Agent API 대시보드, 거버넌스 투표 등 v11 Phase 9-10에서 구현된 핵심 기능들이 앱 UI 어디서도 접근 불가
2. **네비게이션 시스템 부재**: `<Link>` 0개, `router.push()` 0개 — 상태 머신(`mode`)으로만 화면 전환
3. **150KB 이상의 dead code**: 24개 컴포넌트 파일이 import되지 않아 번들에는 포함되지 않지만 유지보수 부담
4. **국가 기능 단절**: CountryPanel에 국가 선택 → 아레나 진입만 존재. 해당 국가의 토큰/스테이킹/거버넌스 정보 접근 불가
5. **E2E 테스트 무효화**: 테스트가 링크를 찾지 못해 `.catch(() => false)`로 silent skip — 검증 없이 통과

### 목표

- 사용자가 **로비에서 모든 기능을 발견하고 접근**할 수 있어야 한다
- **전술 워룸 세계관**을 유지하면서 자연스러운 네비게이션 경험
- 국가 선택 → 해당 국가의 **토큰/거버넌스/팩션 정보를 인라인**으로 확인
- 모바일에서도 **원핸드 조작** 가능한 네비게이션
- **WebSocket 연결이 라우트 전환에도 유지**되어야 한다 (SocketProvider Context)
- **게임 시작 시 어떤 페이지에 있든 자동으로 로비(`/`)로 리디렉트**
- `countryStates`가 **전역 Context로 공유**되어 허브 페이지에서도 국가 데이터 접근 가능

## 3. 디자인 원칙

| 원칙 | 설명 | 구현 방향 |
|------|------|----------|
| **지도 중심 유지** | Globe/Map이 항상 배경에 보이거나 쉽게 복귀 가능 | 허브 페이지에서도 축소된 미니 글로브/배경 blur |
| **전술 스테이션 메타포** | 웹 앱 네비게이션이 아닌 "CIC 스테이션 전환" 느낌 | 밀리터리 아이콘, 골드 액티브 인디케이터, 다크 테마 |
| **국가 컨텍스트 연속성** | 국가 선택 상태가 화면 전환 시 유지됨 | URL params (`?country=KOR`) + 전역 상태 |
| **점진적 공개** | 처음에는 핵심(WORLD + ECONOMY)만, 나머지는 탐험으로 발견 | 2-tier 네비게이션 (주 메뉴 + 서브 메뉴) |
| **모바일 우선** | 바텀 네비게이션 → 데스크탑 확장 | 하단 5-tab → 데스크탑 탑 네비게이션 |
| **기존 디자인 시스템** | SK 팔레트, McPanel/McButton 재사용 | 새 컴포넌트도 동일 디자인 토큰 사용 |

## 4. 정보 아키텍처 (IA)

### 사이트맵

```
AI World War
├── 🌍 WORLD (/) — 메인 로비
│   ├── Globe/Map 뷰
│   ├── Agent Setup 패널
│   ├── News Feed
│   └── CountryPanel (국가 클릭 시)
│       ├── OVERVIEW 탭 — 국가 기본 정보, 소버린티, 팩션
│       ├── TOKEN 탭 — CountryTokenInfo + StakingPanel
│       ├── VOTE 탭 — ProposalList + VoteInterface (해당 국가)
│       └── ACTION — [ENTER ARENA] [SPECTATE]
│
├── 💰 ECONOMY (/economy)
│   ├── /economy/tokens — 토큰 이코노미 대시보드 (기존)
│   ├── /economy/trade — 트레이드 마켓 (TradeMarket 연결)
│   └── /economy/policy — 경제 정책 (PolicyPanel 연결)
│
├── 🏛️ GOVERN (/governance)
│   ├── 제안 목록 (ProposalList)
│   ├── 새 제안 (ProposalForm)
│   ├── 투표 (VoteInterface)
│   └── 투표 이력 (VoteHistory)
│
├── ⚔️ FACTIONS (/factions)
│   ├── 팩션 목록 (FactionList)
│   ├── 팩션 상세 (FactionDetail)
│   ├── 기술 트리 (TechTree)
│   └── 용병 시장 (MercenaryMarket)
│
├── 🏆 HALL OF FAME (/hall-of-fame)
│   ├── 시즌 타임라인 (SeasonTimeline)
│   └── 명예의 전당 (HallOfFame)
│
├── 👤 PROFILE (/profile)
│   ├── Agent 통계
│   ├── 업적 (Achievements)
│   └── 지갑 연결 (WalletConnect + TokenBalanceList)
│
└── 🤖 DASHBOARD (/dashboard) — 기존 Agent API 대시보드
    ├── API Keys
    ├── Agents
    ├── Battle Log
    ├── Strategy
    └── Live View
```

### 네비게이션 계층

```
Level 0: Bottom Tab Bar (모바일) / Top Nav Bar (데스크탑)
         WORLD | ECONOMY | GOVERN | FACTIONS | MORE ▼

Level 1: 허브 내부 탭/서브내비게이션
         예: ECONOMY → [TOKENS] [TRADE] [POLICY]

Level 2: 인라인 상세 (CountryPanel 탭, 모달)
         예: CountryPanel → [OVERVIEW] [TOKEN] [VOTE]
```

## 5. 네비게이션 시스템 설계

### 5.1 데스크탑: Top Navigation Bar (LobbyHeader 확장)

기존 LobbyHeader(56px)를 확장하여 중앙에 네비게이션 메뉴를 배치한다.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [🎮 LOGO] [ALPHA]   WORLD  ECONOMY  GOVERN  FACTIONS  MORE▼   [🔗💰] [🟢] [🗺] │
│                       ━━━━                                              │
└─────────────────────────────────────────────────────────────────────────┘
  ↑ Logo + Badge        ↑ Nav Items (gold underline=active)    ↑ Wallet, Status, View
```

**네비게이션 아이템 스타일:**
- 폰트: Inter Bold 13px, uppercase, letter-spacing 2px
- 비활성: `SK.textSecondary` (#8B8D98)
- 호버: `SK.text` (#ECECEF) + 하단 2px 골드 글로우
- 활성: `SK.accent` (#F59E0B) + 하단 2px 골드 바 (solid)
- 간격: 각 아이템 간 24px gap
- 전환: color 150ms ease

**MORE 드롭다운 메뉴:**
```
┌──────────────────┐
│ 🏆 HALL OF FAME  │
│ 👤 PROFILE       │
│ 🤖 DASHBOARD     │
│ ──────────────── │
│ ⚙️ SETTINGS      │
└──────────────────┘
```
- McPanel 스타일 (dark card + subtle border)
- 외부 클릭 시 닫기
- 각 항목: 아이콘(유니코드) + 텍스트, hover highlight

### 5.2 모바일: Bottom Tab Bar

모바일 (max-width: 768px)에서는 하단 탭 바를 표시하고 상단 네비게이션 아이템을 숨긴다.

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│              (콘텐츠 영역)                            │
│                                                     │
├─────────────────────────────────────────────────────┤
│  🌍       💰        🏛️        ⚔️       ●●●        │
│ WORLD   ECONOMY   GOVERN   FACTIONS   MORE         │
│  ━━━                                                │
└─────────────────────────────────────────────────────┘
```

**Bottom Tab 스타일:**
- 높이: 56px (safe area 포함 시 +34px)
- 배경: `SK.cardBg` (#141418) + 상단 1px border
- 아이콘: 24px 유니코드/SVG
- 텍스트: 10px uppercase, Inter Bold
- 비활성: `SK.textMuted` (#55565E)
- 활성: `SK.accent` (#F59E0B) + 상단 2px 골드 바
- backdrop-filter: blur(12px) — 뒤 콘텐츠 반투명 비침
- `padding-bottom: env(safe-area-inset-bottom)` — 노치 대응

**MORE 바텀시트:**
- 모바일에서 MORE 탭 시 하단에서 슬라이드업
- 3개 항목: HALL OF FAME, PROFILE, DASHBOARD
- 드래그 핸들 + 바깥 클릭 닫기

### 5.3 Wallet Connect 버튼

LobbyHeader 우측에 지갑 연결 버튼을 배치한다.

```
미연결: [🔗 CONNECT]  — 테두리 버튼, SK.accent 컬러
연결됨: [💰 0x1234...] — 주소 축약 표시, 클릭 시 잔고 드롭다운
```

- `WalletConnectButton` 컴포넌트 (기존 orphaned → 재활용)
- CROSSx deep link (`crossx://`) 연결
- 연결 시 `TokenBalanceList` 드롭다운 표시
- 모바일: PROFILE 탭 내부에 통합

### 5.4 라우트 구조

| 라우트 | 레이아웃 | 컴포넌트 |
|--------|---------|---------|
| `/` | 로비 전용 (Globe 배경) | WorldView + AgentSetup + NewsFeed |
| `/economy` | 허브 레이아웃 | Redirect → `/economy/tokens` |
| `/economy/tokens` | 허브 레이아웃 | 기존 대시보드 (5개 차트) |
| `/economy/trade` | 허브 레이아웃 | TradeMarket + PolicyPanel |
| `/governance` | 허브 레이아웃 | ProposalList + VoteInterface |
| `/governance/new` | 허브 레이아웃 | ProposalForm |
| `/governance/history` | 허브 레이아웃 | VoteHistory |
| `/factions` | 허브 레이아웃 | FactionList + FactionDashboard |
| `/factions/[id]` | 허브 레이아웃 | FactionDetail + TechTree |
| `/factions/market` | 허브 레이아웃 | MercenaryMarket |
| `/hall-of-fame` | 허브 레이아웃 | HallOfFame + SeasonTimeline |
| `/profile` | 허브 레이아웃 | Achievements + WalletConnect + TokenBalance |
| `/dashboard` | 허브 레이아웃 | 기존 Agent API 대시보드 |

### 5.5 허브 레이아웃 (Hub Layout)

모든 허브 페이지가 공유하는 레이아웃:

```
┌─────────────────────────────────────────────────────┐
│ [Navigation Bar] (Top Nav / Bottom Tab)              │
├─────────────────────────────────────────────────────┤
│ ┌─ Hub Header ─────────────────────────────────────┐│
│ │ 💰 ECONOMY        [TOKENS] [TRADE] [POLICY]     ││  ← 서브 탭
│ └──────────────────────────────────────────────────┘│
│                                                     │
│ ┌─ Content Area ───────────────────────────────────┐│
│ │                                                   ││
│ │  (각 허브의 실제 콘텐츠)                            ││
│ │                                                   ││
│ └──────────────────────────────────────────────────┘│
│                                                     │
│ [NewsFeed Ticker] (선택적 — WORLD 탭에서만 전체 표시) │
└─────────────────────────────────────────────────────┘
```

**배경**: 로비 Globe 대신 어두운 그리드 텍스처 (`SK.bg` + 미세 그리드 패턴)
**서브 탭**: 골드 underline 스타일 (CharacterCreator 탭과 동일 패턴)
**콘텐츠**: McPanel 카드 기반 레이아웃, max-width 1200px, 중앙 정렬
**데이터**: `useSocketContext()`로 전역 소켓 상태 접근 (countryStates, gameMode 등)
**게임 시작 인터셉트**: SocketProvider가 `joined` 이벤트 감지 시 → `router.push('/')` 자동 실행

### 5.6 Provider 아키텍처

```
app/layout.tsx
└── <SocketProvider>           ← Phase 0에서 추가
    ├── app/page.tsx           ← WORLD (로비 + 게임)
    ├── app/(hub)/layout.tsx   ← Hub 공통 레이아웃
    │   ├── economy/*
    │   ├── governance/*
    │   ├── factions/*
    │   ├── hall-of-fame/*
    │   ├── profile/*
    │   └── dashboard/*
    └── (전역 상태: socket, countryStates, gameMode, userWallet)
```

**useSocketContext() 제공 값:**
- `socket`: Socket.IO 인스턴스
- `connected`: 연결 상태
- `countryStates`: Map<string, CountryClientState>
- `gameMode`: 'idle' | 'lobby' | 'transitioning' | 'playing'
- `currentRoomId`: string | null
- `joinRoom()`, `leaveRoom()`: 액션 함수

## 6. CountryPanel 확장 설계

현재 CountryPanel은 국가 선택 시 우측에서 슬라이드인하며 기본 정보 + ENTER ARENA/SPECTATE 버튼만 표시한다.
이를 **탭 기반 패널**로 확장하여 국가별 토큰/거버넌스/팩션 정보를 인라인으로 제공한다.

### 확장된 CountryPanel 레이아웃

```
┌─ CountryPanel (right slide-in, 400px width) ────────┐
│                                                      │
│ 🇰🇷 REPUBLIC OF KOREA               [×]            │
│ Tier: S • Faction: East Asia Coalition               │
│ Sovereignty: Level 4 (78%)                           │
│                                                      │
│ ┌────────┬────────┬────────┬────────┐               │
│ │OVERVIEW│ TOKEN  │  VOTE  │ FACTION│               │
│ └━━━━━━━━┴────────┴────────┴────────┘               │
│                                                      │
│ ┌──────────────────────────────────────────────────┐│
│ │                                                   ││
│ │  [현재 선택된 탭의 콘텐츠]                          ││
│ │                                                   ││
│ │                                                   ││
│ └──────────────────────────────────────────────────┘│
│                                                      │
│ ┌──────────────────┐ ┌──────────────────┐           │
│ │ ⚔️ ENTER ARENA   │ │ 👁️ SPECTATE      │           │
│ └──────────────────┘ └──────────────────┘           │
└──────────────────────────────────────────────────────┘
```

### 탭별 콘텐츠

**OVERVIEW 탭 (기존 + 강화)**
- 국가 기본 정보 (인구, GDP, 군사력 등)
- 소버린티 레벨 + 진행 바
- 현재 팩션 소속 + 동맹 상태
- 최근 전투 결과 (최근 3건)
- "VIEW FULL STATS →" 링크 → `/factions` 연결

**TOKEN 탭 (신규 — CountryTokenInfo + StakingPanel)**
- `CountryTokenInfo` 컴포넌트 재활용:
  - 시가총액, 24h 변동률
  - 방어 버프 현재 배율
  - 총 스테이킹 양, APR
- `StakingPanel` 컴포넌트 축소 버전:
  - 내 스테이킹 잔고
  - STAKE / UNSTAKE 버튼
  - 보상 클레임
- "VIEW TOKEN DASHBOARD →" 링크 → `/economy/tokens` 연결

**VOTE 탭 (신규 — 해당 국가의 거버넌스)**
- `ProposalList` 컴포넌트 (국가 필터링):
  - 현재 진행 중인 제안 목록 (최대 3개)
  - 각 제안: 제목, 찬반 비율 바, 남은 시간
- `VoteInterface` 인라인 버전:
  - 선택된 제안에 대해 바로 투표
  - 쿼드라틱 투표 가중치 미리보기
- "NEW PROPOSAL" 버튼 → `/governance/new?country=KOR`
- "ALL PROPOSALS →" 링크 → `/governance?country=KOR`

**FACTION 탭 (신규 — 해당 국가의 팩션 상태)**
- 소속 팩션 정보 (이름, 로고, 구성원 수)
- 외교 상태 (동맹/적대/중립 국가 목록 축약)
- 기술 트리 진행 상황 (핵심 3개만 표시)
- "VIEW FACTION →" 링크 → `/factions/[id]`

### 패널 사이즈 & 반응형

| Breakpoint | 너비 | 동작 |
|------------|------|------|
| Desktop (>1024px) | 400px, 우측 슬라이드 | 지도와 공존 |
| Tablet (768-1024px) | 360px, 우측 슬라이드 | 지도 약간 가려짐 |
| Mobile (<768px) | 100vw, 하단 시트 | 지도 위로 60vh 올라옴, 드래그 핸들 |

## 7. 허브 페이지 상세 설계

### 7.1 Economy Hub (`/economy/*`)

**서브 네비게이션**: [TOKENS] [TRADE] [POLICY]

#### `/economy/tokens` — 토큰 대시보드 (기존 페이지 개선)

기존 `app/economy/tokens/page.tsx` + `components.tsx`를 그대로 사용하되:
- Hub Layout 적용 (서브 탭 + 뒤로가기)
- 국가 선택 컨텍스트 연동 (`?country=KOR` → 해당 국가 하이라이트)
- 지갑 연결 시 보유 토큰 강조 표시

```
┌─ TOKENS 탭 ─────────────────────────────────────────┐
│ 4-stat 요약: Total MCap | Staked | Buyback | Burned │
│                                                      │
│ ┌──────────────┐ ┌──────────────┐                   │
│ │ Market Cap    │ │ Token Ranking│                   │
│ │ Bar Chart     │ │ S/A/B/C/D    │                   │
│ └──────────────┘ └──────────────┘                   │
│ ┌──────────────┐ ┌──────────────┐                   │
│ │ Defense Buff  │ │ Staking      │                   │
│ │ Visualization │ │ Overview     │                   │
│ └──────────────┘ └──────────────┘                   │
│ ┌────────────────────────────────────────────────── │
│ │ Buyback & Burn History (타임라인)                  │
│ └──────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────┘
```

#### `/economy/trade` — 트레이드 마켓 (TradeMarket 컴포넌트 연결)

`components/economy/TradeMarket.tsx`를 페이지에 연결:
- 오더북 UI (매수/매도)
- 국가 토큰 간 교환
- 가격 차트 (mock → 추후 실시간)

#### `/economy/policy` — 경제 정책 (PolicyPanel 컴포넌트 연결)

`components/economy/PolicyPanel.tsx`를 페이지에 연결:
- 세율 슬라이더
- 무역 정책 설정
- GDP 배분 비율

### 7.2 Governance Hub (`/governance/*`)

**서브 네비게이션**: [PROPOSALS] [NEW] [HISTORY]

#### `/governance` — 제안 목록

```
┌─ PROPOSALS 탭 ──────────────────────────────────────┐
│ 필터: [ALL] [VOTING] [PASSED] [REJECTED] [EXECUTED] │
│                                                      │
│ ┌── Proposal Card ──────────────────────────────── │
│ │ #042: 한국 세율 5% → 3% 인하안                     │
│ │ 🏛️ TAX POLICY • 투표중 • 남은 2일 14시간          │
│ │ ████████░░ 73% 찬성 (1,240 투표)                  │
│ │ [VIEW & VOTE →]                                   │
│ └──────────────────────────────────────────────────┘│
│ ┌── Proposal Card ──────────────────────────────── │
│ │ #041: 일본-한국 무역협정                           │
│ │ 🤝 TRADE POLICY • 통과 • 실행대기                  │
│ │ ████████████ 91% 찬성                             │
│ └──────────────────────────────────────────────────┘│
│ ...                                                  │
└──────────────────────────────────────────────────────┘
```

- `ProposalList` 컴포넌트에 국가 필터 + 상태 필터 추가
- 각 카드 클릭 → `VoteInterface` 모달 또는 인라인 확장
- 쿼드라틱 투표 가중치 미리보기 (√tokens 표시)

#### `/governance/new` — 새 제안 작성

- `ProposalForm` 컴포넌트 페이지 연결
- 5종 정책 카테고리 선택
- 지갑 연결 필수 (연결 안 됨 → CTA 표시)

#### `/governance/history` — 투표 이력

- `VoteHistory` 컴포넌트 페이지 연결
- 사용자 투표 이력 아카이브
- 결과별 필터링

### 7.3 Factions Hub (`/factions/*`)

**서브 네비게이션**: [OVERVIEW] [TECH TREE] [MERCENARY]

#### `/factions` — 팩션 총람

```
┌─ FACTIONS ────────────────────────────────────────── ┐
│ ┌──────────────────────────────────────────────────┐│
│ │ 세계 팩션 지도 (미니 글로브 또는 2D 맵)            ││
│ │ 팩션별 색상 오버레이                              ││
│ └──────────────────────────────────────────────────┘│
│                                                      │
│ ┌── East Asia Coalition ──┐ ┌── NATO Alliance ──── ┐│
│ │ 🏴 38 countries          │ │ 🏴 31 countries      ││
│ │ Military: ★★★★☆          │ │ Military: ★★★★★      ││
│ │ Economy: ★★★★★           │ │ Economy: ★★★★☆       ││
│ │ [VIEW DETAIL →]          │ │ [VIEW DETAIL →]      ││
│ └──────────────────────────┘ └──────────────────────┘│
│ ...                                                  │
└──────────────────────────────────────────────────────┘
```

- `FactionList` + `FactionDashboard` 컴포넌트 연결
- 팩션 카드 그리드 (McPanel 기반)
- 외교 상태 매트릭스

#### `/factions/[id]` — 팩션 상세

- `FactionDetail` + `TechTree` 컴포넌트 연결
- 구성원 목록, 외교 관계, 기술 트리 진행

#### `/factions/market` — 용병 시장

- `MercenaryMarket` 컴포넌트 연결
- 고용 가능한 용병 목록, 가격, 능력치

### 7.4 Hall of Fame (`/hall-of-fame`)

- `HallOfFame` + `SeasonTimeline` 컴포넌트 연결
- 시즌별 챔피언, 전설적 전투, 기록 보유자
- 가로 스크롤 타임라인 UI

### 7.5 Profile (`/profile`)

```
┌─ PROFILE ────────────────────────────────────────── ┐
│ ┌─ Agent Card ───────┐ ┌─ Wallet ─────────────────┐│
│ │ [3D 캐릭터 프리뷰]  │ │ 🔗 CROSSx Wallet        ││
│ │ "xXDarkLord420Xx"   │ │ 0x1234...5678            ││
│ │ Win Rate: 42%       │ │ $AWW: 1,240              ││
│ │ Avg Level: 7.3      │ │ $KOR: 50,000             ││
│ │ Total Battles: 156  │ │ [VIEW ALL TOKENS →]      ││
│ └─────────────────────┘ └──────────────────────────┘│
│                                                      │
│ ┌─ Achievements ───────────────────────────────────┐│
│ │ 🏅 First Blood  🏅 100 Kills  🔒 Season Champ   ││
│ │ 🏅 Explorer     🔒 Whale      🔒 Diplomat       ││
│ └──────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────┘
```

- `Achievements` 컴포넌트 연결
- `WalletConnectButton` + `TokenBalanceList` 연결
- 에이전트 전적 통계

## 8. 반응형 & 모바일 설계

### 브레이크포인트

| 이름 | 범위 | 네비게이션 | CountryPanel | 콘텐츠 |
|------|------|----------|-------------|--------|
| Mobile | <768px | Bottom Tab 56px | 하단 시트 (60vh) | 1-col, 패딩 16px |
| Tablet | 768-1024px | Top Nav (축약) | 우측 슬라이드 360px | 2-col grid |
| Desktop | >1024px | Top Nav (풀) | 우측 슬라이드 400px | 2-3 col grid, max 1200px |

### 모바일 특수 처리

1. **Bottom Tab vs NewsFeed 충돌**: 모바일에서 Bottom Tab이 NewsFeed 자리를 차지
   - NewsFeed는 WORLD 탭에서만 Bottom Tab 위에 축소 표시 (24px 한 줄 티커)
   - 다른 탭에서는 NewsFeed 숨김

2. **CountryPanel 하단 시트**: 모바일에서 CountryPanel은 하단에서 올라오는 시트
   - 드래그 핸들 (5px × 40px 회색 바)
   - 3단계: peek(20vh) → half(50vh) → full(85vh)
   - 스와이프 다운으로 닫기

3. **허브 페이지 스크롤**: 모바일에서 차트/카드는 세로 스크롤 1-column
   - 카드 간 12px gap
   - 서브 탭은 가로 스크롤 가능 (overflow-x: auto)

4. **Safe Area**: iPhone 노치/홈 인디케이터 대응
   - Bottom Tab: `padding-bottom: env(safe-area-inset-bottom)`
   - Top: `padding-top: env(safe-area-inset-top)`

## 9. 전환 & 애니메이션

### 페이지 전환

| 전환 | 방식 | 지속시간 |
|------|------|---------|
| WORLD → 허브 페이지 | Globe 페이드 → 콘텐츠 페이드인 | 200ms + 150ms |
| 허브 → 허브 | 크로스페이드 (콘텐츠만) | 200ms |
| 허브 → WORLD | 콘텐츠 페이드아웃 → Globe 페이드인 | 150ms + 200ms |
| 서브 탭 전환 | 콘텐츠만 opacity 전환 | 150ms |
| CountryPanel 열기 | 우측 슬라이드 (transform) | 300ms ease-out |
| CountryPanel 닫기 | 우측 슬라이드 아웃 | 200ms ease-in |
| 모바일 바텀시트 | 하단 슬라이드업 (transform) | 300ms cubic-bezier |
| MORE 드롭다운 | opacity + translateY(-8px) | 150ms |

### 로딩 상태

- 허브 페이지 첫 로드: McPanel 스켈레톤 (shimmer 애니메이션)
- 데이터 갱신 중: 우측 상단 스피너 (12px, SK.accent 컬러)
- 에러: 붉은 테두리 McPanel + 재시도 버튼

## 10. Orphaned 컴포넌트 매핑

모든 orphaned 컴포넌트가 어디에 연결되는지 매핑한다.

| 컴포넌트 파일 | 연결 위치 | 연결 방식 |
|-------------|----------|----------|
| `blockchain/WalletConnectButton` | LobbyHeader 우측 + Profile 페이지 | 직접 import |
| `blockchain/TokenBalanceList` | Wallet 드롭다운 + Profile 페이지 | 직접 import |
| `blockchain/StakingPanel` | CountryPanel TOKEN 탭 (축소) + Economy Hub (풀) | props로 국가 필터 |
| `blockchain/CountryTokenInfo` | CountryPanel TOKEN 탭 | props로 국가 코드 전달 |
| `governance/ProposalForm` | `/governance/new` 페이지 | 페이지 주요 콘텐츠 |
| `governance/ProposalList` | `/governance` 페이지 + CountryPanel VOTE 탭 | props로 국가 필터 |
| `governance/VoteInterface` | `/governance` 인라인 + CountryPanel VOTE 탭 | props로 제안 ID |
| `governance/VoteHistory` | `/governance/history` 페이지 | 페이지 주요 콘텐츠 |
| `governance/types` | governance 컴포넌트 전체 | 타입 import |
| `economy/TradeMarket` | `/economy/trade` 페이지 | 페이지 주요 콘텐츠 |
| `economy/PolicyPanel` | `/economy/policy` 페이지 | 페이지 주요 콘텐츠 |
| `faction/FactionList` | `/factions` 페이지 | 페이지 주요 콘텐츠 |
| `faction/FactionDetail` | `/factions/[id]` 페이지 | 동적 라우트 |
| `faction/TechTree` | `/factions/[id]` 페이지 내부 | FactionDetail과 함께 |
| `faction/FactionDashboard` | `/factions` 페이지 상단 요약 | 페이지 주요 콘텐츠 |
| `market/MercenaryMarket` | `/factions/market` 페이지 | 페이지 주요 콘텐츠 |
| `profile/Achievements` | `/profile` 페이지 | 페이지 주요 콘텐츠 |
| `hall-of-fame/HallOfFame` | `/hall-of-fame` 페이지 | 페이지 주요 콘텐츠 |
| `hall-of-fame/SeasonTimeline` | `/hall-of-fame` 페이지 내부 | HallOfFame과 함께 |
| `world/UNCouncil` | CountryPanel OVERVIEW 또는 별도 섹션 | 조건부 import |
| `app/economy/tokens/*` | `/economy/tokens` 라우트 (기존) | 네비게이션 링크 추가 |
| `app/dashboard/*` | `/dashboard` 라우트 (기존) | MORE 메뉴에서 접근 |

**매핑 결과**: 24개 orphaned 파일 → 13개 라우트에 연결, 0개 삭제 필요

## 구현 로드맵

### Phase 0: Global State Infrastructure (선행 필수)

> **왜 필요한가**: 현재 `useSocket()`이 `app/page.tsx` 로컬에서만 호출되어,
> 다른 라우트(`/economy/tokens` 등)에서 WebSocket 데이터(countryStates, 게임 상태)에
> 접근할 수 없다. 멀티 페이지 네비게이션 도입 전에 상태를 전역화해야 한다.

| Task | 설명 |
|------|------|
| SocketProvider Context 생성 | `providers/SocketProvider.tsx` — useSocket 호출 + Context로 전역 공유 |
| app/layout.tsx에 Provider 장착 | RootLayout에 `<SocketProvider>` 래핑 → 모든 페이지에서 소켓 접근 |
| page.tsx 리팩토링 | 로컬 useSocket() → useSocketContext() 훅으로 전환 |
| 게임 모드 전역화 | `gameMode` 상태를 Context에 포함 — 어떤 페이지에서든 게임 시작 시 `/`로 자동 리디렉트 |
| Country State 전역화 | `countryStates` Map을 Context에 포함 — 허브 페이지에서 국가 필터 가능 |
| 게임 시작 리디렉트 | SocketProvider 내부에서 `joined` 이벤트 감지 → `router.push('/')` 자동 실행 |
| Lazy Loading 등록 | `lib/lazy-components.ts`에 TradeMarket, ProposalList, FactionList 등 대형 컴포넌트 추가 |

- **design**: N (인프라 리팩토링)
- **verify**: 소켓 연결이 라우트 전환 후에도 유지, countryStates가 `/economy/tokens`에서 접근 가능, 게임 시작 시 자동 리디렉트 동작

### Phase 1: 네비게이션 인프라 + Hub Layout

| Task | 설명 |
|------|------|
| Nav 컴포넌트 생성 | `TopNavBar` (데스크탑) + `BottomTabBar` (모바일) 컴포넌트 |
| Hub Layout 생성 | `app/(hub)/layout.tsx` — 공유 레이아웃 (네비, 서브탭, 배경) |
| LobbyHeader 확장 | 기존 헤더에 네비게이션 아이템 + Wallet 버튼 추가 |
| MORE 드롭다운/바텀시트 | 추가 메뉴 (Hall of Fame, Profile, Dashboard) |
| 라우트 구조 설정 | Next.js App Router 그룹 라우팅 `(hub)` + 리디렉트 |

- **design**: Y (네비게이션 UI 신규 생성)
- **verify**: 모든 네비게이션 링크가 올바른 라우트로 이동, 데스크탑/모바일 전환 동작

### Phase 2: CountryPanel 탭 확장

| Task | 설명 |
|------|------|
| CountryPanel 탭 시스템 | OVERVIEW/TOKEN/VOTE/FACTION 4개 탭 추가 (CharacterCreator 7탭 패턴 참조: useState + 골드 underline) |
| TOKEN 탭 | CountryTokenInfo + StakingPanel(축소) 연결, 국가 코드 전달 |
| VOTE 탭 | ProposalList(국가필터) + VoteInterface(인라인) 연결 |
| FACTION 탭 | 팩션 소속 + 외교 상태 + TechTree(축약) 표시 |
| 모바일 바텀시트 | CountryPanel을 모바일에서 하단 시트로 전환 |

- **design**: Y (CountryPanel 리디자인)
- **verify**: 국가 클릭 → 4개 탭 모두 렌더링, 각 탭 데이터 정확성

### Phase 3: Economy Hub 연결

| Task | 설명 |
|------|------|
| Economy 라우트 그룹 | `app/(hub)/economy/layout.tsx` + 서브 탭 (TOKENS/TRADE/POLICY) |
| Tokens 페이지 이동 | 기존 `app/economy/tokens/` → `app/(hub)/economy/tokens/`로 이동 |
| Trade 페이지 생성 | `app/(hub)/economy/trade/page.tsx` → TradeMarket 컴포넌트 연결 |
| Policy 페이지 생성 | `app/(hub)/economy/policy/page.tsx` → PolicyPanel 컴포넌트 연결 |
| Wallet 드롭다운 | WalletConnect + TokenBalanceList를 헤더 드롭다운으로 연결 |
| Dynamic Import 적용 | TradeMarket, PolicyPanel을 `next/dynamic`으로 lazy load (코드 스플리팅) |

- **design**: N (기존 컴포넌트를 페이지에 배치)
- **verify**: `/economy/tokens`, `/economy/trade`, `/economy/policy` 모두 렌더링 + 서브 탭 전환, useSocketContext()로 countryStates 접근 확인

### Phase 4: Governance Hub 연결

| Task | 설명 |
|------|------|
| Governance 라우트 그룹 | `app/(hub)/governance/layout.tsx` + 서브 탭 |
| 제안 목록 페이지 | `app/(hub)/governance/page.tsx` → ProposalList + VoteInterface 연결 |
| 새 제안 페이지 | `app/(hub)/governance/new/page.tsx` → ProposalForm 연결 |
| 투표 이력 페이지 | `app/(hub)/governance/history/page.tsx` → VoteHistory 연결 |
| 국가 필터 연동 | URL param `?country=KOR` → 해당 국가 제안만 필터링 |

- **design**: N (기존 컴포넌트 페이지 연결)
- **verify**: 제안 목록 렌더링, 투표 UI 동작, 국가 필터 정상 작동

### Phase 5: Factions + Social Hub 연결

| Task | 설명 |
|------|------|
| Factions 라우트 그룹 | `app/(hub)/factions/layout.tsx` + 서브 탭 |
| 팩션 목록 페이지 | `app/(hub)/factions/page.tsx` → FactionList + FactionDashboard |
| 팩션 상세 페이지 | `app/(hub)/factions/[id]/page.tsx` → FactionDetail + TechTree |
| 용병 시장 페이지 | `app/(hub)/factions/market/page.tsx` → MercenaryMarket |
| Hall of Fame 페이지 | `app/(hub)/hall-of-fame/page.tsx` → HallOfFame + SeasonTimeline |
| Profile 페이지 | `app/(hub)/profile/page.tsx` → Achievements + Wallet + Stats |

- **design**: Y (팩션 목록 카드 + Profile 레이아웃)
- **verify**: 모든 페이지 렌더링, 팩션 동적 라우트 동작, 프로필 데이터 표시

### Phase 6: 폴리시 + 반응형 + 전환 효과

| Task | 설명 |
|------|------|
| 페이지 전환 애니메이션 | 크로스페이드 + Globe 페이드 처리 |
| 모바일 반응형 테스트 | 3 breakpoint 검증, 하단 탭 + 바텀시트 동작 |
| 스켈레톤 로딩 | 각 허브 페이지 McPanel 기반 shimmer 스켈레톤 |
| 에러 경계 | 각 허브에 Error Boundary + 재시도 UI |
| Deep Linking | 국가 선택 URL 파라미터 (`?country=KOR`) 전역 지원 |
| NewsFeed 조정 | 모바일에서 Bottom Tab과 충돌 방지 (WORLD 탭만 표시) |

| 게임 시작 리디렉트 검증 | 허브 페이지에서 게임 시작 시 자동으로 `/`로 이동하는지 확인 |
| 소켓 연결 유지 검증 | `/` → `/economy/tokens` → `/governance` 라우트 전환 시 소켓 disconnect 없는지 확인 |

- **design**: N (폴리시 + 기술적 마감)
- **verify**: Lighthouse 모바일 >80, 전환 깜빡임 없음, 딥링크 동작, E2E 테스트 링크 검출 성공, 소켓 유지 확인, 게임 시작 리디렉트 동작
