'use client';

/**
 * ARMobileControls — 모바일 터치 컨트롤 (Phase 7)
 *
 * 터치 디바이스 자동 감지:
 * - 좌측: 가상 조이스틱 (이동)
 * - 우측: 카메라 회전 (드래그)
 * - 자동 공격은 기본 (서버 측 처리)
 * - 해상도 다운스케일 (DPR 1.5 제한)
 * - 그림자 비활성화 (모바일)
 */

import { useRef, useEffect, useState, useCallback, memo } from 'react';

// ── Types ────────────────────────────────────────────────────

interface TouchPoint {
  id: number;
  startX: number;
  startZ: number;
  currentX: number;
  currentZ: number;
}

interface ARMobileControlsProps {
  /** 이동 입력 콜백 (-1..1, -1..1) */
  onMove: (dirX: number, dirZ: number) => void;
  /** 카메라 회전 콜백 (deltaYaw, deltaPitch) */
  onCameraRotate: (deltaYaw: number, deltaPitch: number) => void;
  /** 게임 활성 여부 */
  active: boolean;
}

// ── Constants ────────────────────────────────────────────────

const JOYSTICK_SIZE = 120;
const JOYSTICK_KNOB_SIZE = 48;
const JOYSTICK_MAX_DIST = 50;
const CAMERA_SENSITIVITY = 0.004;
const DEAD_ZONE = 0.1;

// ── Touch Detection ──────────────────────────────────────────

export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    // @ts-expect-error — msMaxTouchPoints is IE-specific
    navigator.msMaxTouchPoints > 0
  );
}

// ── Mobile Performance ───────────────────────────────────────

/**
 * 모바일 DPR 제한: 최대 1.5로 제한하여 GPU 부하 감소
 */
export function getMobileDPR(): number {
  if (typeof window === 'undefined') return 1;
  const dpr = window.devicePixelRatio || 1;
  if (isTouchDevice()) {
    return Math.min(dpr, 1.5);
  }
  return Math.min(dpr, 2);
}

/**
 * 모바일에서 그림자 비활성화 여부
 */
export function shouldDisableShadows(): boolean {
  return isTouchDevice();
}

// ── Component ────────────────────────────────────────────────

function ARMobileControlsInner({
  onMove,
  onCameraRotate,
  active,
}: ARMobileControlsProps) {
  const [isTouch, setIsTouch] = useState(false);
  const joystickRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);

  // 터치 트래킹
  const leftTouch = useRef<TouchPoint | null>(null);
  const rightTouch = useRef<TouchPoint | null>(null);

  // 조이스틱 위치
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const [joystickVisible, setJoystickVisible] = useState(false);
  const [joystickOrigin, setJoystickOrigin] = useState({ x: 0, y: 0 });

  // 터치 디바이스 감지
  useEffect(() => {
    setIsTouch(isTouchDevice());
  }, []);

  // ── Touch Handlers ─────────────────────────────────────────

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!active) return;
      e.preventDefault();

      const screenW = window.innerWidth;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];

        if (t.clientX < screenW / 2) {
          // 좌측: 조이스틱
          leftTouch.current = {
            id: t.identifier,
            startX: t.clientX,
            startZ: t.clientY,
            currentX: t.clientX,
            currentZ: t.clientY,
          };
          setJoystickOrigin({ x: t.clientX, y: t.clientY });
          setJoystickVisible(true);
          setKnobPos({ x: 0, y: 0 });
        } else {
          // 우측: 카메라
          rightTouch.current = {
            id: t.identifier,
            startX: t.clientX,
            startZ: t.clientY,
            currentX: t.clientX,
            currentZ: t.clientY,
          };
        }
      }
    },
    [active]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!active) return;
      e.preventDefault();

      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];

        // 좌측: 조이스틱
        if (leftTouch.current && t.identifier === leftTouch.current.id) {
          const dx = t.clientX - leftTouch.current.startX;
          const dy = t.clientY - leftTouch.current.startZ;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const clampedDist = Math.min(dist, JOYSTICK_MAX_DIST);

          let normX = 0;
          let normY = 0;
          if (dist > 0) {
            normX = (dx / dist) * clampedDist;
            normY = (dy / dist) * clampedDist;
          }

          setKnobPos({ x: normX, y: normY });

          // 이동 입력 (-1..1)
          const inputX = normX / JOYSTICK_MAX_DIST;
          const inputZ = normY / JOYSTICK_MAX_DIST;

          // 데드존 적용
          const mag = Math.sqrt(inputX * inputX + inputZ * inputZ);
          if (mag > DEAD_ZONE) {
            onMove(inputX, inputZ);
          } else {
            onMove(0, 0);
          }

          leftTouch.current.currentX = t.clientX;
          leftTouch.current.currentZ = t.clientY;
        }

        // 우측: 카메라 회전
        if (rightTouch.current && t.identifier === rightTouch.current.id) {
          const dx = t.clientX - rightTouch.current.currentX;
          const dy = t.clientY - rightTouch.current.currentZ;

          onCameraRotate(
            -dx * CAMERA_SENSITIVITY,
            dy * CAMERA_SENSITIVITY
          );

          rightTouch.current.currentX = t.clientX;
          rightTouch.current.currentZ = t.clientY;
        }
      }
    },
    [active, onMove, onCameraRotate]
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];

        if (leftTouch.current && t.identifier === leftTouch.current.id) {
          leftTouch.current = null;
          setJoystickVisible(false);
          setKnobPos({ x: 0, y: 0 });
          onMove(0, 0);
        }

        if (rightTouch.current && t.identifier === rightTouch.current.id) {
          rightTouch.current = null;
        }
      }
    },
    [onMove]
  );

  // ── Attach touch listeners ─────────────────────────────────

  useEffect(() => {
    if (!isTouch || !active) return;

    const opts: AddEventListenerOptions = { passive: false };
    document.addEventListener('touchstart', handleTouchStart, opts);
    document.addEventListener('touchmove', handleTouchMove, opts);
    document.addEventListener('touchend', handleTouchEnd);
    document.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [isTouch, active, handleTouchStart, handleTouchMove, handleTouchEnd]);

  // 터치 디바이스가 아니면 렌더링하지 않음
  if (!isTouch) return null;

  return (
    <>
      {/* 가상 조이스틱 (좌측) */}
      {joystickVisible && (
        <div
          ref={joystickRef}
          style={{
            position: 'fixed',
            left: joystickOrigin.x - JOYSTICK_SIZE / 2,
            top: joystickOrigin.y - JOYSTICK_SIZE / 2,
            width: JOYSTICK_SIZE,
            height: JOYSTICK_SIZE,
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            border: '2px solid rgba(255, 255, 255, 0.3)',
            zIndex: 100,
            pointerEvents: 'none',
          }}
        >
          {/* 조이스틱 노브 */}
          <div
            ref={knobRef}
            style={{
              position: 'absolute',
              left: JOYSTICK_SIZE / 2 - JOYSTICK_KNOB_SIZE / 2 + knobPos.x,
              top: JOYSTICK_SIZE / 2 - JOYSTICK_KNOB_SIZE / 2 + knobPos.y,
              width: JOYSTICK_KNOB_SIZE,
              height: JOYSTICK_KNOB_SIZE,
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.5)',
              border: '2px solid rgba(255, 255, 255, 0.7)',
              pointerEvents: 'none',
            }}
          />
        </div>
      )}

      {/* 조이스틱 힌트 (좌하단) — 조이스틱 비활성 시 */}
      {!joystickVisible && (
        <div
          style={{
            position: 'fixed',
            left: 24,
            bottom: 100,
            width: 60,
            height: 60,
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px dashed rgba(255, 255, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255, 255, 255, 0.3)',
            fontSize: 10,
            fontFamily: '"Rajdhani", sans-serif',
            pointerEvents: 'none',
            zIndex: 95,
          }}
        >
          MOVE
        </div>
      )}

      {/* 카메라 회전 힌트 (우하단) */}
      <div
        style={{
          position: 'fixed',
          right: 24,
          bottom: 100,
          width: 60,
          height: 60,
          borderRadius: '50%',
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          border: '1px dashed rgba(255, 255, 255, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(255, 255, 255, 0.3)',
          fontSize: 10,
          fontFamily: '"Rajdhani", sans-serif',
          pointerEvents: 'none',
          zIndex: 95,
        }}
      >
        LOOK
      </div>

      {/* 자동 공격 인디케이터 (상단) */}
      <div
        style={{
          position: 'fixed',
          right: 16,
          top: 80,
          padding: '4px 10px',
          borderRadius: 4,
          backgroundColor: 'rgba(76, 175, 80, 0.2)',
          border: '1px solid rgba(76, 175, 80, 0.4)',
          color: '#4CAF50',
          fontSize: 10,
          fontFamily: '"Rajdhani", sans-serif',
          fontWeight: 600,
          letterSpacing: 1,
          pointerEvents: 'none',
          zIndex: 95,
        }}
      >
        AUTO ATK
      </div>
    </>
  );
}

export const ARMobileControls = memo(ARMobileControlsInner);
