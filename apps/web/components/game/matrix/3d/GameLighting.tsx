'use client';

/**
 * GameLighting — 3D 씬 조명 시스템
 *
 * TicTac 프로젝트 패턴 참조 (v38-3d-conversion-research.md §3.2.A):
 * - AmbientLight intensity=0.4 (기본 가시성)
 * - DirectionalLight intensity=1.0 (메인 태양광, 45° 각도, shadow)
 * - DirectionalLight intensity=0.5 (필라이트, 반대 방향)
 * - Shadow map 2048x2048, PCFSoftShadowMap
 *
 * 다크 전술 테마에 맞는 따뜻한 톤의 조명 설정.
 */

import React, { useRef } from 'react';
import * as THREE from 'three';

// 그림자 커버 범위 (월드 단위)
const SHADOW_CAMERA_SIZE = 1500;

export function GameLighting() {
  const mainLightRef = useRef<THREE.DirectionalLight>(null);

  return (
    <>
      {/* 앰비언트 라이트 — MC 스타일 톤다운 (로비와 유사) */}
      <ambientLight
        intensity={0.5}
        color="#f0ece4" // 따뜻한 오프화이트
      />

      {/* 메인 디렉셔널 라이트 — 태양광 (톤다운, 그림자 캐스팅) */}
      <directionalLight
        ref={mainLightRef}
        intensity={0.8}
        color="#fff5e0" // 따뜻한 태양광 (톤다운)
        position={[500, 800, 500]} // 45° 각도 (isometric과 동일 방향)
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-SHADOW_CAMERA_SIZE}
        shadow-camera-right={SHADOW_CAMERA_SIZE}
        shadow-camera-top={SHADOW_CAMERA_SIZE}
        shadow-camera-bottom={-SHADOW_CAMERA_SIZE}
        shadow-camera-near={0.1}
        shadow-camera-far={3000}
        shadow-bias={-0.001} // 셀프 쉐도우 아티팩트 방지
        shadow-normalBias={0.02}
      />

      {/* 필 라이트 — 반대 방향에서 그림자 영역 밝히기 (톤다운) */}
      <directionalLight
        intensity={0.35}
        color="#c8d0e0" // 차가운 블루 틴트 (약하게)
        position={[-400, 600, -400]} // 메인 라이트 반대 방향
      />
    </>
  );
}

export default GameLighting;
