'use client';

/**
 * TopNavBar — 데스크탑 상단 네비게이션 바
 * v15: 핵심 3개 항목 + 햄버거 메뉴 (SideDrawer 트리거)
 * Chakra Petch + Space Grotesk + lucide 아이콘
 */

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { SK, bodyFont } from '@/lib/sketch-ui';
import { Globe, TrendingUp, Swords, Menu } from 'lucide-react';
import { SideDrawer } from './SideDrawer';
import type { LucideIcon } from 'lucide-react';

interface NavItem {
  key: string;
  href: string;
  icon: LucideIcon;
}

/** 헤더에 표시되는 핵심 3개 항목 */
const MAIN_NAV_ITEMS: NavItem[] = [
  { key: 'world', href: '/', icon: Globe },
  { key: 'economy', href: '/economy', icon: TrendingUp },
  { key: 'factions', href: '/factions', icon: Swords },
];

function isActiveRoute(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname.startsWith(href);
}

export function TopNavBar() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  return (
    <>
      <nav
        style={{
          display: 'none',
          alignItems: 'center',
          gap: '20px',
          height: '100%',
        }}
        className="top-nav-bar"
      >
        <style>{`
          @media (min-width: 768px) {
            .top-nav-bar { display: flex !important; }
          }
        `}</style>

        {/* 핵심 3개 항목 */}
        {MAIN_NAV_ITEMS.map((item) => {
          const active = isActiveRoute(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                height: '100%',
                position: 'relative',
                textDecoration: 'none',
                paddingBottom: '2px',
                transition: 'color 150ms ease',
                color: active ? SK.gold : SK.textSecondary,
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.color = SK.textPrimary;
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.color = SK.textSecondary;
              }}
            >
              <Icon size={16} strokeWidth={1.8} />
              <span style={{
                fontFamily: bodyFont,
                fontWeight: 600,
                fontSize: '12px',
                textTransform: 'uppercase',
                letterSpacing: '1.5px',
              }}>
                {t(item.key)}
              </span>

              {active && (
                <span style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '2px',
                  background: SK.gold,
                  borderRadius: '1px 1px 0 0',
                }} />
              )}
            </Link>
          );
        })}

        {/* 햄버거 메뉴 버튼 */}
        <button
          onClick={openDrawer}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: SK.textSecondary,
            padding: '0 2px',
            transition: 'color 150ms ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = SK.textPrimary; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = SK.textSecondary; }}
        >
          <Menu size={18} strokeWidth={1.8} />
        </button>
      </nav>

      {/* 사이드 드로어 */}
      <SideDrawer open={drawerOpen} onClose={closeDrawer} />
    </>
  );
}
