# Agent Survivor — System Architecture v10

> **Project**: Agent Survivor (Multiplayer Auto-Combat Survival Roguelike)
> **Version**: v10.1 — Go Server Architecture
> **Date**: 2026-03-06
> **Stack**: Go 1.24 + gorilla/websocket + chi (Server) / Next.js 15 + R3F (Client) / Railway + Vercel (Deploy)
> **Design Docs**: `docs/designs/v10-survival-roguelike-plan.md`, `v10-go-server-plan.md`, `v10-3d-graphics-plan.md`, `v10-ui-ux-plan.md`
> **Roadmap**: `docs/designs/v10-development-roadmap.md` (S01~S59, ~13 weeks)

---

## Table of Contents

1. [System Overview (C4 Level 1)](#1-system-overview-c4-level-1)
2. [Container Diagram (C4 Level 2)](#2-container-diagram-c4-level-2)
3. [Component Design (C4 Level 3)](#3-component-design-c4-level-3)
4. [WebSocket Protocol](#4-websocket-protocol)
5. [Data Flow & State Synchronization](#5-data-flow--state-synchronization)
6. [Client Architecture](#6-client-architecture)
7. [Performance Budget](#7-performance-budget)
8. [Security Considerations](#8-security-considerations)
9. [Infrastructure & Deployment](#9-infrastructure--deployment)
10. [Architecture Decision Records](#10-architecture-decision-records)
11. [Key Constants Reference](#11-key-constants-reference)
12. [Legacy Reference (TypeScript)](#12-legacy-reference-typescript)

---

## 1. System Overview (C4 Level 1)

### 1.1 Context Diagram

```
                          ┌─────────────────────────┐
                          │    Human Players          │
                          │  (Browser / Mobile)       │
                          └────────────┬──────────────┘
                                       │ HTTPS + WSS
                          ┌────────────▼──────────────┐
                          │      Vercel CDN            │
                          │   (Next.js 15 SSG/SSR)     │
                          └────────────┬──────────────┘
                                       │ WSS (JSON frames)
                          ┌────────────▼──────────────┐
                          │   Railway (Go Server)      │
                          │   Go 1.24 Game Server      │
                          │   gorilla/websocket + chi  │
                          │   In-memory game state     │
                          └────────────┬──────────────┘
                                       │ (Future: Phase 4)
                          ┌────────────▼──────────────┐
                          │    AI Agent Clients         │
                          │  (LLM: Claude, GPT, etc.)  │
                          │  via Agent REST/WS API      │
                          └───────────────────────────┘
```

### 1.2 System Boundaries

| Boundary | Inside | Outside |
|----------|--------|---------|
| **Game Server** | All game logic, state, physics, combat | Persistent storage, user accounts |
| **Web Client** | Rendering, input, interpolation, UI | Game logic authority |
| **Shared Protocol** | JSON event frames over WebSocket | Binary protocol (Phase 5) |

### 1.3 Design Principles

| Principle | Application |
|-----------|-------------|
| **Server-Authoritative** | All game state computed server-side. Client is a thin renderer. |
| **In-Memory Only** | No database. Game state lives in Go structs. Stateless across restarts. |
| **Single Binary** | Go compiles to one binary. Deployed via Docker scratch image on Railway. |
| **Per-Room Isolation** | Each Room runs in its own goroutine. No shared mutable state between Rooms. |
| **Channel-Over-Lock** | Hub uses single-goroutine + channels (lock-free). Proven pattern from agent_arena. |
| **Client Compatibility** | JSON event names/payloads match legacy Socket.IO protocol for minimal migration. |

### 1.4 Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Server Language** | Go 1.24 | True concurrency (goroutines), low GC pressure, single binary deploy |
| **HTTP Router** | chi/v5 | Lightweight, middleware-friendly, used in agent_arena/agent_verse |
| **WebSocket** | gorilla/websocket | Battle-tested, per-connection goroutine model |
| **Config** | envconfig | Environment-based config, Railway-native |
| **Orchestration** | errgroup | Graceful shutdown with context cancellation |
| **Logging** | log/slog | Go 1.21+ structured logging standard |
| **Client Framework** | Next.js 15 + React 19 | SSG lobby, CSR game, App Router |
| **3D Rendering** | Three.js 0.175 + R3F 9.5 + Drei 10.7 | MC voxel art style, InstancedMesh pipeline |
| **Frontend Deploy** | Vercel | Auto-deploy from monorepo, edge CDN |
| **Backend Deploy** | Railway | Docker-based, single service, env vars |

---

## 2. Container Diagram (C4 Level 2)

### 2.1 Deployment Topology

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PRODUCTION                                   │
│                                                                     │
│   Vercel (Frontend)                    Railway (Backend)            │
│   ┌─────────────────────┐             ┌──────────────────────┐     │
│   │  Next.js 15 (SSG)   │    WSS      │  Go 1.24 Binary      │     │
│   │  React 19 + R3F     │◄───────────►│  Single Process       │     │
│   │  apps/web/           │  JSON frames│  server/              │     │
│   │                      │  20Hz state │                      │     │
│   │  Static: Lobby HTML  │             │  50 Rooms × 20Hz     │     │
│   │  CSR: Game Canvas    │             │  ~10K goroutines      │     │
│   │  3D: R3F Lobby+Game  │             │  ~67MB RAM @ 5K CCU  │     │
│   └─────────────────────┘             └──────────────────────┘     │
│                                                                     │
│   URL: snake-tonexus.vercel.app        URL: *.up.railway.app       │
│   Env: NEXT_PUBLIC_SERVER_URL          Env: PORT, CORS_ORIGIN      │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Monorepo Structure

```
snake/                                   # Project root
├── server/                              # Go game server (PRIMARY)
│   ├── cmd/server/main.go               # Composition root, errgroup orchestration
│   ├── internal/
│   │   ├── config/config.go             # envconfig-based settings
│   │   ├── server/                      # HTTP layer
│   │   │   ├── router.go               # chi router + middleware
│   │   │   └── middleware.go            # CORS, Recovery, Logging
│   │   ├── ws/                          # WebSocket layer
│   │   │   ├── hub.go                   # Channel-based Hub (lock-free)
│   │   │   ├── client.go               # ReadPump + WritePump goroutines
│   │   │   ├── protocol.go             # JSON frame encode/decode
│   │   │   ├── broadcaster.go          # Room/lobby broadcast helpers
│   │   │   └── dispatcher.go           # Event routing (event name → handler)
│   │   ├── game/                        # Core game logic (28 files)
│   │   │   ├── arena.go                # 20Hz game loop orchestrator
│   │   │   ├── room.go                 # Room state machine (895 LOC)
│   │   │   ├── room_manager.go         # Room lifecycle + Quick Join
│   │   │   ├── agent.go               # Agent entity (position, mass, build)
│   │   │   ├── collision.go            # Aura DPS + Dash burst combat
│   │   │   ├── upgrade.go             # Tome/Ability/Synergy system
│   │   │   ├── orb.go                 # Orb spawn/collection/death orbs
│   │   │   ├── shrink.go              # Arena boundary shrink + penalty
│   │   │   ├── spatial_hash.go        # Grid-based spatial indexing
│   │   │   ├── serializer.go          # Viewport culling + JSON serialization
│   │   │   ├── leaderboard.go         # Score ranking (Top 10)
│   │   │   ├── bot.go                 # Bot AI (spawn, behavior, build paths)
│   │   │   ├── build_path.go          # 5 preset build strategies
│   │   │   ├── map_objects.go         # Shrine/Spring/Altar/Gate
│   │   │   ├── training.go            # Agent training profiles
│   │   │   ├── agent_api.go           # REST API for AI agents
│   │   │   ├── quest.go               # Daily/weekly quest system
│   │   │   ├── global_stats.go        # Aggregate statistics
│   │   │   ├── personality.go         # Bot personality types
│   │   │   ├── meta.go                # Meta progression (RP, unlocks)
│   │   │   ├── coach.go               # AI Coach system
│   │   │   ├── analyst.go             # AI Analyst system
│   │   │   └── constants.go           # All game constants
│   │   └── domain/                      # Pure types (no imports from internal/)
│   │       ├── types.go                # Agent, Orb, Position, PlayerBuild
│   │       ├── events.go              # WS event payloads (JSON tags)
│   │       ├── skins.go               # 34 preset AgentSkin definitions
│   │       └── upgrades.go            # Tome/Ability/Synergy definition tables
│   ├── go.mod, go.sum
│   └── Dockerfile                       # Multi-stage (golang:1.24 → scratch)
│
├── apps/web/                            # Next.js 15 client
│   ├── app/
│   │   ├── layout.tsx                  # Root layout (fonts, metadata)
│   │   └── page.tsx                    # Main: lobby ↔ playing mode switch
│   ├── components/
│   │   ├── game/                       # In-game UI (13 components)
│   │   │   ├── GameCanvas.tsx          # 2D Canvas renderer
│   │   │   ├── GameCanvas3D.tsx        # R3F 3D renderer
│   │   │   ├── LevelUpOverlay.tsx      # 3-choice upgrade cards
│   │   │   ├── BuildHUD.tsx            # Tome stacks + Ability slots
│   │   │   ├── XPBar.tsx               # MC experience bar
│   │   │   ├── ShrinkWarning.tsx       # Arena boundary warning
│   │   │   ├── SynergyPopup.tsx        # Gold enchant notification
│   │   │   ├── DeathOverlay.tsx        # Death screen + stats
│   │   │   ├── RoundTimerHUD.tsx       # MM:SS countdown
│   │   │   ├── CountdownOverlay.tsx    # 10→0 round start
│   │   │   ├── RoundResultOverlay.tsx  # Round results
│   │   │   ├── CoachOverlay.tsx        # AI Coach tips
│   │   │   └── AnalystPanel.tsx        # AI Analyst stats
│   │   ├── lobby/                      # Lobby UI (MC inventory style, 15 components)
│   │   │   ├── McPanel.tsx, McButton.tsx, McInput.tsx  # Design system
│   │   │   ├── RoomList.tsx            # Server browser
│   │   │   ├── CharacterCreator.tsx    # 5-tier MC skin customization
│   │   │   ├── TrainingConsole.tsx     # Agent training rules editor
│   │   │   ├── PersonalitySelector.tsx # Bot personality picker
│   │   │   ├── QuestPanel.tsx          # Quest tracker
│   │   │   ├── RPPanel.tsx             # Reputation Points display
│   │   │   └── ...                     # LobbyScene3D, RecentWinners, etc.
│   │   └── 3d/                         # R3F 3D components (11 files)
│   │       ├── Scene.tsx, SkyBox.tsx, VoxelTerrain.tsx
│   │       ├── VoxelSnake.tsx          # → VoxelAgent.tsx (Phase 3)
│   │       ├── VoxelOrbs.tsx, VoxelBoundary.tsx
│   │       ├── GameLoop.tsx, PlayCamera.tsx, LobbyCamera.tsx
│   │       └── SnakeGroup.tsx, CameraSystem.tsx
│   ├── hooks/
│   │   ├── useSocket.ts               # Socket.IO adapter (legacy)
│   │   ├── useWebSocket.ts            # Native WebSocket adapter (Go server)
│   │   ├── useInput.ts                # Keyboard/touch input → angle + boost
│   │   └── useGameLoop.ts             # requestAnimationFrame loop
│   └── lib/
│       ├── camera.ts                   # Camera lerp + dynamic zoom
│       ├── interpolation.ts            # Client-side state interpolation
│       ├── minecraft-ui.ts             # MC design system tokens
│       ├── sprites.ts                  # 2D sprite generation
│       ├── renderer/                   # 2D Canvas pipeline
│       └── 3d/                         # 3D utility (textures, coords, noise)
│
├── packages/shared/                     # Shared types + constants (TS only)
│   └── src/types/, constants/, utils/   # Re-exported to apps/web
│
├── docs/
│   ├── designs/                        # Design documents
│   │   ├── v10-survival-roguelike-plan.md  # Master game design (2500+ LOC)
│   │   ├── v10-go-server-plan.md           # Go server architecture
│   │   ├── v10-3d-graphics-plan.md         # 3D rendering + gameplay detail
│   │   ├── v10-ui-ux-plan.md               # UI/UX specification
│   │   └── v10-development-roadmap.md      # S01~S59 execution roadmap
│   ├── adr/                            # Architecture Decision Records (ADR-001~015)
│   ├── api/                            # API specifications
│   ├── diagrams/                       # Mermaid diagrams
│   └── security/                       # Threat model
│
└── ARCHITECTURE.md                     # THIS FILE
```

### 2.3 Package Dependency Direction (Go Server)

```
cmd/server/main.go
    ├──→ internal/config         (settings)
    ├──→ internal/server         (HTTP router)
    │        └──→ internal/ws    (WebSocket hub, client)
    │                 └──→ internal/domain  (pure types)
    ├──→ internal/game           (game logic)
    │        └──→ internal/domain  (pure types)
    └──→ internal/ws             (hub injection)

Rule: domain/ imports NOTHING from internal/.
      All dependencies flow downward. No cycles.
```

---

## 3. Component Design (C4 Level 3)

### 3.1 Go Server — Goroutine Architecture

```
main goroutine (cmd/server/main.go)
│
├── [1] HTTP Server goroutine                    (chi.ListenAndServe)
│       └── /ws → WebSocket upgrade handler
│       └── /health → Health check endpoint
│       └── /api/v1/agent/* → Agent REST API (Phase 4)
│
├── [1] WS Hub goroutine                         (channel-based, NO LOCKS)
│       ├── register channel   ← new clients
│       ├── unregister channel ← disconnected clients
│       ├── broadcast channel  ← lobby updates (all clients)
│       ├── roomcast channel   ← room-specific events
│       └── unicast channel    ← per-client events (joined, death, level_up)
│
├── [1] RoomManager goroutine                    (room lifecycle)
│       ├── Room goroutine × N (default 5, max 50)
│       │   ├── 20Hz game ticker (time.Ticker 50ms)
│       │   ├── 1Hz state ticker (room state transitions)
│       │   ├── inputChan ← player inputs from ReadPump
│       │   ├── joinChan  ← join requests from RoomManager
│       │   └── leaveChan ← leave notifications
│       └── 1Hz lobby broadcaster (rooms_update → all connections)
│
├── Per WebSocket Connection (×N clients):
│   ├── [1] ReadPump goroutine   (client → server messages)
│   ├── [1] WritePump goroutine  (server → client messages)
│   └── Buffered channel (64 msgs, backpressure)
│
└── [1] Signal Watcher goroutine                 (SIGINT/SIGTERM → graceful shutdown)
```

**Goroutine Count at 5,000 CCU**:

| Component | Count | Memory |
|-----------|-------|--------|
| Fixed (main, signal, hub, room_mgr) | 4 | 8KB |
| Room game loops | 50 | 100KB |
| Client ReadPump | 5,000 | 10MB |
| Client WritePump | 5,000 | 10MB |
| **Total** | **~10,054** | **~20MB** |

### 3.2 Game Loop — Arena.Tick() (20Hz)

Each Room's goroutine calls `Arena.Tick()` every 50ms. The tick pipeline is deterministic
and single-threaded within each Room (no locks needed).

```
Arena.Tick() — executed in Room goroutine every 50ms
│
├── 0. Bot AI Update          (botManager.Update)
│      └── BotBehaviors: steering, target selection, build path decisions
│
├── 1. Agent Physics          (agent.Update for each alive agent)
│      ├── Steering: angle lerp toward targetAngle
│      ├── Boost cost: mass -= boostCostPerTick if boosting
│      ├── Speed Tome bonus: speed *= (1 + stacks * 0.10)
│      ├── Position update: pos += heading * speedPerTick
│      ├── Hitbox recalc: 16~22px based on mass
│      └── Regen Tome: mass += stacks * 0.025/tick
│
├── 2. Arena Shrink           (shrink.Update)
│      ├── Radius -= 0.5 px/tick (600px/min)
│      └── Agents outside: mass penalty + push inward
│
├── 3. Spatial Hash Rebuild   (spatialHash.Clear + InsertAll)
│      ├── Insert all alive agents
│      └── Insert all orbs
│
├── 4. Aura Combat            (collision.ProcessAura)
│      └── For each agent pair within 60px: apply DPS (Tome/Synergy scaled)
│
├── 5. Dash Collisions        (collision.ProcessDash)
│      └── Boosting agents hitting others: 30% mass burst damage
│
├── 6. Death Detection        (collision.DetectDeaths)
│      └── mass ≤ 0 or boundary 110%+ → death event
│
├── 7. Death Processing       (collision.ProcessDeaths)
│      └── Spawn death orbs (80% mass), award kill XP
│
├── 8. Effect Processing      (processEffects)
│      └── Ability auto-triggers, effect expiry
│
├── 9. Orb Collection         (processOrbCollection)
│      ├── Collect orbs within radius (50px + Magnet Tome bonus)
│      ├── Add mass + XP
│      └── Check level-up → generate 3 upgrade choices
│
├── 10. Upgrade Timeouts      (upgrade.ProcessTimeouts)
│       └── 5s (100 ticks) no selection → random choice applied
│
├── 11. Leaderboard Update    (every 20 ticks / 1 second)
│
├── 12. Orb Maintenance       (orbManager.Maintain)
│       └── Spawn natural orbs to maintain target count
│
└── 13. Expired Orb Cleanup   (every 20 ticks / 1 second)
```

### 3.3 Room State Machine

```
                     MIN_PLAYERS reached
    ┌──────────┐ ─────────────────────────→ ┌──────────────┐
    │ WAITING  │                              │ COUNTDOWN    │
    │          │ ◄───────────────────────── │ (10 seconds) │
    └──────────┘   players < MIN during       └──────┬───────┘
         ▲         countdown                         │ timer = 0
         │                                           ▼
    ┌────┴──────┐                             ┌──────────────┐
    │ COOLDOWN  │ ◄────────────────────────── │  PLAYING     │
    │ (15 sec)  │     winner or timer = 0     │ (300 sec)    │
    └───────────┘ ─── timer = 0 ──→ WAITING   │ 20Hz ticks   │
         ▲                                     └──────┬───────┘
         │                                            │ 1 agent alive
    ┌────┴──────┐                                     │ OR timer = 0
    │  ENDING   │ ◄───────────────────────────────────┘
    │ (5 sec)   │
    └───────────┘
```

**State Transitions**:

| From | To | Trigger | Action |
|------|-----|---------|--------|
| Waiting | Countdown | Human count >= MIN_PLAYERS (2) | Start 10s countdown, broadcast `round_start` |
| Countdown | Waiting | Human count < MIN_PLAYERS | Cancel countdown, broadcast `round_reset` |
| Countdown | Playing | Timer reaches 0 | Start Arena tick loop, spawn bots, enable shrink |
| Playing | Ending | 1 alive or timer = 0 | Stop ticks, determine winner, broadcast `round_end` |
| Ending | Cooldown | Timer reaches 0 | Show final results |
| Cooldown | Waiting | Timer reaches 0 | Reset Arena, clear agents, broadcast `round_reset` |

### 3.4 Core Subsystem Interactions

```
┌─────────────────────────────────────────────────────────┐
│                    Room Goroutine                        │
│                                                         │
│  ┌─────────┐      ┌─────────────┐      ┌────────────┐ │
│  │  Arena   │─────►│ SpatialHash │◄─────│ OrbManager │ │
│  │ (Tick)   │      │             │      │            │ │
│  └────┬─────┘      └──────┬──────┘      └────────────┘ │
│       │                   │                             │
│  ┌────▼─────┐      ┌──────▼──────┐      ┌────────────┐ │
│  │ Agent[]  │◄─────│  Collision  │─────►│ Leaderboard│ │
│  │          │      │  System     │      │            │ │
│  └────┬─────┘      └─────────────┘      └────────────┘ │
│       │                                                 │
│  ┌────▼─────┐      ┌─────────────┐      ┌────────────┐ │
│  │ Upgrade  │      │  BotManager │      │ ArenaShrink│ │
│  │ System   │      │             │      │            │ │
│  └──────────┘      └─────────────┘      └────────────┘ │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Serializer                           │   │
│  │  (viewport culling → JSON → Hub.roomcast)        │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
         │ roomcast/unicast via channels
         ▼
┌─────────────────────┐
│   WS Hub Goroutine  │
│   (lock-free router)│
│   rooms map → Client│
│   WritePump → conn  │
└─────────────────────┘
```

### 3.5 Synchronization Strategy

| Shared Resource | Sync Method | Rationale |
|-----------------|-------------|-----------|
| **WS Hub rooms map** | Single goroutine + channels | Lock-free, proven in agent_arena |
| **Room internal state** | Room goroutine exclusive ownership | No locks; single writer |
| **Player input** | Buffered channel (ReadPump → Room) | Async, backpressure-safe |
| **State broadcast** | Room → Hub roomcast channel | Serialized bytes, no copy needed |
| **RoomManager rooms** | sync.RWMutex | Join/Leave from external goroutines |
| **Rate limiter state** | sync.Map per client | Per-connection, atomic ops |

### 3.6 Entity Model — Agent (v10)

```go
// server/internal/domain/types.go
type Agent struct {
    ID               string         // Unique agent identifier
    Name             string         // Display name
    Position         Position       // Single coordinate (x, y)
    Heading          float64        // Current direction (radians)
    TargetAngle      float64        // Input-requested direction
    Speed            float64        // Current speed (px/s)
    Mass             float64        // HP role (damage reduces mass)
    Level            int            // Current level (1~12)
    XP               int            // Current XP toward next level
    XPToNext         int            // Required XP for next level
    Boosting         bool           // Dash state
    Alive            bool           // Death flag
    Build            PlayerBuild    // Tome stacks + Ability slots
    ActiveSynergies  []string       // Currently active synergy IDs
    Skin             AgentSkin      // MC character customization (5-tier)
    ActiveEffects    []ActiveEffect // Temporary buffs
    EffectCooldowns  []EffectCooldown
    Score            int
    Kills            int
    KillStreak       int
    HitboxRadius     float64        // Dynamic: 16~22px based on mass
    LastDamagedBy    string         // Kill credit tracking
    PendingChoices   []UpgradeChoice // nil = no pending level-up
    UpgradeDeadline  uint64          // Tick deadline for choice
    GracePeriodEnd   uint64          // Invulnerability expiry tick
    IsBot            bool
    JoinedAt         time.Time
    LastInputSeq     int
}
```

**Key Design Decisions**:
- **Single Position**: No segments array. Agent is a point entity with hitbox radius.
- **Mass = HP**: Mass decreases from combat damage. Mass 0 = death.
- **Build System**: `PlayerBuild` contains `Tomes map[TomeType]int` (stack counts) and `Abilities []AbilitySlot` (max 2 slots, upgradeable to 3).
- **Synergy Check**: On every level-up, server checks all 10 synergy conditions against current build.

### 3.7 Build System Architecture

```
                    Level-Up Trigger (XP >= XPToNext)
                              │
                    ┌─────────▼──────────┐
                    │ GenerateChoices(3)  │
                    │ 65% Tome / 35% Ability│
                    │ Luck Tome boosts rare│
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
              ┌─────┤  Player Chooses 1   ├─────┐
              │     │  (5s timeout)       │     │
              │     └────────────────────┘     │
              ▼                                ▼
     ┌────────────┐                  ┌────────────┐
     │  Tome:      │                  │  Ability:   │
     │  Stack +1   │                  │  Add/Level  │
     │  Recalc     │                  │  up slot    │
     │  stats      │                  │             │
     └──────┬─────┘                  └──────┬─────┘
            │                               │
            └───────────┬───────────────────┘
                        ▼
              ┌─────────────────┐
              │ CheckSynergies  │
              │ (10 conditions) │
              └────────┬────────┘
                       ▼
              New synergy?  ─yes─→  Apply bonus + broadcast synergy_activated
```

**8 Tomes** (Passive Stackable):

| Tome | Tier | Effect/Stack | Max | Full Effect |
|------|------|-------------|-----|-------------|
| XP | S | +20% XP gain | 10 | +200% |
| Speed | S | +10% move speed | 5 | +50% (225px/s) |
| Damage | S | +15% aura DPS | 10 | +150% |
| Armor | A | -10% damage taken | 8 | -80% |
| Magnet | A | +25% collect radius | 6 | +150% |
| Luck | A | +15% rare upgrade chance | 6 | +90% |
| Regen | B | +0.5 mass/s | 5 | +2.5/s |
| Cursed | S* | +25% DPS, +20% damage taken | 5 | +125% DPS, +100% damage |

**6 Abilities** (Auto-Trigger):
Venom Aura (passive DoT), Shield Burst (15s CD), Lightning Strike (8s CD),
Speed Dash (12s CD), Mass Drain (10s CD), Gravity Well (20s CD)

**10 Synergies** (6 public + 4 hidden):
Holy Trinity, Glass Cannon, Iron Fortress, Speedster, Vampire, Storm, + 4 discovery

---

## 4. WebSocket Protocol

### 4.1 Frame Format

All messages use a compact JSON envelope over native WebSocket (not Socket.IO).

```json
// Client → Server
{ "e": "event_name", "d": { ...payload } }

// Server → Client
{ "e": "event_name", "d": { ...payload } }
```

| Field | Type | Description |
|-------|------|-------------|
| `e` | string | Event name (join_room, input, state, death, ...) |
| `d` | object | Event payload (matches legacy Socket.IO payloads) |

### 4.2 Client → Server Events

| Event | Payload | Rate Limit | Description |
|-------|---------|------------|-------------|
| `join_room` | `{ roomId, name, skinId }` | 1/s | Join a specific room |
| `leave_room` | `{}` | -- | Leave current room |
| `input` | `{ a: angle, b: 0\|1, s: seq }` | 30/s | Movement input (compact) |
| `respawn` | `{ name?, skinId? }` | 1/s | Respawn after death (bots only in 1-life mode) |
| `choose_upgrade` | `{ choiceId }` | -- | Select level-up upgrade |
| `set_ability_priority` | `{ abilities: string[] }` | -- | Reorder ability trigger priority |
| `ping` | `{ t }` | 5/s | Latency measurement |

### 4.3 Server → Client Events

| Event | Payload | Frequency | Description |
|-------|---------|-----------|-------------|
| `joined` | `{ roomId, id, spawn, arena, tick, roomState, timeRemaining }` | Once | Join confirmation + initial state |
| `state` | `{ t, s: AgentNet[], o: OrbNet[], l?: Leaderboard[], mo?: MapObj[] }` | 20Hz | Game state snapshot (viewport-culled) |
| `death` | `{ score, kills, duration, rank, killer?, damageSource, level }` | On death | Death notification + stats |
| `kill` | `{ victim, victimMass }` | On kill | Kill confirmation |
| `level_up` | `{ level, choices[], timeoutTicks }` | On level-up | 3 upgrade choices |
| `synergy_activated` | `{ synergyId, name, description }` | On synergy | Synergy bonus achieved |
| `minimap` | `{ agents: [{x,y,m,me}], boundary }` | 1Hz | Minimap data |
| `arena_shrink` | `{ currentRadius, minRadius, shrinkRate }` | 1Hz | Shrink status |
| `rooms_update` | `{ rooms: RoomInfo[], recentWinners }` | 1Hz | Lobby room list |
| `round_start` | `{ countdown }` | State change | Countdown started |
| `round_end` | `{ winner, finalLeaderboard, yourRank, yourScore }` | State change | Round finished |
| `round_reset` | `{ roomState }` | State change | Room reset |
| `pong` | `{ t, st }` | Response | Server timestamp echo |
| `error` | `{ code, message }` | On error | Error notification |

### 4.4 State Payload Schema (20Hz)

```typescript
// Compact agent data sent per tick (field names minimized for bandwidth)
interface AgentNetworkData {
  i: string     // id
  x: number     // position.x
  y: number     // position.y
  h: number     // heading (radians)
  m: number     // mass (HP)
  b: boolean    // boosting
  k: number     // skin id
  n: string     // name
  lv: number    // level
  sc: number    // score
  kl: number    // kills
  e?: number[]  // active effect ids (only if present)
  sy?: string[] // active synergy ids (only if present)
  hr: number    // hitbox radius
}

interface OrbNetworkData {
  i: string     // id
  x: number     // position.x
  y: number     // position.y
  v: number     // value (XP)
  t: number     // type (0=natural, 1=death, 2=powerup, 3=mega)
}
```

### 4.5 Hub Message Routing

```
                    ┌───────────────────────────┐
                    │       WS Hub Goroutine     │
                    │  (single goroutine, no locks)│
                    │                           │
  register ────────►│  rooms map[roomID]map[*Client]│
  unregister ──────►│                           │
                    │  select { case ... }       │
  broadcast ───────►│  → all clients in all rooms│  (lobby updates)
  roomcast ────────►│  → all clients in 1 room  │  (game state)
  unicast ─────────►│  → specific client         │  (joined, death, level_up)
                    │                           │
                    │  Slow client? → drop msg   │
                    │  Buffer full? → kick client│
                    └───────────────────────────┘
```

---

## 5. Data Flow & State Synchronization

### 5.1 Player Input Pipeline (Critical Path)

```
Browser (30Hz)                          Go Server
─────────────────                       ──────────────────────
useInput.ts                             ws/client.go
  │ angle + boost                         │
  ▼                                       ▼
useWebSocket.ts                         ReadPump goroutine
  │ JSON: {"e":"input","d":{a,b,s}}       │ JSON decode
  │ ─── WebSocket frame ──────────────►   │ Rate limit check (30Hz)
                                          │
                                          ▼
                                        room.inputChan <- InputMsg
                                          │ (buffered channel)
                                          ▼
                                        Room goroutine (next tick)
                                          │ arena.ApplyInput(msg)
                                          ▼
                                        agent.TargetAngle = msg.Angle
                                        agent.Boosting = msg.Boost

Latency: ~0.1ms (channel) + ≤50ms (next tick) = ≤50.1ms server-side
```

### 5.2 State Broadcast Pipeline (20Hz)

```
Room goroutine                          Per-Client
──────────────────                      ─────────────────────
Arena.Tick()                            Client WritePump
  │                                       ▲
  ▼                                       │
Serializer.SerializeForClient()           │
  │ Viewport culling (center ± VP/2 + 500)│
  │ JSON marshal per-client view          │
  ▼                                       │
hub.roomcast <- RoomcastMsg               │
  │                                       │
  ▼                                       │
Hub goroutine                             │
  │ rooms[roomID] → iterate clients       │
  │ trySend(client, data)                 │
  │   │                                   │
  │   ▼                                   │
  │ client.send <- data ─────────────────►│
  │ (buffered chan, cap 64)               │ conn.WriteMessage()
  │                                       │ → Browser
  │ Buffer full? → kick slow client       │
```

### 5.3 Player Join Flow

```
Browser                     Hub               RoomManager          Room
──────                     ─────              ───────────          ────
1. connect(ws://server/ws)
   ────────────────────────►
                           2. register client
                           3. Add to "lobby" room
                              ◄── rooms_update (1Hz)
4. {"e":"join_room","d":{roomId,name,skinId}}
   ────────────────────────►
                           5. Route to RoomManager
                              ─────────────────────►
                                                   6. Validate room
                                                   7. room.joinChan <- req
                                                      ──────────────────►
                                                                        8. Create Agent
                                                                        9. Add to arena
                                                                       10. Pick spawn point
                              ◄──────────────────────────────────────────
                           11. Move client lobby→room
                           12. unicast "joined" to client
   ◄────────────────────────
13. Receive joined event
14. Start rendering
```

### 5.4 Level-Up Flow

```
Room goroutine                          Client
──────────────                          ──────
processOrbCollection()
  │ agent.XP >= agent.XPToNext
  ▼
agent.Level++
agent.XP -= xpToNext
upgrade.GenerateChoices(agent) → 3 choices
agent.PendingChoices = choices
agent.UpgradeDeadline = tick + 100
  │
  ▼ unicast "level_up" {level, choices, timeoutTicks}
  ────────────────────────────────────────►
                                          Display LevelUpOverlay
                                          Player selects choice
  ◄────────────────────────────────────────
  {"e":"choose_upgrade","d":{choiceId}}
  │
  ▼
upgrade.ApplyChoice(agent, choiceId)
  ├── Tome: stacks[tomeType]++, recalc stats
  └── Ability: add/level-up slot
upgrade.CheckSynergies(agent.Build)
  └── New synergy? → unicast "synergy_activated"

If no choice within 100 ticks (5s):
  upgrade.ProcessTimeouts() → random selection applied
```

---

## 6. Client Architecture

### 6.1 Application State Flow

```
app/page.tsx (Root)
│
├── Mode: "lobby"
│   ├── useWebSocket (connected, listening for rooms_update)
│   ├── LobbyScene3D (R3F 3D background)
│   ├── RoomList (server browser)
│   ├── CharacterCreator (5-tier skin customization)
│   ├── TrainingConsole (agent rules editor)
│   ├── QuestPanel, RPPanel, GlobalLeaderboard
│   └── User clicks "Join" → socket.emit("join_room") → mode = "playing"
│
├── Mode: "playing"
│   ├── useWebSocket (20Hz state updates)
│   ├── useInput (keyboard/touch → angle + boost)
│   ├── useGameLoop (rAF interpolation loop)
│   ├── GameCanvas3D or GameCanvas (render pipeline)
│   ├── HUD Overlay:
│   │   ├── XPBar, BuildHUD, RoundTimerHUD, ShrinkWarning
│   │   ├── LevelUpOverlay (modal, 3 choices)
│   │   ├── SynergyPopup (gold notification)
│   │   └── CoachOverlay, AnalystPanel
│   ├── On death → DeathOverlay
│   ├── On round_end → RoundResultOverlay
│   └── Leave → socket.emit("leave_room") → mode = "lobby"
│
└── Transition: 300ms opacity fade between modes
```

### 6.2 WebSocket Adapter Layer

The client uses a thin adapter (`useWebSocket.ts`) that provides the same `emit()/on()/off()`
interface as Socket.IO, enabling minimal migration. One file change switches the entire
client from Socket.IO to native WebSocket.

```typescript
// hooks/useWebSocket.ts — ~80 LOC adapter
class GameSocket {
  private ws: WebSocket | null
  private listeners: Map<string, Set<Function>>
  private reconnectAttempts: number

  connect(url: string): void       // ws:// or wss://
  emit(event: string, data?: any): void  // JSON.stringify({e, d})
  on(event: string, cb: Function): void
  off(event: string, cb?: Function): void
  disconnect(): void
  // Auto-reconnect: exponential backoff, max 5 attempts
}
```

### 6.3 Rendering Pipeline

**2D Canvas Pipeline** (Current — Phase 1-2):
```
useGameLoop (rAF)
  │
  ├── interpolateAgents(serverState, localState, alpha)
  │   └── Linear position interpolation between server ticks
  │
  ├── camera.update(myAgent.position, myAgent.mass)
  │   └── Lerp tracking + dynamic zoom (mass-based)
  │
  └── renderer.render(ctx, state, camera)
      ├── background.ts   → MC grass tile grid + zone coloring
      ├── entities.ts     → Agent sprites (16x16 MC top-down) + orbs
      └── ui.ts           → HUD (HP bar, names, effects) on Canvas
```

**3D R3F Pipeline** (Phase 3+):
```
GameCanvas3D
  ├── R3F Canvas
  │   ├── Scene (ambient + directional light)
  │   ├── SkyBox (MC sky gradient + clouds)
  │   ├── VoxelTerrain (grass → stone → netherrack by zone)
  │   ├── VoxelBoundary (MC world border effect)
  │   ├── AgentInstances (6 InstancedMesh × MAX_AGENTS)
  │   │   └── useFrame: update matrices from server state
  │   ├── VoxelOrbs (InstancedMesh for orbs)
  │   ├── GameLoop (useFrame: interpolation + state management)
  │   └── PlayCamera (quarter-view 45°, agent tracking)
  │
  └── HTML Overlay (React portal)
      ├── XPBar, BuildHUD, RoundTimerHUD
      ├── LevelUpOverlay, SynergyPopup
      └── DeathOverlay, RoundResultOverlay
```

### 6.4 Design System

**Theme**: Minecraft Inventory UI — dark translucent panels with 3D emboss borders.

| Component | Style |
|-----------|-------|
| **McPanel** | `rgba(0,0,0,0.75)`, 3px 3D emboss border (light top-left, dark bottom-right) |
| **McButton** | Stone (#7F7F7F) / Green (#5DAA34) / Red (#AA3434), 2px emboss |
| **McInput** | `#1A1A1A` bg, `#3F3F3F` border, `#5A5A5A` focus |

**Fonts**: "Press Start 2P" (titles, buttons, labels) + "Inter" (body, numbers)

**Game Bars**: HP `#FF3333` (MC heart red), XP `#7FFF00` (MC experience green), Synergy `#FFD700` (gold)

---

## 7. Performance Budget

### 7.1 Tick Performance (50ms budget per Room)

| Stage | Expected Time | % of Budget |
|-------|--------------|-------------|
| Bot AI (15 bots) | 0.1ms | 0.2% |
| Agent Physics (100 agents) | 0.2ms | 0.4% |
| Arena Shrink + Boundary | 0.05ms | 0.1% |
| Spatial Hash Rebuild | 0.3ms | 0.6% |
| Aura Combat (100 agents) | 0.5ms | 1.0% |
| Dash Collisions | 0.1ms | 0.2% |
| Death/XP Processing | 0.05ms | 0.1% |
| Orb Collection (100 agents x ~50 orbs) | 0.2ms | 0.4% |
| Leaderboard Sort | 0.01ms | 0.02% |
| **State Serialization (100 clients)** | **1.0ms** | **2.0%** |
| **WebSocket Send (Hub channel)** | **0.1ms** | **0.2%** |
| **Total** | **~2.6ms** | **5.2%** |
| **Headroom** | **47.4ms** | **94.8%** |

### 7.2 Memory Budget (5,000 CCU)

| Component | Size | Count | Total |
|-----------|------|-------|-------|
| Agent struct | ~512B | 5,000 | 2.5MB |
| Orb struct | ~64B | 50,000 | 3.2MB |
| SpatialHash grid | ~4B/cell | 50 x 900 | 0.2MB |
| Client struct + channels | ~8KB | 5,000 | 40MB |
| Goroutine stack | ~2KB | 10,055 | 20MB |
| JSON serialize buffer | ~16KB/room | 50 | 0.8MB |
| **Total** | | | **~67MB** |

> Railway Basic: 512MB available. Headroom: 445MB (87%).

### 7.3 Network Bandwidth (per player)

| Data | Size | Frequency | Bandwidth |
|------|------|-----------|-----------|
| State (50 visible agents) | ~4KB | 20Hz | 80 KB/s |
| Minimap | ~500B | 1Hz | 0.5 KB/s |
| Arena shrink | ~50B | 1Hz | 0.05 KB/s |
| Rooms update | ~200B | 1Hz | 0.2 KB/s |
| **Total per player** | | | **~81 KB/s** |

5,000 CCU = 405 MB/s outbound. Fits 1Gbps (~40% utilization).
Phase 5 binary protocol reduces to ~15% utilization.

### 7.4 Client Performance Targets

| Metric | Target | Measured By |
|--------|--------|-------------|
| FPS (2D Canvas) | 60fps | requestAnimationFrame timing |
| FPS (3D R3F) | 60fps, min 30fps | useFrame delta |
| Draw Calls (3D) | < 20 | InstancedMesh: 6 agent parts + 1 orbs + 2 terrain + 1 sky |
| LCP (Lobby) | < 2.5s | Lighthouse |
| Input-to-render latency | < 100ms | Client prediction + interpolation |
| Bundle size | < 500KB gzipped | Next.js analyzer |

---

## 8. Security Considerations

### 8.1 Threat Model Summary

| Threat | Mitigation | Severity |
|--------|-----------|----------|
| **Input Manipulation** (speed hack, teleport) | Server-authoritative physics. Client input is only angle + boost flag. | High |
| **Rate Flooding** | Per-client rate limiter: input 30Hz, respawn 1Hz, ping 5Hz. Excess silently dropped. | High |
| **WebSocket Bombing** | 64-msg send buffer. Slow/unresponsive clients auto-kicked. | Medium |
| **CORS Bypass** | chi CORS middleware. Only configured origins accepted. | Medium |
| **Replay Attack** | Input sequence numbers (`seq` field). Server ignores stale/duplicate. | Low |
| **Room Stuffing** | Max players per room. RoomManager validates capacity before join. | Medium |
| **Memory Exhaustion** | Fixed buffer sizes. SpatialHash cell count bounded. Agent/Orb pools. | Medium |
| **Upgrade Choice Exploit** | Server validates choiceId against PendingChoices. Invalid IDs ignored. | Low |
| **Bot Impersonation** | IsBot flag set server-side only. Client cannot create bots. | Low |
| **Agent API Abuse** | Service key auth for Agent REST API (Phase 4). Rate limited. | Medium |

### 8.2 Input Validation Rules

```go
// All validation happens in Room goroutine before applying
func validateInput(msg InputMsg, agent *Agent) bool {
    // 1. Angle must be valid float64 (not NaN/Inf)
    if math.IsNaN(msg.Angle) || math.IsInf(msg.Angle, 0) {
        return false
    }
    // 2. Angle normalized to [0, 2π)
    // 3. Boost is boolean only (0 or 1)
    // 4. Sequence must be > last processed sequence
    if msg.Seq <= agent.LastInputSeq {
        return false
    }
    // 5. Agent must be alive
    return agent.Alive
}
```

### 8.3 Authentication Strategy

**Current (Phase 1-3)**: Anonymous play. No accounts. Name chosen at join.

**Future (Phase 4+)**: Agent API uses service key authentication:
```
Authorization: Bearer <service-key>
```
Keys issued via admin endpoint. Rate-limited per key.

Full details: `docs/security/threat-model.md`

---

## 9. Infrastructure & Deployment

### 9.1 Build & Deploy Pipeline

```
GitHub (main branch)
├── Push to main
│
├──→ Vercel (Auto-deploy frontend)
│    ├── Build: cd apps/web && npx next build
│    ├── Output: apps/web/.next
│    ├── Env: NEXT_PUBLIC_SERVER_URL = Railway WSS URL
│    └── URL: snake-tonexus.vercel.app
│
└──→ Railway (Auto-deploy backend)
     ├── Build: Docker multi-stage
     │   ├── Stage 1: golang:1.24-alpine → go build
     │   └── Stage 2: scratch → /server binary (~10MB)
     ├── Env: PORT, CORS_ORIGIN
     └── URL: snake-production-*.up.railway.app
```

### 9.2 Dockerfile

```dockerfile
FROM golang:1.24-alpine AS builder
WORKDIR /app
COPY server/go.mod server/go.sum ./
RUN go mod download
COPY server/ .
RUN CGO_ENABLED=0 go build -o /bin/server ./cmd/server

FROM scratch
COPY --from=builder /bin/server /server
EXPOSE 8000
ENTRYPOINT ["/server"]
```

### 9.3 Health Check & Monitoring

```
GET /health
{
  "status": "ok",
  "uptime": "2h35m",
  "rooms": 5,
  "totalPlayers": 47,
  "goroutines": 142,
  "memory": { "alloc": "34MB", "sys": "67MB" },
  "tickLatency": { "room-1": "1.2ms p99", "room-2": "0.8ms p99" }
}
```

**Future (Phase 5)**: Prometheus metrics endpoint at `GET /metrics`:
- `game_room_players{room}` — players per room
- `game_tick_duration_ms{room, quantile}` — tick processing time
- `game_ws_connections_total` — total WebSocket connections
- `game_orbs_total` — total orbs across all rooms

### 9.4 Scaling Strategy

| Phase | Strategy | Capacity |
|-------|----------|----------|
| **Phase 1** (current) | Single Railway instance | 5 rooms, ~500 CCU |
| **Phase 2** | Scaled Railway instance (4 vCPU) | 50 rooms, ~5,000 CCU |
| **Phase 3** (if needed) | Room sharding via Redis Pub/Sub | 2+ instances, ~10,000 CCU |
| **Phase 4** (global) | Regional instances (KR, US, EU) + CDN | ~30,000 CCU |

### 9.5 Graceful Shutdown

```go
// cmd/server/main.go
ctx, cancel := context.WithCancel(context.Background())
g, gCtx := errgroup.WithContext(ctx)

g.Go(func() error { return httpServer.ListenAndServe() })
g.Go(func() error { hub.Run(); return nil })
g.Go(func() error { return roomManager.Run(gCtx) })
g.Go(func() error {
    sig := <-sigChan  // SIGINT or SIGTERM
    slog.Info("shutdown signal received", "signal", sig)
    cancel()                                    // cancel all contexts
    httpServer.Shutdown(shutdownCtx)            // 15s timeout
    hub.Stop()                                  // close all connections
    return nil
})

return g.Wait()  // blocks until all goroutines exit
```

### 9.6 Local Development

```bash
# game.sh — start both servers locally
cd server && go build -o ../bin/server ./cmd/server && cd ..
PORT=3001 CORS_ORIGIN="http://localhost:3000" ./bin/server &
cd apps/web && NEXT_PUBLIC_SERVER_URL="ws://localhost:3001/ws" npx next dev --port 3000 &
```

---

## 10. Architecture Decision Records

### ADR Index

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [ADR-001](docs/adr/ADR-001-agent-entity-transformation.md) | Agent Entity Transformation (Snake → Agent) | Accepted | 2026-03-06 |
| [ADR-002](docs/adr/ADR-002-server-authoritative-combat.md) | Server-Authoritative Combat (Aura DPS) | Accepted | 2026-03-06 |
| [ADR-003](docs/adr/ADR-003-2d-first-rendering.md) | 2D-First Rendering Strategy | Accepted | 2026-03-06 |
| [ADR-004](docs/adr/ADR-004-state-sync-strategy.md) | State Sync Strategy (20Hz server push) | Accepted | 2026-02-27 |
| [ADR-005](docs/adr/ADR-005-room-lifecycle.md) | Room Lifecycle State Machine | Accepted | 2026-02-27 |
| [ADR-006](docs/adr/ADR-006-rendering-pipeline.md) | Rendering Pipeline (Canvas → R3F) | Accepted | 2026-02-27 |
| [ADR-007](docs/adr/ADR-007-monorepo-structure.md) | Monorepo Structure | Accepted | 2026-02-26 |
| [ADR-008](docs/adr/ADR-008-auth-strategy.md) | Auth Strategy (Anonymous → Service Key) | Accepted | 2026-02-26 |
| [ADR-009](docs/adr/ADR-009-spatial-hash-collision.md) | Spatial Hash for Collision Detection | Accepted | 2026-02-27 |
| [ADR-010](docs/adr/ADR-010-continuous-movement-physics.md) | Continuous Movement Physics | Accepted | 2026-02-27 |
| [ADR-011](docs/adr/ADR-011-go-raw-websocket.md) | Go + Raw WebSocket (Socket.IO replacement) | Accepted | 2026-03-06 |
| [ADR-012](docs/adr/ADR-012-channel-based-hub.md) | Channel-Based Hub (Lock-free) | Accepted | 2026-03-06 |
| [ADR-013](docs/adr/ADR-013-per-room-goroutine.md) | Per-Room Goroutine Game Loop | Proposed | 2026-03-06 |
| [ADR-014](docs/adr/ADR-014-go-monolith-server-dir.md) | Go Monolith in server/ Directory | Proposed | 2026-03-06 |
| [ADR-015](docs/adr/ADR-015-json-first-binary-later.md) | JSON-First, Binary-Later Protocol | Proposed | 2026-03-06 |

### Key Architecture Decisions Summary

**ADR-011: Go + Raw WebSocket** — Replace Socket.IO with gorilla/websocket + custom JSON protocol.
Removes polling fallback, packet framing overhead. Client adapter is ~80 LOC. Enables future
binary protocol without Socket.IO constraints.

**ADR-012: Channel-Based Hub** — Single goroutine processes all register/unregister/broadcast.
No locks, no deadlocks. Proven at scale in agent_arena production.

**ADR-013: Per-Room Goroutine** — Each Room runs independently in its own goroutine with
`time.Ticker(50ms)`. True parallelism across CPU cores. Room internal state has single owner
(no synchronization needed).

**ADR-014: Go Monolith in server/** — Go server lives in `server/` alongside the existing
`apps/server/` TypeScript server. Independent `go.mod`, no monorepo tool conflicts.
TypeScript server removed after migration.

**ADR-015: JSON-First, Binary-Later** — Phase 1 uses JSON for debuggability and browser
DevTools compatibility. If bandwidth becomes bottleneck at 5K CCU, state events switch to
MessagePack (Phase 5). Only `state` events get binary encoding; control events stay JSON.

---

## 11. Key Constants Reference

```go
// server/internal/game/constants.go

// Tick & Timing
TICK_RATE            = 20          // Hz (50ms per tick)
ROUND_DURATION       = 300         // seconds (5 minutes)
COUNTDOWN_DURATION   = 10          // seconds
ENDING_DURATION      = 5           // seconds
COOLDOWN_DURATION    = 15          // seconds
GRACE_PERIOD_TICKS   = 600         // 30 seconds invulnerability
UPGRADE_TIMEOUT_TICKS = 100        // 5 seconds to choose

// Movement
BASE_SPEED           = 150.0       // px/s
BOOST_SPEED          = 300.0       // px/s
TURN_RATE            = 0.15        // rad/tick
BOOST_COST_PER_TICK  = 0.3         // mass/tick
MIN_BOOST_MASS       = 15.0        // minimum mass to boost

// Combat
AURA_RADIUS          = 60.0        // px (combat range)
AURA_DPS_PER_TICK    = 2.0         // mass/tick (40 mass/s)
DASH_DAMAGE_RATIO    = 0.30        // 30% of target mass
HITBOX_BASE_RADIUS   = 16.0        // px
HITBOX_MAX_RADIUS    = 22.0        // px
HIGH_LEVEL_DPS_BONUS = 0.20        // +20% DPS at Lv8+

// Arena
ARENA_RADIUS         = 6000.0      // px (initial)
MIN_RADIUS           = 1200.0      // px (final)
SHRINK_PER_TICK      = 0.5         // px/tick (600px/min)
BOUNDARY_PENALTY     = 0.0025      // 0.25% mass/tick outside boundary
BOUNDARY_DEATH_RATIO = 1.10        // 110% radius = instant death

// Orbs & Collection
COLLECT_RADIUS       = 50.0        // px
INITIAL_MASS         = 10.0
NATURAL_ORB_TARGET   = 300         // target orb count per room
DEATH_ORB_RATIO      = 0.80        // 80% of mass becomes death orbs

// Level & XP
MAX_LEVEL            = 12
XP_TABLE             = [0, 20, 30, 45, 65, 90, 120, 155, 195, 240, 290, 345]
ABILITY_CHANCE       = 0.35        // 35% chance of Ability in choices
MAX_ABILITY_SLOTS    = 2           // default (3 with RP unlock)

// Rooms
MAX_ROOMS            = 50
DEFAULT_ROOMS        = 5
MIN_PLAYERS          = 2           // to start countdown
MAX_PLAYERS_PER_ROOM = 100         // humans + bots
DEFAULT_BOTS         = 15
```

---

## 12. Legacy Reference (TypeScript)

> **Note**: The TypeScript server (`apps/server/`) was the v7-v9 prototype. It has been superseded
> by the Go server (`server/`). The TS code serves as a 1:1 reference for porting game logic to Go.
> It will be removed from the repository after Go migration is verified in production.

### Legacy TypeScript Server Structure (apps/server/)

```
apps/server/src/
├── index.ts                    # Entry (Node.js + Socket.IO)
├── game/
│   ├── Arena.ts               # Game loop (reference for server/internal/game/arena.go)
│   ├── AgentEntity.ts         # → server/internal/game/agent.go
│   ├── CollisionSystem.ts     # → server/internal/game/collision.go
│   ├── UpgradeSystem.ts       # → server/internal/game/upgrade.go
│   ├── ArenaShrink.ts         # → server/internal/game/shrink.go
│   ├── OrbManager.ts          # → server/internal/game/orb.go
│   ├── SpatialHash.ts         # → server/internal/game/spatial_hash.go
│   ├── StateSerializer.ts     # → server/internal/game/serializer.go
│   ├── BotManager.ts          # → server/internal/game/bot.go
│   ├── BotBehaviors.ts        # → server/internal/game/bot.go (merged)
│   ├── Room.ts                # → server/internal/game/room.go
│   └── LeaderboardManager.ts  # → server/internal/game/leaderboard.go
└── network/
    ├── SocketHandler.ts       # → server/internal/ws/dispatcher.go
    ├── Broadcaster.ts         # → server/internal/ws/broadcaster.go
    └── RateLimiter.ts         # → server/internal/ws/client.go (embedded)
```

### Migration Mapping

| TypeScript Module | Go Package | Status | LOC (Go) |
|-------------------|-----------|--------|----------|
| Arena.ts | game/arena.go | Done | 514 |
| AgentEntity.ts | game/agent.go | Done | 447 |
| CollisionSystem.ts | game/collision.go | Done | 203 |
| UpgradeSystem.ts | game/upgrade.go | Done | 411 |
| ArenaShrink.ts | game/shrink.go | Done | 82 |
| OrbManager.ts | game/orb.go | Done | 288 |
| SpatialHash.ts | game/spatial_hash.go | Done | 140 |
| StateSerializer.ts | game/serializer.go | Done | 236 |
| BotManager.ts + BotBehaviors.ts | game/bot.go | Done | 441 |
| Room.ts | game/room.go | Done | 895 |
| RoomManager (new) | game/room_manager.go | Done | 293 |
| SocketHandler.ts | ws/hub.go + dispatcher.go | Done | 378 |
| Broadcaster.ts | ws/broadcaster.go | Done | 47 |
| RateLimiter.ts | ws/client.go (embedded) | Done | 340 |
| **New in Go** | game/map_objects.go | Done | 410 |
| **New in Go** | game/build_path.go | Done | 201 |
| **New in Go** | game/training.go | Done | 349 |
| **New in Go** | game/agent_api.go | Done | 529 |
| **New in Go** | game/quest.go | Done | 230 |
| **New in Go** | game/meta.go | Done | 284 |
| **New in Go** | game/coach.go | Done | 136 |
| **New in Go** | game/analyst.go | Done | 144 |
| **Total Go Server** | | | **12,358 LOC** |

### Shared Types Package (packages/shared/)

The `packages/shared/` TypeScript package remains in use by the Next.js client. It provides:
- `types/game.ts` — Agent, PlayerBuild, UpgradeChoice, AgentSkin interfaces
- `types/events.ts` — Socket event type definitions
- `constants/game.ts` — ARENA_CONFIG, ROOM_CONFIG, NETWORK constants
- `constants/upgrades.ts` — XP_TABLE, TOME_DEFS, ABILITY_DEFS, SYNERGIES

These TypeScript types mirror the Go `domain/` package. Both must stay synchronized.

---

## Implementation Status & Roadmap

### Current Implementation (2026-03-06)

| Layer | Status | Details |
|-------|--------|---------|
| **Go Server Core** | 95% complete | 12,358 LOC across 28 game files + WS layer |
| **WebSocket Protocol** | Done | Hub + Client + Protocol + Dispatcher |
| **Game Systems** | Done | Agent, Collision, Upgrade, Orb, Shrink, Bot, Room |
| **Advanced Systems** | Done | MapObjects, BuildPath, Training, AgentAPI, Quest, Meta, Coach, Analyst |
| **Client Lobby** | 90% done | MC UI, RoomList, CharacterCreator, 3D background |
| **Client Game (2D)** | 80% done | Canvas renderer, basic HUD, overlays |
| **Client Game (3D)** | 30% done | VoxelSnake (needs → VoxelAgent), terrain, camera |
| **Client WS Adapter** | Done | useWebSocket.ts (native WS, Socket.IO-compatible API) |
| **Deploy** | Done | Vercel (frontend) + Railway (backend) |

### Roadmap Reference

Full 59-step implementation roadmap: `docs/designs/v10-development-roadmap.md`

| Phase | Steps | Focus | Duration |
|-------|-------|-------|----------|
| Phase 0 | S01-S12 | Go server infrastructure | 2 weeks |
| Phase 1 | S13-S21 | Game systems porting | 2 weeks |
| Phase 1a | S22-S26 | Room & Bot system | 1 week |
| Phase 2 | S27-S32 | Abilities + balance + deploy | 1 week |
| Phase 3 | S33-S45 | Client integration + rendering + lobby | 3 weeks |
| Phase 4 | S46-S52 | Agent API + training | 2 weeks |
| Phase 5 | S53-S59 | Meta progression + polish | 2 weeks |
| **Total** | **S01-S59** | | **~13 weeks** |
