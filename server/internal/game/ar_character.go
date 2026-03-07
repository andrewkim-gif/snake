package game

// ============================================================
// Arena Character System — 8 Characters (v18 Phase 3)
// ============================================================

// ARCharacterDef is the static definition of a playable character.
type ARCharacterDef struct {
	ID           ARCharacterType `json:"id"`
	Name         string          `json:"name"`
	StartWeapon  ARWeaponID      `json:"startWeapon"`
	PassiveDesc  string          `json:"passiveDesc"`
	BaseHP       float64         `json:"baseHp"`
	BaseSpeed    float64         `json:"baseSpeed"`    // multiplier (1.0 = normal)
	BaseDamage   float64         `json:"baseDamage"`   // multiplier
	BaseCrit     float64         `json:"baseCrit"`     // bonus crit chance %
	BaseDefense  float64         `json:"baseDefense"`  // flat defense
	LevelUpSlots int             `json:"levelUpSlots"` // tome choices per level-up (default 3)
}

// AllCharacterDefs returns all 8 character definitions.
func AllCharacterDefs() map[ARCharacterType]*ARCharacterDef {
	return characterRegistry
}

// GetCharacterDef returns the definition for a character type.
func GetCharacterDef(ct ARCharacterType) *ARCharacterDef {
	return characterRegistry[ct]
}

// characterRegistry holds the 8 Phase 1 characters.
var characterRegistry = map[ARCharacterType]*ARCharacterDef{
	ARCharStriker: {
		ID: ARCharStriker, Name: "Striker",
		StartWeapon: ARWeaponKatana,
		PassiveDesc: "Every 5 kills: permanent +5% attack speed",
		BaseHP: 100, BaseSpeed: 1.0, BaseDamage: 1.0,
		BaseCrit: 0, BaseDefense: 0, LevelUpSlots: 3,
	},
	ARCharGuardian: {
		ID: ARCharGuardian, Name: "Guardian",
		StartWeapon: ARWeaponAegis,
		PassiveDesc: "On hit: +20% defense for 2s",
		BaseHP: 130, BaseSpeed: 0.9, BaseDamage: 0.85,
		BaseCrit: 0, BaseDefense: 10, LevelUpSlots: 3,
	},
	ARCharPyro: {
		ID: ARCharPyro, Name: "Pyro",
		StartWeapon: ARWeaponFireStaff,
		PassiveDesc: "+25% fire damage, burn duration +1s",
		BaseHP: 90, BaseSpeed: 1.0, BaseDamage: 1.0,
		BaseCrit: 0, BaseDefense: 0, LevelUpSlots: 3,
	},
	ARCharFrostMage: {
		ID: ARCharFrostMage, Name: "Frost Mage",
		StartWeapon: ARWeaponFrostwalker,
		PassiveDesc: "Frost hits: 20% chance instant freeze",
		BaseHP: 85, BaseSpeed: 1.0, BaseDamage: 0.95,
		BaseCrit: 0, BaseDefense: 0, LevelUpSlots: 3,
	},
	ARCharSniper: {
		ID: ARCharSniper, Name: "Sniper",
		StartWeapon: ARWeaponSniperRifle,
		PassiveDesc: "+20% ranged damage, +5m range",
		BaseHP: 80, BaseSpeed: 0.95, BaseDamage: 1.0,
		BaseCrit: 5, BaseDefense: 0, LevelUpSlots: 3,
	},
	ARCharGambler: {
		ID: ARCharGambler, Name: "Gambler",
		StartWeapon: ARWeaponDice,
		PassiveDesc: "Level-up: 4 choices instead of 3",
		BaseHP: 95, BaseSpeed: 1.0, BaseDamage: 1.0,
		BaseCrit: 0, BaseDefense: 0, LevelUpSlots: 4,
	},
	ARCharBerserker: {
		ID: ARCharBerserker, Name: "Berserker",
		StartWeapon: ARWeaponAxe,
		PassiveDesc: "Below 50% HP: all damage +35%",
		BaseHP: 110, BaseSpeed: 1.05, BaseDamage: 1.0,
		BaseCrit: 0, BaseDefense: 0, LevelUpSlots: 3,
	},
	ARCharShadow: {
		ID: ARCharShadow, Name: "Shadow",
		StartWeapon: ARWeaponWirelessDagger,
		PassiveDesc: "After slide: 2s stealth (untargetable)",
		BaseHP: 75, BaseSpeed: 1.15, BaseDamage: 0.9,
		BaseCrit: 10, BaseDefense: 0, LevelUpSlots: 3,
	},
}

// ============================================================
// Character Passive Application
// ============================================================

// CharacterPassiveDamageMult returns the damage multiplier from a character's passive.
// Called during damage calculation.
func CharacterPassiveDamageMult(player *ARPlayer) float64 {
	mult := 1.0
	def := GetCharacterDef(player.Character)
	if def == nil {
		return mult
	}

	// Apply base damage bias
	mult *= def.BaseDamage

	switch player.Character {
	case ARCharPyro:
		// +25% fire damage is applied per-weapon in damage calc (only fire weapons)
		// Base mult stays 1.0; fire bonus applied in WeaponFire context
	case ARCharSniper:
		// +20% ranged damage handled in weapon fire (ranged patterns only)
	case ARCharBerserker:
		// +35% damage when below 50% HP
		if player.HP < player.MaxHP*0.5 {
			mult *= 1.35
		}
	}

	return mult
}

// CharacterPassiveRangeMult returns the range bonus from a character's passive.
func CharacterPassiveRangeBonus(player *ARPlayer) float64 {
	if player.Character == ARCharSniper {
		return 5.0 // +5m range for Sniper
	}
	return 0
}

// CharacterPassiveCritBonus returns the crit chance bonus from character passive.
func CharacterPassiveCritBonus(player *ARPlayer) float64 {
	def := GetCharacterDef(player.Character)
	if def == nil {
		return 0
	}
	return def.BaseCrit
}

// CharacterFireDamageBonus returns the fire damage bonus for Pyro.
func CharacterFireDamageBonus(player *ARPlayer) float64 {
	if player.Character == ARCharPyro {
		return 1.25 // +25% fire damage
	}
	return 1.0
}

// CharacterRangedDamageBonus returns ranged damage bonus for Sniper.
func CharacterRangedDamageBonus(player *ARPlayer) float64 {
	if player.Character == ARCharSniper {
		return 1.20 // +20% ranged damage
	}
	return 1.0
}

// ============================================================
// Striker Kill Tracking
// ============================================================

// StrikerKillTracker tracks kills for Striker's passive (every 5 kills → +5% attack speed).
// Stored as a field in the player's kill count; the bonus is computed on the fly.
func StrikerAttackSpeedBonus(player *ARPlayer) float64 {
	if player.Character != ARCharStriker {
		return 0
	}
	// Every 5 kills = +5% attack speed (permanent for the match)
	stacks := player.Kills / 5
	return float64(stacks) * 0.05
}

// ============================================================
// Guardian Defense Buff
// ============================================================

// GuardianDefenseBonus returns the defense bonus when recently hit.
// The Guardian's passive gives +20% defense for 2s after being hit.
// We track this via a timer field on the player.
func GuardianDefenseBonus(player *ARPlayer) float64 {
	if player.Character != ARCharGuardian {
		return 0
	}
	// GuardianDefenseTimer is tracked in ARPlayer (added as part of this phase)
	if player.GuardianDefTimer > 0 {
		return 0.20
	}
	return 0
}

// ============================================================
// Shadow Stealth
// ============================================================

// ShadowIsStealthed returns true if Shadow character is currently in stealth.
func ShadowIsStealthed(player *ARPlayer) bool {
	if player.Character != ARCharShadow {
		return false
	}
	return player.StealthTimer > 0
}

// ============================================================
// Init Player From Character
// ============================================================

// InitPlayerFromCharacter initializes a player's stats based on their chosen character.
func InitPlayerFromCharacter(player *ARPlayer) {
	def := GetCharacterDef(player.Character)
	if def == nil {
		def = characterRegistry[ARCharStriker] // fallback
	}

	player.HP = def.BaseHP
	player.MaxHP = def.BaseHP
	player.WeaponSlots = []string{string(def.StartWeapon)}
	player.Weapons = []*ARWeaponInstance{
		{WeaponID: def.StartWeapon, Level: 1, Cooldown: 0},
	}

	// Gambler gets 4 level-up choices
	// (stored in character def, used in GenerateTomeChoices)
}
