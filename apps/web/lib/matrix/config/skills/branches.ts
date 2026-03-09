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
  // CODE CATEGORY
  // ============================================

  knife: {
    A: {
      id: 'A',
      name: '포크 러시',
      nameEn: 'Fork Rush',
      description: '투사체가 3갈래로 분열! 화면을 커밋으로 가득 채워라',
      icon: 'GitFork',
      focus: 'multi',
      bonuses: {
        amount: 2,
        area: 0.8,
        cooldown: 0.85,
      },
      ultimateName: '브랜치 스톰',
      ultimateNameEn: 'Branch Storm',
      ultimateEffect: '8방향 투사체 폭풍! 화면 전체가 커밋으로 뒤덮인다',
      ultimateBonuses: {
        amount: 5,
        cooldown: 0.6,
        special: {
          type: 'chain',
          value: 2,
          description: '적 관통 시 2마리에게 추가 히트',
        },
      },
    },
    B: {
      id: 'B',
      name: '포스 푸시',
      nameEn: 'Force Push',
      description: '강력한 단일 충격파! 적을 날려버리는 임팩트',
      icon: 'Zap',
      focus: 'power',
      bonuses: {
        damage: 2.0,
        pierce: 3,
        knockback: 1.5,
      },
      ultimateName: '머지 콘플릭트',
      ultimateNameEn: 'Merge Conflict',
      ultimateEffect: '거대 폭발! 충돌 지점에서 대폭발 발생',
      ultimateBonuses: {
        damage: 3.5,
        area: 2.0,
        special: {
          type: 'aoe',
          value: 150,
          duration: 0.5,
          description: '충돌 시 150px 범위 대폭발',
        },
      },
    },
  },

  whip: {
    A: {
      id: 'A',
      name: '멀티라인 코드',
      nameEn: 'Multiline Code',
      description: '여러 줄의 코드가 동시에 휘몰아친다!',
      icon: 'Layers',
      focus: 'multi',
      bonuses: {
        amount: 1,
        area: 1.2,
      },
      ultimateName: '스파게티 코드',
      ultimateNameEn: 'Spaghetti Code',
      ultimateEffect: '4방향 채찍이 화면을 뒤덮는다!',
      ultimateBonuses: {
        amount: 3,
        area: 1.5,
        special: {
          type: 'stun',
          value: 0.3,
          duration: 0.5,
          description: '30% 확률로 0.5초 스턴',
        },
      },
    },
    B: {
      id: 'B',
      name: '원라이너',
      nameEn: 'One-Liner',
      description: '한 줄에 모든 것을! 극한의 집중 데미지',
      icon: 'Minus',
      focus: 'power',
      bonuses: {
        damage: 1.8,
        area: 1.4,
      },
      ultimateName: '레거시 코드',
      ultimateNameEn: 'Legacy Code',
      ultimateEffect: '아무도 건드릴 수 없는 전설의 한 줄!',
      ultimateBonuses: {
        damage: 3.0,
        area: 2.0,
        special: {
          type: 'execute',
          value: 15,
          description: '체력 30% 이하 적 15% 즉사',
        },
      },
    },
  },

  wand: {
    A: {
      id: 'A',
      name: 'REST 스프레이',
      nameEn: 'REST Spray',
      description: '여러 API 엔드포인트 동시 호출!',
      icon: 'Sparkles',
      focus: 'multi',
      bonuses: {
        amount: 2,
        cooldown: 0.8,
      },
      ultimateName: '마이크로서비스',
      ultimateNameEn: 'Microservices',
      ultimateEffect: '수많은 서비스가 동시에 응답한다!',
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
      name: 'GraphQL 뮤테이션',
      nameEn: 'GraphQL Mutation',
      description: '단일 요청으로 모든 데이터를 변경!',
      icon: 'Target',
      focus: 'power',
      bonuses: {
        damage: 2.2,
        pierce: 2,
      },
      ultimateName: '서버리스',
      ultimateNameEn: 'Serverless',
      ultimateEffect: '무한 스케일! 제한 없는 파괴력',
      ultimateBonuses: {
        damage: 4.0,
        special: {
          type: 'chain',
          value: 5,
          description: '5마리에게 연쇄 피해',
        },
      },
    },
  },

  // ============================================
  // DATA CATEGORY
  // ============================================

  bible: {
    A: {
      id: 'A',
      name: 'API 문서',
      nameEn: 'API Docs',
      description: '문서가 더 많이, 더 넓게 회전!',
      icon: 'BookOpen',
      focus: 'multi',
      bonuses: {
        amount: 2,
        area: 1.3,
      },
      ultimateName: '컨플루언스',
      ultimateNameEn: 'Confluence',
      ultimateEffect: '모든 문서가 하나로! 거대한 보호막 형성',
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
      name: '마크다운',
      nameEn: 'Markdown',
      description: '간결하지만 치명적인 문서!',
      icon: 'FileText',
      focus: 'power',
      bonuses: {
        damage: 1.8,
        speed: 1.5,
      },
      ultimateName: 'README',
      ultimateNameEn: 'README',
      ultimateEffect: '필독! 적이 읽으면 즉사',
      ultimateBonuses: {
        damage: 3.5,
        special: {
          type: 'execute',
          value: 20,
          description: '체력 25% 이하 적 20% 즉사',
        },
      },
    },
  },

  pool: {
    A: {
      id: 'A',
      name: '글로벌 방화벽',
      nameEn: 'Global Firewall',
      description: '방화벽 영역 대폭 확대! 넓은 보호막',
      icon: 'Shield',
      focus: 'area',
      bonuses: {
        area: 2.0,
        duration: 1.3,
      },
      ultimateName: '클라우드 방화벽',
      ultimateNameEn: 'Cloud Firewall',
      ultimateEffect: '화면 절반을 덮는 거대 보호 영역!',
      ultimateBonuses: {
        area: 3.0,
        special: {
          type: 'slow',
          value: 50,
          description: '영역 내 적 50% 슬로우',
        },
      },
    },
    B: {
      id: 'B',
      name: '인페르노',
      nameEn: 'Inferno',
      description: '작지만 맹렬! 영역 내 불지옥',
      icon: 'Flame',
      focus: 'damage',
      bonuses: {
        damage: 2.5,
        special: {
          type: 'dot',
          value: 15,
          duration: 3,
          description: '3초간 틱당 15 추가 피해',
        },
      },
      ultimateName: '용암 코어',
      ultimateNameEn: 'Lava Core',
      ultimateEffect: '중심에 용암 분출! 들어오는 적 즉시 소각',
      ultimateBonuses: {
        damage: 5.0,
        special: {
          type: 'dot',
          value: 50,
          duration: 5,
          description: '5초간 틱당 50 피해 + 입장 시 버스트',
        },
      },
    },
  },

  shard: {
    A: {
      id: 'A',
      name: '데이터 클러스터',
      nameEn: 'Data Cluster',
      description: '샤드가 군집을 이뤄 퍼져나간다!',
      icon: 'Hexagon',
      focus: 'multi',
      bonuses: {
        amount: 4,
        area: 0.9,
      },
      ultimateName: '빅뱅 데이터',
      ultimateNameEn: 'Big Bang Data',
      ultimateEffect: '데이터 폭발! 전방위로 샤드 방출',
      ultimateBonuses: {
        amount: 8,
        special: {
          type: 'split',
          value: 2,
          description: '각 샤드가 2개로 분열',
        },
      },
    },
    B: {
      id: 'B',
      name: '코어 샤드',
      nameEn: 'Core Shard',
      description: '핵심 데이터 조각! 치명적인 관통',
      icon: 'Diamond',
      focus: 'power',
      bonuses: {
        damage: 2.0,
        pierce: 5,
      },
      ultimateName: '싱귤러리티 샤드',
      ultimateNameEn: 'Singularity Shard',
      ultimateEffect: '블랙홀급 관통력! 모든 것을 뚫는다',
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
  // NETWORK CATEGORY
  // ============================================

  bridge: {
    A: {
      id: 'A',
      name: '메시 네트워크',
      nameEn: 'Mesh Network',
      description: '더 많은 적을 연결! 연쇄 데미지 극대화',
      icon: 'Network',
      focus: 'chain',
      bonuses: {
        amount: 3,
        area: 1.2,
      },
      ultimateName: '글로벌 메시',
      ultimateNameEn: 'Global Mesh',
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
      name: '다이렉트 커넥션',
      nameEn: 'Direct Connection',
      description: '1:1 초고속 연결! 강력한 집중 피해',
      icon: 'Link',
      focus: 'power',
      bonuses: {
        damage: 2.5,
        special: {
          type: 'stun',
          value: 50,
          duration: 1,
          description: '연결 시 50% 확률로 1초 스턴',
        },
      },
      ultimateName: '신경 링크',
      ultimateNameEn: 'Neural Link',
      ultimateEffect: '뇌에 직접 연결! 정신 지배',
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
      name: '멀티 핑',
      nameEn: 'Multi Ping',
      description: '동시에 여러 타겟 핑!',
      icon: 'Radio',
      focus: 'multi',
      bonuses: {
        amount: 3,
        cooldown: 0.7,
      },
      ultimateName: '브로드캐스트',
      ultimateNameEn: 'Broadcast',
      ultimateEffect: '전체 브로드캐스트! 모든 적에게 핑',
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
      name: '레이저 핑',
      nameEn: 'Laser Ping',
      description: '초고속 집중 핑! 순간 폭딜',
      icon: 'Zap',
      focus: 'power',
      bonuses: {
        damage: 2.2,
        speed: 2.0,
      },
      ultimateName: '레일건 핑',
      ultimateNameEn: 'Railgun Ping',
      ultimateEffect: '전자기 가속! 화면 관통',
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
  // SECURITY CATEGORY
  // ============================================

  garlic: {
    A: {
      id: 'A',
      name: '확장 디버거',
      nameEn: 'Extended Debugger',
      description: '오라 범위 대폭 확대!',
      icon: 'Circle',
      focus: 'area',
      bonuses: {
        area: 1.8,
        duration: 1.2,
      },
      ultimateName: '글로벌 디버거',
      ultimateNameEn: 'Global Debugger',
      ultimateEffect: '화면 전체 오라!',
      ultimateBonuses: {
        area: 3.0,
        special: {
          type: 'slow',
          value: 40,
          description: '오라 내 적 40% 슬로우',
        },
      },
    },
    B: {
      id: 'B',
      name: '공격 디버거',
      nameEn: 'Offensive Debugger',
      description: '오라 데미지 강화 + 처치 폭발!',
      icon: 'Bomb',
      focus: 'damage',
      bonuses: {
        damage: 2.0,
        special: {
          type: 'aoe',
          value: 50,
          description: '오라 내 처치 시 50px 폭발',
        },
      },
      ultimateName: '버그 헌터',
      ultimateNameEn: 'Bug Hunter',
      ultimateEffect: '버그 발견 즉시 폭파!',
      ultimateBonuses: {
        damage: 3.5,
        special: {
          type: 'aoe',
          value: 120,
          description: '처치 시 120px 핵폭발',
        },
      },
    },
  },

  // ============================================
  // AI CATEGORY
  // ============================================

  lightning: {
    A: {
      id: 'A',
      name: '체인 라이트닝',
      nameEn: 'Chain Lightning',
      description: '번개가 적에서 적으로 연쇄!',
      icon: 'Zap',
      focus: 'chain',
      bonuses: {
        amount: 3,
        damage: 0.9,
      },
      ultimateName: '천둥 폭풍',
      ultimateNameEn: 'Thunder Storm',
      ultimateEffect: '하늘에서 무수한 번개가 내리친다!',
      ultimateBonuses: {
        amount: 8,
        special: {
          type: 'stun',
          value: 30,
          duration: 0.5,
          description: '30% 확률로 0.5초 스턴',
        },
      },
    },
    B: {
      id: 'B',
      name: '플라즈마 볼트',
      nameEn: 'Plasma Bolt',
      description: '집중된 플라즈마! 단일 대상 초고데미지',
      icon: 'Circle',
      focus: 'power',
      bonuses: {
        damage: 2.5,
        cooldown: 0.7,
      },
      ultimateName: '토르의 망치',
      ultimateNameEn: "Thor's Hammer",
      ultimateEffect: '신의 일격! 하나를 완전히 소멸',
      ultimateBonuses: {
        damage: 6.0,
        special: {
          type: 'execute',
          value: 25,
          description: '체력 40% 이하 적 25% 즉사',
        },
      },
    },
  },

  beam: {
    A: {
      id: 'A',
      name: '멀티 트레이스',
      nameEn: 'Multi Trace',
      description: '여러 스택을 동시에 추적!',
      icon: 'Layers',
      focus: 'multi',
      bonuses: {
        amount: 2,
        area: 0.8,
      },
      ultimateName: '풀 스택 트레이스',
      ultimateNameEn: 'Full Stack Trace',
      ultimateEffect: '모든 스택 동시 추적! 360도 빔',
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
      name: '딥 트레이스',
      nameEn: 'Deep Trace',
      description: '깊은 추적! 강력한 단일 빔',
      icon: 'ArrowDown',
      focus: 'power',
      bonuses: {
        damage: 2.2,
        duration: 1.5,
      },
      ultimateName: '커널 트레이스',
      ultimateNameEn: 'Kernel Trace',
      ultimateEffect: '커널 레벨 추적! 모든 것을 관통',
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
      name: '다중 루프',
      nameEn: 'Multi Loop',
      description: '여러 레이저가 동시에 회전!',
      icon: 'RotateCw',
      focus: 'multi',
      bonuses: {
        amount: 2,
        speed: 1.3,
      },
      ultimateName: '무한 루프',
      ultimateNameEn: 'Infinite Loop',
      ultimateEffect: '멈추지 않는 회전! 영구 레이저',
      ultimateBonuses: {
        amount: 4,
        special: {
          type: 'buff',
          value: 100,
          description: '레이저 지속시간 무한',
        },
      },
    },
    B: {
      id: 'B',
      name: '데스 레이',
      nameEn: 'Death Ray',
      description: '강력한 단일 레이저!',
      icon: 'Crosshair',
      focus: 'power',
      bonuses: {
        damage: 2.5,
        area: 1.5,
      },
      ultimateName: '오비탈 스트라이크',
      ultimateNameEn: 'Orbital Strike',
      ultimateEffect: '궤도에서 발사! 화면 관통 레이저',
      ultimateBonuses: {
        damage: 5.0,
        area: 2.5,
        special: {
          type: 'aoe',
          value: 200,
          description: '레이저 경로 200px 범위 데미지',
        },
      },
    },
  },

  // ============================================
  // SYSTEM CATEGORY (Passive buffs)
  // ============================================

  focus: {
    A: {
      id: 'A',
      name: '존 포커스',
      nameEn: 'Zone Focus',
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
      ultimateName: '플로우 스테이트',
      ultimateNameEn: 'Flow State',
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
      name: '버스트 포커스',
      nameEn: 'Burst Focus',
      description: '짧지만 강력한 집중!',
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
      ultimateName: '퓨리',
      ultimateNameEn: 'Fury',
      ultimateEffect: '분노 폭발! 5초간 무적 + 3배 데미지',
      ultimateBonuses: {
        special: {
          type: 'buff',
          value: 300,
          duration: 5,
          description: '5초간 무적 + 데미지 300%',
        },
      },
    },
  },

  overclock: {
    A: {
      id: 'A',
      name: '터보 모드',
      nameEn: 'Turbo Mode',
      description: '지속적인 고속 모드!',
      icon: 'FastForward',
      focus: 'sustained',
      bonuses: {
        speed: 1.5,
        duration: 999,
      },
      ultimateName: '워프 드라이브',
      ultimateNameEn: 'Warp Drive',
      ultimateEffect: '초광속! 이동속도 3배',
      ultimateBonuses: {
        speed: 3.0,
        special: {
          type: 'buff',
          value: 50,
          description: '이동 시 50% 회피율',
        },
      },
    },
    B: {
      id: 'B',
      name: '나이트로',
      nameEn: 'Nitro',
      description: '짧지만 폭발적인 가속!',
      icon: 'Flame',
      focus: 'burst',
      bonuses: {
        speed: 2.5,
        duration: 3,
        special: {
          type: 'aoe',
          value: 30,
          description: '대시 경로에 30 데미지',
        },
      },
      ultimateName: '소닉 붐',
      ultimateNameEn: 'Sonic Boom',
      ultimateEffect: '음속 돌파! 충격파 발생',
      ultimateBonuses: {
        speed: 5.0,
        special: {
          type: 'aoe',
          value: 100,
          description: '대시 종료 시 200px 충격파 100 데미지',
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
