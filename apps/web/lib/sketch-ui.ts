/**
 * Modern Light UI — 밝고 클린한 디자인 시스템
 * 라이트 톤 + 블루 액센트 + 모던 가독성 (Inter 폰트)
 */

/** 라이트 컬러 팔레트 */
export const SK = {
  // 배경 — 밝은 톤
  bg: '#F8FAFC',
  bgWarm: '#F1F5F9',
  cardBg: '#FFFFFF',
  cardBgHover: '#F8FAFC',
  overlay: 'rgba(0, 0, 0, 0.4)',

  // 텍스트 — 다크 on 라이트
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  textWhite: '#FFFFFF',

  // 액센트
  orange: '#D97706',
  orangeLight: '#F59E0B',
  orangeDark: '#B45309',
  green: '#16A34A',
  greenLight: '#22C55E',
  greenDark: '#15803D',
  red: '#DC2626',
  redLight: '#EF4444',
  redDark: '#B91C1C',
  gold: '#D97706',
  blue: '#3B82F6',

  // 보더
  border: 'rgba(0, 0, 0, 0.08)',
  borderDark: 'rgba(0, 0, 0, 0.04)',
  borderFocus: 'rgba(59, 130, 246, 0.5)',
  shadow: 'rgba(0, 0, 0, 0.04)',
  shadowMd: 'rgba(0, 0, 0, 0.06)',
  shadowLg: 'rgba(0, 0, 0, 0.1)',

  // 상태
  statusOnline: '#22C55E',
  statusOffline: '#EF4444',
  statusWaiting: '#94A3B8',
  statusLive: '#22C55E',
  statusStarting: '#D97706',
  statusEnding: '#DC2626',

  // 3D 씬 / 글로브
  skyBg: '#E8F4FD',
  ocean: '#93B5CF',
  land: '#E2E8F0',

  // 글래스모피즘 프리셋
  glassBg: 'rgba(255, 255, 255, 0.85)',
  glassBorder: 'rgba(0, 0, 0, 0.06)',
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

/** 타이틀 폰트 — Inter Heavy (Black Ops One 교체) */
export const headingFont = '"Inter", -apple-system, BlinkMacSystemFont, sans-serif';

/** UI 폰트 — Inter */
export const bodyFont = '"Inter", -apple-system, BlinkMacSystemFont, sans-serif';

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

/** 박스 섀도 */
export function sketchShadow(level: 'sm' | 'md' | 'lg' = 'md') {
  const shadows = {
    sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
    md: '0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)',
    lg: '0 4px 6px rgba(0, 0, 0, 0.06), 0 2px 4px rgba(0, 0, 0, 0.04)',
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
  waiting: { text: 'STANDBY', color: '#94A3B8', bg: 'rgba(148, 163, 184, 0.1)' },
  countdown: { text: 'DEPLOY', color: '#D97706', bg: 'rgba(217, 119, 6, 0.1)' },
  playing: { text: 'ACTIVE', color: '#16A34A', bg: 'rgba(22, 163, 74, 0.1)' },
  ending: { text: 'ENDING', color: '#DC2626', bg: 'rgba(220, 38, 38, 0.1)' },
  cooldown: { text: 'RESET', color: '#64748B', bg: 'rgba(100, 116, 139, 0.1)' },
} as const;
