/**
 * Snake Arena — Socket.IO Event Types v2.0
 * Arena 기반 이벤트 (Room 제거)
 */

import type { LeaderboardEntry, Position, SnakeSkin } from './game';

// ─── Client → Server Events ───

export interface JoinPayload {
  name: string;      // 1-16 chars
  skinId?: number;
}

export interface InputPayload {
  a: number; // target angle (0~2π radian)
  b: 0 | 1;  // boost flag
  s: number; // sequence number
}

export interface RespawnPayload {
  name?: string;
  skinId?: number;
}

export interface PingPayload {
  t: number; // client timestamp
}

// ─── Server → Client Events ───

export interface JoinedPayload {
  id: string;
  spawn: Position;
  arena: {
    radius: number;
    orbCount: number;
  };
  tick: number;
}

/** 압축된 뱀 네트워크 데이터 */
export interface SnakeNetworkData {
  i: string;              // id
  n: string;              // name
  h: number;              // heading
  m: number;              // mass
  b: boolean;             // boosting
  k: number;              // skin id
  p: [number, number][];  // segments [[x,y],...]
  e?: number[];           // activeEffects [type, remainingTicks, ...] (0=magnet,1=speed,2=ghost)
}

/** 압축된 Orb 네트워크 데이터 */
export interface OrbNetworkData {
  x: number;
  y: number;
  v: number;    // value
  c: number;    // color index
  t: number;    // type: 0=natural|1=death|2=trail|3=magnet|4=speed|5=ghost|6=mega
}

export interface StatePayload {
  t: number;                 // server tick
  s: SnakeNetworkData[];     // visible snakes
  o: OrbNetworkData[];       // visible orbs
  l?: LeaderboardEntry[];    // leaderboard (매 5번째 틱)
}

export interface DeathPayload {
  score: number;
  length: number;
  kills: number;
  killer?: string;
  duration: number; // survival seconds
  rank: number;
}

export interface RespawnedPayload {
  spawn: Position;
  tick: number;
}

export interface KillPayload {
  victim: string;
  victimMass: number;
}

export interface MinimapPayload {
  snakes: Array<{
    x: number;
    y: number;
    m: number;
    me: boolean;
  }>;
  boundary: number;
}

export interface PongPayload {
  t: number;  // echoed client timestamp
  st: number; // server timestamp
}

export interface ErrorPayload {
  code: ErrorCode;
  message: string;
}

export type ErrorCode =
  | 'ARENA_FULL'
  | 'INVALID_NAME'
  | 'RATE_LIMITED'
  | 'KICKED';

// ─── Socket.IO Event Maps ───

export interface ClientToServerEvents {
  join: (data: JoinPayload) => void;
  input: (data: InputPayload) => void;
  respawn: (data: RespawnPayload) => void;
  ping: (data: PingPayload) => void;
}

export interface ServerToClientEvents {
  joined: (data: JoinedPayload) => void;
  state: (data: StatePayload) => void;
  death: (data: DeathPayload) => void;
  respawned: (data: RespawnedPayload) => void;
  kill: (data: KillPayload) => void;
  minimap: (data: MinimapPayload) => void;
  pong: (data: PongPayload) => void;
  error: (data: ErrorPayload) => void;
}
