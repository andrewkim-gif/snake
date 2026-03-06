'use client';

/**
 * TopNavBar — 데스크탑 상단 네비게이션 바
 * SK 팔레트 기반 밀리터리 다크 테마
 * WORLD | ECONOMY | GOVERN | FACTIONS | MORE▼
 */

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SK, bodyFont } from '@/lib/sketch-ui';
import { MoreMenu } from './MoreMenu';

/** 네비게이션 아이템 정의 */
export const NAV_ITEMS = [
  { label: 'WORLD', href: '/' },
  { label: 'ECONOMY', href: '/economy' },
  { label: 'GOVERN', href: '/governance' },
  { label: 'FACTIONS', href: '/factions' },
] as const;

/** MORE 메뉴 아이템 정의 */
export const MORE_ITEMS = [
  { label: 'HALL OF FAME', href: '/hall-of-fame', icon: '🏆' },
  { label: 'PROFILE', href: '/profile', icon: '👤' },
  { label: 'DASHBOARD', href: '/dashboard', icon: '🤖' },
  { label: 'SETTINGS', href: '/settings', icon: '⚙️', separator: true },
] as const;

/** 현재 pathname이 nav item에 매칭되는지 확인 */
function isActiveRoute(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname.startsWith(href);
}

/** MORE 메뉴 항목이 활성인지 확인 */
function isMoreActive(pathname: string): boolean {
  return MORE_ITEMS.some((item) => pathname.startsWith(item.href));
}

export function TopNavBar() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const toggleMore = useCallback(() => {
    setMoreOpen((prev) => !prev);
  }, []);

  const closeMore = useCallback(() => {
    setMoreOpen(false);
  }, []);

  return (
    <nav
      style={{
        display: 'none',
        alignItems: 'center',
        gap: '24px',
        height: '100%',
      }}
      className="top-nav-bar"
    >
      {/* 인라인 미디어쿼리용 style 태그 */}
      <style>{`
        @media (min-width: 768px) {
          .top-nav-bar { display: flex !important; }
        }
      `}</style>

      {/* 메인 네비게이션 아이템 */}
      {NAV_ITEMS.map((item) => {
        const active = isActiveRoute(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className="top-nav-item"
            style={{
              fontFamily: bodyFont,
              fontWeight: 700,
              fontSize: '13px',
              textTransform: 'uppercase',
              letterSpacing: '2px',
              color: active ? SK.gold : SK.textSecondary,
              textDecoration: 'none',
              position: 'relative',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              transition: 'color 150ms ease',
              paddingBottom: '2px',
            }}
            onMouseEnter={(e) => {
              if (!active) {
                e.currentTarget.style.color = SK.textPrimary;
              }
            }}
            onMouseLeave={(e) => {
              if (!active) {
                e.currentTarget.style.color = SK.textSecondary;
              }
            }}
          >
            {item.label}
            {/* 활성 인디케이터 — 하단 2px 골드 바 */}
            {active && (
              <span
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '2px',
                  background: SK.gold,
                  borderRadius: '1px 1px 0 0',
                }}
              />
            )}
          </Link>
        );
      })}

      {/* MORE 드롭다운 트리거 */}
      <div ref={moreRef} style={{ position: 'relative', height: '100%' }}>
        <button
          onClick={toggleMore}
          className="top-nav-item"
          style={{
            fontFamily: bodyFont,
            fontWeight: 700,
            fontSize: '13px',
            textTransform: 'uppercase',
            letterSpacing: '2px',
            color: isMoreActive(pathname) ? SK.gold : SK.textSecondary,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            transition: 'color 150ms ease',
            padding: 0,
            position: 'relative',
            paddingBottom: '2px',
          }}
          onMouseEnter={(e) => {
            if (!isMoreActive(pathname)) {
              e.currentTarget.style.color = SK.textPrimary;
            }
          }}
          onMouseLeave={(e) => {
            if (!isMoreActive(pathname)) {
              e.currentTarget.style.color = SK.textSecondary;
            }
          }}
        >
          MORE
          <span
            style={{
              fontSize: '8px',
              transition: 'transform 200ms ease',
              transform: moreOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          >
            ▼
          </span>
          {/* 활성 인디케이터 */}
          {isMoreActive(pathname) && (
            <span
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '2px',
                background: SK.gold,
                borderRadius: '1px 1px 0 0',
              }}
            />
          )}
        </button>

        {/* 데스크탑 드롭다운 메뉴 */}
        {moreOpen && (
          <MoreMenu
            mode="dropdown"
            onClose={closeMore}
            anchorRef={moreRef}
          />
        )}
      </div>
    </nav>
  );
}
