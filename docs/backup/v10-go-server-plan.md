# Agent Survivor — Go Game Server Architecture Plan

> **Version**: v10.1
> **Date**: 2026-03-06
> **Status**: DRAFT
> **Author**: System Architect + Backend Architect

---

## 1. Overview & Goals

### 1.1 Why Go?

| Factor | TypeScript (현재) | Go (목표) |
|--------|------------------|-----------|
| **동시성** | Single-threaded event loop | Goroutine per room (true parallelism) |
| **GC 압력** | V8 GC pause → tick jitter | 구조체 기반, 힙 할당 최소화 |
| **메모리** | Object overhead ~64B/obj | Struct packing ~16B/entity |
| **CPU** | JIT 최적화 한계 | AOT 컴파일, SIMD 가능 |
| **스케일링** | 1 인스턴스 ~500명 | 1 인스턴스 ~5,000명 |
| **배포** | Node.js + tsx | 단일 바이너리 (~10MB) |
| **기존 경험** | TS 서버 운영 중 | agent_arena/agent_verse Go 서버 운영 |

### 1.2 Goals

1. **대규모 동시접속**: 50개 Room × 100명/Room = 5,000 CCU / 인스턴스
2. **안정적 20Hz 틱**: Room당 < 2ms 틱 처리 (50ms 예산의 4%)
3. **기존 게임 로직 100% 포팅**: v10 전체 시스템 (Agent, Upgrade, Shrink, Combat, Bot)
4. **기존 프론트엔드 호환**: 최소한의 클라이언트 수정 (Socket.IO → WebSocket 어댑터)
5. **Railway 배포**: 기존 인프라 활용, Docker 단일 바이너리

### 1.3 Non-Goals

- 데이터베이스/영구 저장 (인메모리 게임 서버)
- 마이크로서비스 분리 (모놀리식 게임 서버)
- 클라이언트 3D 렌더링 변경 (Three.js/R3F 유지)

---

## 2. Tech Stack

| 레이어 | 기술 | 근거 |
|--------|------|------|
| **언어** | Go 1.24+ | agent_arena/agent_verse 동일 버전 |
| **HTTP Router** | chi/v5 | 기존 Go 프로젝트 표준, 경량 |
| **WebSocket** | gorilla/websocket | 기존 프로젝트 검증, per-room isolation |
| **Config** | envconfig | 기존 패턴, Railway env 호환 |
| **Orchestration** | errgroup | 기존 패턴, graceful shutdown |
| **JSON** | encoding/json (→ sonic 최적화) | 브라우저 호환, 추후 MessagePack |
| **Logging** | log/slog | Go 1.21+ 표준, 구조화 로깅 |
| **UUID** | google/uuid | 기존 의존성 |
| **Metrics** | prometheus (선택) | 운영 모니터링 |

---

## 3. Directory Structure

```
server/                                    # 프로젝트 루트 (snake/server/)
├── cmd/
│   └── server/
│       └── main.go                        # Composition root, errgroup 오케스트레이션
├── internal/
│   ├── config/
│   │   └── config.go                      # envconfig 기반 설정 (feature flags 포함)
│   ├── server/
│   │   ├── router.go                      # chi 라우터 + 미들웨어 등록
│   │   └── middleware.go                  # CORS, Recovery, Logging, ServiceKeyAuth
│   ├── ws/
│   │   ├── hub.go                         # Channel-based Hub (per-room 라우팅)
│   │   ├── client.go                      # ReadPump + WritePump goroutine
│   │   └── protocol.go                    # 메시지 직렬화/역직렬화
│   ├── game/
│   │   ├── room_manager.go                # Room 생명주기, Quick Join, 로비 브로드캐스트
│   │   ├── room.go                        # Room 상태 머신 (waiting→countdown→playing→ending→cooldown)
│   │   ├── arena.go                       # 20Hz 게임 루프 오케스트레이터
│   │   ├── agent.go                       # Agent 엔티티 (위치, 질량, 전투, 빌드)
│   │   ├── collision.go                   # Aura DPS + Dash 충돌 + 경계 판정
│   │   ├── upgrade.go                     # Tome/Ability/Synergy 시스템 + 선택지 생성
│   │   ├── orb.go                         # Orb 관리 (스폰, 수집, 만료, death orb)
│   │   ├── shrink.go                      # Arena 경계 수축 + 페널티
│   │   ├── spatial_hash.go                # Grid 기반 공간 인덱싱 (Agent + Orb)
│   │   ├── leaderboard.go                 # 점수 랭킹 (Top 10)
│   │   ├── bot.go                         # Bot AI (스폰, 행동, 빌드 경로)
│   │   ├── serializer.go                  # 뷰포트 컬링 + 상태 직렬화
│   │   └── constants.go                   # 게임 상수 (ArenaConfig, RoomConfig, etc.)
│   └── domain/
│       ├── types.go                       # 핵심 타입 (Position, Agent, Orb, PlayerBuild, etc.)
│       ├── events.go                      # WS 이벤트 페이로드 (JSON 태그)
│       ├── skins.go                       # 24종 스킨 정의
│       └── upgrades.go                    # Tome/Ability/Synergy 정의 테이블
├── go.mod
├── go.sum
├── Dockerfile                             # 멀티스테이지 빌드 (scratch 기반)
└── .env.example                           # 환경변수 예시
```

### 패키지 의존성 방향 (단방향)
```
cmd/server → internal/config
           → internal/server → internal/ws
                              → internal/game
           → internal/ws     → internal/domain
           → internal/game   → internal/domain
```

> **규칙**: `domain` 패키지는 어떤 다른 internal 패키지도 import하지 않음 (Pure Types)

---

## 4. Concurrency Model

### 4.1 Goroutine Architecture

```
main goroutine
├── [1] HTTP Server goroutine          (chi.ListenAndServe)
├── [1] WS Hub goroutine              (channel-based event loop, NO LOCKS)
├── [1] RoomManager goroutine          (room lifecycle + 1Hz 로비 브로드캐스트)
│   ├── [N] Room goroutine × 50       (각 Room 독립 20Hz game loop)
│   │   └── time.Ticker 50ms
│   └── [1] Lobby broadcaster         (1Hz rooms_update → 모든 연결)
└── [1] Signal Watcher goroutine      (SIGINT/SIGTERM → graceful shutdown)

Per WebSocket Connection:
├── [1] ReadPump goroutine            (클라이언트 → 서버 메시지)
├── [1] WritePump goroutine           (서버 → 클라이언트 메시지)
└── [1] Buffered channel (64 msgs)    (백프레셔, 느린 클라이언트 추방)
```

### 4.2 총 Goroutine 수 (5,000 CCU 기준)

| 컴포넌트 | 수 | 설명 |
|----------|------|------|
| Main / Signal / Hub | 3 | 고정 |
| RoomManager + Lobby | 2 | 고정 |
| Room game loops | 50 | Room 수 |
| Client ReadPump | 5,000 | 연결당 1 |
| Client WritePump | 5,000 | 연결당 1 |
| **합계** | **~10,055** | Go 기본 goroutine 비용: ~2KB/개 ≈ 20MB |

### 4.3 동기화 전략

| 공유 자원 | 동기화 방식 | 근거 |
|----------|------------|------|
| **WS Hub rooms map** | 단일 goroutine + channel | agent_arena 검증 패턴, lock-free |
| **Room → Agent map** | Room goroutine 독점 | 단일 소유자, 동기화 불필요 |
| **Player input** | Buffered channel → Room | ReadPump → Room goroutine |
| **State broadcast** | Room → Hub broadcast channel | 직렬화 후 전송, 복사 불필요 |
| **RoomManager rooms** | sync.RWMutex | Join/Leave가 Room goroutine 외부에서 발생 |
| **Rate limiter** | sync.Map | 연결별 독립, 원자적 연산 |

### 4.4 Input Pipeline (Critical Path)

```
Client WebSocket → ReadPump goroutine
  → JSON decode InputPayload
  → Rate limit check (sync.Map)
  → room.inputChan <- InputMsg{agentId, angle, boost, seq}
  → Room goroutine picks up next tick
  → agent.ApplyInput(angle, boost, seq)
```

> **지연시간**: ~0.1ms (channel send) + 최대 50ms (다음 틱 대기) = 최대 50.1ms

### 4.5 Graceful Shutdown

```go
// main.go (agent_arena 패턴)
ctx, cancel := context.WithCancel(context.Background())
g, gCtx := errgroup.WithContext(ctx)

g.Go(func() error { return httpServer.ListenAndServe() })
g.Go(func() error { hub.Run(); return nil })
g.Go(func() error { return roomManager.Run(gCtx) })
g.Go(func() error {
    sig := <-sigChan
    slog.Info("shutdown signal", "signal", sig)
    cancel()
    httpServer.Shutdown(shutdownCtx)
    hub.Stop()
    return nil
})

return g.Wait() // 모든 goroutine 종료 대기
```

---

## 5. Core Systems Design

### 5.1 Room State Machine

```
waiting ─(MIN_PLAYERS 도달)─→ countdown(10s)
   ↑                              │
   │                              ▼
cooldown(15s) ←── ending(5s) ←── playing(300s)
```

```go
type RoomState int
const (
    StateWaiting RoomState = iota
    StateCountdown
    StatePlaying
    StateEnding
    StateCooldown
)

type Room struct {
    ID           string
    state        RoomState
    timer        int              // 남은 초
    arena        *Arena
    humans       map[string]*HumanMeta  // socketID → meta
    inputChan    chan InputMsg     // ReadPump → Room goroutine
    joinChan     chan JoinRequest  // RoomManager → Room
    leaveChan    chan string       // socketID
    lastWinner   *WinnerInfo
    mu           sync.RWMutex     // humans map 보호 (Join/Leave 시)
}

// Run: Room goroutine (20Hz game loop + 1Hz state tick)
func (r *Room) Run(ctx context.Context, hub *ws.Hub) {
    gameTicker := time.NewTicker(50 * time.Millisecond)  // 20Hz
    stateTicker := time.NewTicker(1 * time.Second)       // 1Hz
    defer gameTicker.Stop()
    defer stateTicker.Stop()

    for {
        select {
        case <-ctx.Done():
            return
        case input := <-r.inputChan:
            r.arena.ApplyInput(input)
        case join := <-r.joinChan:
            r.handleJoin(join, hub)
        case socketID := <-r.leaveChan:
            r.handleLeave(socketID, hub)
        case <-gameTicker.C:
            r.arena.Tick()
            r.broadcastState(hub)
        case <-stateTicker.C:
            r.tickState(hub)
        }
    }
}
```

### 5.2 Arena (20Hz Game Loop)

```go
type Arena struct {
    config       ArenaConfig
    agents       map[string]*Agent    // agentID → Agent
    orbManager   *OrbManager
    spatialHash  *SpatialHash
    collision    *CollisionSystem
    leaderboard  *Leaderboard
    shrink       *ArenaShrink
    botManager   *BotManager
    upgrade      *UpgradeSystem
    tick         uint64
    deathEvents  []DeathEvent         // 이번 틱 사망 이벤트
    levelUps     []LevelUpEvent       // 이번 틱 레벨업
}

// Tick: 단일 게임 루프 (Room goroutine에서 호출)
func (a *Arena) Tick() {
    a.tick++
    a.deathEvents = a.deathEvents[:0]   // 재사용 (zero alloc)
    a.levelUps = a.levelUps[:0]

    // 0. Bot AI
    a.botManager.Update(a)

    // 1. Agent 물리 업데이트
    for _, agent := range a.agents {
        if agent.Alive {
            agent.Update(a.config)
        }
    }

    // 2. Arena 수축
    a.shrink.Update(a.agents)

    // 3. Spatial Hash 재구축
    a.spatialHash.Clear()
    for id, agent := range a.agents {
        if agent.Alive {
            a.spatialHash.InsertAgent(id, agent.Position)
        }
    }
    a.orbManager.InsertAllToHash(a.spatialHash)

    // 4. Aura 전투
    a.collision.ProcessAura(a.agents, a.spatialHash, a.config, a.tick)

    // 5. Dash 충돌
    a.collision.ProcessDash(a.agents, a.spatialHash, a.config)

    // 6. 사망 판정
    deaths := a.collision.DetectDeaths(a.agents, a.shrink.CurrentRadius())
    a.collision.ProcessDeaths(deaths, a.agents, a.orbManager, a.tick)
    a.deathEvents = append(a.deathEvents, deaths...)

    // 7. Kill XP 보상
    a.processKillRewards(deaths)

    // 8. 이펙트 처리 (마그넷 풀 등)
    a.processEffects()

    // 9. Orb 수집 + XP
    a.processOrbCollection()

    // 10. 업그레이드 타임아웃
    a.upgrade.ProcessTimeouts(a.agents, a.tick)

    // 11. 리더보드 (1초 간격)
    if a.tick%20 == 0 {
        a.leaderboard.Update(a.agents)
    }

    // 12. 자연 Orb 유지
    a.orbManager.Maintain(a.tick)

    // 13. 만료 Orb 정리 (1초 간격)
    if a.tick%20 == 0 {
        a.orbManager.CleanExpired(a.tick)
    }
}
```

### 5.3 Agent Entity

```go
type Agent struct {
    ID               string
    Name             string
    Position         Position          // 단일 좌표 (v10)
    Heading          float64           // 현재 방향 (rad)
    TargetAngle      float64           // 입력 방향
    Speed            float64           // 현재 속도
    Mass             float64           // HP 역할
    Level            int
    XP               int
    XPToNext         int
    Boosting         bool
    Alive            bool
    Build            PlayerBuild
    ActiveSynergies  []string
    Skin             AgentSkin
    ActiveEffects    []ActiveEffect    // 슬라이스 재사용
    EffectCooldowns  []EffectCooldown
    Score            int
    Kills            int
    BestScore        int
    JoinedAt         time.Time
    LastInputSeq     int
    HitboxRadius     float64           // 동적 (16~22px)
    LastDamagedBy    string
    KillStreak       int
    PendingChoices   []UpgradeChoice   // nil = 선택 없음
    UpgradeDeadline  uint64            // 틱
    GracePeriodEnd   uint64            // 무적 만료 틱
    IsBot            bool
}

// Update: 틱당 물리 업데이트
func (a *Agent) Update(cfg ArenaConfig) {
    // 1. 스티어링 (각도 lerp)
    diff := angleDiff(a.Heading, a.TargetAngle)
    if abs(diff) > cfg.TurnRate {
        if diff > 0 { a.Heading += cfg.TurnRate }
        else        { a.Heading -= cfg.TurnRate }
    } else {
        a.Heading = a.TargetAngle
    }
    a.Heading = normalizeAngle(a.Heading)

    // 2. 부스트 비용
    speed := cfg.BaseSpeed
    if a.Boosting && a.Mass > cfg.MinBoostMass {
        speed = cfg.BoostSpeed
        a.Mass -= cfg.BoostCostPerTick
    }

    // 3. Speed Tome 보너스
    speedBonus := float64(a.Build.Tomes[TomeSpeed]) * 0.10
    speed *= (1.0 + speedBonus)
    a.Speed = speed

    // 4. 위치 업데이트
    movePerTick := speed / float64(cfg.TickRate)
    a.Position.X += math.Cos(a.Heading) * movePerTick
    a.Position.Y += math.Sin(a.Heading) * movePerTick

    // 5. Hitbox 업데이트
    a.HitboxRadius = calcHitboxRadius(a.Mass, cfg)

    // 6. Regen Tome
    regenStacks := a.Build.Tomes[TomeRegen]
    if regenStacks > 0 {
        a.Mass += float64(regenStacks) * 0.025
    }

    a.Score = int(a.Mass)
}
```

### 5.4 Collision System

```go
type CollisionSystem struct{}

// ProcessAura: 60px 반경 내 Aura DPS 교환
func (c *CollisionSystem) ProcessAura(
    agents map[string]*Agent,
    hash *SpatialHash,
    cfg ArenaConfig,
    tick uint64,
) {
    for id, attacker := range agents {
        if !attacker.Alive || tick < attacker.GracePeriodEnd { continue }
        if attacker.HasEffect(EffectGhost) { continue }

        nearby := hash.QueryAgents(attacker.Position, cfg.AuraRadius)
        dps := attacker.GetAuraDPS(cfg)

        for _, entry := range nearby {
            if entry.AgentID == id { continue }
            defender := agents[entry.AgentID]
            if !defender.Alive || tick < defender.GracePeriodEnd { continue }

            dist := distance(attacker.Position, Position{entry.X, entry.Y})
            if dist < cfg.AuraRadius {
                defender.TakeDamage(dps, id)
            }
        }
    }
}

// ProcessDash: 부스트 충돌 30% 질량 데미지
func (c *CollisionSystem) ProcessDash(
    agents map[string]*Agent,
    hash *SpatialHash,
    cfg ArenaConfig,
) {
    for id, attacker := range agents {
        if !attacker.Alive || !attacker.Boosting { continue }

        nearby := hash.QueryAgents(attacker.Position, cfg.HitboxMaxRadius*2)
        for _, entry := range nearby {
            if entry.AgentID == id { continue }
            defender := agents[entry.AgentID]
            if !defender.Alive { continue }

            dist := distance(attacker.Position, Position{entry.X, entry.Y})
            if dist < attacker.HitboxRadius + defender.HitboxRadius {
                damage := defender.Mass * cfg.DashDamageRatio
                // Berserker 시너지: 3배
                if attacker.HasSynergy("berserker") { damage *= 3.0 }
                defender.TakeDamage(damage, id)
            }
        }
    }
}
```

### 5.5 Spatial Hash

```go
type SpatialHash struct {
    cellSize   float64           // 200px
    agentCells map[int64][]AgentEntry  // cellKey → entries
    orbCells   map[int64][]OrbEntry
}

type AgentEntry struct {
    AgentID string
    X, Y    float64
}

// cellKey: 정수 좌표 인코딩
func cellKey(x, y int) int64 {
    return int64(x)<<32 | int64(uint32(y))
}

func (h *SpatialHash) InsertAgent(id string, pos Position) {
    cx := int(pos.X / h.cellSize)
    cy := int(pos.Y / h.cellSize)
    key := cellKey(cx, cy)
    h.agentCells[key] = append(h.agentCells[key], AgentEntry{id, pos.X, pos.Y})
}

func (h *SpatialHash) QueryAgents(center Position, radius float64) []AgentEntry {
    minCX := int((center.X - radius) / h.cellSize)
    maxCX := int((center.X + radius) / h.cellSize)
    minCY := int((center.Y - radius) / h.cellSize)
    maxCY := int((center.Y + radius) / h.cellSize)

    var result []AgentEntry  // 풀링 가능
    for cx := minCX; cx <= maxCX; cx++ {
        for cy := minCY; cy <= maxCY; cy++ {
            key := cellKey(cx, cy)
            result = append(result, h.agentCells[key]...)
        }
    }
    return result
}
```

### 5.6 Upgrade System

```go
type UpgradeSystem struct {
    tomes     []TomeDef      // 8종
    abilities []AbilityDef   // 6종
    synergies []SynergyDef   // 10종
}

func (u *UpgradeSystem) GenerateChoices(agent *Agent) []UpgradeChoice {
    choices := make([]UpgradeChoice, 0, 3)
    usedIDs := make(map[string]bool)

    for len(choices) < 3 {
        if rand.Float64() < 0.35 { // 35% Ability
            if c := u.genAbilityChoice(agent, usedIDs); c != nil {
                choices = append(choices, *c)
            }
        } else { // 65% Tome
            if c := u.genTomeChoice(agent, usedIDs); c != nil {
                choices = append(choices, *c)
            }
        }
    }
    return choices
}

func (u *UpgradeSystem) CheckSynergies(build PlayerBuild) []string {
    var active []string
    for _, syn := range u.synergies {
        if syn.RequirementsMet(build) {
            active = append(active, syn.ID)
        }
    }
    return active
}
```

### 5.7 Arena Shrink

```go
type ArenaShrink struct {
    currentRadius float64
    minRadius     float64
    shrinkPerTick float64    // 0.5 px/tick (600px/min ÷ 60 ÷ 20)
    penaltyRate   float64    // 0.0025 (0.25%/tick)
    enabled       bool
}

func (s *ArenaShrink) Update(agents map[string]*Agent) {
    if !s.enabled { return }
    if s.currentRadius > s.minRadius {
        s.currentRadius -= s.shrinkPerTick
    }

    for _, agent := range agents {
        if !agent.Alive { continue }
        dist := distanceFromOrigin(agent.Position)
        if dist > s.currentRadius {
            // 질량 페널티
            agent.Mass -= agent.Mass * s.penaltyRate
            // 중심으로 밀기
            angle := math.Atan2(-agent.Position.Y, -agent.Position.X)
            agent.Position.X = math.Cos(angle) * s.currentRadius * 0.99
            agent.Position.Y = math.Sin(angle) * s.currentRadius * 0.99
        }
    }
}
```

---

## 6. WebSocket Protocol

### 6.1 Socket.IO → Raw WebSocket 전환

**이유**: Socket.IO는 자체 프로토콜 (polling fallback, 패킷 프레이밍, heartbeat 등) 위에 동작.
Go에서 Socket.IO 호환 라이브러리는 불안정. Raw WebSocket이 더 빠르고 안정적.

### 6.2 메시지 프레임 포맷

```json
// Client → Server
{ "e": "event_name", "d": { ...payload } }

// Server → Client
{ "e": "event_name", "d": { ...payload } }
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `e` | string | 이벤트 이름 (join_room, input, state, death, ...) |
| `d` | object | 이벤트 데이터 (기존 페이로드 동일) |

### 6.3 이벤트 매핑 (기존 Socket.IO → WebSocket)

**Client → Server:**

| 이벤트 | 페이로드 | Rate Limit |
|--------|----------|------------|
| `join_room` | `{ roomId, name, skinId }` | 1/s |
| `leave_room` | `{}` | - |
| `input` | `{ a: angle, b: 0\|1, s: seq }` | 30/s |
| `respawn` | `{ name?, skinId? }` | 1/s |
| `choose_upgrade` | `{ choiceId }` | - |
| `ping` | `{ t }` | 5/s |

**Server → Client:**

| 이벤트 | 페이로드 | 빈도 |
|--------|----------|------|
| `joined` | `{ roomId, id, spawn, arena, tick, roomState, timeRemaining }` | 1회 |
| `state` | `{ t, s: [agents], o: [orbs], l?: [leaderboard] }` | 20Hz |
| `death` | `{ score, kills, duration, rank, killer?, damageSource, level }` | 사망 시 |
| `kill` | `{ victim, victimMass }` | 킬 시 |
| `minimap` | `{ snakes: [{x,y,m,me}], boundary }` | 1Hz |
| `pong` | `{ t, st }` | 응답 |
| `rooms_update` | `{ rooms: [RoomInfo], recentWinners }` | 1Hz |
| `round_start` | `{ countdown }` | 상태 전환 |
| `round_end` | `{ winner, finalLeaderboard, yourRank, yourScore }` | 상태 전환 |
| `round_reset` | `{ roomState }` | 상태 전환 |
| `level_up` | `{ level, choices, timeoutTicks }` | 레벨업 시 |
| `synergy_activated` | `{ synergyId, name, description }` | 시너지 달성 시 |
| `arena_shrink` | `{ currentRadius, minRadius, shrinkRate }` | 1Hz |
| `error` | `{ code, message }` | 에러 시 |

### 6.4 Hub 설계 (agent_arena 패턴)

```go
type Hub struct {
    rooms      map[string]map[*Client]bool  // roomID → clients
    register   chan *Registration
    unregister chan *Client
    broadcast  chan *BroadcastMsg
    roomcast   chan *RoomcastMsg             // 특정 Room에만
    unicast    chan *UnicastMsg              // 특정 Client에만
    done       chan struct{}
}

type BroadcastMsg struct {
    Event string
    Data  json.RawMessage
}

type RoomcastMsg struct {
    RoomID  string
    Event   string
    Data    json.RawMessage
    Exclude string   // 제외할 clientID (선택)
}

type UnicastMsg struct {
    ClientID string
    Event    string
    Data     json.RawMessage
}

// Run: 단일 goroutine, 모든 라우팅 처리 (lock-free)
func (h *Hub) Run() {
    for {
        select {
        case reg := <-h.register:
            if h.rooms[reg.RoomID] == nil {
                h.rooms[reg.RoomID] = make(map[*Client]bool)
            }
            h.rooms[reg.RoomID][reg.Client] = true

        case client := <-h.unregister:
            for roomID, clients := range h.rooms {
                if clients[client] {
                    delete(clients, client)
                    if len(clients) == 0 { delete(h.rooms, roomID) }
                    break
                }
            }
            close(client.send)

        case msg := <-h.broadcast:
            // 모든 연결에 전송 (로비 업데이트)
            for _, clients := range h.rooms {
                for client := range clients {
                    h.trySend(client, msg.Data)
                }
            }
            // + 로비 대기 클라이언트 (rooms["lobby"])

        case msg := <-h.roomcast:
            // 특정 Room에만 전송
            if clients, ok := h.rooms[msg.RoomID]; ok {
                for client := range clients {
                    if client.ID != msg.Exclude {
                        h.trySend(client, msg.Data)
                    }
                }
            }

        case msg := <-h.unicast:
            // 특정 클라이언트에만
            h.sendToClient(msg.ClientID, msg.Data)

        case <-h.done:
            return
        }
    }
}

func (h *Hub) trySend(client *Client, data []byte) {
    select {
    case client.send <- data:
    default:
        // 버퍼 초과 → 클라이언트 추방
        h.closeClient(client)
    }
}
```

### 6.5 Binary 최적화 (Phase 2)

Phase 1에서는 JSON 사용. Phase 2에서 성능 병목 시:
- **MessagePack**: JSON 대비 30-50% 크기 감소
- **Protobuf**: 스키마 기반, 최대 압축
- **Custom binary**: state 이벤트만 바이너리 (나머지 JSON 유지)

```
JSON state (50 agents): ~8KB/tick
MessagePack:            ~5KB/tick  (-37%)
Custom binary:          ~2KB/tick  (-75%)
```

---

## 7. Client Adaptation

### 7.1 변경 범위 (최소한)

프론트엔드는 Three.js/R3F 렌더링을 그대로 유지. **네트워크 레이어만 교체**.

| 파일 | 변경 내용 |
|------|----------|
| `hooks/useSocket.ts` | Socket.IO → Native WebSocket 어댑터 |
| `package.json` | `socket.io-client` 의존성 제거 |
| 나머지 모든 파일 | **변경 없음** (이벤트 페이로드 동일) |

### 7.2 WebSocket 어댑터 (~80줄)

```typescript
// hooks/useWebSocket.ts
class GameSocket {
  private ws: WebSocket | null = null;
  private listeners = new Map<string, Set<Function>>();
  private reconnectAttempts = 0;

  connect(url: string) {
    this.ws = new WebSocket(url);
    this.ws.onmessage = (event) => {
      const { e, d } = JSON.parse(event.data);
      this.listeners.get(e)?.forEach(fn => fn(d));
    };
    this.ws.onclose = () => this.reconnect(url);
  }

  emit(event: string, data?: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ e: event, d: data }));
    }
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback?: Function) {
    if (callback) this.listeners.get(event)?.delete(callback);
    else this.listeners.delete(event);
  }

  disconnect() { this.ws?.close(); }

  private reconnect(url: string) {
    if (this.reconnectAttempts < 5) {
      setTimeout(() => {
        this.reconnectAttempts++;
        this.connect(url);
      }, 1000 * this.reconnectAttempts);
    }
  }
}
```

### 7.3 useSocket 훅 최소 변경

```diff
- import { io, Socket } from 'socket.io-client';
+ import { GameSocket } from './useWebSocket';

- const socket = io(serverUrl, { ... });
+ const socket = new GameSocket();
+ socket.connect(serverUrl.replace('http', 'ws') + '/ws');

// 나머지 socket.on(), socket.emit() 인터페이스 동일
```

> **영향 범위**: useSocket.ts 한 파일만 수정하면 전체 게임이 새 Go 서버와 연동

---

## 8. Performance Budget

### 8.1 틱 성능 예산 (50ms/Room)

| 단계 | 예상 시간 | 비율 |
|------|----------|------|
| Bot AI 업데이트 (15봇) | 0.1ms | 0.2% |
| Agent 물리 (100명) | 0.2ms | 0.4% |
| Arena 수축 + 경계 체크 | 0.05ms | 0.1% |
| Spatial Hash 재구축 | 0.3ms | 0.6% |
| Aura 전투 (100명) | 0.5ms | 1.0% |
| Dash 충돌 | 0.1ms | 0.2% |
| 사망/XP 처리 | 0.05ms | 0.1% |
| Orb 수집 (100명 × ~50 orbs) | 0.2ms | 0.4% |
| 리더보드 정렬 | 0.01ms | 0.02% |
| **State 직렬화 (100명분)** | **1.0ms** | **2.0%** |
| **WebSocket 전송 (Hub channel)** | **0.1ms** | **0.2%** |
| **합계** | **~2.6ms** | **5.2%** |
| **여유** | **47.4ms** | **94.8%** |

### 8.2 메모리 예산 (5,000 CCU)

| 컴포넌트 | 크기 | 수 | 합계 |
|----------|------|------|------|
| Agent struct | ~512B | 5,000 | 2.5MB |
| Orb struct | ~64B | 50,000 | 3.2MB |
| SpatialHash grid | ~4B/cell | 50 × 900 | 0.2MB |
| Client struct + channels | ~8KB | 5,000 | 40MB |
| Goroutine stack | ~2KB | 10,055 | 20MB |
| JSON serialize buffer | ~16KB/room | 50 | 0.8MB |
| **합계** | | | **~67MB** |

> Railway Basic: 512MB → 여유 445MB (87%)

### 8.3 네트워크 대역폭

| 데이터 | 크기 | 빈도 | 대역폭/플레이어 |
|--------|------|------|-----------------|
| State (50 visible agents) | ~4KB | 20Hz | 80 KB/s |
| Minimap | ~500B | 1Hz | 0.5 KB/s |
| Arena shrink | ~50B | 1Hz | 0.05 KB/s |
| Rooms update | ~200B | 1Hz | 0.2 KB/s |
| **합계** | | | **~81 KB/s** |

5,000 CCU → 81 × 5,000 = **405 MB/s outbound**
→ 1Gbps 서버 기준 ~40% 사용 (Phase 2에서 바이너리 최적화 시 ~15%로 감소)

---

## 9. Scaling Strategy

### 9.1 단일 인스턴스 한계 추정

| 지표 | 값 |
|------|------|
| 최대 Room 수 | 50 |
| Room당 최대 플레이어 | 100 (Human + Bot) |
| 최대 CCU | 5,000 |
| CPU 사용률 (예상) | ~30% (4 vCPU) |
| 메모리 사용률 | ~67MB / 512MB |
| 네트워크 outbound | ~405 MB/s |

### 9.2 수평 확장 (Phase 3, 필요시)

```
                    ┌──────────────┐
                    │  Load Balancer │  (Sticky Session by roomID)
                    └──────┬───────┘
                    ┌──────┴───────┐
              ┌─────┤   Redis Pub/Sub ├─────┐
              │     └──────────────┘       │
    ┌─────────┴──────────┐    ┌──────────┴─────────┐
    │  Go Server #1       │    │  Go Server #2       │
    │  Room 1~25          │    │  Room 26~50         │
    │  ~2,500 CCU         │    │  ~2,500 CCU         │
    └────────────────────┘    └────────────────────┘
```

**전략**:
1. **Phase 1**: 단일 인스턴스 (Railway) — 현재 규모 충분
2. **Phase 2**: Room Sharding — Redis Pub/Sub로 Room을 인스턴스에 분배
3. **Phase 3**: Global — CDN + 지역별 인스턴스 (한국, 미국, EU)

### 9.3 Railway 배포

```dockerfile
# Dockerfile (멀티스테이지)
FROM golang:1.24-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /server ./cmd/server

FROM scratch
COPY --from=builder /server /server
EXPOSE 8000
ENTRYPOINT ["/server"]
```

**railway.json** 업데이트:
```json
{
  "build": { "builder": "DOCKERFILE", "dockerfilePath": "server/Dockerfile" },
  "deploy": { "startCommand": "./server", "restartPolicyType": "ON_FAILURE" }
}
```

### 9.4 Health Check & Monitoring

```go
// GET /health
type HealthResponse struct {
    Status       string            `json:"status"`
    Uptime       string            `json:"uptime"`
    Rooms        int               `json:"rooms"`
    TotalPlayers int               `json:"totalPlayers"`
    Memory       runtime.MemStats  `json:"memory"`
    Goroutines   int               `json:"goroutines"`
    TickLatency  map[string]string `json:"tickLatency"` // per-room p99
}

// GET /metrics (Prometheus, 선택)
// game_room_players{room="room-1"} 45
// game_tick_duration_ms{room="room-1",quantile="0.99"} 1.2
// game_ws_connections_total 2340
// game_orbs_total 25000
```

---

## 10. Migration & Timeline

### 10.1 Phase 1: Core Server (Week 1-2)

| 작업 | 파일 | 우선순위 |
|------|------|---------|
| 프로젝트 초기화 (go mod, 디렉토리) | `server/` | P0 |
| Config + Main + Graceful Shutdown | `cmd/server/main.go`, `config/` | P0 |
| HTTP Router + Middleware (CORS, Health) | `server/router.go` | P0 |
| WebSocket Hub (channel-based) | `ws/hub.go` | P0 |
| Client ReadPump + WritePump | `ws/client.go` | P0 |
| Domain Types (Agent, Orb, Position, etc.) | `domain/types.go` | P0 |
| Event Types (JSON 태그) | `domain/events.go` | P0 |
| Game Constants | `game/constants.go` | P0 |

### 10.2 Phase 2: Game Systems (Week 2-3)

| 작업 | 파일 | 우선순위 |
|------|------|---------|
| Agent Entity (물리, 전투, 빌드) | `game/agent.go` | P0 |
| SpatialHash (Grid 기반) | `game/spatial_hash.go` | P0 |
| CollisionSystem (Aura + Dash) | `game/collision.go` | P0 |
| OrbManager (스폰, 수집, death orb) | `game/orb.go` | P0 |
| ArenaShrink (수축 + 페널티) | `game/shrink.go` | P1 |
| UpgradeSystem (Tome/Ability/Synergy) | `game/upgrade.go` | P1 |
| Arena (20Hz game loop 오케스트레이터) | `game/arena.go` | P0 |
| StateSerializer (뷰포트 컬링) | `game/serializer.go` | P0 |
| Leaderboard | `game/leaderboard.go` | P2 |

### 10.3 Phase 3: Room & Bot System (Week 3-4)

| 작업 | 파일 | 우선순위 |
|------|------|---------|
| Room State Machine | `game/room.go` | P0 |
| RoomManager (생명주기, Quick Join) | `game/room_manager.go` | P0 |
| BotManager + BotBehaviors | `game/bot.go` | P1 |
| Lobby Broadcasting (1Hz rooms_update) | `game/room_manager.go` | P1 |
| Rate Limiter | `ws/client.go` (내장) | P1 |

### 10.4 Phase 4: Client Adaptation & Integration (Week 4)

| 작업 | 파일 | 우선순위 |
|------|------|---------|
| WebSocket 어댑터 (Socket.IO → native) | `apps/web/hooks/useWebSocket.ts` | P0 |
| useSocket.ts 수정 | `apps/web/hooks/useSocket.ts` | P0 |
| 통합 테스트 (로컬) | `game.sh` 수정 | P0 |
| Railway Dockerfile + 배포 | `server/Dockerfile` | P0 |
| game.sh 업데이트 (Go 서버 빌드+실행) | `game.sh` | P1 |

### 10.5 Phase 5: Optimization (Week 5, 선택)

| 작업 | 설명 |
|------|------|
| Object pooling | Agent, Orb, []AgentEntry 풀링 |
| Binary protocol | State 이벤트 MessagePack 전환 |
| Prometheus metrics | 운영 모니터링 |
| Load testing | 1,000+ 동시 봇 부하 테스트 |
| Profiling | pprof CPU/Memory 프로파일링 |

### 10.6 총 일정

```
Week 1: ████████ Core infra (config, hub, ws, types)
Week 2: ████████ Game systems (agent, collision, orb, arena)
Week 3: ████████ Room/Bot + upgrade system
Week 4: ████████ Client adapter + integration + deploy
Week 5: ████░░░░ Optimization (선택)
```

**총 4주 (핵심) + 1주 (최적화) = 5주**

### 10.7 Migration Strategy

```
1. Go 서버 개발 (server/ 폴더, 기존 TS 서버와 병행)
2. 로컬 테스트 (game.sh → Go 서버 + Next.js)
3. 클라이언트 WebSocket 어댑터 적용
4. Railway 새 서비스로 Go 서버 배포
5. DNS 전환 (Go 서버로)
6. 기존 TS 서버 코드 제거 (apps/server/)
```

> **핵심**: Go 서버를 `server/` 폴더에 독립 개발하므로 기존 코드와 충돌 없음

---

## 11. Architecture Decision Records

### ADR-101: Go + Raw WebSocket (Socket.IO 대체)

**Status**: Proposed

**Context**: 현재 서버는 TypeScript + Socket.IO. Go 재작성 시 Socket.IO 호환 라이브러리(`go-socket.io`)는 불안정하고 유지보수 부족.

**Decision**: gorilla/websocket + 커스텀 JSON 프로토콜 사용. 클라이언트에 경량 WebSocket 어댑터 추가.

**Consequences**:
- ✅ 검증된 Go WebSocket 라이브러리 사용
- ✅ Socket.IO 오버헤드 제거 (polling fallback, 패킷 프레이밍)
- ✅ 추후 바이너리 프로토콜 전환 용이
- ⚠️ 클라이언트 useSocket.ts 수정 필요 (1개 파일)
- ⚠️ Socket.IO 자동 재연결 → 수동 구현 필요

---

### ADR-102: Channel-based Hub (Lock-free)

**Status**: Proposed

**Context**: WebSocket 메시지 라우팅에 두 가지 접근 — (A) sync.RWMutex 기반 맵 보호, (B) 단일 goroutine + channel 이벤트 루프.

**Decision**: agent_arena의 channel-based Hub 패턴 채택. 단일 goroutine이 모든 register/unregister/broadcast를 처리.

**Consequences**:
- ✅ Lock-free → 데드락 불가
- ✅ 검증된 패턴 (agent_arena 프로덕션)
- ✅ Room별 격리 (rooms map)
- ⚠️ Hub goroutine이 단일 병목 → 5,000 CCU에서도 충분 (channel 처리 ~0.01ms/msg)

---

### ADR-103: Per-Room Goroutine (독립 게임 루프)

**Status**: Proposed

**Context**: 50개 Room의 20Hz 게임 루프를 어떻게 실행할 것인가.

**Decision**: 각 Room이 독립 goroutine에서 `time.Ticker(50ms)` 기반으로 실행. Room goroutine이 해당 Room의 모든 게임 상태를 독점 소유.

**Consequences**:
- ✅ True parallelism — Room 간 CPU 격리
- ✅ 동기화 불필요 (Room 내부 상태는 단일 goroutine 소유)
- ✅ Room 추가/제거가 goroutine 시작/종료로 단순
- ⚠️ 50개 goroutine × 20Hz = 1,000 tick/s (사소한 부하)

---

### ADR-104: 별도 `server/` 폴더 (모노레포 내 Go 프로젝트)

**Status**: Proposed

**Context**: Go 서버를 기존 `apps/server/` (TypeScript)와 어떻게 공존시킬 것인가.

**Decision**: 프로젝트 루트에 `server/` 폴더를 생성하여 독립 Go 모듈로 관리. 기존 `apps/server/`는 마이그레이션 완료 후 제거.

**Consequences**:
- ✅ 기존 TS 서버와 독립적으로 개발 가능
- ✅ `go.mod`이 루트 `package.json`과 충돌 없음
- ✅ Railway에서 별도 서비스로 배포 가능
- ✅ Dockerfile로 빌드 → 단일 바이너리 배포
- ⚠️ shared types는 Go에서 재정의 필요 (TypeScript ↔ Go 공유 불가)

---

### ADR-105: JSON 우선, Binary 최적화 지연

**Status**: Proposed

**Context**: 게임 상태 직렬화를 JSON vs Binary(MessagePack/Protobuf) 중 선택.

**Decision**: Phase 1에서 JSON 사용. 대역폭 병목 발생 시 Phase 5에서 state 이벤트만 Binary 전환.

**Consequences**:
- ✅ 브라우저 네이티브 JSON.parse (빠름)
- ✅ 디버깅 용이 (WS DevTools에서 메시지 읽기 가능)
- ✅ 클라이언트 변경 최소화
- ⚠️ JSON은 Binary 대비 2-3배 큰 페이로드
- ⚠️ 5,000 CCU 시 대역폭 ~405MB/s → Binary 필요할 수 있음

---

## 12. game.sh 업데이트 계획

```bash
#!/bin/bash
# game.sh (Go 서버 버전)

start_all() {
  # Go 서버 빌드 + 실행
  echo "Building Go server..."
  cd server && go build -o ../bin/server ./cmd/server && cd ..

  echo "Starting Go server on :$SERVER_PORT..."
  PORT=$SERVER_PORT CORS_ORIGIN="http://localhost:$WEB_PORT" \
    ./bin/server > /tmp/snake-server.log 2>&1 &
  SERVER_PID=$!

  # 프론트엔드 (동일)
  echo "Starting web on :$WEB_PORT..."
  cd apps/web && NEXT_PUBLIC_SERVER_URL="ws://localhost:$SERVER_PORT/ws" \
    npx next dev --port $WEB_PORT > /tmp/snake-web.log 2>&1 &
  WEB_PID=$!
}
```

> **차이점**: `npx tsx watch apps/server/src/index.ts` → `go build + ./bin/server`
