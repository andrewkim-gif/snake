'use client';

/**
 * TycoonModeWrapper — 타이쿤 모드의 서버 연결 래퍼
 * CityTycoonView + useTycoonSocket 통합
 * page.tsx에서 matrix 모드일 때 이 컴포넌트를 렌더링
 */

import { lazy, Suspense, useState } from 'react';

// CityTycoonView는 기존 dynamic import 유지 (lazy로 전환)
const CityTycoonView = lazy(() =>
  import('@app-ingame/components/tycoon/CityTycoonView')
);

interface ITycoonModeWrapperProps {
  marketCap: number;
  onMarketCapChange?: (delta: number) => void;
  onExitToLobby: () => void;
  regionName: string;
  regionCode: string;
}

export function TycoonModeWrapper({
  marketCap,
  onMarketCapChange,
  onExitToLobby,
  regionName,
  regionCode,
}: ITycoonModeWrapperProps) {
  // 서버 연결 상태 (useTycoonSocket 훅 연결 시 교체 예정)
  const [serverConnected, setServerConnected] = useState(false);
  // 서버에서 받은 MC 잔고 (서버가 없으면 로컬 marketCap 사용)
  const [serverBalance, setServerBalance] = useState<number | null>(null);

  // 실제 표시할 MC 값: 서버 잔고 우선, 없으면 로컬
  const displayBalance = serverBalance ?? marketCap;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100 }}>
      {/* 상단 네비게이션 바 */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 48,
        background: 'rgba(0,0,0,0.8)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        zIndex: 200,
        borderBottom: '1px solid rgba(255,255,255,0.1)',
      }}>
        {/* Globe 복귀 버튼 */}
        <button
          onClick={onExitToLobby}
          style={{
            background: 'none',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            fontSize: 16,
            padding: '4px 12px',
            borderRadius: 6,
            transition: 'background 0.2s',
          }}
        >
          {'<-'} Globe
        </button>

        {/* 현재 국가명 */}
        {regionName && (
          <span style={{
            color: '#fff',
            marginLeft: 16,
            fontSize: 14,
            opacity: 0.8,
          }}>
            {regionName}
          </span>
        )}

        <div style={{ flex: 1 }} />

        {/* MC 잔고 표시 */}
        <div style={{
          color: '#4ade80',
          fontSize: 14,
          fontWeight: 600,
        }}>
          MC {displayBalance.toLocaleString()}
        </div>

        {/* 서버 연결 상태 인디케이터 */}
        <div
          title={serverConnected ? 'Server Connected' : 'Local Mode'}
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            marginLeft: 12,
            background: serverConnected ? '#4ade80' : '#ef4444',
          }}
        />
      </div>

      {/* CityTycoonView — 기존 인게임 뷰 위임 */}
      <Suspense fallback={
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0a',
          color: '#fff',
        }}>
          Loading City...
        </div>
      }>
        <CityTycoonView
          marketCap={displayBalance}
          onMarketCapChange={onMarketCapChange}
          onExitToLobby={onExitToLobby}
          regionName={regionName}
          regionCode={regionCode}
        />
      </Suspense>
    </div>
  );
}
