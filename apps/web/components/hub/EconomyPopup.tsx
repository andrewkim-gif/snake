'use client';

/**
 * EconomyPopup — 경제 전용 독립 팝업
 * SystemPopup 래핑 + SectionNav(tokens/trade/policy)
 * Phase 2: v31 팝업 재구성
 */

import { useCallback } from 'react';
import dynamic from 'next/dynamic';
import { SystemPopup } from './SystemPopup';
import { SectionNav, type SectionDef } from './SectionNav';
import { SK, bodyFont } from '@/lib/sketch-ui';
import { TrendingUp, ArrowLeftRight, Scale } from 'lucide-react';

/* ── 액센트 색상 ── */
const ACCENT = '#4A9E4A';

/* ── 섹션 정의 ── */
const SECTIONS: SectionDef[] = [
  { id: 'tokens', label: 'TOKENS', icon: TrendingUp },
  { id: 'trade', label: 'TRADE', icon: ArrowLeftRight },
  { id: 'policy', label: 'POLICY', icon: Scale },
];

const DEFAULT_SECTION = 'tokens';

/* ── 콘텐츠 dynamic import (기존 GameSystemPopup 경로 유지) ── */

function SectionLoading() {
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

const EconomyTokensPage = dynamic(
  () => import('@/app/(hub)/economy/tokens/page'),
  { ssr: false, loading: () => <SectionLoading /> },
);
const EconomyTradePage = dynamic(
  () => import('@/app/(hub)/economy/trade/page'),
  { ssr: false, loading: () => <SectionLoading /> },
);
const EconomyPolicyPage = dynamic(
  () => import('@/app/(hub)/economy/policy/page'),
  { ssr: false, loading: () => <SectionLoading /> },
);

/* ── 콘텐츠 라우팅 ── */

function SectionContent({ section }: { section: string }) {
  switch (section) {
    case 'trade':
      return <EconomyTradePage />;
    case 'policy':
      return <EconomyPolicyPage />;
    default:
      return <EconomyTokensPage />;
  }
}

/* ── Props ── */

interface EconomyPopupProps {
  isOpen: boolean;
  onClose: () => void;
  activeSection: string | null;
  onSectionChange: (section: string) => void;
}

/* ── 컴포넌트 ── */

export function EconomyPopup({
  isOpen,
  onClose,
  activeSection,
  onSectionChange,
}: EconomyPopupProps) {
  const currentSection = activeSection || DEFAULT_SECTION;

  const handleSectionChange = useCallback((sectionId: string) => {
    onSectionChange(sectionId);
  }, [onSectionChange]);

  return (
    <SystemPopup
      isOpen={isOpen}
      onClose={onClose}
      title="ECONOMY"
      accentColor={ACCENT}
      slideDirection="up"
    >
      {/* 섹션 네비게이션 */}
      <SectionNav
        sections={SECTIONS}
        activeSection={currentSection}
        onSectionChange={handleSectionChange}
        accentColor={ACCENT}
      />

      {/* 콘텐츠 영역 */}
      <div
        className="system-popup-content-fade"
        key={currentSection}
        style={{ marginTop: '16px' }}
      >
        <SectionContent section={currentSection} />
      </div>
    </SystemPopup>
  );
}
