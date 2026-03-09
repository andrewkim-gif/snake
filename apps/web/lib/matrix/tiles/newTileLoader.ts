/**
 * game/tiles/newTileLoader.ts - 새 타일 시스템 로더 (tile_n/ 폴더)
 *
 * v6.8: 추후 구현 예정 - 현재는 stub
 */

// 새 타일 타입 (추후 확장)
export type NewTileType =
  | 'advertising'
  | 'building'
  | 'buildingBlock'
  | 'road'
  | 'sidewalk'
  | 'satellite';

// 로드 상태
let tilesLoaded = false;

/**
 * 모든 새 타일 로드 (stub)
 */
export async function loadAllNewTiles(): Promise<void> {
  // 추후 구현
  tilesLoaded = true;
  console.log('[NewTileLoader] Stub loaded');
}

/**
 * 새 타일 로드 상태 확인
 */
export function areNewTilesLoaded(): boolean {
  return tilesLoaded;
}

/**
 * 새 타일 프레임 가져오기 (stub)
 */
export function getNewTileFrame(
  _type: NewTileType,
  _index: number
): HTMLImageElement | null {
  return null;
}

/**
 * 새 타일 크기 가져오기
 */
export function getNewTileSize(): { width: number; height: number } {
  return { width: 128, height: 128 };
}

/**
 * 새 타일 스프라이트 시트 가져오기 (stub)
 */
export function getNewTileSpriteSheet(
  _type: NewTileType
): HTMLImageElement | null {
  return null;
}

/**
 * 새 타일 그리기 (stub)
 */
export function drawNewTile(
  _ctx: CanvasRenderingContext2D,
  _type: NewTileType,
  _x: number,
  _y: number,
  _index?: number
): void {
  // 추후 구현
}
