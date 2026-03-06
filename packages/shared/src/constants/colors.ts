/**
 * Snake Arena — Color Constants v6.0
 * Crayon / Pencil Sketch on Paper — 거친 손그림 스타일
 */

/** Orb 색상 (16색 — 12 crayon + 4 special) */
export const ORB_COLORS = [
  '#C75B5B', // 0: 크레용 레드
  '#D4914A', // 1: 크레용 오렌지
  '#D4C36A', // 2: 크레용 옐로우
  '#7BA868', // 3: 크레용 그린
  '#5B8DAD', // 4: 크레용 블루
  '#8B72A8', // 5: 크레용 퍼플
  '#C47A8E', // 6: 크레용 핑크
  '#7DB89A', // 7: 크레용 민트
  '#82ADC8', // 8: 크레용 스카이
  '#B8926A', // 9: 크레용 브라운
  '#A89070', // 10: 크레용 탄
  '#6A9B7E', // 11: 크레용 세이지
  '#C9A84C', // 12: magnet (크레용 골드)
  '#4A8BA8', // 13: speed (크레용 딥 블루)
  '#A8A098', // 14: ghost (연필 그레이)
  '#B85050', // 15: mega (크레용 딥 레드)
] as const;

/** 게임 UI 색상 (Crayon Sketch on Paper 스타일) */
export const COLORS = {
  /** 인게임 배경: 따뜻한 종이색 */
  BACKGROUND: '#F5F0E8',
  /** 그리드: 연필 라이트 */
  GRID_PATTERN: '#A89888',
  /** 경계 경고: 크레용 오렌지 */
  BOUNDARY_WARNING: '#D4914A',
  /** 경계 글로우: 연필 미디엄 알파 */
  BOUNDARY_GLOW: 'rgba(107, 94, 82, 0.2)',
  /** UI 텍스트: 연필 다크 */
  UI_TEXT: '#3A3028',
  /** UI 보조 텍스트: 연필 미디엄 */
  UI_TEXT_SECONDARY: '#6B5E52',
  /** 미니맵 배경 */
  MINIMAP_BG: 'rgba(245, 240, 232, 0.9)',
  /** 미니맵 테두리: 연필 미디엄 */
  MINIMAP_BORDER: '#6B5E52',
  /** 미니맵 플레이어: 크레용 오렌지 */
  MINIMAP_PLAYER: '#D4914A',
  /** 미니맵 타인: 크레용 레드 */
  MINIMAP_OTHER: '#C75B5B',
  /** 리더보드 배경 */
  LEADERBOARD_BG: 'rgba(245, 240, 232, 0.92)',
  /** 리더보드 내 순위: 크레용 오렌지 */
  LEADERBOARD_SELF: '#D4914A',
  /** 사망 오버레이: 종이색 반투명 */
  DEATH_OVERLAY: 'rgba(245, 240, 232, 0.94)',
  /** 경계 밖 어둠: 종이 그레인 */
  BOUNDARY_OUTSIDE: 'rgba(168, 152, 136, 0.35)',

  // ─── HUD Colors (Sketch) ───
  /** HUD 패널 배경: 종이색 반투명 */
  HUD_PANEL_BG: 'rgba(245, 240, 232, 0.92)',
  /** HUD 패널 테두리: 연필 미디엄 */
  HUD_PANEL_BORDER: '#6B5E52',
  /** HUD 패널 내부 테두리: 연필 라이트 */
  HUD_PANEL_INNER: 'rgba(168, 152, 136, 0.15)',
  /** 부스트 바: 크레용 오렌지 */
  HUD_BOOST_BAR: '#D4914A',
  /** 부스트 바 배경 */
  HUD_BOOST_BG: 'rgba(58, 48, 40, 0.08)',
  /** 부스트 LOW: 크레용 레드 */
  HUD_BOOST_LOW: '#C75B5B',
  /** 킬 피드 하이라이트: 크레용 오렌지 */
  HUD_KILL_HIGHLIGHT: '#D4914A',
  /** 킬 피드 사망: 크레용 레드 */
  HUD_DEATH_HIGHLIGHT: '#C75B5B',
  /** 점수 팝업: 크레용 오렌지 */
  HUD_SCORE_POPUP: '#D4914A',
  /** 순위 뱃지: 크레용 오렌지 */
  HUD_RANK_BADGE: '#D4914A',
  /** 순위 뱃지 텍스트: 종이색 */
  HUD_RANK_TEXT: '#F5F0E8',
  /** 순위 뱃지 그라디언트 끝: 크레용 딥 오렌지 */
  HUD_RANK_BADGE_END: '#B87A3A',
  /** 스네이크 아웃라인: 연필 다크 */
  ENTITY_OUTLINE: '#3A3028',
  /** 오브 아웃라인: 연필 다크 */
  ORB_OUTLINE: 'rgba(58, 48, 40, 0.5)',
} as const;
