




/**
 * rendering.ts - 게임 렌더링 함수들
 * GameCanvas에서 추출된 순수 렌더링 함수들
 *
 * 리팩토링: game/rendering/ 모듈로 점진적 분리 중
 */

import { Player, Enemy, Vector2, Obstacle } from './types';
// STAGE_CONFIGS removed for Arena mode - using default arena colors
import { getTerrainAtGrid } from './config/obstacles.config';

// Default arena background colors (Matrix theme)
const ARENA_BACKGROUND_COLORS = {
  floorTile: '#0a0a12',
  nodeTile: '#0f0f1a',
  grid: 'rgba(0, 255, 65, 0.15)',
};
import { ENEMY_SIZE_SCALE } from './config/enemies.config';

// ===== 모듈화된 렌더링 함수 import =====
import {
  // Render Context (Performance Optimization)
  updateRenderContext,
  getLOD,
  getFrameTime,
  shouldUseShadow,
  // v5.0 LOD helpers (투사체/파티클/폭발 최적화용)
  shouldUseGradient,
  shouldUseGlow,
  shouldUseComplexShapes,
  getSimplifiedColor,
  getTotalEntityCount,
  getProjectileCount,
  getParticleCount,
  // Stress test mode
  setStressTestMode,
  isStressTestMode,
  getAvgFrameTime,
  getStressTestFPS,
  // Enemies (새 모듈에서 import)
  drawGlitch as drawModuleGlitch,
  drawBot as drawModuleBot,
  drawMalware as drawModuleMalware,
  drawWhale as drawModuleWhale,
  drawSniper as drawModuleSniper,
  drawCaster as drawModuleCaster,
  drawArtillery as drawModuleArtillery,
  drawBitling as drawModuleBitling,
  drawSpammer as drawModuleSpammer,
  drawCrypter as drawModuleCrypter,
  drawRansomer as drawModuleRansomer,
  drawPixel as drawModulePixel,
  drawBug as drawModuleBug,
  drawWorm as drawModuleWorm,
  drawAdware as drawModuleAdware,
  drawMutant as drawModuleMutant,
  drawPolymorphic as drawModulePolymorphic,
  drawTrojan as drawModuleTrojan,
  drawBotnet as drawModuleBotnet,
  drawRootkit as drawModuleRootkit,
  drawApt as drawModuleApt,
  drawZeroday as drawModuleZeroday,
  drawSkynet as drawModuleSkynet,
  // Bosses - REMOVED for Arena mode
  // 모든 적 타입 통합 렌더러 (150개 스테이지별 몬스터 포함)
  drawEnemyProcedural,
  // Terrain (v4.5 모듈화)
  drawTerrainByType,
  type TerrainParams,
  // Characters/Parts (v4.6 모듈화)
  drawAccessory,
  type AccessoryRenderParams,
  // Projectiles/Weapons (v4.7 모듈화 - 17개 무기)
  drawKnife as drawModuleKnife,
  drawBow as drawModuleBow,
  drawPing as drawModulePing,
  drawShard as drawModuleShard,
  drawAirdrop as drawModuleAirdrop,
  drawFork as drawModuleFork,
  drawWand as drawModuleWand,
  drawBible as drawModuleBible,
  drawGarlic as drawModuleGarlic,
  drawPool as drawModulePool,
  drawBridge as drawModuleBridge,
  drawBeam as drawModuleBeam,
  drawLaser as drawModuleLaser,
  // Melee (v4.7 추가)
  drawWhipProjectile as drawModuleWhip,
  drawPunchProjectile as drawModulePunch,
  drawAxeProjectile as drawModuleAxe,
  drawSwordProjectile as drawModuleSword,
} from './rendering/index';

// =====================
// RE-EXPORT ENEMY FUNCTIONS (모듈에서 import → 원래 이름으로 export)
// =====================
export {
  drawModuleGlitch as drawGlitch,
  drawModuleBot as drawBot,
  drawModuleMalware as drawMalware,
  drawModuleWhale as drawWhale,
  drawModuleSniper as drawSniper,
  drawModuleCaster as drawCaster,
  drawModuleArtillery as drawArtillery,
  drawModuleBitling as drawBitling,
  drawModuleSpammer as drawSpammer,
  drawModuleCrypter as drawCrypter,
  drawModuleRansomer as drawRansomer,
  drawModulePixel as drawPixel,
  drawModuleBug as drawBug,
  drawModuleWorm as drawWorm,
  drawModuleAdware as drawAdware,
  drawModuleMutant as drawMutant,
  drawModulePolymorphic as drawPolymorphic,
  drawModuleTrojan as drawTrojan,
  drawModuleBotnet as drawBotnet,
  drawModuleRootkit as drawRootkit,
  drawModuleApt as drawApt,
  drawModuleZeroday as drawZeroday,
  drawModuleSkynet as drawSkynet,
};

// =====================
// BOSS RENDERING STUB (Arena Mode)
// =====================

/**
 * drawBossProcedural - Stub for Arena mode
 * Boss system is disabled, this is a no-op for backward compatibility
 */
export const drawBossProcedural = (
  _ctx: CanvasRenderingContext2D,
  _bossId: string | number,
  _time: number,
  _isHit: boolean
): void => {
  // No-op in Arena mode - boss system disabled
};

// =====================
// COLOR UTILITIES
// =====================

/**
 * 색상 밝기 조절
 */
export const adjustColor = (hex: string, amt: number): string => {
  let usePound = false;
  if (hex[0] === '#') {
    hex = hex.slice(1);
    usePound = true;
  }
  let num = parseInt(hex, 16);
  let r = (num >> 16) + amt;
  if (r > 255) r = 255;
  else if (r < 0) r = 0;
  let b = ((num >> 8) & 0x00ff) + amt;
  if (b > 255) b = 255;
  else if (b < 0) b = 0;
  let g = (num & 0x0000ff) + amt;
  if (g > 255) g = 255;
  else if (g < 0) g = 0;
  return (usePound ? '#' : '') + (g | (b << 8) | (r << 16)).toString(16).padStart(6, '0');
};

// =====================
// ENVIRONMENT DRAWING
// =====================

// 스테이지별 지형지물 유형 (학교 테마)
type TerrainType = 'classroom' | 'cafeteria' | 'gym' | 'science' | 'admin' | 'escape' | 'singularity';

const getTerrainType = (stageId: number): TerrainType => {
  if (stageId >= 999) return 'singularity';  // 한계돌파 모드
  if (stageId <= 5) return 'classroom';      // Stage 1-5: 교실동
  if (stageId <= 10) return 'cafeteria';     // Stage 6-10: 급식실
  if (stageId <= 15) return 'gym';           // Stage 11-15: 체육관
  if (stageId <= 20) return 'science';       // Stage 16-20: 과학실
  if (stageId <= 25) return 'admin';         // Stage 21-25: 본관
  return 'escape';                            // Stage 26-30: 탈출
};

// 해시 기반 랜덤 (일관된 결과)
const seededRandom = (x: number, y: number, seed: number = 0): number => {
  return Math.abs(Math.sin(x * 12.9898 + y * 78.233 + seed * 43.7823) * 43758.5453) % 1;
};

// 스테이지별 지형지물 그리기 (v4.5 모듈화 - dispatcher)
/**
 * SCHOOL SURVIVOR - 학교 테마 지형지물 렌더링
 * 각 구역별 특색있는 오브젝트 디자인
 *
 * v4.5: 개별 terrain 모듈로 분리, 이 함수는 dispatcher 역할
 */
const drawTerrainFeature = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  terrain: TerrainType,
  hash: number,
  _stageId: number
): void => {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const time = Date.now() / 1000;

  // v4.5: 모듈화된 terrain dispatcher 사용
  drawTerrainByType(terrain, { ctx, cx, cy, hash, time });
};

// NOTE: Legacy terrain switch (810 lines) moved to game/rendering/environment/terrain/
// See: classroom.ts, cafeteria.ts, gym.ts, science.ts, admin.ts, escape.ts, singularity.ts

// === LEGACY CODE BLOCK REMOVED (v4.7) ===
// _drawTerrainFeatureLegacy 함수 808줄 삭제됨 - 모듈로 완전 이전

/**
 * 바닥 타일 그리기
 * @param skipTerrain - true면 지형지물 렌더링 스킵 (이소메트릭 모드에서 별도 처리용)
 */
export const drawFloorTile = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  type: 'node' | 'floor',
  stageId: number,
  skipTerrain: boolean = false
): void => {
  // Arena mode: use default Matrix theme colors
  const colors = ARENA_BACKGROUND_COLORS;
  const terrain = getTerrainType(stageId);
  const cellX = Math.floor(x / size);
  const cellY = Math.floor(y / size);
  const hash = seededRandom(cellX, cellY, stageId);

  // 기본 바닥
  ctx.fillStyle = type === 'floor' ? colors.floorTile : colors.nodeTile;
  ctx.fillRect(x, y, size, size);

  // 체커보드 패턴
  ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
  if ((cellX + cellY) % 2 === 0) {
    ctx.fillRect(x, y, size, size);
  }

  // 지형지물 렌더링 (skipTerrain이 false일 때만)
  if (!skipTerrain) {
    const terrainData = getTerrainAtGrid(cellX, cellY, stageId);
    if (terrainData) {
      const subtypeHash = (hash * 1000) % 1;
      drawTerrainFeature(ctx, x, y, size, terrain, subtypeHash, stageId);
    }
  }

  // 그리드 점
  ctx.fillStyle = colors.grid;
  ctx.fillRect(x + size - 2, y + size - 2, 2, 2);
};

/**
 * 지형지물만 그리기 (이소메트릭 모드에서 별도 렌더링용)
 */
export const drawTerrainOnly = (
  ctx: CanvasRenderingContext2D,
  cellX: number,
  cellY: number,
  size: number,
  stageId: number
): boolean => {
  const terrainData = getTerrainAtGrid(cellX, cellY, stageId);
  if (!terrainData) return false;

  const terrain = getTerrainType(stageId);
  const hash = seededRandom(cellX, cellY, stageId);
  const subtypeHash = (hash * 1000) % 1;

  // 타일 중앙 좌표 (0, 0 기준으로 그림 - 호출자가 translate 처리)
  drawTerrainFeature(ctx, -size/2, -size/2, size, terrain, subtypeHash, stageId);
  return true;
};

/**
 * 픽셀 장애물 그리기 (통합)
 */


// =====================
// UI DRAWING
// =====================

/**
 * 조이스틱 그리기
 */
export const drawJoystick = (
  ctx: CanvasRenderingContext2D,
  joystickState: { active: boolean; origin: Vector2; current: Vector2 }
): void => {
  if (!joystickState.active) return;
  const { origin, current } = joystickState;
  ctx.beginPath();
  ctx.arc(origin.x, origin.y, 40, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.fill();

  const dx = current.x - origin.x;
  const dy = current.y - origin.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  const maxLen = 40;
  const clampedLen = Math.min(len, maxLen);
  const nx = len > 0 ? dx / len : 0;
  const ny = len > 0 ? dy / len : 0;

  ctx.beginPath();
  ctx.arc(origin.x + nx * clampedLen, origin.y + ny * clampedLen, 20, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fill();
};

/**
 * 적 렌더링 (보스 포함)
 *
 * LOD (Level of Detail) 최적화:
 * - HIGH (<80 enemies): 풀 퀄리티
 * - MID (80-200): shadowBlur 제거, 단순화된 애니메이션
 * - LOW (>200): 단순 원형으로 대체 (80% 성능 향상)
 */
export const drawEnemy = (
  ctx: CanvasRenderingContext2D,
  enemy: Enemy,
  _stageConfigs?: unknown // Deprecated for Arena mode
): void => {
  const lod = getLOD();
  const frameTime = getFrameTime();

  // ===== LOD LOW: Ultra-simple rendering for 200+ enemies =====
  if (lod === 'low' && !enemy.isBoss) {
    ctx.save();
    ctx.translate(enemy.position.x, enemy.position.y);
    const isHit = enemy.state === 'stunned' || ((enemy as any).lastHitTime > frameTime - 150);
    const isDying = enemy.state === 'dying';

    if (isDying) {
      ctx.globalAlpha = enemy.deathScale ?? 0.5;
    }

    // v5.9.1: 그림자 먼저 그리기 (떠있는 느낌) - LOD LOW도 적용
    // 고정된 크기로 명확하게 보이도록 설정
    const enemyRadius = 10 * ENEMY_SIZE_SCALE;
    const floatHeight = 5;  // 몬스터가 떠있는 높이
    const shadowY = enemyRadius + floatHeight;  // 몬스터 발 아래
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(0, shadowY, 7, 2.5, 0, 0, Math.PI * 2);  // 60% 축소: 14x5
    ctx.fill();

    // 단순 원형 (색상만 유지) - v5.5: ENEMY_SIZE_SCALE 적용
    // 몬스터를 위로 올려서 떠있는 느낌
    ctx.fillStyle = isHit ? '#ffffff' : enemy.color;
    ctx.beginPath();
    ctx.arc(0, -floatHeight, enemyRadius, 0, Math.PI * 2);
    ctx.fill();

    // 최소한의 테두리 (구분용)
    ctx.strokeStyle = isHit ? '#ffffff' : adjustColor(enemy.color, -60);
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
    return;
  }

  // ===== LOD MID/HIGH: Normal rendering =====
  ctx.save();
  ctx.translate(enemy.position.x, enemy.position.y);
  const isHit = enemy.state === 'stunned' || ((enemy as any).lastHitTime > frameTime - 150);
  const isDying = enemy.state === 'dying';
  // v5.5: 보스가 아닌 일반 몬스터는 ENEMY_SIZE_SCALE 적용 (50% 축소)
  const scale = enemy.isBoss ? 2.0 : 1.44 * ENEMY_SIZE_SCALE;
  const dir = enemy.velocity.x >= 0 ? 1 : -1;

  // v5.9.1: 그림자 먼저 그리기 (떠있는 느낌) - 보스 제외, scale 전에 그림
  // 고정된 크기로 명확하게 보이도록 설정
  const floatOffset = enemy.isBoss ? 0 : 6;  // 몬스터가 떠있는 높이
  if (!enemy.isBoss) {
    // 스프라이트 크기 기반 그림자 위치 (scale 적용 후 약 12-15px)
    const spriteRadius = 12 * scale;  // 스케일 적용 후 대략적인 크기
    const shadowY = spriteRadius + floatOffset;  // 그림자는 바닥에
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(0, shadowY, 8, 3, 0, 0, Math.PI * 2);  // 60% 축소: 16x6
    ctx.fill();

    // 스프라이트를 위로 올려서 떠있는 느낌
    ctx.translate(0, -floatOffset);
  }

  // Death Animation 적용 (도파민 타격감!)
  const deathScale = enemy.deathScale ?? 1.0;
  const finalScale = scale * deathScale;

  ctx.scale(finalScale * dir, finalScale);

  if (isDying) {
    // 사망 시 투명도 + 붉은 틴트
    const deathProgress = 1 - deathScale;
    ctx.globalAlpha = Math.max(0.2, 1 - deathProgress * 1.5);

    // 회전 효과 (밀려나면서 뒹굴기)
    if (enemy.deathVelocity) {
      const spinAngle = (enemy.deathTimer ?? 0) * 15; // 빠른 회전
      ctx.rotate(spinAngle * (enemy.deathVelocity.x > 0 ? 1 : -1));
    }
  }

  const fillColor = isHit ? '#ffffff' : enemy.color;
  const shadeColor = isHit ? '#ffffff' : adjustColor(enemy.color, -40);
  const lightColor = isHit ? '#ffffff' : adjustColor(enemy.color, 40);

  // Arena mode: No boss rendering - all enemies use procedural rendering
  {
    // v6.0: 모든 일반 몬스터를 drawEnemyProcedural에 위임
    const renderData = {
      position: { x: 0, y: 0 },
      velocity: enemy.velocity,
      color: fillColor,
      enemyType: enemy.enemyType,
      state: enemy.state,
    };

    // v6.1: 외곽선은 drawEnemyProcedural 내부에서 처리
    drawEnemyProcedural(ctx, renderData, fillColor, shadeColor, isHit);
  }

  // 동결 이펙트 (얼음 오버레이)
  if (enemy.isFrozen && enemy.state === 'stunned') {
    ctx.restore();
    ctx.save();
    ctx.translate(enemy.position.x, enemy.position.y);
    ctx.scale(scale, scale);
    ctx.fillStyle = 'rgba(99, 102, 241, 0.5)';
    ctx.fillRect(-5, -8, 10, 16);
    ctx.strokeStyle = '#a5b4fc';
    ctx.lineWidth = 1;
    ctx.strokeRect(-5, -8, 10, 16);
    ctx.restore();
    ctx.save();
    ctx.translate(enemy.position.x, enemy.position.y);
  }

  // 상태이상 이펙트 (독/화상)
  if (enemy.statusEffects && enemy.statusEffects.length > 0) {
    ctx.restore();
    ctx.save();
    ctx.translate(enemy.position.x, enemy.position.y);

    for (const effect of enemy.statusEffects) {
      if (effect.type === 'poison') {
        // 독 이펙트 - 녹색 기포
        const bubbleCount = 3;
        const time = Date.now() / 300;
        ctx.fillStyle = 'rgba(34, 197, 94, 0.7)'; // 녹색
        for (let i = 0; i < bubbleCount; i++) {
          const offset = (time + i * 2) % 3;
          const x = Math.sin(i * 2.5 + time * 0.5) * 8;
          const y = -10 - offset * 8;
          const size = 3 - offset * 0.5;
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (effect.type === 'burning') {
        // 화상 이펙트 - 주황 불꽃
        const flameCount = 3;
        const time = Date.now() / 150;
        for (let i = 0; i < flameCount; i++) {
          const flicker = Math.sin(time + i * 1.5) * 2;
          const x = (i - 1) * 6;
          const y = -8 - Math.abs(flicker);
          ctx.fillStyle = i === 1 ? 'rgba(249, 115, 22, 0.9)' : 'rgba(234, 179, 8, 0.7)';
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x - 3, y + 8);
          ctx.lineTo(x + 3, y + 8);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
  }
  ctx.restore();
};

/**
 * Super Clean Voxel Cat Sprite Renderer
 * Style: Crossy Road (Vibrant, Blocky, Toy-like)
 */
// Cached OffscreenCanvas for 2-pass outline rendering (scale별 분리)
interface CatCanvasCache {
  outlineCanvas: OffscreenCanvas;
  outlineCtx: OffscreenCanvasRenderingContext2D;
  silhouetteCanvas: OffscreenCanvas;
  silhouetteCtx: OffscreenCanvasRenderingContext2D;
}
const catCanvasCache = new Map<number, CatCanvasCache>();

/**
 * Voxel Style Obstacle Renderer
 * 블록체인 테마 장애물 - 다양한 크기와 타입 지원
 */
// 스킨 색상 타입 (SkinColors와 호환)
interface RenderSkinColors {
  body: string;
  pants: string;
  hair: string;
  accent: string;
  shoes?: string;
  skin?: string;
  accessory?: string;
  // 확장 스타일
  outfit?: string;       // OutfitStyle
  accessoryType?: string; // AccessoryType
  pattern?: string;      // PatternType
  patternColor?: string;
  glowEffect?: string;   // GlowEffect
}

export const drawCatSprite = (
  ctx: CanvasRenderingContext2D,
  p: Player,
  facing: Vector2,
  externalScale: number = 1,
  skinColors?: RenderSkinColors,
  frozenTime?: number  // Optional: 고정된 time 값 (첫 프레임 정지용)
): void => {
  /**
   * SURVIVOR.IO STYLE REDESIGN (VECTOR ART)
   * 2등신 비율, 굵은 외곽선, 단순화된 형태, 높은 채도
   */

  const effectiveCanvasSize = Math.ceil(46 * externalScale * 1.5);  // 80% 스케일 (58 * 0.8 = 46)

  // scale별 캔버스 캐시 사용 (게임/미리보기 분리)
  const scaleKey = Math.round(externalScale * 100); // 소수점 오차 방지
  let cache = catCanvasCache.get(scaleKey);
  if (!cache) {
    const outlineCanvas = new OffscreenCanvas(effectiveCanvasSize, effectiveCanvasSize);
    const outlineCtx = outlineCanvas.getContext('2d');
    const silhouetteCanvas = new OffscreenCanvas(effectiveCanvasSize, effectiveCanvasSize);
    const silhouetteCtx = silhouetteCanvas.getContext('2d');
    if (!outlineCtx || !silhouetteCtx) return;
    cache = { outlineCanvas, outlineCtx, silhouetteCanvas, silhouetteCtx };
    catCanvasCache.set(scaleKey, cache);
  }

  const { outlineCanvas: catOutlineCanvas, outlineCtx: catOutlineCtx, silhouetteCanvas: catSilhouetteCanvas, silhouetteCtx: catSilhouetteCtx } = cache;
  const offCtx = catOutlineCtx;
  offCtx.clearRect(0, 0, effectiveCanvasSize, effectiveCanvasSize);
  offCtx.globalAlpha = 1.0; // save() 전에 초기화! (restore 시에도 1.0 유지)
  offCtx.save();
  offCtx.translate(effectiveCanvasSize / 2, effectiveCanvasSize / 2 + 4 * externalScale);  // 80% 스케일
  offCtx.scale(externalScale, externalScale);

  // === Animation State ===
  const isMoving = Math.abs(p.velocity.x) > 0.1 || Math.abs(p.velocity.y) > 0.1;
  const time = frozenTime !== undefined ? frozenTime : Date.now();
  const dir = facing.x >= 0 ? 1 : -1;

  // === MATRIX STYLE ANIMATION ===
  // 이징 함수: 천천히 → 빠르게 → 천천히
  const easeInOutQuad = (t: number) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const easeInOutCubic = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  let bounceY = 0;
  let legAngleL = 0;
  let legAngleR = 0;
  let armAngleL = 0;
  let armAngleR = 0;
  let bodyRotate = 0;
  let scaleX = 1;
  let scaleY = 1;
  let eyeOffsetX = 0; // 눈동자 좌우 오프셋 (둘러보기용)
  let headRotate = 0; // 머리 회전 (둘러보기용, 도 단위)

  if (isMoving) {
    // === MATRIX WALK: 천천히 → 빠르게 → 천천히 ===
    const walkPeriod = 600; // 한 걸음 주기 (ms)
    const walkProgress = (time % walkPeriod) / walkPeriod; // 0~1

    // 이징 적용: 발을 내딛을 때 빠르게, 착지할 때 천천히
    const easedProgress = easeInOutCubic(walkProgress);
    const walkAngle = easedProgress * Math.PI * 2;

    // 다리: 부드럽게 번갈아 움직임
    legAngleL = Math.sin(walkAngle) * 25;
    legAngleR = Math.sin(walkAngle + Math.PI) * 25;

    // 팔: 다리와 반대로, 더 작은 움직임
    armAngleL = Math.sin(walkAngle + Math.PI) * 15;
    armAngleR = Math.sin(walkAngle) * 15;

    // 몸통: 미세한 기울임만
    bodyRotate = Math.sin(walkAngle) * 2;

    // 바운스 최소화 (매트릭스는 부드럽게 미끄러지듯)
    bounceY = Math.abs(Math.sin(walkAngle)) * 0.8;

    // Speed Boost Visual (속도 배율에 따른 스트레치)
    const speedMult = p.statMultipliers?.speed || 1;
    if (speedMult > 1.0) {
      const boostLevel = Math.min((speedMult - 1) / 0.5, 1);
      scaleX = 1 + boostLevel * 0.08;
      scaleY = 1 - boostLevel * 0.04;
    }
  } else {
    // === IDLE: 차분한 숨쉬기 (45도 측면 뷰 - 눈/머리 회전 없음) ===
    const breatheCycle = (time / 2000) * Math.PI * 2; // 2초 주기 호흡
    const breathe = Math.sin(breatheCycle);

    // 호흡에 따른 미세한 움직임
    scaleY = 1 + breathe * 0.008;
    bounceY = breathe * 0.3;

    // 팔은 항상 자연스럽게 내림
    armAngleL = 2 + breathe * 0.5;
    armAngleR = -2 - breathe * 0.5;

    // 45도 측면 뷰: 눈/머리 회전 없음 (고정)
    eyeOffsetX = 0;
    headRotate = 0;

    // 다리는 미세한 체중 이동
    const weightShift = Math.sin(breatheCycle * 0.3) * 0.8;
    legAngleL = weightShift;
    legAngleR = -weightShift;
  }

  // === Phase 1-1: Hit Reaction (피격 리액션) - v2: 5등신 최적화 ===
  // squash 0.25 → 0.15, tilt 12° → 8° (과장 줄임)
  if (p.hitReaction?.active && p.hitReaction.timer > 0) {
    const HIT_REACT_DURATION = 0.15;
    const progress = 1 - (p.hitReaction.timer / HIT_REACT_DURATION);
    const easeOut = 1 - Math.pow(1 - progress, 3);
    const intensity = p.hitReaction.intensity || 0.5;

    // Squash & Stretch: 5등신에 맞게 축소 (0.25 → 0.15)
    const squashAmount = (1 - easeOut) * 0.15 * intensity;
    scaleX = 1 + squashAmount * 1.3;
    scaleY = 1 - squashAmount;

    // Tilt away from hit direction: 5등신에 맞게 축소 (12° → 8°)
    const hitDir = p.hitReaction.direction;
    if (hitDir) {
      bodyRotate += (1 - easeOut) * 8 * intensity * (hitDir.x > 0 ? -1 : 1);
    }

    // Bounce back: 약간 축소
    bounceY -= (1 - easeOut) * 3 * intensity;
  }

  // === Phase 1-2: Attack Animation (공격 애니메이션) - v2: 5등신 최적화 ===
  // 모든 각도와 바운스 값을 5등신 비율에 맞게 축소
  if (p.attackAnim?.active && p.attackAnim.timer > 0) {
    const progress = 1 - (p.attackAnim.timer / p.attackAnim.duration);
    const attack = Math.sin(progress * Math.PI); // 0->1->0 curve

    switch (p.attackAnim.weaponType) {
      case 'punch':
        // -80° → -65°, bodyRotate 15° → 12°
        armAngleR = -65 * attack;
        bodyRotate += 12 * attack;
        bounceY -= 1.5 * attack;
        break;
      case 'whip':
        // 100° → 85°, bodyRotate -20° → -15°
        armAngleR = 85 * attack;
        bodyRotate -= 15 * attack;
        break;
      case 'wand':
      case 'knife':
      case 'bow':
        // -35° → -28°
        armAngleR = -28 * (1 - attack);
        bounceY += attack * 1; // 반동 축소
        break;
      case 'bible':
      case 'garlic':
        // 150° → 120°
        armAngleL = 120 * attack;
        armAngleR = -120 * attack;
        scaleY *= (1 - 0.05 * attack);
        bounceY += 2 * attack;
        break;
      case 'lightning':
        // -80° → -65°
        armAngleR = -65 * attack;
        bounceY += 1 * attack;
        break;
      default:
        // 기본 공격 모션: -40° → -32°
        armAngleR = -32 * attack;
        break;
    }
  }

  // === Phase 2-2: Special Skill Animation (궁극기 포즈) ===
  if (p.specialAnim && p.specialAnim > 0) {
    const sp = p.specialAnim; // 0-1 progress

    switch (p.playerClass) {
      case 'neo': // 전교생 집합!
        armAngleL = -140 * sp;
        armAngleR = 140 * sp;
        bounceY = -6 * sp;
        scaleY = 1 + 0.15 * sp;
        break;
      case 'tank': // 지진 점프!
        bounceY = sp < 0.6 ? 12 * sp : -3 * (1 - sp);
        scaleY = sp > 0.6 ? 0.75 : 1;
        armAngleL = -25;
        armAngleR = 25;
        break;
      case 'cypher': // 번개 질주
        scaleX = 1 + 0.4 * sp;
        scaleY = 1 - 0.15 * sp;
        break;
      case 'morpheus': // 방화벽!
        armAngleL = 80 * sp;
        armAngleR = -80 * sp;
        scaleY = 1 - 0.1 * sp;
        break;
      case 'niobe': // 투명인간
        // opacity는 별도 처리 (offCtx.globalAlpha)
        scaleY = 0.9 + 0.1 * (1 - sp);
        break;
      default:
        armAngleL = -120 * sp;
        armAngleR = 120 * sp;
    }
  }

  // === Level Up Celebration ===
  if (p.levelUpAnim && p.levelUpAnim > 0) {
    const lup = p.levelUpAnim;
    if (lup < 0.3) {
      const phase = lup / 0.3;
      bounceY = -15 * phase;
      scaleY = 1 + 0.08 * phase;
    } else if (lup < 0.5) {
      bounceY = -15;
      armAngleL = -110 * ((lup - 0.3) / 0.2);
      armAngleR = 110 * ((lup - 0.3) / 0.2);
    } else {
      const phase = (lup - 0.5) / 0.5;
      bounceY = -15 * (1 - phase);
      scaleY = 1 - 0.12 * (1 - phase);
      armAngleL = -110 * (1 - phase);
      armAngleR = 110 * (1 - phase);
    }
  }

  // === Character Styles (3등신, 80% 스케일) ===
  // 3등신 비율: 머리 14, 몸통 9, 다리 6 = 총 ~29px
  const HEAD_SIZE = 14;  // 17 * 0.8 = 13.6 → 14

  // 3등신 체형 - 80% 스케일
  const BODY_WIDTH = 10;   // 13 * 0.8 = 10.4 → 10
  const BODY_HEIGHT = 9;   // 11 * 0.8 = 8.8 → 9
  const LIMB_WIDTH = 2;    // 3 * 0.8 = 2.4 → 2
  const LIMB_LENGTH = 6;   // 7 * 0.8 = 5.6 → 6

  // 캐릭터별 컬러 팔레트 및 파츠 설정
  let colors = {
    skin: '#ffe0bd',
    hair: '#2d3748',
    top: '#3b82f6',
    pants: '#1e3a5f',
    shoes: '#f97316',
    acc: '#ef4444'
  };
  let style = {
    hair: 'short',
    acc: 'headband',
    eye: 'dot'
  };

  // 캐릭터별 스타일 설정 (머리/눈/악세서리)
  switch (p.playerClass) {
    case 'neo':
      // NEO - 매트릭스 스타일 (뒤로 넘긴 머리, 이마 노출)
      style = { hair: 'neo_slick', acc: 'none', eye: 'svg_tall' };
      break;
    case 'tank':
      // TANK - NEO 기본 + 안전모 악세서리
      style = { hair: 'neo_slick', acc: 'safety_helmet', eye: 'svg_tall' };
      break;
    case 'cypher':
      style = { hair: 'slick', acc: 'none', eye: 'angry' };
      break;
    case 'morpheus':
      // MORPHEUS - NEO 기본 + 소방헬멧 + 선글라스
      style = { hair: 'neo_slick', acc: 'fire_helmet', eye: 'sunglasses' };
      break;
    case 'niobe':
      style = { hair: 'bob', acc: 'none', eye: 'angry' };
      break;
    case 'trinity':
      style = { hair: 'long', acc: 'none', eye: 'angry' };
      break;
    default:
      style = { hair: 'short', acc: 'none', eye: 'angry' };
      break;
  }

  // 스킨 색상이 전달되면 사용, 아니면 기본 색상 사용
  if (skinColors) {
    colors = {
      skin: skinColors.skin || '#ffe0bd',
      hair: skinColors.hair,
      top: skinColors.body,
      pants: skinColors.pants,
      shoes: skinColors.shoes || '#1a1a1a',
      acc: skinColors.accent
    };
    // 스킨의 accessoryType이 머리 대체형(헬멧류)일 경우에만 헤어 스타일 비활성화
    // === 머리 대체형 (머리 전체 덮음) ===
    // helmet, fire_helmet → 헤어 스타일을 'short'로 변경 (헬멧 아래 머리 안 보임)
    // === 머리 위 장식형 (머리카락과 공존) ===
    // crown, chef_hat, ribbon → 헤어 스타일 유지, 악세서리만 위에 그림
    const hairReplacingAccessories = ['helmet', 'fire_helmet'];
    if (skinColors.accessoryType && hairReplacingAccessories.includes(skinColors.accessoryType)) {
      // 헬멧류는 모든 특수 헤어 스타일을 기본 머리로 변경
      const specialHairStyles = ['short_bangs', 'slick', 'bob', 'long'];
      if (specialHairStyles.includes(style.hair)) {
        style.hair = 'short';
      }
    }
  } else {
    // 기본 색상 (스킨 미적용 시)
    switch (p.playerClass) {
      case 'neo':
        // NEO - 흰 셔츠 스타일
        colors = {
          skin: '#f2e4d7',      // 밝은 살색
          hair: '#1f2120',      // 검은 머리
          top: '#f8fafc',       // 흰 셔츠
          pants: '#1e293b',     // 네이비 바지
          shoes: '#111827',     // 검은 신발
          acc: '#64748b'        // 셔츠 칼라/단추용 (슬레이트)
        };
        break;
      case 'tank':
        colors = { skin: '#f5d0a9', hair: '#2d1810', top: '#fbbf24', pants: '#78350f', shoes: '#451a03', acc: '#fbbf24' };
        break;
      case 'cypher':
        colors = { skin: '#ffe0bd', hair: '#4a2511', top: '#1e293b', pants: '#0f172a', shoes: '#000000', acc: '#000000' };
        break;
      case 'morpheus':
        colors = { skin: '#ffe0bd', hair: '#1a1a2e', top: '#ea580c', pants: '#9a3412', shoes: '#1e293b', acc: '#fbbf24' };
        break;
      case 'niobe':
        colors = { skin: '#f5e6d3', hair: '#4c1d95', top: '#7c3aed', pants: '#4c1d95', shoes: '#2e1065', acc: '#8b5cf6' };
        break;
      case 'trinity':
        colors = { skin: '#ffe0bd', hair: '#0a0a0f', top: '#e9d5ff', pants: '#c4b5fd', shoes: '#a78bfa', acc: '#a855f7' };
        break;
      default:
        colors = { skin: '#ffe0bd', hair: '#1a1a2e', top: '#94a3b8', pants: '#475569', shoes: '#334155', acc: '#cbd5e1' };
        break;
    }
  }

  // === Color Utility Functions (카툰 쉐이딩용) ===
  const darkenColor = (hex: string, percent: number): string => {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, ((num >> 16) & 255) * (1 - percent));
    const g = Math.max(0, ((num >> 8) & 255) * (1 - percent));
    const b = Math.max(0, (num & 255) * (1 - percent));
    return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
  };

  // Helper for rounded rect (음영 없이 기본색만)
  const drawRoundedRect = (ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, color: string) => {
    const left = x - w / 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(left, y, w, h, r);
    ctx.fill();
  };

  // Limb - 둥근 사각형 (3등신 스타일)
  const drawLimb = (ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, x: number, y: number, angle: number, color: string) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle * Math.PI / 180);

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-LIMB_WIDTH / 2, 0, LIMB_WIDTH, LIMB_LENGTH, LIMB_WIDTH / 2);
    ctx.fill();

    ctx.restore();
  };

  // === GLOW EFFECT (후광 효과) - 캐릭터 렌더링 전에 그림 ===
  const glowEffect = skinColors?.glowEffect || 'none';
  if (glowEffect !== 'none') {
    const time = Date.now();
    const pulse = Math.sin(time / 500) * 0.2 + 0.8; // 0.6~1.0 펄스
    let glowColor = '';
    let glowSize = 0;

    switch (glowEffect) {
      case 'blue':
        glowColor = `rgba(59, 130, 246, ${0.3 * pulse})`;
        glowSize = 25;
        break;
      case 'purple':
        glowColor = `rgba(168, 85, 247, ${0.35 * pulse})`;
        glowSize = 30;
        break;
      case 'gold':
        glowColor = `rgba(234, 179, 8, ${0.4 * pulse})`;
        glowSize = 35;
        break;
      case 'rainbow':
        const hue = (time / 20) % 360;
        glowColor = `hsla(${hue}, 80%, 60%, ${0.4 * pulse})`;
        glowSize = 40;
        break;
      case 'fire':
        const fireFlicker = Math.sin(time / 100) * 0.15 + 0.85;
        glowColor = `rgba(239, 68, 68, ${0.4 * fireFlicker})`;
        glowSize = 35;
        break;
      case 'electric':
        const electricFlicker = Math.random() > 0.7 ? 1 : 0.7;
        glowColor = `rgba(59, 130, 246, ${0.4 * electricFlicker})`;
        glowSize = 30;
        break;
      case 'holy':
        glowColor = `rgba(255, 255, 200, ${0.45 * pulse})`;
        glowSize = 45;
        break;
    }

    if (glowColor && glowSize > 0) {
      // 그라디언트 후광
      const gradient = offCtx.createRadialGradient(0, 10, 5, 0, 10, glowSize);
      gradient.addColorStop(0, glowColor);
      gradient.addColorStop(0.5, glowColor.replace(/[\d.]+\)$/, '0.15)'));
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      offCtx.fillStyle = gradient;
      offCtx.beginPath();
      offCtx.arc(0, 10, glowSize, 0, Math.PI * 2);
      offCtx.fill();
    }
  }

  // === RENDER START ===
  offCtx.scale(dir * scaleX, scaleY);
  offCtx.translate(0, -bounceY);
  offCtx.rotate(bodyRotate * Math.PI / 180);

  // Special transparency (zais 투명인간)
  if (p.specialAnim && p.specialAnim > 0 && p.playerClass === 'niobe') {
    offCtx.globalAlpha = 1 - p.specialAnim * 0.6; // 40%까지 투명
  }

  // 1. 팔/다리 (3등신 비율) - 기존 김도하/김도연 스타일
  const legX = 4;        // 다리 간격
  const armX = 7;        // 팔 위치
  const armY = 4;        // 팔 y 위치 (어깨)

  // 45도 측면 뷰: 팔/다리 위치는 고정 (dir과 무관)
  // 왼쪽(-X)이 앞, 오른쪽(+X)이 뒤
  const backLegX = legX;      // 뒤쪽 다리 (오른쪽)
  const backArmX = armX;      // 뒤쪽 팔 (오른쪽)
  const frontLegX = -legX;    // 앞쪽 다리 (왼쪽)
  const frontArmX = -armX;    // 앞쪽 팔 (왼쪽)

  // 0. 망토 (가장 뒤에 그려야 함) - cape accessory
  const accessoryType = skinColors?.accessoryType || 'none';
  const accColor = skinColors?.accessory || colors.acc;
  if (accessoryType === 'cape') {
    offCtx.fillStyle = accColor;
    const capeTime = Date.now();
    const capeWave = Math.sin(capeTime / 200) * 2;
    offCtx.beginPath();
    // 몸통 뒤에서 시작해서 다리 중간까지 (키보다 짧게)
    // BODY_HEIGHT + 5 = 20px (다리 끝 ~24px보다 짧음)
    offCtx.moveTo(-BODY_WIDTH / 2 - 1, 0);
    offCtx.lineTo(-BODY_WIDTH / 2 - 4, BODY_HEIGHT + 5 + capeWave);
    offCtx.lineTo(BODY_WIDTH / 2 + 4, BODY_HEIGHT + 5 - capeWave);
    offCtx.lineTo(BODY_WIDTH / 2 + 1, 0);
    offCtx.closePath();
    offCtx.globalAlpha = 0.85;
    offCtx.fill();
    offCtx.globalAlpha = 1.0;
  }

  drawLimb(offCtx, backLegX, BODY_HEIGHT - 3, legAngleR, colors.pants); // 뒤쪽 다리 (45도 비틀기)
  drawLimb(offCtx, backArmX, armY, armAngleR, colors.top); // 뒤쪽 팔 (45도 비틀기)

  // 2. 앞쪽 다리 (몸통에 가려지도록 몸통 전에!)
  drawLimb(offCtx, frontLegX, BODY_HEIGHT - 3, legAngleL, colors.pants); // 앞쪽 다리 (45도 비틀기)

  // 3. 몸통 (다리 위에 덮음) - outfit 스타일에 따라 다르게 렌더링
  const bodyRound = 6;
  const outfitStyle = skinColors?.outfit || 'default';
  const patternType = skinColors?.pattern || 'none';
  const patternColor = skinColors?.patternColor || colors.acc;

  // 기본 몸통
  drawRoundedRect(offCtx, 0, 0, BODY_WIDTH, BODY_HEIGHT, bodyRound, colors.top);

  // === OUTFIT STYLE RENDERING ===
  if (outfitStyle === 'apron') {
    // 앞치마 - 몸통 위에 덮음
    const apronWidth = BODY_WIDTH + 2;
    const apronHeight = BODY_HEIGHT + 4;
    offCtx.fillStyle = colors.acc;
    // 앞치마 본체
    offCtx.beginPath();
    offCtx.roundRect(-apronWidth / 2, 2, apronWidth, apronHeight - 2, [0, 0, 4, 4]);
    offCtx.fill();
    // 앞치마 끈 (목에서)
    offCtx.fillStyle = colors.acc;
    offCtx.fillRect(-3, -2, 6, 4);
    // 주머니
    offCtx.fillStyle = darkenColor(colors.acc, 0.15);
    offCtx.fillRect(-4, 8, 8, 5);
  } else if (outfitStyle === 'chef') {
    // 쉐프복 - 하얀 더블 버튼 재킷
    offCtx.fillStyle = colors.acc;
    // 버튼 2열
    offCtx.beginPath();
    offCtx.arc(-3, 5, 1.5, 0, Math.PI * 2);
    offCtx.fill();
    offCtx.beginPath();
    offCtx.arc(3, 5, 1.5, 0, Math.PI * 2);
    offCtx.fill();
    offCtx.beginPath();
    offCtx.arc(-3, 10, 1.5, 0, Math.PI * 2);
    offCtx.fill();
    offCtx.beginPath();
    offCtx.arc(3, 10, 1.5, 0, Math.PI * 2);
    offCtx.fill();
  } else if (outfitStyle === 'wrestler') {
    // 레슬링복 - 어깨 스트랩
    offCtx.fillStyle = colors.acc;
    // 왼쪽 스트랩
    offCtx.beginPath();
    offCtx.moveTo(-BODY_WIDTH / 2, 0);
    offCtx.lineTo(-BODY_WIDTH / 4, -2);
    offCtx.lineTo(-BODY_WIDTH / 4, 4);
    offCtx.lineTo(-BODY_WIDTH / 2, 6);
    offCtx.closePath();
    offCtx.fill();
    // 오른쪽 스트랩
    offCtx.beginPath();
    offCtx.moveTo(BODY_WIDTH / 2, 0);
    offCtx.lineTo(BODY_WIDTH / 4, -2);
    offCtx.lineTo(BODY_WIDTH / 4, 4);
    offCtx.lineTo(BODY_WIDTH / 2, 6);
    offCtx.closePath();
    offCtx.fill();
  } else if (outfitStyle === 'firefighter') {
    // 소방복 - 반사띠
    offCtx.fillStyle = '#fbbf24';
    offCtx.fillRect(-BODY_WIDTH / 2, 6, BODY_WIDTH, 2);
    offCtx.fillRect(-BODY_WIDTH / 2, 11, BODY_WIDTH, 2);
  } else if (outfitStyle === 'suit' || outfitStyle === 'formal') {
    // 정장 - 넥타이와 라펠
    offCtx.fillStyle = colors.acc;
    // 넥타이
    offCtx.beginPath();
    offCtx.moveTo(0, 0);
    offCtx.lineTo(-2, 3);
    offCtx.lineTo(0, BODY_HEIGHT - 2);
    offCtx.lineTo(2, 3);
    offCtx.closePath();
    offCtx.fill();
    // 라펠
    offCtx.fillStyle = darkenColor(colors.top, 0.2);
    offCtx.beginPath();
    offCtx.moveTo(-BODY_WIDTH / 2, 0);
    offCtx.lineTo(-2, 5);
    offCtx.lineTo(-BODY_WIDTH / 2, 8);
    offCtx.closePath();
    offCtx.fill();
    offCtx.beginPath();
    offCtx.moveTo(BODY_WIDTH / 2, 0);
    offCtx.lineTo(2, 5);
    offCtx.lineTo(BODY_WIDTH / 2, 8);
    offCtx.closePath();
    offCtx.fill();
  } else if (outfitStyle === 'dress' || outfitStyle === 'party_dress') {
    // 드레스 - 치마 스커트 효과
    const skirtBottom = BODY_HEIGHT + 5;
    offCtx.fillStyle = colors.top;
    offCtx.beginPath();
    offCtx.moveTo(-BODY_WIDTH / 2, BODY_HEIGHT - 2);
    offCtx.lineTo(-BODY_WIDTH / 2 - 3, skirtBottom);
    offCtx.lineTo(BODY_WIDTH / 2 + 3, skirtBottom);
    offCtx.lineTo(BODY_WIDTH / 2, BODY_HEIGHT - 2);
    offCtx.closePath();
    offCtx.fill();
    // 리본/장식
    if (outfitStyle === 'party_dress') {
      offCtx.fillStyle = colors.acc;
      offCtx.beginPath();
      offCtx.ellipse(0, 3, 4, 2, 0, 0, Math.PI * 2);
      offCtx.fill();
    }
  } else if (outfitStyle === 'hero') {
    // 영웅 망토 - 어깨 패드
    offCtx.fillStyle = colors.acc;
    // 왼쪽 어깨 패드
    offCtx.beginPath();
    offCtx.ellipse(-BODY_WIDTH / 2 - 1, 2, 4, 3, -0.3, 0, Math.PI * 2);
    offCtx.fill();
    // 오른쪽 어깨 패드
    offCtx.beginPath();
    offCtx.ellipse(BODY_WIDTH / 2 + 1, 2, 4, 3, 0.3, 0, Math.PI * 2);
    offCtx.fill();
  } else if (outfitStyle === 'shirt') {
    // 흰 셔츠 - 단추만 (칼라 제거)
    const buttonColor = '#94a3b8';  // 단추 색상

    // 단추 3개 (세로줄)
    offCtx.fillStyle = buttonColor;
    offCtx.beginPath();
    offCtx.arc(0, 6, 1, 0, Math.PI * 2);
    offCtx.fill();
    offCtx.beginPath();
    offCtx.arc(0, 9, 1, 0, Math.PI * 2);
    offCtx.fill();
    offCtx.beginPath();
    offCtx.arc(0, 12, 1, 0, Math.PI * 2);
    offCtx.fill();
  }

  // === PATTERN RENDERING ===
  if (patternType !== 'none') {
    offCtx.save();
    offCtx.globalAlpha = 0.5;
    offCtx.fillStyle = patternColor;

    if (patternType === 'stripes') {
      // 줄무늬
      for (let i = 0; i < BODY_HEIGHT; i += 4) {
        offCtx.fillRect(-BODY_WIDTH / 2 + 1, i, BODY_WIDTH - 2, 1);
      }
    } else if (patternType === 'dots') {
      // 물방울
      for (let x = -4; x <= 4; x += 4) {
        for (let y = 3; y < BODY_HEIGHT - 2; y += 4) {
          offCtx.beginPath();
          offCtx.arc(x, y, 1, 0, Math.PI * 2);
          offCtx.fill();
        }
      }
    } else if (patternType === 'stars') {
      // 별
      const drawStar = (cx: number, cy: number, r: number) => {
        offCtx.beginPath();
        for (let i = 0; i < 5; i++) {
          const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
          const x = cx + Math.cos(angle) * r;
          const y = cy + Math.sin(angle) * r;
          if (i === 0) offCtx.moveTo(x, y);
          else offCtx.lineTo(x, y);
        }
        offCtx.closePath();
        offCtx.fill();
      };
      drawStar(0, 6, 2);
    } else if (patternType === 'flame') {
      // 불꽃
      offCtx.beginPath();
      offCtx.moveTo(0, BODY_HEIGHT - 4);
      offCtx.quadraticCurveTo(-3, BODY_HEIGHT - 8, 0, BODY_HEIGHT - 12);
      offCtx.quadraticCurveTo(3, BODY_HEIGHT - 8, 0, BODY_HEIGHT - 4);
      offCtx.fill();
    } else if (patternType === 'lightning') {
      // 번개
      offCtx.beginPath();
      offCtx.moveTo(2, 2);
      offCtx.lineTo(-2, 7);
      offCtx.lineTo(1, 7);
      offCtx.lineTo(-2, 12);
      offCtx.lineTo(3, 6);
      offCtx.lineTo(0, 6);
      offCtx.closePath();
      offCtx.fill();
    } else if (patternType === 'sparkle') {
      // 반짝이
      const sparklePositions = [[0, 5], [-4, 8], [3, 10]];
      sparklePositions.forEach(([sx, sy]) => {
        offCtx.beginPath();
        offCtx.moveTo(sx, sy - 2);
        offCtx.lineTo(sx + 1, sy);
        offCtx.lineTo(sx, sy + 2);
        offCtx.lineTo(sx - 1, sy);
        offCtx.closePath();
        offCtx.fill();
      });
    } else if (patternType === 'heart') {
      // 하트
      offCtx.beginPath();
      offCtx.moveTo(0, 8);
      offCtx.bezierCurveTo(-3, 5, -3, 3, 0, 5);
      offCtx.bezierCurveTo(3, 3, 3, 5, 0, 8);
      offCtx.fill();
    }
    offCtx.restore();
  }

  // 4. 머리
  offCtx.save();
  offCtx.translate(0, -2); // 목 위치

  // 머리 그림자 (목) - 회전 전에 그려서 고정
  offCtx.fillStyle = 'rgba(0,0,0,0.15)';
  offCtx.beginPath();
  offCtx.ellipse(0, 0, 7, 3, 0, 0, Math.PI * 2);
  offCtx.fill();

  // === 머리 회전 적용 (둘러보기) ===
  offCtx.save();
  offCtx.rotate(headRotate * Math.PI / 180);

  // 얼굴형 (둥근 사각형) with 2-step cartoon shading
  const HEAD_Y = -HEAD_SIZE + 7;  // 머리 1 더 내림 (6 → 7)
  const FACE_H = HEAD_SIZE * 0.75;  // 얼굴 높이 (짧게)
  const earY = HEAD_Y + FACE_H * 0.55;  // 얼굴 중간 옆에 귀 위치

  // ========================================
  // -1. 머리통 (두개골 형태) + 뒷머리
  // ========================================
  const skullRadius = HEAD_SIZE * 0.55;       // 머리통 반지름

  // 모든 캐릭터: NEO처럼 머리카락 색 머리통 그리기
  offCtx.fillStyle = colors.hair;
  offCtx.beginPath();
  offCtx.arc(0, HEAD_Y + HEAD_SIZE * 0.1, skullRadius, 0, Math.PI * 2);
  offCtx.fill();

  // 스타일별 추가 머리카락 (긴머리, 단발 등)
  if (style.hair === 'long') {
      // 긴머리: 양옆으로 길게 내려오는 머리
      const hairWidth = HEAD_SIZE / 2 + 2;
      const hairBottom = HEAD_Y + HEAD_SIZE + 6;

      // 왼쪽 긴 머리
      offCtx.beginPath();
      offCtx.moveTo(-HEAD_SIZE / 2, HEAD_Y + HEAD_SIZE * 0.3);
      offCtx.lineTo(-hairWidth, HEAD_Y + HEAD_SIZE * 0.4);
      offCtx.lineTo(-hairWidth, hairBottom);
      offCtx.quadraticCurveTo(-hairWidth + 2, hairBottom + 1, -HEAD_SIZE / 2, HEAD_Y + HEAD_SIZE);
      offCtx.closePath();
      offCtx.fill();

      // 오른쪽 긴 머리
      offCtx.beginPath();
      offCtx.moveTo(HEAD_SIZE / 2, HEAD_Y + HEAD_SIZE * 0.3);
      offCtx.lineTo(hairWidth, HEAD_Y + HEAD_SIZE * 0.4);
      offCtx.lineTo(hairWidth, hairBottom);
      offCtx.quadraticCurveTo(hairWidth - 2, hairBottom + 1, HEAD_SIZE / 2, HEAD_Y + HEAD_SIZE);
      offCtx.closePath();
      offCtx.fill();
    } else if (style.hair === 'bob') {
      // 단발: 옆머리 (턱까지)
      offCtx.beginPath();
      offCtx.moveTo(-HEAD_SIZE / 2, HEAD_Y + HEAD_SIZE * 0.3);
      offCtx.lineTo(-HEAD_SIZE / 2 - 1.5, HEAD_Y + HEAD_SIZE * 0.5);
      offCtx.lineTo(-HEAD_SIZE / 2 - 1.5, HEAD_Y + HEAD_SIZE - 1);
      offCtx.quadraticCurveTo(-HEAD_SIZE / 2 - 1, HEAD_Y + HEAD_SIZE, -HEAD_SIZE / 2 + 1, HEAD_Y + HEAD_SIZE);
      offCtx.closePath();
      offCtx.fill();

      offCtx.beginPath();
      offCtx.moveTo(HEAD_SIZE / 2, HEAD_Y + HEAD_SIZE * 0.3);
      offCtx.lineTo(HEAD_SIZE / 2 + 1.5, HEAD_Y + HEAD_SIZE * 0.5);
      offCtx.lineTo(HEAD_SIZE / 2 + 1.5, HEAD_Y + HEAD_SIZE - 1);
      offCtx.quadraticCurveTo(HEAD_SIZE / 2 + 1, HEAD_Y + HEAD_SIZE, HEAD_SIZE / 2 - 1, HEAD_Y + HEAD_SIZE);
      offCtx.closePath();
      offCtx.fill();
  }

  // 0. 귀 먼저 그리기 - 일본 애니메이션 스타일 (C자 형태 + 귓바퀴)
  const earX = HEAD_SIZE / 2 - 1;  // 얼굴 옆에 붙임 (턱 바로 옆)
  const earHeight = 8;  // 더 크게 (5 → 8)
  const earWidth = 4;   // 더 크게 (2.5 → 4)

  // === TRUE 45도 측면 뷰 (만화적 묘사) ===
  // dir=1(오른쪽 바라봄): 왼쪽 귀만 보임 (외곽), 오른쪽 귀는 얼굴에 가려서 안 보임
  // dir=-1(왼쪽 바라봄): 오른쪽 귀만 보임 (외곽), 왼쪽 귀는 얼굴에 가려서 안 보임
  const leftEarAlpha = dir > 0 ? 1 : 0;   // dir=1: 왼쪽 귀 100% 보임
  const rightEarAlpha = dir > 0 ? 0 : 1;  // dir=1: 오른쪽 귀 완전 숨김

  // === 왼쪽 귀 (일본 애니 스타일) ===
  offCtx.globalAlpha = leftEarAlpha;
  offCtx.fillStyle = colors.skin;
  offCtx.beginPath();
  // 외곽 헬릭스 - 큰 C자 (왼쪽은 반전)
  offCtx.moveTo(-earX, earY - earHeight / 2);
  offCtx.bezierCurveTo(
    -earX - earWidth, earY - earHeight / 3,  // 위쪽 볼록
    -earX - earWidth, earY + earHeight / 3,  // 아래쪽 볼록
    -earX, earY + earHeight / 2              // 끝점 (귓불)
  );
  // 귓바퀴로 돌아옴
  offCtx.bezierCurveTo(
    -earX - earWidth * 0.3, earY + earHeight / 4,
    -earX - earWidth * 0.3, earY - earHeight / 4,
    -earX, earY - earHeight / 2
  );
  offCtx.closePath();
  offCtx.fill();

  // 왼쪽 귓바퀴 내부 (어두운 살색)
  offCtx.fillStyle = darkenColor(colors.skin, 0.15);
  offCtx.beginPath();
  offCtx.moveTo(-earX - 0.3, earY - earHeight / 3);
  offCtx.bezierCurveTo(
    -earX - earWidth * 0.6, earY - earHeight / 4,
    -earX - earWidth * 0.6, earY + earHeight / 4,
    -earX - 0.3, earY + earHeight / 3
  );
  offCtx.bezierCurveTo(
    -earX - earWidth * 0.25, earY + earHeight / 5,
    -earX - earWidth * 0.25, earY - earHeight / 5,
    -earX - 0.3, earY - earHeight / 3
  );
  offCtx.closePath();
  offCtx.fill();

  // === 오른쪽 귀 (일본 애니 스타일) ===
  offCtx.globalAlpha = rightEarAlpha;
  offCtx.fillStyle = colors.skin;
  offCtx.beginPath();
  // 외곽 헬릭스 - 큰 C자
  offCtx.moveTo(earX, earY - earHeight / 2);
  offCtx.bezierCurveTo(
    earX + earWidth, earY - earHeight / 3,  // 위쪽 볼록
    earX + earWidth, earY + earHeight / 3,  // 아래쪽 볼록
    earX, earY + earHeight / 2              // 끝점 (귓불)
  );
  // 귓바퀴로 돌아옴
  offCtx.bezierCurveTo(
    earX + earWidth * 0.3, earY + earHeight / 4,
    earX + earWidth * 0.3, earY - earHeight / 4,
    earX, earY - earHeight / 2
  );
  offCtx.closePath();
  offCtx.fill();

  // 오른쪽 귓바퀴 내부 (어두운 살색)
  offCtx.fillStyle = darkenColor(colors.skin, 0.15);
  offCtx.beginPath();
  offCtx.moveTo(earX + 0.3, earY - earHeight / 3);
  offCtx.bezierCurveTo(
    earX + earWidth * 0.6, earY - earHeight / 4,
    earX + earWidth * 0.6, earY + earHeight / 4,
    earX + 0.3, earY + earHeight / 3
  );
  offCtx.bezierCurveTo(
    earX + earWidth * 0.25, earY + earHeight / 5,
    earX + earWidth * 0.25, earY - earHeight / 5,
    earX + 0.3, earY - earHeight / 3
  );
  offCtx.closePath();
  offCtx.fill();

  // globalAlpha 복원
  offCtx.globalAlpha = 1;

  // 얼굴 path 함수 - 45도 측면 뷰 비대칭
  const FACE_WIDTH = HEAD_SIZE / 2;  // 얼굴 너비
  const FACE_HEIGHT = FACE_H;        // 위에서 정의한 짧은 얼굴 높이 사용
  const JAW_WIDTH = FACE_WIDTH * 1.15;  // 턱 양옆으로 넓힘

  // 45도 비대칭: dir 방향이 더 넓게 보임
  const ASYM = dir * 0.25;  // 비대칭 정도 (25%)
  const LEFT_SCALE = 1 - ASYM;   // dir=1이면 0.75 (왼쪽 좁게)
  const RIGHT_SCALE = 1 + ASYM;  // dir=1이면 1.25 (오른쪽 넓게)
  const JAW_SHIFT = dir * 1.5;   // 턱 중심 이동

  const drawFacePath = () => {
    offCtx.beginPath();

    // 시작: 오른쪽 위 (이마)
    offCtx.moveTo(FACE_WIDTH * 0.8 * RIGHT_SCALE, HEAD_Y);

    // 1. 이마 - 비대칭
    offCtx.bezierCurveTo(
      FACE_WIDTH * 0.2, HEAD_Y - 1,
      -FACE_WIDTH * 0.4, HEAD_Y - 1,
      -FACE_WIDTH * 0.8 * LEFT_SCALE, HEAD_Y
    );

    // 2. 왼쪽 볼 - 좁게
    offCtx.bezierCurveTo(
      -FACE_WIDTH * 0.95 * LEFT_SCALE, HEAD_Y + FACE_HEIGHT * 0.25,
      -JAW_WIDTH * 0.9 * LEFT_SCALE, HEAD_Y + FACE_HEIGHT * 0.5,
      -JAW_WIDTH * 0.75 * LEFT_SCALE, HEAD_Y + FACE_HEIGHT * 0.8
    );

    // 3. 왼쪽 턱 → 턱 중앙 (중심 이동)
    offCtx.bezierCurveTo(
      -JAW_WIDTH * 0.5 * LEFT_SCALE, HEAD_Y + FACE_HEIGHT * 0.95,
      -JAW_WIDTH * 0.2 * LEFT_SCALE + JAW_SHIFT, HEAD_Y + FACE_HEIGHT,
      JAW_SHIFT, HEAD_Y + FACE_HEIGHT
    );

    // 4. 턱 중앙 → 오른쪽 턱 (넓게)
    offCtx.bezierCurveTo(
      JAW_WIDTH * 0.25 * RIGHT_SCALE + JAW_SHIFT, HEAD_Y + FACE_HEIGHT,
      JAW_WIDTH * 0.55 * RIGHT_SCALE, HEAD_Y + FACE_HEIGHT * 0.95,
      JAW_WIDTH * 0.75 * RIGHT_SCALE, HEAD_Y + FACE_HEIGHT * 0.75
    );

    // 5. 오른쪽 볼 → 이마 (넓게)
    offCtx.bezierCurveTo(
      JAW_WIDTH * 0.85 * RIGHT_SCALE, HEAD_Y + FACE_HEIGHT * 0.5,
      FACE_WIDTH * 0.9 * RIGHT_SCALE, HEAD_Y + FACE_HEIGHT * 0.2,
      FACE_WIDTH * 0.8 * RIGHT_SCALE, HEAD_Y
    );

    offCtx.closePath();
  };

  // 1. Base skin color (귀 위에 얼굴 덮음) - 음영/볼터치 제거
  offCtx.fillStyle = colors.skin;
  drawFacePath();
  offCtx.fill();

  // 눈 - HEAD_SIZE에 비례하여 위치 조정
  const EYE_Y = HEAD_Y + HEAD_SIZE * 0.45;
  const EYE_BASE_X = HEAD_SIZE * 0.25;  // 6px (머리 크기에 비례, HEAD_SIZE=24)

  // === 45도 측면 뷰: 눈 위치 ===
  // 양눈이 dir 방향으로 약간 치우침 (자연스럽게)
  const EYE_SHIFT = dir * 2;  // 2px만 이동 (subtle)
  const EYE_LEFT_X = -EYE_BASE_X * 0.7 + EYE_SHIFT;   // 왼쪽 눈
  const EYE_RIGHT_X = EYE_BASE_X * 0.7 + EYE_SHIFT;   // 오른쪽 눈

  // 입 - 눈 중앙에 위치 (EYE_SHIFT와 동일하게 이동)
  const MOUTH_Y = HEAD_Y + FACE_HEIGHT * 0.75;
  const MOUTH_X = EYE_SHIFT;  // 눈과 동일하게 이동
  offCtx.strokeStyle = '#1a1a2e';
  offCtx.lineWidth = 0.6;
  offCtx.lineCap = 'round';
  offCtx.beginPath();
  offCtx.moveTo(-0.8 + MOUTH_X, MOUTH_Y);
  offCtx.lineTo(0.8 + MOUTH_X, MOUTH_Y);
  offCtx.stroke();

  // 눈 크기 동일
  const LEFT_EYE_SCALE = 1;
  const RIGHT_EYE_SCALE = 1;

  // === 눈 깜빡임 애니메이션 ===
  // 4~6초마다 깜빡임 (자연스러운 빈도)
  const blinkSeed = (p.playerClass?.charCodeAt(0) || 0) * 1000;
  const blinkInterval = 4000 + (blinkSeed % 2000); // 4~6초 간격
  const blinkDuration = 150; // 150ms 깜빡임 (빠르게)
  const blinkPhase = (time + blinkSeed) % blinkInterval;

  // 깜빡임 (더블 블링크 제거 - 단일 깜빡임만)
  const isBlinking = blinkPhase < blinkDuration;
  const blinkProgress = isBlinking ? blinkPhase / blinkDuration : 0;
  // 부드러운 깜빡임: 0->1->0 (닫았다 열기)
  const blinkAmount = isBlinking ? Math.sin(blinkProgress * Math.PI) : 0;

  // 눈 크기 (세로 축소)
  const eyeScale = 0.95;
  const eyeHeightScale = 0.6;  // 세로 60%로 축소

  if (style.eye === 'line') {
    // 실눈 (3/4 뷰: 앞쪽 눈 크게, 뒤쪽 눈 작게)
    offCtx.strokeStyle = '#1a1a2e';
    offCtx.lineCap = 'round';
    // 뒤쪽 눈 (왼쪽 when dir=1)
    const leftLineThickness = 1.2 * eyeScale * LEFT_EYE_SCALE * (1 - blinkAmount * 0.8);
    offCtx.lineWidth = Math.max(0.2, leftLineThickness);
    offCtx.beginPath();
    offCtx.moveTo(EYE_LEFT_X - 1.2 * eyeScale * LEFT_EYE_SCALE, EYE_Y);
    offCtx.lineTo(EYE_LEFT_X + 1.2 * eyeScale * LEFT_EYE_SCALE, EYE_Y);
    offCtx.stroke();
    // 앞쪽 눈 (오른쪽 when dir=1)
    const rightLineThickness = 1.2 * eyeScale * RIGHT_EYE_SCALE * (1 - blinkAmount * 0.8);
    offCtx.lineWidth = Math.max(0.2, rightLineThickness);
    offCtx.beginPath();
    offCtx.moveTo(EYE_RIGHT_X - 1.2 * eyeScale * RIGHT_EYE_SCALE, EYE_Y);
    offCtx.lineTo(EYE_RIGHT_X + 1.2 * eyeScale * RIGHT_EYE_SCALE, EYE_Y);
    offCtx.stroke();
  } else if (style.eye === 'angry') {
    // 화난 눈 (3/4 뷰: 앞쪽 눈 크게, 뒤쪽 눈 작게)
    offCtx.fillStyle = '#1a1a2e';
    const angryEyeHeight = 1.2 * eyeHeightScale * (1 - blinkAmount * 0.9);
    // 뒤쪽 눈 (왼쪽 when dir=1)
    offCtx.beginPath();
    offCtx.ellipse(EYE_LEFT_X, EYE_Y, 1 * eyeScale * LEFT_EYE_SCALE, Math.max(0.2, angryEyeHeight * LEFT_EYE_SCALE), 0, 0, Math.PI * 2);
    offCtx.fill();
    // 앞쪽 눈 (오른쪽 when dir=1)
    offCtx.beginPath();
    offCtx.ellipse(EYE_RIGHT_X, EYE_Y, 1 * eyeScale * RIGHT_EYE_SCALE, Math.max(0.2, angryEyeHeight * RIGHT_EYE_SCALE), 0, 0, Math.PI * 2);
    offCtx.fill();
  } else if (style.eye === 'sunglasses') {
    // 매트릭스 모피어스 스타일 - 동그란 검은 선글라스
    const glassRadius = 2.5 * eyeScale;  // 원형 렌즈
    const bridgeY = EYE_Y;

    // 선글라스 프레임 (검은색)
    offCtx.fillStyle = '#0a0a0a';

    // 왼쪽 렌즈 (원형)
    offCtx.beginPath();
    offCtx.arc(EYE_LEFT_X, bridgeY, glassRadius, 0, Math.PI * 2);
    offCtx.fill();

    // 오른쪽 렌즈 (원형)
    offCtx.beginPath();
    offCtx.arc(EYE_RIGHT_X, bridgeY, glassRadius, 0, Math.PI * 2);
    offCtx.fill();

    // 브릿지 (코 연결 부분)
    offCtx.strokeStyle = '#0a0a0a';
    offCtx.lineWidth = 0.6;
    offCtx.beginPath();
    offCtx.moveTo(EYE_LEFT_X + glassRadius, bridgeY);
    offCtx.lineTo(EYE_RIGHT_X - glassRadius, bridgeY);
    offCtx.stroke();

    // 렌즈 반사광 (미세한 하이라이트)
    offCtx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    offCtx.beginPath();
    offCtx.arc(EYE_LEFT_X - 0.8, bridgeY - 0.8, 0.8, 0, Math.PI * 2);
    offCtx.fill();
    offCtx.beginPath();
    offCtx.arc(EYE_RIGHT_X - 0.8, bridgeY - 0.8, 0.8, 0, Math.PI * 2);
    offCtx.fill();
  } else if (style.eye === 'svg_tall') {
    // SVG 스타일: 약간 세로로 긴 눈 (3/4 뷰)
    offCtx.fillStyle = '#1a1a2e';
    const svgEyeHeight = 1.5 * eyeHeightScale * (1 - blinkAmount * 0.95);
    // 뒤쪽 눈
    offCtx.beginPath();
    offCtx.ellipse(EYE_LEFT_X, EYE_Y, 1 * eyeScale * LEFT_EYE_SCALE, Math.max(0.2, svgEyeHeight * LEFT_EYE_SCALE), 0, 0, Math.PI * 2);
    offCtx.fill();
    // 앞쪽 눈
    offCtx.beginPath();
    offCtx.ellipse(EYE_RIGHT_X, EYE_Y, 1 * eyeScale * RIGHT_EYE_SCALE, Math.max(0.2, svgEyeHeight * RIGHT_EYE_SCALE), 0, 0, Math.PI * 2);
    offCtx.fill();
  } else if (style.eye === 'shy') {
    // 수줍은 눈 (3/4 뷰)
    offCtx.fillStyle = '#1a1a2e';
    // 뒤쪽 눈
    const leftShyRadius = 0.8 * eyeScale * LEFT_EYE_SCALE * (1 - blinkAmount * 0.9);
    offCtx.beginPath();
    offCtx.arc(EYE_LEFT_X, EYE_Y, Math.max(0.2, leftShyRadius), 0, Math.PI * 2);
    offCtx.fill();
    // 앞쪽 눈
    const rightShyRadius = 0.8 * eyeScale * RIGHT_EYE_SCALE * (1 - blinkAmount * 0.9);
    offCtx.beginPath();
    offCtx.arc(EYE_RIGHT_X, EYE_Y, Math.max(0.2, rightShyRadius), 0, Math.PI * 2);
    offCtx.fill();
  } else if (style.eye === 'tarot') {
    // 타로 점술사 눈 (3/4 뷰)
    offCtx.fillStyle = '#1a1a2e';
    const tarotEyeHeight = 1 * eyeHeightScale * (1 - blinkAmount * 0.9);
    // 뒤쪽 눈
    offCtx.beginPath();
    offCtx.ellipse(EYE_LEFT_X, EYE_Y, 0.8 * eyeScale * LEFT_EYE_SCALE, Math.max(0.2, tarotEyeHeight * LEFT_EYE_SCALE), 0, 0, Math.PI * 2);
    offCtx.fill();
    // 앞쪽 눈
    offCtx.beginPath();
    offCtx.ellipse(EYE_RIGHT_X, EYE_Y, 0.8 * eyeScale * RIGHT_EYE_SCALE, Math.max(0.2, tarotEyeHeight * RIGHT_EYE_SCALE), 0, 0, Math.PI * 2);
    offCtx.fill();
  } else {
    // 기본 점 눈 (3/4 뷰)
    offCtx.fillStyle = '#1a1a2e';
    const eyeHeightMult = 1 - blinkAmount * 0.9;
    // 뒤쪽 눈
    offCtx.beginPath();
    offCtx.ellipse(EYE_LEFT_X, EYE_Y, 1 * eyeScale * LEFT_EYE_SCALE, Math.max(0.2, 1.2 * eyeHeightScale * eyeHeightMult * LEFT_EYE_SCALE), 0, 0, Math.PI * 2);
    offCtx.fill();
    // 앞쪽 눈
    offCtx.beginPath();
    offCtx.ellipse(EYE_RIGHT_X, EYE_Y, 1 * eyeScale * RIGHT_EYE_SCALE, Math.max(0.2, 1.2 * eyeHeightScale * eyeHeightMult * RIGHT_EYE_SCALE), 0, 0, Math.PI * 2);
    offCtx.fill();
  }

  // ========================================
  // 눈썹 (Eyebrows) - 모든 캐릭터 공통, 짧은 일자
  // ========================================
  const EYEBROW_Y = EYE_Y - 2.5 * eyeScale;  // 눈 위 2.5px
  const EYEBROW_WIDTH = 1.8 * eyeScale;      // 짧게
  const EYEBROW_THICKNESS = 0.6;

  offCtx.strokeStyle = colors.hair;
  offCtx.lineWidth = EYEBROW_THICKNESS;
  offCtx.lineCap = 'round';

  // 왼쪽 눈썹 (일자 ─)
  offCtx.beginPath();
  offCtx.moveTo(EYE_LEFT_X - EYEBROW_WIDTH / 2, EYEBROW_Y);
  offCtx.lineTo(EYE_LEFT_X + EYEBROW_WIDTH / 2, EYEBROW_Y);
  offCtx.stroke();

  // 오른쪽 눈썹 (일자 ─)
  offCtx.beginPath();
  offCtx.moveTo(EYE_RIGHT_X - EYEBROW_WIDTH / 2, EYEBROW_Y);
  offCtx.lineTo(EYE_RIGHT_X + EYEBROW_WIDTH / 2, EYEBROW_Y);
  offCtx.stroke();

  // 머리카락/모자
  if (style.hair === 'bob') {
    // 단발 - 앞머리만 (머리통은 이미 그려짐)
    offCtx.fillStyle = colors.hair;
    const bangBottom = HEAD_Y + HEAD_SIZE * 0.38;
    offCtx.beginPath();
    offCtx.moveTo(-HEAD_SIZE / 2, HEAD_Y + HEAD_SIZE * 0.1);
    offCtx.quadraticCurveTo(-HEAD_SIZE / 4, bangBottom, 0, bangBottom - 1);
    offCtx.quadraticCurveTo(HEAD_SIZE / 4, bangBottom, HEAD_SIZE / 2, HEAD_Y + HEAD_SIZE * 0.1);
    offCtx.lineTo(HEAD_SIZE / 2, HEAD_Y - HEAD_SIZE * 0.2);
    offCtx.lineTo(-HEAD_SIZE / 2, HEAD_Y - HEAD_SIZE * 0.2);
    offCtx.closePath();
    offCtx.fill();
  } else if (style.hair === 'long') {
    // 긴머리 - 앞머리만 (머리통은 이미 그려짐)
    offCtx.fillStyle = colors.hair;
    const bangBottom = HEAD_Y + HEAD_SIZE * 0.38;
    offCtx.beginPath();
    offCtx.rect(-HEAD_SIZE / 2 + 1, HEAD_Y - HEAD_SIZE * 0.1, HEAD_SIZE - 2, bangBottom - HEAD_Y + HEAD_SIZE * 0.1);
    offCtx.fill();
  } else if (style.hair === 'short_bangs') {
    // 숏컷 + 짧은 앞머리 (머리통은 이미 그려짐)
    offCtx.fillStyle = colors.hair;
    const bangBottom = HEAD_Y + HEAD_SIZE * 0.32;
    offCtx.beginPath();
    offCtx.rect(-HEAD_SIZE / 2 + 1, HEAD_Y - HEAD_SIZE * 0.1, HEAD_SIZE - 2, bangBottom - HEAD_Y + HEAD_SIZE * 0.1);
    offCtx.fill();
  } else if (style.hair === 'neo_slick') {
    // Neo 스타일 - 짧은 옆머리 (머리통 바깥쪽에서 연결)
    offCtx.fillStyle = colors.hair;

    // 옆머리 - 머리통 바깥쪽에서 자연스럽게 내려옴
    const sideStartY = HEAD_Y + HEAD_SIZE * 0.1;   // 머리통과 연결
    const sideEndY = HEAD_Y + HEAD_SIZE * 0.55;   // 눈 아래까지 (약간 더 내림)

    // 왼쪽 옆머리 - 머리 바깥쪽에 붙어서
    offCtx.beginPath();
    offCtx.moveTo(-HEAD_SIZE / 2 - 0.5, sideStartY);  // 바깥쪽 위
    offCtx.lineTo(-HEAD_SIZE / 2 - 0.3, sideEndY);    // 바깥쪽 아래
    offCtx.lineTo(-HEAD_SIZE / 2 + 0.8, sideEndY - 1.5); // 안쪽 아래
    offCtx.lineTo(-HEAD_SIZE / 2 + 0.5, sideStartY);  // 안쪽 위
    offCtx.closePath();
    offCtx.fill();

    // 오른쪽 옆머리 - 머리 바깥쪽에 붙어서
    offCtx.beginPath();
    offCtx.moveTo(HEAD_SIZE / 2 + 0.5, sideStartY);
    offCtx.lineTo(HEAD_SIZE / 2 + 0.3, sideEndY);
    offCtx.lineTo(HEAD_SIZE / 2 - 0.8, sideEndY - 1.5);
    offCtx.lineTo(HEAD_SIZE / 2 - 0.5, sideStartY);
    offCtx.closePath();
    offCtx.fill();
  } else {
    // 기본 머리 (숏컷) - 앞머리 없음, 머리통만
    // 스타일별 추가 디테일만
    if (style.hair === 'spiky') {
      // 삐죽머리 디테일
      offCtx.fillStyle = colors.hair;
      const spikeX = HEAD_SIZE * 0.3;
      offCtx.beginPath();
      offCtx.moveTo(-spikeX, HEAD_Y - HEAD_SIZE * 0.3);
      offCtx.lineTo(-spikeX * 0.5, HEAD_Y - HEAD_SIZE * 0.6);
      offCtx.lineTo(0, HEAD_Y - HEAD_SIZE * 0.35);
      offCtx.lineTo(spikeX * 0.5, HEAD_Y - HEAD_SIZE * 0.6);
      offCtx.lineTo(spikeX, HEAD_Y - HEAD_SIZE * 0.3);
      offCtx.closePath();
      offCtx.fill();
    } else if (style.hair === 'fluffy') {
      // 곱슬머리 디테일
      offCtx.fillStyle = colors.hair;
      const curlR = HEAD_SIZE * 0.12;
      const bigCurlR = HEAD_SIZE * 0.15;
      const smallCurlR = HEAD_SIZE * 0.08;
      // 왼쪽 곱슬
      offCtx.beginPath();
      offCtx.arc(-HEAD_SIZE * 0.2, HEAD_Y - HEAD_SIZE * 0.35, curlR, 0, Math.PI * 2);
      offCtx.fill();
      // 오른쪽 곱슬
      offCtx.beginPath();
      offCtx.arc(HEAD_SIZE * 0.25, HEAD_Y - HEAD_SIZE * 0.25, curlR, 0, Math.PI * 2);
      offCtx.fill();
      // 중앙 곱슬
      offCtx.beginPath();
      offCtx.arc(0, HEAD_Y - HEAD_SIZE * 0.42, bigCurlR, 0, Math.PI * 2);
      offCtx.fill();
      // 작은 곱슬 디테일
      offCtx.beginPath();
      offCtx.arc(-HEAD_SIZE * 0.13, HEAD_Y - HEAD_SIZE * 0.5, smallCurlR, 0, Math.PI * 2);
      offCtx.fill();
      offCtx.beginPath();
      offCtx.arc(HEAD_SIZE * 0.13, HEAD_Y - HEAD_SIZE * 0.5, smallCurlR, 0, Math.PI * 2);
      offCtx.fill();
      // 앞머리 (부드러운 웨이브)
      offCtx.beginPath();
      offCtx.moveTo(-HEAD_SIZE / 2, HEAD_Y + 2);
      offCtx.quadraticCurveTo(-HEAD_SIZE * 0.13, HEAD_Y - HEAD_SIZE * 0.25, 0, HEAD_Y - HEAD_SIZE * 0.17);
      offCtx.quadraticCurveTo(HEAD_SIZE * 0.13, HEAD_Y - HEAD_SIZE * 0.25, HEAD_SIZE / 2, HEAD_Y + 2);
      offCtx.quadraticCurveTo(0, HEAD_Y - HEAD_SIZE * 0.08, -HEAD_SIZE / 2, HEAD_Y + 2);
      offCtx.fill();
    } else if (style.hair === 'slick') {
      // 올백 (5등신 비율)
      offCtx.strokeStyle = 'rgba(255,255,255,0.2)';
      offCtx.lineWidth = 1;
      const slickX = HEAD_SIZE * 0.4;
      offCtx.beginPath();
      offCtx.moveTo(-slickX, HEAD_Y - HEAD_SIZE * 0.17);
      offCtx.quadraticCurveTo(0, HEAD_Y - HEAD_SIZE * 0.25, slickX, HEAD_Y - HEAD_SIZE * 0.17);
      offCtx.stroke();
    }
  }

  // 악세서리 (5등신 비율)
  if (style.acc === 'headband') {
    offCtx.fillStyle = colors.acc;
    const bandH = Math.max(2, HEAD_SIZE * 0.17);  // 2px
    offCtx.fillRect(-HEAD_SIZE / 2 - 1, HEAD_Y + HEAD_SIZE * 0.42, HEAD_SIZE + 2, bandH);
    // 매듭 (뒤쪽)
    if (dir > 0) {
      offCtx.fillRect(-HEAD_SIZE / 2 - HEAD_SIZE * 0.17, HEAD_Y + HEAD_SIZE * 0.42, HEAD_SIZE * 0.17, bandH * 0.75);
      offCtx.fillRect(-HEAD_SIZE / 2 - HEAD_SIZE * 0.21, HEAD_Y + HEAD_SIZE * 0.5, HEAD_SIZE * 0.13, bandH);
    }
  } else if (style.acc === 'hood') {
    offCtx.fillStyle = colors.acc;
    offCtx.beginPath();
    offCtx.arc(0, HEAD_Y + HEAD_SIZE * 0.33, HEAD_SIZE / 2 + HEAD_SIZE * 0.13, Math.PI, 0);
    offCtx.lineTo(HEAD_SIZE / 2 + HEAD_SIZE * 0.13, HEAD_Y + HEAD_SIZE);
    offCtx.lineTo(-HEAD_SIZE / 2 - HEAD_SIZE * 0.13, HEAD_Y + HEAD_SIZE);
    offCtx.fill();
    // 안쪽 그림자
    offCtx.fillStyle = 'rgba(0,0,0,0.2)';
    offCtx.beginPath();
    offCtx.arc(0, HEAD_Y + HEAD_SIZE * 0.5, HEAD_SIZE / 2 + 1, Math.PI, 0);
    offCtx.fill();
  } else if (style.acc === 'safety_helmet') {
    // TANK 안전모 - 머리(0.55)보다 아주 살짝만 큼
    const helmetW = HEAD_SIZE * 0.6;
    const helmetY = HEAD_Y + HEAD_SIZE * 0.1;

    // 헬멧 본체
    offCtx.fillStyle = colors.top;
    offCtx.beginPath();
    offCtx.arc(0, helmetY, helmetW, Math.PI, 0);
    offCtx.closePath();
    offCtx.fill();

    // 흰 띠
    offCtx.fillStyle = '#fff';
    offCtx.fillRect(-helmetW, helmetY - 1, helmetW * 2, 2);

    // 빨간 라이트
    offCtx.fillStyle = '#ef4444';
    offCtx.beginPath();
    offCtx.arc(0, helmetY - helmetW * 0.6, 2, 0, Math.PI * 2);
    offCtx.fill();
  } else if (style.acc === 'fire_helmet') {
    // MORPHEUS 소방헬멧 - 머리(0.55)보다 아주 살짝만 큼
    const helmetW = HEAD_SIZE * 0.62;
    const helmetY = HEAD_Y + HEAD_SIZE * 0.1;

    // 헬멧 본체
    offCtx.fillStyle = '#1e293b';
    offCtx.beginPath();
    offCtx.arc(0, helmetY, helmetW, Math.PI, 0);
    offCtx.closePath();
    offCtx.fill();

    // 챙
    offCtx.fillStyle = '#334155';
    offCtx.fillRect(-helmetW - 1, helmetY - 1, (helmetW + 1) * 2, 3);

    // 불꽃 마크
    offCtx.fillStyle = '#f59e0b';
    offCtx.beginPath();
    offCtx.moveTo(0, helmetY - helmetW * 0.7);
    offCtx.lineTo(-2, helmetY - helmetW * 0.3);
    offCtx.lineTo(2, helmetY - helmetW * 0.3);
    offCtx.closePath();
    offCtx.fill();
  }

  // === ACCESSORY TYPE RENDERING (스킨 악세서리) ===
  // v4.7: 모듈화된 drawAccessory 호출 (badge, watch, cape는 다른 곳에서 처리)
  if (accessoryType && accessoryType !== 'badge' && accessoryType !== 'watch' && accessoryType !== 'cape') {
    drawAccessory({
      ctx: offCtx,
      accessoryType,
      accColor,
      colors,
      eyeBaseX: EYE_BASE_X,
      eyeY: EYE_Y,
      earY,
      dir,
    });
  }

  offCtx.restore(); // 머리 회전 끝
  offCtx.restore(); // 머리 끝

  // 5. 앞쪽 팔 (가장 앞) - 45도 비틀기
  drawLimb(offCtx, frontArmX, armY, armAngleL, colors.top);

  offCtx.restore();

  // === COMPOSITE ===
  // 1. 외곽선 (두껍게)
  if (!catSilhouetteCtx) return;
  catSilhouetteCtx.clearRect(0, 0, effectiveCanvasSize, effectiveCanvasSize);
  catSilhouetteCtx.globalAlpha = 1.0; // 명시적 초기화

  // 원본을 Silhouette 캔버스에 그리기
  catSilhouetteCtx.drawImage(catOutlineCanvas, 0, 0);

  // 반투명 픽셀을 완전히 불투명하게 만들기
  // 방법: source-atop으로 불투명 이미지를 위에 덧칠
  // 기존 픽셀 영역에만 적용되므로 영역은 유지하면서 알파만 1.0으로
  catSilhouetteCtx.globalCompositeOperation = 'source-atop';
  catSilhouetteCtx.fillStyle = '#000000';
  catSilhouetteCtx.fillRect(0, 0, effectiveCanvasSize, effectiveCanvasSize);
  catSilhouetteCtx.globalCompositeOperation = 'source-over';

  // Source-In으로 검은색 채우기 (실루엣 만들기)
  catSilhouetteCtx.globalCompositeOperation = 'source-in';
  catSilhouetteCtx.fillStyle = '#0f172a'; // 진한 남색 외곽선
  catSilhouetteCtx.fillRect(0, 0, effectiveCanvasSize, effectiveCanvasSize);
  catSilhouetteCtx.globalCompositeOperation = 'source-over';

  // 실제 캔버스에 그리기
  ctx.save();
  ctx.globalAlpha = 1.0;
  // 선명도 개선: 정수 좌표로 서브픽셀 렌더링 방지
  ctx.translate(Math.round(p.position.x), Math.round(p.position.y));

  // 그림자 (캐릭터 발 아래) - 80% 스케일: HEAD=19 + BODY=12 + LEGS=8
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(0, 19 * externalScale, 8 * externalScale, 2.5 * externalScale, 0, 0, Math.PI * 2);
  ctx.fill();

  // 선명도 개선: 정수 좌표 (80% 스케일)
  const drawX = Math.round(-effectiveCanvasSize / 2);
  const drawY = Math.round(-effectiveCanvasSize / 2 - 6 * externalScale);

  // 원본 캐릭터 그리기 (8방향 외곽선 제거 - 소숫점 drawImage가 블러 원인)
  ctx.drawImage(catOutlineCanvas, drawX, drawY);

  ctx.restore();
};

export const drawPixelObstacle = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  type: string,
  scale: number = 1.0
): void => {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // Voxel Helper
  const drawCube = (x: number, y: number, w: number, h: number, d: number, color: string) => {
    const depthX = d * 0.5;
    const depthY = -d * 0.5;

    const shadeColor = (col: string, amt: number) => {
      let usePound = false;
      if (col[0] == "#") { col = col.slice(1); usePound = true; }
      let num = parseInt(col, 16);
      let r = Math.max(0, Math.min(255, (num >> 16) + amt));
      let b = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amt));
      let g = Math.max(0, Math.min(255, (num & 0x0000FF) + amt));
      return (usePound ? "#" : "") + (g | (b << 8) | (r << 16)).toString(16).padStart(6, '0');
    };

    // SIDE FACE
    ctx.fillStyle = shadeColor(color, -30);
    ctx.beginPath();
    ctx.moveTo(x + w, y); ctx.lineTo(x + w + depthX, y + depthY);
    ctx.lineTo(x + w + depthX, y - h + depthY); ctx.lineTo(x + w, y - h);
    ctx.fill();

    // TOP FACE
    ctx.fillStyle = shadeColor(color, 30);
    ctx.beginPath();
    ctx.moveTo(x, y - h); ctx.lineTo(x + depthX, y - h + depthY);
    ctx.lineTo(x + w + depthX, y - h + depthY); ctx.lineTo(x + w, y - h);
    ctx.fill();

    // FRONT FACE
    ctx.fillStyle = color;
    ctx.fillRect(x, y - h, w, h);
  };

  const time = Date.now();

  // === 작은 장애물 ===
  if (type === 'node') {
    // 기본 네트워크 노드 (작은 박스)
    drawCube(-8, 8, 16, 16, 12, '#64748b');
    // LED
    const blink = Math.floor(time / 500) % 2;
    ctx.fillStyle = blink === 0 ? '#22d3ee' : '#0f766e';
    ctx.fillRect(-4, -4, 3, 3);

  } else if (type === 'smart_contract') {
    // 스마트 컨트랙트 (스크롤 모양)
    drawCube(-7, 10, 14, 18, 8, '#8b5cf6');
    // 코드 라인
    ctx.fillStyle = '#c4b5fd';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(-5, -6 + i * 4, 8 - (i % 2) * 3, 2);
    }

  } else if (type === 'nft_pedestal') {
    // NFT 전시대 (작은 받침대 + 프레임)
    drawCube(-6, 10, 12, 6, 10, '#1e293b'); // 받침대
    drawCube(-5, 4, 10, 10, 2, '#ec4899'); // 프레임
    // 반짝이
    const sparkle = Math.sin(time / 200) * 0.5 + 0.5;
    ctx.fillStyle = `rgba(255,255,255,${sparkle})`;
    ctx.fillRect(-2, -4, 4, 4);

    // === 중간 장애물 ===
  } else if (type === 'validator_node') {
    // 검증 노드 (안테나 달린 서버)
    drawCube(-10, 10, 20, 20, 16, '#166534');
    // 안테나
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(-2, -12, 4, 4);
    ctx.fillRect(-1, -18, 2, 6);
    // 상태 표시
    const pulse = Math.sin(time / 300);
    ctx.fillStyle = pulse > 0 ? '#4ade80' : '#166534';
    ctx.fillRect(-6, -4, 4, 4);
    ctx.fillRect(2, -4, 4, 4);

  } else if (type === 'ledger_block') {
    // 원장 블록 (연결된 블록들)
    const float = Math.sin(time / 500) * 2;
    drawCube(-10, 4 + float, 10, 12, 10, '#f59e0b');
    drawCube(-2, 0 + float, 4, 4, 4, '#94a3b8'); // 체인
    drawCube(2, 6 - float, 10, 12, 10, '#e2e8f0');
    ctx.fillStyle = '#fff';
    ctx.font = '8px monospace';
    ctx.fillText('B', -6, float);

  } else if (type === 'firewall') {
    // 방화벽 (빨간 벽돌)
    const blockSize = 8;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 4; c++) {
        const xOff = (c - 1.5) * blockSize;
        const yOff = 8 - (r * blockSize);
        const color = (r + c) % 2 === 0 ? '#ef4444' : '#f87171';
        drawCube(xOff, yOff, blockSize - 1, blockSize - 1, blockSize - 1, color);
      }
    }
    // 불꽃 효과
    const flame = Math.sin(time / 100) * 2;
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(-2, -18 + flame, 4, 6);

    // === 큰 장애물 ===
  } else if (type === 'liquidity_pool') {
    // 유동성 풀 (넓은 물웅덩이)
    drawCube(-16, 8, 32, 6, 16, '#1d4ed8');
    // 물결
    ctx.fillStyle = '#3b82f6';
    const wave = Math.sin(time / 200) * 2;
    ctx.fillRect(-14, 2 + wave, 28, 2);
    // 토큰들
    const t1 = Math.sin(time / 300) * 2;
    const t2 = Math.cos(time / 400) * 2;
    drawCube(-10, 6 + t1, 6, 6, 6, '#fcd34d');
    drawCube(4, 6 + t2, 6, 6, 6, '#a855f7');

  } else if (type === 'mining_rig') {
    // 채굴기 (큰 서버 타워)
    drawCube(-12, 12, 24, 28, 20, '#1e293b');
    // LED 배열
    const blink = Math.floor(time / 150) % 6;
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i === blink ? '#22d3ee' : '#0f766e';
      ctx.fillRect(-8 + i * 3, -12, 2, 2);
    }
    // 팬
    ctx.save();
    ctx.translate(0, -18);
    ctx.scale(1, 0.5);
    ctx.rotate(time / 80);
    ctx.fillStyle = '#475569';
    ctx.fillRect(-8, -1, 16, 2);
    ctx.fillRect(-1, -8, 2, 16);
    ctx.restore();

    // === 매우 큰 장애물 ===
  } else if (type === 'server_rack') {
    // 서버랙 (가장 큰 타워)
    drawCube(-12, 16, 24, 36, 18, '#0f172a');
    // 서버 유닛들
    for (let i = 0; i < 5; i++) {
      const color = i % 2 === 0 ? '#334155' : '#1e293b';
      drawCube(-10, 14 - i * 7, 20, 6, 14, color);
      // LED
      const on = Math.floor(time / 200 + i) % 3 === 0;
      ctx.fillStyle = on ? '#22d3ee' : '#0f766e';
      ctx.fillRect(-8, -22 + i * 7, 2, 2);
    }

  } else if (type === 'dao_monument') {
    // DAO 기념비 (피라미드형)
    drawCube(-14, 16, 28, 10, 28, '#4c1d95'); // 베이스
    drawCube(-10, 6, 20, 10, 20, '#6d28d9'); // 중간
    drawCube(-6, -4, 12, 10, 12, '#7c3aed'); // 상단
    // 빛나는 심볼
    const glow = Math.sin(time / 300) * 0.3 + 0.7;
    ctx.fillStyle = `rgba(196, 181, 253, ${glow})`;
    ctx.beginPath();
    ctx.arc(0, -12, 4, 0, Math.PI * 2);
    ctx.fill();
    // DAO 텍스트
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 6px monospace';
    ctx.fillText('DAO', -8, 10);

  } else {
    // Fallback
    drawCube(-8, 8, 16, 16, 16, '#64748b');
  }

  ctx.restore();
};

/**
 * 투사체 렌더링 (개별 투사체)
 */
export const drawProjectile = (
  ctx: CanvasRenderingContext2D,
  p: any,
  playerPos: { x: number; y: number }
): void => {
  ctx.save();
  ctx.translate(p.position.x, p.position.y);

  switch (p.type) {
    case 'whip': {
      // v4.7: 모듈화된 drawWhip 호출
      drawModuleWhip({ ctx, p, playerPos });
      break;
    }

    case 'punch': {
      // v4.7: 모듈화된 drawPunch 호출
      drawModulePunch({ ctx, p, playerPos });
      break;
    }

    case 'axe': {
      // v4.7: 모듈화된 drawAxe 호출
      drawModuleAxe({ ctx, p, playerPos });
      break;
    }

    case 'sword': {
      // v7.34: 모듈화된 drawSword 호출 (Collection 미리보기와 동일)
      drawModuleSword({ ctx, p, playerPos });
      break;
    }

    case 'bible': {
      // v4.7: 모듈화된 drawBible 호출
      drawModuleBible({ ctx, p, playerPos });
      break;
    }

    case 'wand': {
      // v4.7: 모듈화된 drawWand 호출
      drawModuleWand({ ctx, p, playerPos });
      break;
    }

    case 'knife': {
      // v4.7: 모듈화된 drawKnife 호출
      drawModuleKnife({ ctx, p, playerPos });
      break;
    }

    case 'bridge': {
      // v4.7: 모듈화된 drawBridge 호출
      drawModuleBridge({ ctx, p, playerPos });
      break;
    }

    case 'bow': {
      // v4.7: 모듈화된 drawBow 호출
      drawModuleBow({ ctx, p, playerPos });
      break;
    }

    case 'ping': {
      // v4.7: 모듈화된 drawPing 호출
      drawModulePing({ ctx, p, playerPos });
      break;
    }

    // ===============================
    // NEW DOPAMINE SKILLS (6개) - 도파민 폭발 이펙트!
    // ===============================

    case 'shard': {
      // v4.7: 모듈화된 drawShard 호출
      drawModuleShard({ ctx, p, playerPos });
      break;
    }

    case 'airdrop': {
      // v4.7: 모듈화된 drawAirdrop 호출
      drawModuleAirdrop({ ctx, p, playerPos });
      break;
    }

    case 'fork': {
      // v4.7: 모듈화된 drawFork 호출
      drawModuleFork({ ctx, p, playerPos });
      break;
    }

    case 'garlic': {
      // v4.7: 모듈화된 drawGarlic 호출
      drawModuleGarlic({ ctx, p, playerPos });
      break;
    }

    case 'pool': {
      // v4.7: 모듈화된 drawPool 호출
      drawModulePool({ ctx, p, playerPos });
      break;
    }

    case 'beam': {
      // v4.7: 모듈화된 drawBeam 호출
      drawModuleBeam({ ctx, p, playerPos });
      break;
    }

    case 'laser': {
      // v4.7: 모듈화된 drawLaser 호출
      drawModuleLaser({ ctx, p, playerPos });
      break;
    }

  }

  ctx.restore();
};

/**
 * 라이트닝 볼트 렌더링 (타로카드 테마)
 */
export const drawLightningBolt = (
  ctx: CanvasRenderingContext2D,
  bolt: { segments: { x: number; y: number }[]; color: string; life: number; maxLife: number; width: number }
): void => {
  if (bolt.segments.length < 2) return;

  const alpha = bolt.life / bolt.maxLife;
  const time = Date.now();

  ctx.save();
  ctx.globalAlpha = alpha;

  // 외곽 글로우
  ctx.strokeStyle = bolt.color;
  ctx.lineWidth = bolt.width + 4;
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(bolt.segments[0].x, bolt.segments[0].y);
  for (let i = 1; i < bolt.segments.length; i++) {
    ctx.lineTo(bolt.segments[i].x, bolt.segments[i].y);
  }
  ctx.stroke();

  // 코어 (흰색)
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = bolt.width;
  ctx.beginPath();
  ctx.moveTo(bolt.segments[0].x, bolt.segments[0].y);
  for (let i = 1; i < bolt.segments.length; i++) {
    ctx.lineTo(bolt.segments[i].x, bolt.segments[i].y);
  }
  ctx.stroke();

  // 시작점에 타로카드 이펙트
  const startPos = bolt.segments[0];
  const endPos = bolt.segments[bolt.segments.length - 1];

  // 타로카드 (시작점)
  ctx.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.translate(startPos.x, startPos.y);
  ctx.rotate(time / 200);

  // 카드 배경
  ctx.fillStyle = '#1e1b4b';
  ctx.strokeStyle = '#a78bfa';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-8, -12, 16, 24, 2);
  ctx.fill();
  ctx.stroke();

  // 별 문양
  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  for (let s = 0; s < 5; s++) {
    const sAngle = (s / 5) * Math.PI * 2 - Math.PI / 2;
    const outerR = 5;
    const innerR = 2;
    const ox = Math.cos(sAngle) * outerR;
    const oy = Math.sin(sAngle) * outerR;
    const ix = Math.cos(sAngle + Math.PI / 5) * innerR;
    const iy = Math.sin(sAngle + Math.PI / 5) * innerR;
    if (s === 0) ctx.moveTo(ox, oy);
    else ctx.lineTo(ox, oy);
    ctx.lineTo(ix, iy);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // 히트 포인트 스파크 (끝점)
  ctx.save();
  ctx.translate(endPos.x, endPos.y);
  const sparkCount = 8;
  for (let sp = 0; sp < sparkCount; sp++) {
    const spAngle = (sp / sparkCount) * Math.PI * 2 + time / 50;
    const spDist = 10 + Math.sin(time / 30 + sp) * 5;
    ctx.fillStyle = bolt.color;
    ctx.globalAlpha = alpha * 0.8;
    ctx.beginPath();
    ctx.arc(
      Math.cos(spAngle) * spDist,
      Math.sin(spAngle) * spDist,
      2 + Math.random() * 2,
      0, Math.PI * 2
    );
    ctx.fill();
  }
  ctx.restore();

  ctx.restore();
};


// ===== Formation Warning Rendering =====

/**
 * 포메이션 경고 렌더링 (스폰 예정 위치에 깜빡이는 원)
 */
export function drawFormationWarning(
  ctx: CanvasRenderingContext2D,
  positions: { x: number; y: number }[],
  camera: { x: number; y: number },
  enemyType: string,
  timer: number // 남은 경고 시간 (0~1)
): void {
  const t = Date.now();
  const pulseRate = 100; // 깜빡임 속도
  const alpha = 0.2 + Math.abs(Math.sin(t / pulseRate)) * 0.3;

  // 적 타입별 색상
  const typeColors: Record<string, string> = {
    glitch: '#00FF41',    // Matrix Green
    bot: '#3b82f6',       // Blue
    malware: '#dc2626',   // Red
    whale: '#6b7280',     // Gray
    sniper: '#f97316',    // Orange
    caster: '#a855f7',    // Purple
    artillery: '#ea580c', // Dark Orange
    // Singularity types
    bitling: '#22d3ee',   // Cyan
    spammer: '#84cc16',   // Lime
    crypter: '#f59e0b',   // Amber
    ransomer: '#ef4444',  // Red
    pixel: '#ec4899',     // Pink
    bug: '#14b8a6',       // Teal
    worm: '#06b6d4',      // Cyan
    adware: '#eab308',    // Yellow
    mutant: '#8b5cf6',    // Violet
    polymorphic: '#d946ef', // Fuchsia
    trojan: '#22c55e',    // Green
    botnet: '#64748b',    // Slate
    rootkit: '#1e293b',   // Dark
    apt: '#7c3aed',       // Purple
    zeroday: '#fbbf24',   // Amber
    skynet: '#dc2626',    // Red
  };

  const color = typeColors[enemyType] || '#ff0000';

  ctx.save();

  positions.forEach((pos, index) => {
    const screenX = pos.x - camera.x;
    const screenY = pos.y - camera.y;

    // 화면 밖이면 스킵
    if (screenX < -50 || screenX > window.innerWidth + 50 ||
        screenY < -50 || screenY > window.innerHeight + 50) {
      return;
    }

    // 외부 원 (깜빡임)
    ctx.beginPath();
    ctx.arc(screenX, screenY, 25 + Math.sin(t / pulseRate + index) * 5, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    // 내부 원 (점점 커짐 - 스폰 임박 표시)
    const innerRadius = 5 + (1 - timer) * 15; // timer가 0에 가까울수록 커짐
    ctx.beginPath();
    ctx.arc(screenX, screenY, innerRadius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha * 0.5;
    ctx.fill();

    // 중심점
    ctx.beginPath();
    ctx.arc(screenX, screenY, 3, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.8;
    ctx.fill();
  });

  ctx.restore();
}

// ===== Re-export Render Context for external use =====
export {
  updateRenderContext,
  getLOD,
  getFrameTime,
  shouldUseShadow,
  // v5.0 LOD helpers
  shouldUseGradient,
  shouldUseGlow,
  shouldUseComplexShapes,
  getSimplifiedColor,
  getTotalEntityCount,
  getProjectileCount,
  getParticleCount,
  // Stress test mode
  setStressTestMode,
  isStressTestMode,
  getAvgFrameTime,
  getStressTestFPS,
};

