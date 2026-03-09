/**
 * game/rendering/characters/styles.ts - 캐릭터별 스타일 및 색상
 */

import type { PlayerClass, CharacterColors, CharacterStyle, RenderSkinColors } from './types';

// 캐릭터별 기본 스타일
export const CHARACTER_STYLES: Record<PlayerClass, CharacterStyle> = {
  neo: { hair: 'neo_slick', acc: 'none', eye: 'svg_tall' },
  tank: { hair: 'helmet', acc: 'none', eye: 'angry' },
  cypher: { hair: 'slick', acc: 'none', eye: 'angry' },
  morpheus: { hair: 'fire_helmet', acc: 'none', eye: 'angry' },
  niobe: { hair: 'bob', acc: 'none', eye: 'angry' },
  trinity: { hair: 'long', acc: 'none', eye: 'angry' },
  oracle: { hair: 'short', acc: 'none', eye: 'angry' },
  mouse: { hair: 'short', acc: 'none', eye: 'angry' },
  dozer: { hair: 'short', acc: 'none', eye: 'angry' },
};

// 캐릭터별 기본 색상 팔레트
export const CHARACTER_COLORS: Record<PlayerClass, CharacterColors> = {
  neo: {
    skin: '#f2e4d7',
    hair: '#1f2120',
    top: '#374151',
    pants: '#1f2937',
    shoes: '#111827',
    acc: '#374151',
  },
  tank: {
    skin: '#f5d0a9',
    hair: '#2d1810',
    top: '#fbbf24',
    pants: '#78350f',
    shoes: '#451a03',
    acc: '#fbbf24',
  },
  cypher: {
    skin: '#ffe0bd',
    hair: '#4a2511',
    top: '#1e293b',
    pants: '#0f172a',
    shoes: '#000000',
    acc: '#000000',
  },
  morpheus: {
    skin: '#ffe0bd',
    hair: '#1a1a2e',
    top: '#ea580c',
    pants: '#9a3412',
    shoes: '#1e293b',
    acc: '#fbbf24',
  },
  niobe: {
    skin: '#f5e6d3',
    hair: '#4c1d95',
    top: '#7c3aed',
    pants: '#4c1d95',
    shoes: '#2e1065',
    acc: '#8b5cf6',
  },
  trinity: {
    skin: '#ffe0bd',
    hair: '#0a0a0f',
    top: '#e9d5ff',
    pants: '#c4b5fd',
    shoes: '#a78bfa',
    acc: '#a855f7',
  },
  oracle: {
    skin: '#ffe0bd',
    hair: '#1a1a2e',
    top: '#94a3b8',
    pants: '#475569',
    shoes: '#334155',
    acc: '#cbd5e1',
  },
  mouse: {
    skin: '#ffe0bd',
    hair: '#1a1a2e',
    top: '#94a3b8',
    pants: '#475569',
    shoes: '#334155',
    acc: '#cbd5e1',
  },
  dozer: {
    skin: '#ffe0bd',
    hair: '#1a1a2e',
    top: '#94a3b8',
    pants: '#475569',
    shoes: '#334155',
    acc: '#cbd5e1',
  },
};

// 머리 대체형 악세서리 (헬멧류)
export const HAIR_REPLACING_ACCESSORIES = ['helmet', 'fire_helmet'];

// 특수 헤어 스타일 (헬멧 착용 시 기본 머리로 변경)
export const SPECIAL_HAIR_STYLES = ['short_bangs', 'slick', 'bob', 'long'];

/**
 * 캐릭터 스타일 가져오기
 */
export function getCharacterStyle(playerClass: PlayerClass): CharacterStyle {
  return CHARACTER_STYLES[playerClass] || CHARACTER_STYLES.neo;
}

/**
 * 캐릭터 색상 가져오기 (스킨 적용 포함)
 */
export function getCharacterColors(
  playerClass: PlayerClass,
  skinColors?: RenderSkinColors
): CharacterColors {
  if (skinColors) {
    return {
      skin: skinColors.skin || '#ffe0bd',
      hair: skinColors.hair,
      top: skinColors.body,
      pants: skinColors.pants,
      shoes: skinColors.shoes || '#1a1a1a',
      acc: skinColors.accent,
    };
  }
  return CHARACTER_COLORS[playerClass] || CHARACTER_COLORS.neo;
}

/**
 * 헬멧 착용 시 헤어 스타일 조정
 */
export function adjustHairForAccessory(
  style: CharacterStyle,
  accessoryType?: string
): CharacterStyle {
  if (accessoryType && HAIR_REPLACING_ACCESSORIES.includes(accessoryType)) {
    if (SPECIAL_HAIR_STYLES.includes(style.hair)) {
      return { ...style, hair: 'short' };
    }
  }
  return style;
}
