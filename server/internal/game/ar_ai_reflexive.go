package game

import (
	"math"
	"math/rand"
)

// ============================================================
// Arena AI — Reflexive Layer (v18 Phase 4)
// ============================================================
//
// The Reflexive layer handles frame-by-frame reactions:
//   - Movement vector computation from tactical goal
//   - Dodge / slide when enemies are close
//   - Emergency heal item usage
//   - Jump to avoid ground hazards
//
// It runs every tick (20Hz) to produce smooth AI movement.

// ARReflexiveState holds the AI's reflexive reaction state.
type ARReflexiveState struct {
	// Movement output: normalized direction
	MoveX float64
	MoveZ float64

	// Aiming output: rotation in radians
	AimAngle float64

	// Slide request
	WantsSlide bool

	// Jump request
	WantsJump bool

	// Noise timer for organic movement
	NoiseTimer  float64
	NoiseAngle  float64
}

// ReflexiveUpdate runs the reflexive reaction layer for an AI player.
// Called every tick (20Hz) from ArenaCombat.tickAI().
func ReflexiveUpdate(
	player *ARPlayer,
	reflex *ARReflexiveState,
	tac *ARTacticalState,
	enemies []*AREnemy,
	delta float64,
) {
	// Reset
	reflex.WantsSlide = false
	reflex.WantsJump = false

	// 1. Movement noise for organic-looking behavior
	reflex.NoiseTimer += delta
	if reflex.NoiseTimer > 0.5 {
		reflex.NoiseTimer = 0
		reflex.NoiseAngle = (rand.Float64() - 0.5) * 0.6 // slight random deviation
	}

	// 2. Movement based on tactical goal
	var targetX, targetZ float64

	switch tac.Goal {
	case ARGoalFarm:
		if tac.TargetEnemyID != "" {
			// Move toward target enemy (but stay at weapon range)
			for _, e := range enemies {
				if e.ID == tac.TargetEnemyID && e.Alive {
					dist := player.Pos.DistTo(e.Pos)
					idealRange := reflexIdealRange(player)
					if dist > idealRange+2.0 {
						// Move closer
						targetX = e.Pos.X - player.Pos.X
						targetZ = e.Pos.Z - player.Pos.Z
					} else if dist < idealRange-1.0 {
						// Back away slightly
						targetX = player.Pos.X - e.Pos.X
						targetZ = player.Pos.Z - e.Pos.Z
					} else {
						// Orbit at ideal range
						targetX = -(e.Pos.Z - player.Pos.Z)
						targetZ = e.Pos.X - player.Pos.X
					}
					break
				}
			}
		} else {
			// Wander toward center (avoid arena edges)
			targetX = -player.Pos.X * 0.1
			targetZ = -player.Pos.Z * 0.1
		}

	case ARGoalSurvive, ARGoalPvPEvade:
		targetX = tac.DesiredPos.X - player.Pos.X
		targetZ = tac.DesiredPos.Z - player.Pos.Z

	case ARGoalPickup:
		targetX = tac.DesiredPos.X - player.Pos.X
		targetZ = tac.DesiredPos.Z - player.Pos.Z

	case ARGoalKite:
		targetX = tac.DesiredPos.X - player.Pos.X
		targetZ = tac.DesiredPos.Z - player.Pos.Z

	case ARGoalAggro, ARGoalPvPHunt:
		targetX = tac.DesiredPos.X - player.Pos.X
		targetZ = tac.DesiredPos.Z - player.Pos.Z
	}

	// 3. Normalize movement vector
	mag := math.Sqrt(targetX*targetX + targetZ*targetZ)
	if mag > 0.1 {
		reflex.MoveX = targetX / mag
		reflex.MoveZ = targetZ / mag
	} else {
		reflex.MoveX = 0
		reflex.MoveZ = 0
	}

	// Apply noise
	cos := math.Cos(reflex.NoiseAngle)
	sin := math.Sin(reflex.NoiseAngle)
	rx := reflex.MoveX*cos - reflex.MoveZ*sin
	rz := reflex.MoveX*sin + reflex.MoveZ*cos
	reflex.MoveX = rx
	reflex.MoveZ = rz

	// 4. Aiming: face movement direction (or target if fighting)
	if mag > 0.1 {
		reflex.AimAngle = math.Atan2(targetX, targetZ)
	}

	// 5. Emergency reactions

	// Slide to dodge when surrounded
	if tac.NearbyEnemyCount >= 4 && player.SlideCooldown <= 0 && player.Stamina >= ARSlideCost {
		reflex.WantsSlide = true
	}

	// Slide when a miniboss is close
	for _, e := range enemies {
		if !e.Alive || !e.IsMiniboss {
			continue
		}
		dist := player.Pos.DistTo(e.Pos)
		if dist < 5.0 && player.SlideCooldown <= 0 && player.Stamina >= ARSlideCost {
			reflex.WantsSlide = true
			// Dodge perpendicular to miniboss
			dx := e.Pos.X - player.Pos.X
			dz := e.Pos.Z - player.Pos.Z
			reflex.MoveX = -dz
			reflex.MoveZ = dx
			mag2 := math.Sqrt(reflex.MoveX*reflex.MoveX + reflex.MoveZ*reflex.MoveZ)
			if mag2 > 0.1 {
				reflex.MoveX /= mag2
				reflex.MoveZ /= mag2
			}
			break
		}
	}

	// Jump over creepers about to explode
	for _, e := range enemies {
		if !e.Alive || e.Type != AREnemyCreeper {
			continue
		}
		dist := player.Pos.DistTo(e.Pos)
		if dist < 4.0 {
			reflex.WantsJump = true
			break
		}
	}
}

// reflexIdealRange returns the ideal engagement distance for the player's loadout.
func reflexIdealRange(player *ARPlayer) float64 {
	if len(player.Weapons) == 0 {
		return 3.0
	}

	maxRange := 0.0
	for _, wi := range player.Weapons {
		def := GetWeaponDef(wi.WeaponID)
		if def == nil {
			continue
		}
		r := def.BaseRange
		if def.Pattern == ARPatternMelee || def.Pattern == ARPatternTrail {
			r = 3.0
		}
		if r > maxRange {
			maxRange = r
		}
	}

	if maxRange < 3.0 {
		return 3.0
	}
	return maxRange * 0.8 // stay slightly inside max range
}

// ApplyAIInput writes the reflexive layer's output into ARInput format
// and applies it to the player entity.
func ApplyAIInput(player *ARPlayer, reflex *ARReflexiveState) {
	player.Vel.X = reflex.MoveX
	player.Vel.Z = reflex.MoveZ
	player.Rotation = reflex.AimAngle
}
