/**
 * Turrets Configuration - Agent & Skill AI 터렛
 * CODE SURVIVOR v3.0 - 캐릭터 무기 패턴 차용 시스템
 *
 * 핵심 변경:
 * - 자체 ability 삭제 → weaponType으로 캐릭터 무기 패턴 차용
 * - 발사 패턴만 차용, 스탯(데미지, 쿨다운)은 터렛 독립
 * - 블랙마켓에서 터렛 레벨 업그레이드
 */

import {
  TurretConfig,
  TurretRarity,
  RARITY_PRICES,
  RARITY_MAX_LEVELS,
} from '../types';

// ============================================
// AGENT 터렛 (원거리 특화)
// weaponType: 원거리 투사체 무기 차용
// ============================================

/**
 * Sentry Bot - Common Agent
 * bow 패턴 차용: 빠른 직선 화살
 */
const SENTRY_BOT: TurretConfig = {
  id: 'sentry_bot',
  name: 'Sentry Bot',
  nameKo: '센트리 봇',
  description: 'Fires quick arrows at nearby enemies.',
  descriptionKo: '근처 적에게 빠른 화살을 발사합니다.',
  type: 'agent',
  rarity: 'common',

  // 차용할 무기
  weaponType: 'bow',

  // 터렛 독립 스탯
  hp: 100,
  range: 300,
  baseDamage: 18,
  damagePerLevel: 6,
  cooldown: 1200,

  // 비주얼
  color: '#9ca3af',
  glowColor: '#6b7280',

  // 블랙마켓
  price: RARITY_PRICES.common,
  upgradePrice: 150,
  maxLevel: RARITY_MAX_LEVELS.common,
};

/**
 * Sniper Core - Rare Agent
 * bow 패턴 차용 (고속, 관통): 강력한 저격
 */
const SNIPER_CORE: TurretConfig = {
  id: 'sniper_core',
  name: 'Sniper Core',
  nameKo: '스나이퍼 코어',
  description: 'High-powered sniper that pierces through enemies.',
  descriptionKo: '적을 관통하는 고위력 저격.',
  type: 'agent',
  rarity: 'rare',

  weaponType: 'bow',

  hp: 80,
  range: 550,
  baseDamage: 45,
  damagePerLevel: 15,
  cooldown: 2500,
  pierce: 3, // 관통 오버라이드
  projectileSpeed: 800, // 더 빠른 투사체

  color: '#3b82f6',
  glowColor: '#2563eb',

  price: RARITY_PRICES.rare,
  upgradePrice: 400,
  maxLevel: RARITY_MAX_LEVELS.rare,
};

/**
 * Tracker Drone - Rare Agent
 * wand 패턴 차용: 유도 미사일
 */
const TRACKER_DRONE: TurretConfig = {
  id: 'tracker_drone',
  name: 'Tracker Drone',
  nameKo: '트래커 드론',
  description: 'Fires homing missiles that chase enemies.',
  descriptionKo: '적을 추적하는 유도 미사일을 발사합니다.',
  type: 'agent',
  rarity: 'rare',

  weaponType: 'wand',

  hp: 90,
  range: 350,
  baseDamage: 25,
  damagePerLevel: 8,
  cooldown: 1500,

  color: '#8b5cf6',
  glowColor: '#7c3aed',

  price: RARITY_PRICES.rare,
  upgradePrice: 450,
  maxLevel: RARITY_MAX_LEVELS.rare,
};

/**
 * Laser Drone - Epic Agent
 * beam 패턴 차용: 지속 레이저 빔
 */
const LASER_DRONE: TurretConfig = {
  id: 'laser_drone',
  name: 'Laser Drone',
  nameKo: '레이저 드론',
  description: 'Projects a continuous laser beam.',
  descriptionKo: '지속 레이저 빔을 투사합니다.',
  type: 'agent',
  rarity: 'epic',

  weaponType: 'beam',

  hp: 120,
  range: 400,
  baseDamage: 8, // 틱당 데미지
  damagePerLevel: 3,
  cooldown: 100, // 틱 간격

  color: '#a855f7',
  glowColor: '#9333ea',

  price: RARITY_PRICES.epic,
  upgradePrice: 1200,
  maxLevel: RARITY_MAX_LEVELS.epic,
};

/**
 * Fork Launcher - Epic Agent
 * fork 패턴 차용: 분기 투사체
 */
const FORK_LAUNCHER: TurretConfig = {
  id: 'fork_launcher',
  name: 'Fork Launcher',
  nameKo: '포크 런처',
  description: 'Fires projectiles that split into multiple directions.',
  descriptionKo: '여러 방향으로 분기하는 투사체를 발사합니다.',
  type: 'agent',
  rarity: 'epic',

  weaponType: 'fork',

  hp: 100,
  range: 350,
  baseDamage: 30,
  damagePerLevel: 10,
  cooldown: 1800,

  color: '#06b6d4',
  glowColor: '#0891b2',

  price: RARITY_PRICES.epic,
  upgradePrice: 1000,
  maxLevel: RARITY_MAX_LEVELS.epic,
};

/**
 * Artillery Platform - Legendary Agent
 * airdrop 패턴 차용: 공중 폭격
 */
const ARTILLERY_PLATFORM: TurretConfig = {
  id: 'artillery_platform',
  name: 'Artillery Platform',
  nameKo: '아틸러리 플랫폼',
  description: 'Calls down aerial bombardment on enemies.',
  descriptionKo: '적에게 공중 폭격을 요청합니다.',
  type: 'agent',
  rarity: 'legendary',

  weaponType: 'airdrop',

  hp: 200,
  range: 500,
  baseDamage: 60,
  damagePerLevel: 20,
  cooldown: 3000,
  projectileCount: 3, // 3발 투하

  color: '#f59e0b',
  glowColor: '#d97706',

  price: RARITY_PRICES.legendary,
  upgradePrice: 3000,
  maxLevel: RARITY_MAX_LEVELS.legendary,
};

/**
 * Quantum Turret - Mythic Agent
 * shard 패턴 차용: 분열 투사체
 */
const QUANTUM_TURRET: TurretConfig = {
  id: 'quantum_turret',
  name: 'Quantum Turret',
  nameKo: '퀀텀 터렛',
  description: 'Fires quantum shards that split on impact.',
  descriptionKo: '충돌 시 분열하는 퀀텀 샤드를 발사합니다.',
  type: 'agent',
  rarity: 'mythic',

  weaponType: 'shard',

  hp: 300,
  range: 450,
  baseDamage: 50,
  damagePerLevel: 18,
  cooldown: 1400,
  pierce: 5,

  color: '#ef4444',
  glowColor: '#dc2626',

  price: RARITY_PRICES.mythic,
  upgradePrice: 8000,
  maxLevel: RARITY_MAX_LEVELS.mythic,
};

// ============================================
// SKILL 터렛 (근접 AOE 특화)
// weaponType: 근접/범위 무기 차용
// ============================================

/**
 * Shock Field - Common Skill
 * garlic 패턴 차용: 주변 AOE 오라
 */
const SHOCK_FIELD: TurretConfig = {
  id: 'shock_field',
  name: 'Shock Field',
  nameKo: '쇼크 필드',
  description: 'Emits damaging aura around the turret.',
  descriptionKo: '터렛 주변에 피해를 주는 오라를 방출합니다.',
  type: 'skill',
  rarity: 'common',

  weaponType: 'garlic',

  hp: 120,
  range: 100,
  baseDamage: 15,
  damagePerLevel: 5,
  cooldown: 1000, // 틱 간격

  color: '#9ca3af',
  glowColor: '#6b7280',

  price: RARITY_PRICES.common,
  upgradePrice: 150,
  maxLevel: RARITY_MAX_LEVELS.common,
};

/**
 * Saw Blade - Rare Skill
 * knife 패턴 차용: 회전 칼날
 */
const SAW_BLADE: TurretConfig = {
  id: 'saw_blade',
  name: 'Saw Blade',
  nameKo: '쏘 블레이드',
  description: 'Spinning blades that damage nearby enemies.',
  descriptionKo: '근처 적에게 피해를 주는 회전 톱날.',
  type: 'skill',
  rarity: 'rare',

  weaponType: 'knife',

  hp: 100,
  range: 120,
  baseDamage: 20,
  damagePerLevel: 7,
  cooldown: 800,
  projectileCount: 3, // 3개 칼날

  color: '#3b82f6',
  glowColor: '#2563eb',

  price: RARITY_PRICES.rare,
  upgradePrice: 400,
  maxLevel: RARITY_MAX_LEVELS.rare,
};

/**
 * Whip Tower - Rare Skill
 * whip 패턴 차용: 넓은 채찍 공격
 */
const WHIP_TOWER: TurretConfig = {
  id: 'whip_tower',
  name: 'Whip Tower',
  nameKo: '휩 타워',
  description: 'Lashes out with wide whip attacks.',
  descriptionKo: '넓은 범위의 채찍 공격을 합니다.',
  type: 'skill',
  rarity: 'rare',

  weaponType: 'whip',

  hp: 110,
  range: 150,
  baseDamage: 25,
  damagePerLevel: 8,
  cooldown: 1200,

  color: '#10b981',
  glowColor: '#059669',

  price: RARITY_PRICES.rare,
  upgradePrice: 380,
  maxLevel: RARITY_MAX_LEVELS.rare,
};

/**
 * Gravity Well - Epic Skill
 * pool 패턴 차용: 지역 효과 (끌어당김)
 */
const GRAVITY_WELL: TurretConfig = {
  id: 'gravity_well',
  name: 'Gravity Well',
  nameKo: '그래비티 웰',
  description: 'Creates a zone that pulls and damages enemies.',
  descriptionKo: '적을 끌어당기며 피해를 주는 지역을 생성합니다.',
  type: 'skill',
  rarity: 'epic',

  weaponType: 'pool',

  hp: 150,
  range: 180,
  baseDamage: 12,
  damagePerLevel: 4,
  cooldown: 500, // 틱 간격

  color: '#a855f7',
  glowColor: '#9333ea',

  price: RARITY_PRICES.epic,
  upgradePrice: 1100,
  maxLevel: RARITY_MAX_LEVELS.epic,
};

/**
 * Storm Pillar - Epic Skill
 * lightning 패턴 차용: 연쇄 번개
 */
const STORM_PILLAR: TurretConfig = {
  id: 'storm_pillar',
  name: 'Storm Pillar',
  nameKo: '스톰 필라',
  description: 'Strikes enemies with chain lightning.',
  descriptionKo: '적에게 연쇄 번개를 내리칩니다.',
  type: 'skill',
  rarity: 'epic',

  weaponType: 'lightning',

  hp: 130,
  range: 200,
  baseDamage: 35,
  damagePerLevel: 12,
  cooldown: 2000,

  color: '#fbbf24',
  glowColor: '#f59e0b',

  price: RARITY_PRICES.epic,
  upgradePrice: 1300,
  maxLevel: RARITY_MAX_LEVELS.epic,
};

/**
 * Inferno Core - Legendary Skill
 * garlic 패턴 차용 (강화): 화염 오라
 */
const INFERNO_CORE: TurretConfig = {
  id: 'inferno_core',
  name: 'Inferno Core',
  nameKo: '인페르노 코어',
  description: 'Blazing aura that burns all nearby enemies.',
  descriptionKo: '근처의 모든 적을 불태우는 화염 오라.',
  type: 'skill',
  rarity: 'legendary',

  weaponType: 'garlic',

  hp: 180,
  range: 140,
  baseDamage: 28,
  damagePerLevel: 10,
  cooldown: 800,

  color: '#f59e0b',
  glowColor: '#d97706',

  price: RARITY_PRICES.legendary,
  upgradePrice: 2800,
  maxLevel: RARITY_MAX_LEVELS.legendary,
};

/**
 * Void Engine - Mythic Skill
 * laser 패턴 차용: 회전 레이저
 */
const VOID_ENGINE: TurretConfig = {
  id: 'void_engine',
  name: 'Void Engine',
  nameKo: '보이드 엔진',
  description: 'Rotating void lasers that cut through everything.',
  descriptionKo: '모든 것을 베어내는 회전 공허 레이저.',
  type: 'skill',
  rarity: 'mythic',

  weaponType: 'laser',

  hp: 250,
  range: 200,
  baseDamage: 40,
  damagePerLevel: 15,
  cooldown: 600,

  color: '#ef4444',
  glowColor: '#dc2626',

  price: RARITY_PRICES.mythic,
  upgradePrice: 7500,
  maxLevel: RARITY_MAX_LEVELS.mythic,
};

// ============================================
// 터렛 목록 및 유틸리티
// ============================================

/** 모든 Agent 터렛 */
export const AGENT_TURRETS: TurretConfig[] = [
  SENTRY_BOT,
  SNIPER_CORE,
  TRACKER_DRONE,
  LASER_DRONE,
  FORK_LAUNCHER,
  ARTILLERY_PLATFORM,
  QUANTUM_TURRET,
];

/** 모든 Skill 터렛 */
export const SKILL_TURRETS: TurretConfig[] = [
  SHOCK_FIELD,
  SAW_BLADE,
  WHIP_TOWER,
  GRAVITY_WELL,
  STORM_PILLAR,
  INFERNO_CORE,
  VOID_ENGINE,
];

/** 모든 터렛 */
export const ALL_TURRETS: TurretConfig[] = [
  ...AGENT_TURRETS,
  ...SKILL_TURRETS,
];

/** ID로 터렛 찾기 */
export function getTurretById(id: string): TurretConfig | undefined {
  return ALL_TURRETS.find(t => t.id === id);
}

/** 타입으로 터렛 필터 */
export function getTurretsByType(type: 'agent' | 'skill'): TurretConfig[] {
  return ALL_TURRETS.filter(t => t.type === type);
}

/** 등급으로 터렛 필터 */
export function getTurretsByRarity(rarity: TurretRarity): TurretConfig[] {
  return ALL_TURRETS.filter(t => t.rarity === rarity);
}

/** 기본 터렛 (무료 지급) */
export const DEFAULT_AGENT_ID = 'sentry_bot';
export const DEFAULT_SKILL_ID = 'shock_field';

/** 등급별 정렬 순서 */
export const RARITY_ORDER: TurretRarity[] = [
  'common',
  'rare',
  'epic',
  'legendary',
  'mythic',
];

/** 정렬된 터렛 목록 (등급순) */
export function getSortedTurrets(turrets: TurretConfig[]): TurretConfig[] {
  return [...turrets].sort((a, b) => {
    const aIndex = RARITY_ORDER.indexOf(a.rarity);
    const bIndex = RARITY_ORDER.indexOf(b.rarity);
    return aIndex - bIndex;
  });
}
