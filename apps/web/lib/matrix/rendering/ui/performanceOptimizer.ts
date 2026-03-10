/**
 * performanceOptimizer.ts - v37 Phase 9: 성능 최적화 유틸리티
 *
 * 기존 renderContext.ts LOD 시스템을 보강하는 추가 최적화 모듈.
 *
 * 주요 기능:
 * 1. 범용 오브젝트 풀 (Object Pool) — 파티클/이펙트 재사용
 * 2. Canvas 오프스크린 버퍼 캐싱 — 반복 렌더링 최적화
 * 3. LOD 기반 이펙트 복잡도 자동 조절
 * 4. 프레임 타임 모니터링 + 적응형 품질 조절
 *
 * 사용법:
 *   import { ObjectPool, OffscreenBufferCache, AdaptiveQuality } from './performanceOptimizer';
 */

// ============================================
// 1. 범용 오브젝트 풀 (Generic Object Pool)
// ============================================

/**
 * 범용 오브젝트 풀.
 * 파티클, 이펙트 등 빈번하게 생성/해제되는 객체를 재사용.
 *
 * 사용 예:
 * ```ts
 * interface MyParticle { x: number; y: number; active: boolean; }
 * const pool = new ObjectPool<MyParticle>(
 *   () => ({ x: 0, y: 0, active: false }),
 *   (p) => { p.x = 0; p.y = 0; p.active = false; },
 *   500,
 * );
 * const p = pool.acquire();
 * p.x = 100; p.active = true;
 * // 사용 후:
 * pool.release(p);
 * ```
 */
export class ObjectPool<T> {
  private _pool: T[] = [];
  private _active: Set<T> = new Set();
  private _factory: () => T;
  private _reset: (obj: T) => void;
  private _maxSize: number;

  constructor(
    factory: () => T,
    reset: (obj: T) => void,
    maxSize: number = 500,
  ) {
    this._factory = factory;
    this._reset = reset;
    this._maxSize = maxSize;
  }

  /**
   * 풀에서 객체 꺼내기 (없으면 새로 생성)
   */
  acquire(): T {
    let obj: T | undefined;
    if (this._pool.length > 0) {
      obj = this._pool.pop()!;
    } else if (this._active.size < this._maxSize) {
      obj = this._factory();
    } else {
      // 풀 + 활성 모두 상한 도달 → 가장 오래된 활성 객체 강제 회수
      const first = this._active.values().next().value;
      if (first !== undefined) {
        this._active.delete(first);
        this._reset(first);
        obj = first;
      } else {
        // fallback: 그래도 없으면 새로 생성 (상한 초과)
        obj = this._factory();
      }
    }

    this._active.add(obj);
    return obj;
  }

  /**
   * 객체를 풀로 반환
   */
  release(obj: T): void {
    this._active.delete(obj);
    this._reset(obj);
    if (this._pool.length < this._maxSize) {
      this._pool.push(obj);
    }
  }

  /**
   * 모든 활성 객체를 풀로 반환
   */
  releaseAll(): void {
    for (const obj of this._active) {
      this._reset(obj);
      if (this._pool.length < this._maxSize) {
        this._pool.push(obj);
      }
    }
    this._active.clear();
  }

  /**
   * 풀 + 활성 모두 비우기
   */
  clear(): void {
    this._pool = [];
    this._active.clear();
  }

  get activeCount(): number { return this._active.size; }
  get poolSize(): number { return this._pool.length; }
  get totalAllocated(): number { return this._active.size + this._pool.length; }
}

// ============================================
// 2. Canvas 오프스크린 버퍼 캐시
// ============================================

interface CachedBuffer {
  canvas: OffscreenCanvas | HTMLCanvasElement;
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  width: number;
  height: number;
  /** 마지막 갱신 시각 */
  lastUpdated: number;
  /** 캐시 유효 시간 (ms). 0이면 영구 */
  ttl: number;
}

/**
 * 오프스크린 버퍼 캐시.
 * 복잡한 그래픽을 프리렌더링하여 재사용.
 *
 * 사용 예:
 * ```ts
 * const cache = OffscreenBufferCache.getInstance();
 *
 * // 캐시 생성 (최초 1회 또는 TTL 만료 시)
 * const buf = cache.getOrCreate('explosion_red', 64, 64, (ctx, w, h) => {
 *   ctx.fillStyle = 'red';
 *   ctx.arc(w/2, h/2, 30, 0, Math.PI * 2);
 *   ctx.fill();
 * }, 5000); // 5초 TTL
 *
 * // 메인 캔버스에 그리기
 * mainCtx.drawImage(buf.canvas, x - 32, y - 32);
 * ```
 */
export class OffscreenBufferCache {
  private static _instance: OffscreenBufferCache | null = null;
  private _buffers: Map<string, CachedBuffer> = new Map();
  private static readonly MAX_BUFFERS = 50;

  static getInstance(): OffscreenBufferCache {
    if (!OffscreenBufferCache._instance) {
      OffscreenBufferCache._instance = new OffscreenBufferCache();
    }
    return OffscreenBufferCache._instance;
  }

  private constructor() {}

  /**
   * 버퍼를 가져오거나, 없으면/만료되었으면 생성
   */
  getOrCreate(
    key: string,
    width: number,
    height: number,
    drawFn: (ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, w: number, h: number) => void,
    ttl: number = 0,
  ): CachedBuffer {
    const existing = this._buffers.get(key);
    const now = performance.now();

    // 캐시 히트 + 유효
    if (existing &&
        existing.width === width &&
        existing.height === height &&
        (existing.ttl === 0 || now - existing.lastUpdated < existing.ttl)) {
      return existing;
    }

    // 캐시 미스 또는 만료 → 생성
    let canvas: OffscreenCanvas | HTMLCanvasElement;
    let ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

    if (typeof OffscreenCanvas !== 'undefined') {
      canvas = new OffscreenCanvas(width, height);
      ctx = canvas.getContext('2d')!;
    } else {
      canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      ctx = canvas.getContext('2d')!;
    }

    drawFn(ctx, width, height);

    const buffer: CachedBuffer = {
      canvas,
      ctx,
      width,
      height,
      lastUpdated: now,
      ttl,
    };

    // LRU 관리 — 상한 초과 시 가장 오래된 것 삭제
    if (this._buffers.size >= OffscreenBufferCache.MAX_BUFFERS) {
      let oldestKey = '';
      let oldestTime = Infinity;
      for (const [k, v] of this._buffers) {
        if (v.lastUpdated < oldestTime) {
          oldestTime = v.lastUpdated;
          oldestKey = k;
        }
      }
      if (oldestKey) {
        this._buffers.delete(oldestKey);
      }
    }

    this._buffers.set(key, buffer);
    return buffer;
  }

  /**
   * 특정 버퍼 무효화
   */
  invalidate(key: string): void {
    this._buffers.delete(key);
  }

  /**
   * 모든 버퍼 정리
   */
  clear(): void {
    this._buffers.clear();
  }

  get size(): number { return this._buffers.size; }
}

// ============================================
// 3. 적응형 품질 관리자 (Adaptive Quality)
// ============================================

/** 품질 레벨 */
export type QualityLevel = 'ultra' | 'high' | 'medium' | 'low';

/** 품질 설정 */
export interface QualitySettings {
  /** 파티클 밀도 배율 (0~1) */
  particleDensity: number;
  /** 그림자/글로우 활성화 */
  enableShadows: boolean;
  /** 그라디언트 활성화 */
  enableGradients: boolean;
  /** 복잡한 형태 활성화 */
  enableComplexShapes: boolean;
  /** 트레일/잔상 활성화 */
  enableTrails: boolean;
  /** 최대 동시 파티클 수 */
  maxParticles: number;
  /** 최대 동시 이펙트 수 */
  maxEffects: number;
}

/** 품질 레벨별 설정 */
const QUALITY_PRESETS: Record<QualityLevel, QualitySettings> = {
  ultra: {
    particleDensity: 1.0,
    enableShadows: true,
    enableGradients: true,
    enableComplexShapes: true,
    enableTrails: true,
    maxParticles: 500,
    maxEffects: 50,
  },
  high: {
    particleDensity: 0.8,
    enableShadows: true,
    enableGradients: true,
    enableComplexShapes: true,
    enableTrails: true,
    maxParticles: 300,
    maxEffects: 30,
  },
  medium: {
    particleDensity: 0.5,
    enableShadows: false,
    enableGradients: true,
    enableComplexShapes: false,
    enableTrails: false,
    maxParticles: 150,
    maxEffects: 15,
  },
  low: {
    particleDensity: 0.3,
    enableShadows: false,
    enableGradients: false,
    enableComplexShapes: false,
    enableTrails: false,
    maxParticles: 80,
    maxEffects: 8,
  },
};

/**
 * 적응형 품질 관리자.
 * 프레임 타임을 모니터링하여 자동으로 품질 레벨 조절.
 *
 * 사용 예:
 * ```ts
 * const aq = AdaptiveQuality.getInstance();
 * // 매 프레임:
 * aq.reportFrameTime(deltaMs);
 * const settings = aq.getSettings();
 * if (settings.enableShadows) { ctx.shadowBlur = 10; }
 * ```
 */
export class AdaptiveQuality {
  private static _instance: AdaptiveQuality | null = null;

  private _level: QualityLevel = 'high';
  private _manualOverride: QualityLevel | null = null;
  private _frameTimeHistory: number[] = [];
  private _lastAdjustTime: number = 0;

  /** 자동 조절 간격 (ms) */
  private static readonly ADJUST_INTERVAL = 3000;
  /** 프레임 타임 히스토리 크기 */
  private static readonly HISTORY_SIZE = 90; // 1.5초 분량 (60fps)
  /** 품질 하락 임계값 (ms) — 이 이상이면 품질 낮춤 */
  private static readonly DOWNGRADE_THRESHOLD = 20; // 50fps 이하
  /** 품질 상승 임계값 (ms) — 이 이하이면 품질 올림 */
  private static readonly UPGRADE_THRESHOLD = 14; // 71fps 이상

  static getInstance(): AdaptiveQuality {
    if (!AdaptiveQuality._instance) {
      AdaptiveQuality._instance = new AdaptiveQuality();
    }
    return AdaptiveQuality._instance;
  }

  private constructor() {}

  /**
   * 프레임 타임 보고 (매 프레임 호출)
   * @param deltaMs 이번 프레임 소요 시간 (ms)
   */
  reportFrameTime(deltaMs: number): void {
    this._frameTimeHistory.push(deltaMs);
    if (this._frameTimeHistory.length > AdaptiveQuality.HISTORY_SIZE) {
      this._frameTimeHistory.shift();
    }

    // 수동 오버라이드 시 자동 조절 안 함
    if (this._manualOverride !== null) return;

    const now = performance.now();
    if (now - this._lastAdjustTime < AdaptiveQuality.ADJUST_INTERVAL) return;
    this._lastAdjustTime = now;

    this._autoAdjust();
  }

  /**
   * 자동 품질 조절
   */
  private _autoAdjust(): void {
    if (this._frameTimeHistory.length < 30) return; // 충분한 데이터 없음

    const avg = this._frameTimeHistory.reduce((a, b) => a + b, 0) / this._frameTimeHistory.length;
    const levels: QualityLevel[] = ['ultra', 'high', 'medium', 'low'];
    const currentIdx = levels.indexOf(this._level);

    if (avg > AdaptiveQuality.DOWNGRADE_THRESHOLD && currentIdx < levels.length - 1) {
      // 성능 부족 → 한 단계 낮춤
      this._level = levels[currentIdx + 1];
    } else if (avg < AdaptiveQuality.UPGRADE_THRESHOLD && currentIdx > 0) {
      // 성능 여유 → 한 단계 올림
      this._level = levels[currentIdx - 1];
    }
  }

  /**
   * 현재 품질 설정 가져오기
   */
  getSettings(): QualitySettings {
    const level = this._manualOverride ?? this._level;
    return { ...QUALITY_PRESETS[level] };
  }

  /**
   * 수동 품질 설정
   * @param level null이면 자동 모드 복귀
   */
  setManualQuality(level: QualityLevel | null): void {
    this._manualOverride = level;
    if (level !== null) {
      this._level = level;
    }
  }

  /**
   * 현재 품질 레벨
   */
  get currentLevel(): QualityLevel {
    return this._manualOverride ?? this._level;
  }

  /**
   * 현재 평균 프레임 타임 (ms)
   */
  get averageFrameTime(): number {
    if (this._frameTimeHistory.length === 0) return 16.67;
    return this._frameTimeHistory.reduce((a, b) => a + b, 0) / this._frameTimeHistory.length;
  }

  /**
   * 현재 FPS
   */
  get currentFPS(): number {
    return Math.round(1000 / this.averageFrameTime);
  }

  /**
   * 파티클 수를 품질에 맞게 조절
   * @param desiredCount 원래 원하는 파티클 수
   * @returns 품질에 맞게 줄인 파티클 수
   */
  adjustParticleCount(desiredCount: number): number {
    const settings = this.getSettings();
    return Math.max(1, Math.round(desiredCount * settings.particleDensity));
  }

  /**
   * 리셋 (매치 시작 시)
   */
  reset(): void {
    this._frameTimeHistory = [];
    this._lastAdjustTime = 0;
    if (this._manualOverride === null) {
      this._level = 'high';
    }
  }

  /**
   * 싱글톤 리셋 (테스트용)
   */
  static resetInstance(): void {
    AdaptiveQuality._instance = null;
  }
}

// ============================================
// 4. 뷰포트 컬링 헬퍼
// ============================================

/**
 * 월드 좌표 기반 뷰포트 내 존재 여부 확인
 * @param worldX 월드 X
 * @param worldY 월드 Y
 * @param cameraX 카메라 X
 * @param cameraY 카메라 Y
 * @param margin 여유 픽셀 (기본 100)
 * @returns 뷰포트 내이면 true
 */
export function isInViewport(
  worldX: number,
  worldY: number,
  cameraX: number,
  cameraY: number,
  margin: number = 100,
): boolean {
  const screenX = worldX - cameraX;
  const screenY = worldY - cameraY;
  const vpW = typeof window !== 'undefined' ? window.innerWidth : 1920;
  const vpH = typeof window !== 'undefined' ? window.innerHeight : 1080;

  return (
    screenX > -margin &&
    screenX < vpW + margin &&
    screenY > -margin &&
    screenY < vpH + margin
  );
}

/**
 * 거리 기반 LOD 단순화 (멀리 있는 이펙트 단순화)
 * @param distSq 거리 제곱 (카메라 중심~객체)
 * @param thresholdSq 임계 거리 제곱
 * @returns true이면 단순화 필요
 */
export function shouldSimplify(distSq: number, thresholdSq: number = 300 * 300): boolean {
  return distSq > thresholdSq;
}
