'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  SK,
  SKFont,
  headingFont,
  bodyFont,
  sketchBorder,
  sketchShadow,
  radius,
} from '@/lib/sketch-ui';

// --- Types ---

interface AchievementDefinition {
  key: string;
  name: string;
  description: string;
  type: 'personal' | 'faction';
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'legend';
  icon: string;
  threshold: number;
  hidden: boolean;
  repeatable: boolean;
}

interface AchievementDisplay {
  definition: AchievementDefinition;
  progress: number;
  unlocked: boolean;
  unlocked_at?: string;
}

interface AchievementNotification {
  achievement_key: string;
  name: string;
  description: string;
  tier: string;
  icon: string;
  owner_id: string;
  timestamp: number;
}

interface AchievementsProps {
  serverUrl: string;
  userId: string;
  factionId?: string;
}

// --- Tier Colors ---
const tierColors: Record<string, { bg: string; text: string; border: string }> = {
  bronze: { bg: 'rgba(205, 127, 50, 0.1)', text: '#CD7F32', border: 'rgba(205, 127, 50, 0.3)' },
  silver: { bg: 'rgba(192, 192, 192, 0.1)', text: '#808080', border: 'rgba(192, 192, 192, 0.3)' },
  gold: { bg: 'rgba(255, 215, 0, 0.1)', text: '#B8860B', border: 'rgba(255, 215, 0, 0.3)' },
  platinum: { bg: 'rgba(59, 130, 246, 0.1)', text: '#3B82F6', border: 'rgba(59, 130, 246, 0.3)' },
  legend: { bg: 'rgba(168, 85, 247, 0.1)', text: '#8B5CF6', border: 'rgba(168, 85, 247, 0.3)' },
};

// --- Icon Map ---
const achievementIcons: Record<string, string> = {
  sword: '\u2694\uFE0F',
  skull: '\uD83D\uDC80',
  globe: '\uD83C\uDF0D',
  shield: '\uD83D\uDEE1\uFE0F',
  crown: '\uD83D\uDC51',
  coin: '\uD83D\uDCB0',
  scroll: '\uD83D\uDCDC',
  wolf: '\uD83D\uDC3A',
  lightning: '\u26A1',
  run: '\uD83C\uDFC3',
  sunrise: '\uD83C\uDF05',
  heart: '\u2764\uFE0F',
  star: '\u2B50',
  flag: '\uD83C\uDFF4',
  castle: '\uD83C\uDFF0',
  chart: '\uD83D\uDCC8',
  dove: '\uD83D\uDD4A\uFE0F',
  trophy: '\uD83C\uDFC6',
  map: '\uD83D\uDDFA\uFE0F',
  wall: '\uD83E\uDDF1',
  explosion: '\uD83D\uDCA5',
  handshake: '\uD83E\uDD1D',
  bank: '\uD83C\uDFE6',
  people: '\uD83D\uDC65',
};

// --- Main Component ---

export default function Achievements({ serverUrl, userId, factionId }: AchievementsProps) {
  const [personalAchievements, setPersonalAchievements] = useState<AchievementDisplay[]>([]);
  const [factionAchievements, setFactionAchievements] = useState<AchievementDisplay[]>([]);
  const [unlockedCount, setUnlockedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'personal' | 'faction'>('personal');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<AchievementNotification | null>(null);

  // Fetch achievements
  const fetchAchievements = useCallback(async () => {
    try {
      setLoading(true);
      const promises: Promise<Response>[] = [
        fetch(`${serverUrl}/api/achievements/user/${userId}`),
      ];
      if (factionId) {
        promises.push(fetch(`${serverUrl}/api/achievements/faction/${factionId}`));
      }

      const results = await Promise.all(promises);
      const userData = await results[0].json();

      setPersonalAchievements(userData.achievements || []);
      setUnlockedCount(userData.unlocked || 0);
      setTotalCount(userData.total || 0);

      if (results.length > 1 && results[1].ok) {
        const factionData = await results[1].json();
        setFactionAchievements(factionData.achievements || []);
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load achievements');
    } finally {
      setLoading(false);
    }
  }, [serverUrl, userId, factionId]);

  useEffect(() => {
    fetchAchievements();
  }, [fetchAchievements]);

  // Poll for notifications (lightweight, every 10s)
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${serverUrl}/api/achievements/notifications?limit=1`);
        if (res.ok) {
          const data = await res.json();
          const notifications: AchievementNotification[] = data.notifications || [];
          const myNotif = notifications.find((n: AchievementNotification) => n.owner_id === userId);
          if (myNotif) {
            setNotification(myNotif);
            // Auto-dismiss after 5 seconds
            setTimeout(() => setNotification(null), 5000);
            // Refresh achievements
            fetchAchievements();
          }
        }
      } catch {
        // Silently fail for notification polling
      }
    }, 10_000);
    return () => clearInterval(interval);
  }, [serverUrl, userId, fetchAchievements]);

  const currentAchievements = activeTab === 'personal' ? personalAchievements : factionAchievements;
  const progressPct = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

  if (loading) {
    return (
      <div style={{ color: SK.textSecondary, fontFamily: bodyFont, fontSize: SKFont.sm, padding: 24, textAlign: 'center' }}>
        Loading achievements...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ color: SK.red, fontFamily: bodyFont, fontSize: SKFont.sm, padding: 24, textAlign: 'center' }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* Achievement Notification Toast */}
      {notification && (
        <div
          style={{
            position: 'fixed',
            top: 16,
            right: 16,
            zIndex: 9999,
            background: SK.cardBg,
            border: sketchBorder(tierColors[notification.tier]?.border || SK.border),
            borderRadius: radius.md,
            padding: '12px 20px',
            boxShadow: sketchShadow('lg'),
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            animation: 'slideIn 0.3s ease-out',
            maxWidth: 360,
          }}
        >
          <span style={{ fontSize: 28 }}>
            {achievementIcons[notification.icon] || '\uD83C\uDFC5'}
          </span>
          <div>
            <div style={{
              fontFamily: headingFont,
              fontSize: SKFont.sm,
              color: SK.textPrimary,
              fontWeight: 700,
            }}>
              Achievement Unlocked!
            </div>
            <div style={{
              fontFamily: bodyFont,
              fontSize: SKFont.xs,
              color: tierColors[notification.tier]?.text || SK.textSecondary,
              fontWeight: 600,
            }}>
              {notification.name}
            </div>
            <div style={{
              fontFamily: bodyFont,
              fontSize: SKFont.xs,
              color: SK.textMuted,
            }}>
              {notification.description}
            </div>
          </div>
        </div>
      )}

      {/* Header + Progress */}
      <div style={{ marginBottom: 20 }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}>
          <h2 style={{
            fontFamily: headingFont,
            fontSize: SKFont.h2,
            color: SK.textPrimary,
            fontWeight: 700,
            margin: 0,
          }}>
            Achievements
          </h2>
          <span style={{
            fontFamily: bodyFont,
            fontSize: SKFont.sm,
            color: SK.textSecondary,
          }}>
            {unlockedCount}/{totalCount} ({progressPct}%)
          </span>
        </div>

        {/* Progress bar */}
        <div style={{
          height: 6,
          background: SK.bgWarm,
          borderRadius: radius.pill,
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${progressPct}%`,
            background: `linear-gradient(90deg, ${SK.blue}, ${SK.green})`,
            borderRadius: radius.pill,
            transition: 'width 0.5s ease',
          }} />
        </div>
      </div>

      {/* Tab Toggle */}
      <div style={{
        display: 'flex',
        gap: 8,
        marginBottom: 16,
      }}>
        <button
          onClick={() => setActiveTab('personal')}
          style={{
            flex: 1,
            fontFamily: bodyFont,
            fontSize: SKFont.sm,
            color: activeTab === 'personal' ? SK.textWhite : SK.textSecondary,
            background: activeTab === 'personal' ? SK.blue : SK.cardBg,
            border: sketchBorder(activeTab === 'personal' ? SK.blue : SK.border),
            borderRadius: radius.md,
            padding: '8px 16px',
            cursor: 'pointer',
            fontWeight: activeTab === 'personal' ? 600 : 400,
            transition: 'all 0.15s ease',
          }}
        >
          Personal ({personalAchievements.filter((a) => a.unlocked).length})
        </button>
        {factionId && (
          <button
            onClick={() => setActiveTab('faction')}
            style={{
              flex: 1,
              fontFamily: bodyFont,
              fontSize: SKFont.sm,
              color: activeTab === 'faction' ? SK.textWhite : SK.textSecondary,
              background: activeTab === 'faction' ? SK.blue : SK.cardBg,
              border: sketchBorder(activeTab === 'faction' ? SK.blue : SK.border),
              borderRadius: radius.md,
              padding: '8px 16px',
              cursor: 'pointer',
              fontWeight: activeTab === 'faction' ? 600 : 400,
              transition: 'all 0.15s ease',
            }}
          >
            Faction ({factionAchievements.filter((a) => a.unlocked).length})
          </button>
        )}
      </div>

      {/* Achievement Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: 10,
      }}>
        {currentAchievements.map((achievement) => (
          <AchievementCard key={achievement.definition.key} achievement={achievement} />
        ))}
      </div>

      {currentAchievements.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: 40,
          color: SK.textMuted,
          fontFamily: bodyFont,
          fontSize: SKFont.body,
        }}>
          {activeTab === 'faction'
            ? 'Join a faction to see faction achievements.'
            : 'No achievement data available.'}
        </div>
      )}
    </div>
  );
}

// --- Achievement Card ---

function AchievementCard({ achievement }: { achievement: AchievementDisplay }) {
  const { definition: def, progress, unlocked } = achievement;
  const tier = tierColors[def.tier] || tierColors.bronze;
  const icon = achievementIcons[def.icon] || '\uD83C\uDFC5';
  const progressPct = def.threshold > 0 ? Math.min(100, Math.round((progress / def.threshold) * 100)) : 0;

  return (
    <div style={{
      background: unlocked ? tier.bg : SK.cardBg,
      border: sketchBorder(unlocked ? tier.border : SK.border),
      borderRadius: radius.md,
      padding: '12px 14px',
      opacity: unlocked ? 1 : 0.6,
      transition: 'all 0.2s ease',
      display: 'flex',
      gap: 12,
      alignItems: 'flex-start',
    }}>
      {/* Icon */}
      <div style={{
        fontSize: 28,
        lineHeight: 1,
        flexShrink: 0,
        filter: unlocked ? 'none' : 'grayscale(100%)',
      }}>
        {icon}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Name + Tier */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 2,
        }}>
          <span style={{
            fontFamily: headingFont,
            fontSize: SKFont.sm,
            color: unlocked ? SK.textPrimary : SK.textMuted,
            fontWeight: 600,
          }}>
            {def.hidden && !unlocked ? '???' : def.name}
          </span>
          <span style={{
            fontFamily: bodyFont,
            fontSize: SKFont.xs,
            color: tier.text,
            textTransform: 'uppercase',
            fontWeight: 600,
            letterSpacing: '0.05em',
          }}>
            {def.tier}
          </span>
        </div>

        {/* Description */}
        <div style={{
          fontFamily: bodyFont,
          fontSize: SKFont.xs,
          color: SK.textSecondary,
          marginBottom: 6,
        }}>
          {def.hidden && !unlocked ? 'Hidden achievement' : def.description}
        </div>

        {/* Progress bar */}
        {!unlocked && (
          <div>
            <div style={{
              height: 4,
              background: 'rgba(0,0,0,0.06)',
              borderRadius: radius.pill,
              overflow: 'hidden',
              marginBottom: 2,
            }}>
              <div style={{
                height: '100%',
                width: `${progressPct}%`,
                background: tier.text,
                borderRadius: radius.pill,
                transition: 'width 0.3s ease',
              }} />
            </div>
            <div style={{
              fontFamily: bodyFont,
              fontSize: '10px',
              color: SK.textMuted,
              textAlign: 'right',
            }}>
              {progress}/{def.threshold}
            </div>
          </div>
        )}

        {/* Unlocked date */}
        {unlocked && achievement.unlocked_at && (
          <div style={{
            fontFamily: bodyFont,
            fontSize: '10px',
            color: SK.textMuted,
          }}>
            Unlocked {new Date(achievement.unlocked_at).toLocaleDateString()}
          </div>
        )}
      </div>
    </div>
  );
}
