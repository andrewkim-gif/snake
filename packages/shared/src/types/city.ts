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

// --- City State (Server → Client, 2Hz) ---

export type ControlMode = 0 | 1 | 2; // 0=AI, 1=PlayerManaged, 2=Spectated

export interface CityClientState {
  iso3: string;
  tier: string;
  mode: ControlMode;
  buildings: Building[];
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
}

// --- City Commands (Client → Server) ---

export type CityCommandType = "build" | "demolish" | "upgrade" | "toggle";

export interface CityCommand {
  iso3: string;
  type: CityCommandType;
  buildingId?: string; // for demolish/upgrade/toggle
  defId?: string;      // for build
  tileX?: number;      // for build
  tileY?: number;      // for build
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
