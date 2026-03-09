'use client';

/**
 * SettingsPopup -- 프로필 + 대시보드 + 설정 통합 팝업
 * SystemPopup 래핑 + 좌측 세로 사이드바 탭 (모바일: 상단 수평 탭)
 * Phase 3: v31 팝업 재구성
 *
 * URL: ?popup=settings&tab=profile|dashboard|settings
 * usePopup의 activeSection을 탭으로 사용
 */

import { useCallback } from 'react';
import dynamic from 'next/dynamic';
import { SystemPopup } from './SystemPopup';
import { SK, bodyFont } from '@/lib/sketch-ui';
import { User, LayoutDashboard, Settings } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/* -- 기존 SettingsContent 직접 import (dynamic 불필요) -- */
import SettingsContentComponent from './SettingsContent';

/* -- 액센트 색상 -- */
const ACCENT = SK.textSecondary;

/* -- 탭 정의 -- */

interface TabDef {
  id: string;
  label: string;
  icon: LucideIcon;
}

const TABS: TabDef[] = [
  { id: 'profile', label: 'PROFILE', icon: User },
  { id: 'dashboard', label: 'DASHBOARD', icon: LayoutDashboard },
  { id: 'settings', label: 'SETTINGS', icon: Settings },
];

const DEFAULT_TAB = 'profile';

/* -- 콘텐츠 dynamic import -- */

function TabLoading() {
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
      LOADING...
    </div>
  );
}

const ProfilePage = dynamic(
  () => import('@/app/(hub)/profile/page'),
  { ssr: false, loading: () => <TabLoading /> },
);
const DashboardPage = dynamic(
  () => import('@/app/dashboard/page'),
  { ssr: false, loading: () => <TabLoading /> },
);

/* -- 탭 콘텐츠 라우팅 -- */

function TabContent({ tab }: { tab: string }) {
  switch (tab) {
    case 'dashboard':
      return <DashboardPage />;
    case 'settings':
      return <SettingsContentComponent />;
    default:
      return <ProfilePage />;
  }
}

/* -- Props -- */

interface SettingsPopupProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: string | null;
  onTabChange: (tab: string) => void;
}

/* -- 컴포넌트 -- */

export function SettingsPopup({
  isOpen,
  onClose,
  activeTab,
  onTabChange,
}: SettingsPopupProps) {
  const currentTab = activeTab || DEFAULT_TAB;

  const handleTabChange = useCallback((tabId: string) => {
    onTabChange(tabId);
  }, [onTabChange]);

  return (
    <SystemPopup
      isOpen={isOpen}
      onClose={onClose}
      title="SETTINGS"
      accentColor={ACCENT}
      slideDirection="right"
    >
      <style>{`
        /* 모바일: 사이드바 → 상단 수평 탭 */
        @media (max-width: 767px) {
          .settings-popup-layout {
            flex-direction: column !important;
          }
          .settings-popup-sidebar {
            width: 100% !important;
            flex-direction: row !important;
            border-right: none !important;
            border-bottom: 1px solid ${SK.border} !important;
            overflow-x: auto !important;
            padding: 8px 12px !important;
            gap: 4px !important;
          }
          .settings-popup-sidebar-tab {
            border-left: none !important;
            border-bottom: 2px solid transparent !important;
            padding: 8px 16px !important;
            flex-direction: row !important;
            gap: 6px !important;
          }
          .settings-popup-sidebar-tab[data-active="true"] {
            border-left: none !important;
            border-bottom: 2px solid ${ACCENT} !important;
          }
        }
        /* 사이드바 탭 호버 */
        .settings-popup-sidebar-tab:hover {
          background: rgba(255, 255, 255, 0.03) !important;
        }
      `}</style>

      {/* flex row 레이아웃: 좌측 사이드바 + 우측 콘텐츠
          system-popup-content-inner의 padding 24px를 상쇄하여 사이드바를 좌측 끝에 배치 */}
      <div
        className="settings-popup-layout"
        style={{
          display: 'flex',
          flexDirection: 'row',
          minHeight: 0,
          flex: 1,
          margin: '-24px',
        }}
      >
        {/* 좌측 세로 사이드바 */}
        <nav
          className="settings-popup-sidebar"
          style={{
            width: '160px',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            padding: '12px 0',
            borderRight: `1px solid ${SK.border}`,
            background: SK.bg,
          }}
        >
          {TABS.map((tab) => {
            const isActive = tab.id === currentTab;
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                className="settings-popup-sidebar-tab"
                data-active={isActive}
                onClick={() => handleTabChange(tab.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '12px 16px',
                  border: 'none',
                  borderLeft: isActive
                    ? `3px solid ${ACCENT}`
                    : '3px solid transparent',
                  background: isActive
                    ? 'rgba(255, 255, 255, 0.04)'
                    : 'transparent',
                  color: isActive ? SK.textPrimary : SK.textSecondary,
                  fontFamily: bodyFont,
                  fontWeight: 700,
                  fontSize: '10px',
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                  whiteSpace: 'nowrap',
                  borderRadius: 0,
                }}
              >
                <Icon
                  size={16}
                  strokeWidth={isActive ? 2.2 : 1.6}
                  style={{ flexShrink: 0 }}
                />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* 우측 콘텐츠 영역 */}
        <div style={{
          flex: 1,
          minWidth: 0,
          overflowY: 'auto',
          padding: '24px',
        }}>
          <div
            className="system-popup-content-fade"
            key={currentTab}
          >
            <TabContent tab={currentTab} />
          </div>
        </div>
      </div>
    </SystemPopup>
  );
}
