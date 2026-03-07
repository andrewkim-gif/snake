# v15 System Architecture — 3D Globe Effects System

## Overview

v15 기획서(`v15-globe-effects-plan.md`)의 High-Level Blueprint를 받아, 3D 글로브 이펙트 시스템의 상세 구현 아키텍처를 정의한다. Go 서버의 인구 기반 에이전트 제한 공식, WS 프로토콜 확장, 클라이언트 R3F 컴포넌트 계층, 텍스처 아틀라스 파이프라인, 성능 최적화 전략까지 "어떻게, 어디에, 얼마나"를 설계한다.

**입력 기획서**: `docs/designs/v15-globe-effects-plan.md` (245줄, FR-1~8, NFR-1~4, Phase 1~6)
**프로젝트 타입**: GAME (Three.js / React Three Fiber)
**기존 코드베이스**: Go 서버(`server/internal/`), Next.js 클라이언트(`apps/web/`)

## Goals / Non-Goals

### Goals
- 195개국 국기 + 에이전트 수를 60fps로 InstancedMesh Billboard 렌더링
- 미사일/충격파/무역라인/이벤트파동 등 6종 신규 이펙트 컴포넌트 제공
- `TierConfigs.MaxAgents` + `CountrySeed.Population` 하이브리드 공식으로 국가별 에이전트 상한 미세 조정
- `domination_update` / `trade_route_update` WS S2C 이벤트 신규 정의 및 broadcast 연결
- 모바일 LOD로 저사양 디바이스에서도 30fps 이상 보장

### Non-Goals
- 3D 지구본 메시 교체 (EarthSphere/Atmosphere는 v14 그대로 유지)
- 블록체인 토큰 연동 (v15 범위 밖)
- 새로운 게임 메카닉 추가 (무기, 스킬트리 등 v14 유지)
- 서버 인프라 변경 (Railway/Vercel 배포 구조 동일)

## Architecture

### System Context (C4 Level 1)

```
┌──────────────────────────────────────────────────────────────────────┐
│                          사용자 (브라우저)                             │
│   3D Globe (R3F Canvas)                                              │
│   • 국가 국기+에이전트수 라벨 (GlobeCountryLabels)                   │
│   • 전쟁 미사일/충격파 이펙트 (GlobeMissileEffect, GlobeShockwave)   │
│   • 무역 루트 라인 (GlobeTradeRoutes)                                │
│   • 이벤트 파동 (GlobeEventPulse)                                    │
│   • 점령 색상 오버레이 (GlobeDominationLayer — 강화)                 │
│   • 전쟁 이펙트 (GlobeWarEffects — 강화)                             │
└─────────────────────────────┬────────────────────────────────────────┘
                              │ WebSocket (ws://)
                              │ • countries_state (1Hz, 기존+확장)
                              │ • domination_update (신규 이벤트)
                              │ • trade_route_update (신규 이벤트)
                              │ • war_declared / war_ended (기존)
                              │ • global_events (기존)
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       Go 서버 (server/)                              │
│   WorldManager → CountryArena → DominationEngine, WarSystem          │
│   TradeEngine → WS broadcast (신규)                                  │
│   country_data.go: TierConfigs + Population 하이브리드 maxAgents      │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    외부 리소스 (CDN)                                   │
│   flagcdn.com/w80/{iso2}.png — 195개국 국기 이미지                    │
│   (폴백: iso2ToFlag() 이모지 → Canvas drawText)                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Container Diagram (C4 Level 2)

```
┌─── Go Server Container ───────────────────────────────────────────────────────┐
│                                                                               │
│  ┌─ world/ ──────────────────┐   ┌─ game/ ─────────────────────────────────┐ │
│  │ country_data.go           │   │ domination.go                           │ │
│  │  • TierConfigs (AS-IS)    │   │  • DominationEngine.OnEvent callback    │ │
│  │  • CountrySeed.Population │   │  • emitEvent() → domination_update WS   │ │
│  │  • CalcMaxAgents() (NEW)  │   │                                         │ │
│  │                           │   │ country_arena.go                        │ │
│  │ world_manager.go          │   │  • SetDominationCallback() (NEW)        │ │
│  │  • CountryBroadcastState  │   │  • JoinCountryArena: maxAgents check    │ │
│  │    + MaxAgents, Population│   │                                         │ │
│  │  • broadcastCountryState  │   │ war.go (기존)                           │ │
│  │    1Hz, 확장 필드 포함     │   │  • war_declared, war_ended broadcast    │ │
│  └───────────────────────────┘   └─────────────────────────────────────────┘ │
│                                                                               │
│  ┌─ meta/ ───────────────────┐   ┌─ ws/ ───────────────────────────────────┐ │
│  │ trade.go                  │   │ protocol.go                             │ │
│  │  • TradeEngine.SetHub()   │   │  • EventDominationUpdate (NEW)          │ │
│  │  • executeTrade() →       │   │  • EventTradeRouteUpdate (NEW)          │ │
│  │    trade_route_update WS  │   │  • DominationUpdateMsg struct (NEW)     │ │
│  │  • REST 유지 + WS 병행    │   │  • TradeRouteUpdateMsg struct (NEW)     │ │
│  └───────────────────────────┘   └─────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────────────┘

┌─── Next.js Client Container ──────────────────────────────────────────────────┐
│                                                                               │
│  ┌─ hooks/ ──────────────────┐   ┌─ lib/ ──────────────────────────────────┐ │
│  │ useSocket.ts              │   │ globe-data.ts                           │ │
│  │  • UiState 확장:          │   │  • CountryClientState + maxAgents,      │ │
│  │    tradeRoutes[]          │   │    population 필드                       │ │
│  │  • domination_update 핸들 │   │  • featureToCountryState() POP_EST 파싱 │ │
│  │  • trade_route_update 핸들│   │                                         │ │
│  └───────────────────────────┘   │ flag-atlas.ts (NEW)                     │ │
│                                  │  • FlagAtlasLoader class                │ │
│  ┌─ components/3d/ (NEW) ────┐   │  • loadAllFlags() → CanvasTexture      │ │
│  │ GlobeCountryLabels.tsx    │   │  • getUV(iso2) → [u,v,w,h]             │ │
│  │ GlobeMissileEffect.tsx    │   └─────────────────────────────────────────┘ │
│  │ GlobeShockwave.tsx        │                                               │
│  │ GlobeTradeRoutes.tsx      │   ┌─ components/3d/ (EXTENDED) ─────────────┐ │
│  │ GlobeEventPulse.tsx       │   │ GlobeDominationLayer.tsx                │ │
│  └───────────────────────────┘   │  • +uTransitionWave uniform            │ │
│                                  │  • +해칭 패턴 셰이더                    │ │
│  ┌─ components/lobby/ ───────┐   │  • +점령 완료 플래시                    │ │
│  │ GlobeView.tsx             │   │                                         │ │
│  │  • GlobeScene 확장:       │   │ GlobeWarEffects.tsx                     │ │
│  │    신규 컴포넌트 마운트    │   │  • +전장 안개 파티클                    │ │
│  │    countryStates/trades/  │   │  • +승리 파티클 300개 강화              │ │
│  │    domination props 전달  │   │  • +전쟁 선포 카메라 연출               │ │
│  └───────────────────────────┘   └─────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────────────┘
```

### Component Design (C4 Level 3)

#### Go Server — Internal Components

```
world/country_data.go
├── TierConfigs map[CountryTier]TierConfig  (AS-IS: S:50, A:35, B:25, C:15, D:8)
├── CountrySeed.Population int64            (AS-IS: 195개국 인구)
└── CalcMaxAgents(tier, population) int     (NEW: 하이브리드 공식)
    공식: floor(TierMax * clamp(log10(pop/1e6) / log10(tierRefPop/1e6), 0.3, 1.0))
    최소 보장: max(result, 5)
    Tier별 tierRefPop: S=330M, A=100M, B=50M, C=20M, D=5M

world/world_manager.go
├── CountryBroadcastState (EXTENDED)
│   ├── ISO3, BattleStatus, SovereignFaction, SovereigntyLevel  (기존)
│   ├── ActiveAgents, SpectatorCount                              (기존)
│   ├── MaxAgents int      `json:"maxAgents"`                     (NEW)
│   └── Population int64   `json:"population"`                    (NEW)
└── broadcastCountryStates()  — MaxAgents, Population 필드 추가

game/domination.go
├── DominationEngine (AS-IS)
│   └── OnEvent func(DominationEvent) — 현재 nil
└── emitEvent() → OnEvent 콜백 호출 (AS-IS, 연결만 필요)

game/country_arena.go (EXTENDED)
├── initDomination() (NEW: DominationEngine.OnEvent 콜백 설정)
│   └── OnEvent = func(evt) { hub.Broadcast("domination_update", msg) }
└── JoinCountryArena() (EXTENDED: maxAgents >= activeAgents 시 arena_full 에러)

meta/trade.go (EXTENDED)
├── TradeEngine.Hub *ws.Hub  (NEW: WS 허브 참조)
├── SetHub(hub) (NEW)
└── executeTrade() (EXTENDED: 기존 REST + trade_route_update WS broadcast 추가)

ws/protocol.go (EXTENDED)
├── EventDominationUpdate = "domination_update"   (NEW)
├── EventTradeRouteUpdate = "trade_route_update"   (NEW)
├── DominationUpdateMsg struct                     (NEW)
└── TradeRouteUpdateMsg struct                     (NEW)
```

#### Client — R3F Component Tree

```
GlobeView (components/lobby/GlobeView.tsx)
├── props: countryStates, dominationStates, wars, countryCentroids,
│          tradeRoutes (NEW), onHover, onCountryClick
│
└── <Canvas> → GlobeScene (EXTENDED)
    ├── props: 상위 모두 전달 + flagAtlas (NEW)
    │
    ├── [기존 유지]
    │   ├── <SunLight />
    │   ├── <Starfield />
    │   ├── <EarthSphere />
    │   ├── <AtmosphereGlow />
    │   ├── <GlobeTitle />
    │   ├── <CountryBorders />
    │   ├── <CountryPolygons />
    │   ├── <CountryLabels />  ← 기존 국가명 텍스트 라벨 (유지)
    │   ├── <HoverBorderGlow />
    │   ├── <GlobeInteraction />
    │   └── <AdaptiveOrbitControls />
    │
    ├── [기존 확장]
    │   ├── <GlobeDominationLayer />     ← 셰이더 강화 (해칭, 플래시, 전환 웨이브)
    │   └── <GlobeWarEffects />          ← 전장 안개, 승리 파티클 강화, 선포 카메라
    │
    └── [신규 컴포넌트]
        ├── <GlobeCountryLabels />       ← 국기+에이전트수 InstancedMesh Billboard
        ├── <GlobeMissileEffect />       ← 미사일 궤적 (포물선 + 꼬리 파티클)
        ├── <GlobeShockwave />           ← 충격파 링 (RingGeometry + 감쇠)
        ├── <GlobeTradeRoutes />         ← 무역 라인 (베지어 + 화물 스프라이트)
        └── <GlobeEventPulse />          ← 이벤트 파동 (동맹/정책/에포크/휴전)
```

### Data Flow

#### Flow 1: 에이전트 수 + 국기 라벨 (1Hz 주기)

```
Server: WorldManager.broadcastCountryStates() [1Hz tick]
  → CountryBroadcastState { iso3, activeAgents, maxAgents(NEW), population(NEW), ... }
  → ws.Hub.Broadcast("countries_state", payload)
     │
     ▼ WebSocket
Client: useSocket.ts
  → socket.on("countries_state") → setUiState({ countryStates: Map<iso3, CountryClientState> })
     │
     ▼ React props
page.tsx → WorldView → GlobeView(countryStates) → GlobeScene(countryStates)
  → <GlobeCountryLabels countryStates={countryStates} dominationStates={...} flagAtlas={...} />
     │
     ▼ useFrame (매 프레임)
GlobeCountryLabels:
  1. countryStates에서 각 국가별 activeAgents / maxAgents 추출
  2. dominationStates에서 점유국 ISO2 → flagAtlas UV 매핑
  3. InstancedMesh Billboard로 국기 + "12/50" 텍스트 렌더
  4. LOD: 카메라 거리 기반 (근거리: 국기+숫자+국명, 중거리: 국기+숫자, 원거리: 숫자만)
```

#### Flow 2: 점령 이펙트 (이벤트 기반)

```
Server: DominationEngine.evaluate() → emitEvent(DominationEvent)
  → OnEvent callback (country_arena.go에서 설정)
  → ws.Hub.Broadcast("domination_update", DominationUpdateMsg)
     │
     ▼ WebSocket
Client: useSocket.ts
  → socket.on("domination_update") → setUiState({ dominationStates: Map 업데이트 })
     │
     ▼ React props (두 컴포넌트에 동시 전달)
GlobeDominationLayer:                    GlobeCountryLabels:
  • 색상 오버레이 전환                      • 점유국 국기로 UV 스왑
  • 골드 펄스 웨이브 (sovereignty→hegemony)   • 라벨 텍스트 업데이트
  • 분쟁 해칭 패턴
  • 점령 완료 플래시
```

#### Flow 3: 전쟁 이펙트 (이벤트 기반)

```
Server: WarSystem → ws.Hub.Broadcast("war_declared", WarDeclaredMsg)
     │
     ▼ WebSocket
Client: useSocket.ts
  → socket.on("war_declared") → setUiState({ wars: [...prev, newWar] })
     │
     ▼ React props (3개 컴포넌트에 분산)
GlobeWarEffects (기존 강화):        GlobeMissileEffect (신규):       GlobeShockwave (신규):
  • 아크 라인 (기존)                  • 포물선 궤적 InstancedMesh       • 착탄 시 RingGeometry
  • 영토 깜빡임 (기존)                • 꼬리 파티클 + 발광 헤드          • 0.8초 확산→소멸
  • 전장 안개 파티클 (NEW)            • missile-glow.png 텍스처         • shockwave-ring.png 텍스처
  • 승리 불꽃놀이 강화 (NEW)          • 최대 10발 동시                   • 착탄 콜백으로 트리거
  • 전쟁 선포 카메라 (NEW)
```

#### Flow 4: 무역 루트 (이벤트 기반)

```
Server: TradeEngine.executeTrade() → 기존 REST 응답 + WS broadcast
  → ws.Hub.Broadcast("trade_route_update", TradeRouteUpdateMsg)
     │
     ▼ WebSocket
Client: useSocket.ts
  → socket.on("trade_route_update") → setUiState({ tradeRoutes: [...prev, newRoute] })
     │
     ▼ React props
GlobeTradeRoutes:
  • 해상(sea): 파란 점선 베지어 곡선
  • 육상(land): 초록 실선 베지어 곡선
  • 라인 위 이동 화물 스프라이트 애니메이션
  • lineWidth: trade volume (1~4), opacity: 거래 빈도 (0.3~1.0)
```

#### Flow 5: 글로벌 이벤트 파동 (이벤트 기반)

```
Server: EventEngine/AllianceManager/PolicyEngine → global_events WS (기존)
     │
     ▼ WebSocket
Client: useSocket.ts
  → socket.on("global_events") → setUiState({ globalEvents: [...prev, newEvt] })
     │
     ▼ React props
GlobeEventPulse:
  • 이벤트 큐에서 순차 소비 (최대 3개 동시, FIFO 대기열)
  • 동맹(파란 링), 정책(보라 파동), 에포크(골드 웨이브)
  • 휴전(백색 올리브 링), 무역 금수(적색 X)
  • centroid → RingGeometry 확산 2초→소멸
```

## API Design

### WebSocket Protocol Extensions

#### 신규 이벤트 정의 (`ws/protocol.go` 추가)

| 방향 | 이벤트명 | 페이로드 | 빈도 |
|------|---------|---------|------|
| S→C | `domination_update` | `DominationUpdateMsg` | 이벤트 기반 (DominationEngine.emitEvent 시) |
| S→C | `trade_route_update` | `TradeRouteUpdateMsg` | 이벤트 기반 (TradeEngine.executeTrade 시) |

#### 기존 이벤트 확장

| 방향 | 이벤트명 | 변경사항 | 빈도 |
|------|---------|---------|------|
| S→C | `countries_state` | `CountryBroadcastState`에 `maxAgents int`, `population int64` 필드 추가 | 1Hz (기존) |
| S→C | `war_declared` | 변경 없음, GlobeMissileEffect/GlobeShockwave에서 추가 소비 | 이벤트 기반 |
| S→C | `war_ended` | 변경 없음, 승리 파티클 강화 트리거 | 이벤트 기반 |
| S→C | `global_events` | 변경 없음, GlobeEventPulse에서 추가 소비 | 이벤트 기반 |
| C→S | `join_country_arena` | `arena_full` 에러 응답 추가 (maxAgents 초과 시) | 이벤트 기반 |

#### 프로토콜 상수 추가 (`ws/protocol.go`)

```go
// v15: Globe effects events (S→C)
const (
    EventDominationUpdate = "domination_update"
    EventTradeRouteUpdate = "trade_route_update"
)
```

### Server-Side API

#### CalcMaxAgents 하이브리드 공식 (`world/country_data.go`)

```go
// CalcMaxAgents computes the population-adjusted max agents within the tier range.
// Formula: floor(tierMax * clamp(log10(pop/1e6) / log10(tierRefPop/1e6), 0.3, 1.0))
// Minimum guarantee: max(result, 5)
func CalcMaxAgents(tier CountryTier, population int64) int {
    cfg := TierConfigs[tier]
    tierRefPop := tierReferencePop[tier]  // S:330M, A:100M, B:50M, C:20M, D:5M

    if population <= 0 {
        return max(int(float64(cfg.MaxAgents) * 0.3), 5)
    }

    ratio := math.Log10(float64(population)/1e6) / math.Log10(float64(tierRefPop)/1e6)
    clamped := math.Max(0.3, math.Min(1.0, ratio))
    result := int(math.Floor(float64(cfg.MaxAgents) * clamped))
    return max(result, 5)
}

// tierReferencePop: population at which a country gets 100% of tier maxAgents
var tierReferencePop = map[CountryTier]int64{
    TierS: 330_000_000,  // USA baseline
    TierA: 100_000_000,
    TierB:  50_000_000,
    TierC:  20_000_000,
    TierD:   5_000_000,
}
```

**검증 테이블 (5개국 샘플):**

| 국가 | Tier | Population | TierMax | Ratio | Clamped | Result |
|------|------|-----------|---------|-------|---------|--------|
| USA  | S    | 331M      | 50      | 1.00  | 1.0     | **50** |
| KOR  | A    | 52M       | 35      | 0.86  | 0.86    | **30** |
| NZL  | B    | 5.1M      | 25      | 0.42  | 0.42    | **10** |
| LUX  | C    | 0.65M     | 15      | -0.14 | 0.3     | **5**  |
| VAT  | D    | 0.0008M   | 8       | -4.6  | 0.3     | **5** (최소보장) |

#### JoinCountryArena 거부 로직 (`game/country_arena.go`)

```go
// JoinCountryArena에 maxAgents 체크 추가
func (ca *CountryArena) JoinCountryArena(playerID string) error {
    maxAgents := CalcMaxAgents(ca.Tier, ca.Seed.Population)
    if ca.ActiveAgentCount() >= maxAgents {
        return &ArenaFullError{
            CountryCode: ca.CountryCode,
            MaxAgents:   maxAgents,
            Current:     ca.ActiveAgentCount(),
        }
    }
    // ... 기존 join 로직
}
```

#### DominationEngine 콜백 연결 (`game/country_arena.go`)

```go
// initDomination은 CountryArena 생성 시 DominationEngine.OnEvent를 WS broadcast에 연결
func (ca *CountryArena) initDomination(hub *ws.Hub) {
    ca.Domination.OnEvent = func(evt DominationEvent) {
        msg := ws.DominationUpdateMsg{
            Countries: []ws.DominationCountryData{{
                CountryCode:   evt.CountryCode,
                DominantNation: evt.Nation,
                Status:        string(evt.Status),
                Level:         evt.Level,
            }},
        }
        hub.BroadcastToAll(EventDominationUpdate, msg)
    }
}
```

#### TradeEngine WS broadcast (`meta/trade.go`)

```go
// SetHub injects the WS hub reference for real-time trade route updates.
func (te *TradeEngine) SetHub(hub *ws.Hub) {
    te.hub = hub
}

// executeTrade() 내부 — 기존 REST 응답 후 추가:
if te.hub != nil {
    msg := ws.TradeRouteUpdateMsg{
        From:     execution.SellerFaction,  // ISO3 of seller country
        To:       execution.BuyerFaction,   // ISO3 of buyer country
        Type:     string(execution.RouteType),
        Volume:   execution.Quantity,
        Resource: string(execution.Resource),
    }
    te.hub.BroadcastToAll(EventTradeRouteUpdate, msg)
}
```

## Data Model

### Server Data Structures (Go)

#### CountryBroadcastState 확장 (`world/world_manager.go`)

```go
// CountryBroadcastState — v15 확장
type CountryBroadcastState struct {
    ISO3             string `json:"iso3"`
    BattleStatus     string `json:"battleStatus"`
    SovereignFaction string `json:"sovereignFaction"`
    SovereigntyLevel int    `json:"sovereigntyLevel"`
    ActiveAgents     int    `json:"activeAgents"`
    SpectatorCount   int    `json:"spectatorCount"`
    // v15 NEW fields
    MaxAgents        int    `json:"maxAgents"`
    Population       int64  `json:"population"`
}
```

#### WS 메시지 구조체 (`ws/protocol.go`)

```go
// DominationUpdateMsg — domination_update S2C payload
type DominationUpdateMsg struct {
    Countries []DominationCountryData `json:"countries"`
}

type DominationCountryData struct {
    CountryCode    string `json:"countryCode"`
    DominantNation string `json:"dominantNation"`
    Status         string `json:"status"`        // "none", "sovereignty", "hegemony"
    Level          int    `json:"level"`          // 0-2 (none, sov, heg)
}

// TradeRouteUpdateMsg — trade_route_update S2C payload
type TradeRouteUpdateMsg struct {
    From     string `json:"from"`      // ISO3 seller country
    To       string `json:"to"`        // ISO3 buyer country
    Type     string `json:"type"`      // "sea" | "land"
    Volume   int64  `json:"volume"`    // trade quantity
    Resource string `json:"resource"`  // "oil" | "minerals" | "food" | "tech" | "manpower"
}
```

#### ArenaFullError 구조체 (`game/country_arena.go`)

```go
type ArenaFullError struct {
    CountryCode string
    MaxAgents   int
    Current     int
}

func (e *ArenaFullError) Error() string {
    return fmt.Sprintf("arena %s full: %d/%d agents", e.CountryCode, e.Current, e.MaxAgents)
}
```

### Client Data Structures (TypeScript)

#### CountryClientState 확장 (`lib/globe-data.ts`)

```typescript
export interface CountryClientState {
  // ... 기존 필드 유지 ...
  activeAgents: number;
  // v15 NEW
  maxAgents: number;       // CalcMaxAgents 결과 (서버에서 수신)
  population: number;      // CountrySeed.Population (서버에서 수신)
}
```

#### featureToCountryState POP_EST 파싱 (`lib/globe-data.ts`)

```typescript
// v15: GeoJSON POP_EST 필드 파싱
export function featureToCountryState(feature: GeoJSONFeature): CountryClientState {
  const props = feature.properties;
  // ... 기존 로직 ...
  return {
    // ... 기존 필드 ...
    activeAgents: 0,
    maxAgents: 0,          // 서버 countries_state에서 덮어씀
    population: (props.POP_EST as number) || 0,
  };
}
```

#### UiState 확장 (`hooks/useSocket.ts`)

```typescript
export interface UiState {
  // ... 기존 필드 유지 ...
  // v15 NEW: trade route visualization
  tradeRoutes: TradeRouteData[];
}

// v15 NEW
export interface TradeRouteData {
  from: string;       // ISO3
  to: string;         // ISO3
  type: 'sea' | 'land';
  volume: number;
  resource: string;
  timestamp: number;  // 클라이언트 수신 시각 (TTL 관리용)
}
```

#### FlagAtlasLoader (`lib/flag-atlas.ts` — 신규 파일)

```typescript
export interface FlagAtlasResult {
  texture: THREE.CanvasTexture;
  getUV: (iso2: string) => [u: number, v: number, w: number, h: number];
  loaded: number;
  total: number;
}

export class FlagAtlasLoader {
  private static ATLAS_W = 2048;
  private static ATLAS_H = 2048;
  private static FLAG_W = 80;
  private static FLAG_H = 60;
  private static COLS = Math.floor(2048 / 80);  // 25
  private static ROWS = Math.floor(2048 / 60);  // 34 (195개국 수용)

  // 로드 순서 → UV 위치 매핑
  private uvMap = new Map<string, [number, number, number, number]>();

  async loadAll(iso2List: string[], onProgress?: (loaded: number) => void): Promise<FlagAtlasResult>;
  // 상세 구현은 Component Architecture 섹션 참조
}
```

#### GlobeViewProps 확장 (`components/lobby/GlobeView.tsx`)

```typescript
interface GlobeViewProps {
  // ... 기존 props 유지 ...
  // v15 NEW
  tradeRoutes?: TradeRouteData[];
  flagAtlas?: FlagAtlasResult | null;
}
```

## Component Architecture

### New Components

#### 1. FlagAtlasLoader (`lib/flag-atlas.ts`)

**책임**: flagcdn.com에서 195개국 국기 PNG를 비동기 로드 → 2048x2048 Canvas 아틀라스 합성 → CanvasTexture 반환

```typescript
// 로드 파이프라인
class FlagAtlasLoader {
  async loadAll(iso2List: string[], onProgress?: (n: number) => void): Promise<FlagAtlasResult> {
    // 1. OffscreenCanvas 또는 HTMLCanvasElement 2048×2048 생성
    const canvas = document.createElement('canvas');
    canvas.width = 2048; canvas.height = 2048;
    const ctx = canvas.getContext('2d')!;

    // 2. 병렬 로드 (최대 10개 동시, Promise.allSettled)
    //    URL: `https://flagcdn.com/w80/${iso2}.png`
    //    실패 시: iso2ToFlag() 이모지를 ctx.fillText()로 Canvas에 렌더

    // 3. 로드된 이미지를 그리드 배치 (col=i%25, row=floor(i/25))
    //    ctx.drawImage(img, col*80, row*60, 80, 60)

    // 4. uvMap에 iso2 → [u, v, w, h] 정규화 좌표 저장
    //    u = col*80/2048, v = 1 - (row+1)*60/2048  (Three.js UV는 하단 기준)
    //    w = 80/2048, h = 60/2048

    // 5. CanvasTexture 생성 + needsUpdate = true
    return { texture, getUV: (iso2) => this.uvMap.get(iso2) ?? [0,0,0,0], loaded, total: 195 };
  }
}
```

**에러 폴백 체인**: CDN 이미지 로드 실패 → `iso2ToFlag(iso2)` 이모지 drawText → 단색 사각형 (국가 색상)

#### 2. GlobeCountryLabels (`components/3d/GlobeCountryLabels.tsx`)

**책임**: 각 국가 centroid에 점유국 국기 + "12/50" 에이전트 수를 InstancedMesh Billboard로 렌더

```typescript
interface GlobeCountryLabelsProps {
  countryCentroids: Map<string, [number, number]>;  // iso3 → [lat, lng]
  countryStates: Map<string, CountryClientState>;
  dominationStates: Map<string, CountryDominationState>;
  flagAtlas: FlagAtlasResult;
  globeRadius?: number;
}

// 구현 전략:
// 1. InstancedMesh (PlaneGeometry, 195 instances) — 국기 텍스처
//    - attribute: instanceUV (vec4) — flagAtlas.getUV(점유국iso2)
//    - material: ShaderMaterial (아틀라스 샘플링 + Billboard 회전)
//
// 2. InstancedMesh (PlaneGeometry, 195 instances) — 에이전트 수 텍스트
//    - 별도 CanvasTexture에 "12/50" 텍스트를 195칸 사전 렌더
//    - 데이터 변경 시 해당 칸만 ctx.clearRect + fillText + texture.needsUpdate
//
// 3. LOD 시스템 (useFrame 내):
//    - 카메라 거리 < 200: 국기(32px) + 숫자 + 국명 (3열)
//    - 카메라 거리 200~400: 국기(24px) + 숫자 (2열)
//    - 카메라 거리 > 400: 숫자만 (1열, 상위 50개국만)
//
// 4. 뒷면 오클루전: centroid normal · camera direction < 0.05 → instanceMatrix scale=0
//
// 5. dominationStates 변경 시 → 해당 국가 instanceUV를 점유국 국기 UV로 교체
```

#### 3. GlobeMissileEffect (`components/3d/GlobeMissileEffect.tsx`)

**책임**: 공격국→방어국 미사일 궤적 애니메이션 (포물선 + 꼬리 파티클 + 발광 헤드)

```typescript
interface GlobeMissileEffectProps {
  wars: WarEffectData[];
  countryCentroids: Map<string, [number, number]>;
  globeRadius?: number;
  onImpact?: (targetIso3: string, position: THREE.Vector3) => void;  // GlobeShockwave 트리거
}

// 구현 전략:
// 1. InstancedMesh (CylinderGeometry 0.3×2, MAX_MISSILES=10)
//    - 미사일 풀: useRef<MissileState[]>(new Array(10)) — { active, progress, from, to }
//    - useFrame: progress += delta * speed → 포물선 위치 계산
//      position = lerp(from, to, t) + normal * sin(π*t) * arcHeight
//    - missile-glow.png 텍스처 (AdditiveBlending)
//
// 2. 꼬리 파티클: 별도 InstancedMesh (SphereGeometry 0.1, MAX_TRAIL=50)
//    - 미사일 위치 히스토리 링버퍼 → 뒤따르는 파티클
//    - opacity: 1.0 → 0.0 (나이에 따라 감쇠)
//
// 3. 발사 트리거: wars 배열에 state='active' 신규 진입 시
//    - 공격국 centroid → 방어국 centroid 미사일 생성 (풀에서 꺼냄)
//    - 비행 시간: 2초 (globeRadius * 0.02)
//
// 4. 착탄 시: onImpact(defenderIso3, impactPosition) 콜백
```

#### 4. GlobeShockwave (`components/3d/GlobeShockwave.tsx`)

**책임**: 미사일 착탄 시 충격파 링 확산 애니메이션

```typescript
interface GlobeShockwaveProps {
  // 직접 props 없음 — ref를 통한 imperative trigger
}

// trigger(position: THREE.Vector3) → 외부에서 호출
// 구현 전략:
// 1. 풀: useRef<ShockwaveState[]>(new Array(5)) — { active, progress, position, startTime }
// 2. RingGeometry (innerRadius=0, outerRadius=0) → useFrame에서 확장
//    - 0.8초 동안: outerRadius 0→globeRadius*0.3, innerRadius 0→outerRadius*0.8
//    - opacity: 1.0→0.0 (easeOutQuad)
// 3. shockwave-ring.png 텍스처 + AdditiveBlending
// 4. 구체 표면 탄젠트 평면에 정렬 (lookAt(0,0,0) + 반전)
// 5. 풀 소진 시 가장 오래된 것 재활용 (ring buffer)
```

#### 5. GlobeTradeRoutes (`components/3d/GlobeTradeRoutes.tsx`)

**책임**: 교역국 간 베지어 곡선 라인 + 화물 스프라이트 애니메이션

```typescript
interface GlobeTradeRoutesProps {
  tradeRoutes: TradeRouteData[];
  countryCentroids: Map<string, [number, number]>;
  globeRadius?: number;
}

// 구현 전략:
// 1. 라인: Line2 (three/examples/lines)
//    - 해상(sea): #4488ff 파란색 + LineDashedMaterial (dashSize=2, gapSize=1)
//    - 육상(land): #44aa44 초록색 + LineBasicMaterial (실선)
//    - 베지어 곡선: from → control(midpoint + normal*height) → to
//    - lineWidth: clamp(volume/100, 1, 4)
//    - opacity: clamp(volume/500, 0.3, 1.0)
//
// 2. 화물 스프라이트: InstancedMesh (SphereGeometry 0.5, MAX_CARGO=20)
//    - useFrame: t = (time % 4) / 4 → 베지어 위치 계산
//    - 색상: 리소스 유형별 (oil=검정, minerals=회색, food=초록, tech=파랑, manpower=주황)
//
// 3. TTL 관리: tradeRoutes에 timestamp 기준 60초 후 페이드아웃→제거
//    - useFrame에서 age 계산, age > 60 → opacity *= (1 - (age-60)/5)
//
// 4. 최대 동시 표시: 20개 (초과 시 가장 오래된 것 교체)
```

#### 6. GlobeEventPulse (`components/3d/GlobeEventPulse.tsx`)

**책임**: 글로벌 이벤트 시 centroid에서 확산하는 색상 링 이펙트

```typescript
interface GlobeEventPulseProps {
  globalEvents: Array<{ id: string; type: string; message: string; timestamp: number }>;
  countryCentroids: Map<string, [number, number]>;
  globeRadius?: number;
  onCameraTarget?: (position: THREE.Vector3) => void;
}

// 이벤트 유형별 색상 매핑:
const EVENT_COLORS: Record<string, THREE.Color> = {
  alliance:      new THREE.Color('#4488ff'),   // 동맹: 파란 링
  policy_change: new THREE.Color('#8844ff'),   // 정책: 보라 파동
  epoch_end:     new THREE.Color('#ffcc00'),   // 에포크: 골드 웨이브
  truce:         new THREE.Color('#ccddaa'),   // 휴전: 올리브 링
  embargo:       new THREE.Color('#ff3333'),   // 금수: 적색 X
};

// 구현 전략:
// 1. 이벤트 큐: useRef<PulseState[]> — FIFO, 최대 3개 동시 활성
//    - 신규 이벤트 → 큐 push. 활성 < 3이면 즉시 시작, 아니면 대기
// 2. 링 이펙트: RingGeometry (풀 5개)
//    - 2초 확산: outerRadius 0→globeRadius*0.2
//    - opacity 1.0→0.0 (easeOutCubic)
//    - 색상: EVENT_COLORS[type] ?? 흰색
// 3. 금수(embargo) 특수: 링 대신 X 마크 (두 개의 교차 PlaneGeometry)
// 4. 완료 시 풀 반환 + 대기열에서 다음 이벤트 시작
```

### Extended Components

#### GlobeDominationLayer 셰이더 강화 (`components/3d/GlobeDominationLayer.tsx`)

**현재**: 국가별 색상 오버레이, sovereignty 펄스, hegemony 글로우
**추가**:

```glsl
// Fragment Shader 확장 — 3가지 신규 이펙트

// 1. 골드 전환 웨이브 (sovereignty→hegemony)
uniform float uTransitionWave;  // 0.0→1.0 (3초 전환)
// 적용: hegemony 달성 시 골드(#ffd700) 웨이브가 centroid에서 경계로 확산
// 계산: distance(fragUV, centroidUV) < uTransitionWave * maxDist → mix(currentColor, gold, wave)

// 2. 분쟁 해칭 패턴 (2개국 이상 경합)
uniform float uDisputeIntensity;  // 0.0=평화, 1.0=분쟁
// 적용: fract((uv.x + uv.y) * 20.0) > 0.5 → 대각선 스트라이프
// 색상: 기존 색상과 다크 색상 교차

// 3. 점령 완료 플래시
uniform float uFlashIntensity;  // 1.0→0.0 (3초 감쇠)
// 적용: finalColor = mix(finalColor, vec3(1.0), uFlashIntensity * 0.6)
```

**Uniform 업데이트** (`updateMeshUniforms` 함수 확장):
- `uTransitionWave`: dominationStates에서 sovereignty→hegemony 전환 감지 시 0→1 (3초 lerp)
- `uDisputeIntensity`: 해당 국가에 2개 이상 faction이 경합 중이면 1.0
- `uFlashIntensity`: hegemony 달성 이벤트 수신 시 1.0 → useFrame에서 delta로 감쇠

#### GlobeWarEffects 강화 (`components/3d/GlobeWarEffects.tsx`)

**현재**: WarArcLine, TerritoryBlink, ExplosionParticles, VictoryFireworks
**추가**:

```typescript
// 1. 전장 안개 파티클 (WarFog)
// - 양국 centroid 중간점에 war-fog.png 기반 붉은 안개 20개 InstancedMesh
// - 느린 회전 (0.1 rad/s), 스케일 펄스, 반투명 (opacity 0.3)
// - 전쟁 state='active' 동안만 표시

// 2. 승리 파티클 강화 (VictoryFireworks 확장)
// - 파티클 100→300개
// - 색상: gold + 점유국 NATION_COLORS 혼합
// - 3단계 분출: t=0s (100개), t=0.5s (100개), t=1.0s (100개)
// - explosion-spritesheet.png 4×4 프레임 애니메이션

// 3. 전쟁 선포 연출 (GlobeWarEffects 컴포넌트 내부)
// - war_declared 수신 시:
//   a. onCameraTarget(warZoneMidpoint) → 카메라 자동 회전
//   b. 카메라 셰이크: camera.position += sin(t*40)*0.3 (0.5초)
//   c. useAudio('war-siren') 사운드 트리거 (기존 useAudio 훅 활용)
```

#### GlobeScene 확장 (`components/lobby/GlobeView.tsx`)

**현재 GlobeScene props**: `onCountryClick, onHover, dominationStates, wars`
**확장 props**:

```typescript
function GlobeScene({
  onCountryClick,
  onHover,
  dominationStates,
  wars,
  // v15 NEW props
  countryStates,
  tradeRoutes,
  flagAtlas,
  globalEvents,
}: GlobeSceneProps) {
  // ... 기존 countries, countryGeoMap, centroidsMap 로직 유지 ...

  // v15: 충격파 ref (GlobeMissileEffect → GlobeShockwave 연결)
  const shockwaveRef = useRef<{ trigger: (pos: THREE.Vector3) => void }>(null);

  // v15: 카메라 타겟 ref
  const cameraTargetRef = useRef<THREE.Vector3 | null>(null);

  return (
    <>
      {/* ... 기존 컴포넌트 ... */}

      {/* v15: 국기 + 에이전트 수 라벨 */}
      {flagAtlas && (
        <GlobeCountryLabels
          countryCentroids={centroidsMap}
          countryStates={countryStates}
          dominationStates={dominationStates}
          flagAtlas={flagAtlas}
          globeRadius={RADIUS}
        />
      )}

      {/* v15: 미사일 궤적 */}
      {wars.length > 0 && (
        <GlobeMissileEffect
          wars={wars}
          countryCentroids={centroidsMap}
          globeRadius={RADIUS}
          onImpact={(iso3, pos) => shockwaveRef.current?.trigger(pos)}
        />
      )}

      {/* v15: 충격파 */}
      <GlobeShockwave ref={shockwaveRef} />

      {/* v15: 무역 루트 */}
      {tradeRoutes && tradeRoutes.length > 0 && (
        <GlobeTradeRoutes
          tradeRoutes={tradeRoutes}
          countryCentroids={centroidsMap}
          globeRadius={RADIUS}
        />
      )}

      {/* v15: 이벤트 파동 */}
      <GlobeEventPulse
        globalEvents={globalEvents ?? []}
        countryCentroids={centroidsMap}
        globeRadius={RADIUS}
      />
    </>
  );
}
```

### Component Dependency Graph

```
FlagAtlasLoader (lib/)
  │ CanvasTexture
  ▼
GlobeCountryLabels ◄── countryStates (useSocket)
  │                ◄── dominationStates (useSocket)
  │                ◄── countryCentroids (GlobeScene)
  │
  │  (독립 — 같은 레벨)
  │
GlobeMissileEffect ◄── wars (useSocket)
  │ onImpact callback  ◄── countryCentroids (GlobeScene)
  ▼
GlobeShockwave     (imperative ref trigger)
  │
  │  (독립)
  │
GlobeTradeRoutes   ◄── tradeRoutes (useSocket NEW)
                   ◄── countryCentroids (GlobeScene)
  │
  │  (독립)
  │
GlobeEventPulse    ◄── globalEvents (useSocket 기존)
                   ◄── countryCentroids (GlobeScene)

GlobeDominationLayer (기존 확장) ◄── dominationStates (useSocket)
                                ◄── countryGeometries (GlobeScene)

GlobeWarEffects (기존 확장)     ◄── wars (useSocket)
                                ◄── countryCentroids (GlobeScene)
```

**핵심 의존성 규칙**:
- 모든 신규 컴포넌트는 GlobeScene 내부에 마운트
- GlobeMissileEffect → GlobeShockwave 연결은 `useImperativeHandle` + `forwardRef` 패턴
- FlagAtlasLoader는 GlobeScene 바깥(GlobeView 레벨)에서 비동기 로드, 완료 후 props로 전달
- 기존 CountryLabels(국가명 텍스트)와 신규 GlobeCountryLabels(국기+숫자)는 공존 (다른 레이어)

## Performance Architecture

### Performance Budget

| 메트릭 | 목표 | 측정 방법 |
|--------|------|----------|
| FPS (데스크탑) | 60fps | useFrame stats overlay |
| FPS (모바일) | 30fps | `navigator.hardwareConcurrency` 감지 후 LOD |
| 국기 아틀라스 메모리 | < 16MB | 2048×2048 RGBA = 16MB (단일 텍스처) |
| 에이전트 수 텍스트 텍스처 | < 4MB | 1024×1024 RGBA (195칸) |
| draw call 증가 | < 12 | InstancedMesh로 6개 신규 컴포넌트 → 각 1~2 draw call |
| WS 페이로드 증가 | < 200B/msg | maxAgents(4B) + population(8B) per country |

### InstancedMesh 전략 (핵심 성능 아키텍처)

```
컴포넌트               | Geometry            | Instances | Draw Calls
-----------------------|---------------------|-----------|----------
GlobeCountryLabels 국기 | PlaneGeometry       | 195       | 1
GlobeCountryLabels 텍스 | PlaneGeometry       | 195       | 1
GlobeMissileEffect 미사 | CylinderGeometry    | 10        | 1
GlobeMissileEffect 꼬리 | SphereGeometry      | 50        | 1
GlobeShockwave 링       | RingGeometry        | 5         | 1
GlobeTradeRoutes 화물   | SphereGeometry      | 20        | 1
GlobeEventPulse 링      | RingGeometry        | 5         | 1
전장 안개 (WarEffects)   | PlaneGeometry       | 20        | 1
합계                    |                     | 500       | 8
```

### LOD 시스템 상세

```typescript
// useFrame 내 LOD 결정 로직
const camDist = camera.position.length();

// Level 0 (Close): camDist < 200
//   - 모든 195개국 라벨 표시
//   - 국기(32×24px) + 에이전트 수 + 국명
//   - 전체 이펙트 활성

// Level 1 (Medium): 200 ≤ camDist < 400
//   - 모든 195개국 라벨 표시 (뒷면 제외)
//   - 국기(24×18px) + 에이전트 수
//   - 무역 라인 두께 50% 감소

// Level 2 (Far): camDist ≥ 400
//   - 상위 50개국만 (Tier S+A)
//   - 에이전트 수만 (국기 숨김)
//   - 이펙트 파티클 수 50% 감소
```

### 모바일 감소 전략

```typescript
// 디바이스 성능 감지
const isMobile = typeof navigator !== 'undefined' && (
  navigator.hardwareConcurrency <= 4 ||
  window.innerWidth < 768
);

// 모바일 제한:
// - 라벨: 상위 30개국만 표시 (Tier S+A 일부)
// - 미사일: 동시 최대 3발 (데스크탑 10발)
// - 충격파: 비활성화
// - 무역 라인: 비활성화
// - 전장 안개: 비활성화
// - 파티클: 전체 50% 감소
// - 국기 아틀라스: 1024×1024로 축소 (40×30px per flag)
```

### 이펙트 풀링 패턴

```typescript
// 모든 이펙트 컴포넌트에 공통 적용
function useEffectPool<T>(size: number, createState: () => T) {
  const pool = useRef<T[]>(Array.from({ length: size }, createState));
  const activeCount = useRef(0);

  const acquire = useCallback(() => {
    // 비활성 슬롯 탐색, 없으면 가장 오래된 것 재활용
    for (let i = 0; i < size; i++) {
      if (!pool.current[i].active) {
        pool.current[i].active = true;
        activeCount.current++;
        return pool.current[i];
      }
    }
    // ring buffer 패턴: 가장 오래된 것 재활용
    const oldest = pool.current.reduce((a, b) => a.startTime < b.startTime ? a : b);
    return oldest;
  }, []);

  const release = useCallback((item: T) => {
    item.active = false;
    activeCount.current--;
  }, []);

  return { pool, acquire, release, activeCount };
}
```

## Reliability & Error Handling

### 국기 CDN 로드 실패 처리

```
시도 1: flagcdn.com/w80/{iso2}.png (timeout: 5초)
  ├── 성공 → Canvas에 drawImage
  └── 실패 →
      시도 2: iso2ToFlag(iso2) 이모지 → Canvas ctx.fillText (32px)
        ├── 성공 → 이모지 렌더
        └── 실패 (이모지 미지원 환경) →
            시도 3: 단색 사각형 (NATION_COLORS[iso3] ?? '#666')
```

### WS 연결 복구

- `domination_update`, `trade_route_update`: 이벤트 기반이므로 연결 복구 시 자연 재수신
- `countries_state`: 1Hz 주기이므로 1초 내 자동 복구
- 클라이언트: tradeRoutes의 TTL(60초) 기반 자동 정리 → 오래된 데이터 자연 소멸

### arena_full 에러 UX

```typescript
// useSocket.ts — join_country_arena 응답 처리
socket.on('error', (data: { code: string; message: string }) => {
  if (data.code === 'arena_full') {
    // 토스트 UI 표시: "이 국가의 아레나가 가득 찼습니다 (42/43)"
    // 3초 후 자동 소멸
    showToast({ type: 'warning', message: data.message, duration: 3000 });
  }
});
```

### 텍스처 메모리 관리

- FlagAtlasLoader: GlobeView unmount 시 `texture.dispose()` 호출
- 에이전트 수 CanvasTexture: GlobeCountryLabels unmount 시 dispose
- 이펙트 텍스처 (missile-glow, shockwave-ring 등): 모듈 레벨 캐시, 앱 생명주기 동안 유지
- Three.js geometry/material: useEffect cleanup에서 일괄 dispose

## Architecture Decision Records

### ADR-040: TierConfigs + Population 하이브리드 maxAgents 공식

**Status**: Accepted

**Context**: 기존 `TierConfigs`는 Tier별 고정 `MaxAgents`만 제공 (S:50, A:35, B:25, C:15, D:8). 같은 TierS인 USA(3.3억)와 인도(14억)가 동일한 50명 제한을 받아 비현실적.

**Decision**: `CalcMaxAgents(tier, population)` 함수로 Tier 범위 내 미세 조정. `tierMax * clamp(log10(pop/1e6) / log10(refPop/1e6), 0.3, 1.0)`, 최소 5명 보장.

**Consequences**:
- TierConfigs의 MaxAgents는 상한값 역할로 변경 (breaking change 없음, 항상 <= 기존값)
- 소국(바티칸, 산마리노 등)도 최소 5명 보장 → 빈 아레나 방지
- 서버 `countries_state` 페이로드 12B 증가 (maxAgents 4B + population 8B)

**Alternatives**:
1. 선형 비례 (population/max_pop * tierMax) — 거부: 중소국이 너무 적게 배정
2. 서버측 동적 조정 (현재 접속자 비례) — 거부: 복잡성 대비 이점 불분명

### ADR-041: 국기 표시를 GlobeCountryLabels 단일 컴포넌트에 집중

**Status**: Accepted

**Context**: 기존 GlobeDominationLayer는 색상 오버레이 전문. 국기 PNG를 표시하려면 텍스처 아틀라스 + Billboard + LOD가 필요하여 셰이더 레이어에 넣기 부적합.

**Decision**: 신규 `GlobeCountryLabels` 컴포넌트가 국기 + 에이전트 수 표시의 유일한 책임을 진다. GlobeDominationLayer는 색상 오버레이만 담당. 두 컴포넌트가 같은 dominationStates를 받지만 역할이 명확히 분리.

**Consequences**:
- 관심사 분리: 셰이더 이펙트 vs Billboard 렌더링
- 두 컴포넌트 간 중복 데이터 전달 (dominationStates) — 허용 가능한 트레이드오프
- GlobeCountryLabels가 기존 CountryLabels(국가명 텍스트)와 공존 — 다른 레이어에서 렌더

### ADR-042: FlagAtlasLoader를 GlobeView 레벨에서 비동기 로드

**Status**: Accepted

**Context**: 195개국 국기를 CDN에서 로드하면 네트워크 지연 발생. GlobeScene 마운트 후 로드하면 빈 라벨이 보임.

**Decision**: GlobeView(R3F Canvas 바깥) 레벨에서 `useEffect` + `FlagAtlasLoader.loadAll()` 호출. 로딩 중 프로그레스 인디케이터 표시. 완료 후 `flagAtlas` prop으로 GlobeScene에 전달.

**Consequences**:
- 글로브 3D 씬은 국기 로드 완료 전에도 정상 렌더 (국기 없이)
- GlobeCountryLabels는 `flagAtlas` prop이 null이면 이모지 폴백
- 병렬 로드 (10개 동시)로 총 로드 시간 약 3~5초

### ADR-043: DominationEngine.OnEvent 콜백으로 domination_update WS 연결

**Status**: Accepted

**Context**: `DominationEngine`에 `OnEvent func(DominationEvent)` 필드가 존재하나 nil 상태. `emitEvent()` 메서드는 `OnEvent != nil` 시 호출하는 로직이 이미 구현되어 있음.

**Decision**: `game/country_arena.go`에서 CountryArena 초기화 시 `DominationEngine.OnEvent`를 WS Hub broadcast 콜백으로 설정. 기존 코드 변경 최소화.

**Consequences**:
- DominationEngine 자체 수정 불필요 (OnEvent 필드 설정만)
- country_arena.go에 Hub 참조 필요 (이미 패턴 존재: OnEvents 콜백)
- 양방향 의존성 없음 (콜백 패턴으로 분리)

### ADR-044: 미사일-충격파 연결을 imperative ref 패턴으로

**Status**: Accepted

**Context**: GlobeMissileEffect 착탄 시 GlobeShockwave를 트리거해야 함. 두 컴포넌트는 형제 관계(sibling).

**Decision**: `useImperativeHandle` + `forwardRef`로 GlobeShockwave에 `trigger(position)` 메서드 노출. GlobeScene에서 `shockwaveRef`를 생성하여 GlobeMissileEffect의 `onImpact` 콜백에서 호출.

**Consequences**:
- 선언적 React 패턴에서 벗어나지만, 이펙트 트리거는 imperative가 자연스러움
- 기존 프로젝트의 `onCameraTarget` 콜백 패턴과 일관성 유지
- GlobeShockwave가 부모에 의존하지 않음 (자체 풀링 관리)

## Open Questions

1. **카메라 셰이크의 UX 적절성**: 전쟁 선포 시 0.5초 셰이크가 사용자에게 불쾌감을 줄 수 있음. 설정으로 끌 수 있는 옵션 필요 여부 — 구현 시 결정
2. **무역 라인 TTL 60초의 적절성**: 빈번한 거래 시 라인이 너무 빨리 사라질 수 있음. 실제 거래 빈도에 따라 조정 필요 — Phase 5 테스트 시 결정
3. **FlagAtlasLoader 캐시 전략**: Service Worker 캐시 vs localStorage 이미지 캐시. 현재 설계는 매 세션 CDN 로드 — 성능 문제 시 캐시 레이어 추가
4. **기존 CountryLabels와 GlobeCountryLabels 공존 시 시각적 충돌**: 국가명 텍스트와 국기+숫자가 겹칠 수 있음. 해결 방안: CountryLabels의 Y 오프셋 조정 또는 GlobeCountryLabels에 국명 통합 후 CountryLabels 제거 — Phase 2 구현 시 결정

---

## Sequence Diagrams

### 전쟁 선포 → 미사일 → 충격파 전체 플로우

```
Server WarSystem          WS Hub        Client useSocket      GlobeWarEffects    GlobeMissileEffect   GlobeShockwave
     │                      │                │                     │                    │                   │
     │ war_declared          │                │                     │                    │                   │
     ├─────────────────────►│                │                     │                    │                   │
     │                      │ broadcast       │                     │                    │                   │
     │                      ├───────────────►│                     │                    │                   │
     │                      │                │ setUiState.wars      │                    │                   │
     │                      │                ├────────────────────►│                    │                   │
     │                      │                │                     │ 아크라인+깜빡임     │                    │
     │                      │                │                     │ 카메라셰이크        │                    │
     │                      │                │                     │ 전장안개 파티클     │                    │
     │                      │                ├────────────────────────────────────────►│                   │
     │                      │                │                     │                    │ 미사일 발사(2초)   │
     │                      │                │                     │                    │       │           │
     │                      │                │                     │                    │ onImpact(pos)     │
     │                      │                │                     │                    ├──────────────────►│
     │                      │                │                     │                    │                   │ 충격파(0.8초)
```

### 국기 아틀라스 로드 → 라벨 렌더 플로우

```
GlobeView mount           FlagAtlasLoader       flagcdn.com CDN      GlobeScene          GlobeCountryLabels
     │                         │                      │                   │                      │
     │ useEffect: loadAll()    │                      │                   │                      │
     ├────────────────────────►│                      │                   │                      │
     │                         │ fetch(w80/us.png)    │                   │                      │
     │                         ├─────────────────────►│                   │                      │
     │                         │ fetch(w80/kr.png)    │                   │                      │
     │                         ├─────────────────────►│   (10개 병렬)     │                      │
     │                         │        ...           │                   │                      │
     │                         │ Canvas drawImage     │                   │                      │
     │                         │ CanvasTexture 생성   │                   │                      │
     │ flagAtlas (prop)        │                      │                   │                      │
     ├────────────────────────────────────────────────────────────────────►│                      │
     │                         │                      │                   │ flagAtlas prop 전달  │
     │                         │                      │                   ├─────────────────────►│
     │                         │                      │                   │                      │ InstancedMesh 생성
     │                         │                      │                   │                      │ UV 매핑 적용
     │                         │                      │                   │                      │ useFrame 시작
```

---

## Self-Verification (자체 검증)

### 검증 1: 기획서 대비 FR/NFR 매핑 완전성

| FR/NFR | 기획서 요구사항 | 아키텍처 매핑 | 상태 |
|--------|---------------|-------------|------|
| FR-1 | 전쟁 이펙트 강화 | GlobeMissileEffect + GlobeShockwave + GlobeWarEffects 강화 | PASS |
| FR-2 | 국기 오버레이 | FlagAtlasLoader + GlobeCountryLabels | PASS |
| FR-3 | 에이전트 수 라벨 | GlobeCountryLabels (국기+숫자 통합) | PASS |
| FR-4 | 인구 비례 에이전트 제한 | CalcMaxAgents 하이브리드 공식 + arena_full 에러 | PASS |
| FR-5 | 점령 이펙트 | GlobeDominationLayer 셰이더 강화 (해칭, 플래시, 웨이브) | PASS |
| FR-6 | 무역 루트 시각화 | GlobeTradeRoutes + trade_route_update WS | PASS |
| FR-7 | 글로벌 이벤트 이펙트 | GlobeEventPulse (5종 파동) | PASS |
| FR-8 | 카메라 자동 포커스 | onCameraTarget 콜백 + cameraTargetRef | PASS |
| NFR-1 | 60fps InstancedMesh | 8개 InstancedMesh, 총 500 instances, 8 draw calls | PASS |
| NFR-2 | 국기 아틀라스 1장 | 2048×2048 단일 CanvasTexture (~16MB) | PASS |
| NFR-3 | CDN 로드 | flagcdn.com + iso2ToFlag 폴백 | PASS |
| NFR-4 | 모바일 LOD | 3단계 LOD + 모바일 감소 전략 | PASS |

### 검증 2: 기존 코드베이스 호환성

| 기존 컴포넌트/구조체 | 호환성 | 설명 |
|---------------------|--------|------|
| `TierConfigs` (country_data.go) | 비파괴 | CalcMaxAgents가 TierConfigs를 참조만 함, 값 변경 없음 |
| `CountryBroadcastState` (world_manager.go) | 필드 추가 | MaxAgents, Population 필드 추가 (기존 JSON 소비자 영향 없음 — 추가 필드 무시) |
| `DominationEngine.OnEvent` (domination.go) | nil → 콜백 설정 | DominationEngine 코드 자체 수정 없음 |
| `GlobeDominationLayer` (tsx) | 셰이더 확장 | 3개 uniform 추가 — 기존 shader 로직 유지 |
| `GlobeWarEffects` (tsx) | 기능 추가 | 기존 4개 하위 컴포넌트 유지 + 3개 신규 추가 |
| `GlobeScene` (GlobeView.tsx) | props 확장 | 4개 신규 props + 5개 신규 하위 컴포넌트 마운트 |
| `UiState` (useSocket.ts) | 필드 추가 | tradeRoutes[] 필드 추가 |
| `CountryClientState` (globe-data.ts) | 필드 추가 | maxAgents, population 필드 추가 |
| `GlobeViewProps` | props 추가 | tradeRoutes, flagAtlas 추가 |

### 검증 3: 데이터 흐름 일관성

- Server `CalcMaxAgents` 결과 → `CountryBroadcastState.MaxAgents` → WS → `useSocket` → `countryStates.maxAgents` → `GlobeCountryLabels` 텍스트 렌더 **PASS** (end-to-end 추적 완료)
- Server `DominationEngine.emitEvent` → `OnEvent` 콜백 → `Hub.BroadcastToAll("domination_update")` → `useSocket` → `dominationStates` → `GlobeDominationLayer` + `GlobeCountryLabels` **PASS**
- Server `TradeEngine.executeTrade` → `Hub.BroadcastToAll("trade_route_update")` → `useSocket` → `tradeRoutes` → `GlobeTradeRoutes` **PASS**
- `GlobeMissileEffect.onImpact` → `shockwaveRef.current.trigger(pos)` → `GlobeShockwave` 링 렌더 **PASS**

### 검증 4: 성능 예산 준수

- draw call 증가: +8 (InstancedMesh 기반) — 기존 ~20 draw call에서 ~28으로 증가 (허용 범위)
- 텍스처 메모리: 국기 16MB + 에이전트수 4MB + 이펙트 텍스처 ~2MB = **~22MB** (GPU 메모리 기준 허용)
- WS 대역폭: countries_state 195국 × 12B = ~2.3KB/s 추가 (1Hz) — 무시할 수준

### 자체 개선 사항 (1차 검증 후 반영)

1. **누락 발견**: GlobeScene에 `countryStates`를 props로 전달하는 부분이 기존 GlobeScene 시그니처에 없었음 → C4 Level 3에서 GlobeScene 확장 props 명시 완료
2. **누락 발견**: `arena_full` 에러의 클라이언트 토스트 UI 명세 누락 → Reliability 섹션에 에러 처리 UX 추가 완료
3. **일관성**: ADR-041에서 GlobeCountryLabels가 dominationStates를 받는다고 명시했지만 Props 인터페이스에 누락 → GlobeCountryLabelsProps에 dominationStates 포함 확인 완료
4. **성능**: 모바일에서 국기 아틀라스 1024×1024 축소 옵션 추가 (Performance 섹션에 반영)
