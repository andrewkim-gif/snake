/**
 * rendering3d/terrain.ts — Chunked 3D 지형 시스템
 *
 * S07: Ground Plane Chunked Mesh (200x200 unit chunks)
 * S08: Biome Texture Atlas (canvas 기반 atlas 생성 + UV 매핑)
 * S09: Simplex Noise Biome 통합 (noise.ts + biomes.ts 재사용)
 *
 * 좌표 매핑: 2D(x,y) → 3D(x, 0, -y)
 * 각 chunk는 PlaneGeometry + biome 기반 vertex colors 사용
 * Merged Geometry로 chunk 내 타일 통합 (1 draw call per chunk)
 */

import * as THREE from 'three';
import { fbm2D, normalizeNoise, seededSimplex2D } from '../map/noise';
import { getBiomeAt, getStageMapConfig } from '../map/biomes';
import type { BiomeType, StageMapConfig } from '../map/types';
import { createTerrainTextures, type TerrainTheme } from '@/lib/3d/terrain-textures';

// ============================================
// Biome → Theme 매핑 (MC 텍스처 테마 동적 결정)
// ============================================

/**
 * BiomeType → TerrainTheme 매핑
 * grass→forest, stone→mountain, concrete→urban, special→island, void→arctic
 */
const BIOME_THEME_MAP: Record<BiomeType, TerrainTheme> = {
  grass: 'forest',
  stone: 'mountain',
  concrete: 'urban',
  special: 'island',
  void: 'arctic',
};

/**
 * biome에 해당하는 MC 텍스처 테마를 반환
 * @param biome BiomeType
 * @returns TerrainTheme (forest/desert/mountain/urban/arctic/island)
 */
export function getBiomeTheme(biome: BiomeType): TerrainTheme {
  return BIOME_THEME_MAP[biome] ?? 'forest';
}

// ============================================
// Constants
// ============================================

/** chunk 크기 (월드 단위) */
export const CHUNK_SIZE = 200;

/** chunk 내 타일 해상도 (한 축 기준 타일 수) — 높을수록 vertex color 해상도 증가 */
export const TILES_PER_CHUNK = 40;

/** 타일 1개의 월드 크기 */
export const TILE_SIZE = CHUNK_SIZE / TILES_PER_CHUNK;

/** 카메라 주변 렌더링할 chunk 반경 (chunk 수) */
export const CHUNK_RENDER_RADIUS = 4;

/** chunk 로드/언로드 여유 거리 (hysteresis) */
export const CHUNK_LOAD_MARGIN = 1;

/** 기본 시드 */
export const DEFAULT_SEED = 42;

// ============================================
// Biome Color Palette (3D용)
// ============================================

/** 바이옴별 3D 지면 색상 (vertex color용) — 밝고 선명한 팔레트 */
export const BIOME_GROUND_COLORS: Record<BiomeType, THREE.Color> = {
  grass: new THREE.Color('#5a9e50'),
  stone: new THREE.Color('#8a8a98'),
  concrete: new THREE.Color('#7a7a88'),
  special: new THREE.Color('#7a4aaa'),
  void: new THREE.Color('#1a3a1a'),
};

/** 바이옴별 보조 색상 (타일 변화용) */
export const BIOME_ACCENT_COLORS: Record<BiomeType, THREE.Color> = {
  grass: new THREE.Color('#6ab868'),
  stone: new THREE.Color('#9a9aaa'),
  concrete: new THREE.Color('#8888a0'),
  special: new THREE.Color('#9a6ac0'),
  void: new THREE.Color('#1a4a2a'),
};

// ============================================
// Atlas 텍스처 생성 (Canvas 기반)
// ============================================

/** atlas 내 biome 타일 크기 */
const ATLAS_TILE_SIZE = 64;
/** atlas 레이아웃: 7 biomes x 1 row */
const ATLAS_COLS = 7;

/** biome 순서 (atlas UV 인덱스) */
const BIOME_ORDER: BiomeType[] = ['grass', 'stone', 'concrete', 'special', 'void'];

/** biome → atlas 인덱스 매핑 */
export const BIOME_ATLAS_INDEX: Record<BiomeType, number> = {
  grass: 0,
  stone: 1,
  concrete: 2,
  special: 3,
  void: 4,
};

/**
 * Canvas 기반 biome atlas 텍스처 생성
 * 각 biome에 대해 procedural 패턴 생성
 */
export function createBiomeAtlasTexture(): THREE.CanvasTexture {
  const width = ATLAS_TILE_SIZE * ATLAS_COLS;
  const height = ATLAS_TILE_SIZE;

  // SSR 안전: document 없으면 빈 텍스처 반환
  if (typeof document === 'undefined') {
    return new THREE.CanvasTexture(new OffscreenCanvas(width, height));
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // 각 biome 타일 렌더링
  for (let i = 0; i < BIOME_ORDER.length; i++) {
    const biome = BIOME_ORDER[i];
    const x = i * ATLAS_TILE_SIZE;
    drawBiomeTile(ctx, x, 0, ATLAS_TILE_SIZE, biome);
  }

  // 나머지 슬롯(5,6)은 변형 타일
  drawBiomeTile(ctx, 5 * ATLAS_TILE_SIZE, 0, ATLAS_TILE_SIZE, 'grass', true);
  drawBiomeTile(ctx, 6 * ATLAS_TILE_SIZE, 0, ATLAS_TILE_SIZE, 'stone', true);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestMipMapLinearFilter;
  texture.colorSpace = THREE.SRGBColorSpace;

  return texture;
}

/**
 * 개별 biome 타일을 canvas에 그리기
 */
function drawBiomeTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  biome: BiomeType,
  variant: boolean = false
): void {
  const baseColor = BIOME_GROUND_COLORS[biome];
  const accentColor = BIOME_ACCENT_COLORS[biome];

  // 기본 색상 채우기
  const r = Math.floor(baseColor.r * 255);
  const g = Math.floor(baseColor.g * 255);
  const b = Math.floor(baseColor.b * 255);
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(x, y, size, size);

  // 텍스처 패턴 추가 (biome별 고유)
  const ar = Math.floor(accentColor.r * 255);
  const ag = Math.floor(accentColor.g * 255);
  const ab = Math.floor(accentColor.b * 255);

  switch (biome) {
    case 'grass': {
      // 풀 패턴: 작은 점들
      ctx.fillStyle = variant ? `rgba(${ar},${ag},${ab},0.4)` : `rgba(${ar},${ag},${ab},0.3)`;
      for (let i = 0; i < 20; i++) {
        const px = x + Math.random() * size;
        const py = y + Math.random() * size;
        ctx.fillRect(px, py, 2, 3);
      }
      break;
    }
    case 'stone': {
      // 돌 패턴: 불규칙 선
      ctx.strokeStyle = `rgba(${ar},${ag},${ab},0.3)`;
      ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(x + Math.random() * size, y + Math.random() * size);
        ctx.lineTo(x + Math.random() * size, y + Math.random() * size);
        ctx.stroke();
      }
      break;
    }
    case 'concrete': {
      // 콘크리트 패턴: 격자
      ctx.strokeStyle = `rgba(${ar},${ag},${ab},0.15)`;
      ctx.lineWidth = 1;
      const gridSize = size / 4;
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(x + i * gridSize, y);
        ctx.lineTo(x + i * gridSize, y + size);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y + i * gridSize);
        ctx.lineTo(x + size, y + i * gridSize);
        ctx.stroke();
      }
      break;
    }
    case 'special': {
      // 특수: 글로우 패턴
      ctx.fillStyle = `rgba(${ar},${ag},${ab},0.2)`;
      for (let i = 0; i < 8; i++) {
        const px = x + Math.random() * size;
        const py = y + Math.random() * size;
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'void': {
      // 매트릭스: 디지털 패턴
      ctx.fillStyle = `rgba(0,255,65,0.15)`;
      for (let i = 0; i < 10; i++) {
        const px = x + Math.random() * size;
        const py = y + Math.random() * size;
        ctx.fillRect(px, py, 1, 4);
      }
      break;
    }
  }
}

// ============================================
// Chunk 키 유틸
// ============================================

/** chunk 좌표로 키 생성 */
export function chunkKey(cx: number, cz: number): string {
  return `${cx},${cz}`;
}

/** 월드 좌표 → chunk 좌표 */
export function worldToChunk(worldX: number, worldZ: number): [number, number] {
  return [
    Math.floor(worldX / CHUNK_SIZE),
    Math.floor(worldZ / CHUNK_SIZE),
  ];
}

// ============================================
// Chunk Geometry 생성
// ============================================

/**
 * chunk에 대한 biome 기반 PlaneGeometry 생성
 * vertex color를 사용하여 타일별 biome 색상 적용
 *
 * @param chunkX chunk X 인덱스
 * @param chunkZ chunk Z 인덱스
 * @param stageId 현재 스테이지
 * @param gameMode 게임 모드
 * @param seed 노이즈 시드
 */
export function createChunkGeometry(
  chunkX: number,
  chunkZ: number,
  stageId: number = 1,
  gameMode: 'stage' | 'singularity' | 'tutorial' = 'stage',
  seed: number = DEFAULT_SEED
): THREE.PlaneGeometry {
  const mapConfig = getStageMapConfig(stageId, gameMode);
  const segments = TILES_PER_CHUNK;

  // PlaneGeometry: (width, height, widthSegments, heightSegments)
  const geometry = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, segments, segments);

  // XZ 평면으로 회전 (기본은 XY)
  geometry.rotateX(-Math.PI / 2);

  // 월드 좌표 오프셋 (chunk 중심)
  const offsetX = chunkX * CHUNK_SIZE;
  const offsetZ = chunkZ * CHUNK_SIZE;

  // vertex color 배열 생성
  const posAttr = geometry.getAttribute('position');
  const count = posAttr.count;
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    // vertex 월드 좌표 계산
    const vx = posAttr.getX(i) + offsetX + CHUNK_SIZE / 2;
    const vz = posAttr.getZ(i) + offsetZ + CHUNK_SIZE / 2;

    // 3D(x,z) → 2D(x,y): z → -y (부호 반전)
    const worldX2D = vx;
    const worldY2D = -vz;

    // biome 결정 (기존 noise.ts + biomes.ts 재사용)
    const biome = getBiomeAt(worldX2D, worldY2D, mapConfig, seed);

    // === 지형 높이 변형 (undulation) ===
    const heightNoise = normalizeNoise(
      fbm2D(vx, vz, 3, 0.5, 0.003, seed + 7777)
    );
    const biomeHeightScale: Record<BiomeType, number> = {
      grass: 1.5,
      stone: 0.8,
      concrete: 0.3,
      special: 1.0,
      void: 0.1,
    };
    const heightScale = biomeHeightScale[biome] ?? 1.0;
    const heightY = heightNoise * heightScale;
    posAttr.setY(i, heightY);

    // === MC 텍스처 + vertex color tint 모드 ===
    // MC ground 텍스처가 이미 색상을 가지고 있으므로,
    // vertex color는 흰색 기반에서 biome별 미세 tint + 밝기 변화만 담당
    // Three.js에서 map * vertexColor → multiply 블렌딩

    // 부드러운 밝기 변화 (세부 노이즈)
    const detailNoise = normalizeNoise(
      seededSimplex2D(vx * 0.05, vz * 0.05, seed + 1234)
    );

    // biome 전환 노이즈 (밝기 변화용)
    const blendNoise = normalizeNoise(
      fbm2D(worldX2D, worldY2D, 2, 0.5, mapConfig.noiseScale * 2, seed + 5678)
    );

    // biome별 미세 tint (흰색 기반 — 텍스처 색상 살리기)
    const biomeTint: Record<BiomeType, [number, number, number]> = {
      grass:    [0.9, 1.0, 0.9],   // 약간 녹색 tint
      stone:    [0.85, 0.85, 0.9], // 약간 청회색 tint
      concrete: [0.88, 0.88, 0.92], // 약간 밝은 회색 tint
      special:  [0.9, 0.85, 1.0],  // 약간 보라색 tint
      void:     [0.7, 0.85, 0.7],  // 어두운 녹색 tint
    };

    const tint = biomeTint[biome] ?? [1, 1, 1];

    // 밝기 변화 (0.85~1.05 범위)
    const brightness = 0.88 + blendNoise * 0.12 + detailNoise * 0.08 + heightNoise * 0.05;

    colors[i * 3]     = tint[0] * brightness;
    colors[i * 3 + 1] = tint[1] * brightness;
    colors[i * 3 + 2] = tint[2] * brightness;
  }

  // 높이 변경 후 normal 재계산 (조명이 올바르게 적용되도록)
  posAttr.needsUpdate = true;
  geometry.computeVertexNormals();

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  return geometry;
}

/**
 * MC 스타일 ground 텍스처를 chunk용으로 생성 (biome별 캐시)
 * terrain-textures.ts의 biome별 ground를 RepeatWrapping으로 타일링
 */
const _mcGroundTextureCache = new Map<TerrainTheme, THREE.CanvasTexture>();

/**
 * biome 테마별 MC ground 텍스처 반환 (캐시)
 */
function getMcGroundTexture(theme: TerrainTheme = 'forest'): THREE.CanvasTexture | null {
  const cached = _mcGroundTextureCache.get(theme);
  if (cached) return cached;
  if (typeof document === 'undefined') return null;
  const texSet = createTerrainTextures(theme);
  // ground 텍스처를 clone하여 chunk tiling용으로 설정
  const tex = texSet.ground.clone();
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  // chunk 200단위에서 TILE_SIZE(5)마다 텍스처 1번 반복 → 200/5 = 40 repeat
  tex.repeat.set(TILES_PER_CHUNK, TILES_PER_CHUNK);
  tex.needsUpdate = true;
  _mcGroundTextureCache.set(theme, tex);
  return tex;
}

/**
 * 모든 캐시된 MC ground 텍스처 해제 (메모리 정리)
 */
export function disposeMcGroundTextures(): void {
  for (const [, tex] of _mcGroundTextureCache) {
    tex.dispose();
  }
  _mcGroundTextureCache.clear();
}

/**
 * chunk 머티리얼 생성 — MC 스타일 텍스처 + vertex color tint
 * vertex color는 biome별 미세 색상 변화용 (multiply 블렌딩)
 *
 * @param theme biome 테마 (기본 'forest')
 */
export function createChunkMaterial(theme: TerrainTheme = 'forest'): THREE.MeshLambertMaterial {
  const tex = getMcGroundTexture(theme);
  return new THREE.MeshLambertMaterial({
    map: tex,
    vertexColors: true,
    side: THREE.FrontSide,
  });
}

/**
 * chunk 중심의 dominant biome 결정 (가장 빈번한 biome)
 * chunk 중앙 + 4 코너 샘플링으로 빠르게 판단
 */
export function getChunkDominantBiome(
  chunkX: number,
  chunkZ: number,
  stageId: number = 1,
  gameMode: 'stage' | 'singularity' | 'tutorial' = 'stage',
  seed: number = DEFAULT_SEED
): BiomeType {
  const mapConfig = getStageMapConfig(stageId, gameMode);
  const cx = chunkX * CHUNK_SIZE + CHUNK_SIZE / 2;
  const cz = chunkZ * CHUNK_SIZE + CHUNK_SIZE / 2;
  const half = CHUNK_SIZE / 2;

  // 5-포인트 샘플: 중앙 + 4 코너
  const samples: BiomeType[] = [
    getBiomeAt(cx, -cz, mapConfig, seed),
    getBiomeAt(cx - half, -(cz - half), mapConfig, seed),
    getBiomeAt(cx + half, -(cz - half), mapConfig, seed),
    getBiomeAt(cx - half, -(cz + half), mapConfig, seed),
    getBiomeAt(cx + half, -(cz + half), mapConfig, seed),
  ];

  // 가장 빈번한 biome 반환
  const counts: Partial<Record<BiomeType, number>> = {};
  let maxCount = 0;
  let dominant: BiomeType = samples[0];
  for (const s of samples) {
    counts[s] = (counts[s] ?? 0) + 1;
    if (counts[s]! > maxCount) {
      maxCount = counts[s]!;
      dominant = s;
    }
  }
  return dominant;
}

// ============================================
// Chunk Manager
// ============================================

export interface ChunkData {
  key: string;
  chunkX: number;
  chunkZ: number;
  mesh: THREE.Mesh;
  /** chunk의 dominant biome 테마 */
  theme: TerrainTheme;
}

/**
 * 플레이어 위치 기반 visible chunk 목록 계산
 * @param playerWorldX 플레이어 3D 월드 X
 * @param playerWorldZ 플레이어 3D 월드 Z
 * @param radius chunk 반경
 */
export function getVisibleChunkCoords(
  playerWorldX: number,
  playerWorldZ: number,
  radius: number = CHUNK_RENDER_RADIUS
): Array<[number, number]> {
  const [pcx, pcz] = worldToChunk(playerWorldX, playerWorldZ);
  const coords: Array<[number, number]> = [];

  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      coords.push([pcx + dx, pcz + dz]);
    }
  }

  return coords;
}

/**
 * 새로 생성할 chunk와 파괴할 chunk 계산
 */
export function diffChunks(
  currentKeys: Set<string>,
  targetCoords: Array<[number, number]>
): {
  toCreate: Array<[number, number]>;
  toDestroy: string[];
} {
  const targetKeys = new Set(targetCoords.map(([x, z]) => chunkKey(x, z)));

  // 새로 생성할 chunk
  const toCreate = targetCoords.filter(
    ([x, z]) => !currentKeys.has(chunkKey(x, z))
  );

  // 파괴할 chunk
  const toDestroy: string[] = [];
  currentKeys.forEach((key) => {
    if (!targetKeys.has(key)) {
      toDestroy.push(key);
    }
  });

  return { toCreate, toDestroy };
}

// ============================================
// Biome Blend (S09: 인접 biome 블렌딩)
// ============================================

/**
 * 특정 위치의 biome과 블렌드 가중치 반환
 * 인접 biome 간 부드러운 전환을 위한 블렌딩 값
 */
export function getBiomeBlendAt(
  worldX2D: number,
  worldY2D: number,
  config: StageMapConfig,
  seed: number
): { primary: BiomeType; secondary: BiomeType | null; blend: number } {
  const primary = getBiomeAt(worldX2D, worldY2D, config, seed);

  if (!config.secondaryBiome) {
    return { primary, secondary: null, blend: 0 };
  }

  // 주변 샘플링으로 경계 감지
  const sampleDist = TILE_SIZE * 2;
  const neighbors = [
    getBiomeAt(worldX2D + sampleDist, worldY2D, config, seed),
    getBiomeAt(worldX2D - sampleDist, worldY2D, config, seed),
    getBiomeAt(worldX2D, worldY2D + sampleDist, config, seed),
    getBiomeAt(worldX2D, worldY2D - sampleDist, config, seed),
  ];

  // 인접 중 다른 biome 찾기
  const otherBiome = neighbors.find((b) => b !== primary);
  if (!otherBiome) {
    return { primary, secondary: null, blend: 0 };
  }

  // 블렌드 값 계산 (경계 근처에서 0-1)
  const noise = normalizeNoise(
    fbm2D(worldX2D, worldY2D, 3, 0.5, config.noiseScale, seed)
  );
  // 0.5 근처에서 블렌드 (±0.1 범위)
  const dist = Math.abs(noise - 0.6);
  const blend = Math.max(0, 1 - dist / 0.15);

  return { primary, secondary: otherBiome, blend };
}

/**
 * 두 biome 색상을 블렌딩
 */
export function blendBiomeColors(
  biome1: BiomeType,
  biome2: BiomeType | null,
  blend: number
): THREE.Color {
  const color1 = BIOME_GROUND_COLORS[biome1];
  if (!biome2 || blend <= 0) return color1.clone();

  const color2 = BIOME_GROUND_COLORS[biome2];
  return color1.clone().lerp(color2, blend);
}

// ============================================
// 지형 높이 스케일 (biome별)
// ============================================

/** biome별 높이 스케일 (createChunkGeometry와 동일) */
const BIOME_HEIGHT_SCALES: Record<BiomeType, number> = {
  grass: 1.5,
  stone: 0.8,
  concrete: 0.3,
  special: 1.0,
  void: 0.1,
};

// ============================================
// 장식 블록 생성 (높이 경계/언덕에 BoxGeometry InstancedMesh)
// ============================================

/** 장식 블록 배치 정보 */
export interface DecoBlockData {
  x: number;
  y: number;
  z: number;
  isTop: boolean; // 최상단 블록 여부 (top 텍스처 적용)
}

/** 장식 오브젝트 배치 정보 (꽃/돌/잔디) */
export interface DecoObjectData {
  x: number;
  y: number;
  z: number;
  type: 'flower' | 'stone' | 'grass_tuft';
  colorIndex: number; // 색상 인덱스
}

/** biome별 장식 블록 밀도 (높이 임계값 이상에서만 생성) */
const DECO_HEIGHT_THRESHOLD: Record<BiomeType, number> = {
  grass: 0.8,
  stone: 0.4,
  concrete: 1.5,   // 거의 생성 안 함 (도시)
  special: 0.6,
  void: 1.2,
};

/** biome별 장식 블록 최대 높이 (블록 수) */
const DECO_MAX_BLOCK_HEIGHT: Record<BiomeType, number> = {
  grass: 3,
  stone: 4,
  concrete: 1,
  special: 2,
  void: 1,
};

/** biome별 장식 오브젝트 수 (청크당) */
const DECO_OBJECT_COUNTS: Record<BiomeType, { flower: number; stone: number; grass: number }> = {
  grass: { flower: 15, stone: 5, grass: 12 },
  stone: { flower: 3, stone: 10, grass: 2 },
  concrete: { flower: 2, stone: 3, grass: 0 },
  special: { flower: 8, stone: 4, grass: 5 },
  void: { flower: 0, stone: 2, grass: 0 },
};

/** 결정론적 의사 난수 (좌표 기반) */
function decoHash(x: number, z: number, seed: number): number {
  const n = Math.sin(x * 127.1 + z * 311.7 + seed * 43.3) * 43758.5453;
  return n - Math.floor(n);
}

/**
 * chunk에 대한 장식 블록 배치 데이터 생성
 * 높이 경계/언덕 영역에 50-100개 BoxGeometry 블록
 */
export function generateChunkDecoBlocks(
  chunkX: number,
  chunkZ: number,
  stageId: number = 1,
  gameMode: 'stage' | 'singularity' | 'tutorial' = 'stage',
  seed: number = DEFAULT_SEED
): DecoBlockData[] {
  const mapConfig = getStageMapConfig(stageId, gameMode);
  const blocks: DecoBlockData[] = [];
  const startX = chunkX * CHUNK_SIZE;
  const startZ = chunkZ * CHUNK_SIZE;

  // 블록 배치 간격 (TILE_SIZE의 2배 = 10 단위)
  const spacing = TILE_SIZE * 2;
  const maxBlocks = 80; // 청크당 최대 블록 수

  for (let dx = spacing / 2; dx < CHUNK_SIZE; dx += spacing) {
    for (let dz = spacing / 2; dz < CHUNK_SIZE; dz += spacing) {
      if (blocks.length >= maxBlocks) break;

      const wx = startX + dx;
      const wz = startZ + dz;
      const worldX2D = wx;
      const worldY2D = -wz;

      // biome 결정
      const biome = getBiomeAt(worldX2D, worldY2D, mapConfig, seed);

      // 높이 노이즈 계산
      const heightNoise = normalizeNoise(
        fbm2D(wx, wz, 3, 0.5, 0.003, seed + 7777)
      );
      const heightScale = BIOME_HEIGHT_SCALES[biome] ?? 1.0;
      const height = heightNoise * heightScale;

      // 높이 임계값 이상에서만 블록 생성
      const threshold = DECO_HEIGHT_THRESHOLD[biome];
      if (height < threshold) continue;

      // hash로 일부만 생성 (50-70% 확률)
      const h = decoHash(wx, wz, seed + 3333);
      if (h > 0.65) continue;

      // 블록 높이 결정 (1 ~ maxHeight)
      const maxHeight = DECO_MAX_BLOCK_HEIGHT[biome];
      const blockHeight = Math.max(1, Math.round(
        (height - threshold) / (heightScale - threshold + 0.01) * maxHeight
      ));
      const clampedHeight = Math.min(blockHeight, maxHeight);

      // 블록 스택 생성
      for (let layer = 0; layer < clampedHeight; layer++) {
        blocks.push({
          x: wx,
          y: layer + 0.5,   // Y = 블록 중심 (바닥 0 기준)
          z: wz,
          isTop: layer === clampedHeight - 1,
        });
      }
    }
    if (blocks.length >= maxBlocks) break;
  }

  return blocks;
}

/**
 * chunk에 대한 장식 오브젝트 배치 데이터 생성
 * 장식 블록 위 또는 평지에 꽃/돌/잔디 배치
 */
export function generateChunkDecoObjects(
  chunkX: number,
  chunkZ: number,
  decoBlocks: DecoBlockData[],
  stageId: number = 1,
  gameMode: 'stage' | 'singularity' | 'tutorial' = 'stage',
  seed: number = DEFAULT_SEED
): DecoObjectData[] {
  const mapConfig = getStageMapConfig(stageId, gameMode);
  const objects: DecoObjectData[] = [];
  const startX = chunkX * CHUNK_SIZE;
  const startZ = chunkZ * CHUNK_SIZE;

  // chunk 중심의 dominant biome
  const centerX2D = startX + CHUNK_SIZE / 2;
  const centerY2D = -(chunkZ * CHUNK_SIZE + CHUNK_SIZE / 2);
  const biome = getBiomeAt(centerX2D, centerY2D, mapConfig, seed);
  const counts = DECO_OBJECT_COUNTS[biome];

  // 최상단 블록 위치 맵 (key=x,z → maxY)
  const topBlockMap = new Map<string, number>();
  for (const b of decoBlocks) {
    if (b.isTop) {
      topBlockMap.set(`${b.x},${b.z}`, b.y + 0.5); // 블록 상단 Y
    }
  }

  // 각 타입별 오브젝트 배치
  const types: Array<{ type: DecoObjectData['type']; count: number }> = [
    { type: 'flower', count: counts.flower },
    { type: 'stone', count: counts.stone },
    { type: 'grass_tuft', count: counts.grass },
  ];

  for (const { type, count } of types) {
    for (let i = 0; i < count; i++) {
      const h1 = decoHash(i * 3.17 + startX, i * 7.31 + startZ, seed + (type === 'flower' ? 100 : type === 'stone' ? 200 : 300));
      const h2 = decoHash(i * 5.31 + startX, i * 9.13 + startZ, seed + (type === 'flower' ? 100 : type === 'stone' ? 200 : 300));

      const wx = startX + h1 * CHUNK_SIZE;
      const wz = startZ + h2 * CHUNK_SIZE;

      // 블록 위에 있는지 확인
      const blockKey = `${Math.round(wx / (TILE_SIZE * 2)) * (TILE_SIZE * 2) + TILE_SIZE},${Math.round(wz / (TILE_SIZE * 2)) * (TILE_SIZE * 2) + TILE_SIZE}`;
      const blockTopY = topBlockMap.get(blockKey);

      // Y 위치: 블록 위 또는 지면
      const baseY = blockTopY ?? normalizeNoise(
        fbm2D(wx, wz, 3, 0.5, 0.003, seed + 7777)
      ) * (BIOME_HEIGHT_SCALES[biome] ?? 1.0);

      const yOffset = type === 'flower' ? 0.15 : type === 'stone' ? 0.12 : 0.2;
      const colorIndex = Math.floor(decoHash(i * 11.7, wx + wz, seed + 400) * 4);

      objects.push({
        x: wx,
        y: baseY + yOffset,
        z: wz,
        type,
        colorIndex,
      });
    }
  }

  return objects;
}

// ============================================
// 지형 높이 샘플링 (엔티티 Y 좌표 동기화용)
// ============================================

/**
 * 장식 블록 높이 캐시 (chunk별)
 * key: "chunkX,chunkZ" → Map<"blockX,blockZ" → blockTopY>
 */
const _decoBlockHeightCache = new Map<string, Map<string, number>>();

/**
 * 장식 블록 높이 캐시 등록
 */
export function registerDecoBlockHeights(
  chunkKey: string,
  blocks: DecoBlockData[]
): void {
  const blockMap = new Map<string, number>();
  for (const b of blocks) {
    const key = `${Math.floor(b.x)},${Math.floor(b.z)}`;
    const existing = blockMap.get(key) ?? 0;
    if (b.y + 0.5 > existing) {
      blockMap.set(key, b.y + 0.5);
    }
  }
  _decoBlockHeightCache.set(chunkKey, blockMap);
}

/**
 * 장식 블록 높이 캐시 해제
 */
export function unregisterDecoBlockHeights(chunkKey: string): void {
  _decoBlockHeightCache.delete(chunkKey);
}

/**
 * 3D 월드 좌표의 지형 높이를 반환
 * 장식 블록 영역은 이산 높이 반환, 평지는 기존 연속 높이 유지
 *
 * @param worldX 3D X 좌표
 * @param worldZ 3D Z 좌표
 * @param stageId 스테이지 ID
 * @param gameMode 게임 모드
 * @param seed 노이즈 시드
 * @returns Y 높이값
 */
export function getTerrainHeight(
  worldX: number,
  worldZ: number,
  stageId: number = 1,
  gameMode: 'stage' | 'singularity' | 'tutorial' = 'stage',
  seed: number = DEFAULT_SEED
): number {
  // 장식 블록 높이 캐시 확인 (이산 높이)
  const [cx, cz] = worldToChunk(worldX, worldZ);
  const cacheKey = chunkKey(cx, cz);
  const blockCache = _decoBlockHeightCache.get(cacheKey);
  if (blockCache) {
    const blockKey = `${Math.floor(worldX)},${Math.floor(worldZ)}`;
    const blockHeight = blockCache.get(blockKey);
    if (blockHeight !== undefined) {
      return blockHeight;
    }
  }

  // 연속 높이 (기존 로직)
  const mapConfig = getStageMapConfig(stageId, gameMode);
  const worldX2D = worldX;
  const worldY2D = -worldZ;
  const biome = getBiomeAt(worldX2D, worldY2D, mapConfig, seed);
  const heightScale = BIOME_HEIGHT_SCALES[biome] ?? 1.0;
  const heightNoise = normalizeNoise(
    fbm2D(worldX, worldZ, 3, 0.5, 0.003, seed + 7777)
  );
  return heightNoise * heightScale;
}
