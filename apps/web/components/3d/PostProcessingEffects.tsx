'use client';

/**
 * PostProcessingEffects — @react-three/postprocessing EffectComposer
 *
 * v16 Phase 7: 포스트프로세싱 효과
 * - 크로매틱 수차 (피격 시 강도 증가)
 * - 비네팅 (항상 미세하게, 부스트/저체력 시 강화)
 * - 설정: Off / Low / High
 * - 모바일: CSS overlay fallback (이 컴포넌트 밖에서 처리)
 *
 * CRITICAL: useFrame priority 0 — auto-render 유지!
 */

import { useMemo } from 'react';
import {
  EffectComposer,
  ChromaticAberration,
  Vignette,
} from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { Vector2 } from 'three';

// ─── Types ───

export type FXQualityLevel = 'off' | 'low' | 'high';

interface PostProcessingEffectsProps {
  /** 효과 품질 (off=비활성, low=비네팅만, high=전부) */
  quality: FXQualityLevel;
  /** 크로매틱 수차 강도 (0~1) — 피격/저체력 시 외부에서 제어 */
  chromaticIntensity?: number;
  /** 비네팅 강도 (0~1) — 기본 0.3, 부스트/저체력 시 증가 */
  vignetteIntensity?: number;
}

export function PostProcessingEffects({
  quality,
  chromaticIntensity = 0,
  vignetteIntensity = 0.3,
}: PostProcessingEffectsProps) {
  // off이면 아무것도 렌더링 안 함
  if (quality === 'off') return null;

  // low: 비네팅만
  if (quality === 'low') {
    return <PostFXLow vignetteIntensity={vignetteIntensity} />;
  }

  // high: 비네팅 + 크로매틱 수차
  return (
    <PostFXHigh
      vignetteIntensity={vignetteIntensity}
      chromaticIntensity={chromaticIntensity}
    />
  );
}

// ─── Low Quality: Vignette Only ───

function PostFXLow({ vignetteIntensity }: { vignetteIntensity: number }) {
  return (
    <EffectComposer multisampling={0}>
      <Vignette
        offset={0.3}
        darkness={vignetteIntensity}
        blendFunction={BlendFunction.NORMAL}
      />
    </EffectComposer>
  );
}

// ─── High Quality: Vignette + Chromatic Aberration ───

function PostFXHigh({
  vignetteIntensity,
  chromaticIntensity,
}: {
  vignetteIntensity: number;
  chromaticIntensity: number;
}) {
  // 크로매틱 수차 offset — 강도에 비례 (0~0.01 범위)
  const offset = useMemo(() => new Vector2(0, 0), []);
  const val = chromaticIntensity * 0.008;
  offset.set(val, val);

  return (
    <EffectComposer multisampling={0}>
      <Vignette
        offset={0.3}
        darkness={vignetteIntensity}
        blendFunction={BlendFunction.NORMAL}
      />
      <ChromaticAberration
        offset={offset}
        blendFunction={BlendFunction.NORMAL}
        radialModulation={false}
        modulationOffset={0}
      />
    </EffectComposer>
  );
}

// ─── 모바일 CSS Overlay Fallback ───

interface CSSVignetteProps {
  /** 0~1 강도 */
  intensity: number;
  /** 추가 색상 (저체력=빨강, 부스트=파랑) */
  color?: string;
}

/** CSS 비네팅 오버레이 (모바일/저사양 기기용) */
export function CSSVignetteOverlay({ intensity, color = 'rgba(0,0,0' }: CSSVignetteProps) {
  if (intensity <= 0) return null;

  const alpha = Math.min(0.8, intensity * 0.6).toFixed(2);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 10,
        background: `radial-gradient(ellipse at center, transparent 40%, ${color},${alpha}) 100%)`,
      }}
    />
  );
}

/** CSS 크로매틱 수차 시뮬레이션 (모바일용 — 적색/청색 보더) */
export function CSSChromaticOverlay({ intensity }: { intensity: number }) {
  if (intensity <= 0.05) return null;

  const spread = Math.round(intensity * 4); // 0~4px

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 10,
        boxShadow: `inset ${spread}px 0 ${spread * 2}px rgba(255,0,0,${intensity * 0.3}), inset -${spread}px 0 ${spread * 2}px rgba(0,0,255,${intensity * 0.3})`,
      }}
    />
  );
}
