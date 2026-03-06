'use client';

/**
 * AuraRings — Agent 발 아래 전투 오라 시각화
 * RingGeometry(0, 60, 32) 반투명 원 — 전투 오라 범위 표시
 * InstancedMesh: maxCount=60 (MAX_AGENTS)
 * MeshBasicMaterial, transparent, opacity=0.08
 *
 * 애니메이션: 펄스 scale = 1 + sin(elapsed * 3) * 0.05
 * 색상: Agent의 primaryColor (skinId 기반)
 * 방향: rotation-x = -PI/2 (수평 배치)
 *
 * CRITICAL: useFrame priority 0 — auto-render 유지!
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { toWorld } from '@/lib/3d/coordinate-utils';
import { DEFAULT_SKINS } from '@snake-arena/shared';
import type { AgentNetworkData } from '@snake-arena/shared';

// ─── Constants ───

const MAX_AGENTS = 60;
const AURA_RADIUS = 60;
const HALF_PI = Math.PI / 2;

// ─── 스킨별 primaryColor 캐시 (THREE.Color) ───

const skinColorCache = new Map<number, THREE.Color>();

function getSkinColor(skinId: number): THREE.Color {
  let cached = skinColorCache.get(skinId);
  if (cached) return cached;

  const skin = DEFAULT_SKINS[skinId] ?? DEFAULT_SKINS[0];
  cached = new THREE.Color(skin.primaryColor);
  skinColorCache.set(skinId, cached);
  return cached;
}

// ─── 재사용 임시 객체 (GC 방지) ───

const _obj = new THREE.Object3D();
const _color = new THREE.Color();

// ─── Props ───

interface AuraRingsProps {
  /** 보간된 Agent 배열 (GameLoop에서 업데이트) */
  agentsRef: React.MutableRefObject<AgentNetworkData[]>;
}

// ─── Component ───

export function AuraRings({ agentsRef }: AuraRingsProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);

  // Geometry + Material (한 번만 생성)
  const geometry = useMemo(
    () => new THREE.RingGeometry(0, AURA_RADIUS, 32),
    [],
  );
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
    [],
  );

  // ─── 클린업 ───
  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
      skinColorCache.clear();
    };
  }, [geometry, material]);

  // ─── useFrame: 매 프레임 오라 링 matrix + color 업데이트 ───
  // priority 0 (기본값)
  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const agents = agentsRef.current;
    const elapsed = clock.getElapsedTime();

    // 펄스 스케일: 1 + sin(elapsed * 3) * 0.05
    const pulse = 1 + Math.sin(elapsed * 3) * 0.05;

    let idx = 0;

    for (const agent of agents) {
      if (idx >= MAX_AGENTS) break;

      // 위치: Agent 발 아래 (height = 0.5)
      const [wx, wy, wz] = toWorld(agent.x, agent.y, 0.5);

      _obj.position.set(wx, wy, wz);
      // 수평 배치: X축 -90도 회전
      _obj.rotation.set(-HALF_PI, 0, 0);
      // 펄스 스케일
      _obj.scale.setScalar(pulse);
      _obj.updateMatrix();
      mesh.setMatrixAt(idx, _obj.matrix);

      // Agent primaryColor (skinId 기반)
      _color.copy(getSkinColor(agent.k));
      mesh.setColorAt(idx, _color);

      idx++;
    }

    // Instance count + needsUpdate
    mesh.count = idx;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, MAX_AGENTS]}
      frustumCulled={false}
    />
  );
}
