/**
 * game/rendering/characters/index.ts - 캐릭터 렌더링 모듈
 */

// Types
export type {
  PlayerClass,
  HairStyle,
  EyeStyle,
  AccessoryType,
  CharacterColors,
  CharacterStyle,
  RenderSkinColors,
  AnimationState,
} from './types';

// Constants
export {
  HEAD_SIZE,
  HEAD_Y,
  BODY_WIDTH,
  BODY_HEIGHT,
  LIMB_WIDTH,
  LIMB_LENGTH,
  EYE_X,
  EYE_Y,
  FACE_WIDTH,
  JAW_EXTEND,
  OUTLINE_WIDTH,
  WALK_PERIOD,
  IDLE_PERIOD,
  BREATHE_PERIOD,
  CAT_CANVAS_BASE_SIZE,
} from './constants';

// Styles
export {
  CHARACTER_STYLES,
  CHARACTER_COLORS,
  HAIR_REPLACING_ACCESSORIES,
  SPECIAL_HAIR_STYLES,
  getCharacterStyle,
  getCharacterColors,
  adjustHairForAccessory,
} from './styles';

// Utils
export {
  darkenColor,
  lightenColor,
  drawRoundedRect,
  drawLimb,
  easeInOutQuad,
  easeInOutCubic,
} from './utils';

// Animation
export {
  calculateWalkAnimation,
  calculateIdleAnimation,
  calculateAnimationState,
} from './animation';
export type { AnimationInput } from './animation';

// Parts (v4.5 파트별 렌더링 확장)
export {
  // Head
  drawHeadBase,
  drawEars,
  drawBlush,
  type HeadRenderParams,
  // Eyes
  drawEyes,
  drawDotEyes,
  drawDeterminedEyes,
  drawTarotEyes,
  drawLineEyes,
  drawAngryEyes,
  shouldBlink,
  type EyeRenderParams,
  // Hair (v4.5)
  drawHair,
  drawSkull,
  drawBangs,
  drawHairDetail,
  drawHelmet,
  drawFireHelmet,
  type HairRenderParams,
  // Body (v4.5)
  drawBody,
  drawBodyBase,
  drawOutfitStyle,
  drawPattern,
  drawCape,
  type BodyRenderParams,
  // Accessories (v4.5)
  drawAccessory,
  drawHeadband,
  drawHood,
  drawScarf,
  drawCrown,
  drawChefHat,
  drawRibbon,
  drawEarring,
  drawGlasses,
  drawSunglasses,
  drawMedal,
  type AccessoryRenderParams,
} from './parts';
