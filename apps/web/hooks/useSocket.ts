'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { GameSocket } from './useWebSocket';
import type {
  StatePayload, JoinedPayload, DeathPayload,
  KillPayload, MinimapPayload, RoomInfo, RecentWinner,
  RoomStatus, RoundEndPayload, LeaderboardEntry,
  LevelUpPayload, ArenaShrinkPayload, SynergyActivatedPayload,
} from '@snake-arena/shared';

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:9001';

// Coach message from server
export interface CoachMessageData {
  type: 'warning' | 'tip' | 'opportunity' | 'strategy' | 'efficiency';
  message: string;
}

// Round analysis from server
export interface RoundAnalysisData {
  buildEfficiency: number;
  combatScore: number;
  positioningScore: number;
  suggestions: string[];
}

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

    // Room events
    socket.on('rooms_update', (data: { rooms: RoomInfo[]; recentWinners: RecentWinner[] }) => {
      setUiState(prev => ({
        ...prev,
        rooms: data.rooms,
        recentWinners: data.recentWinners,
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

    socket.on('round_start', (data: { countdown: number }) => {
      dataRef.current.roomState = data.countdown > 0 ? 'countdown' : 'playing';
      setUiState(prev => ({
        ...prev,
        roomState: data.countdown > 0 ? 'countdown' : 'playing',
        countdown: data.countdown > 0 ? data.countdown : null,
        roundEnd: null,
      }));
      // 새 라운드 시작 시 자동 리스폰 (서버가 이미 새 arena에 등록해둠)
      if (data.countdown === 0) {
        socket.emit('respawn', {});
      }
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

    // v10 upgrade system events
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

    // Phase 5: Coach + Analyst events
    socket.on('coach_message', (data: CoachMessageData) => {
      setUiState(prev => ({ ...prev, coachMessage: data }));
    });

    socket.on('round_analysis', (data: RoundAnalysisData) => {
      setUiState(prev => ({ ...prev, roundAnalysis: data }));
    });

    const pingInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit('ping', { t: Date.now() });
      }
    }, 5000);

    // Socket.IO 연결 시작
    socket.connect(SERVER_URL);

    return () => {
      clearInterval(pingInterval);
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const joinRoom = useCallback((roomId: string, name: string, skinId?: number) => {
    socketRef.current?.emit('join_room', { roomId, name, skinId });
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

  const respawn = useCallback((name?: string, skinId?: number) => {
    socketRef.current?.emit('respawn', { name, skinId });
  }, []);

  const disconnect = useCallback(() => {
    socketRef.current?.disconnect();
  }, []);

  const chooseUpgrade = useCallback((choiceId: string) => {
    socketRef.current?.emit('choose_upgrade', { choiceId });
    dataRef.current.levelUp = null;
    setUiState(prev => ({ ...prev, levelUp: null }));
  }, []);

  const dismissSynergyPopup = useCallback((synergyId: string) => {
    dataRef.current.synergyPopups = dataRef.current.synergyPopups.filter(s => s.synergyId !== synergyId);
    setUiState(prev => ({
      ...prev,
      synergyPopups: prev.synergyPopups.filter(s => s.synergyId !== synergyId),
    }));
  }, []);

  return { dataRef, uiState, joinRoom, leaveRoom, sendInput, respawn, disconnect, chooseUpgrade, dismissSynergyPopup };
}
