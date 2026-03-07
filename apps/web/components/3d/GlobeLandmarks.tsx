'use client';

/**
 * GlobeLandmarks — 랜드마크 LOD 매니저 (v20 Phase 2)
 *
 * 카메라 거리에 따라 3단계 LOD 전환:
 *   - Far (>280): LandmarkSprites (빌보드 스프라이트, Tier 1만)
 *   - Mid (150~280): LandmarkMeshes lowPoly (Phase 3에서 추가)
 *   - Close (<150): LandmarkMeshes detail (Phase 3에서 추가)
 *
 * 히스테리시스: Far->Mid at <280, Mid->Far at >320 (40 unit band)
 * Phase 2에서는 Far 모드만 우선 연결.
 */

import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { LANDMARKS, TIER_1_LANDMARKS, TIER_2_LANDMARKS, LandmarkTier } from '@/lib/landmark-data';
import type { Landmark } from '@/lib/landmark-data';
import { LandmarkSprites } from './LandmarkSprites';

// ─── Constants ───

/** LOD 거리 임계값 */
const LOD_FAR_ENTER = 280;   // Mid->Far: camDist > 320
const LOD_FAR_EXIT = 320;    // Far->Mid: camDist < 280
const LOD_MID_ENTER = 130;   // Close->Mid: camDist > 170
const LOD_MID_EXIT = 170;    // Mid->Close: camDist < 130

// ─── Types ───

export interface GlobeLandmarksProps {
  /** 지구 반경 (기본 100) */
  globeRadius?: number;
  /** 최대 랜드마크 표시 수 (useGlobeLOD에서 제어) */
  maxLandmarks?: number;
  /** 랜드마크 디테일 수준 (useGlobeLOD에서 제어) */
  landmarkDetail?: 'high' | 'low';
}

/** LOD 상태: 0=close, 1=mid, 2=far */
type LodLevel = 0 | 1 | 2;

// ─── Component ───

export function GlobeLandmarks({
  globeRadius = 100,
  maxLandmarks = 42,
  landmarkDetail = 'high',
}: GlobeLandmarksProps) {
  const { camera } = useThree();
  const lodRef = useRef<LodLevel>(2); // 기본 Far LOD로 시작

  // Tier 기반 필터링: 표시 가능한 랜드마크 목록
  const farLandmarks = useMemo(() => {
    // Far LOD: Tier 1만 표시
    const tier1 = TIER_1_LANDMARKS;
    // maxLandmarks가 15 이하면 모바일 → 상위 8개만
    if (maxLandmarks <= 15) {
      return tier1.slice(0, 8);
    }
    return tier1;
  }, [maxLandmarks]);

  // useFrame에서 LOD 레벨 업데이트 (히스테리시스 적용)
  useFrame(() => {
    const camDist = camera.position.length();
    const prev = lodRef.current;

    if (prev === 2) {
      // Far → Mid 전환: camDist < 280
      if (camDist < LOD_FAR_ENTER) {
        lodRef.current = 1;
      }
    } else if (prev === 1) {
      // Mid → Far 전환: camDist > 320
      if (camDist > LOD_FAR_EXIT) {
        lodRef.current = 2;
      }
      // Mid → Close 전환: camDist < 130
      else if (camDist < LOD_MID_ENTER) {
        lodRef.current = 0;
      }
    } else {
      // Close → Mid 전환: camDist > 170
      if (camDist > LOD_MID_EXIT) {
        lodRef.current = 1;
      }
    }
  });

  // Phase 2: Far 모드만 렌더링
  // Mid/Close는 Phase 3에서 LandmarkMeshes 컴포넌트 추가 후 연결
  return (
    <group>
      <LandmarkSprites
        landmarks={farLandmarks}
        globeRadius={globeRadius}
        maxSprites={farLandmarks.length}
      />
    </group>
  );
}
