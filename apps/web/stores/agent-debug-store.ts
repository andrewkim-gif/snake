/**
 * Agent Debug Store — 에이전트 타입별 토글 + 서버 시스템 제어
 *
 * 디버그 패널에서 각 에이전트 시스템을 개별적으로 켜고/끌 수 있다.
 * 기본값은 모두 false (디버그/개발 시 수동으로 켜서 사용).
 * non-React 코드에서도 getState()로 직접 접근 가능.
 */

import { create } from 'zustand';

// ─── 서버 URL ───

const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:8000';

// ─── 서버 시스템 타입 ───

export interface IServerSystem {
  id: string;
  label: string;
  enabled: boolean;
}

// ─── State 타입 ───

interface IAgentDebugState {
  // 클라이언트 토글 (제어 가능)
  llmChatEnabled: boolean;
  combatAiEnabled: boolean;
  arenaBotsEnabled: boolean;

  // 읽기 전용 상태
  wsConnected: boolean;
  nationAgentStatus: 'unknown' | 'running' | 'stopped';

  // 실시간 통계
  activeBotCount: number;
  chatMessageCount: number;
  wsLatency: number;

  // 패널 열림 상태
  panelOpen: boolean;

  // 서버 시스템 상태
  serverSystems: IServerSystem[];
  serverOnline: boolean;
  serverLoading: boolean;
}

interface IAgentDebugActions {
  toggleLlmChat: () => void;
  toggleCombatAi: () => void;
  toggleArenaBots: () => void;
  setWsConnected: (v: boolean) => void;
  setWsLatency: (ms: number) => void;
  setActiveBotCount: (n: number) => void;
  setChatMessageCount: (n: number) => void;
  setPanelOpen: (v: boolean) => void;
  togglePanel: () => void;

  // 서버 시스템 제어
  fetchServerSystems: () => Promise<void>;
  toggleServerSystem: (id: string) => Promise<void>;
  toggleAllServerSystems: (enabled: boolean) => Promise<void>;
}

export const useAgentDebugStore = create<IAgentDebugState & IAgentDebugActions>(
  (set, get) => ({
    // 기본값: 모두 비활성 (F2 디버그 패널에서 수동 활성화)
    llmChatEnabled: false,
    combatAiEnabled: false,
    arenaBotsEnabled: false,

    wsConnected: false,
    nationAgentStatus: 'unknown',

    activeBotCount: 0,
    chatMessageCount: 0,
    wsLatency: 0,

    panelOpen: false,

    // 서버 시스템 기본값
    serverSystems: [],
    serverOnline: false,
    serverLoading: false,

    toggleLlmChat: () => set((s) => ({ llmChatEnabled: !s.llmChatEnabled })),
    toggleCombatAi: () => set((s) => ({ combatAiEnabled: !s.combatAiEnabled })),
    toggleArenaBots: () => set((s) => ({ arenaBotsEnabled: !s.arenaBotsEnabled })),
    setWsConnected: (v) => set({ wsConnected: v }),
    setWsLatency: (ms) => set({ wsLatency: ms }),
    setActiveBotCount: (n) => set({ activeBotCount: n }),
    setChatMessageCount: (n) => set({ chatMessageCount: n }),
    setPanelOpen: (v) => set({ panelOpen: v }),
    togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),

    // ─── 서버 시스템 제어 ───

    fetchServerSystems: async () => {
      set({ serverLoading: true });
      try {
        const res = await fetch(`${SERVER_URL}/api/v1/debug/systems`, {
          signal: AbortSignal.timeout(3000),
        });
        if (!res.ok) throw new Error(`${res.status}`);
        const data = (await res.json()) as { systems: IServerSystem[] };
        set({ serverSystems: data.systems, serverOnline: true });
      } catch {
        set({ serverOnline: false, serverSystems: [] });
      } finally {
        set({ serverLoading: false });
      }
    },

    toggleServerSystem: async (id: string) => {
      const { serverSystems } = get();
      const target = serverSystems.find((s) => s.id === id);
      if (!target) return;
      const newEnabled = !target.enabled;

      // 옵티미스틱 업데이트
      set({
        serverSystems: serverSystems.map((s) =>
          s.id === id ? { ...s, enabled: newEnabled } : s,
        ),
      });

      try {
        const res = await fetch(
          `${SERVER_URL}/api/v1/debug/systems/${id}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: newEnabled }),
            signal: AbortSignal.timeout(3000),
          },
        );
        if (!res.ok) throw new Error(`${res.status}`);
      } catch {
        // 롤백
        set({
          serverSystems: serverSystems.map((s) =>
            s.id === id ? { ...s, enabled: !newEnabled } : s,
          ),
        });
      }
    },

    toggleAllServerSystems: async (enabled: boolean) => {
      const { serverSystems } = get();

      // 옵티미스틱 업데이트
      set({
        serverSystems: serverSystems.map((s) => ({ ...s, enabled })),
      });

      try {
        const res = await fetch(
          `${SERVER_URL}/api/v1/debug/systems/all`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled }),
            signal: AbortSignal.timeout(3000),
          },
        );
        if (!res.ok) throw new Error(`${res.status}`);
        // 서버에서 최신 상태 다시 가져오기
        await get().fetchServerSystems();
      } catch {
        // 롤백
        set({ serverSystems });
      }
    },
  }),
);
