/**
 * mobile-ux.ts - v37 Phase 9: 모바일 UX 최적화 유틸리티
 *
 * 순수 TypeScript (React 의존 없음).
 * 모바일 환경 감지 + 터치 최적화 상수 + 조이스틱 영역 계산.
 *
 * 사용법:
 *   import { isTouchDevice, TOUCH_TARGETS, getJoystickZone } from './mobile-ux';
 */

// ============================================
// 모바일 환경 감지
// ============================================

/**
 * 터치 디바이스 여부 (한 번 계산 후 캐시)
 */
let _isTouchCached: boolean | null = null;

export function isTouchDevice(): boolean {
  if (_isTouchCached !== null) return _isTouchCached;
  if (typeof window === 'undefined') return false;

  _isTouchCached = (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0
  );
  return _isTouchCached;
}

/**
 * 모바일 디바이스 여부 (화면 크기 + 터치 조합)
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return isTouchDevice() && window.innerWidth < 768;
}

/**
 * 태블릿 디바이스 여부
 */
export function isTabletDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return isTouchDevice() && window.innerWidth >= 768 && window.innerWidth < 1024;
}

/**
 * 터치 캐시 리셋 (윈도우 리사이즈 시 호출용)
 */
export function resetTouchCache(): void {
  _isTouchCached = null;
}

// ============================================
// 터치 타겟 상수 (WCAG 2.1 AA 준수)
// ============================================

/**
 * 터치 영역 최소 크기 + 간격 (px)
 * WCAG 2.1 기준: 최소 44px × 44px
 */
export const TOUCH_TARGETS = {
  /** 최소 터치 영역 크기 */
  MIN_SIZE: 44,
  /** 터치 영역 간 최소 간격 */
  MIN_GAP: 8,
  /** 버튼 최소 높이 */
  MIN_BUTTON_HEIGHT: 48,
  /** 리스트 아이템 최소 높이 */
  MIN_LIST_ITEM_HEIGHT: 56,
  /** 카드 최소 터치 영역 */
  MIN_CARD_SIZE: 64,
} as const;

// ============================================
// 레벨업 모달 모바일 설정
// ============================================

export const LEVELUP_MOBILE = {
  /** 카드 너비 (화면 너비의 %) */
  CARD_WIDTH_PERCENT: 90,
  /** 카드 최소 높이 */
  CARD_MIN_HEIGHT: 140,
  /** 스와이프 인식 최소 거리 (px) */
  SWIPE_THRESHOLD: 50,
  /** 스와이프 인식 최대 시간 (ms) */
  SWIPE_MAX_TIME: 300,
  /** 카드 간격 (px) */
  CARD_GAP: 12,
  /** 자동 선택 타이머 (초) */
  AUTO_SELECT_TIMER: 10,
} as const;

// ============================================
// 상점 모바일 설정
// ============================================

export const SHOP_MOBILE = {
  /** 아이템 카드 최소 높이 */
  ITEM_MIN_HEIGHT: 64,
  /** 아이템 간 간격 */
  ITEM_GAP: 8,
  /** 구매 버튼 최소 너비 */
  BUY_BUTTON_MIN_WIDTH: 80,
  /** 패널 최대 너비 (모바일) */
  PANEL_MAX_WIDTH: 320,
  /** 패널 최대 높이 (뷰포트의 %) */
  PANEL_MAX_HEIGHT_PERCENT: 70,
} as const;

// ============================================
// 조이스틱 영역 최적화
// ============================================

/**
 * 조이스틱 영역 설정
 */
export interface JoystickZone {
  /** 조이스틱 활성 영역 왼쪽 경계 */
  left: number;
  /** 조이스틱 활성 영역 위쪽 경계 */
  top: number;
  /** 조이스틱 활성 영역 너비 */
  width: number;
  /** 조이스틱 활성 영역 높이 */
  height: number;
  /** 조이스틱 외부 원 반지름 */
  outerRadius: number;
  /** 조이스틱 내부 원 반지름 */
  innerRadius: number;
  /** 데드존 반지름 (이 안에서는 입력 무시) */
  deadZone: number;
}

/**
 * 현재 화면 크기에 맞는 조이스틱 영역 계산
 */
export function getJoystickZone(): JoystickZone {
  const vpW = typeof window !== 'undefined' ? window.innerWidth : 1920;
  const vpH = typeof window !== 'undefined' ? window.innerHeight : 1080;
  const mobile = isMobileDevice();
  const tablet = isTabletDevice();

  // 화면 하단 좌측 영역 (전체 화면의 40%)
  const zoneWidth = vpW * 0.4;
  const zoneHeight = vpH * 0.5;

  // 모바일일수록 큰 조이스틱
  const outerRadius = mobile ? 50 : tablet ? 45 : 40;
  const innerRadius = mobile ? 25 : tablet ? 22 : 20;
  const deadZone = mobile ? 8 : 5;

  return {
    left: 0,
    top: vpH - zoneHeight,
    width: zoneWidth,
    height: zoneHeight,
    outerRadius,
    innerRadius,
    deadZone,
  };
}

// ============================================
// 스와이프 감지 헬퍼
// ============================================

export type SwipeDirection = 'left' | 'right' | 'up' | 'down' | null;

/**
 * 스와이프 방향 감지
 * @param startX 터치 시작 X
 * @param startY 터치 시작 Y
 * @param endX 터치 끝 X
 * @param endY 터치 끝 Y
 * @param threshold 인식 최소 거리 (기본 50px)
 * @returns 스와이프 방향 또는 null
 */
export function detectSwipe(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  threshold: number = LEVELUP_MOBILE.SWIPE_THRESHOLD,
): SwipeDirection {
  const dx = endX - startX;
  const dy = endY - startY;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  if (absDx < threshold && absDy < threshold) return null;

  if (absDx > absDy) {
    return dx > 0 ? 'right' : 'left';
  } else {
    return dy > 0 ? 'down' : 'up';
  }
}

// ============================================
// CSS 인라인 스타일 헬퍼
// ============================================

/**
 * 모바일 대응 터치 친화적 인라인 스타일 생성
 * (CSS module 없이 React 컴포넌트에서 바로 사용)
 */
export function getTouchFriendlyStyle(
  baseStyle: Record<string, string | number>,
): Record<string, string | number> {
  if (!isTouchDevice()) return baseStyle;

  return {
    ...baseStyle,
    minWidth: Math.max(
      TOUCH_TARGETS.MIN_SIZE,
      typeof baseStyle.minWidth === 'number' ? baseStyle.minWidth : 0,
    ),
    minHeight: Math.max(
      TOUCH_TARGETS.MIN_SIZE,
      typeof baseStyle.minHeight === 'number' ? baseStyle.minHeight : 0,
    ),
    touchAction: 'manipulation',
    WebkitTapHighlightColor: 'transparent',
    userSelect: 'none',
    WebkitUserSelect: 'none',
  };
}

/**
 * 모바일용 HUD 스케일 팩터 (화면이 작으면 HUD 축소)
 */
export function getHUDScaleFactor(): number {
  if (typeof window === 'undefined') return 1;
  const vpW = window.innerWidth;
  if (vpW < 480) return 0.7;
  if (vpW < 768) return 0.85;
  if (vpW < 1024) return 0.95;
  return 1;
}
