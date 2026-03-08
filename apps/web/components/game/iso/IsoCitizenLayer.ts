/**
 * v26 Phase 3 — IsoCitizenLayer
 * PixiJS Graphics 기반 시민 dot 렌더링
 *
 * - 시민을 작은 원(4px radius)으로 렌더링
 * - FSM 상태별 색상: working=파랑, commuting=노랑, shopping=초록,
 *   resting=회색, protesting=빨강, idle=하양
 * - 타일 좌표 → 아이소메트릭 스크린 좌표 변환
 * - 위치 보간으로 부드러운 이동
 */

import { Container, Graphics } from 'pixi.js';
import { tileToScreen } from './IsoTilemap';
import type { CitizenSnapshot } from '@agent-survivor/shared/types/city';

// ─── Constants ───

/** Citizen dot radius in pixels */
const CITIZEN_RADIUS = 3;

/** FSM state → hex color */
const STATE_COLORS: Record<string, number> = {
  working:    0x3388ff, // blue
  commuting:  0xffcc00, // yellow
  shopping:   0x33cc33, // green
  resting:    0x999999, // gray
  protesting: 0xff3333, // red
  idle:       0xffffff, // white
};

/** Interpolation speed (0~1, higher = faster catch-up) */
const LERP_SPEED = 0.15;

// ─── Internal citizen position tracker for smooth movement ───

interface CitizenRenderState {
  /** Current interpolated screen position */
  screenX: number;
  screenY: number;
  /** Target screen position (from latest snapshot) */
  targetX: number;
  targetY: number;
  /** Current color (from FSM state) */
  color: number;
  /** Graphics object for this citizen */
  graphic: Graphics;
}

// ─── IsoCitizenLayer ───

export class IsoCitizenLayer {
  /** PixiJS container holding all citizen dots */
  readonly container: Container;

  /** Map of citizen ID → render state */
  private citizenStates: Map<string, CitizenRenderState> = new Map();

  /** Pool of reusable Graphics objects */
  private graphicsPool: Graphics[] = [];

  constructor() {
    this.container = new Container();
    this.container.label = 'CitizenLayer';
    // Citizens render above buildings
    this.container.zIndex = 100;
  }

  /**
   * Update citizen positions from server snapshot.
   * Called when new city_state arrives (2Hz).
   */
  updateFromSnapshot(citizens: CitizenSnapshot[]): void {
    const seenIds = new Set<string>();

    for (const citizen of citizens) {
      seenIds.add(citizen.id);

      const { sx, sy } = tileToScreen(citizen.tileX, citizen.tileY);
      const color = STATE_COLORS[citizen.state] ?? 0xffffff;

      let state = this.citizenStates.get(citizen.id);

      if (state) {
        // Existing citizen: update target position and color
        state.targetX = sx;
        state.targetY = sy;
        state.color = color;
      } else {
        // New citizen: create render state
        const graphic = this.acquireGraphic();
        state = {
          screenX: sx,
          screenY: sy,
          targetX: sx,
          targetY: sy,
          color,
          graphic,
        };
        this.citizenStates.set(citizen.id, state);
        this.container.addChild(graphic);
      }

      // Immediately redraw color (in case state changed)
      this.drawCitizenDot(state);
    }

    // Remove citizens no longer in snapshot
    for (const [id, state] of this.citizenStates) {
      if (!seenIds.has(id)) {
        this.container.removeChild(state.graphic);
        this.releaseGraphic(state.graphic);
        this.citizenStates.delete(id);
      }
    }
  }

  /**
   * Interpolate citizen positions for smooth movement.
   * Call this every frame from the PixiJS ticker.
   */
  tick(): void {
    for (const state of this.citizenStates.values()) {
      // Lerp toward target
      state.screenX += (state.targetX - state.screenX) * LERP_SPEED;
      state.screenY += (state.targetY - state.screenY) * LERP_SPEED;

      // Update graphic position
      state.graphic.x = state.screenX;
      state.graphic.y = state.screenY;
    }
  }

  /**
   * Get the number of currently rendered citizens.
   */
  get citizenCount(): number {
    return this.citizenStates.size;
  }

  /**
   * Clean up all resources.
   */
  destroy(): void {
    for (const state of this.citizenStates.values()) {
      state.graphic.destroy();
    }
    this.citizenStates.clear();
    for (const g of this.graphicsPool) {
      g.destroy();
    }
    this.graphicsPool = [];
    this.container.destroy({ children: true });
  }

  // ─── Private helpers ───

  /** Draw a citizen dot at the graphic's local origin. */
  private drawCitizenDot(state: CitizenRenderState): void {
    const g = state.graphic;
    g.clear();
    // Filled circle
    g.circle(0, -CITIZEN_RADIUS, CITIZEN_RADIUS).fill({
      color: state.color,
      alpha: 0.9,
    });
    // Slight outline for visibility
    g.circle(0, -CITIZEN_RADIUS, CITIZEN_RADIUS).stroke({
      width: 0.5,
      color: 0x000000,
      alpha: 0.4,
    });
    // Position
    g.x = state.screenX;
    g.y = state.screenY;
  }

  /** Get a Graphics object from the pool or create a new one. */
  private acquireGraphic(): Graphics {
    if (this.graphicsPool.length > 0) {
      return this.graphicsPool.pop()!;
    }
    return new Graphics();
  }

  /** Return a Graphics object to the pool for reuse. */
  private releaseGraphic(g: Graphics): void {
    g.clear();
    this.graphicsPool.push(g);
  }
}
