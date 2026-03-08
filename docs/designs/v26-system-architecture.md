# v26 System Architecture — Isometric Nation Simulation

> **Version**: v26.0
> **Date**: 2026-03-09
> **Status**: APPROVED — System Architecture
> **Input**: `docs/designs/v26-isometric-nation-sim-plan.md`
> **Scope**: Plan의 2-Layer 아이소메트릭 시뮬레이션을 상세 아키텍처로 심화

---

## 1. Overview

v26은 기존 Arena Combat(R3F 3D 전투)를 **Tropico-style 아이소메트릭 국가 경영 시뮬레이션**으로 교체하는 대규모 아키텍처 전환이다. 플레이어는 지구본(Globe)에서 국가를 선택해 진입하면 PixiJS 기반 2D 아이소메트릭 도시를 건설·운영하며, 195개국이 동시에 AI 시뮬레이션으로 돌아간다.

**핵심 기술 과제**:
1. **2-Layer 렌더링 전환**: R3F Globe(Out-Game) ↔ PixiJS Isometric City(In-Game) — WebGL 컨텍스트 충돌 없이 원활한 전환
2. **195국 동시 시뮬레이션**: Go 서버에서 195개 CitySimEngine 인스턴스 × 평균 100 시민 에이전트(FSM) = ~19,500 에이전트 실시간 처리
3. **양방향 데이터 동기화**: Globe 세계 이벤트 → 도시 영향 (전쟁/제재/동맹), 도시 성과 → Globe 국력 반영 (GDP/군사/행복도)
4. **기존 Meta 엔진 확장**: EconomyEngine, DiplomacyEngine, WarManager, FactionManager를 도시 레벨 시뮬과 통합

**아키텍처 전략**: 기존 서버 모듈(`internal/meta/`, `internal/world/`, `internal/ws/`)은 인터페이스 확장으로 보존하고, 신규 `internal/city/`와 `internal/politics/` 패키지를 추가한다. 클라이언트는 `components/game/ar/`(29개 Arena 컴포넌트)을 보존한 채 `components/game/iso/`에 완전 별도 구현한다.

## 2. Goals / Non-Goals

### Goals

| # | Goal | Metric |
|---|------|--------|
| G1 | 195국 동시 아이소메트릭 시뮬레이션 | 서버 틱 ≤100ms (전체 195국) |
| G2 | PixiJS 기반 60fps 아이소메트릭 렌더링 | S-tier 500건물+500시민에서 60fps |
| G3 | Globe ↔ Isometric 원활한 전환 | 전환 시간 ≤1초, 컨텍스트 상실 0 |
| G4 | Tropico 수준의 경제·생산 체인 | 3-tier 33종 자원, 58종 건물 |
| G5 | AI 시민 에이전트 자율 행동 | 규칙 기반 FSM, 8개 행복도 요소 반영 |
| G6 | 파벌 정치·선거·칙령 시스템 | 4대립축 8파벌, 최후통첩, 선거 |
| G7 | 기존 Globe/Meta 시스템 호환 | 기존 API 변경 최소화, 신규 이벤트만 추가 |
| G8 | 1,000 동시접속 유저 지원 | 각 유저 1국 관리, 나머지 AI 자동 |

### Non-Goals

| # | Non-Goal | 이유 |
|---|----------|------|
| NG1 | Arena Combat 삭제 | 보존 — 추후 전쟁 미니게임으로 부활 가능 |
| NG2 | 3D 아이소메트릭 (R3F) | PixiJS 2D가 성능·에셋 생산 모두 우월 |
| NG3 | LLM 기반 시민 AI | 19,500 에이전트에 LLM 호출 비현실적 → FSM |
| NG4 | 실시간 멀티플레이어 도시 공동 경영 | v26은 1 유저 = 1 국가 단독 관리 |
| NG5 | 모바일 네이티브 앱 | 웹 브라우저 기반 유지 (반응형 지원은 함) |
| NG6 | 블록체인/토큰 통합 변경 | 기존 CROSS Mainnet 구조 유지 |

## 3. Architecture

### 3.1 System Context (C4 Level 1)

```
┌──────────────────────────────────────────────────────────────────────┐
│                         External Actors                              │
│                                                                      │
│  [Player/Browser]     [NationalAI Bot]     [Admin Dashboard]         │
│        │                     │                     │                  │
│        ▼                     ▼                     ▼                  │
│  ╔══════════════════════════════════════════════════════════════╗     │
│  ║          AI World War v26 — Game System                      ║     │
│  ║                                                              ║     │
│  ║  ┌────────────────────┐    ┌──────────────────────────────┐ ║     │
│  ║  │   Next.js 15 SPA   │    │    Go Game Server (port 9000) │ ║     │
│  ║  │   (port 9001)      │◄──►│    WebSocket + REST API       │ ║     │
│  ║  │                    │    │                               │ ║     │
│  ║  │  Globe (R3F)       │    │  WorldManager (195국)         │ ║     │
│  ║  │  Isometric (PixiJS)│    │  Meta Engines (경제/외교/전쟁) │ ║     │
│  ║  │  UI (React/Zustand)│    │  CitySimEngine (도시 시뮬)    │ ║     │
│  ║  └────────────────────┘    │  Politics (파벌/선거)         │ ║     │
│  ║                            └──────────────────────────────┘ ║     │
│  ╚══════════════════════════════════════════════════════════════╝     │
│                                                                      │
│  [Vercel CDN]              [Railway Hosting]    [CROSS Blockchain]   │
└──────────────────────────────────────────────────────────────────────┘
```

**Actors**:
- **Player**: 브라우저에서 Globe 탐색 → 국가 진입 → 아이소메트릭 도시 경영
- **NationalAI Bot**: 유저가 관리하지 않는 194국을 자동 운영하는 서버 내부 에이전트
- **Admin Dashboard**: 밸런스 모니터링, 시즌 관리 (기존 유지)

### 3.2 Container Diagram (C4 Level 2)

```
┌─────────────────────────── Client (Browser) ───────────────────────────┐
│                                                                         │
│  ┌──────────────────────┐   ┌──────────────────────────────────────┐   │
│  │   Globe Container     │   │   Isometric Container                │   │
│  │   (R3F / Three.js)    │   │   (PixiJS 8)                        │   │
│  │                       │   │                                      │   │
│  │  - three-globe        │   │  - @pixi/tilemap (타일맵)            │   │
│  │  - GlobeView          │   │  - IsoCamera (줌/팬)                 │   │
│  │  - GlobeEffects (12종)│   │  - BuildingRenderer                  │   │
│  │  - GlobeHoverPanel    │   │  - CitizenRenderer                   │   │
│  │  - CountryPanel       │   │  - ProductionOverlay                 │   │
│  │                       │   │  - SelectionManager                  │   │
│  │  [WebGL Context A]    │   │  [WebGL Context B]                   │   │
│  └───────────┬───────────┘   └──────────────────┬───────────────────┘   │
│              │  ◄── mount/unmount 전환 ──►       │                      │
│              └──────────┬────────────────────────┘                      │
│                         │                                               │
│  ┌──────────────────────┴──────────────────────────────────────────┐   │
│  │                    Shared Client Layer                            │   │
│  │  ┌───────────┐ ┌──────────────┐ ┌───────────┐ ┌──────────────┐ │   │
│  │  │ Zustand    │ │ useSocket    │ │ UI Shell   │ │ Shared Types │ │   │
│  │  │ Stores     │ │ (WS client)  │ │ (TopMenu,  │ │ (city.ts)    │ │   │
│  │  │ - globe    │ │ - globe_state│ │  Panels,   │ │              │ │   │
│  │  │ - city     │ │ - city_state │ │  Overlays) │ │              │ │   │
│  │  │ - politics │ │ - city_cmd   │ │            │ │              │ │   │
│  │  └───────────┘ └──────────────┘ └───────────┘ └──────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ WebSocket (ws://)
                                     │ + REST (https://)
┌────────────────────────────────────┴────────────────────────────────────┐
│                         Server (Go)                                     │
│                                                                         │
│  ┌─────────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │   WebSocket Hub      │  │  REST API Handler │  │  Broadcaster     │   │
│  │   (internal/ws/)     │  │  (internal/api/)  │  │  (room/city/     │   │
│  │   - hub.go           │  │  - country info   │  │   globe cast)    │   │
│  │   - client.go        │  │  - leaderboard    │  │                  │   │
│  │   - protocol.go      │  │  - season data    │  │                  │   │
│  └──────────┬───────────┘  └────────┬─────────┘  └────────┬─────────┘   │
│             └──────────────┬────────┘                      │            │
│                            ▼                               │            │
│  ┌──────────────────────────────────────────────────────────┘           │
│  │                                                                      │
│  │  ┌───────────────┐ ┌────────────────┐ ┌──────────────────────────┐  │
│  │  │ WorldManager   │ │ Meta Engines    │ │ CitySimEngine [195]      │  │
│  │  │ (195국 상태)    │ │ (기존 유지)      │ │ (신규 internal/city/)    │  │
│  │  │                │ │                 │ │                          │  │
│  │  │ - country_data │ │ - EconomyEngine │ │ - engine.go (오케스트)   │  │
│  │  │ - sovereignty  │ │ - DiplomacyEng  │ │ - building.go (58종)     │  │
│  │  │ - deployment   │ │ - WarManager    │ │ - citizen.go (FSM)       │  │
│  │  │ - siege        │ │ - FactionManager│ │ - tilemap.go (경로탐색)  │  │
│  │  │                │ │ - TradeEngine   │ │ - production.go (체인)   │  │
│  │  │                │ │ - TechTree      │ │ - trade.go (무역정산)    │  │
│  │  └───────┬────────┘ └────────┬───────┘ └────────────┬─────────────┘  │
│  │          │                   │                       │               │
│  │          └──── 양방향 동기화 ──┴───────────────────────┘               │
│  │                                                                      │
│  │  ┌────────────────────────────────────────────────────────────────┐  │
│  │  │ Politics System (신규 internal/politics/)                       │  │
│  │  │ - faction.go (4대립축 8파벌, 호감도)                              │  │
│  │  │ - election.go (시민 투표, 선거 연설)                               │  │
│  │  │ - edict.go (칙령 시행, 시대별 해금)                                │  │
│  │  └────────────────────────────────────────────────────────────────┘  │
│  │                                                                      │
│  └──────────────────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────────────────┘
```

**핵심 컨테이너 간 통신**:

| From | To | Protocol | 빈도 |
|------|----|----------|------|
| Client | Hub | WebSocket | 항시 연결 |
| Hub | CitySimEngine | Go 함수 호출 | city_command 수신 시 |
| CitySimEngine | Broadcaster | Go 채널 | 2Hz (city_state) |
| CitySimEngine | EconomyEngine | Go 인터페이스 | 매 경제 틱 (10초) |
| CitySimEngine | WorldManager | Go 인터페이스 | GDP/군사/행복도 변동 시 |
| WorldManager | Broadcaster | Go 채널 | 1Hz (globe_state) |
| WarManager | CitySimEngine | Go 콜백 | 전쟁 선포/종료 시 |
| DiplomacyEngine | CitySimEngine | Go 콜백 | 제재/동맹 변동 시 |
| Politics | CitySimEngine | Go 인터페이스 | 칙령/선거/최후통첩 시 |

### 3.3 Component Design — Server (C4 Level 3)

```
internal/city/ (CitySimEngine)
├── engine.go          ─── CitySimEngine 구조체, Tick() 오케스트레이터
│   ├── NewCitySimEngine(iso3, worldMgr, econEngine, politicsEngine)
│   ├── Tick()         ─── 10초 주기: Production → Consumption → Wages → Trade → Tax → GDP
│   ├── HandleCommand(cmd CityCommand) error
│   ├── GetCityState() CityClientState  ─── 2Hz 직렬화용
│   └── SetMode(mode ControlMode)       ─── AI / PlayerManaged 전환
│
├── building.go        ─── BuildingRegistry (58종 정의), Building 인스턴스
│   ├── BuildingDef    ─── 정적 정의 (cost, workers, produces, consumes, size, era)
│   ├── Building       ─── 인스턴스 (id, def, tilePos, level, workers, efficiency, powered)
│   ├── PlaceBuilding(def, x, y) (*Building, error)
│   ├── UpgradeBuilding(id) error
│   └── DemolishBuilding(id) error
│
├── citizen.go         ─── CitizenAgent FSM, 행동 루프
│   ├── CitizenAgent   ─── id, demographics, factions, happiness[8], employment, position, state
│   ├── FSM states     ─── Idle → Commuting → Working → Shopping → Resting → Protesting
│   ├── TickCitizen()  ─── 상태 전이 + 위치 업데이트
│   ├── ComputeHappiness() float64  ─── 8요소 가중 평균
│   └── ComputeVoteIntent() FactionId
│
├── tilemap.go         ─── TileMap 생성, 타일 타입, 건물 배치 검증, A* 경로탐색
│   ├── TileMap        ─── grid [][]TileType, width, height
│   ├── GenerateMap(tier, profile)  ─── CountryResourceProfile 기반 절차적 생성
│   ├── CanPlace(x, y, sizeW, sizeH) bool
│   ├── FindPath(from, to) []TileCoord  ─── 계층적 A* (구역 + 타일)
│   └── GetAdjacentBuildings(x, y, radius) []*Building
│
├── production.go      ─── 3-tier 생산 체인 실행
│   ├── ProductionChain ─── tier1(15종) → tier2(12종) → tier3(6종)
│   ├── RunProduction(buildings, stockpile) ─── 효율 기반 산출, 원자재 소비
│   └── ComputeEfficiency(b *Building) float64  ─── workers/maxWorkers × adjacency × powered
│
├── trade.go           ─── 무역 노선, 수출입 정산
│   ├── TradeRoute     ─── partner, resource, direction, contractAmt, priceBonus
│   ├── ExecuteTrades(routes, stockpile, econEngine) ─── 물량 이행 + 국고 정산
│   └── ComputePriceBonus(diplomacyScore) float64
│
└── resource.go        ─── 자원 타입 정의 (33종), 재고 관리
    ├── ResourceType   ─── Grain, Sugarcane, Tobacco, ..., Weapons, Ships (33종 enum)
    ├── Stockpile      ─── map[ResourceType]float64
    └── ResourcePrice  ─── 시장 가격 테이블 (시대별 변동)

internal/politics/ (Politics System)
├── faction.go         ─── 4대립축 8파벌, 호감도 시스템
│   ├── FactionDef     ─── id, name, axis, oppositeId
│   ├── FactionState   ─── approval (0~100), memberCount, ultimatum status
│   ├── AdjustApproval(factionId, delta, reason)
│   └── CheckUltimatum(factionId) *Ultimatum
│
├── election.go        ─── 시민 투표, 선거 실행
│   ├── Election       ─── era, candidates, votes, result
│   ├── RunElection(citizens, factionStates) ElectionResult
│   └── ComputeApprovalRating(citizens) float64
│
├── edict.go           ─── 칙령 목록, 시행/해제
│   ├── EdictDef       ─── id, name, era, cost, monthlyCost, factionEffects, econEffects
│   ├── EnactEdict(id, treasury) error
│   └── RevokeEdict(id) error
│
└── ultimatum.go       ─── 최후통첩 메커니즘
    ├── Ultimatum      ─── factionId, deadline, demand, penalty
    ├── IssueUltimatum(faction, demand)
    └── ResolveUltimatum(faction, met bool) ─── 제재 적용 또는 해제
```

**서버 컴포넌트 간 의존 관계**:
```
                    ┌──────────────────┐
                    │   Hub (ws/)       │
                    │  city_command ──► │
                    └────────┬─────────┘
                             │ dispatch
                             ▼
┌──────────────┐    ┌──────────────────┐    ┌────────────────┐
│ WorldManager  │◄──│  CitySimEngine   │──►│  Politics       │
│ (world/)      │   │  (city/)          │   │  (politics/)    │
│               │   │                   │   │                 │
│ - 국력 업데이트 │   │  - Tick() 10초    │   │ - 파벌 호감도    │
│ - Globe 반영   │   │  - 건물/시민/생산  │   │ - 선거/칙령      │
└───────┬───────┘   └───────┬───────────┘   └───────┬────────┘
        │                   │                       │
        │           ┌───────▼───────────┐           │
        └──────────►│  Meta Engines      │◄──────────┘
                    │  (meta/)           │
                    │  Economy/Diplomacy │
                    │  War/Faction/Trade │
                    └────────────────────┘
```

### 3.4 Component Design — Client (C4 Level 3)

```
apps/web/components/game/iso/ (신규 — PixiJS 아이소메트릭)
├── IsoCanvas.tsx            ─── PixiJS 8 Application 마운트, dynamic import (SSR: false)
│                                WebGL context 생명주기 관리
├── IsoTilemap.tsx           ─── @pixi/tilemap 렌더러, 지형 타일 배치
│                                뷰포트 culling (화면 밖 타일 미렌더)
├── IsoBuildingLayer.tsx     ─── 건물 스프라이트 렌더링 + 깊이 정렬 (y-sort)
│                                선택 하이라이트, 건설 중 반투명 프리뷰
├── IsoCitizenLayer.tsx      ─── 시민 스프라이트 렌더링 + 이동 보간
│                                LOD: 줌아웃 시 점 렌더, 줌인 시 스프라이트
├── IsoCamera.ts             ─── 팬(드래그/WASD), 줌(스크롤 3단계), 경계 클램핑
├── IsoSelectionManager.ts   ─── 타일/건물 클릭 감지, 선택 상태 관리
├── IsoProductionOverlay.tsx ─── 건물 간 자원 흐름 화살표 시각화
├── IsoEffects.tsx           ─── 파티클 (건설 먼지, 연기, 수입/지출 이모지)
└── iso-types.ts             ─── PixiJS 전용 내부 타입

apps/web/components/game/iso/ui/ (아이소메트릭 UI 오버레이 — React DOM)
├── ResourceHUD.tsx          ─── 상단 자원 바 (국고, 주요 자원, 인구, 전력)
├── BuildPanel.tsx           ─── 하단 건물 카테고리 탭 + 건물 목록 (비용/요건/설명)
├── BuildingInfoPanel.tsx    ─── 우측 선택 건물 상세 (생산량, 노동자, 효율, 업그레이드)
├── EconomyDashboard.tsx     ─── GDP 그래프, 수입/지출, 무역 수지 (modal)
├── PoliticsPanel.tsx        ─── 파벌 호감도 바, 칙령 목록, 최후통첩 경고
├── ElectionOverlay.tsx      ─── 선거 연설 미니게임, 투표 결과 표시
├── TradePanel.tsx           ─── 무역 노선 관리 (개설/취소/현황)
├── TopMenu.tsx              ─── [Globe] [Economy] [Politics] [Military] [Edicts] 탭
└── IsoMinimap.tsx           ─── 미니맵 (전체 타일맵 + 현재 뷰포트 표시)

apps/web/components/world/ (기존 수정)
├── WorldView.tsx            ─── onManageCountry 콜백 추가
│                                viewMode: 'globe' | 'isometric' 상태 관리
├── CountryPanel.tsx         ─── "Enter Arena" → "Manage Country" 버튼 변경
│                                도시 요약 정보 추가 (건물 수, GDP, 행복도)
└── UNCouncil.tsx            ─── 기존 유지

apps/web/hooks/ (신규 + 확장)
├── useCitySocket.ts         ─── city_state 구독/해제, city_command 전송
├── useCityStore.ts          ─── Zustand city store selector hooks
├── usePoliticsStore.ts      ─── Zustand politics store selector hooks
└── useSocket.ts             ─── (기존 확장) city_state, city_command 이벤트 추가

apps/web/stores/ (신규 Zustand stores)
├── cityStore.ts             ─── 건물, 시민, 자원, 경제 요약 상태
├── politicsStore.ts         ─── 파벌 호감도, 칙령, 선거, 최후통첩 상태
└── isoUiStore.ts            ─── 선택 건물 ID, 빌드 모드, 카메라 줌 레벨
```

### 3.5 Data Flow

#### 3.5.1 유저 건물 배치 흐름

```
Player → BuildPanel (React) → city_command {type:"build", buildingType, tileX, tileY}
  → WebSocket → Hub → CitySimEngine.HandleCommand()
    → tilemap.CanPlace() 검증
    → building.PlaceBuilding() 인스턴스 생성
    → treasury -= constructionCost
    → 다음 Tick()에서 생산 시작
  → city_state (2Hz) → Client Zustand cityStore 업데이트
  → IsoBuildingLayer 리렌더 (새 건물 스프라이트 추가)
```

#### 3.5.2 경제 틱 흐름 (10초 = 게임 1개월)

```
Timer(10s) → CitySimEngine.Tick()
  ① RunProduction(buildings, stockpile)     ─── 가동 건물 산출물 생성
  ② ConsumeMaterials(buildings, stockpile)  ─── 가공 건물 원자재 소비
  ③ ConsumeCitizens(citizens, stockpile)    ─── 시민 식량/오락/주거 소비
  ④ PayWages(buildings, citizens, treasury)  ─── 고용 시민 급여 지급
  ⑤ PayMaintenance(buildings, treasury)      ─── 건물 유지비 차감
  ⑥ ExecuteTrades(routes, stockpile, econ)   ─── 무역 수출/수입 정산
  ⑦ CollectTax(citizens, treasury, taxRate)  ─── 시민 소득세 징수
  ⑧ ComputeGDP()                             ─── 생산+무역+관광-수입비용
  ⑨ SyncToWorldManager(gdp, military, happy) ─── Globe 국력 업데이트
  ⑩ SyncToPolitics(factionEffects)           ─── 파벌 호감도 변동 전파
```

#### 3.5.3 세계 이벤트 → 도시 영향 흐름

```
WarManager.DeclareWar(attacker, defender)
  → WorldManager.NotifyCityEngines(defenderIso3, WarEvent)
    → CitySimEngine.OnWorldEvent(WarEvent)
      → SetWarFooting(true)
        → 군사 건물 효율 +50%
        → 민간 건물 효율 -20%
        → 시민 safety happiness -= 30
      → politics.AdjustApproval("militarist", +10)
      → politics.AdjustApproval("pacifist", -15)
  → Broadcaster → city_state 업데이트 (전시체제 플래그)
  → Client UI: 경보 오버레이 + 건물 효율 변경 반영
```

#### 3.5.4 Globe ↔ Isometric 전환 흐름

```
Globe 모드:
  Player → CountryPanel → "Manage Country" 클릭
    → useCitySocket.subscribe(iso3)   ─── city_state 구독 시작
    → WorldView.setViewMode('isometric')
    → R3F Canvas unmount (200ms delay)
    → PixiJS IsoCanvas mount
    → CitySimEngine.SetMode(PlayerManaged, clientId)  ─── AI → 보조 모드
    → 초기 city_state 수신 → Zustand cityStore 갱신
    → IsoTilemap + IsoBuildingLayer + IsoCitizenLayer 초기 렌더

Isometric 모드 → Globe 복귀:
  Player → TopMenu → [Globe] 버튼
    → useCitySocket.unsubscribe()     ─── city_state 구독 해제
    → CitySimEngine.SetMode(AI)       ─── AI 전체 관리 복귀
    → PixiJS IsoCanvas unmount (200ms delay)
    → R3F Canvas mount
    → WorldView.setViewMode('globe')
```

## 4. Server Component Design

### 4.1 `internal/city/` — CitySimEngine

CitySimEngine은 단일 국가의 도시 시뮬레이션을 담당하는 핵심 오케스트레이터다. 195개 인스턴스가 서버에 상주한다.

```go
// internal/city/engine.go

type ControlMode int
const (
    ModeAI            ControlMode = iota  // NationalAI가 전체 관리
    ModePlayerManaged                     // 유저가 관리 (AI는 보조)
    ModeSpectated                         // 관전 모드 (읽기 전용)
)

type CitySimEngine struct {
    mu           sync.RWMutex
    iso3         string
    tier         string           // S/A/B/C/D
    mode         ControlMode
    managingUser string           // mode==PlayerManaged일 때 client ID

    // Core state
    tilemap      *TileMap
    buildings    map[string]*Building    // id → Building
    citizens     []*CitizenAgent
    stockpile    Stockpile               // 33종 자원 재고
    treasury     float64                 // 국고
    powerGrid    *PowerGrid              // 전력망 그래프

    // Sub-engines
    production   *ProductionEngine
    tradeRoutes  []*TradeRoute
    politics     *PoliticsEngine         // internal/politics/ 참조

    // External references (인터페이스로 주입)
    worldMgr     WorldSyncer            // WorldManager 인터페이스
    econEngine   EconomySyncer          // EconomyEngine 인터페이스
    warMgr       WarEventReceiver       // WarManager 콜백

    // Tick management
    tickCount    uint64
    tickInterval time.Duration           // 기본 10초 (활성), 비활성 시 60초
    lastTick     time.Time

    // Stats for Globe sync
    gdp          float64
    militaryPower float64
    avgHappiness float64
}

// 핵심 인터페이스: Meta 엔진과의 디커플링
type WorldSyncer interface {
    UpdateCountryStats(iso3 string, gdp, military, happiness float64)
    GetDiplomacyScore(iso3A, iso3B string) float64
}

type EconomySyncer interface {
    GetResourcePrice(resource ResourceType) float64
    GetGlobalTradeModifier() float64
    ManualTick(iso3 string)  // 기존 EconomyEngine 래퍼 (plan Phase 2)
}

type WarEventReceiver interface {
    IsAtWar(iso3 string) bool
    GetWarEnemies(iso3 string) []string
}
```

**Tick 스케줄링 전략**:
- **활성 국가** (유저 관리 중): 10초 간격 풀 틱
- **비활성 국가** (AI 전용): 60초 간격 경량 틱 (시민 FSM 스킵, 생산/무역만 계산)
- **관전 대상**: 10초 간격 풀 틱 (시민 움직임 표시용)

```go
// 전체 195국 틱 스케줄러 (main goroutine)
func (mgr *CityManager) RunTickLoop(ctx context.Context) {
    ticker10s := time.NewTicker(10 * time.Second)
    ticker60s := time.NewTicker(60 * time.Second)
    for {
        select {
        case <-ticker10s.C:
            // 활성 국가만 풀 틱
            for _, engine := range mgr.activeEngines {
                go engine.FullTick()
            }
        case <-ticker60s.C:
            // 비활성 국가 경량 틱
            for _, engine := range mgr.inactiveEngines {
                go engine.LightTick()
            }
        case <-ctx.Done():
            return
        }
    }
}
```

#### CityManager — 195국 오케스트레이터

```go
// internal/city/manager.go
type CityManager struct {
    mu              sync.RWMutex
    engines         map[string]*CitySimEngine  // iso3 → engine (195개)
    activeEngines   []*CitySimEngine           // 유저 관리 중 (10초 틱)
    inactiveEngines []*CitySimEngine           // AI 전용 (60초 틱)

    worldMgr        *world.WorldManager
    econEngine      *meta.EconomyEngine
    warMgr          *meta.WarManager
    hub             *ws.Hub

    snapshotDir     string                     // JSON 스냅샷 저장 경로
}

func NewCityManager(worldMgr, econEngine, warMgr, hub) *CityManager
func (m *CityManager) InitializeAll()          // 195국 엔진 생성 + 스냅샷 로드
func (m *CityManager) GetEngine(iso3) *CitySimEngine
func (m *CityManager) ActivateForPlayer(iso3, clientID string)  // AI → PlayerManaged
func (m *CityManager) DeactivatePlayer(iso3 string)             // PlayerManaged → AI
func (m *CityManager) SaveSnapshots()          // 5분 주기 전체 스냅샷
func (m *CityManager) RunTickLoop(ctx)         // 위 tick 스케줄러
```

#### PowerGrid — 전력망 시스템

```go
// internal/city/power.go
type PowerGrid struct {
    capacity    float64                    // 총 발전 용량 (발전소 합계)
    usage       float64                    // 총 전력 소비 (건물 합계)
    connected   map[string]bool            // building ID → 전력 연결 여부
}

// 전력 계산: 매 틱 실행
func (pg *PowerGrid) Recalculate(buildings map[string]*Building) {
    pg.capacity = 0
    pg.usage = 0
    for _, b := range buildings {
        if b.Type.IsPowerPlant() {
            pg.capacity += b.PowerOutput() * b.Efficiency
        } else if b.Type.RequiresPower() {
            pg.usage += b.PowerDemand()
        }
    }
    // 전력 부족 시: 우선순위 낮은 건물부터 powered=false
    if pg.usage > pg.capacity {
        pg.shedLoad(buildings)
    }
}

// 우선순위: 정부 > 군사 > 공공 > 산업 > 상업 > 주거 > 관광
var powerPriority = map[BuildingCategory]int{
    "government": 7, "military": 6, "public": 5,
    "processing": 4, "commerce": 3, "housing": 2, "tourism": 1,
}
```

### 4.2 `internal/politics/` — Politics System

```go
// internal/politics/faction.go

type FactionAxis int
const (
    AxisEconomy  FactionAxis = iota  // 자본가 ⟷ 공산주의자
    AxisEnviron                       // 환경주의자 ⟷ 산업주의자
    AxisValues                        // 종교인 ⟷ 군국주의자
    AxisSocial                        // 보수주의자 ⟷ 진보주의자
)

type FactionID string
const (
    FCapitalist    FactionID = "capitalist"
    FCommunist     FactionID = "communist"
    FEnvironment   FactionID = "environment"
    FIndustrialist FactionID = "industrialist"
    FReligious     FactionID = "religious"
    FMilitarist    FactionID = "militarist"
    FConservative  FactionID = "conservative"
    FProgressive   FactionID = "progressive"
)

type PoliticsEngine struct {
    mu           sync.RWMutex
    factions     map[FactionID]*FactionState
    edicts       map[string]*Edict       // 시행 중인 칙령
    edictDefs    map[string]*EdictDef    // 전체 칙령 정의
    ultimatums   []*Ultimatum            // 활성 최후통첩
    currentEra   int                     // 1~4
    electionDue  bool                    // 선거 예정 여부
}

type FactionState struct {
    ID          FactionID
    Approval    float64    // 0~100
    MemberCount int        // 소속 시민 수
    Ultimatum   *Ultimatum // nil이면 미발동
}

// 최후통첩: approval < 25 시 자동 발동
type Ultimatum struct {
    FactionID  FactionID
    Demand     string           // "build_church", "raise_wages", etc.
    Deadline   time.Time        // 48 경제틱 (8분) 이내 충족 필요
    Penalty    UltimatumPenalty // 실패 시 제재 타입
    Issued     time.Time
}

type UltimatumPenalty int
const (
    PenaltyStrike     UltimatumPenalty = iota // 공산: 전체 파업
    PenaltyCoup                                // 군국: 쿠데타
    PenaltyFinCrisis                           // 자본: 금융 위기
    PenaltyHack                                // 진보: 해킹
    PenaltyProtest                             // 종교: 대시위
    PenaltyIntlReport                          // 환경: 국제 고발
    PenaltyCapFlight                           // 산업: 자본 도피
    PenaltySabotage                            // 보수: 사보타주
)
```

**선거 시스템**:
- Era당 1회 선거 (시즌 4주 = 4 Era = 4 선거)
- 투표 수식: `voteFor = (citizenHappiness × 0.6) + (factionApproval × 0.4) + random(-5, +5)`
- 패배 시: 해당 국가 관리 권한 상실 → 강제 Globe 복귀
- 부정 선거: `rigVotes(amount)` → 진보/보수 파벌 반발 (-15 approval)

**선거 시퀀스 다이어그램**:
```
Timer (Era 종료 시점)
  → PoliticsEngine.TriggerElection()
    → election_start 이벤트 → 클라이언트 ElectionOverlay 표시
    → [유저 선택] 6단계 연설 (election_speech 명령 ×6)
      ① 서문: 파벌 선택 → 해당 파벌 +5
      ② 문제 인정: 문제 유형 선택 → 관련 파벌 +3
      ③ 파벌 칭찬: 대상 파벌 +8
      ④ 약속: 구체적 정책 약속 → 관련 파벌 +10, 대립 파벌 -5
      ⑤ 결어: 종합 메시지
    → [선택적] rig_election 명령 → 부정 선거
    → PoliticsEngine.RunElection()
      → 각 시민: voteFor = (happiness × 0.6) + (factionApproval × 0.4) + rand(-5, +5)
      → 부정 선거 시: voteFor += rigAmount, 진보 -15, 보수 -10
    → election_result 이벤트 → ElectionOverlay 결과 표시
    → 승리: 계속 관리 + 약속 이행 의무 (미이행 시 파벌 -20)
    → 패배: 강제 Globe 복귀 + AI 모드 전환
```

### 4.3 Existing Module Extensions

기존 `internal/meta/` 모듈은 인터페이스 확장으로 도시 시뮬과 통합한다. 기존 API를 깨지 않는 것이 핵심.

#### EconomyEngine 확장 (`internal/meta/economy.go`)

```go
// 신규 메서드 추가 (기존 구조체에)
func (e *EconomyEngine) ManualTick(iso3 string) {
    // 기존 private processCountryTick()을 래핑
    // CitySimEngine에서 개별 국가 경제 틱 트리거용
    e.mu.Lock()
    defer e.mu.Unlock()
    if ce, ok := e.countries[iso3]; ok {
        e.processCountryTick(ce)
    }
}

// 신규: 자원 시장 가격 조회 (Tier 1~3, 33종)
func (e *EconomyEngine) GetResourcePrice(res city.ResourceType) float64 {
    // 기존 6종 (oil/minerals/food/tech/manpower/influence) → 33종 확장
    // 기존 가격은 ResourceType 매핑으로 호환 유지
}
```

**CountryResourceProfile 확장** (`internal/meta/economy.go`):
```go
// 기존 5 필드에 v26 필드 추가
type CountryResourceProfile struct {
    Oil      int `json:"oil"`
    Minerals int `json:"minerals"`
    Food     int `json:"food"`
    Tech     int `json:"tech"`
    Manpower int `json:"manpower"`
    // v26 신규
    Farmland  int    `json:"farmland"`   // 농지 비율 (0~100)
    Forest    int    `json:"forest"`     // 산림 비율
    Coastline int    `json:"coastline"`  // 해안선
    Climate   string `json:"climate"`    // tropical/temperate/arid/cold/continental
}
```

#### DiplomacyEngine 확장 (`internal/meta/diplomacy.go`)
- `GetDiplomacyScore(iso3A, iso3B)` → 이미 존재, CitySimEngine에서 무역 가격 보너스 계산에 사용
- 신규 콜백: `OnSanctionApplied(iso3, targetIso3)` → CitySimEngine에 무역 차단 전파
- 신규 콜백: `OnAllianceFormed(iso3A, iso3B)` → CitySimEngine에 무역 보너스 전파

#### WarManager 확장 (`internal/meta/war.go`)
- 신규 콜백: `OnWarDeclared(attacker, defender)` → 양국 CitySimEngine에 전시체제 트리거
- 신규 콜백: `OnWarEnded(iso3A, iso3B, result)` → 전시체제 해제, 승리/패배 효과

#### FactionManager 통합 (`internal/meta/faction.go`)
- 기존 글로벌 Faction 시스템과 v26 국내 파벌 시스템은 별도 레이어
- 글로벌 Faction 이벤트 → 국내 파벌 호감도에 간접 영향 (+/-5)
- 연결: `meta.FactionManager.OnGlobalEvent()` → `politics.PoliticsEngine.OnExternalFactionEvent()`

#### WorldManager 확장 (`internal/world/world_manager.go`)
```go
// 신규: CitySimEngine에서 호출하는 국력 업데이트
func (wm *WorldManager) UpdateCountryStats(iso3 string, gdp, military, happiness float64) {
    wm.mu.Lock()
    defer wm.mu.Unlock()
    if cs, ok := wm.countries[iso3]; ok {
        cs.GDP = gdp
        cs.MilitaryPower = military
        cs.Stability = happiness
        // Globe 시각화에 반영 (1Hz broadcast)
    }
}

// 신규: CitySimEngine 배열 관리
func (wm *WorldManager) GetCityEngine(iso3 string) *city.CitySimEngine
func (wm *WorldManager) NotifyCityEngines(iso3 string, event WorldEvent)
```

## 5. Data Models

### 5.1 Server-Side Go Structs

#### Building (서버 인스턴스)

```go
type Building struct {
    ID           string       `json:"id"`
    Type         BuildingType `json:"type"`
    TileX        int          `json:"tileX"`
    TileY        int          `json:"tileY"`
    SizeW        int          `json:"sizeW"`       // 타일 점유 너비
    SizeH        int          `json:"sizeH"`       // 타일 점유 높이
    Level        int          `json:"level"`        // 1~3
    WorkMode     string       `json:"workMode"`     // Tropico 작업 모드

    Workers      int          `json:"workers"`
    MaxWorkers   int          `json:"maxWorkers"`
    Efficiency   float64      `json:"efficiency"`   // 0.0~1.0
    Powered      bool         `json:"powered"`

    Produces     []ResourceAmount `json:"produces"`
    Consumes     []ResourceAmount `json:"consumes"`

    ConstructCost float64     `json:"constructCost"`
    MaintCost     float64     `json:"maintCost"`    // 월간 유지비
    WageLevel     int         `json:"wageLevel"`    // 1~5

    BuiltAt       time.Time   `json:"builtAt"`
    Constructing  bool        `json:"constructing"` // 건설 중 (3 틱 소요)
    ConstructTick int         `json:"constructTick"` // 남은 건설 틱
}

type ResourceAmount struct {
    Resource ResourceType `json:"resource"`
    Amount   float64      `json:"amount"`
}
```

#### CitizenAgent (서버 FSM)

```go
type CitizenState int
const (
    StateIdle       CitizenState = iota
    StateCommuting
    StateWorking
    StateShopping
    StateResting
    StateProtesting
)

type Education int
const (
    EduUneducated Education = iota
    EduHighSchool
    EduCollege
)

type WealthClass int
const (
    WealthPoor WealthClass = iota
    WealthWorking
    WealthComfortable
    WealthRich
    WealthElite
)

type CitizenAgent struct {
    ID            string         `json:"id"`
    Name          string         `json:"name"`
    Age           int            `json:"age"`
    Education     Education      `json:"education"`
    Wealth        WealthClass    `json:"wealth"`

    Factions      []FactionID    `json:"factions"`      // max 4 (축당 1)
    FactionLoyalty map[FactionID]string `json:"factionLoyalty"` // normal/loyal/zealot

    Happiness     HappinessState `json:"happiness"`
    OverallHappy  float64        `json:"overallHappy"`

    Workplace     string         `json:"workplace"`     // building ID, "" = 실업
    Home          string         `json:"home"`          // building ID, "" = 노숙
    Salary        float64        `json:"salary"`
    Savings       float64        `json:"savings"`

    TileX         int            `json:"tileX"`
    TileY         int            `json:"tileY"`
    State         CitizenState   `json:"state"`
    ActionTarget  string         `json:"actionTarget"`  // 목적지 building ID
    PathCache     []TileCoord    `json:"-"`             // 직렬화 제외
}

type HappinessState struct {
    Food          float64 `json:"food"`
    Healthcare    float64 `json:"healthcare"`
    Entertainment float64 `json:"entertainment"`
    Faith         float64 `json:"faith"`
    Housing       float64 `json:"housing"`
    Job           float64 `json:"job"`
    Liberty       float64 `json:"liberty"`
    Safety        float64 `json:"safety"`
}
```

#### TileMap (서버)

```go
type TileType int
const (
    TileGrass TileType = iota   // 평지 (buildable)
    TileFarmland                 // 농경지
    TileDesert                   // 사막
    TileWater                    // 물 (항구만)
    TileMountain                 // 산 (광산만)
    TileForest                   // 숲 (벌목장)
    TileBeach                    // 해안
    TileRoad                     // 도로
    TileTundra                   // 동토
    TileRiver                    // 강
)

type TileMap struct {
    Width    int           `json:"width"`
    Height   int           `json:"height"`
    Grid     [][]TileType  `json:"grid"`
    Occupied [][]string    `json:"occupied"` // building ID, "" = 빈 타일
}
```

### 5.2 Shared Types (`packages/shared/src/types/city.ts`)

```typescript
// packages/shared/src/types/city.ts

// ─── Resources (33종) ───

export type ResourceTier = 'tier1' | 'tier2' | 'tier3';

export type ResourceType =
  // Tier 1: 원자재 (15종)
  | 'grain' | 'sugarcane' | 'tobacco' | 'cotton' | 'coffee' | 'fruit'
  | 'cattle' | 'fish' | 'lumber' | 'iron' | 'coal' | 'gold'
  | 'uranium' | 'oil' | 'natural_gas'
  // Tier 2: 가공품 (12종)
  | 'canned_food' | 'rum' | 'cigars' | 'chocolate' | 'planks'
  | 'steel' | 'plastics' | 'clothing' | 'fuel' | 'parts'
  | 'furniture' | 'processed_food'
  // Tier 3: 고급 가공품 (6종)
  | 'automobiles' | 'electronics' | 'jewelry' | 'pharmaceuticals'
  | 'weapons' | 'ships';

export type Stockpile = Partial<Record<ResourceType, number>>;

// ─── Buildings (58종) ───

export type BuildingCategory =
  | 'resource' | 'processing' | 'housing' | 'commerce'
  | 'public' | 'government' | 'military' | 'infrastructure' | 'tourism';

export interface BuildingDef {
  type: string;
  category: BuildingCategory;
  name: string;
  sizeW: number;           // 타일 너비
  sizeH: number;           // 타일 높이
  maxWorkers: number;
  educationReq: Education;
  era: 1 | 2 | 3 | 4;     // 해금 시대
  constructCost: number;
  maintCost: number;
  constructTicks: number;  // 건설 소요 틱
  produces: { resource: ResourceType; amount: number }[];
  consumes: { resource: ResourceType; amount: number }[];
  tileRequirement?: TileType;  // 특정 지형에만 건설 가능
  powerRequired: boolean;
  happinessEffect?: Partial<HappinessFactors>;  // 인접 시민 행복도 영향
  factionEffect?: Partial<Record<FactionId, number>>; // 건설 시 파벌 호감도 변동
}

export interface BuildingSnapshot {
  id: string;
  type: string;
  tileX: number;
  tileY: number;
  level: 1 | 2 | 3;
  workers: number;
  maxWorkers: number;
  efficiency: number;
  powered: boolean;
  constructing: boolean;
  workMode: string;
}

// ─── Citizens ───

export type Education = 'uneducated' | 'highschool' | 'college';
export type WealthClass = 'poor' | 'working' | 'comfortable' | 'rich' | 'elite';
export type CitizenState = 'idle' | 'commuting' | 'working' | 'shopping' | 'resting' | 'protesting';

export interface HappinessFactors {
  food: number;
  healthcare: number;
  entertainment: number;
  faith: number;
  housing: number;
  job: number;
  liberty: number;
  safety: number;
}

export interface CitizenSnapshot {
  id: string;
  tileX: number;
  tileY: number;
  state: CitizenState;
  education: Education;
  wealth: WealthClass;
  overallHappy: number;     // 0~100
  workplace: string | null;
}

// ─── Factions ───

export type FactionId =
  | 'capitalist' | 'communist'
  | 'environment' | 'industrialist'
  | 'religious' | 'militarist'
  | 'conservative' | 'progressive';

export interface FactionSnapshot {
  id: FactionId;
  approval: number;         // 0~100
  memberCount: number;
  hasUltimatum: boolean;
  ultimatumDeadline?: number; // 남은 틱
}

// ─── Tiles ───

export type TileType =
  | 'grass' | 'farmland' | 'desert' | 'water' | 'mountain'
  | 'forest' | 'beach' | 'road' | 'tundra' | 'river';

export interface TileMapSnapshot {
  width: number;
  height: number;
  grid: TileType[][];       // 초기 전송만 (변경 드묾)
}

// ─── City State (2Hz broadcast) ───

export interface CityClientState {
  iso3: string;
  era: 1 | 2 | 3 | 4;
  tickCount: number;

  // Tile data (초기 1회만, 이후 delta)
  tilemap?: TileMapSnapshot;

  buildings: BuildingSnapshot[];
  citizens: CitizenSnapshot[];        // LOD: 줌아웃 시 위치만
  stockpile: Stockpile;
  treasury: number;
  powerCapacity: number;
  powerUsage: number;

  economy: {
    gdp: number;
    income: number;                    // 월 수입
    expense: number;                   // 월 지출
    tradeBalance: number;
    population: number;
  };

  factions: FactionSnapshot[];
  activeEdicts: string[];              // edict IDs
  events: CityEvent[];                 // 최근 이벤트 큐

  warFooting: boolean;                 // 전시체제 여부
  controlMode: 'ai' | 'player' | 'spectator';
}

export interface CityEvent {
  type: 'build_complete' | 'building_destroyed' | 'ultimatum' | 'election'
    | 'trade_deal' | 'war_declared' | 'disaster' | 'immigration' | 'emigration';
  message: string;
  timestamp: number;
  data?: Record<string, unknown>;
}

// ─── City Commands (client → server) ───

export type CityCommand =
  | { type: 'build'; buildingType: string; tileX: number; tileY: number }
  | { type: 'demolish'; buildingId: string }
  | { type: 'upgrade'; buildingId: string }
  | { type: 'set_work_mode'; buildingId: string; mode: string }
  | { type: 'set_wage'; buildingId: string; level: 1 | 2 | 3 | 4 | 5 }
  | { type: 'enact_edict'; edictId: string }
  | { type: 'revoke_edict'; edictId: string }
  | { type: 'set_trade_route'; partnerIso3: string; resource: ResourceType; direction: 'export' | 'import'; amount: number }
  | { type: 'cancel_trade_route'; routeId: string }
  | { type: 'diplomatic_action'; action: string; targetIso3: string }
  | { type: 'election_speech'; factionId: FactionId; promiseId: string }
  | { type: 'rig_election'; amount: number };

// ─── Edicts ───

export interface EdictDef {
  id: string;
  name: string;
  description: string;
  era: 1 | 2 | 3 | 4;
  cost: number;
  monthlyCost: number;
  factionEffects: Partial<Record<FactionId, number>>;
  economyEffects: Partial<{
    taxRate: number;
    tradeBonus: number;
    productionBonus: number;
    tourismBonus: number;
  }>;
  happinessEffects: Partial<HappinessFactors>;
}

// ─── Trade ───

export interface TradeRouteSnapshot {
  id: string;
  partnerIso3: string;
  resource: ResourceType;
  direction: 'export' | 'import';
  contractAmount: number;
  deliveredAmount: number;
  priceBonus: number;
  status: 'active' | 'completed' | 'cancelled';
}
```

## 6. WebSocket Protocol

### 6.1 New Events

기존 `internal/ws/protocol.go`에 추가하는 v26 이벤트.

```go
// internal/ws/protocol.go — v26 추가

// --- Client → Server ---
const (
    // v26: City management events
    EventSubscribeCity   = "subscribe_city"    // iso3 구독 시작
    EventUnsubscribeCity = "unsubscribe_city"  // iso3 구독 해제
    EventCityCommand     = "city_command"      // CityCommand JSON
)

// --- Server → Client ---
const (
    // v26: City state events
    EventCityState       = "city_state"        // CityClientState (2Hz)
    EventCityEvent       = "city_event"        // CityEvent (즉시)
    EventElectionStart   = "election_start"    // 선거 시작 알림
    EventElectionResult  = "election_result"   // 선거 결과
    EventUltimatum       = "ultimatum"         // 최후통첩 발동
    EventUltimatumResult = "ultimatum_result"  // 최후통첩 결과
    EventCityError       = "city_error"        // 명령 실패 에러
)
```

**이벤트 페이로드 요약**:

| Event | Direction | Payload | 빈도 |
|-------|-----------|---------|------|
| `subscribe_city` | C→S | `{ iso3: string }` | 1회 (진입 시) |
| `unsubscribe_city` | C→S | `{ iso3: string }` | 1회 (이탈 시) |
| `city_command` | C→S | `CityCommand` (union type) | 유저 조작 시 |
| `city_state` | S→C | `CityClientState` | 2Hz (500ms 간격) |
| `city_event` | S→C | `CityEvent` | 이벤트 발생 시 즉시 |
| `election_start` | S→C | `{ era, candidates, deadline }` | Era당 1회 |
| `election_result` | S→C | `{ winner, votes, approved }` | 선거 완료 시 |
| `ultimatum` | S→C | `{ factionId, demand, deadline }` | 발동 시 즉시 |
| `city_error` | S→C | `{ code, message, commandType }` | 명령 실패 시 |

### 6.2 City State Broadcast (2Hz)

City state는 활성 구독자에게 **500ms 간격 (2Hz)** 으로 전송된다.

**대역폭 최적화 전략**:

| 전략 | 설명 | 절감 |
|------|------|------|
| **초기 전체 + 이후 delta** | `tilemap`은 `subscribe_city` 응답에서 1회만 전송. 이후 city_state에서는 `tilemap` 필드 생략 | ~70% (맵 데이터) |
| **시민 LOD** | 줌 레벨에 따라 시민 데이터 상세도 조절: 줌아웃 → `{id, tileX, tileY}` 만, 줌인 → 전체 `CitizenSnapshot` | ~50% (시민) |
| **건물 delta** | 변경된 건물만 전송 (`changedBuildings[]` + `removedBuildingIds[]`) | ~80% (건물) |
| **gzip 압축** | WebSocket per-message deflate 활성화 | ~60% 전체 |

**예상 대역폭** (S-tier 500건물, 500시민, 줌인):
- 초기 전송: ~50KB (tilemap 80x80 + 전체 건물 + 전체 시민)
- 정상 2Hz: ~5KB/tick (delta 건물 ~20개 + 이동 시민 ~100명 + 경제 요약)
- 연간 대역폭: ~10KB/s per subscriber

```go
// Broadcaster에 추가
func (b *Broadcaster) BroadcastCityState(iso3 string, state *CityClientState) {
    data, _ := json.Marshal(WsMessage{
        Event: EventCityState,
        Data:  state,
    })

    b.hub.mu.RLock()
    defer b.hub.mu.RUnlock()
    for _, sub := range b.citySubscribers[iso3] {
        sub.Send <- data
    }
}
```

### 6.3 City Command Protocol

City command는 클라이언트에서 서버로 전송하는 모든 도시 관리 명령이다.

**명령 처리 파이프라인**:
```
Client → city_command → Hub.handleCityCommand()
  → 권한 검증: client.managingCountry == cmd.iso3
  → Rate limiting: 초당 10 명령 제한
  → CitySimEngine.HandleCommand(cmd)
    → 명령 타입별 검증:
      build:    treasury ≥ cost, tilemap.CanPlace(), era ≥ buildingDef.era
      demolish: building 존재, 건설 완료 상태
      upgrade:  level < 3, treasury ≥ upgradeCost
      set_wage: 1 ≤ level ≤ 5
      enact_edict: era ≥ edictDef.era, treasury ≥ cost, 미시행 상태
      trade:    항구/공항 슬롯 여유, 외교 관계 ≥ -50
    → 성공: 상태 변경 → 다음 city_state에 반영
    → 실패: city_error 전송 (code + message)
```

**에러 코드**:

| Code | 의미 | 예시 |
|------|------|------|
| `INSUFFICIENT_FUNDS` | 국고 부족 | 건설/칙령 비용 초과 |
| `INVALID_PLACEMENT` | 배치 불가 | 타일 점유, 지형 부적합 |
| `ERA_LOCKED` | 시대 미해금 | Era 3 건물을 Era 1에서 건설 |
| `NO_TRADE_SLOT` | 무역 슬롯 부족 | 항구 없이 무역 시도 |
| `DIPLOMATIC_BLOCKED` | 외교 차단 | 제재 중 무역 시도 |
| `ALREADY_ENACTED` | 이미 시행 | 중복 칙령 시행 |
| `NOT_AUTHORIZED` | 권한 없음 | 다른 유저의 국가에 명령 |
| `RATE_LIMITED` | 속도 제한 | 초당 10 명령 초과 |

## 7. REST API

실시간 상태는 WebSocket으로, 정적/조회 데이터는 REST로 제공한다.

| Method | Path | Description | Response |
|--------|------|-------------|----------|
| GET | `/api/v1/city/{iso3}` | 국가 도시 요약 (비구독 상태에서도 조회 가능) | `CityOverview` |
| GET | `/api/v1/city/{iso3}/buildings` | 건물 목록 전체 | `BuildingSnapshot[]` |
| GET | `/api/v1/city/{iso3}/citizens/stats` | 시민 통계 (총 인구, 실업률, 행복도 분포) | `CitizenStats` |
| GET | `/api/v1/city/{iso3}/economy` | 경제 대시보드 데이터 (GDP 히스토리, 수입/지출) | `EconomyDashboard` |
| GET | `/api/v1/city/{iso3}/politics` | 파벌 상태, 칙령 목록, 선거 예측 | `PoliticsOverview` |
| GET | `/api/v1/city/{iso3}/trade` | 무역 노선 현황 | `TradeRouteSnapshot[]` |
| GET | `/api/v1/buildings/defs` | 전체 건물 정의 (정적, 캐시 가능) | `BuildingDef[]` |
| GET | `/api/v1/edicts/defs` | 전체 칙령 정의 (정적) | `EdictDef[]` |
| GET | `/api/v1/resources/prices` | 현재 자원 시장 가격 | `Record<ResourceType, number>` |

**응답 예시** — `GET /api/v1/city/KOR`:
```json
{
  "iso3": "KOR",
  "tier": "A",
  "era": 2,
  "population": 180,
  "buildingCount": 95,
  "gdp": 1250000,
  "avgHappiness": 62.5,
  "militaryPower": 45.2,
  "controlMode": "ai",
  "managingUser": null,
  "topResources": [
    { "resource": "electronics", "amount": 450 },
    { "resource": "steel", "amount": 320 }
  ]
}
```

**캐싱 전략**:
- `/buildings/defs`, `/edicts/defs`: `Cache-Control: public, max-age=3600` (1시간, 시즌 중 불변)
- `/resources/prices`: `Cache-Control: no-cache` (경제 틱마다 변동)
- `/city/{iso3}`: `Cache-Control: no-cache` (실시간 변동, 조회 빈도 낮음)

## 8. Client Component Design

### 8.1 PixiJS Isometric Engine (`components/game/iso/`)

PixiJS 8 기반 2D 아이소메트릭 렌더러. R3F Globe와는 **Canvas 전환**(mount/unmount)으로 공존한다.

#### IsoCanvas.tsx — 진입점

```typescript
// dynamic import: SSR 비활성화
const IsoCanvas = dynamic(() => import('./IsoCanvas'), { ssr: false });

// 내부 구조
export function IsoCanvas({ iso3 }: { iso3: string }) {
  const pixiRef = useRef<Application>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const app = new Application();
    app.init({
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: 0x1a1a2e,
      antialias: false,            // 픽셀아트 스타일
      resolution: window.devicePixelRatio,
      autoDensity: true,
    }).then(() => {
      containerRef.current?.appendChild(app.canvas);
      pixiRef.current = app;
    });

    return () => {
      app.destroy(true, { children: true, texture: true });
    };
  }, []);

  // 레이어 마운트 순서 (z-order)
  return (
    <div ref={containerRef}>
      {pixiRef.current && (
        <>
          <IsoTilemap app={pixiRef.current} iso3={iso3} />
          <IsoBuildingLayer app={pixiRef.current} />
          <IsoCitizenLayer app={pixiRef.current} />
          <IsoProductionOverlay app={pixiRef.current} />
          <IsoEffects app={pixiRef.current} />
        </>
      )}
    </div>
  );
}
```

#### 렌더링 레이어 스택

```
┌─────────────────────────────────────────┐
│  Layer 5: IsoEffects (파티클)             │  z: 500
│  Layer 4: IsoProductionOverlay (화살표)   │  z: 400
│  Layer 3: IsoCitizenLayer (시민 스프라이트)│  z: 300 (y-sort)
│  Layer 2: IsoBuildingLayer (건물)          │  z: 200 (y-sort)
│  Layer 1: IsoTilemap (지형 타일)          │  z: 100
│  Layer 0: Background (단색)               │  z: 0
└─────────────────────────────────────────┘
```

#### 아이소메트릭 좌표 변환

```typescript
// 타일 좌표 (grid) → 스크린 좌표 (pixel)
function tileToScreen(tileX: number, tileY: number): { x: number; y: number } {
  return {
    x: (tileX - tileY) * (TILE_WIDTH / 2),
    y: (tileX + tileY) * (TILE_HEIGHT / 2),
  };
}

// 스크린 좌표 → 타일 좌표 (클릭 감지용)
function screenToTile(screenX: number, screenY: number): { tileX: number; tileY: number } {
  const tileX = Math.floor((screenX / (TILE_WIDTH / 2) + screenY / (TILE_HEIGHT / 2)) / 2);
  const tileY = Math.floor((screenY / (TILE_HEIGHT / 2) - screenX / (TILE_WIDTH / 2)) / 2);
  return { tileX, tileY };
}

const TILE_WIDTH = 64;
const TILE_HEIGHT = 32;
```

#### 뷰포트 Culling

```typescript
// IsoTilemap: 화면에 보이는 타일만 렌더
function getVisibleTileRange(camera: IsoCamera, mapW: number, mapH: number) {
  const topLeft = screenToTile(camera.x - camera.viewW / 2, camera.y - camera.viewH / 2);
  const botRight = screenToTile(camera.x + camera.viewW / 2, camera.y + camera.viewH / 2);
  return {
    minX: Math.max(0, topLeft.tileX - 2),
    maxX: Math.min(mapW - 1, botRight.tileX + 2),
    minY: Math.max(0, topLeft.tileY - 2),
    maxY: Math.min(mapH - 1, botRight.tileY + 2),
  };
}
```

### 8.2 Globe-Iso Transition

기존 R3F Globe와 PixiJS Iso 뷰는 동시에 렌더링하지 않는다. WebGL 컨텍스트 충돌 방지를 위해 **mount/unmount 전환 + 200ms delay** 패턴을 사용한다.

```typescript
// apps/web/components/world/WorldView.tsx (확장)

type ViewMode = 'globe' | 'isometric' | 'transitioning';

function WorldView() {
  const [viewMode, setViewMode] = useState<ViewMode>('globe');
  const [activeIso3, setActiveIso3] = useState<string | null>(null);

  const handleManageCountry = useCallback((iso3: string) => {
    setViewMode('transitioning');
    // 1. Globe fade-out (200ms CSS opacity transition)
    setTimeout(() => {
      setActiveIso3(iso3);
      setViewMode('isometric');
    }, 200); // R3F unmount → PixiJS mount delay
  }, []);

  const handleBackToGlobe = useCallback(() => {
    setViewMode('transitioning');
    setTimeout(() => {
      setActiveIso3(null);
      setViewMode('globe');
    }, 200); // PixiJS unmount → R3F mount delay
  }, []);

  return (
    <div className="relative w-full h-full">
      {/* Globe 뷰 (R3F) */}
      {viewMode === 'globe' && (
        <GlobeView onManageCountry={handleManageCountry} />
      )}

      {/* Isometric 뷰 (PixiJS) */}
      {viewMode === 'isometric' && activeIso3 && (
        <>
          <IsoCanvas iso3={activeIso3} />
          <TopMenu onBackToGlobe={handleBackToGlobe} />
          <ResourceHUD />
          <BuildPanel />
          <BuildingInfoPanel />
        </>
      )}

      {/* 전환 오버레이 */}
      {viewMode === 'transitioning' && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center
                        animate-pulse z-50">
          <span className="text-amber-400 font-heading text-2xl">
            {activeIso3 ? 'Entering Nation...' : 'Returning to Globe...'}
          </span>
        </div>
      )}
    </div>
  );
}
```

**전환 시퀀스 타이밍**:
1. `0ms`: 전환 트리거 → `viewMode = 'transitioning'` → 블랙 오버레이
2. `200ms`: 이전 Canvas unmount (WebGL context 해제)
3. `200ms`: 새 Canvas mount (WebGL context 생성)
4. `~400ms`: 새 뷰 렌더링 시작
5. `~800ms`: 데이터 로드 완료 (city_state 첫 수신)
6. `~1000ms`: 전환 완료 (오버레이 fade-out)

**Critical**: R3F `useFrame` priority 문제 방지를 위해 Globe 뷰의 모든 useFrame 훅은 default priority(0)를 사용한다 (CLAUDE.md 참조).

### 8.3 Zustand Store Design

3개의 Zustand store로 관심사를 분리한다.

#### cityStore.ts — 도시 핵심 상태

```typescript
interface CityState {
  // 서버에서 수신한 상태
  iso3: string | null;
  era: number;
  buildings: Map<string, BuildingSnapshot>;
  citizens: CitizenSnapshot[];
  stockpile: Stockpile;
  treasury: number;
  powerCapacity: number;
  powerUsage: number;
  economy: { gdp: number; income: number; expense: number; tradeBalance: number; population: number };
  tradeRoutes: TradeRouteSnapshot[];
  events: CityEvent[];
  warFooting: boolean;
  controlMode: 'ai' | 'player' | 'spectator';
  tilemap: TileMapSnapshot | null;

  // Actions
  setCityState: (state: CityClientState) => void;
  applyDelta: (delta: Partial<CityClientState>) => void;
  reset: () => void;
}

export const useCityStore = create<CityState>((set) => ({
  iso3: null,
  // ... initial values
  setCityState: (state) => set({
    iso3: state.iso3,
    buildings: new Map(state.buildings.map(b => [b.id, b])),
    citizens: state.citizens,
    stockpile: state.stockpile,
    // ...
  }),
  applyDelta: (delta) => set((prev) => ({
    ...prev,
    ...delta,
    // buildings delta: merge changed, remove deleted
    buildings: delta.buildings
      ? mergeBuildingsDelta(prev.buildings, delta.buildings)
      : prev.buildings,
  })),
  reset: () => set({ iso3: null, buildings: new Map(), /* ... */ }),
}));
```

#### politicsStore.ts — 정치 상태

```typescript
interface PoliticsState {
  factions: FactionSnapshot[];
  activeEdicts: string[];
  electionDue: boolean;
  currentElection: ElectionState | null;
  ultimatums: UltimatumState[];

  // Actions
  setFactions: (factions: FactionSnapshot[]) => void;
  setElection: (election: ElectionState | null) => void;
  addUltimatum: (u: UltimatumState) => void;
  resolveUltimatum: (factionId: FactionId) => void;
}
```

#### isoUiStore.ts — UI 인터랙션 상태

```typescript
interface IsoUiState {
  selectedBuildingId: string | null;
  buildMode: boolean;
  buildingTypeToPlace: string | null;
  cameraZoom: 1 | 2 | 3;        // 1=전경, 2=구역, 3=상세
  activePanel: 'build' | 'economy' | 'politics' | 'trade' | 'military' | null;
  minimapVisible: boolean;

  // Actions
  selectBuilding: (id: string | null) => void;
  enterBuildMode: (type: string) => void;
  exitBuildMode: () => void;
  setZoom: (level: 1 | 2 | 3) => void;
  setActivePanel: (panel: string | null) => void;
}
```

**Store 간 데이터 흐름**:
```
WebSocket (city_state 2Hz)
  → useCitySocket hook
    → cityStore.setCityState() / applyDelta()
    → politicsStore.setFactions()
  → React 컴포넌트 리렌더 (selector 기반)

User Interaction
  → isoUiStore (빌드 모드, 선택 등)
  → city_command 전송 (useCitySocket.sendCommand())
  → 서버 처리 → 다음 city_state에 반영
```

### 8.4 UI Components

UI는 PixiJS Canvas 위에 React DOM 오버레이로 구성한다 (기존 AR HUD 패턴과 동일).

#### 레이아웃 스펙

```
┌──────────────────────────────────────────────────────────────┐
│  TopMenu.tsx                                                  │
│  [Globe] [Economy] [Politics] [Military] [Edicts] [Trade]    │
│  h: 48px, position: fixed top, z-index: 100                  │
├──────────────────────────────────────────────────┬───────────┤
│                                                   │           │
│  ResourceHUD.tsx (상단 바, TopMenu 아래)           │           │
│  [💰 $125K] [🌾 320] [⚡ 45/60] [👥 180]         │ Building  │
│  h: 40px, position: fixed, z-index: 90            │ Info      │
│                                                   │ Panel.tsx │
│                                                   │           │
│              PixiJS IsoCanvas                     │ w: 320px  │
│              (100vw × 100vh)                      │ right: 0  │
│                                                   │ z: 80     │
│                                                   │           │
│                                                   │ - 건물 이름│
│              IsoMinimap.tsx                        │ - 생산량  │
│              (좌하단, 200×150px)                   │ - 노동자  │
│                                                   │ - 효율    │
│                                                   │ - 업그레이드│
├──────────────────────────────────────────────────┴───────────┤
│  BuildPanel.tsx (하단)                                        │
│  [카테고리 탭: 주거 | 산업 | 공공 | 정부 | 군사 | 관광]        │
│  [건물 아이콘 스크롤 리스트 — 이름 + 비용 + 요건]              │
│  h: 120px (펼침) / 48px (접힘), z-index: 100                 │
└──────────────────────────────────────────────────────────────┘
```

#### 주요 모달/오버레이

| Component | 트리거 | 내용 |
|-----------|--------|------|
| `EconomyDashboard.tsx` | TopMenu [Economy] | GDP 히스토리 차트, 수입/지출 파이, 무역 수지 |
| `PoliticsPanel.tsx` | TopMenu [Politics] | 파벌 8종 호감도 바, 최후통첩 경고, 선거 카운트다운 |
| `ElectionOverlay.tsx` | 선거 시작 이벤트 | 6단계 연설 선택지, 투표 진행 바, 결과 발표 |
| `TradePanel.tsx` | TopMenu [Trade] | 무역 노선 목록 + 개설 UI |
| `EdictPanel.tsx` | TopMenu [Edicts] | 시대별 칙령 목록, 비용/효과 미리보기, 시행/해제 |

#### 디자인 토큰 확장

기존 War Room 테마 (`lib/sketch-ui.ts`)를 아이소메트릭 UI에 맞게 확장:

```typescript
// lib/iso-ui.ts — Isometric UI 확장 토큰
export const ISO_TOKENS = {
  panel: {
    bg: 'rgba(17, 17, 17, 0.92)',      // 다크 반투명
    border: '#333',
    borderRadius: '8px',
  },
  resourceBar: {
    bg: 'rgba(0, 0, 0, 0.8)',
    positive: '#4A9E4A',                // 수입/증가
    negative: '#CC3333',                // 지출/감소
    neutral: '#CC9933',                 // 국고/일반
  },
  faction: {
    capitalist: '#FFD700',
    communist: '#DC143C',
    environment: '#228B22',
    industrialist: '#708090',
    religious: '#DAA520',
    militarist: '#8B0000',
    conservative: '#4169E1',
    progressive: '#9370DB',
  },
  happiness: {
    high: '#4A9E4A',    // ≥70
    medium: '#CC9933',  // 40~69
    low: '#CC3333',     // <40
  },
} as const;
```

## 9. Performance Budget

### 9.1 Server Performance Budget

| Metric | Budget | Strategy |
|--------|--------|----------|
| **전체 195국 틱 시간** | ≤100ms | 활성(~10국) 풀틱 + 비활성(~185국) 경량틱 병렬 처리 |
| **단일 국가 풀틱** | ≤5ms | 순차: 생산 0.5ms → 소비 0.3ms → 시민 FSM 2ms → 무역 0.5ms → GDP 0.2ms |
| **단일 국가 경량틱** | ≤0.5ms | 시민 FSM 스킵, 생산/무역/GDP만 계산 |
| **메모리 (전체)** | ≤2GB | 국가당 ~10MB (100 건물 × 1KB + 100 시민 × 2KB + 맵 × 3KB + 오버헤드) |
| **city_state 직렬화** | ≤1ms | JSON marshal, delta 모드 시 변경분만 |
| **동시접속** | 1,000 유저 | 각 유저 1국 구독, 나머지 AI 관리 |
| **WebSocket 대역폭** | ≤10KB/s per subscriber | delta + gzip (per-message deflate) |

**CPU 분배 예산** (10초 틱 주기):
```
활성 국가 (10국 × 5ms)     =   50ms
비활성 국가 (185국 × 0.5ms) =   92ms (60초 주기이므로 10초당 ~15ms)
city_state 직렬화 (10국)    =   10ms
Broadcaster 전송             =    5ms
─────────────────────────────────────
총 서버 부하 (10초당)        =  ~80ms (100ms 버짓 내)
```

### 9.2 Client Performance Budget

| Metric | Budget | Strategy |
|--------|--------|----------|
| **Iso 뷰 FPS** | 60fps (16.7ms/frame) | 뷰포트 culling, y-sort batch, 시민 LOD |
| **타일맵 렌더** | ≤2ms/frame | @pixi/tilemap batch rendering (S-tier 80×80=6,400 타일) |
| **건물 렌더** | ≤3ms/frame | y-sort 깊이 정렬, 변경 시만 재정렬 |
| **시민 렌더** | ≤4ms/frame | 줌아웃 시 dot(1px), 줌인 시 32×32 sprite, 화면 내만 |
| **파티클** | ≤2ms/frame | 최대 200 동시 파티클 |
| **React UI 리렌더** | ≤5ms | Zustand selector로 필요한 컴포넌트만 |
| **Globe→Iso 전환** | ≤1000ms | 200ms unmount delay + 800ms 로드/렌더 |
| **초기 번들 크기** | ≤200KB (Iso chunk) | dynamic import, tree-shaking |
| **LCP** | ≤2.5s | Globe 우선, Iso lazy load |

### 9.3 Pathfinding 성능

시민 이동 경로 탐색은 성능 병목 가능성이 높다.

| Strategy | 설명 |
|----------|------|
| **계층적 A*** | 맵을 8×8 구역으로 나눠 구역 간 경로 → 타일 간 경로 2단계 |
| **경로 캐시** | 자주 사용되는 경로 (집→직장) 캐시, 건물 변경 시 무효화 |
| **시간 분산** | 시민 전체를 한 틱에 경로 계산하지 않고 10 틱에 걸쳐 분산 |
| **직선 근사** | 도로가 직선 연결되면 A* 스킵, 맨해튼 거리 사용 |

```go
// 경로 계산 예산: 시민당 ≤50μs
// S-tier 500시민 중 매 틱 50명만 경로 재계산 = 50 × 50μs = 2.5ms
const PathfindBudgetPerCitizen = 50 * time.Microsecond
const PathfindBatchSize = 50  // 틱당 최대 경로 재계산 수
```

## 10. Security Considerations

### 10.1 명령 권한 검증

| 위협 | 공격 벡터 | 대응 |
|------|----------|------|
| 타국 조작 | 다른 유저의 국가에 city_command 전송 | Hub에서 `client.managingCountry == cmd.iso3` 검증 |
| 명령 위조 | 비정상 CityCommand payload | 서버 측 전수 검증 (타입, 범위, 논리적 유효성) |
| 속도 악용 | 초고속 건물 건설/파괴 반복 | Rate limiter: 10 cmd/s per client |
| 부정 선거 남용 | 과도한 `rig_election` | 1 선거당 1회, 비용 × 부정 규모, 파벌 반발 |
| 경제 조작 | 무역 가격 차익 거래 악용 | 서버에서 가격 결정, 클라이언트 제안 무시 |

### 10.2 WebSocket 보안

- 기존 `ConnLimiter` (IP당 초당 연결 수 제한) 유지
- `subscribe_city` 시 인증 검증 (기존 `agent_auth` 또는 세션 토큰)
- 구독 수 제한: 1 클라이언트 = 최대 1국 구독 (동시 다중 구독 차단)
- 메시지 크기 제한: city_command ≤ 4KB

### 10.3 서버 상태 무결성

- **단일 진실 원천**: 모든 게임 상태는 서버의 CitySimEngine에만 존재
- **클라이언트 예측 없음**: city_command → 서버 검증 → city_state 반영 (optimistic update 미사용)
- **틱 기반 정합성**: 모든 상태 변경은 Tick() 함수 내에서만 발생 (명령은 큐에 넣고 다음 틱에 처리)
- **뮤텍스 보호**: CitySimEngine.mu RWMutex로 동시 읽기/쓰기 방어

## 11. Scalability

### 11.1 195국 시뮬레이션 스케일링

| 문제 | 전략 | 상세 |
|------|------|------|
| 195국 동시 틱 CPU | **2-tier 틱 스케줄링** | 활성(유저 관리): 10초 풀틱, 비활성(AI): 60초 경량틱 |
| 시민 수 폭증 | **대리 비율 상한** | S-tier: max 500, D-tier: max 30, 합계 ~19,500 |
| 메모리 2GB 한계 | **경량 구조체** | CitizenAgent JSON 태그 최소화, PathCache 직렬화 제외 |
| 경로 계산 부하 | **분산 + 캐시** | 틱당 50명 배치, 집→직장 경로 캐시 |

### 11.2 구독자 스케일링

```
1,000 동시 유저 시나리오:
  - 활성 구독: ~1,000국 (유저당 1국)
    → 실제로 195국 중 ~50국이 인기 (미국, 한국 등)
    → 인기국 1개에 ~20명 구독 → 같은 city_state를 20명에게 전송
  - 대역폭: 1,000 × 10KB/s = 10MB/s (Railway 인스턴스 충분)
  - CPU: 195국 전체 활성 → 100ms 내 처리 (최악 시나리오)
```

### 11.3 수평 확장 (향후)

현재는 **단일 서버 인스턴스**로 195국 전체를 처리한다 (Go의 goroutine 활용).

향후 1,000+ 동시접속 초과 시 확장 전략:
1. **Region Sharding**: 대륙별 서버 분리 (아시아 50국, 유럽 50국 등)
2. **Hot/Cold 분리**: 활성 국가(유저 관리)만 메인 서버, 비활성 국가는 배치 서버
3. **Redis Pub/Sub**: 서버 간 Globe 상태 동기화
4. 현재 단계에서는 이러한 확장이 필요 없으므로 **YAGNI 원칙**으로 보류

## 12. Reliability

### 12.1 상태 복구

| 시나리오 | 전략 |
|---------|------|
| **서버 재시작** | 195국 CitySimEngine 상태를 JSON 파일로 주기적 스냅샷 (5분 간격). 재시작 시 최신 스냅샷에서 복원. |
| **클라이언트 재접속** | `subscribe_city` 재전송 → 서버에서 현재 CityClientState 풀 전송 → 클라이언트 상태 복원 |
| **WebSocket 끊김** | useSocket 기존 재연결 로직 유지 (exponential backoff). 재연결 시 자동 re-subscribe |
| **경제 틱 실패** | 틱 시작 전 상태 스냅샷 저장. 틱 중 panic → recover → 스냅샷 롤백 |

### 12.2 데이터 일관성

```go
// CitySimEngine.Tick() 내 트랜잭션 패턴
func (c *CitySimEngine) FullTick() {
    c.mu.Lock()
    defer c.mu.Unlock()

    // 스냅샷 (롤백용)
    snapshot := c.captureSnapshot()

    defer func() {
        if r := recover(); r != nil {
            slog.Error("city tick panic", "iso3", c.iso3, "err", r)
            c.restoreSnapshot(snapshot)
        }
    }()

    // 경제 틱 실행
    c.runProduction()
    c.consumeMaterials()
    c.processCitizens()
    c.payWages()
    c.payMaintenance()
    c.executeTrades()
    c.collectTax()
    c.computeGDP()
    c.syncToWorld()

    c.tickCount++
}
```

### 12.3 Graceful Degradation

| 부하 수준 | 대응 |
|----------|------|
| 정상 (CPU <50%) | 195국 전체 풀틱, 2Hz city_state |
| 중간 (CPU 50~80%) | 비활성 국가 틱 간격 120초로 확장 |
| 과부하 (CPU >80%) | city_state 빈도 1Hz로 감소, 시민 LOD 강제 저하 |
| 위험 (CPU >95%) | 신규 subscribe_city 거부, 기존 구독자만 유지 |

## 13. Observability

### 13.1 서버 메트릭

기존 `internal/observability/` 패키지 확장.

| Metric | Type | 설명 |
|--------|------|------|
| `city_tick_duration_ms` | Histogram | 국가별 틱 처리 시간 |
| `city_active_count` | Gauge | 활성 (유저 관리) 국가 수 |
| `city_subscriber_count` | Gauge | city_state 구독자 수 |
| `city_command_count` | Counter | 명령 타입별 처리 건수 |
| `city_command_error_count` | Counter | 명령 타입별 에러 건수 |
| `citizen_total_count` | Gauge | 전체 시민 에이전트 수 |
| `city_state_bytes` | Histogram | city_state 메시지 크기 |
| `pathfind_duration_us` | Histogram | 경로 계산 소요 시간 |
| `election_count` | Counter | 선거 실행 횟수 (성공/부정/패배) |
| `ultimatum_count` | Counter | 최후통첩 발동/충족/실패 횟수 |

### 13.2 클라이언트 메트릭

| Metric | 수집 방법 | 경고 임계 |
|--------|----------|----------|
| Iso FPS | PixiJS ticker.FPS | <30fps 경고 |
| city_state 지연 | 수신 timestamp - 서버 timestamp | >1초 경고 |
| WebSocket 재연결 | useSocket 재연결 카운터 | >3회/분 경고 |
| 번들 로드 시간 | Next.js Web Vitals | Iso chunk >3초 경고 |

### 13.3 로깅 전략

```go
// 구조적 로깅 (slog)
slog.Info("city tick completed",
    "iso3", c.iso3,
    "duration_ms", elapsed.Milliseconds(),
    "buildings", len(c.buildings),
    "citizens", len(c.citizens),
    "gdp", c.gdp,
    "mode", c.mode,
)

slog.Warn("city command rejected",
    "iso3", c.iso3,
    "client", clientID,
    "command", cmd.Type,
    "reason", err.Error(),
)
```

## 14. Architecture Decision Records (ADRs)

### ADR-040: PixiJS 8 for Isometric Rendering (over Three.js Orthographic)

**Status**: Accepted

**Context**: 195국의 아이소메트릭 도시를 렌더링할 기술 선택. 기존 Arena는 Three.js(R3F)를 사용하지만, 2D 타일맵은 다른 접근이 필요하다.

**Decision**: PixiJS 8 + @pixi/tilemap을 아이소메트릭 렌더러로 채택한다.

**Consequences**:
- (+) 2D 스프라이트 배치 렌더링이 Three.js orthographic보다 3~5배 빠름
- (+) @pixi/tilemap의 대규모 타일 최적화 (6,400 타일 = 1 draw call)
- (+) AI 생성 2D 스프라이트 에셋이 3D 모델보다 10배 빠르게 제작
- (+) 모바일 브라우저에서 60fps 유지 용이
- (-) R3F Globe와 동시 렌더링 불가 → mount/unmount 전환 필요
- (-) 3D 이펙트 (조명, 그림자, 파티클 3D)는 2D로 대체해야 함

**Alternatives**: Three.js OrthographicCamera (더 통일된 기술 스택이나 성능·에셋 비용에서 열세)

---

### ADR-041: Rule-based FSM for Citizen Agents (over LLM-based)

**Status**: Accepted

**Context**: 19,500 시민 에이전트의 행동 결정 방식. LLM 호출 vs 규칙 기반 FSM.

**Decision**: 규칙 기반 6-state FSM (Idle→Commuting→Working→Shopping→Resting→Protesting)을 채택한다. NationalAI(국가 전략)만 선택적 LLM 사용 가능.

**Consequences**:
- (+) 시민당 ≤50us 처리 (LLM: 100ms+ 불가능)
- (+) 결정론적 행동 → 밸런스 테스트 용이
- (+) 서버 비용 0 (LLM API 호출 없음)
- (-) Tropico보다 단순한 시민 행동 (패턴 예측 가능)
- (-) "창발적 행동" 부재

---

### ADR-042: 2-Tier Tick Scheduling (Active 10s / Inactive 60s)

**Status**: Accepted

**Context**: 195국 동시 시뮬을 100ms 틱 버짓 내에서 처리해야 한다.

**Decision**: 유저가 관리 중인 국가(활성)는 10초 풀틱, 나머지(비활성)는 60초 경량틱으로 차등 처리한다.

**Consequences**:
- (+) 활성 10국 × 5ms = 50ms, 비활성은 60초에 1회만 → CPU 여유
- (+) 비활성 국가의 시민 FSM 스킵 → 생산/무역만 경량 계산
- (-) 비활성 국가의 시민 행동이 덜 세밀함 (유저가 안 보므로 무관)
- (-) 비활성→활성 전환 시 시민 상태 보정 필요 (1회 풀 재계산)

---

### ADR-043: Server-Authoritative No Client Prediction (for City Commands)

**Status**: Accepted

**Context**: 건물 배치 등 city_command의 반영 방식. Optimistic update vs Server-authoritative.

**Decision**: Server-authoritative 방식 채택. 클라이언트는 명령 전송 후 다음 city_state(500ms)에서 반영된 결과를 수신한다.

**Consequences**:
- (+) 상태 불일치 0 (단일 진실 원천)
- (+) 부정행위 원천 차단 (검증 로직 서버에만)
- (+) 구현 단순 (롤백 로직 불필요)
- (-) 명령 반영까지 최대 500ms 지연 (체감적으로 수용 가능: 도시 경영은 실시간 전투가 아님)
- 완화: 클라이언트에서 건설 중 반투명 프리뷰를 즉시 표시 (UI-only hint)

---

### ADR-044: Arena Code Preservation (components/game/ar/)

**Status**: Accepted

**Context**: 기존 29개 AR* Arena 컴포넌트를 v26에서 어떻게 처리할지.

**Decision**: `components/game/ar/`는 삭제하지 않고 그대로 보존한다. v26 Isometric 뷰는 `components/game/iso/`에 완전 독립 구현한다.

**Consequences**:
- (+) 추후 Arena 전투를 전쟁 미니게임으로 부활 가능
- (+) 기존 코드 참조 가능 (렌더링 패턴, HUD 구조 등)
- (-) 코드베이스 크기 증가 (사용하지 않는 코드 유지)
- 완화: `ar/` 디렉토리에 `DEPRECATED.md` 추가하여 상태 명시

---

### ADR-045: Zustand 3-Store Split (city / politics / isoUi)

**Status**: Accepted

**Context**: 아이소메트릭 뷰의 클라이언트 상태 관리 전략.

**Decision**: 3개의 독립 Zustand store로 관심사를 분리한다: cityStore(서버 동기화), politicsStore(파벌/선거), isoUiStore(UI 인터랙션).

**Consequences**:
- (+) selector 기반 리렌더 최소화 (건물 변경 시 정치 UI 리렌더 방지)
- (+) 테스트 용이 (store별 독립 테스트)
- (+) 기존 Globe 관련 store와 충돌 없음
- (-) store 간 크로스 참조 시 약간의 복잡성 (subscribe로 해결)

## 15. Open Questions

| # | Question | Impact | Decision Needed By |
|---|----------|--------|-------------------|
| Q1 | PixiJS 8 + Next.js 15 App Router 호환성 검증 | 높음 | Phase 1 시작 전 PoC |
| Q2 | @pixi/tilemap v4 (PixiJS 8 호환) 안정성 | 높음 | Phase 1 타일맵 구현 시 |
| Q3 | 비활성→활성 전환 시 시민 상태 보정 알고리즘 세부 | 중간 | Phase 3 시민 시스템 |
| Q4 | Gemini AI 건물 스프라이트 스타일 일관성 보장 방법 | 중간 | Phase 7 에셋 생성 전 |
| Q5 | 경제 밸런스: 33종 자원 가격표 초기값 설정 | 중간 | Phase 2 경제 틱 구현 |
| Q6 | 모바일 터치 인터랙션: 핀치줌/롱프레스 상세 UX | 낮음 | Phase 4 UI 구현 |
| Q7 | 관전 모드(SpectateMode)에서 채팅/이모지 지원 여부 | 낮음 | Phase 8 관전 모드 |
| Q8 | 시즌 리셋 시 도시 상태 초기화 범위 (건물 유지? 전체 리셋?) | 높음 | 시즌 시스템 설계 시 |
| Q9 | NationalAI의 건설 우선순위 알고리즘 세부 (자원 분석 기반) | 중간 | Phase 8 NationalAI 연동 |
| Q10 | PixiJS WebGL context와 R3F WebGL context 동시 존재 시 메모리 이슈 | 높음 | Phase 1 PoC에서 검증 |
