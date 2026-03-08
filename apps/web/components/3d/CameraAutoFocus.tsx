'use client';

/**
 * CameraAutoFocus — v23 Phase 1 (v15 Phase 6에서 업그레이드)
 * 주요 이벤트 발생 시 해당 국가로 카메라를 smooth 회전시키는 컴포넌트.
 *
 * v23 변경사항:
 * - OrbitControls 충돌 방지: 포커스 중 OrbitControls.enabled = false
 * - 유저 입력(pointerdown/wheel/touchstart) 감지 시 즉시 애니메이션 중단
 * - 포커스 완료 후 OrbitControls.enabled = true 복원
 * - GC 방지: 모듈 스코프 temp 객체 사전 할당
 *
 * 동작:
 * 1. 부모가 onCameraTarget 콜백을 통해 목표 위치(Vector3) 전달
 * 2. 3초에 걸쳐 카메라를 구면 보간(slerp)으로 이동
 * 3. 카메라 distance는 유지하면서 방향만 변경
 * 4. 애니메이션 중 유저 제스처 감지 시 즉시 중단 + OrbitControls 복원
 *
 * 요구사항:
 * - OrbitControls에 makeDefault prop 필요 (useThree().controls 접근용)
 */

import { useRef, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// ─── Types ───

export interface CameraAutoFocusProps {
  /** Ref containing the target position to focus on (set to null when idle) */
  targetRef: React.RefObject<THREE.Vector3 | null>;
  /** Duration of the smooth rotation in seconds */
  duration?: number;
  /** Globe radius (for calculating camera orbit distance) */
  globeRadius?: number;
}

// ─── Constants ───

const DEFAULT_DURATION = 3.0;       // 3초 smooth 회전
const DEFAULT_GLOBE_RADIUS = 100;
const USER_INPUT_EVENTS = ['pointerdown', 'wheel', 'touchstart'] as const;

// ─── GC 방지: 모듈 스코프 temp 객체 ───

const _startDir = new THREE.Vector3();
const _endDir = new THREE.Vector3();
const _currentDir = new THREE.Vector3();
const _qStart = new THREE.Quaternion();
const _qEnd = new THREE.Quaternion();
const _qCurrent = new THREE.Quaternion();
const _forward = new THREE.Vector3(0, 0, 1);
const _targetDir = new THREE.Vector3();

// ─── Component ───

export function CameraAutoFocus({
  targetRef,
  duration = DEFAULT_DURATION,
  globeRadius = DEFAULT_GLOBE_RADIUS,
}: CameraAutoFocusProps) {
  const { camera, gl, controls } = useThree();

  // 애니메이션 상태
  const animatingRef = useRef(false);
  const startTimeRef = useRef(0);
  const startPosRef = useRef(new THREE.Vector3());
  const targetPosRef = useRef(new THREE.Vector3());
  const clockRef = useRef(0);
  const cancelledRef = useRef(false);

  // ─── OrbitControls 활성화/비활성화 헬퍼 ───

  const setControlsEnabled = useCallback((enabled: boolean) => {
    if (controls && 'enabled' in controls) {
      (controls as any).enabled = enabled;
    }
  }, [controls]);

  // ─── 애니메이션 중단 (유저 입력 시) ───

  const cancelAnimation = useCallback(() => {
    if (!animatingRef.current) return;
    animatingRef.current = false;
    cancelledRef.current = true;
    // OrbitControls 즉시 복원
    setControlsEnabled(true);
  }, [setControlsEnabled]);

  // ─── 유저 입력 이벤트 리스너 등록/해제 ───

  useEffect(() => {
    const domElement = gl.domElement;
    if (!domElement) return;

    const handler = () => cancelAnimation();

    for (const eventName of USER_INPUT_EVENTS) {
      domElement.addEventListener(eventName, handler, { passive: true });
    }

    return () => {
      for (const eventName of USER_INPUT_EVENTS) {
        domElement.removeEventListener(eventName, handler);
      }
    };
  }, [gl.domElement, cancelAnimation]);

  // ─── 컴포넌트 언마운트 시 OrbitControls 복원 ───

  useEffect(() => {
    return () => {
      if (animatingRef.current) {
        setControlsEnabled(true);
      }
    };
  }, [setControlsEnabled]);

  useFrame((_state, delta) => {
    clockRef.current += delta;

    // 새로운 타겟이 설정되었는지 확인
    const newTarget = targetRef.current;
    if (newTarget && !animatingRef.current) {
      // 새 애니메이션 시작
      animatingRef.current = true;
      cancelledRef.current = false;
      startTimeRef.current = clockRef.current;
      startPosRef.current.copy(camera.position);

      // 목표 카메라 위치 계산: target 방향으로 현재 distance 유지
      const currentDist = camera.position.length();
      _targetDir.copy(newTarget).normalize();
      targetPosRef.current.copy(_targetDir).multiplyScalar(currentDist);

      // 타겟 소비 (1회성)
      (targetRef as React.MutableRefObject<THREE.Vector3 | null>).current = null;

      // OrbitControls 비활성화 (포커스 중 충돌 방지)
      setControlsEnabled(false);
    }

    // 애니메이션 진행
    if (animatingRef.current) {
      const elapsed = clockRef.current - startTimeRef.current;
      const t = Math.min(elapsed / duration, 1.0);

      // easeInOutCubic: 부드러운 시작/끝
      const eased = t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;

      // 구면 보간 (Slerp) — temp 객체 사용 (GC 방지)
      _startDir.copy(startPosRef.current).normalize();
      _endDir.copy(targetPosRef.current).normalize();
      const currentDist = camera.position.length();

      // Quaternion slerp를 사용한 구면 보간
      _forward.set(0, 0, 1);
      _qStart.setFromUnitVectors(_forward, _startDir);
      _forward.set(0, 0, 1);
      _qEnd.setFromUnitVectors(_forward, _endDir);
      _qCurrent.copy(_qStart).slerp(_qEnd, eased);

      // 보간된 방향 벡터 계산
      _currentDir.set(0, 0, 1).applyQuaternion(_qCurrent);
      camera.position.copy(_currentDir).multiplyScalar(currentDist);

      // 항상 원점(글로브 중심)을 바라봄
      camera.lookAt(0, 0, 0);

      if (t >= 1.0) {
        animatingRef.current = false;
        // 포커스 완료: OrbitControls 복원
        setControlsEnabled(true);
      }
    }
  });

  return null;
}

export default CameraAutoFocus;
