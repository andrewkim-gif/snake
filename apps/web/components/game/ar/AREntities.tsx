'use client';

/**
 * AREntities — 적 + XP 크리스탈 InstancedMesh 렌더링
 *
 * InstancedMesh로 대량 엔티티 렌더링 최적화:
 * - 적: 복셀 박스 (타입별 색상)
 * - XP 크리스탈: 작은 다이아몬드 형태
 * - 엘리트 적: 더 크고 발광 효과
 *
 * useFrame priority=0
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { AREnemyNet, ARCrystalNet } from '@/lib/3d/ar-types';
import { ENEMY_COLORS } from '@/lib/3d/ar-types';

const MAX_ENEMIES = 200;
const MAX_CRYSTALS = 300;

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
}

export function AREntities({ enemies, xpCrystals }: AREntitiesProps) {
  const enemyMeshRef = useRef<THREE.InstancedMesh>(null);
  const crystalMeshRef = useRef<THREE.InstancedMesh>(null);

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

  // 적 업데이트
  useFrame(() => {
    if (!enemyMeshRef.current) return;

    const mesh = enemyMeshRef.current;
    const count = Math.min(enemies.length, MAX_ENEMIES);
    mesh.count = count;

    for (let i = 0; i < count; i++) {
      const e = enemies[i];
      const scale = e.isElite ? 1.5 : 1.0;

      // 적 크기: 타입에 따라 약간 다름
      const baseScale = e.type === 'slime' ? 0.8 : e.type === 'spider' ? 0.6 : 1.0;

      dummy.position.set(e.x, baseScale * scale * 0.5, e.z);
      dummy.scale.set(baseScale * scale, baseScale * scale, baseScale * scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      // 색상
      const color = ENEMY_COLOR_MAP[e.type] || ENEMY_COLOR_MAP.zombie;
      if (e.isElite) {
        tempColor.copy(ELITE_GLOW_COLOR);
      } else {
        tempColor.copy(color);
      }
      mesh.setColorAt(i, tempColor);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  // XP 크리스탈 업데이트
  useFrame(() => {
    if (!crystalMeshRef.current) return;

    const mesh = crystalMeshRef.current;
    const count = Math.min(xpCrystals.length, MAX_CRYSTALS);
    mesh.count = count;

    const t = performance.now() * 0.003;

    for (let i = 0; i < count; i++) {
      const c = xpCrystals[i];
      // 부유 + 회전 효과
      const floatY = 0.3 + Math.sin(t + i * 0.5) * 0.15;
      const rotY = t + i * 0.7;

      dummy.position.set(c.x, floatY, c.z);
      dummy.rotation.set(0, rotY, Math.PI / 4);
      dummy.scale.set(0.3, 0.3, 0.3);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }

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
