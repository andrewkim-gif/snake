'use client';

/**
 * VoxelCharacter — MC 스타일 6파트 휴머노이드
 * Head(0.5) + Body(0.75) + Arms(0.75x2) + Legs(0.75x2)
 * idle 애니메이션: 팔/다리 pendulum + 머리 bob/look
 * useFrame priority=0 (auto-render 유지 필수)
 * arm/leg pivot: geometry.translate(0, -halfHeight, 0)
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getAgentTextures } from '@/lib/3d/agent-textures';

interface VoxelCharacterProps {
  skinId: number;
  position: [number, number, number];
  rotation?: number;
  phaseOffset?: number;
}

// 파트 치수
const HEAD = { w: 0.5, h: 0.5, d: 0.5 };
const BODY = { w: 0.5, h: 0.75, d: 0.25 };
const ARM = { w: 0.25, h: 0.75, d: 0.25 };
const LEG = { w: 0.25, h: 0.75, d: 0.25 };

// 발바닥 기준 Y 오프셋
const LEG_TOP = LEG.h;           // 0.75
const BODY_CENTER = LEG_TOP + BODY.h / 2; // 1.125
const SHOULDER_Y = LEG_TOP + BODY.h;      // 1.5
const HEAD_CENTER = SHOULDER_Y + HEAD.h / 2; // 1.75

export function VoxelCharacter({ skinId, position, rotation = 0, phaseOffset = 0 }: VoxelCharacterProps) {
  const leftArmRef = useRef<THREE.Mesh>(null!);
  const rightArmRef = useRef<THREE.Mesh>(null!);
  const leftLegRef = useRef<THREE.Mesh>(null!);
  const rightLegRef = useRef<THREE.Mesh>(null!);
  const headRef = useRef<THREE.Mesh>(null!);

  const textures = useMemo(() => getAgentTextures(skinId), [skinId]);

  // 피벗 조정된 지오메트리 (어깨/엉덩이 기준 회전)
  const armGeo = useMemo(() => {
    const geo = new THREE.BoxGeometry(ARM.w, ARM.h, ARM.d);
    geo.translate(0, -ARM.h / 2, 0);
    return geo;
  }, []);

  const legGeo = useMemo(() => {
    const geo = new THREE.BoxGeometry(LEG.w, LEG.h, LEG.d);
    geo.translate(0, -LEG.h / 2, 0);
    return geo;
  }, []);

  // 재질
  const headMat = useMemo(() => new THREE.MeshLambertMaterial({ map: textures.head }), [textures]);
  const bodyMat = useMemo(() => new THREE.MeshLambertMaterial({ map: textures.body }), [textures]);
  const armMat = useMemo(() => new THREE.MeshLambertMaterial({ map: textures.arm }), [textures]);
  const legMat = useMemo(() => new THREE.MeshLambertMaterial({ map: textures.leg }), [textures]);

  // idle 애니메이션 (priority=0)
  useFrame((state) => {
    const t = state.clock.elapsedTime + phaseOffset;

    // 팔 pendulum swing
    const armSwing = Math.sin(t * 1.5) * 0.25;
    if (leftArmRef.current) leftArmRef.current.rotation.x = armSwing;
    if (rightArmRef.current) rightArmRef.current.rotation.x = -armSwing;

    // 다리 pendulum swing (반대)
    const legSwing = Math.sin(t * 1.5) * 0.18;
    if (leftLegRef.current) leftLegRef.current.rotation.x = -legSwing;
    if (rightLegRef.current) rightLegRef.current.rotation.x = legSwing;

    // 머리 bob + 좌우 look
    if (headRef.current) {
      headRef.current.rotation.y = Math.sin(t * 0.5) * 0.2;
      headRef.current.position.y = HEAD_CENTER + Math.sin(t * 0.8) * 0.02;
    }
  });

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Body */}
      <mesh position={[0, BODY_CENTER, 0]} material={bodyMat}>
        <boxGeometry args={[BODY.w, BODY.h, BODY.d]} />
      </mesh>

      {/* Head */}
      <mesh ref={headRef} position={[0, HEAD_CENTER, 0]} material={headMat}>
        <boxGeometry args={[HEAD.w, HEAD.h, HEAD.d]} />
      </mesh>

      {/* Left Arm */}
      <mesh
        ref={leftArmRef}
        position={[-(BODY.w / 2 + ARM.w / 2), SHOULDER_Y, 0]}
        geometry={armGeo}
        material={armMat}
      />

      {/* Right Arm */}
      <mesh
        ref={rightArmRef}
        position={[BODY.w / 2 + ARM.w / 2, SHOULDER_Y, 0]}
        geometry={armGeo}
        material={armMat}
      />

      {/* Left Leg */}
      <mesh
        ref={leftLegRef}
        position={[-LEG.w / 2, LEG_TOP, 0]}
        geometry={legGeo}
        material={legMat}
      />

      {/* Right Leg */}
      <mesh
        ref={rightLegRef}
        position={[LEG.w / 2, LEG_TOP, 0]}
        geometry={legGeo}
        material={legMat}
      />
    </group>
  );
}
