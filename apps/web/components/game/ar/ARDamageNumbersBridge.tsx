'use client';

/**
 * ARDamageNumbersBridge — ARDamageNumbers와 arEventQueue 연결
 *
 * v19 PERF: drain+re-push 패턴 제거 → 인플레이스 damage 이벤트만 추출
 * 단일 useFrame: damage 이벤트 추출 + DamageNumbers 렌더링
 */

import { useRef, memo } from 'react';
import { useFrame } from '@react-three/fiber';
import { ARDamageNumbers, addDamageNumber, type DamageNumber } from './ARDamageNumbers';
import type { AREvent } from '@/hooks/useSocket';

interface ARDamageNumbersBridgeProps {
  arEventQueueRef: React.MutableRefObject<AREvent[]>;
}

function ARDamageNumbersBridgeInner({ arEventQueueRef }: ARDamageNumbersBridgeProps) {
  const numbersRef = useRef<DamageNumber[]>([]);

  useFrame(() => {
    // v19 PERF: 인플레이스 damage 이벤트만 추출 (re-push 제거)
    const queue = arEventQueueRef.current;
    if (queue.length === 0) return;

    let writeIdx = 0;
    for (let i = 0; i < queue.length; i++) {
      const evt = queue[i];
      if (evt.type === 'damage') {
        addDamageNumber(
          numbersRef,
          evt.data.x,
          evt.data.z,
          evt.data.amount,
          evt.data.critCount,
          evt.data.dmgType,
        );
        // damage 이벤트는 큐에서 제거 (writeIdx에 복사하지 않음)
      } else {
        // non-damage 이벤트는 유지
        queue[writeIdx++] = evt;
      }
    }
    queue.length = writeIdx;
  });

  return <ARDamageNumbers numbersRef={numbersRef} />;
}

export const ARDamageNumbersBridge = memo(ARDamageNumbersBridgeInner);
