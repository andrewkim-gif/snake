'use client';

/**
 * LandmarkMeshes — Mid/Close LOD 3D 형상 레이어 (v20 Phase 3)
 *
 * 구현:
 *   - Archetype별 InstancedMesh (사용 중인 Archetype 수만큼 draw calls)
 *   - 프로시저럴 BufferGeometry (landmark-geometries.ts)
 *   - 구면 정렬: Quaternion.setFromUnitVectors로 지구 표면 수직 배치
 *   - Backface culling: dot(normal, camDir) < 0.05 → hide, fade 0.05~0.35
 *   - renderOrder = 95 (스프라이트=98, 라벨=100 아래)
 *   - GC 방지: 모듈 스코프 temp 객체 사전 할당
 *
 * 최적화: Archetype별 InstancedMesh → 실제 사용 Archetype 수만큼 draw calls (~12-15)
 */

import { useRef, useMemo, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { latLngToVector3 } from '@/lib/globe-utils';
import { LANDMARKS, LandmarkArchetype } from '@/lib/landmark-data';
import type { Landmark } from '@/lib/landmark-data';
import { createArchetypeGeometry, disposeGeometryCache } from '@/lib/landmark-geometries';

// ─── Constants ───

const SURFACE_ALT = 2.5;
const BACKFACE_THRESHOLD = 0.05;
const BACKFACE_FADE_RANGE = 0.3;
const LANDMARK_SCALE = 1.5; // 전체 스케일 조정 (지구 반경 100 대비 ~5-8 unit 높이)

// ─── GC 방지: 모듈 스코프 temp 객체 ───

const _obj = new THREE.Object3D();
const _camDir = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _normal = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _color = new THREE.Color();

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

// ─── 머티리얼 (공유) ───

// Archetype별 색상 테이블 — 각 건축물 유형에 맞는 따뜻한 색조
const ARCHETYPE_COLORS: Record<string, string> = {
  [LandmarkArchetype.TOWER]:         '#D4A574', // 따뜻한 샌드
  [LandmarkArchetype.PYRAMID]:       '#C8A850', // 사막 골드
  [LandmarkArchetype.DOME]:          '#E8D5B0', // 아이보리
  [LandmarkArchetype.NEEDLE]:        '#B0C4DE', // 스틸 블루
  [LandmarkArchetype.STATUE]:        '#8FBC8F', // 청록 (구리 녹)
  [LandmarkArchetype.WALL]:          '#A0896C', // 갈색 돌
  [LandmarkArchetype.ARENA]:         '#D2B48C', // 탠
  [LandmarkArchetype.BRIDGE]:        '#CD5C5C', // 인디안 레드 (골든게이트)
  [LandmarkArchetype.PAGODA]:        '#B8860B', // 다크 골드로드
  [LandmarkArchetype.SHELLS]:        '#F5F5DC', // 베이지
  [LandmarkArchetype.ONION_DOME]:    '#E6BE8A', // 골드
  [LandmarkArchetype.MOUNTAIN]:      '#708090', // 슬레이트 그레이
  [LandmarkArchetype.TWIN_TOWER]:    '#C0C0C0', // 실버
  [LandmarkArchetype.BRIDGE_TOP]:    '#A9A9A9', // 다크 그레이
  [LandmarkArchetype.SPIRE_CLUSTER]: '#DAA520', // 골든로드
  [LandmarkArchetype.SKYSCRAPER]:    '#B8B8B8', // 밝은 그레이
  [LandmarkArchetype.CLOCK_TOWER]:   '#DEB887', // 벌리우드
  [LandmarkArchetype.TILTED_TOWER]:  '#F5DEB3', // 밀 색
  [LandmarkArchetype.TEMPLE]:        '#DCDCDC', // 대리석 화이트
  [LandmarkArchetype.GATE]:          '#C8B88A', // 사암
  [LandmarkArchetype.WINDMILL]:      '#8B7355', // 나무 브라운
  [LandmarkArchetype.CASTLE]:        '#A9A9A9', // 성 회색
  [LandmarkArchetype.STONE_RING]:    '#808080', // 돌 회색
  [LandmarkArchetype.OBELISK]:       '#F0E68C', // 카키
  [LandmarkArchetype.TERRACE]:       '#9ACD32', // 옐로 그린 (테라스)
  [LandmarkArchetype.MESA]:          '#CD853F', // 페루
  [LandmarkArchetype.MONOLITH]:      '#CC4400', // 울루루 레드
};

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

  const material = useMemo(() => {
    const colorHex = ARCHETYPE_COLORS[group.archetype] || '#CCCCCC';
    return new THREE.MeshStandardMaterial({
      color: colorHex,
      roughness: 0.7,
      metalness: 0.1,
      flatShading: true,
    });
  }, [group.archetype]);

  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

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

  // 언마운트 시 geometry cache 정리
  useEffect(() => {
    return () => {
      disposeGeometryCache();
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
