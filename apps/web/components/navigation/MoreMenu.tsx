'use client';

/**
 * MoreMenu — 추가 메뉴 (데스크탑 드롭다운 + 모바일 바텀시트)
 * 항목: HALL OF FAME, PROFILE, DASHBOARD, SETTINGS
 */

import { useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { SK, bodyFont, sketchShadow } from '@/lib/sketch-ui';

/** MORE 메뉴 아이템 — key는 nav 번역 네임스페이스의 키 */
const MORE_ITEMS = [
  { key: 'hallOfFame' as const, href: '/hall-of-fame', icon: '🏆' },
  { key: 'profile' as const, href: '/profile', icon: '👤' },
  { key: 'dashboard' as const, href: '/dashboard', icon: '🤖' },
];

const SETTINGS_ITEM = { key: 'settings' as const, href: '/settings', icon: '⚙️' };

interface MoreMenuProps {
  mode: 'dropdown' | 'bottomsheet';
  onClose: () => void;
  anchorRef?: React.RefObject<HTMLDivElement | null>;
}

/** 데스크탑 드롭다운 메뉴 */
function DropdownMenu({ onClose }: { onClose: () => void }) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 닫기
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        // 약간의 딜레이로 토글 버튼 클릭과 충돌 방지
        requestAnimationFrame(() => onClose());
      }
    }
    // 다음 틱에서 리스너 등록 (현재 클릭 이벤트 무시)
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 10);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      style={{
        position: 'absolute',
        top: 'calc(100% + 8px)',
        right: 0,
        minWidth: '200px',
        background: SK.cardBg,
        border: `1px solid ${SK.border}`,
        borderRadius: 0,
        boxShadow: sketchShadow('lg'),
        zIndex: 90,
        overflow: 'hidden',
        animation: 'dropdownFadeIn 150ms ease',
      }}
    >
      <style>{`
        @keyframes dropdownFadeIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {MORE_ITEMS.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 16px',
              fontFamily: bodyFont,
              fontWeight: 600,
              fontSize: '13px',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              color: active ? SK.gold : SK.textPrimary,
              textDecoration: 'none',
              transition: 'background 150ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = SK.cardBgHover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <span style={{ fontSize: '16px', width: '20px', textAlign: 'center' }}>
              {item.icon}
            </span>
            {t(item.key)}
          </Link>
        );
      })}

      {/* 구분선 */}
      <div
        style={{
          height: '1px',
          background: SK.border,
          margin: '0 12px',
        }}
      />

      {/* 세팅 */}
      <Link
        href={SETTINGS_ITEM.href}
        onClick={onClose}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '12px 16px',
          fontFamily: bodyFont,
          fontWeight: 600,
          fontSize: '13px',
          letterSpacing: '1px',
          textTransform: 'uppercase',
          color: SK.textSecondary,
          textDecoration: 'none',
          transition: 'background 150ms ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = SK.cardBgHover;
          e.currentTarget.style.color = SK.textPrimary;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = SK.textSecondary;
        }}
      >
        <span style={{ fontSize: '16px', width: '20px', textAlign: 'center' }}>
          {SETTINGS_ITEM.icon}
        </span>
        {t(SETTINGS_ITEM.key)}
      </Link>
    </div>
  );
}

/** 모바일 바텀시트 메뉴 */
function BottomSheetMenu({ onClose }: { onClose: () => void }) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const sheetRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  // 바깥 클릭 닫기
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === backdropRef.current) {
        onClose();
      }
    },
    [onClose]
  );

  // ESC 키 닫기
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const allItems = [...MORE_ITEMS, SETTINGS_ITEM];

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        inset: 0,
        background: SK.overlay,
        zIndex: 100,
        animation: 'bottomSheetBackdropIn 200ms ease',
      }}
    >
      <style>{`
        @keyframes bottomSheetBackdropIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes bottomSheetSlideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>

      <div
        ref={sheetRef}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          background: SK.cardBg,
          borderRadius: 0,
          paddingBottom: 'env(safe-area-inset-bottom, 20px)',
          animation: 'bottomSheetSlideUp 300ms cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        {/* 드래그 핸들 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '12px 0 8px',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '5px',
              borderRadius: 0,
              background: SK.textMuted,
            }}
          />
        </div>

        {/* 메뉴 아이템 */}
        {allItems.map((item, index) => {
          const active = pathname.startsWith(item.href);
          const isLast = index === allItems.length - 1;
          return (
            <div key={item.href}>
              {/* SETTINGS 전 구분선 */}
              {isLast && (
                <div
                  style={{
                    height: '1px',
                    background: SK.border,
                    margin: '4px 16px',
                  }}
                />
              )}
              <Link
                href={item.href}
                onClick={onClose}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '16px 20px',
                  fontFamily: bodyFont,
                  fontWeight: 600,
                  fontSize: '15px',
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  color: active ? SK.gold : SK.textPrimary,
                  textDecoration: 'none',
                }}
              >
                <span style={{ fontSize: '20px', width: '24px', textAlign: 'center' }}>
                  {item.icon}
                </span>
                {t(item.key)}
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 메인 MoreMenu — mode에 따라 드롭다운 또는 바텀시트 렌더링 */
export function MoreMenu({ mode, onClose }: MoreMenuProps) {
  if (mode === 'dropdown') {
    return <DropdownMenu onClose={onClose} />;
  }
  return <BottomSheetMenu onClose={onClose} />;
}
