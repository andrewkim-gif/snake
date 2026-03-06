'use client';

/**
 * SkyDome — 하늘 돔(r=100) + 블록 구름 12개 + 태양 + 새 떼
 * useFrame priority=0 (auto-render 유지 필수)
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const CLOUD_COUNT = 12;
const CLOUD_RADIUS = 45;
const CLOUD_HEIGHT = 25;
const DRIFT_SPEED = 0.012;

interface CloudData {
  angle: number; radius: number; height: number;
  scaleX: number; scaleY: number; scaleZ: number;
}

function generateCloudData(): CloudData[] {
  const clouds: CloudData[] = [];
  for (let i = 0; i < CLOUD_COUNT; i++) {
    const s = i * 137.5;
    clouds.push({
      angle: (i / CLOUD_COUNT) * Math.PI * 2 + Math.sin(s) * 0.3,
      radius: CLOUD_RADIUS + Math.sin(s * 2.1) * 10,
      height: CLOUD_HEIGHT + Math.sin(s * 3.7) * 4,
      scaleX: 4 + Math.abs(Math.sin(s * 1.3)) * 6,
      scaleY: 1.0 + Math.abs(Math.sin(s * 2.7)) * 0.8,
      scaleZ: 3 + Math.abs(Math.sin(s * 4.1)) * 4,
    });
  }
  return clouds;
}

const BIRD_POS: [number, number, number][] = [
  [20, 22, 15], [23, 24, 11], [17, 23, 18], [25, 21, 9],
];

const _obj = new THREE.Object3D();

export function SkyDome() {
  const cloudRef = useRef<THREE.InstancedMesh>(null!);
  const birdRef = useRef<THREE.Group>(null!);
  const cloudData = useMemo(generateCloudData, []);
  const elapsedRef = useRef(0);

  useFrame((state, delta) => {
    // 구름 드리프트
    if (cloudRef.current) {
      elapsedRef.current += delta;
      const drift = elapsedRef.current * DRIFT_SPEED;
      for (let i = 0; i < CLOUD_COUNT; i++) {
        const c = cloudData[i];
        const a = c.angle + drift;
        _obj.position.set(Math.cos(a) * c.radius, c.height, Math.sin(a) * c.radius);
        _obj.scale.set(c.scaleX, c.scaleY, c.scaleZ);
        _obj.rotation.set(0, 0, 0);
        _obj.updateMatrix();
        cloudRef.current.setMatrixAt(i, _obj.matrix);
      }
      cloudRef.current.instanceMatrix.needsUpdate = true;
    }

    // 새 공전
    if (birdRef.current) {
      birdRef.current.rotation.y = state.clock.elapsedTime * 0.04;
    }
  });

  return (
    <>
      {/* 하늘 돔 */}
      <mesh>
        <sphereGeometry args={[100, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshBasicMaterial color="#87CEEB" side={THREE.BackSide} depthWrite={false} />
      </mesh>

      {/* 태양 */}
      <mesh position={[45, 35, -35]}>
        <boxGeometry args={[4, 4, 4]} />
        <meshBasicMaterial color="#FFEE88" />
      </mesh>

      {/* 구름 */}
      <instancedMesh ref={cloudRef} args={[undefined, undefined, CLOUD_COUNT]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#FFFFFF" transparent opacity={0.85} />
      </instancedMesh>

      {/* 새 떼 */}
      <group ref={birdRef}>
        {BIRD_POS.map((pos, i) => (
          <mesh key={i} position={pos}>
            <boxGeometry args={[0.3, 0.08, 0.5]} />
            <meshBasicMaterial color="#444444" />
          </mesh>
        ))}
      </group>
    </>
  );
}
