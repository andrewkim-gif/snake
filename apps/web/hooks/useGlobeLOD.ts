'use client';

/**
 * useGlobeLOD — 디바이스 성능 + 카메라 거리 기반 LOD 설정 훅
 * (v15 Phase 6 + v20 landmark + v24 Phase 6: 3-tier distance LOD + reduced motion)
 *
 * 2개 축의 독립 LOD:
 *   1. 디바이스 성능 (desktop/mobile) — navigator.hardwareConcurrency + 화면 크기
 *   2. 카메라 거리 (close/mid/far) — useFrame에서 실시간 계산, 히스테리시스 적용
 *
 * ⚠️ 카메라 거리 LOD는 R3F Canvas 안에서만 동작 (useFrame 필요).
 *    Canvas 밖 GlobeView 컴포넌트에서 호출 시 distanceTier='close' 고정.
 *    → useGlobeLODDistance() 별도 훅을 Canvas 안 컴포넌트에서 사용.
 *
 * 반환값: GlobeLODConfig 객체
 */

import { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  LOD_DISTANCE,
  ARC_SEGMENTS,
  type DistanceLODTier,
} from '@/lib/effect-constants';

// ─── Types ───

export interface GlobeLODConfig {
  /** 디바이스가 모바일/저사양인지 여부 */
  isMobile: boolean;
  /** 표시할 최대 라벨 수 (모바일: 30, 데스크탑: 200) */
  maxLabels: number;
  /** 동시 미사일 최대 수 (모바일: 3, 데스크탑: 10) */
  maxMissiles: number;
  /** 충격파 링 활성화 여부 (모바일: false) */
  enableShockwave: boolean;
  /** 무역 루트 라인 활성화 여부 (모바일: false) */
  enableTradeRoutes: boolean;
  /** 전장 안개 활성화 여부 (모바일: false) */
  enableWarFog: boolean;
  /** 이벤트 펄스 활성화 여부 (모바일: true, 가벼움) */
  enableEventPulse: boolean;
  /** 파티클 수 배율 (모바일: 0.5, 데스크탑: 1.0) */
  particleMultiplier: number;
  /** 성능 등급 문자열 (디버그용) */
  tier: 'desktop' | 'mobile';

  // ─── v20 Landmark System ───

  /** 표시할 최대 랜드마크 수 (모바일: 15, 데스크탑: 42) */
  maxLandmarks: number;
  /** 랜드마크 디테일 수준 (모바일: 'low', 데스크탑: 'high') */
  landmarkDetail: 'high' | 'low';

  // ─── v23 Phase 6: New Effect LOD Flags ───

  /** 동맹 빛줄기 활성화 여부 (모바일: true, 비교적 가벼움) */
  enableAllianceBeam: boolean;
  /** 제재 차단선 활성화 여부 (모바일: true, 가벼움) */
  enableSanctionBarrier: boolean;
  /** 자원 채굴 글로우 활성화 여부 (모바일: true, 비교적 가벼움) */
  enableResourceGlow: boolean;
  /** 첩보 트레일 활성화 여부 (모바일: true, 가벼움) */
  enableSpyTrail: boolean;
  /** 핵실험 버섯구름 활성화 여부 (모바일: false, 무거움) */
  enableNukeEffect: boolean;
}

/**
 * v24 Phase 6: 카메라 거리 LOD 설정.
 * useGlobeLODDistance() 에서 반환.
 */
export interface DistanceLODConfig {
  /** 카메라 거리 LOD 티어 */
  distanceTier: DistanceLODTier;
  /** LOD에 따른 아크 세그먼트 수 (64/32/16) */
  arcSegments: number;
  /** LOD에 따른 파티클 배율 (1.0/0.5/0.0) */
  particleMultiplier: number;
  /** 카고 메쉬 표시 여부 */
  showCargo: boolean;
  /** 파티클 표시 여부 */
  showParticles: boolean;
  /** 아이콘 표시 여부 (눈, X마크 등) */
  showIcons: boolean;
}

// ─── 감지 함수 ───

function detectMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (typeof window === 'undefined') return false;

  // 1. 하드웨어 코어 수 체크 (4개 이하 = 모바일급)
  const lowCores = (navigator.hardwareConcurrency ?? 8) <= 4;

  // 2. 화면 크기 체크 (768px 미만 = 모바일)
  const smallScreen = window.innerWidth < 768;

  // 3. 터치 디바이스 체크 (보조 판단)
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  // 코어 수 적거나 화면 작으면 모바일로 판단
  return lowCores || smallScreen || (isTouch && smallScreen);
}

// ─── 설정 프리셋 ───

const DESKTOP_CONFIG: GlobeLODConfig = {
  isMobile: false,
  maxLabels: 200,
  maxMissiles: 10,
  enableShockwave: true,
  enableTradeRoutes: true,
  enableWarFog: true,
  enableEventPulse: true,
  particleMultiplier: 1.0,
  tier: 'desktop',
  // v20 Landmark
  maxLandmarks: 42,
  landmarkDetail: 'high',
  // v23 Phase 6: New effects
  enableAllianceBeam: true,
  enableSanctionBarrier: true,
  enableResourceGlow: true,
  enableSpyTrail: true,
  enableNukeEffect: true,
};

const MOBILE_CONFIG: GlobeLODConfig = {
  isMobile: true,
  maxLabels: 30,
  maxMissiles: 3,
  enableShockwave: false,
  enableTradeRoutes: false,
  enableWarFog: false,
  enableEventPulse: true,  // 가벼운 링 이펙트는 유지
  particleMultiplier: 0.5,
  tier: 'mobile',
  // v20 Landmark
  maxLandmarks: 15,
  landmarkDetail: 'low',
  // v23 Phase 6: New effects — disable heavy (nuke), keep light ones
  enableAllianceBeam: true,
  enableSanctionBarrier: true,
  enableResourceGlow: true,
  enableSpyTrail: true,
  enableNukeEffect: false,    // 버섯구름 파티클 무거움 — 모바일 비활성화
};

// ─── Distance LOD 프리셋 ───

const DISTANCE_LOD_CLOSE: DistanceLODConfig = {
  distanceTier: 'close',
  arcSegments: ARC_SEGMENTS.HIGH,     // 64
  particleMultiplier: 1.0,
  showCargo: true,
  showParticles: true,
  showIcons: true,
};

const DISTANCE_LOD_MID: DistanceLODConfig = {
  distanceTier: 'mid',
  arcSegments: ARC_SEGMENTS.MEDIUM,   // 32
  particleMultiplier: 0.5,
  showCargo: false,
  showParticles: true,
  showIcons: true,
};

const DISTANCE_LOD_FAR: DistanceLODConfig = {
  distanceTier: 'far',
  arcSegments: ARC_SEGMENTS.LOW,      // 16
  particleMultiplier: 0.0,
  showCargo: false,
  showParticles: false,
  showIcons: false,
};

// ─── Hook: 디바이스 성능 LOD ───

export function useGlobeLOD(): GlobeLODConfig {
  const [isMobile, setIsMobile] = useState(false);

  // 초기 감지 + 리사이즈 시 재감지
  useEffect(() => {
    setIsMobile(detectMobile());

    const handleResize = () => {
      setIsMobile(detectMobile());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const config = useMemo<GlobeLODConfig>(() => {
    return isMobile ? MOBILE_CONFIG : DESKTOP_CONFIG;
  }, [isMobile]);

  return config;
}

// ─── Hook: 카메라 거리 LOD (R3F Canvas 안에서만 사용) ───

/**
 * v24 Phase 6: 카메라 거리 기반 3단계 LOD 훅.
 * useFrame 내에서 카메라 거리를 실시간 감지하고 히스테리시스를 적용.
 *
 * ⚠️ 반드시 R3F Canvas 안에서 호출해야 함 (useFrame 사용).
 */
export function useGlobeLODDistance(): React.RefObject<DistanceLODConfig> {
  const tierRef = useRef<DistanceLODTier>('close');
  const configRef = useRef<DistanceLODConfig>(DISTANCE_LOD_CLOSE);

  // 매 프레임 카메라 거리 체크 (히스테리시스 적용)
  // v33 perf: useRef 기반 — LOD 경계를 넘어도 React 리렌더가 발생하지 않음
  useFrame(({ camera }) => {
    const dist = camera.position.length();
    const current = tierRef.current;
    let next = current;

    if (current === 'close') {
      if (dist > LOD_DISTANCE.CLOSE_TO_MID) next = 'mid';
    } else if (current === 'mid') {
      if (dist < LOD_DISTANCE.MID_TO_CLOSE) next = 'close';
      else if (dist > LOD_DISTANCE.MID_TO_FAR) next = 'far';
    } else {
      // current === 'far'
      if (dist < LOD_DISTANCE.FAR_TO_MID) next = 'mid';
    }

    if (next !== current) {
      tierRef.current = next;
      switch (next) {
        case 'close': configRef.current = DISTANCE_LOD_CLOSE; break;
        case 'mid':   configRef.current = DISTANCE_LOD_MID;   break;
        case 'far':   configRef.current = DISTANCE_LOD_FAR;   break;
      }
    }
  });

  return configRef;
}

export default useGlobeLOD;
