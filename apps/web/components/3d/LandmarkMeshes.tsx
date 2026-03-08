'use client';

/**
 * LandmarkMeshes — MC 복셀 스타일 3D 랜드마크 레이어 (v20 Phase 2 MC)
 *
 * 구현:
 *   - Archetype별 InstancedMesh (사용 중인 Archetype 수만큼 draw calls)
 *   - VoxelBox 데이터 구동 geometry (landmark-geometries.ts) + 아틀라스 UV 리매핑
 *   - 단일 공유 MeshLambertMaterial (아틀라스 텍스처 + vertexColors + flatShading)
 *   - 면별 밝기 vertex color (top=1.0, bottom=0.5, sides=0.6/0.8)
 *   - 구면 정렬: Quaternion.setFromUnitVectors로 지구 표면 수직 배치
 *   - Backface culling: dot(normal, camDir) < 0.05 → hide, fade 0.05~0.35
 *   - renderOrder = 95 (라벨=100 아래)
 *   - GC 방지: 모듈 스코프 temp 객체 사전 할당
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { latLngToVector3 } from '@/lib/globe-utils';
import { LandmarkArchetype } from '@/lib/landmark-data';
import type { Landmark } from '@/lib/landmark-data';
import { createArchetypeGeometry, disposeGeometryCache } from '@/lib/landmark-geometries';
import { getBlockAtlasTexture } from '@/lib/mc-texture-atlas';

// ─── Constants ───

const SURFACE_ALT = 2.5;
const BACKFACE_THRESHOLD = 0.05;
const BACKFACE_FADE_RANGE = 0.3;
const LANDMARK_SCALE = 1.5; // 전체 스케일 조정 (지구 반경 100 대비 ~5-8 unit 높이)

// ─── GC 방지: 모듈 스코프 temp 객체 ───

const _obj = new THREE.Object3D();
const _camDir = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _quat = new THREE.Quaternion();

// ─── Types ───

export interface LandmarkMeshesProps {
  landmarks: Landmark[];
  globeRadius?: number;
}

// ─── Archetype 그룹핑 ───

interface ArchetypeGroup {
  archetype: LandmarkArchetype;
  landmarks: Landmark[];
  positions: THREE.Vector3[];
  normals: THREE.Vector3[];
}

// ─── 머티리얼 (공유 아틀라스 텍스처 + vertex colors) ───

let sharedMaterial: THREE.MeshLambertMaterial | null = null;

function getSharedMaterial(): THREE.MeshLambertMaterial {
  if (sharedMaterial) return sharedMaterial;
  const atlas = getBlockAtlasTexture();
  sharedMaterial = new THREE.MeshLambertMaterial({
    map: atlas,
    vertexColors: true,
    flatShading: true,
  });
  return sharedMaterial;
}

// ─── ArchetypeInstancedMesh 서브 컴포넌트 ───

interface ArchetypeInstancedMeshProps {
  group: ArchetypeGroup;
  globeRadius: number;
  camera: THREE.Camera;
}

function ArchetypeInstancedMesh({ group, globeRadius, camera }: ArchetypeInstancedMeshProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);

  const geometry = useMemo(() => {
    return createArchetypeGeometry(group.archetype);
  }, [group.archetype]);

  // 공유 아틀라스 머티리얼 (vertexColors로 면별 밝기 적용)
  const material = useMemo(() => getSharedMaterial(), []);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    _camDir.copy(camera.position).normalize();

    let visibleCount = 0;

    for (let i = 0; i < group.landmarks.length; i++) {
      const pos = group.positions[i];
      const normal = group.normals[i];

      // Backface culling
      const dot = normal.dot(_camDir);
      if (dot < BACKFACE_THRESHOLD) continue;

      // Alpha fade (backface 경계)
      const fade = THREE.MathUtils.clamp(
        (dot - BACKFACE_THRESHOLD) / BACKFACE_FADE_RANGE, 0, 1,
      );

      // 구면 정렬: Y축(위)를 법선 방향으로 회전
      _quat.setFromUnitVectors(_up, normal);

      _obj.position.copy(pos);
      _obj.quaternion.copy(_quat);
      const s = LANDMARK_SCALE * fade;
      _obj.scale.set(s, s, s);
      _obj.updateMatrix();
      mesh.setMatrixAt(visibleCount, _obj.matrix);
      visibleCount++;
    }

    mesh.count = visibleCount;
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, group.landmarks.length]}
      frustumCulled={false}
      renderOrder={95}
      castShadow={false}
      receiveShadow={false}
    />
  );
}

// ─── 메인 컴포넌트 ───

export function LandmarkMeshes({
  landmarks,
  globeRadius = 100,
}: LandmarkMeshesProps) {
  const { camera } = useThree();

  // Archetype별 그룹핑 + 3D 좌표 계산
  const archetypeGroups = useMemo(() => {
    const groupMap = new Map<LandmarkArchetype, ArchetypeGroup>();
    const r = globeRadius + SURFACE_ALT;

    for (const lm of landmarks) {
      let group = groupMap.get(lm.archetype);
      if (!group) {
        group = {
          archetype: lm.archetype,
          landmarks: [],
          positions: [],
          normals: [],
        };
        groupMap.set(lm.archetype, group);
      }

      const pos = latLngToVector3(lm.lat, lm.lng, r);
      const normal = pos.clone().normalize();
      group.landmarks.push(lm);
      group.positions.push(pos);
      group.normals.push(normal);
    }

    return Array.from(groupMap.values());
  }, [landmarks, globeRadius]);

  // 언마운트 시 geometry cache + 공유 머티리얼 정리
  useEffect(() => {
    return () => {
      disposeGeometryCache();
      if (sharedMaterial) {
        sharedMaterial.dispose();
        sharedMaterial = null;
      }
    };
  }, []);

  return (
    <group>
      {archetypeGroups.map(group => (
        <ArchetypeInstancedMesh
          key={group.archetype}
          group={group}
          globeRadius={globeRadius}
          camera={camera}
        />
      ))}
    </group>
  );
}
