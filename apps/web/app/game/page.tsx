'use client';

/**
 * /game — 테스트 룸 (Matrix 게임 직접 진입)
 *
 * 로비/글로브 스킵하고 즉시 Matrix 게임을 시작하는 개발용 페이지.
 * URL 파라미터로 설정 가능:
 *   ?class=neo        — 캐릭터 클래스 (기본: neo)
 *   ?country=KOR      — 국가 ISO3 코드 (기본: KOR)
 *   ?online=true      — 온라인 모드 (기본: false)
 *   ?server=ws://...  — 서버 URL (온라인 모드 시)
 */

import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import type { PlayerClass } from '@/lib/matrix/types';
import { SK, headingFont, bodyFont } from '@/lib/sketch-ui';

const MatrixApp = dynamic(
  () => import('@/components/game/matrix/MatrixApp').then(m => ({ default: m.MatrixApp })),
  { ssr: false },
);

// ISO3 → 국가명 간이 매핑
const COUNTRY_NAMES: Record<string, string> = {
  KOR: 'South Korea', USA: 'United States', JPN: 'Japan', CHN: 'China',
  GBR: 'United Kingdom', DEU: 'Germany', FRA: 'France', RUS: 'Russia',
  BRA: 'Brazil', IND: 'India', AUS: 'Australia', CAN: 'Canada',
};

function GamePageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const playerClass = (searchParams.get('class') || 'neo') as PlayerClass;
  const countryIso3 = searchParams.get('country') || 'KOR';
  const countryName = COUNTRY_NAMES[countryIso3] || countryIso3;
  const isOnline = searchParams.get('online') === 'true';
  const serverUrl = searchParams.get('server') || undefined;

  return (
    <div style={{
      width: '100vw',
      height: '100dvh',
      overflow: 'hidden',
      backgroundColor: '#000',
      position: 'relative',
    }}>
      {/* 좌측 상단 테스트 정보 배지 */}
      <div style={{
        position: 'fixed',
        top: 8,
        left: 8,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '6px 10px',
        background: 'rgba(0,0,0,0.8)',
        border: '1px solid #333',
        borderLeft: '3px solid #F59E0B',
        backdropFilter: 'blur(4px)',
        fontFamily: bodyFont,
        fontSize: 10,
        color: '#888',
        pointerEvents: 'none',
      }}>
        <span style={{
          fontFamily: headingFont,
          fontSize: 11,
          color: '#F59E0B',
          letterSpacing: '0.08em',
        }}>
          TEST ROOM
        </span>
        <span>Class: <b style={{ color: '#E8E0D4' }}>{playerClass}</b></span>
        <span>Country: <b style={{ color: '#E8E0D4' }}>{countryName}</b></span>
        <span>Mode: <b style={{ color: isOnline ? '#10B981' : '#666' }}>{isOnline ? 'ONLINE' : 'OFFLINE'}</b></span>
      </div>

      <MatrixApp
        onExitToLobby={() => router.push('/')}
        initialClass={playerClass}
        countryIso3={countryIso3}
        countryName={countryName}
        isOnline={isOnline}
        serverUrl={serverUrl}
      />
    </div>
  );
}

export default function GamePage() {
  return (
    <Suspense fallback={
      <div style={{
        width: '100vw',
        height: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#000',
        color: '#666',
        fontFamily: 'monospace',
        fontSize: 14,
      }}>
        LOADING TEST ROOM...
      </div>
    }>
      <GamePageInner />
    </Suspense>
  );
}
