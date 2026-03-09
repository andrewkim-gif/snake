/**
 * useInput - 입력 처리 훅
 * 키보드 및 조이스틱 입력 관리
 */

import React, { useEffect, useCallback } from 'react';
import { Vector2 } from '../types';
import { normalize } from '../utils/math';
import { JoystickState } from './useGameRefs';

export interface InputState {
  movement: Vector2;
  isMoving: boolean;
}

interface UseInputProps {
  keysPressed: React.MutableRefObject<Set<string>>;
  joystick: React.MutableRefObject<JoystickState>;
  onSpecialSkill?: () => void;
}

export function useInput({ keysPressed, joystick, onSpecialSkill }: UseInputProps) {
  // 키보드 이벤트 핸들러
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current.add(e.code);

      // E키로 스페셜 스킬
      if (e.code === 'KeyE' && onSpecialSkill) {
        onSpecialSkill();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.code);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [keysPressed, onSpecialSkill]);

  // 포인터 이벤트 핸들러 (조이스틱)
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.clientX < window.innerWidth / 2) {
      joystick.current = {
        active: true,
        origin: { x: e.clientX, y: e.clientY },
        current: { x: e.clientX, y: e.clientY },
        pointerId: e.pointerId
      };
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    }
  }, [joystick]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (joystick.current.active && joystick.current.pointerId === e.pointerId) {
      joystick.current.current = { x: e.clientX, y: e.clientY };
    }
  }, [joystick]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (joystick.current.pointerId === e.pointerId) {
      joystick.current = {
        active: false,
        origin: { x: 0, y: 0 },
        current: { x: 0, y: 0 },
        pointerId: null
      };
    }
  }, [joystick]);

  // 현재 입력 상태 계산
  const getInputState = useCallback((): InputState => {
    let dx = 0;
    let dy = 0;

    // 키보드 입력
    const keys = keysPressed.current;
    if (keys.has('KeyW') || keys.has('ArrowUp')) dy -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) dy += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) dx -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1;

    // 조이스틱 입력
    if (joystick.current.active) {
      const jdx = joystick.current.current.x - joystick.current.origin.x;
      const jdy = joystick.current.current.y - joystick.current.origin.y;
      const jlen = Math.sqrt(jdx * jdx + jdy * jdy);

      if (jlen > 10) { // 데드존
        dx = jdx / jlen;
        dy = jdy / jlen;
      }
    }

    const isMoving = dx !== 0 || dy !== 0;
    const movement = isMoving ? normalize({ x: dx, y: dy }) : { x: 0, y: 0 };

    return { movement, isMoving };
  }, [keysPressed, joystick]);

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    getInputState,
  };
}
