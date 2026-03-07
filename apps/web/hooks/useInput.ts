'use client';

import { useEffect, useRef, useCallback } from 'react';

interface InputState {
  angle: number;
  boost: boolean;
  dash?: boolean;  // v16: E key dash (one-shot)
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

    // ── 키보드 방향 계산 ──
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
      // v16: E key → Dash (one-shot)
      if (e.code === 'KeyE') {
        e.preventDefault();
        callbackRef.current({
          angle: angleRef.current,
          boost: boostRef.current,
          dash: true,
        });
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

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [canvasRef, sendInput]);

  return { angleRef, boostRef, seqRef };
}
