'use client';

/**
 * MatrixScene.tsx — R3F 기반 3D 렌더링 엔진 (Phase 0 Foundation)
 *
 * Canvas 2D MatrixCanvas.tsx의 3D 대체 컴포넌트.
 * 게임 로직(useGameLoop)은 동일하게 재사용하고,
 * 렌더링만 Three.js Scene Graph로 교체한다.
 *
 * 좌표 매핑: 2D(x,y) → 3D(x, 0, -y)
 *
 * Phase 0 통합 항목:
 * - useGameLoop (Worker 기반 게임 로직)
 * - GameCamera (Isometric OrthographicCamera + LERP + Zoom + Shake)
 * - GameLighting (Ambient + Directional x2 + Shadows)
 * - 테스트 큐브 (플레이어 위치 표시)
 * - Ground plane (기본 지면)
 */

import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameRefs, type GameRefs } from '@/lib/matrix/hooks/useGameRefs';
import { useGameLoop } from '@/lib/matrix/hooks/useGameLoop';
import { GameCamera } from './3d/GameCamera';
import { GameLighting } from './3d/GameLighting';
import type { Player } from '@/lib/matrix/types';

/**
 * MatrixSceneProps — Phase 0 최소 props
 * Phase 1+에서 전체 MatrixCanvasProps로 확장 예정
 */
export interface MatrixSceneProps {
  /** 게임 활성 상태 */
  gameActive: boolean;
  /** 외부에서 주입하는 GameRefs (MatrixApp에서 공유 시) */
  gameRefs?: GameRefs;
}

/**
 * TestPlayerCube — 플레이어 위치에 따라 이동하는 테스트 큐브
 * Phase 1+에서 VoxelCharacter 컴포넌트로 교체 예정
 */
function TestPlayerCube({ playerRef }: { playerRef: React.MutableRefObject<Player> }) {
  const meshRef = useRef<THREE.Mesh>(null);

  // useFrame priority=0 (기본값) — R3F auto-render 유지
  useFrame(() => {
    if (!meshRef.current) return;
    const player = playerRef.current;

    // 2D → 3D 좌표 매핑: (x, y) → (x, 0.5, -y)
    meshRef.current.position.x = player.position.x;
    meshRef.current.position.y = 0.75; // 지면 위 (큐브 높이 절반)
    meshRef.current.position.z = -player.position.y;

    // 이동 방향으로 약간 회전 (시각적 피드백)
    if (Math.abs(player.velocity.x) > 0.01 || Math.abs(player.velocity.y) > 0.01) {
      const angle = Math.atan2(-player.velocity.y, player.velocity.x);
      meshRef.current.rotation.y = angle;
    }
  });

  return (
    <mesh ref={meshRef} castShadow position={[0, 0.75, 0]}>
      <boxGeometry args={[1.5, 1.5, 1.5]} />
      <meshStandardMaterial color="#CC9933" /> {/* 골드 색상 — 다크 전술 테마 */}
    </mesh>
  );
}

/**
 * GroundPlane — 기본 지면 (테스트용)
 * Phase 1에서 VoxelTerrain 컴포넌트로 교체 예정
 */
function GroundPlane() {
  return (
    <mesh
      receiveShadow
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
    >
      <planeGeometry args={[200, 200]} />
      <meshStandardMaterial
        color="#1a1a2e" // 다크 전술 테마 지면 색상
        roughness={0.9}
        metalness={0.1}
      />
    </mesh>
  );
}

/**
 * GridHelper — 디버그용 그리드 (좌표계 확인)
 */
function DebugGrid() {
  return (
    <gridHelper
      args={[200, 20, '#333333', '#222222']}
      position={[0, 0.01, 0]}
    />
  );
}

/**
 * SceneContent — R3F Canvas 내부 3D 씬 콘텐츠
 * useFrame 등 R3F 훅은 Canvas 내부에서만 사용 가능
 */
function SceneContent({ refs }: { refs: GameRefs }) {
  return (
    <>
      {/* 배경색 */}
      <color attach="background" args={['#111111']} />

      {/* 카메라 — Isometric OrthographicCamera + LERP Follow + Zoom + Shake */}
      <GameCamera
        playerRef={refs.player}
        currentZoomRef={refs.currentZoom}
        screenShakeTimerRef={refs.screenShakeTimer}
        screenShakeIntensityRef={refs.screenShakeIntensity}
      />

      {/* 조명 — Ambient + Directional x2 + Shadows */}
      <GameLighting />

      {/* 지면 */}
      <GroundPlane />

      {/* 디버그 그리드 */}
      <DebugGrid />

      {/* 테스트 큐브 — 플레이어 위치 표시 */}
      <TestPlayerCube playerRef={refs.player} />
    </>
  );
}

/**
 * MatrixScene — R3F Canvas 래퍼 + useGameLoop 통합
 *
 * 2D/3D 듀얼 모드 지원:
 * - MatrixApp에서 renderMode='3d' 시 MatrixScene 마운트
 * - renderMode='2d' 시 기존 MatrixCanvas 마운트
 *
 * useFrame priority=0 필수 — non-zero priority는 R3F auto-render 비활성화
 */
export function MatrixScene({ gameActive, gameRefs }: MatrixSceneProps) {
  // 내부 refs (외부에서 주입되지 않은 경우 자체 refs 생성)
  const internalRefs = useGameRefs();
  const refs = gameRefs ?? internalRefs;

  // useGameLoop — Worker 기반 게임 로직 실행
  // 3D 모드에서는 render=null (R3F useFrame이 렌더링 담당)
  // Phase 0: update는 플레이어 위치만 시뮬레이션 (테스트용)
  const updateRef = useRef((_dt: number) => {});
  useMemo(() => {
    // 테스트용: 원 운동으로 플레이어 위치 시뮬레이션
    let time = 0;
    updateRef.current = (dt: number) => {
      time += dt;
      const player = refs.player.current;
      // 반경 30의 원 운동 (게임 로직 동작 확인용)
      player.position.x = Math.cos(time * 0.5) * 30;
      player.position.y = Math.sin(time * 0.5) * 30;
      player.velocity.x = -Math.sin(time * 0.5) * 15;
      player.velocity.y = Math.cos(time * 0.5) * 15;
    };
  }, [refs.player]);

  useGameLoop({
    gameActive,
    update: (dt: number) => updateRef.current(dt),
    render: null, // 3D 모드: rAF 불필요 (R3F가 자체 렌더링)
  });

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
      <Canvas
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
        }}
        orthographic
        camera={{
          zoom: 50,
          position: [800, 800, 800],
          near: 0.1,
          far: 5000,
        }}
        dpr={[1, Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2)]}
        frameloop="always"
        shadows="soft"
        style={{ background: '#111111' }}
      >
        <SceneContent refs={refs} />
      </Canvas>
    </div>
  );
}

export default MatrixScene;
