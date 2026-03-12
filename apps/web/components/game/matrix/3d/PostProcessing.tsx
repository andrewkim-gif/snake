'use client';

/**
 * PostProcessing.tsx — @react-three/postprocessing 기반 후처리 파이프라인 (S33)
 *
 * 1. Bloom: luminanceThreshold=0.85, intensity=0.5, radius=0.4 (selective bloom)
 * 2. Vignette: offset=0.3, darkness=0.6 (기존 radial gradient 대체)
 * 3. Screen Flash: 별도 overlay div (white, opacity decay)
 * 4. Canvas 2D effect 매핑: screen flash → overlay, color invert → CSS filter
 * 5. Quality Tier별 후처리 설정
 *
 * useFrame priority=0 필수
 * 좌표 매핑: 2D(x,y) → 3D(x, 0, -y)
 */

import React, { useRef, useMemo, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  EffectComposer,
  Bloom,
  Vignette,
} from '@react-three/postprocessing';
import { BlendFunction, KernelSize } from 'postprocessing';
import type { QualityTier } from '@/hooks/useAdaptiveQuality';

// ============================================
// Quality Tier별 후처리 설정
// ============================================

interface PostProcessingConfig {
  bloom: { enabled: boolean; intensity: number; radius: number; threshold: number };
  vignette: { enabled: boolean; darkness: number; offset: number };
}

/** v42 Phase 5: 투사체/이펙트 Bloom + 분위기 Vignette */
const POST_PROCESSING_CONFIGS: Record<QualityTier, PostProcessingConfig> = {
  HIGH: {
    bloom: { enabled: true, intensity: 0.5, radius: 0.4, threshold: 0.7 },
    vignette: { enabled: true, darkness: 0.7, offset: 0.1 },
  },
  MEDIUM: {
    bloom: { enabled: true, intensity: 0.3, radius: 0.3, threshold: 0.8 },
    vignette: { enabled: true, darkness: 0.5, offset: 0.2 },
  },
  LOW: {
    bloom: { enabled: false, intensity: 0, radius: 0, threshold: 1 },
    vignette: { enabled: false, darkness: 0, offset: 0 },
  },
};

// ============================================
// Props
// ============================================

export interface PostProcessingProps {
  /** 현재 품질 티어 */
  qualityTier?: QualityTier;
  /** 위험 경고 강도 (0-1, 안전지대 밖일 때) */
  warningIntensityRef?: React.MutableRefObject<number>;
  /** 활성 여부 */
  enabled?: boolean;
}

/**
 * PostProcessingEffects — R3F Canvas 내부 후처리 이펙트
 *
 * EffectComposer 기반:
 * - Bloom: emissive 오브젝트에 selective bloom
 * - Vignette: 화면 가장자리 어둡게 (기존 radial gradient 대체)
 *
 * Quality Tier에 따라 이펙트 활성/비활성 자동 전환
 */
export function PostProcessingEffects({
  qualityTier = 'HIGH',
  warningIntensityRef,
  enabled = true,
}: PostProcessingProps) {
  // 현재 config 가져오기
  const config = POST_PROCESSING_CONFIGS[qualityTier];

  // 위험 경고 시 vignette darkness 동적 조정
  const vignetteRef = useRef<{ darkness: number }>({ darkness: config.vignette.darkness });

  useFrame(() => {
    if (!warningIntensityRef) return;

    const warningIntensity = warningIntensityRef.current;
    // 기본 darkness + 경고 강도에 비례한 추가 darkness
    vignetteRef.current.darkness = config.vignette.darkness + warningIntensity * 0.4;
  });

  // LOW 품질이거나 비활성이면 후처리 없음
  if (!enabled || qualityTier === 'LOW') {
    return null;
  }

  // Bloom + Vignette 모두 비활성이면 EffectComposer도 마운트하지 않음
  if (!config.bloom.enabled && !config.vignette.enabled) {
    return null;
  }

  return (
    <EffectComposer>
      {config.bloom.enabled ? (
        <Bloom
          intensity={config.bloom.intensity}
          luminanceThreshold={config.bloom.threshold}
          luminanceSmoothing={0.1}
          mipmapBlur
          kernelSize={KernelSize.MEDIUM}
        />
      ) : (
        <></>
      )}

      {config.vignette.enabled ? (
        <Vignette
          offset={config.vignette.offset}
          darkness={vignetteRef.current.darkness}
          blendFunction={BlendFunction.NORMAL}
        />
      ) : (
        <></>
      )}
    </EffectComposer>
  );
}

// ============================================
// Screen Flash Overlay (DOM 기반)
// ============================================

/**
 * Screen Flash 상태 관리 인터페이스
 */
export interface ScreenFlashState {
  /** 현재 활성 여부 */
  active: boolean;
  /** 현재 opacity (0-1) */
  opacity: number;
  /** flash 색상 */
  color: string;
  /** opacity decay 속도 (초당 감소량) */
  decayRate: number;
}

/**
 * useScreenFlash — Screen Flash 상태 관리 훅
 *
 * trigger() 호출 시 white flash 발생 → opacity가 decay rate로 감소
 * Canvas 외부 DOM overlay로 구현 (CSS filter 불필요)
 */
export function useScreenFlash() {
  const flashRef = useRef<ScreenFlashState>({
    active: false,
    opacity: 0,
    color: '#ffffff',
    decayRate: 3.0,
  });

  /** flash 트리거 */
  const trigger = useCallback(
    (options?: { color?: string; intensity?: number; decayRate?: number }) => {
      flashRef.current = {
        active: true,
        opacity: options?.intensity ?? 0.8,
        color: options?.color ?? '#ffffff',
        decayRate: options?.decayRate ?? 3.0,
      };
    },
    []
  );

  /** 매 프레임 업데이트 (requestAnimationFrame 기반) */
  const update = useCallback((dt: number) => {
    const flash = flashRef.current;
    if (!flash.active) return;

    flash.opacity -= flash.decayRate * dt;
    if (flash.opacity <= 0) {
      flash.opacity = 0;
      flash.active = false;
    }
  }, []);

  return { flashRef, trigger, update };
}

/**
 * ScreenFlashOverlay — DOM 기반 화면 플래시 오버레이
 *
 * R3F Canvas 위에 absolute positioning으로 배치.
 * white/red/gold 색상 + opacity decay 애니메이션.
 *
 * 사용법:
 * ```tsx
 * const { flashRef, trigger, update } = useScreenFlash();
 * // useFrame 또는 rAF에서 update(dt) 호출
 * <ScreenFlashOverlay flashRef={flashRef} />
 * ```
 */
export function ScreenFlashOverlay({
  flashRef,
}: {
  flashRef: React.MutableRefObject<ScreenFlashState>;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // requestAnimationFrame 기반 opacity 업데이트 (React re-render 방지)
  React.useEffect(() => {
    let frameId: number;

    const animate = () => {
      const flash = flashRef.current;
      const el = overlayRef.current;
      if (el) {
        if (flash.active && flash.opacity > 0) {
          el.style.opacity = String(flash.opacity);
          el.style.backgroundColor = flash.color;
          el.style.pointerEvents = 'none';
          el.style.display = 'block';
        } else {
          el.style.display = 'none';
        }
      }
      frameId = requestAnimationFrame(animate);
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [flashRef]);

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 10,
        display: 'none',
        backgroundColor: '#ffffff',
        opacity: 0,
        transition: 'none',
      }}
    />
  );
}

export default PostProcessingEffects;
