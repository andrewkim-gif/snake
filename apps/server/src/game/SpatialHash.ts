/**
 * Spatial Hash Grid v10 — 에이전트 위치 + 오브 관리
 * v7: SegmentEntry (세그먼트별 엔트리) → v10: AgentEntry (에이전트 위치만)
 * 엔트리 수 93% 감소 (300→20)
 * 하위 호환: insertSegment/querySegments 유지 (deprecated)
 */

import type { Position, Orb } from '@snake-arena/shared';

/** v10: 에이전트 위치 엔트리 */
export interface AgentEntry {
  agentId: string;
  x: number;
  y: number;
}

/** @deprecated v10: AgentEntry 사용 */
export interface SegmentEntry {
  snakeId: string;
  segIndex: number;
  x: number;
  y: number;
}

export class SpatialHash {
  private cellSize: number;
  private halfSize: number; // 아레나 반지름 (offset용)
  private gridDim: number;
  private agentGrid: Map<number, AgentEntry[]>;
  private orbGrid: Map<number, Orb[]>;
  private activeAgentKeys: number[] = [];
  private activeOrbKeys: number[] = [];

  // 하위 호환용 (deprecated)
  private segmentGrid: Map<number, SegmentEntry[]>;
  private activeSegmentKeys: number[] = [];

  constructor(arenaRadius: number, cellSize: number = 200) {
    this.cellSize = cellSize;
    this.halfSize = arenaRadius;
    this.gridDim = Math.ceil((arenaRadius * 2) / cellSize);
    this.agentGrid = new Map();
    this.orbGrid = new Map();
    this.segmentGrid = new Map();
  }

  clear(): void {
    // Agent grid 클리어
    for (const key of this.activeAgentKeys) {
      const cell = this.agentGrid.get(key);
      if (cell) cell.length = 0;
    }
    this.activeAgentKeys.length = 0;

    // Orb grid 클리어
    for (const key of this.activeOrbKeys) {
      const cell = this.orbGrid.get(key);
      if (cell) cell.length = 0;
    }
    this.activeOrbKeys.length = 0;

    // Segment grid 클리어 (하위 호환)
    for (const key of this.activeSegmentKeys) {
      const cell = this.segmentGrid.get(key);
      if (cell) cell.length = 0;
    }
    this.activeSegmentKeys.length = 0;
  }

  private getKey(x: number, y: number): number {
    const cx = Math.floor((x + this.halfSize) / this.cellSize);
    const cy = Math.floor((y + this.halfSize) / this.cellSize);
    return cy * this.gridDim + cx;
  }

  /** v10: 에이전트 위치 삽입 */
  insertAgent(agentId: string, pos: Position): void {
    const key = this.getKey(pos.x, pos.y);
    let cell = this.agentGrid.get(key);
    if (!cell) {
      cell = [];
      this.agentGrid.set(key, cell);
    }
    if (cell.length === 0) this.activeAgentKeys.push(key);
    cell.push({ agentId, x: pos.x, y: pos.y });
  }

  /** v10: 주변 에이전트 쿼리 */
  queryAgents(pos: Position, radius: number): AgentEntry[] {
    const results: AgentEntry[] = [];
    const cellRadius = Math.ceil(radius / this.cellSize);
    const cx = Math.floor((pos.x + this.halfSize) / this.cellSize);
    const cy = Math.floor((pos.y + this.halfSize) / this.cellSize);

    for (let dy = -cellRadius; dy <= cellRadius; dy++) {
      for (let dx = -cellRadius; dx <= cellRadius; dx++) {
        const key = (cy + dy) * this.gridDim + (cx + dx);
        const cell = this.agentGrid.get(key);
        if (cell) {
          for (let i = 0; i < cell.length; i++) {
            results.push(cell[i]);
          }
        }
      }
    }
    return results;
  }

  insertOrb(orb: Orb): void {
    const key = this.getKey(orb.position.x, orb.position.y);
    let cell = this.orbGrid.get(key);
    if (!cell) {
      cell = [];
      this.orbGrid.set(key, cell);
    }
    if (cell.length === 0) this.activeOrbKeys.push(key);
    cell.push(orb);
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

  // ─── 하위 호환 메서드 (deprecated) ───

  /** @deprecated v10: insertAgent 사용 */
  insertSegment(snakeId: string, segIndex: number, pos: Position): void {
    const key = this.getKey(pos.x, pos.y);
    let cell = this.segmentGrid.get(key);
    if (!cell) {
      cell = [];
      this.segmentGrid.set(key, cell);
    }
    if (cell.length === 0) this.activeSegmentKeys.push(key);
    cell.push({ snakeId, segIndex, x: pos.x, y: pos.y });
  }

  /** @deprecated v10: queryAgents 사용 */
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
}
