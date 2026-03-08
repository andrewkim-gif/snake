package city

import "log/slog"

// ProductionEngine handles resource production and consumption for a city.
type ProductionEngine struct {
	// No internal state needed; operates on buildings and stockpile.
}

// NewProductionEngine creates a new production engine.
func NewProductionEngine() *ProductionEngine {
	return &ProductionEngine{}
}

// ComputeEfficiency calculates a building's efficiency based on:
// - Worker fill rate (workers / maxWorkers)
// - Power status
// - Building level bonus (+10% per level above 1)
// Returns a value 0.0 - 1.0+
func ComputeEfficiency(b *Building) float64 {
	def := GetBuildingDef(b.DefID)
	if def == nil || !b.Enabled || b.UnderConstruction {
		return 0.0
	}

	// Base efficiency from worker fill rate
	var workerRate float64
	if def.MaxWorkers == 0 {
		workerRate = 1.0 // buildings with no workers always run at full
	} else {
		workerRate = float64(b.Workers) / float64(def.MaxWorkers)
		if workerRate > 1.0 {
			workerRate = 1.0
		}
	}

	// Power penalty: unpowered buildings that need power run at 25% efficiency
	powerMult := 1.0
	if def.PowerUse > 0 && !b.Powered {
		powerMult = 0.25
	}

	// Level bonus: +10% per level above 1
	levelBonus := 1.0 + float64(b.Level-1)*0.10

	efficiency := workerRate * powerMult * levelBonus
	if efficiency > 1.5 {
		efficiency = 1.5 // cap at 150%
	}

	return efficiency
}

// RunProduction processes all buildings and produces resources into the stockpile.
// Returns the total production value for GDP calculation.
func (pe *ProductionEngine) RunProduction(buildings map[string]*Building, stockpile Stockpile) float64 {
	var totalValue float64

	for _, b := range buildings {
		if b.UnderConstruction || !b.Enabled {
			continue
		}

		def := GetBuildingDef(b.DefID)
		if def == nil || len(def.Produces) == 0 {
			continue
		}

		eff := b.Efficiency
		if eff <= 0 {
			continue
		}

		// Check if we can consume required inputs
		canProduce := true
		for _, input := range def.Consumes {
			required := input.Amount * eff
			if !stockpile.Has(input.Resource, required) {
				canProduce = false
				break
			}
		}

		if !canProduce {
			// Partial production: find the limiting factor
			if len(def.Consumes) > 0 {
				eff = pe.computePartialEfficiency(def, stockpile, eff)
				if eff <= 0.01 {
					continue
				}
			}
		}

		// Consume inputs
		for _, input := range def.Consumes {
			consumed := input.Amount * eff
			stockpile.Consume(input.Resource, consumed)
		}

		// Produce outputs
		for _, output := range def.Produces {
			produced := output.Amount * eff
			stockpile.Add(output.Resource, produced)

			// Track value for GDP
			if resDef, ok := ResourceDefMap[output.Resource]; ok {
				totalValue += produced * resDef.BasePrice
			}
		}
	}

	return totalValue
}

// computePartialEfficiency finds the maximum efficiency given available resources.
func (pe *ProductionEngine) computePartialEfficiency(def *BuildingDef, stockpile Stockpile, maxEff float64) float64 {
	minRate := maxEff
	for _, input := range def.Consumes {
		required := input.Amount * maxEff
		if required <= 0 {
			continue
		}
		available := stockpile.Get(input.Resource)
		rate := available / required * maxEff
		if rate < minRate {
			minRate = rate
		}
	}
	return minRate
}

// ConsumeCitizenNeeds deducts citizen consumption from stockpile.
// Citizens consume food and other goods.
// Returns the satisfaction rate (0.0 - 1.0).
func (pe *ProductionEngine) ConsumeCitizenNeeds(citizenCount int, stockpile Stockpile) float64 {
	if citizenCount <= 0 {
		return 1.0
	}

	// Each citizen consumes 0.5 food per tick
	foodNeeded := float64(citizenCount) * 0.5
	foodAvailable := stockpile.Get(ResFood)

	foodSatisfied := 1.0
	if foodAvailable < foodNeeded {
		foodSatisfied = foodAvailable / foodNeeded
		stockpile[ResFood] = 0
	} else {
		stockpile.Consume(ResFood, foodNeeded)
	}

	// Luxury consumption (optional, boosts happiness)
	luxuryNeeded := float64(citizenCount) * 0.1
	luxuryAvailable := stockpile.Get(ResLuxuryGoods)
	luxurySatisfied := 0.0
	if luxuryAvailable > 0 {
		if luxuryAvailable >= luxuryNeeded {
			luxurySatisfied = 1.0
			stockpile.Consume(ResLuxuryGoods, luxuryNeeded)
		} else {
			luxurySatisfied = luxuryAvailable / luxuryNeeded
			stockpile[ResLuxuryGoods] = 0
		}
	}

	// Overall satisfaction is weighted: 80% food + 20% luxury
	satisfaction := foodSatisfied*0.8 + luxurySatisfied*0.2

	if foodSatisfied < 0.5 {
		slog.Debug("food shortage", "citizens", citizenCount, "satisfied", foodSatisfied)
	}

	return satisfaction
}

// UpdateBuildingEfficiencies recalculates efficiency for all buildings.
func (pe *ProductionEngine) UpdateBuildingEfficiencies(buildings map[string]*Building) {
	for _, b := range buildings {
		b.Efficiency = ComputeEfficiency(b)
	}
}

// ProcessConstruction advances construction for buildings under construction.
// Returns list of newly completed building IDs.
func (pe *ProductionEngine) ProcessConstruction(buildings map[string]*Building) []string {
	var completed []string
	for _, b := range buildings {
		if !b.UnderConstruction {
			continue
		}
		b.ConstructionLeft--
		if b.ConstructionLeft <= 0 {
			b.UnderConstruction = false
			b.ConstructionLeft = 0
			completed = append(completed, b.ID)
		}
	}
	return completed
}

// ComputePowerBalance calculates total power generation vs consumption.
// Returns (generation, consumption, surplus).
func ComputePowerBalance(buildings map[string]*Building) (gen float64, use float64, surplus float64) {
	for _, b := range buildings {
		if b.UnderConstruction || !b.Enabled {
			continue
		}
		def := GetBuildingDef(b.DefID)
		if def == nil {
			continue
		}

		if def.PowerGen > 0 {
			// Power plant: generation scales with efficiency
			gen += def.PowerGen * b.Efficiency
		}
		if def.PowerUse > 0 {
			use += def.PowerUse
		}
	}
	surplus = gen - use
	return
}

// AssignPower distributes power to buildings. Prioritizes by category.
func AssignPower(buildings map[string]*Building) {
	gen, _, _ := ComputePowerBalance(buildings)

	// Mark all as unpowered first
	for _, b := range buildings {
		b.Powered = false
	}

	// Assign power in priority order
	remaining := gen
	priorities := []BuildingCategory{
		CatGovernment,
		CatMilitary,
		CatService,
		CatInfrastructure,
		CatAdvanced,
		CatProcessing,
		CatRawExtraction,
	}

	for _, cat := range priorities {
		for _, b := range buildings {
			if b.UnderConstruction || !b.Enabled {
				continue
			}
			def := GetBuildingDef(b.DefID)
			if def == nil || def.Category != cat || def.PowerUse <= 0 {
				continue
			}
			if remaining >= def.PowerUse {
				b.Powered = true
				remaining -= def.PowerUse
			}
		}
	}
}
