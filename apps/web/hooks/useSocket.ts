'use client';

/**
 * useSocket — 게임 서버 연결 + 상태 관리 훅
 * v10: Socket.IO → Native WebSocket (GameSocket 어댑터)
 * v10: snake → agent 리네이밍 완료
 * v10: level_up, synergy_activated, arena_shrink 이벤트 추가
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import { GameSocket } from './useWebSocket';
import {
  ARENA_CONFIG,
  type StatePayload, type JoinedPayload, type DeathPayload,
  type KillPayload, type MinimapPayload, type RoomInfo, type RecentWinner,
  type RoomStatus, type RoundEndPayload, type LeaderboardEntry,
  type LevelUpPayload, type ArenaShrinkPayload, type SynergyActivatedPayload,
  type AgentNetworkData, type BattleCompletePayload,
  type EpochStartPayload, type EpochEndPayload,
  type WarPhaseStartPayload, type WarPhaseEndPayload,
  type RespawnCountdownPayload, type RespawnCompletePayload,
  type NationScoreUpdatePayload, type EpochPhase,
  type WeaponDamageEvent,
  type WarDeclaredPayload, type WarEndedPayload, type WarScoreUpdatePayload,
  type WarSnapshotPayload, type WarSirenPayload,
  type EpochScoreboardPayload, type EpochScoreboardEntry,
} from '@agent-survivor/shared';
import type { CapturePointData } from '@/components/3d/CapturePointRenderer';
import type { WarEffectData } from '@/components/3d/GlobeWarEffects';
import type { ServerDominationData } from '@/components/3d/GlobeDominationLayer';
import type { CountryDominationState } from '@/components/3d/GlobeDominationLayer';
import type { CountryClientState } from '@/lib/globe-data';
import { decodeHeightmap } from '@/lib/heightmap-decoder';
import { decodeBiomeGrid, decodeObstacleGrid } from '@/lib/biome-decoder';
import type {
  ARState, ARPlayerNet, ARPhase, ARDamageEvent, ARTomeOffer,
  ARBattleRewards, ARFactionPvPScoreNet, ARSynergyID, ARChoice,
  ARPvPKillEvent,
  ARLevelUpEvent,
} from '@/lib/3d/ar-types';

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:8000';

// ─── v19: AR Event Queue Types ───

export type AREvent =
  | { type: 'damage'; data: ARDamageEvent }
  | { type: 'kill'; data: { killerId: string; victimId: string; xp: number } }
  | { type: 'pvp_kill'; data: ARPvPKillEvent }
  | { type: 'boss_spawn'; data: { bossType: string } }
  | { type: 'boss_defeated'; data: { bossType: string; factionId: string } }
  | { type: 'miniboss_death'; data: { minibossType: string; x: number; z: number } }
  | { type: 'elite_explosion'; data: { x: number; z: number; radius: number } };

const AR_EVENT_QUEUE_MAX = 256;

/** Drain up to maxPerFrame events from the AR event queue (oldest first). */
export function drainAREvents(
  queue: React.MutableRefObject<AREvent[]>,
  maxPerFrame: number = 64,
): AREvent[] {
  if (queue.current.length === 0) return [];
  return queue.current.splice(0, maxPerFrame);
}

// ─── v19: AR UI State (React state for HTML overlays, 250ms throttle) ───

export interface ARUiState {
  hp: number;
  maxHp: number;
  xp: number;
  xpToNext: number;
  level: number;
  phase: ARPhase;
  timer: number;
  wave: number;
  kills: number;
  alive: boolean;
  factionId: string;
  // Level-up choices (set by ar_level_up event)
  levelUpChoices: ARTomeOffer[] | null;
  // Battle end data
  battleEnd: ARBattleRewards | null;
  // PvP data
  pvpRadius: number;
  factionScores: ARFactionPvPScoreNet[];
  // Synergies (from local player in arState)
  synergies: ARSynergyID[];
}

const INITIAL_AR_UI_STATE: ARUiState = {
  hp: 0,
  maxHp: 0,
  xp: 0,
  xpToNext: 0,
  level: 0,
  phase: 'deploy',
  timer: 0,
  wave: 0,
  kills: 0,
  alive: false,
  factionId: '',
  levelUpChoices: null,
  battleEnd: null,
  pvpRadius: 0,
  factionScores: [],
  synergies: [],
};

const AR_UI_THROTTLE_MS = 250;

// Coach message from server (Phase 5)
export interface CoachMessageData {
  type: 'warning' | 'tip' | 'opportunity' | 'strategy' | 'efficiency';
  message: string;
}

// Round analysis — AnalystPanel의 타입 재사용
export type { RoundAnalysisData } from '@/components/game/AnalystPanel';
import type { RoundAnalysisData } from '@/components/game/AnalystPanel';

export interface GameData {
  connected: boolean;
  playerId: string | null;
  alive: boolean;
  latestState: StatePayload | null;
  prevState: StatePayload | null;
  stateTimestamp: number;
  prevStateTimestamp: number;
  leaderboard: LeaderboardEntry[];
  minimap: MinimapPayload | null;
  deathInfo: DeathPayload | null;
  killFeed: KillPayload[];
  rtt: number;
  currentRoomId: string | null;
  roomState: RoomStatus | null;
  timeRemaining: number;
  // v10 upgrade system
  levelUp: LevelUpPayload | null;
  arenaShrink: ArenaShrinkPayload | null;
  synergyPopups: SynergyActivatedPayload[];
  // v19: Raw AR state for arena combat HUD/enemy rendering
  arState: ARState | null;
}

function createInitialData(): GameData {
  return {
    connected: false,
    playerId: null,
    alive: false,
    latestState: null,
    prevState: null,
    stateTimestamp: 0,
    prevStateTimestamp: 0,
    leaderboard: [],
    minimap: null,
    deathInfo: null,
    killFeed: [],
    rtt: 0,
    currentRoomId: null,
    roomState: null,
    timeRemaining: 0,
    levelUp: null,
    arenaShrink: null,
    synergyPopups: [],
    arState: null,
  };
}

// v14: Epoch state for client
export interface EpochState {
  epochNumber: number;
  phase: EpochPhase;
  timeRemaining: number;
  phaseTimeRemaining: number;
  pvpEnabled: boolean;
  nationScores: Record<string, number>;
}

// v14: Respawn state
export interface RespawnState {
  countdown: number;
  isRespawning: boolean;
  invincibleSec: number;
}

// v15: Trade route data received from server
export interface TradeRouteData {
  from: string;     // ISO3 seller faction/country
  to: string;       // ISO3 buyer faction/country
  type: 'sea' | 'land';
  volume: number;
  resource: string;
  timestamp: number;
}

export interface UiState {
  connected: boolean;
  alive: boolean;
  deathInfo: DeathPayload | null;
  rooms: RoomInfo[];
  recentWinners: RecentWinner[];
  currentRoomId: string | null;
  roomState: RoomStatus | null;
  roundEnd: RoundEndPayload | null;
  countdown: number | null;
  timeRemaining: number;
  // v10 upgrade system
  levelUp: LevelUpPayload | null;
  arenaShrink: ArenaShrinkPayload | null;
  synergyPopups: SynergyActivatedPayload[];
  // v10 Phase 5: coach + analyst
  coachMessage: CoachMessageData | null;
  roundAnalysis: RoundAnalysisData | null;
  // v11: 국가 상태 (1Hz broadcast from WorldManager)
  countryStates: Map<string, CountryClientState>;
  // v11: terrain theme + spectating + battle complete
  terrainTheme: string | null;
  isSpectating: boolean;
  battleComplete: BattleCompletePayload | null;
  // v16: Dynamic arena settings from server (overrides ARENA_CONFIG defaults)
  arenaSettings: {
    radius: number;
    turnRate: number;
  } | null;
  // v14: Epoch & Respawn
  epoch: EpochState | null;
  epochResult: EpochEndPayload | null;
  respawnState: RespawnState | null;
  warCountdown: number | null;
  nationality: string | null;
  // v14: Weapon VFX + Damage Numbers
  damageEvents: WeaponDamageEvent[];
  // v14: Capture Points
  capturePoints: CapturePointData[];
  // v14: Globe domination + war effects
  dominationStates: Map<string, CountryDominationState>;
  wars: WarEffectData[];
  // v14: Global events (EventTicker)
  globalEvents: Array<{ id: string; type: string; message: string; timestamp: number }>;
  // v14: Epoch scoreboard (full player data)
  epochScoreboard: EpochScoreboardEntry[];
  // v15: Trade route visualization data
  tradeRoutes: TradeRouteData[];
  // v15: Server error (arena_full, join_failed, etc.)
  lastError: { code: string; message: string } | null;
  // v16 Phase 4: Heightmap terrain data (decoded from joined event)
  heightmapData: import('@/components/3d/HeightmapTerrain').HeightmapTerrainData | null;
  // v16 Phase 5: Biome + obstacle grid data
  biomeData: import('@/lib/biome-decoder').BiomeGridData | null;
  obstacleData: import('@/lib/biome-decoder').ObstacleGridData | null;
  // v16 Phase 8: Weather state (from state broadcast)
  weather: { type: string; intensity: number } | null;
  // v17: ISO3 set of countries with active conflicts (playing/countdown rooms)
  activeConflictCountries: Set<string>;
}

export function useSocket() {
  const socketRef = useRef<GameSocket | null>(null);
  const dataRef = useRef<GameData>(createInitialData());

  // v19: AR state ref (raw 20Hz ar_state — for 3D components via useFrame)
  const arStateRef = useRef<ARState | null>(null);
  // v19: AR event queue ref (pushed by event handlers, drained by useFrame consumers)
  const arEventQueueRef = useRef<AREvent[]>([]);
  // v19: AR UI state (250ms throttle — for HTML overlay components)
  const [arUiState, setArUiState] = useState<ARUiState>(INITIAL_AR_UI_STATE);
  // v19: Throttle tracker for arUiState updates
  const arUiThrottleRef = useRef(0);

  const [uiState, setUiState] = useState<UiState>({
    connected: false,
    alive: false,
    deathInfo: null,
    rooms: [],
    recentWinners: [],
    currentRoomId: null,
    roomState: null,
    roundEnd: null,
    countdown: null,
    timeRemaining: 0,
    levelUp: null,
    arenaShrink: null,
    synergyPopups: [],
    coachMessage: null,
    roundAnalysis: null,
    countryStates: new Map(),
    terrainTheme: null,
    isSpectating: false,
    battleComplete: null,
    arenaSettings: null,
    epoch: null,
    epochResult: null,
    respawnState: null,
    warCountdown: null,
    nationality: null,
    damageEvents: [],
    capturePoints: [],
    dominationStates: new Map(),
    wars: [],
    globalEvents: [],
    epochScoreboard: [],
    tradeRoutes: [],
    lastError: null,
    heightmapData: null,
    biomeData: null,
    obstacleData: null,
    weather: null,
    activeConflictCountries: new Set(),
  });

  useEffect(() => {
    dataRef.current = createInitialData();

    const socket = new GameSocket();
    socketRef.current = socket;

    socket.onConnect = () => {
      dataRef.current.connected = true;
      setUiState(prev => ({ ...prev, connected: true }));
    };

    socket.onDisconnect = () => {
      dataRef.current.connected = false;
      dataRef.current.alive = false;
      dataRef.current.currentRoomId = null;
      dataRef.current.roomState = null;
      setUiState(prev => ({
        ...prev, connected: false, alive: false,
        currentRoomId: null, roomState: null,
      }));
    };

    // ─── Server → Client 이벤트 핸들러 ───

    socket.on('joined', (data: JoinedPayload) => {
      dataRef.current.playerId = data.id;
      dataRef.current.alive = true;
      dataRef.current.deathInfo = null;
      dataRef.current.currentRoomId = data.roomId;
      dataRef.current.roomState = data.roomState;
      dataRef.current.timeRemaining = data.timeRemaining;

      // v16 Phase 4: Decode heightmap data if present
      let heightmapData: import('@/components/3d/HeightmapTerrain').HeightmapTerrainData | null = null;
      if (data.heightmapData && data.heightmapWidth && data.heightmapHeight && data.heightmapCellSize) {
        heightmapData = decodeHeightmap(
          data.heightmapData,
          data.heightmapWidth,
          data.heightmapHeight,
          data.heightmapCellSize,
        );
      }

      // v16 Phase 5: Decode biome + obstacle grids (same dimensions as heightmap)
      let biomeData: import('@/lib/biome-decoder').BiomeGridData | null = null;
      let obstacleData: import('@/lib/biome-decoder').ObstacleGridData | null = null;
      const gridW = data.heightmapWidth ?? 0;
      const gridH = data.heightmapHeight ?? 0;
      if (data.biomeData && gridW > 0 && gridH > 0) {
        biomeData = decodeBiomeGrid(data.biomeData, gridW, gridH);
      }
      if (data.obstacleData && gridW > 0 && gridH > 0) {
        obstacleData = decodeObstacleGrid(data.obstacleData, gridW, gridH);
      }

      setUiState(prev => ({
        ...prev, alive: true, deathInfo: null, roundEnd: null,
        currentRoomId: data.roomId, roomState: data.roomState,
        timeRemaining: data.timeRemaining,
        terrainTheme: data.terrainTheme ?? null,
        isSpectating: false,
        battleComplete: null,
        // v16: Store dynamic arena settings from server
        arenaSettings: {
          radius: data.arenaRadius,
          turnRate: data.turnRate ?? ARENA_CONFIG.turnRate,
        },
        // v16 Phase 4: Decoded heightmap
        heightmapData,
        // v16 Phase 5: Decoded biome + obstacle grids
        biomeData,
        obstacleData,
      }));
    });

    socket.on('state', (data: StatePayload) => {
      const now = performance.now();
      dataRef.current.prevState = dataRef.current.latestState;
      dataRef.current.prevStateTimestamp = dataRef.current.stateTimestamp;
      dataRef.current.latestState = data;
      dataRef.current.stateTimestamp = now;
      if (data.l) {
        dataRef.current.leaderboard = data.l;
      }
      // v16 Phase 8: Update weather state from server broadcast
      if (data.w) {
        setUiState(prev => {
          const wt = data.w!.wt;
          const wi = data.w!.wi ?? 0;
          if (prev.weather?.type === wt && Math.abs((prev.weather?.intensity ?? 0) - wi) < 0.05) {
            return prev; // avoid unnecessary re-renders for small intensity changes
          }
          return { ...prev, weather: { type: wt, intensity: wi } };
        });
      } else {
        setUiState(prev => prev.weather ? { ...prev, weather: null } : prev);
      }
    });

    // v19: Arena combat state — bridge ARState → synthetic StatePayload
    // Server sends ar_state (not state) in CombatModeArena
    socket.on('ar_state', (data: ARState) => {
      const now = performance.now();

      // Channel 1: Store raw AR state in ref (for 3D useFrame consumers)
      arStateRef.current = data;
      // Also keep on dataRef for backward compat
      dataRef.current.arState = data;

      // Channel 2: Throttled React state update for HTML HUD overlays (4Hz)
      if (now - arUiThrottleRef.current >= AR_UI_THROTTLE_MS) {
        arUiThrottleRef.current = now;
        const myId = dataRef.current.playerId;
        const me = myId ? data.players.find(p => p.id === myId) : null;
        if (me) {
          setArUiState(prev => ({
            ...prev,
            hp: me.hp,
            maxHp: me.maxHp,
            xp: me.xp,
            xpToNext: me.xpToNext,
            level: me.level,
            phase: data.phase,
            timer: data.timer,
            wave: data.wave,
            kills: me.kills,
            alive: me.alive,
            factionId: me.factionId,
            pvpRadius: data.pvpRadius ?? 0,
            factionScores: data.factionScores ?? [],
            synergies: me.synergies ?? [],
          }));
        }
      }

      // Bridge: ARPlayerNet[] → AgentNetworkData[]
      const agents: AgentNetworkData[] = data.players.map((p: ARPlayerNet) => ({
        i: p.id,
        n: p.name,
        x: p.pos.x,
        y: p.pos.z,       // server Z (horizontal) → client Y
        z: p.pos.y,        // server Y (vertical) → client Z (height)
        h: p.rot,          // rotation → heading
        f: p.rot,          // same as heading (no separate aim in AR)
        m: 15,             // v19 fix: fixed mass (HP→mass caused agents to appear giant)
        b: false,          // no boost in arena
        a: p.alive,
        k: 0,              // skin placeholder
        lv: p.level,
        bot: false,
        ks: p.kills,
        hr: 15,            // default hitbox radius
        nat: p.factionId,  // faction → nationality for flag display
      }));

      // Create synthetic StatePayload
      const syntheticState: StatePayload = {
        t: Date.now(),
        s: agents,
        o: [],             // no orbs in arena (enemies/crystals rendered separately)
      };

      // Write to same dataRef fields as classic state handler
      dataRef.current.prevState = dataRef.current.latestState;
      dataRef.current.prevStateTimestamp = dataRef.current.stateTimestamp;
      dataRef.current.latestState = syntheticState;
      dataRef.current.stateTimestamp = now;

      // Track local player alive state from ar_state
      const myId = dataRef.current.playerId;
      if (myId) {
        const me = data.players.find(p => p.id === myId);
        if (me && !me.alive && dataRef.current.alive) {
          dataRef.current.alive = false;
          setUiState(prev => ({ ...prev, alive: false, isSpectating: true }));
        } else if (me && me.alive && !dataRef.current.alive) {
          dataRef.current.alive = true;
          setUiState(prev => ({ ...prev, alive: true, isSpectating: false }));
        }
      }
    });

    // ─── v19: 10 AR Event Listeners (Channel 3: event queue + direct state) ───

    socket.on('ar_damage', (data: ARDamageEvent) => {
      if (arEventQueueRef.current.length < AR_EVENT_QUEUE_MAX) {
        arEventQueueRef.current.push({ type: 'damage', data });
      }
    });

    socket.on('ar_level_up', (data: ARLevelUpEvent) => {
      // Direct state update — no throttle (immediate UI needed)
      setArUiState(prev => ({ ...prev, levelUpChoices: data.choices }));
    });

    socket.on('ar_kill', (data: { killerId: string; victimId: string; xp: number }) => {
      if (arEventQueueRef.current.length < AR_EVENT_QUEUE_MAX) {
        arEventQueueRef.current.push({ type: 'kill', data });
      }
    });

    socket.on('ar_phase_change', (data: { phase: ARPhase }) => {
      setArUiState(prev => ({ ...prev, phase: data.phase }));
    });

    socket.on('ar_battle_end', (data: ARBattleRewards) => {
      setArUiState(prev => ({ ...prev, battleEnd: data }));
    });

    socket.on('ar_miniboss_death', (data: { minibossType: string; x: number; z: number }) => {
      if (arEventQueueRef.current.length < AR_EVENT_QUEUE_MAX) {
        arEventQueueRef.current.push({ type: 'miniboss_death', data });
      }
    });

    socket.on('ar_elite_explosion', (data: { x: number; z: number; radius: number }) => {
      if (arEventQueueRef.current.length < AR_EVENT_QUEUE_MAX) {
        arEventQueueRef.current.push({ type: 'elite_explosion', data });
      }
    });

    socket.on('ar_pvp_kill', (data: ARPvPKillEvent) => {
      if (arEventQueueRef.current.length < AR_EVENT_QUEUE_MAX) {
        arEventQueueRef.current.push({ type: 'pvp_kill', data });
      }
    });

    socket.on('ar_boss_spawn', (data: { bossType: string }) => {
      if (arEventQueueRef.current.length < AR_EVENT_QUEUE_MAX) {
        arEventQueueRef.current.push({ type: 'boss_spawn', data });
      }
    });

    socket.on('ar_boss_defeated', (data: { bossType: string; factionId: string }) => {
      if (arEventQueueRef.current.length < AR_EVENT_QUEUE_MAX) {
        arEventQueueRef.current.push({ type: 'boss_defeated', data });
      }
    });

    socket.on('death', (data: DeathPayload) => {
      dataRef.current.alive = false;
      dataRef.current.deathInfo = data;
      dataRef.current.levelUp = null;
      // v11: 1-life mode — enter spectating on death (no respawn)
      setUiState(prev => ({ ...prev, alive: false, deathInfo: data, levelUp: null, isSpectating: true }));
    });

    socket.on('respawned', () => {
      dataRef.current.alive = true;
      dataRef.current.deathInfo = null;
      setUiState(prev => ({ ...prev, alive: true, deathInfo: null }));
    });

    socket.on('kill', (data: KillPayload) => {
      dataRef.current.killFeed = [data, ...dataRef.current.killFeed].slice(0, 5);
    });

    socket.on('minimap', (data: MinimapPayload) => {
      dataRef.current.minimap = data;
    });

    socket.on('pong', (data: { t: number; st: number }) => {
      dataRef.current.rtt = Date.now() - data.t;
    });

    // ─── Room 이벤트 ───

    socket.on('rooms_update', (data: { rooms: RoomInfo[]; recentWinners: RecentWinner[] }) => {
      // v17: Extract active conflict countries (playing/countdown/ending rooms with countryIso3)
      const conflicts = new Set<string>();
      for (const room of data.rooms) {
        if (room.countryIso3 && (room.state === 'playing' || room.state === 'countdown' || room.state === 'ending')) {
          conflicts.add(room.countryIso3);
        }
      }

      setUiState(prev => ({
        ...prev,
        rooms: data.rooms,
        recentWinners: data.recentWinners ?? [],
        activeConflictCountries: conflicts,
      }));
      // 현재 룸의 timeRemaining 업데이트
      if (dataRef.current.currentRoomId) {
        const myRoom = data.rooms.find(r => r.id === dataRef.current.currentRoomId);
        if (myRoom) {
          dataRef.current.timeRemaining = myRoom.timeRemaining;
          dataRef.current.roomState = myRoom.state;
          setUiState(prev => ({
            ...prev,
            timeRemaining: myRoom.timeRemaining,
            roomState: myRoom.state,
          }));
        }
      }
    });

    // v11: 국가 상태 1Hz 브로드캐스트 (WorldManager → lobby)
    socket.on('countries_state', (data: Array<{
      iso3: string;
      battleStatus: string;
      sovereignFaction: string;
      sovereigntyLevel: number;
      activeAgents: number;
      spectatorCount: number;
      maxAgents?: number;
      population?: number;
    }>) => {
      setUiState(prev => {
        const next = new Map(prev.countryStates);
        for (const cs of data) {
          const existing = next.get(cs.iso3);
          if (existing) {
            // 서버 데이터로 동적 필드 업데이트 (정적 필드 유지)
            next.set(cs.iso3, {
              ...existing,
              battleStatus: cs.battleStatus as CountryClientState['battleStatus'],
              sovereignFaction: cs.sovereignFaction,
              sovereigntyLevel: cs.sovereigntyLevel,
              activeAgents: cs.activeAgents,
              maxAgents: cs.maxAgents ?? existing.maxAgents,
              population: cs.population ?? existing.population,
            });
          } else {
            // 새로운 국가 — 최소 데이터로 생성 (GeoJSON fallback이 이후 보강)
            next.set(cs.iso3, {
              iso3: cs.iso3,
              name: cs.iso3,
              continent: '',
              tier: 'C',
              sovereignFaction: cs.sovereignFaction,
              sovereigntyLevel: cs.sovereigntyLevel,
              gdp: 0,
              battleStatus: cs.battleStatus as CountryClientState['battleStatus'],
              activeAgents: cs.activeAgents,
              resources: { oil: 0, minerals: 0, food: 0, tech: 0, manpower: 0 },
              latitude: 0,
              longitude: 0,
              capitalName: '',
              terrainTheme: 'plains',
              maxAgents: cs.maxAgents ?? 0,
              population: cs.population ?? 0,
            });
          }
        }
        // v17: countries_state에서 activeConflictCountries 추출
        const conflicts = new Set<string>();
        for (const cs of data) {
          if (cs.battleStatus === 'in_battle' || cs.battleStatus === 'preparing') {
            conflicts.add(cs.iso3);
          }
        }
        // 기존 countryStates에서도 활성 전투 국가 포함
        for (const [iso3, state] of next) {
          if (state.battleStatus === 'in_battle' || state.battleStatus === 'preparing') {
            conflicts.add(iso3);
          }
        }

        return { ...prev, countryStates: next, activeConflictCountries: conflicts };
      });
    });

    socket.on('round_start', (data: { countdown: number }) => {
      dataRef.current.roomState = data.countdown > 0 ? 'countdown' : 'playing';
      setUiState(prev => ({
        ...prev,
        roomState: data.countdown > 0 ? 'countdown' : 'playing',
        countdown: data.countdown > 0 ? data.countdown : null,
        roundEnd: null,
      }));
    });

    socket.on('round_end', (data: RoundEndPayload) => {
      dataRef.current.roomState = 'ending';
      setUiState(prev => ({
        ...prev,
        roomState: 'ending',
        roundEnd: data,
        countdown: null,
      }));
    });

    socket.on('round_reset', (data: { roomState: RoomStatus }) => {
      dataRef.current.roomState = data.roomState;
      dataRef.current.alive = false;
      dataRef.current.latestState = null;
      dataRef.current.prevState = null;
      dataRef.current.deathInfo = null;
      dataRef.current.levelUp = null;
      dataRef.current.arenaShrink = null;
      dataRef.current.synergyPopups = [];
      setUiState(prev => ({
        ...prev,
        roomState: data.roomState,
        alive: false,
        deathInfo: null,
        roundEnd: null,
        countdown: null,
        levelUp: null,
        arenaShrink: null,
        synergyPopups: [],
        coachMessage: null,
        roundAnalysis: null,
        isSpectating: false,
        battleComplete: null,
        epoch: null,
        epochResult: null,
        respawnState: null,
        warCountdown: null,
        damageEvents: [],
        capturePoints: [],
        epochScoreboard: [],
      }));
    });

    // ─── v10 업그레이드 시스템 이벤트 ───

    socket.on('level_up', (data: LevelUpPayload) => {
      dataRef.current.levelUp = data;
      setUiState(prev => ({ ...prev, levelUp: data }));
    });

    socket.on('arena_shrink', (data: ArenaShrinkPayload) => {
      dataRef.current.arenaShrink = data;
      setUiState(prev => ({ ...prev, arenaShrink: data }));
    });

    socket.on('synergy_activated', (data: SynergyActivatedPayload) => {
      dataRef.current.synergyPopups = [...dataRef.current.synergyPopups, data];
      setUiState(prev => ({
        ...prev,
        synergyPopups: [...prev.synergyPopups, data],
      }));
    });

    // ─── Phase 5: Coach + Analyst (준비) ───

    socket.on('coach_message', (data: CoachMessageData) => {
      setUiState(prev => ({ ...prev, coachMessage: data }));
    });

    socket.on('round_analysis', (data: RoundAnalysisData) => {
      setUiState(prev => ({ ...prev, roundAnalysis: data }));
    });

    // v11: battle complete — cooldown ended, return to lobby
    socket.on('battle_complete', (data: BattleCompletePayload) => {
      setUiState(prev => ({ ...prev, battleComplete: data }));
    });

    // ─── v14: Epoch 이벤트 ───

    socket.on('epoch_start', (data: EpochStartPayload) => {
      setUiState(prev => ({
        ...prev,
        epoch: {
          epochNumber: data.epochNumber,
          phase: data.phase,
          timeRemaining: data.durationSec,
          phaseTimeRemaining: data.peaceDurationSec,
          pvpEnabled: false,
          nationScores: {},
        },
        epochResult: null,
        warCountdown: null,
      }));
    });

    socket.on('epoch_end', (data: EpochEndPayload) => {
      setUiState(prev => ({
        ...prev,
        epochResult: data,
        epoch: prev.epoch ? { ...prev.epoch, phase: 'end' as EpochPhase } : null,
      }));
    });

    socket.on('war_phase_start', (data: WarPhaseStartPayload) => {
      setUiState(prev => ({
        ...prev,
        epoch: prev.epoch ? {
          ...prev.epoch,
          phase: 'war' as EpochPhase,
          pvpEnabled: true,
          phaseTimeRemaining: data.warDurationSec,
        } : null,
        warCountdown: null,
      }));
    });

    socket.on('war_phase_end', (_data: WarPhaseEndPayload) => {
      setUiState(prev => ({
        ...prev,
        epoch: prev.epoch ? { ...prev.epoch, pvpEnabled: false } : null,
      }));
    });

    // ─── v14: Respawn 이벤트 ───

    socket.on('respawn_countdown', (data: RespawnCountdownPayload) => {
      setUiState(prev => ({
        ...prev,
        respawnState: { countdown: data.secondsLeft, isRespawning: false, invincibleSec: 0 },
      }));
    });

    socket.on('respawn_complete', (data: RespawnCompletePayload) => {
      dataRef.current.alive = true;
      dataRef.current.deathInfo = null;
      setUiState(prev => ({
        ...prev,
        alive: true,
        deathInfo: null,
        isSpectating: false,
        respawnState: { countdown: 0, isRespawning: true, invincibleSec: data.invincibleSec },
      }));
      setTimeout(() => {
        setUiState(prev => ({
          ...prev,
          respawnState: prev.respawnState ? { ...prev.respawnState, isRespawning: false } : null,
        }));
      }, 2000);
    });

    socket.on('nation_score_update', (data: NationScoreUpdatePayload) => {
      setUiState(prev => ({
        ...prev,
        epoch: prev.epoch ? {
          ...prev.epoch,
          nationScores: data.nationScores,
          phase: data.phase,
          timeRemaining: data.timeRemaining,
        } : null,
      }));
    });

    // ─── v14: Weapon VFX + Damage Numbers ───

    socket.on('damage_dealt', (data: WeaponDamageEvent) => {
      setUiState(prev => ({
        ...prev,
        damageEvents: [...prev.damageEvents, data].slice(-64), // 최근 64개만 유지
      }));
      // 3초 후 자동 제거 (렌더러 자체 만료와 이중 안전장치)
      setTimeout(() => {
        setUiState(prev => ({
          ...prev,
          damageEvents: prev.damageEvents.filter(e => e !== data),
        }));
      }, 3000);
    });

    // ─── v14: Capture Points ───

    socket.on('capture_point_update', (data: { capturePoints: CapturePointData[] }) => {
      setUiState(prev => ({ ...prev, capturePoints: data.capturePoints }));
    });

    // ─── v14: War countdown (전쟁 시작 3-2-1 카운트다운) ───

    socket.on('war_siren', (data: WarSirenPayload) => {
      setUiState(prev => ({ ...prev, warCountdown: data.sirenSeconds }));
    });

    // ─── v14: War system events (Globe 전쟁 이펙트) ───

    socket.on('war_declared', (data: WarDeclaredPayload) => {
      setUiState(prev => {
        const newWar: WarEffectData = {
          warId: data.warId,
          state: data.state === 'preparation' ? 'preparation' : 'active',
          attacker: data.attacker,
          defender: data.defender,
          attackerScore: 0,
          defenderScore: 0,
        };
        return {
          ...prev,
          wars: [...prev.wars.filter(w => w.warId !== data.warId), newWar],
        };
      });
    });

    socket.on('war_score_update', (data: WarScoreUpdatePayload) => {
      setUiState(prev => ({
        ...prev,
        wars: prev.wars.map(w =>
          w.warId === data.warId
            ? { ...w, state: 'active' as const, attackerScore: data.attackerScore, defenderScore: data.defenderScore }
            : w,
        ),
      }));
    });

    socket.on('war_ended', (data: WarEndedPayload) => {
      setUiState(prev => ({
        ...prev,
        wars: prev.wars.map(w =>
          w.warId === data.warId
            ? {
                ...w,
                state: 'ended' as const,
                attackerScore: data.attackerScore,
                defenderScore: data.defenderScore,
                outcome: data.outcome as WarEffectData['outcome'],
                winner: data.winner,
              }
            : w,
        ),
      }));
      // 전쟁 종료 이펙트 5초 후 제거
      setTimeout(() => {
        setUiState(prev => ({
          ...prev,
          wars: prev.wars.filter(w => w.warId !== data.warId),
        }));
      }, 5000);
    });

    socket.on('war_snapshot', (data: WarSnapshotPayload) => {
      setUiState(prev => ({
        ...prev,
        wars: data.wars.map(w => ({
          warId: w.warId,
          state: w.state as WarEffectData['state'],
          attacker: w.attacker,
          defender: w.defender,
          attackerScore: w.attackerScore,
          defenderScore: w.defenderScore,
        })),
      }));
    });

    // ─── v14: Domination updates (Globe 지배 색상) ───

    socket.on('domination_update', (data: { countries: ServerDominationData[] }) => {
      setUiState(prev => {
        const next = new Map(prev.dominationStates);
        for (const d of data.countries) {
          const existing = next.get(d.countryCode);
          next.set(d.countryCode, {
            iso3: d.countryCode,
            dominantNation: d.dominantNation,
            level: d.status,
            color: '',  // GlobeDominationLayer의 getNationColor가 처리
            transitionProgress: existing ? 0 : 1,
            previousColor: existing?.color ?? '',
            // v15 Phase 3: 분쟁 상태 + 이전 레벨 추적
            contested: d.contested ?? false,
            previousLevel: existing?.level ?? 'none',
          });
        }
        return { ...prev, dominationStates: next };
      });
    });

    // ─── v15: Server error events (arena_full, join_failed, etc.) ───

    socket.on('error', (data: { code: string; message: string }) => {
      setUiState(prev => ({ ...prev, lastError: data }));
      // 5초 후 자동 클리어
      setTimeout(() => {
        setUiState(prev => prev.lastError === data ? { ...prev, lastError: null } : prev);
      }, 5000);
    });

    // ─── v15: Trade route updates (실시간 거래 시각화) ───

    socket.on('trade_route_update', (data: { from: string; to: string; type: string; volume: number; resource: string }) => {
      const route: TradeRouteData = {
        from: data.from,
        to: data.to,
        type: data.type as 'sea' | 'land',
        volume: data.volume,
        resource: data.resource,
        timestamp: Date.now(),
      };
      setUiState(prev => ({
        ...prev,
        tradeRoutes: [...prev.tradeRoutes, route].slice(-100), // 최근 100개만 유지
      }));
      // 30초 후 자동 만료
      setTimeout(() => {
        setUiState(prev => ({
          ...prev,
          tradeRoutes: prev.tradeRoutes.filter(r => r !== route),
        }));
      }, 30000);
    });

    // ─── v14: Global events (EventTicker / NewsFeed) ───

    socket.on('global_event', (data: { type: string; message: string }) => {
      const event = {
        id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        type: data.type,
        message: data.message,
        timestamp: Date.now(),
      };
      setUiState(prev => ({
        ...prev,
        globalEvents: [...prev.globalEvents, event].slice(-50), // 최근 50개만 유지
      }));
    });

    // ─── v14: Epoch scoreboard (전체 플레이어 데이터) ───

    socket.on('epoch_scoreboard', (data: EpochScoreboardPayload) => {
      setUiState(prev => ({ ...prev, epochScoreboard: data.players }));
    });

    // WebSocket 연결 시작 (ping은 GameSocket 내부에서 처리)
    socket.connect(SERVER_URL);

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // ─── 액션 함수 ───

  const joinRoom = useCallback((roomId: string, name: string, skinId?: number, appearance?: string) => {
    socketRef.current?.emit('join_room', { roomId, name, skinId, appearance });
  }, []);

  const leaveRoom = useCallback(() => {
    socketRef.current?.emit('leave_room', {});
    dataRef.current.currentRoomId = null;
    dataRef.current.roomState = null;
    dataRef.current.alive = false;
    dataRef.current.playerId = null;
    dataRef.current.latestState = null;
    dataRef.current.prevState = null;
    dataRef.current.deathInfo = null;
    dataRef.current.killFeed = [];
    dataRef.current.levelUp = null;
    dataRef.current.arenaShrink = null;
    dataRef.current.synergyPopups = [];
    dataRef.current.arState = null;
    // v19: Clear AR pipeline on leave
    arStateRef.current = null;
    arEventQueueRef.current = [];
    setArUiState(INITIAL_AR_UI_STATE);
    setUiState(prev => ({
      ...prev,
      currentRoomId: null,
      roomState: null,
      alive: false,
      deathInfo: null,
      roundEnd: null,
      countdown: null,
      levelUp: null,
      arenaShrink: null,
      synergyPopups: [],
      coachMessage: null,
      roundAnalysis: null,
      terrainTheme: null,
      isSpectating: false,
      battleComplete: null,
      arenaSettings: null,
      epoch: null,
      epochResult: null,
      respawnState: null,
      warCountdown: null,
      damageEvents: [],
      capturePoints: [],
      epochScoreboard: [],
    }));
  }, []);

  const sendInput = useCallback((angle: number, boost: boolean, seq: number, dash?: boolean) => {
    socketRef.current?.emit('input', {
      a: angle,
      b: boost ? 1 : 0,
      s: seq,
      ...(dash ? { d: 1 } : {}),
    });
  }, []);

  /** v16: 이동/조준 분리 입력 전송 (WASD + 마우스) */
  const sendInputV16 = useCallback((
    moveAngle: number | null,
    aimAngle: number,
    boost: boolean,
    seq: number,
    dash?: boolean,
    jump?: boolean,
  ) => {
    socketRef.current?.emit('input', {
      ...(moveAngle !== null ? { ma: Math.round(moveAngle * 100) / 100 } : { a: aimAngle }),
      aa: Math.round(aimAngle * 100) / 100,
      b: boost ? 1 : 0,
      s: seq,
      ...(dash ? { d: 1 } : {}),
      ...(jump ? { j: 1 } : {}),
    });
  }, []);

  const respawn = useCallback((name?: string, skinId?: number, appearance?: string) => {
    socketRef.current?.emit('respawn', { name, skinId, appearance });
  }, []);

  const disconnect = useCallback(() => {
    socketRef.current?.disconnect();
  }, []);

  /** v10: 레벨업 업그레이드 선택 */
  const chooseUpgrade = useCallback((choiceId: string) => {
    socketRef.current?.emit('choose_upgrade', { choiceId });
    dataRef.current.levelUp = null;
    setUiState(prev => ({ ...prev, levelUp: null }));
  }, []);

  /** v10: 시너지 팝업 닫기 */
  const dismissSynergyPopup = useCallback((synergyId: string) => {
    dataRef.current.synergyPopups = dataRef.current.synergyPopups.filter(s => s.synergyId !== synergyId);
    setUiState(prev => ({
      ...prev,
      synergyPopups: prev.synergyPopups.filter(s => s.synergyId !== synergyId),
    }));
  }, []);

  /** v10 Phase 4: 트레이닝 프로필 설정 */
  const setTrainingProfile = useCallback((agentId: string, profile: any) => {
    socketRef.current?.emit('set_training_profile', { agentId, profile });
  }, []);

  /** v14: 국적 선택 */
  const selectNationality = useCallback((nationality: string) => {
    socketRef.current?.emit('select_nationality', { nationality });
    setUiState(prev => ({ ...prev, nationality }));
  }, []);

  /** v14: 국가 아레나 참가 */
  const joinCountryArena = useCallback((
    countryCode: string,
    name: string,
    nationality: string,
    skinId?: number,
    appearance?: string,
  ) => {
    socketRef.current?.emit('join_country_arena', {
      countryCode,
      name,
      skinId,
      appearance,
      nationality,
    });
  }, []);

  /** v14: 에포크 결과 닫기 */
  const dismissEpochResult = useCallback(() => {
    setUiState(prev => ({ ...prev, epochResult: null }));
  }, []);

  /** v14 S36: 아레나 전환 (소켓 유지, room만 변경) */
  const switchArena = useCallback((
    newCountryCode: string,
    name: string,
    nationality: string,
    skinId?: number,
    appearance?: string,
  ) => {
    // Leave current room first (server-side cleanup)
    socketRef.current?.emit('leave_room', {});
    // Clear local game state but keep connection
    dataRef.current.currentRoomId = null;
    dataRef.current.roomState = null;
    dataRef.current.alive = false;
    dataRef.current.latestState = null;
    dataRef.current.prevState = null;
    dataRef.current.deathInfo = null;
    dataRef.current.killFeed = [];
    dataRef.current.levelUp = null;
    dataRef.current.arenaShrink = null;
    dataRef.current.synergyPopups = [];
    // Immediately join new arena (same socket)
    socketRef.current?.emit('join_country_arena', {
      countryCode: newCountryCode,
      name,
      skinId,
      appearance,
      nationality,
    });
    setUiState(prev => ({
      ...prev,
      currentRoomId: null,
      roomState: null,
      alive: false,
      deathInfo: null,
      roundEnd: null,
      countdown: null,
      levelUp: null,
      arenaShrink: null,
      synergyPopups: [],
      coachMessage: null,
      roundAnalysis: null,
      isSpectating: false,
      battleComplete: null,
      epochResult: null,
      respawnState: null,
      warCountdown: null,
      damageEvents: [],
      capturePoints: [],
      epochScoreboard: [],
    }));
  }, []);

  /** v19: AR 토메/무기 선택 (레벨업 시 ar_choose emit) */
  const sendARChoice = useCallback((choice: ARChoice) => {
    socketRef.current?.emit('ar_choose', choice);
    // Clear level-up choices after selection
    setArUiState(prev => ({ ...prev, levelUpChoices: null }));
  }, []);

  return {
    dataRef,
    uiState,
    joinRoom,
    leaveRoom,
    sendInput,
    sendInputV16,
    respawn,
    disconnect,
    chooseUpgrade,
    dismissSynergyPopup,
    setTrainingProfile,
    selectNationality,
    joinCountryArena,
    dismissEpochResult,
    switchArena,
    // v19: AR data pipeline
    arStateRef,
    arEventQueueRef,
    arUiState,
    sendARChoice,
  };
}
