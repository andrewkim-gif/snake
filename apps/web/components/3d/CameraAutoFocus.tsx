'use client';

/**
 * CameraAutoFocus — v15 Phase 6
 * 주요 이벤트 발생 시 해당 국가로 카메라를 smooth 회전시키는 컴포넌트.
 *
 * 동작:
 * 1. 부모가 onCameraTarget 콜백을 통해 목표 위치(Vector3) 전달
 * 2. 3초에 걸쳐 OrbitControls.target을 lerp으로 이동
 * 3. 카메라 distance는 유지하면서 방향만 변경
 *
 * 사용:
 * ```tsx
 * const cameraTargetRef = useRef<THREE.Vector3 | null>(null);
 * const handleCameraTarget = (pos: THREE.Vector3) => { cameraTargetRef.current = pos; };
 *
 * <CameraAutoFocus targetRef={cameraTargetRef} />
 * <GlobeWarEffects onCameraTarget={handleCameraTarget} ... />
 * ```
 */

import { useRef } from 'react';
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

// ─── Component ───

export function CameraAutoFocus({
  targetRef,
  duration = DEFAULT_DURATION,
  globeRadius = DEFAULT_GLOBE_RADIUS,
}: CameraAutoFocusProps) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  // 애니메이션 상태
  const animatingRef = useRef(false);
  const startTimeRef = useRef(0);
  const startPosRef = useRef(new THREE.Vector3());
  const targetPosRef = useRef(new THREE.Vector3());
  const clockRef = useRef(0);

  // OrbitControls 참조를 scene에서 직접 가져옴
  // useThree에는 controls가 없으므로 invalidate를 통해 접근

  useFrame((state, delta) => {
    clockRef.current += delta;

    // OrbitControls 찾기 (한 번만)
    if (!controlsRef.current) {
      // R3F에서 OrbitControls는 state.controls에 없지만,
      // scene traverse로 찾거나, 대안으로 camera position을 직접 lerp
      // → 가장 안정적 방법: camera.position을 직접 lerp + lookAt origin
      controlsRef.current = true; // mark as initialized
    }

    // 새로운 타겟이 설정되었는지 확인
    const newTarget = targetRef.current;
    if (newTarget && !animatingRef.current) {
      // 새 애니메이션 시작
      animatingRef.current = true;
      startTimeRef.current = clockRef.current;
      startPosRef.current.copy(camera.position);

      // 목표 카메라 위치 계산: target 방향으로 현재 distance 유지
      const currentDist = camera.position.length();
      const targetDir = newTarget.clone().normalize();
      targetPosRef.current.copy(targetDir.multiplyScalar(currentDist));

      // 타겟 소비 (1회성)
      (targetRef as React.MutableRefObject<THREE.Vector3 | null>).current = null;
    }

    // 애니메이션 진행
    if (animatingRef.current) {
      const elapsed = clockRef.current - startTimeRef.current;
      const t = Math.min(elapsed / duration, 1.0);

      // easeInOutCubic: 부드러운 시작/끝
      const eased = t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;

      // 구면 보간 (Slerp) — 직선 lerp는 구면에서 거리가 일정하지 않으므로
      // 대신 구면 위를 따라 이동하도록 방향을 slerp
      const startDir = startPosRef.current.clone().normalize();
      const endDir = targetPosRef.current.clone().normalize();
      const currentDist = camera.position.length();

      // Quaternion slerp를 사용한 구면 보간
      const qStart = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 0, 1), startDir,
      );
      const qEnd = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 0, 1), endDir,
      );
      const qCurrent = qStart.clone().slerp(qEnd, eased);

      // 보간된 방향 벡터 계산
      const currentDir = new THREE.Vector3(0, 0, 1).applyQuaternion(qCurrent);
      camera.position.copy(currentDir.multiplyScalar(currentDist));

      // 항상 원점(글로브 중심)을 바라봄
      camera.lookAt(0, 0, 0);

      if (t >= 1.0) {
        animatingRef.current = false;
      }
    }
  });

  return null;
}

export default CameraAutoFocus;
