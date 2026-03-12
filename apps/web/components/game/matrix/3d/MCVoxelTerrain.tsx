'use client';

/**
 * MCVoxelTerrain — Minecraft 블록 월드 (MatrixScene /new 전용)
 *
 * 성능 최적화:
 * - 청크별 pre-computed exposed 블록 캐시 → 리빌드 시 전체 순회 제거
 * - 프레임당 최대 1개 청크 생성 (점진적 로딩)
 * - InstancedMesh per block type (10종+grassTop), BoxGeometry(1,1,1)
 * - 구름: InstancedMesh 반투명 화이트 박스 at Y=80
 */

import { useRef, useMemo, useEffect, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MCNoise, type ChunkBlockData } from '@/lib/3d/mc-noise';
import { BlockType, MC_CLOUD_HEIGHT, CHUNK_SIZE, blockKey } from '@/lib/3d/mc-types';
import { getGrassVariantIndex, GRASS_VARIANT_TEXTURES } from '@/lib/3d/block-textures';
import { Biome } from '@/lib/3d/mc-noise';
import { DECORATION_TYPES, getDecorationTexture, type DecorationType } from '@/lib/3d/decoration-textures';

// 렌더 거리 (청크 단위) — 6이면 13x13=169 청크, 96블록 반경 (산봉우리 75블록 포함)
const RENDER_DISTANCE = 6;

// 프레임당 최대 청크 생성 수 (생성만 — rebuild는 별도 타이밍)
const MAX_CHUNKS_PER_FRAME = 4;
// 리빌드 최소 간격 (프레임 수) — 초기 로딩 시 매 프레임 rebuild 방지
const REBUILD_INTERVAL = 3;

// 블록 타입별 최대 InstancedMesh 할당 (RENDER_DISTANCE=6, 169 청크, 산악 지형 포함)
const MAX_INSTANCES: Record<string, number> = {
  grass: 120000,
  dirt: 30000,
  stone: 80000,
  coal: 5000,
  bedrock: 3000,
  cobblestone: 5000,
  gravel: 3000,
  sand: 20000,
  tree: 10000,
  leaf: 40000,
  birch_tree: 5000,
  birch_leaf: 20000,
  spruce_tree: 5000,
  spruce_leaf: 20000,
};

// 잔디 변형 상단 오버레이 최대 인스턴스 (variant 1=dark, 2=dry, 3=lush, 각 ~20000)
const GRASS_VARIANT_MAX = 20000;

// v45: 바닥 장식 오브젝트 최대 인스턴스
const DECORATION_MAX_PER_TYPE = 3000;

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
  [BlockType.coal]: 'coal',
  [BlockType.bedrock]: 'bedrock',
  [BlockType.cobblestone]: 'cobblestone',
  [BlockType.gravel]: 'gravel',
  [BlockType.sand]: 'sand',
  [BlockType.tree]: 'tree',
  [BlockType.wood]: 'tree',
  [BlockType.leaf]: 'leaf',
  [BlockType.birch_tree]: 'birch_tree',
  [BlockType.birch_leaf]: 'birch_leaf',
  [BlockType.spruce_tree]: 'spruce_tree',
  [BlockType.spruce_leaf]: 'spruce_leaf',
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
    if (t === undefined || t === BlockType.AIR ||
        t === BlockType.leaf || t === BlockType.birch_leaf || t === BlockType.spruce_leaf) return true;
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

/** v45: 청크별 장식 오브젝트 데이터 */
interface DecorationData {
  type: DecorationType;
  x: number;
  y: number;
  z: number;
}

export function MCVoxelTerrain({ seed, playerRef }: MCVoxelTerrainProps) {
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

  // v45: 청크별 장식 오브젝트 데이터
  const chunkDecorationsRef = useRef<Map<string, DecorationData[]>>(new Map());

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
    // 신규 블록 텍스처 머티리얼 (Phase 4: 지형 텍스처 다양화)
    const coalMat = new THREE.MeshLambertMaterial({ map: loadBlockTexture(`${TEX_PATH}/coal_ore.png`) });
    const bedrockMat = new THREE.MeshLambertMaterial({ map: loadBlockTexture(`${TEX_PATH}/bedrock.png`) });
    const cobblestoneMat = new THREE.MeshLambertMaterial({ map: loadBlockTexture(`${TEX_PATH}/cobblestone.png`) });
    const gravelMat = new THREE.MeshLambertMaterial({ map: loadBlockTexture(`${TEX_PATH}/gravel.png`) });
    // v45: 자작나무/가문비나무 머티리얼
    const birchLeafMat = new THREE.MeshLambertMaterial({
      map: loadBlockTexture(`${TEX_PATH}/birch_leaves.png`),
      transparent: true,
      alphaTest: 0.1,
      side: THREE.DoubleSide,
      color: new THREE.Color('#8abf50'),
    });
    const spruceLeafMat = new THREE.MeshLambertMaterial({
      map: loadBlockTexture(`${TEX_PATH}/spruce_leaves.png`),
      transparent: true,
      alphaTest: 0.1,
      side: THREE.DoubleSide,
      color: new THREE.Color('#3a7a3a'),
    });

    return { dirtMat, stoneMat, sandMat, leafMat, coalMat, bedrockMat, cobblestoneMat, gravelMat, birchLeafMat, spruceLeafMat };
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

    // 신규 블록 타입별 InstancedMesh (Phase 4: 지형 텍스처 다양화)
    const coalMesh = new THREE.InstancedMesh(geo, materials.coalMat, MAX_INSTANCES.coal);
    coalMesh.count = 0;
    coalMesh.frustumCulled = false;

    const bedrockMesh = new THREE.InstancedMesh(geo, materials.bedrockMat, MAX_INSTANCES.bedrock);
    bedrockMesh.count = 0;
    bedrockMesh.frustumCulled = false;

    const cobblestoneMesh = new THREE.InstancedMesh(geo, materials.cobblestoneMat, MAX_INSTANCES.cobblestone);
    cobblestoneMesh.count = 0;
    cobblestoneMesh.frustumCulled = false;

    const gravelMesh = new THREE.InstancedMesh(geo, materials.gravelMat, MAX_INSTANCES.gravel);
    gravelMesh.count = 0;
    gravelMesh.frustumCulled = false;

    // v45: 자작나무/가문비나무 InstancedMesh
    const birchTreeMat = new THREE.MeshLambertMaterial({ map: loadBlockTexture(`${TEX_PATH}/birch_log.png`) });
    const birchTreeMesh = new THREE.InstancedMesh(geo, birchTreeMat, MAX_INSTANCES.birch_tree);
    birchTreeMesh.count = 0;
    birchTreeMesh.frustumCulled = false;

    const birchLeafMesh = new THREE.InstancedMesh(geo, materials.birchLeafMat, MAX_INSTANCES.birch_leaf);
    birchLeafMesh.count = 0;
    birchLeafMesh.frustumCulled = false;

    const spruceTreeMat = new THREE.MeshLambertMaterial({ map: loadBlockTexture(`${TEX_PATH}/spruce_log.png`) });
    const spruceTreeMesh = new THREE.InstancedMesh(geo, spruceTreeMat, MAX_INSTANCES.spruce_tree);
    spruceTreeMesh.count = 0;
    spruceTreeMesh.frustumCulled = false;

    const spruceLeafMesh = new THREE.InstancedMesh(geo, materials.spruceLeafMat, MAX_INSTANCES.spruce_leaf);
    spruceLeafMesh.count = 0;
    spruceLeafMesh.frustumCulled = false;

    // 잔디 상단 오버레이 — PlaneGeometry로 잔디 블록 위에 초록 텍스처 (Phase 4: 멀티페이스)
    const grassTopGeo = new THREE.PlaneGeometry(1, 1);
    grassTopGeo.rotateX(-Math.PI / 2); // XZ 평면으로 회전 (상단 면)
    const grassTopMat = new THREE.MeshLambertMaterial({
      map: loadBlockTexture(GRASS_VARIANT_TEXTURES[0]),
    });
    const grassTopMesh = new THREE.InstancedMesh(grassTopGeo, grassTopMat, MAX_INSTANCES.grass);
    grassTopMesh.count = 0;
    grassTopMesh.frustumCulled = false;

    // 잔디 변형 상단 오버레이 (dark, dry, lush) — V45 텍스처 다양화
    const grassTopVariants: THREE.InstancedMesh[] = [];
    for (let v = 1; v <= 3; v++) {
      const varGeo = new THREE.PlaneGeometry(1, 1);
      varGeo.rotateX(-Math.PI / 2);
      const varMat = new THREE.MeshLambertMaterial({
        map: loadBlockTexture(GRASS_VARIANT_TEXTURES[v]),
      });
      const varMesh = new THREE.InstancedMesh(varGeo, varMat, GRASS_VARIANT_MAX);
      varMesh.count = 0;
      varMesh.frustumCulled = false;
      grassTopVariants.push(varMesh);
    }

    // v45: 바닥 장식 오브젝트 (빌보드 PlaneGeometry)
    const decorationMeshes: Record<string, THREE.InstancedMesh> = {};
    for (const dtype of DECORATION_TYPES) {
      const decoGeo = new THREE.PlaneGeometry(0.8, 0.8);
      const decoTex = getDecorationTexture(dtype);
      const decoMat = new THREE.MeshLambertMaterial({
        map: decoTex,
        transparent: true,
        alphaTest: 0.1,
        side: THREE.DoubleSide,
      });
      const decoMesh = new THREE.InstancedMesh(decoGeo, decoMat, DECORATION_MAX_PER_TYPE);
      decoMesh.count = 0;
      decoMesh.frustumCulled = false;
      decorationMeshes[dtype] = decoMesh;
    }

    return {
      grassMesh, dirtMesh, stoneMesh, sandMesh, treeMesh, leafMesh,
      coalMesh, bedrockMesh, cobblestoneMesh, gravelMesh,
      birchTreeMesh, birchLeafMesh, spruceTreeMesh, spruceLeafMesh,
      grassTopMesh, grassTopVariants, decorationMeshes,
    };
  }, [materials]);

  // meshKey → InstancedMesh
  const meshMap: Record<string, THREE.InstancedMesh> = useMemo(() => ({
    grass: meshes.grassMesh,
    dirt: meshes.dirtMesh,
    stone: meshes.stoneMesh,
    coal: meshes.coalMesh,
    bedrock: meshes.bedrockMesh,
    cobblestone: meshes.cobblestoneMesh,
    gravel: meshes.gravelMesh,
    sand: meshes.sandMesh,
    tree: meshes.treeMesh,
    leaf: meshes.leafMesh,
    birch_tree: meshes.birchTreeMesh,
    birch_leaf: meshes.birchLeafMesh,
    spruce_tree: meshes.spruceTreeMesh,
    spruce_leaf: meshes.spruceLeafMesh,
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

    // InstancedMesh 목록 수집 (단일 + 배열 + record 포함)
    const allInstancedMeshes: THREE.InstancedMesh[] = [
      meshes.grassMesh, meshes.dirtMesh, meshes.stoneMesh, meshes.sandMesh,
      meshes.treeMesh, meshes.leafMesh, meshes.coalMesh, meshes.bedrockMesh,
      meshes.cobblestoneMesh, meshes.gravelMesh,
      meshes.birchTreeMesh, meshes.birchLeafMesh,
      meshes.spruceTreeMesh, meshes.spruceLeafMesh,
      meshes.grassTopMesh, ...meshes.grassTopVariants,
      ...Object.values(meshes.decorationMeshes),
    ];
    const allMeshes = [...allInstancedMeshes, cloudMesh];
    for (const m of allMeshes) group.add(m as THREE.Object3D);

    return () => {
      for (const m of allMeshes) group.remove(m as THREE.Object3D);
      allInstancedMeshes.forEach((m) => {
        m.geometry.dispose();
        const mat = m.material;
        if (Array.isArray(mat)) mat.forEach((mt: THREE.Material) => mt.dispose());
        else (mat as THREE.Material).dispose();
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

    // v45: 장식 오브젝트 생성 (전투 구역 밖, 잔디 블록 위)
    generateDecorations(key, noise, cx, cz);
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
      // leaf 타입은 항상 노출, 나머지는 체크
      const isLeafType = b.type === BlockType.leaf || b.type === BlockType.birch_leaf || b.type === BlockType.spruce_leaf;
      if (!isLeafType && !isExposed(bm, b.x, b.y, b.z)) continue;
      exposed.push({ meshKey: mk, x: b.x, y: b.y, z: b.z });
    }

    chunkExposedRef.current.set(key, exposed);
  }, []);

  // v45: 청크 내 장식 오브젝트 생성
  const generateDecorations = useCallback((key: string, noise: MCNoise, cx: number, cz: number) => {
    const decorations: DecorationData[] = [];
    const startX = cx * CHUNK_SIZE;
    const startZ = cz * CHUNK_SIZE;

    for (let lx = 0; lx < CHUNK_SIZE; lx += 2) {
      for (let lz = 0; lz < CHUNK_SIZE; lz += 2) {
        const x = startX + lx;
        const z = startZ + lz;

        // 전투 구역 내 억제
        if (noise.isInFlatZone(x, z)) continue;

        // 좌표 해시 기반 배치 확률 (약 15% 확률)
        const hash = ((x * 73856093) ^ (z * 19349663)) >>> 0;
        if ((hash % 100) >= 15) continue;

        const surfaceY = noise.getHeight(x, z);
        const biome = noise.getBiome(x, z);

        // 나무가 있는 위치 스킵 (tree offset 체크)
        const treeOffset = noise.getTreeOffset(x, z);
        if (treeOffset > noise.treeThreshold) continue;

        // 바이옴별 장식 타입 결정
        let decoType: DecorationType;
        const typeRoll = (hash >> 8) % 100;

        if (biome === Biome.PLAINS) {
          // PLAINS: 꽃 50%, 풀 50%
          if (typeRoll < 25) decoType = 'flower_red';
          else if (typeRoll < 50) decoType = 'flower_yellow';
          else decoType = 'tall_grass';
        } else if (biome === Biome.FOREST) {
          // FOREST: 버섯 30%, 풀 70%
          if (typeRoll < 30) decoType = 'mushroom_red';
          else decoType = 'tall_grass';
        } else {
          // DESERT: 장식 없음
          continue;
        }

        decorations.push({
          type: decoType,
          x,
          y: surfaceY + 1,
          z,
        });
      }
    }

    chunkDecorationsRef.current.set(key, decorations);
  }, []);

  // ============================================
  // InstancedMesh 리빌드 (cached exposed만 순회)
  // ============================================
  const rebuildInstances = useCallback(() => {
    if (!dirtyRef.current) return;
    dirtyRef.current = false;

    const counters: Record<string, number> = {
      grass: 0, dirt: 0, stone: 0,
      coal: 0, bedrock: 0, cobblestone: 0, gravel: 0,
      sand: 0, tree: 0, leaf: 0,
      birch_tree: 0, birch_leaf: 0, spruce_tree: 0, spruce_leaf: 0,
    };
    const matrix = new THREE.Matrix4();
    // 잔디 상단 오버레이 카운터 (variant 0=기본, 1=dark, 2=dry, 3=lush)
    let grassTopCount = 0;
    const variantCounts = [0, 0, 0]; // variant 1,2,3 카운터

    for (const exposed of chunkExposedRef.current.values()) {
      for (const eb of exposed) {
        const idx = counters[eb.meshKey];
        if (idx >= MAX_INSTANCES[eb.meshKey]) continue;

        matrix.makeTranslation(eb.x + 0.5, eb.y + 0.5, eb.z + 0.5);
        meshMap[eb.meshKey].setMatrixAt(idx, matrix);
        counters[eb.meshKey] = idx + 1;

        // 잔디 블록인 경우 상단 오버레이 추가 — 해시 기반 변형 선택
        if (eb.meshKey === 'grass') {
          const vi = getGrassVariantIndex(eb.x, eb.z);
          matrix.makeTranslation(eb.x + 0.5, eb.y + 1.001, eb.z + 0.5);

          if (vi === 0) {
            // 기본 잔디 상단
            if (grassTopCount < MAX_INSTANCES.grass) {
              meshes.grassTopMesh.setMatrixAt(grassTopCount, matrix);
              grassTopCount++;
            }
          } else {
            // 변형 잔디 상단 (vi=1→dark, 2→dry, 3→lush)
            const vIdx = vi - 1;
            if (variantCounts[vIdx] < GRASS_VARIANT_MAX) {
              meshes.grassTopVariants[vIdx].setMatrixAt(variantCounts[vIdx], matrix);
              variantCounts[vIdx]++;
            }
          }
        }
      }
    }

    // count + needsUpdate (블록 메쉬)
    for (const [key, mesh] of Object.entries(meshMap)) {
      mesh.count = counters[key];
      if (counters[key] > 0) mesh.instanceMatrix.needsUpdate = true;
    }

    // 잔디 상단 오버레이 업데이트 (기본 + 3 변형)
    meshes.grassTopMesh.count = grassTopCount;
    if (grassTopCount > 0) meshes.grassTopMesh.instanceMatrix.needsUpdate = true;

    for (let v = 0; v < 3; v++) {
      meshes.grassTopVariants[v].count = variantCounts[v];
      if (variantCounts[v] > 0) meshes.grassTopVariants[v].instanceMatrix.needsUpdate = true;
    }

    // v45: 장식 오브젝트 InstancedMesh 업데이트
    const decoCounts: Record<string, number> = {};
    for (const dtype of DECORATION_TYPES) decoCounts[dtype] = 0;

    for (const decos of chunkDecorationsRef.current.values()) {
      for (const d of decos) {
        const count = decoCounts[d.type] ?? 0;
        if (count >= DECORATION_MAX_PER_TYPE) continue;

        const decoMesh = meshes.decorationMeshes[d.type];
        if (!decoMesh) continue;

        // 빌보드: 약간 위로 올리고 수직 배치 (카메라가 위에서 보므로 45도 기울임)
        matrix.makeTranslation(d.x + 0.5, d.y + 0.3, d.z + 0.5);
        // PlaneGeometry는 XY 평면이므로 약간 기울여 위에서도 보이게
        const tiltMatrix = new THREE.Matrix4().makeRotationX(-Math.PI * 0.35);
        matrix.multiply(tiltMatrix);

        decoMesh.setMatrixAt(count, matrix);
        decoCounts[d.type] = count + 1;
      }
    }

    for (const dtype of DECORATION_TYPES) {
      const decoMesh = meshes.decorationMeshes[dtype];
      if (!decoMesh) continue;
      decoMesh.count = decoCounts[dtype] ?? 0;
      if (decoCounts[dtype] > 0) decoMesh.instanceMatrix.needsUpdate = true;
    }
  }, [meshMap, meshes]);

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
          chunkDecorationsRef.current.delete(k);
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
