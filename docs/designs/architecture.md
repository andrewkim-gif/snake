# Snake Arena — System Architecture Document v2.0

> **Game Style**: snake.io / slither.io clone (Continuous movement, large arena)
> **Version**: v2.0 (Revised from grid-based to continuous movement)
> **Date**: 2026-02-27

---

## 1. Architecture Overview

Snake Arena is a **snake.io/slither.io-style** real-time multiplayer game where 50-100 players compete simultaneously in a large circular arena. Players control snakes using mouse/touch input, eating orbs to grow, and eliminating others by forcing their heads into snake bodies.

### Key Architecture Decisions (v1→v2 Changes)

| Aspect | v1 (Grid-Based) | v2 (snake.io Style) |
|--------|-----------------|---------------------|
| Movement | 4-direction grid (40x40) | Continuous angle-based (float x,y) |
| Map | Square grid, wall collision | Circular arena (r=6000), boundary death |
| Players | 8-12/room, round-based | 50-100/arena, persistent free-join |
| Server | GameRoom (lifecycle) | Arena (always-running) |
| Collision | Grid cell check | Circle-circle + spatial hash |
| Input | Direction enum | Target angle (radian) + boost flag |
| Rendering | 16px pixel art grid | Smooth circle segments + glow |
| State Sync | Full room broadcast | Viewport-culled per-player |

### Quality Attributes

| Attribute | Target | Strategy |
|-----------|--------|----------|
| Latency | <50ms input→render | Client prediction + interpolation |
| Throughput | 100 players/arena | Spatial hashing, viewport culling |
| Bandwidth | <100KB/s/player | Delta compression, binary protocol |
| FPS | 60 desktop, 30 mobile | LOD rendering, adaptive quality |
| Availability | 99.9% | Auto-reconnect, stateless client |

---

## 2. C4 Level 2 — Container Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER / MOBILE                         │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Next.js 15 Web App (Vercel)                 │   │
│  │                                                          │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │   │
│  │  │  App     │  │  Game    │  │  Canvas  │  │ Socket │  │   │
│  │  │  Router  │  │  State   │  │  Render  │  │ Client │  │   │
│  │  │  (React) │  │  Store   │  │  Engine  │  │ (IO)   │  │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └────┬───┘  │   │
│  └──────────────────────────────────────────────────┼──────┘   │
└─────────────────────────────────────────────────────┼──────────┘
                                                      │ WebSocket
                                                      │ (ws://)
┌─────────────────────────────────────────────────────┼──────────┐
│                    ARENA SERVER (Railway)            │          │
│                                                     ▼          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │  Express │  │  Socket  │  │  Arena   │  │  Spatial     │  │
│  │  HTTP    │──│  IO      │──│  Engine  │──│  Hash Grid   │  │
│  │  Server  │  │  Server  │  │  (20Hz)  │  │  (Collision) │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘  │
│                                    │                           │
│  ┌──────────┐  ┌──────────┐  ┌────┴─────┐  ┌──────────────┐  │
│  │ Viewport │  │  Orb     │  │  Snake   │  │  Movement    │  │
│  │ Culler   │  │  Manager │  │  Manager │  │  Physics     │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘  │
└───────────────────────────────────┬────────────────────────────┘
                                    │ HTTPS (Auth/Stats)
                                    ▼
                          ┌──────────────────┐
                          │    Supabase      │
                          │  ┌────────────┐  │
                          │  │ PostgreSQL │  │
                          │  │ (Stats/LB) │  │
                          │  └────────────┘  │
                          │  ┌────────────┐  │
                          │  │   Auth     │  │
                          │  │ (OAuth/    │  │
                          │  │  Anon)     │  │
                          │  └────────────┘  │
                          └──────────────────┘
```

### Container Responsibilities

| Container | Technology | Port | Responsibility |
|-----------|-----------|------|----------------|
| Web App | Next.js 15, React 19 | 443 | UI rendering, game canvas, client prediction |
| Arena Server | Node.js, Express, Socket.IO | 3001 | Game logic, physics, state authority |
| Supabase | PostgreSQL, GoTrue | 443 | Authentication, persistent stats, leaderboard |

### Communication Protocols

| From → To | Protocol | Format | Frequency |
|-----------|----------|--------|-----------|
| Client → Server | WebSocket | JSON (input) | ~30Hz (mouse move) |
| Server → Client | WebSocket | Binary (state) | 20Hz (game tick) |
| Client → Supabase | HTTPS | JSON (REST) | On auth/stats save |
| Server → Supabase | HTTPS | JSON (REST) | On player death (stats) |

## 3. C4 Level 3 — Component Diagrams

### 3.1 Arena Server Components

```
┌─────────────────────────────────────────────────────────────┐
│                    ARENA SERVER (Level 3)                     │
│                                                              │
│  ┌─────────────── Network Layer ──────────────────────────┐ │
│  │  SocketHandler.ts      │  ViewportCuller.ts            │ │
│  │  - onConnect/Disconnect│  - calculateViewport(snake)   │ │
│  │  - onInput(angle,boost)│  - filterEntities(viewport)   │ │
│  │  - onJoin/Respawn      │  - buildStatePacket(player)   │ │
│  │  - rateLimiting(30/s)  │  - deltaCompression           │ │
│  └────────────┬───────────┴──────────────┬────────────────┘ │
│               │                          │                   │
│  ┌────────────┴──── Arena Engine ────────┴────────────────┐ │
│  │  Arena.ts (Main Game Loop — 20Hz)                      │ │
│  │  - processInputs() → update headings                   │ │
│  │  - moveSnakes() → advance positions                    │ │
│  │  - handleBoost() → reduce mass, drop trail orbs        │ │
│  │  - checkCollisions() → head↔body, head↔boundary        │ │
│  │  - processDeaths() → convert to orbs                   │ │
│  │  - collectOrbs() → grow snakes                         │ │
│  │  - spawnOrbs() → maintain natural orb density          │ │
│  │  - broadcastState() → per-player viewport updates      │ │
│  └────────┬──────────┬──────────┬─────────────────────────┘ │
│           │          │          │                             │
│  ┌────────┴──┐ ┌─────┴────┐ ┌──┴──────────┐                │
│  │ Snake.ts  │ │OrbMgr.ts │ │Collision.ts │                │
│  │           │ │           │ │             │                │
│  │-segments[]│ │-natural[] │ │-spatialHash │                │
│  │-heading   │ │-death[]   │ │-checkHead   │                │
│  │-mass      │ │-trail[]   │ │  VsBody()   │                │
│  │-boosting  │ │-spawn()   │ │-checkHead   │                │
│  │-move(dt)  │ │-collect() │ │  VsBound()  │                │
│  │-grow(val) │ │-decompose │ │-broadPhase  │                │
│  │-shrink()  │ │  (snake)  │ │-narrowPhase │                │
│  └───────────┘ └───────────┘ └──────┬──────┘                │
│                                      │                       │
│  ┌──────────────── Physics Layer ────┴───────────────────┐  │
│  │  SpatialHash.ts         │  Movement.ts                │  │
│  │  - cellSize: 200        │  - applyTurnRate(current,   │  │
│  │  - insert(entity)       │    target, maxRate)          │  │
│  │  - query(bounds)        │  - advancePosition(pos,     │  │
│  │  - remove(entity)       │    heading, speed, dt)       │  │
│  │  - getNearby(pos, r)    │  - segmentFollow(segments,  │  │
│  │  - rebuild() per tick   │    spacing)                  │  │
│  └─────────────────────────┴─────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 Web Client Components

```
┌─────────────────────────────────────────────────────────────┐
│                    WEB CLIENT (Level 3)                       │
│                                                              │
│  ┌──────────────── UI Layer (React) ──────────────────────┐ │
│  │  GameCanvas.tsx  │ HUD.tsx      │ DeathScreen.tsx       │ │
│  │  - fullscreen    │ - score      │ - final score         │ │
│  │  - canvas ref    │ - length     │ - kills summary       │ │
│  │  - resize handler│ - kills      │ - play again btn      │ │
│  │                  │ - boost bar  │                        │ │
│  │  Leaderboard.tsx │ MiniMap.tsx  │ NicknameForm.tsx      │ │
│  │  - top 10 list   │ - arena map  │ - name input          │ │
│  │  - highlight self│ - self dot   │ - play button          │ │
│  └──────────┬───────┴──────────────┴───────────────────────┘ │
│             │                                                 │
│  ┌──────────┴──── Game Engine Layer ─────────────────────┐  │
│  │  useGameLoop.ts        │  useCamera.ts                 │  │
│  │  - rAF 60fps loop      │  - follow head (lerp)         │  │
│  │  - update(dt)          │  - dynamic zoom (mass-based)  │  │
│  │  - render(ctx)         │  - worldToScreen()            │  │
│  │                        │  - screenToWorld()            │  │
│  │  useInput.ts           │  useSocket.ts                 │  │
│  │  - mousemove→angle     │  - connect/disconnect         │  │
│  │  - touch→angle         │  - emit input(angle,boost)    │  │
│  │  - click/space→boost   │  - onState(snapshot)          │  │
│  │  - WASD→angle fallback │  - onDeath/onLeaderboard      │  │
│  └────────────┬───────────┴──────────────┬────────────────┘ │
│               │                          │                   │
│  ┌────────────┴──── Render Layer ────────┴────────────────┐ │
│  │  renderer.ts                                           │ │
│  │  - renderBackground(camera) → hex grid pattern scroll  │ │
│  │  - renderOrbs(orbs, camera) → glowing circles          │ │
│  │  - renderSnake(snake, camera) → circle segments + eyes │ │
│  │  - renderEffects() → boost trail, death explosion      │ │
│  │  - renderBoundary(camera) → arena edge warning         │ │
│  │                                                        │ │
│  │  interpolation.ts        │  spatial.ts                 │ │
│  │  - lerpPosition(a,b,t)   │  - clientSpatialIndex      │ │
│  │  - lerpAngle(a,b,t)      │  - queryVisible(viewport)  │ │
│  │  - snapshotBuffer(3)     │  - cullOffscreen()          │ │
│  │  - deadReckoning(snake)  │                             │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

## 4. Core Game Loop — Sequence Diagrams

### 4.1 Player Join Flow

```
Browser                    Socket.IO Server            Arena Engine
  │                              │                          │
  │  1. Connect WebSocket        │                          │
  │─────────────────────────────>│                          │
  │                              │  2. Validate connection  │
  │                              │  (rate limit check)      │
  │                              │                          │
  │  3. emit("join", {name,      │                          │
  │     skinId})                 │                          │
  │─────────────────────────────>│                          │
  │                              │  4. arena.addPlayer()    │
  │                              │─────────────────────────>│
  │                              │                          │
  │                              │  5. Find safe spawn pos  │
  │                              │  (min distance from      │
  │                              │   other snakes)          │
  │                              │                          │
  │                              │  6. Create Snake entity  │
  │                              │  (mass=10, 10 segments,  │
  │                              │   random heading)        │
  │                              │<─────────────────────────│
  │                              │                          │
  │  7. emit("joined", {         │                          │
  │     playerId, spawnPos,      │                          │
  │     arenaRadius,             │                          │
  │     initialState})           │                          │
  │<─────────────────────────────│                          │
  │                              │                          │
  │  8. Initialize canvas,       │                          │
  │     camera, renderer         │                          │
  │                              │                          │
  │  9. Start rAF loop +         │                          │
  │     input listeners          │                          │
```

### 4.2 Game Tick Loop (20Hz)

```
Arena Engine (every 50ms)
  │
  ├─ 1. processInputQueue()
  │     For each queued input {playerId, angle, boost}:
  │       snake.targetAngle = angle
  │       snake.boosting = boost
  │
  ├─ 2. updateHeadings(dt=0.05)
  │     For each alive snake:
  │       angleDiff = shortestAnglePath(heading, targetAngle)
  │       heading += clamp(angleDiff, -TURN_RATE, +TURN_RATE)
  │
  ├─ 3. moveSnakes(dt=0.05)
  │     For each alive snake:
  │       speed = boosting ? BOOST_SPEED : BASE_SPEED
  │       newHead.x = head.x + cos(heading) * speed * dt
  │       newHead.y = head.y + sin(heading) * speed * dt
  │       segments.unshift(newHead)
  │       trimSegmentsToLength(mass)
  │
  ├─ 4. handleBoost()
  │     For each boosting snake:
  │       mass -= BOOST_COST_PER_TICK
  │       if mass < MIN_MASS: stop boosting
  │       dropTrailOrb(tail position, TRAIL_ORB_VALUE)
  │
  ├─ 5. rebuildSpatialHash()
  │     Clear grid → insert all snake segments + orbs
  │
  ├─ 6. checkCollisions()
  │     For each alive snake:
  │       headPos = segments[0]
  │       // Boundary check
  │       if distance(headPos, center) > ARENA_RADIUS: kill(snake)
  │       // Head vs other snake bodies
  │       nearby = spatialHash.query(headPos, HEAD_RADIUS)
  │       for each nearbySegment (excluding own):
  │         if circleCollision(headPos, nearbySegment): kill(snake)
  │
  ├─ 7. processDeaths()
  │     For each dead snake:
  │       orbManager.decomposeSnake(snake)  // mass*0.8 → death orbs
  │       emit("death", {killer, score, length})
  │
  ├─ 8. collectOrbs()
  │     For each alive snake:
  │       nearbyOrbs = spatialHash.queryOrbs(head, COLLECT_RADIUS)
  │       for each orb in range:
  │         snake.mass += orb.value
  │         orbManager.remove(orb)
  │
  ├─ 9. spawnNaturalOrbs()
  │     if totalOrbs < TARGET_ORB_COUNT:
  │       spawn random orbs in arena
  │
  └─ 10. broadcastState()
        For each connected player:
          viewport = calculateViewport(player.snake)
          visibleSnakes = culler.filterSnakes(viewport)
          visibleOrbs = culler.filterOrbs(viewport)
          emit("state", buildPacket(visibleSnakes, visibleOrbs))
```

### 4.3 Death & Respawn Flow

```
Browser                    Arena Server
  │                              │
  │  Snake head hits body/       │
  │  boundary (server detects)   │
  │                              │
  │  1. emit("death", {          │
  │     score, length, kills,    │
  │     killerName, position})   │
  │<─────────────────────────────│
  │                              │
  │  2. Show DeathScreen         │  3. decomposeSnake():
  │     (score summary,          │     - Convert segments to
  │      play again btn)         │       death orbs (mass*0.8)
  │                              │     - Scatter around death pos
  │                              │     - Remove snake from arena
  │                              │
  │  4. User clicks              │
  │     "Play Again"             │
  │                              │
  │  5. emit("respawn", {name})  │
  │─────────────────────────────>│
  │                              │
  │                              │  6. Find new safe spawn
  │                              │  7. Create fresh snake
  │                              │     (mass=10, 10 segments)
  │                              │
  │  8. emit("respawned", {      │
  │     spawnPos, initialState}) │
  │<─────────────────────────────│
  │                              │
  │  9. Reset camera to          │
  │     new position             │
```

## 5. Continuous Movement Physics Engine

### 5.1 Angle-Based Steering

```typescript
// Core movement formula (server-authoritative)
function updateHeading(snake: Snake, dt: number): void {
  const diff = normalizeAngle(snake.targetAngle - snake.heading);
  const maxTurn = TURN_RATE * dt;  // TURN_RATE = 0.06 rad/tick
  snake.heading += clamp(diff, -maxTurn, maxTurn);
}

function advancePosition(snake: Snake, dt: number): void {
  const speed = snake.boosting ? BOOST_SPEED : BASE_SPEED;
  const newHead: Position = {
    x: snake.segments[0].x + Math.cos(snake.heading) * speed * dt,
    y: snake.segments[0].y + Math.sin(snake.heading) * speed * dt,
  };
  snake.segments.unshift(newHead);
}
```

### 5.2 Segment Following Algorithm

```
Snake body follows the path traced by the head:

1. Head moves forward → new position prepended to segments[]
2. Each segment maintains SEGMENT_SPACING (8 units) from previous
3. Excess segments trimmed from tail based on current mass
4. Result: smooth curved body following head's historical path

Length calculation:
  numSegments = floor(mass / MASS_PER_SEGMENT) + MIN_SEGMENTS
  segmentRadius = BASE_RADIUS + (mass * RADIUS_GROWTH_FACTOR)

Segment trimming (per tick):
  targetLength = numSegments
  while segments.length > targetLength:
    segments.pop()  // remove from tail
```

### 5.3 Boost Physics

```yaml
Boost_Mechanics:
  Speed: BASE_SPEED(200) → BOOST_SPEED(400) px/s
  Cost: BOOST_COST = 0.5 mass/tick (10 mass/second)
  Min_Mass: 15 (below this, boost disabled)
  Trail_Orbs:
    - Drop every TRAIL_ORB_INTERVAL ticks (3 ticks = 150ms)
    - Value: 2 mass each
    - Position: last segment position
    - Lifetime: 30 seconds
```

---

## 6. Spatial Partitioning & Collision

### 6.1 Spatial Hash Grid

```
┌────────────────────────────────────────────┐
│  Arena (radius=6000, diameter=12000)       │
│                                            │
│  Spatial Hash Grid:                        │
│  - Cell size: 200x200 units                │
│  - Grid dimensions: 60x60 cells            │
│  - Total cells: 3600                       │
│  - Each cell: Set<EntityRef>               │
│                                            │
│  ┌────┬────┬────┬────┐                     │
│  │ .. │ S1 │    │    │  S1 = snake segs    │
│  ├────┼────┼────┼────┤  O  = orb           │
│  │    │ S1 │ O  │ S2 │  S2 = another snake │
│  ├────┼────┼────┼────┤                     │
│  │ O  │    │ S2 │ S2 │                     │
│  ├────┼────┼────┼────┤                     │
│  │    │ O  │    │    │                     │
│  └────┴────┴────┴────┘                     │
└────────────────────────────────────────────┘

Operations:
  insert(entity, pos): O(1)
  query(pos, radius):  O(nearby count)
  rebuild():           O(total entities) per tick
  Memory:              ~50KB for 3600 cells
```

### 6.2 Collision Detection Pipeline

```
Broad Phase (Spatial Hash):
  1. For each snake head, query nearby cells (HEAD_RADIUS + margin)
  2. Get candidate entities from neighboring cells
  3. Filter: skip own segments, skip orbs (separate pass)

Narrow Phase (Circle-Circle):
  4. For each candidate segment:
     distance = sqrt((hx-sx)² + (hy-sy)²)
     if distance < headRadius + segmentRadius:
       → COLLISION DETECTED → snake dies

Head-to-Head (Circle-Circle):
  4b. If candidate is another snake's HEAD (index 0):
      distance = sqrt((h1x-h2x)² + (h1y-h2y)²)
      if distance < headRadius1 + headRadius2:
        → BOTH SNAKES DIE (mutual kill, both decompose to orbs)
        → Neither player gets kill credit

Boundary Check (Circle-Point):
  5. distance = sqrt(hx² + hy²)  // from center (0,0)
     if distance > ARENA_RADIUS - BOUNDARY_MARGIN:
       → BOUNDARY COLLISION → snake dies

Performance:
  100 snakes × avg 50 segments = 5000 entities
  Spatial hash query: O(1) per head (avg ~10 nearby)
  Total collision checks: ~100 × 10 = 1000 per tick
  vs brute force: 100 × 5000 = 500,000 per tick
  → 500x improvement
```

## 7. Network Architecture

### 7.1 Viewport-Based State Sync

```
Per-Player Viewport Calculation:
  viewportWidth  = screenWidth / zoomLevel
  viewportHeight = screenHeight / zoomLevel
  center = snake.segments[0]  // head position

  Visible area = {
    minX: center.x - viewportWidth/2 - MARGIN,
    maxX: center.x + viewportWidth/2 + MARGIN,
    minY: center.y - viewportHeight/2 - MARGIN,
    maxY: center.y + viewportHeight/2 + MARGIN
  }
  MARGIN = 200 (buffer for smooth enter/exit)

Dynamic Zoom:
  zoomLevel = clamp(1.0 - (mass / 500) * 0.3, 0.5, 1.0)
  → Small snake: zoom 1.0 (close view)
  → Large snake:  zoom 0.7 (wider view)

State Packet per Player:
  - Snakes: only those with ANY segment in viewport
  - Orbs: only those within viewport bounds
  - Leaderboard: always sent (top 10, ~200B)

Bandwidth Savings:
  Full arena (100 snakes × 50 segs): ~250KB/tick
  Viewport-culled (avg 15 visible):    ~30KB/tick
  → 88% bandwidth reduction
```

### 7.2 Binary Protocol & Compression

```
State Packet Structure (Binary ArrayBuffer):

Header (4 bytes):
  [tick: uint16][snakeCount: uint8][orbCount: uint8]

Per Snake (variable):
  [id: uint16]
  [flags: uint8]        // bits: alive|boosting|isMe
  [heading: float16]    // 2 bytes (enough precision for angle)
  [mass: uint16]
  [segCount: uint8]
  [segments: segCount × (x:int16, y:int16)]  // relative to center

Per Orb (6 bytes):
  [x: int16][y: int16][value: uint8][type: uint8]

Leaderboard (sent every 5 ticks):
  [count: uint8]
  [entries: count × (nameLen:uint8, name:utf8, score:uint32)]

Size Estimates (per tick, per player):
  15 visible snakes × 30 segs avg: ~15 × (7 + 30×4) = ~1,905B
  200 visible orbs: 200 × 6 = 1,200B
  Leaderboard (every 5th): ~200B
  Total: ~3.1KB/tick → 62KB/s at 20Hz

Delta Compression (future optimization):
  - Only send changed entities since last ack
  - Full snapshot every 100 ticks (5 seconds)
  - Expected reduction: 50-70% additional savings
```

## 8. Rendering Pipeline (Client)

```
Frame Pipeline (60 FPS):

  ┌─────────────┐     ┌──────────────┐     ┌──────────────┐
  │ 1. Update    │────>│ 2. Interpolate│────>│ 3. Transform │
  │ Game State   │     │ Positions    │     │ World→Screen │
  │ (from server)│     │ (lerp/slerp) │     │ (camera)     │
  └─────────────┘     └──────────────┘     └──────┬───────┘
                                                   │
  ┌─────────────┐     ┌──────────────┐     ┌──────┴───────┐
  │ 6. Composite │<────│ 5. Render    │<────│ 4. Render    │
  │ HUD/UI      │     │ Snakes+Orbs  │     │ Background   │
  │ (DOM overlay)│     │ (Canvas 2D)  │     │ (hex pattern)│
  └─────────────┘     └──────────────┘     └──────────────┘

Snake Rendering Detail:
  1. For each visible snake:
     a. Draw body segments: arc(x, y, radius, 0, 2π)
        - Color: snake.skin.color with alternating pattern
        - Glow: ctx.shadowBlur = 8, ctx.shadowColor = color
     b. Draw head (larger circle):
        - Eyes: two white circles + black pupils
        - Direction: pupils point toward heading angle
     c. Boost trail (if boosting):
        - Smaller fading circles behind tail

Background Rendering:
  - Dark navy (#0a0a1a) fill
  - Hexagonal dot grid pattern (spacing: 40px)
  - Pattern scrolls with camera (parallax 1:1)
  - Grid dots: rgba(255,255,255,0.05)

Arena Boundary:
  - Red warning zone at ARENA_RADIUS - 200
  - Pulsing red circle at ARENA_RADIUS
  - Increasing opacity as snake approaches edge

Performance Targets:
  Desktop: 60 FPS (100 snakes, 2000+ orbs visible)
  Mobile: 30 FPS (reduced glow, fewer particles)
  Adaptive: Skip glow effects if FPS < 45
```

---

## 9. Deployment Topology

```
┌─────────────────────────────────────────────────────┐
│                    Vercel Edge Network                │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │  Next.js 15 Static Export                     │   │
│  │  - Landing page (SSG)                         │   │
│  │  - Game page (CSR — Canvas)                   │   │
│  │  - CDN: global edge caching                   │   │
│  │  - Bundle: <300KB gzip                        │   │
│  └──────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────┘
                       │ WebSocket (wss://)
┌──────────────────────┴──────────────────────────────┐
│                    Railway                           │
│                                                      │
│  ┌──────────────────────────┐  ┌─────────────────┐  │
│  │  Arena Server Instance 1 │  │  Instance 2...   │  │
│  │  - Node.js + Socket.IO   │  │  (horizontal     │  │
│  │  - 100 players/instance  │  │   scale)         │  │
│  │  - 512MB RAM             │  │                  │  │
│  │  - 1 vCPU                │  │                  │  │
│  └──────────────────────────┘  └─────────────────┘  │
│                                                      │
│  Health check: GET /health → 200                     │
│  Metrics: /metrics (Prometheus format)               │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS
┌──────────────────────┴──────────────────────────────┐
│                    Supabase                          │
│  - PostgreSQL: player_profiles, game_sessions        │
│  - Auth: anonymous + OAuth (Google, GitHub)           │
│  - Realtime: leaderboard subscriptions               │
└──────────────────────────────────────────────────────┘
```

---

*Generated by DAVINCI /da:system v2.0*
*Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>*
