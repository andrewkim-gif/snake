'use client';

/**
 * Hall of Fame — 스켈레톤 로딩
 * 타임라인 + 기록 카드 shimmer skeleton
 */

import { SK, bodyFont } from '@/lib/sketch-ui';

function ShimmerBox({ width, height, style }: { width: string; height: string; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: '6px',
        background: `linear-gradient(90deg, ${SK.border} 25%, ${SK.borderDark} 50%, ${SK.border} 75%)`,
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
        ...style,
      }}
    />
  );
}

export default function HallOfFameLoading() {
  return (
    <div style={{ fontFamily: bodyFont, maxWidth: 960, margin: '0 auto' }}>
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {/* 헤더 */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <ShimmerBox width="200px" height="28px" style={{ margin: '0 auto 8px' }} />
        <ShimmerBox width="300px" height="14px" style={{ margin: '0 auto' }} />
      </div>

      {/* 시즌 타임라인 스켈레톤 */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 32, overflowX: 'hidden' }}>
        <ShimmerBox width="120px" height="44px" style={{ flexShrink: 0, borderRadius: '8px' }} />
        <ShimmerBox width="200px" height="44px" style={{ flexShrink: 0, borderRadius: '8px' }} />
        <ShimmerBox width="200px" height="44px" style={{ flexShrink: 0, borderRadius: '8px' }} />
      </div>

      {/* 기록 카드 그리드 스켈레톤 */}
      <div style={{ marginBottom: 16 }}>
        <ShimmerBox width="200px" height="18px" style={{ marginBottom: 16 }} />
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 12,
      }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            style={{
              background: SK.cardBg,
              border: `1px solid ${SK.border}`,
              borderRadius: '8px',
              padding: 16,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <ShimmerBox width="100px" height="11px" />
              <ShimmerBox width="24px" height="20px" />
            </div>
            <ShimmerBox width="140px" height="15px" style={{ marginBottom: 6 }} />
            <ShimmerBox width="200px" height="13px" style={{ marginBottom: 8 }} />
            <ShimmerBox width="50px" height="16px" style={{ borderRadius: '9999px' }} />
          </div>
        ))}
      </div>
    </div>
  );
}
