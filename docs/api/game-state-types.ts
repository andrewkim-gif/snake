/**
 * Snake Arena - Game State Data Structures v2.0
 *
 * REVISED: snake.io/slither.io style (continuous movement, angle-based)
 * 이 파일은 설계 문서용 레퍼런스 타입 정의입니다.
 * 실제 구현 시 packages/shared/types/ 에 배치됩니다.
 *
 * v1→v2 핵심 변경:
 *   - Direction enum → heading angle (radian)
 *   - Grid Position (int) → Continuous Position (float)
 *   - Food → Orb (natural/death/trail)
 *   - GameRoom → Arena (persistent, no rounds)
 *   - 신규: mass, boosting, skin, viewport
 */

// ─── Core Types ───

export interface Position {
  x: number;  // float, world coordinates (-6000 ~ +6000)
  y: number;  // float, world coordinates (-6000 ~ +6000)
}

export interface Vec2 {
  x: number;
  y: number;
}

// ─── Snake Entity ───

export interface SnakeSkin {
  id: number;
  primaryColor: string;      // hex color
  secondaryColor: string;    // hex color (pattern alternation)
  pattern: 'solid' | 'striped' | 'gradient' | 'dotted';
  eyeStyle: 'default' | 'angry' | 'cute' | 'cool';
}

export interface Snake {
  id: string;                // unique player ID
  name: string;              // display name (1-16 chars)

  // Movement (continuous, angle-based)
  segments: Position[];      // [0]=head, [n]=tail, float coords
  heading: number;           // current movement angle (0~2π radian)
  targetAngle: number;       // client-requested target angle
  speed: number;             // current speed (px/s)

  // Growth & State
  mass: number;              // total mass (determines length + thickness)
  boosting: boolean;         // speed boost active
  alive: boolean;

  // Visual
  skin: SnakeSkin;

  // Score
  score: number;             // = mass (current life score)
  kills: number;             // kills this life
  bestScore: number;         // best score ever (session)

  // Meta
  joinedAt: number;          // timestamp
  lastInputSeq: number;      // last processed input sequence
}

// ─── Orb Entity ───

export type OrbType = 'natural' | 'death' | 'boost_trail';

export interface Orb {
  id: number;                // numeric ID for efficiency
  position: Position;
  value: number;             // mass gain on collection
  color: number;             // color index (0-11)
  type: OrbType;
  createdAt: number;         // tick number when created
  lifetime?: number;         // ticks until despawn (trail orbs)
}

// ─── Arena State (Server-Side Full State) ───

export interface ArenaBoundary {
  center: Position;          // always {0, 0}
  radius: number;            // 6000 units
}

export interface ArenaConfig {
  radius: number;            // 6000
  maxPlayers: number;        // 100
  tickRate: number;          // 20 Hz
  baseSpeed: number;         // 200 px/s
  boostSpeed: number;        // 400 px/s
  turnRate: number;          // 0.06 rad/tick
  segmentSpacing: number;    // 8 units
  initialMass: number;       // 10
  minBoostMass: number;      // 15
  boostCostPerTick: number;  // 0.5
  collectRadius: number;     // 20 units
  headRadius: number;        // 12 units
  naturalOrbTarget: number;  // 2000
  deathOrbRatio: number;     // 0.8 (80% of mass becomes orbs)
  trailOrbInterval: number;  // 3 ticks
  trailOrbValue: number;     // 2
  trailOrbLifetime: number;  // 600 ticks (30 seconds)
}

export interface ArenaState {
  tick: number;              // current server tick
  snakes: Map<string, Snake>;
  orbs: Orb[];
  boundary: ArenaBoundary;
  config: ArenaConfig;
  leaderboard: LeaderboardEntry[];
  stats: ArenaStats;
}

// ─── Leaderboard ───

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;             // = current mass
  kills: number;
  rank: number;
}

// ─── Viewport (Client-Side) ───

export interface Viewport {
  center: Position;          // camera center (usually snake head)
  width: number;             // visible width in world units
  height: number;            // visible height in world units
  zoom: number;              // 0.5~1.0 (dynamic based on mass)
}

// ─── Network Payloads ───

export interface InputPayload {
  a: number;                 // target angle (radian)
  b: 0 | 1;                 // boost flag
  s: number;                 // sequence number
}

export interface StatePayload {
  t: number;                 // server tick
  s: SnakeNetworkData[];     // visible snakes
  o: OrbNetworkData[];       // visible orbs
  l?: LeaderboardEntry[];    // leaderboard (every 5th tick)
}

// Compact network format (short field names)
export interface SnakeNetworkData {
  i: string;                 // id
  n: string;                 // name
  h: number;                 // heading
  m: number;                 // mass
  b: boolean;                // boosting
  k: number;                 // skin id
  p: [number, number][];     // segments as [x,y] tuples
}

export interface OrbNetworkData {
  x: number;
  y: number;
  v: number;                 // value
  c: number;                 // color index
  t: 0 | 1 | 2;             // type enum
}

// ─── Death / Kill ───

export interface DeathPayload {
  score: number;
  length: number;
  kills: number;
  killer?: string;
  duration: number;          // survival seconds
  rank: number;
}

export interface KillPayload {
  victim: string;
  victimMass: number;
}

// ─── Arena Stats (Server Monitoring) ───

export interface ArenaStats {
  playerCount: number;
  orbCount: number;
  tickDuration: number;      // ms per tick (should be <50)
  memoryUsage: number;       // bytes
  uptime: number;            // seconds
}

// ─── Spatial Hash Types ───

export interface SpatialCell {
  snakeSegments: Array<{ snakeId: string; segIndex: number; pos: Position }>;
  orbs: Orb[];
}

export interface SpatialHashConfig {
  cellSize: number;          // 200 units
  gridWidth: number;         // arena diameter / cellSize
  gridHeight: number;
}

// ─── Interpolation (Client) ───

export interface SnapshotBuffer {
  snapshots: StatePayload[];  // circular buffer of last 3 states
  renderTime: number;         // current interpolation time
  serverTickRate: number;     // 20 Hz
}
