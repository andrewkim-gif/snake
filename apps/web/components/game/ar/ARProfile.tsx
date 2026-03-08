'use client';

/**
 * ARProfile — Player profile display component
 *
 * Shows:
 * - Profile level & XP bar
 * - Lifetime stats grid
 * - Preferred character
 * - Achievement badges
 * - Unlocked characters overview
 */

import type {
  ARPlayerProfile,
  ARCharacterType,
  ARAchievement,
} from '@/lib/3d/ar-types';
import { CHARACTER_INFO, RARITY_COLORS } from '@/lib/3d/ar-types';

interface ARProfileProps {
  profile: ARPlayerProfile;
  onClose: () => void;
}

export function ARProfile({ profile, onClose }: ARProfileProps) {
  const xpPct = profile.profileXpMax > 0
    ? Math.min(100, (profile.profileXp / profile.profileXpMax) * 100)
    : 0;

  const stats = profile.stats;

  const winRate = stats.totalBattles > 0
    ? ((stats.totalWins / stats.totalBattles) * 100).toFixed(1)
    : '0.0';

  const avgSurvival = stats.totalBattles > 0
    ? Math.round(stats.totalSurvivalSec / stats.totalBattles)
    : 0;

  return (
    <div
      onPointerDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
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
          width: 600,
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
            <div style={{ fontSize: 20, fontWeight: 'bold', color: '#fff' }}>
              {profile.username}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
              Profile Level {profile.profileLevel}
            </div>
          </div>
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

        {/* XP Bar */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
            <span>Level {profile.profileLevel}</span>
            <span>{Math.round(profile.profileXp)} / {Math.round(profile.profileXpMax)} XP</span>
          </div>
          <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3 }}>
            <div
              style={{
                height: '100%',
                width: `${xpPct}%`,
                background: 'linear-gradient(90deg, #4CAF50, #8BC34A)',
                borderRadius: 3,
                transition: 'width 0.3s',
              }}
            />
          </div>
        </div>

        {/* Preferred Character */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>
            Preferred Character
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 24 }}>
              {CHARACTER_INFO[profile.preferredChar]?.icon || '?'}
            </span>
            <span style={{ fontSize: 14, color: '#fff' }}>
              {CHARACTER_INFO[profile.preferredChar]?.name || profile.preferredChar}
            </span>
          </div>
        </div>

        {/* Stats Grid */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>
            Lifetime Stats
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            <StatBox label="Battles" value={stats.totalBattles} />
            <StatBox label="Wins" value={stats.totalWins} />
            <StatBox label="Win Rate" value={`${winRate}%`} />
            <StatBox label="Total Kills" value={stats.totalKills} />
            <StatBox label="PvP Kills" value={stats.totalPvpKills} />
            <StatBox label="Elite Kills" value={stats.totalEliteKills} />
            <StatBox label="Best Level" value={stats.highestLevel} />
            <StatBox label="Best Rank" value={stats.bestRank > 0 ? `#${stats.bestRank}` : '-'} />
            <StatBox label="Avg Survival" value={`${avgSurvival}s`} />
            <StatBox label="Boss Kills" value={stats.totalBossKills} />
            <StatBox label="Faction Wins" value={stats.factionWins} />
            <StatBox label="Countries" value={stats.uniqueCountries} />
          </div>
        </div>

        {/* Unlocked Characters */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>
            Characters ({profile.unlockedChars.length} / 8)
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(Object.keys(CHARACTER_INFO) as ARCharacterType[]).map((ct) => {
              const unlocked = profile.unlockedChars.includes(ct);
              const info = CHARACTER_INFO[ct];
              return (
                <div
                  key={ct}
                  style={{
                    width: 60,
                    height: 60,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: unlocked ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.3)',
                    border: `1px solid ${unlocked ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)'}`,
                    borderRadius: 8,
                    opacity: unlocked ? 1 : 0.3,
                  }}
                >
                  <span style={{ fontSize: 20 }}>{info.icon}</span>
                  <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.6)' }}>{info.name}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Achievements */}
        {profile.achievements.length > 0 && (
          <div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>
              Achievements ({profile.achievements.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {profile.achievements.slice(-6).map((ach: ARAchievement) => (
                <div
                  key={ach.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '4px 8px',
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: 4,
                    borderLeft: `3px solid ${RARITY_COLORS[ach.rarity]}`,
                  }}
                >
                  <span style={{ fontSize: 12, color: RARITY_COLORS[ach.rarity], fontWeight: 'bold' }}>
                    {ach.name}
                  </span>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', flex: 1 }}>
                    {ach.desc}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Token Balances */}
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', gap: 24, justifyContent: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 'bold', color: '#FFD700' }}>
                {Math.round(profile.awwBalance)}
              </div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>$AWW</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 'bold', color: '#4CAF50' }}>
                Lv.{profile.seasonPassLevel}
              </div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>Season Pass</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        borderRadius: 6,
        padding: '8px 10px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 'bold', color: '#fff' }}>
        {value}
      </div>
      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
        {label}
      </div>
    </div>
  );
}
