# Agent Survivor v10 — System Architecture Document

> **Version**: 1.0
> **Date**: 2026-03-06
> **Status**: Draft
> **Author**: DAVINCI /da:system
> **Input**: v10-survival-roguelike-plan.md (1472 lines)
> **Project Type**: GAME (Multiplayer Real-time)

---

## 1. Overview

Agent Survivor v10 is a **multiplayer auto-combat survival roguelike** built on top of the existing Snake Arena v7 codebase. The transformation replaces the snake-segment entity model with a single-position MC-style agent, introduces an XP/level-up/build system (Tomes + Abilities + Synergies), auto-combat via proximity auras, arena shrinking, and an AI Agent Commander Mode for LLM-driven strategic gameplay.

**Architecture Transformation Scope**:
- **Entity Model**: `Snake(segments[])` → `Agent(position)` — eliminates segment tracking across SpatialHash, CollisionSystem, StateSerializer, all renderers
- **Combat Model**: Head-body collision → Hitbox aura DPS + dash burst damage
- **Progression Model**: Mass growth → XP/Level/Build (Tome stacks + Ability slots + Synergy bonuses)
- **Round Model**: Respawn-based → 1-Life survival with arena shrink
- **Rendering Path**: Phase 1-3 2D Canvas → Phase 4+ 3D R3F (lobby already R3F)

**Monorepo Structure** (unchanged):
```
snake/
├── apps/server/     — Node.js + Socket.IO game server
├── apps/web/        — Next.js 15 + R3F client
└── packages/shared/ — Types, constants, utilities
```

## 2. Goals / Non-Goals

### Goals
- **G1**: Complete Snake→Agent entity transformation with zero data loss on movement/input mechanics
- **G2**: Auto-combat system with deterministic server-side aura DPS at 20Hz tick rate
- **G3**: XP/Level-up with 8 Tomes (stackable) + 6 Abilities (auto-trigger) + 10 Synergies (6 public + 4 hidden)
- **G4**: 1-Life survival with arena shrink (6000→1200px radius over 5 minutes)
- **G5**: AI Agent integration via Commander Mode (build selection + combat strategy)
- **G6**: Maintain current deployment: Vercel (client) + Railway (server)
- **G7**: MC-style character customization (AgentSkin, 30+ fields, 34 presets)
- **G8**: 5-Phase migration from v7 with backward-compatible network protocol evolution

### Non-Goals
- Server-side 3D simulation (server stays 2D coordinate plane)
- Physics engine integration (custom collision math is sufficient)
- Persistent database (Phase 1-3 use in-memory + JSON; DB is Phase 5+)
- Matchmaking/ELO rating (Phase 5+)
- VR/AR support
- WebGPU-only rendering (WebGL2 baseline)

## 3. System Context (C4 Level 1)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Agent Survivor System                        │
│                                                                     │
│  ┌──────────┐        ┌──────────────┐        ┌──────────────┐     │
│  │  Human    │◄──────►│   Web Client  │◄──────►│  Game Server │     │
│  │  Player   │  HTTP  │  (Next.js)   │ WS/SIO │  (Node.js)  │     │
│  │  Browser  │        │  Vercel      │        │  Railway     │     │
│  └──────────┘        └──────────────┘        └──────┬───────┘     │
│                                                      │              │
│  ┌──────────┐        ┌──────────────┐               │              │
│  │    AI    │◄───────│  Agent API   │───────────────┘              │
│  │  Agent   │  HTTP  │  (REST+WS)   │  Socket.IO                  │
│  │  (LLM)  │        │  Phase 4+     │                             │
│  └──────────┘        └──────────────┘                              │
└─────────────────────────────────────────────────────────────────────┘

External Actors:
  - Human Player: Browser-based, touch/mouse+keyboard input
  - AI Agent: LLM-powered (Claude, GPT, custom) connecting via Agent API
  - CDN (Vercel Edge): Static assets + Next.js SSR
  - Railway: Server process hosting
```

## 4. Container Diagram (C4 Level 2)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  GAME SERVER (Node.js + Socket.IO)  — Railway                               │
│  apps/server/                                                               │
│                                                                             │
│  ┌───────────────────┐   ┌─────────────┐   ┌─────────────────────────┐    │
│  │  SocketHandler    │──▶│ RoomManager │──▶│  Room[0..4]             │    │
│  │  (network/*)      │   │ (5 rooms)    │   │  ┌─────────────────┐   │    │
│  │                   │   │              │   │  │  Arena           │   │    │
│  │  - join_room      │   │  - quickJoin │   │  │  ┌────────────┐ │   │    │
│  │  - leave_room     │   │  - getRoom   │   │  │  │AgentEntity │ │   │    │
│  │  - input (30Hz)   │   │  - broadcast │   │  │  │CollisionSys│ │   │    │
│  │  - choose_upgrade │   │              │   │  │  │OrbManager  │ │   │    │
│  │  - respawn        │   └─────────────┘   │  │  │SpatialHash │ │   │    │
│  │  - ping/pong      │                     │  │  │UpgradeSys  │ │   │    │
│  └───────────────────┘                     │  │  │MapObjects  │ │   │    │
│                                            │  │  │ArenaShrink │ │   │    │
│  ┌───────────────────┐                     │  │  │BotManager  │ │   │    │
│  │  Broadcaster      │◀────────────────────│  │  └────────────┘ │   │    │
│  │  (network/*)      │                     │  │  State Machine:  │   │    │
│  │                   │                     │  │  wait→count→     │   │    │
│  │  - state (20Hz)   │                     │  │  play→end→cool  │   │    │
│  │  - rooms_update   │                     │  └─────────────────┘   │    │
│  │  - level_up       │                     └─────────────────────────┘    │
│  │  - round_start/end│                                                    │
│  │  - minimap (1Hz)  │                                                    │
│  │  - synergy_activated                                                   │
│  │  - arena_shrink   │                                                    │
│  └───────────────────┘                                                    │
└──────────────────────────────────────────┬────────────────────────────────┘
                                           │ Socket.IO (WebSocket + polling fallback)
                                           │ 20Hz state, 1Hz minimap, event-driven level_up/death/kill
┌──────────────────────────────────────────┴────────────────────────────────┐
│  WEB CLIENT (Next.js 15 + R3F)  — Vercel                                  │
│  apps/web/                                                                 │
│                                                                            │
│  ┌─── Page Router ──────────────────────────────────────────────────────┐  │
│  │  app/page.tsx — Mode: lobby | playing                                │  │
│  │  ┌────────────────────┐  ┌───────────────────────────────────────┐  │  │
│  │  │  Lobby Mode        │  │  Playing Mode                         │  │  │
│  │  │  - LobbyScene3D    │  │  - GameCanvas (2D) / GameCanvas3D    │  │  │
│  │  │  - RoomList        │  │  - LevelUpOverlay                    │  │  │
│  │  │  - AgentPreview    │  │  - BuildHUD + XPBar                  │  │  │
│  │  │  - SkinCustomizer  │  │  - ShrinkWarning                    │  │  │
│  │  │  - RecentWinners   │  │  - SynergyPopup                     │  │  │
│  │  │                    │  │  - RoundTimerHUD                     │  │  │
│  │  └────────────────────┘  │  - CountdownOverlay                  │  │  │
│  │                          │  - RoundResultOverlay                │  │  │
│  │                          │  - DeathOverlay                      │  │  │
│  │                          └───────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌─── Shared Hooks ─────────────────────────────────────────────────┐    │
│  │  useSocket.ts — joinRoom, leaveRoom, onLevelUp, onSynergyActivated│   │
│  │  useGameState.ts — interpolation, camera, input handling          │   │
│  └───────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─── Renderer Layer ───────────────────────────────────────────────┐    │
│  │  Phase 1-3: lib/renderer/* (2D Canvas — entities, background, ui)│   │
│  │  Phase 4+:  components/3d/* (R3F — AgentModel3D, VoxelTerrain)   │   │
│  └───────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│  SHARED PACKAGE  — packages/shared/                                       │
│                                                                          │
│  types/game.ts      — Agent, AgentSkin, PlayerBuild, TomeType, etc.     │
│  types/events.ts    — LevelUpEvent, ChooseUpgradeCommand, RoundSummary  │
│  constants/game.ts  — ARENA_CONFIG, ROOM_CONFIG, SHRINK_CONFIG          │
│  constants/upgrades.ts — TOMES, ABILITIES, SYNERGIES (NEW)              │
│  constants/colors.ts   — Agent color palette                            │
│  utils/*              — Math, validation                                │
└──────────────────────────────────────────────────────────────────────────┘
```

### 4.1 Communication Protocols

| Channel | Direction | Protocol | Rate | Purpose |
|---------|-----------|----------|------|---------|
| `input` | C→S | Socket.IO | 30Hz (rate-limited) | Steering angle + boost toggle |
| `state` | S→C | Socket.IO | 20Hz | Viewport-culled game state |
| `minimap` | S→C | Socket.IO | 1Hz | Full-map agent positions |
| `rooms_update` | S→C | Socket.IO | 1Hz | Lobby room list |
| `level_up` | S→C | Socket.IO | Event | 3 upgrade choices + context |
| `choose_upgrade` | C→S | Socket.IO | Event | Selected upgrade index |
| `synergy_activated` | S→C | Socket.IO | Event | Synergy bonus notification |
| `arena_shrink` | S→C | Socket.IO | Event | New arena radius |
| `round_start/end/reset` | S→C | Socket.IO | Event | Round lifecycle |
| `death/kill` | S→C | Socket.IO | Event | Combat results |
| Agent API (Phase 4+) | Agent↔S | REST + WS | Event | Commander Mode commands |

### 4.2 Data Flow Summary

```
Human Input → SocketHandler → Room.applyInput() → Arena.applyInput()
  → AgentEntity.setTarget() → gameLoop tick
  → CollisionSystem.processAuraCombat() + processCollisions()
  → UpgradeSystem.checkLevelUp() → [level_up event if triggered]
  → StateSerializer.getStateForPlayer() → Broadcaster → Client
  → Interpolation → Renderer (2D Canvas / 3D R3F)
```

## 5. Component Design — Server (C4 Level 3)

### 5.1 Server Module Dependency Graph

```
index.ts
  └─▶ SocketHandler
        └─▶ RoomManager
              └─▶ Room[0..4]
                    └─▶ Arena
                          ├─▶ AgentEntity (was: SnakeEntity)
                          ├─▶ CollisionSystem
                          ├─▶ OrbManager
                          ├─▶ SpatialHash
                          ├─▶ UpgradeSystem (NEW)
                          ├─▶ MapObjects (NEW)
                          ├─▶ ArenaShrink (NEW)
                          ├─▶ BotManager → BotBehaviors
                          ├─▶ LeaderboardManager
                          └─▶ StateSerializer
              └─▶ Broadcaster
```

### 5.2 Module Specifications

#### AgentEntity.ts (was: Snake.ts) — FULL REWRITE

| Aspect | v7 (Snake) | v10 (Agent) |
|--------|-----------|-------------|
| Position | `segments: Position[]` (head+body) | `position: Position` (single point) |
| Size | `mass = segment count` | `mass = HP` (hitbox scales slightly) |
| State | heading, speed, boosting, alive | + level, xp, xpToNext, build, activeSynergies |
| Update | Move head → trail segments → drop trail orbs | Move position → apply effects → check aura range |
| LOC estimate | ~170 lines | ~120 lines (simpler without segments) |

**Key Methods**:
- `update(dt)`: Move position, apply speed modifiers (Speed Tome), consume boost mass
- `takeDamage(amount, source)`: Reduce mass, track damage source for kill credit
- `addXP(amount)`: Add XP with Tome multipliers, return true if level-up triggered
- `applyTomeBonus(type)`: Recalculate derived stats after Tome stack change
- `getHitboxRadius()`: `16 + (mass > 50 ? 3 : 0) + (mass > 100 ? 3 : 0)` px
- `getAuraDPS()`: `BASE_AURA_DPS * (1 + damageTomeStacks * 0.15) * levelBonus`

#### CollisionSystem.ts — FULL REWRITE

```
v7 Collision Types:          v10 Collision Types:
  1. Boundary check            1. Boundary check (+ shrink boundary)
  2. Head-body collision       2. Aura-Aura combat (DPS exchange) ← NEW
  3. Head-head collision       3. Dash collision (burst damage) ← replaces head-body
                               4. Map object interaction ← NEW

Processing Order (per tick):
  1. auraCollisions(): SpatialHash range query (AURA_RADIUS=60px)
     → For each pair within range: mutual DPS application
     → Venom DoT application if ability active
  2. dashCollisions(): SpatialHash range query (HITBOX_RADIUS)
     → Boosting agent hits non-boosting → 30% mass burst damage
  3. boundaryCheck(): agent.position vs shrinking arena radius
     → Outside boundary: 0.25% mass/tick penalty
  4. mapObjectInteractions(): agent.position vs MapObject positions
     → Shrine/Spring/Altar/Gate proximity triggers
```

#### UpgradeSystem.ts — NEW (~250 LOC)

```typescript
// Core responsibilities:
class UpgradeSystem {
  // Generate 3 random choices weighted by Luck Tome + current build
  generateChoices(agent: AgentEntity): UpgradeChoice[];

  // Apply chosen upgrade to agent's build
  applyUpgrade(agent: AgentEntity, choice: UpgradeChoice): void;

  // Check all synergy conditions after build change
  checkSynergies(build: PlayerBuild): SynergyDef[];

  // Calculate XP needed for next level (polynomial curve)
  xpForLevel(level: number): number;
  // Formula: 20 + (level - 2) * 15 + (level - 2)^1.2 * 5
}
```

**Upgrade Choice Generation Algorithm**:
```
1. Pool = ALL_TOMES + ALL_ABILITIES (weighted)
2. Filter: Remove abilities if all slots full AND no existing ability to upgrade
3. Weight: Luck Tome stacks increase rare upgrade probability
4. Ensure diversity: At least 1 Tome + at most 1 new Ability per set
5. Near-synergy boost: If 1 upgrade away from synergy, +3x weight for that upgrade
6. Return 3 choices (sorted by rarity: common first for readability)
```

#### ArenaShrink.ts — NEW (~60 LOC)

```typescript
class ArenaShrink {
  currentRadius: number;      // starts at 6000
  shrinkStartTime: number;    // 60s after round start
  shrinkRate: number;          // 600px per minute = 0.5px per tick

  update(tick: number): void;  // Reduce radius if past start time
  isOutOfBounds(pos: Position): boolean;
  getBoundaryPenalty(): number; // 0.25% mass/tick
  getNextShrinkWarning(): { secondsUntil: number; newRadius: number } | null;
}
```

#### MapObjects.ts — NEW (~100 LOC)

```typescript
class MapObjects {
  objects: MapObject[];  // XP Shrine(3), Healing Spring(2), Upgrade Altar(1), Speed Gate(4)

  update(tick: number): void;         // Handle cooldowns and respawns
  checkInteractions(agents: AgentEntity[]): MapInteraction[];
  getVisibleObjects(): MapObject[];   // For state serialization
}

interface MapObject {
  type: 'xp_shrine' | 'healing_spring' | 'upgrade_altar' | 'speed_gate';
  position: Position;
  radius: number;          // interaction range
  cooldown: number;        // current cooldown ticks remaining
  maxCooldown: number;     // reset value
  available: boolean;
}
```

#### Arena.ts — MAJOR MODIFICATION (~200 LOC added)

**Changed**: `snakes: Map<string, SnakeEntity>` → `agents: Map<string, AgentEntity>`

**New methods added to game loop**:
```
gameLoop() {
  // Existing (modified):
  this.moveAgents();                    // was: moveSnakes (simplified)
  this.collisionSystem.process();       // rewritten for aura combat
  this.processOrbCollection();          // + XP tracking

  // New:
  this.upgradeSystem.processLevelUps(); // check XP thresholds → emit level_up
  this.upgradeSystem.processAbilities();// auto-trigger ability effects
  this.arenaShrink.update(this.tick);   // shrink boundary
  this.mapObjects.update(this.tick);    // map object cooldowns
  this.mapObjects.checkInteractions();  // proximity interactions
  this.processEffects();                // ability duration/cooldown
  this.botManager.updateBots();         // bot decisions (expanded)
}
```

#### BotBehaviors.ts — EXPANDED

**New behaviors** (extending existing survive/hunt/gather/wander):
- `behaviorKite(target)`: Maintain position within aura range but outside hitbox
- `behaviorCamp()`: Position at shrink boundary -200px
- `behaviorFarmOrbs(zone)`: Restrict orb gathering to safe/center/edge zone
- `chooseLevelUpgrade(choices, buildPath)`: Algorithm from plan section 6.3

**Bot Build Path Assignment** (BotManager):
```
On bot creation:
  Randomly assign one of 5 build paths: Berserker(20%), Tank(20%),
  Speedster(20%), Vampire(20%), Scholar(20%)
  Each path dictates upgrade priority + strategy phase transitions
```

## 6. Component Design — Client (C4 Level 3)

### 6.1 Component Tree

```
app/page.tsx (mode: lobby | playing)
├── Lobby Mode:
│   ├── LobbyScene3D.tsx          (R3F 3D background — existing, unchanged)
│   ├── RoomList.tsx              (MC server list — text changes only)
│   ├── LobbyAgentPreview.tsx     (was: LobbySnakePreview — MC agent rotation)
│   ├── SkinCustomizer.tsx        (NEW — AgentSkin tier-based customization)
│   ├── RecentWinnersPanel.tsx    (add build/synergy info to winners)
│   └── McPanel/McButton/McInput  (MC UI components — unchanged)
│
├── Playing Mode:
│   ├── GameCanvas.tsx            (2D Canvas wrapper — agent rendering)
│   │   └── lib/renderer/
│   │       ├── entities.ts       (REWRITE — agent sprite 16x16 + aura circle)
│   │       ├── background.ts     (add shrink boundary + zone indicators)
│   │       └── ui.ts             (add XP bar, build icons, shrink warning)
│   │
│   ├── LevelUpOverlay.tsx        (NEW — 3 upgrade cards, 5s timer)
│   ├── BuildHUD.tsx              (NEW — tome stacks + ability slots display)
│   ├── XPBar.tsx                 (NEW — experience bar under agent name)
│   ├── ShrinkWarning.tsx         (NEW — arena shrink countdown warning)
│   ├── SynergyPopup.tsx          (NEW — synergy activation notification)
│   ├── RoundTimerHUD.tsx         (existing — unchanged)
│   ├── CountdownOverlay.tsx      (existing — unchanged)
│   ├── RoundResultOverlay.tsx    (MODIFIED — add build details + synergy display)
│   └── DeathOverlay.tsx          (MODIFIED — 1 Life messaging, spectate option)
│
└── Shared Hooks:
    ├── useSocket.ts              (MODIFIED — agent events, level_up, synergy)
    └── useGameState.ts           (derived — interpolation, camera, predictions)
```

### 6.2 New Client Components

#### LevelUpOverlay.tsx
- **Trigger**: `level_up` socket event
- **Display**: 3 upgrade cards (Tome/Ability) with icon, name, description, stack count
- **Input**: Click card or press 1/2/3, auto-select on 5s timeout
- **Sends**: `choose_upgrade { choiceIndex: 0|1|2 }`
- **Z-index**: Above game canvas, below death overlay
- **Animation**: Cards slide up from bottom, selected card scales + fades

#### BuildHUD.tsx
- **Position**: Top-left corner, below leaderboard
- **Display**: Tome stack icons (colored bars) + Ability slot icons (with cooldown rings)
- **Data**: From `state.agents[myId].build`
- **Update**: Every state tick (20Hz)

#### XPBar.tsx
- **Position**: Bottom of screen, full width, thin bar
- **Display**: Current XP / XP to next level, level number
- **Animation**: Smooth fill with glow on level-up

#### ShrinkWarning.tsx
- **Trigger**: `arena_shrink` event or 10s before shrink
- **Display**: Red pulse border + "Arena Shrinking!" text + new boundary preview on minimap

#### SynergyPopup.tsx
- **Trigger**: `synergy_activated` event
- **Display**: Gold banner with synergy name + bonus description, 3s auto-dismiss
- **Animation**: Slide down from top, gold particle burst

### 6.3 Renderer Modifications (lib/renderer/)

#### entities.ts — FULL REWRITE (~764 LOC → ~500 LOC)

```
v7 Snake Rendering:                    v10 Agent Rendering:
  For each snake:                        For each agent:
    Draw segments (circles along path)     Draw 16x16 sprite at position
    Draw head (larger circle + eyes)       Draw MC face (eyeStyle + mouthStyle)
    Draw name tag                          Draw name tag + level badge
    Draw outline glow                      Draw combat aura circle (60px radius)
                                           Draw active ability indicators
                                           Draw build visual effects (§5B.6)
                                           Draw hitbox (debug mode)
```

**Agent Sprite Strategy (Phase 1-3)**:
- 16x16 pixel canvas sprites generated from AgentSkin properties at connect time
- Cached as `OffscreenCanvas` per agent — regenerated only on skin change
- Top-down view: head circle + body square + directional indicator
- Colors from AgentSkin: `skinTone` (face), `bodyColor` (body), `legColor` (legs)
- Equipment rendered as small overlay icons

#### background.ts — MODIFICATIONS
- Add shrinking arena boundary line (red dashed, pulsing when < 10s to shrink)
- Add zone color indicators (subtle tints: edge=green, mid=yellow, core=red)
- Add map object markers (shrine=purple glow, spring=blue, altar=gold, gate=cyan)

### 6.4 Client State Management

```
useSocket.ts state shape:
{
  mode: 'lobby' | 'playing',
  roomId: string | null,
  agents: Map<string, AgentState>,     // was: snakes
  orbs: OrbState[],
  myAgentId: string | null,            // was: mySnakeId
  leaderboard: LeaderboardEntry[],
  minimap: MinimapData,

  // NEW v10 state:
  levelUpChoices: UpgradeChoice[] | null,  // non-null = overlay visible
  roundTimer: number,
  arenaRadius: number,
  shrinkWarning: boolean,
  lastSynergyActivation: { name: string; bonus: string } | null,
  mapObjects: MapObject[],
}
```

## 7. Component Design — Shared Package

### 7.1 packages/shared/ File Map

```
packages/shared/src/
├── types/
│   ├── game.ts          — Agent, AgentSkin, PlayerBuild, UpgradeChoice (REWRITE)
│   └── events.ts        — Socket event payloads (EXPANDED)
├── constants/
│   ├── game.ts          — ARENA_CONFIG, ROOM_CONFIG, SHRINK_CONFIG (MODIFIED)
│   ├── upgrades.ts      — TOMES, ABILITIES, SYNERGIES (NEW)
│   └── colors.ts        — MC 12-color wool palette + skin tones (REWRITE)
└── utils/
    ├── math.ts          — Distance, angle calculations (unchanged)
    └── validation.ts    — Input validation (unchanged)
```

### 7.2 Key Type Changes

| v7 Type | v10 Type | Change |
|---------|----------|--------|
| `Snake` | `Agent` | segments[] removed, position single, +level/xp/build |
| `SnakeSkin` | `AgentSkin` | 8 fields → 30+ fields (5-Tier system: Base→Surface→Face→Equipment→Effects) |
| `DEFAULT_SKINS[24]` | `DEFAULT_AGENT_SKINS[34]` | Complete rewrite |
| `segmentSpacing` | removed | No segments |
| `headRadius` | `hitboxRadius` | Dynamic, mass-based |
| N/A | `TomeType` | 8 enum values |
| N/A | `AbilityType` | 6 enum values |
| N/A | `SynergyDef` | 10 definitions (6 public + 4 hidden) |
| N/A | `PlayerBuild` | tomes: Record + abilities: AbilitySlot[] |
| N/A | `UpgradeChoice` | type + subtype + description + rarity |
| N/A | `MapObject` | type + position + cooldown + available |
| N/A | `SHRINK_CONFIG` | startTime, rate, boundaryPenalty |
| N/A | `UPGRADE_CONFIG` | xpCurve, choiceTimeout, maxAbilitySlots |

### 7.3 AgentSkin Type System (types/game.ts) — 5-Tier Customization

> **Design Principle**: Minecraft Bedrock Character Creator + .io game cosmetics.
> All customization is **purely cosmetic** — zero gameplay impact.
> Combination space (Tier 1-4 only): **~2.19B combinations**.

```typescript
interface AgentSkin {
  id: number;
  name: string;                               // Preset name or "Custom"
  rarity: SkinRarity;                         // Cosmetic rarity

  // ═══════════════════════════════════════
  // TIER 1: BASE (Body Shape)
  // ═══════════════════════════════════════
  bodyType: 'standard' | 'slim';              // MC Steve(4px arm) vs Alex(3px arm)
  bodySize: 'small' | 'medium' | 'large';     // Visual scale only (hitbox unchanged)
  skinTone: SkinTone;                         // 15 skin tones

  // ═══════════════════════════════════════
  // TIER 2: COLORS & SURFACE
  // ═══════════════════════════════════════
  bodyColor: BodyColor;                        // Main torso color (12-color palette)
  legColor: BodyColor;                        // Leg color (12-color palette)
  pattern: SurfacePattern;                    // Pattern (8 types)
  patternColor?: BodyColor;                   // Pattern secondary color

  // ═══════════════════════════════════════
  // TIER 3: FACE
  // ═══════════════════════════════════════
  eyeStyle: EyeStyle;                        // Eye style (8 types)
  eyeColor?: EyeColor;                       // Eye color (some styles fixed: visor→cyan, enderman→purple)
  mouthStyle: MouthStyle;                    // Mouth style (6 types)
  markings: FaceMarkings;                    // MC mob-themed face markings (8 types)

  // ═══════════════════════════════════════
  // TIER 4: EQUIPMENT (Cosmetic Only)
  // ═══════════════════════════════════════
  hat: HeadwearType;                         // Hats/helmets (16 types)
  backItem: BackItemType;                    // Back items (14 types)
  bodyOverlay: BodyOverlayType;              // Outfit overlays (17 types)
  accessory: AccessoryType;                  // Neck/face accessories (10 types)
  handItem: HandItemType;                    // Hand items (10 types)
  footwear: FootwearType;                    // Footwear (8 types)

  // ═══════════════════════════════════════
  // TIER 5: EFFECTS (some auto-linked to build)
  // ═══════════════════════════════════════
  auraColor?: string;                        // Combat aura (build-based auto)
  weaponVisual?: string;                     // Ability-based weapon visual (auto)
  trailEffect: TrailEffect;                  // Movement trail (8 types)
  deathEffect: DeathEffect;                  // Death animation (6 types)
  killEffect: KillEffect;                    // Kill effect (6 types)
  spawnEffect: SpawnEffect;                  // Spawn animation (8 types)
  emote: EmoteType;                          // Emote expression (8 types)

  // Nametag (sub-section of Tier 5)
  nametagStyle: NametagStyle;                // Nametag style (6 types)
  nametagColor?: McTextColor;                // Nametag text color (MC §color code)
  title?: string;                            // Title ("The Destroyer", "Tome Master", etc.)
}

// ── Sub-type Definitions ──

type SkinRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

type BodyColor =
  | 'white' | 'light_gray' | 'gray' | 'black'
  | 'red' | 'orange' | 'yellow' | 'green'
  | 'cyan' | 'blue' | 'purple' | 'brown';
  // MC wool 12-color palette

type EyeColor =
  | 'brown' | 'blue' | 'green' | 'gray' | 'hazel' | 'amber'
  | 'violet' | 'red';

type McTextColor =
  | 'white' | 'gray' | 'dark_gray' | 'black'
  | 'gold' | 'yellow' | 'green' | 'dark_green'
  | 'aqua' | 'dark_aqua' | 'blue' | 'dark_blue'
  | 'red' | 'dark_red' | 'light_purple' | 'dark_purple';
  // MC §color code 16-color palette

type SkinTone =
  | 'pale' | 'light' | 'fair' | 'medium_light' | 'medium'
  | 'olive' | 'tan' | 'brown' | 'dark_brown' | 'deep'
  | 'warm_beige' | 'cool_pink' | 'golden' | 'ashen' | 'otherworldly';

type SurfacePattern =
  | 'solid' | 'striped' | 'checkered' | 'dotted'
  | 'marble' | 'scales' | 'camo' | 'gradient';

type EyeStyle =
  | 'default' | 'cute' | 'angry' | 'cool'
  | 'wink' | 'dot' | 'visor' | 'enderman';

type MouthStyle =
  | 'smile' | 'neutral' | 'determined'
  | 'open' | 'fangs' | 'none';

type FaceMarkings =
  | 'none' | 'blaze_stripes' | 'skeleton_face' | 'creeper_face'
  | 'enderman_eyes' | 'wither_scars' | 'piglin_snout' | 'guardian_spikes';

type HeadwearType =
  | 'none'
  | 'helmet_iron' | 'helmet_gold' | 'helmet_diamond' | 'helmet_netherite'
  | 'crown' | 'tophat' | 'wizard_hat' | 'headband' | 'antenna'
  | 'pumpkin' | 'flower_crown' | 'straw_hat' | 'viking' | 'santa' | 'graduation';

type BackItemType =
  | 'none'
  | 'cape_red' | 'cape_blue' | 'cape_purple' | 'cape_gold'
  | 'wings_angel' | 'wings_bat' | 'wings_elytra' | 'wings_butterfly' | 'wings_ender' | 'wings_phoenix'
  | 'backpack' | 'quiver' | 'jetpack';

type BodyOverlayType =
  | 'none'
  | 'knight_armor' | 'pirate_coat' | 'ninja_suit' | 'astronaut_suit' | 'chef_apron'
  | 'scientist_coat' | 'wizard_robe' | 'samurai_armor' | 'hoodie' | 'tuxedo'
  | 'creeper_hoodie' | 'enderman_suit' | 'blaze_armor' | 'wither_cloak'
  | 'diamond_armor' | 'netherite_armor';

type AccessoryType =
  | 'none'
  | 'scarf' | 'necklace' | 'goggles' | 'mask_creeper' | 'mask_pumpkin'
  | 'monocle' | 'bandana' | 'flower_pin' | 'earring';

type HandItemType =
  | 'none'
  | 'sword_diamond' | 'pickaxe_iron' | 'torch' | 'shield_iron'
  | 'enchanted_book' | 'fishing_rod' | 'bow' | 'trident' | 'totem_of_undying';

type FootwearType =
  | 'none' | 'boots_iron' | 'boots_gold' | 'boots_diamond' | 'boots_netherite'
  | 'sneakers' | 'sandals' | 'roller_skates';

type TrailEffect =
  | 'none' | 'sparkle' | 'smoke' | 'hearts'
  | 'fire' | 'ice_crystals' | 'ender_particles' | 'redstone_dust';

type DeathEffect =
  | 'none' | 'explosion' | 'poof' | 'shatter' | 'dissolve' | 'firework';

type KillEffect =
  | 'none' | 'lightning_strike' | 'confetti' | 'skull_popup' | 'gold_burst' | 'ender_flash';

type SpawnEffect =
  | 'none' | 'beam_down' | 'portal_emerge' | 'block_build' | 'nether_gate'
  | 'lightning_strike' | 'soul_fire' | 'ender_teleport';

type EmoteType =
  | 'none' | 'wave' | 'dance' | 'taunt' | 'clap'
  | 'bow' | 'spin' | 'flex';

type NametagStyle =
  | 'default' | 'gold_outline' | 'enchanted_glow' | 'fire_text'
  | 'ice_text' | 'rainbow_cycle';
```

#### 7.3.1 5-Tier Cosmetic Catalog Summary

| Tier | Category | Item Count | Rarity Range |
|------|----------|------------|--------------|
| **Tier 1: Base** | Body Type (2), Body Size (3), Skin Tone (15) | 20 options | Free |
| **Tier 2: Surface** | Body Color (12), Leg Color (12), Pattern (8), Pattern Color (12) | 44 options | Common~Uncommon |
| **Tier 3: Face** | Eye Style (8), Eye Color (8), Mouth (6), Markings (8) | 30 options | Common~Rare |
| **Tier 4: Equipment** | Headwear (16), Back (14), Overlay (17), Accessory (10), Hand (10), Footwear (8) | 75 options | Uncommon~Legendary |
| **Tier 5: Effects** | Trail (8), Death (6), Kill (6), Spawn (8), Emote (8), Nametag (6) | 42 options | Rare~Mythic |

#### 7.3.2 Preset Characters (34 total)

| Category | Count | Rarity | IDs | Unlock |
|----------|-------|--------|-----|--------|
| **Basic Characters** | 12 | Common | 00-11 | Free at start |
| **MC Mob Theme** | 8 | Rare | 12-19 | Achievement unlock |
| **Job Theme** | 6 | Uncommon | 20-25 | Easy achievement |
| **Achievement Theme** | 4 | Epic | 30-33 | Challenging achievement |
| **Season Limited** | 2 | Legendary | 27-28 | Seasonal events |
| **Ultra Rare** | 2 | Mythic | 26, 29 | Extreme milestones |

#### 7.3.3 Rarity System

```
┌──────────────┬───────┬──────────────────────────────────────────┐
│   Rarity     │ Color │ Unlock Method                            │
├──────────────┼───────┼──────────────────────────────────────────┤
│ Common       │ White │ Free at start (all 12 basic presets)     │
│ Uncommon     │ Green │ 10 games played / first win / easy quest │
│ Rare         │ Blue  │ 50 kills / 3-win streak / 5000 XP       │
│ Epic         │ Purple│ 5 synergies / tournament win / quests    │
│ Legendary    │ Gold  │ 1000 kills / all synergies discovered    │
│ Mythic       │ Red   │ 10,000 kills / 100 tournament wins (P4+)│
└──────────────┴───────┴──────────────────────────────────────────┘
```

#### 7.3.4 Cosmetic Implementation Phases

```
Phase 1 (Minimal — functional presets):
  - Tier 1: bodyType(2) + skinTone(15) — bodySize fixed to medium
  - Tier 2: bodyColor(12) + legColor(12) + pattern(4: solid/striped/checkered/dotted)
  - Tier 3: eyeStyle(8) + mouthStyle(6) — no markings
  - Tier 4: hat(6) + accessory(4) — simple 2D sprites
  - Effects: none (Tier 5 disabled)

Phase 3 (Full catalog):
  - Tier 2 expanded: all 8 patterns
  - Tier 3 expanded: markings 8 types
  - Tier 4 expanded: all categories (backItem, bodyOverlay, handItem, footwear)
  → Tier 1-4 full: ~2.19B combinations

Phase 4+ (Effects + 3D):
  - Tier 5 effects: trail + death + kill + spawn + emote (particle system)
  - Nametag customization
  - 3D model generation from AgentSkin properties
```

### 7.4 Constants Architecture (constants/upgrades.ts)

```typescript
// All upgrade definitions — single source of truth for server + client
export const TOMES: Record<TomeType, TomeDef> = {
  xp:     { tier: 'S', effectPerStack: 0.20, maxStack: 10, description: 'XP +20%/stack' },
  speed:  { tier: 'S', effectPerStack: 0.10, maxStack: 5,  description: 'Speed +10%/stack' },
  damage: { tier: 'S', effectPerStack: 0.15, maxStack: 10, description: 'Aura DPS +15%/stack' },
  armor:  { tier: 'A', effectPerStack: 0.10, maxStack: 8,  description: 'Damage taken -10%/stack' },
  magnet: { tier: 'A', effectPerStack: 0.25, maxStack: 6,  description: 'Collect radius +25%/stack' },
  luck:   { tier: 'A', effectPerStack: 0.15, maxStack: 6,  description: 'Rare upgrade +15%/stack' },
  regen:  { tier: 'B', effectPerStack: 0.5,  maxStack: 5,  description: '+0.5 mass/s/stack' },
  cursed: { tier: 'S', effectPerStack: 0.25, maxStack: 5,  description: 'DPS +25%, taken +20%/stack' },
};

export const ABILITIES: Record<AbilityType, AbilityDef> = { /* 6 abilities */ };
export const SYNERGIES: SynergyDef[] = [ /* 10 synergies */ ];
```

## 8. Data Model

### 8.1 Core Entity — Agent (Server-Side)

```typescript
interface AgentEntity {
  // Identity
  id: string;
  name: string;
  isBot: boolean;
  isAgent: boolean;           // AI Agent (Phase 4+)

  // Spatial (SIMPLIFIED from segments[])
  position: Position;         // Single coordinate {x, y}
  heading: number;            // 0~2pi radians
  targetAngle: number;        // Input-requested angle
  speed: number;              // Current speed px/s (base 150, modified by tomes)

  // Survival
  mass: number;               // HP role (initial: 10, death at 0)
  alive: boolean;
  boosting: boolean;          // Dash state
  hitboxRadius: number;       // 16~22px, derived from mass

  // Progression (NEW)
  level: number;              // 1~12
  xp: number;                 // Current XP
  xpToNext: number;           // XP threshold for next level

  // Build System (NEW)
  build: PlayerBuild;
  activeSynergies: string[];  // Currently active synergy IDs

  // Combat Tracking (NEW)
  lastDamageSource: string | null;  // Agent ID for kill credit
  lastDamageTime: number;
  killStreak: number;
  totalDamageDealt: number;
  totalDamageReceived: number;

  // Visual
  skin: AgentSkin;

  // Effects (modified from v7)
  activeEffects: ActiveEffect[];
  effectCooldowns: EffectCooldown[];
  abilityCooldowns: Record<AbilityType, number>;  // NEW: per-ability cooldown ticks

  // Score
  score: number;
  kills: number;
  bestScore: number;

  // Meta
  joinedAt: number;
  lastInputSeq: number;
}

interface PlayerBuild {
  tomes: Record<TomeType, number>;    // Stack count per tome type
  abilities: AbilitySlot[];            // Max 2 (3 with RP unlock)
}

interface AbilitySlot {
  type: AbilityType;
  level: number;       // 1~4 (base + 3 upgrades)
}
```

### 8.2 Serialized State (Wire Format — S→C)

```typescript
// Per-tick state broadcast (20Hz) — viewport-culled
interface AgentState {
  id: string;
  n: string;               // name (abbreviated key)
  p: [number, number];     // position [x, y] (was: segments)
  h: number;               // heading
  s: number;               // speed
  m: number;               // mass
  b: boolean;              // boosting
  a: boolean;              // alive
  sk: number;              // skin ID
  // NEW fields:
  lv: number;              // level
  xp: number;              // current XP (for XP bar rendering)
  xn: number;              // xpToNext
  bd: SerializedBuild;     // compact build
  sy: string[];            // active synergy IDs
  hr: number;              // hitbox radius
  ks: number;              // kill streak
  ef: number[];            // active effect type IDs
}

// Compact build serialization: "t:xp3,dmg5,arm2|a:venom2,shield1"
type SerializedBuild = string;
```

**Bandwidth Impact**: Removing `segments[]` (avg 15 segments x 2 floats = 30 numbers per snake) and replacing with single `[x,y]` **reduces per-agent payload by ~85%**. New fields (lv, xp, bd, sy) add ~50 bytes. Net bandwidth reduction: ~60% per agent.

### 8.3 Round Summary (Post-Round — S→C)

```typescript
interface RoundSummary {
  roundId: string;
  result: {
    rank: number;
    level: number;
    kills: number;
    survivalTime: number;
    totalXP: number;
    totalDamageDealt: number;
  };
  buildHistory: BuildHistoryEntry[];  // Per-level choice log
  activeSynergies: string[];
  deathCause: 'aura' | 'dash' | 'boundary' | 'arena_shrink' | 'survived';
  keyMoments: KeyMoment[];
}

interface BuildHistoryEntry {
  level: number;
  choice: UpgradeType;
  alternatives: UpgradeType[];
  timestamp: number;         // seconds into round
  gamePhase: 'early' | 'mid' | 'late';
}
```

## 9. Event Protocol (Socket.IO)

### 9.1 Complete Event Catalog

#### Client → Server Events

| Event | Payload | Rate | Description |
|-------|---------|------|-------------|
| `join_room` | `{ roomId: string, name: string, skin: AgentSkin }` | Once | Join a game room |
| `leave_room` | — | Once | Leave current room |
| `input` | `{ angle: number, boost: boolean, seq: number }` | 30Hz max | Steering input |
| `choose_upgrade` | `{ choiceIndex: 0\|1\|2 }` | Event | Level-up upgrade selection |
| `ping` | `{ timestamp: number }` | 5Hz | Latency measurement |

#### Server → Client Events

| Event | Payload | Rate | Description |
|-------|---------|------|-------------|
| `joined` | `{ roomId, agentId, roomState }` | Once | Room join confirmation |
| `state` | `{ agents[], orbs[], tick, arenaRadius, mapObjects[] }` | 20Hz | Game state (viewport-culled) |
| `minimap` | `{ agents: [id, x, y, color][], radius }` | 1Hz | Full-map overview |
| `rooms_update` | `{ rooms: RoomInfo[] }` | 1Hz (lobby) | Room list for lobby |
| `level_up` | `LevelUpEvent` | Event | 3 upgrade choices + game context |
| `choose_upgrade_ack` | `{ success, appliedUpgrade, newBuild }` | Event | Confirmation + state |
| `synergy_activated` | `{ agentId, synergyId, synergyName, bonus }` | Event | Synergy triggered |
| `arena_shrink` | `{ newRadius, nextShrinkAt }` | Event (every 60s) | Boundary reduced |
| `shrink_warning` | `{ secondsUntil, newRadius }` | Event (10s before) | Upcoming shrink |
| `death` | `{ agentId, killerId, cause, position, xpDropped }` | Event | Agent death |
| `kill` | `{ killerId, victimId, xpEarned, killStreak }` | Event | Kill notification |
| `round_start` | `{ roomId, duration, agentCount }` | Event | Round begins |
| `round_end` | `{ roomId, winner, rankings[], roundSummary }` | Event | Round complete |
| `round_reset` | `{ roomId }` | Event | Transitioning to next round |
| `pong` | `{ timestamp }` | 5Hz | Latency response |

### 9.2 New Event Details

#### LevelUpEvent (S→C)
```typescript
{
  type: 'level_up',
  agentId: string,
  level: number,                // New level reached
  choices: [
    {
      index: 0,
      category: 'tome' | 'ability',
      type: TomeType | AbilityType,
      name: string,              // Display name
      description: string,       // Effect description
      rarity: 'common' | 'uncommon' | 'rare',
      isUpgrade: boolean,        // true if upgrading existing ability
      currentStack?: number,     // for tomes: current stack count
      newLevel?: number,         // for abilities: level after upgrade
    },
    // ... 2 more choices
  ],
  currentBuild: {
    tomes: Record<TomeType, number>,
    abilities: AbilitySlot[],
    activeSynergies: string[],
    nearbySynergies: string[],   // "1 more upgrade to trigger"
  },
  gameContext: {
    timeRemaining: number,
    myRank: number,
    myMass: number,
    nearbyThreats: number,
    arenaRadius: number,
  },
  deadline: number,              // 5000ms to choose
}
```

### 9.3 Protocol Evolution (Backward Compatibility)

**Strategy**: Additive-only protocol changes. New fields are optional in v10 state events.

```
v7 state.snakes[].segments → v10 state.agents[].p  (breaking: segments removed)
v7 state.snakes[].mass     → v10 state.agents[].m  (compatible: same semantics)
v10 state.agents[].lv      → (new: level, ignored by v7 clients)
v10 state.agents[].bd      → (new: build, ignored by v7 clients)
```

**Migration approach**: Version header in `joined` event. Server sends v10 format only; legacy clients unsupported after migration.

## 10. Game Systems Architecture

### 10.1 Auto-Combat System

#### Combat Processing Pipeline (per tick, 20Hz)

```
Phase 1: Spatial Query
  SpatialHash.queryRadius(agent.position, AURA_RADIUS=60px)
  → Returns set of nearby agent IDs

Phase 2: Aura DPS Exchange
  For each pair (A, B) within AURA_RADIUS:
    dpsA = A.getAuraDPS()  // base 2.0 * (1 + damageTome * 0.15) * levelBonus
    dpsB = B.getAuraDPS()
    A.takeDamage(dpsB, B.id)   // B damages A
    B.takeDamage(dpsA, A.id)   // A damages B

    // Venom DoT application
    if A.hasAbility('venom_aura'):
      B.applyDoT('venom', venomDPS, 3 seconds)
    if B.hasAbility('venom_aura'):
      A.applyDoT('venom', venomDPS, 3 seconds)

Phase 3: Dash Collision
  For each boosting agent A:
    SpatialHash.queryRadius(A.position, A.hitboxRadius + B.hitboxRadius)
    → For each non-boosting B in range:
      B.takeDamage(B.mass * 0.30, A.id)  // 30% mass burst
      A.dashHitCooldown = 20 ticks        // prevent multi-hit

Phase 4: Kill Resolution
  For each agent where mass <= 0:
    killer = lastDamageSource
    emit('death', { agentId, killerId, cause })
    emit('kill', { killerId, victimId, xpEarned })
    spawnDeathOrbs(agent.position, agent.mass * 0.80)
    agent.alive = false
```

#### Derived Constants Table

| Constant | Formula | Value | Purpose |
|----------|---------|-------|---------|
| `BASE_AURA_DPS_PER_TICK` | 40/s / 20Hz | 2.0 mass/tick | Base combat damage |
| `AURA_RADIUS` | Fixed | 60 px | Combat detection range |
| `HITBOX_RADIUS_BASE` | Fixed | 16 px | Dash collision base |
| `HITBOX_RADIUS_MAX` | mass > 100 | 22 px | Large agent hitbox |
| `DASH_BURST_RATIO` | Fixed | 0.30 | 30% mass on dash hit |
| `LEVEL_DPS_BONUS` | Lv >= 8 | 1.20x | High level advantage |

### 10.2 Upgrade System (Tomes & Abilities)

#### Tome Stack Mechanics

```
Final Stat = BaseValue * (1 + SUM(tomeStacks[i] * effectPerStack[i]))

Example: Speed = 150 * (1 + 3 * 0.10) = 195 px/s
         With max 5 stacks: 150 * 1.50 = 225 px/s
         Boost cap: 300 px/s (not affected by Speed Tome)
```

#### Ability Auto-Trigger System

```
Priority queue evaluated every tick:
  1. Shield Burst: triggers when mass < 30% of peak mass
  2. Lightning Strike: triggers when enemy within 200px, off cooldown
  3. Speed Dash: triggers when fleeing (mass_ratio < 0.5) or chasing kill
  4. Mass Drain: triggers on hitbox contact
  5. Gravity Well: triggers when 3+ orbs within 150px
  6. Venom Aura: always active (passive, no trigger needed)

Ability Upgrade Scaling:
  Level 1 (base): 100% effect, 100% cooldown
  Level 2 (+1): 130% effect, 80% cooldown
  Level 3 (+2): 170% effect, 65% cooldown
  Level 4 (+3): 220% effect, 50% cooldown
```

#### XP Level-Up Curve

```
Level  Required   Cumulative   Formula
  2      20          20        20
  3      30          50        20 + 10
  4      45          95        20 + 25
  5      65         160        20 + 45 (accelerating)
  ...
  12    345        1595        Polynomial: 20 + (L-2)*15 + floor((L-2)^1.2 * 5)
```

### 10.3 Synergy Engine

#### Check Algorithm (runs on every level-up)

```typescript
function checkSynergies(build: PlayerBuild): SynergyDef[] {
  const activated: SynergyDef[] = [];
  for (const synergy of ALL_SYNERGIES) {
    let met = true;
    // Check tome requirements
    for (const [tome, minStack] of Object.entries(synergy.requirements.tomes ?? {})) {
      if ((build.tomes[tome] ?? 0) < minStack) { met = false; break; }
    }
    // Check ability requirements
    for (const [ability, minLevel] of Object.entries(synergy.requirements.abilities ?? {})) {
      const slot = build.abilities.find(a => a.type === ability);
      if (!slot || slot.level < minLevel) { met = false; break; }
    }
    if (met) activated.push(synergy);
  }
  return activated;
}
```

#### Near-Synergy Detection (for UI hints)

```
For each unactivated synergy:
  Count missing requirements
  If exactly 1 requirement missing → add to nearbySynergies[]
  Send in level_up event → client highlights relevant choices
```

### 10.4 Arena Shrink System

#### Shrink Timeline

Linear shrink at **-600px per minute**, starting at T=1:00:

```
T=0:00  radius=6000  (100%) — No shrink (grace period)
T=0:30  radius=6000         — First level-ups (most agents Lv2~3)
T=1:00  radius=5400  (90%)  — Shrink starts, first combats
T=1:30  radius=5400         — Mid-tier upgrades appear
T=2:00  radius=4800  (80%)  — Mid-game, build path solidified
T=2:30  radius=4200  (70%)  — Frequent combat, synergies activate
T=3:00  radius=3600  (60%)  — Late game, weak agents eliminated
T=3:30  radius=3000  (50%)  — High-density combat
T=4:00  radius=2400  (40%)  — Final survival phase
T=4:30  radius=1800  (30%)  — Extreme density
T=5:00  radius=1200  (20%)  — Final ring / round ends
```

**Implementation**:
```typescript
// In ArenaShrink.update():
const elapsed = (tick - roundStartTick) / TICK_RATE;  // seconds
if (elapsed < 60) return;  // No shrink first minute

// Linear shrink: -600px per minute = -10px per second = -0.5px per tick
const shrinkElapsed = elapsed - 60;  // seconds since shrink started
this.currentRadius = Math.max(
  1200,  // minimum radius
  6000 - (shrinkElapsed / 60) * 600
);
```

#### Boundary Penalty

```
If distance(agent.position, center) > currentRadius:
  overDistance = distance - currentRadius
  penalty = agent.mass * 0.0025 * (1 + overDistance / 100)  // escalating
  agent.takeDamage(penalty, 'boundary')
```

### 10.5 Map Objects

#### Placement Strategy

```
Round start → place objects deterministically:
  XP Shrine (3): Equidistant on ring at 60% radius
  Healing Spring (2): Opposite sides at 80% radius
  Upgrade Altar (1): Dead center (0, 0)
  Speed Gate (4): Cardinal directions at 50% radius

As arena shrinks:
  Objects outside new boundary → teleport to nearest valid position
  Objects within 200px of new boundary → marked as "endangered" (UI warning)
```

#### Object Interaction Protocol

```
Agent enters object radius (50px):
  XP Shrine: Apply 10s XP +50% buff → start 60s cooldown → glow dims
  Healing Spring: Heal 20% mass instantly → start 45s cooldown
  Upgrade Altar: Grant instant level-up → consumed (no respawn)
  Speed Gate: Apply 5s 2x speed buff → start 30s cooldown
```

### 10.6 Bot AI Architecture

#### Decision Tree (per tick)

```
1. Check survival urgency:
   - Outside shrink boundary? → behaveSurvive(moveInward)
   - Mass < 15? → behaveSurvive(avoidCombat)
   - Pending level-up? → chooseLevelUpgrade(buildPath)

2. Check strategic opportunities:
   - Nearby map object available? → moveToObject (XP Shrine priority)
   - Upgrade Altar available + mass > 50? → rushCenter
   - Near-synergy? → prioritize synergy-completing upgrade

3. Execute build-path strategy:
   - Aggressive: hunt weakest enemy within 300px
   - Defensive: farm orbs in safe zone, avoid combat
   - XP Rush: maximize orb collection, avoid all combat
   - Endgame: move to center, engage carefully

4. Default: behaviorWander() (with orb-seeking bias)
```

#### Bot Level-Up Decision

```typescript
function botChooseUpgrade(
  choices: UpgradeChoice[],
  buildPath: BuildPath,
  currentBuild: PlayerBuild,
  gameContext: GameContext
): number {
  // Priority 1: Complete a synergy
  for (let i = 0; i < choices.length; i++) {
    if (wouldCompleteSynergy(choices[i], currentBuild)) return i;
  }
  // Priority 2: Follow build path priority list
  for (const priorityType of buildPath.priority) {
    const idx = choices.findIndex(c => c.type === priorityType);
    if (idx >= 0) return idx;
  }
  // Priority 3: Upgrade existing ability
  for (let i = 0; i < choices.length; i++) {
    if (choices[i].isUpgrade) return i;
  }
  // Fallback: first choice
  return 0;
}
```

### 10.7 Reputation Points (RP) Meta-Progression System

#### RP Sources (earned per round)

| Source | RP Amount | Condition |
|--------|-----------|-----------|
| Round participation | +5 | Complete any round |
| Top 50% finish | +10 | Rank in upper half |
| Top 3 finish | +25 | 1st, 2nd, or 3rd place |
| 1st place win | +50 | Winner of round |
| Synergy completed | +10 | Activate any synergy during round |
| Hidden synergy first discovery | +100 | First player to discover a hidden synergy |
| 3+ kills in round | +5 | Kill 3 or more agents |

#### RP Unlocks (permanent progression)

| RP Required | Unlock | Description |
|-------------|--------|-------------|
| 50 | **Ability Slot +1** | 2 → 3 Ability slots (base is 2) |
| 100 | **Build History** | View last 50 rounds build statistics |
| 200 | **Agent Badges** | Win-rate badges (Bronze/Silver/Gold/Diamond) |
| 500 | **Counter Intel** | See current room agents' recent build patterns |
| 1000 | **Custom Synergy Hints** | Receive 3 hidden synergy hints upfront |

#### RP Storage

```
Phase 1-3: In-memory + JSON file
  /data/player-rp/{playerId}.json → { totalRP, unlockedFeatures[], questProgress }

Phase 4: REST API
  GET  /api/v1/players/{id}/rp → RP balance + unlocks
  POST /api/v1/players/{id}/rp → Award RP from round results

Phase 5+: PostgreSQL persistent storage
```

#### Quest System (8 quests, RP rewards)

| Quest | Condition | Reward |
|-------|-----------|--------|
| First Blood | First kill achieved | +20 RP |
| Synergy Master | Complete 3 different synergies | +50 RP |
| Speed Demon | Reach Speed Tome x5 | +30 RP |
| Pacifist | Top 3 with 0 kills | +100 RP |
| Glass Cannon | Win with Cursed Tome x5 | +150 RP |
| Discovery | Discover 1 hidden synergy | +100 RP |
| Comeback | Win from Lv3 or below | +200 RP |
| Marathon | Play 20 consecutive rounds | +100 RP |

## 11. Agent API & Training Architecture

### 11.1 Agent Connection Architecture (Phase 4+)

```
┌────────────────┐     ┌──────────────────┐     ┌───────────────┐
│  AI Agent      │────▶│  Agent Gateway    │────▶│  Game Server  │
│  (LLM Client)  │REST │  (HTTP + WS)     │ SIO │  (Room/Arena) │
│                │     │                  │     │               │
│  - Observe     │     │  - Auth + Token  │     │  - Same game  │
│  - Decide      │     │  - Rate limit    │     │    loop as    │
│  - Command     │     │  - Session mgmt  │     │    human      │
└────────────────┘     └──────────────────┘     └───────────────┘
```

**Phase 4 Implementation Plan**:
- Agent connects via REST API to register → receives session token
- Session token used for WebSocket connection (same Socket.IO server)
- Agent receives same events as human client (`state`, `level_up`, `death`, etc.)
- Agent sends commands as `input` events + new `commander_command` events

### 11.2 Commander Mode Event Flow

```
Observation (S→Agent, 10Hz reduced from 20Hz for LLM processing time):
  {
    type: 'observation',
    agents: AgentState[],        // Nearby agents (within 500px)
    orbs: OrbState[],            // Nearby orbs
    mapObjects: MapObject[],     // Map objects with availability
    myState: FullAgentState,     // Own full state including build
    gameContext: GameContext,     // Time, rank, arena radius
  }

Command (Agent→S):
  { cmd: 'go_to', x, y }
  { cmd: 'hunt_nearest' }
  { cmd: 'flee' }
  { cmd: 'engage_weak' }
  { cmd: 'set_combat_style', style: 'aggressive'|'defensive'|'balanced' }
  { cmd: 'choose_upgrade', choiceIndex: 0|1|2, reasoning?: string }
  // ... (full list in v10 plan section 6.2)
```

### 11.3 Training Profile Storage

```
Phase 1-3: In-memory + JSON file on server filesystem
  /data/agent-profiles/{agentId}.json

Phase 4: REST API for profile CRUD
  PUT /api/v1/agents/{id}/training → BuildProfile + CombatRules + StrategyPhases

Phase 5+: PostgreSQL persistent storage
```

### 11.4 Agent Memory System

```typescript
// Persistent across rounds, stored per agent
interface AgentMemory {
  buildPerformance: Record<string, BuildStats>;  // "berserker" → avg rank/kills
  discoveredSynergies: string[];
  synergyAttempts: Record<string, { attempts: number; completions: number }>;
  opponentProfiles: Record<string, OpponentProfile>;
  mapKnowledge: MapKnowledge;
}

// Updated after each round with RoundSummary data
// Phase 1-3: Not implemented (bots use static build paths)
// Phase 4+: Active learning from round results
```

### 11.5 Show & Learn Training Modes (Phase 4-5)

Three progressive training modes for users to teach their AI agents:

#### Mode 1: Observation (Phase 4)

Agent watches human play and records choices to build strategy rules.

```
Human plays game → Agent observes via `observe_game` API
  ├── Level-up choices recorded → "In this situation, user prefers this build"
  ├── Combat/flee patterns recorded → converted to combat rules
  └── Positioning patterns recorded → strategy phase preferences

Implementation:
  - `observe_game` API + client input event logging
  - Agent receives same state stream as human client
  - Post-round: observations compiled into BuildProfile suggestions
```

#### Mode 2: Feedback (Phase 4)

User reviews agent replay and annotates corrections.

```
Agent plays round → User reviews BuildHistory timeline
  ├── "At level 5, should have picked XP Tome instead of Venom" → rule added
  ├── "In this situation, fight instead of flee" → combat rule adjusted
  └── "Prioritize center positioning in late game" → strategy phase updated

Implementation:
  - Based on `RoundSummary.buildHistory` timeline + key events list
  - User annotation UI on top of text-based timeline
  - ⚠️ Tick-by-tick replay is Phase 5+. Phase 4 uses build history
    timeline (text) + key event list as substitute.
```

#### Mode 3: A/B Test (Phase 5)

Two agents with different profiles compete over 10 rounds for statistical comparison.

```
Agent A (Profile X) vs Agent B (Profile Y)
  ├── Both register simultaneously in same room
  ├── 10-round comparison with RoundSummary per round
  ├── Stats dashboard: avg rank, avg kills, avg level, win rate
  └── Better-performing profile auto-adopted (or user chooses)

Implementation:
  - 2 agent registrations + per-round RoundSummary comparison
  - Dashboard UI component for side-by-side stats
```

### 11.6 Training Console UI

Placed below the lobby RoomList as a **collapsible McPanel**:

```
TrainingConsole.tsx (collapsible McPanel)
├── TrainingHeader — agent status (online/offline, win rate, avg level)
├── BuildProfileEditor — build path selection + banned/required upgrades
├── CombatRulesEditor — if/then rule list + add/delete rules
├── StrategyPhaseEditor — early/mid/late strategy dropdowns
└── LearningLog — last 10 rounds result table
```

- Real-time sync via WebSocket `training_update` event
- McPanel styling (reuses existing design system)
- Mobile: converts to full-screen modal

## 12. Rendering Architecture (2D → 3D Migration Path)

### 12.1 Dual Renderer Strategy

```
Phase 1-3 (2D Canvas):
  lib/renderer/
    ├── index.ts       — Main render loop (requestAnimationFrame)
    ├── entities.ts    — Agent sprites (16x16 canvas), aura circles, effects
    ├── background.ts  — Grid, zone tints, shrink boundary, map objects
    └── ui.ts          — Nametags, XP bars, build indicators, minimap overlay

Phase 4+ (3D R3F):
  components/3d/
    ├── Scene.tsx          — R3F scene root (lighting, fog, sky)
    ├── AgentModel3D.tsx   — MC voxel character (BoxGeometry + skin textures)
    ├── CombatAura3D.tsx   — Translucent sphere around agent
    ├── VoxelTerrain.tsx   — Grass blocks, zone indicators
    ├── VoxelOrbs.tsx      — InstancedMesh spinning cube orbs
    ├── MapObjects3D.tsx   — Shrine/Spring/Altar/Gate 3D models
    ├── CameraSystem.tsx   — Play camera + spectator modes
    └── Effects3D.tsx      — Ability visual effects, synergy particles

Switching mechanism:
  const use3D = localStorage.getItem('renderer') === '3d';
  // Phase 4: user toggle
  // Phase 5: 3D default, 2D fallback for low-end devices
```

### 12.2 Agent 2D Sprite Generation

```
Input: AgentSkin properties
Output: OffscreenCanvas (16x16 for minimap, 32x32 for game view)

Render layers (bottom to top):
  1. Body base (bodyColor + legColor) — 2-tone rectangle
  2. Pattern overlay (striped/checkered/etc.) — patternColor
  3. Face (eyeStyle + mouthStyle) — pixel art on head region
  4. Equipment overlays (hat, armor, hand item) — small icon sprites
  5. Aura circle (combat range indicator) — semi-transparent ring

Cache: Map<skinId, OffscreenCanvas> — invalidated on skin change only
```

### 12.3 Coordinate System

```
Server (2D):  Position { x: number, y: number }
  Origin: center of arena (0, 0)
  Radius: 6000px (shrinking)
  Positive X: right, Positive Y: down

Client 2D:  Canvas pixel coordinates
  Transform: viewport offset + scale

Client 3D (Phase 4+):  Three.js world
  Mapping: x → x, y → z, height → y (always 0 for ground units)
  new Vector3(serverPos.x, 0, serverPos.y)
```

## 13. Performance Budget

### 13.1 Server Performance

| Metric | Target | Rationale |
|--------|--------|-----------|
| Tick rate | 20Hz (50ms) | Maintained from v7 |
| Tick budget | < 25ms per tick | 50% headroom for GC pauses |
| SpatialHash queries/tick | ~400 (20 agents x 20 neighbors) | Reduced from v7 (~3000 segment queries) |
| Memory per room | < 50MB | 20 agents + 1000 orbs + 10 map objects |
| Rooms per server | 5 concurrent | Unchanged from v7 |
| Max agents per room | 20 (5 human + 15 bot) | Unchanged from v7 |

**v10 Performance Win**: Eliminating segments[] dramatically reduces SpatialHash load.
- v7: 20 snakes x avg 15 segments = 300 entities in spatial hash
- v10: 20 agents = 20 entities in spatial hash (93% reduction)

### 13.2 Network Performance

| Metric | v7 | v10 | Change |
|--------|-----|------|--------|
| State payload per agent | ~120 bytes (segments) | ~50 bytes (position + build) | -58% |
| State broadcast (20 agents) | ~2.4 KB/tick | ~1.0 KB/tick | -58% |
| Bandwidth per client | ~48 KB/s | ~20 KB/s + event spikes | -58% avg |
| New event overhead | 0 | ~200 bytes/event (level_up, synergy) | Negligible (event-driven) |

### 13.3 Client Performance

| Metric | Target | Strategy |
|--------|--------|----------|
| Frame rate (desktop) | 60 FPS | 2D Canvas: lightweight sprite rendering |
| Frame rate (mobile) | 30 FPS | Reduced particle effects, simpler sprites |
| JS bundle (game page) | < 200 KB gzip | Code splitting, tree shaking |
| Time to interactive | < 3s | SSR lobby, lazy-load game canvas |
| Level-up overlay render | < 16ms | Pre-rendered card templates |
| Sprite generation | < 5ms per agent | OffscreenCanvas caching |

### 13.4 Scalability Limits

```
Current architecture (single Node.js process):
  5 rooms x 20 agents x 20Hz = 2000 state updates/second
  + event processing (level_up, combat, death) = ~500 events/second
  Total: ~2500 operations/second → well within single-thread capacity

Scaling path (Phase 5+):
  If > 5 rooms needed:
    Option A: Horizontal scaling with room-level sharding (each process owns N rooms)
    Option B: Worker threads for game loops (SharedArrayBuffer for state)
    Not needed for Phase 1-4 user base (<100 concurrent users expected)
```

## 14. Security Considerations

### 14.1 Threat Model (Game-Specific)

| Threat | Severity | Mitigation |
|--------|----------|------------|
| **Input spoofing** (fake angles at > 30Hz) | Medium | Rate limiter: max 30 input/s, excess dropped |
| **choose_upgrade manipulation** (invalid index) | Medium | Server validates index 0-2, ignores invalid |
| **Aura damage manipulation** | Low | All combat is server-authoritative, client cannot modify |
| **Speed hack** (boosting without mass cost) | Low | Server-authoritative movement, client is display-only |
| **Mass manipulation** | Low | mass is server state, never accepted from client |
| **Bot flooding** (too many connections) | Medium | Socket.IO connection limit per IP (existing) |
| **Agent API abuse** (Phase 4+) | High | Token-based auth, rate limit per agent, max 1 agent per user |
| **Memory exhaustion** (huge AgentSkin payloads) | Low | Validate AgentSkin fields on join, reject oversized payloads |

### 14.2 Server-Authoritative Design

```
ALL game state is computed server-side:
  - Agent position, mass, level, XP, build → server only
  - Combat damage → server calculates, client animates
  - Level-up choices → server generates, client displays
  - Synergy activation → server checks, client notifies

Client sends ONLY:
  - Steering angle (number, validated range 0~2pi)
  - Boost toggle (boolean)
  - Upgrade choice index (0, 1, or 2)
  - Room join/leave

No client-computed values are trusted.
```

### 14.3 Input Validation

```typescript
// Existing (maintained from v7):
- angle: clamp to [0, 2*PI]
- boost: boolean only
- rate: max 30 inputs/second per socket

// New (v10):
- choiceIndex: must be 0, 1, or 2
- choiceIndex: must be during active level-up window (5s timeout)
- AgentSkin: validate all enum fields against allowed values
- Agent name: max 20 chars, alphanumeric + underscore only
```

## 15. Migration Strategy (v7 → v10)

### 15.1 Phase Implementation Order

```
Phase 1: Entity Revolution + Core Survival (3 weeks)
  ├── Week 1: Snake→Agent types + AgentEntity rewrite + CollisionSystem rewrite
  ├── Week 2: UpgradeSystem (Tomes) + XP/Level + ArenaShrink + 1-Life
  └── Week 3: Bot AI expansion + integration testing + debugging

Phase 2: Abilities + Synergies (2 weeks)
  ├── Week 4: 6 Abilities + auto-trigger + synergy engine
  └── Week 5: Map objects + balance tuning + bot strategy testing

Phase 3: Client Rendering + Lobby (3 weeks)
  ├── Week 6: Agent 2D sprite renderer (entities.ts full rewrite)
  ├── Week 7: New overlays (LevelUp, BuildHUD, XPBar, ShrinkWarning, SynergyPopup)
  └── Week 8: Lobby redesign (AgentPreview, SkinCustomizer) + polish

Phase 4: Agent Integration + UI (1.5 weeks)
  ├── Agent API gateway + Commander Mode events
  ├── Training Console UI + agent memory system
  └── 3D R3F renderer migration start (AgentModel3D, terrain, effects)

Phase 5: Meta Progression + Live Service (ongoing)
  ├── RP system, quests, global leaderboard
  ├── Persistent database migration
  └── Season/battlepass infrastructure
```

### 15.2 Migration Risk Matrix

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| segments removal breaks interpolation | High | High | Rewrite interpolation first, test independently |
| SpatialHash refactor introduces collision bugs | High | Medium | Unit test all collision scenarios before integration |
| Upgrade balance is broken on first deploy | Medium | High | Bot-only testing for 50+ rounds before human testing |
| Client renderer rewrite delays Phase 3 | Medium | Medium | Phase 1-2 can deploy with minimal client (debug wireframe) |
| Agent API security holes | High | Medium | Phase 4 runs behind feature flag, invite-only beta |

### 15.3 File-Level Change Impact

```
HIGH IMPACT (full rewrite):
  apps/server/src/game/Snake.ts         → AgentEntity.ts
  apps/server/src/game/CollisionSystem.ts → new collision model
  apps/web/lib/renderer/entities.ts      → agent sprite renderer
  packages/shared/src/types/game.ts      → Agent type system
  packages/shared/src/constants/game.ts  → config restructure

MEDIUM IMPACT (significant modifications):
  apps/server/src/game/Arena.ts          → agents map + new subsystems
  apps/server/src/game/SpatialHash.ts    → simplified (segments removed)
  apps/server/src/game/BotBehaviors.ts   → expanded decision tree
  apps/server/src/game/StateSerializer.ts → new serialization format
  apps/web/hooks/useSocket.ts            → new events + agent state
  apps/web/lib/renderer/background.ts    → zones + shrink boundary
  apps/web/lib/interpolation.ts          → simplified (no segments)

LOW IMPACT (minor changes):
  apps/server/src/game/Room.ts           → shrink integration + 1-Life
  apps/server/src/game/OrbManager.ts     → XP value property
  apps/server/src/game/LeaderboardManager.ts → reference rename
  apps/server/src/network/SocketHandler.ts   → new event handlers
  apps/server/src/network/Broadcaster.ts     → new event broadcasts

NEW FILES:
  apps/server/src/game/UpgradeSystem.ts     (~250 LOC)
  apps/server/src/game/MapObjects.ts        (~100 LOC)
  apps/server/src/game/ArenaShrink.ts       (~60 LOC)
  packages/shared/src/constants/upgrades.ts (~200 LOC)
  apps/web/components/game/LevelUpOverlay.tsx
  apps/web/components/game/BuildHUD.tsx
  apps/web/components/game/XPBar.tsx
  apps/web/components/game/ShrinkWarning.tsx
  apps/web/components/game/SynergyPopup.tsx
```

### 15.4 Deployment Strategy

```
Phase 1-2 (server-only changes):
  - Deploy to Railway staging environment
  - Run automated bot-only games for balance testing
  - No client changes needed (server sends v10 state format)
  - Client shows raw position data (degraded but functional)

Phase 3 (client + server):
  - Feature branch deployment to Vercel preview URL
  - Parallel: v7 production + v10 preview
  - User testing on preview URL
  - Cutover: DNS switch when stable

Phase 4+ (agent API):
  - Behind feature flag: /api/v1/agents/* routes
  - Invite-only beta for AI agent developers
  - Rate limiting: 10 commands/second per agent
```

## 16. Sequence Diagrams

### 16.1 Level-Up Flow

```
Client              SocketHandler       Arena/UpgradeSystem      AgentEntity
  │                     │                     │                     │
  │                     │    processOrbCollection()                 │
  │                     │    ──────────────────▶                    │
  │                     │                     │  agent.addXP(value) │
  │                     │                     │ ──────────────────▶ │
  │                     │                     │ ◀── returns true    │
  │                     │                     │     (level up!)     │
  │                     │                     │                     │
  │                     │  generateChoices(agent)                   │
  │                     │  ──────────────────▶│                     │
  │                     │  ◀── 3 UpgradeChoice[]                   │
  │                     │                     │                     │
  │    level_up event   │                     │                     │
  │◀────────────────────│                     │                     │
  │                     │                     │                     │
  │  (user selects)     │                     │                     │
  │  choose_upgrade {1} │                     │                     │
  │────────────────────▶│                     │                     │
  │                     │  applyUpgrade(agent, choice[1])           │
  │                     │  ──────────────────▶│                     │
  │                     │                     │  checkSynergies()   │
  │                     │                     │ ──────────────────▶ │
  │                     │                     │                     │
  │  choose_upgrade_ack │                     │                     │
  │◀────────────────────│                     │                     │
  │                     │                     │                     │
  │  (if synergy found) │                     │                     │
  │  synergy_activated  │                     │                     │
  │◀────────────────────│                     │                     │
```

### 16.2 Auto-Combat Flow (Per Tick)

```
Arena.gameLoop()
  │
  ├── moveAgents()
  │     └── For each alive agent: update position based on heading + speed
  │
  ├── CollisionSystem.process()
  │     ├── auraCollisions()
  │     │     ├── SpatialHash.queryRadius(agent, 60px)
  │     │     ├── For each pair: mutual DPS → takeDamage()
  │     │     └── If mass <= 0: push to deathQueue[]
  │     │
  │     ├── dashCollisions()
  │     │     ├── For each boosting agent: queryRadius(hitbox)
  │     │     └── Apply 30% mass burst to non-boosting targets
  │     │
  │     └── boundaryCheck()
  │           └── Agents outside shrink radius: mass penalty
  │
  ├── processOrbCollection()
  │     └── Orbs within collectRadius: addXP() + addMass()
  │
  ├── UpgradeSystem.processAbilities()
  │     └── Check auto-trigger conditions → apply ability effects
  │
  ├── ArenaShrink.update()
  │     └── If time threshold passed: reduce radius, emit arena_shrink
  │
  ├── MapObjects.checkInteractions()
  │     └── Agents within object radius: apply effects
  │
  ├── resolveDeaths()
  │     └── Process deathQueue: emit death/kill events, spawn death orbs
  │
  └── StateSerializer.getStateForPlayer()
        └── Viewport cull → serialize agents + orbs + mapObjects → broadcast
```

### 16.3 Round Lifecycle

```
Room State Machine:
  WAITING ──(min_players_met)──▶ COUNTDOWN(10s)
    │                                │
    │                          (countdown=0)
    │                                │
    │                                ▼
    │                           PLAYING(5min)
    │                                │
    │                   ┌─── each 60s: arena_shrink
    │                   ├─── level_up events
    │                   ├─── death/kill events
    │                   ├─── synergy_activated events
    │                   │
    │                   └─── (timer=0 OR 1 agent left)
    │                                │
    │                                ▼
    │                           ENDING(10s)
    │                                │
    │                          (show results)
    │                                │
    │                                ▼
    │                          COOLDOWN(15s)
    │                                │
    └───────────────────◀────────────┘
```

## 17. Architecture Decision Records (ADRs)

### ADR-001: Snake→Agent Entity Model Transformation

**Status**: Accepted

**Context**: The v7 snake entity uses `segments: Position[]` (head + body chain) which permeates every system: SpatialHash indexes segments individually, CollisionSystem checks head-body intersections, StateSerializer transmits all segment positions, renderers draw circles along the path. The v10 design replaces this with a single-position agent with an aura-based combat model.

**Decision**: Full entity rewrite rather than incremental adaptation. Replace `SnakeEntity` class with `AgentEntity` class. Remove all segment-related code paths simultaneously in Phase 1.

**Consequences**:
- Positive: 93% reduction in SpatialHash entities, ~58% network bandwidth reduction, dramatically simpler movement code (170→120 LOC), cleaner combat model
- Negative: Breaking change — all downstream systems must update simultaneously (big-bang Phase 1). No backward compatibility with v7 clients.
- Risk: Phase 1 is a 3-week sprint with high integration risk. Mitigated by comprehensive bot testing before human exposure.

**Alternatives Considered**:
1. *Incremental migration* (keep segments, add agent fields gradually): Rejected — dual entity model would be more complex than either alone, and segments are fundamentally incompatible with aura combat.
2. *Adapter pattern* (AgentEntity wraps SnakeEntity): Rejected — the entity internals are too different; an adapter would be more code than a clean rewrite.

---

### ADR-002: Server-Side Upgrade/Combat Authority

**Status**: Accepted

**Context**: The upgrade system (Tome stacks, Ability triggers, synergy checks) and combat system (aura DPS, dash bursts) could theoretically be computed client-side for responsiveness, or server-side for authoritative gameplay.

**Decision**: All upgrade and combat logic is 100% server-authoritative. Client is display-only. Level-up choices are generated server-side, applied server-side, and synergy checks run server-side.

**Consequences**:
- Positive: No cheating vectors for build manipulation, damage modification, or speed hacks. Single source of truth for competitive fairness.
- Negative: Level-up overlay has ~50-100ms latency (1-2 ticks) between selection and confirmation. Ability visual effects may lag slightly behind server trigger.
- Mitigation: Client can play optimistic animations for abilities (revert if server disagrees). Level-up 5s timeout provides ample time despite latency.

---

### ADR-003: 2D-First Rendering with 3D Migration Path

**Status**: Accepted

**Context**: The lobby already uses R3F 3D. v10 could either go full 3D immediately or start with 2D Canvas for the game view and migrate later.

**Decision**: Phase 1-3 use 2D Canvas (16x16 sprites, top-down view). Phase 4+ migrates to 3D R3F. The rendering layer is abstracted behind a `Renderer` interface to enable clean switching.

**Consequences**:
- Positive: Phase 1-3 ships faster (2D sprites are simpler than voxel models). Core gameplay can be validated without 3D complexity. Mobile performance is guaranteed in 2D.
- Negative: Some visual features (3D effects, depth perception) are deferred. Players may perceive 2D as lower quality than the 3D lobby.
- Mitigation: 2D renderer uses MC-style pixel art aesthetics that match the lobby theme. 3D migration is planned from the start so rendering code is organized for replacement.

---

### ADR-004: In-Memory State with JSON Persistence

**Status**: Accepted (Phase 1-4), Superseded by DB in Phase 5+

**Context**: Agent profiles, build performance data, RP points, and quest progress need persistence. Options: database from day 1, or lightweight JSON files.

**Decision**: Phase 1-4 use in-memory state with JSON file backup on server filesystem. No database dependency. Phase 5+ migrates to PostgreSQL.

**Consequences**:
- Positive: Zero infrastructure overhead. Deployment stays simple (single Railway process). Development velocity maximized.
- Negative: Data loss on server restart (JSON backup is periodic, not transactional). No multi-server scaling. No complex queries.
- Mitigation: Agent profiles are small (< 1KB each). JSON backup every 60 seconds. Railway has persistent filesystem across deploys.

---

### ADR-005: Bot Build Path System

**Status**: Accepted

**Context**: Bots need to make level-up decisions that create interesting and varied gameplay. Options: random selection, hardcoded sequences, or build path system.

**Decision**: 5 predefined build paths (Berserker, Tank, Speedster, Vampire, Scholar) randomly assigned to bots on creation. Each path defines upgrade priority + phase-based strategy transitions.

**Consequences**:
- Positive: Diverse bot behaviors create varied gameplay. Players encounter different "meta" builds. Build paths can be tuned for balance.
- Negative: 5 paths may become predictable after many rounds.
- Mitigation: Phase 4+ introduces "Adaptive" and "Experimenter" bot personalities that learn from round results.

## 18. Open Questions

| # | Question | Impact | Decision Needed By |
|---|----------|--------|--------------------|
| OQ-1 | Should Ability auto-trigger be fully server-controlled or should agents set priority order? | Medium — affects Agent API complexity | Phase 2 start |
| OQ-2 | ~~Should arena shrink be linear or phased?~~ **Resolved**: Linear -600px/min matching Plan §8.2 | — | Resolved |
| OQ-3 | Should dead agents become spectators automatically or require opt-in? | Low — UX decision | Phase 3 client work |
| OQ-4 | Should hidden synergies have any server-side hints or be purely discovery-based? | Low — affects hint system complexity | Phase 2 |
| OQ-5 | Should the Upgrade Altar (instant level-up) respawn after arena shrink removes its position? | Medium — affects late-game strategy | Phase 2 map objects |
| OQ-6 | Should bot names reflect their build path (e.g., "Bot_Berserker_3") for transparency? | Low — UX preference | Phase 1 |
| OQ-7 | What is the minimum mass threshold below which aura damage is reduced (to prevent instant-death chains)? | High — affects combat balance | Phase 1 combat testing |
| OQ-8 | Should the 30-second grace period apply to bots or only human players? | Medium — affects early game density | Phase 1 |

---

*Generated by DAVINCI /da:system — 2026-03-06*
