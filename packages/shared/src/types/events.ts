/**
 * Snake Arena — Socket.IO Event Types v3.0
 * Multi-Room Tournament System
 */

import type { LeaderboardEntry, Position, SnakeSkin } from './game';

// ─── Room System Types ───

export type RoomStatus = 'waiting' | 'countdown' | 'playing' | 'ending' | 'cooldown';

export interface RoomInfo {
  id: string;
  state: RoomStatus;
  playerCount: number;
  maxPlayers: number;
  timeRemaining: number;
  winner: WinnerInfo | null;
}

export interface WinnerInfo {
  name: string;
  score: number;
  kills: number;
  skinId: number;
}

export interface RecentWinner extends WinnerInfo {
  roomId: string;
  timestamp: number;
}

// ─── Client → Server Events ───

export interface JoinRoomPayload {
  roomId: string; // 'quick' for auto-match
  name: string;
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
  roomId: string;
  id: string;
  spawn: Position;
  arena: {
    radius: number;
    orbCount: number;
  };
  tick: number;
  roomState: RoomStatus;
  timeRemaining: number;
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
  | 'KICKED'
  | 'ROOM_FULL'
  | 'ROOM_NOT_FOUND'
  | 'ALREADY_IN_ROOM'
  | 'NOT_IN_ROOM'
  | 'ROOM_NOT_JOINABLE';

// ─── Room Event Payloads ───

export interface RoomsUpdatePayload {
  rooms: RoomInfo[];
  recentWinners: RecentWinner[];
}

export interface RoundStartPayload {
  countdown: number; // 10→0, 0 means round started
}

export interface RoundEndPayload {
  winner: WinnerInfo | null;
  finalLeaderboard: LeaderboardEntry[];
  yourRank: number;
  yourScore: number;
}

export interface RoundResetPayload {
  roomState: RoomStatus;
}

// ─── Socket.IO Event Maps ───

export interface ClientToServerEvents {
  join_room: (data: JoinRoomPayload) => void;
  leave_room: () => void;
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
  rooms_update: (data: RoomsUpdatePayload) => void;
  round_start: (data: RoundStartPayload) => void;
  round_end: (data: RoundEndPayload) => void;
  round_reset: (data: RoundResetPayload) => void;
}
