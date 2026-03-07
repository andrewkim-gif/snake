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

import { useRef, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// 카메라 설정
const CAM_DISTANCE = 8;       // 캐릭터 뒤 거리 (m)
const CAM_HEIGHT = 5;          // 캐릭터 위 높이 (m)
const MIN_PITCH = -0.2;        // 위를 약간 볼 수 있음 (rad)
const MAX_PITCH = 1.2;         // 거의 탑다운 (rad)
const DEFAULT_PITCH = 0.4;     // 기본 각도
const TRACK_SMOOTH = 8;        // 추적 lerp 속도
const MOUSE_SENSITIVITY = 0.003;
const MIN_DISTANCE = 4;
const MAX_DISTANCE = 20;
const ZOOM_SPEED = 1.0;

interface ARCameraProps {
  /** 플레이어 월드 위치 ref */
  playerPosRef: React.MutableRefObject<{ x: number; y: number; z: number }>;
  /** 포인터 락 활성화 여부 */
  locked: boolean;
  /** 현재 yaw (라디안) — 외부에서 읽어 이동 방향 결정 */
  yawRef: React.MutableRefObject<number>;
}

export function ARCamera({ playerPosRef, locked, yawRef }: ARCameraProps) {
  const { camera, gl } = useThree();
  const yaw = useRef(0);
  const pitch = useRef(DEFAULT_PITCH);
  const distance = useRef(CAM_DISTANCE);
  const targetPos = useRef(new THREE.Vector3());

  // 마우스 이벤트
  useEffect(() => {
    const canvas = gl.domElement;

    const onMouseMove = (e: MouseEvent) => {
      if (!locked) return;
      yaw.current -= e.movementX * MOUSE_SENSITIVITY;
      pitch.current += e.movementY * MOUSE_SENSITIVITY;
      pitch.current = Math.max(MIN_PITCH, Math.min(MAX_PITCH, pitch.current));
      yawRef.current = yaw.current;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      distance.current += e.deltaY * 0.01 * ZOOM_SPEED;
      distance.current = Math.max(MIN_DISTANCE, Math.min(MAX_DISTANCE, distance.current));
    };

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [gl, locked, yawRef]);

  // Pointer lock
  useEffect(() => {
    const canvas = gl.domElement;
    const onClick = () => {
      if (!document.pointerLockElement) {
        canvas.requestPointerLock();
      }
    };
    canvas.addEventListener('click', onClick);
    return () => canvas.removeEventListener('click', onClick);
  }, [gl]);

  // 카메라 업데이트 (매 프레임)
  useFrame((_, delta) => {
    const pp = playerPosRef.current;

    // Lerp target position
    targetPos.current.lerp(
      new THREE.Vector3(pp.x, pp.y + 1, pp.z),
      Math.min(1, TRACK_SMOOTH * delta)
    );

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
