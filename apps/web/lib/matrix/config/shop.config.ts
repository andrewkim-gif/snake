/**
 * shop.config.ts - v37 Phase 7: 전장 상점 아이템 데이터
 *
 * 9종 아이템 정의:
 * - 소모품 (Consumables): 체력 포션, 쉴드 포션, 속도 부스트
 * - 스텟업 (Stat Boost): 공격력, 방어력, 이동속도
 * - 경제투자 (Investment): Gold 배율, 킬 보상, Score 배율
 *
 * 인플레이션: 구매 횟수에 따라 +20%
 * 중첩 제한: 소모품 3개, 스텟업 5회, 경제 3회
 */

// ============================================
// 타입 정의
// ============================================

/** 상점 아이템 카테고리 */
export type ShopCategory = 'consumable' | 'stat_boost' | 'investment';

/** 상점 아이템 효과 타입 */
export type ShopEffectType =
  | 'heal_percent'        // HP % 회복
  | 'shield_duration'     // 쉴드 지속시간 (초)
  | 'speed_boost_duration'// 속도 부스트 지속시간 (초)
  | 'damage_percent'      // 영구 공격력 %
  | 'defense_percent'     // 영구 방어력 %
  | 'move_speed_percent'  // 영구 이동속도 %
  | 'gold_multiplier'     // Gold 배율 %
  | 'kill_reward'         // 킬 보상 %
  | 'score_multiplier';   // Score 배율 %

/** 상점 아이템 설정 */
export interface ShopItemConfig {
  id: string;
  name: string;
  nameKo: string;
  description: string;
  descriptionKo: string;
  category: ShopCategory;
  basePrice: number;
  maxStack: number;
  effectType: ShopEffectType;
  effectValue: number;
  /** 효과 지속 시간 (초, 0이면 영구) */
  duration: number;
  /** lucide-react 아이콘 이름 */
  icon: string;
  /** 아이콘/테두리 컬러 */
  color: string;
}

// ============================================
// 카테고리 표시 정보
// ============================================

export const SHOP_CATEGORY_DISPLAY: Record<ShopCategory, {
  label: string;
  labelKo: string;
  color: string;
}> = {
  consumable: {
    label: 'CONSUMABLES',
    labelKo: '소모품',
    color: '#22C55E',
  },
  stat_boost: {
    label: 'STAT BOOST',
    labelKo: '스텟 업',
    color: '#3B82F6',
  },
  investment: {
    label: 'INVESTMENT',
    labelKo: '경제 투자',
    color: '#F59E0B',
  },
};

// ============================================
// 아이템 정의 (9종)
// ============================================

export const SHOP_ITEMS: ShopItemConfig[] = [
  // ─── 소모품 (Consumables) ───
  {
    id: 'health_potion',
    name: 'Health Potion',
    nameKo: '체력 포션',
    description: 'Instantly restore 30% HP',
    descriptionKo: 'HP 30% 즉시 회복',
    category: 'consumable',
    basePrice: 500,
    maxStack: 3,
    effectType: 'heal_percent',
    effectValue: 30,
    duration: 0,
    icon: 'Heart',
    color: '#EF4444',
  },
  {
    id: 'shield_potion',
    name: 'Shield Potion',
    nameKo: '쉴드 포션',
    description: '5s damage immunity',
    descriptionKo: '5초간 피해 면역',
    category: 'consumable',
    basePrice: 800,
    maxStack: 3,
    effectType: 'shield_duration',
    effectValue: 5,
    duration: 5,
    icon: 'Shield',
    color: '#3B82F6',
  },
  {
    id: 'speed_boost',
    name: 'Speed Boost',
    nameKo: '속도 부스트',
    description: '10s speed +50%',
    descriptionKo: '10초간 속도 +50%',
    category: 'consumable',
    basePrice: 600,
    maxStack: 3,
    effectType: 'speed_boost_duration',
    effectValue: 50,
    duration: 10,
    icon: 'Zap',
    color: '#F59E0B',
  },

  // ─── 스텟 업 (Stat Boost) ───
  {
    id: 'damage_up',
    name: 'DMG +10%',
    nameKo: '공격력 +10%',
    description: 'Permanent +10% damage',
    descriptionKo: '영구 공격력 +10%',
    category: 'stat_boost',
    basePrice: 1500,
    maxStack: 5,
    effectType: 'damage_percent',
    effectValue: 10,
    duration: 0,
    icon: 'Sword',
    color: '#EF4444',
  },
  {
    id: 'defense_up',
    name: 'DEF +15%',
    nameKo: '방어력 +15%',
    description: 'Permanent +15% defense',
    descriptionKo: '영구 방어력 +15%',
    category: 'stat_boost',
    basePrice: 1200,
    maxStack: 5,
    effectType: 'defense_percent',
    effectValue: 15,
    duration: 0,
    icon: 'ShieldCheck',
    color: '#22C55E',
  },
  {
    id: 'movespeed_up',
    name: 'SPD +20%',
    nameKo: '이동속도 +20%',
    description: 'Permanent +20% move speed',
    descriptionKo: '영구 이동속도 +20%',
    category: 'stat_boost',
    basePrice: 1000,
    maxStack: 5,
    effectType: 'move_speed_percent',
    effectValue: 20,
    duration: 0,
    icon: 'ChevronsRight',
    color: '#06B6D4',
  },

  // ─── 경제 투자 (Investment) ───
  {
    id: 'gold_multiplier',
    name: 'Gold +25%',
    nameKo: 'Gold 배율 +25%',
    description: 'Permanent +25% gold gain',
    descriptionKo: '영구 Gold 획득 +25%',
    category: 'investment',
    basePrice: 2000,
    maxStack: 3,
    effectType: 'gold_multiplier',
    effectValue: 25,
    duration: 0,
    icon: 'Coins',
    color: '#F59E0B',
  },
  {
    id: 'kill_reward_up',
    name: 'Kill +50%',
    nameKo: '킬 보상 +50%',
    description: 'Permanent +50% kill reward',
    descriptionKo: '영구 킬 보상 +50%',
    category: 'investment',
    basePrice: 3000,
    maxStack: 3,
    effectType: 'kill_reward',
    effectValue: 50,
    duration: 0,
    icon: 'Skull',
    color: '#8B5CF6',
  },
  {
    id: 'score_multiplier',
    name: 'Score +30%',
    nameKo: 'Score 배율 +30%',
    description: 'Permanent +30% score gain',
    descriptionKo: '영구 Score +30%',
    category: 'investment',
    basePrice: 2500,
    maxStack: 3,
    effectType: 'score_multiplier',
    effectValue: 30,
    duration: 0,
    icon: 'TrendingUp',
    color: '#10B981',
  },
];

// ============================================
// 유틸리티 함수
// ============================================

/** ID로 아이템 찾기 */
export function getShopItem(id: string): ShopItemConfig | undefined {
  return SHOP_ITEMS.find(item => item.id === id);
}

/** 카테고리별 아이템 그룹 */
export function getShopItemsByCategory(category: ShopCategory): ShopItemConfig[] {
  return SHOP_ITEMS.filter(item => item.category === category);
}

/** 인플레이션 적용 가격 계산 */
export function getInflatedPrice(basePrice: number, purchaseCount: number): number {
  return Math.round(basePrice * Math.pow(1.20, purchaseCount));
}

/** 구매 가능 여부 확인 */
export function canPurchase(
  itemId: string,
  currentGold: number,
  purchaseCount: number,
): boolean {
  const item = getShopItem(itemId);
  if (!item) return false;
  if (purchaseCount >= item.maxStack) return false;
  const price = getInflatedPrice(item.basePrice, purchaseCount);
  return currentGold >= price;
}
