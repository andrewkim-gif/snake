'use client';

import { useEffect, useRef, useCallback } from 'react';

interface InputState {
  angle: number;
  boost: boolean;
}

type InputCallback = (state: InputState) => void;

/**
 * 마우스/터치 → 각도 + 부스트 입력 훅
 * 캔버스 중심 기준으로 마우스 방향의 각도를 계산
 */
export function useInput(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  onInput: InputCallback,
) {
  const callbackRef = useRef(onInput);
  callbackRef.current = onInput;

  const angleRef = useRef(0);
  const boostRef = useRef(false);
  const seqRef = useRef(0);

  // 키보드 방향키 상태 (동시 입력 지원)
  const keysRef = useRef({ up: false, down: false, left: false, right: false });
  // 마우스 vs 키보드 입력 모드 (마지막 사용 입력 우선)
  const inputModeRef = useRef<'mouse' | 'keyboard'>('mouse');

  // 50Hz throttle (20ms)
  const lastSendRef = useRef(0);
  const lastSentAngleRef = useRef(0);
  const lastSentBoostRef = useRef(false);

  const sendInput = useCallback((force?: boolean) => {
    const now = Date.now();
    // 각도 변화(π/8 = 22.5도 이상) 또는 부스트 토글 시 쓰로틀 우회
    const angleDelta = Math.abs(angleRef.current - lastSentAngleRef.current);
    const boostChanged = boostRef.current !== lastSentBoostRef.current;
    const significantChange = angleDelta > Math.PI / 8 || boostChanged;

    // 20ms 쓰로틀 (50Hz) — 서버 20Hz보다 빠르지만 반응성 확보
    if (!force && !significantChange && now - lastSendRef.current < 20) return;
    lastSendRef.current = now;
    lastSentAngleRef.current = angleRef.current;
    lastSentBoostRef.current = boostRef.current;
    callbackRef.current({
      angle: angleRef.current,
      boost: boostRef.current,
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // 마우스 이동 → 각도 계산
    const handleMouseMove = (e: MouseEvent) => {
      inputModeRef.current = 'mouse';
      const rect = canvas.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const dx = e.clientX - rect.left - cx;
      const dy = e.clientY - rect.top - cy;
      angleRef.current = Math.atan2(dy, dx);
      if (angleRef.current < 0) angleRef.current += Math.PI * 2;
      sendInput();
    };

    // 마우스 클릭 → 부스트 (즉시 전송)
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        boostRef.current = true;
        sendInput(true);
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        boostRef.current = false;
        sendInput(true);
      }
    };

    // 키보드 → 방향 + 부스트
    const updateKeyboardAngle = () => {
      const k = keysRef.current;
      let dx = 0;
      let dy = 0;
      if (k.right) dx += 1;
      if (k.left) dx -= 1;
      if (k.down) dy += 1;
      if (k.up) dy -= 1;
      if (dx === 0 && dy === 0) return; // 키 없으면 각도 유지
      let angle = Math.atan2(dy, dx);
      if (angle < 0) angle += Math.PI * 2;
      angleRef.current = angle;
      sendInput(true); // 키보드 방향 전환은 항상 즉시 전송
    };

    const directionKeys: Record<string, keyof typeof keysRef.current> = {
      KeyW: 'up', ArrowUp: 'up',
      KeyS: 'down', ArrowDown: 'down',
      KeyA: 'left', ArrowLeft: 'left',
      KeyD: 'right', ArrowRight: 'right',
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        boostRef.current = true;
        sendInput(true); // 부스트 토글 즉시 전송
        return;
      }
      const dir = directionKeys[e.code];
      if (dir) {
        e.preventDefault();
        inputModeRef.current = 'keyboard';
        keysRef.current[dir] = true;
        updateKeyboardAngle();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        boostRef.current = false;
        sendInput(true); // 부스트 해제 즉시 전송
        return;
      }
      const dir = directionKeys[e.code];
      if (dir) {
        keysRef.current[dir] = false;
        updateKeyboardAngle();
      }
    };

    // 터치 → 각도 + 부스트
    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const dx = touch.clientX - rect.left - cx;
      const dy = touch.clientY - rect.top - cy;
      angleRef.current = Math.atan2(dy, dx);
      if (angleRef.current < 0) angleRef.current += Math.PI * 2;
      sendInput();
    };

    // 더블탭 → 부스트
    let lastTap = 0;
    const handleTouchStart = (e: TouchEvent) => {
      const now = Date.now();
      if (now - lastTap < 300) {
        boostRef.current = true;
        sendInput();
      }
      lastTap = now;

      // 첫 터치도 각도 계산
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const dx = touch.clientX - rect.left - cx;
      const dy = touch.clientY - rect.top - cy;
      angleRef.current = Math.atan2(dy, dx);
      if (angleRef.current < 0) angleRef.current += Math.PI * 2;
    };

    const handleTouchEnd = () => {
      boostRef.current = false;
      sendInput();
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchstart', handleTouchStart, { passive: true });
    canvas.addEventListener('touchend', handleTouchEnd);

    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, [canvasRef, sendInput]);

  return { angleRef, boostRef, seqRef };
}
