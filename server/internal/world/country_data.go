package world

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
