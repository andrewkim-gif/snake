/**
 * ar-sounds.ts — Arena Combat Sound Event System
 *
 * Defines sound events, priorities, and a simple sound manager
 * for triggering game audio. Actual audio files would be loaded
 * via Howler.js or Web Audio API.
 */

import type { ARSoundEvent } from './ar-types';
import { SOUND_PRIORITIES } from './ar-types';

// ============================================================
// Sound Event Configuration
// ============================================================

export interface ARSoundConfig {
  event: ARSoundEvent;
  volume: number;    // 0.0 ~ 1.0
  pitchRange: [number, number]; // random pitch variation
  maxConcurrent: number; // max simultaneous instances
  cooldownMs: number;    // minimum time between plays
}

export const SOUND_CONFIGS: Record<ARSoundEvent, ARSoundConfig> = {
  // Attack sounds
  attack_melee: {
    event: 'attack_melee', volume: 0.3,
    pitchRange: [0.9, 1.1], maxConcurrent: 3, cooldownMs: 100,
  },
  attack_ranged: {
    event: 'attack_ranged', volume: 0.35,
    pitchRange: [0.95, 1.05], maxConcurrent: 3, cooldownMs: 80,
  },
  attack_magic: {
    event: 'attack_magic', volume: 0.35,
    pitchRange: [0.9, 1.1], maxConcurrent: 3, cooldownMs: 100,
  },

  // Hit sounds
  hit_physical: {
    event: 'hit_physical', volume: 0.25,
    pitchRange: [0.8, 1.2], maxConcurrent: 5, cooldownMs: 50,
  },
  hit_fire: {
    event: 'hit_fire', volume: 0.3,
    pitchRange: [0.9, 1.1], maxConcurrent: 4, cooldownMs: 60,
  },
  hit_frost: {
    event: 'hit_frost', volume: 0.3,
    pitchRange: [0.85, 1.15], maxConcurrent: 4, cooldownMs: 60,
  },
  hit_lightning: {
    event: 'hit_lightning', volume: 0.35,
    pitchRange: [0.9, 1.1], maxConcurrent: 4, cooldownMs: 60,
  },
  hit_poison: {
    event: 'hit_poison', volume: 0.25,
    pitchRange: [0.8, 1.0], maxConcurrent: 4, cooldownMs: 80,
  },

  // Critical hits
  crit_hit: {
    event: 'crit_hit', volume: 0.5,
    pitchRange: [1.0, 1.2], maxConcurrent: 2, cooldownMs: 200,
  },
  overcritical: {
    event: 'overcritical', volume: 0.7,
    pitchRange: [1.0, 1.0], maxConcurrent: 1, cooldownMs: 500,
  },

  // Kill sounds
  kill_normal: {
    event: 'kill_normal', volume: 0.4,
    pitchRange: [0.95, 1.05], maxConcurrent: 3, cooldownMs: 100,
  },
  kill_elite: {
    event: 'kill_elite', volume: 0.5,
    pitchRange: [1.0, 1.0], maxConcurrent: 2, cooldownMs: 200,
  },
  kill_miniboss: {
    event: 'kill_miniboss', volume: 0.6,
    pitchRange: [1.0, 1.0], maxConcurrent: 1, cooldownMs: 500,
  },
  kill_boss: {
    event: 'kill_boss', volume: 0.8,
    pitchRange: [1.0, 1.0], maxConcurrent: 1, cooldownMs: 1000,
  },
  kill_pvp: {
    event: 'kill_pvp', volume: 0.5,
    pitchRange: [1.0, 1.1], maxConcurrent: 2, cooldownMs: 300,
  },

  // Player events
  player_death: {
    event: 'player_death', volume: 0.6,
    pitchRange: [1.0, 1.0], maxConcurrent: 1, cooldownMs: 1000,
  },
  level_up: {
    event: 'level_up', volume: 0.6,
    pitchRange: [1.0, 1.0], maxConcurrent: 1, cooldownMs: 500,
  },
  tome_select: {
    event: 'tome_select', volume: 0.4,
    pitchRange: [1.0, 1.1], maxConcurrent: 1, cooldownMs: 200,
  },
  weapon_evolve: {
    event: 'weapon_evolve', volume: 0.7,
    pitchRange: [1.0, 1.0], maxConcurrent: 1, cooldownMs: 1000,
  },
  synergy_activate: {
    event: 'synergy_activate', volume: 0.6,
    pitchRange: [1.0, 1.0], maxConcurrent: 1, cooldownMs: 1000,
  },

  // Pickup sounds
  item_pickup: {
    event: 'item_pickup', volume: 0.35,
    pitchRange: [0.9, 1.1], maxConcurrent: 2, cooldownMs: 150,
  },
  xp_collect: {
    event: 'xp_collect', volume: 0.15,
    pitchRange: [0.8, 1.4], maxConcurrent: 8, cooldownMs: 30,
  },

  // Phase transitions
  phase_pvp_warning: {
    event: 'phase_pvp_warning', volume: 0.8,
    pitchRange: [1.0, 1.0], maxConcurrent: 1, cooldownMs: 5000,
  },
  phase_pvp_start: {
    event: 'phase_pvp_start', volume: 0.8,
    pitchRange: [1.0, 1.0], maxConcurrent: 1, cooldownMs: 5000,
  },
  phase_settlement: {
    event: 'phase_settlement', volume: 0.7,
    pitchRange: [1.0, 1.0], maxConcurrent: 1, cooldownMs: 5000,
  },

  // Boss events
  boss_spawn: {
    event: 'boss_spawn', volume: 0.9,
    pitchRange: [1.0, 1.0], maxConcurrent: 1, cooldownMs: 5000,
  },
  boss_defeated: {
    event: 'boss_defeated', volume: 0.9,
    pitchRange: [1.0, 1.0], maxConcurrent: 1, cooldownMs: 5000,
  },

  // Sovereignty events
  sovereignty_capture: {
    event: 'sovereignty_capture', volume: 0.8,
    pitchRange: [1.0, 1.0], maxConcurrent: 1, cooldownMs: 5000,
  },
  sovereignty_defend: {
    event: 'sovereignty_defend', volume: 0.8,
    pitchRange: [1.0, 1.0], maxConcurrent: 1, cooldownMs: 5000,
  },

  // Misc
  arena_shrink: {
    event: 'arena_shrink', volume: 0.4,
    pitchRange: [1.0, 1.0], maxConcurrent: 1, cooldownMs: 2000,
  },
  quest_complete: {
    event: 'quest_complete', volume: 0.6,
    pitchRange: [1.0, 1.0], maxConcurrent: 1, cooldownMs: 1000,
  },
  season_level_up: {
    event: 'season_level_up', volume: 0.7,
    pitchRange: [1.0, 1.0], maxConcurrent: 1, cooldownMs: 1000,
  },
};

// ============================================================
// Sound Manager (Lightweight)
// ============================================================

interface SoundInstance {
  lastPlayedAt: number;
  activeCount: number;
}

/**
 * ARSoundManager handles sound event dispatching with
 * priority, cooldown, and concurrency management.
 *
 * Actual audio playback is deferred to the consumer
 * (Howler.js or Web Audio API integration).
 */
export class ARSoundManager {
  private instances: Map<ARSoundEvent, SoundInstance> = new Map();
  private masterVolume = 1.0;
  private muted = false;

  // Callback for actual audio playback
  private playCallback:
    | ((event: ARSoundEvent, volume: number, pitch: number) => void)
    | null = null;

  setPlayCallback(
    cb: (event: ARSoundEvent, volume: number, pitch: number) => void,
  ) {
    this.playCallback = cb;
  }

  setMasterVolume(vol: number) {
    this.masterVolume = Math.max(0, Math.min(1, vol));
  }

  setMuted(muted: boolean) {
    this.muted = muted;
  }

  /**
   * Request to play a sound event.
   * Returns true if the sound was accepted (passed cooldown/concurrency checks).
   */
  play(event: ARSoundEvent): boolean {
    if (this.muted) return false;

    const config = SOUND_CONFIGS[event];
    if (!config) return false;

    const now = Date.now();
    let instance = this.instances.get(event);
    if (!instance) {
      instance = { lastPlayedAt: 0, activeCount: 0 };
      this.instances.set(event, instance);
    }

    // Cooldown check
    if (now - instance.lastPlayedAt < config.cooldownMs) {
      return false;
    }

    // Concurrency check
    if (instance.activeCount >= config.maxConcurrent) {
      return false;
    }

    // Priority check — higher priority sounds can interrupt lower ones
    const priority = SOUND_PRIORITIES[event];
    if (priority < 3) {
      // Low-priority sounds are dropped more aggressively
      const totalActive = Array.from(this.instances.values()).reduce(
        (sum, inst) => sum + inst.activeCount,
        0,
      );
      if (totalActive > 15) return false; // audio saturation limit
    }

    // Accept the sound
    instance.lastPlayedAt = now;
    instance.activeCount++;

    // Auto-decrement after estimated duration (300ms default)
    setTimeout(() => {
      if (instance) {
        instance.activeCount = Math.max(0, instance.activeCount - 1);
      }
    }, 300);

    // Calculate final volume and pitch
    const volume = config.volume * this.masterVolume;
    const [minPitch, maxPitch] = config.pitchRange;
    const pitch = minPitch + Math.random() * (maxPitch - minPitch);

    // Dispatch to callback
    if (this.playCallback) {
      this.playCallback(event, volume, pitch);
    }

    return true;
  }

  /**
   * Map a combat event to sound events.
   * Called from the game loop when events occur.
   */
  onCombatEvent(type: string, data?: Record<string, unknown>) {
    switch (type) {
      case 'phase_change': {
        const phase = data?.phase as string;
        if (phase === 'pvp_warning') this.play('phase_pvp_warning');
        else if (phase === 'pvp') this.play('phase_pvp_start');
        else if (phase === 'settlement') this.play('phase_settlement');
        break;
      }
      case 'boss_spawn':
        this.play('boss_spawn');
        break;
      case 'boss_defeated':
        this.play('boss_defeated');
        break;
      case 'level_up':
        this.play('level_up');
        break;
      case 'kill':
        this.play('kill_normal');
        break;
      case 'elite_kill':
        this.play('kill_elite');
        break;
      case 'miniboss_kill':
        this.play('kill_miniboss');
        break;
      case 'pvp_kill':
        this.play('kill_pvp');
        break;
      case 'player_death':
        this.play('player_death');
        break;
      case 'quest_complete':
        this.play('quest_complete');
        break;
    }
  }
}

// Singleton instance
let soundManager: ARSoundManager | null = null;

export function getARSoundManager(): ARSoundManager {
  if (!soundManager) {
    soundManager = new ARSoundManager();
  }
  return soundManager;
}
