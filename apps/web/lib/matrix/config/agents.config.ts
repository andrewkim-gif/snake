/**
 * Agents Configuration - 통합 AI 에이전트
 * CODE SURVIVOR v8.0 - 단일 에이전트 시스템
 *
 * 변경 사항:
 * - 기존 agent/skill 구분 제거 → 모두 Agent로 통합
 * - 14개 에이전트 단일 리스트
 * - 게임에서 1개만 배치 가능
 */

import {
  AgentConfig,
  AgentRarity,
  RARITY_PRICES,
  RARITY_MAX_LEVELS,
} from '../types';

// ============================================
// RANGED AGENTS (원거리 특화)
// ============================================

const SENTRY_BOT: AgentConfig = {
  id: 'sentry_bot',
  name: 'Sentry Bot',
  nameKo: '센트리 봇',
  description: 'Fires quick arrows at nearby enemies.',
  descriptionKo: '근처 적에게 빠른 화살을 발사합니다.',
  rarity: 'common',
  weaponType: 'bow',
  hp: 100,
  range: 300,
  baseDamage: 18,
  damagePerLevel: 6,
  cooldown: 1200,
  color: '#9ca3af',
  glowColor: '#6b7280',
  price: RARITY_PRICES.common,
  upgradePrice: 150,
  maxLevel: RARITY_MAX_LEVELS.common,
};

const SNIPER_CORE: AgentConfig = {
  id: 'sniper_core',
  name: 'Sniper Core',
  nameKo: '스나이퍼 코어',
  description: 'High-powered sniper that pierces through enemies.',
  descriptionKo: '적을 관통하는 고위력 저격.',
  rarity: 'rare',
  weaponType: 'bow',
  hp: 80,
  range: 550,
  baseDamage: 45,
  damagePerLevel: 15,
  cooldown: 2500,
  pierce: 3,
  projectileSpeed: 800,
  color: '#3b82f6',
  glowColor: '#2563eb',
  price: RARITY_PRICES.rare,
  upgradePrice: 400,
  maxLevel: RARITY_MAX_LEVELS.rare,
};

const TRACKER_DRONE: AgentConfig = {
  id: 'tracker_drone',
  name: 'Tracker Drone',
  nameKo: '트래커 드론',
  description: 'Fires homing missiles that chase enemies.',
  descriptionKo: '적을 추적하는 유도 미사일을 발사합니다.',
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

const LASER_DRONE: AgentConfig = {
  id: 'laser_drone',
  name: 'Laser Drone',
  nameKo: '레이저 드론',
  description: 'Projects a continuous laser beam.',
  descriptionKo: '지속 레이저 빔을 투사합니다.',
  rarity: 'epic',
  weaponType: 'beam',
  hp: 120,
  range: 400,
  baseDamage: 8,
  damagePerLevel: 3,
  cooldown: 100,
  color: '#a855f7',
  glowColor: '#9333ea',
  price: RARITY_PRICES.epic,
  upgradePrice: 1200,
  maxLevel: RARITY_MAX_LEVELS.epic,
};

const FORK_LAUNCHER: AgentConfig = {
  id: 'fork_launcher',
  name: 'Fork Launcher',
  nameKo: '포크 런처',
  description: 'Fires projectiles that split into multiple directions.',
  descriptionKo: '여러 방향으로 분기하는 투사체를 발사합니다.',
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

const ARTILLERY_PLATFORM: AgentConfig = {
  id: 'artillery_platform',
  name: 'Artillery Platform',
  nameKo: '아틸러리 플랫폼',
  description: 'Calls down aerial bombardment on enemies.',
  descriptionKo: '적에게 공중 폭격을 요청합니다.',
  rarity: 'legendary',
  weaponType: 'airdrop',
  hp: 200,
  range: 500,
  baseDamage: 60,
  damagePerLevel: 20,
  cooldown: 3000,
  projectileCount: 3,
  color: '#f59e0b',
  glowColor: '#d97706',
  price: RARITY_PRICES.legendary,
  upgradePrice: 3000,
  maxLevel: RARITY_MAX_LEVELS.legendary,
};

const QUANTUM_TURRET: AgentConfig = {
  id: 'quantum_turret',
  name: 'Quantum Turret',
  nameKo: '퀀텀 터렛',
  description: 'Fires quantum shards that split on impact.',
  descriptionKo: '충돌 시 분열하는 퀀텀 샤드를 발사합니다.',
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
// MELEE/AOE AGENTS (근접 AOE 특화)
// ============================================

const SHOCK_FIELD: AgentConfig = {
  id: 'shock_field',
  name: 'Shock Field',
  nameKo: '쇼크 필드',
  description: 'Emits damaging aura around the agent.',
  descriptionKo: '에이전트 주변에 피해를 주는 오라를 방출합니다.',
  rarity: 'common',
  weaponType: 'garlic',
  hp: 120,
  range: 100,
  baseDamage: 15,
  damagePerLevel: 5,
  cooldown: 1000,
  color: '#9ca3af',
  glowColor: '#6b7280',
  price: RARITY_PRICES.common,
  upgradePrice: 150,
  maxLevel: RARITY_MAX_LEVELS.common,
};

const SAW_BLADE: AgentConfig = {
  id: 'saw_blade',
  name: 'Saw Blade',
  nameKo: '쏘 블레이드',
  description: 'Spinning blades that damage nearby enemies.',
  descriptionKo: '근처 적에게 피해를 주는 회전 톱날.',
  rarity: 'rare',
  weaponType: 'knife',
  hp: 100,
  range: 120,
  baseDamage: 20,
  damagePerLevel: 7,
  cooldown: 800,
  projectileCount: 3,
  color: '#3b82f6',
  glowColor: '#2563eb',
  price: RARITY_PRICES.rare,
  upgradePrice: 400,
  maxLevel: RARITY_MAX_LEVELS.rare,
};

const WHIP_TOWER: AgentConfig = {
  id: 'whip_tower',
  name: 'Whip Tower',
  nameKo: '휩 타워',
  description: 'Lashes out with wide whip attacks.',
  descriptionKo: '넓은 범위의 채찍 공격을 합니다.',
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

const GRAVITY_WELL: AgentConfig = {
  id: 'gravity_well',
  name: 'Gravity Well',
  nameKo: '그래비티 웰',
  description: 'Creates a zone that pulls and damages enemies.',
  descriptionKo: '적을 끌어당기며 피해를 주는 지역을 생성합니다.',
  rarity: 'epic',
  weaponType: 'pool',
  hp: 150,
  range: 180,
  baseDamage: 12,
  damagePerLevel: 4,
  cooldown: 500,
  color: '#a855f7',
  glowColor: '#9333ea',
  price: RARITY_PRICES.epic,
  upgradePrice: 1100,
  maxLevel: RARITY_MAX_LEVELS.epic,
};

const STORM_PILLAR: AgentConfig = {
  id: 'storm_pillar',
  name: 'Storm Pillar',
  nameKo: '스톰 필라',
  description: 'Strikes enemies with chain lightning.',
  descriptionKo: '적에게 연쇄 번개를 내리칩니다.',
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

const INFERNO_CORE: AgentConfig = {
  id: 'inferno_core',
  name: 'Inferno Core',
  nameKo: '인페르노 코어',
  description: 'Blazing aura that burns all nearby enemies.',
  descriptionKo: '근처의 모든 적을 불태우는 화염 오라.',
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

const VOID_ENGINE: AgentConfig = {
  id: 'void_engine',
  name: 'Void Engine',
  nameKo: '보이드 엔진',
  description: 'Rotating void lasers that cut through everything.',
  descriptionKo: '모든 것을 베어내는 회전 공허 레이저.',
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
// 에이전트 목록 및 유틸리티
// ============================================

/** 모든 에이전트 (14개 - 등급순 정렬) */
export const ALL_AGENTS: AgentConfig[] = [
  // Common
  SENTRY_BOT,
  SHOCK_FIELD,
  // Rare
  SNIPER_CORE,
  TRACKER_DRONE,
  SAW_BLADE,
  WHIP_TOWER,
  // Epic
  LASER_DRONE,
  FORK_LAUNCHER,
  GRAVITY_WELL,
  STORM_PILLAR,
  // Legendary
  ARTILLERY_PLATFORM,
  INFERNO_CORE,
  // Mythic
  QUANTUM_TURRET,
  VOID_ENGINE,
];

/** ID로 에이전트 찾기 */
export function getAgentById(id: string): AgentConfig | undefined {
  return ALL_AGENTS.find(a => a.id === id);
}

/** 등급으로 에이전트 필터 */
export function getAgentsByRarity(rarity: AgentRarity): AgentConfig[] {
  return ALL_AGENTS.filter(a => a.rarity === rarity);
}

/** 기본 에이전트 (무료 지급) */
export const DEFAULT_AGENT_ID = 'sentry_bot';

/** 등급별 정렬 순서 */
export const RARITY_ORDER: AgentRarity[] = [
  'common',
  'rare',
  'epic',
  'legendary',
  'mythic',
];

/** 정렬된 에이전트 목록 (등급순) */
export function getSortedAgents(agents: AgentConfig[]): AgentConfig[] {
  return [...agents].sort((a, b) => {
    const aIndex = RARITY_ORDER.indexOf(a.rarity);
    const bIndex = RARITY_ORDER.indexOf(b.rarity);
    return aIndex - bIndex;
  });
}

// ============================================
// 하위 호환성 - 기존 turret API 지원
// ============================================

// 기존 코드 호환용 alias
export const getTurretById = getAgentById;
export const ALL_TURRETS = ALL_AGENTS;
