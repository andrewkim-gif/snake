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

export type ARWeaponID =
  | 'sniper_rifle'
  | 'lightning_staff'
  | 'bow'
  | 'revolver'
  | 'katana'
  | 'fire_staff'
  | 'aegis'
  | 'wireless_dagger'
  | 'black_hole'
  | 'axe'
  | 'frostwalker'
  | 'flamewalker'
  | 'poison_flask'
  | 'landmine'
  | 'shotgun'
  | 'dice';

export type ARWeaponTier = 'S' | 'A' | 'B';

export type ARProjectileType = 'straight' | 'homing' | 'pierce' | 'aoe';

export type ARItemID =
  | 'health_orb_small'
  | 'health_orb_large'
  | 'xp_magnet'
  | 'speed_boost'
  | 'shield_burst'
  | 'bomb'
  | 'iron_boots'
  | 'feather_cape'
  | 'vampire_ring'
  | 'berserker_helm'
  | 'crown_of_thorns'
  | 'magnet_amulet'
  | 'glass_cannon'
  | 'frozen_heart'
  | 'lucky_clover'
  | 'titan_belt';

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
  equipment: ARItemID[];
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

export interface ARProjectileNet {
  id: string;
  x: number;
  z: number;
  type: string; // weapon ID for visual selection
}

export interface ARFieldItemNet {
  id: string;
  itemId: ARItemID;
  x: number;
  z: number;
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
  projectiles: ARProjectileNet[];
  items: ARFieldItemNet[];
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
  targetId: string;
  amount: number;
  critCount: number;
  dmgType: ARDamageType;
  statusFx?: string;
  x: number;
  z: number;
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
// Damage Type Colors
// ============================================================

export const DAMAGE_TYPE_COLORS: Record<ARDamageType, string> = {
  physical: '#FFFFFF',
  fire: '#FF6B35',
  frost: '#4FC3F7',
  lightning: '#FFD54F',
  poison: '#66BB6A',
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
// Weapon Display Info
// ============================================================

export const WEAPON_INFO: Record<
  ARWeaponID,
  { name: string; icon: string; tier: ARWeaponTier; damageType: ARDamageType; desc: string }
> = {
  sniper_rifle: { name: 'Sniper Rifle', icon: '🔫', tier: 'S', damageType: 'physical', desc: 'Long-range precision' },
  lightning_staff: { name: 'Lightning Staff', icon: '⚡', tier: 'S', damageType: 'lightning', desc: 'Chain lightning ×3' },
  bow: { name: 'Bow', icon: '🏹', tier: 'S', damageType: 'physical', desc: 'Fast-firing ranged' },
  revolver: { name: 'Revolver', icon: '🔫', tier: 'S', damageType: 'physical', desc: 'High-damage medium range' },
  katana: { name: 'Katana', icon: '⚔️', tier: 'A', damageType: 'physical', desc: 'Fast melee, pierces' },
  fire_staff: { name: 'Fire Staff', icon: '🔥', tier: 'A', damageType: 'fire', desc: 'AOE fireball' },
  aegis: { name: 'Aegis', icon: '🛡️', tier: 'A', damageType: 'physical', desc: 'Shield bash + block' },
  wireless_dagger: { name: 'Wireless Dagger', icon: '🗡️', tier: 'A', damageType: 'physical', desc: 'Auto-tracking' },
  black_hole: { name: 'Black Hole', icon: '🕳️', tier: 'A', damageType: 'physical', desc: 'Pulls enemies 3s' },
  axe: { name: 'Axe', icon: '🪓', tier: 'B', damageType: 'physical', desc: '360° melee cleave' },
  frostwalker: { name: 'Frostwalker', icon: '❄️', tier: 'B', damageType: 'frost', desc: 'Freezing trail' },
  flamewalker: { name: 'Flamewalker', icon: '🔥', tier: 'B', damageType: 'fire', desc: 'Burning trail' },
  poison_flask: { name: 'Poison Flask', icon: '🧪', tier: 'B', damageType: 'poison', desc: 'Poison puddle DOT' },
  landmine: { name: 'Landmine', icon: '💣', tier: 'B', damageType: 'physical', desc: 'Planted explosive' },
  shotgun: { name: 'Shotgun', icon: '🔫', tier: 'B', damageType: 'physical', desc: '5-pellet cone blast' },
  dice: { name: 'Dice', icon: '🎲', tier: 'B', damageType: 'physical', desc: 'Random 0-300 damage' },
};

// ============================================================
// Item Display Info
// ============================================================

export const ITEM_INFO: Record<
  ARItemID,
  { name: string; icon: string; rarity: ARRarity; desc: string; category: 'instant' | 'equipment' }
> = {
  health_orb_small: { name: 'Health Orb (S)', icon: '❤️', rarity: 'common', desc: '+10% HP', category: 'instant' },
  health_orb_large: { name: 'Health Orb (L)', icon: '💖', rarity: 'uncommon', desc: '+30% HP', category: 'instant' },
  xp_magnet: { name: 'XP Magnet', icon: '🧲', rarity: 'rare', desc: 'Collect all XP', category: 'instant' },
  speed_boost: { name: 'Speed Boost', icon: '💨', rarity: 'uncommon', desc: '2x speed 15s', category: 'instant' },
  shield_burst: { name: 'Shield Burst', icon: '🛡️', rarity: 'rare', desc: '5s invincibility', category: 'instant' },
  bomb: { name: 'Bomb', icon: '💣', rarity: 'uncommon', desc: '25% HP AOE 10m', category: 'instant' },
  iron_boots: { name: 'Iron Boots', icon: '🥾', rarity: 'common', desc: '+30% KB resist', category: 'equipment' },
  feather_cape: { name: 'Feather Cape', icon: '🪶', rarity: 'uncommon', desc: 'Double jump', category: 'equipment' },
  vampire_ring: { name: 'Vampire Ring', icon: '💍', rarity: 'rare', desc: '3% lifesteal', category: 'equipment' },
  berserker_helm: { name: 'Berserker Helm', icon: '⚔️', rarity: 'rare', desc: '+40% dmg <50% HP', category: 'equipment' },
  crown_of_thorns: { name: 'Crown of Thorns', icon: '👑', rarity: 'epic', desc: '25% reflect + 1s invuln', category: 'equipment' },
  magnet_amulet: { name: 'Magnet Amulet', icon: '📿', rarity: 'uncommon', desc: '+5m XP range', category: 'equipment' },
  glass_cannon: { name: 'Glass Cannon', icon: '🔮', rarity: 'epic', desc: '+60% dmg, +40% taken', category: 'equipment' },
  frozen_heart: { name: 'Frozen Heart', icon: '💙', rarity: 'rare', desc: '30% freeze attackers', category: 'equipment' },
  lucky_clover: { name: 'Lucky Clover', icon: '🍀', rarity: 'uncommon', desc: 'Luck +3', category: 'equipment' },
  titan_belt: { name: 'Titan Belt', icon: '🏋️', rarity: 'epic', desc: '+30% HP, KB immune', category: 'equipment' },
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
