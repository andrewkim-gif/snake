'use client';

/**
 * MCVoxelTerrain — Minecraft 블록 월드 (MatrixScene /new 전용)
 *
 * 성능 최적화:
 * - 청크별 pre-computed exposed 블록 캐시 → 리빌드 시 전체 순회 제거
 * - 프레임당 최대 1개 청크 생성 (점진적 로딩)
 * - InstancedMesh per block type (6종), BoxGeometry(1,1,1)
 * - 구름: InstancedMesh 반투명 화이트 박스 at Y=80
 */

import { useRef, useMemo, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { MCNoise, type ChunkBlockData } from '@/lib/3d/mc-noise';
import { BlockType, MC_CLOUD_HEIGHT, CHUNK_SIZE, blockKey } from '@/lib/3d/mc-types';

// 렌더 거리 (청크 단위) — 5이면 11x11=121 청크, 120블록 반경 (fog far=80보다 큼)
const RENDER_DISTANCE = 5;

// 프레임당 최대 청크 생성 수 (생성만 — rebuild는 별도 타이밍)
const MAX_CHUNKS_PER_FRAME = 4;
// 리빌드 최소 간격 (프레임 수) — 초기 로딩 시 매 프레임 rebuild 방지
const REBUILD_INTERVAL = 3;

// 블록 타입별 최대 InstancedMesh 할당 (RENDER_DISTANCE=5, 121 청크)
const MAX_INSTANCES: Record<string, number> = {
  grass: 80000,
  dirt: 20000,
  stone: 40000,
  sand: 16000,
  tree: 8000,
  leaf: 30000,
};

// 구름 설정
const CLOUD_COUNT = 30;
const CLOUD_SPREAD = 150;

// MC 텍스처 경로
const TEX_PATH = '/textures/blocks';

interface MCVoxelTerrainProps {
  seed: number;
  playerRef: React.MutableRefObject<{
    position: { x: number; y: number };
  }>;
}

// 블록 타입별 텍스처 로딩 (NearestFilter)
function loadBlockTexture(path: string): THREE.Texture {
  const tex = new THREE.TextureLoader().load(path);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = false;
  return tex;
}

function chunkKey(cx: number, cz: number): string {
  return `${cx},${cz}`;
}

function worldToChunk(x: number, z: number): [number, number] {
  return [Math.floor(x / CHUNK_SIZE), Math.floor(z / CHUNK_SIZE)];
}

// ============================================
// 타입별 meshKey 매핑 (switch 제거 — 룩업 테이블)
// ============================================
const BLOCK_TO_MESH: Record<number, string> = {
  [BlockType.grass]: 'grass',
  [BlockType.dirt]: 'dirt',
  [BlockType.stone]: 'stone',
  [BlockType.coal]: 'stone',
  [BlockType.bedrock]: 'stone',
  [BlockType.cobblestone]: 'stone',
  [BlockType.gravel]: 'stone',
  [BlockType.sand]: 'sand',
  [BlockType.tree]: 'tree',
  [BlockType.wood]: 'tree',
  [BlockType.leaf]: 'leaf',
};

// 노출 체크용 이웃 오프셋
const NEIGHBOR_OFFSETS = [
  [1, 0, 0], [-1, 0, 0],
  [0, 1, 0], [0, -1, 0],
  [0, 0, 1], [0, 0, -1],
];

/** 블록 노출 여부 (인접 6면 중 하나라도 비어있으면 true) */
function isExposed(blockMap: Map<number, BlockType>, x: number, y: number, z: number): boolean {
  for (const [dx, dy, dz] of NEIGHBOR_OFFSETS) {
    const t = blockMap.get(blockKey(x + dx, y + dy, z + dz));
    if (t === undefined || t === BlockType.AIR || t === BlockType.leaf) return true;
  }
  return false;
}

/** 청크별 pre-computed exposed 블록 (meshKey + position) */
interface ExposedBlock {
  meshKey: string;
  x: number;
  y: number;
  z: number;
}

export function MCVoxelTerrain({ seed, playerRef }: MCVoxelTerrainProps) {
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const noiseRef = useRef(new MCNoise(seed));

  // 로드된 청크
  const loadedChunksRef = useRef<Set<string>>(new Set());

  // 청크별 원시 블록 데이터
  const chunkRawRef = useRef<Map<string, ChunkBlockData[]>>(new Map());

  // 전체 블록 맵 (노출 체크용 — 숫자 키로 GC 부담 제거)
  const blockMapRef = useRef<Map<number, BlockType>>(new Map());

  // 청크별 exposed 블록 캐시 (리빌드 시 사용)
  const chunkExposedRef = useRef<Map<string, ExposedBlock[]>>(new Map());

  // 마지막 카메라 청크 위치
  const lastChunkRef = useRef<[number, number]>([NaN, NaN]);

  // 점진적 로딩 큐
  const pendingRef = useRef<string[]>([]);

  // 리빌드 필요 플래그 + 프레임 카운터 (throttle)
  const dirtyRef = useRef(false);
  const framesSinceBuildRef = useRef(0);

  useEffect(() => {
    noiseRef.current = new MCNoise(seed);
  }, [seed]);

  // ============================================
  // 머티리얼 (1회 생성)
  // ============================================
  const materials = useMemo(() => {
    const dirtMat = new THREE.MeshLambertMaterial({ map: loadBlockTexture(`${TEX_PATH}/dirt.png`) });
    const stoneMat = new THREE.MeshLambertMaterial({ map: loadBlockTexture(`${TEX_PATH}/stone.png`) });
    const sandMat = new THREE.MeshLambertMaterial({ map: loadBlockTexture(`${TEX_PATH}/sand.png`) });
    const leafMat = new THREE.MeshLambertMaterial({
      map: loadBlockTexture(`${TEX_PATH}/oak_leaves.png`),
      transparent: true,
      alphaTest: 0.1,
      side: THREE.DoubleSide,
      color: new THREE.Color('#5aaa3a'),
    });
    return { dirtMat, stoneMat, sandMat, leafMat };
  }, []);

  // ============================================
  // InstancedMesh 생성 (타입별)
  // ============================================
  const meshes = useMemo(() => {
    const geo = new THREE.BoxGeometry(1, 1, 1);

    const grassMat = new THREE.MeshLambertMaterial({ map: loadBlockTexture(`${TEX_PATH}/grass_block_side.png`) });
    const grassMesh = new THREE.InstancedMesh(geo, grassMat, MAX_INSTANCES.grass);
    grassMesh.count = 0;
    grassMesh.frustumCulled = false;

    const dirtMesh = new THREE.InstancedMesh(geo, materials.dirtMat, MAX_INSTANCES.dirt);
    dirtMesh.count = 0;
    dirtMesh.frustumCulled = false;

    const stoneMesh = new THREE.InstancedMesh(geo, materials.stoneMat, MAX_INSTANCES.stone);
    stoneMesh.count = 0;
    stoneMesh.frustumCulled = false;

    const sandMesh = new THREE.InstancedMesh(geo, materials.sandMat, MAX_INSTANCES.sand);
    sandMesh.count = 0;
    sandMesh.frustumCulled = false;

    const treeMat = new THREE.MeshLambertMaterial({ map: loadBlockTexture(`${TEX_PATH}/oak_log.png`) });
    const treeMesh = new THREE.InstancedMesh(geo, treeMat, MAX_INSTANCES.tree);
    treeMesh.count = 0;
    treeMesh.frustumCulled = false;

    const leafMesh = new THREE.InstancedMesh(geo, materials.leafMat, MAX_INSTANCES.leaf);
    leafMesh.count = 0;
    leafMesh.frustumCulled = false;

    return { grassMesh, dirtMesh, stoneMesh, sandMesh, treeMesh, leafMesh };
  }, [materials]);

  // meshKey → InstancedMesh
  const meshMap: Record<string, THREE.InstancedMesh> = useMemo(() => ({
    grass: meshes.grassMesh,
    dirt: meshes.dirtMesh,
    stone: meshes.stoneMesh,
    sand: meshes.sandMesh,
    tree: meshes.treeMesh,
    leaf: meshes.leafMesh,
  }), [meshes]);

  // ============================================
  // 구름
  // ============================================
  const cloudMesh = useMemo(() => {
    const cloudGeo = new THREE.BoxGeometry(20, 4, 14);
    const cloudMat = new THREE.MeshBasicMaterial({
      color: '#ffffff', transparent: true, opacity: 0.4, depthWrite: false,
    });
    const mesh = new THREE.InstancedMesh(cloudGeo, cloudMat, CLOUD_COUNT);
    mesh.count = CLOUD_COUNT;
    mesh.frustumCulled = false;

    const matrix = new THREE.Matrix4();
    const rng = mulberry32(seed);
    for (let i = 0; i < CLOUD_COUNT; i++) {
      const x = (rng() - 0.5) * CLOUD_SPREAD * 2;
      const z = (rng() - 0.5) * CLOUD_SPREAD * 2;
      const y = MC_CLOUD_HEIGHT + (rng() - 0.5) * 10;
      const sx = 0.8 + rng() * 0.6;
      const sz = 0.8 + rng() * 0.5;
      matrix.makeTranslation(x, y, z);
      matrix.scale(new THREE.Vector3(sx, 1, sz));
      mesh.setMatrixAt(i, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }, [seed]);

  // ============================================
  // Scene에 mesh 추가/제거
  // ============================================
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    const allMeshes = [...Object.values(meshes), cloudMesh];
    for (const m of allMeshes) group.add(m);

    return () => {
      for (const m of allMeshes) group.remove(m);
      Object.values(meshes).forEach((m) => {
        m.geometry.dispose();
        if (Array.isArray(m.material)) m.material.forEach((mt: THREE.Material) => mt.dispose());
        else (m.material as THREE.Material).dispose();
        m.dispose();
      });
      cloudMesh.geometry.dispose();
      (cloudMesh.material as THREE.Material).dispose();
      cloudMesh.dispose();
    };
  }, [meshes, cloudMesh]);

  // ============================================
  // 단일 청크 생성 + exposed 캐시 계산
  // ============================================
  const generateChunk = useCallback((key: string) => {
    const noise = noiseRef.current;
    const [cx, cz] = key.split(',').map(Number);
    const rawBlocks = noise.generateChunkBlocks(cx, cz);
    chunkRawRef.current.set(key, rawBlocks);

    // blockMap에 추가 (숫자 키)
    const bm = blockMapRef.current;
    for (const b of rawBlocks) {
      bm.set(blockKey(b.x, b.y, b.z), b.type);
    }

    loadedChunksRef.current.add(key);

    // exposed 블록 사전 계산
    computeExposed(key);
  }, []);

  // 단일 청크의 exposed 블록 계산
  const computeExposed = useCallback((key: string) => {
    const raw = chunkRawRef.current.get(key);
    if (!raw) return;
    const bm = blockMapRef.current;
    const exposed: ExposedBlock[] = [];

    for (const b of raw) {
      const mk = BLOCK_TO_MESH[b.type];
      if (!mk) continue;
      // leaf는 항상 노출, 나머지는 체크
      if (b.type !== BlockType.leaf && !isExposed(bm, b.x, b.y, b.z)) continue;
      exposed.push({ meshKey: mk, x: b.x, y: b.y, z: b.z });
    }

    chunkExposedRef.current.set(key, exposed);
  }, []);

  // ============================================
  // InstancedMesh 리빌드 (cached exposed만 순회)
  // ============================================
  const rebuildInstances = useCallback(() => {
    if (!dirtyRef.current) return;
    dirtyRef.current = false;

    const counters: Record<string, number> = {
      grass: 0, dirt: 0, stone: 0, sand: 0, tree: 0, leaf: 0,
    };
    const matrix = new THREE.Matrix4();

    for (const exposed of chunkExposedRef.current.values()) {
      for (const eb of exposed) {
        const idx = counters[eb.meshKey];
        if (idx >= MAX_INSTANCES[eb.meshKey]) continue;

        matrix.makeTranslation(eb.x + 0.5, eb.y + 0.5, eb.z + 0.5);
        meshMap[eb.meshKey].setMatrixAt(idx, matrix);
        counters[eb.meshKey] = idx + 1;
      }
    }

    // count + needsUpdate
    for (const [key, mesh] of Object.entries(meshMap)) {
      mesh.count = counters[key];
      if (counters[key] > 0) mesh.instanceMatrix.needsUpdate = true;
    }
  }, [meshMap]);

  // ============================================
  // useFrame — 점진적 청크 로딩
  // ============================================
  useFrame(() => {
    // 플레이어 위치 기준 청크 로드 (카메라는 8~30블록 뒤에 있어서 전방 지형 부족 발생)
    const px = playerRef.current.position.x;
    const pz = playerRef.current.position.y; // 2D y → 3D z
    const [cx, cz] = worldToChunk(px, pz);
    const [lastCx, lastCz] = lastChunkRef.current;

    // 청크 경계 변경 시 큐 갱신
    if (cx !== lastCx || cz !== lastCz || Number.isNaN(lastCx)) {
      lastChunkRef.current = [cx, cz];

      // 필요한 청크 계산
      const target = new Set<string>();
      for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++) {
        for (let dz = -RENDER_DISTANCE; dz <= RENDER_DISTANCE; dz++) {
          target.add(chunkKey(cx + dx, cz + dz));
        }
      }

      // 큐에 새 청크 추가 (거리순)
      const newPending: string[] = [];
      for (const k of target) {
        if (!loadedChunksRef.current.has(k)) {
          newPending.push(k);
        }
      }
      newPending.sort((a, b) => {
        const [ax, az] = a.split(',').map(Number);
        const [bx, bz] = b.split(',').map(Number);
        return ((ax - cx) ** 2 + (az - cz) ** 2) - ((bx - cx) ** 2 + (bz - cz) ** 2);
      });
      pendingRef.current = newPending;

      // 범위 밖 청크 제거
      for (const k of loadedChunksRef.current) {
        if (!target.has(k)) {
          const raw = chunkRawRef.current.get(k);
          if (raw) {
            for (const b of raw) blockMapRef.current.delete(blockKey(b.x, b.y, b.z));
          }
          chunkRawRef.current.delete(k);
          chunkExposedRef.current.delete(k);
          loadedChunksRef.current.delete(k);
          dirtyRef.current = true;
        }
      }
    }

    // 프레임당 최대 N개 청크 생성
    const queue = pendingRef.current;
    let generated = 0;
    while (queue.length > 0 && generated < MAX_CHUNKS_PER_FRAME) {
      const k = queue.shift()!;
      if (loadedChunksRef.current.has(k)) continue;
      generateChunk(k);
      dirtyRef.current = true;
      generated++;
    }

    // InstancedMesh 리빌드 (dirty + throttle)
    // 큐가 비었거나 N프레임마다만 rebuild (초기 로딩 시 매 프레임 rebuild 방지)
    framesSinceBuildRef.current++;
    if (dirtyRef.current && (queue.length === 0 || framesSinceBuildRef.current >= REBUILD_INTERVAL)) {
      rebuildInstances();
      framesSinceBuildRef.current = 0;
    }

    // 구름 이동
    cloudMesh.position.x += 0.02;
    if (cloudMesh.position.x > CLOUD_SPREAD) {
      cloudMesh.position.x = -CLOUD_SPREAD;
    }
  });

  return <group ref={groupRef} />;
}

// PRNG (구름 위치용)
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default MCVoxelTerrain;
