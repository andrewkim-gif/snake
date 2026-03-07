# AI World War v14 — In-Game Total Overhaul: System Architecture

> **Version**: v14.0
> **Date**: 2026-03-07
> **Status**: DRAFT
> **Based on**: `v14-ingame-overhaul-plan.md` + `v14-ingame-overhaul-roadmap.md` (45 Steps / 11 Phases)
> **Scope**: C4 Level 2-3, WebSocket Protocol, Data Model, Frontend Architecture, Performance Budget
> **Predecessor**: `v11-system-architecture.md` (1,889 lines, 16 sections)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Goals / Non-Goals](#2-goals--non-goals)
3. [C4 Level 2 — Container Diagram](#3-c4-level-2--container-diagram)
4. [C4 Level 3 — Component Design](#4-c4-level-3--component-design)
5. [Data Flow & Sequence Diagrams](#5-data-flow--sequence-diagrams)
6. [WebSocket Protocol Specification](#6-websocket-protocol-specification)
7. [Data Model](#7-data-model)
8. [Frontend Architecture](#8-frontend-architecture)
9. [Security & Anti-Cheat](#9-security--anti-cheat)
10. [Scalability & Performance Budget](#10-scalability--performance-budget)
11. [Observability](#11-observability)
12. [ADR Summary](#12-adr-summary)
13. [Verification Matrix](#13-verification-matrix)
14. [Open Questions](#14-open-questions)

---

## 1. Overview

v14 transforms AI World War from a **5-minute single-round survival** into a **Megabonk-inspired auto-combat deathmatch** layered with geopolitical domination, civilization management, and intercountry warfare.

### 1.1 Architectural Shift Summary

| Aspect | v11 (Current) | v14 (Target) |
|--------|--------------|-------------|
| **Game Loop** | 5-min single-round, 1-life | 10-min epoch (5 peace + 5 war), respawn deathmatch |
| **Combat** | 60px aura DPS + dash | 10 auto-fire weapons + 10 passives + 10 synergies |
| **Progression** | Lv1→12, 8 Tomes + 6 Abilities | Lv1→20, weapon evolution Lv1→5, full skill tree |
| **Session** | 5-min standalone | 1hr session (6 epochs), 24hr domination, 1wk hegemony |
| **Meta-Game** | Sovereignty + factions | Civilization policies + national stats + war system |
| **Character** | skinId (24 presets) | CharacterCreator random gen + nationality |
| **Arena** | CountryArena (5-min round) | CountryArena (10-min epoch, respawn, weapon system) |

### 1.2 Four-Layer Architecture

```
Layer 4: SPECTACLE         Globe domination map, war effects, event ticker
Layer 3: CIVILIZATION      Policy system, 8 national stats, feedback loops
Layer 2: DOMINATION        10-min epoch → 1hr eval → 24hr sovereignty → 1wk hegemony
Layer 1: COMBAT (CORE)     Megabonk auto-combat, weapons, passives, synergies, respawn
Layer 0: INFRASTRUCTURE    CountryArena, EpochManager, protocol, state serialization
```

**Design Principle**: Each layer is independently deployable. Layer 0-1 (combat) ships in Phase 0-4; Layer 2 (domination) in Phase 5; Layer 3 (civilization) in Phase 6; Layer 4 (spectacle) spans Phases 7-8. Higher layers never block lower layers.

### 1.3 Compatibility with v11

v14 **extends** v11's `CountryArena` (composition pattern from ADR-026). The embedded `Room → Arena` chain remains, but the internal combat system, progression, and lifecycle are replaced:

- `Arena.agents` map → **kept** (same `domain.Agent` struct, extended)
- `CollisionSystem` → **replaced** by `WeaponSystem` + `CombatResolver`
- `UpgradeSystem` (Tome/Ability) → **replaced** by `SkillTreeManager` (Weapon/Passive/Synergy)
- `ArenaShrink` → **kept** (reused in war phase last 2 minutes)
- `OrbManager` → **kept** (XP/Gold orbs, enhanced with NPC drops)
- `Room` state machine → **replaced** by `EpochManager` (6-state epoch cycle)
- `BotManager` → **extended** (nationality-aware bots, weapon AI)
- `WorldManager` → **extended** (domination tracking, war state, alliance graph)

## 2. Goals / Non-Goals

### Goals

| # | Goal | Success Metric |
|---|------|---------------|
| G-1 | Replace aura combat with Megabonk auto-fire weapons | 10 weapons firing independently at 20Hz tick |
| G-2 | Implement 10-min epoch cycle with peace/war phases | State machine transitions verified, 6 epochs = 1hr |
| G-3 | Respawn deathmatch (kill → 3s wait → respawn) | Zero permanent deaths, build persistence across epochs |
| G-4 | Full skill tree: 10 weapons × 5 evolution + 10 passives + 10 synergies | All 130 upgrade paths functional |
| G-5 | Domination hierarchy (epoch → 1hr → 24hr → 1wk) | Automated evaluation, globe color updates < 5s |
| G-6 | Civilization policy system (10 categories × 3 options) | Policy → stat effects verified, hegemony gating |
| G-7 | War system with cross-arena invasion | War state machine, cross-arena entry, war score |
| G-8 | 50 concurrent agents at 20Hz, 60 FPS client | Server tick < 50ms, client 60 FPS benchmark |
| G-9 | Character nationality + random appearance | Join requires nationality, appearance persists lobby→game |
| G-10 | Globe real-time domination + war effects | Color transitions, arc lines, particles rendering |

### Non-Goals

| # | Non-Goal | Reason |
|---|----------|--------|
| NG-1 | Blockchain token changes (AWW, national tokens) | Reuse v11 infrastructure (ADR-033) |
| NG-2 | Database schema overhaul | In-memory first, persist later |
| NG-3 | New server binary (Meta Server split) | Single binary approach (ADR-025) continues |
| NG-4 | Mobile native client | Web-only; mobile responsive via existing CSS |
| NG-5 | AI agent training system changes | v10 agent API preserved as-is |
| NG-6 | Weather/environment system (FR-18, P3) | Deferred to v15+ |

## 3. C4 Level 2 — Container Diagram

```
┌───────────────────────── CLIENT (Next.js 15 + R3F) ──────────────────────────┐
│                                                                                │
│  ┌──────────────────┐  ┌────────────────────────┐  ┌───────────────────────┐  │
│  │  GLOBE VIEW       │  │  GAME VIEW (R3F)       │  │  HUB PAGES            │  │
│  │  ├ GlobeDomMap    │  │  ├ WeaponRenderer      │  │  ├ CivilizationPanel  │  │
│  │  ├ GlobeWarFX     │  │  ├ DamageNumbers       │  │  ├ PolicyManager      │  │
│  │  ├ GlobeHoverPanel│  │  ├ EpochHUD            │  │  ├ StatsChart         │  │
│  │  ├ EventTicker    │  │  ├ LevelUpOverlay      │  │  ├ WarDashboard       │  │
│  │  └ NatSelector    │  │  ├ BuildHUD            │  │  └ AlliancePanel      │  │
│  └──────┬───────────┘  │  ├ ScoreboardOverlay   │  └───────────┬───────────┘  │
│         │ click→enter   │  ├ CapturePointRender  │              │              │
│         └──────────────→│  ├ FlagSprite          │←─ESC─────────┘              │
│                         │  ├ SpectatorMode       │                             │
│                         │  └ AgentInstances(ext) │                             │
│                         └──────────┬─────────────┘                             │
│              ┌─────────────────────┼────────────────────────────┐              │
│              │ useSocket (ext)     │ useEpoch (NEW)             │              │
│              │ useWeapons (NEW)    │ useDomination (NEW)        │              │
│              └─────────────────────┼────────────────────────────┘              │
└────────────────────────────────────┼──────────────────────────────────────────┘
                                     │ WSS (single connection, multiplexed)
┌────────────────────────────────────┼──────────────────────────────────────────┐
│                       SERVER (Go, single binary)                              │
│                                    │                                          │
│  ┌─────────────────────────────────▼──────────────────────────────────────┐   │
│  │  ws/Hub — WebSocket connection manager + EventRouter                   │   │
│  └────┬────────────┬────────────┬────────────┬────────────┬──────────────┘   │
│       │            │            │            │            │                   │
│  ┌────▼────┐  ┌────▼─────┐  ┌──▼────────┐  ┌▼─────────┐ ┌▼──────────────┐  │
│  │ World   │  │ Country  │  │Domination │  │Civiliz.  │ │War           │  │
│  │ Manager │  │ Arena[N] │  │Engine     │  │Engine    │ │System        │  │
│  │         │  │┌────────┐│  │           │  │          │ │              │  │
│  │ 195-ISO │  ││Epoch   ││  │ 1hr eval  │  │ Policy   │ │ Declaration  │  │
│  │ lazyInit│  ││Manager ││  │ Sovereign │  │ NatStats │ │ CrossArena   │  │
│  │ pool≤50 │  ││Weapon  ││  │ Hegemony  │  │ Feedback │ │ Resolution   │  │
│  │         │  ││System  ││  │ Globe Sync│  │ Loops    │ │ Alliance     │  │
│  │         │  ││Respawn ││  │           │  │          │ │              │  │
│  │         │  ││Combat  ││  │           │  │          │ │              │  │
│  │         │  ││SkillTree│  │           │  │          │ │              │  │
│  │         │  ││Scoring ││  │           │  │          │ │              │  │
│  │         │  ││NPC     ││  │           │  │          │ │              │  │
│  │         │  ││Capture ││  │           │  │          │ │              │  │
│  │         │  │└────────┘│  │           │  │          │ │              │  │
│  └─────────┘  └──────────┘  └───────────┘  └──────────┘ └──────────────┘  │
│       │            │              │              │              │           │
│  ┌────▼────────────▼──────────────▼──────────────▼──────────────▼────────┐  │
│  │  domain/ — Shared types (Agent, Weapon, Epoch, Domination, Policy)    │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│       │                                                                    │
│  ┌────▼─────────────────────────────────────────────────────────────────┐  │
│  │  cache/Redis — NationStats cache, Domination state, War state,       │  │
│  │                EventLog buffer, pub/sub channels                      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Container Responsibilities

| Container | Technology | Responsibility |
|-----------|-----------|---------------|
| **Web Client** | Next.js 15, React 19, R3F, three-globe | All rendering, HUD, globe, weapon FX |
| **Game Server** | Go 1.22, gorilla/websocket | 20Hz game loop, all server-side game logic |
| **Redis** | Redis 7 | Nation stats cache, domination/war state, pub/sub events |
| **PostgreSQL** | PostgreSQL 16 | User accounts, achievements, season data (v11 schema) |

### 3.2 Key Communication Paths

| Path | Protocol | Frequency | Payload Size |
|------|----------|-----------|-------------|
| Client ↔ Game Server | WebSocket (JSON) | 20Hz state, 30Hz input | < 2KB/frame state, < 100B input |
| Client → Server (actions) | WebSocket events | On demand | < 500B per event |
| Server → Redis | TCP | Per epoch end, per domination eval | < 1KB per write |
| Server → PostgreSQL | TCP | Per session end, per achievement | < 500B per write |

## 4. C4 Level 3 — Component Design

### 4.1 EpochManager (replaces Room state machine)

**File**: `server/internal/game/epoch.go`, `epoch_state.go`
**Replaces**: `Room.state` (waiting→countdown→playing→ending→cooldown)

```
State Machine:
  PEACE(5m) → WAR_COUNTDOWN(3s) → WAR(3m) → SHRINK(2m) → EPOCH_END(5s) → TRANSITION(5s) → PEACE
              ↑                                                                               │
              └───────────────────────────────────────────────────────────────────────────────┘
```

```go
// EpochState enumeration
type EpochState int
const (
    EpochPeace         EpochState = iota  // 0:00-5:00 — PvP OFF, orb farming, NPC spawns
    EpochWarCountdown                      // 5:00-5:03 — 3s siren + countdown
    EpochWar                               // 5:03-8:00 — PvP ON, kill rewards
    EpochShrink                            // 8:00-10:00 — PvP ON + arena shrink 3000→1000px
    EpochEnd                               // 10:00-10:05 — scoreboard, MVP, nation score tally
    EpochTransition                        // 10:05-10:10 — next epoch countdown
)

// EpochManager manages the 10-minute epoch lifecycle
type EpochManager struct {
    state          EpochState
    epochNumber    int           // 1-6 within 1hr session
    sessionNumber  int           // increments every 6 epochs
    ticksInState   int
    totalEpochTick uint64
    pvpEnabled     bool
    shrinkActive   bool

    // Scoring
    nationScores   map[string]*NationEpochScore  // ISO3 → score
    playerScores   map[string]*PlayerEpochScore   // agentID → score

    // Callbacks
    onStateChange  func(old, new EpochState)
    onEpochEnd     func(scores map[string]*NationEpochScore)
    onSessionEnd   func()  // 6-epoch session complete → full reset
}
```

**Key behaviors**:
- `Tick()`: Advances state machine, checks time boundaries, toggles PvP, triggers shrink
- `OnKill(killer, victim)`: Awards XP, gold, nation points; tracks assists (5s window)
- `EndEpoch()`: Tallies NationScore, broadcasts scoreboard, selects MVP
- `EndSession()` (every 6 epochs): Resets all agents to Lv1, clears builds, triggers domination eval

### 4.2 WeaponSystem (replaces CollisionSystem combat)

**File**: `server/internal/game/weapon_system.go`
**Replaces**: `CollisionSystem.ProcessAgentCombat()` (aura-based DPS)

```go
// WeaponSystem manages all weapon auto-fire logic per arena
type WeaponSystem struct {
    weapons map[string][]*WeaponSlot  // agentID → up to 5 weapon slots

    // Status effect tracking (shared across weapons)
    statusEffects map[string][]StatusEffect  // agentID → active effects (DOT, slow, stun)
}

// WeaponSlot represents one equipped weapon on an agent
type WeaponSlot struct {
    Type          WeaponType
    Level         int         // 1-5 (evolution level)
    CooldownLeft  int         // ticks until next fire
    BaseCooldown  int         // ticks between fires (from WeaponDef)
}

// WeaponType — 10 weapon types
type WeaponType int
const (
    WeaponBonkMallet    WeaponType = iota  // Front 120° fan, knockback
    WeaponChainBolt                         // Chain to 3 targets
    WeaponFlameRing                         // 360° expanding fire ring, DOT
    WeaponFrostShards                       // Front 45° salvo (5 shards), slow
    WeaponShadowStrike                      // Teleport behind nearest, backstab 2x
    WeaponThunderClap                       // AOE on highest HP target, stun
    WeaponVenomCloud                        // Placed poison cloud, DOT
    WeaponCrystalShield                     // Orbiting shields, reflect
    WeaponGravityBomb                       // Black hole → explosion
    WeaponSoulDrain                         // Beam to nearest, lifesteal
)
```

**Fire Loop** (called from Arena.Tick at 20Hz):
1. For each agent, iterate weapon slots
2. Decrement cooldown; if 0, execute weapon pattern
3. Pattern selects targets via `SpatialHash` (range check + angle check)
4. Apply damage formula: `FinalDmg = BaseDmg × (1 + Fury×0.15) × CritMult - DEF`
5. Apply special effects (DOT, slow, stun, knockback)
6. Emit `weapon_fired` event for client VFX
7. Reset cooldown

**Weapon Evolution** (Lv1→5):
- Lv2: +30% BaseDmg
- Lv3: +25% Range or +1 projectile
- Lv4: -20% Cooldown
- Lv5: Unique ultimate transformation (10 variants, see plan §4.3)

### 4.3 CombatResolver (new, replaces aura combat)

**File**: `server/internal/game/combat.go` (rewrite)

```go
// CombatResolver calculates final damage, applies status effects, handles death/respawn
type CombatResolver struct {
    respawnManager *RespawnManager
    statusTracker  *StatusEffectTracker
}

// ResolveHit processes a single weapon hit
func (cr *CombatResolver) ResolveHit(attacker, defender *domain.Agent, weapon *WeaponDef, isCritical bool) DamageResult {
    // 1. Base damage from weapon
    baseDmg := weapon.BaseDPS * weapon.CooldownSec  // damage per hit

    // 2. Fury passive multiplier
    furyStacks := attacker.Build.Passives[PassiveFury]
    dmgMult := 1.0 + float64(furyStacks) * 0.15

    // 3. Critical multiplier
    critMult := 1.0
    if isCritical { critMult = 2.0 }

    // 4. Defense reduction (Iron Skin)
    ironSkinStacks := defender.Build.Passives[PassiveIronSkin]
    defReduction := float64(ironSkinStacks) * 0.12

    // 5. Final damage
    finalDmg := baseDmg * dmgMult * critMult * (1.0 - defReduction)

    // 6. Apply to defender HP
    defender.HP -= finalDmg
    if defender.HP <= 0 {
        cr.respawnManager.HandleDeath(defender, attacker)
    }

    return DamageResult{Damage: finalDmg, IsCritical: isCritical, IsDOT: false}
}
```

### 4.4 RespawnManager (new)

**File**: `server/internal/game/respawn.go`

```go
type RespawnManager struct {
    deadAgents   map[string]*DeathRecord   // agentID → death info
    invincible   map[string]uint64         // agentID → invincibility end tick
}

type DeathRecord struct {
    AgentID      string
    DeathTick    uint64
    RespawnTick  uint64   // DeathTick + 3*TickRate (3 seconds)
    KillerID     string
    Position     domain.Position
}
```

**Respawn flow**:
1. Agent HP ≤ 0 → `Alive = false`, record `DeathRecord`
2. After 60 ticks (3s): set `Alive = true`, random position, HP = MaxHP, Speed = -30% (40 ticks)
3. After 100 ticks (5s from respawn): remove invincibility flag
4. Level, weapons, passives **preserved**

### 4.5 SkillTreeManager (replaces UpgradeSystem)

**File**: `server/internal/game/skill_tree.go`

```go
type SkillTreeManager struct {
    // Per-agent progression
    agentBuilds map[string]*AgentBuild
}

type AgentBuild struct {
    Level      int
    XP         int
    XPToNext   int
    Weapons    []*WeaponSlot         // max 5 slots
    Passives   map[PassiveType]int   // type → stack count
    Synergies  []SynergyType         // active synergies (auto-detected)
    Gold       int
}

// PassiveType — 10 passive types
type PassiveType int
const (
    PassiveVigor     PassiveType = iota  // +15% max HP / stack (max 6)
    PassiveSwift                          // +12% move speed / stack (max 5)
    PassiveFury                           // +15% damage / stack (max 8)
    PassiveIronSkin                       // -12% damage taken / stack (max 6)
    PassiveMagnet                         // +25% pickup range / stack (max 5)
    PassiveFortune                        // +15% rare chance / stack (max 5)
    PassiveVitality                       // +2 HP/s regen / stack (max 5)
    PassivePrecision                      // +8% crit chance / stack (max 6)
    PassiveBlast                          // +15% AOE size / stack (max 5)
    PassiveHaste                          // -8% cooldown / stack (max 5)
)

// SynergyType — 10 synergy combos
type SynergyType int
const (
    SynergyThermalShock  SynergyType = iota  // FlameRing + FrostShards
    SynergyAssassinsMark                      // ShadowStrike + Precision×3
    SynergyFortress                           // CrystalShield + IronSkin×3
    SynergyCorruption                         // SoulDrain + VenomCloud
    SynergyThunderGod                         // ThunderClap + ChainBolt
    SynergyGravityMaster                      // GravityBomb + Magnet×3
    SynergyBerserker                          // Fury×5 + Swift×3
    SynergyIronMaiden                         // IronSkin×4 + Vigor×3
    SynergyGlassCannon                        // Fury×6 + Precision×4
    SynergySpeedster                          // Swift×4 + Haste×3
)
```

**Level-up flow**:
1. Agent gains enough XP → `LevelUp()` called
2. Generate 3 random choices (40% weapon, 50% passive, 10% synergy hint)
3. Emit `level_up_choices` event to client
4. 5-second timeout → auto-select first option
5. Client responds with `choose_upgrade` → apply to `AgentBuild`
6. Check synergy conditions after each upgrade

### 4.6 DominationEngine (extends v11 sovereignty)

**File**: `server/internal/game/domination.go`

```go
type DominationEngine struct {
    // Per-country domination tracking
    countries map[string]*CountryDomination

    // Global evaluation timer
    lastEvalTime  time.Time
    evalInterval  time.Duration  // 1 hour
}

type CountryDomination struct {
    ISO3              string
    CurrentDominator  string    // ISO3 of dominating nation (empty = none)
    DominationStart   time.Time // when current dominator started
    SovereigntyStart  time.Time // when 24hr streak started
    HegemonyStart     time.Time // when 7-day streak started

    // Epoch score history (rolling 6 epochs)
    EpochScores [6]map[string]int  // [epoch_idx][nationISO3] → score

    // Status flags
    HasSovereignty bool
    HasHegemony    bool
}
```

**Evaluation cycle** (every 1 hour / 6 epochs):
1. Sum `EpochScores[0..5]` per nation per country
2. Highest score (above threshold 100) becomes dominator
3. Tie-break: total kills > total levels > first to reach
4. Defender bonus: +10% to current dominator's score
5. Transition: new dominator → 15-min +20% defense bonus
6. Check 24hr streak → sovereignty flag + buffs
7. Check 7-day streak → hegemony flag + policy unlock
8. Broadcast `domination_update` to all globe clients
9. Reset epoch scores, reset all agent levels to 1

### 4.7 CivilizationEngine (new)

**File**: `server/internal/game/civilization.go`

```go
type CivilizationEngine struct {
    policies    map[string]*CountryPolicy    // ISO3 → active policies
    stats       map[string]*NationStats      // ISO3 → 8 metrics
}

type CountryPolicy struct {
    Religion      PolicyLevel  // 0=Atheism, 1=Polytheism, 2=Monotheism
    Language      PolicyLevel  // 0=Native, 1=Bilingual, 2=Global
    Government    PolicyLevel  // 0=Democracy, 1=Authoritarian, 2=Oligarchy
    TaxRate       PolicyLevel  // 0=Low(10%), 1=Mid(25%), 2=High(40%)
    Military      PolicyLevel  // 0=Min(10%), 1=Normal(25%), 2=Max(50%)
    Education     PolicyLevel  // 0=Basic, 1=Normal, 2=Elite
    Trade         PolicyLevel  // 0=Protectionism, 1=FreeTrade, 2=Sanctions
    Environment   PolicyLevel  // 0=Exploit, 1=Balance, 2=Preserve
    Immigration   PolicyLevel  // 0=Closed, 1=Selective, 2=Open
    Culture       PolicyLevel  // 0=Traditional, 1=Innovation, 2=Fusion

    LastChanged   time.Time
    ChangedBy     string  // agentID of hegemony holder
}

type NationStats struct {
    Happiness        float64  // 0-100
    BirthRate        float64  // 0.5-4.0
    GDP              float64  // $0-∞
    MilitaryPower    float64  // 0-100
    TechLevel        float64  // 0-100
    Loyalty          float64  // 0-100
    Population       float64  // calculated
    InternationalRep float64  // -100 to +100
}
```

**Stat calculation**: Each policy category contributes weighted modifiers to stats. Stats have feedback loops (Happiness↑ → BirthRate↑ → Population↑ → GDP↑). Recalculated at epoch end (combat metrics) and hourly (full policy recalc).

### 4.8 WarSystem (new)

**File**: `server/internal/game/war.go`, `war_state.go`

```go
type WarSystem struct {
    activeWars  map[string]*War       // warID → War
    alliances   map[string]*Alliance  // allianceID → Alliance
}

type War struct {
    ID             string
    AttackerISO    string
    DefenderISO    string
    State          WarState   // Declared→Preparation(24h)→Active(≤72h)→Resolved
    DeclaredAt     time.Time
    ActiveAt       time.Time
    Score          map[string]int  // ISO3 → war score
    Participants   map[string]WarRole  // ISO3 → attacker/defender/ally
}

type WarState int
const (
    WarDeclared    WarState = iota  // Just declared, 24hr prep
    WarPreparation                   // 24hr warning period
    WarActive                        // PvP cross-arena enabled (max 72hr)
    WarResolved                      // Winner decided, rewards applied
)

type Alliance struct {
    ID       string
    Members  []string   // ISO3 codes (max 5)
    FormedAt time.Time
}
```

**War flow**:
1. Hegemony nation (or 3+ alliance) sends `declare_war`
2. 24hr preparation: globe arc line, notification to both nations
3. Active: cross-arena invasion enabled (capacity +20), war-specific scoring
4. Resolution: 3× score gap = auto-surrender; or 72hr timeout → highest score wins
5. Rewards: winner +30% GDP, +20% military; loser -30% GDP, -20% military
6. 24hr cooldown before next war

### 4.9 NPC Monster System (new)

**File**: `server/internal/game/npc_monster.go`

```go
type NPCManager struct {
    monsters map[string]*Monster  // monsterID → Monster
    spawnTimer int                // ticks until next spawn wave
}

type Monster struct {
    ID       string
    Type     MonsterType  // Weak(20XP,50HP), Medium(35XP,100HP), Strong(50XP,200HP)
    Position domain.Position
    HP       float64
    Speed    float64
    Alive    bool
}
```

**Behavior**: Spawn during peace phase only (30s intervals, 5-10 per wave). Random movement + flee from players. Drop XP orbs on death. Despawn at war phase start.

### 4.10a Matchmaking & Bot Filling

**Arena entry**: Globe click → `join_country_arena` → WorldManager routes to CountryArena (lazy init if needed). Arena cap = 50 human players. Overflow → queue with 30s polling for free slots.

**Bot filling**: `BotManager` (extended) maintains minimum 10 agents per arena. Bot nationality = arena's country + neighboring countries (weighted random). Bot weapon AI: random weapon selection, basic positioning (flee low HP, chase low HP targets). Bots obey epoch rules (no PvP damage in peace phase).

### 4.10 CapturePointSystem (new)

**File**: `server/internal/game/capture_point.go`

```go
type CapturePointSystem struct {
    points [3]*CapturePoint  // 3 per arena: Resource, Buff, Healing
}

type CapturePoint struct {
    Type         CaptureType  // Resource(+5XP/s), Buff(+10%DMG), Healing(+3HP/s)
    Position     domain.Position
    Owner        string       // ISO3 of capturing nation (empty = neutral)
    CaptureTimer int          // ticks of continuous capture progress (5s = 100 ticks)
    HoldTimer    int          // ticks remaining (2min = 2400 ticks)
    Contested    bool         // enemy in range = capture paused
}
```

### 4.11 Scoring System (rewrite)

**File**: `server/internal/game/scoring.go`

```go
type ScoringSystem struct {
    assists map[string][]AssistRecord  // victimID → recent damage dealers (5s window)
}

type KillReward struct {
    XP          int  // 100 + victimLevel × 10
    Gold        int  // 50 + victimLevel × 5
    NationScore int  // 10 + victimLevel × 2
    OrbDrop     int  // 20% of victim's XP as orb
}

type AssistRecord struct {
    AttackerID string
    Damage     float64
    Tick       uint64
}
```

**Anti-snowball mechanics**:
- Underdog bonus: level difference × 20% extra XP when lower kills higher
- Bounty system: 5+ kill streak → position revealed on minimap, 3× reward for killing
- Peace phase NPC farming ensures minimum leveling regardless of PvP skill

## 5. Data Flow & Sequence Diagrams

### 5.1 Core Game Loop (20Hz Tick)

```
Arena.Tick() [every 50ms]
  │
  ├─ 1. Process inputs (angle, boost, dash)
  │     └─ ApplyInput() for each agent
  │
  ├─ 2. Update agent positions
  │     └─ UpdateAgent() — heading, movement, terrain mods
  │
  ├─ 3. EpochManager.Tick()
  │     ├─ Check state transitions (peace→war, war→shrink, etc.)
  │     ├─ Toggle pvpEnabled flag
  │     └─ Update shrink radius if active
  │
  ├─ 4. NPC Manager (peace phase only)
  │     ├─ Spawn wave check (30s interval)
  │     ├─ Update NPC movement (flee from players)
  │     └─ Check NPC deaths → drop XP orbs
  │
  ├─ 5. WeaponSystem.Tick() [if any agents have weapons]
  │     ├─ For each agent, for each weapon slot:
  │     │   ├─ Decrement cooldown
  │     │   ├─ If cooldown == 0 AND pvpEnabled (or NPC target):
  │     │   │   ├─ Select targets via SpatialHash (range + angle)
  │     │   │   ├─ CombatResolver.ResolveHit() per target
  │     │   │   ├─ Apply status effects (DOT, slow, stun, knockback)
  │     │   │   └─ Emit weapon_fired event
  │     │   └─ Reset cooldown
  │     └─ Tick all active status effects (DOT damage, slow decay, stun expire)
  │
  ├─ 6. CapturePointSystem.Tick()
  │     ├─ Check agent proximity to capture points
  │     ├─ Progress/regress capture timers
  │     └─ Apply capture bonuses to qualifying agents
  │
  ├─ 7. RespawnManager.Tick()
  │     ├─ Check dead agents for respawn timer expiry
  │     ├─ Execute respawn (random pos, full HP, speed penalty)
  │     └─ Check invincibility timer expiry
  │
  ├─ 8. OrbManager.Tick()
  │     ├─ Spawn new orbs (enhanced rate in peace phase)
  │     ├─ Check agent-orb collisions (Magnet passive extends range)
  │     └─ Award XP/Gold
  │
  ├─ 9. SkillTreeManager.CheckLevelUps()
  │     ├─ For agents with XP >= XPToNext
  │     ├─ Generate 3 choices, emit level_up_choices
  │     └─ Apply timeout auto-select
  │
  ├─ 10. SpatialHash rebuild
  │
  ├─ 11. CollisionSystem.ProcessBoundaryCollisions() [kept for arena boundary]
  │
  └─ 12. Serialize state → broadcast to clients (20Hz)
```

### 5.2 Epoch Lifecycle Sequence

```
  Client                    Server (EpochManager)              DominationEngine
    │                            │                                   │
    │    epoch_start(peace,1)    │                                   │
    │◄───────────────────────────│                                   │
    │                            │                                   │
    │    [5 minutes: PvP OFF, farm orbs, kill NPCs]                 │
    │                            │                                   │
    │  war_phase_start(countdown)│                                   │
    │◄───────────────────────────│                                   │
    │                            │                                   │
    │    [3 second countdown]    │                                   │
    │                            │                                   │
    │  war_phase_start(active)   │                                   │
    │◄───────────────────────────│                                   │
    │                            │                                   │
    │    [3 minutes: PvP ON, full combat, kill rewards]             │
    │                            │                                   │
    │  arena_shrink(start)       │                                   │
    │◄───────────────────────────│                                   │
    │                            │                                   │
    │    [2 minutes: PvP ON + shrink 3000→1000px]                   │
    │                            │                                   │
    │  epoch_end(scores, MVP)    │                                   │
    │◄───────────────────────────│                                   │
    │                            │──[if epoch 6]──────────────────→  │
    │                            │                    evaluate()     │
    │                            │◄─── domination_result ───────────│
    │                            │                                   │
    │  domination_update(result) │                                   │
    │◄───────────────────────────│                                   │
    │                            │  [reset all agents to Lv1]       │
    │  epoch_start(peace, 1)     │  [next 1hr session begins]      │
    │◄───────────────────────────│                                   │
```

### 5.3 Kill → Reward → Respawn Sequence

```
  Attacker          Server                   Victim          Client(Victim)
    │                  │                        │                │
    │  weapon fires    │                        │                │
    │─────────────────→│                        │                │
    │                  │  ResolveHit()          │                │
    │                  │  HP -= damage          │                │
    │                  │  if HP <= 0:           │                │
    │                  │    mark Alive=false    │                │
    │                  │    KillReward(attacker)│                │
    │                  │    record death        │                │
    │                  │                        │                │
    │  kill event      │  death event          │                │
    │◄─────────────────│───────────────────────→│                │
    │                  │                        │  death overlay │
    │                  │                        │───────────────→│
    │                  │                        │                │
    │                  │  [3 seconds wait]      │                │
    │                  │                        │                │
    │                  │  RespawnManager:       │                │
    │                  │    Alive=true          │                │
    │                  │    random position     │                │
    │                  │    HP=maxHP            │                │
    │                  │    invincible=5s       │                │
    │                  │    speed=-30% (2s)     │                │
    │                  │                        │                │
    │                  │  respawn event         │                │
    │                  │───────────────────────→│                │
    │                  │                        │  respawn glow  │
    │                  │                        │───────────────→│
```

### 5.4 War Declaration → Resolution Sequence

```
  Hegemon Client      Server (WarSystem)        Target Nation       Globe Clients
    │                      │                         │                    │
    │  declare_war(target) │                         │                    │
    │─────────────────────→│                         │                    │
    │                      │ validate:               │                    │
    │                      │   hegemony? ✓           │                    │
    │                      │   cooldown? ✓           │                    │
    │                      │   same continent? ✓     │                    │
    │                      │                         │                    │
    │                      │  war_declared           │  war_declared      │
    │                      │────────────────────────→│──────────────────→│
    │                      │                         │                    │
    │                      │  [24 hour preparation]  │  arc line + flash │
    │                      │                         │                    │
    │                      │  war_active             │                    │
    │                      │────────────────────────→│──────────────────→│
    │                      │                         │                    │
    │                      │  [cross-arena enabled, max 72hr]           │
    │                      │  war_score_update       │                    │
    │                      │────────────────────────→│──────────────────→│
    │                      │                         │                    │
    │                      │  [3× score gap OR 72hr timeout]            │
    │                      │                         │                    │
    │                      │  war_ended(winner,loser)│                    │
    │                      │────────────────────────→│──────────────────→│
    │                      │  apply rewards/penalties│  fireworks/fade   │
    │                      │  24hr war cooldown      │                    │
```

## 6. WebSocket Protocol Specification

### 6.1 Existing Events (Preserved)

| Direction | Event | Description | Changes in v14 |
|-----------|-------|-------------|-----------------|
| C→S | `join_room` | Join arena | Add `nationality` field |
| C→S | `leave_room` | Leave arena | Unchanged |
| C→S | `input` | Movement (30Hz) | Add `dash` boolean |
| C→S | `ping` | Latency check | Unchanged |
| C→S | `choose_upgrade` | Select upgrade | Payload changed (weapon/passive/synergy) |
| S→C | `joined` | Join confirmed | Add `epoch_state`, `nation_scores` |
| S→C | `state` | Game state (20Hz) | Add weapon VFX, HP bars, epoch timer |
| S→C | `death` | Agent died | Add `respawn_in` countdown |
| S→C | `kill` | Agent killed | Add `rewards` object |
| S→C | `minimap` | Minimap (1Hz) | Add capture points, bounty markers |
| S→C | `pong` | Latency reply | Unchanged |
| S→C | `level_up` | Level up choices | Payload changed (weapon/passive/synergy cards) |
| S→C | `arena_shrink` | Shrink warning | Unchanged |

### 6.2 New Events — Epoch System

| Direction | Event | Payload | Frequency |
|-----------|-------|---------|-----------|
| S→C | `epoch_start` | `{ epoch: int, phase: "peace"\|"war", session: int }` | Every 10 min |
| S→C | `epoch_end` | `{ scores: NationScore[], mvp: AgentID, personal: Stats }` | Every 10 min |
| S→C | `war_phase_start` | `{ countdown: 3, shrinkAt: timestamp }` | Every epoch at 5:00 |
| S→C | `war_phase_end` | `{}` | Every epoch at 10:00 |
| S→C | `session_reset` | `{ reason: "6_epochs_complete", newSession: int }` | Every 1 hr |

### 6.3 New Events — Combat & Weapons

| Direction | Event | Payload | Frequency |
|-----------|-------|---------|-----------|
| S→C | `weapon_fired` | `{ agentId, weaponType, targets[], position }` | Per fire (batched in state) |
| S→C | `damage_dealt` | `{ targetId, damage, isCrit, isDOT, weaponType }` | Per hit (batched) |
| S→C | `respawn` | `{ agentId, position, invincibleUntil }` | Per respawn |
| S→C | `status_effect` | `{ targetId, effect: "burn"\|"slow"\|"stun", duration }` | Per effect application |
| S→C | `weapon_acquired` | `{ agentId, weaponType, level }` | Per acquisition |
| S→C | `synergy_activated` | `{ agentId, synergyType, effectDesc }` | Per activation |
| S→C | `bounty_placed` | `{ agentId, streakCount, reward }` | Per 5+ killstreak |

### 6.4 New Events — Domination & Civilization

| Direction | Event | Payload | Frequency |
|-----------|-------|---------|-----------|
| S→C | `domination_update` | `{ country, newDominator, sovereignty, hegemony }` | Per eval (1hr) |
| S→C | `nation_stats_update` | `{ country, stats: NationStats }` | Per epoch end |
| S→C | `policy_changed` | `{ country, category, oldLevel, newLevel, effectDesc }` | On change |
| C→S | `select_nationality` | `{ nationality: "KOR" }` | Once at join |
| C→S | `set_policy` | `{ country, category, level }` | Hegemony only, weekly |
| S→C | `global_events` | `{ events: [{type, message, countries, timestamp}] }` | Batched 5s |

### 6.5 New Events — War

| Direction | Event | Payload | Frequency |
|-----------|-------|---------|-----------|
| C→S | `declare_war` | `{ target: "JPN" }` | Hegemony only |
| S→C | `war_declared` | `{ attacker, defender, prepEndsAt }` | On declaration |
| S→C | `war_active` | `{ warId, attacker, defender, maxDuration }` | On activation |
| S→C | `war_score_update` | `{ warId, scores: {ISO3: int} }` | Every epoch during war |
| S→C | `war_ended` | `{ warId, winner, loser, rewards, penalties }` | On resolution |
| S→C | `capture_point_update` | `{ pointId, owner, progress, contested }` | Per state change |

### 6.6 State Frame Encoding (20Hz)

The existing `state` frame is extended with new fields. To maintain < 2KB per frame with 50 agents:

```typescript
interface StateFrame {
  // Existing (preserved)
  agents: AgentState[];     // position, heading, alive, level, name, appearance
  orbs: OrbState[];         // position, value, type
  radius: number;           // current arena radius
  tick: number;

  // New (v14)
  epoch: {
    number: number;         // 1-6
    phase: "peace" | "war"; // current phase
    timeLeft: number;       // seconds remaining in current phase
    shrinkRadius?: number;  // only during shrink
  };
  weaponFX: WeaponFXState[]; // batched weapon fire events this tick (max 20)
  capturePoints: CapturePointState[]; // 3 points, only when changed
  nationScores?: NationScoreState[];  // only at epoch transitions
}

// Per-agent extension (appended to existing agent serialization)
interface AgentStateV14 {
  hp: number;              // 0-maxHP (replaces mass for display)
  maxHp: number;
  weapons: number[];       // equipped weapon type IDs (max 5)
  invincible: boolean;     // respawn invincibility
  nationality: string;     // ISO3
  statusEffects: number[]; // active effect type IDs
  bounty: boolean;         // has active bounty
}
```

**NPC state** (peace phase only, appended to state frame):
```typescript
interface NPCState {
  id: string;
  type: 0 | 1 | 2;   // weak, medium, strong
  x: number;
  y: number;
  hp: number;
}
```

**Bandwidth optimization**: `weaponFX` array is delta-compressed (only new fires since last frame). `capturePoints` only sent on state change. `nationScores` only at epoch end. `npcs` only during peace phase (up to 15 NPCs × 20B = 300B).

## 7. Data Model

### 7.1 Server-Side Domain Types (Go)

#### Agent (Extended)

```go
// domain.Agent — extended for v14
type Agent struct {
    // --- Preserved from v10/v11 ---
    ID            string
    Name          string
    Position      Position
    Heading       float64
    TargetAngle   float64
    Speed         float64
    Alive         bool
    Skin          AgentSkin
    Appearance    string
    Score         int
    Kills         int
    IsBot         bool
    GracePeriodEnd uint64

    // --- REMOVED in v14 ---
    // Mass float64          → replaced by HP
    // Build PlayerBuild     → replaced by AgentBuild (below)
    // XP, Level, XPToNext   → moved to AgentBuild

    // --- NEW in v14 ---
    HP            float64           // Current HP (base 100, Vigor scales)
    MaxHP         float64           // Max HP = 100 + level*10 + Vigor stacks*15%
    Nationality   string            // ISO3 code (required at join)
    Boosting      bool              // dash state
    DashCooldown  int               // ticks remaining
    Invincible    bool              // respawn invincibility
    InvincibleEnd uint64            // tick when invincibility expires
    SpeedPenalty  float64           // post-respawn speed reduction (decays)

    // Build (v14 skill tree)
    Build         AgentBuild

    // Combat tracking
    LastDamagedBy  string           // for kill attribution
    KillStreak     int              // for bounty system
    Deaths         int              // total deaths this session
    Assists        int
    DamageDealt    float64          // total damage this epoch
    HealingDone    float64          // from Soul Drain
}
```

#### Weapon Definitions

```go
type WeaponDef struct {
    Type          WeaponType
    Name          string
    Pattern       FiringPattern    // Fan, Chain, Ring, Salvo, Teleport, AOE, Cloud, Orbit, Bomb, Beam
    BaseDPS       float64
    Range         float64          // px
    CooldownSec   float64          // seconds between fires
    CooldownTicks int              // pre-calculated: CooldownSec * TickRate
    Knockback     float64          // px displacement on hit
    SpecialEffect SpecialEffect    // DOT, Slow, Stun, Lifesteal, Reflect, Pull, None

    // Evolution data
    Evolution [5]WeaponEvolution   // Lv1-5 multipliers
    UltimateName string            // Lv5 transformation name
}

type FiringPattern int
const (
    PatternFan120     FiringPattern = iota  // 120° front arc
    PatternChain3                            // nearest → chain 3
    PatternRing360                           // expanding circle
    PatternSalvo5                            // 5 projectiles 45° cone
    PatternTeleport                          // teleport behind target
    PatternTargetAOE                         // AOE on specific target
    PatternPlaced                            // stationary zone
    PatternOrbit                             // rotating around agent
    PatternBomb                              // delayed explosion
    PatternBeam                              // continuous beam
)
```

### 7.2 In-Memory State (per CountryArena)

| Data Structure | Key | Value | Size Estimate |
|---------------|-----|-------|-------------|
| `agents` | agentID | `*Agent` | ~2KB × 50 = 100KB |
| `weaponSlots` | agentID | `[]*WeaponSlot` | ~200B × 50 = 10KB |
| `statusEffects` | agentID | `[]StatusEffect` | ~100B × 50 = 5KB |
| `npcs` | monsterID | `*Monster` | ~100B × 15 = 1.5KB |
| `capturePoints` | index | `*CapturePoint` | ~200B × 3 = 600B |
| `epochScores` | nationISO | `*NationEpochScore` | ~100B × 10 = 1KB |
| `assists` | victimID | `[]AssistRecord` | ~50B × 20 = 1KB |
| **Total per arena** | | | **~120KB** |

### 7.3 Redis Keys (per country)

```
# Domination state
dom:{ISO3}:dominator        → string (ISO3)
dom:{ISO3}:since            → timestamp
dom:{ISO3}:sovereignty      → bool
dom:{ISO3}:hegemony         → bool

# Nation stats
stats:{ISO3}:happiness      → float64
stats:{ISO3}:birthrate      → float64
stats:{ISO3}:gdp            → float64
stats:{ISO3}:military       → float64
stats:{ISO3}:tech           → float64
stats:{ISO3}:loyalty        → float64
stats:{ISO3}:population     → float64
stats:{ISO3}:reputation     → float64

# Policy
policy:{ISO3}:religion      → int (0-2)
policy:{ISO3}:language       → int (0-2)
... (10 categories)
policy:{ISO3}:lastChanged   → timestamp
policy:{ISO3}:changedBy     → agentID

# War state
war:{warID}:state           → string (declared/prep/active/resolved)
war:{warID}:attacker        → ISO3
war:{warID}:defender        → ISO3
war:{warID}:scores          → hash {ISO3: int}

# Alliance
alliance:{allianceID}:members → set of ISO3

# Event log (circular buffer, last 100)
events:global               → list of JSON events
```

### 7.4 Shared Types (TypeScript)

```typescript
// packages/shared/src/types/weapons.ts
export enum WeaponType {
  BonkMallet = 0,
  ChainBolt = 1,
  FlameRing = 2,
  FrostShards = 3,
  ShadowStrike = 4,
  ThunderClap = 5,
  VenomCloud = 6,
  CrystalShield = 7,
  GravityBomb = 8,
  SoulDrain = 9,
}

export enum PassiveType {
  Vigor = 0, Swift = 1, Fury = 2, IronSkin = 3, Magnet = 4,
  Fortune = 5, Vitality = 6, Precision = 7, Blast = 8, Haste = 9,
}

export enum SynergyType {
  ThermalShock = 0, AssassinsMark = 1, Fortress = 2, Corruption = 3,
  ThunderGod = 4, GravityMaster = 5, Berserker = 6, IronMaiden = 7,
  GlassCannon = 8, Speedster = 9,
}

export interface WeaponFXState {
  agentId: string;
  weaponType: WeaponType;
  targetIds: string[];
  position: { x: number; y: number };
}

export interface EpochState {
  number: number;           // 1-6
  session: number;
  phase: 'peace' | 'war_countdown' | 'war' | 'shrink' | 'end' | 'transition';
  timeLeftSec: number;
  pvpEnabled: boolean;
}

// packages/shared/src/types/domination.ts
export interface DominationState {
  country: string;          // ISO3
  dominator: string;        // ISO3 (empty = none)
  dominatorName: string;
  sovereignty: boolean;
  hegemony: boolean;
  dominationDays: number;   // consecutive days
}

export interface NationStatsState {
  happiness: number;
  birthRate: number;
  gdp: number;
  militaryPower: number;
  techLevel: number;
  loyalty: number;
  population: number;
  internationalRep: number;
}
```

## 8. Frontend Architecture

### 8.1 Component Hierarchy (R3F Game View)

```
GameCanvas3D.tsx (existing, extended)
├── Scene.tsx
│   ├── SkyDome.tsx (existing)
│   ├── VoxelTerrain.tsx (existing)
│   ├── ZoneTerrain.tsx (existing)
│   ├── ArenaBoundary.tsx (existing — epoch shrink integration)
│   ├── AgentInstances.tsx (EXTENDED — HP bars, nationality flag, status FX)
│   ├── OrbInstances.tsx (existing)
│   ├── WeaponRenderer.tsx (NEW — 10 weapon VFX)
│   │   ├── BonkMalletFX (fan slash mesh)
│   │   ├── ChainBoltFX (line segments + glow)
│   │   ├── FlameRingFX (expanding torus particles)
│   │   ├── FrostShardsFX (instanced projectiles)
│   │   ├── ShadowStrikeFX (teleport trail + ghost)
│   │   ├── ThunderClapFX (cylinder + sparks)
│   │   ├── VenomCloudFX (billboarded cloud sprite)
│   │   ├── CrystalShieldFX (orbiting icosahedrons)
│   │   ├── GravityBombFX (distortion sphere + particles)
│   │   └── SoulDrainFX (beam + heal particles)
│   ├── DamageNumbers.tsx (NEW — InstancedMesh floating text)
│   ├── FlagSprite.tsx (NEW — Billboard 16×16 flags per agent)
│   ├── CapturePointRenderer.tsx (NEW — 3 points with beam + circle)
│   ├── NPCInstances.tsx (NEW — monster rendering, peace phase only)
│   ├── StatusEffectVFX.tsx (NEW — burn/ice/stun overlays on agents)
│   └── MapStructures.tsx (existing)
├── PlayCamera.tsx (existing)
└── GameLoop.tsx (EXTENDED — weapon system + epoch state integration)

// HTML Overlay (DOM, positioned over canvas)
├── EpochHUD.tsx (NEW — replaces RoundTimerHUD)
│   ├── EpochTimer (MM:SS + phase label)
│   ├── PhaseIndicator (PEACE / WAR badge with color)
│   ├── KillDeathCounter (K/D/A inline)
│   └── NationScoreMini (your nation rank)
├── BuildHUD.tsx (EXTENDED — weapon icons with levels + passive stacks)
├── LevelUpOverlay.tsx (REWRITE — 3 cards: weapon/passive/synergy)
├── ScoreboardOverlay.tsx (NEW — Tab key, full player+nation ranking)
├── DeathOverlay.tsx (EXTENDED — 3s respawn timer, killcam info)
├── ShrinkWarning.tsx (existing)
├── MinimapHUD.tsx (EXTENDED — capture points, bounty markers)
├── KillFeedHUD.tsx (existing)
├── SpectatorMode.tsx (existing, minor extensions)
└── SynergyPopup.tsx (existing, new synergy names)
```

### 8.2 New React Hooks

```typescript
// hooks/useEpoch.ts — Epoch state management
export function useEpoch(socket: Socket) {
  const [epoch, setEpoch] = useState<EpochState>(defaultEpoch);
  const [scores, setScores] = useState<NationScore[]>([]);

  // Listen: epoch_start, epoch_end, war_phase_start, war_phase_end, session_reset
  // Expose: epoch, scores, isWarPhase, timeLeft, currentSession
}

// hooks/useWeapons.ts — Weapon VFX queue
export function useWeapons(socket: Socket) {
  const fxQueue = useRef<WeaponFXState[]>([]);

  // Listen: weapon_fired events from state frames
  // Expose: fxQueue (consumed by WeaponRenderer each frame)
}

// hooks/useDomination.ts — Globe domination state
export function useDomination(socket: Socket) {
  const [countries, setCountries] = useState<Map<string, DominationState>>();

  // Listen: domination_update, nation_stats_update, war_declared, war_ended
  // Expose: countries, activeWars, alliances
}

// hooks/useCivilization.ts — Policy & stats
export function useCivilization(socket: Socket, countryISO: string) {
  const [policy, setPolicy] = useState<CountryPolicy>();
  const [stats, setStats] = useState<NationStatsState>();

  // Listen: policy_changed, nation_stats_update
  // Expose: policy, stats, setPolicy (C→S set_policy)
}
```

### 8.3 Globe View Extensions

```
GlobeScene.tsx (existing three-globe)
├── GlobeDominationLayer.tsx (NEW — country mesh colors from domination state)
│   ├── Color mapping: none=#666, dominated=nation color, sovereignty=pulse, hegemony=gold glow
│   └── Transition: 2s color fade on dominator change
├── GlobeWarEffects.tsx (NEW — war visual effects)
│   ├── ArcLine: red dashed arc between warring nations
│   ├── BorderFlash: edge flash at 0.5Hz
│   ├── ArrowParticles: moving arrows on arc (invasion direction)
│   ├── ExplosionParticles: random bursts at border
│   └── VictoryFireworks: gold particle burst on war end
├── GlobeHoverPanel.tsx (NEW — country info on hover)
│   └── Shows: flag, name, dominator, 4 key stats, war status, "click to enter"
├── EventTicker.tsx (NEW — rolling news band below header)
│   └── global_events → animated text ticker with country flags
└── NationalitySelector.tsx (NEW — 195 country dropdown with search)

// Lobby page extensions
LobbyHeader.tsx (existing — add EventTicker below)
CountryPanel.tsx (existing — add CIVILIZATION tab)
├── PolicyManager.tsx (NEW — 10 policy cards, hegemony-only edit)
└── StatsChart.tsx (NEW — 8 gauge bars with trend arrows)
```

### 8.4 Performance Strategy — Weapon VFX

| Weapon | Render Strategy | Pool Size | LOD Distance |
|--------|----------------|-----------|-------------|
| BonkMallet | InstancedMesh (arc geometry) | 50 | 200px: full → 400px: flash only |
| ChainBolt | LineSegments + PointLight | 30 | 200px: lines → 300px: flash |
| FlameRing | Instanced particles (ring) | 40 | 150px: full → 300px: glow |
| FrostShards | Instanced small meshes | 60 | 200px: meshes → 350px: flash |
| ShadowStrike | Ghost mesh + trail | 20 | 150px: full → 250px: flash |
| ThunderClap | CylinderGeometry + sparks | 30 | 250px: full → 400px: flash |
| VenomCloud | Billboard sprite | 20 | 200px: full → 350px: tint |
| CrystalShield | Instanced icosahedron orbit | 40 | 150px: full → 250px: glow |
| GravityBomb | Sphere + distortion shader | 20 | 250px: full → 400px: flash |
| SoulDrain | Line + heal particles | 30 | 200px: beam → 300px: flash |

**Total particle budget**: 1000 active particles max. Objects beyond LOD distance render as a single colored flash (1 frame, 1 draw call).

### 8.5 Rendering Pipeline per Frame

```
useFrame (priority 0, mount order)
  1. GameLoop.tsx:
     ├── Read socket state buffer
     ├── Interpolate agent positions (lerp 3 frames)
     ├── Update weapon FX queue
     └── Update epoch timer (client-side prediction)

  2. WeaponRenderer.tsx:
     ├── Consume FX queue
     ├── Spawn new VFX instances from pool
     ├── Update active VFX (position, lifetime, LOD cull)
     └── Return expired VFX to pool

  3. DamageNumbers.tsx:
     ├── Spawn numbers from damage events
     ├── Animate float-up + fade-out (1s lifetime)
     └── Recycle InstancedMesh slots

  4. AgentInstances.tsx:
     ├── Update instance matrices (position, rotation, scale)
     ├── Update HP bar UVs
     ├── Update flag sprite UVs (nationality atlas)
     └── Update status effect overlays (burn/ice/stun tint)

  5. PlayCamera.tsx:
     ├── Lerp to player position
     └── Dynamic zoom based on combat density
```

## 9. Security & Anti-Cheat

### 9.1 Server-Authoritative Design

All game logic is server-side. The client sends only:
- **Input**: angle (float64), boost (bool), dash (bool) — at 30Hz
- **Choices**: choose_upgrade (int), set_policy (int, int), declare_war (string)

The server **never trusts** client-reported positions, HP, damage, kills, or weapon state.

### 9.2 Input Validation

| Input | Validation | Rejection |
|-------|-----------|-----------|
| `angle` | Must be float64 in [0, 2π) | Silently normalize |
| `boost` | Boolean only | Ignore non-bool |
| `dash` | Boolean; server checks cooldown | Ignore if on cooldown |
| `choose_upgrade` | Must be 0-2 (valid choice index) | Auto-select 0 |
| `select_nationality` | Must be valid ISO3 code | Reject join |
| `set_policy` | Must be hegemony holder + weekly limit | Reject with error |
| `declare_war` | Must be hegemony + valid target + cooldown | Reject with error |

### 9.3 Rate Limiting

| Event | Rate Limit | Window |
|-------|-----------|--------|
| `input` | 35/s (30Hz + jitter) | 1 second |
| `choose_upgrade` | 5/min | 1 minute |
| `join_room` | 3/min | 1 minute |
| `set_policy` | 1/week | 7 days |
| `declare_war` | 1/24hr | 24 hours |

### 9.4 Anti-Cheat Measures

| Threat | Mitigation |
|--------|-----------|
| **Speed hack** | Server calculates position from speed constants; client position ignored |
| **Damage hack** | All damage calculated server-side via WeaponSystem |
| **Cooldown bypass** | Weapon cooldowns tracked on server; client VFX are cosmetic |
| **HP manipulation** | HP only modified by server CombatResolver |
| **Score inflation** | Kill/XP/Gold awarded only on server-confirmed kills |
| **Nationality spoofing** | Nationality locked at join, verified against ISO3 list |
| **Policy abuse** | Hegemony status + weekly limit checked server-side |
| **War declaration spam** | Cooldown + hegemony check + alliance validation |
| **Bot farming** | Diminishing XP returns after 50 NPC kills per peace phase |

## 10. Scalability & Performance Budget

### 10.1 Server Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Tick latency** | < 50ms (20Hz) | time(Arena.Tick()) with 50 agents |
| **Weapon system** | < 15ms per tick | time(WeaponSystem.Tick()) with 50 agents × 5 weapons |
| **Memory per arena** | < 200KB | In-memory agent+weapon+NPC+epoch state |
| **Max concurrent arenas** | 50 (pool limit from ADR-027) | WorldManager lazy init |
| **Total server memory** | < 512MB | 50 arenas × 200KB + overhead |
| **WebSocket bandwidth** | < 50KB/s per client | State frames + events |

### 10.2 Tick Budget Breakdown (50ms total)

```
Budget Allocation (50 agents, worst case war phase):
  Input processing:              1ms
  Agent position update:         2ms
  EpochManager state check:      0.5ms
  WeaponSystem.Tick():          15ms  ← hottest path
    ├─ Cooldown check:           1ms
    ├─ SpatialHash queries:      5ms  (50 agents × 5 weapons × range check)
    ├─ Damage calculation:       4ms  (resolve hits + status effects)
    └─ Event buffering:          5ms
  CapturePoint check:            1ms
  RespawnManager check:          0.5ms
  OrbManager:                    2ms
  SkillTree level-up check:      1ms
  SpatialHash rebuild:           2ms
  Boundary collisions:           1ms
  State serialization:           5ms
  Broadcast (write to WS):       5ms
  ─────────────────────────────────
  Total:                        ~36ms (28% headroom)
```

### 10.3 Client Performance Targets

| Metric | Target | Strategy |
|--------|--------|---------|
| **FPS** | 60 (50 agents + weapon VFX) | InstancedMesh, particle pools, LOD |
| **Draw calls** | < 80 per frame | Instancing, atlas textures, merged geometries |
| **Triangles** | < 100K per frame | Low-poly cubeling + simple weapon meshes |
| **JavaScript heap** | < 150MB | Object pooling, typed arrays for buffers |
| **Network parse time** | < 2ms per state frame | Pre-allocated JSON parsing |
| **WebGL context memory** | < 300MB | Texture atlases, shared materials |

### 10.4 Weapon VFX Performance Budget

```
Max active VFX per frame: 1000 particles / effects
Particle pool pre-allocation: 2000 (double buffer)

Per-weapon instance limits:
  BonkMallet:    50 active (1 frame lifetime)
  ChainBolt:     30 active (3 frame lifetime)
  FlameRing:     40 active (10 frame lifetime)
  FrostShards:   60 active (5 frame lifetime)
  ShadowStrike:  20 active (5 frame lifetime)
  ThunderClap:   30 active (3 frame lifetime)
  VenomCloud:    20 active (100 frame lifetime = 5s)
  CrystalShield: 40 active (continuous)
  GravityBomb:   20 active (40 frame lifetime = 2s)
  SoulDrain:     30 active (continuous while firing)
```

### 10.5 Arena Lifecycle (Memory Management)

```
WorldManager arena pool (max 50):
  1. Player clicks country → WorldManager.GetOrCreateArena(ISO3)
  2. If pool < 50: create new CountryArena (lazy init)
  3. If pool == 50: queue player, check for idle arenas
  4. Arena idle (0 human players) for 60s → arena.Shutdown()
     ├─ Flush epoch scores to DominationEngine
     ├─ Save nation stats to Redis
     └─ Release all Go memory (agents, weapons, NPCs, orbs)
  5. Pool slot freed for next request

Memory lifecycle:
  Active arena:   ~200KB
  Idle arena:     0KB (fully deallocated)
  Redis overhead: ~2KB per country (stats + domination keys)
```

### 10.6 Network Bandwidth Breakdown

```
Per-client (50 agents in arena):
  State frame (20Hz):
    50 agents × 30B = 1500B + epoch(20B) + weaponFX(~200B) = ~1.7KB
    1.7KB × 20Hz = 34 KB/s

  Events (variable):
    kill/death/respawn: ~100B × 2/s = 200 B/s
    level_up/weapon: ~200B × 0.1/s = 20 B/s
    epoch transitions: ~500B × 0.01/s = 5 B/s

  Client input (30Hz):
    angle(8B) + boost(1B) + dash(1B) + overhead(10B) = 20B
    20B × 30Hz = 600 B/s (upload)

  Total download: ~35 KB/s (within 50KB/s target)
  Total upload: ~0.6 KB/s
```

## 11. Observability

### 11.1 Metrics (Prometheus)

| Metric | Type | Labels | Purpose |
|--------|------|--------|---------|
| `arena_tick_duration_ms` | Histogram | `country` | Tick performance per arena |
| `weapon_fires_total` | Counter | `weapon_type` | Weapon usage balance |
| `kills_total` | Counter | `weapon_type, country` | Kill attribution |
| `respawns_total` | Counter | `country` | Respawn frequency |
| `epoch_duration_seconds` | Histogram | `country, phase` | Epoch timing accuracy |
| `domination_changes_total` | Counter | `country` | Domination volatility |
| `war_declarations_total` | Counter | `attacker, defender` | War frequency |
| `active_arenas` | Gauge | — | Arena pool utilization |
| `agents_per_arena` | Gauge | `country` | Player distribution |
| `ws_bytes_sent` | Counter | `event_type` | Bandwidth per event type |
| `level_up_choices` | Counter | `choice_type` | Weapon vs passive preference |
| `synergy_activations` | Counter | `synergy_type` | Synergy popularity |

### 11.2 Structured Logging

```go
// All game events logged with structured fields for debugging
slog.Info("weapon_fired",
    "agent_id", attacker.ID,
    "weapon", weapon.Type,
    "targets", targetIDs,
    "damage", totalDamage,
    "epoch", epoch.Number,
    "country", arena.CountryISO,
)

slog.Info("domination_change",
    "country", country.ISO3,
    "old_dominator", oldDom,
    "new_dominator", newDom,
    "score_diff", scoreDiff,
)
```

### 11.3 Balance Analytics

The balance simulation tool (`server/cmd/balance/main.go`) outputs:
- **Weapon win rates** per 1000 bot matches (target: 8-12% each, +-2%)
- **Synergy effectiveness** (win rate delta when synergy active)
- **Level curve analysis** (actual time-to-level vs target)
- **Build diversity index** (Shannon entropy of final builds)
- **Snowball coefficient** (correlation between lead at 5min and final win)

## 12. ADR Summary

### ADR-034: EpochManager Replaces Room State Machine

- **Status**: Proposed
- **Context**: v10 Room uses a 5-state machine (waiting→countdown→playing→ending→cooldown) for 5-minute rounds. v14 needs a 6-state, 10-minute cycle with peace/war phases.
- **Decision**: Replace Room's internal state machine with EpochManager while keeping Room as the container. EpochManager owns tick counting, phase transitions, PvP toggle, and shrink timing. Room delegates lifecycle to EpochManager.
- **Consequences**: Existing Room tests need rewriting. CountryArena's embedded Room now delegates to EpochManager. Agent API (v10) needs adaptation for epoch-based observations.

### ADR-035: WeaponSystem Replaces Aura Combat

- **Status**: Proposed
- **Context**: v10 combat uses 60px aura DPS + dash burst. v14 needs 10 distinct weapon patterns with individual cooldowns, projectiles, and status effects.
- **Decision**: Remove `CollisionSystem.ProcessAgentCombat()` aura logic. Replace with `WeaponSystem.Tick()` that iterates weapon slots per agent. Keep `CollisionSystem.ProcessBoundaryCollisions()` for arena edge.
- **Consequences**: Mass-based HP is removed; explicit HP/Defense stats added. All existing balance numbers (aura DPS, boost cost, dash ratio) become irrelevant. New balance simulation required.

### ADR-036: In-Memory First, Redis Later

- **Status**: Proposed
- **Context**: Domination state, nation stats, policies, and war state could be in Redis (persistence) or in-memory (speed). Plan says "Redis or in-memory (initial)."
- **Decision**: All v14 game state is in-memory first. Redis is used only for cross-arena reads (globe domination map, global events). DominationEngine, CivilizationEngine, and WarSystem maintain authoritative state in Go structs. Periodic snapshots to Redis (every epoch end) for durability.
- **Consequences**: Server restart loses in-progress epoch state (acceptable for alpha). Future: WAL-style persistence for production.

### ADR-037: Weapon VFX Client-Only with Server Authority

- **Status**: Proposed
- **Context**: Weapon visual effects (particles, beams, explosions) need to render at 60FPS on the client but must not affect gameplay.
- **Decision**: Server emits compact `weapon_fired` events (agentId, weaponType, targetIds). Client renders VFX purely cosmetically from these events. No client-side hit detection. LOD system culls distant VFX.
- **Consequences**: Visual-gameplay desync of ~50ms (1 tick) is acceptable. VFX can be upgraded independently of server weapon logic. Mobile users can disable VFX for performance.

### ADR-038: Agent Struct Extension (Not Replacement)

- **Status**: Proposed
- **Context**: v14 adds HP, Nationality, WeaponSlots, StatusEffects, AgentBuild to Agent. Could create new struct or extend existing.
- **Decision**: Extend `domain.Agent` with new fields. Mark deprecated fields (Mass, Build.Tomes, Build.AbilitySlots) but keep them compiled for backward compatibility during migration. New fields use zero values as defaults.
- **Consequences**: Larger Agent struct (~2KB vs ~1KB). Serialization includes null/zero fields until cleanup phase. Agent API v10 callers see new fields but can ignore them.

### ADR-039: Epoch-Scoped Leveling (Not Persistent)

- **Status**: Proposed
- **Context**: Levels and builds persist across epochs within a 1-hour session but reset fully every 6 epochs.
- **Decision**: `AgentBuild` is owned by the arena's `SkillTreeManager`. On session reset (every 6 epochs), all agents are reset to Lv1 with empty builds. Between epochs, builds persist. No DB write for in-match progression.
- **Consequences**: Disconnected players lose their build (session-scoped). Reconnection within same session could restore build from server memory. Account-level XP (Phase 9) is separate and persistent.

## 13. Verification Matrix

### 13.1 Plan Requirement Coverage

| Req ID | Requirement | Architecture Component | Roadmap Step | Verified |
|--------|------------|----------------------|-------------|---------|
| FR-01 | Random character gen + nationality | AgentBuild.Nationality, character-generator.ts | S07-S09 | Y |
| FR-02 | Megabonk auto-combat | WeaponSystem, CombatResolver | S10-S13 | Y |
| FR-03 | 10 weapons + 10 passives + 10 synergies | SkillTreeManager, WeaponDef, PassiveType, SynergyType | S10, S14-S17 | Y |
| FR-04 | 50 agents, 10-min epoch | EpochManager, CountryArena(50 cap) | S01-S02, S06 | Y |
| FR-05 | Respawn (3s wait + 5s invincible) | RespawnManager | S03 | Y |
| FR-06 | Kill rewards (XP + Gold + NationPts) | ScoringSystem, KillReward | S20 | Y |
| FR-07 | Level 1→20, 3 choices | SkillTreeManager, LevelUpOverlay | S14, S17 | Y |
| FR-08 | Nationality at character creation | Agent.Nationality, NationalitySelector | S04, S08 | Y |
| FR-09 | 1hr domination evaluation | DominationEngine (6 epoch eval) | S23-S24 | Y |
| FR-10 | 24hr sovereignty | CountryDomination.Sovereignty | S25 | Y |
| FR-11 | 1wk hegemony → policy change | CountryDomination.Hegemony, PolicyManager | S25, S27 | Y |
| FR-12 | 8 national stats | NationStats (8 fields), CivilizationEngine | S28 | Y |
| FR-13 | Globe domination + overlay | GlobeDominationLayer, GlobeHoverPanel | S26, S30 | Y |
| FR-14 | War system | WarSystem, CrossArena | S31-S34 | Y |
| FR-15 | Alliance system | Alliance struct, AllianceManager | S33 | Y |
| FR-16 | Meta progression | AccountLevel, Challenges, Achievements | S39-S40 | Y |
| FR-17 | Capture points | CapturePointSystem | S37 | Y |
| FR-18 | Weather/environment | **Deferred (NG-6, v15+)** | — | N/A |
| NFR-01 | 20Hz tick with 50 agents | Tick budget analysis (36ms < 50ms) | S43 | Y |
| NFR-02 | 60 FPS client | VFX LOD, particle pools, instancing | S13, S43 | Y |
| NFR-03 | < 50KB/s bandwidth | Bandwidth breakdown (35KB/s) | §10.6 | Y |
| NFR-04 | Domination accuracy | DominationEngine 6-epoch sum | S24 | Y |
| NFR-05 | Globe < 5s delay | Broadcast on eval, Redis snapshot | S26 | Y |

### 13.2 Roadmap Step → Architecture Mapping

| Phase | Steps | Primary Architecture Components |
|-------|-------|-------------------------------|
| Phase 0 | S01-S06 | CountryArena ext, EpochManager, RespawnManager, Agent.Nationality, Protocol |
| Phase 1 | S07-S09 | character-generator.ts, NationalitySelector, FlagSprite |
| Phase 2 | S10-S13 | WeaponDef, WeaponSystem, CombatResolver, WeaponRenderer, DamageNumbers |
| Phase 3 | S14-S17 | SkillTreeManager, WeaponEvolution, Passives, Synergies, LevelUpOverlay |
| Phase 4 | S18-S22 | EpochManager phases, NPCManager, ScoringSystem, AntiSnowball, EpochHUD |
| Phase 5 | S23-S26 | NationScoreTracker, DominationEngine, Sovereignty, GlobeDominationLayer |
| Phase 6 | S27-S30 | PolicyManager, NationStats, CivilizationEngine, CivilizationPanel |
| Phase 7 | S31-S34 | WarSystem, CrossArena, WarResolution, Alliance, GlobeWarEffects |
| Phase 8 | S35-S38 | EventTicker, InGame↔Lobby, CapturePointSystem, SpectatorMode |
| Phase 9 | S39-S41 | AccountLevel, Challenges, Achievements, TokenRewards |
| Phase 10 | S42-S45 | BalanceSim, PerfOptimize, Tutorial, E2E |

### 13.3 Breaking Changes from v11

| Component | v11 | v14 | Migration |
|-----------|-----|-----|-----------|
| `domain.Agent.Mass` | HP equivalent | Removed; use `Agent.HP` | S12: add HP field, deprecate Mass |
| `domain.PlayerBuild` | Tomes + Abilities | Removed; use `AgentBuild` | S14: new struct |
| `CollisionSystem.ProcessAgentCombat` | Aura DPS | Removed; use `WeaponSystem.Tick` | S11: replace |
| `Room` state machine | 5 states | Delegate to `EpochManager` | S02: new state machine |
| `UpgradeSystem` | Tome/Ability/Synergy | Removed; use `SkillTreeManager` | S14: replace |
| `constants.go` combat | Aura constants | Weapon constants | S10: new constants |
| `ws/protocol.go` events | Round-based | Epoch-based | S05: add events |
| `serializer.go` state frame | Mass-based | HP + weapons + epoch | S06: extend |

## 14. Open Questions

| # | Question | Impact | Proposed Resolution |
|---|----------|--------|-------------------|
| OQ-1 | Should weapon VFX use WebGL instancing or sprite sheets? | Client FPS | Start with instancing (better 3D depth), fall back to sprites if perf issues |
| OQ-2 | How to handle cross-arena war with different tick rates? | War system | Both arenas must be active during war; sync via shared WarSystem (not per-arena) |
| OQ-3 | Disconnect/reconnect during epoch — restore build? | Player UX | Keep `AgentBuild` in memory for 5 minutes after disconnect; reconnect restores |
| OQ-4 | Civilization stats persistence across server restart | Durability | Redis snapshots every epoch end; accept data loss of current epoch on crash |
| OQ-5 | How to balance 10×10 weapon/passive matrix? | Game balance | Phase 10 automated simulation (S42); hotfix balance via constants.go |
| OQ-6 | Should war preparation allow diplomatic negotiation? | Gameplay depth | Deferred to v15; v14 war is simple declare→fight→resolve |
| OQ-7 | Globe VFX performance with many simultaneous wars | Client FPS | Max 5 active war FX on globe; queue overflow → newest replaces oldest |
| OQ-8 | Agent API compatibility — how do v10 bots interact with weapons? | Backward compat | Agent API receives `weapon_choices` in `observe_game`; bots auto-select via heuristic |

---

*End of v14 System Architecture Document*
