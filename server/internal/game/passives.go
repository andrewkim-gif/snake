package game

import (
	"github.com/andrewkim-gif/snake/server/internal/domain"
)

// ============================================================
// v14 Phase 3: Passive System (S16)
// 10 passives with stacking effects
// ============================================================

// PassiveDef defines a passive upgrade's properties.
type PassiveDef struct {
	Type           domain.PassiveType `json:"type"`
	Name           string             `json:"name"`
	Description    string             `json:"description"`
	EffectPerStack float64            `json:"effectPerStack"`
	MaxStack       int                `json:"maxStack"`
}

// AllPassives defines all 10 v14 passive upgrades.
var AllPassives = []PassiveDef{
	{
		Type: domain.PassiveVigor, Name: "Vigor",
		Description:    "+15% max HP per stack",
		EffectPerStack: 0.15, MaxStack: 6,
	},
	{
		Type: domain.PassiveSwift, Name: "Swift",
		Description:    "+12% move speed per stack",
		EffectPerStack: 0.12, MaxStack: 5,
	},
	{
		Type: domain.PassiveFury, Name: "Fury",
		Description:    "+15% weapon damage per stack",
		EffectPerStack: 0.15, MaxStack: 8,
	},
	{
		Type: domain.PassiveIronSkin, Name: "Iron Skin",
		Description:    "-12% damage taken per stack",
		EffectPerStack: 0.12, MaxStack: 6,
	},
	{
		Type: domain.PassiveMagnet, Name: "Magnet",
		Description:    "+25% pickup range per stack",
		EffectPerStack: 0.25, MaxStack: 5,
	},
	{
		Type: domain.PassiveFortune, Name: "Fortune",
		Description:    "+15% rare upgrade chance per stack",
		EffectPerStack: 0.15, MaxStack: 5,
	},
	{
		Type: domain.PassiveVitality, Name: "Vitality",
		Description:    "+2 HP/s regen per stack",
		EffectPerStack: 2.0, MaxStack: 5, // 2 HP/s per stack
	},
	{
		Type: domain.PassivePrecision, Name: "Precision",
		Description:    "+8% critical hit chance per stack",
		EffectPerStack: 0.08, MaxStack: 6,
	},
	{
		Type: domain.PassiveBlast, Name: "Blast",
		Description:    "+15% AOE size per stack",
		EffectPerStack: 0.15, MaxStack: 5,
	},
	{
		Type: domain.PassiveHaste, Name: "Haste",
		Description:    "-8% weapon cooldown per stack",
		EffectPerStack: 0.08, MaxStack: 5,
	},
}

// GetPassiveDef returns the PassiveDef for a given type, or nil if not found.
func GetPassiveDef(pt domain.PassiveType) *PassiveDef {
	for i := range AllPassives {
		if AllPassives[i].Type == pt {
			return &AllPassives[i]
		}
	}
	return nil
}

// ============================================================
// Passive Effect Calculations
// ============================================================

// GetPassiveStacks returns the number of stacks for a passive type.
func GetPassiveStacks(a *domain.Agent, pt domain.PassiveType) int {
	if a.Passives == nil {
		return 0
	}
	return a.Passives[pt]
}

// GetPassiveEffect returns the total effect value for a passive type.
func GetPassiveEffect(a *domain.Agent, pt domain.PassiveType) float64 {
	stacks := GetPassiveStacks(a, pt)
	if stacks == 0 {
		return 0
	}
	def := GetPassiveDef(pt)
	if def == nil {
		return 0
	}
	return float64(stacks) * def.EffectPerStack
}

// RecalcPassiveEffects recalculates all stat effects from passives.
func RecalcPassiveEffects(a *domain.Agent) {
	// Vigor: +15% max HP per stack
	vigorBonus := GetPassiveEffect(a, domain.PassiveVigor)
	baseHP := BaseHP + float64(a.Level-1)*HPPerLevel
	a.MaxHP = baseHP * (1.0 + vigorBonus)
	if a.HP > a.MaxHP {
		a.HP = a.MaxHP
	}

	// Precision: +8% crit chance per stack
	a.CritChance = BaseCritChance + GetPassiveEffect(a, domain.PassivePrecision)
	if a.CritChance > 1.0 {
		a.CritChance = 1.0
	}

	// IronSkin: -12% damage taken per stack → stored in Defense
	a.Defense = GetPassiveEffect(a, domain.PassiveIronSkin)
	if a.Defense > 0.90 {
		a.Defense = 0.90 // Cap at 90% reduction
	}
}

// GetV14SpeedMultiplier returns the speed multiplier from Swift passive.
func GetV14SpeedMultiplier(a *domain.Agent) float64 {
	return 1.0 + GetPassiveEffect(a, domain.PassiveSwift)
}

// GetV14DamageMultiplier returns the damage multiplier from Fury passive.
func GetV14DamageMultiplier(a *domain.Agent) float64 {
	return 1.0 + GetPassiveEffect(a, domain.PassiveFury)
}

// GetV14PickupRange returns the modified pickup range from Magnet passive.
func GetV14PickupRange(a *domain.Agent) float64 {
	return OrbCollectRadius * (1.0 + GetPassiveEffect(a, domain.PassiveMagnet))
}

// GetV14HPRegen returns HP regen per second from Vitality passive.
func GetV14HPRegen(a *domain.Agent) float64 {
	return GetPassiveEffect(a, domain.PassiveVitality)
}

// GetV14CooldownReduction returns the cooldown reduction fraction from Haste.
func GetV14CooldownReduction(a *domain.Agent) float64 {
	return GetPassiveEffect(a, domain.PassiveHaste)
}

// GetV14AOEMultiplier returns the AOE size multiplier from Blast.
func GetV14AOEMultiplier(a *domain.Agent) float64 {
	return 1.0 + GetPassiveEffect(a, domain.PassiveBlast)
}

// GetV14FortuneChance returns the rare upgrade chance bonus from Fortune.
func GetV14FortuneChance(a *domain.Agent) float64 {
	return GetPassiveEffect(a, domain.PassiveFortune)
}

// ApplyVitalityRegen applies HP regeneration from Vitality passive (per tick).
func ApplyVitalityRegen(a *domain.Agent) {
	hpPerSec := GetV14HPRegen(a)
	if hpPerSec <= 0 {
		return
	}
	hpPerTick := hpPerSec / float64(TickRate)
	a.HP += hpPerTick
	if a.HP > a.MaxHP {
		a.HP = a.MaxHP
	}
}

// ApplyV14DamageReduction applies IronSkin damage reduction.
// Returns the effective damage after reduction.
func ApplyV14DamageReduction(a *domain.Agent, rawDamage float64) float64 {
	reduction := a.Defense
	effective := rawDamage * (1.0 - reduction)
	if effective < 0 {
		effective = 0
	}
	return effective
}
