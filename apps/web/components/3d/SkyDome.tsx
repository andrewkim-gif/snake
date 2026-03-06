'use client';

/**
 * SkyDome — 로비용 하늘 돔 + 블록 구름
 * 돔: SphereGeometry 반구, 하늘색 MeshBasicMaterial
 * 구름: 10개 BoxGeometry InstancedMesh, 느린 드리프트
 * useFrame priority=0 (auto-render 유지 필수)
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const CLOUD_COUNT = 10;
const CLOUD_RADIUS = 25;
const CLOUD_HEIGHT = 18;
const DRIFT_SPEED = 0.015;

interface CloudData {
  angle: number;
  radius: number;
  height: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
}

function generateCloudData(): CloudData[] {
  const clouds: CloudData[] = [];
  for (let i = 0; i < CLOUD_COUNT; i++) {
    const seed = i * 137.5;
    clouds.push({
      angle: (i / CLOUD_COUNT) * Math.PI * 2 + Math.sin(seed) * 0.3,
      radius: CLOUD_RADIUS + Math.sin(seed * 2.1) * 8,
      height: CLOUD_HEIGHT + Math.sin(seed * 3.7) * 3,
      scaleX: 3 + Math.abs(Math.sin(seed * 1.3)) * 5,
      scaleY: 0.8 + Math.abs(Math.sin(seed * 2.7)) * 0.6,
      scaleZ: 2 + Math.abs(Math.sin(seed * 4.1)) * 3,
    });
  }
  return clouds;
}

const _obj = new THREE.Object3D();

export function SkyDome() {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const cloudData = useMemo(generateCloudData, []);
  const elapsedRef = useRef(0);

  useFrame((_, delta) => {
    if (!meshRef.current) return;

    elapsedRef.current += delta;
    const drift = elapsedRef.current * DRIFT_SPEED;

    for (let i = 0; i < CLOUD_COUNT; i++) {
      const cloud = cloudData[i];
      const angle = cloud.angle + drift;

      _obj.position.set(
        Math.cos(angle) * cloud.radius,
        cloud.height,
        Math.sin(angle) * cloud.radius,
      );
      _obj.scale.set(cloud.scaleX, cloud.scaleY, cloud.scaleZ);
      _obj.rotation.set(0, 0, 0);
      _obj.updateMatrix();
      meshRef.current.setMatrixAt(i, _obj.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      {/* 하늘 돔 — 반구 */}
      <mesh>
        <sphereGeometry args={[60, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshBasicMaterial color="#87CEEB" side={THREE.BackSide} depthWrite={false} />
      </mesh>

      {/* 구름 InstancedMesh */}
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, CLOUD_COUNT]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#FFFFFF" transparent opacity={0.85} />
      </instancedMesh>
    </>
  );
}
