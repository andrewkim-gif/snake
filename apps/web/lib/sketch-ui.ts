/**
 * Premium Dark UI — 세련된 다크 디자인 시스템
 * 딥 다크 + 인디고 액센트 + 글래스모피즘
 * v15: Chakra Petch (heading) + Space Grotesk (body)
 */

/** 프리미엄 다크 팔레트 */
export const SK = {
  // 배경 — 딥 다크
  bg: '#09090B',
  bgWarm: '#0C0D12',
  cardBg: '#141418',
  cardBgHover: '#1C1C22',
  overlay: 'rgba(0, 0, 0, 0.7)',

  // 텍스트 — 소프트 화이트 on 다크
  textPrimary: '#ECECEF',
  textSecondary: '#8B8D98',
  textMuted: '#55565E',
  textWhite: '#FFFFFF',

  // 액센트 — 정제된 색감
  orange: '#F59E0B',
  orangeLight: '#FBBF24',
  orangeDark: '#D97706',
  green: '#10B981',
  greenLight: '#34D399',
  greenDark: '#059669',
  red: '#EF4444',
  redLight: '#F87171',
  redDark: '#DC2626',
  gold: '#F59E0B',
  blue: '#6366F1',

  // 보더 — 화이트 기반 극저 불투명도
  border: 'rgba(255, 255, 255, 0.06)',
  borderDark: 'rgba(255, 255, 255, 0.03)',
  borderFocus: 'rgba(99, 102, 241, 0.5)',
  shadow: 'rgba(0, 0, 0, 0.3)',
  shadowMd: 'rgba(0, 0, 0, 0.4)',
  shadowLg: 'rgba(0, 0, 0, 0.5)',

  // 상태
  statusOnline: '#10B981',
  statusOffline: '#EF4444',
  statusWaiting: '#55565E',
  statusLive: '#10B981',
  statusStarting: '#F59E0B',
  statusEnding: '#EF4444',

  // 3D 씬 / 글로브
  skyBg: '#07080C',
  ocean: '#0A1628',
  land: '#1C1C22',

  // 글래스모피즘 프리셋 — 다크 글래스
  glassBg: 'rgba(14, 14, 18, 0.80)',
  glassBorder: 'rgba(255, 255, 255, 0.06)',
} as const;

/** 폰트 사이즈 스케일 */
export const SKFont = {
  h1: '32px',
  h2: '22px',
  h3: '18px',
  body: '15px',
  sm: '13px',
  xs: '11px',
  button: '16px',
} as const;

/** 타이틀 폰트 — Chakra Petch (사이버펑크/전술) */
export const headingFont = '"Chakra Petch", -apple-system, BlinkMacSystemFont, sans-serif';

/** UI 폰트 — Space Grotesk (클린 테크) */
export const bodyFont = '"Space Grotesk", -apple-system, BlinkMacSystemFont, sans-serif';

/** 라운드 코너 */
export function handDrawnRadius(base = 8) {
  return `${base}px`;
}

/** 라운드 코너 프리셋 */
export const radius = {
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  pill: '9999px',
} as const;

/** 박스 섀도 — 다크 테마 */
export function sketchShadow(level: 'sm' | 'md' | 'lg' = 'md') {
  const shadows = {
    sm: '0 1px 2px rgba(0, 0, 0, 0.4)',
    md: '0 2px 8px rgba(0, 0, 0, 0.4), 0 0 1px rgba(255, 255, 255, 0.04)',
    lg: '0 8px 24px rgba(0, 0, 0, 0.5), 0 0 1px rgba(255, 255, 255, 0.04)',
  };
  return shadows[level];
}

/** 보더 */
export function sketchBorder(color: string = SK.border) {
  return `1px solid ${color}`;
}

/** 서브틀 배경 (카드 배경용 — 미니멀) */
export function tacticalBg() {
  return {};
}

/** 상태별 색상 */
export const statusColors = {
  waiting: { text: 'STANDBY', color: '#55565E', bg: 'rgba(85, 86, 94, 0.15)' },
  countdown: { text: 'DEPLOY', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.12)' },
  playing: { text: 'ACTIVE', color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)' },
  ending: { text: 'ENDING', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.12)' },
  cooldown: { text: 'RESET', color: '#8B8D98', bg: 'rgba(139, 141, 152, 0.1)' },
} as const;
