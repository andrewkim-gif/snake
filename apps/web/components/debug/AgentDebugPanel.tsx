'use client';

/**
 * AgentDebugPanel — 에이전트 타입별 제어 디버그 패널
 *
 * 우측 상단에 위치, F2로 토글.
 * 각 에이전트 시스템을 개별적으로 켜고/끌 수 있다.
 */

import { memo, useCallback, useEffect } from 'react';
import { useAgentDebugStore } from '@/stores/agent-debug-store';
import { SK, bodyFont, sketchBorder, sketchShadow } from '@/lib/sketch-ui';
import { resetChatSystem } from '@/lib/matrix/systems/agent-chat';

// ─── 타입별 설정 ───

interface IAgentRow {
  key: string;
  label: string;
  icon: string;
  color: string;
  type: 'toggle' | 'readonly';
}

const AGENT_ROWS: IAgentRow[] = [
  { key: 'llmChat', label: 'LLM Chat', icon: '💬', color: '#6366F1', type: 'toggle' },
  { key: 'combatAi', label: 'Combat AI', icon: '⚔️', color: '#EF4444', type: 'toggle' },
  { key: 'arenaBots', label: 'Arena Bots', icon: '🤖', color: '#F59E0B', type: 'toggle' },
  { key: 'ws', label: 'WebSocket', icon: '🔌', color: '#10B981', type: 'readonly' },
  { key: 'nation', label: 'Nation SDK', icon: '🌍', color: '#8B5CF6', type: 'readonly' },
];

// ─── 토글 스위치 ───

function ToggleSwitch({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      style={{
        width: 36,
        height: 18,
        borderRadius: 0,
        border: `1px solid ${active ? SK.green : SK.red}`,
        background: active ? `${SK.green}25` : `${SK.red}25`,
        position: 'relative',
        cursor: 'pointer',
        transition: 'all 200ms ease',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 2,
          left: active ? 19 : 2,
          width: 12,
          height: 12,
          background: active ? SK.green : SK.red,
          borderRadius: 0,
          transition: 'left 200ms ease',
        }}
      />
    </button>
  );
}

// ─── 에이전트 행 ───

function AgentRow({
  row,
  active,
  onToggle,
  stat,
}: {
  row: IAgentRow;
  active: boolean;
  onToggle?: () => void;
  stat?: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        borderBottom: sketchBorder(),
      }}
    >
      {/* 아이콘 */}
      <span style={{ fontSize: 13, width: 20, textAlign: 'center' }}>{row.icon}</span>

      {/* 라벨 + 통계 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: bodyFont,
            fontSize: 12,
            fontWeight: 600,
            color: active ? SK.textPrimary : SK.textMuted,
            letterSpacing: '0.5px',
          }}
        >
          {row.label}
        </div>
        {stat && (
          <div
            style={{
              fontFamily: bodyFont,
              fontSize: 10,
              color: SK.textSecondary,
              marginTop: 1,
            }}
          >
            {stat}
          </div>
        )}
      </div>

      {/* 토글 or 상태 뱃지 */}
      {row.type === 'toggle' && onToggle ? (
        <ToggleSwitch active={active} onToggle={onToggle} />
      ) : (
        <span
          style={{
            fontFamily: bodyFont,
            fontSize: 10,
            fontWeight: 700,
            color: active ? SK.green : SK.textMuted,
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
          }}
        >
          {active ? 'ON' : 'OFF'}
        </span>
      )}
    </div>
  );
}

// ─── 액션 버튼 ───

function ActionButton({
  label,
  color,
  onClick,
}: {
  label: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '5px 0',
        fontFamily: bodyFont,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.5px',
        textTransform: 'uppercase',
        color,
        background: `${color}15`,
        border: `1px solid ${color}40`,
        borderRadius: 0,
        cursor: 'pointer',
        transition: 'all 150ms ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = `${color}30`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = `${color}15`;
      }}
    >
      {label}
    </button>
  );
}

// ─── 메인 패널 ───

function AgentDebugPanelInner({
  onKillAllBots,
}: {
  onKillAllBots?: () => void;
}) {
  const store = useAgentDebugStore();

  // F2 키보드 토글
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        store.togglePanel();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [store.togglePanel]);

  // 토글 버튼 (항상 표시)
  const toggleBtn = (
    <button
      onClick={store.togglePanel}
      title="Agent Debug (F2)"
      style={{
        width: 36,
        height: 36,
        borderRadius: 0,
        border: store.panelOpen
          ? `2px solid ${SK.accent}`
          : '1px solid rgba(255, 255, 255, 0.1)',
        background: store.panelOpen
          ? `${SK.accent}20`
          : 'rgba(9, 9, 11, 0.6)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'all 200ms ease',
        pointerEvents: 'auto',
        boxShadow: store.panelOpen ? `0 0 12px ${SK.accent}40` : 'none',
        fontSize: 16,
      }}
      onMouseEnter={(e) => {
        if (!store.panelOpen) {
          e.currentTarget.style.borderColor = SK.accent;
          e.currentTarget.style.background = `${SK.accent}15`;
        }
      }}
      onMouseLeave={(e) => {
        if (!store.panelOpen) {
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
          e.currentTarget.style.background = 'rgba(9, 9, 11, 0.6)';
        }
      }}
    >
      🐛
    </button>
  );

  if (!store.panelOpen) return toggleBtn;

  // 통계 문자열
  const chatStat = `msgs: ${store.chatMessageCount}`;
  const botStat = `bots: ${store.activeBotCount}`;
  const wsStat = `ping: ${store.wsLatency}ms`;

  return (
    <>
      {toggleBtn}

      {/* 패널 */}
      <div
        style={{
          position: 'absolute',
          top: 44,
          right: 0,
          width: 220,
          background: SK.glassBg,
          border: sketchBorder(),
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          boxShadow: sketchShadow('lg'),
          zIndex: 150,
          overflow: 'hidden',
        }}
      >
        {/* 헤더 */}
        <div
          style={{
            padding: '8px 10px',
            borderBottom: `1px solid ${SK.accent}40`,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span style={{ fontSize: 12 }}>🔧</span>
          <span
            style={{
              fontFamily: bodyFont,
              fontSize: 12,
              fontWeight: 700,
              color: SK.accent,
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
            }}
          >
            AGENT DEBUG
          </span>
        </div>

        {/* 에이전트 행 — 토글 가능 */}
        <AgentRow
          row={AGENT_ROWS[0]}
          active={store.llmChatEnabled}
          onToggle={store.toggleLlmChat}
          stat={chatStat}
        />
        <AgentRow
          row={AGENT_ROWS[1]}
          active={store.combatAiEnabled}
          onToggle={store.toggleCombatAi}
        />
        <AgentRow
          row={AGENT_ROWS[2]}
          active={store.arenaBotsEnabled}
          onToggle={store.toggleArenaBots}
          stat={botStat}
        />

        {/* 구분선 */}
        <div style={{ height: 1, background: `${SK.accent}20`, margin: '2px 0' }} />

        {/* 읽기 전용 상태 */}
        <AgentRow row={AGENT_ROWS[3]} active={store.wsConnected} stat={wsStat} />
        <AgentRow
          row={AGENT_ROWS[4]}
          active={store.nationAgentStatus === 'running'}
          stat={store.nationAgentStatus}
        />

        {/* 액션 버튼 */}
        <div style={{ display: 'flex', gap: 4, padding: '8px 10px' }}>
          {onKillAllBots && (
            <ActionButton label="KILL BOTS" color={SK.red} onClick={onKillAllBots} />
          )}
          <ActionButton
            label="RESET CHAT"
            color={SK.blue}
            onClick={() => {
              resetChatSystem();
              store.setChatMessageCount(0);
            }}
          />
        </div>
      </div>
    </>
  );
}

// ─── Export ───

const AgentDebugPanel = memo(AgentDebugPanelInner);
export default AgentDebugPanel;
