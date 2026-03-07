'use client';

/**
 * AREntities — 적 + XP 크리스탈 InstancedMesh 렌더링 (Phase 7 최적화)
 *
 * InstancedMesh로 대량 엔티티 렌더링 최적화:
 * - 적: 복셀 박스 (타입별 색상)
 * - XP 크리스탈: 작은 다이아몬드 형태
 * - 엘리트 적: 더 크고 발광 효과
 * - LOD: 20m 이상 원거리 적은 작은 박스로 단순화
 * - 200+ 적일 때 원거리 적은 빌보드
 * - React.memo 적용
 *
 * useFrame priority=0
 */

import { useRef, useMemo, memo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { AREnemyNet, ARCrystalNet } from '@/lib/3d/ar-types';
import { ENEMY_COLORS } from '@/lib/3d/ar-types';

const MAX_ENEMIES = 200;
const MAX_CRYSTALS = 300;

// LOD 거리 임계값 (미터)
const LOD_NEAR = 20;    // 근거리: 풀 디테일
const LOD_FAR = 40;     // 원거리: 최소 디테일 (빌보드)
const LOD_CULL = 60;    // 이 거리 이상: 렌더링 스킵

const dummy = new THREE.Object3D();
const tempColor = new THREE.Color();

// 적 타입별 색상
const ENEMY_COLOR_MAP: Record<string, THREE.Color> = {
  zombie: new THREE.Color(ENEMY_COLORS.zombie),
  skeleton: new THREE.Color(ENEMY_COLORS.skeleton),
  slime: new THREE.Color(ENEMY_COLORS.slime),
  spider: new THREE.Color(ENEMY_COLORS.spider),
  creeper: new THREE.Color(ENEMY_COLORS.creeper),
};

const CRYSTAL_COLOR = new THREE.Color(0.3, 0.8, 1.0);
const ELITE_GLOW_COLOR = new THREE.Color(1.0, 0.5, 0.0);

interface AREntitiesProps {
  enemies: AREnemyNet[];
  xpCrystals: ARCrystalNet[];
  /** 플레이어 위치 (LOD 계산용) */
  playerPos?: { x: number; z: number };
}

function AREntitiesInner({ enemies, xpCrystals, playerPos }: AREntitiesProps) {
  const enemyMeshRef = useRef<THREE.InstancedMesh>(null);
  const crystalMeshRef = useRef<THREE.InstancedMesh>(null);
  const { camera } = useThree();

  // 적 머티리얼 (InstancedMesh에서 instanceColor 사용)
  const enemyMat = useMemo(
    () =>
      new THREE.MeshLambertMaterial({
        vertexColors: false,
      }),
    []
  );

  // 크리스탈 머티리얼
  const crystalMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: CRYSTAL_COLOR,
        transparent: true,
        opacity: 0.8,
      }),
    []
  );

  // 적 업데이트 (LOD 적용)
  useFrame(() => {
    if (!enemyMeshRef.current) return;

    const mesh = enemyMeshRef.current;
    const px = playerPos?.x ?? camera.position.x;
    const pz = playerPos?.z ?? camera.position.z;

    let visibleCount = 0;
    const maxCount = Math.min(enemies.length, MAX_ENEMIES);

    for (let i = 0; i < maxCount; i++) {
      const e = enemies[i];

      // 플레이어로부터의 거리 계산
      const dx = e.x - px;
      const dz = e.z - pz;
      const distSq = dx * dx + dz * dz;

      // LOD 컬링: 너무 먼 적은 스킵
      if (distSq > LOD_CULL * LOD_CULL) {
        continue;
      }

      const dist = Math.sqrt(distSq);
      const isElite = e.isElite || e.isMiniboss;

      // LOD 레벨 결정
      let lodScale: number;
      if (dist < LOD_NEAR || isElite) {
        // 근거리 또는 엘리트: 풀 디테일
        lodScale = 1.0;
      } else if (dist < LOD_FAR) {
        // 중거리: 약간 축소
        lodScale = 0.7;
      } else {
        // 원거리: 빌보드 (작은 점)
        lodScale = 0.4;
      }

      const baseScale = e.type === 'slime' ? 0.8 : e.type === 'spider' ? 0.6 : 1.0;
      const eliteScale = isElite ? 1.5 : 1.0;
      const finalScale = baseScale * eliteScale * lodScale;

      dummy.position.set(e.x, finalScale * 0.5, e.z);
      dummy.scale.set(finalScale, finalScale, finalScale);
      dummy.updateMatrix();
      mesh.setMatrixAt(visibleCount, dummy.matrix);

      // 색상
      const color = ENEMY_COLOR_MAP[e.type] || ENEMY_COLOR_MAP.zombie;
      if (isElite) {
        tempColor.copy(ELITE_GLOW_COLOR);
      } else {
        tempColor.copy(color);
        // 원거리 적은 약간 어둡게 (안개 효과)
        if (dist > LOD_FAR) {
          tempColor.multiplyScalar(0.6);
        }
      }
      mesh.setColorAt(visibleCount, tempColor);

      visibleCount++;
    }

    mesh.count = visibleCount;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  // XP 크리스탈 업데이트 (LOD 적용)
  useFrame(() => {
    if (!crystalMeshRef.current) return;

    const mesh = crystalMeshRef.current;
    const px = playerPos?.x ?? camera.position.x;
    const pz = playerPos?.z ?? camera.position.z;

    let visibleCount = 0;
    const maxCount = Math.min(xpCrystals.length, MAX_CRYSTALS);
    const t = performance.now() * 0.003;

    for (let i = 0; i < maxCount; i++) {
      const c = xpCrystals[i];

      // 크리스탈 LOD 컬링 (30m 이상 스킵)
      const dx = c.x - px;
      const dz = c.z - pz;
      if (dx * dx + dz * dz > 900) {
        continue;
      }

      // 부유 + 회전 효과
      const floatY = 0.3 + Math.sin(t + i * 0.5) * 0.15;
      const rotY = t + i * 0.7;

      dummy.position.set(c.x, floatY, c.z);
      dummy.rotation.set(0, rotY, Math.PI / 4);
      dummy.scale.set(0.3, 0.3, 0.3);
      dummy.updateMatrix();
      mesh.setMatrixAt(visibleCount, dummy.matrix);

      visibleCount++;
    }

    mesh.count = visibleCount;
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      {/* 적 InstancedMesh */}
      <instancedMesh
        ref={enemyMeshRef}
        args={[undefined, undefined, MAX_ENEMIES]}
        material={enemyMat}
        frustumCulled={false}
      >
        <boxGeometry args={[0.8, 0.8, 0.8]} />
      </instancedMesh>

      {/* XP 크리스탈 InstancedMesh */}
      <instancedMesh
        ref={crystalMeshRef}
        args={[undefined, undefined, MAX_CRYSTALS]}
        material={crystalMat}
        frustumCulled={false}
      >
        <octahedronGeometry args={[0.2, 0]} />
      </instancedMesh>
    </>
  );
}

export const AREntities = memo(AREntitiesInner);
