'use client';

/**
 * SectionNav — pill 형태 서브섹션 전환 바
 * 기존 PopupTabNav의 서브탭 바 + FilterBar pill 스타일을 결합
 * 각 독립 팝업(Economy, Factions, Governance) 상단에 사용
 */

import { SK, bodyFont } from '@/lib/sketch-ui';
import type { LucideIcon } from 'lucide-react';

/* ── 타입 ── */

export interface SectionDef {
  id: string;
  label: string;
  icon?: LucideIcon;
}

export interface SectionNavProps {
  sections: SectionDef[];
  activeSection: string;
  onSectionChange: (sectionId: string) => void;
  accentColor?: string;
}

/* ── 컴포넌트 ── */

export function SectionNav({
  sections,
  activeSection,
  onSectionChange,
  accentColor = SK.accent,
}: SectionNavProps) {
  return (
    <nav
      className="section-nav"
      style={{
        display: 'flex',
        gap: '6px',
        padding: '12px 16px 12px 16px',
        borderBottom: `1px solid ${SK.border}`,
        background: SK.bg,
        overflowX: 'auto',
        scrollbarWidth: 'none',
        flexShrink: 0,
      }}
    >
      <style>{`
        .section-nav::-webkit-scrollbar { display: none; }
        .section-nav-pill:hover {
          background: ${accentColor}10 !important;
          color: ${accentColor} !important;
        }
      `}</style>

      {sections.map((section) => {
        const isActive = section.id === activeSection;
        const Icon = section.icon;

        return (
          <button
            key={section.id}
            className={isActive ? undefined : 'section-nav-pill'}
            onClick={() => onSectionChange(section.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 16px',
              borderRadius: 0,
              border: `1px solid ${isActive ? accentColor + '40' : SK.border}`,
              background: isActive ? `${accentColor}15` : 'transparent',
              color: isActive ? accentColor : SK.textSecondary,
              fontFamily: bodyFont,
              fontWeight: 700,
              fontSize: '11px',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 150ms ease',
            }}
          >
            {Icon && (
              <Icon
                size={13}
                strokeWidth={isActive ? 2.2 : 1.8}
                style={{ flexShrink: 0 }}
              />
            )}
            {section.label}
          </button>
        );
      })}
    </nav>
  );
}
