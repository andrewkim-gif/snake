'use client';

/**
 * ARCamera — Arena 3인칭 팔로우 카메라
 *
 * 기존 TPSCamera 패턴 기반:
 *   - 캐릭터 후방 5m, 위 3m (기본 위치)
 *   - 마우스 드래그로 orbit (yaw/pitch)
 *   - 스크롤로 줌 인/아웃
 *   - 부드러운 lerp 추적
 *
 * useFrame priority=0 (auto-render 유지)
 */

import { useRef, memo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { InputManagerReturn } from '@/hooks/useInputManager';

// 카메라 설정
const CAM_DISTANCE = 8;       // 캐릭터 뒤 거리 (m)
const CAM_HEIGHT = 5;          // 캐릭터 위 높이 (m)
const MIN_PITCH = -0.2;        // 위를 약간 볼 수 있음 (rad)
const MAX_PITCH = 1.2;         // 거의 탑다운 (rad)
const DEFAULT_PITCH = 0.4;     // 기본 각도
const TRACK_SMOOTH = 8;        // 추적 lerp 속도
const MIN_DISTANCE = 4;
const MAX_DISTANCE = 20;
const ZOOM_SPEED = 1.0;

interface ARCameraProps {
  /** 플레이어 월드 위치 ref */
  playerPosRef: React.MutableRefObject<{ x: number; y: number; z: number }>;
  /** InputManager — cameraDeltaRef/scrollDeltaRef 소비, azimuthRef 동기화 */
  inputManager: InputManagerReturn;
}

function ARCameraInner({ playerPosRef, inputManager }: ARCameraProps) {
  const { camera } = useThree();
  const yaw = useRef(0);
  const pitch = useRef(DEFAULT_PITCH);
  const distance = useRef(CAM_DISTANCE);
  const targetPos = useRef(new THREE.Vector3());
  const _tmpVec3 = useRef(new THREE.Vector3()); // 재사용 temp vector (PERF-1 fix)

  // 카메라 업데이트 (매 프레임) — cameraDeltaRef/scrollDeltaRef 소비 (TPSCamera 패턴)
  useFrame((_, delta) => {
    // 마우스 delta 소비 → yaw/pitch (InputManager에서 포인터 락 처리)
    const md = inputManager.cameraDeltaRef.current;
    if (md.dx !== 0 || md.dy !== 0) {
      yaw.current -= md.dx;
      pitch.current = Math.max(MIN_PITCH, Math.min(MAX_PITCH, pitch.current + md.dy));
      md.dx = 0;
      md.dy = 0;
    }

    // 스크롤 → 줌
    const sd = inputManager.scrollDeltaRef.current;
    if (sd !== 0) {
      distance.current += sd * 0.01 * ZOOM_SPEED;
      distance.current = Math.max(MIN_DISTANCE, Math.min(MAX_DISTANCE, distance.current));
      inputManager.scrollDeltaRef.current = 0;
    }

    // InputManager에 카메라 상태 동기화
    inputManager.azimuthRef.current = yaw.current;

    const pp = playerPosRef.current;

    // Lerp target position (PERF-1: 재사용 temp vector — zero alloc)
    _tmpVec3.current.set(pp.x, pp.y + 1, pp.z);
    targetPos.current.lerp(_tmpVec3.current, Math.min(1, TRACK_SMOOTH * delta));

    // Spherical offset from target
    const d = distance.current;
    const p = pitch.current;
    const y = yaw.current;

    const offsetX = d * Math.sin(y) * Math.cos(p);
    const offsetY = d * Math.sin(p) + CAM_HEIGHT;
    const offsetZ = d * Math.cos(y) * Math.cos(p);

    camera.position.set(
      targetPos.current.x + offsetX,
      targetPos.current.y + offsetY,
      targetPos.current.z + offsetZ
    );

    camera.lookAt(targetPos.current);
  });

  return null;
}

export const ARCamera = memo(ARCameraInner);
