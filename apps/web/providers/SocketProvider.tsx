'use client';

/**
 * SocketProvider — 전역 WebSocket 상태 Provider (v13 Phase 0)
 *
 * 기존 useSocket() 훅을 Context Provider로 래핑하여
 * 모든 라우트에서 소켓 연결 + 게임 상태에 접근 가능하게 한다.
 *
 * Dual-Layer Context:
 *   Layer 1 (Stable): connected, gameMode, currentRoomId → re-render 트리거
 *   Layer 2 (Ref): dataRef, uiStateRef, countryStatesRef → 60fps 읽기 (re-render 없음)
 */

import {
  createContext,
  useContext,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  useState,
} from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSocket } from '@/hooks/useSocket';
import type { GameData, UiState } from '@/hooks/useSocket';
import type { CountryClientState } from '@/lib/globe-data';

// ─── 게임 모드 타입 ───
export type GameMode = 'idle' | 'lobby' | 'transitioning' | 'playing';

// ─── Layer 1: Stable Context (변경 빈도 낮음 → re-render OK) ───
export interface SocketStableContextValue {
  connected: boolean;
  gameMode: GameMode;
  currentRoomId: string | null;

  // 액션 함수
  joinRoom: (roomId: string, name: string, skinId?: number, appearance?: string) => void;
  leaveRoom: () => void;
  sendInput: (angle: number, boost: boolean, seq: number) => void;
  respawn: (name?: string, skinId?: number, appearance?: string) => void;
  chooseUpgrade: (choiceId: string) => void;
  dismissSynergyPopup: (synergyId: string) => void;
  setTrainingProfile: (agentId: string, profile: any) => void;
  // v14: 국적 & 에포크
  selectNationality: (nationality: string) => void;
  joinCountryArena: (countryCode: string, name: string, nationality: string, skinId?: number, appearance?: string) => void;
  dismissEpochResult: () => void;
  // v14 S36: 아레나 전환 (소켓 유지)
  switchArena: (newCountryCode: string, name: string, nationality: string, skinId?: number, appearance?: string) => void;

  // 게임 모드 제어 (page.tsx에서 사용)
  setGameMode: (mode: GameMode) => void;
}

// ─── Layer 2: Ref Context (re-render 없는 60fps 읽기) ───
export interface SocketRefContextValue {
  dataRef: React.MutableRefObject<GameData>;
  uiStateRef: React.MutableRefObject<UiState>;
  countryStatesRef: React.MutableRefObject<Map<string, CountryClientState>>;
}

// ─── Legacy 호환: 기존 page.tsx 패턴과 동일한 전체 값 ───
export interface SocketContextValue extends SocketStableContextValue {
  dataRef: React.MutableRefObject<GameData>;
  uiState: UiState;
}

// ─── Context 생성 ───
const SocketStableContext = createContext<SocketStableContextValue | null>(null);
const SocketRefContext = createContext<SocketRefContextValue | null>(null);
// Legacy: 기존 page.tsx 패턴과 호환되는 단일 context
const SocketLegacyContext = createContext<SocketContextValue | null>(null);

// ─── Provider 컴포넌트 ───
export function SocketProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  // 기존 useSocket() 훅 — 변경 없이 그대로 사용
  const {
    dataRef,
    uiState,
    joinRoom,
    leaveRoom,
    sendInput,
    respawn,
    chooseUpgrade,
    dismissSynergyPopup,
    setTrainingProfile,
    selectNationality,
    joinCountryArena,
    dismissEpochResult,
    switchArena,
  } = useSocket();

  // ─── 게임 모드 상태 (전역화) ───
  const [gameMode, setGameMode] = useState<GameMode>('idle');

  // connected 상태에 따른 gameMode 자동 전환
  useEffect(() => {
    if (uiState.connected && gameMode === 'idle') {
      setGameMode('lobby');
    }
    if (!uiState.connected && gameMode !== 'idle') {
      setGameMode('idle');
    }
  }, [uiState.connected, gameMode]);

  // ─── Ref Layer (60fps 읽기용) ───
  const uiStateRef = useRef<UiState>(uiState);
  const countryStatesRef = useRef<Map<string, CountryClientState>>(uiState.countryStates);

  // uiState 변경 시 ref 동기화 (re-render 없이)
  useEffect(() => {
    uiStateRef.current = uiState;
    countryStatesRef.current = uiState.countryStates;
  }, [uiState]);

  // ─── 게임 시작 리디렉트: joined 이벤트 감지 시 → '/'로 자동 이동 ───
  useEffect(() => {
    if (uiState.currentRoomId && pathname !== '/') {
      router.push('/');
    }
  }, [uiState.currentRoomId, pathname, router]);

  // ─── Stable Context Value (메모이즈: 액션 함수는 stable) ───
  const stableValue = useMemo<SocketStableContextValue>(
    () => ({
      connected: uiState.connected,
      gameMode,
      currentRoomId: uiState.currentRoomId,
      joinRoom,
      leaveRoom,
      sendInput,
      respawn,
      chooseUpgrade,
      dismissSynergyPopup,
      setTrainingProfile,
      selectNationality,
      joinCountryArena,
      dismissEpochResult,
      switchArena,
      setGameMode,
    }),
    [
      uiState.connected,
      gameMode,
      uiState.currentRoomId,
      joinRoom,
      leaveRoom,
      sendInput,
      respawn,
      chooseUpgrade,
      dismissSynergyPopup,
      setTrainingProfile,
      selectNationality,
      joinCountryArena,
      dismissEpochResult,
      switchArena,
    ],
  );

  // ─── Ref Context Value (절대 변경 안 됨 → re-render 0) ───
  const refValue = useMemo<SocketRefContextValue>(
    () => ({
      dataRef,
      uiStateRef,
      countryStatesRef,
    }),
    [dataRef],
  );

  // ─── Legacy Context Value (page.tsx 호환) ───
  const legacyValue = useMemo<SocketContextValue>(
    () => ({
      ...stableValue,
      dataRef,
      uiState,
    }),
    [stableValue, dataRef, uiState],
  );

  return (
    <SocketStableContext.Provider value={stableValue}>
      <SocketRefContext.Provider value={refValue}>
        <SocketLegacyContext.Provider value={legacyValue}>
          {children}
        </SocketLegacyContext.Provider>
      </SocketRefContext.Provider>
    </SocketStableContext.Provider>
  );
}

// ─── 훅: Stable Context (허브 페이지용 — connected, gameMode 변경 시만 re-render) ───
export function useSocketStable(): SocketStableContextValue {
  const ctx = useContext(SocketStableContext);
  if (!ctx) throw new Error('useSocketStable must be used within <SocketProvider>');
  return ctx;
}

// ─── 훅: Ref Context (게임 루프용 — re-render 없이 ref 읽기) ───
export function useSocketRefs(): SocketRefContextValue {
  const ctx = useContext(SocketRefContext);
  if (!ctx) throw new Error('useSocketRefs must be used within <SocketProvider>');
  return ctx;
}

// ─── 훅: Legacy 호환 (page.tsx에서 기존 useSocket()과 동일한 인터페이스) ───
export function useSocketContext(): SocketContextValue {
  const ctx = useContext(SocketLegacyContext);
  if (!ctx) throw new Error('useSocketContext must be used within <SocketProvider>');
  return ctx;
}
