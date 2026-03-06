package game

// TerrainModifiers holds combat modifiers for a terrain theme.
// All multiplier fields default to 1.0 (no modification).
type TerrainModifiers struct {
	// Movement speed multiplier (1.0 = normal)
	SpeedMult float64

	// Outgoing DPS multiplier (aura damage dealt)
	DPSMult float64

	// Incoming damage multiplier (damage received; <1 = less damage taken)
	DamageReceiveMult float64

	// Ranged (dash) damage multiplier
	RangedDamageMult float64

	// Vision radius multiplier (affects viewport culling distance)
	VisionMult float64

	// Orb spawn density multiplier
	OrbMult float64

	// Arena shrink speed multiplier (>1 = faster shrink)
	ShrinkMult float64
}

// DefaultTerrainModifiers returns modifiers that change nothing (all 1.0).
func DefaultTerrainModifiers() TerrainModifiers {
	return TerrainModifiers{
		SpeedMult:         1.0,
		DPSMult:           1.0,
		DamageReceiveMult: 1.0,
		RangedDamageMult:  1.0,
		VisionMult:        1.0,
		OrbMult:           1.0,
		ShrinkMult:        1.0,
	}
}

// GetTerrainModifiers returns combat modifiers for the given terrain theme.
// Unknown themes return default (no-op) modifiers.
func GetTerrainModifiers(theme string) TerrainModifiers {
	switch theme {
	case "forest":
		// Trees provide cover — reduced incoming damage
		m := DefaultTerrainModifiers()
		m.DamageReceiveMult = 0.80 // -20% damage taken
		return m

	case "desert":
		// Heat slows movement but improves visibility
		m := DefaultTerrainModifiers()
		m.SpeedMult = 0.90  // -10% speed
		m.VisionMult = 1.20 // +20% vision
		return m

	case "mountain":
		// High ground boosts attack but slows movement
		m := DefaultTerrainModifiers()
		m.DPSMult = 1.15    // +15% aura DPS
		m.SpeedMult = 0.85  // -15% speed
		return m

	case "urban":
		// Buildings reduce ranged (dash) effectiveness
		m := DefaultTerrainModifiers()
		m.RangedDamageMult = 0.70 // -30% dash damage
		return m

	case "arctic":
		// Ice slows everyone and fewer orbs spawn
		m := DefaultTerrainModifiers()
		m.SpeedMult = 0.80 // -20% speed
		m.OrbMult = 0.70   // -30% orb density
		return m

	case "island":
		// Small arena — faster shrink
		m := DefaultTerrainModifiers()
		m.ShrinkMult = 1.50 // +50% shrink speed
		return m

	default:
		return DefaultTerrainModifiers()
	}
}

// TerrainBonusDescription returns a human-readable description of the terrain bonus.
func TerrainBonusDescription(theme string) string {
	switch theme {
	case "forest":
		return "Forest: -20% Damage Received"
	case "desert":
		return "Desert: -10% Speed, +20% Vision"
	case "mountain":
		return "Mountain: +15% DPS, -15% Speed"
	case "urban":
		return "Urban: -30% Dash Damage"
	case "arctic":
		return "Arctic: -20% Speed, -30% Orb Density"
	case "island":
		return "Island: +50% Arena Shrink Speed"
	default:
		return ""
	}
}
