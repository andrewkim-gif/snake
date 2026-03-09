/**
 * game/rendering/projectiles/index.ts - 투사체 렌더링 모듈
 *
 * 투사체 및 특수 이펙트 렌더링을 관리합니다.
 * drawProjectile은 rendering.ts에서 facade 역할을 하며,
 * 개별 무기 렌더러는 weapons/ 폴더에서 모듈화됩니다.
 */

export type { ProjectileRenderData, ProjectileRenderer } from './types';
export { SKILL_TYPES } from './types';

// Effects
export { drawLightningBolt } from './effects';

// Weapon Renderers (v4.5 완전 모듈화)
export {
  // Melee (4개)
  drawWhipProjectile,
  drawPunchProjectile,
  drawAxeProjectile,
  drawSwordProjectile,
  // Ranged (6개)
  drawKnife,
  drawBow,
  drawPing,
  drawShard,
  drawAirdrop,
  drawFork,
  // Magic (4개)
  drawWand,
  drawBible,
  drawGarlic,
  drawPool,
  // Special (3개)
  drawBridge,
  drawBeam,
  drawLaser,
} from './weapons';

// 메인 투사체 렌더링: rendering.ts의 drawProjectile가 dispatcher 역할
