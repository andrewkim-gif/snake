/**
 * game/rendering/characters/types.ts - 캐릭터 렌더링 타입
 */

// PlayerClass는 기존 types.ts에서 재사용 (저장 데이터 호환성)
// ID: validator, miner, trader... (코드용)
// Display: NEO, TANK, CYPHER... (UI용, CLASS_DATA에서 관리)
export type { PlayerClass } from '../../types';

export type HairStyle =
  | 'short' | 'short_bangs' | 'slick' | 'neo_slick'
  | 'bob' | 'long' | 'spiky' | 'fluffy'
  | 'helmet' | 'fire_helmet';

export type EyeStyle =
  | 'dot' | 'angry' | 'happy' | 'determined'
  | 'tarot' | 'line' | 'svg_tall';

export type AccessoryType =
  | 'none' | 'headband' | 'glasses' | 'crown'
  | 'chef_hat' | 'ribbon' | 'helmet' | 'fire_helmet';

export interface CharacterColors {
  skin: string;
  hair: string;
  top: string;
  pants: string;
  shoes: string;
  acc: string;
}

export interface CharacterStyle {
  hair: HairStyle;
  acc: AccessoryType;
  eye: EyeStyle;
}

export interface RenderSkinColors {
  skin?: string;
  hair: string;
  body: string;
  pants: string;
  shoes?: string;
  accent: string;
  accessoryType?: AccessoryType;
  pattern?: string;
  patternColor?: string;
  glowEffect?: string;
}

export interface AnimationState {
  isMoving: boolean;
  time: number;
  dir: number;
  bounceY: number;
  legAngleL: number;
  legAngleR: number;
  armAngleL: number;
  armAngleR: number;
  bodyRotate: number;
  scaleX: number;
  scaleY: number;
  eyeOffsetX: number;
  headRotate: number;
}
