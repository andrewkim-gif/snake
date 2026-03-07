'use client';

/**
 * Governance Hub — 스켈레톤 로딩
 * 3-proposal card shimmer skeleton
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

export default function GovernanceLoading() {
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
        {['PROPOSALS', 'NEW', 'HISTORY'].map((label) => (
          <div key={label} style={{ padding: '12px 20px' }}>
            <ShimmerBox width="70px" height="14px" />
          </div>
        ))}
      </div>

      {/* 헤더 스켈레톤 */}
      <div style={{ marginBottom: 20 }}>
        <ShimmerBox width="180px" height="24px" style={{ marginBottom: 8 }} />
        <ShimmerBox width="300px" height="14px" />
      </div>

      {/* 필터 탭 스켈레톤 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <ShimmerBox key={i} width="70px" height="30px" style={{ borderRadius: 0 }} />
        ))}
      </div>

      {/* 3-proposal card 스켈레톤 */}
      <div style={{
        background: SK.cardBg,
        border: `1px solid ${SK.border}`,
        borderRadius: 0,
        padding: '16px',
      }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            style={{
              padding: '16px 0',
              borderBottom: i < 2 ? `1px solid ${SK.borderDark}` : 'none',
            }}
          >
            {/* 제안 제목 */}
            <ShimmerBox width="80%" height="16px" style={{ marginBottom: 8 }} />
            {/* 카테고리 + 상태 + 시간 */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <ShimmerBox width="80px" height="12px" />
              <ShimmerBox width="60px" height="12px" />
              <ShimmerBox width="100px" height="12px" />
            </div>
            {/* 찬반 바 */}
            <ShimmerBox width="100%" height="8px" style={{ borderRadius: 0 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
