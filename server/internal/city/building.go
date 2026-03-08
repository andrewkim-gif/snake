package city

import (
	"fmt"
	"sync/atomic"
)

// buildingIDCounter generates unique building IDs.
var buildingIDCounter uint64

func nextBuildingID() string {
	id := atomic.AddUint64(&buildingIDCounter, 1)
	return fmt.Sprintf("bld_%d", id)
}

// BuildingCategory groups buildings by function.
type BuildingCategory string

const (
	CatRawExtraction BuildingCategory = "raw_extraction"  // Tier 1
	CatProcessing    BuildingCategory = "processing"       // Tier 2
	CatAdvanced      BuildingCategory = "advanced"         // Tier 3
	CatService       BuildingCategory = "service"
	CatInfrastructure BuildingCategory = "infrastructure"
	CatMilitary      BuildingCategory = "military"
	CatGovernment    BuildingCategory = "government"
)

// ResourceIO defines a resource input or output for a building.
type ResourceIO struct {
	Resource ResourceType
	Amount   float64 // per tick
}

// BuildingDef is the static definition of a building type.
type BuildingDef struct {
	ID          string           // unique type id, e.g. "farm"
	Name        string           // display name
	Category    BuildingCategory
	Tier        int              // 1, 2, or 3
	Produces    []ResourceIO     // outputs per tick
	Consumes    []ResourceIO     // inputs per tick
	MaxWorkers  int              // max employees
	BuildCost   float64          // treasury cost to build
	Maintenance float64          // treasury cost per tick
	SizeW       int              // tile width
	SizeH       int              // tile height
	PowerUse    float64          // electricity consumption
	PowerGen    float64          // electricity generation (power plants only)
	MaxLevel    int              // max upgrade level (1-3)
	Era         int              // era required (0=always, 1-4)
}

// Building is a placed building instance in a city.
type Building struct {
	ID         string  `json:"id"`
	DefID      string  `json:"defId"`
	TileX      int     `json:"tileX"`
	TileY      int     `json:"tileY"`
	Level      int     `json:"level"`
	Workers    int     `json:"workers"`
	Efficiency float64 `json:"efficiency"` // 0.0 - 1.0
	Powered    bool    `json:"powered"`
	Enabled    bool    `json:"enabled"`
	UnderConstruction bool `json:"underConstruction"`
	ConstructionLeft  int  `json:"constructionLeft"` // ticks remaining
}

// NewBuilding creates a new building instance from a definition.
func NewBuilding(defID string, tileX, tileY int) *Building {
	return &Building{
		ID:         nextBuildingID(),
		DefID:      defID,
		TileX:      tileX,
		TileY:      tileY,
		Level:      1,
		Workers:    0,
		Efficiency: 0.0,
		Powered:    false,
		Enabled:    true,
		UnderConstruction: true,
		ConstructionLeft:  3, // 3 ticks = 30 seconds
	}
}

// PLACEHOLDER_BUILDING_REGISTRY will be replaced with actual data
var BuildingRegistry map[string]*BuildingDef

func init() {
	BuildingRegistry = make(map[string]*BuildingDef, 58)
	registerAllBuildings()
}

func registerAllBuildings() {
	// --- Tier 1: Raw Extraction (15 buildings) ---
	registerBuilding(&BuildingDef{
		ID: "farm", Name: "Farm", Category: CatRawExtraction, Tier: 1,
		Produces: []ResourceIO{{ResGrain, 10}},
		MaxWorkers: 8, BuildCost: 500, Maintenance: 20, SizeW: 2, SizeH: 2,
		PowerUse: 0, MaxLevel: 3, Era: 0,
	})
	registerBuilding(&BuildingDef{
		ID: "sugar_plantation", Name: "Sugar Plantation", Category: CatRawExtraction, Tier: 1,
		Produces: []ResourceIO{{ResSugarcane, 8}},
		MaxWorkers: 10, BuildCost: 600, Maintenance: 25, SizeW: 2, SizeH: 2,
		PowerUse: 0, MaxLevel: 3, Era: 0,
	})
	registerBuilding(&BuildingDef{
		ID: "tobacco_plantation", Name: "Tobacco Plantation", Category: CatRawExtraction, Tier: 1,
		Produces: []ResourceIO{{ResTobacco, 6}},
		MaxWorkers: 10, BuildCost: 700, Maintenance: 30, SizeW: 2, SizeH: 2,
		PowerUse: 0, MaxLevel: 3, Era: 0,
	})
	registerBuilding(&BuildingDef{
		ID: "cotton_plantation", Name: "Cotton Plantation", Category: CatRawExtraction, Tier: 1,
		Produces: []ResourceIO{{ResCotton, 8}},
		MaxWorkers: 10, BuildCost: 600, Maintenance: 25, SizeW: 2, SizeH: 2,
		PowerUse: 0, MaxLevel: 3, Era: 0,
	})
	registerBuilding(&BuildingDef{
		ID: "coffee_plantation", Name: "Coffee Plantation", Category: CatRawExtraction, Tier: 1,
		Produces: []ResourceIO{{ResCoffee, 5}},
		MaxWorkers: 8, BuildCost: 800, Maintenance: 30, SizeW: 2, SizeH: 2,
		PowerUse: 0, MaxLevel: 3, Era: 0,
	})
	registerBuilding(&BuildingDef{
		ID: "fishing_wharf", Name: "Fishing Wharf", Category: CatRawExtraction, Tier: 1,
		Produces: []ResourceIO{{ResFish, 8}},
		MaxWorkers: 6, BuildCost: 400, Maintenance: 15, SizeW: 2, SizeH: 1,
		PowerUse: 0, MaxLevel: 3, Era: 0,
	})
	registerBuilding(&BuildingDef{
		ID: "ranch", Name: "Ranch", Category: CatRawExtraction, Tier: 1,
		Produces: []ResourceIO{{ResCattle, 6}},
		MaxWorkers: 6, BuildCost: 700, Maintenance: 25, SizeW: 3, SizeH: 2,
		PowerUse: 0, MaxLevel: 3, Era: 0,
	})
	registerBuilding(&BuildingDef{
		ID: "iron_mine", Name: "Iron Mine", Category: CatRawExtraction, Tier: 1,
		Produces: []ResourceIO{{ResIronOre, 8}},
		MaxWorkers: 12, BuildCost: 1000, Maintenance: 40, SizeW: 2, SizeH: 2,
		PowerUse: 5, MaxLevel: 3, Era: 0,
	})
	registerBuilding(&BuildingDef{
		ID: "bauxite_mine", Name: "Bauxite Mine", Category: CatRawExtraction, Tier: 1,
		Produces: []ResourceIO{{ResBauxite, 6}},
		MaxWorkers: 12, BuildCost: 1100, Maintenance: 45, SizeW: 2, SizeH: 2,
		PowerUse: 5, MaxLevel: 3, Era: 1,
	})
	registerBuilding(&BuildingDef{
		ID: "coal_mine", Name: "Coal Mine", Category: CatRawExtraction, Tier: 1,
		Produces: []ResourceIO{{ResCoal, 10}},
		MaxWorkers: 14, BuildCost: 900, Maintenance: 35, SizeW: 2, SizeH: 2,
		PowerUse: 3, MaxLevel: 3, Era: 0,
	})
	registerBuilding(&BuildingDef{
		ID: "oil_well", Name: "Oil Well", Category: CatRawExtraction, Tier: 1,
		Produces: []ResourceIO{{ResCrudeOil, 8}},
		MaxWorkers: 8, BuildCost: 1500, Maintenance: 50, SizeW: 1, SizeH: 1,
		PowerUse: 5, MaxLevel: 3, Era: 1,
	})
	registerBuilding(&BuildingDef{
		ID: "gas_extractor", Name: "Gas Extractor", Category: CatRawExtraction, Tier: 1,
		Produces: []ResourceIO{{ResNaturalGas, 6}},
		MaxWorkers: 6, BuildCost: 1200, Maintenance: 40, SizeW: 1, SizeH: 1,
		PowerUse: 5, MaxLevel: 3, Era: 1,
	})
	registerBuilding(&BuildingDef{
		ID: "logging_camp", Name: "Logging Camp", Category: CatRawExtraction, Tier: 1,
		Produces: []ResourceIO{{ResTimber, 10}},
		MaxWorkers: 8, BuildCost: 400, Maintenance: 15, SizeW: 2, SizeH: 2,
		PowerUse: 0, MaxLevel: 3, Era: 0,
	})
	registerBuilding(&BuildingDef{
		ID: "rubber_plantation", Name: "Rubber Plantation", Category: CatRawExtraction, Tier: 1,
		Produces: []ResourceIO{{ResRubber, 5}},
		MaxWorkers: 10, BuildCost: 800, Maintenance: 30, SizeW: 2, SizeH: 2,
		PowerUse: 0, MaxLevel: 3, Era: 1,
	})
	registerBuilding(&BuildingDef{
		ID: "rare_earth_mine", Name: "Rare Earth Mine", Category: CatRawExtraction, Tier: 1,
		Produces: []ResourceIO{{ResRareEarth, 3}},
		MaxWorkers: 15, BuildCost: 2000, Maintenance: 60, SizeW: 2, SizeH: 2,
		PowerUse: 8, MaxLevel: 3, Era: 2,
	})

	// --- Tier 2: Processing (12 buildings) ---
	registerBuilding(&BuildingDef{
		ID: "food_factory", Name: "Food Factory", Category: CatProcessing, Tier: 2,
		Produces: []ResourceIO{{ResFood, 12}},
		Consumes: []ResourceIO{{ResGrain, 6}, {ResFish, 3}, {ResCattle, 3}},
		MaxWorkers: 15, BuildCost: 1500, Maintenance: 50, SizeW: 2, SizeH: 2,
		PowerUse: 10, MaxLevel: 3, Era: 1,
	})
	registerBuilding(&BuildingDef{
		ID: "sugar_mill", Name: "Sugar Mill", Category: CatProcessing, Tier: 2,
		Produces: []ResourceIO{{ResSugar, 8}},
		Consumes: []ResourceIO{{ResSugarcane, 10}},
		MaxWorkers: 10, BuildCost: 1200, Maintenance: 40, SizeW: 2, SizeH: 1,
		PowerUse: 8, MaxLevel: 3, Era: 1,
	})
	registerBuilding(&BuildingDef{
		ID: "cigar_factory", Name: "Cigar Factory", Category: CatProcessing, Tier: 2,
		Produces: []ResourceIO{{ResCigars, 5}},
		Consumes: []ResourceIO{{ResTobacco, 8}},
		MaxWorkers: 12, BuildCost: 1300, Maintenance: 45, SizeW: 2, SizeH: 1,
		PowerUse: 6, MaxLevel: 3, Era: 1,
	})
	registerBuilding(&BuildingDef{
		ID: "textile_mill", Name: "Textile Mill", Category: CatProcessing, Tier: 2,
		Produces: []ResourceIO{{ResTextiles, 8}},
		Consumes: []ResourceIO{{ResCotton, 10}},
		MaxWorkers: 14, BuildCost: 1400, Maintenance: 45, SizeW: 2, SizeH: 2,
		PowerUse: 8, MaxLevel: 3, Era: 1,
	})
	registerBuilding(&BuildingDef{
		ID: "steel_mill", Name: "Steel Mill", Category: CatProcessing, Tier: 2,
		Produces: []ResourceIO{{ResSteel, 6}},
		Consumes: []ResourceIO{{ResIronOre, 8}, {ResCoal, 4}},
		MaxWorkers: 18, BuildCost: 2000, Maintenance: 60, SizeW: 3, SizeH: 2,
		PowerUse: 15, MaxLevel: 3, Era: 1,
	})
	registerBuilding(&BuildingDef{
		ID: "aluminum_smelter", Name: "Aluminum Smelter", Category: CatProcessing, Tier: 2,
		Produces: []ResourceIO{{ResAluminum, 5}},
		Consumes: []ResourceIO{{ResBauxite, 8}},
		MaxWorkers: 12, BuildCost: 1800, Maintenance: 55, SizeW: 2, SizeH: 2,
		PowerUse: 20, MaxLevel: 3, Era: 1,
	})
	registerBuilding(&BuildingDef{
		ID: "plastics_plant", Name: "Plastics Plant", Category: CatProcessing, Tier: 2,
		Produces: []ResourceIO{{ResPlastics, 8}},
		Consumes: []ResourceIO{{ResCrudeOil, 6}},
		MaxWorkers: 10, BuildCost: 1600, Maintenance: 50, SizeW: 2, SizeH: 2,
		PowerUse: 12, MaxLevel: 3, Era: 2,
	})
	registerBuilding(&BuildingDef{
		ID: "chemical_plant", Name: "Chemical Plant", Category: CatProcessing, Tier: 2,
		Produces: []ResourceIO{{ResChemicals, 6}},
		Consumes: []ResourceIO{{ResCrudeOil, 4}, {ResNaturalGas, 3}},
		MaxWorkers: 12, BuildCost: 1800, Maintenance: 55, SizeW: 2, SizeH: 2,
		PowerUse: 12, MaxLevel: 3, Era: 2,
	})
	registerBuilding(&BuildingDef{
		ID: "oil_refinery", Name: "Oil Refinery", Category: CatProcessing, Tier: 2,
		Produces: []ResourceIO{{ResFuel, 8}},
		Consumes: []ResourceIO{{ResCrudeOil, 10}},
		MaxWorkers: 14, BuildCost: 2500, Maintenance: 70, SizeW: 3, SizeH: 2,
		PowerUse: 15, MaxLevel: 3, Era: 1,
	})
	registerBuilding(&BuildingDef{
		ID: "sawmill", Name: "Sawmill", Category: CatProcessing, Tier: 2,
		Produces: []ResourceIO{{ResLumber, 10}},
		Consumes: []ResourceIO{{ResTimber, 12}},
		MaxWorkers: 8, BuildCost: 800, Maintenance: 30, SizeW: 2, SizeH: 1,
		PowerUse: 6, MaxLevel: 3, Era: 0,
	})
	registerBuilding(&BuildingDef{
		ID: "electronics_factory", Name: "Electronics Factory", Category: CatProcessing, Tier: 2,
		Produces: []ResourceIO{{ResElectronics, 5}},
		Consumes: []ResourceIO{{ResRareEarth, 3}, {ResPlastics, 2}},
		MaxWorkers: 16, BuildCost: 3000, Maintenance: 80, SizeW: 2, SizeH: 2,
		PowerUse: 18, MaxLevel: 3, Era: 2,
	})
	registerBuilding(&BuildingDef{
		ID: "machinery_plant", Name: "Machinery Plant", Category: CatProcessing, Tier: 2,
		Produces: []ResourceIO{{ResMachinery, 4}},
		Consumes: []ResourceIO{{ResSteel, 4}, {ResElectronics, 2}},
		MaxWorkers: 14, BuildCost: 2500, Maintenance: 65, SizeW: 2, SizeH: 2,
		PowerUse: 15, MaxLevel: 3, Era: 2,
	})

	// --- Tier 3: Advanced Manufacturing (6 buildings) ---
	registerBuilding(&BuildingDef{
		ID: "weapons_factory", Name: "Weapons Factory", Category: CatAdvanced, Tier: 3,
		Produces: []ResourceIO{{ResWeapons, 3}},
		Consumes: []ResourceIO{{ResSteel, 4}, {ResChemicals, 2}, {ResElectronics, 1}},
		MaxWorkers: 20, BuildCost: 5000, Maintenance: 100, SizeW: 3, SizeH: 2,
		PowerUse: 20, MaxLevel: 3, Era: 2,
	})
	registerBuilding(&BuildingDef{
		ID: "vehicle_factory", Name: "Vehicle Factory", Category: CatAdvanced, Tier: 3,
		Produces: []ResourceIO{{ResVehicles, 3}},
		Consumes: []ResourceIO{{ResSteel, 3}, {ResRubber, 2}, {ResElectronics, 2}},
		MaxWorkers: 22, BuildCost: 5500, Maintenance: 110, SizeW: 3, SizeH: 3,
		PowerUse: 22, MaxLevel: 3, Era: 2,
	})
	registerBuilding(&BuildingDef{
		ID: "pharma_lab", Name: "Pharmaceutical Lab", Category: CatAdvanced, Tier: 3,
		Produces: []ResourceIO{{ResPharmaceuticals, 3}},
		Consumes: []ResourceIO{{ResChemicals, 4}, {ResRareEarth, 1}},
		MaxWorkers: 15, BuildCost: 6000, Maintenance: 120, SizeW: 2, SizeH: 2,
		PowerUse: 15, MaxLevel: 3, Era: 3,
	})
	registerBuilding(&BuildingDef{
		ID: "luxury_workshop", Name: "Luxury Workshop", Category: CatAdvanced, Tier: 3,
		Produces: []ResourceIO{{ResLuxuryGoods, 2}},
		Consumes: []ResourceIO{{ResTextiles, 3}, {ResSugar, 2}, {ResCigars, 1}},
		MaxWorkers: 12, BuildCost: 4500, Maintenance: 90, SizeW: 2, SizeH: 2,
		PowerUse: 10, MaxLevel: 3, Era: 2,
	})
	registerBuilding(&BuildingDef{
		ID: "semiconductor_fab", Name: "Semiconductor Fab", Category: CatAdvanced, Tier: 3,
		Produces: []ResourceIO{{ResSemiconductors, 2}},
		Consumes: []ResourceIO{{ResRareEarth, 3}, {ResChemicals, 2}, {ResElectronics, 3}},
		MaxWorkers: 20, BuildCost: 8000, Maintenance: 150, SizeW: 3, SizeH: 2,
		PowerUse: 30, MaxLevel: 3, Era: 3,
	})
	registerBuilding(&BuildingDef{
		ID: "aerospace_plant", Name: "Aerospace Plant", Category: CatAdvanced, Tier: 3,
		Produces: []ResourceIO{{ResAerospace, 1}},
		Consumes: []ResourceIO{{ResAluminum, 3}, {ResElectronics, 3}, {ResSemiconductors, 1}},
		MaxWorkers: 25, BuildCost: 10000, Maintenance: 180, SizeW: 4, SizeH: 3,
		PowerUse: 35, MaxLevel: 3, Era: 3,
	})

	// --- Service Buildings (10) ---
	registerBuilding(&BuildingDef{
		ID: "marketplace", Name: "Marketplace", Category: CatService, Tier: 1,
		MaxWorkers: 5, BuildCost: 300, Maintenance: 10, SizeW: 1, SizeH: 1,
		PowerUse: 0, MaxLevel: 3, Era: 0,
	})
	registerBuilding(&BuildingDef{
		ID: "clinic", Name: "Clinic", Category: CatService, Tier: 1,
		MaxWorkers: 6, BuildCost: 800, Maintenance: 30, SizeW: 1, SizeH: 1,
		PowerUse: 5, MaxLevel: 3, Era: 0,
	})
	registerBuilding(&BuildingDef{
		ID: "hospital", Name: "Hospital", Category: CatService, Tier: 2,
		MaxWorkers: 20, BuildCost: 3000, Maintenance: 80, SizeW: 2, SizeH: 2,
		PowerUse: 15, MaxLevel: 3, Era: 1,
	})
	registerBuilding(&BuildingDef{
		ID: "school", Name: "School", Category: CatService, Tier: 1,
		MaxWorkers: 8, BuildCost: 600, Maintenance: 25, SizeW: 2, SizeH: 1,
		PowerUse: 3, MaxLevel: 3, Era: 0,
	})
	registerBuilding(&BuildingDef{
		ID: "university", Name: "University", Category: CatService, Tier: 2,
		MaxWorkers: 15, BuildCost: 4000, Maintenance: 100, SizeW: 3, SizeH: 2,
		PowerUse: 10, MaxLevel: 3, Era: 2,
	})
	registerBuilding(&BuildingDef{
		ID: "church", Name: "Church", Category: CatService, Tier: 1,
		MaxWorkers: 3, BuildCost: 500, Maintenance: 15, SizeW: 1, SizeH: 1,
		PowerUse: 0, MaxLevel: 3, Era: 0,
	})
	registerBuilding(&BuildingDef{
		ID: "tavern", Name: "Tavern", Category: CatService, Tier: 1,
		MaxWorkers: 4, BuildCost: 400, Maintenance: 15, SizeW: 1, SizeH: 1,
		PowerUse: 2, MaxLevel: 3, Era: 0,
	})
	registerBuilding(&BuildingDef{
		ID: "entertainment_complex", Name: "Entertainment Complex", Category: CatService, Tier: 2,
		MaxWorkers: 12, BuildCost: 2500, Maintenance: 60, SizeW: 2, SizeH: 2,
		PowerUse: 12, MaxLevel: 3, Era: 2,
	})
	registerBuilding(&BuildingDef{
		ID: "police_station", Name: "Police Station", Category: CatService, Tier: 1,
		MaxWorkers: 10, BuildCost: 1000, Maintenance: 35, SizeW: 1, SizeH: 1,
		PowerUse: 5, MaxLevel: 3, Era: 1,
	})
	registerBuilding(&BuildingDef{
		ID: "fire_station", Name: "Fire Station", Category: CatService, Tier: 1,
		MaxWorkers: 8, BuildCost: 800, Maintenance: 30, SizeW: 1, SizeH: 1,
		PowerUse: 5, MaxLevel: 3, Era: 1,
	})

	// --- Infrastructure Buildings (9) ---
	registerBuilding(&BuildingDef{
		ID: "coal_power_plant", Name: "Coal Power Plant", Category: CatInfrastructure, Tier: 1,
		Consumes: []ResourceIO{{ResCoal, 5}},
		MaxWorkers: 10, BuildCost: 2000, Maintenance: 50, SizeW: 2, SizeH: 2,
		PowerUse: 0, PowerGen: 100, MaxLevel: 3, Era: 1,
	})
	registerBuilding(&BuildingDef{
		ID: "oil_power_plant", Name: "Oil Power Plant", Category: CatInfrastructure, Tier: 2,
		Consumes: []ResourceIO{{ResFuel, 4}},
		MaxWorkers: 8, BuildCost: 3000, Maintenance: 60, SizeW: 2, SizeH: 2,
		PowerUse: 0, PowerGen: 150, MaxLevel: 3, Era: 2,
	})
	registerBuilding(&BuildingDef{
		ID: "nuclear_plant", Name: "Nuclear Plant", Category: CatInfrastructure, Tier: 3,
		MaxWorkers: 15, BuildCost: 8000, Maintenance: 120, SizeW: 3, SizeH: 3,
		PowerUse: 0, PowerGen: 500, MaxLevel: 3, Era: 3,
	})
	registerBuilding(&BuildingDef{
		ID: "solar_farm", Name: "Solar Farm", Category: CatInfrastructure, Tier: 2,
		MaxWorkers: 3, BuildCost: 2500, Maintenance: 20, SizeW: 3, SizeH: 3,
		PowerUse: 0, PowerGen: 60, MaxLevel: 3, Era: 2,
	})
	registerBuilding(&BuildingDef{
		ID: "wind_farm", Name: "Wind Farm", Category: CatInfrastructure, Tier: 2,
		MaxWorkers: 2, BuildCost: 2000, Maintenance: 15, SizeW: 2, SizeH: 2,
		PowerUse: 0, PowerGen: 40, MaxLevel: 3, Era: 2,
	})
	registerBuilding(&BuildingDef{
		ID: "warehouse", Name: "Warehouse", Category: CatInfrastructure, Tier: 1,
		MaxWorkers: 4, BuildCost: 500, Maintenance: 15, SizeW: 2, SizeH: 1,
		PowerUse: 2, MaxLevel: 3, Era: 0,
	})
	registerBuilding(&BuildingDef{
		ID: "port", Name: "Port", Category: CatInfrastructure, Tier: 1,
		MaxWorkers: 12, BuildCost: 2000, Maintenance: 50, SizeW: 3, SizeH: 2,
		PowerUse: 5, MaxLevel: 3, Era: 0,
	})
	registerBuilding(&BuildingDef{
		ID: "airport", Name: "Airport", Category: CatInfrastructure, Tier: 2,
		MaxWorkers: 20, BuildCost: 5000, Maintenance: 100, SizeW: 4, SizeH: 3,
		PowerUse: 20, MaxLevel: 3, Era: 2,
	})
	registerBuilding(&BuildingDef{
		ID: "housing_block", Name: "Housing Block", Category: CatInfrastructure, Tier: 1,
		MaxWorkers: 0, BuildCost: 300, Maintenance: 10, SizeW: 1, SizeH: 1,
		PowerUse: 3, MaxLevel: 3, Era: 0,
	})

	// --- Military Buildings (3) ---
	registerBuilding(&BuildingDef{
		ID: "barracks", Name: "Barracks", Category: CatMilitary, Tier: 1,
		MaxWorkers: 15, BuildCost: 1500, Maintenance: 50, SizeW: 2, SizeH: 2,
		PowerUse: 5, MaxLevel: 3, Era: 0,
	})
	registerBuilding(&BuildingDef{
		ID: "armory", Name: "Armory", Category: CatMilitary, Tier: 2,
		Consumes: []ResourceIO{{ResWeapons, 2}},
		MaxWorkers: 10, BuildCost: 2500, Maintenance: 70, SizeW: 2, SizeH: 2,
		PowerUse: 8, MaxLevel: 3, Era: 1,
	})
	registerBuilding(&BuildingDef{
		ID: "naval_base", Name: "Naval Base", Category: CatMilitary, Tier: 2,
		MaxWorkers: 20, BuildCost: 5000, Maintenance: 120, SizeW: 3, SizeH: 3,
		PowerUse: 15, MaxLevel: 3, Era: 2,
	})

	// --- Government Buildings (3) ---
	registerBuilding(&BuildingDef{
		ID: "town_hall", Name: "Town Hall", Category: CatGovernment, Tier: 1,
		MaxWorkers: 5, BuildCost: 1000, Maintenance: 30, SizeW: 2, SizeH: 2,
		PowerUse: 5, MaxLevel: 3, Era: 0,
	})
	registerBuilding(&BuildingDef{
		ID: "ministry", Name: "Ministry", Category: CatGovernment, Tier: 2,
		MaxWorkers: 10, BuildCost: 3000, Maintenance: 80, SizeW: 2, SizeH: 2,
		PowerUse: 10, MaxLevel: 3, Era: 2,
	})
	registerBuilding(&BuildingDef{
		ID: "palace", Name: "Presidential Palace", Category: CatGovernment, Tier: 3,
		MaxWorkers: 15, BuildCost: 8000, Maintenance: 150, SizeW: 3, SizeH: 3,
		PowerUse: 15, MaxLevel: 3, Era: 3,
	})
}

func registerBuilding(def *BuildingDef) {
	BuildingRegistry[def.ID] = def
}

// GetBuildingDef returns a building definition by ID.
func GetBuildingDef(id string) *BuildingDef {
	return BuildingRegistry[id]
}

// GetBuildingsByCategory returns all building defs in a category.
func GetBuildingsByCategory(cat BuildingCategory) []*BuildingDef {
	var result []*BuildingDef
	for _, def := range BuildingRegistry {
		if def.Category == cat {
			result = append(result, def)
		}
	}
	return result
}

// GetBuildingsByTier returns all building defs of a specific tier.
func GetBuildingsByTier(tier int) []*BuildingDef {
	var result []*BuildingDef
	for _, def := range BuildingRegistry {
		if def.Tier == tier {
			result = append(result, def)
		}
	}
	return result
}
