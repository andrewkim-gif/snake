package world

import (
	"log/slog"
	"sync"
)

// ContinentID is a canonical identifier for a continent.
type ContinentID string

const (
	ContinentAsia         ContinentID = "Asia"
	ContinentEurope       ContinentID = "Europe"
	ContinentAfrica       ContinentID = "Africa"
	ContinentNorthAmerica ContinentID = "North America"
	ContinentSouthAmerica ContinentID = "South America"
	ContinentOceania      ContinentID = "Oceania"
)

// AllContinents lists every continent.
var AllContinents = []ContinentID{
	ContinentAsia, ContinentEurope, ContinentAfrica,
	ContinentNorthAmerica, ContinentSouthAmerica, ContinentOceania,
}

// ContinentalBonusDef defines the requirements and rewards for a continental bonus.
type ContinentalBonusDef struct {
	ContinentID      ContinentID `json:"continent_id"`
	RequiredCountries int        `json:"required_countries"` // Minimum dominated countries
	BonusType        string      `json:"bonus_type"`         // Which resource/stat gets boosted
	BonusMultiplier  float64     `json:"bonus_multiplier"`   // Multiplier applied to all faction territories
	Title            string      `json:"title"`              // Prestige title awarded
	Description      string      `json:"description"`
}

// DefaultContinentalBonuses returns the bonus definitions for all continents.
func DefaultContinentalBonuses() []ContinentalBonusDef {
	return []ContinentalBonusDef{
		{
			ContinentID:      ContinentAsia,
			RequiredCountries: 10,
			BonusType:        "tech_production",
			BonusMultiplier:  1.5,
			Title:            "Lord of the East",
			Description:      "Tech production x1.5 across all territories",
		},
		{
			ContinentID:      ContinentEurope,
			RequiredCountries: 15,
			BonusType:        "influence_production",
			BonusMultiplier:  1.5,
			Title:            "Emperor of Europe",
			Description:      "Influence production x1.5 across all territories",
		},
		{
			ContinentID:      ContinentAfrica,
			RequiredCountries: 15,
			BonusType:        "minerals_production",
			BonusMultiplier:  2.0,
			Title:            "Heart of Africa",
			Description:      "Steel + Minerals production x2 across all territories",
		},
		{
			ContinentID:      ContinentNorthAmerica,
			RequiredCountries: 5,
			BonusType:        "food_oil_production",
			BonusMultiplier:  1.5,
			Title:            "King of the New World (North)",
			Description:      "Food + Oil production x1.5 across all territories",
		},
		{
			ContinentID:      ContinentSouthAmerica,
			RequiredCountries: 5,
			BonusType:        "food_oil_production",
			BonusMultiplier:  1.5,
			Title:            "King of the New World (South)",
			Description:      "Food + Oil production x1.5 across all territories",
		},
		{
			ContinentID:      ContinentOceania,
			RequiredCountries: 3,
			BonusType:        "minerals_production",
			BonusMultiplier:  1.5,
			Title:            "Pacific Overlord",
			Description:      "Minerals production x1.5 across all territories",
		},
	}
}

// WorldDominationBonusDef defines the requirements for world domination.
var WorldDominationBonusDef = ContinentalBonusDef{
	ContinentID:      "world",
	RequiredCountries: 100,
	BonusType:        "all_resources",
	BonusMultiplier:  2.0,
	Title:            "World Emperor",
	Description:      "All resources x2, combat stats +10%",
}

// ChokePoint defines a strategic chokepoint that collects trade fees.
type ChokePoint struct {
	ID              string      `json:"id"`
	Name            string      `json:"name"`
	CountryISO      string      `json:"country_iso"`      // Which country controls it
	FeeRate         float64     `json:"fee_rate"`          // Trade fee percentage (0.10 = 10%)
	TradeRoute      string      `json:"trade_route"`       // Description of what it controls
	AffectedRegions []string    `json:"affected_regions"`  // Which continents/regions are affected
}

// DefaultChokePoints returns the strategic chokepoint definitions.
func DefaultChokePoints() []ChokePoint {
	return []ChokePoint{
		{
			ID:              "panama",
			Name:            "Panama Canal",
			CountryISO:      "PAN",
			FeeRate:         0.10,
			TradeRoute:      "Americas <-> Asia maritime trade",
			AffectedRegions: []string{"North America", "South America", "Asia"},
		},
		{
			ID:              "suez",
			Name:            "Suez Canal",
			CountryISO:      "EGY",
			FeeRate:         0.10,
			TradeRoute:      "Europe <-> Asia maritime trade",
			AffectedRegions: []string{"Europe", "Asia", "Africa"},
		},
		{
			ID:              "malacca",
			Name:            "Strait of Malacca",
			CountryISO:      "MYS",
			FeeRate:         0.10,
			TradeRoute:      "Southeast Asia <-> East Asia maritime trade",
			AffectedRegions: []string{"Asia", "Oceania"},
		},
		{
			ID:              "hormuz",
			Name:            "Strait of Hormuz",
			CountryISO:      "OMN",
			FeeRate:         0.15,
			TradeRoute:      "Middle East oil export route",
			AffectedRegions: []string{"Asia", "Europe"},
		},
	}
}

// FactionContinentalStatus tracks a faction's domination status on a continent.
type FactionContinentalStatus struct {
	ContinentID      ContinentID `json:"continent_id"`
	DominatedCountries int       `json:"dominated_countries"`
	TotalCountries   int         `json:"total_countries"`
	BonusActive      bool        `json:"bonus_active"`
	Title            string      `json:"title,omitempty"`
}

// FactionTitle represents a title awarded for continental/world domination.
type FactionTitle struct {
	FactionID   string      `json:"faction_id"`
	Title       string      `json:"title"`
	ContinentID ContinentID `json:"continent_id"`
	AwardedAt   int64       `json:"awarded_at"` // Unix timestamp
}

// ContinentalBonusEngine manages continental bonuses, chokepoints, and titles.
type ContinentalBonusEngine struct {
	mu sync.RWMutex

	bonusDefs   []ContinentalBonusDef
	chokePoints []ChokePoint

	// Country → continent mapping
	countryContinentMap map[string]ContinentID

	// Continent → list of country ISO3 codes
	continentCountries map[ContinentID][]string

	// Computed: factionID → continentID → number of dominated countries
	factionDomination map[string]map[ContinentID]int

	// Active bonuses: factionID → list of active bonus defs
	activeBonuses map[string][]ContinentalBonusDef

	// Active titles
	titles map[string][]FactionTitle // factionID → titles

	// Chokepoint control: chokepoint ID → controlling faction ID
	chokepointControl map[string]string

	// External: lookup sovereign faction for a country
	sovereigntyLookup func(countryISO string) string
}

// NewContinentalBonusEngine creates a new continental bonus engine.
func NewContinentalBonusEngine() *ContinentalBonusEngine {
	engine := &ContinentalBonusEngine{
		bonusDefs:          DefaultContinentalBonuses(),
		chokePoints:        DefaultChokePoints(),
		countryContinentMap: make(map[string]ContinentID),
		continentCountries: make(map[ContinentID][]string),
		factionDomination:  make(map[string]map[ContinentID]int),
		activeBonuses:      make(map[string][]ContinentalBonusDef),
		titles:             make(map[string][]FactionTitle),
		chokepointControl:  make(map[string]string),
	}

	// Build country-continent mapping from AllCountries seed data
	for _, country := range AllCountries {
		continent := ContinentID(country.Continent)
		engine.countryContinentMap[country.ISO3] = continent
		engine.continentCountries[continent] = append(engine.continentCountries[continent], country.ISO3)
	}

	return engine
}

// SetSovereigntyLookup sets the function to look up sovereign factions.
func (cbe *ContinentalBonusEngine) SetSovereigntyLookup(fn func(countryISO string) string) {
	cbe.mu.Lock()
	defer cbe.mu.Unlock()
	cbe.sovereigntyLookup = fn
}

// Recalculate recomputes all continental domination counts, bonuses, titles, and chokepoint control.
// Should be called whenever sovereignty changes.
func (cbe *ContinentalBonusEngine) Recalculate() {
	cbe.mu.Lock()
	defer cbe.mu.Unlock()

	if cbe.sovereigntyLookup == nil {
		return
	}

	// Reset
	cbe.factionDomination = make(map[string]map[ContinentID]int)
	factionTotalCountries := make(map[string]int)

	// Count domination per faction per continent
	for iso, continent := range cbe.countryContinentMap {
		factionID := cbe.sovereigntyLookup(iso)
		if factionID == "" {
			continue
		}

		if cbe.factionDomination[factionID] == nil {
			cbe.factionDomination[factionID] = make(map[ContinentID]int)
		}
		cbe.factionDomination[factionID][continent]++
		factionTotalCountries[factionID]++
	}

	// Evaluate continental bonuses
	prevBonuses := cbe.activeBonuses
	cbe.activeBonuses = make(map[string][]ContinentalBonusDef)
	cbe.titles = make(map[string][]FactionTitle)

	for factionID, continentCounts := range cbe.factionDomination {
		for _, bonusDef := range cbe.bonusDefs {
			count := continentCounts[bonusDef.ContinentID]
			if count >= bonusDef.RequiredCountries {
				cbe.activeBonuses[factionID] = append(cbe.activeBonuses[factionID], bonusDef)
				cbe.titles[factionID] = append(cbe.titles[factionID], FactionTitle{
					FactionID:   factionID,
					Title:       bonusDef.Title,
					ContinentID: bonusDef.ContinentID,
				})

				// Log if newly acquired
				wasActive := false
				for _, prev := range prevBonuses[factionID] {
					if prev.ContinentID == bonusDef.ContinentID {
						wasActive = true
						break
					}
				}
				if !wasActive {
					slog.Info("continental bonus activated",
						"faction", factionID,
						"continent", bonusDef.ContinentID,
						"title", bonusDef.Title,
					)
				}
			}
		}

		// World domination check
		if factionTotalCountries[factionID] >= WorldDominationBonusDef.RequiredCountries {
			cbe.activeBonuses[factionID] = append(cbe.activeBonuses[factionID], WorldDominationBonusDef)
			cbe.titles[factionID] = append(cbe.titles[factionID], FactionTitle{
				FactionID:   factionID,
				Title:       WorldDominationBonusDef.Title,
				ContinentID: "world",
			})
		}
	}

	// Update chokepoint control
	for i, cp := range cbe.chokePoints {
		factionID := cbe.sovereigntyLookup(cp.CountryISO)
		cbe.chokepointControl[cp.ID] = factionID
		cbe.chokePoints[i].CountryISO = cp.CountryISO // preserve
	}
}

// --- Queries ---

// GetFactionBonuses returns all active continental bonuses for a faction.
func (cbe *ContinentalBonusEngine) GetFactionBonuses(factionID string) []ContinentalBonusDef {
	cbe.mu.RLock()
	defer cbe.mu.RUnlock()

	bonuses := cbe.activeBonuses[factionID]
	result := make([]ContinentalBonusDef, len(bonuses))
	copy(result, bonuses)
	return result
}

// GetFactionTitles returns all titles for a faction.
func (cbe *ContinentalBonusEngine) GetFactionTitles(factionID string) []FactionTitle {
	cbe.mu.RLock()
	defer cbe.mu.RUnlock()

	titles := cbe.titles[factionID]
	result := make([]FactionTitle, len(titles))
	copy(result, titles)
	return result
}

// HasContinentalBonus checks if a faction has a specific continental bonus active.
func (cbe *ContinentalBonusEngine) HasContinentalBonus(factionID string, bonusType string) bool {
	cbe.mu.RLock()
	defer cbe.mu.RUnlock()

	for _, b := range cbe.activeBonuses[factionID] {
		if b.BonusType == bonusType {
			return true
		}
	}
	return false
}

// GetResourceMultiplier returns the combined resource multiplier from
// continental bonuses for a faction. Used by the economy engine.
func (cbe *ContinentalBonusEngine) GetResourceMultiplier(factionID, resourceType string) float64 {
	cbe.mu.RLock()
	defer cbe.mu.RUnlock()

	mult := 1.0
	for _, b := range cbe.activeBonuses[factionID] {
		switch {
		case b.BonusType == "all_resources":
			mult *= b.BonusMultiplier
		case b.BonusType == "tech_production" && resourceType == "tech":
			mult *= b.BonusMultiplier
		case b.BonusType == "influence_production" && resourceType == "influence":
			mult *= b.BonusMultiplier
		case b.BonusType == "minerals_production" && (resourceType == "minerals"):
			mult *= b.BonusMultiplier
		case b.BonusType == "food_oil_production" && (resourceType == "food" || resourceType == "oil"):
			mult *= b.BonusMultiplier
		}
	}
	return mult
}

// GetCombatMultiplier returns the combat stat multiplier for a faction.
// World Emperor gets +10% combat stats.
func (cbe *ContinentalBonusEngine) GetCombatMultiplier(factionID string) float64 {
	cbe.mu.RLock()
	defer cbe.mu.RUnlock()

	for _, b := range cbe.activeBonuses[factionID] {
		if b.BonusType == "all_resources" { // World Domination
			return 1.10 // +10%
		}
	}
	return 1.0
}

// GetFactionContinentalStatus returns the domination status for a faction across all continents.
func (cbe *ContinentalBonusEngine) GetFactionContinentalStatus(factionID string) []FactionContinentalStatus {
	cbe.mu.RLock()
	defer cbe.mu.RUnlock()

	var status []FactionContinentalStatus
	domination := cbe.factionDomination[factionID]

	for _, def := range cbe.bonusDefs {
		count := 0
		if domination != nil {
			count = domination[def.ContinentID]
		}

		totalCountries := len(cbe.continentCountries[def.ContinentID])

		st := FactionContinentalStatus{
			ContinentID:      def.ContinentID,
			DominatedCountries: count,
			TotalCountries:   totalCountries,
			BonusActive:      count >= def.RequiredCountries,
		}
		if st.BonusActive {
			st.Title = def.Title
		}
		status = append(status, st)
	}

	return status
}

// --- Chokepoint Queries ---

// GetChokePoints returns all chokepoint definitions with current controllers.
func (cbe *ContinentalBonusEngine) GetChokePoints() []ChokePointStatus {
	cbe.mu.RLock()
	defer cbe.mu.RUnlock()

	result := make([]ChokePointStatus, len(cbe.chokePoints))
	for i, cp := range cbe.chokePoints {
		result[i] = ChokePointStatus{
			ChokePoint:         cp,
			ControllingFaction: cbe.chokepointControl[cp.ID],
		}
	}
	return result
}

// ChokePointStatus holds a chokepoint definition plus its current controller.
type ChokePointStatus struct {
	ChokePoint
	ControllingFaction string `json:"controlling_faction"`
}

// CalculateTradeFee calculates the chokepoint trade fee between two regions.
// Returns the total fee rate and the list of chokepoints that apply.
func (cbe *ContinentalBonusEngine) CalculateTradeFee(sellerContinent, buyerContinent string) (totalFee float64, feesCollected map[string]float64) {
	cbe.mu.RLock()
	defer cbe.mu.RUnlock()

	feesCollected = make(map[string]float64) // factionID → fee amount (rate)

	if sellerContinent == buyerContinent {
		return 0, feesCollected // Same continent, no chokepoint fee
	}

	for _, cp := range cbe.chokePoints {
		controllerFaction := cbe.chokepointControl[cp.ID]
		if controllerFaction == "" {
			continue
		}

		// Check if this chokepoint is on the trade route
		sellerInRegion := false
		buyerInRegion := false
		for _, region := range cp.AffectedRegions {
			if region == sellerContinent {
				sellerInRegion = true
			}
			if region == buyerContinent {
				buyerInRegion = true
			}
		}

		if sellerInRegion && buyerInRegion {
			totalFee += cp.FeeRate
			feesCollected[controllerFaction] += cp.FeeRate
		}
	}

	return totalFee, feesCollected
}

// GetChokepointController returns the faction controlling a specific chokepoint.
func (cbe *ContinentalBonusEngine) GetChokepointController(chokepointID string) string {
	cbe.mu.RLock()
	defer cbe.mu.RUnlock()
	return cbe.chokepointControl[chokepointID]
}

// GetCountryContinent returns the continent of a country.
func (cbe *ContinentalBonusEngine) GetCountryContinent(countryISO string) ContinentID {
	cbe.mu.RLock()
	defer cbe.mu.RUnlock()
	return cbe.countryContinentMap[countryISO]
}

// GetContinentCountries returns all country ISO3 codes in a continent.
func (cbe *ContinentalBonusEngine) GetContinentCountries(continent ContinentID) []string {
	cbe.mu.RLock()
	defer cbe.mu.RUnlock()

	countries := cbe.continentCountries[continent]
	result := make([]string, len(countries))
	copy(result, countries)
	return result
}
