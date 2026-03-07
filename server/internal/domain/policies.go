package domain

// ============================================================
// v14 Phase 6 — S27: Policy Data Types & Definitions
// 10 policy categories × 3 levels each
// Hegemony nations can change policies once per week
// ============================================================

// PolicyCategory identifies one of the 10 policy categories.
type PolicyCategory string

const (
	PolicyReligion    PolicyCategory = "religion"
	PolicyLanguage    PolicyCategory = "language"
	PolicyGovernment  PolicyCategory = "government"
	PolicyTaxRate     PolicyCategory = "tax_rate"
	PolicyMilitary    PolicyCategory = "military"
	PolicyEducation   PolicyCategory = "education"
	PolicyTrade       PolicyCategory = "trade"
	PolicyEnvironment PolicyCategory = "environment"
	PolicyImmigration PolicyCategory = "immigration"
	PolicyCulture     PolicyCategory = "culture"
)

// AllPolicyCategories lists all 10 policy categories in display order.
var AllPolicyCategories = []PolicyCategory{
	PolicyReligion, PolicyLanguage, PolicyGovernment, PolicyTaxRate,
	PolicyMilitary, PolicyEducation, PolicyTrade, PolicyEnvironment,
	PolicyImmigration, PolicyCulture,
}

// PolicyLevel represents the 3 levels within a category (0, 1, 2).
type PolicyLevel int

const (
	PolicyLevelLow    PolicyLevel = 0
	PolicyLevelMid    PolicyLevel = 1
	PolicyLevelHigh   PolicyLevel = 2
)

// PolicyOption describes a single selectable option within a category.
type PolicyOption struct {
	Level       PolicyLevel       `json:"level"`
	Name        string            `json:"name"`
	Description string            `json:"description"`
	Effects     map[string]float64 `json:"effects"` // stat name → modifier
}

// PolicyCategoryDef defines a complete policy category with its 3 options.
type PolicyCategoryDef struct {
	Category    PolicyCategory `json:"category"`
	Name        string         `json:"name"`
	Description string         `json:"description"`
	Options     [3]PolicyOption `json:"options"`
}

// CountryPolicies holds the active policy selections for a country.
type CountryPolicies struct {
	CountryCode string                       `json:"countryCode"`
	Policies    map[PolicyCategory]PolicyLevel `json:"policies"`
	LastChanged int64                         `json:"lastChanged"` // Unix timestamp
	ChangedBy   string                        `json:"changedBy"`   // agentID who made last change
	GraceEnd    int64                         `json:"graceEnd"`    // Unix timestamp when grace ends
}

// NewDefaultPolicies returns the default (all mid-level) policies for a country.
func NewDefaultPolicies(countryCode string) *CountryPolicies {
	policies := make(map[PolicyCategory]PolicyLevel, len(AllPolicyCategories))
	for _, cat := range AllPolicyCategories {
		policies[cat] = PolicyLevelMid // 기본: 중간 단계
	}
	return &CountryPolicies{
		CountryCode: countryCode,
		Policies:    policies,
	}
}

// SetPolicyRequest is the C→S event payload for policy changes.
type SetPolicyRequest struct {
	CountryCode string         `json:"countryCode"`
	Category    PolicyCategory `json:"category"`
	Level       PolicyLevel    `json:"level"`
}

// PolicyChangedEvent is the S→C broadcast when a policy changes.
type PolicyChangedEvent struct {
	CountryCode string         `json:"countryCode"`
	Category    PolicyCategory `json:"category"`
	OldLevel    PolicyLevel    `json:"oldLevel"`
	NewLevel    PolicyLevel    `json:"newLevel"`
	ChangedBy   string         `json:"changedBy"`
	EffectiveAt int64          `json:"effectiveAt"` // Unix timestamp when effect kicks in
}

// NationStatsSnapshot is sent via S→C nation_stats_update.
type NationStatsSnapshot struct {
	CountryCode     string  `json:"countryCode"`
	Happiness       float64 `json:"happiness"`       // 0-100
	BirthRate       float64 `json:"birthRate"`        // 0.5-4.0
	GDP             float64 `json:"gdp"`              // $0-inf
	MilitaryPower   float64 `json:"militaryPower"`    // 0-100
	TechLevel       float64 `json:"techLevel"`        // 0-100
	Loyalty         float64 `json:"loyalty"`          // 0-100
	Population      float64 `json:"population"`       // calculated
	InternationalRep float64 `json:"internationalRep"` // -100 to +100
}

// ============================================================
// Policy Definitions — 10 Categories × 3 Options
// ============================================================

// AllPolicyDefinitions defines all 10 policy categories with their options and effects.
var AllPolicyDefinitions = []PolicyCategoryDef{
	{
		Category:    PolicyReligion,
		Name:        "State Religion",
		Description: "National religious policy affecting culture and loyalty",
		Options: [3]PolicyOption{
			{Level: 0, Name: "Atheism", Description: "Secular state, science-focused",
				Effects: map[string]float64{"techLevel": 10, "loyalty": -5}},
			{Level: 1, Name: "Polytheism", Description: "Multiple faiths tolerated",
				Effects: map[string]float64{"happiness": 10, "loyalty": 5}},
			{Level: 2, Name: "Monotheism", Description: "One true faith, strong identity",
				Effects: map[string]float64{"loyalty": 15, "happiness": -5}},
		},
	},
	{
		Category:    PolicyLanguage,
		Name:        "Official Language",
		Description: "Language policy affecting trade and internal unity",
		Options: [3]PolicyOption{
			{Level: 0, Name: "Native Only", Description: "Preserve national language",
				Effects: map[string]float64{"loyalty": 10, "internationalRep": -5}},
			{Level: 1, Name: "Bilingual", Description: "Two official languages",
				Effects: map[string]float64{"happiness": 5, "gdp": 5}},
			{Level: 2, Name: "Global Language", Description: "Adopt international lingua franca",
				Effects: map[string]float64{"gdp": 10, "loyalty": -5}},
		},
	},
	{
		Category:    PolicyGovernment,
		Name:        "Political System",
		Description: "Form of government affecting happiness and military",
		Options: [3]PolicyOption{
			{Level: 0, Name: "Democracy", Description: "Rule by the people",
				Effects: map[string]float64{"happiness": 15, "militaryPower": -5}},
			{Level: 1, Name: "Authoritarian", Description: "Strong central authority",
				Effects: map[string]float64{"militaryPower": 15, "happiness": -10}},
			{Level: 2, Name: "Oligarchy", Description: "Rule by economic elite",
				Effects: map[string]float64{"gdp": 15, "happiness": -5, "loyalty": -5}},
		},
	},
	{
		Category:    PolicyTaxRate,
		Name:        "Tax Rate",
		Description: "Tax burden affecting GDP and happiness",
		Options: [3]PolicyOption{
			{Level: 0, Name: "Low Tax (10%)", Description: "Minimal taxation, free economy",
				Effects: map[string]float64{"happiness": 10, "gdp": -10}},
			{Level: 1, Name: "Medium Tax (25%)", Description: "Balanced taxation",
				Effects: map[string]float64{"happiness": 0, "gdp": 5}},
			{Level: 2, Name: "High Tax (40%)", Description: "Heavy taxation for state programs",
				Effects: map[string]float64{"happiness": -10, "gdp": 15}},
		},
	},
	{
		Category:    PolicyMilitary,
		Name:        "Military Spending",
		Description: "Defense budget affecting military power and GDP",
		Options: [3]PolicyOption{
			{Level: 0, Name: "Minimal (10%)", Description: "Small standing army",
				Effects: map[string]float64{"gdp": 10, "militaryPower": -15}},
			{Level: 1, Name: "Normal (25%)", Description: "Balanced defense posture",
				Effects: map[string]float64{"militaryPower": 5}},
			{Level: 2, Name: "Maximum (50%)", Description: "Full military mobilization",
				Effects: map[string]float64{"militaryPower": 20, "happiness": -10, "gdp": -10}},
		},
	},
	{
		Category:    PolicyEducation,
		Name:        "Education Investment",
		Description: "Education spending affecting tech and economy",
		Options: [3]PolicyOption{
			{Level: 0, Name: "Basic", Description: "Minimal public education",
				Effects: map[string]float64{"gdp": 5, "techLevel": -10}},
			{Level: 1, Name: "Standard", Description: "Adequate public education",
				Effects: map[string]float64{"techLevel": 5, "happiness": 5}},
			{Level: 2, Name: "Elite", Description: "World-class education system",
				Effects: map[string]float64{"techLevel": 15, "happiness": 5, "gdp": -10}},
		},
	},
	{
		Category:    PolicyTrade,
		Name:        "Trade Policy",
		Description: "Trade stance affecting GDP and international relations",
		Options: [3]PolicyOption{
			{Level: 0, Name: "Protectionism", Description: "Restrict foreign trade",
				Effects: map[string]float64{"loyalty": 5, "gdp": -5, "internationalRep": -10}},
			{Level: 1, Name: "Free Trade", Description: "Open markets",
				Effects: map[string]float64{"gdp": 10, "internationalRep": 10}},
			{Level: 2, Name: "Sanctions", Description: "Aggressive trade warfare",
				Effects: map[string]float64{"internationalRep": -15, "militaryPower": 5}},
		},
	},
	{
		Category:    PolicyEnvironment,
		Name:        "Environmental Policy",
		Description: "Balance between growth and sustainability",
		Options: [3]PolicyOption{
			{Level: 0, Name: "Exploit", Description: "Maximum resource extraction",
				Effects: map[string]float64{"gdp": 10, "happiness": -10, "birthRate": -0.3}},
			{Level: 1, Name: "Balance", Description: "Sustainable development",
				Effects: map[string]float64{"happiness": 5, "birthRate": 0.1}},
			{Level: 2, Name: "Preserve", Description: "Full environmental protection",
				Effects: map[string]float64{"happiness": 10, "birthRate": 0.3, "gdp": -10}},
		},
	},
	{
		Category:    PolicyImmigration,
		Name:        "Immigration Policy",
		Description: "Border control affecting population and loyalty",
		Options: [3]PolicyOption{
			{Level: 0, Name: "Closed Borders", Description: "No immigration allowed",
				Effects: map[string]float64{"loyalty": 10, "population": -5}},
			{Level: 1, Name: "Selective", Description: "Skilled worker immigration",
				Effects: map[string]float64{"techLevel": 5, "population": 3}},
			{Level: 2, Name: "Open Borders", Description: "Free movement of people",
				Effects: map[string]float64{"population": 10, "loyalty": -10, "gdp": 5}},
		},
	},
	{
		Category:    PolicyCulture,
		Name:        "Cultural Policy",
		Description: "Cultural direction affecting innovation and tradition",
		Options: [3]PolicyOption{
			{Level: 0, Name: "Traditional", Description: "Preserve cultural heritage",
				Effects: map[string]float64{"loyalty": 10, "happiness": 5}},
			{Level: 1, Name: "Innovation", Description: "Promote tech and creativity",
				Effects: map[string]float64{"techLevel": 10, "gdp": 5}},
			{Level: 2, Name: "Fusion", Description: "Blend cultures for new ideas",
				Effects: map[string]float64{"happiness": 10, "internationalRep": 10, "loyalty": -5}},
		},
	},
}

// GetPolicyDefinition returns the definition for a given category.
func GetPolicyDefinition(cat PolicyCategory) *PolicyCategoryDef {
	for i := range AllPolicyDefinitions {
		if AllPolicyDefinitions[i].Category == cat {
			return &AllPolicyDefinitions[i]
		}
	}
	return nil
}

// GetPolicyEffects returns the aggregate stat effects of a set of policies.
func GetPolicyEffects(policies map[PolicyCategory]PolicyLevel) map[string]float64 {
	effects := make(map[string]float64)
	for cat, level := range policies {
		def := GetPolicyDefinition(cat)
		if def == nil || level < 0 || int(level) > 2 {
			continue
		}
		for stat, value := range def.Options[level].Effects {
			effects[stat] += value
		}
	}
	return effects
}
