/**
 * config/skills/index.ts - Skill System v2.0 Config Exports
 * Central export point for all skill configurations
 *
 * Ported from app_ingame/config/skills/index.ts
 */

// Category exports
export {
  CATEGORY_META,
  CATEGORY_POSITIONS,
  CATEGORY_ADJACENCY,
  CATEGORY_OPPOSITES,
  CATEGORY_STARTER_SKILLS,
  CATEGORY_ORDER,
  CATEGORY_ICONS,
} from './categories';

export type { CategoryMeta } from './categories';

// Skill definition exports
export {
  CODE_SKILLS,
  DATA_SKILLS,
  NETWORK_SKILLS,
  SECURITY_SKILLS,
  AI_SKILLS,
  SYSTEM_SKILLS,
  ALL_SKILLS,
  SKILLS_BY_CATEGORY,
  SKILL_MAP,
  getSkillsByTier,
  getSkillsBySynergyTag,
} from './definitions';

export type { SkillCategory, SkillDefinition } from './definitions';

// Branch evolution exports
export {
  SKILL_BRANCHES,
  BRANCH_UNLOCK_LEVEL,
  ULTIMATE_UNLOCK_LEVEL,
  SKILLS_WITH_BRANCHES,
  getSkillBranches,
  calculateBranchBonus,
} from './branches';

export type { SkillBranch, BranchSpecialEffect } from './branches';

// Synergy exports
export {
  CATEGORY_MASTERY_SYNERGIES,
  FUSION_SYNERGIES,
  ULTIMATE_SYNERGIES,
  ALL_SYNERGIES,
  SYNERGY_MAP,
  getSynergiesByTier,
  getSynergiesByCategory,
  getSynergiesBySkill,
  checkSynergyRequirements,
  getActivatableSynergies,
} from './synergies';

export type { SynergyDefinition } from './synergies';

// Build preset exports
export {
  SKILL_BUILD_PRESETS,
  getPresetById,
  getPresetsForClass,
  getPresetsBySynergy,
  getPresetsByStartingSkill,
  getPresetMainCategories,
  getPresetDifficulty,
  getPresetTags,
} from './presets';

export type { SkillBuild } from './presets';

// Progressive tree exports
export {
  PROGRESSIVE_TREE,
  CHARACTER_START_WEAPON,
  PASSIVE_SKILLS,
  SYNERGY_CONDITIONS,
  findSkillLocation,
  getWeaponCategory,
  getCharacterStartCategory,
  getCategorySkills,
  getTierSkills,
  getAllMainTreeSkills,
  isPassiveSkill,
  isSynergySkill,
  checkSynergyCondition,
} from './progressive-tree.config';

export type {
  ProgressiveCategory,
  CategoryDefinition,
  TierLevel,
  SynergyCondition,
  PassiveSkillDef,
  SkillLocation,
} from './progressive-tree.config';
