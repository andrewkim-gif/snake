'use client';

/**
 * SkillIcon.tsx - 하위 호환 래퍼
 *
 * v37 인게임 오버홀: SkillIconSVG로 교체.
 * 기존 import { SkillIcon } from './SkillIcon' 을 유지하기 위한 래퍼.
 *
 * 새 코드에서는 직접 SkillIconSVG를 import하는 것을 권장합니다:
 *   import { SkillIconSVG } from './SkillIconSVG';
 */

export { SkillIcon, SkillIconSVG } from './SkillIconSVG';
export type { SkillIconSVGProps } from './SkillIconSVG';
