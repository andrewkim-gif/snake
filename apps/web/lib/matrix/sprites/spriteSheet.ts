/**
 * game/sprites/spriteSheet.ts - 스프라이트 시트 시스템 (v5.8)
 *
 * 캐릭터별 스프라이트 시트 설정:
 *
 * Neo: 512x512, 8x8 그리드, 64x64 프레임, 8 FPS
 * Trinity: 1792x1024, 14x8 그리드, 128x128 프레임, 12 FPS
 *
 * 방향 순서 (세로, row 0~7):
 * 0: 오른쪽 (→)
 * 1: 오른쪽 아래 (↘)
 * 2: 아래 (↓)
 * 3: 왼쪽 아래 (↙)
 * 4: 왼쪽 (←)
 * 5: 왼쪽 위 (↖)
 * 6: 위 (↑)
 * 7: 오른쪽 위 (↗)
 */

import { PlayerClass } from '../types';
import { Direction8 } from './types';

// =====================================================
// 캐릭터별 스프라이트 시트 설정
// =====================================================

interface CharacterSpriteConfig {
  width: number;           // 이미지 전체 너비
  height: number;          // 이미지 전체 높이
  framesPerRow: number;    // 가로 프레임 수
  rowCount: number;        // 세로 방향 수 (보통 8)
  frameWidth: number;      // 프레임 너비 (자동 계산)
  frameHeight: number;     // 프레임 높이 (자동 계산)
  fps: number;             // 애니메이션 FPS
  animations: string[];    // 지원하는 애니메이션 타입들
  filePrefix: string;      // 파일 prefix (예: 'neo_', 'trinity_')
}

// v6.0: 모든 캐릭터 동일 포맷 (1792x1024, 14x8, 128x128)
// v5.8: attack 애니메이션 제거 - idle, walk, takedamage만 유지
const UNIVERSAL_CONFIG: CharacterSpriteConfig = {
  width: 1792,
  height: 1024,
  framesPerRow: 14,
  rowCount: 8,
  frameWidth: 128,  // 1792 / 14 = 128
  frameHeight: 128, // 1024 / 8 = 128
  fps: 12,
  animations: ['idle', 'walk'],
  filePrefix: '',
};

// 캐릭터별 설정 (모두 동일 포맷 사용)
const CHARACTER_SPRITE_CONFIGS: Partial<Record<PlayerClass, CharacterSpriteConfig>> = {
  neo: { ...UNIVERSAL_CONFIG, filePrefix: 'neo_' },
  trinity: { ...UNIVERSAL_CONFIG, filePrefix: 'trinity_' },
  morpheus: { ...UNIVERSAL_CONFIG, filePrefix: 'morpheus_' },
  tank: { ...UNIVERSAL_CONFIG, filePrefix: 'tank_' },
  cypher: { ...UNIVERSAL_CONFIG, filePrefix: 'cypher_' },
  niobe: { ...UNIVERSAL_CONFIG, filePrefix: 'niobe_' },
  oracle: { ...UNIVERSAL_CONFIG, filePrefix: 'oracle_' },
  mouse: { ...UNIVERSAL_CONFIG, filePrefix: 'mouse_' },
  dozer: { ...UNIVERSAL_CONFIG, filePrefix: 'dozer_' },
};

// 기본 설정 (설정이 없는 캐릭터용)
const DEFAULT_CONFIG: CharacterSpriteConfig = UNIVERSAL_CONFIG;

// 애니메이션 타입 (v5.8: attack 관련 제거 - idle, walk, takedamage만 유지)
export type SpriteSheetAnimType = 'idle' | 'walk' | 'takedamage';

// v5.9.3: 스플릿 렌더링 파트 타입
export type SpriteSheetPart = 'full' | 'upper' | 'lower';

// 스플릿 비율 (0.55 = 캐릭터 중앙보다 약간 아래, 허리 위치)
const SPLIT_RATIO = 0.55;

// =====================================================
// 스프라이트 시트 캐시
// =====================================================

// v5.8: attack 관련 캐시 제거
interface SpriteSheetCache {
  idle?: HTMLImageElement;
  walk?: HTMLImageElement;
  takedamage?: HTMLImageElement;
}

const spriteSheetCache = new Map<PlayerClass, SpriteSheetCache>();

// =====================================================
// 유틸리티 함수
// =====================================================

/**
 * 캐릭터 설정 가져오기
 */
function getCharacterConfig(characterId: PlayerClass): CharacterSpriteConfig {
  return CHARACTER_SPRITE_CONFIGS[characterId] || DEFAULT_CONFIG;
}

/**
 * Direction8 → 스프라이트 시트 row index 매핑
 * 기존 스프라이트: 오른쪽(Row 0) 시작, 시계방향
 */
export function getRowIndexFromDirection8(direction: Direction8): number {
  switch (direction) {
    case Direction8.RIGHT:       return 0; // 오른쪽
    case Direction8.FRONT_RIGHT: return 1; // 오른쪽 아래
    case Direction8.FRONT:       return 2; // 아래 (정면)
    case Direction8.FRONT_LEFT:  return 3; // 왼쪽 아래
    case Direction8.LEFT:        return 4; // 왼쪽
    case Direction8.BACK_LEFT:   return 5; // 왼쪽 위
    case Direction8.BACK:        return 6; // 위 (뒷면)
    case Direction8.BACK_RIGHT:  return 7; // 오른쪽 위
    default:                     return 2; // 기본: 아래
  }
}


/**
 * 시간 기반 현재 프레임 계산
 * @param time 현재 시간 (ms)
 * @param fps FPS
 * @param frameCount 프레임 수
 */
export function getCurrentFrame(time: number, fps: number = 8, frameCount: number = 8): number {
  const frameDuration = 1000 / fps;
  return Math.floor((time / frameDuration) % frameCount);
}

/**
 * 단일 이미지 로드
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load: ${src}`));
    img.src = src;
  });
}

// =====================================================
// 로더 함수
// =====================================================

/**
 * 캐릭터의 스프라이트 시트 로드
 * @param characterId 캐릭터 ID
 * @returns 로드 성공 여부
 */
// v5.8: attack 관련 로드 제거 - idle, walk, takedamage만 로드
export async function loadSpriteSheet(characterId: PlayerClass): Promise<boolean> {
  if (spriteSheetCache.has(characterId)) {
    const cache = spriteSheetCache.get(characterId)!;
    // 최소 하나의 애니메이션이 로드되었으면 성공
    if (cache.walk || cache.idle) return true;
  }

  const config = getCharacterConfig(characterId);
  const basePath = `./assets/cha/${characterId}/sprite`;
  const cache: SpriteSheetCache = {};

  try {
    const prefix = `${characterId}_`;

    // idle 로드
    try {
      cache.idle = await loadImage(`${basePath}/${prefix}idle.png`);
      console.log(`[SpriteSheet] Loaded ${prefix}idle.png`);
    } catch (e) {
      console.warn(`[SpriteSheet] Failed to load ${prefix}idle.png`);
    }

    // walk 로드
    try {
      cache.walk = await loadImage(`${basePath}/${prefix}walk.png`);
      console.log(`[SpriteSheet] Loaded ${prefix}walk.png`);
    } catch (e) {
      // walk 없으면 run 시도
      try {
        cache.walk = await loadImage(`${basePath}/${prefix}run.png`);
        console.log(`[SpriteSheet] Loaded ${prefix}run.png as walk`);
      } catch (e2) {
        // run도 없으면 idle로 대체
        if (cache.idle) cache.walk = cache.idle;
      }
    }

    // takedamage 로드 (피격 애니메이션)
    try {
      cache.takedamage = await loadImage(`${basePath}/${prefix}takedamage.png`);
      console.log(`[SpriteSheet] Loaded ${prefix}takedamage.png`);
    } catch (e) {
      // takedamage 없으면 idle로 폴백
    }

    // 폴백: idle 없으면 walk로 대체
    if (!cache.idle) {
      cache.idle = cache.walk;
    }
    if (!cache.walk) {
      cache.walk = cache.idle;
    }

    spriteSheetCache.set(characterId, cache);
    console.log(`[SpriteSheet] Loaded ${characterId} sprites`);
    return true;
  } catch (error) {
    console.warn(`[SpriteSheet] Failed to load ${characterId}:`, error);
    return false;
  }
}

/**
 * 스프라이트 시트가 로드되었는지 확인
 */
export function isSpriteSheetLoaded(characterId: PlayerClass): boolean {
  const cache = spriteSheetCache.get(characterId);
  if (!cache) return false;
  return !!(cache.walk || cache.idle);
}

// =====================================================
// 렌더링 함수
// =====================================================

/**
 * 스프라이트 시트 렌더링
 *
 * @param ctx Canvas 2D context
 * @param x 중심 X 좌표
 * @param y 중심 Y 좌표
 * @param characterId 캐릭터 ID
 * @param direction 8방향
 * @param time 현재 시간 (Date.now()) - 애니메이션 프레임 계산용
 * @param scale 스케일 (기본 1 = 원본 크기)
 * @param animType 애니메이션 타입
 * @param part 스플릿 렌더링 파트 (full/upper/lower) - v5.9.3
 * @returns 렌더링 성공 여부
 */
export function drawSpriteSheet(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  characterId: PlayerClass,
  direction: Direction8,
  time: number,
  scale: number = 1,
  animType: SpriteSheetAnimType = 'idle',
  part: SpriteSheetPart = 'full'
): boolean {
  const cache = spriteSheetCache.get(characterId);
  if (!cache) return false;

  const config = getCharacterConfig(characterId);

  // v5.8: attack 관련 제거 - idle, walk, takedamage만 지원
  let spriteSheet: HTMLImageElement | undefined;

  switch (animType) {
    case 'idle':
      spriteSheet = cache.idle;
      break;
    case 'walk':
      spriteSheet = cache.walk || cache.idle;
      break;
    case 'takedamage':
      spriteSheet = cache.takedamage || cache.idle;
      break;
    default:
      spriteSheet = cache.idle || cache.walk;
  }

  if (!spriteSheet || !spriteSheet.complete) return false;

  // v5.8: takedamage만 짧은 애니메이션
  const isShortAnim = animType === 'takedamage';

  // 방향에 해당하는 row (모든 스프라이트 동일 순서: 오른쪽 시작, 시계방향)
  const row = getRowIndexFromDirection8(direction);
  const frameCount = isShortAnim ? 4 : config.framesPerRow;

  // 현재 프레임 계산 (공격은 4프레임, 나머지는 전체 프레임)
  const frame = getCurrentFrame(time, config.fps, frameCount);

  // 스프라이트 시트에서 잘라낼 영역
  const srcX = frame * config.frameWidth;
  const srcY = row * config.frameHeight;

  // 렌더링 크기
  const renderWidth = config.frameWidth * scale;
  const renderHeight = config.frameHeight * scale;

  // v5.9.4: 상반신은 오프스크린 캔버스에서 그라데이션 페이드 처리
  if (part === 'upper') {
    // 오프스크린 캔버스 생성
    const offscreen = document.createElement('canvas');
    offscreen.width = renderWidth + 2;
    offscreen.height = renderHeight;
    const offCtx = offscreen.getContext('2d')!;
    offCtx.imageSmoothingEnabled = false;

    // 상반신만 클리핑해서 그리기
    const upperHeight = renderHeight * SPLIT_RATIO;
    offCtx.beginPath();
    offCtx.rect(0, 0, renderWidth + 2, upperHeight + 1);
    offCtx.clip();

    // 스프라이트 그리기
    offCtx.drawImage(
      spriteSheet,
      srcX, srcY, config.frameWidth, config.frameHeight,
      1, 0, renderWidth, renderHeight
    );

    // 그라데이션 페이드아웃 적용
    const fadeHeight = renderHeight * 0.10; // 페이드 영역 (10%)
    const fadeStartY = upperHeight - fadeHeight;

    offCtx.globalCompositeOperation = 'destination-out';
    const gradient = offCtx.createLinearGradient(0, fadeStartY, 0, upperHeight);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,1)');
    offCtx.fillStyle = gradient;
    offCtx.fillRect(0, fadeStartY, renderWidth + 2, fadeHeight + 1);

    // 메인 캔버스에 그리기
    ctx.drawImage(offscreen, x - renderWidth / 2 - 1, y - renderHeight / 2);
    return true;
  }

  ctx.save();

  // 선명한 픽셀 렌더링 (스케일업 시 블러 방지)
  ctx.imageSmoothingEnabled = false;

  // v5.9.4: 'lower'는 전체 캐릭터를 그림 (뒷 레이어로 스킬 뒤에 배치)
  // 클리핑 없이 전체 캐릭터 렌더링

  // 중심점 기준으로 그리기
  ctx.drawImage(
    spriteSheet,
    srcX, srcY, config.frameWidth, config.frameHeight,  // source
    x - renderWidth / 2, y - renderHeight / 2, renderWidth, renderHeight  // dest
  );

  ctx.restore();
  return true;
}

/**
 * 피격 효과가 있는 스프라이트 시트 렌더링
 * @param part 스플릿 렌더링 파트 (full/upper/lower) - v5.9.3
 */
export function drawSpriteSheetWithHit(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  characterId: PlayerClass,
  direction: Direction8,
  time: number,
  scale: number = 1,
  animType: SpriteSheetAnimType = 'idle',
  hitFlash: boolean = false,
  part: SpriteSheetPart = 'full'
): boolean {
  const drawn = drawSpriteSheet(ctx, x, y, characterId, direction, time, scale, animType, part);

  if (drawn && hitFlash) {
    const config = getCharacterConfig(characterId);
    const renderWidth = config.frameWidth * scale;
    const renderHeight = config.frameHeight * scale;

    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillRect(x - renderWidth / 2, y - renderHeight / 2, renderWidth, renderHeight);
    ctx.restore();
  }

  return drawn;
}

/**
 * 캐시 초기화
 */
export function clearSpriteSheetCache(): void {
  spriteSheetCache.clear();
}

/**
 * 캐릭터 설정 내보내기 (디버그용)
 */
export function getSpriteConfig(characterId: PlayerClass): CharacterSpriteConfig {
  return getCharacterConfig(characterId);
}
