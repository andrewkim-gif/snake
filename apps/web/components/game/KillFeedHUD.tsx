'use client';

/**
 * KillFeedHUD — 킬피드 오버레이 (슬라이드 인 + 3초 페이드 아웃)
 * v12 S24: HTML 오버레이로 킬 발생 시 피드 애니메이션
 * 화면 좌측 상단, Dark Tactical 스타일
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { GameData } from '@/hooks/useSocket';

interface KillFeedEntry {
  id: string;
  killerName: string;
  victimName: string;
  timestamp: number;
}

interface KillFeedHUDProps {
  dataRef: React.MutableRefObject<GameData>;
}

const MAX_ENTRIES = 5;
const ENTRY_LIFETIME = 3000; // 3초 후 페이드 아웃
const FADE_DURATION = 500;   // 페이드 아웃 시간

export function KillFeedHUD({ dataRef }: KillFeedHUDProps) {
  const [entries, setEntries] = useState<KillFeedEntry[]>([]);
  const lastKillCountRef = useRef(0);
  const entryIdRef = useRef(0);

  // 킬피드 폴링 (rAF 기반 — useSocket의 dataRef.killFeed 변화 감지)
  useEffect(() => {
    let raf = 0;
    const poll = () => {
      const feed = dataRef.current.killFeed;
      if (feed.length !== lastKillCountRef.current) {
        // 새 킬 이벤트 감지
        const newCount = feed.length - lastKillCountRef.current;
        if (newCount > 0) {
          const newEntries: KillFeedEntry[] = [];
          for (let i = 0; i < Math.min(newCount, 3); i++) {
            const kill = feed[i];
            if (!kill) continue;
            entryIdRef.current++;
            newEntries.push({
              id: `kf-${entryIdRef.current}`,
              // 킬러 이름: playerId의 에이전트 이름 (KillPayload에 killer 이름 없음 → "You" 사용)
              killerName: 'Agent',
              victimName: kill.victimName ?? kill.victim ?? 'Unknown',
              timestamp: Date.now(),
            });
          }
          setEntries(prev => [...newEntries, ...prev].slice(0, MAX_ENTRIES));
        }
        lastKillCountRef.current = feed.length;
      }
      raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
  }, [dataRef]);

  // 만료된 엔트리 제거
  useEffect(() => {
    if (entries.length === 0) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setEntries(prev => prev.filter(e => now - e.timestamp < ENTRY_LIFETIME + FADE_DURATION));
    }, 500);
    return () => clearInterval(timer);
  }, [entries.length]);

  if (entries.length === 0) return null;

  return (
    <div style={{
      position: 'absolute',
      top: '48px',
      left: '12px',
      zIndex: 15,
      pointerEvents: 'none',
      display: 'flex',
      flexDirection: 'column',
      gap: '3px',
      maxWidth: '260px',
    }}>
      {entries.map((entry) => (
        <KillFeedItem key={entry.id} entry={entry} />
      ))}

      {/* CSS 애니메이션 키프레임 */}
      <style>{`
        @keyframes killFeedSlideIn {
          0% { opacity: 0; transform: translateX(-20px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        @keyframes killFeedFadeOut {
          0% { opacity: 1; }
          100% { opacity: 0; transform: translateX(-10px); }
        }
      `}</style>
    </div>
  );
}

function KillFeedItem({ entry }: { entry: KillFeedEntry }) {
  const elapsed = Date.now() - entry.timestamp;
  const isFading = elapsed > ENTRY_LIFETIME;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      padding: '3px 8px',
      backgroundColor: 'rgba(17, 17, 17, 0.8)',
      border: '1px solid rgba(255, 85, 85, 0.3)',
      borderLeft: '3px solid #FF5555',
      animation: isFading
        ? `killFeedFadeOut ${FADE_DURATION}ms ease-out forwards`
        : `killFeedSlideIn 300ms ease-out`,
    }}>
      {/* 킬 아이콘 (검) */}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="#FF5555" style={{ opacity: 0.8, flexShrink: 0 }}>
        <path d="M6.92 5L5 7l6 6-5 5 1.5 1.5 5-5 5 5L19 18l-5-5 6-6-2-2-6 6-5.08-6z" />
      </svg>

      {/* 킬 텍스트 */}
      <span style={{
        fontFamily: '"Rajdhani", "Inter", sans-serif',
        fontSize: '11px',
        fontWeight: 600,
        color: '#E8E0D4',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        <span style={{ color: '#FF5555' }}>
          {entry.victimName}
        </span>
        <span style={{ color: '#888888', marginLeft: '4px' }}>
          eliminated
        </span>
      </span>
    </div>
  );
}
