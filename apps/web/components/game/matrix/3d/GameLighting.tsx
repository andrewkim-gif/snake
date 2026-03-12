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

// MC 스타일 조명: AmbientLight + PointLight x2 (그림자 없음, 경량)

export function GameLighting() {
  return (
    <>
      {/* 앰비언트 라이트 — MC 스타일 (약간 어두운 환경광) */}
      <ambientLight
        intensity={0.6}
        color="#404040"
      />

      {/* 메인 포인트 라이트 — MC 원본 스타일 (그림자 없음, 경량) */}
      <pointLight
        intensity={0.5}
        color="#ffffff"
        position={[500, 500, 500]}
        distance={0}
        decay={0}
      />

      {/* 보조 포인트 라이트 — 반대 방향 fill */}
      <pointLight
        intensity={0.2}
        color="#ffffff"
        position={[-500, 500, -500]}
        distance={0}
        decay={0}
      />
    </>
  );
}

export default GameLighting;
