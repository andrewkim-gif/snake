/**
 * Agent Survivor — Game Types v10.0
 * Snake Arena → Agent Survivor 리브랜딩
 * 하위 호환: Snake/SnakeSkin 인터페이스 유지 (deprecated)
 */

// ─── Core Types ───

export interface Position {
  x: number; // float, world coordinates
  y: number;
}

// ─── v10 Upgrade System Types ───

export type TomeType = 'xp' | 'speed' | 'damage' | 'armor' | 'magnet' | 'luck' | 'regen' | 'cursed';
export type AbilityType = 'venom_aura' | 'shield_burst' | 'lightning_strike' | 'speed_dash' | 'mass_drain' | 'gravity_well';
export type DamageSource = 'aura' | 'dash' | 'boundary' | 'venom';

// ─── v10 Map Object Types ───

export type MapObjectType = 'shrine' | 'spring' | 'altar' | 'gate';

export interface MapObjectConfig {
  type: MapObjectType;
  name: string;
  radius: number;          // 상호작용 반경 (px)
  respawnTicks: number;    // 재사용 쿨다운 (0 = 항상 활성)
  count: number;           // 스폰 개수
  description: string;
}

export interface PlayerBuild {
  tomes: Record<TomeType, number>;    // Tome별 스택 수
  abilities: AbilitySlot[];            // 최대 3개
}

export interface AbilitySlot {
  type: AbilityType;
  level: number;  // 1~4 (강화 횟수)
  cooldownUntil: number; // tick when ability is available again
}

export interface UpgradeChoice {
  id: string;
  type: 'tome' | 'ability' | 'weapon' | 'passive' | 'synergy_hint';
  tomeType?: TomeType;
  abilityType?: AbilityType;
  name: string;
  description: string;
  currentStacks?: number; // Tome: 현재 보유 스택
  currentLevel?: number;  // Ability: 현재 레벨 (이미 보유 시)
  // v14 Phase 3: Weapon choices
  weaponType?: import('./weapons').WeaponType;
  weaponLevel?: number;       // current weapon level (0 = new)
  // v14 Phase 3: Passive choices
  passiveType?: PassiveType;
  passiveStacks?: number;     // current stacks
  passiveMax?: number;        // max stacks
  // v14 Phase 3: Synergy hints
  synergyType?: V14SynergyType;
  synergyMissing?: string;    // what's needed to activate
}

// ─── v14 Phase 3: Passive & Synergy Types ───

export type PassiveType =
  | 'vigor' | 'swift' | 'fury' | 'iron_skin' | 'magnet'
  | 'fortune' | 'vitality' | 'precision' | 'blast' | 'haste';

export const ALL_PASSIVE_TYPES: PassiveType[] = [
  'vigor', 'swift', 'fury', 'iron_skin', 'magnet',
  'fortune', 'vitality', 'precision', 'blast', 'haste',
];

export type V14SynergyType =
  | 'thermal_shock' | 'assassins_mark' | 'fortress' | 'corruption'
  | 'thunder_god' | 'gravity_master' | 'berserker_v14' | 'iron_maiden'
  | 'glass_cannon_v14' | 'speedster_v14';

export interface PassiveDef {
  type: PassiveType;
  name: string;
  description: string;
  effectPerStack: number;
  maxStack: number;
}

export const ALL_PASSIVES: PassiveDef[] = [
  { type: 'vigor', name: 'Vigor', description: '+15% max HP per stack', effectPerStack: 0.15, maxStack: 6 },
  { type: 'swift', name: 'Swift', description: '+12% move speed per stack', effectPerStack: 0.12, maxStack: 5 },
  { type: 'fury', name: 'Fury', description: '+15% weapon damage per stack', effectPerStack: 0.15, maxStack: 8 },
  { type: 'iron_skin', name: 'Iron Skin', description: '-12% damage taken per stack', effectPerStack: 0.12, maxStack: 6 },
  { type: 'magnet', name: 'Magnet', description: '+25% pickup range per stack', effectPerStack: 0.25, maxStack: 5 },
  { type: 'fortune', name: 'Fortune', description: '+15% rare chance per stack', effectPerStack: 0.15, maxStack: 5 },
  { type: 'vitality', name: 'Vitality', description: '+2 HP/s regen per stack', effectPerStack: 2.0, maxStack: 5 },
  { type: 'precision', name: 'Precision', description: '+8% crit chance per stack', effectPerStack: 0.08, maxStack: 6 },
  { type: 'blast', name: 'Blast', description: '+15% AOE size per stack', effectPerStack: 0.15, maxStack: 5 },
  { type: 'haste', name: 'Haste', description: '-8% cooldown per stack', effectPerStack: 0.08, maxStack: 5 },
];

export interface V14SynergyDef {
  type: V14SynergyType;
  name: string;
  description: string;
}

export const ALL_V14_SYNERGIES: V14SynergyDef[] = [
  { type: 'thermal_shock', name: 'Thermal Shock', description: 'Burn+Slow enemies take 2x damage' },
  { type: 'assassins_mark', name: "Assassin's Mark", description: 'Backstab attacks are always critical' },
  { type: 'fortress', name: 'Fortress', description: 'Reflect damage 300%, knockback immunity' },
  { type: 'corruption', name: 'Corruption', description: 'DOT range 2x, lifesteal on DOT' },
  { type: 'thunder_god', name: 'Thunder God', description: 'Stunned targets trigger chain lightning' },
  { type: 'gravity_master', name: 'Gravity Master', description: 'Black hole range 2x, pulls orbs' },
  { type: 'berserker_v14', name: 'Berserker', description: 'On kill: 3s double attack speed' },
  { type: 'iron_maiden', name: 'Iron Maiden', description: 'Reflect 20% damage, 2x regen' },
  { type: 'glass_cannon_v14', name: 'Glass Cannon', description: 'Crit 3x damage, +50% damage taken' },
  { type: 'speedster_v14', name: 'Speedster', description: 'No dash cooldown, invincible during dash' },
];

// ─── v10 Agent Entity ───

/** AgentSkin — Phase 1 간소화 버전 (기존 SnakeSkin 호환) */
export interface AgentSkin {
  id: number;
  primaryColor: string;
  secondaryColor: string;
  pattern: 'solid' | 'striped' | 'gradient' | 'dotted';
  eyeStyle: 'default' | 'angry' | 'cute' | 'cool' | 'dot' | 'wink';
  accentColor?: string;
}

export interface Agent {
  id: string;
  name: string;

  // 단일 위치 + 이동 (segments 제거)
  position: Position;       // 단일 좌표
  heading: number;          // current angle (0~2π)
  targetAngle: number;      // input-requested angle
  speed: number;            // current speed (px/s)

  // 전투 & 생존
  mass: number;             // HP 역할
  level: number;            // 현재 레벨
  xp: number;               // 현재 XP
  xpToNext: number;         // 다음 레벨까지 필요 XP
  boosting: boolean;        // 대시 (기존 부스트)
  alive: boolean;

  // 빌드 시스템
  build: PlayerBuild;
  activeSynergies: string[];

  // 비주얼
  skin: AgentSkin;

  // 파워업 효과 (기존 유지)
  activeEffects: ActiveEffect[];
  effectCooldowns: EffectCooldown[];

  // 점수
  score: number;
  kills: number;
  bestScore: number;

  // 메타
  joinedAt: number;
  lastInputSeq: number;

  // v14: Nationality system
  nationality?: string;     // ISO3 country code (e.g., "KOR", "USA")

  // 히트박스 (파생값)
  hitboxRadius: number;     // mass 기반 동적 크기

  // 전투 추적
  lastDamagedBy: string | null;  // 마지막 가해자 ID (킬 크레딧)
  killStreak: number;            // 연속 킬 카운트

  // 레벨업 대기 상태
  pendingUpgradeChoices: UpgradeChoice[] | null;
  upgradeDeadlineTick: number;   // 이 틱까지 선택 안하면 랜덤
}

// ─── Snake Entity ───

export interface SnakeSkin {
  id: number;
  primaryColor: string;
  secondaryColor: string;
  pattern: 'solid' | 'striped' | 'gradient' | 'dotted';
  eyeStyle: 'default' | 'angry' | 'cute' | 'cool' | 'dot' | 'wink';
  accentColor?: string;
  headShape?: 'round' | 'diamond' | 'arrow';
  tailEffect?: 'none' | 'spark' | 'trail' | 'fade' | 'bubble';
}

export interface Snake {
  id: string;
  name: string;

  // 연속 이동 (각도 기반)
  segments: Position[]; // [0]=head, [n]=tail
  heading: number;      // current angle (0~2π)
  targetAngle: number;  // client-requested angle
  speed: number;        // current speed (px/s)

  // 성장 & 상태
  mass: number;
  boosting: boolean;
  alive: boolean;

  // 비주얼
  skin: SnakeSkin;

  // 파워업 효과
  activeEffects: ActiveEffect[];
  effectCooldowns: EffectCooldown[];

  // 점수
  score: number;
  kills: number;
  bestScore: number;

  // 메타
  joinedAt: number;
  lastInputSeq: number;
}

// ─── Orb Entity ───

export type OrbType = 'natural' | 'death' | 'boost_trail' | 'magnet' | 'speed' | 'ghost' | 'mega';

// ─── Effect System ───

export type EffectType = 'magnet' | 'speed' | 'ghost';

export interface ActiveEffect {
  type: EffectType;
  expiresAt: number;
}

export interface EffectCooldown {
  type: EffectType;
  availableAt: number;
}

export interface Orb {
  id: number;
  position: Position;
  value: number;
  color: number;    // color index (0-11)
  type: OrbType;
  createdAt: number;
  lifetime?: number; // ticks until despawn (trail orbs)
}

// ─── Arena ───

export interface ArenaBoundary {
  center: Position;
  radius: number;
}

export interface ArenaConfig {
  radius: number;           // 6000
  maxPlayers: number;       // 100
  tickRate: number;         // 20 Hz
  baseSpeed: number;        // 150 px/s
  boostSpeed: number;       // 300 px/s
  turnRate: number;         // 0.25 rad/tick
  segmentSpacing: number;   // 8 units (deprecated in v10)
  initialMass: number;      // 10
  minBoostMass: number;     // 15
  boostCostPerTick: number; // 0.5
  collectRadius: number;    // 20 units
  headRadius: number;       // 12 units (deprecated, use hitboxRadius)
  naturalOrbTarget: number; // 2000
  deathOrbRatio: number;    // 0.8
  trailOrbInterval: number; // 3 ticks (deprecated in v10)
  trailOrbValue: number;    // 2 (deprecated in v10)
  trailOrbLifetime: number; // 600 ticks (deprecated in v10)

  // v10 전투 상수
  auraRadius: number;       // 60px — 전투 오라 반경
  auraDpsPerTick: number;   // 2.0 mass/tick — 기본 오라 DPS
  dashDamageRatio: number;  // 0.3 — 대시 충돌 시 상대 mass의 30% 피해
  hitboxBaseRadius: number; // 16px — 기본 히트박스 반경
  hitboxMaxRadius: number;  // 22px — 최대 히트박스 반경

  // v10 아레나 수축
  shrinkEnabled: boolean;   // true
  shrinkRatePerMin: number; // 600px/min
  shrinkMinRadius: number;  // 1200px
  boundaryPenaltyPerTick: number; // 0.0025 (0.25% mass/tick)

  // v10 레벨업
  upgradeChoiceTimeout: number; // 100 ticks (5초 @ 20Hz)
  gracePeriodTicks: number;     // 600 ticks (30초)
}

export interface ArenaState {
  tick: number;
  /** @deprecated v10: use agents */
  snakes: Map<string, Snake>;
  agents: Map<string, Agent>;
  orbs: Orb[];
  boundary: ArenaBoundary;
  config: ArenaConfig;
  leaderboard: LeaderboardEntry[];
  currentRadius: number; // v10: 수축된 현재 반경
}

// ─── Leaderboard ───

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  kills: number;
  rank: number;
}

// ─── Viewport ───

export interface Viewport {
  center: Position;
  width: number;
  height: number;
  zoom: number; // 0.5~1.0
}

// ─── Spatial Hash ───

/** @deprecated v10: use AgentCell */
export interface SpatialCell {
  snakeSegments: Array<{ snakeId: string; segIndex: number; pos: Position }>;
  orbs: Orb[];
}

export interface AgentCell {
  agents: Array<{ agentId: string; x: number; y: number }>;
  orbs: Orb[];
}

export interface SpatialHashConfig {
  cellSize: number;  // 200 units
  gridWidth: number;
  gridHeight: number;
}

// ─── v10 Synergy ───

export interface SynergyDef {
  id: string;
  name: string;
  requirements: {
    tomes?: Partial<Record<TomeType, number>>;
    abilities?: Partial<Record<AbilityType, number>>;
  };
  bonus: SynergyBonus;
  hidden: boolean;
}

export interface SynergyBonus {
  description: string;
  effects: Partial<Record<string, number>>; // e.g. { 'xpMultiplier': 1.5, 'dpsMultiplier': 2.0 }
}
