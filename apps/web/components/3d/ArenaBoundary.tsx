'use client';

/**
 * ArenaBoundary — 수축 경계벽
 * CylinderGeometry (open-ended) + 빨간 반투명
 * currentRadius → smooth lerp 수축
 * targetRadius → 점선 RingGeometry 미리보기
 * 수축 중: opacity 0.25 → 0.5 (intensity 증가)
 *
 * useFrame priority 0 필수!
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

export function ArenaBoundary({ currentRadius, targetRadius }: ArenaBoundaryProps) {
  const wallRef = useRef<THREE.Mesh>(null!);
  const previewRef = useRef<THREE.Mesh>(null!);
  const displayRadiusRef = useRef(currentRadius);
  const isShrinking = targetRadius !== undefined && targetRadius < currentRadius;

  // ─── 경계벽 Material ───
  const wallMat = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: '#FF3333',
      transparent: true,
      opacity: BASE_OPACITY,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }, []);

  // ─── 수축 예고 점선 Material ───
  const previewMat = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: '#FF3333',
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }, []);

  // ─── Lerp 수축 + opacity 변화 ───
  useFrame(() => {
    if (!wallRef.current) return;

    // Smooth lerp towards currentRadius
    displayRadiusRef.current += (currentRadius - displayRadiusRef.current) * LERP_SPEED;
    const r = displayRadiusRef.current;

    // Geometry 업데이트 — CylinderGeometry 재생성 (radius 변경)
    const oldGeo = wallRef.current.geometry;
    wallRef.current.geometry = new THREE.CylinderGeometry(
      r, r, WALL_HEIGHT, WALL_SEGMENTS, 1, true,
    );
    oldGeo.dispose();

    // 수축 중이면 opacity 증가
    const targetOpacity = isShrinking ? SHRINK_OPACITY : BASE_OPACITY;
    wallMat.opacity += (targetOpacity - wallMat.opacity) * 0.05;

    // 수축 예고 링 업데이트
    if (previewRef.current && isShrinking && targetRadius !== undefined) {
      previewRef.current.visible = true;
      const prevGeo = previewRef.current.geometry;
      previewRef.current.geometry = new THREE.RingGeometry(
        targetRadius - 8, targetRadius + 8, WALL_SEGMENTS,
      );
      prevGeo.dispose();
    } else if (previewRef.current) {
      previewRef.current.visible = false;
    }
  });

  // ─── Cleanup ───
  useEffect(() => {
    return () => {
      wallMat.dispose();
      previewMat.dispose();
    };
  }, [wallMat, previewMat]);

  return (
    <group>
      {/* 경계벽 — open-ended cylinder */}
      <mesh ref={wallRef} position-y={WALL_HEIGHT / 2}>
        <cylinderGeometry args={[currentRadius, currentRadius, WALL_HEIGHT, WALL_SEGMENTS, 1, true]} />
        <primitive object={wallMat} attach="material" />
      </mesh>

      {/* 수축 예고 링 — 바닥에 점선 원 */}
      <mesh
        ref={previewRef}
        rotation-x={-Math.PI / 2}
        position-y={0.1}
        visible={isShrinking}
      >
        <ringGeometry args={[
          (targetRadius ?? currentRadius) - 8,
          (targetRadius ?? currentRadius) + 8,
          WALL_SEGMENTS,
        ]} />
        <primitive object={previewMat} attach="material" />
      </mesh>
    </group>
  );
}
