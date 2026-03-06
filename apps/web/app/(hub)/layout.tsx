'use client';

/**
 * HubLayout — 모든 허브 페이지의 공유 레이아웃
 * TopNavBar (데스크탑) + BottomTabBar (모바일) + 콘텐츠 영역
 * 배경: SK.bg + 미세 그리드 패턴
 * 콘텐츠: max-width 1200px, 중앙 정렬
 */

import { SK, bodyFont } from '@/lib/sketch-ui';
import { TopNavBar } from '@/components/navigation/TopNavBar';
import { BottomTabBar } from '@/components/navigation/BottomTabBar';
import Image from 'next/image';
import { useState } from 'react';

export default function HubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [imgError, setImgError] = useState(false);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: SK.bg,
        position: 'relative',
      }}
    >
      {/* 미세 그리드 패턴 배경 */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* 상단 헤더 바 */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 70,
          height: '56px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          background: `linear-gradient(to bottom, ${SK.bg} 0%, ${SK.bg}F0 100%)`,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: `1px solid ${SK.borderDark}`,
        }}
      >
        {/* 좌측: 로고 */}
        <a
          href="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            textDecoration: 'none',
          }}
        >
          {!imgError ? (
            <Image
              src="/images/logo-ww-mc.png"
              alt="AI World War"
              width={160}
              height={65}
              priority
              onError={() => setImgError(true)}
              style={{
                height: '36px',
                width: 'auto',
                filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.5))',
              }}
            />
          ) : (
            <span
              style={{
                fontFamily: bodyFont,
                fontWeight: 800,
                fontSize: '18px',
                color: SK.textPrimary,
                letterSpacing: '2px',
              }}
            >
              AI WORLD WAR
            </span>
          )}

          {/* ALPHA 뱃지 */}
          <span
            style={{
              fontFamily: bodyFont,
              fontSize: '9px',
              fontWeight: 700,
              color: SK.blue,
              letterSpacing: '1px',
              padding: '2px 6px',
              border: `1px solid ${SK.blue}30`,
              borderRadius: '4px',
              textTransform: 'uppercase',
            }}
          >
            ALPHA
          </span>
        </a>

        {/* 중앙: 네비게이션 (데스크탑) */}
        <TopNavBar />

        {/* 우측: Wallet 자리 + placeholder */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          {/* Wallet Connect 버튼 자리 (Phase 3에서 구현) */}
          <div
            style={{
              fontFamily: bodyFont,
              fontWeight: 600,
              fontSize: '10px',
              color: SK.textMuted,
              letterSpacing: '1px',
              textTransform: 'uppercase',
              padding: '6px 12px',
              border: `1px solid ${SK.border}`,
              borderRadius: '6px',
              display: 'none',
            }}
            className="wallet-placeholder"
          >
            <style>{`
              @media (min-width: 768px) {
                .wallet-placeholder { display: block !important; }
              }
            `}</style>
            CONNECT
          </div>
        </div>
      </header>

      {/* 콘텐츠 영역 */}
      <main
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '24px 16px 100px',
        }}
      >
        {children}
      </main>

      {/* 모바일 바텀 탭 바 */}
      <BottomTabBar />
    </div>
  );
}
