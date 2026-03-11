/**
 * skin-system.ts — 스킨 색상 시스템 (S17)
 *
 * 72종 skin (캐릭터당 8개) → 3D material color override
 * Pattern skins (stripes, dots 등) → 간단한 색상 변형으로 구현
 * Runtime skin 변경 API 제공
 *
 * 스킨 데이터는 skins.config.ts의 Skin.colors를 참조하여
 * 3D 캐릭터 모델의 CharacterColors로 변환합니다.
 */

import type { Skin, PlayerClass } from '../types';
import { SKINS } from '../config/skins.config';
import type { CharacterColors } from './character-models';
import { updateCharacterColors, type CharacterParts } from './character-models';
import { getClassColors } from './character-config';

// ============================================
// 타입 정의
// ============================================

/** 스킨 색상 오버라이드 (3D 모델에 적용할 색상) */
export interface SkinColorOverride {
  /** 머리/헤어 색상 */
  hair: string;
  /** 몸통/상의 색상 */
  body: string;
  /** 하의 색상 */
  pants: string;
  /** 신발 색상 */
  shoes: string;
  /** 액센트 색상 */
  accent: string;
  /** 패턴 타입 */
  pattern: string;
  /** 패턴 색상 (패턴 있을 때만) */
  patternColor?: string;
  /** 글로우 이펙트 */
  glowEffect: string;
}

/** 패턴 색상 변형 모디파이어 */
interface PatternModifier {
  /** body 색상에 적용할 밝기 변형 (0-1, 0.5=변화없음) */
  bodyBrightness: number;
  /** 패턴 색상 믹싱 비율 (0=원본, 1=패턴색) */
  patternMix: number;
}

// ============================================
// 패턴 모디파이어 맵
// ============================================

/** 패턴별 색상 변형 규칙 */
const PATTERN_MODIFIERS: Record<string, PatternModifier> = {
  none: { bodyBrightness: 0.5, patternMix: 0 },
  stripes: { bodyBrightness: 0.55, patternMix: 0.15 },
  dots: { bodyBrightness: 0.5, patternMix: 0.1 },
  gradient: { bodyBrightness: 0.6, patternMix: 0.2 },
  tech_logo: { bodyBrightness: 0.5, patternMix: 0.1 },
  circuit: { bodyBrightness: 0.45, patternMix: 0.25 },
  matrix_rain: { bodyBrightness: 0.4, patternMix: 0.3 },
  code: { bodyBrightness: 0.45, patternMix: 0.2 },
  binary: { bodyBrightness: 0.42, patternMix: 0.25 },
  data_flow: { bodyBrightness: 0.48, patternMix: 0.2 },
  sparkle: { bodyBrightness: 0.55, patternMix: 0.15 },
  flame: { bodyBrightness: 0.5, patternMix: 0.3 },
  ice: { bodyBrightness: 0.6, patternMix: 0.25 },
  lightning: { bodyBrightness: 0.45, patternMix: 0.3 },
  neon: { bodyBrightness: 0.4, patternMix: 0.35 },
  pixel: { bodyBrightness: 0.5, patternMix: 0.15 },
  hologram: { bodyBrightness: 0.55, patternMix: 0.3 },
  glitch: { bodyBrightness: 0.42, patternMix: 0.3 },
};

// ============================================
// 스킨 캐시 (성능 최적화)
// ============================================

/** skinId → SkinColorOverride 캐시 */
const skinOverrideCache = new Map<string, SkinColorOverride>();

/** skinId → CharacterColors 캐시 */
const skinCharacterColorsCache = new Map<string, CharacterColors>();

// ============================================
// 메인 API
// ============================================

/**
 * getSkinOverride — 스킨 ID로 3D 색상 오버라이드 가져오기
 * @param skinId 스킨 ID (e.g., 'neo_default', 'neo_agent')
 * @returns SkinColorOverride 또는 null (스킨 못 찾을 경우)
 */
export function getSkinOverride(skinId: string): SkinColorOverride | null {
  // 캐시 확인
  const cached = skinOverrideCache.get(skinId);
  if (cached) return cached;

  // 스킨 데이터 검색
  const skin = SKINS.find(s => s.id === skinId);
  if (!skin) return null;

  const override = skinToOverride(skin);
  skinOverrideCache.set(skinId, override);
  return override;
}

/**
 * getSkinCharacterColors — 스킨 ID → CharacterColors 변환
 * @param skinId 스킨 ID
 * @param playerClass 클래스 (fallback 색상용)
 * @returns CharacterColors
 */
export function getSkinCharacterColors(
  skinId: string | null | undefined,
  playerClass: PlayerClass
): CharacterColors {
  // 스킨 없으면 클래스 기본 색상
  if (!skinId) return getClassColors(playerClass);

  // 캐시 키: skinId + playerClass
  const cacheKey = `${skinId}:${playerClass}`;
  const cached = skinCharacterColorsCache.get(cacheKey);
  if (cached) return cached;

  const override = getSkinOverride(skinId);
  if (!override) return getClassColors(playerClass);

  const colors = overrideToCharacterColors(override, playerClass);
  skinCharacterColorsCache.set(cacheKey, colors);
  return colors;
}

/**
 * applySkinToCharacter — 캐릭터 파트에 스킨 색상 적용 (runtime 변경)
 * @param parts 캐릭터 파트
 * @param skinId 스킨 ID (null이면 클래스 기본)
 * @param playerClass 클래스
 */
export function applySkinToCharacter(
  parts: CharacterParts,
  skinId: string | null | undefined,
  playerClass: PlayerClass
): void {
  const colors = getSkinCharacterColors(skinId, playerClass);
  updateCharacterColors(parts, colors);
}

/**
 * clearSkinCache — 스킨 캐시 초기화 (메모리 해제)
 */
export function clearSkinCache(): void {
  skinOverrideCache.clear();
  skinCharacterColorsCache.clear();
}

// ============================================
// 내부 변환 함수
// ============================================

/** Skin → SkinColorOverride 변환 */
function skinToOverride(skin: Skin): SkinColorOverride {
  return {
    hair: skin.colors.hair,
    body: skin.colors.body,
    pants: skin.colors.pants,
    shoes: skin.colors.shoes,
    accent: skin.colors.accent,
    pattern: skin.colors.pattern,
    patternColor: skin.colors.patternColor,
    glowEffect: skin.colors.glowEffect,
  };
}

/** SkinColorOverride → CharacterColors 변환 (패턴 적용 포함) */
function overrideToCharacterColors(
  override: SkinColorOverride,
  playerClass: PlayerClass
): CharacterColors {
  const base = getClassColors(playerClass);

  // 패턴 모디파이어 적용
  const modifier = PATTERN_MODIFIERS[override.pattern] ?? PATTERN_MODIFIERS.none;
  let bodyColor = override.body;

  // 패턴이 있으면 body 색상에 패턴 색상 믹싱
  if (override.pattern !== 'none' && override.patternColor && modifier.patternMix > 0) {
    bodyColor = mixColors(override.body, override.patternColor, modifier.patternMix);
  }

  // 패턴 밝기 조정 (간단한 HSL 변환)
  if (modifier.bodyBrightness !== 0.5) {
    bodyColor = adjustBrightness(bodyColor, modifier.bodyBrightness);
  }

  return {
    head: override.hair || base.head,
    body: bodyColor || base.body,
    legs: override.pants || base.legs,
    arms: bodyColor || base.arms, // 팔은 body와 동일
    accent: override.accent || base.accent,
  };
}

// ============================================
// 색상 유틸리티
// ============================================

/** 두 hex 색상 믹싱 (0=color1, 1=color2) */
function mixColors(color1: string, color2: string, t: number): string {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);
  if (!c1 || !c2) return color1;

  const r = Math.round(c1.r + (c2.r - c1.r) * t);
  const g = Math.round(c1.g + (c2.g - c1.g) * t);
  const b = Math.round(c1.b + (c2.b - c1.b) * t);

  return rgbToHex(r, g, b);
}

/** hex 색상 밝기 조정 (0=어둡게, 0.5=유지, 1=밝게) */
function adjustBrightness(hex: string, factor: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const adjust = (v: number) => {
    if (factor < 0.5) {
      // 어둡게 (0→0%, 0.5→100%)
      return Math.round(v * (factor * 2));
    } else {
      // 밝게 (0.5→100%, 1→200% capped)
      const f = 1 + (factor - 0.5) * 2;
      return Math.min(255, Math.round(v * f));
    }
  };

  return rgbToHex(adjust(rgb.r), adjust(rgb.g), adjust(rgb.b));
}

/** hex → RGB 변환 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

/** RGB → hex 변환 */
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
