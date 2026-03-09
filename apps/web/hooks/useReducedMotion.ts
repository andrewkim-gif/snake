'use client';

/**
 * useReducedMotion — prefers-reduced-motion 접근성 감지 훅 (v24 Phase 6)
 *
 * `window.matchMedia('(prefers-reduced-motion: reduce)')` 를 구독하여
 * OS/브라우저의 모션 축소 설정을 실시간 반영한다.
 *
 * SSR 안전: useEffect 안에서만 window 접근.
 * 변경 감지: mediaQuery.addEventListener('change') 로 실시간 업데이트.
 *
 * 반환값: boolean (true = 모션 축소 선호)
 */

import { useState, useEffect } from 'react';

export function useReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReduced(mq.matches);

    const handler = (e: MediaQueryListEvent) => {
      setPrefersReduced(e.matches);
    };

    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return prefersReduced;
}

export default useReducedMotion;
