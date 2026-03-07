'use client';

/**
 * Profile — 스켈레톤 로딩
 * Agent Card + Wallet + Achievements shimmer skeleton
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

export default function ProfileLoading() {
  return (
    <div style={{ fontFamily: bodyFont, maxWidth: 960, margin: '0 auto' }}>
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {/* 헤더 */}
      <ShimmerBox width="140px" height="24px" style={{ marginBottom: 24 }} />

      {/* Agent Card + Wallet 2-column */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 16,
        marginBottom: 32,
      }}>
        {/* Agent Card 스켈레톤 */}
        <div style={{
          background: SK.cardBg,
          border: `1px solid ${SK.border}`,
          borderRadius: '12px',
          padding: 24,
        }}>
          <ShimmerBox width="100%" height="180px" style={{ borderRadius: '8px', marginBottom: 20 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <ShimmerBox width="160px" height="20px" />
            <ShimmerBox width="80px" height="20px" style={{ borderRadius: '9999px' }} />
          </div>
          <ShimmerBox width="200px" height="13px" style={{ marginBottom: 16 }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <ShimmerBox key={i} width="100%" height="48px" style={{ borderRadius: '8px' }} />
            ))}
          </div>
        </div>

        {/* Wallet 스켈레톤 */}
        <div style={{
          background: SK.cardBg,
          border: `1px solid ${SK.border}`,
          borderRadius: '12px',
          padding: 24,
        }}>
          <ShimmerBox width="100px" height="16px" style={{ marginBottom: 16 }} />
          <ShimmerBox width="100%" height="40px" style={{ borderRadius: '8px', marginBottom: 16 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <ShimmerBox key={i} width="100%" height="48px" style={{ borderRadius: '8px' }} />
            ))}
          </div>
        </div>
      </div>

      {/* Achievements 스켈레톤 */}
      <div style={{
        background: SK.cardBg,
        border: `1px solid ${SK.border}`,
        borderRadius: '12px',
        padding: 24,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <ShimmerBox width="160px" height="18px" />
          <ShimmerBox width="80px" height="13px" />
        </div>
        <ShimmerBox width="100%" height="6px" style={{ borderRadius: '9999px', marginBottom: 20 }} />
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 10,
        }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <ShimmerBox key={i} width="100%" height="56px" style={{ borderRadius: '8px' }} />
          ))}
        </div>
      </div>
    </div>
  );
}
