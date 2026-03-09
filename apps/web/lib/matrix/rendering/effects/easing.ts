/**
 * 이징 함수 라이브러리 - 스킬 이펙트용
 * 모든 움직임에 가속/감속 적용으로 자연스러운 애니메이션 구현
 */

// 기본 타입
export type EasingFunction = (t: number) => number;
export type EasingType = keyof typeof EASING;

/**
 * 이징 함수 컬렉션
 * t: 0~1 사이의 진행도
 * 반환: 0~1 사이의 이징된 값
 */
export const EASING = {
  // === 선형 ===
  linear: (t: number): number => t,

  // === Ease In (가속) - 느리게 시작 ===
  easeInQuad: (t: number): number => t * t,
  easeInCubic: (t: number): number => t * t * t,
  easeInQuart: (t: number): number => t * t * t * t,
  easeInQuint: (t: number): number => t * t * t * t * t,
  easeInExpo: (t: number): number => (t === 0 ? 0 : Math.pow(2, 10 * t - 10)),
  easeInCirc: (t: number): number => 1 - Math.sqrt(1 - t * t),
  easeInSine: (t: number): number => 1 - Math.cos((t * Math.PI) / 2),

  // === Ease Out (감속) - 빠르게 시작, 느리게 끝 ===
  // 폭발, 확산 효과에 적합
  easeOutQuad: (t: number): number => 1 - (1 - t) * (1 - t),
  easeOutCubic: (t: number): number => 1 - Math.pow(1 - t, 3),
  easeOutQuart: (t: number): number => 1 - Math.pow(1 - t, 4),
  easeOutQuint: (t: number): number => 1 - Math.pow(1 - t, 5),
  easeOutExpo: (t: number): number => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  easeOutCirc: (t: number): number => Math.sqrt(1 - Math.pow(t - 1, 2)),
  easeOutSine: (t: number): number => Math.sin((t * Math.PI) / 2),

  // === Ease In Out (가속 후 감속) - 부드러운 전환 ===
  easeInOutQuad: (t: number): number =>
    t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  easeInOutCubic: (t: number): number =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  easeInOutQuart: (t: number): number =>
    t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2,
  easeInOutExpo: (t: number): number =>
    t === 0
      ? 0
      : t === 1
        ? 1
        : t < 0.5
          ? Math.pow(2, 20 * t - 10) / 2
          : (2 - Math.pow(2, -20 * t + 10)) / 2,
  easeInOutSine: (t: number): number => -(Math.cos(Math.PI * t) - 1) / 2,

  // === Elastic (탄성) - 바운스 효과 ===
  easeOutElastic: (t: number): number => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0
      ? 0
      : t === 1
        ? 1
        : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
  easeInElastic: (t: number): number => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0
      ? 0
      : t === 1
        ? 1
        : -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
  },
  easeInOutElastic: (t: number): number => {
    const c5 = (2 * Math.PI) / 4.5;
    return t === 0
      ? 0
      : t === 1
        ? 1
        : t < 0.5
          ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * c5)) / 2
          : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * c5)) / 2 +
            1;
  },

  // === Bounce (바운스) ===
  easeOutBounce: (t: number): number => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) {
      return n1 * t * t;
    } else if (t < 2 / d1) {
      return n1 * (t -= 1.5 / d1) * t + 0.75;
    } else if (t < 2.5 / d1) {
      return n1 * (t -= 2.25 / d1) * t + 0.9375;
    } else {
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    }
  },
  easeInBounce: (t: number): number => 1 - EASING.easeOutBounce(1 - t),
  easeInOutBounce: (t: number): number =>
    t < 0.5
      ? (1 - EASING.easeOutBounce(1 - 2 * t)) / 2
      : (1 + EASING.easeOutBounce(2 * t - 1)) / 2,

  // === Back (오버슈트) - 살짝 넘어갔다 돌아옴 ===
  easeOutBack: (t: number): number => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  easeInBack: (t: number): number => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return c3 * t * t * t - c1 * t * t;
  },
  easeInOutBack: (t: number): number => {
    const c1 = 1.70158;
    const c2 = c1 * 1.525;
    return t < 0.5
      ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
      : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
  },
} as const;

/**
 * 펄스/리듬 패턴 함수
 * t: 현재 시간 (초)
 * freq: 빈도 (Hz)
 * 반환: 0~1 사이의 펄스 값
 */
export const PULSE_PATTERNS = {
  // 심장박동 - 빠른 두 번 펄스
  heartbeat: (t: number, freq: number): number => {
    const cycle = (t * freq) % 1;
    if (cycle < 0.1) return Math.sin((cycle * Math.PI) / 0.1);
    if (cycle < 0.3) return Math.sin(((cycle - 0.1) * Math.PI) / 0.2);
    return 0;
  },

  // 호흡 - 부드러운 사인파
  breathe: (t: number, freq: number): number =>
    (Math.sin(t * freq * Math.PI * 2) + 1) / 2,

  // 스트로브 - 깜빡임
  strobe: (t: number, freq: number): number =>
    Math.floor(((t * freq) % 1) * 2),

  // 웨이브 - 위상 조절 가능한 파동
  wave: (t: number, freq: number, phase: number = 0): number =>
    (Math.sin(t * freq * Math.PI * 2 + phase) + 1) / 2,

  // 스파이크 - 급격한 상승 후 감쇠
  spike: (t: number, freq: number): number => {
    const cycle = (t * freq) % 1;
    return Math.pow(1 - cycle, 3);
  },

  // 트라이앵글 - 선형 증가/감소
  triangle: (t: number, freq: number): number => {
    const cycle = (t * freq) % 1;
    return cycle < 0.5 ? cycle * 2 : 2 - cycle * 2;
  },

  // 사각파 - 온/오프
  square: (t: number, freq: number, duty: number = 0.5): number =>
    (t * freq) % 1 < duty ? 1 : 0,
} as const;

export type PulseType = keyof typeof PULSE_PATTERNS;

/**
 * 이징 적용 헬퍼 함수
 */
export function applyEasing(
  progress: number,
  easingType: EasingType = 'linear'
): number {
  const clampedProgress = Math.max(0, Math.min(1, progress));
  return EASING[easingType](clampedProgress);
}

/**
 * 값 보간 with 이징
 */
export function lerp(
  start: number,
  end: number,
  progress: number,
  easingType: EasingType = 'linear'
): number {
  const easedProgress = applyEasing(progress, easingType);
  return start + (end - start) * easedProgress;
}

/**
 * 색상 보간 (HEX)
 */
export function lerpColor(
  colorA: string,
  colorB: string,
  progress: number,
  easingType: EasingType = 'linear'
): string {
  const easedProgress = applyEasing(progress, easingType);

  // HEX to RGB
  const parseHex = (hex: string) => {
    const clean = hex.replace('#', '');
    return {
      r: parseInt(clean.substring(0, 2), 16),
      g: parseInt(clean.substring(2, 4), 16),
      b: parseInt(clean.substring(4, 6), 16),
    };
  };

  const a = parseHex(colorA);
  const b = parseHex(colorB);

  const r = Math.round(a.r + (b.r - a.r) * easedProgress);
  const g = Math.round(a.g + (b.g - a.g) * easedProgress);
  const bl = Math.round(a.b + (b.b - a.b) * easedProgress);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
}

/**
 * 벡터 보간
 */
export function lerpVector(
  start: { x: number; y: number },
  end: { x: number; y: number },
  progress: number,
  easingType: EasingType = 'linear'
): { x: number; y: number } {
  const easedProgress = applyEasing(progress, easingType);
  return {
    x: start.x + (end.x - start.x) * easedProgress,
    y: start.y + (end.y - start.y) * easedProgress,
  };
}

/**
 * 순차 딜레이 계산
 * 여러 파티클을 순차적으로 발동할 때 사용
 */
export function getSequenceDelay(
  index: number,
  total: number,
  totalDuration: number,
  easingType: EasingType = 'linear'
): number {
  const normalizedIndex = index / (total - 1);
  const easedIndex = applyEasing(normalizedIndex, easingType);
  return easedIndex * totalDuration;
}
