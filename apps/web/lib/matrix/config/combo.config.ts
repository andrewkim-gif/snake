/**
 * combo.config.ts - 콤보 카운터 시스템 설정
 * CODE SURVIVOR v7.2 - Extended Combo System (10000+ combo support)
 *
 * 티어 구조:
 * - Bronze (10+): 입문
 * - Silver (30+): 성장
 * - Gold (50+): 숙련
 * - Diamond (100+): 마스터
 * - Platinum (200+): 엘리트
 * - Master (500+): 챔피언
 * - Grandmaster (1000+): 전설
 * - Legend (2000+): 신화
 * - Mythic (5000+): 초월
 * - Transcendent (10000+): 신
 */

import { ComboTier, ComboTierConfig } from '../types';

// 확장된 티어 설정 타입
interface ExtendedTierConfig extends ComboTierConfig {
  nameEn: string;
  glowColor: string;
  // 시각 효과 레벨 (1-10)
  visualIntensity: number;
  // 특수 효과 타입
  specialEffect?: 'rgb_split' | 'fire' | 'lightning' | 'cosmic' | 'divine' | 'reality_warp';
}

export const COMBO_CONFIG = {
  // 기본 설정
  maxTimer: 3,             // 콤보 유지 시간 (초)
  resetOnHit: true,        // 피격 시 콤보 리셋
  showFloatingNumber: true, // 킬 시 +1 플로팅 표시

  // 티어 설정 (10개 티어)
  tiers: {
    bronze: {
      threshold: 10,
      name: '컴파일 성공!',
      nameEn: 'Compile Success!',
      effect: { type: 'xp', value: 0.1, isActive: true },
      sound: 'combo_bronze',
      color: '#cd7f32',
      glowColor: 'rgba(205, 127, 50, 0.5)',
      visualIntensity: 1,
    },
    silver: {
      threshold: 30,
      name: '코드 리뷰 통과!',
      nameEn: 'Code Review Passed!',
      effect: { type: 'speed', value: 0.15, isActive: true },
      sound: 'combo_silver',
      color: '#c0c0c0',
      glowColor: 'rgba(192, 192, 192, 0.6)',
      visualIntensity: 2,
    },
    gold: {
      threshold: 50,
      name: '프로덕션 배포!',
      nameEn: 'Production Deploy!',
      effect: { type: 'damage', value: 0.25, isActive: true },
      sound: 'combo_gold',
      color: '#ffd700',
      glowColor: 'rgba(255, 215, 0, 0.6)',
      visualIntensity: 3,
    },
    diamond: {
      threshold: 100,
      name: '시스템 관리자!',
      nameEn: 'System Admin!',
      effect: { type: 'damage', value: 0.35, isActive: true },
      sound: 'combo_diamond',
      color: '#00FF41',
      glowColor: 'rgba(0, 255, 65, 0.7)',
      visualIntensity: 4,
      specialEffect: 'rgb_split',
    },
    platinum: {
      threshold: 200,
      name: '수석 개발자!',
      nameEn: 'Principal Engineer!',
      effect: { type: 'damage', value: 0.45, isActive: true },
      sound: 'combo_platinum',
      color: '#E5E4E2',
      glowColor: 'rgba(229, 228, 226, 0.8)',
      visualIntensity: 5,
      specialEffect: 'rgb_split',
    },
    master: {
      threshold: 500,
      name: 'CTO!',
      nameEn: 'CTO!',
      effect: { type: 'damage', value: 0.55, isActive: true },
      sound: 'combo_master',
      color: '#FF6B35',
      glowColor: 'rgba(255, 107, 53, 0.8)',
      visualIntensity: 6,
      specialEffect: 'fire',
    },
    grandmaster: {
      threshold: 1000,
      name: '테크 리드!',
      nameEn: 'Tech Lead!',
      effect: { type: 'damage', value: 0.70, isActive: true },
      sound: 'combo_grandmaster',
      color: '#00D4FF',
      glowColor: 'rgba(0, 212, 255, 0.9)',
      visualIntensity: 7,
      specialEffect: 'lightning',
    },
    legend: {
      threshold: 2000,
      name: '실리콘밸리 레전드!',
      nameEn: 'Silicon Valley Legend!',
      effect: { type: 'damage', value: 0.85, isActive: true },
      sound: 'combo_legend',
      color: '#9D4EDD',
      glowColor: 'rgba(157, 78, 221, 0.9)',
      visualIntensity: 8,
      specialEffect: 'cosmic',
    },
    mythic: {
      threshold: 5000,
      name: '디지털 신!',
      nameEn: 'Digital God!',
      effect: { type: 'damage', value: 1.0, isActive: true },
      sound: 'combo_mythic',
      color: '#FF1493',
      glowColor: 'rgba(255, 20, 147, 1.0)',
      visualIntensity: 9,
      specialEffect: 'divine',
    },
    transcendent: {
      threshold: 10000,
      name: '초월자!',
      nameEn: 'TRANSCENDENT!',
      effect: { type: 'damage', value: 1.5, isActive: true },
      sound: 'combo_transcendent',
      color: '#FFFFFF',
      glowColor: 'rgba(255, 255, 255, 1.0)',
      visualIntensity: 10,
      specialEffect: 'reality_warp',
    },
  } as Record<Exclude<ComboTier, 'none'>, ExtendedTierConfig>,

  // 시각 효과
  visual: {
    // 콤보 숫자 크기 배율 (콤보 수에 따라)
    sizeScale: {
      base: 1.0,
      perCombo: 0.002,    // 콤보당 0.2% 증가 (10000 콤보 = 21x)
      max: 2.0            // 최대 200%
    },
    // 티어업 애니메이션
    tierUpDuration: 0.5,
    // 타이머 바
    timerBarWidth: 100,
    timerBarHeight: 6,
    // 플로팅 숫자
    floatingDuration: 0.5
  },

  // 사운드
  sounds: {
    kill: 'combo_hit',
    tierUp: 'combo_tierup',
    reset: 'combo_break',
    milestone: 'combo_milestone',
    // 천 단위 돌파 특별 사운드
    thousand: 'combo_thousand',
  },

  // 마일스톤 (특별 연출) - 10000까지 확장
  milestones: [
    // 초반 (빠른 피드백)
    10, 25, 50, 75, 100,
    // 중반 (100 단위)
    150, 200, 250, 300, 400, 500,
    // 후반 (500 단위)
    750, 1000, 1500, 2000, 2500, 3000,
    // 끝판 (1000 단위)
    4000, 5000, 6000, 7000, 8000, 9000, 10000,
  ],

  // 천 단위 마일스톤 (특별 대형 연출)
  thousandMilestones: [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000],

  // 백 단위 마일스톤 (중형 연출)
  hundredMilestones: [100, 200, 300, 400, 500, 600, 700, 800, 900],
};

// 티어 순서 (비교용)
export const COMBO_TIER_ORDER: ComboTier[] = [
  'none',
  'bronze',
  'silver',
  'gold',
  'diamond',
  'platinum',
  'master',
  'grandmaster',
  'legend',
  'mythic',
  'transcendent',
];

// 콤보 수로 티어 계산
export function getComboTier(count: number): ComboTier {
  if (count >= COMBO_CONFIG.tiers.transcendent.threshold) return 'transcendent';
  if (count >= COMBO_CONFIG.tiers.mythic.threshold) return 'mythic';
  if (count >= COMBO_CONFIG.tiers.legend.threshold) return 'legend';
  if (count >= COMBO_CONFIG.tiers.grandmaster.threshold) return 'grandmaster';
  if (count >= COMBO_CONFIG.tiers.master.threshold) return 'master';
  if (count >= COMBO_CONFIG.tiers.platinum.threshold) return 'platinum';
  if (count >= COMBO_CONFIG.tiers.diamond.threshold) return 'diamond';
  if (count >= COMBO_CONFIG.tiers.gold.threshold) return 'gold';
  if (count >= COMBO_CONFIG.tiers.silver.threshold) return 'silver';
  if (count >= COMBO_CONFIG.tiers.bronze.threshold) return 'bronze';
  return 'none';
}

// 다음 티어까지 필요한 콤보 수
export function getNextTierThreshold(currentTier: ComboTier): number | null {
  const tierIndex = COMBO_TIER_ORDER.indexOf(currentTier);
  if (tierIndex === -1 || tierIndex >= COMBO_TIER_ORDER.length - 1) return null;

  const nextTier = COMBO_TIER_ORDER[tierIndex + 1];
  if (nextTier === 'none') return COMBO_CONFIG.tiers.bronze.threshold;
  return COMBO_CONFIG.tiers[nextTier as keyof typeof COMBO_CONFIG.tiers]?.threshold ?? null;
}

// 마일스톤 타입 판별
export function getMilestoneType(count: number): 'thousand' | 'hundred' | 'normal' | null {
  if (COMBO_CONFIG.thousandMilestones.includes(count)) return 'thousand';
  if (COMBO_CONFIG.hundredMilestones.includes(count)) return 'hundred';
  if (COMBO_CONFIG.milestones.includes(count)) return 'normal';
  return null;
}

// 초기 콤보 상태 생성
export function createInitialComboState() {
  return {
    count: 0,
    maxCount: 0,
    timer: 0,
    maxTimer: COMBO_CONFIG.maxTimer,
    tier: 'none' as ComboTier,
    multipliers: {
      xp: 1,
      speed: 1,
      damage: 1
    },
    effects: [],
    lastKillTime: 0,
    tierUpAnimation: 0
  };
}

// 숫자 포맷팅 (콤마 구분: 1000 → 1,000)
export function formatComboNumber(count: number): string {
  return count.toLocaleString();
}

// 티어 인덱스 가져오기 (시각 효과 강도 계산용)
export function getTierIndex(tier: ComboTier): number {
  return COMBO_TIER_ORDER.indexOf(tier);
}
