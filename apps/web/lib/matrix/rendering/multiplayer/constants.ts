/**
 * multiplayer/constants.ts — 멀티플레이어 렌더링 상수
 *
 * v33 Phase 4: 국적 색상, 이펙트 설정, LOD 임계값
 * 디자인 시스템: 다크/글로우 | Ethnocentric (display) + ITC Avant Garde Gothic (body)
 */

import type { NationColorSet, LODThresholds } from './types';

// ─── 디자인 시스템 색상 ───

/** 다크 배경 */
export const BG_DARK = '#111111';
/** 군사 골드 */
export const MILITARY_GOLD = '#CC9933';
/** 밀리터리 그린 */
export const MILITARY_GREEN = '#4A9E4A';
/** 워 레드 */
export const WAR_RED = '#CC3333';
/** 오프화이트 텍스트 */
export const TEXT_OFFWHITE = '#E8E0D4';
/** 아군 블루 */
export const ALLY_BLUE = '#3B82F6';
/** 적 레드 */
export const ENEMY_RED = '#EF4444';
/** 중립 그레이 */
export const NEUTRAL_GRAY = '#9CA3AF';

// ─── 폰트 ───

/** 디스플레이 폰트 (네임태그 등) */
export const FONT_DISPLAY = "'Ethnocentric', 'Black Ops One', monospace";
/** 바디 폰트 (숫자, 레벨 등) */
export const FONT_BODY = "'ITC Avant Garde Gothic', 'Rajdhani', sans-serif";
/** 모노 폰트 (데미지 숫자) */
export const FONT_MONO = "'JetBrains Mono', 'Fira Code', monospace";

// ─── 국적 색상 프리셋 (대표 국가 + 기본) ───

export const NATION_COLORS: Record<string, NationColorSet> = {
  // 주요 국가 커스텀 색상
  KOR: { primary: '#0047A0', glow: '#4B8BF5', text: '#FFFFFF' },
  USA: { primary: '#B31942', glow: '#FF6B8A', text: '#FFFFFF' },
  JPN: { primary: '#BC002D', glow: '#FF4D6A', text: '#FFFFFF' },
  CHN: { primary: '#DE2910', glow: '#FF5533', text: '#FFD700' },
  GBR: { primary: '#012169', glow: '#4169E1', text: '#FFFFFF' },
  DEU: { primary: '#DD0000', glow: '#FF4444', text: '#FFCC00' },
  FRA: { primary: '#002395', glow: '#4466FF', text: '#FFFFFF' },
  RUS: { primary: '#0039A6', glow: '#4488FF', text: '#FFFFFF' },
  BRA: { primary: '#009739', glow: '#33CC66', text: '#FFDF00' },
  IND: { primary: '#FF9933', glow: '#FFBB66', text: '#138808' },
  CAN: { primary: '#FF0000', glow: '#FF4444', text: '#FFFFFF' },
  AUS: { primary: '#00008B', glow: '#4444FF', text: '#FFFFFF' },
};

/** 기본 국적 색상 (미등록 국가용) */
export const DEFAULT_NATION_COLOR: NationColorSet = {
  primary: '#6B7280',
  glow: '#9CA3AF',
  text: '#FFFFFF',
};

/** 국적 코드 → 국기 이모지 매핑 (주요 국가) */
export const NATION_FLAGS: Record<string, string> = {
  KOR: '\u{1F1F0}\u{1F1F7}', USA: '\u{1F1FA}\u{1F1F8}',
  JPN: '\u{1F1EF}\u{1F1F5}', CHN: '\u{1F1E8}\u{1F1F3}',
  GBR: '\u{1F1EC}\u{1F1E7}', DEU: '\u{1F1E9}\u{1F1EA}',
  FRA: '\u{1F1EB}\u{1F1F7}', RUS: '\u{1F1F7}\u{1F1FA}',
  BRA: '\u{1F1E7}\u{1F1F7}', IND: '\u{1F1EE}\u{1F1F3}',
  CAN: '\u{1F1E8}\u{1F1E6}', AUS: '\u{1F1E6}\u{1F1FA}',
  MEX: '\u{1F1F2}\u{1F1FD}', ARG: '\u{1F1E6}\u{1F1F7}',
  ESP: '\u{1F1EA}\u{1F1F8}', ITA: '\u{1F1EE}\u{1F1F9}',
  TUR: '\u{1F1F9}\u{1F1F7}', SAU: '\u{1F1F8}\u{1F1E6}',
  ZAF: '\u{1F1FF}\u{1F1E6}', NGA: '\u{1F1F3}\u{1F1EC}',
  EGY: '\u{1F1EA}\u{1F1EC}', THA: '\u{1F1F9}\u{1F1ED}',
  VNM: '\u{1F1FB}\u{1F1F3}', IDN: '\u{1F1EE}\u{1F1E9}',
  PHL: '\u{1F1F5}\u{1F1ED}', MYS: '\u{1F1F2}\u{1F1FE}',
  SGP: '\u{1F1F8}\u{1F1EC}', NZL: '\u{1F1F3}\u{1F1FF}',
  SWE: '\u{1F1F8}\u{1F1EA}', NOR: '\u{1F1F3}\u{1F1F4}',
  FIN: '\u{1F1EB}\u{1F1EE}', DNK: '\u{1F1E9}\u{1F1F0}',
  POL: '\u{1F1F5}\u{1F1F1}', UKR: '\u{1F1FA}\u{1F1E6}',
  ISR: '\u{1F1EE}\u{1F1F1}', ARE: '\u{1F1E6}\u{1F1EA}',
  COL: '\u{1F1E8}\u{1F1F4}', PER: '\u{1F1F5}\u{1F1EA}',
  CHL: '\u{1F1E8}\u{1F1F1}', KEN: '\u{1F1F0}\u{1F1EA}',
  PAK: '\u{1F1F5}\u{1F1F0}', BGD: '\u{1F1E7}\u{1F1E9}',
};

/** 국기 이모지 가져오기 (미등록 시 3-letter 코드 반환) */
export function getNationFlag(nationCode: string): string {
  return NATION_FLAGS[nationCode] || nationCode;
}

/** 국적 색상 가져오기 */
export function getNationColor(nationCode: string): NationColorSet {
  return NATION_COLORS[nationCode] || DEFAULT_NATION_COLOR;
}

// ─── 네임태그 상수 ───

/** 네임태그 Y 오프셋 (캐릭터 머리 위, px) */
export const NAMETAG_OFFSET_Y = -50;
/** 네임태그 폰트 크기 (px) */
export const NAMETAG_FONT_SIZE = 11;
/** 네임태그 국가코드 폰트 크기 (px) */
export const NAMETAG_NATION_FONT_SIZE = 9;
/** HP 바 너비 (px) */
export const HP_BAR_WIDTH = 40;
/** HP 바 높이 (px) */
export const HP_BAR_HEIGHT = 4;
/** 레벨 뱃지 크기 (px) */
export const LEVEL_BADGE_SIZE = 14;

// ─── 이펙트 상수 ───

/** 히트 이펙트 지속시간 (ms) */
export const HIT_EFFECT_DURATION = 400;
/** 킬 이펙트 지속시간 (ms) */
export const KILL_EFFECT_DURATION = 800;
/** 데미지 숫자 지속시간 (ms) */
export const DAMAGE_NUMBER_DURATION = 900;
/** 데미지 숫자 떠오르는 높이 (px) */
export const DAMAGE_NUMBER_RISE = 40;
/** 킬피드 최대 표시 수 */
export const KILLFEED_MAX_ENTRIES = 5;
/** 킬피드 항목 표시 시간 (ms) */
export const KILLFEED_ENTRY_DURATION = 5000;
/** 킬피드 항목 높이 (px) */
export const KILLFEED_ENTRY_HEIGHT = 28;
/** 킬피드 위치 (화면 우상단 오프셋) */
export const KILLFEED_OFFSET_X = 10;
export const KILLFEED_OFFSET_Y = 80;

// ─── 뷰포트 컬링 상수 ───

/** 기본 LOD 임계값 (월드 좌표 px) */
export const DEFAULT_LOD_THRESHOLDS: LODThresholds = {
  midDistance: 800,
  lowDistance: 1400,
  cullDistance: 2200,
};

/** 뷰포트 패딩 (화면 밖 여유 영역, px) */
export const VIEWPORT_PADDING = 200;

// ─── 캐릭터 렌더링 상수 ───

/** 원격 플레이어 기본 크기 (px) */
export const REMOTE_PLAYER_SIZE = 24;
/** 아군 아웃라인 두께 */
export const ALLY_OUTLINE_WIDTH = 2;
/** 적 아웃라인 두께 */
export const ENEMY_OUTLINE_WIDTH = 2.5;
/** 피격 플래시 지속시간 (ms) */
export const HIT_FLASH_DURATION = 150;
/** 사망 페이드아웃 시간 (ms) */
export const DEATH_FADE_DURATION = 500;

// ─── PvP 시각 표시 ───

/** 전쟁 페이즈 화면 테두리 색상 */
export const WAR_BORDER_COLOR = 'rgba(204, 51, 51, 0.3)';
/** 전쟁 페이즈 화면 테두리 두께 (px) */
export const WAR_BORDER_WIDTH = 3;
/** 전쟁 카운트다운 텍스트 색상 */
export const WAR_COUNTDOWN_COLOR = '#FF4444';
