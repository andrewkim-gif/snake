package city

import (
	"fmt"
	"math"
	"math/rand"
	"sync/atomic"
)

// citizenIDCounter generates unique citizen IDs.
var citizenIDCounter uint64

func nextCitizenID() string {
	id := atomic.AddUint64(&citizenIDCounter, 1)
	return fmt.Sprintf("ctz_%d", id)
}

// EducationLevel represents a citizen's education.
type EducationLevel int

const (
	EduUneducated EducationLevel = iota
	EduHighschool
	EduCollege
)

// String returns the education level name.
func (e EducationLevel) String() string {
	switch e {
	case EduHighschool:
		return "highschool"
	case EduCollege:
		return "college"
	default:
		return "uneducated"
	}
}

// CitizenFSMState represents the current behavior of a citizen.
type CitizenFSMState int

const (
	StateIdle       CitizenFSMState = iota // No job, wandering
	StateCommuting                         // Traveling to/from work
	StateWorking                           // At workplace
	StateShopping                          // Visiting commercial/service building
	StateResting                           // At home or idle relaxation
	StateProtesting                        // Unhappy, protesting
)

// String returns the FSM state name.
func (s CitizenFSMState) String() string {
	switch s {
	case StateCommuting:
		return "commuting"
	case StateWorking:
		return "working"
	case StateShopping:
		return "shopping"
	case StateResting:
		return "resting"
	case StateProtesting:
		return "protesting"
	default:
		return "idle"
	}
}

// HappinessFactors holds the 8 happiness components (0~100 each).
type HappinessFactors struct {
	Food          float64 `json:"food"`          // 식량
	Healthcare    float64 `json:"healthcare"`    // 의료
	Entertainment float64 `json:"entertainment"` // 오락
	Faith         float64 `json:"faith"`         // 신앙
	Housing       float64 `json:"housing"`       // 주거
	Job           float64 `json:"job"`           // 직업
	Liberty       float64 `json:"liberty"`       // 자유
	Safety        float64 `json:"safety"`        // 안전
}

// Average returns the mean of all 8 factors.
func (h *HappinessFactors) Average() float64 {
	sum := h.Food + h.Healthcare + h.Entertainment + h.Faith +
		h.Housing + h.Job + h.Liberty + h.Safety
	return sum / 8.0
}

// Clamp ensures all values are within 0~100.
func (h *HappinessFactors) Clamp() {
	h.Food = clampF(h.Food, 0, 100)
	h.Healthcare = clampF(h.Healthcare, 0, 100)
	h.Entertainment = clampF(h.Entertainment, 0, 100)
	h.Faith = clampF(h.Faith, 0, 100)
	h.Housing = clampF(h.Housing, 0, 100)
	h.Job = clampF(h.Job, 0, 100)
	h.Liberty = clampF(h.Liberty, 0, 100)
	h.Safety = clampF(h.Safety, 0, 100)
}

// CitizenAgent represents a single citizen in the city simulation.
type CitizenAgent struct {
	ID string `json:"id"`

	// Demographics
	Age       int            `json:"age"`
	Education EducationLevel `json:"education"`

	// Faction affiliations (max 4, one per axis)
	Factions []string `json:"factions"`

	// Happiness (8 factors, each 0~100)
	Happiness        HappinessFactors `json:"happiness"`
	OverallHappiness float64          `json:"overallHappiness"`

	// Employment
	WorkplaceID string  `json:"workplaceId"` // building ID, "" if unemployed
	Salary      float64 `json:"salary"`
	Savings     float64 `json:"savings"`

	// Position (tile coordinates)
	TileX int `json:"tileX"`
	TileY int `json:"tileY"`

	// FSM
	State        CitizenFSMState `json:"state"`
	ActionTarget string          `json:"actionTarget"` // target building ID

	// Internal tick counter for FSM phase tracking within a cycle
	tickPhase int
}

// NewCitizen creates a new citizen with randomized demographics.
func NewCitizen(rng *rand.Rand, mapSize int) *CitizenAgent {
	// Random age 18-70
	age := 18 + rng.Intn(53)

	// Education distribution: 40% uneducated, 35% highschool, 25% college
	edu := EduUneducated
	r := rng.Float64()
	if r > 0.75 {
		edu = EduCollege
	} else if r > 0.40 {
		edu = EduHighschool
	}

	// Random position within buildable area (center 70% of map)
	margin := mapSize / 6
	tileX := margin + rng.Intn(mapSize-2*margin)
	tileY := margin + rng.Intn(mapSize-2*margin)

	return &CitizenAgent{
		ID:        nextCitizenID(),
		Age:       age,
		Education: edu,
		Factions:  make([]string, 0, 4),
		Happiness: HappinessFactors{
			Food:          50,
			Healthcare:    50,
			Entertainment: 40,
			Faith:         40,
			Housing:       50,
			Job:           30, // starts low — needs employment
			Liberty:       60,
			Safety:        60,
		},
		OverallHappiness: 47.5,
		Salary:           0,
		Savings:          100 + rng.Float64()*400, // 100~500 starting savings
		TileX:            tileX,
		TileY:            tileY,
		State:            StateIdle,
		tickPhase:        rng.Intn(4), // randomize start phase to avoid sync
	}
}

// IsEmployed returns true if the citizen has a workplace.
func (c *CitizenAgent) IsEmployed() bool {
	return c.WorkplaceID != ""
}

// TickCitizen advances the citizen FSM by one economy tick (10 seconds).
// buildings map is needed for position targets and happiness computation.
func (c *CitizenAgent) TickCitizen(buildings map[string]*Building, rng *rand.Rand) {
	c.tickPhase = (c.tickPhase + 1) % 4

	if !c.IsEmployed() {
		// Unemployed citizens
		if c.OverallHappiness < 30 {
			c.State = StateProtesting
			c.moveToCityCenter(buildings)
		} else {
			c.State = StateIdle
			c.wander(rng)
		}
		return
	}

	// Employed citizen daily cycle (4 phases per tick cycle):
	// Phase 0: commuting to work
	// Phase 1: working
	// Phase 2: commuting/shopping
	// Phase 3: resting at home
	switch c.tickPhase {
	case 0:
		c.State = StateCommuting
		c.ActionTarget = c.WorkplaceID
		c.moveToward(buildings, c.WorkplaceID)
	case 1:
		c.State = StateWorking
		c.ActionTarget = c.WorkplaceID
		c.moveToward(buildings, c.WorkplaceID)
	case 2:
		// After work: shopping or commuting home
		if rng.Float64() < 0.4 {
			c.State = StateShopping
			// Find nearest service/commerce building
			target := c.findNearestServiceBuilding(buildings)
			if target != "" {
				c.ActionTarget = target
				c.moveToward(buildings, target)
			} else {
				c.State = StateCommuting
				c.wander(rng)
			}
		} else {
			c.State = StateCommuting
			c.wander(rng)
		}
	case 3:
		c.State = StateResting
		c.ActionTarget = ""
		// Slight wander near home position
		c.wander(rng)
	}

	// Check if citizen should protest (unhappiness override)
	if c.OverallHappiness < 25 && rng.Float64() < 0.3 {
		c.State = StateProtesting
		c.moveToCityCenter(buildings)
	}
}

// ComputeHappiness recalculates all 8 happiness factors based on
// building accessibility and employment status.
func (c *CitizenAgent) ComputeHappiness(buildings map[string]*Building, foodSatisfaction float64, atWar bool) {
	// Food: based on food satisfaction ratio (from economy tick)
	c.Happiness.Food = foodSatisfaction * 100

	// Healthcare: presence of clinic/hospital nearby
	c.Happiness.Healthcare = c.computeBuildingAccessFactor(buildings, "clinic", "hospital")

	// Entertainment: presence of tavern/entertainment_complex
	c.Happiness.Entertainment = c.computeBuildingAccessFactor(buildings, "tavern", "entertainment_complex")

	// Faith: presence of church
	c.Happiness.Faith = c.computeBuildingAccessFactor(buildings, "church")

	// Housing: presence of housing_block
	housingAccess := c.computeBuildingAccessFactor(buildings, "housing_block")
	c.Happiness.Housing = housingAccess

	// Job: employment status + salary level
	if c.IsEmployed() {
		c.Happiness.Job = 60 + math.Min(c.Salary*4, 40)
	} else {
		c.Happiness.Job = 15 // unemployed baseline
	}

	// Liberty: base 60, modified by government buildings
	govCount := countBuildingsByCategory(buildings, CatGovernment)
	c.Happiness.Liberty = clampF(60-float64(govCount)*5+float64(c.Education)*5, 0, 100)

	// Safety: police presence, war penalty
	c.Happiness.Safety = c.computeBuildingAccessFactor(buildings, "police_station", "fire_station")
	if atWar {
		c.Happiness.Safety = math.Max(0, c.Happiness.Safety-30)
	}

	c.Happiness.Clamp()
	c.OverallHappiness = c.Happiness.Average()
}

// computeBuildingAccessFactor returns 0~100 based on proximity to specified building types.
// Higher value = building exists nearby.
func (c *CitizenAgent) computeBuildingAccessFactor(buildings map[string]*Building, defIDs ...string) float64 {
	// Check if any matching building exists and compute distance-weighted score
	bestScore := 0.0

	for _, b := range buildings {
		if b.UnderConstruction || !b.Enabled {
			continue
		}
		matched := false
		for _, defID := range defIDs {
			if b.DefID == defID {
				matched = true
				break
			}
		}
		if !matched {
			continue
		}

		// Distance from citizen to building (Manhattan distance in tiles)
		dist := math.Abs(float64(c.TileX-b.TileX)) + math.Abs(float64(c.TileY-b.TileY))

		// Score decreases with distance: 100 at dist=0, 50 at dist=10, ~0 at dist=30+
		score := math.Max(0, 100-dist*3.3)
		if score > bestScore {
			bestScore = score
		}
	}

	return bestScore
}

// countBuildingsByCategory counts operational buildings in a category.
func countBuildingsByCategory(buildings map[string]*Building, cat BuildingCategory) int {
	count := 0
	for _, b := range buildings {
		if b.UnderConstruction || !b.Enabled {
			continue
		}
		def := GetBuildingDef(b.DefID)
		if def != nil && def.Category == cat {
			count++
		}
	}
	return count
}

// moveToward moves the citizen toward a target building by 1-2 tiles.
func (c *CitizenAgent) moveToward(buildings map[string]*Building, buildingID string) {
	b, ok := buildings[buildingID]
	if !ok {
		return
	}

	dx := b.TileX - c.TileX
	dy := b.TileY - c.TileY

	// Move 1-2 tiles toward target
	if dx > 0 {
		c.TileX++
	} else if dx < 0 {
		c.TileX--
	}
	if dy > 0 {
		c.TileY++
	} else if dy < 0 {
		c.TileY--
	}
}

// wander randomly moves the citizen by 0-1 tiles in each direction.
func (c *CitizenAgent) wander(rng *rand.Rand) {
	c.TileX += rng.Intn(3) - 1 // -1, 0, or +1
	c.TileY += rng.Intn(3) - 1
}

// moveToCityCenter moves toward the center of the map (for protesting).
func (c *CitizenAgent) moveToCityCenter(buildings map[string]*Building) {
	// Find town_hall as city center; fallback to general center
	for _, b := range buildings {
		if b.DefID == "town_hall" && !b.UnderConstruction {
			dx := b.TileX - c.TileX
			dy := b.TileY - c.TileY
			if dx > 0 {
				c.TileX++
			} else if dx < 0 {
				c.TileX--
			}
			if dy > 0 {
				c.TileY++
			} else if dy < 0 {
				c.TileY--
			}
			return
		}
	}
	// No town hall — just stay put
}

// findNearestServiceBuilding returns the ID of the nearest service building.
func (c *CitizenAgent) findNearestServiceBuilding(buildings map[string]*Building) string {
	bestDist := math.MaxFloat64
	bestID := ""

	for _, b := range buildings {
		if b.UnderConstruction || !b.Enabled {
			continue
		}
		def := GetBuildingDef(b.DefID)
		if def == nil || def.Category != CatService {
			continue
		}

		dist := math.Abs(float64(c.TileX-b.TileX)) + math.Abs(float64(c.TileY-b.TileY))
		if dist < bestDist {
			bestDist = dist
			bestID = b.ID
		}
	}

	return bestID
}

// --- Employment System ---

// EmploymentRequirement defines what education a building needs.
type EmploymentRequirement struct {
	MinEducation EducationLevel
	BaseWage     float64
}

// GetEmploymentRequirement returns the employment requirement for a building type.
func GetEmploymentRequirement(defID string) EmploymentRequirement {
	switch defID {
	// Tier 3 & advanced: require college
	case "semiconductor_fab", "aerospace_plant", "pharma_lab", "university",
		"nuclear_plant", "ministry", "palace":
		return EmploymentRequirement{MinEducation: EduCollege, BaseWage: 8.0}

	// Tier 2 processing & some services: require highschool
	case "steel_mill", "electronics_factory", "machinery_plant", "chemical_plant",
		"oil_refinery", "weapons_factory", "vehicle_factory", "luxury_workshop",
		"hospital", "entertainment_complex", "police_station", "oil_power_plant",
		"airport", "armory", "naval_base", "solar_farm":
		return EmploymentRequirement{MinEducation: EduHighschool, BaseWage: 5.0}

	// Tier 1 & basic services: no education needed
	default:
		return EmploymentRequirement{MinEducation: EduUneducated, BaseWage: 2.0}
	}
}

// AssignCitizensToWorkplaces matches unemployed citizens to available building slots.
// Prioritizes higher-education citizens for higher-tier buildings.
func AssignCitizensToWorkplaces(citizens []*CitizenAgent, buildings map[string]*Building) {
	// Count current workers per building
	workerCount := make(map[string]int)
	for _, c := range citizens {
		if c.WorkplaceID != "" {
			workerCount[c.WorkplaceID]++
		}
	}

	// Check if workplace still exists, fire if not
	for _, c := range citizens {
		if c.WorkplaceID != "" {
			if _, exists := buildings[c.WorkplaceID]; !exists {
				c.WorkplaceID = ""
				c.Salary = 0
			}
		}
	}

	// Recount after cleanup
	workerCount = make(map[string]int)
	for _, c := range citizens {
		if c.WorkplaceID != "" {
			workerCount[c.WorkplaceID]++
		}
	}

	// Find unemployed citizens
	unemployed := make([]*CitizenAgent, 0)
	for _, c := range citizens {
		if c.WorkplaceID == "" {
			unemployed = append(unemployed, c)
		}
	}

	if len(unemployed) == 0 {
		return
	}

	// Try to assign each unemployed citizen to a building with open slots
	for _, c := range unemployed {
		for _, b := range buildings {
			if b.UnderConstruction || !b.Enabled {
				continue
			}
			def := GetBuildingDef(b.DefID)
			if def == nil || def.MaxWorkers == 0 {
				continue
			}

			// Check capacity
			if workerCount[b.ID] >= def.MaxWorkers {
				continue
			}

			// Check education requirement
			req := GetEmploymentRequirement(b.DefID)
			if c.Education < req.MinEducation {
				continue
			}

			// Assign
			c.WorkplaceID = b.ID
			c.Salary = req.BaseWage * (1 + float64(b.Level-1)*0.15) // level bonus
			workerCount[b.ID]++
			break
		}
	}

	// Sync building worker counts
	syncBuildingWorkerCounts(citizens, buildings)
}

// syncBuildingWorkerCounts updates each building's Workers field from citizen data.
func syncBuildingWorkerCounts(citizens []*CitizenAgent, buildings map[string]*Building) {
	// Reset all building worker counts
	for _, b := range buildings {
		b.Workers = 0
	}

	// Count from citizen employment
	for _, c := range citizens {
		if c.WorkplaceID != "" {
			if b, ok := buildings[c.WorkplaceID]; ok {
				b.Workers++
			}
		}
	}
}

// InitialCitizenCount returns the target citizen count for a tier.
func InitialCitizenCount(tier string) int {
	switch tier {
	case "S":
		return 300
	case "A":
		return 150
	case "B":
		return 80
	case "C":
		return 30
	default: // D
		return 15
	}
}

// --- Citizen Snapshot for Client ---

// CitizenSnapshot is a lightweight representation sent to clients via city_state.
type CitizenSnapshot struct {
	ID        string `json:"id"`
	TileX     int    `json:"tileX"`
	TileY     int    `json:"tileY"`
	State     string `json:"state"`
	Education string `json:"education"`
	Employed  bool   `json:"employed"`
}

// Snapshot creates a lightweight snapshot of the citizen for client transmission.
func (c *CitizenAgent) Snapshot() CitizenSnapshot {
	return CitizenSnapshot{
		ID:        c.ID,
		TileX:     c.TileX,
		TileY:     c.TileY,
		State:     c.State.String(),
		Education: c.Education.String(),
		Employed:  c.IsEmployed(),
	}
}

// --- Utility ---

func clampF(v, min, max float64) float64 {
	if v < min {
		return min
	}
	if v > max {
		return max
	}
	return v
}
