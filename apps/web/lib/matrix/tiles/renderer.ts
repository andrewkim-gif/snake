/**
 * game/tiles/renderer.ts - 타일 기반 맵 렌더링
 *
 * 이소메트릭 Ground 타일 렌더링 시스템
 */

import {
  getGroundTile,
  areTilesLoaded,
  type GroundTileType,
  type TileDirection,
} from './loader';
import {
  getTileTypeAt,
  getTileDirectionAt,
  getStageMapConfig,
} from '../map/biomes';

// 타일 크기 (원본: 128x256, 게임에서 축소)
export const TILE_WIDTH = 128;
export const TILE_HEIGHT = 256;
export const TILE_SCALE = 0.5; // 게임에 맞게 축소

// 실제 렌더링 크기
export const RENDER_TILE_WIDTH = TILE_WIDTH * TILE_SCALE;   // 64
export const RENDER_TILE_HEIGHT = TILE_HEIGHT * TILE_SCALE; // 128

// 이소메트릭 그리드 변환 (카테시안 → 이소메트릭)
// 이소메트릭 타일은 다이아몬드 형태
export function cartesianToIsometric(cartX: number, cartY: number): { isoX: number; isoY: number } {
  return {
    isoX: (cartX - cartY) * (RENDER_TILE_WIDTH / 2),
    isoY: (cartX + cartY) * (RENDER_TILE_HEIGHT / 4), // 다이아몬드 높이의 절반
  };
}

// 이소메트릭 → 카테시안
export function isometricToCartesian(isoX: number, isoY: number): { cartX: number; cartY: number } {
  const cartX = (isoX / (RENDER_TILE_WIDTH / 2) + isoY / (RENDER_TILE_HEIGHT / 4)) / 2;
  const cartY = (isoY / (RENDER_TILE_HEIGHT / 4) - isoX / (RENDER_TILE_WIDTH / 2)) / 2;
  return { cartX, cartY };
}

// v7.8.7: seededRandom 제거됨 - biomes.ts의 노이즈 시스템 사용

/**
 * 단일 이소메트릭 타일 렌더링
 */
export function drawIsometricTile(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  type: GroundTileType,
  direction: TileDirection,
  scale: number = TILE_SCALE
): boolean {
  const tile = getGroundTile(type, direction);
  if (!tile || !tile.complete) return false;

  const w = TILE_WIDTH * scale;
  const h = TILE_HEIGHT * scale;

  // 이소메트릭 타일은 중앙 하단 기준으로 그림
  ctx.drawImage(
    tile,
    screenX - w / 2,
    screenY - h,
    w,
    h
  );

  return true;
}

/**
 * 그리드 기반 타일 렌더링 (기존 drawFloorTile 대체)
 * v7.8.7: biomes.ts 계층적 클러스터 시스템 적용 (비슷한 타일끼리 그룹화)
 */
export function drawTileAtGrid(
  ctx: CanvasRenderingContext2D,
  gridX: number,
  gridY: number,
  cameraX: number,
  cameraY: number,
  stageId: number = 1,
  gameMode?: 'stage' | 'singularity' | 'tutorial'
): boolean {
  if (!areTilesLoaded()) return false;

  // v7.8.7: biomes.ts의 계층적 클러스터 시스템 사용
  // 그리드 좌표를 월드 좌표로 변환 (타일 크기 기준)
  const worldX = gridX * RENDER_TILE_WIDTH;
  const worldY = gridY * RENDER_TILE_HEIGHT;
  const config = getStageMapConfig(stageId, gameMode);

  // 타일 타입과 방향을 biomes 시스템에서 결정 (클러스터 기반)
  const type = getTileTypeAt(worldX, worldY, config, stageId);
  const direction = getTileDirectionAt(worldX, worldY, config, stageId);

  // 이소메트릭 좌표 계산
  const { isoX, isoY } = cartesianToIsometric(gridX, gridY);

  // 카메라 오프셋 적용
  const screenX = isoX - cameraX;
  const screenY = isoY - cameraY;

  return drawIsometricTile(ctx, screenX, screenY, type, direction);
}

/**
 * 화면에 보이는 모든 타일 렌더링
 */
export function drawVisibleTiles(
  ctx: CanvasRenderingContext2D,
  cameraX: number,
  cameraY: number,
  canvasWidth: number,
  canvasHeight: number,
  stageId: number = 1
): void {
  if (!areTilesLoaded()) return;

  // 화면에 보이는 그리드 범위 계산
  // 이소메트릭이므로 더 넓은 범위 필요
  const padding = 4; // 여유 타일

  // 화면 중심의 그리드 좌표
  const centerCart = isometricToCartesian(cameraX, cameraY);

  // 화면 크기에 따른 타일 수 계산
  const tilesX = Math.ceil(canvasWidth / RENDER_TILE_WIDTH) + padding * 2;
  const tilesY = Math.ceil(canvasHeight / (RENDER_TILE_HEIGHT / 2)) + padding * 2;

  // 렌더링 순서: 뒤에서 앞으로 (y축 기준)
  const startX = Math.floor(centerCart.cartX) - tilesX;
  const startY = Math.floor(centerCart.cartY) - tilesY;
  const endX = Math.ceil(centerCart.cartX) + tilesX;
  const endY = Math.ceil(centerCart.cartY) + tilesY;

  // y축 기준으로 정렬하여 렌더링 (뒤→앞)
  for (let y = startY; y <= endY; y++) {
    for (let x = startX; x <= endX; x++) {
      drawTileAtGrid(ctx, x, y, cameraX, cameraY, stageId);
    }
  }
}

/**
 * 직교 좌표계 타일 렌더링 (비-이소메트릭, 기존 시스템 호환)
 * v7.8.7: biomes.ts 계층적 클러스터 시스템 적용
 *
 * 기존 게임이 직교 좌표계를 사용하므로 이 함수 사용
 */
export function drawOrthogonalTile(
  ctx: CanvasRenderingContext2D,
  worldX: number,
  worldY: number,
  tileSize: number,
  cameraX: number,
  cameraY: number,
  stageId: number = 1,
  gameMode?: 'stage' | 'singularity' | 'tutorial'
): boolean {
  if (!areTilesLoaded()) return false;

  // v7.8.7: biomes.ts의 계층적 클러스터 시스템 사용
  const config = getStageMapConfig(stageId, gameMode);
  const type = getTileTypeAt(worldX, worldY, config, stageId);
  const direction = getTileDirectionAt(worldX, worldY, config, stageId);

  const tile = getGroundTile(type, direction);
  if (!tile || !tile.complete) return false;

  // 화면 좌표
  const screenX = worldX - cameraX;
  const screenY = worldY - cameraY;

  // 타일 크기에 맞게 스케일 조정
  ctx.drawImage(tile, screenX, screenY, tileSize, tileSize);
  return true;
}

/**
 * 직교 좌표계 화면 전체 타일 렌더링
 */
export function drawOrthogonalTiles(
  ctx: CanvasRenderingContext2D,
  cameraX: number,
  cameraY: number,
  canvasWidth: number,
  canvasHeight: number,
  tileSize: number,
  stageId: number = 1
): void {
  if (!areTilesLoaded()) {
    // 타일 미로드 시 기본 색상으로 fallback
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    return;
  }

  // 시작/끝 타일 인덱스 계산
  const startCol = Math.floor(cameraX / tileSize);
  const startRow = Math.floor(cameraY / tileSize);
  const endCol = Math.ceil((cameraX + canvasWidth) / tileSize);
  const endRow = Math.ceil((cameraY + canvasHeight) / tileSize);

  // 타일 렌더링
  for (let row = startRow; row <= endRow; row++) {
    for (let col = startCol; col <= endCol; col++) {
      const worldX = col * tileSize;
      const worldY = row * tileSize;
      drawOrthogonalTile(ctx, worldX, worldY, tileSize, cameraX, cameraY, stageId);
    }
  }
}
