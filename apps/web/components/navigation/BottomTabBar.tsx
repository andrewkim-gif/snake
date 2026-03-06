'use client';

/**
 * BottomTabBar — 모바일 하단 탭 바
 * 5개 탭: WORLD, ECONOMY, GOVERN, FACTIONS, MORE
 * 높이 56px + safe area, SK 팔레트 기반
 * 모바일만 표시 (md:hidden)
 */

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SK, bodyFont } from '@/lib/sketch-ui';
import { MoreMenu } from './MoreMenu';

/** 탭 아이템 정의 */
const TAB_ITEMS = [
  { label: 'WORLD', href: '/', icon: '🌍' },
  { label: 'ECONOMY', href: '/economy', icon: '💰' },
  { label: 'GOVERN', href: '/governance', icon: '🏛️' },
  { label: 'FACTIONS', href: '/factions', icon: '⚔️' },
] as const;

/** MORE 탭 아이콘 (3-dot) */
const MORE_TAB = { label: 'MORE', icon: '•••' } as const;

/** 현재 pathname이 tab에 매칭되는지 확인 */
function isActiveTab(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname.startsWith(href);
}

/** MORE 메뉴 항목 중 활성인지 확인 */
const MORE_HREFS = ['/hall-of-fame', '/profile', '/dashboard', '/settings'];
function isMoreTabActive(pathname: string): boolean {
  return MORE_HREFS.some((href) => pathname.startsWith(href));
}

export function BottomTabBar() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const toggleMore = useCallback(() => {
    setMoreOpen((prev) => !prev);
  }, []);

  const closeMore = useCallback(() => {
    setMoreOpen(false);
  }, []);

  return (
    <>
      <nav
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 80,
          height: '56px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          background: SK.cardBg,
          borderTop: `1px solid ${SK.border}`,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
        className="bottom-tab-bar"
      >
        {/* 모바일에서만 표시 */}
        <style>{`
          @media (min-width: 768px) {
            .bottom-tab-bar { display: none !important; }
          }
        `}</style>

        {/* 메인 탭 아이템 */}
        {TAB_ITEMS.map((item) => {
          const active = isActiveTab(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2px',
                flex: 1,
                height: '100%',
                textDecoration: 'none',
                position: 'relative',
                transition: 'color 150ms ease',
              }}
            >
              {/* 활성 인디케이터 — 상단 2px 골드 바 */}
              {active && (
                <span
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: '20%',
                    right: '20%',
                    height: '2px',
                    background: SK.gold,
                    borderRadius: '0 0 1px 1px',
                  }}
                />
              )}

              {/* 아이콘 */}
              <span style={{ fontSize: '20px', lineHeight: 1 }}>
                {item.icon}
              </span>

              {/* 라벨 */}
              <span
                style={{
                  fontFamily: bodyFont,
                  fontWeight: 700,
                  fontSize: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: active ? SK.gold : SK.textMuted,
                }}
              >
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* MORE 탭 */}
        <button
          onClick={toggleMore}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2px',
            flex: 1,
            height: '100%',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            position: 'relative',
            padding: 0,
          }}
        >
          {/* 활성 인디케이터 */}
          {isMoreTabActive(pathname) && (
            <span
              style={{
                position: 'absolute',
                top: 0,
                left: '20%',
                right: '20%',
                height: '2px',
                background: SK.gold,
                borderRadius: '0 0 1px 1px',
              }}
            />
          )}

          {/* 아이콘 — 3-dot */}
          <span
            style={{
              fontSize: '20px',
              lineHeight: 1,
              color: isMoreTabActive(pathname) ? SK.gold : SK.textMuted,
              letterSpacing: '2px',
            }}
          >
            {MORE_TAB.icon}
          </span>

          {/* 라벨 */}
          <span
            style={{
              fontFamily: bodyFont,
              fontWeight: 700,
              fontSize: '10px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: isMoreTabActive(pathname) ? SK.gold : SK.textMuted,
            }}
          >
            {MORE_TAB.label}
          </span>
        </button>
      </nav>

      {/* 모바일 바텀시트 */}
      {moreOpen && <MoreMenu mode="bottomsheet" onClose={closeMore} />}
    </>
  );
}
