// v26: City Simulation Types — Shared between server and client

// --- Resource Types ---

export type ResourceTier = 1 | 2 | 3;

/** 33 resource types across 3 tiers */
export type CityResourceType =
  // Tier 1: Raw Materials (15)
  | "grain" | "sugarcane" | "tobacco" | "cotton" | "coffee"
  | "fish" | "cattle" | "iron_ore" | "bauxite" | "coal"
  | "crude_oil" | "natural_gas" | "timber" | "rubber" | "rare_earth"
  // Tier 2: Processed Goods (12)
  | "food" | "sugar" | "cigars" | "textiles" | "steel"
  | "aluminum" | "plastics" | "chemicals" | "fuel" | "lumber"
  | "electronics" | "machinery"
  // Tier 3: Advanced Products (6)
  | "weapons" | "vehicles" | "pharmaceuticals" | "luxury_goods"
  | "semiconductors" | "aerospace";

// --- Building Types ---

export type BuildingCategory =
  | "raw_extraction"
  | "processing"
  | "advanced"
  | "service"
  | "infrastructure"
  | "military"
  | "government";

export interface ResourceIO {
  resource: CityResourceType;
  amount: number;
}

export interface BuildingDef {
  id: string;
  name: string;
  category: BuildingCategory;
  tier: number;
  produces: ResourceIO[];
  consumes: ResourceIO[];
  maxWorkers: number;
  buildCost: number;
  maintenance: number;
  sizeW: number;
  sizeH: number;
  powerUse: number;
  powerGen: number;
  maxLevel: number;
  era: number;
}

export interface Building {
  id: string;
  defId: string;
  tileX: number;
  tileY: number;
  level: number;
  workers: number;
  efficiency: number;
  powered: boolean;
  enabled: boolean;
  underConstruction: boolean;
  constructionLeft: number;
}

// --- Trade Types ---

export type TradeDirection = 0 | 1; // 0=export, 1=import

export interface TradeRoute {
  id: string;
  partnerIso: string;
  resource: CityResourceType;
  direction: TradeDirection;
  quantity: number;
  priceBonus: number;
  active: boolean;
}

// --- Citizen Types ---

/** Citizen FSM states */
export type CitizenFSMState =
  | "idle"
  | "commuting"
  | "working"
  | "shopping"
  | "resting"
  | "protesting";

/** Citizen education levels */
export type CitizenEducation = "uneducated" | "highschool" | "college";

/** Lightweight citizen snapshot sent to clients via city_state (2Hz) */
export interface CitizenSnapshot {
  id: string;
  tileX: number;
  tileY: number;
  state: CitizenFSMState;
  education: CitizenEducation;
  employed: boolean;
}

/** FSM state → color mapping for client rendering */
export const CITIZEN_STATE_COLORS: Record<CitizenFSMState, number> = {
  working:    0x3388ff, // blue
  commuting:  0xffcc00, // yellow
  shopping:   0x33cc33, // green
  resting:    0x999999, // gray
  protesting: 0xff3333, // red
  idle:       0xffffff, // white
};

// --- City State (Server → Client, 2Hz) ---

export type ControlMode = 0 | 1 | 2; // 0=AI, 1=PlayerManaged, 2=Spectated

export interface CityClientState {
  iso3: string;
  tier: string;
  mode: ControlMode;
  buildings: Building[];
  citizens: CitizenSnapshot[];
  resources: Record<string, number>;
  treasury: number;
  gdp: number;
  population: number;
  happiness: number;
  military: number;
  powerGen: number;
  powerUse: number;
  taxRate: number;
  tickCount: number;
  atWar: boolean;
  tradeRoutes: TradeRoute[];
  employed: number;
  unemployed: number;
  /** Phase 5: Politics state */
  politics?: PoliticsClientState;
  /** Phase 6: Election state */
  election?: ElectionClientState;
  /** Phase 6: Diplomacy bridge state */
  diplomacy?: DiplomacyBridgeState;
}

// --- City Commands (Client → Server) ---

export type CityCommandType = "build" | "demolish" | "upgrade" | "toggle" | "issue_edict" | "revoke_edict" | "vote";

export interface CityCommand {
  iso3: string;
  type: CityCommandType;
  buildingId?: string; // for demolish/upgrade/toggle
  defId?: string;      // for build
  tileX?: number;      // for build
  tileY?: number;      // for build
  edictId?: string;       // for issue_edict/revoke_edict
  candidateId?: string;   // for vote
}

// --- City Events (Server → Client) ---

export interface CityEvent {
  iso3: string;
  type: string;
  data: Record<string, unknown>;
}

// --- Economy Stats ---

export interface CityEconomyStats {
  productionValue: number;
  wagesPaid: number;
  maintenancePaid: number;
  taxCollected: number;
  tradeIncome: number;
  tradeExpense: number;
  gdp: number;
  foodSatisfaction: number;
  powerSurplus: number;
}

// --- Phase 5: Politics & Faction Types ---

/** 4-axis political spectrum (each -1.0 to +1.0) */
export interface FactionAxes {
  /** Capitalist (+1) vs Communist (-1) */
  economic: number;
  /** Industrialist (+1) vs Environmentalist (-1) */
  environment: number;
  /** Militarist (+1) vs Religious (-1) */
  governance: number;
  /** Progressive (+1) vs Conservative (-1) */
  social: number;
}

/** Faction axis label (used as key) */
export type FactionAxisKey = keyof FactionAxes;

/** Faction axis display names */
export const FACTION_AXIS_LABELS: Record<FactionAxisKey, [string, string]> = {
  economic:     ['Communist', 'Capitalist'],
  environment:  ['Environmentalist', 'Industrialist'],
  governance:   ['Religious', 'Militarist'],
  social:       ['Conservative', 'Progressive'],
};

/** Faction axis colors: [negative side color, positive side color] */
export const FACTION_AXIS_COLORS: Record<FactionAxisKey, [string, string]> = {
  economic:     ['#EF4444', '#F59E0B'],  // red ↔ gold
  environment:  ['#10B981', '#6B7280'],  // green ↔ gray
  governance:   ['#A855F7', '#84CC16'],  // purple ↔ olive
  social:       ['#3B82F6', '#F97316'],  // blue ↔ orange
};

/** Faction support snapshot (per axis: average citizen affinity) */
export interface FactionSnapshot {
  /** Average citizen affinities per axis (-1~+1) */
  axes: FactionAxes;
  /** Overall approval rating (0~100) */
  approval: number;
  /** Dissatisfaction level (0~100, >=80 triggers ultimatum) */
  dissatisfaction: number;
}

/** Edict/Decree category */
export type EdictCategory = 'economic' | 'social' | 'military' | 'environmental';

/** Edict definition (available edicts) */
export interface EdictDef {
  id: string;
  name: string;
  description: string;
  category: EdictCategory;
  /** Effect on faction axes (additive per tick) */
  factionEffect: Partial<FactionAxes>;
  /** Effect on happiness factors */
  happinessEffect: Partial<{
    food: number;
    healthcare: number;
    entertainment: number;
    faith: number;
    housing: number;
    job: number;
    liberty: number;
    safety: number;
  }>;
  /** Treasury cost per tick */
  costPerTick: number;
  /** Minimum treasury to enact */
  minTreasury: number;
}

/** Active edict instance */
export interface ActiveEdict {
  edictId: string;
  enactedTick: number;
  active: boolean;
}

/** Political event type */
export type PoliticalEventType =
  | 'protest'
  | 'strike'
  | 'coup_attempt'
  | 'faction_shift'
  | 'edict_enacted'
  | 'edict_revoked';

/** Political event (server → client notification) */
export interface PoliticalEvent {
  type: PoliticalEventType;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  tick: number;
}

/** Politics state included in CityClientState */
export interface PoliticsClientState {
  factions: FactionSnapshot;
  activeEdicts: ActiveEdict[];
  availableEdicts: EdictDef[];
  recentEvents: PoliticalEvent[];
}

// --- Phase 6: Election System Types ---

/** Election cycle phase */
export type ElectionPhase = 'none' | 'campaign' | 'voting' | 'results';

/** Pledge (edict promise) in a candidate's platform */
export interface PledgeSnapshot {
  edictId: string;
  edictName: string;
  category: string;
  description: string;
}

/** Election candidate */
export interface CandidateSnapshot {
  id: string;
  name: string;
  isIncumbent: boolean;
  /** Candidate's political stance (4 axes) */
  factionAxes: FactionAxes;
  /** Edicts the candidate pledges to enact */
  pledges: PledgeSnapshot[];
  /** Current poll support (0~100%) */
  supportPct: number;
  /** Final vote count (only after results) */
  votes: number;
}

/** Completed election record */
export interface ElectionRecord {
  tick: number;
  winnerId: string;
  winnerName: string;
  candidates: CandidateSnapshot[];
  totalVotes: number;
}

/** Election state included in CityClientState */
export interface ElectionClientState {
  phase: ElectionPhase;
  candidates: CandidateSnapshot[];
  phaseStart: number;
  nextElection: number;
  playerVote: string;
  history: ElectionRecord[];
}

// --- Phase 6: Diplomacy Bridge Types ---

/** Diplomacy bridge state (Iso ↔ Globe connection) */
export interface DiplomacyBridgeState {
  isAtWar: boolean;
  enemies: string[];
  warResourceDrain: number;
  warHappinessPenalty: number;
  militaryBoost: number;
  tradeBonus: number;
  allyCount: number;
  tradePartners: number;
  sanctionedBy: number;
}

// --- Phase 8: Globe Sync Types ---

/** Lightweight city summary for Globe view rendering */
export interface CityGlobeSummary {
  gdp: number;
  population: number;
  happiness: number;
  military: number;
  treasury: number;
  atWar: boolean;
  mode: ControlMode;
}

/** Globe sync payload — map of iso3 → summary */
export type CityGlobeSyncData = Record<string, CityGlobeSummary>;
