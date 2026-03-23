'use client';

import { useRef, useEffect, useMemo } from 'react';
import { Flag, Sword, Home, Bomb, Bell } from 'lucide-react';
import type { IGlobalNews } from '@/hooks/useTycoonSocket';

// ─── 뉴스 타입별 아이콘 + 색상 매핑 ───
const NEWS_ICON_MAP: Record<string, { icon: typeof Flag; color: string }> = {
  territory_change: { icon: Flag, color: 'text-blue-400' },
  war_declared: { icon: Sword, color: 'text-red-400' },
  building_sold: { icon: Home, color: 'text-green-400' },
  battle_result: { icon: Bomb, color: 'text-orange-400' },
};
const DEFAULT_ICON = { icon: Bell, color: 'text-gray-400' };

const MAX_DISPLAY = 50;
const SEPARATOR = ' \u2022 ';

interface ITycoonNewsFeedProps {
  news: IGlobalNews[];
}

/** 하단 고정 마키 뉴스 티커 */
export default function TycoonNewsFeed({ news }: ITycoonNewsFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // 최대 50개로 제한
  const displayNews = useMemo(
    () => (news.length > MAX_DISPLAY ? news.slice(0, MAX_DISPLAY) : news),
    [news],
  );

  // 뉴스 변경 시 애니메이션 리셋
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.style.animation = 'none';
    // reflow 강제
    void el.offsetWidth;
    el.style.animation = '';
  }, [displayNews]);

  if (displayNews.length === 0) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 overflow-hidden bg-gray-900/90 backdrop-blur-sm border-t border-gray-700"
      style={{ height: '36px' }}
    >
      {/* 마키 컨테이너 */}
      <div
        ref={containerRef}
        className="flex items-center whitespace-nowrap h-full animate-marquee"
        style={{
          animationDuration: `${Math.max(20, displayNews.length * 4)}s`,
        }}
      >
        {displayNews.map((item, idx) => {
          const { icon: Icon, color } =
            NEWS_ICON_MAP[item.type] ?? DEFAULT_ICON;
          return (
            <span key={`${item._receivedAt}-${idx}`} className="inline-flex items-center">
              {idx > 0 && (
                <span className="mx-3 text-gray-500 select-none">{SEPARATOR.trim()}</span>
              )}
              <Icon className={`w-3.5 h-3.5 mr-1.5 flex-shrink-0 ${color}`} />
              <span className="text-xs text-gray-200">{item.message}</span>
            </span>
          );
        })}
      </div>

      {/* 마키 키프레임 — 인라인 스타일로 주입 */}
      <style jsx>{`
        @keyframes marquee {
          0% {
            transform: translateX(100%);
          }
          100% {
            transform: translateX(-100%);
          }
        }
        .animate-marquee {
          animation: marquee linear infinite;
        }
      `}</style>
    </div>
  );
}
