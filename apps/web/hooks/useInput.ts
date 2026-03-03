'use client';

import { useEffect, useRef, useCallback } from 'react';

interface InputState {
  angle: number;
  boost: boolean;
}

type InputCallback = (state: InputState) => void;

/**
 * 마우스 + 키보드 입력 훅
 * 마우스 이동 = 방향, 클릭 = 부스트
 * WASD/방향키 = 방향, Space = 부스트, ESC = 메뉴
 */
export function useInput(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  onInput: InputCallback,
  onEscape?: () => void,
) {
  const callbackRef = useRef(onInput);
  callbackRef.current = onInput;
  const escapeRef = useRef(onEscape);
  escapeRef.current = onEscape;

  const angleRef = useRef(0);
  const boostRef = useRef(false);
  const seqRef = useRef(0);

  const keysRef = useRef({ up: false, down: false, left: false, right: false });

  const lastSendRef = useRef(0);
  const lastSentAngleRef = useRef(0);
  const lastSentBoostRef = useRef(false);

  const sendInput = useCallback((force?: boolean) => {
    const now = Date.now();
    const angleDelta = Math.abs(angleRef.current - lastSentAngleRef.current);
    const boostChanged = boostRef.current !== lastSentBoostRef.current;
    const significantChange = angleDelta > Math.PI / 8 || boostChanged;

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

    // ── 마우스 입력 ──
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const dx = e.clientX - rect.left - centerX;
      const dy = e.clientY - rect.top - centerY;
      let angle = Math.atan2(dy, dx);
      if (angle < 0) angle += Math.PI * 2;
      angleRef.current = angle;
      sendInput();
    };

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

    // 터치 지원
    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      if (!touch) return;
      const rect = canvas.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const dx = touch.clientX - rect.left - centerX;
      const dy = touch.clientY - rect.top - centerY;
      let angle = Math.atan2(dy, dx);
      if (angle < 0) angle += Math.PI * 2;
      angleRef.current = angle;
      sendInput();
    };

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      if (!touch) return;
      const rect = canvas.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const dx = touch.clientX - rect.left - centerX;
      const dy = touch.clientY - rect.top - centerY;
      let angle = Math.atan2(dy, dx);
      if (angle < 0) angle += Math.PI * 2;
      angleRef.current = angle;
      boostRef.current = true;
      sendInput(true);
    };

    const handleTouchEnd = () => {
      boostRef.current = false;
      sendInput(true);
    };

    // ── 키보드 입력 ──
    const updateKeyboardAngle = () => {
      const k = keysRef.current;
      let dx = 0;
      let dy = 0;
      if (k.right) dx += 1;
      if (k.left) dx -= 1;
      if (k.down) dy += 1;
      if (k.up) dy -= 1;
      if (dx === 0 && dy === 0) return;
      let angle = Math.atan2(dy, dx);
      if (angle < 0) angle += Math.PI * 2;
      angleRef.current = angle;
      sendInput(true);
    };

    const directionKeys: Record<string, keyof typeof keysRef.current> = {
      KeyW: 'up', ArrowUp: 'up',
      KeyS: 'down', ArrowDown: 'down',
      KeyA: 'left', ArrowLeft: 'left',
      KeyD: 'right', ArrowRight: 'right',
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        escapeRef.current?.();
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        boostRef.current = true;
        sendInput(true);
        return;
      }
      const dir = directionKeys[e.code];
      if (dir) {
        e.preventDefault();
        keysRef.current[dir] = true;
        updateKeyboardAngle();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        boostRef.current = false;
        sendInput(true);
        return;
      }
      const dir = directionKeys[e.code];
      if (dir) {
        keysRef.current[dir] = false;
        updateKeyboardAngle();
      }
    };

    // 컨텍스트 메뉴 방지
    const handleContextMenu = (e: Event) => e.preventDefault();

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);
    canvas.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchend', handleTouchEnd);
      canvas.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [canvasRef, sendInput]);

  return { angleRef, boostRef, seqRef };
}
