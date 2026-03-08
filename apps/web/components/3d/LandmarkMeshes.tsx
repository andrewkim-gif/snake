'use client';

/**
 * LandmarkMeshes — MC 복셀 스타일 3D 랜드마크 레이어 (v20 Phase 3 MC)
 *
 * 구현:
 *   - Archetype별 InstancedMesh (사용 중인 Archetype 수만큼 draw calls)
 *   - MC 복셀 BoxGeometry (landmark-geometries.ts) — 모든 형상 박스만 사용
 *   - MeshLambertMaterial + flatShading → MC 블록 미학
 *   - 구면 정렬: Quaternion.setFromUnitVectors로 지구 표면 수직 배치
 *   - Backface culling: dot(normal, camDir) < 0.05 → hide, fade 0.05~0.35
 *   - renderOrder = 95 (라벨=100 아래)
 *   - GC 방지: 모듈 스코프 temp 객체 사전 할당
 */

import { useRef, useMemo, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { latLngToVector3 } from '@/lib/globe-utils';
import { LandmarkArchetype } from '@/lib/landmark-data';
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

// MC 스타일 색상 테이블 — 마인크래프트 블록 느낌의 선명한 색상
const ARCHETYPE_COLORS: Record<string, string> = {
  [LandmarkArchetype.TOWER]:         '#B87333', // MC 구리/철 (에펠탑)
  [LandmarkArchetype.PYRAMID]:       '#D4A017', // MC 사암 골드
  [LandmarkArchetype.DOME]:          '#E0C88C', // MC 석영 블록
  [LandmarkArchetype.NEEDLE]:        '#8899AA', // MC 철 블록
  [LandmarkArchetype.STATUE]:        '#5D8A5D', // MC 산화 구리 (녹)
  [LandmarkArchetype.WALL]:          '#7A6652', // MC 돌 벽돌
  [LandmarkArchetype.ARENA]:         '#C19A6B', // MC 사암
  [LandmarkArchetype.BRIDGE]:        '#CC3333', // MC 레드스톤 (골든게이트)
  [LandmarkArchetype.PAGODA]:        '#AA3322', // MC 네더 벽돌 (기와)
  [LandmarkArchetype.SHELLS]:        '#E8E0D0', // MC 석영
  [LandmarkArchetype.ONION_DOME]:    '#DD8833', // MC 구리 (산화 전)
  [LandmarkArchetype.MOUNTAIN]:      '#6B7B6B', // MC 이끼 낀 돌
  [LandmarkArchetype.TWIN_TOWER]:    '#9999AA', // MC 철 블록
  [LandmarkArchetype.BRIDGE_TOP]:    '#8888AA', // MC 돌
  [LandmarkArchetype.SPIRE_CLUSTER]: '#CC8833', // MC 벌집 블록
  [LandmarkArchetype.SKYSCRAPER]:    '#7799BB', // MC 프리즈머린
  [LandmarkArchetype.CLOCK_TOWER]:   '#C8A060', // MC 버치 판자
  [LandmarkArchetype.TILTED_TOWER]:  '#D4C4A4', // MC 석영 + 사암
  [LandmarkArchetype.TEMPLE]:        '#CCCCCC', // MC 매끈한 돌
  [LandmarkArchetype.GATE]:          '#AA9966', // MC 사암 계단
  [LandmarkArchetype.WINDMILL]:      '#8B6914', // MC 오크 판자
  [LandmarkArchetype.CASTLE]:        '#777788', // MC 돌 벽돌
  [LandmarkArchetype.STONE_RING]:    '#666666', // MC 돌
  [LandmarkArchetype.OBELISK]:       '#D4C060', // MC 골드 블록
  [LandmarkArchetype.TERRACE]:       '#669944', // MC 잔디 블록
  [LandmarkArchetype.MESA]:          '#BB6622', // MC 테라코타
  [LandmarkArchetype.MONOLITH]:      '#993311', // MC 적색 사암
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
    const color = new THREE.Color(colorHex);
    // MC 스타일: MeshLambertMaterial + flatShading (복셀 미학)
    return new THREE.MeshLambertMaterial({
      color: color,
      flatShading: true,
      // emissive로 야간에도 형태 보이게 (MC 밝기 레벨 느낌)
      emissive: color.clone().multiplyScalar(0.25),
      emissiveIntensity: 0.5,
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
