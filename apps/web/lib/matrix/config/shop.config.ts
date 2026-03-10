/**
 * shop.config.ts - v37 Phase 7: 전장 상점 아이템 데이터
 *
 * 9종 아이템 정의:
 * - 소모품 (Consumables): 체력 포션, 쉴드 포션, 속도 부스트
 * - 스텟업 (Stat Boost): 공격력, 방어력, 이동속도
 * - 경제투자 (Investment): Gold 배율, 킬 보상, Score 배율
 *
 * 인플레이션: 구매 횟수에 따라 +20%
 * 중첩 제한: 소모품 1~2개, 스텟업 3회, 경제 3회
 *
 * Phase 10 밸런스 조정:
 * - 소모품 가격/중첩 → 기획서 sec 4.5 준수 (HP 300G, Shield 400G, XP 500G)
 * - 스텟 업 → +5%/800G/max3 (기획서 수치, 과도한 스택 방지)
 * - 경제 투자 → 배율 완화 (Gold +15%, Kill +20%, Score +15%)
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
    name: 'HP Kit',
    nameKo: 'HP 키트',
    description: 'Instantly restore 30% HP',
    descriptionKo: 'HP 30% 즉시 회복',
    category: 'consumable',
    basePrice: 300,
    maxStack: 2,
    effectType: 'heal_percent',
    effectValue: 30,
    duration: 0,
    icon: 'Heart',
    color: '#EF4444',
  },
  {
    id: 'shield_potion',
    name: 'Shield',
    nameKo: '보호막',
    description: '3s damage immunity',
    descriptionKo: '3초간 피해 면역',
    category: 'consumable',
    basePrice: 400,
    maxStack: 1,
    effectType: 'shield_duration',
    effectValue: 3,
    duration: 3,
    icon: 'Shield',
    color: '#3B82F6',
  },
  {
    id: 'xp_boost',
    name: 'XP Boost',
    nameKo: 'XP 부스트',
    description: '30s XP ×2',
    descriptionKo: '30초간 XP 2배',
    category: 'consumable',
    basePrice: 500,
    maxStack: 1,
    effectType: 'speed_boost_duration',
    effectValue: 100,
    duration: 30,
    icon: 'Zap',
    color: '#F59E0B',
  },

  // ─── 스텟 업 (Stat Boost) ───
  {
    id: 'damage_up',
    name: 'DMG +5%',
    nameKo: '공격력 +5%',
    description: 'Permanent +5% damage',
    descriptionKo: '영구 공격력 +5%',
    category: 'stat_boost',
    basePrice: 800,
    maxStack: 3,
    effectType: 'damage_percent',
    effectValue: 5,
    duration: 0,
    icon: 'Sword',
    color: '#EF4444',
  },
  {
    id: 'defense_up',
    name: 'DEF +5%',
    nameKo: '방어력 +5%',
    description: 'Permanent +5% defense',
    descriptionKo: '영구 방어력 +5%',
    category: 'stat_boost',
    basePrice: 800,
    maxStack: 3,
    effectType: 'defense_percent',
    effectValue: 5,
    duration: 0,
    icon: 'ShieldCheck',
    color: '#22C55E',
  },
  {
    id: 'movespeed_up',
    name: 'SPD +5%',
    nameKo: '이동속도 +5%',
    description: 'Permanent +5% move speed',
    descriptionKo: '영구 이동속도 +5%',
    category: 'stat_boost',
    basePrice: 800,
    maxStack: 3,
    effectType: 'move_speed_percent',
    effectValue: 5,
    duration: 0,
    icon: 'ChevronsRight',
    color: '#06B6D4',
  },

  // ─── 경제 투자 (Investment) ───
  {
    id: 'gold_multiplier',
    name: 'Gold +15%',
    nameKo: 'Gold 배율 +15%',
    description: 'Permanent +15% gold gain',
    descriptionKo: '영구 Gold 획득 +15%',
    category: 'investment',
    basePrice: 600,
    maxStack: 3,
    effectType: 'gold_multiplier',
    effectValue: 15,
    duration: 0,
    icon: 'Coins',
    color: '#F59E0B',
  },
  {
    id: 'kill_reward_up',
    name: 'Kill +20%',
    nameKo: '킬 보상 +20%',
    description: 'Permanent +20% kill reward',
    descriptionKo: '영구 킬 보상 +20%',
    category: 'investment',
    basePrice: 1000,
    maxStack: 3,
    effectType: 'kill_reward',
    effectValue: 20,
    duration: 0,
    icon: 'Skull',
    color: '#8B5CF6',
  },
  {
    id: 'score_multiplier',
    name: 'Score +15%',
    nameKo: 'Score 배율 +15%',
    description: 'Permanent +15% score gain',
    descriptionKo: '영구 Score +15%',
    category: 'investment',
    basePrice: 800,
    maxStack: 3,
    effectType: 'score_multiplier',
    effectValue: 15,
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
