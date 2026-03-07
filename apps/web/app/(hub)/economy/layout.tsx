'use client';

/**
 * Economy Hub Layout — 서브 탭 네비게이션 (TOKENS / TRADE / POLICY)
 * 통합 SubTabNav 컴포넌트 사용
 */

import { useTranslations } from 'next-intl';
import { SubTabNav } from '@/components/hub';
import { Coins, ArrowLeftRight, ScrollText } from 'lucide-react';

export default function EconomyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tEconomy = useTranslations('economy');

  const tabs = [
    { key: 'tokens', label: tEconomy('tokens'), href: '/economy/tokens', icon: Coins },
    { key: 'trade', label: tEconomy('trade'), href: '/economy/trade', icon: ArrowLeftRight },
    { key: 'policy', label: tEconomy('policy'), href: '/economy/policy', icon: ScrollText },
  ];

  return (
    <div>
      <SubTabNav
        tabs={tabs}
        isActive={(tab, pathname) => pathname.startsWith(tab.href)}
      />
      {children}
    </div>
  );
}
