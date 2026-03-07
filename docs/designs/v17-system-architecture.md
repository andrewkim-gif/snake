# AI World War v17 — System Architecture Document

> **Version**: 1.0
> **Date**: 2026-03-07
> **Status**: APPROVED
> **Based on**: v17-integrated-plan.md, v17-superpower-agent-system-plan.md, v16-simulation-system-plan.md
> **Scope**: C4 Level 2-3 component design, data models, API specifications, security model, integration strategy
> **Project Type**: GAME (Three.js + Go server)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Goals / Non-Goals](#2-goals--non-goals)
3. [Architecture — C4 Level 2 Container Diagram](#3-architecture--c4-level-2)
4. [Architecture — C4 Level 3 Component Design](#4-architecture--c4-level-3)
5. [Data Model](#5-data-model)
6. [API Design](#6-api-design)
7. [Security Architecture](#7-security-architecture)
8. [Integration Strategy](#8-integration-strategy)
9. [Scalability & Performance](#9-scalability--performance)
10. [Reliability & Observability](#10-reliability--observability)
11. [Architecture Decision Records](#11-architecture-decision-records)
12. [Phase-by-Phase Implementation Map](#12-phase-by-phase-implementation-map)
13. [Open Questions](#13-open-questions)

---

<!-- SECTION_1 -->
## 1. Overview

### 1.1 System Purpose

AI World War v17 is an integrated geopolitical simulation platform where **external AI agents** (via aww-agent-skill SDK v2), **internal NationalAI** (195 autonomous country AIs), and **human players** (via WebUI) coexist as country operators within a single 195-nation world simulation. The system unifies three previously separate subsystems:

- **v15 Agent Arena API** — External AI combat participation (5,460 LOC, Go)
- **v16 Simulation System** — Internal NationalAI autonomous world simulation (v16-simulation-system-plan.md)
- **v17 SuperPower Agent System** — 5-domain SDK extension (economy/diplomacy/military/politics/combat)

### 1.2 Core Innovation: Hybrid Operator Model

Any of the 195 countries can be operated by three operator types across five independent domains:

| Operator Type | Auth Method | Domains | Fallback |
|---------------|-------------|---------|----------|
| **NationalAI** (default) | Internal | All 5 | N/A (is the fallback) |
| **External Agent** | API Key (`aww_` + 64hex) | 1-5 selectable | NationalAI on timeout |
| **Human Player** | Web Session | 1-5 via UI | NationalAI on timeout |

Domains are independently assignable: one country can have combat run by an External Agent, economy by a Human, and the remaining three by NationalAI.

### 1.3 Existing Codebase Inventory (46,070 LOC)

| Package | Files | LOC | Role in v17 |
|---------|-------|-----|-------------|
| `server/internal/game/` | 65 | 25,011 | CombatEngine — Arena, weapons, abilities, bots |
| `server/internal/meta/` | 18 | 10,797 | Economy/Diplomacy/War/Faction backend |
| `server/internal/agent/` | 2 | 588 | LLM bridge (Claude/GPT/Llama) |
| `server/internal/world/` | 8 | 3,667 | 195-country management, sovereignty |
| `server/internal/domain/` | 5 | ~2,500 | Shared types (Agent, Position, Skins) |
| `server/internal/ws/` | 4 | ~1,200 | WebSocket hub, agent stream |
| `server/internal/api/` | 2 | ~600 | REST API routes |
| `server/internal/auth/` | 3 | ~400 | JWT, API key, middleware |
| `aww-agent-skill/` (TS) | 9 | 1,198 | SDK v1 (CombatDomain only) |

### 1.4 Technology Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Game Server** | Go | 1.22+ | Simulation engine, 20Hz game loop, WebSocket |
| **HTTP Router** | chi/v5 | 5.x | REST API routing |
| **WebSocket** | gorilla/websocket | 1.5+ | Real-time agent/spectator streams |
| **Client** | Next.js 15 + Three.js/R3F | 15.x | 3D WebUI, spectator dashboard |
| **SDK** | TypeScript | 5.x | aww-agent-skill v2 package |
| **Cache** | Redis | 7.x | Country state sync, session store |
| **Database** | SQLite/PostgreSQL | — | Persistent state (season data, API keys) |
| **LLM Integration** | Claude/GPT/Llama | Multi | 2s timeout, heuristic fallback |

---

<!-- SECTION_2 -->
## 2. Goals / Non-Goals

### Goals

| # | Goal | Metric |
|---|------|--------|
| G1 | **Hybrid Operator Model** — External agents, NationalAI, and humans share the same Decision API | All 3 types pass identical integration tests |
| G2 | **5-Domain Coverage** — Combat, Economy, Diplomacy, Military, Politics all controllable via SDK | 45 REST + 11 WS message types functional |
| G3 | **NationalAI Fallback** — Zero simulation interruption when external agents disconnect/timeout | 100% uptime in 72h stress test |
| G4 | **Time Acceleration Compatibility** — Simulation runs at x1 to x1000 speed | External agents disabled above x10 automatically |
| G5 | **v1 SDK Backward Compatibility** — Existing v1 agents work unchanged | v1 test suite passes against v17 server |
| G6 | **SuperPower-Faithful Systems** — Economy (12 resources), Diplomacy (DR -100~+100, 10 treaties), Military (5 units + counter matrix), Politics (6 govts) | Headless 100-run balance verification |
| G7 | **Domain Interconnection** — Decisions cascade across domains (e.g., nuke research -> DR -55 -> trade collapse -> GDP drop) | Cascade integration tests |
| G8 | **Simulation CLI** — `cmd/simulate/main.go` binary with 3 modes (pure/hybrid/full-agent) | Binary builds and runs all 3 modes |

### Non-Goals

| # | Non-Goal | Reason |
|---|----------|--------|
| NG1 | Blockchain/token integration | Deferred to post-v17 (CROSS Mainnet timeline) |
| NG2 | Production Kubernetes deployment | Dev/Railway deployment sufficient for current scale |
| NG3 | Mobile-native SDK | Web SDK + REST API sufficient; mobile via WebUI |
| NG4 | Real-time 3D visualization of 195 simultaneous arenas | Phase 10 UI is optional; SimWatch is data-only |
| NG5 | Machine learning model training pipeline | Rule-based NationalAI + LLM bridge sufficient |
| NG6 | Naval unit class implementation | MilitaryTech.Naval field reserved but not implemented |

---

<!-- SECTION_3 -->
## 3. Architecture — C4 Level 2

### 3.1 Container Diagram (ASCII)

```
 ┌─────────────┐   ┌──────────────┐   ┌────────────────┐
 │ External AI  │   │ Human Player │   │  SimWatch      │
 │ Agent (SDK)  │   │  (WebUI)     │   │ (Spectator UI) │
 └──────┬───────┘   └──────┬───────┘   └───────┬────────┘
        │ WS/REST          │ HTTPS/WS          │ WS(read-only)
 ═══════╪══════════════════╪═══════════════════╪════════════════
 │      ▼                  ▼                   ▼               │
 │  ┌─────────────────────────────────────────────────────┐    │
 │  │            [C1] API Gateway (Go HTTP/WS Server)     │    │
 │  │  Port 9000 (game) / 9002 (simulation)               │    │
 │  │  ├── chi/v5 Router (REST v1 + v2)                   │    │
 │  │  ├── gorilla/websocket Hub (WS v1 + v2)             │    │
 │  │  └── Auth Middleware (JWT + API Key)                 │    │
 │  └──────────────────────┬──────────────────────────────┘    │
 │                         │                                    │
 │  ┌──────────────────────▼──────────────────────────────┐    │
 │  │         [C2] DecisionRouter                          │    │
 │  │  ├── OperatorRegistry (195 x 5 operator mapping)    │    │
 │  │  ├── DecisionQueue (tick-based FIFO)                 │    │
 │  │  ├── BriefingHub (WS push to external agents)        │    │
 │  │  └── Timeout Monitor (SimClock-relative deadlines)   │    │
 │  └──────────────────────┬──────────────────────────────┘    │
 │                         │                                    │
 │  ┌──────────────────────▼──────────────────────────────┐    │
 │  │         [C3] SimulationEngine                        │    │
 │  │  ├── SimClock (logical ticks, x1~x1000 speed)       │    │
 │  │  ├── ArenaScheduler (195-country battle cycles)      │    │
 │  │  ├── processStrategicTick() (operator dispatch)      │    │
 │  │  └── SimRecorder (event log, snapshots)              │    │
 │  └──────────────────────┬──────────────────────────────┘    │
 │                         │                                    │
 │  ┌──────────────────────▼──────────────────────────────┐    │
 │  │         [C4] Domain Engines (5)                      │    │
 │  │  ├── CombatEngine    (game/arena.go — 20Hz loop)    │    │
 │  │  ├── EconomyEngine   (meta/economy_v2.go)           │    │
 │  │  ├── DiplomacyEngine (meta/diplomacy_v2.go)         │    │
 │  │  ├── MilitaryEngine  (military/*.go — NEW)          │    │
 │  │  └── PoliticsEngine  (politics/*.go — NEW)          │    │
 │  └──────────────────────┬──────────────────────────────┘    │
 │                         │                                    │
 │  ┌──────────────────────▼──────────────────────────────┐    │
 │  │         [C5] StrategicDecisionEngine                 │    │
 │  │  └── NationalAI[195] (rule-based fallback AI)        │    │
 │  │      ├── NationalPersonality (195 unique profiles)   │    │
 │  │      ├── WorldMemory (5-domain learning)             │    │
 │  │      └── Decide(domain, snapshot) → Decision         │    │
 │  └─────────────────────────────────────────────────────┘    │
 │                                                              │
 │  ┌─────────────────────────────────────────────────────┐    │
 │  │         [C6] Data Stores                             │    │
 │  │  ├── Redis 7.x (session, state sync, pub/sub)       │    │
 │  │  ├── SQLite/PostgreSQL (API keys, season history)    │    │
 │  │  └── In-Memory (195 CountryState, DR matrix)         │    │
 │  └─────────────────────────────────────────────────────┘    │
 ══════════════════════════════════════════════════════════════
```

### 3.2 Container Responsibilities

| Container | Technology | Responsibility | Existing/New |
|-----------|-----------|----------------|-------------|
| **[C1] API Gateway** | Go + chi/v5 + gorilla/ws | HTTP/WS routing, auth, rate limiting | Extend existing `cmd/server/main.go` + NEW `cmd/simulate/main.go` |
| **[C2] DecisionRouter** | Go | Operator dispatch, timeout fallback, decision queuing | **NEW** `sim/decision.go`, `sim/operator.go` |
| **[C3] SimulationEngine** | Go | Tick-based world simulation, time acceleration, arena scheduling | **NEW** `sim/engine.go`, `sim/clock.go` (from v16 plan) |
| **[C4] Domain Engines** | Go | 5 domain game logic (each independently testable) | Extend `meta/` + NEW `military/`, `politics/` |
| **[C5] StrategicDecisionEngine** | Go | 195 NationalAI instances, fallback decisions | **NEW** `strategy/national_ai.go`, `strategy/personality.go` |
| **[C6] Data Stores** | Redis + SQL + Memory | Persistence, caching, pub/sub | Extend existing `cache/`, `db/` |

### 3.3 Communication Protocols

| From → To | Protocol | Frequency | Format |
|-----------|----------|-----------|--------|
| External Agent → API Gateway | WS (`/ws/v2`) | Continuous | JSON frames |
| External Agent → API Gateway | REST (`/api/v2/*`) | On-demand | JSON |
| API Gateway → DecisionRouter | In-process function call | Per decision | Go struct |
| DecisionRouter → BriefingHub | In-process channel | Per strategic tick | `*Briefing` |
| BriefingHub → External Agent | WS push | Per briefing cycle | JSON `briefing` message |
| SimulationEngine → Domain Engines | In-process function call | Per tick | Go interface |
| SimulationEngine → StrategicDecisionEngine | In-process function call | Per strategic tick | `*WorldSnapshot` |
| Domain Engines → Redis | TCP | On state change | JSON serialization |
| API Gateway → SimWatch Spectators | WS push | 1 Hz | JSON `world_update` |

---

<!-- SECTION_4 -->
## 4. Architecture — C4 Level 3

### 4.1 Go Package Layout (New/Extended)

```
server/
├── cmd/
│   ├── server/main.go              # Existing game server (port 9000)
│   └── simulate/main.go            # NEW: Simulation CLI (port 9002/9003)
│
├── internal/
│   ├── game/                        # EXISTING (25K LOC) — CombatEngine
│   │   ├── arena.go                 # 20Hz game loop, Arena struct
│   │   ├── agent.go                 # Agent physics, nationality
│   │   ├── agent_api.go             # Commander Mode (17 commands)
│   │   ├── country_arena.go         # CountryArenaManager (195 arenas)
│   │   ├── room.go, room_manager.go # Room state machine
│   │   ├── collision.go             # Combat collision system
│   │   ├── weapon_system.go         # 10 weapon types
│   │   └── ... (65 files total)
│   │
│   ├── meta/                        # EXISTING (10.8K LOC) — Extended
│   │   ├── economy.go               # v1 economy (6 resources) — RETAINED for compatibility
│   │   ├── economy_v2.go            # NEW: 12 resources, SP2 GDP, 3-tier tax, 8 budgets
│   │   ├── diplomacy.go             # v1 diplomacy (faction-based) — RETAINED
│   │   ├── diplomacy_v2.go          # NEW: DR matrix, 10 treaty types, multilateral
│   │   ├── war.go                   # WarManager — Extended with unit class integration
│   │   ├── faction.go               # FactionManager — Retained
│   │   └── ... (18 files total)
│   │
│   ├── sim/                         # NEW: Simulation Engine
│   │   ├── engine.go                # SimulationEngine (main loop + operator dispatch)
│   │   ├── clock.go                 # SimClock (logical ticks, time acceleration)
│   │   ├── operator.go              # OperatorRegistry (195 x 5 mapping)
│   │   ├── decision.go              # DecisionRouter + DecisionQueue
│   │   ├── briefing.go              # BriefingHub (WS push)
│   │   ├── config.go                # SimConfig (mode, speed, seed)
│   │   ├── state.go                 # SimState (world snapshot builder)
│   │   ├── recorder.go              # SimRecorder (event log)
│   │   └── snapshot.go              # WorldSnapshot serialization
│   │
│   ├── strategy/                    # NEW: NationalAI (fallback AI)
│   │   ├── national_ai.go           # NationalAI struct + Decide()
│   │   ├── personality.go           # 195 NationalPersonality profiles
│   │   ├── engine.go                # StrategicDecisionEngine (manages 195 AIs)
│   │   ├── economy_ai.go            # Economy decision logic
│   │   ├── diplomacy_ai.go          # Diplomacy decision logic
│   │   ├── war_strategy.go          # War strategy logic
│   │   ├── faction_formation.go     # Auto faction formation
│   │   └── deployment.go            # Military deployment AI
│   │
│   ├── military/                    # NEW: Military System
│   │   ├── unit_classes.go          # 5 unit classes + counter matrix
│   │   ├── combat_resolver.go       # Damage calculation with tech/training
│   │   ├── tech_tree.go             # Military tech (5 categories, Lv 0-10)
│   │   ├── deployment.go            # Force deployment/recall
│   │   ├── production.go            # Unit production (resource costs)
│   │   └── nuclear.go               # Nuclear weapons (3 tiers)
│   │
│   ├── politics/                    # NEW: Politics System
│   │   ├── government.go            # 6 government types + modifiers
│   │   ├── policies.go              # 5 domestic laws
│   │   ├── elections.go             # Elections, coups, approval rating
│   │   └── stability.go             # Stability index calculation
│   │
│   ├── domain/                      # EXISTING — Extended
│   │   ├── types.go                 # Agent struct (+ UnitClass, TechLevel fields)
│   │   ├── resources.go             # NEW: 12 ResourceType, ResourceState
│   │   ├── government.go            # NEW: GovernmentType, PoliticalState
│   │   ├── units.go                 # NEW: UnitClass, CounterMatrix, TrainingGrade
│   │   ├── treaties.go              # NEW: 10 TreatyType, MultilateralTreaty
│   │   ├── decisions.go             # NEW: Decision, DomainType, Briefing
│   │   └── events.go, skins.go, ...
│   │
│   ├── api/                         # EXISTING — Extended
│   │   ├── agent_routes.go          # v1 agent API (RETAINED)
│   │   └── v2/                      # NEW: v2 API routes
│   │       ├── auth_routes.go       # register/verify
│   │       ├── country_routes.go    # list/claim/release/transfer
│   │       ├── decision_routes.go   # submit/pending
│   │       ├── economy_routes.go    # tax/budget/trade/ownership
│   │       ├── diplomacy_routes.go  # treaty/war/peace/sanction
│   │       ├── military_routes.go   # produce/deploy/tech/nuke
│   │       ├── politics_routes.go   # government/law/election
│   │       └── observe_routes.go    # world/country/domain snapshots
│   │
│   ├── ws/                          # EXISTING — Extended
│   │   ├── hub.go, client.go        # Existing WS hub
│   │   ├── agent_stream.go          # v1 agent stream (RETAINED)
│   │   └── v2_stream.go             # NEW: v2 protocol (briefing, decision, world_update)
│   │
│   ├── agent/                       # EXISTING
│   │   ├── llm_bridge.go            # LLM integration (Claude/GPT/Llama)
│   │   └── world_memory.go          # NEW: 5-domain WorldMemory
│   │
│   └── world/                       # EXISTING — Extended
│       ├── world_manager.go         # WorldManager (195 countries)
│       ├── countries_seed.go        # Country seed data (resources, tier)
│       ├── country_data.go          # CountryState
│       └── country_codes.go         # NEW: AllCountryCodes [195]string
```

### 4.2 [C2] DecisionRouter — Internal Components

```
┌─────────────────────────────────────────────────┐
│                  DecisionRouter                  │
│                                                  │
│  ┌─────────────────┐  ┌───────────────────────┐ │
│  │ OperatorRegistry│  │    DecisionQueue       │ │
│  │                 │  │                        │ │
│  │ map[iso3]       │  │ map[tick][]*Decision   │ │
│  │  *CountryOps    │  │                        │ │
│  │  .Combat        │  │ Enqueue(d)             │ │
│  │  .Economy       │  │ DrainTick(tick) → []D  │ │
│  │  .Diplomacy     │  └───────────────────────┘ │
│  │  .Military      │                            │
│  │  .Politics      │  ┌───────────────────────┐ │
│  │                 │  │    BriefingHub         │ │
│  │ Get(iso,domain) │  │                        │ │
│  │ Claim(iso,doms) │  │ subscribers:           │ │
│  │ Release(iso)    │  │   map[agentID]chan     │ │
│  │ Transfer(iso,d) │  │                        │ │
│  └─────────────────┘  │ Send(agentID, brief)   │ │
│                        │ Subscribe(agentID)     │ │
│  ┌─────────────────┐  │ Unsubscribe(agentID)   │ │
│  │ TimeoutMonitor  │  └───────────────────────┘ │
│  │                 │                             │
│  │ WaitOrFallback  │  ┌───────────────────────┐ │
│  │ (iso, domain,   │  │   DecisionValidator   │ │
│  │  deadline,      │  │                        │ │
│  │  fallbackFn)    │  │ Validate(d, state)    │ │
│  └─────────────────┘  │  → error | nil         │ │
│                        └───────────────────────┘ │
│                                                  │
│  SubmitDecision(d) → error                       │
│  RequestDecision(iso, domain) → *Decision        │
│  Execute(d) → routes to domain engine            │
└─────────────────────────────────────────────────┘
```

**Key Flow: External Agent Decision**
1. Agent sends `decision_submit` via WS
2. API Gateway extracts `api_key` → `agentID` → finds claimed country/domain
3. DecisionRouter.SubmitDecision() validates: operator owns domain + action is valid in current state
4. Decision enqueued in DecisionQueue at current SimClock tick
5. SimulationEngine.processStrategicTick() drains queue and executes via domain engine

**Key Flow: NationalAI Fallback**
1. processStrategicTick() calls RequestDecision(iso, domain)
2. OperatorRegistry returns OperatorExternal → BriefingHub.Send()
3. TimeoutMonitor starts deadline countdown (SimClock-relative)
4. If no response by deadline → fallbackFn() invokes NationalAI.Decide()
5. Fallback decision executed; agent connection stays alive for next cycle

### 4.3 [C3] SimulationEngine — Internal Components

```
┌──────────────────────────────────────────────────────┐
│                   SimulationEngine                    │
│                                                       │
│  ┌──────────────┐  ┌────────────────────────────────┐│
│  │   SimClock    │  │       processStrategicTick()   ││
│  │              │  │                                ││
│  │ tick uint64  │  │ for each iso3 in 195 countries:││
│  │ speed float  │  │   for each domain in 5:        ││
│  │ epoch uint64 │  │     op = registry.Get(iso,dom) ││
│  │              │  │     switch op.Type:             ││
│  │ Advance()    │  │       NationalAI → ai.Decide() ││
│  │ CurrentTick()│  │       External → briefing+wait ││
│  │ TicksPer()   │  │       Human → briefing+wait    ││
│  └──────────────┘  └────────────────────────────────┘│
│                                                       │
│  ┌──────────────┐  ┌────────────────────────────────┐│
│  │ SimConfig    │  │       ArenaScheduler            ││
│  │              │  │                                ││
│  │ mode: pure/  │  │ Manages 195 CountryArenas:     ││
│  │  hybrid/     │  │  - Battle cycle (5min fight +  ││
│  │  full-agent  │  │    1min cooldown)              ││
│  │ speed: 1-1000│  │  - Lazy init (max 50 active)   ││
│  │ seed: int64  │  │  - Results → sovereignty/score  ││
│  └──────────────┘  └────────────────────────────────┘│
│                                                       │
│  ┌──────────────┐  ┌────────────────────────────────┐│
│  │ SimRecorder  │  │       WorldSnapshotBuilder      ││
│  │              │  │                                ││
│  │ EventLog     │  │ buildSnapshot(iso3):           ││
│  │ Snapshots    │  │  - country economy state       ││
│  │ Statistics   │  │  - DR relations                ││
│  └──────────────┘  │  - military forces             ││
│                     │  - political state             ││
│                     │  - nearby arena status         ││
│                     └────────────────────────────────┘│
└──────────────────────────────────────────────────────┘
```

**SimClock Tick Structure:**
```
Epoch (1 game hour) = 3600 ticks at x1 speed
  ├── Strategic tick (every 3600 ticks): Economy/Diplomacy/Politics decisions
  ├── Military tick (every 600 ticks): Unit production/deployment/tech
  ├── Combat tick (every 1 tick at 20Hz): Arena physics
  └── Broadcast tick (every 20 ticks): World state → spectators (1Hz)
```

### 4.4 [C4] Domain Engines — Component Detail

#### 4.4.1 CombatEngine (Existing game/arena.go — Extended)

- **Retained**: Arena 20Hz loop, CollisionSystem, SpatialHash, OrbManager, WeaponSystem, UpgradeSystem
- **Extended**: `Agent.UnitClass` field affects damage via `UnitCounterMatrix`
- **Extended**: `Agent.TechLevel` and `Agent.TrainingGrade` modify DPS
- **Integration**: MilitaryEngine.DeployForces() creates agents in target country's arena

#### 4.4.2 EconomyEngine v2 (NEW meta/economy_v2.go)

| Component | Responsibility |
|-----------|----------------|
| ResourceManager | 12 resource types, production/consumption/stockpile per country |
| TaxSystem | 3-tier taxation (PIT, ResourceTax, GTM), growth penalty calculation |
| BudgetAllocator | 8 budget categories (sum=100%), economic health formula |
| TradeEngine | Bilateral trade orders, market prices, Common Market auto-distribution |
| OwnershipManager | Nationalization/privatization, growth modifier |
| GDPCalculator | SP2-faithful GDP formula (production x price + trade income - expenses) |

**Migration from v1**: economy_v2.go wraps existing EconomyEngine, adding 6 new resource types (Chemicals, Machinery, Electronics, Vehicles, Services, Gold) while retaining the 6 original types (Oil, Minerals, Food, Tech, Manpower, Influence) with their existing semantics.

#### 4.4.3 DiplomacyEngine v2 (NEW meta/diplomacy_v2.go)

| Component | Responsibility |
|-----------|----------------|
| DRMatrix | 195x195 DR values (-100~+100), auto-modifiers (govt, culture, religion) |
| TreatyManager | 10 treaty types (4 bilateral + 6 multilateral), DR threshold enforcement |
| SanctionEngine | Trade embargo enforcement, collective sanctions |
| CommonMarketEngine | Surplus resource auto-redistribution among members |
| DREventProcessor | Auto DR changes from events (war, nuke, treaty breach) |

**Migration from v1**: v1 DiplomacyEngine is faction-based (FactionA/FactionB). v2 adds country-based (ISO3) DR layer. Both coexist: v1 for faction treaties, v2 for inter-country relations. Wrapper converts ISO3 → factionID where needed.

#### 4.4.4 MilitaryEngine (NEW military/*.go)

| Component | Responsibility |
|-----------|----------------|
| UnitFactory | Produce/disband 5 unit classes (resource costs: Steel + Gold) |
| CounterMatrix | 5x5 damage multiplier table |
| CombatResolver | Damage = baseDPS x counter x techMult x trainMult |
| TechTreeManager | 5 categories (Firearms, Aerospace, Naval, Stealth, ArmorTech), Lv 0-10 |
| DeploymentManager | Force allocation to target countries, Oil consumption |
| NuclearManager | 3-tier nuclear weapons, DR -55 global penalty, missile defense |

#### 4.4.5 PoliticsEngine (NEW politics/*.go)

| Component | Responsibility |
|-----------|----------------|
| GovernmentManager | 6 government types with SP2 modifiers (production, demand, corruption, military) |
| PolicyManager | 5 domestic laws, each with economy + DR trade-offs |
| ElectionSystem | Multi-party elections (4yr cycle for democracies), approval-based outcomes |
| CoupDetector | Approval < 40% + vulnerability → random coup chance per epoch |
| StabilityCalculator | Composite index from economy, wars, approval, laws |
| ApprovalCalculator | Based on economic health, military size, propaganda budget, active wars |

### 4.5 [C5] StrategicDecisionEngine — NationalAI Detail

```go
// Each of 195 NationalAIs has:
type NationalAI struct {
    ISO3        string
    Personality *NationalPersonality  // Tier-based (S/A/B/C/D), unique traits
    Memory      *WorldMemory          // 5-domain learning history
    Config      *AIConfig             // Decision weights, risk tolerance
}

// NationalPersonality — derived from real-world country data
type NationalPersonality struct {
    Tier            string   // S/A/B/C/D (from country_data.go)
    Aggressiveness  float64  // 0-1: war tendency
    EconomicFocus   float64  // 0-1: economy vs military priority
    DiplomacyStyle  string   // "isolationist" | "allied" | "opportunist" | "hegemon"
    RiskTolerance   float64  // 0-1: willingness to take risks
    NukeThreshold   float64  // 0-1: threshold to initiate nuke research
}
```

**Decision Priority (per strategic tick):**
1. **Survival check**: If approval < 30% → prioritize stability (healthcare budget up, propaganda up)
2. **War response**: If under attack → prioritize military (deploy forces, request alliance)
3. **Economy**: If GDP declining → adjust tax/budget/trade
4. **Diplomacy**: Evaluate treaty proposals, check for new alliance opportunities
5. **Military**: Produce units if budget allows, invest tech
6. **Politics**: Adjust laws based on approval trend, handle elections

---

<!-- SECTION_5 -->
## 5. Data Model

### 5.1 Core Domain Types (domain/ package)

#### 5.1.1 Decision (NEW — domain/decisions.go)

```go
type DomainType string
const (
    DomainCombat    DomainType = "combat"
    DomainEconomy   DomainType = "economy"
    DomainDiplomacy DomainType = "diplomacy"
    DomainMilitary  DomainType = "military"
    DomainPolitics  DomainType = "politics"
)
var AllDomains = []DomainType{DomainCombat, DomainEconomy, DomainDiplomacy, DomainMilitary, DomainPolitics}

type OperatorType int
const (
    OperatorNationalAI OperatorType = iota
    OperatorExternal
    OperatorHuman
)

type Decision struct {
    ID         string          `json:"id"`
    CountryISO string          `json:"country_iso"`
    Domain     DomainType      `json:"domain"`
    Action     string          `json:"action"`
    Params     json.RawMessage `json:"params"`
    Reasoning  string          `json:"reasoning,omitempty"`
    Tick       uint64          `json:"tick"`
    OperatorID string          `json:"operator_id"`
    Timestamp  time.Time       `json:"timestamp"`
}

type Briefing struct {
    Domain          DomainType       `json:"domain"`
    Tick            uint64           `json:"tick"`
    Deadline        uint64           `json:"deadline"`
    Context         *WorldSnapshot   `json:"context"`
    AvailableActions []ActionSpec    `json:"available_actions"`
    Urgency         string           `json:"urgency"` // low|medium|high|critical
    AISuggestion    *Decision        `json:"ai_suggestion,omitempty"`
}
```

#### 5.1.2 Resources (NEW — domain/resources.go)

```go
type ResourceTypeV2 string
const (
    ResGrain      ResourceTypeV2 = "grain"
    ResEnergy     ResourceTypeV2 = "energy"
    ResOilV2      ResourceTypeV2 = "oil"
    ResMineralsV2 ResourceTypeV2 = "minerals"
    ResSteel      ResourceTypeV2 = "steel"
    ResChemicals  ResourceTypeV2 = "chemicals"
    ResMachinery  ResourceTypeV2 = "machinery"
    ResElectronics ResourceTypeV2 = "electronics"
    ResVehicles   ResourceTypeV2 = "vehicles"
    ResServices   ResourceTypeV2 = "services"
    ResTechV2     ResourceTypeV2 = "tech"
    ResGold       ResourceTypeV2 = "gold"
)

type ResourceState struct {
    Type        ResourceTypeV2 `json:"type"`
    Stockpile   float64        `json:"stockpile"`
    Production  float64        `json:"production"`    // per epoch
    Consumption float64        `json:"consumption"`   // per epoch
    MarketPrice float64        `json:"market_price"`
    GrowthRate  float64        `json:"growth_rate"`   // base % per hour
}
```

#### 5.1.3 Units & Military (NEW — domain/units.go)

```go
type UnitClass string
const (
    UnitInfantry  UnitClass = "infantry"
    UnitArmor     UnitClass = "armor"
    UnitArtillery UnitClass = "artillery"
    UnitAircraft  UnitClass = "aircraft"
    UnitSpecial   UnitClass = "special"
)

type TrainingGrade string
const (
    GradeRecruit TrainingGrade = "recruit"  // x0.7
    GradeRegular TrainingGrade = "regular"  // x1.0
    GradeVeteran TrainingGrade = "veteran"  // x1.2
    GradeElite   TrainingGrade = "elite"    // x1.5
)

// Counter matrix: UnitCounterMatrix[attacker][defender] = damage multiplier
var UnitCounterMatrix = map[UnitClass]map[UnitClass]float64{
    UnitInfantry:  {UnitInfantry: 1.0, UnitArmor: 0.5, UnitArtillery: 1.2, UnitAircraft: 0.8, UnitSpecial: 0.3},
    UnitArmor:     {UnitInfantry: 1.5, UnitArmor: 1.0, UnitArtillery: 0.6, UnitAircraft: 0.9, UnitSpecial: 0.4},
    UnitArtillery: {UnitInfantry: 0.8, UnitArmor: 1.4, UnitArtillery: 1.0, UnitAircraft: 0.5, UnitSpecial: 0.5},
    UnitAircraft:  {UnitInfantry: 1.3, UnitArmor: 1.1, UnitArtillery: 1.3, UnitAircraft: 1.0, UnitSpecial: 0.3},
    UnitSpecial:   {UnitInfantry: 2.0, UnitArmor: 2.0, UnitArtillery: 2.0, UnitAircraft: 2.0, UnitSpecial: 1.0},
}

type MilitaryTech struct {
    Firearms  int `json:"firearms"`   // Lv 0-10
    Aerospace int `json:"aerospace"`  // Lv 0-10
    Naval     int `json:"naval"`      // Lv 0-10 (reserved)
    Stealth   int `json:"stealth"`    // Lv 0-10
    ArmorTech int `json:"armor_tech"` // Lv 0-10
}
```

#### 5.1.4 Government & Politics (NEW — domain/government.go)

```go
type GovernmentTypeName string
const (
    GovtMultiPartyDemocracy GovernmentTypeName = "multi_party_democracy"
    GovtSingleParty         GovernmentTypeName = "single_party"
    GovtCommunist           GovernmentTypeName = "communist"
    GovtMilitaryDictatorship GovernmentTypeName = "military_dictatorship"
    GovtMonarchy            GovernmentTypeName = "monarchy"
    GovtTheocracy           GovernmentTypeName = "theocracy"
)

type GovernmentType struct {
    Name              GovernmentTypeName
    ProductionMult    float64 // Resource production multiplier
    DemandMult        float64 // Resource consumption multiplier
    BaseCorruption    float64 // Base corruption % (0-25)
    MilitaryMaintMult float64 // Military maintenance cost multiplier
    CoupVulnerability float64 // Coup chance % when approval < 40%
    ElectionCycle     int     // Epochs between elections (0=none)
    ElectionThreshold float64 // Min approval to win election (0=auto-win)
    DRBonusSameType   float64 // DR bonus between same government types
}

type PoliticalState struct {
    Government    GovernmentTypeName     `json:"government"`
    ApprovalRate  float64                `json:"approval_rate"` // 0-100
    DomesticLaws  map[string]string      `json:"domestic_laws"` // law_name → option
    ElectionTimer int                    `json:"election_timer"`
    CoupRisk      float64                `json:"coup_risk"`     // 0-100
    StabilityIdx  float64                `json:"stability_index"` // 0-100
    MartialLaw    bool                   `json:"martial_law"`
}
```

#### 5.1.5 Treaties (NEW — domain/treaties.go)

```go
type TreatyType string
const (
    TreatyCulturalExchange TreatyType = "cultural_exchange"  // DR >=10
    TreatyNobleCause       TreatyType = "noble_cause"        // DR >=20
    TreatyTradeAgreement   TreatyType = "trade_agreement"    // DR >=30
    TreatyCommonMarket     TreatyType = "common_market"      // DR >=50
    TreatyNonAggression    TreatyType = "non_aggression"     // DR >=30
    TreatyMilitaryAlliance TreatyType = "military_alliance"  // DR >=60
    TreatyDebtAssumption   TreatyType = "debt_assumption"    // DR >=80
    TreatyWarRequest       TreatyType = "war_request"        // DR >=70
    TreatyEconomicSanction TreatyType = "economic_sanction"  // No DR req
    TreatyPeacefulAnnex    TreatyType = "peaceful_annexation"// DR >=95
)

type MultilateralTreaty struct {
    ID          string           `json:"id"`
    Type        TreatyType       `json:"type"`
    Name        string           `json:"name"`
    Founder     string           `json:"founder"`    // ISO3
    Members     []string         `json:"members"`
    MaxMembers  int              `json:"max_members"`
    DRThreshold float64          `json:"dr_threshold"`
    CreatedAt   time.Time        `json:"created_at"`
    Conditions  []TreatyCondition `json:"conditions,omitempty"`
}
```

### 5.2 Country State (Extended world/country_data.go)

```go
type CountryStateV17 struct {
    // Existing fields
    ISO3          string                 `json:"iso3"`
    Name          string                 `json:"name"`
    Tier          string                 `json:"tier"` // S/A/B/C/D
    Sovereignty   string                 `json:"sovereignty"` // faction owning
    Population    int64                  `json:"population"`

    // v17 NEW: 12 resources
    Resources     map[ResourceTypeV2]*ResourceState `json:"resources"`

    // v17 NEW: Economy
    GDP           float64                `json:"gdp"`
    EconomicHealth float64              `json:"economic_health"` // 0-100
    TaxSystem     TaxSystem             `json:"tax_system"`
    Budget        BudgetAllocation      `json:"budget"`
    Ownership     OwnershipPolicy       `json:"ownership"`
    Corruption    float64               `json:"corruption"` // 0-100

    // v17 NEW: Military
    Forces        map[UnitClass]int     `json:"forces"` // unit counts by class
    MilitaryTech  MilitaryTech          `json:"military_tech"`
    TrainingGrade TrainingGrade         `json:"training_grade"`
    Deployments   []Deployment          `json:"deployments"`
    NuclearLevel  int                   `json:"nuclear_level"` // 0-3

    // v17 NEW: Politics
    Politics      PoliticalState        `json:"politics"`

    // v17 NEW: Operator info
    Operators     *CountryOperators     `json:"operators,omitempty"`
}
```

### 5.3 DR Matrix (In-Memory)

```go
// 195 x 195 symmetric matrix stored as map for sparse access
type DRMatrix struct {
    mu     sync.RWMutex
    values map[string]map[string]float64 // ISO3 → ISO3 → DR value (-100~+100)
}

func (m *DRMatrix) Get(a, b string) float64  // returns DR between two countries
func (m *DRMatrix) Set(a, b string, dr float64) // sets DR (symmetric)
func (m *DRMatrix) Modify(a, b string, delta float64) // adjusts DR by delta
func (m *DRMatrix) GetAll(iso string) map[string]float64 // all relations for one country
```

### 5.4 WorldSnapshot (Observation API payload)

```go
type WorldSnapshot struct {
    Tick           uint64                          `json:"tick"`
    Epoch          uint64                          `json:"epoch"`
    Speed          float64                         `json:"speed"`
    Countries      map[string]*CountrySnapshot     `json:"countries"` // ISO3 → summary
    ActiveWars     []WarSummary                    `json:"active_wars"`
    ActiveTreaties []TreatySummary                 `json:"active_treaties"`
    Factions       []FactionSummary                `json:"factions"`
    TopGDP         []string                        `json:"top_gdp"`   // top 10 ISO3
    TopMilitary    []string                        `json:"top_military"`
    RecentEvents   []DomainEvent                   `json:"recent_events"` // last 50
}

type CountrySnapshot struct {
    ISO3            string  `json:"iso3"`
    Name            string  `json:"name"`
    Tier            string  `json:"tier"`
    GDP             float64 `json:"gdp"`
    Population      int64   `json:"population"`
    MilitaryPower   float64 `json:"military_power"` // composite score
    StabilityIndex  float64 `json:"stability_index"`
    Government      string  `json:"government"`
    FactionID       string  `json:"faction_id,omitempty"`
    OperatorType    string  `json:"operator_type"` // national_ai|external|human
    AtWar           bool    `json:"at_war"`
}
```

### 5.5 Operator Registry (In-Memory)

```go
type OperatorRegistry struct {
    mu        sync.RWMutex
    operators map[string]*CountryOperators // ISO3 → operators
}

type CountryOperators struct {
    Combat    OperatorInfo
    Economy   OperatorInfo
    Diplomacy OperatorInfo
    Military  OperatorInfo
    Politics  OperatorInfo
}

type OperatorInfo struct {
    Type            OperatorType
    AgentID         string        // External: API Key-based ID
    UserID          string        // Human: web session ID
    ConnectedAt     time.Time
    LastDecisionAt  time.Time
    TimeoutDuration time.Duration // fallback deadline per decision
}
```

### 5.6 WorldMemory (agent/world_memory.go)

```go
type WorldMemory struct {
    AgentID        string
    NationalityISO string

    // Combat memory (existing memory.go extension)
    CombatHistory  []CombatRoundResult
    BuildStats     map[string]*BuildPerformance

    // Economy memory (NEW)
    EconomyHistory []EconomicDecisionRecord  // policy → GDP delta tracking
    TaxEffectMap   map[float64]float64       // tax rate → growth rate correlation
    TradeHistory   []TradeRecord

    // Diplomacy memory (NEW)
    DiplomacyHistory []DiplomacyRecord       // treaty/war history + outcomes
    TrustScores      map[string]float64      // faction trust (promise fulfillment rate)
    BetrayalLog      []BetrayalEvent         // treaty breach records

    // Military memory (NEW)
    MilitaryHistory []MilitaryRecord         // battle results + unit effectiveness
    CounterPickLog  map[string]UnitComposition // enemy faction → optimal unit composition

    // Politics memory (NEW)
    PolicyEffects   []PolicyEffectRecord     // policy change → approval/economy impact
    CoupLog         []CoupEvent              // coup attempt/defense history
}

type SeasonLearning struct {
    Season              int
    FinalRank           int
    TotalGDP            float64
    Territories         int
    BestDecisions       []DecisionOutcome  // top 10
    WorstDecisions      []DecisionOutcome  // bottom 10
    EffectiveAlliances  []string           // ISO3 codes
    DangerousEnemies    []string
    OptimalTaxRange     [2]float64
    BestUnitComposition map[UnitClass]float64
    BestGovernment      GovernmentTypeName
}
```

### 5.7 Simulation Configuration

```go
type SimConfig struct {
    Mode         SimMode  // "pure" | "hybrid" | "full_agent"
    Speed        float64  // 1.0 ~ 1000.0 (time acceleration)
    Seed         int64    // Deterministic random seed
    SeasonLength time.Duration
    Port         int      // WS port (default 9002)
    APIPort      int      // REST port (default 9003)
    Headless     bool     // No WS connections accepted
    Runs         int      // Headless repeat count
    OutputPath   string   // Results file path
}

type SimMode string
const (
    SimModePure      SimMode = "pure"       // All NationalAI (v16 compatible)
    SimModeHybrid    SimMode = "hybrid"     // Mixed operators (v17 core)
    SimModeFullAgent SimMode = "full_agent" // All external (tournament)
)
```

---

<!-- SECTION_6 -->
## 6. API Design

### 6.1 REST API v2 — Full Endpoint Specification

All v2 endpoints require `Authorization: Bearer aww_xxx` header. v1 endpoints remain unchanged.

#### 6.1.1 Authentication (2 endpoints)

| Method | Path | Request | Response | Notes |
|--------|------|---------|----------|-------|
| POST | `/api/v2/auth/register` | `{name: string}` | `{api_key: "aww_xxx", agent_id: string}` | Issues new API key |
| POST | `/api/v2/auth/verify` | `{api_key: string}` | `{valid: bool, agent_id: string}` | Validates key |

#### 6.1.2 Country Operations (5 endpoints)

| Method | Path | Request | Response | Notes |
|--------|------|---------|----------|-------|
| GET | `/api/v2/countries` | — | `[{iso3, name, tier, operators}]` | All 195, with operator status |
| POST | `/api/v2/countries/{iso3}/claim` | `{domains: ["combat","economy"]}` | `{success, claimed_domains}` | Claim country operation |
| POST | `/api/v2/countries/{iso3}/release` | — | `{success}` | Release all domains |
| POST | `/api/v2/countries/{iso3}/transfer` | `{domain, to: "national_ai"}` | `{success}` | Delegate one domain |
| GET | `/api/v2/countries/{iso3}/operators` | — | `{combat: {type,id}, ...}` | Current operators |

#### 6.1.3 Decision API (2 endpoints)

| Method | Path | Request | Response |
|--------|------|---------|----------|
| POST | `/api/v2/decisions` | `Decision` JSON | `{id, status: "queued"\|"rejected", error?}` |
| GET | `/api/v2/decisions/pending` | — | `[Briefing]` — pending decisions for this agent |

#### 6.1.4 Economy API (5 endpoints)

| Method | Path | Request | Response |
|--------|------|---------|----------|
| GET | `/api/v2/economy/{iso3}` | — | `CountryEconomyV2` (12 resources + GDP + tax + budget) |
| POST | `/api/v2/economy/{iso3}/tax` | `{pit, resource_tax: {}, gtm}` | `{success, new_revenue_estimate}` |
| POST | `/api/v2/economy/{iso3}/budget` | `{infra, telecom, edu, health, military, govt, propaganda, aid}` | `{success}` (sum must = 100) |
| POST | `/api/v2/economy/{iso3}/trade` | `{resource, amount, price, target_iso}` | `{trade_id, status}` |
| POST | `/api/v2/economy/{iso3}/ownership` | `{sector, action: "nationalize"\|"privatize"}` | `{success, new_growth_mod}` |

#### 6.1.5 Diplomacy API (8 endpoints)

| Method | Path | Request | Response |
|--------|------|---------|----------|
| GET | `/api/v2/diplomacy/{iso3}/relations` | — | `{dr_matrix: {iso3: dr_value}, treaties, wars}` |
| POST | `/api/v2/diplomacy/treaties` | `{type, target_isos, name, conditions}` | `{treaty_id, status}` |
| PUT | `/api/v2/diplomacy/treaties/{id}` | `{accept: bool}` | `{status}` |
| DELETE | `/api/v2/diplomacy/treaties/{id}` | — | `{status: "withdrawn"}` |
| POST | `/api/v2/diplomacy/sanctions` | `{target_iso}` | `{sanction_id}` |
| POST | `/api/v2/diplomacy/war` | `{target_faction, reason}` | `{war_id, prep_ends_at}` |
| POST | `/api/v2/diplomacy/war/{id}/peace` | `{terms}` | `{proposal_id}` |
| POST | `/api/v2/diplomacy/war/{id}/surrender` | — | `{status, reparations}` |

#### 6.1.6 Military API (7 endpoints)

| Method | Path | Request | Response |
|--------|------|---------|----------|
| GET | `/api/v2/military/{iso3}` | — | `{forces, tech, training, deployments, nuke_level}` |
| POST | `/api/v2/military/{iso3}/produce` | `{class, count}` | `{success, cost, new_total}` |
| DELETE | `/api/v2/military/{iso3}/units` | `{class, count}` | `{success, disbanded}` |
| POST | `/api/v2/military/{iso3}/deploy` | `{target_iso, composition: {class: count}}` | `{deployment_id}` |
| DELETE | `/api/v2/military/{iso3}/deploy` | `{target_iso}` | `{recalled}` |
| POST | `/api/v2/military/{iso3}/tech` | `{category, amount}` | `{new_level, cost}` |
| POST | `/api/v2/military/{iso3}/nuke` | `{target_iso}` | `{launched, dr_penalty}` |

#### 6.1.7 Politics API (5 endpoints)

| Method | Path | Request | Response |
|--------|------|---------|----------|
| GET | `/api/v2/politics/{iso3}` | — | `PoliticalState` |
| POST | `/api/v2/politics/{iso3}/policy` | `{law, value}` | `{success, effects}` |
| POST | `/api/v2/politics/{iso3}/government` | `{type}` | `{success, stability_change}` |
| POST | `/api/v2/politics/{iso3}/election` | — | `{result, new_approval}` |
| POST | `/api/v2/politics/{iso3}/martial-law` | `{action: "declare"\|"lift"}` | `{success}` |

#### 6.1.8 Observation API (3 endpoints)

| Method | Path | Request | Response |
|--------|------|---------|----------|
| GET | `/api/v2/observe/world` | — | `WorldSnapshot` |
| GET | `/api/v2/observe/{iso3}` | — | `CountryDetail` (full state) |
| GET | `/api/v2/observe/{iso3}/{domain}` | — | Domain-specific detail |

**Total: 37 NEW v2 endpoints + 8 existing v1 endpoints = 45 endpoints**

### 6.2 WebSocket v2 Protocol

Connection: `/ws/v2?api_key=aww_xxx` or `/ws/v2?mode=spectate` (read-only)

#### Client → Server Messages

| Message | Payload | Auth Required | Notes |
|---------|---------|---------------|-------|
| `v2_auth` | `{api_key: string}` | N (is auth) | Must be first message |
| `decision_submit` | `Decision` JSON | Y | Submit a decision for any domain |
| `claim_country` | `{iso3, domains[]}` | Y | Claim country operation |
| `release_country` | `{iso3}` | Y | Release country |
| `observe_world` | `{}` | N | Request immediate world snapshot |

#### Server → Client Messages

| Message | Payload | Frequency | Notes |
|---------|---------|-----------|-------|
| `v2_auth_result` | `{success, agent_id, error?}` | Once | Response to v2_auth |
| `briefing` | `Briefing` JSON | Per strategic tick | Decision request to operator |
| `decision_result` | `{id, status, effects}` | Per decision | Confirmation |
| `decision_rejected` | `{id, reason}` | Per rejection | Invalid action/permission |
| `world_update` | `WorldSnapshot` | 1 Hz | World state broadcast |
| `domain_event` | `{domain, type, data}` | On event | War declared, treaty signed, etc. |
| `operator_change` | `{iso3, domain, new_type}` | On change | Operator switched |

### 6.3 Decision Action Catalog

All 33 actions available through `POST /api/v2/decisions` or `decision_submit` WS message:

| Domain | Action | Params Schema | Decision Cycle |
|--------|--------|--------------|----------------|
| **economy** | `set_tax_policy` | `{pit: 0-60, resource_tax: {type: 0-30}, gtm: -50 to 100}` | 1h game time |
| **economy** | `set_budget` | `{infra, telecom, edu, health, military, govt, propaganda, aid}` (sum=100) | 1h |
| **economy** | `propose_trade` | `{resource, amount, price, target_iso}` | Immediate |
| **economy** | `accept_trade` | `{trade_id}` | Immediate |
| **economy** | `set_ownership` | `{sector, action: nationalize\|privatize}` | 1h |
| **diplomacy** | `propose_treaty` | `{type, target_isos[], name, conditions[]}` | Immediate |
| **diplomacy** | `respond_treaty` | `{treaty_id, accept: bool}` | Immediate |
| **diplomacy** | `leave_treaty` | `{treaty_id}` | Immediate |
| **diplomacy** | `declare_war` | `{target_faction, reason}` | Immediate (DR check) |
| **diplomacy** | `propose_peace` | `{war_id, terms}` | Immediate |
| **diplomacy** | `impose_sanction` | `{target_iso}` | Immediate |
| **diplomacy** | `surrender` | `{}` | Immediate |
| **military** | `produce_units` | `{class, count}` | 1 military tick |
| **military** | `disband_units` | `{class, count}` | Immediate |
| **military** | `deploy_force` | `{target_iso, composition: {class: count}}` | 1 military tick |
| **military** | `recall_force` | `{target_iso}` | 1 military tick |
| **military** | `invest_tech` | `{category, amount}` | 1 military tick |
| **military** | `set_training` | `{priority_grade}` | 1 military tick |
| **military** | `launch_nuke` | `{target_iso}` | Immediate (DR -55 global) |
| **politics** | `change_government` | `{type}` | 24h game time (cooldown) |
| **politics** | `set_law` | `{law, value}` | 24h |
| **politics** | `call_election` | `{}` | 24h (democracy only) |
| **politics** | `declare_martial_law` | `{}` | Immediate |
| **politics** | `lift_martial_law` | `{}` | Immediate |
| **combat** | `set_strategy` | `{style, build_profile}` | Per round |
| **combat** | `send_command` | `{cmd, data}` (17 commands) | 20Hz |
| **combat** | `choose_upgrade` | `{index}` | On level-up |

### 6.4 Error Response Format

```json
{
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "Agent does not control economy domain for KOR",
    "domain": "economy",
    "country": "KOR",
    "details": {}
  }
}
```

Error codes: `UNAUTHORIZED`, `PERMISSION_DENIED`, `INVALID_ACTION`, `INSUFFICIENT_RESOURCES`, `DR_TOO_LOW`, `COOLDOWN_ACTIVE`, `COUNTRY_CLAIMED`, `RATE_LIMITED`, `SIMULATION_PAUSED`

---

<!-- SECTION_7 -->
## 7. Security Architecture

### 7.1 Authentication Model

```
┌─────────────────────────────────────────────────┐
│                Auth Flow                         │
│                                                  │
│  1. Register: POST /api/v2/auth/register         │
│     → API Key: aww_ + 64 hex chars (32 bytes)   │
│     → Stored: bcrypt hash in DB                  │
│                                                  │
│  2. REST Auth: Authorization: Bearer aww_xxx     │
│     → Middleware validates key → extracts AgentID│
│                                                  │
│  3. WS Auth: First message must be v2_auth       │
│     → {api_key: "aww_xxx"}                       │
│     → Validates → sets connection.AgentID        │
│     → 5s timeout: no auth → disconnect           │
│                                                  │
│  4. Permission Check (per request):              │
│     AgentID → OperatorRegistry → {iso3, domains} │
│     Request.domain ∈ claimed_domains ? allow : 403│
└─────────────────────────────────────────────────┘
```

### 7.2 Authorization Matrix

| Actor | Auth Method | Country Claim | Domain Access | Observation |
|-------|------------|---------------|---------------|-------------|
| External Agent | API Key | POST claim | Claimed domains only | Full (own country) + Summary (others) |
| Human Player | JWT Session | POST claim via UI | Claimed domains only | Full (own country) + Summary (others) |
| NationalAI | Internal | Automatic (unclaimed) | All unclaimed domains | Full (all countries) |
| Spectator | None (read-only WS) | None | None (read-only) | Summary (all countries) |

### 7.3 Rate Limiting

| Endpoint Category | Rate Limit | Burst | Scope |
|-------------------|-----------|-------|-------|
| Auth (register/verify) | 5/min | 2 | IP |
| Country claim/release | 10/min | 3 | AgentID |
| Decision submit | 60/min | 10 | AgentID + domain |
| Economy actions | 30/min | 5 | AgentID |
| Diplomacy actions | 30/min | 5 | AgentID |
| Military actions | 30/min | 5 | AgentID |
| Politics actions | 10/min | 2 | AgentID |
| Observation (REST) | 120/min | 20 | AgentID |
| WS messages (total) | 100/sec | 50 | Connection |

### 7.4 Input Validation Rules

| Field | Validation | Rejection |
|-------|-----------|-----------|
| `iso3` | Must be in AllCountryCodes (195 valid) | `INVALID_COUNTRY` |
| `domain` | Must be in AllDomains (5 valid) | `INVALID_DOMAIN` |
| `action` | Must be in domain's action catalog | `INVALID_ACTION` |
| `tax.pit` | 0 <= pit <= 60 | `OUT_OF_RANGE` |
| `budget.*` | Sum must equal 100 | `BUDGET_SUM_INVALID` |
| `unit_count` | > 0 AND <= available resources | `INSUFFICIENT_RESOURCES` |
| `treaty.dr_threshold` | Actual DR must meet treaty type minimum | `DR_TOO_LOW` |
| `nuke.target` | Must be at war with target | `NOT_AT_WAR` |

### 7.5 Threat Model (Top Risks)

| Threat | Impact | Mitigation |
|--------|--------|-----------|
| API key brute force | Unauthorized country control | bcrypt hashing, rate limiting, 64-char keys (256-bit entropy) |
| Decision replay attack | Duplicate actions | Decision.ID uniqueness check, tick validation (must be current or future) |
| Resource manipulation | Economy exploit | Server-side validation of all resource calculations, no client-trusted values |
| Multi-country claim (one agent) | Monopoly | Max 1 country per API key (configurable to 3 for tournaments) |
| WS flood | Server overload | Per-connection message rate limit, connection pool cap |
| NationalAI prediction | Gaming the fallback | NationalAI adds randomness factor (10-20%) to decisions |

---

<!-- SECTION_8 -->
## 8. Integration Strategy

### 8.1 Integration Principle: Extend, Never Replace

The fundamental strategy is to **add new files alongside existing code**, never modifying existing function signatures. Existing v1 clients continue to work unchanged.

### 8.2 Existing Code Integration Map

| Existing Module | v17 Integration Strategy | Breaking Changes |
|----------------|-------------------------|-----------------|
| `game/arena.go` (Arena) | Add `UnitClass` field to damage calculation in `CollisionSystem`. Arena struct unchanged. | None — additive field |
| `game/agent.go` (Agent helpers) | Add `NewAgentWithUnit()` factory alongside `NewAgent()`. | None — new function |
| `game/agent_api.go` (Commander) | Retained as CombatDomain handler. `AgentCommandRouter` unchanged. | None |
| `game/country_arena.go` | SimulationEngine uses `CountryArenaManager.GetOrCreateArena()` for battle scheduling. | None — existing API |
| `meta/economy.go` (v1) | `economy_v2.go` wraps v1 `EconomyEngine` for backward compatibility. v1 6-resource API still works. | None — wrapper pattern |
| `meta/diplomacy.go` (v1) | `diplomacy_v2.go` adds DR matrix layer on top. v1 faction-based treaties preserved. ISO3→factionID adapter. | None — adapter pattern |
| `meta/war.go` (WarManager) | Extended with UnitClass integration. `CalculateDamage()` now checks `Agent.UnitClass`. | None — additive |
| `meta/faction.go` | Retained. Factions = alliances of countries. `FactionManager` API unchanged. | None |
| `agent/llm_bridge.go` | Extended with 5-domain context in `GameStateForLLM`. New fields are optional. | None — optional fields |
| `ws/agent_stream.go` (v1 WS) | Retained on `/ws/agents/{id}/live`. New v2 protocol on `/ws/v2`. | None — separate path |
| `ws/hub.go` | Hub extended with v2 client type. Existing client handling unchanged. | None — additive |
| `api/agent_routes.go` (v1 REST) | Retained on `/api/agents/*`. v2 routes mounted on `/api/v2/*`. | None — separate prefix |
| `auth/apikey.go` | Extended to support `aww_v2_` prefix for v2 keys while accepting `aww_` for v1. | None — backward compatible |
| `world/world_manager.go` | SimulationEngine orchestrates via WorldManager's existing API. New fields added to CountryState. | None — field addition |
| `domain/types.go` | Add `UnitClass`, `TechLevel`, `TrainingGrade` fields to Agent struct. | None — zero-value defaults |

### 8.3 Migration Path: Faction-Based → Country-Based

```
Current (v1-v16):
  DiplomacyEngine: FactionA ←→ FactionB (faction ID pairs)
  WarManager: AttackerID/DefenderID (faction IDs)
  Treaty: faction_a / faction_b fields

v17 Addition (coexistence):
  DiplomacyEngine v2: ISO3_A ←→ ISO3_B (country DR matrix)
  WarManager: Unchanged (wars are between factions/alliances)
  MultilateralTreaty: Members []string (ISO3 codes)

Bridge Layer (meta/country_bridge.go):
  CountryToFaction(iso3) → factionID  // lookup via sovereignty
  FactionToCountries(factionID) → []iso3  // all countries in faction
  ApplyDRToFaction(iso3, factionID, delta)  // propagate DR changes
```

### 8.4 SDK v1 → v2 Migration

```typescript
// v1 agent (still works in v17 — ZERO changes required)
const agent = new AWWAgent({ url: "ws://localhost:9000/ws/agents/xxx/live" });
agent.onBattleState((state) => { /* combat only */ });
agent.sendCommand({ type: "hunt", data: { target: "nearest" } });

// v2 agent (new capabilities, backward compatible)
const agent = new AWWAgent({
  url: "ws://localhost:9002/ws/v2",
  apiKey: "aww_xxx",
  version: 2  // opt-in to v2
});

// v2 still has combat (same interface as v1)
agent.combat.sendCommand({ type: "hunt", data: { target: "nearest" } });

// v2 adds 4 new domains
await agent.claimCountry("KOR", ["combat", "economy"]);
agent.economy.setTaxPolicy({ pit: 0.20 });
agent.onBriefing(async (b) => b.aiSuggestion);  // use NationalAI suggestion
```

### 8.5 Binary Entrypoints

| Binary | Path | Purpose | Port |
|--------|------|---------|------|
| `server` | `cmd/server/main.go` | Existing game server (v1 + v2 API) | 9000 |
| `simulate` | `cmd/simulate/main.go` | Simulation engine with CLI | 9002 (WS) + 9003 (REST) |

The `simulate` binary imports and reuses all existing packages (`game/`, `meta/`, `world/`, `agent/`, `auth/`) plus the new packages (`sim/`, `strategy/`, `military/`, `politics/`). The main `server` binary also gains v2 API routes but defaults to the existing game mode.

### 8.6 game.sh Integration

```bash
# Existing commands (unchanged)
./game.sh         # Start game server (port 9000) + web client (port 9001)
./game.sh stop    # Stop all
./game.sh server  # Server only

# NEW commands
./game.sh simulate              # Hybrid mode, x1 speed, port 9002
./game.sh simulate --speed=100  # Accelerated simulation
./game.sh simulate --headless   # Headless balance test
./game.sh simulate --mode=pure  # NationalAI only (v16 compatible)
```

### 8.7 Domain Interconnection Matrix

Every v17 system affects others. This matrix documents the cross-domain effects:

| Source Event | Economy | Diplomacy | Military | Politics | Combat |
|-------------|---------|-----------|----------|----------|--------|
| Tax increase | GDP growth penalty | — | — | Approval shift | — |
| Nuke research | — | **DR -55 global** | Nuke capability | Approval -10 | — |
| Trade agreement | +trade income | DR +0.1/h | — | — | — |
| War declaration | Resource drain | DR -30 bilateral | Force deployment | Approval -15 | Arena battles |
| Government change | Production mult change | Same-govt DR bonus | Maint. mult change | Stability reset | — |
| Propaganda budget | Gold cost | **DR penalty** (global) | — | Approval +2/% | — |
| Common Market join | Surplus redistribution | DR +1/day (members) | — | — | — |
| Military buildup | Steel+Gold consumption | — | Force strength | — | Agent DPS |
| Coup/Revolution | Production -20% (temp) | DR -20 (instability) | — | Govt change | — |
| Election | — | Possible govt change DR | — | Leadership change | — |

---

<!-- SECTION_9 -->
## 9. Scalability & Performance

### 9.1 Performance Budget

| Operation | Target Latency | Frequency | Notes |
|-----------|---------------|-----------|-------|
| Arena tick (20Hz combat) | < 5ms | 20/sec per arena | Existing: ~2ms, budget maintained |
| Strategic tick (economy/diplomacy) | < 50ms for 195 countries | 1/epoch | Batch processing |
| Military tick (production/deployment) | < 20ms for 195 countries | 6/epoch | Lighter than strategic |
| Decision validation | < 1ms | Per decision | In-memory validation |
| WorldSnapshot build | < 100ms | 1 Hz | Diff-based incremental |
| WS broadcast (world_update) | < 10ms | 1 Hz | JSON serialization |
| REST API response (observe) | < 50ms P95 | On-demand | Cached snapshots |
| NationalAI.Decide() | < 5ms | Per domain per country | Rule-based, no LLM |
| LLM bridge (external agent) | < 2000ms | Per briefing | 2s hard timeout |

### 9.2 Memory Budget

| Data Structure | Size Estimate | Notes |
|---------------|---------------|-------|
| 195 CountryStateV17 | ~195 x 2KB = 380KB | In-memory, 12 resources + politics + military |
| DR Matrix (195x195) | ~152KB (sparse map) | Symmetric, only non-zero stored |
| OperatorRegistry | ~195 x 5 x 100B = 95KB | Lightweight |
| 50 active Arenas | ~50 x 500KB = 25MB | Max concurrent, lazy init |
| WorldSnapshot cache | ~500KB | Rebuilt every 1 Hz |
| NationalAI[195] | ~195 x 10KB = 1.9MB | Personality + memory |
| Decision Queue | ~10KB | Typically < 1000 pending |
| **Total estimated** | **~30MB** | Well within single-server budget |

### 9.3 Scaling Strategy

**Current target: Single server** (Railway deployment, 2 vCPU / 4GB RAM)

| Scale Point | Strategy | Trigger |
|------------|---------|--------|
| 50 → 100 concurrent arenas | Arena pool with goroutine pooling | > 50 players online |
| 195 NationalAI decisions/epoch | Parallel goroutines (fan-out) | Always |
| 100+ external agents | WS connection pool, gorilla/websocket per-conn buffers | > 100 WS connections |
| DR matrix O(n^2) | Sparse map, batch DR updates per epoch | Always |
| WorldSnapshot broadcast | Single build + fanout to all subscribers | > 100 spectators |

**Future horizontal scaling (post-v17, if needed):**
- Redis Pub/Sub for multi-server arena distribution
- Separate simulation server from game server
- Domain engine sharding (economy on server A, military on server B)

### 9.4 Time Acceleration Impact

| Speed | External Agents | Arena Mode | Strategic Tick Rate | CPU Impact |
|-------|----------------|-----------|--------------------|-----------|
| x1 | Full participation | 20Hz physics | 1/hour real | Low |
| x10 | 6-min response window | 20Hz physics | 1/6min real | Medium |
| x100 | **Disabled** (auto NationalAI) | 5Hz simplified | 1/36sec real | High |
| x1000 | **Disabled** | Statistical (no physics) | 1/3.6sec real | Very High |

At x100+, CombatEngine switches from full 20Hz Arena simulation to `SimplifiedArena` (statistical combat resolution) to maintain performance.

---

<!-- SECTION_10 -->
## 10. Reliability & Observability

### 10.1 Reliability Guarantees

| Guarantee | Mechanism | SLA |
|-----------|-----------|-----|
| **Simulation never stops** | NationalAI fallback for all 5 domains | 100% uptime for simulation loop |
| **Agent disconnect recovery** | OperatorRegistry auto-reverts to NationalAI | < 1 tick latency |
| **Arena crash isolation** | Each CountryArena runs in isolated goroutine with panic recovery | Single arena crash doesn't affect others |
| **State persistence** | Redis checkpoint every epoch (configurable) | < 1 epoch data loss on crash |
| **Season data durability** | SQLite/PostgreSQL for season history, API keys | ACID transactions |

### 10.2 Failure Modes & Recovery

| Failure | Detection | Recovery | Data Loss |
|---------|-----------|----------|-----------|
| External agent WS disconnect | gorilla/websocket ping/pong timeout (30s) | Auto-release domains → NationalAI | None (server-authoritative) |
| External agent decision timeout | SimClock deadline exceeded | NationalAI.Decide() fallback | None |
| Arena goroutine panic | recover() in Run() loop | Log error, restart arena, re-add agents | Current tick lost |
| Redis connection lost | Health check failure | Fall back to in-memory only, retry connection | Checkpoint gap |
| LLM API timeout (for NationalAI LLM mode) | 2s context deadline | Heuristic rule-based fallback | None |
| Server OOM | OS signal handler | Graceful shutdown: save state to disk | Minimal (last epoch) |

### 10.3 Observability

#### Metrics (Prometheus-compatible via observability/metrics.go)

| Metric | Type | Labels |
|--------|------|--------|
| `aww_sim_tick_duration_ms` | Histogram | `tick_type` (strategic/military/combat) |
| `aww_active_arenas` | Gauge | — |
| `aww_connected_agents` | Gauge | `type` (external/human/spectator) |
| `aww_decisions_total` | Counter | `domain`, `operator_type`, `status` (success/rejected/timeout) |
| `aww_national_ai_fallbacks` | Counter | `domain`, `iso3` |
| `aww_dr_changes_total` | Counter | `trigger` (war/nuke/treaty/trade) |
| `aww_gdp_by_tier` | Histogram | `tier` (S/A/B/C/D) |
| `aww_ws_messages_total` | Counter | `direction` (in/out), `type` |
| `aww_api_request_duration_ms` | Histogram | `method`, `path`, `status` |

#### Logging (structured slog)

```go
slog.Info("decision processed",
    "iso3", decision.CountryISO,
    "domain", decision.Domain,
    "action", decision.Action,
    "operator_type", operator.Type,
    "tick", decision.Tick,
    "latency_ms", elapsed.Milliseconds(),
)
```

#### SimRecorder (Event Log)

Every domain event is recorded for post-game analysis:
```go
type SimEvent struct {
    Tick      uint64     `json:"tick"`
    Epoch     uint64     `json:"epoch"`
    Type      string     `json:"type"`     // "war_declared", "treaty_signed", "coup", etc.
    ISO3      string     `json:"iso3"`
    Domain    DomainType `json:"domain"`
    Data      any        `json:"data"`
    Timestamp time.Time  `json:"timestamp"`
}
```

Output format: JSON Lines file (`simulation-{seed}-{timestamp}.jsonl`)

---

<!-- SECTION_11 -->
## 11. Architecture Decision Records

### ADR-001: Hybrid Operator Model over Pure Agent or Pure Simulation

**Status**: Accepted

**Context**: v15 supports only external agents in combat. v16 supports only internal NationalAI for full simulation. Neither allows mixed operation where some domains are externally controlled and others are AI-managed.

**Decision**: Implement OperatorRegistry that tracks operator type (NationalAI/External/Human) per country per domain (5 domains x 195 countries). Any domain can switch operators at runtime without simulation interruption.

**Consequences**: +Flexibility (domains independently controllable), +Backward compatibility (v16 pure sim = all NationalAI), -Complexity (operator state management), -Testing surface (3 operator types x 5 domains x 195 countries)

**Alternatives**: (1) External agents only — too limited. (2) Full replacement model — breaks v16.

---

### ADR-002: Coexistence of v1 and v2 APIs

**Status**: Accepted

**Context**: Existing v1 agents use `/api/agents/*` and `/ws/agents/{id}/live`. v2 needs 37 new endpoints for 5-domain control.

**Decision**: Mount v2 on `/api/v2/*` and `/ws/v2` as separate path prefix. v1 paths are retained unchanged. Both share the same auth system (API keys with `aww_` prefix work on both).

**Consequences**: +Zero breaking changes, +Independent deployment, -Two code paths to maintain, -Potential confusion between v1/v2 agent lifecycle

---

### ADR-003: 12 Resources (SP2 Simplification) over 27 (Full SP2) or 6 (Current)

**Status**: Accepted

**Context**: SuperPower 2 has 27 resource types. Current system has 6. Need balance between strategic depth and implementation/balancing cost.

**Decision**: 12 resources — 6 existing (Oil, Minerals, Food, Tech, Manpower, Influence) + 6 new (Grain, Energy, Steel, Chemicals, Machinery, Electronics, Vehicles, Services, Gold — replacing/extending). Each maps to 2-3 SP2 resources, preserving strategic trade-offs.

**Consequences**: +Manageable balance testing, +SP2-faithful interactions, -Some SP2 nuance lost (e.g., separate agriculture sub-types)

---

### ADR-004: DecisionQueue (Tick-Based) over Direct Execution

**Status**: Accepted

**Context**: Decisions from external agents arrive asynchronously but must be processed at the correct simulation tick for determinism and time acceleration compatibility.

**Decision**: All decisions are enqueued with a target tick. SimulationEngine.processStrategicTick() drains the queue per tick and executes in order. This ensures deterministic replay and time-acceleration compatibility.

**Consequences**: +Deterministic, +Replayable, +Time-acceleration safe, -Slight latency (decision waits for next tick), -Queue memory overhead

---

### ADR-005: NationalAI as Rule-Based (not LLM-Based)

**Status**: Accepted

**Context**: NationalAI must make decisions for up to 195 countries x 5 domains per strategic tick. LLM calls would cost $0.50-2.00 per tick across all countries.

**Decision**: NationalAI uses rule-based heuristics with per-country personality profiles. No LLM calls for NationalAI. External agents can optionally use LLM via the SDK's LLMBridge (their own API keys).

**Consequences**: +Predictable latency (< 5ms per decision), +Zero API cost, +Testable, -Less "intelligent" than LLM, -Manual balancing of heuristic weights

---

### ADR-006: Separate Simulation Binary (cmd/simulate/)

**Status**: Accepted

**Context**: The simulation engine has different runtime requirements than the game server (time acceleration, headless mode, different ports).

**Decision**: Create `cmd/simulate/main.go` as a separate binary that imports the same internal packages. The main `cmd/server/main.go` gains v2 API routes but defaults to game mode.

**Consequences**: +Independent deployment, +CLI flags for simulation-specific options, +Headless mode for CI testing, -Two binaries to build/deploy, -Shared code must remain compatible with both entrypoints

---

### ADR-007: DR Matrix as Sparse In-Memory Map over Dense Array

**Status**: Accepted

**Context**: 195x195 = 38,025 possible country pairs. A dense array would be 38,025 x 8 bytes = ~297KB. Most pairs start at DR=0 and many remain near zero.

**Decision**: Use `map[string]map[string]float64` (sparse). Only non-zero DR values are stored. Default is 0 for unset pairs.

**Consequences**: +Memory efficient for sparse data, +Easy to iterate over non-zero relations, -Map access overhead vs array indexing, -GC pressure from map allocations (mitigated: DR rarely changes)

---

<!-- SECTION_12 -->
## 12. Phase-by-Phase Implementation Map

### Phase → File Mapping (Architecture to Implementation)

| Phase | Plan Section | New Files | Modified Files | LOC Estimate |
|-------|-------------|-----------|----------------|-------------|
| **P1: Base Types & 12 Resources** | §8 Economy | `domain/resources.go`, `domain/government.go`, `domain/units.go`, `domain/treaties.go`, `domain/decisions.go`, `meta/economy_v2.go` | `domain/types.go` (add UnitClass fields) | ~2,500 |
| **P2: DR Diplomacy & Treaties** | §9 Diplomacy | `meta/diplomacy_v2.go`, `meta/country_bridge.go` | `meta/diplomacy.go` (adapter), `meta/war.go` (unit class integration) | ~2,000 |
| **P3: Politics & Unit Classes** | §10-11 Military/Politics | `politics/government.go`, `politics/policies.go`, `politics/elections.go`, `politics/stability.go`, `military/unit_classes.go`, `military/combat_resolver.go`, `military/tech_tree.go`, `military/production.go`, `military/deployment.go`, `military/nuclear.go` | `game/collision.go` (counter matrix) | ~3,500 |
| **P4: OperatorRegistry & DecisionRouter** | §3-4, §7 Core | `sim/engine.go`, `sim/clock.go`, `sim/operator.go`, `sim/decision.go`, `sim/briefing.go`, `sim/config.go`, `sim/state.go`, `sim/recorder.go`, `sim/snapshot.go`, `strategy/national_ai.go`, `strategy/personality.go`, `strategy/engine.go`, `strategy/economy_ai.go`, `strategy/diplomacy_ai.go`, `strategy/war_strategy.go`, `cmd/simulate/main.go`, `world/country_codes.go` | `world/world_manager.go` (sim integration) | ~4,000 |
| **P5: Server API v2** | §6 API | `api/v2/auth_routes.go`, `api/v2/country_routes.go`, `api/v2/decision_routes.go`, `api/v2/economy_routes.go`, `api/v2/diplomacy_routes.go`, `api/v2/military_routes.go`, `api/v2/politics_routes.go`, `api/v2/observe_routes.go`, `ws/v2_stream.go` | `cmd/server/main.go` (mount v2 routes) | ~3,000 |
| **P6: SDK v2** | §5 SDK | `aww-agent-skill/src/domains/*.ts` (5 files), `aww-agent-skill/src/observer.ts`, `aww-agent-skill/src/advisors/*.ts` (4 files), `aww-agent-skill/src/llm/*.ts` (2 files), `aww-agent-skill/src/meta-client.ts` | `aww-agent-skill/src/agent.ts`, `aww-agent-skill/src/types.ts` | ~3,000 |
| **P7: AI Learning & Memory** | §12 Memory | `agent/world_memory.go`, `agent/season_learning.go`, `aww-agent-skill/src/memory.ts` | `agent/llm_bridge.go` (5-domain context) | ~1,500 |
| **P8: SimEngine Integration & Balance** | §7 Sim Engine | — | `sim/engine.go` (v17 domain integration), `strategy/national_ai.go` (12-resource AI) | ~1,000 |
| **P9: Examples & Docs** | §14 Roadmap | `examples/full-nation-agent.ts`, `examples/llm-nation-agent.ts`, `examples/economic-optimizer.ts`, `docs/api/openapi-v2.yaml` | — | ~2,000 |
| **P10: Frontend UI (Optional)** | §14 Roadmap | `apps/web/app/(hub)/economy/v2/*`, `apps/web/app/(hub)/diplomacy/v2/*`, `apps/web/app/(hub)/military/*`, `apps/web/app/(hub)/politics/*`, `apps/web/app/(hub)/simwatch/*` | `apps/web/components/hub/` | ~5,000 |

### Dependency Graph (DAG)

```
P1 (Base Types) ──→ P2 (DR Diplomacy) ──→ P4 (Operator/Decision) ──→ P5 (API v2) ──→ P6 (SDK v2)
       │                    │                       │                       │              │
       └──→ P3 (Politics + Military) ───────────────┘                       │              │
                                                                            └──→ P9 (Docs) │
                                                    P7 (Memory) ←──────────────────────────┘
                                                         │
                                                    P8 (Balance) ──→ P10 (UI, optional)
```

**Critical Path**: P1 → P3 → P4 → P5 → P6 → P8

### Estimated Total

| Metric | Value |
|--------|-------|
| New Go files | ~45 |
| New TypeScript files | ~15 |
| New LOC (Go) | ~17,500 |
| New LOC (TypeScript) | ~6,000 |
| Modified existing files | ~15 |
| Total v17 LOC estimate | ~23,500 |
| Existing codebase | ~46,070 |
| Post-v17 total | ~69,570 |

---

<!-- SECTION_13 -->
## 13. Open Questions

| # | Question | Impact | Decision Needed By |
|---|---------|--------|-------------------|
| Q1 | **Max countries per agent**: Should one API key control 1 or up to 3 countries? | Multi-country enables alliance coordination, but risks monopoly | P4 (OperatorRegistry) |
| Q2 | **SimplifiedArena at x100+**: What statistical model for combat resolution? | Affects headless balance test accuracy vs speed | P8 (Balance) |
| Q3 | **Season data storage**: SQLite (simple) vs PostgreSQL (scalable)? | Affects deployment complexity and Railway costs | P4 (cmd/simulate) |
| Q4 | **DR initial values**: Start all at 0, or seed from real-world data (cultural/geographic proximity)? | Affects early-game dynamics significantly | P2 (DR System) |
| Q5 | **Common Market surplus distribution**: Equal share vs need-based vs GDP-proportional? | Affects economic balance of multilateral treaties | P2 (Treaty Engine) |
| Q6 | **Nuclear ICBM cross-continent range**: Should Lv3 nukes truly hit any country, or require deployed forces nearby? | Affects endgame balance | P3 (Nuclear System) |
| Q7 | **Spectator authentication**: Should SimWatch require API key or remain fully public? | Security vs accessibility trade-off | P5 (API v2) |
| Q8 | **v2 API versioning strategy**: Path prefix (`/api/v2/`) vs header (`Accept: application/vnd.aww.v2+json`)? | Adopted path prefix (ADR-002), but header option remains open for v3 | Resolved (P5) |
| Q9 | **Headless mode output format**: JSON Lines vs SQLite database vs both? | Affects post-simulation analysis tooling | P8 (SimRecorder) |
| Q10 | **Resource market price model**: Fixed prices per tier vs dynamic supply/demand? | Dynamic = more emergent behavior but harder to balance | P1 (Economy v2) |
