'use client';

/**
 * DetailModal — 디테일 뷰 모달
 * faction detail, vote interface 등에서 공유
 * ESC 키 + 배경 클릭으로 닫기
 */

import { useEffect, useCallback } from 'react';
import { SK, bodyFont, headingFont } from '@/lib/sketch-ui';
import { X } from 'lucide-react';

interface DetailModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** 제목 좌측 액센트 컬러 */
  accentColor?: string;
  /** 최대 너비 (기본 640px) */
  maxWidth?: number;
  children: React.ReactNode;
}

export function DetailModal({
  open,
  onClose,
  title,
  accentColor = SK.accent,
  maxWidth = 640,
  children,
}: DetailModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <>
      {/* 배경 오버레이 */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: SK.overlay,
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          zIndex: 200,
          animation: 'modalBgIn 150ms ease-out',
        }}
      />

      {/* 모달 패널 */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: `min(${maxWidth}px, calc(100vw - 32px))`,
          maxHeight: 'calc(100vh - 64px)',
          background: SK.cardBg,
          border: `1px solid ${SK.border}`,
          borderRadius: 0,
          overflow: 'hidden',
          zIndex: 201,
          display: 'flex',
          flexDirection: 'column',
          animation: 'modalIn 200ms ease-out',
        }}
      >
        {/* 상단 액센트 라인 */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '2px',
            background: accentColor,
          }}
        />

        {/* 헤더 */}
        {title && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 20px',
              borderBottom: `1px solid ${SK.borderDark}`,
              flexShrink: 0,
            }}
          >
            <h2
              style={{
                fontFamily: headingFont,
                fontWeight: 700,
                fontSize: '16px',
                color: SK.textPrimary,
                letterSpacing: '1px',
                textTransform: 'uppercase',
                margin: 0,
              }}
            >
              {title}
            </h2>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: SK.textMuted,
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 0,
                transition: 'color 150ms ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = SK.textPrimary; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = SK.textMuted; }}
            >
              <X size={18} strokeWidth={2} />
            </button>
          </div>
        )}

        {/* 콘텐츠 — 스크롤 */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '20px',
          }}
        >
          {children}
        </div>
      </div>

      <style>{`
        @keyframes modalBgIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modalIn {
          from {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }
      `}</style>
    </>
  );
}
