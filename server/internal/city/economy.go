package city

import "log/slog"

// CityEconomyStats holds the result of a single city economy tick.
type CityEconomyStats struct {
	ProductionValue float64 `json:"productionValue"`
	WagesPaid       float64 `json:"wagesPaid"`
	MaintenancePaid float64 `json:"maintenancePaid"`
	TaxCollected    float64 `json:"taxCollected"`
	TradeIncome     float64 `json:"tradeIncome"`
	TradeExpense    float64 `json:"tradeExpense"`
	GDP             float64 `json:"gdp"`
	FoodSatisfaction float64 `json:"foodSatisfaction"`
	PowerSurplus    float64 `json:"powerSurplus"`
}

// RunEconomyTick executes a full economy tick for a city.
// Order: Power → Construction → Efficiency → Production → Consumption → Wages → Maintenance → Trade → Tax → GDP
func RunEconomyTick(
	buildings map[string]*Building,
	stockpile Stockpile,
	treasury *float64,
	citizenCount int,
	tradeRoutes []*TradeRoute,
	taxRate float64,
	production *ProductionEngine,
) CityEconomyStats {
	stats := CityEconomyStats{}

	// Step 1: Assign power to buildings
	AssignPower(buildings)
	_, _, stats.PowerSurplus = ComputePowerBalance(buildings)

	// Step 2: Process construction
	completed := production.ProcessConstruction(buildings)
	if len(completed) > 0 {
		slog.Debug("buildings completed", "count", len(completed))
	}

	// Step 3: Update efficiencies based on workers and power
	production.UpdateBuildingEfficiencies(buildings)

	// Step 4: Run production chains
	stats.ProductionValue = production.RunProduction(buildings, stockpile)

	// Step 5: Citizen consumption (food, luxury)
	stats.FoodSatisfaction = production.ConsumeCitizenNeeds(citizenCount, stockpile)

	// Step 6: Pay wages (worker salary per tick)
	stats.WagesPaid = payWages(buildings, treasury)

	// Step 7: Pay building maintenance
	stats.MaintenancePaid = payMaintenance(buildings, treasury)

	// Step 8: Execute trade routes
	stats.TradeIncome, stats.TradeExpense = executeTrades(tradeRoutes, stockpile, treasury)

	// Step 9: Collect taxes
	stats.TaxCollected = collectTax(citizenCount, taxRate, treasury)

	// Step 10: Compute GDP
	stats.GDP = computeCityGDP(stats)

	return stats
}

// payWages pays wages to all employed workers.
// Base wage: 2.0 per worker per tick.
// Returns total wages paid.
func payWages(buildings map[string]*Building, treasury *float64) float64 {
	const baseWage = 2.0
	var totalWages float64

	for _, b := range buildings {
		if b.UnderConstruction || !b.Enabled || b.Workers == 0 {
			continue
		}
		wages := float64(b.Workers) * baseWage
		totalWages += wages
	}

	if *treasury >= totalWages {
		*treasury -= totalWages
	} else {
		// Partial payment — workers may become unhappy
		totalWages = *treasury
		*treasury = 0
	}

	return totalWages
}

// payMaintenance deducts maintenance costs for all active buildings.
// Returns total maintenance paid.
func payMaintenance(buildings map[string]*Building, treasury *float64) float64 {
	var totalMaintenance float64

	for _, b := range buildings {
		if b.UnderConstruction {
			continue
		}
		def := GetBuildingDef(b.DefID)
		if def == nil {
			continue
		}
		totalMaintenance += def.Maintenance
	}

	if *treasury >= totalMaintenance {
		*treasury -= totalMaintenance
	} else {
		// Cannot pay full maintenance — some buildings may degrade
		totalMaintenance = *treasury
		*treasury = 0
	}

	return totalMaintenance
}

// executeTrades processes all trade routes, buying/selling resources.
// Returns (income, expense).
func executeTrades(routes []*TradeRoute, stockpile Stockpile, treasury *float64) (float64, float64) {
	var income, expense float64

	for _, route := range routes {
		if !route.Active {
			continue
		}

		resDef, ok := ResourceDefMap[route.Resource]
		if !ok {
			continue
		}

		pricePerUnit := resDef.BasePrice * (1 + route.PriceBonus)

		if route.Direction == TradeExport {
			// Export: sell resource from stockpile
			available := stockpile.Get(route.Resource)
			qty := route.Quantity
			if qty > available {
				qty = available
			}
			if qty > 0 {
				stockpile.Consume(route.Resource, qty)
				revenue := qty * pricePerUnit
				*treasury += revenue
				income += revenue
			}
		} else {
			// Import: buy resource into stockpile
			cost := route.Quantity * pricePerUnit
			if *treasury >= cost {
				*treasury -= cost
				stockpile.Add(route.Resource, route.Quantity)
				expense += cost
			} else {
				// Partial import
				affordableQty := *treasury / pricePerUnit
				if affordableQty > 0 {
					stockpile.Add(route.Resource, affordableQty)
					expense += *treasury
					*treasury = 0
				}
			}
		}
	}

	return income, expense
}

// collectTax collects income tax from citizens.
// Tax per citizen = 5.0 * taxRate per tick (base income 5.0).
// Returns total tax collected.
func collectTax(citizenCount int, taxRate float64, treasury *float64) float64 {
	const baseIncome = 5.0
	tax := float64(citizenCount) * baseIncome * taxRate
	*treasury += tax
	return tax
}

// computeCityGDP calculates the city's GDP from tick stats.
// GDP = ProductionValue + TradeIncome - TradeExpense
func computeCityGDP(stats CityEconomyStats) float64 {
	gdp := stats.ProductionValue + stats.TradeIncome - stats.TradeExpense
	if gdp < 0 {
		gdp = 0
	}
	return gdp
}

// TradeDirection indicates whether a route is import or export.
type TradeDirection int

const (
	TradeExport TradeDirection = iota
	TradeImport
)

// TradeRoute defines a trade agreement with another country.
type TradeRoute struct {
	ID         string         `json:"id"`
	PartnerISO string         `json:"partnerIso"` // trading partner country
	Resource   ResourceType   `json:"resource"`
	Direction  TradeDirection `json:"direction"` // 0=export, 1=import
	Quantity   float64        `json:"quantity"`   // units per tick
	PriceBonus float64        `json:"priceBonus"` // bonus from diplomacy (-0.3 to +0.3)
	Active     bool           `json:"active"`
}
