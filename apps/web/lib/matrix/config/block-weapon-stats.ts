/**
 * block-weapon-stats.ts — 블록 좌표 무기 스탯 변환 유틸
 *
 * 픽셀 기반 WeaponStats → MC 블록 좌표 WeaponStats 변환.
 * 1 block = 1 Three.js unit (WORLD_SCALE=1).
 *
 * 변환 공식 (da:verify 검증 완료):
 *   area      /= 10   (40px → 4 blocks)
 *   speed     /= 50   (450px/s → 9 blocks/s)
 *   knockback /= 10   (35px → 3.5 blocks)
 *   damage    — 변경 없음 (스케일 무관)
 *   cooldown  — 변경 없음 (시간 기반)
 *   duration  — 변경 없음 (시간 기반)
 *   amount    — 변경 없음 (개수)
 *   pierce    — 변경 없음 (횟수)
 */

import type { WeaponStats, WeaponType } from '../types';
import { WEAPON_DATA } from './weapons.config';

// ============================================
// 변환 함수
// ============================================

/**
 * 픽셀 기반 WeaponStats → 블록 좌표 WeaponStats 변환
 */
export function toBlockStats(stats: WeaponStats): WeaponStats {
  return {
    ...stats,
    area: stats.area / 10,
    speed: stats.speed / 50,
    knockback: stats.knockback / 10,
  };
}

// ============================================
// 캐시 기반 조회
// ============================================

/** 블록 좌표 스탯 캐시 (weaponType:level → WeaponStats) */
const BLOCK_WEAPON_CACHE = new Map<string, WeaponStats>();

/**
 * 무기 타입 + 레벨 → 블록 좌표 스탯 조회
 * WEAPON_DATA[weaponType].stats[level-1]을 변환하여 반환
 * 없으면 null
 */
export function getBlockWeaponStats(
  weaponType: WeaponType,
  level: number
): WeaponStats | null {
  const cacheKey = `${weaponType}:${level}`;
  const cached = BLOCK_WEAPON_CACHE.get(cacheKey);
  if (cached) return cached;

  const weaponData = WEAPON_DATA[weaponType];
  if (!weaponData || !weaponData.stats || weaponData.stats.length === 0) {
    return null;
  }

  // level은 1부터, stats 배열은 0부터
  const idx = Math.max(0, Math.min(level - 1, weaponData.stats.length - 1));
  const pixelStats = weaponData.stats[idx];
  if (!pixelStats) return null;

  const blockStats = toBlockStats(pixelStats);
  BLOCK_WEAPON_CACHE.set(cacheKey, blockStats);
  return blockStats;
}

/**
 * 기본 폴백 스탯 (무기 데이터 조회 실패 시)
 */
export function getDefaultBlockStats(): WeaponStats {
  return {
    level: 1,
    damage: 10,
    area: 1,
    speed: 5,
    duration: 2,
    cooldown: 1.0,
    amount: 1,
    pierce: 1,
    knockback: 1,
  };
}
