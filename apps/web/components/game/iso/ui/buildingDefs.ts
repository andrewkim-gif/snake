/**
 * v26 Phase 4 — Client-side Building Definitions
 * 서버 BuildingRegistry 미러링 — UI 패널에서 생산/소비/비용 표시용
 */

import type { BuildingCategory, CityResourceType, BuildingDef as SharedBuildingDef } from '@agent-survivor/shared/types/city';

/** 클라이언트용 건물 정의 (SharedBuildingDef와 동일 구조) */
export type ClientBuildingDef = SharedBuildingDef;

/** 자원 표시명 맵 */
export const RESOURCE_LABELS: Record<string, string> = {
  grain: 'Grain', sugarcane: 'Sugarcane', tobacco: 'Tobacco', cotton: 'Cotton', coffee: 'Coffee',
  fish: 'Fish', cattle: 'Cattle', iron_ore: 'Iron Ore', bauxite: 'Bauxite', coal: 'Coal',
  crude_oil: 'Crude Oil', natural_gas: 'Natural Gas', timber: 'Timber', rubber: 'Rubber', rare_earth: 'Rare Earth',
  food: 'Food', sugar: 'Sugar', cigars: 'Cigars', textiles: 'Textiles', steel: 'Steel',
  aluminum: 'Aluminum', plastics: 'Plastics', chemicals: 'Chemicals', fuel: 'Fuel', lumber: 'Lumber',
  electronics: 'Electronics', machinery: 'Machinery',
  weapons: 'Weapons', vehicles: 'Vehicles', pharmaceuticals: 'Pharmaceuticals',
  luxury_goods: 'Luxury Goods', semiconductors: 'Semiconductors', aerospace: 'Aerospace',
};

/** 자원 아이콘 이모지 맵 */
export const RESOURCE_ICONS: Record<string, string> = {
  grain: '\u{1F33E}', sugarcane: '\u{1F33F}', tobacco: '\u{1F343}', cotton: '\u{2601}\uFE0F', coffee: '\u{2615}',
  fish: '\u{1F41F}', cattle: '\u{1F404}', iron_ore: '\u{26CF}\uFE0F', bauxite: '\u{1FAA8}', coal: '\u{26AB}',
  crude_oil: '\u{1F6E2}\uFE0F', natural_gas: '\u{1F4A8}', timber: '\u{1FAB5}', rubber: '\u{1F7E4}', rare_earth: '\u{1F48E}',
  food: '\u{1F35E}', sugar: '\u{1F36C}', cigars: '\u{1F6AC}', textiles: '\u{1F9F5}', steel: '\u{1F529}',
  aluminum: '\u{1F4BF}', plastics: '\u{1F9EA}', chemicals: '\u{2697}\uFE0F', fuel: '\u{26FD}', lumber: '\u{1FAB5}',
  electronics: '\u{1F4F1}', machinery: '\u{2699}\uFE0F',
  weapons: '\u{1F52B}', vehicles: '\u{1F697}', pharmaceuticals: '\u{1F48A}',
  luxury_goods: '\u{1F48D}', semiconductors: '\u{1F4BB}', aerospace: '\u{1F680}',
};

/** 카테고리 표시명 */
export const CATEGORY_LABELS: Record<string, string> = {
  all: 'All',
  raw_extraction: 'Raw Extraction',
  processing: 'Processing',
  advanced: 'Advanced',
  service: 'Service',
  infrastructure: 'Infrastructure',
  military: 'Military',
  government: 'Government',
};

/** 카테고리 색상 */
export const CATEGORY_COLORS: Record<string, string> = {
  raw_extraction: '#4A9E4A',
  processing: '#F59E0B',
  advanced: '#6366F1',
  service: '#10B981',
  infrastructure: '#8B8D98',
  military: '#EF4444',
  government: '#CC9933',
};

/** 핵심 HUD 자원 (상단 바에 표시할 것들) */
export const HUD_RESOURCES: { key: string; label: string; icon: string; color: string }[] = [
  { key: '_treasury', label: 'Treasury', icon: '\u{1F4B0}', color: '#F59E0B' },
  { key: 'food', label: 'Food', icon: '\u{1F35E}', color: '#10B981' },
  { key: 'iron_ore', label: 'Iron', icon: '\u{26CF}\uFE0F', color: '#8B8D98' },
  { key: 'crude_oil', label: 'Oil', icon: '\u{1F6E2}\uFE0F', color: '#55565E' },
  { key: '_power', label: 'Power', icon: '\u{26A1}', color: '#FBBF24' },
  { key: '_population', label: 'Pop', icon: '\u{1F465}', color: '#6366F1' },
  { key: '_happiness', label: 'Happy', icon: '\u{2764}\uFE0F', color: '#EF4444' },
];

/** 58 건물 정의 — 서버 BuildingRegistry 미러 */
export const CLIENT_BUILDING_DEFS: ClientBuildingDef[] = [
  // --- Tier 1: Raw Extraction (15) ---
  { id: 'farm', name: 'Farm', category: 'raw_extraction', tier: 1, produces: [{ resource: 'grain', amount: 10 }], consumes: [], maxWorkers: 8, buildCost: 500, maintenance: 20, sizeW: 2, sizeH: 2, powerUse: 0, powerGen: 0, maxLevel: 3, era: 0 },
  { id: 'sugar_plantation', name: 'Sugar Plantation', category: 'raw_extraction', tier: 1, produces: [{ resource: 'sugarcane', amount: 8 }], consumes: [], maxWorkers: 10, buildCost: 600, maintenance: 25, sizeW: 2, sizeH: 2, powerUse: 0, powerGen: 0, maxLevel: 3, era: 0 },
  { id: 'tobacco_plantation', name: 'Tobacco Plantation', category: 'raw_extraction', tier: 1, produces: [{ resource: 'tobacco', amount: 6 }], consumes: [], maxWorkers: 10, buildCost: 700, maintenance: 30, sizeW: 2, sizeH: 2, powerUse: 0, powerGen: 0, maxLevel: 3, era: 0 },
  { id: 'cotton_plantation', name: 'Cotton Plantation', category: 'raw_extraction', tier: 1, produces: [{ resource: 'cotton', amount: 8 }], consumes: [], maxWorkers: 10, buildCost: 600, maintenance: 25, sizeW: 2, sizeH: 2, powerUse: 0, powerGen: 0, maxLevel: 3, era: 0 },
  { id: 'coffee_plantation', name: 'Coffee Plantation', category: 'raw_extraction', tier: 1, produces: [{ resource: 'coffee', amount: 5 }], consumes: [], maxWorkers: 8, buildCost: 800, maintenance: 30, sizeW: 2, sizeH: 2, powerUse: 0, powerGen: 0, maxLevel: 3, era: 0 },
  { id: 'fishing_wharf', name: 'Fishing Wharf', category: 'raw_extraction', tier: 1, produces: [{ resource: 'fish', amount: 8 }], consumes: [], maxWorkers: 6, buildCost: 400, maintenance: 15, sizeW: 2, sizeH: 1, powerUse: 0, powerGen: 0, maxLevel: 3, era: 0 },
  { id: 'ranch', name: 'Ranch', category: 'raw_extraction', tier: 1, produces: [{ resource: 'cattle', amount: 6 }], consumes: [], maxWorkers: 6, buildCost: 700, maintenance: 25, sizeW: 3, sizeH: 2, powerUse: 0, powerGen: 0, maxLevel: 3, era: 0 },
  { id: 'iron_mine', name: 'Iron Mine', category: 'raw_extraction', tier: 1, produces: [{ resource: 'iron_ore', amount: 8 }], consumes: [], maxWorkers: 12, buildCost: 1000, maintenance: 40, sizeW: 2, sizeH: 2, powerUse: 5, powerGen: 0, maxLevel: 3, era: 0 },
  { id: 'bauxite_mine', name: 'Bauxite Mine', category: 'raw_extraction', tier: 1, produces: [{ resource: 'bauxite', amount: 6 }], consumes: [], maxWorkers: 12, buildCost: 1100, maintenance: 45, sizeW: 2, sizeH: 2, powerUse: 5, powerGen: 0, maxLevel: 3, era: 1 },
  { id: 'coal_mine', name: 'Coal Mine', category: 'raw_extraction', tier: 1, produces: [{ resource: 'coal', amount: 10 }], consumes: [], maxWorkers: 14, buildCost: 900, maintenance: 35, sizeW: 2, sizeH: 2, powerUse: 3, powerGen: 0, maxLevel: 3, era: 0 },
  { id: 'oil_well', name: 'Oil Well', category: 'raw_extraction', tier: 1, produces: [{ resource: 'crude_oil', amount: 8 }], consumes: [], maxWorkers: 8, buildCost: 1500, maintenance: 50, sizeW: 1, sizeH: 1, powerUse: 5, powerGen: 0, maxLevel: 3, era: 1 },
  { id: 'gas_extractor', name: 'Gas Extractor', category: 'raw_extraction', tier: 1, produces: [{ resource: 'natural_gas', amount: 6 }], consumes: [], maxWorkers: 6, buildCost: 1200, maintenance: 40, sizeW: 1, sizeH: 1, powerUse: 5, powerGen: 0, maxLevel: 3, era: 1 },
  { id: 'logging_camp', name: 'Logging Camp', category: 'raw_extraction', tier: 1, produces: [{ resource: 'timber', amount: 10 }], consumes: [], maxWorkers: 8, buildCost: 400, maintenance: 15, sizeW: 2, sizeH: 2, powerUse: 0, powerGen: 0, maxLevel: 3, era: 0 },
  { id: 'rubber_plantation', name: 'Rubber Plantation', category: 'raw_extraction', tier: 1, produces: [{ resource: 'rubber', amount: 5 }], consumes: [], maxWorkers: 10, buildCost: 800, maintenance: 30, sizeW: 2, sizeH: 2, powerUse: 0, powerGen: 0, maxLevel: 3, era: 1 },
  { id: 'rare_earth_mine', name: 'Rare Earth Mine', category: 'raw_extraction', tier: 1, produces: [{ resource: 'rare_earth', amount: 3 }], consumes: [], maxWorkers: 15, buildCost: 2000, maintenance: 60, sizeW: 2, sizeH: 2, powerUse: 8, powerGen: 0, maxLevel: 3, era: 2 },

  // --- Tier 2: Processing (12) ---
  { id: 'food_factory', name: 'Food Factory', category: 'processing', tier: 2, produces: [{ resource: 'food', amount: 12 }], consumes: [{ resource: 'grain', amount: 6 }, { resource: 'fish', amount: 3 }, { resource: 'cattle', amount: 3 }], maxWorkers: 15, buildCost: 1500, maintenance: 50, sizeW: 2, sizeH: 2, powerUse: 10, powerGen: 0, maxLevel: 3, era: 1 },
  { id: 'sugar_mill', name: 'Sugar Mill', category: 'processing', tier: 2, produces: [{ resource: 'sugar', amount: 8 }], consumes: [{ resource: 'sugarcane', amount: 10 }], maxWorkers: 10, buildCost: 1200, maintenance: 40, sizeW: 2, sizeH: 1, powerUse: 8, powerGen: 0, maxLevel: 3, era: 1 },
  { id: 'cigar_factory', name: 'Cigar Factory', category: 'processing', tier: 2, produces: [{ resource: 'cigars', amount: 5 }], consumes: [{ resource: 'tobacco', amount: 8 }], maxWorkers: 12, buildCost: 1300, maintenance: 45, sizeW: 2, sizeH: 1, powerUse: 6, powerGen: 0, maxLevel: 3, era: 1 },
  { id: 'textile_mill', name: 'Textile Mill', category: 'processing', tier: 2, produces: [{ resource: 'textiles', amount: 8 }], consumes: [{ resource: 'cotton', amount: 10 }], maxWorkers: 12, buildCost: 1200, maintenance: 40, sizeW: 2, sizeH: 2, powerUse: 8, powerGen: 0, maxLevel: 3, era: 1 },
  { id: 'steel_mill', name: 'Steel Mill', category: 'processing', tier: 2, produces: [{ resource: 'steel', amount: 6 }], consumes: [{ resource: 'iron_ore', amount: 8 }, { resource: 'coal', amount: 4 }], maxWorkers: 18, buildCost: 2000, maintenance: 70, sizeW: 3, sizeH: 2, powerUse: 15, powerGen: 0, maxLevel: 3, era: 1 },
  { id: 'aluminum_smelter', name: 'Aluminum Smelter', category: 'processing', tier: 2, produces: [{ resource: 'aluminum', amount: 5 }], consumes: [{ resource: 'bauxite', amount: 8 }], maxWorkers: 14, buildCost: 1800, maintenance: 60, sizeW: 2, sizeH: 2, powerUse: 20, powerGen: 0, maxLevel: 3, era: 1 },
  { id: 'plastics_plant', name: 'Plastics Plant', category: 'processing', tier: 2, produces: [{ resource: 'plastics', amount: 6 }], consumes: [{ resource: 'crude_oil', amount: 5 }], maxWorkers: 10, buildCost: 1600, maintenance: 50, sizeW: 2, sizeH: 2, powerUse: 12, powerGen: 0, maxLevel: 3, era: 1 },
  { id: 'chemical_plant', name: 'Chemical Plant', category: 'processing', tier: 2, produces: [{ resource: 'chemicals', amount: 5 }], consumes: [{ resource: 'crude_oil', amount: 3 }, { resource: 'natural_gas', amount: 3 }], maxWorkers: 12, buildCost: 1800, maintenance: 55, sizeW: 2, sizeH: 2, powerUse: 14, powerGen: 0, maxLevel: 3, era: 1 },
  { id: 'refinery', name: 'Oil Refinery', category: 'processing', tier: 2, produces: [{ resource: 'fuel', amount: 8 }], consumes: [{ resource: 'crude_oil', amount: 10 }], maxWorkers: 12, buildCost: 2500, maintenance: 70, sizeW: 3, sizeH: 2, powerUse: 15, powerGen: 0, maxLevel: 3, era: 1 },
  { id: 'sawmill', name: 'Sawmill', category: 'processing', tier: 2, produces: [{ resource: 'lumber', amount: 10 }], consumes: [{ resource: 'timber', amount: 12 }], maxWorkers: 8, buildCost: 800, maintenance: 30, sizeW: 2, sizeH: 1, powerUse: 6, powerGen: 0, maxLevel: 3, era: 0 },
  { id: 'electronics_factory', name: 'Electronics Factory', category: 'processing', tier: 2, produces: [{ resource: 'electronics', amount: 4 }], consumes: [{ resource: 'rare_earth', amount: 2 }, { resource: 'plastics', amount: 3 }], maxWorkers: 16, buildCost: 2500, maintenance: 80, sizeW: 2, sizeH: 2, powerUse: 18, powerGen: 0, maxLevel: 3, era: 2 },
  { id: 'machinery_plant', name: 'Machinery Plant', category: 'processing', tier: 2, produces: [{ resource: 'machinery', amount: 4 }], consumes: [{ resource: 'steel', amount: 4 }, { resource: 'electronics', amount: 2 }], maxWorkers: 14, buildCost: 2200, maintenance: 70, sizeW: 2, sizeH: 2, powerUse: 16, powerGen: 0, maxLevel: 3, era: 2 },

  // --- Tier 3: Advanced (6) ---
  { id: 'arms_factory', name: 'Arms Factory', category: 'advanced', tier: 3, produces: [{ resource: 'weapons', amount: 3 }], consumes: [{ resource: 'steel', amount: 4 }, { resource: 'chemicals', amount: 2 }], maxWorkers: 20, buildCost: 3000, maintenance: 100, sizeW: 3, sizeH: 2, powerUse: 20, powerGen: 0, maxLevel: 3, era: 2 },
  { id: 'vehicle_factory', name: 'Vehicle Factory', category: 'advanced', tier: 3, produces: [{ resource: 'vehicles', amount: 2 }], consumes: [{ resource: 'steel', amount: 3 }, { resource: 'rubber', amount: 2 }, { resource: 'electronics', amount: 2 }], maxWorkers: 25, buildCost: 4000, maintenance: 120, sizeW: 3, sizeH: 3, powerUse: 25, powerGen: 0, maxLevel: 3, era: 2 },
  { id: 'pharma_lab', name: 'Pharmaceutical Lab', category: 'advanced', tier: 3, produces: [{ resource: 'pharmaceuticals', amount: 3 }], consumes: [{ resource: 'chemicals', amount: 3 }, { resource: 'rare_earth', amount: 1 }], maxWorkers: 15, buildCost: 3500, maintenance: 90, sizeW: 2, sizeH: 2, powerUse: 18, powerGen: 0, maxLevel: 3, era: 3 },
  { id: 'luxury_workshop', name: 'Luxury Workshop', category: 'advanced', tier: 3, produces: [{ resource: 'luxury_goods', amount: 2 }], consumes: [{ resource: 'textiles', amount: 3 }, { resource: 'sugar', amount: 2 }], maxWorkers: 12, buildCost: 3000, maintenance: 80, sizeW: 2, sizeH: 2, powerUse: 10, powerGen: 0, maxLevel: 3, era: 2 },
  { id: 'semiconductor_fab', name: 'Semiconductor Fab', category: 'advanced', tier: 3, produces: [{ resource: 'semiconductors', amount: 2 }], consumes: [{ resource: 'rare_earth', amount: 3 }, { resource: 'chemicals', amount: 2 }], maxWorkers: 20, buildCost: 5000, maintenance: 150, sizeW: 3, sizeH: 2, powerUse: 30, powerGen: 0, maxLevel: 3, era: 3 },
  { id: 'aerospace_complex', name: 'Aerospace Complex', category: 'advanced', tier: 3, produces: [{ resource: 'aerospace', amount: 1 }], consumes: [{ resource: 'aluminum', amount: 3 }, { resource: 'electronics', amount: 3 }, { resource: 'machinery', amount: 2 }], maxWorkers: 30, buildCost: 8000, maintenance: 200, sizeW: 4, sizeH: 3, powerUse: 40, powerGen: 0, maxLevel: 3, era: 4 },

  // --- Service (5) ---
  { id: 'clinic', name: 'Clinic', category: 'service', tier: 1, produces: [], consumes: [{ resource: 'pharmaceuticals', amount: 1 }], maxWorkers: 6, buildCost: 800, maintenance: 30, sizeW: 1, sizeH: 1, powerUse: 3, powerGen: 0, maxLevel: 3, era: 0 },
  { id: 'school', name: 'School', category: 'service', tier: 1, produces: [], consumes: [], maxWorkers: 8, buildCost: 600, maintenance: 25, sizeW: 2, sizeH: 1, powerUse: 3, powerGen: 0, maxLevel: 3, era: 0 },
  { id: 'university', name: 'University', category: 'service', tier: 2, produces: [], consumes: [], maxWorkers: 15, buildCost: 2000, maintenance: 70, sizeW: 3, sizeH: 2, powerUse: 10, powerGen: 0, maxLevel: 3, era: 1 },
  { id: 'market', name: 'Market', category: 'service', tier: 1, produces: [], consumes: [{ resource: 'food', amount: 2 }], maxWorkers: 6, buildCost: 500, maintenance: 15, sizeW: 2, sizeH: 2, powerUse: 2, powerGen: 0, maxLevel: 3, era: 0 },
  { id: 'entertainment', name: 'Entertainment Complex', category: 'service', tier: 2, produces: [], consumes: [], maxWorkers: 12, buildCost: 1500, maintenance: 50, sizeW: 2, sizeH: 2, powerUse: 15, powerGen: 0, maxLevel: 3, era: 1 },

  // --- Infrastructure (10) ---
  { id: 'road', name: 'Road', category: 'infrastructure', tier: 1, produces: [], consumes: [], maxWorkers: 0, buildCost: 50, maintenance: 2, sizeW: 1, sizeH: 1, powerUse: 0, powerGen: 0, maxLevel: 1, era: 0 },
  { id: 'housing', name: 'Housing', category: 'infrastructure', tier: 1, produces: [], consumes: [], maxWorkers: 0, buildCost: 300, maintenance: 10, sizeW: 1, sizeH: 1, powerUse: 1, powerGen: 0, maxLevel: 3, era: 0 },
  { id: 'apartment', name: 'Apartment Block', category: 'infrastructure', tier: 2, produces: [], consumes: [], maxWorkers: 0, buildCost: 1000, maintenance: 30, sizeW: 1, sizeH: 1, powerUse: 5, powerGen: 0, maxLevel: 3, era: 1 },
  { id: 'coal_power', name: 'Coal Power Plant', category: 'infrastructure', tier: 1, produces: [], consumes: [{ resource: 'coal', amount: 5 }], maxWorkers: 8, buildCost: 1500, maintenance: 50, sizeW: 2, sizeH: 2, powerUse: 0, powerGen: 50, maxLevel: 3, era: 0 },
  { id: 'gas_power', name: 'Gas Power Plant', category: 'infrastructure', tier: 2, produces: [], consumes: [{ resource: 'natural_gas', amount: 4 }], maxWorkers: 6, buildCost: 2000, maintenance: 60, sizeW: 2, sizeH: 2, powerUse: 0, powerGen: 80, maxLevel: 3, era: 1 },
  { id: 'oil_power', name: 'Oil Power Plant', category: 'infrastructure', tier: 2, produces: [], consumes: [{ resource: 'fuel', amount: 3 }], maxWorkers: 6, buildCost: 2500, maintenance: 70, sizeW: 2, sizeH: 2, powerUse: 0, powerGen: 100, maxLevel: 3, era: 1 },
  { id: 'nuclear_power', name: 'Nuclear Power Plant', category: 'infrastructure', tier: 3, produces: [], consumes: [], maxWorkers: 20, buildCost: 8000, maintenance: 200, sizeW: 3, sizeH: 3, powerUse: 0, powerGen: 300, maxLevel: 3, era: 3 },
  { id: 'port', name: 'Port', category: 'infrastructure', tier: 1, produces: [], consumes: [], maxWorkers: 12, buildCost: 2000, maintenance: 50, sizeW: 3, sizeH: 2, powerUse: 5, powerGen: 0, maxLevel: 3, era: 0 },
  { id: 'warehouse', name: 'Warehouse', category: 'infrastructure', tier: 1, produces: [], consumes: [], maxWorkers: 4, buildCost: 500, maintenance: 10, sizeW: 2, sizeH: 1, powerUse: 1, powerGen: 0, maxLevel: 3, era: 0 },
  { id: 'airport', name: 'Airport', category: 'infrastructure', tier: 3, produces: [], consumes: [{ resource: 'fuel', amount: 5 }], maxWorkers: 25, buildCost: 5000, maintenance: 150, sizeW: 4, sizeH: 3, powerUse: 20, powerGen: 0, maxLevel: 3, era: 2 },

  // --- Military (3) ---
  { id: 'barracks', name: 'Barracks', category: 'military', tier: 1, produces: [], consumes: [{ resource: 'food', amount: 3 }], maxWorkers: 20, buildCost: 1000, maintenance: 40, sizeW: 2, sizeH: 2, powerUse: 3, powerGen: 0, maxLevel: 3, era: 0 },
  { id: 'weapons_depot', name: 'Weapons Depot', category: 'military', tier: 2, produces: [], consumes: [{ resource: 'weapons', amount: 1 }], maxWorkers: 8, buildCost: 1500, maintenance: 50, sizeW: 2, sizeH: 2, powerUse: 5, powerGen: 0, maxLevel: 3, era: 1 },
  { id: 'military_base', name: 'Military Base', category: 'military', tier: 3, produces: [], consumes: [{ resource: 'weapons', amount: 2 }, { resource: 'vehicles', amount: 1 }, { resource: 'fuel', amount: 3 }], maxWorkers: 30, buildCost: 5000, maintenance: 150, sizeW: 4, sizeH: 3, powerUse: 15, powerGen: 0, maxLevel: 3, era: 2 },

  // --- Government (2) ---
  { id: 'town_hall', name: 'Town Hall', category: 'government', tier: 1, produces: [], consumes: [], maxWorkers: 10, buildCost: 1000, maintenance: 30, sizeW: 2, sizeH: 2, powerUse: 3, powerGen: 0, maxLevel: 3, era: 0 },
  { id: 'capitol', name: 'Capitol Building', category: 'government', tier: 3, produces: [], consumes: [], maxWorkers: 20, buildCost: 5000, maintenance: 100, sizeW: 3, sizeH: 3, powerUse: 10, powerGen: 0, maxLevel: 3, era: 2 },
];

/** 건물 ID → 정의 맵 (빠른 조회) */
export const BUILDING_DEF_MAP: Record<string, ClientBuildingDef> = {};
for (const def of CLIENT_BUILDING_DEFS) {
  BUILDING_DEF_MAP[def.id] = def;
}

/** 카테고리별 건물 필터 */
export function getBuildingsByCategory(category: string): ClientBuildingDef[] {
  if (category === 'all') return CLIENT_BUILDING_DEFS;
  return CLIENT_BUILDING_DEFS.filter(d => d.category === category);
}
