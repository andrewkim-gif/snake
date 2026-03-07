/**
 * v14 Phase 10 — S43: Client Performance Monitor & Optimization
 *
 * Provides FPS tracking, weapon effect LOD management, and
 * bandwidth monitoring for the game client.
 *
 * Targets:
 * - 60 FPS with 50 agents rendered
 * - Weapon effects LOD based on camera distance
 * - Network bandwidth < 50KB/s
 */

// --- FPS Monitor ---

export interface FPSStats {
  current: number;
  average: number;
  min: number;
  max: number;
  frameCount: number;
  droppedFrames: number; // frames below 30 FPS
}

const FPS_SAMPLE_SIZE = 120; // 2 seconds at 60fps

export class FPSMonitor {
  private frameTimes: number[] = [];
  private lastTime = 0;
  private frameCount = 0;
  private droppedFrames = 0;

  /**
   * Call once per frame (e.g., in useFrame or requestAnimationFrame).
   * Returns current FPS.
   */
  tick(timestamp: number): number {
    if (this.lastTime === 0) {
      this.lastTime = timestamp;
      return 60;
    }

    const delta = timestamp - this.lastTime;
    this.lastTime = timestamp;

    if (delta > 0) {
      const fps = 1000 / delta;
      this.frameTimes.push(fps);
      if (this.frameTimes.length > FPS_SAMPLE_SIZE) {
        this.frameTimes.shift();
      }
      this.frameCount++;

      if (fps < 30) {
        this.droppedFrames++;
      }

      return fps;
    }

    return 60;
  }

  getStats(): FPSStats {
    if (this.frameTimes.length === 0) {
      return { current: 60, average: 60, min: 60, max: 60, frameCount: 0, droppedFrames: 0 };
    }

    const current = this.frameTimes[this.frameTimes.length - 1] ?? 60;
    const sum = this.frameTimes.reduce((a, b) => a + b, 0);
    const average = sum / this.frameTimes.length;
    const min = Math.min(...this.frameTimes);
    const max = Math.max(...this.frameTimes);

    return {
      current: Math.round(current),
      average: Math.round(average),
      min: Math.round(min),
      max: Math.round(max),
      frameCount: this.frameCount,
      droppedFrames: this.droppedFrames,
    };
  }

  reset(): void {
    this.frameTimes = [];
    this.lastTime = 0;
    this.frameCount = 0;
    this.droppedFrames = 0;
  }
}

// --- LOD (Level of Detail) Manager for Weapon Effects ---

export enum LODLevel {
  Full = 0,    // < 300 units from camera: full particles, full detail
  Medium = 1,  // 300-800 units: reduced particles (50%)
  Low = 2,     // 800-1500 units: minimal effects (25%)
  None = 3,    // > 1500 units: no effects
}

const LOD_THRESHOLDS = [300, 800, 1500, Infinity];

export function determineLOD(distFromCamera: number): LODLevel {
  for (let i = 0; i < LOD_THRESHOLDS.length; i++) {
    if (distFromCamera < LOD_THRESHOLDS[i]) {
      return i as LODLevel;
    }
  }
  return LODLevel.None;
}

/**
 * Returns the particle count to use at a given LOD level.
 */
export function lodParticleCount(baseCount: number, lod: LODLevel): number {
  switch (lod) {
    case LODLevel.Full:
      return baseCount;
    case LODLevel.Medium:
      return Math.ceil(baseCount / 2);
    case LODLevel.Low:
      return Math.ceil(baseCount / 4);
    case LODLevel.None:
      return 0;
    default:
      return baseCount;
  }
}

/**
 * Returns whether damage numbers should be shown at this LOD.
 */
export function lodShowDamageNumbers(lod: LODLevel): boolean {
  return lod <= LODLevel.Medium;
}

/**
 * Returns the animation update frequency multiplier at this LOD.
 * Full LOD = every frame, Lower LOD = every N frames.
 */
export function lodAnimationFrequency(lod: LODLevel): number {
  switch (lod) {
    case LODLevel.Full:
      return 1;  // every frame
    case LODLevel.Medium:
      return 2;  // every 2 frames
    case LODLevel.Low:
      return 4;  // every 4 frames
    case LODLevel.None:
      return 0;  // skip
    default:
      return 1;
  }
}

// --- Bandwidth Monitor (Client-Side) ---

export interface BandwidthStats {
  bytesReceived: number;
  bytesPerSecond: number;
  messagesReceived: number;
  messagesPerSecond: number;
  isOverBudget: boolean;
}

const BANDWIDTH_BUDGET_BPS = 51200; // 50 KB/s

export class BandwidthMonitor {
  private totalBytes = 0;
  private totalMessages = 0;
  private startTime = Date.now();
  private recentBytes: number[] = [];
  private recentTimestamps: number[] = [];

  recordMessage(bytes: number): void {
    this.totalBytes += bytes;
    this.totalMessages++;

    const now = Date.now();
    this.recentBytes.push(bytes);
    this.recentTimestamps.push(now);

    // Keep only last 5 seconds of data
    const cutoff = now - 5000;
    while (this.recentTimestamps.length > 0 && this.recentTimestamps[0] < cutoff) {
      this.recentTimestamps.shift();
      this.recentBytes.shift();
    }
  }

  getStats(): BandwidthStats {
    const elapsed = (Date.now() - this.startTime) / 1000;
    const recentTotal = this.recentBytes.reduce((a, b) => a + b, 0);
    const recentElapsed = this.recentTimestamps.length > 1
      ? (this.recentTimestamps[this.recentTimestamps.length - 1] - this.recentTimestamps[0]) / 1000
      : 1;

    const bps = recentElapsed > 0 ? recentTotal / recentElapsed : 0;
    const mps = this.recentTimestamps.length / Math.max(recentElapsed, 1);

    return {
      bytesReceived: this.totalBytes,
      bytesPerSecond: Math.round(bps),
      messagesReceived: this.totalMessages,
      messagesPerSecond: Math.round(mps),
      isOverBudget: bps > BANDWIDTH_BUDGET_BPS,
    };
  }

  reset(): void {
    this.totalBytes = 0;
    this.totalMessages = 0;
    this.startTime = Date.now();
    this.recentBytes = [];
    this.recentTimestamps = [];
  }
}

// --- Adaptive Quality Manager ---

/**
 * Automatically adjusts quality settings based on FPS performance.
 */
export interface QualitySettings {
  particleMultiplier: number;  // 0.0-1.0
  damageNumbersEnabled: boolean;
  weaponEffectsLODBias: number; // 0 = no bias, +1 = reduce one LOD level
  shadowsEnabled: boolean;
  postProcessing: boolean;
}

export class AdaptiveQualityManager {
  private fpsMonitor: FPSMonitor;
  private settings: QualitySettings = {
    particleMultiplier: 1.0,
    damageNumbersEnabled: true,
    weaponEffectsLODBias: 0,
    shadowsEnabled: true,
    postProcessing: true,
  };
  private lastAdjustTime = 0;
  private adjustInterval = 5000; // Check every 5 seconds

  constructor(fpsMonitor: FPSMonitor) {
    this.fpsMonitor = fpsMonitor;
  }

  /**
   * Call periodically to auto-adjust quality based on FPS.
   * Returns true if settings changed.
   */
  update(timestamp: number): boolean {
    if (timestamp - this.lastAdjustTime < this.adjustInterval) {
      return false;
    }
    this.lastAdjustTime = timestamp;

    const stats = this.fpsMonitor.getStats();
    let changed = false;

    // If FPS is below 45, start reducing quality
    if (stats.average < 45) {
      if (this.settings.postProcessing) {
        this.settings.postProcessing = false;
        changed = true;
      } else if (this.settings.shadowsEnabled) {
        this.settings.shadowsEnabled = false;
        changed = true;
      } else if (this.settings.particleMultiplier > 0.25) {
        this.settings.particleMultiplier = Math.max(0.25, this.settings.particleMultiplier - 0.25);
        changed = true;
      } else if (this.settings.weaponEffectsLODBias < 2) {
        this.settings.weaponEffectsLODBias++;
        changed = true;
      } else if (this.settings.damageNumbersEnabled) {
        this.settings.damageNumbersEnabled = false;
        changed = true;
      }
    }

    // If FPS is above 55, restore quality
    if (stats.average > 55) {
      if (!this.settings.damageNumbersEnabled) {
        this.settings.damageNumbersEnabled = true;
        changed = true;
      } else if (this.settings.weaponEffectsLODBias > 0) {
        this.settings.weaponEffectsLODBias--;
        changed = true;
      } else if (this.settings.particleMultiplier < 1.0) {
        this.settings.particleMultiplier = Math.min(1.0, this.settings.particleMultiplier + 0.25);
        changed = true;
      } else if (!this.settings.shadowsEnabled) {
        this.settings.shadowsEnabled = true;
        changed = true;
      } else if (!this.settings.postProcessing) {
        this.settings.postProcessing = true;
        changed = true;
      }
    }

    return changed;
  }

  getSettings(): QualitySettings {
    return { ...this.settings };
  }

  /**
   * Applies LOD bias to a raw LOD level.
   */
  applyLODBias(rawLOD: LODLevel): LODLevel {
    const biased = rawLOD + this.settings.weaponEffectsLODBias;
    return Math.min(biased, LODLevel.None) as LODLevel;
  }
}

// Singleton instances for global use
export const globalFPSMonitor = new FPSMonitor();
export const globalBandwidthMonitor = new BandwidthMonitor();
export const globalAdaptiveQuality = new AdaptiveQualityManager(globalFPSMonitor);
