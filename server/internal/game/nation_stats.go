package game

import (
	"log/slog"
	"math"
	"sync"

	"github.com/andrewkim-gif/snake/server/internal/domain"
)

// ============================================================
// v14 Phase 6 — S28: Nation Stats Engine
// 8 metrics: Happiness, BirthRate, GDP, MilitaryPower,
//            TechLevel, Loyalty, Population, InternationalRep
// Feedback loops: Happiness↑→BirthRate↑→Population↑→GDP↑
// Updated at epoch end (combat) and hourly (full policy recalc).
// ============================================================

// Stat baseline defaults
const (
	BaseHappiness       = 50.0
	BaseBirthRate       = 2.0
	BaseGDP             = 1000.0 // billions
	BaseMilitaryPower   = 50.0
	BaseTechLevel       = 50.0
	BaseLoyalty         = 50.0
	BasePopulation      = 1000.0 // thousands
	BaseInternationalRep = 0.0

	// Feedback loop multipliers
	FeedbackHappinessToBirthRate  = 0.015  // +1 happiness → +0.015 birth rate
	FeedbackBirthRateToPopulation = 50.0   // birth rate delta × 50 = population change
	FeedbackPopulationToGDP       = 0.5    // +1K population → +$0.5B GDP
	FeedbackGDPToMilitary         = 0.005  // +$1B GDP → +0.005 military
	FeedbackHappinessToLoyalty    = 0.3    // +1 happiness → +0.3 loyalty
	FeedbackWarPenaltyHappiness   = -15.0  // being at war → -15 happiness
	FeedbackWarPenaltyGDP         = -100.0 // being at war → -$100B GDP

	// Stat clamps
	MinHappiness = 0.0
	MaxHappiness = 100.0
	MinBirthRate = 0.5
	MaxBirthRate = 4.0
	MinMilitary  = 0.0
	MaxMilitary  = 100.0
	MinTech      = 0.0
	MaxTech      = 100.0
	MinLoyalty   = 0.0
	MaxLoyalty   = 100.0
	MinPopulation = 10.0  // minimum 10K
	MinReputation = -100.0
	MaxReputation = 100.0
)

// NationStats holds the 8 core metrics for a country.
type NationStats struct {
	Happiness       float64 `json:"happiness"`       // 0-100
	BirthRate       float64 `json:"birthRate"`        // 0.5-4.0
	GDP             float64 `json:"gdp"`              // $B
	MilitaryPower   float64 `json:"militaryPower"`    // 0-100
	TechLevel       float64 `json:"techLevel"`        // 0-100
	Loyalty         float64 `json:"loyalty"`          // 0-100
	Population      float64 `json:"population"`       // thousands
	InternationalRep float64 `json:"internationalRep"` // -100 to +100
}

// NationStatsEngine manages stats for a single country.
type NationStatsEngine struct {
	mu sync.RWMutex

	countryCode string
	stats       NationStats

	// Policy manager for policy effects
	policyManager *PolicyManager

	// War state flag
	atWar bool

	// Domination stability (0-1, higher = more stable)
	dominationStability float64

	// Combat metrics from last epoch
	lastEpochKills  int
	lastEpochDeaths int
	lastEpochScore  int

	// Event callback
	OnStatsUpdate func(snapshot domain.NationStatsSnapshot)
}

// NewNationStatsEngine creates a stats engine with default values.
func NewNationStatsEngine(countryCode string, pm *PolicyManager) *NationStatsEngine {
	return &NationStatsEngine{
		countryCode: countryCode,
		stats: NationStats{
			Happiness:       BaseHappiness,
			BirthRate:       BaseBirthRate,
			GDP:             BaseGDP,
			MilitaryPower:   BaseMilitaryPower,
			TechLevel:       BaseTechLevel,
			Loyalty:         BaseLoyalty,
			Population:      BasePopulation,
			InternationalRep: BaseInternationalRep,
		},
		policyManager:       pm,
		dominationStability: 0.5,
	}
}

// OnEpochEnd updates combat-based metrics after an epoch ends.
func (nse *NationStatsEngine) OnEpochEnd(kills, deaths, nationScore int) {
	nse.mu.Lock()
	defer nse.mu.Unlock()

	nse.lastEpochKills = kills
	nse.lastEpochDeaths = deaths
	nse.lastEpochScore = nationScore

	// Military power adjusts based on combat performance
	killDeathRatio := 1.0
	if deaths > 0 {
		killDeathRatio = float64(kills) / float64(deaths)
	} else if kills > 0 {
		killDeathRatio = float64(kills)
	}
	militaryDelta := (killDeathRatio - 1.0) * 2.0 // +2 per 1.0 K/D above 1
	nse.stats.MilitaryPower = clampFloat(nse.stats.MilitaryPower+militaryDelta, MinMilitary, MaxMilitary)

	// Population decreases slightly from combat deaths
	populationLoss := float64(deaths) * 0.5 // each death = 0.5K pop loss
	nse.stats.Population = math.Max(MinPopulation, nse.stats.Population-populationLoss)

	// Score influences international reputation slightly
	if nationScore > 100 {
		nse.stats.InternationalRep = clampFloat(nse.stats.InternationalRep+1.0, MinReputation, MaxReputation)
	}

	nse.emitUpdate()

	slog.Debug("nation stats updated (epoch end)",
		"country", nse.countryCode,
		"kills", kills,
		"deaths", deaths,
		"military", nse.stats.MilitaryPower,
		"population", nse.stats.Population,
	)
}

// FullRecalculate performs a complete recalculation of all stats.
// Called at domination evaluation time (every 1 hour).
func (nse *NationStatsEngine) FullRecalculate() {
	nse.mu.Lock()
	defer nse.mu.Unlock()

	// Start from base values
	happiness := BaseHappiness
	birthRate := BaseBirthRate
	gdp := BaseGDP
	military := BaseMilitaryPower
	tech := BaseTechLevel
	loyalty := BaseLoyalty
	population := nse.stats.Population // keep current population (accumulative)
	reputation := nse.stats.InternationalRep // keep current reputation

	// 1. Apply policy effects
	if nse.policyManager != nil {
		effects := nse.policyManager.GetEffects()
		happiness += effects["happiness"]
		birthRate += effects["birthRate"]
		gdp += effects["gdp"]
		military += effects["militaryPower"]
		tech += effects["techLevel"]
		loyalty += effects["loyalty"]
		population += effects["population"]
		reputation += effects["internationalRep"]
	}

	// 2. Apply war state penalty
	if nse.atWar {
		happiness += FeedbackWarPenaltyHappiness
		gdp += FeedbackWarPenaltyGDP
	}

	// 3. Apply domination stability bonus
	stabilityBonus := (nse.dominationStability - 0.5) * 10.0 // -5 to +5
	happiness += stabilityBonus
	loyalty += stabilityBonus * 0.5

	// 4. Apply feedback loops
	// Happiness → BirthRate
	happinessDelta := happiness - BaseHappiness
	birthRate += happinessDelta * FeedbackHappinessToBirthRate

	// BirthRate → Population
	birthRateDelta := birthRate - BaseBirthRate
	population += birthRateDelta * FeedbackBirthRateToPopulation

	// Population → GDP
	populationDelta := population - BasePopulation
	gdp += populationDelta * FeedbackPopulationToGDP

	// GDP → Military (partial)
	gdpDelta := gdp - BaseGDP
	military += gdpDelta * FeedbackGDPToMilitary

	// Happiness → Loyalty
	loyalty += happinessDelta * FeedbackHappinessToLoyalty

	// 5. Clamp all values
	nse.stats.Happiness = clampFloat(happiness, MinHappiness, MaxHappiness)
	nse.stats.BirthRate = clampFloat(birthRate, MinBirthRate, MaxBirthRate)
	nse.stats.GDP = math.Max(0, gdp)
	nse.stats.MilitaryPower = clampFloat(military, MinMilitary, MaxMilitary)
	nse.stats.TechLevel = clampFloat(tech, MinTech, MaxTech)
	nse.stats.Loyalty = clampFloat(loyalty, MinLoyalty, MaxLoyalty)
	nse.stats.Population = math.Max(MinPopulation, population)
	nse.stats.InternationalRep = clampFloat(reputation, MinReputation, MaxReputation)

	nse.emitUpdate()

	slog.Info("nation stats full recalculate",
		"country", nse.countryCode,
		"happiness", nse.stats.Happiness,
		"gdp", nse.stats.GDP,
		"military", nse.stats.MilitaryPower,
		"population", nse.stats.Population,
	)
}

// SetWarState sets the at-war flag (affects happiness/GDP).
func (nse *NationStatsEngine) SetWarState(atWar bool) {
	nse.mu.Lock()
	defer nse.mu.Unlock()

	if nse.atWar != atWar {
		nse.atWar = atWar
		slog.Info("nation war state changed",
			"country", nse.countryCode,
			"at_war", atWar,
		)
	}
}

// SetDominationStability sets the domination stability (0-1).
func (nse *NationStatsEngine) SetDominationStability(stability float64) {
	nse.mu.Lock()
	defer nse.mu.Unlock()
	nse.dominationStability = clampFloat(stability, 0, 1)
}

// GetStats returns a copy of the current stats.
func (nse *NationStatsEngine) GetStats() NationStats {
	nse.mu.RLock()
	defer nse.mu.RUnlock()
	return nse.stats
}

// GetSnapshot returns a serializable snapshot for client transmission.
func (nse *NationStatsEngine) GetSnapshot() domain.NationStatsSnapshot {
	nse.mu.RLock()
	defer nse.mu.RUnlock()
	return domain.NationStatsSnapshot{
		CountryCode:     nse.countryCode,
		Happiness:       math.Round(nse.stats.Happiness*10) / 10,
		BirthRate:       math.Round(nse.stats.BirthRate*100) / 100,
		GDP:             math.Round(nse.stats.GDP*10) / 10,
		MilitaryPower:   math.Round(nse.stats.MilitaryPower*10) / 10,
		TechLevel:       math.Round(nse.stats.TechLevel*10) / 10,
		Loyalty:         math.Round(nse.stats.Loyalty*10) / 10,
		Population:      math.Round(nse.stats.Population*10) / 10,
		InternationalRep: math.Round(nse.stats.InternationalRep*10) / 10,
	}
}

// ApplyWarResult applies war outcome bonuses/penalties.
// Positive values for winner, negative for loser.
func (nse *NationStatsEngine) ApplyWarResult(gdpPercent, militaryPercent, happinessDelta float64, repDelta float64) {
	nse.mu.Lock()
	defer nse.mu.Unlock()

	nse.stats.GDP *= (1.0 + gdpPercent/100.0)
	nse.stats.GDP = math.Max(0, nse.stats.GDP)

	nse.stats.MilitaryPower *= (1.0 + militaryPercent/100.0)
	nse.stats.MilitaryPower = clampFloat(nse.stats.MilitaryPower, MinMilitary, MaxMilitary)

	nse.stats.Happiness = clampFloat(nse.stats.Happiness+happinessDelta, MinHappiness, MaxHappiness)
	nse.stats.InternationalRep = clampFloat(nse.stats.InternationalRep+repDelta, MinReputation, MaxReputation)

	nse.emitUpdate()
}

// Reset resets stats to defaults.
func (nse *NationStatsEngine) Reset() {
	nse.mu.Lock()
	defer nse.mu.Unlock()

	nse.stats = NationStats{
		Happiness:       BaseHappiness,
		BirthRate:       BaseBirthRate,
		GDP:             BaseGDP,
		MilitaryPower:   BaseMilitaryPower,
		TechLevel:       BaseTechLevel,
		Loyalty:         BaseLoyalty,
		Population:      BasePopulation,
		InternationalRep: BaseInternationalRep,
	}
	nse.atWar = false
	nse.dominationStability = 0.5
	nse.lastEpochKills = 0
	nse.lastEpochDeaths = 0
	nse.lastEpochScore = 0
}

func (nse *NationStatsEngine) emitUpdate() {
	if nse.OnStatsUpdate != nil {
		nse.OnStatsUpdate(nse.GetSnapshot())
	}
}

// clampFloat clamps a value between min and max.
func clampFloat(v, min, max float64) float64 {
	if v < min {
		return min
	}
	if v > max {
		return max
	}
	return v
}
