'use client';

/**
 * ARSeasonPass — Season pass display component
 *
 * Shows:
 * - Current season era indicator
 * - Season pass level & XP bar
 * - Free/Premium track rewards
 * - Claim buttons for earned rewards
 */

import type { ARSeasonPass, ARSeasonReward, ARSeasonEra } from '@/lib/3d/ar-types';
import { ERA_INFO } from '@/lib/3d/ar-types';

interface ARSeasonPassProps {
  pass: ARSeasonPass;
  rewards: ARSeasonReward[];
  currentEra: ARSeasonEra;
  onClose: () => void;
  onClaimReward?: (level: number, track: 'free' | 'premium') => void;
}

export function ARSeasonPassView({
  pass,
  rewards,
  currentEra,
  onClose,
  onClaimReward,
}: ARSeasonPassProps) {
  const xpPct = pass.xpToNext > 0
    ? Math.min(100, (pass.xp / pass.xpToNext) * 100)
    : 0;

  const eraInfo = ERA_INFO[currentEra];

  // Group rewards by level for display
  const rewardsByLevel = new Map<number, { free?: ARSeasonReward; premium?: ARSeasonReward }>();
  for (const r of rewards) {
    const existing = rewardsByLevel.get(r.level) || {};
    if (r.track === 'free') existing.free = r;
    else existing.premium = r;
    rewardsByLevel.set(r.level, existing);
  }

  // Show levels around current level
  const startLevel = Math.max(1, pass.level - 2);
  const endLevel = Math.min(100, startLevel + 10);
  const visibleLevels: number[] = [];
  for (let i = startLevel; i <= endLevel; i++) {
    visibleLevels.push(i);
  }

  return (
    <div
      style={{
        position: 'fixed',
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
          width: 700,
          maxHeight: '80vh',
          background: '#1a1a1a',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 12,
          overflow: 'auto',
          padding: 24,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 'bold', color: '#fff' }}>
              Season Pass
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: 14 }}>{eraInfo.icon}</span>
              <span style={{ fontSize: 12, color: eraInfo.color, fontWeight: 'bold' }}>
                Era: {eraInfo.name}
              </span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
                {eraInfo.desc}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {!pass.isPremium && (
              <div
                style={{
                  padding: '4px 12px',
                  background: 'rgba(255,215,0,0.15)',
                  border: '1px solid rgba(255,215,0,0.3)',
                  borderRadius: 4,
                  fontSize: 10,
                  color: '#FFD700',
                  cursor: 'pointer',
                }}
              >
                Upgrade to Premium (3000 $AWW)
              </div>
            )}
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: '1px solid rgba(255,255,255,0.2)',
                color: '#fff',
                padding: '4px 12px',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              Close
            </button>
          </div>
        </div>

        {/* Level & XP */}
        <div style={{ marginBottom: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 32, fontWeight: 'bold', color: '#FFD700' }}>
            Level {pass.level}
          </div>
          <div style={{ maxWidth: 300, margin: '8px auto 0' }}>
            <div style={{ height: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 4 }}>
              <div
                style={{
                  height: '100%',
                  width: `${xpPct}%`,
                  background: 'linear-gradient(90deg, #FFD700, #FF9800)',
                  borderRadius: 4,
                  transition: 'width 0.3s',
                }}
              />
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
              {Math.round(pass.xp)} / {Math.round(pass.xpToNext)} XP
            </div>
          </div>
        </div>

        {/* Reward Track */}
        <div style={{ overflowX: 'auto' }}>
          {/* Track headers */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, paddingLeft: 60 }}>
            <div style={{ width: 120, textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 2 }}>
              Free
            </div>
            <div style={{ width: 120, textAlign: 'center', fontSize: 10, color: '#FFD700', textTransform: 'uppercase', letterSpacing: 2 }}>
              Premium
            </div>
          </div>

          {/* Reward rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {visibleLevels.map((level) => {
              const pair = rewardsByLevel.get(level);
              const isUnlocked = level <= pass.level;
              const isCurrent = level === pass.level + 1;

              return (
                <div
                  key={level}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    opacity: isUnlocked ? 1 : 0.4,
                    background: isCurrent ? 'rgba(255,215,0,0.05)' : 'transparent',
                    borderRadius: 4,
                    padding: '4px 0',
                  }}
                >
                  {/* Level number */}
                  <div
                    style={{
                      width: 50,
                      textAlign: 'center',
                      fontSize: 12,
                      fontWeight: isUnlocked ? 'bold' : 'normal',
                      color: isUnlocked ? '#FFD700' : 'rgba(255,255,255,0.3)',
                    }}
                  >
                    {level}
                  </div>

                  {/* Free reward */}
                  <RewardCard
                    reward={pair?.free}
                    unlocked={isUnlocked}
                    claimed={pass.claimedFree.includes(level)}
                    onClaim={() => onClaimReward?.(level, 'free')}
                  />

                  {/* Premium reward */}
                  <RewardCard
                    reward={pair?.premium}
                    unlocked={isUnlocked && pass.isPremium}
                    claimed={pass.claimedPremium.includes(level)}
                    onClaim={() => onClaimReward?.(level, 'premium')}
                    isPremium
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function RewardCard({
  reward,
  unlocked,
  claimed,
  onClaim,
  isPremium = false,
}: {
  reward?: ARSeasonReward;
  unlocked: boolean;
  claimed: boolean;
  onClaim: () => void;
  isPremium?: boolean;
}) {
  if (!reward) {
    return (
      <div
        style={{
          width: 120,
          height: 40,
          background: 'rgba(255,255,255,0.02)',
          borderRadius: 4,
          border: '1px solid rgba(255,255,255,0.05)',
        }}
      />
    );
  }

  const borderColor = isPremium
    ? 'rgba(255,215,0,0.2)'
    : 'rgba(255,255,255,0.1)';

  return (
    <div
      style={{
        width: 120,
        minHeight: 40,
        background: claimed
          ? 'rgba(76,175,80,0.1)'
          : isPremium
            ? 'rgba(255,215,0,0.05)'
            : 'rgba(255,255,255,0.03)',
        border: `1px solid ${borderColor}`,
        borderRadius: 4,
        padding: '4px 6px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          fontSize: 9,
          color: claimed ? '#4CAF50' : 'rgba(255,255,255,0.6)',
          lineHeight: 1.3,
        }}
      >
        {reward.description}
      </div>
      {unlocked && !claimed && (
        <button
          onClick={onClaim}
          style={{
            marginTop: 2,
            background: 'rgba(76,175,80,0.2)',
            border: '1px solid rgba(76,175,80,0.4)',
            color: '#4CAF50',
            fontSize: 8,
            padding: '1px 4px',
            borderRadius: 2,
            cursor: 'pointer',
            textTransform: 'uppercase',
          }}
        >
          Claim
        </button>
      )}
      {claimed && (
        <div style={{ fontSize: 8, color: '#4CAF50', marginTop: 2 }}>
          Claimed
        </div>
      )}
    </div>
  );
}
