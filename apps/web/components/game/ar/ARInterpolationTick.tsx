'use client';

/**
 * ARInterpolationTick — 보간 시스템 매 프레임 갱신 (v19 Phase 2)
 *
 * 모든 AR 컴포넌트보다 먼저 마운트되어야 한다 (JSX mount order).
 * useFrame(priority=0)에서 tickARInterpolation()을 호출하여
 * 모든 엔티티의 renderX/renderZ를 60fps로 갱신한다.
 */

import { useFrame } from '@react-three/fiber';
import { tickARInterpolation, type ARInterpolationState } from '@/lib/3d/ar-interpolation';

interface ARInterpolationTickProps {
  interpRef: React.MutableRefObject<ARInterpolationState>;
}

export function ARInterpolationTick({ interpRef }: ARInterpolationTickProps) {
  useFrame(() => {
    tickARInterpolation(interpRef.current);
  });
  return null;
}
