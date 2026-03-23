package game

import (
	"math"

	"github.com/andrewkim-gif/snake/server/internal/domain"
)

// ============================================================
// observe_game — Full Game Observation for AI Agents (S52)
// v9 backward compatible + v10 extended fields
// ============================================================

// ObserveGameRadius is the visibility radius for nearby agents/orbs/objects.
const ObserveGameRadius = 600.0

// BuildObserveGameResponse creates the full game observation response for an AI agent.
// This provides all information an agent needs to make strategic decisions.
func BuildObserveGameResponse(agent *domain.Agent, arena *Arena) *domain.ObserveGameResponse {
	if agent == nil || arena == nil {
		return nil
	}

	currentRadius := arena.GetCurrentRadius()
	agents := arena.GetAgents()
	tick := arena.GetTick()

	// Compute zone based on distance from center relative to arena radius
	zone := computeZone(agent.Position, currentRadius)

	// Compute rank
	rank := arena.GetLeaderboard().GetAgentRankInFinal(agents, agent.ID)

	// Compute time remaining (approximate from tick)
	roundDuration := uint64(DefaultRoomConfig().RoundDurationSec * TickRate)
	timeRemainingSec := 0
	if roundDuration > tick {
		timeRemainingSec = int((roundDuration - tick) / uint64(TickRate))
	}

	// Compute alive count
	aliveCount := 0
	for _, a := range agents {
		if a.Alive {
			aliveCount++
		}
	}

	// Build nearby agents, threats
	var nearbyAgents []domain.ObserveNearbyAgent
	var nearbyThreats []domain.ObserveNearbyThreat
	observeRadiusSq := ObserveGameRadius * ObserveGameRadius

	for _, other := range agents {
		if other.ID == agent.ID || !other.Alive {
			continue
		}
		distSq := DistanceSq(agent.Position, other.Position)
		if distSq > observeRadiusSq {
			continue
		}
		dist := math.Sqrt(distSq)

		// v9 compat: nearby agent
		nearbyAgents = append(nearbyAgents, domain.ObserveNearbyAgent{
			ID:       other.ID,
			X:        other.Position.X,
			Y:        other.Position.Y,
			Mass:     other.Mass,
			Heading:  other.MoveHeading,
			Boosting: other.Boosting,
			Name:     other.Name,
			Level:    other.Level,
		})

		// v10: threat with build type classification
		nearbyThreats = append(nearbyThreats, domain.ObserveNearbyThreat{
			ID:        other.ID,
			Mass:      other.Mass,
			Distance:  math.Round(dist*10) / 10, // round to 1 decimal
			BuildType: classifyBuildType(other.Build),
		})
	}

	// Build nearby orbs (v9 compat)
	var nearbyOrbs []domain.ObserveNearbyOrb
	orbs := arena.GetOrbManager().GetOrbs()
	for _, orb := range orbs {
		distSq := DistanceSq(agent.Position, orb.Position)
		if distSq > observeRadiusSq {
			continue
		}
		nearbyOrbs = append(nearbyOrbs, domain.ObserveNearbyOrb{
			X:     orb.Position.X,
			Y:     orb.Position.Y,
			Value: orb.Value,
			Type:  orb.Type,
		})
	}

	// v10: nearby map objects
	var nearbyMapObjs []domain.ObserveNearbyMapObj
	mapObjs := arena.GetMapObjects().GetNearbyMapObjects(
		agent.Position.X, agent.Position.Y, ObserveGameRadius,
	)
	for _, obj := range mapObjs {
		dx := obj.Position.X - agent.Position.X
		dy := obj.Position.Y - agent.Position.Y
		dist := math.Sqrt(dx*dx + dy*dy)
		nearbyMapObjs = append(nearbyMapObjs, domain.ObserveNearbyMapObj{
			Type:     string(obj.Type),
			X:        obj.Position.X,
			Y:        obj.Position.Y,
			Distance: math.Round(dist*10) / 10,
		})
	}

	return &domain.ObserveGameResponse{
		// v9 compatible fields
		ID:       agent.ID,
		X:        agent.Position.X,
		Y:        agent.Position.Y,
		Heading:  agent.MoveHeading,
		Speed:    agent.Speed,
		Mass:     agent.Mass,
		Alive:    agent.Alive,
		Score:    agent.Score,
		Kills:    agent.Kills,
		Boosting: agent.Boosting,

		NearbyAgents: nearbyAgents,
		NearbyOrbs:   nearbyOrbs,

		// v10 extended fields
		Level:    agent.Level,
		XP:       agent.XP,
		XPToNext: agent.XPToNext,
		Build: domain.ObserveBuildInfo{
			Tomes:           agent.Build.Tomes,
			Abilities:       agent.Build.AbilitySlots,
			ActiveSynergies: agent.ActiveSynergies,
		},
		ArenaRadius:   currentRadius,
		Zone:          zone,
		NearbyThreats: nearbyThreats,
		NearbyMapObjs: nearbyMapObjs,
		TimeRemaining: timeRemainingSec,
		MyRank:        rank,
		AliveCount:    aliveCount,
		Tick:          tick,
	}
}

// computeZone determines the agent's zone based on distance from center.
// Returns "center" (0-25%), "mid" (25-60%), "edge" (60-85%), "danger" (85%+).
func computeZone(pos domain.Position, arenaRadius float64) string {
	distFromCenter := math.Sqrt(pos.X*pos.X + pos.Y*pos.Y)
	ratio := distFromCenter / arenaRadius

	switch {
	case ratio < 0.25:
		return "center"
	case ratio < 0.60:
		return "mid"
	case ratio < 0.85:
		return "edge"
	default:
		return "danger"
	}
}

// classifyBuildType determines the dominant build type from the agent's tomes.
// Returns "berserker", "tank", "speedster", "farmer", or "balanced".
func classifyBuildType(build domain.PlayerBuild) string {
	if build.Tomes == nil {
		return "balanced"
	}

	berserker := build.Tomes[domain.TomeDamage] + build.Tomes[domain.TomeCursed]
	tank := build.Tomes[domain.TomeArmor] + build.Tomes[domain.TomeRegen]
	speedster := build.Tomes[domain.TomeSpeed] + build.Tomes[domain.TomeMagnet]
	farmer := build.Tomes[domain.TomeXP] + build.Tomes[domain.TomeLuck]

	maxVal := berserker
	maxType := "berserker"

	if tank > maxVal {
		maxVal = tank
		maxType = "tank"
	}
	if speedster > maxVal {
		maxVal = speedster
		maxType = "speedster"
	}
	if farmer > maxVal {
		maxVal = farmer
		maxType = "farmer"
	}

	// If all equal (including 0), return balanced
	if berserker == tank && tank == speedster && speedster == farmer {
		return "balanced"
	}

	return maxType
}
