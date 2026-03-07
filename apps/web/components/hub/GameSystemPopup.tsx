'use client';

/**
 * GameSystemPopup — 게임 시스템 통합 팝업 오버레이
 * 글로브 위에 뜨는 단일 팝업, 탭으로 모든 허브 페이지 전환
 * URL ?panel=&tab= 동기화, ESC 닫기, backdrop 클릭 닫기
 */

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { SK, bodyFont, accentLine } from '@/lib/sketch-ui';
import { PopupTabNav, MAIN_TABS, DEFAULT_SUB_TABS } from './PopupTabNav';
import type { MainTabKey } from './PopupTabNav';

/* ── 탭 콘텐츠 dynamic import ── */

const EconomyTokensPage = dynamic(
  () => import('@/app/(hub)/economy/tokens/page'),
  { loading: () => <TabLoading /> },
);
const EconomyTradePage = dynamic(
  () => import('@/app/(hub)/economy/trade/page'),
  { loading: () => <TabLoading /> },
);
const EconomyPolicyPage = dynamic(
  () => import('@/app/(hub)/economy/policy/page'),
  { loading: () => <TabLoading /> },
);
const FactionsPage = dynamic(
  () => import('@/app/(hub)/factions/page'),
  { loading: () => <TabLoading /> },
);
const FactionsMarketPage = dynamic(
  () => import('@/app/(hub)/factions/market/page'),
  { loading: () => <TabLoading /> },
);
const GovernancePage = dynamic(
  () => import('@/app/(hub)/governance/page'),
  { loading: () => <TabLoading /> },
);
const GovernanceNewPage = dynamic(
  () => import('@/app/(hub)/governance/new/page'),
  { loading: () => <TabLoading /> },
);
const GovernanceHistoryPage = dynamic(
  () => import('@/app/(hub)/governance/history/page'),
  { loading: () => <TabLoading /> },
);
const HallOfFamePage = dynamic(
  () => import('@/app/(hub)/hall-of-fame/page'),
  { loading: () => <TabLoading /> },
);
const ProfilePage = dynamic(
  () => import('@/app/(hub)/profile/page'),
  { loading: () => <TabLoading /> },
);
const SettingsContent = dynamic(
  () => import('./SettingsContent'),
  { loading: () => <TabLoading /> },
);

function TabLoading() {
  const tCommon = useTranslations('common');
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '200px',
      fontFamily: bodyFont,
      fontSize: '12px',
      color: SK.textMuted,
      letterSpacing: '2px',
    }}>
      {tCommon('loadingText')}
    </div>
  );
}

/* ── 콘텐츠 라우팅 ── */

function TabContent({ mainTab, subTab }: { mainTab: MainTabKey; subTab: string }) {
  switch (mainTab) {
    case 'economy':
      switch (subTab) {
        case 'trade': return <EconomyTradePage />;
        case 'policy': return <EconomyPolicyPage />;
        default: return <EconomyTokensPage />;
      }
    case 'factions':
      switch (subTab) {
        case 'market': return <FactionsMarketPage />;
        default: return <FactionsPage />;
      }
    case 'governance':
      switch (subTab) {
        case 'new': return <GovernanceNewPage />;
        case 'history': return <GovernanceHistoryPage />;
        default: return <GovernancePage />;
      }
    case 'hallOfFame':
      return <HallOfFamePage />;
    case 'profile':
      return <ProfilePage />;
    case 'dashboard':
      return <DashboardPlaceholder />;
    case 'settings':
      return <SettingsContent />;
    default:
      return null;
  }
}

function DashboardPlaceholder() {
  const tNav = useTranslations('nav');
  const tCommon = useTranslations('common');
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '300px',
      gap: '12px',
    }}>
      <span style={{
        fontFamily: bodyFont,
        fontSize: '14px',
        fontWeight: 600,
        color: SK.textSecondary,
        letterSpacing: '2px',
      }}>
        {tNav('dashboard').toUpperCase()}
      </span>
      <span style={{
        fontFamily: bodyFont,
        fontSize: '12px',
        color: SK.textMuted,
        letterSpacing: '1px',
      }}>
        {tCommon('comingSoon')}
      </span>
    </div>
  );
}

/* ── 메인 팝업 ── */

interface GameSystemPopupProps {
  open: boolean;
  onClose: () => void;
  initialTab?: MainTabKey;
  initialSubTab?: string;
}

export function GameSystemPopup({
  open,
  onClose,
  initialTab,
  initialSubTab,
}: GameSystemPopupProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL에서 초기값 읽기
  const urlPanel = searchParams.get('panel') as MainTabKey | null;
  const urlTab = searchParams.get('tab');

  const [activeMainTab, setActiveMainTab] = useState<MainTabKey>(
    urlPanel || initialTab || 'economy',
  );
  const [activeSubTab, setActiveSubTab] = useState<string>(
    urlTab || initialSubTab || DEFAULT_SUB_TABS[activeMainTab] || '',
  );

  // 외부 initialTab 변경 시 동기화
  useEffect(() => {
    if (open && initialTab) {
      setActiveMainTab(initialTab);
      setActiveSubTab(initialSubTab || DEFAULT_SUB_TABS[initialTab] || '');
    }
  }, [open, initialTab, initialSubTab]);

  // URL → 상태 동기화 (브라우저 뒤로가기 등)
  useEffect(() => {
    if (!open) return;
    if (urlPanel && MAIN_TABS.some(t => t.key === urlPanel)) {
      setActiveMainTab(urlPanel);
      if (urlTab) setActiveSubTab(urlTab);
    }
  }, [open, urlPanel, urlTab]);

  // 상태 → URL 동기화
  const syncUrl = useCallback((main: MainTabKey, sub: string) => {
    const params = new URLSearchParams();
    params.set('panel', main);
    if (sub) params.set('tab', sub);
    router.replace(`/?${params.toString()}`, { scroll: false });
  }, [router]);

  const handleMainTabChange = useCallback((tab: MainTabKey) => {
    setActiveMainTab(tab);
    const defaultSub = DEFAULT_SUB_TABS[tab] || '';
    setActiveSubTab(defaultSub);
    syncUrl(tab, defaultSub);
  }, [syncUrl]);

  const handleSubTabChange = useCallback((sub: string) => {
    setActiveSubTab(sub);
    syncUrl(activeMainTab, sub);
  }, [activeMainTab, syncUrl]);

  const handleClose = useCallback(() => {
    // URL에서 panel/tab params 제거
    router.replace('/', { scroll: false });
    onClose();
  }, [router, onClose]);

  // ESC 키로 닫기
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, handleClose]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'popupFadeIn 250ms ease-out',
      }}
    >
      <style>{`
        @keyframes popupFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes popupSlideUp {
          from { opacity: 0; transform: translateY(24px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .popup-content-scroll {
          scrollbar-width: thin;
          scrollbar-color: ${SK.borderDark} transparent;
        }
        .popup-content-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .popup-content-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .popup-content-scroll::-webkit-scrollbar-thumb {
          background: ${SK.borderDark};
          border-radius: 0;
        }
        /* 탭 콘텐츠 전환 애니메이션 */
        .popup-tab-content {
          animation: tabFadeIn 150ms ease-out;
        }
        @keyframes tabFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        /* 모바일 풀스크린 */
        @media (max-width: 767px) {
          .popup-panel {
            width: 100vw !important;
            height: 100vh !important;
            max-width: 100vw !important;
            max-height: 100vh !important;
            border-radius: 0 !important;
            margin: 0 !important;
          }
          .popup-content-inner {
            padding: 16px !important;
          }
        }
        @media (min-width: 768px) and (max-width: 1024px) {
          .popup-content-inner {
            padding: 20px !important;
            max-width: 960px !important;
          }
        }
      `}</style>

      {/* 배경 딤 (글로브 디밍) */}
      <div
        onClick={handleClose}
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(10, 11, 16, 0.85)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
      />

      {/* 팝업 패널 */}
      <div
        className="popup-panel"
        style={{
          position: 'relative',
          width: 'calc(100vw - 32px)',
          height: 'calc(100vh - 32px)',
          maxWidth: '1280px',
          maxHeight: 'calc(100vh - 32px)',
          background: SK.bg,
          border: `1px solid ${SK.border}`,
          borderRadius: '0',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 80px rgba(0, 0, 0, 0.6), 0 0 1px rgba(255, 255, 255, 0.04)',
          animation: 'popupSlideUp 300ms ease-out',
        }}
      >
        {/* 상단 액센트 라인 */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '2px',
          zIndex: 2,
          borderTop: accentLine,
        }} />

        {/* 탭 상단 여백 */}
        <div style={{ height: '12px', flexShrink: 0, background: SK.bg }} />

        {/* 탭 네비게이션 */}
        <PopupTabNav
          activeMainTab={activeMainTab}
          activeSubTab={activeSubTab}
          onMainTabChange={handleMainTabChange}
          onSubTabChange={handleSubTabChange}
          onClose={handleClose}
        />

        {/* 스크롤 콘텐츠 영역 */}
        <div
          className="popup-content-scroll"
          style={{
            flex: 1,
            overflowY: 'auto',
            position: 'relative',
          }}
        >
          {/* 미세 그리드 패턴 배경 */}
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
            pointerEvents: 'none',
            zIndex: 0,
          }} />

          <div
            className="popup-content-inner"
            style={{
              position: 'relative',
              zIndex: 1,
              maxWidth: '1200px',
              margin: '0 auto',
              padding: '24px',
            }}
          >
            <div className="popup-tab-content" key={`${activeMainTab}-${activeSubTab}`}>
              <TabContent mainTab={activeMainTab} subTab={activeSubTab} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
