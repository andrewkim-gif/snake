'use client';

/**
 * useGlobeLOD — 디바이스 성능 기반 LOD(Level of Detail) 설정 훅 (v15 Phase 6)
 *
 * navigator.hardwareConcurrency + 화면 크기로 성능 등급 판별:
 * - Desktop (고성능): 모든 이펙트 활성, 195개국 라벨
 * - Mobile (저성능): 파티클 50%, 라벨 상위 30개국, 무역라인/안개/충격파 비활성화
 *
 * 반환값: GlobeLODConfig 객체 (각 컴포넌트에서 참조)
 */

import { useMemo, useEffect, useState } from 'react';

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
};

// ─── Hook ───

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

export default useGlobeLOD;
