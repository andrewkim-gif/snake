/**
 * v14 Phase 2: Megabonk Weapon System — Shared Types
 * Mirror of server/internal/domain/weapons.go
 */

// ─── Weapon Types ───

export type WeaponType =
  | 'bonk_mallet'
  | 'chain_bolt'
  | 'flame_ring'
  | 'frost_shards'
  | 'shadow_strike'
  | 'thunder_clap'
  | 'venom_cloud'
  | 'crystal_shield'
  | 'gravity_bomb'
  | 'soul_drain';

export const ALL_WEAPON_TYPES: WeaponType[] = [
  'bonk_mallet', 'chain_bolt', 'flame_ring', 'frost_shards',
  'shadow_strike', 'thunder_clap', 'venom_cloud', 'crystal_shield',
  'gravity_bomb', 'soul_drain',
];

export type WeaponPattern =
  | 'fan_swing'
  | 'chain_target'
  | 'circular_ring'
  | 'multi_shot'
  | 'teleport_back'
  | 'targeted_aoe'
  | 'deployable'
  | 'orbital'
  | 'deploy_explode'
  | 'beam';

export type SpecialEffect =
  | 'none'
  | 'knockback'
  | 'chain_decay'
  | 'burn_dot'
  | 'slow'
  | 'backstab'
  | 'stun'
  | 'poison_dot'
  | 'reflect'
  | 'pull'
  | 'lifesteal';

// ─── Weapon Data ───

export interface WeaponData {
  type: WeaponType;
  name: string;
  description: string;
  baseDPS: number;
  range: number;
  cooldownSec: number;
  pattern: WeaponPattern;
  specialEffect: SpecialEffect;
  // Pattern-specific parameters
  fanAngleDeg?: number;
  chainCount?: number;
  chainDecay?: number;
  projectileCount?: number;
  knockbackPx?: number;
  dotDurationSec?: number;
  dotDPSPerSec?: number;
  slowPercent?: number;
  slowDurationSec?: number;
  stunDurationSec?: number;
  deployDurationSec?: number;
  orbitalCount?: number;
  pullDurationSec?: number;
  lifestealPct?: number;
  backstabMult?: number;
}

// ─── Weapon Evolution ───

export interface WeaponEvolutionData {
  level: number;
  dpsMult: number;
  rangeMult: number;
  cooldownMult: number;
  ultimateName?: string;
  ultimateDesc?: string;
}

export interface WeaponSlot {
  type: WeaponType;
  level: number;        // 1~5
  cooldownTicks: number; // remaining cooldown
}

export const MAX_WEAPON_SLOTS = 5;
export const MAX_WEAPON_LEVEL = 5;

// ─── Static Weapon Definitions ───

export const ALL_WEAPONS: WeaponData[] = [
  {
    type: 'bonk_mallet', name: 'Bonk Mallet',
    description: 'Smashes enemies in a 120 degree frontal cone with knockback',
    baseDPS: 25, range: 80, cooldownSec: 1.5,
    pattern: 'fan_swing', specialEffect: 'knockback',
    fanAngleDeg: 120, knockbackPx: 30,
  },
  {
    type: 'chain_bolt', name: 'Chain Bolt',
    description: 'Lightning bolt chains through 3 enemies with decreasing damage',
    baseDPS: 15, range: 150, cooldownSec: 1.2,
    pattern: 'chain_target', specialEffect: 'chain_decay',
    chainCount: 3, chainDecay: 0.20,
  },
  {
    type: 'flame_ring', name: 'Flame Ring',
    description: 'Expanding 360 degree ring of fire that burns enemies',
    baseDPS: 20, range: 120, cooldownSec: 3.0,
    pattern: 'circular_ring', specialEffect: 'burn_dot',
    dotDurationSec: 2.0, dotDPSPerSec: 10,
  },
  {
    type: 'frost_shards', name: 'Frost Shards',
    description: 'Fires 5 ice shards in a 45 degree cone, slowing enemies',
    baseDPS: 12, range: 180, cooldownSec: 1.0,
    pattern: 'multi_shot', specialEffect: 'slow',
    fanAngleDeg: 45, projectileCount: 5,
    slowPercent: 0.40, slowDurationSec: 1.0,
  },
  {
    type: 'shadow_strike', name: 'Shadow Strike',
    description: 'Teleports behind the nearest enemy for a backstab',
    baseDPS: 40, range: 200, cooldownSec: 4.0,
    pattern: 'teleport_back', specialEffect: 'backstab',
    backstabMult: 2.0,
  },
  {
    type: 'thunder_clap', name: 'Thunder Clap',
    description: 'AOE lightning on the highest-HP enemy, stunning targets',
    baseDPS: 30, range: 250, cooldownSec: 3.5,
    pattern: 'targeted_aoe', specialEffect: 'stun',
    stunDurationSec: 0.5,
  },
  {
    type: 'venom_cloud', name: 'Venom Cloud',
    description: 'Deploys a poison cloud at current position',
    baseDPS: 8, range: 100, cooldownSec: 5.0,
    pattern: 'deployable', specialEffect: 'poison_dot',
    deployDurationSec: 5.0, dotDurationSec: 5.0, dotDPSPerSec: 8,
  },
  {
    type: 'crystal_shield', name: 'Crystal Shield',
    description: '3 orbiting crystals that damage on contact and reflect',
    baseDPS: 10, range: 50, cooldownSec: 0,
    pattern: 'orbital', specialEffect: 'reflect',
    orbitalCount: 3,
  },
  {
    type: 'gravity_bomb', name: 'Gravity Bomb',
    description: 'Deploys a black hole that pulls enemies in, then explodes',
    baseDPS: 35, range: 200, cooldownSec: 6.0,
    pattern: 'deploy_explode', specialEffect: 'pull',
    pullDurationSec: 2.0,
  },
  {
    type: 'soul_drain', name: 'Soul Drain',
    description: 'Continuous beam to nearest enemy, stealing HP',
    baseDPS: 18, range: 120, cooldownSec: 0,
    pattern: 'beam', specialEffect: 'lifesteal',
    lifestealPct: 0.30,
  },
];

// ─── Evolution Table ───

export const WEAPON_EVOLUTION_TABLE: WeaponEvolutionData[] = [
  { level: 1, dpsMult: 1.0, rangeMult: 1.0, cooldownMult: 1.0 },
  { level: 2, dpsMult: 1.3, rangeMult: 1.0, cooldownMult: 1.0 },
  { level: 3, dpsMult: 1.3, rangeMult: 1.25, cooldownMult: 1.0 },
  { level: 4, dpsMult: 1.3, rangeMult: 1.25, cooldownMult: 0.80 },
  { level: 5, dpsMult: 1.6, rangeMult: 1.5, cooldownMult: 0.70 },
];

// ─── Ultimate Names ───

export const ULTIMATE_WEAPON_NAMES: Record<WeaponType, string> = {
  bonk_mallet: 'Earthquake',
  chain_bolt: 'Storm Network',
  flame_ring: 'Inferno',
  frost_shards: 'Blizzard',
  shadow_strike: 'Phantom Dance',
  thunder_clap: 'Judgment',
  venom_cloud: 'Plague',
  crystal_shield: 'Diamond Fortress',
  gravity_bomb: 'Singularity',
  soul_drain: 'Life Siphon',
};

export const ULTIMATE_WEAPON_DESCS: Record<WeaponType, string> = {
  bonk_mallet: '360 degree shockwave + crack zone',
  chain_bolt: '5-chain + residual lightning field',
  flame_ring: 'Double ring + piercing',
  frost_shards: '360 degree ice storm',
  shadow_strike: 'Triple teleport + clone',
  thunder_clap: 'Map-wide lightning + 5s stun (once per epoch)',
  venom_cloud: 'Moving cloud + infection spread',
  crystal_shield: '5 orbitals + 200% reflect',
  gravity_bomb: '5s black hole + 2x radius',
  soul_drain: 'Frontal cone + ally heal',
};

// ─── Status Effects ───

export type StatusEffectType = 'burn' | 'poison' | 'slow' | 'stun' | 'pull' | 'knockback_effect';

export interface StatusEffect {
  type: StatusEffectType;
  sourceId: string;
  ticksLeft: number;
  damagePerTick: number;
  slowFraction: number;
  knockbackX: number;
  knockbackY: number;
}

// ─── Weapon Damage Event (for client rendering) ───

export interface WeaponDamageEvent {
  attackerId: string;
  targetId: string;
  weaponType: WeaponType;
  damage: number;
  isCritical: boolean;
  isDot: boolean;
  isLifesteal: boolean;
  healAmount?: number;
  targetX: number;
  targetY: number;
}

// ─── Weapon Colors for VFX ───

export const WEAPON_COLORS: Record<WeaponType, { primary: string; secondary: string }> = {
  bonk_mallet:    { primary: '#C0804060', secondary: '#FFD700' },
  chain_bolt:     { primary: '#00BFFF', secondary: '#FFFFFF' },
  flame_ring:     { primary: '#FF4500', secondary: '#FFD700' },
  frost_shards:   { primary: '#87CEEB', secondary: '#FFFFFF' },
  shadow_strike:  { primary: '#4B0082', secondary: '#8A2BE2' },
  thunder_clap:   { primary: '#FFD700', secondary: '#FFFFFF' },
  venom_cloud:    { primary: '#32CD32', secondary: '#006400' },
  crystal_shield: { primary: '#00CED1', secondary: '#E0FFFF' },
  gravity_bomb:   { primary: '#4B0082', secondary: '#000000' },
  soul_drain:     { primary: '#8B0000', secondary: '#FF6347' },
};

// ─── Helper Functions ───

export function getWeaponData(type: WeaponType): WeaponData | undefined {
  return ALL_WEAPONS.find(w => w.type === type);
}

export function getEvolutionData(level: number): WeaponEvolutionData | undefined {
  if (level < 1 || level > MAX_WEAPON_LEVEL) return undefined;
  return WEAPON_EVOLUTION_TABLE[level - 1];
}

export function getEffectiveDPS(weapon: WeaponData, level: number): number {
  const evo = getEvolutionData(level);
  if (!evo) return weapon.baseDPS;
  return weapon.baseDPS * evo.dpsMult;
}

export function getEffectiveRange(weapon: WeaponData, level: number): number {
  const evo = getEvolutionData(level);
  if (!evo) return weapon.range;
  return weapon.range * evo.rangeMult;
}

export function getEffectiveCooldown(weapon: WeaponData, level: number): number {
  const evo = getEvolutionData(level);
  if (!evo) return weapon.cooldownSec;
  return weapon.cooldownSec * evo.cooldownMult;
}
