'use client';

/**
 * GlobeLandmarks — 195국 랜드마크 LOD 매니저 (v20 Phase 3 리팩토링)
 *
 * countryCentroids (GeoJSON 기반)에서 ~195개 랜드마크를 동적 생성.
 * 카메라 거리에 따라 3단계 LOD 전환:
 *   - Far (>320): Tier 1만 (~28개 S+A Tier, 3D 메시)
 *   - Mid (170~320): Tier 1+2 (~68개, 3D 메시)
 *   - Close (<170): 전체 (~195개, 3D 메시)
 *
 * 히스테리시스: ±20 unit band (플리커 방지)
 */

import { useRef, useMemo, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { generateLandmarksFromCentroids, filterByTier, LandmarkTier } from '@/lib/landmark-data';
import { LandmarkMeshes } from './LandmarkMeshes';

// ─── Constants ───

const LOD_FAR_ENTER = 300;
const LOD_FAR_EXIT = 340;
const LOD_MID_ENTER = 160;
const LOD_MID_EXIT = 200;

// ─── Types ───

export interface GlobeLandmarksProps {
  countryCentroids: Map<string, [number, number]>;
  globeRadius?: number;
  maxLandmarks?: number;
  landmarkDetail?: 'high' | 'low';
}

type LodLevel = 0 | 1 | 2;

// ─── Component ───

export function GlobeLandmarks({
  countryCentroids,
  globeRadius = 100,
  maxLandmarks = 200,
}: GlobeLandmarksProps) {
  const { camera } = useThree();
  const lodRef = useRef<LodLevel>(2);
  const [lodLevel, setLodLevel] = useState<LodLevel>(2);

  // 전체 랜드마크 생성 (centroids 변경 시에만)
  const allLandmarks = useMemo(() => {
    if (countryCentroids.size === 0) return [];
    return generateLandmarksFromCentroids(countryCentroids);
  }, [countryCentroids]);

  // Tier 기반 필터링
  const farLandmarks = useMemo(() => {
    const filtered = filterByTier(allLandmarks, LandmarkTier.TIER_1);
    if (maxLandmarks <= 30) return filtered.slice(0, 15);
    return filtered;
  }, [allLandmarks, maxLandmarks]);

  const midLandmarks = useMemo(() => {
    const filtered = filterByTier(allLandmarks, LandmarkTier.TIER_2);
    if (maxLandmarks <= 30) return filterByTier(allLandmarks, LandmarkTier.TIER_1);
    return filtered;
  }, [allLandmarks, maxLandmarks]);

  const closeLandmarks = useMemo(() => {
    if (maxLandmarks <= 30) return filterByTier(allLandmarks, LandmarkTier.TIER_2);
    return allLandmarks;
  }, [allLandmarks, maxLandmarks]);

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

  const activeLandmarks = lodLevel === 2 ? farLandmarks
    : lodLevel === 1 ? midLandmarks
    : closeLandmarks;

  if (activeLandmarks.length === 0) return null;

  return (
    <group>
      <LandmarkMeshes
        landmarks={activeLandmarks}
        globeRadius={globeRadius}
      />
    </group>
  );
}
