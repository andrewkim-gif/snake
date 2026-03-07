/**
 * ar-types.ts — Arena Combat 공유 타입 정의
 * 서버(Go)와 클라이언트(TS) 간 동기화되는 타입들
 */

// ============================================================
// Phase & Enums
// ============================================================

export type ARPhase = 'deploy' | 'pve' | 'pvp_warning' | 'pvp' | 'settlement';

export type ARDamageType = 'physical' | 'fire' | 'frost' | 'lightning' | 'poison';

export type ARStatusEffect = 'burn' | 'freeze' | 'shock' | 'poison' | 'bleed' | 'mark';

export type ARCharacterType =
  | 'striker'
  | 'guardian'
  | 'pyro'
  | 'frost_mage'
  | 'sniper'
  | 'gambler'
  | 'berserker'
  | 'shadow';

export type AREnemyType = 'zombie' | 'skeleton' | 'slime' | 'spider' | 'creeper';

export type ARRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export type ARTomeID =
  | 'damage'
  | 'attack_speed'
  | 'crit_chance'
  | 'crit_damage'
  | 'area'
  | 'projectile'
  | 'speed'
  | 'hp'
  | 'shield'
  | 'thorns'
  | 'knockback'
  | 'xp'
  | 'luck'
  | 'magnet'
  | 'dodge'
  | 'cursed';

// ============================================================
// Entity Types
// ============================================================

export interface ARVec3 {
  x: number;
  y: number;
  z: number;
}

export interface ARPlayerNet {
  id: string;
  name: string;
  pos: ARVec3;
  rot: number;
  hp: number;
  maxHp: number;
  level: number;
  xp: number;
  xpToNext: number;
  alive: boolean;
  character: ARCharacterType;
  factionId: string;
  tomes: Record<string, number>;
  weapons: string[];
  kills: number;
}

export interface AREnemyNet {
  id: string;
  type: AREnemyType;
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  isElite: boolean;
}

export interface ARCrystalNet {
  id: string;
  x: number;
  z: number;
  value: number;
}

// ============================================================
// Network Messages
// ============================================================

export interface ARState {
  phase: ARPhase;
  timer: number;
  wave: number;
  players: ARPlayerNet[];
  enemies: AREnemyNet[];
  xpCrystals: ARCrystalNet[];
}

export interface ARInput {
  dirX: number;
  dirZ: number;
  jump: boolean;
  slide: boolean;
  aimY: number;
}

export interface ARChoice {
  tomeId?: string;
  weaponId?: string;
}

export interface ARTomeOffer {
  tomeId: ARTomeID;
  rarity: ARRarity;
  stacks: number;
}

export interface ARLevelUpEvent {
  level: number;
  choices: ARTomeOffer[];
}

export interface ARDamageEvent {
  target: string;
  amount: number;
  critCount: number;
}

// ============================================================
// Rarity Colors
// ============================================================

export const RARITY_COLORS: Record<ARRarity, string> = {
  common: '#CCCCCC',
  uncommon: '#4CAF50',
  rare: '#2196F3',
  epic: '#9C27B0',
  legendary: '#FF9800',
};

export const RARITY_BG_COLORS: Record<ARRarity, string> = {
  common: 'rgba(204,204,204,0.15)',
  uncommon: 'rgba(76,175,80,0.15)',
  rare: 'rgba(33,150,243,0.15)',
  epic: 'rgba(156,39,176,0.15)',
  legendary: 'rgba(255,152,0,0.20)',
};

// ============================================================
// Tome Display Info
// ============================================================

export const TOME_INFO: Record<
  ARTomeID,
  { name: string; icon: string; desc: string; tag: string }
> = {
  damage: { name: 'Damage', icon: '⚔️', desc: '+15% damage', tag: 'attack' },
  attack_speed: { name: 'Attack Speed', icon: '⚡', desc: '+10% attack speed', tag: 'attack' },
  crit_chance: { name: 'Crit Chance', icon: '🎯', desc: '+8% crit chance', tag: 'attack' },
  crit_damage: { name: 'Crit Damage', icon: '💥', desc: '+20% crit multiplier', tag: 'attack' },
  area: { name: 'Area', icon: '🔵', desc: '+12% AOE range', tag: 'attack' },
  projectile: { name: 'Projectile', icon: '🏹', desc: '+1 projectile & pierce', tag: 'attack' },
  speed: { name: 'Speed', icon: '💨', desc: '+8% move speed, +20 stamina', tag: 'movement' },
  hp: { name: 'HP', icon: '❤️', desc: '+10% max HP, +1 regen/s', tag: 'defense' },
  shield: { name: 'Shield', icon: '🛡️', desc: 'Block 1 hit every 10s', tag: 'defense' },
  thorns: { name: 'Thorns', icon: '🌹', desc: '15% damage reflection', tag: 'defense' },
  knockback: { name: 'Knockback', icon: '💪', desc: '+20% knockback', tag: 'utility' },
  xp: { name: 'XP Boost', icon: '📖', desc: '+15% XP gain', tag: 'growth' },
  luck: { name: 'Luck', icon: '🍀', desc: '+10% rare chance', tag: 'growth' },
  magnet: { name: 'Magnet', icon: '🧲', desc: '+1m XP range', tag: 'growth' },
  dodge: { name: 'Dodge', icon: '🌀', desc: '+5% dodge chance', tag: 'defense' },
  cursed: { name: 'Cursed', icon: '💀', desc: '+15% enemies, +25% XP', tag: 'risk' },
};

// ============================================================
// Enemy Display Info
// ============================================================

export const ENEMY_COLORS: Record<AREnemyType, string> = {
  zombie: '#4CAF50',
  skeleton: '#E0E0E0',
  slime: '#8BC34A',
  spider: '#795548',
  creeper: '#76FF03',
};
