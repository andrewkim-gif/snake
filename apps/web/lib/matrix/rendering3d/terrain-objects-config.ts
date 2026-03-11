/**
 * rendering3d/terrain-objects-config.ts — 3D Terrain Object Templates
 *
 * S10: Terrain Object .glb Templates (Placeholder)
 * MagicaVoxel .glb 에셋이 아직 없으므로, Three.js BoxGeometry 기반 placeholder prop 생성
 * 7 terrain type x 3-5 variations = programmatic 생성
 *
 * Asset registry config: terrain type → prop 정의 매핑
 */

import * as THREE from 'three';
import type { BiomeType, MapObjectType } from '../map/types';

// ============================================
// Terrain Prop Definition
// ============================================

export interface TerrainPropDef {
  /** 고유 ID */
  id: string;
  /** 연결된 biome */
  biome: BiomeType;
  /** 기본 색상 */
  color: string;
  /** 보조 색상 (선택) */
  accentColor?: string;
  /** 크기 (width, height, depth) 월드 단위 */
  size: [number, number, number];
  /** 지면 위 Y offset */
  yOffset: number;
  /** 출현 가중치 (높을수록 자주) */
  weight: number;
  /** prop 구성 부품 (복합 오브젝트용) */
  parts?: TerrainPropPart[];
}

export interface TerrainPropPart {
  /** 부모 기준 상대 위치 */
  position: [number, number, number];
  /** 크기 (width, height, depth) */
  size: [number, number, number];
  /** 색상 */
  color: string;
  /** 회전 (라디안, [x, y, z]) */
  rotation?: [number, number, number];
}

// ============================================
// Asset Registry: Biome → Props 매핑
// ============================================

/**
 * biome별 terrain prop 정의 목록
 * 각 biome에 3-5개의 변형(variation) prop
 */
export const TERRAIN_PROP_REGISTRY: Record<BiomeType, TerrainPropDef[]> = {
  // === Grass Biome (초원) ===
  grass: [
    {
      id: 'tree_small',
      biome: 'grass',
      color: '#2d5a27',
      accentColor: '#8b4513',
      size: [3, 8, 3],
      yOffset: 4,
      weight: 3,
      parts: [
        // 줄기
        { position: [0, 0, 0], size: [1.2, 5, 1.2], color: '#8b4513' },
        // 나뭇잎 (큰 큐브)
        { position: [0, 4, 0], size: [4, 4, 4], color: '#2d5a27' },
        // 나뭇잎 (작은 큐브, 위)
        { position: [0, 6, 0], size: [2.5, 2.5, 2.5], color: '#3a7a34' },
      ],
    },
    {
      id: 'tree_large',
      biome: 'grass',
      color: '#1a4a1a',
      accentColor: '#6b3410',
      size: [5, 12, 5],
      yOffset: 6,
      weight: 1,
      parts: [
        // 줄기
        { position: [0, 0, 0], size: [1.8, 7, 1.8], color: '#6b3410' },
        // 나뭇잎 (큰 구체 대용 큐브)
        { position: [0, 5, 0], size: [6, 5, 6], color: '#1a4a1a' },
        { position: [0, 8, 0], size: [4, 3.5, 4], color: '#2a5a24' },
        { position: [0, 10, 0], size: [2, 2, 2], color: '#3a7a34' },
      ],
    },
    {
      id: 'bush',
      biome: 'grass',
      color: '#3a6a30',
      size: [3, 2, 3],
      yOffset: 1,
      weight: 4,
      parts: [
        { position: [0, 0, 0], size: [3, 2.5, 3], color: '#3a6a30' },
        { position: [0.8, 0.5, 0.8], size: [1.5, 1.5, 1.5], color: '#4a8a40' },
      ],
    },
    {
      id: 'rock_small_grass',
      biome: 'grass',
      color: '#7a7a7a',
      size: [2, 1.5, 2],
      yOffset: 0.75,
      weight: 3,
      parts: [
        { position: [0, 0, 0], size: [2.5, 1.5, 2], color: '#7a7a7a' },
        { position: [0.5, 0.5, 0], size: [1, 1, 1.5], color: '#8a8a8a' },
      ],
    },
    {
      id: 'flower_patch',
      biome: 'grass',
      color: '#e04080',
      size: [2, 1, 2],
      yOffset: 0.5,
      weight: 2,
      parts: [
        { position: [0, 0, 0], size: [0.5, 1.2, 0.5], color: '#4a8a40' },
        { position: [0, 0.8, 0], size: [0.8, 0.8, 0.8], color: '#e04080' },
        { position: [1, 0, 0.5], size: [0.5, 1, 0.5], color: '#4a8a40' },
        { position: [1, 0.7, 0.5], size: [0.7, 0.7, 0.7], color: '#ffa040' },
        { position: [-0.5, 0, -0.5], size: [0.5, 0.9, 0.5], color: '#4a8a40' },
        { position: [-0.5, 0.6, -0.5], size: [0.7, 0.7, 0.7], color: '#8040e0' },
      ],
    },
  ],

  // === Stone Biome (돌/바위) ===
  stone: [
    {
      id: 'rock_medium',
      biome: 'stone',
      color: '#6a6a72',
      size: [4, 3, 3],
      yOffset: 1.5,
      weight: 3,
      parts: [
        { position: [0, 0, 0], size: [4, 3, 3.5], color: '#6a6a72' },
        { position: [1, 1.5, 0], size: [2, 1.5, 2], color: '#7a7a82' },
      ],
    },
    {
      id: 'rock_small_stone',
      biome: 'stone',
      color: '#5a5a62',
      size: [2, 1.5, 2],
      yOffset: 0.75,
      weight: 4,
    },
    {
      id: 'crate_stone',
      biome: 'stone',
      color: '#8a7050',
      accentColor: '#6a5030',
      size: [2, 2, 2],
      yOffset: 1,
      weight: 2,
      parts: [
        { position: [0, 0, 0], size: [2.2, 2.2, 2.2], color: '#8a7050' },
        // 나무 프레임
        { position: [0, 0, -1.1], size: [2.2, 0.3, 0.15], color: '#6a5030' },
        { position: [0, 0, 1.1], size: [2.2, 0.3, 0.15], color: '#6a5030' },
      ],
    },
    {
      id: 'stone_pillar',
      biome: 'stone',
      color: '#5a5a68',
      size: [1.5, 6, 1.5],
      yOffset: 3,
      weight: 1,
      parts: [
        { position: [0, 0, 0], size: [2, 5, 2], color: '#5a5a68' },
        { position: [0, 2.5, 0], size: [2.5, 0.5, 2.5], color: '#6a6a78' },
        { position: [0, -2.5, 0], size: [2.5, 0.5, 2.5], color: '#6a6a78' },
      ],
    },
  ],

  // === Concrete Biome (도시/콘크리트) ===
  concrete: [
    {
      id: 'barrel',
      biome: 'concrete',
      color: '#4a6a4a',
      size: [1.5, 2.5, 1.5],
      yOffset: 1.25,
      weight: 3,
      parts: [
        { position: [0, 0, 0], size: [1.8, 2.5, 1.8], color: '#4a6a4a' },
        // 띠
        { position: [0, 0.8, 0], size: [1.9, 0.2, 1.9], color: '#3a5a3a' },
        { position: [0, -0.8, 0], size: [1.9, 0.2, 1.9], color: '#3a5a3a' },
      ],
    },
    {
      id: 'trash_bin',
      biome: 'concrete',
      color: '#505058',
      size: [1.2, 2, 1.2],
      yOffset: 1,
      weight: 2,
      parts: [
        { position: [0, 0, 0], size: [1.4, 2, 1.4], color: '#505058' },
        { position: [0, 1, 0], size: [1.5, 0.15, 1.5], color: '#404048' },
      ],
    },
    {
      id: 'cone',
      biome: 'concrete',
      color: '#e07020',
      size: [1, 2, 1],
      yOffset: 1,
      weight: 3,
      parts: [
        // 원뿔 대용: 작은 큐브 스택
        { position: [0, -0.8, 0], size: [1.2, 0.4, 1.2], color: '#e07020' },
        { position: [0, -0.3, 0], size: [0.9, 0.6, 0.9], color: '#e07020' },
        { position: [0, 0.3, 0], size: [0.6, 0.6, 0.6], color: '#e07020' },
        { position: [0, 0.8, 0], size: [0.3, 0.4, 0.3], color: '#f09040' },
      ],
    },
    {
      id: 'bench',
      biome: 'concrete',
      color: '#8a6a40',
      size: [4, 1.5, 1.5],
      yOffset: 0.75,
      weight: 1,
      parts: [
        // 좌석
        { position: [0, 0, 0], size: [4, 0.3, 1.5], color: '#8a6a40' },
        // 다리
        { position: [-1.5, -0.5, 0], size: [0.3, 1, 0.3], color: '#505058' },
        { position: [1.5, -0.5, 0], size: [0.3, 1, 0.3], color: '#505058' },
        // 등받이
        { position: [0, 0.8, -0.6], size: [4, 1.2, 0.2], color: '#8a6a40' },
      ],
    },
    {
      id: 'lamp_post',
      biome: 'concrete',
      color: '#404048',
      size: [0.5, 8, 0.5],
      yOffset: 4,
      weight: 1,
      parts: [
        // 기둥
        { position: [0, 0, 0], size: [0.4, 7, 0.4], color: '#404048' },
        // 등
        { position: [0, 3.8, 0], size: [1.2, 0.8, 1.2], color: '#ffd700' },
      ],
    },
  ],

  // === Special Biome (특수 지형) ===
  special: [
    {
      id: 'crystal',
      biome: 'special',
      color: '#8040c0',
      size: [1.5, 4, 1.5],
      yOffset: 2,
      weight: 3,
      parts: [
        { position: [0, 0, 0], size: [1.5, 4, 1.5], color: '#8040c0',
          rotation: [0, 0.3, 0.1] },
        { position: [0.8, -0.5, 0.3], size: [0.8, 2.5, 0.8], color: '#9050d0',
          rotation: [0.1, -0.2, 0.15] },
      ],
    },
    {
      id: 'rune_stone',
      biome: 'special',
      color: '#3a2a5a',
      size: [2.5, 3, 1],
      yOffset: 1.5,
      weight: 2,
      parts: [
        { position: [0, 0, 0], size: [2.5, 3, 1], color: '#3a2a5a' },
        // 룬 문양 (밝은 선)
        { position: [0, 0, 0.5], size: [1.5, 0.15, 0.1], color: '#a070e0' },
        { position: [0, 0.8, 0.5], size: [0.15, 1.5, 0.1], color: '#a070e0' },
      ],
    },
    {
      id: 'energy_pillar',
      biome: 'special',
      color: '#6030a0',
      size: [1, 6, 1],
      yOffset: 3,
      weight: 1,
      parts: [
        { position: [0, 0, 0], size: [1.2, 6, 1.2], color: '#6030a0' },
        { position: [0, 3, 0], size: [0.6, 0.6, 0.6], color: '#c080ff' },
      ],
    },
  ],

  // === Void Biome (Matrix/Singularity) ===
  void: [
    {
      id: 'data_node',
      biome: 'void',
      color: '#003310',
      size: [1.5, 1.5, 1.5],
      yOffset: 0.75,
      weight: 3,
      parts: [
        { position: [0, 0, 0], size: [1.5, 1.5, 1.5], color: '#003310' },
        // 글로우 코어
        { position: [0, 0, 0], size: [0.5, 0.5, 0.5], color: '#00ff41' },
      ],
    },
    {
      id: 'matrix_pillar',
      biome: 'void',
      color: '#001a08',
      size: [1, 8, 1],
      yOffset: 4,
      weight: 1,
      parts: [
        { position: [0, 0, 0], size: [1, 8, 1], color: '#001a08' },
        // 디지털 라인
        { position: [0.5, 1, 0], size: [0.08, 2, 0.08], color: '#00ff41' },
        { position: [-0.3, -1, 0.4], size: [0.08, 1.5, 0.08], color: '#00cc33' },
      ],
    },
    {
      id: 'glitch_cube',
      biome: 'void',
      color: '#002210',
      size: [2, 2, 2],
      yOffset: 1,
      weight: 2,
      parts: [
        { position: [0, 0, 0], size: [2, 2, 2], color: '#002210' },
        // 글리치 효과 (offset된 작은 큐브)
        { position: [0.3, 0.3, 0.3], size: [0.8, 0.8, 0.8], color: '#00ff41' },
      ],
    },
    {
      id: 'corrupted_terminal',
      biome: 'void',
      color: '#0a1a0a',
      size: [2, 3, 1],
      yOffset: 1.5,
      weight: 2,
      parts: [
        // 본체
        { position: [0, 0, 0], size: [2, 2.5, 0.8], color: '#0a1a0a' },
        // 스크린
        { position: [0, 0.5, 0.4], size: [1.5, 1.2, 0.1], color: '#003310' },
        // 스크린 글로우
        { position: [0, 0.5, 0.45], size: [1, 0.6, 0.05], color: '#00ff41' },
      ],
    },
  ],
};

// ============================================
// Prop Geometry 생성 유틸
// ============================================

/**
 * TerrainPropDef에서 Three.js BufferGeometry 생성
 * 복합 오브젝트는 여러 BoxGeometry를 merge
 */
export function createPropGeometry(def: TerrainPropDef): THREE.BufferGeometry {
  if (!def.parts || def.parts.length === 0) {
    // 단일 박스
    return new THREE.BoxGeometry(def.size[0], def.size[1], def.size[2]);
  }

  // 복합: merge geometries
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.MeshStandardMaterial[] = [];

  for (const part of def.parts) {
    const box = new THREE.BoxGeometry(part.size[0], part.size[1], part.size[2]);

    // 위치 적용
    const matrix = new THREE.Matrix4();
    if (part.rotation) {
      const euler = new THREE.Euler(part.rotation[0], part.rotation[1], part.rotation[2]);
      matrix.makeRotationFromEuler(euler);
    }
    matrix.setPosition(part.position[0], part.position[1], part.position[2]);
    box.applyMatrix4(matrix);

    // vertex color 설정 (merge 시 색상 유지를 위해)
    const color = new THREE.Color(part.color);
    const colors = new Float32Array(box.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) {
      colors[i] = color.r;
      colors[i + 1] = color.g;
      colors[i + 2] = color.b;
    }
    box.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    geometries.push(box);
  }

  // merge all geometries
  const merged = mergeGeometries(geometries);

  // cleanup individual geometries
  for (const g of geometries) {
    g.dispose();
  }

  return merged;
}

/**
 * 여러 BufferGeometry를 하나로 병합
 * (간단한 merge 구현 — drei의 mergeBufferGeometries 대체)
 */
function mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  if (geometries.length === 0) return new THREE.BufferGeometry();
  if (geometries.length === 1) return geometries[0].clone();

  let totalVerts = 0;
  let totalIndices = 0;

  for (const g of geometries) {
    totalVerts += g.attributes.position.count;
    totalIndices += g.index ? g.index.count : g.attributes.position.count;
  }

  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const colors = new Float32Array(totalVerts * 3);
  const indices: number[] = [];

  let vertOffset = 0;
  let idxOffset = 0;

  for (const g of geometries) {
    const pos = g.attributes.position;
    const norm = g.attributes.normal;
    const col = g.attributes.color;

    for (let i = 0; i < pos.count; i++) {
      const idx = (vertOffset + i) * 3;
      positions[idx] = pos.getX(i);
      positions[idx + 1] = pos.getY(i);
      positions[idx + 2] = pos.getZ(i);

      if (norm) {
        normals[idx] = norm.getX(i);
        normals[idx + 1] = norm.getY(i);
        normals[idx + 2] = norm.getZ(i);
      }

      if (col) {
        colors[idx] = col.getX(i);
        colors[idx + 1] = col.getY(i);
        colors[idx + 2] = col.getZ(i);
      } else {
        colors[idx] = 0.5;
        colors[idx + 1] = 0.5;
        colors[idx + 2] = 0.5;
      }
    }

    if (g.index) {
      for (let i = 0; i < g.index.count; i++) {
        indices.push(g.index.getX(i) + vertOffset);
      }
    } else {
      for (let i = 0; i < pos.count; i++) {
        indices.push(vertOffset + i);
      }
    }

    vertOffset += pos.count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  merged.setIndex(indices);
  merged.computeVertexNormals();

  return merged;
}

/**
 * Prop 머티리얼 생성 (vertex color + emissive 지원)
 */
export function createPropMaterial(emissive?: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.75,
    metalness: 0.1,
    ...(emissive ? { emissive: new THREE.Color(emissive), emissiveIntensity: 0.3 } : {}),
  });
}

/**
 * biome에 속하는 모든 prop 타입의 고유 ID 목록 반환
 */
export function getPropIdsForBiome(biome: BiomeType): string[] {
  const props = TERRAIN_PROP_REGISTRY[biome];
  if (!props) return [];
  return props.map((p) => p.id);
}

/**
 * ID로 prop 정의 검색
 */
export function getPropDefById(id: string): TerrainPropDef | undefined {
  for (const biome of Object.values(TERRAIN_PROP_REGISTRY)) {
    const found = biome.find((p) => p.id === id);
    if (found) return found;
  }
  return undefined;
}

/**
 * biome의 가중치 기반 랜덤 prop 선택
 */
export function selectRandomProp(biome: BiomeType, hash: number): TerrainPropDef | null {
  const props = TERRAIN_PROP_REGISTRY[biome];
  if (!props || props.length === 0) return null;

  const totalWeight = props.reduce((sum, p) => sum + p.weight, 0);
  let target = (hash * totalWeight) % totalWeight;

  for (const prop of props) {
    target -= prop.weight;
    if (target <= 0) return prop;
  }

  return props[0];
}
