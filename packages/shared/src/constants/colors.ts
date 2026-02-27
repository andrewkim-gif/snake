/**
 * Snake Arena — Color Constants v3.0
 * Brawl Stars 스타일 — Bold, Vivid, Cartoon (thick outlines + saturated colors)
 */

/** Orb 색상 (12색 — Brawl Stars 스타일 비비드 팔레트) */
export const ORB_COLORS = [
  '#FFD700', // gold yellow
  '#00D4FF', // electric blue
  '#FF1493', // hot pink
  '#39FF14', // neon green
  '#FF6B00', // bright orange
  '#9B59B6', // vivid purple
  '#FF4444', // bright red
  '#00FFFF', // cyan
  '#FF6B6B', // coral
  '#ADFF2F', // lime
  '#FF00FF', // magenta
  '#00CED1', // teal
] as const;

/** 게임 UI 색상 (Brawl Stars — Bold Cartoon Style) */
export const COLORS = {
  /** 인게임 배경: 딥 네이비 */
  BACKGROUND: '#0F1923',
  /** 그리드: 약간 밝은 네이비 */
  GRID_PATTERN: '#1A2B3A',
  /** 경계 경고: 밝은 레드 + 오렌지 */
  BOUNDARY_WARNING: '#FF3B3B',
  /** 경계 글로우: 레드 알파 */
  BOUNDARY_GLOW: 'rgba(255, 59, 59, 0.4)',
  /** UI 텍스트: 밝은 화이트 */
  UI_TEXT: '#FFFFFF',
  /** UI 보조 텍스트: 밝은 그레이 */
  UI_TEXT_SECONDARY: '#B0BEC5',
  /** 미니맵 배경 */
  MINIMAP_BG: 'rgba(10, 15, 25, 0.9)',
  /** 미니맵 테두리: 밝은 블루 */
  MINIMAP_BORDER: '#00D4FF',
  /** 미니맵 플레이어: 네온 그린 */
  MINIMAP_PLAYER: '#39FF14',
  /** 미니맵 타인: 밝은 레드 */
  MINIMAP_OTHER: '#FF6B6B',
  /** 리더보드 배경 */
  LEADERBOARD_BG: 'rgba(10, 15, 25, 0.85)',
  /** 리더보드 내 순위: 골드 */
  LEADERBOARD_SELF: '#FFD700',
  /** 사망 오버레이: 다크 반투명 */
  DEATH_OVERLAY: 'rgba(0, 0, 0, 0.85)',
  /** 경계 밖 어둠 */
  BOUNDARY_OUTSIDE: 'rgba(5, 5, 15, 0.75)',

  // ─── HUD Colors (Brawl Stars Bold Cartoon) ───
  /** HUD 패널 배경: 짙은 퍼플-블루 */
  HUD_PANEL_BG: 'rgba(25, 20, 60, 0.9)',
  /** HUD 패널 테두리: 두꺼운 블랙 */
  HUD_PANEL_BORDER: '#000000',
  /** HUD 패널 내부 테두리: 밝은 하이라이트 */
  HUD_PANEL_INNER: 'rgba(255, 255, 255, 0.15)',
  /** 부스트 바: 네온 그린 */
  HUD_BOOST_BAR: '#39FF14',
  /** 부스트 바 배경 */
  HUD_BOOST_BG: 'rgba(0, 0, 0, 0.5)',
  /** 부스트 LOW: 밝은 레드 */
  HUD_BOOST_LOW: '#FF3B3B',
  /** 킬 피드 하이라이트: 네온 그린 */
  HUD_KILL_HIGHLIGHT: '#39FF14',
  /** 킬 피드 사망: 핫 오렌지 */
  HUD_DEATH_HIGHLIGHT: '#FF6B00',
  /** 점수 팝업: 골드 */
  HUD_SCORE_POPUP: '#FFD700',
  /** 순위 뱃지: 골드 그라디언트 시작 */
  HUD_RANK_BADGE: '#FFD700',
  /** 순위 뱃지 텍스트: 다크 */
  HUD_RANK_TEXT: '#1A0A00',
  /** 순위 뱃지 그라디언트 끝 */
  HUD_RANK_BADGE_END: '#FF8C00',
  /** 스네이크 아웃라인: 블랙 */
  ENTITY_OUTLINE: '#000000',
  /** 오브 아웃라인: 어두운 색 */
  ORB_OUTLINE: 'rgba(0, 0, 0, 0.6)',
} as const;
