'use client';

/**
 * /factions/[id] — 팩션 상세 페이지 (동적 라우트)
 * FactionDetail + TechTree + API 연동 (mock fallback 제거)
 */

import { Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { SK, SKFont, bodyFont } from '@/lib/sketch-ui';
import { ServerRequired } from '@/components/ui/ServerRequired';
import { getServerUrl } from '@/lib/api-client';

const FactionDetail = dynamic(() => import('@/components/faction/FactionDetail'), {
  loading: () => (
    <div style={{ color: SK.textSecondary, fontFamily: bodyFont, fontSize: SKFont.sm, padding: 24, textAlign: 'center' }}>
      Loading faction details...
    </div>
  ),
});

const TechTree = dynamic(() => import('@/components/faction/TechTree'), {
  loading: () => (
    <div style={{ color: SK.textSecondary, fontFamily: bodyFont, fontSize: SKFont.sm, padding: 24, textAlign: 'center' }}>
      Loading tech tree...
    </div>
  ),
});

function FactionDetailInner() {
  const params = useParams();
  const router = useRouter();
  const factionId = params.id as string;
  const serverUrl = getServerUrl();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <FactionDetail
        serverUrl={serverUrl}
        factionId={factionId}
        onBack={() => router.push('/factions')}
      />
      <TechTree factionId={factionId} readOnly={true} />
    </div>
  );
}

export default function FactionDetailPage() {
  return (
    <ServerRequired>
      <Suspense
        fallback={
          <div style={{ padding: '40px', textAlign: 'center', color: SK.textSecondary, fontFamily: bodyFont }}>
            ...
          </div>
        }
      >
        <FactionDetailInner />
      </Suspense>
    </ServerRequired>
  );
}
