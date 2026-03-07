'use client';

/**
 * LoadingSkeleton — 통합 로딩 상태
 * shimmer 애니메이션 + 다크 테마
 */

import { SK, bodyFont } from '@/lib/sketch-ui';

interface LoadingSkeletonProps {
  /** 로딩 텍스트 */
  text?: string;
  /** 최소 높이 */
  minHeight?: string;
  /** shimmer 바 개수 */
  lines?: number;
}

export function LoadingSkeleton({ text, minHeight = '300px', lines = 6 }: LoadingSkeletonProps) {
  return (
    <div
      style={{
        background: SK.cardBg,
        border: `1px solid ${SK.border}`,
        borderRadius: '12px',
        overflow: 'hidden',
      }}
    >
      {text && (
        <div
          style={{
            padding: '16px 20px',
            borderBottom: `1px solid ${SK.borderDark}`,
            color: SK.textSecondary,
            fontFamily: bodyFont,
            fontSize: '13px',
          }}
        >
          {text}
        </div>
      )}
      <div style={{ padding: '16px 20px', minHeight }}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '8px 0',
              borderBottom: i < lines - 1 ? `1px solid ${SK.borderDark}` : undefined,
            }}
          >
            <div
              style={{
                flex: 1,
                height: '16px',
                borderRadius: '3px',
                background: `linear-gradient(90deg, ${SK.border} 25%, ${SK.borderDark} 50%, ${SK.border} 75%)`,
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s infinite',
              }}
            />
          </div>
        ))}
      </div>
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
