'use client';

/**
 * SkyBox — 하늘 돔 + 구름 (InstancedMesh)
 * 돔: SphereGeometry, 하늘색 gradient (MeshBasicMaterial)
 * 구름: 15개 BoxGeometry InstancedMesh, 흰색, 다양한 크기, 느린 드리프트
 * useFrame priority 0 (CRITICAL: auto-render 유지)
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const CLOUD_COUNT = 15;
const CLOUD_RADIUS = 600; // 구름 배치 반경
const CLOUD_HEIGHT = 250; // 구름 높이
const DRIFT_SPEED = 0.003; // 초당 라디안 (느린 회전)

// 구름 초기 배치 데이터 (결정적)
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
    const seed = i * 137.5; // 황금각 분포
    const angle = (i / CLOUD_COUNT) * Math.PI * 2 + (Math.sin(seed) * 0.3);
    const radius = CLOUD_RADIUS + Math.sin(seed * 2.1) * 200;
    const height = CLOUD_HEIGHT + Math.sin(seed * 3.7) * 40;
    // 다양한 크기: 가로 넓고 세로 납작한 MC 구름
    const scaleX = 30 + Math.abs(Math.sin(seed * 1.3)) * 50;
    const scaleY = 8 + Math.abs(Math.sin(seed * 2.7)) * 8;
    const scaleZ = 20 + Math.abs(Math.sin(seed * 4.1)) * 30;
    clouds.push({ angle, radius, height, scaleX, scaleY, scaleZ });
  }
  return clouds;
}

const _obj = new THREE.Object3D();

export function SkyBox() {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const cloudData = useMemo(generateCloudData, []);
  const elapsedRef = useRef(0);

  // 초기 배치 + 매 프레임 드리프트 업데이트
  // priority 0 (기본값) — auto-render 유지!
  useFrame((_, delta) => {
    if (!meshRef.current) return;

    elapsedRef.current += delta;
    const drift = elapsedRef.current * DRIFT_SPEED;

    for (let i = 0; i < CLOUD_COUNT; i++) {
      const cloud = cloudData[i];
      const angle = cloud.angle + drift;
      const x = Math.cos(angle) * cloud.radius;
      const z = Math.sin(angle) * cloud.radius;

      _obj.position.set(x, cloud.height, z);
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
        <sphereGeometry args={[1400, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshBasicMaterial
          color="#87CEEB"
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      {/* 구름 InstancedMesh */}
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, CLOUD_COUNT]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshLambertMaterial
          color="#FFFFFF"
          transparent
          opacity={0.85}
        />
      </instancedMesh>
    </>
  );
}
