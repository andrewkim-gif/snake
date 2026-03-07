'use client';

/**
 * Economy Hub — 스켈레톤 로딩
 * 4-stat summary + 4-chart panel shimmer
 * McPanel 스타일 gradient 애니메이션
 */

import { SK, bodyFont } from '@/lib/sketch-ui';

function ShimmerBox({ width, height, style }: { width: string; height: string; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 0,
        background: `linear-gradient(90deg, ${SK.border} 25%, ${SK.borderDark} 50%, ${SK.border} 75%)`,
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
        ...style,
      }}
    />
  );
}

export default function EconomyLoading() {
  return (
    <div style={{ fontFamily: bodyFont }}>
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {/* Sub-tab 스켈레톤 */}
      <div style={{
        display: 'flex',
        gap: 0,
        borderBottom: `1px solid ${SK.border}`,
        marginBottom: 24,
      }}>
        {['TOKENS', 'TRADE', 'POLICY'].map((label) => (
          <div key={label} style={{ padding: '12px 20px' }}>
            <ShimmerBox width="60px" height="14px" />
          </div>
        ))}
      </div>

      {/* 헤더 스켈레톤 */}
      <div style={{ marginBottom: 24 }}>
        <ShimmerBox width="200px" height="24px" style={{ marginBottom: 8 }} />
        <ShimmerBox width="400px" height="14px" />
      </div>

      {/* 4-stat summary 스켈레톤 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 12,
        marginBottom: 24,
      }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            style={{
              background: SK.cardBg,
              border: `1px solid ${SK.border}`,
              borderRadius: 0,
              padding: '14px 16px',
            }}
          >
            <ShimmerBox width="80px" height="11px" style={{ marginBottom: 8 }} />
            <ShimmerBox width="120px" height="20px" />
          </div>
        ))}
      </div>

      {/* 4-chart panel 스켈레톤 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: 16,
      }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            style={{
              background: SK.cardBg,
              border: `1px solid ${SK.border}`,
              borderRadius: 0,
              padding: '16px',
              minHeight: '200px',
            }}
          >
            <ShimmerBox width="140px" height="14px" style={{ marginBottom: 16 }} />
            <ShimmerBox width="100%" height="140px" style={{ borderRadius: 0 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
