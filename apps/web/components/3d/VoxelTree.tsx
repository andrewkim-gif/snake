'use client';

/**
 * VoxelTree — MC 스타일 복셀 나무 (줄기 + 잎 블록)
 * InstancedMesh 2개 (줄기/잎) → 나무 1그루당 2 draw calls
 * 참나무 스타일: 줄기 3-5블록 + 구형 잎 크라운
 */

import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { getVoxelTextures } from '@/lib/3d/voxel-textures';

interface VoxelTreeProps {
  position: [number, number, number];
  trunkHeight?: number;
}

const BLOCK_SIZE = 1;
const _obj = new THREE.Object3D();

// 잎 블록 위치 생성 (참나무 크라운)
function generateCrown(trunkH: number): [number, number, number][] {
  const positions: [number, number, number][] = [];
  const baseY = trunkH - 1; // 줄기 상단 1블록 아래부터

  // 하단 2층: 5x5 - 모서리
  for (let dy = 0; dy <= 1; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue; // 모서리 제거
        if (dx === 0 && dz === 0 && dy === 0) continue; // 줄기 위치 제외
        positions.push([dx, baseY + dy, dz]);
      }
    }
  }

  // 상단 2층: 3x3 - 모서리
  for (let dy = 2; dy <= 3; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (dy === 3 && Math.abs(dx) === 1 && Math.abs(dz) === 1) continue;
        positions.push([dx, baseY + dy, dz]);
      }
    }
  }

  return positions;
}

export function VoxelTree({ position, trunkHeight = 4 }: VoxelTreeProps) {
  const groupRef = useRef<THREE.Group>(null!);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    const textures = getVoxelTextures();
    const geo = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);

    // 줄기 InstancedMesh
    const woodMat = new THREE.MeshLambertMaterial({ map: textures.wood });
    const trunkMesh = new THREE.InstancedMesh(geo, woodMat, trunkHeight);
    for (let y = 0; y < trunkHeight; y++) {
      _obj.position.set(0, y, 0);
      _obj.rotation.set(0, 0, 0);
      _obj.scale.setScalar(1);
      _obj.updateMatrix();
      trunkMesh.setMatrixAt(y, _obj.matrix);
    }
    trunkMesh.instanceMatrix.needsUpdate = true;
    group.add(trunkMesh);

    // 잎 InstancedMesh
    const crownPositions = generateCrown(trunkHeight);
    const leavesMat = new THREE.MeshLambertMaterial({ map: textures.leaves });
    const leavesMesh = new THREE.InstancedMesh(geo, leavesMat, crownPositions.length);
    crownPositions.forEach(([dx, dy, dz], i) => {
      _obj.position.set(dx, dy, dz);
      _obj.rotation.set(0, 0, 0);
      _obj.scale.setScalar(1);
      _obj.updateMatrix();
      leavesMesh.setMatrixAt(i, _obj.matrix);
    });
    leavesMesh.instanceMatrix.needsUpdate = true;
    group.add(leavesMesh);

    return () => {
      group.remove(trunkMesh, leavesMesh);
      geo.dispose();
      woodMat.dispose();
      leavesMat.dispose();
      trunkMesh.dispose();
      leavesMesh.dispose();
    };
  }, [trunkHeight]);

  return <group ref={groupRef} position={position} />;
}
