'use client';

/**
 * NewsFeed — 글로벌 뉴스 피드 티커
 * S10: 하단 스크롤 뉴스 티커, 실시간 WebSocket 푸시, 24시간 아카이브
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { SK, SKFont, bodyFont } from '@/lib/sketch-ui';

// 뉴스 이벤트 타입
export type NewsEventType =
  | 'sovereignty_change'
  | 'battle_start'
  | 'battle_end'
  | 'war_declared'
  | 'treaty_signed'
  | 'economy_event'
  | 'season_event'
  | 'global_event';

export interface NewsItem {
  id: string;
  type: NewsEventType;
  headline: string;
  detail?: string;
  countryISO?: string;
  factionName?: string;
  timestamp: number; // unix ms
}

// 뉴스 타입별 색상
const newsTypeColors: Record<NewsEventType, string> = {
  sovereignty_change: '#22C55E',
  battle_start: '#EF4444',
  battle_end: '#F59E0B',
  war_declared: '#FF0000',
  treaty_signed: '#3B82F6',
  economy_event: '#CC9933',
  season_event: '#8B5CF6',
  global_event: '#EC4899',
};

// 뉴스 타입별 태그 텍스트
const newsTypeTags: Record<NewsEventType, string> = {
  sovereignty_change: 'SOVEREIGNTY',
  battle_start: 'BATTLE',
  battle_end: 'VICTORY',
  war_declared: 'WAR',
  treaty_signed: 'DIPLOMACY',
  economy_event: 'ECONOMY',
  season_event: 'SEASON',
  global_event: 'GLOBAL',
};

interface NewsFeedProps {
  news?: NewsItem[];
  style?: React.CSSProperties;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

// 기본 데모 뉴스 (서버 연결 전)
function generateDemoNews(): NewsItem[] {
  const now = Date.now();
  return [
    {
      id: 'demo-1',
      type: 'sovereignty_change',
      headline: 'Phoenix Coalition claims sovereignty over South Korea',
      countryISO: 'KOR',
      factionName: 'Phoenix Coalition',
      timestamp: now - 120000,
    },
    {
      id: 'demo-2',
      type: 'battle_start',
      headline: 'Battle erupting in Germany — 23 agents deployed',
      countryISO: 'DEU',
      timestamp: now - 240000,
    },
    {
      id: 'demo-3',
      type: 'war_declared',
      headline: 'Iron Wolves declares war on Shadow Syndicate',
      factionName: 'Iron Wolves',
      timestamp: now - 480000,
    },
    {
      id: 'demo-4',
      type: 'economy_event',
      headline: 'Oil prices surge — Saudi Arabia GDP +15%',
      countryISO: 'SAU',
      timestamp: now - 600000,
    },
    {
      id: 'demo-5',
      type: 'treaty_signed',
      headline: 'Trade agreement signed between Red Dragon and Blue Storm',
      timestamp: now - 900000,
    },
    {
      id: 'demo-6',
      type: 'battle_end',
      headline: 'Phoenix Coalition wins decisive battle in Japan',
      countryISO: 'JPN',
      factionName: 'Phoenix Coalition',
      timestamp: now - 1200000,
    },
  ];
}

// 시간 포맷 (상대 시간)
function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'JUST NOW';
  if (mins < 60) return `${mins}M AGO`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}H AGO`;
  return `${Math.floor(hours / 24)}D AGO`;
}

// 티커 아이템 컴포넌트
function TickerItem({ item }: { item: NewsItem }) {
  const color = newsTypeColors[item.type];
  const tag = newsTypeTags[item.type];

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      whiteSpace: 'nowrap',
      marginRight: '48px',
    }}>
      {/* 타입 태그 */}
      <span style={{
        fontFamily: bodyFont,
        fontSize: '10px',
        color,
        fontWeight: 700,
        letterSpacing: '1px',
        padding: '1px 6px',
        border: `1px solid ${color}40`,
        borderRadius: '2px',
      }}>
        {tag}
      </span>

      {/* 헤드라인 */}
      <span style={{
        fontFamily: bodyFont,
        fontSize: SKFont.sm,
        color: SK.textPrimary,
        fontWeight: 500,
      }}>
        {item.headline}
      </span>

      {/* 시간 */}
      <span style={{
        fontFamily: bodyFont,
        fontSize: '10px',
        color: SK.textMuted,
        fontWeight: 600,
        letterSpacing: '1px',
      }}>
        {formatTimeAgo(item.timestamp)}
      </span>

      {/* 구분선 */}
      <span style={{
        color: SK.textMuted,
        opacity: 0.3,
        fontSize: '10px',
      }}>
        |
      </span>
    </span>
  );
}

export function NewsFeed({
  news: externalNews,
  style,
  expanded = false,
  onToggleExpand,
}: NewsFeedProps) {
  const [internalNews, setInternalNews] = useState<NewsItem[]>([]);
  const tickerRef = useRef<HTMLDivElement>(null);

  // 뉴스 소스 결정 (외부 또는 데모)
  const allNews = externalNews && externalNews.length > 0 ? externalNews : internalNews;

  // 데모 뉴스 초기화
  useEffect(() => {
    if (!externalNews || externalNews.length === 0) {
      setInternalNews(generateDemoNews());
    }
  }, [externalNews]);

  // 티커 스크롤 애니메이션
  useEffect(() => {
    if (!tickerRef.current || expanded) return;

    const el = tickerRef.current;
    let animFrame: number;
    let offset = 0;
    const speed = 0.5; // px per frame

    const animate = () => {
      offset += speed;
      if (offset >= el.scrollWidth / 2) {
        offset = 0;
      }
      el.style.transform = `translateX(-${offset}px)`;
      animFrame = requestAnimationFrame(animate);
    };

    animFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrame);
  }, [allNews, expanded]);

  // 확장 뷰 (아카이브)
  if (expanded) {
    return (
      <div style={{
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(0, 0, 0, 0.06)',
        padding: '12px 20px',
        maxHeight: '40vh',
        overflowY: 'auto',
        ...style,
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
        }}>
          <span style={{
            fontFamily: bodyFont,
            fontWeight: 800,
            fontSize: SKFont.h3,
            color: SK.textPrimary,
            letterSpacing: '2px',
          }}>
            NEWS ARCHIVE
          </span>
          <button
            onClick={onToggleExpand}
            style={{
              background: 'none',
              border: `1px solid ${SK.border}`,
              borderRadius: '3px',
              color: SK.textSecondary,
              cursor: 'pointer',
              padding: '2px 8px',
              fontFamily: bodyFont,
              fontSize: SKFont.xs,
              fontWeight: 700,
            }}
          >
            CLOSE
          </button>
        </div>

        {allNews.map((item) => (
          <div
            key={item.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              padding: '8px 0',
              borderBottom: `1px solid ${SK.borderDark}`,
            }}
          >
            <span style={{
              fontFamily: bodyFont,
              fontSize: '10px',
              color: newsTypeColors[item.type],
              fontWeight: 700,
              letterSpacing: '1px',
              padding: '2px 6px',
              border: `1px solid ${newsTypeColors[item.type]}40`,
              borderRadius: '2px',
              whiteSpace: 'nowrap',
              minWidth: '80px',
              textAlign: 'center',
            }}>
              {newsTypeTags[item.type]}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{
                fontFamily: bodyFont,
                fontSize: SKFont.sm,
                color: SK.textPrimary,
                fontWeight: 500,
              }}>
                {item.headline}
              </div>
              {item.detail && (
                <div style={{
                  fontFamily: bodyFont,
                  fontSize: SKFont.xs,
                  color: SK.textSecondary,
                  marginTop: '2px',
                }}>
                  {item.detail}
                </div>
              )}
            </div>
            <span style={{
              fontFamily: bodyFont,
              fontSize: '10px',
              color: SK.textMuted,
              fontWeight: 600,
              letterSpacing: '1px',
              whiteSpace: 'nowrap',
            }}>
              {formatTimeAgo(item.timestamp)}
            </span>
          </div>
        ))}
      </div>
    );
  }

  // 기본 티커 뷰
  return (
    <div
      style={{
        background: 'rgba(255, 255, 255, 0.92)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        borderTop: '1px solid rgba(0, 0, 0, 0.06)',
        height: '36px',
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
        cursor: 'pointer',
        ...style,
      }}
      onClick={onToggleExpand}
    >
      {/* LIVE 뱃지 */}
      <div style={{
        padding: '0 12px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        borderRight: `1px solid ${SK.border}`,
        height: '100%',
        flexShrink: 0,
      }}>
        <div style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: '#EF4444',
          animation: 'pulse 1.5s infinite',
        }} />
        <span style={{
          fontFamily: bodyFont,
          fontSize: '10px',
          color: '#EF4444',
          fontWeight: 700,
          letterSpacing: '2px',
        }}>
          LIVE
        </span>
      </div>

      {/* 스크롤 티커 */}
      <div style={{ flex: 1, overflow: 'hidden', whiteSpace: 'nowrap' }}>
        <div ref={tickerRef} style={{ display: 'inline-block' }}>
          {/* 뉴스 2벌 (무한 스크롤용) */}
          {[...allNews, ...allNews].map((item, i) => (
            <TickerItem key={`${item.id}-${i}`} item={item} />
          ))}
        </div>
      </div>
    </div>
  );
}
