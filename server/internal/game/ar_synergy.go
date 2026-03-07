package game

// ============================================================
// Arena Synergy System — 10 Synergies (v18 Phase 3)
// ============================================================

// ARSynergyDef defines a synergy combination and its bonus.
type ARSynergyDef struct {
	ID          ARSynergyID `json:"id"`
	Name        string      `json:"name"`
	Description string      `json:"desc"`
}

// AllSynergyDefs returns the registry of all synergies.
func AllSynergyDefs() map[ARSynergyID]*ARSynergyDef {
	return synergyRegistry
}

// GetSynergyDef returns the definition for a synergy ID.
func GetSynergyDef(id ARSynergyID) *ARSynergyDef {
	return synergyRegistry[id]
}

var synergyRegistry = map[ARSynergyID]*ARSynergyDef{
	ARSynergyInfernal: {
		ID: ARSynergyInfernal, Name: "Infernal",
		Description: "Fire weapon + Damage ×3 + Area ×2: +50% fire damage, burn spreads to nearby enemies",
	},
	ARSynergyBlizzard: {
		ID: ARSynergyBlizzard, Name: "Blizzard",
		Description: "Frost weapon + Speed ×3 + Area ×2: movement trail creates freezing field",
	},
	ARSynergyThunderGod: {
		ID: ARSynergyThunderGod, Name: "Thunder God",
		Description: "Lightning weapon + Crit ×3 + Attack Speed ×3: crits auto-fire chain lightning",
	},
	ARSynergyPlagueDoc: {
		ID: ARSynergyPlagueDoc, Name: "Plague Doctor",
		Description: "Poison weapon + Curse ×2 + HP ×3: poison damage ×2, poison kills heal 5% HP",
	},
	ARSynergyJuggernaut: {
		ID: ARSynergyJuggernaut, Name: "Juggernaut",
		Description: "Shield ×3 + HP ×3 + Thorns ×3: shield block creates shockwave, 50% reflection",
	},
	ARSynergyGlassCannon: {
		ID: ARSynergyGlassCannon, Name: "Glass Cannon",
		Description: "Damage ×5 + Crit ×5 + HP =0: damage ×2 but HP locked at 1",
	},
	ARSynergySpeedDemon: {
		ID: ARSynergySpeedDemon, Name: "Speed Demon",
		Description: "Speed ×5 + Dodge ×5: speed-proportional damage bonus, afterimage generation",
	},
	ARSynergyHolyTrinity: {
		ID: ARSynergyHolyTrinity, Name: "Holy Trinity",
		Description: "XP ×5 + Luck ×5 + Cursed ×3: XP ×3, +5% Legendary chance per level-up",
	},
	ARSynergyVampireLord: {
		ID: ARSynergyVampireLord, Name: "Vampire Lord",
		Description: "Crit ×3 + Vampire Ring + Berserker Helm: crit lifesteal, below 50% HP lifesteal ×3",
	},
	ARSynergyFortress: {
		ID: ARSynergyFortress, Name: "Fortress",
		Description: "Aegis + Shield ×3 + Thorns ×2 + Guardian: 360° shield, block success = 2s invincibility",
	},
}

// ============================================================
// Synergy Activation Check
// ============================================================

// CheckSynergies evaluates all synergies for a player and returns active ones.
func CheckSynergies(player *ARPlayer) []ARSynergyID {
	var active []ARSynergyID

	t := player.Tomes

	// Helper: check if player has a weapon of a specific damage type
	hasFireWeapon := playerHasWeaponOfDamageType(player, ARDmgFire)
	hasFrostWeapon := playerHasWeaponOfDamageType(player, ARDmgFrost)
	hasLightningWeapon := playerHasWeaponOfDamageType(player, ARDmgLightning)
	hasPoisonWeapon := playerHasWeaponOfDamageType(player, ARDmgPoison)
	hasAegis := playerHasWeapon(player, ARWeaponAegis)

	// Infernal: Fire weapon + Damage ×3 + Area ×2
	if hasFireWeapon && t[ARTomeDamage] >= 3 && t[ARTomeArea] >= 2 {
		active = append(active, ARSynergyInfernal)
	}

	// Blizzard: Frost weapon + Speed ×3 + Area ×2
	if hasFrostWeapon && t[ARTomeSpeed] >= 3 && t[ARTomeArea] >= 2 {
		active = append(active, ARSynergyBlizzard)
	}

	// Thunder God: Lightning weapon + Crit ×3 + Attack Speed ×3
	if hasLightningWeapon && t[ARTomeCritChance] >= 3 && t[ARTomeAttackSpeed] >= 3 {
		active = append(active, ARSynergyThunderGod)
	}

	// Plague Doctor: Poison weapon + Curse ×2 + HP ×3
	if hasPoisonWeapon && t[ARTomeCursed] >= 2 && t[ARTomeHP] >= 3 {
		active = append(active, ARSynergyPlagueDoc)
	}

	// Juggernaut: Shield ×3 + HP ×3 + Thorns ×3
	if t[ARTomeShield] >= 3 && t[ARTomeHP] >= 3 && t[ARTomeThorns] >= 3 {
		active = append(active, ARSynergyJuggernaut)
	}

	// Glass Cannon: Damage ×5 + Crit ×5 + HP ==0
	if t[ARTomeDamage] >= 5 && t[ARTomeCritChance] >= 5 && t[ARTomeHP] == 0 {
		active = append(active, ARSynergyGlassCannon)
	}

	// Speed Demon: Speed ×5 + Dodge ×5
	if t[ARTomeSpeed] >= 5 && t[ARTomeDodge] >= 5 {
		active = append(active, ARSynergySpeedDemon)
	}

	// Holy Trinity: XP ×5 + Luck ×5 + Cursed ×3
	if t[ARTomeXP] >= 5 && t[ARTomeLuck] >= 5 && t[ARTomeCursed] >= 3 {
		active = append(active, ARSynergyHolyTrinity)
	}

	// Vampire Lord: Crit ×3 + Vampire Ring + Berserker Helm
	if t[ARTomeCritChance] >= 3 &&
		playerHasEquipment(player, ARItemVampireRing) &&
		playerHasEquipment(player, ARItemBerserkerHelm) {
		active = append(active, ARSynergyVampireLord)
	}

	// Fortress: Aegis + Shield ×3 + Thorns ×2 + Guardian character
	if hasAegis && t[ARTomeShield] >= 3 && t[ARTomeThorns] >= 2 && player.Character == ARCharGuardian {
		active = append(active, ARSynergyFortress)
	}

	return active
}

// HasSynergy checks if a player has a specific synergy active.
func HasSynergy(player *ARPlayer, synergy ARSynergyID) bool {
	for _, s := range player.ActiveSynergies {
		if s == synergy {
			return true
		}
	}
	return false
}

// ============================================================
// Synergy Stat Bonuses (applied in RecomputeAllStats)
// ============================================================

// ApplySynergyBonuses modifies player stats based on active synergies.
// Called after base RecomputeAllStats.
func ApplySynergyBonuses(player *ARPlayer) {
	player.ActiveSynergies = CheckSynergies(player)

	for _, syn := range player.ActiveSynergies {
		switch syn {
		case ARSynergyInfernal:
			// +50% fire damage → applied per-weapon in damage calc
			// Burn spreads → handled in status effect tick

		case ARSynergyBlizzard:
			// Movement trail creates freeze field → handled in trail tick
			player.AreaMult *= 1.30

		case ARSynergyThunderGod:
			// Crits auto-fire chain lightning → handled in crit resolution
			player.AttackSpeedMult *= 1.20

		case ARSynergyPlagueDoc:
			// Poison ×2 → applied in damage calc for poison weapons
			// Poison kills heal 5% HP → handled in kill processing

		case ARSynergyJuggernaut:
			// Shield block shockwave → handled in shield block
			// 50% reflection
			player.ThornsPct = 50.0

		case ARSynergyGlassCannon:
			// Damage ×2, HP locked at 1
			player.DamageMult *= 2.0
			player.MaxHP = 1
			player.HP = 1

		case ARSynergySpeedDemon:
			// Speed-proportional damage bonus
			speedRatio := player.SpeedMult - 1.0
			if speedRatio > 0 {
				player.DamageMult *= 1.0 + speedRatio*0.5
			}

		case ARSynergyHolyTrinity:
			// XP ×3 (overrides normal XP calc)
			player.XPMult *= 3.0

		case ARSynergyVampireLord:
			// Crit lifesteal
			player.LifestealPct += 10.0
			// Below 50% HP: lifesteal ×3 → checked in damage calc

		case ARSynergyFortress:
			// 360° shield → handled in shield block
			// Block success = 2s invincibility → handled in shield block
		}
	}
}

// ============================================================
// Helpers
// ============================================================

func playerHasWeaponOfDamageType(player *ARPlayer, dmgType ARDamageType) bool {
	for _, wi := range player.Weapons {
		def := GetWeaponDef(wi.WeaponID)
		if def != nil && def.DamageType == dmgType {
			return true
		}
	}
	return false
}

func playerHasWeapon(player *ARPlayer, weaponID ARWeaponID) bool {
	for _, wi := range player.Weapons {
		if wi.WeaponID == weaponID {
			return true
		}
	}
	return false
}

func playerHasEquipment(player *ARPlayer, itemID ARItemID) bool {
	for _, eq := range player.Equipment {
		if eq == itemID {
			return true
		}
	}
	return false
}
