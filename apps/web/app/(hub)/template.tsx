'use client';

/**
 * Hub Template — 페이지 전환 애니메이션 래퍼
 * Next.js template.tsx는 라우트 전환 시 매번 리마운트 → 자연스러운 fade 전환
 *
 * 전환 효과:
 * - WORLD → 허브: 콘텐츠 페이드인 (200ms)
 * - 허브 → 허브: 크로스페이드 (콘텐츠만, 200ms)
 * - 서브 탭 전환: 콘텐츠만 opacity 전환 (150ms)
 */

import { useState, useEffect } from 'react';

export default function HubTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // 다음 프레임에서 마운트 트리거 → 페이드인 애니메이션 발생
    const raf = requestAnimationFrame(() => {
      setMounted(true);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <>
      <style>{`
        @keyframes hubContentFadeIn {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
      <div
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(6px)',
          transition: 'opacity 200ms ease-out, transform 200ms ease-out',
          willChange: 'opacity, transform',
        }}
      >
        {children}
      </div>
    </>
  );
}
