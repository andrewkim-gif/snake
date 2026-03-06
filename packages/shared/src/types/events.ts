/**
 * Snake Arena — Socket.IO Event Types v3.0
 * Multi-Room Tournament System
 */

import type { LeaderboardEntry, Position, SnakeSkin, UpgradeChoice, DamageSource, TomeType, AbilityType } from './game';

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
  id?: string;
  name: string;
  score: number;
  kills: number;
  skinId?: number;  // legacy compat
  level?: number;
  skin?: { id: number; name: string; rarity: string };
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
  /** v10 Phase 2: CubelingAppearance packed as bigint string (optional, 하위 호환) */
  appearance?: string;
}

export interface InputPayload {
  a: number; // target angle (0~2π radian)
  b: 0 | 1;  // boost flag
  s: number; // sequence number
}

export interface RespawnPayload {
  name?: string;
  skinId?: number;
  /** v10 Phase 2: CubelingAppearance packed as bigint string (optional, 하위 호환) */
  appearance?: string;
}

export interface PingPayload {
  t: number; // client timestamp
}

// ─── Server → Client Events ───

export interface JoinedPayload {
  roomId: string;
  id: string;
  spawn: Position;
  arenaRadius: number;   // v10: flat field (Go server sends json:"arenaRadius")
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

/** v10 Map Object 네트워크 데이터 */
export interface MapObjectNetworkData {
  id: string;
  type: string;   // 'shrine' | 'spring' | 'altar' | 'gate'
  x: number;
  y: number;
  r: number;      // interaction radius
  active: boolean;
}

export interface StatePayload {
  t: number;                 // server tick
  s: AgentNetworkData[];     // visible agents (v10, Agent 단일 좌표)
  o: OrbNetworkData[];       // visible orbs
  l?: LeaderboardEntry[];    // leaderboard (매 5번째 틱)
  mo?: MapObjectNetworkData[]; // v10 map objects (shrines, springs, altars, gates)
}

export interface DeathPayload {
  score: number;
  kills: number;
  duration: number;            // survival seconds
  rank: number;
  killer?: string;
  killerName?: string;         // v10: killer display name
  damageSource?: DamageSource; // v10: 사망 원인
  level?: number;              // v10: 사망 시 레벨
  build?: Record<string, any>; // v10: build state at death
}

export interface RespawnedPayload {
  spawn: Position;
  tick: number;
}

export interface KillPayload {
  victim: string;
  victimName?: string;  // v10: victim display name
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
  | 'ROOM_NOT_JOINABLE'
  | 'NO_RESPAWN';

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

// ─── v10 Agent Network Data ───

/** v10 압축된 에이전트 네트워크 데이터 */
export interface AgentNetworkData {
  i: string;              // id
  n: string;              // name
  x: number;              // position.x
  y: number;              // position.y
  h: number;              // heading
  m: number;              // mass
  b: boolean;             // boosting
  a: boolean;             // alive
  k: number;              // skin id (legacy) / appearance hash
  lv: number;             // level
  bot?: boolean;          // is bot agent
  ks?: number;            // kill streak
  hr: number;             // hitbox radius
  e?: number[];           // activeEffects (legacy 2D renderer compat)
  bt?: string;            // v10: dominant build type (berserker/tank/speedster/farmer/balanced)
  ap?: string;            // v10 Phase 2: appearance packed bigint as string (매 state에 항상 포함)
}

// ─── v10 Upgrade Events ───

/** 서버→클라: 레벨업 시 선택지 제시 */
export interface LevelUpPayload {
  level: number;
  choices: UpgradeChoice[];
  timeoutTicks: number;
}

/** 클라→서버: 업그레이드 선택 */
export interface ChooseUpgradePayload {
  choiceId: string;  // UpgradeChoice.id
}

// ─── Agent Training API 이벤트 ───

/** 에이전트 명령 페이로드 */
export interface AgentCommandPayload {
  cmd: string;
  [key: string]: any;
}

/** 트레이닝 프로필 설정 페이로드 */
export interface SetTrainingProfilePayload {
  agentId: string;
  profile: {
    buildProfile?: {
      primaryPath: string;
      fallbackPath?: string;
      fallbackCondition?: { levelBelow: number; timeElapsed: number };
      bannedUpgrades?: string[];
      alwaysPick?: string[];
    };
    combatRules?: Array<{
      condition: string;
      action: string;
      priority?: number;
    }>;
    strategyPhases?: {
      early: string;
      mid: string;
      late: string;
    };
  };
}

/** 트레이닝 프로필 저장 확인 */
export interface TrainingProfileSavedPayload {
  agentId: string;
  success: boolean;
  updatedAt: number;
}

// ── v10 Phase 4: Coach/Analyst/RP/Quest Payloads ──

export interface CoachMessagePayload {
  type: 'warning' | 'tip' | 'opportunity' | 'strategy' | 'efficiency';
  message: string;
  priority: number;
}

export interface RoundAnalysisPayload {
  buildEfficiency: number;
  combatScore: number;
  positioningScore: number;
  xpEfficiency: number;
  overallScore: number;
  suggestions: string[];
  mvpStats: {
    highestDPS: boolean;
    mostKills: boolean;
    longestSurvivor: boolean;
    bestBuilder: boolean;
    mostXP: boolean;
  };
}

export interface RPUpdatePayload {
  totalRP: number;
  rpEarned: number;
  breakdown: Record<string, number>;
  newUnlocks: Array<{
    id: string;
    name: string;
    type: string;
    description: string;
  }>;
  unlockedItems: string[];
}

export interface QuestProgressPayload {
  questId: string;
  current: number;
  target: number;
  completed: boolean;
  rpReward: number;
}

export interface QuestUpdatePayload {
  quests: QuestProgressPayload[];
  completedQuests: QuestProgressPayload[];
  rpEarned: number;
}

/** 게임 관찰 요청 */
export interface ObserveGamePayload {
  agentId: string;
}

/** 서버→클라: 시너지 발동 알림 */
export interface SynergyActivatedPayload {
  synergyId: string;
  name: string;          // Go: json:"name"
  description: string;
}

/** 서버→클라: 아레나 수축 정보 */
export interface ArenaShrinkPayload {
  currentRadius: number;
  minRadius: number;
  shrinkRate: number;  // px/min
}

// ─── Socket.IO Event Maps ───

export interface ClientToServerEvents {
  join_room: (data: JoinRoomPayload) => void;
  leave_room: () => void;
  input: (data: InputPayload) => void;
  respawn: (data: RespawnPayload) => void;
  ping: (data: PingPayload) => void;
  // v10 이벤트
  choose_upgrade: (data: ChooseUpgradePayload) => void;
  // v10 Phase 3: Agent Training
  observe_game: (data: ObserveGamePayload, callback: (response: any) => void) => void;
  agent_command: (data: AgentCommandPayload) => void;
  set_training_profile: (data: SetTrainingProfilePayload) => void;
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
  // v10 이벤트
  level_up: (data: LevelUpPayload) => void;
  synergy_activated: (data: SynergyActivatedPayload) => void;
  arena_shrink: (data: ArenaShrinkPayload) => void;
  // v10 Phase 3: Agent Training
  training_profile_saved: (data: TrainingProfileSavedPayload) => void;
  // v10 Phase 4: Coach/Analyst/RP/Quest
  coach_message: (data: CoachMessagePayload) => void;
  round_analysis: (data: RoundAnalysisPayload) => void;
  rp_update: (data: RPUpdatePayload) => void;
  quest_update: (data: QuestUpdatePayload) => void;
}
