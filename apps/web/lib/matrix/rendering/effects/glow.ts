/**
 * 글로우/블룸 시스템 - 스킬 이펙트용
 * 다층 블룸 레이어로 화려한 시각 효과 구현
 * v4.9: LOD-aware 최적화 - shouldUseGlow() 체크로 성능 향상
 */

import { PULSE_PATTERNS, PulseType } from './easing';
import { shouldUseGlow } from '../enemies/renderContext';

// ============================================
// LOD-Aware 글로우 헬퍼 함수 (성능 최적화)
// ============================================

/**
 * LOD 기반 글로우 설정 - shadowBlur를 조건부 적용
 * HIGH LOD일 때만 shadowBlur 활성화 (150+ 엔티티에서 자동 비활성화)
 */
export function setGlow(ctx: CanvasRenderingContext2D, color: string, blur: number): void {
  if (shouldUseGlow()) {
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
  }
}

/**
 * 글로우 해제 - LOD 체크 후 shadowBlur만 리셋
 */
export function clearGlow(ctx: CanvasRenderingContext2D): void {
  if (shouldUseGlow()) {
    ctx.shadowBlur = 0;
  }
}

/**
 * 펄스 글로우 설정 - 시간 기반 펄스 + LOD 체크
 */
export function setGlowWithPulse(
  ctx: CanvasRenderingContext2D,
  color: string,
  blur: number,
  time: number,
  pulseIntensity: number = 0.3
): void {
  if (shouldUseGlow()) {
    const pulseBlur = blur * (1 + Math.sin(time) * pulseIntensity);
    ctx.shadowColor = color;
    ctx.shadowBlur = pulseBlur;
  }
}

// 글로우 레이어 타입
export interface GlowLayer {
  blur: number; // 블러 크기 (px)
  alpha: number; // 투명도 (0-1)
  scale: number; // 크기 배율
  color?: string; // 색상 오버라이드 (optional)
}

// 글로우 설정 타입
export interface GlowConfig {
  enabled: boolean;
  layers: GlowLayer[];
  pulseFreq?: number; // 펄스 빈도 (Hz)
  pulseType?: PulseType; // 펄스 패턴 타입
}

// 트레일 설정 타입
export interface TrailConfig {
  enabled: boolean;
  length: number; // 잔상 개수 (max 10)
  decay: number; // 투명도 감소율 (0-1)
  positions: Array<{ x: number; y: number }>; // 이전 위치 기록
}

/**
 * 글로우 프리셋 - 용도별 사전 정의된 레이어 설정
 */
export const GLOW_PRESETS = {
  // 부드러운 글로우 - 일반 이펙트용
  soft: [
    { blur: 20, alpha: 0.2, scale: 1.3 },
    { blur: 10, alpha: 0.4, scale: 1.15 },
    { blur: 5, alpha: 0.6, scale: 1.0 },
  ] as GlowLayer[],

  // 강렬한 글로우 - 폭발/임팩트용
  intense: [
    { blur: 40, alpha: 0.15, scale: 1.5 },
    { blur: 20, alpha: 0.3, scale: 1.25 },
    { blur: 10, alpha: 0.5, scale: 1.1 },
    { blur: 3, alpha: 0.8, scale: 1.0 },
  ] as GlowLayer[],

  // 전기 효과 - 전기/에너지용
  electric: [
    { blur: 30, alpha: 0.1, scale: 1.4, color: '#00ffff' },
    { blur: 15, alpha: 0.25, scale: 1.2 },
    { blur: 5, alpha: 0.7, scale: 1.0 },
  ] as GlowLayer[],

  // 매트릭스 녹색 - NEO 스킬용
  matrix: [
    { blur: 25, alpha: 0.15, scale: 1.4, color: '#00FF41' },
    { blur: 12, alpha: 0.35, scale: 1.2 },
    { blur: 4, alpha: 0.7, scale: 1.0 },
  ] as GlowLayer[],

  // 골든 글로우 - MORPHEUS 스킬용
  golden: [
    { blur: 30, alpha: 0.12, scale: 1.45, color: '#fcd34d' },
    { blur: 15, alpha: 0.3, scale: 1.2, color: '#fbbf24' },
    { blur: 5, alpha: 0.65, scale: 1.0 },
  ] as GlowLayer[],

  // 불꽃 효과 - TANK 스킬용
  fire: [
    { blur: 35, alpha: 0.1, scale: 1.5, color: '#fef08a' },
    { blur: 18, alpha: 0.25, scale: 1.25, color: '#ef4444' },
    { blur: 6, alpha: 0.6, scale: 1.05, color: '#dc2626' },
  ] as GlowLayer[],

  // 코인 반짝임 - CYPHER 스킬용
  coin: [
    { blur: 20, alpha: 0.2, scale: 1.35, color: '#fcd34d' },
    { blur: 8, alpha: 0.5, scale: 1.1, color: '#facc15' },
    { blur: 2, alpha: 0.9, scale: 1.0 },
  ] as GlowLayer[],

  // 성공 효과 - 컴파일 성공 등
  success: [
    { blur: 25, alpha: 0.15, scale: 1.4, color: '#86efac' },
    { blur: 12, alpha: 0.35, scale: 1.15, color: '#22c55e' },
    { blur: 4, alpha: 0.7, scale: 1.0 },
  ] as GlowLayer[],
} as const;

export type GlowPresetType = keyof typeof GLOW_PRESETS;

/**
 * 글로우 렌더링 함수
 * 다층 블룸 레이어를 적용하여 렌더링
 */
export function renderWithGlow(
  ctx: CanvasRenderingContext2D,
  config: GlowConfig,
  drawCore: (ctx: CanvasRenderingContext2D) => void,
  position: { x: number; y: number },
  time: number = Date.now() / 1000
): void {
  if (!config.enabled || config.layers.length === 0) {
    drawCore(ctx);
    return;
  }

  // v4.9: LOD 체크 - LOW/MID LOD에서는 글로우 레이어 스킵, 코어만 렌더링
  if (!shouldUseGlow()) {
    drawCore(ctx);
    return;
  }

  // 펄스 계수 계산
  let pulseMultiplier = 1;
  if (config.pulseFreq && config.pulseFreq > 0) {
    const pulseType = config.pulseType || 'breathe';
    pulseMultiplier = 0.7 + 0.3 * PULSE_PATTERNS[pulseType](time, config.pulseFreq);
  }

  // 글로우 레이어 렌더링 (아래서부터 위로)
  for (const layer of config.layers) {
    ctx.save();

    // 블러 필터 적용 (HIGH LOD only)
    ctx.filter = `blur(${layer.blur}px)`;
    ctx.globalAlpha = layer.alpha * pulseMultiplier;

    // 스케일 적용 (중심점 기준)
    ctx.translate(position.x, position.y);
    ctx.scale(layer.scale, layer.scale);
    ctx.translate(-position.x, -position.y);

    // 색상 오버라이드
    if (layer.color) {
      const originalFillStyle = ctx.fillStyle;
      const originalStrokeStyle = ctx.strokeStyle;
      ctx.fillStyle = layer.color;
      ctx.strokeStyle = layer.color;
      drawCore(ctx);
      ctx.fillStyle = originalFillStyle;
      ctx.strokeStyle = originalStrokeStyle;
    } else {
      drawCore(ctx);
    }

    ctx.restore();
  }

  // 코어 (가장 위, 필터 없음)
  ctx.save();
  ctx.filter = 'none';
  ctx.globalAlpha = 1;
  drawCore(ctx);
  ctx.restore();
}

/**
 * 트레일(잔상) 렌더링 함수
 */
export function renderWithTrail(
  ctx: CanvasRenderingContext2D,
  trail: TrailConfig,
  drawCore: (ctx: CanvasRenderingContext2D, position: { x: number; y: number }, alpha: number) => void,
  currentPosition: { x: number; y: number }
): void {
  if (!trail.enabled || trail.positions.length === 0) {
    drawCore(ctx, currentPosition, 1);
    return;
  }

  // 잔상 렌더링 (오래된 것부터)
  const trailLength = Math.min(trail.positions.length, trail.length);
  for (let i = trailLength - 1; i >= 0; i--) {
    const pos = trail.positions[i];
    const alpha = Math.pow(1 - trail.decay, i + 1);

    ctx.save();
    ctx.globalAlpha = alpha;
    drawCore(ctx, pos, alpha);
    ctx.restore();
  }

  // 현재 위치 (가장 위)
  drawCore(ctx, currentPosition, 1);
}

/**
 * 트레일 위치 업데이트 헬퍼
 */
export function updateTrailPositions(
  trail: TrailConfig,
  currentPosition: { x: number; y: number }
): void {
  if (!trail.enabled) return;

  // 새 위치를 앞에 추가
  trail.positions.unshift({ ...currentPosition });

  // 최대 길이 초과 시 오래된 것 제거
  if (trail.positions.length > trail.length) {
    trail.positions.pop();
  }
}

/**
 * 글로우 + 트레일 결합 렌더링
 */
export function renderWithGlowAndTrail(
  ctx: CanvasRenderingContext2D,
  glowConfig: GlowConfig,
  trailConfig: TrailConfig,
  drawCore: (ctx: CanvasRenderingContext2D, position: { x: number; y: number }) => void,
  currentPosition: { x: number; y: number },
  time: number = Date.now() / 1000
): void {
  // 트레일의 각 위치에 글로우 적용
  if (trailConfig.enabled && trailConfig.positions.length > 0) {
    const trailLength = Math.min(trailConfig.positions.length, trailConfig.length);

    for (let i = trailLength - 1; i >= 0; i--) {
      const pos = trailConfig.positions[i];
      const trailAlpha = Math.pow(1 - trailConfig.decay, i + 1);

      ctx.save();
      ctx.globalAlpha = trailAlpha;

      if (glowConfig.enabled) {
        // 트레일에는 약화된 글로우
        const weakerGlow: GlowConfig = {
          ...glowConfig,
          layers: glowConfig.layers.map((l) => ({
            ...l,
            alpha: l.alpha * 0.5, // 글로우 약화
          })),
        };
        renderWithGlow(ctx, weakerGlow, (c) => drawCore(c, pos), pos, time);
      } else {
        drawCore(ctx, pos);
      }

      ctx.restore();
    }
  }

  // 현재 위치 (풀 글로우)
  if (glowConfig.enabled) {
    renderWithGlow(ctx, glowConfig, (c) => drawCore(c, currentPosition), currentPosition, time);
  } else {
    drawCore(ctx, currentPosition);
  }
}

/**
 * 프리셋으로 글로우 설정 생성
 */
export function createGlowConfig(
  preset: GlowPresetType,
  options?: {
    pulseFreq?: number;
    pulseType?: PulseType;
    customColor?: string;
  }
): GlowConfig {
  const layers = GLOW_PRESETS[preset].map((layer) => ({
    ...layer,
    color: options?.customColor || layer.color,
  }));

  return {
    enabled: true,
    layers,
    pulseFreq: options?.pulseFreq,
    pulseType: options?.pulseType,
  };
}

/**
 * 트레일 설정 생성
 */
export function createTrailConfig(
  length: number = 6,
  decay: number = 0.15
): TrailConfig {
  return {
    enabled: true,
    length: Math.min(length, 10), // 최대 10개
    decay: Math.max(0, Math.min(1, decay)), // 0-1 사이
    positions: [],
  };
}

/**
 * 링 형태 글로우 렌더링 (충격파용)
 */
export function renderGlowRing(
  ctx: CanvasRenderingContext2D,
  position: { x: number; y: number },
  radius: number,
  color: string,
  lineWidth: number = 4,
  glowPreset: GlowPresetType = 'soft',
  pulseFreq: number = 0,
  time: number = Date.now() / 1000
): void {
  const config = createGlowConfig(glowPreset, { pulseFreq, customColor: color });

  const drawRing = (c: CanvasRenderingContext2D) => {
    c.beginPath();
    c.arc(position.x, position.y, radius, 0, Math.PI * 2);
    c.strokeStyle = color;
    c.lineWidth = lineWidth;
    c.stroke();
  };

  renderWithGlow(ctx, config, drawRing, position, time);
}

/**
 * 텍스트 글로우 렌더링
 */
export function renderGlowText(
  ctx: CanvasRenderingContext2D,
  text: string,
  position: { x: number; y: number },
  color: string,
  fontSize: number = 16,
  glowPreset: GlowPresetType = 'soft',
  pulseFreq: number = 0,
  time: number = Date.now() / 1000
): void {
  const config = createGlowConfig(glowPreset, { pulseFreq, customColor: color });

  const drawText = (c: CanvasRenderingContext2D) => {
    c.font = `bold ${fontSize}px monospace`;
    c.fillStyle = color;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(text, position.x, position.y);
  };

  renderWithGlow(ctx, config, drawText, position, time);
}
