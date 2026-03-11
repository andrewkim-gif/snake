/**
 * rendering3d/projectile-pool.ts - InstancedMesh 기반 투사체 Object Pool
 * v38 Phase 4 (S27): spawn/despawn 패턴, 무기 카테고리별 10 pools
 *
 * 좌표 매핑: 2D(x,y) → 3D(x, 0, -y)
 * 비활성 인스턴스: scale(0,0,0)으로 숨김
 * useFrame priority=0 필수
 */

import * as THREE from 'three';

// 영점 스케일 매트릭스 (비활성 인스턴스 숨김용)
const ZERO_SCALE_MATRIX = new THREE.Matrix4().makeScale(0, 0, 0);

// 임시 연산용 오브젝트 (GC 방지)
const _tempMatrix = new THREE.Matrix4();
const _tempPosition = new THREE.Vector3();
const _tempQuaternion = new THREE.Quaternion();
const _tempScale = new THREE.Vector3(1, 1, 1);
const _tempEuler = new THREE.Euler();

/**
 * 단일 InstancedMesh 기반 오브젝트 풀
 * spawn() → 인덱스 할당, despawn() → 인덱스 반환 + scale(0,0,0) 숨김
 */
export class ProjectilePool {
  public readonly instancedMesh: THREE.InstancedMesh;
  public readonly maxCapacity: number;
  private activeIndices: Set<number> = new Set();
  private freeIndices: number[] = [];

  constructor(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    capacity: number
  ) {
    this.maxCapacity = capacity;
    this.instancedMesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.instancedMesh.count = 0; // 초기 visible 0
    this.instancedMesh.frustumCulled = false; // InstancedMesh는 수동 관리

    // 모든 인덱스를 free pool에 등록 (역순 → pop으로 낮은 인덱스 우선)
    for (let i = capacity - 1; i >= 0; i--) {
      this.freeIndices.push(i);
    }

    // 초기 상태: scale(0,0,0)으로 숨김
    for (let i = 0; i < capacity; i++) {
      this.instancedMesh.setMatrixAt(i, ZERO_SCALE_MATRIX);
    }
    this.instancedMesh.instanceMatrix.needsUpdate = true;
  }

  /** 풀에서 인스턴스 할당. 실패 시 null */
  spawn(): number | null {
    if (this.freeIndices.length === 0) return null;
    const idx = this.freeIndices.pop()!;
    this.activeIndices.add(idx);
    // count는 가장 높은 인덱스+1 이상이어야 함
    this.instancedMesh.count = Math.max(this.instancedMesh.count, idx + 1);
    return idx;
  }

  /** 인스턴스 반환 (scale 0으로 숨김) */
  despawn(idx: number): void {
    if (!this.activeIndices.has(idx)) return;
    this.instancedMesh.setMatrixAt(idx, ZERO_SCALE_MATRIX);
    this.activeIndices.delete(idx);
    this.freeIndices.push(idx);

    // count 재계산: active 없으면 0, 아니면 max active index + 1
    if (this.activeIndices.size === 0) {
      this.instancedMesh.count = 0;
    }
  }

  /** 인스턴스 위치/회전/스케일 업데이트 */
  updateInstance(
    idx: number,
    x: number,
    y: number,
    z: number,
    rotationY: number,
    scaleX: number,
    scaleY: number,
    scaleZ: number
  ): void {
    _tempPosition.set(x, z, -y); // 2D → 3D 좌표 변환
    _tempEuler.set(0, rotationY, 0);
    _tempQuaternion.setFromEuler(_tempEuler);
    _tempScale.set(scaleX, scaleY, scaleZ);
    _tempMatrix.compose(_tempPosition, _tempQuaternion, _tempScale);
    this.instancedMesh.setMatrixAt(idx, _tempMatrix);
  }

  /** 인스턴스 Matrix 직접 업데이트 (커스텀 변환용) */
  updateInstanceMatrix(idx: number, matrix: THREE.Matrix4): void {
    this.instancedMesh.setMatrixAt(idx, matrix);
  }

  /** 인스턴스 색상 업데이트 */
  updateColor(idx: number, color: THREE.Color): void {
    this.instancedMesh.setColorAt(idx, color);
  }

  /** GPU 업데이트 플러시 (매 프레임 끝에 1회 호출) */
  flush(): void {
    if (this.activeIndices.size > 0 || this.instancedMesh.count > 0) {
      this.instancedMesh.instanceMatrix.needsUpdate = true;
      if (this.instancedMesh.instanceColor) {
        this.instancedMesh.instanceColor.needsUpdate = true;
      }
    }
  }

  /** 모든 활성 인스턴스 반환 */
  despawnAll(): void {
    for (const idx of this.activeIndices) {
      this.instancedMesh.setMatrixAt(idx, ZERO_SCALE_MATRIX);
      this.freeIndices.push(idx);
    }
    this.activeIndices.clear();
    this.instancedMesh.count = 0;
    this.instancedMesh.instanceMatrix.needsUpdate = true;
  }

  /** 활성 인스턴스 수 */
  get activeCount(): number {
    return this.activeIndices.size;
  }

  /** 활성 인덱스 이터레이터 */
  get active(): Set<number> {
    return this.activeIndices;
  }

  /** 리소스 정리 */
  dispose(): void {
    this.instancedMesh.geometry.dispose();
    if (Array.isArray(this.instancedMesh.material)) {
      this.instancedMesh.material.forEach((m) => m.dispose());
    } else {
      this.instancedMesh.material.dispose();
    }
    this.instancedMesh.dispose();
  }
}

/**
 * Pool 카테고리 ID
 * melee(1), ranged(1), magic(1), special(1), skills(6) = 10 pools
 */
export enum PoolCategory {
  MELEE = 0,
  RANGED = 1,
  MAGIC_ORB = 2,
  MAGIC_ORBIT = 3,
  MAGIC_AOE = 4,
  SPECIAL_BEAM = 5,
  SKILL_CODE = 6,
  SKILL_DATA = 7,
  SKILL_NETWORK = 8,
  SKILL_OTHER = 9,
}

/** Pool 설정 */
interface PoolConfig {
  category: PoolCategory;
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  capacity: number;
}

/** 카테고리별 기본 색상 */
export const CATEGORY_COLORS = {
  CODE: new THREE.Color('#00FF41'),    // Matrix green
  DATA: new THREE.Color('#06b6d4'),    // Cyan
  NETWORK: new THREE.Color('#8b5cf6'), // Purple
  SECURITY: new THREE.Color('#ef4444'), // Red
  AI: new THREE.Color('#f59e0b'),       // Amber
  SYSTEM: new THREE.Color('#ec4899'),   // Pink
} as const;

/**
 * 전체 투사체 Pool 매니저
 * 10개 풀 생성/관리, 카테고리별 접근
 */
export class ProjectilePoolManager {
  private pools: Map<PoolCategory, ProjectilePool> = new Map();

  constructor() {
    this.initializePools();
  }

  private initializePools(): void {
    const configs: PoolConfig[] = [
      {
        category: PoolCategory.MELEE,
        geometry: new THREE.BoxGeometry(0.5, 0.5, 0.5),
        material: new THREE.MeshStandardMaterial({
          color: '#EF4444',
          emissive: '#EF4444',
          emissiveIntensity: 0.3,
          transparent: true,
          opacity: 0.9,
        }),
        capacity: 200,
      },
      {
        category: PoolCategory.RANGED,
        geometry: new THREE.BoxGeometry(0.3, 0.1, 0.05),
        material: new THREE.MeshStandardMaterial({
          color: '#3B82F6',
          emissive: '#3B82F6',
          emissiveIntensity: 0.4,
          transparent: true,
          opacity: 0.9,
        }),
        capacity: 200,
      },
      {
        category: PoolCategory.MAGIC_ORB,
        geometry: new THREE.SphereGeometry(0.2, 8, 8),
        material: new THREE.MeshStandardMaterial({
          color: '#3B82F6',
          emissive: '#3B82F6',
          emissiveIntensity: 0.5,
          transparent: true,
          opacity: 0.85,
        }),
        capacity: 200,
      },
      {
        category: PoolCategory.MAGIC_ORBIT,
        geometry: new THREE.PlaneGeometry(0.4, 0.6),
        material: new THREE.MeshStandardMaterial({
          color: '#22C55E',
          emissive: '#22C55E',
          emissiveIntensity: 0.3,
          transparent: true,
          opacity: 0.8,
          side: THREE.DoubleSide,
        }),
        capacity: 200,
      },
      {
        category: PoolCategory.MAGIC_AOE,
        geometry: new THREE.CircleGeometry(1, 32),
        material: new THREE.MeshStandardMaterial({
          color: '#22C55E',
          emissive: '#22C55E',
          emissiveIntensity: 0.2,
          transparent: true,
          opacity: 0.3,
          side: THREE.DoubleSide,
        }),
        capacity: 200,
      },
      {
        category: PoolCategory.SPECIAL_BEAM,
        geometry: new THREE.CylinderGeometry(0.05, 0.05, 1, 8),
        material: new THREE.MeshStandardMaterial({
          color: '#06B6D4',
          emissive: '#06B6D4',
          emissiveIntensity: 0.6,
          transparent: true,
          opacity: 0.8,
        }),
        capacity: 200,
      },
      {
        category: PoolCategory.SKILL_CODE,
        geometry: new THREE.SphereGeometry(0.15, 8, 8),
        material: new THREE.MeshStandardMaterial({
          color: '#00FF41',
          emissive: '#00FF41',
          emissiveIntensity: 0.5,
          transparent: true,
          opacity: 0.85,
        }),
        capacity: 200,
      },
      {
        category: PoolCategory.SKILL_DATA,
        geometry: new THREE.SphereGeometry(0.15, 8, 8),
        material: new THREE.MeshStandardMaterial({
          color: '#06b6d4',
          emissive: '#06b6d4',
          emissiveIntensity: 0.5,
          transparent: true,
          opacity: 0.85,
        }),
        capacity: 200,
      },
      {
        category: PoolCategory.SKILL_NETWORK,
        geometry: new THREE.SphereGeometry(0.15, 8, 8),
        material: new THREE.MeshStandardMaterial({
          color: '#8b5cf6',
          emissive: '#8b5cf6',
          emissiveIntensity: 0.5,
          transparent: true,
          opacity: 0.85,
        }),
        capacity: 200,
      },
      {
        category: PoolCategory.SKILL_OTHER,
        geometry: new THREE.SphereGeometry(0.15, 8, 8),
        material: new THREE.MeshStandardMaterial({
          color: '#ef4444',
          emissive: '#ef4444',
          emissiveIntensity: 0.5,
          transparent: true,
          opacity: 0.85,
        }),
        capacity: 200,
      },
    ];

    for (const config of configs) {
      this.pools.set(
        config.category,
        new ProjectilePool(config.geometry, config.material, config.capacity)
      );
    }
  }

  /** 카테고리별 풀 가져오기 */
  getPool(category: PoolCategory): ProjectilePool | undefined {
    return this.pools.get(category);
  }

  /** 모든 풀의 InstancedMesh 배열 (Scene에 추가용) */
  getAllMeshes(): THREE.InstancedMesh[] {
    return Array.from(this.pools.values()).map((pool) => pool.instancedMesh);
  }

  /** 무기 타입 → 풀 카테고리 매핑 */
  static getCategory(weaponType: string): PoolCategory {
    switch (weaponType) {
      // 근접
      case 'whip':
      case 'punch':
      case 'axe':
      case 'sword':
        return PoolCategory.MELEE;

      // 원거리
      case 'knife':
      case 'bow':
      case 'ping':
      case 'shard':
      case 'airdrop':
      case 'fork':
        return PoolCategory.RANGED;

      // 마법 - 발사체
      case 'wand':
        return PoolCategory.MAGIC_ORB;

      // 마법 - 궤도
      case 'bible':
        return PoolCategory.MAGIC_ORBIT;

      // 마법 - AOE
      case 'garlic':
      case 'pool':
        return PoolCategory.MAGIC_AOE;

      // 특수
      case 'bridge':
      case 'beam':
      case 'laser':
        return PoolCategory.SPECIAL_BEAM;

      // 스킬
      default:
        return ProjectilePoolManager.getSkillCategory(weaponType);
    }
  }

  /** 스킬 무기 → 카테고리 매핑 */
  private static getSkillCategory(weaponType: string): PoolCategory {
    // CODE 카테고리 스킬
    const codeSkills = [
      'syntax_error', 'compiler', 'debugger_skill', 'hotfix',
      'runtime', 'garbage_collector',
    ];
    if (codeSkills.includes(weaponType)) return PoolCategory.SKILL_CODE;

    // DATA 카테고리 스킬
    const dataSkills = [
      'json_bomb', 'csv_spray', 'binary', 'big_data',
      'regex', 'query',
    ];
    if (dataSkills.includes(weaponType)) return PoolCategory.SKILL_DATA;

    // NETWORK 카테고리 스킬
    const networkSkills = [
      'websocket', 'tcp_flood', 'dns_spoof', 'packet_loss',
      'vpn_tunnel', 'ddos', 'proxy',
    ];
    if (networkSkills.includes(weaponType)) return PoolCategory.SKILL_NETWORK;

    // 나머지 (SECURITY, AI, SYSTEM) → OTHER
    return PoolCategory.SKILL_OTHER;
  }

  /** 모든 풀 GPU flush */
  flushAll(): void {
    for (const pool of this.pools.values()) {
      pool.flush();
    }
  }

  /** 모든 풀 비활성화 */
  despawnAll(): void {
    for (const pool of this.pools.values()) {
      pool.despawnAll();
    }
  }

  /** 리소스 정리 */
  dispose(): void {
    for (const pool of this.pools.values()) {
      pool.dispose();
    }
    this.pools.clear();
  }
}

/**
 * 2D 좌표 → 3D Matrix4 변환 헬퍼
 * x → x, y → -z, angle → Y-axis rotation
 */
export function projectileMatrix(
  x: number,
  y: number,
  angle: number,
  scale: number = 1
): THREE.Matrix4 {
  _tempPosition.set(x, 0.3, -y); // 지면 약간 위
  _tempEuler.set(0, -angle + Math.PI / 2, 0); // 2D angle → 3D Y rotation
  _tempQuaternion.setFromEuler(_tempEuler);
  _tempScale.set(scale, scale, scale);
  return new THREE.Matrix4().compose(_tempPosition, _tempQuaternion, _tempScale);
}
