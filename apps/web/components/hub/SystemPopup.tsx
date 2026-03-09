'use client';

/**
 * SystemPopup — 공통 풀폭 팝업 오버레이
 * 기존 GameSystemPopup을 대체하는 개별 팝업의 기반 컴포넌트
 * ESC / backdrop / X 닫기, 슬라이드 애니메이션, body 스크롤 잠금
 */

import { useEffect, useCallback, useRef, type ReactNode } from 'react';
import { SK, bodyFont, headingFont, accentLine } from '@/lib/sketch-ui';
import { X } from 'lucide-react';

/* ── 타입 ── */

export type SlideDirection = 'up' | 'down' | 'right';

export interface SystemPopupProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  accentColor?: string;
  children: ReactNode;
  slideDirection?: SlideDirection;
}

/* ── 애니메이션 키프레임 (슬라이드 방향별) ── */

const slideKeyframes: Record<SlideDirection, { enter: string; exit: string }> = {
  up: {
    enter: `
      @keyframes systemPopupSlideIn {
        from { opacity: 0; transform: translateY(40px) scale(0.98); }
        to   { opacity: 1; transform: translateY(0) scale(1); }
      }
    `,
    exit: `
      @keyframes systemPopupSlideOut {
        from { opacity: 1; transform: translateY(0) scale(1); }
        to   { opacity: 0; transform: translateY(40px) scale(0.98); }
      }
    `,
  },
  down: {
    enter: `
      @keyframes systemPopupSlideIn {
        from { opacity: 0; transform: translateY(-40px) scale(0.98); }
        to   { opacity: 1; transform: translateY(0) scale(1); }
      }
    `,
    exit: `
      @keyframes systemPopupSlideOut {
        from { opacity: 1; transform: translateY(0) scale(1); }
        to   { opacity: 0; transform: translateY(-40px) scale(0.98); }
      }
    `,
  },
  right: {
    enter: `
      @keyframes systemPopupSlideIn {
        from { opacity: 0; transform: translateX(60px) scale(0.98); }
        to   { opacity: 1; transform: translateX(0) scale(1); }
      }
    `,
    exit: `
      @keyframes systemPopupSlideOut {
        from { opacity: 1; transform: translateX(0) scale(1); }
        to   { opacity: 0; transform: translateX(60px) scale(0.98); }
      }
    `,
  },
};

/* ── 컴포넌트 ── */

export function SystemPopup({
  isOpen,
  onClose,
  title,
  accentColor = SK.accent,
  children,
  slideDirection = 'up',
}: SystemPopupProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  /* ESC 키 닫기 */
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  /* body 스크롤 잠금 */
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    // 스크롤바 너비 보정 (레이아웃 시프트 방지)
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, [isOpen]);

  /* backdrop 클릭 닫기 */
  const handleBackdropClick = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  const kf = slideKeyframes[slideDirection];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'systemPopupFadeIn 250ms ease-out',
      }}
    >
      <style>{`
        @keyframes systemPopupFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        ${kf.enter}
        ${kf.exit}

        /* 스크롤바 — 기존 GameSystemPopup 스타일 유지 */
        .system-popup-scroll {
          scrollbar-width: thin;
          scrollbar-color: ${SK.borderDark} transparent;
        }
        .system-popup-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .system-popup-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .system-popup-scroll::-webkit-scrollbar-thumb {
          background: ${SK.borderDark};
          border-radius: 0;
        }

        /* 탭 콘텐츠 전환 애니메이션 */
        .system-popup-content-fade {
          animation: systemPopupContentFade 150ms ease-out;
        }
        @keyframes systemPopupContentFade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        /* 모바일 풀스크린 */
        @media (max-width: 767px) {
          .system-popup-panel {
            width: 100vw !important;
            height: 100vh !important;
            max-width: 100vw !important;
            max-height: 100vh !important;
            border-radius: 0 !important;
            margin: 0 !important;
          }
          .system-popup-content-inner {
            padding: 16px !important;
          }
        }
        @media (min-width: 768px) and (max-width: 1024px) {
          .system-popup-content-inner {
            padding: 20px !important;
          }
        }

        /* X 버튼 호버 */
        .system-popup-close:hover {
          background: rgba(255, 255, 255, 0.06) !important;
          color: ${SK.textPrimary} !important;
        }
      `}</style>

      {/* 배경 딤 */}
      <div
        onClick={handleBackdropClick}
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
        ref={panelRef}
        className="system-popup-panel"
        style={{
          position: 'relative',
          width: 'calc(100vw - 48px)',
          height: 'calc(100vh - 48px)',
          maxWidth: 'calc(100vw - 48px)',
          maxHeight: 'calc(100vh - 48px)',
          background: SK.bg,
          border: `1px solid ${SK.border}`,
          borderRadius: '0',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 80px rgba(0, 0, 0, 0.6), 0 0 1px rgba(255, 255, 255, 0.04)',
          animation: 'systemPopupSlideIn 300ms ease-out',
        }}
      >
        {/* 상단 액센트 라인 (accentColor 기반) */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '2px',
          zIndex: 2,
          borderTop: `1px solid ${accentColor}`,
        }} />

        {/* 헤더 — 타이틀 + 닫기 버튼 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px 10px 16px',
          borderBottom: `1px solid ${SK.border}`,
          background: SK.bg,
          flexShrink: 0,
        }}>
          <h2 style={{
            fontFamily: headingFont,
            fontSize: '16px',
            fontWeight: 700,
            color: accentColor,
            letterSpacing: '2px',
            textTransform: 'uppercase',
            margin: 0,
          }}>
            {title}
          </h2>

          {/* 닫기 버튼 */}
          <button
            className="system-popup-close"
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
            }}
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        {/* children 영역 — SectionNav 등이 여기에 들어옴 */}
        {/* 스크롤 콘텐츠 영역 */}
        <div
          className="system-popup-scroll"
          style={{
            flex: 1,
            overflowY: 'auto',
            position: 'relative',
          }}
        >
          {/* 미세 그리드 패턴 배경 — 기존 GameSystemPopup 유지 */}
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
            className="system-popup-content-inner"
            style={{
              position: 'relative',
              zIndex: 1,
              maxWidth: '100%',
              margin: '0 auto',
              padding: '24px',
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
