'use client';

/**
 * GlobeLandmarks — 랜드마크 LOD 매니저 (v20 Phase 3)
 *
 * 카메라 거리에 따라 3단계 LOD 전환:
 *   - Far (>280): LandmarkSprites (빌보드 스프라이트, Tier 1만)
 *   - Mid (150~280): LandmarkMeshes (Tier 1+2, ~30개 3D 형상)
 *   - Close (<150): LandmarkMeshes (전체 42개 3D 형상)
 *
 * 히스테리시스: Far↔Mid ±20, Mid↔Close ±20 (40 unit band)
 * React 리렌더 유발: useState로 LOD 변경 시 자식 컴포넌트 전환
 */

import { useRef, useMemo, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { LANDMARKS, TIER_1_LANDMARKS, TIER_2_LANDMARKS } from '@/lib/landmark-data';
import { LandmarkSprites } from './LandmarkSprites';
import { LandmarkMeshes } from './LandmarkMeshes';

// ─── Constants ───

/** LOD 거리 임계값 (히스테리시스 적용) */
const LOD_FAR_ENTER = 280;   // Far→Mid: camDist < 280
const LOD_FAR_EXIT = 320;    // Mid→Far: camDist > 320
const LOD_MID_ENTER = 130;   // Mid→Close: camDist < 130
const LOD_MID_EXIT = 170;    // Close→Mid: camDist > 170

// ─── Types ───

export interface GlobeLandmarksProps {
  globeRadius?: number;
  maxLandmarks?: number;
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
  const lodRef = useRef<LodLevel>(2);
  const [lodLevel, setLodLevel] = useState<LodLevel>(2);

  // Tier 기반 필터링
  const farLandmarks = useMemo(() => {
    const tier1 = TIER_1_LANDMARKS;
    if (maxLandmarks <= 15) return tier1.slice(0, 8);
    return tier1;
  }, [maxLandmarks]);

  const midLandmarks = useMemo(() => {
    // Mid: Tier 1+2 (30개)
    if (maxLandmarks <= 15) return TIER_1_LANDMARKS;
    return TIER_2_LANDMARKS;
  }, [maxLandmarks]);

  const closeLandmarks = useMemo(() => {
    // Close: 전체 (42개) 또는 모바일이면 Tier 1+2
    if (maxLandmarks <= 15) return TIER_2_LANDMARKS;
    return LANDMARKS;
  }, [maxLandmarks]);

  // useFrame에서 LOD 레벨 업데이트 (히스테리시스 적용)
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

  return (
    <group>
      {/* Far LOD: 빌보드 스프라이트 */}
      {lodLevel === 2 && (
        <LandmarkSprites
          landmarks={farLandmarks}
          globeRadius={globeRadius}
          maxSprites={farLandmarks.length}
        />
      )}

      {/* Mid LOD: 3D 로우폴리 형상 (Tier 1+2) */}
      {lodLevel === 1 && (
        <LandmarkMeshes
          landmarks={midLandmarks}
          globeRadius={globeRadius}
        />
      )}

      {/* Close LOD: 3D 디테일 형상 (전체) */}
      {lodLevel === 0 && (
        <LandmarkMeshes
          landmarks={closeLandmarks}
          globeRadius={globeRadius}
        />
      )}
    </group>
  );
}
