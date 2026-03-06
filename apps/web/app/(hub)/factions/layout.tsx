'use client';

/**
 * Factions Hub Layout — 서브 탭 네비게이션 (OVERVIEW / TECH TREE / MERCENARY)
 * 골드 underline 활성 스타일, 모바일 가로 스크롤
 * Economy/Governance layout 패턴 참조
 */

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { SK, bodyFont } from '@/lib/sketch-ui';

const FACTIONS_TABS = [
  { key: 'overview', label: 'OVERVIEW', href: '/factions' },
  { key: 'tech-tree', label: 'TECH TREE', href: '/factions/market' },
  { key: 'mercenary', label: 'MERCENARY', href: '/factions/market' },
] as const;

export default function FactionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // 현재 활성 탭 판별
  const activeTab = (() => {
    if (pathname === '/factions' || pathname === '/factions/') return 'overview';
    // 동적 팩션 상세 라우트 — tech-tree 탭으로 매핑
    if (pathname.match(/^\/factions\/[^/]+$/) && pathname !== '/factions/market') return 'tech-tree';
    if (pathname.startsWith('/factions/market')) return 'mercenary';
    return 'overview';
  })();

  // 실제 탭 href (tech-tree는 현재 팩션 상세로 동적으로 매핑되므로 탭 정의 재구성)
  const tabs = [
    { key: 'overview', label: 'OVERVIEW', href: '/factions' },
    { key: 'tech-tree', label: 'TECH TREE', href: '/factions' },
    { key: 'mercenary', label: 'MERCENARY', href: '/factions/market' },
  ] as const;

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
          .factions-tabs::-webkit-scrollbar { display: none; }
        `}</style>
        <div
          className="factions-tabs"
          style={{
            display: 'flex',
            gap: '0',
            minWidth: 'max-content',
            overflowX: 'auto',
            scrollbarWidth: 'none',
          }}
        >
          {tabs.map((tab) => {
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
