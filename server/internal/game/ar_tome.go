package game

import (
	"math"
	"math/rand"
)

// ============================================================
// Arena Tome System — 16 Tomes (v18 Phase 2)
// ============================================================

// ARTomeDef is the static definition of a tome.
type ARTomeDef struct {
	ID        ARTomeID `json:"id"`
	Name      string   `json:"name"`
	PerStack  float64  `json:"perStack"`  // base effect per stack
	MaxStacks int      `json:"maxStacks"`
	Tag       string   `json:"tag"` // attack, defense, movement, growth, utility, risk
	Desc      string   `json:"desc"`
}

// AllTomeDefs returns the full registry of tome definitions.
func AllTomeDefs() map[ARTomeID]*ARTomeDef {
	return tomeRegistry
}

// GetTomeDef returns the definition for a tome ID.
func GetTomeDef(id ARTomeID) *ARTomeDef {
	return tomeRegistry[id]
}

// tomeRegistry defines all 16 tomes.
var tomeRegistry = map[ARTomeID]*ARTomeDef{
	// ── Attack Tomes ──────────────────────────────────────────
	ARTomeDamage: {
		ID: ARTomeDamage, Name: "Damage",
		PerStack: 0.15, MaxStacks: 10, Tag: "attack",
		Desc: "+15% damage per stack",
	},
	ARTomeAttackSpeed: {
		ID: ARTomeAttackSpeed, Name: "Attack Speed",
		PerStack: 0.10, MaxStacks: 10, Tag: "attack",
		Desc: "+10% attack speed per stack",
	},
	ARTomeCritChance: {
		ID: ARTomeCritChance, Name: "Crit Chance",
		PerStack: 8.0, MaxStacks: 15, Tag: "attack",
		Desc: "+8% crit chance per stack",
	},
	ARTomeCritDamage: {
		ID: ARTomeCritDamage, Name: "Crit Damage",
		PerStack: 0.20, MaxStacks: 10, Tag: "attack",
		Desc: "+20% crit multiplier per stack",
	},
	ARTomeArea: {
		ID: ARTomeArea, Name: "Area",
		PerStack: 0.12, MaxStacks: 10, Tag: "attack",
		Desc: "+12% AOE range per stack",
	},
	ARTomeProjectile: {
		ID: ARTomeProjectile, Name: "Projectile",
		PerStack: 1.0, MaxStacks: 5, Tag: "attack",
		Desc: "+1 projectile & +1 pierce per stack",
	},

	// ── Movement Tome ─────────────────────────────────────────
	ARTomeSpeed: {
		ID: ARTomeSpeed, Name: "Speed",
		PerStack: 0.08, MaxStacks: 10, Tag: "movement",
		Desc: "+8% move speed, +20 stamina per stack",
	},

	// ── Defense Tomes ─────────────────────────────────────────
	ARTomeHP: {
		ID: ARTomeHP, Name: "HP",
		PerStack: 0.10, MaxStacks: 10, Tag: "defense",
		Desc: "+10% max HP, +1 HP regen/s per stack",
	},
	ARTomeShield: {
		ID: ARTomeShield, Name: "Shield",
		PerStack: 1.0, MaxStacks: 5, Tag: "defense",
		Desc: "Block 1 hit per 10s (reduces CD per stack)",
	},
	ARTomeThorns: {
		ID: ARTomeThorns, Name: "Thorns",
		PerStack: 15.0, MaxStacks: 5, Tag: "defense",
		Desc: "Reflect 15% of damage taken per stack",
	},
	ARTomeDodge: {
		ID: ARTomeDodge, Name: "Dodge",
		PerStack: 5.0, MaxStacks: 10, Tag: "defense",
		Desc: "+5% dodge chance per stack",
	},

	// ── Utility Tome ──────────────────────────────────────────
	ARTomeKnockback: {
		ID: ARTomeKnockback, Name: "Knockback",
		PerStack: 0.20, MaxStacks: 5, Tag: "utility",
		Desc: "+20% knockback, +10% knockback resist per stack",
	},

	// ── Growth Tomes ──────────────────────────────────────────
	ARTomeXP: {
		ID: ARTomeXP, Name: "XP Boost",
		PerStack: 0.15, MaxStacks: 10, Tag: "growth",
		Desc: "+15% XP gain per stack",
	},
	ARTomeLuck: {
		ID: ARTomeLuck, Name: "Luck",
		PerStack: 10.0, MaxStacks: 10, Tag: "growth",
		Desc: "+10% rare tome/item chance per stack",
	},
	ARTomeMagnet: {
		ID: ARTomeMagnet, Name: "Magnet",
		PerStack: 1.0, MaxStacks: 10, Tag: "growth",
		Desc: "+1m XP collection range per stack",
	},

	// ── Risk Tome ─────────────────────────────────────────────
	ARTomeCursed: {
		ID: ARTomeCursed, Name: "Cursed",
		PerStack: 1.0, MaxStacks: 5, Tag: "risk",
		Desc: "+15% enemies, +10% enemy HP, +25% XP per stack",
	},
}

// ============================================================
// Critical Hit System (Overcritical)
// ============================================================

// calcCritCount determines how many crits occur (overcritical system).
// critChance is in percentage (e.g. 105 = 105%).
func calcCritCount(critChance float64) int {
	guaranteed := int(critChance / 100.0)
	remainder := math.Mod(critChance, 100.0)
	extra := 0
	if rand.Float64()*100 < remainder {
		extra = 1
	}
	return guaranteed + extra
}

// calcCritMultiplier returns the damage multiplier for a given crit count.
// baseCritMult is the base multiplier (default 2.0 + CritDamage tome bonus).
func calcCritMultiplier(critCount int, baseCritMult float64) float64 {
	switch {
	case critCount <= 0:
		return 1.0
	case critCount == 1:
		return baseCritMult
	default:
		// Overcritical: (critCount * 0.5)^2 + critCount * (baseCritMult - 1)
		half := float64(critCount) * 0.5
		return half*half + float64(critCount)*(baseCritMult-1)
	}
}

// ============================================================
// Diminishing Returns
// ============================================================

// DimReturn calculates the effective value of stacking with diminishing returns.
// For stacks < 5: linear. For stacks >= 5: base * n^0.85
func DimReturn(stacks int, perStack float64) float64 {
	n := float64(stacks)
	if n <= 0 {
		return 0
	}
	if n < 5 {
		return perStack * n
	}
	return perStack * math.Pow(n, 0.85)
}

// ============================================================
// Tome Effect Application
// ============================================================

// RecomputeAllStats recalculates all derived player stats from tomes and equipment.
// This replaces the Phase 1 recomputePlayerStats and adds new stats.
func RecomputeAllStats(player *ARPlayer) {
	t := player.Tomes

	// Damage: +15% per stack (dim)
	player.DamageMult = 1.0 + DimReturn(t[ARTomeDamage], 0.15)

	// Attack speed: +10% per stack (dim)
	player.AttackSpeedMult = 1.0 + DimReturn(t[ARTomeAttackSpeed], 0.10)

	// Crit chance: base 5% + 8% per stack (dim)
	player.CritChance = 5.0 + DimReturn(t[ARTomeCritChance], 8.0)

	// Crit damage multiplier: base 2.0 + 0.20 per stack (dim)
	player.CritDamageMult = 2.0 + DimReturn(t[ARTomeCritDamage], 0.20)

	// Area: +12% per stack (dim)
	player.AreaMult = 1.0 + DimReturn(t[ARTomeArea], 0.12)

	// Projectile: +1 per stack (no dim, low max)
	player.ProjectileExtra = t[ARTomeProjectile]
	player.PierceExtra = t[ARTomeProjectile]

	// Speed: +8% per stack (dim)
	player.SpeedMult = 1.0 + DimReturn(t[ARTomeSpeed], 0.08)

	// Dodge: +5% per stack (dim), cap at 75%
	player.DodgeChance = DimReturn(t[ARTomeDodge], 5.0)
	if player.DodgeChance > 75.0 {
		player.DodgeChance = 75.0
	}

	// Magnet: base 2m + 1m per stack (linear)
	player.MagnetRange = ARXPMagnetBase + float64(t[ARTomeMagnet])*ARXPMagnetPerTome

	// XP multiplier: +15% per stack (dim)
	player.XPMult = 1.0 + DimReturn(t[ARTomeXP], 0.15)

	// Knockback: +20% per stack (dim)
	player.KnockbackMult = 1.0 + DimReturn(t[ARTomeKnockback], 0.20)

	// Thorns: 15% per stack (dim)
	player.ThornsPct = DimReturn(t[ARTomeThorns], 15.0)

	// Equipment bonuses
	for _, eq := range player.Equipment {
		applyEquipmentStats(player, eq)
	}
}

// applyEquipmentStats adds equipment passive bonuses.
func applyEquipmentStats(player *ARPlayer, itemID ARItemID) {
	switch itemID {
	case ARItemIronBoots:
		// knockback resist handled in combat
	case ARItemFeatherCape:
		// double jump handled in movement
	case ARItemVampireRing:
		player.LifestealPct += 3.0
	case ARItemBerserkerHelm:
		// conditional: +40% damage below 50% HP (checked in combat)
	case ARItemCrownOfThorns:
		player.ThornsPct += 25.0
	case ARItemMagnetAmulet:
		player.MagnetRange += 5.0
	case ARItemGlassCannon:
		player.DamageMult *= 1.60
		// +40% received damage handled in combat
	case ARItemFrozenHeart:
		// 30% chance to freeze on hit (checked in combat)
	case ARItemLuckyClover:
		// equivalent to Luck ×3
		player.XPMult += DimReturn(3, 0.15)
	case ARItemTitanBelt:
		// +30% HP, knockback immune (checked in combat)
	}
}

// ============================================================
// Status Effect Tick Processing
// ============================================================

// TickStatusEffectsEnemy processes status effects on enemies.
func TickStatusEffectsEnemy(enemy *AREnemy, delta float64) float64 {
	totalDot := 0.0
	active := enemy.StatusEffects[:0]

	for _, se := range enemy.StatusEffects {
		se.Remaining -= delta
		if se.Remaining <= 0 {
			continue
		}

		switch se.Effect {
		case ARStatusBurn:
			// 0.5% max HP/s per stack
			dot := enemy.MaxHP * 0.005 * float64(se.Stacks) * delta
			enemy.HP -= dot
			totalDot += dot

		case ARStatusFreeze:
			// Slow: applied in enemy movement tick
			// 3 stacks = 1s complete freeze (handled externally)

		case ARStatusShock:
			// Next hit +30% damage (handled in damage calc)

		case ARStatusPoison:
			// 1% max HP/s per stack + heal reduction
			dot := enemy.MaxHP * 0.01 * float64(se.Stacks) * delta
			enemy.HP -= dot
			totalDot += dot

		case ARStatusBleed:
			// 0.3% max HP/s per stack when moving (always assume moving for enemies)
			dot := enemy.MaxHP * 0.003 * float64(se.Stacks) * delta
			enemy.HP -= dot
			totalDot += dot

		case ARStatusMark:
			// +15% damage received (applied in damage calc)
		}

		active = append(active, se)
	}

	enemy.StatusEffects = active
	if enemy.HP < 0 {
		enemy.HP = 0
	}
	return totalDot
}

// TickStatusEffectsPlayer processes status effects on players.
func TickStatusEffectsPlayer(player *ARPlayer, delta float64) float64 {
	totalDot := 0.0
	active := player.StatusEffects[:0]

	for _, se := range player.StatusEffects {
		se.Remaining -= delta
		if se.Remaining <= 0 {
			continue
		}

		switch se.Effect {
		case ARStatusBurn:
			dot := player.MaxHP * 0.005 * float64(se.Stacks) * delta
			player.HP -= dot
			totalDot += dot

		case ARStatusFreeze:
			// Slow: handled in movement tick

		case ARStatusPoison:
			dot := player.MaxHP * 0.01 * float64(se.Stacks) * delta
			player.HP -= dot
			totalDot += dot

		case ARStatusBleed:
			// Only ticks when moving
			if player.Vel.X != 0 || player.Vel.Z != 0 {
				dot := player.MaxHP * 0.003 * float64(se.Stacks) * delta
				player.HP -= dot
				totalDot += dot
			}
		}

		active = append(active, se)
	}

	player.StatusEffects = active
	if player.HP < 0 {
		player.HP = 0
	}
	return totalDot
}

// HasStatusEffect checks if an entity has a specific status effect.
func HasStatusEffect(effects []ARStatusInstance, effect ARStatusEffect) (bool, int) {
	for _, se := range effects {
		if se.Effect == effect {
			return true, se.Stacks
		}
	}
	return false, 0
}

// EnemyFreezeSpeedMult returns the speed multiplier from freeze stacks.
func EnemyFreezeSpeedMult(enemy *AREnemy) float64 {
	has, stacks := HasStatusEffect(enemy.StatusEffects, ARStatusFreeze)
	if !has {
		return 1.0
	}
	if stacks >= 3 {
		return 0.0 // completely frozen
	}
	return 1.0 - float64(stacks)*0.25 // -25% per stack
}

// ShockDamageBonus returns extra damage multiplier if target has Shock.
func ShockDamageBonus(effects []ARStatusInstance) float64 {
	has, _ := HasStatusEffect(effects, ARStatusShock)
	if has {
		return 1.30
	}
	return 1.0
}

// MarkDamageBonus returns extra damage multiplier if target has Blood Mark.
func MarkDamageBonus(effects []ARStatusInstance) float64 {
	has, _ := HasStatusEffect(effects, ARStatusMark)
	if has {
		return 1.15
	}
	return 1.0
}

// ============================================================
// Shield Tome Tick
// ============================================================

// TickShieldCooldown updates the shield cooldown for a player.
func TickShieldCooldown(player *ARPlayer, delta float64) {
	shieldStacks := player.Tomes[ARTomeShield]
	if shieldStacks <= 0 {
		return
	}

	if player.ShieldCooldown > 0 {
		player.ShieldCooldown -= delta
	}
}

// ShieldCanBlock returns true if the player's shield is ready.
func ShieldCanBlock(player *ARPlayer) bool {
	shieldStacks := player.Tomes[ARTomeShield]
	if shieldStacks <= 0 {
		return false
	}
	return player.ShieldCooldown <= 0
}

// ShieldBlock consumes the shield charge and starts cooldown.
func ShieldBlock(player *ARPlayer) {
	// CD = 10s / stacks (more stacks = faster recharge)
	stacks := float64(player.Tomes[ARTomeShield])
	if stacks < 1 {
		stacks = 1
	}
	player.ShieldCooldown = 10.0 / stacks
}

// ============================================================
// HP Regen from HP Tome
// ============================================================

// TickHPRegen regenerates HP for players with HP tome stacks.
func TickHPRegen(player *ARPlayer, delta float64) {
	stacks := player.Tomes[ARTomeHP]
	if stacks <= 0 || !player.Alive {
		return
	}

	// +1 HP/s per stack
	regen := float64(stacks) * delta
	player.HP += regen
	if player.HP > player.MaxHP {
		player.HP = player.MaxHP
	}
}

// ============================================================
// Cursed Tome Effects
// ============================================================

// CursedEnemyCountMult returns the enemy count multiplier from Cursed tome.
func CursedEnemyCountMult(player *ARPlayer) float64 {
	stacks := player.Tomes[ARTomeCursed]
	if stacks <= 0 {
		return 1.0
	}
	return 1.0 + float64(stacks)*0.15
}

// CursedEnemyHPMult returns the enemy HP multiplier from Cursed tome.
func CursedEnemyHPMult(player *ARPlayer) float64 {
	stacks := player.Tomes[ARTomeCursed]
	if stacks <= 0 {
		return 1.0
	}
	return 1.0 + float64(stacks)*0.10
}

// CursedXPBonusMult returns the XP bonus from Cursed tome.
func CursedXPBonusMult(player *ARPlayer) float64 {
	stacks := player.Tomes[ARTomeCursed]
	if stacks <= 0 {
		return 1.0
	}
	return 1.0 + float64(stacks)*0.25
}
