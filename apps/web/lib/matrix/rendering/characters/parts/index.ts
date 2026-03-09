/**
 * game/rendering/characters/parts/index.ts - 캐릭터 파트별 렌더링
 *
 * 캐릭터의 각 부위를 독립적으로 렌더링하는 함수들
 */

// Head
export {
  drawHeadBase,
  drawEars,
  drawBlush,
  type HeadRenderParams,
} from './head';

// Eyes
export {
  drawEyes,
  drawDotEyes,
  drawDeterminedEyes,
  drawTarotEyes,
  drawLineEyes,
  drawAngryEyes,
  shouldBlink,
  type EyeRenderParams,
} from './eyes';

// Hair
export {
  drawHair,
  drawSkull,
  drawBangs,
  drawHairDetail,
  drawHelmet,
  drawFireHelmet,
  type HairRenderParams,
} from './hair';

// Body
export {
  drawBody,
  drawBodyBase,
  drawOutfitStyle,
  drawPattern,
  drawCape,
  type BodyRenderParams,
} from './body';

// Accessories
export {
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
} from './accessories';

// 향후 추가 예정
// - limbs.ts: 팔, 다리 렌더링
