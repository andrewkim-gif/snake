'use client';

/**
 * HubLayout — 리디렉트 래퍼
 * 기존 허브 라우트(/economy, /factions 등) 방문 시
 * 메인 페이지의 GameSystemPopup으로 리디렉트
 * 허브 page 파일들은 GameSystemPopup에서 dynamic import로 사용됨
 */

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { SK, bodyFont } from '@/lib/sketch-ui';

const ROUTE_MAP: Record<string, string> = {
  '/economy': '/?panel=economy&tab=tokens',
  '/economy/tokens': '/?panel=economy&tab=tokens',
  '/economy/trade': '/?panel=economy&tab=trade',
  '/economy/policy': '/?panel=economy&tab=policy',
  '/factions': '/?panel=factions&tab=overview',
  '/factions/market': '/?panel=factions&tab=market',
  '/governance': '/?panel=governance&tab=proposals',
  '/governance/new': '/?panel=governance&tab=new',
  '/governance/history': '/?panel=governance&tab=history',
  '/hall-of-fame': '/?panel=hallOfFame',
  '/profile': '/?panel=profile',
};

export default function HubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let target = ROUTE_MAP[pathname];
    if (!target) {
      // /factions/[id] → factions 패널로 리디렉트
      if (pathname.startsWith('/factions/')) target = '/?panel=factions&tab=overview';
      else target = '/?panel=economy&tab=tokens';
    }
    router.replace(target);
  }, [pathname, router]);

  // 리디렉트 중 빈 화면 표시 (짧은 시간)
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: SK.bg,
      fontFamily: bodyFont,
      fontSize: '12px',
      color: SK.textMuted,
      letterSpacing: '2px',
    }}>
      REDIRECTING...
    </div>
  );
}
