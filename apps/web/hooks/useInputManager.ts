'use client';

/**
 * useInputManager — FPS-style 입력 관리 (완전 재작성)
 *
 * FPS/TPS 스타일:
 *   - 클릭 → Pointer Lock 진입
 *   - 마우스 이동 → cameraDelta (yaw/pitch) — TPSCamera가 소비
 *   - aimAngle = 카메라 yaw 방향 (TPSCamera의 azimuthRef에서 읽음)
 *   - WASD → 카메라 방향 기준 moveAngle
 *   - Shift=boost, E=dash, Space=jump
 *   - 스크롤 → scrollDelta (줌) — TPSCamera가 소비
 */

import { useRef, useEffect, useCallback } from 'react';
import type { Camera } from 'three';

// ─── 타입 ───

export interface InputState {
  /** WASD 기반 이동 방향 (카메라 상대, rad). null = 정지 */
  moveAngle: number | null;
  /** 조준 방향 = 카메라 yaw 방향 (rad) */
  aimAngle: number;
  /** Shift 홀드 */
  boost: boolean;
  /** E 키 one-shot */
  dash: boolean;
  /** Space 키 one-shot */
  jump: boolean;
}

export interface InputManagerReturn {
  inputRef: React.MutableRefObject<InputState>;
  /** 카메라 yaw — TPSCamera에서 설정 */
  azimuthRef: React.MutableRefObject<number>;
  /** 카메라 pitch — TPSCamera에서 설정 */
  pitchRef: React.MutableRefObject<number>;
  /** 카메라 zoom — TPSCamera에서 설정 */
  zoomRef: React.MutableRefObject<number>;
  /** 마우스 delta 누적 → TPSCamera가 소비 */
  cameraDeltaRef: React.MutableRefObject<{ dx: number; dy: number }>;
  /** 스크롤 delta 누적 → TPSCamera가 소비 */
  scrollDeltaRef: React.MutableRefObject<number>;
  consumeDash: () => void;
  consumeJump: () => void;
  /** Pointer Lock 활성 여부 */
  pointerLockedRef: React.MutableRefObject<boolean>;
}

// ─── 마우스 감도 ───
const MOUSE_SENSITIVITY = 0.003;

function normalizeAngle(a: number): number {
  a = a % (Math.PI * 2);
  return a < 0 ? a + Math.PI * 2 : a;
}

/**
 * WASD 입력 + 카메라 yaw → 서버 moveAngle 계산
 *
 * 카메라 좌표계에서 서버 좌표계로 변환:
 *   forward (Three.js): (-sin(yaw), -cos(yaw)) → server (fsx, fsy)
 *   right (Three.js):   (cos(yaw), -sin(yaw))  → server (rsx, rsy)
 *   inputVector = forward * inputZ + right * inputX
 *   moveAngle = atan2(serverY, serverX)
 */
function computeMoveAngle(
  w: boolean, a: boolean, s: boolean, d: boolean, yaw: number,
): number | null {
  // 입력 축 (카메라 로컬 좌표)
  const inputZ = (w ? 1 : 0) - (s ? 1 : 0); // forward/backward
  const inputX = (d ? 1 : 0) - (a ? 1 : 0); // right/left
  if (inputZ === 0 && inputX === 0) return null;

  // 카메라 방향 벡터 (서버 좌표계)
  const fsx = -Math.sin(yaw); // forward server X
  const fsy = -Math.cos(yaw); // forward server Y
  const rsx = Math.cos(yaw);  // right server X
  const rsy = -Math.sin(yaw); // right server Y

  // 서버 좌표계에서의 이동 벡터
  const sx = fsx * inputZ + rsx * inputX;
  const sy = fsy * inputZ + rsy * inputX;

  return normalizeAngle(Math.atan2(sy, sx));
}

/**
 * useInputManager — FPS-style 게임 입력 훅
 */
export function useInputManager(
  containerRef: React.RefObject<HTMLDivElement | null>,
  cameraRef: React.MutableRefObject<Camera | null>,
  playerPosRef: React.MutableRefObject<{ x: number; z: number }>,
  enabled: boolean = true,
): InputManagerReturn {
  const inputRef = useRef<InputState>({
    moveAngle: null,
    aimAngle: 0,
    boost: false,
    dash: false,
    jump: false,
  });

  const azimuthRef = useRef(0);
  const pitchRef = useRef(0.5);
  const zoomRef = useRef(30);
  const cameraDeltaRef = useRef({ dx: 0, dy: 0 });
  const scrollDeltaRef = useRef(0);
  const pointerLockedRef = useRef(false);

  const keysRef = useRef({ w: false, a: false, s: false, d: false });

  const consumeDash = useCallback(() => { inputRef.current.dash = false; }, []);
  const consumeJump = useCallback(() => { inputRef.current.jump = false; }, []);

  // ─── Pointer Lock + 이벤트 ───
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Pointer Lock 진입
    const handleClick = () => {
      if (!enabled) return;
      if (!document.pointerLockElement) {
        container.requestPointerLock();
      }
    };

    // Pointer Lock 상태 변경
    const handleLockChange = () => {
      pointerLockedRef.current = document.pointerLockElement === container;
    };

    // 마우스 이동 → cameraDelta (Pointer Lock 상태에서만)
    const handleMouseMove = (e: MouseEvent) => {
      if (!enabled) return;
      if (!document.pointerLockElement) return;
      cameraDeltaRef.current.dx += e.movementX * MOUSE_SENSITIVITY;
      cameraDeltaRef.current.dy += e.movementY * MOUSE_SENSITIVITY;
    };

    // 키보드
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!enabled) return;
      const code = e.code;

      if (code === 'KeyW' || code === 'ArrowUp') { keysRef.current.w = true; e.preventDefault(); }
      if (code === 'KeyA' || code === 'ArrowLeft') { keysRef.current.a = true; e.preventDefault(); }
      if (code === 'KeyS' || code === 'ArrowDown') { keysRef.current.s = true; e.preventDefault(); }
      if (code === 'KeyD' || code === 'ArrowRight') { keysRef.current.d = true; e.preventDefault(); }

      if (code === 'ShiftLeft' || code === 'ShiftRight') {
        inputRef.current.boost = true;
        e.preventDefault();
      }
      if (code === 'KeyE') {
        inputRef.current.dash = true;
        e.preventDefault();
      }
      if (code === 'Space') {
        inputRef.current.jump = true;
        e.preventDefault();
      }

      // WASD → moveAngle 즉시 업데이트
      const { w, a, s, d } = keysRef.current;
      inputRef.current.moveAngle = computeMoveAngle(w, a, s, d, azimuthRef.current);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const code = e.code;

      if (code === 'KeyW' || code === 'ArrowUp') keysRef.current.w = false;
      if (code === 'KeyA' || code === 'ArrowLeft') keysRef.current.a = false;
      if (code === 'KeyS' || code === 'ArrowDown') keysRef.current.s = false;
      if (code === 'KeyD' || code === 'ArrowRight') keysRef.current.d = false;

      if (code === 'ShiftLeft' || code === 'ShiftRight') {
        inputRef.current.boost = false;
      }

      const { w, a, s, d } = keysRef.current;
      inputRef.current.moveAngle = computeMoveAngle(w, a, s, d, azimuthRef.current);
    };

    // 스크롤 → 줌
    const handleWheel = (e: WheelEvent) => {
      if (!enabled) return;
      e.preventDefault();
      scrollDeltaRef.current += e.deltaY;
    };

    // 우클릭 메뉴 방지
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // 터치 (모바일 — MobileControls가 별도 처리, 기본 방지만)
    const handleTouchMove = (e: TouchEvent) => {
      if (!enabled) return;
      e.preventDefault();
    };

    // ─── 바인딩 ───
    container.addEventListener('click', handleClick);
    document.addEventListener('pointerlockchange', handleLockChange);
    document.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    container.addEventListener('contextmenu', handleContextMenu);
    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      container.removeEventListener('click', handleClick);
      document.removeEventListener('pointerlockchange', handleLockChange);
      document.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      container.removeEventListener('contextmenu', handleContextMenu);
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('touchmove', handleTouchMove);

      // 상태 리셋
      keysRef.current = { w: false, a: false, s: false, d: false };
      inputRef.current = { moveAngle: null, aimAngle: 0, boost: false, dash: false, jump: false };

      // Pointer Lock 해제
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
    };
  }, [containerRef, cameraRef, playerPosRef, enabled]);

  // ─── rAF: moveAngle + aimAngle을 카메라 yaw 변화에 따라 실시간 재계산 ───
  useEffect(() => {
    let raf = 0;
    const update = () => {
      const yaw = azimuthRef.current;

      // aimAngle = 카메라 forward 방향의 서버 heading
      // 카메라 forward (Three.js): (-sin(yaw), -cos(yaw)) → 서버 (x,y)
      // 서버 heading = atan2(serverY, serverX) = atan2(-cos(yaw), -sin(yaw))
      inputRef.current.aimAngle = normalizeAngle(
        Math.atan2(-Math.cos(yaw), -Math.sin(yaw)),
      );

      // WASD → moveAngle (벡터 변환)
      const { w, a, s, d } = keysRef.current;
      const ma = computeMoveAngle(w, a, s, d, yaw);
      if (ma !== null) {
        inputRef.current.moveAngle = ma;
      }
      // ma === null이면 keyup에서 이미 null 설정됨

      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, []);

  return {
    inputRef,
    azimuthRef,
    pitchRef,
    zoomRef,
    cameraDeltaRef,
    scrollDeltaRef,
    consumeDash,
    consumeJump,
    pointerLockedRef,
  };
}
