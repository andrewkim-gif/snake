'use client';

/**
 * HubLayout — 모든 허브 페이지의 공유 레이아웃
 * TopNavBar (데스크탑) + BottomTabBar (모바일) + 콘텐츠 영역
 * 배경: SK.bg + 미세 그리드 패턴
 * 콘텐츠: max-width 1200px, 중앙 정렬
 */

import { SK, headingFont, bodyFont, sketchShadow } from '@/lib/sketch-ui';
import { TopNavBar } from '@/components/navigation/TopNavBar';
import { BottomTabBar } from '@/components/navigation/BottomTabBar';
import { LanguageSwitcher } from '@/components/navigation/LanguageSwitcher';
import WalletConnectButton from '@/components/blockchain/WalletConnectButton';
import TokenBalanceList from '@/components/blockchain/TokenBalanceList';
import { useTranslations } from 'next-intl';
import { useState, useRef, useEffect, useCallback } from 'react';
import type { WalletState, TokenBalance } from '@/lib/crossx-config';

export default function HubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tCommon = useTranslations('common');
  const tBlockchain = useTranslations('blockchain');
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [showBalances, setShowBalances] = useState(false);
  const [mockBalances] = useState<TokenBalance[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Wallet connect/disconnect handlers
  const handleWalletConnect = useCallback((w: WalletState) => {
    setWallet(w);
  }, []);

  const handleWalletDisconnect = useCallback(() => {
    setWallet(null);
    setShowBalances(false);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowBalances(false);
      }
    }
    if (showBalances) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showBalances]);

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
          <span
            style={{
              fontFamily: headingFont,
              fontWeight: 800,
              fontSize: '18px',
              color: SK.textPrimary,
              letterSpacing: '2px',
            }}
          >
            AI WORLD WAR
          </span>

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
            {tCommon('alpha')}
          </span>
        </a>

        {/* 중앙: 네비게이션 (데스크탑) */}
        <TopNavBar />

        {/* 우측: Language Switcher + Wallet Connect + Balance Dropdown */}
        <div
          ref={dropdownRef}
          style={{
            position: 'relative',
            display: 'none',
            alignItems: 'center',
            gap: '12px',
          }}
          className="wallet-section"
        >
          <style>{`
            @media (min-width: 768px) {
              .wallet-section { display: flex !important; }
            }
          `}</style>

          {/* Language Switcher */}
          <LanguageSwitcher />

          {/* Wallet Connect Button */}
          <div
            onClick={wallet ? () => setShowBalances(!showBalances) : undefined}
            style={{ cursor: wallet ? 'pointer' : undefined }}
          >
            <WalletConnectButton
              onConnect={handleWalletConnect}
              onDisconnect={handleWalletDisconnect}
            />
          </div>

          {/* Token Balance Dropdown */}
          {showBalances && wallet && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '8px',
                width: '360px',
                maxHeight: '480px',
                background: SK.cardBg,
                border: `1px solid ${SK.border}`,
                borderRadius: '12px',
                boxShadow: sketchShadow('lg'),
                overflow: 'hidden',
                zIndex: 100,
                animation: 'walletDropdownIn 150ms ease-out',
              }}
            >
              <style>{`
                @keyframes walletDropdownIn {
                  from {
                    opacity: 0;
                    transform: translateY(-8px);
                  }
                  to {
                    opacity: 1;
                    transform: translateY(0);
                  }
                }
              `}</style>

              {/* Dropdown header */}
              <div
                style={{
                  padding: '12px 16px',
                  borderBottom: `1px solid ${SK.borderDark}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span
                  style={{
                    fontFamily: bodyFont,
                    fontSize: '13px',
                    fontWeight: 700,
                    color: SK.textPrimary,
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                  }}
                >
                  {tBlockchain('tokenHoldings')}
                </span>
                <span
                  style={{
                    fontFamily: bodyFont,
                    fontSize: '11px',
                    color: SK.green,
                  }}
                >
                  {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                </span>
              </div>

              {/* Token list */}
              <TokenBalanceList
                balances={mockBalances}
                onTokenSelect={(iso3) => {
                  setShowBalances(false);
                  // Navigate to economy/tokens with country filter
                  window.location.href = `/economy/tokens?country=${iso3}`;
                }}
              />
            </div>
          )}
        </div>
      </header>

      {/* 콘텐츠 영역 — 반응형 패딩 + max-width */}
      <main
        className="hub-content-area"
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '24px 16px 100px',
        }}
      >
        <style>{`
          /* Mobile (<768px): 1-col, 패딩 16px */
          @media (max-width: 767px) {
            .hub-content-area {
              padding: 16px 16px 120px !important;
              max-width: 100% !important;
            }
          }
          /* Tablet (768-1024px): 2-col grid 지원 */
          @media (min-width: 768px) and (max-width: 1024px) {
            .hub-content-area {
              padding: 20px 20px 100px !important;
              max-width: 960px !important;
            }
          }
          /* Desktop (>1024px): 2-3 col grid, max-width 1200px */
          @media (min-width: 1025px) {
            .hub-content-area {
              padding: 24px 24px 80px !important;
              max-width: 1200px !important;
            }
          }
        `}</style>
        {children}
      </main>

      {/* 모바일 바텀 탭 바 */}
      <BottomTabBar />
    </div>
  );
}
