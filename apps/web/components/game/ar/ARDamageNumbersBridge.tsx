'use client';

/**
 * ARDamageNumbersBridge — ARDamageNumbers와 arEventQueue 연결 (Phase 3 Task 1)
 *
 * arEventQueueRef에서 ar_damage 이벤트를 drain하여
 * ARDamageNumbers의 numbersRef에 추가한다.
 *
 * Canvas 내부 R3F 컴포넌트 (useFrame 기반).
 */

import { useRef, memo } from 'react';
import { useFrame } from '@react-three/fiber';
import { ARDamageNumbers, addDamageNumber, type DamageNumber } from './ARDamageNumbers';
import type { AREvent } from '@/hooks/useSocket';
import { drainAREvents } from '@/hooks/useSocket';

interface ARDamageNumbersBridgeProps {
  arEventQueueRef: React.MutableRefObject<AREvent[]>;
}

function ARDamageNumbersBridgeInner({ arEventQueueRef }: ARDamageNumbersBridgeProps) {
  const numbersRef = useRef<DamageNumber[]>([]);

  useFrame(() => {
    // drain damage events from queue
    const events = drainAREvents(arEventQueueRef, 32);
    for (const evt of events) {
      if (evt.type === 'damage') {
        addDamageNumber(
          numbersRef,
          evt.data.x,
          evt.data.z,
          evt.data.amount,
          evt.data.critCount,
          evt.data.dmgType,
        );
      }
      // Re-push non-damage events back to queue so other consumers can process them
      if (evt.type !== 'damage') {
        arEventQueueRef.current.push(evt);
      }
    }
  });

  return <ARDamageNumbers numbersRef={numbersRef} />;
}

export const ARDamageNumbersBridge = memo(ARDamageNumbersBridgeInner);
