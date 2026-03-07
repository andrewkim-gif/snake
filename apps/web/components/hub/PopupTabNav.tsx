'use client';

/**
 * PopupTabNav — 게임 시스템 팝업 탭 네비게이션
 * 메인 7탭 + 서브탭 바 + 활성 하이라이트
 * 클라이언트 상태 기반 전환 (라우트 X)
 */

import { SK, bodyFont } from '@/lib/sketch-ui';
import { useTranslations } from 'next-intl';
import {
  TrendingUp, Swords, Landmark, Trophy, User,
  LayoutDashboard, Settings, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/* ── Tab 타입 ── */

export type MainTabKey =
  | 'economy' | 'factions' | 'governance' | 'hallOfFame'
  | 'profile' | 'dashboard' | 'settings';

export interface SubTabDef {
  key: string;
  /** i18n namespace.key 형태로 런타임에 해석 */
  ns: 'economy' | 'faction' | 'governance';
  labelKey: string;
}

export interface MainTabDef {
  key: MainTabKey;
  icon: LucideIcon;
  accentColor: string;
  subTabs?: SubTabDef[];
}

/** 기본 서브탭 (메인탭 선택 시 자동 선택) */
export const DEFAULT_SUB_TABS: Partial<Record<MainTabKey, string>> = {
  economy: 'tokens',
  factions: 'overview',
  governance: 'proposals',
};

export const MAIN_TABS: MainTabDef[] = [
  {
    key: 'economy',
    icon: TrendingUp,
    accentColor: SK.green,
    subTabs: [
      { key: 'tokens', ns: 'economy', labelKey: 'tokens' },
      { key: 'trade', ns: 'economy', labelKey: 'trade' },
      { key: 'policy', ns: 'economy', labelKey: 'policy' },
    ],
  },
  {
    key: 'factions',
    icon: Swords,
    accentColor: SK.red,
    subTabs: [
      { key: 'overview', ns: 'faction', labelKey: 'overview' },
      { key: 'market', ns: 'faction', labelKey: 'mercenary' },
    ],
  },
  {
    key: 'governance',
    icon: Landmark,
    accentColor: SK.blue,
    subTabs: [
      { key: 'proposals', ns: 'governance', labelKey: 'proposals' },
      { key: 'new', ns: 'governance', labelKey: 'new' },
      { key: 'history', ns: 'governance', labelKey: 'history' },
    ],
  },
  { key: 'hallOfFame', icon: Trophy, accentColor: SK.gold },
  { key: 'profile', icon: User, accentColor: SK.blue },
  { key: 'dashboard', icon: LayoutDashboard, accentColor: SK.gold },
  { key: 'settings', icon: Settings, accentColor: SK.textSecondary },
];

/* ── 컴포넌트 ── */

interface PopupTabNavProps {
  activeMainTab: MainTabKey;
  activeSubTab: string;
  onMainTabChange: (tab: MainTabKey) => void;
  onSubTabChange: (sub: string) => void;
  onClose: () => void;
}

export function PopupTabNav({
  activeMainTab,
  activeSubTab,
  onMainTabChange,
  onSubTabChange,
  onClose,
}: PopupTabNavProps) {
  const tNav = useTranslations('nav');
  const tEcon = useTranslations('economy');
  const tFact = useTranslations('faction');
  const tGov = useTranslations('governance');

  const currentTab = MAIN_TABS.find(t => t.key === activeMainTab);
  const subTabs = currentTab?.subTabs;

  const resolveSubLabel = (sub: SubTabDef): string => {
    try {
      if (sub.ns === 'economy') return tEcon(sub.labelKey);
      if (sub.ns === 'faction') return tFact(sub.labelKey);
      if (sub.ns === 'governance') return tGov(sub.labelKey);
    } catch { /* fallback */ }
    return sub.labelKey;
  };

  return (
    <div style={{ flexShrink: 0 }}>
      {/* 메인 탭 바 */}
      <div
        className="popup-main-tabs"
        style={{
          display: 'flex',
          alignItems: 'center',
          borderBottom: `1px solid ${SK.border}`,
          background: SK.bg,
          position: 'relative',
        }}
      >
        <style>{`
          .popup-main-tabs {
            overflow-x: auto;
            scrollbar-width: none;
          }
          .popup-main-tabs::-webkit-scrollbar { display: none; }
          .popup-main-tabs button:hover {
            background: rgba(239, 68, 68, 0.06) !important;
          }
        `}</style>

        <div style={{
          display: 'flex',
          flex: 1,
          minWidth: 'max-content',
        }}>
          {MAIN_TABS.map((tab) => {
            const active = tab.key === activeMainTab;
            const Icon = tab.icon;
            let label: string;
            try { label = tNav(tab.key); } catch { label = tab.key; }

            return (
              <button
                key={tab.key}
                onClick={() => onMainTabChange(tab.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontFamily: bodyFont,
                  fontWeight: 600,
                  fontSize: '11px',
                  letterSpacing: '1.5px',
                  textTransform: 'uppercase',
                  color: active ? SK.accent : SK.textSecondary,
                  padding: '12px 14px',
                  background: 'none',
                  border: 'none',
                  borderBottom: active
                    ? `1px solid ${SK.accent}`
                    : '1px solid transparent',
                  cursor: 'pointer',
                  transition: 'color 150ms ease, border-color 150ms ease',
                  whiteSpace: 'nowrap',
                }}
              >
                <Icon size={14} strokeWidth={1.8} />
                {label}
              </button>
            );
          })}
        </div>

        {/* 닫기 버튼 */}
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            borderRadius: '0',
            border: `1px solid ${SK.border}`,
            background: 'transparent',
            color: SK.textSecondary,
            cursor: 'pointer',
            transition: 'all 150ms ease',
            flexShrink: 0,
            marginRight: '12px',
          }}
        >
          <X size={16} strokeWidth={2} />
        </button>
      </div>

      {/* 서브 탭 바 */}
      {subTabs && subTabs.length > 0 && (
        <div
          className="popup-sub-tabs"
          style={{
            display: 'flex',
            gap: '4px',
            padding: '8px 16px',
            borderBottom: `1px solid ${SK.borderDark}`,
            background: SK.bg,
            overflowX: 'auto',
            scrollbarWidth: 'none',
          }}
        >
          <style>{`
            .popup-sub-tabs::-webkit-scrollbar { display: none; }
          `}</style>
          {subTabs.map((sub) => {
            const active = sub.key === activeSubTab;
            return (
              <button
                key={sub.key}
                onClick={() => onSubTabChange(sub.key)}
                style={{
                  fontFamily: bodyFont,
                  fontWeight: 600,
                  fontSize: '11px',
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  color: active ? SK.textPrimary : SK.textMuted,
                  padding: '6px 14px',
                  background: active ? SK.accentBg : 'transparent',
                  border: 'none',
                  borderBottom: active ? `1px solid ${SK.accent}` : '1px solid transparent',
                  borderRadius: '0',
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                  whiteSpace: 'nowrap',
                }}
              >
                {resolveSubLabel(sub)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
