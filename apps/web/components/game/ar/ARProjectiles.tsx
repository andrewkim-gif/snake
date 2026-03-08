'use client';

/**
 * ARProjectiles — 투사체 InstancedMesh 렌더링 (Phase 4 전투 이펙트)
 *
 * 4종 투사체 비주얼 (타입별 개별 InstancedMesh + geometry):
 * - straight: 길쭉한 박스 (화살/총알) — 황금색
 * - homing: 발광 구 (추적 마법) — 파란색, emissive
 * - pierce: 길고 얇은 실린더 (관통 빔) — 주황색
 * - aoe: 팽창하는 토러스 링 (범위 공격) — 빨강, 반투명
 *
 * 성능: InstancedMesh 4개 × MAX_PROJECTILES cap, useFrame ref 업데이트
 * useFrame priority=0
 */

import { useRef, useMemo, memo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MC_BASE_Y } from '@/lib/3d/mc-types';
import { getArenaTerrainHeight } from '@/lib/3d/mc-noise';
import type { ARState, ARWeaponID, ARProjectileType } from '@/lib/3d/ar-types';
import { WEAPON_TRAJECTORY_MAP, PROJECTILE_TYPE_COLORS } from '@/lib/3d/ar-types';

const MAX_PROJECTILES = 100;

const _dummy = new THREE.Object3D();

// ============================================================
// 헬퍼: weapon ID → trajectory type
// ============================================================

function getTrajectoryType(weaponId: string): ARProjectileType {
  return WEAPON_TRAJECTORY_MAP[weaponId as ARWeaponID] ?? 'straight';
}

// ============================================================
// Props
// ============================================================

interface ARProjectilesProps {
  arStateRef: React.MutableRefObject<ARState | null>;
  playerPos: React.MutableRefObject<{ x: number; y: number; z: number }>;
  arenaSeed: number;
  flattenVariance?: number;
}

// ============================================================
// ARProjectiles 컴포넌트
// ============================================================

function ARProjectilesInner({ arStateRef, playerPos, arenaSeed, flattenVariance = 3 }: ARProjectilesProps) {
  // 타입별 InstancedMesh refs
  const straightRef = useRef<THREE.InstancedMesh>(null);
  const homingRef = useRef<THREE.InstancedMesh>(null);
  const pierceRef = useRef<THREE.InstancedMesh>(null);
  const aoeRef = useRef<THREE.InstancedMesh>(null);

  // 타입별 머티리얼
  const straightMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: PROJECTILE_TYPE_COLORS.straight, toneMapped: false }),
    [],
  );
  const homingMat = useMemo(
    () => new THREE.MeshBasicMaterial({
      color: PROJECTILE_TYPE_COLORS.homing,
      transparent: true,
      opacity: 0.9,
      toneMapped: false,
    }),
    [],
  );
  const pierceMat = useMemo(
    () => new THREE.MeshBasicMaterial({
      color: PROJECTILE_TYPE_COLORS.pierce,
      transparent: true,
      opacity: 0.85,
      toneMapped: false,
    }),
    [],
  );
  const aoeMat = useMemo(
    () => new THREE.MeshBasicMaterial({
      color: PROJECTILE_TYPE_COLORS.aoe,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: false,
    }),
    [],
  );

  // 타입별 지오메트리
  const straightGeo = useMemo(() => new THREE.BoxGeometry(0.1, 0.1, 0.45), []);
  const homingGeo = useMemo(() => new THREE.SphereGeometry(0.2, 8, 6), []);
  const pierceGeo = useMemo(() => new THREE.CylinderGeometry(0.05, 0.05, 0.8, 6), []);
  const aoeGeo = useMemo(() => new THREE.TorusGeometry(0.8, 0.08, 6, 16), []);

  // Dispose on unmount
  useEffect(() => {
    return () => {
      straightMat.dispose(); homingMat.dispose(); pierceMat.dispose(); aoeMat.dispose();
      straightGeo.dispose(); homingGeo.dispose(); pierceGeo.dispose(); aoeGeo.dispose();
    };
  }, [straightMat, homingMat, pierceMat, aoeMat, straightGeo, homingGeo, pierceGeo, aoeGeo]);

  useFrame(() => {
    const arState = arStateRef.current;
    if (!arState) return;

    const projectiles = arState.projectiles;
    const count = Math.min(projectiles.length, MAX_PROJECTILES);
    const now = performance.now() * 0.001; // 초 단위

    // 타입별 카운터
    let sCount = 0;
    let hCount = 0;
    let pCount = 0;
    let aCount = 0;

    for (let i = 0; i < count; i++) {
      const p = projectiles[i];
      const traj = getTrajectoryType(p.type);

      // 지형 높이 + 투사체 높이 오프셋 (캐릭터 가슴 높이)
      const terrainY = getArenaTerrainHeight(p.x, p.z, arenaSeed, flattenVariance);
      const baseY = terrainY - MC_BASE_Y + 1.2;

      switch (traj) {
        case 'straight': {
          if (!straightRef.current) break;
          _dummy.position.set(p.x, baseY, p.z);
          // 약간의 회전으로 날아가는 느낌
          _dummy.rotation.set(0, now * 3 + i * 2.1, 0);
          _dummy.scale.set(1, 1, 1);
          _dummy.updateMatrix();
          straightRef.current.setMatrixAt(sCount, _dummy.matrix);
          sCount++;
          break;
        }
        case 'homing': {
          if (!homingRef.current) break;
          // 부유 + 맥동 효과
          const pulse = 0.8 + Math.sin(now * 5 + i * 1.3) * 0.25;
          _dummy.position.set(p.x, baseY + Math.sin(now * 3 + i) * 0.15, p.z);
          _dummy.rotation.set(0, 0, 0);
          _dummy.scale.setScalar(pulse);
          _dummy.updateMatrix();
          homingRef.current.setMatrixAt(hCount, _dummy.matrix);
          hCount++;
          break;
        }
        case 'pierce': {
          if (!pierceRef.current) break;
          // 수평 회전하는 관통 빔
          _dummy.position.set(p.x, baseY, p.z);
          _dummy.rotation.set(0, 0, Math.PI / 2); // 눕힌 실린더
          _dummy.scale.set(1, 1, 1);
          _dummy.updateMatrix();
          pierceRef.current.setMatrixAt(pCount, _dummy.matrix);
          pCount++;
          break;
        }
        case 'aoe': {
          if (!aoeRef.current) break;
          // 팽창하는 토러스 링 (바닥 가까이)
          const expandScale = 0.6 + Math.sin(now * 2.5 + i * 0.7) * 0.3;
          _dummy.position.set(p.x, baseY - 0.6, p.z);
          _dummy.rotation.set(Math.PI / 2, 0, 0);
          _dummy.scale.setScalar(expandScale);
          _dummy.updateMatrix();
          aoeRef.current.setMatrixAt(aCount, _dummy.matrix);
          aCount++;
          break;
        }
      }
    }

    // 카운트 업데이트 (가변 count로 미사용 인스턴스 자동 제외)
    if (straightRef.current) {
      straightRef.current.count = sCount;
      straightRef.current.instanceMatrix.needsUpdate = true;
    }
    if (homingRef.current) {
      homingRef.current.count = hCount;
      homingRef.current.instanceMatrix.needsUpdate = true;
    }
    if (pierceRef.current) {
      pierceRef.current.count = pCount;
      pierceRef.current.instanceMatrix.needsUpdate = true;
    }
    if (aoeRef.current) {
      aoeRef.current.count = aCount;
      aoeRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <>
      {/* Straight: 길쭉한 박스 (화살/총알) */}
      <instancedMesh
        ref={straightRef}
        args={[straightGeo, straightMat, MAX_PROJECTILES]}
        frustumCulled={false}
      />

      {/* Homing: 발광 구 (추적 마법) */}
      <instancedMesh
        ref={homingRef}
        args={[homingGeo, homingMat, MAX_PROJECTILES]}
        frustumCulled={false}
      />

      {/* Pierce: 길쭉한 실린더 (관통 빔) */}
      <instancedMesh
        ref={pierceRef}
        args={[pierceGeo, pierceMat, MAX_PROJECTILES]}
        frustumCulled={false}
      />

      {/* AOE: 토러스 링 (범위) */}
      <instancedMesh
        ref={aoeRef}
        args={[aoeGeo, aoeMat, MAX_PROJECTILES]}
        frustumCulled={false}
      />
    </>
  );
}

export const ARProjectiles = memo(ARProjectilesInner);
