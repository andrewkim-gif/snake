'use client';

/**
 * VoxelTerrain — 넓은 바닥 + 언덕 블록 지형
 * 1) 60×60 잔디 바닥 평면 (y=0)
 * 2) 언덕 9개: InstancedMesh 잔디+흙 블록 (y≥0.5)
 * useFrame 미사용 (정적 지형)
 */

import { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { getVoxelTextures } from '@/lib/3d/voxel-textures';

const GROUND_SIZE = 60;
const BLOCK_SIZE = 1;

// 미리 정의된 언덕 (중심x, 중심z, 반경, 최대높이)
const HILLS: { cx: number; cz: number; r: number; maxH: number }[] = [
  { cx: 0, cz: 0, r: 3, maxH: 2 },
  { cx: -8, cz: -6, r: 2.5, maxH: 1 },
  { cx: 7, cz: -8, r: 3, maxH: 2 },
  { cx: -10, cz: 5, r: 2, maxH: 1 },
  { cx: 9, cz: 6, r: 2.5, maxH: 2 },
  { cx: -4, cz: 10, r: 2, maxH: 1 },
  { cx: 5, cz: -3, r: 2, maxH: 1 },
  { cx: -6, cz: -10, r: 2.5, maxH: 1 },
  { cx: 12, cz: -2, r: 2, maxH: 1 },
];

interface BlockPos { x: number; y: number; z: number }

function generateHillBlocks(): { grass: BlockPos[]; dirt: BlockPos[] } {
  const grass: BlockPos[] = [];
  const dirt: BlockPos[] = [];
  // 높이맵: 각 (gx,gz)에서 최대 블록 높이
  const heightMap = new Map<string, number>();

  for (const hill of HILLS) {
    const ir = Math.ceil(hill.r);
    for (let dx = -ir; dx <= ir; dx++) {
      for (let dz = -ir; dz <= ir; dz++) {
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > hill.r) continue;

        // 높이: 중심에서 가까울수록 높음 (코사인 프로필)
        const t = dist / hill.r;
        const h = Math.max(1, Math.round(hill.maxH * Math.cos(t * Math.PI * 0.5)));

        const gx = hill.cx + dx;
        const gz = hill.cz + dz;
        const key = `${gx},${gz}`;
        const existing = heightMap.get(key) || 0;
        if (h > existing) {
          heightMap.set(key, h);
        }
      }
    }
  }

  // 높이맵에서 블록 생성
  for (const [key, h] of heightMap) {
    const [gx, gz] = key.split(',').map(Number);
    // 맨 위 = 잔디, 아래 = 흙
    // y=0.5는 바닥면 위 첫 번째 블록 중심
    for (let layer = 0; layer < h; layer++) {
      const y = layer + 0.5;
      if (layer === h - 1) {
        grass.push({ x: gx, y, z: gz });
      } else {
        dirt.push({ x: gx, y, z: gz });
      }
    }
  }

  return { grass, dirt };
}

const _obj = new THREE.Object3D();

export function VoxelTerrain() {
  const groupRef = useRef<THREE.Group>(null!);
  const terrain = useMemo(generateHillBlocks, []);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    const textures = getVoxelTextures();

    // ─── 1) 바닥 평면 (60×60, y=0) ───
    const groundGeo = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE);
    groundGeo.rotateX(-Math.PI / 2); // XZ 평면으로 회전

    const groundTex = textures.grassTop.clone();
    groundTex.wrapS = THREE.RepeatWrapping;
    groundTex.wrapT = THREE.RepeatWrapping;
    groundTex.repeat.set(GROUND_SIZE, GROUND_SIZE); // 1블록당 1타일
    groundTex.needsUpdate = true;

    const groundMat = new THREE.MeshLambertMaterial({ map: groundTex });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.position.y = 0;
    group.add(groundMesh);

    // ─── 2) 언덕 잔디 블록 ───
    const blockGeo = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);

    let grassMesh: THREE.InstancedMesh | null = null;
    const grassMats = [
      new THREE.MeshLambertMaterial({ map: textures.grassSide }),
      new THREE.MeshLambertMaterial({ map: textures.grassSide }),
      new THREE.MeshLambertMaterial({ map: textures.grassTop }),
      new THREE.MeshLambertMaterial({ map: textures.dirt }),
      new THREE.MeshLambertMaterial({ map: textures.grassSide }),
      new THREE.MeshLambertMaterial({ map: textures.grassSide }),
    ];

    if (terrain.grass.length > 0) {
      grassMesh = new THREE.InstancedMesh(blockGeo, grassMats, terrain.grass.length);
      terrain.grass.forEach((block, i) => {
        _obj.position.set(block.x, block.y, block.z);
        _obj.rotation.set(0, 0, 0);
        _obj.scale.setScalar(1);
        _obj.updateMatrix();
        grassMesh!.setMatrixAt(i, _obj.matrix);
      });
      grassMesh.instanceMatrix.needsUpdate = true;
      group.add(grassMesh);
    }

    // ─── 3) 언덕 흙 블록 ───
    let dirtMesh: THREE.InstancedMesh | null = null;
    if (terrain.dirt.length > 0) {
      const dirtMat = new THREE.MeshLambertMaterial({ map: textures.dirt });
      dirtMesh = new THREE.InstancedMesh(blockGeo, dirtMat, terrain.dirt.length);
      terrain.dirt.forEach((block, i) => {
        _obj.position.set(block.x, block.y, block.z);
        _obj.rotation.set(0, 0, 0);
        _obj.scale.setScalar(1);
        _obj.updateMatrix();
        dirtMesh!.setMatrixAt(i, _obj.matrix);
      });
      dirtMesh.instanceMatrix.needsUpdate = true;
      group.add(dirtMesh);
    }

    return () => {
      group.remove(groundMesh);
      if (grassMesh) group.remove(grassMesh);
      if (dirtMesh) group.remove(dirtMesh);
      groundGeo.dispose();
      groundMat.dispose();
      groundTex.dispose();
      blockGeo.dispose();
      grassMats.forEach(m => m.dispose());
      if (grassMesh) grassMesh.dispose();
      if (dirtMesh) dirtMesh.dispose();
    };
  }, [terrain]);

  return <group ref={groupRef} />;
}
