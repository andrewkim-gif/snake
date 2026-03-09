/**
 * Item System Configuration
 * Shared configuration for consumables, upgrades, and boosters
 *
 * Ported from app_ingame/config/items.config.ts
 * lucide-react icons stubbed as string identifiers
 */

// =====================================================
// Icon stubs (lucide-react removed for Next.js porting)
// =====================================================

/** Stub type for lucide-react LucideIcon */
type LucideIconStub = string;

const Heart: LucideIconStub = 'Heart';
const Star: LucideIconStub = 'Star';
const Flame: LucideIconStub = 'Flame';
const Shield: LucideIconStub = 'Shield';
const RefreshCw: LucideIconStub = 'RefreshCw';
const Sparkles: LucideIconStub = 'Sparkles';
const Zap: LucideIconStub = 'Zap';
const Timer: LucideIconStub = 'Timer';
const Sword: LucideIconStub = 'Sword';
const HeartPulse: LucideIconStub = 'HeartPulse';
const Cpu: LucideIconStub = 'Cpu';

// =====================================================
// Consumable Items
// =====================================================

export type ConsumableType =
  | 'revive'
  | 'exp_boost'
  | 'gold_boost'
  | 'shield_charge'
  | 'skill_reroll'
  | 'double_drop';

export interface ConsumableConfig {
  id: ConsumableType;
  name: string;
  nameKo: string;
  description: string;
  descriptionKo: string;
  icon: LucideIconStub;
  color: string;
  priceCredits: number;
  effect: string;
  effectKo: string;
}

export const CONSUMABLE_ITEMS: ConsumableConfig[] = [
  {
    id: 'revive',
    name: 'Revive Token',
    nameKo: '부활권',
    description: 'Instantly revive upon death with 50% HP.',
    descriptionKo: '사망 시 HP 50%로 즉시 부활합니다.',
    icon: Heart,
    color: '#ef4444',
    priceCredits: 10000,
    effect: 'Revive with 50% HP + 3s invincibility',
    effectKo: 'HP 50% + 3초 무적',
  },
  {
    id: 'exp_boost',
    name: 'EXP Booster',
    nameKo: 'EXP 부스터',
    description: '2x experience gain for 5 minutes.',
    descriptionKo: '5분간 경험치 획득량이 2배가 됩니다.',
    icon: Star,
    color: '#8b5cf6',
    priceCredits: 5000,
    effect: '2x EXP for 5 minutes',
    effectKo: '5분간 EXP 2배',
  },
  {
    id: 'gold_boost',
    name: 'Credit Booster',
    nameKo: '크레딧 부스터',
    description: '1.5x credit gain for 10 minutes.',
    descriptionKo: '10분간 크레딧 획득량이 1.5배가 됩니다.',
    icon: Flame,
    color: '#f59e0b',
    priceCredits: 3000,
    effect: '1.5x Credits for 10 minutes',
    effectKo: '10분간 크레딧 1.5배',
  },
  {
    id: 'shield_charge',
    name: 'Shield Charger',
    nameKo: '쉴드 충전기',
    description: 'Start with a 100-damage absorbing shield.',
    descriptionKo: '게임 시작 시 100 데미지 흡수 쉴드를 획득합니다.',
    icon: Shield,
    color: '#3b82f6',
    priceCredits: 4000,
    effect: '100 damage shield at start',
    effectKo: '시작 시 100 쉴드',
  },
  {
    id: 'skill_reroll',
    name: 'Skill Reroll',
    nameKo: '스킬 리롤권',
    description: '+3 level-up rerolls for the run.',
    descriptionKo: '해당 런에서 레벨업 선택지 리롤 +3회.',
    icon: RefreshCw,
    color: '#8b5cf6',
    priceCredits: 2500,
    effect: '+3 rerolls per run',
    effectKo: '런당 리롤 +3회',
  },
  {
    id: 'double_drop',
    name: 'Double Drop',
    nameKo: '더블 드랍',
    description: '2x drop rate for 3 minutes.',
    descriptionKo: '3분간 모든 드랍이 2배가 됩니다.',
    icon: Sparkles,
    color: '#fbbf24',
    priceCredits: 5000,
    effect: '2x drops for 3 minutes',
    effectKo: '3분간 드랍 2배',
  },
];

export function getConsumableConfig(id: ConsumableType): ConsumableConfig | undefined {
  return CONSUMABLE_ITEMS.find(item => item.id === id);
}

// =====================================================
// Permanent Upgrades
// =====================================================

export type PermanentUpgradeType =
  | 'speedLevel'
  | 'hasteLevel'
  | 'powerLevel'
  | 'armorLevel';

export interface PermanentUpgradeConfig {
  id: PermanentUpgradeType;
  name: string;
  nameKo: string;
  description: string;
  descriptionKo: string;
  icon: LucideIconStub;
  color: string;
  maxLevel: number;
  baseCost: number;
  costMultiplier: number;
  effectPerLevel: number;
  effectUnit: string;
}

export const PERMANENT_UPGRADES: PermanentUpgradeConfig[] = [
  {
    id: 'speedLevel',
    name: 'Move Speed',
    nameKo: '이동속도',
    description: 'Increase base movement speed.',
    descriptionKo: '기본 이동속도를 증가시킵니다.',
    icon: Zap,
    color: '#eab308',
    maxLevel: 20,
    baseCost: 1000,
    costMultiplier: 2.0,
    effectPerLevel: 3,
    effectUnit: '%',
  },
  {
    id: 'hasteLevel',
    name: 'Attack Speed',
    nameKo: '공격속도',
    description: 'Increase weapon attack speed.',
    descriptionKo: '무기 공격속도를 증가시킵니다.',
    icon: Timer,
    color: '#f97316',
    maxLevel: 20,
    baseCost: 1500,
    costMultiplier: 2.0,
    effectPerLevel: 2,
    effectUnit: '%',
  },
  {
    id: 'powerLevel',
    name: 'Damage',
    nameKo: '데미지',
    description: 'Increase all damage dealt.',
    descriptionKo: '모든 데미지를 증가시킵니다.',
    icon: Sword,
    color: '#dc2626',
    maxLevel: 20,
    baseCost: 2000,
    costMultiplier: 2.0,
    effectPerLevel: 5,
    effectUnit: '%',
  },
  {
    id: 'armorLevel',
    name: 'Max HP',
    nameKo: '최대 HP',
    description: 'Increase maximum health points.',
    descriptionKo: '최대 체력을 증가시킵니다.',
    icon: HeartPulse,
    color: '#ec4899',
    maxLevel: 20,
    baseCost: 1500,
    costMultiplier: 2.0,
    effectPerLevel: 50,
    effectUnit: '',
  },
];

/**
 * Calculate upgrade cost for a given level
 */
export function getUpgradeCost(type: PermanentUpgradeType, currentLevel: number): number {
  const config = PERMANENT_UPGRADES.find(u => u.id === type);
  if (!config) return 0;
  return Math.floor(config.baseCost * Math.pow(config.costMultiplier, currentLevel));
}

/**
 * Get total effect for a given upgrade level
 */
export function getUpgradeEffect(type: PermanentUpgradeType, level: number): string {
  const config = PERMANENT_UPGRADES.find(u => u.id === type);
  if (!config) return '0';
  const totalEffect = config.effectPerLevel * level;
  return `+${totalEffect}${config.effectUnit}`;
}

/**
 * Get next level effect preview
 */
export function getNextLevelEffect(type: PermanentUpgradeType, currentLevel: number): string {
  const config = PERMANENT_UPGRADES.find(u => u.id === type);
  if (!config) return '0';
  const nextEffect = config.effectPerLevel * (currentLevel + 1);
  return `+${nextEffect}${config.effectUnit}`;
}

export function getPermanentUpgradeConfig(id: PermanentUpgradeType): PermanentUpgradeConfig | undefined {
  return PERMANENT_UPGRADES.find(u => u.id === id);
}

// =====================================================
// Vibe Coding Time Prices
// =====================================================

export interface VibeTimeOption {
  id: string;
  minutes: number;
  label: string;
  labelKo: string;
  priceCredits: number | null;  // null = 광고/무료
  paymentType: 'credits' | 'ad' | 'free';
  color: string;
  badge?: string;
}

export const VIBE_TIME_OPTIONS: VibeTimeOption[] = [
  // Credits purchases (larger amounts first)
  {
    id: 'credit_60min',
    minutes: 60,
    label: '1 Hour',
    labelKo: '1시간',
    priceCredits: 8000,
    paymentType: 'credits',
    color: '#22c55e',
    badge: 'Best Value',
  },
  {
    id: 'credit_30min',
    minutes: 30,
    label: '30 Min',
    labelKo: '30분',
    priceCredits: 4500,
    paymentType: 'credits',
    color: '#3b82f6',
  },
  {
    id: 'credit_10min',
    minutes: 10,
    label: '10 Min',
    labelKo: '10분',
    priceCredits: 2000,
    paymentType: 'credits',
    color: '#a855f7',
  },
  {
    id: 'credit_5min',
    minutes: 5,
    label: '5 Min',
    labelKo: '5분',
    priceCredits: 1200,
    paymentType: 'credits',
    color: '#eab308',
  },
  {
    id: 'credit_1min',
    minutes: 1,
    label: '1 Min',
    labelKo: '1분',
    priceCredits: 300,
    paymentType: 'credits',
    color: '#94a3b8',
  },
  // Free options
  {
    id: 'ad_10min',
    minutes: 10,
    label: 'Watch Ad',
    labelKo: '광고 시청',
    priceCredits: null,
    paymentType: 'ad',
    color: '#f97316',
  },
  {
    id: 'free_3min',
    minutes: 3,
    label: 'Daily Free',
    labelKo: '일일 무료',
    priceCredits: null,
    paymentType: 'free',
    color: '#06b6d4',
    badge: 'Daily',
  },
];

// =====================================================
// Core Fragment (Universal Material)
// =====================================================

export const CORE_FRAGMENT_CONFIG = {
  name: 'Core Fragment',
  nameKo: '코어 프래그먼트',
  description: 'Universal material usable for any character upgrade.',
  descriptionKo: '모든 캐릭터 업그레이드에 사용 가능한 범용 재료.',
  icon: Cpu,
  color: '#00FF41', // Matrix Green
  exchangeRate: 1.5, // 1.5 core = 1 character material
  shopPrice: 500, // 500 credits = 1 core fragment
};

// =====================================================
// Booster Configuration
// =====================================================

export interface BoosterConfig {
  type: 'exp_boost' | 'gold_boost' | 'double_drop';
  durationMinutes: number;
  multiplier: number;
}

export const BOOSTER_CONFIGS: Record<string, BoosterConfig> = {
  exp_boost: { type: 'exp_boost', durationMinutes: 5, multiplier: 2.0 },
  gold_boost: { type: 'gold_boost', durationMinutes: 10, multiplier: 1.5 },
  double_drop: { type: 'double_drop', durationMinutes: 3, multiplier: 2.0 },
};

// =====================================================
// Daily Limits
// =====================================================

export const DAILY_LIMITS = {
  maxAdWatches: 5,
  freeVibeTimeMinutes: 3,
  adVibeTimeMinutes: 10,
};
