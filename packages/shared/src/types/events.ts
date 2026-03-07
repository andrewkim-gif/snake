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
  terrainTheme?: string; // v11: country terrain theme (urban, desert, tundra, etc.)
  // v16: Dynamic arena settings (server is master, client overrides defaults)
  turnRate?: number;
  // v16 Phase 4: Heightmap terrain data
  heightmapData?: string;     // base64-encoded gzip binary (float32 array)
  heightmapWidth?: number;    // grid width in cells
  heightmapHeight?: number;   // grid height in cells
  heightmapCellSize?: number; // world units per cell (50)
  // v16 Phase 5: Biome + obstacle data
  biomeData?: string;         // base64-encoded gzip uint8 grid (biome indices 0-5)
  obstacleData?: string;      // base64-encoded gzip uint8 grid (obstacle types 0-7)
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
  // v11: sovereignty battle results
  winnerFaction?: string;
  sovereigntyChange?: SovereigntyDelta;
  topPlayers?: TopPlayerEntry[];
}

/** v11: Sovereignty change after a battle */
export interface SovereigntyDelta {
  countryIso: string;
  oldFaction?: string;
  newFaction: string;
  newLevel: number;
  isNewClaim: boolean;
}

/** v11: Summarized player entry for round_end */
export interface TopPlayerEntry {
  id: string;
  name: string;
  score: number;
  kills: number;
  level: number;
  alive: boolean;
  faction?: string;
}

/** v11: Battle complete event — cooldown ended, return to lobby */
export interface BattleCompletePayload {
  countryIso: string;
  nextBattle?: number; // seconds until next battle
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
  z?: number;             // v16 Phase 4: vertical position (height above terrain), 0 = ground
  h: number;              // heading (movement direction = MoveHeading)
  f?: number;             // v16: facing (aim direction = AimHeading), undefined = same as h
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
  ab?: string;            // v12: active ability type (empty = none)
  tx?: number;            // v12: ability target X coordinate
  ty?: number;            // v12: ability target Y coordinate
  abl?: number;           // v12: ability level (1-4)
  nat?: string;           // v14: nationality ISO3 code
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

/** v12: 서버→클라: 어빌리티 발동 알림 */
export interface AbilityTriggeredPayload {
  agentId: string;
  abilityType: string;  // 'venom_aura' | 'shield_burst' | 'lightning_strike' | 'speed_dash' | 'mass_drain' | 'gravity_well'
  targetX: number;
  targetY: number;
  level: number;        // 1-4
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

// ─── v14: Epoch & Respawn Event Payloads ───

/** v14: 에포크 페이즈 타입 */
export type EpochPhase = 'peace' | 'war_countdown' | 'war' | 'shrink' | 'end' | 'transition';

/** v14: 에포크 시작 이벤트 */
export interface EpochStartPayload {
  epochNumber: number;
  phase: EpochPhase;
  durationSec: number;
  peaceDurationSec: number;
  warDurationSec: number;
  shrinkDurationSec: number;
  countryCode: string;
}

/** v14: 에포크 종료 이벤트 */
export interface EpochEndPayload {
  epochNumber: number;
  countryCode: string;
  nationScores: Record<string, number>;
  topPlayers: EpochTopPlayerEntry[];
}

/** v14: 에포크 결과 플레이어 엔트리 */
export interface EpochTopPlayerEntry {
  id: string;
  name: string;
  nationality: string;
  score: number;
  kills: number;
}

/** v14: 전쟁 페이즈 시작 */
export interface WarPhaseStartPayload {
  epochNumber: number;
  warDurationSec: number;
  countryCode: string;
}

/** v14: 전쟁 페이즈 종료 */
export interface WarPhaseEndPayload {
  epochNumber: number;
  countryCode: string;
}

/** v14: 리스폰 카운트다운 */
export interface RespawnCountdownPayload {
  secondsLeft: number;
}

/** v14: 리스폰 완료 */
export interface RespawnCompletePayload {
  spawn: Position;
  tick: number;
  invincibleSec: number;
  speedPenaltySec: number;
  level: number;
}

/** v14: 국가별 점수 업데이트 */
export interface NationScoreUpdatePayload {
  epochNumber: number;
  countryCode: string;
  nationScores: Record<string, number>;
  phase: EpochPhase;
  timeRemaining: number;
}

/** v14 Phase 4: 전쟁 사이렌 경고 (3초 전) */
export interface WarSirenPayload {
  epochNumber: number;
  sirenSeconds: number;
  countryCode: string;
}

/** v14 Phase 4: NPC 몬스터 데이터 */
export interface NPCNetworkData {
  id: string;
  tier: 'weak' | 'medium' | 'strong';
  x: number;
  y: number;
  hp: number;
  maxHP: number;
  h: number;  // heading
  r: number;  // radius
  xp: number; // XP reward
}

/** v14 Phase 4: 킬 보상 알림 */
export interface KillRewardPayload {
  victimId: string;
  victimName: string;
  xp: number;
  gold: number;
  nationScore: number;
  isUnderdogKill: boolean;
  isBountyKill: boolean;
  killStreak: number;
}

/** v14 Phase 4: 현상수배 알림 */
export interface BountyAlertPayload {
  agentId: string;
  agentName: string;
  killStreak: number;
  bountyValue: number;
  isBountied: boolean;
}

/** v14 Phase 4: 에포크 스코어보드 데이터 */
export interface EpochScoreboardPayload {
  epochNumber: number;
  countryCode: string;
  players: EpochScoreboardEntry[];
  nationScores: NationScoreSummary[];
  mvp: EpochScoreboardEntry | null;
}

export interface EpochScoreboardEntry {
  rank: number;
  id: string;
  name: string;
  nationality: string;
  kills: number;
  deaths: number;
  assists: number;
  level: number;
  score: number;
  isBot: boolean;
}

export interface NationScoreSummary {
  nationality: string;
  totalScore: number;
  playerCount: number;
  totalKills: number;
}

// ─── v14 Phase 7: War System Event Payloads ───

/** v14 Phase 7: 전쟁 상태 */
export type WarState = 'none' | 'preparation' | 'active' | 'ended';

/** v14 Phase 7: 전쟁 결과 */
export type WarOutcome = 'none' | 'attacker_win' | 'defender_win' | 'auto_surrender' | 'fatigue_end' | 'truce';

/** v14 Phase 7: 전쟁 측면 */
export type WarSide = 'attacker' | 'defender' | 'neutral';

/** v14 Phase 7: 전쟁 선포 이벤트 */
export interface WarDeclaredPayload {
  warId: string;
  attacker: string;        // ISO3 attacking nation
  defender: string;        // ISO3 defending nation
  coalition: string[];     // coalition members (if coalition war)
  declType: 'hegemony' | 'coalition';
  state: WarState;
  timestamp: number;
}

/** v14 Phase 7: 전쟁 종료 이벤트 */
export interface WarEndedPayload {
  warId: string;
  attacker: string;
  defender: string;
  outcome: WarOutcome;
  attackerScore: number;
  defenderScore: number;
  winner: string;          // ISO3 of winner
  loser: string;           // ISO3 of loser
  timestamp: number;
}

/** v14 Phase 7: 전쟁 스코어 업데이트 */
export interface WarScoreUpdatePayload {
  warId: string;
  attacker: string;
  defender: string;
  attackerScore: number;
  defenderScore: number;
}

/** v14 Phase 7: 전쟁 스냅샷 (전체 상태) */
export interface WarSnapshotPayload {
  wars: WarSnapshotEntry[];
}

export interface WarSnapshotEntry {
  warId: string;
  state: WarState;
  attacker: string;
  defender: string;
  attackerAllies: string[];
  defenderAllies: string[];
  attackerScore: number;
  defenderScore: number;
  declaredAt: number;
  activatedAt: number;
  fatiguePenalty: number;
}

/** v14 Phase 7: 동맹 스냅샷 */
export interface AllianceSnapshotPayload {
  alliances: AllianceSnapshotEntry[];
}

export interface AllianceSnapshotEntry {
  allianceId: string;
  name: string;
  leader: string;
  members: string[];
  formedAt: number;
}

/** v14: 국적 선택 페이로드 */
export interface SelectNationalityPayload {
  nationality: string;
}

/** v14: 국가 아레나 참가 페이로드 */
export interface JoinCountryArenaPayload {
  countryCode: string;
  name: string;
  skinId?: number;
  appearance?: string;
  nationality: string;
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
  // v14: Epoch & Nationality
  select_nationality: (data: SelectNationalityPayload) => void;
  join_country_arena: (data: JoinCountryArenaPayload) => void;
  // v14 Phase 7: War system
  declare_war: (data: { attacker: string; defender: string; coalition: string[] }) => void;
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
  // v11: Battle complete — cooldown ended
  battle_complete: (data: BattleCompletePayload) => void;
  // v12: Ability triggered visual effect
  ability_triggered: (data: AbilityTriggeredPayload) => void;
  // v14: Epoch & Respawn events
  epoch_start: (data: EpochStartPayload) => void;
  epoch_end: (data: EpochEndPayload) => void;
  war_phase_start: (data: WarPhaseStartPayload) => void;
  war_phase_end: (data: WarPhaseEndPayload) => void;
  respawn_countdown: (data: RespawnCountdownPayload) => void;
  respawn_complete: (data: RespawnCompletePayload) => void;
  nation_score_update: (data: NationScoreUpdatePayload) => void;
  // v14 Phase 4: Deathmatch & rewards events
  war_siren: (data: WarSirenPayload) => void;
  kill_reward: (data: KillRewardPayload) => void;
  bounty_alert: (data: BountyAlertPayload) => void;
  epoch_scoreboard: (data: EpochScoreboardPayload) => void;
  // v14 Phase 7: War system events
  war_declared: (data: WarDeclaredPayload) => void;
  war_ended: (data: WarEndedPayload) => void;
  war_score_update: (data: WarScoreUpdatePayload) => void;
  war_snapshot: (data: WarSnapshotPayload) => void;
  alliance_snapshot: (data: AllianceSnapshotPayload) => void;
}
