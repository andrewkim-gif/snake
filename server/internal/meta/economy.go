package meta

import (
	"context"
	"fmt"
	"log/slog"
	"sort"
	"sync"
	"time"
)

// ResourceType enumerates the 6 resource types in the economy.
type ResourceType string

const (
	ResOil       ResourceType = "oil"
	ResMinerals  ResourceType = "minerals"
	ResFood      ResourceType = "food"
	ResTech      ResourceType = "tech"
	ResManpower  ResourceType = "manpower"
	ResInfluence ResourceType = "influence"
)

// AllResourceTypes lists every resource type for iteration.
var AllResourceTypes = []ResourceType{
	ResOil, ResMinerals, ResFood, ResTech, ResManpower, ResInfluence,
}

// EconomyConfig holds configuration for the economic engine.
type EconomyConfig struct {
	TickInterval     time.Duration // How often economy ticks (default: 1 hour)
	TaxRateDefault   float64       // Default tax rate (0.0 - 0.5)
	TradeOpenDefault float64       // Default trade openness (0.0 - 1.0)
	ResourceCapBase  int64         // Base max resource storage per type
	// Distribution ratios (must sum to 1.0)
	FactionShare      float64 // Faction treasury share (default: 0.50)
	SovereignShare    float64 // Sovereign leader share (default: 0.30)
	ParticipantShare  float64 // Battle participant share (default: 0.20)
}

// DefaultEconomyConfig returns default economy configuration.
func DefaultEconomyConfig() EconomyConfig {
	return EconomyConfig{
		TickInterval:     time.Hour,
		TaxRateDefault:   0.10,
		TradeOpenDefault: 0.50,
		ResourceCapBase:  1_000_000,
		FactionShare:     0.50,
		SovereignShare:   0.30,
		ParticipantShare: 0.20,
	}
}

// CountryResourceProfile holds the base resource production values for a country.
// These are normalized 0-100 values from the world seed data.
type CountryResourceProfile struct {
	Oil      int `json:"oil"`
	Minerals int `json:"minerals"`
	Food     int `json:"food"`
	Tech     int `json:"tech"`
	Manpower int `json:"manpower"`
}

// CountryEconomy holds the economic state of a country.
type CountryEconomy struct {
	CountryISO string `json:"country_iso"`
	Tier       string `json:"tier"` // S/A/B/C/D

	// Current resource stockpile
	Stockpile ResourceBundle `json:"stockpile"`

	// Base production per tick (from country seed data)
	BaseProduction ResourceBundle `json:"base_production"`

	// Effective production per tick (after multipliers)
	EffectiveProduction ResourceBundle `json:"effective_production"`

	// Economic policy
	TaxRate       float64 `json:"tax_rate"`       // 0.0 - 0.50
	TradeOpenness float64 `json:"trade_openness"` // 0.0 - 1.0
	MilitarySpend float64 `json:"military_spend"` // 0.0 - 0.50
	TechInvest    float64 `json:"tech_invest"`    // 0.0 - 0.30

	// Sovereignty context
	SovereignFaction string  `json:"sovereign_faction"`
	SovereigntyLevel int     `json:"sovereignty_level"`
	TierMultiplier   float64 `json:"tier_multiplier"`

	// GDP
	GDP        int64 `json:"gdp"`
	PrevGDP    int64 `json:"prev_gdp"`
	GDPDelta   int64 `json:"gdp_delta"`

	// Resource cap (maximum storage)
	ResourceCap int64 `json:"resource_cap"`

	// Timestamps
	LastTickAt time.Time `json:"last_tick_at"`
}

// ProductionTickResult holds the result of a single country's economy tick.
type ProductionTickResult struct {
	CountryISO          string         `json:"country_iso"`
	Produced            ResourceBundle `json:"produced"`
	FactionDeposit      ResourceBundle `json:"faction_deposit"`
	SovereignDeposit    ResourceBundle `json:"sovereign_deposit"`
	ParticipantPool     ResourceBundle `json:"participant_pool"`
	GDPBefore           int64          `json:"gdp_before"`
	GDPAfter            int64          `json:"gdp_after"`
	CappedResources     []ResourceType `json:"capped_resources,omitempty"`
}

// EconomyTickSummary holds the summary of an entire economy tick cycle.
type EconomyTickSummary struct {
	Timestamp       time.Time              `json:"timestamp"`
	CountriesProcessed int                 `json:"countries_processed"`
	TotalGDP        int64                  `json:"total_gdp"`
	Results         []ProductionTickResult `json:"results,omitempty"`
}

// TierMultipliers maps country tier to resource multiplier.
var TierMultipliers = map[string]float64{
	"S": 3.0,
	"A": 2.0,
	"B": 1.5,
	"C": 1.0,
	"D": 0.5,
}

// SovereigntyLevelBonus returns the resource bonus multiplier for sovereignty level.
// Lv.1=+0%, Lv.2=+10%, Lv.3=+25%, Lv.4=+50%, Lv.5+=+100%
func SovereigntyLevelBonus(level int) float64 {
	switch {
	case level <= 0:
		return 1.0
	case level == 1:
		return 1.0
	case level == 2:
		return 1.10
	case level == 3:
		return 1.25
	case level == 4:
		return 1.50
	default: // 5+
		return 2.0
	}
}

// EconomyStore is the persistence interface for economy data.
type EconomyStore interface {
	UpdateGDP(iso3 string, gdp int64) error
	UpdateSovereignty(iso3 string, factionID *string, level, streak int) error
}

// EconomyEngine manages the global economy simulation.
// Runs a background tick every hour to compute resource production,
// apply policy effects, distribute wealth to factions, and update GDP.
type EconomyEngine struct {
	mu sync.RWMutex

	config       EconomyConfig
	economies    map[string]*CountryEconomy // countryISO → economy state
	marketPrices map[ResourceType]float64   // resource type → gold price

	// External references (set after construction)
	factionManager *FactionManager
	diplomacyEngine *DiplomacyEngine

	// Battle participant tracking (countryISO → list of userIDs who participated in last battle)
	battleParticipants map[string][]string

	// GDP history for graphs (countryISO → list of GDP snapshots)
	gdpHistory map[string][]GDPSnapshot

	// Tick counter
	tickCount int64

	// Persistence
	store        EconomyStore
	dirtyCountries map[string]bool // countries modified since last flush

	// Lifecycle
	cancel context.CancelFunc
}

// GDPSnapshot records a GDP value at a point in time.
type GDPSnapshot struct {
	Timestamp time.Time `json:"timestamp"`
	GDP       int64     `json:"gdp"`
}

// NewEconomyEngine creates a new economy engine.
func NewEconomyEngine(cfg EconomyConfig) *EconomyEngine {
	return &EconomyEngine{
		config:    cfg,
		economies: make(map[string]*CountryEconomy),
		marketPrices: map[ResourceType]float64{
			ResOil:       10.0,
			ResMinerals:  8.0,
			ResFood:      5.0,
			ResTech:      15.0,
			ResManpower:  3.0,
			ResInfluence: 12.0,
		},
		battleParticipants: make(map[string][]string),
		gdpHistory:         make(map[string][]GDPSnapshot),
		dirtyCountries:     make(map[string]bool),
	}
}

// SetFactionManager sets the faction manager reference for treasury deposits.
func (ee *EconomyEngine) SetFactionManager(fm *FactionManager) {
	ee.mu.Lock()
	defer ee.mu.Unlock()
	ee.factionManager = fm
}

// SetDiplomacyEngine sets the diplomacy engine reference for sanctions.
func (ee *EconomyEngine) SetDiplomacyEngine(de *DiplomacyEngine) {
	ee.mu.Lock()
	defer ee.mu.Unlock()
	ee.diplomacyEngine = de
}

// InitializeCountry sets up the economy for a country based on seed data.
func (ee *EconomyEngine) InitializeCountry(iso3, tier string, oil, minerals, food, tech, manpower int) {
	ee.mu.Lock()
	defer ee.mu.Unlock()

	mult := TierMultipliers[tier]
	if mult == 0 {
		mult = 1.0
	}

	baseProd := ResourceBundle{
		Oil:      int64(oil),
		Minerals: int64(minerals),
		Food:     int64(food),
		Tech:     int64(tech),
		Influence: 0, // Influence is computed from sovereignty
	}

	// Manpower is stored as Gold equivalent in production for simplicity
	// Actual manpower tracking can be extended later

	ee.economies[iso3] = &CountryEconomy{
		CountryISO:     iso3,
		Tier:           tier,
		Stockpile:      ResourceBundle{},
		BaseProduction: baseProd,
		EffectiveProduction: ResourceBundle{
			Oil:      int64(float64(oil) * mult),
			Minerals: int64(float64(minerals) * mult),
			Food:     int64(float64(food) * mult),
			Tech:     int64(float64(tech) * mult),
		},
		TaxRate:        ee.config.TaxRateDefault,
		TradeOpenness:  ee.config.TradeOpenDefault,
		MilitarySpend:  0.20,
		TechInvest:     0.10,
		TierMultiplier: mult,
		ResourceCap:    ee.config.ResourceCapBase,
		LastTickAt:     time.Now(),
	}
}

// GetEconomy returns the economy state for a country.
func (ee *EconomyEngine) GetEconomy(iso3 string) *CountryEconomy {
	ee.mu.RLock()
	defer ee.mu.RUnlock()

	econ, ok := ee.economies[iso3]
	if !ok {
		return nil
	}
	// Return a copy
	copy := *econ
	return &copy
}

// GetAllEconomies returns a snapshot of all country economies.
func (ee *EconomyEngine) GetAllEconomies() map[string]*CountryEconomy {
	ee.mu.RLock()
	defer ee.mu.RUnlock()

	snapshot := make(map[string]*CountryEconomy, len(ee.economies))
	for k, v := range ee.economies {
		copy := *v
		snapshot[k] = &copy
	}
	return snapshot
}

// GetMarketPrices returns current resource market prices.
func (ee *EconomyEngine) GetMarketPrices() map[ResourceType]float64 {
	ee.mu.RLock()
	defer ee.mu.RUnlock()

	prices := make(map[ResourceType]float64, len(ee.marketPrices))
	for k, v := range ee.marketPrices {
		prices[k] = v
	}
	return prices
}

// SetMarketPrice updates a single resource market price.
func (ee *EconomyEngine) SetMarketPrice(resource ResourceType, price float64) {
	ee.mu.Lock()
	defer ee.mu.Unlock()
	if price < 0.01 {
		price = 0.01
	}
	ee.marketPrices[resource] = price
}

// UpdateSovereignty updates the sovereignty context for a country's economy.
func (ee *EconomyEngine) UpdateSovereignty(iso3, factionID string, level int) {
	ee.mu.Lock()
	defer ee.mu.Unlock()

	econ, ok := ee.economies[iso3]
	if !ok {
		return
	}
	econ.SovereignFaction = factionID
	econ.SovereigntyLevel = level
	ee.recalcEffectiveProduction(econ)
}

// SetBattleParticipants records who participated in the last battle for a country.
func (ee *EconomyEngine) SetBattleParticipants(iso3 string, userIDs []string) {
	ee.mu.Lock()
	defer ee.mu.Unlock()
	ee.battleParticipants[iso3] = userIDs
}

// recalcEffectiveProduction recalculates a country's effective production
// based on base production, tier multiplier, sovereignty level, and policies.
// Must be called with write lock held.
func (ee *EconomyEngine) recalcEffectiveProduction(econ *CountryEconomy) {
	sovBonus := SovereigntyLevelBonus(econ.SovereigntyLevel)
	tierMult := econ.TierMultiplier

	// Tech investment bonus: each 1% tech invest = +1% tech production
	techBonus := 1.0 + econ.TechInvest

	// Military spend penalty: reduces non-military production
	civilianPenalty := 1.0 - (econ.MilitarySpend * 0.5) // 50% military = -25% civilian

	econ.EffectiveProduction = ResourceBundle{
		Oil:      capResource(int64(float64(econ.BaseProduction.Oil)*tierMult*sovBonus*civilianPenalty), econ.ResourceCap),
		Minerals: capResource(int64(float64(econ.BaseProduction.Minerals)*tierMult*sovBonus*civilianPenalty), econ.ResourceCap),
		Food:     capResource(int64(float64(econ.BaseProduction.Food)*tierMult*sovBonus*civilianPenalty), econ.ResourceCap),
		Tech:     capResource(int64(float64(econ.BaseProduction.Tech)*tierMult*sovBonus*techBonus), econ.ResourceCap),
		Influence: computeInfluenceProduction(econ.SovereigntyLevel, econ.Tier),
	}
}

// computeInfluenceProduction calculates influence production based on sovereignty + tier.
func computeInfluenceProduction(sovLevel int, tier string) int64 {
	baseInfluence := map[string]int64{
		"S": 50, "A": 30, "B": 20, "C": 10, "D": 5,
	}
	base := baseInfluence[tier]
	if base == 0 {
		base = 10
	}
	return base * int64(sovLevel+1)
}

// capResource ensures a value doesn't exceed the cap.
func capResource(val, cap int64) int64 {
	if val > cap {
		return cap
	}
	if val < 0 {
		return 0
	}
	return val
}

// --- Background Worker ---

// Start begins the economy background worker.
func (ee *EconomyEngine) Start(ctx context.Context) {
	workerCtx, cancel := context.WithCancel(ctx)
	ee.cancel = cancel

	go ee.tickLoop(workerCtx)
	slog.Info("economy engine started", "tickInterval", ee.config.TickInterval)
}

// Stop stops the economy background worker.
func (ee *EconomyEngine) Stop() {
	if ee.cancel != nil {
		ee.cancel()
		ee.cancel = nil
	}
	slog.Info("economy engine stopped")
}

// tickLoop runs the economy tick at configured intervals.
func (ee *EconomyEngine) tickLoop(ctx context.Context) {
	// Fire an immediate tick so resources start flowing right away
	summary := ee.Tick()
	slog.Info("economy initial tick completed",
		"countries", summary.CountriesProcessed,
		"totalGDP", summary.TotalGDP,
	)

	ticker := time.NewTicker(ee.config.TickInterval)
	defer ticker.Stop()

	// DB flush every 5 minutes
	flushTicker := time.NewTicker(5 * time.Minute)
	defer flushTicker.Stop()

	for {
		select {
		case <-ctx.Done():
			// Final flush on shutdown
			ee.FlushDirtyCountries()
			return
		case <-ticker.C:
			summary := ee.Tick()
			slog.Info("economy tick completed",
				"countries", summary.CountriesProcessed,
				"totalGDP", summary.TotalGDP,
				"tick", ee.tickCount,
			)
		case <-flushTicker.C:
			ee.FlushDirtyCountries()
		}
	}
}

// Tick processes one economy cycle for all countries.
// This is the main entry point called by the background worker every hour.
func (ee *EconomyEngine) Tick() EconomyTickSummary {
	ee.mu.Lock()
	defer ee.mu.Unlock()

	ee.tickCount++
	now := time.Now()
	summary := EconomyTickSummary{
		Timestamp: now,
	}

	for iso, econ := range ee.economies {
		result := ee.processCountryTick(iso, econ, now)
		summary.Results = append(summary.Results, result)
		summary.TotalGDP += econ.GDP
		if econ.SovereignFaction != "" {
			ee.dirtyCountries[iso] = true
		}
	}

	summary.CountriesProcessed = len(ee.economies)

	// Process tribute payments (from diplomacy)
	ee.processTributePayments()

	return summary
}

// processCountryTick handles a single country's economic tick.
// Must be called with write lock held.
func (ee *EconomyEngine) processCountryTick(iso string, econ *CountryEconomy, now time.Time) ProductionTickResult {
	result := ProductionTickResult{
		CountryISO: iso,
		GDPBefore:  econ.GDP,
	}

	// Skip unclaimed countries (no sovereign = minimal production)
	if econ.SovereignFaction == "" {
		econ.LastTickAt = now
		result.GDPAfter = econ.GDP
		return result
	}

	// Step 1: Recalculate effective production with current policies
	ee.recalcEffectiveProduction(econ)

	// Step 2: Calculate produced resources for this tick
	produced := econ.EffectiveProduction
	result.Produced = produced

	// Step 3: Apply resource caps to stockpile
	var cappedResources []ResourceType
	econ.Stockpile.Oil = applyCapAndAdd(econ.Stockpile.Oil, produced.Oil, econ.ResourceCap, &cappedResources, ResOil)
	econ.Stockpile.Minerals = applyCapAndAdd(econ.Stockpile.Minerals, produced.Minerals, econ.ResourceCap, &cappedResources, ResMinerals)
	econ.Stockpile.Food = applyCapAndAdd(econ.Stockpile.Food, produced.Food, econ.ResourceCap, &cappedResources, ResFood)
	econ.Stockpile.Tech = applyCapAndAdd(econ.Stockpile.Tech, produced.Tech, econ.ResourceCap, &cappedResources, ResTech)
	econ.Stockpile.Influence = applyCapAndAdd(econ.Stockpile.Influence, produced.Influence, econ.ResourceCap, &cappedResources, ResInfluence)
	result.CappedResources = cappedResources

	// Step 4: Distribute resources (faction 50%, sovereign 30%, participants 20%)
	factionPortion := scaleBundle(produced, ee.config.FactionShare)
	sovereignPortion := scaleBundle(produced, ee.config.SovereignShare)
	participantPortion := scaleBundle(produced, ee.config.ParticipantShare)

	result.FactionDeposit = factionPortion
	result.SovereignDeposit = sovereignPortion
	result.ParticipantPool = participantPortion

	// Step 5: Deposit to faction treasury
	if ee.factionManager != nil && econ.SovereignFaction != "" {
		// Faction share goes to faction treasury
		_ = ee.factionManager.DepositToTreasury(econ.SovereignFaction, factionPortion)

		// Sovereign leader share — deposited as faction gold (leader can withdraw)
		_ = ee.factionManager.DepositToTreasury(econ.SovereignFaction, sovereignPortion)
	}

	// Participant pool: split equally among battle participants
	participants := ee.battleParticipants[iso]
	if len(participants) > 0 && ee.factionManager != nil {
		perPerson := scaleBundle(participantPortion, 1.0/float64(len(participants)))
		for _, uid := range participants {
			fid := ee.factionManager.GetUserFaction(uid)
			if fid != "" {
				_ = ee.factionManager.DepositToTreasury(fid, perPerson)
			}
		}
	}

	// Step 6: Apply tax as Gold income
	taxGold := int64(float64(produced.Oil+produced.Minerals+produced.Food+produced.Tech) * econ.TaxRate)
	if ee.factionManager != nil && econ.SovereignFaction != "" {
		_ = ee.factionManager.DepositToTreasury(econ.SovereignFaction, ResourceBundle{Gold: taxGold})
	}

	// Step 7: Calculate GDP
	econ.PrevGDP = econ.GDP
	econ.GDP = ee.calculateGDP(econ)
	econ.GDPDelta = econ.GDP - econ.PrevGDP
	result.GDPAfter = econ.GDP

	// Step 8: Record GDP history
	ee.recordGDPSnapshot(iso, econ.GDP, now)

	econ.LastTickAt = now

	return result
}

// calculateGDP computes the GDP for a country.
// GDP = Sum(resource_production * market_price) + trade_income - military_cost
func (ee *EconomyEngine) calculateGDP(econ *CountryEconomy) int64 {
	prod := econ.EffectiveProduction

	gdp := float64(prod.Oil) * ee.marketPrices[ResOil]
	gdp += float64(prod.Minerals) * ee.marketPrices[ResMinerals]
	gdp += float64(prod.Food) * ee.marketPrices[ResFood]
	gdp += float64(prod.Tech) * ee.marketPrices[ResTech]
	gdp += float64(prod.Influence) * ee.marketPrices[ResInfluence]

	// Trade openness bonus: more open = more GDP from trade
	tradeBonus := 1.0 + (econ.TradeOpenness * 0.3)
	gdp *= tradeBonus

	// Military cost: deducted from GDP
	militaryCost := gdp * econ.MilitarySpend * 0.5
	gdp -= militaryCost

	// Tech investment: long-term GDP multiplier
	techBonus := 1.0 + (econ.TechInvest * 0.5)
	gdp *= techBonus

	return int64(gdp)
}

// recordGDPSnapshot adds a GDP snapshot to history. Keeps last 168 entries (1 week at hourly ticks).
func (ee *EconomyEngine) recordGDPSnapshot(iso string, gdp int64, t time.Time) {
	const maxHistory = 168 // 7 days * 24 hours

	ee.gdpHistory[iso] = append(ee.gdpHistory[iso], GDPSnapshot{
		Timestamp: t,
		GDP:       gdp,
	})

	if len(ee.gdpHistory[iso]) > maxHistory {
		ee.gdpHistory[iso] = ee.gdpHistory[iso][len(ee.gdpHistory[iso])-maxHistory:]
	}
}

// processTributePayments processes tribute transfers from diplomacy.
func (ee *EconomyEngine) processTributePayments() {
	if ee.diplomacyEngine == nil || ee.factionManager == nil {
		return
	}

	transfers := ee.diplomacyEngine.ProcessTributeTick()
	for _, t := range transfers {
		// Withdraw from payer
		err := ee.factionManager.WithdrawFromTreasury(t.PayerFaction, t.Resources)
		if err != nil {
			slog.Warn("tribute payment failed (insufficient funds)",
				"payer", t.PayerFaction,
				"receiver", t.ReceiverFaction,
				"error", err,
			)
			continue
		}
		// Deposit to receiver
		_ = ee.factionManager.DepositToTreasury(t.ReceiverFaction, t.Resources)

		slog.Info("tribute paid",
			"from", t.PayerFaction,
			"to", t.ReceiverFaction,
			"gold", t.Resources.Gold,
		)
	}
}

// --- Persistence ---

// SetStore sets the optional persistence store and starts the flush goroutine.
func (ee *EconomyEngine) SetStore(s EconomyStore) {
	ee.mu.Lock()
	defer ee.mu.Unlock()
	ee.store = s
}

// FlushDirtyCountries writes dirty GDP values to the database.
func (ee *EconomyEngine) FlushDirtyCountries() {
	if ee.store == nil {
		return
	}

	ee.mu.Lock()
	dirty := make(map[string]int64)
	for iso := range ee.dirtyCountries {
		if econ, ok := ee.economies[iso]; ok {
			dirty[iso] = econ.GDP
		}
	}
	ee.dirtyCountries = make(map[string]bool)
	ee.mu.Unlock()

	if len(dirty) == 0 {
		return
	}

	for iso, gdp := range dirty {
		if err := ee.store.UpdateGDP(iso, gdp); err != nil {
			slog.Warn("flush GDP failed", "country", iso, "error", err)
		}
	}
	slog.Info("economy batch flush complete", "countries", len(dirty))
}

// --- Queries ---

// GetGDPRanking returns countries sorted by GDP descending.
func (ee *EconomyEngine) GetGDPRanking() []CountryGDP {
	ee.mu.RLock()
	defer ee.mu.RUnlock()

	ranking := make([]CountryGDP, 0, len(ee.economies))
	for iso, econ := range ee.economies {
		ranking = append(ranking, CountryGDP{
			CountryISO: iso,
			GDP:        econ.GDP,
		})
	}

	sort.Slice(ranking, func(i, j int) bool {
		return ranking[i].GDP > ranking[j].GDP
	})

	return ranking
}

// GetFactionGDPRanking returns factions sorted by total GDP of their territories.
func (ee *EconomyEngine) GetFactionGDPRanking() []FactionGDP {
	ee.mu.RLock()
	defer ee.mu.RUnlock()

	factionGDP := make(map[string]int64)
	factionCountries := make(map[string]int)

	for _, econ := range ee.economies {
		if econ.SovereignFaction != "" {
			factionGDP[econ.SovereignFaction] += econ.GDP
			factionCountries[econ.SovereignFaction]++
		}
	}

	ranking := make([]FactionGDP, 0, len(factionGDP))
	for fid, gdp := range factionGDP {
		ranking = append(ranking, FactionGDP{
			FactionID:    fid,
			TotalGDP:     gdp,
			CountryCount: factionCountries[fid],
		})
	}

	sort.Slice(ranking, func(i, j int) bool {
		return ranking[i].TotalGDP > ranking[j].TotalGDP
	})

	return ranking
}

// CountryGDP holds a country's GDP for ranking.
type CountryGDP struct {
	CountryISO string `json:"country_iso"`
	GDP        int64  `json:"gdp"`
}

// FactionGDP holds a faction's total GDP for ranking.
type FactionGDP struct {
	FactionID    string `json:"faction_id"`
	TotalGDP     int64  `json:"total_gdp"`
	CountryCount int    `json:"country_count"`
}

// GetGDPHistory returns the GDP history for a country.
func (ee *EconomyEngine) GetGDPHistory(iso3 string) []GDPSnapshot {
	ee.mu.RLock()
	defer ee.mu.RUnlock()

	history := ee.gdpHistory[iso3]
	result := make([]GDPSnapshot, len(history))
	copy(result, history)
	return result
}

// GetTotalWorldGDP returns the sum of all country GDPs.
func (ee *EconomyEngine) GetTotalWorldGDP() int64 {
	ee.mu.RLock()
	defer ee.mu.RUnlock()

	var total int64
	for _, econ := range ee.economies {
		total += econ.GDP
	}
	return total
}

// GetCountryStockpile returns the current resource stockpile for a country.
func (ee *EconomyEngine) GetCountryStockpile(iso3 string) *ResourceBundle {
	ee.mu.RLock()
	defer ee.mu.RUnlock()

	econ, ok := ee.economies[iso3]
	if !ok {
		return nil
	}
	copy := econ.Stockpile
	return &copy
}

// SetPolicy updates economic policy for a country.
// Only the sovereign faction's Council+ members should call this.
func (ee *EconomyEngine) SetPolicy(iso3 string, taxRate, tradeOpenness, militarySpend, techInvest float64) error {
	ee.mu.Lock()
	defer ee.mu.Unlock()

	econ, ok := ee.economies[iso3]
	if !ok {
		return fmt.Errorf("country %s not initialized", iso3)
	}

	// Clamp values to allowed ranges
	econ.TaxRate = clamp(taxRate, 0, 0.50)
	econ.TradeOpenness = clamp(tradeOpenness, 0, 1.0)
	econ.MilitarySpend = clamp(militarySpend, 0, 0.50)
	econ.TechInvest = clamp(techInvest, 0, 0.30)

	// Recalculate production with new policies
	ee.recalcEffectiveProduction(econ)

	slog.Info("economic policy updated",
		"country", iso3,
		"tax", econ.TaxRate,
		"trade", econ.TradeOpenness,
		"military", econ.MilitarySpend,
		"tech", econ.TechInvest,
	)
	return nil
}

// GetTickCount returns the number of economy ticks processed.
func (ee *EconomyEngine) GetTickCount() int64 {
	ee.mu.RLock()
	defer ee.mu.RUnlock()
	return ee.tickCount
}

// --- Helpers ---

// scaleBundle multiplies every field of a ResourceBundle by a float fraction.
func scaleBundle(b ResourceBundle, fraction float64) ResourceBundle {
	return ResourceBundle{
		Gold:      int64(float64(b.Gold) * fraction),
		Oil:       int64(float64(b.Oil) * fraction),
		Minerals:  int64(float64(b.Minerals) * fraction),
		Food:      int64(float64(b.Food) * fraction),
		Tech:      int64(float64(b.Tech) * fraction),
		Influence: int64(float64(b.Influence) * fraction),
	}
}

// applyCapAndAdd adds production to current and caps the result.
func applyCapAndAdd(current, add, cap int64, capped *[]ResourceType, resType ResourceType) int64 {
	result := current + add
	if result > cap {
		*capped = append(*capped, resType)
		return cap
	}
	return result
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
