'use client';

/**
 * ARQuestPanel — Quest display panel
 *
 * Shows active daily/weekly/seasonal quests with progress bars.
 * Used in lobby and as in-game overlay.
 */

import type { ARQuest, ARQuestPeriod } from '@/lib/3d/ar-types';
import { QUEST_CATEGORY_INFO } from '@/lib/3d/ar-types';

interface ARQuestPanelProps {
  dailyQuests: ARQuest[];
  weeklyQuests: ARQuest[];
  seasonQuests: ARQuest[];
  compact?: boolean; // minimal display for in-game
  onClose?: () => void;
}

const PERIOD_LABELS: Record<ARQuestPeriod, { label: string; color: string }> = {
  daily: { label: 'DAILY', color: '#4CAF50' },
  weekly: { label: 'WEEKLY', color: '#2196F3' },
  season: { label: 'SEASON', color: '#FFD700' },
};

export function ARQuestPanel({
  dailyQuests,
  weeklyQuests,
  seasonQuests,
  compact = false,
  onClose,
}: ARQuestPanelProps) {
  if (compact) {
    // In-game compact view: show only active non-completed quests
    const activeQuests = [...dailyQuests, ...weeklyQuests, ...seasonQuests].filter(
      (q) => !q.completed,
    );
    if (activeQuests.length === 0) return null;

    return (
      <div
        style={{
          position: 'absolute',
          top: 160,
          right: 12,
          width: 200,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          pointerEvents: 'none',
          zIndex: 15,
        }}
      >
        {activeQuests.slice(0, 3).map((quest) => (
          <CompactQuestItem key={quest.id} quest={quest} />
        ))}
      </div>
    );
  }

  // Full panel view (lobby)
  return (
    <div
      style={{
        background: '#1a1a1a',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: 20,
        fontFamily: 'monospace',
        maxWidth: 400,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 'bold', color: '#fff', textTransform: 'uppercase', letterSpacing: 2 }}>
          Quests
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff',
              padding: '2px 8px',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 10,
            }}
          >
            X
          </button>
        )}
      </div>

      {/* Daily */}
      <QuestSection period="daily" quests={dailyQuests} />

      {/* Weekly */}
      <QuestSection period="weekly" quests={weeklyQuests} />

      {/* Season */}
      <QuestSection period="season" quests={seasonQuests} />
    </div>
  );
}

function QuestSection({ period, quests }: { period: ARQuestPeriod; quests: ARQuest[] }) {
  const { label, color } = PERIOD_LABELS[period];

  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          fontSize: 10,
          color,
          textTransform: 'uppercase',
          letterSpacing: 2,
          marginBottom: 6,
          borderBottom: `1px solid ${color}33`,
          paddingBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {quests.map((quest) => (
          <QuestItem key={quest.id} quest={quest} />
        ))}
        {quests.length === 0 && (
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>
            No active quests
          </div>
        )}
      </div>
    </div>
  );
}

function QuestItem({ quest }: { quest: ARQuest }) {
  const pct = quest.target > 0 ? Math.min(100, (quest.progress / quest.target) * 100) : 0;
  const catInfo = QUEST_CATEGORY_INFO[quest.category];

  return (
    <div
      style={{
        background: quest.completed ? 'rgba(76,175,80,0.1)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${quest.completed ? 'rgba(76,175,80,0.3)' : 'rgba(255,255,255,0.05)'}`,
        borderRadius: 6,
        padding: '8px 10px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12 }}>{catInfo?.icon || '?'}</span>
          <span
            style={{
              fontSize: 11,
              color: quest.completed ? '#4CAF50' : '#fff',
              fontWeight: quest.completed ? 'normal' : 'bold',
              textDecoration: quest.completed ? 'line-through' : 'none',
            }}
          >
            {quest.name}
          </span>
        </div>
        {quest.completed && (
          <span style={{ fontSize: 10, color: '#4CAF50' }}>DONE</span>
        )}
      </div>

      {/* Progress bar */}
      {!quest.completed && (
        <div style={{ marginTop: 4 }}>
          <div style={{ height: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
            <div
              style={{
                height: '100%',
                width: `${pct}%`,
                background: catInfo?.color || '#4CAF50',
                borderRadius: 2,
                transition: 'width 0.3s',
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>
              {quest.progress} / {quest.target}
            </span>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>
              +{quest.rewardAmount} {quest.rewardType.replace('_', ' ')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function CompactQuestItem({ quest }: { quest: ARQuest }) {
  const pct = quest.target > 0 ? Math.min(100, (quest.progress / quest.target) * 100) : 0;

  return (
    <div
      style={{
        background: 'rgba(0,0,0,0.5)',
        borderRadius: 4,
        padding: '4px 8px',
        fontFamily: 'monospace',
      }}
    >
      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', marginBottom: 2 }}>
        {quest.name}
      </div>
      <div style={{ height: 2, background: 'rgba(255,255,255,0.1)', borderRadius: 1 }}>
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: QUEST_CATEGORY_INFO[quest.category]?.color || '#4CAF50',
            borderRadius: 1,
          }}
        />
      </div>
      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', marginTop: 1, textAlign: 'right' }}>
        {quest.progress}/{quest.target}
      </div>
    </div>
  );
}
