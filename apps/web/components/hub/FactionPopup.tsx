'use client';

/**
 * FactionPopup — 팩션 전용 독립 팝업
 * SystemPopup 래핑 + SectionNav(overview/market)
 * Phase 2: v31 팝업 재구성
 */

import { useCallback } from 'react';
import dynamic from 'next/dynamic';
import { SystemPopup } from './SystemPopup';
import { SectionNav, type SectionDef } from './SectionNav';
import { SK, bodyFont } from '@/lib/sketch-ui';
import { Swords, Store } from 'lucide-react';

/* ── 액센트 색상 ── */
const ACCENT = '#CC3333';

/* ── 섹션 정의 ── */
const SECTIONS: SectionDef[] = [
  { id: 'overview', label: 'OVERVIEW', icon: Swords },
  { id: 'market', label: 'MARKET', icon: Store },
];

const DEFAULT_SECTION = 'overview';

/* ── 콘텐츠 dynamic import ── */

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

const FactionsOverviewPage = dynamic(
  () => import('@/app/(hub)/factions/page'),
  { ssr: false, loading: () => <SectionLoading /> },
);
const FactionsMarketPage = dynamic(
  () => import('@/app/(hub)/factions/market/page'),
  { ssr: false, loading: () => <SectionLoading /> },
);

/* ── 콘텐츠 라우팅 ── */

function SectionContent({ section }: { section: string }) {
  switch (section) {
    case 'market':
      return <FactionsMarketPage />;
    default:
      return <FactionsOverviewPage />;
  }
}

/* ── Props ── */

interface FactionPopupProps {
  isOpen: boolean;
  onClose: () => void;
  activeSection: string | null;
  onSectionChange: (section: string) => void;
}

/* ── 컴포넌트 ── */

export function FactionPopup({
  isOpen,
  onClose,
  activeSection,
  onSectionChange,
}: FactionPopupProps) {
  const currentSection = activeSection || DEFAULT_SECTION;

  const handleSectionChange = useCallback((sectionId: string) => {
    onSectionChange(sectionId);
  }, [onSectionChange]);

  return (
    <SystemPopup
      isOpen={isOpen}
      onClose={onClose}
      title="FACTIONS"
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
