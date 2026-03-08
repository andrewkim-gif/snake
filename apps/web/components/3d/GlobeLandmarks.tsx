'use client';

/**
 * GlobeLandmarks — 랜드마크 LOD 매니저 (v20 Phase 3)
 *
 * 카메라 거리에 따라 3단계 LOD 전환:
 *   - Far (>320): LandmarkMeshes (Tier 1만 15개 3D 형상)
 *   - Mid (170~320): LandmarkMeshes (Tier 1+2, ~30개 3D 형상)
 *   - Close (<170): LandmarkMeshes (전체 42개 3D 형상)
 *
 * 모든 줌 레벨에서 3D 메시 사용 (스프라이트는 제거 — 3D가 훨씬 나음)
 * 히스테리시스: ±20 unit band (플리커 방지)
 */

import { useRef, useMemo, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { LANDMARKS, TIER_1_LANDMARKS, TIER_2_LANDMARKS } from '@/lib/landmark-data';
import { LandmarkMeshes } from './LandmarkMeshes';

// ─── Constants ───

const LOD_FAR_ENTER = 300;   // Far→Mid: camDist < 300
const LOD_FAR_EXIT = 340;    // Mid→Far: camDist > 340
const LOD_MID_ENTER = 160;   // Mid→Close: camDist < 160
const LOD_MID_EXIT = 200;    // Close→Mid: camDist > 200

// ─── Types ───

export interface GlobeLandmarksProps {
  globeRadius?: number;
  maxLandmarks?: number;
  landmarkDetail?: 'high' | 'low';
}

type LodLevel = 0 | 1 | 2;

// ─── Component ───

export function GlobeLandmarks({
  globeRadius = 100,
  maxLandmarks = 42,
}: GlobeLandmarksProps) {
  const { camera } = useThree();
  const lodRef = useRef<LodLevel>(2);
  const [lodLevel, setLodLevel] = useState<LodLevel>(2);

  // Tier 기반 필터링
  const farLandmarks = useMemo(() => {
    // Far: Tier 1만 (15개), 모바일이면 상위 8개
    if (maxLandmarks <= 15) return TIER_1_LANDMARKS.slice(0, 8);
    return TIER_1_LANDMARKS;
  }, [maxLandmarks]);

  const midLandmarks = useMemo(() => {
    if (maxLandmarks <= 15) return TIER_1_LANDMARKS;
    return TIER_2_LANDMARKS; // Tier 1+2 (30개)
  }, [maxLandmarks]);

  const closeLandmarks = useMemo(() => {
    if (maxLandmarks <= 15) return TIER_2_LANDMARKS;
    return LANDMARKS; // 전체 42개
  }, [maxLandmarks]);

  useFrame(() => {
    const camDist = camera.position.length();
    const prev = lodRef.current;
    let next = prev;

    if (prev === 2) {
      if (camDist < LOD_FAR_ENTER) next = 1;
    } else if (prev === 1) {
      if (camDist > LOD_FAR_EXIT) next = 2;
      else if (camDist < LOD_MID_ENTER) next = 0;
    } else {
      if (camDist > LOD_MID_EXIT) next = 1;
    }

    if (next !== prev) {
      lodRef.current = next;
      setLodLevel(next);
    }
  });

  // 모든 레벨에서 3D 메시 사용, Tier만 다름
  const activeLandmarks = lodLevel === 2 ? farLandmarks
    : lodLevel === 1 ? midLandmarks
    : closeLandmarks;

  return (
    <group>
      <LandmarkMeshes
        landmarks={activeLandmarks}
        globeRadius={globeRadius}
      />
    </group>
  );
}
