'use client';

/**
 * VoxelTerrain.tsx — Chunked 3D 지형 컴포넌트 (v39 Phase 1)
 *
 * MC 스타일 Terrain 재구현:
 * - Biome→Theme 동적 매핑 (하드코딩 'forest' 제거)
 * - 청크별 MC 텍스처 타일링 (biome별 createTerrainTextures)
 * - 장식 블록 InstancedMesh (높이 경계에 50-100개/청크)
 * - 장식 오브젝트 InstancedMesh (꽃/돌/잔디)
 * - useEffect cleanup (메모리 누수 방지)
 *
 * 좌표 매핑: 2D(x,y) → 3D(x, 0, -y)
 * useFrame priority=0 필수
 */

import React, { useRef, useEffect, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Player } from '@/lib/matrix/types';
import { createTerrainTextures, type TerrainTheme } from '@/lib/3d/terrain-textures';
import {
  CHUNK_SIZE,
  CHUNK_RENDER_RADIUS,
  chunkKey,
  getVisibleChunkCoords,
  diffChunks,
  createChunkGeometry,
  createChunkMaterial,
  getChunkDominantBiome,
  getBiomeTheme,
  generateChunkDecoBlocks,
  generateChunkDecoObjects,
  registerDecoBlockHeights,
  unregisterDecoBlockHeights,
  disposeMcGroundTextures,
  type ChunkData,
  type DecoBlockData,
  type DecoObjectData,
} from '@/lib/matrix/rendering3d/terrain';

// chunk 업데이트 주기 (매 프레임이 아닌 일정 간격으로)
const CHUNK_UPDATE_INTERVAL = 10; // 10 프레임마다

// 임시 Object3D (InstancedMesh 행렬 설정용, 재사용)
const _tempObj = new THREE.Object3D();

// ============================================
// 장식 블록/오브젝트 데이터 (chunk별)
// ============================================

interface ChunkDecoData {
  /** 장식 블록 InstancedMesh */
  blockMesh: THREE.InstancedMesh | null;
  /** 장식 오브젝트 InstancedMesh들 */
  objectMeshes: THREE.InstancedMesh[];
  /** 사용된 geometry들 (cleanup용) */
  geometries: THREE.BufferGeometry[];
  /** 사용된 material들 (cleanup용) */
  materials: THREE.Material[];
}

/** 확장 ChunkData (장식 데이터 포함) */
interface ExtChunkData extends ChunkData {
  /** 청크 머티리얼 (biome별 별도, dispose 필요) */
  material: THREE.MeshLambertMaterial;
  /** 장식 데이터 */
  deco: ChunkDecoData;
}

// ============================================
// biome별 장식 색상 팔레트
// ============================================

const DECO_FLOWER_COLORS: Record<TerrainTheme, string[]> = {
  forest: ['#FF4444', '#FFDD44', '#FF88CC', '#FF6644'],
  desert: ['#FFD700', '#FF8C00', '#E8C040', '#D4A030'],
  mountain: ['#9988CC', '#AABBDD', '#8877BB', '#99AACC'],
  urban: ['#FF4444', '#FFDD44', '#44AAFF', '#88FF88'],
  arctic: ['#CCDDFF', '#AABBEE', '#DDEEFF', '#BBCCEE'],
  island: ['#FF66AA', '#FFAA44', '#FF4466', '#44CCFF'],
};

const DECO_GRASS_COLORS: Record<TerrainTheme, string> = {
  forest: '#3D8C2E',
  desert: '#8B7355',
  mountain: '#556655',
  urban: '#3D8C2E',
  arctic: '#99AABB',
  island: '#4a7c3f',
};

// ============================================
// Component
// ============================================

export interface VoxelTerrainProps {
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
 * VoxelTerrain — Chunked 3D 지형 렌더링 (v39)
 *
 * 무한 지형을 chunk 단위로 분할하여:
 * 1. 플레이어 주변 chunk만 로드/렌더
 * 2. biome별 MC 텍스처 동적 매핑
 * 3. 장식 블록 + 오브젝트 InstancedMesh
 * 4. 멀어지면 chunk 해제 (geometry/material dispose)
 */
export function VoxelTerrain({
  playerRef,
  stageId = 1,
  gameMode = 'stage',
  seed = 42,
}: VoxelTerrainProps) {
  const groupRef = useRef<THREE.Group>(null);
  const chunksRef = useRef<Map<string, ExtChunkData>>(new Map());
  const frameCountRef = useRef(0);

  // biome별 머티리얼 캐시 (같은 biome의 chunk는 공유)
  const materialCacheRef = useRef<Map<TerrainTheme, THREE.MeshLambertMaterial>>(new Map());

  /** biome 테마에 해당하는 공유 머티리얼 가져오기 (캐시) */
  const getSharedMaterial = useCallback((theme: TerrainTheme): THREE.MeshLambertMaterial => {
    const cached = materialCacheRef.current.get(theme);
    if (cached) return cached;
    const mat = createChunkMaterial(theme);
    materialCacheRef.current.set(theme, mat);
    return mat;
  }, []);

  /**
   * chunk에 장식 블록 InstancedMesh 생성
   */
  const createDecoBlocks = useCallback((
    group: THREE.Group,
    blocks: DecoBlockData[],
    theme: TerrainTheme
  ): ChunkDecoData => {
    const geometries: THREE.BufferGeometry[] = [];
    const materials: THREE.Material[] = [];
    const objectMeshes: THREE.InstancedMesh[] = [];

    if (blocks.length === 0) {
      return { blockMesh: null, objectMeshes, geometries, materials };
    }

    // BoxGeometry(1,1,1) — 1 블록 = 1 단위
    const blockGeo = new THREE.BoxGeometry(CHUNK_SIZE / 40, 1, CHUNK_SIZE / 40); // TILE_SIZE(5)x1x5
    geometries.push(blockGeo);

    // 6면 멀티머티리얼 (top=ground, sides=side) — MC 스타일
    if (typeof document !== 'undefined') {
      const texSet = createTerrainTextures(theme);
      const topMats = [
        new THREE.MeshLambertMaterial({ map: texSet.side }),   // +x
        new THREE.MeshLambertMaterial({ map: texSet.side }),   // -x
        new THREE.MeshLambertMaterial({ map: texSet.ground }), // +y (top)
        new THREE.MeshLambertMaterial({ map: texSet.side }),   // -y (bottom)
        new THREE.MeshLambertMaterial({ map: texSet.side }),   // +z
        new THREE.MeshLambertMaterial({ map: texSet.side }),   // -z
      ];
      materials.push(...topMats);

      const blockMesh = new THREE.InstancedMesh(
        blockGeo,
        topMats as unknown as THREE.Material,
        blocks.length
      );

      blocks.forEach((b, i) => {
        _tempObj.position.set(b.x, b.y, b.z);
        _tempObj.rotation.set(0, 0, 0);
        _tempObj.scale.setScalar(1);
        _tempObj.updateMatrix();
        blockMesh.setMatrixAt(i, _tempObj.matrix);
      });

      blockMesh.instanceMatrix.needsUpdate = true;
      blockMesh.receiveShadow = true;
      blockMesh.castShadow = true;
      group.add(blockMesh);

      return { blockMesh, objectMeshes, geometries, materials };
    }

    return { blockMesh: null, objectMeshes, geometries, materials };
  }, []);

  /**
   * chunk에 장식 오브젝트 InstancedMesh 생성 (꽃/돌/잔디)
   */
  const createDecoObjects = useCallback((
    group: THREE.Group,
    objects: DecoObjectData[],
    theme: TerrainTheme,
    deco: ChunkDecoData
  ): void => {
    // 타입별 분류
    const byType: Record<string, DecoObjectData[]> = {};
    for (const obj of objects) {
      if (!byType[obj.type]) byType[obj.type] = [];
      byType[obj.type].push(obj);
    }

    const flowerColors = DECO_FLOWER_COLORS[theme] ?? DECO_FLOWER_COLORS.forest;
    const grassColor = DECO_GRASS_COLORS[theme] ?? DECO_GRASS_COLORS.forest;

    // 꽃 InstancedMesh (per-instance color)
    const flowers = byType['flower'];
    if (flowers && flowers.length > 0) {
      const fGeo = new THREE.BoxGeometry(0.3, 0.4, 0.3);
      const fMat = new THREE.MeshLambertMaterial();
      deco.geometries.push(fGeo);
      deco.materials.push(fMat);

      const fMesh = new THREE.InstancedMesh(fGeo, fMat, flowers.length);
      const col = new THREE.Color();

      flowers.forEach((f, i) => {
        _tempObj.position.set(f.x, f.y, f.z);
        _tempObj.rotation.set(0, 0, 0);
        _tempObj.scale.setScalar(1);
        _tempObj.updateMatrix();
        fMesh.setMatrixAt(i, _tempObj.matrix);
        col.set(flowerColors[f.colorIndex % flowerColors.length]);
        fMesh.setColorAt(i, col);
      });

      fMesh.instanceMatrix.needsUpdate = true;
      if (fMesh.instanceColor) fMesh.instanceColor.needsUpdate = true;
      group.add(fMesh);
      deco.objectMeshes.push(fMesh);
    }

    // 돌 InstancedMesh
    const stones = byType['stone'];
    if (stones && stones.length > 0) {
      const sGeo = new THREE.BoxGeometry(0.5, 0.3, 0.5);
      const sMat = new THREE.MeshLambertMaterial({ color: '#888888' });
      deco.geometries.push(sGeo);
      deco.materials.push(sMat);

      const sMesh = new THREE.InstancedMesh(sGeo, sMat, stones.length);
      stones.forEach((s, i) => {
        _tempObj.position.set(s.x, s.y, s.z);
        _tempObj.rotation.set(0, 0, 0);
        _tempObj.scale.setScalar(1);
        _tempObj.updateMatrix();
        sMesh.setMatrixAt(i, _tempObj.matrix);
      });
      sMesh.instanceMatrix.needsUpdate = true;
      group.add(sMesh);
      deco.objectMeshes.push(sMesh);
    }

    // 잔디 InstancedMesh
    const grassTufts = byType['grass_tuft'];
    if (grassTufts && grassTufts.length > 0) {
      const tGeo = new THREE.BoxGeometry(0.15, 0.5, 0.15);
      const tMat = new THREE.MeshLambertMaterial({ color: grassColor });
      deco.geometries.push(tGeo);
      deco.materials.push(tMat);

      const tMesh = new THREE.InstancedMesh(tGeo, tMat, grassTufts.length);
      grassTufts.forEach((t, i) => {
        _tempObj.position.set(t.x, t.y, t.z);
        _tempObj.rotation.set(0, 0, 0);
        _tempObj.scale.setScalar(1);
        _tempObj.updateMatrix();
        tMesh.setMatrixAt(i, _tempObj.matrix);
      });
      tMesh.instanceMatrix.needsUpdate = true;
      group.add(tMesh);
      deco.objectMeshes.push(tMesh);
    }
  }, []);

  // chunk 생성 함수
  const createChunk = useCallback(
    (cx: number, cz: number): ExtChunkData => {
      // 1. chunk dominant biome → theme
      const biome = getChunkDominantBiome(cx, cz, stageId, gameMode, seed);
      const theme = getBiomeTheme(biome);

      // 2. geometry + biome별 공유 머티리얼
      const geometry = createChunkGeometry(cx, cz, stageId, gameMode, seed);
      const material = getSharedMaterial(theme);
      const mesh = new THREE.Mesh(geometry, material);

      // chunk 월드 위치 (chunk 좌측 하단 기준)
      mesh.position.set(
        cx * CHUNK_SIZE + CHUNK_SIZE / 2,
        0,
        cz * CHUNK_SIZE + CHUNK_SIZE / 2
      );
      mesh.receiveShadow = true;
      mesh.frustumCulled = true;

      // 3. 장식 블록 + 오브젝트 생성
      const decoBlocks = generateChunkDecoBlocks(cx, cz, stageId, gameMode, seed);
      const decoObjects = generateChunkDecoObjects(cx, cz, decoBlocks, stageId, gameMode, seed);

      // 장식 블록용 group (chunk mesh와 같은 레벨)
      const decoGroup = new THREE.Group();
      decoGroup.position.set(0, 0, 0); // 월드 좌표 그대로

      const deco = createDecoBlocks(decoGroup, decoBlocks, theme);
      createDecoObjects(decoGroup, decoObjects, theme, deco);

      // 장식 블록 높이 캐시 등록
      const key = chunkKey(cx, cz);
      registerDecoBlockHeights(key, decoBlocks);

      return {
        key,
        chunkX: cx,
        chunkZ: cz,
        mesh,
        theme,
        material,
        deco: {
          ...deco,
          // decoGroup의 children을 objectMeshes에 포함하기 위해 blockMesh도 여기에
          objectMeshes: [...deco.objectMeshes],
          geometries: [...deco.geometries],
          materials: [...deco.materials],
        },
        // decoGroup을 mesh에 연결 (같이 관리)
      } as ExtChunkData & { _decoGroup?: THREE.Group };
    },
    [stageId, gameMode, seed, getSharedMaterial, createDecoBlocks, createDecoObjects]
  );

  // chunk 파괴 함수 (메모리 누수 방지)
  const destroyChunk = useCallback((chunk: ExtChunkData) => {
    // 1. geometry 해제 (material은 biome별 공유이므로 해제 X)
    chunk.mesh.geometry.dispose();
    chunk.mesh.removeFromParent();

    // 2. 장식 블록/오브젝트 해제
    const deco = chunk.deco;
    if (deco.blockMesh) {
      deco.blockMesh.removeFromParent();
      deco.blockMesh.dispose();
    }
    for (const objMesh of deco.objectMeshes) {
      objMesh.removeFromParent();
      objMesh.dispose();
    }
    for (const geo of deco.geometries) {
      geo.dispose();
    }
    for (const mat of deco.materials) {
      mat.dispose();
    }

    // 3. 높이 캐시 해제
    unregisterDecoBlockHeights(chunk.key);
  }, []);

  // useFrame priority=0 — chunk 업데이트 로직
  useFrame(() => {
    if (!groupRef.current) return;

    frameCountRef.current++;
    // 첫 프레임은 즉시 실행, 이후 N프레임마다 갱신 (성능 최적화)
    if (frameCountRef.current > 1 && frameCountRef.current % CHUNK_UPDATE_INTERVAL !== 0) return;

    const player = playerRef.current;

    // 2D → 3D 좌표: (x, y) → (x, -y)
    const playerWorldX = player.position.x;
    const playerWorldZ = -player.position.y;

    // visible chunk 좌표 목록
    const targetCoords = getVisibleChunkCoords(
      playerWorldX,
      playerWorldZ,
      CHUNK_RENDER_RADIUS
    );

    const currentKeys = new Set(chunksRef.current.keys());
    const { toCreate, toDestroy } = diffChunks(currentKeys, targetCoords);

    // chunk 파괴
    for (const key of toDestroy) {
      const chunk = chunksRef.current.get(key);
      if (chunk) {
        destroyChunk(chunk);
        chunksRef.current.delete(key);
      }
    }

    // chunk 생성
    for (const [cx, cz] of toCreate) {
      const chunk = createChunk(cx, cz);
      chunksRef.current.set(chunk.key, chunk);
      groupRef.current.add(chunk.mesh);

      // 장식 블록/오브젝트도 그룹에 추가
      if (chunk.deco.blockMesh) {
        groupRef.current.add(chunk.deco.blockMesh);
      }
      for (const objMesh of chunk.deco.objectMeshes) {
        groupRef.current.add(objMesh);
      }
    }
  });

  // ============================================
  // useEffect cleanup — 컴포넌트 언마운트 시 전체 정리
  // ============================================
  useEffect(() => {
    return () => {
      // 모든 chunk 정리
      for (const [, chunk] of chunksRef.current) {
        destroyChunk(chunk);
      }
      chunksRef.current.clear();

      // biome별 공유 머티리얼 정리
      for (const [, mat] of materialCacheRef.current) {
        mat.dispose();
      }
      materialCacheRef.current.clear();

      // MC ground 텍스처 싱글턴 캐시 정리
      disposeMcGroundTextures();
    };
  }, [destroyChunk]);

  return <group ref={groupRef} />;
}

export default VoxelTerrain;
