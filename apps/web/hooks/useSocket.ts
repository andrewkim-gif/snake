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

/**
 * 게임 데이터 — ref 기반 (React render cycle 밖)
 * 20Hz state 업데이트가 re-render를 유발하지 않음
 */
export interface GameData {
  connected: boolean;
  playerId: string | null;
  alive: boolean;
  latestState: StatePayload | null;
  prevState: StatePayload | null;
  stateTimestamp: number;       // 최신 state 도착 시간 (performance.now)
  prevStateTimestamp: number;   // 이전 state 도착 시간
  leaderboard: LeaderboardEntry[];
  minimap: MinimapPayload | null;
  deathInfo: DeathPayload | null;
  killFeed: KillPayload[];
  rtt: number;
}

export function useSocket() {
  const socketRef = useRef<GameSocket | null>(null);

  // 게임 데이터는 ref로 관리 (re-render 방지)
  const dataRef = useRef<GameData>({
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
  });

  // UI 업데이트가 필요한 것만 React state (death overlay, connection)
  const [uiState, setUiState] = useState({
    connected: false,
    alive: false,
    deathInfo: null as DeathPayload | null,
  });

  useEffect(() => {
    const socket: GameSocket = io(SERVER_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
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

    socket.on('joined', (data: JoinedPayload) => {
      dataRef.current.playerId = data.id;
      dataRef.current.alive = true;
      dataRef.current.deathInfo = null;
      setUiState(prev => ({ ...prev, alive: true, deathInfo: null }));
    });

    // 20Hz — ref만 갱신, React re-render 안 함
    // 이전 상태 저장으로 보간 지원
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

    // 1Hz — ref만 갱신
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
      socket.disconnect();
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

  return { dataRef, uiState, join, sendInput, respawn };
}
