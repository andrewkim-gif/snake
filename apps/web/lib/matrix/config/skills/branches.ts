/**
 * branches.ts - Skill Branch Evolution Definitions
 * Lv11: Choose A or B path -> Lv20: Ultimate skill
 *
 * Ported from app_ingame/config/skills/branches.ts
 * SkillBranch inlined from missing skill.types
 *
 * DESIGN PRINCIPLES:
 * 1. FUN: Each branch must feel distinctly different and exciting
 * 2. DOPAMINE: Visual/audio feedback must be satisfying and rewarding
 * 3. CLARITY: Effects must be clearly visible on screen at all times
 */

import { WeaponType } from '../../types';

/** Branch special effect (inlined from skill.types) */
export interface BranchSpecialEffect {
  type: string;
  value: number;
  duration?: number;
  description: string;
}

/** Skill Branch (inlined from skill.types) */
export interface SkillBranch {
  id: 'A' | 'B';
  name: string;
  nameEn: string;
  description: string;
  icon: string;
  focus: string;
  bonuses: Record<string, number | BranchSpecialEffect>;
  ultimateName: string;
  ultimateNameEn: string;
  ultimateEffect: string;
  ultimateBonuses: Record<string, number | BranchSpecialEffect>;
}

/**
 * 분기 진화 정의
 * A분기: 광역/수량 특화 (스크린 가득 채우는 도파민)
 * B분기: 집중/위력 특화 (원샷 킬 도파민)
 */
export const SKILL_BRANCHES: Record<string, { A: SkillBranch; B: SkillBranch }> = {
  // ============================================
  // STEEL CATEGORY
  // ============================================

  knife: {
    A: {
      id: 'A',
      name: '탄막 확산',
      nameEn: 'Bullet Spread',
      description: '투사체가 3갈래로 분열! 화면을 총알로 가득 채워라',
      icon: 'GitFork',
      focus: 'multi',
      bonuses: {
        amount: 2,
        area: 0.8,
        cooldown: 0.85,
      },
      ultimateName: '화력 폭풍',
      ultimateNameEn: 'Firestorm',
      ultimateEffect: '8방향 탄막 폭풍! 화면 전체가 총알로 뒤덮인다',
      ultimateBonuses: {
        amount: 5,
        cooldown: 0.6,
        special: {
          type: 'chain',
          value: 2,
          description: '관통 시 2명에게 추가 타격',
        },
      },
    },
    B: {
      id: 'B',
      name: '충격 사격',
      nameEn: 'Impact Shot',
      description: '강력한 단일 충격파! 적을 날려버리는 임팩트',
      icon: 'Zap',
      focus: 'power',
      bonuses: {
        damage: 2.0,
        pierce: 3,
        knockback: 1.5,
      },
      ultimateName: '핵탄두',
      ultimateNameEn: 'Nuclear Warhead',
      ultimateEffect: '거대 폭발! 충돌 지점에서 핵폭발 발생',
      ultimateBonuses: {
        damage: 3.5,
        area: 2.0,
        special: {
          type: 'aoe',
          value: 150,
          duration: 0.5,
          description: '충돌 시 150px 범위 핵폭발',
        },
      },
    },
  },

  whip: {
    A: {
      id: 'A',
      name: '연속 참격',
      nameEn: 'Chain Slash',
      description: '여러 번의 참격이 동시에 휘몰아친다!',
      icon: 'Layers',
      focus: 'multi',
      bonuses: {
        amount: 1,
        area: 1.2,
      },
      ultimateName: '강철 회오리',
      ultimateNameEn: 'Steel Tornado',
      ultimateEffect: '4방향 채찍이 화면을 뒤덮는다!',
      ultimateBonuses: {
        amount: 3,
        area: 1.5,
        special: {
          type: 'stun',
          value: 0.3,
          duration: 0.5,
          description: '30% 확률로 0.5초 기절',
        },
      },
    },
    B: {
      id: 'B',
      name: '일섬',
      nameEn: 'One Strike',
      description: '한 번에 모든 것을! 극한의 집중 데미지',
      icon: 'Minus',
      focus: 'power',
      bonuses: {
        damage: 1.8,
        area: 1.4,
      },
      ultimateName: '참수형',
      ultimateNameEn: 'Decapitation',
      ultimateEffect: '아무도 막을 수 없는 전설의 일격!',
      ultimateBonuses: {
        damage: 3.0,
        area: 2.0,
        special: {
          type: 'execute',
          value: 15,
          description: '체력 30% 이하 적 15% 처형',
        },
      },
    },
  },

  wand: {
    A: {
      id: 'A',
      name: '다탄두 유도탄',
      nameEn: 'MIRV Missile',
      description: '여러 탄두가 동시에 목표를 추적!',
      icon: 'Sparkles',
      focus: 'multi',
      bonuses: {
        amount: 2,
        cooldown: 0.8,
      },
      ultimateName: '포화 사격',
      ultimateNameEn: 'Salvo Fire',
      ultimateEffect: '수많은 미사일이 동시에 발사된다!',
      ultimateBonuses: {
        amount: 5,
        special: {
          type: 'homing',
          value: 1,
          description: '완벽한 추적 성능',
        },
      },
    },
    B: {
      id: 'B',
      name: '벙커버스터',
      nameEn: 'Bunker Buster',
      description: '단일 고관통 미사일! 모든 것을 관통!',
      icon: 'Target',
      focus: 'power',
      bonuses: {
        damage: 2.2,
        pierce: 2,
      },
      ultimateName: '극초음속 미사일',
      ultimateNameEn: 'Hypersonic Missile',
      ultimateEffect: '무한 속도! 제한 없는 파괴력',
      ultimateBonuses: {
        damage: 4.0,
        special: {
          type: 'chain',
          value: 5,
          description: '5명에게 연쇄 피해',
        },
      },
    },
  },

  // ============================================
  // TERRITORY CATEGORY
  // ============================================

  bible: {
    A: {
      id: 'A',
      name: '순찰 증원',
      nameEn: 'Patrol Reinforcement',
      description: '순찰대가 더 많이, 더 넓게 순회!',
      icon: 'BookOpen',
      focus: 'multi',
      bonuses: {
        amount: 2,
        area: 1.3,
      },
      ultimateName: '요새 순찰',
      ultimateNameEn: 'Fortress Patrol',
      ultimateEffect: '모든 순찰대가 하나로! 거대한 보호막 형성',
      ultimateBonuses: {
        amount: 4,
        area: 1.8,
        special: {
          type: 'shield',
          value: 20,
          duration: 3,
          description: '3초간 20% 피해 감소',
        },
      },
    },
    B: {
      id: 'B',
      name: '저격 순찰',
      nameEn: 'Sniper Patrol',
      description: '간결하지만 치명적인 순찰!',
      icon: 'FileText',
      focus: 'power',
      bonuses: {
        damage: 1.8,
        speed: 1.5,
      },
      ultimateName: '처형 선고',
      ultimateNameEn: 'Death Sentence',
      ultimateEffect: '필중! 적이 걸리면 즉사',
      ultimateBonuses: {
        damage: 3.5,
        special: {
          type: 'execute',
          value: 20,
          description: '체력 25% 이하 적 20% 처형',
        },
      },
    },
  },

  pool: {
    A: {
      id: 'A',
      name: '확장 지뢰원',
      nameEn: 'Extended Minefield',
      description: '지뢰 지역 대폭 확대! 넓은 보호막',
      icon: 'Shield',
      focus: 'area',
      bonuses: {
        area: 2.0,
        duration: 1.3,
      },
      ultimateName: '전술 핵지뢰',
      ultimateNameEn: 'Tactical Nuclear Mine',
      ultimateEffect: '화면 절반을 덮는 거대 지뢰 영역!',
      ultimateBonuses: {
        area: 3.0,
        special: {
          type: 'slow',
          value: 50,
          description: '영역 내 적 이동속도 50% 감소',
        },
      },
    },
    B: {
      id: 'B',
      name: '네이팜 지옥',
      nameEn: 'Napalm Inferno',
      description: '작지만 맹렬! 영역 내 불지옥',
      icon: 'Flame',
      focus: 'damage',
      bonuses: {
        damage: 2.5,
        special: {
          type: 'dot',
          value: 15,
          duration: 3,
          description: '5초간 불길 데미지 15',
        },
      },
      ultimateName: '지열 폭발',
      ultimateNameEn: 'Geothermal Eruption',
      ultimateEffect: '중심에서 용암 분출! 들어오는 적 즉시 소각',
      ultimateBonuses: {
        damage: 5.0,
        special: {
          type: 'dot',
          value: 50,
          duration: 5,
          description: '5초간 틱당 50 피해 + 진입 시 폭발',
        },
      },
    },
  },

  shard: {
    A: {
      id: 'A',
      name: '산탄 클러스터',
      nameEn: 'Shotgun Cluster',
      description: '파편이 군집을 이뤄 퍼져나간다!',
      icon: 'Hexagon',
      focus: 'multi',
      bonuses: {
        amount: 4,
        area: 0.9,
      },
      ultimateName: '파편 폭풍',
      ultimateNameEn: 'Shrapnel Typhoon',
      ultimateEffect: '파편 폭발! 전방위로 파편 방출',
      ultimateBonuses: {
        amount: 8,
        special: {
          type: 'split',
          value: 2,
          description: '각 파편이 2개로 분열',
        },
      },
    },
    B: {
      id: 'B',
      name: '관통 작렬탄',
      nameEn: 'AP Explosive',
      description: '핵심 파편! 치명적인 관통',
      icon: 'Diamond',
      focus: 'power',
      bonuses: {
        damage: 2.0,
        pierce: 5,
      },
      ultimateName: '신의 창',
      ultimateNameEn: "God's Spear",
      ultimateEffect: '모든 것을 관통하는 궁극의 파편!',
      ultimateBonuses: {
        damage: 4.0,
        pierce: 999,
        special: {
          type: 'pierce',
          value: 100,
          description: '무한 관통 + 관통 시 데미지 유지',
        },
      },
    },
  },

  // ============================================
  // ALLIANCE CATEGORY
  // ============================================

  bridge: {
    A: {
      id: 'A',
      name: '동맹 확장',
      nameEn: 'Alliance Expansion',
      description: '더 많은 적을 연결! 연쇄 데미지 극대화',
      icon: 'Network',
      focus: 'chain',
      bonuses: {
        amount: 3,
        area: 1.2,
      },
      ultimateName: '세계 연합',
      ultimateNameEn: 'World Coalition',
      ultimateEffect: '화면 모든 적을 하나로 연결!',
      ultimateBonuses: {
        amount: 10,
        special: {
          type: 'chain',
          value: 30,
          description: '연결된 적 중 하나 처치 시 전체 30% 데미지',
        },
      },
    },
    B: {
      id: 'B',
      name: '양자 통신',
      nameEn: 'Direct Line',
      description: '1:1 초고속 연결! 강력한 집중 피해',
      icon: 'Link',
      focus: 'power',
      bonuses: {
        damage: 2.5,
        special: {
          type: 'stun',
          value: 50,
          duration: 1,
          description: '연결 시 50% 확률로 1초 기절',
        },
      },
      ultimateName: '항복 강요',
      ultimateNameEn: 'Forced Surrender',
      ultimateEffect: '저항 불가! 완전한 제압',
      ultimateBonuses: {
        damage: 4.0,
        special: {
          type: 'stun',
          value: 100,
          duration: 3,
          description: '연결된 적 3초 완전 정지',
        },
      },
    },
  },

  ping: {
    A: {
      id: 'A',
      name: '다중 정찰',
      nameEn: 'Multi Recon',
      description: '동시에 여러 타겟 정찰!',
      icon: 'Radio',
      focus: 'multi',
      bonuses: {
        amount: 3,
        cooldown: 0.7,
      },
      ultimateName: '전면 경보',
      ultimateNameEn: 'Total Alert',
      ultimateEffect: '전체 경보 발령! 모든 적에게 정찰 타격',
      ultimateBonuses: {
        amount: 8,
        special: {
          type: 'debuff',
          value: 20,
          duration: 5,
          description: '5초간 받는 피해 20% 증가',
        },
      },
    },
    B: {
      id: 'B',
      name: '정밀 타격',
      nameEn: 'Precision Strike',
      description: '초고속 집중 타격! 순간 폭딜',
      icon: 'Zap',
      focus: 'power',
      bonuses: {
        damage: 2.2,
        speed: 2.0,
      },
      ultimateName: '궤도 저격',
      ultimateNameEn: 'Orbital Snipe',
      ultimateEffect: '궤도에서 저격! 화면 관통',
      ultimateBonuses: {
        damage: 5.0,
        pierce: 999,
        special: {
          type: 'pierce',
          value: 100,
          description: '화면 끝까지 관통',
        },
      },
    },
  },

  // ============================================
  // SOVEREIGNTY CATEGORY
  // ============================================

  garlic: {
    A: {
      id: 'A',
      name: '확장 방어선',
      nameEn: 'Extended Perimeter',
      description: '방어선 범위 대폭 확대!',
      icon: 'Circle',
      focus: 'area',
      bonuses: {
        area: 1.8,
        duration: 1.2,
      },
      ultimateName: '철옹성',
      ultimateNameEn: 'Iron Fortress',
      ultimateEffect: '화면 전체 방어선!',
      ultimateBonuses: {
        area: 3.0,
        special: {
          type: 'slow',
          value: 40,
          description: '방어선 내 적 이동속도 40% 감소',
        },
      },
    },
    B: {
      id: 'B',
      name: '공세 방어',
      nameEn: 'Aggressive Defense',
      description: '방어선 데미지 강화 + 처치 폭발!',
      icon: 'Bomb',
      focus: 'damage',
      bonuses: {
        damage: 2.0,
        special: {
          type: 'aoe',
          value: 50,
          description: '방어선 내 처치 시 50px 폭발',
        },
      },
      ultimateName: '보복 타격',
      ultimateNameEn: 'Retaliatory Strike',
      ultimateEffect: '침입자 발견 즉시 폭파!',
      ultimateBonuses: {
        damage: 3.5,
        special: {
          type: 'aoe',
          value: 120,
          description: '처치 시 120px 폭발',
        },
      },
    },
  },

  // ============================================
  // INTELLIGENCE CATEGORY
  // ============================================

  lightning: {
    A: {
      id: 'A',
      name: '연쇄 천벌',
      nameEn: 'Chain Judgment',
      description: '천벌이 적에서 적으로 연쇄!',
      icon: 'Zap',
      focus: 'chain',
      bonuses: {
        amount: 3,
        damage: 0.9,
      },
      ultimateName: '신의 분노',
      ultimateNameEn: 'Wrath of God',
      ultimateEffect: '하늘에서 무수한 천벌이 내리친다!',
      ultimateBonuses: {
        amount: 8,
        special: {
          type: 'stun',
          value: 30,
          duration: 0.5,
          description: '30% 확률로 0.5초 기절',
        },
      },
    },
    B: {
      id: 'B',
      name: '집중 천벌',
      nameEn: 'Focused Judgment',
      description: '집중된 천벌! 단일 대상 초고데미지',
      icon: 'Circle',
      focus: 'power',
      bonuses: {
        damage: 2.5,
        cooldown: 0.7,
      },
      ultimateName: '심판의 벼락',
      ultimateNameEn: 'Final Thunder',
      ultimateEffect: '신의 일격! 하나를 완전히 소멸',
      ultimateBonuses: {
        damage: 6.0,
        special: {
          type: 'execute',
          value: 25,
          description: '체력 40% 이하 적 25% 처형',
        },
      },
    },
  },

  beam: {
    A: {
      id: 'A',
      name: '다중 위성',
      nameEn: 'Multi Satellite',
      description: '여러 위성에서 동시에 레이저!',
      icon: 'Layers',
      focus: 'multi',
      bonuses: {
        amount: 2,
        area: 0.8,
      },
      ultimateName: '위성 그물',
      ultimateNameEn: 'Satellite Net',
      ultimateEffect: '모든 위성 동시 발사! 360도 빔',
      ultimateBonuses: {
        amount: 4,
        special: {
          type: 'pierce',
          value: 50,
          description: '빔 지속 시간 50% 증가',
        },
      },
    },
    B: {
      id: 'B',
      name: '관통 레이저',
      nameEn: 'Penetrating Laser',
      description: '깊은 관통! 강력한 단일 빔',
      icon: 'ArrowDown',
      focus: 'power',
      bonuses: {
        damage: 2.2,
        duration: 1.5,
      },
      ultimateName: '신의 눈',
      ultimateNameEn: 'Eye of God',
      ultimateEffect: '궤도에서 모든 것을 관통하는 레이저',
      ultimateBonuses: {
        damage: 4.5,
        pierce: 999,
        special: {
          type: 'dot',
          value: 30,
          duration: 3,
          description: '빔 히트 시 3초간 틱당 30 피해',
        },
      },
    },
  },

  laser: {
    A: {
      id: 'A',
      name: '다중 레이더',
      nameEn: 'Multi Radar',
      description: '여러 레이더가 동시에 회전!',
      icon: 'RotateCw',
      focus: 'multi',
      bonuses: {
        amount: 2,
        speed: 1.3,
      },
      ultimateName: '전방위 감시',
      ultimateNameEn: 'Total Surveillance',
      ultimateEffect: '멈추지 않는 회전! 영구 감시',
      ultimateBonuses: {
        amount: 4,
        special: {
          type: 'buff',
          value: 100,
          description: '레이더 지속시간 무한',
        },
      },
    },
    B: {
      id: 'B',
      name: '궤도 사격',
      nameEn: 'Orbital Fire',
      description: '강력한 단일 궤도 사격!',
      icon: 'Crosshair',
      focus: 'power',
      bonuses: {
        damage: 2.5,
        area: 1.5,
      },
      ultimateName: '아르마겟돈',
      ultimateNameEn: 'Armageddon',
      ultimateEffect: '궤도에서 발사! 화면 관통 레이저',
      ultimateBonuses: {
        damage: 5.0,
        area: 2.5,
        special: {
          type: 'aoe',
          value: 200,
          description: '궤도 사격 경로 200px 범위 데미지',
        },
      },
    },
  },

  // ============================================
  // MORALE CATEGORY (Passive buffs)
  // ============================================

  focus: {
    A: {
      id: 'A',
      name: '사무라이 정신',
      nameEn: 'Bushido Spirit',
      description: '집중 시간이 길어질수록 강해짐',
      icon: 'Clock',
      focus: 'scaling',
      bonuses: {
        damage: 1.5,
        special: {
          type: 'buff',
          value: 5,
          description: '집중 5초당 크리티컬 +5%',
        },
      },
      ultimateName: '무아지경',
      ultimateNameEn: 'Transcendence',
      ultimateEffect: '완벽한 집중! 크리티컬 100%',
      ultimateBonuses: {
        special: {
          type: 'buff',
          value: 100,
          description: '30초간 크리티컬 100%',
        },
      },
    },
    B: {
      id: 'B',
      name: '광기의 순간',
      nameEn: 'Moment of Madness',
      description: '짧지만 강력한 광기!',
      icon: 'Zap',
      focus: 'burst',
      bonuses: {
        damage: 2.0,
        special: {
          type: 'buff',
          value: 50,
          duration: 3,
          description: '발동 시 3초간 크리티컬 +50%',
        },
      },
      ultimateName: '전쟁의 화신',
      ultimateNameEn: 'Avatar of War',
      ultimateEffect: '분노 폭발! 5초간 무적 + 3배 데미지',
      ultimateBonuses: {
        special: {
          type: 'buff',
          value: 300,
          duration: 5,
          description: '5초간 무적 + 화력 300%',
        },
      },
    },
  },

  overclock: {
    A: {
      id: 'A',
      name: '전격전',
      nameEn: 'Blitzkrieg',
      description: '지속적인 전격 기동!',
      icon: 'FastForward',
      focus: 'sustained',
      bonuses: {
        speed: 1.5,
        duration: 999,
      },
      ultimateName: '시공 초월',
      ultimateNameEn: 'Warp Speed',
      ultimateEffect: '초광속! 이동속도 3배',
      ultimateBonuses: {
        speed: 3.0,
        special: {
          type: 'buff',
          value: 50,
          description: '기동 시 50% 회피율',
        },
      },
    },
    B: {
      id: 'B',
      name: '돌격 명령',
      nameEn: 'Charge Order',
      description: '짧지만 폭발적인 돌격!',
      icon: 'Flame',
      focus: 'burst',
      bonuses: {
        speed: 2.5,
        duration: 3,
        special: {
          type: 'aoe',
          value: 30,
          description: '돌격 경로에 30 데미지',
        },
      },
      ultimateName: '충격과 공포',
      ultimateNameEn: 'Shock & Awe',
      ultimateEffect: '음속 돌파! 충격파 발생',
      ultimateBonuses: {
        speed: 5.0,
        special: {
          type: 'aoe',
          value: 100,
          description: '돌격 종료 시 200px 충격파 100 데미지',
        },
      },
    },
  },
};

/**
 * 분기 선택 가능 레벨
 */
export const BRANCH_UNLOCK_LEVEL = 11;

/**
 * 궁극기 해금 레벨
 */
export const ULTIMATE_UNLOCK_LEVEL = 20;

/**
 * 분기가 있는 스킬 목록
 */
export const SKILLS_WITH_BRANCHES: string[] = Object.keys(SKILL_BRANCHES);

/**
 * 스킬 분기 정보 가져오기
 */
export const getSkillBranches = (skillId: string): { A: SkillBranch; B: SkillBranch } | null => {
  return SKILL_BRANCHES[skillId] || null;
};

/**
 * 분기 선택 시 보너스 계산
 */
export const calculateBranchBonus = (
  skillId: string,
  branch: 'A' | 'B',
  level: number
): SkillBranch['bonuses'] | null => {
  const branches = getSkillBranches(skillId);
  if (!branches) return null;

  const selectedBranch = branches[branch];

  // Lv11: 기본 분기 보너스
  // Lv20: 궁극기 보너스 추가
  if (level >= ULTIMATE_UNLOCK_LEVEL) {
    return {
      ...selectedBranch.bonuses,
      ...selectedBranch.ultimateBonuses,
    };
  }

  return selectedBranch.bonuses;
};

export default SKILL_BRANCHES;
