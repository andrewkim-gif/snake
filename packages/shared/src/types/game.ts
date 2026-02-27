/**
 * Snake Arena — Game Types v2.0
 * snake.io/slither.io 스타일 (연속 이동, 각도 기반)
 */

// ─── Core Types ───

export interface Position {
  x: number; // float, world coordinates
  y: number;
}

// ─── Snake Entity ───

export interface SnakeSkin {
  id: number;
  primaryColor: string;
  secondaryColor: string;
  pattern: 'solid' | 'striped' | 'gradient' | 'dotted';
  eyeStyle: 'default' | 'angry' | 'cute' | 'cool';
}

export interface Snake {
  id: string;
  name: string;

  // 연속 이동 (각도 기반)
  segments: Position[]; // [0]=head, [n]=tail
  heading: number;      // current angle (0~2π)
  targetAngle: number;  // client-requested angle
  speed: number;        // current speed (px/s)

  // 성장 & 상태
  mass: number;
  boosting: boolean;
  alive: boolean;

  // 비주얼
  skin: SnakeSkin;

  // 점수
  score: number;
  kills: number;
  bestScore: number;

  // 메타
  joinedAt: number;
  lastInputSeq: number;
}

// ─── Orb Entity ───

export type OrbType = 'natural' | 'death' | 'boost_trail';

export interface Orb {
  id: number;
  position: Position;
  value: number;
  color: number;    // color index (0-11)
  type: OrbType;
  createdAt: number;
  lifetime?: number; // ticks until despawn (trail orbs)
}

// ─── Arena ───

export interface ArenaBoundary {
  center: Position;
  radius: number;
}

export interface ArenaConfig {
  radius: number;           // 6000
  maxPlayers: number;       // 100
  tickRate: number;         // 20 Hz
  baseSpeed: number;        // 200 px/s
  boostSpeed: number;       // 400 px/s
  turnRate: number;         // 0.06 rad/tick
  segmentSpacing: number;   // 8 units
  initialMass: number;      // 10
  minBoostMass: number;     // 15
  boostCostPerTick: number; // 0.5
  collectRadius: number;    // 20 units
  headRadius: number;       // 12 units
  naturalOrbTarget: number; // 2000
  deathOrbRatio: number;    // 0.8
  trailOrbInterval: number; // 3 ticks
  trailOrbValue: number;    // 2
  trailOrbLifetime: number; // 600 ticks (30s)
}

export interface ArenaState {
  tick: number;
  snakes: Map<string, Snake>;
  orbs: Orb[];
  boundary: ArenaBoundary;
  config: ArenaConfig;
  leaderboard: LeaderboardEntry[];
}

// ─── Leaderboard ───

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  kills: number;
  rank: number;
}

// ─── Viewport ───

export interface Viewport {
  center: Position;
  width: number;
  height: number;
  zoom: number; // 0.5~1.0
}

// ─── Spatial Hash ───

export interface SpatialCell {
  snakeSegments: Array<{ snakeId: string; segIndex: number; pos: Position }>;
  orbs: Orb[];
}

export interface SpatialHashConfig {
  cellSize: number;  // 200 units
  gridWidth: number;
  gridHeight: number;
}
