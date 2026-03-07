'use client';

/**
 * Factions Hub Layout — 서브 탭 네비게이션 (OVERVIEW / MARKET)
 * 통합 SubTabNav 컴포넌트 사용
 */

import { useTranslations } from 'next-intl';
import { SubTabNav } from '@/components/hub';
import { Swords, ShoppingCart } from 'lucide-react';

export default function FactionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tFaction = useTranslations('faction');

  const tabs = [
    { key: 'overview', label: tFaction('overview'), href: '/factions', icon: Swords },
    { key: 'mercenary', label: tFaction('mercenary'), href: '/factions/market', icon: ShoppingCart },
  ];

  return (
    <div>
      <SubTabNav
        tabs={tabs}
        isActive={(tab, pathname) => {
          if (tab.key === 'overview') {
            return pathname === '/factions' || pathname === '/factions/' || /^\/factions\/[^/]+$/.test(pathname) && pathname !== '/factions/market';
          }
          return pathname.startsWith(tab.href);
        }}
      />
      {children}
    </div>
  );
}
