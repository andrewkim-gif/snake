'use client';

/**
 * HallOfFamePopup -- Hall of Fame 전용 독립 팝업
 * SystemPopup 래핑, 서브섹션 없음 (단일 페이지)
 * Phase 3: v31 팝업 재구성
 */

import dynamic from 'next/dynamic';
import { SystemPopup } from './SystemPopup';
import { SK, bodyFont } from '@/lib/sketch-ui';

/* -- 액센트 색상 (SK.gold) -- */
const ACCENT = SK.gold;

/* -- 콘텐츠 dynamic import -- */

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

const HallOfFamePage = dynamic(
  () => import('@/app/(hub)/hall-of-fame/page'),
  { ssr: false, loading: () => <SectionLoading /> },
);

/* -- Props -- */

interface HallOfFamePopupProps {
  isOpen: boolean;
  onClose: () => void;
}

/* -- 컴포넌트 -- */

export function HallOfFamePopup({
  isOpen,
  onClose,
}: HallOfFamePopupProps) {
  return (
    <SystemPopup
      isOpen={isOpen}
      onClose={onClose}
      title="HALL OF FAME"
      accentColor={ACCENT}
      slideDirection="down"
    >
      {/* 단일 페이지 콘텐츠 -- SectionNav 없음 */}
      <div className="system-popup-content-fade">
        <HallOfFamePage />
      </div>
    </SystemPopup>
  );
}
