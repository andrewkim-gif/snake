'use client';

/**
 * MobileControls — v16 Phase 8 모바일 듀얼 조이스틱
 *
 * 왼쪽 = 이동 조이스틱 (moveAngle)
 * 오른쪽 = 조준 조이스틱 (aimAngle)
 * 부스트 버튼 (Shift 대체)
 * 점프 버튼 (Space 대체)
 *
 * 터치 이벤트 기반 → useInputManager 연동
 * 기존 키보드 입력과 공존 (모바일에서만 표시)
 */

import { useRef, useCallback, useEffect, useState } from 'react';
import type { InputManagerReturn } from '@/hooks/useInputManager';

interface MobileControlsProps {
  /** InputManager 인스턴스 — 터치 입력을 여기에 주입 */
  inputManager: InputManagerReturn;
  /** 활성화 여부 (메뉴 열림 시 false) */
  enabled: boolean;
}

// 조이스틱 크기 (CSS px)
const STICK_SIZE = 120;
const KNOB_SIZE = 50;
const DEAD_ZONE = 10; // px — 이 이하의 이동은 무시

// 버튼 크기
const BTN_SIZE = 56;

interface JoystickState {
  active: boolean;
  touchId: number;
  originX: number;
  originY: number;
  currentX: number;
  currentY: number;
}

function normalizeAngle(a: number): number {
  a = a % (Math.PI * 2);
  return a < 0 ? a + Math.PI * 2 : a;
}

export function MobileControls({ inputManager, enabled }: MobileControlsProps) {
  const [isMobile, setIsMobile] = useState(false);
  const leftStick = useRef<JoystickState>({ active: false, touchId: -1, originX: 0, originY: 0, currentX: 0, currentY: 0 });
  const rightStick = useRef<JoystickState>({ active: false, touchId: -1, originX: 0, originY: 0, currentX: 0, currentY: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // 모바일 감지 (터치 지원 + 작은 화면)
  useEffect(() => {
    const checkMobile = () => {
      const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isSmallScreen = window.innerWidth <= 1024;
      setIsMobile(hasTouchScreen && isSmallScreen);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // ─── 터치 핸들러 ───
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enabled) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const halfW = rect.width / 2;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const localX = touch.clientX - rect.left;

      if (localX < halfW) {
        // 왼쪽 영역 → 이동 조이스틱
        if (!leftStick.current.active) {
          leftStick.current = {
            active: true,
            touchId: touch.identifier,
            originX: touch.clientX,
            originY: touch.clientY,
            currentX: touch.clientX,
            currentY: touch.clientY,
          };
        }
      } else {
        // 오른쪽 영역 → 조준 조이스틱
        if (!rightStick.current.active) {
          rightStick.current = {
            active: true,
            touchId: touch.identifier,
            originX: touch.clientX,
            originY: touch.clientY,
            currentX: touch.clientX,
            currentY: touch.clientY,
          };
        }
      }
    }
  }, [enabled]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!enabled) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];

      if (leftStick.current.active && touch.identifier === leftStick.current.touchId) {
        leftStick.current.currentX = touch.clientX;
        leftStick.current.currentY = touch.clientY;

        // 이동 각도 계산
        const dx = leftStick.current.currentX - leftStick.current.originX;
        const dy = leftStick.current.currentY - leftStick.current.originY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > DEAD_ZONE) {
          // 터치 좌표 → 월드 이동 각도 (화면 위=앞, 카메라 azimuth 기준)
          const touchAngle = Math.atan2(-dx, dy); // 화면 y↓ → 앞 방향
          const worldAngle = normalizeAngle(inputManager.azimuthRef.current + touchAngle);
          inputManager.inputRef.current.moveAngle = worldAngle;
        } else {
          inputManager.inputRef.current.moveAngle = null;
        }
      }

      if (rightStick.current.active && touch.identifier === rightStick.current.touchId) {
        rightStick.current.currentX = touch.clientX;
        rightStick.current.currentY = touch.clientY;

        // 조준 각도 계산
        const dx = rightStick.current.currentX - rightStick.current.originX;
        const dy = rightStick.current.currentY - rightStick.current.originY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > DEAD_ZONE) {
          // 화면 좌표 → 월드 조준 각도
          const touchAngle = Math.atan2(-dx, dy);
          const worldAngle = normalizeAngle(inputManager.azimuthRef.current + touchAngle);
          inputManager.inputRef.current.aimAngle = worldAngle;
        }
      }
    }
  }, [enabled, inputManager]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];

      if (leftStick.current.active && touch.identifier === leftStick.current.touchId) {
        leftStick.current.active = false;
        leftStick.current.touchId = -1;
        inputManager.inputRef.current.moveAngle = null; // 이동 정지
      }

      if (rightStick.current.active && touch.identifier === rightStick.current.touchId) {
        rightStick.current.active = false;
        rightStick.current.touchId = -1;
      }
    }
  }, [inputManager]);

  // ─── 부스트/점프 버튼 ───
  const handleBoostStart = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    inputManager.inputRef.current.boost = true;
  }, [inputManager]);

  const handleBoostEnd = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    inputManager.inputRef.current.boost = false;
  }, [inputManager]);

  const handleJump = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    inputManager.inputRef.current.jump = true;
  }, [inputManager]);

  // 조이스틱 노브 위치 계산
  const getKnobOffset = (stick: JoystickState): { x: number; y: number } => {
    if (!stick.active) return { x: 0, y: 0 };
    const dx = stick.currentX - stick.originX;
    const dy = stick.currentY - stick.originY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxDist = STICK_SIZE / 2 - KNOB_SIZE / 2;
    if (dist > maxDist) {
      const ratio = maxDist / dist;
      return { x: dx * ratio, y: dy * ratio };
    }
    return { x: dx, y: dy };
  };

  if (!isMobile) return null;

  const leftKnob = getKnobOffset(leftStick.current);
  const rightKnob = getKnobOffset(rightStick.current);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 10,
        pointerEvents: 'auto',
        touchAction: 'none',
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {/* 왼쪽 조이스틱 (이동) — 하단 좌측 */}
      <div style={{
        position: 'absolute',
        bottom: 40,
        left: 30,
        width: STICK_SIZE,
        height: STICK_SIZE,
        borderRadius: '50%',
        backgroundColor: 'rgba(255,255,255,0.1)',
        border: '2px solid rgba(255,255,255,0.25)',
        pointerEvents: 'none',
      }}>
        {/* 노브 */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: KNOB_SIZE,
          height: KNOB_SIZE,
          borderRadius: '50%',
          backgroundColor: leftStick.current.active
            ? 'rgba(0, 255, 136, 0.5)'
            : 'rgba(255,255,255,0.3)',
          border: '2px solid rgba(255,255,255,0.4)',
          transform: `translate(${-KNOB_SIZE / 2 + leftKnob.x}px, ${-KNOB_SIZE / 2 + leftKnob.y}px)`,
          transition: leftStick.current.active ? 'none' : 'transform 150ms ease-out',
        }} />
        <div style={{
          position: 'absolute',
          bottom: -20,
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: '0.55rem',
          color: 'rgba(255,255,255,0.4)',
          fontFamily: '"Black Ops One", sans-serif',
          letterSpacing: '0.06em',
          pointerEvents: 'none',
        }}>
          MOVE
        </div>
      </div>

      {/* 오른쪽 조이스틱 (조준) — 하단 우측 */}
      <div style={{
        position: 'absolute',
        bottom: 40,
        right: 100,
        width: STICK_SIZE,
        height: STICK_SIZE,
        borderRadius: '50%',
        backgroundColor: 'rgba(255,255,255,0.1)',
        border: '2px solid rgba(255,255,255,0.25)',
        pointerEvents: 'none',
      }}>
        {/* 노브 */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: KNOB_SIZE,
          height: KNOB_SIZE,
          borderRadius: '50%',
          backgroundColor: rightStick.current.active
            ? 'rgba(255, 100, 100, 0.5)'
            : 'rgba(255,255,255,0.3)',
          border: '2px solid rgba(255,255,255,0.4)',
          transform: `translate(${-KNOB_SIZE / 2 + rightKnob.x}px, ${-KNOB_SIZE / 2 + rightKnob.y}px)`,
          transition: rightStick.current.active ? 'none' : 'transform 150ms ease-out',
        }} />
        <div style={{
          position: 'absolute',
          bottom: -20,
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: '0.55rem',
          color: 'rgba(255,255,255,0.4)',
          fontFamily: '"Black Ops One", sans-serif',
          letterSpacing: '0.06em',
          pointerEvents: 'none',
        }}>
          AIM
        </div>
      </div>

      {/* 부스트 버튼 — 우하단 조이스틱 위 */}
      <div
        style={{
          position: 'absolute',
          bottom: 180,
          right: 30,
          width: BTN_SIZE,
          height: BTN_SIZE,
          borderRadius: '50%',
          backgroundColor: 'rgba(255, 200, 50, 0.3)',
          border: '2px solid rgba(255, 200, 50, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'auto',
          touchAction: 'none',
        }}
        onTouchStart={handleBoostStart}
        onTouchEnd={handleBoostEnd}
        onTouchCancel={handleBoostEnd}
      >
        <span style={{
          fontFamily: '"Black Ops One", sans-serif',
          fontSize: '0.5rem',
          color: 'rgba(255, 200, 50, 0.8)',
          letterSpacing: '0.04em',
          pointerEvents: 'none',
        }}>
          BOOST
        </span>
      </div>

      {/* 점프 버튼 — 부스트 위 */}
      <div
        style={{
          position: 'absolute',
          bottom: 250,
          right: 30,
          width: BTN_SIZE,
          height: BTN_SIZE,
          borderRadius: '50%',
          backgroundColor: 'rgba(100, 200, 255, 0.3)',
          border: '2px solid rgba(100, 200, 255, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'auto',
          touchAction: 'none',
        }}
        onTouchStart={handleJump}
      >
        <span style={{
          fontFamily: '"Black Ops One", sans-serif',
          fontSize: '0.5rem',
          color: 'rgba(100, 200, 255, 0.8)',
          letterSpacing: '0.04em',
          pointerEvents: 'none',
        }}>
          JUMP
        </span>
      </div>
    </div>
  );
}
