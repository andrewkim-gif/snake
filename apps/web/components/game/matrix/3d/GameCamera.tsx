'use client';

/**
 * GameCamera — OrthographicCamera + Isometric 45° Follow + Dynamic Zoom + Screen Shake
 *
 * 기존 Canvas 2D의 isometric 변환을 Three.js OrthographicCamera로 재현:
 * - ctx.transform(1, 0.5, -1, 0.5, 0, 0) → camera at isometric 45° angle
 * - 플레이어 LERP 추적 (position LERP factor 0.08)
 * - 동적 줌 (0.6-1.1, LERP factor 0.008)
 * - 화면 쉐이크 (random offset + intensity decay)
 *
 * 좌표 매핑: 2D(x, y) → 3D(x, 0, -y)
 *
 * CRITICAL: useFrame priority=0 (기본값) 사용 — non-zero priority는
 * R3F v9 auto-render를 비활성화하므로 절대 변경 금지
 */

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import * as THREE from 'three';
import type { Player } from '@/lib/matrix/types';
import { ZOOM_CONFIG } from '@/lib/matrix/constants';

// Isometric 카메라 오프셋 (45° 각도에서 Y 높이)
const ISO_DISTANCE = 800;
// 카메라 위치 LERP 계수 (0.08 = 부드러운 추적)
const POSITION_LERP = 0.08;

export interface GameCameraProps {
  /** 플레이어 상태 ref (position.x, position.y) */
  playerRef: React.MutableRefObject<Player>;
  /** 현재 줌 레벨 ref (0.6-1.1, useGameLoop에서 업데이트) */
  currentZoomRef: React.MutableRefObject<number>;
  /** 화면 쉐이크 타이머 ref (>0이면 쉐이크 활성) */
  screenShakeTimerRef: React.MutableRefObject<number>;
  /** 화면 쉐이크 강도 ref (0-1) */
  screenShakeIntensityRef: React.MutableRefObject<number>;
}

/**
 * GameCamera — Isometric OrthographicCamera
 *
 * 매 프레임 useFrame에서:
 * 1. 플레이어 월드 좌표 → 3D 카메라 타겟 계산
 * 2. LERP로 부드러운 카메라 추적
 * 3. Screen shake 적용 (intensity > 0일 때)
 * 4. Dynamic zoom LERP
 * 5. lookAt → updateProjectionMatrix
 */
export function GameCamera({
  playerRef,
  currentZoomRef,
  screenShakeTimerRef,
  screenShakeIntensityRef,
}: GameCameraProps) {
  const cameraRef = useRef<THREE.OrthographicCamera>(null);

  // 카메라가 바라보는 타겟 (LERP 보간용)
  const smoothTargetRef = useRef({ x: 0, z: 0 });

  // useFrame priority=0 (기본값) — R3F auto-render 유지 필수
  useFrame(() => {
    const camera = cameraRef.current;
    if (!camera) return;

    const player = playerRef.current;

    // 2D → 3D 좌표 매핑
    const targetX = player.position.x;
    const targetZ = -player.position.y; // y 부호 반전

    // LERP 카메라 타겟 위치 (부드러운 추적)
    smoothTargetRef.current.x += (targetX - smoothTargetRef.current.x) * POSITION_LERP;
    smoothTargetRef.current.z += (targetZ - smoothTargetRef.current.z) * POSITION_LERP;

    const smoothX = smoothTargetRef.current.x;
    const smoothZ = smoothTargetRef.current.z;

    // Isometric 45° 카메라 배치: (x + D, D, z + D)
    camera.position.x = smoothX + ISO_DISTANCE;
    camera.position.y = ISO_DISTANCE;
    camera.position.z = smoothZ + ISO_DISTANCE;

    // Screen Shake — intensity > 0이고 timer > 0일 때 랜덤 오프셋
    if (screenShakeTimerRef.current > 0 && screenShakeIntensityRef.current > 0.01) {
      const intensity = screenShakeIntensityRef.current;
      // 쉐이크 강도에 비례한 랜덤 오프셋 (2D 크기를 3D 스케일로 변환)
      const shakeScale = intensity * 10; // 적절한 3D 스케일
      camera.position.x += (Math.random() - 0.5) * shakeScale;
      camera.position.z += (Math.random() - 0.5) * shakeScale;
    }

    // Dynamic Zoom — currentZoomRef를 직접 사용 (update에서 이미 LERP 적용됨)
    // 3D 카메라의 zoom은 2D zoom과 스케일이 다르므로 변환 적용
    // 기존 2D zoom (0.6-1.1)을 3D orthographic zoom으로 매핑
    const zoom2D = currentZoomRef.current;
    // OrthographicCamera zoom: 50 기준, 2D zoom 0.85 = 3D zoom 50
    const baseZoom = 50;
    camera.zoom = baseZoom * (zoom2D / ZOOM_CONFIG.DEFAULT_ZOOM);

    // lookAt + projection 업데이트
    camera.lookAt(smoothX, 0, smoothZ);
    camera.updateProjectionMatrix();
  });

  return (
    <OrthographicCamera
      ref={cameraRef}
      makeDefault
      position={[ISO_DISTANCE, ISO_DISTANCE, ISO_DISTANCE]}
      zoom={50}
      near={0.1}
      far={5000}
    />
  );
}

export default GameCamera;
