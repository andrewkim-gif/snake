# v18 Arena Combat -- System Architecture

> v18-arena-plan.md (1262 lines) 기반 시스템 아키텍처 설계서
> 기존 AI World War 인프라(Go WebSocket + R3F + WorldManager) 위에 Arena 자동전투 서바이벌 로그라이크를 구축한다.

---

## 1. C4 Level 2 -- Container/Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           [System] AI World War                            │
│                                                                             │
│  ┌──────────────────────┐        WebSocket (JSON)       ┌────────────────┐  │
│  │  Go WebSocket Server │◄════════════════════════════►│  Next.js Client │  │
│  │  (Railway, 20Hz)     │   input 30Hz / ar_state 20Hz  │  (Vercel, R3F)  │  │
│  └──────────┬───────────┘                               └───────┬────────┘  │
│             │                                                   │           │
│  ┌──────────▼───────────┐                        ┌──────────────▼────────┐  │
│  │   WorldManager       │                        │  React Three Fiber    │  │
│  │   (195 Countries)    │                        │  3D Scene Graph       │  │
│  │                      │                        │                       │  │
│  │  ┌─────────────────┐ │                        │  ┌─────────────────┐  │  │
│  │  │ CountryArena[n]  │ │                        │  │ GameCanvas3D    │  │  │
│  │  │ (on-demand pool) │ │                        │  │ ├─ ARScene      │  │  │
│  │  │                  │ │                        │  │ ├─ ARCamera     │  │  │
│  │  │  ┌─────────────┐ │ │  ar_state, ar_damage   │  │ ├─ ARPlayer    │  │  │
│  │  │  │    Room      │ │ │ ◄═════════════════►  │  │ ├─ AREntities  │  │  │
│  │  │  │ ┌──────────┐│ │ │  ar_choose, input     │  │ ├─ AREffects   │  │  │
│  │  │  │ │CombatMode││ │ │                        │  │ ├─ ARHUD       │  │  │
│  │  │  │ │(plugin)  ││ │ │                        │  │ └─ ARLevelUp   │  │  │
│  │  │  │ └──────────┘│ │ │                        │  └─────────────────┘  │  │
│  │  │  └─────────────┘ │ │                        │                       │  │
│  │  └─────────────────┘ │                        │  ┌─────────────────┐  │  │
│  │                      │                        │  │ HTML Overlays   │  │  │
│  │  ┌─────────────────┐ │                        │  │ ├─ ARPvPOverlay │  │  │
│  │  │ SovereigntyEng  │ │                        │  │ ├─ ARDeathScr   │  │  │
│  │  │ FactionScores   │ │                        │  │ └─ ARMinimap    │  │  │
│  │  └─────────────────┘ │                        │  └─────────────────┘  │  │
│  └──────────────────────┘                        └───────────────────────┘  │
│                                                                             │
│  ┌──────────────────────┐         ┌──────────────────────┐                  │
│  │  Redis (optional)     │         │  CROSS Mainnet       │                  │
│  │  State sync + pub/sub │         │  $AWW + 195 tokens   │                  │
│  └──────────────────────┘         └──────────────────────┘                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Role | Existing? |
|-----------|------|-----------|
| **WorldManager** | 195 country lifecycle, battle scheduling, arena pooling (max 50 concurrent) | Yes (`server/internal/world/world_manager.go`) |
| **CountryArena** | Country-specific wrapper: tier, terrain, sovereignty, faction scores | Yes (`server/internal/world/country_arena.go`) |
| **Room** | State machine (waiting->countdown->playing->ending->cooldown), tick loop | Yes (`server/internal/game/room.go`) |
| **CombatMode** (interface) | Pluggable combat logic -- Arena vs Classic | **NEW** (`server/internal/game/combat_mode.go`) |
| **ArenaCombat** | CombatMode implementation: PvE waves, auto-attack, PvP phase, leveling | **NEW** (`server/internal/game/ar_combat.go`) |
| **ClassicCombat** | CombatMode wrapper for existing Arena (v10 snake/aura combat) -- backward compat | **NEW** (`server/internal/game/combat_mode.go`) |
| **CombatEngine** | Damage calculation, overcritical, elemental affinity, status effects | **NEW** (`server/internal/game/ar_combat.go`) |
| **GameCanvas3D** | R3F Canvas wrapper, component orchestrator | Yes (`apps/web/components/game/GameCanvas3D.tsx`) |
| **ARScene/ARCamera/ARPlayer/...** | Arena 3D rendering components | **NEW** (`apps/web/components/game/ar/`) |
| **useARState** | Arena state management hook (entity interpolation, UI state) | **NEW** (`apps/web/hooks/useARState.ts`) |

---

## 2. Server Extension Design

### 2.1 CombatMode Interface

The key architectural decision: **Room delegates all combat logic to a pluggable CombatMode interface**.
This allows ArenaCombat (v18) and ClassicCombat (v10-v17) to coexist without modifying Room's state machine.

```go
// server/internal/game/combat_mode.go

// CombatMode defines the interface for pluggable combat systems.
// Room delegates tick processing, player lifecycle, and state serialization
// to whatever CombatMode is currently active.
type CombatMode interface {
    // Init is called once when the Room transitions to Playing state.
    // Receives the arena config (radius, tier, terrain, biome).
    Init(cfg CombatModeConfig)

    // OnTick is called every server tick (20Hz, 50ms interval).
    // Returns events to be emitted to connected clients.
    OnTick(delta float64, tick uint64) []RoomEvent

    // OnPlayerJoin handles a new player entering the arena mid-battle.
    // Returns the initial entity state for the joining player.
    OnPlayerJoin(info *PlayerInfo) interface{}

    // OnPlayerLeave handles a player disconnecting or leaving.
    OnPlayerLeave(clientID string)

    // OnInput processes player input (movement direction, slide, jump).
    OnInput(clientID string, input ARInput)

    // OnChoose handles Tome/weapon selection during level-up.
    OnChoose(clientID string, choice ARChoice)

    // GetState returns the full game state for serialization (20Hz broadcast).
    // Supports viewport culling based on observer position.
    GetState(observerPos *Position, viewRadius float64) interface{}

    // GetMinimap returns a compressed minimap state (1Hz broadcast).
    GetMinimap() interface{}

    // Cleanup releases resources when the round ends.
    Cleanup()
}

// CombatModeConfig holds initialization parameters passed from Room/CountryArena.
type CombatModeConfig struct {
    ArenaRadius   float64
    Tier          string           // "S", "A", "B", "C", "D"
    TerrainTheme  string           // "urban", "desert", "mountain", "forest", "arctic", "island"
    BiomeMap      *BiomeMap        // Existing Voronoi biome grid
    Heightmap     *Heightmap       // Existing heightmap
    TerrainMods   TerrainModifiers // Existing terrain_bonus.go modifiers
    SpatialHash   *SpatialHash     // Existing spatial hash (reuse)
    MaxAgents     int              // CalcMaxAgents result
    BattleMode    string           // "standard" (5min) or "marathon" (1hr)
    FactionMap    map[string]string // agentID -> factionID
}
```

### 2.2 ClassicCombat Wrapper (Backward Compatibility)

```go
// server/internal/game/combat_mode.go

// ClassicCombat wraps the existing Arena (v10-v17) as a CombatMode.
// Zero behavioral changes -- purely structural adapter.
type ClassicCombat struct {
    arena *Arena  // existing Arena instance
}

func (c *ClassicCombat) OnTick(delta float64, tick uint64) []RoomEvent {
    // Delegates to existing Arena.tick() logic
    return c.arena.ProcessTick(delta, tick)
}
// ... other interface methods delegate directly to Arena
```

### 2.3 ArenaCombat Implementation

```go
// server/internal/game/ar_combat.go

// ArenaCombat implements CombatMode for v18 Arena survivial roguelike.
type ArenaCombat struct {
    config       CombatModeConfig
    entities     map[string]*AREntity  // All entities (players, enemies, projectiles)
    players      map[string]*ARPlayer  // Player-specific state
    enemies      []*AREnemy            // Active PvE enemies
    projectiles  []*ARProjectile       // In-flight projectiles
    items        []*ARItem             // Ground items (drops)
    spatialHash  *SpatialHash

    // Subsystems
    waveSpawner  *ARWaveSpawner       // ar_wave.go
    combatEngine *ARCombatEngine      // damage calc, crit, status effects
    levelSystem  *ARLevelSystem       // ar_levelup.go
    weaponSystem *ARWeaponSystem      // ar_weapon.go (16 weapon types)
    tomeSystem   *ARTomeSystem        // ar_tome.go (16 tomes + diminishing returns)
    itemSystem   *ARItemSystem        // ar_item.go (drop tables)
    synergyChecker *ARSynergyChecker  // ar_synergy.go (10 synergies)
    pvpPhase     *ARPvPPhase          // ar_pvp.go (faction PvP + shrink)

    // Phase tracking
    phase        ARPhase              // deploy, pve, pvp_warning, pvp, settlement
    phaseTimer   float64
    waveNumber   int

    // Terrain
    biomeMap     *BiomeMap
    heightmap    *Heightmap
    terrainMods  TerrainModifiers
}
```

### 2.4 Server File Structure (ar_*.go)

All new files live in the existing `server/internal/game/` package with `ar_` prefix.
No new packages are created -- this follows the existing codebase convention.

```
server/internal/game/
├── combat_mode.go          NEW  CombatMode interface + ClassicCombat wrapper
├── ar_combat.go            NEW  ArenaCombat struct + OnTick orchestration
├── ar_types.go             NEW  AREntity, ARPlayer, AREnemy, ARProjectile, ARItem,
│                                ARInput, ARChoice, ARPhase, ARState, DamageType,
│                                StatusEffectType, CharacterType
├── ar_weapon.go            NEW  16 weapon definitions + auto-fire logic per weapon type
│                                (melee cone, ranged raycast, AOE sphere, homing, trail)
├── ar_tome.go              NEW  16 tome definitions + rarity system + diminishing returns
│                                (n^0.85 for stacks >= 5) + level-up pool generation
├── ar_item.go              NEW  Item definitions + drop tables (normal/elite/miniboss/boss)
│                                + equipment slots (max 3) + instant-use effects
├── ar_synergy.go           NEW  10 synergy definitions + combo detection + bonus activation
│                                (checks tomes + weapons + items on each level-up)
├── ar_wave.go              NEW  PvE wave spawner: tier-adaptive difficulty scaling
│                                wave timing, elite prefixes, miniboss schedule
├── ar_pvp.go               NEW  PvP phase: arena teleport, shrink (30m->10m in 60s),
│                                faction scoring, sovereignty judgment, HP normalization,
│                                damage 40% scaling, CC 50% duration, heal 50% cap
├── ar_enemy.go             NEW  5 mob types (Zombie/Skeleton/Slime/Spider/Creeper)
│                                + elite prefix system (5 types) + 5 minibosses
│                                + "The Arena" final boss (Marathon)
├── ar_levelup.go           NEW  XP curve (50 + level*30), level-up Tome/weapon selection,
│                                rarity roll (Luck-adjusted), Ultra Tome every 10 levels,
│                                weapon choice every 5 levels
├── ar_entity.go            NEW  Player/Enemy/Projectile entity definitions with:
│                                position, velocity, HP, stats, weapon slots, tome stacks,
│                                equipment, status effects, faction, character type
├── ar_character.go         NEW  8 character definitions: passive abilities,
│                                starting weapons, stat biases, unlock conditions
├── ar_ai_tactical.go       NEW  AI Tactical layer extension: build profile selection
│                                (DPS Rush / Tank Wall / XP Farmer / Balanced / Glass Cannon)
│                                based on country situation, tier, sovereignty goal
├── ar_ai_reflexive.go      NEW  AI Reflexive layer extension: behavior tree for combat
│                                (flee / pvp / boss / pve sub-trees), slide timing,
│                                XP collection pathing, formation keeping
│
├── room.go                 MOD  Add combatMode field, delegate tickPlaying() to combatMode.OnTick()
├── country_arena.go        MOD  Pass CombatModeConfig when creating rooms
├── constants.go            MOD  Add AR-specific constants (stamina, slide cooldown, etc.)
├── combat.go               ---  Existing v14 combat (kept for ClassicCombat wrapper)
├── weapon_system.go        ---  Existing v14 weapons (kept for ClassicCombat wrapper)
├── synergy.go              ---  Existing v14 synergies (kept for ClassicCombat wrapper)
├── leveling.go             ---  Existing v14 leveling (kept for ClassicCombat wrapper)
├── npc_monster.go          ---  Existing v14 NPCs (kept for ClassicCombat wrapper)
├── biome.go                ---  Reused directly by ArenaCombat (Voronoi biome modifiers)
├── terrain_bonus.go        ---  Reused directly by ArenaCombat (6 terrain themes)
├── spatial_hash.go         ---  Reused directly (O(1) collision approximation)
├── heightmap.go            ---  Reused directly (terrain height queries)
└── ...                     ---  All other existing files untouched
```

### 2.5 Room Integration Strategy

The Room struct gains one new field. Minimal modification:

```go
// room.go -- additions only

type Room struct {
    // ... all existing fields unchanged ...

    // v18: Pluggable combat system. nil = ClassicCombat (backward compat).
    combatMode CombatMode
}

// SetCombatMode switches the active combat mode.
// Called by CountryArena during room initialization based on game version config.
func (r *Room) SetCombatMode(mode CombatMode) {
    r.mu.Lock()
    defer r.mu.Unlock()
    r.combatMode = mode
}

// tickPlaying -- modified to delegate to combatMode when set:
func (r *Room) tickPlaying() {
    // ... existing timer/end checks unchanged ...

    if r.combatMode != nil {
        events := r.combatMode.OnTick(1.0/float64(TickRate), r.arena.GetTick())
        r.emitEvents(events)
    } else {
        // Existing v10-v17 path (unchanged)
        r.broadcastState(arenaTick)
    }
    // ... existing minimap/shrink/coach broadcasts unchanged ...
}
```

### 2.6 AI Extension Architecture

```
server/internal/game/
├── ar_ai_tactical.go     NEW
│   ├── ARTacticalAI struct
│   │   ├── SelectBuildProfile(tier, theme, sovereignty) -> BuildProfile
│   │   ├── SelectArenaEntry(countries) -> countryISO
│   │   ├── PlanPvPStrategy(factionScores) -> PvPStrategy
│   │   └── ChooseTome(options, profile) -> tomeID
│   └── 5 BuildProfiles:
│       DPS_Rush, Tank_Wall, XP_Farmer, Balanced, Glass_Cannon
│
├── ar_ai_reflexive.go    NEW
│   ├── ARReflexiveAI struct
│   │   └── Tick(entity, enemies, allies, phase) -> ARInput
│   └── Behavior Tree:
│       Root (Selector)
│       ├── HP < 30% -> Flee (farthest safe zone)
│       ├── PvP Phase -> PvP_AI
│       │   ├── Target enemy faction (highest score first)
│       │   ├── Formation with allies
│       │   ├── Periodic slide dodge
│       │   └── Stay near center during shrink
│       ├── Elite/Boss nearby -> Boss_AI
│       │   ├── Maintain safe distance (boss range + 2m)
│       │   ├── Dodge AOE (red zones)
│       │   └── Prioritize boss
│       └── Default -> PvE_AI
│           ├── Move toward dense mob clusters
│           ├── Optimize XP crystal collection path
│           ├── Exploit biome bonuses
│           └── Claim high ground (terrain_bonus)
│
└── bot.go / national_ai.go  EXISTING (unchanged, used by ClassicCombat)
```

**AI Difficulty by Tier** (ar_ai_reflexive.go):
- **Easy** (D-Tier default): Linear movement, random builds, stationary PvP attacks
- **Normal** (C/D-Tier): Basic dodge, build profiles, weak-target PvP
- **Hard** (B/A-Tier): AOE dodge, optimal builds, slide dodge + pursuit
- **Master** (S-Tier): Perfect dodge, meta builds, pro-level movement

---

## 3. Client R3F Component Tree

### 3.1 Component Hierarchy

```
GameCanvas3D.tsx (existing, extended)
├── <Canvas>
│   ├── ARScene               NEW -- Lighting + fog + sky (extends MCScene pattern)
│   │   ├── <ambientLight>
│   │   ├── <directionalLight>
│   │   └── <fog> (theme-dependent color/density)
│   │
│   ├── ARTerrain             NEW -- Voxel terrain (extends MCTerrain pattern)
│   │   ├── InstancedMesh[blockType] per block type
│   │   ├── Web Worker chunk generation (mc-terrain-worker pattern)
│   │   └── Theme-specific block palette (6 themes)
│   │
│   ├── ARCamera              NEW -- TPS camera (extends TPSCamera pattern)
│   │   ├── Follow mode (behind 5m, above 3m)
│   │   ├── Combat zoom-out (7m)
│   │   ├── PvP overview transition
│   │   ├── Spectator free-cam
│   │   └── Pointer Lock controls
│   │
│   ├── ARPlayer              NEW -- Local player character
│   │   ├── VoxelCharacter mesh (existing component reuse)
│   │   ├── Animation state machine (walk/run/jump/slide/idle/attack)
│   │   ├── Weapon visual attachment
│   │   └── Status effect VFX overlay
│   │
│   ├── AREntities            NEW -- Remote players + enemies
│   │   ├── InstancedMesh for enemies (per mob type, LOD)
│   │   ├── VoxelCharacter for other players
│   │   ├── HP bars (Billboard sprites)
│   │   ├── Faction color indicators
│   │   └── Elite/boss glow effects
│   │
│   ├── ARProjectiles         NEW -- Bullets, arrows, spells, AOE zones
│   │   ├── InstancedMesh for projectile types
│   │   ├── Trail particles
│   │   └── Impact VFX
│   │
│   ├── AREffects             NEW -- Visual effects
│   │   ├── Damage numbers (floating, color-coded)
│   │   ├── Status effect particles (burn, freeze, shock, poison)
│   │   ├── Level-up flash
│   │   ├── Synergy activation VFX
│   │   └── XP crystal sparkle
│   │
│   ├── ArenaBoundary         EXISTING -- Arena shrink visualization
│   ├── WeatherEffects        EXISTING -- Weather system
│   └── PostProcessingEffects EXISTING -- Bloom, vignette
│
└── <HTML Overlays> (outside Canvas)
    ├── ARHUD                 NEW -- HP bar, XP bar, timer, weapon slots (6),
    │                               equipment slots (3), stamina bar, level indicator
    ├── ARLevelUp             NEW -- Tome selection UI (3 cards with rarity colors)
    │                               + weapon selection (every 5 levels)
    ├── ARPvPOverlay          NEW -- PvP countdown, faction scoreboard, kill feed,
    │                               sovereignty result
    ├── ARMinimap             NEW -- Top-right minimap with biome overlay,
    │                               enemy dots, ally dots, item dots
    ├── ARDeathScreen         NEW -- Death recap, spectator mode toggle,
    │                               final stats, rewards summary
    ├── FactionScoreboard     EXISTING -- Faction scores
    ├── KillFeedHUD           EXISTING -- Kill notifications
    └── MobileControls        EXISTING -- Touch joystick
```

### 3.2 Component Directory Structure

```
apps/web/
├── components/game/
│   ├── ar/                         NEW DIRECTORY
│   │   ├── ARScene.tsx             Scene setup (lighting, fog, sky per theme)
│   │   ├── ARTerrain.tsx           Voxel terrain with 6 theme palettes
│   │   ├── ARCamera.tsx            TPS camera (follow/combat/spectator)
│   │   ├── ARPlayer.tsx            Local player (movement, animation, weapons)
│   │   ├── AREntities.tsx          Remote players + enemies (InstancedMesh + LOD)
│   │   ├── ARProjectiles.tsx       Projectile rendering + trails
│   │   ├── AREffects.tsx           Damage numbers, status VFX, level-up flash
│   │   ├── ARHUD.tsx               HP/XP/timer/weapons/equipment/stamina
│   │   ├── ARLevelUp.tsx           Tome/weapon selection cards (3 choices)
│   │   ├── ARPvPOverlay.tsx        PvP phase UI (countdown, scores, result)
│   │   ├── ARMinimap.tsx           Minimap with biome zones
│   │   └── ARDeathScreen.tsx       Death + spectator + rewards
│   │
│   ├── GameCanvas3D.tsx            MOD: Add arena combat mode detection + AR component mount
│   └── ...existing components
│
├── hooks/
│   ├── useARState.ts               NEW: Arena state hook (entity interpolation, phase tracking)
│   ├── useSocket.ts                MOD: Add ar_* event handlers
│   └── useInputManager.ts          MOD: Add slide (Shift+Space), stamina display
│
└── lib/
    ├── 3d/
    │   ├── ar-types.ts             NEW: Client-side Arena type definitions
    │   ├── ar-interpolation.ts     NEW: Entity position/rotation interpolation
    │   ├── ar-effects.ts           NEW: Client-side particle/VFX utilities
    │   ├── ar-terrain-themes.ts    NEW: 6 theme block palettes + biome color maps
    │   ├── mc-noise.ts             REUSE: Perlin noise for terrain generation
    │   ├── mc-materials.ts         REUSE: Block material generation
    │   ├── mc-terrain-worker.ts    REUSE: Web Worker terrain chunk generation
    │   ├── mc-types.ts             REUSE: BlockType enum, constants
    │   └── ...existing
    └── ...existing
```

---

## 4. Existing Code Reuse Map

### 4.1 Server Reuse (Direct)

| Existing Module | File | Reuse in v18 |
|----------------|------|-------------|
| **BiomeMap** | `game/biome.go` | Direct -- Voronoi 6-biome system + `GetBiomeModifiers()` for speed/vision modifiers |
| **TerrainModifiers** | `game/terrain_bonus.go` | Direct -- `GetTerrainModifiers(theme)` returns speed/DPS/damage/ranged/vision/orb/shrink multipliers |
| **SpatialHash** | `game/spatial_hash.go` | Direct -- O(1) entity proximity queries for auto-attack targeting and collision |
| **Heightmap** | `game/heightmap.go` | Direct -- Surface height queries for 3D movement (ground following, fall damage) |
| **CountryArenaManager** | `game/country_arena.go` | Direct -- Player routing, queue system, 50-cap per arena |
| **Room state machine** | `game/room.go` | Extended -- Add CombatMode delegation in tickPlaying() |
| **WorldManager** | `world/world_manager.go` | Direct -- 195 country lifecycle, battle scheduling, arena pooling |
| **CountryArena** | `world/country_arena.go` | Direct -- Tier, sovereignty, faction scores, terrain theme |
| **CalcMaxAgents** | `world/country_data.go` | Direct -- Log-scale population-adjusted player caps per tier |
| **TierConfigs** | `world/country_data.go` | Direct -- Arena radius (1500-6000px), max agents (8-50), resource scale per tier |
| **SovereigntyEngine** | `world/sovereignty.go` | Direct -- Sovereignty changes from battle results |

### 4.2 Client Reuse (Pattern Adaptation)

| Existing Component | Reuse Pattern | New Component |
|-------------------|---------------|---------------|
| **TPSCamera** (`components/3d/TPSCamera.tsx`) | Fork+modify: Change constants (CAM_HEIGHT 12->3, CAM_DISTANCE 30->5), add combat zoom-out mode, keep pointer lock + yaw/pitch + observer mode | **ARCamera** |
| **MCTerrain** (`components/3d/MCTerrain.tsx`) | Fork+modify: Same InstancedMesh + Web Worker architecture, replace terrain generation with theme-specific palettes, bounded arena (not infinite chunks) | **ARTerrain** |
| **MCScene** (`components/3d/MCScene.tsx`) | Fork+modify: Theme-dependent sky color, fog distance scaled to arena radius, keep lighting setup | **ARScene** |
| **MCCamera** (`components/3d/MCCamera.tsx`) | Reference: Physics model (gravity, jump velocity, grounded detection), wall collision via noise height sampling. ARCamera uses similar physics but adapted to TPS | **ARCamera physics** |
| **VoxelCharacter** (`components/3d/VoxelCharacter.tsx`) | Direct reuse: Voxel character mesh for players (already supports skins + animation) | **ARPlayer** visual |
| **AgentInstances** (`components/3d/AgentInstances.tsx`) | Pattern reuse: InstancedMesh for rendering many entities efficiently | **AREntities** |
| **DamageNumbers** (`components/3d/DamageNumbers.tsx`) | Direct reuse: Floating damage text with Billboard | **AREffects** |
| **ArenaBoundary** (`components/3d/ArenaBoundary.tsx`) | Direct reuse: Circular boundary visualization with shrink animation | **ARPvPOverlay** boundary |
| **GameLoop** (`components/3d/GameLoop.tsx`) | Pattern reuse: useFrame-based interpolation and state application | **ARGameLoop** (within ARPlayer) |
| **WeaponRenderer** (`components/3d/WeaponRenderer.tsx`) | Direct reuse: 3D weapon models attached to character | **ARPlayer** weapon visual |
| **MCParticles** (`components/3d/MCParticles.tsx`) | Pattern reuse: Particle system with pooling and lifecycle | **AREffects** particles |
| **MCNoise** (`lib/3d/mc-noise.ts`) | Direct reuse: Perlin noise for terrain surface generation | **ARTerrain** |
| **mc-materials.ts** (`lib/3d/mc-materials.ts`) | Extended: Add theme-specific block materials (lava, ice, sand, etc.) | **ar-terrain-themes.ts** |
| **mc-terrain-worker.ts** (`lib/3d/mc-terrain-worker.ts`) | Fork+modify: Bounded chunk generation (arena radius), theme-aware block placement | **ARTerrain** worker |
| **animation-state-machine.ts** | Direct reuse: State machine for character animations | **ARPlayer** animation |
| **camera-shake.ts** | Direct reuse: Camera shake on critical hits and explosions | **ARCamera** effects |
| **sound-engine.ts** | Extended: Add combat sounds (weapon fire, hit, death, level-up) | **AR audio** |

### 4.3 minecraft-threejs Reference Patterns

The `minecraft-threejs/` repository is a vanilla Three.js Minecraft clone. Several patterns are useful for reference but need adaptation to R3F:

| Pattern | Source File | What to Reference | Adaptation Notes |
|---------|------------|-------------------|------------------|
| **Perlin Noise terrain** | `minecraft-threejs/src/terrain/noise/index.ts` | Noise class: seed-based Perlin with configurable gap/amp, separate seeds for stone/coal/tree | Already ported to `lib/3d/mc-noise.ts`. Extend with biome-weighted noise (desert dunes vs mountain peaks) |
| **Chunk-based generation** | `minecraft-threejs/src/terrain/worker/generate.ts` | Web Worker chunk generation: block-type InstancedMesh matrices, idMap for position lookups | Already ported to `mc-terrain-worker.ts`. For v18: add bounded arena (skip chunks outside radius), theme block selection |
| **InstancedMesh per block type** | `minecraft-threejs/src/terrain/index.ts` | One InstancedMesh per BlockType, maxCount based on render distance, matrix updates on chunk change | Already ported. For v18: reduce block types per theme (only 4-6 relevant types per theme vs 12) |
| **Block type system** | `minecraft-threejs/src/terrain/index.ts` BlockType enum | 12 block types with material mapping | Already ported to `mc-types.ts`. Extend with theme blocks: lava, ice, snow, urban_concrete, etc. |
| **Collision detection** | `minecraft-threejs/src/control/worker/downCollide.ts` | Block-level collision for grounding/height detection using idMap | Reference for ARCamera ground detection. Use heightmap + block lookup for precise surface |
| **Entity textures** | `minecraft-threejs/src/static/textures/entity/` | Mob textures (zombie, skeleton, slime, spider, creeper) -- exact mobs used in v18 enemy list | Reference for voxel mob designs. Can use texture atlas approach for InstancedMesh rendering |

---

## 5. Network Protocol -- ar_ Events

### 5.1 Event Table

All new events use `ar_` prefix. Existing events (`input`, `death`, `battle_end`) are extended, not replaced.

```
Direction: C = Client, S = Server

┌──────────────────┬────┬──────────┬──────────────────────────────────────────────┐
│ Event            │Dir │ Freq     │ Payload                                      │
├──────────────────┼────┼──────────┼──────────────────────────────────────────────┤
│ input            │C→S │ 30Hz     │ {dir: {x,z}, slide: bool, jump: bool}        │
│                  │    │          │ (extends existing: adds slide, jump)          │
├──────────────────┼────┼──────────┼──────────────────────────────────────────────┤
│ ar_state         │S→C │ 20Hz     │ {                                            │
│                  │    │          │   tick: uint64,                               │
│                  │    │          │   phase: "deploy"|"pve"|"pvp_warn"|"pvp"|     │
│                  │    │          │          "settlement",                        │
│                  │    │          │   phaseTimer: float64,                        │
│                  │    │          │   players: [{id, pos, vel, hp, maxHp,         │
│                  │    │          │     level, faction, character, weapons,       │
│                  │    │          │     statusEffects, alive}],                   │
│                  │    │          │   enemies: [{id, type, pos, hp, maxHp,        │
│                  │    │          │     elite, elitePrefix}],                     │
│                  │    │          │   projectiles: [{id, type, pos, vel, owner}], │
│                  │    │          │   items: [{id, type, pos, rarity}],           │
│                  │    │          │   xpCrystals: [{pos, value}],                 │
│                  │    │          │   biomeEffects: [{zone, type, intensity}]     │
│                  │    │          │ }                                             │
│                  │    │          │ NOTE: Delta-encoded after first full frame    │
├──────────────────┼────┼──────────┼──────────────────────────────────────────────┤
│ ar_level_up      │S→C │ Event    │ {                                            │
│                  │    │          │   level: int,                                │
│                  │    │          │   tomes: [{id, name, rarity, desc, effect,   │
│                  │    │          │     stacks, currentStacks}],                  │
│                  │    │          │   isWeaponChoice: bool,                       │
│                  │    │          │   weapons: [{id, name, tier, desc,           │
│                  │    │          │     type, damageType, currentLevel}]          │
│                  │    │          │ }                                             │
├──────────────────┼────┼──────────┼──────────────────────────────────────────────┤
│ ar_choose        │C→S │ Event    │ {tomeId: string} | {weaponId: string}        │
├──────────────────┼────┼──────────┼──────────────────────────────────────────────┤
│ ar_pvp_start     │S→C │ Event    │ {arenaRadius: float64, shrinkTarget: float64,│
│                  │    │          │  duration: int, factions: [{id, name, color,  │
│                  │    │          │  memberCount}]}                               │
├──────────────────┼────┼──────────┼──────────────────────────────────────────────┤
│ ar_pvp_end       │S→C │ Event    │ {winningFaction: string,                     │
│                  │    │          │  scores: [{factionId, kills, deaths,          │
│                  │    │          │  timeAlive, totalScore}],                     │
│                  │    │          │  sovereigntyChange: {from, to, country},     │
│                  │    │          │  mvp: {id, name, kills, damage}}             │
├──────────────────┼────┼──────────┼──────────────────────────────────────────────┤
│ ar_damage        │S→C │ Event    │ {targetId: string, sourceId: string,         │
│                  │    │          │  amount: float64, critCount: int,             │
│                  │    │          │  damageType: string, statusApplied: string,  │
│                  │    │          │  position: {x,y,z}}                          │
│                  │    │          │ NOTE: Batched (up to 50/tick for perf)        │
├──────────────────┼────┼──────────┼──────────────────────────────────────────────┤
│ ar_item_pickup   │S→C │ Event    │ {playerId: string, itemId: string,           │
│                  │    │          │  itemType: string, rarity: string}            │
├──────────────────┼────┼──────────┼──────────────────────────────────────────────┤
│ ar_synergy       │S→C │ Event    │ {playerId: string, synergyId: string,        │
│                  │    │          │  name: string, bonusDesc: string}             │
├──────────────────┼────┼──────────┼──────────────────────────────────────────────┤
│ ar_wave          │S→C │ Event    │ {waveNumber: int, enemyCount: int,           │
│                  │    │          │  eliteCount: int, hasBoss: bool,              │
│                  │    │          │  bossName: string}                            │
├──────────────────┼────┼──────────┼──────────────────────────────────────────────┤
│ death            │S→C │ Event    │ {killerId, killerName, faction, damageType,  │
│                  │    │          │  weaponType, critCount}                       │
│                  │    │          │ (extends existing: adds weaponType, critCount)│
├──────────────────┼────┼──────────┼──────────────────────────────────────────────┤
│ battle_end       │S→C │ Event    │ {sovereignty: {faction, country, changed},   │
│                  │    │          │  factionScores: [...], mvp: {...},            │
│                  │    │          │  rewards: {tokens, xp, items}}               │
│                  │    │          │ (extends existing: adds rewards)              │
├──────────────────┼────┼──────────┼──────────────────────────────────────────────┤
│ ar_spectate      │C→S │ Event    │ {targetId: string | null}                    │
│                  │    │          │ null = free camera, string = follow player    │
└──────────────────┴────┴──────────┴──────────────────────────────────────────────┘
```

### 5.2 Delta Encoding for ar_state

To reduce bandwidth for 50-player arenas, `ar_state` uses delta encoding after the initial full frame:

```
First frame: Full state (~4KB for S-Tier 50 players + 200 enemies)
Subsequent: Only changed fields
  - Entity positions: Only entities that moved > 0.1 units
  - HP changes: Only entities whose HP changed
  - New/removed entities: Add/remove lists
  - Projectiles: Full replacement (cheap, volatile)
  
Estimated bandwidth per client:
  - S-Tier (50 players + 200 enemies): ~2KB/frame * 20Hz = ~40KB/s
  - D-Tier (8 players + 30 enemies): ~0.5KB/frame * 20Hz = ~10KB/s
```

---

## 6. Data Flow Diagrams

### 6.1 Standard Battle (5 Minutes) -- Main Game Loop

```
                        WorldManager
                            │
                    scheduleBattle(countryISO)
                            │
                            ▼
                    CountryArena.StartBattle()
                            │
                    creates Room + ArenaCombat
                            │
                            ▼
              ┌─────────────────────────────┐
              │  Room State Machine (20Hz)  │
              └──────────┬──────────────────┘
                         │
    ┌────────────────────┼────────────────────┐
    │                    │                    │
    ▼                    ▼                    ▼
 Waiting            Countdown             Playing
 (players join)     (10s)                 (5 min)
                                              │
                         ┌────────────────────┼────────────────────┐
                         │                    │                    │
                         ▼                    ▼                    ▼
                   ArenaCombat          ArenaCombat          ArenaCombat
                   .OnTick()            .OnInput()           .OnChoose()
                         │                    │                    │
    ┌────────────────────┼────────────────────┤                    │
    │                    │                    │                    │
    ▼                    ▼                    ▼                    ▼
 WaveSpawner      CombatEngine         Player Move         LevelSystem
 (spawn enemies)  (auto-attack,        (WASD+slide+        (tome/weapon
                   damage calc,         jump, stamina)       selection)
                   status effects)            │                    │
    │                    │                    │                    │
    ▼                    ▼                    ▼                    ▼
 ar_wave          ar_damage            ar_state             ar_level_up
 (event)          (event)              (20Hz broadcast)     (event)
```

### 6.2 Phase Transitions (Standard 5-min Battle)

```
 Time    Phase           ArenaCombat Actions
 ────    ─────           ──────────────────
 00:00   Deploy (10s)    - Spawn players at arena edges
                         - Grace period (invincible)
                         - Show faction colors
                         - ar_state: phase="deploy"

 00:10   PvE (3m30s)     - Wave spawner active (every 3s)
                         - Auto-attack engine running
                         - XP crystal drops on enemy death
                         - Level-ups trigger ar_level_up
                         - Miniboss at 2:00 and 4:00
                         - ar_state: phase="pve"

 03:40   PvP Warning     - 10s countdown overlay
         (10s)           - ar_state: phase="pvp_warn"

 03:50   PvP (60s)       - Teleport survivors to PvP arena
                         - HP normalization (avg * 1.2)
                         - Damage scaling (40%)
                         - Arena shrink (radius -> 1/3)
                         - Faction scoring active
                         - ar_pvp_start event
                         - ar_state: phase="pvp"

 04:50   Settlement      - Determine winning faction
         (10s)           - Sovereignty judgment
                         - Rewards distribution
                         - ar_pvp_end event
                         - ar_state: phase="settlement"

 05:00   End             - battle_end event
                         - Room -> Cooldown (15s)
                         - -> Next battle or rotation
```

### 6.3 Auto-Attack Data Flow (per tick, 50ms)

```
   ArenaCombat.OnTick()
        │
        ▼
   For each alive player/AI:
        │
        ├─► SpatialHash.QueryRadius(pos, maxWeaponRange)
        │        │
        │        ▼
        │   [nearbyEnemies] sorted by distance
        │        │
        │        ▼
        ├─► For each equipped weapon (max 6):
        │   │
        │   ├─ Check cooldown (weapon.cooldownTicks > 0 ? skip)
        │   │
        │   ├─ Find target (nearest enemy in weapon range + cone/ray check)
        │   │
        │   ├─ Calculate damage:
        │   │   baseDmg * (1 + DamageTome*0.15)
        │   │         * (1 + characterPassive)
        │   │         * critMultiplier(overcritical)
        │   │         * elementalAffinity[atk][def]
        │   │         * (1 + equipmentBonus)
        │   │         * (100 / (100 + defense))
        │   │         * terrainMod * biomeMod
        │   │
        │   ├─ Apply status effects (burn/freeze/shock/poison/bleed)
        │   │
        │   ├─ Emit ar_damage event
        │   │
        │   └─ Reset weapon cooldown
        │
        ├─► Check XP crystal pickup (magnetRange = 2m + MagnetTome*1m)
        │   └─ If enough XP: trigger level-up, emit ar_level_up
        │
        ├─► Apply status effect ticks (DOT damage, CC expiry)
        │
        └─► SynergyChecker.Check() on any build change
            └─ If new synergy: emit ar_synergy event
```

### 6.4 Client Rendering Pipeline

```
   WebSocket
      │
      ├─ ar_state (20Hz)
      │     │
      │     ▼
      │  useARState hook
      │     ├─ Interpolation buffer (3 frames)
      │     ├─ Entity add/remove tracking
      │     └─ Phase state management
      │     │
      │     ▼
      │  R3F useFrame (every render frame, ~60fps)
      │     ├─ ARPlayer: Apply interpolated local position
      │     ├─ AREntities: Update InstancedMesh matrices
      │     │   ├─ LOD: >20m = box mesh, <20m = voxel mob
      │     │   └─ Cull: >50m = skip update
      │     ├─ ARProjectiles: Update projectile positions
      │     ├─ ARCamera: Follow player + smooth lerp
      │     └─ AREffects: Particle system tick
      │
      ├─ ar_damage (event)
      │     ▼
      │  AREffects
      │     ├─ Spawn damage number (billboard, color by type)
      │     ├─ Hit flash on target entity
      │     └─ Status effect particle spawn
      │
      ├─ ar_level_up (event)
      │     ▼
      │  ARLevelUp overlay (HTML)
      │     ├─ 3 Tome cards (rarity border color)
      │     ├─ Or weapon selection cards
      │     ├─ 5s timeout auto-select
      │     └─ User clicks -> ar_choose -> server
      │
      └─ ar_pvp_start/end (events)
            ▼
         ARPvPOverlay (HTML)
            ├─ Faction scoreboard
            ├─ Kill feed
            ├─ Shrink warning
            └─ Sovereignty result
```

---

## 7. Self-Verification

### 7.1 Coverage Check vs v18-arena-plan.md

| Plan Section | Architecture Coverage | Status |
|-------------|----------------------|--------|
| SS1 Overview (concept, tiers, tech stack) | C4 diagram, component table, tier configs | COVERED |
| SS2 Core Game Loop (dual mode, PvE/PvP) | Phase transition diagram, ArenaCombat subsystems | COVERED |
| SS3 Round Structure (Standard 5min, Marathon 1hr) | Phase timeline, BattleMode in CombatModeConfig | COVERED |
| SS4 Movement System (3D, stamina, wall jump) | ARCamera reuse plan, physics from MCCamera | COVERED |
| SS5 Combat System (auto-attack, hit detection) | Auto-attack data flow, CombatEngine, ar_damage | COVERED |
| SS6 Weapon System (16 types, upgrades, evolution) | ar_weapon.go, weapon visual in ARPlayer | COVERED |
| SS7 Tome System (16 types, rarity, diminishing) | ar_tome.go, ar_levelup.go, ARLevelUp component | COVERED |
| SS8 Item System (drops, equipment) | ar_item.go, ar_item_pickup event | COVERED |
| SS9 Character System (8 types, passives) | ar_character.go, CharacterType in ar_types.go | COVERED |
| SS10 Enemy/AI System (5 mobs, elite, boss, NationalAI) | ar_enemy.go, ar_ai_tactical.go, ar_ai_reflexive.go, behavior tree | COVERED |
| SS11 Damage Formula (overcritical, elemental, defense) | CombatEngine in ar_combat.go, auto-attack flow | COVERED |
| SS12 Synergy & Build Meta (10 synergies, archetypes) | ar_synergy.go, SynergyChecker in OnTick | COVERED |
| SS13 PvP Arena (faction PvP, shrink, balancing) | ar_pvp.go, ARPvPOverlay, ar_pvp_start/end events | COVERED |
| SS14 Meta Progression & Economy (tokens, quests, season) | ar_reward.go (mentioned in roadmap Phase 6) | COVERED (Phase 6) |
| SS15 Technical Architecture (server modules, client, protocol) | Full architecture document sections 2-6 | COVERED |
| SS16 Risks (R1-R10) | Addressed via: CombatMode interface (R4), LOD/culling (R2), delta encoding (R1), PvP scaling (R3) | COVERED |
| Roadmap Phase 1-7 | File structure maps to all roadmap phases | COVERED |

### 7.2 Consistency Check

| Check | Result | Notes |
|-------|--------|-------|
| CombatMode interface covers all Room lifecycle hooks | PASS | Init, OnTick, OnPlayerJoin/Leave, OnInput, OnChoose, GetState, GetMinimap, Cleanup |
| ClassicCombat backward compatibility | PASS | Wraps existing Arena with zero behavioral changes |
| ar_state payload matches plan SS15 protocol table | PASS | All fields present: players, enemies, projectiles, items, biome_effects |
| ar_level_up supports both Tome and weapon choice | PASS | isWeaponChoice flag + weapons array for every-5-level weapon selection |
| PvP phase correctly references DetermineWinningFaction | PASS | ar_pvp.go delegates to existing world/country_arena.go sovereignty logic |
| Tier scaling uses existing CalcMaxAgents | PASS | CombatModeConfig.MaxAgents populated from CalcMaxAgents(tier, pop) |
| TerrainModifiers + BiomeModifiers compose correctly | PASS | Speed = terrainMod.SpeedMult * biomeModifiers.SpeedMult (multiplicative) |
| Client component tree avoids useFrame priority pitfall | PASS | All components use priority 0 (documented in GameCanvas3D.tsx header) |
| Delta encoding specified for ar_state bandwidth | PASS | Section 5.2 describes full first frame + changed-only subsequent frames |
| Entity pooling strategy for GC prevention | PASS | ar_enemy.go + ar_entity.go use pre-allocated pools (plan SS15 optimization) |
| OperatorRegistry integration path | PASS | ar_ai_tactical.go can be replaced by external operator via existing OperatorRegistry API |
| Marathon mode lifecycle | PASS | BattleMode "marathon" in config, 11 PvP cycles + final boss handled by ARPvPPhase |

### 7.3 Identified Gaps (Addressed)

| Gap | Resolution |
|-----|-----------|
| Plan mentions `ar_tactical_ai.go` in `ai/` package but existing codebase has no `ai/` package | Moved to `game/ar_ai_tactical.go` and `game/ar_ai_reflexive.go` following existing convention (all game logic in `game/` package) |
| Plan SS15 client uses `mb/` directory name (legacy naming) | Renamed to `ar/` directory throughout. All components use `AR` prefix per project requirement |
| Plan mentions `lib/mb/` for client libraries | Renamed to `lib/3d/ar-*.ts` following existing `lib/3d/mc-*.ts` convention |
| Stamina system not in existing constants.go | Added to ar_types.go (max 100, run cost 50/s, slide cost 30, regen 20/s) |
| Missing event for item pickup notification | Added `ar_item_pickup` event to protocol table |
| Missing spectator event for death/observer mode | Added `ar_spectate` event (C->S) for spectator target selection |
| No mention of ar_wave event for wave start notification | Added `ar_wave` event to protocol table |

---

## 8. Key Design Decisions Summary

### 8.1 Why CombatMode Interface (not new package)

1. **Room state machine stays unchanged** -- Deploy/PvE/PvP/Settlement phases are CombatMode-internal
2. **Backward compatibility** -- ClassicCombat wraps existing Arena, zero regression risk
3. **Single package** -- All game logic in `game/` avoids circular imports (existing pain point)
4. **Testing** -- CombatMode is a clean interface for unit testing without Room/WorldManager

### 8.2 Why ar_* File Prefix (not subdirectory)

1. **Go package rules** -- Subdirectory = separate package = import cycles
2. **Consistency** -- Existing codebase uses flat file structure in `game/`
3. **Discoverability** -- `ar_` prefix groups all Arena files in alphabetical listing

### 8.3 Why Fork MCTerrain (not direct reuse)

1. **MCTerrain is infinite chunks** -- Arena terrain is bounded (radius 1500-6000px)
2. **Block palette differs** -- Arena uses theme-specific blocks (lava, ice, concrete)
3. **Generation algorithm differs** -- Arena needs biome-weighted noise + flat center
4. **Worker reuse** -- Same Web Worker architecture, different generation function

### 8.4 Why TPSCamera Fork (not MCCamera)

1. **MCCamera is FPS + PointerLock** -- Arena is TPS (camera behind player)
2. **TPSCamera already has** -- Follow mode, observer mode, killcam, pointer lock
3. **Minimal changes** -- Adjust constants (distance 30->5, height 12->3), add combat zoom

---

## Appendix A: Type Definitions Preview

### Server (ar_types.go)

```go
type ARPhase string
const (
    PhaseDeploy     ARPhase = "deploy"
    PhasePvE        ARPhase = "pve"
    PhasePvPWarning ARPhase = "pvp_warn"
    PhasePvP        ARPhase = "pvp"
    PhaseSettlement ARPhase = "settlement"
)

type DamageType string
const (
    DmgPhysical  DamageType = "physical"
    DmgFire      DamageType = "fire"
    DmgFrost     DamageType = "frost"
    DmgLightning DamageType = "lightning"
    DmgPoison    DamageType = "poison"
)

type StatusEffectType string
const (
    StatusBurn   StatusEffectType = "burn"
    StatusFreeze StatusEffectType = "freeze"
    StatusShock  StatusEffectType = "shock"
    StatusPoison StatusEffectType = "poison"
    StatusBleed  StatusEffectType = "bleed"
    StatusMark   StatusEffectType = "mark"
)

type CharacterType string
const (
    CharStriker   CharacterType = "striker"
    CharGuardian  CharacterType = "guardian"
    CharPyro      CharacterType = "pyro"
    CharFrostMage CharacterType = "frost_mage"
    CharSniper    CharacterType = "sniper"
    CharGambler   CharacterType = "gambler"
    CharBerserker CharacterType = "berserker"
    CharShadow    CharacterType = "shadow"
)

type AREntity struct {
    ID            string
    Type          string         // "player", "enemy", "projectile", "item", "xp"
    Position      Position3D     // {X, Y, Z}
    Velocity      Position3D
    Rotation      float64
    HP            float64
    MaxHP         float64
    Alive         bool
    Faction       string
}

type ARPlayer struct {
    AREntity
    Character     CharacterType
    Level         int
    XP            int
    XPToNext      int
    Weapons       [6]*ARWeaponSlot
    Tomes         map[string]int   // tomeID -> stacks
    Equipment     [3]*AREquipItem
    Stamina       float64
    MaxStamina    float64
    StatusEffects []ARStatusEffect
    Kills         int
    Deaths        int
    DamageDealt   float64
    FactionScore  int
}
```

### Client (ar-types.ts)

```typescript
export type ARPhase = 'deploy' | 'pve' | 'pvp_warn' | 'pvp' | 'settlement';
export type DamageType = 'physical' | 'fire' | 'frost' | 'lightning' | 'poison';
export type StatusEffect = 'burn' | 'freeze' | 'shock' | 'poison' | 'bleed' | 'mark';
export type CharacterType = 'striker' | 'guardian' | 'pyro' | 'frost_mage'
                          | 'sniper' | 'gambler' | 'berserker' | 'shadow';

export interface ARPlayerState {
  id: string;
  pos: { x: number; y: number; z: number };
  vel: { x: number; y: number; z: number };
  hp: number;
  maxHp: number;
  level: number;
  faction: string;
  character: CharacterType;
  weapons: ARWeaponSlotState[];
  statusEffects: { type: StatusEffect; remaining: number }[];
  alive: boolean;
}

export interface AREnemyState {
  id: string;
  type: 'zombie' | 'skeleton' | 'slime' | 'spider' | 'creeper'
      | 'golem' | 'wraith' | 'dragon_whelp' | 'lich_king' | 'the_arena';
  pos: { x: number; y: number; z: number };
  hp: number;
  maxHp: number;
  elite: boolean;
  elitePrefix?: 'armored' | 'swift' | 'vampiric' | 'explosive' | 'shielded';
}

export interface ARState {
  tick: number;
  phase: ARPhase;
  phaseTimer: number;
  players: ARPlayerState[];
  enemies: AREnemyState[];
  projectiles: ARProjectileState[];
  items: ARItemState[];
  xpCrystals: { pos: { x: number; y: number; z: number }; value: number }[];
}
```
