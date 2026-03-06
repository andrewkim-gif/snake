/**
 * Tactical UI — Deep Navy Command Center 디자인 시스템
 * 네이비 블루 기반 + 골드 액센트 + 모던 가독성 (Inter UI 폰트)
 */

/** 전술 컬러 팔레트 (네이비 블루 기반 + 군사 액센트) */
export const SK = {
  // 배경 — 네이비 블루 톤 (지구본 바다와 조화)
  bg: '#0A0F1A',
  bgWarm: '#111827',
  cardBg: '#111827',
  cardBgHover: '#1A2235',
  overlay: 'rgba(8, 12, 24, 0.8)',

  // 텍스트 — 높은 대비 + 차가운 톤
  textPrimary: '#E2E8F0',
  textSecondary: '#8494A7',
  textMuted: '#4A5568',
  textWhite: '#F1F5F9',

  // 군사 액센트
  orange: '#CC9933',
  orangeLight: '#DDB044',
  orangeDark: '#AA7722',
  green: '#4A9E4A',
  greenLight: '#5CB85C',
  greenDark: '#337733',
  red: '#CC3333',
  redLight: '#DD5555',
  redDark: '#AA2222',
  gold: '#D4A843',
  blue: '#4A90D9',

  // 보더 — 블루 틴트
  border: 'rgba(100, 160, 220, 0.15)',
  borderDark: 'rgba(100, 160, 220, 0.08)',
  borderFocus: 'rgba(212, 168, 67, 0.6)',
  shadow: 'rgba(0, 0, 0, 0.3)',
  shadowMd: 'rgba(0, 0, 0, 0.5)',
  shadowLg: 'rgba(0, 0, 0, 0.7)',

  // 상태
  statusOnline: '#5CB85C',
  statusOffline: '#CC3333',
  statusWaiting: '#4A5568',
  statusLive: '#5CB85C',
  statusStarting: '#CC9933',
  statusEnding: '#CC3333',

  // 3D 씬 / 글로브
  skyBg: '#0A0F1A',
  ocean: '#101D2E',
  land: '#3D7A9E',

  // 글래스모피즘 프리셋
  glassBg: 'rgba(12, 18, 32, 0.85)',
  glassBorder: 'rgba(100, 160, 220, 0.12)',
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

/** 밀리터리 스텐실 폰트 — 대형 제목/로고만 (18px+) */
export const headingFont = '"Black Ops One", sans-serif';

/** UI 폰트 — 모든 본문, 라벨, 버튼, 인풋 (Inter = 모든 크기에서 가독성 보장) */
export const bodyFont = '"Inter", -apple-system, BlinkMacSystemFont, sans-serif';

/** 손그림 보더 라디우스 (비대칭 = 손그림 느낌) */
export function handDrawnRadius(base = 3) {
  return `${base}px ${base + 3}px ${base + 1}px ${base + 4}px`;
}

/** 라운드 코너 프리셋 */
export const radius = {
  sm: '3px',
  md: '4px',
  lg: '6px',
  xl: '8px',
  pill: '9999px',
} as const;

/** 작전 지도 스타일 박스 섀도 (어두운 톤) */
export function sketchShadow(level: 'sm' | 'md' | 'lg' = 'md') {
  const shadows = {
    sm: `0 1px 4px ${SK.shadow}`,
    md: `0 2px 8px ${SK.shadowMd}`,
    lg: `0 4px 16px ${SK.shadowLg}`,
  };
  return shadows[level];
}

/** 스케치 보더 */
export function sketchBorder(color: string = SK.border) {
  return `1.5px solid ${color}`;
}

/** 전술 지도 그리드 + 그레인 텍스처 (카드 배경용) */
export function tacticalBg() {
  return {
    backgroundImage: [
      'radial-gradient(circle, rgba(100,160,220,0.04) 1px, transparent 1px)',
      'linear-gradient(rgba(100,160,220,0.03) 1px, transparent 1px)',
      'linear-gradient(90deg, rgba(100,160,220,0.03) 1px, transparent 1px)',
    ].join(', '),
    backgroundSize: '3px 3px, 24px 24px, 24px 24px',
  };
}

/** 상태별 색상 (군사 용어) */
export const statusColors = {
  waiting: { text: 'STANDBY', color: SK.textMuted, bg: 'rgba(90, 84, 78, 0.2)' },
  countdown: { text: 'DEPLOY', color: SK.gold, bg: 'rgba(204, 153, 51, 0.15)' },
  playing: { text: 'ACTIVE', color: SK.green, bg: 'rgba(74, 158, 74, 0.15)' },
  ending: { text: 'ENDING', color: SK.red, bg: 'rgba(204, 51, 51, 0.15)' },
  cooldown: { text: 'RESET', color: SK.textSecondary, bg: 'rgba(138, 128, 120, 0.12)' },
} as const;
