# Shadowbroker × AWW Integration — High-Level Blueprint

> /da:plan 산출물. 상세 설계는 /da:system에서 심화.

## 1. System Context (C4 Level 1)

```
┌─────────────────────────────────────────────────────────────────┐
│                        AWW System                                │
│                                                                   │
│   ┌───────────────────┐          ┌───────────────────────────┐   │
│   │  Next.js Client   │◄═══════►│  Go Server                │   │
│   │  (Vercel)         │  WS/HTTP │  (Railway)                │   │
│   │                   │          │                           │   │
│   │  Strategy: MapLibre│          │  Game Engine + OSINT      │   │
│   │  Combat: R3F 3D   │          │  Collector                │   │
│   └───────────────────┘          └─────────┬─────────────────┘   │
│                                             │                     │
└─────────────────────────────────────────────┼─────────────────────┘
                                              │
                    ┌─────────────────────────┼────────────────────┐
                    │    External OSINT Sources (23 APIs)          │
                    │                                              │
                    │  OpenSky  adsb.lol  aisstream  CelesTrak    │
                    │  USGS     GDELT     DeepState  NASA FIRMS   │
                    │  NOAA     IODA      KiwiSDR    TfL          │
                    │  TxDOT    NYC DOT   LTA SG     RestCountries│
                    │  Wikidata  Wikipedia  Esri     OSM Nominatim│
                    │  NASA GIBS  MS Planetary  DC Map  CARTO     │
                    └─────────────────────────────────────────────┘
```

## 2. 핵심 컴포넌트 역할

### Go Server 확장

| 컴포넌트 | 패키지 | 역할 |
|----------|--------|------|
| **OSINT Collector** | `server/internal/osint/` | 23개 외부 API 데이터 수집, 2-tier 스케줄링. **독립 struct** (V14Systems 밖), errgroup에 별도 goroutine 등록 |
| **EventTriggerEngine** | `server/internal/osint/trigger_engine.go` | OSINT 데이터 → 게임 이벤트 변환 규칙 엔진 |
| **CountryModifier** | `server/internal/osint/country_modifier.go` | OSINT 기반 국가 파워 수정자 계산 |
| **OSINT Store** | `server/internal/osint/store.go` | 인메모리 데이터 저장 (sync.RWMutex) |
| **OSINT API Routes** | `server/internal/api/osint_routes.go` | REST API 엔드포인트 |
| **Hub 확장** | `server/internal/ws/hub.go` 수정 | `osintSubscribers map[*Client]bool` 추가 + SubscribeOsint/UnsubscribeOsint/BroadcastToOsint. citySubscribers(`map[string]map[*Client]bool`, iso3 키) 패턴 참고하되 OSINT는 전역 flat map |

### Frontend 확장 (`apps/web/` — 멀티플레이어 본체)

| 컴포넌트 | 경로 | 역할 |
|----------|------|------|
| **StrategyMapView** | `apps/web/components/strategy/StrategyMapView.tsx` | MapLibre GL 메인 지도 뷰 |
| **OSINT Layers (10+)** | `apps/web/components/strategy/layers/*.tsx` | 각 데이터 도메인별 독립 레이어 |
| **UI Panels (6+)** | `apps/web/components/strategy/panels/*.tsx` | 레이어 컨트롤, 뉴스, Dossier 등 |
| **GameSocket 확장** | `apps/web/hooks/useWebSocket.ts` 수정 | 기존 GameSocket에 `subscribeOsint()`/`unsubscribeOsint()` 추가 (별도 WS 연결 아님) |
| **osint-store** | `apps/web/stores/osint-store.ts` | Zustand OSINT 상태 관리 |
| **Mode Switcher** | `apps/web/components/ModeSwitcher.tsx` | 전략뷰 ↔ 전투뷰 전환 |

> **Note**: `app_ingame/`은 별도 싱글플레이어 게임(CODE SURVIVOR)으로 통합 범위 밖

### Redis OSINT 채널 패턴

기존 AWW Redis 채널(`game:{iso}`, `sovereignty:{iso}`, `battle:{iso}`, `global:events` 등)에 OSINT 전용 채널 추가:

| 채널 | 발행 주기 | 내용 |
|------|-----------|------|
| `osint:fast` | 60s | flights, military, ships, satellites 통합 데이터 |
| `osint:slow` | 5min | quakes, gdelt, fires, weather, news, infra 통합 데이터 |
| `osint:trigger:{iso}` | 이벤트 발생 시 | EventTriggerEngine이 특정 국가에 게임 이벤트 발행 |

## 3. 데이터 흐름

```
External APIs ──[HTTP/WS]──► Go OSINT Collector
                                    │
                     ┌──────────────┼──────────────┐
                     ▼              ▼              ▼
               OSINT Store    Redis PubSub    EventTriggerEngine
               (in-memory)    (cache)              │
                     │              │              ▼
                     │              │         WorldManager
                     │              │         (game events)
                     ▼              ▼              │
               REST API        WebSocket           │
               /api/v1/osint   osint:* channels    │
                     │              │              │
                     └──────────────┼──────────────┘
                                    ▼
                              Next.js Client
                              ┌─────────────┐
                              │ osint-store  │
                              │ (Zustand)    │
                              └──────┬──────┘
                                     │
                              ┌──────┼──────┐
                              ▼      ▼      ▼
                           MapLibre  Panels  Game State
                           Layers    UI      Integration
```

## 4. Go 포팅 전략 (Python → Go)

### 모듈 매핑

| Python 모듈 (줄 수) | Go 대응 | 포팅 우선순위 |
|---------------------|---------|-------------|
| `flights.py` (724줄) | `osint/flights.go` | P1 — 핵심 |
| `military.py` (277줄) | `osint/military.go` | P1 — 핵심 |
| `satellites.py` (394줄) | `osint/satellites.go` | P1 — 핵심 |
| `geo.py:fetch_ships` (166줄 일부) | `osint/ships.go` | P1 — 핵심 |
| `earth_observation.py:quakes` (144줄 일부) | `osint/quakes.go` | P1 — 핵심 |
| `geo.py:fetch_gdelt` | `osint/gdelt.go` | P2 |
| `geo.py:fetch_frontlines` | `osint/frontlines.go` | P2 |
| `earth_observation.py:fires` | `osint/fires.go` | P2 |
| `earth_observation.py:weather` | `osint/weather.go` | P2 |
| `news.py` (273줄) | `osint/news.go` | P3 |
| `infrastructure.py` (213줄) | `osint/infra.go` | P3 |
| `financial.py` (58줄) | `osint/financial.go` | P3 |
| `plane_alert.py` (205줄) | `osint/plane_alert.go` | P3 |
| `yacht_alert.py` (62줄) | `osint/yacht_alert.go` | P3 |

### Go 스케줄링 패턴

```go
// Python APScheduler → Go goroutine + time.Ticker
type Collector struct {
    store     *Store
    fastTick  *time.Ticker  // 60s
    slowTick  *time.Ticker  // 5min
    hub       *ws.Hub
    ctx       context.Context
    cancel    context.CancelFunc
}

func (c *Collector) Run() {
    // Initial full fetch
    c.updateAll()

    for {
        select {
        case <-c.fastTick.C:
            c.updateFast()  // flights, military, ships, satellites
        case <-c.slowTick.C:
            c.updateSlow()  // quakes, gdelt, fires, news, infra...
        case <-c.ctx.Done():
            return
        }
    }
}
```

## 5. 프론트엔드 모드 전환 아키텍처

```
App.tsx
  ├─ <ModeSwitcher activeMode={mode} />
  │
  ├─ {mode === 'strategy' && (
  │     <StrategyMapView>       ← MapLibre GL
  │       <FlightLayer />
  │       <ShipLayer />
  │       <SatelliteLayer />
  │       <ConflictLayer />
  │       ... (20+ layers)
  │       <GameOverlay />       ← 게임 상태 오버레이 (전투존, 세력)
  │     </StrategyMapView>
  │   )}
  │
  ├─ {mode === 'combat' && (
  │     <GameCanvas>            ← R3F 3D (기존)
  │       <MatrixScene />
  │       <MCVoxelTerrain />
  │       <EnemyRenderer />
  │       ...
  │     </GameCanvas>
  │   )}
  │
  └─ <UIOverlay>               ← 공통 UI (항상 표시)
       <LayerTogglePanel />
       <NewsFeedPanel />
       <MarketsPanel />
       ...
     </UIOverlay>
```

## 6. ADR (Architecture Decision Records)

### ADR-001: MapLibre GL over R3F Globe for Strategy View

**Status**: Proposed
**Context**: AWW 전략 뷰는 현재 R3F 3D Globe. Shadowbroker 통합을 위해 2D 지도가 필요.
**Decision**: MapLibre GL + CARTO Dark 타일로 전략 뷰 대체. R3F는 전투 뷰에만 사용.
**Rationale**: Shadowbroker의 20+ 레이어가 이미 MapLibre로 구현됨. 2D 지도가 OSINT 데이터 밀도에 적합. GeoJSON 생태계 활용.
**Consequences**: 3D Globe의 시각적 임팩트 감소. 대신 데이터 밀도와 상호작용성 대폭 향상.

### ADR-002: Go Porting over Sidecar Architecture

**Status**: Proposed
**Context**: Shadowbroker 백엔드는 Python FastAPI. AWW는 Go 서버.
**Decision**: Python → Go 포팅. 별도 Python 컨테이너(sidecar) 대신 단일 Go 바이너리.
**Rationale**: Railway 배포 단순화. Go goroutine이 Python threading보다 효율적. 단일 바이너리 관리.
**Consequences**: 포팅 비용 (2,654줄). Python 전용 라이브러리 대체: Playwright→`colly/v2`+`rod`(JS렌더링), BeautifulSoup→`goquery`, yfinance→`piquette/finance-go`. SGP4는 `joshuaferrara/go-satellite` (안정성 주의, 대안: `infostellarinc/go-satellite` fork).

### ADR-003: Hybrid Data-to-Game Integration

**Status**: Proposed
**Context**: 실제 OSINT 데이터를 게임에 어떻게 반영할 것인가.
**Decision**: 3단계 하이브리드: 시각적 오버레이 + 이벤트 트리거 + 국가 파워 수정자.
**Rationale**: 시각만으로는 게임플레이 영향 없음. 이벤트 트리거만으로는 밸런스 위험. 3단계 조합이 최적.
**Consequences**: 밸런스 튜닝 복잡도 증가. config 기반 계수 조절 필수. 실제 데이터 의존도 관리 필요.
