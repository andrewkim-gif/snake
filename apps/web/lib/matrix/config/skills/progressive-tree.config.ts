/**
 * Progressive Skill Tree v3.1 - Tree Configuration
 *
 * 5개 카테고리 기반 단계식 스킬 트리 설정
 *
 * Ported from app_ingame/config/skills/progressive-tree.config.ts
 * Progressive skill types inlined from missing progressive-skill.types
 */

import { WeaponType, PlayerClass } from '../../types';

// ===== Inlined Types (from progressive-skill.types) =====

export type ProgressiveCategory = 'CODE' | 'DATA' | 'NETWORK' | 'SECURITY' | 'SYSTEM';

export type TierLevel = 1 | 2 | 3 | 4;

export interface CategoryDefinition {
  id: ProgressiveCategory;
  name: string;
  nameEn: string;
  color: string;
  description: string;
  startSkills: WeaponType[];
  tiers: {
    2: WeaponType[];
    3: WeaponType[];
    4: WeaponType;
  };
}

export interface SynergyCondition {
  skill: WeaponType;
  name: string;
  description: string;
  requirements: {
    category: ProgressiveCategory;
    minTier: number;
  }[];
}

export interface PassiveSkillDef {
  id: WeaponType;
  name: string;
  description: string;
  maxLevel: number;
  effectPerLevel: number;
  isPercent: boolean;
}

export interface SkillLocation {
  category: ProgressiveCategory;
  tier: TierLevel;
  index?: number;
}

// ===== Main Skill Tree =====

export const PROGRESSIVE_TREE: Record<ProgressiveCategory, CategoryDefinition> = {
  CODE: {
    id: 'CODE',
    name: '코드',
    nameEn: 'Code',
    color: '#ef4444',
    description: '근접 전투와 직접 공격에 특화',
    startSkills: ['whip', 'punch', 'knife'],
    tiers: {
      2: ['sword', 'syntax_error', 'compiler'],
      3: ['debugger_skill', 'refactor', 'regex'],
      4: 'hotfix',
    },
  },
  DATA: {
    id: 'DATA',
    name: '데이터',
    nameEn: 'Data',
    color: '#3b82f6',
    description: '원거리 투사체와 다중 타격에 특화',
    startSkills: ['wand'],
    tiers: {
      2: ['bow', 'axe', 'shard'],
      3: ['json_bomb', 'csv_spray', 'binary'],
      4: 'big_data',
    },
  },
  NETWORK: {
    id: 'NETWORK',
    name: '네트워크',
    nameEn: 'Network',
    color: '#06b6d4',
    description: '체인 공격과 광역 효과에 특화',
    startSkills: ['lightning'],
    tiers: {
      2: ['ping', 'bridge', 'fork'],
      3: ['websocket', 'tcp_flood', 'dns_spoof'],
      4: 'vpn_tunnel',
    },
  },
  SECURITY: {
    id: 'SECURITY',
    name: '보안',
    nameEn: 'Security',
    color: '#22c55e',
    description: '방어와 생존, 지속 피해에 특화',
    startSkills: ['garlic', 'bible'],
    tiers: {
      2: ['pool', 'stablecoin', 'antivirus'],
      3: ['sandbox', 'zero_trust', 'encryption'],
      4: 'honeypot',
    },
  },
  SYSTEM: {
    id: 'SYSTEM',
    name: '시스템',
    nameEn: 'System',
    color: '#a855f7',
    description: '관통, 특수 효과, 범용 스킬에 특화',
    startSkills: ['beam'],
    tiers: {
      2: ['laser', 'airdrop', 'phishing'],
      3: ['ram_upgrade', 'cpu_boost', 'cache'],
      4: 'multithreading',
    },
  },
};

// ===== Character Start Weapons =====

export const CHARACTER_START_WEAPON: Record<PlayerClass, WeaponType> = {
  neo: 'wand',
  morpheus: 'punch',
  trinity: 'knife',
  tank: 'garlic',
  cypher: 'wand',
  niobe: 'bible',
  oracle: 'lightning',
  mouse: 'lightning',
  dozer: 'wand',
};

// ===== Passive Skills =====

export const PASSIVE_SKILLS: PassiveSkillDef[] = [
  {
    id: 'focus',
    name: '딥워크',
    description: '크리티컬 확률 증가',
    maxLevel: 10,
    effectPerLevel: 5,
    isPercent: true,
  },
  {
    id: 'overclock',
    name: '오버클럭',
    description: '이동속도 증가',
    maxLevel: 10,
    effectPerLevel: 10,
    isPercent: true,
  },
  {
    id: 'gold_reward',
    name: '골드 리워드',
    description: '획득 골드 증가',
    maxLevel: 10,
    effectPerLevel: 20,
    isPercent: true,
  },
];

// ===== Synergy Skills =====

export const SYNERGY_CONDITIONS: SynergyCondition[] = [
  {
    skill: 'neural_net',
    name: '뉴럴넷',
    description: 'AI 신경망 공격',
    requirements: [
      { category: 'DATA', minTier: 3 },
      { category: 'SYSTEM', minTier: 2 },
    ],
  },
  {
    skill: 'chatgpt',
    name: 'ChatGPT',
    description: 'AI 대화 공격',
    requirements: [
      { category: 'NETWORK', minTier: 3 },
      { category: 'DATA', minTier: 2 },
    ],
  },
  {
    skill: 'deepfake',
    name: '딥페이크',
    description: '분신 생성',
    requirements: [
      { category: 'CODE', minTier: 3 },
      { category: 'DATA', minTier: 3 },
    ],
  },
  {
    skill: 'singularity_core',
    name: '특이점 코어',
    description: '궁극의 AI 스킬',
    requirements: [
      { category: 'CODE', minTier: 4 },
      { category: 'DATA', minTier: 4 },
      { category: 'NETWORK', minTier: 4 },
      { category: 'SECURITY', minTier: 4 },
    ],
  },
];

// ===== Utility Functions =====

/**
 * 무기가 속한 카테고리와 Tier 찾기
 */
export function findSkillLocation(skill: WeaponType): SkillLocation | null {
  for (const [catId, def] of Object.entries(PROGRESSIVE_TREE)) {
    const category = catId as ProgressiveCategory;

    // Tier 1 (시작 스킬)
    if (def.startSkills.includes(skill)) {
      return { category, tier: 1, index: def.startSkills.indexOf(skill) };
    }

    // Tier 2
    const tier2Index = def.tiers[2].indexOf(skill);
    if (tier2Index !== -1) {
      return { category, tier: 2, index: tier2Index };
    }

    // Tier 3
    const tier3Index = def.tiers[3].indexOf(skill);
    if (tier3Index !== -1) {
      return { category, tier: 3, index: tier3Index };
    }

    // Tier 4 (Ultimate)
    if (def.tiers[4] === skill) {
      return { category, tier: 4 };
    }
  }

  return null; // 패시브 or 시너지 스킬
}

/**
 * 무기의 카테고리 가져오기
 */
export function getWeaponCategory(weapon: WeaponType): ProgressiveCategory | null {
  const location = findSkillLocation(weapon);
  return location?.category ?? null;
}

/**
 * 캐릭터의 시작 카테고리 가져오기
 */
export function getCharacterStartCategory(playerClass: PlayerClass): ProgressiveCategory {
  const startWeapon = CHARACTER_START_WEAPON[playerClass];
  return getWeaponCategory(startWeapon) ?? 'DATA';
}

/**
 * 특정 카테고리의 모든 스킬 가져오기
 */
export function getCategorySkills(category: ProgressiveCategory): WeaponType[] {
  const def = PROGRESSIVE_TREE[category];
  return [
    ...def.startSkills,
    ...def.tiers[2],
    ...def.tiers[3],
    def.tiers[4],
  ];
}

/**
 * 특정 Tier의 스킬들 가져오기
 */
export function getTierSkills(category: ProgressiveCategory, tier: TierLevel): WeaponType[] {
  const def = PROGRESSIVE_TREE[category];
  if (tier === 1) return def.startSkills;
  if (tier === 4) return [def.tiers[4]];
  return def.tiers[tier];
}

/**
 * 모든 메인 트리 스킬 가져오기
 */
export function getAllMainTreeSkills(): WeaponType[] {
  const skills: WeaponType[] = [];
  for (const category of Object.keys(PROGRESSIVE_TREE) as ProgressiveCategory[]) {
    skills.push(...getCategorySkills(category));
  }
  return skills;
}

/**
 * 패시브 스킬인지 확인
 */
export function isPassiveSkill(skill: WeaponType): boolean {
  return PASSIVE_SKILLS.some(p => p.id === skill);
}

/**
 * 시너지 스킬인지 확인
 */
export function isSynergySkill(skill: WeaponType): boolean {
  return SYNERGY_CONDITIONS.some(s => s.skill === skill);
}

/**
 * 시너지 조건 충족 여부 확인
 */
export function checkSynergyCondition(
  synergy: SynergyCondition,
  categoryTiers: Record<ProgressiveCategory, number>
): boolean {
  return synergy.requirements.every(
    req => (categoryTiers[req.category] || 0) >= req.minTier
  );
}
