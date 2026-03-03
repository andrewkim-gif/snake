'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type {
  ClientToServerEvents, ServerToClientEvents,
  StatePayload, JoinedPayload, DeathPayload,
  KillPayload, MinimapPayload,
  LeaderboardEntry,
} from '@snake-arena/shared';

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001';

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
  };
}

export function useSocket() {
  const socketRef = useRef<GameSocket | null>(null);
  const dataRef = useRef<GameData>(createInitialData());

  const [uiState, setUiState] = useState({
    connected: false,
    alive: false,
    deathInfo: null as DeathPayload | null,
  });

  useEffect(() => {
    // 마운트 시 데이터 완전 초기화
    dataRef.current = createInitialData();

    const socket: GameSocket = io(SERVER_URL, {
      transports: ['websocket', 'polling'], // WebSocket 실패 시 polling fallback
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      reconnectionAttempts: 5,
      timeout: 5000,
      forceNew: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      dataRef.current.connected = true;
      setUiState(prev => ({ ...prev, connected: true }));
    });

    socket.on('disconnect', () => {
      dataRef.current.connected = false;
      dataRef.current.alive = false;
      setUiState(prev => ({ ...prev, connected: false, alive: false }));
    });

    socket.on('connect_error', () => {
      dataRef.current.connected = false;
    });

    socket.io.on('reconnect_failed', () => {
      dataRef.current.connected = false;
      setUiState(prev => ({ ...prev, connected: false }));
    });

    socket.on('joined', (data: JoinedPayload) => {
      dataRef.current.playerId = data.id;
      dataRef.current.alive = true;
      dataRef.current.deathInfo = null;
      setUiState(prev => ({ ...prev, alive: true, deathInfo: null }));
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
      setUiState(prev => ({ ...prev, alive: false, deathInfo: data }));
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

    socket.on('pong', (data) => {
      dataRef.current.rtt = Date.now() - data.t;
    });

    const pingInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit('ping', { t: Date.now() });
      }
    }, 5000);

    return () => {
      clearInterval(pingInterval);
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const join = useCallback((name: string, skinId?: number) => {
    socketRef.current?.emit('join', { name, skinId });
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

  return { dataRef, uiState, join, sendInput, respawn, disconnect };
}
