'use client';

/**
 * ObstacleInstances — v16 Phase 5 장애물 InstancedMesh 렌더링
 *
 * 서버에서 받은 obstacle grid 데이터를 기반으로 바위/나무/벽/물을 렌더링.
 * InstancedMesh로 대량의 장애물을 효율적으로 처리.
 *
 * 장애물 타입:
 * - 0: Empty (렌더링 안함)
 * - 1: Rock — 회색 박스 (impassable)
 * - 2: Tree — 녹색 원기둥 + 캐노피 (impassable, destructible)
 * - 3: Wall — 갈색 넓은 박스 (impassable)
 * - 4: Water — 투명 파란 평면 (passable, slow)
 * - 5-7: Shrine/Spring/Altar — 기존 MapStructures에서 렌더링
 */

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ObstacleGridData } from '@/lib/biome-decoder';
import type { HeightmapTerrainData } from '@/components/3d/HeightmapTerrain';

interface ObstacleInstancesProps {
  obstacleData: ObstacleGridData | null;
  heightmapData: HeightmapTerrainData | null;
  cellSize: number;
  arenaRadius: number;
}

// 장애물 타입별 인스턴스 데이터
interface ObstacleInstance {
  x: number;
  y: number; // world Y (= grid Y)
  z: number; // height from heightmap
  type: number;
}

// 색상 팔레트
const ROCK_COLOR = new THREE.Color(0x6a6a6a);
const TREE_TRUNK_COLOR = new THREE.Color(0x5a3a1a);
const TREE_CANOPY_COLOR = new THREE.Color(0x2a7a2a);
const WALL_COLOR = new THREE.Color(0x8a6a4a);
const WATER_COLOR = new THREE.Color(0x3a7aaa);

export function ObstacleInstances({
  obstacleData,
  heightmapData,
  cellSize,
  arenaRadius,
}: ObstacleInstancesProps) {
  const rockRef = useRef<THREE.InstancedMesh>(null);
  const treeTrunkRef = useRef<THREE.InstancedMesh>(null);
  const treeCanopyRef = useRef<THREE.InstancedMesh>(null);
  const wallRef = useRef<THREE.InstancedMesh>(null);
  const waterRef = useRef<THREE.InstancedMesh>(null);

  const waterMaterialRef = useRef<THREE.MeshStandardMaterial>(null);

  // Parse obstacle grid into typed instance lists
  const { rocks, treeTrunks, treeCanopies, walls, waters } = useMemo(() => {
    const rocks: ObstacleInstance[] = [];
    const treeTrunks: ObstacleInstance[] = [];
    const treeCanopies: ObstacleInstance[] = [];
    const walls: ObstacleInstance[] = [];
    const waters: ObstacleInstance[] = [];

    if (!obstacleData) return { rocks, treeTrunks, treeCanopies, walls, waters };

    const { grid, width, height } = obstacleData;
    const hmData = heightmapData?.heightData;

    for (let gy = 0; gy < height; gy++) {
      for (let gx = 0; gx < width; gx++) {
        const idx = gy * width + gx;
        const type = grid[idx];
        if (type === 0 || type >= 5) continue; // empty or map objects

        // World coordinates (centered on arena origin)
        const wx = -arenaRadius + (gx + 0.5) * cellSize;
        const wy = -arenaRadius + (gy + 0.5) * cellSize;
        const h = hmData ? hmData[idx] ?? 0 : 0;

        const inst: ObstacleInstance = { x: wx, y: wy, z: h, type };

        switch (type) {
          case 1: // Rock
            rocks.push(inst);
            break;
          case 2: // Tree
            treeTrunks.push(inst);
            treeCanopies.push(inst);
            break;
          case 3: // Wall
            walls.push(inst);
            break;
          case 4: // Water
            waters.push(inst);
            break;
        }
      }
    }

    return { rocks, treeTrunks, treeCanopies, walls, waters };
  }, [obstacleData, heightmapData, cellSize, arenaRadius]);

  // Set instance matrices
  useMemo(() => {
    const mat = new THREE.Matrix4();

    // Rocks: 8x8x6 boxes
    if (rockRef.current && rocks.length > 0) {
      for (let i = 0; i < rocks.length; i++) {
        const r = rocks[i];
        mat.makeTranslation(r.x, r.z + 3, r.y);
        rockRef.current.setMatrixAt(i, mat);
      }
      rockRef.current.instanceMatrix.needsUpdate = true;
      rockRef.current.count = rocks.length;
    }

    // Tree trunks: 3x10x3 cylinders (approximated as boxes)
    if (treeTrunkRef.current && treeTrunks.length > 0) {
      for (let i = 0; i < treeTrunks.length; i++) {
        const t = treeTrunks[i];
        mat.makeTranslation(t.x, t.z + 5, t.y);
        treeTrunkRef.current.setMatrixAt(i, mat);
      }
      treeTrunkRef.current.instanceMatrix.needsUpdate = true;
      treeTrunkRef.current.count = treeTrunks.length;
    }

    // Tree canopies: 10x8x10 spheres (approximated as boxes)
    if (treeCanopyRef.current && treeCanopies.length > 0) {
      for (let i = 0; i < treeCanopies.length; i++) {
        const t = treeCanopies[i];
        mat.makeTranslation(t.x, t.z + 12, t.y);
        treeCanopyRef.current.setMatrixAt(i, mat);
      }
      treeCanopyRef.current.instanceMatrix.needsUpdate = true;
      treeCanopyRef.current.count = treeCanopies.length;
    }

    // Walls: 15x8x4 boxes
    if (wallRef.current && walls.length > 0) {
      for (let i = 0; i < walls.length; i++) {
        const w = walls[i];
        mat.makeTranslation(w.x, w.z + 4, w.y);
        wallRef.current.setMatrixAt(i, mat);
      }
      wallRef.current.instanceMatrix.needsUpdate = true;
      wallRef.current.count = walls.length;
    }

    // Water: flat planes at water level
    if (waterRef.current && waters.length > 0) {
      for (let i = 0; i < waters.length; i++) {
        const w = waters[i];
        mat.makeTranslation(w.x, w.z + 0.5, w.y);
        waterRef.current.setMatrixAt(i, mat);
      }
      waterRef.current.instanceMatrix.needsUpdate = true;
      waterRef.current.count = waters.length;
    }
  }, [rocks, treeTrunks, treeCanopies, walls, waters]);

  // Animate water opacity
  useFrame(({ clock }) => {
    if (waterMaterialRef.current) {
      waterMaterialRef.current.opacity = 0.35 + Math.sin(clock.elapsedTime * 1.5) * 0.1;
    }
  });

  if (!obstacleData) return null;

  const maxCount = Math.max(rocks.length, treeTrunks.length, treeCanopies.length, walls.length, waters.length, 1);

  return (
    <group>
      {/* Rocks */}
      {rocks.length > 0 && (
        <instancedMesh ref={rockRef} args={[undefined, undefined, rocks.length]} castShadow receiveShadow>
          <boxGeometry args={[8, 6, 8]} />
          <meshStandardMaterial color={ROCK_COLOR} roughness={0.9} />
        </instancedMesh>
      )}

      {/* Tree Trunks */}
      {treeTrunks.length > 0 && (
        <instancedMesh ref={treeTrunkRef} args={[undefined, undefined, treeTrunks.length]} castShadow>
          <boxGeometry args={[3, 10, 3]} />
          <meshStandardMaterial color={TREE_TRUNK_COLOR} roughness={0.8} />
        </instancedMesh>
      )}

      {/* Tree Canopies */}
      {treeCanopies.length > 0 && (
        <instancedMesh ref={treeCanopyRef} args={[undefined, undefined, treeCanopies.length]} castShadow>
          <boxGeometry args={[10, 8, 10]} />
          <meshStandardMaterial color={TREE_CANOPY_COLOR} roughness={0.7} />
        </instancedMesh>
      )}

      {/* Walls */}
      {walls.length > 0 && (
        <instancedMesh ref={wallRef} args={[undefined, undefined, walls.length]} castShadow receiveShadow>
          <boxGeometry args={[15, 8, 4]} />
          <meshStandardMaterial color={WALL_COLOR} roughness={0.85} />
        </instancedMesh>
      )}

      {/* Water */}
      {waters.length > 0 && (
        <instancedMesh ref={waterRef} args={[undefined, undefined, waters.length]}>
          <boxGeometry args={[cellSize, 1, cellSize]} />
          <meshStandardMaterial
            ref={waterMaterialRef}
            color={WATER_COLOR}
            transparent
            opacity={0.4}
            roughness={0.2}
            metalness={0.1}
          />
        </instancedMesh>
      )}
    </group>
  );
}
