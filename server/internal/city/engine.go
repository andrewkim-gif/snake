package city

import (
	"fmt"
	"log/slog"
	"sync"
	"time"
)

// ControlMode determines who manages the city.
type ControlMode int

const (
	ModeAI            ControlMode = iota // NationalAI manages everything
	ModePlayerManaged                    // A player is managing this city
	ModeSpectated                        // Spectator mode (read-only)
)

// WorldSyncer is the interface for syncing city stats to the world layer.
type WorldSyncer interface {
	UpdateCountryStats(iso3 string, gdp, military, happiness float64)
	GetDiplomacyScore(iso3A, iso3B string) float64
}

// EconomySyncer is the interface for triggering meta economy ticks.
type EconomySyncer interface {
	GetResourcePrice(resource string) float64
	GetGlobalTradeModifier() float64
	ManualTick(iso3 string)
}

// WarEventReceiver is the interface for querying war status.
type WarEventReceiver interface {
	IsAtWar(iso3 string) bool
	GetWarEnemies(iso3 string) []string
}

// CityCommand represents a player command to the city engine.
type CityCommand struct {
	Type       string `json:"type"`       // "build", "demolish", "upgrade", "toggle"
	BuildingID string `json:"buildingId"` // for demolish/upgrade/toggle
	DefID      string `json:"defId"`      // for build
	TileX      int    `json:"tileX"`      // for build
	TileY      int    `json:"tileY"`      // for build
}

// CityState is the serializable state sent to clients.
type CityState struct {
	ISO3       string              `json:"iso3"`
	Tier       string              `json:"tier"`
	Mode       ControlMode         `json:"mode"`
	Buildings  []*Building         `json:"buildings"`
	Resources  map[string]float64  `json:"resources"` // resource type → quantity
	Treasury   float64             `json:"treasury"`
	GDP        float64             `json:"gdp"`
	Population int                 `json:"population"`
	Happiness  float64             `json:"happiness"`
	Military   float64             `json:"military"`
	PowerGen   float64             `json:"powerGen"`
	PowerUse   float64             `json:"powerUse"`
	TaxRate    float64             `json:"taxRate"`
	TickCount  uint64              `json:"tickCount"`
	AtWar      bool                `json:"atWar"`
	TradeRoutes []*TradeRoute      `json:"tradeRoutes"`
}

// CitySimEngine manages the simulation for a single country's city.
type CitySimEngine struct {
	mu           sync.RWMutex
	iso3         string
	tier         string // S/A/B/C/D
	mode         ControlMode
	managingUser string // client ID when mode==ModePlayerManaged

	// Core state
	buildings   map[string]*Building
	stockpile   Stockpile
	treasury    float64
	taxRate     float64
	citizenCount int
	happiness   float64

	// Sub-engines
	production  *ProductionEngine
	tradeRoutes []*TradeRoute

	// External references (interfaces for decoupling)
	worldMgr   WorldSyncer
	econEngine EconomySyncer
	warMgr     WarEventReceiver

	// Tick management
	tickCount    uint64
	tickInterval time.Duration
	lastTick     time.Time
	lastStats    CityEconomyStats

	// Computed stats for Globe sync
	gdp           float64
	militaryPower float64
	avgHappiness  float64
}

// NewCitySimEngine creates a new city simulation engine for a country.
func NewCitySimEngine(iso3, tier string) *CitySimEngine {
	return &CitySimEngine{
		iso3:         iso3,
		tier:         tier,
		mode:         ModeAI,
		buildings:    make(map[string]*Building),
		stockpile:    NewStockpile(),
		treasury:     10000, // starting treasury
		taxRate:      0.10,  // 10% default tax
		citizenCount: initialPopulation(tier),
		happiness:    70.0, // 0-100
		production:   NewProductionEngine(),
		tradeRoutes:  make([]*TradeRoute, 0),
		tickInterval: 10 * time.Second,
		lastTick:     time.Now(),
	}
}

// initialPopulation returns starting population based on country tier.
func initialPopulation(tier string) int {
	switch tier {
	case "S":
		return 200
	case "A":
		return 150
	case "B":
		return 100
	case "C":
		return 75
	default:
		return 50
	}
}

// SetExternalRefs sets the external engine references.
func (e *CitySimEngine) SetExternalRefs(world WorldSyncer, econ EconomySyncer, war WarEventReceiver) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.worldMgr = world
	e.econEngine = econ
	e.warMgr = war
}

// SetMode changes the control mode.
func (e *CitySimEngine) SetMode(mode ControlMode, clientID string) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.mode = mode
	e.managingUser = clientID
	if mode == ModePlayerManaged {
		e.tickInterval = 10 * time.Second
	}
}

// GetISO3 returns the country ISO3 code.
func (e *CitySimEngine) GetISO3() string {
	return e.iso3
}

// IsActive returns true if a player is managing this city.
func (e *CitySimEngine) IsActive() bool {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.mode == ModePlayerManaged || e.mode == ModeSpectated
}

// FullTick runs a complete economy tick (for active cities, 10s interval).
func (e *CitySimEngine) FullTick() {
	e.mu.Lock()
	defer e.mu.Unlock()

	e.tickCount++
	now := time.Now()

	// Run the economy tick
	stats := RunEconomyTick(
		e.buildings,
		e.stockpile,
		&e.treasury,
		e.citizenCount,
		e.tradeRoutes,
		e.taxRate,
		e.production,
	)
	e.lastStats = stats
	e.gdp = stats.GDP

	// Update happiness based on food satisfaction and services
	e.updateHappiness(stats.FoodSatisfaction)

	// Calculate military power from military buildings
	e.militaryPower = e.computeMilitaryPower()

	// Sync to world manager
	if e.worldMgr != nil {
		e.worldMgr.UpdateCountryStats(e.iso3, e.gdp, e.militaryPower, e.happiness)
	}

	// Trigger meta economy tick for this country
	if e.econEngine != nil {
		e.econEngine.ManualTick(e.iso3)
	}

	e.lastTick = now

	slog.Debug("city tick completed",
		"iso3", e.iso3,
		"tick", e.tickCount,
		"gdp", e.gdp,
		"treasury", e.treasury,
		"population", e.citizenCount,
	)
}

// LightTick runs a lightweight tick for inactive cities (60s interval).
// Skips citizen FSM, only processes production and trade.
func (e *CitySimEngine) LightTick() {
	e.mu.Lock()
	defer e.mu.Unlock()

	e.tickCount++

	// Simplified tick: just production and maintenance
	e.production.UpdateBuildingEfficiencies(e.buildings)
	prodValue := e.production.RunProduction(e.buildings, e.stockpile)
	payMaintenance(e.buildings, &e.treasury)
	collectTax(e.citizenCount, e.taxRate, &e.treasury)

	e.gdp = prodValue
	e.lastTick = time.Now()
}

// HandleCommand processes a player command.
func (e *CitySimEngine) HandleCommand(cmd CityCommand) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	switch cmd.Type {
	case "build":
		return e.handleBuild(cmd)
	case "demolish":
		return e.handleDemolish(cmd)
	case "upgrade":
		return e.handleUpgrade(cmd)
	case "toggle":
		return e.handleToggle(cmd)
	default:
		return fmt.Errorf("unknown command type: %s", cmd.Type)
	}
}

// handleBuild places a new building.
func (e *CitySimEngine) handleBuild(cmd CityCommand) error {
	def := GetBuildingDef(cmd.DefID)
	if def == nil {
		return fmt.Errorf("unknown building type: %s", cmd.DefID)
	}

	// Check cost
	if e.treasury < def.BuildCost {
		return fmt.Errorf("insufficient funds: need %.0f, have %.0f", def.BuildCost, e.treasury)
	}

	// Deduct cost and create building
	e.treasury -= def.BuildCost
	b := NewBuilding(cmd.DefID, cmd.TileX, cmd.TileY)
	e.buildings[b.ID] = b

	slog.Info("building placed",
		"iso3", e.iso3,
		"building", def.Name,
		"tile", fmt.Sprintf("(%d,%d)", cmd.TileX, cmd.TileY),
	)

	return nil
}

// handleDemolish removes a building.
func (e *CitySimEngine) handleDemolish(cmd CityCommand) error {
	b, ok := e.buildings[cmd.BuildingID]
	if !ok {
		return fmt.Errorf("building not found: %s", cmd.BuildingID)
	}

	// Refund 50% of build cost
	def := GetBuildingDef(b.DefID)
	if def != nil {
		e.treasury += def.BuildCost * 0.5
	}

	delete(e.buildings, cmd.BuildingID)

	slog.Info("building demolished",
		"iso3", e.iso3,
		"buildingId", cmd.BuildingID,
	)

	return nil
}

// handleUpgrade upgrades a building to the next level.
func (e *CitySimEngine) handleUpgrade(cmd CityCommand) error {
	b, ok := e.buildings[cmd.BuildingID]
	if !ok {
		return fmt.Errorf("building not found: %s", cmd.BuildingID)
	}

	def := GetBuildingDef(b.DefID)
	if def == nil {
		return fmt.Errorf("building def not found: %s", b.DefID)
	}

	if b.Level >= def.MaxLevel {
		return fmt.Errorf("building already at max level %d", def.MaxLevel)
	}

	// Upgrade cost = 75% of original build cost per level
	upgradeCost := def.BuildCost * 0.75 * float64(b.Level)
	if e.treasury < upgradeCost {
		return fmt.Errorf("insufficient funds for upgrade: need %.0f, have %.0f", upgradeCost, e.treasury)
	}

	e.treasury -= upgradeCost
	b.Level++

	slog.Info("building upgraded",
		"iso3", e.iso3,
		"building", def.Name,
		"level", b.Level,
	)

	return nil
}

// handleToggle enables or disables a building.
func (e *CitySimEngine) handleToggle(cmd CityCommand) error {
	b, ok := e.buildings[cmd.BuildingID]
	if !ok {
		return fmt.Errorf("building not found: %s", cmd.BuildingID)
	}

	b.Enabled = !b.Enabled

	state := "enabled"
	if !b.Enabled {
		state = "disabled"
	}
	slog.Info("building toggled",
		"iso3", e.iso3,
		"buildingId", cmd.BuildingID,
		"state", state,
	)

	return nil
}

// GetCityState returns the current city state for client serialization.
func (e *CitySimEngine) GetCityState() CityState {
	e.mu.RLock()
	defer e.mu.RUnlock()

	buildings := make([]*Building, 0, len(e.buildings))
	for _, b := range e.buildings {
		buildings = append(buildings, b)
	}

	resources := make(map[string]float64, len(e.stockpile))
	for k, v := range e.stockpile {
		resources[string(k)] = v
	}

	gen, use, _ := ComputePowerBalance(e.buildings)

	atWar := false
	if e.warMgr != nil {
		atWar = e.warMgr.IsAtWar(e.iso3)
	}

	return CityState{
		ISO3:        e.iso3,
		Tier:        e.tier,
		Mode:        e.mode,
		Buildings:   buildings,
		Resources:   resources,
		Treasury:    e.treasury,
		GDP:         e.gdp,
		Population:  e.citizenCount,
		Happiness:   e.happiness,
		Military:    e.militaryPower,
		PowerGen:    gen,
		PowerUse:    use,
		TaxRate:     e.taxRate,
		TickCount:   e.tickCount,
		AtWar:       atWar,
		TradeRoutes: e.tradeRoutes,
	}
}

// updateHappiness adjusts happiness based on food, services, and war status.
func (e *CitySimEngine) updateHappiness(foodSatisfaction float64) {
	// Base happiness from food satisfaction (0-40 points)
	foodHappy := foodSatisfaction * 40

	// Service coverage (0-30 points)
	serviceHappy := e.computeServiceCoverage() * 30

	// Employment rate (0-20 points)
	employmentRate := e.computeEmploymentRate()
	jobHappy := employmentRate * 20

	// War penalty (-20 points)
	warPenalty := 0.0
	if e.warMgr != nil && e.warMgr.IsAtWar(e.iso3) {
		warPenalty = -20.0
	}

	// Treasury health (+10 when positive, -10 when negative)
	treasuryBonus := 0.0
	if e.treasury > 0 {
		treasuryBonus = 10.0
	}

	newHappiness := foodHappy + serviceHappy + jobHappy + warPenalty + treasuryBonus
	if newHappiness < 0 {
		newHappiness = 0
	}
	if newHappiness > 100 {
		newHappiness = 100
	}

	// Smooth transition: 20% new + 80% old
	e.happiness = e.happiness*0.8 + newHappiness*0.2
	e.avgHappiness = e.happiness
}

// computeServiceCoverage returns 0.0-1.0 based on service buildings per capita.
func (e *CitySimEngine) computeServiceCoverage() float64 {
	if e.citizenCount == 0 {
		return 1.0
	}

	var serviceCapacity int
	for _, b := range e.buildings {
		if b.UnderConstruction || !b.Enabled {
			continue
		}
		def := GetBuildingDef(b.DefID)
		if def == nil {
			continue
		}
		if def.Category == CatService {
			serviceCapacity += def.MaxWorkers * 5 // each service worker serves ~5 citizens
		}
	}

	coverage := float64(serviceCapacity) / float64(e.citizenCount)
	if coverage > 1.0 {
		coverage = 1.0
	}
	return coverage
}

// computeEmploymentRate returns 0.0-1.0 based on total jobs vs population.
func (e *CitySimEngine) computeEmploymentRate() float64 {
	if e.citizenCount == 0 {
		return 1.0
	}

	var totalJobs int
	for _, b := range e.buildings {
		if b.UnderConstruction || !b.Enabled {
			continue
		}
		totalJobs += b.Workers
	}

	rate := float64(totalJobs) / float64(e.citizenCount)
	if rate > 1.0 {
		rate = 1.0
	}
	return rate
}

// computeMilitaryPower calculates military strength from military buildings.
func (e *CitySimEngine) computeMilitaryPower() float64 {
	var power float64
	for _, b := range e.buildings {
		if b.UnderConstruction || !b.Enabled {
			continue
		}
		def := GetBuildingDef(b.DefID)
		if def == nil {
			continue
		}
		if def.Category == CatMilitary {
			power += float64(b.Workers) * b.Efficiency * float64(b.Level) * 10
		}
	}
	return power
}
