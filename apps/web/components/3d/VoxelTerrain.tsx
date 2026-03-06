'use client';

/**
 * VoxelTerrain — InstancedMesh 잔디+흙 블록 지형
 * 원형 섬 ~50개 블록, 완만한 높이 변화
 * useFrame 미사용 (정적 지형)
 */

import { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { getVoxelTextures } from '@/lib/3d/voxel-textures';

const BLOCK_SIZE = 1;
const GRID_RADIUS = 5; // 반경 5블록 → 원형 ~50블록

// 결정적 높이맵 (완만한 언덕)
function getHeight(x: number, z: number): number {
  const h = Math.cos(x * 0.5) * Math.cos(z * 0.5) * 1.5
    + Math.sin(x * 0.3 + z * 0.4) * 0.5;
  return Math.max(0, Math.floor(h));
}

interface BlockPos { x: number; y: number; z: number }

function generateTerrain(): { grass: BlockPos[]; dirt: BlockPos[] } {
  const grass: BlockPos[] = [];
  const dirt: BlockPos[] = [];
  const heightMap = new Map<string, number>();

  // 1차: 높이맵 생성 + 잔디 블록
  for (let gx = -GRID_RADIUS; gx <= GRID_RADIUS; gx++) {
    for (let gz = -GRID_RADIUS; gz <= GRID_RADIUS; gz++) {
      const dist = Math.sqrt(gx * gx + gz * gz);
      if (dist > GRID_RADIUS + 0.5) continue;

      const h = getHeight(gx, gz);
      heightMap.set(`${gx},${gz}`, h);
      grass.push({ x: gx, y: h, z: gz });
    }
  }

  // 2차: 절벽 면에 흙 블록 채우기
  for (const g of grass) {
    const neighbors = [
      [g.x - 1, g.z], [g.x + 1, g.z],
      [g.x, g.z - 1], [g.x, g.z + 1],
    ];
    for (const [nx, nz] of neighbors) {
      const nh = heightMap.get(`${nx},${nz}`);
      if (nh === undefined) {
        // 섬 가장자리 — 아래 1블록 흙
        dirt.push({ x: g.x, y: g.y - 1, z: g.z });
      } else if (nh < g.y) {
        // 높이 차이 — 중간 흙 채우기
        for (let dy = nh + 1; dy < g.y; dy++) {
          dirt.push({ x: g.x, y: dy, z: g.z });
        }
      }
    }
  }

  // 중복 제거
  const dirtSet = new Set(dirt.map(d => `${d.x},${d.y},${d.z}`));
  const uniqueDirt = [...dirtSet].map(k => {
    const [x, y, z] = k.split(',').map(Number);
    return { x, y, z };
  });

  return { grass, dirt: uniqueDirt };
}

const _obj = new THREE.Object3D();

export function VoxelTerrain() {
  const groupRef = useRef<THREE.Group>(null!);

  const terrain = useMemo(generateTerrain, []);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    const textures = getVoxelTextures();
    const geo = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);

    // 잔디 블록: face별 다른 재질 [+x, -x, +y, -y, +z, -z]
    const grassMats = [
      new THREE.MeshLambertMaterial({ map: textures.grassSide }),
      new THREE.MeshLambertMaterial({ map: textures.grassSide }),
      new THREE.MeshLambertMaterial({ map: textures.grassTop }),
      new THREE.MeshLambertMaterial({ map: textures.dirt }),
      new THREE.MeshLambertMaterial({ map: textures.grassSide }),
      new THREE.MeshLambertMaterial({ map: textures.grassSide }),
    ];
    const grassMesh = new THREE.InstancedMesh(geo, grassMats, terrain.grass.length);
    terrain.grass.forEach((block, i) => {
      _obj.position.set(block.x, block.y, block.z);
      _obj.rotation.set(0, 0, 0);
      _obj.scale.setScalar(1);
      _obj.updateMatrix();
      grassMesh.setMatrixAt(i, _obj.matrix);
    });
    grassMesh.instanceMatrix.needsUpdate = true;
    group.add(grassMesh);

    // 흙 블록
    let dirtMesh: THREE.InstancedMesh | null = null;
    if (terrain.dirt.length > 0) {
      const dirtMat = new THREE.MeshLambertMaterial({ map: textures.dirt });
      dirtMesh = new THREE.InstancedMesh(geo, dirtMat, terrain.dirt.length);
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
      group.remove(grassMesh);
      if (dirtMesh) group.remove(dirtMesh);
      geo.dispose();
      grassMats.forEach(m => m.dispose());
      grassMesh.dispose();
      if (dirtMesh) dirtMesh.dispose();
    };
  }, [terrain]);

  return <group ref={groupRef} />;
}
