/**
 * Agent Survivor v10 — Upgrade System Constants
 * Tomes, Abilities, Synergies, XP Table, Combat Config
 */

import type { TomeType, AbilityType, SynergyDef, MapObjectType, MapObjectConfig } from '../types/game';

// ─── XP Table (Level → Required XP) ───

/** 레벨업에 필요한 XP (인덱스 = 현재 레벨, 값 = 다음 레벨까지 필요 XP) */
export const XP_TABLE: readonly number[] = [
  0,    // Lv0→1: 시작
  20,   // Lv1→2
  30,   // Lv2→3
  45,   // Lv3→4
  65,   // Lv4→5
  90,   // Lv5→6
  120,  // Lv6→7
  155,  // Lv7→8
  195,  // Lv8→9
  240,  // Lv9→10
  290,  // Lv10→11
  345,  // Lv11→12
  999999, // Lv12 (최대 레벨)
] as const;

export const MAX_LEVEL = 12;

// ─── XP Sources ───

export const XP_SOURCE = {
  NATURAL_ORB: 1,       // 자연 오브 수집
  DEATH_ORB: 4,         // 사망 오브 수집
  POWER_UP_ORB: 5,      // 파워업 오브 수집
  AURA_KILL_BASE: 10,   // 오라 전투 킬 기본
  AURA_KILL_PER_LEVEL: 3, // + 적 레벨 × 3
  DASH_KILL_BASE: 15,   // 대시 킬 기본
  DASH_KILL_PER_LEVEL: 3, // + 적 레벨 × 3
} as const;

export const KILL_STREAK_MULTIPLIER = {
  3: 1.5,   // 3연속 킬
  5: 2.0,   // 5연속 킬
  10: 3.0,  // 10연속 킬
} as const;

// ─── Tome Definitions ───

export interface TomeDef {
  type: TomeType;
  name: string;
  tier: 'S' | 'A' | 'B';
  effectPerStack: number;  // 스택당 효과 (%)
  maxStacks: number;
  description: string;
  statKey: string;  // 적용되는 스탯 키
}

export const TOME_DEFS: Record<TomeType, TomeDef> = {
  xp: {
    type: 'xp',
    name: 'XP Tome',
    tier: 'S',
    effectPerStack: 0.20,  // +20% XP per stack
    maxStacks: 10,
    description: 'XP 획득 +20%',
    statKey: 'xpMultiplier',
  },
  speed: {
    type: 'speed',
    name: 'Speed Tome',
    tier: 'S',
    effectPerStack: 0.10,  // +10% speed per stack
    maxStacks: 5,
    description: '이동속도 +10%',
    statKey: 'speedMultiplier',
  },
  damage: {
    type: 'damage',
    name: 'Damage Tome',
    tier: 'S',
    effectPerStack: 0.15,  // +15% DPS per stack
    maxStacks: 10,
    description: '오라 DPS +15%',
    statKey: 'dpsMultiplier',
  },
  armor: {
    type: 'armor',
    name: 'Armor Tome',
    tier: 'A',
    effectPerStack: 0.10,  // -10% damage taken per stack
    maxStacks: 8,
    description: '받는 데미지 -10%',
    statKey: 'damageReduction',
  },
  magnet: {
    type: 'magnet',
    name: 'Magnet Tome',
    tier: 'A',
    effectPerStack: 0.25,  // +25% collect radius per stack
    maxStacks: 6,
    description: '오브 수집 반경 +25%',
    statKey: 'collectRadiusMultiplier',
  },
  luck: {
    type: 'luck',
    name: 'Luck Tome',
    tier: 'A',
    effectPerStack: 0.15,  // +15% rare upgrade chance per stack
    maxStacks: 6,
    description: '레어 업그레이드 확률 +15%',
    statKey: 'luckMultiplier',
  },
  regen: {
    type: 'regen',
    name: 'Regen Tome',
    tier: 'B',
    effectPerStack: 0.025, // +0.025 mass/tick (=0.5/s) per stack
    maxStacks: 5,
    description: '매초 mass +0.5 회복',
    statKey: 'regenPerTick',
  },
  cursed: {
    type: 'cursed',
    name: 'Cursed Tome',
    tier: 'S',
    effectPerStack: 0.25,  // +25% DPS, +20% damage taken per stack
    maxStacks: 5,
    description: 'DPS +25%, 받는 피해 +20%',
    statKey: 'cursedMultiplier',
  },
} as const;

// ─── Ability Definitions ───

export interface AbilityDef {
  type: AbilityType;
  name: string;
  baseDamage: number;       // 기본 피해량 (0 = 비전투)
  cooldownTicks: number;    // 쿨다운 (틱 단위)
  durationTicks: number;    // 지속 시간 (0 = 즉시)
  autoTrigger: string;      // 자동 발동 조건 설명
  description: string;
  upgradeBonus: {
    damageMultiplier: number;   // 강화당 피해 배율
    cooldownReduction: number;  // 강화당 쿨다운 감소율
  };
}

export const ABILITY_DEFS: Record<AbilityType, AbilityDef> = {
  venom_aura: {
    type: 'venom_aura',
    name: 'Venom Aura',
    baseDamage: 15,         // 15 mass/s DoT
    cooldownTicks: 0,       // 패시브
    durationTicks: 60,      // 독 3초
    autoTrigger: '항상 활성',
    description: '근접 적에게 독 DoT (3s)',
    upgradeBonus: { damageMultiplier: 1.3, cooldownReduction: 0 },
  },
  shield_burst: {
    type: 'shield_burst',
    name: 'Shield Burst',
    baseDamage: 0,
    cooldownTicks: 300,     // 15초
    durationTicks: 60,      // 3초 무적
    autoTrigger: '체력 30% 이하',
    description: '3초간 무적 + 주변 적 밀침',
    upgradeBonus: { damageMultiplier: 1, cooldownReduction: 0.20 },
  },
  lightning_strike: {
    type: 'lightning_strike',
    name: 'Lightning Strike',
    baseDamage: 50,
    cooldownTicks: 160,     // 8초
    durationTicks: 0,       // 즉시
    autoTrigger: '사거리 내 적 감지',
    description: '가장 가까운 적에게 순간 데미지',
    upgradeBonus: { damageMultiplier: 1.3, cooldownReduction: 0.20 },
  },
  speed_dash: {
    type: 'speed_dash',
    name: 'Speed Dash',
    baseDamage: 0,
    cooldownTicks: 240,     // 12초
    durationTicks: 40,      // 2초
    autoTrigger: '적 추격/도주 시',
    description: '2초간 3배 속도 + 충돌 면역',
    upgradeBonus: { damageMultiplier: 1, cooldownReduction: 0.20 },
  },
  mass_drain: {
    type: 'mass_drain',
    name: 'Mass Drain',
    baseDamage: 0,          // 비례 데미지 (mass의 10%)
    cooldownTicks: 200,     // 10초
    durationTicks: 0,       // 즉시
    autoTrigger: '히트박스 충돌 시',
    description: '터치한 적의 mass 10% 흡수',
    upgradeBonus: { damageMultiplier: 1.3, cooldownReduction: 0.20 },
  },
  gravity_well: {
    type: 'gravity_well',
    name: 'Gravity Well',
    baseDamage: 0,
    cooldownTicks: 400,     // 20초
    durationTicks: 60,      // 3초
    autoTrigger: '오브 밀집 지역',
    description: '3초간 주변 오브+적을 끌어당김',
    upgradeBonus: { damageMultiplier: 1, cooldownReduction: 0.20 },
  },
} as const;

// ─── Synergy Definitions ───

export const ALL_SYNERGIES: SynergyDef[] = [
  // 공개 시너지 (6종)
  {
    id: 'holy_trinity',
    name: 'Holy Trinity',
    requirements: { tomes: { xp: 3, luck: 2, cursed: 1 } },
    bonus: { description: '모든 XP +50% 추가', effects: { xpMultiplier: 1.5 } },
    hidden: false,
  },
  {
    id: 'glass_cannon',
    name: 'Glass Cannon',
    requirements: { tomes: { damage: 5, cursed: 3 } },
    bonus: { description: 'DPS ×2.0 (피해도 ×2.0)', effects: { dpsMultiplier: 2.0, damageTakenMultiplier: 2.0 } },
    hidden: false,
  },
  {
    id: 'iron_fortress',
    name: 'Iron Fortress',
    requirements: { tomes: { armor: 4, regen: 3 }, abilities: { shield_burst: 1 } },
    bonus: { description: '받는 피해 추가 -30%', effects: { damageReduction: 0.30 } },
    hidden: false,
  },
  {
    id: 'speedster',
    name: 'Speedster',
    requirements: { tomes: { speed: 4, magnet: 2 }, abilities: { speed_dash: 1 } },
    bonus: { description: '부스트 비용 -50%', effects: { boostCostReduction: 0.50 } },
    hidden: false,
  },
  {
    id: 'vampire',
    name: 'Vampire',
    requirements: { tomes: { regen: 2 }, abilities: { venom_aura: 1, mass_drain: 1 } },
    bonus: { description: '독 피해의 20%를 mass 회복', effects: { venomLifesteal: 0.20 } },
    hidden: false,
  },
  {
    id: 'storm',
    name: 'Storm',
    requirements: { tomes: { damage: 3 }, abilities: { lightning_strike: 3 } },
    bonus: { description: '번개 연쇄 (3 적까지)', effects: { lightningChain: 3 } },
    hidden: false,
  },
  // 히든 시너지 (4종)
  {
    id: 'berserker',
    name: '???',
    requirements: { tomes: { cursed: 5, damage: 3, speed: 2 } },
    bonus: { description: '대시 피해 ×3.0', effects: { dashDamageMultiplier: 3.0 } },
    hidden: true,
  },
  {
    id: 'pacifist',
    name: '???',
    requirements: { tomes: { xp: 5, magnet: 4, regen: 3 } },
    bonus: { description: 'XP 오브 가치 ×3.0', effects: { orbValueMultiplier: 3.0 } },
    hidden: true,
  },
  {
    id: 'elemental',
    name: '???',
    requirements: { abilities: { venom_aura: 2, lightning_strike: 2, gravity_well: 1 } },
    bonus: { description: '모든 Ability 쿨다운 -40%', effects: { abilityCooldownReduction: 0.40 } },
    hidden: true,
  },
  {
    id: 'immortal',
    name: '???',
    requirements: { tomes: { armor: 6, regen: 4 }, abilities: { shield_burst: 3 } },
    bonus: { description: '사망 시 1회 부활 (mass 50%)', effects: { reviveOnce: 1, reviveMassRatio: 0.50 } },
    hidden: true,
  },
];

// ─── Combat Config ───

export const COMBAT_CONFIG = {
  AURA_RADIUS: 60,                // 전투 오라 반경 (px)
  BASE_AURA_DPS_PER_TICK: 2.0,   // 기본 오라 DPS (mass/tick)
  DASH_DAMAGE_RATIO: 0.30,        // 대시 충돌 시 상대 mass의 30% 즉시 피해
  HITBOX_BASE_RADIUS: 16,         // 기본 히트박스 반경 (px)
  HITBOX_MAX_RADIUS: 22,          // 최대 히트박스 반경 (px)
  HIGH_LEVEL_THRESHOLD: 8,        // 고레벨 기준
  HIGH_LEVEL_DPS_BONUS: 0.20,     // 고레벨 DPS 보너스 (+20%)
  VENOM_DPS_PER_TICK: 0.75,       // 독 DoT (15 mass/s ÷ 20Hz)
  VENOM_DURATION_TICKS: 60,       // 독 지속 3초
  MASS_DRAIN_RATIO: 0.10,         // Mass Drain: 10% 흡수
  GRAVITY_PULL_RADIUS: 200,       // Gravity Well 끌어당김 반경
  GRAVITY_PULL_SPEED: 5,          // Gravity Well 끌어당김 속도
  SHIELD_PUSH_RADIUS: 80,         // Shield Burst 밀침 반경
  SHIELD_PUSH_FORCE: 50,          // Shield Burst 밀침 거리
  LIGHTNING_RANGE: 200,           // Lightning Strike 사거리
  DEATH_XP_ORB_RATIO: 0.80,      // 사망 시 mass의 80%가 XP 오브
} as const;

// ─── Arena Shrink Config ───

export const SHRINK_CONFIG = {
  ENABLED: true,
  INITIAL_RADIUS: 6000,           // 초기 반경
  MIN_RADIUS: 1200,               // 최소 반경
  SHRINK_RATE_PER_MIN: 600,       // 분당 수축 (px)
  /** 틱당 수축 = 600/60/20 = 0.5 px/tick */
  SHRINK_PER_TICK: 0.5,
  BOUNDARY_PENALTY_PER_TICK: 0.0025, // 경계 밖 패널티 (mass의 0.25%/tick)
} as const;

// ─── Grace Period ───

export const GRACE_PERIOD_TICKS = 600; // 30초 @ 20Hz — 초반 전투 면역

// ─── Upgrade Choice Config ───

export const UPGRADE_CONFIG = {
  CHOICES_PER_LEVEL: 3,            // 레벨업 시 3택
  CHOICE_TIMEOUT_TICKS: 100,       // 5초 타임아웃
  MAX_ABILITY_SLOTS: 2,            // 기본 Ability 슬롯 2개
  MAX_ABILITY_LEVEL: 4,            // Ability 최대 강화 4회
  /** Ability가 나올 확률 (나머지는 Tome) */
  ABILITY_OFFER_CHANCE: 0.35,
  /** Luck Tome 스택당 레어 업그레이드 확률 증가 */
  LUCK_RARE_BONUS_PER_STACK: 0.15,
} as const;

// ─── Bot Build Paths ───

export type BotBuildPath = 'aggressive' | 'tank' | 'xp_rush' | 'balanced' | 'glass_cannon';

export const BOT_BUILD_PREFERENCES: Record<BotBuildPath, {
  tomePriority: TomeType[];
  abilityPriority: AbilityType[];
}> = {
  aggressive: {
    tomePriority: ['damage', 'speed', 'cursed'],
    abilityPriority: ['venom_aura', 'lightning_strike', 'speed_dash'],
  },
  tank: {
    tomePriority: ['armor', 'regen', 'magnet'],
    abilityPriority: ['shield_burst', 'mass_drain', 'gravity_well'],
  },
  xp_rush: {
    tomePriority: ['xp', 'magnet', 'speed'],
    abilityPriority: ['gravity_well', 'speed_dash', 'venom_aura'],
  },
  balanced: {
    tomePriority: ['damage', 'armor', 'speed'],
    abilityPriority: ['venom_aura', 'shield_burst', 'lightning_strike'],
  },
  glass_cannon: {
    tomePriority: ['damage', 'cursed', 'speed'],
    abilityPriority: ['lightning_strike', 'venom_aura', 'speed_dash'],
  },
};

// ─── Map Object Config ───

export const MAP_OBJECT_CONFIGS: Record<MapObjectType, MapObjectConfig> = {
  shrine: {
    type: 'shrine',
    name: 'XP Shrine',
    radius: 48,
    respawnTicks: 600,     // 30초 @ 20Hz
    count: 3,
    description: '+15 XP on interact',
  },
  spring: {
    type: 'spring',
    name: 'Healing Spring',
    radius: 48,
    respawnTicks: 0,        // 항상 활성
    count: 2,
    description: '+5 mass/tick while in range',
  },
  altar: {
    type: 'altar',
    name: 'Upgrade Altar',
    radius: 48,
    respawnTicks: 1200,    // 60초 @ 20Hz
    count: 1,
    description: 'Instant level-up (1 use)',
  },
  gate: {
    type: 'gate',
    name: 'Speed Gate',
    radius: 32,
    respawnTicks: 200,     // 10초 @ 20Hz
    count: 2,
    description: '3s speed boost on pass',
  },
};
