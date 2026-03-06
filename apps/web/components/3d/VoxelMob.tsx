'use client';

/**
 * VoxelMob — MC 스타일 복셀 동물 (돼지/양/닭)
 * 단순 박스 메시 그룹 + 머리 idle 애니메이션
 */

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

type V3 = [number, number, number];
interface MobPart { pos: V3; size: V3; color: string }
interface MobDef { body: MobPart; head: MobPart; extras: MobPart[]; legs: MobPart[] }

const MOBS: Record<string, MobDef> = {
  pig: {
    body: { pos: [0, 0.42, 0], size: [0.8, 0.4, 0.4], color: '#E8A0A0' },
    head: { pos: [0.5, 0.5, 0], size: [0.35, 0.35, 0.35], color: '#E8A0A0' },
    extras: [
      { pos: [0.7, 0.45, 0], size: [0.08, 0.08, 0.12], color: '#F0B8B8' }, // 코
    ],
    legs: [
      { pos: [-0.2, 0.12, 0.12], size: [0.12, 0.25, 0.12], color: '#E8A0A0' },
      { pos: [-0.2, 0.12, -0.12], size: [0.12, 0.25, 0.12], color: '#E8A0A0' },
      { pos: [0.2, 0.12, 0.12], size: [0.12, 0.25, 0.12], color: '#E8A0A0' },
      { pos: [0.2, 0.12, -0.12], size: [0.12, 0.25, 0.12], color: '#E8A0A0' },
    ],
  },
  sheep: {
    body: { pos: [0, 0.48, 0], size: [0.7, 0.5, 0.55], color: '#E8E8E8' },
    head: { pos: [0.45, 0.42, 0], size: [0.3, 0.3, 0.3], color: '#808080' },
    extras: [],
    legs: [
      { pos: [-0.18, 0.12, 0.16], size: [0.1, 0.25, 0.1], color: '#505050' },
      { pos: [-0.18, 0.12, -0.16], size: [0.1, 0.25, 0.1], color: '#505050' },
      { pos: [0.18, 0.12, 0.16], size: [0.1, 0.25, 0.1], color: '#505050' },
      { pos: [0.18, 0.12, -0.16], size: [0.1, 0.25, 0.1], color: '#505050' },
    ],
  },
  chicken: {
    body: { pos: [0, 0.22, 0], size: [0.25, 0.25, 0.2], color: '#F0F0F0' },
    head: { pos: [0.18, 0.38, 0], size: [0.18, 0.18, 0.18], color: '#F0F0F0' },
    extras: [
      { pos: [0.3, 0.35, 0], size: [0.06, 0.04, 0.06], color: '#FFD700' }, // 부리
      { pos: [0.18, 0.48, 0], size: [0.03, 0.06, 0.08], color: '#CC3333' }, // 볏
    ],
    legs: [
      { pos: [-0.04, 0.05, 0.05], size: [0.03, 0.12, 0.03], color: '#FFD700' },
      { pos: [-0.04, 0.05, -0.05], size: [0.03, 0.12, 0.03], color: '#FFD700' },
    ],
  },
};

interface VoxelMobProps {
  type: 'pig' | 'sheep' | 'chicken';
  position: V3;
  rotation?: number;
  phaseOffset?: number;
}

export function VoxelMob({ type, position, rotation = 0, phaseOffset = 0 }: VoxelMobProps) {
  const headRef = useRef<THREE.Mesh>(null!);
  const config = MOBS[type];

  useFrame((state) => {
    if (!headRef.current) return;
    const t = state.clock.elapsedTime + phaseOffset;
    headRef.current.rotation.x = Math.sin(t * 1.5) * 0.06;
    headRef.current.rotation.y = Math.sin(t * 0.7) * 0.25;
  });

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <Box {...config.body} />
      <mesh ref={headRef} position={config.head.pos}>
        <boxGeometry args={config.head.size} />
        <meshLambertMaterial color={config.head.color} />
      </mesh>
      {config.extras.map((e, i) => <Box key={`e${i}`} {...e} />)}
      {config.legs.map((l, i) => <Box key={`l${i}`} {...l} />)}
    </group>
  );
}

function Box({ pos, size, color }: MobPart) {
  return (
    <mesh position={pos}>
      <boxGeometry args={size} />
      <meshLambertMaterial color={color} />
    </mesh>
  );
}
