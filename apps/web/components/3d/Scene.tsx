'use client';

/**
 * Scene — 라이팅 + 분위기 설정
 * MC 플랫 셰이딩: ambientLight 0.55 + directionalLight 0.85
 * castShadow=false (성능 + MC 미학)
 * Fog: '#87CEEB' near=400 far=1200 (분위기 + 원거리 페이드)
 */

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

export function Scene() {
  const { scene } = useThree();

  // Fog 설정 — scene.fog 직접 할당 (JSX로 불가)
  useEffect(() => {
    scene.fog = new THREE.Fog('#87CEEB', 400, 1200);
    scene.background = new THREE.Color('#87CEEB');

    return () => {
      scene.fog = null;
      scene.background = null;
    };
  }, [scene]);

  return (
    <>
      {/* 환경광 — 전체 균일 조명, MC 플랫 느낌 */}
      <ambientLight intensity={0.55} />

      {/* 방향광 — 태양 역할, 그림자 없음 (MC 미학 + 성능) */}
      <directionalLight
        position={[100, 150, 80]}
        intensity={0.85}
        castShadow={false}
      />
    </>
  );
}
