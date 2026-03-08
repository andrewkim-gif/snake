package city

// ResourceType enumerates all 33 resources in the city simulation.
// 15 raw (Tier 1) + 12 processed (Tier 2) + 6 advanced (Tier 3).
type ResourceType string

// --- Tier 1: Raw Materials (15) ---
const (
	ResGrain      ResourceType = "grain"
	ResSugarcane  ResourceType = "sugarcane"
	ResTobacco    ResourceType = "tobacco"
	ResCotton     ResourceType = "cotton"
	ResCoffee     ResourceType = "coffee"
	ResFish       ResourceType = "fish"
	ResCattle     ResourceType = "cattle"
	ResIronOre    ResourceType = "iron_ore"
	ResBauxite    ResourceType = "bauxite"
	ResCoal       ResourceType = "coal"
	ResCrudeOil   ResourceType = "crude_oil"
	ResNaturalGas ResourceType = "natural_gas"
	ResTimber     ResourceType = "timber"
	ResRubber     ResourceType = "rubber"
	ResRareEarth  ResourceType = "rare_earth"
)

// --- Tier 2: Processed Goods (12) ---
const (
	ResFood       ResourceType = "food"
	ResSugar      ResourceType = "sugar"
	ResCigars     ResourceType = "cigars"
	ResTextiles   ResourceType = "textiles"
	ResSteel      ResourceType = "steel"
	ResAluminum   ResourceType = "aluminum"
	ResPlastics   ResourceType = "plastics"
	ResChemicals  ResourceType = "chemicals"
	ResFuel       ResourceType = "fuel"
	ResLumber     ResourceType = "lumber"
	ResElectronics ResourceType = "electronics"
	ResMachinery  ResourceType = "machinery"
)

// --- Tier 3: Advanced Products (6) ---
const (
	ResWeapons       ResourceType = "weapons"
	ResVehicles      ResourceType = "vehicles"
	ResPharmaceuticals ResourceType = "pharmaceuticals"
	ResLuxuryGoods   ResourceType = "luxury_goods"
	ResSemiconductors ResourceType = "semiconductors"
	ResAerospace     ResourceType = "aerospace"
)

// ResourceTier classifies a resource by production tier.
type ResourceTier int

const (
	Tier1Raw      ResourceTier = 1
	Tier2Processed ResourceTier = 2
	Tier3Advanced  ResourceTier = 3
)

// ResourceDef defines properties of a resource type.
type ResourceDef struct {
	Type         ResourceType
	Tier         ResourceTier
	DisplayName  string
	BasePrice    float64 // base market price per unit
}

// AllResources lists every resource definition.
var AllResources = []ResourceDef{
	// Tier 1 Raw Materials
	{ResGrain, Tier1Raw, "Grain", 2.0},
	{ResSugarcane, Tier1Raw, "Sugarcane", 2.5},
	{ResTobacco, Tier1Raw, "Tobacco", 4.0},
	{ResCotton, Tier1Raw, "Cotton", 3.0},
	{ResCoffee, Tier1Raw, "Coffee", 5.0},
	{ResFish, Tier1Raw, "Fish", 3.0},
	{ResCattle, Tier1Raw, "Cattle", 4.0},
	{ResIronOre, Tier1Raw, "Iron Ore", 3.5},
	{ResBauxite, Tier1Raw, "Bauxite", 4.0},
	{ResCoal, Tier1Raw, "Coal", 3.0},
	{ResCrudeOil, Tier1Raw, "Crude Oil", 6.0},
	{ResNaturalGas, Tier1Raw, "Natural Gas", 5.0},
	{ResTimber, Tier1Raw, "Timber", 2.5},
	{ResRubber, Tier1Raw, "Rubber", 4.5},
	{ResRareEarth, Tier1Raw, "Rare Earth", 8.0},

	// Tier 2 Processed Goods
	{ResFood, Tier2Processed, "Food", 5.0},
	{ResSugar, Tier2Processed, "Sugar", 6.0},
	{ResCigars, Tier2Processed, "Cigars", 10.0},
	{ResTextiles, Tier2Processed, "Textiles", 7.0},
	{ResSteel, Tier2Processed, "Steel", 8.0},
	{ResAluminum, Tier2Processed, "Aluminum", 9.0},
	{ResPlastics, Tier2Processed, "Plastics", 7.5},
	{ResChemicals, Tier2Processed, "Chemicals", 8.5},
	{ResFuel, Tier2Processed, "Fuel", 10.0},
	{ResLumber, Tier2Processed, "Lumber", 6.0},
	{ResElectronics, Tier2Processed, "Electronics", 12.0},
	{ResMachinery, Tier2Processed, "Machinery", 11.0},

	// Tier 3 Advanced Products
	{ResWeapons, Tier3Advanced, "Weapons", 20.0},
	{ResVehicles, Tier3Advanced, "Vehicles", 18.0},
	{ResPharmaceuticals, Tier3Advanced, "Pharmaceuticals", 22.0},
	{ResLuxuryGoods, Tier3Advanced, "Luxury Goods", 25.0},
	{ResSemiconductors, Tier3Advanced, "Semiconductors", 30.0},
	{ResAerospace, Tier3Advanced, "Aerospace", 35.0},
}

// ResourceDefMap provides quick lookup by ResourceType.
var ResourceDefMap map[ResourceType]*ResourceDef

func init() {
	ResourceDefMap = make(map[ResourceType]*ResourceDef, len(AllResources))
	for i := range AllResources {
		ResourceDefMap[AllResources[i].Type] = &AllResources[i]
	}
}

// Stockpile holds resource quantities for a city.
type Stockpile map[ResourceType]float64

// NewStockpile creates an empty stockpile.
func NewStockpile() Stockpile {
	return make(Stockpile)
}

// Add adds a quantity to the stockpile (clamps to 0 minimum).
func (s Stockpile) Add(res ResourceType, amount float64) {
	s[res] += amount
	if s[res] < 0 {
		s[res] = 0
	}
}

// Get returns the current quantity of a resource.
func (s Stockpile) Get(res ResourceType) float64 {
	return s[res]
}

// Has checks if the stockpile has at least the given amount.
func (s Stockpile) Has(res ResourceType, amount float64) bool {
	return s[res] >= amount
}

// Consume removes the given amount. Returns false if insufficient.
func (s Stockpile) Consume(res ResourceType, amount float64) bool {
	if s[res] < amount {
		return false
	}
	s[res] -= amount
	return true
}

// TotalValue calculates the market value of the stockpile using base prices.
func (s Stockpile) TotalValue() float64 {
	var total float64
	for res, qty := range s {
		if def, ok := ResourceDefMap[res]; ok {
			total += qty * def.BasePrice
		}
	}
	return total
}
