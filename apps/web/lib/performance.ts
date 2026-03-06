/**
 * S40: Frontend Performance Configuration & Utilities
 *
 * Targets:
 *   - Globe: 60 FPS
 *   - Map loading: < 2 seconds
 *   - LCP: < 2.5 seconds
 *   - Mobile: touch-friendly, responsive viewport
 */

// ============================================================
// 1. Performance Tier Detection
// ============================================================

export type PerformanceTier = 'high' | 'medium' | 'low';

/** Detect device performance tier based on hardware signals */
export function detectPerformanceTier(): PerformanceTier {
  if (typeof window === 'undefined') return 'medium';

  // Check hardware concurrency (CPU cores)
  const cores = navigator.hardwareConcurrency || 4;

  // Check device memory (if available)
  const memory = (navigator as unknown as { deviceMemory?: number }).deviceMemory || 4;

  // Check if mobile
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );

  // GPU detection via WebGL
  let gpuTier: 'high' | 'medium' | 'low' = 'medium';
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        // High-end GPUs
        if (/NVIDIA|RTX|GTX|Radeon RX|Apple M[1-9]|Apple GPU/i.test(renderer)) {
          gpuTier = 'high';
        }
        // Integrated/mobile GPUs
        else if (/Intel|Mali|Adreno|PowerVR|SwiftShader/i.test(renderer)) {
          gpuTier = 'low';
        }
      }
    }
  } catch {
    // WebGL not available
  }

  // Composite score
  if (isMobile && (cores <= 4 || memory <= 2)) return 'low';
  if (gpuTier === 'high' && cores >= 8 && memory >= 8) return 'high';
  if (gpuTier === 'low' || cores <= 2 || memory <= 2) return 'low';
  return 'medium';
}

// ============================================================
// 2. R3F / Three.js Performance Settings (per tier)
// ============================================================

export interface R3FPerformanceConfig {
  /** Max DPR (device pixel ratio) — lower = less GPU work */
  dpr: [number, number];
  /** Sphere geometry segments (for globe) */
  globeSegments: number;
  /** Atmosphere effect enabled */
  atmosphereEnabled: boolean;
  /** Max concurrent instanced meshes */
  maxInstancedMeshes: number;
  /** Enable post-processing effects (bloom, DOF) */
  postProcessing: boolean;
  /** Enable shadows */
  shadows: boolean;
  /** Antialias */
  antialias: boolean;
}

export function getR3FConfig(tier: PerformanceTier): R3FPerformanceConfig {
  switch (tier) {
    case 'high':
      return {
        dpr: [1, 2],
        globeSegments: 64,
        atmosphereEnabled: true,
        maxInstancedMeshes: 500,
        postProcessing: true,
        shadows: true,
        antialias: true,
      };
    case 'medium':
      return {
        dpr: [1, 1.5],
        globeSegments: 48,
        atmosphereEnabled: true,
        maxInstancedMeshes: 200,
        postProcessing: false,
        shadows: false,
        antialias: true,
      };
    case 'low':
      return {
        dpr: [0.75, 1],
        globeSegments: 32,
        atmosphereEnabled: false,
        maxInstancedMeshes: 50,
        postProcessing: false,
        shadows: false,
        antialias: false,
      };
  }
}

// ============================================================
// 3. FPS Monitor
// ============================================================

export class FPSMonitor {
  private frames: number[] = [];
  private lastTime = 0;
  private readonly sampleSize: number;
  private onReport?: (fps: number) => void;

  constructor(sampleSize = 60, onReport?: (fps: number) => void) {
    this.sampleSize = sampleSize;
    this.onReport = onReport;
  }

  /** Call every frame (e.g., in useFrame or requestAnimationFrame) */
  tick(): void {
    const now = performance.now();
    if (this.lastTime > 0) {
      const delta = now - this.lastTime;
      this.frames.push(1000 / delta);
      if (this.frames.length > this.sampleSize) {
        this.frames.shift();
      }
    }
    this.lastTime = now;

    // Report every sampleSize frames
    if (this.frames.length === this.sampleSize && this.onReport) {
      this.onReport(this.getAverageFPS());
    }
  }

  getAverageFPS(): number {
    if (this.frames.length === 0) return 0;
    const sum = this.frames.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.frames.length);
  }

  reset(): void {
    this.frames = [];
    this.lastTime = 0;
  }
}

// ============================================================
// 4. Adaptive Quality Manager
// ============================================================

/**
 * Automatically downgrades visual quality when FPS drops.
 * Used by the globe view to maintain 60 FPS.
 */
export class AdaptiveQuality {
  private fps: FPSMonitor;
  private currentTier: PerformanceTier;
  private readonly onTierChange: (tier: PerformanceTier, config: R3FPerformanceConfig) => void;
  private checkInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    initialTier: PerformanceTier,
    onTierChange: (tier: PerformanceTier, config: R3FPerformanceConfig) => void,
  ) {
    this.currentTier = initialTier;
    this.onTierChange = onTierChange;
    this.fps = new FPSMonitor(120);
  }

  /** Call every frame */
  tick(): void {
    this.fps.tick();
  }

  /** Start periodic quality checks (every 5 seconds) */
  start(): void {
    this.checkInterval = setInterval(() => {
      const avgFps = this.fps.getAverageFPS();
      if (avgFps < 30 && this.currentTier !== 'low') {
        this.currentTier = 'low';
        this.onTierChange(this.currentTier, getR3FConfig(this.currentTier));
      } else if (avgFps < 50 && this.currentTier === 'high') {
        this.currentTier = 'medium';
        this.onTierChange(this.currentTier, getR3FConfig(this.currentTier));
      } else if (avgFps >= 58 && this.currentTier === 'low') {
        this.currentTier = 'medium';
        this.onTierChange(this.currentTier, getR3FConfig(this.currentTier));
      }
    }, 5000);
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  getCurrentTier(): PerformanceTier {
    return this.currentTier;
  }
}

// ============================================================
// 5. Lazy Load Helpers
// ============================================================

/**
 * Prefetch a dynamic import when the user is likely to navigate there.
 * Uses requestIdleCallback for non-blocking prefetch.
 */
export function prefetchModule(importFn: () => Promise<unknown>): void {
  if (typeof window === 'undefined') return;

  const prefetch = () => {
    importFn().catch(() => {
      // Silently ignore prefetch errors
    });
  };

  if ('requestIdleCallback' in window) {
    (window as unknown as { requestIdleCallback: (fn: () => void) => void }).requestIdleCallback(
      prefetch,
    );
  } else {
    setTimeout(prefetch, 1000);
  }
}

// ============================================================
// 6. Image/Texture Optimization Config
// ============================================================

export const TEXTURE_CONFIG = {
  /** Max texture size for globe/map textures */
  maxTextureSize: {
    high: 4096,
    medium: 2048,
    low: 1024,
  },
  /** Use compressed textures (KTX2/Basis) when available */
  useCompressedTextures: true,
  /** Mipmap generation for distance-based quality */
  generateMipmaps: true,
  /** Anisotropic filtering level */
  anisotropy: {
    high: 16,
    medium: 4,
    low: 1,
  },
} as const;

// ============================================================
// 7. Mobile Touch Optimization
// ============================================================

export const MOBILE_CONFIG = {
  /** Minimum touch target size (px) — WCAG 2.1 AA */
  minTouchTarget: 44,
  /** Viewport meta for mobile */
  viewportMeta: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
  /** Touch event passive optimization */
  passiveTouchEvents: true,
  /** Reduced motion support */
  respectsReducedMotion: true,
  /** Pinch-to-zoom for globe */
  pinchZoomEnabled: true,
  /** Tap delay removal */
  touchAction: 'manipulation' as const,
} as const;

/**
 * Check if the user prefers reduced motion.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Check if the device is mobile.
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768 || 'ontouchstart' in window;
}
