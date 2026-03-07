'use client';

/**
 * SubTabNav — 허브 페이지 서브 탭 네비게이션
 * 일관된 인디고 underline + 모바일 가로 스크롤
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SK, bodyFont } from '@/lib/sketch-ui';
import type { LucideIcon } from 'lucide-react';

export interface SubTab {
  key: string;
  label: string;
  href: string;
  icon?: LucideIcon;
}

interface SubTabNavProps {
  tabs: SubTab[];
  /** 활성 탭 판별 함수 (기본: pathname.startsWith(href)) */
  isActive?: (tab: SubTab, pathname: string) => boolean;
  className?: string;
}

function defaultIsActive(tab: SubTab, pathname: string): boolean {
  if (tab.href === '/' || tab.href.endsWith('/')) {
    return pathname === tab.href || pathname === tab.href.replace(/\/$/, '');
  }
  return pathname.startsWith(tab.href);
}

export function SubTabNav({ tabs, isActive, className }: SubTabNavProps) {
  const pathname = usePathname();
  const checkActive = isActive ?? defaultIsActive;

  return (
    <nav
      style={{
        display: 'flex',
        gap: 0,
        borderBottom: `1px solid ${SK.border}`,
        marginBottom: '20px',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}
    >
      <style>{`
        .hub-subtab-scroll::-webkit-scrollbar { display: none; }
      `}</style>
      <div
        className={`hub-subtab-scroll ${className ?? ''}`}
        style={{
          display: 'flex',
          gap: 0,
          minWidth: 'max-content',
          overflowX: 'auto',
          scrollbarWidth: 'none',
        }}
      >
        {tabs.map((tab) => {
          const active = checkActive(tab, pathname);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontFamily: bodyFont,
                fontWeight: 600,
                fontSize: '12px',
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                textDecoration: 'none',
                color: active ? SK.accent : SK.textSecondary,
                padding: '10px 16px',
                borderBottom: active
                  ? `1px solid ${SK.accent}`
                  : '1px solid transparent',
                transition: 'color 150ms ease, border-color 150ms ease',
                whiteSpace: 'nowrap',
              }}
            >
              {Icon && <Icon size={14} strokeWidth={1.8} />}
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
