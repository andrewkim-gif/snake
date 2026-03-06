'use client';

/**
 * LobbyScene3D — R3F Canvas 래퍼
 * 넓은 지형 + 나무 11그루 + 캐릭터 6명 + 몹 6마리
 * + Sky + 구름 + 태양 + 새 + 안개 + 조명 + 공전 카메라
 */

import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { useEffect } from 'react';
import * as THREE from 'three';
import { VoxelTerrain } from './VoxelTerrain';
import { VoxelTree } from './VoxelTree';
import { VoxelCharacter } from './VoxelCharacter';
import { VoxelMob } from './VoxelMob';
import { SkyDome } from './SkyDome';

// 나무 배치 (넓게 산개, y=0.5=바닥 위 줄기 시작)
const TREES: { pos: [number, number, number]; h: number }[] = [
  { pos: [-6, 0.5, 1], h: 4 }, { pos: [8, 0.5, -5], h: 5 },
  { pos: [-2, 0.5, -9], h: 4 }, { pos: [3, 0.5, 8], h: 3 },
  { pos: [-11, 0.5, -4], h: 5 }, { pos: [12, 0.5, 3], h: 4 },
  { pos: [-5, 0.5, 11], h: 3 }, { pos: [16, 0.5, -10], h: 5 },
  { pos: [-14, 0.5, 12], h: 4 }, { pos: [6, 0.5, -16], h: 3 },
  { pos: [-18, 0.5, -2], h: 4 },
];

// 캐릭터 배치 (y=0, 발이 바닥에 닿음)
const CHARS: { pos: [number, number, number]; skin: number; rot: number; ph: number }[] = [
  { pos: [-2, 0, 2], skin: 0, rot: 0.3, ph: 0 },
  { pos: [4, 0, -3], skin: 3, rot: -0.5, ph: 1.2 },
  { pos: [0, 0, 6], skin: 7, rot: 0.8, ph: 2.5 },
  { pos: [-6, 0, -2], skin: 11, rot: -1.0, ph: 3.8 },
  { pos: [7, 0, 5], skin: 5, rot: 1.5, ph: 5.0 },
  { pos: [-4, 0, -6], skin: 9, rot: -0.2, ph: 6.3 },
];

// 몹 배치
const MOBS_DATA: { type: 'pig' | 'sheep' | 'chicken'; pos: [number, number, number]; rot: number; ph: number }[] = [
  { type: 'pig', pos: [5, 0, 4], rot: 0.3, ph: 0 },
  { type: 'pig', pos: [-8, 0, 3], rot: -1.2, ph: 2.1 },
  { type: 'sheep', pos: [3, 0, -7], rot: 0.8, ph: 1.0 },
  { type: 'sheep', pos: [-3, 0, 9], rot: -0.5, ph: 3.5 },
  { type: 'chicken', pos: [9, 0, -2], rot: 1.5, ph: 4.2 },
  { type: 'chicken', pos: [-6, 0, -8], rot: -0.8, ph: 5.7 },
];

/** 안개 + 배경색 (어두운 야전 톤) */
function SceneSetup() {
  const { scene } = useThree();
  useEffect(() => {
    scene.fog = new THREE.Fog('#0A1520', 15, 45);
    scene.background = new THREE.Color('#0A1520');
    return () => { scene.fog = null; scene.background = null; };
  }, [scene]);

  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight position={[12, 18, 10]} intensity={0.5} color="#C0D0E0" castShadow={false} />
    </>
  );
}

/** 공전 카메라 */
function OrbitCamera() {
  const { camera } = useThree();
  useFrame((state) => {
    const t = state.clock.elapsedTime * 0.06;
    camera.position.set(Math.cos(t) * 28, 12, Math.sin(t) * 28);
    camera.lookAt(0, 1, 0);
  });
  return null;
}

export function LobbyScene3D() {
  return (
    <Canvas
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: false }}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
    >
      <SceneSetup />
      <OrbitCamera />
      <SkyDome />
      <VoxelTerrain />

      {TREES.map((t, i) => (
        <VoxelTree key={i} position={t.pos} trunkHeight={t.h} />
      ))}
      {CHARS.map((c, i) => (
        <VoxelCharacter key={i} skinId={c.skin} position={c.pos} rotation={c.rot} phaseOffset={c.ph} />
      ))}
      {MOBS_DATA.map((m, i) => (
        <VoxelMob key={i} type={m.type} position={m.pos} rotation={m.rot} phaseOffset={m.ph} />
      ))}
    </Canvas>
  );
}
