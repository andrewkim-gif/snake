package game

import (
	"github.com/andrewkim-gif/snake/server/internal/domain"
)

// ============================================================
// v14 Phase 3: Weapon Evolution System (S15)
// Duplicate weapon acquisition → Lv2~5 auto-evolution
// Lv2(+30% DMG), Lv3(+25% range), Lv4(-20% CD), Lv5(ultimate)
// Lv5 weapons excluded from level-up choices
// ============================================================

// EvolveWeapon attempts to evolve a weapon when the same type is acquired.
// Returns the new level (or 0 if not evolved).
func EvolveWeapon(a *domain.Agent, weaponType domain.WeaponType) int {
	for i := range a.WeaponSlots {
		if a.WeaponSlots[i].Type == weaponType {
			if a.WeaponSlots[i].Level >= domain.MaxWeaponLevel {
				return 0 // Already at max
			}
			a.WeaponSlots[i].Level++
			return a.WeaponSlots[i].Level
		}
	}
	return 0 // Weapon not found
}

// GetEffectiveWeaponDPS returns the effective DPS for a weapon at its current level.
// Includes evolution multiplier + Fury passive bonus.
func GetEffectiveWeaponDPS(a *domain.Agent, slot *domain.WeaponSlot) float64 {
	wd := domain.GetWeaponData(slot.Type)
	if wd == nil {
		return 0
	}
	evo := domain.GetEvolutionData(slot.Level)
	if evo == nil {
		return wd.BaseDPS
	}

	baseDPS := wd.BaseDPS * evo.DPSMult
	// Apply Fury passive
	furyMult := GetV14DamageMultiplier(a)
	return baseDPS * furyMult
}

// GetEffectiveWeaponRange returns the effective range for a weapon at its current level.
// Includes evolution multiplier.
func GetEffectiveWeaponRange(a *domain.Agent, slot *domain.WeaponSlot) float64 {
	wd := domain.GetWeaponData(slot.Type)
	if wd == nil {
		return 0
	}
	evo := domain.GetEvolutionData(slot.Level)
	if evo == nil {
		return wd.Range
	}
	return wd.Range * evo.RangeMult
}

// GetEffectiveWeaponCooldown returns the effective cooldown in ticks for a weapon.
// Includes evolution multiplier + Haste passive.
func GetEffectiveWeaponCooldown(a *domain.Agent, slot *domain.WeaponSlot) int {
	wd := domain.GetWeaponData(slot.Type)
	if wd == nil || wd.CooldownSec == 0 {
		return 0 // Continuous weapons (Crystal Shield, Soul Drain)
	}
	evo := domain.GetEvolutionData(slot.Level)
	if evo == nil {
		return int(wd.CooldownSec * float64(TickRate))
	}

	cdSec := wd.CooldownSec * evo.CooldownMult
	// Apply Haste passive (reduces cooldown)
	hasteReduction := GetV14CooldownReduction(a)
	cdSec *= (1.0 - hasteReduction)
	if cdSec < 0.2 {
		cdSec = 0.2 // Minimum 0.2s cooldown
	}
	return int(cdSec * float64(TickRate))
}

// GetEffectiveWeaponAOE returns the AOE range multiplier (Blast passive).
func GetEffectiveWeaponAOE(a *domain.Agent) float64 {
	return GetV14AOEMultiplier(a)
}

// IsWeaponAtMax returns true if a weapon is at max level (Lv5).
func IsWeaponAtMax(a *domain.Agent, weaponType domain.WeaponType) bool {
	return GetWeaponLevel(a, weaponType) >= domain.MaxWeaponLevel
}

// CountMaxedWeapons returns the number of weapons at Lv5.
func CountMaxedWeapons(a *domain.Agent) int {
	count := 0
	for _, slot := range a.WeaponSlots {
		if slot.Level >= domain.MaxWeaponLevel {
			count++
		}
	}
	return count
}

// GetAvailableWeaponsForChoice returns weapons that can appear in level-up choices.
// Excludes Lv5 weapons (from evolution pool) and new weapons if slots are full.
func GetAvailableWeaponsForChoice(a *domain.Agent) []domain.WeaponType {
	result := make([]domain.WeaponType, 0)

	// Existing weapons not at Lv5 (evolution choices)
	for _, slot := range a.WeaponSlots {
		if slot.Level < domain.MaxWeaponLevel {
			result = append(result, slot.Type)
		}
	}

	// New weapons (if slots available)
	if len(a.WeaponSlots) < domain.MaxWeaponSlots {
		for _, wt := range domain.AllWeaponTypes {
			if !HasWeapon(a, wt) {
				result = append(result, wt)
			}
		}
	}

	return result
}

// ============================================================
// Ultimate Weapon Transforms (Lv5)
// ============================================================

// UltimateEffect describes the special effect of a Lv5 weapon.
type UltimateEffect struct {
	WeaponType   domain.WeaponType `json:"weaponType"`
	Name         string            `json:"name"`
	Description  string            `json:"description"`
	ExtraTargets int               `json:"extraTargets,omitempty"`  // Chain/multi-target count bonus
	RangeMult    float64           `json:"rangeMult,omitempty"`     // Range multiplier bonus
	DurationMult float64           `json:"durationMult,omitempty"`  // Duration multiplier
	DPSMult      float64           `json:"dpsMult,omitempty"`       // DPS multiplier
	SpecialFlag  string            `json:"specialFlag,omitempty"`   // Special behavior flag
}

// UltimateEffects maps each weapon to its Lv5 special behavior.
var UltimateEffects = map[domain.WeaponType]UltimateEffect{
	domain.WeaponBonkMallet: {
		WeaponType: domain.WeaponBonkMallet,
		Name:       "Earthquake",
		Description: "360 degree shockwave + crack zone",
		SpecialFlag: "full_circle", // Changes from 120° to 360°
		DPSMult:     1.5,
	},
	domain.WeaponChainBolt: {
		WeaponType:   domain.WeaponChainBolt,
		Name:         "Storm Network",
		Description:  "5-chain + residual lightning field",
		ExtraTargets: 2,            // 3 → 5 chains
		SpecialFlag:  "lightning_field",
	},
	domain.WeaponFlameRing: {
		WeaponType:  domain.WeaponFlameRing,
		Name:        "Inferno",
		Description: "Double ring + piercing",
		DPSMult:     2.0,          // Double damage (two rings)
		SpecialFlag: "pierce",
	},
	domain.WeaponFrostShards: {
		WeaponType:  domain.WeaponFrostShards,
		Name:        "Blizzard",
		Description: "360 degree ice storm",
		SpecialFlag: "full_circle", // Changes from 45° cone to 360°
		DPSMult:     1.5,
	},
	domain.WeaponShadowStrike: {
		WeaponType:   domain.WeaponShadowStrike,
		Name:         "Phantom Dance",
		Description:  "Triple teleport + clone",
		ExtraTargets: 2,            // 1 → 3 teleport strikes
		SpecialFlag:  "clone",
	},
	domain.WeaponThunderClap: {
		WeaponType:  domain.WeaponThunderClap,
		Name:        "Judgment",
		Description: "Map-wide lightning + 5s stun (once per epoch)",
		RangeMult:   10.0,          // Map-wide
		SpecialFlag: "once_per_epoch",
	},
	domain.WeaponVenomCloud: {
		WeaponType:   domain.WeaponVenomCloud,
		Name:         "Plague",
		Description:  "Moving cloud + infection spread",
		DurationMult: 2.0,
		SpecialFlag:  "moving_infection",
	},
	domain.WeaponCrystalShield: {
		WeaponType:   domain.WeaponCrystalShield,
		Name:         "Diamond Fortress",
		Description:  "5 orbitals + 200% reflect",
		ExtraTargets: 2,            // 3 → 5 orbitals
		DPSMult:      2.0,          // 200% reflect
	},
	domain.WeaponGravityBomb: {
		WeaponType:   domain.WeaponGravityBomb,
		Name:         "Singularity",
		Description:  "5s black hole + 2x radius",
		DurationMult: 2.5,          // 2s → 5s
		RangeMult:    2.0,
	},
	domain.WeaponSoulDrain: {
		WeaponType:  domain.WeaponSoulDrain,
		Name:        "Life Siphon",
		Description: "Frontal cone + ally heal",
		SpecialFlag: "cone_heal",   // Changes from beam to cone + ally heal
		DPSMult:     1.5,
	},
}

// GetUltimateEffect returns the ultimate effect for a weapon (nil if not at Lv5).
func GetUltimateEffect(a *domain.Agent, weaponType domain.WeaponType) *UltimateEffect {
	if GetWeaponLevel(a, weaponType) < domain.MaxWeaponLevel {
		return nil
	}
	eff, ok := UltimateEffects[weaponType]
	if !ok {
		return nil
	}
	return &eff
}

// IsUltimateActive checks if a specific weapon has reached its ultimate form.
func IsUltimateActive(a *domain.Agent, weaponType domain.WeaponType) bool {
	return GetWeaponLevel(a, weaponType) >= domain.MaxWeaponLevel
}

// GetEffectiveChainCount returns the chain count for Chain Bolt (base + ultimate bonus).
func GetEffectiveChainCount(a *domain.Agent) int {
	wd := domain.GetWeaponData(domain.WeaponChainBolt)
	if wd == nil {
		return 3
	}
	count := wd.ChainCount
	ult := GetUltimateEffect(a, domain.WeaponChainBolt)
	if ult != nil {
		count += ult.ExtraTargets
	}
	return count
}

// GetEffectiveOrbitalCount returns the orbital count for Crystal Shield.
func GetEffectiveOrbitalCount(a *domain.Agent) int {
	wd := domain.GetWeaponData(domain.WeaponCrystalShield)
	if wd == nil {
		return 3
	}
	count := wd.OrbitalCount
	ult := GetUltimateEffect(a, domain.WeaponCrystalShield)
	if ult != nil {
		count += ult.ExtraTargets
	}
	return count
}
