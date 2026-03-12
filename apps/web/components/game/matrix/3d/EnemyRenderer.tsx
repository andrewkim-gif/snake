'use client';

/**
 * EnemyRenderer.tsx — InstancedMesh 기반 적 3D 렌더러 (S22, S23, S24)
 *
 * - Template별 InstancedMesh 생성 (같은 base body → 1 draw call)
 * - useFrame에서 enemiesRef → InstancedMesh matrix 업데이트
 * - setMatrixAt(index, matrix) + setColorAt(index, color)
 * - Visible count 관리 (count = active enemies of this template)
 * - LOD 3-Tier: HIGH(<800px), MID(800-1400px), LOW(>1400px)
 * - EnemyRenderStrategy 인터페이스 (S23: 향후 BatchedMesh 전환 준비)
 *
 * 좌표 매핑: 2D(x,y) → 3D(x, 0, -y)
 * useFrame priority=0 필수
 */

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Enemy } from '@/lib/matrix/types';
import {
  type EnemyTemplateId,
  getAllTemplateIds,
  getTemplateIdForEnemy,
  getTemplateParts,
  disposeAllTemplates,
} from '@/lib/matrix/rendering3d/enemy-templates';
import { getMCTerrainHeight } from '@/lib/matrix/rendering3d/mc-terrain-height';
import {
  getEnemyColors,
  markColorNeedsUpdate,
} from '@/lib/matrix/rendering3d/enemy-colors';

// ============================================
// S23: EnemyRenderStrategy 인터페이스
// ============================================

/**
 * 적 렌더링 전략 인터페이스 (InstancedMesh / BatchedMesh 교체 가능)
 *
 * 현재는 InstancedMeshStrategy만 구현.
 * BatchedMesh가 안정화되면 BatchedMeshStrategy로 교체 가능.
 */
export interface IEnemyRenderStrategy {
  /** 전략 이름 */
  readonly name: string;
  /** 초기화 (scene에 mesh 추가) */
  init(scene: THREE.Scene): void;
  /** 매 프레임 업데이트 */
  update(enemies: Enemy[], cameraPosition: THREE.Vector3, totalCount: number): void;
  /** 정리 (geometry, material, mesh dispose) */
  dispose(): void;
}

// ============================================
// Constants
// ============================================

/** template별 최대 instance 수 */
const MAX_INSTANCES_PER_TEMPLATE = 120;

/** LOD 거리 임계값 (MC 블록 스케일) */
const LOD_THRESHOLDS = {
  HIGH: 30,
  MID: 60,
  CULL: 100,
} as const;

/** LOD 레벨 */
type LODLevel = 'HIGH' | 'MID' | 'LOW' | 'CULL';

/** LOW LOD용 단일 큐브 크기 */
const LOW_LOD_CUBE_SIZE = 1.0;

/** 적응형 LOD: 적 수 임계값 */
const ADAPTIVE_LOD_THRESHOLD = 150;

/** 적 position LERP 속도 (delta-time 기반, 높으면 즉시 추적) */
const ENEMY_LERP_SPEED = 25;

/** 적 기본 스케일 (MC 블록 스케일: 1 block = 1 unit) */
const ENEMY_BASE_SCALE = 1.0;

/** 보스 추가 스케일 */
const BOSS_EXTRA_SCALE = 1.5;

/** 적별 보간된 3D 위치를 캐시 (id → {x, z}) */
interface SmoothedPos { x: number; z: number; }
const _smoothedPositions = new Map<string, SmoothedPos>();

// ============================================
// 재사용 임시 객체 (GC 방지)
// ============================================

const _tempMatrix = new THREE.Matrix4();
const _tempPosition = new THREE.Vector3();
const _tempQuaternion = new THREE.Quaternion();
const _tempScale = new THREE.Vector3();
const _tempColor = new THREE.Color();
const _Y_AXIS = new THREE.Vector3(0, 1, 0);
const _WHITE_COLOR = new THREE.Color(0xffffff); // v39: hit flash 블렌드 대상

// ============================================
// Template Pool
// ============================================

/** template별 InstancedMesh pool */
interface TemplatePool {
  templateId: EnemyTemplateId;
  /** body (merged geometry) InstancedMesh — HIGH/MID LOD */
  mesh: THREE.InstancedMesh;
  /** body material */
  material: THREE.MeshStandardMaterial;
  /** merged geometry (head+body+limbs 결합) */
  geometry: THREE.BufferGeometry;
  /** 현재 활성 instance 수 */
  activeCount: number;
}

/** LOW LOD용 단일 큐브 pool */
interface LowLodPool {
  mesh: THREE.InstancedMesh;
  material: THREE.MeshStandardMaterial;
  geometry: THREE.BoxGeometry;
  activeCount: number;
}

// ============================================
// Merged Geometry 생성 유틸
// ============================================

/**
 * template의 모든 파트를 단일 BufferGeometry로 병합
 * (InstancedMesh에서는 geometry 1개만 사용 가능하므로)
 */
function createMergedGeometry(templateId: EnemyTemplateId): THREE.BufferGeometry {
  const parts = getTemplateParts(templateId);
  const geometries: THREE.BufferGeometry[] = [];
  const matrices: THREE.Matrix4[] = [];

  // head
  geometries.push(parts.head.geometry);
  matrices.push(new THREE.Matrix4().makeTranslation(
    parts.head.position.x, parts.head.position.y, parts.head.position.z
  ));

  // body
  if (parts.body) {
    geometries.push(parts.body.geometry);
    matrices.push(new THREE.Matrix4().makeTranslation(
      parts.body.position.x, parts.body.position.y, parts.body.position.z
    ));
  }

  // legs
  for (const leg of parts.legs) {
    geometries.push(leg.geometry);
    matrices.push(new THREE.Matrix4().makeTranslation(
      leg.position.x, leg.position.y, leg.position.z
    ));
  }

  // arms
  for (const arm of parts.arms) {
    geometries.push(arm.geometry);
    matrices.push(new THREE.Matrix4().makeTranslation(
      arm.position.x, arm.position.y, arm.position.z
    ));
  }

  // wings
  for (const wing of parts.wings) {
    geometries.push(wing.geometry);
    matrices.push(new THREE.Matrix4().makeTranslation(
      wing.position.x, wing.position.y, wing.position.z
    ));
  }

  // geometry를 로컬 변환 적용 후 복제
  const transformedGeometries = geometries.map((geo, i) => {
    const cloned = geo.clone();
    cloned.applyMatrix4(matrices[i]);
    return cloned;
  });

  // mergeBufferGeometries (수동 구현 — three.js r160+ 호환)
  const merged = mergeGeometries(transformedGeometries);

  // 복제된 geometry 정리
  transformedGeometries.forEach(g => g.dispose());

  return merged;
}

/**
 * 여러 BufferGeometry를 하나로 병합 (mergeBufferGeometries 대체)
 */
function mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  if (geometries.length === 0) {
    return new THREE.BufferGeometry();
  }
  if (geometries.length === 1) {
    return geometries[0].clone();
  }

  // 총 vertex/index 수 계산
  let totalVertices = 0;
  let totalIndices = 0;

  for (const geo of geometries) {
    const posAttr = geo.getAttribute('position');
    if (posAttr) totalVertices += posAttr.count;
    if (geo.index) totalIndices += geo.index.count;
    else if (posAttr) totalIndices += posAttr.count; // non-indexed
  }

  const positions = new Float32Array(totalVertices * 3);
  const normals = new Float32Array(totalVertices * 3);
  const indices = new Uint16Array(totalIndices);

  let vertexOffset = 0;
  let indexOffset = 0;

  for (const geo of geometries) {
    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
    const normAttr = geo.getAttribute('normal') as THREE.BufferAttribute;

    if (!posAttr) continue;

    // positions
    for (let i = 0; i < posAttr.count; i++) {
      positions[(vertexOffset + i) * 3] = posAttr.getX(i);
      positions[(vertexOffset + i) * 3 + 1] = posAttr.getY(i);
      positions[(vertexOffset + i) * 3 + 2] = posAttr.getZ(i);
    }

    // normals
    if (normAttr) {
      for (let i = 0; i < normAttr.count; i++) {
        normals[(vertexOffset + i) * 3] = normAttr.getX(i);
        normals[(vertexOffset + i) * 3 + 1] = normAttr.getY(i);
        normals[(vertexOffset + i) * 3 + 2] = normAttr.getZ(i);
      }
    }

    // indices
    if (geo.index) {
      for (let i = 0; i < geo.index.count; i++) {
        indices[indexOffset + i] = geo.index.getX(i) + vertexOffset;
      }
      indexOffset += geo.index.count;
    } else {
      // non-indexed → sequential indices
      for (let i = 0; i < posAttr.count; i++) {
        indices[indexOffset + i] = vertexOffset + i;
      }
      indexOffset += posAttr.count;
    }

    vertexOffset += posAttr.count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.setIndex(new THREE.BufferAttribute(indices, 1));

  return merged;
}

// ============================================
// LOD 판정
// ============================================

/**
 * 2D 좌표 기반 거리 → LOD 레벨 결정
 */
function determineLOD(
  enemyX: number,
  enemyY: number,
  playerX: number,
  playerY: number,
  totalCount: number,
): LODLevel {
  const dx = enemyX - playerX;
  const dy = enemyY - playerY;
  const distSq = dx * dx + dy * dy;

  // 적응형 LOD: 적이 많으면 threshold 축소
  let factor = 1.0;
  if (totalCount > ADAPTIVE_LOD_THRESHOLD) {
    factor = Math.max(0.65, 1 - (totalCount - ADAPTIVE_LOD_THRESHOLD) / 500);
  }

  const highSq = (LOD_THRESHOLDS.HIGH * factor) ** 2;
  const midSq = (LOD_THRESHOLDS.MID * factor) ** 2;
  const cullSq = (LOD_THRESHOLDS.CULL * factor) ** 2;

  if (distSq > cullSq) return 'CULL';
  if (distSq > midSq) return 'LOW';
  if (distSq > highSq) return 'MID';
  return 'HIGH';
}

// ============================================
// Props
// ============================================

export interface EnemyRendererProps {
  /** 적 배열 ref */
  enemiesRef: React.MutableRefObject<Enemy[]>;
  /** 플레이어 위치 ref (LOD 거리 계산용) */
  playerRef: React.MutableRefObject<{ position: { x: number; y: number } }>;
  /** v39 Phase 3: 적별 hit flash 타이머 (enemyId → 남은 시간, 0이면 정상) */
  hitFlashMapRef?: React.MutableRefObject<Map<string, number>>;
  /** v44: 적 투사체 배열 ref (InstancedMesh로 렌더링) */
  enemyProjectilesRef?: React.MutableRefObject<import('@/lib/matrix/types').EnemyProjectile[]>;
}

// ============================================
// EnemyRenderer Component
// ============================================

/** Hit flash 지속 시간 (초) */
const ENEMY_HIT_FLASH_DURATION = 0.12;

/** v44: 적 투사체 InstancedMesh 최대 수 */
const MAX_ENEMY_PROJECTILE_INSTANCES = 50;
/** v44: 적 투사체 구체 반경 */
const ENEMY_PROJECTILE_SPHERE_RADIUS = 0.25;

export function EnemyRenderer({ enemiesRef, playerRef, hitFlashMapRef, enemyProjectilesRef }: EnemyRendererProps) {
  const groupRef = useRef<THREE.Group>(null);

  // Template별 pool 생성 (한 번만)
  const templatePools = useMemo<TemplatePool[]>(() => {
    const pools: TemplatePool[] = [];

    for (const templateId of getAllTemplateIds()) {
      const geometry = createMergedGeometry(templateId);
      const material = new THREE.MeshStandardMaterial({
        color: '#ffffff', // per-instance color로 덮어씀
        roughness: 0.5,
        metalness: 0.08,
        flatShading: true,
        vertexColors: false,
        emissive: new THREE.Color('#ffffff'),
        emissiveIntensity: 0.05,
      });

      const mesh = new THREE.InstancedMesh(geometry, material, MAX_INSTANCES_PER_TEMPLATE);
      mesh.name = `enemy_${templateId}`;
      mesh.castShadow = true;
      mesh.receiveShadow = false;
      mesh.frustumCulled = false; // 수동 culling (LOD에서 처리)
      mesh.count = 0; // 초기에는 비활성

      // instanceColor 초기화
      const colorArray = new Float32Array(MAX_INSTANCES_PER_TEMPLATE * 3);
      mesh.instanceColor = new THREE.InstancedBufferAttribute(colorArray, 3);

      pools.push({
        templateId,
        mesh,
        material,
        geometry,
        activeCount: 0,
      });
    }

    return pools;
  }, []);

  // LOW LOD pool (단일 큐브)
  const lowLodPool = useMemo<LowLodPool>(() => {
    const geometry = new THREE.BoxGeometry(LOW_LOD_CUBE_SIZE, LOW_LOD_CUBE_SIZE, LOW_LOD_CUBE_SIZE);
    const material = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.8,
      metalness: 0.0,
      flatShading: true,
    });
    const mesh = new THREE.InstancedMesh(geometry, material, MAX_INSTANCES_PER_TEMPLATE * 2);
    mesh.name = 'enemy_low_lod';
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    mesh.count = 0;

    // instanceColor 초기화
    const colorArray = new Float32Array(MAX_INSTANCES_PER_TEMPLATE * 2 * 3);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(colorArray, 3);

    return { mesh, material, geometry, activeCount: 0 };
  }, []);

  // v44: 적 투사체 InstancedMesh pool (작은 빨간 구체)
  const projectilePool = useMemo(() => {
    const geometry = new THREE.SphereGeometry(ENEMY_PROJECTILE_SPHERE_RADIUS, 6, 4);
    const material = new THREE.MeshStandardMaterial({
      color: '#ff4400',
      emissive: new THREE.Color('#ff2200'),
      emissiveIntensity: 0.8,
      roughness: 0.3,
      metalness: 0.1,
    });
    const mesh = new THREE.InstancedMesh(geometry, material, MAX_ENEMY_PROJECTILE_INSTANCES);
    mesh.name = 'enemy_projectiles';
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    mesh.count = 0;

    // instanceColor 초기화
    const colorArray = new Float32Array(MAX_ENEMY_PROJECTILE_INSTANCES * 3);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(colorArray, 3);

    return { mesh, material, geometry, activeCount: 0 };
  }, []);

  // Scene에 mesh 추가/제거
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    // template pools 추가
    for (const pool of templatePools) {
      group.add(pool.mesh);
    }
    // LOW LOD pool 추가
    group.add(lowLodPool.mesh);
    // v44: 적 투사체 pool 추가
    group.add(projectilePool.mesh);

    return () => {
      // cleanup: group에서 제거 + dispose
      for (const pool of templatePools) {
        group.remove(pool.mesh);
        pool.geometry.dispose();
        pool.material.dispose();
        pool.mesh.dispose();
      }
      group.remove(lowLodPool.mesh);
      lowLodPool.geometry.dispose();
      lowLodPool.material.dispose();
      lowLodPool.mesh.dispose();

      // v44: 적 투사체 pool 정리
      group.remove(projectilePool.mesh);
      projectilePool.geometry.dispose();
      projectilePool.material.dispose();
      projectilePool.mesh.dispose();

      disposeAllTemplates();
    };
  }, [templatePools, lowLodPool, projectilePool]);

  // ============================================
  // useFrame: 매 프레임 InstancedMesh 업데이트
  // ============================================

  useFrame((_state, delta) => {
    const enemies = enemiesRef.current;
    if (!enemies || enemies.length === 0) {
      // 모든 pool count를 0으로
      for (const pool of templatePools) {
        if (pool.mesh.count !== 0) {
          pool.mesh.count = 0;
        }
      }
      if (lowLodPool.mesh.count !== 0) {
        lowLodPool.mesh.count = 0;
      }
      _smoothedPositions.clear();
      return;
    }

    const player = playerRef.current;
    const playerX = player.position.x;
    const playerY = player.position.y;
    const totalCount = enemies.length;

    // delta-time 기반 lerp factor
    const posFactor = 1 - Math.exp(-ENEMY_LERP_SPEED * delta);

    // 이번 프레임에 살아있는 적 ID 수집 (stale 엔트리 정리용)
    const aliveIds = new Set<string>();

    // template별 index 카운터 리셋
    const templateCounters = new Map<EnemyTemplateId, number>();
    for (const pool of templatePools) {
      templateCounters.set(pool.templateId, 0);
    }
    let lowLodCount = 0;

    // 적 순회
    for (let e = 0; e < enemies.length; e++) {
      const enemy = enemies[e];
      if (!enemy || enemy.state === 'dying') continue;

      aliveIds.add(enemy.id);

      const templateId = getTemplateIdForEnemy(enemy.enemyType);
      const lod = determineLOD(enemy.position.x, enemy.position.y, playerX, playerY, totalCount);

      if (lod === 'CULL') continue;

      // 2D → 3D 좌표 매핑 (MC FPS: x→x, y→z 직접, 부호 반전 없음)
      const rawX = enemy.position.x;
      const rawZ = enemy.position.y;

      // 보간된 위치 계산
      let smoothed = _smoothedPositions.get(enemy.id);
      if (!smoothed) {
        // 처음 보이는 적 — 즉시 위치 설정
        smoothed = { x: rawX, z: rawZ };
        _smoothedPositions.set(enemy.id, smoothed);
      } else {
        // lerp로 부드럽게 이동
        smoothed.x += (rawX - smoothed.x) * posFactor;
        smoothed.z += (rawZ - smoothed.z) * posFactor;
      }

      const x3d = smoothed.x;
      const z3d = smoothed.z;

      // 크기 스케일: 기본 3x + elite/boss 추가
      let scale = ENEMY_BASE_SCALE;
      if (enemy.isBoss) {
        scale *= BOSS_EXTRA_SCALE;
      }
      if (enemy.isElite && enemy.eliteTier) {
        const eliteScales: Record<string, number> = { silver: 1.3, gold: 1.4, diamond: 1.5 };
        scale *= eliteScales[enemy.eliteTier] ?? 1.0;
      }

      const colors = getEnemyColors(enemy.enemyType);

      // v39 Phase 3: hit flash 강도 계산
      let hitFlashIntensity = 0;
      if (hitFlashMapRef) {
        const flashTimer = hitFlashMapRef.current.get(enemy.id);
        if (flashTimer !== undefined && flashTimer > 0) {
          hitFlashIntensity = flashTimer / ENEMY_HIT_FLASH_DURATION;
        }
      }

      if (lod === 'LOW') {
        // LOW LOD: 단일 큐브
        if (lowLodCount >= MAX_INSTANCES_PER_TEMPLATE * 2) continue;

        _tempPosition.set(x3d, getMCTerrainHeight(x3d, z3d) + 1 + LOW_LOD_CUBE_SIZE / 2, z3d);
        _tempScale.set(scale, scale, scale);
        _tempMatrix.compose(_tempPosition, _tempQuaternion.identity(), _tempScale);

        lowLodPool.mesh.setMatrixAt(lowLodCount, _tempMatrix);
        _tempColor.copy(colors.primary);
        // v39: hit flash — 흰색으로 블렌드
        if (hitFlashIntensity > 0) {
          _tempColor.lerp(_WHITE_COLOR, hitFlashIntensity);
        }
        lowLodPool.mesh.setColorAt(lowLodCount, _tempColor);

        lowLodCount++;
      } else {
        // HIGH/MID LOD: template mesh
        const pool = templatePools.find(p => p.templateId === templateId);
        if (!pool) continue;

        const idx = templateCounters.get(templateId) ?? 0;
        if (idx >= MAX_INSTANCES_PER_TEMPLATE) continue;

        // MID LOD: 절반 스케일 Y (약간 납작하게)
        const scaleY = lod === 'MID' ? scale * 0.7 : scale;

        _tempPosition.set(x3d, getMCTerrainHeight(x3d, z3d) + 1, z3d);
        _tempScale.set(scale, scaleY, scale);

        // 8방향 facing (velocity 기반)
        const vx = enemy.velocity.x;
        const vy = enemy.velocity.y;
        if (vx !== 0 || vy !== 0) {
          const angle = Math.atan2(vx, vy); // MC FPS: velocity → Y-axis rotation
          _tempQuaternion.setFromAxisAngle(_Y_AXIS, angle);
        } else {
          _tempQuaternion.identity();
        }

        _tempMatrix.compose(_tempPosition, _tempQuaternion, _tempScale);

        pool.mesh.setMatrixAt(idx, _tempMatrix);
        _tempColor.copy(colors.primary);
        // v39: hit flash — 흰색으로 블렌드
        if (hitFlashIntensity > 0) {
          _tempColor.lerp(_WHITE_COLOR, hitFlashIntensity);
        }
        pool.mesh.setColorAt(idx, _tempColor);

        templateCounters.set(templateId, idx + 1);
      }
    }

    // 각 pool의 visible count 업데이트
    for (const pool of templatePools) {
      const count = templateCounters.get(pool.templateId) ?? 0;
      if (pool.mesh.count !== count) {
        pool.mesh.count = count;
      }
      if (count > 0) {
        pool.mesh.instanceMatrix.needsUpdate = true;
        markColorNeedsUpdate(pool.mesh);
      }
    }

    // LOW LOD pool
    if (lowLodPool.mesh.count !== lowLodCount) {
      lowLodPool.mesh.count = lowLodCount;
    }
    if (lowLodCount > 0) {
      lowLodPool.mesh.instanceMatrix.needsUpdate = true;
      markColorNeedsUpdate(lowLodPool.mesh);
    }

    // stale 보간 위치 정리 (죽거나 사라진 적)
    if (_smoothedPositions.size > aliveIds.size + 20) {
      for (const id of _smoothedPositions.keys()) {
        if (!aliveIds.has(id)) _smoothedPositions.delete(id);
      }
    }

    // === v44: 적 투사체 InstancedMesh 렌더링 ===
    const eProjs = enemyProjectilesRef?.current;
    if (eProjs && eProjs.length > 0) {
      let projCount = 0;
      for (let pi = 0; pi < eProjs.length && projCount < MAX_ENEMY_PROJECTILE_INSTANCES; pi++) {
        const proj = eProjs[pi];
        const px3d = proj.position.x;
        const pz3d = proj.position.y;
        const py3d = getMCTerrainHeight(px3d, pz3d) + 1.5; // 약간 위에 떠서 이동

        _tempPosition.set(px3d, py3d, pz3d);
        _tempScale.set(1, 1, 1);
        _tempMatrix.compose(_tempPosition, _tempQuaternion.identity(), _tempScale);
        projectilePool.mesh.setMatrixAt(projCount, _tempMatrix);

        // 투사체 색상 (per-instance)
        _tempColor.set(proj.color || '#ff4400');
        projectilePool.mesh.setColorAt(projCount, _tempColor);

        projCount++;
      }
      if (projectilePool.mesh.count !== projCount) {
        projectilePool.mesh.count = projCount;
      }
      if (projCount > 0) {
        projectilePool.mesh.instanceMatrix.needsUpdate = true;
        markColorNeedsUpdate(projectilePool.mesh);
      }
    } else {
      if (projectilePool.mesh.count !== 0) {
        projectilePool.mesh.count = 0;
      }
    }
  });

  return <group ref={groupRef} />;
}
