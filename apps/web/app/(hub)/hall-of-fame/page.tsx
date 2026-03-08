'use client';

/**
 * /hall-of-fame — 명예의 전당
 * HallOfFame 서버 컴포넌트 사용 (mock fallback 제거)
 */

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { SK, bodyFont } from '@/lib/sketch-ui';
import { ServerRequired } from '@/components/ui/ServerRequired';
import { getServerUrl } from '@/lib/api-client';

const HallOfFame = dynamic(() => import('@/components/hall-of-fame/HallOfFame'), {
  loading: () => (
    <div style={{ color: SK.textSecondary, fontFamily: bodyFont, padding: 40, textAlign: 'center' }}>
      ...
    </div>
  ),
});

function HallOfFameInner() {
  const serverUrl = getServerUrl();
  return <HallOfFame serverUrl={serverUrl} />;
}

export default function HallOfFamePage() {
  return (
    <ServerRequired>
      <Suspense
        fallback={
          <div style={{ padding: '40px', textAlign: 'center', color: SK.textSecondary, fontFamily: bodyFont }}>
            ...
          </div>
        }
      >
        <HallOfFameInner />
      </Suspense>
    </ServerRequired>
  );
}
