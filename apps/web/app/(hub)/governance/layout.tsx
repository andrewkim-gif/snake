'use client';

/**
 * Governance Hub Layout — 서브 탭 네비게이션 (PROPOSALS / NEW / HISTORY)
 * 통합 SubTabNav 컴포넌트 사용
 */

import { useTranslations } from 'next-intl';
import { SubTabNav } from '@/components/hub';
import { Vote, Plus, History } from 'lucide-react';

export default function GovernanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tGov = useTranslations('governance');

  const tabs = [
    { key: 'proposals', label: tGov('proposals'), href: '/governance', icon: Vote },
    { key: 'new', label: tGov('new'), href: '/governance/new', icon: Plus },
    { key: 'history', label: tGov('history'), href: '/governance/history', icon: History },
  ];

  return (
    <div>
      <SubTabNav
        tabs={tabs}
        isActive={(tab, pathname) => {
          if (tab.key === 'proposals') return pathname === '/governance' || pathname === '/governance/';
          return pathname.startsWith(tab.href);
        }}
      />
      {children}
    </div>
  );
}
