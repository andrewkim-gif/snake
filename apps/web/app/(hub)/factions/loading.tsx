'use client';

/**
 * Factions Hub — 스켈레톤 로딩
 * 4-faction card shimmer skeleton
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

export default function FactionsLoading() {
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
        {['OVERVIEW', 'TECH TREE', 'MERCENARY'].map((label) => (
          <div key={label} style={{ padding: '12px 20px' }}>
            <ShimmerBox width="80px" height="14px" />
          </div>
        ))}
      </div>

      {/* 헤더 스켈레톤 */}
      <div style={{ marginBottom: 24 }}>
        <ShimmerBox width="160px" height="24px" style={{ marginBottom: 8 }} />
        <ShimmerBox width="350px" height="14px" />
      </div>

      {/* 4-faction card 스켈레톤 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
        gap: 16,
      }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            style={{
              background: SK.cardBg,
              border: `1px solid ${SK.border}`,
              borderRadius: 0,
              padding: 20,
              borderLeft: `4px solid ${SK.border}`,
            }}
          >
            {/* 팩션 이름 + 태그 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <ShimmerBox width="160px" height="16px" style={{ marginBottom: 6 }} />
                <ShimmerBox width="40px" height="11px" />
              </div>
              <div>
                <ShimmerBox width="60px" height="11px" style={{ marginBottom: 4 }} />
                <ShimmerBox width="60px" height="11px" />
              </div>
            </div>

            {/* 구성원 / 영토 */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
              <ShimmerBox width="80px" height="11px" />
              <ShimmerBox width="80px" height="11px" />
            </div>

            {/* Military / Economy 별점 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              <ShimmerBox width="140px" height="11px" />
              <ShimmerBox width="140px" height="11px" />
            </div>

            {/* VIEW DETAIL 버튼 */}
            <ShimmerBox width="100px" height="28px" style={{ borderRadius: 0 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
