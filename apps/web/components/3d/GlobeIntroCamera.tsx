'use client';

/**
 * GlobeIntroCamera — 3D 카메라 시네마틱 진입 연출
 *
 * 연출 시나리오:
 *  시작: 카메라가 멀리서 (z=500) 지구본+로고 정면을 바라봄
 *        → 로고(y=138)가 화면 정중앙에 보임
 *  1단계: 카메라가 지구본에 가까워짐 (z=500 → z=300)
 *        + 카메라가 약간 아래로 내려옴 (y=100 → y=0)
 *        → 로고가 자연스럽게 화면 상단으로 밀려남
 *  2단계: 지구본도 서서히 Y축 자전 (약 30° 회전)
 *        → 세련된 등장감
 *
 *  카메라 시작 위치 계산:
 *  - 로고는 y=138에 있고, 화면 중앙에 보이려면 카메라 y도 ~138 근처
 *  - 최종 위치는 기존 [0, 0, 300]
 */

import { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface GlobeIntroCameraProps {
  active: boolean;
  onComplete?: () => void;
  globeGroupRef?: React.RefObject<THREE.Group | null>;
}

// 시작: 로고 정면 → 멀리서 바라봄
const START_POS = new THREE.Vector3(0, 120, 480);
const START_LOOK = new THREE.Vector3(0, 130, 0);  // 로고(y=138) 근처를 바라봄

// 끝: 기존 로비 카메라 위치 (정면 수평)
const END_POS = new THREE.Vector3(0, 0, 300);
const END_LOOK = new THREE.Vector3(0, 0, 0);  // 지구본 중심

const DURATION = 2.8; // 초

function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

export function GlobeIntroCamera({ active, onComplete, globeGroupRef }: GlobeIntroCameraProps) {
  const { camera } = useThree();
  const startTime = useRef<number | null>(null);
  const completed = useRef(false);
  const lookAtTarget = useRef(new THREE.Vector3());
  const initialGlobeRotY = useRef(0);

  // 인트로 시작 시 카메라 즉시 배치
  useEffect(() => {
    if (active && !completed.current) {
      camera.position.copy(START_POS);
      lookAtTarget.current.copy(START_LOOK);
      camera.lookAt(lookAtTarget.current);
      startTime.current = null;

      // 지구본 초기 회전 (약간 돌려놓기 → 자전 연출)
      if (globeGroupRef?.current) {
        globeGroupRef.current.rotation.y = -0.5; // 약 -30° (자전 시작점)
        initialGlobeRotY.current = -0.5;
      }
    }
  }, [active, camera, globeGroupRef]);

  useFrame((state) => {
    if (!active || completed.current) return;

    if (startTime.current === null) {
      startTime.current = state.clock.elapsedTime;
    }

    const elapsed = state.clock.elapsedTime - startTime.current;
    const t = Math.min(elapsed / DURATION, 1);
    const ease = easeOutQuart(t);

    // 카메라 위치: 멀리 위 → 정면 가까이
    camera.position.lerpVectors(START_POS, END_POS, ease);

    // lookAt 타겟: 로고 → 지구본 중심
    lookAtTarget.current.lerpVectors(START_LOOK, END_LOOK, ease);
    camera.lookAt(lookAtTarget.current);

    // 지구본 자전: -30° → 0° (서서히 정면으로)
    if (globeGroupRef?.current) {
      globeGroupRef.current.rotation.y = THREE.MathUtils.lerp(
        initialGlobeRotY.current, 0, ease
      );
    }

    if (t >= 1 && !completed.current) {
      completed.current = true;
      camera.position.copy(END_POS);
      camera.lookAt(END_LOOK);
      if (globeGroupRef?.current) {
        globeGroupRef.current.rotation.y = 0;
      }
      onComplete?.();
    }
  });

  return null;
}
