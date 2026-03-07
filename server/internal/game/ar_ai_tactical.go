package game

import (
	"math"
	"math/rand"
)

// ============================================================
// Arena AI — Tactical Layer (v18 Phase 4)
// ============================================================
//
// The Tactical layer makes strategic decisions:
//   - Target selection (nearest, weakest, highest-threat)
//   - Positioning (kite ranged, chase melee, flee when low)
//   - Tome/weapon selection during level-up
//   - Item pickup priority
//
// It runs at 2Hz (every 10 ticks) to save CPU.

// ARTacticalState holds the AI's tactical decision state.
type ARTacticalState struct {
	// Current strategic goal
	Goal ARTacticalGoal

	// Target enemy ID (for focus fire)
	TargetEnemyID string

	// Desired position (kite point, flee direction)
	DesiredPos ARVec3

	// Item to pick up (if any)
	TargetItemID string

	// Recalculation timer
	RecalcTimer float64

	// Threat awareness
	ThreatLevel float64 // 0=safe, 1=danger
	NearbyEnemyCount int
}

// ARTacticalGoal is the high-level strategic objective.
type ARTacticalGoal string

const (
	ARGoalFarm      ARTacticalGoal = "farm"       // Kill enemies, collect XP
	ARGoalSurvive   ARTacticalGoal = "survive"     // Low HP, retreat and heal
	ARGoalPickup    ARTacticalGoal = "pickup"      // Pick up nearby item/XP
	ARGoalKite      ARTacticalGoal = "kite"        // Maintain distance from enemies
	ARGoalAggro     ARTacticalGoal = "aggro"       // Rush into enemies (berserker)
	ARGoalPvPHunt   ARTacticalGoal = "pvp_hunt"    // PvP phase: hunt other players
	ARGoalPvPEvade  ARTacticalGoal = "pvp_evade"   // PvP phase: evade stronger players
)

const (
	// Tactical update rate: every 0.5s (2Hz)
	ARTacticalInterval = 0.5
)

// TacticalUpdate runs the tactical decision layer for an AI player.
// Called at 2Hz from ArenaCombat.tickAI().
func TacticalUpdate(
	player *ARPlayer,
	tac *ARTacticalState,
	profile *ARBuildProfile,
	enemies []*AREnemy,
	otherPlayers []*ARPlayer,
	fieldItems []*ARFieldItem,
	xpCrystals []*ARXPCrystal,
	phase ARPhase,
) {
	// 1. Assess threat
	tac.NearbyEnemyCount = 0
	tac.ThreatLevel = 0
	for _, e := range enemies {
		if !e.Alive {
			continue
		}
		dist := player.Pos.DistTo(e.Pos)
		if dist < 10.0 {
			tac.NearbyEnemyCount++
			threat := e.Damage / (dist + 1.0)
			if e.IsElite {
				threat *= 2.0
			}
			if e.IsMiniboss {
				threat *= 4.0
			}
			tac.ThreatLevel += threat
		}
	}
	// Normalize threat
	tac.ThreatLevel = math.Min(tac.ThreatLevel/100.0, 1.0)

	// 2. Decide goal based on phase and state
	hpRatio := player.HP / player.MaxHP

	switch phase {
	case ARPhasePvP:
		// PvP phase: hunt or evade based on build
		if hpRatio < 0.3 {
			tac.Goal = ARGoalPvPEvade
		} else if profile.Aggression > 0.6 {
			tac.Goal = ARGoalPvPHunt
		} else {
			tac.Goal = ARGoalPvPEvade
		}
		tacticalSelectPvPTarget(player, tac, otherPlayers)
		return

	case ARPhaseDeploy:
		// No combat — just idle
		tac.Goal = ARGoalFarm
		return

	case ARPhaseSettlement:
		// Settlement: fight the boss cooperatively
		if hpRatio < 0.25 {
			tac.Goal = ARGoalSurvive
			tac.DesiredPos = tacticalFleeDirection(player, enemies)
		} else {
			tac.Goal = ARGoalAggro
			tac.DesiredPos = tacticalAggroPosition(player, enemies)
		}
		return

	default:
		// PvE phases
	}

	// 3. PvE goal selection
	if hpRatio < 0.25 {
		tac.Goal = ARGoalSurvive
		tac.DesiredPos = tacticalFleeDirection(player, enemies)
		return
	}

	// Check for nearby valuable items
	bestItem := tacticalFindBestItem(player, fieldItems)
	if bestItem != nil {
		tac.Goal = ARGoalPickup
		tac.TargetItemID = bestItem.ID
		tac.DesiredPos = bestItem.Pos
		return
	}

	// Kite vs aggro based on profile
	if profile.Aggression < 0.4 && tac.ThreatLevel > 0.5 {
		tac.Goal = ARGoalKite
		tac.DesiredPos = tacticalKitePosition(player, enemies)
		return
	}

	if profile.Aggression > 0.7 && tac.NearbyEnemyCount > 0 {
		tac.Goal = ARGoalAggro
		// Rush toward densest enemy cluster
		tac.DesiredPos = tacticalAggroPosition(player, enemies)
		return
	}

	// Default: farm
	tac.Goal = ARGoalFarm

	// Target the nearest enemy for auto-attack movement
	tac.TargetEnemyID = ""
	nearest := math.MaxFloat64
	for _, e := range enemies {
		if !e.Alive {
			continue
		}
		d := player.Pos.DistTo(e.Pos)
		if d < nearest {
			nearest = d
			tac.TargetEnemyID = e.ID
		}
	}
}

// tacticalFleeDirection computes a direction away from the densest enemy cluster.
func tacticalFleeDirection(player *ARPlayer, enemies []*AREnemy) ARVec3 {
	var avgX, avgZ float64
	count := 0
	for _, e := range enemies {
		if !e.Alive {
			continue
		}
		dist := player.Pos.DistTo(e.Pos)
		if dist < 15.0 {
			avgX += e.Pos.X
			avgZ += e.Pos.Z
			count++
		}
	}

	if count == 0 {
		return player.Pos
	}

	avgX /= float64(count)
	avgZ /= float64(count)

	// Flee in opposite direction
	dx := player.Pos.X - avgX
	dz := player.Pos.Z - avgZ
	dist := math.Sqrt(dx*dx + dz*dz)
	if dist < 0.1 {
		// Random direction
		angle := rand.Float64() * 2 * math.Pi
		dx = math.Cos(angle)
		dz = math.Sin(angle)
		dist = 1
	}

	return ARVec3{
		X: player.Pos.X + (dx/dist)*20.0,
		Z: player.Pos.Z + (dz/dist)*20.0,
	}
}

// tacticalKitePosition finds a safe spot at medium range from enemies.
func tacticalKitePosition(player *ARPlayer, enemies []*AREnemy) ARVec3 {
	flee := tacticalFleeDirection(player, enemies)
	// Kite: don't flee too far, stay at weapon range
	dx := flee.X - player.Pos.X
	dz := flee.Z - player.Pos.Z
	dist := math.Sqrt(dx*dx + dz*dz)
	if dist > 10 {
		dx = dx / dist * 10
		dz = dz / dist * 10
	}
	return ARVec3{X: player.Pos.X + dx, Z: player.Pos.Z + dz}
}

// tacticalAggroPosition finds the position toward the densest enemy cluster.
func tacticalAggroPosition(player *ARPlayer, enemies []*AREnemy) ARVec3 {
	var avgX, avgZ float64
	count := 0
	for _, e := range enemies {
		if !e.Alive {
			continue
		}
		dist := player.Pos.DistTo(e.Pos)
		if dist < 20.0 {
			avgX += e.Pos.X
			avgZ += e.Pos.Z
			count++
		}
	}
	if count == 0 {
		return player.Pos
	}
	return ARVec3{X: avgX / float64(count), Z: avgZ / float64(count)}
}

// tacticalFindBestItem finds the most valuable nearby item.
func tacticalFindBestItem(player *ARPlayer, items []*ARFieldItem) *ARFieldItem {
	var best *ARFieldItem
	bestScore := 0.0

	for _, item := range items {
		if !item.Alive {
			continue
		}
		dist := player.Pos.DistTo(item.Pos)
		if dist > 15.0 {
			continue
		}

		// Score: value / distance
		value := itemPickupValue(item.ItemID, player)
		score := value / (dist + 1.0)
		if score > bestScore {
			bestScore = score
			best = item
		}
	}

	return best
}

// itemPickupValue assigns a value to an item for AI decision-making.
func itemPickupValue(id ARItemID, player *ARPlayer) float64 {
	hpRatio := player.HP / player.MaxHP

	switch id {
	case ARItemHealthOrbSmall:
		if hpRatio < 0.5 {
			return 8.0
		}
		return 2.0
	case ARItemHealthOrbLarge:
		if hpRatio < 0.5 {
			return 15.0
		}
		return 5.0
	case ARItemXPMagnet:
		return 12.0
	case ARItemSpeedBoost:
		return 6.0
	case ARItemShieldBurst:
		if hpRatio < 0.3 {
			return 20.0
		}
		return 8.0
	case ARItemBomb:
		return 7.0
	default:
		// Equipment items
		if len(player.Equipment) < MaxEquipmentSlots {
			return 10.0
		}
		return 3.0
	}
}

// tacticalSelectPvPTarget chooses a player target during PvP phase.
func tacticalSelectPvPTarget(
	player *ARPlayer,
	tac *ARTacticalState,
	others []*ARPlayer,
) {
	var bestTarget *ARPlayer
	bestScore := -1.0

	for _, other := range others {
		if !other.Alive || other.ID == player.ID {
			continue
		}
		// Same faction → skip
		if other.FactionID != "" && other.FactionID == player.FactionID {
			continue
		}

		dist := player.Pos.DistTo(other.Pos)
		if dist > 30.0 {
			continue
		}

		// Score: prefer lower HP enemies nearby
		hpRatio := other.HP / other.MaxHP
		score := (1.0 - hpRatio) * 10.0 / (dist + 1.0)

		if score > bestScore {
			bestScore = score
			bestTarget = other
		}
	}

	if bestTarget != nil {
		tac.TargetEnemyID = bestTarget.ID
		tac.DesiredPos = bestTarget.Pos
	}
}

// TacticalChooseTome selects the best tome during level-up based on profile.
func TacticalChooseTome(
	player *ARPlayer,
	offers []ARTomeOffer,
	profile *ARBuildProfile,
) int {
	bestIdx := 0
	bestScore := -1.0

	for i, offer := range offers {
		score := profile.TomeScore(offer.TomeID)

		// Rarity bonus
		switch offer.Rarity {
		case ARRarityLegendary:
			score *= 3.0
		case ARRarityEpic:
			score *= 2.2
		case ARRarityRare:
			score *= 1.7
		case ARRarityUncommon:
			score *= 1.3
		}

		// Diminishing returns for high stacks
		currentStacks := player.Tomes[offer.TomeID]
		if currentStacks >= 5 {
			score *= 0.7
		}
		if currentStacks >= 8 {
			score *= 0.5
		}

		// Contextual adjustments
		hpRatio := player.HP / player.MaxHP
		if hpRatio < 0.4 && (offer.TomeID == ARTomeHP || offer.TomeID == ARTomeShield || offer.TomeID == ARTomeDodge) {
			score *= 1.5
		}

		if score > bestScore {
			bestScore = score
			bestIdx = i
		}
	}

	return bestIdx
}
