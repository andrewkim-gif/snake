/**
 * overlay-tokens.ts -- v24 Globe Effects Overhaul: 2D Overlay Design Tokens
 *
 * "Holographic War Room" 통일 디자인 시스템의 2D 오버레이 부문.
 * NewsFeed, GlobeHoverPanel, AgentSetup, LeftBar 등 모든 패널에 적용.
 *
 * 현재 불일치 현황 (코드 감사 결과):
 *   배경: rgba(14,14,18, 0.85~0.95) — 컴포넌트마다 다름
 *   blur:  8px ~ 24px — 제각각
 *   전환:  150ms ~ 600ms — 혼재
 *   border: 다양한 rgba 값
 *
 * 통일 후: 단일 OVERLAY 객체에서 참조.
 */

import { EFFECT_COLORS } from './effect-constants';

// ===================================================================
// 1. Panel Background & Glass Tokens
// ===================================================================

/**
 * 통일 오버레이 토큰.
 * 모든 패널/모달/팝오버에 일관되게 적용할 시각 속성.
 */
export const OVERLAY = {
  /** 패널 배경색 (rgba(9, 9, 11, 0.90)) */
  bg: 'rgba(9, 9, 11, 0.90)',
  /** backdrop-filter blur */
  blur: 'blur(12px)',
  /** 기본 보더 */
  border: '1px solid rgba(255, 255, 255, 0.08)',
  /** 전환 속도 */
  transition: '300ms ease',
  /** 보더 반경 (전술 스타일: 0) */
  borderRadius: '0px',
} as const;

/**
 * 헬퍼: 패널 공통 스타일 객체 반환.
 * style={{...overlayPanelStyle()}} 패턴으로 사용.
 */
export function overlayPanelStyle(): Record<string, string> {
  return {
    background: OVERLAY.bg,
    backdropFilter: OVERLAY.blur,
    WebkitBackdropFilter: OVERLAY.blur,
    border: OVERLAY.border,
    borderRadius: OVERLAY.borderRadius,
    transition: `all ${OVERLAY.transition}`,
  };
}

// ===================================================================
// 2. News Event Type Colors (3D 이펙트 색상과 동기화)
// ===================================================================

/**
 * 뉴스피드 이벤트 타입별 CSS 색상.
 * effect-constants.ts의 EFFECT_COLORS.css와 동기화.
 *
 * 기존 매핑 (NewsFeed.tsx newsTypeColors):
 *   sovereignty_change: '#22C55E' -> trade.css (영토 변경은 교역/녹색 계열)
 *   battle_start:       '#EF4444' -> war.css
 *   battle_end:         '#F59E0B' -> resource.css (승리/보상)
 *   war_declared:       '#FF0000' -> war.css
 *   treaty_signed:      '#3B82F6' -> alliance.css
 *   economy_event:      '#CC9933' -> resource.css
 *   season_event:       '#8B5CF6' -> epoch.css
 *   global_event:       '#EC4899' -> spy.css (글로벌/미스터리)
 */
export const NEWS_TYPE_COLORS: Record<string, string> = {
  sovereignty_change: EFFECT_COLORS.trade.hex,
  battle_start:       EFFECT_COLORS.war.hex,
  battle_end:         EFFECT_COLORS.resource.hex,
  war_declared:       EFFECT_COLORS.war.hex,
  treaty_signed:      EFFECT_COLORS.alliance.hex,
  economy_event:      EFFECT_COLORS.resource.hex,
  season_event:       EFFECT_COLORS.epoch.hex,
  global_event:       EFFECT_COLORS.spy.hex,
};

// ===================================================================
// 3. CSS Animation Keyframes (중복 제거)
// ===================================================================

/**
 * 통일 pulse 키프레임 (기존 2곳 중복 대체).
 * 사용: <style>{KEYFRAMES_PULSE}</style> 또는 styled-jsx 내.
 */
export const KEYFRAMES_PULSE = `
  @keyframes effectPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }
`;

/**
 * 통일 fadeIn 키프레임 (기존 3곳 중복 대체).
 */
export const KEYFRAMES_FADE_IN = `
  @keyframes effectFadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`;

/**
 * 통일 slideIn 키프레임 (좌측에서 슬라이드).
 */
export const KEYFRAMES_SLIDE_IN = `
  @keyframes effectSlideIn {
    from { opacity: 0; transform: translateX(-8px); }
    to   { opacity: 1; transform: translateX(0); }
  }
`;

// ===================================================================
// 4. Accent Glow Helpers
// ===================================================================

/**
 * 이벤트 타입에 따른 글로우 box-shadow CSS 생성.
 * 뉴스피드 태그, 패널 강조 등에 사용.
 *
 * @param eventType 이벤트 유형 키 (EFFECT_COLORS 키)
 * @param intensity 글로우 강도 (0-1)
 * @returns CSS box-shadow 문자열
 */
export function accentGlow(
  eventType: keyof typeof EFFECT_COLORS,
  intensity: number = 0.3,
): string {
  const color = EFFECT_COLORS[eventType]?.hex ?? EFFECT_COLORS.epoch.hex;
  return `0 0 ${Math.round(12 * intensity)}px ${color}${Math.round(intensity * 255).toString(16).padStart(2, '0')}`;
}
