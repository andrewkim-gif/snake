'use client';

/**
 * KillFeed.tsx - v37 Phase 8: 실시간 킬피드 컴포넌트
 *
 * 우측 상단 실시간 킬피드 (최대 5건 표시).
 * 각 항목: [팩션 태그] 에이전트명 -> [무기 아이콘] -> 대상명
 * 자신의 킬은 골드 하이라이트, 자신의 데스는 레드 하이라이트.
 * 3초 후 페이드아웃, 최신 항목이 위.
 *
 * React 오버레이 컴포넌트 (components/game/matrix/KillFeed.tsx)
 *
 * 디자인: SK 팔레트, Chakra Petch heading, border-radius: 0
 */

import { memo, useState, useEffect, useRef, useCallback } from 'react';
import { Skull } from 'lucide-react';
import { SK, headingFont, bodyFont } from '@/lib/sketch-ui';
import { SkillIconSVG } from './SkillIconSVG';
import type { WeaponType } from '@/lib/matrix/types';

// ============================================
// Types
// ============================================

/** 킬피드 개별 항목 */
export interface KillFeedEntry {
  /** 고유 ID */
  id: string;
  /** 킬러 에이전트 ID */
  killerId: string;
  /** 킬러 표시명 */
  killerName: string;
  /** 킬러 팩션 태그 (예: 'NEXUS', 'VIPER') */
  killerFaction?: string;
  /** 킬러 팩션 컬러 */
  killerFactionColor?: string;
  /** 피해자 에이전트 ID */
  victimId: string;
  /** 피해자 표시명 */
  victimName: string;
  /** 피해자 팩션 태그 */
  victimFaction?: string;
  /** 피해자 팩션 컬러 */
  victimFactionColor?: string;
  /** 사용 무기 타입 */
  weaponType?: WeaponType;
  /** 획득 Gold (자신의 킬 시) */
  goldEarned?: number;
  /** 타임스탬프 (Date.now()) */
  timestamp: number;
}

export interface KillFeedProps {
  /** 킬피드 항목 배열 (최신순 — 외부에서 관리) */
  entries: KillFeedEntry[];
  /** 현재 플레이어 에이전트 ID (하이라이트 용) */
  localPlayerId: string;
  /** 최대 표시 건수 (기본 5) */
  maxDisplay?: number;
  /** 페이드아웃 시간 ms (기본 3000) */
  fadeOutMs?: number;
}

// ============================================
// Constants
// ============================================

const DEFAULT_MAX_DISPLAY = 5;
const DEFAULT_FADE_OUT_MS = 3000;
const ANIMATION_DURATION_MS = 300;

// ============================================
// CSS Keyframes (injected once)
// ============================================

const KEYFRAMES_ID = 'kill-feed-v37-keyframes';

if (typeof window !== 'undefined' && !document.getElementById(KEYFRAMES_ID)) {
  const style = document.createElement('style');
  style.id = KEYFRAMES_ID;
  style.textContent = `
    @keyframes killFeedSlideIn {
      from { opacity: 0; transform: translateX(40px); }
      to { opacity: 1; transform: translateX(0); }
    }
    @keyframes killFeedFadeOut {
      from { opacity: 1; }
      to { opacity: 0; transform: translateX(20px); }
    }
  `;
  document.head.appendChild(style);
}

// ============================================
// Sub: KillFeedItem
// ============================================

interface KillFeedItemProps {
  entry: KillFeedEntry;
  isLocalKill: boolean;
  isLocalDeath: boolean;
  isFadingOut: boolean;
}

function KillFeedItem({ entry, isLocalKill, isLocalDeath, isFadingOut }: KillFeedItemProps) {
  const bgColor = isLocalKill
    ? 'rgba(245, 158, 11, 0.15)'
    : isLocalDeath
    ? 'rgba(239, 68, 68, 0.15)'
    : 'rgba(9, 9, 11, 0.75)';

  const borderColor = isLocalKill
    ? 'rgba(245, 158, 11, 0.3)'
    : isLocalDeath
    ? 'rgba(239, 68, 68, 0.3)'
    : SK.border;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        background: bgColor,
        backdropFilter: 'blur(4px)',
        border: `1px solid ${borderColor}`,
        borderRadius: 0,
        animation: isFadingOut
          ? `killFeedFadeOut ${ANIMATION_DURATION_MS}ms ease-in forwards`
          : `killFeedSlideIn ${ANIMATION_DURATION_MS}ms ease-out`,
        whiteSpace: 'nowrap',
        maxWidth: 340,
      }}
    >
      {/* Killer faction tag */}
      {entry.killerFaction && (
        <span
          style={{
            fontFamily: headingFont,
            fontSize: 9,
            fontWeight: 800,
            color: entry.killerFactionColor ?? SK.textMuted,
            letterSpacing: '0.06em',
            padding: '1px 4px',
            border: `1px solid ${(entry.killerFactionColor ?? SK.textMuted) + '40'}`,
            borderRadius: 0,
            flexShrink: 0,
          }}
        >
          {entry.killerFaction}
        </span>
      )}

      {/* Killer name */}
      <span
        style={{
          fontFamily: headingFont,
          fontSize: 11,
          fontWeight: 700,
          color: isLocalKill ? SK.gold : SK.textPrimary,
          letterSpacing: '0.02em',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: 80,
        }}
      >
        {entry.killerName}
      </span>

      {/* Weapon icon */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
        {entry.weaponType ? (
          <SkillIconSVG type={entry.weaponType} size={14} level={1} />
        ) : (
          <Skull size={12} style={{ color: SK.textMuted }} />
        )}
      </div>

      {/* Victim name */}
      <span
        style={{
          fontFamily: headingFont,
          fontSize: 11,
          fontWeight: 700,
          color: isLocalDeath ? SK.red : SK.textSecondary,
          letterSpacing: '0.02em',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: 80,
        }}
      >
        {entry.victimName}
      </span>

      {/* Victim faction tag */}
      {entry.victimFaction && (
        <span
          style={{
            fontFamily: headingFont,
            fontSize: 9,
            fontWeight: 800,
            color: entry.victimFactionColor ?? SK.textMuted,
            letterSpacing: '0.06em',
            padding: '1px 4px',
            border: `1px solid ${(entry.victimFactionColor ?? SK.textMuted) + '40'}`,
            borderRadius: 0,
            flexShrink: 0,
          }}
        >
          {entry.victimFaction}
        </span>
      )}

      {/* Gold earned (self-kill only) */}
      {isLocalKill && entry.goldEarned != null && entry.goldEarned > 0 && (
        <span
          style={{
            fontFamily: headingFont,
            fontSize: 10,
            fontWeight: 800,
            color: SK.gold,
            marginLeft: 2,
            flexShrink: 0,
          }}
        >
          +{entry.goldEarned}G
        </span>
      )}
    </div>
  );
}

// ============================================
// Main Component
// ============================================

function KillFeedInner({
  entries,
  localPlayerId,
  maxDisplay = DEFAULT_MAX_DISPLAY,
  fadeOutMs = DEFAULT_FADE_OUT_MS,
}: KillFeedProps) {
  const [visibleEntries, setVisibleEntries] = useState<
    Array<KillFeedEntry & { _fadingOut?: boolean }>
  >([]);
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Sync visible entries with external entries
  useEffect(() => {
    // Add new entries
    const currentIds = new Set(visibleEntries.map(e => e.id));
    const newEntries = entries.filter(e => !currentIds.has(e.id));

    if (newEntries.length > 0) {
      setVisibleEntries(prev => {
        const updated = [...newEntries.map(e => ({ ...e, _fadingOut: false })), ...prev];
        return updated.slice(0, maxDisplay + 2); // Keep a small buffer
      });

      // Set up fade-out timers for new entries
      for (const entry of newEntries) {
        const fadeTimer = setTimeout(() => {
          setVisibleEntries(prev =>
            prev.map(e => (e.id === entry.id ? { ...e, _fadingOut: true } : e))
          );
          // Remove after fade animation
          const removeTimer = setTimeout(() => {
            setVisibleEntries(prev => prev.filter(e => e.id !== entry.id));
            timeoutsRef.current.delete(entry.id);
          }, ANIMATION_DURATION_MS);
          timeoutsRef.current.set(`${entry.id}_remove`, removeTimer);
        }, fadeOutMs);
        timeoutsRef.current.set(entry.id, fadeTimer);
      }
    }

    return () => {
      // Cleanup is handled on unmount
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries.length, maxDisplay, fadeOutMs]);

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      for (const timer of timeoutsRef.current.values()) {
        clearTimeout(timer);
      }
      timeoutsRef.current.clear();
    };
  }, []);

  const displayEntries = visibleEntries.slice(0, maxDisplay);

  if (displayEntries.length === 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 70,
        right: 12,
        zIndex: 45,
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        pointerEvents: 'none',
      }}
    >
      {displayEntries.map(entry => (
        <KillFeedItem
          key={entry.id}
          entry={entry}
          isLocalKill={entry.killerId === localPlayerId}
          isLocalDeath={entry.victimId === localPlayerId}
          isFadingOut={!!entry._fadingOut}
        />
      ))}
    </div>
  );
}

const KillFeed = memo(KillFeedInner);
export default KillFeed;
