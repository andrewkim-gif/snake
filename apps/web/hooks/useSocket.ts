'use client';

/**
 * useSocket — 게임 서버 연결 + 상태 관리 훅
 * v10: Socket.IO → Native WebSocket (GameSocket 어댑터)
 * v10: snake → agent 리네이밍 완료
 * v10: level_up, synergy_activated, arena_shrink 이벤트 추가
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import { GameSocket } from './useWebSocket';
import type {
  StatePayload, JoinedPayload, DeathPayload,
  KillPayload, MinimapPayload, RoomInfo, RecentWinner,
  RoomStatus, RoundEndPayload, LeaderboardEntry,
  LevelUpPayload, ArenaShrinkPayload, SynergyActivatedPayload,
  AgentNetworkData, BattleCompletePayload,
  EpochStartPayload, EpochEndPayload,
  WarPhaseStartPayload, WarPhaseEndPayload,
  RespawnCountdownPayload, RespawnCompletePayload,
  NationScoreUpdatePayload, EpochPhase,
  WeaponDamageEvent,
  WarDeclaredPayload, WarEndedPayload, WarScoreUpdatePayload,
  WarSnapshotPayload, WarSirenPayload,
  EpochScoreboardPayload, EpochScoreboardEntry,
} from '@agent-survivor/shared';
import type { CapturePointData } from '@/components/3d/CapturePointRenderer';
import type { WarEffectData } from '@/components/3d/GlobeWarEffects';
import type { ServerDominationData } from '@/components/3d/GlobeDominationLayer';
import type { CountryDominationState } from '@/components/3d/GlobeDominationLayer';
import type { CountryClientState } from '@/lib/globe-data';

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:8000';

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
}

export function useSocket() {
  const socketRef = useRef<GameSocket | null>(null);
  const dataRef = useRef<GameData>(createInitialData());

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
      setUiState(prev => ({
        ...prev, alive: true, deathInfo: null, roundEnd: null,
        currentRoomId: data.roomId, roomState: data.roomState,
        timeRemaining: data.timeRemaining,
        terrainTheme: data.terrainTheme ?? null,
        isSpectating: false,
        battleComplete: null,
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
      setUiState(prev => ({
        ...prev,
        rooms: data.rooms,
        recentWinners: data.recentWinners ?? [],
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
            });
          }
        }
        return { ...prev, countryStates: next };
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
          });
        }
        return { ...prev, dominationStates: next };
      });
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
      epoch: null,
      epochResult: null,
      respawnState: null,
      warCountdown: null,
      damageEvents: [],
      capturePoints: [],
      epochScoreboard: [],
    }));
  }, []);

  const sendInput = useCallback((angle: number, boost: boolean, seq: number) => {
    socketRef.current?.emit('input', { a: angle, b: boost ? 1 : 0, s: seq });
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

  return {
    dataRef,
    uiState,
    joinRoom,
    leaveRoom,
    sendInput,
    respawn,
    disconnect,
    chooseUpgrade,
    dismissSynergyPopup,
    setTrainingProfile,
    selectNationality,
    joinCountryArena,
    dismissEpochResult,
    switchArena,
  };
}
