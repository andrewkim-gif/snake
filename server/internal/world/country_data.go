package world

import "math"

// CountryTier represents the strategic importance tier of a country.
type CountryTier string

const (
	TierS CountryTier = "S" // Superpower (8 countries)
	TierA CountryTier = "A" // Major (20 countries)
	TierB CountryTier = "B" // Regional (40 countries)
	TierC CountryTier = "C" // Standard (80 countries)
	TierD CountryTier = "D" // Minor (~47 countries)
)

// TierConfig holds per-tier arena and gameplay settings.
type TierConfig struct {
	ArenaRadius   float64
	MaxAgents     int
	ResourceScale float64
}

// TierConfigs maps each tier to its configuration.
var TierConfigs = map[CountryTier]TierConfig{
	TierS: {ArenaRadius: 6000, MaxAgents: 50, ResourceScale: 3.0},
	TierA: {ArenaRadius: 4500, MaxAgents: 35, ResourceScale: 2.0},
	TierB: {ArenaRadius: 3500, MaxAgents: 25, ResourceScale: 1.5},
	TierC: {ArenaRadius: 2500, MaxAgents: 15, ResourceScale: 1.0},
	TierD: {ArenaRadius: 1500, MaxAgents: 8, ResourceScale: 0.5},
}

// Resources represents a country's resource profile (0-100 normalized).
type Resources struct {
	Oil      int `json:"oil"`
	Minerals int `json:"minerals"`
	Food     int `json:"food"`
	Tech     int `json:"tech"`
	Manpower int `json:"manpower"`
}

// tierReferencePop maps each tier to the population at which a country
// receives 100% of that tier's MaxAgents. Countries with smaller populations
// get a proportionally reduced share (down to 30% minimum).
var tierReferencePop = map[CountryTier]int64{
	TierS: 330_000_000, // USA baseline
	TierA: 100_000_000,
	TierB: 50_000_000,
	TierC: 20_000_000,
	TierD: 5_000_000,
}

// CalcMaxAgents computes the population-adjusted max agents within the tier range.
// Formula: floor(tierMax * clamp(log10(pop/1e6) / log10(tierRefPop/1e6), 0.3, 1.0))
// Minimum guarantee: max(result, 5)
func CalcMaxAgents(tier CountryTier, population int64) int {
	cfg, ok := TierConfigs[tier]
	if !ok {
		return 5
	}
	refPop, ok := tierReferencePop[tier]
	if !ok {
		return cfg.MaxAgents
	}

	if population <= 0 {
		result := int(float64(cfg.MaxAgents) * 0.3)
		if result < 5 {
			return 5
		}
		return result
	}

	ratio := math.Log10(float64(population)/1e6) / math.Log10(float64(refPop)/1e6)
	clamped := math.Max(0.3, math.Min(1.0, ratio))
	result := int(math.Floor(float64(cfg.MaxAgents) * clamped))
	if result < 5 {
		return 5
	}
	return result
}

// CountrySeed holds static data for seeding a country into the database.
type CountrySeed struct {
	ISO3         string
	Name         string
	Continent    string
	Tier         CountryTier
	Resources    Resources
	Latitude     float64
	Longitude    float64
	CapitalName  string
	Population   int64
	TerrainTheme string
	Adjacency    []string // ISO3 codes of adjacent countries
}
