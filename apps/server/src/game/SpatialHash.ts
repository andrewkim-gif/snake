/**
 * Spatial Hash Grid — O(1) 이웃 검색
 * 200x200 셀, 아레나 지름 12000 → 60x60 그리드
 */

import type { Position, Orb } from '@snake-arena/shared';

interface SegmentEntry {
  snakeId: string;
  segIndex: number;
  x: number;
  y: number;
}

export class SpatialHash {
  private cellSize: number;
  private halfSize: number; // 아레나 반지름 (offset용)
  private gridDim: number;
  private segmentGrid: Map<number, SegmentEntry[]>;
  private orbGrid: Map<number, Orb[]>;

  constructor(arenaRadius: number, cellSize: number = 200) {
    this.cellSize = cellSize;
    this.halfSize = arenaRadius;
    this.gridDim = Math.ceil((arenaRadius * 2) / cellSize);
    this.segmentGrid = new Map();
    this.orbGrid = new Map();
  }

  clear(): void {
    this.segmentGrid.clear();
    this.orbGrid.clear();
  }

  private getKey(x: number, y: number): number {
    const cx = Math.floor((x + this.halfSize) / this.cellSize);
    const cy = Math.floor((y + this.halfSize) / this.cellSize);
    return cy * this.gridDim + cx;
  }

  insertSegment(snakeId: string, segIndex: number, pos: Position): void {
    const key = this.getKey(pos.x, pos.y);
    let cell = this.segmentGrid.get(key);
    if (!cell) {
      cell = [];
      this.segmentGrid.set(key, cell);
    }
    cell.push({ snakeId, segIndex, x: pos.x, y: pos.y });
  }

  insertOrb(orb: Orb): void {
    const key = this.getKey(orb.position.x, orb.position.y);
    let cell = this.orbGrid.get(key);
    if (!cell) {
      cell = [];
      this.orbGrid.set(key, cell);
    }
    cell.push(orb);
  }

  /** 주변 세그먼트 쿼리 (해당 셀 + 인접 8셀) */
  querySegments(pos: Position, radius: number): SegmentEntry[] {
    const results: SegmentEntry[] = [];
    const cellRadius = Math.ceil(radius / this.cellSize);
    const cx = Math.floor((pos.x + this.halfSize) / this.cellSize);
    const cy = Math.floor((pos.y + this.halfSize) / this.cellSize);

    for (let dy = -cellRadius; dy <= cellRadius; dy++) {
      for (let dx = -cellRadius; dx <= cellRadius; dx++) {
        const key = (cy + dy) * this.gridDim + (cx + dx);
        const cell = this.segmentGrid.get(key);
        if (cell) {
          for (let i = 0; i < cell.length; i++) {
            results.push(cell[i]);
          }
        }
      }
    }
    return results;
  }

  /** 주변 orb 쿼리 */
  queryOrbs(pos: Position, radius: number): Orb[] {
    const results: Orb[] = [];
    const cellRadius = Math.ceil(radius / this.cellSize);
    const cx = Math.floor((pos.x + this.halfSize) / this.cellSize);
    const cy = Math.floor((pos.y + this.halfSize) / this.cellSize);

    for (let dy = -cellRadius; dy <= cellRadius; dy++) {
      for (let dx = -cellRadius; dx <= cellRadius; dx++) {
        const key = (cy + dy) * this.gridDim + (cx + dx);
        const cell = this.orbGrid.get(key);
        if (cell) {
          for (let i = 0; i < cell.length; i++) {
            results.push(cell[i]);
          }
        }
      }
    }
    return results;
  }
}
