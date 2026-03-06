'use client';

/**
 * Economy Hub Layout — 서브 탭 네비게이션 (TOKENS / TRADE / POLICY)
 * 골드 underline 활성 스타일, 모바일 가로 스크롤
 */

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { SK, bodyFont } from '@/lib/sketch-ui';

const ECONOMY_TABS = [
  { key: 'tokens', label: 'TOKENS', href: '/economy/tokens' },
  { key: 'trade', label: 'TRADE', href: '/economy/trade' },
  { key: 'policy', label: 'POLICY', href: '/economy/policy' },
] as const;

export default function EconomyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // 현재 활성 탭 판별
  const activeTab = ECONOMY_TABS.find((tab) => pathname.startsWith(tab.href))?.key ?? 'tokens';

  return (
    <div>
      {/* 서브 탭 네비게이션 */}
      <nav
        style={{
          display: 'flex',
          gap: '0',
          borderBottom: `1px solid ${SK.border}`,
          marginBottom: '24px',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        <style>{`
          .economy-tabs::-webkit-scrollbar { display: none; }
        `}</style>
        <div
          className="economy-tabs"
          style={{
            display: 'flex',
            gap: '0',
            minWidth: 'max-content',
            overflowX: 'auto',
            scrollbarWidth: 'none',
          }}
        >
          {ECONOMY_TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <Link
                key={tab.key}
                href={tab.href}
                style={{
                  fontFamily: bodyFont,
                  fontWeight: 700,
                  fontSize: '13px',
                  letterSpacing: '2px',
                  textTransform: 'uppercase',
                  textDecoration: 'none',
                  color: isActive ? SK.orange : SK.textSecondary,
                  padding: '12px 20px',
                  borderBottom: isActive
                    ? `2px solid ${SK.orange}`
                    : '2px solid transparent',
                  transition: 'color 150ms ease, border-color 150ms ease',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* 콘텐츠 영역 */}
      {children}
    </div>
  );
}
