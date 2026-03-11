'use client';

/**
 * VoxelTerrain.tsx — Chunked 3D 지형 컴포넌트
 *
 * S07: Ground Plane Chunked Mesh
 * - 200x200 unit chunk 시스템
 * - 카메라 주변 visible chunks만 렌더링
 * - 플레이어 이동에 따라 chunk 생성/파괴
 *
 * S08: Biome Texture Atlas
 * - 7 biome 타일 → canvas 기반 atlas
 * - Vertex colors로 biome별 색상 적용
 *
 * S09: Simplex Noise Biome 통합
 * - noise.ts + biomes.ts 재사용
 * - Biome transition 블렌딩
 *
 * 좌표 매핑: 2D(x,y) → 3D(x, 0, -y)
 * useFrame priority=0 필수
 */

import React, { useRef, useMemo, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Player } from '@/lib/matrix/types';
import {
  CHUNK_SIZE,
  CHUNK_RENDER_RADIUS,
  chunkKey,
  getVisibleChunkCoords,
  diffChunks,
  createChunkGeometry,
  createChunkMaterial,
  type ChunkData,
} from '@/lib/matrix/rendering3d/terrain';

// chunk 업데이트 주기 (매 프레임이 아닌 일정 간격으로)
const CHUNK_UPDATE_INTERVAL = 10; // 10 프레임마다

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
 * VoxelTerrain — Chunked 3D 지형 렌더링
 *
 * 무한 지형을 chunk 단위로 분할하여:
 * 1. 플레이어 주변 chunk만 로드/렌더
 * 2. 멀어지면 chunk 해제 (메모리 누수 방지)
 * 3. vertex color로 biome 시각화
 */
export function VoxelTerrain({
  playerRef,
  stageId = 1,
  gameMode = 'stage',
  seed = 42,
}: VoxelTerrainProps) {
  const groupRef = useRef<THREE.Group>(null);
  const chunksRef = useRef<Map<string, ChunkData>>(new Map());
  const frameCountRef = useRef(0);

  // 공유 머티리얼 (모든 chunk에서 재사용)
  const sharedMaterial = useMemo(() => createChunkMaterial(), []);

  // chunk 생성 함수
  const createChunk = useCallback(
    (cx: number, cz: number): ChunkData => {
      const geometry = createChunkGeometry(cx, cz, stageId, gameMode, seed);
      const mesh = new THREE.Mesh(geometry, sharedMaterial);

      // chunk 월드 위치 (chunk 좌측 하단 기준)
      mesh.position.set(
        cx * CHUNK_SIZE + CHUNK_SIZE / 2,
        0, // 지면 Y=0
        cz * CHUNK_SIZE + CHUNK_SIZE / 2
      );

      mesh.receiveShadow = true;
      mesh.frustumCulled = true;

      return {
        key: chunkKey(cx, cz),
        chunkX: cx,
        chunkZ: cz,
        mesh,
      };
    },
    [stageId, gameMode, seed, sharedMaterial]
  );

  // chunk 파괴 함수
  const destroyChunk = useCallback((chunk: ChunkData) => {
    // geometry 해제 (material은 공유이므로 해제 X)
    chunk.mesh.geometry.dispose();
    // scene에서 제거
    chunk.mesh.removeFromParent();
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
    }
  });

  return <group ref={groupRef} />;
}

export default VoxelTerrain;
