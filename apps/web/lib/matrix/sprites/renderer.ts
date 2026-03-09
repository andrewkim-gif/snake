/**
 * game/sprites/renderer.ts - 8방향 캐릭터 스프라이트 렌더러
 * 이미지 기반 캐릭터 렌더링 (drawCatSprite 대체)
 *
 * v5.9.3: 스플릿 렌더링 지원 (상반신/하반신 분리)
 * - 스킬이 캐릭터 몸 중앙에서 나오는 것처럼 연출
 * - 하반신 → 스킬 → 상반신 순서로 렌더링
 */

import { PlayerClass } from '../types';
import { Direction8 } from './types';
import { getCharacterSprites } from './loader';
import { needsFlip, getImageKeyForDirection } from './direction';

// 기본 렌더링 크기 (drawCatSprite의 effectiveCanvasSize와 유사하게)
const DEFAULT_RENDER_SIZE = 51; // 픽셀 (64 * 0.8 = 51)

// 스플릿 렌더링: 상반신/하반신 분리 비율 (0.0 = 상단, 1.0 = 하단)
// 0.55 = 캐릭터 중앙보다 약간 아래 (허리 위치)
const SPLIT_RATIO = 0.55;

/**
 * 스플릿 렌더링 파트 타입
 */
export type CharacterPart = 'full' | 'upper' | 'lower';

/**
 * 8방향 캐릭터 스프라이트 렌더링
 * @param ctx Canvas 2D context
 * @param x 중심 X 좌표
 * @param y 중심 Y 좌표
 * @param characterId 캐릭터 ID
 * @param direction 8방향
 * @param scale 스케일 (기본 1)
 * @param part 렌더링 파트 (full/upper/lower) - v5.9.3 스플릿 렌더링
 * @returns 렌더링 성공 여부 (false면 fallback 필요)
 */
export function drawCharacterSprite(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  characterId: PlayerClass,
  direction: Direction8,
  scale: number = 1,
  part: CharacterPart = 'full'
): boolean {
  const sprites = getCharacterSprites(characterId);
  if (!sprites) {
    return false; // 스프라이트 없음 → fallback 필요
  }

  // 방향에 해당하는 이미지 가져오기
  const imageKey = getImageKeyForDirection(direction);
  const image = sprites[imageKey];

  if (!image || !image.complete) {
    return false;
  }

  // 반전 필요 여부
  const flip = needsFlip(direction);

  // 원본 이미지 비율 유지하면서 크기 계산
  // 이미지가 세로로 길 수 있으므로 height 기준으로 스케일
  const targetHeight = DEFAULT_RENDER_SIZE * scale;
  const aspectRatio = image.width / image.height;
  const targetWidth = targetHeight * aspectRatio;

  ctx.save();
  ctx.translate(x, y);

  if (flip) {
    ctx.scale(-1, 1); // X축 반전
  }

  // v5.9.4: 상반신은 오프스크린 캔버스에서 그라데이션 페이드 처리
  if (part === 'upper') {
    // 오프스크린 캔버스 생성
    const offscreen = document.createElement('canvas');
    offscreen.width = targetWidth + 2;
    offscreen.height = targetHeight;
    const offCtx = offscreen.getContext('2d')!;
    offCtx.imageSmoothingEnabled = false;

    // 상반신만 클리핑해서 그리기
    const upperHeight = targetHeight * SPLIT_RATIO;
    offCtx.beginPath();
    offCtx.rect(0, 0, targetWidth + 2, upperHeight + 1);
    offCtx.clip();

    // 반전 처리
    if (flip) {
      offCtx.translate(targetWidth / 2 + 1, 0);
      offCtx.scale(-1, 1);
      offCtx.drawImage(image, -targetWidth / 2, 0, targetWidth, targetHeight);
    } else {
      offCtx.drawImage(image, 1, 0, targetWidth, targetHeight);
    }

    // 그라데이션 페이드아웃 적용
    const fadeHeight = targetHeight * 0.18; // 페이드 영역 (18%)
    const fadeStartY = upperHeight - fadeHeight;

    offCtx.globalCompositeOperation = 'destination-out';
    const gradient = offCtx.createLinearGradient(0, fadeStartY, 0, upperHeight);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,1)');
    offCtx.fillStyle = gradient;
    offCtx.fillRect(0, fadeStartY, targetWidth + 2, fadeHeight + 1);

    // 메인 캔버스에 그리기
    ctx.save();
    ctx.translate(x, y);
    ctx.drawImage(offscreen, -targetWidth / 2 - 1, -targetHeight / 2);
    ctx.restore();
    return true;
  }

  // v5.9.4: 'lower'는 전체 캐릭터를 그림 (뒷 레이어로 스킬 뒤에 배치)
  // 클리핑 없이 전체 캐릭터 렌더링

  if (flip) {
    ctx.scale(-1, 1); // X축 반전
  }

  // 이미지 중심점에 맞춰 그리기
  ctx.drawImage(
    image,
    -targetWidth / 2,
    -targetHeight / 2,
    targetWidth,
    targetHeight
  );

  ctx.restore();
  return true; // 성공
}

/**
 * 피격 효과가 있는 스프라이트 렌더링
 * 흰색 플래시 오버레이 적용
 */
export function drawCharacterSpriteWithHit(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  characterId: PlayerClass,
  direction: Direction8,
  scale: number = 1,
  hitFlash: boolean = false
): boolean {
  const drawn = drawCharacterSprite(ctx, x, y, characterId, direction, scale);

  if (drawn && hitFlash) {
    // 피격 효과: 흰색 오버레이
    // drawCatSprite의 hit flash와 동일한 방식
    const sprites = getCharacterSprites(characterId);
    if (sprites) {
      const imageKey = getImageKeyForDirection(direction);
      const image = sprites[imageKey];

      if (image && image.complete) {
        const targetHeight = DEFAULT_RENDER_SIZE * scale;
        const aspectRatio = image.width / image.height;
        const targetWidth = targetHeight * aspectRatio;

        ctx.save();
        ctx.translate(x, y);

        if (needsFlip(direction)) {
          ctx.scale(-1, 1);
        }

        // 흰색 오버레이 (반투명)
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fillRect(-targetWidth / 2, -targetHeight / 2, targetWidth, targetHeight);

        ctx.restore();
      }
    }
  }

  return drawn;
}

/**
 * 스프라이트 렌더링 (추가 옵션 포함)
 * alpha, rotation 등 추가 효과 지원
 */
export function drawCharacterSpriteAdvanced(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  characterId: PlayerClass,
  direction: Direction8,
  options: {
    scale?: number;
    alpha?: number;
    rotation?: number;
    hitFlash?: boolean;
    shadowColor?: string;
    shadowBlur?: number;
  } = {}
): boolean {
  const {
    scale = 1,
    alpha = 1,
    rotation = 0,
    hitFlash = false,
    shadowColor,
    shadowBlur = 0
  } = options;

  const sprites = getCharacterSprites(characterId);
  if (!sprites) {
    return false;
  }

  const imageKey = getImageKeyForDirection(direction);
  const image = sprites[imageKey];

  if (!image || !image.complete) {
    return false;
  }

  const flip = needsFlip(direction);
  const targetHeight = DEFAULT_RENDER_SIZE * scale;
  const aspectRatio = image.width / image.height;
  const targetWidth = targetHeight * aspectRatio;

  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = alpha;

  if (rotation !== 0) {
    ctx.rotate(rotation);
  }

  if (flip) {
    ctx.scale(-1, 1);
  }

  // 그림자 효과
  if (shadowColor && shadowBlur > 0) {
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = shadowBlur;
  }

  ctx.drawImage(
    image,
    -targetWidth / 2,
    -targetHeight / 2,
    targetWidth,
    targetHeight
  );

  // 피격 플래시
  if (hitFlash) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillRect(-targetWidth / 2, -targetHeight / 2, targetWidth, targetHeight);
  }

  ctx.restore();
  return true;
}
