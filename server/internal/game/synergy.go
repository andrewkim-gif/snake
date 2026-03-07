package game

import (
	"fmt"
	"strings"

	"github.com/andrewkim-gif/snake/server/internal/domain"
)

// ============================================================
// v14 Phase 3: Synergy System (S16)
// 10 synergy combos — auto-detect + client notification
// ============================================================

// V14SynergyDef defines a synergy combo and its requirements.
type V14SynergyDef struct {
	Type        domain.V14SynergyType `json:"type"`
	Name        string                `json:"name"`
	Description string                `json:"description"`
	// Requirements
	WeaponReqs  map[domain.WeaponType]int  `json:"weaponReqs,omitempty"`  // weapon type → min level
	PassiveReqs map[domain.PassiveType]int `json:"passiveReqs,omitempty"` // passive type → min stacks
	// Effect
	BonusType  string  `json:"bonusType"`
	BonusValue float64 `json:"bonusValue"`
}

// AllV14Synergies defines all 10 v14 synergy combos.
var AllV14Synergies = []V14SynergyDef{
	{
		Type: domain.SynergyThermalShock, Name: "Thermal Shock",
		Description: "Burn+Slow enemies take 2x damage",
		WeaponReqs:  map[domain.WeaponType]int{domain.WeaponFlameRing: 1, domain.WeaponFrostShards: 1},
		BonusType:   "thermal_shock_damage",
		BonusValue:  2.0,
	},
	{
		Type: domain.SynergyAssassinsMark, Name: "Assassin's Mark",
		Description: "Backstab attacks are always critical",
		WeaponReqs:  map[domain.WeaponType]int{domain.WeaponShadowStrike: 1},
		PassiveReqs: map[domain.PassiveType]int{domain.PassivePrecision: 3},
		BonusType:   "backstab_crit",
		BonusValue:  1.0,
	},
	{
		Type: domain.SynergyFortress, Name: "Fortress",
		Description: "Reflect damage 300%, knockback immunity",
		WeaponReqs:  map[domain.WeaponType]int{domain.WeaponCrystalShield: 1},
		PassiveReqs: map[domain.PassiveType]int{domain.PassiveIronSkin: 3},
		BonusType:   "fortress_reflect",
		BonusValue:  3.0,
	},
	{
		Type: domain.SynergyCorruption, Name: "Corruption",
		Description: "DOT range 2x, lifesteal applies to DOT",
		WeaponReqs:  map[domain.WeaponType]int{domain.WeaponSoulDrain: 1, domain.WeaponVenomCloud: 1},
		BonusType:   "corruption_dot",
		BonusValue:  2.0,
	},
	{
		Type: domain.SynergyThunderGod, Name: "Thunder God",
		Description: "Stunned targets trigger chain lightning",
		WeaponReqs:  map[domain.WeaponType]int{domain.WeaponThunderClap: 1, domain.WeaponChainBolt: 1},
		BonusType:   "thunder_chain",
		BonusValue:  1.0,
	},
	{
		Type: domain.SynergyGravityMaster, Name: "Gravity Master",
		Description: "Black hole range 2x, also pulls orbs",
		WeaponReqs:  map[domain.WeaponType]int{domain.WeaponGravityBomb: 1},
		PassiveReqs: map[domain.PassiveType]int{domain.PassiveMagnet: 3},
		BonusType:   "gravity_enhance",
		BonusValue:  2.0,
	},
	{
		Type: domain.SynergyBerserker, Name: "Berserker",
		Description: "On kill: 3s double attack speed",
		PassiveReqs: map[domain.PassiveType]int{domain.PassiveFury: 5, domain.PassiveSwift: 3},
		BonusType:   "berserker_frenzy",
		BonusValue:  2.0,
	},
	{
		Type: domain.SynergyIronMaiden, Name: "Iron Maiden",
		Description: "Reflect 20% damage taken, 2x regen",
		PassiveReqs: map[domain.PassiveType]int{domain.PassiveIronSkin: 4, domain.PassiveVigor: 3},
		BonusType:   "iron_maiden_reflect",
		BonusValue:  0.20,
	},
	{
		Type: domain.SynergyGlassCannon, Name: "Glass Cannon",
		Description: "Crit damage 3x, but +50% damage taken",
		PassiveReqs: map[domain.PassiveType]int{domain.PassiveFury: 6, domain.PassivePrecision: 4},
		BonusType:   "glass_cannon_crit",
		BonusValue:  3.0,
	},
	{
		Type: domain.SynergySpeedster, Name: "Speedster",
		Description: "Dash cooldown removed, invincible during dash",
		PassiveReqs: map[domain.PassiveType]int{domain.PassiveSwift: 4, domain.PassiveHaste: 3},
		BonusType:   "speedster_dash",
		BonusValue:  1.0,
	},
}

// GetV14SynergyDef returns the synergy def for a given type.
func GetV14SynergyDef(st domain.V14SynergyType) *V14SynergyDef {
	for i := range AllV14Synergies {
		if AllV14Synergies[i].Type == st {
			return &AllV14Synergies[i]
		}
	}
	return nil
}

// ============================================================
// Synergy Detection
// ============================================================

// CheckSynergyRequirements checks if an agent meets a synergy's requirements.
func CheckSynergyRequirements(a *domain.Agent, def *V14SynergyDef) bool {
	// Check weapon requirements
	for wt, minLevel := range def.WeaponReqs {
		weaponLevel := GetWeaponLevel(a, wt)
		if weaponLevel < minLevel {
			return false
		}
	}

	// Check passive requirements
	passives := a.Passives
	if passives == nil {
		passives = make(map[domain.PassiveType]int)
	}
	for pt, minStacks := range def.PassiveReqs {
		if passives[pt] < minStacks {
			return false
		}
	}

	return true
}

// SynergyActivation describes a newly activated synergy.
type SynergyActivation struct {
	Type        domain.V14SynergyType
	Name        string
	Description string
}

// CheckAndActivateV14Synergies checks all synergies and activates newly met ones.
// Returns list of newly activated synergies (for client notification).
func CheckAndActivateV14Synergies(a *domain.Agent) []SynergyActivation {
	activeSynergies := make(map[domain.V14SynergyType]bool)
	for _, s := range a.V14Synergies {
		activeSynergies[s] = true
	}

	var newActivations []SynergyActivation

	for _, def := range AllV14Synergies {
		if activeSynergies[def.Type] {
			continue // Already active
		}
		if CheckSynergyRequirements(a, &def) {
			a.V14Synergies = append(a.V14Synergies, def.Type)
			newActivations = append(newActivations, SynergyActivation{
				Type:        def.Type,
				Name:        def.Name,
				Description: def.Description,
			})
		}
	}

	return newActivations
}

// HasV14Synergy checks if an agent has a specific synergy active.
func HasV14Synergy(a *domain.Agent, st domain.V14SynergyType) bool {
	for _, s := range a.V14Synergies {
		if s == st {
			return true
		}
	}
	return false
}

// ============================================================
// Synergy Completion Calculation (for hints)
// ============================================================

// calcSynergyCompletion returns how close an agent is to activating a synergy (0.0~1.0).
func calcSynergyCompletion(a *domain.Agent, def *V14SynergyDef) float64 {
	totalReqs := 0
	metReqs := 0

	for wt, minLevel := range def.WeaponReqs {
		totalReqs++
		weaponLevel := GetWeaponLevel(a, wt)
		if weaponLevel >= minLevel {
			metReqs++
		}
	}

	passives := a.Passives
	if passives == nil {
		passives = make(map[domain.PassiveType]int)
	}
	for pt, minStacks := range def.PassiveReqs {
		totalReqs++
		if passives[pt] >= minStacks {
			metReqs++
		} else if passives[pt] > 0 {
			// Partial credit for progress
			metReqs++ // Count as partial (we already started)
			// Reduce by missing fraction
			totalReqs++ // Add an extra requirement for partial
		}
	}

	if totalReqs == 0 {
		return 0
	}
	return float64(metReqs) / float64(totalReqs)
}

// describeMissingRequirements returns a human-readable string of what's missing.
func describeMissingRequirements(a *domain.Agent, def *V14SynergyDef) string {
	var missing []string

	for wt, minLevel := range def.WeaponReqs {
		weaponLevel := GetWeaponLevel(a, wt)
		if weaponLevel < minLevel {
			wd := domain.GetWeaponData(wt)
			name := string(wt)
			if wd != nil {
				name = wd.Name
			}
			if weaponLevel == 0 {
				missing = append(missing, fmt.Sprintf("Need %s", name))
			} else {
				missing = append(missing, fmt.Sprintf("Need %s Lv%d (have Lv%d)", name, minLevel, weaponLevel))
			}
		}
	}

	passives := a.Passives
	if passives == nil {
		passives = make(map[domain.PassiveType]int)
	}
	for pt, minStacks := range def.PassiveReqs {
		current := passives[pt]
		if current < minStacks {
			pDef := GetPassiveDef(pt)
			name := string(pt)
			if pDef != nil {
				name = pDef.Name
			}
			missing = append(missing, fmt.Sprintf("Need %s x%d (have %d)", name, minStacks, current))
		}
	}

	if len(missing) == 0 {
		return "Ready!"
	}
	return strings.Join(missing, ", ")
}

// ============================================================
// Synergy Effect Queries
// ============================================================

// GetV14SynergyBonusValue returns the bonus value if the agent has the synergy.
func GetV14SynergyBonusValue(a *domain.Agent, st domain.V14SynergyType) float64 {
	if !HasV14Synergy(a, st) {
		return 0
	}
	def := GetV14SynergyDef(st)
	if def == nil {
		return 0
	}
	return def.BonusValue
}

// HasThermalShock returns true if Thermal Shock synergy is active.
func HasThermalShock(a *domain.Agent) bool {
	return HasV14Synergy(a, domain.SynergyThermalShock)
}

// HasAssassinsMark returns true if Assassin's Mark synergy is active.
func HasAssassinsMark(a *domain.Agent) bool {
	return HasV14Synergy(a, domain.SynergyAssassinsMark)
}

// HasFortressSynergy returns true if Fortress synergy is active.
func HasFortressSynergy(a *domain.Agent) bool {
	return HasV14Synergy(a, domain.SynergyFortress)
}

// HasCorruption returns true if Corruption synergy is active.
func HasCorruption(a *domain.Agent) bool {
	return HasV14Synergy(a, domain.SynergyCorruption)
}

// HasThunderGod returns true if Thunder God synergy is active.
func HasThunderGod(a *domain.Agent) bool {
	return HasV14Synergy(a, domain.SynergyThunderGod)
}

// HasGravityMasterV14 returns true if Gravity Master synergy is active.
func HasGravityMasterV14(a *domain.Agent) bool {
	return HasV14Synergy(a, domain.SynergyGravityMaster)
}

// HasBerserkerV14 returns true if Berserker synergy is active.
func HasBerserkerV14(a *domain.Agent) bool {
	return HasV14Synergy(a, domain.SynergyBerserker)
}

// HasIronMaiden returns true if Iron Maiden synergy is active.
func HasIronMaiden(a *domain.Agent) bool {
	return HasV14Synergy(a, domain.SynergyIronMaiden)
}

// HasGlassCannonV14 returns true if Glass Cannon synergy is active.
func HasGlassCannonV14(a *domain.Agent) bool {
	return HasV14Synergy(a, domain.SynergyGlassCannon)
}

// HasSpeedsterV14 returns true if Speedster synergy is active.
func HasSpeedsterV14(a *domain.Agent) bool {
	return HasV14Synergy(a, domain.SynergySpeedster)
}
