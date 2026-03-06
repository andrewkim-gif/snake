'use client';

/**
 * LobbyScene3D — R3F Canvas 래퍼
 * 지형 + 나무 + 캐릭터 6명 + Sky + 구름 + 안개 + 조명 + 공전 카메라
 * dpr 캡 [1, 1.5] (고DPI 성능 보호)
 * castShadow 비활성화 (성능 최적화)
 */

import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { useEffect } from 'react';
import * as THREE from 'three';
import { VoxelTerrain } from './VoxelTerrain';
import { VoxelTree } from './VoxelTree';
import { VoxelCharacter } from './VoxelCharacter';
import { SkyDome } from './SkyDome';

// 나무 배치 (지형 위)
const TREE_POSITIONS: { pos: [number, number, number]; height: number }[] = [
  { pos: [-3, 1, -3], height: 4 },
  { pos: [4, 1, 2], height: 5 },
  { pos: [-4, 0, 4], height: 4 },
  { pos: [3, 1, -4], height: 3 },
];

// 캐릭터 배치 (지형 위, 다양한 스킨/방향)
const CHARACTERS: { pos: [number, number, number]; skinId: number; rot: number; phase: number }[] = [
  { pos: [-1, 1, -1], skinId: 0, rot: 0.3, phase: 0 },
  { pos: [1.5, 1, 0], skinId: 3, rot: -0.5, phase: 1.2 },
  { pos: [0, 1, 2], skinId: 7, rot: 0.8, phase: 2.5 },
  { pos: [-2, 1, 1.5], skinId: 11, rot: -1.0, phase: 3.8 },
  { pos: [2.5, 1, -2], skinId: 5, rot: 1.5, phase: 5.0 },
  { pos: [-0.5, 1, -3], skinId: 9, rot: -0.2, phase: 6.3 },
];

/** 안개 + 배경색 설정 */
function SceneSetup() {
  const { scene } = useThree();

  useEffect(() => {
    scene.fog = new THREE.Fog('#87CEEB', 15, 40);
    scene.background = new THREE.Color('#87CEEB');
    return () => {
      scene.fog = null;
      scene.background = null;
    };
  }, [scene]);

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[8, 12, 6]} intensity={0.8} castShadow={false} />
    </>
  );
}

/** 공전 카메라 (자동 회전, 유저 인터랙션 없음) */
function OrbitCamera() {
  const { camera } = useThree();

  useFrame((state) => {
    const t = state.clock.elapsedTime * 0.08; // 느린 공전
    const radius = 14;
    const height = 7;

    camera.position.set(
      Math.cos(t) * radius,
      height,
      Math.sin(t) * radius,
    );
    camera.lookAt(0, 1.5, 0);
  });

  return null;
}

export function LobbyScene3D() {
  return (
    <Canvas
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: false }}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
      }}
    >
      <SceneSetup />
      <OrbitCamera />
      <SkyDome />
      <VoxelTerrain />

      {TREE_POSITIONS.map((tree, i) => (
        <VoxelTree key={i} position={tree.pos} trunkHeight={tree.height} />
      ))}

      {CHARACTERS.map((char, i) => (
        <VoxelCharacter
          key={i}
          skinId={char.skinId}
          position={char.pos}
          rotation={char.rot}
          phaseOffset={char.phase}
        />
      ))}
    </Canvas>
  );
}
