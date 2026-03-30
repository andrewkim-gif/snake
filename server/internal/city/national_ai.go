package city

import (
	"log/slog"
	"math/rand"

	"github.com/andrewkim-gif/snake/server/internal/debug"
)

// NationalAI provides rule-based autonomous management for AI-controlled cities.
// When a CitySimEngine's mode is ModeAI, NationalAI.Tick() is called each FullTick
// to automatically build buildings, issue edicts, and manage the city economy.
//
// Strategy priority: Population growth > Military security > Economic growth
type NationalAI struct {
	rng *rand.Rand

	// Cooldowns to avoid spamming actions
	buildCooldown int // ticks until next build allowed
	edictCooldown int // ticks until next edict allowed
}

// NewNationalAI creates a new NationalAI with the given RNG source.
func NewNationalAI(rng *rand.Rand) *NationalAI {
	return &NationalAI{
		rng: rng,
	}
}

// Tick runs one AI decision cycle. Called from CitySimEngine.FullTick()
// when mode == ModeAI. The engine's mutex is already held by FullTick().
//
// Parameters are passed directly to avoid circular references.
func (ai *NationalAI) Tick(
	iso3 string,
	buildings map[string]*Building,
	stockpile Stockpile,
	treasury *float64,
	citizenCount int,
	happiness float64,
	militaryPower float64,
	politics *PoliticsEngine,
	tickCount uint64,
	atWar bool,
	mapSize int,
) {
	// 디버그 토글: national_ai 시스템이 비활성화되면 AI 결정 건너뜀
	if !debug.IsEnabled("national_ai") {
		return
	}

	// Decrement cooldowns
	if ai.buildCooldown > 0 {
		ai.buildCooldown--
	}
	if ai.edictCooldown > 0 {
		ai.edictCooldown--
	}

	// Phase 1: Handle emergencies
	ai.handleEmergencies(iso3, buildings, stockpile, treasury, citizenCount, happiness, politics, tickCount, atWar)

	// Phase 2: Build infrastructure
	if ai.buildCooldown == 0 {
		built := ai.decideBuild(iso3, buildings, stockpile, treasury, citizenCount, militaryPower, atWar, mapSize)
		if built {
			ai.buildCooldown = 3 // wait 3 ticks (30s) between builds
		}
	}

	// Phase 3: Issue edicts for stability
	if ai.edictCooldown == 0 && politics != nil {
		issued := ai.decideEdict(iso3, politics, *treasury, happiness, tickCount, atWar)
		if issued {
			ai.edictCooldown = 6 // wait 6 ticks (60s) between edicts
		}
	}
}

// handleEmergencies addresses critical situations.
func (ai *NationalAI) handleEmergencies(
	iso3 string,
	buildings map[string]*Building,
	stockpile Stockpile,
	treasury *float64,
	citizenCount int,
	happiness float64,
	politics *PoliticsEngine,
	tickCount uint64,
	atWar bool,
) {
	// Emergency: happiness critically low → issue food subsidies if possible
	if happiness < 30 && politics != nil {
		if !politics.IsEdictActive("food_subsidies") && *treasury >= 1000 {
			err := politics.IssueEdict("food_subsidies", *treasury, tickCount)
			if err == nil {
				slog.Debug("national_ai emergency edict",
					"iso3", iso3,
					"edict", "food_subsidies",
					"happiness", happiness,
				)
			}
		}
	}

	// Emergency: at war with no military buildings → build barracks
	if atWar {
		hasMilitary := false
		for _, b := range buildings {
			def := GetBuildingDef(b.DefID)
			if def != nil && def.Category == CatMilitary && !b.UnderConstruction {
				hasMilitary = true
				break
			}
		}
		if !hasMilitary && *treasury >= 1500 {
			ai.buildAtRandomTile(iso3, "barracks", buildings, treasury, 30) // fallback size
		}
	}
}

// decideBuild decides which building to construct next.
// Strategy: food first, then power, then services, then industry, then military.
func (ai *NationalAI) decideBuild(
	iso3 string,
	buildings map[string]*Building,
	stockpile Stockpile,
	treasury *float64,
	citizenCount int,
	militaryPower float64,
	atWar bool,
	mapSize int,
) bool {
	// Don't build if treasury is too low
	if *treasury < 500 {
		return false
	}

	// Count buildings by category
	counts := make(map[BuildingCategory]int)
	for _, b := range buildings {
		def := GetBuildingDef(b.DefID)
		if def != nil {
			counts[def.Category]++
		}
	}

	// Priority 1: Ensure food supply — need at least 1 farm per 15 citizens
	farmsNeeded := (citizenCount / 15) + 1
	farmCount := ai.countBuildingType(buildings, "farm")
	if farmCount < farmsNeeded && *treasury >= 500 {
		return ai.buildAtRandomTile(iso3, "farm", buildings, treasury, mapSize)
	}

	// Priority 2: Ensure power supply
	gen, use, _ := ComputePowerBalance(buildings)
	if gen < use+20 && *treasury >= 2000 {
		// Build coal power plant if we have no power
		return ai.buildAtRandomTile(iso3, "coal_power_plant", buildings, treasury, mapSize)
	}

	// Priority 3: Housing for population growth
	housingCount := ai.countBuildingType(buildings, "housing_block")
	housingNeeded := (citizenCount / 10) + 1
	if housingCount < housingNeeded && *treasury >= 300 {
		return ai.buildAtRandomTile(iso3, "housing_block", buildings, treasury, mapSize)
	}

	// Priority 4: Services (clinics, schools) — need coverage
	if counts[CatService] < citizenCount/20+1 && *treasury >= 600 {
		serviceOptions := []string{"clinic", "school", "marketplace"}
		pick := serviceOptions[ai.rng.Intn(len(serviceOptions))]
		return ai.buildAtRandomTile(iso3, pick, buildings, treasury, mapSize)
	}

	// Priority 5: Military (if at war or military is weak)
	if (atWar || militaryPower < 50) && counts[CatMilitary] < 2 && *treasury >= 1500 {
		return ai.buildAtRandomTile(iso3, "barracks", buildings, treasury, mapSize)
	}

	// Priority 6: Raw extraction for economy
	if counts[CatRawExtraction] < citizenCount/10+2 && *treasury >= 700 {
		rawOptions := []string{"iron_mine", "logging_camp", "coal_mine", "fishing_wharf"}
		pick := rawOptions[ai.rng.Intn(len(rawOptions))]
		def := GetBuildingDef(pick)
		if def != nil && *treasury >= def.BuildCost {
			return ai.buildAtRandomTile(iso3, pick, buildings, treasury, mapSize)
		}
	}

	// Priority 7: Processing buildings when raw materials are available
	if counts[CatProcessing] < counts[CatRawExtraction]/2 && *treasury >= 1500 {
		// Pick a processing building that has available inputs
		processingOptions := []string{"sawmill", "food_factory", "steel_mill"}
		pick := processingOptions[ai.rng.Intn(len(processingOptions))]
		def := GetBuildingDef(pick)
		if def != nil && *treasury >= def.BuildCost {
			return ai.buildAtRandomTile(iso3, pick, buildings, treasury, mapSize)
		}
	}

	return false
}

// decideEdict decides which edict to issue for stability.
func (ai *NationalAI) decideEdict(
	iso3 string,
	politics *PoliticsEngine,
	treasury float64,
	happiness float64,
	tickCount uint64,
	atWar bool,
) bool {
	// Low happiness → issue popular edicts
	if happiness < 40 {
		popularEdicts := []EdictID{"food_subsidies", "social_reform", "religious_freedom", "tax_cut"}
		for _, edictID := range popularEdicts {
			if !politics.IsEdictActive(edictID) {
				def := GetEdictDef(edictID)
				if def != nil && treasury >= def.MinTreasury {
					err := politics.IssueEdict(edictID, treasury, tickCount)
					if err == nil {
						slog.Debug("national_ai issued edict",
							"iso3", iso3,
							"edict", edictID,
							"happiness", happiness,
						)
						return true
					}
				}
			}
		}
	}

	// At war → military buildup
	if atWar && !politics.IsEdictActive("military_buildup") {
		def := GetEdictDef("military_buildup")
		if def != nil && treasury >= def.MinTreasury {
			err := politics.IssueEdict("military_buildup", treasury, tickCount)
			if err == nil {
				slog.Debug("national_ai military edict",
					"iso3", iso3,
					"edict", "military_buildup",
				)
				return true
			}
		}
	}

	// Good economy → free market for growth
	if happiness > 60 && treasury > 5000 && !politics.IsEdictActive("free_market") {
		err := politics.IssueEdict("free_market", treasury, tickCount)
		if err == nil {
			slog.Debug("national_ai growth edict",
				"iso3", iso3,
				"edict", "free_market",
			)
			return true
		}
	}

	return false
}

// ─── Helper methods ───

// countBuildingType counts completed buildings of a specific type.
func (ai *NationalAI) countBuildingType(buildings map[string]*Building, defID string) int {
	count := 0
	for _, b := range buildings {
		if b.DefID == defID && !b.UnderConstruction {
			count++
		}
	}
	return count
}

// buildAtRandomTile places a building at a random valid tile position.
// Returns true if building was placed successfully.
func (ai *NationalAI) buildAtRandomTile(
	iso3 string,
	defID string,
	buildings map[string]*Building,
	treasury *float64,
	mapSize int,
) bool {
	def := GetBuildingDef(defID)
	if def == nil {
		return false
	}

	if *treasury < def.BuildCost {
		return false
	}

	// Find a tile that doesn't overlap with existing buildings
	// Try up to 20 random positions
	maxCoord := mapSize - 4 // avoid edges
	if maxCoord < 4 {
		maxCoord = 4
	}
	for attempt := 0; attempt < 20; attempt++ {
		tileX := ai.rng.Intn(maxCoord) + 2 // avoid edges
		tileY := ai.rng.Intn(maxCoord) + 2

		if !ai.isTileOccupied(buildings, tileX, tileY, def.SizeW, def.SizeH) {
			*treasury -= def.BuildCost
			b := NewBuilding(defID, tileX, tileY)
			buildings[b.ID] = b

			slog.Debug("national_ai built",
				"iso3", iso3,
				"building", def.Name,
				"tile", [2]int{tileX, tileY},
				"treasury_remaining", *treasury,
			)
			return true
		}
	}

	return false
}

// isTileOccupied checks if a building footprint would overlap any existing building.
func (ai *NationalAI) isTileOccupied(buildings map[string]*Building, tileX, tileY, sizeW, sizeH int) bool {
	for _, b := range buildings {
		def := GetBuildingDef(b.DefID)
		if def == nil {
			continue
		}
		// Simple AABB overlap check
		if tileX < b.TileX+def.SizeW && tileX+sizeW > b.TileX &&
			tileY < b.TileY+def.SizeH && tileY+sizeH > b.TileY {
			return true
		}
	}
	return false
}
