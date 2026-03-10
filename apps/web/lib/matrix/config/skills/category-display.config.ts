/**
 * category-display.config.ts - 카테고리 Display Name / Color 중앙 관리
 *
 * v37 인게임 오버홀: 코딩 밈 → 군사/전략 세계관 전환
 *
 * 내부 키(CODE, DATA, NETWORK, SECURITY, AI, SYSTEM)는 절대 변경하지 않음.
 * UI에 표시되는 Display Name만 여기서 매핑한다.
 *
 * | Display Name   | Internal Key | 전쟁 요소    | 컬러     |
 * |----------------|-------------|-------------|---------|
 * | STEEL (강철)    | CODE        | 군사력       | #EF4444 |
 * | TERRITORY (영토) | DATA        | 자원/경제    | #3B82F6 |
 * | ALLIANCE (동맹)  | NETWORK     | 외교/동맹    | #8B5CF6 |
 * | SOVEREIGNTY (주권)| SECURITY   | 방어/안보    | #22C55E |
 * | INTELLIGENCE (정보)| AI        | 첩보/AI     | #F59E0B |
 * | MORALE (사기)    | SYSTEM      | 사기/여론    | #06B6D4 |
 */

import type { SkillCategory } from '../../types';

// ============================================
// Display Name 매핑
// ============================================

/** 내부 카테고리 키 → UI 표시 이름 (영문) */
export const CATEGORY_DISPLAY_NAMES: Record<SkillCategory, string> = {
  CODE: 'STEEL',
  DATA: 'TERRITORY',
  NETWORK: 'ALLIANCE',
  SECURITY: 'SOVEREIGNTY',
  AI: 'INTELLIGENCE',
  SYSTEM: 'MORALE',
};

/** 내부 카테고리 키 → UI 표시 이름 (한글) */
export const CATEGORY_DISPLAY_NAMES_KO: Record<SkillCategory, string> = {
  CODE: '강철',
  DATA: '영토',
  NETWORK: '동맹',
  SECURITY: '주권',
  AI: '정보력',
  SYSTEM: '사기',
};

// ============================================
// Display Color 매핑
// ============================================

/** 내부 카테고리 키 → UI 메인 컬러 */
export const CATEGORY_DISPLAY_COLORS: Record<SkillCategory, string> = {
  CODE: '#EF4444',     // 레드
  DATA: '#3B82F6',     // 블루
  NETWORK: '#8B5CF6',  // 퍼플
  SECURITY: '#22C55E', // 그린
  AI: '#F59E0B',       // 앰버
  SYSTEM: '#06B6D4',   // 시안
};

// ============================================
// 유틸리티 함수
// ============================================

/**
 * 내부 카테고리 키 → Display Name 반환
 * @param internalKey - 내부 카테고리 키 (CODE, DATA, NETWORK, SECURITY, AI, SYSTEM)
 * @param locale - 'en' | 'ko' (기본 'en')
 * @returns Display name 문자열 (매칭 없으면 internalKey 그대로 반환)
 */
export function getCategoryDisplayName(
  internalKey: string,
  locale: 'en' | 'ko' = 'en'
): string {
  const key = internalKey as SkillCategory;
  if (locale === 'ko') {
    return CATEGORY_DISPLAY_NAMES_KO[key] ?? internalKey;
  }
  return CATEGORY_DISPLAY_NAMES[key] ?? internalKey;
}

/**
 * 내부 카테고리 키 → Display Color 반환
 * @param internalKey - 내부 카테고리 키
 * @returns 컬러 hex 문자열 (매칭 없으면 기본 회색)
 */
export function getCategoryDisplayColor(internalKey: string): string {
  return CATEGORY_DISPLAY_COLORS[internalKey as SkillCategory] ?? '#666666';
}
