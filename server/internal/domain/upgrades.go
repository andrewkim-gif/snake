package domain

// TomeDef defines a Tome upgrade type.
type TomeDef struct {
	Type           TomeType `json:"type"`
	Name           string   `json:"name"`
	Description    string   `json:"description"`
	Tier           string   `json:"tier"`
	EffectPerStack float64  `json:"effectPerStack"`
	MaxStack       int      `json:"maxStack"`
}

// AbilityDef defines an Ability upgrade type.
type AbilityDef struct {
	Type            AbilityType `json:"type"`
	Name            string      `json:"name"`
	Description     string      `json:"description"`
	BaseCooldownSec float64     `json:"baseCooldownSec"` // 0 = passive
	AutoTrigger     string      `json:"autoTrigger"`
	BaseDamage      float64     `json:"baseDamage,omitempty"`
	Duration        float64     `json:"duration,omitempty"` // seconds
	UpgradeDmgMult  float64     `json:"upgradeDmgMult"`     // damage multiplier per level
	UpgradeCdMult   float64     `json:"upgradeCdMult"`      // cooldown multiplier per level
}

// SynergyDef defines a synergy bonus.
type SynergyDef struct {
	ID           string                `json:"id"`
	Name         string                `json:"name"`
	Description  string                `json:"description"`
	Hidden       bool                  `json:"hidden"`
	TomeReqs     map[TomeType]int      `json:"tomeReqs,omitempty"`
	AbilityReqs  map[AbilityType]int   `json:"abilityReqs,omitempty"` // min ability level
	BonusType    string                `json:"bonusType"`
	BonusValue   float64               `json:"bonusValue"`
}

// RequirementsMet checks if a PlayerBuild satisfies this synergy.
func (s *SynergyDef) RequirementsMet(build PlayerBuild) bool {
	for tome, required := range s.TomeReqs {
		if build.Tomes[tome] < required {
			return false
		}
	}
	for ability, requiredLevel := range s.AbilityReqs {
		found := false
		for _, slot := range build.AbilitySlots {
			if slot.Type == ability && slot.Level >= requiredLevel {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	return true
}

// --- XP Level Curve ---

// XPRequiredPerLevel defines XP needed to reach each level (index = level).
// Level 1 requires 0 XP (starting level).
var XPRequiredPerLevel = []int{
	0,   // Level 1 (start)
	20,  // Level 2
	30,  // Level 3
	45,  // Level 4
	65,  // Level 5
	90,  // Level 6
	120, // Level 7
	155, // Level 8
	195, // Level 9
	240, // Level 10
	290, // Level 11
	345, // Level 12
}

// MaxLevel is the maximum agent level.
const MaxLevel = 12

// XPForLevel returns the XP required to reach a given level (1-indexed).
// Returns -1 if beyond max level.
func XPForLevel(level int) int {
	if level < 1 || level > MaxLevel {
		return -1
	}
	return XPRequiredPerLevel[level-1]
}

// CumulativeXPForLevel returns total XP needed from level 1 to reach this level.
func CumulativeXPForLevel(level int) int {
	if level < 1 || level > MaxLevel {
		return -1
	}
	total := 0
	for i := 0; i < level; i++ {
		total += XPRequiredPerLevel[i]
	}
	return total
}

// --- Tome Definitions (8 types) ---

// AllTomes defines all 8 Tome upgrades.
var AllTomes = []TomeDef{
	{Type: TomeXP, Name: "XP Tome", Description: "XP gain +20% per stack", Tier: "S", EffectPerStack: 0.20, MaxStack: 10},
	{Type: TomeSpeed, Name: "Speed Tome", Description: "Move speed +10% per stack", Tier: "S", EffectPerStack: 0.10, MaxStack: 5},
	{Type: TomeDamage, Name: "Damage Tome", Description: "Aura DPS +15% per stack", Tier: "S", EffectPerStack: 0.15, MaxStack: 10},
	{Type: TomeArmor, Name: "Armor Tome", Description: "Damage taken -10% per stack", Tier: "A", EffectPerStack: 0.10, MaxStack: 8},
	{Type: TomeMagnet, Name: "Magnet Tome", Description: "Orb collect radius +25% per stack", Tier: "A", EffectPerStack: 0.25, MaxStack: 6},
	{Type: TomeLuck, Name: "Luck Tome", Description: "Rare upgrade chance +15% per stack", Tier: "A", EffectPerStack: 0.15, MaxStack: 6},
	{Type: TomeRegen, Name: "Regen Tome", Description: "Regenerate +0.5 mass/s per stack", Tier: "B", EffectPerStack: 0.025, MaxStack: 5}, // 0.025 mass/tick = 0.5 mass/s at 20Hz
	{Type: TomeCursed, Name: "Cursed Tome", Description: "DPS +25%, damage taken +20% per stack", Tier: "S*", EffectPerStack: 0.25, MaxStack: 5},
}

// GetTomeDef returns the TomeDef for a given TomeType, or nil if not found.
func GetTomeDef(t TomeType) *TomeDef {
	for i := range AllTomes {
		if AllTomes[i].Type == t {
			return &AllTomes[i]
		}
	}
	return nil
}

// --- Ability Definitions (6 types) ---

// AllAbilities defines all 6 Ability upgrades.
var AllAbilities = []AbilityDef{
	{Type: AbilityVenomAura, Name: "Venom Aura", Description: "Poison DoT to nearby enemies (3s)",
		BaseCooldownSec: 0, AutoTrigger: "always_active", BaseDamage: 15, Duration: 3,
		UpgradeDmgMult: 1.30, UpgradeCdMult: 1.0},
	{Type: AbilityShieldBurst, Name: "Shield Burst", Description: "3s invincibility + knockback",
		BaseCooldownSec: 15, AutoTrigger: "hp_below_30pct", BaseDamage: 0, Duration: 3,
		UpgradeDmgMult: 1.0, UpgradeCdMult: 0.80},
	{Type: AbilityLightningStrike, Name: "Lightning Strike", Description: "Instant damage to nearest enemy",
		BaseCooldownSec: 8, AutoTrigger: "enemy_in_range", BaseDamage: 50, Duration: 0,
		UpgradeDmgMult: 1.30, UpgradeCdMult: 0.80},
	{Type: AbilitySpeedDash, Name: "Speed Dash", Description: "2s triple speed + collision immunity",
		BaseCooldownSec: 12, AutoTrigger: "chase_or_flee", BaseDamage: 0, Duration: 2,
		UpgradeDmgMult: 1.0, UpgradeCdMult: 0.80},
	{Type: AbilityMassDrain, Name: "Mass Drain", Description: "Absorb 10% mass on contact",
		BaseCooldownSec: 10, AutoTrigger: "on_contact", BaseDamage: 0, Duration: 0,
		UpgradeDmgMult: 1.30, UpgradeCdMult: 0.80},
	{Type: AbilityGravityWell, Name: "Gravity Well", Description: "3s pull nearby orbs + enemies",
		BaseCooldownSec: 20, AutoTrigger: "orb_dense_area", BaseDamage: 0, Duration: 3,
		UpgradeDmgMult: 1.0, UpgradeCdMult: 0.80},
}

// GetAbilityDef returns the AbilityDef for a given AbilityType, or nil if not found.
func GetAbilityDef(a AbilityType) *AbilityDef {
	for i := range AllAbilities {
		if AllAbilities[i].Type == a {
			return &AllAbilities[i]
		}
	}
	return nil
}

// --- Synergy Definitions (6 public + 4 hidden = 10) ---

// AllSynergies defines all 10 synergy bonuses.
var AllSynergies = []SynergyDef{
	// === Public Synergies (6) ===
	{
		ID: "holy_trinity", Name: "Holy Trinity",
		Description: "All XP +50% bonus",
		Hidden: false,
		TomeReqs:    map[TomeType]int{TomeXP: 3, TomeLuck: 2, TomeCursed: 1},
		BonusType:   "xp_multiplier",
		BonusValue:  0.50,
	},
	{
		ID: "glass_cannon", Name: "Glass Cannon",
		Description: "DPS x2.0 (damage taken x2.0)",
		Hidden: false,
		TomeReqs:    map[TomeType]int{TomeDamage: 5, TomeCursed: 3},
		BonusType:   "dps_multiplier",
		BonusValue:  2.0,
	},
	{
		ID: "iron_fortress", Name: "Iron Fortress",
		Description: "Additional -30% damage taken",
		Hidden: false,
		TomeReqs:    map[TomeType]int{TomeArmor: 4, TomeRegen: 3},
		AbilityReqs: map[AbilityType]int{AbilityShieldBurst: 1},
		BonusType:   "damage_reduction",
		BonusValue:  0.30,
	},
	{
		ID: "speedster", Name: "Speedster",
		Description: "Boost cost -50%",
		Hidden: false,
		TomeReqs:    map[TomeType]int{TomeSpeed: 4, TomeMagnet: 2},
		AbilityReqs: map[AbilityType]int{AbilitySpeedDash: 1},
		BonusType:   "boost_cost_reduction",
		BonusValue:  0.50,
	},
	{
		ID: "vampire", Name: "Vampire",
		Description: "Poison damage heals 20% as mass",
		Hidden: false,
		TomeReqs:    map[TomeType]int{TomeRegen: 2},
		AbilityReqs: map[AbilityType]int{AbilityVenomAura: 1, AbilityMassDrain: 1},
		BonusType:   "poison_lifesteal",
		BonusValue:  0.20,
	},
	{
		ID: "storm", Name: "Storm",
		Description: "Lightning chains to 3 enemies",
		Hidden: false,
		TomeReqs:    map[TomeType]int{TomeDamage: 3},
		AbilityReqs: map[AbilityType]int{AbilityLightningStrike: 3},
		BonusType:   "lightning_chain",
		BonusValue:  3.0,
	},

	// === Hidden Synergies (4) ===
	{
		ID: "berserker", Name: "Berserker",
		Description: "Dash damage x3.0",
		Hidden: true,
		TomeReqs:    map[TomeType]int{TomeDamage: 4, TomeCursed: 2, TomeSpeed: 2},
		BonusType:   "dash_damage_multiplier",
		BonusValue:  3.0,
	},
	{
		ID: "arcane_scholar", Name: "Arcane Scholar",
		Description: "Tome effects +25% globally",
		Hidden: true,
		TomeReqs:    map[TomeType]int{TomeXP: 4, TomeLuck: 4, TomeMagnet: 3},
		BonusType:   "tome_effect_multiplier",
		BonusValue:  0.25,
	},
	{
		ID: "immortal", Name: "Immortal",
		Description: "Survive lethal hit once per round (1 HP)",
		Hidden: true,
		TomeReqs:    map[TomeType]int{TomeArmor: 6, TomeRegen: 4},
		AbilityReqs: map[AbilityType]int{AbilityShieldBurst: 2},
		BonusType:   "cheat_death",
		BonusValue:  1.0,
	},
	{
		ID: "gravity_master", Name: "Gravity Master",
		Description: "Gravity Well radius x2 + permanent slow aura",
		Hidden: true,
		TomeReqs:    map[TomeType]int{TomeMagnet: 5, TomeSpeed: 3},
		AbilityReqs: map[AbilityType]int{AbilityGravityWell: 2},
		BonusType:   "gravity_enhance",
		BonusValue:  2.0,
	},
}

// GetSynergyDef returns the SynergyDef with the given ID, or nil if not found.
func GetSynergyDef(id string) *SynergyDef {
	for i := range AllSynergies {
		if AllSynergies[i].ID == id {
			return &AllSynergies[i]
		}
	}
	return nil
}

// PublicSynergies returns only the non-hidden synergies.
func PublicSynergies() []SynergyDef {
	var result []SynergyDef
	for _, s := range AllSynergies {
		if !s.Hidden {
			result = append(result, s)
		}
	}
	return result
}
