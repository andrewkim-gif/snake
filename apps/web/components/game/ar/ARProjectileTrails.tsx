'use client';

/**
 * ARProjectileTrails — 투사체 잔상 트레일 시스템
 *
 * ring buffer로 최근 5프레임 위치 기록 → InstancedMesh 잔상:
 * - 점진적 투명 (opacity) + 축소 (scale)
 * - 타입별 트레일 색상
 * - MAX_TRAIL_POINTS cap
 *
 * useFrame priority=0
 */

import { useRef, useMemo, memo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MC_BASE_Y } from '@/lib/3d/mc-types';
import { getArenaTerrainHeight } from '@/lib/3d/mc-noise';
import type { ARState, ARWeaponID, ARProjectileType } from '@/lib/3d/ar-types';
import { WEAPON_TRAJECTORY_MAP } from '@/lib/3d/ar-types';

const TRAIL_LENGTH = 5;
const MAX_PROJECTILES = 60;
const MAX_TRAIL_INSTANCES = MAX_PROJECTILES * TRAIL_LENGTH; // 300

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();
const _trailColor = new THREE.Color(); // 재사용 temp (clone 방지)

// 투사체별 이전 위치 ring buffer
interface ProjectileTrail {
  id: string;
  positions: Array<{ x: number; y: number; z: number }>;
  writeIdx: number;
  type: ARProjectileType;
  lastSeen: number; // frame counter
}

// ============================================================
// Props
// ============================================================

interface ARProjectileTrailsProps {
  arStateRef: React.MutableRefObject<ARState | null>;
  arenaSeed: number;
  flattenVariance?: number;
}

// ============================================================
// 헬퍼
// ============================================================

function getTrajectoryType(weaponId: string): ARProjectileType {
  return WEAPON_TRAJECTORY_MAP[weaponId as ARWeaponID] ?? 'straight';
}

const TRAIL_COLORS: Record<ARProjectileType, string> = {
  straight: '#FFD54F',
  homing: '#4FC3F7',
  pierce: '#FF9800',
  aoe: '#EF5350',
};

// ============================================================
// ARProjectileTrails 컴포넌트
// ============================================================

function ARProjectileTrailsInner({ arStateRef, arenaSeed, flattenVariance = 3 }: ARProjectileTrailsProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const trailsRef = useRef<Map<string, ProjectileTrail>>(new Map());
  const frameRef = useRef(0);

  const geo = useMemo(() => new THREE.SphereGeometry(0.06, 4, 3), []);
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      toneMapped: false,
    }),
    [],
  );

  useEffect(() => {
    return () => {
      geo.dispose();
      mat.dispose();
    };
  }, [geo, mat]);

  useFrame(() => {
    const mesh = meshRef.current;
    const arState = arStateRef.current;
    if (!mesh || !arState) return;

    frameRef.current++;
    const frame = frameRef.current;
    const trails = trailsRef.current;
    const projectiles = arState.projectiles;

    // 현재 프레임에 존재하는 투사체 ID 세트
    const activeIds = new Set<string>();

    // 1. 투사체 위치 ring buffer 업데이트
    for (let i = 0; i < projectiles.length && i < MAX_PROJECTILES; i++) {
      const p = projectiles[i];
      const id = p.id; // ARProjectileNet.id 사용
      activeIds.add(id);

      const terrainY = getArenaTerrainHeight(p.x, p.z, arenaSeed, flattenVariance);
      const baseY = terrainY - MC_BASE_Y + 1.2;

      let trail = trails.get(id);
      if (!trail) {
        trail = {
          id,
          positions: Array.from({ length: TRAIL_LENGTH }, () => ({ x: p.x, y: baseY, z: p.z })),
          writeIdx: 0,
          type: getTrajectoryType(p.type),
          lastSeen: frame,
        };
        trails.set(id, trail);
      }

      // ring buffer에 현재 위치 기록
      trail.positions[trail.writeIdx % TRAIL_LENGTH] = { x: p.x, y: baseY, z: p.z };
      trail.writeIdx++;
      trail.lastSeen = frame;
    }

    // 2. 오래된 트레일 정리
    for (const [id, trail] of trails) {
      if (frame - trail.lastSeen > 10) {
        trails.delete(id);
      }
    }

    // 3. InstancedMesh 업데이트
    let visibleCount = 0;

    for (const trail of trails.values()) {
      _color.set(TRAIL_COLORS[trail.type] ?? '#ffffff');

      for (let t = 0; t < TRAIL_LENGTH; t++) {
        const idx = ((trail.writeIdx - 1 - t) % TRAIL_LENGTH + TRAIL_LENGTH) % TRAIL_LENGTH;
        const pos = trail.positions[idx];

        // 점진적 축소 + 투명
        const age = t / TRAIL_LENGTH; // 0=newest, 1=oldest
        const scale = 1 - age * 0.8;

        _dummy.position.set(pos.x, pos.y, pos.z);
        _dummy.scale.setScalar(scale);
        _dummy.rotation.set(0, 0, 0);
        _dummy.updateMatrix();
        mesh.setMatrixAt(visibleCount, _dummy.matrix);

        // 색상 점진적 어두워짐 (재사용 temp로 clone 방지)
        _trailColor.copy(_color).multiplyScalar(1 - age * 0.5);
        mesh.setColorAt(visibleCount, _trailColor);
        visibleCount++;

        if (visibleCount >= MAX_TRAIL_INSTANCES) break;
      }
      if (visibleCount >= MAX_TRAIL_INSTANCES) break;
    }

    mesh.count = visibleCount;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geo, mat, MAX_TRAIL_INSTANCES]}
      frustumCulled={false}
    />
  );
}

export const ARProjectileTrails = memo(ARProjectileTrailsInner);
