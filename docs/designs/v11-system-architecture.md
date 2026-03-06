# AI World War v11 — Deep System Architecture

> **Version**: v11.0
> **Date**: 2026-03-06
> **Status**: DRAFT
> **Based on**: `v11-world-war-plan.md` (1,580 lines, 15 sections)
> **Scope**: C4 Level 2-3, API Specs, Data Model, Security, Infrastructure
> **Predecessor**: `docs/ARCHITECTURE.md` (v10 deep architecture)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Goals / Non-Goals](#2-goals--non-goals)
3. [C4 Level 2 — Container Diagram](#3-c4-level-2--container-diagram)
4. [C4 Level 3 — Component Design](#4-c4-level-3--component-design)
5. [Data Flow & Sequence Diagrams](#5-data-flow--sequence-diagrams)
6. [API Specification](#6-api-specification)
7. [Data Model (ERD)](#7-data-model-erd)
8. [Frontend Architecture](#8-frontend-architecture)
9. [Security Architecture](#9-security-architecture)
10. [Blockchain Architecture](#10-blockchain-architecture)
11. [Infrastructure & Deployment](#11-infrastructure--deployment)
12. [Scalability & Performance](#12-scalability--performance)
13. [Observability](#13-observability)
14. [ADR Summary](#14-adr-summary)
15. [Verification Matrix](#15-verification-matrix)
16. [Open Questions](#16-open-questions)

---

## 1. Overview

AI World War v11 transforms the existing room-based arena game (v10) into a **geopolitical strategy + real-time combat** platform where 195 real-world countries serve as individual battle arenas. The system operates on three interconnected layers:

- **Layer 1 (Agent)**: AI agent training, deployment, API-driven autonomous play
- **Layer 2 (Battle)**: 5-minute country arena combat cycles (extends v10 core loop)
- **Layer 3 (Meta)**: World map sovereignty, faction diplomacy, economy, seasons

**Core Technical Shift**: From 5 fixed rooms (`RoomManager` + `Room[5]`) to 195 on-demand country arenas (`WorldManager` + `CountryArena[0..195]`), backed by PostgreSQL/Redis for persistence and CROSS Mainnet for blockchain token economy.

### 1.1 System Context (C4 Level 1)

```
                    ┌────────────────────┐
                    │   Web Browser       │
                    │   (Player/Agent)    │
                    └─────────┬──────────┘
                              │ HTTPS / WSS
                    ┌─────────▼──────────┐
                    │   CDN (Vercel)      │
                    │   Next.js 15 SSR    │
                    └─────────┬──────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
    ┌─────────▼──┐  ┌────────▼───┐  ┌────────▼───────┐
    │ Meta Server │  │Game Server │  │ Background     │
    │ (REST+WS)   │  │(WS 20Hz)  │  │ Workers        │
    │ Go 1.24     │  │Go 1.24    │  │ Go 1.24        │
    └──────┬──────┘  └─────┬─────┘  └───┬────────────┘
           │               │            │
    ┌──────▼───────────────▼────────────▼──┐
    │        Redis 7 (pub/sub + cache)      │
    └──────────────────┬───────────────────┘
                       │
    ┌──────────────────▼───────────────────┐
    │        PostgreSQL 16 (persistence)    │
    └──────────────────────────────────────┘
                       │
    ┌──────────────────▼───────────────────┐
    │   CROSS Mainnet (Blockchain)          │
    │   ERC-20 Tokens + Treasury + Oracle   │
    └──────────────────────────────────────┘
```

### 1.2 Key Actors

| Actor | Protocol | Description |
|-------|----------|-------------|
| **Human Player** | HTTPS + WSS | Browser-based play, spectate, manage agents |
| **AI Agent (API)** | REST + WSS | External LLM/bot controlling agents via API keys |
| **Background Worker** | Internal goroutine | Economy ticks, season management, event generation |
| **Blockchain Oracle** | JSON-RPC (CROSS) | Token market cap reads for defense buff calculation |

## 2. Goals / Non-Goals

### Goals

| # | Goal | Measurable Target |
|---|------|-------------------|
| G1 | **On-demand arena scaling** | 0-195 concurrent arenas, <2ms tick at 50 active |
| G2 | **Persistent world state** | PostgreSQL for all meta-game, Redis for real-time |
| G3 | **Dual-server architecture** | Game Server (20Hz combat) + Meta Server (REST/WS) decoupled via Redis pub/sub |
| G4 | **API-first agent platform** | REST + WS endpoints, 30 req/min rate limit, OpenAPI spec |
| G5 | **4-week season lifecycle** | Auto era transitions, monthly reset with data preservation |
| G6 | **Blockchain token economy** | 195 ERC-20 tokens on CROSS Mainnet, defense oracle integration |
| G7 | **Real-time world visualization** | MapLibre GL 2D + three-globe 3D, smooth transitions |
| G8 | **v10 combat core preserved** | Zero breaking changes to arena.go/agent.go/collision.go game loop |

### Non-Goals

| # | Non-Goal | Reason |
|---|----------|--------|
| NG1 | Microservices / Kubernetes | Premature for Phase 1; single binary with internal packages |
| NG2 | gRPC inter-service comms | REST + Redis pub/sub sufficient at current scale |
| NG3 | Real-time voice/chat | Out of scope; text-based news feed only |
| NG4 | Mobile native apps | Web-only; responsive design for mobile browsers |
| NG5 | Custom map tile server | Use MapLibre with static GeoJSON, not self-hosted tiles |
| NG6 | On-chain game state | Only tokens/treasury on-chain; game state is off-chain |

## 3. C4 Level 2 — Container Diagram

### 3.1 Container Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            CLIENT (Browser)                                  │
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ LobbyGlobe   │  │ WorldMap2D   │  │ BattleView   │  │ DashboardUI  │   │
│  │ (three-globe │  │ (MapLibre GL)│  │ (R3F Canvas) │  │ (React)      │   │
│  │  + R3F)      │  │              │  │              │  │              │   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │
│         └──────────────────┴────────┬────────┴─────────────────┘           │
│                                     │                                      │
│                          ┌──────────▼──────────┐                           │
│                          │  SocketManager       │                           │
│                          │  (useSocket hook)    │                           │
│                          └──────────┬──────────┘                           │
└─────────────────────────────────────┼───────────────────────────────────────┘
                                      │ WSS + HTTPS
┌─────────────────────────────────────┼───────────────────────────────────────┐
│                            SERVER (Go 1.24)                                  │
│                                                                             │
│  ┌──────────────────────────────────▼──────────────────────────────────┐    │
│  │                    API Gateway (chi router)                          │    │
│  │   /ws/game/*  →  Game WS Hub     /api/*  →  Meta REST Router       │    │
│  │   /ws/meta/*  →  Meta WS Hub     /ws/agents/* → Agent Stream Hub   │    │
│  └────────┬──────────────┬──────────────┬─────────────────────────────┘    │
│           │              │              │                                   │
│  ┌────────▼─────┐ ┌─────▼──────┐ ┌────▼───────────────┐                   │
│  │ Game Server   │ │Meta Server │ │ Background Workers │                   │
│  │              │ │            │ │                    │                   │
│  │ WorldManager │ │ AuthService│ │ EconomyTicker      │                   │
│  │ CountryArena │ │ FactionMgr │ │ DiplomacyTicker    │                   │
│  │ Arena (v10)  │ │ DiplomacyE │ │ EventGenerator     │                   │
│  │ Agent        │ │ EconomyEng │ │ SeasonScheduler    │                   │
│  │ Collision    │ │ SeasonMgr  │ │ BlockchainWorker   │                   │
│  │ OrbManager   │ │ AgentAPI   │ │ NewsFeedGenerator  │                   │
│  │ BotManager   │ │ NewsEngine │ │ SovereigntySync    │                   │
│  └──────┬───────┘ └─────┬──────┘ └────────┬───────────┘                   │
│         └───────────────┬┘                 │                               │
│                    ┌────▼─────────────────▼────┐                           │
│                    │   Redis 7                   │                           │
│                    │   Channels:                 │                           │
│                    │   battle:{iso} (results)    │                           │
│                    │   sovereignty:{iso}          │                           │
│                    │   global:events              │                           │
│                    │   session:{user_id}          │                           │
│                    └────────────┬────────────────┘                           │
│                                 │                                           │
│                    ┌────────────▼────────────────┐                           │
│                    │   PostgreSQL 16              │                           │
│                    │   Tables: users, factions,   │                           │
│                    │   countries, seasons, battles │                           │
│                    │   diplomacy, economy, etc.   │                           │
│                    └─────────────────────────────┘                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Container Responsibilities

| Container | Technology | Responsibility | Scaling Unit |
|-----------|-----------|----------------|-------------|
| **API Gateway** | Go chi router | Route HTTP/WS to Game or Meta | Single process (Phase 1) |
| **Game Server** | Go goroutines | Real-time combat (20Hz tick), arena management | By country shard (Phase 3) |
| **Meta Server** | Go chi handlers | REST API for factions/economy/diplomacy/agents | Horizontal replicas (Phase 2) |
| **Background Workers** | Go goroutines | Periodic tasks (economy 1h, diplomacy 24h, events) | Single leader (Phase 1) |
| **Redis** | Redis 7 | Real-time state cache, pub/sub, sessions | Cluster (Phase 3) |
| **PostgreSQL** | PostgreSQL 16 | Persistent data (users, factions, countries, seasons) | Read replicas (Phase 2) |
| **CROSS Mainnet** | EVM blockchain | Token factory, treasury, oracle, governance | N/A (decentralized) |
| **Vercel CDN** | Next.js 15 | SSR + static assets, React frontend | Auto-scaled |

### 3.3 Inter-Container Communication

| From | To | Protocol | Pattern | Frequency |
|------|----|----------|---------|-----------|
| Client | API Gateway | WSS | Bidirectional stream | 30Hz input, 20Hz state |
| Client | API Gateway | HTTPS | Request-Response | On-demand REST |
| Game Server | Redis | TCP | Pub (battle results) | Per battle end (~every 5min) |
| Meta Server | Redis | TCP | Sub (battle results) | Event-driven |
| Meta Server | PostgreSQL | TCP | SQL queries | On-demand |
| Workers | PostgreSQL | TCP | SQL + batch writes | 1h/24h/weekly cycles |
| Workers | Redis | TCP | Pub (sovereignty updates) | Per sovereignty change |
| Workers | CROSS RPC | JSON-RPC | Read token prices | Every 5 min |

### 3.4 Deployment Topology (Phase 1 — MVP)

```
┌──────────────────────────────┐     ┌──────────────────────────────┐
│  Vercel (Frontend)            │     │  Railway (Backend)            │
│                              │     │                              │
│  Next.js 15 SSR              │────►│  Single Go Binary:           │
│  MapLibre GL + R3F           │ WS  │    API Gateway               │
│  Static GeoJSON              │ +   │    Game Server (goroutines)  │
│  CROSSx SDK                  │REST │    Meta Server (goroutines)  │
│                              │     │    Background Workers        │
└──────────────────────────────┘     └──────────┬───────────────────┘
                                                 │
                                     ┌───────────▼────────────┐
                                     │  Railway Managed        │
                                     │  PostgreSQL 16          │
                                     │  Redis 7                │
                                     └─────────────────────────┘
```

**ADR-025**: Phase 1 runs as a single Go binary with internal package separation. Game Server and Meta Server are separate Go packages that communicate via Go channels and Redis pub/sub (not HTTP). This avoids network overhead while maintaining clean boundaries for future splitting.

## 4. C4 Level 3 — Component Design

### 4.1 Game Server Components

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Game Server Package                             │
│                      server/internal/game/                           │
│                      server/internal/world/                          │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  WorldManager (NEW — replaces RoomManager)                   │    │
│  │                                                             │    │
│  │  Responsibilities:                                          │    │
│  │  - 195 country state registry (in-memory + Redis sync)      │    │
│  │  - On-demand CountryArena creation/pooling                  │    │
│  │  - 5-min battle cycle scheduler                             │    │
│  │  - Route player input to correct CountryArena               │    │
│  │  - Sovereignty state broadcast (1Hz)                        │    │
│  │                                                             │    │
│  │  Key Fields:                                                │    │
│  │    countries    map[string]*CountryState  // ISO3 → state   │    │
│  │    arenaPool    *ArenaPool               // recycled arenas │    │
│  │    activeArenas map[string]*CountryArena  // ISO3 → arena   │    │
│  │    redis        *redis.Client                               │    │
│  └──────────────────────────┬──────────────────────────────────┘    │
│                              │ manages                              │
│  ┌──────────────────────────▼──────────────────────────────────┐    │
│  │  CountryArena (NEW — extends Room)                           │    │
│  │                                                             │    │
│  │  Composition: embeds Room + adds country context            │    │
│  │  - CountryData (tier, resources, terrain, neighbors)        │    │
│  │  - Faction-aware scoring (aggregate by faction)             │    │
│  │  - Sovereignty transition logic (20% defender advantage)    │    │
│  │  - Battle type variants (Arena/Skirmish/Siege/WorldWar)     │    │
│  │  - Terrain-specific arena themes (6 biome types)            │    │
│  │  - Result emission to Redis battle:{iso} channel            │    │
│  └──────────────────────────┬──────────────────────────────────┘    │
│                              │ embeds                               │
│  ┌──────────────────────────▼──────────────────────────────────┐    │
│  │  Room (PRESERVED from v10)                                   │    │
│  │  State machine: waiting→countdown→playing→ending→cooldown   │    │
│  └──────────────────────────┬──────────────────────────────────┘    │
│                              │ owns                                 │
│  ┌──────────────────────────▼──────────────────────────────────┐    │
│  │  Arena (PRESERVED from v10)                                  │    │
│  │  - 20Hz game loop (processTick)                             │    │
│  │  - Agent management (Add/Remove/Get)                        │    │
│  │  - Collision system, OrbManager, Leaderboard                │    │
│  │  - ShrinkZone (tier-scaled: S=-600px, D=-100px)             │    │
│  │  - Upgrade/LevelUp system                                   │    │
│  └──────────────────────────┬──────────────────────────────────┘    │
│                              │ contains                             │
│  ┌──────────────────────────▼──────────────────────────────────┐    │
│  │  Agent (PRESERVED from v10)                                  │    │
│  │  + FactionID string          // NEW: faction membership     │    │
│  │  + OwnerUserID string        // NEW: owning user            │    │
│  │  + DeploymentCountry string  // NEW: deployed country ISO3  │    │
│  │  + IsCommander bool          // NEW: manual control active  │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ┌─────────────────────────┐  ┌─────────────────────────────────┐  │
│  │  ArenaPool (NEW)         │  │  CommanderBridge (NEW)           │  │
│  │  - Pre-allocated arenas  │  │  - AI→Manual mode switch        │  │
│  │  - Acquire/Release       │  │  - 1s invincibility on switch   │  │
│  │  - Size-based allocation │  │  - 30s idle → auto AI return    │  │
│  │  - Max 50 concurrent     │  │  - Transfer rate limit (3/fight)│  │
│  └─────────────────────────┘  └─────────────────────────────────┘  │
│                                                                     │
│  PRESERVED (no changes): collision.go, orb.go, shrink.go,          │
│  leaderboard.go, spatial_hash.go, progression.go, upgrade.go,      │
│  bot.go, build_path.go, coach.go, quests.go, map_objects.go        │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 Meta Server Components

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Meta Server Package                             │
│                      server/internal/meta/                           │
│                      server/internal/api/                            │
│                      server/internal/auth/                           │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ AuthService   │  │ FactionMgr   │  │ DiplomacyEng │              │
│  │              │  │              │  │              │              │
│  │ JWT issue/   │  │ CRUD factions│  │ Treaties     │              │
│  │ verify       │  │ Membership   │  │ War system   │              │
│  │ API Key mgmt │  │ Hierarchy    │  │ Siege trigger│              │
│  │ Rate Limiter │  │ Treasury     │  │ Tension calc │              │
│  │ Middleware   │  │ Prestige     │  │ UN Council   │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ EconomyEngine│  │ SeasonMgr    │  │ AgentAPICtrl │              │
│  │              │  │              │  │              │              │
│  │ Resource prod│  │ 4-week cycle │  │ Deploy/Recall│              │
│  │ Trade market │  │ Era transitions│ │ Strategy     │              │
│  │ GDP calc     │  │ Reset logic  │  │ Battle log   │              │
│  │ Policy mgmt  │  │ Hall of Fame │  │ LLM bridge   │              │
│  │ Trade routes │  │ Achievements │  │ Live stream  │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ SovereigntyMgr│ │ NewsEngine   │  │ EventGen     │              │
│  │              │  │              │  │              │              │
│  │ Ownership    │  │ Auto-generate│  │ Random events│              │
│  │ transitions  │  │ from events  │  │ (disasters)  │              │
│  │ Level calc   │  │ WebSocket    │  │ Probability  │              │
│  │ Capital sys  │  │ push to feed │  │ engine       │              │
│  │ Continental  │  │ Archive 24h  │  │ Effect apply │              │
│  │ bonuses      │  │              │  │              │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐                                │
│  │ TechTreeMgr  │  │ MercenaryMgr │                                │
│  │              │  │              │                                │
│  │ 3-path tree  │  │ NPC agents   │                                │
│  │ Research inv │  │ Hire/deploy  │                                │
│  │ Bonus unlock │  │ Auto-defend  │                                │
│  └──────────────┘  └──────────────┘                                │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.3 WebSocket Hub Architecture (extends v10 Hub)

```
┌─────────────────────────────────────────────────────────────────────┐
│                      WS Layer (server/internal/ws/)                   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  GameHub (extends Hub)                                       │    │
│  │  - Room channels: country:{iso} (per-country broadcast)     │    │
│  │  - Lobby channel: world:lobby (sovereignty updates 1Hz)     │    │
│  │  - Spectator channels: spectate:{iso} (read-only streams)  │    │
│  │  - Methods: BroadcastToCountry, BroadcastToSpectators       │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  MetaHub (NEW)                                               │    │
│  │  - Global channel: meta:global (news feed, world events)    │    │
│  │  - Faction channels: faction:{id} (diplomacy alerts)        │    │
│  │  - User channels: user:{id} (personal notifications)        │    │
│  │  - Methods: BroadcastNews, NotifyFaction, NotifyUser         │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  AgentStreamHub (NEW)                                        │    │
│  │  - Per-agent stream: agent:{id} (live battle data)          │    │
│  │  - Auth: API key via query parameter                        │    │
│  │  - Multi-subscribe: watch multiple agents simultaneously    │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.4 Background Workers

| Worker | Interval | Responsibility | Redis Channel |
|--------|----------|----------------|---------------|
| **EconomyTicker** | 1 hour | Calculate resource production for all 195 countries, apply policies, distribute resources | `economy:tick` |
| **DiplomacyTicker** | 24 hours | Treaty expiration, tension recalculation, population changes | `diplomacy:tick` |
| **EventGenerator** | 1 hour (check) | Random event generation (1-3/day), probability-based | `global:events` |
| **SeasonScheduler** | 1 min (check) | Era transitions, Final Rush activation, season end/reset | `season:transition` |
| **SovereigntySync** | 5 min | Sync sovereignty state Redis→PostgreSQL, recalculate continental bonuses | `sovereignty:sync` |
| **BlockchainWorker** | 5 min | Read CROSS RPC token prices, execute GDP buybacks, update defense oracle | `blockchain:oracle` |
| **NewsFeedGenerator** | Event-driven | Generate news items from battle results, sovereignty changes, diplomacy events | `news:feed` |

### 4.5 v10 → v11 Code Transformation Map

| v10 File | v11 Transformation | New Location |
|----------|-------------------|-------------|
| `game/room_manager.go` | **Replace** → WorldManager | `world/world_manager.go` |
| `game/room.go` | **Preserve** + embed in CountryArena | `game/room.go` (unchanged) |
| `game/arena.go` | **Preserve** (zero changes to game loop) | `game/arena.go` (unchanged) |
| `game/agent.go` | **Extend** + faction/deployment fields | `game/agent.go` (add fields) |
| `game/collision.go` | **Preserve** | `game/collision.go` (unchanged) |
| `game/bot.go` | **Preserve** | `game/bot.go` (unchanged) |
| `ws/hub.go` | **Extend** → GameHub + MetaHub + AgentStreamHub | `ws/game_hub.go`, `ws/meta_hub.go`, `ws/agent_hub.go` |
| `ws/client.go` | **Extend** + auth context (user_id, faction_id) | `ws/client.go` (add fields) |
| `ws/protocol.go` | **Extend** + new event types | `ws/protocol.go` (add events) |
| `domain/types.go` | **Extend** + CountryData, FactionData, etc. | `domain/types.go` (add types) |
| `domain/events.go` | **Extend** + meta-game events | `domain/events.go` (add events) |
| N/A (NEW) | CountryArena | `world/country_arena.go` |
| N/A (NEW) | SovereigntyManager | `world/sovereignty.go` |
| N/A (NEW) | Auth package | `auth/jwt.go`, `auth/apikey.go`, `auth/middleware.go` |
| N/A (NEW) | Meta package | `meta/faction.go`, `meta/diplomacy.go`, `meta/economy.go`, etc. |
| N/A (NEW) | API routes | `api/agent_routes.go`, `api/world_routes.go`, `api/faction_routes.go` |
| N/A (NEW) | DB package | `db/schema.sql`, `db/migrations/`, `db/queries.go` |
| N/A (NEW) | Cache package | `cache/redis.go`, `cache/channels.go` |

## 5. Data Flow & Sequence Diagrams

### 5.1 Core Loop: Agent Deployment → Battle → Sovereignty

```
Player           Meta Server        Game Server       Redis          PostgreSQL
  │                  │                   │              │               │
  │ POST /api/agents/deploy              │              │               │
  │ {country:"KOR", agent_id:"a1"}       │              │               │
  │─────────────────►│                   │              │               │
  │                  │ validate(auth,     │              │               │
  │                  │ deploy limits,     │              │               │
  │                  │ Oil cost)          │              │               │
  │                  │──────────────────────────────────►│ UPDATE agents │
  │                  │                   │              │               │
  │                  │ PUB deploy:{KOR}  │              │               │
  │                  │──────────────────►│◄─────────────│               │
  │                  │                   │ SUB deploy:* │               │
  │                  │                   │              │               │
  │  ◄───────────────│ 200 OK            │              │               │
  │                  │                   │              │               │
  │                  │            [5-min battle cycle]   │               │
  │                  │                   │              │               │
  │                  │                   │ Battle ends  │               │
  │                  │                   │ Score:{       │               │
  │                  │                   │  faction_a:850│               │
  │                  │                   │  faction_b:720│               │
  │                  │                   │ }            │               │
  │                  │                   │──────────────►│               │
  │                  │                   │PUB battle:KOR│               │
  │                  │                   │              │               │
  │                  │◄──────────────────│──────────────│               │
  │                  │ SUB battle:KOR    │              │               │
  │                  │                   │              │               │
  │                  │ Update sovereignty│              │               │
  │                  │──────────────────────────────────►│ UPDATE        │
  │                  │                   │              │ countries      │
  │                  │ PUB sovereignty:KOR│             │               │
  │                  │──────────────────►│              │               │
  │                  │                   │              │               │
  │◄─────────────────│ WS: sovereignty_changed         │               │
  │ {country:"KOR",  │                   │              │               │
  │  faction:"Dragons"│                  │              │               │
  │  level:2}         │                  │              │               │
```

### 5.2 Economy Tick Flow

```
EconomyTicker     PostgreSQL          Redis           Meta Server      Clients
  │                  │                  │                │               │
  │ [every 1 hour]   │                  │                │               │
  │                  │                  │                │               │
  │ SELECT countries │                  │                │               │
  │ WHERE sovereign  │                  │                │               │
  │────────────────►│                  │                │               │
  │◄────────────────│ 195 rows         │                │               │
  │                  │                  │                │               │
  │ FOR EACH country:│                  │                │               │
  │  production =    │                  │                │               │
  │   base × tier   │                  │                │               │
  │   × sov_level   │                  │                │               │
  │   × policy_mod  │                  │                │               │
  │   × event_mod   │                  │                │               │
  │                  │                  │                │               │
  │  distribute:     │                  │                │               │
  │   50% → faction  │                  │                │               │
  │   30% → governor │                  │                │               │
  │   20% → fighters │                  │                │               │
  │                  │                  │                │               │
  │ BATCH UPDATE     │                  │                │               │
  │ factions.treasury│                  │                │               │
  │ users.resources  │                  │                │               │
  │────────────────►│                  │                │               │
  │                  │                  │                │               │
  │ GDP recalc       │                  │                │               │
  │────────────────►│ UPDATE gdp       │                │               │
  │                  │                  │                │               │
  │ PUB economy:tick │                  │                │               │
  │──────────────────────────────────►│                │               │
  │                  │                  │ broadcast     │               │
  │                  │                  │──────────────►│               │
  │                  │                  │                │──────────────►│
  │                  │                  │                │ WS: econ_update│
```

### 5.3 War Declaration → Siege Battle Flow

```
Attacker         Meta Server        DiplomacyEngine    Game Server      Defender
  │                  │                   │                │               │
  │ POST /api/diplomacy/declare-war      │                │               │
  │ {target_faction: "Bears"}            │                │               │
  │─────────────────►│                   │                │               │
  │                  │ validate:          │                │               │
  │                  │ Influence≥300     │                │               │
  │                  │ Oil≥500           │                │               │
  │                  │──────────────────►│                │               │
  │                  │                   │ Create war     │               │
  │                  │                   │ record         │               │
  │                  │                   │ Start 48h prep │               │
  │                  │                   │                │               │
  │◄─────────────────│ WS: war_declared  │                │               │
  │                  │──────────────────────────────────────────────────►│
  │                  │                   │                │  WS: war_declared
  │                  │                   │                │               │
  │          [48 hours pass — both sides prepare]         │               │
  │                  │                   │                │               │
  │ POST /api/diplomacy/siege            │                │               │
  │ {target_country: "RUS"}              │                │               │
  │─────────────────►│                   │                │               │
  │                  │──────────────────►│ validate       │               │
  │                  │                   │ war active     │               │
  │                  │                   │ adjacent OK    │               │
  │                  │                   │────────────────►               │
  │                  │                   │ CreateSiegeBattle              │
  │                  │                   │ (defense +30%) │               │
  │                  │                   │                │ [7-min battle]│
  │                  │                   │                │               │
  │                  │                   │◄───────────────│ Battle result │
  │                  │                   │ Process result │               │
  │                  │                   │ → sovereignty  │               │
  │                  │                   │   transfer OR  │               │
  │                  │                   │   defense held │               │
```

### 5.4 Commander Mode Switch Flow

```
Player           Client             Game Server        Agent
  │                  │                   │               │
  │ Click "Take      │                   │               │ [AI auto-play]
  │ Command"         │                   │               │
  │─────────────────►│                   │               │
  │                  │ WS: commander_take│               │
  │                  │──────────────────►│               │
  │                  │                   │ Check:         │
  │                  │                   │ - Battle active│
  │                  │                   │ - Switch count │
  │                  │                   │   < 3/battle   │
  │                  │                   │ - Cooldown 3s  │
  │                  │                   │               │
  │                  │                   │ Agent.IsCommander = true
  │                  │                   │ 1s invincible  │
  │                  │                   │──────────────►│ [stop AI]
  │                  │                   │               │
  │                  │◄──────────────────│ WS: commander_active
  │◄─────────────────│ Show Commander HUD│               │
  │                  │                   │               │
  │ [mouse/keyboard  │                   │               │
  │  input for 30s]  │                   │               │
  │─────────────────►│ WS: input         │               │
  │                  │──────────────────►│──────────────►│ [manual move]
  │                  │                   │               │
  │ [30s no input]   │                   │               │
  │                  │                   │ auto-release   │
  │                  │                   │ Agent.IsCommander = false
  │                  │                   │──────────────►│ [resume AI]
  │                  │◄──────────────────│ WS: commander_released
  │◄─────────────────│ Hide Commander HUD│               │
```

## 6. API Specification

### 6.1 Authentication

All endpoints require either JWT token (browser users) or API Key (agent bots).

```yaml
JWT_Auth:
  Header: "Authorization: Bearer <jwt_token>"
  Claims: { user_id, username, iat, exp }
  Expiry: 24h (access), 30d (refresh)
  Refresh: POST /api/auth/refresh

API_Key_Auth:
  Header: "X-API-Key: <api_key>"
  Rate_Limit: 30 req/min per key
  Scope: Agent operations only (deploy, recall, strategy, status)
```

### 6.2 REST API Endpoints

#### Auth (`/api/auth/`)

| Method | Path | Auth | Request | Response | Description |
|--------|------|------|---------|----------|-------------|
| POST | `/register` | None | `{email, username, password}` | `{user_id, jwt_token}` | Register new user |
| POST | `/login` | None | `{email, password}` | `{jwt_token, refresh_token}` | Login |
| POST | `/refresh` | JWT | `{refresh_token}` | `{jwt_token}` | Refresh JWT |
| POST | `/api-keys` | JWT | `{name}` | `{api_key, key_id}` | Create API key (max 5) |
| GET | `/api-keys` | JWT | - | `[{key_id, name, created_at}]` | List API keys |
| DELETE | `/api-keys/:id` | JWT | - | `204` | Revoke API key |

#### World (`/api/world/`)

| Method | Path | Auth | Response | Description |
|--------|------|------|----------|-------------|
| GET | `/map` | None | `{countries: [{iso3, name, tier, sovereign_faction, sovereignty_level, battle_status, gdp}]}` | World map state |
| GET | `/countries/:iso` | None | `{full CountryData + current battle info}` | Country detail |
| GET | `/countries/:iso/history` | None | `[{season, faction, duration, gdp_peak}]` | Country sovereignty history |
| GET | `/leaderboard` | None | `{factions: [...], countries_by_gdp: [...]}` | Global leaderboard |

#### Agents (`/api/agents/`)

| Method | Path | Auth | Request | Response | Description |
|--------|------|------|---------|----------|-------------|
| POST | `/deploy` | API Key | `{country_iso}` | `{agent_id, country, status}` | Deploy agent to country |
| POST | `/recall` | API Key | `{agent_id}` | `{status}` | Recall agent |
| GET | `/:id/status` | API Key | - | `{position, hp, level, build, country, alive}` | Agent status |
| GET | `/:id/battle-log` | API Key | `?limit=20` | `[{battle_id, country, result, score, kills}]` | Recent battles |
| POST | `/:id/strategy` | API Key | `AgentStrategy` | `{updated: true}` | Set build profile |
| POST | `/:id/command` | API Key | `{action: "take"\|"release"}` | `{commander: true\|false}` | Commander mode toggle |

#### Factions (`/api/factions/`)

| Method | Path | Auth | Request | Response | Description |
|--------|------|------|---------|----------|-------------|
| POST | `/` | JWT | `{name, color, banner}` | `{faction_id}` | Create faction (1000 Gold) |
| GET | `/` | None | - | `[{id, name, territory_count, gdp, prestige}]` | List factions |
| GET | `/:id` | None | - | `{full faction data + members}` | Faction detail |
| POST | `/:id/join` | JWT | - | `{role: "member"}` | Join faction |
| POST | `/:id/leave` | JWT | - | `{status: "left"}` | Leave faction |
| POST | `/:id/promote` | JWT (leader) | `{user_id, role}` | `{updated}` | Promote member |

#### Diplomacy (`/api/diplomacy/`)

| Method | Path | Auth | Request | Response | Description |
|--------|------|------|---------|----------|-------------|
| POST | `/treaties` | JWT (leader) | `{type, target_faction_id}` | `{treaty_id}` | Propose treaty |
| POST | `/treaties/:id/accept` | JWT (leader) | - | `{status: "active"}` | Accept treaty |
| POST | `/declare-war` | JWT (leader) | `{target_faction_id}` | `{war_id, prep_ends_at}` | Declare war |
| POST | `/siege` | JWT (leader) | `{war_id, target_country_iso}` | `{battle_id}` | Initiate siege |
| POST | `/surrender` | JWT (leader) | `{war_id}` | `{terms}` | Surrender |
| GET | `/status` | JWT | - | `{treaties: [...], wars: [...], tensions: [...]}` | Diplomacy overview |

#### Economy (`/api/economy/`)

| Method | Path | Auth | Request | Response | Description |
|--------|------|------|---------|----------|-------------|
| GET | `/resources` | JWT | - | `{resources: {food, oil, steel, tech, gold, influence}}` | My resources |
| POST | `/policy` | JWT (governor) | `{country_iso, tax_rate, trade_openness, ...}` | `{applied}` | Set policy |
| POST | `/trade` | JWT | `{sell_resource, buy_resource, amount}` | `{order_id, price}` | Place trade order |
| GET | `/market` | None | - | `{prices: {oil_gold, tech_gold, ...}, volume}` | Market prices |
| GET | `/gdp-ranking` | None | - | `[{country_iso, gdp, rank}]` | GDP leaderboard |

#### Seasons (`/api/seasons/`)

| Method | Path | Auth | Response | Description |
|--------|------|------|----------|-------------|
| GET | `/current` | None | `{season_id, name, era, week, ends_at, rankings}` | Current season |
| GET | `/hall-of-fame` | None | `[{season_id, categories: [{title, winner_faction, record}]}]` | Hall of Fame |
| GET | `/:id/replay` | None | `{timeline: [{timestamp, sovereignty_snapshot}]}` | Season replay data |

### 6.3 WebSocket Events

#### Game WS (`/ws/game`)

| Direction | Event | Payload | Frequency |
|-----------|-------|---------|-----------|
| C→S | `join_country` | `{country_iso, agent_id}` | Once |
| C→S | `leave_country` | `{}` | Once |
| C→S | `input` | `{angle, boost}` | 30Hz |
| C→S | `choose_upgrade` | `{choice_index}` | On level-up |
| C→S | `commander_take` | `{agent_id}` | Manual |
| C→S | `commander_release` | `{agent_id}` | Manual |
| S→C | `joined` | `{agent_id, country_iso, spawn_pos}` | Once |
| S→C | `state` | `{tick, agents[], orbs[]}` | 20Hz |
| S→C | `battle_start` | `{country_iso, type, duration}` | Per cycle |
| S→C | `battle_end` | `{results, sovereignty_change}` | Per cycle |
| S→C | `death` | `{killer_id, stats}` | On death |
| S→C | `level_up` | `{choices[3]}` | On level-up |
| S→C | `commander_active` | `{agent_id}` | On switch |
| S→C | `commander_released` | `{agent_id}` | On release |

#### Meta WS (`/ws/meta`)

| Direction | Event | Payload | Frequency |
|-----------|-------|---------|-----------|
| S→C | `sovereignty_changed` | `{country_iso, faction_id, level}` | Per change |
| S→C | `war_declared` | `{attacker, defender, prep_ends_at}` | Per war |
| S→C | `news_item` | `{type, message, timestamp}` | Real-time |
| S→C | `season_era_change` | `{era, special_rules}` | Weekly |
| S→C | `global_event` | `{type, affected_countries, duration}` | 1-3/day |
| S→C | `world_state` | `{countries_summary[195]}` | 1Hz |

#### Agent Stream WS (`/ws/agents/:id/live`)

| Direction | Event | Payload | Frequency |
|-----------|-------|---------|-----------|
| S→C | `agent_state` | `{position, hp, level, build, action}` | 10Hz |
| S→C | `agent_battle_log` | `{event_type, detail}` | Real-time |
| S→C | `agent_death` | `{killer, stats, country}` | On death |
| S→C | `agent_level_up` | `{choices, auto_selected}` | On level-up |

### 6.4 Error Response Format

```json
{
  "error": {
    "code": "FACTION_NOT_FOUND",
    "message": "Faction with ID 'xyz' does not exist",
    "status": 404,
    "details": {}
  }
}
```

Standard error codes: `AUTH_REQUIRED`, `RATE_LIMITED`, `INSUFFICIENT_RESOURCES`, `INVALID_STATE`, `DEPLOY_LIMIT_EXCEEDED`, `WAR_COOLDOWN`, `FACTION_FULL`.

### 6.5 Intel API Endpoints (Phase 7)

| Method | Path | Auth | Request | Response | Description |
|--------|------|------|---------|----------|-------------|
| POST | `/api/intel/scout` | JWT (commander+) | `{target_country_iso}` | `{agents_count, avg_level, defense_estimate, accuracy: 0.8}` | Scout mission (50 Gold + 20 Oil, 1h cooldown) |
| POST | `/api/intel/sabotage` | JWT (council+) | `{target_country_iso}` | `{success, detected, defense_reduction}` | Sabotage (-15% defense next battle, 30% detection) |
| POST | `/api/intel/counter` | JWT (council+) | `{country_iso}` | `{active_until}` | Counter-intel (+50% detection, 24h, 100 Tech) |

### 6.6 LLM Bridge Architecture

```yaml
LLM_Bridge_Design:
  Location: server/internal/agent/llm_bridge.go
  Protocol: HTTP POST to external LLM API (user-provided endpoint)

  Whitelisted_Endpoints:
    - https://api.anthropic.com/*
    - https://api.openai.com/*
    - https://api.together.xyz/*
    - Custom endpoints registered per-user (validated URL format)

  Request_Flow:
    1. Agent levels up → game server emits level_up event
    2. LLM bridge builds prompt: {game_state, available_choices, agent_strategy}
    3. HTTP POST to user's LLM endpoint (2s timeout)
    4. Parse response: {chosen_action: 0|1|2, reasoning: "..."}
    5. Apply choice to agent (same as human upgrade pick)

  Timeout_Handling:
    - 2s hard timeout per LLM call
    - On timeout: fallback to AgentStrategy.build_priority auto-pick
    - On error (4xx/5xx): fallback + log for user dashboard
    - Max 3 consecutive failures → disable LLM for this agent until next battle

  Security:
    - User's LLM API key stored encrypted (AES-256) in PostgreSQL
    - Server never stores LLM responses longer than 1 request cycle
    - No PII sent to LLM (only game state: positions, HP, upgrades)
    - Request size limited to 4KB (game state is compact)
```

## 7. Data Model (ERD)

### 7.1 PostgreSQL Schema

> **Note**: Tables reference each other via foreign keys. In the actual migration, use `ALTER TABLE ADD CONSTRAINT` after all tables are created, or create tables in dependency order. The schema below is presented logically, not in execution order.

```sql
-- ============================================================
-- CORE TABLES
-- ============================================================

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    username        VARCHAR(32) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    faction_id      UUID REFERENCES factions(id),
    faction_role    VARCHAR(20) DEFAULT 'member',  -- supreme_leader, council, commander, member
    -- Resources (per-user, accumulated across seasons)
    gold            BIGINT DEFAULT 0,
    prestige        BIGINT DEFAULT 0,
    -- Metadata
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    last_login_at   TIMESTAMPTZ,
    is_banned       BOOLEAN DEFAULT FALSE
);

CREATE TABLE api_keys (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    key_hash        VARCHAR(64) UNIQUE NOT NULL,  -- SHA-256 of actual key
    name            VARCHAR(64) NOT NULL,
    last_used_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    revoked_at      TIMESTAMPTZ
);
CREATE INDEX idx_api_keys_user ON api_keys(user_id) WHERE revoked_at IS NULL;

CREATE TABLE agents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    api_key_id      UUID REFERENCES api_keys(id),
    name            VARCHAR(64) NOT NULL,
    skin_id         INT DEFAULT 0,
    -- Deployment state
    deployed_country VARCHAR(3) REFERENCES countries(iso3),
    status          VARCHAR(16) DEFAULT 'idle',   -- idle, deployed, in_battle, dead
    -- Strategy (persisted across battles)
    strategy_json   JSONB,                        -- AgentStrategy object
    llm_endpoint    TEXT,                          -- User's LLM API URL (encrypted)
    llm_api_key_enc BYTEA,                        -- AES-256 encrypted LLM key
    -- Stats (season-scoped)
    season_kills    INT DEFAULT 0,
    season_deaths   INT DEFAULT 0,
    season_battles  INT DEFAULT 0,
    season_wins     INT DEFAULT 0,
    -- Metadata
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    last_battle_at  TIMESTAMPTZ
);
CREATE INDEX idx_agents_user ON agents(user_id);
CREATE INDEX idx_agents_country ON agents(deployed_country) WHERE status IN ('deployed','in_battle');

CREATE TABLE factions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(64) UNIQUE NOT NULL,
    color           VARCHAR(7) NOT NULL,          -- hex color
    banner_url      TEXT,
    leader_id       UUID REFERENCES users(id),
    -- Aggregate stats
    treasury_gold   BIGINT DEFAULT 0,
    treasury_oil    BIGINT DEFAULT 0,
    treasury_steel  BIGINT DEFAULT 0,
    treasury_tech   BIGINT DEFAULT 0,
    treasury_food   BIGINT DEFAULT 0,
    prestige        BIGINT DEFAULT 0,
    -- Tech tree progress
    military_level  INT DEFAULT 0,
    economic_level  INT DEFAULT 0,
    diplomatic_level INT DEFAULT 0,
    -- Metadata
    member_count    INT DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- WORLD STATE
-- ============================================================

CREATE TABLE countries (
    iso3            VARCHAR(3) PRIMARY KEY,       -- ISO 3166-1 alpha-3
    name_original   VARCHAR(128) NOT NULL,        -- Real name (immutable)
    name_custom     VARCHAR(128),                 -- Faction-given name
    tier            CHAR(1) NOT NULL CHECK (tier IN ('S','A','B','C','D')),
    -- Sovereignty
    sovereign_faction_id UUID REFERENCES factions(id),
    sovereignty_level    INT DEFAULT 0,           -- 0-5
    sovereignty_streak   INT DEFAULT 0,           -- Consecutive wins
    capital_of_faction   UUID REFERENCES factions(id),
    -- Geography
    capital_lat     FLOAT NOT NULL,
    capital_lng     FLOAT NOT NULL,
    continent       VARCHAR(32) NOT NULL,
    neighbors       VARCHAR(3)[] NOT NULL,        -- Adjacent country ISO3 codes
    maritime_neighbors VARCHAR(3)[] DEFAULT '{}',  -- Sea neighbors (fixes H-07)
    -- Resources (base production per hour, 0-100 normalized)
    res_food        INT DEFAULT 50,
    res_oil         INT DEFAULT 50,
    res_steel       INT DEFAULT 50,
    res_tech        INT DEFAULT 50,
    res_gold        INT DEFAULT 50,
    res_influence   INT DEFAULT 50,
    -- Terrain
    defense_bonus   FLOAT DEFAULT 0.0,
    arena_theme     VARCHAR(16) DEFAULT 'urban',
    chokepoint      BOOLEAN DEFAULT FALSE,
    trade_routes    INT DEFAULT 0,
    -- Economy
    gdp             BIGINT DEFAULT 0,
    tax_rate        FLOAT DEFAULT 0.10,           -- 0.0-0.50
    trade_openness  FLOAT DEFAULT 0.50,           -- 0.0-1.0
    military_spend  FLOAT DEFAULT 0.10,           -- 0.0-0.50
    tech_invest     FLOAT DEFAULT 0.10,           -- 0.0-0.30
    -- Arena config (derived from tier)
    arena_size      INT NOT NULL,                 -- 1500-6000
    max_agents      INT NOT NULL,                 -- 8-50
    tier_multiplier FLOAT NOT NULL                -- 0.5-3.0
);

CREATE TABLE seasons (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(128) NOT NULL,        -- "Era of Dawn"
    era             VARCHAR(32) DEFAULT 'discovery',  -- discovery/expansion/empires/reckoning
    week            INT DEFAULT 1,
    status          VARCHAR(16) DEFAULT 'active', -- active, completed
    start_at        TIMESTAMPTZ NOT NULL,
    end_at          TIMESTAMPTZ NOT NULL,
    final_rankings  JSONB,                        -- Snapshot at season end
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- BATTLE RECORDS
-- ============================================================

CREATE TABLE battles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country_iso     VARCHAR(3) REFERENCES countries(iso3),
    season_id       INT REFERENCES seasons(id),
    battle_type     VARCHAR(16) NOT NULL,         -- arena, skirmish, siege, world_war, capital_siege
    started_at      TIMESTAMPTZ NOT NULL,
    ended_at        TIMESTAMPTZ,
    duration_secs   INT,
    -- Results
    winner_faction_id UUID REFERENCES factions(id),
    sovereignty_changed BOOLEAN DEFAULT FALSE,
    results_json    JSONB,                        -- {factions: [{id, score, kills, agents}]}
    -- War context (if siege)
    war_id          UUID REFERENCES wars(id)
);
CREATE INDEX idx_battles_country ON battles(country_iso, started_at DESC);
CREATE INDEX idx_battles_season ON battles(season_id);

-- ============================================================
-- DIPLOMACY & WAR
-- ============================================================

CREATE TABLE treaties (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type            VARCHAR(32) NOT NULL,         -- non_aggression, trade, alliance, sanction, tribute
    faction_a_id    UUID REFERENCES factions(id),
    faction_b_id    UUID REFERENCES factions(id),
    status          VARCHAR(16) DEFAULT 'proposed', -- proposed, active, expired, broken
    cost_influence  INT NOT NULL,
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_treaties_factions ON treaties(faction_a_id, faction_b_id) WHERE status = 'active';

CREATE TABLE wars (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attacker_id     UUID REFERENCES factions(id),
    defender_id     UUID REFERENCES factions(id),
    status          VARCHAR(16) DEFAULT 'preparing', -- preparing, active, ceasefire, ended
    prep_ends_at    TIMESTAMPTZ NOT NULL,         -- 48h after declaration
    started_at      TIMESTAMPTZ DEFAULT NOW(),
    ended_at        TIMESTAMPTZ,
    end_reason      VARCHAR(16),                  -- surrender, capital_fall, ceasefire, timeout
    siege_count     INT DEFAULT 0,
    last_siege_at   TIMESTAMPTZ
);
CREATE INDEX idx_wars_active ON wars(attacker_id, defender_id) WHERE status IN ('preparing','active');

-- ============================================================
-- ECONOMY
-- ============================================================

CREATE TABLE trade_orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    faction_id      UUID REFERENCES factions(id),
    sell_resource   VARCHAR(16) NOT NULL,
    buy_resource    VARCHAR(16) NOT NULL,
    sell_amount     BIGINT NOT NULL,
    buy_amount      BIGINT NOT NULL,
    status          VARCHAR(16) DEFAULT 'open',   -- open, filled, cancelled
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    filled_at       TIMESTAMPTZ
);
CREATE INDEX idx_orders_open ON trade_orders(sell_resource, buy_resource) WHERE status = 'open';

CREATE TABLE economy_history (
    id              BIGSERIAL PRIMARY KEY,
    country_iso     VARCHAR(3) REFERENCES countries(iso3),
    season_id       INT REFERENCES seasons(id),
    recorded_at     TIMESTAMPTZ DEFAULT NOW(),
    gdp             BIGINT,
    resources_json  JSONB                         -- Snapshot of all resource levels
);
CREATE INDEX idx_econ_history ON economy_history(country_iso, recorded_at DESC);

-- ============================================================
-- ACHIEVEMENTS & HALL OF FAME
-- ============================================================

CREATE TABLE achievements (
    id              BIGSERIAL PRIMARY KEY,
    user_id         UUID REFERENCES users(id),
    achievement_key VARCHAR(64) NOT NULL,
    unlocked_at     TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, achievement_key)
);

CREATE TABLE hall_of_fame (
    id              SERIAL PRIMARY KEY,
    season_id       INT REFERENCES seasons(id),
    category        VARCHAR(64) NOT NULL,         -- world_dominator, economic_superpower, etc.
    winner_faction_id UUID REFERENCES factions(id),
    winner_user_id  UUID REFERENCES users(id),    -- Best Agent category
    record_value    BIGINT,
    record_detail   JSONB
);
```

### 7.2 Redis Key Design

| Pattern | Type | TTL | Content |
|---------|------|-----|---------|
| `game:{iso}` | Hash | 0 (permanent while arena active) | Real-time arena state (agent positions, HP) |
| `sovereignty:{iso}` | Hash | 0 | Current sovereign faction, level |
| `battle:{iso}` | String | 10min | Battle in-progress flag + metadata |
| `session:{user_id}` | Hash | 24h | User session data, current country |
| `rate:{api_key}` | Counter | 60s | API rate limit counter |
| `market:{resource_pair}` | SortedSet | 0 | Open trade orders by price |
| `leaderboard:factions` | SortedSet | 0 | Faction prestige ranking |
| `leaderboard:gdp` | SortedSet | 0 | Country GDP ranking |
| `news:feed` | List (capped) | 24h | Recent 1000 news items |
| `tension:{factionA}:{factionB}` | Float | 0 | Bilateral tension score (0-100) |
| `event:{id}` | Hash | Duration | Active global event details |

### 7.3 Tension Metric Formula (fixes H-06)

```
Tension(A, B) = clamp(0, 100,
    base_tension
  + border_clash_count_24h × 5
  + sanction_count × 10
  + spy_detected_count × 8
  + territory_loss_to_B × 15
  - trade_volume_AB × 0.1
  - treaty_active × 20
)

When tension > 50: Border Skirmish eligible
When tension > 80: War declaration cost -50%
```

## 8. Frontend Architecture

### 8.1 Page/Route Structure

```
apps/web/
├── app/
│   ├── page.tsx                    # Main entry: Globe → Map → Battle routing
│   ├── layout.tsx                  # Root layout + providers
│   ├── dashboard/
│   │   ├── page.tsx                # Agent API dashboard
│   │   ├── agents/page.tsx         # Agent management
│   │   └── keys/page.tsx           # API key management
│   ├── faction/
│   │   ├── page.tsx                # Faction dashboard
│   │   ├── diplomacy/page.tsx      # Diplomacy panel
│   │   └── economy/page.tsx        # Economy/trade panel
│   └── hall-of-fame/page.tsx       # Season archives
│
├── components/
│   ├── world/                      # 세계지도 레이어
│   │   ├── WorldView.tsx           # Globe ↔ Map 전환 컨트롤러
│   │   ├── WorldMap.tsx            # MapLibre GL 2D 맵 (zoom-in)
│   │   ├── CountryPanel.tsx        # 국가 상세 슬라이드 패널
│   │   └── SovereigntyLayer.tsx    # 팩션 색상 오버레이
│   │
│   ├── lobby/                      # 로비 3D
│   │   ├── GlobeView.tsx           # three-globe 3D 지구본 (메인)
│   │   ├── GlobeCamera.tsx         # 공전 카메라 + 줌 트리거
│   │   ├── FlagMarkers.tsx         # 3D 깃발 마커 (국가별)
│   │   ├── BattleEffects.tsx       # 전투 파티클 이펙트
│   │   └── NewsFeed.tsx            # 하단 뉴스 티커
│   │
│   ├── game/                       # 전투 뷰 (v10 확장)
│   │   ├── GameCanvas.tsx          # R3F 전투 렌더링 (PRESERVED)
│   │   ├── BattleHUD.tsx           # 전투 중 HUD (팩션 점수 추가)
│   │   ├── CommanderHUD.tsx        # Commander Mode 전용 UI (NEW)
│   │   ├── DeathOverlay.tsx        # 사망 화면 (PRESERVED)
│   │   ├── CountdownOverlay.tsx    # 카운트다운 (PRESERVED)
│   │   └── BattleResultOverlay.tsx # 전투 결과 + 지배권 표시 (NEW)
│   │
│   ├── spectator/                  # 관전 모드
│   │   ├── SpectatorView.tsx       # 관전 카메라 + UI
│   │   ├── AgentInfoPopup.tsx      # 에이전트 정보 팝업
│   │   └── BattleFeed.tsx          # 핫 배틀 목록
│   │
│   ├── faction/                    # 팩션 관리
│   │   ├── FactionDashboard.tsx    # 멤버/영토/재정
│   │   ├── DiplomacyPanel.tsx      # 외교 행동
│   │   ├── TechTree.tsx            # 연구 트리 시각화
│   │   └── WarRoom.tsx             # 전쟁 관리
│   │
│   ├── economy/                    # 경제 시스템
│   │   ├── PolicyPanel.tsx         # 경제 정책 설정
│   │   ├── TradeMarket.tsx         # 자원 거래소
│   │   └── GDPChart.tsx            # GDP 히스토리 차트
│   │
│   ├── market/                     # 용병/아이템
│   │   └── MercenaryMarket.tsx     # 용병 고용
│   │
│   ├── hall-of-fame/               # 명예의 전당
│   │   ├── HallOfFame.tsx          # 시즌 아카이브
│   │   └── TimelineReplay.tsx      # 시즌 타임랩스
│   │
│   ├── blockchain/                 # 블록체인 UI (Phase 10)
│   │   ├── WalletConnect.tsx       # CROSSx 지갑 연결
│   │   ├── TokenDashboard.tsx      # 국가 토큰 현황
│   │   ├── StakingPanel.tsx        # 스테이킹 UI
│   │   └── GovernanceVote.tsx      # 거버넌스 투표
│   │
│   └── 3d/                         # 공유 3D 컴포넌트
│       ├── VoxelAgent.tsx          # MC 스타일 에이전트 (PRESERVED)
│       ├── VoxelTerrain.tsx        # 복셀 지형 (테마별 변형 추가)
│       └── ArenaThemes.tsx         # 6종 지형 테마 프리셋 (NEW)
│
├── hooks/
│   ├── useSocket.ts                # 리팩토링: Game WS + Meta WS 분리
│   ├── useWorldState.ts            # 세계 상태 (sovereignty, battles)
│   ├── useFaction.ts               # 팩션 데이터
│   └── useAgentAPI.ts              # Agent API 클라이언트
│
├── lib/
│   ├── map-style.ts                # MapLibre 다크 테마 스타일
│   ├── globe-data.ts               # three-globe 데이터 변환
│   ├── sovereignty-colors.ts       # 팩션 → 국가 색상 매핑
│   ├── camera.ts                   # 카메라 유틸 (PRESERVED)
│   ├── interpolation.ts            # 보간 (PRESERVED)
│   └── renderer/                   # v10 렌더러 (PRESERVED)
│
└── store/
    ├── world-store.ts              # Zustand: 세계 상태
    ├── faction-store.ts            # Zustand: 팩션 상태
    └── game-store.ts               # Zustand: 전투 상태 (PRESERVED)
```

### 8.2 State Management Strategy

| State Domain | Storage | Update Pattern | Scope |
|-------------|---------|----------------|-------|
| **World sovereignty** | Zustand `world-store` | WS push (1Hz) | Global |
| **Battle state** | Zustand `game-store` | WS push (20Hz) | Per-country arena |
| **Faction/diplomacy** | React Query + cache | REST poll (30s) + WS events | User-scoped |
| **Economy/resources** | React Query | REST poll (60s) + WS economy ticks | User-scoped |
| **User auth** | Context + cookie | JWT refresh cycle | Global |
| **Map camera** | Local component state | User interaction | Local |
| **Globe/Map mode** | URL params + Zustand | Zoom threshold trigger | Global |

### 8.3 Rendering Strategy

| View | Technology | Rendering | Performance Target |
|------|-----------|-----------|-------------------|
| **Globe (lobby)** | three-globe + R3F | Client-side 3D | 60 FPS, <2s initial load |
| **World Map (zoom)** | MapLibre GL JS | WebGL 2D tiles | 60 FPS, <1s transition |
| **Battle View** | R3F Canvas | Client-side 3D (v10) | 60 FPS, 20Hz state update |
| **Dashboard** | React SSR | Server-rendered + hydrated | LCP <2.5s |
| **Faction/Economy** | React CSR | Client-rendered (auth) | FCP <1.5s |

### 8.4 Globe ↔ Map ↔ Battle Transition

```
[3D Globe]  ──zoom in──▶  [2D MapLibre]  ──click country──▶  [CountryPanel]
                                                                    │
                                                        [Enter Arena]  [Spectate]
                                                              │              │
                                                     [R3F BattleView]  [SpectatorView]
                                                              │
                                                     [Battle Result]
                                                              │
                                                     [Back to Map]
```

Transition details:
- Globe → Map: At zoom level > 4, fade out globe (300ms), mount MapLibre
- Map → Globe: Zoom level < 3, reverse transition
- Map → Battle: 500ms fly-to animation (center on country), then mount R3F canvas
- Battle → Map: On battle end or exit, unmount R3F, restore map view

### 8.5 Code Splitting Strategy

| Chunk | Components | Load Trigger |
|-------|-----------|-------------|
| `main` | Layout, GlobeView, WorldView | Initial page load |
| `maplibre` | WorldMap, SovereigntyLayer | First zoom-in |
| `battle` | GameCanvas, BattleHUD, CommanderHUD | Enter arena |
| `dashboard` | API dashboard, agent management | Navigate to /dashboard |
| `faction` | FactionDashboard, DiplomacyPanel | Navigate to /faction |
| `economy` | TradeMarket, PolicyPanel, GDPChart | Navigate to economy tab |
| `blockchain` | WalletConnect, TokenDashboard, Staking | Navigate to blockchain tab |
| `hall-of-fame` | HallOfFame, TimelineReplay | Navigate to /hall-of-fame |

## 9. Security Architecture

### 9.1 Authentication Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Browser  │────►│ Next.js   │────►│ Go API   │────►│PostgreSQL│
│           │     │ (SSR)     │     │ Gateway  │     │          │
│ JWT cookie│     │ httpOnly  │     │ verify   │     │ bcrypt   │
│ secure    │     │ cookie    │     │ JWT/API  │     │ hash     │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
```

**JWT Design**:
```yaml
Access_Token:
  Algorithm: HS256
  Secret: 256-bit random (env: JWT_SECRET)
  Expiry: 24 hours
  Claims: { sub: user_id, username, faction_id, iat, exp }
  Storage: httpOnly, secure, sameSite=strict cookie

Refresh_Token:
  Algorithm: HS256
  Expiry: 30 days
  Storage: httpOnly, secure cookie (separate path: /api/auth/refresh)
  Rotation: Single-use (invalidate on use, issue new pair)
```

**API Key Design**:
```yaml
Format: "aww_live_" + 32-byte random hex (total 40 chars)
Storage: SHA-256 hash in DB (never store plaintext)
Delivery: Show once on creation, user must save
Rate_Limit: 30 req/min per key (Redis counter, TTL=60s)
Revocation: Soft delete (revoked_at timestamp)
Max_Per_User: 5 active keys
```

### 9.2 OWASP Top 10 Threat Model

| # | Threat | Mitigation |
|---|--------|------------|
| A01 | Broken Access Control | JWT + API Key middleware on all protected routes; faction role checks for leader-only actions |
| A02 | Cryptographic Failures | bcrypt(12) for passwords; AES-256 for sensitive data at rest; TLS 1.3 in transit |
| A03 | Injection | Prepared statements for all SQL (pgx parameterized queries); input validation on all endpoints |
| A04 | Insecure Design | Rate limiting (30/min API, 5/min auth); deploy limit (3 countries); cooldowns on diplomacy actions |
| A05 | Security Misconfiguration | CORS whitelist (Vercel domain only); helmet-equivalent headers; no debug endpoints in prod |
| A06 | Vulnerable Components | Dependabot alerts; Go module audit; npm audit for frontend |
| A07 | Auth Failures | JWT expiry 24h; refresh rotation; API key hash-only storage; account lockout after 10 failed logins |
| A08 | Data Integrity | Battle results signed with server HMAC; sovereignty transitions require Redis + PostgreSQL consistency check |
| A09 | Logging Failures | Structured logging (slog JSON); auth events logged; rate limit violations logged; no PII in logs |
| A10 | SSRF | No user-provided URLs fetched server-side; LLM bridge only calls whitelisted API endpoints |

### 9.3 RBAC Role-Permission Matrix

| Action | Anonymous | User | Member | Commander | Council | Leader |
|--------|-----------|------|--------|-----------|---------|--------|
| View world map | Yes | Yes | Yes | Yes | Yes | Yes |
| Deploy agent | - | Yes | Yes | Yes | Yes | Yes |
| Commander mode | - | Yes | Yes | Yes | Yes | Yes |
| Join faction | - | Yes | - | - | - | - |
| Leave faction | - | - | Yes | Yes | Yes | - |
| Kick member | - | - | - | - | Yes | Yes |
| Promote/demote | - | - | - | - | - | Yes |
| Set economy policy | - | - | - | - | Yes | Yes |
| Propose treaty | - | - | - | - | Yes | Yes |
| Declare war | - | - | - | - | - | Yes |
| Initiate siege | - | - | - | Yes | Yes | Yes |
| Dissolve faction | - | - | - | - | - | Yes |
| Create API key | - | Yes | Yes | Yes | Yes | Yes |

### 9.4 WebSocket Security

```yaml
Authentication:
  Game_WS: JWT token in first message (handshake within 5s or disconnect)
  Meta_WS: JWT token in first message
  Agent_WS: API key as query parameter (/ws/agents/{id}/live?key=...)

Rate_Limiting:
  Input_messages: Max 33/sec per client (slightly above 30Hz)
  Meta_actions: Max 10/sec per client
  Invalid_message_tolerance: 5 invalid messages → disconnect

Anti-Abuse:
  Movement_validation: Server-authoritative (client input = angle/boost only)
  Upgrade_validation: Server generates choices, client picks index 0-2
  Deploy_validation: Server checks country eligibility, cost, limits
```

### 9.5 Blockchain Security

```yaml
Smart_Contract_Safety:
  Audit: External audit before mainnet deployment (Phase 10)
  Multisig: Game server wallet = 2-of-3 multisig for admin operations
  Timelock: Governance proposals execute after 12h timelock
  Reentrancy: OpenZeppelin ReentrancyGuard on all state-changing functions
  Overflow: Solidity 0.8+ built-in overflow protection

Oracle_Manipulation_Prevention (fixes C-05):
  TWAP_Period: 1 hour (not 5 min — prevents flash loan attacks)
  Min_Liquidity: $10K TVL required for defense buff activation
  Change_Rate_Cap: Defense buff changes max +/- 5% per hour
  Siege_Lock: Token transfers frozen during siege (48h) — prevents dump-before-siege
  Circuit_Breaker: If price moves >50% in 1 hour → buff frozen for 24h
```

## 10. Blockchain Architecture

### 10.1 Smart Contract Topology

```
CROSS Mainnet (EVM-compatible, ChainID from CrossToken.io)
│
├── NationalTokenFactory.sol (1 instance)
│   │  - deployToken(iso3, name, symbol, initialSupply)
│   │  - tokens mapping: iso3 → ERC-20 address
│   │  - Admin: multisig wallet
│   │  - Deployment: CROSS Ramp Console batch deploy
│   │
│   ├── $AWW (ERC-20) — Master governance token
│   │   Supply: 1B, Fixed
│   │
│   ├── $USA (ERC-20) — S-tier, 100M supply
│   ├── $KOR (ERC-20) — A-tier, 50M supply
│   ├── $EGY (ERC-20) — B-tier, 20M supply
│   ├── $BGD (ERC-20) — C-tier, 10M supply
│   └── $MCO (ERC-20) — D-tier, 5M supply
│       ... (195 total)
│
├── NationalTreasury.sol (195 instances, 1 per country)
│   │  - receiveGDPTax(amount) — receives Gold→token conversion
│   │  - executeBuyback() — buys own token on DEX
│   │  - burnOnDefense(amount) — burns tokens on siege defense success
│   │  - distributeStaking(amount) — staking rewards
│   │  - Admin: game server multisig
│   │
│   └── Safety:
│       - OpenZeppelin Ownable + ReentrancyGuard
│       - Minimum buyback floor (prevents death spiral — fixes H-04)
│       - Emergency pause (circuit breaker)
│
├── DefenseOracle.sol (1 instance)
│   │  - updatePrice(iso3, twapPrice, marketCap) — called by game server
│   │  - getDefenseBuff(iso3) → uint256 (0-3000 basis points, max +30%)
│   │  - TWAP period: 1 hour
│   │  - Min liquidity check: $10K TVL
│   │  - Rate limit: buff change max ±5%/hour
│   │  - Source: CROSS RPC (JSON-RPC:8545) → DEX pool reads
│   │
│   └── Safety (fixes C-05):
│       - Circuit breaker: >50% price move → 24h freeze
│       - Siege lock: no buff changes during active siege
│
└── GovernanceModule.sol (1 instance)
    │  - createProposal(iso3, policyType, value)
    │  - vote(proposalId, support) — weight = sqrt(tokenBalance)
    │  - execute(proposalId) — after 12h timelock
    │  - Quorum: 10% of circulating supply
    │
    └── Resolution (fixes C-02 governance conflict):
        - Faction leader: military/diplomatic decisions (off-chain)
        - Token holders: economic policy decisions (on-chain governance)
        - Separation prevents overlap
```

### 10.2 Game ↔ Blockchain Integration Flow

```
Game Server                    Redis              Blockchain Worker         CROSS Mainnet
    │                            │                      │                      │
    │ Battle ends                │                      │                      │
    │ GDP tax = 5% of Gold      │                      │                      │
    │──────────────────────────►│                      │                      │
    │    PUB blockchain:buyback  │                      │                      │
    │                            │──────────────────────►                      │
    │                            │  SUB blockchain:*    │                      │
    │                            │                      │ executeBuyback()     │
    │                            │                      │─────────────────────►│
    │                            │                      │                      │ DEX swap
    │                            │                      │                      │
    │                            │                      │ Read TWAP prices     │
    │                            │                      │─────────────────────►│
    │                            │                      │◄─────────────────────│
    │                            │                      │ {KOR: $0.05, ...}    │
    │                            │                      │                      │
    │                            │◄─────────────────────│                      │
    │                            │ SET defense_buff:KOR │                      │
    │                            │                      │                      │
    │◄───────────────────────────│                      │                      │
    │ GET defense_buff:KOR       │                      │                      │
    │ Apply in next battle       │                      │                      │
```

### 10.3 Token Distribution (Phase Strategy — fixes H-05)

```yaml
Phase_10a (Beta — S-tier only, 8 tokens):
  Deploy: $AWW + $USA, $CHN, $RUS, $IND, $BRA, $JPN, $DEU, $GBR
  Reason: Validate tokenomics with highest-activity countries first
  Liquidity: Concentrate in 8 pools (sufficient depth)

Phase_10b (Expansion — A+B tier, +60 tokens):
  Deploy: A-tier 20 + B-tier 40 = 60 additional tokens
  Trigger: Phase 10a running stable for 2+ weeks
  Liquidity: Shared pool design (route through $AWW)

Phase_10c (Full — C+D tier, +127 tokens):
  Deploy: All remaining 127 tokens
  Trigger: Season 2+ with healthy token economy
  Liquidity: Minimal pools, most trading via $AWW pair
```

### 10.4 CROSSx SDK Integration (Client)

```typescript
// apps/web/lib/crossx.ts
import { CROSSxSDK } from '@crossx/sdk';

const crossx = new CROSSxSDK({
  chainId: CROSS_MAINNET_CHAIN_ID,
  rpcUrl: 'https://rpc.crosstoken.io',
  dexUrl: 'https://dex.crosstoken.io',
});

// Wallet connection via CROSSx Deep Linking
export async function connectWallet() {
  return crossx.connect(); // Opens crossx:// deep link
}

// Buy national token
export async function buyNationalToken(iso3: string, amount: bigint) {
  const tokenAddress = await getTokenAddress(iso3);
  return crossx.swap({
    tokenIn: AWW_TOKEN_ADDRESS,
    tokenOut: tokenAddress,
    amountIn: amount,
  });
}

// Stake tokens for resource boost
export async function stakeTokens(iso3: string, amount: bigint) {
  const treasuryAddress = await getTreasuryAddress(iso3);
  return crossx.stake({ treasury: treasuryAddress, amount });
}

// Cast governance vote
export async function castVote(proposalId: bigint, support: boolean) {
  return crossx.governance.vote({ proposalId, support });
}
```

## 11. Infrastructure & Deployment

### 11.1 Phase 1 (MVP) — Single Binary

```yaml
Frontend (Vercel):
  Framework: Next.js 15
  Build: "cd apps/web && npx next build"
  Env:
    NEXT_PUBLIC_SERVER_URL: Railway backend URL
    NEXT_PUBLIC_WS_URL: Railway WebSocket URL
    NEXT_PUBLIC_CROSS_RPC: CROSS Mainnet RPC (Phase 10)

Backend (Railway):
  Runtime: Single Go binary
  Start: "cd server && go build -o server ./cmd/server && ./server"
  Services:
    - API Gateway (port 8080)
    - Game Server (goroutines)
    - Meta Server (goroutines)
    - Background Workers (goroutines)
  Env:
    DATABASE_URL: postgres://...
    REDIS_URL: redis://...
    JWT_SECRET: 256-bit random
    CORS_ORIGIN: Vercel domain(s)
    CROSS_RPC_URL: https://rpc.crosstoken.io (Phase 10)
    ENABLE_BLOCKCHAIN: false (feature flag)

PostgreSQL (Railway Managed):
  Version: 16
  Storage: 10GB initial
  Backups: Daily automated
  Connection_Pool: 20 max connections

Redis (Railway Managed):
  Version: 7
  Memory: 256MB initial
  Persistence: RDB snapshots every 5 min
  Max_Memory_Policy: allkeys-lru
```

### 11.2 Phase 2 (Growth) — Service Separation

```yaml
Split_Strategy:
  Game_Service:
    - Handles: WebSocket game connections, arena management
    - CPU-bound: 20Hz tick loop
    - Scale: Vertical (larger instance)
    - Railway: Separate service

  Meta_Service:
    - Handles: REST API, meta WS, background workers
    - IO-bound: DB queries, Redis pub/sub
    - Scale: Horizontal (replicas behind load balancer)
    - Railway: Separate service with scaling

  Communication:
    - Redis pub/sub (unchanged from Phase 1)
    - No direct HTTP between services
```

### 11.3 Phase 3 (Scale) — Sharded Game Servers

```yaml
Sharding_Strategy:
  Shard_By: Continent
    - asia-game: East Asia + SE Asia + South Asia countries
    - europe-game: Europe + Central Asia countries
    - americas-game: North + South America countries
    - africa-mena-game: Africa + Middle East countries

  Routing:
    - Client connects to correct shard based on target country
    - Meta Server routes deploy requests to correct game shard
    - Cross-shard battles (Border Skirmish): coordinated via Redis

  Data_Layer:
    - PostgreSQL: Read replicas per region
    - Redis: Cluster mode (3 nodes)
```

### 11.4 CI/CD Pipeline

```yaml
Pipeline_Stages:
  1_Lint:
    - Go: golangci-lint
    - TS: eslint + tsc --noEmit
    - Duration: ~30s

  2_Test:
    - Go: go test ./... -race -coverprofile
    - TS: vitest (unit) + playwright (e2e, staging only)
    - Coverage target: >60%
    - Duration: ~2min

  3_Build:
    - Go: go build -o server ./cmd/server (CGO_ENABLED=0)
    - Next.js: next build
    - Docker: Multi-stage Dockerfile
    - Duration: ~3min

  4_Deploy_Staging:
    - Railway preview environment (auto on PR)
    - Vercel preview deployment (auto on PR)
    - Smoke test: health check + basic WS connection

  5_Deploy_Production:
    - Railway: Auto-deploy on main merge
    - Vercel: Auto-deploy on main merge
    - Health check: /health endpoint returns 200 within 30s
    - Rollback: Railway instant rollback on health check failure

Triggers:
  PR_Created: stages 1-4
  Main_Merge: stages 1-5
```

### 11.5 Docker Configuration

```dockerfile
# server/Dockerfile (multi-stage)
FROM golang:1.24-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o server ./cmd/server

FROM alpine:3.19
RUN apk add --no-cache ca-certificates tzdata
COPY --from=builder /app/server /server
COPY --from=builder /app/data /data
EXPOSE 8080
CMD ["/server"]
```

```yaml
# docker-compose.yml (local development)
services:
  server:
    build: ./server
    ports: ["8080:8080"]
    environment:
      DATABASE_URL: postgres://dev:dev@postgres:5432/aww
      REDIS_URL: redis://redis:6379
      JWT_SECRET: dev-secret-256bit
      CORS_ORIGIN: http://localhost:3000
    depends_on: [postgres, redis]

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: aww
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru

volumes:
  pgdata:
```

## 12. Scalability & Performance

### 12.1 Performance Budget

| Metric | Target | Critical Threshold |
|--------|--------|-------------------|
| **Game tick latency** | <1ms P50, <2ms P99 | >5ms = degraded |
| **API response time** | <50ms P50, <200ms P95 | >500ms = degraded |
| **WS state broadcast** | 20Hz (50ms interval) | <15Hz = noticeable lag |
| **World state broadcast** | 1Hz | <0.5Hz = stale data |
| **Arena creation time** | <10ms | >100ms = user-visible delay |
| **DB query time** | <10ms P50, <50ms P95 | >200ms = optimize |
| **Map initial load** | <2s (GeoJSON + render) | >4s = user bounce risk |
| **Globe FPS** | 60 FPS | <30 FPS = degraded |
| **Memory per arena** | ~5MB | >10MB = pool size limit exceeded |
| **Total server memory** | <2GB (50 active arenas) | >4GB = scaling trigger |

### 12.2 Arena Pool Strategy

```yaml
Pool_Configuration:
  Max_Concurrent_Arenas: 50 (Phase 1)
  Pre_Allocated: 10 (warm pool)
  Allocation_Strategy: Tier-based sizing
    S_Tier: 6000x6000, ~8MB memory
    A_Tier: 4500x4500, ~6MB memory
    B_Tier: 3500x3500, ~4MB memory
    C_Tier: 2500x2500, ~3MB memory
    D_Tier: 1500x1500, ~2MB memory

  Lifecycle:
    Create: When battle cycle starts AND agents deployed > min_threshold (3)
    Active: During 5-min battle + 15s cooldown
    Release: After cooldown, return to pool (reset state)
    Evict: If idle for 10 min, deallocate from pool

  On_Demand_Trigger:
    - Country has ≥3 deployed agents
    - OR Siege/World War event triggered
    - OR manual spectator request (read-only mode)

  Empty_Country_Handling (fixes M-03):
    - Countries with 0 deployed agents: no arena created
    - NPC defender bots (3-5, scaled by tier) auto-spawn if country is sovereign
    - NPC bots use basic AI (no arena pool cost when idle)
```

### 12.3 Shrink Scaling by Tier (fixes H-01)

```yaml
Arena_Shrink_Per_Minute:
  S_Tier (6000px): -600px/min  (original v10 rate)
  A_Tier (4500px): -450px/min
  B_Tier (3500px): -350px/min
  C_Tier (2500px): -250px/min
  D_Tier (1500px): -150px/min

Formula: shrink_rate = arena_size × 0.10 per minute
Result: All tiers reach ~0 at approximately the same relative time (5 min)
```

### 12.4 Database Optimization

```yaml
Indexes:
  - countries(sovereign_faction_id) — faction territory lookups
  - battles(country_iso, started_at DESC) — recent battle history
  - treaties(faction_a_id, faction_b_id) WHERE active — diplomacy lookups
  - wars(attacker_id, defender_id) WHERE active — war status
  - trade_orders(sell_resource, buy_resource) WHERE open — order matching
  - economy_history(country_iso, recorded_at DESC) — GDP charts

Partitioning:
  battles: Range partition by season_id (auto-create per season)
  economy_history: Range partition by recorded_at (monthly)

Connection_Pool:
  pgxpool: max 20 connections, min 5, idle timeout 5min
  Prepared_Statements: Pre-compile top 20 queries

Caching_Strategy:
  Country_Data: Redis cache with 5min TTL (static data rarely changes)
  Faction_Stats: Redis cache with 1min TTL (aggregated from battles)
  Leaderboard: Redis sorted set, updated on sovereignty change
  Market_Prices: Redis, updated on trade execution
```

### 12.5 Client-Side Performance

```yaml
GeoJSON_Optimization:
  Level_0 (Globe): No GeoJSON (three-globe internal geometry)
  Level_1 (Continent): 110m simplified (195 polygons, ~300KB)
  Level_2 (Country): 50m detailed (selected country only, lazy load)

Texture_Management:
  Arena_Themes: 6 theme texture atlases, 512x512 each, lazy-loaded
  Agent_Skins: 24 skin textures (preserved from v10), preloaded
  Flag_Sprites: 195 flag sprites, 32x32 atlas (single texture)

WebSocket_Optimization:
  Binary_Protocol: MessagePack for game state (not JSON)
  Delta_Compression: Send only changed agents per tick
  Viewport_Culling: Server sends only agents within client viewport
  Batch_Sovereignty: World state update batched 1Hz (not per-change)
```

## 13. Observability

### 13.1 Structured Logging

```yaml
Logger: Go slog (structured JSON)
Levels: DEBUG, INFO, WARN, ERROR
Correlation: request_id header propagated through all layers

Log_Schema:
  {
    "time": "2026-03-06T12:00:00Z",
    "level": "INFO",
    "msg": "battle_ended",
    "request_id": "abc123",
    "country_iso": "KOR",
    "winner_faction": "Dragons",
    "agents_count": 25,
    "duration_ms": 300000,
    "sovereignty_changed": true
  }

Sensitive_Data_Policy:
  ❌ Never log: passwords, JWT tokens, API keys, email addresses
  ✅ Always log: user_id (UUID), faction_id, country_iso, event types
```

### 13.2 Metrics (Prometheus-compatible)

| Metric | Type | Labels | Alert Threshold |
|--------|------|--------|----------------|
| `aww_active_arenas` | Gauge | - | >45 (90% pool capacity) |
| `aww_connected_clients` | Gauge | `type={game,meta,agent}` | >5000 (scale trigger) |
| `aww_battle_tick_duration_ms` | Histogram | `country_iso, tier` | P99 >5ms |
| `aww_api_request_duration_ms` | Histogram | `method, path, status` | P95 >200ms |
| `aww_sovereignty_changes_total` | Counter | `country_iso` | - |
| `aww_wars_active` | Gauge | - | - |
| `aww_trade_volume` | Counter | `resource` | - |
| `aww_redis_latency_ms` | Histogram | `command` | P99 >10ms |
| `aww_pg_query_duration_ms` | Histogram | `query_name` | P95 >50ms |
| `aww_ws_messages_total` | Counter | `direction, event_type` | - |
| `aww_blockchain_oracle_lag_s` | Gauge | - | >600 (10min stale) |
| `aww_arena_pool_utilization` | Gauge | - | >0.9 |

### 13.3 Health Check Endpoint

```
GET /health

Response:
{
  "status": "healthy",
  "version": "v11.0.0",
  "uptime_seconds": 86400,
  "checks": {
    "postgres": { "status": "up", "latency_ms": 2 },
    "redis": { "status": "up", "latency_ms": 1 },
    "arena_pool": { "active": 12, "max": 50, "utilization": 0.24 },
    "connected_clients": { "game": 342, "meta": 156, "agent": 28 },
    "current_season": { "id": 3, "era": "expansion", "week": 2 }
  }
}
```

### 13.4 Alerting Rules

| Alert | Condition | Severity | Action |
|-------|-----------|----------|--------|
| HighTickLatency | tick_duration P99 > 5ms for 5min | Critical | Page on-call, check arena count |
| ArenaPoolExhausted | utilization > 0.9 for 10min | Warning | Scale up max pool or add game shard |
| DatabaseSlow | query P95 > 200ms for 5min | Warning | Check slow query log, add indexes |
| RedisDown | health check fails 3x | Critical | Restart Redis, check memory |
| OracleStale | oracle_lag > 600s | Warning | Check blockchain worker, CROSS RPC status |
| HighErrorRate | 5xx rate > 5% for 5min | Critical | Check logs, rollback if recent deploy |
| MemoryHigh | process RSS > 3GB | Warning | Profile memory, check arena leaks |

## 14. ADR Summary

Architecture Decision Records for v11. Full ADRs in `docs/adr/ADR-025.md` through `ADR-033.md`.

| ADR | Decision | Status | Rationale |
|-----|----------|--------|-----------|
| **ADR-025** | Single binary with internal packages (Phase 1) | Accepted | Avoids network overhead while maintaining clean boundaries; split in Phase 2 |
| **ADR-026** | CountryArena embeds Room (composition, not inheritance) | Accepted | Preserves v10 Room state machine unchanged; adds country context as wrapper |
| **ADR-027** | On-demand arena creation with object pool | Accepted | 195 simultaneous arenas impossible at MVP scale; pool max 50 with tier-based sizing |
| **ADR-028** | Redis pub/sub for Game↔Meta communication | Accepted | Loose coupling between Game Server and Meta Server; supports future service split |
| **ADR-029** | Dual-auth: JWT (browser) + API Key (agents) | Accepted | Different security profiles: JWT for session-based UI, API keys for programmatic access |
| **ADR-030** | 6 resource types (Food, Oil, Steel, Tech, Gold, Influence) | Accepted | Resolves C-01 (5 vs 6 resource inconsistency); Influence replaces Manpower for clearer gameplay |
| **ADR-031** | Dual governance: Faction leader (military) + Token holders (economy) | Accepted | Resolves C-02 (governance conflict); clear separation of decision domains |
| **ADR-032** | `sovereignty_level` (int 0-5) as unified term | Accepted | Resolves C-03 (terminology inconsistency); single name across all systems |
| **ADR-033** | Phased token deployment: S-tier first → gradual expansion | Accepted | Resolves H-05 (liquidity fragmentation); validate economics with 8 tokens before expanding |

## 15. Verification Matrix

Cross-referencing this architecture against the plan (v11-world-war-plan.md) and verification report (v11-verification-report.md).

### 15.1 Plan Section Coverage

| Plan Section | Architecture Coverage | Status |
|-------------|----------------------|--------|
| §1 Vision & Concept | Section 1 Overview | Covered |
| §2 Game Design 3 Layers | Sections 3-4 (Container + Component) | Covered |
| §3 World Map System | Section 8 Frontend (MapLibre + three-globe) | Covered |
| §4 Battle System | Section 4.1 Game Server Components, 5.1 Sequence | Covered |
| §5 Territory & Sovereignty | Section 4.1 (CountryArena, SovereigntyMgr), 7.1 Schema | Covered |
| §6 Economy System | Section 4.2 (EconomyEngine), 6.2 API, 7.1 Schema | Covered |
| §7 Faction & Diplomacy | Section 4.2 (FactionMgr, DiplomacyEng), 6.2 API | Covered |
| §8 Agent API & Commander | Section 4.1 (CommanderBridge), 6.2 API, 5.4 Sequence | Covered |
| §9 Spectator & Observer | Section 4.3 WS Hub, 8.1 Frontend | Covered |
| §10 Seasons | Section 4.2 (SeasonMgr), 4.4 Workers | Covered |
| §11 Additional Mechanics | Section 4.2 (TechTree, Intel, Events, UN, Mercenary) | Covered |
| §12 Technical Direction | Sections 3, 11, 12 (Infra, Scaling) | Covered |
| §13 Architecture Overview | Section 3 (C4 Level 2) deepens plan's Level 1 | Covered |
| §14 Risk Analysis | Section 9 Security, 12 Performance, ADRs | Covered |
| §15 Blockchain | Section 10 (full blockchain architecture) | Covered |

### 15.2 Verification Report Issue Resolution

| Issue ID | Description | Resolution in Architecture |
|----------|-------------|---------------------------|
| **C-01** | Resource type inconsistency (5 vs 6) | ADR-030: Unified to 6 types (Food, Oil, Steel, Tech, Gold, Influence) |
| **C-02** | Governance authority conflict | ADR-031: Dual governance model (faction leader vs token holders) |
| **C-03** | Sovereignty terminology inconsistency | ADR-032: `sovereignty_level` (int 0-5) everywhere |
| **C-04** | Smart contract audit absent | Section 10.1: Audit step added before mainnet; multisig + timelock |
| **C-05** | Oracle manipulation vulnerability | Section 9.5: 1h TWAP, $10K min liquidity, ±5%/hr rate cap, circuit breaker |
| **H-01** | Arena shrink destroys small countries | Section 12.3: Tier-proportional shrink (size × 0.10/min) |
| **H-02** | Commander Mode abuse | Section 5.4: 3 switches/battle limit + 3s cooldown |
| **H-04** | Token death spiral | Section 10.1: Minimum buyback floor in NationalTreasury |
| **H-05** | 195 liquidity pools fragmented | ADR-033: Phased deployment (S-tier first → expand) |
| **H-06** | Tension metric undefined | Section 7.3: Explicit formula with 7 factors |
| **H-07** | Maritime neighbors undefined | Section 7.1: `maritime_neighbors` array in countries table |
| **M-03** | Empty country behavior undefined | Section 12.2: NPC defender bots auto-spawn for sovereign countries |
| **M-05** | 195 unique themes unrealistic | Section 4.1: 6 biome types mapped to countries |
| **H-09** | Roadmap dependency gaps (9 items) | Noted — roadmap file should be updated separately |
| **M-08** | Large Steps need splitting | Noted — roadmap file should be updated separately |

### 15.3 Roadmap Alignment

| Phase | Roadmap Steps | Architecture Section |
|-------|---------------|---------------------|
| Phase 0 | S01-S05 | Section 7 (Schema), 11 (Infra), 4.5 (Refactoring) |
| Phase 1 | S06-S10 | Section 8 (Frontend Globe/Map) |
| Phase 2 | S11-S15 | Section 4.1 (WorldManager, CountryArena) |
| Phase 3 | S16-S19 | Section 4.2 (FactionMgr, DiplomacyEngine) |
| Phase 4 | S20-S23 | Section 4.2 (EconomyEngine), 4.4 Workers |
| Phase 5 | S24-S28 | Section 6.2 (API Spec), 4.3 (AgentStreamHub) |
| Phase 6 | S29-S32 | Section 4.2 (SeasonMgr), 4.4 Workers |
| Phase 7 | S33-S38 | Section 4.2 (TechTree, Intel, Events) |
| Phase 8 | S39-S42 | Section 12 (Performance), 9 (Security) |
| Phase 9 | S43-S45 | Section 11 (Infrastructure), 13 (Observability) |
| Phase 10 | S46-S53 | Section 10 (Blockchain) |

## 16. Open Questions

| # | Question | Impact | Proposed Resolution | Owner |
|---|----------|--------|--------------------|----|
| OQ-1 | **Maximum faction size cap?** Plan says max 50, but no anti-monopoly mechanic for territory | High | Cap at 30% of total countries (58 max). Anti-monopoly: underdog bonuses scale with faction size | Game Design |
| OQ-2 | **Mercenary cost formula?** M-02 from verification report | Medium | Cost = base_gold × tier_multiplier × (1 + demand_factor). Bronze 50G base, Legendary 2000G base. | Game Balance |
| OQ-3 | **Cross-shard Border Skirmish?** If two countries on different game shards need a skirmish | High | Phase 3 concern. Use a dedicated "border arena" shard or route both to the defender's shard. | Backend |
| OQ-4 | **Season data retention?** How many seasons of detailed battle data to keep? | Medium | Keep 3 seasons of full data. Older seasons: aggregate stats only (delete individual battle records). | Infrastructure |
| OQ-5 | **Nuclear option mechanics?** M-07 from verification report mentions §11 nuclear without detail | Low | Defer to v12 or Phase 8 detailed design. Placeholder: "Requires Military Tech Lv.4, affects 30% of capital HP". | Game Design |
| OQ-6 | **KYC/AML for token purchases?** H-08 from verification report | High | Phase 10: Rely on CROSSx app's built-in KYC. Game server does not process fiat. Flag large transactions (>$1K equivalent). | Legal/Compliance |
| OQ-7 | **Replay storage costs?** 24h battle replay for 195 countries × 5min battles = significant data | Medium | Store replay as input log (not state snapshots). ~50KB per battle. 24h of 195 battles = ~2GB. Prune weekly. | Infrastructure |
| OQ-8 | **Admin dashboard?** M-09 notes absence from roadmap | Medium | Add S45.5 step in roadmap. Minimal admin: season management, user ban, force-end war, emergency arena shutdown. | Roadmap |

---

> **Next Steps**: After this architecture is approved, proceed to:
> - `/da:design` for UI/UX detailed design (Globe, Map, Battle, Dashboard screens)
> - `/da:dev` for implementation starting at Phase 0 (S01: PostgreSQL schema)
