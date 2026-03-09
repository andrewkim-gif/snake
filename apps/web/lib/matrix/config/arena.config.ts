/**
 * arena.config.ts - Arena (Battle Royale) Mode Configuration
 * PvPvE monster density, safe zone phases, and game rules
 *
 * Ported from app_ingame/config/arena.config.ts
 */

import { EnemyType, SafeZone, ArenaPhase } from '../types';

// ===== Arena Game Settings =====
export const ARENA_CONFIG = {
  // Game Duration
  GAME_DURATION: 300, // 5 minutes

  // Agent Settings
  AGENT_COUNT: 9,
  RESPAWN_DELAY: 3, // 3 seconds
  INVINCIBILITY_DURATION: 2, // 2 seconds after respawn

  // Starting Stats
  STARTING_LEVEL: 1,
  STARTING_HP: 100,
  STARTING_WEAPONS: 1,

  // World Size (for safe zone)
  WORLD_SIZE: 4000,

  // XP and Leveling
  XP_PER_LEVEL: 100,
  XP_PER_KILL: 50,
  XP_PER_ASSIST: 20,
  XP_FROM_GEMS_MULTIPLIER: 1.5, // Gems give 1.5x XP in Arena

  // Kill Rewards
  BASE_KILL_CREDITS: 100,
  SHUTDOWN_BONUS: 50, // Kill streak stopper
  REVENGE_BONUS: 30, // Kill your killer
  LEVEL_DIFFERENCE_BONUS: 10, // Per level difference
};

// ===== Safe Zone Phases =====
export const SAFE_ZONE_PHASES: {
  phase: ArenaPhase;
  startTime: number;
  warningDuration: number;
  shrinkDuration: number;
  targetRadius: number;
  damagePerSecond: number;
}[] = [
  {
    phase: 1,
    startTime: 0,
    warningDuration: 30,
    shrinkDuration: 30,
    targetRadius: 1800,
    damagePerSecond: 5,
  },
  {
    phase: 2,
    startTime: 60,
    warningDuration: 20,
    shrinkDuration: 25,
    targetRadius: 1200,
    damagePerSecond: 10,
  },
  {
    phase: 3,
    startTime: 120,
    warningDuration: 15,
    shrinkDuration: 20,
    targetRadius: 700,
    damagePerSecond: 15,
  },
  {
    phase: 4,
    startTime: 200,
    warningDuration: 10,
    shrinkDuration: 15,
    targetRadius: 300,
    damagePerSecond: 25,
  },
];

// ===== Monster Density Configuration =====
// Lower density than story mode since players also fight each other
export const ARENA_MONSTER_CONFIG = {
  // Base spawn interval (higher = fewer monsters)
  BASE_SPAWN_INTERVAL: 2.0, // seconds (story mode: ~1.0)

  // Max enemies on map (lower for performance + PvP focus)
  MAX_ENEMIES: 80, // (story mode: 150+)

  // Spawn count per wave
  ENEMIES_PER_SPAWN: 2, // (story mode: 3-5)

  // Difficulty scaling over time
  DIFFICULTY_SCALING: {
    0: 0.5,    // 0-60s: Easy
    60: 0.7,   // 60-120s: Medium
    120: 0.9,  // 120-180s: Hard
    180: 1.1,  // 180-240s: Very Hard
    240: 1.3,  // 240-300s: Extreme
  },

  // HP/Damage multipliers (lower than story mode)
  HP_MULTIPLIER: 0.6,
  DAMAGE_MULTIPLIER: 0.7,
};

// ===== Arena Monster Pool =====
// Simplified monster pool for Arena mode
export const ARENA_MONSTER_POOL: {
  time: number; // Unlock time in seconds
  types: EnemyType[];
}[] = [
  {
    time: 0,
    types: ['glitch', 'bot'],
  },
  {
    time: 30,
    types: ['glitch', 'bot', 'malware'],
  },
  {
    time: 60,
    types: ['glitch', 'bot', 'malware', 'bitling', 'spammer'],
  },
  {
    time: 90,
    types: ['bot', 'malware', 'bitling', 'spammer', 'crypter', 'pixel'],
  },
  {
    time: 120,
    types: ['malware', 'bitling', 'spammer', 'crypter', 'pixel', 'bug', 'worm'],
  },
  {
    time: 150,
    types: ['crypter', 'pixel', 'bug', 'worm', 'mutant', 'polymorphic'],
  },
  {
    time: 180,
    types: ['bug', 'worm', 'mutant', 'polymorphic', 'trojan', 'sniper'],
  },
  {
    time: 210,
    types: ['mutant', 'polymorphic', 'trojan', 'sniper', 'caster', 'rootkit'],
  },
  {
    time: 240,
    types: ['trojan', 'sniper', 'caster', 'rootkit', 'apt', 'zeroday'],
  },
  {
    time: 270,
    types: ['rootkit', 'apt', 'zeroday', 'skynet', 'artillery'],
  },
];

/**
 * Get monster types available at given time
 */
export function getArenaMonsterTypes(gameTime: number): EnemyType[] {
  let types: EnemyType[] = [];

  for (const pool of ARENA_MONSTER_POOL) {
    if (gameTime >= pool.time) {
      types = pool.types;
    }
  }

  return types;
}

/**
 * Get difficulty multiplier at given time
 */
export function getArenaDifficulty(gameTime: number): number {
  const thresholds = Object.keys(ARENA_MONSTER_CONFIG.DIFFICULTY_SCALING)
    .map(Number)
    .sort((a, b) => b - a);

  for (const threshold of thresholds) {
    if (gameTime >= threshold) {
      return ARENA_MONSTER_CONFIG.DIFFICULTY_SCALING[threshold as keyof typeof ARENA_MONSTER_CONFIG.DIFFICULTY_SCALING];
    }
  }

  return 0.5;
}

/**
 * Get current safe zone phase config
 */
export function getSafeZonePhase(gameTime: number): typeof SAFE_ZONE_PHASES[number] | undefined {
  let currentPhase = SAFE_ZONE_PHASES[0];

  for (const phase of SAFE_ZONE_PHASES) {
    if (gameTime >= phase.startTime) {
      currentPhase = phase;
    }
  }

  return currentPhase;
}

/**
 * Calculate safe zone state at given time
 */
export function calculateSafeZoneState(
  gameTime: number,
  worldSize: number = ARENA_CONFIG.WORLD_SIZE
): Partial<SafeZone> {
  const phase = getSafeZonePhase(gameTime);
  if (!phase) {
    return {
      currentRadius: worldSize / 2,
      targetRadius: worldSize / 2,
      isWarning: false,
      isShrinking: false,
    };
  }

  const phaseStartTime = phase.startTime;
  const warningEndTime = phaseStartTime + phase.warningDuration;
  const shrinkEndTime = warningEndTime + phase.shrinkDuration;

  const prevPhase = SAFE_ZONE_PHASES[SAFE_ZONE_PHASES.indexOf(phase) - 1];
  const startRadius = prevPhase ? prevPhase.targetRadius : worldSize / 2;

  // Warning phase
  if (gameTime < warningEndTime) {
    return {
      currentRadius: startRadius,
      targetRadius: phase.targetRadius,
      isWarning: true,
      isShrinking: false,
      damagePerSecond: phase.damagePerSecond,
    };
  }

  // Shrinking phase
  if (gameTime < shrinkEndTime) {
    const shrinkProgress = (gameTime - warningEndTime) / phase.shrinkDuration;
    const currentRadius = startRadius - (startRadius - phase.targetRadius) * shrinkProgress;

    return {
      currentRadius,
      targetRadius: phase.targetRadius,
      isWarning: true,
      isShrinking: true,
      damagePerSecond: phase.damagePerSecond,
    };
  }

  // Stable phase (waiting for next)
  return {
    currentRadius: phase.targetRadius,
    targetRadius: phase.targetRadius,
    isWarning: false,
    isShrinking: false,
    damagePerSecond: phase.damagePerSecond,
  };
}

// ===== AI Personality Weights =====
export const AI_PERSONALITY_WEIGHTS = {
  aggressive: {
    attackWeight: 0.8,
    collectWeight: 0.2,
    fleeThreshold: 0.2, // Flee when HP below 20%
    targetPlayerWeight: 0.7,
  },
  defensive: {
    attackWeight: 0.3,
    collectWeight: 0.5,
    fleeThreshold: 0.5, // Flee when HP below 50%
    targetPlayerWeight: 0.3,
  },
  balanced: {
    attackWeight: 0.5,
    collectWeight: 0.4,
    fleeThreshold: 0.35,
    targetPlayerWeight: 0.5,
  },
  collector: {
    attackWeight: 0.2,
    collectWeight: 0.8,
    fleeThreshold: 0.4,
    targetPlayerWeight: 0.2,
  },
};

export default ARENA_CONFIG;
