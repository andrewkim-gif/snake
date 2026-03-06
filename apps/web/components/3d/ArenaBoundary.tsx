'use client';

/**
 * ArenaBoundary -- 수축 경계벽
 * CylinderGeometry (open-ended) + 빨간 반투명
 * currentRadius -> smooth lerp 수축 (scale 기반 -- 매 프레임 geometry 재생성 방지)
 * targetRadius -> RingGeometry 미리보기
 * 수축 중: opacity 0.25 -> 0.5 (intensity 증가)
 *
 * useFrame priority 0 필수!
 *
 * 성능 최적화: scale.x/z로 반경 변경 (geometry 재생성 대신)
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface ArenaBoundaryProps {
  /** 현재 아레나 반경 */
  currentRadius: number;
  /** 수축 목표 반경 (수축 예고용, 없으면 currentRadius와 동일) */
  targetRadius?: number;
}

const WALL_HEIGHT = 24;
const WALL_SEGMENTS = 64;
const LERP_SPEED = 0.1;
const BASE_OPACITY = 0.25;
const SHRINK_OPACITY = 0.5;
// 기준 반경 (unit radius = 1.0 에서 시작, scale로 실제 반경 적용)
const UNIT_RADIUS = 1;
// 미리보기 링 기준 반경 (내부: 0.95, 외부: 1.05)
const RING_INNER = 0.95;
const RING_OUTER = 1.05;

export function ArenaBoundary({ currentRadius, targetRadius }: ArenaBoundaryProps) {
  const wallRef = useRef<THREE.Mesh>(null!);
  const previewRef = useRef<THREE.Mesh>(null!);
  const displayRadiusRef = useRef(currentRadius);
  const isShrinking = targetRadius !== undefined && targetRadius < currentRadius;

  // --- 경계벽 Material ---
  const wallMat = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: '#FF3333',
      transparent: true,
      opacity: BASE_OPACITY,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }, []);

  // --- 수축 예고 Material ---
  const previewMat = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: '#FF3333',
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }, []);

  // --- unit-size geometry (한 번만 생성, scale로 반경 조절) ---
  const wallGeo = useMemo(
    () => new THREE.CylinderGeometry(UNIT_RADIUS, UNIT_RADIUS, WALL_HEIGHT, WALL_SEGMENTS, 1, true),
    [],
  );
  const previewGeo = useMemo(
    () => new THREE.RingGeometry(RING_INNER, RING_OUTER, WALL_SEGMENTS),
    [],
  );

  // --- Lerp 수축 + opacity 변화 (scale 기반 -- geometry 재생성 없음) ---
  useFrame(() => {
    if (!wallRef.current) return;

    // Smooth lerp towards currentRadius
    displayRadiusRef.current += (currentRadius - displayRadiusRef.current) * LERP_SPEED;
    const r = displayRadiusRef.current;

    // scale로 반경 적용 (X/Z = 반경, Y = 1 유지)
    wallRef.current.scale.set(r, 1, r);

    // 수축 중이면 opacity 증가
    const targetOpacity = isShrinking ? SHRINK_OPACITY : BASE_OPACITY;
    wallMat.opacity += (targetOpacity - wallMat.opacity) * 0.05;

    // 수축 예고 링 업데이트 (scale로 목표 반경 표시)
    if (previewRef.current && isShrinking && targetRadius !== undefined) {
      previewRef.current.visible = true;
      previewRef.current.scale.set(targetRadius, targetRadius, 1);
    } else if (previewRef.current) {
      previewRef.current.visible = false;
    }
  });

  // --- Cleanup ---
  useEffect(() => {
    return () => {
      wallMat.dispose();
      previewMat.dispose();
      wallGeo.dispose();
      previewGeo.dispose();
    };
  }, [wallMat, previewMat, wallGeo, previewGeo]);

  return (
    <group>
      {/* 경계벽 -- open-ended cylinder (unit radius, scale로 조절) */}
      <mesh ref={wallRef} position-y={WALL_HEIGHT / 2} geometry={wallGeo}>
        <primitive object={wallMat} attach="material" />
      </mesh>

      {/* 수축 예고 링 -- 바닥 원 (unit radius, scale로 조절) */}
      <mesh
        ref={previewRef}
        rotation-x={-Math.PI / 2}
        position-y={0.1}
        visible={isShrinking}
        geometry={previewGeo}
      >
        <primitive object={previewMat} attach="material" />
      </mesh>
    </group>
  );
}
