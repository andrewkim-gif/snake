# v19 Arena Integration — System Architecture Document

> Generated: 2026-03-08 | Phase: da:system | Project Type: GAME
> Plan Source: `docs/designs/v19-arena-integration-plan.md`

---

## 1. Overview

v19 unifies three currently disconnected systems into a single coherent game experience:

1. **MC Engine** (MCTerrain + MCNoise + mc-materials + mc-terrain-worker) — procedural voxel world
2. **GameCanvas3D** (v10-v17) — multiplayer TPS game with server-authoritative combat
3. **v18 Arena Combat** (ar_*.go + AR*.tsx) — auto-battle survival roguelike mechanics

The architecture replaces HeightmapTerrain with MCTerrain as the arena floor, wires the 5 disconnected server integration gaps to connect `ar_combat.go` to `room.go`, ports selected AR* UI components into GameCanvas3D, and unifies the coordinate system to MC block units.

**Key Metrics:**
- Server: 24 existing `ar_*.go` files (10,517 lines) — wire into existing room lifecycle
- Client: 17 existing `AR*.tsx` components — selectively port 10, delete 4, replace 3
- MC Engine: 4 lib files + 5 components — add `arenaMode` prop to MCTerrain
- Coordinate migration: continuous float (radius ~3000) → MC block integers (radius ~80)
- Net new code estimate: ~2,500 lines (mostly wiring + MCTerrain arenaMode + coordinate utils)

## 2. Goals / Non-Goals

### Goals

| # | Goal | Success Criteria |
|---|------|-----------------|
| G1 | MCTerrain is the arena floor | GameCanvas3D renders procedural voxel terrain per country seed; HeightmapTerrain removed |
| G2 | v18 combat runs server-side | `ar_combat.go` OnTick() called from `room.go` tickPlaying(); 5 integration gaps closed |
| G3 | Single game entry path | Globe click → character select → GameCanvas3D with MCTerrain + arena combat; no `/arena` page |
| G4 | MC block coordinate system | All arena logic uses integer block units; no coordinate conversion layer |
| G5 | Client-side height sampling | Agents walk on voxel surface via MCNoise.getSurfaceOffset(); server tracks X/Z only |
| G6 | Selective AR* porting | 10 AR* components ported into GameCanvas3D; 4 deleted; 3 replaced by existing equivalents |
| G7 | Performance | Draw calls <500, triangles <2M, GPU <200MB in arena mode |

### Non-Goals

| # | Non-Goal | Reason |
|---|----------|--------|
| NG1 | FPS camera in arena | TPS is better for auto-battle observation (ADR-002) |
| NG2 | Block destruction/placement in arena | Arena is combat, not building |
| NG3 | Infinite terrain | Arena is bounded (radius 80 blocks ≈ 3.3 chunks) |
| NG4 | Server-side terrain mesh | MCNoise is deterministic from seed; server needs X/Z only (ADR-006) |
| NG5 | New token types | Existing $AWW + country tokens reused |
| NG6 | Classic combat removal | Classic mode (CombatModeClassic) preserved for backward compatibility |

## 3. Architecture Decisions (ADR Summary)

All ADRs inherited from the plan. Architecture adds implementation details:

| ADR | Decision | Architecture Implication |
|-----|----------|-------------------------|
| **ADR-001** | MCTerrain as arena floor | `MCTerrainProps` gains `arenaMode` prop; `mc-terrain-worker.ts` gains boundary clamp logic; `MCNoise` gains `clampedGetSurfaceOffset()` |
| **ADR-002** | TPS camera (not FPS) | `TPSCamera.tsx` unchanged; `MCCamera.tsx` available but unused in arena mode |
| **ADR-003** | Server-side combat | `room.go` `tickPlaying()` branches on `IsArenaCombat()` → delegates to `ar_combat.go` `OnTick()`; events flow through existing `RoomEventCallback` |
| **ADR-004** | Single entry point | `app/arena/` deleted; `page.tsx` entry flow: globe → `ARCharacterSelect` → `joinCountryArena(iso3, characterType)` → GameCanvas3D `isArenaMode=true` |
| **ADR-005** | MC block coordinates | New `ArenaCoordinateSystem` constants: `ARENA_RADIUS_BLOCKS=80`, `MOVE_SPEED_BPS=6` (blocks/sec), `ATTACK_RANGE_BLOCKS=3`; server `ar_combat.go` operates in block units natively |
| **ADR-006** | Client-side height | `AgentInstances.tsx` `useFrame` loop: `y = MCNoise.getSurfaceOffset(agent.x, agent.z) + MC_BASE_Y + 1`; same for enemies; server omits `agent.z` in arena mode state |
| **ADR-007** | AR* disposition | 10 KEEP (port to GameCanvas3D), 4 DELETE (redundant), 3 REPLACE (existing equivalents); see Section 11 |

### ADR-008: Arena State Serialization (NEW)

**Status**: Proposed
**Context**: `ar_combat.go` `GetState()` returns `interface{}`. GameCanvas3D expects `AgentNetworkData[]` + `OrbNetworkData[]` via existing protocol. Two serialization paths needed.
**Decision**: Arena mode adds `ARStatePayload` alongside existing state protocol. New event type `ar_state` (already defined as `RoomEvtARState`). Client distinguishes by event type. Both payloads share the same WebSocket frame structure.
**Consequence**: Dual state path in `broadcastState()`. `isArenaMode` flag on client determines which renderer components mount.

### ADR-009: MCNoise Determinism Guarantee (NEW)

**Status**: Proposed
**Context**: Client-side height sampling (ADR-006) requires all clients to compute identical Y for same (x, z, seed). MCNoise uses `ImprovedNoise` with Math.random() in permutation table initialization.
**Decision**: MCNoise constructor must accept a seed parameter that deterministically initializes the permutation table (seeded PRNG, not Math.random()). The existing `MCNoise` already uses `seed` field but `ImprovedNoise` uses `Math.random()`. Fix: replace `Math.random()` with seeded shuffle in `ImprovedNoise` constructor.
**Consequence**: All clients with same seed produce identical terrain. Server can optionally port MCNoise to Go for boundary validation.

## 4. System Context (C4 Level 1)

```
┌─────────────────────────────────────────────────────────────────┐
│                         AI World War                            │
│                    (Browser-based Game)                          │
└─────────────────┬───────────────────────────┬───────────────────┘
                  │                           │
         ┌────────▼────────┐         ┌────────▼────────┐
         │  Next.js Client │         │   Go Server     │
         │  (R3F + React)  │◄───────►│  (WebSocket)    │
         │  Port 9001      │  WS     │  Port 9000      │
         └────────┬────────┘         └────────┬────────┘
                  │                           │
         ┌────────▼────────┐         ┌────────▼────────┐
         │  Browser APIs   │         │  Redis (opt)    │
         │  Web Worker     │         │  Cache/PubSub   │
         │  WebGL/R3F      │         └─────────────────┘
         └─────────────────┘
```

**Actors**: Human Player (browser), AI Agent (API client), Server (game authority)
**External Systems**: CROSS Mainnet (tokens), Redis (optional cache), Vercel (frontend CDN), Railway (backend)

## 5. Container Diagram (C4 Level 2)

```
┌───────────────────── Go Server (Port 9000) ──────────────────────┐
│                                                                   │
│  ┌──────────┐    ┌─────────────┐    ┌──────────────────────────┐ │
│  │ main.go  │───►│ WorldManager│───►│ CountryArenaManager      │ │
│  │ (entry)  │    │ (195 ctry)  │    │ (lazy Room creation)     │ │
│  └──────────┘    └─────────────┘    └────────┬─────────────────┘ │
│       │                                      │                    │
│  ┌────▼─────┐                    ┌───────────▼──────────────┐    │
│  │ ws.Hub   │                    │ Room (state machine)      │    │
│  │ EventRtr │◄──── RoomEvents ───│  ├─ Arena (classic)       │    │
│  └──────────┘                    │  ├─ ArenaCombat (v18) ◄─┐ │    │
│                                  │  ├─ EpochManager        │ │    │
│                                  │  ├─ BotManager          │ │    │
│                                  │  └─ StateSerializer     │ │    │
│                                  └─────────────────────────┘ │    │
│                                                              │    │
│  ┌── ar_*.go (24 files) ────────────────────────────────────┘    │
│  │ ar_combat.go   — 5-phase battle engine (1,492 lines)          │
│  │ ar_weapon.go   — 16 weapons + projectiles (976 lines)         │
│  │ ar_tome.go     — 16 Tomes + status effects (480 lines)        │
│  │ ar_pvp.go      — faction PvP + arena shrink (740 lines)       │
│  │ ar_room_integration.go — Room ↔ ArenaCombat bridge (341 lines)│
│  │ ... (19 more)                                                 │
│  └───────────────────────────────────────────────────────────────┘
└───────────────────────────────────────────────────────────────────┘

┌───────────── Next.js Client (Port 9001) ─────────────────────────┐
│                                                                   │
│  ┌──────────┐    ┌─────────────┐    ┌──────────────────────────┐ │
│  │ page.tsx │───►│ WorldView   │───►│ GameCanvas3D             │ │
│  │ (router) │    │ (globe)     │    │  ├─ MCTerrain (NEW!)     │ │
│  └──────────┘    └─────────────┘    │  ├─ AgentInstances       │ │
│                                     │  ├─ TPSCamera            │ │
│  ┌──────────┐                       │  ├─ GameLoop             │ │
│  │ useSocket│◄─── WebSocket ────────│  ├─ ArenaBoundary        │ │
│  │ Provider │                       │  ├─ OrbInstances→XP      │ │
│  └──────────┘                       │  ├─ DamageNumbers        │ │
│                                     │  └─ [AR* ported overlays]│ │
│  ┌── MC Engine ──────────────────┐  └──────────────────────────┘ │
│  │ mc-noise.ts    (terrain gen)  │                                │
│  │ mc-materials.ts (12 blocks)   │                                │
│  │ mc-terrain-worker.ts (Worker) │                                │
│  │ mc-types.ts    (constants)    │                                │
│  │ MCTerrain.tsx  (renderer)     │                                │
│  └───────────────────────────────┘                                │
└───────────────────────────────────────────────────────────────────┘
```

**Key Changes from v18**:
- `Room.tickPlaying()` now branches: `IsArenaCombat()` → `TickArenaCombat()`
- `GameCanvas3D` conditionally renders MCTerrain (arena) vs HeightmapTerrain (classic)
- `page.tsx` inserts `ARCharacterSelect` before arena entry
- MC engine (`mc-noise`, `mc-materials`, `mc-terrain-worker`) now used inside GameCanvas3D

## 6. Component Design (C4 Level 3)

### 6.1 Server Components

#### 6.1.1 Room State Machine (room.go) — MODIFIED

Current state machine is unchanged: `waiting → countdown → playing → ending → cooldown`.

**Changes in `tickPlaying()`** (line 227):
```go
func (r *Room) tickPlaying() {
    r.stateTicksLeft--
    if r.stateTicksLeft <= 0 { r.endRound(); return }

    // ── v19 BRANCH: Arena vs Classic combat ──
    if r.IsArenaCombat() {
        r.tickArenaCombat()    // NEW: delegates to ar_room_integration.go
    } else {
        r.tickClassicCombat()  // EXTRACTED: existing logic moved to method
    }
}
```

**Changes in `startRound()`** (line 337):
```go
func (r *Room) startRound() {
    r.round++
    if r.IsArenaCombat() {
        r.InitArenaCombat()    // ar_room_integration.go (already exists)
    } else {
        r.arena.Reset()        // existing classic path
        // ... existing bot spawn, player spawn
    }
    r.transitionTo(domain.RoomStatePlaying)
}
```

#### 6.1.1b Room endRound() Arena Path — NEW

The existing `endRound()` (line 368) stops the arena, generates leaderboard from classic Arena, and emits results. Arena mode needs a separate path:

```go
func (r *Room) endRound() {
    if r.IsArenaCombat() {
        r.endRoundArena()
        return
    }
    // ... existing classic endRound unchanged ...
}

func (r *Room) endRoundArena() {
    // 1. Get arena combat results
    rankings := r.arState.Combat.GetRankings()
    factionResults := r.arState.Combat.GetFactionResults()

    // 2. Process rewards (ar_reward.go)
    rewards := ProcessArenaRewards(rankings, r.Config.CountryTier, r.Config.CountryISO3)

    // 3. Integrate sovereignty (ar_pvp.go)
    IntegrateArenaPvPResults(factionResults, r.Config.CountryISO3)

    // 4. Broadcast battle end
    r.emitEvents([]RoomEvent{{
        RoomID: r.ID,
        Type:   RoomEvtARBattleEnd,
        Data:   ARBattleEndPayload{Rankings: rankings, Rewards: rewards, FactionWinner: factionResults.Winner},
    }})

    // 5. Cleanup combat state
    r.arState.Combat.Cleanup()
    r.arState = nil

    // 6. Transition to ending
    r.transitionTo(domain.RoomStateEnding)
}
```

#### 6.1.2 ArenaCombat Engine (ar_combat.go) — UNCHANGED

Already implements `CombatMode` interface with 8 methods. `OnTick(delta, tick)` returns `[]CombatEvent` covering:
- Wave spawning (PvE phase)
- Auto-attack processing (`tickWeaponAutoAttack`)
- Projectile updates
- XP crystal collection
- Phase transitions (Deploy→PvE→PvP Warning→PvP→Settlement)
- Arena shrink (PvP phase)
- Final boss (Settlement phase)

No modifications needed — it's a pure engine.

#### 6.1.3 AR Room Integration (ar_room_integration.go) — EXTENDED

Current: `InitArenaCombat()`, `IsArenaCombat()`, bot spawning.

**New methods**:
```go
// tickArenaCombat processes one arena tick and broadcasts results.
func (r *Room) tickArenaCombat() {
    dt := 1.0 / float64(TickRate)  // 0.05s at 20Hz
    tick := r.arena.GetTick()

    // 1. Run combat engine
    events := r.arState.Combat.OnTick(dt, tick)

    // 2. Run AI bots (tactical 2Hz, reflexive 20Hz)
    r.tickArenaBots(dt, tick)

    // 3. Convert CombatEvents → RoomEvents + broadcast
    r.broadcastArenaEvents(events)

    // 4. Broadcast arena state at 20Hz
    r.broadcastArenaState()
}

// broadcastArenaState serializes ARStatePayload and emits RoomEvtARState.
func (r *Room) broadcastArenaState() { ... }

// broadcastArenaEvents converts []CombatEvent → []RoomEvent.
func (r *Room) broadcastArenaEvents(events []CombatEvent) { ... }
```

#### 6.1.4 CountryArenaManager (country_arena.go) — MODIFIED

**Change in `GetOrCreateArena()`**: Set `CombatMode = CombatModeArena` on all new arenas:
```go
cfg.CombatMode = CombatModeArena  // v19: all country arenas use arena combat
cfg.CountryTier = worldMgr.GetCountryTier(countryCode)
```

**Change in `JoinPlayer()` response**: Extend the `joined` event payload to include arena metadata:
```go
// In JoinPlayer() after adding player to room:
joinedData := domain.JoinedEvent{
    RoomID:   wrapper.Room.ID,
    PlayerID: clientID,
    // ... existing fields ...
    // v19 NEW:
    IsArenaMode:  wrapper.Room.IsArenaCombat(),
    ArenaSeed:    countryHash(countryCode),  // Deterministic hash
    ArenaRadius:  TierArenaRadius(wrapper.Room.Config.CountryTier),
    CountryTier:  wrapper.Room.Config.CountryTier,
}
```
This ensures the client receives all information needed to initialize MCTerrain + arena mode on `joined`.

#### 6.1.5 main.go Event Handlers — EXTENDED

**Gap 4 wiring**: Register `ar_input` and `ar_choose` socket events:
```go
// ar_input (C→S): Movement/aim input for arena combat
router.On("ar_input", func(client *ws.Client, data json.RawMessage) {
    var input game.ARInput
    json.Unmarshal(data, &input)
    wm.RouteARInput(client.ID, input)
})

// ar_choose (C→S): Tome/weapon selection during level-up
router.On("ar_choose", func(client *ws.Client, data json.RawMessage) {
    var choice game.ARChoice
    json.Unmarshal(data, &choice)
    wm.RouteARChoose(client.ID, choice)
})
```

#### 6.1.6 WorldManager (world_manager.go) — EXTENDED

**New routing methods**:
```go
func (wm *WorldManager) RouteARInput(clientID string, input game.ARInput) {
    countryCode := wm.arenaManager.GetPlayerCountry(clientID)
    if arena := wm.arenaManager.GetArena(countryCode); arena != nil {
        arena.Room.HandleARInput(clientID, input)
    }
}

func (wm *WorldManager) RouteARChoose(clientID string, choice game.ARChoice) {
    // Same routing pattern
}
```

### 6.2 Client Components

#### 6.2.1 GameCanvas3D (GameCanvas3D.tsx) — MODIFIED

**New Props**:
```tsx
interface GameCanvas3DProps {
  // ... existing props unchanged ...
  isArenaMode: boolean;           // v19: toggle arena vs classic rendering
  arenaSeed: number;              // v19: country hash for MCTerrain seed
  arenaRadius: number;            // v19: arena radius in MC blocks
  characterType?: string;         // v19: selected character for arena
}
```

**Conditional Rendering** (inside R3F Canvas):
```tsx
{isArenaMode ? (
  <>
    <MCTerrain
      seed={arenaSeed}
      customBlocks={[]}
      arenaMode={{ radius: arenaRadius, flattenVariance: 5, seed: arenaSeed }}
    />
    {/* Arena-specific scene lighting */}
  </>
) : (
  <>
    <HeightmapTerrain data={heightmapData} biomeData={biomeData} />
    <ZoneTerrain ... />
    <TerrainDeco ... />
  </>
)}
```

**Conditional HUD** (outside Canvas, HTML overlays):
```tsx
{isArenaMode ? (
  <>
    <ArenaHUD />        {/* Merged from ARHUD: wave/timer/kill/phase */}
    <ArenaLevelUp />    {/* Ported ARLevelUp: 3-card Tome selection */}
    <ArenaMinimap />    {/* Extended ARMinimap: arena boundary + enemies */}
    <ArenaPvPOverlay /> {/* Ported ARPvPOverlay: kill feed + faction scores */}
  </>
) : (
  <>
    <EpochHUD />
    <ScoreboardOverlay />
    {/* ... existing classic HUD ... */}
  </>
)}
```

#### 6.2.2 MCTerrain (MCTerrain.tsx) — EXTENDED

**New `arenaMode` prop**:
```tsx
interface MCTerrainProps {
  seed: number;
  customBlocks: CustomBlock[];
  onTerrainReady?: (data: { blocks: BlockInstance[]; idMap: Record<string, number> }) => void;
  arenaMode?: {
    radius: number;           // Arena radius in blocks (e.g., 80)
    flattenVariance: number;  // Max height deviation ±N blocks (e.g., 5)
    seed: number;             // Country hash seed
  };
}
```

**Worker message extension**: When `arenaMode` is set, `TerrainWorkerInput` includes:
```tsx
interface TerrainWorkerInput {
  // ... existing fields ...
  arenaMode?: {
    centerX: number;  // Always 0 (arena center)
    centerZ: number;  // Always 0
    radius: number;   // Block radius
    flattenVariance: number;
  };
}
```

**Behavioral changes in arena mode**:
1. Only generates chunks within `radius` blocks of origin (not infinite)
2. `getSurfaceOffset()` clamped to `±flattenVariance` (playable surface)
3. `useFrame` chunk update disabled (static arena, no camera-driven loading)
4. Initial chunk generation: single batch at mount time (not progressive)

#### 6.2.3 AgentInstances (AgentInstances.tsx) — MODIFIED

**Arena mode height sampling**:
```tsx
// In useFrame loop:
if (isArenaMode && noiseRef.current) {
  const surfaceY = noiseRef.current.getSurfaceOffset(agent.x, agent.z) + MC_BASE_Y + 1;
  dummy.position.set(agent.x, surfaceY, agent.z);
} else {
  dummy.position.set(agent.x, agent.y, agent.z); // Classic: server-provided Y
}
```

**Enemy subtypes**: Arena enemies rendered with color/scale variants based on `enemyType` field:
- Zombie: green tint, standard size
- Skeleton: white/bone, thin
- Slime: green, 0.5x scale
- Spider: dark, 0.8x wide
- Creeper: green, flashing when near

#### 6.2.4 page.tsx Entry Flow — MODIFIED

```tsx
// v19: Arena entry with character selection
const [showCharSelect, setShowCharSelect] = useState(false);
const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);

const handleEnterArena = useCallback((iso3: string) => {
  setShowCharSelect(true);  // Show ARCharacterSelect overlay
  setPendingCountry(iso3);
}, []);

const handleCharacterSelected = useCallback((charType: string) => {
  setShowCharSelect(false);
  setSelectedCharacter(charType);
  socket.joinCountryArena(pendingCountry, charType);  // Extended payload
  setMode('transitioning');
  // ... fade + transition to GameCanvas3D with isArenaMode=true
}, []);
```

#### 6.2.5 New/Ported Overlay Components

| Component | Source | Location | Description |
|-----------|--------|----------|-------------|
| `ArenaHUD.tsx` | Ported from `ARHUD.tsx` | `components/game/` | Wave counter, timer, kill count, phase indicator |
| `ArenaLevelUp.tsx` | Ported from `ARLevelUp.tsx` | `components/game/` | 3-card Tome selection popup |
| `ArenaMinimap.tsx` | Ported from `ARMinimap.tsx` | `components/game/` | SVG radar with arena boundary + enemy positions |
| `ArenaPvPOverlay.tsx` | Ported from `ARPvPOverlay.tsx` | `components/game/` | Kill feed, faction scores, boss HP |
| `ArenaBattleRewards.tsx` | Ported from `ARBattleRewards.tsx` | `components/game/` | Post-battle dual token rewards |
| `ArenaSpectate.tsx` | Ported from `ARSpectateOverlay.tsx` | `components/game/` | Death spectate UI |
| `ArenaCharSelect.tsx` | Ported from `ARCharacterSelect.tsx` | `components/lobby/` | Pre-arena character picker |
| `ArenaProfile.tsx` | Ported from `ARProfile.tsx` | `components/hub/` | Lifetime stats screen |
| `ArenaQuestPanel.tsx` | Ported from `ARQuestPanel.tsx` | `components/hub/` | Quest display |
| `ArenaSeasonPass.tsx` | Ported from `ARSeasonPass.tsx` | `components/hub/` | Season pass viewer |

### 6.3 Shared Protocol

#### WebSocket Events (Client ↔ Server)

**Existing events (unchanged)**:
- `join_country_arena` (C→S): Extended with `characterType` field
- `input` (C→S): Classic movement (unchanged)
- `state` (S→C): Classic state broadcast (unchanged)
- `joined`, `death`, `kill`, `level_up` (S→C): Unchanged

**New arena events**:
| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `ar_input` | C→S | `{ moveAngle: number\|null, aimAngle: number }` | Arena movement input (20Hz) |
| `ar_choose` | C→S | `{ type: "tome"\|"weapon", id: string }` | Tome/weapon selection |
| `ar_state` | S→C | `ARStatePayload` (see below) | Arena state broadcast (20Hz) |
| `ar_damage` | S→C | `{ targetId, amount, isCrit, element }` | Damage number event |
| `ar_level_up` | S→C | `{ choices: TomeChoice[3] }` | Level-up prompt |
| `ar_kill` | S→C | `{ killerId, victimId, weapon }` | Kill notification |
| `ar_phase_change` | S→C | `{ phase, timer, shrinkRadius? }` | Phase transition |
| `ar_battle_end` | S→C | `{ rankings, rewards }` | Battle ended |
| `ar_pvp_kill` | S→C | `{ killerId, victimId, factionId }` | PvP kill |
| `ar_boss_spawn` | S→C | `{ bossType, hp, position }` | Final boss spawned |

**ARStatePayload** (20Hz broadcast):
```typescript
interface ARStatePayload {
  tick: number;
  phase: ARPhase;       // "deploy"|"pve"|"pvp_warning"|"pvp"|"settlement"
  phaseTimer: number;   // seconds remaining
  wave: number;
  arenaRadius: number;  // current (may shrink in PvP)

  players: {
    id: string;
    x: number;          // MC block X
    z: number;          // MC block Z (server omits Y)
    hp: number;
    maxHp: number;
    level: number;
    weapon: string;
    factionId: string;
    isDead: boolean;
  }[];

  enemies: {
    id: number;
    type: string;       // "zombie"|"skeleton"|"slime"|"spider"|"creeper"
    x: number;
    z: number;
    hp: number;
    maxHp: number;
    isElite: boolean;
    isMiniboss: boolean;
  }[];

  xpCrystals: {
    id: number;
    x: number;
    z: number;
    value: number;
  }[];

  projectiles: {
    id: number;
    x: number;
    z: number;
    type: string;
  }[];
}
```

## 7. Data Flow

### 7.1 Arena Entry Flow

```
┌─────────┐   click    ┌──────────┐   select   ┌────────────────┐
│  Globe  │──────────►│CountryPanel│──────────►│  page.tsx       │
│ (World  │           │"ENTER     │           │  setShowCharSel │
│  View)  │           │ ARENA"    │           │  = true         │
└─────────┘           └──────────┘           └───────┬────────┘
                                                      │
                                              ┌───────▼────────┐
                                              │ARCharacterSelect│
                                              │ (8 characters)  │
                                              └───────┬────────┘
                                                      │ charType
                                              ┌───────▼──────────────┐
                                              │socket.emit(           │
                                              │  'join_country_arena',│
                                              │  { iso3, charType })  │
                                              └───────┬──────────────┘
                                                      │
                              ┌────────────────────────▼───────────────┐
                   Server:    │ CountryArenaManager.JoinPlayer()       │
                              │   → GetOrCreateArena(iso3)             │
                              │   → room.AddPlayer(info)               │
                              │   → room.arState.Combat.OnPlayerJoin() │
                              │   → emit 'joined' { roomId, seed,     │
                              │         arenaMode: true, radius: 80 }  │
                              └────────────────────────┬───────────────┘
                                                       │
                              ┌─────────────────────────▼──────────────┐
                   Client:    │ page.tsx: mode='playing'                │
                              │ <GameCanvas3D isArenaMode={true}        │
                              │   arenaSeed={countryHash}               │
                              │   arenaRadius={80}                      │
                              │   characterType={charType} />           │
                              │                                        │
                              │ MCTerrain generates chunks (seed-based) │
                              │ AgentInstances renders players+enemies  │
                              │ ArenaHUD shows wave/timer/phase         │
                              └────────────────────────────────────────┘
```

### 7.2 Combat Tick Flow

```
Server (20Hz = 50ms interval)
──────────────────────────────
room.tick()
  └─ tickPlaying()
       └─ IsArenaCombat() == true
            └─ tickArenaCombat()
                 │
                 ├─ 1. arState.Combat.OnTick(dt=0.05, tick)
                 │     ├─ tickPhaseTimer()          → phase transitions
                 │     ├─ tickWaveSpawner()          → enemy spawn
                 │     ├─ tickWeaponAutoAttack()     → damage events
                 │     ├─ tickProjectiles()          → projectile movement
                 │     ├─ tickXPCollection()         → XP crystal pickup
                 │     ├─ tickStatusEffects()        → DoT/slow/freeze
                 │     ├─ tickArenaShrink()           → PvP boundary shrink
                 │     └─ returns []CombatEvent
                 │
                 ├─ 2. tickArenaBots(dt, tick)
                 │     ├─ Tactical AI (every 10 ticks = 2Hz)
                 │     └─ Reflexive AI (every tick = 20Hz)
                 │
                 ├─ 3. broadcastArenaEvents(events)
                 │     └─ CombatEvent → RoomEvent → ws.Hub → clients
                 │        (ar_damage, ar_kill, ar_level_up, ar_phase_change)
                 │
                 └─ 4. broadcastArenaState()
                       └─ arState.Combat.GetState() → ARStatePayload
                          → serialize → RoomEvtARState → ws.Hub → clients

Client (60fps render loop)
──────────────────────────
useFrame() in GameLoop:
  ├─ Receive ar_state (20Hz) → buffer latest state
  ├─ Interpolate player/enemy positions (20Hz → 60fps lerp)
  ├─ For each agent: Y = MCNoise.getSurfaceOffset(x, z) + MC_BASE_Y + 1
  └─ Update InstancedMesh matrices

useFrame() in AgentInstances:
  ├─ Update player cubeling positions + animations
  └─ Update enemy positions + type-based animations

useFrame() in TPSCamera:
  └─ Follow local player position (already on terrain surface)
```

### 7.3 Coordinate System

### Before (v10-v17 Classic)
- Arena radius: ~3000 continuous float units
- Agent position: `{ x: float64, y: float64, z: float64 }` (server-computed)
- Speed: ~300 units/sec
- Attack range: ~60 units (aura)
- Coordinate origin: (0, 0, 0) center of arena

### After (v19 Arena Mode — ADR-005)
- Arena radius: **80 MC blocks** (≈3.3 chunks of size 24)
- Agent position: `{ x: float64, z: float64 }` — block-scale floats (server), Y from noise (client)
- Speed: **6 blocks/sec** (each block = 1 R3F unit)
- Attack range: **3 blocks** (melee), **8 blocks** (ranged)
- Coordinate origin: (0, MC_BASE_Y, 0) — MCTerrain generates around origin

### Coordinate Constants (server-side `ar_types.go`)
```go
const (
    ARArenaRadiusBlocks  = 80       // Default arena radius in blocks
    ARMoveSpeedBPS       = 6.0      // Blocks per second
    ARMeleeRangeBlocks   = 3.0
    ARRangedRangeBlocks  = 8.0
    ARSpawnEdgeOffset    = 5        // Blocks from arena edge for enemy spawn
    ARXPPickupRange      = 2.0      // Blocks
    ARProjectileSpeed    = 12.0     // Blocks per second
)
```

### Coordinate Constants (client-side `coordinate-utils.ts`)
```typescript
export const ARENA_BLOCK = {
  RADIUS: 80,
  MC_BASE_Y: 30,          // from mc-types.ts
  AGENT_Y_OFFSET: 1,       // Stand 1 block above surface
  MOVE_SPEED: 6,           // blocks/sec
  MELEE_RANGE: 3,
  RANGED_RANGE: 8,
};

export function agentWorldY(noise: MCNoise, x: number, z: number): number {
  return noise.getSurfaceOffset(x, z) + ARENA_BLOCK.MC_BASE_Y + ARENA_BLOCK.AGENT_Y_OFFSET;
}
```

### Migration-Period Utility (Phase 1 only)
```typescript
// coordinate-utils.ts — removed after full migration
export function toMCBlock(classicCoord: number): number {
  return classicCoord / 37.5;  // 3000 classic units ≈ 80 blocks
}
export function fromMCBlock(blockCoord: number): number {
  return blockCoord * 37.5;
}
```

## 8. Integration Gap Wiring (5 Gaps)

The 5 integration gaps identified in the plan. Each gap maps to a specific code change:

### Gap 1: JoinCountryArena → CombatMode Setting

**Current state**: `country_arena.go` `GetOrCreateArena()` creates a Room but never sets `CombatMode`. All rooms default to `CombatModeClassic` (empty string / zero value).

**Wiring**:
```
File: server/internal/game/country_arena.go
Method: GetOrCreateArena()
Line: ~87 (after cfg := cam.defaultConfig)

ADD:
  cfg.CombatMode = CombatModeArena
  cfg.CountryTier = cam.getCountryTier(countryCode)
```

**Verification**: After this change, `room.IsArenaCombat()` returns `true` for all country arenas.

### Gap 2: startRound() → ArenaCombat Branch

**Current state**: `room.go` `startRound()` (line 337) always calls `r.arena.Reset()` and `r.arena.Run()` — the classic Arena path. Never calls `InitArenaCombat()`.

**Wiring**:
```
File: server/internal/game/room.go
Method: startRound()
Line: 337-366

CHANGE to:
  r.round++
  if r.IsArenaCombat() {
      r.InitArenaCombat()        // Already implemented in ar_room_integration.go
      r.transitionTo(domain.RoomStatePlaying)
      // No arena.Run() goroutine — ArenaCombat ticks synchronously from tickPlaying
  } else {
      // ... existing classic path unchanged ...
  }
```

**Key insight**: ArenaCombat does NOT run in its own goroutine. It ticks synchronously from `tickPlaying()` → `tickArenaCombat()`. This eliminates concurrency issues.

### Gap 3: tickPlaying() → TickArenaCombat

**Current state**: `room.go` `tickPlaying()` (line 227) always calls `r.arena.GetTick()`, `r.broadcastState()`, etc. — all classic Arena methods. Never calls ArenaCombat.

**Wiring**:
```
File: server/internal/game/room.go
Method: tickPlaying()
Line: 227-262

CHANGE to:
  r.stateTicksLeft--
  if r.stateTicksLeft <= 0 { r.endRound(); return }
  if r.aliveHumanCountLocked() == 0 && len(r.players) > 0 { r.endRound(); return }

  if r.IsArenaCombat() {
      r.tickArenaCombat()      // NEW method in ar_room_integration.go
  } else {
      // ... existing classic tick (broadcastState, minimap, shrink, coach) ...
  }
```

### Gap 4: Socket Event Registration

**Current state**: `main.go` `registerEventHandlers()` registers `join_country_arena`, `input`, etc. but never registers `ar_input` or `ar_choose`.

**Wiring**:
```
File: server/cmd/server/main.go
Function: registerEventHandlers()

ADD (after existing event registrations):
  // v19: Arena combat input events
  router.On("ar_input", func(client *ws.Client, data json.RawMessage) {
      var input game.ARInput
      if err := json.Unmarshal(data, &input); err != nil { return }
      wm.RouteARInput(client.ID, input)
  })

  router.On("ar_choose", func(client *ws.Client, data json.RawMessage) {
      var choice game.ARChoice
      if err := json.Unmarshal(data, &choice); err != nil { return }
      wm.RouteARChoose(client.ID, choice)
  })
```

**Protocol extension**: Add to `ws/protocol.go`:
```go
EventARInput  = "ar_input"
EventARChoose = "ar_choose"
```

### Gap 5: Import Chain Activation

**Current state**: `main.go` imports `game` and `world` packages but never invokes any AR-specific initialization. The `ar_room_integration.go` code exists but is never called because Gap 1-4 prevent it.

**Wiring**: This gap is automatically resolved when Gaps 1-4 are closed:
- Gap 1 sets `CombatModeArena` → Gap 2 calls `InitArenaCombat()` → Gap 3 calls `tickArenaCombat()` → Gap 4 routes input
- All `ar_*.go` files are in the `game` package — no separate import needed
- Go's compiler includes all files in the package automatically

**Verification command**: `grep -r "ar_room_integration\|ar_combat\|CombatModeArena" server/ | wc -l` should show references across room.go, country_arena.go, main.go after wiring.

### Gap Summary Matrix

| Gap | File | Method | Change Type | Lines Changed |
|-----|------|--------|-------------|---------------|
| 1 | country_arena.go | GetOrCreateArena | ADD 2 lines | 2 |
| 2 | room.go | startRound | BRANCH (if/else) | ~20 |
| 3 | room.go | tickPlaying | BRANCH (if/else) | ~15 |
| 4 | main.go | registerEventHandlers | ADD 2 handlers | ~20 |
| 5 | (auto) | (import chain) | N/A | 0 |
| — | ws/protocol.go | constants | ADD 2 consts | 2 |
| — | world_manager.go | RouteARInput/Choose | ADD 2 methods | ~30 |
| **Total** | | | | **~89 lines** |

## 9. MCTerrain Arena Mode Specification

### Current MCTerrain Behavior (infinite world)
1. Web Worker generates chunks on-demand as camera moves
2. Each chunk = 24×24 blocks, variable height from MCNoise
3. 12 block types (grass, dirt, stone, sand, water, etc.)
4. `MC_RENDER_DISTANCE` chunks loaded around camera
5. Camera-driven: `useFrame` checks camera position → triggers new chunk generation

### Arena Mode Changes

**mc-terrain-worker.ts** — New `arenaMode` path:
```typescript
// When arenaMode is set:
function generateArenaChunks(input: TerrainWorkerInput) {
  const { seed, arenaMode } = input;
  const { radius, flattenVariance } = arenaMode!;
  const noise = new MCNoise(seed);  // Deterministic from seed

  // Calculate required chunks (only those within radius)
  const chunkRadius = Math.ceil(radius / MC_CHUNK_SIZE);
  const chunks: ChunkData[] = [];

  for (let cx = -chunkRadius; cx <= chunkRadius; cx++) {
    for (let cz = -chunkRadius; cz <= chunkRadius; cz++) {
      // Skip chunks entirely outside arena circle
      const chunkCenterX = cx * MC_CHUNK_SIZE + MC_CHUNK_SIZE / 2;
      const chunkCenterZ = cz * MC_CHUNK_SIZE + MC_CHUNK_SIZE / 2;
      const dist = Math.sqrt(chunkCenterX ** 2 + chunkCenterZ ** 2);
      if (dist > radius + MC_CHUNK_SIZE) continue;

      chunks.push(generateChunk(cx, cz, noise, flattenVariance, radius));
    }
  }
  return chunks;
}

function generateChunk(cx, cz, noise, flattenVariance, radius) {
  // For each block (x, z) in chunk:
  //   surfaceY = noise.getSurfaceOffset(x, z)
  //   clampedY = Math.max(-flattenVariance, Math.min(flattenVariance, surfaceY))
  //   if (distance(x, z, 0, 0) > radius) → skip block (arena boundary)
  //   Generate column: bedrock → stone → dirt → surface block
}
```

**MCTerrain.tsx** — Arena mode rendering:
```tsx
// Arena mode: single batch generation at mount, no camera tracking
useEffect(() => {
  if (!arenaMode || !workerRef.current) return;
  workerRef.current.postMessage({
    seed,
    chunkX: 0, chunkZ: 0,  // Not used in arena mode
    renderDistance: 0,       // Not used
    arenaMode: {
      centerX: 0, centerZ: 0,
      radius: arenaMode.radius,
      flattenVariance: arenaMode.flattenVariance,
    },
  } as TerrainWorkerInput);
}, [seed, arenaMode]);

// Arena mode: skip useFrame chunk updates
useFrame(() => {
  if (arenaMode) return;  // Static terrain — no camera-driven updates
  // ... existing infinite world chunk loading ...
});
```

### Chunk Budget

| Arena Radius | Chunk Radius | Total Chunks | Est. Block Instances | Draw Calls |
|-------------|-------------|-------------|---------------------|------------|
| 48 blocks (2 chunks) | 2 | ~13 | ~3,000 | ~120 |
| 80 blocks (3.3 chunks) | 4 | ~49 | ~8,000 | ~250 |
| 96 blocks (4 chunks) | 4 | ~49 | ~10,000 | ~300 |

Target: **80 blocks** (default arena). 49 chunks × ~163 visible blocks per chunk = ~8,000 block instances across 12 InstancedMesh draw calls.

## 10. Client-Side Height Sampling

### Architecture (ADR-006 Implementation)

```
┌─────────── Server ───────────┐      ┌─────────── Client ──────────────────┐
│                               │      │                                     │
│ ar_combat.go:                 │      │ AgentInstances.tsx useFrame():       │
│   player.X = 42.3            │  WS  │   const { x, z } = serverState;     │
│   player.Z = -17.8           │─────►│   const surfaceY =                   │
│   // NO player.Y             │      │     noise.getSurfaceOffset(x, z);    │
│                               │      │   const y = surfaceY + MC_BASE_Y + 1│
│ Enemy spawn:                  │      │   dummy.position.set(x, y, z);      │
│   enemy.X = randInRadius()   │      │                                     │
│   enemy.Z = randInRadius()   │      │ Same for enemies, XP crystals,      │
│   // NO enemy.Y              │      │ projectiles — all sample noise.      │
│                               │      │                                     │
└───────────────────────────────┘      └─────────────────────────────────────┘
```

### Determinism Guarantee (ADR-009)

**Problem**: `MCNoise` → `ImprovedNoise` uses `Math.random()` for permutation table.
**Fix**: Seeded PRNG in `ImprovedNoise` constructor.

```typescript
// mc-noise.ts — BEFORE (non-deterministic):
class ImprovedNoise {
  constructor() {
    for (let i = 255; i > 0; i--) {
      const j = Math.floor((i + 1) * Math.random());  // ← RANDOM
      [p[i], p[j]] = [p[j], p[i]];
    }
  }
}

// mc-noise.ts — AFTER (deterministic from seed):
class ImprovedNoise {
  constructor(seed: number) {
    const rng = mulberry32(seed);  // Seeded PRNG
    for (let i = 255; i > 0; i--) {
      const j = Math.floor((i + 1) * rng());  // ← DETERMINISTIC
      [p[i], p[j]] = [p[j], p[i]];
    }
  }
}

// mulberry32: fast 32-bit seeded PRNG
function mulberry32(seed: number) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
```

### Country Seed Generation

```typescript
// coordinate-utils.ts
export function countryHash(iso3: string): number {
  // Simple hash: ISO3 → stable integer seed
  let hash = 0;
  for (let i = 0; i < iso3.length; i++) {
    hash = ((hash << 5) - hash + iso3.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}
```

Each country (e.g., "KOR", "USA") generates a unique, stable, deterministic terrain. All clients with the same `iso3` see identical terrain.

## 11. AR* Component Disposition Matrix

Full disposition of all 17 AR* components (ADR-007):

| # | AR* Component | Lines | Disposition | Target | Rationale |
|---|--------------|-------|-------------|--------|-----------|
| 1 | ARCharacterSelect | 205 | **PORT** → `ArenaCharSelect.tsx` | `components/lobby/` | Unique: 8 characters + passive UI. Insert into page.tsx entry flow. |
| 2 | ARHUD | 270 | **PORT** → `ArenaHUD.tsx` | `components/game/` | Merge: wave/timer/kill/phase into GameCanvas3D overlay. Remove R3F deps, pure HTML. |
| 3 | ARLevelUp | 179 | **PORT** → `ArenaLevelUp.tsx` | `components/game/` | Unique: 3-card Tome selection. Wire to `ar_choose` socket event. |
| 4 | ARPvPOverlay | 412 | **PORT** → `ArenaPvPOverlay.tsx` | `components/game/` | Unique: kill feed + faction scores + boss HP bar. |
| 5 | ARMinimap | 203 | **PORT** → `ArenaMinimap.tsx` | `components/game/` | Extend existing Minimap with arena boundary + enemy blips. |
| 6 | ARBattleRewards | 181 | **PORT** → `ArenaBattleRewards.tsx` | `components/game/` | Unique: dual token reward display. |
| 7 | ARSpectateOverlay | 269 | **PORT** → `ArenaSpectate.tsx` | `components/game/` | Unique: death spectate UI. Wire to SpectatorMode. |
| 8 | ARProfile | 251 | **PORT** → `ArenaProfile.tsx` | `components/hub/` | Unique: lifetime stats. Move to hub system popup. |
| 9 | ARQuestPanel | 230 | **PORT** → `ArenaQuestPanel.tsx` | `components/hub/` | Unique: quest display. Move to hub system popup. |
| 10 | ARSeasonPass | 304 | **PORT** → `ArenaSeasonPass.tsx` | `components/hub/` | Unique: season pass viewer. Move to hub system popup. |
| 11 | ARDamageNumbers | 210 | **REPLACE** | existing `DamageNumbers.tsx` | GameCanvas3D already has 3D damage numbers. |
| 12 | ARNameTags | 197 | **REPLACE** | existing nametag system | GameCanvas3D already renders nametags. |
| 13 | ARMobileControls | 352 | **MERGE** → existing `MobileControls.tsx` | `components/game/` | Merge AR joystick + auto-attack indicator into existing mobile input. |
| 14 | ARTerrain | 154 | **DELETE** | — | Replaced by MCTerrain with `arenaMode`. |
| 15 | ARCamera | 117 | **DELETE** | — | TPSCamera used instead. |
| 16 | ARPlayer | 193 | **DELETE** | — | AgentInstances renders all characters. |
| 17 | AREntities | 212 | **DELETE** | — | AgentInstances extended for enemy subtypes. |

**Summary**: 10 PORT, 3 REPLACE/MERGE, 4 DELETE
**Ported code estimate**: ~2,504 lines (10 components) → ~2,000 lines after adaptation (remove standalone R3F deps, wire to GameCanvas3D state)

## 12. API / Event Specification

### 12.1 Extended `join_country_arena` Payload

```typescript
// Client → Server
{
  event: "join_country_arena",
  data: {
    countryCode: string;   // ISO3 (e.g., "KOR")
    name: string;          // Player display name
    skinId: number;
    appearance: string;    // Packed BigInt string
    nationality: string;   // Player nationality
    characterType: string; // v19 NEW: "striker"|"guardian"|"pyro"|... (8 types)
  }
}

// Server → Client (joined response)
{
  event: "joined",
  data: {
    roomId: string;
    playerId: string;
    isArenaMode: boolean;  // v19 NEW: true for arena combat
    arenaSeed: number;     // v19 NEW: country hash for MCTerrain
    arenaRadius: number;   // v19 NEW: arena radius in MC blocks
    countryTier: string;   // v19 NEW: "S"|"A"|"B"|"C"|"D"
    // ... existing fields unchanged
  }
}
```

### 12.2 `ar_input` (Client → Server, 20Hz)

```typescript
{
  event: "ar_input",
  data: {
    moveAngle: number | null; // Radians, null = stop
    aimAngle: number;         // Radians (auto-attack direction)
    seq: number;              // Sequence for reconciliation
  }
}
```

### 12.3 `ar_choose` (Client → Server, on demand)

```typescript
{
  event: "ar_choose",
  data: {
    type: "tome" | "weapon";  // What was chosen
    id: string;               // Tome/weapon ID
  }
}
```

### 12.4 `ar_state` Broadcast (Server → Client, 20Hz)

See `ARStatePayload` in Section 6.3. Broadcast to all clients in the room via `RoomEvtARState`.

### 12.5 `ar_level_up` (Server → Specific Client)

```typescript
{
  event: "ar_level_up",
  data: {
    level: number;
    choices: Array<{
      id: string;
      type: "tome" | "weapon";
      name: string;
      description: string;
      rarity: "common" | "rare" | "epic" | "legendary";
      currentStacks?: number;  // For Tomes already held
    }>;
  }
}
```

### 12.6 `ar_phase_change` (Server → All Clients)

```typescript
{
  event: "ar_phase_change",
  data: {
    phase: "deploy" | "pve" | "pvp_warning" | "pvp" | "settlement";
    timer: number;         // Duration in seconds
    shrinkRadius?: number; // PvP phase: current arena radius
    message: string;       // Phase announcement text
  }
}
```

### 12.7 `ar_battle_end` (Server → All Clients)

```typescript
{
  event: "ar_battle_end",
  data: {
    rankings: Array<{
      playerId: string;
      name: string;
      kills: number;
      damageDealt: number;
      xpCollected: number;
      tomesHeld: number;
      rank: number;
    }>;
    factionWinner: string;       // Winning faction ISO3
    rewards: {
      awwTokens: number;
      countryTokens: number;
      xpGained: number;
    };
    sovereignty: {
      factionId: string;
      weight: number;
    };
  }
}
```

## 13. Performance Budget

### Rendering Budget (Arena Mode)

| Resource | Budget | Breakdown |
|----------|--------|-----------|
| **Draw calls** | <500 | MCTerrain: 12 (InstancedMesh per block type) + AgentInstances: 50 (players+enemies) + Particles: 20 + UI: 50 + Sky/Fog: 10 = **~142** |
| **Triangles** | <2M | MCTerrain blocks: 8,000 × 12 tris = 96K + Agents: 150 × 200 tris = 30K + XP crystals: 100 × 8 tris = 800 + Particles: 50K = **~177K** (well under budget) |
| **GPU Memory** | <200MB | Block textures: ~5MB + InstancedMesh buffers: ~20MB + Agent textures: ~10MB + Framebuffer: ~40MB = **~75MB** |
| **Network** | <50KB/s | ARStatePayload @20Hz: ~2KB × 20 = 40KB/s + Events: ~5KB/s = **~45KB/s** |

### Server Budget (per arena)

| Resource | Budget | Breakdown |
|----------|--------|-----------|
| **Tick CPU** | <2ms/tick | ArenaCombat.OnTick: ~1ms (spatial grid O(1)) + AI bots: ~0.5ms + Serialization: ~0.3ms = **~1.8ms** |
| **Memory** | <5MB/arena | Player state: 50 × 2KB = 100KB + Enemy pool: 200 × 1KB = 200KB + Spatial grid: 500KB + Misc: 500KB = **~1.3MB** |
| **Goroutines** | 1/arena | Room.Run() goroutine (ArenaCombat ticks synchronously, no extra goroutine) |
| **195 arenas** | <400MB total | 195 × 1.3MB = ~254MB (only active arenas consume resources due to lazy init) |

### Client Frame Budget (60fps = 16.6ms/frame)

| Phase | Budget | Notes |
|-------|--------|-------|
| State interpolation | <1ms | 20Hz → 60fps lerp for ~50 entities |
| Height sampling | <0.5ms | MCNoise.getSurfaceOffset() per visible entity (~50 calls) |
| InstancedMesh updates | <2ms | Matrix updates for blocks, agents, XP |
| R3F render | <10ms | Scene traversal + WebGL draw calls |
| HUD React | <2ms | ArenaHUD + overlays (React.memo) |
| **Total** | **<15.5ms** | Leaves ~1ms headroom |

### Optimization Levers (if budget exceeded)

1. **Reduce chunk count**: Arena radius 48 blocks (2 chunks) instead of 80
2. **LOD for blocks**: Simplified geometry at distance >48 units
3. **Entity culling**: `ar_optimize.go` viewport culling (already implemented)
4. **Tick rate reduction**: Low-tier arenas (D-tier) at 10Hz instead of 20Hz
5. **DPR limiting**: Mobile devices cap at 1.5 DPR (already in ARMobileControls)

## 14. Migration Strategy

### 14.1 Feature Migration Map (GameCanvas3D existing → v19 arena)

| Existing Feature | State | Migration Path | Phase |
|-----------------|-------|----------------|-------|
| **HeightmapTerrain + ZoneTerrain** | DELETE | → MCTerrain `arenaMode` | P1 |
| **TerrainDeco** | DELETE (arena) | Conditional render: `!isArenaMode` | P1 |
| **Epoch system** (peace/war/shrink/end) | REPLACE | → v18 5-phase battle cycle (ar_combat.go) | P5 |
| **Aura auto-attack** (60px range) | REPLACE | → v18 weapon auto-fire (16 weapons, block range) | P2 |
| **Classic Build System** (10w+10p+8t+6a) | REPLACE | → v18 Tome system (16 Tome + 21 weapon + 10 synergy) | P4 |
| **DamageNumbers** | KEEP | Reuse for arena damage display (block-unit scaled) | P3 |
| **AuraRings** | KEEP | Attack range indicator (rescaled to blocks) | P3 |
| **AgentInstances** | EXTEND | Add enemy subtype rendering (zombie/skeleton/etc) | P3 |
| **TPSCamera** | KEEP | No changes | — |
| **MCParticles** | EXTEND | Arena particle effects (XP glow, weapon VFX) | P3 |
| **PostProcessing** | KEEP | No changes | — |
| **Weather** | KEEP | Country biome determines weather | — |
| **Minimap** | EXTEND | Arena boundary + wave indicator + enemy positions | P3 |
| **KillCam** | KEEP | Trigger on arena death → spectate transition | P5 |
| **OrbManager (XP orbs)** | REPLACE | → XP Crystals (OctahedronGeometry, server-spawned) | P3 |
| **Classic Leaderboard** | REPLACE | → Arena scoreboard (kills, DPS, Tomes) | P3 |
| **BuildHUD** | RECONNECT | Currently `null`. Wire to v18 Tome/weapon state | P3 |
| **EpochHUD** | HIDE (arena) | `isArenaMode ? <ArenaHUD/> : <EpochHUD/>` | P3 |
| **MobileControls** | MERGE | + AR joystick + auto-attack indicator | P5 |

### 14.2 Feature Flag Strategy

```tsx
// page.tsx passes isArenaMode to GameCanvas3D
const isArenaMode = uiState.isArenaMode ?? false;

// GameCanvas3D uses it for conditional rendering
{isArenaMode && <MCTerrain arenaMode={...} />}
{!isArenaMode && <HeightmapTerrain data={...} />}

// HUD overlays
{isArenaMode ? <ArenaHUD {...arenaState} /> : <EpochHUD {...epochState} />}
```

This ensures classic mode (CombatModeClassic) continues to work without any changes. Arena mode is purely additive.

### 14.3 Deletion Plan

| Item | When | Condition |
|------|------|-----------|
| `app/arena/page.tsx` | Phase 5 | After all features confirmed working in GameCanvas3D |
| `app/arena/ArenaCanvas.tsx` | Phase 5 | Same as above |
| `components/game/ar/ARTerrain.tsx` | Phase 1 | After MCTerrain arenaMode verified |
| `components/game/ar/ARCamera.tsx` | Phase 1 | TPSCamera confirmed working |
| `components/game/ar/ARPlayer.tsx` | Phase 3 | After AgentInstances extended |
| `components/game/ar/AREntities.tsx` | Phase 3 | After AgentInstances extended |
| `coordinate-utils.ts` `toMCBlock/fromMCBlock` | Phase 5 | After all coordinates migrated |
| `page.tsx` `handleQuickEnterArena()` | Phase 5 | Replaced by character select flow |

## 15. Phase-Architecture Alignment

Mapping each plan phase to architecture components affected:

### Phase 1: MCTerrain → GameCanvas3D
| Task | Architecture Component | Section |
|------|----------------------|---------|
| MCTerrain arenaMode prop | 6.2.2 MCTerrain, 9 MCTerrain Spec | MCTerrainProps, mc-terrain-worker |
| Coordinate migration | 7.3 Coordinate System | ar_types.go constants, coordinate-utils.ts |
| HeightmapTerrain replacement | 6.2.1 GameCanvas3D | Conditional render branch |
| Client-side height sampling | 10 Height Sampling | AgentInstances useFrame, MCNoise determinism (ADR-009) |
| Scene lighting | 6.2.1 GameCanvas3D | MCScene lighting for arena mode |
| ArenaBoundary adaptation | 6.2.1 GameCanvas3D | Block-unit boundary ring |

### Phase 2: Server Integration (5 Gaps)
| Task | Architecture Component | Section |
|------|----------------------|---------|
| Gap 1: CombatMode setting | 6.1.4 CountryArenaManager | 8 Gap 1 |
| Gap 2: startRound branch | 6.1.1 Room State Machine | 8 Gap 2 |
| Gap 3: tickPlaying branch | 6.1.1 Room State Machine | 8 Gap 3 |
| Gap 4: ar_input/ar_choose events | 6.1.5 main.go Handlers | 8 Gap 4 |
| Gap 5: import chain | (auto) | 8 Gap 5 |
| Combat state → WS broadcast | 6.1.3 AR Room Integration | broadcastArenaState() |
| MC coordinate wave spawn | 7.3 Coordinate System | ARSpawnEdgeOffset constant |
| Server auto-attack | 6.1.2 ArenaCombat Engine | tickWeaponAutoAttack() (unchanged) |

### Phase 3: Client Combat Rendering
| Task | Architecture Component | Section |
|------|----------------------|---------|
| Enemy rendering on MC terrain | 6.2.3 AgentInstances | Enemy subtype InstancedMesh |
| XP Crystal rendering | 6.2.1 GameCanvas3D | OrbInstances → XP crystal shader |
| BuildHUD connection | 6.2.5 Ported Overlays | BuildHUD wired to ar_state Tome/weapon data |
| Auto-attack visual | 6.2.1 GameCanvas3D | AuraRings + DamageNumbers reuse |
| LevelUp UI | 6.2.5 ArenaLevelUp | 3-card popup, `ar_choose` event |
| HUD adaptation | 6.2.5 ArenaHUD | Merged wave/timer/kill/phase |
| Classic HUD hide | 14.2 Feature Flag | `isArenaMode` conditional |

### Phase 4: Character + Tome + Synergy
| Task | Architecture Component | Section |
|------|----------------------|---------|
| Character selection | 6.2.4 page.tsx Entry Flow, 6.2.5 ArenaCharSelect | Pre-arena overlay |
| Tome system | 6.1.2 ArenaCombat Engine | ar_tome.go (unchanged) |
| Synergy detection | 6.1.2 ArenaCombat Engine | ar_synergy.go (unchanged) |
| Weapon evolution | 6.1.2 ArenaCombat Engine | ar_weapon.go (unchanged) |

### Phase 5: PvP + Entry Flow + Cleanup
| Task | Architecture Component | Section |
|------|----------------------|---------|
| 5-phase battle | 6.1.2 ArenaCombat Engine | ar_pvp.go (unchanged) |
| Faction PvP | 6.1.2 ArenaCombat Engine | ar_pvp.go PvP damage coefficient |
| Arena shrink on MC terrain | 9 MCTerrain Spec | Visual: boundary blocks darken |
| Globe → arena flow | 6.2.4 page.tsx Entry Flow | Character select → joinCountryArena |
| /arena page deletion | 14.3 Deletion Plan | Remove app/arena/ |
| Mobile controls merge | 11 AR* Disposition | ARMobileControls → MobileControls |

### Phase 6: Polish + Meta
| Task | Architecture Component | Section |
|------|----------------------|---------|
| Token rewards | 6.1.2 ArenaCombat | ar_reward.go (unchanged) |
| Quest system | 6.1.2 ArenaCombat | ar_quest.go (unchanged) |
| Season pass | 6.1.2 ArenaCombat | ar_season.go (unchanged) |
| Sound effects | 6.2.1 GameCanvas3D | ar-sounds.ts → existing sound engine |
| Mobile controls | 6.2.1 GameCanvas3D | Merged MobileControls |

## 16. Risk Mitigations (Architecture-Level)

| Risk | Severity | Architectural Mitigation |
|------|----------|-------------------------|
| **MCNoise non-determinism** across clients | CRITICAL | ADR-009: Seeded PRNG in ImprovedNoise. Verification: 2 clients with same seed must produce identical `getSurfaceOffset(42, -17)` values. |
| **ArenaCombat synchronous tick too slow** (>2ms blocks room goroutine) | HIGH | `ar_optimize.go` spatial grid (O(1) queries). Tier-adaptive tick rates (D-tier: 10Hz). Profile: measure `OnTick()` P99 latency. Fallback: async tick with channel-based event delivery. |
| **MCTerrain + 150 agents overwhelms GPU** | HIGH | Performance budget (Section 13): draw calls <500. Arena radius 80 blocks (not infinite). LOD for distant blocks. Agent culling via `ar_optimize.go` viewport. |
| **Coordinate mismatch during migration** (float vs block) | HIGH | Phase 1 includes `toMCBlock()`/`fromMCBlock()` utilities. All ar_combat.go constants redefined in block units. Integration test: spawn agent at (40, 0, 40) blocks → verify at correct world position. |
| **Classic mode regression** | MEDIUM | Feature flag `isArenaMode` isolates all changes. Classic path (`!IsArenaCombat()`) completely untouched. Existing tests still pass. |
| **AR* porting introduces React key/memo bugs** | MEDIUM | Each ported component is React.memo'd. State flows unidirectionally: socket → useRef → useFrame. No context providers shared with classic mode. |
| **Worker thread contention** (MCTerrain worker + existing workers) | MEDIUM | Arena mode: single batch generation at mount (not continuous). Worker terminates after initial chunks. No contention with game loop. |
| **endRound() cleanup for ArenaCombat** | MEDIUM | Add `endRoundArena()` path: calls `arState.Combat.Cleanup()`, sends `ar_battle_end`, processes rewards. Mirrors existing `endRound()` structure. |
| **Reconnect with MCTerrain state** | LOW | MCTerrain is deterministic from seed — no state snapshot needed. Client re-generates terrain from seed on reconnect. `ar_reconnect.go` handles combat state. |

## 17. Open Questions

| # | Question | Impact | Resolution Path |
|---|----------|--------|-----------------|
| Q1 | Should MCNoise Go port be done for server-side boundary validation? | Low — client handles height, server only needs X/Z distance check | Defer to post-v19. Server boundary check uses 2D distance only. |
| Q2 | Should classic CombatMode be removed entirely? | Medium — code cleanliness vs backward compat | Keep for now. Remove in v20 if no use case. |
| Q3 | How to handle arena-specific sound events vs existing sound engine? | Low — integration detail | Phase 6: `ar-sounds.ts` event names map to existing `useSoundEngine` slots. |
| Q4 | Should arena terrain have water blocks? | Low — visual only | MCNoise `flattenVariance` of 5 blocks should prevent deep water. If water appears, skip water blocks in arena mode worker. |
| Q5 | Spectate camera: TPS follow target or free-roam? | Medium — UX decision | TPS follow (switch between alive players). `ARSpectateOverlay` already has target switching. Design decision for Phase 5. |
| Q6 | Should tier-based arena radius scale dynamically? | Low | Default: 80 blocks for all tiers. S-tier could be 96 blocks. Parameterize via `TierArenaRadius()` (already exists in ar_room_integration.go). |

---

## Appendix A: File Change Inventory

### Server Changes (Go)
| File | Change Type | Est. Lines |
|------|------------|------------|
| `server/internal/game/room.go` | MODIFY (startRound, tickPlaying, endRound) | +40 |
| `server/internal/game/country_arena.go` | MODIFY (GetOrCreateArena) | +5 |
| `server/internal/game/ar_room_integration.go` | EXTEND (tickArenaCombat, broadcastArenaState) | +80 |
| `server/internal/ws/protocol.go` | ADD (ar_input, ar_choose events) | +5 |
| `server/internal/world/world_manager.go` | ADD (RouteARInput, RouteARChoose) | +30 |
| `server/cmd/server/main.go` | ADD (ar_input, ar_choose handlers) | +25 |

### Client Changes (TypeScript/React)
| File | Change Type | Est. Lines |
|------|------------|------------|
| `apps/web/components/game/GameCanvas3D.tsx` | MODIFY (isArenaMode conditional rendering) | +100 |
| `apps/web/components/3d/MCTerrain.tsx` | EXTEND (arenaMode prop) | +60 |
| `apps/web/lib/3d/mc-terrain-worker.ts` | EXTEND (arena chunk generation) | +80 |
| `apps/web/lib/3d/mc-noise.ts` | FIX (seeded PRNG for determinism) | +15 |
| `apps/web/components/3d/AgentInstances.tsx` | MODIFY (height sampling, enemy subtypes) | +40 |
| `apps/web/app/page.tsx` | MODIFY (character select flow, isArenaMode) | +50 |
| `apps/web/lib/3d/coordinate-utils.ts` | NEW | +30 |
| `apps/web/components/game/ArenaHUD.tsx` | NEW (ported from ARHUD) | ~200 |
| `apps/web/components/game/ArenaLevelUp.tsx` | NEW (ported from ARLevelUp) | ~150 |
| `apps/web/components/game/ArenaMinimap.tsx` | NEW (ported from ARMinimap) | ~180 |
| `apps/web/components/game/ArenaPvPOverlay.tsx` | NEW (ported from ARPvPOverlay) | ~350 |
| `apps/web/components/game/ArenaBattleRewards.tsx` | NEW (ported from ARBattleRewards) | ~160 |
| `apps/web/components/game/ArenaSpectate.tsx` | NEW (ported from ARSpectateOverlay) | ~230 |
| `apps/web/components/lobby/ArenaCharSelect.tsx` | NEW (ported from ARCharacterSelect) | ~180 |
| `apps/web/components/hub/ArenaProfile.tsx` | NEW (ported from ARProfile) | ~220 |
| `apps/web/components/hub/ArenaQuestPanel.tsx` | NEW (ported from ARQuestPanel) | ~200 |
| `apps/web/components/hub/ArenaSeasonPass.tsx` | NEW (ported from ARSeasonPass) | ~270 |

### Deletions
| File | Phase |
|------|-------|
| `apps/web/app/arena/page.tsx` | Phase 5 |
| `apps/web/app/arena/ArenaCanvas.tsx` | Phase 5 |
| `apps/web/components/game/ar/ARTerrain.tsx` | Phase 1 |
| `apps/web/components/game/ar/ARCamera.tsx` | Phase 1 |
| `apps/web/components/game/ar/ARPlayer.tsx` | Phase 3 |
| `apps/web/components/game/ar/AREntities.tsx` | Phase 3 |

---

## Appendix B: Verification Checklist

| # | Check | Phase | Method |
|---|-------|-------|--------|
| V1 | `go build ./...` passes after gap wiring | P2 | CI |
| V2 | `npx next build` passes with MCTerrain arenaMode | P1 | CI |
| V3 | MCNoise determinism: same seed → same heights | P1 | Unit test |
| V4 | Globe click → character select → MCTerrain arena | P5 | Manual |
| V5 | Agents walk on voxel surface (no floating/sinking) | P1 | Visual |
| V6 | Arena boundary visible at 80-block radius | P1 | Visual |
| V7 | ar_combat.go ticks produce combat events | P2 | Server log |
| V8 | ar_state broadcast reaches client at 20Hz | P2 | Network inspector |
| V9 | Level-up popup shows 3 Tome choices | P3 | Manual |
| V10 | Classic mode (CombatModeClassic) still works | All | Regression |
| V11 | Performance: draw calls <500 in arena | P1 | R3F devtools |
| V12 | /arena page returns 404 after deletion | P5 | HTTP check |
| V13 | Mobile controls work in arena mode | P5 | Device test |
