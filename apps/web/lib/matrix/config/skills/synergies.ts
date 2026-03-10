/**
 * synergies.ts - Skill Synergy Definitions
 * Category Mastery (3+ same category Lv10+) + Fusion Skills (2 different category Lv10+)
 *
 * Ported from app_ingame/config/skills/synergies.ts
 * SynergyDefinition inlined from missing skill.types
 *
 * SYNERGY DESIGN PHILOSOPHY:
 * 1. REWARDING: Synergies must feel like discovering a secret combo
 * 2. VISUAL: Clear visual/audio feedback when synergy activates
 * 3. IMPACTFUL: Synergies should noticeably change gameplay
 */

import { SkillCategory } from './definitions';
import { WeaponType } from '../../types';

/** Synergy Definition (inlined from skill.types) */
export interface SynergyDefinition {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  icon: string;
  color: string;
  tier: 'mastery' | 'fusion' | 'ultimate';
  requirements: {
    type: string;
    categories?: SkillCategory[];
    categoryCount?: number;
    minLevel: number;
    skills?: WeaponType[];
  };
  effect: {
    type: string;
    passiveBonuses?: Record<string, number>;
    activeAbility?: {
      id: string;
      name: string;
      description: string;
      cooldown: number;
      effect: {
        type: string;
        value: number;
        duration: number;
        description: string;
      };
    };
    specialAbility?: string;
  };
  displayCategories?: SkillCategory[];
  displaySkills?: WeaponType[];
}

// ============================================
// CATEGORY MASTERY SYNERGIES (동일 카테고리 3개 Lv10+)
// ============================================

export const CATEGORY_MASTERY_SYNERGIES: SynergyDefinition[] = [
  {
    id: 'code_mastery',
    name: '산업 대국',
    nameEn: 'Industrial Superpower',
    description: '강철의 나라! 모든 STEEL 스킬 데미지 25% 증가',
    descriptionEn: 'Power of steel! All STEEL skills deal 25% more damage',
    icon: 'Code',
    color: '#00FF41',
    tier: 'mastery',
    requirements: {
      type: 'category_mastery',
      categories: ['CODE'],
      categoryCount: 3,
      minLevel: 10,
    },
    effect: {
      type: 'passive',
      passiveBonuses: {
        damageMultiplier: 1.25,
      },
    },
    displayCategories: ['CODE'],
  },
  {
    id: 'data_mastery',
    name: '영토 대국',
    nameEn: 'Territorial Giant',
    description: '넓은 영토의 힘! 모든 TERRITORY 스킬 범위 30% 증가',
    descriptionEn: 'Vast territory! All TERRITORY skills have 30% larger area',
    icon: 'Database',
    color: '#06B6D4',
    tier: 'mastery',
    requirements: {
      type: 'category_mastery',
      categories: ['DATA'],
      categoryCount: 3,
      minLevel: 10,
    },
    effect: {
      type: 'passive',
      passiveBonuses: {
        areaMultiplier: 1.30,
      },
    },
    displayCategories: ['DATA'],
  },
  {
    id: 'network_mastery',
    name: '동맹 맹주',
    nameEn: 'Alliance Leader',
    description: '세계가 내 편! 체인 데미지 40% 증가 + 연결 수 +2',
    descriptionEn: 'The world is my ally! Chain damage +40% + 2 extra chains',
    icon: 'Network',
    color: '#8B5CF6',
    tier: 'mastery',
    requirements: {
      type: 'category_mastery',
      categories: ['NETWORK'],
      categoryCount: 3,
      minLevel: 10,
    },
    effect: {
      type: 'passive',
      passiveBonuses: {
        damageMultiplier: 1.40,
      },
    },
    displayCategories: ['NETWORK'],
  },
  {
    id: 'security_mastery',
    name: '난공불락',
    nameEn: 'Impregnable',
    description: '결코 무너지지 않는 주권! 받는 피해 20% 감소 + 체력 재생 +5/초',
    descriptionEn: 'Unbreakable sovereignty! Take 20% less damage + 5 HP regen/sec',
    icon: 'Shield',
    color: '#EF4444',
    tier: 'mastery',
    requirements: {
      type: 'category_mastery',
      categories: ['SECURITY'],
      categoryCount: 3,
      minLevel: 10,
    },
    effect: {
      type: 'passive',
      passiveBonuses: {
        armor: 20,
        hpRegen: 5,
      },
    },
    displayCategories: ['SECURITY'],
  },
  {
    id: 'ai_mastery',
    name: '빅 브라더',
    nameEn: 'Big Brother',
    description: '모든 걸 감시한다! INTEL 스킬 쿨다운 30% 감소 + 자동 조준 강화',
    descriptionEn: 'Always watching! INTEL skill cooldown -30% + enhanced auto-aim',
    icon: 'Brain',
    color: '#F59E0B',
    tier: 'mastery',
    requirements: {
      type: 'category_mastery',
      categories: ['AI'],
      categoryCount: 3,
      minLevel: 10,
    },
    effect: {
      type: 'passive',
      passiveBonuses: {
        cooldownMultiplier: 0.70,
      },
    },
    displayCategories: ['AI'],
  },
  {
    id: 'system_mastery',
    name: '국민 영웅',
    nameEn: 'National Hero',
    description: '사기 충천! 모든 스탯 버프 효과 50% 증가',
    descriptionEn: 'Morale at its peak! All stat buffs are 50% more effective',
    icon: 'Cpu',
    color: '#10B981',
    tier: 'mastery',
    requirements: {
      type: 'category_mastery',
      categories: ['SYSTEM'],
      categoryCount: 3,
      minLevel: 10,
    },
    effect: {
      type: 'passive',
      passiveBonuses: {
        damageMultiplier: 1.15,
        speedMultiplier: 1.15,
        critChance: 10,
        critDamage: 25,
      },
    },
    displayCategories: ['SYSTEM'],
  },
];

// ============================================
// FUSION SYNERGIES (다른 카테고리 2개 조합)
// ============================================

export const FUSION_SYNERGIES: SynergyDefinition[] = [
  // CODE + DATA = Full Stack
  {
    id: 'fullstack_fusion',
    name: '군산 복합체',
    nameEn: 'Military-Industrial Complex',
    description: '강철과 영토의 조화! 투사체 + 광역 데미지 20% 증가',
    descriptionEn: 'Steel meets Territory! Projectile + AoE damage +20%',
    icon: 'Layers',
    color: '#00D9FF',
    tier: 'fusion',
    requirements: {
      type: 'fusion',
      categories: ['CODE', 'DATA'],
      minLevel: 10,
    },
    effect: {
      type: 'passive',
      passiveBonuses: {
        damageMultiplier: 1.20,
        areaMultiplier: 1.15,
      },
    },
    displayCategories: ['CODE', 'DATA'],
  },

  // CODE + NETWORK = DevOps
  {
    id: 'devops_fusion',
    name: 'NATO 조약',
    nameEn: 'NATO Protocol',
    description: '강철과 동맹의 합동! 스킬 쿨다운 15% 감소 + 체인 효과 강화',
    descriptionEn: 'Steel and Alliance united! Skill cooldown -15% + enhanced chains',
    icon: 'GitBranch',
    color: '#00FF88',
    tier: 'fusion',
    requirements: {
      type: 'fusion',
      categories: ['CODE', 'NETWORK'],
      minLevel: 10,
    },
    effect: {
      type: 'passive',
      passiveBonuses: {
        cooldownMultiplier: 0.85,
        damageMultiplier: 1.10,
      },
    },
    displayCategories: ['CODE', 'NETWORK'],
  },

  // CODE + SECURITY = Secure Coding
  {
    id: 'secure_code_fusion',
    name: '철의 장막',
    nameEn: 'Iron Curtain',
    description: '강철의 방패! 공격 시 10% 확률로 적 약화 + 피해 반사 5%',
    descriptionEn: 'Iron shield! 10% chance to weaken enemies + 5% damage reflect',
    icon: 'ShieldCheck',
    color: '#FF5544',
    tier: 'fusion',
    requirements: {
      type: 'fusion',
      categories: ['CODE', 'SECURITY'],
      minLevel: 10,
    },
    effect: {
      type: 'passive',
      passiveBonuses: {
        armor: 10,
        damageMultiplier: 1.10,
      },
    },
    displayCategories: ['CODE', 'SECURITY'],
  },

  // CODE + AI = AI-Assisted Coding
  {
    id: 'ai_coding_fusion',
    name: '스마트 무기',
    nameEn: 'Smart Weapons',
    description: '정보와 강철의 융합! 자동 공격 데미지 30% 증가',
    descriptionEn: 'Intelligence meets Steel! Auto-attack damage +30%',
    icon: 'Wand',
    color: '#FFB800',
    tier: 'fusion',
    requirements: {
      type: 'fusion',
      categories: ['CODE', 'AI'],
      minLevel: 10,
    },
    effect: {
      type: 'passive',
      passiveBonuses: {
        damageMultiplier: 1.30,
      },
    },
    displayCategories: ['CODE', 'AI'],
  },

  // CODE + SYSTEM = Performance Engineering
  {
    id: 'perf_engineer_fusion',
    name: '전시 경제',
    nameEn: 'War Economy',
    description: '사기와 강철의 시너지! 공격 속도 20% 증가 + 크리티컬 +10%',
    descriptionEn: 'Morale fuels Steel! Attack speed +20% + Crit chance +10%',
    icon: 'Gauge',
    color: '#44FF88',
    tier: 'fusion',
    requirements: {
      type: 'fusion',
      categories: ['CODE', 'SYSTEM'],
      minLevel: 10,
    },
    effect: {
      type: 'passive',
      passiveBonuses: {
        speedMultiplier: 1.20,
        critChance: 10,
      },
    },
    displayCategories: ['CODE', 'SYSTEM'],
  },

  // DATA + NETWORK = Data Pipeline
  {
    id: 'data_pipeline_fusion',
    name: '합동 폭격',
    nameEn: 'Joint Bombardment',
    description: '동맹과 영토의 연합! 지속 피해 30% 증가',
    descriptionEn: 'Alliance plus Territory! Sustained damage +30%',
    icon: 'ArrowRightLeft',
    color: '#00BBFF',
    tier: 'fusion',
    requirements: {
      type: 'fusion',
      categories: ['DATA', 'NETWORK'],
      minLevel: 10,
    },
    effect: {
      type: 'passive',
      passiveBonuses: {
        damageMultiplier: 1.30,
        areaMultiplier: 1.10,
      },
    },
    displayCategories: ['DATA', 'NETWORK'],
  },

  // DATA + SECURITY = Data Protection
  {
    id: 'data_protection_fusion',
    name: '마지노선',
    nameEn: 'Maginot Line',
    description: '영토와 주권의 방벽! 영역 스킬에 슬로우 효과 추가',
    descriptionEn: 'Territory and Sovereignty wall! Zone skills gain slow effect',
    icon: 'Lock',
    color: '#FF6688',
    tier: 'fusion',
    requirements: {
      type: 'fusion',
      categories: ['DATA', 'SECURITY'],
      minLevel: 10,
    },
    effect: {
      type: 'passive',
      passiveBonuses: {
        areaMultiplier: 1.20,
        armor: 10,
      },
    },
    displayCategories: ['DATA', 'SECURITY'],
  },

  // DATA + AI = Machine Learning
  {
    id: 'ml_fusion',
    name: '위성 정찰',
    nameEn: 'Satellite Recon',
    description: '영토와 정보력의 결합! 처치 수에 비례하여 데미지 증가 (최대 50%)',
    descriptionEn: 'Territory meets Intelligence! Damage scales with kills (max +50%)',
    icon: 'Brain',
    color: '#FFAA00',
    tier: 'fusion',
    requirements: {
      type: 'fusion',
      categories: ['DATA', 'AI'],
      minLevel: 10,
    },
    effect: {
      type: 'passive',
      passiveBonuses: {
        damageMultiplier: 1.25,
      },
      specialAbility: 'ml_scaling',
    },
    displayCategories: ['DATA', 'AI'],
  },

  // DATA + SYSTEM = Big Data Analytics
  {
    id: 'analytics_fusion',
    name: '자원 약탈',
    nameEn: 'Resource Plunder',
    description: '영토와 사기의 합작! 적 처치 시 경험치 +15%',
    descriptionEn: 'Territory and Morale! +15% EXP on kill',
    icon: 'BarChart',
    color: '#00FFAA',
    tier: 'fusion',
    requirements: {
      type: 'fusion',
      categories: ['DATA', 'SYSTEM'],
      minLevel: 10,
    },
    effect: {
      type: 'passive',
      passiveBonuses: {
        areaMultiplier: 1.15,
      },
      specialAbility: 'exp_boost',
    },
    displayCategories: ['DATA', 'SYSTEM'],
  },

  // NETWORK + SECURITY = Zero Trust
  {
    id: 'zero_trust_fusion',
    name: '상호방위조약',
    nameEn: 'Mutual Defense Pact',
    description: '동맹과 주권의 맹약! 첫 피격 무효화 (10초 쿨다운)',
    descriptionEn: 'Alliance and Sovereignty pact! First hit negated (10s cooldown)',
    icon: 'ShieldAlert',
    color: '#FF4488',
    tier: 'fusion',
    requirements: {
      type: 'fusion',
      categories: ['NETWORK', 'SECURITY'],
      minLevel: 10,
    },
    effect: {
      type: 'trigger',
      passiveBonuses: {
        armor: 15,
      },
      specialAbility: 'first_hit_immunity',
    },
    displayCategories: ['NETWORK', 'SECURITY'],
  },

  // NETWORK + AI = Neural Network
  {
    id: 'neural_network_fusion',
    name: '파이브 아이즈',
    nameEn: 'Five Eyes',
    description: '동맹과 정보력의 결합! 체인 공격이 자동 타겟팅',
    descriptionEn: 'Alliance meets Intelligence! Chain attacks auto-targeted',
    icon: 'Network',
    color: '#FF8800',
    tier: 'fusion',
    requirements: {
      type: 'fusion',
      categories: ['NETWORK', 'AI'],
      minLevel: 10,
    },
    effect: {
      type: 'passive',
      passiveBonuses: {
        damageMultiplier: 1.25,
        cooldownMultiplier: 0.90,
      },
    },
    displayCategories: ['NETWORK', 'AI'],
  },

  // NETWORK + SYSTEM = Cloud Infrastructure
  {
    id: 'cloud_infra_fusion',
    name: '렌드리스',
    nameEn: 'Lend-Lease',
    description: '동맹과 사기의 보급! 투사체 +2 + 이동속도 +15%',
    descriptionEn: 'Alliance and Morale supply! +2 projectiles + 15% move speed',
    icon: 'Cloud',
    color: '#88AAFF',
    tier: 'fusion',
    requirements: {
      type: 'fusion',
      categories: ['NETWORK', 'SYSTEM'],
      minLevel: 10,
    },
    effect: {
      type: 'passive',
      passiveBonuses: {
        speedMultiplier: 1.15,
      },
      specialAbility: 'extra_projectiles',
    },
    displayCategories: ['NETWORK', 'SYSTEM'],
  },

  // SECURITY + AI = AI Security
  {
    id: 'ai_security_fusion',
    name: '방첩 작전',
    nameEn: 'Counterintelligence',
    description: '주권과 정보력의 합작! 자동 위협 감지 + 반격',
    descriptionEn: 'Sovereignty meets Intelligence! Auto threat detection + counter',
    icon: 'ShieldCheck',
    color: '#FFAA44',
    tier: 'fusion',
    requirements: {
      type: 'fusion',
      categories: ['SECURITY', 'AI'],
      minLevel: 10,
    },
    effect: {
      type: 'passive',
      passiveBonuses: {
        armor: 15,
        damageMultiplier: 1.15,
      },
      specialAbility: 'auto_counter',
    },
    displayCategories: ['SECURITY', 'AI'],
  },

  // SECURITY + SYSTEM = Hardened System
  {
    id: 'hardened_system_fusion',
    name: '지크프리트선',
    nameEn: 'Siegfried Line',
    description: '주권과 사기의 진지! 최대 체력 +20% + 피해 감소 +10%',
    descriptionEn: 'Sovereignty and Morale fortification! Max HP +20% + Damage reduction +10%',
    icon: 'Shield',
    color: '#44FFAA',
    tier: 'fusion',
    requirements: {
      type: 'fusion',
      categories: ['SECURITY', 'SYSTEM'],
      minLevel: 10,
    },
    effect: {
      type: 'passive',
      passiveBonuses: {
        armor: 20,
        hpRegen: 3,
      },
      specialAbility: 'max_hp_boost',
    },
    displayCategories: ['SECURITY', 'SYSTEM'],
  },

  // AI + SYSTEM = Superintelligence
  {
    id: 'superintelligence_fusion',
    name: '절대 권력',
    nameEn: 'Absolute Power',
    description: '정보력과 사기의 정점! 모든 스탯 +15%',
    descriptionEn: 'Peak of Intelligence and Morale! All stats +15%',
    icon: 'Sparkles',
    color: '#FFDD00',
    tier: 'fusion',
    requirements: {
      type: 'fusion',
      categories: ['AI', 'SYSTEM'],
      minLevel: 10,
    },
    effect: {
      type: 'passive',
      passiveBonuses: {
        damageMultiplier: 1.15,
        areaMultiplier: 1.15,
        cooldownMultiplier: 0.85,
        speedMultiplier: 1.15,
        critChance: 5,
      },
    },
    displayCategories: ['AI', 'SYSTEM'],
  },
];

// ============================================
// ULTIMATE SYNERGIES (특정 스킬 조합)
// ============================================

export const ULTIMATE_SYNERGIES: SynergyDefinition[] = [
  // Ultimate: Git + API + GraphQL (CODE 삼총사)
  {
    id: 'code_trinity',
    name: '삼위일체 작전',
    nameEn: 'Operation Trinity',
    description: '소총 + 추적탄 + 저격의 궁극 조합! STEEL 스킬 데미지 2배',
    descriptionEn: 'Ultimate Rifle + Tracer + Sniper combo! STEEL skills deal 2x damage',
    icon: 'Crown',
    color: '#00FF41',
    tier: 'ultimate',
    requirements: {
      type: 'skill_combo',
      skills: ['knife', 'wand', 'bow'] as WeaponType[],
      minLevel: 15,
    },
    effect: {
      type: 'passive',
      passiveBonuses: {
        damageMultiplier: 2.0,
      },
    },
    displaySkills: ['knife', 'wand', 'bow'] as WeaponType[],
  },

  // Ultimate: Lightning + Beam + Laser (AI 삼총사)
  {
    id: 'ai_trinity',
    name: '에셜론',
    nameEn: 'Echelon',
    description: '천벌 + 위성레이저 + 레이더 궁극 조합! INTEL 스킬 쿨다운 50% 감소',
    descriptionEn: 'Ultimate Divine + Satellite + Radar combo! INTEL skills -50% cooldown',
    icon: 'Brain',
    color: '#F59E0B',
    tier: 'ultimate',
    requirements: {
      type: 'skill_combo',
      skills: ['lightning', 'beam', 'laser'] as WeaponType[],
      minLevel: 15,
    },
    effect: {
      type: 'passive',
      passiveBonuses: {
        cooldownMultiplier: 0.50,
        damageMultiplier: 1.50,
      },
    },
    displaySkills: ['lightning', 'beam', 'laser'] as WeaponType[],
  },

  // Ultimate: Bible + Pool + Garlic (광역 삼총사)
  {
    id: 'aoe_trinity',
    name: '바르바로사',
    nameEn: 'Barbarossa',
    description: '순찰 + 소각지대 + 수비대 궁극 조합! 영역 범위 2배',
    descriptionEn: 'Ultimate Patrol + Scorched + Guard combo! Area size 2x',
    icon: 'Circle',
    color: '#06B6D4',
    tier: 'ultimate',
    requirements: {
      type: 'skill_combo',
      skills: ['bible', 'pool', 'garlic'] as WeaponType[],
      minLevel: 15,
    },
    effect: {
      type: 'passive',
      passiveBonuses: {
        areaMultiplier: 2.0,
        damageMultiplier: 1.25,
      },
    },
    displaySkills: ['bible', 'pool', 'garlic'] as WeaponType[],
  },

  // Ultimate: Whip + Punch + Sword (근접 삼총사)
  {
    id: 'melee_trinity',
    name: '발키리',
    nameEn: 'Valkyrie',
    description: '채찍 + 분노 + 영웅검 궁극 조합! 근접 공격 3배 데미지 + 넉백',
    descriptionEn: 'Steel Lash + Rage + Hero\'s Blade ultimate combo! Melee 3x damage + knockback',
    icon: 'Sword',
    color: '#10B981',
    tier: 'ultimate',
    requirements: {
      type: 'skill_combo',
      skills: ['whip', 'punch', 'sword'] as WeaponType[],
      minLevel: 15,
    },
    effect: {
      type: 'passive',
      passiveBonuses: {
        damageMultiplier: 3.0,
      },
      specialAbility: 'enhanced_knockback',
    },
    displaySkills: ['whip', 'punch', 'sword'] as WeaponType[],
  },

  // Ultimate: Focus + Overclock (시스템 마스터)
  {
    id: 'system_overload',
    name: '라그나로크',
    nameEn: 'Ragnar\u00f6k',
    description: '결사항전 + 진군나팔 동시 발동! 10초간 무적 + 데미지 5배',
    descriptionEn: 'Last Stand + Battle Horn at once! 10s invincibility + 5x damage',
    icon: 'Zap',
    color: '#FF4444',
    tier: 'ultimate',
    requirements: {
      type: 'skill_combo',
      skills: ['focus', 'overclock'] as WeaponType[],
      minLevel: 20,
    },
    effect: {
      type: 'active',
      activeAbility: {
        id: 'system_overload',
        name: '라그나로크',
        description: '10초간 무적 + 데미지 5배 (60초 쿨다운)',
        cooldown: 60,
        effect: {
          type: 'buff',
          value: 500,
          duration: 10,
          description: '10초간 화력 5배 + 무적',
        },
      },
    },
    displaySkills: ['focus', 'overclock'] as WeaponType[],
  },

  // Ultimate: Hotfix + Antivirus (생존 마스터)
  {
    id: 'survival_mastery',
    name: '불사조 작전',
    nameEn: 'Phoenix Protocol',
    description: '야전수리 + 국민의료의 극한 생존! 체력 재생 10/초 + 부활 2회',
    descriptionEn: 'Ultimate Field Repair + Healthcare survival! HP regen 10/s + 2 revives',
    icon: 'Heart',
    color: '#EF4444',
    tier: 'ultimate',
    requirements: {
      type: 'skill_combo',
      skills: ['hotfix', 'antivirus'] as WeaponType[],
      minLevel: 15,
    },
    effect: {
      type: 'passive',
      passiveBonuses: {
        hpRegen: 10,
        armor: 25,
      },
      specialAbility: 'double_revive',
    },
    displaySkills: ['hotfix', 'antivirus'] as WeaponType[],
  },
];

// ============================================
// AGGREGATED EXPORTS
// ============================================

/**
 * 모든 시너지 정의
 */
export const ALL_SYNERGIES: SynergyDefinition[] = [
  ...CATEGORY_MASTERY_SYNERGIES,
  ...FUSION_SYNERGIES,
  ...ULTIMATE_SYNERGIES,
];

/**
 * 시너지 ID로 찾기
 */
export const SYNERGY_MAP: Record<string, SynergyDefinition> = Object.fromEntries(
  ALL_SYNERGIES.map(s => [s.id, s])
);

/**
 * 티어별 시너지 필터
 */
export const getSynergiesByTier = (tier: 'mastery' | 'fusion' | 'ultimate'): SynergyDefinition[] =>
  ALL_SYNERGIES.filter(s => s.tier === tier);

/**
 * 카테고리 관련 시너지 찾기
 */
export const getSynergiesByCategory = (category: SkillCategory): SynergyDefinition[] =>
  ALL_SYNERGIES.filter(s => s.displayCategories?.includes(category));

/**
 * 스킬 관련 시너지 찾기
 */
export const getSynergiesBySkill = (skillId: WeaponType): SynergyDefinition[] =>
  ALL_SYNERGIES.filter(s => s.displaySkills?.includes(skillId));

/**
 * 시너지 활성화 조건 확인
 */
export const checkSynergyRequirements = (
  synergy: SynergyDefinition,
  playerSkills: Map<WeaponType, number>,
  getCategoryForSkill: (skillId: WeaponType) => SkillCategory | null
): boolean => {
  const { requirements } = synergy;

  switch (requirements.type) {
    case 'category_mastery': {
      if (!requirements.categories || !requirements.categoryCount) return false;
      const targetCategory = requirements.categories[0];
      let count = 0;
      playerSkills.forEach((level, skillId) => {
        if (level >= requirements.minLevel && getCategoryForSkill(skillId) === targetCategory) {
          count++;
        }
      });
      return count >= requirements.categoryCount;
    }

    case 'fusion': {
      if (!requirements.categories || requirements.categories.length < 2) return false;
      const [cat1, cat2] = requirements.categories;
      let hasCat1 = false;
      let hasCat2 = false;
      playerSkills.forEach((level, skillId) => {
        if (level >= requirements.minLevel) {
          const skillCat = getCategoryForSkill(skillId);
          if (skillCat === cat1) hasCat1 = true;
          if (skillCat === cat2) hasCat2 = true;
        }
      });
      return hasCat1 && hasCat2;
    }

    case 'skill_combo':
    case 'ultimate_fusion': {
      if (!requirements.skills) return false;
      return requirements.skills.every(
        skillId => (playerSkills.get(skillId) || 0) >= requirements.minLevel
      );
    }

    default:
      return false;
  }
};

/**
 * 활성화 가능한 모든 시너지 찾기
 */
export const getActivatableSynergies = (
  playerSkills: Map<WeaponType, number>,
  getCategoryForSkill: (skillId: WeaponType) => SkillCategory | null
): SynergyDefinition[] => {
  return ALL_SYNERGIES.filter(synergy =>
    checkSynergyRequirements(synergy, playerSkills, getCategoryForSkill)
  );
};

export default ALL_SYNERGIES;
