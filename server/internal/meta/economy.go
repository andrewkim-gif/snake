package meta

import (
	"log/slog"
	"sync"
	"time"
)

// EconomyConfig holds configuration for the economic engine.
type EconomyConfig struct {
	TickInterval    time.Duration // How often economy ticks (default: 1 hour)
	TaxRateDefault  float64       // Default tax rate (0.0 - 0.5)
	TradeOpenDefault float64      // Default trade openness (0.0 - 1.0)
	ResourceCap     int64         // Max resource storage per type
}

// DefaultEconomyConfig returns default economy configuration.
func DefaultEconomyConfig() EconomyConfig {
	return EconomyConfig{
		TickInterval:    time.Hour,
		TaxRateDefault:  0.10,
		TradeOpenDefault: 0.50,
		ResourceCap:     1000000,
	}
}

// CountryEconomy holds the economic state of a country.
type CountryEconomy struct {
	CountryISO    string         `json:"country_iso"`
	GDP           int64          `json:"gdp"`
	TaxRate       float64        `json:"tax_rate"`
	TradeOpenness float64        `json:"trade_openness"`
	MilitarySpend float64        `json:"military_spend"`
	TechInvest    float64        `json:"tech_invest"`
	Production    ResourceBundle `json:"production"` // Per-tick production
	LastTickAt    time.Time      `json:"last_tick_at"`
}

// EconomyEngine manages the global economy simulation.
// Runs a background tick every hour to compute resource production,
// trade, GDP, and distribute wealth to factions.
type EconomyEngine struct {
	mu sync.RWMutex

	config     EconomyConfig
	economies  map[string]*CountryEconomy // countryISO → economy state
	marketPrices map[string]float64       // resource type → gold price
}

// NewEconomyEngine creates a new economy engine.
func NewEconomyEngine(cfg EconomyConfig) *EconomyEngine {
	return &EconomyEngine{
		config:    cfg,
		economies: make(map[string]*CountryEconomy),
		marketPrices: map[string]float64{
			"oil":      10.0,
			"minerals": 8.0,
			"food":     5.0,
			"tech":     15.0,
			"manpower": 3.0,
		},
	}
}

// InitializeCountry sets up the economy for a country based on its resource profile.
func (ee *EconomyEngine) InitializeCountry(iso3 string, baseOil, baseMinerals, baseFood, baseTech, baseManpower int) {
	ee.mu.Lock()
	defer ee.mu.Unlock()

	ee.economies[iso3] = &CountryEconomy{
		CountryISO:    iso3,
		GDP:           0,
		TaxRate:       ee.config.TaxRateDefault,
		TradeOpenness: ee.config.TradeOpenDefault,
		MilitarySpend: 0.20,
		TechInvest:    0.10,
		Production: ResourceBundle{
			Oil:      int64(baseOil),
			Minerals: int64(baseMinerals),
			Food:     int64(baseFood),
			Tech:     int64(baseTech),
		},
		LastTickAt: time.Now(),
	}
}

// GetEconomy returns the economy state for a country.
func (ee *EconomyEngine) GetEconomy(iso3 string) *CountryEconomy {
	ee.mu.RLock()
	defer ee.mu.RUnlock()
	return ee.economies[iso3]
}

// GetMarketPrices returns current resource market prices.
func (ee *EconomyEngine) GetMarketPrices() map[string]float64 {
	ee.mu.RLock()
	defer ee.mu.RUnlock()

	prices := make(map[string]float64, len(ee.marketPrices))
	for k, v := range ee.marketPrices {
		prices[k] = v
	}
	return prices
}

// SetPolicy updates economic policy for a country.
func (ee *EconomyEngine) SetPolicy(iso3 string, taxRate, tradeOpenness, militarySpend, techInvest float64) error {
	ee.mu.Lock()
	defer ee.mu.Unlock()

	econ, ok := ee.economies[iso3]
	if !ok {
		return nil // Country not initialized yet
	}

	// Clamp values
	econ.TaxRate = clamp(taxRate, 0, 0.50)
	econ.TradeOpenness = clamp(tradeOpenness, 0, 1.0)
	econ.MilitarySpend = clamp(militarySpend, 0, 0.50)
	econ.TechInvest = clamp(techInvest, 0, 0.30)

	return nil
}

// Tick processes one economy cycle for all countries.
// Called by the background worker every hour.
func (ee *EconomyEngine) Tick() {
	ee.mu.Lock()
	defer ee.mu.Unlock()

	for iso, econ := range ee.economies {
		// Calculate GDP based on production and trade
		totalProduction := econ.Production.Oil + econ.Production.Minerals +
			econ.Production.Food + econ.Production.Tech

		// GDP = production * trade_openness * (1 + tech_invest)
		gdp := float64(totalProduction) * (0.5 + econ.TradeOpenness*0.5) * (1 + econ.TechInvest)
		econ.GDP = int64(gdp)
		econ.LastTickAt = time.Now()

		_ = iso // used for logging if needed
	}

	slog.Info("economy tick completed", "countries", len(ee.economies))
}

// GetGDPRanking returns countries sorted by GDP.
func (ee *EconomyEngine) GetGDPRanking() []CountryGDP {
	ee.mu.RLock()
	defer ee.mu.RUnlock()

	var ranking []CountryGDP
	for iso, econ := range ee.economies {
		ranking = append(ranking, CountryGDP{
			CountryISO: iso,
			GDP:        econ.GDP,
		})
	}

	// Sort by GDP descending
	for i := 0; i < len(ranking); i++ {
		for j := i + 1; j < len(ranking); j++ {
			if ranking[j].GDP > ranking[i].GDP {
				ranking[i], ranking[j] = ranking[j], ranking[i]
			}
		}
	}

	return ranking
}

// CountryGDP holds a country's GDP for ranking.
type CountryGDP struct {
	CountryISO string `json:"country_iso"`
	GDP        int64  `json:"gdp"`
}

func clamp(v, min, max float64) float64 {
	if v < min {
		return min
	}
	if v > max {
		return max
	}
	return v
}
