/**
 * upgrade-materials.config.ts - v5.7 통합 스탯 업그레이드 시스템
 *
 * 변경사항:
 * - 캐릭터별 재료 -> 통합 재료 (universalMaterials)
 * - 단일 레벨 업그레이드 -> 4가지 스탯별 업그레이드 (HP, ATK, SPD, DEF)
 * - 비용 공식: baseCost * Math.pow(1.5, currentLevel)
 * - 최대 레벨: 20 (스탯당)
 *
 * Ported from app_ingame/config/upgrade-materials.config.ts
 */

import type { PlayerClass } from '../types';

// 스탯 타입 정의
export type StatType = 'hp' | 'atk' | 'spd' | 'def';

// 캐릭터 스탯 정의
export interface CharacterStats {
  hp: number;
  atk: number;
  spd: number;
  def: number;
}

// 스탯 상수
export const MAX_STAT_LEVEL = 20;

// 스탯 레벨당 보너스 (%)
export const STAT_BONUS_PER_LEVEL: Record<StatType, number> = {
  hp: 5,    // 레벨당 +5% HP
  atk: 5,   // 레벨당 +5% ATK
  spd: 3,   // 레벨당 +3% SPD
  def: 4,   // 레벨당 +4% DEF
};

// ============================================
// 새로운 통합 업그레이드 시스템
// ============================================

// 스탯별 기본 업그레이드 비용 (v7.23: 엘리트 드랍 증가에 맞춰 3배 상향)
// 기존: hp:10, atk:15, spd:12, def:12 -> 드랍 3배 증가했으니 비용도 3배
export const BASE_UPGRADE_COST: Record<StatType, number> = {
  hp: 30,    // HP: 기본 30 크레딧 (기존 10)
  atk: 45,   // ATK: 기본 45 크레딧 (기존 15, 공격력은 더 비쌈)
  spd: 35,   // SPD: 기본 35 크레딧 (기존 12)
  def: 35,   // DEF: 기본 35 크레딧 (기존 12)
};

// 비용 증가 배율 (지수 곡선)
export const COST_MULTIPLIER = 1.5;

/**
 * 특정 스탯 레벨에서 다음 레벨로 업그레이드하는 비용 계산
 * @param statType 스탯 타입 (hp, atk, spd, def)
 * @param currentLevel 현재 레벨 (0-19)
 * @returns 업그레이드 비용 (크레딧)
 */
export function getStatUpgradeCost(statType: StatType, currentLevel: number): number {
  if (currentLevel >= MAX_STAT_LEVEL) return Infinity;
  const baseCost = BASE_UPGRADE_COST[statType];
  return Math.floor(baseCost * Math.pow(COST_MULTIPLIER, currentLevel));
}

/**
 * 특정 스탯의 현재 보너스 계산 (%)
 * @param statType 스탯 타입
 * @param level 현재 레벨 (0-20)
 * @returns 보너스 퍼센트 (예: 25 = +25%)
 */
export function getStatBonus(statType: StatType, level: number): number {
  return level * STAT_BONUS_PER_LEVEL[statType];
}

/**
 * 특정 스탯의 현재 보너스 배율 계산
 * @param statType 스탯 타입
 * @param level 현재 레벨 (0-20)
 * @returns 배율 (예: 1.25 = +25%)
 */
export function getStatMultiplier(statType: StatType, level: number): number {
  return 1 + (level * STAT_BONUS_PER_LEVEL[statType] / 100);
}

/**
 * 캐릭터의 모든 스탯 배율 계산
 * @param stats 캐릭터 스탯
 * @returns 각 스탯의 배율
 */
export function getAllStatMultipliers(stats: CharacterStats): {
  hpMultiplier: number;
  atkMultiplier: number;
  spdMultiplier: number;
  defMultiplier: number;
} {
  return {
    hpMultiplier: getStatMultiplier('hp', stats.hp),
    atkMultiplier: getStatMultiplier('atk', stats.atk),
    spdMultiplier: getStatMultiplier('spd', stats.spd),
    defMultiplier: getStatMultiplier('def', stats.def),
  };
}

/**
 * 스탯 업그레이드 가능 여부 확인
 * @param stats 현재 스탯
 * @param statType 업그레이드할 스탯
 * @param materials 보유 재료
 * @returns 업그레이드 가능 여부
 */
export function canUpgradeStat(
  stats: CharacterStats,
  statType: StatType,
  materials: number
): boolean {
  const currentLevel = stats[statType];
  if (currentLevel >= MAX_STAT_LEVEL) return false;
  const cost = getStatUpgradeCost(statType, currentLevel);
  return materials >= cost;
}

// 스탯 UI 정보
export interface StatInfo {
  name: string;
  nameKo: string;
  desc: string;
  color: string;
  icon: string; // lucide-react icon name
}

export const STAT_INFO: Record<StatType, StatInfo> = {
  hp: {
    name: 'HP',
    nameKo: '체력',
    desc: '최대 체력 증가',
    color: '#ef4444', // red-500
    icon: 'Heart',
  },
  atk: {
    name: 'ATK',
    nameKo: '공격력',
    desc: '데미지 증가',
    color: '#f97316', // orange-500
    icon: 'Swords',
  },
  spd: {
    name: 'SPD',
    nameKo: '속도',
    desc: '이동 속도 증가',
    color: '#3b82f6', // blue-500
    icon: 'Zap',
  },
  def: {
    name: 'DEF',
    nameKo: '방어력',
    desc: '받는 피해 감소',
    color: '#22c55e', // green-500
    icon: 'Shield',
  },
};

// 스탯 순서 (UI 표시용)
export const STAT_ORDER: StatType[] = ['hp', 'atk', 'spd', 'def'];

// ============================================
// 레거시 호환 (하위호환용 - 마이그레이션 후 제거 예정)
// ============================================

export interface MaterialInfo {
  name: string;
  desc: string;
  color: string;
  icon: string;
  minStage: number;
}

export const MATERIAL_DATA: Record<PlayerClass, MaterialInfo> = {
  neo: {
    name: "코드 조각",
    desc: "NEO의 각성에서 떨어진 코드 파편",
    color: "#00FF41",
    icon: "Code",
    minStage: 1
  },
  tank: {
    name: "서버 칩",
    desc: "TANK가 관리하는 서버의 부품",
    color: "#f97316",
    icon: "Server",
    minStage: 1
  },
  cypher: {
    name: "UI 컴포넌트",
    desc: "CYPHER가 만든 프론트엔드 조각",
    color: "#eab308",
    icon: "Layout",
    minStage: 1
  },
  morpheus: {
    name: "레거시 코드",
    desc: "MORPHEUS가 30년간 유지보수한 코드",
    color: "#ef4444",
    icon: "FileCode",
    minStage: 1
  },
  niobe: {
    name: "클라우드 토큰",
    desc: "NIOBE의 멀티클라우드 인증 토큰",
    color: "#8b5cf6",
    icon: "Cloud",
    minStage: 6
  },
  oracle: {
    name: "데이터 결정",
    desc: "ORACLE의 예측 모델 결정체",
    color: "#06b6d4",
    icon: "Database",
    minStage: 11
  },
  trinity: {
    name: "암호키",
    desc: "TRINITY의 보안 암호키 조각",
    color: "#f472b6",
    icon: "Key",
    minStage: 16
  },
  mouse: {
    name: "버그 리포트",
    desc: "MOUSE가 발견한 버그 보고서",
    color: "#22c55e",
    icon: "Bug",
    minStage: 21
  },
  dozer: {
    name: "테스트 케이스",
    desc: "DOZER의 QA 테스트 케이스",
    color: "#fb923c",
    icon: "TestTube",
    minStage: 26
  }
};

// 레거시 함수들 (하위호환)
export const UPGRADE_COSTS: number[] = [0, 5, 10, 20, 35, 55, 80, 110, 150, 200];
export const MAX_UPGRADE_LEVEL = 10;

export function getUpgradeBonus(level: number): {
  hpBonus: number;
  speedBonus: number;
  damageBonus: number;
} {
  const effectiveLevel = Math.min(level, MAX_UPGRADE_LEVEL) - 1;
  return {
    hpBonus: effectiveLevel * 0.05,
    speedBonus: effectiveLevel * 0.02,
    damageBonus: effectiveLevel * 0.05
  };
}

export function getMaterialsNeeded(currentLevel: number): number {
  if (currentLevel >= MAX_UPGRADE_LEVEL) return 0;
  return UPGRADE_COSTS[currentLevel] || 0;
}

export function getTotalMaterialsNeeded(targetLevel: number): number {
  let total = 0;
  for (let i = 1; i < targetLevel && i < UPGRADE_COSTS.length; i++) {
    total += UPGRADE_COSTS[i];
  }
  return total;
}

// 드롭 설정 (통합 재료로 변경)
export const DROP_CONFIG = {
  baseDropRate: 0.05,
  bossGuaranteedMin: 8,
  bossGuaranteedMax: 15,
  eliteBonus: 3,
  stageCompleteBonus: 5
};
