'use client';

/**
 * Economy Hub — Error Boundary
 * 붉은 테두리 McPanel + 에러 메시지 + 재시도 버튼
 * SK 디자인 토큰 사용
 */

import { useEffect } from 'react';
import { SK, bodyFont, radius, sketchShadow } from '@/lib/sketch-ui';

export default function EconomyError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Economy Hub Error]', error);
  }, [error]);

  return (
    <div
      style={{
        maxWidth: '600px',
        margin: '40px auto',
        padding: '24px',
        background: SK.cardBg,
        border: `1px solid ${SK.red}40`,
        borderRadius: 0,
        boxShadow: sketchShadow('md'),
        textAlign: 'center',
      }}
    >
      {/* 에러 아이콘 */}
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: 0,
          background: `${SK.red}15`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
          fontSize: '24px',
          color: SK.red,
        }}
      >
        !
      </div>

      <h2
        style={{
          fontFamily: bodyFont,
          fontWeight: 700,
          fontSize: '18px',
          color: SK.textPrimary,
          letterSpacing: '1px',
          margin: '0 0 8px',
        }}
      >
        ECONOMY MODULE ERROR
      </h2>

      <p
        style={{
          fontFamily: bodyFont,
          fontSize: '14px',
          color: SK.textSecondary,
          margin: '0 0 20px',
          lineHeight: 1.5,
        }}
      >
        {error.message || 'An unexpected error occurred while loading the economy dashboard.'}
      </p>

      {error.digest && (
        <p
          style={{
            fontFamily: bodyFont,
            fontSize: '11px',
            color: SK.textMuted,
            margin: '0 0 16px',
            letterSpacing: '0.5px',
          }}
        >
          Error ID: {error.digest}
        </p>
      )}

      <button
        onClick={reset}
        style={{
          padding: '10px 24px',
          fontFamily: bodyFont,
          fontWeight: 700,
          fontSize: '13px',
          color: SK.textWhite,
          background: SK.red,
          border: 'none',
          borderRadius: 0,
          cursor: 'pointer',
          letterSpacing: '1px',
          textTransform: 'uppercase',
          transition: 'opacity 150ms ease',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
      >
        RETRY
      </button>
    </div>
  );
}
