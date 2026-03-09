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

import { Container, Graphics, Sprite } from 'pixi.js';
import { tileToScreen } from './IsoTilemap';
import type { CitizenSnapshot } from '@agent-survivor/shared/types/city';
import { getCitizenTexture, isTexturesLoaded } from '@/lib/iso-texture-loader';

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

/** Phase 8: Maximum visible citizens for performance (cap rendering even if more exist) */
const MAX_VISIBLE_CITIZENS = 100;

// ─── Internal citizen position tracker for smooth movement ───

/** Citizen sprite size (px) when using textures */
const CITIZEN_SPRITE_SIZE = 12;

interface CitizenRenderState {
  /** Current interpolated screen position */
  screenX: number;
  screenY: number;
  /** Target screen position (from latest snapshot) */
  targetX: number;
  targetY: number;
  /** Current color (from FSM state) */
  color: number;
  /** Current FSM state string */
  state: string;
  /** Graphics object for this citizen (fallback) */
  graphic: Graphics;
  /** Sprite object for this citizen (when textures available) */
  sprite: Sprite | null;
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
   * Phase 8: Limits to MAX_VISIBLE_CITIZENS for performance.
   */
  updateFromSnapshot(citizens: CitizenSnapshot[]): void {
    const seenIds = new Set<string>();
    const useTextures = isTexturesLoaded();

    // Phase 8: Limit rendered citizens for performance
    const visibleCitizens = citizens.length > MAX_VISIBLE_CITIZENS
      ? citizens.slice(0, MAX_VISIBLE_CITIZENS)
      : citizens;

    for (const citizen of visibleCitizens) {
      seenIds.add(citizen.id);

      const { sx, sy } = tileToScreen(citizen.tileX, citizen.tileY);
      const color = STATE_COLORS[citizen.state] ?? 0xffffff;

      let renderState = this.citizenStates.get(citizen.id);

      if (renderState) {
        // Existing citizen: update target position and color
        renderState.targetX = sx;
        renderState.targetY = sy;
        renderState.color = color;

        // Phase 7: 상태 변경 시 스프라이트 텍스처 교체
        if (renderState.state !== citizen.state) {
          renderState.state = citizen.state;
          if (useTextures && renderState.sprite) {
            const tex = getCitizenTexture(citizen.state);
            if (tex) {
              renderState.sprite.texture = tex;
            }
          }
        }
      } else {
        // New citizen: create render state
        const graphic = this.acquireGraphic();
        let sprite: Sprite | null = null;

        // Phase 7: 텍스처 사용 가능하면 Sprite 생성
        if (useTextures) {
          const tex = getCitizenTexture(citizen.state);
          if (tex) {
            sprite = new Sprite(tex);
            sprite.anchor.set(0.5, 1.0);
            sprite.width = CITIZEN_SPRITE_SIZE;
            sprite.height = CITIZEN_SPRITE_SIZE;
            sprite.x = sx;
            sprite.y = sy;
            // 스프라이트 사용 시 그래픽 숨김
            graphic.visible = false;
            this.container.addChild(sprite);
          }
        }

        renderState = {
          screenX: sx,
          screenY: sy,
          targetX: sx,
          targetY: sy,
          color,
          state: citizen.state,
          graphic,
          sprite,
        };
        this.citizenStates.set(citizen.id, renderState);

        // Sprite가 없을 때만 Graphics 사용
        if (!sprite) {
          this.container.addChild(graphic);
        }
      }

      // Sprite가 없을 때만 Graphics dot 다시 그리기
      if (!renderState.sprite) {
        this.drawCitizenDot(renderState);
      }
    }

    // Remove citizens no longer in snapshot
    for (const [id, renderState] of this.citizenStates) {
      if (!seenIds.has(id)) {
        if (renderState.sprite) {
          this.container.removeChild(renderState.sprite);
          renderState.sprite.destroy();
        } else {
          this.container.removeChild(renderState.graphic);
        }
        this.releaseGraphic(renderState.graphic);
        this.citizenStates.delete(id);
      }
    }
  }

  /**
   * Interpolate citizen positions for smooth movement.
   * Call this every frame from the PixiJS ticker.
   */
  tick(): void {
    for (const renderState of this.citizenStates.values()) {
      // Lerp toward target
      renderState.screenX += (renderState.targetX - renderState.screenX) * LERP_SPEED;
      renderState.screenY += (renderState.targetY - renderState.screenY) * LERP_SPEED;

      // Update position (sprite or graphic)
      if (renderState.sprite) {
        renderState.sprite.x = renderState.screenX;
        renderState.sprite.y = renderState.screenY;
      } else {
        renderState.graphic.x = renderState.screenX;
        renderState.graphic.y = renderState.screenY;
      }
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
    for (const renderState of this.citizenStates.values()) {
      renderState.graphic.destroy();
      if (renderState.sprite) {
        renderState.sprite.destroy();
      }
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
