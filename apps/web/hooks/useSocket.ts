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
  AgentNetworkData,
} from '@agent-survivor/shared';
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
      setUiState(prev => ({ ...prev, alive: false, deathInfo: data, levelUp: null }));
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
  };
}
