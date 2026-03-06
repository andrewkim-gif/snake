# Agent Survivor v10 — System Architecture

> **Version**: v2.0 (Deep Architecture)
> **Date**: 2026-03-06
> **Status**: Accepted
> **Parent Design**: [`docs/designs/v10-survival-roguelike-plan.md`](designs/v10-survival-roguelike-plan.md)
> **Prior Art**: [`docs/designs/v10-system-architecture.md`](designs/v10-system-architecture.md) (v1.0 design-phase document)
> **Architect**: System Architect + Backend Architect + Frontend Architect + Security Engineer + DevOps Architect
>
> This document is the **single source of truth** for Agent Survivor's system architecture.
> It deepens the design-phase document (v1.0) into implementation-ready specifications.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Goals / Non-Goals / Constraints](#2-goals--non-goals--constraints)
3. [System Context — C4 Level 1](#3-system-context--c4-level-1)
4. [Container Architecture — C4 Level 2](#4-container-architecture--c4-level-2)
5. [Component Architecture — C4 Level 3](#5-component-architecture--c4-level-3)
6. [Critical Data Flows](#6-critical-data-flows)
7. [WebSocket Protocol Specification](#7-websocket-protocol-specification)
8. [REST API Specification](#8-rest-api-specification)
9. [Data Model & State Management](#9-data-model--state-management)
10. [Cross-Cutting Concerns](#10-cross-cutting-concerns)
11. [Security Architecture](#11-security-architecture)
12. [Performance Architecture](#12-performance-architecture)
13. [Reliability & Disaster Recovery](#13-reliability--disaster-recovery)
14. [Observability Architecture](#14-observability-architecture)
15. [Infrastructure & Deployment](#15-infrastructure--deployment)
16. [Client-Server State Reconciliation](#16-client-server-state-reconciliation)
17. [Bot AI Architecture](#17-bot-ai-architecture)
18. [Architecture Decision Records](#18-architecture-decision-records)
19. [Open Questions & Future Considerations](#19-open-questions--future-considerations)

---

## 1. Executive Summary

Agent Survivor is a **multiplayer auto-combat survival roguelike** game where Minecraft-style voxel agents autonomously fight in shrinking arenas, collect XP, level up through Tome/Ability upgrades, and compete for last-agent-standing in 5-minute rounds.

### Core Architecture Characteristics

| Characteristic | Design | Rationale |
|---------------|--------|-----------|
| **Real-time** | 20Hz server tick, 60fps client interpolation | .io game standard for smooth combat |
| **Stateful** | In-memory game state, no database | Sub-millisecond state access for 20Hz loop |
| **Multi-room** | Per-room goroutine, max 50 rooms | True parallelism, zero cross-room locking |
| **Event-driven** | WebSocket JSON frames `{e, d}` | Bidirectional real-time communication |
| **Monolithic** | Single Go binary (~10MB) | Game server latency budget incompatible with microservices |
| **Server-authoritative** | Client sends intent only (angle + boost) | Anti-cheat by design, AI agent parity |

### Technology Stack

```
Server:   Go 1.24 + gorilla/websocket + chi/v5 + slog
Client:   Next.js 15 + React 19 + TypeScript + Three.js/R3F 9.5
Deploy:   Railway (Go container) + Vercel (Next.js edge)
Protocol: WebSocket JSON {e, d} frames (Phase 1), Binary upgrade path (Phase 2+)
Storage:  In-memory (game state) + JSON files (agent training, player progression)
```

### Dual Identity: "Agent"

1. **Game Character** -- Minecraft-style voxel humanoid controlled by mouse/touch
2. **AI Agent** -- LLM (Claude, GPT, custom) autonomously playing via the same WebSocket protocol

This duality is the product's core differentiator: the game is simultaneously a casual browser game and an AI agent competition platform.

---

## 2. Goals / Non-Goals / Constraints

### 2.1 Goals

| # | Goal | Measurable Target | Validation |
|---|------|--------------------|------------|
| G1 | Large-scale concurrency | 50 rooms x 100 players = 5,000 CCU / instance | Load test with k6/vegeta |
| G2 | Stable 20Hz tick | Room tick < 2ms (P50), < 5ms (P99) | Runtime metrics via slog + /health |
| G3 | Full game logic port | All TS prototype systems ported to Go | System-level Go tests, identical output |
| G4 | Minimal client changes | Socket.IO -> WebSocket adapter swap (1 file) | useSocket.ts API surface unchanged |
| G5 | Unified MC visual | Lobby + in-game art direction consistent | MC voxel style across all screens |
| G6 | AI Agent platform | LLM agents can strategically play via WS | Agent API integration tests |
| G7 | Single-instance deploy | Docker binary on Railway | `docker build` + `/health` 200 |

### 2.2 Non-Goals

| # | Non-Goal | Rationale |
|---|----------|-----------|
| N1 | Database / persistent storage | In-memory game server; JSON files for durability |
| N2 | Microservice decomposition | Single game server; domain boundaries unnecessary |
| N3 | Client 3D rewrite | R3F/Three.js stack retained; assets swapped |
| N4 | Global multi-region (Phase 1) | Single Railway region (US-West) |
| N5 | Binary protocol (Phase 1) | JSON first; upgrade when bandwidth bottleneck proven |
| N6 | User auth / accounts | Guest play; OAuth deferred to Phase 4+ |

### 2.3 Constraints

| Constraint | Impact | Mitigation |
|-----------|--------|------------|
| Railway Basic: 1 vCPU, 512MB | Limits max goroutines and memory | ~67MB estimated usage; 87% headroom |
| Railway US-West only | 150-200ms RTT for Korean users | Client-side interpolation masks latency |
| No DB | Server restart = all game state lost | 5-min rounds = natural recovery; JSON files for persistent data |
| Monorepo (Go + Next.js) | Build tooling complexity | Separate `server/` and `apps/web/` with independent CI |
| Browser-only client | No native sockets, limited GPU | WebSocket + Canvas 2D (Phase 1), R3F (Phase 4+) |

---

## 3. System Context — C4 Level 1

```
                              ┌───────────────────┐
                              │   Human Player     │
                              │  (Web Browser)     │
                              └─────────┬─────────┘
                                        │ HTTPS + WSS
                                        v
┌──────────────┐            ┌───────────────────────┐          ┌──────────────┐
│  AI Agent    │───WSS────> │   Agent Survivor       │ <──HTTPS──│   Vercel     │
│  (LLM Bot)  │            │   Game System           │          │   CDN        │
└──────────────┘            └───────────┬───────────┘          └──────────────┘
                                        │ Docker
                                        v
                              ┌───────────────────┐
                              │    Railway PaaS    │
                              │  (Container Host)  │
                              └───────────────────┘
```

### External Actors

| Actor | Communication | Data Exchanged |
|-------|--------------|----------------|
| **Human Player** | WSS (game), HTTPS (assets) | Steering angle, boost, upgrade choices -> Game state, events, HUD |
| **AI Agent** | WSS (same protocol + API key header) | Same as human + training profiles, build paths |
| **Vercel CDN** | HTTPS (static + SSR) | Next.js pages, JS bundles, sprites, 3D assets |
| **Railway PaaS** | Internal | Go binary execution, health monitoring, auto-restart |

### System Boundary

Two deployment units compose the system:

1. **Go Game Server** (Railway) -- Game logic, WebSocket Hub, Room management, Bot AI, Agent API, JSON file persistence
2. **Next.js Web Client** (Vercel) -- Lobby UI, character customizer, game renderer (2D Canvas -> 3D R3F), training console

---

## 4. Container Architecture — C4 Level 2

### 4.1 Container Overview

```
┌───────────────────────────────────────────────────────────────────────────┐
│                          Agent Survivor System                             │
│                                                                           │
│  ┌──────────────────────────────────────┐  ┌───────────────────────────┐  │
│  │       Go Game Server (Railway)       │  │  Next.js Web Client       │  │
│  │                                      │  │  (Vercel Edge)            │  │
│  │  ┌──────────┐  ┌─────────────────┐  │  │  ┌─────────────────────┐  │  │
│  │  │ HTTP      │  │ WebSocket Hub   │  │  │  │ React App (SSR/CSR) │  │  │
│  │  │ Router    │  │ (channel-based) │  │  │  └─────────┬───────────┘  │  │
│  │  │ (chi/v5)  │  │                 │  │  │            │              │  │
│  │  └─────┬────┘  └────────┬────────┘  │  │  ┌─────────v───────────┐  │  │
│  │        │                │            │  │  │ Game Renderer         │  │  │
│  │  ┌─────v────┐   ┌──────v──────┐     │  │  │ (2D Canvas / 3D R3F) │  │  │
│  │  │ REST API  │   │ RoomManager  │     │  │  └─────────────────────┘  │  │
│  │  │ /health   │   │  ┌────────┐ │     │  │                           │  │
│  │  │ /api/v1/* │   │  │ Room×N │ │     │  │  ┌─────────────────────┐  │  │
│  │  └──────────┘   │  │ Arena  │ │     │  │  │ WebSocket Adapter    │  │  │
│  │  ┌──────────┐   │  │ Bots   │ │     │  │  │ (Native WS)         │  │  │
│  │  │ JSON File│   │  └────────┘ │     │  │  └─────────────────────┘  │  │
│  │  │ Store    │   └─────────────┘     │  │                           │  │
│  │  └──────────┘                        │  │  ┌─────────────────────┐  │  │
│  │                                      │  │  │ State Manager        │  │  │
│  │                                      │  │  │ (useSocket hook)     │  │  │
│  │                                      │  │  └─────────────────────┘  │  │
│  └──────────────────────────────────────┘  └───────────────────────────┘  │
│                                                                           │
│  ┌──────────────────────────────────────┐                                 │
│  │    Shared Types (packages/shared)    │  TS types; Go re-defines in     │
│  │    constants, types, utils           │  internal/domain/                │
│  └──────────────────────────────────────┘                                 │
└───────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Go Game Server (Primary Container)

| Property | Value |
|----------|-------|
| Language | Go 1.24, single binary (~10MB) |
| Responsibility | Game logic, real-time state, WebSocket, Bot AI, Agent API, JSON persistence |
| Port | `$PORT` (Railway dynamic, default 8000) |
| Goroutine Model | Main + Hub(1) + RoomManager(1) + Room(N) + Client(M x 2) |
| State | Fully in-memory (restart = reset) |
| Deployment | Railway Docker multi-stage build (scratch base) |

**Package Dependency Rules** (unidirectional, no cycles):
```
cmd/server  -->  internal/config
            -->  internal/server  -->  internal/ws
                                  -->  internal/game
            -->  internal/ws      -->  internal/domain
            -->  internal/game    -->  internal/domain
internal/domain  -->  (nothing -- Pure Types)
```

### 4.3 Next.js Web Client (Secondary Container)

| Property | Value |
|----------|-------|
| Framework | Next.js 15 + React 19 + TypeScript |
| Rendering | SSR (lobby) + CSR (game) |
| 3D Engine | Three.js 0.175 + React Three Fiber 9.5 + Drei 10.7 |
| WebSocket | Native WebSocket (Socket.IO removed) |
| Deployment | Vercel Edge Network |

### 4.4 Inter-Container Communication

| From | To | Protocol | Frequency | Payload |
|------|----|----------|-----------|---------|
| Client | Server | WSS `{e,d}` | 30Hz (input) | Steering angle, boost, sequence |
| Server | Client | WSS `{e,d}` | 20Hz (state) | Agents/orbs/leaderboard (viewport-culled) |
| Server | Client | WSS `{e,d}` | 1Hz (lobby) | Room list, recent winners |
| Server | Client | WSS `{e,d}` | Event-driven | death, kill, level_up, synergy, shrink |
| Client | Server | WSS `{e,d}` | Event-driven | join_room, leave_room, choose_upgrade |
| AI Agent | Server | WSS `{e,d}` | Same protocol | Same + API key auth header |
| Browser | Vercel | HTTPS | On-demand | Static assets, SSR pages |
| Browser | Server | HTTPS | On-demand | REST API (/health, /api/v1/*) |

---

## 5. Component Architecture — C4 Level 3

### 5.1 Server -- WebSocket Layer (`internal/ws/`)

```
┌──────────────────────────────────────────────────────────────┐
│                      WebSocket Layer                          │
│                                                              │
│  ┌────────────────────────────────────────────────────┐      │
│  │                Hub (single goroutine)               │      │
│  │                                                    │      │
│  │  rooms:  map[roomID]map[*Client]bool               │      │
│  │  lobby:  map[*Client]bool                          │      │
│  │  Channels:                                         │      │
│  │    register   <- new connection                    │      │
│  │    unregister <- disconnect                        │      │
│  │    broadcast  <- all clients                       │      │
│  │    roomcast   <- room-scoped                       │      │
│  │    unicast    <- single client                     │      │
│  │    done       <- shutdown signal                   │      │
│  └────────────────────────────────────────────────────┘      │
│          ^              ^              ^                      │
│  ┌───────┴──┐  ┌───────┴──┐  ┌───────┴──┐                  │
│  │ Client A │  │ Client B │  │ Client N │                  │
│  │ ReadPump │  │ ReadPump │  │ ReadPump │  goroutine       │
│  │ WritePump│  │ WritePump│  │ WritePump│  goroutine       │
│  │ RateLim  │  │ RateLim  │  │ RateLim  │  embedded        │
│  │ send(64) │  │ send(64) │  │ send(64) │  buffered chan   │
│  └──────────┘  └──────────┘  └──────────┘                  │
│                                                              │
│  Protocol: JSON {e, d} frame, event router, rate limits      │
└──────────────────────────────────────────────────────────────┘
```

**Component Responsibilities:**

| Component | Responsibility | Key Design Decisions |
|-----------|---------------|---------------------|
| **Hub** | Message routing across all connections | Single goroutine + channels = lock-free, deadlock-impossible |
| **Client** | Per-connection read/write lifecycle | 2 goroutines (ReadPump, WritePump) + buffered send channel (64) |
| **Protocol** | JSON frame serialization, event dispatch | `{"e":"event","d":{...}}` format; event name -> handler map |
| **RateLimiter** | Input flood prevention | Embedded in Client struct; input 30Hz, respawn 1Hz, ping 5Hz |

**Backpressure Contract:** When a Client's send channel (capacity 64) is full, Hub drops the message and disconnects the slow client. This prevents memory exhaustion from lagging connections.

### 5.2 Server -- Game Layer (`internal/game/`)

```
┌──────────────────────────────────────────────────────────────────┐
│                         Game Layer                                │
│                                                                  │
│  ┌─────────────────────────────────────────────────────┐         │
│  │                   RoomManager                        │         │
│  │  rooms: []*Room (max 50)                             │         │
│  │  playerRoom: map[clientID]roomID                     │         │
│  │  JoinRoom() | LeaveRoom() | QuickJoin()              │         │
│  │  GetRoomList() | BroadcastLobby() (1Hz)              │         │
│  └───────────────────────┬─────────────────────────────┘         │
│                          │ owns N rooms                          │
│             ┌────────────v────────────┐                           │
│             │    Room (goroutine) x N │                           │
│             │                         │                           │
│             │  state: RoomState       │ FSM: waiting->countdown   │
│             │  inputChan              │      ->playing->ending    │
│             │  joinChan               │      ->cooldown->waiting  │
│             │  leaveChan              │                           │
│             │                         │                           │
│             │  ┌───────────────────┐  │                           │
│             │  │      Arena        │  │ 20Hz game loop            │
│             │  │                   │  │                           │
│             │  │  agents map       │  │ Agent entities            │
│             │  │  OrbManager       │  │ Spawn/collect/expire      │
│             │  │  CollisionSystem  │  │ Aura DPS + Dash + border  │
│             │  │  SpatialHash      │  │ Grid 200px indexing       │
│             │  │  UpgradeSystem    │  │ Tome/Ability/Synergy      │
│             │  │  ArenaShrink      │  │ -600px/min boundary       │
│             │  │  BotManager       │  │ Max 15 bots/room          │
│             │  │  MapObjects       │  │ Shrine/Spring/Altar/Gate  │
│             │  │  Leaderboard      │  │ Top 10, 1Hz refresh       │
│             │  │  StateSerializer  │  │ Viewport culling + JSON   │
│             │  └───────────────────┘  │                           │
│             └─────────────────────────┘                           │
└──────────────────────────────────────────────────────────────────┘
```

**Arena Tick Order** (20Hz, 50ms budget):
```
 1. Bot AI Update         -> Generate bot inputs
 2. Agent Physics         -> Movement + direction + boost cost
 3. Arena Shrink          -> Boundary update + out-of-bounds penalty
 4. Spatial Hash Rebuild  -> Re-index all alive agents + orbs
 5. Aura Combat           -> 60px radius DPS exchange
 6. Dash Collision        -> Boost collision 30% burst damage
 7. Death Detection       -> mass <= 0 check + kill credit
 8. Kill XP Reward        -> Killer gets 10 + victim_level*3 XP
 9. Effect Processing     -> Buff/debuff tick-down
10. Orb Collection        -> Collect radius scan + XP grant
11. Upgrade Timeout       -> 5s timer, random fallback
12. Leaderboard           -> Sort every 20 ticks (1Hz)
13. Orb Maintenance       -> Natural orb spawn + expiry cleanup
```

**Room State Machine:**
```
              MIN_PLAYERS met
  waiting ──────────────────> countdown (10s)
    ^                              │
    │                              │ countdown complete
    │                              v
cooldown (15s)               playing (300s / 5min)
    ^                              │
    │                              │ time expires OR
    │                              │ <= 1 human alive
    │                              v
    └────────────────── ending (10s)
```

**State Transition Edge Cases:**
- Player joins during `countdown`: added to arena, plays when `playing` starts
- Player joins during `playing`: spawned with 30s grace period (invincibility)
- All humans leave during `playing`: immediate transition to `ending`
- Last human dies during `playing`: transition to `ending`, winner = last alive (bot or human)
- Player disconnects during `ending`: still receives `round_end` if reconnects within cooldown

### 5.3 Server -- Domain Layer (`internal/domain/`)

Pure type definitions. Imports nothing from other internal packages.

| File | Responsibility | Key Types |
|------|---------------|-----------|
| `types.go` | Core game entities | `Agent`, `Orb`, `Position`, `PlayerBuild`, `AbilitySlot`, `AgentSkin` |
| `events.go` | WebSocket event payloads | `StateUpdate`, `DeathEvent`, `LevelUpEvent`, `RoundEndEvent` |
| `skins.go` | Skin preset definitions | 34 `AgentSkin` presets (ID 00-33) |
| `upgrades.go` | Upgrade definition tables | 8 `TomeDef`, 6 `AbilityDef`, 10 `SynergyDef` |

### 5.4 Client -- State Architecture

```
page.tsx (App Root)
├── useSocket() hook          <- Single source of all game state
│   ├── gameState:            agents[], orbs[], leaderboard
│   ├── roomState:            rooms[], currentRoom, roundTimer
│   ├── playerState:          myAgent, death, score
│   ├── buildState:           pendingChoices, currentBuild
│   ├── emit:                 joinRoom, leaveRoom, input, chooseUpgrade
│   └── connection:           connected, latency, reconnecting
│
│   Internal dependency:
│   └── useWebSocket()        <- Native WS adapter (~80 lines)
│       ├── connect(url) / disconnect()
│       ├── emit(event, data) / on(event, handler)
│       └── auto-reconnect (exponential backoff, max 5 attempts)
│
├── mode === 'lobby' -> Lobby Components
│   ├── RoomList              -> rooms from useSocket
│   ├── CharacterCreator      -> localStorage skin
│   └── TrainingConsole       -> REST API /api/v1/agents/*
│
└── mode === 'playing' -> Game Components
    ├── GameCanvas            -> agents, orbs (props drilling)
    ├── LevelUpOverlay        -> pendingChoices (3-card UI)
    ├── BuildHUD              -> currentBuild (Tome stacks + Ability slots)
    ├── XPBar                 -> myAgent.xp, myAgent.level
    ├── ShrinkWarning         -> arenaRadius events
    ├── SynergyPopup          -> synergy_activated events
    ├── CoachBubble           -> coach_message events
    └── DeathOverlay / RoundResultOverlay
```

### 5.5 Client -- Rendering Pipeline

```
Phase 1-3 (2D Canvas):
  requestAnimationFrame (60fps)
  └── render()
      ├── interpolateAgents(prev, curr, alpha)    -> smooth 20->60fps
      ├── updateCamera(myAgent.position)          -> lerp + dynamic zoom
      ├── drawBackground(camera)                  -> MC tile pattern (zone colors)
      ├── drawMapObjects(mapObjects)              -> Shrine/Spring/Altar/Gate sprites
      ├── drawShrinkBoundary(radius)              -> Red translucent circle
      ├── drawOrbs(orbs, camera)                  -> Viewport-filtered orbs
      ├── drawAgents(agents, camera)              -> MC 16x16 sprites + aura
      ├── drawHUD()                               -> Minimap, timer, leaderboard
      └── drawParticles()                         -> Kill/synergy/shrink particles

Phase 4+ (3D R3F):
  R3F Canvas (useFrame)
  └── Scene
      ├── PlayCamera          -> 45deg quarter-view tracking
      ├── VoxelTerrain        -> MC voxel terrain
      ├── VoxelAgents         -> InstancedMesh (6 parts x 60 agents = 6 draw calls)
      ├── VoxelOrbs           -> Orb particles
      ├── AuraEffects         -> Combat aura shaders
      ├── ParticleSystem      -> MC square particles
      └── MapObjectMeshes     -> Block structures
```

---

## 6. Critical Data Flows

### 6.1 Player Join Flow

```
Browser                        Go Server                       Game
  │                              │                               │
  │ WSS connect /ws              │                               │
  │─────────────────────────────>│                               │
  │                              │ Hub.register (lobby)          │
  │                              │──────────────────────>        │
  │                              │                               │
  │ {e:"join_room", d:{         │                               │
  │   roomId, name, skinId}}    │                               │
  │─────────────────────────────>│                               │
  │                              │ RoomManager.JoinRoom()        │
  │                              │──────────────────────>        │
  │                              │      Room.joinChan            │
  │                              │      ──────────────>          │
  │                              │      Arena.AddAgent()         │
  │                              │      ──────────────>          │
  │                              │                               │
  │ {e:"joined", d:{            │                               │
  │   roomId, id, spawn,        │                               │
  │   arena, tick,              │<──────────────────────        │
  │   roomState, timeLeft}}     │                               │
  │<─────────────────────────────│                               │
  │                              │                               │
  │ {e:"state", d:{...}}        │  20Hz broadcast               │
  │<=====state stream=====      │<==========================    │
```

### 6.2 Level-Up Choice Flow (Critical: 5s Timeout)

```
Server                         Client / AI Agent
  │                               │
  │ Agent XP >= XPToNext          │
  │ UpgradeSystem.Generate(3)     │
  │ agent.PendingChoices = [...]   │
  │ agent.UpgradeDeadline = t+100 │ (100 ticks = 5s @ 20Hz)
  │                               │
  │ {e:"level_up", d:{           │
  │   level: 5,                  │
  │   choices: [{id,type,name}], │
  │   timeoutTicks: 100,         │
  │   currentBuild: {...}}}      │
  │──────────────────────────────>│ UI: 3-card overlay
  │                               │ Timer: 5s countdown
  │                               │
  │ Case A: Player chooses        │
  │ {e:"choose_upgrade",         │
  │  d:{choiceId: 1}}            │
  │<──────────────────────────────│
  │ ApplyUpgrade(agent, 1)       │
  │ CheckSynergies()             │
  │ agent.PendingChoices = nil    │
  │                               │
  │ Case B: 5s timeout            │
  │ Tick detects deadline passed  │
  │ Random selection applied      │
  │ agent.PendingChoices = nil    │
  │                               │
  │ [If synergy activated]        │
  │ {e:"synergy_activated",      │
  │  d:{synergyId, name, bonus}} │
  │──────────────────────────────>│ Gold text popup
```

**Edge Cases:**
- Player disconnects during selection: timeout applies, random choice on server
- Two level-ups in quick succession: queue second, present after first resolved
- Player dies while choosing: selection cancelled, no upgrade applied
- AI Agent: receives `level_up`, responds with `choose_upgrade` within 5s

### 6.3 Room State Transition Broadcast

```
Room goroutine          Hub              All Room Clients
  │                      │                      │
  │ [waiting->countdown] │                      │
  │ ─roomcast────────────>                      │
  │                      │ {e:"round_start",   │
  │                      │  d:{countdown:10}}  │
  │                      │─────────────────────>│
  │                      │                      │ UI: 10s overlay
  │ [countdown->playing] │                      │
  │ Arena.Reset()        │                      │
  │ BotManager.SpawnBots │                      │
  │ ─roomcast────────────>                      │
  │                      │ {e:"state"} 20Hz    │
  │                      │═════════════════════>│ Game starts
  │                      │                      │
  │ [playing->ending]    │                      │
  │ ─roomcast────────────>                      │
  │                      │ {e:"round_end", d:{ │
  │                      │  winner, board,     │
  │                      │  yourRank, stats}}  │
  │                      │─────────────────────>│ UI: result overlay
  │                      │                      │
  │ [ending->cooldown]   │                      │
  │ Arena.Cleanup()      │                      │
  │ ─roomcast────────────>                      │
  │                      │ {e:"round_reset",   │
  │                      │  d:{roomState}}     │
  │                      │─────────────────────>│ UI: waiting screen
```

### 6.4 Input Pipeline (Critical Path Latency)

```
Client mouse/touch event
  │
  v ~1ms (JS event loop)
useSocket.emit("input", {a: angle, b: boost, s: seq})
  │
  v ~5-50ms (network RTT/2)
Server ReadPump goroutine
  │
  v ~0.01ms (JSON decode)
  v ~0.01ms (Rate limit check: 30Hz)
  v Room.inputChan <- InputMsg
  │
  v ~0-50ms (wait for next tick, avg 25ms)
Room goroutine: agent.ApplyInput(angle, boost, seq)
  │
  Total: ~30-100ms (input to state reflection)
  Client interpolation visually masks this latency
```

### 6.5 Reconnection Flow

```
Client                          Server
  │                               │
  │ WebSocket disconnects         │
  │ (network issue)               │
  │                               │
  │                               │ ReadPump detects EOF
  │                               │ Hub.unregister(client)
  │                               │ Room.leaveChan <- clientID
  │                               │ Agent removed from arena
  │                               │ (15s: cleanup timer)
  │                               │
  │ [Exp backoff: 1s, 2s, 4s...] │
  │                               │
  │ WSS reconnect /ws             │
  │──────────────────────────────>│
  │                               │ Hub.register (lobby)
  │                               │
  │ {e:"join_room", d:{same}}    │ Treated as fresh join
  │──────────────────────────────>│ (no session resume)
  │                               │
  │ {e:"joined", d:{new spawn}}  │ New agent spawned
  │<──────────────────────────────│ with 30s grace period
```

**Design Decision:** No session resume. Reconnection = new player spawn. Rationale: 5-minute rounds make session recovery complex with minimal benefit. Grace period protects newly joined players.

---

## 7. WebSocket Protocol Specification

### 7.1 Frame Format

All messages: `{"e": "event_name", "d": {...payload}}`

### 7.2 Client -> Server Events

| Event | Payload | Rate Limit | Description |
|-------|---------|-----------|-------------|
| `join_room` | `{roomId, name, skinId}` | 1/s | Join a room |
| `leave_room` | `{}` | -- | Leave current room |
| `input` | `{a: float, b: 0\|1, s: int}` | 30/s | Angle(a), boost(b), sequence(s) |
| `respawn` | `{name?, skinId?}` | 1/s | Respawn (waiting state only) |
| `choose_upgrade` | `{choiceId: int}` | -- | Level-up selection (0/1/2) |
| `ping` | `{t: int}` | 5/s | Latency measurement |

### 7.3 Server -> Client Events

| Event | Payload | Frequency | Description |
|-------|---------|-----------|-------------|
| `joined` | `{roomId, id, spawn, arena, tick, roomState, timeRemaining}` | Once | Join confirmation |
| `state` | `{t, s: Agent[], o: Orb[], l?: Leader[]}` | 20Hz | Game state (viewport-culled) |
| `death` | `{score, kills, duration, rank, killer?, damageSource, level, build}` | On death | Death info |
| `kill` | `{victim, victimMass}` | On kill | Kill notification |
| `minimap` | `{agents: [{x,y,m,me}], boundary, mapObjects}` | 1Hz | Minimap data |
| `pong` | `{t: clientTs, st: serverTs}` | Response | Latency response |
| `rooms_update` | `{rooms: RoomInfo[], recentWinners}` | 1Hz | Lobby room list |
| `round_start` | `{countdown: int}` | State change | Round countdown begins |
| `round_end` | `{winner, board, yourRank, yourScore, buildStats}` | State change | Round over |
| `round_reset` | `{roomState}` | State change | Back to waiting |
| `level_up` | `{level, choices[], timeoutTicks, currentBuild}` | On level-up | Upgrade selection request |
| `synergy_activated` | `{synergyId, name, description, bonus}` | On synergy | Synergy notification |
| `arena_shrink` | `{currentRadius, minRadius, shrinkRate}` | 1Hz | Arena boundary info |
| `coach_message` | `{type, message, priority}` | 0.5-1Hz | Coach advice |
| `round_analysis` | `{buildEfficiency, positioning, suggestions[]}` | Round end | Analyst feedback |
| `error` | `{code: int, message: string}` | On error | Error notification |

### 7.4 State Payload (20Hz -- Bandwidth-Critical)

```json
{
  "e": "state",
  "d": {
    "t": 12345,
    "s": [{
      "i": "uuid", "n": "Name", "x": 1234.5, "y": 678.9,
      "h": 1.57, "m": 85.3, "v": 7, "b": false, "a": true,
      "sk": 4, "hr": 18.5,
      "bd": {"t": {"dmg": 3, "spd": 2}, "ab": [{"t": "venom", "l": 2}]},
      "sy": ["vampire"], "bot": false
    }],
    "o": [{"i": "o1", "x": 100, "y": 200, "v": 2, "t": "natural"}],
    "l": [{"i": "uuid", "n": "Name", "s": 85, "k": 3}]
  }
}
```

**Field abbreviations** (bandwidth optimization): `i`=id, `n`=name, `x`/`y`=position, `h`=heading, `m`=mass, `v`=level, `b`=boosting, `a`=alive, `sk`=skinId, `hr`=hitboxRadius, `bd`=build, `sy`=synergies, `t`=type/tick, `s`=score/agents, `o`=orbs, `l`=leaderboard

---

## 8. REST API Specification

### 8.1 Health & Monitoring

| Method | Path | Response | Phase |
|--------|------|----------|-------|
| GET | `/health` | `{status, uptime, rooms, totalPlayers, goroutines, memory, tickLatency}` | 1 |
| GET | `/metrics` | Prometheus text format | 2 (optional) |

### 8.2 Agent Training API (Phase 4)

| Method | Path | Body/Response | Description |
|--------|------|--------------|-------------|
| GET | `/api/v1/agents/:id/training` | `TrainingProfile` | Get training config |
| PUT | `/api/v1/agents/:id/training` | `TrainingProfile` | Save training config |
| GET | `/api/v1/agents/:id/memory` | `AgentMemory` | Get learning data |
| PUT | `/api/v1/agents/:id/build-path` | `BuildPath` | Register build path |

### 8.3 Progression API (Phase 5)

| Method | Path | Response | Description |
|--------|------|----------|-------------|
| GET | `/api/v1/players/:id/progression` | `{rp, unlocks, achievements}` | RP/unlock query |
| GET | `/api/v1/players/:id/quests` | `{daily, progress}` | Quest status |
| GET | `/api/v1/leaderboard` | `{type, entries[]}` | Leaderboard (build/synergy/agent) |

### 8.4 Authentication

- Phase 1: No auth (guest play, WS connection = session)
- Phase 4: `X-Agent-Key` header for AI Agent API endpoints
- Phase 5+: OAuth2 (Google/GitHub) -> JWT (Non-Goal for now)

---

## 9. Data Model & State Management

### 9.1 Agent Entity (Core)

```go
type Agent struct {
    // Identity
    ID, Name         string
    IsBot            bool

    // Physics (single position, no segments)
    Position         Position    // {X, Y float64}
    Heading          float64    // current direction (rad)
    TargetAngle      float64    // input direction
    Speed            float64    // current speed (px/s)

    // Combat & Survival
    Mass             float64    // HP (mass 0 = death)
    HitboxRadius     float64    // dynamic (16-22px)
    Boosting         bool
    Alive            bool
    GracePeriodEnd   uint64     // invincibility expiry tick
    LastDamagedBy    string     // kill credit tracking

    // Progression
    Level            int        // 1-12
    XP, XPToNext     int

    // Build System
    Build            PlayerBuild       // Tome stacks + Ability slots
    ActiveSynergies  []string          // Active synergy IDs
    ActiveEffects    []ActiveEffect
    EffectCooldowns  []EffectCooldown

    // Level-Up State
    PendingChoices   []UpgradeChoice   // nil = no pending
    UpgradeDeadline  uint64            // timeout tick

    // Scoring
    Score, Kills, KillStreak, BestScore int

    // Visual + Meta
    Skin             AgentSkin
    JoinedAt         time.Time
    LastInputSeq     int
}
```

### 9.2 Build System

```go
type PlayerBuild struct {
    Tomes     map[TomeType]int    // Tome -> stack count
    Abilities []AbilitySlot       // max 2-3 slots
}

type AbilitySlot struct {
    Type     AbilityType
    Level    int    // 1-4 (enhancement count)
    Cooldown int    // remaining cooldown ticks
}
```

**8 Tomes**: XP(S), Speed(S), Damage(S), Armor(A), Magnet(A), Luck(A), Regen(B), Cursed(S*)
**6 Abilities**: Venom Aura, Shield Burst, Lightning Strike, Speed Dash, Mass Drain, Gravity Well
**10 Synergies**: 6 public + 4 hidden (discovery content)

### 9.3 Room & Arena

```go
type Room struct {
    ID, Name       string
    State          RoomState  // waiting|countdown|playing|ending|cooldown
    Timer          int        // remaining seconds
    Arena          *Arena
    Humans         map[string]*HumanMeta
    LastWinner     *WinnerInfo
    // Channels: inputChan, joinChan, leaveChan
}

type Arena struct {
    Config          ArenaConfig
    Agents          map[string]*Agent
    OrbManager      *OrbManager
    SpatialHash     *SpatialHash
    Collision       *CollisionSystem
    Leaderboard     *Leaderboard
    Shrink          *ArenaShrink
    BotManager      *BotManager
    Upgrade         *UpgradeSystem
    MapObjects      *MapObjectManager
    Tick            uint64
    DeathEvents     []DeathEvent    // per-tick buffer (reused, zero-alloc)
    LevelUps        []LevelUpEvent
}
```

### 9.4 Persistent Data (JSON Files)

| File Pattern | Location | Content | Size Estimate |
|-------------|----------|---------|---------------|
| Agent training | `data/agents/{id}.json` | Build profiles, combat rules, strategy phases | ~10KB/agent |
| Agent learning | `data/agents/{id}.json` | Round results, opponent analysis, synergy attempts | ~10KB/agent |
| Player progress | `data/players/{id}.json` | RP, unlock state, achievements, quests | ~5KB/player |

Total: 1,000 users = ~15MB (filesystem sufficient, no DB needed)

### 9.5 State Ownership Model

| State | Owner | Lifecycle | Sharing |
|-------|-------|-----------|---------|
| Agent position/mass/build | Room goroutine (exclusive) | Per-round | Read-only via Hub broadcast |
| Orb positions | Room goroutine (exclusive) | Per-round | Read-only via state serialization |
| Room FSM state | Room goroutine (exclusive) | Persistent across rounds | RoomManager reads via RWMutex |
| Player-Room mapping | RoomManager (RWMutex) | Per-session | Hub reads for routing |
| WS connections | Hub goroutine (exclusive) | Per-connection | Room reads client ID only |
| Training profiles | JSON file (filesystem) | Persistent | Read/write via REST API |

---

## 10. Cross-Cutting Concerns

### 10.1 Error Propagation Strategy

```
Errors in game server follow a layered propagation model:

Layer 1 -- Game Logic Errors (non-fatal):
  Invalid upgrade choice, out-of-bounds movement, expired action
  -> Log at DEBUG, silently correct or ignore
  -> Never propagate to client (server-authoritative)

Layer 2 -- Protocol Errors (client-facing):
  Unknown event name, malformed JSON, rate limit exceeded
  -> Log at INFO, send {e:"error", d:{code, message}} to client
  -> Error codes: 4001=bad_event, 4002=malformed, 4003=rate_limited

Layer 3 -- Connection Errors (connection-fatal):
  ReadLimit exceeded (32KB), send buffer full (64 msgs), ping timeout (30s)
  -> Log at WARN, close WebSocket connection
  -> Client auto-reconnects via exponential backoff

Layer 4 -- System Errors (room/process-fatal):
  Room goroutine panic, OOM, unrecoverable state
  -> Log at ERROR, recover() in goroutine, restart room/process
  -> Railway auto-restarts container on process exit
```

### 10.2 Logging Correlation

```go
// Every log entry includes contextual identifiers for tracing:

// Hub/Connection level:
slog.Info("client connected", "clientID", client.ID, "remoteAddr", addr)

// Room level:
slog.Info("room tick", "room", room.ID, "tick", arena.Tick,
    "agents", len(arena.Agents), "duration_ms", elapsed.Milliseconds())

// Agent level:
slog.Debug("agent death", "room", room.ID, "agentID", agent.ID,
    "killer", lastDamagedBy, "level", agent.Level, "build", agent.Build)
```

**Log Levels by Environment:**
- Production: `info` (connection lifecycle, room events, performance warnings)
- Staging: `debug` (+ game logic details, agent decisions)
- Local: `debug` (full verbosity)

### 10.3 Graceful Degradation Patterns

| Scenario | Detection | Degradation | Recovery |
|----------|-----------|-------------|----------|
| Tick exceeds 50ms budget | Elapsed time measurement | Log warning, skip non-essential steps (leaderboard, orb cleanup) | Automatic next tick |
| Hub channel backlog | Channel len check | Priority: unicast > roomcast > broadcast | Drain on next select |
| Client send buffer full | Channel send default case | Drop message, disconnect slow client | Client auto-reconnects |
| JSON serialization error | json.Marshal error check | Skip this client's state, log error | Next tick normal |
| Bot AI panic | recover() in bot update | Skip bot actions for this tick, log | Next tick re-enters |

### 10.4 Configuration Management

```go
// config.go -- envconfig-based, all settings via environment variables
type Config struct {
    Port             int    `envconfig:"PORT" default:"8000"`
    CORSOrigin       string `envconfig:"CORS_ORIGIN" default:"http://localhost:3000"`
    TickRate         int    `envconfig:"TICK_RATE" default:"20"`
    MaxRooms         int    `envconfig:"MAX_ROOMS" default:"5"`
    MaxBotsPerRoom   int    `envconfig:"MAX_BOTS_PER_ROOM" default:"15"`
    LogLevel         string `envconfig:"LOG_LEVEL" default:"info"`
    ReadLimitBytes   int    `envconfig:"READ_LIMIT" default:"32768"`
    SendBufferSize   int    `envconfig:"SEND_BUFFER" default:"64"`
    ShutdownTimeout  int    `envconfig:"SHUTDOWN_TIMEOUT" default:"15"`
}
```

**Feature Flags** (via config, not external service):
- `ENABLE_MAP_OBJECTS`: Toggle map objects (Shrine/Spring/Altar/Gate)
- `ENABLE_SYNERGIES`: Toggle synergy system
- `ENABLE_AGENT_API`: Toggle AI Agent REST endpoints
- `ENABLE_COACH`: Toggle Coach messages
- `ENABLE_PROGRESSION`: Toggle RP/quest/unlock system

---

## 11. Security Architecture

### 11.1 Threat Model (STRIDE)

| Threat | Category | Attack Vector | Mitigation | Severity |
|--------|----------|--------------|------------|----------|
| WS message forgery | Spoofing | Send input as another player ID | Server-side session binding (Client.AgentID fixed at join) | High |
| Input flooding | DoS | Thousands of input msgs/sec | RateLimiter: input 30Hz, excess silently dropped | High |
| Large payload | DoS | Multi-MB JSON payload | ReadLimit 32KB, exceed = connection close | Medium |
| Memory exhaustion | DoS | Thousands of idle WS connections | WritePump buffer 64, overflow = eviction; ~8KB/conn limit | High |
| Bot/cheat scripts | Tampering | Automation tools for optimal input | Server-authoritative: client sends angle only, server computes all | Medium |
| Agent API abuse | Spoofing | Control another agent | API Key auth + Agent-Session binding | High |
| CORS bypass | Spoofing | Unauthorized origin connections | gorilla CheckOrigin + chi CORS middleware | Medium |
| Speed hacking | Tampering | Modified movement speed | Server calculates speed (client sends angle only) | Low |

### 11.2 Server-Authoritative Model

```
Core Principle: Client sends "intent" only; server computes all outcomes.

Client sends:   {a: angle(rad), b: boost(0/1), s: sequence}
Server computes: position, speed, collision, damage, XP, level-up, death
Client receives: confirmed state (20Hz state event)

-> Client cannot manipulate position/damage/speed
-> Only cheat vector: bot programs (acceptable -- AI Agent platform)
```

### 11.3 Rate Limiting

```go
type RateLimiter struct {
    inputLast   time.Time  // min 33ms interval (30Hz)
    respawnLast time.Time  // min 2s interval
    pingLast    time.Time  // min 200ms interval (5Hz)
}
```

Exceeded rate = silent drop (no error message to avoid information leakage).

### 11.4 Transport Security

| Layer | Security | Detail |
|-------|----------|--------|
| TLS | Railway + Vercel auto HTTPS/WSS | Let's Encrypt certificates |
| CORS | `CORS_ORIGIN` env var (comma-separated) | Only Vercel domain allowed |
| WS Origin | `CheckOrigin()` function | Validates against CORS_ORIGIN |
| Read Limit | `conn.SetReadLimit(32KB)` | Rejects oversized messages |
| Ping/Pong | 30s timeout | Zombie connection cleanup |
| Send Buffer | Capacity 64, non-blocking send | Slow client eviction |

---

## 12. Performance Architecture

### 12.1 Tick Processing Budget (50ms per Room)

| Step | Estimated Time | % of Budget |
|------|---------------|-------------|
| Bot AI update (15 bots) | 0.1ms | 0.2% |
| Agent physics (100 agents) | 0.2ms | 0.4% |
| Arena shrink + boundary | 0.05ms | 0.1% |
| Spatial Hash rebuild | 0.3ms | 0.6% |
| Aura combat (100 agents) | 0.5ms | 1.0% |
| Dash collision | 0.1ms | 0.2% |
| Death/XP processing | 0.05ms | 0.1% |
| Orb collection (100 x ~50 orbs) | 0.2ms | 0.4% |
| Leaderboard sort | 0.01ms | 0.02% |
| **State serialization (100 agents)** | **1.0ms** | **2.0%** |
| **WebSocket send (Hub channel)** | **0.1ms** | **0.2%** |
| **Total** | **~2.6ms** | **5.2%** |
| **Headroom** | **47.4ms** | **94.8%** |

**SLO**: P99 tick processing < 5ms / Room

### 12.2 Memory Budget (5,000 CCU)

| Component | Unit Size | Count | Total |
|-----------|----------|-------|-------|
| Agent struct | ~512B | 5,000 | 2.5 MB |
| Orb struct | ~64B | 50,000 | 3.2 MB |
| SpatialHash grid | ~4B/cell | 50 x 900 | 0.2 MB |
| Client struct + channels | ~8KB | 5,000 | 40 MB |
| Goroutine stacks | ~2KB | ~10,055 | 20 MB |
| JSON serialize buffers | ~16KB/room | 50 | 0.8 MB |
| **Total** | | | **~67 MB** |

Railway Basic (512MB) -> 445MB headroom (87%)

### 12.3 Network Bandwidth Budget

| Data | Size | Frequency | Per-Player |
|------|------|-----------|------------|
| State (50 visible agents) | ~4KB | 20Hz | 80 KB/s |
| Minimap | ~500B | 1Hz | 0.5 KB/s |
| Arena shrink | ~50B | 1Hz | 0.05 KB/s |
| Rooms update (lobby) | ~200B | 1Hz | 0.2 KB/s |
| **Total** | | | **~81 KB/s** |

5,000 CCU -> ~405 MB/s outbound (1Gbps at ~40%)

### 12.4 Goroutine Budget

| Component | Count | Memory |
|-----------|-------|--------|
| Main / Signal / Hub | 3 | 6 KB |
| RoomManager + Lobby Broadcaster | 2 | 4 KB |
| Room game loops | 50 | 100 KB |
| Client ReadPump | 5,000 | 10 MB |
| Client WritePump | 5,000 | 10 MB |
| **Total** | **~10,055** | **~20 MB** |

### 12.5 Optimization Levers (Priority Order)

| # | Optimization | Effect | Phase |
|---|-------------|--------|-------|
| 1 | JSON field abbreviations (i/x/y/m/h) | Payload -40% | 1 |
| 2 | Object pooling (Agent, Orb, []Entry) | GC pressure -60% | 1 |
| 3 | SpatialHash slice reuse (Clear vs new) | Allocations -80% | 1 |
| 4 | MessagePack (state event only) | Payload additional -30% | 2 |
| 5 | Delta compression (changed fields only) | Bandwidth -50% | 2 |
| 6 | Custom binary protocol (state only) | Payload -75% vs JSON | 3 |

### 12.6 Scaling Strategy

```
Phase 1: Single instance (Railway)
  └── 5,000 CCU / 50 Rooms / 1 Container

Phase 2: Room Sharding (if needed)
  ┌──────────────┐
  │ Load Balancer │ (Sticky Session by roomID)
  └──────┬───────┘
  ┌──────┴───────┐
  │ Redis Pub/Sub │ (cross-instance lobby sync)
  └──┬────────┬──┘
  ┌──v──┐  ┌──v──┐
  │Go #1│  │Go #2│
  │R1~25│  │R26~50│
  └─────┘  └─────┘

Phase 3: Global multi-region
  Seoul / US-West / EU-West
```

---

## 13. Reliability & Disaster Recovery

### 13.1 Graceful Shutdown Sequence

```go
// 15-second shutdown budget
1. SIGTERM/SIGINT received
2. HTTP server Shutdown (reject new connections)      // ~0s
3. context.Cancel() -> all Room goroutines exit       // ~1s
4. Each Room: immediate round_end event to all clients // ~0.5s
5. Hub.Stop() -> close frame to all WS connections    // ~1s
6. errgroup.Wait() -> all goroutines confirmed done   // ~2s
7. Process exit                                        // total < 5s
```

### 13.2 Error Recovery Matrix

| Failure Type | Detection | Recovery | Impact |
|-------------|-----------|----------|--------|
| Client disconnect | ReadPump EOF | Hub.unregister -> Room.leaveChan -> Agent removed | Single player |
| Room goroutine panic | `recover()` + log | Restart Room, current round lost | Room players (~20) |
| Hub goroutine panic | `recover()` + log | Restart Hub, re-register all connections | All players (critical) |
| OOM | Railway monitoring | Container auto-restart | All (state lost) |
| Tick overrun (>50ms) | Elapsed time measurement | slog.Warn + skip optional steps | Room lag |
| JSON marshal error | Error check in serializer | Skip this client's frame, log | Single player (1 frame) |

### 13.3 Disaster Recovery

| Property | Value | Rationale |
|----------|-------|-----------|
| RTO | ~30s | Railway container restart time |
| RPO | Full loss | In-memory state; game rounds < 5min |
| Backup | N/A | Transient game state; JSON files on Railway Volume |
| DR Strategy | Auto-restart | `restartPolicyType: ON_FAILURE` |

**Game Server Property**: State loss = new round starts. Players experience brief interruption but no data loss (guest play, no accounts). JSON persistent data (agent training, progression) survives on Railway Volume.

---

## 14. Observability Architecture

### 14.1 Structured Logging (slog)

```go
// Standard log attributes by context level:
slog.Info("event",
    "component", "hub|room|arena|ws",   // always present
    "room", roomID,                      // when room-scoped
    "agent", agentID,                    // when agent-scoped
    "duration_ms", elapsed,              // when timing relevant
)
```

### 14.2 Health Endpoint

```json
GET /health
{
  "status": "ok",
  "uptime": "2h34m",
  "rooms": 5,
  "totalPlayers": 127,
  "totalBots": 75,
  "goroutines": 315,
  "memory": {
    "alloc": "45MB",
    "sys": "89MB",
    "gcPause": "0.3ms"
  },
  "tickLatency": {
    "room-1": {"p50": "1.2ms", "p99": "3.1ms"},
    "room-2": {"p50": "0.8ms", "p99": "2.4ms"}
  }
}
```

### 14.3 Prometheus Metrics (Phase 2)

```
game_room_players{room="room-1"} 45
game_tick_duration_ms{room="room-1",quantile="0.99"} 1.2
game_ws_connections_total 2340
game_ws_messages_in_total 45000
game_ws_messages_out_total 890000
game_agent_deaths_total{source="aura"} 156
game_agent_deaths_total{source="dash"} 42
game_synergy_activations_total{synergy="glass_cannon"} 15
game_upgrade_choices_total{type="tome"} 1234
```

### 14.4 Key Performance Indicators

| KPI | Target | Alert Threshold | Measurement |
|-----|--------|----------------|-------------|
| Tick P99 latency | < 5ms | > 10ms | Per-room timer in Arena.Tick() |
| WebSocket connections | < 5,000 | > 4,000 (80% capacity) | Hub.clients count |
| Memory usage | < 67MB | > 400MB (78% of 512MB) | runtime.MemStats |
| Goroutine count | ~10,055 | > 15,000 (goroutine leak) | runtime.NumGoroutine() |
| GC pause | < 1ms | > 5ms | runtime.MemStats.PauseNs |

---

## 15. Infrastructure & Deployment

### 15.1 Deployment Topology

```
┌───────────────────────────────────────────────────────────────┐
│                    Production Environment                       │
│                                                               │
│  ┌────────────────────────────────────────────────────┐       │
│  │                 Vercel Edge Network                  │       │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐         │       │
│  │  │ Edge     │  │ Edge     │  │ Edge     │         │       │
│  │  │ (Seoul)  │  │ (US-West)│  │ (EU-West)│         │       │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘         │       │
│  │       └──────────┬───┘──────────┘                  │       │
│  │       Next.js 15 (SSR + Static)                    │       │
│  │       apps/web/.next                               │       │
│  └────────────────────────────────────────────────────┘       │
│                        │ WSS                                   │
│  ┌─────────────────────v──────────────────────────────┐       │
│  │           Railway Container (US-West)               │       │
│  │                                                    │       │
│  │  ┌──────────────────────────────────────────┐      │       │
│  │  │    Go Game Server (scratch image)         │      │       │
│  │  │    Single binary ~10MB                    │      │       │
│  │  │    PORT=8000                              │      │       │
│  │  │    CORS_ORIGIN=snake-tonexus.vercel.app   │      │       │
│  │  │    HTTP: /health, /api/v1/*               │      │       │
│  │  │    WS:   /ws (upgrade)                    │      │       │
│  │  └──────────────────────────────────────────┘      │       │
│  │  Resource: 1 vCPU, 512MB RAM                       │       │
│  └────────────────────────────────────────────────────┘       │
└───────────────────────────────────────────────────────────────┘
```

### 15.2 Docker Build

```dockerfile
# server/Dockerfile
FROM golang:1.24-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /server ./cmd/server

FROM scratch
COPY --from=builder /server /server
EXPOSE 8000
ENTRYPOINT ["/server"]
```

Result: ~10MB binary (scratch image, no OS).

### 15.3 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 8000 | HTTP/WS server port (Railway dynamic) |
| `CORS_ORIGIN` | `http://localhost:3000` | Allowed origins (comma-separated) |
| `TICK_RATE` | 20 | Game loop Hz |
| `MAX_ROOMS` | 5 | Maximum rooms (Phase 1) |
| `MAX_BOTS_PER_ROOM` | 15 | Bots per room |
| `LOG_LEVEL` | info | Log level (debug/info/warn/error) |

### 15.4 Monorepo Structure

```
snake/                          <- Git root
├── apps/
│   └── web/                    <- Next.js frontend (Vercel)
│       ├── app/
│       ├── components/
│       ├── hooks/
│       ├── lib/
│       └── public/
├── server/                     <- Go game server (Railway)
│   ├── cmd/server/
│   ├── internal/
│   ├── go.mod
│   └── Dockerfile
├── packages/
│   └── shared/                 <- TypeScript shared types
├── docs/
│   ├── ARCHITECTURE.md         <- This document
│   ├── designs/                <- Design-phase documents
│   └── adr/                    <- Architecture Decision Records
├── vercel.json
├── railway.json
├── game.sh                     <- Local dev script
└── package.json
```

### 15.5 CI/CD Pipeline

```
Git Push (main)
  ├── Vercel: auto build+deploy (apps/web/)
  │   └── next build -> Edge Deploy (~60s)
  │
  └── Railway: auto build+deploy (server/)
      └── Docker build -> Container Deploy (~90s)
```

Phase 1: No separate CI (GitHub Actions). PaaS auto-deploy.
Phase 2: Add Go test + lint CI before deploy.

### 15.6 Local Development

```bash
# game.sh -- local dev environment
./game.sh dev    # Go server build+run + Next.js dev simultaneously
./game.sh server # Go server only
./game.sh build  # Go binary build
./game.sh stop   # Kill all processes

# Manual
cd server && go build -o ../bin/server ./cmd/server
PORT=8001 CORS_ORIGIN="http://localhost:3000" ./bin/server

cd apps/web
NEXT_PUBLIC_SERVER_URL="ws://localhost:8001/ws" npx next dev --port 3000
```

---

## 16. Client-Server State Reconciliation

### 16.1 Server-Client State Gap

The server runs at 20Hz (50ms intervals). The client renders at 60fps (16.7ms). This creates a fundamental state gap that must be bridged.

### 16.2 Interpolation Strategy

```
Client maintains two state snapshots:
  previousState (t-1): Last-but-one received server state
  currentState  (t):   Most recently received server state

Every render frame:
  alpha = (now - lastStateTime) / (1000/20)  // 0.0 to 1.0
  renderPosition = lerp(previousState.position, currentState.position, alpha)
  renderHeading  = lerpAngle(previousState.heading, currentState.heading, alpha)
```

**Why interpolation (not extrapolation):**
- Extrapolation predicts future state -> can overshoot, causing rubber-banding
- Interpolation smoothly transitions between confirmed states -> always accurate
- Trade-off: 50ms visual delay (1 tick) -- acceptable for .io game combat

### 16.3 State Reconciliation on Events

| Event | Client Behavior | Rationale |
|-------|----------------|-----------|
| `state` (20Hz) | Replace full state snapshot, interpolate | Server is authoritative |
| `death` | Immediate local state update, stop rendering agent | No interpolation needed |
| `level_up` | Overlay UI, pause input processing for this agent | Player must choose |
| `round_end` | Freeze game renderer, show result overlay | No more state updates |
| `synergy_activated` | Visual effect only, server already applied bonus | Client cosmetic |
| `arena_shrink` | Update boundary visual, no local physics | Server handles penalty |

### 16.4 Input Sequence Reconciliation

```
Client sends: {a: angle, b: boost, s: 42}  (sequence 42)
Server applies input, responds in next state: agent.lastInputSeq = 42

Client can compare:
  if (serverAgent.lastInputSeq < localSentSeq) {
    // Server hasn't processed our latest input yet
    // Keep showing local prediction for responsiveness
  } else {
    // Server caught up, use server state
  }
```

**Design Decision:** No client-side prediction for v10. The server-authoritative model with interpolation provides sufficient responsiveness for the auto-combat game loop where precision timing is less critical than in FPS games. If 150ms+ latency (Korean users) causes issues, client-side prediction can be added in Phase 3.

### 16.5 Reconnection State Handling

On WebSocket disconnect + reconnect:
1. Client clears all local state
2. Sends `join_room` as fresh player
3. Receives `joined` with new spawn position
4. No attempt to resume previous session or state
5. 30-second grace period protects newly spawned player

This simplifies the architecture significantly. Session resume would require server-side session storage, timeout management, and agent "parking" -- complex machinery for a 5-minute round game with minimal benefit.

---

## 17. Bot AI Architecture

### 17.1 Bot Lifecycle

```
Room enters 'playing' state
  -> BotManager.SpawnBots(targetCount=15)
  -> Each bot: Agent with IsBot=true, random skin, auto-generated name

Every tick (inside Arena.Tick step 1):
  -> BotManager.Update(arena)
  -> For each alive bot:
     -> Evaluate behavior tree
     -> Generate synthetic InputMsg (angle, boost)
     -> Apply to agent directly (no channel, same goroutine)
```

### 17.2 Bot Behavior Tree

```
Root (Priority Selector)
│
├── [1] Danger Avoidance (highest priority)
│   ├── Condition: mass < 20 AND nearby enemy within 80px
│   └── Action: Flee (angle = opposite of nearest enemy)
│
├── [2] Level-Up Response
│   ├── Condition: PendingChoices != nil
│   └── Action: Choose upgrade based on BuildPath (see 17.3)
│
├── [3] Kill Opportunity
│   ├── Condition: nearby enemy mass < own mass * 0.5 AND within 100px
│   └── Action: Chase + Boost (angle toward target, boost=true)
│
├── [4] Orb Collection
│   ├── Condition: orbs within 150px
│   └── Action: Move toward nearest high-value orb cluster
│
├── [5] Map Object Usage
│   ├── Condition: Healing Spring nearby AND mass < 50%
│   └── Action: Move toward map object
│
└── [6] Wander (fallback)
    └── Action: Random angle shift every 60-120 ticks, stay within arena

Evaluation: Every tick, top-to-bottom priority. First matching node executes.
```

### 17.3 Bot Build Paths

Each bot spawns with one of 5 predefined build paths:

| Path | Priority Tomes | Priority Abilities | Strategy |
|------|---------------|-------------------|----------|
| **Aggressive** | Damage x5, Cursed x2 | Venom Aura, Lightning | High DPS glass cannon |
| **Tank** | Armor x4, Regen x3 | Shield Burst, Mass Drain | Survive + absorb |
| **Speedster** | Speed x4, Magnet x2 | Speed Dash, Gravity Well | Fast collection + escape |
| **XP Farmer** | XP x5, Luck x3 | Gravity Well, Speed Dash | Race to max level |
| **Balanced** | Damage x2, Armor x2, Speed x1 | Random | Jack of all trades |

When `level_up` triggers:
```go
func (b *Bot) chooseUpgrade(choices []UpgradeChoice) int {
    // 1. Check if any choice matches build path priority
    for _, preferred := range b.buildPath.priorities {
        for i, choice := range choices {
            if choice.ID == preferred { return i }
        }
    }
    // 2. Fallback: prefer Tomes over Abilities (65/35 like upgrade system)
    // 3. Last resort: random
    return rand.Intn(len(choices))
}
```

### 17.4 Bot Difficulty Scaling

Bots get stronger over time within a round to maintain pressure:

| Time | Bot Behavior Adjustment |
|------|------------------------|
| 0-60s | Passive: mostly wander + collect, avoid combat |
| 60-120s | Normal: balanced combat/collection |
| 120-180s | Aggressive: actively seek kills, boost more often |
| 180-300s | Hunter: target low-mass players, coordinate with arena shrink |

Implementation: `botAggressiveness = min(1.0, roundElapsedSeconds / 180.0)`

### 17.5 Bot vs AI Agent Distinction

| Aspect | Bot (Built-in) | AI Agent (External LLM) |
|--------|---------------|------------------------|
| Connection | None (same goroutine as Room) | WebSocket (same as human) |
| Input | Direct Agent method call | `input` event through Hub |
| Build Choice | Predefined path | LLM decision via `choose_upgrade` |
| Strategy | Fixed behavior tree | Dynamic, trainable via Training API |
| Purpose | Fill rooms, provide PvE content | User's custom AI player |
| Authentication | N/A | API Key (`X-Agent-Key` header) |

---

## 18. Architecture Decision Records

This section lists all Architecture Decision Records. Full ADR documents are in [`docs/adr/`](adr/).

### Prior ADRs (from v10 design phase)

| ADR | Decision | Status |
|-----|----------|--------|
| ADR-011 | Go + Raw WebSocket (Socket.IO replacement) | Accepted |
| ADR-012 | Channel-based Hub (lock-free) | Accepted |
| ADR-013 | Per-Room Goroutine (independent game loops) | Accepted |
| ADR-014 | Separate `server/` folder (Go in monorepo) | Accepted |
| ADR-015 | JSON first, Binary optimization deferred | Accepted |
| ADR-016 | Monolithic Game Server (no microservices) | Accepted |
| ADR-017 | In-Memory State + JSON File Persistence | Accepted |
| ADR-018 | 2D Canvas first -> 3D R3F gradual migration | Accepted |

### New ADRs (from deep architecture phase)

| ADR | Decision | Status |
|-----|----------|--------|
| [ADR-019](adr/ADR-019.md) | Upgrade System: Server-Side Timeout with Random Fallback | Accepted |
| [ADR-020](adr/ADR-020.md) | No Session Resume on Reconnection | Accepted |
| [ADR-021](adr/ADR-021.md) | Interpolation-Only Client (No Client-Side Prediction) | Accepted |
| [ADR-022](adr/ADR-022.md) | Bot AI: Priority-Based Behavior Tree | Accepted |
| [ADR-023](adr/ADR-023.md) | Feature Flags via Environment Variables | Accepted |
| [ADR-024](adr/ADR-024.md) | Layered Error Propagation Strategy | Accepted |

---

## 19. Open Questions & Future Considerations

| # | Question | Impact Area | Decision Point |
|---|---------|-------------|----------------|
| Q1 | MessagePack transition timing: is JSON with field abbreviations sufficient for 5,000 CCU bandwidth? | Network | After Phase 1 load test |
| Q2 | Redis necessity timing: when does single-instance hit its ceiling? Realistic CCU expectation? | Infrastructure | After service launch metrics |
| Q3 | Agent API auth: is API Key sufficient? Need OAuth2 for third-party agents? | Security | Phase 4 |
| Q4 | 3D R3F transition: can 100 agents x 6 InstancedMesh parts perform on mobile? | Rendering | Phase 3 prototype |
| Q5 | Bot AI advancement: rules-based -> reinforcement learning/ML? | AI | Phase 5+ |
| Q6 | Persistent storage upgrade: JSON files -> SQLite/PostgreSQL timing? | Data | When users exceed 1,000 |
| Q7 | Global deployment: is US-West acceptable for Korean users (150-200ms RTT)? | Infrastructure | When Korean user base grows |
| Q8 | Mobile-specific client: React Native / PWA / WebView? | Client | Phase 5+ |
| Q9 | Upgrade timeout race: what if player sends `choose_upgrade` at tick 99 (deadline 100)? | Game Logic | Phase 1 implementation |
| Q10 | MapObject cooldown synchronization: how to handle cooldown display across state broadcasts? | Protocol | Phase 2 |

---

## Appendix A: Concurrency Model Summary

```
main goroutine
├── [1] HTTP Server              (chi.ListenAndServe)
├── [1] WS Hub                  (channel-based, lock-free)
├── [1] RoomManager             (room lifecycle)
│   ├── [N] Room x 50           (independent 20Hz game loop)
│   └── [1] Lobby Broadcaster   (1Hz rooms_update)
├── [1] Signal Watcher          (SIGINT/SIGTERM -> graceful shutdown)
│
Per WebSocket Connection:
├── [1] ReadPump                (client -> server)
├── [1] WritePump               (server -> client)
└── [1] Buffered channel (64)   (backpressure, slow client eviction)

Total (5,000 CCU): ~10,055 goroutines = ~20MB stack memory
```

## Appendix B: Development Roadmap Alignment

| Phase | Steps | Architecture Dependencies |
|-------|-------|--------------------------|
| Phase 0 (S01-S12) | Go infrastructure | S4.2 Server Container, S5.1 WS Layer, S15 Deployment |
| Phase 1 (S13-S21) | Game systems | S5.2 Game Layer, S9 Data Model |
| Phase 1a (S22-S26) | Room/Bot | S5.2 RoomManager, S6.4 Room State Machine, S17 Bot AI |
| Phase 2 (S27-S32) | Balance/Deploy | S12 Performance, S15 Infrastructure |
| Phase 3 (S33-S45) | Client integration | S4.3 Client Container, S5.4-5.5 Client Layers, S16 State Reconciliation |
| Phase 4 (S46-S52) | Agent API | S8 REST API, S11 Security |
| Phase 5 (S53-S59) | Meta/AI | S9.4 Persistent Data, S8.3 Progression API |

## Appendix C: Cross-Reference to Design Documents

| Architecture Section | Reference Design Document |
|---------------------|--------------------------|
| S5.1 WS Layer | `v10-go-server-plan.md` S4, S6 |
| S5.2 Game Layer | `v10-go-server-plan.md` S5, `v10-survival-roguelike-plan.md` S2-5 |
| S5.4-5.5 Client | `v10-3d-graphics-plan.md` Part A, `v10-ui-ux-plan.md` S3-9 |
| S7 Protocol | `v10-go-server-plan.md` S6.2-6.3 |
| S9 Data Model | `v10-survival-roguelike-plan.md` S5B.2, S4, S9 |
| S12 Performance | `v10-go-server-plan.md` S8-9 |
| S15 Deployment | `v10-go-server-plan.md` S9.3 |
| S17 Bot AI | `v10-survival-roguelike-plan.md` S8 |
