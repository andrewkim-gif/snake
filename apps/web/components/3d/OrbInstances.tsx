'use client';

/**
 * OrbInstances — 오브 InstancedMesh 일괄 렌더링
 * BoxGeometry(4,4,4) 복셀 큐브로 MC 스타일 오브 표현
 * maxCount=2000 (서버 최대 오브 수)
 * MeshLambertMaterial + instanceColor (색상 매핑 8종)
 *
 * 애니메이션:
 *   - Y축 bob: 2 + sin(elapsed + idx) * 2 (부유 효과)
 *   - Y축 회전: elapsed * 2 rad/s (스핀)
 *
 * CRITICAL: useFrame priority 0 — auto-render 유지!
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { toWorld } from '@/lib/3d/coordinate-utils';
import type { OrbNetworkData } from '@snake-arena/shared';

// ─── Constants ───

const MAX_ORBS = 2000;

/** 오브 색상 매핑 (c값 0-7) */
const ORB_COLORS: THREE.Color[] = [
  new THREE.Color('#7FFF00'), // 0: 초록 (기본 XP)
  new THREE.Color('#FFD700'), // 1: 금 (고가치)
  new THREE.Color('#FF6B6B'), // 2: 빨강 (death orb)
  new THREE.Color('#87CEEB'), // 3: 하늘 (보너스)
  new THREE.Color('#FF69B4'), // 4: 핑크
  new THREE.Color('#9B59B6'), // 5: 보라
  new THREE.Color('#FF8C00'), // 6: 주황
  new THREE.Color('#00CED1'), // 7: 청록
];

// ─── 재사용 임시 객체 (GC 방지) ───

const _obj = new THREE.Object3D();
const _color = new THREE.Color();

// ─── Props ───

interface OrbInstancesProps {
  /** 오브 데이터 ref (서버 state에서 업데이트) */
  orbsRef: React.MutableRefObject<OrbNetworkData[]>;
}

// ─── Component ───

export function OrbInstances({ orbsRef }: OrbInstancesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);

  // Geometry + Material (한 번만 생성)
  const geometry = useMemo(() => new THREE.BoxGeometry(4, 4, 4), []);
  const material = useMemo(
    () => new THREE.MeshLambertMaterial(),
    [],
  );

  // ─── 클린업 ───
  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  // ─── useFrame: 매 프레임 오브 matrix + color 업데이트 ───
  // priority 0 (기본값) — auto-render 유지
  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const orbs = orbsRef.current;
    const elapsed = clock.getElapsedTime();
    const orbCount = Math.min(orbs.length, MAX_ORBS);

    for (let i = 0; i < orbCount; i++) {
      const orb = orbs[i];

      // ─── 위치: bob 애니메이션 (부유) ───
      const bobY = 2 + Math.sin(elapsed + i) * 2;
      const [wx, wy, wz] = toWorld(orb.x, orb.y, bobY);

      // ─── Y축 회전 (스핀) ───
      _obj.position.set(wx, wy, wz);
      _obj.rotation.set(0, elapsed * 2, 0);
      _obj.scale.setScalar(1);
      _obj.updateMatrix();
      mesh.setMatrixAt(i, _obj.matrix);

      // ─── 색상 (c값 기반) ───
      const colorIdx = Math.min(orb.c, ORB_COLORS.length - 1);
      _color.copy(ORB_COLORS[Math.max(0, colorIdx)]);
      mesh.setColorAt(i, _color);
    }

    // Instance count + needsUpdate
    mesh.count = orbCount;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, MAX_ORBS]}
      frustumCulled={false}
    />
  );
}
