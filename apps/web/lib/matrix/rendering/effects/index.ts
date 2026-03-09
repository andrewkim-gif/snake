/**
 * Effects Module Index
 * 스킬 이펙트 시스템 통합 모듈
 */

// 이징 함수
export {
  EASING,
  PULSE_PATTERNS,
  applyEasing,
  lerp,
  lerpColor,
  lerpVector,
  getSequenceDelay,
  type EasingType,
  type EasingFunction,
  type PulseType,
} from './easing';

// 글로우/블룸 시스템 (v4.9: LOD-aware 헬퍼 추가)
export {
  GLOW_PRESETS,
  renderWithGlow,
  renderWithTrail,
  renderWithGlowAndTrail,
  updateTrailPositions,
  createGlowConfig,
  createTrailConfig,
  renderGlowRing,
  renderGlowText,
  // v4.9: LOD-aware 글로우 헬퍼 함수
  setGlow,
  clearGlow,
  setGlowWithPulse,
  type GlowLayer,
  type GlowConfig,
  type TrailConfig,
  type GlowPresetType,
} from './glow';
