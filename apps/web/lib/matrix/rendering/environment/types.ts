/**
 * game/rendering/environment/types.ts - 환경 렌더링 타입
 */

export type TerrainType =
  | 'mining'      // 1-5: 교실동
  | 'market'      // 6-10: 급식실
  | 'hack'        // 11-15: 체육관
  | 'infra'       // 16-20: 과학실
  | 'regulation'  // 21-25: 본관
  | 'void'        // 26-30: 탈출
  | 'singularity';// 한계돌파

export interface FloorTileParams {
  ctx: CanvasRenderingContext2D;
  x: number;
  y: number;
  size: number;
  type: 'node' | 'floor';
  stageId: number;
}

export interface TerrainFeatureParams {
  ctx: CanvasRenderingContext2D;
  x: number;
  y: number;
  size: number;
  terrain: TerrainType;
  hash: number;
  stageId: number;
}

export interface ObstacleParams {
  ctx: CanvasRenderingContext2D;
  x: number;
  y: number;
  type: string;
  scale?: number;
}
