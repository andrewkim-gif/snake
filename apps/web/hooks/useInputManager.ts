'use client';

/**
 * useInputManager — v16 Phase 2 입력 관리 훅
 *
 * WASD → 카메라 azimuth 기준 moveAngle 변환
 * 마우스 → raycasting to ground plane → aimAngle
 * Shift=boost(hold), E=dash(one-shot), Space=jump(one-shot)
 *
 * 반환: { moveAngle, aimAngle, boost, dash, jump, azimuth }
 */

import { useRef, useEffect, useCallback } from 'react';
import type { Camera } from 'three';
import { Raycaster, Vector2, Vector3, Plane } from 'three';

// ─── 타입 ───

export interface InputState {
  /** WASD 기반 이동 방향 (카메라 상대, rad). null = 정지 */
  moveAngle: number | null;
  /** 마우스 기반 조준 방향 (world space, rad) */
  aimAngle: number;
  /** Shift 홀드 */
  boost: boolean;
  /** E 키 one-shot (프레임마다 false로 리셋) */
  dash: boolean;
  /** Space 키 one-shot (프레임마다 false로 리셋) */
  jump: boolean;
}

export interface InputManagerReturn {
  /** 매 프레임 읽을 수 있는 입력 상태 ref */
  inputRef: React.MutableRefObject<InputState>;
  /** 카메라 azimuth (yaw) — TPSCamera에서 설정 */
  azimuthRef: React.MutableRefObject<number>;
  /** 카메라 pitch (phi) — TPSCamera에서 설정 */
  pitchRef: React.MutableRefObject<number>;
  /** 카메라 zoom (distance) — TPSCamera에서 설정 */
  zoomRef: React.MutableRefObject<number>;
  /** 우클릭 드래그 delta 누적 → TPSCamera가 소비 */
  cameraDeltaRef: React.MutableRefObject<{ dx: number; dy: number }>;
  /** 스크롤 delta 누적 → TPSCamera가 소비 */
  scrollDeltaRef: React.MutableRefObject<number>;
  /** dash one-shot 리셋 (GameLoop에서 sendInput 후 호출) */
  consumeDash: () => void;
  /** jump one-shot 리셋 */
  consumeJump: () => void;
}

// ─── WASD → base direction 매핑 ───

function computeBaseDirection(w: boolean, a: boolean, s: boolean, d: boolean): number | null {
  const fwd = w && !s;
  const bwd = s && !w;
  const lft = a && !d;
  const rgt = d && !a;

  if (fwd && lft) return Math.PI / 4;
  if (fwd && rgt) return -Math.PI / 4;
  if (bwd && lft) return (3 * Math.PI) / 4;
  if (bwd && rgt) return -(3 * Math.PI) / 4;
  if (fwd) return 0;
  if (bwd) return Math.PI;
  if (lft) return Math.PI / 2;
  if (rgt) return -Math.PI / 2;
  return null; // 정지
}

function normalizeAngle(a: number): number {
  a = a % (Math.PI * 2);
  return a < 0 ? a + Math.PI * 2 : a;
}

// ─── Ground plane (y=0) for raycasting ───
const _groundPlane = new Plane(new Vector3(0, 1, 0), 0);
const _raycaster = new Raycaster();
const _ndc = new Vector2();
const _intersect = new Vector3();

/**
 * useInputManager — 게임 입력 관리 훅
 *
 * @param containerRef - 입력 이벤트를 바인딩할 DOM 엘리먼트 ref
 * @param cameraRef - R3F camera ref (raycasting용, TPSCamera에서 설정)
 * @param playerPosRef - 플레이어 월드 위치 ref (aimAngle 계산용)
 * @param enabled - 입력 활성화 여부 (메뉴 열림 시 false)
 */
export function useInputManager(
  containerRef: React.RefObject<HTMLDivElement | null>,
  cameraRef: React.MutableRefObject<Camera | null>,
  playerPosRef: React.MutableRefObject<{ x: number; z: number }>,
  enabled: boolean = true,
): InputManagerReturn {
  // ─── Internal state refs ───
  const inputRef = useRef<InputState>({
    moveAngle: null,
    aimAngle: 0,
    boost: false,
    dash: false,
    jump: false,
  });

  const azimuthRef = useRef(0);  // TPSCamera가 매 프레임 업데이트
  const pitchRef = useRef(0.79); // ~45 deg
  const zoomRef = useRef(25);
  const cameraDeltaRef = useRef({ dx: 0, dy: 0 });
  const scrollDeltaRef = useRef(0);

  // 키 상태 (이벤트 핸들러에서 직접 관리)
  const keysRef = useRef({ w: false, a: false, s: false, d: false });
  const rightDragRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });

  const consumeDash = useCallback(() => {
    inputRef.current.dash = false;
  }, []);

  const consumeJump = useCallback(() => {
    inputRef.current.jump = false;
  }, []);

  // ─── 이벤트 리스너 바인딩 ───
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // ─── 키보드 ───
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!enabled) return;
      const code = e.code;

      // WASD
      if (code === 'KeyW' || code === 'ArrowUp') { keysRef.current.w = true; e.preventDefault(); }
      if (code === 'KeyA' || code === 'ArrowLeft') { keysRef.current.a = true; e.preventDefault(); }
      if (code === 'KeyS' || code === 'ArrowDown') { keysRef.current.s = true; e.preventDefault(); }
      if (code === 'KeyD' || code === 'ArrowRight') { keysRef.current.d = true; e.preventDefault(); }

      // Shift = boost
      if (code === 'ShiftLeft' || code === 'ShiftRight') {
        inputRef.current.boost = true;
        e.preventDefault();
      }

      // E = dash (one-shot)
      if (code === 'KeyE') {
        inputRef.current.dash = true;
        e.preventDefault();
      }

      // Space = jump (one-shot)
      if (code === 'Space') {
        inputRef.current.jump = true;
        e.preventDefault();
      }

      // WASD → moveAngle 업데이트
      const { w, a, s, d } = keysRef.current;
      const baseDir = computeBaseDirection(w, a, s, d);
      if (baseDir !== null) {
        inputRef.current.moveAngle = normalizeAngle(azimuthRef.current + baseDir);
      } else {
        inputRef.current.moveAngle = null;
      }
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

      // WASD → moveAngle 업데이트
      const { w, a, s, d } = keysRef.current;
      const baseDir = computeBaseDirection(w, a, s, d);
      if (baseDir !== null) {
        inputRef.current.moveAngle = normalizeAngle(azimuthRef.current + baseDir);
      } else {
        inputRef.current.moveAngle = null;
      }
    };

    // ─── 마우스 ───
    const handleMouseMove = (e: MouseEvent) => {
      if (!enabled) return;

      // 우클릭 드래그 → 카메라 회전
      if (rightDragRef.current) {
        const dx = e.clientX - lastMouseRef.current.x;
        const dy = e.clientY - lastMouseRef.current.y;
        cameraDeltaRef.current.dx += dx;
        cameraDeltaRef.current.dy += dy;
        lastMouseRef.current.x = e.clientX;
        lastMouseRef.current.y = e.clientY;
        return; // 드래그 중에는 aim 업데이트 안 함
      }

      // 마우스 위치 → aimAngle (raycasting to ground plane)
      const cam = cameraRef.current;
      if (!cam) return;

      const rect = container.getBoundingClientRect();
      _ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      _ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      _raycaster.setFromCamera(_ndc, cam);
      const hit = _raycaster.ray.intersectPlane(_groundPlane, _intersect);
      if (hit) {
        const px = playerPosRef.current.x;
        const pz = playerPosRef.current.z;
        // atan2(dz, dx) → XZ 평면에서의 각도
        inputRef.current.aimAngle = Math.atan2(
          _intersect.z - pz,
          _intersect.x - px,
        );
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (!enabled) return;

      // 우클릭 → 카메라 드래그 시작
      if (e.button === 2) {
        rightDragRef.current = true;
        lastMouseRef.current.x = e.clientX;
        lastMouseRef.current.y = e.clientY;
        e.preventDefault();
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 2) {
        rightDragRef.current = false;
      }
    };

    // 우클릭 메뉴 방지
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // ─── 스크롤 (줌) ───
    const handleWheel = (e: WheelEvent) => {
      if (!enabled) return;
      e.preventDefault();
      scrollDeltaRef.current += e.deltaY;
    };

    // ─── 터치 (모바일 — 기본 지원, 향후 듀얼 조이스틱으로 확장) ───
    const handleTouchMove = (e: TouchEvent) => {
      if (!enabled) return;
      e.preventDefault();
      if (e.touches.length === 0) return;

      const touch = e.touches[0];
      const cam = cameraRef.current;
      if (!cam) return;

      const rect = container.getBoundingClientRect();
      _ndc.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
      _ndc.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;

      _raycaster.setFromCamera(_ndc, cam);
      const hit = _raycaster.ray.intersectPlane(_groundPlane, _intersect);
      if (hit) {
        const px = playerPosRef.current.x;
        const pz = playerPosRef.current.z;
        inputRef.current.aimAngle = Math.atan2(
          _intersect.z - pz,
          _intersect.x - px,
        );
      }
    };

    // ─── 바인딩 ───
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('contextmenu', handleContextMenu);
    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('contextmenu', handleContextMenu);
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('touchmove', handleTouchMove);

      // 키 상태 리셋
      keysRef.current = { w: false, a: false, s: false, d: false };
      inputRef.current = {
        moveAngle: null,
        aimAngle: 0,
        boost: false,
        dash: false,
        jump: false,
      };
    };
  }, [containerRef, cameraRef, playerPosRef, enabled]);

  // ─── WASD 방향을 azimuth 변화에 따라 실시간 재계산하는 rAF ───
  // (카메라가 회전하면 같은 W키라도 moveAngle이 달라져야 함)
  useEffect(() => {
    let raf = 0;
    const update = () => {
      const { w, a, s, d } = keysRef.current;
      const baseDir = computeBaseDirection(w, a, s, d);
      if (baseDir !== null) {
        inputRef.current.moveAngle = normalizeAngle(azimuthRef.current + baseDir);
      }
      // baseDir === null 이면 이미 keyup에서 null로 세팅됨
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
  };
}
