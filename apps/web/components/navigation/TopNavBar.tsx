'use client';

/**
 * TopNavBar — 데스크탑 상단 네비게이션 바
 * SK 팔레트 기반 밀리터리 다크 테마
 * v15: 8개 항목 flat 레이아웃 + lucide 아이콘
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { SK, bodyFont } from '@/lib/sketch-ui';
import {
  Globe, TrendingUp, Landmark, Swords,
  Trophy, User, LayoutDashboard, Settings,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface NavItem {
  key: string;
  href: string;
  icon: LucideIcon;
}

const ALL_NAV_ITEMS: NavItem[] = [
  { key: 'world', href: '/', icon: Globe },
  { key: 'economy', href: '/economy', icon: TrendingUp },
  { key: 'govern', href: '/governance', icon: Landmark },
  { key: 'factions', href: '/factions', icon: Swords },
  { key: 'hallOfFame', href: '/hall-of-fame', icon: Trophy },
  { key: 'profile', href: '/profile', icon: User },
  { key: 'dashboard', href: '/dashboard', icon: LayoutDashboard },
  { key: 'settings', href: '/settings', icon: Settings },
];

function isActiveRoute(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname.startsWith(href);
}

export function TopNavBar() {
  const t = useTranslations('nav');
  const pathname = usePathname();

  return (
    <nav
      style={{
        display: 'none',
        alignItems: 'center',
        gap: '16px',
        height: '100%',
      }}
      className="top-nav-bar"
    >
      <style>{`
        @media (min-width: 768px) {
          .top-nav-bar { display: flex !important; }
        }
      `}</style>

      {ALL_NAV_ITEMS.map((item) => {
        const active = isActiveRoute(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="top-nav-item"
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
              fontWeight: 700,
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '1.5px',
            }}>
              {t(item.key)}
            </span>

            {/* 활성 인디케이터 — 하단 2px 골드 바 */}
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
    </nav>
  );
}
