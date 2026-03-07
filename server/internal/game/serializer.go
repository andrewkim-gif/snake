package game

import (
	"math"

	"github.com/andrewkim-gif/snake/server/internal/domain"
)

// StateSerializer handles converting game state to client-friendly formats
// with viewport culling for bandwidth efficiency.
type StateSerializer struct{}

// NewStateSerializer creates a new StateSerializer.
func NewStateSerializer() *StateSerializer {
	return &StateSerializer{}
}

// SerializeState creates a StateUpdate for a specific viewer agent.
// Only agents and orbs within the viewer's viewport (+ margin) are included.
func (ss *StateSerializer) SerializeState(
	viewerAgent *domain.Agent,
	agents map[string]*domain.Agent,
	orbs map[string]*domain.Orb,
	leaderboard []domain.LeaderboardEntry,
	tick uint64,
) domain.StateUpdate {
	viewX := viewerAgent.Position.X
	viewY := viewerAgent.Position.Y

	halfW := (ViewportWidth / 2) + ViewportMargin
	halfH := (ViewportHeight / 2) + ViewportMargin

	// Cull agents within viewport
	stateAgents := make([]domain.StateAgent, 0, 32)
	for _, a := range agents {
		if !a.Alive {
			continue
		}
		if isInViewport(a.Position.X, a.Position.Y, viewX, viewY, halfW, halfH) {
			stateAgents = append(stateAgents, serializeAgent(a))
		}
	}

	// Cull orbs within viewport
	stateOrbs := make([]domain.StateOrb, 0, 64)
	for _, o := range orbs {
		if isInViewport(o.Position.X, o.Position.Y, viewX, viewY, halfW, halfH) {
			stateOrbs = append(stateOrbs, serializeOrb(o))
		}
	}

	return domain.StateUpdate{
		Tick:        tick,
		Agents:      stateAgents,
		Orbs:        stateOrbs,
		Leaderboard: leaderboard,
	}
}

// SerializeMinimap creates minimap data with all agent positions (sent at 1Hz).
func (ss *StateSerializer) SerializeMinimap(
	agents map[string]*domain.Agent,
	viewerID string,
	boundary float64,
) domain.MinimapData {
	minimapAgents := make([]domain.MinimapAgent, 0, len(agents))
	for _, a := range agents {
		if !a.Alive {
			continue
		}
		minimapAgents = append(minimapAgents, domain.MinimapAgent{
			X:    a.Position.X,
			Y:    a.Position.Y,
			Mass: a.Mass,
			Me:   a.ID == viewerID,
		})
	}
	return domain.MinimapData{
		Agents:   minimapAgents,
		Boundary: boundary,
	}
}

// SerializeDeathEvent creates a DeathEvent for a dead agent.
func (ss *StateSerializer) SerializeDeathEvent(
	agent *domain.Agent,
	killerID string,
	killerName string,
	damageSource domain.DamageSource,
	duration int,
	rank int,
) domain.DeathEvent {
	return domain.DeathEvent{
		Score:        agent.Score,
		Kills:        agent.Kills,
		Duration:     duration,
		Rank:         rank,
		Killer:       killerID,
		KillerName:   killerName,
		DamageSource: damageSource,
		Level:        agent.Level,
		Build:        agent.Build,
	}
}

// SerializeKillEvent creates a KillEvent for the killer.
func (ss *StateSerializer) SerializeKillEvent(
	victimID string,
	victimName string,
	victimMass float64,
) domain.KillEvent {
	return domain.KillEvent{
		Victim:     victimID,
		VictimName: victimName,
		VictimMass: victimMass,
	}
}

// --- Internal helpers ---

// isInViewport checks if a point (px, py) is within the viewport centered at (cx, cy).
func isInViewport(px, py, cx, cy, halfW, halfH float64) bool {
	return math.Abs(px-cx) <= halfW && math.Abs(py-cy) <= halfH
}

// serializeAgent converts a domain.Agent to a compact StateAgent.
func serializeAgent(a *domain.Agent) domain.StateAgent {
	sa := domain.StateAgent{
		ID:           a.ID,
		X:            math.Round(a.Position.X*10) / 10, // 1 decimal precision
		Y:            math.Round(a.Position.Y*10) / 10,
		Z:            math.Round(a.ZPos*10) / 10,       // v16 Phase 4: vertical position (1 decimal)
		Heading:      math.Round(a.MoveHeading*100) / 100, // 2 decimal precision (v16: MoveHeading)
		Facing:       math.Round(a.AimHeading*100) / 100,  // v16: AimHeading for facing direction
		Mass:         math.Round(a.Mass*10) / 10,
		Alive:        a.Alive,
		Level:        a.Level,
		Name:         a.Name,
		SkinID:       a.Skin.ID,
		HitboxRadius: math.Round(a.HitboxRadius*10) / 10,
	}
	if a.Boosting {
		sa.Boosting = true
	}
	if a.IsBot {
		sa.IsBot = true
	}
	if a.KillStreak > 0 {
		sa.KillStreak = a.KillStreak
	}
	// v10: dominant build type for client visual effects
	bt := classifyBuildType(a.Build)
	if bt != "balanced" {
		sa.BuildType = bt
	}
	// v10 Phase 2: appearance pass-through (매 state에 항상 포함)
	if a.Appearance != "" {
		sa.Appearance = a.Appearance
	}
	// v12: active ability for visual effects
	if a.ActiveAbility != "" && a.ActiveAbilityTicks > 0 {
		sa.ActiveAbility = string(a.ActiveAbility)
		sa.AbilityTargetX = math.Round(a.AbilityTargetX*10) / 10
		sa.AbilityTargetY = math.Round(a.AbilityTargetY*10) / 10
		sa.AbilityLevel = a.AbilityLevel
	}
	// v14: nationality
	if a.Nationality != "" {
		sa.Nationality = a.Nationality
	}
	// v16 Phase 5: biome + water state
	if a.BiomeIndex > 0 {
		sa.BiomeIndex = int(a.BiomeIndex)
	}
	if a.InWater {
		sa.InWater = true
	}
	return sa
}

// orbTypeColor maps OrbType to client color index (0-7).
var orbTypeColor = map[domain.OrbType]int{
	domain.OrbTypeNatural: 0, // green
	domain.OrbTypeDeath:   2, // red
}

// serializeOrb converts a domain.Orb to a compact StateOrb.
func serializeOrb(o *domain.Orb) domain.StateOrb {
	c := orbTypeColor[o.Type] // 0 if unknown
	return domain.StateOrb{
		X:     math.Round(o.Position.X*10) / 10,
		Y:     math.Round(o.Position.Y*10) / 10,
		Value: math.Round(o.Value*10) / 10,
		Color: c,
		Type:  o.Type,
	}
}
