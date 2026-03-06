package meta

import (
	"net/http"
	"sort"
	"strconv"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
)

// GDPFormula encodes the GDP calculation constants.
// GDP = Sum(resource_production * market_price) * trade_bonus * tech_bonus - military_cost
type GDPFormula struct {
	TradeOpennessFactor float64 // GDP multiplier from trade openness (default: 0.3)
	MilitaryCostFactor  float64 // GDP reduction from military spending (default: 0.5)
	TechBonusFactor     float64 // GDP multiplier from tech investment (default: 0.5)
	TaxDragFactor       float64 // GDP drag from high taxes (default: 0.1)
	CapitalBonusFactor  float64 // GDP bonus for capital cities (default: 0.5)
}

// DefaultGDPFormula returns the default GDP calculation formula.
func DefaultGDPFormula() GDPFormula {
	return GDPFormula{
		TradeOpennessFactor: 0.3,
		MilitaryCostFactor:  0.5,
		TechBonusFactor:     0.5,
		TaxDragFactor:       0.1,
		CapitalBonusFactor:  0.5,
	}
}

// GDPBreakdown shows how GDP was calculated for transparency.
type GDPBreakdown struct {
	CountryISO       string  `json:"country_iso"`
	BaseProduction   int64   `json:"base_production"`     // Sum of raw resource production
	MarketValue      float64 `json:"market_value"`        // Production * market prices
	TradeBonusPct    float64 `json:"trade_bonus_pct"`     // Trade openness bonus %
	TechBonusPct     float64 `json:"tech_bonus_pct"`      // Tech investment bonus %
	MilitaryCostPct  float64 `json:"military_cost_pct"`   // Military spending cost %
	TaxDragPct       float64 `json:"tax_drag_pct"`        // Tax drag %
	CapitalBonus     bool    `json:"capital_bonus"`        // Capital city bonus applied
	FinalGDP         int64   `json:"final_gdp"`
}

// FactionEconomicReport aggregates GDP data for a faction.
type FactionEconomicReport struct {
	FactionID       string `json:"faction_id"`
	FactionName     string `json:"faction_name,omitempty"`
	TotalGDP        int64  `json:"total_gdp"`
	CountryCount    int    `json:"country_count"`
	AvgGDPPerCountry int64 `json:"avg_gdp_per_country"`
	TopCountryISO   string `json:"top_country_iso"`
	TopCountryGDP   int64  `json:"top_country_gdp"`
	GDPGrowth       int64  `json:"gdp_growth"`
	Rank            int    `json:"rank"`
}

// WorldEconomicSummary provides a global economic overview.
type WorldEconomicSummary struct {
	TotalWorldGDP       int64                  `json:"total_world_gdp"`
	TotalCountries      int                    `json:"total_countries"`
	ControlledCountries int                    `json:"controlled_countries"`
	TopCountries        []CountryGDP           `json:"top_countries"`
	TopFactions         []FactionEconomicReport `json:"top_factions"`
	ResourcePrices      map[ResourceType]float64 `json:"resource_prices"`
	Timestamp           time.Time              `json:"timestamp"`
}

// GDPTimeSeriesPoint is a point in a GDP time series for graphing.
type GDPTimeSeriesPoint struct {
	Timestamp int64 `json:"t"` // Unix ms
	GDP       int64 `json:"v"` // GDP value
}

// GDPEngine provides GDP calculation, ranking, and history services.
// It wraps the EconomyEngine's GDP data with additional analytics and API routes.
type GDPEngine struct {
	mu sync.RWMutex

	formula GDPFormula
	economy *EconomyEngine
	factions *FactionManager
	trade   *TradeEngine

	// Cached faction GDP rankings (recalculated each tick)
	cachedFactionRanking []FactionEconomicReport
	lastRankingUpdate    time.Time

	// World GDP history (one snapshot per tick)
	worldGDPHistory []GDPSnapshot
}

// NewGDPEngine creates a new GDP engine.
func NewGDPEngine(formula GDPFormula, economy *EconomyEngine, factions *FactionManager, trade *TradeEngine) *GDPEngine {
	return &GDPEngine{
		formula:          formula,
		economy:          economy,
		factions:         factions,
		trade:            trade,
		worldGDPHistory:  make([]GDPSnapshot, 0, 168),
	}
}

// CalculateGDPBreakdown computes a detailed GDP breakdown for a country.
func (ge *GDPEngine) CalculateGDPBreakdown(iso3 string) *GDPBreakdown {
	econ := ge.economy.GetEconomy(iso3)
	if econ == nil {
		return nil
	}

	prices := ge.economy.GetMarketPrices()

	prod := econ.EffectiveProduction
	baseProd := prod.Oil + prod.Minerals + prod.Food + prod.Tech + prod.Influence

	// Market value
	marketValue := float64(prod.Oil) * prices[ResOil]
	marketValue += float64(prod.Minerals) * prices[ResMinerals]
	marketValue += float64(prod.Food) * prices[ResFood]
	marketValue += float64(prod.Tech) * prices[ResTech]
	marketValue += float64(prod.Influence) * prices[ResInfluence]

	tradeBonus := econ.TradeOpenness * ge.formula.TradeOpennessFactor
	techBonus := econ.TechInvest * ge.formula.TechBonusFactor
	militaryCost := econ.MilitarySpend * ge.formula.MilitaryCostFactor
	taxDrag := econ.TaxRate * ge.formula.TaxDragFactor

	gdp := marketValue * (1 + tradeBonus) * (1 + techBonus)
	gdp -= gdp * militaryCost
	gdp -= gdp * taxDrag

	return &GDPBreakdown{
		CountryISO:      iso3,
		BaseProduction:  baseProd,
		MarketValue:     marketValue,
		TradeBonusPct:   tradeBonus * 100,
		TechBonusPct:    techBonus * 100,
		MilitaryCostPct: militaryCost * 100,
		TaxDragPct:      taxDrag * 100,
		CapitalBonus:    false,
		FinalGDP:        int64(gdp),
	}
}

// UpdateRankings recalculates the faction GDP ranking.
// Should be called after each economy tick.
func (ge *GDPEngine) UpdateRankings() {
	ge.mu.Lock()
	defer ge.mu.Unlock()

	economies := ge.economy.GetAllEconomies()

	// Aggregate by faction
	factionData := make(map[string]*FactionEconomicReport)
	for iso, econ := range economies {
		if econ.SovereignFaction == "" {
			continue
		}
		fid := econ.SovereignFaction
		report, ok := factionData[fid]
		if !ok {
			report = &FactionEconomicReport{
				FactionID: fid,
			}
			factionData[fid] = report
		}
		report.TotalGDP += econ.GDP
		report.CountryCount++

		if econ.GDP > report.TopCountryGDP {
			report.TopCountryGDP = econ.GDP
			report.TopCountryISO = iso
		}
	}

	// Calculate averages and set names
	ranking := make([]FactionEconomicReport, 0, len(factionData))
	for _, report := range factionData {
		if report.CountryCount > 0 {
			report.AvgGDPPerCountry = report.TotalGDP / int64(report.CountryCount)
		}
		if ge.factions != nil {
			if f := ge.factions.GetFaction(report.FactionID); f != nil {
				report.FactionName = f.Name
			}
		}
		ranking = append(ranking, *report)
	}

	// Sort by total GDP descending
	sort.Slice(ranking, func(i, j int) bool {
		return ranking[i].TotalGDP > ranking[j].TotalGDP
	})

	// Assign ranks
	for i := range ranking {
		ranking[i].Rank = i + 1
	}

	ge.cachedFactionRanking = ranking
	ge.lastRankingUpdate = time.Now()

	// Record world GDP history
	totalWorldGDP := ge.economy.GetTotalWorldGDP()
	ge.worldGDPHistory = append(ge.worldGDPHistory, GDPSnapshot{
		Timestamp: time.Now(),
		GDP:       totalWorldGDP,
	})
	const maxWorldHistory = 168
	if len(ge.worldGDPHistory) > maxWorldHistory {
		ge.worldGDPHistory = ge.worldGDPHistory[len(ge.worldGDPHistory)-maxWorldHistory:]
	}
}

// GetFactionRanking returns the cached faction GDP ranking.
func (ge *GDPEngine) GetFactionRanking() []FactionEconomicReport {
	ge.mu.RLock()
	defer ge.mu.RUnlock()

	result := make([]FactionEconomicReport, len(ge.cachedFactionRanking))
	copy(result, ge.cachedFactionRanking)
	return result
}

// GetWorldSummary returns a comprehensive world economic summary.
func (ge *GDPEngine) GetWorldSummary() WorldEconomicSummary {
	economies := ge.economy.GetAllEconomies()
	prices := ge.economy.GetMarketPrices()

	var totalGDP int64
	controlled := 0
	for _, econ := range economies {
		totalGDP += econ.GDP
		if econ.SovereignFaction != "" {
			controlled++
		}
	}

	// Top countries
	topCountries := ge.economy.GetGDPRanking()
	if len(topCountries) > 10 {
		topCountries = topCountries[:10]
	}

	// Top factions
	topFactions := ge.GetFactionRanking()
	if len(topFactions) > 10 {
		topFactions = topFactions[:10]
	}

	return WorldEconomicSummary{
		TotalWorldGDP:       totalGDP,
		TotalCountries:      len(economies),
		ControlledCountries: controlled,
		TopCountries:        topCountries,
		TopFactions:         topFactions,
		ResourcePrices:      prices,
		Timestamp:           time.Now(),
	}
}

// GetCountryGDPTimeSeries returns GDP history for a country as a time series (for charts).
func (ge *GDPEngine) GetCountryGDPTimeSeries(iso3 string) []GDPTimeSeriesPoint {
	history := ge.economy.GetGDPHistory(iso3)

	points := make([]GDPTimeSeriesPoint, len(history))
	for i, h := range history {
		points[i] = GDPTimeSeriesPoint{
			Timestamp: h.Timestamp.UnixMilli(),
			GDP:       h.GDP,
		}
	}
	return points
}

// GetWorldGDPTimeSeries returns world GDP history as a time series.
func (ge *GDPEngine) GetWorldGDPTimeSeries() []GDPTimeSeriesPoint {
	ge.mu.RLock()
	defer ge.mu.RUnlock()

	points := make([]GDPTimeSeriesPoint, len(ge.worldGDPHistory))
	for i, h := range ge.worldGDPHistory {
		points[i] = GDPTimeSeriesPoint{
			Timestamp: h.Timestamp.UnixMilli(),
			GDP:       h.GDP,
		}
	}
	return points
}

// GetFactionGDPTimeSeries returns GDP history for a faction.
// Aggregates all controlled countries' GDP at each time point.
func (ge *GDPEngine) GetFactionGDPTimeSeries(factionID string) []GDPTimeSeriesPoint {
	economies := ge.economy.GetAllEconomies()

	// Collect all country ISOs controlled by this faction
	var controlledISOs []string
	for iso, econ := range economies {
		if econ.SovereignFaction == factionID {
			controlledISOs = append(controlledISOs, iso)
		}
	}

	if len(controlledISOs) == 0 {
		return nil
	}

	// Aggregate GDP history from all controlled countries
	// Use a map of timestamp → total GDP
	timeMap := make(map[int64]int64)
	for _, iso := range controlledISOs {
		history := ge.economy.GetGDPHistory(iso)
		for _, h := range history {
			key := h.Timestamp.UnixMilli() / (60 * 60 * 1000) * (60 * 60 * 1000) // Round to hour
			timeMap[key] += h.GDP
		}
	}

	// Convert to sorted slice
	points := make([]GDPTimeSeriesPoint, 0, len(timeMap))
	for t, gdp := range timeMap {
		points = append(points, GDPTimeSeriesPoint{Timestamp: t, GDP: gdp})
	}
	sort.Slice(points, func(i, j int) bool {
		return points[i].Timestamp < points[j].Timestamp
	})

	return points
}

// --- HTTP API ---

// GDPRoutes returns a chi.Router with GDP HTTP endpoints.
func (ge *GDPEngine) GDPRoutes() chi.Router {
	r := chi.NewRouter()

	r.Get("/summary", ge.handleGetSummary)
	r.Get("/ranking/countries", ge.handleGetCountryRanking)
	r.Get("/ranking/factions", ge.handleGetFactionRanking)
	r.Get("/country/{countryISO}", ge.handleGetCountryGDP)
	r.Get("/country/{countryISO}/breakdown", ge.handleGetBreakdown)
	r.Get("/country/{countryISO}/history", ge.handleGetCountryHistory)
	r.Get("/faction/{factionID}/history", ge.handleGetFactionHistory)
	r.Get("/world/history", ge.handleGetWorldHistory)

	return r
}

// handleGetSummary — GET /api/economy/gdp/summary
func (ge *GDPEngine) handleGetSummary(w http.ResponseWriter, r *http.Request) {
	summary := ge.GetWorldSummary()
	writeJSON(w, http.StatusOK, summary)
}

// handleGetCountryRanking — GET /api/economy/gdp/ranking/countries?limit=20
func (ge *GDPEngine) handleGetCountryRanking(w http.ResponseWriter, r *http.Request) {
	limit := 50
	if l, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil && l > 0 {
		limit = l
	}

	ranking := ge.economy.GetGDPRanking()
	if len(ranking) > limit {
		ranking = ranking[:limit]
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"ranking": ranking,
		"count":   len(ranking),
	})
}

// handleGetFactionRanking — GET /api/economy/gdp/ranking/factions
func (ge *GDPEngine) handleGetFactionRanking(w http.ResponseWriter, r *http.Request) {
	ranking := ge.GetFactionRanking()
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"ranking": ranking,
		"count":   len(ranking),
	})
}

// handleGetCountryGDP — GET /api/economy/gdp/country/{countryISO}
func (ge *GDPEngine) handleGetCountryGDP(w http.ResponseWriter, r *http.Request) {
	iso := chi.URLParam(r, "countryISO")
	econ := ge.economy.GetEconomy(iso)
	if econ == nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "country not found"})
		return
	}

	breakdown := ge.CalculateGDPBreakdown(iso)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"country_iso": iso,
		"gdp":         econ.GDP,
		"prev_gdp":    econ.PrevGDP,
		"gdp_delta":   econ.GDPDelta,
		"breakdown":   breakdown,
	})
}

// handleGetBreakdown — GET /api/economy/gdp/country/{countryISO}/breakdown
func (ge *GDPEngine) handleGetBreakdown(w http.ResponseWriter, r *http.Request) {
	iso := chi.URLParam(r, "countryISO")
	breakdown := ge.CalculateGDPBreakdown(iso)
	if breakdown == nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "country not found"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"breakdown": breakdown,
	})
}

// handleGetCountryHistory — GET /api/economy/gdp/country/{countryISO}/history
func (ge *GDPEngine) handleGetCountryHistory(w http.ResponseWriter, r *http.Request) {
	iso := chi.URLParam(r, "countryISO")
	series := ge.GetCountryGDPTimeSeries(iso)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"country_iso": iso,
		"series":      series,
		"points":      len(series),
	})
}

// handleGetFactionHistory — GET /api/economy/gdp/faction/{factionID}/history
func (ge *GDPEngine) handleGetFactionHistory(w http.ResponseWriter, r *http.Request) {
	factionID := chi.URLParam(r, "factionID")
	series := ge.GetFactionGDPTimeSeries(factionID)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"faction_id": factionID,
		"series":     series,
		"points":     len(series),
	})
}

// handleGetWorldHistory — GET /api/economy/gdp/world/history
func (ge *GDPEngine) handleGetWorldHistory(w http.ResponseWriter, r *http.Request) {
	series := ge.GetWorldGDPTimeSeries()
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"series": series,
		"points": len(series),
	})
}
