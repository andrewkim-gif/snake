/**
 * game/rendering/projectiles/weapons/index.ts - 무기별 렌더러 모듈
 *
 * 카테고리별 무기 렌더링 함수를 export합니다.
 */

// ===== Melee Weapons (근접 무기) =====
export {
  drawWhipProjectile,
  drawPunchProjectile,
  drawAxeProjectile,
  drawSwordProjectile,
  type MeleeWeaponParams,
} from './melee';

// ===== Ranged Weapons (원거리 무기) =====
export {
  drawKnife,
  drawBow,
  drawPing,
  drawShard,
  drawAirdrop,
  drawFork,
} from './ranged';

// ===== Magic Weapons (마법/영역 무기) =====
export {
  drawWand,
  drawBible,
  drawGarlic,
  drawPool,
} from './magic';

// ===== Special Weapons (특수 무기) =====
export {
  drawBridge,
  drawBeam,
  drawLaser,
} from './special';
