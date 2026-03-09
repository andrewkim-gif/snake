/**
 * presets.ts - Skill Build Presets
 * Pre-designed skill paths for different playstyles
 *
 * Ported from app_ingame/config/skills/presets.ts
 * SkillBuild inlined from missing skill.types
 *
 * BUILD PRESET PHILOSOPHY:
 * 1. CLEAR IDENTITY: Each build has a distinct playstyle
 * 2. SYNERGY FOCUS: Builds are designed to activate specific synergies
 * 3. PROGRESSION: Clear upgrade path from early to late game
 */

import { SkillCategory } from './definitions';
import { WeaponType, PlayerClass } from '../../types';

/** Skill Build (inlined from skill.types) */
export interface SkillBuild {
  id: string;
  name: string;
  nameEn: string;
  icon: string;
  description: string;
  descriptionEn: string;
  startingSkills: WeaponType[];
  priorityPath: WeaponType[];
  targetSynergies: string[];
  recommendedClass?: PlayerClass;
  recommendedBranches: Record<WeaponType, 'A' | 'B'>;
}

// ============================================
// PRESET BUILD DEFINITIONS
// ============================================

export const SKILL_BUILD_PRESETS: SkillBuild[] = [
  // ============================================
  // 입문자용 빌드 (Beginner Builds)
  // ============================================

  {
    id: 'balanced_starter',
    name: '밸런스 스타터',
    nameEn: 'Balanced Starter',
    icon: 'Scale',
    description: '초보자 추천! 균형잡힌 공격과 방어',
    descriptionEn: 'Recommended for beginners! Balanced offense and defense',
    startingSkills: ['knife' as WeaponType, 'garlic' as WeaponType],
    priorityPath: [
      'knife', 'garlic', 'wand', 'bible', 'lightning', 'focus',
      'overclock', 'pool', 'beam', 'antivirus'
    ] as WeaponType[],
    targetSynergies: ['fullstack_fusion', 'secure_code_fusion'],
    recommendedBranches: {
      knife: 'A',
      garlic: 'A',
      wand: 'A',
      bible: 'A',
    } as Record<WeaponType, 'A' | 'B'>,
  },

  {
    id: 'survival_focus',
    name: '생존형 빌드',
    nameEn: 'Survival Build',
    icon: 'Heart',
    description: '죽지 않는 것이 목표! 최대 생존력',
    descriptionEn: 'Stay alive! Maximum survivability',
    startingSkills: ['garlic' as WeaponType, 'antivirus' as WeaponType],
    priorityPath: [
      'garlic', 'antivirus', 'hotfix', 'firewall_surge', 'encryption',
      'ram_upgrade', 'backup', 'incident_response', 'pool', 'zero_trust'
    ] as WeaponType[],
    targetSynergies: ['security_mastery', 'hardened_system_fusion', 'survival_mastery'],
    recommendedClass: 'tank' as PlayerClass,
    recommendedBranches: {
      garlic: 'A',
      pool: 'A',
      focus: 'A',
    } as Record<WeaponType, 'A' | 'B'>,
  },

  // ============================================
  // 공격형 빌드 (Offensive Builds)
  // ============================================

  {
    id: 'projectile_storm',
    name: '투사체 폭풍',
    nameEn: 'Projectile Storm',
    icon: 'Sparkles',
    description: '화면을 투사체로 뒤덮어라! 다중 발사 특화',
    descriptionEn: 'Fill the screen with projectiles! Multi-shot specialist',
    startingSkills: ['knife' as WeaponType, 'shard' as WeaponType],
    priorityPath: [
      'knife', 'shard', 'fork', 'bow', 'ping', 'wand',
      'csv_spray', 'airdrop', 'multithreading', 'json_bomb'
    ] as WeaponType[],
    targetSynergies: ['code_mastery', 'fullstack_fusion', 'code_trinity'],
    recommendedBranches: {
      knife: 'A',
      shard: 'A',
      wand: 'A',
      ping: 'A',
      fork: 'A',
    } as Record<WeaponType, 'A' | 'B'>,
  },

  {
    id: 'oneshot_sniper',
    name: '원샷 스나이퍼',
    nameEn: 'Oneshot Sniper',
    icon: 'Target',
    description: '한 방에 끝낸다! 단일 대상 최대 데미지',
    descriptionEn: 'One shot, one kill! Maximum single target damage',
    startingSkills: ['bow' as WeaponType, 'wand' as WeaponType],
    priorityPath: [
      'bow', 'wand', 'knife', 'lightning', 'axe', 'focus',
      'debugger_skill', 'sql_injection', 'compiler', 'sword'
    ] as WeaponType[],
    targetSynergies: ['code_mastery', 'ai_coding_fusion', 'perf_engineer_fusion'],
    recommendedClass: 'trinity' as PlayerClass,
    recommendedBranches: {
      knife: 'B',
      bow: 'B',
      wand: 'B',
      lightning: 'B',
      focus: 'B',
    } as Record<WeaponType, 'A' | 'B'>,
  },

  {
    id: 'aoe_devastation',
    name: '광역 파괴자',
    nameEn: 'AoE Devastator',
    icon: 'Bomb',
    description: '넓은 범위를 초토화! 광역 데미지 특화',
    descriptionEn: 'Devastate wide areas! AoE damage specialist',
    startingSkills: ['pool' as WeaponType, 'bible' as WeaponType],
    priorityPath: [
      'pool', 'bible', 'garlic', 'airdrop', 'json_bomb', 'tcp_flood',
      'firewall_surge', 'ddos', 'singularity_core', 'big_data'
    ] as WeaponType[],
    targetSynergies: ['data_mastery', 'aoe_trinity', 'data_pipeline_fusion'],
    recommendedBranches: {
      pool: 'A',
      bible: 'A',
      garlic: 'A',
      shard: 'A',
    } as Record<WeaponType, 'A' | 'B'>,
  },

  // ============================================
  // AI 특화 빌드 (AI Builds)
  // ============================================

  {
    id: 'ai_autopilot',
    name: 'AI 오토파일럿',
    nameEn: 'AI Autopilot',
    icon: 'Brain',
    description: 'AI가 알아서 싸운다! 자동 공격 특화',
    descriptionEn: 'Let AI do the fighting! Auto-attack specialist',
    startingSkills: ['lightning' as WeaponType, 'wand' as WeaponType],
    priorityPath: [
      'lightning', 'wand', 'neural_net', 'autopilot', 'beam', 'laser',
      'chatgpt', 'deepfake', 'singularity_core', 'agi'
    ] as WeaponType[],
    targetSynergies: ['ai_mastery', 'ai_trinity', 'ai_coding_fusion', 'superintelligence_fusion'],
    recommendedClass: 'oracle' as PlayerClass,
    recommendedBranches: {
      lightning: 'A',
      beam: 'A',
      laser: 'A',
      wand: 'A',
    } as Record<WeaponType, 'A' | 'B'>,
  },

  {
    id: 'neural_dominance',
    name: '뉴럴 도미넌스',
    nameEn: 'Neural Dominance',
    icon: 'Network',
    description: 'AI의 힘으로 지배! 딥러닝 특화',
    descriptionEn: 'Dominate with AI! Deep learning specialist',
    startingSkills: ['lightning' as WeaponType, 'neural_net' as WeaponType],
    priorityPath: [
      'lightning', 'neural_net', 'beam', 'laser', 'autopilot',
      'bridge', 'chatgpt', 'p2p', 'singularity_core', 'agi'
    ] as WeaponType[],
    targetSynergies: ['ai_mastery', 'neural_network_fusion', 'ml_fusion'],
    recommendedBranches: {
      lightning: 'B',
      beam: 'B',
      laser: 'B',
      bridge: 'B',
    } as Record<WeaponType, 'A' | 'B'>,
  },

  // ============================================
  // 체인/연쇄 빌드 (Chain Builds)
  // ============================================

  {
    id: 'chain_reaction',
    name: '체인 리액션',
    nameEn: 'Chain Reaction',
    icon: 'Link',
    description: '연쇄 반응! 적을 연결하여 동시 처치',
    descriptionEn: 'Chain reaction! Connect enemies for simultaneous kills',
    startingSkills: ['bridge' as WeaponType, 'lightning' as WeaponType],
    priorityPath: [
      'bridge', 'lightning', 'ping', 'fork', 'websocket',
      'tcp_flood', 'p2p', 'ddos', 'vpn_tunnel', 'dns_spoof'
    ] as WeaponType[],
    targetSynergies: ['network_mastery', 'neural_network_fusion', 'data_pipeline_fusion'],
    recommendedBranches: {
      bridge: 'A',
      lightning: 'A',
      ping: 'A',
    } as Record<WeaponType, 'A' | 'B'>,
  },

  // ============================================
  // 근접 빌드 (Melee Builds)
  // ============================================

  {
    id: 'melee_berserker',
    name: '근접 버서커',
    nameEn: 'Melee Berserker',
    icon: 'Sword',
    description: '정면 돌파! 근접 전투 특화',
    descriptionEn: 'Charge forward! Close combat specialist',
    startingSkills: ['whip' as WeaponType, 'punch' as WeaponType],
    priorityPath: [
      'whip', 'punch', 'sword', 'garlic', 'axe', 'focus',
      'overclock', 'cpu_boost', 'firewall_surge', 'ram_upgrade'
    ] as WeaponType[],
    targetSynergies: ['melee_trinity', 'perf_engineer_fusion', 'hardened_system_fusion'],
    recommendedClass: 'morpheus' as PlayerClass,
    recommendedBranches: {
      whip: 'B',
      punch: 'B',
      sword: 'B',
      garlic: 'B',
      focus: 'B',
    } as Record<WeaponType, 'A' | 'B'>,
  },

  // ============================================
  // 시스템 버프 빌드 (System Buff Builds)
  // ============================================

  {
    id: 'system_optimizer',
    name: '시스템 옵티마이저',
    nameEn: 'System Optimizer',
    icon: 'Cpu',
    description: '완벽한 최적화! 모든 스탯 극대화',
    descriptionEn: 'Perfect optimization! Maximize all stats',
    startingSkills: ['focus' as WeaponType, 'overclock' as WeaponType],
    priorityPath: [
      'focus', 'overclock', 'ram_upgrade', 'cpu_boost', 'cache',
      'multithreading', 'garbage_collection', 'refactor', 'sword', 'knife'
    ] as WeaponType[],
    targetSynergies: ['system_mastery', 'perf_engineer_fusion', 'system_overload'],
    recommendedBranches: {
      focus: 'A',
      overclock: 'A',
    } as Record<WeaponType, 'A' | 'B'>,
  },

  // ============================================
  // 혼합 빌드 (Hybrid Builds)
  // ============================================

  {
    id: 'devops_hybrid',
    name: 'DevOps 하이브리드',
    nameEn: 'DevOps Hybrid',
    icon: 'GitBranch',
    description: '개발과 운영의 조화! 밸런스형 하이브리드',
    descriptionEn: 'Dev meets Ops! Balanced hybrid',
    startingSkills: ['knife' as WeaponType, 'bridge' as WeaponType],
    priorityPath: [
      'knife', 'bridge', 'wand', 'ping', 'fork', 'shard',
      'lightning', 'overclock', 'cache', 'refactor'
    ] as WeaponType[],
    targetSynergies: ['devops_fusion', 'code_mastery', 'network_mastery'],
    recommendedBranches: {
      knife: 'A',
      bridge: 'A',
      wand: 'A',
    } as Record<WeaponType, 'A' | 'B'>,
  },

  {
    id: 'security_hacker',
    name: '화이트 해커',
    nameEn: 'White Hacker',
    icon: 'ShieldCheck',
    description: '공격적인 방어! 보안 + 공격 하이브리드',
    descriptionEn: 'Offensive defense! Security + Attack hybrid',
    startingSkills: ['garlic' as WeaponType, 'knife' as WeaponType],
    priorityPath: [
      'garlic', 'knife', 'firewall_surge', 'encryption', 'sql_injection',
      'sandbox', 'honeypot', 'zero_trust', 'debugger_skill', 'backup'
    ] as WeaponType[],
    targetSynergies: ['secure_code_fusion', 'security_mastery', 'zero_trust_fusion'],
    recommendedClass: 'cypher' as PlayerClass,
    recommendedBranches: {
      garlic: 'B',
      knife: 'B',
    } as Record<WeaponType, 'A' | 'B'>,
  },

  // ============================================
  // 고급 빌드 (Advanced Builds)
  // ============================================

  {
    id: 'singularity_seeker',
    name: '싱귤래리티 시커',
    nameEn: 'Singularity Seeker',
    icon: 'Circle',
    description: '한계 돌파! 최강 시너지 조합',
    descriptionEn: 'Break the limit! Ultimate synergy combination',
    startingSkills: ['lightning' as WeaponType, 'beam' as WeaponType],
    priorityPath: [
      'lightning', 'beam', 'laser', 'neural_net', 'singularity_core',
      'agi', 'focus', 'overclock', 'big_data', 'ddos'
    ] as WeaponType[],
    targetSynergies: ['ai_trinity', 'ai_mastery', 'superintelligence_fusion', 'system_overload'],
    recommendedBranches: {
      lightning: 'A',
      beam: 'A',
      laser: 'A',
      focus: 'A',
      overclock: 'A',
    } as Record<WeaponType, 'A' | 'B'>,
  },

  {
    id: 'full_stack_master',
    name: '풀스택 마스터',
    nameEn: 'Full Stack Master',
    icon: 'Layers',
    description: 'CODE + DATA 완벽 조합!',
    descriptionEn: 'Perfect CODE + DATA combination!',
    startingSkills: ['knife' as WeaponType, 'bible' as WeaponType],
    priorityPath: [
      'knife', 'bible', 'wand', 'pool', 'bow', 'shard',
      'compiler', 'json_bomb', 'binary', 'big_data'
    ] as WeaponType[],
    targetSynergies: ['fullstack_fusion', 'code_mastery', 'data_mastery', 'code_trinity'],
    recommendedBranches: {
      knife: 'A',
      bible: 'A',
      wand: 'B',
      pool: 'B',
      bow: 'B',
      shard: 'A',
    } as Record<WeaponType, 'A' | 'B'>,
  },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * 빌드 프리셋 ID로 찾기
 */
export const getPresetById = (id: string): SkillBuild | undefined =>
  SKILL_BUILD_PRESETS.find(p => p.id === id);

/**
 * 추천 캐릭터로 필터링
 */
export const getPresetsForClass = (playerClass: PlayerClass): SkillBuild[] =>
  SKILL_BUILD_PRESETS.filter(p => !p.recommendedClass || p.recommendedClass === playerClass);

/**
 * 시너지 타겟으로 필터링
 */
export const getPresetsBySynergy = (synergyId: string): SkillBuild[] =>
  SKILL_BUILD_PRESETS.filter(p => p.targetSynergies.includes(synergyId));

/**
 * 시작 스킬로 필터링
 */
export const getPresetsByStartingSkill = (skillId: WeaponType): SkillBuild[] =>
  SKILL_BUILD_PRESETS.filter(p => p.startingSkills.includes(skillId));

/**
 * 빌드의 주요 카테고리 분석
 */
export const getPresetMainCategories = (
  preset: SkillBuild,
  getCategory: (skillId: WeaponType) => SkillCategory | null
): SkillCategory[] => {
  const categoryCounts: Record<SkillCategory, number> = {
    CODE: 0,
    DATA: 0,
    NETWORK: 0,
    SECURITY: 0,
    AI: 0,
    SYSTEM: 0,
  };

  preset.priorityPath.forEach(skillId => {
    const cat = getCategory(skillId);
    if (cat) categoryCounts[cat]++;
  });

  // 상위 2개 카테고리 반환
  return (Object.entries(categoryCounts) as [SkillCategory, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([cat]) => cat);
};

/**
 * 빌드 난이도 계산
 */
export const getPresetDifficulty = (preset: SkillBuild): 'easy' | 'medium' | 'hard' => {
  const easyStarters = ['knife', 'whip', 'wand', 'garlic', 'bible', 'focus'];
  const hasEasyStart = preset.startingSkills.some(s => easyStarters.includes(s));

  const synergyCount = preset.targetSynergies.length;

  if (hasEasyStart && synergyCount <= 2) return 'easy';
  if (synergyCount >= 4) return 'hard';
  return 'medium';
};

/**
 * 빌드 태그 생성 (UI 표시용)
 */
export const getPresetTags = (preset: SkillBuild): string[] => {
  const tags: string[] = [];

  const difficulty = getPresetDifficulty(preset);
  if (difficulty === 'easy') tags.push('입문자 추천');
  if (difficulty === 'hard') tags.push('고급');

  if (preset.recommendedClass) {
    tags.push(preset.recommendedClass);
  }

  if (preset.id.includes('survival')) tags.push('생존');
  if (preset.id.includes('projectile') || preset.id.includes('storm')) tags.push('투사체');
  if (preset.id.includes('aoe')) tags.push('광역');
  if (preset.id.includes('ai') || preset.id.includes('neural')) tags.push('AI');
  if (preset.id.includes('melee')) tags.push('근접');
  if (preset.id.includes('chain')) tags.push('체인');

  return tags;
};

// ============================================
// DEFAULT EXPORTS
// ============================================

export default SKILL_BUILD_PRESETS;
