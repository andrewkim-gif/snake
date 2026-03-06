'use client';

/**
 * TerrainDeco — 환경 데코레이션 (InstancedMesh)
 * Edge Zone: 참나무 (trunk+canopy) + 꽃/덤불
 * Mid Zone:  횃불 (emissive) + 석재벽
 * Core Zone: 용암 풀 (emissive, 반투명)
 *
 * 시드 기반 랜덤 배치, 총 ~8 InstancedMesh draw calls
 * useFrame priority 0 필수!
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface TerrainDecoProps {
  arenaRadius: number;
}

// ─── 시드 기반 의사 난수 ───

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** 존 범위 내 랜덤 위치 생성 (XZ 평면) */
function randomPositionInRing(
  innerR: number,
  outerR: number,
  seed: number,
): [number, number] {
  const angle = seededRandom(seed) * Math.PI * 2;
  const r = innerR + seededRandom(seed + 1000) * (outerR - innerR);
  return [Math.cos(angle) * r, Math.sin(angle) * r];
}

// ─── 단일 InstancedMesh 배치 헬퍼 ───

function setInstanceTransform(
  mesh: THREE.InstancedMesh,
  index: number,
  x: number,
  y: number,
  z: number,
  scaleX: number,
  scaleY: number,
  scaleZ: number,
  rotY = 0,
): void {
  const _m = new THREE.Matrix4();
  const _q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0));
  _m.compose(
    new THREE.Vector3(x, y, z),
    _q,
    new THREE.Vector3(scaleX, scaleY, scaleZ),
  );
  mesh.setMatrixAt(index, _m);
}

// ─── 상수 ───

const TREE_COUNT = 20;
const FLOWER_COUNT = 30;
const TORCH_COUNT = 16;
const WALL_COUNT = 8;
const LAVA_COUNT = 6;

const FLOWER_COLORS = [
  '#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF',
  '#FF6EB4', '#FF8C42', '#C084FC', '#F472B6',
];

export function TerrainDeco({ arenaRadius }: TerrainDecoProps) {
  const coreR = arenaRadius * 0.25;
  const midR = arenaRadius * 0.60;

  // ─── Refs ───
  const trunkRef = useRef<THREE.InstancedMesh>(null!);
  const canopyRef = useRef<THREE.InstancedMesh>(null!);
  const flowerRef = useRef<THREE.InstancedMesh>(null!);
  const torchRef = useRef<THREE.InstancedMesh>(null!);
  const wallRef = useRef<THREE.InstancedMesh>(null!);
  const lavaRef = useRef<THREE.InstancedMesh>(null!);

  // ─── Geometries (memo) ───
  const geos = useMemo(() => ({
    trunk: new THREE.BoxGeometry(4, 16, 4),
    canopy: new THREE.BoxGeometry(12, 12, 12),
    flower: new THREE.BoxGeometry(4, 6, 4),
    torch: new THREE.BoxGeometry(2, 8, 2),
    wall: new THREE.BoxGeometry(16, 12, 4),
    lava: new THREE.BoxGeometry(20, 1, 20),
  }), []);

  // ─── Materials (memo) ───
  const mats = useMemo(() => ({
    trunk: new THREE.MeshLambertMaterial({ color: '#6B4226' }),
    canopy: new THREE.MeshLambertMaterial({ color: '#3A7D2C' }),
    flower: new THREE.MeshLambertMaterial({ color: '#FF6B6B' }),
    torch: new THREE.MeshLambertMaterial({
      color: '#FF6600',
      emissive: new THREE.Color('#FF6600'),
      emissiveIntensity: 0.3,
    }),
    wall: new THREE.MeshLambertMaterial({ color: '#888888' }),
    lava: new THREE.MeshLambertMaterial({
      color: '#FF4400',
      emissive: new THREE.Color('#FF4400'),
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: 0.8,
    }),
  }), []);

  // ─── 인스턴스 배치 (마운트 시 1회) ───
  useEffect(() => {
    // Edge Zone: 참나무 trunk + canopy
    for (let i = 0; i < TREE_COUNT; i++) {
      const [x, z] = randomPositionInRing(midR + 100, arenaRadius - 100, i * 7 + 42);
      const rotY = seededRandom(i * 13 + 7) * Math.PI * 2;

      // trunk — 바닥에서 높이 8 (반높이)
      setInstanceTransform(trunkRef.current, i, x, 8, z, 1, 1, 1, rotY);

      // canopy — trunk 위 (y=16+6=22)
      setInstanceTransform(canopyRef.current, i, x, 22, z, 1, 1, 1, rotY);
    }
    trunkRef.current.instanceMatrix.needsUpdate = true;
    canopyRef.current.instanceMatrix.needsUpdate = true;

    // Edge Zone: 꽃/덤불
    for (let i = 0; i < FLOWER_COUNT; i++) {
      const [x, z] = randomPositionInRing(midR + 50, arenaRadius - 50, i * 11 + 137);

      setInstanceTransform(flowerRef.current, i, x, 3, z, 1, 1, 1);

      // 꽃마다 다른 색상
      const colorIdx = Math.floor(seededRandom(i * 5 + 23) * FLOWER_COLORS.length);
      const color = new THREE.Color(FLOWER_COLORS[colorIdx]);
      flowerRef.current.setColorAt(i, color);
    }
    flowerRef.current.instanceMatrix.needsUpdate = true;
    if (flowerRef.current.instanceColor) {
      flowerRef.current.instanceColor.needsUpdate = true;
    }

    // Mid Zone: 횃불
    for (let i = 0; i < TORCH_COUNT; i++) {
      const [x, z] = randomPositionInRing(coreR + 100, midR - 100, i * 17 + 251);
      setInstanceTransform(torchRef.current, i, x, 4, z, 1, 1, 1);
    }
    torchRef.current.instanceMatrix.needsUpdate = true;

    // Mid Zone: 석재벽
    for (let i = 0; i < WALL_COUNT; i++) {
      const [x, z] = randomPositionInRing(coreR + 200, midR - 200, i * 23 + 389);
      const rotY = seededRandom(i * 19 + 53) * Math.PI;
      setInstanceTransform(wallRef.current, i, x, 6, z, 1, 1, 1, rotY);
    }
    wallRef.current.instanceMatrix.needsUpdate = true;

    // Core Zone: 용암 풀
    for (let i = 0; i < LAVA_COUNT; i++) {
      const [x, z] = randomPositionInRing(0, coreR - 50, i * 29 + 503);
      setInstanceTransform(lavaRef.current, i, x, 0.5, z, 1, 1, 1);
    }
    lavaRef.current.instanceMatrix.needsUpdate = true;
  }, [arenaRadius, coreR, midR]);

  // ─── 횃불 불꽃 애니메이션 (0.5Hz sin, Y스케일 변동) ───
  useFrame((_, delta) => {
    if (!torchRef.current) return;
    const time = performance.now() * 0.001;

    const _m = new THREE.Matrix4();
    const _p = new THREE.Vector3();
    const _q = new THREE.Quaternion();
    const _s = new THREE.Vector3();

    for (let i = 0; i < TORCH_COUNT; i++) {
      torchRef.current.getMatrixAt(i, _m);
      _m.decompose(_p, _q, _s);

      // Y 스케일 0.9~1.1 (2fps 느낌으로 step 함수)
      const flickerPhase = Math.sin(time * Math.PI + i * 2.1);
      const stepFlicker = flickerPhase > 0 ? 1.1 : 0.9;
      _s.y = stepFlicker;

      _m.compose(_p, _q, _s);
      torchRef.current.setMatrixAt(i, _m);
    }
    torchRef.current.instanceMatrix.needsUpdate = true;
  });

  // ─── Cleanup ───
  useEffect(() => {
    return () => {
      Object.values(geos).forEach(g => g.dispose());
      Object.values(mats).forEach(m => m.dispose());
    };
  }, [geos, mats]);

  return (
    <group>
      {/* Edge Zone: 참나무 trunk */}
      <instancedMesh
        ref={trunkRef}
        args={[geos.trunk, mats.trunk, TREE_COUNT]}
        frustumCulled={false}
      />

      {/* Edge Zone: 참나무 canopy */}
      <instancedMesh
        ref={canopyRef}
        args={[geos.canopy, mats.canopy, TREE_COUNT]}
        frustumCulled={false}
      />

      {/* Edge Zone: 꽃/덤불 */}
      <instancedMesh
        ref={flowerRef}
        args={[geos.flower, mats.flower, FLOWER_COUNT]}
        frustumCulled={false}
      />

      {/* Mid Zone: 횃불 */}
      <instancedMesh
        ref={torchRef}
        args={[geos.torch, mats.torch, TORCH_COUNT]}
        frustumCulled={false}
      />

      {/* Mid Zone: 석재벽 */}
      <instancedMesh
        ref={wallRef}
        args={[geos.wall, mats.wall, WALL_COUNT]}
        frustumCulled={false}
      />

      {/* Core Zone: 용암 풀 */}
      <instancedMesh
        ref={lavaRef}
        args={[geos.lava, mats.lava, LAVA_COUNT]}
        frustumCulled={false}
      />
    </group>
  );
}
