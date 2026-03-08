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
  | 'dice'
  // Evolved weapons (Phase 3)
  | 'storm_bow'
  | 'dexecutioner'
  | 'inferno'
  | 'dragon_breath'
  | 'pandemic';

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

// Phase 3: Miniboss types
export type ARMinibossType = 'golem' | 'wraith' | 'dragon_whelp' | 'lich_king' | 'the_arena';

// Phase 3: Elite affixes
export type AREliteAffix = 'armored' | 'swift' | 'vampiric' | 'explosive' | 'shielded';

// Phase 3: Synergy IDs
export type ARSynergyID =
  | 'infernal'
  | 'blizzard'
  | 'thunder_god'
  | 'plague_doctor'
  | 'juggernaut'
  | 'glass_cannon_syn'
  | 'speed_demon'
  | 'holy_trinity'
  | 'vampire_lord'
  | 'fortress';

// Phase 3: Terrain themes
export type ARTerrainTheme = 'urban' | 'desert' | 'mountain' | 'forest' | 'arctic' | 'island';

// Phase 3: Country tier
export type ARCountryTier = 'S' | 'A' | 'B' | 'C' | 'D';

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
  synergies?: ARSynergyID[];
}

export interface AREnemyNet {
  id: string;
  type: AREnemyType;
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  isElite: boolean;
  // Phase 3 fields
  isMiniboss?: boolean;
  minibossType?: ARMinibossType;
  eliteAffix?: AREliteAffix;
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
  terrain?: ARTerrainTheme;
  tier?: ARCountryTier;
  arenaRadius: number;  // v19: current arena radius for client rendering
  players: ARPlayerNet[];
  enemies: AREnemyNet[];
  xpCrystals: ARCrystalNet[];
  projectiles: ARProjectileNet[];
  items: ARFieldItemNet[];
  // Phase 5: PvP
  pvpRadius?: number;
  factionScores?: ARFactionPvPScoreNet[];
}

// Phase 5: Faction PvP score
export interface ARFactionPvPScoreNet {
  factionId: string;
  pvpKills: number;
  score: number;
}

// Phase 5: PvP kill event
export interface ARPvPKillEvent {
  killerId: string;
  victimId: string;
  xpStolen: number;
  killerFac: string;
  victimFac: string;
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
// Terrain Visual Info (Phase 3)
// ============================================================

export interface ARTerrainVisual {
  floorColor: string;
  fogColor: string;
  fogDensity: number;
  ambientLight: number;
  obstacleType: string;
  obstacleCount: number;
}

export const TERRAIN_VISUALS: Record<ARTerrainTheme, ARTerrainVisual> = {
  urban: {
    floorColor: '#3a3a3a', fogColor: '#222222',
    fogDensity: 0.02, ambientLight: 0.6,
    obstacleType: 'building', obstacleCount: 20,
  },
  desert: {
    floorColor: '#c2a360', fogColor: '#d4b577',
    fogDensity: 0.015, ambientLight: 0.9,
    obstacleType: 'rock', obstacleCount: 8,
  },
  mountain: {
    floorColor: '#5a5a4a', fogColor: '#8a8a7a',
    fogDensity: 0.03, ambientLight: 0.5,
    obstacleType: 'rock', obstacleCount: 15,
  },
  forest: {
    floorColor: '#2d4a2d', fogColor: '#1a3a1a',
    fogDensity: 0.04, ambientLight: 0.4,
    obstacleType: 'tree', obstacleCount: 25,
  },
  arctic: {
    floorColor: '#c8d8e4', fogColor: '#e0e8f0',
    fogDensity: 0.025, ambientLight: 0.8,
    obstacleType: 'ice', obstacleCount: 10,
  },
  island: {
    floorColor: '#3a7a3a', fogColor: '#6aaa8a',
    fogDensity: 0.01, ambientLight: 0.7,
    obstacleType: 'water', obstacleCount: 12,
  },
};

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
// Character Display Info (Phase 3)
// ============================================================

export interface ARCharacterInfo {
  name: string;
  icon: string;
  startWeapon: ARWeaponID;
  passive: string;
  tag: string;
}

export const CHARACTER_INFO: Record<ARCharacterType, ARCharacterInfo> = {
  striker: {
    name: 'Striker', icon: '⚔️',
    startWeapon: 'katana', passive: 'Every 5 kills: +5% attack speed',
    tag: 'melee',
  },
  guardian: {
    name: 'Guardian', icon: '🛡️',
    startWeapon: 'aegis', passive: 'On hit: +20% defense for 2s',
    tag: 'tank',
  },
  pyro: {
    name: 'Pyro', icon: '🔥',
    startWeapon: 'fire_staff', passive: '+25% fire damage, burn +1s',
    tag: 'mage',
  },
  frost_mage: {
    name: 'Frost Mage', icon: '❄️',
    startWeapon: 'frostwalker', passive: 'Frost hits: 20% instant freeze',
    tag: 'mage',
  },
  sniper: {
    name: 'Sniper', icon: '🎯',
    startWeapon: 'sniper_rifle', passive: '+20% ranged dmg, +5m range',
    tag: 'ranged',
  },
  gambler: {
    name: 'Gambler', icon: '🎲',
    startWeapon: 'dice', passive: '4 choices per level-up',
    tag: 'growth',
  },
  berserker: {
    name: 'Berserker', icon: '💢',
    startWeapon: 'axe', passive: 'Below 50% HP: +35% damage',
    tag: 'melee',
  },
  shadow: {
    name: 'Shadow', icon: '🌑',
    startWeapon: 'wireless_dagger', passive: 'After slide: 2s stealth',
    tag: 'assassin',
  },
};

// ============================================================
// Synergy Display Info (Phase 3)
// ============================================================

export interface ARSynergyInfo {
  name: string;
  desc: string;
  color: string;
}

export const SYNERGY_INFO: Record<ARSynergyID, ARSynergyInfo> = {
  infernal: { name: 'Infernal', desc: 'Fire weapon + Damage 3 + Area 2: +50% fire, burn spreads', color: '#FF4500' },
  blizzard: { name: 'Blizzard', desc: 'Frost weapon + Speed 3 + Area 2: freeze field trail', color: '#4FC3F7' },
  thunder_god: { name: 'Thunder God', desc: 'Lightning + Crit 3 + AtkSpd 3: crit chain lightning', color: '#FFD54F' },
  plague_doctor: { name: 'Plague Doctor', desc: 'Poison + Curse 2 + HP 3: poison x2, kills heal', color: '#66BB6A' },
  juggernaut: { name: 'Juggernaut', desc: 'Shield 3 + HP 3 + Thorns 3: shockwave + 50% reflect', color: '#9E9E9E' },
  glass_cannon_syn: { name: 'Glass Cannon', desc: 'Damage 5 + Crit 5 + HP 0: dmg x2, HP locked at 1', color: '#F44336' },
  speed_demon: { name: 'Speed Demon', desc: 'Speed 5 + Dodge 5: speed-proportional damage', color: '#00BCD4' },
  holy_trinity: { name: 'Holy Trinity', desc: 'XP 5 + Luck 5 + Cursed 3: XP x3, legendary chance', color: '#FFC107' },
  vampire_lord: { name: 'Vampire Lord', desc: 'Crit 3 + VampRing + BerserkHelm: crit lifesteal', color: '#880E4F' },
  fortress: { name: 'Fortress', desc: 'Aegis + Shield 3 + Thorns 2 + Guardian: 360 shield', color: '#607D8B' },
};

// ============================================================
// Miniboss Display Info (Phase 3)
// ============================================================

export const MINIBOSS_COLORS: Record<ARMinibossType, string> = {
  golem: '#795548',
  wraith: '#9C27B0',
  dragon_whelp: '#FF5722',
  lich_king: '#3F51B5',
  the_arena: '#FFD700',
};

export const MINIBOSS_INFO: Record<ARMinibossType, { name: string; desc: string }> = {
  golem: { name: 'Stone Golem', desc: 'Charge attack, high HP, slow' },
  wraith: { name: 'Wraith', desc: 'Teleports, AOE frost nova' },
  dragon_whelp: { name: 'Dragon Whelp', desc: 'Fire breath cone, summons adds' },
  lich_king: { name: 'Lich King', desc: 'Summons undead, frost lance' },
  the_arena: { name: 'The Arena', desc: 'Final boss, scales with survivors' },
};

// ============================================================
// Elite Affix Colors (Phase 3)
// ============================================================

export const ELITE_AFFIX_COLORS: Record<AREliteAffix, string> = {
  armored: '#9E9E9E',
  swift: '#00BCD4',
  vampiric: '#880E4F',
  explosive: '#FF5722',
  shielded: '#2196F3',
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
  lightning_staff: { name: 'Lightning Staff', icon: '⚡', tier: 'S', damageType: 'lightning', desc: 'Chain lightning x3' },
  bow: { name: 'Bow', icon: '🏹', tier: 'S', damageType: 'physical', desc: 'Fast-firing ranged' },
  revolver: { name: 'Revolver', icon: '🔫', tier: 'S', damageType: 'physical', desc: 'High-damage medium range' },
  katana: { name: 'Katana', icon: '⚔️', tier: 'A', damageType: 'physical', desc: 'Fast melee, pierces' },
  fire_staff: { name: 'Fire Staff', icon: '🔥', tier: 'A', damageType: 'fire', desc: 'AOE fireball' },
  aegis: { name: 'Aegis', icon: '🛡️', tier: 'A', damageType: 'physical', desc: 'Shield bash + block' },
  wireless_dagger: { name: 'Wireless Dagger', icon: '🗡️', tier: 'A', damageType: 'physical', desc: 'Auto-tracking' },
  black_hole: { name: 'Black Hole', icon: '🕳️', tier: 'A', damageType: 'physical', desc: 'Pulls enemies 3s' },
  axe: { name: 'Axe', icon: '🪓', tier: 'B', damageType: 'physical', desc: '360 melee cleave' },
  frostwalker: { name: 'Frostwalker', icon: '❄️', tier: 'B', damageType: 'frost', desc: 'Freezing trail' },
  flamewalker: { name: 'Flamewalker', icon: '🔥', tier: 'B', damageType: 'fire', desc: 'Burning trail' },
  poison_flask: { name: 'Poison Flask', icon: '🧪', tier: 'B', damageType: 'poison', desc: 'Poison puddle DOT' },
  landmine: { name: 'Landmine', icon: '💣', tier: 'B', damageType: 'physical', desc: 'Planted explosive' },
  shotgun: { name: 'Shotgun', icon: '🔫', tier: 'B', damageType: 'physical', desc: '5-pellet cone blast' },
  dice: { name: 'Dice', icon: '🎲', tier: 'B', damageType: 'physical', desc: 'Random 0-300 damage' },
  // Evolved weapons (Phase 3)
  storm_bow: { name: 'Storm Bow', icon: '⚡', tier: 'S', damageType: 'lightning', desc: 'Evolved: arrows with chain lightning' },
  dexecutioner: { name: 'Dexecutioner', icon: '⚔️', tier: 'S', damageType: 'physical', desc: 'Evolved: executes below 30% HP' },
  inferno: { name: 'Inferno', icon: '🔥', tier: 'S', damageType: 'fire', desc: 'Evolved: screen-wide fire storm' },
  dragon_breath: { name: 'Dragon Breath', icon: '🐉', tier: 'S', damageType: 'fire', desc: 'Evolved: continuous flame spray' },
  pandemic: { name: 'Pandemic', icon: '☠️', tier: 'S', damageType: 'poison', desc: 'Evolved: spreading poison cloud' },
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

// ============================================================
// Phase 6: Token Economy Types
// ============================================================

export type ARTokenType = 'aww' | 'country';

export interface ARRewardEntry {
  tokenType: ARTokenType;
  amount: number;
  source: string;
  countryCode: string;
}

export interface ARBattleRewards {
  playerId: string;
  entries: ARRewardEntry[];
  totalAww: number;
  totalCountry: number;
  profileXp: number;
  questProgress?: ARQuestDelta[];
}

export interface ARQuestDelta {
  questId: string;
  delta: number;
  complete: boolean;
}

// ============================================================
// Phase 6: Quest Types
// ============================================================

export type ARQuestPeriod = 'daily' | 'weekly' | 'season';

export type ARQuestCategory =
  | 'kill'
  | 'survive'
  | 'build'
  | 'pvp'
  | 'sovereignty'
  | 'explore'
  | 'challenge';

export interface ARQuest {
  id: string;
  templateId: string;
  name: string;
  desc: string;
  category: ARQuestCategory;
  period: ARQuestPeriod;
  target: number;
  progress: number;
  completed: boolean;
  rewardType: string;
  rewardAmount: number;
  expiresAt: string;
}

// ============================================================
// Phase 6: Season Pass Types
// ============================================================

export type ARSeasonEra = 'discovery' | 'expansion' | 'empires' | 'reckoning';

export interface ARSeasonPass {
  playerId: string;
  seasonId: string;
  level: number;
  xp: number;
  xpToNext: number;
  isPremium: boolean;
  claimedFree: number[];
  claimedPremium: number[];
}

export interface ARSeasonReward {
  level: number;
  track: 'free' | 'premium';
  rewardType: string;
  amount?: number;
  itemId?: string;
  description: string;
}

// ============================================================
// Phase 6: Profile Types
// ============================================================

export interface ARPlayerProfile {
  playerId: string;
  username: string;
  profileLevel: number;
  profileXp: number;
  profileXpMax: number;
  stats: ARLifetimeStats;
  preferredChar: ARCharacterType;
  unlockedChars: ARCharacterType[];
  unlockedWeapons: ARWeaponID[];
  achievements: ARAchievement[];
  awwBalance: number;
  seasonPassLevel: number;
  hasPremiumPass: boolean;
}

export interface ARLifetimeStats {
  totalBattles: number;
  totalWins: number;
  totalKills: number;
  totalPvpKills: number;
  totalDeaths: number;
  totalEliteKills: number;
  totalBossKills: number;
  highestLevel: number;
  longestSurvival: number;
  totalSurvivalSec: number;
  bestRank: number;
  factionWins: number;
  uniqueCountries: number;
}

export interface ARAchievement {
  id: string;
  name: string;
  desc: string;
  unlockedAt: string;
  rarity: ARRarity;
}

// ============================================================
// Phase 6: Character Unlock Types
// ============================================================

export interface ARCharUnlockInfo {
  character: ARCharacterType;
  defaultUnlock: boolean;
  description: string;
  locked: boolean;
  methods: ARUnlockMethod[];
}

export interface ARUnlockMethod {
  method: 'default' | 'quest' | 'achievement' | 'token' | 'profile' | 'season';
  profileLevel?: number;
  achievementId?: string;
  tokenCost?: number;
  seasonLevel?: number;
}

// ============================================================
// Phase 6: Spectate Types
// ============================================================

export interface ARSpectateState {
  playerId: string;
  targetId: string;
}

export interface ARDeathScreenData {
  killerId?: string;
  killerName?: string;
  survivalTime: number;
  finalLevel: number;
  kills: number;
  pvpKills: number;
  damageDealt: number;
  rank: number;
  canSpectate: boolean;
}

// ============================================================
// Phase 6: Sound Events
// ============================================================

export type ARSoundEvent =
  | 'attack_melee'
  | 'attack_ranged'
  | 'attack_magic'
  | 'hit_physical'
  | 'hit_fire'
  | 'hit_frost'
  | 'hit_lightning'
  | 'hit_poison'
  | 'crit_hit'
  | 'overcritical'
  | 'kill_normal'
  | 'kill_elite'
  | 'kill_miniboss'
  | 'kill_boss'
  | 'kill_pvp'
  | 'player_death'
  | 'level_up'
  | 'tome_select'
  | 'weapon_evolve'
  | 'synergy_activate'
  | 'item_pickup'
  | 'xp_collect'
  | 'phase_pvp_warning'
  | 'phase_pvp_start'
  | 'phase_settlement'
  | 'boss_spawn'
  | 'boss_defeated'
  | 'sovereignty_capture'
  | 'sovereignty_defend'
  | 'arena_shrink'
  | 'quest_complete'
  | 'season_level_up';

export const SOUND_PRIORITIES: Record<ARSoundEvent, number> = {
  attack_melee: 1,
  attack_ranged: 1,
  attack_magic: 1,
  hit_physical: 1,
  hit_fire: 1,
  hit_frost: 1,
  hit_lightning: 1,
  hit_poison: 1,
  crit_hit: 2,
  overcritical: 3,
  kill_normal: 2,
  kill_elite: 3,
  kill_miniboss: 4,
  kill_boss: 5,
  kill_pvp: 3,
  player_death: 5,
  level_up: 4,
  tome_select: 2,
  weapon_evolve: 4,
  synergy_activate: 4,
  item_pickup: 2,
  xp_collect: 1,
  phase_pvp_warning: 5,
  phase_pvp_start: 5,
  phase_settlement: 5,
  boss_spawn: 5,
  boss_defeated: 5,
  sovereignty_capture: 5,
  sovereignty_defend: 5,
  arena_shrink: 3,
  quest_complete: 4,
  season_level_up: 4,
};

// ============================================================
// Phase 6: Minimap Types
// ============================================================

export interface ARMinimapEntity {
  id: string;
  x: number;
  z: number;
  type: 'player' | 'ally' | 'enemy' | 'elite' | 'miniboss' | 'boss' | 'item' | 'crystal';
  alive: boolean;
}

export const MINIMAP_COLORS: Record<ARMinimapEntity['type'], string> = {
  player: '#FFFF00',
  ally: '#4CAF50',
  enemy: '#F44336',
  elite: '#FF9800',
  miniboss: '#9C27B0',
  boss: '#FFD700',
  item: '#2196F3',
  crystal: '#00BCD4',
};

// ============================================================
// Quest Category Display
// ============================================================

export const QUEST_CATEGORY_INFO: Record<ARQuestCategory, { name: string; icon: string; color: string }> = {
  kill: { name: 'Combat', icon: '⚔️', color: '#F44336' },
  survive: { name: 'Survival', icon: '🛡️', color: '#4CAF50' },
  build: { name: 'Build', icon: '📖', color: '#2196F3' },
  pvp: { name: 'PvP', icon: '⚡', color: '#FF9800' },
  sovereignty: { name: 'Sovereignty', icon: '👑', color: '#FFD700' },
  explore: { name: 'Explore', icon: '🌍', color: '#00BCD4' },
  challenge: { name: 'Challenge', icon: '🏆', color: '#9C27B0' },
};

// ============================================================
// Season Era Display
// ============================================================

export const ERA_INFO: Record<ARSeasonEra, { name: string; icon: string; color: string; desc: string }> = {
  discovery: { name: 'Discovery', icon: '🔍', color: '#4CAF50', desc: 'Lower difficulty, +50% XP' },
  expansion: { name: 'Expansion', icon: '📈', color: '#2196F3', desc: 'Faction growth, territory control' },
  empires: { name: 'Empires', icon: '⚔️', color: '#FF9800', desc: 'Full warfare, sovereignty battles' },
  reckoning: { name: 'Reckoning', icon: '💀', color: '#F44336', desc: '2x sovereignty rewards, finals' },
};

// ============================================================
// Phase 4 (v24): Weapon → Trajectory Type 매핑
// ARProjectileNet.type은 weapon ID → ARProjectileType으로 변환 필요
// ============================================================

export const WEAPON_TRAJECTORY_MAP: Record<ARWeaponID, ARProjectileType> = {
  // Straight (직선 투사체): 화살, 총알 계열
  bow: 'straight',
  sniper_rifle: 'straight',
  revolver: 'straight',
  shotgun: 'straight',
  storm_bow: 'straight',

  // Homing (추적 투사체): 마법, 자동추적 계열
  lightning_staff: 'homing',
  wireless_dagger: 'homing',

  // Pierce (관통 투사체): 근접 관통 계열
  katana: 'pierce',
  dexecutioner: 'pierce',

  // AOE (범위 공격): 폭발, 장판, 화염 계열
  fire_staff: 'aoe',
  black_hole: 'aoe',
  axe: 'aoe',
  poison_flask: 'aoe',
  landmine: 'aoe',
  frostwalker: 'aoe',
  flamewalker: 'aoe',
  inferno: 'aoe',
  dragon_breath: 'aoe',
  pandemic: 'aoe',

  // 기본값: straight (방어형/특수형)
  aegis: 'straight',
  dice: 'straight',
};

// 투사체 타입별 색상 (비주얼 구분용)
export const PROJECTILE_TYPE_COLORS: Record<ARProjectileType, string> = {
  straight: '#FFD54F',  // 황금색 화살
  homing: '#4FC3F7',    // 파란 추적 구
  pierce: '#FF6B35',    // 주황 관통 빔
  aoe: '#FF5722',       // 빨강 범위 링
};

// ============================================================
// Phase 3 (v24): Character Appearance Map
// ============================================================

export interface ARCharacterAppearance {
  eyeStyle: number;
  mouthStyle: number;
  hairStyle: number;
  skinTone: string;    // hex color for head/arms
  hairColor: string;   // hex color for hair tint
  bodyColor: string;   // hex color for body
  legColor: string;    // hex color for legs
}

export const CHARACTER_APPEARANCE_MAP: Record<ARCharacterType, ARCharacterAppearance> = {
  striker:     { eyeStyle: 0, mouthStyle: 0, hairStyle: 1,  skinTone: '#ffe0bd', hairColor: '#3A3028', bodyColor: '#CC3333', legColor: '#444444' },
  guardian:    { eyeStyle: 2, mouthStyle: 1, hairStyle: 10, skinTone: '#f5c5a3', hairColor: '#5C4033', bodyColor: '#607D8B', legColor: '#37474F' },
  pyro:       { eyeStyle: 5, mouthStyle: 3, hairStyle: 5,  skinTone: '#ffe0bd', hairColor: '#CC3333', bodyColor: '#FF5722', legColor: '#BF360C' },
  frost_mage: { eyeStyle: 8, mouthStyle: 2, hairStyle: 3,  skinTone: '#f0e0d0', hairColor: '#B0C4DE', bodyColor: '#4FC3F7', legColor: '#0277BD' },
  sniper:     { eyeStyle: 3, mouthStyle: 0, hairStyle: 2,  skinTone: '#d4a37a', hairColor: '#2C1608', bodyColor: '#4CAF50', legColor: '#2E7D32' },
  gambler:    { eyeStyle: 4, mouthStyle: 4, hairStyle: 7,  skinTone: '#ffe0bd', hairColor: '#FFD700', bodyColor: '#9C27B0', legColor: '#4A148C' },
  berserker:  { eyeStyle: 7, mouthStyle: 5, hairStyle: 0,  skinTone: '#c68642', hairColor: '#1A1A1A', bodyColor: '#F44336', legColor: '#B71C1C' },
  shadow:     { eyeStyle: 9, mouthStyle: 6, hairStyle: 9,  skinTone: '#e8d5c0', hairColor: '#1A1A2E', bodyColor: '#212121', legColor: '#111111' },
};
