# Snake Arena — Socket.IO Event Protocol v2.0

> **Version**: 2.0 (Revised for snake.io style — continuous movement)
> **Transport**: Socket.IO v4 (WebSocket primary, HTTP long-polling fallback)
> **Serialization**: JSON (input events), Binary ArrayBuffer (state updates)
> **Date**: 2026-02-27

---

## 1. Connection Lifecycle

```
Client                         Server
  │                              │
  │  io.connect(SERVER_URL, {    │
  │    transports: ["websocket"],│
  │    reconnection: true,       │
  │    reconnectionDelay: 1000,  │
  │    reconnectionAttempts: 5   │
  │  })                          │
  │─────────────────────────────>│
  │                              │  Validate origin (CORS)
  │                              │  Check connection limit
  │                              │  Assign socket.id
  │  "connect" ack               │
  │<─────────────────────────────│
  │                              │
  │  emit("join")                │
  │─────────────────────────────>│  → Arena.addPlayer()
  │                              │
  │  emit("joined")             │
  │<─────────────────────────────│
  │                              │
  │  ... game loop ...           │
  │                              │
  │  emit("disconnect")         │
  │─────────────────────────────>│  → Arena.removePlayer()
```

---

## 2. Client → Server Events

### 2.1 `join` — Enter Arena

```typescript
// Client sends after WebSocket connects
socket.emit("join", {
  name: string;        // Player display name (1-16 chars)
  skinId?: number;     // Optional skin selection (0-based)
});

// Rate limit: 1 per connection
// Validation: name length, sanitize XSS, profanity filter
```

### 2.2 `input` — Player Input (Continuous)

```typescript
// Client sends on mousemove/touchmove (throttled to 30Hz)
socket.emit("input", {
  a: number;           // target angle in radians (0~2π)
  b: 0 | 1;           // boost flag (0=off, 1=on)
  s: number;           // client sequence number (for reconciliation)
});

// Rate limit: max 30/second
// Validation: angle must be 0~2π, boost must be 0|1
// Short field names to reduce payload (~25 bytes/event)
```

### 2.3 `respawn` — Rejoin After Death

```typescript
// Client sends when user clicks "Play Again"
socket.emit("respawn", {
  name?: string;       // Optional name change
  skinId?: number;     // Optional skin change
});

// Rate limit: 1 per 2 seconds (prevent spam)
```

### 2.4 `ping` — Latency Measurement

```typescript
// Client sends every 5 seconds
socket.emit("ping", {
  t: number;           // client timestamp (Date.now())
});
```

---

## 3. Server → Client Events

### 3.1 `joined` — Arena Entry Confirmation

```typescript
socket.emit("joined", {
  id: string;                    // Assigned player ID
  spawn: { x: number; y: number }; // Spawn position
  arena: {
    radius: number;              // Arena boundary radius
    orbCount: number;            // Current orb count
  };
  tick: number;                  // Current server tick
});
```

### 3.2 `state` — Game State Update (20Hz)

```typescript
// Binary ArrayBuffer — viewport-culled per player
// Sent every tick (50ms)

// Structure:
{
  t: number;                     // Server tick number
  s: SnakeUpdate[];              // Visible snakes
  o: OrbUpdate[];                // Visible orbs
  l?: LeaderboardEntry[];        // Leaderboard (every 5th tick)
}

interface SnakeUpdate {
  i: string;                     // Snake ID (short)
  n: string;                     // Name
  h: number;                     // Heading angle
  m: number;                     // Mass
  b: boolean;                    // Boosting
  k: number;                     // Skin ID
  p: [number, number][];         // Segments [[x,y], [x,y], ...]
}

interface OrbUpdate {
  x: number;
  y: number;
  v: number;                     // Value
  c: number;                     // Color index
  t: 0 | 1 | 2;                 // Type: natural|death|trail
}

interface LeaderboardEntry {
  n: string;                     // Name
  s: number;                     // Score/mass
  me: boolean;                   // Is current player
}
```

### 3.3 `death` — Player Death Notification

```typescript
socket.emit("death", {
  score: number;                 // Final score
  length: number;                // Final length (segments)
  kills: number;                 // Total kills this life
  killer?: string;               // Killer's name (if killed by player)
  duration: number;              // Survival time (seconds)
  rank: number;                  // Final leaderboard rank
});
```

### 3.4 `respawned` — Respawn Confirmation

```typescript
socket.emit("respawned", {
  spawn: { x: number; y: number };
  tick: number;
});
```

### 3.5 `kill` — Kill Notification

```typescript
// Sent when this player kills another
socket.emit("kill", {
  victim: string;                // Victim's name
  victimMass: number;            // Victim's mass at death
});
```

### 3.6 `minimap` — Minimap Data (1Hz)

```typescript
// Sent every 20 ticks (1 second) — low-frequency full-arena overview
socket.emit("minimap", {
  snakes: Array<{
    x: number;                     // Head X (rounded to int)
    y: number;                     // Head Y (rounded to int)
    m: number;                     // Mass (for dot size)
    me: boolean;                   // Is current player
  }>;
  boundary: number;                // Arena radius
});

// ~20 bytes per snake, 100 snakes = ~2KB/s at 1Hz
// Enables minimap to show ALL snakes (not just viewport)
```

### 3.7 `pong` — Latency Response

```typescript
socket.emit("pong", {
  t: number;                     // Echoed client timestamp
  st: number;                    // Server timestamp
});
// Client calculates RTT = Date.now() - t
```

---

## 4. Error Events

### 4.1 `error` — Server Error

```typescript
socket.emit("error", {
  code: string;
  message: string;
});

// Error codes:
// "ARENA_FULL"      — Arena at max capacity
// "INVALID_NAME"    — Name validation failed
// "RATE_LIMITED"     — Too many events
// "KICKED"          — Anti-cheat detection
```

---

## 5. Rate Limiting Policy

| Event | Max Rate | Window | Action on Exceed |
|-------|----------|--------|-----------------|
| `input` | 30/sec | 1 second | Drop excess, warn |
| `join` | 1/connection | - | Ignore duplicates |
| `respawn` | 1/2sec | 2 seconds | Queue, delay |
| `ping` | 1/3sec | 3 seconds | Drop excess |
| Connection | 5/min/IP | 1 minute | Block IP 60s |

---

## 6. TypeScript Type Definitions

```typescript
// packages/shared/src/types/events.ts

export interface ClientToServerEvents {
  join: (data: { name: string; skinId?: number }) => void;
  input: (data: { a: number; b: 0 | 1; s: number }) => void;
  respawn: (data: { name?: string; skinId?: number }) => void;
  ping: (data: { t: number }) => void;
}

export interface ServerToClientEvents {
  joined: (data: JoinedPayload) => void;
  state: (data: StatePayload) => void;
  death: (data: DeathPayload) => void;
  respawned: (data: RespawnedPayload) => void;
  kill: (data: KillPayload) => void;
  pong: (data: { t: number; st: number }) => void;
  error: (data: { code: string; message: string }) => void;
}
```

---

*Generated by DAVINCI /da:system v2.0*
