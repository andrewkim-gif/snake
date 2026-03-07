/**
 * character-generator.ts — 캐릭터 랜덤 생성 독립 모듈 (v14 Phase 1: S07)
 *
 * CharacterCreator.tsx의 랜덤 생성 로직을 추출하여
 * 로비 + 인게임 + 봇 등 어디서든 재사용 가능하게 함.
 *
 * 주요 기능:
 *   1. generateRandomAppearance(seed?, category?) — 시드 기반 재현 가능 랜덤 외형 생성
 *   2. generateSeededAppearance(seed) — 같은 시드 → 같은 외형 보장
 *   3. 5개 테마 카테고리: all, military, cyber, nature, fantasy
 */

import type { CubelingAppearance, BodyType } from '@agent-survivor/shared';

// ─── 시드 기반 PRNG (Mulberry32) ───

/**
 * Mulberry32 PRNG: 32비트 시드 기반 결정적 난수 생성기
 * 같은 시드 → 동일한 난수 시퀀스 보장
 */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 문자열 → 32비트 정수 해시 (시드 변환용)
 */
function stringToSeed(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// ─── 테마 카테고리 정의 ───

/** 랜덤 테마 카테고리 */
export type RandomCategory = 'all' | 'military' | 'cyber' | 'nature' | 'fantasy';

/** 카테고리별 색상 풀 (VIVID_PALETTE 인덱스) */
const CATEGORY_COLOR_POOLS: Record<RandomCategory, { top: number[]; bottom: number[] }> = {
  all: {
    top: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    bottom: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  },
  military: {
    top: [3, 7, 10],
    bottom: [7, 10, 3],
  },
  cyber: {
    top: [4, 5, 7, 9],
    bottom: [7, 5, 9],
  },
  nature: {
    top: [3, 11, 10, 2],
    bottom: [10, 3, 11, 7],
  },
  fantasy: {
    top: [0, 5, 2, 8, 4],
    bottom: [7, 5, 2, 0],
  },
};

/** 카테고리별 패턴 풀 */
const CATEGORY_PATTERN_POOLS: Record<RandomCategory, number[]> = {
  all: [0, 1, 2, 3, 4, 5, 6, 7],
  military: [0, 5, 1],
  cyber: [0, 4, 6],
  nature: [0, 2, 3],
  fantasy: [0, 1, 3, 7],
};

/** 카테고리별 장비 풀 */
const CATEGORY_EQUIP_POOLS: Record<RandomCategory, { hat: number[]; weapon: number[]; back: number[]; foot: number[] }> = {
  all: {
    hat: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    weapon: [0, 1, 2, 3, 4, 5, 6],
    back: [0, 1, 2, 3, 4, 5],
    foot: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  },
  military: {
    hat: [0, 1, 2],
    weapon: [0, 1, 2, 6],
    back: [0, 4, 5],
    foot: [0, 1, 2],
  },
  cyber: {
    hat: [0, 3],
    weapon: [0, 3, 4],
    back: [0, 4],
    foot: [0, 4, 8],
  },
  nature: {
    hat: [0, 7, 6],
    weapon: [0, 5, 6],
    back: [0, 2, 4],
    foot: [0, 5, 7],
  },
  fantasy: {
    hat: [0, 4, 5, 8],
    weapon: [0, 1, 3, 4],
    back: [0, 1, 2, 3],
    foot: [0, 2, 3, 6],
  },
};

/** 카테고리별 바디 타입 풀 */
const CATEGORY_BODY_POOLS: Record<RandomCategory, BodyType[]> = {
  all: ['standard', 'slim', 'chunky', 'tall'],
  military: ['standard', 'chunky'],
  cyber: ['slim', 'standard'],
  nature: ['standard', 'tall'],
  fantasy: ['standard', 'slim', 'chunky', 'tall'],
};

// ─── 랜덤 선택 헬퍼 ───

/** Math.random 기반 배열 요소 랜덤 선택 */
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** PRNG 함수 기반 배열 요소 선택 */
function seededPick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

/** PRNG 함수 기반 범위 내 정수 */
function seededInt(max: number, rng: () => number): number {
  return Math.floor(rng() * max);
}

// ─── 공개 API ───

/**
 * 랜덤 CubelingAppearance 생성 (Math.random 기반)
 * 테마 카테고리로 제약된 랜덤화
 *
 * @param category 테마 카테고리 (기본: 'all')
 * @returns 완전한 CubelingAppearance 객체
 */
export function generateRandomAppearance(category: RandomCategory = 'all'): CubelingAppearance {
  const colors = CATEGORY_COLOR_POOLS[category];
  const patterns = CATEGORY_PATTERN_POOLS[category];
  const equip = CATEGORY_EQUIP_POOLS[category];
  const bodies = CATEGORY_BODY_POOLS[category];

  return {
    bodyType: pick(bodies),
    bodySize: 'medium',
    skinTone: Math.floor(Math.random() * 12),
    eyeStyle: Math.floor(Math.random() * 12),
    mouthStyle: Math.floor(Math.random() * 8),
    marking: 0,
    topColor: pick(colors.top),
    bottomColor: pick(colors.bottom),
    pattern: pick(patterns),
    hairStyle: Math.floor(Math.random() * 16),
    hairColor: Math.floor(Math.random() * 16),
    hat: pick(equip.hat),
    weapon: pick(equip.weapon),
    backItem: pick(equip.back),
    footwear: pick(equip.foot),
    trailEffect: 0,
    auraEffect: category === 'all'
      ? Math.floor(Math.random() * 6)
      : (Math.random() < 0.3 ? Math.floor(Math.random() * 6) : 0),
    emote: 0,
    spawnEffect: 0,
  };
}

/**
 * 시드 기반 결정적 CubelingAppearance 생성
 * 같은 시드 → 동일한 외형 보장 (봇, 재현, 리플레이 등에 활용)
 *
 * @param seed 숫자 시드 또는 문자열 (문자열은 해시 변환)
 * @param category 테마 카테고리 (기본: 'all')
 * @returns 결정적 CubelingAppearance 객체
 */
export function generateSeededAppearance(
  seed: number | string,
  category: RandomCategory = 'all',
): CubelingAppearance {
  const numericSeed = typeof seed === 'string' ? stringToSeed(seed) : seed;
  const rng = mulberry32(numericSeed);

  const colors = CATEGORY_COLOR_POOLS[category];
  const patterns = CATEGORY_PATTERN_POOLS[category];
  const equip = CATEGORY_EQUIP_POOLS[category];
  const bodies = CATEGORY_BODY_POOLS[category];

  return {
    bodyType: seededPick(bodies, rng),
    bodySize: 'medium',
    skinTone: seededInt(12, rng),
    eyeStyle: seededInt(12, rng),
    mouthStyle: seededInt(8, rng),
    marking: 0,
    topColor: seededPick(colors.top, rng),
    bottomColor: seededPick(colors.bottom, rng),
    pattern: seededPick(patterns, rng),
    hairStyle: seededInt(16, rng),
    hairColor: seededInt(16, rng),
    hat: seededPick(equip.hat, rng),
    weapon: seededPick(equip.weapon, rng),
    backItem: seededPick(equip.back, rng),
    footwear: seededPick(equip.foot, rng),
    trailEffect: 0,
    auraEffect: category === 'all'
      ? seededInt(6, rng)
      : (rng() < 0.3 ? seededInt(6, rng) : 0),
    emote: 0,
    spawnEffect: 0,
  };
}

/**
 * 사용 가능한 랜덤 카테고리 목록
 */
export const RANDOM_CATEGORIES: readonly { id: RandomCategory; label: string; icon: string }[] = [
  { id: 'all',      label: 'ALL',  icon: '\u{1F3B2}' },
  { id: 'military', label: 'MIL',  icon: '\u{1F396}' },
  { id: 'cyber',    label: 'CYB',  icon: '\u{1F4BB}' },
  { id: 'nature',   label: 'NAT',  icon: '\u{1F33F}' },
  { id: 'fantasy',  label: 'FAN',  icon: '\u{2728}'  },
] as const;
