/**
 * multiplayer/viewport-culler.ts — 뷰포트 컬링 + LOD 시스템
 *
 * v33 Phase 4: 화면 밖 플레이어/엔티티 렌더링 스킵
 * LOD 기반 원거리 단순화 (HIGH → MID → LOW → CULL)
 *
 * 기존 enemies/renderContext의 LOD 시스템과 연동하되,
 * 멀티플레이어 전용 거리 기반 LOD를 추가한다.
 */

import type { InterpolatedPlayer } from '../../systems/online-sync';
import type {
  ViewportBounds,
  CullingResult,
  LODThresholds,
} from './types';
import {
  DEFAULT_LOD_THRESHOLDS,
  VIEWPORT_PADDING,
} from './constants';

// ─── LOD 레벨 ───

export const LOD_HIGH = 0;
export const LOD_MID = 1;
export const LOD_LOW = 2;

// ─── ViewportCuller 클래스 ───

export class ViewportCuller {
  private thresholds: LODThresholds;
  private _lastBounds: ViewportBounds = { left: 0, top: 0, right: 0, bottom: 0 };
  private _lastCameraCenter = { x: 0, y: 0 };

  constructor(thresholds?: LODThresholds) {
    this.thresholds = thresholds ?? DEFAULT_LOD_THRESHOLDS;
  }

  /**
   * 뷰포트 바운드 계산 (월드 좌표)
   * 카메라 위치 + 캔버스 크기 + 줌 → 월드 좌표 AABB
   */
  calculateBounds(
    cameraX: number,
    cameraY: number,
    canvasWidth: number,
    canvasHeight: number,
    zoom: number
  ): ViewportBounds {
    const halfW = (canvasWidth / 2) / zoom + VIEWPORT_PADDING;
    const halfH = (canvasHeight / 2) / zoom + VIEWPORT_PADDING;

    this._lastBounds = {
      left: cameraX - halfW,
      top: cameraY - halfH,
      right: cameraX + halfW,
      bottom: cameraY + halfH,
    };
    this._lastCameraCenter = { x: cameraX, y: cameraY };

    return this._lastBounds;
  }

  /**
   * 플레이어 컬링 + LOD 분류
   * 뷰포트 밖 → 제거, 거리별 → HIGH/MID/LOW LOD 할당
   */
  cullPlayers(
    players: InterpolatedPlayer[],
    bounds: ViewportBounds,
    cameraX: number,
    cameraY: number
  ): CullingResult {
    const visible: InterpolatedPlayer[] = [];
    let culledCount = 0;
    const lodCounts = { high: 0, mid: 0, low: 0 };

    for (const player of players) {
      // AABB 기본 컬링
      if (
        player.x < bounds.left ||
        player.x > bounds.right ||
        player.y < bounds.top ||
        player.y > bounds.bottom
      ) {
        culledCount++;
        continue;
      }

      // 거리 기반 LOD + 추가 컬링
      const dx = player.x - cameraX;
      const dy = player.y - cameraY;
      const distSq = dx * dx + dy * dy;

      if (distSq > this.thresholds.cullDistance * this.thresholds.cullDistance) {
        culledCount++;
        continue;
      }

      visible.push(player);

      if (distSq < this.thresholds.midDistance * this.thresholds.midDistance) {
        lodCounts.high++;
      } else if (distSq < this.thresholds.lowDistance * this.thresholds.lowDistance) {
        lodCounts.mid++;
      } else {
        lodCounts.low++;
      }
    }

    return { visible, culledCount, lodCounts };
  }

  /**
   * 단일 플레이어의 LOD 레벨 계산
   * @returns 0=HIGH, 1=MID, 2=LOW
   */
  getPlayerLOD(playerX: number, playerY: number, cameraX: number, cameraY: number): number {
    const dx = playerX - cameraX;
    const dy = playerY - cameraY;
    const distSq = dx * dx + dy * dy;

    if (distSq < this.thresholds.midDistance * this.thresholds.midDistance) return LOD_HIGH;
    if (distSq < this.thresholds.lowDistance * this.thresholds.lowDistance) return LOD_MID;
    return LOD_LOW;
  }

  /**
   * 포인트가 뷰포트 내에 있는지 확인
   */
  isInViewport(x: number, y: number, bounds?: ViewportBounds): boolean {
    const b = bounds ?? this._lastBounds;
    return x >= b.left && x <= b.right && y >= b.top && y <= b.bottom;
  }

  /**
   * 현재 LOD 임계값 업데이트 (런타임 조절)
   */
  updateThresholds(thresholds: Partial<LODThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  /** 마지막 계산된 뷰포트 바운드 */
  get lastBounds(): ViewportBounds {
    return this._lastBounds;
  }

  /** 마지막 카메라 중심 */
  get lastCameraCenter(): { x: number; y: number } {
    return this._lastCameraCenter;
  }
}
