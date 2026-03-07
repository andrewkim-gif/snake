'use client';

/**
 * ARPlayer — 로컬 플레이어 캐릭터 렌더링
 *
 * 복셀 스타일 캐릭터 (큐블링 프로포션)
 * - 6파트 구조: head, body, left/right arm, left/right leg
 * - 자동 공격 오라 시각화 (범위 링)
 * - 이동 시 팔/다리 스윙 애니메이션
 *
 * useFrame priority=0 (auto-render 유지)
 */

import { useRef, useMemo, memo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// 큐블링 프로포션 (24u -> 1.5 world units)
const HEAD_SIZE = 0.625;
const BODY_W = 0.5;
const BODY_H = 0.4375;
const ARM_W = 0.25;
const ARM_H = 0.4375;
const LEG_W = 0.25;
const LEG_H = 0.4375;

const LEG_TOP_Y = LEG_H;
const BODY_CENTER_Y = LEG_TOP_Y + BODY_H / 2;
const SHOULDER_Y = LEG_TOP_Y + BODY_H;
const HEAD_CENTER_Y = SHOULDER_Y + HEAD_SIZE / 2;

// 자동 공격 오라 색상
const AURA_COLOR = new THREE.Color(0.2, 0.8, 1.0);

interface ARPlayerProps {
  /** 월드 위치 */
  position: [number, number, number];
  /** Y축 회전 (라디안) */
  rotation: number;
  /** 이동 중 여부 */
  moving: boolean;
  /** 공격 범위 (m) */
  attackRange: number;
  /** HP 비율 (0~1) */
  hpRatio: number;
  /** 플레이어 위치 ref (카메라용) */
  posRef: React.MutableRefObject<{ x: number; y: number; z: number }>;
}

function ARPlayerInner({
  position,
  rotation,
  moving,
  attackRange,
  hpRatio,
  posRef,
}: ARPlayerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Mesh>(null);
  const leftLegRef = useRef<THREE.Mesh>(null);
  const rightLegRef = useRef<THREE.Mesh>(null);
  const auraRef = useRef<THREE.Mesh>(null);

  // 머티리얼
  const headMat = useMemo(() => new THREE.MeshLambertMaterial({ color: 0xffe0bd }), []);
  const bodyMat = useMemo(() => new THREE.MeshLambertMaterial({ color: 0x3366cc }), []);
  const limbMat = useMemo(() => new THREE.MeshLambertMaterial({ color: 0x2244aa }), []);
  const legMat = useMemo(() => new THREE.MeshLambertMaterial({ color: 0x444444 }), []);
  const auraMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: AURA_COLOR,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    []
  );

  // 오라 지오메트리
  const auraGeo = useMemo(() => new THREE.RingGeometry(0, attackRange, 64), [attackRange]);

  // 애니메이션
  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // 위치 업데이트
    groupRef.current.position.set(position[0], position[1], position[2]);
    groupRef.current.rotation.y = rotation;

    // posRef 업데이트 (카메라 추적용)
    posRef.current = { x: position[0], y: position[1], z: position[2] };

    // 걷기 애니메이션
    const t = performance.now() * 0.006;
    const swingAmp = moving ? 0.6 : 0.1; // idle vs walking
    const swingSpeed = moving ? 1.0 : 0.3;

    if (leftArmRef.current && rightArmRef.current) {
      leftArmRef.current.rotation.x = Math.sin(t * swingSpeed) * swingAmp;
      rightArmRef.current.rotation.x = -Math.sin(t * swingSpeed) * swingAmp;
    }
    if (leftLegRef.current && rightLegRef.current) {
      leftLegRef.current.rotation.x = -Math.sin(t * swingSpeed) * swingAmp * 0.8;
      rightLegRef.current.rotation.x = Math.sin(t * swingSpeed) * swingAmp * 0.8;
    }

    // 오라 펄스
    if (auraRef.current) {
      const pulse = 0.1 + Math.sin(t * 0.5) * 0.05;
      (auraRef.current.material as THREE.MeshBasicMaterial).opacity = pulse;
    }
  });

  return (
    <group ref={groupRef}>
      {/* 머리 */}
      <mesh position={[0, HEAD_CENTER_Y, 0]} material={headMat}>
        <boxGeometry args={[HEAD_SIZE, HEAD_SIZE, HEAD_SIZE]} />
      </mesh>

      {/* 몸통 */}
      <mesh position={[0, BODY_CENTER_Y, 0]} material={bodyMat}>
        <boxGeometry args={[BODY_W, BODY_H, BODY_W * 0.6]} />
      </mesh>

      {/* 왼팔 (pivot at shoulder) */}
      <mesh
        ref={leftArmRef}
        position={[-(BODY_W / 2 + ARM_W / 2), SHOULDER_Y, 0]}
        material={limbMat}
      >
        <boxGeometry args={[ARM_W, ARM_H, ARM_W]} />
      </mesh>

      {/* 오른팔 */}
      <mesh
        ref={rightArmRef}
        position={[BODY_W / 2 + ARM_W / 2, SHOULDER_Y, 0]}
        material={limbMat}
      >
        <boxGeometry args={[ARM_W, ARM_H, ARM_W]} />
      </mesh>

      {/* 왼다리 */}
      <mesh
        ref={leftLegRef}
        position={[-LEG_W / 2 - 0.02, LEG_H / 2, 0]}
        material={legMat}
      >
        <boxGeometry args={[LEG_W, LEG_H, LEG_W]} />
      </mesh>

      {/* 오른다리 */}
      <mesh
        ref={rightLegRef}
        position={[LEG_W / 2 + 0.02, LEG_H / 2, 0]}
        material={legMat}
      >
        <boxGeometry args={[LEG_W, LEG_H, LEG_W]} />
      </mesh>

      {/* 공격 오라 링 (지면) */}
      <mesh
        ref={auraRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.05, 0]}
        geometry={auraGeo}
        material={auraMat}
      />

      {/* HP 바 (머리 위) */}
      <group position={[0, HEAD_CENTER_Y + HEAD_SIZE / 2 + 0.3, 0]}>
        {/* 배경 */}
        <mesh>
          <planeGeometry args={[0.8, 0.08]} />
          <meshBasicMaterial color={0x333333} transparent opacity={0.7} />
        </mesh>
        {/* HP 바 */}
        <mesh position={[(hpRatio - 1) * 0.4, 0, 0.001]}>
          <planeGeometry args={[0.8 * hpRatio, 0.06]} />
          <meshBasicMaterial
            color={hpRatio > 0.5 ? 0x4caf50 : hpRatio > 0.25 ? 0xff9800 : 0xf44336}
          />
        </mesh>
      </group>
    </group>
  );
}

export const ARPlayer = memo(ARPlayerInner);
