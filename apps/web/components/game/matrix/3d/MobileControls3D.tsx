'use client';

/**
 * MobileControls3D.tsx — 3D 모드용 모바일 가상 조이스틱
 *
 * MatrixScene에서 WASD 입력을 keysPressed ref로 관리하므로,
 * 터치 조이스틱의 방향을 keysPressed에 직접 주입한다.
 *
 * 왼쪽 하단에 이동 조이스틱 1개.
 * 모바일 디바이스에서만 표시 (ontouchstart + screen width).
 *
 * MatrixScene의 matrix-scene-hud-overlay div 안에 렌더링.
 */

import { memo, useRef, useCallback, useEffect, useState } from 'react';

// ============================================
// Props
// ============================================

export interface MobileControls3DProps {
  /** keysPressed ref (WASD 키 시뮬레이션) */
  keysPressedRef: React.MutableRefObject<Set<string>>;
  /** 활성화 여부 (기본 true) */
  enabled?: boolean;
}

// ============================================
// Constants
// ============================================

const STICK_SIZE = 120;
const KNOB_SIZE = 48;
const DEAD_ZONE = 12; // px

// ============================================
// Main Component
// ============================================

function MobileControls3DInner({
  keysPressedRef,
  enabled = true,
}: MobileControls3DProps) {
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef({
    active: false,
    touchId: -1,
    originX: 0,
    originY: 0,
    currentX: 0,
    currentY: 0,
  });
  // 렌더링 트리거 (조이스틱 노브 위치 업데이트)
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 });

  // 모바일 감지
  useEffect(() => {
    const check = () => {
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const small = window.innerWidth <= 1024;
      setIsMobile(hasTouch && small);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // 방향 → keysPressed 변환
  const updateKeys = useCallback((dx: number, dy: number, dist: number) => {
    const keys = keysPressedRef.current;

    // 이전 방향키 모두 제거
    keys.delete('w');
    keys.delete('s');
    keys.delete('a');
    keys.delete('d');

    if (dist <= DEAD_ZONE) return;

    // 각도 기반 4/8방향 매핑
    const angle = Math.atan2(dy, dx); // 라디안

    // 수평: -PI/4 ~ PI/4 = 오른쪽, 3PI/4 ~ -3PI/4 = 왼쪽
    // 수직: PI/4 ~ 3PI/4 = 아래, -3PI/4 ~ -PI/4 = 위
    const threshold = Math.PI / 8 * 3; // 67.5도

    if (Math.abs(angle) < threshold) keys.add('d');    // 오른쪽
    if (Math.abs(angle) > Math.PI - threshold) keys.add('a'); // 왼쪽
    if (angle > Math.PI / 2 - threshold && angle < Math.PI / 2 + threshold) keys.add('s'); // 아래
    if (angle < -(Math.PI / 2 - threshold) && angle > -(Math.PI / 2 + threshold)) keys.add('w'); // 위
  }, [keysPressedRef]);

  // 노브 위치 계산
  const calcKnobOffset = useCallback((stick: typeof stickRef.current) => {
    if (!stick.active) return { x: 0, y: 0 };
    const dx = stick.currentX - stick.originX;
    const dy = stick.currentY - stick.originY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxDist = STICK_SIZE / 2 - KNOB_SIZE / 2;
    if (dist > maxDist) {
      const r = maxDist / dist;
      return { x: dx * r, y: dy * r };
    }
    return { x: dx, y: dy };
  }, []);

  // Touch handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enabled) return;
    e.stopPropagation();

    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (!stickRef.current.active) {
        stickRef.current = {
          active: true,
          touchId: t.identifier,
          originX: t.clientX,
          originY: t.clientY,
          currentX: t.clientX,
          currentY: t.clientY,
        };
        setKnobOffset({ x: 0, y: 0 });
        break;
      }
    }
  }, [enabled]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!enabled) return;
    e.stopPropagation();

    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (stickRef.current.active && t.identifier === stickRef.current.touchId) {
        stickRef.current.currentX = t.clientX;
        stickRef.current.currentY = t.clientY;

        const dx = t.clientX - stickRef.current.originX;
        const dy = t.clientY - stickRef.current.originY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        updateKeys(dx, dy, dist);
        setKnobOffset(calcKnobOffset(stickRef.current));
        break;
      }
    }
  }, [enabled, updateKeys, calcKnobOffset]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();

    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (stickRef.current.active && t.identifier === stickRef.current.touchId) {
        stickRef.current.active = false;
        stickRef.current.touchId = -1;

        // 모든 방향키 해제
        keysPressedRef.current.delete('w');
        keysPressedRef.current.delete('s');
        keysPressedRef.current.delete('a');
        keysPressedRef.current.delete('d');

        setKnobOffset({ x: 0, y: 0 });
        break;
      }
    }
  }, [keysPressedRef]);

  // 모바일이 아니면 렌더링 안함
  if (!isMobile) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        bottom: 30,
        left: 24,
        zIndex: 25,
        pointerEvents: 'auto',
        touchAction: 'none',
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {/* 조이스틱 베이스 */}
      <div style={{
        width: STICK_SIZE,
        height: STICK_SIZE,
        borderRadius: '50%',
        backgroundColor: 'rgba(255,255,255,0.08)',
        border: '2px solid rgba(255,255,255,0.15)',
        position: 'relative',
      }}>
        {/* 노브 */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: KNOB_SIZE,
          height: KNOB_SIZE,
          borderRadius: '50%',
          backgroundColor: stickRef.current.active
            ? 'rgba(239, 68, 68, 0.45)'
            : 'rgba(255,255,255,0.2)',
          border: '2px solid rgba(255,255,255,0.3)',
          transform: `translate(${-KNOB_SIZE / 2 + knobOffset.x}px, ${-KNOB_SIZE / 2 + knobOffset.y}px)`,
          transition: stickRef.current.active ? 'none' : 'transform 120ms ease-out',
        }} />

        {/* MOVE 라벨 */}
        <div style={{
          position: 'absolute',
          bottom: -18,
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 8,
          color: 'rgba(255,255,255,0.3)',
          fontFamily: '"Chakra Petch", sans-serif',
          fontWeight: 700,
          letterSpacing: '0.1em',
          pointerEvents: 'none',
        }}>
          MOVE
        </div>
      </div>
    </div>
  );
}

const MobileControls3D = memo(MobileControls3DInner);
export { MobileControls3D };
export default MobileControls3D;
