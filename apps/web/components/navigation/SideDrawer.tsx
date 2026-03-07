'use client';

/**
 * SideDrawer — 우측 슬라이드 네비게이션 드로어
 * 헤더 햄버거 메뉴에서 열리는 추가 네비게이션
 * v15: Header 3 + Side Drawer 패턴
 */

import { useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { X, Trophy, Landmark, User, LayoutDashboard, Settings } from 'lucide-react';
import { SK, bodyFont, headingFont } from '@/lib/sketch-ui';
import type { LucideIcon } from 'lucide-react';

interface DrawerItem {
  key: string;
  href: string;
  icon: LucideIcon;
}

const DRAWER_ITEMS: DrawerItem[] = [
  { key: 'govern', href: '/governance', icon: Landmark },
  { key: 'hallOfFame', href: '/hall-of-fame', icon: Trophy },
  { key: 'profile', href: '/profile', icon: User },
  { key: 'dashboard', href: '/dashboard', icon: LayoutDashboard },
  { key: 'settings', href: '/settings', icon: Settings },
];

function isActiveRoute(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname.startsWith(href);
}

interface SideDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function SideDrawer({ open, onClose }: SideDrawerProps) {
  const t = useTranslations('nav');
  const pathname = usePathname();

  // ESC 키로 닫기
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // 라우트 변경 시 닫기
  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  return (
    <>
      {/* 배경 오버레이 */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 200,
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 200ms ease',
        }}
        onClick={onClose}
      />

      {/* 드로어 패널 */}
      <div style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: 'min(280px, 80vw)',
        height: '100vh',
        zIndex: 201,
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 300ms cubic-bezier(0.16, 1, 0.3, 1)',
        background: 'rgba(9,9,11,0.92)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderLeft: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* 헤더 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: `1px solid ${SK.border}`,
        }}>
          <span style={{
            fontFamily: headingFont,
            fontSize: '14px',
            fontWeight: 600,
            color: SK.textSecondary,
            letterSpacing: '3px',
            textTransform: 'uppercase',
          }}>
            MENU
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: `1px solid ${SK.border}`,
              borderRadius: '4px',
              color: SK.textSecondary,
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'color 150ms ease',
            }}
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        {/* 네비게이션 아이템 */}
        <nav style={{
          flex: 1,
          padding: '12px 0',
          overflowY: 'auto',
        }}>
          {DRAWER_ITEMS.map((item) => {
            const active = isActiveRoute(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 20px',
                  textDecoration: 'none',
                  color: active ? SK.gold : SK.textSecondary,
                  backgroundColor: active ? `${SK.gold}08` : 'transparent',
                  borderLeft: active ? `2px solid ${SK.gold}` : '2px solid transparent',
                  transition: 'all 150ms ease',
                }}
              >
                <Icon size={18} strokeWidth={1.8} />
                <span style={{
                  fontFamily: bodyFont,
                  fontSize: '14px',
                  fontWeight: 600,
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                }}>
                  {t(item.key)}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* 하단 버전 정보 */}
        <div style={{
          padding: '16px 20px',
          borderTop: `1px solid ${SK.border}`,
        }}>
          <span style={{
            fontFamily: bodyFont,
            fontSize: '10px',
            color: SK.textMuted,
            letterSpacing: '1px',
          }}>
            AI WORLD WAR v15
          </span>
        </div>
      </div>
    </>
  );
}
