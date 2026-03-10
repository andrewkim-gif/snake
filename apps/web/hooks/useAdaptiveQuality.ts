'use client';

/**
 * useAdaptiveQuality — 런타임 FPS 모니터링 + 자동 품질 티어 조절 시스템
 * (v33 Phase 5: AdaptiveQuality)
 *
 * FPS 측정:
 *   - useFrame 내에서 rolling average (최근 60프레임)
 *   - delta 기반 FPS 계산 (1/delta)
 *
 * 품질 티어:
 *   - HIGH:   FPS >= 50 (기본, 현재와 동일한 풀 품질)
 *   - MEDIUM: FPS < 40 이 3초 연속 → Bloom 비활성화 등
 *   - LOW:    FPS < 25 가 3초 연속 → 구름/별 숨기기, 이펙트 최소화
 *
 * 승급 조건 (보수적):
 *   - FPS >= 55가 5초 연속이면 한 단계 승급
 *
 * ⚠️ R3F Canvas 안에서만 호출 (useFrame 사용).
 *    Canvas 밖에서는 useAdaptiveQualityContext()로 읽기만 가능.
 */

import { useRef, useCallback, createContext, useContext } from 'react';
import { useFrame } from '@react-three/fiber';

// ─── Types ───

export type QualityTier = 'HIGH' | 'MEDIUM' | 'LOW';

export interface QualityPreset {
  /** 품질 티어 이름 */
  tier: QualityTier;
  /** Bloom 활성화 여부 */
  enableBloom: boolean;
  /** Bloom luminance threshold (HIGH일 때만 유효) */
  bloomThreshold: number;
  /** 구름 레이어 표시 여부 */
  enableClouds: boolean;
  /** 별/은하수 배경 표시 여부 */
  enableStars: boolean;
  /** 이펙트 프레임 스킵 배율 (1=매 프레임, 2=매 2프레임, 4=매 4프레임) */
  effectFrameSkip: number;
  /** 랜드마크 디테일 감소 여부 */
  reduceLandmarks: boolean;
}

// ─── 프리셋 정의 ───

const PRESET_HIGH: QualityPreset = {
  tier: 'HIGH',
  enableBloom: true,
  bloomThreshold: 0.7,
  enableClouds: true,
  enableStars: true,
  effectFrameSkip: 1,
  reduceLandmarks: false,
};

const PRESET_MEDIUM: QualityPreset = {
  tier: 'MEDIUM',
  enableBloom: false,     // Bloom = 가장 큰 성능 영향
  bloomThreshold: 0.7,
  enableClouds: true,
  enableStars: false,     // 별 숨기기
  effectFrameSkip: 2,    // 매 2프레임
  reduceLandmarks: false,
};

const PRESET_LOW: QualityPreset = {
  tier: 'LOW',
  enableBloom: false,
  bloomThreshold: 0.7,
  enableClouds: false,    // 구름 숨기기
  enableStars: false,
  effectFrameSkip: 4,    // 매 4프레임
  reduceLandmarks: true,
};

const PRESETS: Record<QualityTier, QualityPreset> = {
  HIGH: PRESET_HIGH,
  MEDIUM: PRESET_MEDIUM,
  LOW: PRESET_LOW,
};

// ─── FPS 임계값 ───

/** 다운그레이드 임계값 */
const DOWNGRADE_TO_MEDIUM_FPS = 40;
const DOWNGRADE_TO_LOW_FPS = 25;

/** 다운그레이드에 필요한 연속 저FPS 시간 (초) */
const DOWNGRADE_DURATION = 3.0;

/** 업그레이드 임계값 */
const UPGRADE_FPS = 55;

/** 업그레이드에 필요한 연속 고FPS 시간 (초) */
const UPGRADE_DURATION = 5.0;

/** Rolling average 윈도우 크기 */
const FPS_WINDOW_SIZE = 60;

// ─── Context (전역 공유, 리렌더 없음 — ref 기반) ───

/**
 * AdaptiveQualityContext — useRef 기반 품질 프리셋 공유.
 * React Context지만 값은 MutableRefObject이므로 리렌더를 유발하지 않음.
 */
export const AdaptiveQualityContext = createContext<React.RefObject<QualityPreset>>(
  { current: PRESET_HIGH } as React.RefObject<QualityPreset>,
);

/** 소비자 훅: 현재 품질 프리셋 ref 읽기 */
export function useAdaptiveQualityContext(): React.RefObject<QualityPreset> {
  return useContext(AdaptiveQualityContext);
}

// ─── Main Hook ───

/**
 * FPS 모니터링 + 자동 품질 조절 훅.
 * R3F Canvas 안에서 한 번만 호출해야 함 (GlobeScene 수준).
 *
 * @returns qualityRef — 현재 품질 프리셋에 대한 ref (리렌더 없음)
 */
export function useAdaptiveQuality(): React.RefObject<QualityPreset> {
  // 현재 품질 프리셋 (ref 기반, 리렌더 없음)
  const qualityRef = useRef<QualityPreset>(PRESET_HIGH);
  const tierRef = useRef<QualityTier>('HIGH');

  // FPS rolling average 버퍼
  const fpsBuffer = useRef<Float32Array>(new Float32Array(FPS_WINDOW_SIZE));
  const fpsIndex = useRef(0);
  const fpsFilled = useRef(false);

  // 다운그레이드/업그레이드 타이머 (연속 시간 추적)
  const downgradeTimer = useRef(0);
  const upgradeTimer = useRef(0);

  // 안정화: 티어 변경 후 쿨다운 (급격한 oscillation 방지)
  const lastTierChangeTime = useRef(0);
  const TIER_CHANGE_COOLDOWN = 3.0; // 티어 변경 후 3초간 추가 변경 금지

  // v37: clock 리셋 감지용 (frameloop demand→always 전환 시 clock.elapsedTime이 0으로 리셋됨)
  const lastElapsedRef = useRef(0);

  useFrame((_state, delta) => {
    // delta가 비정상적으로 클 때 (탭 전환 등) 무시
    if (delta > 0.5) return;

    const elapsed = _state.clock.elapsedTime;

    // v37: clock 리셋 감지 — frameloop 전환 시 elapsedTime이 0으로 돌아감
    // FPS 버퍼와 타이머를 리셋하여 이전 세션 데이터로 잘못된 다운그레이드 방지
    if (elapsed < lastElapsedRef.current - 1) {
      fpsBuffer.current.fill(0);
      fpsIndex.current = 0;
      fpsFilled.current = false;
      downgradeTimer.current = 0;
      upgradeTimer.current = 0;
      lastTierChangeTime.current = 0;
      lastElapsedRef.current = elapsed;
      return;
    }
    lastElapsedRef.current = elapsed;

    const fps = 1 / Math.max(delta, 0.001);

    // Rolling average 업데이트
    const buf = fpsBuffer.current;
    buf[fpsIndex.current] = fps;
    fpsIndex.current = (fpsIndex.current + 1) % FPS_WINDOW_SIZE;
    if (fpsIndex.current === 0) fpsFilled.current = true;

    // 평균 FPS 계산
    const count = fpsFilled.current ? FPS_WINDOW_SIZE : fpsIndex.current;
    if (count === 0) return;

    let sum = 0;
    for (let i = 0; i < count; i++) sum += buf[i];
    const avgFps = sum / count;

    // 쿨다운 체크
    if (elapsed - lastTierChangeTime.current < TIER_CHANGE_COOLDOWN) {
      return;
    }

    const currentTier = tierRef.current;

    // ── 다운그레이드 로직 ──
    let targetDownTier: QualityTier | null = null;

    if (currentTier === 'HIGH' && avgFps < DOWNGRADE_TO_MEDIUM_FPS) {
      targetDownTier = 'MEDIUM';
    } else if (currentTier === 'MEDIUM' && avgFps < DOWNGRADE_TO_LOW_FPS) {
      targetDownTier = 'LOW';
    } else if (currentTier === 'HIGH' && avgFps < DOWNGRADE_TO_LOW_FPS) {
      // HIGH에서 바로 LOW로 (매우 낮은 FPS)
      targetDownTier = 'LOW';
    }

    if (targetDownTier) {
      downgradeTimer.current += delta;
      upgradeTimer.current = 0; // 업그레이드 타이머 리셋

      if (downgradeTimer.current >= DOWNGRADE_DURATION) {
        // 다운그레이드 실행
        tierRef.current = targetDownTier;
        qualityRef.current = PRESETS[targetDownTier];
        downgradeTimer.current = 0;
        lastTierChangeTime.current = elapsed;
      }
    } else {
      downgradeTimer.current = 0;
    }

    // ── 업그레이드 로직 (보수적) ──
    if (currentTier !== 'HIGH' && avgFps >= UPGRADE_FPS) {
      upgradeTimer.current += delta;

      if (upgradeTimer.current >= UPGRADE_DURATION) {
        // 한 단계 승급
        const nextTier: QualityTier = currentTier === 'LOW' ? 'MEDIUM' : 'HIGH';
        tierRef.current = nextTier;
        qualityRef.current = PRESETS[nextTier];
        upgradeTimer.current = 0;
        lastTierChangeTime.current = elapsed;
      }
    } else if (avgFps < UPGRADE_FPS) {
      upgradeTimer.current = 0;
    }
  });

  return qualityRef;
}

/**
 * 유틸: 현재 프레임에서 이펙트를 업데이트해야 하는지 체크.
 * 기존 frameCountRef 패턴과 통합하여 품질 티어 + 거리 LOD 기반 스킵.
 *
 * @param frameCount - 현재 프레임 카운터 (호출 측에서 매 프레임 증가)
 * @param qualitySkip - QualityPreset.effectFrameSkip (1/2/4)
 * @param distanceSkip - 거리 LOD 기반 추가 스킵 (기본 1)
 * @returns true = 이번 프레임에서 업데이트 수행
 */
export function shouldUpdateEffect(
  frameCount: number,
  qualitySkip: number,
  distanceSkip: number = 1,
): boolean {
  // 두 스킵 배율 중 큰 값 사용 (중복 곱셈 방지)
  const skip = Math.max(qualitySkip, distanceSkip);
  return skip <= 1 || (frameCount % skip === 0);
}

export { PRESETS as QUALITY_PRESETS };
export default useAdaptiveQuality;
