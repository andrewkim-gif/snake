'use client';

/**
 * NewsFeed — 글로벌 뉴스 피드 티커
 * S10: 하단 스크롤 뉴스 티커, 실시간 WebSocket 푸시, 24시간 아카이브
 * i18n: next-intl 기반 다국어 지원
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { SK, SKFont, bodyFont } from '@/lib/sketch-ui';

// next-intl Translator 함수 타입
type TFunc = ReturnType<typeof useTranslations<'news'>>;

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

// 뉴스 타입 → i18n 태그 키 매핑
const newsTypeTagKeys: Record<NewsEventType, string> = {
  sovereignty_change: 'tagSovereignty',
  battle_start: 'tagBattle',
  battle_end: 'tagVictory',
  war_declared: 'tagWar',
  treaty_signed: 'tagDiplomacy',
  economy_event: 'tagEconomy',
  season_event: 'tagSeason',
  global_event: 'tagGlobal',
};

interface NewsFeedProps {
  news?: NewsItem[];
  style?: React.CSSProperties;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

// 시간 포맷 (상대 시간) — tNews를 파라미터로 받아 i18n 지원
function formatTimeAgo(ts: number, tNews: TFunc): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return tNews('timeJustNow');
  if (mins < 60) return tNews('timeMinutesAgo', { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return tNews('timeHoursAgo', { count: hours });
  return tNews('timeDaysAgo', { count: Math.floor(hours / 24) });
}

// 티커 아이템 컴포넌트
function TickerItem({ item, tNews }: { item: NewsItem; tNews: TFunc }) {
  const color = newsTypeColors[item.type];
  const tag = tNews(newsTypeTagKeys[item.type]);

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
        borderRadius: 0,
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
        {formatTimeAgo(item.timestamp, tNews)}
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
  const tNews = useTranslations('news');
  const tickerRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const demoInitRef = useRef(false);
  const [internalNews, setInternalNews] = useState<NewsItem[]>([]);

  // 외부 뉴스가 실제로 있는지 안정적으로 판단 (빈 배열 ≠ 유효 데이터)
  const hasExternalNews = !!(externalNews && externalNews.length > 0);
  const allNews = hasExternalNews ? externalNews : internalNews;

  // 데모 뉴스 초기화 — 한 번만 실행 (tNews 변경에 재실행 안 함)
  useEffect(() => {
    if (hasExternalNews || demoInitRef.current) return;
    demoInitRef.current = true;
    const now = Date.now();
    setInternalNews([
      {
        id: 'demo-1',
        type: 'sovereignty_change',
        headline: tNews('demoSovereignty'),
        countryISO: 'KOR',
        factionName: 'Phoenix Coalition',
        timestamp: now - 120000,
      },
      {
        id: 'demo-2',
        type: 'battle_start',
        headline: tNews('demoBattleStart'),
        countryISO: 'DEU',
        timestamp: now - 240000,
      },
      {
        id: 'demo-3',
        type: 'war_declared',
        headline: tNews('demoWarDeclared'),
        factionName: 'Iron Wolves',
        timestamp: now - 480000,
      },
      {
        id: 'demo-4',
        type: 'economy_event',
        headline: tNews('demoEconomySurge'),
        countryISO: 'SAU',
        timestamp: now - 600000,
      },
      {
        id: 'demo-5',
        type: 'treaty_signed',
        headline: tNews('demoTreatySigned'),
        timestamp: now - 900000,
      },
      {
        id: 'demo-6',
        type: 'battle_end',
        headline: tNews('demoBattleWon'),
        countryISO: 'JPN',
        factionName: 'Phoenix Coalition',
        timestamp: now - 1200000,
      },
    ]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasExternalNews]);

  // 뉴스 아이템 개수 (effect 의존성 안정화용)
  const newsCount = allNews.length;

  // 티커 스크롤 애니메이션 — offset을 ref로 유지하여 재시작 방지
  useEffect(() => {
    if (!tickerRef.current || expanded || newsCount === 0) return;

    const el = tickerRef.current;
    let animFrame: number;
    const speed = 0.5; // px per frame

    const animate = () => {
      offsetRef.current += speed;
      const halfWidth = el.scrollWidth / 2;
      if (halfWidth > 0 && offsetRef.current >= halfWidth) {
        offsetRef.current = 0;
      }
      el.style.transform = `translateX(-${offsetRef.current}px)`;
      animFrame = requestAnimationFrame(animate);
    };

    animFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrame);
  }, [newsCount, expanded]);

  // 확장 뷰 (아카이브)
  if (expanded) {
    return (
      <div style={{
        background: 'rgba(14, 14, 18, 0.95)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
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
            {tNews('archive')}
          </span>
          <button
            onClick={onToggleExpand}
            style={{
              background: 'none',
              border: `1px solid ${SK.border}`,
              borderRadius: 0,
              color: SK.textSecondary,
              cursor: 'pointer',
              padding: '2px 8px',
              fontFamily: bodyFont,
              fontSize: SKFont.xs,
              fontWeight: 700,
            }}
          >
            {tNews('close')}
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
              borderRadius: 0,
              whiteSpace: 'nowrap',
              minWidth: '80px',
              textAlign: 'center',
            }}>
              {tNews(newsTypeTagKeys[item.type])}
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
              {formatTimeAgo(item.timestamp, tNews)}
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
        background: 'rgba(14, 14, 18, 0.90)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
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
          {tNews('live')}
        </span>
      </div>

      {/* 스크롤 티커 */}
      <div style={{ flex: 1, overflow: 'hidden', whiteSpace: 'nowrap' }}>
        <div ref={tickerRef} style={{ display: 'inline-block' }}>
          {/* 뉴스 2벌 (무한 스크롤용) */}
          {[...allNews, ...allNews].map((item, i) => (
            <TickerItem key={`${item.id}-${i}`} item={item} tNews={tNews} />
          ))}
        </div>
      </div>
    </div>
  );
}
