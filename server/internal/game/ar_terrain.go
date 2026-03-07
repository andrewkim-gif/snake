package game

// ============================================================
// Arena Terrain System — 6 National Themes (v18 Phase 3)
// ============================================================

// ARTerrainDef defines a terrain theme with combat modifiers.
type ARTerrainDef struct {
	Theme       ARTerrainTheme `json:"theme"`
	Name        string         `json:"name"`
	Description string         `json:"desc"`

	// Combat bonuses
	MoveSpeedMult   float64 `json:"moveSpeedMult"`   // movement speed multiplier
	DamageMult      float64 `json:"damageMult"`       // damage dealt multiplier
	DefenseMult     float64 `json:"defenseMult"`      // defense multiplier
	SpecialEffect   string  `json:"specialEffect"`    // unique terrain mechanic
	ObstacleCount   int     `json:"obstacleCount"`    // number of obstacles on map
	ObstacleRadius  float64 `json:"obstacleRadius"`   // average obstacle size

	// Visual hints (sent to client)
	FloorColor     string `json:"floorColor"`     // hex color for ground
	FogColor       string `json:"fogColor"`       // hex color for fog
	FogDensity     float64 `json:"fogDensity"`    // fog density (0-1)
	AmbientLight   float64 `json:"ambientLight"`  // ambient light intensity
}

// AllTerrainDefs returns the registry of all terrain themes.
func AllTerrainDefs() map[ARTerrainTheme]*ARTerrainDef {
	return terrainRegistry
}

// GetTerrainDef returns the definition for a terrain theme.
func GetTerrainDef(theme ARTerrainTheme) *ARTerrainDef {
	if theme == "" {
		theme = ARTerrainUrban // default
	}
	return terrainRegistry[theme]
}

var terrainRegistry = map[ARTerrainTheme]*ARTerrainDef{
	ARTerrainUrban: {
		Theme: ARTerrainUrban, Name: "Urban",
		Description:   "City streets and buildings. Cover-based combat.",
		MoveSpeedMult: 1.0, DamageMult: 1.0, DefenseMult: 1.0,
		SpecialEffect: "cover", // behind obstacles: +30% defense
		ObstacleCount: 20, ObstacleRadius: 2.0,
		FloorColor: "#3a3a3a", FogColor: "#222222",
		FogDensity: 0.02, AmbientLight: 0.6,
	},
	ARTerrainDesert: {
		Theme: ARTerrainDesert, Name: "Desert",
		Description:   "Open dunes with heat waves. Fire damage +20%, frost damage -20%.",
		MoveSpeedMult: 0.9, DamageMult: 1.0, DefenseMult: 0.9,
		SpecialEffect: "heat_wave", // fire +20%, frost -20%
		ObstacleCount: 8, ObstacleRadius: 3.0,
		FloorColor: "#c2a360", FogColor: "#d4b577",
		FogDensity: 0.015, AmbientLight: 0.9,
	},
	ARTerrainMountain: {
		Theme: ARTerrainMountain, Name: "Mountain",
		Description:   "Rocky highlands with elevation. Knockback +30%, movement -10%.",
		MoveSpeedMult: 0.9, DamageMult: 1.1, DefenseMult: 1.1,
		SpecialEffect: "high_ground", // ranged attacks +10% from high ground
		ObstacleCount: 15, ObstacleRadius: 4.0,
		FloorColor: "#5a5a4a", FogColor: "#8a8a7a",
		FogDensity: 0.03, AmbientLight: 0.5,
	},
	ARTerrainForest: {
		Theme: ARTerrainForest, Name: "Forest",
		Description:   "Dense trees reduce range. Poison damage +20%, dodge +10%.",
		MoveSpeedMult: 0.95, DamageMult: 1.0, DefenseMult: 1.0,
		SpecialEffect: "undergrowth", // +10% dodge, ranged range -15%
		ObstacleCount: 25, ObstacleRadius: 1.5,
		FloorColor: "#2d4a2d", FogColor: "#1a3a1a",
		FogDensity: 0.04, AmbientLight: 0.4,
	},
	ARTerrainArctic: {
		Theme: ARTerrainArctic, Name: "Arctic",
		Description:   "Icy terrain with sliding. Frost damage +30%, fire damage -15%. Slippery movement.",
		MoveSpeedMult: 1.1, DamageMult: 1.0, DefenseMult: 0.95,
		SpecialEffect: "ice_slide", // movement has inertia
		ObstacleCount: 10, ObstacleRadius: 2.5,
		FloorColor: "#c8d8e4", FogColor: "#e0e8f0",
		FogDensity: 0.025, AmbientLight: 0.8,
	},
	ARTerrainIsland: {
		Theme: ARTerrainIsland, Name: "Island",
		Description:   "Tropical island with water hazards. Lightning +20%, speed +10%.",
		MoveSpeedMult: 1.1, DamageMult: 1.0, DefenseMult: 1.0,
		SpecialEffect: "water_hazard", // water zones slow -50%, lightning +20%
		ObstacleCount: 12, ObstacleRadius: 2.0,
		FloorColor: "#3a7a3a", FogColor: "#6aaa8a",
		FogDensity: 0.01, AmbientLight: 0.7,
	},
}

// ============================================================
// Terrain Combat Modifiers
// ============================================================

// TerrainMoveSpeedMult returns the movement speed modifier for the active terrain.
func TerrainMoveSpeedMult(theme ARTerrainTheme) float64 {
	def := GetTerrainDef(theme)
	if def == nil {
		return 1.0
	}
	return def.MoveSpeedMult
}

// TerrainDamageMult returns the damage modifier for the active terrain.
func TerrainDamageMult(theme ARTerrainTheme) float64 {
	def := GetTerrainDef(theme)
	if def == nil {
		return 1.0
	}
	return def.DamageMult
}

// TerrainDefenseMult returns the defense modifier for the active terrain.
func TerrainDefenseMult(theme ARTerrainTheme) float64 {
	def := GetTerrainDef(theme)
	if def == nil {
		return 1.0
	}
	return def.DefenseMult
}

// TerrainElementalBonus returns the elemental damage bonus/penalty for a terrain.
// Returns a multiplier (e.g., 1.2 = +20%).
func TerrainElementalBonus(theme ARTerrainTheme, dmgType ARDamageType) float64 {
	switch theme {
	case ARTerrainDesert:
		switch dmgType {
		case ARDmgFire:
			return 1.20
		case ARDmgFrost:
			return 0.80
		}
	case ARTerrainForest:
		if dmgType == ARDmgPoison {
			return 1.20
		}
	case ARTerrainArctic:
		switch dmgType {
		case ARDmgFrost:
			return 1.30
		case ARDmgFire:
			return 0.85
		}
	case ARTerrainIsland:
		if dmgType == ARDmgLightning {
			return 1.20
		}
	}
	return 1.0
}

// TerrainDodgeBonus returns bonus dodge chance from terrain.
func TerrainDodgeBonus(theme ARTerrainTheme) float64 {
	switch theme {
	case ARTerrainForest:
		return 10.0 // +10% dodge in forest
	default:
		return 0
	}
}

// ============================================================
// Terrain Obstacle Generation
// ============================================================

// ARObstacle represents a terrain obstacle.
type ARObstacle struct {
	X      float64 `json:"x"`
	Z      float64 `json:"z"`
	Radius float64 `json:"radius"`
	Height float64 `json:"height"`
	Type   string  `json:"type"` // "rock", "tree", "building", "ice", "water"
}

// GenerateObstacles creates terrain obstacles for the arena.
func GenerateObstacles(theme ARTerrainTheme, arenaRadius float64) []ARObstacle {
	def := GetTerrainDef(theme)
	if def == nil {
		return nil
	}

	obstacles := make([]ARObstacle, 0, def.ObstacleCount)
	obstacleType := terrainObstacleType(theme)

	for i := 0; i < def.ObstacleCount; i++ {
		// Random position within arena (not too close to center)
		angle := float64(i) / float64(def.ObstacleCount) * 6.283 // 2*PI
		dist := arenaRadius * (0.2 + 0.6*float64(i%5)/5.0)

		// Jitter position
		jitterAngle := (float64(i*7+3) / float64(def.ObstacleCount)) * 6.283
		dist += def.ObstacleRadius

		x := dist * cosApprox(angle+jitterAngle*0.3)
		z := dist * sinApprox(angle+jitterAngle*0.3)

		radius := def.ObstacleRadius * (0.7 + float64(i%3)*0.3)
		height := radius * (1.0 + float64(i%4)*0.5)

		obstacles = append(obstacles, ARObstacle{
			X:      x,
			Z:      z,
			Radius: radius,
			Height: height,
			Type:   obstacleType,
		})
	}

	return obstacles
}

func terrainObstacleType(theme ARTerrainTheme) string {
	switch theme {
	case ARTerrainUrban:
		return "building"
	case ARTerrainDesert:
		return "rock"
	case ARTerrainMountain:
		return "rock"
	case ARTerrainForest:
		return "tree"
	case ARTerrainArctic:
		return "ice"
	case ARTerrainIsland:
		return "water"
	default:
		return "rock"
	}
}

// Simple trig approximations (avoid importing math just for this)
func cosApprox(x float64) float64 {
	// Use Taylor series: cos(x) ~ 1 - x^2/2 + x^4/24
	// Normalize to [-PI, PI]
	for x > 3.14159 {
		x -= 6.28318
	}
	for x < -3.14159 {
		x += 6.28318
	}
	x2 := x * x
	return 1 - x2/2 + x2*x2/24
}

func sinApprox(x float64) float64 {
	// sin(x) ~ x - x^3/6 + x^5/120
	for x > 3.14159 {
		x -= 6.28318
	}
	for x < -3.14159 {
		x += 6.28318
	}
	x2 := x * x
	return x - x*x2/6 + x*x2*x2/120
}
