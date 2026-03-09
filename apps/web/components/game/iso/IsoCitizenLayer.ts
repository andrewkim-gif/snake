/**
 * v27 Phase 6 — IsoCitizenLayer (완전 재작성)
 *
 * PixiJS 8 AnimatedSprite 기반 시민 렌더링
 * - 1920×1024 스프라이트 시트에서 128×128 프레임 추출 (15열 × 8행)
 * - 8방향 애니메이션 (S/SW/W/NW/N/NE/E/SE)
 * - 시민 상태(working/commuting/shopping/resting/protesting/idle) → 애니메이션 매핑
 * - 이동 벡터 → 8방향 감지
 * - MAX_VISIBLE_CITIZENS=100, Object pool 패턴
 * - 128px → 24~32px 스케일다운 (scale=0.2~0.25)
 *
 * @rewrite 2026-03-09 Phase 6
 */

import { Container, AnimatedSprite, Texture, Assets, Spritesheet, Graphics } from 'pixi.js';
import { tileToScreen } from './IsoTilemap';
import type { CitizenSnapshot } from '@agent-survivor/shared/types/city';
import {
  SPRITE_SHEET_SPEC,
  CITIZEN_STATE_TO_ANIMATION,
  CITIZEN_CHARACTER_TYPES,
  type CharacterAnimation,
  type SpriteDirection,
  type CitizenState,
} from '@/lib/iso/iso-asset-catalog';

// ─── Constants ───

/** 최대 화면 표시 시민 수 */
const MAX_VISIBLE_CITIZENS = 100;

/** 보간 속도 (0~1, 클수록 빠름) */
const LERP_SPEED = 0.15;

/** 시민 표시 스케일 (128px → ~28px) */
const CITIZEN_SCALE = 0.22;

/** 애니메이션 속도 (8fps / 60fps tick) */
const WALK_ANIM_SPEED = 8 / 60;
const RUN_ANIM_SPEED = 12 / 60;
const IDLE_ANIM_SPEED = 6 / 60;
const TAUNT_ANIM_SPEED = 8 / 60;

/** 시민 상태별 애니메이션 속도 */
const STATE_ANIM_SPEED: Record<string, number> = {
  working: WALK_ANIM_SPEED,
  commuting: RUN_ANIM_SPEED,
  shopping: WALK_ANIM_SPEED,
  resting: IDLE_ANIM_SPEED,
  protesting: TAUNT_ANIM_SPEED,
  idle: IDLE_ANIM_SPEED,
};

/** 8방향 인덱스 순서 (스프라이트 시트 행 순서) */
const DIRECTIONS: SpriteDirection[] = ['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE'];

/** FSM state → 색상 (폴백용) */
const STATE_COLORS: Record<string, number> = {
  working:    0x3388ff,
  commuting:  0xffcc00,
  shopping:   0x33cc33,
  resting:    0x999999,
  protesting: 0xff3333,
  idle:       0xffffff,
};

/** 이동 정지 판정 임계값 (px) */
const MOVEMENT_THRESHOLD = 0.5;

// ─── Types ───

/** 로드된 스프라이트 시트에서 추출한 방향별 프레임 텍스처 */
type DirectionFrames = Map<SpriteDirection, Texture[]>;

/** 애니메이션별 방향 프레임 캐시 */
type AnimFrameCache = Map<string, DirectionFrames>; // key: "{CharType}_{Animation}"

interface CitizenRenderState {
  /** 현재 보간된 스크린 좌표 */
  screenX: number;
  screenY: number;
  /** 목표 스크린 좌표 (최신 스냅샷에서) */
  targetX: number;
  targetY: number;
  /** 이전 스크린 좌표 (방향 감지용) */
  prevX: number;
  prevY: number;
  /** 현재 FSM 상태 */
  state: string;
  /** 현재 방향 인덱스 (0~7) */
  directionIdx: number;
  /** 할당된 캐릭터 타입 인덱스 */
  charTypeIdx: number;
  /** AnimatedSprite (스프라이트 시트 로드 시) */
  animSprite: AnimatedSprite | null;
  /** Graphics 폴백 (스프라이트 시트 미로드 시) */
  graphic: Graphics | null;
  /** 활성 상태 */
  active: boolean;
}

// ─── IsoCitizenLayer ───

export class IsoCitizenLayer {
  /** PixiJS container */
  readonly container: Container;

  /** 시민 ID → 렌더 상태 */
  private citizenStates: Map<string, CitizenRenderState> = new Map();

  /** 스프라이트 시트 로드 완료 여부 */
  private sheetsLoaded = false;

  /** 방향별 프레임 캐시: "{CharType}_{Animation}" → Map<Direction, Texture[]> */
  private animFrameCache: AnimFrameCache = new Map();

  /** AnimatedSprite 풀 (재사용) */
  private spritePool: AnimatedSprite[] = [];

  /** Graphics 풀 (폴백 재사용) */
  private graphicsPool: Graphics[] = [];

  /** 로드된 Spritesheet 인스턴스 (cleanup용) */
  private loadedSheets: Spritesheet[] = [];

  constructor() {
    this.container = new Container();
    this.container.label = 'CitizenLayer';
    this.container.sortableChildren = true;
  }

  // ─── Public API ───

  /**
   * 시민 스프라이트 시트 로드 (초기화 시 호출)
   * Walk, Run, Idle, Taunt × Player/NPC1/NPC2/NPC3 = 16 시트
   */
  async loadSpritesheets(): Promise<boolean> {
    try {
      const animations: CharacterAnimation[] = ['Walk', 'Run', 'Idle', 'Taunt'];
      const charTypes = CITIZEN_CHARACTER_TYPES;

      for (const charType of charTypes) {
        for (const anim of animations) {
          const cacheKey = `${charType}_${anim}`;
          const jsonPath = `/game/Characters/spritesheets/${encodeURIComponent(String(charType))}_${anim}.json`;

          // PixiJS 8 Assets로 JSON+이미지 로드
          let sheet: Spritesheet;
          try {
            sheet = await Assets.load<Spritesheet>(jsonPath);
          } catch {
            console.warn(`[IsoCitizenLayer] Failed to load sheet: ${jsonPath}`);
            continue;
          }

          this.loadedSheets.push(sheet);

          // 방향별 프레임 텍스처 추출
          const dirFrames: DirectionFrames = new Map();

          for (let dirIdx = 0; dirIdx < DIRECTIONS.length; dirIdx++) {
            const dir = DIRECTIONS[dirIdx];
            const frames: Texture[] = [];

            for (let col = 0; col < SPRITE_SHEET_SPEC.columns; col++) {
              const frameKey = `${dir}_${String(col).padStart(2, '0')}`;
              // Spritesheet.textures에서 프레임 텍스처 가져오기
              const tex = sheet.textures[frameKey];
              if (tex) {
                frames.push(tex);
              }
            }

            if (frames.length > 0) {
              dirFrames.set(dir, frames);
            }
          }

          this.animFrameCache.set(cacheKey, dirFrames);
        }
      }

      this.sheetsLoaded = this.animFrameCache.size > 0;
      console.log(`[IsoCitizenLayer] Loaded ${this.animFrameCache.size} animation sets, sheetsLoaded=${this.sheetsLoaded}`);
      return this.sheetsLoaded;
    } catch (err) {
      console.error('[IsoCitizenLayer] Failed to load spritesheets:', err);
      this.sheetsLoaded = false;
      return false;
    }
  }

  /**
   * 서버 스냅샷으로 시민 위치/상태 업데이트 (2Hz)
   * MAX_VISIBLE_CITIZENS=100 제한
   */
  updateFromSnapshot(citizens: CitizenSnapshot[]): void {
    const seenIds = new Set<string>();

    // 100명 제한 — 단순 슬라이스 (카메라 기반 컬링은 tick에서)
    const visibleCitizens = citizens.length > MAX_VISIBLE_CITIZENS
      ? citizens.slice(0, MAX_VISIBLE_CITIZENS)
      : citizens;

    for (const citizen of visibleCitizens) {
      seenIds.add(citizen.id);

      const { sx, sy } = tileToScreen(citizen.tileX, citizen.tileY);

      let rs = this.citizenStates.get(citizen.id);

      if (rs) {
        // 기존 시민: 목표 위치 업데이트
        rs.targetX = sx;
        rs.targetY = sy;

        // 상태 변경 시 애니메이션 교체
        if (rs.state !== citizen.state) {
          rs.state = citizen.state;
          this.updateCitizenAnimation(rs);
        }
      } else {
        // 신규 시민: 렌더 상태 생성
        const charTypeIdx = this.hashCitizenCharType(citizen.id);
        rs = {
          screenX: sx,
          screenY: sy,
          targetX: sx,
          targetY: sy,
          prevX: sx,
          prevY: sy,
          state: citizen.state,
          directionIdx: 0, // 기본 S
          charTypeIdx,
          animSprite: null,
          graphic: null,
          active: true,
        };

        this.citizenStates.set(citizen.id, rs);
        this.createCitizenVisual(rs);
      }
    }

    // 스냅샷에 없는 시민 제거
    for (const [id, rs] of this.citizenStates) {
      if (!seenIds.has(id)) {
        this.releaseCitizen(rs);
        this.citizenStates.delete(id);
      }
    }
  }

  /**
   * 매 프레임 호출: 위치 보간 + 방향 감지
   */
  tick(): void {
    for (const rs of this.citizenStates.values()) {
      if (!rs.active) continue;

      // 이전 위치 저장 (방향 감지용)
      const oldX = rs.screenX;
      const oldY = rs.screenY;

      // 선형 보간
      rs.screenX += (rs.targetX - rs.screenX) * LERP_SPEED;
      rs.screenY += (rs.targetY - rs.screenY) * LERP_SPEED;

      // 이동 벡터 기반 방향 감지
      const dx = rs.screenX - oldX;
      const dy = rs.screenY - oldY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > MOVEMENT_THRESHOLD) {
        const newDirIdx = vectorToDirectionIndex(dx, dy);
        if (newDirIdx !== rs.directionIdx) {
          rs.directionIdx = newDirIdx;
          this.updateCitizenDirection(rs);
        }
        rs.prevX = oldX;
        rs.prevY = oldY;
      }

      // 위치 적용
      if (rs.animSprite) {
        rs.animSprite.x = rs.screenX;
        rs.animSprite.y = rs.screenY;
        // 깊이 정렬: Y좌표 기반
        rs.animSprite.zIndex = Math.floor(rs.screenY);
      } else if (rs.graphic) {
        rs.graphic.x = rs.screenX;
        rs.graphic.y = rs.screenY;
        rs.graphic.zIndex = Math.floor(rs.screenY);
      }
    }
  }

  /** 활성 시민 수 */
  get citizenCount(): number {
    return this.citizenStates.size;
  }

  /** 스프라이트 시트 로드 여부 */
  get isLoaded(): boolean {
    return this.sheetsLoaded;
  }

  /** 리소스 정리 */
  destroy(): void {
    for (const rs of this.citizenStates.values()) {
      this.destroyCitizenVisual(rs);
    }
    this.citizenStates.clear();

    for (const s of this.spritePool) {
      s.destroy();
    }
    this.spritePool = [];

    for (const g of this.graphicsPool) {
      g.destroy();
    }
    this.graphicsPool = [];

    this.animFrameCache.clear();
    this.loadedSheets = [];
    this.container.destroy({ children: true });
  }

  // ─── Private: 시민 비주얼 생성/업데이트/해제 ───

  /** 시민 비주얼 생성 (AnimatedSprite 또는 Graphics 폴백) */
  private createCitizenVisual(rs: CitizenRenderState): void {
    if (this.sheetsLoaded) {
      const sprite = this.acquireSprite(rs);
      if (sprite) {
        rs.animSprite = sprite;
        this.container.addChild(sprite);
        return;
      }
    }

    // 폴백: 컬러 원
    const g = this.acquireGraphic(rs);
    rs.graphic = g;
    this.container.addChild(g);
  }

  /** AnimatedSprite 생성 또는 풀에서 가져오기 */
  private acquireSprite(rs: CitizenRenderState): AnimatedSprite | null {
    const frames = this.getFramesForCitizen(rs);
    if (!frames || frames.length === 0) return null;

    let sprite: AnimatedSprite;
    if (this.spritePool.length > 0) {
      sprite = this.spritePool.pop()!;
      sprite.textures = frames;
    } else {
      sprite = new AnimatedSprite(frames);
    }

    sprite.anchor.set(0.5, 0.85); // 발 아래 기준점
    sprite.scale.set(CITIZEN_SCALE);
    sprite.animationSpeed = STATE_ANIM_SPEED[rs.state] ?? WALK_ANIM_SPEED;
    sprite.loop = true;
    sprite.x = rs.screenX;
    sprite.y = rs.screenY;
    sprite.zIndex = Math.floor(rs.screenY);
    sprite.visible = true;

    // 랜덤 시작 프레임 (동기화 방지)
    const startFrame = Math.floor(Math.random() * frames.length);
    sprite.gotoAndPlay(startFrame);

    return sprite;
  }

  /** Graphics 폴백 생성 */
  private acquireGraphic(rs: CitizenRenderState): Graphics {
    let g: Graphics;
    if (this.graphicsPool.length > 0) {
      g = this.graphicsPool.pop()!;
    } else {
      g = new Graphics();
    }

    const color = STATE_COLORS[rs.state] ?? 0xffffff;
    g.clear();
    g.circle(0, -3, 3).fill({ color, alpha: 0.9 });
    g.circle(0, -3, 3).stroke({ width: 0.5, color: 0x000000, alpha: 0.4 });
    g.x = rs.screenX;
    g.y = rs.screenY;
    g.zIndex = Math.floor(rs.screenY);
    g.visible = true;
    return g;
  }

  /** 시민의 현재 상태+방향에 맞는 프레임 텍스처 배열 가져오기 */
  private getFramesForCitizen(rs: CitizenRenderState): Texture[] | null {
    const charType = CITIZEN_CHARACTER_TYPES[rs.charTypeIdx % CITIZEN_CHARACTER_TYPES.length];
    const animName = CITIZEN_STATE_TO_ANIMATION[rs.state as CitizenState] ?? 'Idle';
    const cacheKey = `${charType}_${animName}`;
    const dirFrames = this.animFrameCache.get(cacheKey);
    if (!dirFrames) return null;

    const dir = DIRECTIONS[rs.directionIdx] ?? 'S';
    return dirFrames.get(dir) ?? dirFrames.get('S') ?? null;
  }

  /** 시민 상태 변경 시 애니메이션 교체 */
  private updateCitizenAnimation(rs: CitizenRenderState): void {
    if (!rs.animSprite || !this.sheetsLoaded) {
      // 폴백 Graphics 색상 업데이트
      if (rs.graphic) {
        const color = STATE_COLORS[rs.state] ?? 0xffffff;
        rs.graphic.clear();
        rs.graphic.circle(0, -3, 3).fill({ color, alpha: 0.9 });
        rs.graphic.circle(0, -3, 3).stroke({ width: 0.5, color: 0x000000, alpha: 0.4 });
      }
      return;
    }

    const frames = this.getFramesForCitizen(rs);
    if (frames && frames.length > 0) {
      rs.animSprite.textures = frames;
      rs.animSprite.animationSpeed = STATE_ANIM_SPEED[rs.state] ?? WALK_ANIM_SPEED;
      rs.animSprite.play();
    }
  }

  /** 시민 방향 변경 시 프레임 세트 교체 */
  private updateCitizenDirection(rs: CitizenRenderState): void {
    if (!rs.animSprite || !this.sheetsLoaded) return;

    const frames = this.getFramesForCitizen(rs);
    if (frames && frames.length > 0) {
      // 현재 프레임 인덱스 보존하여 매끄러운 전환
      const currentFrame = rs.animSprite.currentFrame % frames.length;
      rs.animSprite.textures = frames;
      rs.animSprite.gotoAndPlay(currentFrame);
    }
  }

  /** 시민 렌더 상태 해제 (풀에 반환) */
  private releaseCitizen(rs: CitizenRenderState): void {
    if (rs.animSprite) {
      rs.animSprite.stop();
      this.container.removeChild(rs.animSprite);
      rs.animSprite.visible = false;
      this.spritePool.push(rs.animSprite);
      rs.animSprite = null;
    }
    if (rs.graphic) {
      this.container.removeChild(rs.graphic);
      rs.graphic.clear();
      rs.graphic.visible = false;
      this.graphicsPool.push(rs.graphic);
      rs.graphic = null;
    }
    rs.active = false;
  }

  /** 시민 비주얼 완전 파괴 */
  private destroyCitizenVisual(rs: CitizenRenderState): void {
    if (rs.animSprite) {
      rs.animSprite.stop();
      rs.animSprite.destroy();
      rs.animSprite = null;
    }
    if (rs.graphic) {
      rs.graphic.destroy();
      rs.graphic = null;
    }
  }

  /** 시민 ID → 캐릭터 타입 인덱스 (결정론적 해시) */
  private hashCitizenCharType(id: string): number {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
    }
    return Math.abs(hash) % CITIZEN_CHARACTER_TYPES.length;
  }
}

// ─── 유틸리티: 이동 벡터 → 8방향 인덱스 ───

/**
 * 2D 이동 벡터 → 가장 가까운 8방향 인덱스 (0~7)
 * 방향 순서: S(0), SW(1), W(2), NW(3), N(4), NE(5), E(6), SE(7)
 *
 * 아이소메트릭 좌표계:
 * - dx > 0 → 동(E) 방향, dx < 0 → 서(W) 방향
 * - dy > 0 → 남(S) 방향, dy < 0 → 북(N) 방향
 */
function vectorToDirectionIndex(dx: number, dy: number): number {
  // atan2로 각도 계산 (-PI ~ PI), 남쪽이 0도
  const angle = Math.atan2(dx, dy); // 주의: (dx, dy) 순서 — 남쪽=0
  // -PI ~ PI → 0 ~ 2PI
  const normalizedAngle = angle < 0 ? angle + Math.PI * 2 : angle;
  // 8방향 인덱스 (45도 단위), 반올림
  const idx = Math.round(normalizedAngle / (Math.PI / 4)) % 8;
  return idx;
}
