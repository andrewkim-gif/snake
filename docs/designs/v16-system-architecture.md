# v16 Game Experience Overhaul — System Architecture

> **Version**: v1.0
> **Date**: 2026-03-07
> **Status**: Proposed
> **Parent Design**: [`docs/designs/v16-game-experience-plan.md`](v16-game-experience-plan.md)
> **Base Architecture**: [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md) (v2.0 — Agent Survivor v10)
> **Architect**: System Architect + Backend Architect + Frontend Architect

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Goals / Non-Goals / Constraints](#2-goals--non-goals--constraints)
3. [System Context — C4 Level 1](#3-system-context--c4-level-1)
4. [Container Architecture — C4 Level 2](#4-container-architecture--c4-level-2)
5. [Component Architecture — C4 Level 3](#5-component-architecture--c4-level-3)
6. [Critical Data Flows](#6-critical-data-flows)
7. [WebSocket Protocol Changes](#7-websocket-protocol-changes)
8. [Data Model Changes](#8-data-model-changes)
9. [Terrain System Architecture](#9-terrain-system-architecture)
10. [Input & Camera System](#10-input--camera-system)
11. [Animation System Overhaul](#11-animation-system-overhaul)
12. [Sound System Architecture](#12-sound-system-architecture)
13. [Weather & Effects System](#13-weather--effects-system)
14. [Bot AI Pathfinding](#14-bot-ai-pathfinding)
15. [Performance Architecture](#15-performance-architecture)
16. [Architecture Decision Records](#16-architecture-decision-records)
17. [Migration Strategy](#17-migration-strategy)
18. [Kill-Cam & Jump Physics](#18-kill-cam--jump-physics)
19. [Verification Matrix](#19-verification-matrix)

---

## 1. Executive Summary

v16 transforms AI World War from a **top-down auto-combat arena** into a **third-person action experience** with terrain depth, directional combat, and environmental immersion. This architecture document deepens the [v16 plan](v16-game-experience-plan.md) into implementation-ready specifications across 9 phases.

### Change Scope vs Base Architecture

| Dimension | v10/v15 (current) | v16 (target) | Impact |
|-----------|-------------------|--------------|--------|
| **Coordinate System** | 2D (x, y) flat plane | 2.5D (x, y) + height(x,y) lookup | Server: Agent, Collision, Serializer. Client: all 3D components |
| **Input Protocol** | `{a, b, s}` (single angle + boost) | `{ma, aa, b, d, j, s}` (moveAngle + aimAngle + dash + jump) | Server: InputHandler, Agent. Client: InputManager, interpolation |
| **Camera** | Fixed 3/4 view (PlayCamera) | TPS orbital (Spherical coords, mouse-drag yaw/pitch) | Client only: new TPSCamera replaces PlayCamera |
| **Terrain** | Flat VoxelTerrain 120x120 + decorations | Heightmap PlaneGeometry + biomes + collidable obstacles | Server: HeightmapGen + ObstacleGrid. Client: HeightmapTerrain |
| **Animation** | Math-based AnimationStateMachine (fixed amplitude) | Speed-proportional + secondary motion + terrain-reactive | Client only: AnimationStateMachine overhaul |
| **Audio** | None | Howler.js + positional audio (SFX, BGM, ambient) | Client only: new SoundEngine module |
| **Bot AI** | Linear target tracking | A* pathfinding + obstacle avoidance + terrain awareness | Server only: NavGrid + A* in BotManager |
| **Weather** | None | Server-driven 5-min cycle per biome (speed/vision modifiers) | Server: WeatherManager. Client: WeatherFX renderer |

### Backward Compatibility

The v16 input protocol is **backward-compatible**: the server accepts both `{a, b, s}` (v15) and `{ma, aa, b, d, j, s}` (v16) formats. Legacy clients without `ma`/`aa` fall back to single-heading mode where `a` maps to both MoveHeading and AimHeading. This allows phased rollout without breaking existing AI agents.

---

## 2. Goals / Non-Goals / Constraints

### 2.1 Goals

| # | Goal | Measurable Target | Validation |
|---|------|--------------------|------------|
| G1 | TPS camera-relative WASD movement | Camera yaw rotation + W=forward relative to camera | Manual play-test: 8-direction movement feels intuitive |
| G2 | Move/aim separation | Agent moves in moveAngle, faces aimAngle independently | Server: two distinct heading fields update separately |
| G3 | Heightmap terrain with server authority | Server generates + gzip-transmits heightmap; client displaces PlaneGeometry | Height values match exactly (0 floating-point drift) |
| G4 | Collidable obstacles | ObstacleGrid blocks agent movement with sliding | Bot and player agents cannot pass through Tree/Rock/Building cells |
| G5 | 60fps at 60 agents + terrain | No frame drops on mid-range GPU (GTX 1060 / M1) | Performance profiling: frame budget < 16ms |
| G6 | Sound system | Footsteps, combat, ambient, BGM with spatial audio | Audio plays on all 5 trigger categories |
| G7 | Weather affects gameplay | Speed/vision modifiers from server weather state | Server-driven modifier applies; client fog adjusts |
| G8 | Animation expressiveness | Speed-proportional amplitude, secondary motion, terrain-reactive | Visual: agents lean uphill, swim in water, have landing squash |

### 2.2 Non-Goals

| # | Non-Goal | Reason |
|---|----------|--------|
| NG1 | Full 3D vertical combat (flying, multi-floor buildings) | Scope explosion; 2.5D height is sufficient for v16 |
| NG2 | Procedural mesh destruction (Minecraft-style block breaking) | GPU cost too high for 60 agents; use simple HP-based despawn |
| NG3 | Voice chat / VOIP | Unrelated to game experience overhaul |
| NG4 | Replay system | Deferred to v17 |
| NG5 | Seed-based deterministic terrain generation | Float precision risk across Go/JS; direct gzip transfer chosen |

### 2.3 Constraints

| Constraint | Bound | Source |
|-----------|-------|--------|
| Server tick rate | 20Hz (50ms budget) | Existing architecture; all new server logic must fit within |
| Network bandwidth delta | < 20% increase | NFR-4; moveAngle + aimAngle adds ~4 bytes/input |
| Heightmap transfer size | < 50KB gzip (S-tier) | NFR-5; must fit in joined event without exceeding WS frame limit |
| Client memory | < 512MB including GPU textures | NFR-6; terrain mesh + obstacle InstancedMesh + audio buffers |
| Terrain mesh generation | < 3 seconds | NFR-2; chunk-based progressive loading if needed |
| Mobile support | 30fps minimum | NFR-1; quality tiers: Low (mobile), High (PC) |

---

## 3. System Context -- C4 Level 1

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          AI World War v16                                │
│                                                                          │
│  ┌──────────────┐     WebSocket      ┌──────────────────────────────┐   │
│  │   Browser     │◄──────────────────►│     Go Game Server           │   │
│  │ (Next.js/R3F) │   {ma,aa,b,d,j,s} │  + HeightmapGen              │   │
│  │ + TPSCamera   │   state 20Hz      │  + ObstacleGrid              │   │
│  │ + SoundEngine │   + terrain gzip  │  + WeatherManager             │   │
│  │ + WeatherFX   │                   │  + A* NavGrid                 │   │
│  └──────────────┘                    └──────────────────────────────┘   │
│         │                                       │                        │
│    Touch/WASD/Mouse                         REST API                    │
│         │                                       │                        │
│  ┌──────────────┐                    ┌──────────────────────────────┐   │
│  │ Mobile Client │                   │  External Services            │   │
│  │ Dual Joystick │                   │  (CROSS blockchain, CDN)     │   │
│  └──────────────┘                    └──────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
```

**New v16 actors in context:**
- Browser gains `TPSCamera`, `SoundEngine`, `WeatherFX`, `InputManager` modules
- Go Server gains `HeightmapGenerator`, `ObstacleGrid`, `WeatherManager`, `NavGrid` modules
- Mobile client gains dual virtual joystick (left=move, right=aim) replacing single-touch
- Heightmap data flows as gzip binary in `joined` event (one-time, 8-50KB)

---

## 4. Container Architecture -- C4 Level 2

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Go Game Server                                    │
│                                                                              │
│  ┌──────────┐   ┌──────────────┐   ┌──────────────┐   ┌────────────────┐  │
│  │    WS     │   │   Room       │   │   Arena      │   │  Heightmap     │  │
│  │  Handler  │──►│   Manager    │──►│  (per-room)  │◄──│  Generator     │  │
│  │ (chi/ws)  │   │  50 rooms    │   │              │   │  Perlin Noise  │  │
│  └──────────┘   └──────────────┘   │  ┌─────────┐ │   └────────────────┘  │
│       │                             │  │Collision│ │                        │
│       │  input{ma,aa,b,d,j,s}      │  │+ Height │ │   ┌────────────────┐  │
│       │                             │  │+ Obst.  │ │   │  Obstacle      │  │
│       ▼                             │  └─────────┘ │◄──│  Grid          │  │
│  ┌──────────┐                      │  ┌─────────┐ │   │  (per-arena)   │  │
│  │Broadcast │◄─────────────────────│  │Weather  │ │   └────────────────┘  │
│  │  er      │   state 20Hz        │  │Manager  │ │                        │
│  │ +terrain │   + f (facing)      │  └─────────┘ │   ┌────────────────┐  │
│  │  gzip    │   + z (height)      │  ┌─────────┐ │   │  NavGrid       │  │
│  └──────────┘                      │  │Bot AI   │ │◄──│  A* Pathfind   │  │
│                                    │  │+ A*     │ │   └────────────────┘  │
│                                    │  └─────────┘ │                        │
│                                    └──────────────┘                        │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                       Next.js Client (R3F)                                   │
│                                                                              │
│  ┌────────────┐   ┌────────────────┐   ┌──────────────────────────────┐    │
│  │InputManager│   │  TPSCamera     │   │  Scene                       │    │
│  │ WASD+Mouse │──►│  Spherical     │──►│  ┌─────────────────────────┐ │    │
│  │ Joystick   │   │  yaw/pitch/    │   │  │ HeightmapTerrain        │ │    │
│  └─────┬──────┘   │  distance      │   │  │ PlaneGeometry+displace  │ │    │
│        │          └────────────────┘   │  ├─────────────────────────┤ │    │
│        │ moveAngle                     │  │ ObstacleInstances       │ │    │
│        │ + aimAngle                    │  │ Trees/Rocks/Buildings   │ │    │
│        ▼                               │  ├─────────────────────────┤ │    │
│  ┌────────────┐                        │  │ AgentInstances          │ │    │
│  │  useSocket │                        │  │ + SecondaryMotion       │ │    │
│  │  WS Client │                        │  │ + TerrainReactive       │ │    │
│  └────────────┘                        │  ├─────────────────────────┤ │    │
│        │                               │  │ WaterSurface            │ │    │
│  ┌─────┴──────┐   ┌────────────────┐  │  │ Transparent shader      │ │    │
│  │SoundEngine │   │ CameraEffects  │  │  ├─────────────────────────┤ │    │
│  │ Howler.js  │   │ Shake/Zoom/    │  │  │ WeatherFX               │ │    │
│  │ + spatial  │   │ Chromatic/     │  │  │ Rain/Snow/Sand/Fog      │ │    │
│  └────────────┘   │ Vignette       │  │  └─────────────────────────┘ │    │
│                   └────────────────┘  └──────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### New Containers (v16 additions)

| Container | Runtime | Responsibility | Data |
|-----------|---------|----------------|------|
| **HeightmapGenerator** | Go (server) | Perlin noise heightmap generation per arena | float32 grid (60x60 ~ 240x240) |
| **ObstacleGrid** | Go (server) | 2D uint8 grid for collidable objects | uint8 per cell (50px resolution) |
| **WeatherManager** | Go (server) | 5-min weather cycle, speed/vision modifiers | WeatherState per arena |
| **NavGrid** | Go (server) | Walkable cell extraction + A* pathfinding | bool grid + cached paths |
| **InputManager** | TypeScript (client) | WASD/mouse/joystick to moveAngle+aimAngle | InputState struct |
| **TPSCamera** | TypeScript (client) | Spherical orbital camera with terrain clipping | yaw, pitch, distance |
| **HeightmapTerrain** | TypeScript (client) | PlaneGeometry + vertex displacement + biome colors | Float32Array heightmap |
| **SoundEngine** | TypeScript (client) | Howler.js BGM + spatial SFX | AudioSprite + pools |
| **WeatherFX** | TypeScript (client) | Particle systems (rain/snow/sand) + fog control | ParticleSystem config |
| **CameraEffects** | TypeScript (client) | Post-processing (shake, zoom, chromatic, vignette) | Effect queue |

---

## 5. Component Architecture -- C4 Level 3

### 5.1 Server Components (Go)

#### 5.1.1 Modified: `domain/types.go` -- Agent struct

```go
// v16 additions to Agent struct
type Agent struct {
    // ... existing fields (ID, Name, Position, Heading, Speed, Mass, etc.)

    // v16: Move/Aim separation
    MoveHeading  float64  `json:"moveHeading"`   // WASD-based movement direction
    AimHeading   float64  `json:"aimHeading"`     // Mouse-based aim/facing direction
    // Heading field preserved for backward compat (= MoveHeading)

    // v16: Vertical position
    ZPos         float64  `json:"zPos"`           // height above terrain
    ZVelocity    float64  `json:"zVelocity"`      // vertical velocity (jump/fall)
    OnGround     bool     `json:"onGround"`       // true if standing on terrain

    // v16: Terrain context
    CurrentBiome BiomeType `json:"currentBiome"`  // biome at agent position
    InWater      bool      `json:"inWater"`       // in water body
    WaterDepth   float64   `json:"waterDepth"`    // depth below water surface
}
```

#### 5.1.2 New: `game/heightmap.go` -- HeightmapGenerator

```go
// Location: server/internal/game/heightmap.go
type HeightmapGenerator struct {}

// GenerateHeightmap creates a heightmap for given arena params.
// Returns float32 grid + gzip-compressed bytes for client transfer.
func (hg *HeightmapGenerator) Generate(seed int64, radius float64, cellSize float64) *Heightmap

type Heightmap struct {
    Data       []float32    // row-major grid
    Width      int          // grid cells X
    Height     int          // grid cells Y
    CellSize   float64      // world units per cell (50)
    MinHeight  float64      // -5 (water floor)
    MaxHeight  float64      // +60 (mountain peak)
    Compressed []byte       // gzip(float32 array) for client
}

// GetHeight returns interpolated height at world position (bilinear).
func (h *Heightmap) GetHeight(x, y float64) float64
// GetGradient returns terrain slope vector at position.
func (h *Heightmap) GetGradient(x, y float64) (dx, dy float64)
```

#### 5.1.3 New: `game/obstacle_grid.go` -- ObstacleGrid

```go
// Location: server/internal/game/obstacle_grid.go
type ObstacleType uint8
const (
    ObstEmpty    ObstacleType = 0
    ObstTree     ObstacleType = 1  // blocks, destructible
    ObstRock     ObstacleType = 2  // blocks, indestructible
    ObstBuilding ObstacleType = 3  // blocks, partially destructible
    ObstWater    ObstacleType = 4  // passable, speed reduction
    ObstBush     ObstacleType = 5  // passable, stealth
    ObstShrine   ObstacleType = 6  // existing MapStructures
    ObstSpring   ObstacleType = 7  // existing MapStructures
    ObstAltar    ObstacleType = 8  // existing MapStructures
)

type ObstacleGrid struct {
    Cells      [][]ObstacleType
    Width      int
    Height     int
    CellSize   float64
    Compressed []byte  // gzip for client
}

// IsBlocked returns true if cell at world pos is impassable.
func (og *ObstacleGrid) IsBlocked(x, y float64) bool
// GetType returns the obstacle type at world position.
func (og *ObstacleGrid) GetType(x, y float64) ObstacleType
// TryMove checks movement from (ox,oy) to (nx,ny), returns allowed position (with sliding).
func (og *ObstacleGrid) TryMove(ox, oy, nx, ny float64, radius float64) (float64, float64)
```

#### 5.1.4 New: `game/weather.go` -- WeatherManager

```go
// Location: server/internal/game/weather.go
type WeatherState uint8
const (
    WeatherClear    WeatherState = 0
    WeatherOvercast WeatherState = 1
    WeatherExtreme  WeatherState = 2
)

type WeatherManager struct {
    currentWeather WeatherState
    biome          BiomeType
    cycleTicks     uint64      // 5min = 6000 ticks @ 20Hz
    elapsedTicks   uint64
    speedMod       float64     // 0.8 ~ 1.0
    visionMod      float64     // 0.4 ~ 1.0
}

// ProcessTick advances weather cycle, returns true if state changed.
func (wm *WeatherManager) ProcessTick() bool
// GetModifiers returns current speed and vision multipliers.
func (wm *WeatherManager) GetModifiers() (speedMod, visionMod float64)
```

#### 5.1.5 New: `game/nav_grid.go` -- A* Pathfinding

```go
// Location: server/internal/game/nav_grid.go
type NavGrid struct {
    walkable [][]bool       // derived from ObstacleGrid
    width    int
    height   int
    cellSize float64
}

// FindPath returns A* path from start to goal in world coordinates.
// Returns nil if no path exists. Max search budget: 500 nodes.
func (ng *NavGrid) FindPath(sx, sy, gx, gy float64) []Position

// pathCache stores per-bot cached paths (3-second TTL).
type PathCache struct {
    paths map[string]*CachedPath  // botID -> path
    mu    sync.RWMutex
}
```

#### 5.1.6 Modified: `game/agent.go` -- ApplyInput + UpdateAgent

```go
// ApplyInputV16 handles the new v16 input protocol with move/aim separation.
func ApplyInputV16(a *domain.Agent, moveAngle *float64, aimAngle float64, boost, dash, jump bool) {
    if !a.Alive { return }
    if moveAngle != nil {
        a.MoveHeading = normalizeAngle(*moveAngle)
        // Legacy compat: keep Heading in sync
        a.Heading = a.MoveHeading
    }
    a.AimHeading = normalizeAngle(aimAngle)
    a.Boosting = boost
    // Dash: trigger v14 CanDash()/PerformDash() if d=1
    // Jump: set ZVelocity if onGround (Phase 6)
}

// UpdateAgentV16 moves agent with heightmap + obstacle + water awareness.
func UpdateAgentV16(a *domain.Agent, tick uint64, hm *Heightmap, og *ObstacleGrid, wm *WeatherManager) {
    // 1. Calculate speed (base * weather_mod * water_mod * slope_mod)
    // 2. New position = pos + moveHeading * speed * dt
    // 3. Obstacle check: og.TryMove() -> sliding
    // 4. Height check: abs(newH - curH) > ClimbMax(10) -> block
    // 5. Update ZPos = heightmap.GetHeight(x, y) + jumpZ
    // 6. Water check: zPos < 0 -> inWater, waterDepth
    // 7. Biome check: voronoi lookup
}
```

### 5.2 Client Components (TypeScript/R3F)

#### 5.2.1 New: `hooks/useInputManager.ts`

```typescript
// Location: apps/web/hooks/useInputManager.ts
interface InputState {
  moveAngle: number | null;   // WASD -> camera-relative angle (null = stopped)
  aimAngle: number;           // mouse raycast -> world aim angle
  aimWorldPos: Vector3;       // ground intersection point
  boost: boolean;             // Shift hold
  dash: boolean;              // E one-shot
  jump: boolean;              // Space one-shot
  cameraYaw: number;          // right-click drag horizontal
  cameraPitch: number;        // right-click drag vertical (0.09~1.31 rad)
  cameraZoom: number;         // scroll wheel (10~60)
}

// React hook that returns current InputState and sends to server at 30Hz.
export function useInputManager(socketRef, cameraRef): InputState
```

#### 5.2.2 New: `components/3d/TPSCamera.tsx`

```typescript
// Location: apps/web/components/3d/TPSCamera.tsx (replaces PlayCamera.tsx)
// Spherical coordinate orbital camera tracking the player agent.
// Props: targetPos, yaw, pitch, distance (from useInputManager)
// Terrain clipping: raycast from player to camera, clamp if terrain intersects.
// Defaults: yaw=0, pitch=55deg (phi=0.61rad), distance=25
// Constraints: phi 0.09~1.31 rad, distance 10~60
```

#### 5.2.3 New: `components/3d/HeightmapTerrain.tsx`

```typescript
// Location: apps/web/components/3d/HeightmapTerrain.tsx (replaces VoxelTerrain.tsx)
// Creates PlaneGeometry(arenaSize, arenaSize, gridRes, gridRes)
// Displaces vertices: vertex.y = heightmapData[vertex grid index]
// Applies biome vertex colors from Voronoi region data.
// Material: MeshLambertMaterial({ vertexColors: true })
// Exports getHeight(x, z) for client-side height lookup.
```

#### 5.2.4 New: `components/3d/WaterSurface.tsx`

```typescript
// Location: apps/web/components/3d/WaterSurface.tsx
// PlaneGeometry at y=0 covering water areas.
// ShaderMaterial: transparent, animated normal map for ripples.
// Agents in water: Y offset lowered by waterDepth (upper body visible).
// Splash particles on water entry/exit.
```

#### 5.2.5 New: `components/3d/ObstacleInstances.tsx`

```typescript
// Location: apps/web/components/3d/ObstacleInstances.tsx
// Per-biome InstancedMesh arrays for trees, rocks, buildings, bushes.
// Positions from decoded ObstacleGrid.
// LOD: distance < 15 = full detail, 15-50 = main obstacles, 50+ = frustum cull only.
```

#### 5.2.6 New: `lib/sound-engine.ts`

```typescript
// Location: apps/web/lib/sound-engine.ts
// Howler.js wrapper for BGM + UI sounds.
// Spatial SFX tied to agent positions (distance attenuation: 200px max).
// AudioSprite format: single file + JSON offset map.
// Sound pool: max 16 concurrent sounds.
// Categories: footstep, combat, environment, ui, music.
```

#### 5.2.7 New: `components/3d/WeatherFX.tsx`

```typescript
// Location: apps/web/components/3d/WeatherFX.tsx
// Particle systems for rain, snow, sandstorm.
// Scene fog dynamic control: fog.far = baseFogFar * visionMult.
// Lightning flash (point light burst for storm).
// Receives weather state from server via state event.
```

#### 5.2.8 New: `components/3d/CameraEffects.tsx`

```typescript
// Location: apps/web/components/3d/CameraEffects.tsx
// PC (High): @react-three/postprocessing EffectComposer
//   - ChromaticAberration (low HP), MotionBlur (dash), Vignette (boost)
// Mobile (Low): CSS overlay alternatives
//   - radial-gradient vignette, border speed-lines
// Camera shake: position offset on hit/kill
// Zoom punch: FOV change on kill (1.05x, 0.3s)
// Quality setting: Off / Low / High
```

#### 5.2.9 Modified: `lib/3d/animation-state-machine.ts`

```
Changes (detailed in Section 11):
  - Speed-proportional swing amplitude and bounce
  - Walk/run blend via smoothstep (not threshold)
  - Upper/lower body split (moveAngle vs aimAngle)
  - Secondary motion layer (inertia lag, head tracking, equipment sway)
  - Per-agent variation (armSwing, stride, idleQuirk from hash)
  - Terrain-reactive (slope lean, swim, terrain particles)
  - New state: DODGE_ROLL (0.4s one-shot on dash)
```

#### 5.2.10 Modified: `lib/interpolation.ts`

```
Changes:
  - Add facing/aimAngle interpolation (shortest-arc slerp)
  - Add zPos interpolation (vertical position smoothing)
  - Client prediction uses moveAngle for position, aimAngle for rotation
```

---

## 6. Critical Data Flows

### 6.1 Arena Join + Terrain Transfer

```
Client                          Server
  │                                │
  │  join_room {roomId, name}      │
  │  ─────────────────────────────►│
  │                                │  1. Arena.GetOrCreate()
  │                                │  2. HeightmapGenerator.Generate(seed, radius)
  │                                │  3. ObstacleGrid.Generate(heightmap, biomeLayout)
  │                                │  4. gzip(heightmap.Data) → ~8-50KB
  │                                │  5. gzip(obstacleGrid.Cells) → ~2-10KB
  │                                │
  │  joined {                      │
  │    roomId, id, spawn,          │
  │    arenaRadius, tick,          │
  │    terrainData: base64(gzip),  │
  │    obstacleData: base64(gzip), │
  │    biomeLayout: [{seed,type}], │
  │    weatherState: {state, mods},│
  │    terrainCellSize: 50         │
  │  }                             │
  │  ◄─────────────────────────────│
  │                                │
  │  Client decodes:               │
  │  1. base64 → Uint8Array        │
  │  2. pako.inflate → Float32Array│
  │  3. Build PlaneGeometry mesh   │
  │  4. Place obstacle instances   │
  │  5. Render water at y=0        │
```

### 6.2 Input Processing (v16 protocol)

```
Client                          Server
  │                                │
  │  WASD keys → moveAngle         │
  │  (camera-relative)             │
  │  Mouse pos → aimAngle          │
  │  (ground raycast)              │
  │                                │
  │  input {                       │
  │    ma: 1.57,  // moveAngle     │
  │    aa: 0.78,  // aimAngle      │
  │    b: 1,      // boost         │
  │    d: 0,      // dash          │
  │    j: 0,      // jump          │
  │    s: 42      // seq           │
  │  }                             │
  │  ─────────────────────────────►│
  │                                │  ApplyInputV16():
  │                                │    agent.MoveHeading = ma
  │                                │    agent.AimHeading = aa
  │                                │    agent.Boosting = b
  │                                │    if d: PerformDash()
  │                                │    if j && onGround: Jump()
  │                                │
  │                                │  UpdateAgentV16():
  │                                │    speed = base * weatherMod * waterMod
  │                                │    newPos = pos + MoveHeading * speed
  │                                │    newPos = obstacleGrid.TryMove(...)
  │                                │    agent.ZPos = heightmap.GetHeight(...)
  │                                │
  │  state {                       │
  │    s: [{                       │
  │      i, n, x, y,              │
  │      h,           // heading   │
  │      f: 0.78,     // facing    │
  │      z: 12.5,     // height    │
  │      m, b, a, lv, hr,         │
  │      w: 1,        // weather   │
  │      bi: 2,       // biome     │
  │      ...                       │
  │    }]                          │
  │  }                             │
  │  ◄─────────────────────────────│
```

### 6.3 Weather Cycle

```
Server (per arena, every tick)          Client
  │                                        │
  │  WeatherManager.ProcessTick()          │
  │  ├─ elapsedTicks++                     │
  │  ├─ if elapsedTicks >= cycleTicks:     │
  │  │   roll new weather state            │
  │  │   calculate speedMod, visionMod     │
  │  │   broadcast weather_change event    │
  │  └─ apply speedMod to all agents       │
  │                                        │
  │  weather_change {                      │
  │    state: 2,      // extreme           │
  │    biome: "forest",                    │
  │    speedMod: 0.9,                      │
  │    visionMod: 0.7                      │
  │  }                                     │
  │  ────────────────────────────────────►│
  │                                        │  WeatherFX:
  │                                        │  1. Transition particles
  │                                        │  2. fog.far = 500 * 0.7
  │                                        │  3. Minimap range shrink
```

### 6.4 Kill-Cam Sequence (Client-Only)

```
Event: death {killer, killerName, ...}
  │
  ▼
0.0s  │ Time-freeze: pause interpolation (server continues 20Hz)
0.3s  │ Camera detach from player, lerp to killer position
0.8s  │ Zoom-in on killer (FOV narrow)
0.8s  │ Start orbit around killer (0.5 rad/s)
2.3s  │ Show DeathOverlay
      │ Resume normal camera / spectator mode
```

---

## 7. WebSocket Protocol Changes

### 7.1 Client -> Server: `input` Event (v16)

```typescript
// v15 (current)
interface InputPayloadV15 {
  a: number;   // target angle (single heading)
  b: 0 | 1;   // boost
  s: number;   // sequence
}

// v16 (new, backward-compatible)
interface InputPayloadV16 {
  ma?: number;  // moveAngle (rad, null/undefined = stop)
  aa: number;   // aimAngle (rad)
  b: 0 | 1;    // boost (Shift)
  d?: 0 | 1;   // dash (E key)
  j?: 0 | 1;   // jump (Space)
  s: number;    // sequence

  // Legacy fallback: if 'a' present and 'ma'/'aa' absent, use v15 mode
  a?: number;   // v15 compat: maps to both moveAngle and aimAngle
}
```

**Server detection logic:**
```go
if input.MA != nil || input.AA != 0 {
    // v16 mode: separate move/aim
    ApplyInputV16(agent, input.MA, input.AA, input.B, input.D, input.J)
} else if input.A != 0 {
    // v15 compat: single heading
    ApplyInput(agent, input.A, input.B)
}
```

### 7.2 Server -> Client: `state` Event Changes

```typescript
// AgentNetworkData v16 additions
interface AgentNetworkData {
  // ... existing fields (i, n, x, y, h, m, b, a, k, lv, bot, ks, hr, e, bt, ap, ab, tx, ty, abl, nat)

  f?: number;    // NEW: facing/aimAngle (rad) — distinct from h (moveHeading)
  z?: number;    // NEW: zPos (height above sea level, Phase 4+)
  bi?: number;   // NEW: biome index (0-5)
  iw?: boolean;  // NEW: inWater flag
}
```

**Bandwidth impact**: +4 bytes for `f` (float16 sufficient via quantization), +2 bytes for `z` (int16 * 0.1), +1 byte for `bi`, +1 byte for `iw`. Total: **+8 bytes per agent per tick** = 8 * 60 agents * 20Hz = **9.6 KB/s** (within 20% budget of ~50KB/s baseline).

### 7.3 Server -> Client: `joined` Event Changes

```typescript
interface JoinedPayloadV16 extends JoinedPayload {
  // ... existing fields (roomId, id, spawn, arenaRadius, tick, roomState, timeRemaining, terrainTheme)

  // v16 terrain data
  terrainData?: string;       // base64(gzip(float32[] heightmap))
  obstacleData?: string;      // base64(gzip(uint8[] obstacle grid))
  terrainCellSize?: number;   // grid cell size in world units (50)
  terrainWidth?: number;      // grid width (cells)
  terrainHeight?: number;     // grid height (cells)
  biomeLayout?: BiomeSeed[];  // Voronoi seed points + biome types
  weatherState?: WeatherInfo; // current weather at join time

  // v16 config sync (Phase 0: constants unification)
  serverConfig?: {
    arenaRadius: number;
    turnRate: number;
    baseSpeed: number;
    boostSpeed: number;
    initialMass: number;
  };
}

interface BiomeSeed {
  x: number;
  y: number;
  type: 'forest' | 'desert' | 'mountain' | 'urban' | 'arctic' | 'island';
}

interface WeatherInfo {
  state: number;      // 0=clear, 1=overcast, 2=extreme
  speedMod: number;   // 0.8~1.0
  visionMod: number;  // 0.4~1.0
}
```

### 7.4 Server -> Client: New `weather_change` Event

```typescript
interface WeatherChangePayload {
  state: number;        // WeatherState enum
  biome: string;        // biome type string
  speedMod: number;     // speed multiplier
  visionMod: number;    // vision/fog multiplier
  duration: number;     // estimated duration in seconds
}
```

### 7.5 Server -> Client: New `terrain_update` Event (Phase 8)

```typescript
// For destructible environment objects
interface TerrainUpdatePayload {
  destroyed: Array<{
    cx: number;   // cell X
    cy: number;   // cell Y
    type: number; // what was destroyed
  }>;
  drops?: Array<{
    x: number;
    y: number;
    item: string;
  }>;
}
```

---

## 8. Data Model Changes

### 8.1 Server-Side Agent Extensions

```go
// domain/types.go — BiomeType enum
type BiomeType uint8
const (
    BiomeForest   BiomeType = 0
    BiomeDesert   BiomeType = 1
    BiomeMountain BiomeType = 2
    BiomeUrban    BiomeType = 3
    BiomeArctic   BiomeType = 4
    BiomeIsland   BiomeType = 5
)

// New fields on Agent struct (see Section 5.1.1):
//   MoveHeading, AimHeading     float64
//   ZPos, ZVelocity             float64
//   OnGround                    bool
//   CurrentBiome                BiomeType
//   InWater, WaterDepth         float64
```

### 8.2 Arena Extensions

```go
// game/arena.go — new fields
type Arena struct {
    // ... existing fields (agents, orbManager, spatialHash, collisionSystem, etc.)

    // v16 terrain
    heightmap     *Heightmap
    obstacleGrid  *ObstacleGrid
    weatherMgr    *WeatherManager
    navGrid       *NavGrid
    biomeLayout   []BiomeSeed

    // v16 config sync
    serverConfig  ArenaConfig  // sent to client on join
}

// ArenaConfig for client sync (Phase 0)
type ArenaConfig struct {
    ArenaRadius  float64 `json:"arenaRadius"`
    TurnRate     float64 `json:"turnRate"`
    BaseSpeed    float64 `json:"baseSpeed"`
    BoostSpeed   float64 `json:"boostSpeed"`
    InitialMass  float64 `json:"initialMass"`
}
```

### 8.3 Heightmap Data Format

```
Binary layout (gzip compressed):
  Header: [width:uint16, height:uint16, cellSize:float32, minH:float32, maxH:float32]  // 12 bytes
  Body:   [height_0_0:float32, height_0_1:float32, ..., height_w_h:float32]           // W*H*4 bytes

Total uncompressed:
  C-tier (100x100): 12 + 40,000 = 40,012 bytes → gzip ~8KB
  S-tier (240x240): 12 + 230,400 = 230,412 bytes → gzip ~50KB
```

### 8.4 ObstacleGrid Data Format

```
Binary layout (gzip compressed):
  Header: [width:uint16, height:uint16]  // 4 bytes
  Body:   [type_0_0:uint8, type_0_1:uint8, ..., type_w_h:uint8]  // W*H bytes

Total uncompressed:
  C-tier (100x100): 4 + 10,000 = 10,004 bytes → gzip ~2KB
  S-tier (240x240): 4 + 57,600 = 57,604 bytes → gzip ~10KB
```

### 8.5 Client-Side State Extensions

```typescript
// packages/shared/src/types/game.ts — additions
interface ArenaConfig {
  // ... existing fields
  // v16 additions (dynamically populated from server)
  serverArenaRadius?: number;
  serverTurnRate?: number;
  serverBaseSpeed?: number;
  serverBoostSpeed?: number;
  serverInitialMass?: number;
}

// apps/web/hooks/useSocket.ts — terrain state
interface TerrainState {
  heightmap: Float32Array | null;
  obstacleGrid: Uint8Array | null;
  width: number;
  height: number;
  cellSize: number;
  biomeLayout: BiomeSeed[];
  getHeight: (x: number, z: number) => number;
  getBiome: (x: number, z: number) => BiomeType;
  isBlocked: (x: number, z: number) => boolean;
}
```

### 8.6 Serializer Changes

```go
// game/serializer.go — AgentNetworkData additions
// In serializeAgent():
data["f"] = agent.AimHeading                   // facing angle
data["z"] = math.Round(agent.ZPos*10) / 10     // height (1 decimal)
data["bi"] = int(agent.CurrentBiome)           // biome index
if agent.InWater {
    data["iw"] = true                          // in-water flag
}
```

---

## 9. Terrain System Architecture

### 9.1 Generation Pipeline

```
Arena Creation
      │
      ▼
HeightmapGenerator.Generate(seed, radius, cellSize=50)
      │
      ├─ Layer 1: Continental (octave=2, scale=0.005, amp=40)   — mountains/valleys
      ├─ Layer 2: Regional   (octave=4, scale=0.02,  amp=15)   — hills/bumps
      ├─ Layer 3: Detail     (octave=6, scale=0.08,  amp=3)    — micro terrain
      │
      ▼
BiomeLayout.Generate(seed, 3~5 seedPoints)
      │
      ├─ Voronoi partition with 50px transition blending
      ├─ BiomeModifier applied per cell:
      │    forest:   height * 1.0 + gentle hills
      │    desert:   height * 0.5 + dune pattern (sin waves)
      │    mountain: height * 2.5 + cliff formations
      │    urban:    height * 0.1 (flatten)
      │    arctic:   height * 1.0 + glacier ridges
      │    island:   height * 0.8 - sea level offset
      │
      ▼
ObstacleGrid.Generate(heightmap, biomeLayout)
      │
      ├─ Per-biome density tables (see v16 plan Section 6.3)
      ├─ Obstacle placement avoids spawn points (200px radius)
      ├─ Existing MapStructures (Shrine/Spring/Altar) registered
      │  as ObstacleType 6/7/8 in grid
      │
      ▼
NavGrid.Build(obstacleGrid)
      │
      ├─ walkable[x][y] = !IsBlocked(x, y) && slopeOK(x, y)
      ├─ Slope threshold: gradient > 0.6 → unwalkable
      │
      ▼
gzip compress → store on Arena → send in joined event
```

### 9.2 Height Lookup (Shared Algorithm)

Both server (Go) and client (TypeScript) implement identical bilinear interpolation:

```
getHeight(worldX, worldY):
  // Convert world coords to grid coords
  gx = (worldX + arenaRadius) / cellSize
  gy = (worldY + arenaRadius) / cellSize

  // Grid cell indices
  x0 = floor(gx), x1 = x0 + 1
  y0 = floor(gy), y1 = y0 + 1

  // Fractional part
  fx = gx - x0
  fy = gy - y0

  // Bilinear interpolation
  h00 = data[y0 * width + x0]
  h10 = data[y0 * width + x1]
  h01 = data[y1 * width + x0]
  h11 = data[y1 * width + x1]

  return lerp(lerp(h00, h10, fx), lerp(h01, h11, fx), fy)
```

### 9.3 Obstacle Collision (Server)

```go
func (og *ObstacleGrid) TryMove(ox, oy, nx, ny, radius float64) (float64, float64) {
    // 1. Check destination cell
    if !og.IsBlocked(nx, ny) {
        return nx, ny  // free movement
    }

    // 2. Axis-separated sliding
    // Try X-only movement
    if !og.IsBlocked(nx, oy) {
        return nx, oy  // slide along Y wall
    }
    // Try Y-only movement
    if !og.IsBlocked(ox, ny) {
        return ox, ny  // slide along X wall
    }

    // 3. Both blocked — stay in place
    return ox, oy
}
```

### 9.4 Water System

```
Water surface: y = 0 (world space)
Terrain below water: heightmap cells with value < 0

Depth calculation:
  waterDepth = max(0, 0 - heightmap.GetHeight(x, y))

Speed modifiers:
  depth 0~2:   speed *= 0.7  (wading)
  depth 2~5:   speed *= 0.5  (swimming)
  depth 5+:    speed *= 0.3 + HP loss 2/tick (deep water)

Client rendering:
  - WaterSurface mesh at y=0, transparent shader with normal-map animation
  - Agent Y offset: agent.renderY = max(0, heightmap(x,z)) - min(0, waterDepth * 0.3)
  - Splash particles on water entry/exit (MCParticles system)
```

### 9.5 Client Terrain Rendering

```typescript
// HeightmapTerrain.tsx construction
const geometry = new PlaneGeometry(
  arenaSize, arenaSize,
  gridWidth - 1, gridHeight - 1
);
geometry.rotateX(-Math.PI / 2);  // XZ plane

// Displace vertices
const positions = geometry.attributes.position;
for (let i = 0; i < positions.count; i++) {
  positions.setY(i, heightmapData[i]);
}
geometry.computeVertexNormals();

// Biome vertex colors
const colors = new Float32Array(positions.count * 3);
for (let i = 0; i < positions.count; i++) {
  const biome = getBiomeAtVertex(i);
  const height = heightmapData[i];
  const [r, g, b] = biomeColorGradient(biome, height);
  colors[i * 3] = r;
  colors[i * 3 + 1] = g;
  colors[i * 3 + 2] = b;
}
geometry.setAttribute('color', new BufferAttribute(colors, 3));
```

---

## 10. Input & Camera System

### 10.1 InputManager Architecture

```typescript
// hooks/useInputManager.ts

// State machine for input sources
type InputSource = 'keyboard_mouse' | 'touch_joystick';

// Core hook
function useInputManager(socketRef, cameraRef): {
  state: InputState;
  source: InputSource;
} {
  // 1. Keyboard listener (WASD + Shift + Space + E)
  //    - keydown/keyup → track moveKeys {w,a,s,d}
  //    - WASD combo → 8-direction moveAngle (camera-relative)
  //    - No keys pressed → moveAngle = null (stop)

  // 2. Mouse listener
  //    - mousemove → raycaster.setFromCamera(ndc, camera)
  //    - intersectPlane(groundPlane at y=terrainHeight) → aimWorldPos
  //    - aimAngle = atan2(aimWorldPos.z - playerZ, aimWorldPos.x - playerX)
  //    - right-click drag → deltaX → cameraYaw, deltaY → cameraPitch
  //    - scroll → cameraZoom (10~60, logarithmic steps)

  // 3. Touch listener (mobile)
  //    - Left joystick (bottom-left 25% screen) → moveAngle
  //    - Right joystick (bottom-right 25% screen) → aimAngle
  //    - Boost button, Dash button → separate touch targets

  // 4. Send to server at 30Hz (inputSendInterval = 33ms)
  //    - Only send if state changed (dead-reckoning optimization)
  //    - Quantize angles to 2 decimal places
}
```

### 10.2 WASD -> moveAngle Conversion

```
Given: cameraYaw (current camera horizontal rotation)
Given: moveKeys = {w, a, s, d}

Step 1: Calculate raw direction from keys
  if (w && !s) baseDir = 0        // forward
  if (s && !w) baseDir = PI       // backward
  if (a && !d) baseDir = PI/2     // left
  if (d && !a) baseDir = -PI/2    // right
  if (w && a)  baseDir = PI/4     // forward-left
  if (w && d)  baseDir = -PI/4    // forward-right
  if (s && a)  baseDir = 3*PI/4   // backward-left
  if (s && d)  baseDir = -3*PI/4  // backward-right
  if none:     moveAngle = null   // stop

Step 2: Apply camera rotation
  moveAngle = normalizeAngle(cameraYaw + baseDir)
```

### 10.3 TPSCamera Design

```typescript
// components/3d/TPSCamera.tsx
// Uses useFrame() to update every render frame

interface TPSCameraState {
  yaw: number;       // horizontal rotation (0 = north)
  pitch: number;     // vertical angle (Spherical phi)
  distance: number;  // distance from target
  target: Vector3;   // player position (smoothed)
}

// Update loop:
function updateCamera(state, playerPos, heightmap, dt) {
  // 1. Smooth target tracking
  state.target.lerp(playerPos, 1 - Math.pow(0.001, dt));

  // 2. Calculate camera position (Spherical -> Cartesian)
  const offset = new Vector3(
    state.distance * Math.sin(state.pitch) * Math.sin(state.yaw),
    state.distance * Math.cos(state.pitch),
    state.distance * Math.sin(state.pitch) * Math.cos(state.yaw)
  );
  const camPos = state.target.clone().add(offset);

  // 3. Terrain clipping prevention
  const terrainH = heightmap.getHeight(camPos.x, camPos.z) + 2.0;
  if (camPos.y < terrainH) {
    camPos.y = terrainH;  // push camera above terrain
  }

  // 4. Occlusion check: raycast from target to camPos
  //    If terrain intersects, pull camera closer
  const ray = new Ray(state.target, offset.normalize());
  // ... check terrain mesh intersection, clamp distance

  camera.position.copy(camPos);
  camera.lookAt(state.target);
}

// Constraints:
//   pitch (phi): 0.09 rad (5 deg, near top-down) ~ 1.31 rad (75 deg, near horizontal)
//   distance: 10 (close) ~ 60 (far)
//   yaw: unconstrained (0 ~ 2*PI wrap)
```

### 10.4 Mobile Dual Joystick

```
Screen layout:
  ┌─────────────────────────────────────┐
  │                                     │
  │                                     │
  │                                     │
  │   ┌─────┐                 ┌─────┐  │
  │   │  L  │     [BOOST]     │  R  │  │
  │   │ Joy │     [DASH]      │ Joy │  │
  │   │ stk │                 │ stk │  │
  │   └─────┘                 └─────┘  │
  └─────────────────────────────────────┘

Implementation:
  - HTML overlay div with touch event handlers
  - Left joystick zone: 0-40% width, 50-100% height
  - Right joystick zone: 60-100% width, 50-100% height
  - Joystick visual: circular base + draggable thumb
  - Max drag radius: 50px → normalized to 0~1 magnitude
  - Left thumb angle → moveAngle (no camera-relative needed on touch)
  - Right thumb angle → aimAngle
  - Release → stop (moveAngle = null)
  - Tap outside joystick zones → no action
```

---

## 11. Animation System Overhaul

### 11.1 Current State (AnimationStateMachine)

The existing `lib/3d/animation-state-machine.ts` (1089 lines) defines 10 states:
`IDLE, WALKING, BOOSTING, DEATH, STUNNED, APPEARING, VICTORY, COLLECTING, UPGRADING, ATTACKING`

**Current limitations:**
- Fixed swing amplitude (0.44 rad) regardless of speed
- Fixed bounce amplitude (1.2) regardless of speed
- Threshold-based walk/idle transition (WALK_THRESHOLD=5, instant)
- No upper/lower body separation
- No terrain awareness
- All agents have identical motion (only phase offset differs)

### 11.2 v16 Animation Layers

```
Layer Architecture (bottom to top):

┌─────────────────────────────────────────────┐
│ Layer 4: Effects (one-shot, highest priority)│
│   HIT_REACT, DEATH, DODGE_ROLL, KILL_ROAR  │
├─────────────────────────────────────────────┤
│ Layer 3: Terrain Reactive                    │
│   Slope lean, swim overlay, terrain particles│
├─────────────────────────────────────────────┤
│ Layer 2: Secondary Motion                    │
│   Inertia lag, head tracking, equipment sway │
├─────────────────────────────────────────────┤
│ Layer 1: Base Locomotion                     │
│   IDLE, WALK, RUN (speed-proportional)       │
│   Upper body: aimAngle                       │
│   Lower body: moveAngle                      │
└─────────────────────────────────────────────┘
```

### 11.3 Speed-Proportional Motion

```typescript
// Replace fixed amplitudes with speed-proportional values
function calculateMotionParams(velocity: number, boostSpeed: number) {
  const speedRatio = clamp(velocity / boostSpeed, 0, 1);

  return {
    // Swing amplitude: small at slow speed, large at sprint
    swingAmplitude: lerp(0.25, 0.55, speedRatio),   // was: 0.44 fixed
    // Bounce amplitude: subtle at slow, pronounced at sprint
    bounceAmplitude: lerp(0.6, 2.0, speedRatio),    // was: 1.2 fixed
    // Walk-to-run blend (smooth transition, not threshold)
    runBlend: smoothstep(WALK_THRESHOLD, boostSpeed * 0.6, velocity),
    // Body lean forward when running
    forwardLean: lerp(0, 0.15, speedRatio),          // radians
    // Step frequency stays velocity-linked (existing: velocity/80)
    walkFreq: velocity / 80,
  };
}
```

### 11.4 Upper/Lower Body Split

```
Lower body (legs, hips):
  - Rotation follows moveAngle (WASD direction)
  - Walk cycle tied to movement velocity

Upper body (torso, arms, head):
  - Rotation follows aimAngle (mouse direction)
  - Weapon/attack animations use aimAngle
  - Head independently tracks aimAngle with slight delay

Split implementation:
  - hipRotationY = moveAngle
  - torsoRotationY = aimAngle
  - twistAngle = angleDiff(aimAngle, moveAngle)
  - if |twistAngle| > 120deg: force lower body to align (can't twist that far)
```

### 11.5 Secondary Motion

```typescript
interface SecondaryMotionState {
  // Inertia lag: torso lags behind heading changes
  torsoLagAngle: number;     // lerp toward current heading (0.1s delay)
  torsoLagVelocity: number;  // for spring simulation

  // Head tracking: head looks toward aimAngle independently
  headYaw: number;           // lerp toward aimAngle (0.05s delay)

  // Equipment sway: weapon/hat bounce with movement
  equipmentPhase: number;    // driven by walkCycle
  equipmentAmplitude: number; // spring constant

  // Landing squash: after jump/fall
  squashFactor: number;      // 1.0 = normal, 0.85 = squashed
  squashRecovery: number;    // spring back to 1.0 over 0.15s
}

// Update per frame:
function updateSecondaryMotion(state, agent, dt) {
  // Torso lag (spring damper)
  const torsoTarget = agent.heading;
  state.torsoLagAngle = damp(state.torsoLagAngle, torsoTarget, 10, dt);

  // Head tracking
  state.headYaw = damp(state.headYaw, agent.aimAngle, 20, dt);

  // Equipment sway (sine wave offset from walk cycle)
  state.equipmentPhase += agent.walkFreq * dt;
  const sway = Math.sin(state.equipmentPhase * 1.3) * state.equipmentAmplitude;

  // Squash recovery
  if (state.squashFactor < 1.0) {
    state.squashFactor = damp(state.squashFactor, 1.0, 15, dt);
  }
}
```

### 11.6 Per-Agent Variation

```typescript
// Generate variation params from agent ID hash
function generateVariation(agentId: string): AgentVariation {
  const hash = simpleHash(agentId);
  return {
    armSwingMult: 0.8 + (hash % 40) / 100,      // 0.8 ~ 1.2
    strideMult: 0.9 + ((hash >> 8) % 20) / 100,  // 0.9 ~ 1.1
    idleQuirk: (hash >> 16) % 5,                  // 0~4 unique idle behavior
    // 0: head tilt side to side
    // 1: foot tap
    // 2: stretch arms
    // 3: look around
    // 4: scratch head
    bodyTypeInfluence: 0,  // derived from dominant build type
    // tank: heavier bounce, wider stance
    // speedster: lighter bounce, narrower stance
  };
}
```

### 11.7 New State: DODGE_ROLL

```
Trigger: dash input (E key)
Duration: 0.4 seconds (one-shot)
Animation:
  - Agent tilts 90deg forward on moveAngle axis
  - Full body rotation (roll) over 0.4s
  - Y position: slight hop (3 units up at midpoint)
  - Invincibility during roll (existing dash mechanic)
Transition:
  - From any locomotion state
  - Returns to previous locomotion state on completion
  - Cannot be interrupted
```

### 11.8 Terrain-Reactive Animation

```typescript
function applyTerrainReaction(agent, heightmap, biome) {
  // 1. Slope lean: lean into uphill direction
  const [gradX, gradZ] = heightmap.getGradient(agent.x, agent.z);
  const slopeAngle = Math.atan2(Math.sqrt(gradX*gradX + gradZ*gradZ), 1);
  const leanAngle = clamp(slopeAngle, 0, 0.26);  // max 15 degrees
  const leanDir = Math.atan2(gradZ, gradX);
  // Apply lean to torso rotation

  // 2. Swimming: when in water
  if (agent.inWater) {
    // Hide lower body (set leg transforms to y = -waterDepth)
    // Switch arm animation to breaststroke pattern
    // Add bobbing Y motion
  }

  // 3. Terrain particles (emit from MCParticles)
  if (agent.isMoving && frameCount % 10 === 0) {
    const particleType = biomeParticleMap[biome];
    // forest → green leaf, desert → sand puff, arctic → snow flake
    emitTerrainParticle(agent.x, agent.z, particleType);
  }
}
```

---

## 12. Sound System Architecture

### 12.1 Hybrid Audio Strategy

```
┌──────────────────────────────────────────────────┐
│                  SoundEngine                      │
│                                                   │
│  ┌───────────────────┐  ┌──────────────────────┐ │
│  │   Howler.js        │  │   drei Positional    │ │
│  │   (Global Audio)   │  │   Audio (3D Spatial) │ │
│  │                    │  │                      │ │
│  │  - BGM loops       │  │  - Footsteps         │ │
│  │  - UI sounds       │  │  - Combat hits       │ │
│  │  - Level-up chime  │  │  - Environment       │ │
│  │  - Countdown       │  │  - Ability SFX       │ │
│  └───────────────────┘  └──────────────────────┘ │
│                                                   │
│  ┌──────────────────────────────────────────────┐│
│  │           AudioSprite Manager                 ││
│  │  Single .webm file + JSON offset map          ││
│  │  Lazy-loaded on first user interaction        ││
│  └──────────────────────────────────────────────┘│
└──────────────────────────────────────────────────┘
```

### 12.2 Sound Categories & Triggers

| Category | Sound ID | Trigger | Spatial | Source |
|----------|----------|---------|---------|--------|
| **Footstep** | `step_grass` | walkCycle phase crossing | Yes | kenney.nl |
| | `step_sand` | walkCycle + desert biome | Yes | kenney.nl |
| | `step_stone` | walkCycle + mountain/urban | Yes | kenney.nl |
| | `step_snow` | walkCycle + arctic biome | Yes | kenney.nl |
| | `step_water` | walkCycle + in water | Yes | kenney.nl |
| **Combat** | `hit_melee` | aura damage applied | Yes | kenney.nl |
| | `hit_ranged` | projectile weapon hit | Yes | kenney.nl |
| | `shield_block` | IronSkin damage reduction | Yes | kenney.nl |
| | `critical_hit` | crit multiplier triggered | Yes | kenney.nl |
| | `death_cry` | agent death | Yes | kenney.nl |
| **Environment** | `wind_loop` | always (ambient layer) | No | freesound.org |
| | `rain_loop` | weather = rain | No | freesound.org |
| | `bird_ambient` | forest biome | No | freesound.org |
| | `fire_crackle` | near structures/desert | Yes | freesound.org |
| **UI** | `level_up` | level-up event | No | kenney.nl |
| | `orb_collect` | orb pickup | No | kenney.nl |
| | `ability_ready` | cooldown complete | No | kenney.nl |
| | `countdown_tick` | round countdown | No | kenney.nl |
| **Music** | `bgm_lobby` | lobby screen | No | (composable) |
| | `bgm_combat` | in-game playing | No | (composable) |
| | `bgm_tension` | < 5 agents alive | No | (composable) |
| | `victory_fanfare` | round win | No | (composable) |

### 12.3 Sound Pool & Distance Attenuation

```typescript
// lib/sound-engine.ts
const MAX_CONCURRENT_SOUNDS = 16;
const SPATIAL_MAX_DISTANCE = 200; // world units
const SPATIAL_REF_DISTANCE = 20;  // full volume distance

class SoundEngine {
  private pool: SoundInstance[] = [];
  private howl: Howl;  // AudioSprite
  private activeSounds: number = 0;

  play(soundId: string, options?: {
    position?: Vector3;     // for spatial audio
    volume?: number;        // 0~1
    rate?: number;          // playback rate (0.5~2.0)
    loop?: boolean;
  }): void {
    if (this.activeSounds >= MAX_CONCURRENT_SOUNDS) {
      // Priority-based eviction: footsteps < environment < combat < UI
      this.evictLowestPriority();
    }

    if (options?.position) {
      // Distance attenuation
      const dist = camera.position.distanceTo(options.position);
      if (dist > SPATIAL_MAX_DISTANCE) return; // too far, skip
      const vol = (options.volume ?? 1) * Math.max(0,
        1 - (dist - SPATIAL_REF_DISTANCE) / (SPATIAL_MAX_DISTANCE - SPATIAL_REF_DISTANCE)
      );
      // Pan based on relative position
    }

    this.howl.play(soundId);
    this.activeSounds++;
  }
}
```

### 12.4 Footstep Synchronization

```typescript
// Tied to animation walk cycle phase
function checkFootstepTrigger(prevPhase: number, curPhase: number, biome: BiomeType) {
  // Footstep at phase 0 (left foot) and PI (right foot)
  const crossedLeft = prevPhase < 0 && curPhase >= 0;
  const crossedRight = prevPhase < Math.PI && curPhase >= Math.PI;

  if (crossedLeft || crossedRight) {
    const soundId = biomeFootstepMap[biome]; // step_grass, step_sand, etc.
    soundEngine.play(soundId, {
      position: agentPosition,
      rate: 0.9 + Math.random() * 0.2,  // slight variation
    });
  }
}
```

---

## 13. Weather & Effects System

### 13.1 Server Weather Manager

```go
// Weather cycle per arena (5 minutes = 6000 ticks @ 20Hz)
// Probabilities: Clear 60%, Overcast 25%, Extreme 15%

func (wm *WeatherManager) ProcessTick() bool {
    wm.elapsedTicks++
    if wm.elapsedTicks < wm.cycleTicks {
        return false // no change
    }

    // Roll new weather
    wm.elapsedTicks = 0
    roll := rand.Float64()
    switch {
    case roll < 0.60:
        wm.currentWeather = WeatherClear
    case roll < 0.85:
        wm.currentWeather = WeatherOvercast
    default:
        wm.currentWeather = WeatherExtreme
    }

    // Calculate modifiers based on biome + weather combo
    wm.speedMod, wm.visionMod = weatherModTable[wm.biome][wm.currentWeather]
    return true // broadcast weather_change
}
```

**Modifier Table:**

| Biome | Overcast Speed/Vision | Extreme Speed/Vision |
|-------|----------------------|---------------------|
| Forest | 0.95 / 1.0 | 1.0 / 0.7 |
| Desert | 1.0 / 0.8 | 0.9 / 0.5 |
| Mountain | 1.0 / 0.6 | 0.85 / 0.5 |
| Urban | 1.0 / 1.0 | 1.0 / 0.8 |
| Arctic | 1.0 / 1.0 | 0.8 / 0.4 |
| Island | 1.0 / 1.0 | 0.9 / 0.6 |

### 13.2 Client Weather Rendering

```typescript
// components/3d/WeatherFX.tsx

interface WeatherFXProps {
  weatherState: WeatherInfo;
  biome: BiomeType;
  playerPosition: Vector3;
}

function WeatherFX({ weatherState, biome, playerPosition }: WeatherFXProps) {
  // 1. Fog control
  useEffect(() => {
    const baseFogFar = 500;
    scene.fog = new Fog(fogColor, 10, baseFogFar * weatherState.visionMod);
  }, [weatherState.visionMod]);

  // 2. Particle system (rain/snow/sand)
  // Particle emitter follows camera, not world-fixed
  // 200 particles in a 100x100 volume around camera
  // Rain: downward velocity, blue-tinted
  // Snow: slow fall + drift, white
  // Sand: horizontal velocity (wind direction), tan

  // 3. Lightning (extreme forest/island)
  // Random point light flash (0.1s on, 2-5s interval)

  return (
    <>
      {weatherState.state >= 1 && <ParticleSystem type={biomeWeatherMap[biome]} />}
      {weatherState.state === 2 && hasLightning(biome) && <LightningFlash />}
    </>
  );
}
```

### 13.3 Camera Effects Architecture

```typescript
// components/3d/CameraEffects.tsx
// Quality tiers: 'off' | 'low' | 'high'

// HIGH quality (PC): react-three postprocessing
// Uses EffectComposer from @react-three/postprocessing
function CameraEffectsHigh() {
  return (
    <EffectComposer>
      {lowHP && <ChromaticAberration offset={hpRatio * 0.005} />}
      {isDashing && <MotionBlur velocity={dashDirection} />}
      {isBoosting && <Vignette darkness={0.3} />}
    </EffectComposer>
  );
}

// LOW quality (Mobile): CSS overlay
function CameraEffectsLow() {
  return (
    <div className="camera-effects-overlay">
      {isBoosting && <div className="vignette" />}
      {isBoosting && <SpeedLines />}
    </div>
  );
}

// Camera shake (all quality levels): position offset
function useCameraShake() {
  const shakeRef = useRef({ intensity: 0, decay: 10 });

  // On damage event:
  function triggerShake(damage: number) {
    shakeRef.current.intensity = Math.min(damage / 50, 1.0);
  }

  // In useFrame:
  function applyShake(camera, dt) {
    if (shakeRef.current.intensity > 0.01) {
      camera.position.x += (Math.random() - 0.5) * shakeRef.current.intensity * 2;
      camera.position.y += (Math.random() - 0.5) * shakeRef.current.intensity * 1;
      shakeRef.current.intensity *= Math.pow(0.001, dt); // exponential decay
    }
  }
}

// Zoom punch (all quality levels): FOV change
function useZoomPunch() {
  // On kill event:
  function triggerZoomPunch() {
    // FOV: base → base * 0.95 → base over 0.3s (ease-out-back)
  }
}
```

### 13.4 Terrain Particles

```typescript
// Integration with existing MCParticles system (500 pool)

// New particle types for terrain interaction
enum TerrainParticleType {
  GrassLeaf = 10,   // green, upward + drift
  SandPuff = 11,    // tan, radial spread
  StoneDust = 12,   // gray, upward
  SnowFlake = 13,   // white, upward + drift
  WaterSplash = 14, // blue, radial + upward
}

// Emission: every 10 frames while agent is moving
// Position: agent foot position
// Count: 2-3 particles per emission
// Lifetime: 20-40 frames
// Color: biome-specific (see plan Section 6.4.4)
```

### 13.5 Minimap Terrain Overlay

```typescript
// Offscreen canvas rendering of heightmap for minimap background

function generateMinimapTerrain(
  heightmap: Float32Array,
  obstacleGrid: Uint8Array,
  width: number, height: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      // Map minimap pixel to heightmap cell
      const hx = Math.floor(x / 256 * width);
      const hy = Math.floor(y / 256 * height);

      const h = heightmap[hy * width + hx];
      const obs = obstacleGrid[hy * width + hx];

      if (h < 0) {
        // Water: blue tint
        ctx.fillStyle = `rgb(40, 80, ${150 + h * 10})`;
      } else if (obs > 0 && obs <= 3) {
        // Obstacle: dark
        ctx.fillStyle = 'rgb(40, 40, 40)';
      } else {
        // Terrain: height-based grayscale with biome tint
        const brightness = 60 + (h / 60) * 140;
        ctx.fillStyle = `rgb(${brightness * 0.8}, ${brightness}, ${brightness * 0.7})`;
      }
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return canvas;
}
```

---

## 14. Bot AI Pathfinding

### 14.1 NavGrid Construction

```go
// Built once per arena from ObstacleGrid + Heightmap

func BuildNavGrid(og *ObstacleGrid, hm *Heightmap) *NavGrid {
    ng := &NavGrid{
        width:    og.Width,
        height:   og.Height,
        cellSize: og.CellSize,
        walkable: make([][]bool, og.Height),
    }

    for y := 0; y < og.Height; y++ {
        ng.walkable[y] = make([]bool, og.Width)
        for x := 0; x < og.Width; x++ {
            obsType := og.Cells[y][x]
            isBlocked := obsType == ObstTree || obsType == ObstRock || obsType == ObstBuilding

            // Check slope: gradient > 0.6 = unwalkable
            gradX, gradY := hm.GetGradientAtCell(x, y)
            tooSteep := math.Sqrt(gradX*gradX+gradY*gradY) > 0.6

            ng.walkable[y][x] = !isBlocked && !tooSteep
        }
    }
    return ng
}
```

### 14.2 A* Implementation

```go
// Standard A* with Manhattan distance heuristic
// Budget: max 500 open-set expansions (prevents CPU spikes)

func (ng *NavGrid) FindPath(sx, sy, gx, gy float64) []Position {
    startCell := ng.worldToCell(sx, sy)
    goalCell := ng.worldToCell(gx, gy)

    if !ng.walkable[goalCell.Y][goalCell.X] {
        // Find nearest walkable cell to goal
        goalCell = ng.nearestWalkable(goalCell)
    }

    openSet := NewMinHeap()
    openSet.Push(startCell, 0)
    cameFrom := make(map[Cell]Cell)
    gScore := make(map[Cell]float64)
    gScore[startCell] = 0

    expansions := 0
    for openSet.Len() > 0 && expansions < 500 {
        current := openSet.Pop()
        expansions++

        if current == goalCell {
            return ng.reconstructPath(cameFrom, current)
        }

        for _, neighbor := range ng.neighbors(current) {
            tentative := gScore[current] + ng.edgeCost(current, neighbor)
            if prev, ok := gScore[neighbor]; !ok || tentative < prev {
                cameFrom[neighbor] = current
                gScore[neighbor] = tentative
                f := tentative + ng.heuristic(neighbor, goalCell)
                openSet.Push(neighbor, f)
            }
        }
    }
    return nil // no path found within budget
}

// Edge cost: 1.0 for cardinal, 1.414 for diagonal
// Water cells: cost * 2.0 (prefer land routes)
// Slope: cost * (1.0 + gradient) (prefer flat terrain)
func (ng *NavGrid) edgeCost(from, to Cell) float64 {
    base := 1.0
    if from.X != to.X && from.Y != to.Y {
        base = 1.414
    }
    if ng.obstacleGrid.GetTypeAtCell(to.X, to.Y) == ObstWater {
        base *= 2.0
    }
    grad := ng.heightmap.GetGradientAtCell(to.X, to.Y)
    base *= (1.0 + math.Sqrt(grad[0]*grad[0]+grad[1]*grad[1]))
    return base
}
```

### 14.3 Bot AI Integration

```go
// Modified bot.go behavior

func (bot *BotBehavior) Update(agent *Agent, arena *Arena, tick uint64) {
    // 1. Strategic decision (existing: target selection, flee, collect)
    target := bot.selectTarget(agent, arena)

    // 2. Path finding (new: replaces direct angle-to-target)
    if tick - bot.lastPathTick > 60 || bot.pathInvalid(agent) { // 3 seconds
        bot.currentPath = arena.navGrid.FindPath(
            agent.Position.X, agent.Position.Y,
            target.X, target.Y,
        )
        bot.lastPathTick = tick
        bot.pathIndex = 0
    }

    // 3. Path following
    if bot.currentPath != nil && bot.pathIndex < len(bot.currentPath) {
        waypoint := bot.currentPath[bot.pathIndex]
        dist := distance(agent.Position, waypoint)
        if dist < 30 { // reached waypoint
            bot.pathIndex++
        }
        // Set moveAngle toward current waypoint
        agent.MoveHeading = math.Atan2(
            waypoint.Y - agent.Position.Y,
            waypoint.X - agent.Position.X,
        )
    }

    // 4. Local steering (per-tick obstacle avoidance)
    // Raycast 3 directions (forward, forward-left, forward-right)
    // If forward blocked, steer toward open direction
    bot.localAvoidance(agent, arena.obstacleGrid)

    // 5. Aim toward threat/target (independent of movement)
    if target.IsAgent {
        agent.AimHeading = math.Atan2(
            target.Y - agent.Position.Y,
            target.X - agent.Position.X,
        )
    }

    // 6. Terrain awareness
    // Prefer high ground when enemies nearby (height advantage +10% DPS)
    // Avoid deep water unless chasing low-HP target
    // Immediate re-path if about to enter impassable terrain
    if bot.aboutToHitObstacle(agent, arena.obstacleGrid) {
        bot.currentPath = nil // force re-path next tick
    }
}
```

### 14.4 Path Cache

```go
type PathCache struct {
    mu      sync.RWMutex
    entries map[string]*CachedPath
}

type CachedPath struct {
    Path      []Position
    ExpiresAt uint64  // tick when cache expires (3 seconds = 60 ticks)
    GoalPos   Position
}

// Cache key: grid-aligned start + goal (quantized to 2x2 cells)
// This gives spatial locality: nearby starts/goals share cached paths
// Max cache size: 200 entries per arena (LRU eviction)
```

---

## 15. Performance Architecture

### 15.1 Server Tick Budget (50ms)

```
Current v15 tick budget:
  ApplyInput:     ~0.01ms
  UpdateAgent:    ~0.05ms × 60 = 3.0ms
  CollectOrbs:    ~0.02ms × 60 = 1.2ms
  Collision:      ~0.1ms  (spatial hash)
  Combat:         ~0.5ms
  Serialize:      ~1.0ms
  Broadcast:      ~0.5ms
  Total:          ~6.3ms (87% headroom)

v16 additions:
  HeightQuery:    ~0.001ms × 60 = 0.06ms  (array lookup + bilinear interp)
  ObstacleCheck:  ~0.002ms × 60 = 0.12ms  (grid lookup + sliding)
  WeatherTick:    ~0.001ms                  (counter increment)
  A* Pathfind:    ~0.5ms × 15 bots / 60 ticks = 0.125ms/tick amortized
  NavGrid lookup: ~0.001ms × 15 = 0.015ms
  Serialize +f,z: ~0.2ms additional
  Total v16:      ~7.0ms (86% headroom)

Conclusion: v16 server additions fit comfortably within tick budget.
```

### 15.2 Client Frame Budget (16.6ms for 60fps)

```
Current v15 budget:
  useFrame hooks:        ~1.0ms
  AgentInstances:        ~2.0ms (InstancedMesh × 60)
  VoxelTerrain:          ~1.5ms
  OrbInstances:          ~0.5ms
  Interpolation:         ~0.3ms
  Three.js render:       ~4.0ms
  React reconcile:       ~1.0ms
  Total:                 ~10.3ms (38% headroom)

v16 changes:
  HeightmapTerrain:      ~1.0ms (PlaneGeometry, simpler than VoxelTerrain)
  ObstacleInstances:     ~1.5ms (3 InstancedMesh: trees, rocks, buildings)
  WaterSurface:          ~0.5ms (single plane + shader)
  TPSCamera:             ~0.1ms (replace PlayCamera, similar cost)
  Animation overhaul:    ~1.0ms (+secondary motion, terrain reaction)
  WeatherFX particles:   ~0.5ms (200 particles, billboard)
  SoundEngine:           ~0.2ms (Howler.js, non-blocking)
  CameraEffects (High):  ~2.0ms (post-processing)
  CameraEffects (Low):   ~0.1ms (CSS overlay)
  Total v16 (High):      ~13.5ms (19% headroom) ← tight but viable
  Total v16 (Low):       ~11.6ms (30% headroom) ← comfortable
```

### 15.3 Memory Budget (< 512MB)

```
Current v15:
  Three.js scene:         ~60MB
  Texture atlas:          ~30MB
  JavaScript heap:        ~40MB
  Subtotal:               ~130MB

v16 additions:
  Heightmap Float32Array: 240×240×4 = 230KB (worst case)
  ObstacleGrid Uint8:     240×240 = 57KB
  PlaneGeometry:          240×240×(3+3+3)×4 = 2.1MB (positions, normals, colors)
  Obstacle InstancedMesh: ~200 instances × 3 types × 1KB = 600KB
  WaterSurface plane:     ~100KB
  AudioSprite buffer:     ~2MB (all SFX + ambient)
  BGM buffer:             ~5MB (3 tracks streaming)
  NavGrid (server only):  N/A client
  Weather particles:      ~50KB (200 particle pool)
  Post-processing RT:     ~8MB (render target at half res)
  Minimap canvas:         256×256×4 = 256KB

  v16 subtotal:           ~18MB
  Total v16:              ~148MB (well within 512MB)
```

### 15.4 Network Bandwidth

```
Current v15 per-agent state payload:
  {i, n, x, y, h, m, b, a, k, lv, hr, ...} ≈ 120 bytes

v16 additions per agent:
  f (facing):   4 bytes (or 2 bytes quantized)
  z (height):   2 bytes (int16, ×0.1 precision)
  bi (biome):   1 byte
  iw (inWater): 1 byte (conditional)
  Subtotal:     +8 bytes/agent

Bandwidth calculation:
  Current: 120 bytes × 60 agents × 20 Hz = 144 KB/s
  v16:     128 bytes × 60 agents × 20 Hz = 153.6 KB/s
  Delta:   +9.6 KB/s (+6.7%) ← well within 20% budget

Terrain transfer (one-time):
  joined event: +8KB (C-tier) to +60KB (S-tier) = acceptable
  (WebSocket frame limit typically 1MB, our max is 60KB)
```

### 15.5 LOD Strategy

```
Distance tiers (camera-to-object 3D world distance):

Tier 1 (< 15 units): Full detail
  - All terrain decorations (grass, flowers)
  - Full obstacle geometry
  - Full animation (secondary motion + terrain reaction)
  - All particles
  - Spatial audio active

Tier 2 (15-50 units): Medium
  - Major obstacles only (trees, rocks, buildings)
  - Basic animation (locomotion + facing, no secondary motion)
  - Reduced particles
  - Spatial audio at reduced volume

Tier 3 (50+ units): Minimal
  - Terrain mesh only (obstacles via frustum culling)
  - Billboard sprites for distant agents (if count > 40)
  - No particles for distant agents
  - No spatial audio

Mobile override:
  - Start at Tier 2 baseline
  - Tier 3 at 30 units instead of 50
  - Max 30 visible agents (cull by distance)
  - No post-processing effects
  - Weather particles halved (100 instead of 200)
```

---

## 16. Architecture Decision Records

### ADR-v16-001: Direct Heightmap Transfer vs Seed-Based Generation

**Status**: Accepted

**Context**: Server and client both need identical heightmap data. Two approaches: (A) share a seed and Perlin noise algorithm, regenerate on client; (B) server generates, gzip-compresses, and sends the raw float32 array.

**Decision**: Option B -- direct gzip transfer.

**Rationale**:
- Go and JavaScript floating-point operations are not bit-identical across platforms (IEEE 754 rounding can differ)
- Perlin noise implementations in Go vs JS may produce different outputs even with identical seeds
- Direct transfer guarantees 100% synchronization with zero drift
- Compressed size (8-50KB) is acceptable for one-time transfer in `joined` event
- Eliminates an entire class of bugs (height mismatch → agents floating or sinking)

**Consequences**: Slightly larger `joined` payload; terrain generation cannot happen before WebSocket connection. Seed-based generation remains a v17 optimization candidate if cross-platform test vectors can be validated (100+ sample points).

---

### ADR-v16-002: Backward-Compatible Input Protocol

**Status**: Accepted

**Context**: Existing AI agents and legacy clients use the `{a, b, s}` input format. v16 introduces `{ma, aa, b, d, j, s}`.

**Decision**: Server auto-detects format by checking for `ma`/`aa` fields. If absent, falls back to v15 single-heading mode.

**Rationale**:
- AI agents using the WebSocket API should not break when server upgrades to v16
- Phased client rollout: v16 client can be deployed independently of AI agent updates
- Zero-downtime migration

**Consequences**: Server InputHandler has a format detection branch (minimal complexity). Legacy clients cannot use move/aim separation until they upgrade. This is acceptable because aim separation is a UX enhancement, not a requirement.

---

### ADR-v16-003: TPS Orbital Camera vs Fixed Camera with Mouse-Aim

**Status**: Accepted

**Context**: v15 uses a fixed 3/4-view camera. Two options for v16: (A) keep fixed camera, add mouse-aim reticle; (B) TPS orbital camera with right-click drag rotation.

**Decision**: Option B -- TPS orbital camera.

**Rationale**:
- Camera rotation is essential for terrain with height variance (players need to see behind hills)
- Orbital camera provides a more modern game feel (comparable to PUBG/Fortnite top-down modes)
- Fixed camera with aim reticle works poorly when terrain occludes view
- Default pitch (55 degrees) preserves the familiar 3/4-view angle for players who don't rotate

**Consequences**: Increased complexity in InputManager (camera yaw affects WASD direction). Mobile clients need dual joystick (camera rotation via right joystick). Terrain clipping prevention required (camera-player raycast).

---

### ADR-v16-004: ObstacleGrid Cell Size = 50px

**Status**: Accepted

**Context**: Need to determine collision grid resolution. Options: 25px (high-res, more memory), 50px (medium), 100px (coarse).

**Decision**: 50px cell size.

**Rationale**:
- Agent hitbox radius is 16-22px; 50px cells are 2-3x agent size, providing sufficient granularity
- C-tier (100x100 = 10K cells) to S-tier (240x240 = 57.6K cells) fits memory budget
- O(1) lookup per agent per tick (no spatial hash needed for obstacles)
- Matches heightmap cell size for aligned data structures

**Consequences**: Obstacles are quantized to 50px grid. Small obstacles (< 25px) cannot be represented individually; they are merged into the containing cell. This is acceptable for the Minecraft-style aesthetic.

---

### ADR-v16-005: Howler.js Hybrid Audio (Not Pure Web Audio)

**Status**: Accepted

**Context**: Need audio system for SFX + BGM + spatial audio. Options: (A) pure Web Audio API; (B) Howler.js; (C) drei PositionalAudio only; (D) hybrid Howler.js + drei.

**Decision**: Option D -- hybrid.

**Rationale**:
- Howler.js handles browser compatibility (AudioContext resume, codec fallback, mobile unlock)
- AudioSprite format reduces HTTP requests (single file for all SFX)
- drei PositionalAudio integrates naturally with R3F scene graph for spatial effects
- BGM/UI sounds don't need 3D positioning (Howler.js global is simpler)
- Combat/footstep sounds benefit from R3F-integrated spatial audio (automatic distance attenuation)

**Consequences**: Two audio systems in client (Howler for global, drei for spatial). Both share the same AudioContext. Sound engine must coordinate to respect the 16-concurrent-sound limit across both systems.

---

### ADR-v16-006: Camera Effects Quality Tiers (Off / Low / High)

**Status**: Accepted

**Context**: Post-processing effects (chromatic aberration, motion blur, vignette) are GPU-intensive. Mobile devices cannot sustain 30fps with full post-processing.

**Decision**: Three quality tiers with graceful degradation.

**Rationale**:
- High (PC): `@react-three/postprocessing` EffectComposer with full shader effects
- Low (Mobile): CSS overlay for vignette/speed-lines, position offset for shake, FOV change for zoom punch
- Off: No visual effects at all (accessibility preference)
- Auto-detection: start at High, downgrade to Low if fps drops below 45 for 3 consecutive seconds

**Consequences**: Two rendering paths for effects. CSS overlay is approximate (not pixel-perfect match with shader version). This is acceptable because the purpose is "feel" not precision.

---

## 17. Migration Strategy

### 17.1 Phase Dependencies (DAG)

```
Phase 0 ──► Phase 1 ──► Phase 2 ──► Phase 3
  (config     (protocol    (input      (animation
   sync)       change)      +camera)    overhaul)
                 │
                 ▼
              Phase 4 ──► Phase 5 ──► Phase 6
              (heightmap   (biome      (terrain
               terrain)    +obstacle)   anim)
                              │
                              ▼
                           Phase 7 ──► Phase 8
                           (sound      (weather
                            +effects)   +minimap
                                        +killcam)
```

### 17.2 Per-Phase File Impact Matrix

| Phase | Server Files Modified | Server Files New | Client Files Modified | Client Files New | Shared Files |
|-------|----------------------|------------------|----------------------|------------------|--------------|
| 0 | `constants.go`, `serializer.go` | -- | `constants/game.ts`, `useSocket.ts` | -- | `types/events.ts` |
| 1 | `agent.go`, `arena.go`, `serializer.go`, `domain/types.go` | -- | `interpolation.ts` | -- | `types/events.ts` |
| 2 | -- | -- | `PlayCamera.tsx` (→ replaced) | `TPSCamera.tsx`, `useInputManager.ts` | -- |
| 3 | -- | -- | `animation-state-machine.ts` | -- | -- |
| 4 | `arena.go`, `agent.go`, `domain/types.go` | `heightmap.go` | `VoxelTerrain.tsx` (→ replaced) | `HeightmapTerrain.tsx` | `types/events.ts` |
| 5 | `arena.go`, `bot.go`, `collision.go`, `map_objects.go` | `obstacle_grid.go`, `nav_grid.go` | -- | `ObstacleInstances.tsx`, `WaterSurface.tsx` | -- |
| 6 | `agent.go` (jump physics) | -- | `animation-state-machine.ts`, `MCParticles.tsx` | -- | -- |
| 7 | -- | -- | -- | `sound-engine.ts`, `CameraEffects.tsx` | -- |
| 8 | `arena.go` | `weather.go` | `GameCanvas3D` | `WeatherFX.tsx`, minimap update | `types/events.ts` |

### 17.3 Backward Compatibility Checklist

| Concern | Strategy |
|---------|----------|
| v15 AI agents (`{a, b, s}` input) | Server auto-detects, falls back to single-heading |
| Existing bots (no A* yet) | Bot AI falls back to linear tracking if navGrid=nil |
| VoxelTerrain removal | HeightmapTerrain is a drop-in replacement in Scene.tsx JSX tree |
| PlayCamera removal | TPSCamera uses same target tracking, default pitch matches 3/4 view |
| ARENA_CONFIG hardcoded values | Phase 0 makes them dynamic; hardcoded values become fallback defaults |
| MapStructures (shrines/springs/altars) | Registered in ObstacleGrid as types 6/7/8; existing map_objects.go logic preserved |
| Mobile touch input | Dual joystick replaces single-touch; gesture fallback for non-joystick areas |

### 17.4 Feature Flags

```go
// server/internal/game/constants.go — v16 feature flags
const (
    V16TerrainEnabled   = true   // Phase 4: heightmap terrain
    V16ObstaclesEnabled = true   // Phase 5: obstacle collision
    V16WeatherEnabled   = true   // Phase 8: weather system
    V16JumpEnabled      = true   // Phase 6: vertical movement
)
```

```typescript
// packages/shared/src/constants/game.ts — client feature flags
export const V16_FEATURES = {
  tpsCamera: true,         // Phase 2
  dualInput: true,         // Phase 2
  heightmapTerrain: true,  // Phase 4
  soundEngine: true,       // Phase 7
  cameraEffects: true,     // Phase 7
  weatherFX: true,         // Phase 8
} as const;
```

---

## 18. Kill-Cam & Jump Physics

### 18.1 Kill-Cam State Machine (Client-Only)

```typescript
// components/3d/KillCam.tsx — state machine triggered on death event

enum KillCamState {
  INACTIVE,       // normal gameplay
  TIME_FREEZE,    // 0.0 - 0.3s: pause interpolation, freeze all agent positions
  ZOOM_TO_KILLER, // 0.3 - 0.8s: camera lerps to killer position, FOV narrows
  ORBIT_KILLER,   // 0.8 - 2.3s: camera orbits killer at 0.5 rad/s
  SHOW_OVERLAY,   // 2.3s+: display DeathOverlay, resume spectator or respawn
}

interface KillCamController {
  state: KillCamState;
  timer: number;               // elapsed time in current state
  killerPosition: Vector3;     // cached killer position at death
  killerAgent: AgentNetworkData | null;
  orbitAngle: number;          // current orbit angle around killer

  // Transition timing
  readonly FREEZE_DURATION: 0.3;     // seconds
  readonly ZOOM_DURATION: 0.5;       // seconds
  readonly ORBIT_DURATION: 1.5;      // seconds
  readonly ORBIT_DISTANCE: 15;       // world units
  readonly ORBIT_SPEED: 0.5;         // rad/s
}

// During TIME_FREEZE:
//   - Server state continues arriving at 20Hz (buffered, not applied)
//   - Client interpolation paused (agents visually frozen)
//   - Camera stays at player death position

// During ZOOM_TO_KILLER:
//   - Camera position lerps from player to killer offset
//   - FOV narrows: 75 → 60 (zoom-in feel)
//   - Resume applying server state (agents unfreeze)

// During ORBIT_KILLER:
//   - Camera orbits killer: spherical(orbitAngle, 45deg, ORBIT_DISTANCE)
//   - orbitAngle += ORBIT_SPEED * dt
//   - Killer highlighted (outline or brightness boost)

// On SHOW_OVERLAY:
//   - Camera ownership returns to spectator mode or respawn
//   - DeathOverlay component mounts with score/killer info
```

### 18.2 Jump Physics Constants

```go
// server/internal/game/constants.go — v16 jump constants

const (
    // JumpVelocity is the initial upward velocity on jump (game units/tick).
    JumpVelocity = 3.2  // reaches ~8 units peak height

    // Gravity is the downward acceleration per tick (game units/tick^2).
    Gravity = 0.32

    // JumpAirSpeedMult is the speed multiplier while airborne.
    JumpAirSpeedMult = 0.8  // 80% of ground speed

    // JumpAuraImmunityHeight is the minimum height difference
    // between two agents for aura DPS to be nullified.
    JumpAuraImmunityHeight = 5.0

    // JumpCooldownTicks is the minimum ticks between jumps.
    JumpCooldownTicks = 20  // 1 second @ 20Hz

    // ClimbMaxHeight is the max height diff per tick before blocking movement.
    ClimbMaxHeight = 10.0  // prevents walking up cliffs
)
```

```go
// Jump physics in UpdateAgentV16():
if agent.ZVelocity != 0 || !agent.OnGround {
    agent.ZPos += agent.ZVelocity
    agent.ZVelocity -= Gravity

    terrainHeight := heightmap.GetHeight(agent.Position.X, agent.Position.Y)
    if agent.ZPos <= terrainHeight {
        agent.ZPos = terrainHeight
        agent.ZVelocity = 0
        agent.OnGround = true
        // Trigger landing event (client: squash animation + terrain particle)
    } else {
        agent.OnGround = false
    }
}

// Aura DPS immunity check in combat.go:
if math.Abs(attacker.ZPos - defender.ZPos) > JumpAuraImmunityHeight {
    // Skip aura damage (height difference too large)
    continue
}
```

### 18.3 Ice/Slippery Terrain Animation

```typescript
// In animation-state-machine.ts — terrain-reactive layer

// Arctic/ice biome: agent's feet subtly slide on walk cycle
function applyIceSlip(agent, biome, dt) {
  if (biome !== BiomeType.Arctic) return;

  // Reduce foot plant stability: foot position overshoots by 10%
  // then slides back — creates visual "skating" effect
  const slipFactor = 0.1;
  // Modify foot IK target: add forward offset proportional to speed
  footSlipOffset = agent.velocity * slipFactor * Math.sin(walkPhase);

  // Apply to leg transform: foot extends slightly past plant point
  // Recovery spring pulls it back (slower than normal terrain)
  footRecoverySpeed = 5; // vs normal 15
}

// Desert sand: foot sinks slightly (Y offset -0.3 at plant)
function applySandSink(agent, biome) {
  if (biome !== BiomeType.Desert) return;
  // At foot plant phase: lower foot Y by 0.3 units
  // Smoothly return to normal during swing phase
  footSinkOffset = -0.3 * Math.max(0, Math.cos(walkPhase));
}
```

---

## 19. Verification Matrix

### 19.1 Functional Requirements Coverage

| FR | Requirement | Architecture Section | Component(s) | Phase |
|----|------------|---------------------|--------------|-------|
| FR-1 | WASD camera-relative movement | S10.1, S10.2 | InputManager, TPSCamera | 2 |
| FR-2 | Mouse camera orbit (yaw/pitch) | S10.3 | TPSCamera | 2 |
| FR-3 | Key bindings (Shift, E, Space, LClick) | S10.1 | InputManager | 2, 6 |
| FR-4 | Move/aim direction separation | S5.1.6, S7.1, S8.1 | Agent, InputHandler, Serializer | 1 |
| FR-5 | Walk/run animation speed sync | S11.3 | AnimationStateMachine | 3 |
| FR-6 | Secondary motion (inertia, head track, sway) | S11.5 | AnimationStateMachine | 3 |
| FR-7 | Terrain-reactive animation (slope, swim, ice slip) | S11.8, S18.3 | AnimationStateMachine | 6 |
| FR-8 | Heightmap terrain generation | S9.1, S9.2 | HeightmapGenerator, HeightmapTerrain | 4 |
| FR-9 | Biome zones (2-3 per arena) | S9.1 (Voronoi) | BiomeLayout, HeightmapTerrain | 5 |
| FR-10 | Collidable terrain objects | S5.1.3, S9.3 | ObstacleGrid, ObstacleInstances | 5 |
| FR-11 | Water bodies (speed reduction, swim) | S9.4 | WaterSurface, Agent.InWater | 5 |
| FR-12 | Height combat bonus (+10% DPS) | S14.3, S18.2 | Combat height diff check | 6 |
| FR-13 | Sound system | S12 | SoundEngine | 7 |
| FR-14 | Weather effects | S13.1, S13.2 | WeatherManager, WeatherFX | 8 |
| FR-15 | Camera shake + hit effects | S13.3 | CameraEffects | 7 |
| FR-16 | Minimap terrain display | S13.5 | MinimapTerrain canvas | 8 |
| FR-17 | Jump/vertical movement | S18.2 (jump physics), S5.1.6 | Agent.ZPos, AnimationStateMachine | 6 |
| FR-18 | Destructible environment | S7.5 (terrain_update) | ObstacleGrid, TerrainUpdate event | 8 |

### 19.2 Non-Functional Requirements Coverage

| NFR | Requirement | Architecture Section | Validation Method |
|-----|------------|---------------------|-------------------|
| NFR-1 | 60fps @ 60 agents + terrain | S15.2 (frame budget) | Performance profiling, LOD tiers |
| NFR-2 | Terrain mesh < 3s | S9.5 (vertex displacement) | Timing measurement on init |
| NFR-3 | Server 20Hz tick | S15.1 (tick budget) | Server metrics: tick_duration_ms histogram |
| NFR-4 | Network bandwidth < +20% | S15.4 (+6.7%) | WS frame size monitoring |
| NFR-5 | First load < 5s | S12.3 (lazy audio), S9 (gzip) | Lighthouse / WebPageTest |
| NFR-6 | Memory < 512MB | S15.3 (~148MB) | Chrome DevTools heap snapshot |

### 19.3 Self-Verification Checklist

| Check | Result | Notes |
|-------|--------|-------|
| All 18 FRs have corresponding architecture sections | PASS | See matrix above |
| All 6 NFRs have performance analysis | PASS | Section 15 covers all |
| Input protocol backward compatible | PASS | ADR-v16-002, server auto-detection |
| Heightmap sync guaranteed (no float drift) | PASS | ADR-v16-001, direct gzip transfer |
| MapStructures (Shrine/Spring/Altar) preserved | PASS | ObstacleGrid types 6/7/8 + map_objects.go |
| Server tick budget within 50ms | PASS | ~7.0ms estimated (86% headroom) |
| Client frame budget viable | PASS | High: 13.5ms, Low: 11.6ms |
| Memory within 512MB | PASS | ~148MB estimated |
| Mobile support addressed | PASS | Dual joystick (S10.4), Low quality tier (S15.5), 30fps target |
| Bot AI handles new terrain | PASS | NavGrid + A* (S14), terrain awareness |
| Kill-cam architecture specified | PASS | S18.1: state machine (freeze→zoom→orbit→overlay) |
| Jump physics constants formalized | PASS | S18.2: velocity=3.2, gravity=0.32, aura immunity height=5 |
| Ice/sand terrain animation detail | PASS | S18.3: slip factor, foot sink offset |
| Phase dependency DAG is acyclic | PASS | Linear spine (0→1→2→3) + branch (1→4→5→6) + (5→7→8) |
| Existing v14 dash system connected | PASS | E key → `d` field → PerformDash() (Phase 0) |
| Constants unification addressed | PASS | Phase 0 + serverConfig in joined event |

### 19.4 Known Limitations & Future Work

| Limitation | Accepted Because | Future Consideration |
|-----------|-----------------|---------------------|
| No vertical combat (projectile arcs) | Scope; 2.5D height bonus sufficient | v17 if demand exists |
| Seed-based terrain deferred | Float precision risk | v17 with cross-platform test suite |
| No replay system | Unrelated to game experience | v17 dedicated feature |
| ObstacleGrid quantized to 50px | Sufficient for MC-style aesthetic | Smaller cells if fine obstacles needed |
| Weather is per-arena, not per-biome-zone | Simplifies server logic | Per-zone weather in v17 |
| AudioSprite requires manual asset pipeline | CC0 sources available | Automated pipeline in v17 |
