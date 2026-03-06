'use client';

/**
 * Governance Hub Layout — 서브 탭 네비게이션 (PROPOSALS / NEW / HISTORY)
 * 골드 underline 활성 스타일, 모바일 가로 스크롤
 * Economy layout.tsx 패턴 참조
 */

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { SK, bodyFont } from '@/lib/sketch-ui';

const GOVERNANCE_TABS = [
  { key: 'proposals', label: 'PROPOSALS', href: '/governance' },
  { key: 'new', label: 'NEW', href: '/governance/new' },
  { key: 'history', label: 'HISTORY', href: '/governance/history' },
] as const;

export default function GovernanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // 현재 활성 탭 판별
  const activeTab = (() => {
    if (pathname === '/governance' || pathname === '/governance/') return 'proposals';
    if (pathname.startsWith('/governance/new')) return 'new';
    if (pathname.startsWith('/governance/history')) return 'history';
    return 'proposals';
  })();

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
          .governance-tabs::-webkit-scrollbar { display: none; }
        `}</style>
        <div
          className="governance-tabs"
          style={{
            display: 'flex',
            gap: '0',
            minWidth: 'max-content',
            overflowX: 'auto',
            scrollbarWidth: 'none',
          }}
        >
          {GOVERNANCE_TABS.map((tab) => {
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
