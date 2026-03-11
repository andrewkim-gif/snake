'use client';

/**
 * TerrainObjects.tsx — 지형 위 오브젝트 인스턴싱 렌더링
 *
 * S11: Terrain Object Instancing
 * - 기존 hash-based placement 패턴 재사용
 * - 같은 타입 prop → InstancedMesh (1 draw call per type)
 * - Frustum culling + distance culling (>1500px 숨김)
 *
 * 좌표 매핑: 2D(x,y) → 3D(x, 0, -y)
 * useFrame priority=0 필수
 */

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Player } from '@/lib/matrix/types';
import { seededSimplex2D, normalizeNoise } from '@/lib/matrix/map/noise';
import { getBiomeAt, getStageMapConfig } from '@/lib/matrix/map/biomes';
import type { BiomeType } from '@/lib/matrix/map/types';
import {
  CHUNK_SIZE,
  CHUNK_RENDER_RADIUS,
  chunkKey,
  worldToChunk,
} from '@/lib/matrix/rendering3d/terrain';
import {
  TERRAIN_PROP_REGISTRY,
  createPropGeometry,
  createPropMaterial,
  selectRandomProp,
  type TerrainPropDef,
} from '@/lib/matrix/rendering3d/terrain-objects-config';

// ============================================
// Constants
// ============================================

/** prop 간 최소 간격 (월드 단위) */
const PROP_SPACING = 30;

/** 최대 거리 (이 이상이면 숨김) */
const MAX_RENDER_DISTANCE = 1500;

/** chunk당 최대 prop 수 */
const MAX_PROPS_PER_CHUNK = 20;

/** 인스턴스 풀 용량 (타입별) */
const INSTANCE_POOL_SIZE = 500;

/** 오브젝트 밀도 (0-1, 낮을수록 적음) */
const OBJECT_DENSITY = 0.12;

// ============================================
// Hash-based placement 유틸
// ============================================

/**
 * deterministic hash (좌표 기반)
 * 같은 좌표는 항상 같은 hash 반환
 */
function coordHash(x: number, y: number, seed: number): number {
  const n = normalizeNoise(seededSimplex2D(x * 0.01, y * 0.01, seed + 9999));
  return n;
}

/**
 * chunk 내 prop 배치 좌표 계산 (결정론적)
 */
function getChunkPropPlacements(
  chunkX: number,
  chunkZ: number,
  stageId: number,
  gameMode: 'stage' | 'singularity' | 'tutorial',
  seed: number
): Array<{
  worldX: number;
  worldZ: number;
  biome: BiomeType;
  hash: number;
  propDef: TerrainPropDef;
  rotation: number;
  scale: number;
}> {
  const mapConfig = getStageMapConfig(stageId, gameMode);
  const results: Array<{
    worldX: number;
    worldZ: number;
    biome: BiomeType;
    hash: number;
    propDef: TerrainPropDef;
    rotation: number;
    scale: number;
  }> = [];

  const startX = chunkX * CHUNK_SIZE;
  const startZ = chunkZ * CHUNK_SIZE;

  // grid 기반 배치 (PROP_SPACING 간격)
  for (let dx = PROP_SPACING / 2; dx < CHUNK_SIZE; dx += PROP_SPACING) {
    for (let dz = PROP_SPACING / 2; dz < CHUNK_SIZE; dz += PROP_SPACING) {
      const worldX = startX + dx;
      const worldZ = startZ + dz;

      // hash로 배치 여부 결정
      const hash = coordHash(worldX, worldZ, seed);
      if (hash > OBJECT_DENSITY) continue;

      // 3D(x,z) → 2D(x,y): z → -y
      const worldX2D = worldX;
      const worldY2D = -worldZ;

      // biome 결정
      const biome = getBiomeAt(worldX2D, worldY2D, mapConfig, seed);

      // prop 선택
      const propHash = coordHash(worldX + 777, worldZ + 333, seed);
      const propDef = selectRandomProp(biome, propHash);
      if (!propDef) continue;

      // 회전/스케일 변형 (hash 기반)
      const rotHash = coordHash(worldX + 111, worldZ + 222, seed);
      const rotation = rotHash * Math.PI * 2;
      const scaleHash = coordHash(worldX + 444, worldZ + 555, seed);
      const scale = 0.8 + scaleHash * 0.4; // 0.8 ~ 1.2

      results.push({
        worldX,
        worldZ,
        biome,
        hash,
        propDef,
        rotation,
        scale,
      });

      if (results.length >= MAX_PROPS_PER_CHUNK) break;
    }
    if (results.length >= MAX_PROPS_PER_CHUNK) break;
  }

  return results;
}

// ============================================
// Component
// ============================================

export interface TerrainObjectsProps {
  /** 플레이어 상태 ref */
  playerRef: React.MutableRefObject<Player>;
  /** 현재 스테이지 ID */
  stageId?: number;
  /** 게임 모드 */
  gameMode?: 'stage' | 'singularity' | 'tutorial';
  /** 노이즈 시드 */
  seed?: number;
}

/**
 * InstancedPropPool — 하나의 prop 타입에 대한 InstancedMesh 풀
 */
function InstancedPropPool({
  propDef,
  placements,
  playerRef,
}: {
  propDef: TerrainPropDef;
  placements: Array<{ worldX: number; worldZ: number; rotation: number; scale: number }>;
  playerRef: React.MutableRefObject<Player>;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  // prop별 geometry + material (memoized)
  const geometry = useMemo(() => createPropGeometry(propDef), [propDef]);
  const material = useMemo(() => {
    // void biome props에 emissive 효과 추가
    const emissive = propDef.biome === 'void' ? '#00ff41' : undefined;
    return createPropMaterial(emissive);
  }, [propDef]);

  // 임시 행렬 객체 (재사용)
  const tempMatrix = useMemo(() => new THREE.Matrix4(), []);
  const tempPosition = useMemo(() => new THREE.Vector3(), []);
  const tempQuaternion = useMemo(() => new THREE.Quaternion(), []);
  const tempScale = useMemo(() => new THREE.Vector3(), []);

  // instance 업데이트 (useFrame priority=0)
  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const player = playerRef.current;
    const playerX = player.position.x;
    const playerZ = -player.position.y;

    let visibleCount = 0;

    for (let i = 0; i < placements.length && visibleCount < INSTANCE_POOL_SIZE; i++) {
      const p = placements[i];

      // distance culling
      const dx = p.worldX - playerX;
      const dz = p.worldZ - playerZ;
      const distSq = dx * dx + dz * dz;

      if (distSq > MAX_RENDER_DISTANCE * MAX_RENDER_DISTANCE) continue;

      // matrix 설정
      tempPosition.set(p.worldX, propDef.yOffset, p.worldZ);
      tempQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.rotation);
      tempScale.set(p.scale, p.scale, p.scale);
      tempMatrix.compose(tempPosition, tempQuaternion, tempScale);

      mesh.setMatrixAt(visibleCount, tempMatrix);
      visibleCount++;
    }

    mesh.count = visibleCount;
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, INSTANCE_POOL_SIZE]}
      castShadow
      receiveShadow
      frustumCulled={false} // 수동 distance culling 사용
    />
  );
}

/**
 * TerrainObjects — 지형 오브젝트 인스턴싱 렌더러
 *
 * 플레이어 주변 chunk들의 prop을 수집하고,
 * 같은 prop 타입끼리 InstancedMesh로 batch 렌더링
 */
export function TerrainObjects({
  playerRef,
  stageId = 1,
  gameMode = 'stage',
  seed = 42,
}: TerrainObjectsProps) {
  const frameCountRef = useRef(0);
  const placementsRef = useRef<
    Map<string, Array<{ worldX: number; worldZ: number; rotation: number; scale: number; propId: string }>>
  >(new Map());
  const lastChunkKeyRef = useRef('');

  // 모든 biome의 고유 prop ID 목록
  const allPropDefs = useMemo(() => {
    const defs = new Map<string, TerrainPropDef>();
    for (const biome of Object.keys(TERRAIN_PROP_REGISTRY) as BiomeType[]) {
      for (const prop of TERRAIN_PROP_REGISTRY[biome]) {
        if (!defs.has(prop.id)) {
          defs.set(prop.id, prop);
        }
      }
    }
    return defs;
  }, []);

  // prop별 placements 집계 (useFrame에서 업데이트)
  const propPlacementsRef = useRef<Map<string, Array<{ worldX: number; worldZ: number; rotation: number; scale: number }>>>(
    new Map()
  );

  useFrame(() => {
    frameCountRef.current++;
    // 30 프레임마다 갱신
    if (frameCountRef.current % 30 !== 0) return;

    const player = playerRef.current;
    const playerX = player.position.x;
    const playerZ = -player.position.y;
    const [pcx, pcz] = worldToChunk(playerX, playerZ);
    const currentKey = `${pcx},${pcz}`;

    // chunk 변경 없으면 skip
    if (currentKey === lastChunkKeyRef.current) return;
    lastChunkKeyRef.current = currentKey;

    // 새 placements 수집
    const newPropPlacements = new Map<string, Array<{ worldX: number; worldZ: number; rotation: number; scale: number }>>();

    for (let dx = -CHUNK_RENDER_RADIUS; dx <= CHUNK_RENDER_RADIUS; dx++) {
      for (let dz = -CHUNK_RENDER_RADIUS; dz <= CHUNK_RENDER_RADIUS; dz++) {
        const cx = pcx + dx;
        const cz = pcz + dz;
        const key = chunkKey(cx, cz);

        // 캐시 확인
        let chunkPlacements = placementsRef.current.get(key);
        if (!chunkPlacements) {
          const raw = getChunkPropPlacements(cx, cz, stageId, gameMode, seed);
          chunkPlacements = raw.map((r) => ({
            worldX: r.worldX,
            worldZ: r.worldZ,
            rotation: r.rotation,
            scale: r.scale,
            propId: r.propDef.id,
          }));
          placementsRef.current.set(key, chunkPlacements);
        }

        // prop별로 분류
        for (const p of chunkPlacements) {
          if (!newPropPlacements.has(p.propId)) {
            newPropPlacements.set(p.propId, []);
          }
          newPropPlacements.get(p.propId)!.push({
            worldX: p.worldX,
            worldZ: p.worldZ,
            rotation: p.rotation,
            scale: p.scale,
          });
        }
      }
    }

    propPlacementsRef.current = newPropPlacements;
  });

  // prop 타입별 InstancedMesh 렌더링
  const propEntries = useMemo(() => Array.from(allPropDefs.entries()), [allPropDefs]);

  return (
    <group>
      {propEntries.map(([id, def]) => (
        <InstancedPropPoolWrapper
          key={id}
          propDef={def}
          propId={id}
          propPlacementsRef={propPlacementsRef}
          playerRef={playerRef}
        />
      ))}
    </group>
  );
}

/**
 * Wrapper: propPlacementsRef에서 해당 prop의 placements를 읽어 전달
 */
function InstancedPropPoolWrapper({
  propDef,
  propId,
  propPlacementsRef,
  playerRef,
}: {
  propDef: TerrainPropDef;
  propId: string;
  propPlacementsRef: React.MutableRefObject<
    Map<string, Array<{ worldX: number; worldZ: number; rotation: number; scale: number }>>
  >;
  playerRef: React.MutableRefObject<Player>;
}) {
  // 초기 빈 placements
  const placementsRef = useRef<Array<{ worldX: number; worldZ: number; rotation: number; scale: number }>>([]);

  // useFrame에서 placements 동기화
  useFrame(() => {
    const allPlacements = propPlacementsRef.current.get(propId);
    if (allPlacements) {
      placementsRef.current = allPlacements;
    }
  });

  return (
    <InstancedPropPool
      propDef={propDef}
      placements={placementsRef.current}
      playerRef={playerRef}
    />
  );
}

export default TerrainObjects;
