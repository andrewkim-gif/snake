'use client';

/**
 * GovernancePopup — 거버넌스 전용 독립 팝업
 * SystemPopup 래핑 + SectionNav(proposals/new/history)
 * Phase 2: v31 팝업 재구성
 */

import { useCallback } from 'react';
import dynamic from 'next/dynamic';
import { SystemPopup } from './SystemPopup';
import { SectionNav, type SectionDef } from './SectionNav';
import { SK, bodyFont } from '@/lib/sketch-ui';
import { Landmark, Plus, History } from 'lucide-react';

/* ── 액센트 색상 ── */
const ACCENT = '#4A7EBF';

/* ── 섹션 정의 ── */
const SECTIONS: SectionDef[] = [
  { id: 'proposals', label: 'PROPOSALS', icon: Landmark },
  { id: 'new', label: 'NEW', icon: Plus },
  { id: 'history', label: 'HISTORY', icon: History },
];

const DEFAULT_SECTION = 'proposals';

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

const GovernanceProposalsPage = dynamic(
  () => import('@/app/(hub)/governance/page'),
  { ssr: false, loading: () => <SectionLoading /> },
);
const GovernanceNewPage = dynamic(
  () => import('@/app/(hub)/governance/new/page'),
  { ssr: false, loading: () => <SectionLoading /> },
);
const GovernanceHistoryPage = dynamic(
  () => import('@/app/(hub)/governance/history/page'),
  { ssr: false, loading: () => <SectionLoading /> },
);

/* ── 콘텐츠 라우팅 ── */

function SectionContent({ section }: { section: string }) {
  switch (section) {
    case 'new':
      return <GovernanceNewPage />;
    case 'history':
      return <GovernanceHistoryPage />;
    default:
      return <GovernanceProposalsPage />;
  }
}

/* ── Props ── */

interface GovernancePopupProps {
  isOpen: boolean;
  onClose: () => void;
  activeSection: string | null;
  onSectionChange: (section: string) => void;
}

/* ── 컴포넌트 ── */

export function GovernancePopup({
  isOpen,
  onClose,
  activeSection,
  onSectionChange,
}: GovernancePopupProps) {
  const currentSection = activeSection || DEFAULT_SECTION;

  const handleSectionChange = useCallback((sectionId: string) => {
    onSectionChange(sectionId);
  }, [onSectionChange]);

  return (
    <SystemPopup
      isOpen={isOpen}
      onClose={onClose}
      title="GOVERNANCE"
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
