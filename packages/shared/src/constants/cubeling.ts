/**
 * cubeling.ts — 큐블링 캐릭터 상수 모듈
 * 색상 팔레트, 스킨톤, 눈/입 스타일, 장비 정의, 프리셋
 * Three.js 의존 없음 (shared 패키지)
 */

import type { BodyType, CubelingAppearance } from '../types/appearance';

// ─── 색상 팔레트: 비비드 팝 (12색) ───

/** MC의 차분한 톤 대신 비비드 팝아트 팔레트 */
export const VIVID_PALETTE = [
  '#FF4444', // 0: Hot Red
  '#FF8844', // 1: Tangerine
  '#FFDD44', // 2: Sunshine
  '#44DD44', // 3: Lime
  '#4488FF', // 4: Sky Blue
  '#AA44FF', // 5: Violet
  '#F0F0F0', // 6: Cloud White
  '#333333', // 7: Charcoal
  '#FF88AA', // 8: Bubblegum
  '#44DDDD', // 9: Cyan
  '#AA6644', // 10: Cocoa
  '#88DDAA', // 11: Mint
] as const;

// ─── 스킨톤 팔레트 (12종) ───

/** 다양한 피부톤 팔레트 */
export const SKIN_TONES = [
  '#FFE0BD', // 0: Light Peach
  '#FFCD94', // 1: Peach
  '#EAC086', // 2: Warm Beige
  '#D4A574', // 3: Sand (MC 기본 유사)
  '#C68642', // 4: Caramel
  '#A0724A', // 5: Tawny
  '#8D5524', // 6: Sienna
  '#6B3A1F', // 7: Chocolate
  '#4A2512', // 8: Dark Brown
  '#F5CFA0', // 9: Cream
  '#DEB887', // 10: Burlywood
  '#D2B48C', // 11: Tan
] as const;

// ─── 머리카락 색상 (16색) ───

/** 머리카락 색상 팔레트 */
export const HAIR_COLORS = [
  '#1A1A1A', // 0: Jet Black
  '#3B2716', // 1: Dark Brown
  '#6B4423', // 2: Brown
  '#8B6914', // 3: Auburn
  '#D4A04A', // 4: Dirty Blonde
  '#F0D060', // 5: Blonde
  '#F5F5DC', // 6: Platinum
  '#FFFFFF', // 7: White
  '#C75B5B', // 8: Red
  '#FF8844', // 9: Ginger
  '#FF88AA', // 10: Pink
  '#AA44FF', // 11: Purple
  '#4488FF', // 12: Blue
  '#44DD44', // 13: Green
  '#44DDDD', // 14: Cyan
  '#888888', // 15: Gray
] as const;

// ─── 눈 스타일 정의 (12종) ───

/** 눈 스타일 정의 (3×2 픽셀 영역 기준) */
export interface EyeStyleDef {
  id: number;
  name: string;
  /** 픽셀 매핑: [x, y, colorKey] — 'b'=검정, 'w'=흰색, 'h'=하이라이트 */
  pixels: [number, number, string][];
}

/** 12종 눈 스타일 */
export const EYE_STYLES: readonly EyeStyleDef[] = [
  { id: 0, name: 'Default',  pixels: [[0,0,'w'],[1,0,'w'],[2,0,'w'],[0,1,'w'],[1,1,'b'],[2,1,'w']] },
  { id: 1, name: 'Angry',    pixels: [[0,0,'b'],[1,0,'w'],[2,0,'w'],[0,1,'w'],[1,1,'b'],[2,1,'w']] },
  { id: 2, name: 'Cute',     pixels: [[0,0,'h'],[1,0,'w'],[2,0,'w'],[0,1,'w'],[1,1,'b'],[2,1,'b']] },
  { id: 3, name: 'Cool',     pixels: [[0,0,'b'],[1,0,'b'],[2,0,'b'],[0,1,'b'],[1,1,'b'],[2,1,'b']] },
  { id: 4, name: 'Wink',     pixels: [[0,0,'w'],[1,0,'w'],[2,0,'w'],[0,1,'w'],[1,1,'b'],[2,1,'w']] },
  { id: 5, name: 'Dot',      pixels: [[1,1,'b']] },
  { id: 6, name: 'Sleepy',   pixels: [[0,1,'b'],[1,1,'b'],[2,1,'b']] },
  { id: 7, name: 'Star',     pixels: [[0,0,'g'],[1,0,'g'],[2,0,'g'],[0,1,'g'],[1,1,'g'],[2,1,'g']] },
  { id: 8, name: 'Heart',    pixels: [[0,0,'r'],[2,0,'r'],[0,1,'r'],[1,1,'r'],[2,1,'r']] },
  { id: 9, name: 'XEyes',    pixels: [[0,0,'b'],[2,0,'b'],[1,1,'b'],[0,1,'b'],[2,1,'b']] },
  { id: 10, name: 'Visor',   pixels: [[0,0,'v'],[1,0,'v'],[2,0,'v'],[0,1,'v'],[1,1,'v'],[2,1,'v']] },
  { id: 11, name: 'Spiral',  pixels: [[0,0,'b'],[1,0,'b'],[2,0,'b'],[0,1,'b'],[2,1,'b']] },
] as const;

// ─── 입 스타일 정의 (8종) ───

/** 입 스타일 정의 (6×2 픽셀 영역 기준) */
export interface MouthStyleDef {
  id: number;
  name: string;
  /** 픽셀 매핑: [x, y, colorKey] — 'd'=어두운 피부톤 */
  pixels: [number, number, string][];
}

/** 8종 입 스타일 */
export const MOUTH_STYLES: readonly MouthStyleDef[] = [
  { id: 0, name: 'Smile',   pixels: [[1,0,'d'],[2,0,'d'],[3,0,'d'],[4,0,'d'],[0,1,'d'],[5,1,'d']] },
  { id: 1, name: 'Neutral', pixels: [[1,0,'d'],[2,0,'d'],[3,0,'d'],[4,0,'d']] },
  { id: 2, name: 'Grin',    pixels: [[0,0,'d'],[1,0,'d'],[2,0,'d'],[3,0,'d'],[4,0,'d'],[5,0,'d'],[0,1,'d'],[1,1,'w'],[2,1,'w'],[3,1,'w'],[4,1,'w'],[5,1,'d']] },
  { id: 3, name: 'Frown',   pixels: [[0,0,'d'],[5,0,'d'],[1,1,'d'],[2,1,'d'],[3,1,'d'],[4,1,'d']] },
  { id: 4, name: 'Open',    pixels: [[1,0,'d'],[2,0,'d'],[3,0,'d'],[4,0,'d'],[1,1,'d'],[2,1,'d'],[3,1,'d'],[4,1,'d']] },
  { id: 5, name: 'Fangs',   pixels: [[1,0,'w'],[4,0,'w'],[1,1,'d'],[2,1,'d'],[3,1,'d'],[4,1,'d']] },
  { id: 6, name: 'Cat',     pixels: [[0,0,'d'],[2,0,'d'],[3,0,'d'],[5,0,'d'],[1,1,'d'],[4,1,'d']] },
  { id: 7, name: 'Zigzag',  pixels: [[0,0,'d'],[2,0,'d'],[4,0,'d'],[1,1,'d'],[3,1,'d'],[5,1,'d']] },
] as const;

// ─── 바디 타입 스케일 팩터 ───

/** 바디 타입별 스케일 조정 계수 */
export const BODY_TYPE_SCALES: Record<BodyType, {
  bodyW: number;
  bodyH: number;
  armW: number;
  legW: number;
  limbH: number;
}> = {
  standard: { bodyW: 1.0, bodyH: 1.0, armW: 1.0, legW: 1.0, limbH: 1.0 },
  slim:     { bodyW: 0.85, bodyH: 1.0, armW: 0.75, legW: 0.9, limbH: 1.0 },
  chunky:   { bodyW: 1.15, bodyH: 1.0, armW: 1.1, legW: 1.1, limbH: 1.0 },
  tall:     { bodyW: 1.0, bodyH: 1.2, armW: 1.0, legW: 1.0, limbH: 1.15 },
} as const;

// ─── 장비 정의 ───

/** 장비 정의 인터페이스 */
export interface EquipmentDef {
  id: number;
  name: string;
  geometryType: string;
  baseColor: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
}

/** 모자 장비 (0=없음, 1~8) */
export const HAT_DEFS: readonly EquipmentDef[] = [
  { id: 1, name: 'Iron Helmet',   geometryType: 'helmet', baseColor: '#A0A0A0', rarity: 'common' },
  { id: 2, name: 'Gold Helmet',   geometryType: 'helmet', baseColor: '#FFD700', rarity: 'uncommon' },
  { id: 3, name: 'Diamond Helmet',geometryType: 'helmet', baseColor: '#55DDFF', rarity: 'rare' },
  { id: 4, name: 'Wizard Hat',    geometryType: 'hat',    baseColor: '#AA44FF', rarity: 'uncommon' },
  { id: 5, name: 'Crown',         geometryType: 'crown',  baseColor: '#FFD700', rarity: 'epic' },
  { id: 6, name: 'Pumpkin',       geometryType: 'helmet', baseColor: '#FF8844', rarity: 'rare' },
  { id: 7, name: 'Flower Crown',  geometryType: 'crown',  baseColor: '#FF88AA', rarity: 'common' },
  { id: 8, name: 'Viking Horns',  geometryType: 'hat',    baseColor: '#AA6644', rarity: 'uncommon' },
] as const;

/** 무기 장비 (0=없음, 1~6) */
export const WEAPON_DEFS: readonly EquipmentDef[] = [
  { id: 1, name: 'Diamond Sword', geometryType: 'blade', baseColor: '#55DDFF', rarity: 'rare' },
  { id: 2, name: 'Iron Axe',      geometryType: 'blade', baseColor: '#A0A0A0', rarity: 'common' },
  { id: 3, name: 'Magic Staff',   geometryType: 'staff', baseColor: '#AA44FF', rarity: 'uncommon' },
  { id: 4, name: 'Trident',       geometryType: 'staff', baseColor: '#44DDDD', rarity: 'rare' },
  { id: 5, name: 'Torch',         geometryType: 'staff', baseColor: '#FF8844', rarity: 'common' },
  { id: 6, name: 'Bow',           geometryType: 'blade', baseColor: '#AA6644', rarity: 'uncommon' },
] as const;

/** 등 장비 (0=없음, 1~5) */
export const BACK_ITEM_DEFS: readonly EquipmentDef[] = [
  { id: 1, name: 'Red Cape',     geometryType: 'cape',  baseColor: '#FF4444', rarity: 'common' },
  { id: 2, name: 'Angel Wings',  geometryType: 'wings', baseColor: '#F0F0F0', rarity: 'epic' },
  { id: 3, name: 'Ender Wings',  geometryType: 'wings', baseColor: '#AA44FF', rarity: 'rare' },
  { id: 4, name: 'Backpack',     geometryType: 'pack',  baseColor: '#AA6644', rarity: 'common' },
  { id: 5, name: 'Quiver',       geometryType: 'pack',  baseColor: '#8B6914', rarity: 'uncommon' },
] as const;

/** 신발 장비 (0=없음, 1~8) */
export const FOOTWEAR_DEFS: readonly EquipmentDef[] = [
  { id: 1, name: 'Iron Boots',    geometryType: 'boots', baseColor: '#A0A0A0', rarity: 'common' },
  { id: 2, name: 'Gold Boots',    geometryType: 'boots', baseColor: '#FFD700', rarity: 'uncommon' },
  { id: 3, name: 'Diamond Boots', geometryType: 'boots', baseColor: '#55DDFF', rarity: 'rare' },
  { id: 4, name: 'Speed Shoes',   geometryType: 'boots', baseColor: '#FF8844', rarity: 'uncommon' },
  { id: 5, name: 'Sandals',       geometryType: 'boots', baseColor: '#D2B48C', rarity: 'common' },
  { id: 6, name: 'Lava Boots',    geometryType: 'boots', baseColor: '#FF4444', rarity: 'rare' },
  { id: 7, name: 'Leaf Shoes',    geometryType: 'boots', baseColor: '#44DD44', rarity: 'common' },
  { id: 8, name: 'Frost Boots',   geometryType: 'boots', baseColor: '#88DDFF', rarity: 'epic' },
] as const;

// ─── 패턴 정의 ───

/** 의상 패턴 메타데이터 */
export interface PatternDef {
  id: number;
  name: string;
}

export const PATTERN_DEFS: readonly PatternDef[] = [
  { id: 0, name: 'solid' },
  { id: 1, name: 'striped' },
  { id: 2, name: 'dotted' },
  { id: 3, name: 'gradient' },
  { id: 4, name: 'checker' },
  { id: 5, name: 'camo' },
  { id: 6, name: 'zigzag' },
  { id: 7, name: 'heart' },
] as const;

// ─── 프리셋 캐릭터 (8종) ───

/** 큐블링 프리셋 정의 */
export interface CubelingPreset {
  id: string;
  name: string;
  appearance: CubelingAppearance;
  description: string;
}

/** 8개 테마 프리셋 — 빠른 시작용 완성 캐릭터 */
export const CHARACTER_PRESETS: readonly CubelingPreset[] = [
  {
    id: 'soldier', name: 'Soldier',
    description: 'Camo veteran',
    appearance: {
      bodyType: 'chunky', bodySize: 'large',
      skinTone: 5, eyeStyle: 1, mouthStyle: 3, marking: 0,
      topColor: 3, bottomColor: 7, pattern: 5,   // lime + charcoal, camo
      hairStyle: 0, hairColor: 0,                  // buzz, black
      hat: 1, weapon: 2, backItem: 4, footwear: 1, // iron helmet, iron axe, backpack, iron boots
      trailEffect: 0, auraEffect: 0, emote: 0, spawnEffect: 0,
    },
  },
  {
    id: 'hacker', name: 'Hacker',
    description: 'Cyber infiltrator',
    appearance: {
      bodyType: 'slim', bodySize: 'medium',
      skinTone: 0, eyeStyle: 10, mouthStyle: 1, marking: 0,
      topColor: 7, bottomColor: 7, pattern: 0,    // charcoal + charcoal, solid
      hairStyle: 15, hairColor: 0,                  // cap (hoodie), black
      hat: 0, weapon: 0, backItem: 4, footwear: 4, // none, none, backpack (keyboard), speed shoes
      trailEffect: 0, auraEffect: 0, emote: 0, spawnEffect: 0,
    },
  },
  {
    id: 'scientist', name: 'Scientist',
    description: 'Lab researcher',
    appearance: {
      bodyType: 'standard', bodySize: 'medium',
      skinTone: 2, eyeStyle: 3, mouthStyle: 0, marking: 0,
      topColor: 6, bottomColor: 6, pattern: 0,    // white + white, solid (lab coat)
      hairStyle: 14, hairColor: 1,                  // bald, dark brown
      hat: 0, weapon: 3, backItem: 0, footwear: 0, // none, magic staff (test tube), none, none
      trailEffect: 0, auraEffect: 0, emote: 0, spawnEffect: 0,
    },
  },
  {
    id: 'ninja', name: 'Ninja',
    description: 'Shadow assassin',
    appearance: {
      bodyType: 'slim', bodySize: 'small',
      skinTone: 4, eyeStyle: 1, mouthStyle: 1, marking: 0,
      topColor: 7, bottomColor: 7, pattern: 0,    // charcoal + charcoal, solid
      hairStyle: 5, hairColor: 0,                   // mohawk, black
      hat: 0, weapon: 1, backItem: 0, footwear: 4, // none, diamond sword (katana), none, speed shoes
      trailEffect: 1, auraEffect: 0, emote: 0, spawnEffect: 0,
    },
  },
  {
    id: 'pilot', name: 'Pilot',
    description: 'Sky commander',
    appearance: {
      bodyType: 'standard', bodySize: 'medium',
      skinTone: 3, eyeStyle: 3, mouthStyle: 0, marking: 0,
      topColor: 10, bottomColor: 7, pattern: 0,   // cocoa (leather jacket) + charcoal, solid
      hairStyle: 2, hairColor: 3,                   // side, auburn
      hat: 1, weapon: 0, backItem: 0, footwear: 1, // iron helmet (flight helmet), none, none, iron boots
      trailEffect: 0, auraEffect: 0, emote: 0, spawnEffect: 0,
    },
  },
  {
    id: 'medic', name: 'Medic',
    description: 'Field surgeon',
    appearance: {
      bodyType: 'standard', bodySize: 'medium',
      skinTone: 1, eyeStyle: 2, mouthStyle: 0, marking: 0,
      topColor: 6, bottomColor: 6, pattern: 1,    // white + white, striped (medical)
      hairStyle: 7, hairColor: 8,                   // ponytail, red
      hat: 0, weapon: 0, backItem: 4, footwear: 0, // none, none, backpack (medkit), none
      trailEffect: 0, auraEffect: 0, emote: 0, spawnEffect: 0,
    },
  },
  {
    id: 'pirate', name: 'Pirate',
    description: 'Sea raider',
    appearance: {
      bodyType: 'chunky', bodySize: 'medium',
      skinTone: 5, eyeStyle: 4, mouthStyle: 5, marking: 0,
      topColor: 0, bottomColor: 10, pattern: 1,   // red + cocoa, striped
      hairStyle: 12, hairColor: 0,                  // shaggy, black
      hat: 8, weapon: 1, backItem: 0, footwear: 5, // viking horns (pirate hat), diamond sword (hook), none, sandals
      trailEffect: 0, auraEffect: 0, emote: 0, spawnEffect: 0,
    },
  },
  {
    id: 'robot', name: 'Robot',
    description: 'Steel automaton',
    appearance: {
      bodyType: 'chunky', bodySize: 'large',
      skinTone: 11, eyeStyle: 10, mouthStyle: 1, marking: 0,
      topColor: 6, bottomColor: 6, pattern: 4,    // white + white, checker (metallic)
      hairStyle: 1, hairColor: 15,                  // spiky (antenna), gray
      hat: 3, weapon: 0, backItem: 0, footwear: 1, // diamond helmet (visor), none, none, iron boots
      trailEffect: 0, auraEffect: 1, emote: 0, spawnEffect: 0,
    },
  },
] as const;
