'use client';

/**
 * NewsFeed — 글로벌 뉴스 피드 티커
 * S10: 하단 스크롤 뉴스 티커, 실시간 WebSocket 푸시, 24시간 아카이브
 * i18n: next-intl 기반 다국어 지원
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { SK, SKFont, bodyFont } from '@/lib/sketch-ui';
import { OVERLAY, NEWS_TYPE_COLORS, KEYFRAMES_PULSE } from '@/lib/overlay-tokens';

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

// 뉴스 타입별 색상 — overlay-tokens.ts의 NEWS_TYPE_COLORS (3D 이펙트 동기화)
const newsTypeColors: Record<NewsEventType, string> = NEWS_TYPE_COLORS as Record<NewsEventType, string>;

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

  // 스냅샷 패턴: 티커에 표시 중인 뉴스는 ref로 고정하여 스크롤 중 DOM 변경 방지
  const [displayNews, setDisplayNews] = useState<NewsItem[]>([]);
  const pendingNewsRef = useRef<NewsItem[]>([]);
  const needsUpdateRef = useRef(false);

  // 외부 뉴스가 실제로 있는지 안정적으로 판단 (빈 배열 ≠ 유효 데이터)
  const hasExternalNews = !!(externalNews && externalNews.length > 0);
  const allNews = hasExternalNews ? externalNews : internalNews;

  // 새 뉴스가 도착하면 pending에 저장 (즉시 표시 안 함)
  useEffect(() => {
    if (allNews.length === 0) return;
    // 최초 또는 확장 뷰에서는 즉시 반영
    if (displayNews.length === 0 || expanded) {
      setDisplayNews(allNews);
      return;
    }
    // 스크롤 중이면 pending에 대기
    pendingNewsRef.current = allNews;
    needsUpdateRef.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allNews, expanded]);

  // 스크롤 사이클 완료 시 pending 뉴스를 교체하는 콜백
  const commitPendingNews = useCallback(() => {
    if (needsUpdateRef.current && pendingNewsRef.current.length > 0) {
      setDisplayNews(pendingNewsRef.current);
      pendingNewsRef.current = [];
      needsUpdateRef.current = false;
    }
  }, []);

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

  // displayNews 개수 (effect 의존성 안정화)
  const displayCount = displayNews.length;

  // 티커 스크롤 애니메이션 — 사이클 완료 시 pending 뉴스 교체
  useEffect(() => {
    if (!tickerRef.current || expanded || displayCount === 0) return;

    const el = tickerRef.current;
    let animFrame: number;
    const speed = 0.5; // px per frame

    const animate = () => {
      offsetRef.current += speed;
      const halfWidth = el.scrollWidth / 2;
      if (halfWidth > 0 && offsetRef.current >= halfWidth) {
        offsetRef.current = 0;
        // 스크롤 사이클 완료 → pending 뉴스 교체 (DOM 안정적 전환)
        commitPendingNews();
      }
      el.style.transform = `translateX(-${offsetRef.current}px)`;
      animFrame = requestAnimationFrame(animate);
    };

    animFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrame);
  }, [displayCount, expanded, commitPendingNews]);

  // 확장 뷰 (아카이브)
  if (expanded) {
    return (
      <div style={{
        background: OVERLAY.bg,
        backdropFilter: OVERLAY.blur,
        WebkitBackdropFilter: OVERLAY.blur,
        borderTop: OVERLAY.border,
        padding: '12px 20px',
        maxHeight: '40vh',
        overflowY: 'auto',
        transition: `all ${OVERLAY.transition}`,
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
        background: OVERLAY.bg,
        backdropFilter: OVERLAY.blur,
        WebkitBackdropFilter: OVERLAY.blur,
        borderTop: OVERLAY.border,
        transition: `all ${OVERLAY.transition}`,
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
          animation: 'effectPulse 1.5s infinite',
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

      {/* 스크롤 티커 — displayNews (스냅샷)로 렌더링, 사이클 완료 시만 교체 */}
      <div style={{ flex: 1, overflow: 'hidden', whiteSpace: 'nowrap' }}>
        <div ref={tickerRef} style={{ display: 'inline-block' }}>
          {/* 뉴스 2벌 (무한 스크롤용) */}
          {[...displayNews, ...displayNews].map((item, i) => (
            <TickerItem key={`${item.id}-dup${i}`} item={item} tNews={tNews} />
          ))}
        </div>
      </div>

      {/* 통일 pulse 키프레임 (overlay-tokens.ts) */}
      <style>{KEYFRAMES_PULSE}</style>
    </div>
  );
}
