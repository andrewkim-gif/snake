'use client';

/**
 * ARBattleRewards — Post-battle reward summary overlay
 *
 * Shows:
 * - Token rewards breakdown (country tokens + $AWW)
 * - Profile XP gained
 * - Quest progress updates
 * - Season pass XP
 */

import type { ARBattleRewards, ARQuestDelta } from '@/lib/3d/ar-types';

interface ARBattleRewardsProps {
  rewards: ARBattleRewards;
  onClose: () => void;
}

export function ARBattleRewardsOverlay({ rewards, onClose }: ARBattleRewardsProps) {
  const countryEntries = rewards.entries.filter((e) => e.tokenType === 'country');
  const awwEntries = rewards.entries.filter((e) => e.tokenType === 'aww');

  return (
    <div
      onPointerDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        zIndex: 100,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: 'monospace',
      }}
    >
      <div
        style={{
          width: 400,
          background: '#1a1a1a',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 12,
          padding: 24,
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div
            style={{
              fontSize: 16,
              fontWeight: 'bold',
              color: '#FFD700',
              textTransform: 'uppercase',
              letterSpacing: 3,
            }}
          >
            Battle Rewards
          </div>
        </div>

        {/* Token Totals */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginBottom: 20 }}>
          {rewards.totalCountry > 0 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#4CAF50' }}>
                +{Math.round(rewards.totalCountry)}
              </div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>Country Tokens</div>
            </div>
          )}
          {rewards.totalAww > 0 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#FFD700' }}>
                +{Math.round(rewards.totalAww)}
              </div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>$AWW</div>
            </div>
          )}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#2196F3' }}>
              +{Math.round(rewards.profileXp)}
            </div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>Profile XP</div>
          </div>
        </div>

        {/* Reward Breakdown */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 6 }}>
            Breakdown
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {countryEntries.map((entry, i) => (
              <div
                key={`c-${i}`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '3px 8px',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: 3,
                  fontSize: 10,
                }}
              >
                <span style={{ color: 'rgba(255,255,255,0.6)' }}>{entry.source}</span>
                <span style={{ color: '#4CAF50' }}>+{Math.round(entry.amount)}</span>
              </div>
            ))}
            {awwEntries.map((entry, i) => (
              <div
                key={`a-${i}`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '3px 8px',
                  background: 'rgba(255,215,0,0.05)',
                  borderRadius: 3,
                  fontSize: 10,
                }}
              >
                <span style={{ color: 'rgba(255,255,255,0.6)' }}>{entry.source}</span>
                <span style={{ color: '#FFD700' }}>+{Math.round(entry.amount)} $AWW</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quest Progress */}
        {rewards.questProgress && rewards.questProgress.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 6 }}>
              Quest Progress
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {rewards.questProgress.map((qd: ARQuestDelta) => (
                <div
                  key={qd.questId}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '3px 8px',
                    background: qd.complete ? 'rgba(76,175,80,0.1)' : 'rgba(255,255,255,0.03)',
                    borderRadius: 3,
                    fontSize: 10,
                  }}
                >
                  <span style={{ color: qd.complete ? '#4CAF50' : 'rgba(255,255,255,0.6)' }}>
                    {qd.questId.split('_').slice(0, 3).join(' ')}
                  </span>
                  <span style={{ color: qd.complete ? '#4CAF50' : 'rgba(255,255,255,0.4)' }}>
                    {qd.complete ? 'COMPLETE!' : `+${qd.delta}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Close button */}
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 32px',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 6,
              color: '#fff',
              fontSize: 12,
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: 2,
            }}
          >
            Return to Lobby
          </button>
        </div>
      </div>
    </div>
  );
}
