package city

import (
	"fmt"
	"log/slog"
	"math/rand"
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
	Type        string `json:"type"`        // "build", "demolish", "upgrade", "toggle", "issue_edict", "revoke_edict", "vote"
	BuildingID  string `json:"buildingId"`  // for demolish/upgrade/toggle
	DefID       string `json:"defId"`       // for build
	TileX       int    `json:"tileX"`       // for build
	TileY       int    `json:"tileY"`       // for build
	EdictID     string `json:"edictId"`     // for issue_edict/revoke_edict
	CandidateID string `json:"candidateId"` // for vote
}

// CityState is the serializable state sent to clients.
type CityState struct {
	ISO3        string                    `json:"iso3"`
	Tier        string                    `json:"tier"`
	Mode        ControlMode               `json:"mode"`
	Buildings   []*Building               `json:"buildings"`
	Citizens    []CitizenSnapshot         `json:"citizens"`
	Resources   map[string]float64        `json:"resources"` // resource type → quantity
	Treasury    float64                   `json:"treasury"`
	GDP         float64                   `json:"gdp"`
	Population  int                       `json:"population"`
	Happiness   float64                   `json:"happiness"`
	Military    float64                   `json:"military"`
	PowerGen    float64                   `json:"powerGen"`
	PowerUse    float64                   `json:"powerUse"`
	TaxRate     float64                   `json:"taxRate"`
	TickCount   uint64                    `json:"tickCount"`
	AtWar       bool                      `json:"atWar"`
	TradeRoutes []*TradeRoute             `json:"tradeRoutes"`
	Employed    int                       `json:"employed"`
	Unemployed  int                       `json:"unemployed"`
	Politics    *PoliticsSnapshot         `json:"politics,omitempty"`
	Election    *ElectionSnapshot         `json:"election,omitempty"`
	Diplomacy   *DiplomacyBridgeSnapshot  `json:"diplomacy,omitempty"`
}

// CitySimEngine manages the simulation for a single country's city.
type CitySimEngine struct {
	mu           sync.RWMutex
	iso3         string
	tier         string // S/A/B/C/D
	mode         ControlMode
	managingUser string // client ID when mode==ModePlayerManaged

	// Core state
	buildings    map[string]*Building
	citizens     []*CitizenAgent
	stockpile    Stockpile
	treasury     float64
	taxRate      float64
	citizenCount int
	happiness    float64

	// Sub-engines
	production      *ProductionEngine
	politics        *PoliticsEngine
	election        *ElectionEngine
	diplomacyBridge *DiplomacyBridge
	tradeRoutes     []*TradeRoute
	nationalAI      *NationalAI

	// External references (interfaces for decoupling)
	worldMgr   WorldSyncer
	econEngine EconomySyncer
	warMgr     WarEventReceiver

	// Tick management
	tickCount    uint64
	tickInterval time.Duration
	lastTick     time.Time
	lastStats    CityEconomyStats
	rng          *rand.Rand

	// Computed stats for Globe sync
	gdp           float64
	militaryPower float64
	avgHappiness  float64
}

// NewCitySimEngine creates a new city simulation engine for a country.
func NewCitySimEngine(iso3, tier string) *CitySimEngine {
	// Seed RNG from iso3 for reproducibility
	seed := int64(0)
	for _, c := range iso3 {
		seed = seed*31 + int64(c)
	}
	rng := rand.New(rand.NewSource(seed))

	citizenTarget := InitialCitizenCount(tier)
	mapSize := mapSizeForTier(tier)

	// Initialize citizens
	citizens := make([]*CitizenAgent, citizenTarget)
	for i := 0; i < citizenTarget; i++ {
		citizens[i] = NewCitizen(rng, mapSize)
	}

	return &CitySimEngine{
		iso3:            iso3,
		tier:            tier,
		mode:            ModeAI,
		buildings:       make(map[string]*Building),
		citizens:        citizens,
		stockpile:       NewStockpile(),
		treasury:        10000, // starting treasury
		taxRate:         0.10,  // 10% default tax
		citizenCount:    citizenTarget,
		happiness:       70.0, // 0-100
		production:      NewProductionEngine(),
		politics:        NewPoliticsEngine(),
		election:        NewElectionEngine(),
		diplomacyBridge: NewDiplomacyBridge(iso3),
		nationalAI:      NewNationalAI(rng),
		tradeRoutes:     make([]*TradeRoute, 0),
		tickInterval:    10 * time.Second,
		lastTick:        time.Now(),
		rng:             rng,
	}
}

// mapSizeForTier returns the tilemap size for the tier.
func mapSizeForTier(tier string) int {
	switch tier {
	case "S":
		return 80
	case "A":
		return 60
	case "B":
		return 40
	case "C":
		return 30
	default:
		return 20
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

	// Step 1: Employment assignment (before economy tick so worker counts are accurate)
	AssignCitizensToWorkplaces(e.citizens, e.buildings)

	// Step 2: Run the economy tick
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

	// Step 3: Citizen FSM tick — advance each citizen's behavior state
	atWar := e.warMgr != nil && e.warMgr.IsAtWar(e.iso3)
	edictMods := e.politics.GetActiveEdictHappinessModifiers()
	for _, citizen := range e.citizens {
		citizen.TickCitizen(e.buildings, e.rng)
		citizen.ComputeHappiness(e.buildings, stats.FoodSatisfaction, atWar, &edictMods)
	}

	// Step 4: Update city-level happiness from citizen average
	e.updateHappinessFromCitizens()

	// Step 5: Calculate military power from military buildings
	e.militaryPower = e.computeMilitaryPower()

	// Step 5.5: Politics tick — faction aggregation, approval, edict costs, events
	edictCost := e.politics.TickPolitics(e.citizens, e.tickCount, e.rng)
	if e.treasury >= edictCost {
		e.treasury -= edictCost
	} else {
		e.treasury = 0
	}

	// Step 5.6: Diplomacy bridge tick — war effects, trade modifiers
	if e.diplomacyBridge != nil {
		warDrain, _, militaryMult := e.diplomacyBridge.TickDiplomacy(e.iso3)
		if warDrain > 0 {
			if e.treasury >= warDrain {
				e.treasury -= warDrain
			} else {
				e.treasury = 0
			}
		}
		// Apply military boost to military power calculation
		if militaryMult > 1.0 {
			e.militaryPower *= militaryMult
		}
	}

	// Step 5.7: Election tick — campaign, voting, results
	if e.election != nil && e.politics != nil {
		pledgedEdicts := e.election.TickElection(e.tickCount, e.citizens, e.politics, e.rng)
		// Enact winner's pledged edicts
		for _, edictID := range pledgedEdicts {
			// Revoke conflicting active edicts in same category first
			def := GetEdictDef(edictID)
			if def != nil {
				// Try to issue the edict (may fail if max active reached)
				err := e.politics.IssueEdict(edictID, e.treasury, e.tickCount)
				if err != nil {
					slog.Debug("election edict enactment failed",
						"iso3", e.iso3,
						"edict", edictID,
						"error", err,
					)
				}
			}
		}
	}

	// Step 6: NationalAI tick — auto-manage AI-controlled cities
	if e.mode == ModeAI && e.nationalAI != nil {
		atWarForAI := e.warMgr != nil && e.warMgr.IsAtWar(e.iso3)
		ms := mapSizeForTier(e.tier)
		e.nationalAI.Tick(
			e.iso3,
			e.buildings,
			e.stockpile,
			&e.treasury,
			e.citizenCount,
			e.happiness,
			e.militaryPower,
			e.politics,
			e.tickCount,
			atWarForAI,
			ms,
		)
	}

	// Step 7: Pay citizen savings (salary → savings each tick)
	e.payCitizenSalaries()

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
		"citizens", len(e.citizens),
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
	case "issue_edict":
		return e.handleIssueEdict(cmd)
	case "revoke_edict":
		return e.handleRevokeEdict(cmd)
	case "vote":
		return e.handleVote(cmd)
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

// handleIssueEdict enacts a new edict.
func (e *CitySimEngine) handleIssueEdict(cmd CityCommand) error {
	if e.politics == nil {
		return fmt.Errorf("politics engine not initialized")
	}
	return e.politics.IssueEdict(EdictID(cmd.EdictID), e.treasury, e.tickCount)
}

// handleRevokeEdict deactivates an active edict.
func (e *CitySimEngine) handleRevokeEdict(cmd CityCommand) error {
	if e.politics == nil {
		return fmt.Errorf("politics engine not initialized")
	}
	return e.politics.RevokeEdict(EdictID(cmd.EdictID), e.tickCount)
}

// handleVote casts the player's vote for a candidate.
func (e *CitySimEngine) handleVote(cmd CityCommand) error {
	if e.election == nil {
		return fmt.Errorf("election engine not initialized")
	}
	return e.election.CastVote(cmd.CandidateID)
}

// GetCityState returns the current city state for client serialization.
func (e *CitySimEngine) GetCityState() CityState {
	e.mu.RLock()
	defer e.mu.RUnlock()

	buildings := make([]*Building, 0, len(e.buildings))
	for _, b := range e.buildings {
		buildings = append(buildings, b)
	}

	// Citizen snapshots for client rendering
	citizenSnapshots := make([]CitizenSnapshot, len(e.citizens))
	employed := 0
	for i, c := range e.citizens {
		citizenSnapshots[i] = c.Snapshot()
		if c.IsEmployed() {
			employed++
		}
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

	// Politics snapshot
	var politicsSnap *PoliticsSnapshot
	if e.politics != nil {
		snap := e.politics.Snapshot(e.tickCount)
		politicsSnap = &snap
	}

	// Election snapshot
	var electionSnap *ElectionSnapshot
	if e.election != nil {
		snap := e.election.Snapshot()
		electionSnap = &snap
	}

	// Diplomacy bridge snapshot
	var diplomacySnap *DiplomacyBridgeSnapshot
	if e.diplomacyBridge != nil {
		snap := e.diplomacyBridge.Snapshot()
		diplomacySnap = &snap
	}

	return CityState{
		ISO3:        e.iso3,
		Tier:        e.tier,
		Mode:        e.mode,
		Buildings:   buildings,
		Citizens:    citizenSnapshots,
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
		Employed:    employed,
		Unemployed:  len(e.citizens) - employed,
		Politics:    politicsSnap,
		Election:    electionSnap,
		Diplomacy:   diplomacySnap,
	}
}

// updateHappinessFromCitizens computes city-level happiness from citizen averages.
func (e *CitySimEngine) updateHappinessFromCitizens() {
	if len(e.citizens) == 0 {
		return
	}

	var totalHappiness float64
	for _, c := range e.citizens {
		totalHappiness += c.OverallHappiness
	}
	newHappiness := totalHappiness / float64(len(e.citizens))

	// Smooth transition: 30% new + 70% old (faster response than before)
	e.happiness = e.happiness*0.7 + newHappiness*0.3
	e.avgHappiness = e.happiness
}

// payCitizenSalaries transfers salary to citizen savings each tick.
func (e *CitySimEngine) payCitizenSalaries() {
	for _, c := range e.citizens {
		if c.IsEmployed() {
			c.Savings += c.Salary
		}
		// Citizens spend from savings (basic cost of living)
		c.Savings -= 1.0
		if c.Savings < 0 {
			c.Savings = 0
		}
	}
}

// updateHappiness adjusts happiness based on food, services, and war status.
// LEGACY: kept for LightTick (inactive cities without citizen FSM).
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
