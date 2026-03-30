/**
 * Agent Debug Store — 에이전트 타입별 토글 + 실시간 통계
 *
 * 디버그 패널에서 각 에이전트 시스템을 개별적으로 켜고/끌 수 있다.
 * 기본값은 모두 true (기존 동작 유지).
 * non-React 코드에서도 getState()로 직접 접근 가능.
 */

import { create } from 'zustand';

// ─── State 타입 ───

interface IAgentDebugState {
  // 토글 (제어 가능)
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
}

export const useAgentDebugStore = create<IAgentDebugState & IAgentDebugActions>(
  (set) => ({
    // 기본값: 모두 활성 (기존 동작 유지)
    llmChatEnabled: true,
    combatAiEnabled: true,
    arenaBotsEnabled: true,

    wsConnected: false,
    nationAgentStatus: 'unknown',

    activeBotCount: 0,
    chatMessageCount: 0,
    wsLatency: 0,

    panelOpen: false,

    toggleLlmChat: () => set((s) => ({ llmChatEnabled: !s.llmChatEnabled })),
    toggleCombatAi: () => set((s) => ({ combatAiEnabled: !s.combatAiEnabled })),
    toggleArenaBots: () => set((s) => ({ arenaBotsEnabled: !s.arenaBotsEnabled })),
    setWsConnected: (v) => set({ wsConnected: v }),
    setWsLatency: (ms) => set({ wsLatency: ms }),
    setActiveBotCount: (n) => set({ activeBotCount: n }),
    setChatMessageCount: (n) => set({ chatMessageCount: n }),
    setPanelOpen: (v) => set({ panelOpen: v }),
    togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
  }),
);
