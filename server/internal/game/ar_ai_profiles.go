package game

import (
	"math/rand"
)

// ============================================================
// Arena AI — Build Profiles (v18 Phase 4)
// ============================================================
//
// 5 AI build profiles determine:
//   - Tome selection priority (which stats to stack)
//   - Weapon preference (melee, ranged, AOE)
//   - Aggression level (kite vs engage)
//   - Character affinity (which characters fit the profile)

// ARBuildProfile defines an AI agent's strategic preferences.
type ARBuildProfile struct {
	ID          ARBuildProfileID `json:"id"`
	Name        string           `json:"name"`
	Description string           `json:"desc"`

	// Aggression: 0.0 = defensive kiter, 1.0 = full aggro
	Aggression float64 `json:"aggression"`

	// Tome priorities: higher = more preferred (0-10 scale)
	TomePriority map[ARTomeID]float64 `json:"-"`

	// Preferred weapon types (ordered by priority)
	PreferredWeapons []ARWeaponID `json:"-"`

	// Best-fit characters
	PreferredCharacters []ARCharacterType `json:"-"`
}

// ARBuildProfileID identifies a build profile.
type ARBuildProfileID string

const (
	ARProfileDPS         ARBuildProfileID = "dps"
	ARProfileTank        ARBuildProfileID = "tank"
	ARProfileSpeed       ARBuildProfileID = "speed"
	ARProfileBalanced    ARBuildProfileID = "balanced"
	ARProfileGlassCannon ARBuildProfileID = "glass_cannon"
)

// TomeScore returns the priority score for a tome in this profile.
func (bp *ARBuildProfile) TomeScore(tomeID ARTomeID) float64 {
	if score, ok := bp.TomePriority[tomeID]; ok {
		return score
	}
	return 1.0 // default neutral score
}

// AllBuildProfiles returns all 5 build profiles.
func AllBuildProfiles() map[ARBuildProfileID]*ARBuildProfile {
	return buildProfiles
}

// GetBuildProfile returns a specific build profile.
func GetBuildProfile(id ARBuildProfileID) *ARBuildProfile {
	return buildProfiles[id]
}

// RandomBuildProfile returns a random build profile.
func RandomBuildProfile() *ARBuildProfile {
	ids := []ARBuildProfileID{
		ARProfileDPS, ARProfileTank, ARProfileSpeed,
		ARProfileBalanced, ARProfileGlassCannon,
	}
	id := ids[rand.Intn(len(ids))]
	return buildProfiles[id]
}

// ProfileForCharacter returns the best-fit profile for a character type.
func ProfileForCharacter(ct ARCharacterType) *ARBuildProfile {
	switch ct {
	case ARCharStriker, ARCharSniper:
		return buildProfiles[ARProfileDPS]
	case ARCharGuardian:
		return buildProfiles[ARProfileTank]
	case ARCharShadow:
		return buildProfiles[ARProfileSpeed]
	case ARCharBerserker:
		return buildProfiles[ARProfileGlassCannon]
	case ARCharPyro, ARCharFrostMage, ARCharGambler:
		return buildProfiles[ARProfileBalanced]
	default:
		return buildProfiles[ARProfileBalanced]
	}
}

var buildProfiles = map[ARBuildProfileID]*ARBuildProfile{
	// ── DPS (공격 위주) ──────────────────────────────────
	ARProfileDPS: {
		ID: ARProfileDPS, Name: "DPS",
		Description: "Maximizes damage output through crit and attack speed stacking",
		Aggression:  0.7,
		TomePriority: map[ARTomeID]float64{
			ARTomeDamage:      9.0,
			ARTomeAttackSpeed: 8.0,
			ARTomeCritChance:  8.5,
			ARTomeCritDamage:  7.5,
			ARTomeArea:        5.0,
			ARTomeProjectile:  6.0,
			ARTomeSpeed:       4.0,
			ARTomeHP:          3.0,
			ARTomeShield:      2.0,
			ARTomeThorns:      1.0,
			ARTomeKnockback:   2.0,
			ARTomeXP:          4.0,
			ARTomeLuck:        3.0,
			ARTomeMagnet:      3.0,
			ARTomeDodge:       2.0,
			ARTomeCursed:      5.0,
		},
		PreferredWeapons: []ARWeaponID{
			ARWeaponSniperRifle, ARWeaponKatana, ARWeaponBow,
			ARWeaponRevolver, ARWeaponLightningStaff,
		},
		PreferredCharacters: []ARCharacterType{
			ARCharStriker, ARCharSniper, ARCharPyro,
		},
	},

	// ── Tank (방어 위주) ──────────────────────────────────
	ARProfileTank: {
		ID: ARProfileTank, Name: "Tank",
		Description: "Prioritizes survivability with HP, shields, and thorns",
		Aggression:  0.4,
		TomePriority: map[ARTomeID]float64{
			ARTomeDamage:      3.0,
			ARTomeAttackSpeed: 3.0,
			ARTomeCritChance:  2.0,
			ARTomeCritDamage:  2.0,
			ARTomeArea:        4.0,
			ARTomeProjectile:  2.0,
			ARTomeSpeed:       3.0,
			ARTomeHP:          9.0,
			ARTomeShield:      8.5,
			ARTomeThorns:      8.0,
			ARTomeKnockback:   6.0,
			ARTomeXP:          4.0,
			ARTomeLuck:        3.0,
			ARTomeMagnet:      3.0,
			ARTomeDodge:       7.0,
			ARTomeCursed:      1.0,
		},
		PreferredWeapons: []ARWeaponID{
			ARWeaponAegis, ARWeaponAxe, ARWeaponFrostwalker,
			ARWeaponLandmine,
		},
		PreferredCharacters: []ARCharacterType{
			ARCharGuardian,
		},
	},

	// ── Speed (기동 위주) ──────────────────────────────────
	ARProfileSpeed: {
		ID: ARProfileSpeed, Name: "Speed",
		Description: "High mobility with dodge and speed, hit-and-run tactics",
		Aggression:  0.5,
		TomePriority: map[ARTomeID]float64{
			ARTomeDamage:      5.0,
			ARTomeAttackSpeed: 6.0,
			ARTomeCritChance:  5.0,
			ARTomeCritDamage:  4.0,
			ARTomeArea:        3.0,
			ARTomeProjectile:  4.0,
			ARTomeSpeed:       9.0,
			ARTomeHP:          4.0,
			ARTomeShield:      3.0,
			ARTomeThorns:      1.0,
			ARTomeKnockback:   2.0,
			ARTomeXP:          5.0,
			ARTomeLuck:        4.0,
			ARTomeMagnet:      5.0,
			ARTomeDodge:       8.5,
			ARTomeCursed:      3.0,
		},
		PreferredWeapons: []ARWeaponID{
			ARWeaponWirelessDagger, ARWeaponFrostwalker,
			ARWeaponFlamewalker, ARWeaponBow,
		},
		PreferredCharacters: []ARCharacterType{
			ARCharShadow, ARCharFrostMage,
		},
	},

	// ── Balanced (균형) ──────────────────────────────────
	ARProfileBalanced: {
		ID: ARProfileBalanced, Name: "Balanced",
		Description: "Well-rounded approach with even stat distribution",
		Aggression:  0.55,
		TomePriority: map[ARTomeID]float64{
			ARTomeDamage:      6.0,
			ARTomeAttackSpeed: 5.5,
			ARTomeCritChance:  5.0,
			ARTomeCritDamage:  4.5,
			ARTomeArea:        5.0,
			ARTomeProjectile:  4.0,
			ARTomeSpeed:       5.0,
			ARTomeHP:          6.0,
			ARTomeShield:      4.0,
			ARTomeThorns:      3.0,
			ARTomeKnockback:   3.0,
			ARTomeXP:          6.0,
			ARTomeLuck:        5.0,
			ARTomeMagnet:      4.5,
			ARTomeDodge:       4.0,
			ARTomeCursed:      3.0,
		},
		PreferredWeapons: []ARWeaponID{
			ARWeaponFireStaff, ARWeaponBow, ARWeaponRevolver,
			ARWeaponKatana, ARWeaponShotgun,
		},
		PreferredCharacters: []ARCharacterType{
			ARCharPyro, ARCharGambler, ARCharFrostMage,
		},
	},

	// ── Glass Cannon (고위험 고보상) ──────────────────────
	ARProfileGlassCannon: {
		ID: ARProfileGlassCannon, Name: "Glass Cannon",
		Description: "Maximum damage at the cost of survivability. High risk, high reward.",
		Aggression:  0.9,
		TomePriority: map[ARTomeID]float64{
			ARTomeDamage:      10.0,
			ARTomeAttackSpeed: 8.0,
			ARTomeCritChance:  9.0,
			ARTomeCritDamage:  9.0,
			ARTomeArea:        6.0,
			ARTomeProjectile:  7.0,
			ARTomeSpeed:       5.0,
			ARTomeHP:          1.0,
			ARTomeShield:      1.0,
			ARTomeThorns:      1.0,
			ARTomeKnockback:   2.0,
			ARTomeXP:          5.0,
			ARTomeLuck:        5.0,
			ARTomeMagnet:      4.0,
			ARTomeDodge:       3.0,
			ARTomeCursed:      7.0,
		},
		PreferredWeapons: []ARWeaponID{
			ARWeaponSniperRifle, ARWeaponLightningStaff,
			ARWeaponFireStaff, ARWeaponKatana,
		},
		PreferredCharacters: []ARCharacterType{
			ARCharBerserker, ARCharStriker,
		},
	},
}
