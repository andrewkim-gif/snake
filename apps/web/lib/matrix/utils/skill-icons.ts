/**
 * skill-icons.ts - 스킬 아이콘 경로 유틸리티
 *
 * 57개 스킬 아이콘을 assets/skills/{category}/{id}.png 경로로 매핑.
 * definitions.ts의 스킬 배열에서 weaponType → category 맵을 빌드하여
 * 빠른 경로 조회를 제공한다.
 */

import type { SkillCategory, WeaponType } from '../types';
import {
  CODE_SKILLS,
  DATA_SKILLS,
  NETWORK_SKILLS,
  SECURITY_SKILLS,
  AI_SKILLS,
  SYSTEM_SKILLS,
} from '../config/skills/definitions';

// 카테고리 → 디렉토리명 매핑
const CATEGORY_DIR: Record<SkillCategory, string> = {
  CODE: 'steel',
  DATA: 'territory',
  NETWORK: 'alliance',
  SECURITY: 'sovereignty',
  AI: 'intelligence',
  SYSTEM: 'morale',
};

// weaponType → category 빠른 조회 맵 빌드
const WEAPON_CATEGORY_MAP: Map<string, SkillCategory> = new Map();

// 모든 카테고리의 스킬 배열을 순회하여 맵 구성
const CATEGORY_SKILL_PAIRS: [SkillCategory, typeof CODE_SKILLS][] = [
  ['CODE', CODE_SKILLS],
  ['DATA', DATA_SKILLS],
  ['NETWORK', NETWORK_SKILLS],
  ['SECURITY', SECURITY_SKILLS],
  ['AI', AI_SKILLS],
  ['SYSTEM', SYSTEM_SKILLS],
];

for (const [category, skills] of CATEGORY_SKILL_PAIRS) {
  for (const skill of skills) {
    WEAPON_CATEGORY_MAP.set(skill.id, category);
  }
}

// 패시브 스킬 카테고리 수동 매핑 (definitions.ts에 포함된 경우 중복 무시)
// focus, overclock은 SYSTEM_SKILLS에 이미 포함됨
// gold_reward는 아이콘 없음 (폴백 처리)

/**
 * WeaponType에 대한 스킬 아이콘 경로를 반환한다.
 *
 * @param weaponType - 무기/스킬 타입
 * @returns /assets/skills/{categoryDir}/{weaponType}.png 경로.
 *          매핑 실패 시 빈 문자열 반환 (폴백은 컴포넌트에서 처리).
 */
export function getSkillIconPath(weaponType: WeaponType): string {
  const category = WEAPON_CATEGORY_MAP.get(weaponType);
  if (!category) return '';

  const dir = CATEGORY_DIR[category];
  if (!dir) return '';

  return `/assets/skills/${dir}/${weaponType}.png`;
}

/**
 * 특정 WeaponType의 카테고리를 반환한다.
 */
export function getSkillCategory(weaponType: WeaponType): SkillCategory | undefined {
  return WEAPON_CATEGORY_MAP.get(weaponType);
}
